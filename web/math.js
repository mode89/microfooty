export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a, factor) {
  return { x: a.x * factor, y: a.y * factor };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function length(a) {
  return Math.hypot(a.x, a.y);
}

export function clampLength(a, max) {
  const size = length(a);
  return size > max ? scale(a, max / size) : a;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
