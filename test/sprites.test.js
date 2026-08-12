import test from "node:test";
import assert from "node:assert/strict";
import {
  keyColour,
  paintKit,
  sliceFrames,
  validatePlayerSheet,
} from "../web/view/sprites.js";

test("the player sheet has three square 8 x 8 frames", () => {
  assert.doesNotThrow(() => validatePlayerSheet(24, 8));
});

test("the player sheet rejects other frame dimensions", () => {
  assert.throws(() => validatePlayerSheet(18, 6), /must be 24 x 8 px/);
  assert.throws(() => validatePlayerSheet(24, 10), /must be 24 x 8 px/);
});

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

const SHIRT = [0, 112, 255, 255];
const STRIPE = [255, 255, 255, 255];
const SKIN = [255, 224, 144, 255];
const BOOTS = [1, 1, 1, 255];
const KEY = [255, 0, 255, 255];
const KIT = {
  name: "scarlet",
  shirt: { red: 206, green: 38, blue: 38 },
  stripe: { red: 250, green: 250, blue: 250 },
};
const PLAIN = { ...KIT, stripe: KIT.shirt };

test("a kit repaints the shirt and its stripes apart", () => {
  const painted = paintKit(new Uint8ClampedArray([...SHIRT, ...STRIPE]), KIT);
  assert.deepEqual([...painted], [206, 38, 38, 255, 250, 250, 250, 255]);
});

test("a kit of one colour wears a plain shirt", () => {
  const painted = paintKit(new Uint8ClampedArray([...SHIRT, ...STRIPE]), PLAIN);
  assert.deepEqual([...painted], [206, 38, 38, 255, 206, 38, 38, 255]);
});

test("a kit leaves skin, boots and the transparency key alone", () => {
  const pixels = new Uint8ClampedArray([...SKIN, ...BOOTS, ...KEY, ...SHIRT]);
  assert.deepEqual(
    [...paintKit(pixels, KIT)],
    [...SKIN, ...BOOTS, ...KEY, 206, 38, 38, 255],
  );
});

test("a kit leaves the shirt alpha alone", () => {
  const hidden = new Uint8ClampedArray([0, 112, 255, 0]);
  assert.deepEqual([...paintKit(hidden, KIT)], [206, 38, 38, 0]);
});
