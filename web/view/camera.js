import { add, clamp, clampLength, scale, subtract } from '../math/vec.js';
import { PITCH, PITCH_BOUNDS } from '../world/pitch.js';

export const VISIBLE_PITCH_WIDTH_FRACTION = 0.9;

export const CAMERA = Object.freeze({
  worldUnitsPerScreenWidth: PITCH.width * VISIBLE_PITCH_WIDTH_FRACTION,
  smoothingSeconds: 0.22,
  lookaheadSeconds: 0.5,
  maxLookahead: 10,
  boundsMargin: 5,
});

export const createCamera = (centre = { x: 0, y: 0 }) => ({ centre });

// Moves the camera a fraction of the way towards the focus, offset ahead along
// the focus velocity. The fraction is below 1, so the camera never overshoots.
export const followCamera = (camera, focus, seconds, settings = CAMERA) => {
  const lookahead = clampLength(
    scale(focus.velocity, settings.lookaheadSeconds),
    settings.maxLookahead,
  );
  const desired = add(focus.position, lookahead);
  const approach = 1 - Math.exp(-seconds / settings.smoothingSeconds);
  return { centre: add(camera.centre, scale(subtract(desired, camera.centre), approach)) };
};

export const clampCamera = (camera, view, bounds = PITCH_BOUNDS, margin = CAMERA.boundsMargin) => ({
  centre: {
    x: clampAxis(camera.centre.x, view.halfWidth, bounds.minX - margin, bounds.maxX + margin),
    y: clampAxis(camera.centre.y, view.halfHeight, bounds.minY - margin, bounds.maxY + margin),
  },
});

// Keeps the visible span inside the limits, or centres it when it does not fit.
const clampAxis = (centre, halfSpan, min, max) =>
  halfSpan * 2 >= max - min ? (min + max) / 2 : clamp(centre, min + halfSpan, max - halfSpan);

export const createView = (
  camera,
  screenWidth,
  screenHeight,
  worldUnitsPerScreenWidth = CAMERA.worldUnitsPerScreenWidth,
) => {
  const pixelsPerUnit = screenWidth / worldUnitsPerScreenWidth;
  return {
    centre: camera.centre,
    pixelsPerUnit,
    screenWidth,
    screenHeight,
    halfWidth: worldUnitsPerScreenWidth / 2,
    halfHeight: screenHeight / 2 / pixelsPerUnit,
  };
};

export const worldToScreen = (view, point) => ({
  x: (point.x - view.centre.x) * view.pixelsPerUnit + view.screenWidth / 2,
  y: (point.y - view.centre.y) * view.pixelsPerUnit + view.screenHeight / 2,
});

export const screenToWorld = (view, point) => ({
  x: (point.x - view.screenWidth / 2) / view.pixelsPerUnit + view.centre.x,
  y: (point.y - view.screenHeight / 2) / view.pixelsPerUnit + view.centre.y,
});
