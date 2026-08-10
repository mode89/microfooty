// Off the ball a player runs to the home its role asks for, except the one
// chaser each team sends at the ball. The keyboard, when it has the grip,
// outranks both for the player it drives.
import { directionToward } from "./steering.js";
import { homePosition } from "../world/formation.js";
import { soonestToMeet } from "../world/interception.js";

export function runDirections({ players, ballPosition, path, keyboardRun }) {
  const chasePoints = chasePointByTeam(players, path);
  return players.map((player, index) => {
    if (keyboardRun && index === keyboardRun.index)
      return keyboardRun.direction;
    const target = chasePoints.get(index) ?? home(player, ballPosition);
    return directionToward(player.position, target);
  });
}

// One chaser a team, the player who can meet the ball soonest, and the point
// they run at: chasing where the ball will be is what stops a chase trailing it.
function chasePointByTeam(players, path) {
  const teams = [...new Set(players.map((player) => player.team))];
  const chasers = teams.map((team) =>
    // The keeper chases like anyone else, unlike the keyboard's own ranking.
    soonestToMeet(players, path, (player) => player.team === team),
  );
  return new Map(
    chasers.map(({ index, meeting }) => [index, meeting.position]),
  );
}

function home(player, ballPosition) {
  return homePosition(
    player.role,
    player.team.attackingDirection,
    ballPosition,
  );
}
