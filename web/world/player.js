import { add, dot, length, scale, subtract } from "../math/vec.js";
import { PLAYER } from "../tuning.js";
import { keepOnPitch, PITCH_BOUNDS } from "./pitch.js";

const UP_THE_PITCH = Object.freeze({ x: 0, y: -1 });

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

export function advancePlayer(
  player,
  direction,
  seconds,
  settings = PLAYER,
  bounds = PITCH_BOUNDS,
) {
  const steered = steer(velocityOf(player), direction, seconds, settings);
  const moved = add(player.position, scale(steered, seconds));
  const velocity = {
    x: stoppedAtTheLine(moved.x, steered.x, bounds.minX, bounds.maxX),
    y: stoppedAtTheLine(moved.y, steered.y, bounds.minY, bounds.maxY),
  };
  const speed = length(velocity);
  return {
    position: keepOnPitch(moved, bounds),
    // A stopped run has no heading of its own, so it keeps the one it stopped on.
    heading: speed === 0 ? player.heading : scale(velocity, 1 / speed),
    speed,
  };
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

// Moves the velocity towards the target at a fixed rate without overshooting
// it. A released direction targets zero, which is the friction that stops the
// player. Running against the current velocity brakes, running with it
// accelerates, so a turn is as sharp as a stop.
function steer(velocity, direction, seconds, settings) {
  const change = subtract(scale(direction, settings.maxSpeed), velocity);
  const size = length(change);
  const released = length(direction) === 0;
  const againstTheRun = dot(direction, velocity) < 0;
  const rate =
    released || againstTheRun ? settings.braking : settings.acceleration;
  const step = rate * seconds;
  return size <= step
    ? add(velocity, change)
    : add(velocity, scale(change, step / size));
}

// Running into the touchline kills the speed into it, so a player held there
// does not shoot off when the line is left behind.
function stoppedAtTheLine(position, velocity, minimum, maximum) {
  const blockedOutward =
    (position < minimum && velocity < 0) ||
    (position > maximum && velocity > 0);
  return blockedOutward ? 0 : velocity;
}
