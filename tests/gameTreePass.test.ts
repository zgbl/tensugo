import assert from "node:assert/strict";
import test from "node:test";

import {
  appendMoveToGameTree,
  createEmptyGameTree,
  mainLineMovesFromTree,
  moveNodeIdsToNode,
  pathMovesToNode
} from "../src/game/gameTree.ts";

test("pass moves remain part of the official move sequence", () => {
  const empty = createEmptyGameTree();
  const blackPass = appendMoveToGameTree(empty, "root", {
    color: "black",
    point: null
  });
  const whiteMove = appendMoveToGameTree(blackPass.tree, blackPass.nodeId, {
    color: "white",
    point: { col: 3, row: 3 }
  });

  assert.deepEqual(moveNodeIdsToNode(whiteMove.tree, whiteMove.nodeId), [
    blackPass.nodeId,
    whiteMove.nodeId
  ]);
  assert.deepEqual(pathMovesToNode(whiteMove.tree, whiteMove.nodeId), [
    { color: "black", moveNumber: 1, pass: true, x: -1, y: -1 },
    { color: "white", moveNumber: 2, pass: false, x: 3, y: 3 }
  ]);
  assert.deepEqual(mainLineMovesFromTree(whiteMove.tree), [
    { color: "black", moveNumber: 1, pass: true, x: -1, y: -1 },
    { color: "white", moveNumber: 2, pass: false, x: 3, y: 3 }
  ]);
});
