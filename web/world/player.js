import { add, length, scale } from "../math/vec.js";
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

export function setRun(player, direction, settings = PLAYER) {
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

// Running into the touchline kills the speed into it, so a player held there
// does not shoot off when the line is left behind.
function stoppedAtTheLine(position, velocity, minimum, maximum) {
  const blockedOutward =
    (position < minimum && velocity < 0) ||
    (position > maximum && velocity > 0);
  return blockedOutward ? 0 : velocity;
}
