import { BALL } from "../web/tuning.js";

// A ball standing where it is put, on the ground unless a height is given.
export function ballAt(position, velocity = { x: 0, y: 0, z: 0 }) {
  return { position: { ...position, z: position.z ?? BALL.radius }, velocity };
}

// Only where a player stands: the rules under test read nothing else of them.
export function playerAt(position) {
  return { position };
}

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
