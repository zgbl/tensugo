import { invoke } from "@tauri-apps/api/core";
import type { EngineAnalysisResult, EngineDiscoveryResult, EngineGeneratedMoveResult, EngineProbeResult, EngineProfile } from "./types";
import type { ReviewMove } from "../game/sampleGame";
import type { ProblemItem } from "../research/types";
import { platform } from "../platform";
import { inferHumanEngineLevel } from "./humanEngineLevels";

export const DEFAULT_ENGINE_PROFILE: EngineProfile = platform.defaultEngineProfile;

type TauriEngineProfile = {
  name: string;
  executable_path: string;
  model_path: string;
  config_path: string;
  human_model_path: string;
  human_config_path: string;
  engine_mode: "normal" | "human";
  command_line: string;
  exists: boolean;
  source?: string;
};

type TauriEngineDiscoveryResult = {
  platform: string;
  local_engine_supported: boolean;
  selected: TauriEngineProfile;
  candidates: TauriEngineProfile[];
  diagnostics: string;
};

type ChoosePathResult = {
  selected: boolean;
  path: string | null;
  error: string | null;
};

type ChooseFilesResult = {
  selected: boolean;
  paths: string[];
  error: string | null;
};

type ReadTextFileResult = {
  ok: boolean;
  content: string | null;
  error: string | null;
};

type ReadFileBytesResult = {
  ok: boolean;
  content: number[] | null;
  error: string | null;
};

type WriteTextFileResult = {
  ok: boolean;
  error: string | null;
};

type TauriCandidateMove = {
  rank: number;
  move_name: string;
  visits: number;
  winrate: number;
  score_lead: number;
  pv: string[];
};

type TauriAnalysisResult = {
  ok: boolean;
  status: string;
  candidates: TauriCandidateMove[];
  raw_output: string;
  diagnostics: string;
};

type TauriGeneratedMoveResult = {
  ok: boolean;
  status: string;
  move_name: string | null;
  diagnostics: string;
};

export function isTauriRuntime(): boolean {
  return platform.isTauriRuntime();
}

export async function getDefaultEngineProfile(): Promise<EngineProfile> {
  const profile = await invoke<TauriEngineProfile>("default_engine_profile");
  return fromTauriProfile(profile);
}

export async function discoverEngineProfile(profile?: EngineProfile | null): Promise<EngineDiscoveryResult> {
  const result = await invoke<TauriEngineDiscoveryResult>("discover_engine_profile", {
    profile: profile ? toTauriProfile(profile) : null
  });
  return {
    platform: result.platform,
    localEngineSupported: result.local_engine_supported,
    selected: fromTauriProfile(result.selected),
    candidates: result.candidates.map(fromTauriProfile),
    diagnostics: result.diagnostics
  };
}

export async function chooseEnginePath(kind: "engine" | "model" | "config"): Promise<ChoosePathResult> {
  return invoke<ChoosePathResult>("choose_engine_path", { request: { kind } });
}

export async function chooseGameRecordFiles(): Promise<ChooseFilesResult> {
  return invoke<ChooseFilesResult>("choose_game_record_files");
}

export async function chooseOutputDirectory(): Promise<ChoosePathResult> {
  return invoke<ChoosePathResult>("choose_output_directory");
}

export async function readTextFile(path: string): Promise<string> {
  const result = /\.gib$/i.test(path)
    ? await invoke<ReadFileBytesResult>("read_file_bytes", { path })
    : await invoke<ReadTextFileResult>("read_text_file", { path });
  if (!result.ok || result.content === null) {
    throw new Error(result.error ?? "读取文件失败");
  }
  if (Array.isArray(result.content)) {
    return new TextDecoder("gb18030").decode(new Uint8Array(result.content));
  }
  return result.content;
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  const result = await invoke<WriteTextFileResult>("write_text_file", {
    request: { path, content }
  });
  if (!result.ok) {
    throw new Error(result.error ?? "写入文件失败");
  }
}

export async function saveProblemToDatabase(payload: unknown): Promise<void> {
  const result = await invoke<{ ok: boolean; error: string | null }>("save_problem_to_database", {
    payload: JSON.stringify(payload)
  });
  if (!result.ok) {
    throw new Error(result.error ?? "保存题目失败");
  }
}

export async function recordProblemAnswer(input: {
  problemId: string;
  moveName: string;
  score: number;
  problemType: "A" | "B";
}): Promise<void> {
  await invoke("record_problem_answer", {
    problemId: input.problemId,
    moveName: input.moveName,
    score: input.score,
    problemType: input.problemType
  });
}

export async function recordProblemTag(problemId: string, tag: string): Promise<void> {
  await invoke("record_problem_tag", { problemId, tag });
}

export async function beginBatchKeepAwake(): Promise<string> {
  return invoke<string>("begin_batch_keep_awake");
}

export async function endBatchKeepAwake(): Promise<void> {
  await invoke("end_batch_keep_awake");
}

export type ProblemDuplicateMatch = {
  found: boolean;
  id: string | null;
  sourceFileName: string | null;
  moveNumber: number | null;
};

export async function findProblemByPositionHash(positionHash: string): Promise<ProblemDuplicateMatch> {
  const result = await invoke<{
    found: boolean;
    id: string | null;
    source_file_name: string | null;
    move_number: number | null;
  }>("find_problem_by_position_hash", { positionHash });
  return {
    found: result.found,
    id: result.id,
    sourceFileName: result.source_file_name,
    moveNumber: result.move_number
  };
}

export type ProblemLibraryItem = {
  id: string;
  sourceFileName: string;
  moveNumber: number;
  boardSize: number;
  color: "black" | "white";
  updatedAt: string;
  payload: ProblemItem & {
    source?: {
      fileName?: string;
      boardSize?: number;
      komi?: number;
      rules?: string;
      movesBeforeProblem?: ReviewMove[];
    };
  };
};

export async function listProblemLibrary(): Promise<ProblemLibraryItem[]> {
  return invoke<ProblemLibraryItem[]>("list_problem_library");
}

export async function probeEngine(profile: EngineProfile): Promise<EngineProbeResult> {
  return invoke<EngineProbeResult>("probe_engine", { profile: toTauriProfile(profile) });
}

export async function analyzePosition(params: {
  boardSize: number;
  komi: number;
  maxVisits: number;
  moves: ReviewMove[];
  nextColor: "black" | "white";
  profile: EngineProfile;
}): Promise<EngineAnalysisResult> {
  const result = await invoke<TauriAnalysisResult>("analyze_position", {
    request: {
      profile: toTauriProfile(params.profile),
      board_size: params.boardSize,
      komi: params.komi,
      moves: params.moves.map((move) => ({
        color: move.color,
        x: move.x,
        y: move.y
      })),
      next_color: params.nextColor,
      max_visits: params.maxVisits
    }
  });

  return {
    ok: result.ok,
    status: result.status,
    candidates: result.candidates.map((candidate) => ({
      rank: candidate.rank,
      moveName: candidate.move_name,
      visits: candidate.visits,
      winrate: candidate.winrate,
      scoreLead: candidate.score_lead,
      pv: candidate.pv
    })),
    rawOutput: result.raw_output,
    diagnostics: result.diagnostics
  };
}

export async function analyzeProblemPosition(params: {
  boardSize: number;
  komi: number;
  maxVisits: number;
  moves: ReviewMove[];
  nextColor: "black" | "white";
  profile: EngineProfile;
}): Promise<EngineAnalysisResult> {
  const result = await invoke<TauriAnalysisResult>("analyze_problem_position", {
    request: {
      profile: toTauriProfile(params.profile), board_size: params.boardSize, komi: params.komi,
      moves: params.moves.map((move) => ({ color: move.color, x: move.x, y: move.y })),
      next_color: params.nextColor, max_visits: params.maxVisits
    }
  });
  return {
    ok: result.ok, status: result.status,
    candidates: result.candidates.map((candidate) => ({ rank: candidate.rank, moveName: candidate.move_name, visits: candidate.visits, winrate: candidate.winrate, scoreLead: candidate.score_lead, pv: candidate.pv })),
    rawOutput: result.raw_output, diagnostics: result.diagnostics
  };
}

export async function generateMove(params: {
  boardSize: number;
  komi: number;
  maxTimeSeconds: number;
  maxVisits: number;
  moves: ReviewMove[];
  nextColor: "black" | "white";
  profile: EngineProfile;
  searchLimit: "time" | "visits";
  engineSlot?: "black" | "white";
}): Promise<EngineGeneratedMoveResult> {
  const result = await invoke<TauriGeneratedMoveResult>("generate_move", {
    request: {
      profile: toTauriProfile(params.profile),
      board_size: params.boardSize,
      komi: params.komi,
      max_time_seconds: params.maxTimeSeconds,
      max_visits: params.maxVisits,
      moves: params.moves.map((move) => ({ color: move.color, x: move.pass ? -1 : move.x, y: move.pass ? -1 : move.y })),
      next_color: params.nextColor,
      search_limit: params.searchLimit
      ,engine_slot: params.engineSlot
    }
  });
  return {
    ok: result.ok,
    status: result.status,
    moveName: result.move_name,
    diagnostics: result.diagnostics
  };
}

export async function cancelGenerateMove(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("cancel_generate_move");
}

export async function analyzePositionContinuous(params: {
  boardSize: number;
  komi: number;
  moves: ReviewMove[];
  nextColor: "black" | "white";
  profile: EngineProfile;
}): Promise<EngineAnalysisResult> {
  const result = await invoke<TauriAnalysisResult>("analyze_position_continuous", {
    request: {
      profile: toTauriProfile(params.profile),
      board_size: params.boardSize,
      komi: params.komi,
      moves: params.moves.map((move) => ({
        color: move.color,
        x: move.x,
        y: move.y
      })),
      next_color: params.nextColor,
      max_visits: 0
    }
  });

  return {
    ok: result.ok,
    status: result.status,
    candidates: result.candidates.map((candidate) => ({
      rank: candidate.rank,
      moveName: candidate.move_name,
      visits: candidate.visits,
      winrate: candidate.winrate,
      scoreLead: candidate.score_lead,
      pv: candidate.pv
    })),
    rawOutput: result.raw_output,
    diagnostics: result.diagnostics
  };
}

export async function stopContinuousAnalysis(): Promise<void> {
  await invoke("stop_continuous_analysis");
}

function fromTauriProfile(profile: TauriEngineProfile): EngineProfile {
  return {
    name: profile.name,
    executablePath: profile.executable_path,
    modelPath: profile.model_path,
    configPath: profile.config_path,
    humanModelPath: profile.human_model_path ?? "",
    humanConfigPath: profile.human_config_path ?? "",
    engineMode: profile.engine_mode === "human" ? "human" : "normal",
    humanLevel: inferHumanEngineLevel(profile.human_config_path),
    commandLine: profile.command_line,
    exists: profile.exists,
    source: profile.source
  };
}

function toTauriProfile(profile: EngineProfile): Omit<TauriEngineProfile, "exists"> {
  return {
    name: profile.name,
    executable_path: profile.executablePath,
    model_path: profile.modelPath,
    config_path: profile.configPath,
    human_model_path: profile.humanModelPath ?? "",
    human_config_path: profile.humanConfigPath ?? "",
    engine_mode: profile.engineMode ?? "normal",
    command_line: profile.commandLine
  };
}
