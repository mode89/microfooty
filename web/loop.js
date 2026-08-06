export const TICK_SECONDS = 1 / 60;
export const MAX_FRAME_SECONDS = 0.25;

// Splits an elapsed frame into whole simulation ticks plus the leftover time,
// expressed as the interpolation factor `alpha` in [0, 1).
export function advance(
  accumulator,
  frameSeconds,
  tickSeconds = TICK_SECONDS,
  maxFrameSeconds = MAX_FRAME_SECONDS,
) {
  const clamped = Math.min(Math.max(frameSeconds, 0), maxFrameSeconds);
  const total = accumulator + clamped;
  const ticks = Math.floor(total / tickSeconds);
  const rest = total - ticks * tickSeconds;
  return { ticks, accumulator: rest, alpha: rest / tickSeconds };
}

export function startLoop({
  tick,
  render,
  tickSeconds = TICK_SECONDS,
  maxFrameSeconds = MAX_FRAME_SECONDS,
  now = () => performance.now() / 1000,
  schedule = (frame) => requestAnimationFrame(frame),
}) {
  let accumulator = 0;
  let previous = now();

  const frame = () => {
    const current = now();
    const frameSeconds = current - previous;
    previous = current;

    const step = advance(accumulator, frameSeconds, tickSeconds, maxFrameSeconds);
    accumulator = step.accumulator;
    for (let i = 0; i < step.ticks; i += 1) tick(tickSeconds);
    render(step.alpha, frameSeconds);

    schedule(frame);
  };

  schedule(frame);
}
