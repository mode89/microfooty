# Microfooty

## 1. Overview
**Microfooty** is a browser-based, single-player, top-down arcade football prototype inspired by Sensible Soccer '93. One playable match vs AI. HTML5 Canvas 2D, plain JavaScript (ES modules, no build step), no engine. Pixel art is used as a texture style only; presentation is continuous (no logical pixel grid).

## 2. Platform & Technical
- **Target:** Modern desktop browsers, keyboard + gamepad input.
- **Rendering:** Canvas 2D, continuous presentation:
  - World simulated and rendered in floating-point coordinates; no position snapping or logical resolution.
  - Sprites pre-scaled ×4–8 via nearest-neighbor into offscreen canvases at load, then drawn with smoothing enabled at continuous positions, rotations, and scales (crisp chunky pixels, smooth motion).
  - Camera: smooth scroll tracking the ball with lookahead in direction of play; fixed zoom defined in world units per screen width, resolution-independent. The pitch is vertical, so the width is the axis worth fixing: the view shows 90% of the pitch width at any window shape.
- **Loop:** Fixed timestep simulation (60 Hz) with interpolated rendering.
- **No backend, no saves, no audio.**

## 3. Core Match Gameplay
### 3.1 Camera & View
- Top-down view with slight vertical squash on sprites (Sensi look).
- Radar/minimap showing all players.

### 3.2 Player Control
- Control one player at a time; auto-switch to nearest teammate to ball
  when defending (manual switch override on button press).
- 8-directional movement.
- **One-button kick model (no aftertouch):**
  - Tap = pass toward facing direction / nearest teammate in cone.
  - Hold = stronger kick / shot.
- Same button, out of kicking range: slide tackle (no foul consequences). The
  ball decides what a press means, so no second button and no double-tap.
- Headers/volleys triggered automatically when ball is airborne near player.

### 3.3 Ball Physics
- 2D position + height (z) pseudo-3D. Bounce and friction on a single standard pitch surface.
- Ball is loose (not glued to dribbler): touch-ahead dribbling, interceptable.
- Velocity model structured so spin/aftertouch can be added later without rework.

### 3.4 Goalkeepers
- AI-controlled always, with dive/catch/parry, basic positioning, and distribution after saves.

### 3.5 Minimal Match Structure
- Kickoff, two halves of fixed length (e.g. 3 min), half-time switch.
- Goals and score tracking.
- Simple restarts only: throw-in, goal kick, corner (ball placed, nearest player takes it). No fouls, cards, offside, subs, injuries, penalties, or extra time.

## 4. AI
- **Opponent + teammate AI:** formation-based positioning (home positions ball-relative offsets), role behaviors (defend, support, attack runs), pass/shoot/dribble decisions via simple per-player state machine.
- Single fixed difficulty.

## 5. Teams & Data
- Two hardcoded fictional teams with kit colors and one formation each (e.g. 4-4-2). Uniform player attributes.

## 6. Presentation
- **Player sprites: 8×8 px source art, three drawn base sprites only:**
  - Facing forward (down), facing backward (up), facing right.
  - Facing left = horizontal mirror of the right-facing sprite.
  - Two lying sprites (slide tackle, keeper dive) = rotations/mirrors of the right-facing sprite; rendered continuously, so they may rotate to arbitrary angles (e.g. slide aligned to movement direction).
  - 8-directional movement maps to the 4 facings (upward diagonals use the up sprite, downward diagonals the nearest left/right sprite).
  - Single frame per facing (no run cycle).
  - Kits via palette swap of the same three sprites; derived variants pre-baked into offscreen canvases per kit at load.
- **Ball sprite: 3×3 px** — white with 3 static black dots (panel pattern). May scale slightly with height (z); a 1–2 px shadow dot on the pitch offsets from the ball as it rises for height readability.
- Pitch tilemap with markings and goals (net animation), following the same pixel-texture / continuous-presentation style.
- HUD: score + clock. Text banners (GOAL!, half time, full time), same visual style.
- No menus: game boots straight into the match; "play again" prompt at full time.

## 7. Out of Scope (v1)
- Aftertouch / ball spin (incl. rolling-dot ball animation).
- Full match rules: fouls, cards, offside, penalties, subs, injuries, extra time.
- Pitch condition types (wet, muddy, frozen, etc.).
- Difficulty levels.
- Game modes: friendly select, league, cup, seasons.
- Team database, player attributes, team editor.
- Audio.
- Persistence / saves.
- Goal replays.
- Menu flow / team select screens.
- Online or local multiplayer; real licenses.

## 8. Milestones
1. **M1 – Ball & one player:** movement, dribble, tap/hold kick feel, continuous camera.
2. **M2 – Full teams + keeper AI:** possession play, tackling, goals.
3. **M3 – Match structure:** kickoff, restarts, halves, score, HUD.
4. **M4 – Presentation polish:** sprite pipeline, radar, banners, camera tuning.

## 9. M1 Breakdown

M1 delivers one player and one ball on an empty pitch. Every step below ends in a
state you can open in a browser and judge. No step depends on a later one.

### 9.1 Ground rules for M1
- **No build step.** `index.html` plus ES modules loaded directly. Served by any
  static file server.
- **No dependencies** in the shipped code.
- **Simulation is pure, presentation is not.** Simulation modules take state and
  input and return new state. They never touch the canvas, the DOM, the clock,
  or `Math.random`. This is what makes them testable.
- **Tests** use the Node built-in test runner (`node --test`), which loads the
  same ES modules unchanged. Everything pure is tested: vector maths, ball
  integration, camera follow, player movement, facing selection, kick power.
  Rendering and raw input handling are checked by eye.
- **Debug tools** are review-only presentation. The match overlay shows timing
  and world state; standalone pages under `web/demo/` isolate mechanics such as
  dribbling. They are not match UI.
- **Units.** World units are metres. Pitch is 105 × 68 m and vertical: its
  length runs along the `+y` axis, which points down the screen, so the goals
  are at the top and the bottom. Ball height is `z`, positive upwards.

### 9.2 Proposed file layout
```
web/
  index.html
  players.png      3 base sprites, 24 x 8
  main.js          boot, wiring
  loop.js          fixed timestep + interpolation
  input.js         keyboard -> input state
  math/vec.js      2D/3D vector helpers
  world/pitch.js   pitch dimensions and markings data
  world/ball.js    ball state + physics (pure)
  world/player.js  player state + movement (pure)
  world/possession.js  loose-ball play; possession emerges from touches and is
                       not stored ownership (pure)
  view/camera.js   camera follow (pure)
  view/sprites.js  offscreen pre-scaling and palette swaps
  view/render.js   draws world to canvas
  view/debug.js    debug overlay
test/
  *.test.js
```

### 9.3 Steps

**[DONE] Step 1 — Canvas shell and fixed-timestep loop**
Full-window canvas that survives resizing and high-DPI displays. Loop runs
simulation at a fixed 60 Hz and renders with an interpolation factor between the
previous and current simulation state. Keyboard input collected into a plain
input-state object.
*Review:* on-screen text shows ticks per second, frames per second, and the
currently held keys. Ticks stay at 60 when the frame rate varies.
*Tests:* the accumulator produces the correct number of ticks and the correct
interpolation factor for a given sequence of frame durations, including a long
stall (it must not spiral).

**[DONE] Step 2 — Pitch and camera**
Pitch drawn in world units with markings: touchlines, goal lines, halfway line,
centre circle, penalty areas, goal areas, penalty spots and arcs, corner arcs.
Camera converts world to screen at a fixed zoom given as
world-units-per-screen-width, set to 90% of the pitch width, and follows a
target point with smoothing plus lookahead along the target's velocity.
*Review:* arrow keys drive a debug target point; the view scrolls smoothly, and
the pitch fills the same fraction of the screen at any window size.
*Tests:* world-to-screen and screen-to-world are inverses; the camera converges
to a stationary target and never overshoots past a clamp; lookahead offsets in
the direction of travel; the camera stays inside the pitch bounds margin.

**[DONE] Step 3 — Ball physics**
Ball state is position `(x, y, z)` and velocity `(vx, vy, vz)`, kept as a
3-component vector so spin can be added later without reshaping the state.
Gravity, ground friction, air drag, and bounce with restitution. Drawn for now
as a plain circle plus a shadow ellipse on the ground, offset and shrunk by `z`.
Camera now follows the ball.
*Review:* a debug key launches the ball at a chosen angle and power; it arcs,
bounces with decreasing height, rolls, and comes to a complete rest.
*Tests:* a ball at rest stays at rest; bounce reverses `vz` and scales it by the
restitution factor; a rolling ball stops in finite time and does not creep; the
trajectory is unchanged when the same time span is split into more ticks.

**[DONE] Step 4 — Sprite pipeline**
Load `players.png` (24 × 8, three 8 × 8 frames: down, right, up). At load,
draw each frame into its own offscreen canvas scaled ×8 with nearest-neighbour,
plus a pre-mirrored left frame. Per-frame drawing then uses smoothing at
fractional positions. The 3 × 3 ball sprite is generated in code, not loaded.
*Review:* a test screen shows the four facings side by side, and one sprite
drifting slowly across the screen at fractional coordinates. Pixels stay chunky;
motion shows no wobble or stepping.
*Tests:* the frame slicer returns the expected source rectangles for a sheet of
given size and frame count. (Canvas drawing itself is judged by eye.)

**[DONE] Step 5 — Player movement**
One player. 8-directional input sets the run direction and speed at once, and
releasing it stops at once. The last nonzero direction remains as the heading
while stopped. The heading maps to the four sprite frames; upward diagonals pick
the up frame and downward diagonals the nearest side frame. Sprites are drawn
with the slight vertical squash of the Sensi look.
*Review:* the player starts, stops and turns immediately, runs in all eight
directions at a consistent speed, and the sprite frame matches the input.
*Tests:* diagonal input gives the same top speed as straight input (the input
vector is normalised); starting, stopping and reversing take effect in one
tick; the facing-to-sprite map covers all eight directions.

**[DONE] Step 6 — Loose-ball dribbling**
The ball is never attached to the player. A low ball inside the control radius
may be touched every 1/3 second. Every change in directional input allows an
early touch attempt; a successful touch resets the timer. Nonzero input supplies
the touch direction, while zero input uses the player's last heading. A touch
sets the ball velocity to carry it in one touch period from its current position
to the player's position plus the direction multiplied by the player's travel
over that period and the ideal lead. A recent touch costs a little pace, and the
ball remains free to run past or intercept.
*Review:* the player can run the length of the pitch keeping the ball a short
distance ahead; starts, stops and turns change the touch at once; the ball can
be run past and lost; a bouncing ball is not controlled until it drops.
*Tests:* no touch happens outside the control radius, above the height limit or
during the player's timer; regular touches come at 3 Hz; each directional input
change allows one early attempt, and a successful attempt resets the timer; a
run onto a loose ball, a straight dribble and turns keep the ball inside the
control radius.

**[DONE] Step 7 — Tap and hold kick**
One kick button. Charge builds while held, capped at a maximum. Release kicks
with power interpolated from the charge: a tap gives a low flat pass, a full
hold gives a fast rising shot. Launch angle rises with power. The kick fires
only if the ball is within kicking range at release.
*Review:* taps and holds feel clearly different; a full-power shot travels most
of the pitch; charging with no ball nearby wastes the charge without error.
*Tests:* charge accumulates and clamps correctly; the tap threshold maps to
minimum power; power and launch angle are monotonic in charge duration; releasing
out of range leaves the ball untouched.

**[DONE] Step 8 — Feel pass and cleanup**
Tune constants: player speed, control radius, touch period, ideal lead,
friction, restitution, kick power range, camera smoothing and lookahead. Collect
them into one named constants module so tuning is a single place. Remove debug
keys not worth keeping.
*Review:* a full play session — run, dribble, pass, shoot, chase a loose ball —
with no jitter, no stuck ball, and no runaway camera.
*Tests:* the whole suite still passes after tuning.

### 9.4 M1 acceptance
One player and one ball on an empty pitch. The player runs in eight directions,
dribbles a loose ball, taps to pass and holds to shoot. The camera follows the
ball smoothly with lookahead. Sprites are crisp at any fractional position.
`node --test` passes.

## 10. M2 Breakdown

M2 fills the pitch: two elevens in their kits, a shape that moves with play,
tackling, headers, goals, and keepers. As in M1, every step below ends in a
state you can open in a browser and judge, and no step depends on a later one.

### 10.1 Ground rules for M2
- **Everything in 9.1 still holds.** No build step, no dependencies, pure
  simulation modules, `node --test`, metres, the debug overlay as the review
  tool.
- **One set of rules, two teams.** Both sides run the same code. A team is
  data: kit colours, attacking direction, and the eleven role positions of its
  formation. The human player replaces one player's input with the keyboard and
  changes nothing else.
- **Attacking direction is data, not a second code path.** Every rule that
  points up or down the pitch takes the team's direction, so no rule is written
  twice for the two ends.
- **The AI is deterministic.** Decisions are pure functions of the match state,
  with no clock and no `Math.random`, which is what makes them testable.
- **The ball stays loose.** No player owns the ball and no possession flag
  exists. Possession is what the touch rules produce. The keeper's hands are the
  single exception, and they hold the ball for a fixed time only.
- **Uniform attributes.** Every outfielder has the same pace, reach and touch.
  Roles differ in where they stand and what they decide, nothing else.
- **No match structure.** Kickoff, restarts, halves and score are M3. In M2 a
  goal is counted in the debug overlay and play carries on. Nothing puts the
  ball back: a goal or a ball off the pitch is undone by refreshing the page,
  which boots the ball on the centre spot and both teams in formation.
- **No debug scaffolding.** Every step is reviewed by playing: the keyboard
  drives one player, who runs, dribbles, passes and shoots with the M1 rules,
  and that player is the only way to move the ball by hand. No debug launcher,
  no ball-placing key. What cannot be reached this way is left to the tests.
- **Test state is built, not hand-written.** With 22 players, tests use small
  factory helpers that place only the players a test cares about.

### 10.2 Proposed file layout
Added to the M1 layout:
```
web/
  world/team.js        the two teams: kit, attacking direction, formation roles
  world/formation.js   home position of a role for a given ball position
  world/match.js       the whole match state and one advance step, built at
                       step 1 so later steps add fields instead of reshaping it
  world/tackle.js      the slide: lunge, reach, recovery (pure)
  world/volley.js      automatic strike at an airborne ball (pure)
  world/goal.js        goal frame, post rebounds, goal-line crossing (pure)
  ai/steering.js       run towards a point and settle on it
  ai/roles.js          defend, support, attack-run behaviour off the ball
  ai/decisions.js      the carrier's state machine: shoot, pass or dribble
  ai/keeper.js         positioning, dive, catch or parry, distribution
  view/kits.js         palette-swapped sprite sets, one per kit
```

### 10.3 Steps

**[DONE] Step 1 — Two teams standing on the pitch**
Team data for two fictional sides: name, kit colours, attacking direction, and
a 4-4-2 of eleven named roles given as fractions of the pitch, so one formation
serves both ends by mirroring. Kits are palette swaps of the same three frames,
baked into offscreen canvases at load: the source art stripes the shirt in a
blue main colour and a white secondary one beside skin, hair and boots, so a
kit is two colour mappings, and a kit whose two colours match wears a plain
shirt. The keeper wears the team colour striped with black.
This step also creates the match state that every later step adds to: the
player list, the ball, and one control state per player. The keyboard keeps the
M1 player, now one of the twenty-two, with the M1 movement, dribble and kick
rules unchanged. The other twenty-one stand still.
*Review:* twenty-two players stand in two readable 4-4-2 shapes, one shape the
mirror of the other, in two kits told apart at a glance. Skin and boots are
untouched by the swap. Your player still runs, dribbles and shoots exactly as
it did in M1, and a refresh puts everything back.
*Tests:* a formation gives eleven distinct positions inside the pitch, with
exactly one keeper, and the mirrored shape is the first reflected about the
halfway line; the palette map replaces every kit pixel and leaves every other
colour, including the transparency key, alone; the match state holds one
control per player.

**[DONE] Step 2 — Running to a place**
Players run to a fixed formation spot with the M1 movement code, steered
towards a point instead of by keys, and settle inside an arrival band rather
than shivering on it. Bodies push each other apart softly, so nobody stacks.
The ball is not involved.
*Review:* run your own player into the standing crowd: bodies give way instead
of stacking, and everyone walks back to their spot and settles still rather
than shivering on it.
*Tests:* steering points at the target, and the arrival band ends the run
without oscillation across a long run of ticks; two overlapping players are
pushed apart by equal and opposite amounts, and the push stops once they stand
a body apart; a player already inside the band does not move.

**[DONE] Step 3 — A shape that moves with the ball**
Each role's home position is now its formation place shifted by the ball,
clamped to the pitch and to the role's own band, so a team slides up and down
as one and keeps its lines.
*Review:* dribble the ball up and down the pitch and into the corners; both
shapes slide with it, the lines keep their spacing, and no player is dragged
outside the pitch.
*Tests:* a ball moved up the pitch moves every home position with it, by less
than the ball moved itself, and the shape stays inside the pitch; defenders
stay behind attackers for a named set of ball positions, including both goal
lines and both corners.

**Step 4 — Everyone can play the ball**
The M1 touch rules are lifted from one player to twenty-two. Every player has a
3 Hz timer, but at most one touch happens in a tick: the nearest eligible player
wins, with ties broken in fixed player order. Only the most recent toucher pays
the carrying pace penalty, and a successful kick clears that recent touch. The
keyboard still drives the one player it was given at step 1; step 5 makes that
choice follow the ball. To make the contest worth watching, the nearest player
of each team chases a loose ball; step 9 replaces that with real roles.
*Review:* dribble into a crowd and lose the ball to whoever is closer; an AI
chaser picks up a loose ball and carries it away; a lone dribble in space still
feels exactly like M1.
*Tests:* at most one touch happens per tick and the nearest eligible player
takes it; a player who is eligible but not nearest never touches; equal
distances resolve the same way every run; a match state holding one player
reproduces the M1 dribble results tick for tick.

**Step 5 — Choosing which player you control**
Selection follows the ball: while the team is not carrying it, the nearest
teammate to the ball takes over, with a margin so two near-equal candidates do
not trade the selection back and forth. A carrier is never switched away from
automatically. A switch button picks the next-nearest player on demand. The
keeper is never selected. The selected player is marked underfoot.
*Review:* the marker sits on the player nearest the ball while you defend, does
not flicker between two chasers, stays put while you are dribbling, and the
switch button hands control to another player at once.
*Tests:* the auto-switch fires only when the team is not carrying; a carrier
keeps the selection even when a teammate is nearer the ball; the switch margin
holds the selection for a rival who is nearer by less than the margin; the
manual switch picks the next-nearest and skips the current player; the keeper
is never returned.

**Step 6 — The slide tackle on the kick button**
No second button: the ball decides what a release means. In kicking range it
kicks, as in M1. Out of kicking range but inside a lunge reach it slides:
the player lunges along the run for a fixed time, cannot steer while sliding,
reaches further for the ball than a standing player, and then lies in a
recovery period before running again. Further out than the lunge reach the
press is wasted, as a charge with no ball nearby already is. The charge is
discarded by a slide, so a slide has one length. Sliding through an opponent
does nothing to them: there are no fouls. The lying frame is the side sprite
rotated to the slide direction.
*Review:* you can take the ball off an AI chaser by sliding, and a mistimed
slide leaves you on the ground while play runs away from you.
*Tests:* a release with the ball in kicking range kicks and never slides; a
release with the ball beyond the lunge reach leaves the world unchanged; the
slide lasts a fixed time, ignores direction input throughout, and its speed
falls to zero by the end; a sliding player takes a ball that a standing player
could not reach; a player in recovery can neither slide nor run.

**Step 7 — Headers and volleys**
An airborne ball that arrives inside a player's reach is struck without a
button press: away along the player's aim, with power drawn from the ball's
incoming speed and the player's run, and an elevation that makes a header a
clearance rather than a pass. A ball above head height passes over untouched.
Height alone separates this from a dribble touch: the dribble keeps its ceiling
and the volley starts above it, so no ball is eligible for both. The strike
starts the same touch timer as a dribble touch, so one flight cannot be struck twice.
*Review:* hold a full shot into a crowd: the first player it drops on heads it
away instead of waiting for it to land, a ball that passes over head height is
left alone, and a ball rolling in at ankle height is still dribbled.
*Tests:* a ball below the dribble ceiling is touched and never volleyed; a ball
above head height is not reachable; the struck ball leaves along the player's
aim; power rises with the incoming speed; a second strike in the same flight is
refused by the touch timer.

**Step 8 — Goals and the goal frame**
Posts and crossbar as pitch data, drawn at both ends. The ball rebounds off
them. A goal is scored when the ball crosses the goal line between the posts
and under the bar, tested against the segment the ball travelled in the tick,
so a shot fast enough to jump the whole line in one tick still counts. A goal
is reported once and counted for both teams in the debug overlay. Play carries
on, and a refresh is what puts the ball back after a goal or after it has run
off the pitch.
*Review:* your own shots on target are goals, shots against a visible post come
back into play, and shots wide or high are not goals. The counter rises by
exactly one per goal.
*Tests:* a crossing between the posts under the bar scores; wide, high, and
back out again after crossing are ruled correctly; a ball moved past the line
in a single tick still scores; a post rebound reverses the across-pitch
velocity and keeps the ball in play; the same goal is not reported on the
following tick.

**Step 9 — Off the ball: roles**
Each role behaves without the ball: defenders hold the line and stay goalside
of the nearest opponent, midfielders support the carrier at passing distance,
forwards make runs into space ahead of the ball, and one player per team
chases, which replaces the plain chase rule of step 4. Nobody yet decides what
to do with the ball once they have it.
*Review:* dribble upfield yourself and watch the opposition react — a marker
stays between you and their goal, one opponent comes for the ball while the
rest hold shape, and your own teammates come alongside instead of crowding you.
*Tests:* exactly one chaser per team, and it is the nearest to the ball; a
defender's target stays between its mark and its own goal; a supporting
midfielder's target stays inside passing distance of the carrier and out of
the carrier's own path; a forward's run target is ahead of the ball.

**Step 10 — On the ball: decisions**
A small state machine decides for a carrier: shoot when inside shooting range
with a clear lane to the goal, pass when pressed and a teammate is free, and
dribble towards the opponent's goal otherwise. Passes lead a running receiver;
shots aim inside a post. The human's tap uses the same pass picker: it aims at
the best teammate inside a cone around the run, and at the run itself when the
cone is empty.
*Review:* let go of the keys and watch: the other twenty-one play on around
your idle player — they advance, exchange passes, shoot, and score without
help. With the keys, a tap finds a teammate standing off the exact line of the
run.
*Tests:* the decision is shoot inside range with a clear lane, pass when an
opponent is inside pressing distance and a teammate has a clear lane, and
dribble otherwise; a pass aimed at a running receiver arrives ahead of them; a
lane with an opponent across it is rejected for both pass and shot; a tap with
no teammate in the cone kicks along the run.

**Step 11 — The keeper saves**
The keeper stands on the line between the ball and the centre of its goal,
clamped to its own area, and comes off the line as the ball nears. It dives at
a shot that is going in, in the direction of the point where the ball will
cross the line, and only when it can arrive in time. Inside the hands radius it
catches, holding the ball dead; further out it parries, pushing the ball away
from the goal rather than back to the shooter. The keeper is never selectable.
*Review:* shoot at the goal yourself from around the penalty spot. A shot near
the keeper is saved, a shot into a far corner beats it, a shot that is drifting
wide is left alone rather than dived at, and a parry does not drop the ball at
your feet. The exact reach cases are left to the tests, which can fire the same
shot every time.
*Tests:* the resting position lies on the ball-to-goal-centre line and inside
the area; a ball travelling away from goal or heading wide gets no dive; the
dive direction follows the predicted crossing point; a ball that cannot be
reached in time is not dived at; a catch stops the ball dead; a parry leaves
the ball further from the goal than it was.

**Step 12 — The keeper distributes**
A caught ball is held for a fixed time, during which no other player can play
it, and is then thrown or kicked to the best-placed teammate — the same pass
picker as step 10, weighted towards the safest option rather than the most
advanced.
*Review:* after a catch, play restarts itself: the ball goes to a teammate in
space and the game continues without a refresh.
*Tests:* the hold lasts its time and no touch by any player is allowed during
it; the release aims at a teammate; the ball is in play again afterwards and
the keeper cannot immediately catch it back.

**Step 13 — Feel pass and cleanup**
Tune the new constants: shape shift, arrival band, separation push, switch
margin, lunge reach and recovery, header power, pressing and shooting
distances, keeper reach and hold. They join `tuning.js` beside the M1 ones.
*Review:* a full session against the AI — win the ball, pass it, work upfield,
shoot, defend a counter — with no stuck ball, no player stuck on a wall, no
crowd stacked on one spot, and no runaway camera.
*Tests:* the whole suite still passes after tuning.

### 10.4 M2 acceptance
Two elevens in their own kits play on the pitch. You control one player at a
time and the selection follows the ball. Both teams hold a 4-4-2 that slides
with play, chase loose balls, dribble, pass, shoot, head an airborne ball, and
slide-tackle on the same button that kicks. Keepers position, dive, catch or
parry, and distribute. A ball crossing the goal line between the posts is
reported as a goal, and the frame rebounds the rest. `node --test` passes.
