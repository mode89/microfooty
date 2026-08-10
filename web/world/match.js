// The whole match in one state: twenty-two players, one loose ball, the team of
// the last touch, and the selection the keyboard follows.
import { runDirections } from "../ai/roles.js";
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
    // lastTouchTeam outlives recentToucherIndex: the toucher clears with his
    // touch timer, the team stands until the next contact.
    lastTouchTeam: null,
    keyboardEngaged: false,
    keyboardDirection: STILL,
    recentToucherIndex: null,
    kickCharge: 0,
  };
}

export function advanceMatch(match, actions, seconds) {
  const path = ballPath(match.ball);
  const selectedIndex = selectPlayer(match, path);
  const keyboardEngaged = nextKeyboardGrip(match, selectedIndex, actions);
  const keyboardDirection = directionFromInput(actions);
  const kickingPlayerIndex = selectedIndex;
  const directions = runDirections({
    players: match.players,
    ballPosition: match.ball.position,
    path,
    keyboardRun: keyboardEngaged
      ? { index: selectedIndex, direction: keyboardDirection }
      : null,
  });
  const possession = advancePossession(
    possessionStateOf(match, kickingPlayerIndex),
    {
      directions,
      earlyToucherIndex:
        keyboardEngaged &&
        directionChanged(match.keyboardDirection, keyboardDirection)
          ? selectedIndex
          : null,
      kickingPlayerIndex,
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
    lastTouchTeam: teamOfLastTouch(match, possession, kickingPlayerIndex),
    keyboardEngaged,
    keyboardDirection,
    recentToucherIndex: possession.recentToucherIndex,
    kickCharge: possession.kickCharge,
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

function possessionStateOf(match, kickingPlayerIndex) {
  const { players, ball, recentToucherIndex } = match;
  return {
    players,
    ball,
    recentToucherIndex,
    kickCharge: chargeKeptOnSelection(match, kickingPlayerIndex),
  };
}

// A player just handed the selection never pulled his leg back, so his wind-up
// starts again from nothing even while the button stays held.
function chargeKeptOnSelection(match, kickingPlayerIndex) {
  return kickingPlayerIndex === match.selectedIndex ? match.kickCharge : 0;
}

// A kick is a contact of its own, and it clears the recent toucher on the tick
// it strikes, so the kicker's team is read straight off the kicker.
function teamOfLastTouch(match, { didKick, recentToucherIndex }, kickerIndex) {
  if (didKick) return match.players[kickerIndex].team;
  if (recentToucherIndex === null) return match.lastTouchTeam;
  return match.players[recentToucherIndex].team;
}
