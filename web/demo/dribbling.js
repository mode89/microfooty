import { createInput } from "../input.js";
import { startLoop } from "../loop.js";
import { DRIBBLE } from "../tuning.js";
import { loadKitSprites } from "../view/kits.js";
import { fitCanvasToWindow } from "../view/canvas.js";
import {
  advancePresentation,
  createPresentation,
  drawPresentation,
} from "../view/presentation.js";
import { createBallSprite } from "../view/sprites.js";
import { createBall } from "../world/ball.js";
import { createMatch, keyboardPlayer } from "../world/match.js";
import { kitOf } from "../world/team.js";

const canvas = document.getElementById("screen");
const context = canvas.getContext("2d");
const debug = document.getElementById("debug");
const input = createInput();

function fitToWindow() {
  fitCanvasToWindow(canvas, context);
}

function screenSize() {
  return { width: canvas.clientWidth, height: canvas.clientHeight };
}

window.addEventListener("resize", fitToWindow);
fitToWindow();

const fullMatch = createMatch();
const soloPlayer = keyboardPlayer(fullMatch);
const playerKit = kitOf(soloPlayer.team, soloPlayer.role);
const kitSprites = await loadKitSprites("../players.png", [playerKit]);

const soloMatch = {
  ...fullMatch,
  players: [{ ...soloPlayer, position: { x: 0, y: 0 } }],
  ball: createBall({ x: 0, y: DRIBBLE.idealLead }),
  keyboardIndex: 0,
  recentToucherIndex: null,
};

let presentation = createPresentation({
  match: soloMatch,
  ballSprite: createBallSprite(),
  kitSprites,
});

function tick(seconds) {
  presentation = advancePresentation(
    presentation,
    screenSize(),
    input.read(),
    seconds,
  );
}

function render(alpha) {
  debug.textContent = readoutOf(presentation.match);
  drawPresentation(context, screenSize(), presentation, alpha);
}

function readoutOf(match) {
  const player = keyboardPlayer(match);
  const ballGap = Math.hypot(
    match.ball.position.x - player.position.x,
    match.ball.position.y - player.position.y,
  );
  const ballSpeed = Math.hypot(match.ball.velocity.x, match.ball.velocity.y);
  return [
    `Ball gap: ${ballGap.toFixed(3)} m`,
    `Player speed: ${player.speed.toFixed(2)} m/s`,
    `Ball speed: ${ballSpeed.toFixed(2)} m/s`,
    `Touch timer: ${player.control.touchTimer.toFixed(3)} s`,
  ].join("\n");
}

startLoop({ tick, render });
