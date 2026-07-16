import { canPlayMove } from "../game/boardRules";
import { appendMoveToGameTree, type GameTree, type StoneColor } from "../game/gameTree";
import type { ReviewMove } from "../game/sampleGame";

export type HumanPlayPosition = {
  gameTree: GameTree;
  moves: ReviewMove[];
  pathNodeIds: string[];
  setupStones: ReviewMove[];
};

export type HumanPlayTurnResult =
  | { ok: true; position: HumanPlayPosition }
  | { ok: false; reason: "illegal-move" };

export function applyHumanPlayPoint(
  position: HumanPlayPosition,
  boardSize: number,
  color: StoneColor,
  point: { x: number; y: number }
): HumanPlayTurnResult {
  if (!canPlayMove(
    [...position.setupStones, ...position.moves],
    boardSize,
    position.moves.length,
    point,
    color
  )) {
    return { ok: false, reason: "illegal-move" };
  }

  const parentNodeId = position.pathNodeIds.at(-1) ?? "root";
  const appended = appendMoveToGameTree(position.gameTree, parentNodeId, {
    color,
    point: { col: point.x, row: point.y }
  });
  const move: ReviewMove = {
    color,
    moveNumber: position.moves.length + 1,
    x: point.x,
    y: point.y
  };
  return {
    ok: true,
    position: {
      ...position,
      gameTree: appended.tree,
      moves: [...position.moves, move],
      pathNodeIds: [...position.pathNodeIds, appended.nodeId]
    }
  };
}

export function applyHumanPlayPass(position: HumanPlayPosition, color: StoneColor): HumanPlayPosition {
  const parentNodeId = position.pathNodeIds.at(-1) ?? "root";
  const appended = appendMoveToGameTree(position.gameTree, parentNodeId, { color, point: null });
  return {
    ...position,
    gameTree: appended.tree,
    moves: [
      ...position.moves,
      { color, moveNumber: position.moves.length + 1, pass: true, x: -1, y: -1 }
    ],
    pathNodeIds: [...position.pathNodeIds, appended.nodeId]
  };
}
