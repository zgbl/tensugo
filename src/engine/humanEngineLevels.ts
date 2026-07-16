import type { EngineProfile, HumanEngineLevel } from "./types";

export const HUMAN_ENGINE_LEVELS: HumanEngineLevel[] = ["9d", "8d", "7d", "6d", "5d", "4d", "3d", "2d", "1d", "1k", "2k", "3k", "4k", "5k", "6k", "7k", "8k", "9k", "10k", "15k", "20k"];

export function inferHumanEngineLevel(configPath: string | undefined): HumanEngineLevel {
  const match = /gtp_human(9d|8d|7d|6d|5d|4d|3d|2d|1d|1k|2k|3k|4k|5k|6k|7k|8k|9k|10k|15k|20k)_search_example\.cfg$/i.exec(configPath ?? "");
  return (match?.[1]?.toLowerCase() as HumanEngineLevel | undefined) ?? "9d";
}

export function humanConfigPathForLevel(configPath: string | undefined, level: HumanEngineLevel): string {
  const current = configPath?.trim() ?? "";
  if (!current) {
    return `gtp_human${level}_search_example.cfg`;
  }
  if (/gtp_human(?:9d|8d|7d|6d|5d|4d|3d|2d|1d|1k|2k|3k|4k|5k|6k|7k|8k|9k|10k|15k|20k)_search_example\.cfg$/i.test(current)) {
    return current.replace(/gtp_human(?:9d|8d|7d|6d|5d|4d|3d|2d|1d|1k|2k|3k|4k|5k|6k|7k|8k|9k|10k|15k|20k)_search_example\.cfg$/i, `gtp_human${level}_search_example.cfg`);
  }
  const separator = current.includes("\\") ? "\\" : "/";
  const lastSeparator = Math.max(current.lastIndexOf("/"), current.lastIndexOf("\\"));
  const directory = lastSeparator >= 0 ? current.slice(0, lastSeparator) : ".";
  return `${directory}${separator}gtp_human${level}_search_example.cfg`;
}

export function profileWithHumanLevel(profile: EngineProfile, level: HumanEngineLevel): EngineProfile {
  return {
    ...profile,
    humanConfigPath: humanConfigPathForLevel(profile.humanConfigPath, level),
    humanLevel: level,
    source: "用户配置"
  };
}
