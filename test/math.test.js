import test from "node:test";
import assert from "node:assert/strict";
import {
  add,
  clamp,
  clampLength,
  dot,
  length,
  scale,
  subtract,
} from "../web/math.js";

test("the vector helpers read the ground plane only", () => {
  const lofted = { x: 3, y: 4, z: 9 };
  assert.deepEqual(add(lofted, lofted), { x: 6, y: 8 });
  assert.deepEqual(subtract(lofted, { x: 1, y: 1, z: 5 }), { x: 2, y: 3 });
  assert.deepEqual(scale(lofted, 2), { x: 6, y: 8 });
  assert.equal(length(lofted), 5);
  assert.equal(dot(lofted, { x: 1, y: 0, z: 100 }), 3);
});

test("a vector inside the cap is left as it stands", () => {
  const short = { x: 3, y: 4 };
  assert.equal(clampLength(short, 10), short);
});

test("a vector past the cap keeps its direction at the cap's length", () => {
  const shortened = clampLength({ x: 30, y: 40 }, 10);
  assert.ok(Math.abs(length(shortened) - 10) < 1e-9);
  assert.ok(Math.abs(shortened.x - 6) < 1e-9);
  assert.ok(Math.abs(shortened.y - 8) < 1e-9);
});

test("clamp holds a value between its bounds", () => {
  assert.equal(clamp(-5, -1, 1), -1);
  assert.equal(clamp(5, -1, 1), 1);
  assert.equal(clamp(0.5, -1, 1), 0.5);
});
