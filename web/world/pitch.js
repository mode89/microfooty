// The pitch is vertical: +y runs down the screen along its length, towards the
// bottom goal, and +x runs across its width. The origin is the centre spot.
// All lengths are metres and follow the standard full-size pitch.
export const PITCH = Object.freeze({
  length: 105,
  width: 68,
  centreCircleRadius: 9.15,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpotDistance: 11,
  spotRadius: 0.2,
  cornerArcRadius: 1,
  lineWidth: 0.12,
});

const halfLength = PITCH.length / 2;
const halfWidth = PITCH.width / 2;

export const PITCH_BOUNDS = Object.freeze({
  minX: -halfWidth,
  maxX: halfWidth,
  minY: -halfLength,
  maxY: halfLength,
});

const box = (depth, width, side) => {
  const halfBoxWidth = width / 2;
  const goalLine = side * halfLength;
  const inner = goalLine - side * depth;
  return {
    kind: 'rect',
    minX: -halfBoxWidth,
    maxX: halfBoxWidth,
    minY: Math.min(goalLine, inner),
    maxY: Math.max(goalLine, inner),
  };
};

// Each arc is the quarter circle that opens into the pitch, so its start angle
// follows the corner's quadrant (canvas angles grow clockwise with +y down).
const cornerArc = (sideX, sideY, quarterTurns) => ({
  kind: 'arc',
  x: sideX * halfWidth,
  y: sideY * halfLength,
  radius: PITCH.cornerArcRadius,
  start: (quarterTurns * Math.PI) / 2,
  end: ((quarterTurns + 1) * Math.PI) / 2,
});

const penaltySpot = (side) => ({
  kind: 'spot',
  x: 0,
  y: side * (halfLength - PITCH.penaltySpotDistance),
  radius: PITCH.spotRadius,
});

// Only the part of the circle around the penalty spot that falls outside the
// penalty area is marked, so the arc spans the angle where it clears the box.
const penaltyArc = (side) => {
  const spot = penaltySpot(side);
  const toBoxEdge = PITCH.penaltyAreaDepth - PITCH.penaltySpotDistance;
  const half = Math.acos(toBoxEdge / PITCH.centreCircleRadius);
  const towardsCentre = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  return {
    kind: 'arc',
    x: spot.x,
    y: spot.y,
    radius: PITCH.centreCircleRadius,
    start: towardsCentre - half,
    end: towardsCentre + half,
  };
};

// Touchlines and goal lines are the outer rectangle.
export const PITCH_MARKINGS = Object.freeze([
  { kind: 'rect', minX: -halfWidth, maxX: halfWidth, minY: -halfLength, maxY: halfLength },
  { kind: 'line', fromX: -halfWidth, fromY: 0, toX: halfWidth, toY: 0 },
  { kind: 'circle', x: 0, y: 0, radius: PITCH.centreCircleRadius },
  { kind: 'spot', x: 0, y: 0, radius: PITCH.spotRadius },
  box(PITCH.penaltyAreaDepth, PITCH.penaltyAreaWidth, -1),
  box(PITCH.penaltyAreaDepth, PITCH.penaltyAreaWidth, 1),
  box(PITCH.goalAreaDepth, PITCH.goalAreaWidth, -1),
  box(PITCH.goalAreaDepth, PITCH.goalAreaWidth, 1),
  penaltySpot(-1),
  penaltySpot(1),
  penaltyArc(-1),
  penaltyArc(1),
  cornerArc(-1, -1, 0),
  cornerArc(1, -1, 1),
  cornerArc(1, 1, 2),
  cornerArc(-1, 1, 3),
]);
