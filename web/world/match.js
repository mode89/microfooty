// The whole match in one state: twenty-two players standing in two shapes, one
// loose ball, and the single player the keyboard drives. Later steps add
// fields here rather than reshape it.
import { directionToward } from "../ai/steering.js";
import { PLAYER, PLAYER_CARRYING } from "../tuning.js";
import { advanceBall, createBall } from "./ball.js";
import { partBodies } from "./bodies.js";
import { homePosition } from "./formation.js";
import {
  advanceDribble,
  advanceKick,
  createControl,
  isCarrying,
} from "./kick.js";
import { advancePlayer, createPlayer, directionFromInput } from "./player.js";
import { DOWN_THE_PITCH } from "./pitch.js";
import { TEAMS } from "./team.js";

const KEYBOARD_ROLE = "rightStriker";

export function createMatch(teams = TEAMS) {
  const ball = createBall();
  const players = teams.flatMap((team) =>
    team.roles.map((role) => createMatchPlayer(team, role, ball.position)),
  );
  const keyboardIndex = players.findIndex(
    (player) => player.team === teams[0] && player.role.name === KEYBOARD_ROLE,
  );
  if (keyboardIndex < 0)
    throw new Error(`no ${KEYBOARD_ROLE} for the keyboard to drive`);

  return { players, ball, keyboardIndex };
}

// Everyone runs: the keyboard player on the held keys, the other twenty-one
// back to their formation place. Bodies are parted after the runs, so a push
// cannot be undone by the same tick's movement. Only the keyboard player plays
// the ball until step 4.
export function advanceMatch(match, actions, seconds) {
  const run = match.players.map((player, index) =>
    runPlayer(
      player,
      index === match.keyboardIndex
        ? directionFromInput(actions)
        : directionHome(player, match.ball.position),
      seconds,
    ),
  );
  const players = partBodies(run, seconds);
  const played = playBall(
    players[match.keyboardIndex],
    advanceBall(match.ball, seconds),
    actions.kick,
    seconds,
  );
  return {
    ...match,
    players: players.map((player, index) =>
      index === match.keyboardIndex ? played.player : player,
    ),
    ball: played.ball,
  };
}

export function keyboardPlayer(match) {
  return match.players[match.keyboardIndex];
}

// A player on the pitch is the M1 player plus the side and role they play and
// how they stand with the ball. Everyone starts facing the goal they attack.
function createMatchPlayer(team, role, ballPosition) {
  return {
    team,
    role,
    ...createPlayer(
      homePosition(role, team.attackingDirection, ballPosition),
      team.attackingDirection === DOWN_THE_PITCH ? "down" : "up",
    ),
    control: createControl(),
  };
}

function runPlayer(player, direction, seconds) {
  // Set by the previous tick's touch: this tick's touch needs the player to
  // have moved first.
  const carrying = isCarrying(player.control);
  return {
    ...player,
    ...advancePlayer(
      player,
      direction,
      seconds,
      carrying ? PLAYER_CARRYING : PLAYER,
    ),
  };
}

// The place a role stands slides with the ball, so a run home this tick aims at
// the shape the ball asked for at the end of the last one.
function directionHome(player, ballPosition) {
  return directionToward(
    player.position,
    homePosition(player.role, player.team.attackingDirection, ballPosition),
  );
}

function playBall(player, ball, kicking, seconds) {
  const touched = advanceDribble(player.control, player, ball, seconds);
  const kicked = advanceKick(
    touched.control,
    player,
    touched.ball,
    kicking,
    seconds,
  );
  return {
    player: { ...player, control: kicked.control },
    ball: kicked.ball,
  };
}
