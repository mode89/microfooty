import test from "node:test";
import assert from "node:assert/strict";
import { BALL, DRIBBLE, KICK, PLAYER, PLAYER_CARRYING } from "../web/tuning.js";
import {
  advanceDribble,
  advanceKick,
  createControl,
  isCarrying,
} from "../web/world/kick.js";
import { advanceBall, createBall } from "../web/world/ball.js";
import {
  advancePlayer,
  createPlayer,
  directionFromInput,
} from "../web/world/player.js";

const TICK = 1 / 60;

// The spec asks a touch to outrun the player "slightly". Twice the run is a
// loose reading of that word, and it is the ceiling the rules may not pass.
const MOST_A_TOUCH_MAY_OUTRUN = 2;

function keys(...held) {
  return Object.fromEntries(
    ["up", "down", "left", "right"].map((key) => [key, held.includes(key)]),
  );
}

// The pitch runs along +y, so a player running "down" heads down the screen
// and the ball ahead of them is at a larger y.
function runningPlayer(speed = PLAYER.maxSpeed) {
  return {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: speed },
  };
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

function afterOneTick(player, ball, control = createControl()) {
  return advanceDribble(control, player, ball, TICK);
}

function speed(body) {
  return Math.hypot(body.velocity.x, body.velocity.y);
}

function gapBetween(player, ball) {
  return Math.hypot(
    ball.position.x - player.position.x,
    ball.position.y - player.position.y,
  );
}

// One leg of a dribbling run, stepped as web/main.js steps it: both bodies
// move, then the touch is applied. A touch shows itself as a full cooldown.
function dribbleFor(start, direction, ticks) {
  let { player, ball, control } = start;
  const touchTicks = [];
  let widestGap = 0;

  for (let step = 0; step < ticks; step += 1) {
    player = advancePlayer(
      player,
      direction,
      TICK,
      isCarrying(control) ? PLAYER_CARRYING : PLAYER,
    );
    ball = advanceBall(ball, TICK);
    ({ control, ball } = advanceDribble(control, player, ball, TICK));
    if (control.cooldown === DRIBBLE.touchCooldown) touchTicks.push(step);
    widestGap = Math.max(widestGap, gapBetween(player, ball));
  }
  return { player, ball, control, touchTicks, widestGap };
}

function standingOver(ball) {
  return {
    player: createPlayer(),
    ball,
    control: createControl(),
  };
}

// A hold time is spent in whole ticks with a part tick left over, so this much
// of it counts as spent.
const LAST_SLICE = 1e-9;

// The button is held down for a run of ticks, carrying every result forward as
// web/main.js does, so anything a held tick does to the ball is kept.
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

// The release tick is the one that strikes the ball.
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

// The share of a full charge that one held tick adds, which is the margin a
// tap may sit above the flat minimum.
const CHARGE_PER_TICK = TICK / KICK.maximumCharge;

test("a touch on a ball at the ideal lead matches the ball to the run", () => {
  const player = runningPlayer();
  const after = afterOneTick(player, ballAhead(DRIBBLE.idealLead));
  assert.ok(Math.abs(speed(after.ball) - speed(player)) < 1e-9);
  assert.ok(after.ball.velocity.y > 0);
  assert.equal(after.control.cooldown, DRIBBLE.touchCooldown);
});

test("a touch on a ball at the feet sends it out ahead of the run", () => {
  const player = runningPlayer();
  const after = afterOneTick(player, ballAhead(DRIBBLE.idealLead / 2));
  assert.ok(speed(after.ball) > speed(player));
  assert.ok(after.ball.velocity.y > 0);
});

test("a touch aims a ball at the player's side back in front of the run", () => {
  const after = afterOneTick(
    runningPlayer(),
    ballBeside(DRIBBLE.controlRadius * 0.9),
  );
  assert.ok(after.ball.velocity.x < 0);
  assert.ok(after.ball.velocity.y > 0);
});

test("a touch never sends the ball far faster than the run", () => {
  for (const runSpeed of [0.5, 1, 3, PLAYER.maxSpeed])
    for (const gap of [0.1, 0.4, DRIBBLE.idealLead, DRIBBLE.controlRadius]) {
      const after = afterOneTick(runningPlayer(runSpeed), ballAhead(gap));
      assert.ok(
        speed(after.ball) <= runSpeed * MOST_A_TOUCH_MAY_OUTRUN,
        `run ${runSpeed} m/s with the ball ${gap} m away sent it out at ${speed(after.ball).toFixed(2)} m/s`,
      );
    }
});

test("the touch strength stays inside the reading of a slight outrun", () => {
  assert.ok(DRIBBLE.maxTouchOutrun > 1);
  assert.ok(DRIBBLE.maxTouchOutrun <= MOST_A_TOUCH_MAY_OUTRUN);
});

test("a single tick of input does not launch the ball", () => {
  const player = advancePlayer(
    createPlayer(),
    directionFromInput(keys("down")),
    TICK,
  );
  const after = afterOneTick(player, ballAhead(0.15));
  assert.ok(
    speed(after.ball) <= speed(player) * MOST_A_TOUCH_MAY_OUTRUN,
    `a ${speed(player).toFixed(2)} m/s nudge sent the ball out at ${speed(after.ball).toFixed(2)} m/s`,
  );
});

test("a touch leaves the ball height and its vertical speed alone", () => {
  const rising = {
    position: { x: 0, y: 1, z: 0.3 },
    velocity: { x: 0, y: 0, z: 1.5 },
  };
  const after = afterOneTick(runningPlayer(), rising);
  assert.equal(after.ball.position.z, 0.3);
  assert.equal(after.ball.velocity.z, 1.5);
});

test("no touch happens outside the control radius", () => {
  const ball = ballAhead(DRIBBLE.controlRadius + 0.01);
  const after = afterOneTick(runningPlayer(), ball);
  assert.deepEqual(after.ball, ball);
});

test("no touch happens above the height limit", () => {
  const ball = ballAhead(1, DRIBBLE.maxTouchHeight + 0.01);
  const after = afterOneTick(runningPlayer(), ball);
  assert.deepEqual(after.ball, ball);
});

test("no touch happens below the minimum run speed", () => {
  const ball = ballAhead(DRIBBLE.idealLead);
  const after = afterOneTick(
    runningPlayer(DRIBBLE.minimumRunSpeed - 0.01),
    ball,
  );
  assert.deepEqual(after.ball, ball);
});

test("a touch from a standstill leaves the ball alone", () => {
  const standing = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };
  const ball = ballAhead(0.3);
  // The one way to reach a touch with no heading at all.
  const settings = { ...DRIBBLE, minimumRunSpeed: 0 };
  const after = advanceDribble(createControl(), standing, ball, TICK, settings);
  assert.deepEqual(after.ball, ball);
});

test("no touch happens during the cooldown", () => {
  const carrying = afterOneTick(
    runningPlayer(),
    ballAhead(DRIBBLE.idealLead),
  ).control;
  const ball = ballAhead(DRIBBLE.idealLead);
  const after = advanceDribble(carrying, runningPlayer(), ball, TICK);
  assert.deepEqual(after.ball, ball);
  assert.ok(after.control.cooldown < carrying.cooldown);
});

test("the cooldown runs out and the next touch is allowed", () => {
  const carrying = afterOneTick(
    runningPlayer(),
    ballAhead(DRIBBLE.idealLead),
  ).control;
  const after = advanceDribble(
    carrying,
    runningPlayer(),
    ballAhead(DRIBBLE.idealLead),
    DRIBBLE.touchCooldown,
  );
  assert.equal(after.control.cooldown, DRIBBLE.touchCooldown);
});

test("touches come as often as the cooldown says", () => {
  const run = dribbleFor(
    standingOver(createBall({ x: 0, y: DRIBBLE.idealLead })),
    directionFromInput(keys("down")),
    300,
  );
  const intervals = run.touchTicks
    .slice(1)
    .map((step, index) => step - run.touchTicks[index]);

  assert.ok(intervals.length > 20, "too few touches to judge the cadence");
  const [cadence] = intervals;
  assert.deepEqual(
    intervals,
    intervals.map(() => cadence),
    `touches should come at one steady interval, not ${intervals.join(", ")}`,
  );
  assert.ok(
    Math.abs(cadence * TICK - DRIBBLE.touchCooldown) < TICK,
    `touches came every ${(cadence * TICK).toFixed(4)} s, not every ${DRIBBLE.touchCooldown} s`,
  );
});

test("a sharp turn earns a touch before the cooldown ends", () => {
  const running = afterOneTick(runningPlayer(), ballAhead(DRIBBLE.idealLead));
  assert.ok(running.control.cooldown > 0);

  const straightOn = advanceDribble(
    running.control,
    runningPlayer(),
    ballAhead(DRIBBLE.idealLead),
    TICK,
  );
  assert.ok(straightOn.control.cooldown < running.control.cooldown);

  const turned = advanceDribble(
    running.control,
    { position: { x: 0, y: 0 }, velocity: { x: PLAYER.maxSpeed, y: 0 } },
    ballAhead(DRIBBLE.idealLead),
    TICK,
  );
  assert.equal(turned.control.cooldown, DRIBBLE.touchCooldown);
  assert.ok(turned.ball.velocity.x > 0);
});

test("a gentle change of direction still waits for the cooldown", () => {
  const running = afterOneTick(runningPlayer(), ballAhead(DRIBBLE.idealLead));
  const drifting = advanceDribble(
    running.control,
    {
      position: { x: 0, y: 0 },
      velocity: { x: PLAYER.maxSpeed * 0.3, y: PLAYER.maxSpeed * 0.95 },
    },
    ballAhead(DRIBBLE.idealLead),
    TICK,
  );
  assert.ok(drifting.control.cooldown < running.control.cooldown);
});

test("a fresh touch means the player is carrying the ball", () => {
  const after = afterOneTick(runningPlayer(), ballAhead(DRIBBLE.idealLead));
  assert.ok(isCarrying(after.control));
  assert.ok(!isCarrying(createControl()));
});

test("a ball crossing faster than the run is deflected, not trapped", () => {
  // Faster than the run by more than one touch may change, so no touch can
  // bring it down to the pace of the run.
  const crossingSpeed = PLAYER.maxSpeed + DRIBBLE.maxTouchSpeedChange + 2;
  const crossing = {
    position: { x: 0, y: 1, z: BALL.radius },
    velocity: { x: 0, y: crossingSpeed, z: 0 },
  };
  const after = afterOneTick(runningPlayer(), crossing);
  assert.ok(speed(after.ball) >= crossingSpeed - DRIBBLE.maxTouchSpeedChange);
  assert.ok(speed(after.ball) > PLAYER.maxSpeed);

  const halfASecondLater = advanceBall(after.ball, 0.5);
  assert.ok(
    gapBetween(runningPlayer(), halfASecondLater) > DRIBBLE.controlRadius,
  );
});

test("touches carry the ball from the feet out to the ideal lead", () => {
  const down = directionFromInput(keys("down"));
  const start = standingOver(createBall({ x: 0, y: 0.1 }));
  const run = dribbleFor(start, down, 120);

  assert.ok(
    run.widestGap <= DRIBBLE.idealLead + 0.1,
    `the ball ran out to ${run.widestGap.toFixed(2)} m, past the lead`,
  );
  const settled = gapBetween(run.player, run.ball);
  assert.ok(
    settled > DRIBBLE.idealLead - 0.1,
    `the ball settled at ${settled.toFixed(2)} m, short of the lead`,
  );
});

test("a player runs onto a ball, dribbles it and turns a corner with it", () => {
  const down = directionFromInput(keys("down"));
  const right = directionFromInput(keys("right"));
  // Nine metres of run-up, which takes most of the first hundred ticks.
  const start = {
    player: createPlayer({ x: -30, y: -45 }),
    ball: createBall({ x: -30, y: -36 }),
    control: createControl(),
  };
  // Two thirds of the touches a leg can hold, which leaves room for the ticks
  // spent reaching the ball and for a tuning change.
  const leastTouchesPerLeg = Math.floor(
    ((100 * TICK) / DRIBBLE.touchCooldown) * (2 / 3),
  );

  const approach = dribbleFor(start, down, 100);
  assert.ok(
    approach.touchTicks.length > 0,
    "the player never reached the ball",
  );
  assert.ok(
    gapBetween(approach.player, approach.ball) <= DRIBBLE.controlRadius,
  );

  const straight = dribbleFor(approach, down, 100);
  assert.ok(straight.widestGap <= DRIBBLE.controlRadius, "the ball was lost");
  assert.ok(straight.touchTicks.length >= leastTouchesPerLeg);
  assert.ok(
    straight.ball.position.y > straight.player.position.y,
    "the ball fell behind",
  );

  const corner = dribbleFor(straight, right, 100);
  assert.ok(
    corner.widestGap <= DRIBBLE.controlRadius,
    "the turn lost the ball",
  );
  assert.ok(corner.touchTicks.length >= leastTouchesPerLeg);
  assert.ok(
    corner.ball.position.x > corner.player.position.x,
    "the ball is not ahead",
  );
  assert.ok(
    Math.abs(corner.ball.position.y - corner.player.position.y) < 0.3,
    "the ball never came round the corner",
  );
});

test("the charge builds while the button is held and stops at the maximum", () => {
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

test("a tap kicks the ball at the minimum power, flat along the ground", () => {
  const after = holdThenRelease(runningPlayer(), ballAhead(0.3), TICK);
  assert.ok(powerOf(after.ball) >= KICK.minimumPower);
  assert.ok(
    powerOf(after.ball) <=
      KICK.minimumPower +
        CHARGE_PER_TICK * (KICK.maximumPower - KICK.minimumPower),
  );
  assert.ok(elevationOf(after.ball) <= CHARGE_PER_TICK * KICK.maximumElevation);
  assert.equal(after.control.charge, 0);
});

test("holding the button charges without touching the ball", () => {
  const resting = ballAhead(0.3);
  const held = holdFor(runningPlayer(), resting, KICK.maximumCharge);
  assert.deepEqual(held.ball.velocity, { x: 0, y: 0, z: 0 });
  assert.deepEqual(held.ball.position, resting.position);
  assert.ok(Math.abs(held.control.charge - KICK.maximumCharge) < 1e-9);
});

test("a full hold kicks the ball at the maximum power and angle", () => {
  const after = holdThenRelease(
    runningPlayer(),
    ballAhead(0.3),
    KICK.maximumCharge,
  );
  assert.ok(Math.abs(powerOf(after.ball) - KICK.maximumPower) < 1e-9);
  assert.ok(Math.abs(elevationOf(after.ball) - KICK.maximumElevation) < 1e-9);
});

test("power and launch angle both rise with the time the button is held", () => {
  const holds = [
    TICK,
    ...[0.25, 0.5, 0.75, 1].map((part) => part * KICK.maximumCharge),
  ];
  const kicks = holds.map(
    (held) => holdThenRelease(runningPlayer(), ballAhead(0.3), held).ball,
  );
  for (let step = 1; step < kicks.length; step += 1) {
    const [before, after] = [kicks[step - 1], kicks[step]];
    assert.ok(
      powerOf(after) > powerOf(before),
      `power fell at ${holds[step]} s`,
    );
    assert.ok(
      elevationOf(after) > elevationOf(before),
      `the launch angle fell at ${holds[step]} s`,
    );
  }
});

test("a release out of kicking range leaves the ball alone", () => {
  for (const ball of [
    ballAhead(KICK.range + 0.01),
    ballAhead(0.3, KICK.maximumHeight + 0.01),
  ]) {
    const untouched = structuredClone(ball);
    const after = holdThenRelease(runningPlayer(), ball, 0.3);
    assert.deepEqual(after.ball, untouched);
    assert.deepEqual(ball, untouched, "the ball was changed in place");
  }
});

test("a charge released with no ball nearby is spent, not saved", () => {
  const player = runningPlayer();
  const wasted = holdThenRelease(player, ballAhead(KICK.range + 0.01), 0.3);
  assert.equal(wasted.control.charge, 0);

  const nextTap = advanceKick(
    wasted.control,
    player,
    ballAhead(0.3),
    false,
    TICK,
  );
  assert.deepEqual(nextTap.ball.velocity, { x: 0, y: 0, z: 0 });
});

test("a kick goes the way the player last ran, even after stopping", () => {
  // Down the pitch, which no unset or zeroed aim can point to by accident.
  const running = runningPlayer();
  const ball = ballAhead(0.3);

  const { control } = advanceKick(createControl(), running, ball, false, TICK);
  const after = holdThenRelease(createPlayer(), ball, 0.2, control);
  assert.ok(after.ball.velocity.y > 0);
  assert.ok(Math.abs(after.ball.velocity.x) < 1e-9);
});

test("a player who has kicked the ball away is not carrying it", () => {
  const kicked = holdThenRelease(runningPlayer(), ballAhead(0.3), TICK);
  assert.ok(kicked.control.cooldown > 0, "the kick started no cooldown");
  assert.ok(!isCarrying(kicked.control));
});

test("a struck pass is not dribbled back by the player who kicked it", () => {
  const down = directionFromInput(keys("down"));
  // The weakest tap leaves the ball barely faster than the run and is meant to
  // be run onto; a pass with a charge behind it is played away for good.
  const passCharge = KICK.maximumCharge / 4;
  // Every phase of the touch cadence, since a kick may land at any point in it.
  for (let phase = 0; phase < 8; phase += 1) {
    const run = dribbleFor(
      standingOver(createBall({ x: 0, y: 0.4 })),
      down,
      120 + phase,
    );
    const passed = holdThenRelease(
      run.player,
      run.ball,
      passCharge,
      run.control,
    );
    const chase = dribbleFor({ ...passed, player: run.player }, down, 30);

    assert.deepEqual(
      chase.touchTicks,
      [],
      `a pass struck at phase ${phase} was touched again and dribbled on`,
    );
  }
});

test("turning away cannot win back a ball the player has just kicked", () => {
  const standing = standingOver(createBall({ x: 0, y: 0.3 }));
  const kicked = holdThenRelease(
    standing.player,
    standing.ball,
    TICK,
    standing.control,
  );
  assert.ok(kicked.ball.velocity.y < 0, "the kick did not go up the pitch");

  // On the tick the cooldown reaches zero the ball is loose again and may
  // fairly be chased down, so the rule only covers the ticks before it.
  const ticksHeldOff = Math.round(KICK.cooldown / TICK) - 1;
  // A full reversal, the turn that most readily earns a touch of its own.
  const chasing = dribbleFor(
    { ...kicked, player: standing.player },
    directionFromInput(keys("down")),
    ticksHeldOff,
  );
  assert.deepEqual(
    chasing.touchTicks,
    [],
    "the turn earned a touch on the kicked ball",
  );
  assert.ok(
    chasing.ball.velocity.y < 0,
    "the kicked ball was turned round and dribbled back",
  );
});
