# MVP Board UI Scope

Source: `Docs/MVP-0.1.md`

## MUST Layout

- Title/status area with current analysis summary, engine, players, and file name when available.
- Top menu bar.
- Top icon toolbar for open/save, analysis, branch, and core edit actions.
- Left information panel.
- Central main board.
- Right candidate table.
- Right branch/navigation area.
- Bottom toolbar.

## SOON Layout

- Top parameter bar.
- Right-lower small board as full global thumbnail.
- Larger small board and larger winrate chart modes.

## Main Board MUST

- Draw board, stones, coordinates, star points, and last move marker.
- Support left-click empty point to play or create variation.
- Support left-click candidate to preview or enter candidate variation.
- Support candidate hover to show PV.
- Support mouse wheel move navigation or PV navigation.
- Show candidate bubbles with rank, winrate, visits/playouts, and score lead.
- Show candidate ranking badge.
- Show ownership overlay on the main board.
- Support coordinate display toggle.
- Support move number display modes: none, last 1, all, always from 1, branch from 1.

## Candidate Table MUST

- Rank.
- Coordinate.
- Winrate.
- Visits/playouts.
- Score lead.
- Total visits.
- Real-game move marker.
- Click row to show that candidate variation.

## Left Panel MUST

- Rule display.
- Komi display.
- Winrate bar.
- Current/previous move summary.
- Small winrate/score chart.
- Detailed current-position text: winrate, score, uncertainty if available, engine name, visits, komi.
- Analysis status text.

## Chart MUST

- Black-perspective winrate and score.
- Winrate curve.
- Score curve.
- Combined display.
- Hover details.
- Score lead including komi.

## Bottom Toolbar MUST

- KataGo ownership toggle.
- Pause/resume analysis.
- Set main branch.
- Delete.
- First, back ten, back one, forward one, forward ten, last.
- Coordinate toggle.
- Open.
- Save.
- Candidate list.
- Return to main branch.

## PV and Small Board

- Candidate hover should show a variation preview.
- A small-board PV preview is `MUST` if it is the chosen preview surface.
- Full global thumbnail behavior is `UNKNOWN/SOON`; do not block MVP on it.

## UNKNOWN / Do Not Implement by Default

- Full SGF marker toolbar.
- Heatmap/policy display.
- Right-click allow/avoid/priority menus.
- Drag stone editing.
- Board rotation/mirroring.
- Hover stone rewind.
- Always-on-top and layout reset.
- Independent candidate list window.
- Custom toolbar content.

## DROP

- Floating main board.
- Floating small board.
- Floating double board.
- Extra floating board.
- Classic/thinking/four-board/double-engine/custom layout modes.
- Toolbar merge/autowrap complexity.
- Human-vs-AI game toolbar controls.
- Sync/share/live platform toolbar controls.
