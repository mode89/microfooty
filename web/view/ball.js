import { worldToScreen } from "./camera.js";
import { drawSprite } from "./sprites.js";
import { BALL } from "../tuning.js";

const SHADOW = "rgba(0, 0, 0, 0.35)";

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
