import assert from "node:assert/strict";
import test from "node:test";
import { PLAYER, PLAYER_CARRYING } from "../web/tuning.js";
import {
  advancePlayer,
  createPlayer,
  directionFromInput,
  velocityOf,
} from "../web/world/player.js";
import { runAt } from "./helpers.js";

const TICK = 1 / 60;

function keys(...held) {
  return Object.fromEntries(
    ["up", "down", "left", "right"].map((key) => [key, held.includes(key)]),
  );
}

function run(player, direction, ticks) {
  let current = player;
  for (let step = 0; step < ticks; step += 1)
    current = advancePlayer(current, direction, TICK);
  return current;
}

test("a diagonal run reaches the same top speed as a straight run", () => {
  const straight = run(createPlayer(), directionFromInput(keys("right")), 120);
  const diagonal = run(
    createPlayer(),
    directionFromInput(keys("right", "up")),
    120,
  );
  assert.ok(Math.abs(straight.speed - PLAYER.maxSpeed) < 1e-9);
  assert.ok(Math.abs(diagonal.speed - PLAYER.maxSpeed) < 1e-9);
});

test("no keys held gives a zero direction", () => {
  assert.deepEqual(directionFromInput(keys()), { x: 0, y: 0 });
});

test("opposite keys cancel", () => {
  assert.deepEqual(directionFromInput(keys("left", "right")), { x: 0, y: 0 });
});

test("acceleration reaches the expected speed after a known time", () => {
  const ticks = 6;
  const player = run(createPlayer(), directionFromInput(keys("down")), ticks);
  assert.ok(Math.abs(player.speed - PLAYER.acceleration * ticks * TICK) < 1e-9);
});

test("releasing the keys brings the player to a complete stop", () => {
  const running = run(createPlayer(), directionFromInput(keys("down")), 120);
  const ticksToStop = Math.ceil(PLAYER.maxSpeed / PLAYER.braking / TICK);
  const stopped = run(running, directionFromInput(keys()), ticksToStop);
  assert.equal(stopped.speed, 0);
  assert.ok(stopped.position.y > running.position.y);
  assert.ok(
    Math.hypot(
      stopped.heading.x - running.heading.x,
      stopped.heading.y - running.heading.y,
    ) < 1e-9,
  );
});

test("turning back against the run sheds speed at the braking rate", () => {
  const running = run(createPlayer(), directionFromInput(keys("down")), 120);
  const turning = run(running, directionFromInput(keys("up")), 1);
  assert.ok(
    Math.abs(turning.speed - (PLAYER.maxSpeed - PLAYER.braking * TICK)) < 1e-9,
  );
});

test("a player carrying the ball runs slower than one chasing it", () => {
  function topSpeedAfter(settings, ticks) {
    let player = createPlayer();
    for (let step = 0; step < ticks; step += 1)
      player = advancePlayer(
        player,
        directionFromInput(keys("down")),
        TICK,
        settings,
      );
    return player.speed;
  }
  const carrying = topSpeedAfter(PLAYER_CARRYING, 120);
  assert.ok(carrying < topSpeedAfter(PLAYER, 120));
  assert.equal(carrying, PLAYER_CARRYING.maxSpeed);
});

test("the player stays inside the pitch", () => {
  const player = run(createPlayer(), directionFromInput(keys("down")), 60 * 30);
  assert.ok(player.position.y <= 52.5);
});

test("a boundary removes only the outward velocity", () => {
  const player = {
    position: { x: 1, y: 0 },
    ...runAt({ x: PLAYER.maxSpeed, y: 3 }),
  };
  const direction = directionFromInput(keys("right"));
  const bounds = { minX: -1, maxX: 1, minY: -10, maxY: 10 };
  const unbounded = advancePlayer(player, direction, TICK, PLAYER, {
    minX: -10,
    maxX: 10,
    minY: -10,
    maxY: 10,
  });
  const bounded = advancePlayer(player, direction, TICK, PLAYER, bounds);
  assert.equal(bounded.position.x, bounds.maxX);
  assert.equal(velocityOf(bounded).x, 0);
  assert.equal(bounded.position.y, unbounded.position.y);
  assert.ok(Math.abs(velocityOf(bounded).y - velocityOf(unbounded).y) < 1e-9);
});

test("a player at the boundary can reverse inward immediately", () => {
  const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const outward = {
    position: { x: bounds.maxX, y: 0 },
    ...runAt({ x: PLAYER.maxSpeed, y: 0 }),
  };
  const blocked = advancePlayer(
    outward,
    directionFromInput(keys("right")),
    TICK,
    PLAYER,
    bounds,
  );
  const reversed = advancePlayer(
    blocked,
    directionFromInput(keys("left")),
    TICK,
    PLAYER,
    bounds,
  );
  assert.equal(blocked.speed, 0);
  assert.ok(reversed.position.x < bounds.maxX);
  assert.ok(velocityOf(reversed).x < 0);
});

test("the heading follows the run, not the keys", () => {
  const running = run(createPlayer(), directionFromInput(keys("down")), 120);
  const turning = run(running, directionFromInput(keys("up")), 1);
  const reversed = run(running, directionFromInput(keys("up")), 60);
  assert.deepEqual(running.heading, { x: 0, y: 1 });
  assert.ok(turning.heading.y > 0);
  assert.ok(reversed.heading.y < 0);
});

test("the run is the heading times the speed", () => {
  const running = run(createPlayer(), directionFromInput(keys("down")), 20);
  const velocity = velocityOf(running);
  assert.ok(
    Math.abs(Math.hypot(running.heading.x, running.heading.y) - 1) < 1e-9,
  );
  assert.ok(Math.abs(velocity.y - running.speed) < 1e-9);
  const standing = velocityOf(createPlayer());
  assert.equal(Math.hypot(standing.x, standing.y), 0);
});
