import type { ProblemItem } from "../research/types";

export type SolvableProblemType = "A" | "B";

export function problemTypeOf(problem: ProblemItem): SolvableProblemType {
  if (problem.problemType === "A" || problem.problemType === "B") return problem.problemType;
  return problem.candidateScores.length > 5 ? "A" : "B";
}
