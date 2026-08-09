// The whole match in one state: twenty-two players, one loose ball, and the
// single player the keyboard drives.
import { directionToward } from "../ai/steering.js";
import { advanceBall, createBall } from "./ball.js";
import { partBodies } from "./bodies.js";
import { homePosition } from "./formation.js";
import { advancePossession, createControl } from "./possession.js";
import { advancePlayer, createPlayer, directionFromInput } from "./player.js";
import { TEAMS } from "./team.js";

const KEYBOARD_ROLE = "rightStriker";
const STILL = Object.freeze({ x: 0, y: 0 });

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

  return {
    players,
    ball,
    keyboardIndex,
    keyboardDirection: STILL,
    recentToucherIndex: null,
  };
}

export function advanceMatch(match, actions, seconds) {
  const keyboardDirection = directionFromInput(actions);
  const directions = match.players.map((player, index) =>
    index === match.keyboardIndex
      ? keyboardDirection
      : directionHome(player, match.ball.position),
  );
  const possession = advancePossession(
    {
      players: match.players,
      ball: match.ball,
      recentToucherIndex: match.recentToucherIndex,
    },
    {
      directions,
      earlyToucherIndex: directionChanged(
        match.keyboardDirection,
        keyboardDirection,
      )
        ? match.keyboardIndex
        : null,
      kickingPlayerIndex: match.keyboardIndex,
      kickHeld: actions.kick,
    },
    seconds,
  );
  const players = partBodies(
    possession.players.map((player) => advancePlayer(player, seconds)),
    seconds,
  );

  return {
    ...match,
    players,
    ball: advanceBall(possession.ball, seconds),
    keyboardDirection,
    recentToucherIndex: possession.recentToucherIndex,
  };
}

export function keyboardPlayer(match) {
  return match.players[match.keyboardIndex];
}

function createMatchPlayer(team, role, ballPosition) {
  return {
    team,
    role,
    ...createPlayer(
      homePosition(role, team.attackingDirection, ballPosition),
      attackingHeading(team),
    ),
    control: createControl(),
  };
}

function attackingHeading(team) {
  return { x: 0, y: team.attackingDirection };
}

function directionChanged(before, after) {
  return before.x !== after.x || before.y !== after.y;
}

function directionHome(player, ballPosition) {
  return directionToward(
    player.position,
    homePosition(player.role, player.team.attackingDirection, ballPosition),
  );
}
