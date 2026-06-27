---
name: katago-protocol
description: "Use when implementing or debugging KataGo engine integration for TensuGo: starting/stopping engines, GTP commands, Analysis Engine JSON, parsing winrate/scoreLead/visits/PV/ownership/policy data, engine profiles, rules, komi, analysis limits, and process lifecycle behavior."
---

# KataGo Engine Protocol

## When to Use

Use this skill for engine process management, command construction, protocol parsing, and analysis data mapping. Trigger examples include KataGo, GTP, analysis engine, `kata-analyze`, `genmove`, winrate, score lead, visits, PV, ownership, policy, heatmap, rules, komi, engine profile, restart engine, and analysis limits.

## MVP Engine Scope

MVP 0.1 must support:

- Engine settings dialog with engine profile list, name, command line, default engine, and default komi.
- Engine setup should automatically discover and validate configuration for 90%+ of normal users, while preserving a manual advanced configuration path.
- Active engine display, engine switching entry point, restart current engine, close current engine, and engine management.
- Real-time analysis start/stop and pause/resume.
- KataGo ownership display on the main board.
- Candidate moves with rank, winrate, visits/playouts, and score lead.
- PV/variation data sufficient for hover preview and candidate row preview.
- Analysis cache support if the chosen architecture includes cached per-node analysis.
- Per-position limits for candidate count and PV length.

Design seams for SOON items:

- Auto analysis and batch analysis.
- Lightning analysis using KataGo analysis mode.
- Blunder/match-rate style "super eye" analysis.
- Move quality labels.

Do not implement MVP support for:

- Human-vs-AI, engine-vs-engine, or genmove game modes.
- Remote SSH/ikatago engines.
- Double-engine comparison UI.
- External board sync integrations.

See `references/mvp-engine-scope.md` for detailed engine-related decisions from `Docs/MVP-0.1.md`.

## Data Model Guidance

Normalize engine analysis into UI-oriented fields before rendering:

- `winrate`: numeric probability, stored with explicit perspective.
- `scoreLead`: numeric points, with explicit komi handling and perspective.
- `visits` or `playouts`: raw search count.
- `pv`: ordered coordinate sequence for variation preview.
- `ownership`: board-sized array suitable for overlay rendering.
- `policy`: optional board-sized priors for future heatmap/pure-network work.

Keep coordinate conversion centralized and shared with `go-board-ui` and `sgf-format`.

## Gotchas

- Always record perspective: MVP winrate and score views default to black perspective.
- Distinguish live incremental analysis updates from stable stored node analysis.
- Engine process failures should surface as UI status, not silent empty analysis.
- Komi changes affect score interpretation and must be reflected in engine requests.
- Do not make hand-written full command lines the only setup path; that recreates the legacy setup pain.

## References

- `references/mvp-engine-scope.md`: MVP engine, analysis, settings, and protocol-adjacent feature scope.
- `references/engine-setup.md`: automatic engine discovery, probing, diagnostics, and advanced manual configuration.
