# ISSUES THAT HAVE TO BE ADDRESSED

> **Re-audited against the code on 2026-08-12.** Every box was unticked, including
> for features that had been finished weeks earlier — a roadmap nobody updates
> reads as a project that got nothing done. 25 items are now ticked.
>
> Each tick is backed by something in the tree (`grep` for the named symbol, file
> or `data-testid`), not by memory. Where the code and the item disagreed, the
> item stayed open: `ParticleSystem` for example is *not* ticked, because
> particles exist inside `Renderer.js` but the module the item asks for does not.
> Anything boss- or victory-related stayed open too — there is no `boss` anywhere
> in `js/`.
>
> The 14 still open are a fair picture of where the game stops: the lower forest
> is finished, the upper reaches are not.

## Existing Issues
 - [ ] Add proper hitboxes to roots
 - [ ] Fix discoloration of roots

## Phase 1: Home Screen Hub UI & Onboarding
 - [x] Implement `#home-screen` dialog menu in `index.html` with Adventure, Shrine, and Logbook tabs.
 - [x] Add control mode toggle UI element (Classic Keyboard vs. Voice Control).
 - [x] Build the interactive "Test Tube" calibration visualizer inside the Adventure tab.
 - [x] Style all HUD overlays using strictly retro colors (`#1a1c2c`, `#29366f`, `#f4b41b`) and thick box-shadows.
 - [x] Build the Base64 Save Export/Import UI in the Logbook.

## Phase 2: Input & Speedrun Movement Tech
 - [x] Implement Coyote Time (100ms window after leaving edge) in `input.js`.
 - [x] Implement Jump Buffering (150ms window before landing) in `input.js`.
 - [x] Implement Fast-Falling (pressing Down / low pitch multiplies gravity by 2.5x).
 - [ ] Implement Bark-Boosting (using Sonic Bark while aiming down boosts vertical velocity).

## Phase 3: Physics, Camera & Generation
 - [x] Implement the One-Way Ratchet Camera in `PhysicsEngine.js` (camera target follows player, but never moves down).
 - [x] Implement "Death by falling off-screen" logic when `player.y < camera.y`.
 - [x] Create the Chunk-based Platform Generator (600px chunks, max 80px horizontal / 120px vertical gaps).
 - [x] Spawn diegetic background tutorial signs in the first 50m.
 - [x] Implement 0.5s Invincibility Frames (i-frames) upon taking damage.
 - [ ] Implement Boss Arena Camera locks (invisible floor to prevent falling out).

## Phase 4: Visual Polish & "Juice" (Renderer.js)
 - [x] Implement Squash & Stretch scaling on jumps and landings.
 - [x] Implement Screenshake global context translations (triggered by fast-falls, damage, barks).
 - [ ] Build `ParticleSystem` for Jump Dust (white squares).
 - [ ] Build `ParticleSystem` for Death Pops (enemies explode into physics-enabled mini nuts).
 - [ ] Build `ParticleSystem` for Bark Shockwaves (expanding hollow circles).
 - [x] Render 3-layer Parallax Backgrounds moving at 0.1x, 0.3x, and 0.6x camera speeds.
 - [ ] Implement solid white Hit Flashes for enemies taking damage (using `source-atop`).

## Phase 5: Game Over, Victory & Meta-Progression
 - [x] Create `js/StatsManager.js` to handle `localStorage` saving/loading.
 - [x] Implement the Death Flow sequence (Knut turns into ghost, screen dims, summary banner drops).
 - [ ] Implement the Victory Flow sequence (Shatter animation, golden sky, final boss defeat summary).
 - [ ] Calculate Nut to Golden Acorn conversion on run end (10:1 ratio).
 - [x] Wire up the Shrine Upgrade buttons to permanently modify starting stats (Lives, Bark Radius, Magnet, Glide).

## Phase 6: Speedrun HUD & Splits
 - [x] Add pixel-art speedrun HUD timer display formatted as `MM:SS.CC`.
 - [ ] Save split time records when crossing world heights and display ahead/behind differentials.

## Phase 7: Audio & Advanced Physics Edge Cases
 - [x] Implement Enemy Edge Detection (raycast down/ahead) to reverse velocity before walking off platforms.
 - [ ] Implement Hit Stun vector knockback (`vx = ±4.0, vy = -5.0`) when player takes damage.
 - [x] Add HTML5 Audio hooks for Jump, Bark, Collect, Damage, and Squish SFX.
 - [ ] Implement dynamic stem-based background music tracks per World (Summer, Winter, Autumn, Celestial).
 - [ ] Implement final Score Calculation logic (`Distance/10 + Nuts*5 + Bosses*500`) at the end of runs.

## Phase 8: Pause Menu & Settings
 - [x] Add `ESC` key listener to toggle pause state and freeze physics loop.
 - [x] Implement `#pause-menu` overlay with heavy canvas blur effect (`filter: blur(8px)`) to prevent speedrun scumming.
 - [x] Build global Settings panel in the Home Screen for Master/Music/SFX/Mic sensitivity sliders.
