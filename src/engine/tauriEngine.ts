import { invoke } from "@tauri-apps/api/core";
import type { EngineAnalysisResult, EngineProbeResult, EngineProfile } from "./types";
import type { ReviewMove } from "../game/sampleGame";

export const DEFAULT_ENGINE_PROFILE: EngineProfile = {
  name: "本机 KataGo OpenCL",
  executablePath: "/opt/homebrew/bin/katago",
  modelPath: "/opt/homebrew/share/katago/g170e-b20c256x2-s5303129600-d1228401921.bin.gz",
  configPath: "/Users/tuxy/App/KataGo/Config/winConfigs/default_gtp.cfg",
  commandLine:
    '/opt/homebrew/bin/katago gtp -model "/opt/homebrew/share/katago/g170e-b20c256x2-s5303129600-d1228401921.bin.gz" -config "/Users/tuxy/App/KataGo/Config/winConfigs/default_gtp.cfg"',
  exists: true
};

type TauriEngineProfile = {
  name: string;
  executable_path: string;
  model_path: string;
  config_path: string;
  command_line: string;
  exists: boolean;
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
  return "__TAURI_INTERNALS__" in window;
}

export async function getDefaultEngineProfile(): Promise<EngineProfile> {
  const profile = await invoke<TauriEngineProfile>("default_engine_profile");
  return fromTauriProfile(profile);
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

function fromTauriProfile(profile: TauriEngineProfile): EngineProfile {
  return {
    name: profile.name,
    executablePath: profile.executable_path,
    modelPath: profile.model_path,
    configPath: profile.config_path,
    commandLine: profile.command_line,
    exists: profile.exists
  };
}

function toTauriProfile(profile: EngineProfile): Omit<TauriEngineProfile, "command_line" | "exists"> {
  return {
    name: profile.name,
    executable_path: profile.executablePath,
    model_path: profile.modelPath,
    config_path: profile.configPath
  };
}
