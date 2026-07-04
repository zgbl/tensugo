import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = path.join(rootDir, "src-tauri", "target");
const releaseBuildDir = path.join(targetDir, "release", "build");
const oldProjectPath = "/Users/tuxy/Codes/KataGo/TensuGo";

const staleArtifactPaths = [
  path.join(targetDir, "release", "bundle", "macos", "TensuGo.app"),
  path.join(targetDir, "release", "bundle", "dmg")
];

if (await containsText(releaseBuildDir, oldProjectPath)) {
  await rm(releaseBuildDir, { force: true, recursive: true });
  console.log("Cleared stale Tauri release build cache with old project path.");
} else {
  console.log("Tauri release build cache does not contain old project path; keeping incremental cache.");
}

for (const stalePath of staleArtifactPaths) {
  await rm(stalePath, { force: true, recursive: true });
}

console.log("Cleared stale Tauri app bundle artifacts.");

async function containsText(dir, needle) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (await containsText(fullPath, needle)) {
        return true;
      }
      continue;
    }
    if (!entry.isFile() || entry.size > 1024 * 1024) {
      continue;
    }
    try {
      if ((await readFile(fullPath, "utf8")).includes(needle)) {
        return true;
      }
    } catch {
      // Ignore binary or unreadable cache files.
    }
  }
  return false;
}
