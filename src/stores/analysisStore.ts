export type AnalysisStatus = "idle" | "starting" | "running" | "stopped" | "error";

export type CandidateMove = {
  move: string;
  visits: number;
  winrate: number;
  scoreLead: number;
  pv: string[];
};

export type AnalysisSnapshot = {
  status: AnalysisStatus;
  candidates: CandidateMove[];
};

export const emptyAnalysisSnapshot: AnalysisSnapshot = {
  status: "idle",
  candidates: []
};

