# MVP SGF and Game Record Scope

Source: `Docs/MVP-0.1.md`

## MUST

- Create a new empty board/game record.
- Open local game record.
- Save.
- Save as.
- Load komi from SGF.
- Edit game information: players, komi, handicap where supported.
- Delete one move.
- Delete current branch.
- Set current variation as main branch.
- Return to main branch.
- Display branch position.
- Add current candidate variation as a branch.
- Jump to first, previous ten, previous one, next one, next ten, and last move.
- Jump to the move represented by a stone.
- Display black/white player names below the board.

## Display MUST

- Move number modes: none, last 1, all.
- Numbering from 1.
- Branch numbering from 1.
- Current/last move highlight.
- Current and previous move text summary.

## SOON

- Endgame scoring workflow.
- Auto analysis stored over the record.
- Batch SGF analysis.
- Lightning analysis over move ranges/all branches.
- Real-game move markers and out-of-candidate indicators in candidate list.

## LATER

- Recent files.
- Online link open.
- Save clean SGF.
- Save current branch only.
- Board/chart screenshots.
- Clipboard SGF paste.
- English UI strings.

## UNKNOWN

- Clean SGF with comments.
- Copy SGF to clipboard.
- Comment panel.
- SGF marker tools.
- Add/insert black or white stones.
- Pass.
- Swap colors.
- Rotate or mirror board.
- Undo/redo delete.
- Custom branch move-number modes.
- Right-click edit cache actions.

## DROP

- Old save/load slots.
- Freehand drawing.
- External platform sync record handling.
- Human-vs-AI game record modes as MVP product features.

## Internal Model Expectations

- Root metadata: board size, komi, rules, players, handicap, source filename.
- Node data: move color, move coordinate or pass, comments, markers, analysis cache, child variations.
- Navigation state: current node, main-line identity, selected candidate/PV preview state.
- Mutation commands should be explicit operations on the tree: add move, delete node, delete branch, promote variation, return to main line.
