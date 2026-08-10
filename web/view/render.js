import { worldToScreen } from "./camera.js";
import { spriteFrame } from "./frames.js";
import { drawSprite } from "./sprites.js";
import { BALL } from "../tuning.js";
import { PITCH, PITCH_MARKINGS } from "../world/pitch.js";

const GRASS_BANDS = ["#1f6b2c", "#237632"];
const BAND_COUNT = 14;
const SURROUND = "#123d1a";
const PAINT = "#eef7ee";
const SHADOW = "rgba(0, 0, 0, 0.35)";

export function renderPitch(context, view) {
  context.fillStyle = SURROUND;
  context.fillRect(0, 0, view.screenWidth, view.screenHeight);

  renderGrassBands(context, view);

  context.strokeStyle = PAINT;
  context.fillStyle = PAINT;
  context.lineWidth = PITCH.lineWidth * view.pixelsPerUnit;
  PITCH_MARKINGS.forEach((marking) => drawMarking(context, view, marking));
}

// Mowing stripes run across the pitch width, so they stack along its length.
function renderGrassBands(context, view) {
  const bandLength = PITCH.length / BAND_COUNT;
  const left = worldToScreen(view, { x: -PITCH.width / 2, y: 0 }).x;
  const bandWidthPixels = PITCH.width * view.pixelsPerUnit;
  for (let band = 0; band < BAND_COUNT; band += 1) {
    const top = worldToScreen(view, {
      x: 0,
      y: -PITCH.length / 2 + band * bandLength,
    }).y;
    context.fillStyle = GRASS_BANDS[band % GRASS_BANDS.length];
    // The extra pixel of height overlaps the next band, hiding the hairline gap
    // that rounding leaves between them at fractional camera positions.
    context.fillRect(
      left,
      top,
      bandWidthPixels,
      bandLength * view.pixelsPerUnit + 1,
    );
  }
}

function drawMarking(context, view, marking) {
  context.beginPath();
  if (marking.kind === "rect") {
    const from = worldToScreen(view, { x: marking.minX, y: marking.minY });
    const to = worldToScreen(view, { x: marking.maxX, y: marking.maxY });
    context.rect(from.x, from.y, to.x - from.x, to.y - from.y);
  } else if (marking.kind === "line") {
    const from = worldToScreen(view, { x: marking.fromX, y: marking.fromY });
    const to = worldToScreen(view, { x: marking.toX, y: marking.toY });
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
  } else {
    const centre = worldToScreen(view, marking);
    const radiusPixels = marking.radius * view.pixelsPerUnit;
    const start = marking.kind === "arc" ? marking.start : 0;
    const end = marking.kind === "arc" ? marking.end : Math.PI * 2;
    context.arc(centre.x, centre.y, radiusPixels, start, end);
  }
  if (marking.kind === "spot") context.fill();
  else context.stroke();
}

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

const BALL_DRAW_SCALE = 2;
const SHADOW_FLATTENING = 0.7;

// Height only moves the ball up the screen; its shadow stays on the ground, so
// the gap between the two reads as z while both keep a fixed size.
export function renderBall(context, view, ball, sprite) {
  const ground = worldToScreen(view, ball.position);
  const heightPixels = ball.position.z * view.pixelsPerUnit;
  const radiusPixels = BALL.radius * BALL_DRAW_SCALE * view.pixelsPerUnit;

  context.fillStyle = SHADOW;
  context.beginPath();
  context.ellipse(
    ground.x,
    ground.y,
    radiusPixels,
    radiusPixels * SHADOW_FLATTENING,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();

  drawSprite(
    context,
    sprite,
    { x: ground.x, y: ground.y - heightPixels },
    radiusPixels * 2,
    radiusPixels * 2,
  );
}
