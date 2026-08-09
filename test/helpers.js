// The run a velocity stands for: the heading it points along and the pace it
// holds. A zero velocity is not a run and has no heading of its own.
export function runAt(velocity) {
  const speed = Math.hypot(velocity.x, velocity.y);
  return {
    heading: { x: velocity.x / speed, y: velocity.y / speed },
    speed,
  };
}
