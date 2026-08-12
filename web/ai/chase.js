// One chaser a team, the player who can meet the ball soonest, and the point
// they run at: chasing where the ball will be is what stops a chase trailing it.
import { soonestToMeet } from "../player.js";

export function chasePointByTeam(players, ballPath) {
  const teams = [...new Set(players.map((player) => player.team))];
  const chasers = teams.map((team) =>
    // The keeper chases like anyone else, unlike the keyboard's own ranking.
    soonestToMeet(players, ballPath, (player) => player.team === team),
  );
  return new Map(
    chasers.map(({ index, meeting }) => [index, meeting.position]),
  );
}
