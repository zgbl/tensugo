---
name: architecture
description: "Use when designing or changing TensuGo architecture: module boundaries, desktop shell decisions, UI state, game tree model, SGF persistence, KataGo engine process management, analysis streaming, cache ownership, coordinate conversion, data flow diagrams, Mermaid architecture diagrams, and implementation phase planning."
---

# TensuGo Architecture

## When to Use

Use this skill before creating major modules, choosing technical boundaries, wiring state management, integrating KataGo, designing SGF/game-tree persistence, adding caches, or changing how board UI, engine analysis, and file data flow through the app.

Also load:

- `project-conventions` for MVP priority and dropped/deferred legacy features.
- `sgf-format` for game tree and SGF import/export details.
- `katago-protocol` for engine protocol and normalized analysis fields.
- `go-board-ui` for UI consumers of architecture state.
- `visual-design` when architecture affects layout or visual density.

## Architecture Goals

- Keep the board UI responsive while KataGo analysis streams in.
- Make the game tree the source of truth for moves, branches, metadata, and current node.
- Keep engine process/protocol code out of rendering components.
- Normalize KataGo output before it reaches UI components.
- Centralize coordinate conversion.
- Attach cached analysis to stable game positions/nodes, not to transient UI views.
- Preserve MVP speed by building one coherent analysis workflow before advanced modes.

## Recommended Layers

- Desktop shell / host adapter: app lifecycle, file dialogs, process permissions, native packaging.
- UI app: layout, views, interactions, rendering, user commands.
- Domain model: board rules, moves, captures, game tree, branches, coordinates.
- SGF adapter: parse, serialize, metadata mapping, compatibility.
- Engine manager: engine profiles, process lifecycle, request scheduling, restart/close.
- Engine discovery/probe: automatic setup, validation, and readable diagnostics for normal users.
- KataGo protocol adapter: GTP or analysis JSON command/response handling.
- Analysis store: current analysis stream, cached node analysis, candidate/PV/ownership normalization.
- Settings store: UI preferences, engine profiles, display modes, MVP-safe feature flags.

See `references/system-architecture.md` for diagrams and data-flow rules.

## Dependency Direction

UI may depend on domain models and stores. Domain models must not depend on UI or engine process code.

Engine protocol code may depend on coordinate utilities and engine profile settings, but not on board components.

SGF parsing may depend on domain models and coordinate utilities, but not on UI state.

Rendering components should consume normalized view models, not raw SGF nodes or raw KataGo lines.

## First Implementation Phases

1. Static shell and layout prototype.
2. Domain game tree and board renderer.
3. SGF open/save and navigation.
4. Engine manager and normalized analysis stream.
5. Candidate list, PV preview, ownership, and chart integration.
6. Editing commands, engine settings, cache, and visual polish.

## References

- `references/system-architecture.md`: module diagram, state flow, event flow, and architecture rules.
