# ISSUES THAT HAVE TO BE ADDRESSED

## Existing Issues
 - [ ] Add proper hitboxes to roots
 - [ ] Fix discoloration of roots

## Phase 1: Home Screen Hub UI & Onboarding
 - [ ] Implement `#home-screen` dialog menu in `index.html` with Adventure, Shrine, and Logbook tabs.
 - [ ] Add control mode toggle UI element (Classic Keyboard vs. Voice Control).
 - [ ] Build the interactive "Test Tube" calibration visualizer inside the Adventure tab.
 - [ ] Style all HUD overlays using strictly retro colors (`#1a1c2c`, `#29366f`, `#f4b41b`) and thick box-shadows.
 - [ ] Build the Base64 Save Export/Import UI in the Logbook.

## Phase 2: Input & Speedrun Movement Tech
 - [ ] Implement Coyote Time (100ms window after leaving edge) in `input.js`.
 - [ ] Implement Jump Buffering (150ms window before landing) in `input.js`.
 - [ ] Implement Fast-Falling (pressing Down / low pitch multiplies gravity by 2.5x).
 - [ ] Implement Bark-Boosting (using Sonic Bark while aiming down boosts vertical velocity).

## Phase 3: Physics, Camera & Generation
 - [ ] Implement the One-Way Ratchet Camera in `PhysicsEngine.js` (camera target follows player, but never moves down).
 - [ ] Implement "Death by falling off-screen" logic when `player.y < camera.y`.
 - [ ] Create the Chunk-based Platform Generator (600px chunks, max 80px horizontal / 120px vertical gaps).
 - [ ] Spawn diegetic background tutorial signs in the first 50m.
 - [ ] Implement 0.5s Invincibility Frames (i-frames) upon taking damage.
 - [ ] Implement Boss Arena Camera locks (invisible floor to prevent falling out).

## Phase 4: Visual Polish & "Juice" (Renderer.js)
 - [ ] Implement Squash & Stretch scaling on jumps and landings.
 - [ ] Implement Screenshake global context translations (triggered by fast-falls, damage, barks).
 - [ ] Build `ParticleSystem` for Jump Dust (white squares).
 - [ ] Build `ParticleSystem` for Death Pops (enemies explode into physics-enabled mini nuts).
 - [ ] Build `ParticleSystem` for Bark Shockwaves (expanding hollow circles).
 - [ ] Render 3-layer Parallax Backgrounds moving at 0.1x, 0.3x, and 0.6x camera speeds.
 - [ ] Implement solid white Hit Flashes for enemies taking damage (using `source-atop`).

## Phase 5: Game Over, Victory & Meta-Progression
 - [ ] Create `js/StatsManager.js` to handle `localStorage` saving/loading.
 - [ ] Implement the Death Flow sequence (Knut turns into ghost, screen dims, summary banner drops).
 - [ ] Implement the Victory Flow sequence (Shatter animation, golden sky, final boss defeat summary).
 - [ ] Calculate Nut to Golden Acorn conversion on run end (10:1 ratio).
 - [ ] Wire up the Shrine Upgrade buttons to permanently modify starting stats (Lives, Bark Radius, Magnet, Glide).

## Phase 6: Speedrun HUD & Splits
 - [ ] Add pixel-art speedrun HUD timer display formatted as `MM:SS.CC`.
 - [ ] Save split time records when crossing world heights and display ahead/behind differentials.

## Phase 7: Audio & Advanced Physics Edge Cases
 - [ ] Implement Enemy Edge Detection (raycast down/ahead) to reverse velocity before walking off platforms.
 - [ ] Implement Hit Stun vector knockback (`vx = ±4.0, vy = -5.0`) when player takes damage.
 - [ ] Add HTML5 Audio hooks for Jump, Bark, Collect, Damage, and Squish SFX.
 - [ ] Implement dynamic stem-based background music tracks per World (Summer, Winter, Autumn, Celestial).
 - [ ] Implement final Score Calculation logic (`Distance/10 + Nuts*5 + Bosses*500`) at the end of runs.

## Phase 8: Pause Menu & Settings
 - [ ] Add `ESC` key listener to toggle pause state and freeze physics loop.
 - [ ] Implement `#pause-menu` overlay with heavy canvas blur effect (`filter: blur(8px)`) to prevent speedrun scumming.
 - [ ] Build global Settings panel in the Home Screen for Master/Music/SFX/Mic sensitivity sliders.
