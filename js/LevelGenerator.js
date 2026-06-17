import { GameState } from './GameState.js';
import { cfg, W, cameraOffX } from './Config.js';
import { updateThemeClass, updateThemeColors, syncDOM, buildNutDOM } from './DOMUpdater.js';
import { EnemyFactory } from './EnemyFactory.js';


export function generateLevel() {
  const c = cfg();
  const isNewGame = !GameState.game.branches || GameState.game.branches.length === 0;

  if (isNewGame) {
    GameState.game.branches = [];
    GameState.game.nuts = [];
    GameState.game.enemies = [];
    GameState.game.particles = [];
    // Ground platform spanning the floating island width (centered).
    GameState.game.branches.push({ x: 44, w: 392, top: 40, ground: true });
  }

  const numNuts = c.nutsPerLevel + (GameState.game.level - 1);
  const spacingY = Math.min(110, c.branchSpacingV + (GameState.game.level - 1) * 2);

  let nutIdCounter = isNewGame ? 1 : (GameState.game.nuts.length > 0 ? GameState.game.nuts[GameState.game.nuts.length - 1].id + 1 : 1);
  let startY = isNewGame ? 40 : GameState.game.topY;
  GameState.game.levelStartY = startY;

  if (GameState.game.level === 2 && !GameState.game.level2StartY) {
    GameState.game.level2StartY = startY;
  }
  
  const tutorialLines = [
    ["Welcome", "to the", "Climb"],
    ["Sing", "to jump", "higher"],
    ["Drop pitch", "to fast", "fall"]
  ];
  let signsPlaced = GameState.game.signs ? GameState.game.signs.length : 0;

  for (let i = 0; i < numNuts; i++) {
    const top = startY + (i + 1) * spacingY;
    
    const numPlatforms = window.__rng.next() < 0.5 ? 1 : 2;
    const leftOptions = [1, 2];
    const rightOptions = [3, 4];
    let selectedOptions = [];

    if (c.branchOffsetX === 0) {
      // If branchOffsetX is 0 (test layout), force a trunk-centered platform so player can jump straight up to it.
      selectedOptions.push(window.__rng.next() < 0.5 ? 2 : 3);
    } else if (numPlatforms === 1) {
      const allOptions = [1, 2, 3, 4];
      selectedOptions.push(allOptions[Math.floor(window.__rng.next() * 4)]);
    } else {
      selectedOptions.push(leftOptions[Math.floor(window.__rng.next() * 2)]);
      selectedOptions.push(rightOptions[Math.floor(window.__rng.next() * 2)]);
    }

    for (const opt of selectedOptions) {
      let type = 3;
      if (c.branchOffsetX !== 0) {
        if (opt === 2 || opt === 3) {
          type = 3; // Stem branches are always green
        } else {
          type = window.__rng.next() < 0.5 ? 3 : 5; // Outside can be green or dark
        }
      }
      let branchWidth;
      if (GameState.game.level >= 2) {
        // Winter branches (branche-left.gif, branche-right.gif) are much smaller natively
        branchWidth = type === 3 ? 47 : 57;
      } else {
        // Summer branches
        branchWidth = type === 3 ? 100 : 133;
      }
      let bx, pointsRight;

      if (type === 3) {
        // Green leafy branch
        if (opt === 1) { // Left wall
          bx = cameraOffX - 20;
          pointsRight = true;
        } else if (opt === 2) { // Trunk left
          bx = W / 2 - c.branchOffsetX - branchWidth / 2;
          pointsRight = false;
        } else if (opt === 3) { // Trunk right
          bx = W / 2 + c.branchOffsetX - branchWidth / 2;
          pointsRight = true;
        } else { // Right wall
          bx = W - cameraOffX - branchWidth + 20;
          pointsRight = false;
        }
      } else {
        // Dark bare branch
        if (opt === 1) { // Left wall (moved further to border)
          bx = cameraOffX - 45;
          pointsRight = false; // Flipped because asset base is on the right
        } else if (opt === 2) { // Trunk left (moved closer to middle)
          bx = W / 2 - c.branchOffsetX - branchWidth / 2 + 20;
          pointsRight = true;  // Not flipped, base stays on the right
        } else if (opt === 3) { // Trunk right (moved closer to middle)
          bx = W / 2 + c.branchOffsetX - branchWidth / 2 - 20;
          pointsRight = false; // Flipped, base moves to the left
        } else { // Right wall (moved further to border)
          bx = W - cameraOffX - branchWidth + 45;
          pointsRight = true;  // Not flipped, base stays on the right
        }
      }

      const branch = { x: bx, w: branchWidth, top: top, type: type, pointsRight: pointsRight };
      
      GameState.game.branches.push(branch);
      
      if (GameState.game.level === 1 && signsPlaced < tutorialLines.length) {
        if (opt === selectedOptions[0]) {
          GameState.game.signs.push({
            lines: tutorialLines[signsPlaced],
            x: bx + branchWidth / 2,
            y: top - 45 // hang perfectly touching the branch bottom
          });
          signsPlaced++;
        }
      }
      
      const cx = bx + branchWidth / 2;
      const isHeart = (nutIdCounter > 1) && (window.__rng.next() < 0.10);
      GameState.game.nuts.push({ x: cx, y: top + 16, collected: false, id: nutIdCounter++, isHeart: isHeart });

      const enemySpawnChance = Math.min(0.8, 0.4 + (GameState.game.level - 1) * 0.15);
      if (window.__rng.next() < enemySpawnChance) {
        const enemy = EnemyFactory.createRandomEnemy(
          cx,
          top,
          GameState.game.level,
          branch.x + 16,
          branch.x + branch.w - 16,
          window.__rng
        );
        GameState.game.enemies.push(enemy);
      }
    }
  }
  GameState.game.topY = startY + numNuts * spacingY;
  buildNutDOM();
}

export function placePlayerStart() {
  GameState.player.x = W / 2;
  GameState.player.y = 40;
  GameState.player.vx = 0;
  GameState.player.vy = 0;
  GameState.player.grounded = true;
  GameState.player.facing = 1;
  GameState.player.lastSafe = { x: GameState.player.x, y: GameState.player.y };
  GameState.player.isVoiceJumping = false;
  GameState.player.airVx = 0;
  GameState.player.hurtTimer = 0;
  GameState.cameraY = 0;
}

export function newGame() {
  if (window.__rng) {
    window.__rng.setSeed(window.__rng.seed);
  }
  GameState.game = { score: 0, lives: Math.min(3, cfg().startLives), level: 1, enemies: [], particles: [], floatingTexts: [], signs: [], levelUpTimer: 0 };
  
  generateLevel();
  placePlayerStart();
  updateThemeClass();
  updateThemeColors();
  syncDOM();
}

export function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    GameState.game.particles.push({
      x: x, y: y,
      vx: (window.__rng.next() - 0.5) * 4,
      vy: (window.__rng.next() - 0.2) * 4,
      color: color,
      size: window.__rng.next() * 3 + 2,
      life: 20
    });
  }
}

export function spawnHeartParticles(x, y) {
  for (let i = 0; i < 15; i++) {
    GameState.game.particles.push({
      x: x, y: y,
      vx: (window.__rng.next() - 0.5) * 3,
      vy: (window.__rng.next() * 2 + 1), // fountain burst upwards
      color: window.__rng.next() < 0.75 ? GameState.themeColors.heartColor : GameState.themeColors.heartHighlight,
      size: window.__rng.next() * 3 + 2,
      life: 25 + Math.floor(window.__rng.next() * 15)
    });
  }
}

export function spawnFloatingText(x, y, text) {
  if (!GameState.game.floatingTexts) GameState.game.floatingTexts = [];
  GameState.game.floatingTexts.push({
    x: x,
    y: y,
    text: text,
    vy: 1.0, // floats upward in world coordinates
    life: 30,
    maxLife: 30
  });
}
