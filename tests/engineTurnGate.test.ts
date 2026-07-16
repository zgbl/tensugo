import assert from "node:assert/strict";
import test from "node:test";

import {
  claimEngineTurn,
  createEngineTurnGate,
  engineTurnIsCurrent,
  releaseEngineTurn
} from "../src/play/engineTurnGate.ts";

test("only one engine request can own a turn", () => {
  const gate = createEngineTurnGate();
  const first = claimEngineTurn(gate, "game-1", 0, "black");

  assert.ok(first);
  assert.equal(claimEngineTurn(gate, "game-1", 0, "black"), null);
  assert.equal(engineTurnIsCurrent(gate, first, "game-1", 0, "black"), true);
});

test("stale engine results cannot commit after position or session changes", () => {
  const gate = createEngineTurnGate();
  const first = claimEngineTurn(gate, "game-1", 2, "black");
  assert.ok(first);

  assert.equal(engineTurnIsCurrent(gate, first, "game-1", 3, "white"), false);
  assert.equal(engineTurnIsCurrent(gate, first, "game-2", 2, "black"), false);
  assert.equal(releaseEngineTurn(gate, first), true);

  const next = claimEngineTurn(gate, "game-1", 2, "black");
  assert.ok(next);
  assert.notEqual(next.id, first.id);
});
