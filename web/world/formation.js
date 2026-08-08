// A formation is eleven named roles placed as fractions of the pitch, written
// for a side that attacks down the pitch, so its own goal is the top one. The
// other side plays the same roles reflected about the halfway line. Left and
// right in a role name are the pitch's, seen from above, not the team's: a
// side attacking up the pitch fields its left back on the right of the screen.
import { PITCH } from "./pitch.js";

function formationRole(name, x, y) {
  return Object.freeze({
    name,
    keeper: name === "keeper",
    homeFraction: { x, y },
  });
}

export const FORMATION_442 = Object.freeze([
  formationRole("keeper", 0, -0.47),
  formationRole("leftBack", -0.32, -0.33),
  formationRole("leftCentreBack", -0.11, -0.38),
  formationRole("rightCentreBack", 0.11, -0.38),
  formationRole("rightBack", 0.32, -0.33),
  formationRole("leftMidfield", -0.33, -0.13),
  formationRole("leftCentreMidfield", -0.11, -0.18),
  formationRole("rightCentreMidfield", 0.11, -0.18),
  formationRole("rightMidfield", 0.33, -0.13),
  formationRole("leftStriker", -0.1, 0.04),
  formationRole("rightStriker", 0.1, 0.04),
]);

export function homePosition(role, attackingDirection) {
  return {
    x: role.homeFraction.x * PITCH.width,
    y: attackingDirection * role.homeFraction.y * PITCH.length,
  };
}
