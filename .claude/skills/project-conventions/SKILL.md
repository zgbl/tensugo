---
name: project-conventions
description: "Use for TensuGo project-wide decisions: MVP scope, feature priority, repo layout, references to the legacy KataGo analysis UI codebase, build/run/test conventions, and whether a requested UI feature is MUST, SOON, LATER, UNKNOWN, or DROP."
---

# TensuGo Project Conventions

## When to Use

Use this skill before implementing cross-cutting project work, choosing what belongs in MVP 0.1, adding project structure, wiring build/test commands, or deciding whether to keep, defer, or drop a legacy analysis UI feature.

For domain-specific work, also load:

- `go-board-ui` for board rendering, layout, candidate moves, charts, and user interaction.
- `katago-protocol` for engine process control, GTP, analysis JSON, winrate, score, visits, ownership, or policy data.
- `sgf-format` for SGF import/export, game tree branches, metadata, comments, and SGF coordinates.

## Source Repositories

- Active workspace: `/Users/tuxy/Codes/tensugo/desktop`
- Legacy reference repo: configure locally outside this project; do not hard-code the old project path in TensuGo files.
- MVP source document: `Docs/MVP-0.1.md`
- Tech stack decision: `references/tech-stack.md`
- Desktop packaging plan: `references/desktop-packaging.md`

The legacy repo is readable from this workspace. Use it as behavioral reference, not as a mandate to preserve old UI complexity.

## Product Identity

- English product name: `TensuGo`
- Chinese product name: `天书阁`
- Informal Chinese nickname: `天书Go`
- Internal package and bundle names should use `tensugo`.
- `KataGo` refers only to the external Go engine used by the app, not the app name.

## MVP Priority Vocabulary

- `MUST`: implement in MVP 0.1 unless blocked by a core dependency.
- `SOON`: design extension points now, but do not block MVP.
- `LATER`: defer; avoid building UI surface unless cheap and non-invasive.
- `UNKNOWN`: do not implement by default; clarify only when the current task depends on it.
- `DROP`: intentionally remove from the redesign.

See `references/mvp-scope.md` for the project-wide feature decisions distilled from `Docs/MVP-0.1.md`.

## Product Direction

Build TensuGo as a modern Go analysis workstation powered by KataGo, focused on reviewing and analyzing Go games rather than reproducing every legacy UI mode.

MVP 0.1 centers on:

- Opening, saving, navigating, and editing game records.
- A strong main board with candidate move overlays, ownership display, coordinates, and move numbers.
- KataGo real-time analysis with visible winrate, score lead, visits, PV, and engine status.
- Candidate list, branch navigation, winrate/score chart, and essential toolbar/menu actions.
- Engine profile setup and active engine controls.

MVP 0.1 intentionally drops:

- Human-vs-AI and engine-vs-engine game modes.
- External board sync/live platform integrations.
- Floating/multi-board layout modes and old Java look-and-feel modes.
- Distributed training contribution UI.
- Remote SSH/ikatago engine configuration.

## Implementation Rules

- Prefer a smaller, coherent UI over preserving every legacy menu item.
- Treat `DROP` features as product decisions, not backlog omissions.
- Keep `UNKNOWN` features behind clear model/API seams when they are adjacent to MUST work.
- When implementing legacy behavior, inspect the legacy repo only for semantics that affect correctness.
- Keep user-facing language Chinese-first for MVP; English can be added later.
- Default to the documented Tauri + React + TypeScript stack unless the user explicitly reopens the architecture decision.

## References

- `references/mvp-scope.md`: project-wide MVP feature scope and menu/system decisions.
- `references/tech-stack.md`: selected implementation stack and rationale.
- `references/desktop-packaging.md`: macOS and Windows app packaging workflow.
