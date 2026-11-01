import assert from "node:assert/strict";
import { test } from "node:test";
import {
  circleRectOverlap,
  circlesOverlap,
  clamp,
  pushCircleFromRect,
  separateCircles,
} from "../src/core/math.js";

test("clamp keeps values inside the range", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-2, 0, 3), 0);
  assert.equal(clamp(1.5, 0, 3), 1.5);
});

test("circle overlap uses the sum of radii", () => {
  assert.equal(circlesOverlap(0, 0, 10, 15, 0, 10), true);
  assert.equal(circlesOverlap(0, 0, 10, 30, 0, 10), false);
});

test("circle versus rectangle overlap", () => {
  assert.equal(circleRectOverlap(0, 0, 10, 5, -5, 20, 10), true);
  assert.equal(circleRectOverlap(0, 0, 4, 20, 20, 10, 10), false);
});

test("pushCircleFromRect shoves an overlapping circle outside", () => {
  const pushed = pushCircleFromRect(-10, 20, 22, 0, 0, 40, 40);
  assert.equal(pushed.hit, true);
  assert.ok(pushed.x + 22 <= 0.001);
  assert.equal(pushed.y, 20);
  const miss = pushCircleFromRect(-40, 20, 10, 0, 0, 40, 40);
  assert.equal(miss.hit, false);
  assert.equal(miss.x, -40);
});

test("separateCircles removes overlap symmetrically", () => {
  const a = { x: 0, y: 0, r: 10 };
  const b = { x: 12, y: 0, r: 10 };
  assert.equal(separateCircles(a, b), true);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= 20 - 1e-6);
  assert.ok(Math.abs((a.x + b.x) / 2 - 6) < 1e-6);
});
