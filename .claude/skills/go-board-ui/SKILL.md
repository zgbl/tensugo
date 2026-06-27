---
name: go-board-ui
description: "Use when building or modifying TensuGo board and analysis UI: Go board rendering, coordinates, stones, move numbers, candidate move bubbles, ownership overlay, heatmap/policy display, PV hover preview, winrate/score charts, side panels, toolbars, candidate list, branch navigation, and responsive layout."
---

# Go Board UI / Visualization

## When to Use

Use this skill for board rendering, UI layout, candidate move visualization, winrate/score charts, ownership or policy overlays, mouse/keyboard interactions, toolbars, and panels.

Also load `katago-protocol` when visualization depends on engine fields, and `sgf-format` when UI actions mutate the game tree.

## MVP Screen Structure

MVP 0.1 keeps these primary areas:

- Window title/status summary.
- Top menu and icon toolbar.
- Left information panel with rules, komi, winrate bar, chart, current-position summary, and analysis status.
- Central main board with stones, coordinates, last-move marker, move numbers, candidate bubbles, PV hover, and ownership overlay.
- Right candidate table with rank, winrate, visits/playouts, and score lead.
- Right branch/navigation area showing variation position.
- Bottom toolbar with analysis, ownership, branch, delete, navigation, coordinate, open/save, candidate list, and main-branch actions.

The right-lower small board is useful for PV preview, but it is not allowed to block core board/candidate/list work.

See `references/mvp-board-ui-scope.md` for detailed UI feature decisions from `Docs/MVP-0.1.md`.

## Core Interactions

MVP 0.1 must support:

- Left-click empty point to play a move or create a variation.
- Left-click candidate point or candidate row to preview/enter that variation.
- Hover candidate point to show PV/variation preview.
- Mouse wheel to navigate moves or variation preview.
- Coordinate toggle.
- Move number modes: none, last 1, all, always from 1, and branch-from-1.
- Last move highlight.
- Ownership overlay on the main board.
- Winrate/score chart with hover details.

## Visual Priorities

- Make the board the visual center of the app.
- Candidate bubbles should show rank, winrate, visits, and score lead without hiding stone identity.
- Ownership should be readable but secondary to stones and candidates.
- Charts and side panels should support fast review, not become dense legacy control panels.
- Avoid old floating-board and multi-board layout complexity.

## Coordinate Rules

Keep conversions centralized:

- UI board point: row/column or x/y in board space.
- Display coordinate: Go board labels such as `A-T` and `1-19`.
- GTP coordinate: engine command format.
- SGF coordinate: lowercase SGF point format.

Do not duplicate conversion logic in overlay components.

## References

- `references/mvp-board-ui-scope.md`: MVP board, layout, chart, candidate list, toolbar, and interaction scope.
