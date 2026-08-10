import assert from "node:assert/strict";
import test from "node:test";
import { BALL, DRIBBLE, KICK, PLAYER, PLAYER_CARRYING } from "../web/tuning.js";
import { createBall } from "../web/world/ball.js";
import { advancePossession, createControl } from "../web/world/possession.js";
import { createPlayer } from "../web/world/player.js";

const TICK = 1 / 60;
const STILL = Object.freeze({ x: 0, y: 0 });
const DOWN_THE_PITCH = Object.freeze({ x: 0, y: 1 });
const UP_THE_PITCH = Object.freeze({ x: 0, y: -1 });
const RIGHT = Object.freeze({ x: 1, y: 0 });
const NEAR_BALL = DRIBBLE.controlRadius * 0.2;
const MID_RANGE = DRIBBLE.controlRadius * 0.5;
const FARTHER_BALL = DRIBBLE.controlRadius * 0.6;
const SHORT_HOLD = KICK.maximumCharge / 2;
const LAST_SLICE = 1e-9;

function playerAt(position, control = {}, heading = DOWN_THE_PITCH) {
  return {
    ...createPlayer(position, heading),
    control: { ...createControl(), ...control },
  };
}

function kickingPlayer(control = {}, heading = DOWN_THE_PITCH) {
  return playerAt(
    { x: 0, y: 0 },
    { touchTimer: KICK.maximumCharge * 2, ...control },
    heading,
  );
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

function play(
  players,
  {
    ball = createBall(),
    recentToucherIndex = null,
    directions = players.map(() => STILL),
    earlyToucherIndex = null,
    kickingPlayerIndex = 0,
    kickHeld = false,
    kickCharge = 0,
    seconds = TICK,
  } = {},
) {
  return advancePossession(
    { players, ball, recentToucherIndex, kickCharge },
    {
      directions,
      earlyToucherIndex,
      kickingPlayerIndex,
      kickHeld,
    },
    seconds,
  );
}

function continuePlay(state, options = {}) {
  return play(state.players, {
    ball: state.ball,
    recentToucherIndex: state.recentToucherIndex,
    kickCharge: state.kickCharge,
    ...options,
  });
}

function holdFor(players, ball, heldSeconds, options = {}) {
  let held = {
    players,
    ball,
    recentToucherIndex: null,
    kickCharge: 0,
  };
  for (let left = heldSeconds; left > LAST_SLICE; left -= TICK)
    held = continuePlay(held, {
      ...options,
      kickHeld: true,
      seconds: Math.min(TICK, left),
    });
  return held;
}

function holdThenRelease(players, ball, heldSeconds) {
  return continuePlay(holdFor(players, ball, heldSeconds));
}

function horizontalSpeed(ball) {
  return Math.hypot(ball.velocity.x, ball.velocity.y);
}

function powerOf(ball) {
  return Math.hypot(horizontalSpeed(ball), ball.velocity.z);
}

function elevationOf(ball) {
  return Math.atan2(ball.velocity.z, horizontalSpeed(ball));
}

function expectedTouchSpeed(playerSpeed, gap) {
  return (
    (playerSpeed * DRIBBLE.touchPeriod + DRIBBLE.idealLead - gap) /
    DRIBBLE.touchPeriod
  );
}

const CHARGE_PER_TICK = TICK / KICK.maximumCharge;

test("at most one player touches the ball", () => {
  const players = [
    playerAt({ x: -MID_RANGE, y: 0 }),
    playerAt({ x: NEAR_BALL, y: 0 }),
  ];

  const after = play(players);

  assert.equal(
    after.players.filter(
      (player) => player.control.touchTimer === DRIBBLE.touchPeriod,
    ).length,
    1,
  );
});

test("the nearest eligible player touches the ball", () => {
  const players = [
    playerAt({ x: -FARTHER_BALL, y: 0 }),
    playerAt({ x: NEAR_BALL, y: 0 }),
  ];

  const after = play(players);

  assert.equal(after.recentToucherIndex, 1);
  assert.equal(after.players[1].control.touchTimer, DRIBBLE.touchPeriod);
  assert.equal(after.players[0].control.touchTimer, 0);
});

test("equal touch distances use the earlier player index", () => {
  const players = [
    playerAt({ x: -MID_RANGE, y: 0 }),
    playerAt({ x: MID_RANGE, y: 0 }),
  ];

  assert.equal(play(players).recentToucherIndex, 0);
});

test("only the named early toucher can bypass a running timer", () => {
  const timer = DRIBBLE.touchPeriod / 2;
  const players = [
    playerAt({ x: NEAR_BALL, y: 0 }, { touchTimer: timer }),
    playerAt({ x: FARTHER_BALL, y: 0 }, { touchTimer: timer }),
  ];

  const after = play(players, { earlyToucherIndex: 1 });

  assert.equal(after.recentToucherIndex, 1);
  assert.equal(after.players[1].control.touchTimer, DRIBBLE.touchPeriod);
  assert.ok(
    Math.abs(after.players[0].control.touchTimer - (timer - TICK)) < 1e-9,
  );
});

test("an early touch attempt outside reach only cools the timer", () => {
  const timer = DRIBBLE.touchPeriod / 2;
  const player = playerAt(
    { x: DRIBBLE.controlRadius * 1.01, y: 0 },
    { touchTimer: timer },
  );

  const after = play([player], { earlyToucherIndex: 0 });

  assert.equal(after.recentToucherIndex, null);
  assert.ok(
    Math.abs(after.players[0].control.touchTimer - (timer - TICK)) < 1e-9,
  );
  assert.equal(player.control.touchTimer, timer);
});

test("timers cool before an expired timer is checked for a touch", () => {
  const expiring = playerAt({ x: NEAR_BALL, y: 0 }, { touchTimer: TICK });
  const blocked = playerAt({ x: NEAR_BALL, y: 0 }, { touchTimer: TICK * 2 });

  const ready = play([expiring]);
  const waiting = play([blocked]);

  assert.equal(ready.recentToucherIndex, 0);
  assert.equal(ready.players[0].control.touchTimer, DRIBBLE.touchPeriod);
  assert.equal(waiting.recentToucherIndex, null);
  assert.ok(Math.abs(waiting.players[0].control.touchTimer - TICK) < 1e-9);
});

test("the recent toucher expires when its timer ends without a touch", () => {
  const player = playerAt(
    { x: DRIBBLE.controlRadius * 2, y: 0 },
    { touchTimer: TICK },
  );

  const after = play([player], {
    recentToucherIndex: 0,
    directions: [DOWN_THE_PITCH],
  });

  assert.equal(after.recentToucherIndex, null);
  assert.equal(after.players[0].control.touchTimer, 0);
  assert.ok(Math.abs(after.players[0].speed - PLAYER.maxSpeed) < 1e-9);
});

test("the active recent toucher uses carrying pace on its timer expiry tick", () => {
  const player = playerAt({ x: 0, y: 0 }, { touchTimer: TICK }, DOWN_THE_PITCH);
  const ball = createBall({ x: 0, y: NEAR_BALL });

  const after = play([player], {
    ball,
    recentToucherIndex: 0,
    directions: [DOWN_THE_PITCH],
  });

  assert.ok(
    Math.abs(
      after.ball.velocity.y -
        expectedTouchSpeed(PLAYER_CARRYING.maxSpeed, NEAR_BALL),
    ) < 1e-9,
  );
});

test("a new toucher uses full pace for the touch then returns at carrying pace", () => {
  const players = [
    playerAt(
      { x: DRIBBLE.controlRadius * 2, y: 0 },
      { touchTimer: DRIBBLE.touchPeriod / 2 },
    ),
    playerAt({ x: 0, y: 0 }),
  ];
  const ball = createBall({ x: 0, y: NEAR_BALL });

  const after = play(players, {
    ball,
    recentToucherIndex: 0,
    directions: [DOWN_THE_PITCH, DOWN_THE_PITCH],
  });

  assert.equal(after.recentToucherIndex, 1);
  assert.ok(
    Math.abs(
      after.ball.velocity.y - expectedTouchSpeed(PLAYER.maxSpeed, NEAR_BALL),
    ) < 1e-9,
  );
  assert.ok(Math.abs(after.players[0].speed - PLAYER.maxSpeed) < 1e-9);
  assert.ok(Math.abs(after.players[1].speed - PLAYER_CARRYING.maxSpeed) < 1e-9);
});

test("touch happens before kick replaces the ball velocity", () => {
  const players = [
    playerAt({ x: -NEAR_BALL, y: 0 }),
    playerAt({ x: MID_RANGE, y: 0 }, {}, UP_THE_PITCH),
  ];

  const after = play(players, {
    directions: [RIGHT, UP_THE_PITCH],
    kickingPlayerIndex: 1,
    kickCharge: KICK.maximumCharge / 2,
  });

  assert.equal(after.players[0].control.touchTimer, DRIBBLE.touchPeriod);
  assert.equal(after.players[1].control.retouchTimer, KICK.retouchDelay);
  assert.ok(Math.abs(after.ball.velocity.x) < 1e-9);
  assert.ok(after.ball.velocity.y < 0);
  assert.ok(after.ball.velocity.z > 0);
});

test("a successful kick clears the recent toucher", () => {
  const player = playerAt({ x: 0, y: NEAR_BALL });

  const after = play([player], {
    recentToucherIndex: 0,
    kickCharge: KICK.maximumCharge / 2,
  });

  assert.equal(after.recentToucherIndex, null);
  assert.equal(after.players[0].control.retouchTimer, KICK.retouchDelay);
});

test("a touch uses the exact velocity needed to reach its target", () => {
  const player = playerAt({ x: 0, y: 0 });
  const ball = ballAhead(DRIBBLE.idealLead / 2);
  const players = [player];
  const before = structuredClone({ players, ball });

  const after = play(players, { ball, directions: [DOWN_THE_PITCH] });
  const targetAtNextTouch =
    PLAYER.maxSpeed * DRIBBLE.touchPeriod + DRIBBLE.idealLead;

  assert.ok(
    Math.abs(
      after.ball.velocity.y -
        (targetAtNextTouch - ball.position.y) / DRIBBLE.touchPeriod,
    ) < 1e-9,
  );
  assert.equal(after.ball.velocity.x, 0);
  assert.equal(after.players[0].control.touchTimer, DRIBBLE.touchPeriod);
  assert.deepEqual(after.players[0].position, player.position);
  assert.deepEqual({ players, ball }, before);
});

test("a touch at the ideal lead matches the ball to the run", () => {
  const after = play([playerAt({ x: 0, y: 0 })], {
    ball: ballAhead(DRIBBLE.idealLead),
    directions: [DOWN_THE_PITCH],
  });

  assert.ok(Math.abs(horizontalSpeed(after.ball) - PLAYER.maxSpeed) < 1e-9);
  assert.ok(after.ball.velocity.y > 0);
});

test("a touch aims a ball at the player's side back in front", () => {
  const distance = DRIBBLE.controlRadius * 0.9;
  const after = play([playerAt({ x: 0, y: 0 })], {
    ball: ballBeside(distance),
    directions: [DOWN_THE_PITCH],
  });

  assert.ok(
    Math.abs(after.ball.velocity.x + distance / DRIBBLE.touchPeriod) < 1e-9,
  );
  assert.ok(after.ball.velocity.y > 0);
});

test("a nonzero touch direction overrides the player's old heading", () => {
  const after = play([playerAt({ x: 0, y: 0 })], {
    ball: ballAhead(NEAR_BALL),
    directions: [RIGHT],
  });

  assert.ok(after.ball.velocity.x > 0);
  assert.ok(after.ball.velocity.y < 0);
});

test("zero touch direction uses the player's last heading", () => {
  const after = play([playerAt({ x: 0, y: 0 })], {
    ball: ballAhead(NEAR_BALL),
  });

  assert.ok(after.ball.velocity.y > 0);
  assert.equal(after.ball.velocity.x, 0);
});

test("an immediate run uses full player speed in its touch", () => {
  const after = play([playerAt({ x: 0, y: 0 })], {
    ball: ballAhead(NEAR_BALL),
    directions: [DOWN_THE_PITCH],
  });

  assert.ok(
    Math.abs(
      after.ball.velocity.y - expectedTouchSpeed(PLAYER.maxSpeed, NEAR_BALL),
    ) < 1e-9,
  );
});

test("a touch leaves ball height and vertical speed alone", () => {
  const rising = {
    position: { x: 0, y: DRIBBLE.controlRadius, z: 0.3 },
    velocity: { x: 0, y: 0, z: 1.5 },
  };

  const after = play([playerAt({ x: 0, y: 0 })], {
    ball: rising,
    directions: [DOWN_THE_PITCH],
  });

  assert.equal(after.ball.position.z, rising.position.z);
  assert.equal(after.ball.velocity.z, rising.velocity.z);
});

test("a ball outside the control radius is not touched", () => {
  const ball = ballAhead(DRIBBLE.controlRadius * 1.01);

  const after = play([playerAt({ x: 0, y: 0 })], { ball });

  assert.equal(after.recentToucherIndex, null);
  assert.deepEqual(after.ball, ball);
});

test("a ball above the height limit is not touched", () => {
  const ball = ballAhead(DRIBBLE.controlRadius, DRIBBLE.maxTouchHeight * 1.01);

  const after = play([playerAt({ x: 0, y: 0 })], { ball });

  assert.equal(after.recentToucherIndex, null);
  assert.deepEqual(after.ball, ball);
});

test("a standing player touches along their last heading", () => {
  const after = play([playerAt({ x: 0, y: 0 })], {
    ball: ballAhead(NEAR_BALL),
  });
  const expected = (DRIBBLE.idealLead - NEAR_BALL) / DRIBBLE.touchPeriod;

  assert.ok(Math.abs(after.ball.velocity.y - expected) < 1e-9);
});

test("the touch timer blocks and then allows another touch", () => {
  const ball = ballAhead(DRIBBLE.idealLead);
  const touched = play([playerAt({ x: 0, y: 0 })], { ball });
  const blocked = continuePlay(touched);
  const ready = continuePlay(touched, { seconds: DRIBBLE.touchPeriod });

  assert.ok(
    blocked.players[0].control.touchTimer <
      touched.players[0].control.touchTimer,
  );
  assert.equal(blocked.recentToucherIndex, 0);
  assert.deepEqual(blocked.ball.velocity, touched.ball.velocity);
  assert.equal(ready.players[0].control.touchTimer, DRIBBLE.touchPeriod);
  assert.equal(ready.recentToucherIndex, 0);
});

test("regular touches come at 3 Hz", () => {
  assert.equal(DRIBBLE.touchPeriod, 1 / 3);
  let state = play([playerAt({ x: 0, y: 0 })], {
    ball: ballAhead(DRIBBLE.idealLead),
  });
  const touchTicks = [];

  for (let step = 1; step <= 300; step += 1) {
    const beforeTimer = state.players[0].control.touchTimer;
    state = continuePlay(state);
    if (state.players[0].control.touchTimer > beforeTimer)
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
  const ball = ballAhead(DRIBBLE.idealLead);
  const touched = play([playerAt({ x: 0, y: 0 })], { ball });

  const after = continuePlay(touched, { directions: [RIGHT] });

  assert.ok(after.players[0].control.touchTimer < DRIBBLE.touchPeriod);
  assert.deepEqual(after.ball.velocity, touched.ball.velocity);
});

test("a touch replaces a fast ball's horizontal velocity", () => {
  const resting = ballAhead(NEAR_BALL);
  const incoming = {
    ...resting,
    velocity: { x: -20, y: 15, z: 0 },
  };

  const expected = play([playerAt({ x: 0, y: 0 })], {
    ball: resting,
    directions: [DOWN_THE_PITCH],
  });
  const received = play([playerAt({ x: 0, y: 0 })], {
    ball: incoming,
    directions: [DOWN_THE_PITCH],
  });

  assert.deepEqual(received.ball.velocity, expected.ball.velocity);
});

test("the charge builds while held and stops at the maximum", () => {
  const ball = ballAhead(DRIBBLE.idealLead);
  const oneTick = play([kickingPlayer()], { ball, kickHeld: true });
  const twoTicks = continuePlay(oneTick, { kickHeld: true });
  const overheld = continuePlay(twoTicks, {
    kickHeld: true,
    seconds: KICK.maximumCharge,
  });

  assert.ok(Math.abs(oneTick.kickCharge - TICK) < 1e-9);
  assert.ok(Math.abs(twoTicks.kickCharge - 2 * TICK) < 1e-9);
  assert.equal(overheld.kickCharge, KICK.maximumCharge);
});

test("a tap kicks at minimum power and a low angle", () => {
  const after = holdThenRelease([kickingPlayer()], ballAhead(NEAR_BALL), TICK);

  assert.ok(powerOf(after.ball) >= KICK.minimumPower);
  assert.ok(
    powerOf(after.ball) <=
      KICK.minimumPower +
        CHARGE_PER_TICK * (KICK.maximumPower - KICK.minimumPower),
  );
  assert.ok(elevationOf(after.ball) <= CHARGE_PER_TICK * KICK.maximumElevation);
  assert.equal(after.kickCharge, 0);
  assert.equal(after.players[0].control.retouchTimer, KICK.retouchDelay);
});

test("holding the button charges without changing the ball", () => {
  const ball = ballAhead(NEAR_BALL);

  const held = holdFor([kickingPlayer()], ball, KICK.maximumCharge);

  assert.deepEqual(held.ball, ball);
  assert.equal(held.recentToucherIndex, null);
  assert.ok(Math.abs(held.kickCharge - KICK.maximumCharge) < 1e-9);
});

test("a full hold kicks at maximum power and angle", () => {
  const after = holdThenRelease(
    [kickingPlayer()],
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
    (held) =>
      holdThenRelease([kickingPlayer()], ballAhead(NEAR_BALL), held).ball,
  );

  for (let step = 1; step < kicks.length; step += 1) {
    const [before, after] = [kicks[step - 1], kicks[step]];
    assert.ok(powerOf(after) > powerOf(before));
    assert.ok(elevationOf(after) > elevationOf(before));
  }
});

test("a release outside kick range or height leaves the ball alone", () => {
  for (const ball of [
    ballAhead(KICK.range * 1.01),
    ballAhead(NEAR_BALL, KICK.maximumHeight * 1.01),
  ]) {
    const after = holdThenRelease([kickingPlayer()], ball, SHORT_HOLD);

    assert.deepEqual(after.ball, ball);
    assert.equal(after.kickCharge, 0);
    assert.equal(after.players[0].control.retouchTimer, 0);
  }
});

test("a missed release spends its charge", () => {
  const missed = holdThenRelease(
    [kickingPlayer()],
    ballAhead(KICK.range * 1.01),
    SHORT_HOLD,
  );
  const nearBall = ballAhead(NEAR_BALL);

  const next = continuePlay(missed, { ball: nearBall });

  assert.equal(missed.kickCharge, 0);
  assert.deepEqual(next.ball, nearBall);
  assert.equal(next.players[0].control.retouchTimer, 0);
});

test("a stopped player kicks along their last heading", () => {
  const after = holdThenRelease(
    [kickingPlayer({}, DOWN_THE_PITCH)],
    ballAhead(NEAR_BALL),
    SHORT_HOLD,
  );

  assert.equal(after.players[0].speed, 0);
  assert.ok(after.ball.velocity.y > 0);
  assert.ok(Math.abs(after.ball.velocity.x) < 1e-9);
});

test("a turn on the tick after a kick does not take the ball back", () => {
  const kicked = holdThenRelease(
    [kickingPlayer()],
    ballAhead(NEAR_BALL),
    KICK.maximumCharge,
  );

  const turned = continuePlay(kicked, {
    directions: [RIGHT],
    earlyToucherIndex: 0,
  });

  assert.deepEqual(turned.ball.velocity, kicked.ball.velocity);
  assert.equal(turned.recentToucherIndex, null);
});

test("the kick spends the charge it is given, whoever is named as kicker", () => {
  const held = holdFor(
    [kickingPlayer(), kickingPlayer({}, UP_THE_PITCH)],
    ballAhead(NEAR_BALL),
    KICK.maximumCharge,
    { kickingPlayerIndex: 0 },
  );

  const kicked = continuePlay(held, { kickingPlayerIndex: 1 });

  assert.ok(Math.abs(powerOf(kicked.ball) - KICK.maximumPower) < 1e-9);
  assert.ok(kicked.ball.velocity.y < 0);
  assert.equal(kicked.players[1].control.retouchTimer, KICK.retouchDelay);
  assert.equal(kicked.players[0].control.retouchTimer, 0);
});

test("a successful kick starts the touch delay", () => {
  const kicked = holdThenRelease([kickingPlayer()], ballAhead(NEAR_BALL), TICK);

  const waiting = continuePlay(kicked);

  assert.equal(kicked.players[0].control.retouchTimer, KICK.retouchDelay);
  assert.ok(waiting.players[0].control.retouchTimer < KICK.retouchDelay);
  assert.deepEqual(waiting.ball, kicked.ball);
  assert.equal(waiting.recentToucherIndex, null);
});
