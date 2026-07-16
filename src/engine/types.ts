export type EngineStatus = "not-configured" | "ready" | "running" | "error";
export type EngineMode = "normal" | "human";
export type HumanEngineLevel = "20k" | "15k" | "10k" | "9k" | "8k" | "7k" | "6k" | "5k" | "4k" | "3k" | "2k" | "1k" | "1d" | "2d" | "3d" | "4d" | "5d" | "6d" | "7d" | "8d" | "9d";

export type EngineDiagnostic = {
  level: "info" | "warning" | "error";
  message: string;
};

export type EngineProfile = {
  profileId?: string;
  name: string;
  executablePath: string;
  modelPath: string;
  configPath: string;
  humanModelPath?: string;
  humanConfigPath?: string;
  engineMode?: EngineMode;
  humanLevel?: HumanEngineLevel;
  commandLine: string;
  exists: boolean;
  source?: string;
};

export type EngineProbeResult = {
  ok: boolean;
  summary: string;
  diagnostics: string;
};

export type EngineDiscoveryResult = {
  platform: string;
  localEngineSupported: boolean;
  selected: EngineProfile;
  candidates: EngineProfile[];
  diagnostics: string;
};

export type EngineCandidateMove = {
  rank: number;
  moveName: string;
  visits: number;
  winrate: number;
  scoreLead: number;
  pv: string[];
};

export type EngineAnalysisResult = {
  ok: boolean;
  status: string;
  candidates: EngineCandidateMove[];
  rawOutput: string;
  diagnostics: string;
};

export type EngineGeneratedMoveResult = {
  ok: boolean;
  status: string;
  moveName: string | null;
  diagnostics: string;
};

export type ReviewAnalysisPoint = {
  moveNumber: number;
  scoreLead: number;
  visits: number;
  winrate: number;
};
