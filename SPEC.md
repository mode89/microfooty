# Microfooty

This is the primary description of the game: its scope, rules and mechanics. The delivery plan — milestones, steps, review and test criteria — lives in `ROADMAP.md`.

## 1. Overview
**Microfooty**
is a browser-based, single-player, top-down arcade football prototype inspired by Sensible Soccer '93. One playable match vs AI. HTML5 Canvas 2D, plain JavaScript (ES modules, no build step), no engine. Pixel art is used as a texture style only; presentation is continuous (no logical pixel grid).

## 2. Platform & Technical
- **Target:** Modern desktop browsers, keyboard input. A gamepad is wanted, but no milestone owns it yet.
- **Rendering:** Canvas 2D, continuous presentation:
  - A full-window canvas that survives resizing and high-DPI displays.
  - World simulated and rendered in floating-point coordinates; no position snapping or logical resolution.
  - Sprites pre-scaled ×4–8 via nearest-neighbor into offscreen canvases at load, then drawn with smoothing enabled at continuous positions, rotations, and scales (crisp chunky pixels, smooth motion).
  - Camera: smooth scroll tracking the ball with lookahead in direction of play; fixed zoom defined in world units per screen width, resolution-independent. The pitch is vertical, so the width is the axis worth fixing: the view shows 90% of the pitch width at any window shape.
- **Loop:** Fixed timestep simulation (60 Hz) with interpolated rendering.
- **No backend, no saves, no audio.**
- **No build step.** `index.html` plus ES modules loaded directly. Served by any static file server.
- **No dependencies** in the shipped code.
- **Simulation is pure, presentation is not.** Simulation modules take state and input and return new state. They never touch the canvas, the DOM, the clock, or `Math.random`. This is what makes them testable.
- **The AI is deterministic.** Decisions are pure functions of the match state, with no clock and no `Math.random`, which is what makes them testable.
- **Tests** use the Node built-in test runner (`node --test`), which loads the same ES modules unchanged. Everything pure is tested: vector maths, ball integration, camera follow, player movement, facing selection, kick power. Rendering and raw input handling are checked by eye. Test state is built by small factory helpers that place only the players a test cares about.
- **Debug tools** are review-only presentation. The match overlay shows timing and world state; standalone pages under `web/demo/` isolate mechanics such as dribbling. They are not match UI.

## 3. Units, Pitch & Sides
- World units are metres. The pitch is 105 × 68 m and vertical: its length runs along the `+y` axis, which points down the screen, so the goals are at the top and the bottom. Ball height is `z`, positive upwards.
- Pitch markings: touchlines, goal lines, halfway line, centre circle, penalty areas, goal areas, penalty spots and arcs, corner arcs.
- Posts and crossbar are pitch data, drawn at both ends.
- **One set of rules, two teams.** Both sides run the same code. A team is data: kit colours, attacking direction, and the eleven role positions of its formation. The human replaces one player's input with the keyboard and changes nothing else.
- **Attacking direction is data, not a second code path.** Every rule that points up or down the pitch takes the team's direction, so no rule is written twice for the two ends.

## 4. Camera & View
- Top-down view. Sprites are drawn at their true aspect ratio, so a square frame stays square on screen. Shadows are ellipses flattened towards the horizontal.
- The camera converts world to screen at a fixed zoom given as world-units-per-screen-width, set to 90% of the pitch width, so the pitch fills the same fraction of the screen at any window size. World-to-screen and screen-to-world are inverses.
- It follows the ball with smoothing plus lookahead along the target's velocity, converges without overshooting, and stays inside a pitch bounds margin.
- Radar/minimap showing all players.

## 5. Player Control
### 5.1 Movement
- 8-directional input sets the run direction and speed at once, and releasing it stops at once. Diagonal input gives the same top speed as straight input: the input vector is normalised. Starting, stopping and reversing take effect in one tick.
- The last nonzero direction remains as the heading while stopped. A player's run is a heading plus a speed.
- The heading maps to the four sprite frames: upward diagonals pick the up frame, downward diagonals the nearest side frame.
- A player's position is the point where the feet stand.

### 5.2 Which player you control
- Control one player at a time. There is no switch button: Sensible Soccer had one fire button and picked the player for you.
- Selection follows the ball. A touch by the team settles it outright: control goes to the toucher, the keeper included, since only the driven player can kick. Otherwise the teammate who can meet the ball soonest takes over, with a margin in seconds so two near-equal candidates do not trade the selection back and forth.
- Soonest is measured, not guessed. The ball's future is walked once a tick with the ball's own rules, so bounce, drag and rolling friction need no second model, and a player's meeting point is the first point on that walk they can be standing at in time. Ties inside one step of the walk go to the shorter run. Chasers run at that meeting point rather than at the ball, which is what stops a chase trailing a moving ball.
- A carrier is never switched away from automatically. The keeper is never ranked in by the soonest meeting, so the keyboard takes him only on his own touch; the chase ranks him in like anyone else, so he can be his team's chaser and leave his goal. The selected player is marked underfoot.
- A kick makes the ball loose at once, so the kicker would lose control on the tick it strikes. While your own team was the last to touch the ball, the selection is frozen where it is, so a pass stays in the kicker's hands and you can run him into space. The freeze ends on the next contact: a touch by the team outranks it, and an opponent's touch hands the team back to the ranking. A frozen player is not left out of play, because each team sends its soonest player at the ball whether or not he is selected, unless the keyboard steers that very player elsewhere. A ball nobody can reach, walked over a line, freezes the selection for good; that is out of play, which match structure has to settle.
- **Grip.** A player handed the selection keeps chasing the ball on its own until the keyboard is used, so a switch never strands a player standing in play. Any press takes the grip, the kick button included, and releasing the keys keeps it: only the next selection hands the player back. The early touch that a change of directional input allows belongs to the grip as well, so a player chasing on its own earns no free touch from a key released elsewhere.
- The charge belongs to the button, not to a foot, so no wind-up is stranded on a player the selection leaves, but the selection moving to another player clears it. Holding the button on charges the new player from zero.

### 5.3 The kick button
- **One-button kick model, no aftertouch.** Charge builds while the button is held, capped at a maximum. Release kicks with power interpolated from the charge: a tap gives a low flat pass, a full hold gives a fast rising shot. Launch angle rises with power.
- The kick goes along the player's heading; there is no separate aim state.
- The kick fires only if the ball is within kicking range and below the maximum kicking height at release. The kicker cannot touch the ball again for one touch period, and that lock has no early-touch exception, so turning on the tick after a kick cannot take the ball straight back.
- A tap will aim at the best teammate inside a cone around the run, and at the run itself when the cone is empty. Until the pass picker of §8 exists, every kick goes along the heading.
- Charging with no ball nearby wastes the charge without error.

### 5.4 Slide tackle
- The ball decides what a release means, so there is no second button and no double-tap. In kicking range it kicks. Out of kicking range but inside a lunge reach it slides. Further out than the lunge reach the press is wasted.
- The player lunges along the run for a fixed time, cannot steer while sliding, reaches further for the ball than a standing player, and then lies in a recovery period before running again.
- The charge is discarded by a slide, so a slide has one length.
- Sliding through an opponent does nothing to them: there are no fouls.
- The lying frame is the side sprite rotated to the slide direction.

### 5.5 Headers and volleys
- An airborne ball that arrives inside a player's reach is struck without a button press: away along the player's aim, with power drawn from the ball's incoming speed and the player's run, and an elevation that makes a header a clearance rather than a pass.
- A ball above head height passes over untouched.
- Height alone separates this from a dribble touch: the dribble keeps its ceiling and the volley starts above it, so no ball is eligible for both.
- The strike starts the same touch timer as a dribble touch, so one flight cannot be struck twice.

## 6. The Ball
### 6.1 Physics
- Ball state is position `(x, y, z)` and velocity `(vx, vy, vz)`, kept as a 3-component vector so spin can be added later without reshaping the state.
- Gravity, ground friction, air drag, and bounce with restitution, on a single standard pitch surface. A ball at rest stays at rest; a rolling ball stops in finite time and does not creep.
- The trajectory is unchanged when the same time span is split into more ticks.

### 6.2 Dribbling and touches
- **The ball stays loose.** No player owns the ball and no possession flag exists. Possession is what the touch rules produce. The keeper's hands are the single exception, and they hold the ball for a fixed time only.
- A low ball inside the control radius may be touched every 1/3 second. Every change in directional input allows an early touch attempt; a successful touch resets the timer.
- Nonzero input supplies the touch direction, while zero input uses the player's last heading.
- A touch sets the ball velocity to carry it in one touch period from its current position to the player's position plus the direction multiplied by the player's travel over that period and the ideal lead.
- A recent touch costs a little pace, and the ball remains free to run past or be intercepted. Only the most recent toucher pays that carrying pace penalty, and a successful kick clears the recent touch.
- Every player has the same 3 Hz timer, but at most one touch happens in a tick: the nearest eligible player wins, with ties broken in fixed player order.

## 7. Teams & Data
- Two hardcoded fictional teams: name, kit colours, attacking direction, and a 4-4-2 of eleven named roles given as fractions of the pitch, so one formation serves both ends by mirroring about the halfway line.
- **Uniform attributes.** Every outfielder has the same pace, reach and touch. Roles differ in where they stand and what they decide, nothing else.
- Each role's home position is its formation place shifted by the ball, clamped to the pitch and to the role's own band, so a team slides up and down as one and keeps its lines. One band serves all ten outfielders; the keeper is held on a shorter rein. Defenders stay behind attackers for every ball position.
- Players run to their home position steered towards a point instead of by keys, and settle inside an arrival band rather than shivering on it.
- Bodies push each other apart softly, by equal and opposite amounts, and the push stops once they stand a body apart.

## 8. AI
- **Off the ball:** defenders hold the line and stay goalside of the nearest opponent, midfielders support the carrier at passing distance and out of the carrier's path, forwards make runs into space ahead of the ball, and exactly one player per team chases: the player who can meet the ball soonest, by the same walk as §5.2, the keeper included.
- **On the ball:** a small per-player state machine decides for a carrier: shoot when inside shooting range with a clear lane to the goal, pass when an opponent is inside pressing distance and a teammate is free, and dribble towards the opponent's goal otherwise. Passes lead a running receiver; shots aim inside a post. A lane with an opponent across it is rejected for both.
- Single fixed difficulty.

## 9. Goalkeepers
- AI-controlled always, and never selectable except by his own touch.
- The keeper stands on the line between the ball and the centre of its goal, clamped to its own area, and comes off the line as the ball nears.
- It dives at a shot that is going in, in the direction of the point where the ball will cross the line, and only when it can arrive in time. A ball travelling away from goal or heading wide gets no dive.
- Inside the hands radius it catches, holding the ball dead; further out it parries, pushing the ball away from the goal rather than back to the shooter.
- A caught ball is held for a fixed time, during which no other player can play it, and is then thrown or kicked to the best-placed teammate — the same pass picker as §8, weighted towards the safest option rather than the most advanced. The keeper cannot immediately catch it back.

## 10. Goals & Match Structure
- A goal is scored when the ball crosses the goal line between the posts and under the bar, tested against the segment the ball travelled in the tick, so a shot fast enough to jump the whole line in one tick still counts. The same goal is not reported on the following tick. The ball rebounds off posts and crossbar and stays in play.
- Kickoff, two halves of fixed length (e.g. 3 min), half-time switch.
- Goals and score tracking.
- Simple restarts only: throw-in, goal kick, corner (ball placed, nearest player takes it). No fouls, cards, offside, subs, injuries, penalties, or extra time.

## 11. Presentation
- **Player sprites: 8×8 px source art, three drawn base sprites only**, held in `players.png` as a 24 × 8 sheet in the order down, right, up:
  - Facing forward (down), facing backward (up), facing right.
  - Facing left = horizontal mirror of the right-facing sprite.
  - Two lying sprites (slide tackle, keeper dive) = rotations/mirrors of the right-facing sprite; rendered continuously, so they may rotate to arbitrary angles (e.g. slide aligned to movement direction).
  - 8-directional movement maps to the 4 facings (upward diagonals use the up sprite, downward diagonals the nearest left/right sprite).
  - Single frame per facing (no run cycle).
  - Kits via palette swap of the same three sprites; derived variants pre-baked into offscreen canvases per kit at load. The source art stripes the shirt in a blue main colour and a white secondary one beside skin, hair and boots, so a kit is two colour mappings, and a kit whose two colours match wears a plain shirt. The keeper wears the team colour striped with black. The swap leaves every other colour, the transparency key included, alone.
- **Ball sprite: 3×3 px** — white with 3 static black dots (panel pattern). May scale slightly with height (z); a 1–2 px shadow dot on the pitch offsets from the ball as it rises for height readability.
- Pitch tilemap with markings and goals (net animation), following the same pixel-texture / continuous-presentation style.
- HUD: score + clock. Text banners (GOAL!, half time, full time), same visual style.
- No menus: game boots straight into the match; "play again" prompt at full time.

## 12. Tuning
Feel constants live in one module, `web/tuning.js`, so tuning is a single place: player speed, carrying speed factor, control radius, touch period, ideal lead, friction, restitution, kick power range, camera smoothing and lookahead, shape shift, arrival band, separation push, interception walk step and horizon, switch margin, lunge reach and recovery, header power, pressing and shooting distances, keeper reach and hold.

## 13. Out of Scope (v1)
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
