import type { StoneColor } from "../game/gameTree";
import type { EngineMode, EngineProfile, HumanEngineLevel } from "../engine/types";

export type PlayMode = "human-vs-engine" | "engine-vs-engine";

export type HumanPlaySettings = {
  handicap: number;
  humanColor: StoneColor;
  komi: number;
  maxTimeSeconds: number;
  maxVisits: number;
  searchLimit: "time" | "visits";
  playMode?: PlayMode;
  humanOpponentEngineMode?: EngineMode;
  humanOpponentLevel?: HumanEngineLevel;
  blackProfileId?: string;
  whiteProfileId?: string;
  blackEngineMode?: EngineMode;
  whiteEngineMode?: EngineMode;
  blackHumanLevel?: HumanEngineLevel;
  whiteHumanLevel?: HumanEngineLevel;
};

export type HumanPlaySession = HumanPlaySettings & {
  blackProfile: EngineProfile;
  whiteProfile: EngineProfile;
  consecutivePasses: number;
  id: string;
  result?: string;
  status: "playing" | "finished" | "error";
};
