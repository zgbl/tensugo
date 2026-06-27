# Eagle Eye Review Notes

## Current Match Metrics

The current TensuGo Eagle Eye report does not yet implement the legacy/original UI match-degree algorithm.

Current implementation in `src/app/App.tsx`:

- `candidateRate`: actual move appears anywhere in the returned candidate list.
- `topRate`: actual move is candidate rank 1.
- `matchDegree`: temporary rank-based score.
  - rank 1 => `1.0`
  - other candidate ranks => `max(0.2, 1 - candidateIndex / (candidateCount - 1))`
  - not in candidate list => `0`

This was introduced as an interim heuristic so the Eagle Eye report has usable statistics while automatic analysis is being wired up.

## Required Follow-Up

Replace `calculateMatchScore` with the original UI algorithm once that formula/source is located. Until then, treat match degree as a heuristic ranking score, not as an exact legacy-compatible metric.

## Display Fix

The black/white side cards should use readable bar colors independent of stone color. Do not render black values on black bars or white bars on white backgrounds.
