# MVP Engine and Analysis Scope

Source: `Docs/MVP-0.1.md`

## MUST

- Start/stop real-time KataGo analysis.
- Pause/resume analysis from bottom toolbar.
- Show analysis status text.
- Show current engine in title/menu area.
- Manage engine profiles.
- Provide an easy engine setup flow that automatically checks engine configuration for 90%+ of common local setups.
- Preserve an advanced manual configuration entry for power users.
- Add and delete engine profiles.
- Store engine display name.
- Store engine command line.
- Store default komi.
- Select default engine.
- Switch or manage active engine.
- Restart current engine.
- Close current engine.
- Load SGF komi and use it in analysis.
- Modify current komi and support komi stepper controls.
- Display candidate move rank, winrate, visits/playouts, and score lead.
- Display total visits in candidate list.
- Display ownership/KataGo evaluation on the main board.
- Show winrate and score curves.
- Show chart hover details.
- Limit candidate count.
- Limit PV length.
- Support analysis cache if included in the architecture.

## SOON

- Auto analysis across a game record.
- Batch SGF analysis.
- Lightning analysis using analysis mode.
- Analysis over a move range.
- Analysis over all branches.
- Lightning analysis settings: command, visits, rules, overwrite behavior.
- Super eye/match-rate statistics.
- Move evaluation labels.
- Engine command auto-generation.

## Engine Setup Product Rule

Engine setup must optimize for a normal user who does not know the exact KataGo command line. The default path should be:

1. Choose or auto-detect a KataGo executable.
2. Auto-discover likely model and config files.
3. Probe the engine.
4. Show readable diagnostics.
5. Save a working profile.

Manual command-line editing stays available, but it is the advanced path, not the primary onboarding flow.

## UNKNOWN

- Live KataGo rule mutation.
- Live PDA/aggression and WRN/breadth parameters.
- Policy/heatmap/pure-network view.
- Allow/avoid/priority regions.
- Clearing current/global analysis info.
- Closing all engines.
- Engine profile ordering.
- Initial commands.
- Preload behavior.
- Platform templates.
- Board width/height per engine profile.
- Background ponder.
- Advanced time settings.
- PV remaining visits display.

## DROP

- `genmove` human-vs-AI gameplay modes.
- Engine-vs-engine games.
- AI continuation/play-best-move commands.
- Double-engine comparison UI.
- Remote SSH engine configuration.
- ikatago remote helper.
- Encrypted command line.
- External sync/readboard protocols.

## Required Normalized Analysis Fields

- Candidate coordinate.
- Candidate rank.
- Winrate with explicit perspective.
- Score lead with explicit perspective and komi handling.
- Visits/playouts.
- Visit share if available, but not required for MVP.
- Principal variation as a coordinate list.
- Ownership array for the board size.
- Policy prior if available, but optional for MVP.

## UI Consumers

- `go-board-ui`: board candidate bubbles, ownership overlay, PV hover preview, candidate table, winrate/score chart.
- `sgf-format`: cached analysis attached to game tree nodes when persisted.
