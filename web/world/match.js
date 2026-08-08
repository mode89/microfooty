// The whole match in one state: twenty-two players standing in two shapes, one
// loose ball, and the single player the keyboard drives. Later steps add
// fields here rather than reshape it.
import { PLAYER, PLAYER_CARRYING } from "../tuning.js";
import { advanceBall, createBall } from "./ball.js";
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
  const players = teams.flatMap((team) =>
    team.roles.map((role) => createMatchPlayer(team, role)),
  );
  const keyboardIndex = players.findIndex(
    (player) => player.team === teams[0] && player.role.name === KEYBOARD_ROLE,
  );
  if (keyboardIndex < 0)
    throw new Error(`no ${KEYBOARD_ROLE} for the keyboard to drive`);

  return { players, ball: createBall(), keyboardIndex };
}

// Only the keyboard player moves in this step: the other twenty-one stand in
// their formation places until the AI arrives.
export function advanceMatch(match, actions, seconds) {
  const played = playBall(
    runPlayer(keyboardPlayer(match), actions, seconds),
    advanceBall(match.ball, seconds),
    actions.kick,
    seconds,
  );
  return {
    ...match,
    players: match.players.map((player, index) =>
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
function createMatchPlayer(team, role) {
  return {
    team,
    role,
    ...createPlayer(
      homePosition(role, team.attackingDirection),
      team.attackingDirection === DOWN_THE_PITCH ? "down" : "up",
    ),
    control: createControl(),
  };
}

function runPlayer(player, actions, seconds) {
  // Set by the previous tick's touch: this tick's touch needs the player to
  // have moved first.
  const carrying = isCarrying(player.control);
  return {
    ...player,
    ...advancePlayer(
      player,
      directionFromInput(actions),
      seconds,
      carrying ? PLAYER_CARRYING : PLAYER,
    ),
  };
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
