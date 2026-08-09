import { startLoop } from "./loop.js";
import { createInput } from "./input.js";
import { createMatch, keyboardPlayer } from "./world/match.js";
import { allKits } from "./world/team.js";
import { createDebugOverlay } from "./view/debug.js";
import { fitCanvasToWindow } from "./view/canvas.js";
import {
  advancePresentation,
  createPresentation,
  drawPresentation,
} from "./view/presentation.js";
import { createBallSprite } from "./view/sprites.js";
import { loadKitSprites } from "./view/kits.js";

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

let presentation = createPresentation({
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

  presentation = advancePresentation(
    presentation,
    screenSize(),
    actions,
    seconds,
  );
  debug.recordTick();
}

function render(alpha, wallClockSeconds) {
  const { match } = presentation;
  debug.recordFrame(wallClockSeconds);
  drawPresentation(context, screenSize(), presentation, alpha);

  if (debugVisible)
    debug.draw(context, { ball: match.ball, player: keyboardPlayer(match) });
}

startLoop({ tick, render });
