import type { StoneColor } from "./gameTree";

export type ReviewMove = {
  moveNumber: number;
  color: StoneColor;
  x: number;
  y: number;
  isSetup?: boolean;
  pass?: boolean;
};

export type ReviewStone = ReviewMove & {
  isLast: boolean;
};

export const sampleGameMoves: ReviewMove[] = [
  { moveNumber: 1, color: "black", x: 16, y: 16 },
  { moveNumber: 2, color: "white", x: 3, y: 14 },
  { moveNumber: 3, color: "black", x: 15, y: 3 },
  { moveNumber: 4, color: "white", x: 3, y: 2 },
  { moveNumber: 5, color: "black", x: 2, y: 4 },
  { moveNumber: 6, color: "white", x: 5, y: 3 },
  { moveNumber: 7, color: "black", x: 15, y: 15 },
  { moveNumber: 8, color: "white", x: 17, y: 16 },
  { moveNumber: 9, color: "black", x: 3, y: 8 },
  { moveNumber: 10, color: "white", x: 10, y: 9 },
  { moveNumber: 11, color: "black", x: 12, y: 8 },
  { moveNumber: 12, color: "white", x: 14, y: 9 },
  { moveNumber: 13, color: "black", x: 13, y: 8 },
  { moveNumber: 14, color: "white", x: 15, y: 9 },
  { moveNumber: 15, color: "black", x: 17, y: 9 },
  { moveNumber: 16, color: "white", x: 10, y: 10 },
  { moveNumber: 17, color: "black", x: 11, y: 10 },
  { moveNumber: 18, color: "white", x: 14, y: 10 },
  { moveNumber: 19, color: "black", x: 12, y: 10 },
  { moveNumber: 20, color: "white", x: 11, y: 11 },
  { moveNumber: 21, color: "black", x: 13, y: 10 },
  { moveNumber: 22, color: "white", x: 12, y: 11 },
  { moveNumber: 23, color: "black", x: 15, y: 10 },
  { moveNumber: 24, color: "white", x: 14, y: 11 },
  { moveNumber: 25, color: "black", x: 16, y: 10 },
  { moveNumber: 26, color: "white", x: 13, y: 12 },
  { moveNumber: 27, color: "black", x: 17, y: 10 },
  { moveNumber: 28, color: "white", x: 17, y: 12 },
  { moveNumber: 29, color: "black", x: 14, y: 12 },
  { moveNumber: 30, color: "white", x: 11, y: 13 },
  { moveNumber: 31, color: "black", x: 15, y: 12 },
  { moveNumber: 32, color: "white", x: 16, y: 13 },
  { moveNumber: 33, color: "black", x: 16, y: 12 },
  { moveNumber: 34, color: "white", x: 17, y: 13 },
  { moveNumber: 35, color: "black", x: 18, y: 12 },
  { moveNumber: 36, color: "white", x: 13, y: 14 },
  { moveNumber: 37, color: "black", x: 15, y: 13 },
  { moveNumber: 38, color: "white", x: 14, y: 14 },
  { moveNumber: 39, color: "black", x: 15, y: 14 },
  { moveNumber: 40, color: "white", x: 18, y: 14 },
  { moveNumber: 41, color: "black", x: 11, y: 15 },
  { moveNumber: 42, color: "white", x: 13, y: 15 },
  { moveNumber: 43, color: "black", x: 13, y: 16 },
  { moveNumber: 44, color: "white", x: 18, y: 16 },
  { moveNumber: 45, color: "black", x: 12, y: 16 },
  { moveNumber: 46, color: "white", x: 12, y: 14 },
  { moveNumber: 47, color: "black", x: 14, y: 16 },
  { moveNumber: 48, color: "white", x: 10, y: 13 },
  { moveNumber: 49, color: "black", x: 16, y: 14 },
  { moveNumber: 50, color: "white", x: 18, y: 13 },
  { moveNumber: 51, color: "black", x: 18, y: 9 }
];

export function getReviewStones(currentMoveNumber: number): ReviewStone[] {
  return sampleGameMoves
    .filter((move) => move.moveNumber <= currentMoveNumber)
    .map((move) => ({
      ...move,
      isLast: move.moveNumber === currentMoveNumber
    }));
}
