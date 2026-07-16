import { fixedHandicapPoints, getNextColorAfterMoves } from "../game/boardRules";
import type { ReviewMove } from "../game/sampleGame";

export function createFixedHandicapSetupStones(boardSize: number, handicap: number): ReviewMove[] {
  return fixedHandicapPoints(boardSize, handicap).map((point) => ({
    ...point,
    color: "black",
    isSetup: true,
    moveNumber: 0
  }));
}

export function nextHumanPlayColor(handicap: number, moves: ReviewMove[]): "black" | "white" {
  return getNextColorAfterMoves(moves, handicap >= 2 ? "white" : "black");
}
