Plan: "Die Klangnüsse" — A Voice-Controlled Squirrel Tree-Climber

 Context

 We're building a browser platformer for the workshop's creative
 track. A squirrel
 climbs up a single tree, hopping between branches to chase nuts. The
 twist:
 movement is driven by the player's voice volume through the
 microphone —
 the louder you are, the faster the squirrel moves; a loud scream
 makes it jump;
 when you're quiet it creeps slowly. Left/Right arrow keys set the
 facing
 direction. The look is Shovel-Knight-style pixel art, drawn
 procedurally on a
 canvas (no external asset files).

 Two hard constraints shape every decision:

 1. CLAUDE.md (binding): game state must live as readable text in the
 DOM under
 fixed data-testids, every action needs a clickable button (no
 keyboard-only),
 randomness must be seedable, and timing must be configurable so
 Playwright can
 drive the game deterministically.
 2. README.md: server.js is the mandatory entry point, it must listen
 on
 process.env.PORT (default 3000), only package.json /
 package-lock.json /
 .gitignore are otherwise required, and every push to main
 auto-deploys to
 https://die-klangn-sse.workshop.heyclever.net.

 Because a microphone cannot be driven in automated tests, the mic is
 layered on
 top of a full on-screen control mirror (volume slider +
 jump/left/right buttons)
 plus window.__* test hooks. The game is 100% playable and testable
 without a mic;
 the mic is an optional enhancement.

 The reference implementation in the parent dir (../index.html,
 ../rng.js,
 ../game.js) establishes the conventions we'll mirror: canvas
 rendering + a hidden
 DOM "state mirror", a seedable RNG exposed on window, and on-screen
 buttons for
 every action.

 Confirmed design decisions

 - Volume → movement: horizontal walk speed scales continuously with
 loudness
 (quieter = slower); a loud peak above a threshold triggers a jump
 (only when
 grounded). Arrow keys L/R set direction only.
 - World: a vertical climber — inside/around one tree, scrolling
 upward.
 Branches are platforms; nuts sit on branches; reach the top / collect
 the section's
 nuts to advance a level. The camera only scrolls up; falling below
 the bottom edge
 costs a life.
 - Art: procedural canvas pixel art, limited Shovel-Knight palette,
 parallax
 background. No external/Kenney files.
 - Input: full on-screen mirror (slider + buttons) is the primary,
 testable path;
 mic is optional.

 Files

 All work happens in solution/. New/changed files:

 File: server.js
 Purpose: Rewrite the bare placeholder into a tiny static file server
   (vanilla http, no deps). Serves index.html, style.css, and the JS
   files; listens on process.env.PORT.
 ────────────────────────────────────────
 File: index.html
 Purpose: Game shell: canvas + the required data-testid DOM
   (status/score/lives/level), control buttons, volume slider + meter,

   and a hidden state-mirror block.
 ────────────────────────────────────────
 File: style.css
 Purpose: Shovel-Knight pixel styling: limited palette,
   image-rendering: pixelated, chunky retro UI, responsive layout.
 ────────────────────────────────────────
 File: rng.js
 Purpose: Seedable mulberry32 PRNG exposed as window.__rng /
   window.__setSeed (reuse the proven pattern from ../rng.js).
 ────────────────────────────────────────
 File: input.js
 Purpose: Input abstraction: unified getVolume() / getDirection() /
   consumeJump(); MicInput (Web Audio) + ManualInput
   (slider/buttons/keys); window.__setVolume / window.__setDirection
   test hooks.
 ────────────────────────────────────────
 File: game.js
 Purpose: Engine: state machine, fixed-timestep physics, camera,
   nut/branch generation, collision, procedural pixel rendering,
   synchronous DOM updates, window.__game / window.__config /
   window.__step hooks.
 ────────────────────────────────────────
 File: tests/game.spec.js
 Purpose: Playwright specs covering status transitions, scoring,
 lives,
   levels, button states, and seed determinism — all driven via the
   on-screen mirror + window hooks.
 ────────────────────────────────────────
 File: playwright.config.js
 Purpose: Boots node server.js as the test webServer.
 ────────────────────────────────────────
 File: package.json
 Purpose: Add @playwright/test devDependency and test script; keep
 zero
   runtime deps. Regenerate package-lock.json.

 Deploy safety: the production path stays dependent only on server.js
 + Node's
 vanilla http — zero runtime deps. @playwright/test is a devDependency
 and does
 not auto-download browsers (that needs an explicit npx playwright
 install), so a plain
 npm install during the auto-generated Docker build won't break the
 deploy. We'll keep
 the start/server path independent of the test tooling, and the real
 grading surface is
 the DOM contract (exact data-testids + the four exact status strings
 + synchronous
 updates), so contract exactness is prioritized over our own test
 suite.

 DOM contract (index.html)

 Required by CLAUDE.md — exact ids, unique, text-based:

 - data-testid="game-status" → exactly one of Ready / Running / Paused
 / Game Over.
 - data-testid="score", lives, level → bare integers.
 - data-testid="btn-start", btn-pause, btn-reset → real <button>s;
 disabled
 attribute reflects availability (e.g. pause disabled when not
 Running).

 Action mirror (so nothing is keyboard/mic-only):

 - data-testid="btn-left", btn-right → hold-to-move direction.
 - data-testid="btn-jump" → triggers a jump (same code path as a loud
 peak).
 - data-testid="volume-input" → <input type="range" min="0"
 max="100">; sets the
 manual volume. The real on-screen control tests can drive.
 - data-testid="volume-meter" → live numeric current volume (0–100),
 updated each
 frame; visually a bar, but the text node carries the number.

 Hidden state mirror (for assertions, mirrors the canvas):

 - data-testid="player" with data-x / data-y (world coords) + a
 player-grounded
 flag, data-testid="nut-count", and individually addressable nut-1,
 nut-2, …
 carrying their world positions. Updated synchronously alongside the
 canvas.

 Game engine (game.js)

 State machine. Ready → Running → (Paused ⇄ Running) → Game Over →
 (Reset) Ready.
 A single setState() writes the game-status text synchronously and
 toggles
 button disabled states, before any animation frame runs.

 Loop & timing. requestAnimationFrame drives rendering; physics runs
 on a
 fixed timestep accumulator with tickMs from window.__config (default
 ~16ms).
 Expose window.__step(n) to advance exactly n physics ticks with no
 real time
 elapsed — this is how Playwright steps deterministically. All
 tunables
 (gravity, jumpThreshold, jumpImpulse, moveSpeedMax, scrollSpeed,
 nutsPerLevel, tickMs) live in window.__config.

 Simulation/render split (critical for testability). Physics and
 rendering are
 strictly separated. A window.__testMode (auto-on under Playwright, or
 set explicitly)
 gates the rAF physics accumulator off so __step(n) is the sole
 advancer of the
 simulation — otherwise real-time frames interleave with stepped ticks
 and every
 position assertion goes flaky. The rAF callback then does rendering
 only. The DOM
 state-mirror writes (player x/y, grounded, nut-count,
 score/lives/level, status) all
 happen inside the physics step, never inside the render callback — so
 the moment
 __step(n) returns (or any action fires), the DOM is already current,
 satisfying
 CLAUDE.md's "MUST update synchronously, before any animation
 completes" rule.

 Physics & input mapping.
 - Direction d ∈ {-1,0,1} from getDirection().
 - volume ∈ [0,1] from getVolume().
 - Horizontal velocity = d * moveSpeedMax * volume → quiet = slow,
 loud = fast.
 - Jump: consumeJump() returns a rising-edge true when volume crosses
 jumpThreshold (or the Jump button is pressed); applies jumpImpulse
 only when
 grounded.
 - Feel-tuning note: because the confirmed mapping couples both
 horizontal speed
 and the jump trigger to the same loud volume, every jump launches at
 near-max
 horizontal speed (and creeping quietly can't jump). That's the chosen
 design — but
 jumpImpulse, gravity, branch spacing and a bit of mid-air control
 will need tuning
 so landing on a specific branch stays achievable. This is the hardest
 part of the
 game feel and gets an explicit tuning pass.
 - Gravity integrates vertical velocity each tick; landing on a branch
 sets grounded.

 Camera / climbing. Camera tracks the squirrel's highest reached Y and
 only moves
 up. World is taller than the viewport. If the squirrel falls below
 the camera's bottom
 edge → lose a life, respawn on the last safe branch (or Game Over at
 0 lives).

 World generation. rng places branches (left/right of the trunk) and
 one nut per
 branch up the tree, nutsPerLevel per level. Same seed ⇒ identical
 layout. Collecting
 a nut increments score; collecting the level's nuts (or topping the
 tree) increments
 level and generates a taller/harder section.

 Rendering (procedural pixel art). A limited Shovel-Knight palette
 (NES-ish, ~12
 colors). Sprites drawn as scaled pixel blocks: squirrel
 (idle/run/jump frames, bushy
 tail), acorn nuts, bark-textured trunk, branch platforms, parallax
 background (sky
 gradient + distant foliage layers). image-rendering: pixelated,
 integer scaling for
 crisp chunky pixels. Rendering is never the source of truth — the DOM
 mirror always
 leads.

 Input layer (input.js)

 A single Input facade the engine reads each tick:
 - ManualInput (always active, testable): volume-input slider →
 volume;
 btn-left/btn-right + ArrowLeft/ArrowRight (held) → direction;
 btn-jump +
 optional key → jump edge. window.__setVolume(0..1) /
 window.__setDirection(-1..1)
 override for tests.
 - MicInput (optional): on user gesture, getUserMedia({audio}) →
 AnalyserMode
 RMS → smoothed, normalized volume that drives the same volume value
 (and moves
 the on-screen meter). A "🎤 Enable mic" button requests permission;
 failure/denial
 silently falls back to manual. Mic never blocks gameplay or tests.

 server.js

 Replace the placeholder with a minimal static server: resolve the
 request path against
 solution/, default / → index.html, send correct Content-Type for
 .html/.css/.js, 404 otherwise, guard against path traversal. Vanilla
 http, no
 dependencies, server.listen(process.env.PORT || 3000, '0.0.0.0').

     .html/.css/.js, 404 otherwise, guard against path traversal.
     Vanilla http, no
     dependencies, server.listen(process.env.PORT || 3000, '0.0.0.0').
 
     Tests (tests/game.spec.js + playwright.config.js)

     playwright.config.js starts node server.js as webServer. Specs
     (deterministic via
     __setSeed + __setVolume/__setDirection + __step):
 
     1. Loads in Ready; pause disabled.
     2. btn-start → Running; pause enabled, start disabled.
     3. btn-pause ⇄ resume toggles Paused/Running.
     4. Set volume + direction + __step until a nut is reached → score
     increments and
     the matching nut-* disappears.
     5. Loud volume → jump (player data-y rises while grounded flag
     cycles). 
     6. Falling below camera → lives decrements; at 0 → Game Over.
     7. Collecting nutsPerLevel nuts → level increments.
     8. Same seed ⇒ identical first-nut positions (determinism).
     9. btn-reset → back to Ready, score/lives/level reset.
 
     Verification (manual)     
 
     cd solution               
     npm install
     PORT=3000 node server.js      # open http://localhost:3000
     npx playwright install        # first run only
     npm test                      # runs tests/game.spec.js headless
 
     Manual smoke: Start → hold Right + drag the volume slider up
     (squirrel speeds up) →
     push slider to max or hit Jump (squirrel hops to a branch) → grab
     a nut (score ++) →
     keep climbing (camera scrolls up, level advances) → fall off
     bottom (lives --) →
     Reset. Optionally click "Enable mic" and confirm the meter reacts
     to your voice.
 
     Out of scope (call out before building)

     - Audio/music & sound effects (could be a follow-up).
     - Mobile touch tuning beyond basic responsive layout.
     - Persisted high scores.