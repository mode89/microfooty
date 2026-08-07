import assert from "node:assert/strict";
import test from "node:test";

import { createInput } from "../web/input.js";

const createEventTarget = () => {
  const listeners = new Map();

  return {
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) ?? [];
      typeListeners.push(listener);
      listeners.set(type, typeListeners);
    },
    dispatch(type, code) {
      const event = {
        code,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      (listeners.get(type) ?? []).forEach((listener) => listener(event));
      return event;
    },
  };
};

test("releasing one key alias keeps its action held by another alias", () => {
  const target = createEventTarget();
  const input = createInput(target);

  target.dispatch("keydown", "ArrowUp");
  target.dispatch("keydown", "KeyW");
  const bothHeld = input.read();
  target.dispatch("keyup", "ArrowUp");

  assert.equal(input.read().up, true);
  assert.equal(bothHeld.up, true);
  assert.equal(Object.isFrozen(bothHeld), true);

  target.dispatch("keyup", "KeyW");
  assert.equal(input.read().up, false);
});

test("recognized keyboard events prevent their browser defaults", () => {
  const target = createEventTarget();
  createInput(target);

  assert.equal(target.dispatch("keydown", "Space").defaultPrevented, true);
  assert.equal(target.dispatch("keyup", "Space").defaultPrevented, true);
  assert.equal(target.dispatch("keydown", "KeyQ").defaultPrevented, false);
});

test("blur clears every held physical key", () => {
  const target = createEventTarget();
  const input = createInput(target);

  target.dispatch("keydown", "ArrowLeft");
  target.dispatch("keydown", "ShiftRight");
  target.dispatch("keydown", "F1");
  target.dispatch("blur");

  assert.equal(Object.values(input.read()).some(Boolean), false);
});
