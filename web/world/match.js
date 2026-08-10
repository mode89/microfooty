// The whole match in one state: twenty-two players, one loose ball, and the
// selection the keyboard follows.
import { runDirections } from "../ai/roles.js";
import { SELECTION } from "../tuning.js";
import { ballPath } from "./interception.js";
import { nextKeyboardGrip, selectPlayer } from "./selection.js";
import { advanceBall, createBall } from "./ball.js";
import { partBodies } from "./bodies.js";
import { homePosition } from "./formation.js";
import { advancePossession, createControl } from "./possession.js";
import { advancePlayer, createPlayer, directionFromInput } from "./player.js";
import { TEAMS } from "./team.js";

const FIRST_SELECTED_ROLE = "rightStriker";
const STILL = Object.freeze({ x: 0, y: 0 });

export function createMatch(teams = TEAMS) {
  const ball = createBall();
  const players = teams.flatMap((team) =>
    team.roles.map((role) => createMatchPlayer(team, role, ball.position)),
  );
  const selectedIndex = players.findIndex(
    (player) =>
      player.team === teams[0] && player.role.name === FIRST_SELECTED_ROLE,
  );
  if (selectedIndex < 0)
    throw new Error(`no ${FIRST_SELECTED_ROLE} for the keyboard to drive`);

  return {
    players,
    ball,
    selectedIndex,
    selectionHold: 0,
    keyboardEngaged: false,
    keyboardDirection: STILL,
    recentToucherIndex: null,
  };
}

export function advanceMatch(match, actions, seconds) {
  const path = ballPath(match.ball);
  const selectionHold = Math.max(0, match.selectionHold - seconds);
  const selectedIndex = selectPlayer({ ...match, selectionHold }, path);
  const keyboardEngaged = nextKeyboardGrip(match, selectedIndex, actions);
  const keyboardDirection = directionFromInput(actions);
  const directions = runDirections({
    players: match.players,
    ballPosition: match.ball.position,
    path,
    keyboardRun: keyboardEngaged
      ? { index: selectedIndex, direction: keyboardDirection }
      : null,
  });
  const possession = advancePossession(
    {
      players: match.players,
      ball: match.ball,
      recentToucherIndex: match.recentToucherIndex,
    },
    {
      directions,
      earlyToucherIndex:
        keyboardEngaged &&
        directionChanged(match.keyboardDirection, keyboardDirection)
          ? selectedIndex
          : null,
      kickingPlayerIndex: selectedIndex,
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
    selectedIndex,
    selectionHold: possession.didKick
      ? SELECTION.holdAfterKickSeconds
      : selectionHold,
    keyboardEngaged,
    keyboardDirection,
    recentToucherIndex: possession.recentToucherIndex,
  };
}

export function selectedPlayer(match) {
  return match.players[match.selectedIndex];
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
