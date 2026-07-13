---
name: tensugo-project
description: Use when working inside the TensuGo desktop Go/KataGo review app. Keeps only high-priority project rules; load docs/Release-v0.1.md only when detailed product scope is needed.
---

# TensuGo Project Skill

Use for any work in `/Users/tuxy/Codes/tensugo/desktop`.

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
- All winrate history and graphs use one stable perspective: black winrate. KataGo candidate winrate is for the side to move, so persist/display it directly for a black-to-move position and convert white-to-move positions with `100 - winrate`. Never mix side-to-move values across alternating moves; that creates a false mirrored zigzag graph. Apply the same conversion in realtime, automatic, batch, saved TSG, and restored TSG paths.
- Batch analysis must create threshold markers during analysis even when task mode is `analysis`; later problem review consumes those markers. Opening a TSG must make marked moves visible in the branch tree.
- Batch `targetPlayer` filters problem markers only; it must never filter engine analysis moves. Analyze every enabled black and white move continuously so saved candidates, winrate history, and loss calculations remain complete, then create threshold markers only when the move belongs to the target player. Never skip the opponent's turns merely because a target player was selected.
- Automatic analysis winrate graphs must remain complete from the beginning through the original game end. Returning to an earlier move and running a higher-visit manual analysis updates that move in the existing graph; it must not delete later points or shorten the graph axis to the selected move.
- Review-graph score lead is the absolute expected margin including komi, not a delta from the previous move. Because the graph uses black winrate, persist score lead in black perspective too: positive means black leads and negative means black trails. Use KataGo's real `scoreLead`/`scoreMean`; never silently substitute persistent fake `0.0` values when the selected analysis command does not emit score data.
- Candidate bubbles support a persistent two-line/three-line interface setting. Two-line mode shows winrate and visits; three-line mode adds the displayed side's absolute score lead including komi as the bottom line, using the same side perspective as that bubble's winrate.

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
- PV mini-board must stay square, show the full board, and include border/padding in sizing. During realtime, automatic, and batch analysis (running or paused), both its outer board and inner plane must retain the wood board color and never expose a gray panel/disabled-state overlay.
- Research mode right pane keeps branch tree on top and uses the remaining space for live document preview: board/variation figures paired with commentary text.

## Persistent User Requirements

- User-confirmed details must be recorded in `docs/project-docs/User-Requirements.md`, the relevant design document, or this skill; they must not live only in chat history.
- When the model changes or code is refactored, do not restore behavior the user explicitly rejected.
- Before implementing a newly confirmed requirement, update the persistent requirement record first when practical, then implement and verify the workflow.
- The main mode control is one four-option dropdown: review, research writing, problem creation, and problem solving. Problem records are dual-persisted to TSG `tensugo.problemSet` and the PostgreSQL `go_problems` table. The source position links to the original game at `moveNumber - 1`; AI rank 1 is the 10-point full-score move, and other selected AI/manual candidates carry editable scores. Read `docs/project-docs/Problem-System-Design.md` before changing this workflow.
- Problem authoring is document-scoped: all problems from one source game stay in that game's single TSG `problemSet.items[]`. Once the TSG path is known, save in place without prompting per problem. Navigating to another position must clear all previous-position problem draft and candidate state.
- Every problem stores a stable board-position hash and warns on duplicates in the current TSG or database. In problem-creation mode, replace the right-pane PV mini-board with the `题目选点` editor and keep all create/add/delete/save controls there; never cover the main board with a floating problem toolbar.

## Build, Package, And Install

Codex 每次改完代码后，不要自动打包、不要安装、不要运行安装脚本。只说明修改内容和建议测试命令，由用户自己运行。

Use `npm run build` for local verification when appropriate. Only package or install if the user explicitly asks for it in that turn.
