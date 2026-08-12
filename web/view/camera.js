import { add, clamp, clampLength, scale, subtract } from "../math.js";
import { CAMERA } from "../tuning.js";
import { PITCH_BOUNDS } from "../pitch.js";

export function createCamera(centre = { x: 0, y: 0 }) {
  return { centre };
}

// Moves the camera a fraction of the way towards the focus, offset ahead along
// the focus velocity. The fraction is below 1, so the camera never overshoots.
export function followCamera(camera, focus, seconds, settings = CAMERA) {
  const lookahead = clampLength(
    scale(focus.velocity, settings.lookaheadSeconds),
    settings.maxLookahead,
  );
  const desired = add(focus.position, lookahead);
  const approach = 1 - Math.exp(-seconds / settings.smoothingSeconds);
  return {
    centre: add(
      camera.centre,
      scale(subtract(desired, camera.centre), approach),
    ),
  };
}

export function clampCamera(
  camera,
  view,
  bounds = PITCH_BOUNDS,
  margin = CAMERA.boundsMargin,
) {
  return {
    centre: {
      x: clampAxis(
        camera.centre.x,
        view.worldHalfWidth,
        bounds.minX - margin,
        bounds.maxX + margin,
      ),
      y: clampAxis(
        camera.centre.y,
        view.worldHalfHeight,
        bounds.minY - margin,
        bounds.maxY + margin,
      ),
    },
  };
}

// Keeps the visible span inside the limits, or centres it when it does not fit.
function clampAxis(centre, halfSpan, min, max) {
  return halfSpan * 2 >= max - min
    ? (min + max) / 2
    : clamp(centre, min + halfSpan, max - halfSpan);
}

export function createView(
  camera,
  screenWidth,
  screenHeight,
  worldUnitsPerScreenWidth = CAMERA.worldUnitsPerScreenWidth,
) {
  const pixelsPerUnit = screenWidth / worldUnitsPerScreenWidth;
  return {
    centre: camera.centre,
    pixelsPerUnit,
    screenWidth,
    screenHeight,
    worldHalfWidth: worldUnitsPerScreenWidth / 2,
    worldHalfHeight: screenHeight / 2 / pixelsPerUnit,
  };
}

export function worldToScreen(view, point) {
  return {
    x: (point.x - view.centre.x) * view.pixelsPerUnit + view.screenWidth / 2,
    y: (point.y - view.centre.y) * view.pixelsPerUnit + view.screenHeight / 2,
  };
}

export function screenToWorld(view, point) {
  return {
    x: (point.x - view.screenWidth / 2) / view.pixelsPerUnit + view.centre.x,
    y: (point.y - view.screenHeight / 2) / view.pixelsPerUnit + view.centre.y,
  };
}
