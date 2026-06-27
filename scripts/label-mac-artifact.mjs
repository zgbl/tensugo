import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseInfo = JSON.parse(readFileSync(resolve(root, "dist", "release-version.json"), "utf8"));
const arch = process.arch === "arm64" ? "aarch64" : process.arch;
const sourceDmg = resolve(
  root,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "dmg",
  `TensuGo_${releaseInfo.internalVersion}_${arch}.dmg`
);
const displayDmg = resolve(
  root,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "dmg",
  `TensuGo_${releaseInfo.displayVersion}_${arch}.dmg`
);

if (!existsSync(sourceDmg)) {
  throw new Error(`Cannot find built DMG: ${sourceDmg}`);
}

copyFileSync(sourceDmg, displayDmg);
console.log(`TensuGo DMG labeled for testing: ${displayDmg}`);
