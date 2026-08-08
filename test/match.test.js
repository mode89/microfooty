import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceMatch,
  createMatch,
  keyboardPlayer,
} from "../web/world/match.js";
import { homePosition } from "../web/world/formation.js";
import { TEAMS } from "../web/world/team.js";
import { DRIBBLE, PLAYER } from "../web/tuning.js";

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

function standingBehindTheBall(match) {
  return {
    ...match,
    players: match.players.map((player, index) =>
      index === match.keyboardIndex
        ? { ...player, position: { x: 0, y: STRIDE_BEHIND_THE_BALL } }
        : player,
    ),
  };
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
