# Shared Go board core

This directory is the single source of truth for Go-board behavior shared by Desktop and Forum.

- `index.js`: replay, capture, suicide, simple-ko validation, coordinates, GTP conversion, and star points.
- `index.d.ts`: TypeScript contract used by Desktop.
- `board.css`: board, stone, marker, and candidate visual tokens.
- `index.test.js`: cross-surface rule regression tests.

Desktop keeps compatibility imports in `desktop/src/game/boardRules.ts` and consumes geometry directly from `BoardPlaceholder.tsx`. Forum loads the same ES module from `/shared/go-board.js`; its server exposes the root source file. Kubernetes copies this shared source only as a generated ConfigMap input during deployment.

Do not add page-local capture, liberty, suicide, ko, coordinate, or star-point implementations. Extend this module and its tests instead.
