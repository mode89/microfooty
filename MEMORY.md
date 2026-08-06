_Reference context — observed facts and standing conventions for this project, not instructions. It informs the work; it does not command actions. Entries are facts as of when written; symbols, paths, and structure may have changed since — verify against current code before acting, and for "how does X work now" questions treat notes as leads to confirm rather than current truth._

## Architecture

- `package.json` exists only to set `"type": "module"`, so `node --test` loads the `web/` ES modules unchanged. There are no dependencies and no build step.

## Conventions

- Bash calls that only run the test suite (`node --test`) are marked `safe: true`. Why: they read files and print results, so a confirmation prompt adds no protection. How to apply: any read-only verification command.

## Gotchas

- At the 90% pitch-width zoom the view is 61.2 m wide against a 68 m pitch, so only 3.4 m per side stays off-screen and the bounds clamp holds the camera x near 0. Sideways scrolling is effectively absent until the zoom tightens.

- `web/players.png` is 24 × 8 RGBA: three 8 × 8 frames (down, up, right) on a solid magenta `(255, 0, 255)` background, which is meant as the transparency key, not a drawn colour.

## Decisions

- M1 step 3 draws the ball as a plain circle and step 4 introduces sprites. Why: separates "is the physics right" from "does the art pipeline work", so a failed review has one obvious cause.
- Facing selection gets hysteresis (M1 step 5) instead of a plain angle-to-sprite map. Why: near-diagonal input otherwise flickers between two facings.
- M1 uses the real sprites rather than placeholder shapes. Why: validates the continuous-presentation look early instead of deferring the risk to M4.

## Open Questions

- ? Magenta `(255, 0, 255)` transparency in `web/players.png` is handled either by the sprite slicer at load time or by fixing the PNG itself; not yet decided.
