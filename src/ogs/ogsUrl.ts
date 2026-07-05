import type { OgsUrlTarget } from "./types";

export function parseOgsUrl(rawUrl: string): OgsUrlTarget | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  const directDemo = trimmed.match(/^(?:demo|review)[:/#-]?(\d+)$/i);
  if (directDemo) {
    return { kind: "demo", demoId: Number(directDemo[1]) };
  }

  const directGame = trimmed.match(/^game[:/#-]?(\d+)$/i);
  if (directGame) {
    return { kind: "game", gameId: Number(directGame[1]) };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "online-go.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const demoIndex = parts.findIndex((part) => part === "demo" || part === "review");
  if (demoIndex >= 0) {
    const maybeViewOffset = parts[demoIndex + 1] === "view" ? 2 : 1;
    const demoId = Number(parts[demoIndex + maybeViewOffset]);
    return Number.isInteger(demoId) && demoId > 0 ? { kind: "demo", demoId } : null;
  }

  const gameIndex = parts.findIndex((part) => part === "game");
  if (gameIndex >= 0) {
    const gameId = Number(parts[gameIndex + 1]);
    return Number.isInteger(gameId) && gameId > 0 ? { kind: "game", gameId } : null;
  }

  return null;
}
