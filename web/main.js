import { startLoop } from "./loop.js";
import { createInput } from "./input.js";
import { createMatch, selectedPlayer } from "./match.js";
import { allKits } from "./team.js";
import { createDebugOverlay } from "./view/hud.js";
import { fitCanvasToWindow } from "./view/canvas.js";
import { advanceScene, createScene, drawScene } from "./view/scene.js";
import { createBallSprite, loadKitSprites } from "./view/sprites.js";

const canvas = document.getElementById("screen");
const context = canvas.getContext("2d");
const input = createInput();

function fitToWindow() {
  fitCanvasToWindow(canvas, context);
}

function screenSize() {
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

window.addEventListener("resize", fitToWindow);
fitToWindow();

const kitSprites = await loadKitSprites("players.png", allKits());
const debug = createDebugOverlay();

let scene = createScene({
  match: createMatch(),
  ballSprite: createBallSprite(),
  kitSprites,
});
let debugVisible = false;
let debugWasHeld = false;

function tick(seconds) {
  const actions = input.read();
  if (actions.debug && !debugWasHeld) debugVisible = !debugVisible;
  debugWasHeld = actions.debug;

  scene = advanceScene(scene, screenSize(), actions, seconds);
  debug.recordTick();
}

function render(alpha, wallClockSeconds) {
  const { match } = scene;
  debug.recordFrame(wallClockSeconds);
  drawScene(context, screenSize(), scene, alpha);

  if (debugVisible)
    debug.draw(context, { ball: match.ball, player: selectedPlayer(match) });
}

startLoop({ tick, render });
