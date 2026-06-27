import type { GameTree } from "../game/gameTree";

export type SgfDocument = {
  source: string;
  gameTree: GameTree;
  warnings: string[];
};

