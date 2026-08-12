import test from "node:test";
import assert from "node:assert/strict";
import { runDirections } from "../web/ai/off-ball.js";
import { predictBallPath } from "../web/ball.js";
import { FORMATION_442, homePosition } from "../web/team.js";
import { DOWN_THE_PITCH } from "../web/pitch.js";
import { ballAt, playerAt } from "./helpers.js";

const TEAM = Object.freeze({
  name: "ours",
  attackingDirection: DOWN_THE_PITCH,
});
const STRIKER = FORMATION_442.find((role) => role.name === "leftStriker");
const BACK = FORMATION_442.find((role) => role.name === "leftBack");

const BALL = ballAt({ x: 0, y: 0 });

function player(position, role) {
  return { ...playerAt(position), team: TEAM, role };
}

function directionsFor(players, keyboardRun = null) {
  return runDirections({
    players,
    ballPosition: BALL.position,
    ballPath: predictBallPath(BALL),
    keyboardRun,
  });
}

function pointsAt(direction, from, target) {
  const gap = { x: target.x - from.x, y: target.y - from.y };
  const size = Math.hypot(gap.x, gap.y);
  return (
    Math.abs(
      direction.x / Math.hypot(direction.x, direction.y) - gap.x / size,
    ) < 1e-9
  );
}

test("every player is given a run of his own", () => {
  const players = [
    player({ x: -20, y: 30 }, BACK),
    player({ x: 20, y: 30 }, STRIKER),
    player({ x: 0, y: 40 }, STRIKER),
  ];
  assert.equal(directionsFor(players).length, players.length);
});

test("a player off the ball runs at the home his role asks for", () => {
  const away = player({ x: -30, y: 40 }, BACK);
  const chaser = player({ x: 0, y: 1 }, STRIKER);
  const [, direction] = directionsFor([chaser, away]);
  const home = homePosition(BACK, TEAM.attackingDirection, BALL.position);
  assert.ok(pointsAt(direction, away.position, home));
});

test("the chaser runs at the ball rather than at his home", () => {
  const chaser = player({ x: 0, y: 20 }, BACK);
  const [direction] = directionsFor([chaser, player({ x: 0, y: 45 }, BACK)]);
  const home = homePosition(BACK, TEAM.attackingDirection, BALL.position);
  assert.ok(pointsAt(direction, chaser.position, BALL.position));
  assert.ok(!pointsAt(direction, chaser.position, home));
});

// The keyboard outranks both the chase and the role, so the player it drives
// goes where the keys point even while he is his team's nearest to the ball.
test("the keyboard's own player runs where the keys point", () => {
  const driven = player({ x: 0, y: 5 }, STRIKER);
  const keys = { x: -1, y: 0 };
  const [direction] = directionsFor([driven], { index: 0, direction: keys });
  assert.deepEqual(direction, keys);
});
