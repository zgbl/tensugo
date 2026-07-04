import type { ReviewMove } from "../game/sampleGame";
import type { OgsDecodedMoves } from "./types";

const OGS_COORDINATE_SEQUENCE = "abcdefghijklmnopqrstuvwxyz";

type OgsRawMove = {
  color: 0 | 1 | 2;
  edited: boolean;
  x: number;
  y: number;
};

export function decodeOgsMoveString(moveString: string, boardSize = 19, startMoveNumber = 0): OgsDecodedMoves {
  const warnings: string[] = [];
  const rawMoves = decodeRawOgsMoves(moveString, boardSize, warnings);
  const moves: ReviewMove[] = [];

  for (let index = 0; index < rawMoves.length; index += 1) {
    const rawMove = rawMoves[index];
    const moveNumber = startMoveNumber + index + 1;
    if (rawMove.x < 0 || rawMove.y < 0) {
      warnings.push(`OGS 第 ${moveNumber} 手是 pass/未知坐标，暂未显示在棋盘上。`);
      continue;
    }

    if (rawMove.x >= boardSize || rawMove.y >= boardSize) {
      warnings.push(`OGS 第 ${moveNumber} 手坐标越界: ${rawMove.x},${rawMove.y}`);
      continue;
    }

    moves.push({
      color: rawMove.color === 1 ? "black" : rawMove.color === 2 ? "white" : moveNumber % 2 === 1 ? "black" : "white",
      moveNumber,
      x: rawMove.x,
      y: rawMove.y
    });
  }

  return {
    boardSize,
    moves,
    rawMoveString: moveString,
    warnings
  };
}

function decodeRawOgsMoves(moveString: string, boardSize: number, warnings: string[]): OgsRawMove[] {
  const moves: OgsRawMove[] = [];
  if (!moveString) {
    return moves;
  }

  for (let index = 0; index < moveString.length - 1; index += 2) {
    let edited = false;
    let color: 0 | 1 | 2 = 0;
    if (moveString[index] === "!") {
      edited = true;
      if (moveString.slice(index, index + 10) === "!undefined") {
        warnings.push("OGS move string contains !undefined marker.");
        color = 0;
        index += 10;
      } else {
        color = parseOgsColor(moveString[index + 1], warnings);
        index += 2;
      }
    }

    const x = ogsCharToNumber(moveString[index]);
    const y = ogsCharToNumber(moveString[index + 1]);
    moves.push({
      color,
      edited,
      x: x >= boardSize || y >= boardSize ? -1 : x,
      y: x >= boardSize || y >= boardSize ? -1 : y
    });
  }

  if (moveString.length % 2 !== 0 && !moveString.endsWith("!undefined")) {
    warnings.push("OGS move string has an odd length; trailing character ignored.");
  }

  return moves;
}

function ogsCharToNumber(ch: string): number {
  if (ch === ".") {
    return -1;
  }
  return OGS_COORDINATE_SEQUENCE.indexOf(ch);
}

function parseOgsColor(value: string, warnings: string[]): 0 | 1 | 2 {
  const parsed = Number(value);
  if (parsed === 1 || parsed === 2) {
    return parsed;
  }
  warnings.push(`OGS edited move has unknown color marker: ${value}`);
  return 0;
}
