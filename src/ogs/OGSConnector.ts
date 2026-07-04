import { decodeOgsMoveString } from "./ogsMoveDecoder";
import { parseOgsUrl } from "./ogsUrl";
import { parseGameRecord } from "../sgf/parseSgf";
import type { OgsMoveUpdate, OgsStatusUpdate } from "./types";
import type { ReviewMove } from "../game/sampleGame";

const OGS_WEBSOCKET_URL = "wss://wsp.online-go.com";
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1500;
const GAME_POLL_INTERVAL_MS = 10_000;
const REVIEW_STATIC_FALLBACK_DELAY_MS = 2500;

type OgsSocketMessage = [string, unknown];
type OgsGameData = {
  black?: { username?: string };
  black_player_id?: number;
  game_id?: number;
  height?: number;
  komi?: number | string;
  moves?: unknown;
  outcome?: string;
  phase?: string;
  players?: {
    black?: { username?: string };
    white?: { username?: string };
  };
  rules?: string;
  time_control?: {
    main_time?: number;
    period_time?: number;
    periods?: number;
    speed?: string;
    system?: string;
    time_control?: string;
  };
  white?: { username?: string };
  white_player_id?: number;
  width?: number;
};

type OgsGameApiResponse = {
  ended?: string | null;
  gamedata?: OgsGameData;
  id?: number;
  outcome?: string;
};

export class OGSConnector {
  private gameId: number | null = null;
  private gamePollTimer: number | null = null;
  private lastGameMoveSignature: string | null = null;
  private moveCallback: ((update: OgsMoveUpdate) => void) | null = null;
  private reconnectAttempts = 0;
  private reviewId: number | null = null;
  private reviewStaticFallbackTimer: number | null = null;
  private reviewMoves: ReviewMove[] = [];
  private reviewWarnings: string[] = [];
  private shouldReconnect = false;
  private socket: WebSocket | null = null;
  private statusCallback: ((update: OgsStatusUpdate) => void) | null = null;

  parseOgsUrl(url: string) {
    return parseOgsUrl(url);
  }

  connectGame(gameId: number) {
    if (this.socket && this.gameId === gameId && this.socket.readyState <= WebSocket.OPEN) {
      this.emitStatus("connected", `Already connected to OGS Game #${gameId}`, this.gameSourceLabel(gameId));
      return;
    }

    this.disconnect();
    this.gameId = gameId;
    this.reconnectAttempts = 0;
    this.shouldReconnect = true;
    this.emitStatus("connecting", `Loading OGS Game #${gameId}`, this.gameSourceLabel(gameId));
    void this.loadPublicGame(gameId, "Loaded", true);
    this.startGamePolling(gameId);
    this.openSocket();
  }

  connectReview(reviewId: number) {
    if (this.socket && this.reviewId === reviewId && this.socket.readyState <= WebSocket.OPEN) {
      this.emitStatus("connected", `Already connected to OGS Review #${reviewId}`, this.sourceLabel(reviewId));
      return;
    }

    this.disconnect();
    this.gameId = null;
    this.lastGameMoveSignature = null;
    this.reviewId = reviewId;
    this.reviewMoves = [];
    this.reviewWarnings = [];
    this.reconnectAttempts = 0;
    this.shouldReconnect = true;
    this.openSocket();
    this.startReviewStaticFallback(reviewId);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopGamePolling();
    this.stopReviewStaticFallback();
    if (this.socket) {
      try {
        if (this.reviewId) {
          this.socket.send(JSON.stringify(["review/disconnect", { review_id: this.reviewId }]));
        } else if (this.gameId) {
          this.socket.send(JSON.stringify(["game/disconnect", { game_id: this.gameId }]));
        }
      } catch (error) {
        console.warn("OGS disconnect send failed", error);
      }
      this.socket.close();
      this.socket = null;
    }
    this.emitStatus(
      "disconnected",
      "OGS disconnected",
      this.reviewId ? this.sourceLabel(this.reviewId) : this.gameId ? this.gameSourceLabel(this.gameId) : undefined
    );
  }

  onMovesUpdated(callback: (update: OgsMoveUpdate) => void) {
    this.moveCallback = callback;
  }

  onConnectionStatusChanged(callback: (update: OgsStatusUpdate) => void) {
    this.statusCallback = callback;
  }

  private openSocket() {
    const reviewId = this.reviewId;
    const gameId = this.gameId;
    if (!reviewId && !gameId) {
      return;
    }
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }

    const sourceLabel = reviewId ? this.sourceLabel(reviewId) : this.gameSourceLabel(gameId as number);
    this.emitStatus("connecting", `Connecting to ${sourceLabel}`, sourceLabel);
    try {
      this.socket = new WebSocket(OGS_WEBSOCKET_URL);
    } catch (error) {
      console.error("OGS socket creation failed", error);
      this.emitStatus("error", String(error), sourceLabel);
      return;
    }

    this.socket.addEventListener("open", () => {
      if (!this.socket || this.reviewId !== reviewId || this.gameId !== gameId) {
        return;
      }
      this.reconnectAttempts = 0;
      this.emitStatus("connected", `Connected to ${sourceLabel}`, sourceLabel);
      if (reviewId) {
        this.send(["review/connect", { review_id: reviewId }]);
        this.send(["chat/join", { channel: `review-${reviewId}` }]);
      } else if (gameId) {
        this.send(["game/connect", { chat: false, game_id: gameId }]);
      }
    });

    this.socket.addEventListener("message", (event) => {
      this.handleMessage(event.data, reviewId, gameId);
    });

    this.socket.addEventListener("error", (event) => {
      console.error("OGS WebSocket error", event);
      this.emitStatus("error", "OGS WebSocket error", sourceLabel);
    });

    this.socket.addEventListener("close", () => {
      if (!this.shouldReconnect || this.reviewId !== reviewId || this.gameId !== gameId) {
        this.emitStatus("disconnected", "OGS disconnected", sourceLabel);
        return;
      }
      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this.shouldReconnect = false;
        this.emitStatus("error", "OGS reconnect limit reached", sourceLabel);
        return;
      }
      this.reconnectAttempts += 1;
      this.emitStatus("connecting", `Reconnecting to OGS (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, sourceLabel);
      window.setTimeout(() => this.openSocket(), RECONNECT_DELAY_MS);
    });
  }

  private handleMessage(data: unknown, reviewId: number | null, gameId: number | null) {
    let message: OgsSocketMessage;
    try {
      message = JSON.parse(String(data)) as OgsSocketMessage;
    } catch (error) {
      console.warn("OGS message parse failed", error, data);
      return;
    }

    const [eventName, payload] = message;
    if (gameId) {
      if (eventName === `game/${gameId}/gamedata`) {
        this.processGameData(payload, gameId, "Synced", true);
        return;
      }
      if (eventName === `game/${gameId}/move`) {
        void this.loadPublicGame(gameId, "Synced", true);
        return;
      }
      if (eventName === `game/${gameId}/error`) {
        console.error("OGS game error", payload);
        this.emitStatus("error", typeof payload === "string" ? payload : "OGS game error", this.gameSourceLabel(gameId));
        return;
      }
    }
    if (!reviewId) {
      return;
    }
    if (eventName === `review/${reviewId}/r`) {
      this.processReviewMessage(payload, reviewId);
      return;
    }
    if (eventName === `review/${reviewId}/full_state`) {
      const entries = extractReviewEntries(payload);
      if (entries.length === 0) {
        console.warn("OGS review full_state had no review entries", payload);
        this.emitStatus("connected", "OGS full_state contained no moves", this.sourceLabel(reviewId));
        return;
      }
      this.reviewMoves = [];
      this.reviewWarnings = [];
      for (const item of entries) {
        this.processReviewMessage(item, reviewId, true);
      }
      this.publishReviewMoves(reviewId, "Loaded");
      return;
    }
    if (eventName === `review/${reviewId}/error`) {
      console.error("OGS review error", payload);
      this.emitStatus("error", typeof payload === "string" ? payload : "OGS review error", this.sourceLabel(reviewId));
    }
  }

  private processReviewMessage(payload: unknown, reviewId: number, deferPublish = false) {
    if (!isReviewMovePayload(payload)) {
      if (isObject(payload) && ("gamedata" in payload || "chat" in payload || "owner" in payload || "controller" in payload)) {
        return;
      }
      console.debug("OGS review payload without moves ignored", payload);
      return;
    }
    try {
      this.emitStatus("syncing", `Syncing OGS Review #${reviewId}`, this.sourceLabel(reviewId));
      const fromMove = typeof payload.f === "number" && payload.f > 0 ? payload.f : 0;
      const decoded = decodeOgsMoveString(payload.m, 19, fromMove);
      this.reviewMoves = this.reviewMoves.slice(0, fromMove).concat(decoded.moves);
      this.reviewWarnings = this.reviewWarnings.concat(decoded.warnings);
      if (!deferPublish) {
        this.publishReviewMoves(reviewId, "Synced");
      }
    } catch (error) {
      console.error("OGS move decode failed", { error, payload });
      this.emitStatus("error", "OGS move decode failed", this.sourceLabel(reviewId));
    }
  }

  private publishReviewMoves(reviewId: number, verb: "Loaded" | "Synced") {
    this.stopReviewStaticFallback();
    const moves = this.reviewMoves.map((move, index) => ({
      ...move,
      moveNumber: index + 1
    }));
    this.moveCallback?.({
      boardSize: 19,
      moves,
      rawMoveString: "",
      reviewId,
      sourceLabel: this.sourceLabel(reviewId),
      warnings: this.reviewWarnings
    });
    const suffix = moves.length === 0 ? "no playable moves yet" : `${moves.length} moves`;
    this.emitStatus("connected", `${verb} ${suffix}`, this.sourceLabel(reviewId));
  }

  private send(message: OgsSocketMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private emitStatus(status: OgsStatusUpdate["status"], detail?: string, sourceLabel?: string) {
    this.statusCallback?.({ detail, sourceLabel, status });
  }

  private startGamePolling(gameId: number) {
    this.stopGamePolling();
    this.gamePollTimer = window.setInterval(() => {
      if (this.gameId !== gameId) {
        this.stopGamePolling();
        return;
      }
      void this.loadPublicGame(gameId, "Synced", false);
    }, GAME_POLL_INTERVAL_MS);
  }

  private stopGamePolling() {
    if (this.gamePollTimer !== null) {
      window.clearInterval(this.gamePollTimer);
      this.gamePollTimer = null;
    }
  }

  private async loadPublicGame(gameId: number, verb: "Loaded" | "Synced", forcePublish: boolean) {
    try {
      const response = await fetch(`https://online-go.com/api/v1/games/${gameId}`);
      if (!response.ok) {
        throw new Error(`OGS game request failed: ${response.status}`);
      }
      const payload = (await response.json()) as OgsGameApiResponse;
      this.processGameData(withApiGameEndState(payload.gamedata, payload), gameId, verb, forcePublish);
    } catch (error) {
      console.error("OGS game load failed", error);
      this.emitStatus("error", error instanceof Error ? error.message : "OGS game load failed", this.gameSourceLabel(gameId));
    }
  }

  private startReviewStaticFallback(reviewId: number) {
    this.stopReviewStaticFallback();
    this.reviewStaticFallbackTimer = window.setTimeout(() => {
      if (this.reviewId !== reviewId || this.reviewMoves.length > 0) {
        return;
      }
      void this.loadStaticReview(reviewId);
    }, REVIEW_STATIC_FALLBACK_DELAY_MS);
  }

  private stopReviewStaticFallback() {
    if (this.reviewStaticFallbackTimer !== null) {
      window.clearTimeout(this.reviewStaticFallbackTimer);
      this.reviewStaticFallbackTimer = null;
    }
  }

  private async loadStaticReview(reviewId: number) {
    try {
      this.emitStatus("syncing", `Loading static OGS Review #${reviewId}`, this.sourceLabel(reviewId));
      const response = await fetch(`https://online-go.com/api/v1/reviews/${reviewId}/sgf?without-comments=1`);
      if (!response.ok) {
        throw new Error(`OGS review SGF request failed: ${response.status}`);
      }
      const sgf = await response.text();
      const parsed = parseGameRecord(sgf, this.sourceLabel(reviewId));
      this.reviewMoves = parsed.moves;
      this.reviewWarnings = parsed.warnings;
      this.moveCallback?.({
        boardSize: parsed.boardSize,
        isFinished: Boolean(parsed.result),
        metadata: {
          blackName: parsed.blackName,
          komi: parsed.komi,
          result: parsed.result,
          rules: parsed.rules,
          whiteName: parsed.whiteName
        },
        moves: parsed.moves,
        rawMoveString: "",
        reviewId,
        sourceLabel: this.sourceLabel(reviewId),
        warnings: parsed.warnings
      });
      this.emitStatus("connected", `Loaded static review ${parsed.moves.length} moves`, this.sourceLabel(reviewId));
    } catch (error) {
      console.error("OGS static review load failed", error);
      this.emitStatus("error", error instanceof Error ? error.message : "OGS static review load failed", this.sourceLabel(reviewId));
    }
  }

  private processGameData(payload: unknown, gameId: number, verb: "Loaded" | "Synced", forcePublish: boolean) {
    if (!isObject(payload)) {
      this.emitStatus("error", "OGS game data missing", this.gameSourceLabel(gameId));
      return;
    }
    const gamedata = payload as OgsGameData;
    const boardSize = typeof gamedata.width === "number" ? gamedata.width : 19;
    const decoded = decodeOgsGameMoves(gamedata.moves, boardSize);
    const isFinished = isOgsGameFinished(gamedata);
    if (isFinished) {
      this.stopGamePolling();
    }
    const sourceLabel = this.gameSourceLabel(gameId);
    const signature = makeMoveSignature(decoded.moves);
    if (!forcePublish && signature === this.lastGameMoveSignature) {
      return;
    }
    this.lastGameMoveSignature = signature;
    this.moveCallback?.({
      boardSize,
      metadata: buildGameMetadata(gamedata),
      moves: decoded.moves,
      rawMoveString: "",
      gameId,
      isFinished,
      sourceLabel,
      warnings: decoded.warnings
    });
    const moveSummary = decoded.moves.length === 0 ? "no playable moves yet" : `${decoded.moves.length} moves`;
    this.emitStatus("connected", `${verb} ${moveSummary}${isFinished ? "; game finished, polling stopped" : ""}`, sourceLabel);
  }

  private sourceLabel(reviewId: number) {
    return `OGS Review #${reviewId}`;
  }

  private gameSourceLabel(gameId: number) {
    return `OGS Game #${gameId}`;
  }
}

function makeMoveSignature(moves: ReviewMove[]): string {
  const lastMove = moves[moves.length - 1];
  return lastMove ? `${moves.length}:${lastMove.color}:${lastMove.x}:${lastMove.y}` : "0";
}

function withApiGameEndState(gamedata: OgsGameData | undefined, payload: OgsGameApiResponse): OgsGameData | undefined {
  if (!gamedata) {
    return gamedata;
  }
  return {
    ...gamedata,
    outcome: gamedata.outcome ?? payload.outcome,
    phase: gamedata.phase ?? (payload.ended ? "finished" : undefined)
  };
}

function isOgsGameFinished(gamedata: OgsGameData): boolean {
  return gamedata.phase === "finished" || Boolean(gamedata.outcome);
}

function buildGameMetadata(gamedata: OgsGameData): NonNullable<OgsMoveUpdate["metadata"]> {
  const komi = typeof gamedata.komi === "number" ? gamedata.komi : Number(gamedata.komi);
  return {
    blackName: gamedata.players?.black?.username ?? gamedata.black?.username,
    komi: Number.isFinite(komi) ? komi : undefined,
    result: gamedata.outcome,
    rules: gamedata.rules,
    timeControl: formatTimeControl(gamedata.time_control),
    whiteName: gamedata.players?.white?.username ?? gamedata.white?.username
  };
}

function formatTimeControl(timeControl: OgsGameData["time_control"]): string | undefined {
  if (!timeControl) {
    return undefined;
  }
  const system = timeControl.system ?? timeControl.time_control ?? "time";
  const speed = timeControl.speed ? ` / ${timeControl.speed}` : "";
  if (system === "byoyomi") {
    const main = formatSeconds(timeControl.main_time);
    const period = formatSeconds(timeControl.period_time);
    const periods = typeof timeControl.periods === "number" ? timeControl.periods : undefined;
    return `${system} ${main}${period ? ` + ${periods ?? "?"}x${period}` : ""}${speed}`;
  }
  if (system === "fischer") {
    return `${system} ${formatSeconds(timeControl.main_time)}${speed}`;
  }
  return `${system}${speed}`;
}

function formatSeconds(seconds: number | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "?";
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  return `${seconds}s`;
}

function decodeOgsGameMoves(moveList: unknown, boardSize: number): { moves: ReviewMove[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!Array.isArray(moveList)) {
    return { moves: [], warnings: ["OGS game data did not include a move list."] };
  }
  const moves: ReviewMove[] = [];
  for (let index = 0; index < moveList.length; index += 1) {
    const rawMove = moveList[index];
    if (!Array.isArray(rawMove) || typeof rawMove[0] !== "number" || typeof rawMove[1] !== "number") {
      warnings.push(`OGS game move ${index + 1} has an unknown format.`);
      continue;
    }
    const [x, y] = rawMove;
    if (x < 0 || y < 0) {
      warnings.push(`OGS game move ${index + 1} is pass/unknown and is not shown on the board.`);
      continue;
    }
    if (x >= boardSize || y >= boardSize) {
      warnings.push(`OGS game move ${index + 1} is out of bounds: ${x},${y}`);
      continue;
    }
    const colorMarker = typeof rawMove[3] === "number" ? rawMove[3] : 0;
    moves.push({
      color: colorMarker === 1 ? "black" : colorMarker === 2 ? "white" : index % 2 === 0 ? "black" : "white",
      moveNumber: moves.length + 1,
      x,
      y
    });
  }
  return { moves, warnings };
}

function isReviewMovePayload(value: unknown): value is { f?: number; m: string } {
  return Boolean(isObject(value) && "m" in value && typeof (value as { m?: unknown }).m === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function extractReviewEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isObject(payload)) {
    return [];
  }
  for (const key of ["entries", "messages", "state", "reviews", "r"]) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}
