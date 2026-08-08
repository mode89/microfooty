// A formation is eleven named roles placed as fractions of the pitch, written
// for a side that attacks down the pitch, so its own goal is the top one. The
// other side plays the same roles reflected about the halfway line, which is
// where both shapes stand while the ball rests on the centre spot. Left and
// right in a role name are the pitch's, seen from above, not the team's: a
// side attacking up the pitch fields its left back on the right of the screen.
import { clamp } from "../math/vec.js";
import { SHAPE } from "../tuning.js";
import { PITCH, keepOnPitch } from "./pitch.js";

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

// A role stands where the ball asks it to: its formation place, slid a share of
// the ball's distance from the centre spot and capped by the role's reach. Both
// sides slide the same way, so the ball's own y is followed rather than the
// attacking direction. The centre spot is the origin, so the ball's coordinates
// are already its distance from the middle of the pitch.
export function homePosition(
  role,
  attackingDirection,
  ballPosition,
  shape = SHAPE,
) {
  const place = formationPlace(role, attackingDirection);
  return keepOnPitch({
    x: place.x + slide(ballPosition.x, shape.acrossPitch, role),
    y: place.y + slide(ballPosition.y, shape.alongPitch, role),
  });
}

function formationPlace(role, attackingDirection) {
  return {
    x: role.homeFraction.x * PITCH.width,
    y: attackingDirection * role.homeFraction.y * PITCH.length,
  };
}

function slide(ballFromCentre, axis, role) {
  const reach = role.keeper ? axis.keeperReach : axis.outfieldReach;
  return clamp(axis.follow * ballFromCentre, -reach, reach);
}
