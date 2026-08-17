# Microfooty

Browser-based, single-player, top-down arcade football prototype inspired by Sensible Soccer '93.

## Files

- `SPEC.md` — what the game is and how it works; keep in sync with the code
- `ROADMAP.md` — what to build next, in order; mark steps done as you go
- `web/` — the game: `index.html` plus ES modules, loaded directly, no build step
- `test/` — Node built-in test runner specs for the pure modules
- `test/comprehension/` — comprehension tests
- `scripts/serve` — static server for `web/`
- `eslint.config.js`, `.prettierrc.json` — lint and format configuration

## Commands

- Run tests: `npm test` (it runs `test/*.test.js`; a bare `node --test` also picks up
  `test/helpers.js` and reports it as a file with no tests)
- Lint: `npm run lint`
- Format: `npm run format` (or `npm run format:check` to verify only)
- Install the dev tools first: `npm install`
- Run the comprehension tests: `python test/comprehension/runner.py --jobs 10` (one test alone: pass its name)

**Memory — read first.** Read `MEMORY.md` at the start of each session, before your first response — it records facts about this project, its conventions, landmines, dead ends, and decision rationale you can't recover from the code. Skipping it risks repeating solved mistakes.
