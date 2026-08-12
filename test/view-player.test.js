import test from "node:test";
import assert from "node:assert/strict";
import { spriteFrame } from "../web/view/player.js";

function heading(degrees) {
  return {
    x: Math.cos((degrees * Math.PI) / 180),
    y: -Math.sin((degrees * Math.PI) / 180),
  };
}

test("each of the eight headings picks its frame", () => {
  const expected = [
    [heading(90), "up"],
    [heading(270), "down"],
    [heading(180), "left"],
    [heading(0), "right"],
    [heading(135), "up"],
    [heading(45), "up"],
    [heading(225), "left"],
    [heading(315), "right"],
  ];
  expected.forEach(([direction, frame]) =>
    assert.equal(spriteFrame(direction), frame),
  );
});

test("the up frame wins the diagonals it is favoured for", () => {
  assert.equal(spriteFrame(heading(30)), "right");
  assert.equal(spriteFrame(heading(50)), "up");
});
