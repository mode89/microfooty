// Off the ball a player runs to the home its role asks for, except the one
// chaser each team sends at the ball. The keyboard, when it has the grip,
// outranks both for the player it drives.
import { chasePointByTeam } from "./chase.js";
import { directionToward } from "../player.js";
import { homePosition } from "../team.js";
import { CHASE_STEERING } from "../tuning.js";

export function runDirections({
  players,
  ballPosition,
  ballPath,
  keyboardRun,
}) {
  const chasePoints = chasePointByTeam(players, ballPath);
  return players.map((player, index) => {
    if (keyboardRun && index === keyboardRun.index)
      return keyboardRun.direction;
    const chasePoint = chasePoints.get(index);
    if (chasePoint)
      return directionToward(player.position, chasePoint, CHASE_STEERING);
    const home = homePosition(
      player.role,
      player.team.attackingDirection,
      ballPosition,
    );
    return directionToward(player.position, home);
  });
}
