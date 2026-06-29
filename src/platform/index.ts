import { macPlatform } from "./mac";
import { iosPlatform, androidPlatform } from "./mobile";
import type { ClientPlatform, PlatformAdapter } from "./types";
import { windowsPlatform } from "./windows";

const desktopPlatform: PlatformAdapter = {
  kind: "desktop",
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

export function getClientPlatform(): ClientPlatform {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent) || (platform === "macintel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/android/.test(userAgent)) {
    return "android";
  }
  if (platform.includes("mac")) {
    return "macos";
  }
  if (platform.includes("win")) {
    return "windows";
  }
  if (platform.includes("linux")) {
    return "desktop";
  }
  return "unknown";
}

export function getPlatformAdapter(): PlatformAdapter {
  const platform = getClientPlatform();
  if (platform === "macos") {
    return macPlatform;
  }
  if (platform === "windows") {
    return windowsPlatform;
  }
  if (platform === "ios") {
    return iosPlatform;
  }
  if (platform === "android") {
    return androidPlatform;
  }
  return desktopPlatform;
}

export const platform = getPlatformAdapter();

export type { ClientPlatform, PlatformAdapter } from "./types";
