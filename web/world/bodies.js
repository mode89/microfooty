// Bodies take up room: two players standing closer than a body apart give way
// to each other by equal amounts until they just touch. The push is a share of
// the overlap per second, so a crowd opens over a few ticks rather than
// snapping apart.
import { add, length, scale, subtract } from "../math/vec.js";
import { BODY } from "../tuning.js";
import { keepOnPitch, PITCH_BOUNDS } from "./pitch.js";

const STILL = Object.freeze({ x: 0, y: 0 });

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
