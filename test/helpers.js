// No key held: the input a tick reads when the player asks for nothing.
export const STILL = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  kick: false,
  debug: false,
});

// The run a velocity stands for: the heading it points along and the pace it
// holds. A zero velocity is not a run and has no heading of its own.
export function runAt(velocity) {
  const speed = Math.hypot(velocity.x, velocity.y);
  return {
    heading: { x: velocity.x / speed, y: velocity.y / speed },
    speed,
  };
}
