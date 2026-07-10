import type { EngineCandidateMove } from "../engine/types";
import type { GameTree } from "../game/gameTree";
import type { ReviewMove, ReviewStone } from "../game/sampleGame";

export type ResearchAnalysisDetail = {
  actualMoveName?: string;
  color: "black" | "white";
  isCandidate?: boolean;
  isMatch?: boolean;
  isTopMove?: boolean;
  matchScore: number;
  moveNumber: number;
  rank: number | null;
  scoreLoss: number | null;
  winrate: number;
  winrateLoss: number | null;
};

export type ResearchAnalysisPoint = {
  moveNumber: number;
  scoreLead: number;
  visits: number;
  winrate: number;
};

export type ResearchAnalysisSnapshot = {
  analyzed: number;
  analyzedAt?: string;
  candidateMatches: number;
  details: ResearchAnalysisDetail[];
  endMove: number;
  engineName?: string;
  knownWinrateLosses?: number;
  knownScoreLosses: number;
  matches?: number;
  modelName?: string;
  points: ResearchAnalysisPoint[];
  startMove: number;
  topMatches: number;
  totalMatchScore: number;
  totalScoreLoss: number;
  totalWinrateLoss: number;
};

export type ResearchAnalysisCompletion = {
  version: 1;
  complete: boolean;
  completedAt: string;
  startMove: number;
  endMove: number;
  totalMoves: number;
  analyzedMoves: number;
  engineName?: string;
  modelName?: string;
  sourceFileName?: string;
};

export type ProblemCandidateScore = {
  moveName: string;
  rank: number;
  score: number;
  visits: number;
  winrate: number;
  scoreLead: number;
  pv: string[];
};

export type ProblemItem = {
  id: string;
  moveNumber: number;
  color: "black" | "white";
  actualMoveName?: string;
  trigger: {
    type: "winrateLoss";
    threshold: number;
    value: number;
  };
  prompt: string;
  fullScoreMove: string;
  candidateScores: ProblemCandidateScore[];
  analysis: {
    engineName?: string;
    modelName?: string;
    generatedAt: string;
    candidates: EngineCandidateMove[];
  };
};

export type ProblemSet = {
  version: 1;
  generatedAt: string;
  settings: {
    winrateLossThreshold: number;
    candidateLimit: number;
  };
  items: ProblemItem[];
};

export type ResearchBlockType =
  | "heading"
  | "paragraph"
  | "board"
  | "game_progress"
  | "variation"
  | "ai_analysis"
  | "candidate_moves"
  | "comparison"
  | "image"
  | "quote"
  | "conclusion";

export type BoardMarkerShape = "circle" | "triangle" | "square" | "number" | "label";

export type BoardMarker = {
  id: string;
  x: number;
  y: number;
  shape: BoardMarkerShape;
  text?: string;
  color?: string;
};

export type BoardArrow = {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
};

export type ResearchBlockBase<T extends ResearchBlockType> = {
  id: string;
  type: T;
  title?: string;
  createdAt: string;
  updatedAt: string;
};

export type HeadingBlock = ResearchBlockBase<"heading"> & {
  level: 1 | 2 | 3;
  text: string;
};

export type ParagraphBlock = ResearchBlockBase<"paragraph"> & {
  markdown: string;
};

export type BoardBlock = ResearchBlockBase<"board"> & {
  moveNumber: number;
  boardSize: number;
  position: ReviewStone[];
  showCoordinates: boolean;
  showLastMove: boolean;
  markers: BoardMarker[];
  arrows: BoardArrow[];
  caption?: string;
};

export type GameProgressBlock = ResearchBlockBase<"game_progress"> & {
  startMoveNumber: number;
  endMoveNumber: number;
  boardSize: number;
  position: ReviewStone[];
  sequence: string[];
  caption: string;
  showCoordinates: boolean;
};

export type VariationBlock = ResearchBlockBase<"variation"> & {
  fromMoveNumber: number;
  name: string;
  caption: string;
  description: string;
  sequence: string[];
  boardSize: number;
  position: ReviewStone[];
  compact: boolean;
  interactive: boolean;
  showPv: boolean;
};

export type AiAnalysisBlock = ResearchBlockBase<"ai_analysis"> & {
  engineName: string;
  modelName?: string;
  visits: number;
  winrate: number;
  scoreLead: number;
  policy?: number;
  pv: string[];
  candidateMoves: EngineCandidateMove[];
  ownershipMap?: number[];
  timestamp: string;
};

export type CandidateMovesBlock = ResearchBlockBase<"candidate_moves"> & {
  moveNumber: number;
  candidates: EngineCandidateMove[];
  note?: string;
};

export type ComparisonBranch = {
  id: string;
  label: string;
  firstMove: string;
  winrate?: number;
  scoreLead?: number;
  pv: string[];
  explanation: string;
};

export type ComparisonBlock = ResearchBlockBase<"comparison"> & {
  branches: ComparisonBranch[];
};

export type ImageBlock = ResearchBlockBase<"image"> & {
  assetId: string;
  alt: string;
  caption?: string;
};

export type QuoteBlock = ResearchBlockBase<"quote"> & {
  text: string;
  attribution?: string;
};

export type ConclusionBlock = ResearchBlockBase<"conclusion"> & {
  markdown: string;
};

export type ResearchBlock =
  | HeadingBlock
  | ParagraphBlock
  | BoardBlock
  | GameProgressBlock
  | VariationBlock
  | AiAnalysisBlock
  | CandidateMovesBlock
  | ComparisonBlock
  | ImageBlock
  | QuoteBlock
  | ConclusionBlock;

export type ResearchSection = {
  id: string;
  title: string;
  blocks: ResearchBlock[];
};

export type ResearchAsset = {
  id: string;
  type: "sgf" | "image" | "thumbnail" | "analysis" | "other";
  name: string;
  mimeType?: string;
  uri?: string;
  data?: string;
  sha256?: string;
};

export type ResearchDocument = {
  brgVersion: "0.1";
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  sourceGame: {
    fileName: string;
    boardSize: number;
    komi: number;
    rules: string;
    players: {
      black: string;
      white: string;
    };
    result?: string;
    gameDate?: string;
    totalMoves: number;
  };
  tags: string[];
  thumbnail?: string;
  mainSgf?: string;
  gameTree?: GameTree;
  analysis?: ResearchAnalysisSnapshot;
  analysisCompletion?: ResearchAnalysisCompletion;
  problemSet?: ProblemSet;
  assets: ResearchAsset[];
  sections: ResearchSection[];
};

export type CurrentGameSnapshot = {
  boardSize: number;
  komi: number;
  rules: string;
  blackName: string;
  whiteName: string;
  sourceFileName: string;
  gameDate?: string;
  result?: string;
  totalMoves: number;
  currentMoveNumber: number;
  stones: ReviewStone[];
  moves: ReviewMove[];
};
