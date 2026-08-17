// Everything a player body can do: run, be steered at a point, meet the ball,
// touch and kick it, and give way to the bodies around it.
import { add, length, scale, subtract } from "./math.js";
import {
  BODY,
  DRIBBLE,
  KICK,
  PLAYER,
  PLAYER_CARRYING,
  STEERING,
} from "./tuning.js";
import { launchBall } from "./ball.js";
import { keepOnPitch, PITCH_BOUNDS } from "./pitch.js";

const UP_THE_PITCH = Object.freeze({ x: 0, y: -1 });
const STILL = Object.freeze({ x: 0, y: 0 });

// A run is the way the player heads and the pace they hold along it. The
// heading is a unit vector that outlives the run, so a player who has stopped
// still faces the way they last moved.
export function createPlayer(
  position = { x: 0, y: 0 },
  heading = UP_THE_PITCH,
) {
  return {
    position,
    heading,
    speed: 0,
  };
}

export function velocityOf(player) {
  return scale(player.heading, player.speed);
}

export function setHeadingAndSpeed(player, direction, settings = PLAYER) {
  const velocity = scale(direction, settings.maxSpeed);
  const speed = length(velocity);
  return {
    ...player,
    heading: speed === 0 ? player.heading : scale(velocity, 1 / speed),
    speed,
  };
}

export function advancePlayer(player, seconds, bounds = PITCH_BOUNDS) {
  const intended = velocityOf(player);
  const moved = add(player.position, scale(intended, seconds));
  const velocity = {
    x: stoppedAtTheLine(moved.x, intended.x, bounds.minX, bounds.maxX),
    y: stoppedAtTheLine(moved.y, intended.y, bounds.minY, bounds.maxY),
  };
  const speed = length(velocity);
  return {
    ...player,
    position: keepOnPitch(moved, bounds),
    heading: speed === 0 ? player.heading : scale(velocity, 1 / speed),
    speed,
  };
}

// Running into the touchline kills the speed into it, so a player held there
// does not shoot off when the line is left behind.
function stoppedAtTheLine(position, velocity, minimum, maximum) {
  const blockedOutward =
    (position < minimum && velocity < 0) ||
    (position > maximum && velocity > 0);
  return blockedOutward ? 0 : velocity;
}

// The eight directions are the unit vectors of the held keys, so a diagonal
// runs at the same speed as a straight line.
export function directionFromInput(keys) {
  const held = {
    x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
    y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
  };
  const size = length(held);
  return size === 0 ? held : scale(held, 1 / size);
}

// Off the ball a player is steered at a point rather than by keys. The
// direction shortens inside the slowing distance, so the run eases onto the
// point instead of arriving flat out, overshooting and turning back.
export function directionToward(position, target, settings = STEERING) {
  const offset = subtract(target, position);
  const distance = length(offset);
  if (distance <= settings.arrivalRadius) return STILL;
  const toward = scale(offset, 1 / distance);
  const pace = Math.min(distance / settings.slowingDistance, 1);
  return scale(toward, pace);
}

// The earliest point on the ball's path the player can be standing at in time.
// A ball that outruns the player gives its last point, which is where the chase
// ends up anyway, and a time that ranks such a player behind every interceptor.
export function interception(ballPath, player) {
  const met = ballPath.find((sample) =>
    playable(sample, groundGap(sample.position, player.position)),
  );
  const outrun = ballPath[ballPath.length - 1];
  const meeting = met ?? outrun;
  return { ...meeting, gap: groundGap(meeting.position, player.position) };
}

// A whole tick of the walk shares one arrival time, so the shorter run breaks
// the tie: without it a high ball that every player reaches at the same tick
// would be chased by whoever the player list happens to hold first.
export function soonerThan(one, other) {
  return one.seconds === other.seconds
    ? one.gap < other.gap
    : one.seconds < other.seconds;
}

// The player of those the filter keeps who can meet the ball soonest, with his
// index, or null when the filter keeps nobody.
export function soonestToMeet(players, ballPath, keep) {
  return players.reduce((soonest, player, index) => {
    if (!keep(player)) return soonest;
    const meeting = interception(ballPath, player);
    return !soonest || soonerThan(meeting, soonest.meeting)
      ? { meeting, index }
      : soonest;
  }, null);
}

function playable({ position, seconds }, gap) {
  return (
    position.z <= DRIBBLE.maxTouchHeight &&
    gap <= PLAYER.maxSpeed * seconds + DRIBBLE.controlRadius
  );
}

// Two locks on touching the ball: touchTimer paces dribbling and the early
// toucher may bypass it; retouchTimer stops the kicker retaking their own kick
// and has no bypass.
export function createControl() {
  return {
    touchTimer: 0,
    retouchTimer: 0,
  };
}

// Possession means loose-ball play, not stored ownership. It emerges from
// touches while the ball remains free. kickCharge is match-level, not per
// player: there is one button, so no charge is left stranded on a player the
// selection leaves.
export function advancePossession(
  { players, ball, recentToucherIndex, kickCharge },
  { directions, earlyToucherIndex, kickingPlayerIndex, kickHeld },
  seconds,
) {
  const previousToucherIndex = activeRecentToucher({
    players,
    recentToucherIndex,
  });
  const cooled = players.map((player) => ({
    ...player,
    control: countDownTimers(player.control, seconds),
  }));
  // A player is only slowed while he is the carrier, and who the carrier is
  // changes in the middle of this step. Only the carrier of the previous step
  // is slowed on the way in, so a player who wins the ball here plays his
  // first touch at his full running pace.
  const arriving = pacedByCarrier(cooled, directions, previousToucherIndex);
  const played = playBall(
    { players: arriving, ball, kickCharge },
    {
      directions,
      earlyToucherIndex,
      previousToucherIndex,
      kickingPlayerIndex,
      kickHeld,
    },
    seconds,
  );
  const carrierIndex = played.didKick ? null : activeRecentToucher(played);

  return {
    // The carry that the touch just started is what the slower pace is for, so
    // it lands here, after the ball has been played.
    players: pacedByCarrier(played.players, directions, carrierIndex),
    ball: played.ball,
    recentToucherIndex: carrierIndex,
    kickCharge: played.kickCharge,
    didKick: played.didKick,
  };
}

function playBall(
  { players, ball, kickCharge },
  {
    directions,
    earlyToucherIndex,
    previousToucherIndex,
    kickingPlayerIndex,
    kickHeld,
  },
  seconds,
) {
  const touched = playTouch(
    players,
    ball,
    directions,
    earlyToucherIndex,
    previousToucherIndex,
  );
  return playKick(
    { ...touched, kickCharge },
    { kickingPlayerIndex, kickHeld },
    seconds,
  );
}

// The carrier runs at the slower carrying pace; everyone else runs free.
function pacedByCarrier(players, directions, carrierIndex) {
  return players.map((player, index) =>
    setHeadingAndSpeed(
      player,
      directions[index],
      index === carrierIndex ? PLAYER_CARRYING : PLAYER,
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

  const touched = touchBall(players[index], ball, directions[index]);
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
    const gap = touchableBallGap(player, ball, index === earlyToucherIndex);
    if (gap === null || gap >= nearestGap) continue;
    nearestIndex = index;
    nearestGap = gap;
  }
  return nearestIndex;
}

function touchableBallGap(
  player,
  ball,
  ignoreTouchTimer = false,
  settings = DRIBBLE,
) {
  const { control } = player;
  if (
    control.retouchTimer > 0 ||
    (!ignoreTouchTimer && control.touchTimer > 0) ||
    ball.position.z > settings.maxTouchHeight
  )
    return null;

  const gap = groundGap(player.position, ball.position);
  return gap <= settings.controlRadius ? gap : null;
}

function touchBall(player, ball, direction, settings = DRIBBLE) {
  const heading = touchDirection(direction, player.heading);
  const targetAtNextTouch = add(
    player.position,
    scale(heading, player.speed * settings.touchPeriod + settings.idealLead),
  );
  return {
    control: {
      ...player.control,
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

function playKick(state, { kickingPlayerIndex, kickHeld }, seconds) {
  const player = state.players[kickingPlayerIndex];
  const kicked = advanceKick(
    state.kickCharge,
    player,
    state.ball,
    kickHeld,
    seconds,
  );
  return {
    players: kicked.didKick
      ? withRetouchTimer(state.players, kickingPlayerIndex)
      : state.players,
    ball: kicked.ball,
    recentToucherIndex: state.recentToucherIndex,
    kickCharge: kicked.kickCharge,
    didKick: kicked.didKick,
  };
}

function advanceKick(
  kickCharge,
  player,
  ball,
  buttonHeld,
  seconds,
  settings = KICK,
) {
  if (buttonHeld)
    return {
      kickCharge: Math.min(kickCharge + seconds, settings.maximumCharge),
      ball,
      didKick: false,
    };

  if (kickCharge === 0 || !withinKickingRange(player, ball, settings))
    return { kickCharge: 0, ball, didKick: false };

  return {
    kickCharge: 0,
    ball: strike(ball, player.heading, kickCharge, settings),
    didKick: true,
  };
}

function withinKickingRange(player, ball, settings) {
  return (
    ball.position.z <= settings.maximumHeight &&
    groundGap(player.position, ball.position) <= settings.range
  );
}

function strike(ball, heading, kickCharge, settings) {
  const strength = kickCharge / settings.maximumCharge;
  return launchBall(
    ball,
    Math.atan2(heading.y, heading.x),
    strength * settings.maximumElevation,
    settings.minimumPower +
      strength * (settings.maximumPower - settings.minimumPower),
  );
}

function withRetouchTimer(players, kickingPlayerIndex, settings = KICK) {
  return players.map((player, index) =>
    index === kickingPlayerIndex
      ? {
          ...player,
          control: { ...player.control, retouchTimer: settings.retouchDelay },
        }
      : player,
  );
}

function countDownTimers(control, seconds) {
  return {
    ...control,
    touchTimer: countDown(control.touchTimer, seconds),
    retouchTimer: countDown(control.retouchTimer, seconds),
  };
}

const EPSILON = 1e-9;

function countDown(timer, seconds) {
  const left = timer - seconds;
  return left > EPSILON ? left : 0;
}

// Bodies take up room: two players standing closer than a body apart give way
// to each other by equal amounts until they just touch. The push is a share of
// the overlap per second, so a crowd opens over a few ticks rather than
// snapping apart.
export function partBodies(
  players,
  seconds,
  settings = BODY,
  bounds = PITCH_BOUNDS,
) {
  return players.map((player, index) => {
    const push = players.reduce((total, other, otherIndex) => {
      if (index === otherIndex) return total;
      return add(
        total,
        pushApart(
          player.position,
          other.position,
          index < otherIndex,
          seconds,
          settings,
        ),
      );
    }, STILL);
    return movedBy(player, push, bounds);
  });
}

// Half of the overlap is this body's to give up, taken in over the tick.
function pushApart(position, otherPosition, earlier, seconds, settings) {
  const offset = subtract(position, otherPosition);
  const distance = length(offset);
  if (distance >= settings.diameter) return STILL;
  // Two players on the very same spot have no direction to part along, so the
  // pair's order in the list decides it and the result stays deterministic.
  const away =
    distance === 0
      ? { x: earlier ? -1 : 1, y: 0 }
      : scale(offset, 1 / distance);
  const share = (settings.diameter - distance) / 2;
  return scale(away, share * Math.min(settings.pushRate * seconds, 1));
}

// The push moves the body only: its run is untouched, and the touchline stops
// it as it stops a run.
function movedBy(player, push, bounds) {
  return {
    ...player,
    position: keepOnPitch(add(player.position, push), bounds),
  };
}

function groundGap(position, other) {
  return length(subtract(position, other));
}
