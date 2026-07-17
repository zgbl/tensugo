import test from "node:test";
import assert from "node:assert/strict";
import { humanConfigPathForLevel, inferHumanEngineLevel } from "../src/engine/humanEngineLevels.ts";
import { fixedHandicapPoints, getNextColorAfterMoves } from "../shared/go-board/index.js";

test("human engine level maps to the matching sibling config", () => {
  const source = "/Users/tuxy/Codes/KataGo/Weight/Human/gtp_human9d_search_example.cfg";
  assert.equal(humanConfigPathForLevel(source, "3d"), "/Users/tuxy/Codes/KataGo/Weight/Human/gtp_human3d_search_example.cfg");
  assert.equal(inferHumanEngineLevel(humanConfigPathForLevel(source, "1d")), "1d");
});

test("fixed handicap is setup state and white starts the game", () => {
  const setup = fixedHandicapPoints(19, 4).map((point) => ({ ...point, color: "black", isSetup: true, moveNumber: 0 }));
  assert.equal(setup.length, 4);
  assert.equal(setup.every((stone) => stone.color === "black" && stone.isSetup && stone.moveNumber === 0), true);
  assert.equal(getNextColorAfterMoves([], "white"), "white");
  assert.equal(getNextColorAfterMoves([{ color: "white", moveNumber: 1, x: 9, y: 9 }], "white"), "black");
});

test("pass counts as a turn in human play", () => {
  assert.equal(getNextColorAfterMoves([], "black"), "black");
  assert.equal(getNextColorAfterMoves([{ color: "black", moveNumber: 1, pass: true, x: -1, y: -1 }], "black"), "white");
});
