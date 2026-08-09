import {
  clampCamera,
  createCamera,
  createView,
  followCamera,
} from "./camera.js";
import { renderBall, renderPitch, renderPlayer } from "./render.js";
import { advanceMatch } from "../world/match.js";
import { kitOf } from "../world/team.js";

// One match and one camera, each kept with the state it held a tick ago so a
// frame can be drawn between the two.
export function createPresentation({
  match,
  camera = createCamera(),
  ballSprite,
  kitSprites,
}) {
  return {
    match,
    previousMatch: match,
    camera,
    previousCamera: camera,
    ballSprite,
    kitSprites,
  };
}

export function advancePresentation(presentation, screen, actions, seconds) {
  const match = advanceMatch(presentation.match, actions, seconds);
  // The vector helpers read x and y only, so the ball's height never moves the
  // camera.
  const followed = followCamera(presentation.camera, match.ball, seconds);
  return {
    ...presentation,
    match,
    previousMatch: presentation.match,
    camera: clampCamera(followed, viewOf(screen, followed.centre)),
    previousCamera: presentation.camera,
  };
}

export function drawPresentation(context, screen, presentation, alpha) {
  const { match, previousMatch, ballSprite } = presentation;
  const view = viewOf(
    screen,
    interpolatePosition(
      presentation.previousCamera.centre,
      presentation.camera.centre,
      alpha,
    ),
  );

  renderPitch(context, view);
  // Under every player, not sorted in with them: a ball lofted over a body
  // would then draw in front of the body it is flying over.
  renderBall(
    context,
    view,
    {
      position: interpolateBallPosition(
        previousMatch.ball.position,
        match.ball.position,
        alpha,
      ),
    },
    ballSprite,
  );
  drawnPlayers(presentation, alpha).forEach((player) =>
    renderPlayer(context, view, player, player.sprites),
  );
}

// Drawn up the pitch, so a body standing nearer the camera covers one behind
// it whatever order the match keeps its players in.
function drawnPlayers({ match, previousMatch, kitSprites }, alpha) {
  return match.players
    .map((player, index) => ({
      position: interpolatePosition(
        previousMatch.players[index].position,
        player.position,
        alpha,
      ),
      heading: player.heading,
      sprites: kitSprites[kitOf(player.team, player.role).name],
    }))
    .sort((behind, infront) => behind.position.y - infront.position.y);
}

function interpolatePosition(from, to, alpha) {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
  };
}

function interpolateBallPosition(from, to, alpha) {
  return {
    ...interpolatePosition(from, to, alpha),
    z: from.z + (to.z - from.z) * alpha,
  };
}

function viewOf(screen, centre) {
  return createView({ centre }, screen.width, screen.height);
}
