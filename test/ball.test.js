import test from "node:test";
import assert from "node:assert/strict";
import { BALL } from "../web/tuning.js";
import { advanceBall, createBall, launchBall } from "../web/world/ball.js";

const TICK = 1 / 60;

function advanceFor(ball, seconds, tick = TICK) {
  let current = ball;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += tick)
    current = advanceBall(current, tick);
  return current;
}

function assertBallClose(actual, expected, tolerance = 1e-9) {
  ["x", "y", "z"].forEach((axis) => {
    assert.ok(
      Math.abs(actual.position[axis] - expected.position[axis]) < tolerance,
      `position.${axis}`,
    );
    assert.ok(
      Math.abs(actual.velocity[axis] - expected.velocity[axis]) < tolerance,
      `velocity.${axis}`,
    );
  });
}

test("a ball at rest stays at rest through a coarse step", () => {
  const ball = createBall({ x: 3, y: -7 });
  const after = advanceBall(ball, 5);
  assert.deepEqual(after.position, ball.position);
  assert.deepEqual(after.velocity, { x: 0, y: 0, z: 0 });
});

test("a bounce reverses the vertical speed and scales it by restitution", () => {
  const falling = {
    position: {
      x: 0,
      y: 0,
      z: BALL.radius + 5 * TICK + 0.5 * BALL.gravity * TICK * TICK,
    },
    velocity: { x: 0, y: 0, z: -5 },
  };
  const after = advanceBall(falling, TICK);
  const impact = 5 + BALL.gravity * TICK;
  assert.equal(after.position.z, BALL.radius);
  assert.ok(Math.abs(after.velocity.z - impact * BALL.restitution) < 1e-9);
});

test("each bounce peaks lower than the one before", () => {
  let ball = launchBall(createBall(), 0, Math.PI / 3, 20);
  const peaks = [];
  for (let step = 0; step < 60 * 12; step += 1) {
    const next = advanceBall(ball, TICK);
    if (ball.velocity.z > 0 && next.velocity.z <= 0)
      peaks.push(ball.position.z);
    ball = next;
  }
  assert.ok(peaks.length >= 3);
  peaks.forEach((peak, index) => {
    if (index > 0) assert.ok(peak < peaks[index - 1]);
  });
});

test("a rolling ball stops in finite time and does not creep", () => {
  const rolling = {
    position: { x: 0, y: 0, z: BALL.radius },
    velocity: { x: 6, y: 0, z: 0 },
  };
  const stopped = advanceFor(rolling, 5);
  assert.deepEqual(stopped.velocity, { x: 0, y: 0, z: 0 });
  const later = advanceFor(stopped, 5);
  assert.deepEqual(later.position, stopped.position);
});

test("air drag slows the ball while it flies", () => {
  const flying = {
    position: { x: 0, y: 0, z: 8 },
    velocity: { x: 12, y: 0, z: 0 },
  };
  const after = advanceFor(flying, 1);
  assert.ok(after.velocity.x < 12);
  assert.ok(after.velocity.x > 10);
});

test("zero air drag keeps horizontal flight finite and unchanged", () => {
  const flying = {
    position: { x: 0, y: 0, z: 8 },
    velocity: { x: 12, y: -4, z: 0 },
  };
  const after = advanceBall(flying, 0.5, { ...BALL, airDrag: 0 });
  assert.equal(after.position.x, 6);
  assert.equal(after.position.y, -2);
  assert.equal(after.velocity.x, 12);
  assert.equal(after.velocity.y, -4);
});

test("the flight path does not change when the ticks get smaller", () => {
  const flying = {
    position: { x: 0, y: 0, z: 8 },
    velocity: { x: 9, y: -4, z: 2 },
  };
  const coarse = advanceFor(flying, 0.5, 0.5);
  const fine = advanceFor(flying, 0.5, 0.5 / 64);
  ["x", "y", "z"].forEach((axis) => {
    assert.ok(Math.abs(coarse.position[axis] - fine.position[axis]) < 1e-9);
    assert.ok(Math.abs(coarse.velocity[axis] - fine.velocity[axis]) < 1e-9);
  });
});

test("landing into a roll is unchanged when the duration is split", () => {
  const landingSeconds = 0.05;
  const falling = {
    position: {
      x: 0,
      y: 0,
      z:
        BALL.radius +
        0.1 * landingSeconds +
        0.5 * BALL.gravity * landingSeconds * landingSeconds,
    },
    velocity: { x: 4, y: -1, z: -0.1 },
  };
  const coarse = advanceBall(falling, 0.4);
  const split = advanceBall(advanceBall(falling, 0.03), 0.37);
  assertBallClose(coarse, split);
  assert.equal(coarse.position.z, BALL.radius);
  assert.equal(coarse.velocity.z, 0);
});

test("a bounce is unchanged when the duration is split", () => {
  const landingSeconds = 0.1;
  const falling = {
    position: {
      x: 0,
      y: 0,
      z:
        BALL.radius +
        3 * landingSeconds +
        0.5 * BALL.gravity * landingSeconds * landingSeconds,
    },
    velocity: { x: 8, y: 2, z: -3 },
  };
  const coarse = advanceBall(falling, 0.3);
  const split = advanceBall(advanceBall(falling, 0.06), 0.24);
  assertBallClose(coarse, split);
});

test("a rolling stop is unchanged when the duration is split", () => {
  const rolling = {
    position: { x: 0, y: 0, z: BALL.radius },
    velocity: { x: 0.4, y: 0, z: 0 },
  };
  const coarse = advanceBall(rolling, 0.5);
  const split = advanceBall(advanceBall(rolling, 0.05), 0.45);
  assertBallClose(coarse, split);
});

test("a launch splits the power over heading and elevation", () => {
  const launched = launchBall(createBall(), 0, Math.PI / 6, 10);
  assert.ok(Math.abs(launched.velocity.x - 10 * Math.cos(Math.PI / 6)) < 1e-9);
  assert.ok(Math.abs(launched.velocity.y) < 1e-9);
  assert.ok(Math.abs(launched.velocity.z - 5) < 1e-9);
});
