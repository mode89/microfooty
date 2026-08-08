import assert from "node:assert/strict";
import test from "node:test";
import { PLAYER, PLAYER_CARRYING } from "../web/tuning.js";
import {
  advancePlayer,
  chooseFacing,
  createPlayer,
  directionFromInput,
} from "../web/world/player.js";

const TICK = 1 / 60;

function keys(...held) {
  return Object.fromEntries(
    ["up", "down", "left", "right"].map((key) => [key, held.includes(key)]),
  );
}

function speed(player) {
  return Math.hypot(player.velocity.x, player.velocity.y);
}

function run(player, direction, ticks) {
  let current = player;
  for (let step = 0; step < ticks; step += 1)
    current = advancePlayer(current, direction, TICK);
  return current;
}

function heading(degrees) {
  return {
    x: Math.cos((degrees * Math.PI) / 180),
    y: -Math.sin((degrees * Math.PI) / 180),
  };
}

test("a diagonal run reaches the same top speed as a straight run", () => {
  const straight = run(createPlayer(), directionFromInput(keys("right")), 120);
  const diagonal = run(
    createPlayer(),
    directionFromInput(keys("right", "up")),
    120,
  );
  assert.ok(Math.abs(speed(straight) - PLAYER.maxSpeed) < 1e-9);
  assert.ok(Math.abs(speed(diagonal) - PLAYER.maxSpeed) < 1e-9);
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
  assert.ok(
    Math.abs(speed(player) - PLAYER.acceleration * ticks * TICK) < 1e-9,
  );
});

test("releasing the keys brings the player to a complete stop", () => {
  const running = run(createPlayer(), directionFromInput(keys("down")), 120);
  const ticksToStop = Math.ceil(PLAYER.maxSpeed / PLAYER.braking / TICK);
  const stopped = run(running, directionFromInput(keys()), ticksToStop);
  assert.equal(speed(stopped), 0);
  assert.ok(stopped.position.y > running.position.y);
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
    return speed(player);
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
    velocity: { x: PLAYER.maxSpeed, y: 3 },
    facing: "right",
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
  assert.equal(bounded.velocity.x, 0);
  assert.equal(bounded.position.y, unbounded.position.y);
  assert.equal(bounded.velocity.y, unbounded.velocity.y);
});

test("a player at the boundary can reverse inward immediately", () => {
  const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const outward = {
    position: { x: bounds.maxX, y: 0 },
    velocity: { x: PLAYER.maxSpeed, y: 0 },
    facing: "right",
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
  assert.equal(blocked.velocity.x, 0);
  assert.ok(reversed.position.x < bounds.maxX);
  assert.ok(reversed.velocity.x < 0);
});

test("every one of the eight directions picks a facing", () => {
  const expected = [
    [keys("up"), "up"],
    [keys("down"), "down"],
    [keys("left"), "left"],
    [keys("right"), "right"],
    [keys("up", "left"), "up"],
    [keys("up", "right"), "up"],
    [keys("down", "left"), "left"],
    [keys("down", "right"), "right"],
  ];
  expected.forEach(([held, facing]) =>
    assert.equal(
      chooseFacing(facing === "down" ? "up" : "down", directionFromInput(held)),
      facing,
    ),
  );
});

test("an upward diagonal picks up whatever the player faces now", () => {
  const upRight = directionFromInput(keys("up", "right"));
  ["up", "down", "left", "right"].forEach((current) =>
    assert.equal(chooseFacing(current, upRight), "up"),
  );
});

test("a downward diagonal picks the side facing whatever the player faces now", () => {
  const downRight = directionFromInput(keys("down", "right"));
  ["up", "down", "left", "right"].forEach((current) =>
    assert.equal(chooseFacing(current, downRight), "right"),
  );
});

test("a direction hovering on a boundary does not flicker", () => {
  const inside = [38, 39, 40];
  ["up", "right"].forEach((current) => {
    const facings = inside.map((degrees) =>
      chooseFacing(current, heading(degrees)),
    );
    assert.deepEqual(
      facings,
      facings.map(() => current),
    );
  });
});

test("a direction well past the boundary changes the facing", () => {
  assert.equal(chooseFacing("right", heading(50)), "up");
  assert.equal(chooseFacing("up", heading(30)), "right");
});

test("no direction keeps the current facing", () => {
  assert.equal(chooseFacing("left", { x: 0, y: 0 }), "left");
});
