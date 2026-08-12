import test from "node:test";
import assert from "node:assert/strict";
import { chasePointByTeam } from "../web/ai/chase.js";
import { predictBallPath } from "../web/ball.js";
import { PLAYER } from "../web/tuning.js";
import { ballAt, playerAt } from "./helpers.js";

const OURS = { name: "ours" };
const THEIRS = { name: "theirs" };
const OUTFIELD = Object.freeze({ name: "outfielder", keeper: false });
const KEEPER = Object.freeze({ name: "keeper", keeper: true });

function chaserFor(players, ball) {
  return chasePointByTeam(players, predictBallPath(ball));
}

function player(team, position, role = OUTFIELD) {
  return { ...playerAt(position), team, role };
}

test("each team sends one chaser and no more", () => {
  const players = [
    player(OURS, { x: 0, y: 10 }),
    player(OURS, { x: 0, y: 30 }),
    player(THEIRS, { x: 0, y: -10 }),
    player(THEIRS, { x: 0, y: -30 }),
  ];
  const chasePoints = chaserFor(players, ballAt({ x: 0, y: 0 }));
  assert.equal(chasePoints.size, 2);
  assert.deepEqual([...chasePoints.keys()].sort(), [0, 2]);
});

test("the chaser is the player who meets the ball soonest", () => {
  const players = [
    player(OURS, { x: 0, y: 40 }),
    player(OURS, { x: 0, y: 2 }),
    player(OURS, { x: 0, y: 20 }),
  ];
  const chasePoints = chaserFor(players, ballAt({ x: 0, y: 0 }));
  assert.deepEqual([...chasePoints.keys()], [1]);
});

test("a keeper chases when he is the soonest of his team", () => {
  const players = [
    player(OURS, { x: 0, y: 1 }, KEEPER),
    player(OURS, { x: 0, y: 30 }),
  ];
  const chasePoints = chaserFor(players, ballAt({ x: 0, y: 0 }));
  assert.deepEqual([...chasePoints.keys()], [0]);
});

// A chase run at the ball itself trails a moving ball for ever, so the point is
// taken from the ball's future rather than from where it stands now.
test("the chase point leads a running ball", () => {
  const rolling = ballAt({ x: 0, y: 0 }, { x: 0, y: 8, z: 0 });
  const chasePoints = chaserFor(
    [player(OURS, { x: 0, y: PLAYER.maxSpeed * 2 })],
    rolling,
  );
  assert.ok(chasePoints.get(0).y > rolling.position.y);
});
