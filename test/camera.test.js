import test from "node:test";
import assert from "node:assert/strict";

import {
  CAMERA,
  VISIBLE_PITCH_WIDTH_FRACTION,
  clampCamera,
  createCamera,
  createView,
  followCamera,
  screenToWorld,
  worldToScreen,
} from "../web/view/camera.js";
import { PITCH, PITCH_BOUNDS, PITCH_MARKINGS } from "../web/world/pitch.js";

const TICK = 1 / 60;
const still = (position) => ({ position, velocity: { x: 0, y: 0 } });

test("world to screen and back is the identity", () => {
  const view = createView(createCamera({ x: 12, y: -7 }), 1280, 720);
  const point = { x: -31.25, y: 18.5 };
  const back = screenToWorld(view, worldToScreen(view, point));
  assert.ok(Math.abs(back.x - point.x) < 1e-9);
  assert.ok(Math.abs(back.y - point.y) < 1e-9);
});

test("the camera centre maps to the middle of the screen", () => {
  const view = createView(createCamera({ x: 12, y: -7 }), 1280, 720);
  assert.deepEqual(worldToScreen(view, { x: 12, y: -7 }), { x: 640, y: 360 });
});

test("the visible world width is the zoom, whatever the screen size", () => {
  const small = createView(createCamera(), 800, 450);
  const large = createView(createCamera(), 2560, 1440);
  assert.equal(small.halfWidth, CAMERA.worldUnitsPerScreenWidth / 2);
  assert.equal(large.halfWidth, CAMERA.worldUnitsPerScreenWidth / 2);
  assert.ok(Math.abs(small.halfHeight - large.halfHeight) < 1e-9);
});

test("the view shows the agreed fraction of the pitch width", () => {
  const view = createView(createCamera(), 1280, 720);
  const visibleWidth = view.halfWidth * 2;
  const fraction = visibleWidth / PITCH.width;
  assert.ok(Math.abs(fraction - VISIBLE_PITCH_WIDTH_FRACTION) < 1e-9);
});

test("the camera converges on a stationary target without overshooting", () => {
  const focus = still({ x: 20, y: 10 });
  let camera = createCamera({ x: 0, y: 0 });
  for (let i = 0; i < 600; i += 1) {
    const next = followCamera(camera, focus, TICK);
    assert.ok(next.centre.x > camera.centre.x - 1e-12);
    assert.ok(next.centre.x <= focus.position.x);
    assert.ok(next.centre.y <= focus.position.y);
    camera = next;
  }
  assert.ok(Math.abs(camera.centre.x - focus.position.x) < 0.01);
  assert.ok(Math.abs(camera.centre.y - focus.position.y) < 0.01);
});

test("lookahead settles ahead of the target, along its travel", () => {
  const focus = { position: { x: 0, y: 0 }, velocity: { x: 8, y: 0 } };
  let camera = createCamera({ x: 0, y: 0 });
  for (let i = 0; i < 600; i += 1) camera = followCamera(camera, focus, TICK);
  assert.ok(Math.abs(camera.centre.x - 8 * CAMERA.lookaheadSeconds) < 0.01);
  assert.ok(Math.abs(camera.centre.y) < 1e-9);
});

test("lookahead is capped at its maximum length", () => {
  const focus = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 1000 } };
  let camera = createCamera({ x: 0, y: 0 });
  for (let i = 0; i < 600; i += 1) camera = followCamera(camera, focus, TICK);
  assert.ok(Math.abs(camera.centre.y - CAMERA.maxLookahead) < 0.01);
});

test("the camera keeps the view inside the pitch plus its margin", () => {
  const view = createView(createCamera(), 1280, 720);
  const clamped = clampCamera(createCamera({ x: 500, y: 500 }), view);
  const limitX = PITCH_BOUNDS.maxX + CAMERA.boundsMargin + 1e-9;
  const limitY = PITCH_BOUNDS.maxY + CAMERA.boundsMargin + 1e-9;
  assert.ok(clamped.centre.x + view.halfWidth <= limitX);
  assert.ok(clamped.centre.y + view.halfHeight <= limitY);
});

test("a view taller than the pitch is centred on it", () => {
  const view = createView(createCamera(), 400, 4000);
  const clamped = clampCamera(createCamera({ x: 0, y: 60 }), view);
  assert.equal(clamped.centre.y, 0);
});

test("the pitch is vertical, so it is longer along y than along x", () => {
  assert.ok(
    PITCH_BOUNDS.maxY - PITCH_BOUNDS.minY >
      PITCH_BOUNDS.maxX - PITCH_BOUNDS.minX,
  );
});

test("each penalty arc ends on the edge of its penalty area", () => {
  const boxEdge = PITCH_BOUNDS.maxY - PITCH.penaltyAreaDepth;
  const arcs = PITCH_MARKINGS.filter(
    (m) => m.kind === "arc" && m.radius === PITCH.centreCircleRadius,
  );
  assert.equal(arcs.length, 2);
  arcs.forEach((arc) => {
    [arc.start, arc.end].forEach((angle) => {
      const y = arc.y + arc.radius * Math.sin(angle);
      const x = arc.x + arc.radius * Math.cos(angle);
      assert.ok(Math.abs(Math.abs(y) - boxEdge) < 1e-9);
      assert.ok(Math.abs(x) < PITCH.penaltyAreaWidth / 2);
    });
  });
});
