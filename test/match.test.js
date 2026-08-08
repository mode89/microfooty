import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceMatch,
  createMatch,
  keyboardPlayer,
} from "../web/world/match.js";
import { homePosition } from "../web/world/formation.js";
import { TEAMS } from "../web/world/team.js";
import { BODY, DRIBBLE, PLAYER, STEERING } from "../web/tuning.js";

const STILL = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  kick: false,
  debug: false,
});
const RUNNING_UP = Object.freeze({ ...STILL, up: true });
const KICKING_UP = Object.freeze({ ...RUNNING_UP, kick: true });
const TICK = 1 / 60;

// Stands the keyboard player a stride below the ball on the centre spot, so a
// run up the pitch reaches it. Nothing else moves in this step, so this is the
// only way a test can set up a touch.
const STRIDE_BEHIND_THE_BALL = 0.9;

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

function standingBehindTheBall(match) {
  return placed(match, {
    [match.keyboardIndex]: { x: 0, y: STRIDE_BEHIND_THE_BALL },
  });
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
  match.players.forEach((player) => assert.equal(player.control.cooldown, 0));
  assert.equal(
    new Set(match.players.map((player) => player.control)).size,
    match.players.length,
  );
});

test("every player starts on the home place of their role", () => {
  createMatch().players.forEach((player) =>
    assert.deepEqual(
      player.position,
      homePosition(player.role, player.team.attackingDirection),
    ),
  );
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
  assert.ok(Math.hypot(back.velocity.x, back.velocity.y) < 0.01);
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
