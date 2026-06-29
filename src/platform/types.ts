import type { EngineProfile } from "../engine/types";

export type ClientPlatform = "macos" | "windows" | "ios" | "android" | "desktop" | "unknown";

export type PlatformAdapter = {
  kind: ClientPlatform;
  localEngineSupported: boolean;
  defaultEngineProfile: EngineProfile;
  isTauriRuntime: () => boolean;
};
