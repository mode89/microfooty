import { startLoop } from "./loop.js";
import { createInput, EMPTY_INPUT } from "./input.js";
import { clamp } from "./math/vec.js";
import { advanceBall, createBall, launchBall } from "./world/ball.js";
import {
  clampCamera,
  createCamera,
  createView,
  followCamera,
} from "./view/camera.js";
import { renderBall, renderPitch } from "./view/render.js";
import { createBallSprite } from "./view/sprites.js";

const AIM = {
  turnRate: 2,
  elevationRate: 1,
  maxElevation: 1.3,
  chargeRate: 30,
  minPower: 6,
  maxPower: 36,
};

const canvas = document.getElementById("screen");
const context = canvas.getContext("2d");
const input = createInput();

const fitToWindow = () => {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
};

window.addEventListener("resize", fitToWindow);
fitToWindow();

const rates = {
  ticks: 0,
  frames: 0,
  ticksPerSecond: 0,
  framesPerSecond: 0,
  since: 0,
};

const countSecond = (elapsed) => {
  rates.since += elapsed;
  if (rates.since < 1) return;
  rates.ticksPerSecond = Math.round(rates.ticks / rates.since);
  rates.framesPerSecond = Math.round(rates.frames / rates.since);
  rates.ticks = 0;
  rates.frames = 0;
  rates.since = 0;
};

// Debug aiming for step 3: left/right turn, up/down raise the launch angle,
// holding kick charges the power, releasing it launches the ball.
const aimWithKeys = (aim, keys, seconds) => ({
  heading:
    aim.heading +
    ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * AIM.turnRate * seconds,
  elevation: clamp(
    aim.elevation +
      ((keys.down ? -1 : 0) + (keys.up ? 1 : 0)) * AIM.elevationRate * seconds,
    0,
    AIM.maxElevation,
  ),
  charge: keys.kick
    ? Math.min(aim.charge + AIM.chargeRate * seconds, AIM.maxPower)
    : 0,
});

const viewOfCamera = (camera) =>
  createView(camera, canvas.clientWidth, canvas.clientHeight);

const ballSprite = createBallSprite();

let keys = EMPTY_INPUT;
let aim = { heading: -Math.PI / 2, elevation: 0.6, charge: 0 };
let ball = createBall();
let previousBall = ball;
let camera = createCamera();
let previousCamera = camera;

const tick = (seconds) => {
  const previousKeys = keys;
  keys = input.read();
  const charged = aim.charge;
  aim = aimWithKeys(aim, keys, seconds);

  previousBall = ball;
  if (keys.tackle) ball = createBall();
  else if (previousKeys.kick && !keys.kick)
    ball = launchBall(
      ball,
      aim.heading,
      aim.elevation,
      Math.max(charged, AIM.minPower),
    );
  ball = advanceBall(ball, seconds);

  previousCamera = camera;
  camera = clampCamera(
    followCamera(
      camera,
      { position: ball.position, velocity: ball.velocity },
      seconds,
    ),
    viewOfCamera(camera),
  );
  rates.ticks += 1;
};

const between = (from, to, alpha) => ({
  x: from.x + (to.x - from.x) * alpha,
  y: from.y + (to.y - from.y) * alpha,
  z: from.z + ((to.z ?? 0) - (from.z ?? 0)) * alpha,
});

const render = (alpha, frameSeconds) => {
  rates.frames += 1;
  countSecond(frameSeconds);

  const view = viewOfCamera({
    centre: between(previousCamera.centre, camera.centre, alpha),
  });
  renderPitch(context, view);
  renderBall(
    context,
    view,
    { position: between(previousBall.position, ball.position, alpha) },
    ballSprite,
  );

  const degrees = (radians) => Math.round((radians * 180) / Math.PI);
  const lines = [
    `ticks/s ${rates.ticksPerSecond}`,
    `frames/s ${rates.framesPerSecond}`,
    `heading ${degrees(aim.heading)} elevation ${degrees(aim.elevation)}`,
    `power ${Math.max(aim.charge, 0).toFixed(1)}`,
    `ball ${ball.position.x.toFixed(1)} ${ball.position.y.toFixed(1)} ${ball.position.z.toFixed(2)}`,
    `speed ${Math.hypot(ball.velocity.x, ball.velocity.y).toFixed(1)}`,
  ];

  context.fillStyle = "#e8f5e9";
  context.font = "16px monospace";
  context.textBaseline = "top";
  lines.forEach((line, index) => context.fillText(line, 16, 16 + index * 20));
};

startLoop({ tick, render });
