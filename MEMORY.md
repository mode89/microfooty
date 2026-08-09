_Reference context — observed facts and standing conventions for this project, not instructions. It informs the work; it does not command actions. Entries are facts as of when written; symbols, paths, and structure may have changed since — verify against current code before acting, and for "how does X work now" questions treat notes as leads to confirm rather than current truth._

## Architecture

- `package.json` sets `"type": "module"`, so `node --test` loads the `web/` ES modules unchanged. Its dev dependencies are lint and format tools only; `web/` still runs from source with no build step.

## Conventions

- Test, lint, and format Bash calls are marked `safe: true`. Why: they only read, report, or reformat, so confirmation adds no protection.
- Gameplay feel constants (control radius, ideal lead, touch period) are the user's to choose, not retuned unasked. Why: measurements cannot rank feel. How to apply: measure options, report them, and apply the user's pick.
- Numbers from delegated reviews are re-measured before being acted on. Why: two agent reports did not reproduce — a claimed stable 0.61 m dribble lead was really 1.2 m, and a claimed double-turn failure band did not exist at any re-turn delay.
- A new test is checked by deleting the rule it names in a scratch copy of the module and confirming the test fails. Why: two kick tests passed against a deleted rule. How to apply: on tests written for a rule added in the same session.
- One word serves each concept: `heading` for a unit run direction, `frame` for one of the four sprite names, `speed` for pace. Why: a review found `facing`, `heading` and `aim` all naming the same unit vector across three modules.
- Velocities rebuilt from heading times speed are compared with a tolerance, never with equality. Why: two runs that differ only in a blocked axis take different normalise round-trips, so an exact match is luck rather than a rule.
- A rule about ball control is asserted on the event it produces, a touch recorded, not on a distance. Why: a kicked-ball test asserted a gap that the touch timer does not control, so it passed with the rule deleted.
- Camera settling tests derive their tick count from tuning, e.g. 10 × `CAMERA.smoothingSeconds`. Why: 600 fixed ticks once missed a 0.01 m tolerance.
- A test fixture that must fall inside a tuning limit is derived from that constant, not written as a literal. Why: a hand-picked ball "inside every band" made the follow-share test fail when the keeper's rein shrank, blaming the wrong rule.
- Tests that read feel constants are checked against plausible retunes of them, not only against deleted rules. Why: the deleted-rule set passed while a keeper rein cut from 3 m to 1.5 m falsely failed a test of the follow share.
- The whole mutation set is re-run after a refactor of the code its tests cover. Why: the M2 step 2 refactor renamed a module and changed a helper's signature, and the re-run proved every rule still had a test that fails without it.
- Scratch copies for mutation runs live outside the repo, e.g. `cp -r web test package.json /tmp/mut/`. Why: `node --test` collects any `*.test.js` in the tree, so probes and copies kept inside the repo are loaded as tests.
- Mutation suites that create and edit scratch copies under `/tmp` are safe to run without confirmation. Why: they cannot change the working tree. How to apply: keep every mutation copy outside the repository.
- `SPEC.md` is edited in the same session when a request changes what a step means: M2 step 1's art paragraph was rewritten when kits gained a second colour. Why: a stale step description misleads the next milestone.

## Gotchas

- The camera lookahead reaches its 20 m cap at 6.7 m/s, `maxLookahead` over `lookaheadSeconds` 3, so anything quicker than a jog, every kicked ball included, is led by a fixed 20 m.
- At the 90% pitch-width zoom the view is 61.2 m wide against a 68 m pitch, so only 3.4 m per side stays off-screen and the bounds clamp holds the camera x near 0. Sideways scrolling is effectively absent until the zoom tightens.
- `npm run lint` and `npm run format` fail with `eslint: command not found` under the ambient npm; they work under `nix-shell --packages nodejs --run "npm run lint"`, which puts `node_modules/.bin` on the PATH.
- `web/players.png` is 24 × 8 RGBA: three 8 × 8 frames in sheet order down, right, up, not the down, up, right that `SPEC.md` first stated.
- The shirt in `web/players.png` is striped one pixel wide, `BWBW` on the down and right frames and mirrored to `WBWB` on the up frame, blue `(0, 112, 255)` being the main kit colour and white `(255, 255, 255)` the secondary.
- Boots in `web/players.png` are `(1, 1, 1)`, one unit off the `(0, 0, 0)` eyes, so a palette swap can reach one without the other. On screen the two are indistinguishable.
- The ball keeps a velocity vector while a player is a heading plus a speed, and `velocityOf` bridges the two. A player handed to `followCamera`, which reads `focus.velocity`, gives NaN rather than an error.
- The body push tops out at `BODY.pushRate` × `BODY.diameter` / 2, which is 4 m/s against an 8 m/s run, so a player running at a standing body closes to 0.13 m before it gives way.
- 22 bodies stacked on one point are still 0.996 m apart after 4000 ticks, and the first tick throws the outermost one 1.4 m, because the pushes of 21 neighbours sum uncapped.
- The closest pair of formation home positions is 8.4 m apart, so nobody is pushed apart at kick-off.
- A steering target on or outside the touchline settles still rather than shivering: `advancePlayer` zeroes the velocity on the blocked axis, so the player pins to the line.
- `web/main.js` and `web/sprite-demo.js` are never loaded by `node --test`, so a renamed export or broken import path in them surfaces only in the browser.
- Every frame of `web/players.png` leaves row 0 and row 7 blank, so the body fills six of the eight rows and looks smaller than its 1.4 m draw width suggests.
- The background of `web/players.png` is solid magenta `(255, 0, 255)`, which is the transparency key rather than a drawn colour.
- `node --test` collects any file whose name matches `*-test.js`, `*_test.js` or `*.test.js` anywhere in the project, `web/` included, and then fails on browser globals. Browser-only demo pages avoid those name shapes.
- `node --test` also runs every `.js` file under a `test/` directory, so `test/helpers.js` is reported as a test file with no tests. The `npm test` script passes `test/*.test.js` to keep the run to the specs.
- `web/sprite-demo.html` carries its whole module inline in a `<script type="module">`, so ESLint, which reads `.js` files only, never checks it.
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
- Instant starts, stops and turns with 3 Hz touches are browser-approved. Why: the user accepted the arcade dribbling feel without acceleration or braking.
- A low fast ball is controlled by replacing its horizontal velocity. Why: the user accepted the arcade interception behavior; no velocity-change cap is wanted.
- Possession is one deep in-process module with no adapter. Why: one implementation makes another seam hypothetical, while one module keeps touch and kick order local.
- A new toucher calculates its first touch at full pace, then moves at carrying pace. Why: this preserves the accepted dribble lead; carrying pace would shorten the touch.
- A player's run is a unit `heading` plus a scalar `speed`, and `velocityOf` rebuilds the vector for the rules that want one. Why: the heading outlives the run, so a player who has stopped still points where they last ran.
- A kick goes along the player's heading, with no aim state of its own. Why: the heading already persists when stopped, and the aim it replaced was seeded up the pitch, so a player who kicked before ever moving shot at their own goal.
- Sprite frames depend only on heading in `web/view/frames.js`. Why: the old flicker dead band required prior frame state, which the world no longer stores.
- Running onto your own tap counts as dribbling, so the weakest kick is not required to outrun the kicker. Why: the alternative was raising `KICK.minimumPower` from 9 to 11, which lengthens every short pass. The test was changed instead.
- `KICK.maximumPower` in `web/tuning.js` is 28 m/s, which carries 83 m of the 105 m pitch. Why: picked over 24 m/s (63 m), which leaves less than "most of the pitch" as step 7 of `SPEC.md` asks, and 32 m/s (104 m).
- Every team's `roles` aliases the single `FORMATION_442`, and the field stays despite the duplication. Why: `SPEC.md` §10.1 makes the formation part of team data, and M2 step 3 gives roles a ball-shifted home.
- The Shift "tackle" binding is gone from `web/input.js` because the plan is single-button controls, while section 3.2 of `SPEC.md` still names a second button for the slide tackle.
- The body push lives in `web/world/bodies.js` as `partBodies`, not under `ai/`. Why: `SPEC.md` §10.2 names no file for it, and it moves bodies rather than deciding anything, so it belongs with the other world rules.

## Dead Ends

- ✗ A touch that scales the player's velocity by a fixed factor: abandoned. The lead has no equilibrium — it changes by `(f−1)·v·T − ½·a·T²` per touch, so the ball rides the control radius edge and every turn loses it.
- ✗ A two-zone touch, pushing near the feet and gathering further out: abandoned. The zones are judged on distance alone, so a ball beside or behind the player is also gathered, slows, drifts further behind and is lost.
- ✗ A 12 m outfield reach with a 6 m keeper reach for the ball-shifted shape: abandoned. The pitch clamp pinned the keeper on its own goal line, and keeper-to-defence spacing fell from 9.45 m to 0.60 m once the ball came 24 m into that half.

## Open Questions

- ? Whether the sprite frame flickers on the 39 degree boundary between the up and side frames now that the dead band is gone: unjudged in a browser.

- ? `BODY.pushRate` is 8, picked without a browser check: a full-speed run still walks through a standing body, and 16 would match run speed. The feel is the user's call.
- ? Kick-off is not modelled, and both strikers' home places sit 8.0 m from the centre spot, inside the 9.15 m circle, so M3 has to settle what a legal kick-off shape looks like.
- ? Per-player 3 Hz timers permit an aggregate touch every tick in a crowd; whether this looks too busy in team play is unjudged.
- ? The 8 m along-pitch reach lets a team slide 16 m over a 105 m pitch, unjudged in a browser: it may read as stiff, but past about 10 m the defence crowds its own keeper.

# Extra

## Glossary

This glossary records project terms whose local meaning is easy to mistake. Entries change when the shared domain language changes.

- **Possession**: Loose-ball play handled by the Possession module. It is not stored ownership; the ball stays loose, and possession emerges from touches.
