import { startLoop } from "./loop.js";
import { createInput, EMPTY_INPUT } from "./input.js";
import { advanceBall, createBall } from "./world/ball.js";
import {
  advancePlayer,
  createPlayer,
  directionFromInput,
} from "./world/player.js";
import {
  clampCamera,
  createCamera,
  createView,
  followCamera,
} from "./view/camera.js";
import { renderBall, renderPitch, renderPlayer } from "./view/render.js";
import { createBallSprite, loadSprites } from "./view/sprites.js";

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

const viewOfCamera = (camera) =>
  createView(camera, canvas.clientWidth, canvas.clientHeight);

const ballSprite = createBallSprite();
const playerSprites = await loadSprites("players.png");

let keys = EMPTY_INPUT;
let ball = createBall({ x: 0, y: 6 });
let previousBall = ball;
let player = createPlayer();
let previousPlayer = player;
let camera = createCamera();
let previousCamera = camera;

const tick = (seconds) => {
  keys = input.read();

  previousPlayer = player;
  player = advancePlayer(player, directionFromInput(keys), seconds);

  previousBall = ball;
  ball = advanceBall(ball, seconds);

  previousCamera = camera;
  camera = clampCamera(
    followCamera(
      camera,
      { position: player.position, velocity: player.velocity },
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
  renderPlayer(
    context,
    view,
    {
      position: between(previousPlayer.position, player.position, alpha),
      facing: player.facing,
    },
    playerSprites,
  );

  const lines = [
    `ticks/s ${rates.ticksPerSecond}`,
    `frames/s ${rates.framesPerSecond}`,
    `facing ${player.facing}`,
    `player ${player.position.x.toFixed(1)} ${player.position.y.toFixed(1)}`,
    `speed ${Math.hypot(player.velocity.x, player.velocity.y).toFixed(2)}`,
  ];

  context.fillStyle = "#e8f5e9";
  context.font = "16px monospace";
  context.textBaseline = "top";
  lines.forEach((line, index) => context.fillText(line, 16, 16 + index * 20));
};

startLoop({ tick, render });
