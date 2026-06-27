---
name: sgf-format
description: "Use for TensuGo SGF/game-record work: opening and saving SGF files, parsing metadata such as komi and player names, preserving variations, comments, branch navigation, move deletion, setting main branch, SGF coordinates, clipboard import/export, and attaching or clearing analysis data."
---

# SGF Game Record Format

## When to Use

Use this skill when implementing or changing game record import/export, SGF parsing/generation, game tree navigation, branches, comments, metadata, coordinates, and interactions that mutate the move tree.

Also load `katago-protocol` when SGF nodes store or display KataGo analysis, and `go-board-ui` when changes affect board navigation or branch visualization.

## MVP SGF Scope

MVP 0.1 must support:

- New empty board/game record.
- Open local SGF/game record file.
- Save and save as.
- Load komi from SGF.
- Edit game information such as black/white player, komi, and handicap when supported by the model.
- Delete one move, delete current branch, set current variation as main branch, and return to main branch.
- Branch position display and candidate variation insertion when promoted into the game tree.
- Jump to a move from board stones or navigation controls.

Deferred or optional:

- Recent files, online links, pure SGF export variants, screenshots, clipboard SGF paste, theme/language extensions, SGF markers, and custom annotations.
- Clipboard copy/paste can be added later if the model and parser are already stable.

Dropped:

- Old save slots, floating-board snapshot workflows, freehand drawing, and sync-platform-specific record features.

See `references/mvp-sgf-scope.md` for detailed SGF/game-record decisions from `Docs/MVP-0.1.md`.

## Mapping Rules

- Represent the game as a tree of nodes, not as a flat move list.
- Keep root metadata separate from move-node data.
- Preserve unknown SGF properties when feasible, but do not let them drive MVP UI complexity.
- Keep analysis data attached to positions/nodes, not globally inferred from move number alone.
- Centralize coordinate conversion between SGF coordinates, GTP coordinates, and UI board points.

## Gotchas

- SGF coordinates and GTP coordinates differ; never convert inline in rendering code.
- Branch move numbering has configurable display behavior. MVP must support numbering from 1 and branch-from-1 display.
- Komi loaded from SGF is part of game state and affects engine analysis requests.
- Deleting moves/branches should be undo-friendly if the architecture supports it, but undo/redo is not required for MVP.

## References

- `references/mvp-sgf-scope.md`: MVP SGF, game tree, metadata, and edit feature scope.
