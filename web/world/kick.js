// Loose-ball dribbling. The ball is never attached to the player: a running
// player who reaches a low ball touches it on, then has to catch up with it
// again, so a bouncing ball cannot be controlled until it drops and a fast one
// can be run past and lost.
import { add, clampLength, dot, length, scale, subtract } from "../math/vec.js";

export const DRIBBLE = Object.freeze({
  controlRadius: 1,
  maxTouchHeight: 0.35,
  minimumRunSpeed: 0.1,
  touchCooldown: 0.1,
  sharpTurnAngle: Math.PI / 3,
  idealLead: 0.8,
  maxTouchOutrun: 2,
  maxTouchSpeedChange: 10,
});

export const createDribble = () => ({ cooldown: 0, heading: null });

// The player is carrying the ball while the last touch is still fresh, which
// is the window the cooldown already measures.
export const isCarrying = (dribble) => dribble.cooldown > 0;

export const advanceDribble = (
  dribble,
  player,
  ball,
  seconds,
  settings = DRIBBLE,
) => {
  const cooled = { ...dribble, cooldown: countDown(dribble.cooldown, seconds) };
  if (!touchIsDue(cooled, player, ball, settings))
    return { dribble: cooled, ball };

  return {
    dribble: { cooldown: settings.touchCooldown, heading: headingOf(player) },
    ball: touch(player, ball, settings),
  };
};

const touchIsDue = (dribble, player, ball, settings) =>
  length(player.velocity) >= settings.minimumRunSpeed &&
  readyAgain(dribble, player, settings) &&
  ball.position.z <= settings.maxTouchHeight &&
  groundGap(player, ball) <= settings.controlRadius;

// A sharp change of direction earns a touch at once. Waiting out the cooldown
// would leave the ball rolling on where the run used to point, and by the time
// the next touch fell due it would be out of reach.
const readyAgain = (dribble, player, settings) =>
  dribble.cooldown === 0 ||
  dot(headingOf(player), dribble.heading) < Math.cos(settings.sharpTurnAngle);

// A touch sends the ball out at the run's own pace and a little over, so the
// strength of a touch belongs to the player who makes it. The change a touch
// may work is limited as well, so a ball arriving faster than the run is
// deflected rather than stopped dead at the feet.
const touch = (player, ball, settings) => {
  const aimed = clampLength(
    aimedVelocity(player, ball, settings),
    length(player.velocity) * settings.maxTouchOutrun,
  );
  const change = clampLength(
    subtract(aimed, ball.velocity),
    settings.maxTouchSpeedChange,
  );
  return {
    position: ball.position,
    velocity: { ...add(ball.velocity, change), z: ball.velocity.z },
  };
};

// The velocity that carries the ball to the place it should hold, one lead
// ahead along the run. The run's own velocity is part of it because that place
// travels with the player; the rest closes the gap to it.
//
// Aiming at a place rather than a direction is what carries the ball round a
// turn: it is always steered back in front of the feet instead of rolling on
// where the run used to point. The drawn facing is not used, since it has four
// frames and would knock a diagonal run's ball sideways. The ball is aimed to
// arrive as the next touch falls due, so each touch corrects the whole error
// it can see and none overshoots the place the following one starts from.
const aimedVelocity = (player, ball, settings) => {
  const target = add(
    player.position,
    scale(headingOf(player), settings.idealLead),
  );
  return add(
    player.velocity,
    scale(subtract(target, ball.position), 1 / settings.touchCooldown),
  );
};

const groundGap = (player, ball) =>
  length(subtract(ball.position, player.position));

// A player who is not moving has no heading. The zero vector keeps the touch
// defined when settings allow one to be attempted at all.
const headingOf = (player) => {
  const speed = length(player.velocity);
  return speed === 0 ? { x: 0, y: 0 } : scale(player.velocity, 1 / speed);
};

// Counting down in tick-sized steps leaves a float remainder rather than
// landing on zero, so a remainder this small counts as spent.
const EPSILON = 1e-9;

const countDown = (cooldown, seconds) => {
  const left = cooldown - seconds;
  return left > EPSILON ? left : 0;
};
