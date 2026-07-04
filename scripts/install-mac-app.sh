#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_SRC="$ROOT_DIR/src-tauri/target/release/bundle/macos/TensuGo.app"
APP_DST="/Applications/TensuGo.app"

export PATH="/Users/tuxy/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$ROOT_DIR"

echo "==> Bumping patch version"
npm run version:bump

echo "==> Building frontend"
npm run build

echo "==> Clearing stale Tauri release build cache"
npm run tauri:clean-cache

echo "==> Building Tauri app bundle"
npm run tauri -- build

if [[ ! -d "$APP_SRC" ]]; then
  echo "!! Missing app bundle: $APP_SRC" >&2
  exit 1
fi

echo "==> Replacing installed app"
rm -rf "$APP_DST"
ditto "$APP_SRC" "$APP_DST"

echo "==> Installed app"
ls -l "$APP_DST"
echo -n "CFBundleShortVersionString: "
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_DST/Contents/Info.plist"
echo -n "CFBundleVersion: "
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_DST/Contents/Info.plist"
