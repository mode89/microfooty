import test from "node:test";
import assert from "node:assert/strict";
import { FORMATION_442, homePosition } from "../web/world/formation.js";
import {
  DOWN_THE_PITCH,
  PITCH_BOUNDS,
  UP_THE_PITCH,
} from "../web/world/pitch.js";

function shape(attackingDirection) {
  return FORMATION_442.map((role) => homePosition(role, attackingDirection));
}

test("a formation places eleven roles", () => {
  assert.equal(FORMATION_442.length, 11);
});

test("a formation names exactly one keeper", () => {
  assert.equal(FORMATION_442.filter((role) => role.keeper).length, 1);
});

test("every role stands in a place of its own, inside the pitch", () => {
  const places = shape(DOWN_THE_PITCH);
  const distinct = new Set(places.map(({ x, y }) => `${x} ${y}`));
  assert.equal(distinct.size, places.length);
  places.forEach(({ x, y }) => {
    assert.ok(x >= PITCH_BOUNDS.minX && x <= PITCH_BOUNDS.maxX);
    assert.ok(y >= PITCH_BOUNDS.minY && y <= PITCH_BOUNDS.maxY);
  });
});

test("the other shape is the first reflected about the halfway line", () => {
  assert.deepEqual(
    shape(UP_THE_PITCH),
    shape(DOWN_THE_PITCH).map(({ x, y }) => ({ x, y: -y })),
  );
});

test("a side keeps its keeper on its own half", () => {
  const keeper = FORMATION_442.find((role) => role.keeper);
  assert.ok(homePosition(keeper, DOWN_THE_PITCH).y < 0);
  assert.ok(homePosition(keeper, UP_THE_PITCH).y > 0);
});
