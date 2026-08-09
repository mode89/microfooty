import { createInput } from "../input.js";
import { startLoop } from "../loop.js";
import { DRIBBLE } from "../tuning.js";
import {
  clampCamera,
  createCamera,
  createView,
  followCamera,
} from "../view/camera.js";
import { loadKitSprites } from "../view/kits.js";
import {
  fitCanvasToWindow,
  interpolateBallPosition,
  interpolatePosition,
} from "../view/presentation.js";
import { renderBall, renderPitch, renderPlayer } from "../view/render.js";
import { createBallSprite } from "../view/sprites.js";
import { createBall } from "../world/ball.js";
import { advanceMatch, createMatch, keyboardPlayer } from "../world/match.js";
import { kitOf } from "../world/team.js";

const canvas = document.getElementById("screen");
const context = canvas.getContext("2d");
const debug = document.getElementById("debug");
const input = createInput();

function fitToWindow() {
  fitCanvasToWindow(canvas, context);
}

window.addEventListener("resize", fitToWindow);
fitToWindow();

const fullMatch = createMatch();
const player = keyboardPlayer(fullMatch);
const playerKit = kitOf(player.team, player.role);
const kitSprites = await loadKitSprites("../players.png", [playerKit]);
const playerSprites = kitSprites[playerKit.name];
const ballSprite = createBallSprite();

let match = {
  ...fullMatch,
  players: [{ ...player, position: { x: 0, y: 0 } }],
  ball: createBall({ x: 0, y: DRIBBLE.idealLead }),
  keyboardIndex: 0,
  recentToucherIndex: null,
};
let previousMatch = match;
let camera = createCamera();
let previousCamera = camera;

function viewOfCamera(current) {
  return createView(current, canvas.clientWidth, canvas.clientHeight);
}

function tick(seconds) {
  previousMatch = match;
  match = advanceMatch(match, input.read(), seconds);
  previousCamera = camera;
  camera = clampCamera(
    followCamera(camera, match.ball, seconds),
    viewOfCamera(camera),
  );
}

function render(alpha) {
  const view = viewOfCamera({
    centre: interpolatePosition(previousCamera.centre, camera.centre, alpha),
  });
  const player = keyboardPlayer(match);
  const ballGap = Math.hypot(
    match.ball.position.x - player.position.x,
    match.ball.position.y - player.position.y,
  );
  const ballSpeed = Math.hypot(match.ball.velocity.x, match.ball.velocity.y);
  debug.textContent = [
    `Ball gap: ${ballGap.toFixed(3)} m`,
    `Player speed: ${player.speed.toFixed(2)} m/s`,
    `Ball speed: ${ballSpeed.toFixed(2)} m/s`,
    `Touch timer: ${player.control.touchTimer.toFixed(3)} s`,
  ].join("\n");

  renderPitch(context, view);
  renderBall(
    context,
    view,
    {
      position: interpolateBallPosition(
        previousMatch.ball.position,
        match.ball.position,
        alpha,
      ),
    },
    ballSprite,
  );
  renderPlayer(
    context,
    view,
    {
      ...player,
      position: interpolatePosition(
        keyboardPlayer(previousMatch).position,
        player.position,
        alpha,
      ),
    },
    playerSprites,
  );
}

startLoop({ tick, render });
