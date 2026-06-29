import type { PlatformAdapter } from "./types";

export const macPlatform: PlatformAdapter = {
  kind: "macos",
  localEngineSupported: true,
  defaultEngineProfile: {
    name: "KataGo",
    executablePath: "",
    modelPath: "",
    configPath: "",
    commandLine: "",
    exists: false,
    source: "未配置"
  },
  isTauriRuntime: () => "__TAURI_INTERNALS__" in window
};
