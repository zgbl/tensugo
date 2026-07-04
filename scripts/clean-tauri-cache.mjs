import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = path.join(rootDir, "src-tauri", "target");

const stalePaths = [
  path.join(targetDir, "release", "build"),
  path.join(targetDir, "release", "bundle", "macos", "TensuGo.app"),
  path.join(targetDir, "release", "bundle", "dmg")
];

for (const stalePath of stalePaths) {
  await rm(stalePath, { force: true, recursive: true });
}

console.log("Cleared stale Tauri release build cache.");
