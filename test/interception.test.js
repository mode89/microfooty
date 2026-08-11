import test from "node:test";
import assert from "node:assert/strict";
import {
  predictBallPath,
  interception,
  soonerThan,
} from "../web/world/interception.js";
import { advanceBall } from "../web/world/ball.js";
import { BALL, DRIBBLE, INTERCEPTION, KICK, PLAYER } from "../web/tuning.js";
import { ballAt, playerAt } from "./helpers.js";

const STEP = INTERCEPTION.stepSeconds;

// A flight that lands a third of the way into the horizon, so the drop stays
// inside the walk when the horizon is retuned.
const DROP_SECONDS = INTERCEPTION.horizonSeconds / 3;
const DROP_HEIGHT = 0.5 * BALL.gravity * DROP_SECONDS ** 2;

// Inside a full-horizon sprint, so a resting ball would be reached and only
// the ball's flight keeps it out of reach.
const LEFT_BEHIND =
  PLAYER.maxSpeed * INTERCEPTION.horizonSeconds * 0.9 + DRIBBLE.controlRadius;

test("the path walks the ball with the ball's own rules", () => {
  const ball = ballAt({ x: 0, y: 0 }, { x: 0, y: -8, z: 4 });
  const ballPath = predictBallPath(ball);

  let rolled = ball;
  for (let step = 1; step <= 5; step += 1) {
    rolled = advanceBall(rolled, STEP);
    assert.deepEqual(ballPath[step].position, rolled.position);
    assert.ok(Math.abs(ballPath[step].seconds - step * STEP) < 1e-9);
  }
});

test("the path reaches the horizon and starts where the ball stands", () => {
  const ball = ballAt({ x: 1, y: 2 }, { x: 0, y: -8, z: 0 });
  const ballPath = predictBallPath(ball);

  const end = ballPath[ballPath.length - 1].seconds;
  assert.deepEqual(ballPath[0], { position: ball.position, seconds: 0 });
  assert.ok(end <= INTERCEPTION.horizonSeconds);
  assert.ok(end > INTERCEPTION.horizonSeconds - STEP);
});

test("a ball already at the player's feet is met at once", () => {
  const ballPath = predictBallPath(ballAt({ x: 0, y: 0 }));
  const met = interception(ballPath, playerAt({ x: 0, y: 0 }));
  assert.equal(met.seconds, 0);
});

test("meeting a resting ball takes the time the run takes", () => {
  const run = 10;
  const ballPath = predictBallPath(ballAt({ x: 0, y: 0 }));
  const met = interception(ballPath, playerAt({ x: 0, y: run }));
  const expected = (run - DRIBBLE.controlRadius) / PLAYER.maxSpeed;
  assert.ok(Math.abs(met.seconds - expected) <= STEP);
});

test("a chase aims ahead of a rolling ball, not at it", () => {
  const ball = ballAt({ x: 0, y: 0 }, { x: 0, y: -8, z: 0 });
  const met = interception(predictBallPath(ball), playerAt({ x: 0, y: -20 }));
  assert.ok(met.seconds > 0);
  assert.ok(met.position.y < ball.position.y);
});

test("a ball in flight is met where it drops, not under its shadow", () => {
  const ball = ballAt({ x: 0, y: 0, z: DROP_HEIGHT }, { x: 0, y: -10, z: 0 });
  const met = interception(predictBallPath(ball), playerAt({ x: 0, y: 0 }));
  assert.ok(met.position.z <= DRIBBLE.maxTouchHeight);
  assert.ok(met.seconds > 0);
});

test("a ball that outruns the player gives the end of its path", () => {
  // Struck flat at full power, straight away from a player left behind.
  const ball = ballAt({ x: 0, y: 0 }, { x: 0, y: -KICK.maximumPower, z: 0 });
  const ballPath = predictBallPath(ball);
  const met = interception(ballPath, playerAt({ x: 0, y: LEFT_BEHIND }));
  assert.equal(met.seconds, ballPath[ballPath.length - 1].seconds);
  assert.deepEqual(met.position, ballPath[ballPath.length - 1].position);
});

test("the same tick is ranked by the shorter run", () => {
  const near = { seconds: 1, gap: 2 };
  const far = { seconds: 1, gap: 9 };
  assert.ok(soonerThan(near, far));
  assert.ok(!soonerThan(far, near));
});

test("an earlier tick beats a shorter run", () => {
  assert.ok(soonerThan({ seconds: 0.5, gap: 20 }, { seconds: 1, gap: 1 }));
});
