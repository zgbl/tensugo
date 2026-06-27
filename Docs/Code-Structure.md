# TensuGo Code Structure

This document explains how the current TensuGo codebase is organized. It is written for someone who has not used Tauri before and wants to know where the frontend, desktop backend, board logic, SGF parser, and KataGo engine integration live.

## Big Picture

TensuGo is a Tauri desktop app:

- The visible UI is React + TypeScript in `src/`.
- The desktop host/backend is Rust + Tauri in `src-tauri/`.
- The browser preview at `http://127.0.0.1:1420/` runs the React UI only.
- The packaged/dev Mac app runs the React UI inside a Tauri WebView and can call Rust commands to access local files/processes such as KataGo.

The most important boundary:

```text
React UI (src/)
  calls invoke("command_name", data)
Tauri Rust backend (src-tauri/src/lib.rs)
  receives command, talks to local OS/processes, returns JSON
```

For example, KataGo analysis cannot really run from the browser preview. It must go through Tauri/Rust because it starts a local `katago` process.

## Run Commands

From the project root:

```bash
npm run dev
```

Starts the frontend dev server. This is useful for fast UI work, but native engine commands are not available.

```bash
npm run tauri
```

Starts the desktop app in Tauri dev mode. Use this when testing KataGo process integration or anything that needs the native backend.

```bash
npm run package:mac
```

Increments the patch version and builds the macOS `.app` / `.dmg`. Use this for installable test packages so Finder shows a new version each time.

The generated test DMG also gets a two-digit patch label such as `TensuGo_0.1.01_aarch64.dmg`, `TensuGo_0.1.02_aarch64.dmg`, and so on.

```bash
npm run build
```

Builds the React frontend with TypeScript checking.

```bash
cd src-tauri
source /Users/tuxy/.cargo/env
cargo check
```

Checks the Rust/Tauri backend.

## Top-Level Files

`package.json`

Defines frontend scripts and npm dependencies. Important scripts are `dev`, `build`, and `tauri`.

`vite.config.ts`

Vite dev/build config for the React frontend.

`src-tauri/tauri.conf.json`

Tauri desktop app config: app name, window size, dev URL, build command, bundle settings.

`docs/Release-v0.1.md`

Release v0.1 feature scope reference. It says which old functions are MUST/SOON/LATER/UNKNOWN/DROP.

## Frontend Entry

`src/main.tsx`

React entry point. It mounts the app into the HTML page.

`src/app/App.tsx`

Main application shell. This currently owns most UI state:

- current board size
- komi/rules/player names
- opened SGF moves
- current move number
- board position derived from moves
- engine profile/status
- candidate moves returned by KataGo

It wires together the top toolbar, left panels, board, right candidate panel, and bottom toolbar.

As the project grows, some state should move out of `App.tsx` into domain stores/managers, but right now this file is the main place to understand app behavior.

## UI Components

`src/components/TopToolbar.tsx`

Top menu/toolbar. It includes file open input and shows current file/player/move summary.

`src/components/GameInfoPanel.tsx`

Left panel section for SGF/game metadata:

- file name
- black/white player
- komi
- rules
- board size
- current move
- captures
- next player

`src/components/EngineConfigPanel.tsx`

Left panel section for KataGo configuration:

- engine display name
- executable path
- model path
- config path
- test button
- analyze-current-position button

This is the simple/manual engine configuration surface. The current default profile is seeded from your working command.

`src/components/CandidatePanel.tsx`

Right panel for move navigation, candidate moves, and PV preview. It accepts real candidate data from engine analysis, keeps prior candidate rows stable between refreshes, and uses the selected/hovered candidate to render the PV mini-board. The candidate list is collapsible so the PV mini-board can take the remaining right-side space.

The winrate/review graph is rendered in the left panel. It is an interaction control, not just a status chart: clicking a horizontal position jumps the main board to that main-line move. The graph is populated from analyzed positions as KataGo returns results.

`src/components/BottomToolbar.tsx`

Bottom action/navigation bar. Move navigation is wired. `AI分析` is the single realtime analysis toggle; `自动分析` opens settings when idle, becomes `暂停分析` while running, and becomes `继续分析` after pausing. `结束分析` clears the resume point and opens the Tianshu report.

## Board UI

`src/board/BoardPlaceholder.tsx`

Main Go board renderer.

Important rule: stones are placed on line intersections, not inside square cells. This component maps logical `(x, y)` to board-plane percentages:

```text
x / (boardSize - 1)
y / (boardSize - 1)
```

It draws:

- grid lines
- coordinate labels
- star points
- stones
- last-move marker
- candidate bubbles

Clicking the board maps the mouse position to the nearest intersection and calls `onPointClick(x, y)`.

`src/styles/global.css`

Global layout and visual styling. This controls the dense desktop layout, board sizing, side panels, toolbars, stones, candidate table, and engine config section.

Project style constraints currently agreed for TensuGo:

- Keep the main board warm wood-grain colored.
- Use light side panels with dark text; do not return to dark gradient sidebars.
- Avoid card-heavy or generic AI-style UI.
- Candidate/status/PV areas must not flicker, clear, or resize horizontally during repeated KataGo refreshes.
- When packaging for user testing, run the Tauri build, delete `/Applications/TensuGo.app`, install the new bundle with `ditto`, then verify the installed timestamp/version.

## Game And Rules Logic

`src/game/sampleGame.ts`

Sample game data used before an SGF is opened.

`src/game/boardRules.ts`

Builds a board position from moves. It applies basic Go rules:

- occupied-point checks
- adjacency/liberties
- captures
- suicide handling

This is currently enough for local replay/basic placement, but full ko/superko and full rules testing still need to be added.

`src/game/coordinates.ts`

Coordinate conversion helpers:

- board labels like `A B C ... H J K`
- SGF coordinate conversion helpers

Keep coordinate conversion centralized here instead of scattering it through UI components.

`src/game/gameTree.ts`

Early domain types for game tree work. The project still needs a real game tree model for branches/variations.

Required direction for the real game tree model:

- Preserve the complete SGF game tree on import, including nested OGS single-child branch chains.
- Represent each move/comment/analysis point as a node with stable id, parent id, children, and sibling order.
- Track which child is the main-line child at each branch point.
- Support promote-to-main-line by reordering siblings, not by deleting the old main line.
- Support deleting a variation subtree with confirmation.
- Let the right-side branch tree click any node and jump the main board to that exact node.
- Manual variation input should append child nodes to the selected game-tree node instead of truncating a linear moves array.

## Game Record Parsing

`src/sgf/parseSgf.ts`

Current SGF/GIB parser.

What it supports now:

- root/main-line parsing
- board size `SZ`
- komi `KM`
- rules `RU`
- black/white names `PB`/`PW`
- main-line `B[]` / `W[]` moves
- real-world compatibility where metadata may appear later in the main line
- Yicheng/Fox-style `.gib` files decoded as GB18030
- GIB `STO` move lines as main-line moves

Current limitations:

- variations are ignored
- setup stones `AB`/`AW` are not handled yet
- comments/markers are not preserved yet
- save/export is not implemented yet

`src/sgf/types.ts`

Reserved SGF-related type location.

## Engine Integration

There are two sides: frontend adapter and Tauri backend.

### Frontend Adapter

`src/engine/types.ts`

TypeScript types for engine profile, probe result, and normalized candidate moves.

`src/engine/tauriEngine.ts`

Frontend wrapper around Tauri `invoke(...)`.

Important exports:

- `DEFAULT_ENGINE_PROFILE`
- `isTauriRuntime()`
- `getDefaultEngineProfile()`
- `probeEngine(profile)`
- `analyzePosition(...)`

The default profile currently points to:

```text
/opt/homebrew/bin/katago
/opt/homebrew/share/katago/g170e-b20c256x2-s5303129600-d1228401921.bin.gz
/Users/tuxy/App/KataGo/Config/winConfigs/default_gtp.cfg
```

In browser preview, `isTauriRuntime()` is false, so analysis shows a message instead of trying to spawn KataGo.

### Tauri Backend

`src-tauri/src/main.rs`

Small binary entry point. It calls `tensugo_lib::run()`.

`src-tauri/src/lib.rs`

Rust backend and Tauri command registration.

Current commands:

- `app_name`
- `default_engine_profile`
- `probe_engine`
- `analyze_position`

`probe_engine` checks files and runs a minimal analysis probe. This matters because `katago version` can work while the real OpenCL engine still fails during neural-net startup.

`analyze_position` starts:

```text
katago gtp -model <model> -config <config>
```

Then it sends GTP commands:

```text
boardsize 19
komi 7.5
clear_board
play B Q16
play W D4
kata-analyze B 80
```

It parses KataGo output into normalized candidates:

- rank
- move
- visits
- winrate
- score lead
- PV

Current limitation: this is a short-lived probe-style analysis. A production-quality engine manager should keep a persistent KataGo process, stream incremental updates, support cancellation, and cache analysis by game node.

## Stores

These files exist as placeholders for moving state out of `App.tsx`:

`src/stores/gameStore.ts`

Initial game state.

`src/stores/analysisStore.ts`

Candidate/analysis snapshot types and empty snapshot.

`src/stores/settingsStore.ts`

Engine profile/settings type sketch.

Right now `App.tsx` still holds most runtime state. These stores should become more important as features stabilize.

## Current Data Flow

Open SGF:

```text
TopToolbar file input
  -> App.openSgfFile(file)
  -> readGameRecordFile(file)
  -> parseGameRecord(text)
  -> App state: metadata + moves
  -> buildBoardPosition(...)
  -> BoardPlaceholder + GameInfoPanel
```

Play a move:

```text
BoardPlaceholder click
  -> App.playMove(x, y)
  -> canPlayMove(...)
  -> append move
  -> buildBoardPosition(...)
  -> board redraw
```

Analyze current position in Mac App:

```text
BottomToolbar / EngineConfigPanel
  -> App.analyzeCurrentPosition()
  -> tauriEngine.analyzePosition(...)
  -> invoke("analyze_position")
  -> Rust starts katago
  -> Rust sends GTP moves + kata-analyze
  -> Rust parses candidates
  -> CandidatePanel displays real candidates
```

Analyze current position in browser preview:

```text
BottomToolbar / EngineConfigPanel
  -> App.analyzeCurrentPosition()
  -> isTauriRuntime() is false
  -> status message: use Mac App
```

## Where To Change Common Things

Change board drawing or stone placement:

`src/board/BoardPlaceholder.tsx`

Change compact UI layout, panel widths, toolbar heights, board size:

`src/styles/global.css`

Change SGF loading behavior:

`src/sgf/parseSgf.ts`

Change move legality/captures:

`src/game/boardRules.ts`

Change engine default paths:

`src/engine/tauriEngine.ts` and `src-tauri/src/lib.rs`

Change native engine process behavior:

`src-tauri/src/lib.rs`

Change candidate table display:

`src/components/CandidatePanel.tsx`

Change bottom command buttons:

`src/components/BottomToolbar.tsx`

Change the full screen composition:

`src/app/App.tsx`

## Current Known Gaps

- Engine process should become persistent instead of short-lived per analysis request.
- KataGo OpenCL currently fails on this machine during real GTP initialization with `CL_INVALID_VALUE`; the app now exposes this through diagnostics instead of hiding it.
- SGF parser does not preserve variations/comments/markers yet.
- Save/export SGF is not implemented yet.
- Full game-tree branch model is not implemented yet.
- Candidate bubbles on the board are still mock data; right candidate table can receive real engine candidates.
- Ownership overlay and winrate/score chart are still placeholder UI.

## Mental Model For Tauri

Think of Tauri as two programs working together:

1. React frontend: draws the app and handles user interaction.
2. Rust backend: does trusted native work that the browser cannot do.

The frontend asks the backend to do work through named commands:

```ts
invoke("analyze_position", { request })
```

The backend exposes those names here:

```rust
tauri::generate_handler![
    app_name,
    default_engine_profile,
    probe_engine,
    analyze_position
]
```

If something must touch local processes, native dialogs, app packaging, filesystem permissions, or OS integration, it belongs in `src-tauri/`. If it is visual layout, board rendering, buttons, tables, or UI state, it belongs in `src/`.
