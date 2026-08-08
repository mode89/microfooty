import test from "node:test";
import assert from "node:assert/strict";
import { paintKit } from "../web/view/kits.js";

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
