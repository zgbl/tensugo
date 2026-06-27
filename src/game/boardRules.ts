import type { StoneColor } from "./gameTree";
import type { ReviewMove, ReviewStone } from "./sampleGame";

type Point = {
  x: number;
  y: number;
};

type PlacedStone = ReviewMove;

export type BoardPosition = {
  stones: ReviewStone[];
  capturedBlack: number;
  capturedWhite: number;
  invalidMoves: ReviewMove[];
};

const opposite = (color: StoneColor): StoneColor => (color === "black" ? "white" : "black");
const keyOf = ({ x, y }: Point) => `${x},${y}`;

function neighbors(point: Point, boardSize: number): Point[] {
  return [
    { x: point.x - 1, y: point.y },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y - 1 },
    { x: point.x, y: point.y + 1 }
  ].filter((next) => next.x >= 0 && next.y >= 0 && next.x < boardSize && next.y < boardSize);
}

function collectString(start: Point, board: Map<string, PlacedStone>, boardSize: number) {
  const first = board.get(keyOf(start));
  const stones = new Set<string>();
  const liberties = new Set<string>();

  if (!first) {
    return { stones, liberties };
  }

  const queue = [start];
  stones.add(keyOf(start));

  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];

    for (const next of neighbors(point, boardSize)) {
      const nextKey = keyOf(next);
      const nextStone = board.get(nextKey);

      if (!nextStone) {
        liberties.add(nextKey);
      } else if (nextStone.color === first.color && !stones.has(nextKey)) {
        stones.add(nextKey);
        queue.push(next);
      }
    }
  }

  return { stones, liberties };
}

export function getNextColor(currentMoveNumber: number): StoneColor {
  return currentMoveNumber % 2 === 0 ? "black" : "white";
}

export function buildBoardPosition(
  moves: ReviewMove[],
  boardSize: number,
  currentMoveNumber: number
): BoardPosition {
  const board = new Map<string, PlacedStone>();
  const invalidMoves: ReviewMove[] = [];
  let capturedBlack = 0;
  let capturedWhite = 0;

  for (const move of moves.filter((item) => item.moveNumber <= currentMoveNumber)) {
    const moveKey = keyOf(move);

    if (
      move.x < 0 ||
      move.y < 0 ||
      move.x >= boardSize ||
      move.y >= boardSize ||
      board.has(moveKey)
    ) {
      invalidMoves.push(move);
      continue;
    }

    board.set(moveKey, move);

    for (const next of neighbors(move, boardSize)) {
      const nextStone = board.get(keyOf(next));
      if (!nextStone || nextStone.color !== opposite(move.color)) {
        continue;
      }

      const group = collectString(next, board, boardSize);
      if (group.liberties.size === 0) {
        for (const capturedKey of group.stones) {
          const captured = board.get(capturedKey);
          if (captured?.color === "black") {
            capturedBlack += 1;
          } else if (captured?.color === "white") {
            capturedWhite += 1;
          }
          board.delete(capturedKey);
        }
      }
    }

    const ownGroup = collectString(move, board, boardSize);
    if (ownGroup.liberties.size === 0) {
      invalidMoves.push(move);
      board.delete(moveKey);
    }
  }

  return {
    capturedBlack,
    capturedWhite,
    invalidMoves,
    stones: [...board.values()].map((stone) => ({
      ...stone,
      isLast: stone.moveNumber === currentMoveNumber
    }))
  };
}

export function canPlayMove(
  moves: ReviewMove[],
  boardSize: number,
  currentMoveNumber: number,
  point: Point
): boolean {
  const position = buildBoardPosition(moves, boardSize, currentMoveNumber);
  return (
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < boardSize &&
    point.y < boardSize &&
    !position.stones.some((stone) => stone.x === point.x && stone.y === point.y)
  );
}

