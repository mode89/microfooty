import { worldToScreen } from "./camera.js";
import { drawSprite } from "./sprites.js";

const SHADOW = "rgba(0, 0, 0, 0.35)";

// The player's position is where the feet stand, and the frame paints them on
// its seventh row of eight, the last one before its blank bottom row.
const PLAYER_DRAW = Object.freeze({
  width: 1.4,
  feetRow: 7 / 8,
  shadowFlattening: 0.3,
});

export function renderPlayer(context, view, player, sprites) {
  const feet = worldToScreen(view, player.position);
  const widthPixels = PLAYER_DRAW.width * view.pixelsPerUnit;
  const heightPixels = widthPixels;

  if (player.selected) renderSelectionMarker(context, feet, widthPixels);

  context.fillStyle = SHADOW;
  context.beginPath();
  context.ellipse(
    feet.x,
    feet.y,
    widthPixels / 2,
    (widthPixels / 2) * PLAYER_DRAW.shadowFlattening,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();

  drawSprite(
    context,
    sprites[spriteFrame(player.heading)],
    { x: feet.x, y: feet.y - heightPixels * (PLAYER_DRAW.feetRow - 0.5) },
    widthPixels,
    heightPixels,
  );
}

// A ring underfoot, drawn under the shadow and the body so it reads as paint
// on the grass rather than a part of the player.
const MARKER = Object.freeze({
  colour: "#f4e04a",
  radiusFraction: 1.3,
  flattening: 0.4,
  lineWidthFraction: 0.1,
});

function renderSelectionMarker(context, feet, widthPixels) {
  const radiusPixels = (widthPixels / 2) * MARKER.radiusFraction;
  context.strokeStyle = MARKER.colour;
  context.lineWidth = widthPixels * MARKER.lineWidthFraction;
  context.beginPath();
  context.ellipse(
    feet.x,
    feet.y,
    radiusPixels,
    radiusPixels * MARKER.flattening,
    0,
    0,
    Math.PI * 2,
  );
  context.stroke();
}

// Four frames must cover every heading a player can run on: each one scores
// how well it lines up with the heading, and the best score is drawn.
const FRAME_HEADINGS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

// A 45 degree diagonal lines up with two frames equally, so the favoured frame
// of the quadrant carries this much extra score and always wins it.
const DIAGONAL_BIAS = 0.15;

export function spriteFrame(heading) {
  const favoured = favouredFrame(heading);
  function score(frame) {
    return (
      heading.x * FRAME_HEADINGS[frame].x +
      heading.y * FRAME_HEADINGS[frame].y +
      (frame === favoured ? DIAGONAL_BIAS : 0)
    );
  }
  return Object.keys(FRAME_HEADINGS).reduce((best, frame) =>
    score(frame) > score(best) ? frame : best,
  );
}

// A diagonal that heads up the pitch is drawn with the up frame, which shows
// the player's back; every other diagonal is drawn with the side frame it
// leans towards.
function favouredFrame(heading) {
  if (heading.y < 0) return "up";
  return heading.x < 0 ? "left" : "right";
}
