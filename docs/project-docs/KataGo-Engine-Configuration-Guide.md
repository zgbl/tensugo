# TensuGo Engine Configuration Guide

This guide explains how TensuGo should handle KataGo engine configuration for regular users, testers, and future release packaging.

The product goal is simple:

> Most users should not need to understand KataGo paths, model files, or config files.

Manual engine configuration should exist as a recovery path, not as the normal first-run experience.

## Recommended User Experience

For public releases, TensuGo should prefer this order:

1. Use a bundled KataGo engine, model, and GTP config shipped with the app.
2. If bundled resources are missing, auto-detect a local KataGo installation.
3. If auto-detect fails, show the Engine Settings page with clear status and repair actions.
4. Allow advanced users to manually choose engine, model, and config paths.

The first-run ideal is:

- User installs TensuGo.
- User opens an SGF/GIB/TSG file.
- User clicks `AI分析` or `自动分析`.
- TensuGo starts KataGo without asking for file paths.

## Engine Settings Page

Open:

```text
设置 -> 引擎
```

The settings page exposes:

- `Current Status`: current engine state or error.
- `Engine Path`: KataGo executable path.
- `Model Path`: neural network model file.
- `Config Path`: KataGo GTP config file.
- `Auto Detect`: search for a valid engine profile.
- `Choose Engine`: manually choose the KataGo executable.
- `Choose Model`: manually choose the model file.
- `Choose Config`: manually choose the GTP config file.
- `Test Engine`: verify that KataGo can start in GTP mode.
- `Reset to Default`: clear saved user config and re-run auto-detection.

## What Each File Means

### Engine Path

This is the KataGo executable.

Examples:

```text
/opt/homebrew/bin/katago
C:\Program Files\KataGo\katago.exe
```

### Model Path

This is the neural network model, usually a compressed file.

Examples:

```text
g170e-b20c256x2-s5303129600-d1228401921.bin.gz
kata1-b18c384nbt-s9996604416-d4316597426.bin.gz
```

### Config Path

This must be a KataGo **GTP config**.

Good examples:

```text
default_gtp.cfg
gtp.cfg
analysis_gtp.cfg
```

Bad examples:

```text
match_example.cfg
selfplay*.cfg
distributed*.cfg
```

The config must contain GTP-related keys such as:

```text
logAllGTPCommunication
```

If KataGo exits with this error:

```text
Could not find key 'logAllGTPCommunication'
```

then TensuGo is using the wrong config file. Choose a `default_gtp.cfg`-style config instead.

## Auto-Detection Strategy

TensuGo currently detects engine profiles in this order:

1. Saved user configuration.
2. Known compatible platform profiles.
3. Bundled engine resources.
4. Common platform install directories.
5. `PATH`.
6. Dev-only candidates.

Detection should only select a profile when all required files exist:

- engine executable
- model file
- GTP config file

It should also reject non-GTP config files even if they end in `.cfg`.

## Current macOS Known Profile

For the current development machine, the known working profile is:

```text
Engine Path:
/opt/homebrew/bin/katago

Model Path:
/opt/homebrew/share/katago/g170e-b20c256x2-s5303129600-d1228401921.bin.gz

Config Path:
/Users/tuxy/App/KataGo/Config/winConfigs/default_gtp.cfg
```

This profile is kept as a compatibility candidate so local development does not depend on fragile Homebrew config discovery.

## Bundled Release Layout

Future releases should package resources like this:

```text
src-tauri/resources/katago/
  katago                  # macOS/Linux executable
  katago.exe              # Windows executable
  configs/
    default_gtp.cfg
  models/
    model.bin.gz
```

The Tauri bundle configuration already reserves:

```json
"resources": [
  "resources/katago"
]
```

Large binaries and model files should not be committed to Git. They should be added by release scripts or local packaging workspaces.

## Release Recommendations

For a user-friendly release:

1. Bundle a tested KataGo executable for each target platform.
2. Bundle one stable model that is small enough for distribution but strong enough for review.
3. Bundle a known-good `default_gtp.cfg`.
4. Run `Test Engine` automatically on first launch or before first analysis.
5. If the bundled engine fails, show a short repair flow:
   - `Auto Detect`
   - `Choose Engine`
   - `Choose Model`
   - `Choose Config`
   - `Test Engine`

Avoid making first-time users choose three separate files unless auto-detection and bundled resources both fail.

## Platform Notes

### macOS

Common locations:

```text
/opt/homebrew/bin/katago
/opt/homebrew/share/katago/
/usr/local/bin/katago
/usr/local/share/katago/
```

Homebrew may include example configs that are not valid for TensuGo GTP analysis. Do not auto-select `match_example.cfg`.

### Windows

Expected future locations:

```text
C:\Program Files\KataGo\
C:\Users\<user>\AppData\Local\KataGo\
```

Windows builds should prefer bundled resources to avoid PATH and install-location confusion.

### iOS / Android

Local KataGo is currently unsupported. Mobile platform entries should return an unsupported status rather than pretending local analysis is available.

## Troubleshooting

### Test Engine fails with `logAllGTPCommunication`

The config file is not a GTP config. Choose `default_gtp.cfg`.

### `katago version` works but analysis fails

The executable exists, but model/config/GPU initialization may be broken. Run `Test Engine` because it starts real GTP mode with the selected model and config.

### OpenCL / GPU errors

Try another KataGo backend or config:

- CPU/Eigen build for debugging.
- Metal build on macOS if available.
- A newer KataGo release.

### First automatic analysis returns no candidates

Check:

- Engine path is not empty.
- Model path exists.
- Config path is a GTP config.
- `Test Engine` passes.
- The SGF/GIB has main-line moves.

## Verification Commands

For code changes involving engine discovery:

```bash
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

For runtime verification:

```text
设置 -> 引擎 -> Auto Detect
设置 -> 引擎 -> Test Engine
```

Then open an SGF/GIB and run:

```text
自动分析
```

