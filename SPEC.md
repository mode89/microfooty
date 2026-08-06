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
- Second button (or double-tap): slide tackle (no foul consequences).
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
  - 8-directional movement maps to the 4 facings (diagonals use the nearest left/right sprite).
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
- **Debug overlay** toggled by a key, showing tick rate, frame rate, ball state,
  and player state. It is a review tool for every step below.
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
  world/kick.js    kick and dribble rules (pure)
  view/camera.js   camera follow (pure)
  view/sprites.js  offscreen pre-scaling and palette swaps
  view/render.js   draws world to canvas
  view/debug.js    debug overlay
test/
  *.test.js
```

### 9.3 Steps

**Step 1 — Canvas shell and fixed-timestep loop**
Full-window canvas that survives resizing and high-DPI displays. Loop runs
simulation at a fixed 60 Hz and renders with an interpolation factor between the
previous and current simulation state. Keyboard input collected into a plain
input-state object.
*Review:* on-screen text shows ticks per second, frames per second, and the
currently held keys. Ticks stay at 60 when the frame rate varies.
*Tests:* the accumulator produces the correct number of ticks and the correct
interpolation factor for a given sequence of frame durations, including a long
stall (it must not spiral).

**Step 2 — Pitch and camera**
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

**Step 3 — Ball physics**
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

**Step 4 — Sprite pipeline**
Load `players.png` (24 × 8, three 8 × 8 frames: down, up, right). At load,
draw each frame into its own offscreen canvas scaled ×8 with nearest-neighbour,
plus a pre-mirrored left frame. Per-frame drawing then uses smoothing at
fractional positions. The 3 × 3 ball sprite is generated in code, not loaded.
*Review:* a test screen shows the four facings side by side, and one sprite
drifting slowly across the screen at fractional coordinates. Pixels stay chunky;
motion shows no wobble or stepping.
*Tests:* the frame slicer returns the expected source rectangles for a sheet of
given size and frame count. (Canvas drawing itself is judged by eye.)

**Step 5 — Player movement**
One player. 8-directional input, acceleration towards a target velocity, a
maximum speed, and friction on release. Facing derives from the movement
direction and maps to the four sprites; diagonals pick the nearest side sprite.
Sprites drawn with the slight vertical squash of the Sensi look.
*Review:* the player runs in all eight directions at a consistent speed, and the
sprite facing matches the direction without flickering between two facings on
near-diagonal input.
*Tests:* diagonal input gives the same top speed as straight input (the input
vector is normalised); acceleration and stopping reach the expected speeds after
a known number of ticks; the direction-to-facing map covers all eight directions;
facing has hysteresis, so a direction hovering on a boundary does not oscillate.

**Step 6 — Loose-ball dribbling**
The ball is never attached to the player. When the ball is inside a control
radius, is low enough, and the player is moving, the player applies a touch that
nudges it ahead in the facing direction, with a cooldown between touches.
*Review:* the player can run the length of the pitch keeping the ball a short
distance ahead; the ball can be run past and lost; a bouncing ball is not
controlled until it drops.
*Tests:* no touch happens outside the control radius, above the height limit,
during the cooldown, or when the player is stationary; a touch sets the ball
speed relative to the player's speed so the ball outruns the player slightly.

**Step 7 — Tap and hold kick**
One kick button. Charge builds while held, capped at a maximum. Release kicks
with power interpolated from the charge: a tap gives a low flat pass, a full
hold gives a fast rising shot. Launch angle rises with power. The kick fires
only if the ball is within kicking range at release.
*Review:* taps and holds feel clearly different; a full-power shot travels most
of the pitch; charging with no ball nearby wastes the charge without error.
*Tests:* charge accumulates and clamps correctly; the tap threshold maps to
minimum power; power and launch angle are monotonic in charge duration; releasing
out of range leaves the ball untouched.

**Step 8 — Feel pass and cleanup**
Tune constants: player speed, acceleration, control radius, touch strength,
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
