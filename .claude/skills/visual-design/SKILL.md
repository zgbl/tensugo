---
name: visual-design
description: "Use when designing or refining TensuGo visual appearance: overall art direction, density, colors, typography, spacing, panel hierarchy, board materials, candidate move styling, ownership overlays, charts, toolbar appearance, themes, screenshots, mockups, or visual QA against the original KataGo UI screenshot."
---

# TensuGo Visual Design

## When to Use

Use this skill when work affects how the app looks or feels: main window composition, visual hierarchy, theme tokens, typography, colors, board rendering, panel styling, candidate bubbles, charts, overlays, icons, responsive sizing, or screenshot-based visual QA.

TensuGo is a desktop application, not a web page. Browser preview is only a development surface. Design decisions must target a native desktop analysis workstation with dense, persistent controls.

Also load:

- `go-board-ui` when the visual work changes board behavior, panels, candidate list, charts, or toolbar interactions.
- `project-conventions` when deciding whether a visual feature belongs in MVP.

## Reference Screenshot

Original UI screenshot:

`Docs/ScreenShot/OrgKataGoUI_Screenshot.png`

Use it to understand information density and feature placement. Do not copy its dated styling, clutter, or legacy control overload.

## Design Direction

TensuGo should feel like a modern, high-density analysis workstation:

- Calm, precise, and tool-like rather than decorative.
- Board-first: the Go board remains the visual anchor.
- Compact first: maximize useful board, candidate, chart, and navigation space; avoid decorative whitespace.
- Dense but readable: expert users should scan quickly without wasting screen area.
- Chinese-first for MVP, with enough layout flexibility for future English.
- Modernized from the original analysis UI, not a pixel-for-pixel clone.

## Non-Negotiable Density Rules

- Never design TensuGo like a marketing page, landing page, web dashboard, or spacious consumer SaaS app.
- Do not add large gutters, oversized cards, hero sections, decorative empty panels, or generous whitespace for visual comfort.
- Keep toolbars, panel headers, table rows, buttons, tabs, and status areas compact by default.
- Every persistent region must earn its pixels: board, analysis candidates, PV, winrate/score, navigation, game info, or engine status.
- Empty placeholder areas should be temporary and visibly compact; do not reserve large blank regions for future content.
- Avoid phrases like "avoid clutter" if they lead to wasted space. The correct standard is compact, information-dense, and organized.
- Prefer split panes, compact panels, tables, and status strips over card-heavy layouts.
- On a 1280x800-ish desktop window, the board should occupy the largest possible square after essential panels and controls.

## Layout Principles

- Preserve the main spatial model from the original: left info, center board, right analysis/navigation, bottom controls.
- Keep the board large and stable; panels adapt around it.
- Avoid nested cards and marketing-style hero layouts.
- Prefer toolbars, segmented controls, toggles, sliders, tables, tabs, and compact panels over large decorative blocks.
- Use tight, consistent spacing and fixed dimensions for toolbars, icon buttons, table rows, and board overlays.

## Visual Hierarchy

Priority order:

1. Board state: stones, last move, coordinates, current variation.
2. KataGo guidance: top candidates, PV preview, ownership overlay.
3. Current evaluation: winrate, score lead, visits, status.
4. Navigation and editing controls.
5. Secondary settings and future features.

If a visual element competes with stones or candidate readability, tone it down.

## Theme Guidance

Default theme should be restrained and professional. Avoid a one-note palette. Use a neutral app shell with warm board tones, clear black/white stone contrast, and limited accent colors for analysis state.

Recommended color roles:

- App background: quiet neutral.
- Panels: slightly raised neutral surfaces.
- Board: warm wood or clean parchment tone.
- Primary accent: current selection / active analysis.
- Candidate accents: ranked but not rainbow-heavy.
- Risk/blunder accents: reserved for SOON move-quality features.
- Ownership: translucent black/white or blue/red mapping, always secondary to stones.

See `references/visual-system.md` for concrete visual rules.

## Prototype Guidance

Figma is optional, not required before implementation. Prefer a working UI prototype when interaction density matters. Use Figma when the task asks for design exploration, stakeholder review, or a reusable design system.

When building in code, verify with screenshots at desktop sizes and inspect text fit, panel density, board clarity, overlay contrast, and whether the original information hierarchy is still represented.

## References

- `references/visual-system.md`: concrete visual system rules, screenshot usage, and QA checklist.
