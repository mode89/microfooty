// A team is data: how its shirts are painted, which way it attacks, and the
// shape it stands in. Both sides run the same rules over this data.
import { FORMATION_442 } from "./formation.js";
import { DOWN_THE_PITCH, UP_THE_PITCH } from "./pitch.js";

// The keeper wears the team colour striped with black, so the one player who
// may handle the ball is told from the outfielders at a glance.
const KEEPER_STRIPE = Object.freeze({ red: 0, green: 0, blue: 0 });

export const TEAMS = Object.freeze([
  createTeam({
    name: "Marlow Rovers",
    kitName: "scarlet",
    shirt: { red: 206, green: 38, blue: 38 },
    attackingDirection: DOWN_THE_PITCH,
  }),
  createTeam({
    name: "Harbour Athletic",
    kitName: "royal",
    shirt: { red: 38, green: 78, blue: 206 },
    attackingDirection: UP_THE_PITCH,
  }),
]);

export function kitOf(team, role) {
  return role.keeper ? team.keeperKit : team.kit;
}

export function allKits(teams = TEAMS) {
  return teams.flatMap(({ kit, keeperKit }) => [kit, keeperKit]);
}

function createTeam({ name, kitName, shirt, attackingDirection }) {
  return Object.freeze({
    name,
    kit: plainKit(kitName, shirt),
    keeperKit: stripedKit(`${kitName}Keeper`, shirt, KEEPER_STRIPE),
    attackingDirection,
    roles: FORMATION_442,
  });
}

// A shirt of one colour is striped with itself, which leaves the stripes of
// the source art invisible.
function plainKit(name, shirt) {
  return stripedKit(name, shirt, shirt);
}

function stripedKit(name, shirt, stripe) {
  return Object.freeze({
    name,
    shirt: Object.freeze(shirt),
    stripe: Object.freeze(stripe),
  });
}
