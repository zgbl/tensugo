import {
  createGameTreeFromMoves,
  createNodeId,
  mainLineMovesFromTree,
  type GameNode,
  type GameTree,
  type StoneColor
} from "../game/gameTree";
import type { ReviewMove } from "../game/sampleGame";

export type ParsedSgf = {
  boardSize: number;
  komi: number;
  blackName: string;
  whiteName: string;
  gameDate?: string;
  result?: string;
  rules: string;
  gameTree: GameTree;
  moves: ReviewMove[];
  warnings: string[];
};

type SgfPropertyMap = Map<string, string[]>;

const SGF_LETTERS = "abcdefghijklmnopqrstuvwxyz";

export function parseGameRecord(source: string, fallbackName = "未命名棋谱"): ParsedSgf {
  if (isGibRecord(source, fallbackName)) {
    return parseGib(source, fallbackName);
  }
  return parseSgf(source, fallbackName);
}

function parseValues(raw: string): string[] {
  const values: string[] = [];
  let index = 0;

  while (index < raw.length) {
    if (raw[index] !== "[") {
      index += 1;
      continue;
    }

    index += 1;
    let value = "";
    while (index < raw.length) {
      const char = raw[index];
      if (char === "\\") {
        index += 1;
        if (index < raw.length) {
          value += raw[index];
        }
      } else if (char === "]") {
        break;
      } else {
        value += char;
      }
      index += 1;
    }
    values.push(value);
    index += 1;
  }

  return values;
}

function parseNode(node: string): SgfPropertyMap {
  const props: SgfPropertyMap = new Map();
  const propPattern = /([A-Za-z]+)((?:\[(?:\\.|[^\]])*\])+)/g;

  for (const match of node.matchAll(propPattern)) {
    props.set(match[1], parseValues(match[2]));
  }

  return props;
}

function mainLineNodes(source: string): string[] {
  const firstTree = source.indexOf("(");
  if (firstTree < 0) {
    return [];
  }

  const [nodes] = parseMainLineTree(source, firstTree);
  return nodes;
}

function parseMainLineTree(source: string, startIndex: number): [string[], number] {
  const nodes: string[] = [];
  let index = startIndex + 1;

  while (index < source.length) {
    index = skipWhitespace(source, index);
    if (source[index] !== ";") {
      break;
    }
    const [node, nextIndex] = readSgfNode(source, index + 1);
    nodes.push(node);
    index = nextIndex;
  }

  index = skipWhitespace(source, index);
  let firstChildNodes: string[] | null = null;
  while (source[index] === "(") {
    const [childNodes, nextIndex] = parseMainLineTree(source, index);
    if (firstChildNodes === null) {
      firstChildNodes = childNodes;
    }
    index = skipWhitespace(source, nextIndex);
  }

  if (source[index] === ")") {
    index += 1;
  }

  return [firstChildNodes ? [...nodes, ...firstChildNodes] : nodes, index];
}

function readSgfNode(source: string, startIndex: number): [string, number] {
  let index = startIndex;
  let inValue = false;

  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "[") {
      inValue = true;
      index += 1;
      continue;
    }
    if (char === "]") {
      inValue = false;
      index += 1;
      continue;
    }
    if (!inValue && (char === ";" || char === "(" || char === ")")) {
      break;
    }
    index += 1;
  }

  return [source.slice(startIndex, index), index];
}

function skipWhitespace(source: string, startIndex: number): number {
  let index = startIndex;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }
  return index;
}

function sgfPointToMovePoint(value: string, boardSize: number) {
  if (value.length === 0) {
    return null;
  }

  if (value.length < 2) {
    return undefined;
  }

  const x = SGF_LETTERS.indexOf(value[0]);
  const y = SGF_LETTERS.indexOf(value[1]);

  if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) {
    return undefined;
  }

  return { col: x, row: y };
}

function firstProperty(nodes: string[], key: string, fallback: string): string {
  for (const node of nodes) {
    const value = parseNode(node).get(key)?.[0]?.trim();
    if (value) {
      return value;
    }
  }

  return fallback;
}

export function parseSgf(source: string, fallbackName = "未命名棋谱"): ParsedSgf {
  const nodes = mainLineNodes(source);
  const warnings: string[] = [];
  const boardSize = Number.parseInt(firstProperty(nodes, "SZ", "19"), 10) || 19;
  const komi = Number.parseFloat(firstProperty(nodes, "KM", "7.5"));
  const blackName = firstProperty(nodes, "PB", "黑棋");
  const whiteName = firstProperty(nodes, "PW", "白棋");
  const gameDate = firstProperty(nodes, "DT", "");
  const result = firstProperty(nodes, "RE", "");
  const rules = firstProperty(nodes, "RU", "未知");
  const treeKomi = Number.isFinite(komi) ? komi : 7.5;
  const gameTree = parseSgfGameTree(source, boardSize, treeKomi, warnings);
  const moves: ReviewMove[] = gameTree ? mainLineMovesFromTree(gameTree) : [];

  if (moves.length === 0) {
    for (const node of nodes.slice(1)) {
    const props = parseNode(node);
    const moveColor: StoneColor | undefined = props.has("B") ? "black" : props.has("W") ? "white" : undefined;

    if (!moveColor) {
      continue;
    }

    const value = props.get(moveColor === "black" ? "B" : "W")?.[0] ?? "";
    const point = sgfPointToMovePoint(value, boardSize);

    if (point === null) {
      warnings.push(`第 ${moves.length + 1} 手是 pass，暂未显示在棋盘上。`);
      continue;
    }

    if (!point) {
      warnings.push(`第 ${moves.length + 1} 手坐标无法解析: ${value || "(empty)"}`);
      continue;
    }

    moves.push({
      moveNumber: moves.length + 1,
      color: moveColor,
      x: point.col,
      y: point.row
    });
    }
  }

  if (nodes.length === 0) {
    warnings.push(`${fallbackName} 没有识别到 SGF 节点。`);
  }

  return {
    boardSize,
    komi: Number.isFinite(komi) ? komi : 7.5,
    blackName,
    whiteName,
    gameDate: gameDate || undefined,
    result: result || undefined,
    rules,
    gameTree,
    moves,
    warnings
  };
}

function parseSgfGameTree(source: string, boardSize: number, komi: number, warnings: string[]): GameTree {
  const root: GameNode = { id: "root", children: [] };
  const firstTree = source.indexOf("(");
  if (firstTree < 0) {
    return { boardSize, komi, root };
  }

  const [, nextIndex] = parseSgfSubtree(source, firstTree, root, boardSize, warnings);
  if (nextIndex <= firstTree) {
    warnings.push("SGF 分支树解析未能前进，已退回主线解析。");
  }
  return { boardSize, komi, root };
}

function parseSgfSubtree(
  source: string,
  startIndex: number,
  parent: GameNode,
  boardSize: number,
  warnings: string[]
): [GameNode, number] {
  let index = skipWhitespace(source, startIndex);
  if (source[index] !== "(") {
    return [parent, index];
  }
  index += 1;
  let current = parent;

  while (index < source.length) {
    index = skipWhitespace(source, index);
    if (source[index] !== ";") {
      break;
    }

    const [rawNode, nextIndex] = readSgfNode(source, index + 1);
    const props = parseNode(rawNode);
    const moveColor: StoneColor | undefined = props.has("B") ? "black" : props.has("W") ? "white" : undefined;
    if (moveColor) {
      const value = props.get(moveColor === "black" ? "B" : "W")?.[0] ?? "";
      const point = sgfPointToMovePoint(value, boardSize);
      const node: GameNode = {
        id: createNodeId(),
        move: {
          color: moveColor,
          point: point === undefined ? null : point
        },
        comment: props.get("C")?.[0],
        children: []
      };
      if (point === undefined) {
        warnings.push(`SGF 坐标无法解析: ${value || "(empty)"}`);
      }
      current.children.push(node);
      current = node;
    } else {
      current.comment = props.get("C")?.[0] ?? current.comment;
    }
    index = nextIndex;
  }

  index = skipWhitespace(source, index);
  while (source[index] === "(") {
    const [, nextIndex] = parseSgfSubtree(source, index, current, boardSize, warnings);
    index = skipWhitespace(source, nextIndex);
  }

  if (source[index] === ")") {
    index += 1;
  }
  return [current, index];
}

function isGibRecord(source: string, fallbackName: string): boolean {
  return /\.gib$/i.test(fallbackName) || /\\HS|\\GS|^\s*STO\s+\d+\s+\d+\s+[12]\s+\d+\s+\d+/m.test(source);
}

function parseGib(source: string, fallbackName = "未命名棋谱"): ParsedSgf {
  const props = parseGibProperties(source);
  const warnings: string[] = [];
  const gameInfoMain = props.get("GAMEINFOMAIN") ?? "";
  const boardSize = parseGibNumber(props.get("GAMEDUM")) || parseInfoNumber(gameInfoMain, "LINE") || 19;
  const rawKomi = parseGibNumber(props.get("GAMEGONGJE"));
  const komi = normalizeGibKomi(rawKomi);
  const blackName = props.get("GAMEBLACKNAME") || props.get("GAMEBLACKNICK") || "黑棋";
  const whiteName = props.get("GAMEWHITENAME") || props.get("GAMEWHITENICK") || "白棋";
  const gameDate = props.get("GAMEDATE") || props.get("GAMESTARTTIME") || props.get("GAMEINFODATE") || undefined;
  const result = parseGibResult(props);
  const moves: ReviewMove[] = [];
  const movePattern = /^\s*STO\s+\d+\s+(\d+)\s+([12])\s+(\d+)\s+(\d+)/gm;

  for (const match of source.matchAll(movePattern)) {
    const moveNumber = Number(match[1]);
    const colorCode = match[2];
    const x = Number(match[3]);
    const y = Number(match[4]);

    if (!Number.isInteger(moveNumber) || !Number.isInteger(x) || !Number.isInteger(y)) {
      warnings.push(`GIB 落子行无法解析: ${match[0].trim()}`);
      continue;
    }
    if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) {
      warnings.push(`GIB 第 ${moveNumber} 手坐标越界: ${x},${y}`);
      continue;
    }

    moves.push({
      moveNumber: moves.length + 1,
      color: colorCode === "1" ? "black" : "white",
      x,
      y
    });
  }

  if (moves.length === 0) {
    warnings.push(`${fallbackName} 没有识别到 GIB 落子。`);
  }
  if (!rawKomi || rawKomi <= 0) {
    warnings.push("GIB 未记录有效贴目，暂按 6.5 处理。");
  } else if (komi !== rawKomi) {
    warnings.push(`GIB 贴目 ${rawKomi} 已按十分位解析为 ${komi.toFixed(1)}。`);
  }

  return {
    boardSize,
    komi,
    blackName: cleanGibText(blackName),
    whiteName: cleanGibText(whiteName),
    gameDate: gameDate ? cleanGibText(gameDate) : undefined,
    result,
    rules: "弈城",
    gameTree: createGameTreeFromMoves(moves, boardSize, komi),
    moves,
    warnings
  };
}

function parseGibProperties(source: string): Map<string, string> {
  const props = new Map<string, string>();
  const propPattern = /\\?\[([^=\]]+)=([\s\S]*?)\\?\]/g;
  for (const match of source.matchAll(propPattern)) {
    props.set(match[1].trim(), match[2].replace(/\\$/, "").trim());
  }
  return props;
}

function parseGibNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGibResult(props: Map<string, string>): string | undefined {
  const direct = cleanGibText(props.get("GAMERESULT") ?? "");
  if (direct) {
    return direct;
  }
  const zipsu = cleanGibText(props.get("GAMEZIPSU") ?? "");
  if (zipsu) {
    return zipsu;
  }
  const info = cleanGibText(props.get("GAMEINFOMAIN") ?? "");
  const resultMatch = /(?:^|,)(?:RESULT|GAMERESULT|GAMEZIPSU):([^,]+)/i.exec(info);
  return resultMatch ? cleanGibText(resultMatch[1]) : undefined;
}

function normalizeGibKomi(value: number | null): number {
  if (!value || value <= 0) {
    return 6.5;
  }
  if (Number.isInteger(value) && value >= 10 && value <= 95) {
    return value / 10;
  }
  return value;
}

function parseInfoNumber(source: string, key: string): number | null {
  const match = new RegExp(`(?:^|,)${key}:(\\d+(?:\\.\\d+)?)`).exec(source);
  return match ? parseGibNumber(match[1]) : null;
}

function cleanGibText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
