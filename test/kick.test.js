import test from "node:test";
import assert from "node:assert/strict";
import {
  DRIBBLE,
  advanceDribble,
  createDribble,
  isCarrying,
} from "../web/world/kick.js";
import { BALL, advanceBall, createBall } from "../web/world/ball.js";
import {
  PLAYER,
  PLAYER_CARRYING,
  advancePlayer,
  createPlayer,
  directionFromInput,
} from "../web/world/player.js";

const TICK = 1 / 60;

// The spec asks a touch to outrun the player "slightly". Twice the run is a
// loose reading of that word, and it is the ceiling the rules may not pass.
const MOST_A_TOUCH_MAY_OUTRUN = 2;

const keys = (...held) =>
  Object.fromEntries(
    ["up", "down", "left", "right"].map((key) => [key, held.includes(key)]),
  );

// The pitch runs along +y, so a player running "down" heads down the screen
// and the ball ahead of them is at a larger y.
const runningPlayer = (speed = PLAYER.maxSpeed) => ({
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: speed },
});

const ballAhead = (distance, height = BALL.radius) => ({
  position: { x: 0, y: distance, z: height },
  velocity: { x: 0, y: 0, z: 0 },
});

const ballBeside = (distance) => ({
  position: { x: distance, y: 0, z: BALL.radius },
  velocity: { x: 0, y: 0, z: 0 },
});

const afterOneTick = (player, ball, dribble = createDribble()) =>
  advanceDribble(dribble, player, ball, TICK);

const speed = (body) => Math.hypot(body.velocity.x, body.velocity.y);

const gapBetween = (player, ball) =>
  Math.hypot(
    ball.position.x - player.position.x,
    ball.position.y - player.position.y,
  );

// One leg of a dribbling run, stepped as web/main.js steps it: both bodies
// move, then the touch is applied. A touch shows itself as a full cooldown.
const dribbleFor = (start, direction, ticks) => {
  let { player, ball, dribble } = start;
  const touchTicks = [];
  let widestGap = 0;

  for (let step = 0; step < ticks; step += 1) {
    player = advancePlayer(
      player,
      direction,
      TICK,
      isCarrying(dribble) ? PLAYER_CARRYING : PLAYER,
    );
    ball = advanceBall(ball, TICK);
    ({ dribble, ball } = advanceDribble(dribble, player, ball, TICK));
    if (dribble.cooldown === DRIBBLE.touchCooldown) touchTicks.push(step);
    widestGap = Math.max(widestGap, gapBetween(player, ball));
  }
  return { player, ball, dribble, touchTicks, widestGap };
};

const standingOver = (ball) => ({
  player: createPlayer(),
  ball,
  dribble: createDribble(),
});

test("a touch on a ball at the ideal lead matches the ball to the run", () => {
  const player = runningPlayer();
  const after = afterOneTick(player, ballAhead(DRIBBLE.idealLead));
  assert.ok(Math.abs(speed(after.ball) - speed(player)) < 1e-9);
  assert.ok(after.ball.velocity.y > 0);
  assert.equal(after.dribble.cooldown, DRIBBLE.touchCooldown);
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
  const after = advanceDribble(createDribble(), standing, ball, TICK, settings);
  assert.deepEqual(after.ball, ball);
});

test("no touch happens during the cooldown", () => {
  const carrying = afterOneTick(
    runningPlayer(),
    ballAhead(DRIBBLE.idealLead),
  ).dribble;
  const ball = ballAhead(DRIBBLE.idealLead);
  const after = advanceDribble(carrying, runningPlayer(), ball, TICK);
  assert.deepEqual(after.ball, ball);
  assert.ok(after.dribble.cooldown < carrying.cooldown);
});

test("the cooldown runs out and the next touch is allowed", () => {
  const carrying = afterOneTick(
    runningPlayer(),
    ballAhead(DRIBBLE.idealLead),
  ).dribble;
  const after = advanceDribble(
    carrying,
    runningPlayer(),
    ballAhead(DRIBBLE.idealLead),
    DRIBBLE.touchCooldown,
  );
  assert.equal(after.dribble.cooldown, DRIBBLE.touchCooldown);
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
  assert.ok(running.dribble.cooldown > 0);

  const straightOn = advanceDribble(
    running.dribble,
    runningPlayer(),
    ballAhead(DRIBBLE.idealLead),
    TICK,
  );
  assert.ok(straightOn.dribble.cooldown < running.dribble.cooldown);

  const turned = advanceDribble(
    running.dribble,
    { position: { x: 0, y: 0 }, velocity: { x: PLAYER.maxSpeed, y: 0 } },
    ballAhead(DRIBBLE.idealLead),
    TICK,
  );
  assert.equal(turned.dribble.cooldown, DRIBBLE.touchCooldown);
  assert.ok(turned.ball.velocity.x > 0);
});

test("a gentle change of direction still waits for the cooldown", () => {
  const running = afterOneTick(runningPlayer(), ballAhead(DRIBBLE.idealLead));
  const drifting = advanceDribble(
    running.dribble,
    {
      position: { x: 0, y: 0 },
      velocity: { x: PLAYER.maxSpeed * 0.3, y: PLAYER.maxSpeed * 0.95 },
    },
    ballAhead(DRIBBLE.idealLead),
    TICK,
  );
  assert.ok(drifting.dribble.cooldown < running.dribble.cooldown);
});

test("a fresh touch means the player is carrying the ball", () => {
  const after = afterOneTick(runningPlayer(), ballAhead(DRIBBLE.idealLead));
  assert.ok(isCarrying(after.dribble));
  assert.ok(!isCarrying(createDribble()));
});

test("a ball crossing faster than the run is deflected, not trapped", () => {
  const crossingSpeed = 18;
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
    dribble: createDribble(),
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
