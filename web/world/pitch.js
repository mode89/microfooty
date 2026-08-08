// The pitch is vertical: +y runs down the screen along its length, towards the
// bottom goal, and +x runs across its width. The origin is the centre spot.
// All lengths are metres and follow the standard full-size pitch.
import { clamp } from "../math/vec.js";

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

// Nothing leaves the field of play in M2: a run and a push both stop here.
export function keepOnPitch(position, bounds = PITCH_BOUNDS) {
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

const LEFT_SIDE = -1;
const RIGHT_SIDE = 1;

// The two ends, named by the way a team runs to reach them, so a rule that
// points at a goal takes a direction rather than being written twice.
export const UP_THE_PITCH = -1;
export const DOWN_THE_PITCH = 1;

const TOP_END = UP_THE_PITCH;
const BOTTOM_END = DOWN_THE_PITCH;

function box(depth, width, side) {
  const halfBoxWidth = width / 2;
  const goalLine = side * halfLength;
  const inner = goalLine - side * depth;
  return {
    kind: "rect",
    minX: -halfBoxWidth,
    maxX: halfBoxWidth,
    minY: Math.min(goalLine, inner),
    maxY: Math.max(goalLine, inner),
  };
}

// Each arc is the quarter circle that opens into the pitch, so its start angle
// follows the corner's quadrant (canvas angles grow clockwise with +y down).
function cornerArc(sideX, sideY, quarterTurns) {
  return {
    kind: "arc",
    x: sideX * halfWidth,
    y: sideY * halfLength,
    radius: PITCH.cornerArcRadius,
    start: (quarterTurns * Math.PI) / 2,
    end: ((quarterTurns + 1) * Math.PI) / 2,
  };
}

function penaltySpot(side) {
  return {
    kind: "spot",
    x: 0,
    y: side * (halfLength - PITCH.penaltySpotDistance),
    radius: PITCH.spotRadius,
  };
}

// Only the part of the circle around the penalty spot that falls outside the
// penalty area is marked, so the arc spans the angle where it clears the box.
function penaltyArc(side) {
  const spot = penaltySpot(side);
  const toBoxEdge = PITCH.penaltyAreaDepth - PITCH.penaltySpotDistance;
  const half = Math.acos(toBoxEdge / PITCH.centreCircleRadius);
  const towardsCentre = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  return {
    kind: "arc",
    x: spot.x,
    y: spot.y,
    radius: PITCH.centreCircleRadius,
    start: towardsCentre - half,
    end: towardsCentre + half,
  };
}

// Touchlines and goal lines are the outer rectangle.
export const PITCH_MARKINGS = Object.freeze([
  {
    kind: "rect",
    minX: -halfWidth,
    maxX: halfWidth,
    minY: -halfLength,
    maxY: halfLength,
  },
  { kind: "line", fromX: -halfWidth, fromY: 0, toX: halfWidth, toY: 0 },
  { kind: "circle", x: 0, y: 0, radius: PITCH.centreCircleRadius },
  { kind: "spot", x: 0, y: 0, radius: PITCH.spotRadius },
  box(PITCH.penaltyAreaDepth, PITCH.penaltyAreaWidth, TOP_END),
  box(PITCH.penaltyAreaDepth, PITCH.penaltyAreaWidth, BOTTOM_END),
  box(PITCH.goalAreaDepth, PITCH.goalAreaWidth, TOP_END),
  box(PITCH.goalAreaDepth, PITCH.goalAreaWidth, BOTTOM_END),
  penaltySpot(TOP_END),
  penaltySpot(BOTTOM_END),
  penaltyArc(TOP_END),
  penaltyArc(BOTTOM_END),
  cornerArc(LEFT_SIDE, TOP_END, 0),
  cornerArc(RIGHT_SIDE, TOP_END, 1),
  cornerArc(RIGHT_SIDE, BOTTOM_END, 2),
  cornerArc(LEFT_SIDE, BOTTOM_END, 3),
]);
