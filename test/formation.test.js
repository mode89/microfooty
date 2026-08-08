import test from "node:test";
import assert from "node:assert/strict";
import { FORMATION_442, homePosition } from "../web/world/formation.js";
import {
  DOWN_THE_PITCH,
  PITCH_BOUNDS,
  UP_THE_PITCH,
} from "../web/world/pitch.js";
import { SHAPE } from "../web/tuning.js";

const CENTRE_SPOT = Object.freeze({ x: 0, y: 0 });
const GOAL_LINE = PITCH_BOUNDS.maxY;
const TOUCHLINE = PITCH_BOUNDS.maxX;

const BALL_PLACES = Object.freeze([
  CENTRE_SPOT,
  { x: 0, y: -GOAL_LINE },
  { x: 0, y: GOAL_LINE },
  { x: -TOUCHLINE, y: -GOAL_LINE },
  { x: TOUCHLINE, y: -GOAL_LINE },
  { x: -TOUCHLINE, y: GOAL_LINE },
  { x: TOUCHLINE, y: GOAL_LINE },
]);

const BALL_IN_A_CORNER = Object.freeze({ x: -TOUCHLINE, y: -GOAL_LINE });

// Beyond what any reach can follow, so a slide of this ball is spent and the
// spec's "by less than the ball moved" is really put to the test.
const BALL_BEYOND_EVERY_REACH = Object.freeze({ x: 0, y: -GOAL_LINE });

// Half of the keeper's reach, which is the shortest of the four, so a slide of
// this ball is the plain share for every role and no clamp hides the settings.
const BALL_INSIDE_EVERY_REACH = Object.freeze({
  x: -SHAPE.acrossPitch.keeperReach / SHAPE.acrossPitch.follow / 2,
  y: -SHAPE.alongPitch.keeperReach / SHAPE.alongPitch.follow / 2,
});

// The four lines of a 4-4-2, deepest first. The order they hold is the rule
// under test, so it is named here rather than read back out of FORMATION_442.
const LINES_BACK_TO_FRONT = Object.freeze([
  { name: "keeper", roles: ["keeper"] },
  {
    name: "defence",
    roles: ["leftBack", "leftCentreBack", "rightCentreBack", "rightBack"],
  },
  {
    name: "midfield",
    roles: [
      "leftMidfield",
      "leftCentreMidfield",
      "rightCentreMidfield",
      "rightMidfield",
    ],
  },
  { name: "attack", roles: ["leftStriker", "rightStriker"] },
]);

function shape(attackingDirection, ball = CENTRE_SPOT) {
  return FORMATION_442.map((role) =>
    homePosition(role, attackingDirection, ball),
  );
}

// What a ball's place did to a shape: each role beside the slide of its home,
// so a broken rule names the role rather than an index into the formation.
function slides(attackingDirection, ball) {
  const standing = shape(attackingDirection);
  return shape(attackingDirection, ball).map((home, index) => ({
    role: FORMATION_442[index],
    home,
    acrossPitch: home.x - standing[index].x,
    alongPitch: home.y - standing[index].y,
  }));
}

// How far up the pitch a role stands, counted the way its own side attacks.
function forwardness(roleName, attackingDirection, ball) {
  const role = FORMATION_442.find((each) => each.name === roleName);
  return attackingDirection * homePosition(role, attackingDirection, ball).y;
}

function insidePitch({ x, y }) {
  return (
    x >= PITCH_BOUNDS.minX &&
    x <= PITCH_BOUNDS.maxX &&
    y >= PITCH_BOUNDS.minY &&
    y <= PITCH_BOUNDS.maxY
  );
}

test("a formation places eleven roles", () => {
  assert.equal(FORMATION_442.length, 11);
});

test("a formation names exactly one keeper", () => {
  assert.equal(FORMATION_442.filter((role) => role.keeper).length, 1);
});

test("every role stands in a place of its own, inside the pitch", () => {
  const places = shape(DOWN_THE_PITCH);
  const distinct = new Set(places.map(({ x, y }) => `${x} ${y}`));
  assert.equal(distinct.size, places.length);
  places.forEach((place) => assert.ok(insidePitch(place)));
});

test("the two shapes mirror each other while the ball rests on the centre spot", () => {
  assert.deepEqual(
    shape(UP_THE_PITCH),
    shape(DOWN_THE_PITCH).map(({ x, y }) => ({ x, y: -y })),
  );
});

test("a side keeps its keeper on its own half", () => {
  const keeper = FORMATION_442.find((role) => role.keeper);
  assert.ok(homePosition(keeper, DOWN_THE_PITCH, CENTRE_SPOT).y < 0);
  assert.ok(homePosition(keeper, UP_THE_PITCH, CENTRE_SPOT).y > 0);
});

test("a ball up the pitch takes every home with it, by less than it moved", () => {
  const ballMoved = Math.abs(BALL_BEYOND_EVERY_REACH.y);
  [DOWN_THE_PITCH, UP_THE_PITCH].forEach((attackingDirection) =>
    slides(attackingDirection, BALL_BEYOND_EVERY_REACH).forEach(
      ({ role, home, alongPitch }) => {
        const movedUpThePitch = -alongPitch;
        assert.ok(movedUpThePitch > 0, `${role.name} stayed put`);
        assert.ok(movedUpThePitch < ballMoved, `${role.name} outran the ball`);
        assert.ok(insidePitch(home), `${role.name} left the pitch`);
      },
    ),
  );
});

test("a home follows its share of the ball while the slide fits its reach", () => {
  const ball = BALL_INSIDE_EVERY_REACH;
  [DOWN_THE_PITCH, UP_THE_PITCH].forEach((attackingDirection) =>
    slides(attackingDirection, ball).forEach(
      ({ role, acrossPitch, alongPitch }) => {
        assert.equal(acrossPitch, SHAPE.acrossPitch.follow * ball.x, role.name);
        assert.equal(alongPitch, SHAPE.alongPitch.follow * ball.y, role.name);
      },
    ),
  );
});

test("a keeper is held on a shorter rein than the outfield", () => {
  [DOWN_THE_PITCH, UP_THE_PITCH].forEach((attackingDirection) => {
    const slid = slides(attackingDirection, BALL_IN_A_CORNER);
    const keeper = slid.find(({ role }) => role.keeper);
    slid
      .filter(({ role }) => !role.keeper)
      .forEach((outfielder) => {
        assert.ok(
          Math.abs(keeper.acrossPitch) < Math.abs(outfielder.acrossPitch),
          `the keeper slid as far across the pitch as ${outfielder.role.name}`,
        );
        assert.ok(
          Math.abs(keeper.alongPitch) < Math.abs(outfielder.alongPitch),
          `the keeper slid as far up the pitch as ${outfielder.role.name}`,
        );
      });
  });
});

test("no home is ever slid onto a goal line or a touchline", () => {
  BALL_PLACES.forEach((ball) =>
    [DOWN_THE_PITCH, UP_THE_PITCH].forEach((attackingDirection) =>
      shape(attackingDirection, ball).forEach(({ x, y }, index) => {
        const where = `${FORMATION_442[index].name} for ball ${ball.x} ${ball.y}`;
        assert.ok(Math.abs(y) < GOAL_LINE, `${where} reached a goal line`);
        assert.ok(Math.abs(x) < TOUCHLINE, `${where} reached a touchline`);
      }),
    ),
  );
});

test("a reach long enough to leave the pitch is still held on it", () => {
  const wide = {
    alongPitch: { ...SHAPE.alongPitch, outfieldReach: 40, keeperReach: 40 },
    acrossPitch: { ...SHAPE.acrossPitch, outfieldReach: 40, keeperReach: 40 },
  };
  BALL_PLACES.forEach((ball) =>
    FORMATION_442.forEach((role) =>
      assert.ok(
        insidePitch(homePosition(role, DOWN_THE_PITCH, ball, wide)),
        `${role.name} left the pitch for ball ${ball.x} ${ball.y}`,
      ),
    ),
  );
});

test("the lines keep their order wherever the ball is", () => {
  assert.equal(
    LINES_BACK_TO_FRONT.flatMap(({ roles }) => roles).length,
    FORMATION_442.length,
    "the lines under test do not cover the whole formation",
  );
  BALL_PLACES.forEach((ball) => {
    [DOWN_THE_PITCH, UP_THE_PITCH].forEach((attackingDirection) => {
      const lines = LINES_BACK_TO_FRONT.map(({ name, roles }) => ({
        name,
        forwardness: roles.map((role) =>
          forwardness(role, attackingDirection, ball),
        ),
      }));
      lines
        .slice(1)
        .forEach((ahead, index) =>
          assert.ok(
            Math.max(...lines[index].forwardness) <
              Math.min(...ahead.forwardness),
            `${lines[index].name} is not behind ${ahead.name} for ball ${ball.x} ${ball.y} attacking ${attackingDirection}`,
          ),
        );
    });
  });
});
