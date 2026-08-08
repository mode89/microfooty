const KEY_BINDINGS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  Space: "kick",
  ShiftLeft: "tackle",
  ShiftRight: "tackle",
  F1: "debug",
};

const EMPTY_INPUT = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  kick: false,
  tackle: false,
  debug: false,
});

const ACTIONS = Object.keys(EMPTY_INPUT);

export function createInput(target = window) {
  const heldCodes = new Set();

  function set(event, down) {
    if (!KEY_BINDINGS[event.code]) return;
    event.preventDefault();
    if (down) heldCodes.add(event.code);
    else heldCodes.delete(event.code);
  }

  target.addEventListener("keydown", (event) => set(event, true));
  target.addEventListener("keyup", (event) => set(event, false));
  target.addEventListener("blur", () => heldCodes.clear());

  return {
    read: () => {
      const heldActions = new Set(
        [...heldCodes].map((code) => KEY_BINDINGS[code]),
      );
      return Object.freeze(
        Object.fromEntries(
          ACTIONS.map((action) => [action, heldActions.has(action)]),
        ),
      );
    },
  };
}
