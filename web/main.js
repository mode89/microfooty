import { startLoop } from "./loop.js";
import { createInput } from "./input.js";
import { advanceMatch, createMatch, keyboardPlayer } from "./world/match.js";
import { allKits, kitOf } from "./world/team.js";
import {
  clampCamera,
  createCamera,
  createView,
  followCamera,
} from "./view/camera.js";
import { createDebugOverlay } from "./view/debug.js";
import {
  fitCanvasToWindow,
  interpolateBallPosition,
  interpolatePosition,
} from "./view/presentation.js";
import { renderBall, renderPitch, renderPlayer } from "./view/render.js";
import { createBallSprite } from "./view/sprites.js";
import { loadKitSprites } from "./view/kits.js";

const canvas = document.getElementById("screen");
const context = canvas.getContext("2d");
const input = createInput();

function fitToWindow() {
  fitCanvasToWindow(canvas, context);
}

window.addEventListener("resize", fitToWindow);
fitToWindow();

function viewOfCamera(camera) {
  return createView(camera, canvas.clientWidth, canvas.clientHeight);
}

const ballSprite = createBallSprite();
const kitSprites = await loadKitSprites("players.png", allKits());
const debug = createDebugOverlay();

let match = createMatch();
let previousMatch = match;
let camera = createCamera();
let previousCamera = camera;
let debugVisible = false;
let debugWasHeld = false;

function tick(seconds) {
  const actions = input.read();
  if (actions.debug && !debugWasHeld) debugVisible = !debugVisible;
  debugWasHeld = actions.debug;

  previousMatch = match;
  match = advanceMatch(match, actions, seconds);

  previousCamera = camera;
  // The vector helpers read x and y only, so the ball's height never moves the camera.
  camera = clampCamera(
    followCamera(camera, match.ball, seconds),
    viewOfCamera(camera),
  );
  debug.recordTick();
}

// Drawn up the pitch, so a body standing nearer the camera covers one behind
// it whatever order the match keeps its players in.
function drawnPlayers(from, to, alpha) {
  return to.players
    .map((player, index) => ({
      position: interpolatePosition(
        from.players[index].position,
        player.position,
        alpha,
      ),
      heading: player.heading,
      sprites: kitSprites[kitOf(player.team, player.role).name],
    }))
    .sort((behind, infront) => behind.position.y - infront.position.y);
}

function render(alpha, wallClockSeconds) {
  debug.recordFrame(wallClockSeconds);

  const view = viewOfCamera({
    centre: interpolatePosition(previousCamera.centre, camera.centre, alpha),
  });
  renderPitch(context, view);
  // Under every player, not sorted in with them: a ball lofted over a body
  // would then draw in front of the body it is flying over.
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
  drawnPlayers(previousMatch, match, alpha).forEach((player) =>
    renderPlayer(context, view, player, player.sprites),
  );

  if (debugVisible)
    debug.draw(context, { ball: match.ball, player: keyboardPlayer(match) });
}

startLoop({ tick, render });
