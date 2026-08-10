// Every constant that is judged by feel rather than derived from the rules of
// the game, gathered so that tuning a session is one file. Pitch dimensions,
// sprite sizes and key bindings are not here: they are given, not tuned.
import { PITCH } from "./world/pitch.js";

export const PLAYER = Object.freeze({
  maxSpeed: 8,
  carryingSpeedFactor: 0.9,
});

// Carrying the ball costs pace, so a loose ball can be chased faster than it
// can be dribbled.
export const PLAYER_CARRYING = Object.freeze({
  ...PLAYER,
  maxSpeed: PLAYER.maxSpeed * PLAYER.carryingSpeedFactor,
});

export const BALL = Object.freeze({
  radius: 0.11,
  gravity: 9.81,
  airDrag: 0.12,
  rollingDeceleration: 5.0,
  restitution: 0.55,
  bounceHorizontalRetention: 0.8,
  rollingStopSpeed: 0.08,
  minimumBounceImpactSpeed: 0.7,
});

export const DRIBBLE = Object.freeze({
  controlRadius: 1,
  maxTouchHeight: 0.35,
  touchPeriod: 1 / 3,
  idealLead: 0.8,
});

// A kick reaches exactly as far as a touch, so a ball that cannot be dribbled
// cannot be kicked either.
export const KICK = Object.freeze({
  range: DRIBBLE.controlRadius,
  maximumHeight: DRIBBLE.maxTouchHeight,
  retouchDelay: DRIBBLE.touchPeriod,
  maximumCharge: 0.3,
  minimumPower: 9,
  maximumPower: 28,
  maximumElevation: Math.PI / 8,
});

// Running to a spot: the run eases off inside the slowing distance and ends
// inside the arrival radius, which is what keeps a standing player still
// instead of shivering on the spot.
export const STEERING = Object.freeze({
  arrivalRadius: 0.3,
  slowingDistance: 2,
});

// A team slides with the ball rather than standing in fixed places. One reach
// serves all ten outfielders, so they slide as one block and the lines keep
// their spacing; the keeper is held on a shorter rein. A reach caps a slide
// either way, and these leave the keeper 0.15 m short of its own goal line, so
// the pitch clamp in homePosition is a backstop for retuning rather than a rule
// that fires today.
export const SHAPE = Object.freeze({
  alongPitch: Object.freeze({ follow: 0.5, outfieldReach: 8, keeperReach: 3 }),
  acrossPitch: Object.freeze({
    follow: 0.25,
    outfieldReach: 8,
    keeperReach: 4,
  }),
});

// A chase is aimed by walking the ball's future in steps of this size, as far
// ahead as the horizon. The step is written to match the simulation's tick in
// `web/loop.js`, which keeps the walk and the match on the same samples; the
// two are set apart so that tuning the walk cannot slow the match down.
export const INTERCEPTION = Object.freeze({
  stepSeconds: 1 / 60,
  horizonSeconds: 5,
});

// Control moves to the teammate who can meet the ball soonest, but only once
// that teammate is quicker by this margin, which is what stops two chasers
// trading the selection back and forth.
export const SELECTION = Object.freeze({
  switchMargin: 0.25,
});

// A body gives way at a share of the overlap per second, so a crowd opens over
// a few ticks rather than snapping apart.
export const BODY = Object.freeze({
  diameter: 1,
  pushRate: 8,
});

export const VISIBLE_PITCH_WIDTH_FRACTION = 0.9;

export const CAMERA = Object.freeze({
  worldUnitsPerScreenWidth: PITCH.width * VISIBLE_PITCH_WIDTH_FRACTION,
  smoothingSeconds: 1.5,
  lookaheadSeconds: 3.0,
  maxLookahead: 20,
  boundsMargin: 5,
});
