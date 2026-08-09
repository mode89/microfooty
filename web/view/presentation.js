export function fitCanvasToWindow(canvas, context) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

export function interpolatePosition(from, to, alpha) {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  };
}

export function interpolateBallPosition(from, to, alpha) {
  return {
    ...interpolatePosition(from, to, alpha),
    z: from.z + (to.z - from.z) * alpha,
  };
}
