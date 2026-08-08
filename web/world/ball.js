const EPSILON = 1e-9;

export const BALL = Object.freeze({
  radius: 0.11,
  gravity: 9.81,
  airDrag: 0.12,
  rollingDeceleration: 3.2,
  restitution: 0.55,
  bounceHorizontalRetention: 0.8,
  rollingStopSpeed: 0.08,
  minimumBounceImpactSpeed: 0.7,
});

export function createBall(position = { x: 0, y: 0 }, settings = BALL) {
  return {
    position: { x: position.x, y: position.y, z: settings.radius },
    velocity: { x: 0, y: 0, z: 0 },
  };
}

export function launchBall(ball, heading, elevation, power) {
  return {
    position: ball.position,
    velocity: {
      x: Math.cos(heading) * Math.cos(elevation) * power,
      y: Math.sin(heading) * Math.cos(elevation) * power,
      z: Math.sin(elevation) * power,
    },
  };
}

export function advanceBall(ball, seconds, settings = BALL) {
  let current = ball;
  let remaining = seconds;

  while (remaining > 0) {
    if (isGrounded(current, settings))
      return combineMotion(roll(current, remaining, settings), {
        height: settings.radius,
        speed: 0,
      });

    const landingSeconds = secondsUntilGround(current, settings);
    if (landingSeconds > remaining)
      return moveThroughAir(current, remaining, settings);

    const impact = moveThroughAir(current, landingSeconds, settings);
    current = resolveImpact(impact, settings);
    remaining = Math.max(0, remaining - landingSeconds);
  }

  return current;
}

function isGrounded(ball, settings) {
  return (
    ball.position.z <= settings.radius + EPSILON &&
    Math.abs(ball.velocity.z) <= EPSILON
  );
}

function moveThroughAir(ball, seconds, settings) {
  return combineMotion(
    glide(ball, seconds, settings),
    fall(ball, seconds, settings),
  );
}

function secondsUntilGround(ball, settings) {
  const height = Math.max(0, ball.position.z - settings.radius);
  if (height === 0)
    return ball.velocity.z > 0 ? (2 * ball.velocity.z) / settings.gravity : 0;

  const root = Math.sqrt(
    ball.velocity.z * ball.velocity.z + 2 * settings.gravity * height,
  );
  return ball.velocity.z >= 0
    ? (ball.velocity.z + root) / settings.gravity
    : (2 * height) / (root - ball.velocity.z);
}

function resolveImpact(ball, settings) {
  const impactSpeed = -ball.velocity.z;
  const bouncing = impactSpeed >= settings.minimumBounceImpactSpeed;
  const horizontalRetention = bouncing ? settings.bounceHorizontalRetention : 1;
  return combineMotion(
    {
      position: { x: ball.position.x, y: ball.position.y },
      velocity: {
        x: ball.velocity.x * horizontalRetention,
        y: ball.velocity.y * horizontalRetention,
      },
    },
    {
      height: settings.radius,
      speed: bouncing ? impactSpeed * settings.restitution : 0,
    },
  );
}

// Constant deceleration ends at a defined speed transition, so rolling stops
// at the same position whether the duration is advanced at once or in parts.
function roll(ball, seconds, settings) {
  const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
  if (speed <= settings.rollingStopSpeed)
    return {
      position: { x: ball.position.x, y: ball.position.y },
      velocity: { x: 0, y: 0 },
    };

  if (settings.rollingDeceleration === 0)
    return {
      position: {
        x: ball.position.x + ball.velocity.x * seconds,
        y: ball.position.y + ball.velocity.y * seconds,
      },
      velocity: { x: ball.velocity.x, y: ball.velocity.y },
    };

  const secondsToStop =
    (speed - settings.rollingStopSpeed) / settings.rollingDeceleration;
  const travelSeconds = Math.min(seconds, secondsToStop);
  const slowed = speed - settings.rollingDeceleration * travelSeconds;
  const travel = ((speed + slowed) / 2) * travelSeconds;
  const kept = seconds >= secondsToStop ? 0 : slowed / speed;
  return {
    position: {
      x: ball.position.x + (ball.velocity.x / speed) * travel,
      y: ball.position.y + (ball.velocity.y / speed) * travel,
    },
    velocity: { x: ball.velocity.x * kept, y: ball.velocity.y * kept },
  };
}

// Exponential air drag is integrated exactly. expm1 preserves travel distance
// when drag is too small for subtracting the exponential from one accurately.
function glide(ball, seconds, settings) {
  if (settings.airDrag === 0)
    return {
      position: {
        x: ball.position.x + ball.velocity.x * seconds,
        y: ball.position.y + ball.velocity.y * seconds,
      },
      velocity: { x: ball.velocity.x, y: ball.velocity.y },
    };

  const kept = Math.exp(-settings.airDrag * seconds);
  const travel = -Math.expm1(-settings.airDrag * seconds) / settings.airDrag;
  return {
    position: {
      x: ball.position.x + ball.velocity.x * travel,
      y: ball.position.y + ball.velocity.y * travel,
    },
    velocity: { x: ball.velocity.x * kept, y: ball.velocity.y * kept },
  };
}

function fall(ball, seconds, settings) {
  return {
    height:
      ball.position.z +
      ball.velocity.z * seconds -
      0.5 * settings.gravity * seconds * seconds,
    speed: ball.velocity.z - settings.gravity * seconds,
  };
}

function combineMotion(horizontal, vertical) {
  return {
    position: { ...horizontal.position, z: vertical.height },
    velocity: { ...horizontal.velocity, z: vertical.speed },
  };
}
