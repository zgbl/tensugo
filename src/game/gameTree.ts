import type { BoardPoint } from "./coordinates";
import type { ReviewMove } from "./sampleGame";

export type StoneColor = "black" | "white";

export type GameMove = {
  color: StoneColor;
  point: BoardPoint | null;
};

export type GameNode = {
  id: string;
  move?: GameMove;
  comment?: string;
  children: GameNode[];
};

export type GameTree = {
  root: GameNode;
  boardSize: number;
  komi: number;
};

export function createEmptyGameTree(boardSize = 19, komi = 7.5): GameTree {
  return {
    boardSize,
    komi,
    root: {
      id: "root",
      children: []
    }
  };
}

export type BranchTreeRow = {
  color: StoneColor;
  depth: number;
  isLeaf: boolean;
  isMainLine: boolean;
  label: string;
  moveNumber: number;
  nodeId: string;
  parentId: string;
  pathMoves: ReviewMove[];
};

let localTreeId = 0;

export function createNodeId(): string {
  localTreeId += 1;
  return `node_${localTreeId.toString(36)}`;
}

export function createGameTreeFromMoves(moves: ReviewMove[], boardSize = 19, komi = 7.5): GameTree {
  const tree = createEmptyGameTree(boardSize, komi);
  let current = tree.root;
  for (const move of moves) {
    const node: GameNode = {
      id: createNodeId(),
      move: {
        color: move.color,
        point: move.pass ? null : { col: move.x, row: move.y }
      },
      children: []
    };
    current.children.push(node);
    current = node;
  }
  return tree;
}

export function cloneGameTree(tree: GameTree): GameTree {
  return {
    boardSize: tree.boardSize,
    komi: tree.komi,
    root: cloneNode(tree.root)
  };
}

export function appendMoveToGameTree(tree: GameTree, parentNodeId: string, move: GameMove): { tree: GameTree; nodeId: string } {
  const nextTree = cloneGameTree(tree);
  const parent = findNode(nextTree.root, parentNodeId) ?? nextTree.root;
  const existingChild = findChildByMove(parent, move);
  if (existingChild) {
    return { tree: nextTree, nodeId: existingChild.id };
  }
  const nodeId = createNodeId();
  parent.children.push({
    id: nodeId,
    move,
    children: []
  });
  return { tree: nextTree, nodeId };
}

export function findChildNodeIdByMove(tree: GameTree, parentNodeId: string, move: GameMove): string | null {
  const parent = findNode(tree.root, parentNodeId) ?? tree.root;
  return findChildByMove(parent, move)?.id ?? null;
}

export function appendVariationAtMoveNumber(
  tree: GameTree,
  currentNodeId: string,
  currentMoveNumber: number,
  move: GameMove
): { tree: GameTree; nodeId: string } {
  const anchorNodeId = nodeIdAtMoveNumber(tree, currentNodeId, currentMoveNumber);
  return appendMoveToGameTree(tree, anchorNodeId, move);
}

export function findMainLineEndNodeId(tree: GameTree): string {
  let current = tree.root;
  while (current.children[0]) {
    current = current.children[0];
  }
  return current.id;
}

export function findPathNodeIds(tree: GameTree, nodeId: string): string[] | null {
  const path: string[] = [];
  if (!collectPathNodeIds(tree.root, nodeId, path)) {
    return null;
  }
  return path;
}

export function moveNodeIdsToNode(tree: GameTree, nodeId: string): string[] {
  return (findPathNodeIds(tree, nodeId) ?? [])
    .filter((pathNodeId) => pathNodeId !== tree.root.id)
    .filter((pathNodeId) => Boolean(findNode(tree.root, pathNodeId)?.move));
}

export function pathMovesWithMainContinuation(tree: GameTree, nodeId: string): { moves: ReviewMove[]; nodeIds: string[] } | null {
  const pathNodeIds = moveNodeIdsToNode(tree, nodeId);
  if (nodeId !== tree.root.id && pathNodeIds.length === 0) {
    return null;
  }

  const nodeIds = [...pathNodeIds];
  let current = findNode(tree.root, nodeId);
  while (current?.children[0]) {
    current = current.children[0];
    if (current.move) {
      nodeIds.push(current.id);
    }
  }

  const moves: ReviewMove[] = [];
  for (const pathNodeId of nodeIds) {
    const node = findNode(tree.root, pathNodeId);
    if (!node?.move) {
      continue;
    }
    moves.push(gameNodeToReviewMove(node, moves.length + 1));
  }

  return { moves, nodeIds };
}

export function childMoveCountAlongMainLine(tree: GameTree, nodeId: string): number {
  const node = findNode(tree.root, nodeId);
  if (!node) {
    return 0;
  }
  let count = 0;
  let current = node.children[0];
  while (current) {
    if (current.move) {
      count += 1;
    }
    current = current.children[0];
  }
  return count;
}

export function findParentNodeId(tree: GameTree, nodeId: string): string | null {
  return findParentNode(tree.root, nodeId)?.id ?? null;
}

export function findVariationAnchorNodeId(tree: GameTree, nodeId: string): string | null {
  const path = findPathNodeIds(tree, nodeId);
  if (!path || path.length <= 1) {
    return null;
  }

  for (let index = 0; index < path.length - 1; index += 1) {
    const parent = findNode(tree.root, path[index]);
    const childId = path[index + 1];
    const childIndex = parent?.children.findIndex((child) => child.id === childId) ?? -1;
    if (childIndex > 0) {
      return parent?.id ?? tree.root.id;
    }
  }

  return null;
}

export function pathMovesToNode(tree: GameTree, nodeId: string): ReviewMove[] | null {
  const path = findPathNodes(tree.root, nodeId);
  if (!path) {
    return null;
  }
  const moves: ReviewMove[] = [];
  for (const node of path) {
    if (!node.move) {
      continue;
    }
    moves.push(gameNodeToReviewMove(node, moves.length + 1));
  }
  return moves;
}

export function mainLineMovesFromTree(tree: GameTree): ReviewMove[] {
  const moves: ReviewMove[] = [];
  let current = tree.root.children[0];
  while (current) {
    if (current.move) {
      moves.push(gameNodeToReviewMove(current, moves.length + 1));
    }
    current = current.children[0];
  }
  return moves;
}

export function nodeIdAtMoveNumber(tree: GameTree, nodeId: string, moveNumber: number): string {
  const path = findPathNodes(tree.root, nodeId) ?? [];
  if (moveNumber <= 0) {
    return "root";
  }
  const moveNodes = path.filter((node) => node.move);
  return moveNodes[Math.min(moveNumber, moveNodes.length) - 1]?.id ?? nodeId;
}

export function flattenBranchTree(tree: GameTree, selectedNodeId: string): BranchTreeRow[] {
  const selectedPath = new Set(findPathNodeIds(tree, selectedNodeId) ?? ["root"]);
  const rows: BranchTreeRow[] = [];

  const visit = (node: GameNode, parentId: string, depth: number, pathMoves: ReviewMove[]) => {
    const nextPathMoves = node.move
      ? [
          ...pathMoves,
          gameNodeToReviewMove(node, pathMoves.length + 1)
        ]
      : pathMoves;

    if (node.move) {
      rows.push({
        color: node.move.color,
        depth,
        isLeaf: node.children.length === 0,
        isMainLine: depth === 0,
        label: node.move.point ? String(nextPathMoves.length) : `${nextPathMoves.length} 停`,
        moveNumber: nextPathMoves.length,
        nodeId: node.id,
        parentId,
        pathMoves: nextPathMoves
      });
    }

    for (const child of node.children.slice(1)) {
      const branchDepth = selectedPath.has(child.id) ? Math.max(1, depth + 1) : depth + 1;
      visit(child, node.id, branchDepth, nextPathMoves);
    }
    const mainChild = node.children[0];
    if (mainChild) {
      visit(mainChild, node.id, depth, nextPathMoves);
    }
  };

  for (const child of tree.root.children) {
    visit(child, tree.root.id, child === tree.root.children[0] ? 0 : 1, []);
  }

  return rows;
}

export function promoteNodeToMainLine(tree: GameTree, nodeId: string): GameTree {
  const path = findPathNodeIds(tree, nodeId);
  if (!path || path.length <= 1) {
    return tree;
  }

  const nextTree = cloneGameTree(tree);
  for (let index = 0; index < path.length - 1; index += 1) {
    const parent = findNode(nextTree.root, path[index]);
    if (!parent) {
      continue;
    }
    const childIndex = parent.children.findIndex((child) => child.id === path[index + 1]);
    if (childIndex > 0) {
      const [child] = parent.children.splice(childIndex, 1);
      parent.children.unshift(child);
    }
  }
  return nextTree;
}

export function deleteSubtreeFromGameTree(tree: GameTree, nodeId: string): { tree: GameTree; nextSelectedNodeId: string } {
  if (nodeId === tree.root.id) {
    return { tree, nextSelectedNodeId: tree.root.id };
  }

  const parentId = findParentNodeId(tree, nodeId) ?? tree.root.id;
  const nextTree = cloneGameTree(tree);
  const parent = findNode(nextTree.root, parentId);
  if (!parent) {
    return { tree, nextSelectedNodeId: tree.root.id };
  }
  parent.children = parent.children.filter((child) => child.id !== nodeId);
  return { tree: nextTree, nextSelectedNodeId: parent.id };
}

function cloneNode(node: GameNode): GameNode {
  return {
    id: node.id,
    move: node.move
      ? {
          color: node.move.color,
          point: node.move.point ? { ...node.move.point } : null
        }
      : undefined,
    comment: node.comment,
    children: node.children.map(cloneNode)
  };
}

function findNode(node: GameNode, nodeId: string): GameNode | null {
  if (node.id === nodeId) {
    return node;
  }
  for (const child of node.children) {
    const found = findNode(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

function findChildByMove(parent: GameNode, move: GameMove): GameNode | null {
  return parent.children.find((child) => isSameMove(child.move, move)) ?? null;
}

function isSameMove(left: GameMove | undefined, right: GameMove): boolean {
  if (!left || left.color !== right.color) {
    return false;
  }
  if (!left.point || !right.point) {
    return left.point === right.point;
  }
  return left.point.col === right.point.col && left.point.row === right.point.row;
}

function gameNodeToReviewMove(node: GameNode, moveNumber: number): ReviewMove {
  if (!node.move) {
    throw new Error("Cannot convert a node without a move");
  }
  return {
    color: node.move.color,
    moveNumber,
    x: node.move.point?.col ?? -1,
    y: node.move.point?.row ?? -1,
    pass: node.move.point === null
  };
}

function findParentNode(node: GameNode, nodeId: string): GameNode | null {
  for (const child of node.children) {
    if (child.id === nodeId) {
      return node;
    }
    const found = findParentNode(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

function findPathNodes(node: GameNode, nodeId: string): GameNode[] | null {
  if (node.id === nodeId) {
    return node.id === "root" ? [] : [node];
  }
  for (const child of node.children) {
    const path = findPathNodes(child, nodeId);
    if (path) {
      return node.id === "root" ? path : [node, ...path];
    }
  }
  return null;
}

function collectPathNodeIds(node: GameNode, nodeId: string, path: string[]): boolean {
  path.push(node.id);
  if (node.id === nodeId) {
    return true;
  }
  for (const child of node.children) {
    if (collectPathNodeIds(child, nodeId, path)) {
      return true;
    }
  }
  path.pop();
  return false;
}
