# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

동굴 소코반 (Cave Sokoban) — a React + Vite Sokoban puzzle game with a cave theme, smooth sliding animations, and 10 levels. Built against `prd.md` (the product spec, in Korean). UI text and comments are in Korean.

## Commands

```bash
npm install                        # install dependencies
npm run dev                        # dev server at http://localhost:5173
npm run build                      # production build → dist/
npm run preview                    # serve the production build
node scripts/validate-levels.mjs   # verify every level is solvable (exit 1 if any fails)
```

There is no test runner or linter configured. `validate-levels.mjs` is the closest thing to a test — always run it after editing `src/levels.js`.

## Architecture

The core design principle is **separation of pure game logic from React rendering**.

- **`src/game.js`** — pure, framework-agnostic Sokoban engine. No React imports. Keep it that way.
  - Levels are standard Sokoban ASCII: `#` wall, ` ` floor, `.` goal, `@` player, `+` player-on-goal, `$` box, `*` box-on-goal.
  - `parseLevel(rows)` splits a level into **static data** (`walls`, `goals` as `Set`s of `"r,c"` keys; `width`, `height`) that never changes, and **dynamic state** (`player`, `boxes`, `dir`). Boxes are `{ id, r, c }` with a stable `id`.
  - `move(state, staticData, dir)` returns a *new* `{ player, boxes }` or `null` if blocked. It never mutates. Pushing checks the cell beyond the box for walls/other boxes.
  - `isSolved` = every box sits on a goal. Coordinates are addressed everywhere via `key(r, c)` → `"r,c"`.

- **`src/App.jsx`** — all stateful orchestration via `useReducer`. Actions: `LOAD`, `RESTART`, `UNDO`, `MOVE`. The reducer owns move history (for undo), move count, and the `won` flag. Three input paths all dispatch `MOVE`: keyboard (arrows/WASD), swipe (from Board), and the on-screen D-pad. Progress (`unlocked` / `completed` / `last`) is mirrored to `localStorage` under key `cave-sokoban-progress` via effects.

- **`src/components/Board.jsx`** — pure renderer + swipe detection. Every tile and entity is absolutely positioned and placed with `transform: translate(...)`. Smooth motion comes from CSS `transition` on `transform`; it works *because* boxes keep a stable `id` React key, so a box animates from old to new position instead of remounting. Don't key entities by coordinates.

- **`src/levels.js`** — the 10 level definitions, ordered by increasing difficulty.

- **`scripts/validate-levels.mjs`** — a BFS push-based solver that imports `LEVELS` directly. It normalizes player position to a reachable-region representative (flood fill) to shrink the state space, and prunes non-goal corner deadlocks. Use it as the gate for any level change.

## Conventions when extending

- Adding or editing a level: edit `src/levels.js`, then run `node scripts/validate-levels.mjs` and confirm it reports `OK` for that level. A level the solver can't solve will fail CI-style with exit 1.
- New game rules belong in `src/game.js` as pure functions and should be expressible without React.
- Animation timing and theme live entirely in `src/index.css` (CSS variables in `:root`, `@keyframes` for goal pulse / overlay pop). No animation logic in JS.
