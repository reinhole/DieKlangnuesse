# Architecture — Die Klangnüsse

Engine internals for `game.js`, the parts that aren't already covered by the
contract docs. **This file deliberately does NOT restate the rules** in
[`../../CLAUDE.md`](../../CLAUDE.md) (the binding DOM-testability contract) or
[`../CLAUDE.md`](../CLAUDE.md) (the engine invariants). Read those first; this
is the map for the territory underneath them.

## The loop: physics vs. render

```
requestAnimationFrame(loop)
  ├─ if !__testMode:  accumulate wall-clock dt, run physicsStep() in
  │                   fixed tickMs slices (the live game)
  └─ render()         read-only draw of the current state
```

- **`physicsStep()` is the only function that mutates game state**, and it writes
  the DOM (`syncDOM()`) synchronously at the end of every tick. This is what
  makes `game-status`/`score`/… current the instant an action fires.
- **`render()` never mutates state.** It owns a separate `renderTick` counter so
  sprite animation keeps playing even while `Ready`/`Paused` (when physics is
  frozen).
- In tests, `__testMode = true` gates the accumulator off and `__step(n)` becomes
  the sole physics advancer — stepped ticks never interleave with real frames.

## Coordinate system

Two y-axes, do not mix them up:

- **World-y grows UP.** `y = 0` is the ground; branches and the player climb to
  larger y. Velocities follow suit: `vy > 0` is rising, gravity *subtracts* from
  `vy`.
- **Screen-y grows DOWN** (canvas convention). The single bridge is
  `toScreenY(worldY) = VH - (worldY - cameraY)`.

Sizing constants: the canvas is `480×640`, rendered at `ZOOM = 1.5`, so the
visible world box is `W=480 × VH=427`. `cameraOffX = 80` crops the sides to
centre the trunk; render translates by `-cameraOffX` after drawing the parallax
background so the background spans the full canvas while the world is inset.

## Camera

`cameraY` is the world-y shown at the **bottom** edge of the viewport, and it
**only ratchets upward**:

- Target is `player.y - followOffset` (keep the squirrel ~200 world units above
  the bottom). Rising: ease toward it (`cameraY = cameraY*0.85 + target*0.15`).
  Falling target: drift down slowly, clamped (`max(cameraY - 4, target)`).
- **Falling below `cameraY` costs a life** (`player.y < cameraY`). That's the
  core risk: the camera leaves the floor behind, so dropping off the bottom is
  fatal. `respawn()` puts the player on the lowest branch still in view to avoid
  a death loop.

## World generation (`generateLevel`)

Driven entirely by `window.__rng` (never `Math.random()`), so a seed fully
determines the world. Per nut row it picks 1–2 branch "slots" (left wall / trunk
-left / trunk-right / right wall), assigns a branch sprite (green `branch3` or
bare dark `branch5`), drops a nut on top, and rolls an enemy
(ant / gator / grasshopper) against a level-scaled spawn chance. `branchOffsetX:
0` is the test layout: it forces a trunk-centred branch straight above spawn.

## Input facade (`input.js`)

The engine only ever reads `Input.getVolume()` / `getDirection()` /
`consumeJump()`. Two sources feed the same values so the game plays identically
with or without hardware:

- **Manual** (always on, fully testable): volume slider, on-screen buttons,
  arrow keys, and the `__set*`/`__queueJump` hooks.
- **Mic** (optional): `getUserMedia` + Web Audio RMS loudness, smoothed, mapped
  to `[0,1]`. Layered via `max(micVolume, manualVolume)`. Tests never touch it.

"Loud peak = jump" is a **rising-edge** detector on `volume ≥ jumpThreshold`;
the button/key/hook path sets a one-shot `jumpQueued`. The engine still gates the
actual jump on `player.grounded`.

## Audio (`AudioController` in `game.js`)

Plain `<audio>` elements, no Web Audio for playback. BGM loops; SFX play via
`cloneNode()` so overlapping triggers don't cut each other off. Autoplay is
blocked until a user gesture, so `playBGM()` retries on the first
click/keydown/touch. **Asset MIME types matter:** `server.js` must serve `.m4a`
as `audio/mp4` or Safari silently refuses the bgm (see the `TYPES` map there).

## Asset pipeline

Sprites/sounds are loaded from `Sunny-land-woods-files/Assets/...` via
`loadSprites()` into the `imgs` map. Every draw path has a **procedural pixel-art
fallback** that runs until an image reports `complete && naturalWidth`, so the
game is fully playable (and the contract holds) before — or without — any asset
loading.

### ⚠️ Winter assets are referenced but not in the repo

When `score >= 30`, an `imgs` `Proxy` swaps in a winter tileset/branches from
`/sunnyland winter forest files/ENVIRONMENT/…`. **That directory is not present
locally.** The Proxy checks `complete && naturalWidth` and silently falls back to
the base (summer) sprites, so nothing breaks — but the winter transition is a
no-op until those assets are added. If you intend the winter theme to show, add
that asset folder; if not, the swap code is dead and can be removed.

## Known deviations from the binding contract

- **No `btn-start`.** [`../../CLAUDE.md`](../../CLAUDE.md) lists Start as a
  required button, but this build auto-starts into `Running` (the "removed start"
  commit) and exposes only Pause/Reset. The test suite and
  `scripts/check-contract.js` are aligned with that choice. If an external grader
  asserts on `btn-start`, this is the gap to close.

## Fast local checks

```bash
npm run check   # zero-dep scan: required data-testids present & unique
npm test        # full Playwright suite (needs: npx playwright install chromium)
```

`npm run check` also runs automatically after edits via the `PostToolUse` hook in
[`../.claude/settings.json`](../.claude/settings.json).
