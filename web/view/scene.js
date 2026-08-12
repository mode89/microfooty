import {
  clampCamera,
  createCamera,
  createView,
  followCamera,
} from "./camera.js";
import { renderBall } from "./ball.js";
import { renderPitch } from "./pitch.js";
import { renderPlayer } from "./player.js";
import { advanceMatch } from "../match.js";
import { kitOf } from "../team.js";

// One match and one camera, each kept with the state it held a tick ago so a
// frame can be drawn between the two.
export function createScene({
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

export function advanceScene(scene, screen, actions, seconds) {
  const match = advanceMatch(scene.match, actions, seconds);
  // The vector helpers read x and y only, so the ball's height never moves the
  // camera.
  const followed = followCamera(scene.camera, match.ball, seconds);
  return {
    ...scene,
    match,
    previousMatch: scene.match,
    camera: clampCamera(followed, viewOf(screen, followed.centre)),
    previousCamera: scene.camera,
  };
}

export function drawScene(context, screen, scene, alpha) {
  const { match, previousMatch, ballSprite } = scene;
  const view = viewOf(
    screen,
    interpolatePosition(
      scene.previousCamera.centre,
      scene.camera.centre,
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
  drawnPlayers(scene, alpha).forEach((player) =>
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
      selected: index === match.selectedIndex,
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
