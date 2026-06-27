# MVP 0.1 Project Scope

Source: `Docs/MVP-0.1.md`

## Priority Rules

- `MUST`: MVP 0.1 requirement.
- `SOON`: near-term follow-up; keep architecture extensible.
- `LATER`: defer.
- `UNKNOWN`: clarify before implementing.
- `DROP`: intentionally removed.

## Must-Have Main Areas

- Window title/status summary.
- Top menu bar.
- Top icon toolbar for core actions.
- Left information panel.
- Central main board.
- Right variation/move navigation.
- Right candidate table.
- Bottom toolbar.

## Soon or Deferred Main Areas

- Top parameter bar is `SOON`.
- Right-lower small board is `SOON`, except PV preview is important enough to model early.

## Must-Have Menus and Commands

- File: new, open local game record, save, save as, load SGF komi, normal exit.
- Display: winrate chart panel, branch panel, candidate list panel, coordinates, move number modes, black/white names below board, candidate winrate/visits/score, candidate ranking badge, hover PV, PV length limit, candidate count limit, black-perspective chart, winrate and score curves, chart hover details.
- Analysis: start/stop analysis and KataGo ownership evaluation.
- Edit: edit game information, delete move, delete branch, set main branch, return to main branch.
- Settings: engine configuration, Chinese UI.
- Current engine: active engine display, engine management, restart current engine, close current engine.

## Must-Have Panels and Toolbars

- Left panel: rules, komi, winrate bar, current/previous move summary, small winrate/score chart, detailed current-position text, status text.
- Candidate table: rank, coordinate, winrate, visits/playouts, score lead, total visits, real-game move marker.
- Bottom toolbar: ownership toggle, pause/resume analysis, set main branch, delete, first/back ten/back one/forward one/forward ten/last navigation, coordinate toggle, open, save, candidate list, return main branch.
- Engine settings: profile list, new/delete profile, name, command line, default komi, default engine.
- First launch/settings: candidate info, max analysis limit, candidate count limit, PV length limit, analysis cache, score display strategy, black-perspective winrate/score.

## Soon Features

- Top parameter bar.
- Small-board expansion and winrate chart expansion.
- Blunder bars.
- Endgame scoring.
- Auto analysis and batch analysis.
- Lightning analysis.
- Super eye/match-rate analysis.
- Move quality labels.
- Theme management.
- English UI.
- Engine command auto-generation.

## Later Features

- Recent files.
- Online links.
- Clean SGF export variants.
- Board/chart screenshots.
- Clipboard board screenshot or SGF paste.
- Theme editing.

## Unknown Features

Treat `UNKNOWN` as not-in-MVP unless the current task explicitly asks for it. Examples include GTP console, status panel toggle, always-on-top, many SGF marker tools, right-click allow/avoid controls, pass, board transform, custom move-number modes, policy/heatmap display, and advanced engine parameters.

## Dropped Features

- Human-vs-AI and engine-vs-engine game modes.
- External sync platforms and live board integrations.
- Floating board windows, dual-board/multi-board modes, custom layout modes.
- Old Java/system look-and-feel modes.
- Distributed training contribution menu.
- Remote SSH/ikatago engines.
- Freehand drawing.
- Share/live sync dropdowns.
