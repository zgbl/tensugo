# KataGo Engine Setup

## Product Rule

Automatic engine setup should cover 90%+ of normal local KataGo configurations. Advanced users must still have a manual configuration path for full command-line control.

Do not make "type the complete engine command by hand" the only or primary setup path.

## Recommended UX

Default setup flow:

1. Auto-search common locations for KataGo.
2. Let the user choose a `katago` executable if auto-search fails.
3. Scan the executable directory and nearby folders for model and config files.
4. Generate a candidate engine profile.
5. Probe/test the profile.
6. Show version, backend hints, model/config paths, and a human-readable status.
7. Save the profile when the test succeeds.

Advanced setup flow:

- User can edit the full command line.
- User can edit model/config paths.
- User can set default komi, board size, and future advanced parameters.
- User can bypass auto-discovery only after seeing the simple setup path.

## Discovery Targets

Search strategy should be platform-aware.

macOS likely locations:

- User-selected executable.
- Same directory as the selected executable.
- `~/Downloads`
- `/Applications`
- `/opt/homebrew/bin`
- `/usr/local/bin`
- Paths already saved in previous profiles.

Windows likely locations:

- User-selected executable.
- Same directory as the selected executable.
- `Downloads`
- `Desktop`
- `Program Files`
- `Program Files (x86)`
- PATH entries when accessible.
- Paths already saved in previous profiles.

## File Detection

Likely executable:

- `katago`
- `katago.exe`
- files whose names contain `katago`

Likely model:

- `.bin.gz`
- `.txt.gz`
- other KataGo model formats if added later

Likely config:

- `.cfg`
- filenames containing `analysis`, `gtp`, `opencl`, `cuda`, `cpu`, or `default`

When multiple choices exist, rank them but let the user choose.

## Probe Behavior

Probe should answer:

- Can the executable launch?
- Is this actually KataGo?
- What version/backend information can be read?
- Can the selected model/config be opened?
- Can a minimal analysis command run without crashing?

Probe failures must be converted into actionable messages:

- Executable not found.
- Permission denied or blocked by OS security.
- Model file not found.
- Config file not found.
- Backend/GPU initialization failed.
- Process started but exited early.
- Command timed out.

Keep raw stderr available in an expandable diagnostics area for advanced users.

## EngineProfile Shape

An engine profile should retain both simple and advanced information:

- Display name.
- Executable path.
- Model path if applicable.
- Config path if applicable.
- Generated command line.
- Manual command line override.
- Default komi.
- Default rules.
- Last successful probe summary.
- Last failure diagnostics.
- Created/updated timestamps.

The generated command line can be regenerated from structured fields. Manual override should not destroy the structured fields.

## Architecture Modules

- `EngineDiscovery`: scans likely locations and ranks candidate executables/models/configs.
- `EngineProbe`: runs safe test commands and returns structured diagnostics.
- `EngineProfileBuilder`: turns discovery/probe results into a profile.
- `EngineSetupWizard`: UI workflow for normal users.
- `AdvancedEngineEditor`: manual command-line and expert settings.

## MVP Boundary

MVP should include:

- User-selected executable.
- Nearby model/config auto-detection.
- Test engine button.
- Readable success/failure diagnostics.
- Manual advanced command-line editor.

MVP can defer:

- Downloading KataGo releases.
- Downloading model files.
- GPU/backend recommendation.
- Full PATH scanning on every launch.
- Cloud/remote engines.
