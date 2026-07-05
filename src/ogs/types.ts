import type { ReviewMove } from "../game/sampleGame";

export type OgsUrlTarget =
  | { kind: "demo"; demoId: number }
  | { kind: "game"; gameId: number };

export type OgsConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "syncing"
  | "disconnected"
  | "unsupported"
  | "error";

export type OgsDecodedMoves = {
  boardSize: number;
  moves: ReviewMove[];
  rawMoveString: string;
  warnings: string[];
};

export type OgsMoveUpdate = OgsDecodedMoves & {
  gameId?: number;
  isFinished?: boolean;
  metadata?: {
    blackName?: string;
    gameName?: string;
    komi?: number;
    result?: string;
    rules?: string;
    timeControl?: string;
    whiteName?: string;
  };
  demoId?: number;
  sourceLabel: string;
};

export type OgsStatusUpdate = {
  detail?: string;
  sourceLabel?: string;
  status: OgsConnectionStatus;
};
