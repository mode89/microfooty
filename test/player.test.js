import assert from "node:assert/strict";
import test from "node:test";
import {
  advancePlayer,
  chooseFacing,
  createPlayer,
  directionFromInput,
  PLAYER,
} from "../web/world/player.js";

const TICK = 1 / 60;

const keys = (...held) =>
  Object.fromEntries(
    ["up", "down", "left", "right"].map((key) => [key, held.includes(key)]),
  );

const speed = (player) => Math.hypot(player.velocity.x, player.velocity.y);

const run = (player, direction, ticks) => {
  let current = player;
  for (let step = 0; step < ticks; step += 1)
    current = advancePlayer(current, direction, TICK);
  return current;
};

const heading = (degrees) => ({
  x: Math.cos((degrees * Math.PI) / 180),
  y: -Math.sin((degrees * Math.PI) / 180),
});

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

test("the player stays inside the pitch", () => {
  const player = run(createPlayer(), directionFromInput(keys("down")), 60 * 30);
  assert.ok(player.position.y <= 52.5);
});

test("every one of the eight directions picks a facing", () => {
  const expected = [
    [keys("up"), "up"],
    [keys("down"), "down"],
    [keys("left"), "left"],
    [keys("right"), "right"],
    [keys("up", "left"), "left"],
    [keys("up", "right"), "right"],
    [keys("down", "left"), "left"],
    [keys("down", "right"), "right"],
  ];
  expected.forEach(([held, facing]) =>
    assert.equal(
      chooseFacing(facing === "up" ? "down" : "up", directionFromInput(held)),
      facing,
    ),
  );
});

test("a diagonal picks the side facing whatever the player faces now", () => {
  const upRight = directionFromInput(keys("up", "right"));
  ["up", "down", "left", "right"].forEach((current) =>
    assert.equal(chooseFacing(current, upRight), "right"),
  );
});

test("a direction hovering on a boundary does not flicker", () => {
  const inside = [50, 51, 52, 53];
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
  assert.equal(chooseFacing("right", heading(60)), "up");
  assert.equal(chooseFacing("up", heading(40)), "right");
});

test("no direction keeps the current facing", () => {
  assert.equal(chooseFacing("left", { x: 0, y: 0 }), "left");
});
