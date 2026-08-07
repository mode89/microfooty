import test from "node:test";
import assert from "node:assert/strict";
import { keyColour, sliceFrames } from "../web/view/sprites.js";

test("the slicer cuts a sheet into equal frames left to right", () => {
  assert.deepEqual(sliceFrames(24, 8, 3), [
    { x: 0, y: 0, width: 8, height: 8 },
    { x: 8, y: 0, width: 8, height: 8 },
    { x: 16, y: 0, width: 8, height: 8 },
  ]);
});

test("the slicer keeps the full sheet height in every frame", () => {
  assert.deepEqual(sliceFrames(6, 5, 2), [
    { x: 0, y: 0, width: 3, height: 5 },
    { x: 3, y: 0, width: 3, height: 5 },
  ]);
});

test("the slicer rejects a sheet that does not split into whole frames", () => {
  assert.throws(() => sliceFrames(25, 8, 3), /does not split/);
});

test("the colour key makes the background pixels transparent", () => {
  const magenta = [255, 0, 255, 255];
  const white = [255, 255, 255, 255];
  const keyed = keyColour(new Uint8ClampedArray([...magenta, ...white]));
  assert.deepEqual([...keyed], [255, 0, 255, 0, ...white]);
});

test("the colour key leaves every other colour untouched", () => {
  const pixels = new Uint8ClampedArray([254, 0, 255, 255, 255, 1, 255, 255]);
  assert.deepEqual([...keyColour(pixels)], [...pixels]);
});
