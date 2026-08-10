// Where to run to meet the ball, not where the ball is now. The ball's own
// future is walked with the ball's own rules, so bounce, drag and rolling
// friction need no second model here.
import { DRIBBLE, INTERCEPTION, PLAYER } from "../tuning.js";
import { advanceBall } from "./ball.js";

// One path serves every player in a tick: the ball's future does not depend on
// who is chasing it.
export function ballPath(ball, settings = INTERCEPTION) {
  // Floored, so a step that does not divide the horizon stops just inside it
  // rather than just past it.
  const steps = Math.floor(settings.horizonSeconds / settings.stepSeconds);
  const path = [{ position: ball.position, seconds: 0 }];
  let rolling = ball;
  for (let step = 1; step <= steps; step += 1) {
    rolling = advanceBall(rolling, settings.stepSeconds);
    path.push({
      position: rolling.position,
      seconds: step * settings.stepSeconds,
    });
  }
  return path;
}

// The earliest point on the path the player can be standing at in time. A ball
// that outruns the player gives its last point, which is where the chase ends
// up anyway, and a time that ranks such a player behind every interceptor.
export function interception(path, player) {
  const met = path.find((sample) =>
    playable(sample, groundGap(sample.position, player.position)),
  );
  const outrun = path[path.length - 1];
  const meeting = met ?? outrun;
  return { ...meeting, gap: groundGap(meeting.position, player.position) };
}

// A whole tick of the walk shares one arrival time, so the shorter run breaks
// the tie: without it a high ball that every player reaches at the same tick
// would be chased by whoever the player list happens to hold first.
export function soonerThan(one, other) {
  return one.seconds === other.seconds
    ? one.gap < other.gap
    : one.seconds < other.seconds;
}

function playable({ position, seconds }, gap) {
  return (
    position.z <= DRIBBLE.maxTouchHeight &&
    gap <= PLAYER.maxSpeed * seconds + DRIBBLE.controlRadius
  );
}

function groundGap(position, from) {
  return Math.hypot(position.x - from.x, position.y - from.y);
}
