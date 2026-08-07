import test from "node:test";
import assert from "node:assert/strict";

import {
  advance,
  startLoop,
  TICK_SECONDS,
  MAX_FRAME_SECONDS,
} from "../web/loop.js";

const closeTo = (actual, expected, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );

test("a frame shorter than a tick makes no tick and grows the accumulator", () => {
  const step = advance(0, TICK_SECONDS / 2);
  assert.equal(step.ticks, 0);
  closeTo(step.accumulator, TICK_SECONDS / 2);
  closeTo(step.alpha, 0.5);
});

test("a frame of exactly one tick produces one tick and no leftover", () => {
  const step = advance(0, TICK_SECONDS);
  assert.equal(step.ticks, 1);
  closeTo(step.accumulator, 0);
  closeTo(step.alpha, 0);
});

test("leftover time carries into the next frame", () => {
  const first = advance(0, TICK_SECONDS * 0.75);
  const second = advance(first.accumulator, TICK_SECONDS * 0.75);
  assert.equal(first.ticks, 0);
  assert.equal(second.ticks, 1);
  closeTo(second.alpha, 0.5);
});

test("a sequence of uneven frames runs 60 ticks per simulated second", () => {
  const frames = [0.01, 0.033, 0.008, 0.05, 0.02, 0.04, 0.009, 0.03];
  const total = frames.reduce((sum, frame) => sum + frame, 0);

  let accumulator = 0;
  let ticks = 0;
  for (const frame of frames) {
    const step = advance(accumulator, frame);
    accumulator = step.accumulator;
    ticks += step.ticks;
  }

  assert.equal(ticks, Math.floor(total / TICK_SECONDS));
});

test("a long stall is clamped, so the loop cannot spiral", () => {
  const step = advance(0, 10);
  assert.equal(step.ticks, Math.floor(MAX_FRAME_SECONDS / TICK_SECONDS));
  assert.ok(step.accumulator < TICK_SECONDS);
});

test("a negative or zero frame time produces no tick", () => {
  assert.equal(advance(0, 0).ticks, 0);
  assert.equal(advance(0, -1).ticks, 0);
  closeTo(advance(0, -1).accumulator, 0);
});

test("the loop ticks the simulation and renders once per frame", () => {
  const frames = [];
  let clock = 0;
  let ticks = 0;
  const renders = [];

  startLoop({
    tick: () => {
      ticks += 1;
    },
    render: (alpha) => renders.push(alpha),
    now: () => clock,
    schedule: (frame) => frames.push(frame),
  });

  const runFrame = (seconds) => {
    clock += seconds;
    frames.pop()();
  };

  runFrame(TICK_SECONDS * 2);
  runFrame(TICK_SECONDS / 2);

  assert.equal(ticks, 2);
  assert.equal(renders.length, 2);
  closeTo(renders[1], 0.5);
});

test("render receives raw wall-clock time when simulation time is clamped", () => {
  const frames = [];
  let clock = 0;
  let ticks = 0;
  let renderedSeconds;

  startLoop({
    tick: () => {
      ticks += 1;
    },
    render: (_alpha, wallClockSeconds) => {
      renderedSeconds = wallClockSeconds;
    },
    now: () => clock,
    schedule: (frame) => frames.push(frame),
  });

  clock = 10;
  frames.pop()();

  assert.equal(ticks, Math.floor(MAX_FRAME_SECONDS / TICK_SECONDS));
  assert.equal(renderedSeconds, 10);
});
