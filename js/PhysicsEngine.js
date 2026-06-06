import { GameState, clamp } from './GameState.js';
import { cfg, W, cameraOffX, VH } from './Config.js';
import { audio } from './AudioController.js';
import { generateLevel, spawnParticles, spawnFloatingText, spawnHeartParticles } from './LevelGenerator.js';
import { setState, syncDOM } from './DOMUpdater.js';
import { getSurfaceY, checkAABBCentered, getPlatformLandingY } from './PhysicsUtils.js';

export function physicsStep() {
  if (GameState.state !== "Running") return;
  const c = cfg();
  GameState.frameCount++;

  if (GameState.player.hurtTimer > 0) GameState.player.hurtTimer--;
  if (GameState.game.levelUpTimer > 0) GameState.game.levelUpTimer--;

  if (GameState.game.pendingLevelUp) {
    if (GameState.game.pendingLevelUp === 2) {
      if (GameState.game.level2StartY !== undefined && GameState.player.y >= GameState.game.level2StartY) {
        GameState.game.levelUpTimer = 90;
        GameState.game.pendingLevelUp = 0;
      }
    } else {
      GameState.game.levelUpTimer = 90;
      GameState.game.pendingLevelUp = 0;
    }
  }

  const d = window.Input.getDirection();
  let vol = window.Input.getVolume();
  if (window.Input.isMicActive && !window.Input.isMicActive() && window.Input.isKeyboardMoving && window.Input.isKeyboardMoving()) {
    vol = 1.0;
  }
  const runVol = Math.min(1, vol / (c.runThreshold != null ? c.runThreshold : 0.4));

  // Horizontal speed logic:
  if (window.Input.isCrouchHeld()) {
    GameState.player.vx = d * (c.moveSpeedMax * 0.3) * runVol;
    GameState.player.airVx = GameState.player.vx;
  } else if (!GameState.player.grounded && GameState.player.isVoiceJumping) {
    if (d !== 0) {
      GameState.player.vx = d * c.moveSpeedMax * runVol;
    } else {
      GameState.player.vx = GameState.player.airVx;
    }
  } else {
    GameState.player.vx = d * c.moveSpeedMax * runVol;
  }

  GameState.player.x = clamp(GameState.player.x + GameState.player.vx, cameraOffX + GameState.player.w / 2, W - cameraOffX - GameState.player.w / 2);
  if (d !== 0) GameState.player.facing = d;

  // Loud peak (or Jump button) launches a jump, only when grounded.
  if (window.Input.consumeJump() && GameState.player.grounded) {
    const jumpInfo = window.Input.lastJumpInfo || { source: "manual", volume: 0.5 };
    if (jumpInfo.source === "voice" && !(window.__testMode && d === 0)) {
      const threshold = c.jumpThreshold;
      const normVol = (jumpInfo.volume - threshold) / (1.0 - threshold || 0.1);
      const boost = 0.8 + 0.6 * normVol; // 0.8 to 1.4
      GameState.player.vy = c.jumpImpulse * boost;

      // Jump in the direction player is facing.
      const jumpDirection = GameState.player.facing;
      const horizBoost = 0.6 + 0.8 * normVol; // 0.6 to 1.4
      GameState.player.airVx = jumpDirection * c.moveSpeedMax * horizBoost;
      GameState.player.isVoiceJumping = true;
      
    } else {
      GameState.player.vy = c.jumpImpulse;
      GameState.player.airVx = 0;
      GameState.player.isVoiceJumping = false;
    }
    GameState.player.grounded = false;
    audio.playSFX('jump');
    spawnParticles(GameState.player.x, GameState.player.y, 6, '#8a5a2e');
  }

  // Height based leveling
  if (GameState.game.topY && GameState.player.y > GameState.game.topY - 800) {
    GameState.game.level++;
    GameState.game.pendingLevelUp = GameState.game.level;
    generateLevel(); 
  }

  // Gravity + vertical integration (world-y up is positive) with tail glide support.
  const isGliding = !GameState.player.grounded && GameState.player.vy < 0 && window.Input.isJumpHeld();
  GameState.player.vy -= isGliding ? (c.gravity * 0.3) : c.gravity;
  const prevY = GameState.player.y;
  GameState.player.y += GameState.player.vy;

  // Emit glide particles
  if (isGliding && GameState.frameCount % 3 === 0 && GameState.game.particles) {
    GameState.game.particles.push({
      x: GameState.player.x - GameState.player.facing * 10,
      y: GameState.player.y + 10,
      vx: -GameState.player.facing * 0.5 + (window.__rng.next() - 0.5) * 0.5,
      vy: (window.__rng.next() - 0.2) * 0.5,
      color: '#a4632c',
      size: window.__rng.next() * 2 + 1,
      life: 15
    });
  }

  // One-way platform landing: only when descending and crossing a branch top.
  const wasGrounded = GameState.player.grounded;
  GameState.player.grounded = false;
  if (GameState.player.vy <= 0) {
    const landingY = getPlatformLandingY(
      GameState.player.x, GameState.player.w, GameState.player.y, prevY,
      wasGrounded, window.Input.isCrouchHeld(), GameState.game.branches
    );
    
    if (landingY !== null) {
      GameState.player.y = landingY;
      GameState.player.vy = 0;
      GameState.player.grounded = true;
      GameState.player.lastSafe = { x: GameState.player.x, y: landingY };
      GameState.player.isVoiceJumping = false;
      GameState.player.airVx = 0;
    }
  }

  // Enemy movement and collision
  if (GameState.game.enemies) {
    for (let idx = GameState.game.enemies.length - 1; idx >= 0; idx--) {
      const e = GameState.game.enemies[idx];
      const effectiveMinX = Math.max(e.minX, cameraOffX + e.w / 2);
      const effectiveMaxX = Math.min(e.maxX, W - cameraOffX - e.w / 2);
      e.x += e.vx * e.facing;
      if (e.x <= effectiveMinX) {
        e.x = effectiveMinX;
        e.facing = 1;
      } else if (e.x >= effectiveMaxX) {
        e.x = effectiveMaxX;
        e.facing = -1;
      }
      const animSpeed = e.animSpeed !== undefined ? e.animSpeed : 0.15;
      const maxFrames = e.maxFrames !== undefined ? e.maxFrames : 8;
      e.animFrame = (e.animFrame + animSpeed) % maxFrames;

      // Snap enemy to the precise multi-segment surface
      const surfaceY = getSurfaceY(e.x, e.y, GameState.game.branches);

      if (GameState.player.hurtTimer <= 0 && GameState.state === "Running") {
        const isOverlap = checkAABBCentered(
          GameState.player.x, GameState.player.y + GameState.player.h / 2, GameState.player.w, GameState.player.h,
          e.x, surfaceY + e.h / 2, e.w, e.h,
          4, 2
        );

        if (isOverlap) {
          const isSquish = GameState.player.vy < 0 && prevY >= surfaceY + e.h - 6;
          if (isSquish || GameState.player.invincible) {
            GameState.game.enemies.splice(idx, 1);
            audio.playSFX('enemyDeath');
            GameState.player.vy = c.jumpImpulse * 0.7;
            GameState.game.score++;
            spawnParticles(e.x, surfaceY + e.h / 2, 12, e.particleColor || '#b5432f');
            spawnFloatingText(e.x, surfaceY + e.h + 5, "+1");
            onScore();
          } else {
            if (!GameState.player.invincible) loseLife();
          }
        }
      }
    }
  }

  // Particles update
  if (GameState.game.particles) {
    let i = 0;
    while (i < GameState.game.particles.length) {
      const p = GameState.game.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.05;
      p.life--;
      if (p.life <= 0) {
        GameState.game.particles[i] = GameState.game.particles[GameState.game.particles.length - 1];
        GameState.game.particles.pop();
      } else {
        i++;
      }
    }
  }

  // Floating texts update
  if (GameState.game.floatingTexts) {
    let i = 0;
    while (i < GameState.game.floatingTexts.length) {
      const ft = GameState.game.floatingTexts[i];
      ft.y += ft.vy;
      ft.life--;
      if (ft.life <= 0) {
        GameState.game.floatingTexts[i] = GameState.game.floatingTexts[GameState.game.floatingTexts.length - 1];
        GameState.game.floatingTexts.pop();
      } else {
        i++;
      }
    }
  }



  // Camera: smooth follow with snap upward, slow drift downward.
  const targetCamY = Math.max(0, GameState.player.y - c.followOffset);
  if (targetCamY > GameState.cameraY) {
    GameState.cameraY = GameState.cameraY * 0.85 + targetCamY * 0.15;
  } else {
    GameState.cameraY = Math.max(GameState.cameraY - 4, targetCamY);
  }

  // Falling below the viewport bottom costs a life.
  if (GameState.player.y < GameState.cameraY && !GameState.player.invincible) loseLife();

  // Nut/Heart collection.
  for (const nut of GameState.game.nuts) {
    if (nut.collected) continue;
    const dx = nut.x - GameState.player.x;
    const dy = nut.y - (GameState.player.y + GameState.player.h / 2);
    if (Math.abs(dx) < 22 && Math.abs(dy) < 26) {
      nut.collected = true;
      GameState.game.score++;
      if (nut.isHeart) {
        GameState.game.lives = Math.min(3, GameState.game.lives + 1);
        audio.playSFX('item');
        spawnHeartParticles(nut.x, nut.y);
      } else {
        audio.playSFX('item');
        spawnParticles(nut.x, nut.y, 10, '#e8c89a');
      }
      onScore();
    }
  }

  syncDOM();
}

export function loseLife() {
  GameState.game.lives--;
  GameState.player.hurtTimer = 40;
  audio.playSFX('hurt');
  spawnParticles(GameState.player.x, GameState.player.y + GameState.player.h / 2, 15, '#b5432f');
  if (GameState.game.lives <= 0) {
    setState("Game Over");
    audio.stopBGM();
  } else {
    respawn();
  }
}

// Respawn on the lowest branch currently within view (keeps the player
// visible and avoids a death loop when they fall from high up).
export function respawn() {
  const visible = GameState.game.branches.filter(
    (b) => b.top >= GameState.cameraY + 20 && b.top <= GameState.cameraY + VH - 40
  );
  const b = visible.length
    ? visible.reduce((a, x) => (x.top < a.top ? x : a))
    : GameState.game.branches[0];
  GameState.player.x = clamp(GameState.player.lastSafe.x, b.x + GameState.player.w / 2, b.x + b.w - GameState.player.w / 2);
  GameState.player.y = b.top;
  GameState.player.vx = 0;
  GameState.player.vy = 0;
  GameState.player.grounded = true;
  GameState.player.lastSafe = { x: GameState.player.x, y: b.top };
  GameState.player.isVoiceJumping = false;
  GameState.player.airVx = 0;
}

export function onScore() {
  // Nuts are now just currency. Leveling up is driven by height in physicsStep.
}
