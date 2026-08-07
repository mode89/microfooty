import { worldToScreen } from "./camera.js";
import { drawSprite } from "./sprites.js";
import { PITCH, PITCH_MARKINGS } from "../world/pitch.js";
import { BALL } from "../world/ball.js";

const GRASS_BANDS = ["#1f6b2c", "#237632"];
const BAND_COUNT = 14;
const SURROUND = "#123d1a";
const PAINT = "#eef7ee";
const SHADOW = "rgba(0, 0, 0, 0.35)";

export const renderPitch = (context, view) => {
  context.fillStyle = SURROUND;
  context.fillRect(0, 0, view.screenWidth, view.screenHeight);

  renderGrassBands(context, view);

  context.strokeStyle = PAINT;
  context.fillStyle = PAINT;
  context.lineWidth = PITCH.lineWidth * view.pixelsPerUnit;
  PITCH_MARKINGS.forEach((marking) => drawMarking(context, view, marking));
};

// Mowing stripes run across the pitch width, so they stack along its length.
const renderGrassBands = (context, view) => {
  const bandLength = PITCH.length / BAND_COUNT;
  const left = worldToScreen(view, { x: -PITCH.width / 2, y: 0 }).x;
  const bandWidth = PITCH.width * view.pixelsPerUnit;
  for (let band = 0; band < BAND_COUNT; band += 1) {
    const top = worldToScreen(view, {
      x: 0,
      y: -PITCH.length / 2 + band * bandLength,
    }).y;
    context.fillStyle = GRASS_BANDS[band % GRASS_BANDS.length];
    // The extra pixel of height overlaps the next band, hiding the hairline gap
    // that rounding leaves between them at fractional camera positions.
    context.fillRect(left, top, bandWidth, bandLength * view.pixelsPerUnit + 1);
  }
};

const drawMarking = (context, view, marking) => {
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
    const radius = marking.radius * view.pixelsPerUnit;
    const start = marking.kind === "arc" ? marking.start : 0;
    const end = marking.kind === "arc" ? marking.end : Math.PI * 2;
    context.arc(centre.x, centre.y, radius, start, end);
  }
  if (marking.kind === "spot") context.fill();
  else context.stroke();
};

// Sprites are squashed vertically, the Sensi trick that reads as a body seen
// from a camera tilted slightly away from straight down.
const PLAYER_DRAW = Object.freeze({ width: 1.4, squash: 0.85 });

export const renderPlayer = (context, view, player, sprites) => {
  const centre = worldToScreen(view, player.position);
  const width = PLAYER_DRAW.width * view.pixelsPerUnit;

  context.fillStyle = SHADOW;
  context.beginPath();
  context.ellipse(
    centre.x,
    centre.y + (width * PLAYER_DRAW.squash) / 2,
    width / 2,
    (width / 2) * (1 - PLAYER_DRAW.squash) * 2,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();

  drawSprite(
    context,
    sprites[player.facing],
    centre,
    width,
    width * PLAYER_DRAW.squash,
  );
};

const BALL_DRAW_SCALE = 2;
const SHADOW_FLATTENING = 0.7;

// Height only moves the ball up the screen; its shadow stays on the ground, so
// the gap between the two reads as z while both keep a fixed size.
export const renderBall = (context, view, ball, sprite) => {
  const ground = worldToScreen(view, ball.position);
  const height = ball.position.z * view.pixelsPerUnit;
  const radius = BALL.radius * BALL_DRAW_SCALE * view.pixelsPerUnit;

  context.fillStyle = SHADOW;
  context.beginPath();
  context.ellipse(
    ground.x,
    ground.y,
    radius,
    radius * SHADOW_FLATTENING,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();

  drawSprite(
    context,
    sprite,
    { x: ground.x, y: ground.y - height },
    radius * 2,
    radius * 2,
  );
};
