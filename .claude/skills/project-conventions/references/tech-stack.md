# TensuGo Tech Stack

## Decision

Default stack for implementation:

- Product name: TensuGo
- Chinese name: 天书阁
- Internal slug/package name: `tensugo`
- Desktop shell: Tauri 2
- UI: React + TypeScript
- Build tool: Vite
- Styling: CSS modules or plain scoped CSS first; introduce a component system only when repetition appears.
- State: small explicit stores for MVP; avoid heavyweight state frameworks until needed.
- Board rendering: Canvas for the main board and overlays, with DOM/React for surrounding panels and controls.
- Charts: lightweight SVG or Canvas chart component; avoid a large chart dependency until MVP data shape is stable.
- Native/engine integration: Tauri commands in Rust for file dialogs, app paths, spawning KataGo, and process lifecycle.
- Domain logic: TypeScript modules for game tree, SGF model, coordinates, and view models.

## Rationale

Tauri fits this project because TensuGo needs a real desktop app that can launch and manage a local KataGo binary, open/save local SGF files, and eventually package for macOS and Windows without shipping a full Chromium runtime like Electron.

React + TypeScript fits the UI because the app has many stateful panels, tables, toolbar states, and visual overlays. TypeScript also helps keep SGF nodes, engine analysis, and board coordinates from becoming loosely typed strings.

Canvas is the default board renderer because the main board needs stable high-DPI drawing, stones, coordinates, candidate bubbles, ownership overlays, and hover hit testing. Keep coordinate math in shared utilities, not inside the Canvas component.

## Non-Goals for MVP

- Do not start with Electron unless Tauri blocks a required feature.
- Do not start with WebGL/Three.js; the board is 2D and precision matters more than spectacle.
- Do not introduce a full design system package before the first working shell.
- Do not mirror the legacy Java Swing architecture.

## Initial Project Shape

Expected top-level shape after scaffolding:

```text
TensuGo/
├── src/                 # React UI and TypeScript domain code
├── src-tauri/           # Tauri Rust host, commands, permissions, packaging config
├── Docs/                # Planning docs and screenshots
├── .claude/skills/      # Project skills
├── package.json
├── vite.config.ts
└── tsconfig.json
```

Use `tensugo` for npm package names, app config directories, internal slugs, and bundle identifiers. Use `TensuGo` only for user-visible product display.

Suggested TypeScript modules:

```text
src/
├── app/                 # App shell, layout, command wiring
├── board/               # Canvas board rendering and board view models
├── components/          # Shared UI controls
├── engine/              # Frontend engine-facing types and command clients
├── game/                # GameTree, board rules, moves, coordinates
├── sgf/                 # SGF parse/serialize adapter
├── stores/              # GameStore, AnalysisStore, SettingsStore
├── styles/              # Theme tokens and global CSS
└── types/               # Shared app types
```

## Revisit Conditions

Reopen the stack decision only if:

- Tauri process management cannot reliably stream KataGo output.
- Cross-platform packaging blocks local engine execution.
- Canvas performance or text clarity is inadequate for board overlays.
- The UI becomes complex enough to justify a dedicated state library.
