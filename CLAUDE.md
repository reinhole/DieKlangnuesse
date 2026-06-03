# Die Klangnüsse — Project Guide for Agents

A browser platformer for the workshop's creative track: a squirrel climbs **up a
single tree**, hopping from branch to branch to chase nuts. Movement is driven by
**microphone loudness** — louder = faster, a loud peak = jump — while Left/Right
(arrow keys or on-screen buttons) set direction. The look is Shovel-Knight-style
procedural pixel art drawn on a `<canvas>`.

> ⚠️ The **binding** requirements live in the workshop spec at `../CLAUDE.md`
> (the DOM testability contract: `game-status`, `score`/`lives`/`level`, the
> Start/Pause/Reset buttons, seedable RNG, configurable timing). This file is the
> project-specific guide. **If the two ever conflict, `../CLAUDE.md` wins.**

## Run & test

```bash
npm install                 # zero runtime deps; pulls @playwright/test (devDep)
PORT=3000 node server.js     # open http://localhost:3000
npx playwright install chromium   # first time only
npm test                     # runs tests/game.spec.js
```

`server.js` is a tiny vanilla-`http` static file server — **no runtime
dependencies**, listens on `process.env.PORT`. Keep it that way: the auto-built
deploy image only runs `server.js`, so the production path must never depend on
the test tooling.

## File map

| File | Role |
| --- | --- |
| `server.js` | Static file server (entry point, `process.env.PORT`, path-traversal guarded). |
| `index.html` | DOM contract + canvas + controls + hidden state mirror. |
| `style.css` | Retro pixel styling (`image-rendering: pixelated`, limited palette). |
| `rng.js` | Seedable mulberry32 → `window.__rng` / `window.__setSeed`. |
| `input.js` | Input facade `Input.getVolume/getDirection/consumeJump`; manual slider/buttons/keys + optional Web-Audio mic. |
| `game.js` | Engine: state machine, fixed-timestep physics, camera, world gen, collision, rendering. |
| `tests/game.spec.js` | Playwright specs driven via the DOM + `window.__*` hooks. |
| `playwright.config.js` | Boots `node server.js` as the test `webServer`. |

## Invariants you MUST preserve

1. **The DOM is the source of truth, and it is written synchronously inside
   `physicsStep()`** (`game.js`) — never inside the `requestAnimationFrame`
   render callback. `render()` is read-only and must never mutate game state.
   This is what makes `game-status`/`score`/etc. current the instant an action
   fires, as the contract demands.
2. **`window.__testMode` is OFF by default.** When false, the rAF accumulator
   advances physics in real time (the live game). When a test sets it `true`,
   the accumulator is gated off and `window.__step(n)` becomes the *sole* physics
   advancer, so stepped ticks never interleave with real frames. Do **not**
   re-add `navigator.webdriver` auto-detection — an external Playwright grader
   would otherwise see a frozen game.
3. **All randomness goes through `window.__rng`** (world generation in
   `generateLevel`). Never call `Math.random()` in game logic.
4. **All timing/physics tunables live in `window.__config`** (see `DEFAULTS` in
   `game.js`). Tests override these; don't hard-code delays.
5. **`data-testid` values are a stable contract.** Renaming/removing one means
   updating `tests/game.spec.js` in the same change. CSS classes and `id`s may
   change freely.

## Test/debug hooks (exposed on `window`)

- `__setSeed(n)` — deterministic world.
- `__config` — `{ gravity, jumpImpulse, moveSpeedMax, jumpThreshold,
  branchSpacingV, branchOffsetX, branchWidth, nutsPerLevel, startLives, tickMs,
  followOffset }`.
- `__testMode = true` then `__step(n)` — advance exactly `n` physics ticks.
- `__setVolume(0..1)`, `__setDirection(-1|0|1|null)`, `__queueJump()`.
- `__game` — `{ getState(), player, nuts, cameraY }` (read/inspect live state).

## Mechanic & feel

Horizontal velocity = `direction × moveSpeedMax × min(1, volume / runThreshold)` (quiet = slow). A loud
peak crossing `jumpThreshold` (rising edge) — or the Jump button — launches a jump
only while grounded. Because speed and jump share the same loud volume, branch
spacing / `jumpImpulse` / `gravity` need joint tuning so landings stay achievable;
that's the hardest part of the feel and the main thing to tune. World-y grows
**upward** (0 = ground); the camera only scrolls up, so falling below the bottom
edge costs a life (respawn on the lowest visible branch, or Game Over at 0 lives).
