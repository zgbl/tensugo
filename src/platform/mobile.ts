import type { PlatformAdapter } from "./types";

export const iosPlatform: PlatformAdapter = {
  kind: "ios",
  localEngineSupported: false,
  defaultEngineProfile: {
    name: "移动端暂不支持本地 KataGo",
    executablePath: "",
    modelPath: "",
    configPath: "",
    commandLine: "",
    exists: false,
    source: "unsupported"
  },
  isTauriRuntime: () => "__TAURI_INTERNALS__" in window
};

export const androidPlatform: PlatformAdapter = {
  ...iosPlatform,
  kind: "android"
};
