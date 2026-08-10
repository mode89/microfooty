// Control follows the ball rather than sticking to one shirt: a touch, a freeze
// while our own team was the last to touch, the soonest meeting, and the
// keyboard's own grip on whoever it was last handed.
import { SELECTION } from "../tuning.js";
import { interception, soonerThan, soonestToMeet } from "./interception.js";

export function selectPlayer(
  { players, selectedIndex, recentToucherIndex, lastTouchTeam },
  path,
) {
  const ourTeam = players[selectedIndex].team;
  // A touch outranks the freeze: the freeze leaves a pass in the kicker's
  // hands, and a teammate on the ball has ended that pass already. The keeper
  // is included, since only the driven player can kick.
  if (
    recentToucherIndex !== null &&
    players[recentToucherIndex].team === ourTeam
  )
    return recentToucherIndex;
  if (lastTouchTeam === ourTeam) return selectedIndex;
  return soonestTeammate(players, path, selectedIndex);
}

// A player handed the selection keeps chasing until the keyboard is actually
// used, so a switch does not strand a player standing in the middle of play.
// The grip is not let go of on an empty input, or standing still would be
// impossible; only the next selection hands the player back to the AI.
export function nextKeyboardGrip(
  { selectedIndex, keyboardEngaged },
  nextSelectedIndex,
  actions,
) {
  const held = anyKeyHeld(actions);
  return nextSelectedIndex === selectedIndex ? keyboardEngaged || held : held;
}

function soonestTeammate(players, path, selectedIndex) {
  const selected = players[selectedIndex];
  // The keeper is left out here alone: `runDirections` still ranks him in as a
  // chaser, so he leaves his goal for his own touch and never for the keyboard.
  const rival = soonestToMeet(
    players,
    path,
    (player) => player.team === selected.team && !player.role.keeper,
  );
  if (!rival) return selectedIndex;

  const held = interception(path, selected);
  const paidFor = {
    ...rival.meeting,
    seconds: rival.meeting.seconds + SELECTION.switchMargin,
  };
  const takesOver = soonerThan(paidFor, held);
  return takesOver ? rival.index : selectedIndex;
}

// `debug` is not play, so the F1 overlay never takes the grip.
function anyKeyHeld({ up, down, left, right, kick }) {
  return up || down || left || right || kick;
}
