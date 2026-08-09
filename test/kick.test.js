import assert from "node:assert/strict";
import test from "node:test";
import { BALL, DRIBBLE, KICK, PLAYER } from "../web/tuning.js";
import {
  advanceKick,
  advanceTouchTimer,
  createControl,
  touchableBallGap,
  touchBall,
} from "../web/world/kick.js";
import { createPlayer, setRun } from "../web/world/player.js";

const TICK = 1 / 60;
const DOWN_THE_PITCH = Object.freeze({ x: 0, y: 1 });
const NEAR_BALL = DRIBBLE.controlRadius * 0.3;
const SHORT_HOLD = KICK.maximumCharge / 2;

function runningPlayer(speed = PLAYER.maxSpeed) {
  return { position: { x: 0, y: 0 }, heading: DOWN_THE_PITCH, speed };
}

function ballAhead(distance, height = BALL.radius) {
  return {
    position: { x: 0, y: distance, z: height },
    velocity: { x: 0, y: 0, z: 0 },
  };
}

function ballBeside(distance) {
  return {
    position: { x: distance, y: 0, z: BALL.radius },
    velocity: { x: 0, y: 0, z: 0 },
  };
}

function touch(
  player,
  ball,
  direction = player.heading,
  control = createControl(),
) {
  return touchBall(control, player, ball, direction);
}

function speed(body) {
  return Math.hypot(body.velocity.x, body.velocity.y);
}

const LAST_SLICE = 1e-9;

function holdFor(player, ball, heldSeconds, control = createControl()) {
  let held = { control, ball };
  for (let left = heldSeconds; left > LAST_SLICE; left -= TICK)
    held = advanceKick(
      held.control,
      player,
      held.ball,
      true,
      Math.min(TICK, left),
    );
  return held;
}

function holdThenRelease(player, ball, heldSeconds, control) {
  const held = holdFor(player, ball, heldSeconds, control);
  return advanceKick(held.control, player, held.ball, false, TICK);
}

function powerOf(ball) {
  return Math.hypot(speed(ball), ball.velocity.z);
}

function elevationOf(ball) {
  return Math.atan2(
    ball.velocity.z,
    Math.hypot(ball.velocity.x, ball.velocity.y),
  );
}

const CHARGE_PER_TICK = TICK / KICK.maximumCharge;

test("a touch uses the exact velocity needed to reach its target", () => {
  const player = runningPlayer();
  const gap = DRIBBLE.idealLead / 2;
  const after = touch(player, ballAhead(gap));
  const targetAtNextTouch =
    player.speed * DRIBBLE.touchPeriod + DRIBBLE.idealLead;
  assert.ok(
    Math.abs(
      after.ball.velocity.y - (targetAtNextTouch - gap) / DRIBBLE.touchPeriod,
    ) < 1e-9,
  );
  assert.equal(after.ball.velocity.x, 0);
  assert.equal(after.control.touchTimer, DRIBBLE.touchPeriod);
});

test("a touch at the ideal lead matches the ball to the run", () => {
  const player = runningPlayer();
  const after = touch(player, ballAhead(DRIBBLE.idealLead));
  assert.ok(Math.abs(speed(after.ball) - player.speed) < 1e-9);
  assert.ok(after.ball.velocity.y > 0);
});

test("a touch aims a ball at the player's side back in front", () => {
  const distance = DRIBBLE.controlRadius * 0.9;
  const after = touch(runningPlayer(), ballBeside(distance));
  assert.ok(
    Math.abs(after.ball.velocity.x + distance / DRIBBLE.touchPeriod) < 1e-9,
  );
  assert.ok(after.ball.velocity.y > 0);
});

test("a nonzero touch direction overrides the player's old heading", () => {
  const after = touch(runningPlayer(), ballAhead(NEAR_BALL), { x: 1, y: 0 });
  assert.ok(after.ball.velocity.x > 0);
  assert.ok(after.ball.velocity.y < 0);
});

test("zero touch direction uses the player's last heading", () => {
  const after = touch(runningPlayer(0), ballAhead(NEAR_BALL), { x: 0, y: 0 });
  assert.ok(after.ball.velocity.y > 0);
  assert.equal(after.ball.velocity.x, 0);
});

test("an immediate run uses full player speed in its touch", () => {
  const player = setRun(createPlayer(), DOWN_THE_PITCH);
  const after = touch(player, ballAhead(NEAR_BALL));
  const targetAtNextTouch =
    player.position.y + player.speed * DRIBBLE.touchPeriod + DRIBBLE.idealLead;
  assert.ok(
    Math.abs(
      after.ball.velocity.y -
        (targetAtNextTouch - NEAR_BALL) / DRIBBLE.touchPeriod,
    ) < 1e-9,
  );
});

test("a touch leaves ball height and vertical speed alone", () => {
  const rising = {
    position: { x: 0, y: DRIBBLE.controlRadius, z: 0.3 },
    velocity: { x: 0, y: 0, z: 1.5 },
  };
  const after = touch(runningPlayer(), rising);
  assert.equal(after.ball.position.z, rising.position.z);
  assert.equal(after.ball.velocity.z, rising.velocity.z);
});

test("a ball outside the control radius is not touchable", () => {
  const ball = ballAhead(DRIBBLE.controlRadius * 1.01);
  assert.equal(touchableBallGap(createControl(), runningPlayer(), ball), null);
});

test("a ball above the height limit is not touchable", () => {
  const ball = ballAhead(DRIBBLE.controlRadius, DRIBBLE.maxTouchHeight * 1.01);
  assert.equal(touchableBallGap(createControl(), runningPlayer(), ball), null);
});

test("a standing player touches along their last heading", () => {
  const gap = NEAR_BALL;
  const after = touch(runningPlayer(0), ballAhead(gap));
  const expected = (DRIBBLE.idealLead - gap) / DRIBBLE.touchPeriod;
  assert.ok(Math.abs(after.ball.velocity.y - expected) < 1e-9);
});

test("the touch timer blocks and then allows another touch", () => {
  const player = runningPlayer();
  const ball = ballAhead(DRIBBLE.idealLead);
  const touched = touch(player, ball);
  const cooling = advanceTouchTimer(touched.control, TICK);
  assert.equal(touchableBallGap(cooling, player, ball), null);
  assert.ok(cooling.touchTimer < touched.control.touchTimer);

  const ready = advanceTouchTimer(touched.control, DRIBBLE.touchPeriod);
  assert.equal(touchableBallGap(ready, player, ball), DRIBBLE.idealLead);
});

test("regular touches come at 3 Hz", () => {
  assert.equal(DRIBBLE.touchPeriod, 1 / 3);
  const player = runningPlayer();
  const ball = ballAhead(DRIBBLE.idealLead);
  let control = touch(player, ball).control;
  const touchTicks = [];
  for (let step = 1; step <= 300; step += 1) {
    control = advanceTouchTimer(control, TICK);
    if (touchableBallGap(control, player, ball) === null) continue;
    control = touch(player, ball, player.heading, control).control;
    touchTicks.push(step);
  }
  const intervals = touchTicks
    .slice(1)
    .map((step, index) => step - touchTicks[index]);
  assert.ok(intervals.length > 10, "too few touches to judge the cadence");
  assert.deepEqual(
    intervals,
    intervals.map(() => Math.round(DRIBBLE.touchPeriod / TICK)),
  );
});

test("a changed heading alone does not bypass the touch timer", () => {
  const player = runningPlayer();
  const ball = ballAhead(DRIBBLE.idealLead);
  const control = touch(player, ball).control;
  const turnedPlayer = { ...player, heading: { x: 1, y: 0 } };
  assert.equal(touchableBallGap(control, turnedPlayer, ball), null);
});

test("a touch replaces a fast ball's horizontal velocity", () => {
  const resting = ballAhead(NEAR_BALL);
  const incoming = {
    ...resting,
    velocity: { x: -20, y: 15, z: 0 },
  };
  const expected = touch(runningPlayer(), resting);
  const received = touch(runningPlayer(), incoming);
  assert.deepEqual(received.ball.velocity, expected.ball.velocity);
});

test("the charge builds while held and stops at the maximum", () => {
  const player = runningPlayer();
  const ball = ballAhead(DRIBBLE.idealLead);
  function hold(control, seconds) {
    return advanceKick(control, player, ball, true, seconds).control;
  }

  const oneTick = hold(createControl(), TICK);
  assert.ok(Math.abs(oneTick.charge - TICK) < 1e-9);
  const twoTicks = hold(oneTick, TICK);
  assert.ok(Math.abs(twoTicks.charge - 2 * TICK) < 1e-9);
  const overheld = hold(twoTicks, KICK.maximumCharge);
  assert.equal(overheld.charge, KICK.maximumCharge);
});

test("a tap kicks at minimum power and a low angle", () => {
  const after = holdThenRelease(runningPlayer(), ballAhead(NEAR_BALL), TICK);
  assert.ok(after.didKick);
  assert.ok(powerOf(after.ball) >= KICK.minimumPower);
  assert.ok(
    powerOf(after.ball) <=
      KICK.minimumPower +
        CHARGE_PER_TICK * (KICK.maximumPower - KICK.minimumPower),
  );
  assert.ok(elevationOf(after.ball) <= CHARGE_PER_TICK * KICK.maximumElevation);
  assert.equal(after.control.charge, 0);
});

test("holding the button charges without changing the ball", () => {
  const resting = ballAhead(NEAR_BALL);
  const held = holdFor(runningPlayer(), resting, KICK.maximumCharge);
  assert.deepEqual(held.ball, resting);
  assert.ok(!held.didKick);
  assert.ok(Math.abs(held.control.charge - KICK.maximumCharge) < 1e-9);
});

test("a full hold kicks at maximum power and angle", () => {
  const after = holdThenRelease(
    runningPlayer(),
    ballAhead(NEAR_BALL),
    KICK.maximumCharge,
  );
  assert.ok(Math.abs(powerOf(after.ball) - KICK.maximumPower) < 1e-9);
  assert.ok(Math.abs(elevationOf(after.ball) - KICK.maximumElevation) < 1e-9);
});

test("power and launch angle rise with hold time", () => {
  const holds = [
    TICK,
    ...[0.25, 0.5, 0.75, 1].map((part) => part * KICK.maximumCharge),
  ];
  const kicks = holds.map(
    (held) => holdThenRelease(runningPlayer(), ballAhead(NEAR_BALL), held).ball,
  );
  for (let step = 1; step < kicks.length; step += 1) {
    const [before, after] = [kicks[step - 1], kicks[step]];
    assert.ok(powerOf(after) > powerOf(before));
    assert.ok(elevationOf(after) > elevationOf(before));
  }
});

test("a release out of kicking range leaves the ball alone", () => {
  for (const ball of [
    ballAhead(KICK.range * 1.01),
    ballAhead(NEAR_BALL, KICK.maximumHeight * 1.01),
  ]) {
    const after = holdThenRelease(runningPlayer(), ball, SHORT_HOLD);
    assert.deepEqual(after.ball, ball);
    assert.ok(!after.didKick);
  }
});

test("a missed release spends its charge", () => {
  const player = runningPlayer();
  const missed = holdThenRelease(
    player,
    ballAhead(KICK.range * 1.01),
    SHORT_HOLD,
  );
  assert.equal(missed.control.charge, 0);
  const next = advanceKick(
    missed.control,
    player,
    ballAhead(NEAR_BALL),
    false,
    TICK,
  );
  assert.ok(!next.didKick);
});

test("a stopped player kicks along their last heading", () => {
  const after = holdThenRelease(
    runningPlayer(0),
    ballAhead(NEAR_BALL),
    SHORT_HOLD,
  );
  assert.ok(after.ball.velocity.y > 0);
  assert.ok(Math.abs(after.ball.velocity.x) < 1e-9);
});

test("a successful kick starts the touch timer", () => {
  const kicked = holdThenRelease(runningPlayer(), ballAhead(NEAR_BALL), TICK);
  assert.ok(kicked.didKick);
  assert.equal(kicked.control.touchTimer, KICK.touchDelay);
  assert.equal(
    touchableBallGap(kicked.control, runningPlayer(), kicked.ball),
    null,
  );
});
