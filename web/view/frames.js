// Four frames must cover every heading a player can run on: each one scores
// how well it lines up with the heading, and the best score is drawn.
const FRAME_HEADINGS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

// A 45 degree diagonal lines up with two frames equally, so the favoured frame
// of the quadrant carries this much extra score and always wins it.
const DIAGONAL_BIAS = 0.15;

export function spriteFrame(heading) {
  const favoured = favouredFrame(heading);
  function score(frame) {
    return (
      heading.x * FRAME_HEADINGS[frame].x +
      heading.y * FRAME_HEADINGS[frame].y +
      (frame === favoured ? DIAGONAL_BIAS : 0)
    );
  }
  return Object.keys(FRAME_HEADINGS).reduce((best, frame) =>
    score(frame) > score(best) ? frame : best,
  );
}

// A diagonal that heads up the pitch is drawn with the up frame, which shows
// the player's back; every other diagonal is drawn with the side frame it
// leans towards.
function favouredFrame(heading) {
  if (heading.y < 0) return "up";
  return heading.x < 0 ? "left" : "right";
}
