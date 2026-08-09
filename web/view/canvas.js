export function fitCanvasToWindow(canvas, context) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}
