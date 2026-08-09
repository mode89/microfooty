import { startLoop } from "../loop.js";
import { fitCanvasToWindow } from "../view/canvas.js";
import {
  createBallSprite,
  cutPlayerSprites,
  drawSprite,
  loadPlayerSheet,
  SHEET_FRAMES,
} from "../view/sprites.js";

const FRAMES = [...SHEET_FRAMES, "left"];
const SPRITE_SIZE = 96;
const BALL_DISPLAY_SIZE = 36;
const DRIFT_SPEED = 40;
const BACKGROUND = "#1f6b2c";
const LABEL = "#e8f5e9";

const canvas = document.getElementById("screen");
const context = canvas.getContext("2d");

function fitToWindow() {
  fitCanvasToWindow(canvas, context);
}

window.addEventListener("resize", fitToWindow);
fitToWindow();

const sprites = cutPlayerSprites(await loadPlayerSheet("../players.png"));
const ballSprite = createBallSprite();

let previousTravelDistance = 0;
let currentTravelDistance = 0;

function tick(seconds) {
  previousTravelDistance = currentTravelDistance;
  currentTravelDistance += DRIFT_SPEED * seconds;
}

function render(alpha) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.fillStyle = BACKGROUND;
  context.fillRect(0, 0, width, height);

  context.fillStyle = LABEL;
  context.font = "16px monospace";
  context.textAlign = "center";
  context.textBaseline = "top";
  FRAMES.forEach((frame, index) => {
    const x = (width * (index + 1)) / (FRAMES.length + 1);
    drawSprite(
      context,
      sprites[frame],
      { x, y: height / 3 },
      SPRITE_SIZE,
      SPRITE_SIZE,
    );
    context.fillText(frame, x, height / 3 + SPRITE_SIZE);
  });

  const travelDistance =
    previousTravelDistance +
    (currentTravelDistance - previousTravelDistance) * alpha;
  const driftCycle = width + SPRITE_SIZE;
  const driftX = (travelDistance % driftCycle) - SPRITE_SIZE / 2;
  drawSprite(
    context,
    sprites.right,
    { x: driftX, y: (height * 2) / 3 },
    SPRITE_SIZE,
    SPRITE_SIZE,
  );
  drawSprite(
    context,
    ballSprite,
    { x: driftX, y: (height * 2) / 3 + SPRITE_SIZE },
    BALL_DISPLAY_SIZE,
    BALL_DISPLAY_SIZE,
  );
}

startLoop({ tick, render });
