import { add, clamp, length, scale, subtract } from "../math/vec.js";
import { PLAYER } from "../tuning.js";
import { PITCH_BOUNDS } from "./pitch.js";

const FACING_DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

export function createPlayer(position = { x: 0, y: 0 }) {
  return {
    position,
    velocity: { x: 0, y: 0 },
    facing: "up",
  };
}

export function advancePlayer(
  player,
  direction,
  seconds,
  settings = PLAYER,
  bounds = PITCH_BOUNDS,
) {
  const velocity = steer(player.velocity, direction, seconds, settings);
  const moved = add(player.position, scale(velocity, seconds));
  const x = resolveAxis(moved.x, velocity.x, bounds.minX, bounds.maxX);
  const y = resolveAxis(moved.y, velocity.y, bounds.minY, bounds.maxY);
  return {
    position: { x: x.position, y: y.position },
    velocity: { x: x.velocity, y: y.velocity },
    facing: chooseFacing(player.facing, direction, settings),
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

// Each facing scores how well it lines up with the direction. The favoured
// facing of the quadrant carries a bias, so a 45 degree diagonal always picks
// it, and the current facing carries a smaller one, which leaves a dead band
// around every boundary. The smaller bias is what stops a wobbling diagonal
// from flickering while still letting the diagonal rule win.
export function chooseFacing(current, direction, settings = PLAYER) {
  if (length(direction) === 0) return current;
  const favoured = favouredFacings(direction);
  function score(facing) {
    return (
      direction.x * FACING_DIRECTIONS[facing].x +
      direction.y * FACING_DIRECTIONS[facing].y +
      (favoured.includes(facing) ? settings.diagonalBias : 0) +
      (facing === current ? settings.facingHysteresis : 0)
    );
  }
  return Object.keys(FACING_DIRECTIONS).reduce((best, facing) =>
    score(facing) > score(best) ? facing : best,
  );
}

// A diagonal that heads up the pitch is drawn with the up frame, which shows
// the player's back; every other diagonal is drawn with a side frame.
function favouredFacings(direction) {
  return direction.y < 0 ? ["up"] : ["left", "right"];
}

// Moves the velocity towards the target at a fixed rate without overshooting
// it. A released direction targets zero, which is the friction that stops the
// player.
function steer(velocity, direction, seconds, settings) {
  const change = subtract(scale(direction, settings.maxSpeed), velocity);
  const size = length(change);
  const rate =
    length(direction) === 0 ? settings.braking : settings.acceleration;
  const step = rate * seconds;
  return size <= step
    ? add(velocity, change)
    : add(velocity, scale(change, step / size));
}

function resolveAxis(position, velocity, minimum, maximum) {
  const blockedOutward =
    (position < minimum && velocity < 0) ||
    (position > maximum && velocity > 0);
  return {
    position: clamp(position, minimum, maximum),
    velocity: blockedOutward ? 0 : velocity,
  };
}
