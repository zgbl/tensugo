export const BOARD_LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ";

export function boardIndexToLabel(index) {
  return BOARD_LETTERS[index] || "?";
}

export function boardPointToGtp(point, boardSize) {
  if (!point || point.x < 0 || point.y < 0 || point.x >= boardSize || point.y >= boardSize) return "";
  return `${boardIndexToLabel(point.x)}${boardSize - point.y}`;
}

export function gtpPointToBoardPoint(value, boardSize) {
  const match = /^([A-HJ-Z])(\d+)$/i.exec(String(value || ""));
  if (!match) return null;
  const x = BOARD_LETTERS.indexOf(match[1].toUpperCase());
  const y = boardSize - Number(match[2]);
  return x >= 0 && x < boardSize && y >= 0 && y < boardSize ? { x, y } : null;
}

export function starPoints(boardSize) {
  if (boardSize === 19) return [3, 9, 15];
  if (boardSize === 13) return [3, 6, 9];
  if (boardSize === 9) return [2, 4, 6];
  return [];
}

export function getNextColor(currentMoveNumber) {
  return currentMoveNumber % 2 === 0 ? "black" : "white";
}

export function getNextColorAfterMoves(moves, firstColor = "black") {
  return moves.length % 2 === 0 ? firstColor : opposite(firstColor);
}

export function fixedHandicapPoints(boardSize, handicap) {
  if (boardSize !== 19 || handicap < 2 || handicap > 9) return [];
  const d4 = { x: 3, y: 15 };
  const q16 = { x: 15, y: 3 };
  const d16 = { x: 3, y: 3 };
  const q4 = { x: 15, y: 15 };
  const d10 = { x: 3, y: 9 };
  const q10 = { x: 15, y: 9 };
  const k4 = { x: 9, y: 15 };
  const k16 = { x: 9, y: 3 };
  const k10 = { x: 9, y: 9 };
  const layouts = {
    2: [d4, q16],
    3: [d4, q16, q4],
    4: [d4, q16, d16, q4],
    5: [d4, q16, d16, q4, k10],
    6: [d4, q16, d16, q4, d10, q10],
    7: [d4, q16, d16, q4, d10, q10, k10],
    8: [d4, q16, d16, q4, d10, q10, k4, k16],
    9: [d4, q16, d16, q4, d10, q10, k4, k16, k10],
  };
  return layouts[handicap].map((point) => ({ ...point }));
}

const keyOf = ({ x, y }) => `${x},${y}`;
const opposite = (color) => color === "black" ? "white" : "black";
const normalizedColor = (color) => color === "B" || color === "black" ? "black" : "white";

function neighbors(point, boardSize) {
  return [
    { x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 },
  ].filter((next) => next.x >= 0 && next.y >= 0 && next.x < boardSize && next.y < boardSize);
}

function collectString(start, board, boardSize) {
  const first = board.get(keyOf(start));
  const stones = new Set();
  const liberties = new Set();
  if (!first) return { stones, liberties };
  const queue = [start];
  stones.add(keyOf(start));
  for (let index = 0; index < queue.length; index += 1) {
    for (const next of neighbors(queue[index], boardSize)) {
      const key = keyOf(next);
      const stone = board.get(key);
      if (!stone) liberties.add(key);
      else if (stone.color === first.color && !stones.has(key)) {
        stones.add(key);
        queue.push(next);
      }
    }
  }
  return { stones, liberties };
}

function boardHash(board) {
  return [...board.values()].map((stone) => `${stone.color[0]}:${stone.x},${stone.y}`).sort().join("|");
}

export function buildBoardPosition(moves, boardSize, currentMoveNumber = moves.length) {
  const board = new Map();
  const invalidMoves = [];
  const history = [""];
  let capturedBlack = 0;
  let capturedWhite = 0;
  const normalizedMoves = moves
    .map((move, index) => ({ ...move, color: normalizedColor(move.color), moveNumber: move.moveNumber ?? index + 1 }))
    .filter((move) => move.moveNumber <= currentMoveNumber);

  for (const move of normalizedMoves) {
    if (move.isSetup) {
      const moveKey = keyOf(move);
      if (move.x < 0 || move.y < 0 || move.x >= boardSize || move.y >= boardSize || board.has(moveKey)) {
        invalidMoves.push(move);
      } else {
        board.set(moveKey, move);
        history[history.length - 1] = boardHash(board);
      }
      continue;
    }
    if (move.pass) {
      history.push(boardHash(board));
      continue;
    }
    const moveKey = keyOf(move);
    if (move.x < 0 || move.y < 0 || move.x >= boardSize || move.y >= boardSize || board.has(moveKey)) {
      invalidMoves.push(move);
      continue;
    }
    const before = new Map(board);
    let moveCapturedBlack = 0;
    let moveCapturedWhite = 0;
    board.set(moveKey, move);
    for (const next of neighbors(move, boardSize)) {
      const stone = board.get(keyOf(next));
      if (!stone || stone.color !== opposite(move.color)) continue;
      const group = collectString(next, board, boardSize);
      if (group.liberties.size) continue;
      for (const capturedKey of group.stones) {
        const captured = board.get(capturedKey);
        if (captured?.color === "black") moveCapturedBlack += 1;
        if (captured?.color === "white") moveCapturedWhite += 1;
        board.delete(capturedKey);
      }
    }
    const ownGroup = collectString(move, board, boardSize);
    const nextHash = boardHash(board);
    const repeatsPrevious = history.length >= 2 && nextHash === history[history.length - 2];
    if (!ownGroup.liberties.size || repeatsPrevious) {
      board.clear();
      before.forEach((stone, key) => board.set(key, stone));
      invalidMoves.push(move);
      continue;
    }
    capturedBlack += moveCapturedBlack;
    capturedWhite += moveCapturedWhite;
    history.push(nextHash);
  }

  return {
    capturedBlack,
    capturedWhite,
    invalidMoves,
    stones: [...board.values()].map((stone) => ({ ...stone, isLast: !stone.isSetup && stone.moveNumber === currentMoveNumber })),
  };
}

export function canPlayMove(moves, boardSize, currentMoveNumber, point, color = getNextColor(currentMoveNumber)) {
  const candidate = { ...point, color, moveNumber: currentMoveNumber + 1 };
  const result = buildBoardPosition([...moves, candidate], boardSize, currentMoveNumber + 1);
  return !result.invalidMoves.some((move) => move.moveNumber === candidate.moveNumber && move.x === point.x && move.y === point.y);
}
