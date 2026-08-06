export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });

export const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (a, factor) => ({ x: a.x * factor, y: a.y * factor });

export const length = (a) => Math.hypot(a.x, a.y);

export const clampLength = (a, max) => {
  const size = length(a);
  return size > max ? scale(a, max / size) : a;
};

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
