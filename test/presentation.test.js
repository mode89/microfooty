import test from "node:test";
import assert from "node:assert/strict";

import { CAMERA } from "../web/tuning.js";
import {
  clampCamera,
  createCamera,
  createView,
  followCamera,
} from "../web/view/camera.js";
import {
  advancePresentation,
  createPresentation,
  drawPresentation,
} from "../web/view/presentation.js";
import { advanceMatch, createMatch } from "../web/world/match.js";
import { PITCH_BOUNDS } from "../web/world/pitch.js";
import { kitOf } from "../web/world/team.js";
import { STILL } from "./helpers.js";

const SCREEN = Object.freeze({ width: 1280, height: 720 });
const TICK = 1 / 60;

// Ten smoothing time constants leave the camera settled on its limit.
const SETTLED_TICKS = Math.ceil((10 * CAMERA.smoothingSeconds) / TICK);

const BALL_SPRITE = { name: "ball" };
const OUTFIELD = Object.freeze({ keeper: false });

function player(position, kitName) {
  return {
    position,
    heading: { x: 0, y: 1 },
    team: { kit: { name: kitName } },
    role: OUTFIELD,
  };
}

function matchOf(players, ballPosition) {
  return {
    players,
    ball: { position: ballPosition, velocity: { x: 0, y: 0 } },
  };
}

function matchWithMovingBall() {
  const match = createMatch();
  return { ...match, ball: { ...match.ball, velocity: { x: 3, y: 14 } } };
}

function spriteSet(name) {
  const sprite = { name };
  return { down: sprite, up: sprite, left: sprite, right: sprite };
}

// One sprite set per kit worn in the match, named after that kit.
function kitSpritesFor(players) {
  return Object.fromEntries(
    players.map((worn) => {
      const { name } = kitOf(worn.team, worn.role);
      return [name, spriteSet(name)];
    }),
  );
}

function presentationOf({
  match,
  previousMatch = match,
  camera,
  previousCamera,
}) {
  return {
    ...createPresentation({
      match,
      camera,
      ballSprite: BALL_SPRITE,
      kitSprites: kitSpritesFor(match.players),
    }),
    previousMatch,
    previousCamera: previousCamera ?? camera ?? createCamera(),
  };
}

function startedFrom(match) {
  return createPresentation({
    match,
    ballSprite: BALL_SPRITE,
    kitSprites: {},
  });
}

function recordingContext() {
  const calls = [];
  function record(name) {
    return (...args) => calls.push({ name, args });
  }
  return {
    calls,
    fillRect: record("fillRect"),
    beginPath: record("beginPath"),
    rect: record("rect"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    arc: record("arc"),
    ellipse: record("ellipse"),
    fill: record("fill"),
    stroke: record("stroke"),
    drawImage: record("drawImage"),
  };
}

function drawStill(presentation, alpha = 0) {
  const context = recordingContext();
  drawPresentation(context, SCREEN, presentation, alpha);
  return context.calls;
}

function drawnSprites(calls) {
  return calls
    .filter((call) => call.name === "drawImage")
    .map((call) => call.args[0].name);
}

function drawnAt(calls, name) {
  const call = calls.find(
    (drawn) => drawn.name === "drawImage" && drawn.args[0].name === name,
  );
  assert.ok(call, `the sprite ${name} was never drawn`);
  return { x: call.args[1], y: call.args[2] };
}

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );
}

test("the pitch is drawn before the ball, and the ball under every player", () => {
  const calls = drawStill(
    presentationOf({
      match: matchOf(
        [player({ x: 0, y: -5 }, "one"), player({ x: 0, y: 5 }, "two")],
        { x: 0, y: 0, z: 0 },
      ),
    }),
  );

  const firstPitch = calls.findIndex((call) => call.name === "fillRect");
  const firstSprite = calls.findIndex((call) => call.name === "drawImage");
  assert.ok(firstPitch >= 0 && firstPitch < firstSprite);
  assert.deepEqual(drawnSprites(calls), ["ball", "one", "two"]);
});

test("players are drawn up the pitch, so a nearer body covers a farther one", () => {
  const calls = drawStill(
    presentationOf({
      match: matchOf(
        [
          player({ x: 0, y: 8 }, "nearest"),
          player({ x: 0, y: -12 }, "farthest"),
          player({ x: 0, y: 1 }, "middle"),
        ],
        { x: 0, y: 0, z: 0 },
      ),
    }),
  );

  assert.deepEqual(drawnSprites(calls), [
    "ball",
    "farthest",
    "middle",
    "nearest",
  ]);
});

test("a player wears the kit of their team and role", () => {
  const keeper = {
    ...player({ x: 0, y: 0 }, "outfield"),
    team: { kit: { name: "outfield" }, keeperKit: { name: "keeper" } },
    role: { keeper: true },
  };

  const calls = drawStill(
    presentationOf({ match: matchOf([keeper], { x: 0, y: 20, z: 0 }) }),
  );

  assert.deepEqual(drawnSprites(calls), ["ball", "keeper"]);
});

test("players are sorted on where they are drawn, not on where they end the tick", () => {
  const previousMatch = matchOf(
    [player({ x: 0, y: -10 }, "one"), player({ x: 0, y: 10 }, "two")],
    { x: 0, y: 0, z: 0 },
  );
  const match = matchOf(
    [player({ x: 0, y: 10 }, "one"), player({ x: 0, y: -10 }, "two")],
    { x: 0, y: 0, z: 0 },
  );

  const calls = drawStill(presentationOf({ match, previousMatch }), 0.25);

  assert.deepEqual(drawnSprites(calls), ["ball", "one", "two"]);
});

test("a player is drawn between its two match positions", () => {
  const previousMatch = matchOf([player({ x: -20, y: -30 }, "one")], {
    x: 0,
    y: 0,
    z: 0,
  });
  const match = matchOf([player({ x: 20, y: 30 }, "one")], {
    x: 0,
    y: 0,
    z: 0,
  });
  const presentation = presentationOf({ match, previousMatch });

  const from = drawnAt(drawStill(presentation, 0), "one");
  const to = drawnAt(drawStill(presentation, 1), "one");
  const half = drawnAt(drawStill(presentation, 0.5), "one");

  assert.ok(Math.abs(from.x - to.x) > 1);
  closeTo(half.x, (from.x + to.x) / 2);
  closeTo(half.y, (from.y + to.y) / 2);
});

test("the ball is drawn between its two match positions, height included", () => {
  const previousMatch = matchOf([], { x: -8, y: -6, z: 0 });
  const match = matchOf([], { x: 8, y: 6, z: 4 });
  const presentation = presentationOf({ match, previousMatch });

  const from = drawnAt(drawStill(presentation, 0), "ball");
  const to = drawnAt(drawStill(presentation, 1), "ball");
  const half = drawnAt(drawStill(presentation, 0.5), "ball");

  assert.ok(Math.abs(from.y - to.y) > 1);
  closeTo(half.x, (from.x + to.x) / 2);
  closeTo(half.y, (from.y + to.y) / 2);
});

test("the view centre is drawn between the two camera centres", () => {
  const match = matchOf([], { x: 0, y: 0, z: 0 });
  const presentation = presentationOf({
    match,
    previousCamera: createCamera({ x: 0, y: -20 }),
    camera: createCamera({ x: 0, y: 20 }),
  });

  const from = drawnAt(drawStill(presentation, 0), "ball");
  const to = drawnAt(drawStill(presentation, 1), "ball");
  const half = drawnAt(drawStill(presentation, 0.5), "ball");

  assert.ok(Math.abs(from.y - to.y) > 1);
  closeTo(half.y, (from.y + to.y) / 2);
});

test("a tick advances the match once and keeps the one before it", () => {
  const match = matchWithMovingBall();
  const first = advancePresentation(startedFrom(match), SCREEN, STILL, TICK);
  const second = advancePresentation(first, SCREEN, STILL, TICK);

  assert.equal(first.previousMatch, match);
  assert.deepEqual(first.match, advanceMatch(match, STILL, TICK));
  assert.equal(second.previousMatch, first.match);
  assert.deepEqual(second.match, advanceMatch(first.match, STILL, TICK));
});

test("a tick follows and clamps the camera once, and keeps the one before it", () => {
  const start = startedFrom(matchWithMovingBall());

  const ticked = advancePresentation(start, SCREEN, STILL, TICK);

  const view = createView(createCamera(), SCREEN.width, SCREEN.height);
  const once = clampCamera(
    followCamera(start.camera, ticked.match.ball, TICK),
    view,
  );
  assert.deepEqual(ticked.camera, once);
  assert.equal(ticked.previousCamera, start.camera);

  const twice = advancePresentation(ticked, SCREEN, STILL, TICK);
  assert.equal(twice.previousCamera, ticked.camera);
  assert.notDeepEqual(twice.previousCamera, start.camera);
});

test("the camera follows the ball to the end of the pitch, and no further", () => {
  const full = createMatch();
  const beyondTheGoalLine = { x: 0, y: PITCH_BOUNDS.maxY * 2, z: 0 };
  let presentation = startedFrom({
    ...full,
    ball: { ...full.ball, position: beyondTheGoalLine },
  });

  for (let tick = 0; tick < SETTLED_TICKS; tick += 1)
    presentation = advancePresentation(presentation, SCREEN, STILL, TICK);

  const view = createView(createCamera(), SCREEN.width, SCREEN.height);
  closeTo(
    presentation.camera.centre.y,
    PITCH_BOUNDS.maxY + CAMERA.boundsMargin - view.worldHalfHeight,
  );
});
