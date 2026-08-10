# Microfooty Roadmap

The delivery plan: milestones and the steps that make them. Each step gives what it delivers, how to judge it in a browser, and what the tests must cover. The rules themselves — gameplay, mechanics, technical ground rules — live in `SPEC.md`.

Every step ends in a state you can open in a browser and judge, and no step depends on a later one.

## 1. Milestones
1. **M1 – Ball & one player:** movement, dribble, tap/hold kick feel, continuous camera.
2. **M2 – Full teams + keeper AI:** possession play, tackling, goals.
3. **M3 – Match structure:** kickoff, restarts, halves, score, HUD.
4. **M4 – Presentation polish:** sprite pipeline, radar, banners, camera tuning.

## 2. M1 — Ball & one player
One player and one ball on an empty pitch.

**[DONE] M1.1 — Canvas shell and fixed-timestep loop**
Full-window canvas, 60 Hz loop with interpolated rendering, keyboard input collected into a plain input-state object.
*Review:* on-screen text shows ticks per second, frames per second, and the currently held keys. Ticks stay at 60 when the frame rate varies.
*Tests:* the accumulator produces the correct number of ticks and the correct interpolation factor for a given sequence of frame durations, including a long stall (it must not spiral).

**[DONE] M1.2 — Pitch and camera**
Pitch drawn in world units with its markings; camera follow with smoothing and lookahead, driven for now by a debug target point.
*Review:* arrow keys drive the target point; the view scrolls smoothly, and the pitch fills the same fraction of the screen at any window size.
*Tests:* world-to-screen and screen-to-world are inverses; the camera converges to a stationary target and never overshoots past a clamp; lookahead offsets in the direction of travel; the camera stays inside the pitch bounds margin.

**[DONE] M1.3 — Ball physics**
Gravity, ground friction, air drag and bounce. Drawn for now as a plain circle plus a shadow ellipse. The camera now follows the ball.
*Review:* a debug key launches the ball at a chosen angle and power; it arcs, bounces with decreasing height, rolls, and comes to a complete rest.
*Tests:* a ball at rest stays at rest; bounce reverses `vz` and scales it by the restitution factor; a rolling ball stops in finite time and does not creep; the trajectory is unchanged when the same time span is split into more ticks.

**[DONE] M1.4 — Sprite pipeline**
`players.png` sliced into frames, each pre-scaled ×8 with nearest-neighbour into an offscreen canvas, plus a pre-mirrored left frame. The 3 × 3 ball sprite is generated in code, not loaded.
*Review:* a test screen shows the four facings side by side, and one sprite drifting slowly across the screen at fractional coordinates. Pixels stay chunky; motion shows no wobble or stepping.
*Tests:* the frame slicer returns the expected source rectangles for a sheet of given size and frame count. (Canvas drawing itself is judged by eye.)

**[DONE] M1.5 — Player movement**
One player: 8-directional running, a heading that outlives the run, and the heading-to-frame map, drawn at the sprite's true aspect ratio.
*Review:* the player starts, stops and turns immediately, runs in all eight directions at a consistent speed, and the sprite frame matches the input.
*Tests:* diagonal input gives the same top speed as straight input (the input vector is normalised); starting, stopping and reversing take effect in one tick; the facing-to-sprite map covers all eight directions.

**[DONE] M1.6 — Loose-ball dribbling**
The touch rules: control radius, height ceiling, 3 Hz timer, early touch on a direction change, and the touch that leads the ball.
*Review:* the player can run the length of the pitch keeping the ball a short distance ahead; starts, stops and turns change the touch at once; the ball can be run past and lost; a bouncing ball is not controlled until it drops.
*Tests:* no touch happens outside the control radius, above the height limit or during the player's timer; regular touches come at 3 Hz; each directional input change allows one early attempt, and a successful attempt resets the timer; a run onto a loose ball, a straight dribble and turns keep the ball inside the control radius.

**[DONE] M1.7 — Tap and hold kick**
Charge on the kick button, power and launch angle from the charge, kicking range, and the kicker's touch lock.
*Review:* taps and holds feel clearly different; a full-power shot travels most of the pitch; charging with no ball nearby wastes the charge without error.
*Tests:* charge accumulates and clamps correctly; the tap threshold maps to minimum power; power and launch angle are monotonic in charge duration; releasing out of range leaves the ball untouched.

**[DONE] M1.8 — Feel pass and cleanup**
Tune the M1 constants and collect them into `tuning.js`. Remove debug keys not worth keeping.
*Review:* a full play session — run, dribble, pass, shoot, chase a loose ball — with no jitter, no stuck ball, and no runaway camera.
*Tests:* the whole suite still passes after tuning.

### M1 acceptance
One player and one ball on an empty pitch. The player runs in eight directions, dribbles a loose ball, taps to pass and holds to shoot. The camera follows the ball smoothly with lookahead. Sprites are crisp at any fractional position. `node --test` passes.

## 3. M2 — Full teams & keeper AI
Two elevens in their kits, a shape that moves with play, tackling, headers, goals, and keepers.

Match structure is M3: in M2 a goal is counted in the debug overlay and play carries on. Nothing puts the ball back, so a goal or a ball off the pitch is undone by refreshing the page, which boots the ball on the centre spot and both teams in formation. No debug scaffolding either: every step is reviewed by playing, so the keyboard-driven player is the only way to move the ball by hand — no debug launcher, no ball-placing key — and what cannot be reached that way is left to the tests.

**[DONE] M2.1 — Two teams standing on the pitch**
Team data, mirrored 4-4-2, palette-swapped kits, and the match state that every later step adds to: the player list, the ball, and one control state per player. The keyboard keeps the M1 player; the other twenty-one stand still.
*Review:* twenty-two players stand in two readable 4-4-2 shapes, one shape the mirror of the other, in two kits told apart at a glance. Skin and boots are untouched by the swap. Your player still runs, dribbles and shoots exactly as it did in M1, and a refresh puts everything back.
*Tests:* a formation gives eleven distinct positions inside the pitch, with exactly one keeper, and the mirrored shape is the first reflected about the halfway line; the palette map replaces every kit pixel and leaves every other colour, including the transparency key, alone; the match state holds one control per player.

**[DONE] M2.2 — Running to a place**
Steering towards a point with an arrival band, and the soft body push. The ball is not involved.
*Review:* run your own player into the standing crowd: bodies give way instead of stacking, and everyone walks back to their spot and settles still rather than shivering on it.
*Tests:* steering points at the target, and the arrival band ends the run without oscillation across a long run of ticks; two overlapping players are pushed apart by equal and opposite amounts, and the push stops once they stand a body apart; a player already inside the band does not move.

**[DONE] M2.3 — A shape that moves with the ball**
Home positions shifted by the ball, clamped to the pitch and to each role's band.
*Review:* dribble the ball up and down the pitch and into the corners; both shapes slide with it, the lines keep their spacing, and no player is dragged outside the pitch.
*Tests:* a ball moved up the pitch moves every home position with it, by less than the ball moved itself, and the shape stays inside the pitch; defenders stay behind attackers for a named set of ball positions, including both goal lines and both corners.

**[DONE] M2.4 — Everyone can play the ball**
The touch rules lifted from one player to twenty-two, with one touch a tick to the nearest eligible player. As a placeholder until M2.9, the nearest player of each team chases a loose ball.
*Review:* dribble into a crowd and lose the ball to whoever is closer; an AI chaser picks up a loose ball and carries it away; a lone dribble in space still feels exactly like M1.
*Tests:* at most one touch happens per tick and the nearest eligible player takes it; a player who is eligible but not nearest never touches; equal distances resolve the same way every run; a match state holding one player reproduces the M1 dribble results tick for tick.

**[DONE] M2.5 — Choosing which player you control**
Selection by touch and by soonest meeting, the walked ball prediction, the freeze after your team's touch, and the grip.
*Review:* the marker sits on the player nearest the ball while you defend, does not flicker between two chasers, and stays put while you are dribbling.
*Tests:* the walk follows the ball's own rules and reaches the horizon; a meeting point leads a rolling ball, waits for a flighted one to drop, and falls back to the end of the walk when the ball outruns the player; a teammate's touch takes the selection, and takes it through the freeze; a carrier keeps the selection; our keeper's touch takes the selection while an opponent's touch and the opposing keeper's touch move nothing; an opponent's touch ends the freeze and the ranking picks the team up again; the margin holds the selection for a rival who is sooner by less than it; a nearer player loses the selection to one the ball is rolling towards; an opponent is never returned; the keeper is never ranked in; an auto-selected player chases until the first press, stands still on an empty input once pressed, and is handed back to the chase by the next selection; a kick keeps the selection on the kicker for the whole flight of the ball and the receiver's touch takes it back; a kick with no touch before it still counts as the team's last touch.

**M2.6 — The slide tackle on the kick button**
The lunge, its reach, and the recovery, chosen by the ball's distance at release.
*Review:* you can take the ball off an AI chaser by sliding, and a mistimed slide leaves you on the ground while play runs away from you.
*Tests:* a release with the ball in kicking range kicks and never slides; a release with the ball beyond the lunge reach leaves the world unchanged; the slide lasts a fixed time, ignores direction input throughout, and its speed falls to zero by the end; a sliding player takes a ball that a standing player could not reach; a player in recovery can neither slide nor run.

**M2.7 — Headers and volleys**
The automatic strike at an airborne ball, above the dribble ceiling and below head height.
*Review:* hold a full shot into a crowd: the first player it drops on heads it away instead of waiting for it to land, a ball that passes over head height is left alone, and a ball rolling in at ankle height is still dribbled.
*Tests:* a ball below the dribble ceiling is touched and never volleyed; a ball above head height is not reachable; the struck ball leaves along the player's aim; power rises with the incoming speed; a second strike in the same flight is refused by the touch timer.

**M2.8 — Goals and the goal frame**
Posts and crossbar as pitch data with rebounds, and goal-line crossing tested against the tick's travel segment. The goal is reported once and counted for both teams in the debug overlay, and play carries on.
*Review:* your own shots on target are goals, shots against a visible post come back into play, and shots wide or high are not goals. The counter rises by exactly one per goal.
*Tests:* a crossing between the posts under the bar scores; wide, high, and back out again after crossing are ruled correctly; a ball moved past the line in a single tick still scores; a post rebound reverses the across-pitch velocity and keeps the ball in play; the same goal is not reported on the following tick.

**M2.9 — Off the ball: roles**
Defend, support and attack runs, plus one chaser per team, which replaces the placeholder chase of M2.4. Nobody yet decides what to do with the ball once they have it.
*Review:* dribble upfield yourself and watch the opposition react — a marker stays between you and their goal, one opponent comes for the ball while the rest hold shape, and your own teammates come alongside instead of crowding you.
*Tests:* exactly one chaser per team, and it is the nearest to the ball; a defender's target stays between its mark and its own goal; a supporting midfielder's target stays inside passing distance of the carrier and out of the carrier's own path; a forward's run target is ahead of the ball.

**M2.10 — On the ball: decisions**
The carrier's shoot / pass / dribble state machine and the pass picker, which the human's tap shares.
*Review:* let go of the keys and watch: the other twenty-one play on around your idle player — they advance, exchange passes, shoot, and score without help. With the keys, a tap finds a teammate standing off the exact line of the run.
*Tests:* the decision is shoot inside range with a clear lane, pass when an opponent is inside pressing distance and a teammate has a clear lane, and dribble otherwise; a pass aimed at a running receiver arrives ahead of them; a lane with an opponent across it is rejected for both pass and shot; a tap with no teammate in the cone kicks along the run.

**M2.11 — The keeper saves**
Keeper positioning, the dive, and catch or parry.
*Review:* shoot at the goal yourself from around the penalty spot. A shot near the keeper is saved, a shot into a far corner beats it, a shot that is drifting wide is left alone rather than dived at, and a parry does not drop the ball at your feet. The exact reach cases are left to the tests, which can fire the same shot every time.
*Tests:* the resting position lies on the ball-to-goal-centre line and inside the area; a ball travelling away from goal or heading wide gets no dive; the dive direction follows the predicted crossing point; a ball that cannot be reached in time is not dived at; a catch stops the ball dead; a parry leaves the ball further from the goal than it was.

**M2.12 — The keeper distributes**
The hold after a catch, then a throw or kick chosen by the M2.10 pass picker weighted for safety.
*Review:* after a catch, play restarts itself: the ball goes to a teammate in space and the game continues without a refresh.
*Tests:* the hold lasts its time and no touch by any player is allowed during it; the release aims at a teammate; the ball is in play again afterwards and the keeper cannot immediately catch it back.

**M2.13 — Feel pass and cleanup**
Tune the new constants into `tuning.js` beside the M1 ones: shape shift, arrival band, separation push, switch margin, lunge reach and recovery, header power, pressing and shooting distances, keeper reach and hold.
*Review:* a full session against the AI — win the ball, pass it, work upfield, shoot, defend a counter — with no stuck ball, no player stuck on a wall, no crowd stacked on one spot, and no runaway camera.
*Tests:* the whole suite still passes after tuning.

### M2 acceptance
Two elevens in their own kits play on the pitch. You control one player at a time and the selection follows the ball. Both teams hold a 4-4-2 that slides with play, chase loose balls, dribble, pass, shoot, head an airborne ball, and slide-tackle on the same button that kicks. Keepers position, dive, catch or parry, and distribute. A ball crossing the goal line between the posts is reported as a goal, and the frame rebounds the rest. `node --test` passes.
