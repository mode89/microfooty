// Possession means loose-ball play, not stored ownership. It emerges from
// touches while the ball remains free.
import { add, length, scale, subtract } from "../math/vec.js";
import { DRIBBLE, KICK, PLAYER, PLAYER_CARRYING } from "../tuning.js";
import { launchBall } from "./ball.js";
import { setHeadingAndSpeed } from "./player.js";

export function createControl() {
  return {
    touchTimer: 0,
    charge: 0,
  };
}

export function advancePossession(
  { players, ball, recentToucherIndex },
  { directions, earlyToucherIndex, kickingPlayerIndex, kickHeld },
  seconds,
) {
  const previousToucherIndex = activeRecentToucher({
    players,
    recentToucherIndex,
  });
  const cooled = players.map((player) => ({
    ...player,
    control: advanceTouchTimer(player.control, seconds),
  }));
  const playersReadyToTouch = setPlayerHeadingsAndSpeeds(
    cooled,
    directions,
    previousToucherIndex,
  );
  const touched = playTouch(
    playersReadyToTouch,
    ball,
    directions,
    earlyToucherIndex,
    previousToucherIndex,
  );
  const kicked = playKick(touched, kickingPlayerIndex, kickHeld, seconds);
  const finalToucherIndex = kicked.didKick ? null : activeRecentToucher(kicked);

  return {
    players: setPlayerHeadingsAndSpeeds(
      kicked.players,
      directions,
      finalToucherIndex,
    ),
    ball: kicked.ball,
    recentToucherIndex: finalToucherIndex,
    didKick: kicked.didKick,
  };
}

function setPlayerHeadingsAndSpeeds(players, directions, recentToucherIndex) {
  return players.map((player, index) =>
    setHeadingAndSpeed(
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
  earlyToucherIndex,
  recentToucherIndex,
) {
  const index = nearestToucher(players, ball, earlyToucherIndex);
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

function nearestToucher(players, ball, earlyToucherIndex) {
  let nearestIndex = null;
  let nearestGap = Infinity;
  for (let index = 0; index < players.length; index += 1) {
    const player = players[index];
    const gap = touchableBallGap(
      player.control,
      player,
      ball,
      index === earlyToucherIndex,
    );
    if (gap === null || gap >= nearestGap) continue;
    nearestIndex = index;
    nearestGap = gap;
  }
  return nearestIndex;
}

function playKick(state, kickingPlayerIndex, kickHeld, seconds) {
  const player = state.players[kickingPlayerIndex];
  const kicked = advanceKick(
    player.control,
    player,
    state.ball,
    kickHeld,
    seconds,
  );
  return {
    players: state.players.map((candidate, index) =>
      index === kickingPlayerIndex
        ? { ...candidate, control: kicked.control }
        : candidate,
    ),
    ball: kicked.ball,
    recentToucherIndex: state.recentToucherIndex,
    didKick: kicked.didKick,
  };
}

function advanceTouchTimer(control, seconds) {
  return {
    ...control,
    touchTimer: countDown(control.touchTimer, seconds),
  };
}

function touchableBallGap(
  control,
  player,
  ball,
  ignoreTouchTimer = false,
  settings = DRIBBLE,
) {
  if (
    (!ignoreTouchTimer && control.touchTimer > 0) ||
    ball.position.z > settings.maxTouchHeight
  )
    return null;

  const gap = groundGap(player, ball);
  return gap <= settings.controlRadius ? gap : null;
}

function touchBall(control, player, ball, direction, settings = DRIBBLE) {
  const heading = touchDirection(direction, player.heading);
  const targetAtNextTouch = add(
    player.position,
    scale(heading, player.speed * settings.touchPeriod + settings.idealLead),
  );
  return {
    control: {
      ...control,
      touchTimer: settings.touchPeriod,
    },
    ball: {
      position: ball.position,
      velocity: {
        ...scale(
          subtract(targetAtNextTouch, ball.position),
          1 / settings.touchPeriod,
        ),
        z: ball.velocity.z,
      },
    },
  };
}

function touchDirection(direction, fallback) {
  const size = length(direction);
  return size === 0 ? fallback : scale(direction, 1 / size);
}

function advanceKick(
  control,
  player,
  ball,
  buttonHeld,
  seconds,
  settings = KICK,
) {
  if (buttonHeld)
    return {
      control: {
        ...control,
        charge: Math.min(control.charge + seconds, settings.maximumCharge),
      },
      ball,
      didKick: false,
    };

  const released = { ...control, charge: 0 };
  if (control.charge === 0 || !withinKickingRange(player, ball, settings))
    return { control: released, ball, didKick: false };

  return {
    control: { ...released, touchTimer: settings.touchDelay },
    ball: strike(ball, player.heading, control.charge, settings),
    didKick: true,
  };
}

function withinKickingRange(player, ball, settings) {
  return (
    ball.position.z <= settings.maximumHeight &&
    groundGap(player, ball) <= settings.range
  );
}

function strike(ball, heading, charge, settings) {
  const strength = charge / settings.maximumCharge;
  return launchBall(
    ball,
    Math.atan2(heading.y, heading.x),
    strength * settings.maximumElevation,
    settings.minimumPower +
      strength * (settings.maximumPower - settings.minimumPower),
  );
}

function groundGap(player, ball) {
  return length(subtract(ball.position, player.position));
}

const EPSILON = 1e-9;

function countDown(timer, seconds) {
  const left = timer - seconds;
  return left > EPSILON ? left : 0;
}
