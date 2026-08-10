import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceMatch,
  createMatch,
  selectedPlayer,
} from "../web/world/match.js";
import { advanceBall } from "../web/world/ball.js";
import { homePosition } from "../web/world/formation.js";
import { advancePlayer, directionFromInput } from "../web/world/player.js";
import { advancePossession } from "../web/world/possession.js";
import { TEAMS } from "../web/world/team.js";
import {
  BALL,
  BODY,
  DRIBBLE,
  KICK,
  PLAYER,
  SELECTION,
  STEERING,
} from "../web/tuning.js";
import { ballAt, STILL } from "./helpers.js";

const RUNNING_UP = Object.freeze({ ...STILL, up: true });
const RUNNING_RIGHT = Object.freeze({ ...STILL, right: true });
const KICKING_UP = Object.freeze({ ...RUNNING_UP, kick: true });
const KICKING_STILL = Object.freeze({ ...STILL, kick: true });
const TICK = 1 / 60;

// A ball rolling across the chaser's line, so aiming at it and aiming ahead of
// it are different runs.
const ROLLING_ACROSS = Object.freeze({ x: 6, y: 0, z: 0 });

// A switch margin's worth of running, so the fixtures that have to beat the
// margin read in the units the rule uses.
const MARGIN_RUN = SELECTION.switchMargin * PLAYER.maxSpeed;

// A run to the ball that beats every teammate left in the kick-off shape by
// more than the margin, so the chaser keeps the selection.
const CHASING_GAP = DRIBBLE.controlRadius + MARGIN_RUN;

// Two seconds of running plus twice the margin behind a player on the ball, so
// the handover is won whatever the margin and however long a raised ball takes
// to drop.
const STRANDED_GAP =
  DRIBBLE.controlRadius + MARGIN_RUN * 2 + PLAYER.maxSpeed * 2;
const OUT_OF_THE_CHASE = Object.freeze({ x: 0, y: STRANDED_GAP });

// Stands the keyboard player within touching range below the centre spot.
const STRIDE_BEHIND_THE_BALL = DRIBBLE.controlRadius * 0.9;
const MID_RANGE = DRIBBLE.controlRadius * 0.5;
const CONTROL_EDGE = DRIBBLE.controlRadius * 0.9;

// Far enough up the pitch to slide every home clear of the arrival band the
// players settled in at kick-off.
const BALL_UP_THE_PITCH = Object.freeze({ x: 0, y: -20 });

// Where a full-blooded kick up the pitch comes to rest, near enough the far
// end to stay on it.
const DOWNFIELD = Object.freeze({ x: 0, y: -45 });

// Places named players, keyed by their index in the match, and leaves the rest
// in their formation.
function placed(match, positions) {
  return {
    ...match,
    players: match.players.map((player, index) =>
      index in positions ? { ...player, position: positions[index] } : player,
    ),
  };
}

function changedPlayers(match, changes) {
  return {
    ...match,
    players: match.players.map((player, index) => {
      const change = changes[index];
      if (!change) return player;
      return {
        ...player,
        ...change,
        control: change.control
          ? { ...player.control, ...change.control }
          : player.control,
      };
    }),
  };
}

function standingBehindTheBall(match) {
  return placed(match, {
    [match.selectedIndex]: { x: 0, y: STRIDE_BEHIND_THE_BALL },
  });
}

function withBallAt(match, { x, y }) {
  return {
    ...match,
    ball: { ...match.ball, position: { x, y, z: BALL.radius } },
  };
}

function withBallUntouchableFor(match, ticks) {
  const fall = 0.5 * BALL.gravity * (ticks * TICK) ** 2;
  return {
    ...match,
    ball: {
      ...match.ball,
      position: {
        ...match.ball.position,
        z: DRIBBLE.maxTouchHeight + fall + 1,
      },
    },
  };
}

function indexOfRole(match, name) {
  return match.players.findIndex((player) => player.role.name === name);
}

function indexOfTeamRole(match, team, name) {
  return match.players.findIndex(
    (player) => player.team === team && player.role.name === name,
  );
}

function play(match, actions, ticks) {
  let current = match;
  for (let tick = 0; tick < ticks; tick += 1)
    current = advanceMatch(current, actions, TICK);
  return current;
}

function groundGap(player, ball) {
  return Math.hypot(
    ball.position.x - player.position.x,
    ball.position.y - player.position.y,
  );
}

function advanceSoloMatchWithoutChasing(match, actions, seconds) {
  const direction = directionFromInput(actions);
  const possession = advancePossession(
    {
      players: match.players,
      ball: match.ball,
      recentToucherIndex: match.recentToucherIndex,
      kickCharge: match.kickCharge,
    },
    {
      directions: [direction],
      earlyToucherIndex:
        match.keyboardDirection.x !== direction.x ||
        match.keyboardDirection.y !== direction.y
          ? 0
          : null,
      kickingPlayerIndex: 0,
      kickHeld: actions.kick,
    },
    seconds,
  );
  return {
    ...match,
    players: [advancePlayer(possession.players[0], seconds)],
    ball: advanceBall(possession.ball, seconds),
    // Every tick of this reference presses a key, so the keyboard is held from
    // the first one.
    keyboardEngaged: true,
    keyboardDirection: direction,
    recentToucherIndex: possession.recentToucherIndex,
    kickCharge: possession.kickCharge,
  };
}

function groundSpeed({ velocity }) {
  return Math.hypot(velocity.x, velocity.y);
}

function createOnePlayerMatch() {
  const fullMatch = createMatch();
  return {
    ...fullMatch,
    players: [
      {
        ...selectedPlayer(fullMatch),
        position: { x: 0, y: 0 },
      },
    ],
    ball: {
      ...fullMatch.ball,
      position: { x: 0, y: DRIBBLE.idealLead, z: BALL.radius },
    },
    selectedIndex: 0,
    recentToucherIndex: null,
  };
}

test("a match puts twenty-two players on the pitch, eleven a side", () => {
  const match = createMatch();
  assert.equal(match.players.length, 22);
  TEAMS.forEach((team) =>
    assert.equal(
      match.players.filter((player) => player.team === team).length,
      11,
    ),
  );
});

test("a match holds one control per player", () => {
  const match = createMatch();
  match.players.forEach((player) => assert.equal(player.control.touchTimer, 0));
  assert.equal(
    new Set(match.players.map((player) => player.control)).size,
    match.players.length,
  );
});

test("a directional input change allows an early touch and resets its timer", () => {
  const created = createMatch();
  let match = placed(created, {
    [created.selectedIndex]: { x: 0, y: MID_RANGE },
  });
  match = changedPlayers(match, {
    [match.selectedIndex]: {
      control: {
        touchTimer: DRIBBLE.touchPeriod / 2,
      },
    },
  });

  const after = advanceMatch(match, RUNNING_UP, TICK);
  assert.equal(
    after.players[match.selectedIndex].control.touchTimer,
    DRIBBLE.touchPeriod,
  );
  assert.equal(after.recentToucherIndex, match.selectedIndex);
  assert.ok(after.ball.velocity.y < 0);
});

test("releasing directional input earns a touch along the last heading", () => {
  const created = createMatch();
  let match = placed(created, {
    [created.selectedIndex]: { x: 0, y: MID_RANGE },
  });
  match = changedPlayers(
    { ...match, keyboardDirection: { x: 0, y: -1 }, keyboardEngaged: true },
    {
      [match.selectedIndex]: {
        heading: { x: 0, y: -1 },
        control: {
          touchTimer: DRIBBLE.touchPeriod / 2,
        },
      },
    },
  );

  const after = advanceMatch(match, STILL, TICK);
  assert.equal(
    after.players[match.selectedIndex].control.touchTimer,
    DRIBBLE.touchPeriod,
  );
  assert.equal(after.recentToucherIndex, match.selectedIndex);
  assert.ok(after.ball.velocity.y < 0);
});

test("a key released as the selection moves buys the new player no touch", () => {
  const created = createMatch();
  const chaserIndex = indexOfTeamRole(created, TEAMS[0], "leftStriker");
  const match = changedPlayers(
    {
      ...placed(created, {
        [chaserIndex]: { x: 0, y: MID_RANGE },
        [created.selectedIndex]: OUT_OF_THE_CHASE,
      }),
      keyboardEngaged: true,
      keyboardDirection: { x: 0, y: -1 },
    },
    { [chaserIndex]: { control: { touchTimer: DRIBBLE.touchPeriod / 2 } } },
  );

  const after = advanceMatch(match, STILL, TICK);

  assert.equal(
    after.selectedIndex,
    chaserIndex,
    "the chaser should take the selection on this tick",
  );
  assert.equal(after.recentToucherIndex, null);
  assert.ok(
    after.players[chaserIndex].control.touchTimer < DRIBBLE.touchPeriod,
  );
});

test("an input-change touch is checked before the player moves", () => {
  const created = createMatch();
  const match = placed(created, {
    [created.selectedIndex]: { x: 0, y: -CONTROL_EDGE },
  });
  const after = advanceMatch(match, RUNNING_UP, TICK);
  assert.equal(after.recentToucherIndex, match.selectedIndex);
  assert.equal(
    after.players[match.selectedIndex].control.touchTimer,
    DRIBBLE.touchPeriod,
  );
});

test("match resolves possession before body push and ball motion", () => {
  const created = createMatch();
  const role = {
    ...selectedPlayer(created).role,
    homeFraction: { x: 0, y: 0 },
  };
  const position = { x: 0, y: DRIBBLE.controlRadius * 0.1 };
  const player = {
    ...selectedPlayer(created),
    role,
    position,
    heading: { x: 0, y: -1 },
  };
  const blocker = {
    ...player,
    control: { ...player.control, touchTimer: DRIBBLE.touchPeriod },
  };
  const match = {
    ...created,
    players: [player, blocker],
    selectedIndex: 0,
    ball: {
      ...created.ball,
      position: { x: 0, y: DRIBBLE.controlRadius * 0.2, z: BALL.radius },
    },
  };

  const after = advanceMatch(match, STILL, TICK);

  assert.ok(after.players[0].position.x < 0);
  assert.ok(after.players[1].position.x > 0);
  assert.ok(Math.abs(after.ball.position.x) < 1e-12);
  assert.ok(after.ball.position.y < match.ball.position.y);
});

test("every player starts on the home place of their role", () => {
  const match = createMatch();
  match.players.forEach((player) =>
    assert.deepEqual(
      player.position,
      homePosition(
        player.role,
        player.team.attackingDirection,
        match.ball.position,
      ),
    ),
  );
});

test("players outside the chase run to the home the ball asks for", () => {
  const runHomeTicks = 120;
  const ballShifted = withBallAt(createMatch(), BALL_UP_THE_PITCH);
  const [firstChaserIndex, secondChaserIndex] = TEAMS.map((team) =>
    indexOfTeamRole(ballShifted, team, "leftStriker"),
  );
  const chaserIndexes = new Set([firstChaserIndex, secondChaserIndex]);
  const withNamedChasers = placed(ballShifted, {
    [firstChaserIndex]: { x: -1, y: BALL_UP_THE_PITCH.y },
    [secondChaserIndex]: { x: 1, y: BALL_UP_THE_PITCH.y },
  });
  const shifted = withBallUntouchableFor(withNamedChasers, runHomeTicks);
  const moved = play(shifted, STILL, runHomeTicks);
  moved.players.forEach((player, index) => {
    if (index === shifted.selectedIndex || chaserIndexes.has(index)) return;
    const target = homePosition(
      player.role,
      player.team.attackingDirection,
      BALL_UP_THE_PITCH,
    );
    assert.ok(
      Math.hypot(player.position.x - target.x, player.position.y - target.y) <
        STEERING.arrivalRadius,
      `${player.role.name} stopped short of the home the ball asked for`,
    );
  });
});

test("a match kicks off with the ball on the centre spot", () => {
  const ball = createMatch().ball;
  assert.equal(ball.position.x, 0);
  assert.equal(ball.position.y, 0);
});

test("the keyboard drives one of the twenty-two", () => {
  const match = createMatch();
  assert.ok(match.players.includes(selectedPlayer(match)));
});

test("a shape without the keyboard's role is refused", () => {
  const keeperOnly = TEAMS.map((team) => ({
    ...team,
    roles: team.roles.filter((role) => role.keeper),
  }));
  assert.throws(() => createMatch(keeperOnly), /keyboard/);
});

// Puts the nearest player of each team on a loose ball, with the player who
// holds the selection sent well out of the chase.
function looseBallChase() {
  const created = createMatch();
  const chaserIndexes = TEAMS.map((team) =>
    indexOfTeamRole(created, team, "leftStriker"),
  );
  const match = withBallUntouchableFor(
    placed(created, {
      [chaserIndexes[0]]: { x: 0, y: 0 },
      [chaserIndexes[1]]: { x: 0, y: -2 },
      [indexOfTeamRole(created, TEAMS[0], "rightStriker")]: OUT_OF_THE_CHASE,
    }),
    1,
  );
  return { match, chaserIndexes };
}

test("the nearest player of each team chases the loose ball", () => {
  const { match, chaserIndexes } = looseBallChase();
  const nonChaserIndexes = TEAMS.map((team) =>
    indexOfTeamRole(match, team, "leftCentreBack"),
  );

  const after = play(match, STILL, 1);

  chaserIndexes.forEach((index) =>
    assert.ok(
      groundGap(after.players[index], after.ball) <=
        groundGap(match.players[index], match.ball),
      `the ${after.players[index].team.name} chaser should close on the ball`,
    ),
  );
  nonChaserIndexes.forEach((index) =>
    assert.deepEqual(
      after.players[index].position,
      match.players[index].position,
    ),
  );
});

test("the selection moves to the player who meets the loose ball soonest", () => {
  const { match, chaserIndexes } = looseBallChase();
  const after = play(match, STILL, 1);
  assert.equal(after.selectedIndex, chaserIndexes[0]);
});

// Selection is set by hand here, so these read the keyboard's grip on a player
// rather than the margin that hands the player over.
function chasingMatch({ engaged, gap = CHASING_GAP }) {
  const created = createMatch();
  const chaserIndex = indexOfTeamRole(created, TEAMS[0], "leftStriker");
  return {
    ...withBallUntouchableFor(
      placed(created, { [chaserIndex]: { x: 0, y: gap } }),
      1,
    ),
    selectedIndex: chaserIndex,
    keyboardEngaged: engaged,
  };
}

test("a kick keeps the selection with the kicker until the hold runs out", () => {
  const charged = play(kickerAndReceiver(), KICKING_UP, 20);
  const kicked = advanceMatch(charged, RUNNING_UP, TICK);
  assert.equal(kicked.selectionHold, SELECTION.holdAfterKickSeconds);

  const holdTicks = Math.round(SELECTION.holdAfterKickSeconds / TICK) - 1;
  const held = play(kicked, STILL, holdTicks);
  assert.equal(
    held.selectedIndex,
    charged.selectedIndex,
    "the kicker should keep the selection while the hold runs",
  );

  const spent = play(held, STILL, 5);
  assert.notEqual(
    spent.selectedIndex,
    charged.selectedIndex,
    "a spent hold should let the ball take the selection again",
  );
});

// The kicker and one teammate alone, the teammate far enough up the pitch that
// the kicked ball has nearly finished its run before it can be met: no third
// player is left to touch the ball and end the hold with a touch instead.
function kickerAndReceiver() {
  const created = createMatch();
  const receiverIndex = indexOfTeamRole(created, TEAMS[0], "leftStriker");
  return {
    ...created,
    players: [
      {
        ...selectedPlayer(created),
        position: { x: 0, y: STRIDE_BEHIND_THE_BALL },
      },
      { ...created.players[receiverIndex], position: DOWNFIELD },
    ],
    selectedIndex: 0,
  };
}

test("a teammate's touch takes the selection before the kick hold runs out", () => {
  const created = createMatch();
  const receiverIndex = indexOfTeamRole(created, TEAMS[0], "leftStriker");
  const kicked = {
    ...placed(created, { [receiverIndex]: { x: 0, y: MID_RANGE } }),
    selectionHold: SELECTION.holdAfterKickSeconds,
  };

  // Selection is settled before the touch, so the handover lands on the tick
  // after it.
  const received = play(kicked, STILL, 2);

  assert.ok(received.selectionHold > 0, "the hold should still be running");
  assert.equal(received.recentToucherIndex, receiverIndex);
  assert.equal(received.selectedIndex, receiverIndex);
});

test("a chaser runs at where the ball will be, not at where it is", () => {
  const created = createMatch();
  const chaserIndex = indexOfTeamRole(created, TEAMS[0], "leftStriker");
  const rolling = {
    ...placed(created, { [chaserIndex]: { x: 0, y: 5 } }),
    ball: ballAt({ x: 0, y: 0 }, ROLLING_ACROSS),
    selectedIndex: chaserIndex,
    keyboardEngaged: false,
  };

  const chaser = advanceMatch(rolling, STILL, TICK).players[chaserIndex];

  // Running at the ball where it stands is a run straight up the y axis, so
  // any lead along x is the ball's future being aimed at.
  assert.ok(chaser.position.x > 0);
  assert.ok(chaser.position.y < 5);
});

test("an auto-selected player chases on until the keyboard is used", () => {
  const match = chasingMatch({ engaged: false });
  const after = advanceMatch(match, STILL, TICK);
  assert.equal(
    after.selectedIndex,
    match.selectedIndex,
    "the chaser should keep the selection",
  );
  assert.ok(
    groundGap(after.players[after.selectedIndex], match.ball) <
      groundGap(match.players[match.selectedIndex], match.ball),
  );
});

test("the first press takes the selected player off the chase", () => {
  const match = chasingMatch({ engaged: false });
  const after = advanceMatch(match, RUNNING_RIGHT, TICK);
  assert.ok(after.keyboardEngaged);
  assert.ok(after.players[after.selectedIndex].position.x > 0);
});

test("the kick button alone takes the selected player off the chase", () => {
  const match = chasingMatch({ engaged: false });
  const after = advanceMatch(match, KICKING_STILL, TICK);
  assert.ok(after.keyboardEngaged);
  assert.equal(after.players[after.selectedIndex].speed, 0);
});

test("releasing the keys leaves the player standing rather than chasing", () => {
  const match = chasingMatch({ engaged: true });
  const after = advanceMatch(match, STILL, TICK);
  assert.ok(after.keyboardEngaged);
  assert.deepEqual(
    after.players[after.selectedIndex].position,
    match.players[match.selectedIndex].position,
  );
});

test("a new selection hands its player back to the chase", () => {
  const stranded = chasingMatch({ engaged: true, gap: STRANDED_GAP });
  const nearerIndex = indexOfTeamRole(stranded, TEAMS[0], "rightStriker");
  const match = placed(stranded, { [nearerIndex]: { x: 0, y: 1 } });

  const after = advanceMatch(match, STILL, TICK);

  assert.equal(after.selectedIndex, nearerIndex);
  assert.equal(after.keyboardEngaged, false);
  assert.ok(
    groundGap(after.players[nearerIndex], match.ball) <
      groundGap(match.players[nearerIndex], match.ball),
  );
});

test("keyboard direction overrides the chase", () => {
  const match = createOnePlayerMatch();

  const after = advanceMatch(match, RUNNING_RIGHT, TICK);

  assert.ok(selectedPlayer(after).position.x > 0);
  assert.equal(selectedPlayer(after).position.y, 0);
});

test("an AI chaser picks up a loose ball and carries it away", () => {
  const created = createMatch();
  const chaser =
    created.players[indexOfTeamRole(created, TEAMS[1], "rightStriker")];
  const match = {
    ...created,
    players: [
      { ...selectedPlayer(created), position: { x: 10, y: 10 } },
      // Its home is further up, so only chase steering sends it down to the ball.
      { ...chaser, position: { x: 0, y: -MID_RANGE } },
    ],
    selectedIndex: 0,
  };

  const after = play(match, STILL, 60);

  assert.equal(after.recentToucherIndex, 1);
  assert.ok(after.ball.position.y > 1);
  assert.ok(groundGap(after.players[1], after.ball) <= DRIBBLE.controlRadius);
});

test("a player away from their place runs back to it and settles", () => {
  const kickedOff = createMatch();
  const strayIndex = indexOfRole(kickedOff, "keeper");
  const home = kickedOff.players[strayIndex].position;
  const stray = placed(kickedOff, {
    [strayIndex]: { x: home.x + 10, y: home.y },
  });
  const settleTicks = 300;
  const back = play(
    withBallUntouchableFor(stray, settleTicks),
    STILL,
    settleTicks,
  ).players[strayIndex];
  assert.ok(
    Math.hypot(back.position.x - home.x, back.position.y - home.y) <=
      STEERING.arrivalRadius,
  );
  assert.ok(back.speed < 0.01);
});

test("bodies are parted inside the match, not only in the module", () => {
  const kickedOff = createMatch();
  const stackIndices = ["leftBack", "rightBack"].map((name) =>
    indexOfRole(kickedOff, name),
  );
  const corner = { x: 30, y: 48 };
  const stacked = placed(kickedOff, {
    [stackIndices[0]]: corner,
    [stackIndices[1]]: corner,
  });

  const parted = advanceMatch(stacked, STILL, TICK).players;
  const [first, second] = stackIndices.map((index) => parted[index].position);
  assert.ok(
    Math.hypot(second.x - first.x, second.y - first.y) >
      (BODY.diameter / 2) * BODY.pushRate * TICK,
  );
});

test("team chase selection leaves a solo M1 dribble unchanged", () => {
  let match = createOnePlayerMatch();
  let withoutChasing = match;
  for (const actions of [RUNNING_UP, RUNNING_RIGHT])
    for (let tick = 0; tick < 120; tick += 1) {
      match = advanceMatch(match, actions, TICK);
      withoutChasing = advanceSoloMatchWithoutChasing(
        withoutChasing,
        actions,
        TICK,
      );
      assert.deepEqual(match, withoutChasing);
    }
  assert.ok(match.ball.position.x > selectedPlayer(match).position.x);
});

test("the keyboard player dribbles the ball up the pitch", () => {
  const match = play(standingBehindTheBall(createMatch()), RUNNING_UP, 60);
  const gap = Math.hypot(
    match.ball.position.x - selectedPlayer(match).position.x,
    match.ball.position.y - selectedPlayer(match).position.y,
  );
  assert.ok(match.ball.position.y < -1);
  assert.ok(gap <= DRIBBLE.controlRadius);
});

test("the keyboard player strikes the ball on releasing the button", () => {
  const charged = play(standingBehindTheBall(createMatch()), KICKING_UP, 60);
  assert.ok(groundSpeed(charged.ball) < PLAYER.maxSpeed);

  const struck = advanceMatch(charged, RUNNING_UP, TICK).ball;
  assert.ok(groundSpeed(struck) > PLAYER.maxSpeed);
  assert.ok(struck.velocity.y < 0);
});

test("the wind-up is cleared when the selection moves mid hold", () => {
  const chasing = {
    ...createMatch(),
    ball: {
      position: { x: 0, y: -5, z: BALL.radius },
      velocity: { x: 4, y: -6, z: 0 },
    },
  };
  const ticks = 4 * Math.ceil(KICK.maximumCharge / TICK);

  let held = chasing;
  const seen = new Set([held.selectedIndex]);
  const switches = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    const next = advanceMatch(held, KICKING_UP, TICK);
    if (next.selectedIndex !== held.selectedIndex)
      switches.push({
        before: held.kickCharge,
        onSwitching: next.kickCharge,
        after: advanceMatch(next, KICKING_UP, TICK).kickCharge,
      });
    seen.add(next.selectedIndex);
    held = next;
  }

  assert.ok(seen.size > 1, "the selection must move for this to test anything");
  assert.ok(
    switches.some(({ before }) => before > 2 * TICK),
    "a switch must interrupt a real wind-up for this to test anything",
  );
  for (const { onSwitching, after } of switches) {
    assert.ok(Math.abs(onSwitching - TICK) < 1e-9, "the wind-up was kept");
    assert.ok(after > onSwitching, "the wind-up did not build again");
  }
  for (const player of held.players)
    assert.equal(player.control.charge, undefined);
});

test("a kick by a player who has never run goes the way the team attacks", () => {
  const charged = play(standingBehindTheBall(createMatch()), KICKING_STILL, 60);
  const struck = advanceMatch(charged, STILL, TICK).ball;
  assert.ok(groundSpeed(struck) > PLAYER.maxSpeed);
  assert.equal(
    Math.sign(struck.velocity.y),
    selectedPlayer(charged).team.attackingDirection,
  );
});

test("the ball runs on while nobody plays it", () => {
  const kickedOff = createMatch();
  const rolling = {
    ...kickedOff,
    ball: {
      ...kickedOff.ball,
      velocity: { x: 0, y: -4, z: 0 },
    },
  };
  assert.ok(advanceMatch(rolling, STILL, 0.1).ball.position.y < 0);
});
