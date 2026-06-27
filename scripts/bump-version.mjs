import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = resolve(root, "package.json");
const packageLockPath = resolve(root, "package-lock.json");
const tauriConfigPath = resolve(root, "src-tauri", "tauri.conf.json");
const cargoTomlPath = resolve(root, "src-tauri", "Cargo.toml");
const releaseInfoPath = resolve(root, "dist", "release-version.json");

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const currentVersion = packageJson.version;
const nextVersion = bumpPatch(currentVersion);
const displayVersion = toPaddedDisplayVersion(nextVersion);

packageJson.version = nextVersion;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
packageLock.version = nextVersion;
if (packageLock.packages?.[""]) {
  packageLock.packages[""].version = nextVersion;
}
writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);

const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
tauriConfig.version = nextVersion;
writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoToml = readFileSync(cargoTomlPath, "utf8");
writeFileSync(
  cargoTomlPath,
  cargoToml.replace(/^version = ".*"$/m, `version = "${nextVersion}"`)
);

console.log(`TensuGo version bumped: ${currentVersion} -> ${nextVersion}`);
console.log(`TensuGo display package version: ${displayVersion}`);

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  return `${major}.${minor}.${patch + 1}`;
}

function toPaddedDisplayVersion(version) {
  const [major, minor, patch] = version.split(".");
  return `${major}.${minor}.${patch.padStart(2, "0")}`;
}

mkdirSync(dirname(releaseInfoPath), { recursive: true });
writeFileSync(
  releaseInfoPath,
  `${JSON.stringify({ internalVersion: nextVersion, displayVersion }, null, 2)}\n`
);
