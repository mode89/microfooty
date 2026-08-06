const KEY_BINDINGS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'kick',
  ShiftLeft: 'tackle',
  ShiftRight: 'tackle',
  F1: 'debug',
};

export const EMPTY_INPUT = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
  kick: false,
  tackle: false,
  debug: false,
});

// Tracks which actions are held. `read` returns an immutable snapshot, so the
// simulation never sees the state change under it mid-tick.
export function createInput(target = window) {
  const held = new Set();

  const set = (event, down) => {
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    event.preventDefault();
    if (down) held.add(action);
    else held.delete(action);
  };

  target.addEventListener('keydown', (event) => set(event, true));
  target.addEventListener('keyup', (event) => set(event, false));
  target.addEventListener('blur', () => held.clear());

  return {
    read: () =>
      Object.freeze(
        Object.fromEntries(
          Object.keys(EMPTY_INPUT).map((action) => [action, held.has(action)]),
        ),
      ),
  };
}
