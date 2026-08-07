import { add, clamp, length, scale, subtract } from "../math/vec.js";
import { PITCH_BOUNDS } from "./pitch.js";

export const PLAYER = Object.freeze({
  maxSpeed: 7,
  acceleration: 28,
  braking: 24,
  sideBias: 0.15,
  facingHysteresis: 0.05,
});

const FACING_DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

export const createPlayer = (position = { x: 0, y: 0 }) => ({
  position,
  velocity: { x: 0, y: 0 },
  facing: "up",
});

export const advancePlayer = (
  player,
  direction,
  seconds,
  settings = PLAYER,
  bounds = PITCH_BOUNDS,
) => {
  const velocity = steer(player.velocity, direction, seconds, settings);
  const moved = add(player.position, scale(velocity, seconds));
  const x = resolveAxis(moved.x, velocity.x, bounds.minX, bounds.maxX);
  const y = resolveAxis(moved.y, velocity.y, bounds.minY, bounds.maxY);
  return {
    position: { x: x.position, y: y.position },
    velocity: { x: x.velocity, y: y.velocity },
    facing: chooseFacing(player.facing, direction, settings),
  };
};

// The eight directions are the unit vectors of the held keys, so a diagonal
// runs at the same speed as a straight line.
export const directionFromInput = (keys) => {
  const held = {
    x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
    y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0),
  };
  const size = length(held);
  return size === 0 ? held : scale(held, 1 / size);
};

// Each facing scores how well it lines up with the direction. The side facings
// carry a bias, so a 45 degree diagonal always picks left or right, and the
// current facing carries a smaller one, which leaves a dead band around every
// boundary. The smaller bias is what stops a wobbling diagonal from flickering
// while still letting the diagonal rule win.
export const chooseFacing = (current, direction, settings = PLAYER) => {
  if (length(direction) === 0) return current;
  const score = (facing) =>
    direction.x * FACING_DIRECTIONS[facing].x +
    direction.y * FACING_DIRECTIONS[facing].y +
    (facing === "left" || facing === "right" ? settings.sideBias : 0) +
    (facing === current ? settings.facingHysteresis : 0);
  return Object.keys(FACING_DIRECTIONS).reduce((best, facing) =>
    score(facing) > score(best) ? facing : best,
  );
};

// Moves the velocity towards the target at a fixed rate without overshooting
// it. A released direction targets zero, which is the friction that stops the
// player.
const steer = (velocity, direction, seconds, settings) => {
  const change = subtract(scale(direction, settings.maxSpeed), velocity);
  const size = length(change);
  const rate =
    length(direction) === 0 ? settings.braking : settings.acceleration;
  const step = rate * seconds;
  return size <= step
    ? add(velocity, change)
    : add(velocity, scale(change, step / size));
};

const resolveAxis = (position, velocity, minimum, maximum) => {
  const blockedOutward =
    (position < minimum && velocity < 0) ||
    (position > maximum && velocity > 0);
  return {
    position: clamp(position, minimum, maximum),
    velocity: blockedOutward ? 0 : velocity,
  };
};
