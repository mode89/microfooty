_Reference context — observed facts and standing conventions for this project, not instructions. It informs the work; it does not command actions. Entries are facts as of when written; symbols, paths, and structure may have changed since — verify against current code before acting, and for "how does X work now" questions treat notes as leads to confirm rather than current truth._

## Architecture

- `package.json` sets `"type": "module"`, so `node --test` loads the `web/` ES modules unchanged. Its dev dependencies are lint and format tools only; `web/` still runs from source with no build step.

## Conventions

- Bash calls that run the test suite, the linter, or the formatter (`node --test`, `npm run lint`, `npm run format`) are marked `safe: true`. Why: they only read the project and report or reformat it, so a confirmation prompt adds no protection.

## Gotchas

- At the 90% pitch-width zoom the view is 61.2 m wide against a 68 m pitch, so only 3.4 m per side stays off-screen and the bounds clamp holds the camera x near 0. Sideways scrolling is effectively absent until the zoom tightens.
- `npm run lint` and `npm run format` fail with `eslint: command not found` under the ambient npm; they work under `nix-shell --packages nodejs --run "npm run lint"`, which puts `node_modules/.bin` on the PATH.
- `web/players.png` is 24 × 8 RGBA: three 8 × 8 frames in sheet order down, right, up, not the down, up, right that `SPEC.md` first stated.
- Every frame of `web/players.png` leaves row 0 and row 7 blank, so the body fills six of the eight rows and looks smaller than its 1.4 m draw width suggests.
- The background of `web/players.png` is solid magenta `(255, 0, 255)`, which is the transparency key rather than a drawn colour.
- `node --test` collects any file whose name matches `*-test.js`, `*_test.js` or `*.test.js` anywhere in the project, `web/` included, and then fails on browser globals. Browser-only demo pages avoid those name shapes.
- `web/sprite-demo.html` carries its whole module inline in a `<script type="module">`, so ESLint, which reads `.js` files only, never checks it.

## Decisions

- Prettier owns code style and `eslint-config-prettier` switches ESLint's style rules off. Why: two tools formatting the same files disagree, and Prettier rewraps long lines, which `@stylistic/eslint-plugin` (installed, then removed) cannot do.
- Prettier ignores `*.md`. Why: reformatting the SPEC.md prose changed 48 lines and would bury real edits in review.
- The ball is drawn at twice its real 0.11 m radius, and neither the ball nor its shadow changes size with height. Why: at the 90% zoom the true size is a 3 px dot, and a fixed size leaves the ball-to-shadow gap as the single height cue.
- M1 step 3 draws the ball as a plain circle and step 4 introduces sprites. Why: separates "is the physics right" from "does the art pipeline work", so a failed review has one obvious cause.
- M1 uses the real sprites rather than placeholder shapes. Why: validates the continuous-presentation look early instead of deferring the risk to M4.
- The magenta background of `web/players.png` is keyed out at load time by `keyColour` in `web/view/sprites.js`, and the PNG keeps it. Why: the file stays the plain art source, editable in any pixel editor with no alpha channel to maintain.
- A diagonal heading up the pitch shows the up frame, and only downward diagonals show a side frame. Why: the player's back towards the camera reads as running away, which the side frame hides.
- A player's position is the point where the feet stand, as the ball's position is its point on the ground. Why: one ground-level meaning for both keeps player-to-ball distance honest for dribbling and tackling.
