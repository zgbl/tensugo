---
name: brg_format
description: Standard definition and processing guidelines for the BRG (BlackRice Go) 1.0 file format.
---

# BRG (BlackRice Go) 1.0 Skill Guidelines

This skill provides instructions on how to parse, validate, and manipulate the BRG (BlackRice Go) 1.0 file format within the TensuGo project.

## Document Structure (1.0 Specification)

BRG 1.0 is a JSON-based document structure for Go game reviews and research articles. It consists of four top-level sections:
- `meta`: Article metadata (title, author, creation timestamps).
- `source`: The original game recording data (SGF or GIB).
- `gameInfo`: Basic game configurations.
- `blocks`: A linear array of interactive narrative blocks (heading, paragraph, board, ai, variation).

For detailed JSON schemas and Typescript typings, see [BRG-Design-1.0.md](file:///Users/tuxy/Codes/KataGo/TensuGo/Docs/BRG-Design-1.0.md).

## Key Processing Rules

1. **Coordinates**:
   - Always store board coordinates internally as `[col, row]` (0-indexed integer array).
   - `[0, 0]` is the top-left corner (A19 in standard display coordinates, or corresponding corner).
   - Do NOT store string coordinates (like "D4") in the JSON data blocks. Perform displays/string conversions at runtime in the UI layer.

2. **Block Identity (`id`)**:
   - Every block must have a unique, stable string ID (e.g., `blk_1`, `blk_2` or UUID).
   - Do NOT use path-based IDs (like `0.1.2`) that would change when blocks are rearranged or deleted.

3. **Game States & Captures**:
   - In 1.0, do not store `captures` explicitly inside the blocks. The rendering engine must rebuild the board state sequentially starting from the original game tree or game record up to the block's `moveNumber`.

4. **Variation Sequence**:
   - Variation block sequences (`moves`) consist of arrays containing the color and position, e.g.:
     ```json
     { "color": "B", "pos": [16, 2] }
     ```

## Example Usage

When an agent needs to create a new `.brg` document, it should construct the JSON following this format:

```json
{
  "format": "brg",
  "version": "1.0",
  "meta": {
    "title": "Study of Move 51",
    "author": "Antigravity",
    "createdAt": "2026-06-26T18:00:00Z",
    "updatedAt": "2026-06-26T18:00:00Z"
  },
  "source": {
    "format": "sgf",
    "fileName": "game.sgf",
    "content": "(;GM[1]FF[4]SZ[19]KM[7.5];B[pd]...)"
  },
  "gameInfo": {
    "boardSize": 19,
    "rules": "Chinese",
    "komi": 7.5,
    "players": {
      "black": { "name": "Player 1" },
      "white": { "name": "Player 2" }
    }
  },
  "blocks": [
    {
      "id": "heading_1",
      "type": "heading",
      "level": 1,
      "text": "Introduction"
    },
    {
      "id": "para_1",
      "type": "paragraph",
      "markdown": "This shows the situation after move 51."
    }
  ]
}
```
