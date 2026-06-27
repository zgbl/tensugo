---
name: tensugo-project
description: Use when working inside the TensuGo desktop Go/KataGo review app. Keeps only high-priority project rules; load docs/Release-v0.1.md only when detailed product scope is needed.
---

# TensuGo Project Skill

Use for any work in `/Users/tuxy/Codes/KataGo/TensuGo`.

Also use `weiqi-go-board` only when touching board geometry, SGF/kifu, coordinates, PV rendering, legal move logic, or Go-specific UI correctness.

## Context Budget

- Keep this skill lean. Do not expand it with long product notes.
- Put detailed scope in `docs/Release-v0.1.md`; read only the relevant section when needed.
- For code structure questions, read `docs/Code-Structure.md` only if local files are not enough.

## Product Rules

- Dense desktop Go review app, not a marketing surface.
- App startup should show an empty board, not a bundled sample game.
- Board first, side panels second; avoid generic/card-heavy redesigns.
- Main board keeps warm wood styling. Do not recolor it into slate/green/dark themes.
- Left/right panels stay light with dark text.

## Analysis Rules

- Candidate rows/status must not flicker or clear between short refreshes.
- Do not switch normal review UI to engine terminal during analysis.
- User board operations have priority over realtime analysis. Debounce/cancel stale analysis so placing a stone never waits on engine output.
- Hovering candidate bubbles/table rows previews that candidate PV; do not snap back unexpectedly while inspecting.
- Realtime analysis bottom button is a single `AI分析` / `暂停分析` toggle. Do not use `Kata评估` in user-facing toolbar text.
- `自动分析` opens settings when idle; while running the toolbar button reads `暂停分析`; after pausing it reads `继续分析` and resumes from the saved move.
- `结束分析` is separate from pause: it clears the resume point and opens the Eagle Eye report with total statistics.
- Eagle Eye report should follow the legacy structure: match degree/rate, first-choice hit rate, winrate trend, score-loss stats, winrate-loss stats, and bottom summary/conditions.
- Automatic analysis must show candidate bubbles/table for each analyzed position, move branch-tree highlight, update winrate graph, obey seconds-per-move as a wall-clock minimum, and stop with a visible reason if no candidates return. Use short engine batches so the UI can render updates and respond to stop.
- SGF `KM` must be loaded and sent to the engine before analysis; changing komi invalidates stale candidates/graph points.

## Game Tree Rules

- Preserve full SGF game tree and imported nested branches. Never flatten/discard branches.
- Right branch tree is a real navigator, not a simple move list; it must stay vertical and scroll.
- Board navigation, graph jumps, auto-analysis progress, and branch clicks must all sync selected branch-tree row and scroll it into view.
- `设为主分支` promotes the selected variation by reordering siblings, preserving the demoted line.
- `返回主分支` returns to the current variation's branch point, not the same move number on main line.
- `删除分支` deletes the selected subtree after confirmation without corrupting siblings.
- Manual variation editing creates game-tree branches, not destructive linear truncation.

## Layout Rules

- Main board must grow and shrink with the window.
- Bottom toolbar controls must remain visible.
- `返回主分支` belongs next to `设为主分支`.
- `手数` cycles only: all numbers / last 10 / last move.
- `坐标` toggles coordinate labels; hidden coordinates must let the main board grow into the released space.
- Do not add a bottom-toolbar `候选列表` button; use the right candidate panel hide/show control.
- Right side contains branch tree, collapsible candidate list, and PV mini-board.
- PV mini-board must stay square, show the full board, and include border/padding in sizing.
- Research mode right pane keeps branch tree on top and uses the remaining space for live document preview: board/variation figures paired with commentary text.

## Package/Install

After user-facing app changes, install without waiting to be reminded:

1. Prefer `npm run install:mac` or `bash scripts/install-mac-app.sh`; each packaging/install run must bump the patch version by 1.
2. If the script cannot run, fall back to build, Tauri build, delete `/Applications/TensuGo.app`, `ditto` the new bundle, then verify timestamp/version.

Never claim the installed app changed unless the old app was deleted and the new bundle copied into `/Applications`.
