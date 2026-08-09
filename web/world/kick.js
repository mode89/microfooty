// Touching and kicking a loose ball. The ball is never attached to the player:
// a player who reaches a low ball touches it on, then has to catch it again.
import { add, length, scale, subtract } from "../math/vec.js";
import { DRIBBLE, KICK } from "../tuning.js";
import { launchBall } from "./ball.js";

export function createControl() {
  return {
    touchTimer: 0,
    charge: 0,
  };
}

export function advanceTouchTimer(control, seconds) {
  return {
    ...control,
    touchTimer: countDown(control.touchTimer, seconds),
  };
}

export function touchableBallGap(
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

export function touchBall(
  control,
  player,
  ball,
  direction,
  settings = DRIBBLE,
) {
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

// A kick is charged by holding the button down and struck on release. Power
// and launch angle both rise with the charge, so a tap is a flat pass and a
// full hold a rising shot. It goes along the heading, which outlives the run,
// so a player who has stopped kicks the way they last ran.
export function advanceKick(
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
