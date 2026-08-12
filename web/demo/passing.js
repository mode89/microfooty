// Passing with one team alone on the pitch: the ball only ever changes hands
// between teammates, so the selection hand-over after a pass is easy to read.
import { createInput } from "../input.js";
import { startLoop } from "../loop.js";
import { fitCanvasToWindow } from "../view/canvas.js";
import { advanceScene, createScene, drawScene } from "../view/scene.js";
import { createBallSprite, loadKitSprites } from "../view/sprites.js";
import { createMatch, selectedPlayer } from "../match.js";
import { TEAMS, allKits } from "../team.js";

const HUMAN_TEAM = TEAMS.slice(0, 1);

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

const kitSprites = await loadKitSprites("../players.png", allKits(HUMAN_TEAM));

let scene = createScene({
  match: createMatch(HUMAN_TEAM),
  ballSprite: createBallSprite(),
  kitSprites,
});

function tick(seconds) {
  scene = advanceScene(scene, screenSize(), input.read(), seconds);
}

function render(alpha) {
  debug.textContent = readoutOf(scene.match);
  drawScene(context, screenSize(), scene, alpha);
}

function readoutOf(match) {
  const player = selectedPlayer(match);
  const ballGap = Math.hypot(
    match.ball.position.x - player.position.x,
    match.ball.position.y - player.position.y,
  );
  const ballSpeed = Math.hypot(match.ball.velocity.x, match.ball.velocity.y);
  return [
    `Selected: ${player.role.name}`,
    `Ball gap: ${ballGap.toFixed(2)} m`,
    `Ball speed: ${ballSpeed.toFixed(2)} m/s`,
    `Ball height: ${match.ball.position.z.toFixed(2)} m`,
    `Kick charge: ${match.kickCharge.toFixed(2)}`,
  ].join("\n");
}

startLoop({ tick, render });
