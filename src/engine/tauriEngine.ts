import { invoke } from "@tauri-apps/api/core";
import type { EngineAnalysisResult, EngineDiscoveryResult, EngineProbeResult, EngineProfile } from "./types";
import type { ReviewMove } from "../game/sampleGame";
import { platform } from "../platform";

export const DEFAULT_ENGINE_PROFILE: EngineProfile = platform.defaultEngineProfile;

type TauriEngineProfile = {
  name: string;
  executable_path: string;
  model_path: string;
  config_path: string;
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
    command_line: profile.commandLine
  };
}
