import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const versionPath = resolve(root, "version.json");
const packagePath = resolve(root, "package.json");
const packageLockPath = resolve(root, "package-lock.json");
const tauriConfigPath = resolve(root, "src-tauri", "tauri.conf.json");
const cargoTomlPath = resolve(root, "src-tauri", "Cargo.toml");
const cargoLockPath = resolve(root, "src-tauri", "Cargo.lock");
const releaseInfoPath = resolve(root, "dist", "release-version.json");

const versionInfo = JSON.parse(readFileSync(versionPath, "utf8"));
const currentVersion = toSemver(versionInfo);
versionInfo.patch += 1;
const nextVersion = toSemver(versionInfo);
const displayVersion = toDisplayVersion(versionInfo);
writeFileSync(versionPath, `${JSON.stringify(versionInfo, null, 2)}\n`);

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
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

const cargoLock = readFileSync(cargoLockPath, "utf8");
writeFileSync(
  cargoLockPath,
  cargoLock.replace(/(\[\[package\]\]\nname = "tensugo"\nversion = ")[^"]+(")/m, `$1${nextVersion}$2`)
);

console.log(`TensuGo version bumped: ${currentVersion} -> ${nextVersion}`);
console.log(`TensuGo display version: ${displayVersion}`);

function toSemver(info) {
  if (!Number.isInteger(info.major) || !Number.isInteger(info.minor) || !Number.isInteger(info.patch)) {
    throw new Error("version.json must contain integer major, minor, and patch fields.");
  }
  return `${info.major}.${info.minor}.${info.patch}`;
}

function toDisplayVersion(info) {
  return `${info.name ?? "TensuGo"} ${toSemver(info)} ${info.stage ?? ""}`.trim();
}

mkdirSync(dirname(releaseInfoPath), { recursive: true });
writeFileSync(
  releaseInfoPath,
  `${JSON.stringify({ internalVersion: nextVersion, displayVersion, ...versionInfo }, null, 2)}\n`
);
