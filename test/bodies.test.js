import test from "node:test";
import assert from "node:assert/strict";
import { partBodies } from "../web/world/bodies.js";
import { createPlayer } from "../web/world/player.js";
import { PITCH_BOUNDS } from "../web/world/pitch.js";
import { BODY } from "../web/tuning.js";

const TICK = 1 / 60;

function standing(...positions) {
  return positions.map((position) => createPlayer(position));
}

function gap([first, second]) {
  return Math.hypot(
    second.position.x - first.position.x,
    second.position.y - first.position.y,
  );
}

// What one body gives up in a tick for a single neighbour that close.
function share(overlap, seconds = TICK) {
  return ((BODY.diameter - overlap) / 2) * BODY.pushRate * seconds;
}

function push(players, ticks) {
  let current = players;
  for (let tick = 0; tick < ticks; tick += 1)
    current = partBodies(current, TICK);
  return current;
}

test("two overlapping players are pushed apart by equal and opposite amounts", () => {
  const before = standing({ x: -0.2, y: 3 }, { x: 0.2, y: 3 });
  const after = partBodies(before, TICK);
  assert.ok(Math.abs(after[0].position.x - (-0.2 - share(0.4))) < 1e-9);
  assert.equal(after[0].position.x + 0.2, -(after[1].position.x - 0.2));
  assert.equal(after[0].position.y, 3);
  assert.equal(after[1].position.y, 3);
});

test("the push stops once they stand a body apart", () => {
  const parted = push(standing({ x: -0.1, y: 0 }, { x: 0.1, y: 0 }), 600);
  assert.ok(Math.abs(gap(parted) - BODY.diameter) < 1e-6);
  assert.deepEqual(partBodies(parted, TICK)[0].position, parted[0].position);
});

test("the push reaches just inside a body apart and no further", () => {
  const touching = standing({ x: 0, y: 0 }, { x: BODY.diameter * 0.99, y: 0 });
  assert.ok(gap(partBodies(touching, TICK)) > gap(touching));

  const clear = standing({ x: 0, y: 0 }, { x: BODY.diameter * 1.01, y: 0 });
  assert.deepEqual(partBodies(clear, TICK), clear);
});

test("a body in a crowd takes the push of every neighbour", () => {
  const row = standing({ x: -0.2, y: 0 }, { x: 0, y: 0 }, { x: 0.2, y: 0 });
  const after = partBodies(row, TICK);
  const bothNeighbours = share(0.2) + share(0.4);

  assert.ok(Math.abs(after[0].position.x - (-0.2 - bothNeighbours)) < 1e-9);
  assert.ok(Math.abs(after[2].position.x - (0.2 + bothNeighbours)) < 1e-9);
  assert.deepEqual(after[1].position, row[1].position);
});

test("a long tick parts bodies without throwing them apart", () => {
  const parted = partBodies(standing({ x: -0.4, y: 0 }, { x: 0.4, y: 0 }), 1);
  assert.ok(Math.abs(gap(parted) - BODY.diameter) < 1e-9);
});

test("the push leaves the run untouched", () => {
  const running = standing({ x: -0.2, y: 0 }, { x: 0.2, y: 0 }).map(
    (player) => ({ ...player, heading: { x: 0.6, y: -0.8 }, speed: 3 }),
  );
  partBodies(running, TICK).forEach((player, index) => {
    assert.deepEqual(player.heading, running[index].heading);
    assert.equal(player.speed, running[index].speed);
  });
});

test("players on the very same spot part the same way every run", () => {
  const stacked = standing({ x: 5, y: 5 }, { x: 5, y: 5 });
  const parted = push(stacked, 600);
  assert.ok(Math.abs(gap(parted) - BODY.diameter) < 1e-6);
  assert.deepEqual(push(stacked, 600), parted);
});

test("the push keeps a body on the pitch", () => {
  const corner = { x: PITCH_BOUNDS.maxX, y: PITCH_BOUNDS.maxY };
  const parted = push(standing(corner, { x: corner.x - 0.1, y: corner.y }), 60);
  parted.forEach(({ position }) => {
    assert.ok(position.x <= PITCH_BOUNDS.maxX);
    assert.ok(position.y <= PITCH_BOUNDS.maxY);
  });
});
