import test from "node:test";
import assert from "node:assert/strict";
import { directionToward } from "../web/ai/steering.js";
import { advancePlayer, createPlayer } from "../web/world/player.js";
import { STEERING } from "../web/tuning.js";

const TICK = 1 / 60;

function runTo(player, target, ticks) {
  let current = player;
  const track = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    current = advancePlayer(
      current,
      directionToward(current.position, target),
      TICK,
    );
    track.push(current);
  }
  return track;
}

function distanceTo(position, target) {
  return Math.hypot(target.x - position.x, target.y - position.y);
}

test("steering points at the target", () => {
  const direction = directionToward({ x: 2, y: -3 }, { x: 12, y: -13 });
  assert.ok(Math.abs(direction.x - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(direction.y + Math.SQRT1_2) < 1e-9);
});

test("steering eases off as the target nears", () => {
  const far = directionToward(
    { x: 0, y: 0 },
    { x: 0, y: STEERING.slowingDistance * 3 },
  );
  const near = directionToward(
    { x: 0, y: 0 },
    { x: 0, y: STEERING.slowingDistance / 2 },
  );
  assert.equal(Math.hypot(far.x, far.y), 1);
  assert.ok(Math.abs(Math.hypot(near.x, near.y) - 0.5) < 1e-9);
});

test("a player already inside the band does not move", () => {
  const target = { x: 4, y: 6 };
  const standing = createPlayer({ x: 4, y: 6 + STEERING.arrivalRadius * 0.9 });
  const track = runTo(standing, target, 120);
  assert.deepEqual(track.at(-1).position, standing.position);
});

test("a long run settles inside the band without oscillation", () => {
  const target = { x: 0, y: 0 };
  const track = runTo(createPlayer({ x: 0, y: 30 }), target, 600);
  const settled = track.at(-1);

  assert.ok(distanceTo(settled.position, target) <= STEERING.arrivalRadius);
  assert.ok(settled.speed < 0.01);
  assert.ok(
    track.every(({ position }) => position.y >= -STEERING.arrivalRadius),
    "the run passed the target and had to turn back",
  );
  track
    .slice(-60)
    .forEach(({ position }) =>
      assert.ok(distanceTo(position, target) <= STEERING.arrivalRadius),
    );
});
