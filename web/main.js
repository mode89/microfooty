import { startLoop } from "./loop.js";
import { createInput } from "./input.js";
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
import { createDebugOverlay } from "./view/debug.js";
import { renderBall, renderPitch, renderPlayer } from "./view/render.js";
import { createBallSprite, loadPlayerSprites } from "./view/sprites.js";

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

const viewOfCamera = (camera) =>
  createView(camera, canvas.clientWidth, canvas.clientHeight);

const ballSprite = createBallSprite();
const playerSprites = await loadPlayerSprites("players.png");
const debug = createDebugOverlay();

let ball = createBall({ x: 0, y: 6 });
let previousBall = ball;
let player = createPlayer();
let previousPlayer = player;
let camera = createCamera();
let previousCamera = camera;
let debugVisible = false;
let debugWasHeld = false;

const tick = (seconds) => {
  const actions = input.read();
  if (actions.debug && !debugWasHeld) debugVisible = !debugVisible;
  debugWasHeld = actions.debug;

  previousPlayer = player;
  player = advancePlayer(player, directionFromInput(actions), seconds);

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
  debug.recordTick();
};

const interpolate2D = (from, to, alpha) => ({
  x: from.x + (to.x - from.x) * alpha,
  y: from.y + (to.y - from.y) * alpha,
});

const interpolate3D = (from, to, alpha) => ({
  ...interpolate2D(from, to, alpha),
  z: from.z + (to.z - from.z) * alpha,
});

const render = (alpha, wallClockSeconds) => {
  debug.recordFrame(wallClockSeconds);

  const view = viewOfCamera({
    centre: interpolate2D(previousCamera.centre, camera.centre, alpha),
  });
  renderPitch(context, view);
  renderBall(
    context,
    view,
    {
      position: interpolate3D(previousBall.position, ball.position, alpha),
    },
    ballSprite,
  );
  renderPlayer(
    context,
    view,
    {
      position: interpolate2D(previousPlayer.position, player.position, alpha),
      facing: player.facing,
    },
    playerSprites,
  );

  if (debugVisible) debug.draw(context, { ball, player });
};

startLoop({ tick, render });
