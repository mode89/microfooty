# Microfooty

## 1. Overview
**Microfooty** is a browser-based, single-player, top-down arcade football prototype inspired by Sensible Soccer '93. One playable match vs AI. HTML5 Canvas 2D, plain JavaScript (or TypeScript), no engine. Pixel art is used as a texture style only; presentation is continuous (no logical pixel grid).

## 2. Platform & Technical
- **Target:** Modern desktop browsers, keyboard + gamepad input.
- **Rendering:** Canvas 2D, continuous presentation:
  - World simulated and rendered in floating-point coordinates; no position snapping or logical resolution.
  - Sprites pre-scaled ×4–8 via nearest-neighbor into offscreen canvases at load, then drawn with smoothing enabled at continuous positions, rotations, and scales (crisp chunky pixels, smooth motion).
  - Camera: smooth scroll tracking the ball with lookahead in direction of play; fixed zoom defined in world units per screen height, resolution-independent.
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
