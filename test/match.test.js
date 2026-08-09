import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceMatch,
  createMatch,
  keyboardPlayer,
} from "../web/world/match.js";
import { homePosition } from "../web/world/formation.js";
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

function indexOfRole(match, name) {
  return match.players.findIndex((player) => player.role.name === name);
}

function play(match, actions, ticks) {
  let current = match;
  for (let tick = 0; tick < ticks; tick += 1)
    current = advanceMatch(current, actions, TICK);
  return current;
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

test("a standing player runs to the home the ball asks for, not the kick-off one", () => {
  const match = createMatch();
  const moved = play(withBallAt(match, BALL_UP_THE_PITCH), STILL, 120);
  moved.players.forEach((player, index) => {
    if (index === match.keyboardIndex) return;
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

test("keys move the keyboard player and nobody else", () => {
  const match = advanceMatch(createMatch(), RUNNING_UP, 0.1);
  const still = createMatch();
  match.players.forEach((player, index) => {
    if (index === match.keyboardIndex) return;
    assert.deepEqual(player.position, still.players[index].position);
  });
  assert.ok(
    keyboardPlayer(match).position.y < keyboardPlayer(still).position.y,
  );
});

test("a player away from their place runs back to it and settles", () => {
  const kickedOff = createMatch();
  const strayIndex = indexOfRole(kickedOff, "keeper");
  const home = kickedOff.players[strayIndex].position;
  const stray = placed(kickedOff, {
    [strayIndex]: { x: home.x + 10, y: home.y },
  });

  const back = play(stray, STILL, 300).players[strayIndex];
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

test("a one-player match dribbles straight and around a corner", () => {
  let match = createOnePlayerMatch();
  let widestGap = 0;
  for (const actions of [RUNNING_UP, RUNNING_RIGHT])
    for (let tick = 0; tick < 120; tick += 1) {
      match = advanceMatch(match, actions, TICK);
      const player = keyboardPlayer(match);
      widestGap = Math.max(
        widestGap,
        Math.hypot(
          match.ball.position.x - player.position.x,
          match.ball.position.y - player.position.y,
        ),
      );
    }
  assert.ok(widestGap <= DRIBBLE.controlRadius);
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
