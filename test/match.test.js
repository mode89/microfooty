import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceMatch,
  createMatch,
  keyboardPlayer,
} from "../web/world/match.js";
import { advanceBall } from "../web/world/ball.js";
import { homePosition } from "../web/world/formation.js";
import { advancePlayer, directionFromInput } from "../web/world/player.js";
import { advancePossession } from "../web/world/possession.js";
import { TEAMS } from "../web/world/team.js";
import { BALL, BODY, DRIBBLE, PLAYER, STEERING } from "../web/tuning.js";
import { STILL } from "./helpers.js";

const RUNNING_UP = Object.freeze({ ...STILL, up: true });
const RUNNING_RIGHT = Object.freeze({ ...STILL, right: true });
const KICKING_UP = Object.freeze({ ...RUNNING_UP, kick: true });
const KICKING_STILL = Object.freeze({ ...STILL, kick: true });
const TICK = 1 / 60;

// Stands the keyboard player within touching range below the centre spot.
const STRIDE_BEHIND_THE_BALL = DRIBBLE.controlRadius * 0.9;
const MID_RANGE = DRIBBLE.controlRadius * 0.5;
const CONTROL_EDGE = DRIBBLE.controlRadius * 0.9;

// Far enough up the pitch to slide every home clear of the arrival band the
// players settled in at kick-off.
const BALL_UP_THE_PITCH = Object.freeze({ x: 0, y: -20 });

// Places named players, keyed by their index in the match, and leaves the rest
// in their formation.
function placed(match, positions) {
  return {
    ...match,
    players: match.players.map((player, index) =>
      index in positions ? { ...player, position: positions[index] } : player,
    ),
  };
}

function changedPlayers(match, changes) {
  return {
    ...match,
    players: match.players.map((player, index) => {
      const change = changes[index];
      if (!change) return player;
      return {
        ...player,
        ...change,
        control: change.control
          ? { ...player.control, ...change.control }
          : player.control,
      };
    }),
  };
}

function standingBehindTheBall(match) {
  return placed(match, {
    [match.keyboardIndex]: { x: 0, y: STRIDE_BEHIND_THE_BALL },
  });
}

function withBallAt(match, { x, y }) {
  return {
    ...match,
    ball: { ...match.ball, position: { x, y, z: BALL.radius } },
  };
}

function withBallUntouchableFor(match, ticks) {
  const fall = 0.5 * BALL.gravity * (ticks * TICK) ** 2;
  return {
    ...match,
    ball: {
      ...match.ball,
      position: {
        ...match.ball.position,
        z: DRIBBLE.maxTouchHeight + fall + 1,
      },
    },
  };
}

function indexOfRole(match, name) {
  return match.players.findIndex((player) => player.role.name === name);
}

function indexOfTeamRole(match, team, name) {
  return match.players.findIndex(
    (player) => player.team === team && player.role.name === name,
  );
}

function play(match, actions, ticks) {
  let current = match;
  for (let tick = 0; tick < ticks; tick += 1)
    current = advanceMatch(current, actions, TICK);
  return current;
}

function groundGap(player, ball) {
  return Math.hypot(
    ball.position.x - player.position.x,
    ball.position.y - player.position.y,
  );
}

function advanceSoloMatchWithoutChasing(match, actions, seconds) {
  const direction = directionFromInput(actions);
  const possession = advancePossession(
    {
      players: match.players,
      ball: match.ball,
      recentToucherIndex: match.recentToucherIndex,
    },
    {
      directions: [direction],
      earlyToucherIndex:
        match.keyboardDirection.x !== direction.x ||
        match.keyboardDirection.y !== direction.y
          ? 0
          : null,
      kickingPlayerIndex: 0,
      kickHeld: actions.kick,
    },
    seconds,
  );
  return {
    ...match,
    players: [advancePlayer(possession.players[0], seconds)],
    ball: advanceBall(possession.ball, seconds),
    keyboardDirection: direction,
    recentToucherIndex: possession.recentToucherIndex,
  };
}

function groundSpeed({ velocity }) {
  return Math.hypot(velocity.x, velocity.y);
}

function createOnePlayerMatch() {
  const fullMatch = createMatch();
  return {
    ...fullMatch,
    players: [
      {
        ...keyboardPlayer(fullMatch),
        position: { x: 0, y: 0 },
      },
    ],
    ball: {
      ...fullMatch.ball,
      position: { x: 0, y: DRIBBLE.idealLead, z: BALL.radius },
    },
    keyboardIndex: 0,
    recentToucherIndex: null,
  };
}

test("a match puts twenty-two players on the pitch, eleven a side", () => {
  const match = createMatch();
  assert.equal(match.players.length, 22);
  TEAMS.forEach((team) =>
    assert.equal(
      match.players.filter((player) => player.team === team).length,
      11,
    ),
  );
});

test("a match holds one control per player", () => {
  const match = createMatch();
  match.players.forEach((player) => assert.equal(player.control.touchTimer, 0));
  assert.equal(
    new Set(match.players.map((player) => player.control)).size,
    match.players.length,
  );
});

test("a directional input change allows an early touch and resets its timer", () => {
  const created = createMatch();
  let match = placed(created, {
    [created.keyboardIndex]: { x: 0, y: MID_RANGE },
  });
  match = changedPlayers(match, {
    [match.keyboardIndex]: {
      control: {
        touchTimer: DRIBBLE.touchPeriod / 2,
      },
    },
  });

  const after = advanceMatch(match, RUNNING_UP, TICK);
  assert.equal(
    after.players[match.keyboardIndex].control.touchTimer,
    DRIBBLE.touchPeriod,
  );
  assert.equal(after.recentToucherIndex, match.keyboardIndex);
  assert.ok(after.ball.velocity.y < 0);
});

test("releasing directional input earns a touch along the last heading", () => {
  const created = createMatch();
  let match = placed(created, {
    [created.keyboardIndex]: { x: 0, y: MID_RANGE },
  });
  match = changedPlayers(
    { ...match, keyboardDirection: { x: 0, y: -1 } },
    {
      [match.keyboardIndex]: {
        heading: { x: 0, y: -1 },
        control: {
          touchTimer: DRIBBLE.touchPeriod / 2,
        },
      },
    },
  );

  const after = advanceMatch(match, STILL, TICK);
  assert.equal(
    after.players[match.keyboardIndex].control.touchTimer,
    DRIBBLE.touchPeriod,
  );
  assert.equal(after.recentToucherIndex, match.keyboardIndex);
  assert.ok(after.ball.velocity.y < 0);
});

test("an input-change touch is checked before the player moves", () => {
  const created = createMatch();
  const match = placed(created, {
    [created.keyboardIndex]: { x: 0, y: -CONTROL_EDGE },
  });
  const after = advanceMatch(match, RUNNING_UP, TICK);
  assert.equal(after.recentToucherIndex, match.keyboardIndex);
  assert.equal(
    after.players[match.keyboardIndex].control.touchTimer,
    DRIBBLE.touchPeriod,
  );
});

test("match resolves possession before body push and ball motion", () => {
  const created = createMatch();
  const role = {
    ...keyboardPlayer(created).role,
    homeFraction: { x: 0, y: 0 },
  };
  const position = { x: 0, y: DRIBBLE.controlRadius * 0.1 };
  const player = {
    ...keyboardPlayer(created),
    role,
    position,
    heading: { x: 0, y: -1 },
  };
  const blocker = {
    ...player,
    control: { ...player.control, touchTimer: DRIBBLE.touchPeriod },
  };
  const match = {
    ...created,
    players: [player, blocker],
    keyboardIndex: 0,
    ball: {
      ...created.ball,
      position: { x: 0, y: DRIBBLE.controlRadius * 0.2, z: BALL.radius },
    },
  };

  const after = advanceMatch(match, STILL, TICK);

  assert.ok(after.players[0].position.x < 0);
  assert.ok(after.players[1].position.x > 0);
  assert.ok(Math.abs(after.ball.position.x) < 1e-12);
  assert.ok(after.ball.position.y < match.ball.position.y);
});

test("every player starts on the home place of their role", () => {
  const match = createMatch();
  match.players.forEach((player) =>
    assert.deepEqual(
      player.position,
      homePosition(
        player.role,
        player.team.attackingDirection,
        match.ball.position,
      ),
    ),
  );
});

test("players outside the chase run to the home the ball asks for", () => {
  const runHomeTicks = 120;
  const ballShifted = withBallAt(createMatch(), BALL_UP_THE_PITCH);
  const [firstChaserIndex, secondChaserIndex] = TEAMS.map((team) =>
    indexOfTeamRole(ballShifted, team, "leftStriker"),
  );
  const chaserIndexes = new Set([firstChaserIndex, secondChaserIndex]);
  const withNamedChasers = placed(ballShifted, {
    [firstChaserIndex]: { x: -1, y: BALL_UP_THE_PITCH.y },
    [secondChaserIndex]: { x: 1, y: BALL_UP_THE_PITCH.y },
  });
  const shifted = withBallUntouchableFor(withNamedChasers, runHomeTicks);
  const moved = play(shifted, STILL, runHomeTicks);
  moved.players.forEach((player, index) => {
    if (index === shifted.keyboardIndex || chaserIndexes.has(index)) return;
    const target = homePosition(
      player.role,
      player.team.attackingDirection,
      BALL_UP_THE_PITCH,
    );
    assert.ok(
      Math.hypot(player.position.x - target.x, player.position.y - target.y) <
        STEERING.arrivalRadius,
      `${player.role.name} stopped short of the home the ball asked for`,
    );
  });
});

test("a match kicks off with the ball on the centre spot", () => {
  const ball = createMatch().ball;
  assert.equal(ball.position.x, 0);
  assert.equal(ball.position.y, 0);
});

test("the keyboard drives one of the twenty-two", () => {
  const match = createMatch();
  assert.ok(match.players.includes(keyboardPlayer(match)));
});

test("a shape without the keyboard's role is refused", () => {
  const keeperOnly = TEAMS.map((team) => ({
    ...team,
    roles: team.roles.filter((role) => role.keeper),
  }));
  assert.throws(() => createMatch(keeperOnly), /keyboard/);
});

test("the nearest player from each team chases the loose ball", () => {
  const created = createMatch();
  const chaserIndexes = TEAMS.map((team) =>
    indexOfTeamRole(created, team, "leftStriker"),
  );
  const nonChaserIndexes = TEAMS.map((team) =>
    indexOfTeamRole(created, team, "leftCentreBack"),
  );
  const chaseTicks = 1;
  const match = withBallUntouchableFor(
    placed(created, {
      [chaserIndexes[0]]: { x: 0, y: 2 },
      [chaserIndexes[1]]: { x: 0, y: -2 },
    }),
    chaseTicks,
  );
  const after = play(match, STILL, chaseTicks);

  chaserIndexes.forEach((index) =>
    assert.ok(
      groundGap(after.players[index], match.ball) <
        groundGap(match.players[index], match.ball),
    ),
  );
  nonChaserIndexes.forEach((index) =>
    assert.deepEqual(
      after.players[index].position,
      match.players[index].position,
    ),
  );
});

test("keyboard direction overrides the chase", () => {
  const match = createOnePlayerMatch();

  const after = advanceMatch(match, RUNNING_RIGHT, TICK);

  assert.ok(keyboardPlayer(after).position.x > 0);
  assert.equal(keyboardPlayer(after).position.y, 0);
});

test("an AI chaser picks up a loose ball and carries it away", () => {
  const created = createMatch();
  const chaser =
    created.players[indexOfTeamRole(created, TEAMS[1], "rightStriker")];
  const match = {
    ...created,
    players: [
      { ...keyboardPlayer(created), position: { x: 10, y: 10 } },
      // Its home is further up, so only chase steering sends it down to the ball.
      { ...chaser, position: { x: 0, y: -MID_RANGE } },
    ],
    keyboardIndex: 0,
  };

  const after = play(match, STILL, 60);

  assert.equal(after.recentToucherIndex, 1);
  assert.ok(after.ball.position.y > 1);
  assert.ok(groundGap(after.players[1], after.ball) <= DRIBBLE.controlRadius);
});

test("a player away from their place runs back to it and settles", () => {
  const kickedOff = createMatch();
  const strayIndex = indexOfRole(kickedOff, "keeper");
  const home = kickedOff.players[strayIndex].position;
  const stray = placed(kickedOff, {
    [strayIndex]: { x: home.x + 10, y: home.y },
  });
  const settleTicks = 300;
  const back = play(
    withBallUntouchableFor(stray, settleTicks),
    STILL,
    settleTicks,
  ).players[strayIndex];
  assert.ok(
    Math.hypot(back.position.x - home.x, back.position.y - home.y) <=
      STEERING.arrivalRadius,
  );
  assert.ok(back.speed < 0.01);
});

test("bodies are parted inside the match, not only in the module", () => {
  const kickedOff = createMatch();
  const stackIndices = ["leftBack", "rightBack"].map((name) =>
    indexOfRole(kickedOff, name),
  );
  const corner = { x: 30, y: 48 };
  const stacked = placed(kickedOff, {
    [stackIndices[0]]: corner,
    [stackIndices[1]]: corner,
  });

  const parted = advanceMatch(stacked, STILL, TICK).players;
  const [first, second] = stackIndices.map((index) => parted[index].position);
  assert.ok(
    Math.hypot(second.x - first.x, second.y - first.y) >
      (BODY.diameter / 2) * BODY.pushRate * TICK,
  );
});

test("team chase selection leaves a solo M1 dribble unchanged", () => {
  let match = createOnePlayerMatch();
  let withoutChasing = match;
  for (const actions of [RUNNING_UP, RUNNING_RIGHT])
    for (let tick = 0; tick < 120; tick += 1) {
      match = advanceMatch(match, actions, TICK);
      withoutChasing = advanceSoloMatchWithoutChasing(
        withoutChasing,
        actions,
        TICK,
      );
      assert.deepEqual(match, withoutChasing);
    }
  assert.ok(match.ball.position.x > keyboardPlayer(match).position.x);
});

test("the keyboard player dribbles the ball up the pitch", () => {
  const match = play(standingBehindTheBall(createMatch()), RUNNING_UP, 60);
  const gap = Math.hypot(
    match.ball.position.x - keyboardPlayer(match).position.x,
    match.ball.position.y - keyboardPlayer(match).position.y,
  );
  assert.ok(match.ball.position.y < -1);
  assert.ok(gap <= DRIBBLE.controlRadius);
});

test("the keyboard player strikes the ball on releasing the button", () => {
  const charged = play(standingBehindTheBall(createMatch()), KICKING_UP, 60);
  assert.ok(groundSpeed(charged.ball) < PLAYER.maxSpeed);

  const struck = advanceMatch(charged, RUNNING_UP, TICK).ball;
  assert.ok(groundSpeed(struck) > PLAYER.maxSpeed);
  assert.ok(struck.velocity.y < 0);
});

test("a kick by a player who has never run goes the way the team attacks", () => {
  const charged = play(standingBehindTheBall(createMatch()), KICKING_STILL, 60);
  const struck = advanceMatch(charged, STILL, TICK).ball;
  assert.ok(groundSpeed(struck) > PLAYER.maxSpeed);
  assert.equal(
    Math.sign(struck.velocity.y),
    keyboardPlayer(charged).team.attackingDirection,
  );
});

test("the ball runs on while nobody plays it", () => {
  const kickedOff = createMatch();
  const rolling = {
    ...kickedOff,
    ball: {
      ...kickedOff.ball,
      velocity: { x: 0, y: -4, z: 0 },
    },
  };
  assert.ok(advanceMatch(rolling, STILL, 0.1).ball.position.y < 0);
});
