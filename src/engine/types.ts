export type EngineStatus = "not-configured" | "ready" | "running" | "error";

export type EngineDiagnostic = {
  level: "info" | "warning" | "error";
  message: string;
};

export type EngineProfile = {
  name: string;
  executablePath: string;
  modelPath: string;
  configPath: string;
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

export type ReviewAnalysisPoint = {
  moveNumber: number;
  scoreLead: number;
  visits: number;
  winrate: number;
};
