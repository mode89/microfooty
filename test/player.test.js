import assert from "node:assert/strict";
import test from "node:test";
import { PLAYER, PLAYER_CARRYING } from "../web/tuning.js";
import {
  advancePlayer,
  createPlayer,
  directionFromInput,
  setHeadingAndSpeed,
  velocityOf,
} from "../web/world/player.js";
import { runAt } from "./helpers.js";

const TICK = 1 / 60;

function keys(...held) {
  return Object.fromEntries(
    ["up", "down", "left", "right"].map((key) => [key, held.includes(key)]),
  );
}

function run(player, direction, ticks, settings = PLAYER) {
  let current = player;
  for (let step = 0; step < ticks; step += 1)
    current = advancePlayer(
      setHeadingAndSpeed(current, direction, settings),
      TICK,
    );
  return current;
}

test("a diagonal run reaches the same top speed as a straight run", () => {
  const straight = run(createPlayer(), directionFromInput(keys("right")), 1);
  const diagonal = run(
    createPlayer(),
    directionFromInput(keys("right", "up")),
    1,
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

test("movement reaches full speed in one tick", () => {
  const player = run(createPlayer(), directionFromInput(keys("down")), 1);
  assert.equal(player.speed, PLAYER.maxSpeed);
  assert.ok(Math.abs(player.position.y - PLAYER.maxSpeed * TICK) < 1e-9);
});

test("releasing the keys stops in one tick and keeps the heading", () => {
  const running = run(createPlayer(), directionFromInput(keys("down")), 1);
  const stopped = run(running, directionFromInput(keys()), 1);
  assert.equal(stopped.speed, 0);
  assert.deepEqual(stopped.position, running.position);
  assert.deepEqual(stopped.heading, running.heading);
});

test("reversing changes the run in one tick", () => {
  const running = run(createPlayer(), directionFromInput(keys("down")), 1);
  const reversed = run(running, directionFromInput(keys("up")), 1);
  assert.equal(reversed.speed, PLAYER.maxSpeed);
  assert.deepEqual(reversed.heading, { x: 0, y: -1 });
  assert.ok(reversed.position.y < running.position.y);
});

test("a player carrying the ball runs slower than one chasing it", () => {
  const direction = directionFromInput(keys("down"));
  const carrying = run(createPlayer(), direction, 1, PLAYER_CARRYING).speed;
  assert.ok(carrying < run(createPlayer(), direction, 1, PLAYER).speed);
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
  const running = setHeadingAndSpeed(player, direction);
  const unbounded = advancePlayer(running, TICK, {
    minX: -10,
    maxX: 10,
    minY: -10,
    maxY: 10,
  });
  const bounded = advancePlayer(running, TICK, bounds);
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
    setHeadingAndSpeed(outward, directionFromInput(keys("right"))),
    TICK,
    bounds,
  );
  const reversed = advancePlayer(
    setHeadingAndSpeed(blocked, directionFromInput(keys("left"))),
    TICK,
    bounds,
  );
  assert.equal(blocked.speed, 0);
  assert.ok(reversed.position.x < bounds.maxX);
  assert.ok(velocityOf(reversed).x < 0);
});

test("the heading follows nonzero input immediately", () => {
  const player = run(
    createPlayer(),
    directionFromInput(keys("right", "up")),
    1,
  );
  assert.ok(player.heading.x > 0);
  assert.ok(player.heading.y < 0);
});

test("the run is the heading times the speed", () => {
  const running = run(createPlayer(), directionFromInput(keys("down")), 1);
  const velocity = velocityOf(running);
  assert.ok(
    Math.abs(Math.hypot(running.heading.x, running.heading.y) - 1) < 1e-9,
  );
  assert.ok(Math.abs(velocity.y - running.speed) < 1e-9);
  const standing = velocityOf(createPlayer());
  assert.equal(Math.hypot(standing.x, standing.y), 0);
});
