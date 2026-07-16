import type { EngineProfile } from "./types";

export type EngineProfileListChange = {
  index: number;
  profile: EngineProfile;
  profiles: EngineProfile[];
};

export function appendEngineProfile(
  profiles: EngineProfile[],
  draft: EngineProfile,
  profileId: string
): EngineProfileListChange {
  const profile = { ...draft, profileId, source: "用户配置" };
  return {
    index: profiles.length,
    profile,
    profiles: [...profiles, profile]
  };
}

export function replaceEngineProfile(
  profiles: EngineProfile[],
  profileIndex: number,
  draft: EngineProfile
): EngineProfileListChange | null {
  const selected = profiles[profileIndex];
  if (!selected) {
    return null;
  }
  const profile = {
    ...draft,
    profileId: selected.profileId,
    source: "用户配置"
  };
  const nextProfiles = [...profiles];
  nextProfiles[profileIndex] = profile;
  return { index: profileIndex, profile, profiles: nextProfiles };
}
