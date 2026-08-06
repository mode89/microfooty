# Microfooty

Browser-based, single-player, top-down arcade football prototype inspired by Sensible Soccer '93.

## Files

- `SPEC.md` — requirements and scope
- `web/` — the game: `index.html` plus ES modules, loaded directly, no build step
- `test/` — Node built-in test runner specs for the pure modules
- `scripts/serve` — static server for `web/`

## Commands

- Run tests: `node --test`
- Play in a browser: `./scripts/serve` (port 8000 by default), then open
  `http://localhost:8000/`

**Memory — read first.** Read `MEMORY.md` at the start of each session, before your first response — it records facts about this project, its conventions, landmines, dead ends, and decision rationale you can't recover from the code. Skipping it risks repeating solved mistakes.
