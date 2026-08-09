// Touching and kicking a loose ball. The ball is never attached to the player:
// a running player who reaches a low ball touches it on, then has to catch up
// with it again, so a bouncing ball cannot be controlled until it drops and a
// fast one can be run past and lost.
import { add, clampLength, dot, length, scale, subtract } from "../math/vec.js";
import { DRIBBLE, KICK } from "../tuning.js";
import { launchBall } from "./ball.js";
import { velocityOf } from "./player.js";

// How the player stands with the ball: how long since they last played it and
// which way they were running when they did, and the kick they are winding up
// to play it next.
export function createControl() {
  return {
    cooldown: 0,
    touchHeading: null,
    charge: 0,
  };
}

// The player is carrying the ball while their last touch is still fresh. A
// kick starts the same cooldown but leaves no heading behind, and a ball that
// has been kicked away is nobody's to carry.
export function isCarrying(control) {
  return control.cooldown > 0 && control.touchHeading !== null;
}

export function advanceDribble(
  control,
  player,
  ball,
  seconds,
  settings = DRIBBLE,
) {
  const cooled = { ...control, cooldown: countDown(control.cooldown, seconds) };
  if (!touchIsDue(cooled, player, ball, settings))
    return { control: cooled, ball };

  return {
    control: {
      ...cooled,
      cooldown: settings.touchCooldown,
      touchHeading: player.heading,
    },
    ball: touch(player, ball, settings),
  };
}

function touchIsDue(control, player, ball, settings) {
  return (
    player.speed >= settings.minimumRunSpeed &&
    readyAgain(control, player, settings) &&
    ball.position.z <= settings.maxTouchHeight &&
    groundGap(player, ball) <= settings.controlRadius
  );
}

// A sharp change of direction earns a touch at once. Waiting out the cooldown
// would leave the ball rolling on where the run used to point, and by the time
// the next touch fell due it would be out of reach. A ball that was kicked
// rather than touched has no heading to compare, and no turn wins it back.
function readyAgain(control, player, settings) {
  return (
    control.cooldown === 0 ||
    (control.touchHeading !== null &&
      dot(player.heading, control.touchHeading) <
        Math.cos(settings.sharpTurnAngle))
  );
}

// A touch sends the ball out at the run's own pace and a little over, so the
// strength of a touch belongs to the player who makes it. The change a touch
// may work is limited as well, so a ball arriving faster than the run is
// deflected rather than stopped dead at the feet.
function touch(player, ball, settings) {
  const aimed = clampLength(
    aimedVelocity(player, ball, settings),
    player.speed * settings.maxTouchOutrun,
  );
  const change = clampLength(
    subtract(aimed, ball.velocity),
    settings.maxTouchSpeedChange,
  );
  return {
    position: ball.position,
    velocity: { ...add(ball.velocity, change), z: ball.velocity.z },
  };
}

// The velocity that carries the ball to the place it should hold, one lead
// ahead along the run. The run's own velocity is part of it because that place
// travels with the player; the rest closes the gap to it.
//
// Aiming at a place rather than a direction is what carries the ball round a
// turn: it is always steered back in front of the feet instead of rolling on
// where the run used to point. The ball is aimed to arrive as the next touch
// falls due, so each touch corrects the whole error it can see and none
// overshoots the place the following one starts from.
function aimedVelocity(player, ball, settings) {
  const target = add(
    player.position,
    scale(player.heading, settings.idealLead),
  );
  return add(
    velocityOf(player),
    scale(subtract(target, ball.position), 1 / settings.touchCooldown),
  );
}

// A kick is charged by holding the button down and struck on release. Power
// and launch angle both rise with the charge, so a tap is a flat pass and a
// full hold a rising shot. It goes along the heading, which outlives the run,
// so a player who has stopped kicks the way they last ran and one who has
// never moved kicks the way their team attacks.
export function advanceKick(
  control,
  player,
  ball,
  buttonHeld,
  seconds,
  settings = KICK,
) {
  if (buttonHeld)
    return {
      control: {
        ...control,
        charge: Math.min(control.charge + seconds, settings.maximumCharge),
      },
      ball,
    };

  const released = { ...control, charge: 0 };
  if (control.charge === 0 || !withinKickingRange(player, ball, settings))
    return { control: released, ball };

  // Kicking plays the ball, so it starts the touch cooldown: without that the
  // next touch falls due while the pass is still at the feet and dribbles it
  // back. It leaves no heading behind, so turning away cannot win the ball
  // back either — a player who kicks up the pitch and runs down must let it go.
  return {
    control: { ...released, cooldown: settings.cooldown, touchHeading: null },
    ball: strike(ball, player.heading, control.charge, settings),
  };
}

function withinKickingRange(player, ball, settings) {
  return (
    ball.position.z <= settings.maximumHeight &&
    groundGap(player, ball) <= settings.range
  );
}

function strike(ball, heading, charge, settings) {
  const strength = charge / settings.maximumCharge;
  return launchBall(
    ball,
    Math.atan2(heading.y, heading.x),
    strength * settings.maximumElevation,
    settings.minimumPower +
      strength * (settings.maximumPower - settings.minimumPower),
  );
}

function groundGap(player, ball) {
  return length(subtract(ball.position, player.position));
}

// Counting down in tick-sized steps leaves a float remainder rather than
// landing on zero, so a remainder this small counts as spent.
const EPSILON = 1e-9;

function countDown(cooldown, seconds) {
  const left = cooldown - seconds;
  return left > EPSILON ? left : 0;
}
