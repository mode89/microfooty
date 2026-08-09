// The whole match in one state: twenty-two players, one loose ball, and the
// single player the keyboard drives.
import { directionToward } from "../ai/steering.js";
import { PLAYER, PLAYER_CARRYING } from "../tuning.js";
import { advanceBall, createBall } from "./ball.js";
import { partBodies } from "./bodies.js";
import { homePosition } from "./formation.js";
import {
  advanceKick,
  advanceTouchTimer,
  createControl,
  touchableBallGap,
  touchBall,
} from "./kick.js";
import {
  advancePlayer,
  createPlayer,
  directionFromInput,
  setRun,
} from "./player.js";
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
  const previousToucherIndex = activeRecentToucher(match);
  const cooled = match.players.map((player) => ({
    ...player,
    control: advanceTouchTimer(player.control, seconds),
  }));
  const playersReadyToTouch = setRuns(cooled, directions, previousToucherIndex);
  const touched = playTouch(
    playersReadyToTouch,
    match.ball,
    directions,
    directionChanged(match.keyboardDirection, keyboardDirection)
      ? match.keyboardIndex
      : null,
    previousToucherIndex,
  );
  const kicked = playKick(touched, match.keyboardIndex, actions.kick, seconds);
  const recentToucherIndex = kicked.didKick
    ? null
    : activeRecentToucher(kicked);
  const playersReadyToMove = setRuns(
    kicked.players,
    directions,
    recentToucherIndex,
  );
  const players = partBodies(
    playersReadyToMove.map((player) => advancePlayer(player, seconds)),
    seconds,
  );

  return {
    ...match,
    players,
    ball: advanceBall(kicked.ball, seconds),
    keyboardDirection,
    recentToucherIndex,
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

function setRuns(players, directions, recentToucherIndex) {
  return players.map((player, index) =>
    setRun(
      player,
      directions[index],
      index === recentToucherIndex ? PLAYER_CARRYING : PLAYER,
    ),
  );
}

function activeRecentToucher({ recentToucherIndex, players }) {
  return recentToucherIndex !== null &&
    players[recentToucherIndex].control.touchTimer > 0
    ? recentToucherIndex
    : null;
}

function playTouch(
  players,
  ball,
  directions,
  timerBypassIndex,
  recentToucherIndex,
) {
  const index = nearestToucher(players, ball, timerBypassIndex);
  if (index === null) return { players, ball, recentToucherIndex };

  const touched = touchBall(
    players[index].control,
    players[index],
    ball,
    directions[index],
  );
  return {
    players: players.map((player, playerIndex) =>
      playerIndex === index ? { ...player, control: touched.control } : player,
    ),
    ball: touched.ball,
    recentToucherIndex: index,
  };
}

function nearestToucher(players, ball, timerBypassIndex) {
  let nearestIndex = null;
  let nearestGap = Infinity;
  for (let index = 0; index < players.length; index += 1) {
    const player = players[index];
    const gap = touchableBallGap(
      player.control,
      player,
      ball,
      index === timerBypassIndex,
    );
    if (gap === null || gap >= nearestGap) continue;
    nearestIndex = index;
    nearestGap = gap;
  }
  return nearestIndex;
}

function playKick(state, keyboardIndex, kicking, seconds) {
  const player = state.players[keyboardIndex];
  const kicked = advanceKick(
    player.control,
    player,
    state.ball,
    kicking,
    seconds,
  );
  return {
    players: state.players.map((candidate, index) =>
      index === keyboardIndex
        ? { ...candidate, control: kicked.control }
        : candidate,
    ),
    ball: kicked.ball,
    recentToucherIndex: state.recentToucherIndex,
    didKick: kicked.didKick,
  };
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
