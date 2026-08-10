import test from "node:test";
import assert from "node:assert/strict";
import { selectPlayer } from "../web/world/selection.js";
import { ballPath } from "../web/world/interception.js";
import { DRIBBLE, PLAYER, SELECTION } from "../web/tuning.js";
import { ballAt, playerAt } from "./helpers.js";

const OURS = { name: "ours" };
const THEIRS = { name: "theirs" };
const OUTFIELD = Object.freeze({ name: "outfielder", keeper: false });
const KEEPER = Object.freeze({ name: "keeper", keeper: true });

// A ball at rest, so a player's time to meet it is set by the run alone.
const RESTING_BALL = ballAt({ x: 0, y: 0 });

// A margin's worth of running, so the fixtures read in the units the rule uses.
const MARGIN_RUN = SELECTION.switchMargin * PLAYER.maxSpeed;

// Far enough to be beaten either way, so a test that means "much slower" never
// lands inside the margin by accident.
const LONG_RUN = MARGIN_RUN * 3;
const ON_THE_BALL = 0;

// A player who has to run `gap` metres before the ball is inside their control
// radius.
function teammate(team, gap, role = OUTFIELD) {
  return {
    ...playerAt({ x: 0, y: gap + DRIBBLE.controlRadius }),
    team,
    role,
  };
}

function selectionFor(
  players,
  ball,
  { selectedIndex = 0, recentToucherIndex = null, selectionHold = 0 } = {},
) {
  return selectPlayer(
    { players, selectedIndex, recentToucherIndex, selectionHold },
    ballPath(ball),
  );
}

test("the teammate who meets the ball soonest takes the selection", () => {
  const holder = teammate(OURS, LONG_RUN);
  const nearest = teammate(OURS, ON_THE_BALL);
  const furthest = teammate(OURS, LONG_RUN * 2);
  const squad = [holder, nearest, furthest];

  assert.equal(selectionFor(squad, RESTING_BALL), squad.indexOf(nearest));
});

test("a carrier keeps the selection when a teammate meets the ball sooner", () => {
  const carrier = teammate(OURS, LONG_RUN);
  const nearest = teammate(OURS, ON_THE_BALL);
  const squad = [carrier, nearest];

  assert.equal(
    selectionFor(squad, RESTING_BALL, {
      recentToucherIndex: squad.indexOf(carrier),
    }),
    squad.indexOf(carrier),
  );
});

test("a teammate's touch takes the selection", () => {
  const holder = teammate(OURS, LONG_RUN);
  const toucher = teammate(OURS, LONG_RUN);
  const nearest = teammate(OURS, ON_THE_BALL);
  const squad = [holder, toucher, nearest];

  assert.equal(
    selectionFor(squad, RESTING_BALL, {
      recentToucherIndex: squad.indexOf(toucher),
    }),
    squad.indexOf(toucher),
  );
});

test("a teammate's touch beats a running hold", () => {
  const holder = teammate(OURS, ON_THE_BALL);
  const toucher = teammate(OURS, LONG_RUN);
  const squad = [holder, toucher];

  assert.equal(
    selectionFor(squad, RESTING_BALL, {
      recentToucherIndex: squad.indexOf(toucher),
      selectionHold: SELECTION.holdAfterKickSeconds,
    }),
    squad.indexOf(toucher),
  );
});

test("the keeper's touch does not hand it the keyboard", () => {
  const holder = teammate(OURS, LONG_RUN);
  const keeper = teammate(OURS, ON_THE_BALL, KEEPER);
  const squad = [holder, keeper];

  assert.equal(
    selectionFor(squad, RESTING_BALL, {
      recentToucherIndex: squad.indexOf(keeper),
    }),
    squad.indexOf(holder),
  );
});

test("an opponent carrying the ball does not hold the selection", () => {
  const holder = teammate(OURS, LONG_RUN);
  const nearest = teammate(OURS, ON_THE_BALL);
  const opponent = teammate(THEIRS, ON_THE_BALL);
  const squad = [holder, nearest, opponent];

  assert.equal(
    selectionFor(squad, RESTING_BALL, {
      recentToucherIndex: squad.indexOf(opponent),
    }),
    squad.indexOf(nearest),
  );
});

test("a teammate sooner by less than the margin does not take the selection", () => {
  const holder = teammate(OURS, LONG_RUN);
  const rival = teammate(OURS, LONG_RUN - MARGIN_RUN * 0.5);
  const squad = [holder, rival];

  assert.equal(selectionFor(squad, RESTING_BALL), squad.indexOf(holder));
});

test("a teammate sooner by more than the margin takes the selection", () => {
  const holder = teammate(OURS, LONG_RUN);
  const rival = teammate(OURS, LONG_RUN - MARGIN_RUN * 1.5);
  const squad = [holder, rival];

  assert.equal(selectionFor(squad, RESTING_BALL), squad.indexOf(rival));
});

test("a hold keeps the selection still, whoever meets the ball soonest", () => {
  const holder = teammate(OURS, LONG_RUN);
  const nearest = teammate(OURS, ON_THE_BALL);
  const squad = [holder, nearest];

  assert.equal(
    selectionFor(squad, RESTING_BALL, {
      selectionHold: SELECTION.holdAfterKickSeconds,
    }),
    squad.indexOf(holder),
  );
});

test("a spent hold hands the selection on again", () => {
  const holder = teammate(OURS, LONG_RUN);
  const nearest = teammate(OURS, ON_THE_BALL);
  const squad = [holder, nearest];

  assert.equal(
    selectionFor(squad, RESTING_BALL, { selectionHold: 0 }),
    squad.indexOf(nearest),
  );
});

test("the keeper is never selected, however near the ball", () => {
  const holder = teammate(OURS, LONG_RUN);
  const keeper = teammate(OURS, ON_THE_BALL, KEEPER);
  const squad = [holder, keeper];

  assert.equal(selectionFor(squad, RESTING_BALL), squad.indexOf(holder));
});

test("an opponent nearer the ball is never selected", () => {
  const holder = teammate(OURS, LONG_RUN);
  const opponent = teammate(THEIRS, ON_THE_BALL);
  const squad = [holder, opponent];

  assert.equal(selectionFor(squad, RESTING_BALL), squad.indexOf(holder));
});

test("players who meet the ball at the same tick are split by the shorter run", () => {
  const nearest = teammate(OURS, LONG_RUN);
  const furthest = teammate(OURS, LONG_RUN * 2);
  const between = teammate(OURS, LONG_RUN * 1.5);
  const squad = [nearest, furthest, between];

  assert.equal(selectionFor(squad, RESTING_BALL), squad.indexOf(nearest));
});

test("a rolling ball is chased by the player its path favours", () => {
  // The holder stands 6 m behind the ball and a teammate 8 m in front of it:
  // the holder is nearer today and is chasing a ball that outruns it, while
  // the ball rolls to the teammate.
  const holder = { ...teammate(OURS, ON_THE_BALL), position: { x: 0, y: 6 } };
  const ahead = { ...teammate(OURS, ON_THE_BALL), position: { x: 0, y: -8 } };
  const squad = [holder, ahead];
  const rolling = ballAt({ x: 0, y: 0 }, { x: 0, y: -12, z: 0 });

  assert.equal(selectionFor(squad, rolling), squad.indexOf(ahead));
});
