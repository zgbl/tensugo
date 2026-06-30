import type { EngineCandidateMove } from "../engine/types";
import { buildBoardPosition } from "../game/boardRules";
import { createNodeId, type GameNode, type GameTree } from "../game/gameTree";
import type { ReviewMove, ReviewStone } from "../game/sampleGame";
import { appDisplayVersion } from "../version";
import type {
  AiAnalysisBlock,
  BoardBlock,
  BoardMarker,
  CandidateMovesBlock,
  CurrentGameSnapshot,
  GameProgressBlock,
  ParagraphBlock,
  ResearchBlock,
  ResearchDocument,
  VariationBlock
} from "./types";

const BRG_VERSION = "0.1" as const;
const TSG_CREATED_BY = appDisplayVersion();

export function createResearchDocument(snapshot: CurrentGameSnapshot): ResearchDocument {
  const now = new Date().toISOString();
  return {
    brgVersion: BRG_VERSION,
    id: createId("doc"),
    title: fileStem(snapshot.sourceFileName) || "未命名棋评",
    author: "",
    createdAt: now,
    updatedAt: now,
    sourceGame: {
      fileName: snapshot.sourceFileName,
      boardSize: snapshot.boardSize,
      komi: snapshot.komi,
      rules: snapshot.rules,
      players: {
        black: snapshot.blackName,
        white: snapshot.whiteName
      },
      gameDate: snapshot.gameDate,
      result: snapshot.result,
      totalMoves: snapshot.totalMoves
    },
    tags: [],
    mainSgf: "",
    assets: [],
    sections: [
      {
        id: createId("sec"),
        title: "正文",
        blocks: []
      }
    ]
  };
}

export function makeSnapshot(input: Omit<CurrentGameSnapshot, "stones"> & { stones?: ReviewStone[] }): CurrentGameSnapshot {
  return {
    ...input,
    stones: input.stones ?? buildBoardPosition(input.moves, input.boardSize, input.currentMoveNumber).stones
  };
}

export function appendBlock(document: ResearchDocument, block: ResearchBlock): ResearchDocument {
  const now = new Date().toISOString();
  const sections = document.sections.length > 0 ? document.sections : [{ id: createId("sec"), title: "正文", blocks: [] }];
  return {
    ...document,
    updatedAt: now,
    sections: sections.map((section, index) =>
      index === 0 ? { ...section, blocks: [...section.blocks, block] } : section
    )
  };
}

export function removeBlock(document: ResearchDocument, blockId: string): ResearchDocument {
  return {
    ...document,
    updatedAt: new Date().toISOString(),
    sections: document.sections.map((section) => ({
      ...section,
      blocks: section.blocks.filter((block) => block.id !== blockId)
    }))
  };
}

export function replaceBlock(document: ResearchDocument, blockId: string, nextBlock: ResearchBlock): ResearchDocument {
  return updateBlock(document, blockId, (block) => ({
    ...nextBlock,
    id: block.id,
    createdAt: block.createdAt,
    updatedAt: new Date().toISOString()
  }));
}

export function moveBlock(document: ResearchDocument, blockId: string, targetBlockId: string): ResearchDocument {
  if (blockId === targetBlockId) {
    return document;
  }
  const sections = document.sections.length > 0 ? document.sections : [{ id: createId("sec"), title: "正文", blocks: [] }];
  let movedBlock: ResearchBlock | null = null;
  const withoutMoved = sections.map((section) => {
    const nextBlocks = section.blocks.filter((block) => {
      if (block.id === blockId) {
        movedBlock = block;
        return false;
      }
      return true;
    });
    return { ...section, blocks: nextBlocks };
  });
  if (!movedBlock) {
    return document;
  }
  const blockToMove = movedBlock;
  let inserted = false;
  const nextSections = withoutMoved.map((section) => {
    const targetIndex = section.blocks.findIndex((block) => block.id === targetBlockId);
    if (targetIndex < 0) {
      return section;
    }
    inserted = true;
    return {
      ...section,
      blocks: [
        ...section.blocks.slice(0, targetIndex),
        blockToMove,
        ...section.blocks.slice(targetIndex)
      ]
    };
  });
  if (!inserted) {
    return document;
  }
  return {
    ...document,
    updatedAt: new Date().toISOString(),
    sections: nextSections
  };
}

export function updateBlockMarkdown(document: ResearchDocument, blockId: string, markdown: string): ResearchDocument {
  return updateBlock(document, blockId, (block) => {
    if (block.type !== "paragraph" && block.type !== "conclusion") {
      return block;
    }
    return { ...block, markdown, updatedAt: new Date().toISOString() };
  });
}

export function updateDocumentSource(document: ResearchDocument, snapshot: CurrentGameSnapshot): ResearchDocument {
  return {
    ...document,
    updatedAt: new Date().toISOString(),
    sourceGame: {
      ...document.sourceGame,
      fileName: snapshot.sourceFileName,
      boardSize: snapshot.boardSize,
      komi: snapshot.komi,
      rules: snapshot.rules,
      players: {
        black: snapshot.blackName,
        white: snapshot.whiteName
      },
      gameDate: snapshot.gameDate,
      result: snapshot.result,
      totalMoves: snapshot.totalMoves
    }
  };
}

export function createParagraphBlock(markdown = ""): ParagraphBlock {
  const now = new Date().toISOString();
  return {
    id: createId("blk"),
    type: "paragraph",
    markdown,
    createdAt: now,
    updatedAt: now
  };
}

export function createBoardBlock(snapshot: CurrentGameSnapshot): BoardBlock {
  const now = new Date().toISOString();
  return {
    id: createId("blk"),
    type: "board",
    moveNumber: snapshot.currentMoveNumber,
    boardSize: snapshot.boardSize,
    position: snapshot.stones,
    showCoordinates: true,
    showLastMove: true,
    markers: [],
    arrows: [],
    caption: `第 ${snapshot.currentMoveNumber} 手局面`,
    createdAt: now,
    updatedAt: now
  };
}

export function createGameProgressBlock(
  moves: ReviewMove[],
  boardSize: number,
  startMoveNumber: number,
  endMoveNumber: number
): GameProgressBlock | null {
  if (moves.length === 0) {
    return null;
  }
  const start = clampMoveNumber(startMoveNumber, 1, moves.length);
  const end = clampMoveNumber(endMoveNumber, start, moves.length);
  const sequence = moves.slice(start - 1, end).map((move) => reviewMoveToGtpPoint(move, boardSize));
  if (sequence.length === 0) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: createId("blk"),
    type: "game_progress",
    startMoveNumber: start,
    endMoveNumber: end,
    boardSize,
    position: buildBoardPosition(moves, boardSize, end).stones,
    sequence,
    caption: `原棋谱进展：第 ${start}-${end} 手`,
    showCoordinates: true,
    createdAt: now,
    updatedAt: now
  };
}

export function createVariationBlock(snapshot: CurrentGameSnapshot, candidate: EngineCandidateMove | null): VariationBlock | null {
  const sequence = candidate?.pv?.length ? candidate.pv : [];
  if (sequence.length === 0) {
    return null;
  }
  const moves = sequenceToReviewMoves(sequence, snapshot.boardSize, snapshot.currentMoveNumber);
  const position = buildBoardPosition([...snapshot.moves.slice(0, snapshot.currentMoveNumber), ...moves], snapshot.boardSize, snapshot.currentMoveNumber + moves.length).stones;
  return createVariationBlockFromMoves(snapshot.currentMoveNumber, snapshot.boardSize, position, sequence, `PV 变化：${sequence[0]}`);
}

export function createManualVariationBlock(
  baseMoveNumber: number,
  boardSize: number,
  position: ReviewStone[],
  sequence: string[]
): VariationBlock {
  return createVariationBlockFromMoves(baseMoveNumber, boardSize, position, sequence, `手动变化：${sequence[0] ?? "未命名"}`);
}

export function createAiAnalysisBlock(
  candidateMoves: EngineCandidateMove[],
  engineName: string,
  modelName?: string
): AiAnalysisBlock | null {
  const best = candidateMoves[0];
  if (!best) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: createId("blk"),
    type: "ai_analysis",
    engineName,
    modelName,
    visits: best.visits,
    winrate: best.winrate,
    scoreLead: best.scoreLead,
    pv: best.pv,
    candidateMoves,
    timestamp: now,
    createdAt: now,
    updatedAt: now
  };
}

export function createCandidateMovesBlock(moveNumber: number, candidates: EngineCandidateMove[]): CandidateMovesBlock | null {
  if (candidates.length === 0) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: createId("blk"),
    type: "candidate_moves",
    moveNumber,
    candidates,
    createdAt: now,
    updatedAt: now
  };
}

export function validateResearchDocument(value: unknown): ResearchDocument {
  if (!value || typeof value !== "object") {
    throw new Error("不是有效的 TSG 研究文件。");
  }
  return migrateResearchFile(value as Record<string, unknown>);
}

export function migrateResearchFile(record: Record<string, unknown>): ResearchDocument {
  if (record.format === "TSG" && record.version === 1) {
    return fromTsgDocument(record);
  }
  if (record.format === "brg" && record.version === "1.0") {
    return fromBrgDocument(record);
  }
  if (record.brgVersion === BRG_VERSION && Array.isArray(record.sections)) {
    return record as ResearchDocument;
  }
  throw new Error("不支持的研究文档格式。");
}

export function toBrgDocument(document: ResearchDocument, gameTree?: GameTree) {
  return toTsgDocument(document, gameTree);
}

export function toTsgDocument(document: ResearchDocument, gameTree?: GameTree) {
  const blocks = document.sections.flatMap((section) => section.blocks).map(toBrgBlock).filter(Boolean);
  const compactGameTree = serializeGameTree(gameTree ?? document.gameTree);
  return {
    format: "TSG",
    version: 1,
    createdBy: TSG_CREATED_BY,
    tensugo: {
      gameTree: compactGameTree,
      ...(document.analysis ? { analysis: document.analysis } : {})
    },
    meta: {
      title: document.title,
      author: document.author,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      tags: document.tags
    },
    source: {
      type: inferSourceFormat(document.sourceGame.fileName),
      fileName: document.sourceGame.fileName,
      content: document.mainSgf ?? ""
    },
    gameInfo: {
      boardSize: document.sourceGame.boardSize,
      rules: document.sourceGame.rules,
      komi: document.sourceGame.komi,
      players: {
        black: { name: document.sourceGame.players.black },
        white: { name: document.sourceGame.players.white }
      },
      result: document.sourceGame.result
    },
    blocks
  };
}

function fromTsgDocument(record: Record<string, unknown>): ResearchDocument {
  return fromBrgDocument(record);
}

function createVariationBlockFromMoves(
  baseMoveNumber: number,
  boardSize: number,
  position: ReviewStone[],
  sequence: string[],
  name: string
): VariationBlock {
  const now = new Date().toISOString();
  return {
    id: createId("blk"),
    type: "variation",
    fromMoveNumber: baseMoveNumber,
    name,
    caption: `第 ${baseMoveNumber} 手后的变化`,
    description: "",
    sequence,
    boardSize,
    position,
    compact: false,
    interactive: true,
    showPv: true,
    createdAt: now,
    updatedAt: now
  };
}

function updateBlock(document: ResearchDocument, blockId: string, updater: (block: ResearchBlock) => ResearchBlock): ResearchDocument {
  return {
    ...document,
    updatedAt: new Date().toISOString(),
    sections: document.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => (block.id === blockId ? updater(block) : block))
    }))
  };
}

function toBrgBlock(block: ResearchBlock) {
  if (block.type === "heading") {
    return { type: "heading", level: block.level, text: block.text };
  }
  if (block.type === "paragraph" || block.type === "conclusion") {
    return { type: "paragraph", title: block.title, markdown: block.markdown };
  }
  if (block.type === "board") {
    return {
      type: "board",
      moveNumber: block.moveNumber,
      caption: block.caption,
      showCoordinates: block.showCoordinates,
      showLastMove: block.showLastMove,
      marks: block.markers.map(toBrgMarker)
    };
  }
  if (block.type === "game_progress") {
    return {
      type: "game_progress",
      startMoveNumber: block.startMoveNumber,
      endMoveNumber: block.endMoveNumber,
      boardSize: block.boardSize,
      position: block.position,
      sequence: block.sequence,
      caption: block.caption,
      showCoordinates: block.showCoordinates
    };
  }
  if (block.type === "variation") {
    return {
      type: "variation",
      caption: block.caption,
      baseMoveNumber: block.fromMoveNumber,
      firstMoveLabel: 1,
      moves: block.sequence.map((point, index) => ({
        color: moveColorAt(block.fromMoveNumber + index + 1),
        pos: gtpPointToTuple(point, block.boardSize)
      })).filter((move) => move.pos !== null)
    };
  }
  if (block.type === "ai_analysis") {
    return {
      type: "ai_analysis",
      engineName: block.engineName,
      modelName: block.modelName,
      visits: block.visits,
      winrate: block.winrate,
      scoreLead: block.scoreLead,
      policy: block.policy,
      pv: block.pv,
      candidateMoves: block.candidateMoves,
      ownershipMap: block.ownershipMap,
      timestamp: block.timestamp
    };
  }
  if (block.type === "candidate_moves") {
    return {
      type: "candidate_moves",
      moveNumber: block.moveNumber,
      candidates: block.candidates,
      note: block.note
    };
  }
  return null;
}

function fromBrgDocument(record: Record<string, unknown>): ResearchDocument {
  const meta = asRecord(record.meta);
  const source = asRecord(record.source);
  const gameInfo = asRecord(record.gameInfo);
  const players = asRecord(gameInfo.players);
  const black = asRecord(players.black);
  const white = asRecord(players.white);
  const now = new Date().toISOString();
  const document: ResearchDocument = {
    brgVersion: BRG_VERSION,
    id: createId("doc"),
    title: stringValue(meta.title, "未命名棋评"),
    author: stringValue(meta.author, ""),
    createdAt: stringValue(meta.createdAt, now),
    updatedAt: stringValue(meta.updatedAt, now),
    sourceGame: {
      fileName: stringValue(source.fileName, "未命名棋谱"),
      boardSize: numberValue(gameInfo.boardSize, 19),
      komi: numberValue(gameInfo.komi, 7.5),
      rules: stringValue(gameInfo.rules, "中国"),
      players: {
        black: stringValue(black.name, "黑棋"),
        white: stringValue(white.name, "白棋")
      },
      result: typeof gameInfo.result === "string" ? gameInfo.result : undefined,
      totalMoves: 0
    },
    tags: Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === "string") : [],
    mainSgf: stringValue(source.content, ""),
    gameTree: parseGameTreeExtension(record),
    analysis: parseAnalysisExtension(record),
    assets: [],
    sections: [{ id: createId("sec"), title: "正文", blocks: [] }]
  };
  const blocks = Array.isArray(record.blocks) ? record.blocks : [];
  document.sections[0].blocks = blocks.map((block) => fromBrgBlock(block, document.sourceGame.boardSize)).filter(Boolean) as ResearchBlock[];
  return document;
}

function fromBrgBlock(value: unknown, boardSize: number): ResearchBlock | null {
  const block = asRecord(value);
  const now = new Date().toISOString();
  const type = block.type;
  if (type === "heading") {
    return {
      id: stringValue(block.id, createId("blk")),
      type: "heading",
      level: numberValue(block.level, 1) as 1 | 2 | 3,
      text: stringValue(block.text, ""),
      createdAt: now,
      updatedAt: now
    };
  }
  if (type === "paragraph") {
    return {
      id: stringValue(block.id, createId("blk")),
      type: "paragraph",
      title: typeof block.title === "string" ? block.title : undefined,
      markdown: stringValue(block.markdown, ""),
      createdAt: now,
      updatedAt: now
    };
  }
  if (type === "board") {
    return {
      id: stringValue(block.id, createId("blk")),
      type: "board",
      moveNumber: numberValue(block.moveNumber, 0),
      boardSize,
      position: [],
      showCoordinates: block.showCoordinates !== false,
      showLastMove: block.showLastMove !== false,
      markers: [],
      arrows: [],
      caption: typeof block.caption === "string" ? block.caption : undefined,
      createdAt: now,
      updatedAt: now
    };
  }
  if (type === "game_progress") {
    return {
      id: stringValue(block.id, createId("blk")),
      type: "game_progress",
      startMoveNumber: numberValue(block.startMoveNumber, 1),
      endMoveNumber: numberValue(block.endMoveNumber, 1),
      boardSize: numberValue(block.boardSize, boardSize),
      position: parseStones(block.position),
      sequence: parseStringArray(block.sequence),
      caption: stringValue(block.caption, "原棋谱进展"),
      showCoordinates: block.showCoordinates !== false,
      createdAt: now,
      updatedAt: now
    };
  }
  if (type === "variation") {
    const moves = Array.isArray(block.moves) ? block.moves : [];
    const sequence = moves.map((move) => tupleToGtpPoint(asRecord(move).pos, boardSize)).filter(Boolean) as string[];
    const baseMoveNumber = numberValue(block.baseMoveNumber, 0);
    const variationMoves = sequenceToReviewMoves(sequence, boardSize, baseMoveNumber);
    return createVariationBlockFromMoves(
      baseMoveNumber,
      boardSize,
      buildBoardPosition(variationMoves, boardSize, variationMoves.length).stones,
      sequence,
      stringValue(block.caption, "变化")
    );
  }
  if (type === "ai_analysis") {
    return {
      id: stringValue(block.id, createId("blk")),
      type: "ai_analysis",
      engineName: stringValue(block.engineName, ""),
      modelName: typeof block.modelName === "string" ? block.modelName : undefined,
      visits: numberValue(block.visits, 0),
      winrate: numberValue(block.winrate, 0),
      scoreLead: numberValue(block.scoreLead, 0),
      policy: typeof block.policy === "number" ? block.policy : undefined,
      pv: parseStringArray(block.pv),
      candidateMoves: parseCandidateMoves(block.candidateMoves),
      ownershipMap: typeof block.ownershipMap === "object" && Array.isArray(block.ownershipMap) ? block.ownershipMap.filter((n): n is number => typeof n === "number") : undefined,
      timestamp: stringValue(block.timestamp, now),
      createdAt: now,
      updatedAt: now
    };
  }
  if (type === "candidate_moves") {
    return {
      id: stringValue(block.id, createId("blk")),
      type: "candidate_moves",
      moveNumber: numberValue(block.moveNumber, 0),
      candidates: parseCandidateMoves(block.candidates),
      note: typeof block.note === "string" ? block.note : undefined,
      createdAt: now,
      updatedAt: now
    };
  }
  return null;
}

function sequenceToReviewMoves(sequence: string[], boardSize: number, baseMoveNumber: number): ReviewMove[] {
  return sequence.map((point, index) => {
    const parsed = gtpPointToTuple(point, boardSize) ?? [0, 0];
    return {
      moveNumber: baseMoveNumber + index + 1,
      color: moveColorAt(baseMoveNumber + index + 1) === "B" ? "black" : "white",
      x: parsed[0],
      y: parsed[1]
    };
  });
}

function moveColorAt(moveNumber: number): "B" | "W" {
  return moveNumber % 2 === 1 ? "B" : "W";
}

function toBrgMarker(marker: BoardMarker) {
  return {
    id: marker.id,
    type: marker.shape === "number" ? "label" : marker.shape,
    pos: [marker.x, marker.y],
    text: marker.text
  };
}

function gtpPointToTuple(point: string, boardSize: number): [number, number] | null {
  if (!point || point.toLowerCase() === "pass") {
    return null;
  }
  const match = /^([A-HJ-Z])(\d+)$/i.exec(point);
  if (!match) {
    return null;
  }
  const labels = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  const x = labels.indexOf(match[1].toUpperCase());
  const row = Number(match[2]);
  const y = boardSize - row;
  return x >= 0 && x < boardSize && y >= 0 && y < boardSize ? [x, y] : null;
}

function tupleToGtpPoint(value: unknown, boardSize: number): string | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  const x = Number(value[0]);
  const y = Number(value[1]);
  const labels = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
    return null;
  }
  return `${labels[x]}${boardSize - y}`;
}

function reviewMoveToGtpPoint(move: ReviewMove, boardSize: number): string {
  const labels = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
  return `${labels[move.x] ?? "A"}${boardSize - move.y}`;
}

function clampMoveNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function inferSourceFormat(fileName: string): "sgf" | "gib" {
  return fileName.toLowerCase().endsWith(".gib") ? "gib" : "sgf";
}

function parseGameTreeExtension(record: Record<string, unknown>): GameTree | undefined {
  const tensugo = asRecord(record.tensugo);
  const candidate = tensugo.gameTree ?? record.gameTree;
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }
  return hydrateGameTree(candidate);
}

type CompactGameTree = {
  boardSize: number;
  komi: number;
  root: CompactGameNode;
};

type CompactGameNode = {
  move?: GameNode["move"];
  children: CompactGameNode[];
};

function serializeGameTree(tree: GameTree | undefined): CompactGameTree | undefined {
  if (!tree) {
    return undefined;
  }
  return {
    boardSize: tree.boardSize,
    komi: tree.komi,
    root: serializeGameNode(tree.root)
  };
}

function serializeGameNode(node: GameNode): CompactGameNode {
  const serialized: CompactGameNode = {
    children: node.children.map(serializeGameNode)
  };
  if (node.move) {
    serialized.move = {
      color: node.move.color,
      point: node.move.point
        ? {
            col: node.move.point.col,
            row: node.move.point.row
          }
        : null
    };
  }
  return serialized;
}

function hydrateGameTree(value: unknown): GameTree | undefined {
  const record = asRecord(value);
  const root = asRecord(record.root);
  if (!record.root || !Array.isArray(root.children)) {
    return undefined;
  }
  return {
    boardSize: numberValue(record.boardSize, 19),
    komi: numberValue(record.komi, 7.5),
    root: hydrateGameNode(root, true)
  };
}

function hydrateGameNode(value: unknown, isRoot = false): GameNode {
  const record = asRecord(value);
  const move = asRecord(record.move);
  const point = asRecord(move.point);
  const hasMove = move.color === "black" || move.color === "white";
  const node: GameNode = {
    id: stringValue(record.id, isRoot ? "root" : createNodeId()),
    children: Array.isArray(record.children) ? record.children.map((child) => hydrateGameNode(child)) : []
  };
  if (hasMove) {
    node.move = {
      color: move.color === "white" ? "white" : "black",
      point:
        move.point === null
          ? null
          : {
              col: numberValue(point.col, 0),
              row: numberValue(point.row, 0)
            }
    };
  }
  if (typeof record.comment === "string") {
    node.comment = record.comment;
  }
  return node;
}

function parseAnalysisExtension(record: Record<string, unknown>): ResearchDocument["analysis"] {
  const tensugo = asRecord(record.tensugo);
  const candidate = tensugo.analysis ?? record.analysis;
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }
  return candidate as ResearchDocument["analysis"];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string") : [];
}

function parseStones(value: unknown): ReviewStone[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((stone) => {
      const record = asRecord(stone);
      const color = record.color === "white" ? "white" : record.color === "black" ? "black" : null;
      if (!color) {
        return null;
      }
      return {
        color,
        isLast: record.isLast === true,
        moveNumber: numberValue(record.moveNumber, 0),
        x: numberValue(record.x, 0),
        y: numberValue(record.y, 0)
      };
    })
    .filter((stone): stone is ReviewStone => stone !== null);
}

function parseCandidateMoves(value: unknown): EngineCandidateMove[] {
  if (!Array.isArray(value)) return [];
  return value.map(fromEngineCandidateMove).filter((m): m is EngineCandidateMove => m !== null);
}

function fromEngineCandidateMove(value: unknown): EngineCandidateMove | null {
  const move = asRecord(value);
  if (!move.moveName) return null;
  return {
    rank: numberValue(move.rank, 0),
    moveName: stringValue(move.moveName, ""),
    visits: numberValue(move.visits, 0),
    winrate: numberValue(move.winrate, 0),
    scoreLead: numberValue(move.scoreLead, 0),
    pv: parseStringArray(move.pv)
  };
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
