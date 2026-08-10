// Control follows the ball rather than sticking to one shirt: a touch, a hold
// after a kick, the soonest meeting, and the keyboard's own grip on whoever it
// was last handed.
import { SELECTION } from "../tuning.js";
import { interception, soonerThan } from "./interception.js";

export function selectPlayer(
  { players, selectedIndex, recentToucherIndex, selectionHold = 0 },
  path,
) {
  const toucherIndex = teamToucherIndex(
    players,
    selectedIndex,
    recentToucherIndex,
  );
  if (toucherIndex !== null) return toucherIndex;
  if (selectionHold > 0) return selectedIndex;
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

// A touch outranks the hold: the hold exists to stop the ball being chased
// before it has travelled, and a teammate on the ball has settled that already.
function teamToucherIndex(players, selectedIndex, recentToucherIndex) {
  if (recentToucherIndex === null) return null;
  const toucher = players[recentToucherIndex];
  const ours = toucher.team === players[selectedIndex].team;
  return ours && !toucher.role.keeper ? recentToucherIndex : null;
}

function soonestTeammate(players, path, selectedIndex) {
  const selected = players[selectedIndex];
  const rival = soonestOfTeam(players, path, selected);
  if (!rival) return selectedIndex;

  const held = interception(path, selected);
  const paidFor = {
    ...rival.meeting,
    seconds: rival.meeting.seconds + SELECTION.switchMargin,
  };
  const takesOver = soonerThan(paidFor, held);
  return takesOver ? rival.index : selectedIndex;
}

function soonestOfTeam(players, path, selected) {
  return players.reduce((soonest, player, index) => {
    if (player.team !== selected.team || player.role.keeper) return soonest;
    const meeting = interception(path, player);
    return !soonest || soonerThan(meeting, soonest.meeting)
      ? { meeting, index }
      : soonest;
  }, null);
}

// `debug` is not play, so the F1 overlay never takes the grip.
function anyKeyHeld({ up, down, left, right, kick }) {
  return up || down || left || right || kick;
}
