const EPSILON = 1e-9;

export const BALL = Object.freeze({
  radius: 0.11,
  gravity: 9.81,
  airDrag: 0.12,
  rollFriction: 3.2,
  restitution: 0.55,
  bounceGrip: 0.8,
  restSpeed: 0.08,
  restBounceSpeed: 0.7,
});

export const createBall = (position = { x: 0, y: 0 }, settings = BALL) => ({
  position: { x: position.x, y: position.y, z: settings.radius },
  velocity: { x: 0, y: 0, z: 0 },
});

export const launchBall = (ball, heading, elevation, power) => ({
  position: ball.position,
  velocity: {
    x: Math.cos(heading) * Math.cos(elevation) * power,
    y: Math.sin(heading) * Math.cos(elevation) * power,
    z: Math.sin(elevation) * power,
  },
});

export const advanceBall = (ball, seconds, settings = BALL) => {
  const horizontal = isGrounded(ball, settings)
    ? roll(ball, seconds, settings)
    : glide(ball, seconds, settings);
  const vertical = fall(ball, seconds, settings);
  return land(
    {
      position: { ...horizontal.position, z: vertical.position },
      velocity: { ...horizontal.velocity, z: vertical.velocity },
    },
    settings,
  );
};

const isGrounded = (ball, settings) =>
  ball.position.z <= settings.radius + EPSILON &&
  Math.abs(ball.velocity.z) <= EPSILON;

// Constant deceleration, with a floor below which the ball is put at rest so a
// rolling ball cannot creep forever at a vanishing speed.
const roll = (ball, seconds, settings) => {
  const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
  if (speed === 0) return { position: ball.position, velocity: ball.velocity };
  const slowed = Math.max(0, speed - settings.rollFriction * seconds);
  const travel = ((speed + slowed) / 2) * seconds;
  const kept = slowed < settings.restSpeed ? 0 : slowed / speed;
  return {
    position: {
      x: ball.position.x + (ball.velocity.x / speed) * travel,
      y: ball.position.y + (ball.velocity.y / speed) * travel,
    },
    velocity: { x: ball.velocity.x * kept, y: ball.velocity.y * kept },
  };
};

// Exponential air drag on the horizontal velocity, integrated exactly, so the
// path does not change when the same time span is split into more ticks.
const glide = (ball, seconds, settings) => {
  const kept = Math.exp(-settings.airDrag * seconds);
  const travel = (1 - kept) / settings.airDrag;
  return {
    position: {
      x: ball.position.x + ball.velocity.x * travel,
      y: ball.position.y + ball.velocity.y * travel,
    },
    velocity: { x: ball.velocity.x * kept, y: ball.velocity.y * kept },
  };
};

const fall = (ball, seconds, settings) => ({
  position:
    ball.position.z +
    ball.velocity.z * seconds -
    0.5 * settings.gravity * seconds * seconds,
  velocity: ball.velocity.z - settings.gravity * seconds,
});

const land = (ball, settings) => {
  if (ball.position.z >= settings.radius) return ball;
  const impact = -ball.velocity.z;
  const resting = impact < settings.restBounceSpeed;
  const grip = resting ? 1 : settings.bounceGrip;
  return {
    position: { ...ball.position, z: settings.radius },
    velocity: {
      x: ball.velocity.x * grip,
      y: ball.velocity.y * grip,
      z: resting ? 0 : impact * settings.restitution,
    },
  };
};
