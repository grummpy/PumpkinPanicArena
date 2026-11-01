import assert from "node:assert/strict";
import { test } from "node:test";
import { createRng, rngInt, rngRange } from "../src/core/rng.js";

function take(seed, n) {
  const rng = createRng(seed);
  const out = [];
  for (let i = 0; i < n; i++) out.push(rng());
  return out;
}

test("same seed replays the same sequence", () => {
  assert.deepEqual(take(1, 8), take(1, 8));
  assert.deepEqual(take(0, 8), take(0, 8));
  assert.deepEqual(take(0xdecaf, 8), take(0xdecaf, 8));
});

test("different seeds diverge", () => {
  assert.notDeepEqual(take(1, 4), take(2, 4));
  assert.notDeepEqual(take(1, 4), take(99, 4));
});

test("values stay inside the unit interval", () => {
  for (const value of take(7, 50)) {
    assert.ok(value >= 0 && value < 1);
  }
});

test("integer and range helpers stay in bounds and replay", () => {
  const a = createRng(12);
  const b = createRng(12);
  for (let i = 0; i < 20; i++) {
    assert.equal(rngInt(a, 5), rngInt(b, 5));
  }
  const rng = createRng(3);
  for (let i = 0; i < 30; i++) {
    const n = rngInt(rng, 4);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 4);
    const x = rngRange(rng, -2, 5);
    assert.ok(x >= -2 && x < 5);
  }
});
