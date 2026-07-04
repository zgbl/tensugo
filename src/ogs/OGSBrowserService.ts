import { filterByRankRange, formatOgsRank } from "./ogsRank";

const OGS_WEBSOCKET_URL = "wss://wsp.online-go.com";

export type OgsGameSpeedFilter = "all" | "live" | "blitz" | "correspondence";
export type OgsBoardSizeFilter = "all" | "19" | "13" | "9";
export type OgsRuleFilter = "all" | "chinese" | "japanese" | "aga";

export type OgsBrowserFilters = {
  boardSize: OgsBoardSizeFilter;
  gameType: OgsGameSpeedFilter;
  maxRank: string;
  minRank: string;
  requireWatchers: boolean;
  rules: OgsRuleFilter;
  search: string;
};

export type OgsBrowserGame = {
  aiReview?: boolean;
  blackName: string;
  blackRank?: number;
  boardSize: string;
  gameId: number;
  moveNumber: number;
  phase: string;
  rules?: string;
  speed?: string;
  watchers?: number;
  whiteName: string;
  whiteRank?: number;
};

type GameListEntry = {
  ai_review?: boolean;
  black?: { username?: string; rank?: number; ranking?: number; professional?: boolean };
  height?: number;
  id: number;
  json?: {
    time_control?: { speed?: string; system?: string };
  };
  move_number?: number;
  phase?: string;
  rules?: string;
  time_control?: { speed?: string; system?: string };
  viewers?: number;
  watchers?: number;
  white?: { username?: string; rank?: number; ranking?: number; professional?: boolean };
  width?: number;
};

type GameListResponse = {
  results?: GameListEntry[];
};

export class OGSBrowserService {
  async fetchLiveGames(filters: OgsBrowserFilters): Promise<OgsBrowserGame[]> {
    const list = filters.gameType === "correspondence" ? "corr" : "live";
    const where = buildServerWhere(filters);
    let response = await queryGameList(list, where);
    if ((response?.results ?? []).length === 0 && filters.boardSize !== "all") {
      response = await queryGameList(list, { hide_bot_games: true });
    }
    const games = (response?.results ?? []).map(toBrowserGame);
    const filteredGames = games.filter((game) => filterBrowserGame(game, filters));
    return filteredGames.length > 0 ? filteredGames : games;
  }

  async fetchReviews(): Promise<OgsBrowserGame[]> {
    // OGS exposes individual public review metadata and SGF, but the current
    // web client does not use a public review-list endpoint. Keep the service
    // boundary here so a provider-specific list can be added without changing App.
    return [];
  }
}

function queryGameList(list: "live" | "corr", where: Record<string, boolean>): Promise<GameListResponse> {
  return sendOgsSocketRequest<GameListResponse>("gamelist/query", {
      channel: "tensugo-watch",
      from: 0,
      limit: 100,
      list,
      sort_by: "rank",
      where
  });
}

function buildServerWhere(filters: OgsBrowserFilters): Record<string, boolean> {
  return {
    hide_13x13: filters.boardSize !== "all" && filters.boardSize !== "13",
    hide_19x19: filters.boardSize !== "all" && filters.boardSize !== "19",
    hide_9x9: filters.boardSize !== "all" && filters.boardSize !== "9",
    hide_other: filters.boardSize !== "all",
    hide_bot_games: true
  };
}

function filterBrowserGame(game: OgsBrowserGame, filters: OgsBrowserFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  if (search && !`${game.blackName} ${game.whiteName}`.toLowerCase().includes(search)) {
    return false;
  }
  if (filters.boardSize !== "all" && game.boardSize !== `${filters.boardSize}x${filters.boardSize}`) {
    return false;
  }
  if (filters.rules !== "all" && game.rules?.toLowerCase() !== filters.rules) {
    return false;
  }
  if (filters.gameType !== "all" && filters.gameType !== "correspondence" && game.speed !== filters.gameType) {
    return false;
  }
  if (filters.requireWatchers && typeof game.watchers === "number" && game.watchers <= 0) {
    return false;
  }
  return passesRankRange(game, filters);
}

function passesRankRange(game: OgsBrowserGame, filters: OgsBrowserFilters): boolean {
  if (!filters.minRank.trim() && !filters.maxRank.trim()) {
    return true;
  }
  return filterByRankRange(game.blackRank, filters.minRank, filters.maxRank) || filterByRankRange(game.whiteRank, filters.minRank, filters.maxRank);
}

function toBrowserGame(entry: GameListEntry): OgsBrowserGame {
  const width = entry.width ?? 19;
  const height = entry.height ?? width;
  const blackRank = entry.black?.ranking ?? entry.black?.rank;
  const whiteRank = entry.white?.ranking ?? entry.white?.rank;
  return {
    aiReview: entry.ai_review,
    blackName: `${entry.black?.username ?? "Black"} ${formatOgsRank(blackRank)}`,
    blackRank,
    boardSize: `${width}x${height}`,
    gameId: entry.id,
    moveNumber: entry.move_number ?? 0,
    phase: entry.phase ?? "",
    rules: entry.rules,
    speed: entry.time_control?.speed ?? entry.json?.time_control?.speed,
    watchers: entry.watchers ?? entry.viewers,
    whiteName: `${entry.white?.username ?? "White"} ${formatOgsRank(whiteRank)}`,
    whiteRank
  };
}

function sendOgsSocketRequest<T>(eventName: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(OGS_WEBSOCKET_URL);
    const requestId = 1;
    const timeout = window.setTimeout(() => {
      socket.close();
      reject(new Error("OGS browser request timed out"));
    }, 8000);

    socket.addEventListener("open", () => {
      void authenticateOgsSocket(socket).finally(() => {
        socket.send(JSON.stringify([eventName, payload, requestId]));
      });
    });
    socket.addEventListener("message", (event) => {
      const parsed = JSON.parse(String(event.data)) as [number | string, T, unknown?];
      if (parsed[0] !== requestId) {
        return;
      }
      window.clearTimeout(timeout);
      socket.close();
      if (parsed[2]) {
        reject(new Error(String(parsed[2])));
        return;
      }
      resolve(parsed[1]);
    });
    socket.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("OGS browser socket error"));
    });
  });
}

async function authenticateOgsSocket(socket: WebSocket): Promise<void> {
  try {
    const response = await fetch("https://online-go.com/api/v1/ui/config");
    const config = (await response.json()) as { user_jwt?: string };
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(["authenticate", {
        client: "TensuGo",
        jwt: config.user_jwt ?? "",
        language: "en",
        user_agent: window.navigator.userAgent
      }]));
    }
  } catch (error) {
    console.warn("OGS browser authentication skipped", error);
  }
}
