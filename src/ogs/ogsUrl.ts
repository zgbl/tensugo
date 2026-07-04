import type { OgsUrlTarget } from "./types";

export function parseOgsUrl(rawUrl: string): OgsUrlTarget | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  const directReview = trimmed.match(/^(?:review|demo)[:/#-]?(\d+)$/i);
  if (directReview) {
    return { kind: "review", reviewId: Number(directReview[1]) };
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
  const reviewIndex = parts.findIndex((part) => part === "review" || part === "demo");
  if (reviewIndex >= 0) {
    const maybeViewOffset = parts[reviewIndex + 1] === "view" ? 2 : 1;
    const reviewId = Number(parts[reviewIndex + maybeViewOffset]);
    return Number.isInteger(reviewId) && reviewId > 0 ? { kind: "review", reviewId } : null;
  }

  const gameIndex = parts.findIndex((part) => part === "game");
  if (gameIndex >= 0) {
    const gameId = Number(parts[gameIndex + 1]);
    return Number.isInteger(gameId) && gameId > 0 ? { kind: "game", gameId } : null;
  }

  return null;
}
