# Visual System Reference

## Original Screenshot Usage

Reference image:

`Docs/ScreenShot/OrgKataGoUI_Screenshot.png`

Use the original screenshot to preserve:

- Overall information architecture: left status, center board, right candidates/navigation, bottom controls.
- Expert density: many values are visible without opening dialogs.
- Immediate analysis feedback: winrate, score lead, candidates, and PV are visible together.
- Board-centered workflow.

Do not preserve:

- Crowded legacy menu/button styling.
- Visual noise from too many equal-weight controls.
- Tiny hard-to-scan text.
- Floating-window and multi-layout complexity.
- Dated Java look-and-feel.

## App Shell

- Use a restrained neutral shell around the board.
- Panels should look like tool surfaces, not decorative cards.
- Use 1px borders or subtle shadows to separate dense regions.
- Keep corner radius small, normally 4-8px.
- Avoid large gradients, decorative blobs, and oversized empty headers.
- Keep top and bottom toolbars compact and stable in height.

## Board

- The board is the visual anchor and should receive the largest continuous area.
- Board texture may be warm wood or clean parchment; it must not reduce line/stones readability.
- Grid lines should be crisp at high DPI.
- Star points should be visible but quiet.
- Coordinates should be legible and lower-contrast than stones.
- Last move marker must be easy to find without covering candidate data.

## Stones

- Black and white stones need strong contrast in both light and dark app themes.
- Use subtle dimensionality only if it stays crisp at small board sizes.
- Do not let ownership, heatmap, or candidate overlays obscure stone color.
- Move numbers on stones must remain readable; dynamically reduce or hide secondary details before text overlaps.

## Candidate Moves

- Candidate bubbles must support rank, winrate, visits, and score lead.
- Highest-priority candidates should be visually distinct, but avoid a rainbow of unrelated colors.
- Candidate bubble text should fit at normal board sizes; abbreviate visits when needed.
- Hover/selected candidate state should be obvious.
- Candidate overlays should not permanently hide the last move or existing stones.

## Ownership and Heatmap

- Ownership overlay is secondary information.
- Use transparency and soft boundaries; avoid heavy opaque blocks.
- Main-board ownership is MVP; heatmap/policy is not default MVP.
- If ownership is shown on stones, keep stone identity dominant.
- Provide a clear off/on state through toolbar or menu.

## Charts

- Winrate and score chart should be compact, readable, and hoverable.
- Use different line treatments for winrate and score, not only color.
- Black perspective is the MVP default.
- Blunder bars are SOON; leave visual room for them but do not implement by default.
- Avoid chart colors that fight candidate or ownership colors.

## Panels and Tables

- Left panel should support fast scan: rules, komi, winrate, score, status, chart.
- Candidate table should emphasize rank, coordinate, winrate, visits, and score.
- Use tabular numbers where possible.
- Align numeric columns consistently.
- Row hover and selected row states should match board candidate selection.
- Avoid making every panel look equally important.

## Toolbar and Controls

- Use icon buttons for repeated tools when an icon is recognizable.
- Use text labels for destructive or ambiguous commands.
- Keep toolbar groups visually separated.
- Prefer toggles for binary display states, segmented controls for modes, and compact inputs for komi/limits.
- Disabled states must be clear but readable.

## Typography

- Chinese UI text must be legible in dense panels.
- Do not use viewport-scaled font sizes.
- Use stable sizes for toolbar buttons and table rows.
- Reserve larger text for current evaluation summaries, not for panel headings.
- Avoid negative letter spacing.

## Visual QA Checklist

Before considering a major UI pass done, inspect screenshots for:

- Board remains the focal point.
- Candidate bubbles are readable and do not overlap incoherently.
- Ownership overlay does not bury stones.
- Left/right panels are dense but not cramped.
- Text fits in toolbars, buttons, tables, and panels.
- Winrate/score chart can be understood at a glance.
- Active engine/status is visible.
- Original screenshot's core information is represented, while dropped legacy features are absent.
