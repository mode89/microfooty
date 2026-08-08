_Reference context — observed facts and standing conventions for this project, not instructions. It informs the work; it does not command actions. Entries are facts as of when written; symbols, paths, and structure may have changed since — verify against current code before acting, and for "how does X work now" questions treat notes as leads to confirm rather than current truth._

## Architecture

- `package.json` sets `"type": "module"`, so `node --test` loads the `web/` ES modules unchanged. Its dev dependencies are lint and format tools only; `web/` still runs from source with no build step.

## Conventions

- Bash calls that run the test suite, the linter, or the formatter (`node --test`, `npm run lint`, `npm run format`) are marked `safe: true`. Why: they only read the project and report or reformat it, so a confirmation prompt adds no protection.
- Gameplay feel constants (control radius, ideal lead, cooldown) are the user's to choose, not retuned unasked. Why: they are judged by eye in the browser, where measurement cannot rank feel. How to apply: measure the options, report, apply the pick.
- Numbers from delegated reviews are re-measured before being acted on. Why: two agent reports did not reproduce — a claimed stable 0.61 m dribble lead was really 1.2 m, and a claimed double-turn failure band did not exist at any re-turn delay.
- A new test is checked by deleting the rule it names in a scratch copy of the module and confirming the test fails. Why: two kick tests passed against a deleted rule. How to apply: on tests written for a rule added in the same session.
- `SPEC.md` is edited in the same session when a request changes what a step means: M2 step 1's art paragraph was rewritten when kits gained a second colour. Why: a stale step description misleads the next milestone.

## Gotchas

- At the 90% pitch-width zoom the view is 61.2 m wide against a 68 m pitch, so only 3.4 m per side stays off-screen and the bounds clamp holds the camera x near 0. Sideways scrolling is effectively absent until the zoom tightens.
- `npm run lint` and `npm run format` fail with `eslint: command not found` under the ambient npm; they work under `nix-shell --packages nodejs --run "npm run lint"`, which puts `node_modules/.bin` on the PATH.
- `web/players.png` is 24 × 8 RGBA: three 8 × 8 frames in sheet order down, right, up, not the down, up, right that `SPEC.md` first stated.
- The shirt in `web/players.png` is striped one pixel wide, `BWBW` on the down and right frames and mirrored to `WBWB` on the up frame, blue `(0, 112, 255)` being the main kit colour and white `(255, 255, 255)` the secondary.
- Boots in `web/players.png` are `(1, 1, 1)`, one unit off the `(0, 0, 0)` eyes, so a palette swap can reach one without the other. On screen the two are indistinguishable.
- Five tests fail on a clean tree at the end of M2 step 1: three in `test/camera.test.js`, two in `test/kick.test.js`. They fail at the last M1 commit too, so all-green-except-five is the baseline, not a regression.
- `web/main.js` and `web/sprite-demo.js` are never loaded by `node --test`, so a renamed export or broken import path in them surfaces only in the browser.
- Every frame of `web/players.png` leaves row 0 and row 7 blank, so the body fills six of the eight rows and looks smaller than its 1.4 m draw width suggests.
- The background of `web/players.png` is solid magenta `(255, 0, 255)`, which is the transparency key rather than a drawn colour.
- `node --test` collects any file whose name matches `*-test.js`, `*_test.js` or `*.test.js` anywhere in the project, `web/` included, and then fails on browser globals. Browser-only demo pages avoid those name shapes.
- `web/sprite-demo.html` carries its whole module inline in a `<script type="module">`, so ESLint, which reads `.js` files only, never checks it.
- The peak player-to-ball gap in a turn is about `idealLead + maxSpeed × touchCooldown / 2`; the ball is kept while that stays under `controlRadius`. The estimate matched every measured combination of the three.
- A full reversal at top speed peaks at about `idealLead` + 0.30 m: measured 0.90 m at lead 0.6, 1.00 m at radius 1.2 with lead 0.7, 1.10 m at radius 1.4 with lead 0.8. A 90° turn peaks about 0.11 m over the lead.
- With a touch capped to a multiple of the run speed, a 180° turn keeps the ball only while `controlRadius` exceeds `idealLead` by about 0.4 m. At radius 1 and lead 0.8 a full reversal at top speed loses it.
- A 180° turn cannot keep the ball while `minimumRunSpeed` is above about 0.4 m/s: the run passes through near-zero speed mid-reversal, no touch is allowed, and the ball rolls 20 m clear.
- The sharp-turn touch pulls the ball from 0.79 m to 0.24 m in front of the feet when direction changes come fast: touches arrive sooner than the cooldown while each still aims one cooldown ahead.
- The sharp-turn waiver compares run directions, not held keys, and steering rotates the velocity gradually: a 90° turn at top speed does not cross the 60° threshold within one 0.1 s cooldown, measured as no touch in the six ticks after a kick.
- Kick travel measured with bounce and roll at a 23° launch: 20 m/s carries 46 m, 24 m/s 63 m, 28 m/s 83 m, 32 m/s 104 m, against a 105 m pitch. A flat 9 m/s tap rolls 13 m.
- A charge summed in 1/60 s ticks stops just under its maximum (0.49999999999999994 against 0.5) and never reaches the clamp, so charge assertions need a tolerance rather than equality.
- `Math.atan2(0, 0)` is 0, which points along +x, so a kick-direction test that runs the player along +x also passes with a zeroed aim. Direction tests run along ±y instead.

## Decisions

- Prettier owns code style and `eslint-config-prettier` switches ESLint's style rules off. Why: two tools formatting the same files disagree, and Prettier rewraps long lines, which `@stylistic/eslint-plugin` (installed, then removed) cannot do.
- Prettier ignores `*.md`. Why: reformatting the SPEC.md prose changed 48 lines and would bury real edits in review.
- The camera follows the ball, not the player. Why: the M1 acceptance in `SPEC.md` asks for it. Cost: a resting ball holds the camera still, so the player can run out of the roughly 61 × 34 m view.
- The ball is drawn at twice its real 0.11 m radius, and neither the ball nor its shadow changes size with height. Why: at the 90% zoom the true size is a 3 px dot, and a fixed size leaves the ball-to-shadow gap as the single height cue.
- M1 step 3 draws the ball as a plain circle and step 4 introduces sprites. Why: separates "is the physics right" from "does the art pipeline work", so a failed review has one obvious cause.
- M1 uses the real sprites rather than placeholder shapes. Why: validates the continuous-presentation look early instead of deferring the risk to M4.
- The magenta background of `web/players.png` is keyed out at load time by `keyColour` in `web/view/sprites.js`, and the PNG keeps it. Why: the file stays the plain art source, editable in any pixel editor with no alpha channel to maintain.
- A diagonal heading up the pitch shows the up frame, and only downward diagonals show a side frame. Why: the player's back towards the camera reads as running away, which the side frame hides.
- A player's position is the point where the feet stand, as the ball's position is its point on the ground. Why: one ground-level meaning for both keeps player-to-ball distance honest for dribbling and tackling.
- A touch aims the ball to arrive exactly as the next touch falls due, so no separate reach-time constant exists. Why: measured the best turn safety; at twice the cooldown a 90° turn holds but a 180° reversal is lost.
- `web/world/kick.js` keeps one control state (cooldown, heading, charge, aim) for both touching and kicking. Why: a kick starts the touch cooldown, so two states had to be threaded through both advance calls and returned together.
- `KICK.maximumPower` in `web/tuning.js` is 28 m/s, which carries 83 m of the 105 m pitch. Why: picked over 24 m/s (63 m), which leaves less than "most of the pitch" as step 7 of `SPEC.md` asks, and 32 m/s (104 m).
- Every team's `roles` aliases the single `FORMATION_442`, and the field stays despite the duplication. Why: `SPEC.md` §10.1 makes the formation part of team data, and M2 step 3 gives roles a ball-shifted home.
- The Shift "tackle" binding is gone from `web/input.js` because the plan is single-button controls, while section 3.2 of `SPEC.md` still names a second button for the slide tackle.
- `PLAYER_CARRYING`'s 10% pace penalty is a feel choice, not ball control. Why: the touch aims at the player's own velocity, so a slower run pushes a slower ball — turn peaks were identical at 1.0, 0.9, 0.85 and 0.8 of top speed.

## Dead Ends

- ✗ A touch that scales the player's velocity by a fixed factor: abandoned. The lead has no equilibrium — it changes by `(f−1)·v·T − ½·a·T²` per touch, so the ball rides the control radius edge and every turn loses it.
- ✗ A two-zone touch, pushing near the feet and gathering further out: abandoned. The zones are judged on distance alone, so a ball beside or behind the player is also gathered, slows, drifts further behind and is lost.

## Open Questions

- ? Kick-off is not modelled, and both strikers' home places sit 8.0 m from the centre spot, inside the 9.15 m circle, so M3 has to settle what a legal kick-off shape looks like.
- ? The lost 180° turn is left unfixed by choice at the end of M1: radius 1 with lead 0.8 still loses the ball on a full reversal at top speed, and the ball rolls about 20 m clear.
