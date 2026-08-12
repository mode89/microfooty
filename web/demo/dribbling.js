import { createInput } from "../input.js";
import { startLoop } from "../loop.js";
import { DRIBBLE } from "../tuning.js";
import { fitCanvasToWindow } from "../view/canvas.js";
import { advanceScene, createScene, drawScene } from "../view/scene.js";
import { createBallSprite, loadKitSprites } from "../view/sprites.js";
import { createBall } from "../ball.js";
import { createMatch, selectedPlayer } from "../match.js";
import { kitOf } from "../team.js";

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
const soloPlayer = selectedPlayer(fullMatch);
const playerKit = kitOf(soloPlayer.team, soloPlayer.role);
const kitSprites = await loadKitSprites("../players.png", [playerKit]);

const soloMatch = {
  ...fullMatch,
  players: [{ ...soloPlayer, position: { x: 0, y: 0 } }],
  ball: createBall({ x: 0, y: DRIBBLE.idealLead }),
  selectedIndex: 0,
  recentToucherIndex: null,
};

let scene = createScene({
  match: soloMatch,
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
    `Ball gap: ${ballGap.toFixed(3)} m`,
    `Player speed: ${player.speed.toFixed(2)} m/s`,
    `Ball speed: ${ballSpeed.toFixed(2)} m/s`,
    `Touch timer: ${player.control.touchTimer.toFixed(3)} s`,
  ].join("\n");
}

startLoop({ tick, render });
