# Design & Architectural Decisions
## Die Klangnüsse: Symphony of the Forest

This document serves as the master record of all core architectural, aesthetic, and mechanic design decisions finalized during the collaborative planning process. It acts as the single source of truth for "why" the game is built the way it is.

---

## 1. Aesthetic Direction (Retro Pixel Art)
* **Decision**: The user interface and game world must strictly adhere to the existing retro arcade aesthetic.
* **Constraints**:
  - **No glassmorphism, no backdrop blurs, and no modern gradients**.
  - All panels must use the solid retro colors (`#1a1c2c`, `#29366f`, `#f4b41b`).
  - Borders must be boxy (thick 4px solid strokes).
  - Heavy offset drop-shadows (`box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.8)`).
  - All text must use the `Press Start 2P` font.

## 2. World Transitions
* **Decision**: Intermediate loading screens between seasonal canopy worlds are completely omitted.
* **Reasoning**: The game emphasizes continuous flow and speedrunning. Breaking the climb with a loading screen disrupts momentum.
* **Implementation**: Environmental visuals, background layers, and hazards shift dynamically in real-time as the player's Y-coordinate crosses height boundaries (150m, 300m, 450m).

## 3. The Camera "Death Wall" Architecture
* **Decision**: The camera operates on a One-Way Ratchet system.
* **Reasoning**: To enforce upward momentum and add tension, the camera follows Knut upwards but **never moves downwards**.
* **Implementation**: If Knut's Y position falls below the camera's bottom edge, he instantly triggers the Death Flow. 

## 4. Procedural Platform Generation
* **Decision**: Platforms are generated in "Chunks" of 600px rather than fully infinite single-platform spawns.
* **Constraints**: 
  - The maximum horizontal gap is fixed at 80px.
  - The maximum vertical gap is fixed at 120px (Knut's max jump height).
* **Reasoning**: This guarantees that the procedural generation never creates an unsolvable "dead end" that frustrates speedrunners.

## 5. Diegetic Onboarding & Tutorials
* **Decision**: No intrusive tutorial pop-ups or "click to continue" text boxes during gameplay.
* **Implementation**: 
  - **Hub Calibration**: Players test their microphone in a safe "Test Tube" visualizer on the Home Screen.
  - **Diegetic Signs**: In the first 50m of the climb, control instructions are carved natively into the pixel-art background trees. 

## 6. Visual Polish & "Juice"
* **Decision**: Implement heavy micro-interactions to make the physics engine feel tactile and weighty.
* **Components**:
  - **Squash & Stretch**: Sprite scaling on jumps and landings.
  - **Particles**: Jump dust, shockwaves, and "Death Pops" (enemies explode into physics-enabled mini-nuts).
  - **Screenshake**: Mapped to canvas translations (2px for landings, 8px for damage).
  - **Parallax**: 3 distinct background layers scrolling at 0.1x, 0.3x, and 0.6x camera speeds.

## 7. Advanced Speedrun Movement Tech
* **Decision**: Introduce deep movement mechanics to raise the skill ceiling.
* **Mechanics**:
  - **Coyote Time (100ms)**: Jump buffering after walking off ledges.
  - **Jump Buffering (150ms)**: Queueing jumps before hitting the ground.
  - **Bark-Boosting**: Rocket jumping using the sonic bark aimed downwards.
  - **Fast-Falling**: Applying a 2.5x gravity multiplier when pitching low or pressing down.

## 8. Enemy AI Edge Detection
* **Decision**: Enemies (like ants) must not walk off ledges and kill themselves.
* **Reasoning**: Enemies are worth points. If they fall off-screen on their own, the player is robbed of potential score.
* **Implementation**: Enemies use a raycast 5px ahead and down to detect ledges and instantly reverse velocity.

## 9. Hit Stun & Knockback
* **Decision**: Damage should punish positioning, not just subtract a heart.
* **Implementation**: When taking damage, Knut is knocked back with a fixed velocity vector (`vx = ±4.0, vy = -5.0`) and suffers a 200ms input freeze (Hit Stun) with 0.5s of Invincibility Frames.

## 10. Audio & Sound Design
* **Decision**: A voice-controlled game requires extreme audio feedback.
* **Implementation**: 
  - Distinct SFX for Jumps, Barks, Damage, and Collectibles. 
  - Stem-based dynamic music that adds new instruments as the player reaches higher seasons.

## 11. Speedrun Integrity & Pause Menu
* **Decision**: The game can be paused, but cannot be exploited.
* **Implementation**: Pressing ESC pauses the speedrun timer and physics loop, but heavily blurs the screen (`filter: blur(8px)`). This prevents players from pausing to study the platform layout and plan their next jump.

## 12. Run Mechanics, Currency, and Save State
* **Currencies**: Nuts are active ammo (cost 1 per Bark). Golden Acorns are meta-currency (converted at 10:1 ratio upon run end).
* **Save System**: Uses `StatsManager` to serialize to `localStorage`.
* **Exporting**: To prevent data loss from browser cache clears, a Base64 Save String Export/Import tool is provided in the Logbook tab.
