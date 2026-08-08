// Off the ball a player is steered at a point rather than by keys. The
// direction shortens inside the slowing distance, so the run eases onto the
// point instead of arriving flat out, overshooting and turning back.
import { length, scale, subtract } from "../math/vec.js";
import { STEERING } from "../tuning.js";

const STILL = Object.freeze({ x: 0, y: 0 });

export function directionToward(position, target, settings = STEERING) {
  const offset = subtract(target, position);
  const distance = length(offset);
  if (distance <= settings.arrivalRadius) return STILL;
  const toward = scale(offset, 1 / distance);
  const pace = Math.min(distance / settings.slowingDistance, 1);
  return scale(toward, pace);
}
