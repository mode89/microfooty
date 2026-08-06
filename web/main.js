import { startLoop } from "./loop.js";
import { createInput, EMPTY_INPUT } from "./input.js";
import { add, clamp, length, scale } from "./math/vec.js";
import { PITCH_BOUNDS } from "./world/pitch.js";
import {
  clampCamera,
  createCamera,
  createView,
  followCamera,
} from "./view/camera.js";
import { renderPitch, renderTarget } from "./view/render.js";

const TARGET_SPEED = 14;

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

// Stand-in for the player of step 5: a point driven straight by the keys.
const moveTarget = (target, held, seconds) => {
  const direction = {
    x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
    y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
  };
  const size = length(direction);
  const velocity =
    size === 0 ? { x: 0, y: 0 } : scale(direction, TARGET_SPEED / size);
  const moved = add(target.position, scale(velocity, seconds));
  return {
    velocity,
    position: {
      x: clamp(moved.x, PITCH_BOUNDS.minX, PITCH_BOUNDS.maxX),
      y: clamp(moved.y, PITCH_BOUNDS.minY, PITCH_BOUNDS.maxY),
    },
  };
};

const viewOfCamera = (camera) =>
  createView(camera, canvas.clientWidth, canvas.clientHeight);

let held = EMPTY_INPUT;
let target = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };
let previousTarget = target;
let camera = createCamera();
let previousCamera = camera;

const tick = (seconds) => {
  held = input.read();
  previousTarget = target;
  target = moveTarget(target, held, seconds);
  previousCamera = camera;
  camera = clampCamera(
    followCamera(camera, target, seconds),
    viewOfCamera(camera),
  );
  rates.ticks += 1;
};

const between = (from, to, alpha) => ({
  x: from.x + (to.x - from.x) * alpha,
  y: from.y + (to.y - from.y) * alpha,
});

const render = (alpha, frameSeconds) => {
  rates.frames += 1;
  countSecond(frameSeconds);

  const view = viewOfCamera({
    centre: between(previousCamera.centre, camera.centre, alpha),
  });
  renderPitch(context, view);
  renderTarget(
    context,
    view,
    between(previousTarget.position, target.position, alpha),
  );

  const pressed = Object.keys(held).filter((action) => held[action]);
  const lines = [
    `ticks/s ${rates.ticksPerSecond}`,
    `frames/s ${rates.framesPerSecond}`,
    `alpha ${alpha.toFixed(3)}`,
    `target ${target.position.x.toFixed(1)} ${target.position.y.toFixed(1)}`,
    `camera ${camera.centre.x.toFixed(1)} ${camera.centre.y.toFixed(1)}`,
    `held ${pressed.length ? pressed.join(" ") : "-"}`,
  ];

  context.fillStyle = "#e8f5e9";
  context.font = "16px monospace";
  context.textBaseline = "top";
  lines.forEach((line, index) => context.fillText(line, 16, 16 + index * 20));
};

startLoop({ tick, render });
