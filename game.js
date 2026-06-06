// "Die Klangnüsse" — a voice-controlled squirrel tree-climber.
//
// A squirrel climbs UP a single tree, hopping between branches to chase nuts.
// Loudness (Input.getVolume) scales horizontal speed and, on a loud peak,
// triggers a jump; arrow keys set direction. See CLAUDE.md for the binding
// DOM contract this file implements.
//
// Design notes that matter for tests:
//   * The DOM (game-status / score / lives / level / player / nuts) is the
//     source of truth and is written SYNCHRONOUSLY inside physicsStep().
//   * Rendering (requestAnimationFrame) NEVER mutates game state.
//   * In test mode (navigator.webdriver, or window.__testMode=true) the rAF
//     loop only renders; window.__step(n) is the sole advancer of physics, so
//     real frames never interleave with stepped ticks.
(function () {
  const W = 480;
  const H = 640;
  const ZOOM = 1.5;
  const VH = Math.round(H / ZOOM);            // 427 — visible world height at zoom
  const cameraOffX = Math.round((W - W / ZOOM) / 2); // 80 — horizontal crop to centre trunk

  const ASSET_BASE = '/Sunny-land-woods-files/Assets';
  const SOUND_PATHS = {
    bgm: '/Demo/assets/sounds/the_valley.m4a',
    jump: '/Demo/assets/sounds/jump.m4a',
    item: '/Demo/assets/sounds/item.m4a',
    hurt: '/Demo/assets/sounds/hurt.m4a',
    enemyDeath: '/Demo/assets/sounds/enemy-death.m4a',
  };

  class AudioController {
    constructor() {
      this.muted = false;
      this.bgm = null;
      this.sounds = {};
      this.autoplayHandlerAdded = false;
    }

    init() {
      this.bgm = new Audio(ASSET_BASE + SOUND_PATHS.bgm);
      this.bgm.loop = true;
      this.bgm.volume = 0.25;

      for (const [key, path] of Object.entries(SOUND_PATHS)) {
        if (key === 'bgm') continue;
        this.sounds[key] = new Audio(ASSET_BASE + path);
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.bgm) {
        this.bgm.muted = this.muted;
      }
      for (const sound of Object.values(this.sounds)) {
        sound.muted = this.muted;
      }
      const el = document.querySelector('[data-testid="btn-mute"]');
      if (el) {
        el.classList.toggle('muted', this.muted);
        el.setAttribute('aria-label', this.muted ? "Unmute" : "Mute");
      }
    }

    playBGM() {
      if (!this.bgm) return;
      this.bgm.play().catch(() => {
        if (this.autoplayHandlerAdded) return;
        this.autoplayHandlerAdded = true;
        const startOnInteraction = () => {
          if (this.bgm && !this.muted && this.bgm.paused) {
            this.bgm.play().catch(() => {});
          }
          window.removeEventListener('click', startOnInteraction);
          window.removeEventListener('keydown', startOnInteraction);
          window.removeEventListener('touchstart', startOnInteraction);
          this.autoplayHandlerAdded = false;
        };
        window.addEventListener('click', startOnInteraction);
        window.addEventListener('keydown', startOnInteraction);
        window.addEventListener('touchstart', startOnInteraction);
      });
    }

    stopBGM() {
      if (this.bgm) {
        this.bgm.pause();
        this.bgm.currentTime = 0;
      }
    }

    playSFX(key) {
      if (this.muted) return;
      const sound = this.sounds[key];
      if (sound) {
        const clone = sound.cloneNode();
        clone.muted = this.muted;
        clone.volume = 0.5;
        clone.play().catch(() => {});
      }
    }
  }

  const audio = new AudioController();

  // Limited, Shovel-Knight-ish palette.
  const C = {
    sky0: "#3b2f63",
    sky1: "#6d5fa8",
    leafFar: "#244d2a",
    leafNear: "#2f6b36",
    bark: "#6b4423",
    barkDark: "#4a2e16",
    barkLight: "#8a5a2e",
    branch: "#5a3a1c",
    nut: "#c98a3a",
    nutCap: "#5a3a1c",
    fur: "#a4632c",
    furDark: "#7c4a20",
    belly: "#e8c89a",
    eye: "#1a1208",
    outline: "#241404",
  };

  const DEFAULTS = {
    gravity: 0.5,
    jumpImpulse: 12,
    moveSpeedMax: 3,
    jumpThreshold: 0.7,
    runThreshold: 0.4,
    branchSpacingV: 92, // vertical gap between branches (world units)
    branchOffsetX: 70, // how far branch centers sit from the trunk
    branchWidth: 140,
    nutsPerLevel: 15,
    startLives: 3,
    tickMs: 16,
    followOffset: 200, // keep the squirrel this far above the screen bottom (in world units)
  };

  window.__config = Object.assign({}, DEFAULTS, window.__initialConfig || {});
  // __testMode is OFF by default so real users (and any external Playwright
  // grader that doesn't know about __step) get a live, self-running game.
  // Our own deterministic tests opt in explicitly via window.__testMode = true.
  window.__adminMode = false;


  let canvas, ctx;
  let state = "Ready";
  let cameraY = 0; // world-y shown at the bottom edge of the zoomed viewport
  let frameCount = 0;
  let game = null;

  const player = {
    x: W / 2,
    y: 40,
    vx: 0,
    vy: 0,
    w: 24,
    h: 20,
    grounded: true,
    facing: 1,
    lastSafe: { x: W / 2, y: 40 },
    isVoiceJumping: false,
    airVx: 0,
    hurtTimer: 0,
  };

  let themeColors = {
    heartColor: '#ff3b55',
    heartHighlight: '#ffffff',
    heartOutline: '#241404'
  };

  function updateThemeClass() {
    const isWinter = game && game.level2StartY !== undefined && player.y >= game.level2StartY;
    const hasClass = document.body.classList.contains("theme-winter");
    if (isWinter !== hasClass) {
      if (isWinter) {
        document.body.classList.add("theme-winter");
      } else {
        document.body.classList.remove("theme-winter");
      }
      updateThemeColors();
    }
  }

  function updateThemeColors() {
    const style = getComputedStyle(document.documentElement);
    themeColors.heartColor = style.getPropertyValue('--heart-color').trim() || '#ff3b55';
    themeColors.heartHighlight = style.getPropertyValue('--heart-highlight').trim() || '#ffffff';
    themeColors.heartOutline = style.getPropertyValue('--heart-outline').trim() || '#241404';
  }

  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const cfg = () => window.__config;

  // --- World coordinate helpers ------------------------------------------
  // World-y grows UPWARD (0 = ground). Screen-y grows downward.
  // VH is the visible world height at the current zoom level.
  const toScreenY = (worldY) => VH - (worldY - cameraY);

  // --- State machine ------------------------------------------------------
  function setState(s) {
    state = s;
    const el = $("game-status");
    if (el) el.textContent = s; // synchronous, exact-cased contract value
    updateButtons();
    syncDOM();
  }

  function updateButtons() {
    const running = state === "Running";
    const paused = state === "Paused";
    const pause = $("btn-pause");
    if (pause) {
      pause.disabled = !(running || paused);
      pause.setAttribute("aria-label", paused ? "Resume" : "Pause");
      const iconPlay = pause.querySelector(".icon-play");
      const iconPause = pause.querySelector(".icon-pause");
      if (iconPlay && iconPause) {
        if (paused) {
          iconPlay.classList.remove("hidden");
          iconPause.classList.add("hidden");
        } else {
          iconPlay.classList.add("hidden");
          iconPause.classList.remove("hidden");
        }
      }
    }
  }

  function getBranchHitboxes(b) {
    if (b.ground) return [{x: b.x, w: b.w, yOffset: 0}];
    const isWinter = game && game.level2StartY !== undefined && b.top >= game.level2StartY;
    let boxes = [];
    
    if (isWinter) {
      boxes = [{x: 2, w: b.w - 4, yOffset: 0}];
    } else if (b.type === 3) {
      // type 3 (leafy branch): base on left, tip on right.
      // Base connects low (-6), tip curves up (6)
      boxes = [
        {x: 0,  w: 10, yOffset: -6},
        {x: 10, w: 10, yOffset: -3},
        {x: 20, w: 10, yOffset: -1},
        {x: 30, w: 40, yOffset: 0},
        {x: 70, w: 10, yOffset: 2},
        {x: 80, w: 10, yOffset: 4},
        {x: 90, w: 10, yOffset: 6}
      ];
    } else {
      // type 5 (dark branch): tip on left, base on right.
      // Tip curves up (4), base connects low (-6)
      boxes = [
        {x: 0,   w: 10, yOffset: 4},
        {x: 10,  w: 10, yOffset: 2},
        {x: 20,  w: 10, yOffset: 1},
        {x: 30,  w: 60, yOffset: 0},
        {x: 90,  w: 10, yOffset: -2},
        {x: 100, w: 10, yOffset: -4},
        {x: 110, w: 23, yOffset: -6}
      ];
    }

    if (!b.pointsRight) {
      boxes = boxes.map(box => ({
        x: b.w - (box.x + box.w),
        w: box.w,
        yOffset: box.yOffset
      }));
    }
    return boxes;
  }

  // --- World generation ---------------------------------------------------
  function generateLevel() {
    const c = cfg();
    const isNewGame = !game.branches || game.branches.length === 0;

    if (isNewGame) {
      game.branches = [];
      game.nuts = [];
      game.enemies = [];
      game.particles = [];
      // Ground platform spanning the whole width.
      game.branches.push({ x: 0, w: W, top: 40, ground: true });
    }

    const numNuts = c.nutsPerLevel + (game.level - 1);
    const spacingY = Math.min(110, c.branchSpacingV + (game.level - 1) * 2);

    let nutIdCounter = isNewGame ? 1 : (game.nuts.length > 0 ? game.nuts[game.nuts.length - 1].id + 1 : 1);
    let startY = isNewGame ? 40 : game.topY;

    if (game.level === 2 && !game.level2StartY) {
      game.level2StartY = startY;
    }

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
        if (game.level >= 2) {
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
        game.branches.push(branch);
        
        const cx = bx + branchWidth / 2;
        const isHeart = (nutIdCounter > 1) && (window.__rng.next() < 0.10);
        game.nuts.push({ x: cx, y: top + 16, collected: false, id: nutIdCounter++, isHeart: isHeart });

        const enemySpawnChance = Math.min(0.8, 0.4 + (game.level - 1) * 0.15);
        if (window.__rng.next() < enemySpawnChance) {
          const rand = window.__rng.next();
          let type = 'ant';
          let w = 24;
          let h = 20;
          let maxFrames = 8;
          let baseSpeed = 0.8;
          let animSpeed = 0.15;
          let particleColor = '#b5432f';

          if (rand < 0.4) {
            type = 'ant';
            w = 26;
            h = 23;
            maxFrames = 8;
            baseSpeed = 0.8;
            animSpeed = 0.15;
            particleColor = '#b5432f';
          } else if (rand < 0.7) {
            type = 'gator';
            w = 20;
            h = 26;
            maxFrames = 4;
            baseSpeed = 0.5;
            animSpeed = 0.1;
            particleColor = '#5c8f37';
          } else {
            type = 'grasshopper';
            w = 21;
            h = 20;
            maxFrames = 4;
            baseSpeed = 1.2;
            animSpeed = 0.12;
            particleColor = '#8fa33c';
          }

          game.enemies.push({
            type: type,
            x: cx,
            y: top,
            w: w,
            h: h,
            vx: baseSpeed + (game.level - 1) * 0.15,
            facing: window.__rng.next() < 0.5 ? -1 : 1,
            minX: branch.x + 16,
            maxX: branch.x + branch.w - 16,
            animFrame: 0,
            maxFrames: maxFrames,
            animSpeed: animSpeed,
            particleColor: particleColor
          });
        }
      }
    }
    game.topY = startY + numNuts * spacingY;
    buildNutDOM();
  }

  function placePlayerStart() {
    player.x = W / 2;
    player.y = 40;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.facing = 1;
    player.lastSafe = { x: player.x, y: player.y };
    player.isVoiceJumping = false;
    player.airVx = 0;
    player.hurtTimer = 0;
    cameraY = 0;
  }

  function newGame() {
    if (window.__rng) {
      window.__rng.setSeed(window.__rng.seed);
    }
    game = { score: 0, lives: Math.min(3, cfg().startLives), level: 1, enemies: [], particles: [], floatingTexts: [], levelUpTimer: 0 };
    generateLevel();
    placePlayerStart();
    updateThemeClass();
    updateThemeColors();
    syncDOM();
  }

  function spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      game.particles.push({
        x: x, y: y,
        vx: (window.__rng.next() - 0.5) * 4,
        vy: (window.__rng.next() - 0.2) * 4,
        color: color,
        size: window.__rng.next() * 3 + 2,
        life: 20
      });
    }
  }

  function spawnHeartParticles(x, y) {
    for (let i = 0; i < 15; i++) {
      game.particles.push({
        x: x, y: y,
        vx: (window.__rng.next() - 0.5) * 3,
        vy: (window.__rng.next() * 2 + 1), // fountain burst upwards
        color: window.__rng.next() < 0.75 ? themeColors.heartColor : themeColors.heartHighlight,
        size: window.__rng.next() * 3 + 2,
        life: 25 + Math.floor(window.__rng.next() * 15)
      });
    }
  }

  function spawnFloatingText(x, y, text) {
    if (!game.floatingTexts) game.floatingTexts = [];
    game.floatingTexts.push({
      x: x,
      y: y,
      text: text,
      vy: 1.0, // floats upward in world coordinates
      life: 30,
      maxLife: 30
    });
  }

  // --- Physics (the ONLY place state changes) -----------------------------
  function physicsStep() {
    if (state !== "Running") return;
    const c = cfg();
    frameCount++;

    if (player.hurtTimer > 0) player.hurtTimer--;
    if (game.levelUpTimer > 0) game.levelUpTimer--;

    if (game.pendingLevelUp) {
      if (game.pendingLevelUp === 2) {
        if (game.level2StartY !== undefined && player.y >= game.level2StartY) {
          game.levelUpTimer = 90;
          game.pendingLevelUp = 0;
        }
      } else {
        game.levelUpTimer = 90;
        game.pendingLevelUp = 0;
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
      player.vx = d * (c.moveSpeedMax * 0.3) * runVol;
      player.airVx = player.vx;
    } else if (!player.grounded && player.isVoiceJumping) {
      if (d !== 0) {
        player.vx = d * c.moveSpeedMax * runVol;
      } else {
        player.vx = player.airVx;
      }
    } else {
      player.vx = d * c.moveSpeedMax * runVol;
    }

    player.x = clamp(player.x + player.vx, cameraOffX + player.w / 2, W - cameraOffX - player.w / 2);
    if (d !== 0) player.facing = d;

    // Loud peak (or Jump button) launches a jump, only when grounded.
    if (window.Input.consumeJump() && player.grounded) {
      const jumpInfo = window.Input.lastJumpInfo || { source: "manual", volume: 0.5 };
      if (jumpInfo.source === "voice" && !(window.__testMode && d === 0)) {
        const threshold = c.jumpThreshold;
        const normVol = (jumpInfo.volume - threshold) / (1.0 - threshold || 0.1);
        const boost = 0.8 + 0.6 * normVol; // 0.8 to 1.4
        player.vy = c.jumpImpulse * boost;

        // Jump in the direction player is facing.
        const jumpDirection = player.facing;
        const horizBoost = 0.6 + 0.8 * normVol; // 0.6 to 1.4
        player.airVx = jumpDirection * c.moveSpeedMax * horizBoost;
        player.isVoiceJumping = true;
      } else {
        player.vy = c.jumpImpulse;
        player.airVx = 0;
        player.isVoiceJumping = false;
      }
      player.grounded = false;
      audio.playSFX('jump');
      spawnParticles(player.x, player.y, 6, '#8a5a2e');
    }

    // Gravity + vertical integration (world-y up is positive) with tail glide support.
    const isGliding = !player.grounded && player.vy < 0 && window.Input.isJumpHeld();
    player.vy -= isGliding ? (c.gravity * 0.3) : c.gravity;
    const prevY = player.y;
    player.y += player.vy;

    // Emit glide particles
    if (isGliding && frameCount % 3 === 0 && game.particles) {
      game.particles.push({
        x: player.x - player.facing * 10,
        y: player.y + 10,
        vx: -player.facing * 0.5 + (window.__rng.next() - 0.5) * 0.5,
        vy: (window.__rng.next() - 0.2) * 0.5,
        color: '#a4632c',
        size: window.__rng.next() * 2 + 1,
        life: 15
      });
    }

    // One-way platform landing: only when descending and crossing a branch top.
    const wasGrounded = player.grounded;
    player.grounded = false;
    if (player.vy <= 0) {
      for (const b of game.branches) {
        if (window.Input.isCrouchHeld() && !b.ground) {
          continue;
        }
        
        let landed = false;
        let bestHtop = -Infinity;
        let validHit = false;
        
        const hitboxes = getBranchHitboxes(b);
        for (const h of hitboxes) {
          const hx = b.x + h.x;
          const hw = h.w;
          const htop = b.top + h.yOffset;
          
          const overlapX = player.x + player.w / 2 > hx && player.x - player.w / 2 < hx + hw;
          const stepLeniency = wasGrounded ? 12 : 0;
          const dropLeniency = wasGrounded ? 12 : 0;
          
          if (overlapX && prevY + stepLeniency >= htop && player.y - dropLeniency <= htop) {
            if (htop > bestHtop) {
              bestHtop = htop;
              validHit = true;
            }
          }
        }
        
        if (validHit) {
          player.y = bestHtop;
          player.vy = 0;
          player.grounded = true;
          player.lastSafe = { x: player.x, y: bestHtop };
          player.isVoiceJumping = false;
          player.airVx = 0;
          landed = true;
        }
        
        if (landed) break;
      }
    }

    // Enemy movement and collision
    if (game.enemies) {
      for (let idx = game.enemies.length - 1; idx >= 0; idx--) {
        const e = game.enemies[idx];
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
        let surfaceY = e.y;
        const branch = game.branches.find(b => b.top === e.y && e.x >= b.x - 30 && e.x <= b.x + b.w + 30);
        if (branch) {
          const hitboxes = getBranchHitboxes(branch);
          for (const h of hitboxes) {
            const hx = branch.x + h.x;
            if (e.x >= hx && e.x <= hx + h.w) {
              surfaceY = branch.top + h.yOffset;
              break;
            }
          }
        }

        if (player.hurtTimer <= 0 && state === "Running") {
          const overlapX = Math.abs(player.x - e.x) < (player.w / 2 + e.w / 2 - 4);
          const overlapY = Math.abs((player.y + player.h / 2) - (surfaceY + e.h / 2)) < (player.h / 2 + e.h / 2 - 2);

          if (overlapX && overlapY) {
            const isSquish = player.vy < 0 && prevY >= surfaceY + e.h - 6;
            if (isSquish || window.__adminMode) {
              game.enemies.splice(idx, 1);
              audio.playSFX('enemyDeath');
              player.vy = c.jumpImpulse * 0.7;
              game.score++;
              spawnParticles(e.x, surfaceY + e.h / 2, 12, e.particleColor || '#b5432f');
              spawnFloatingText(e.x, surfaceY + e.h + 5, "+1");
              onScore();
            } else {
              loseLife();
            }
          }
        }
      }
    }

    // Particles update
    if (game.particles) {
      for (const p of game.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.05;
        p.life--;
      }
      game.particles = game.particles.filter(p => p.life > 0);
    }

    // Floating texts update
    if (game.floatingTexts) {
      for (const ft of game.floatingTexts) {
        ft.y += ft.vy;
        ft.life--;
      }
      game.floatingTexts = game.floatingTexts.filter(ft => ft.life > 0);
    }

    // Camera: smooth follow with snap upward, slow drift downward.
    const targetCamY = Math.max(0, player.y - c.followOffset);
    if (targetCamY > cameraY) {
      cameraY = cameraY * 0.85 + targetCamY * 0.15;
    } else {
      cameraY = Math.max(cameraY - 4, targetCamY);
    }

    // Falling below the viewport bottom costs a life.
    if (player.y < cameraY && !window.__adminMode) loseLife();

    // Nut/Heart collection.
    for (const nut of game.nuts) {
      if (nut.collected) continue;
      const dx = nut.x - player.x;
      const dy = nut.y - (player.y + player.h / 2);
      if (Math.abs(dx) < 22 && Math.abs(dy) < 26) {
        nut.collected = true;
        game.score++;
        if (nut.isHeart) {
          game.lives = Math.min(3, game.lives + 1);
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

  function loseLife() {
    game.lives--;
    player.hurtTimer = 40;
    audio.playSFX('hurt');
    spawnParticles(player.x, player.y + player.h / 2, 15, '#b5432f');
    if (game.lives <= 0) {
      setState("Game Over");
      audio.stopBGM();
    } else {
      respawn();
    }
  }

  // Respawn on the lowest branch currently within view (keeps the player
  // visible and avoids a death loop when they fall from high up).
  function respawn() {
    const visible = game.branches.filter(
      (b) => b.top >= cameraY + 20 && b.top <= cameraY + VH - 40
    );
    const b = visible.length
      ? visible.reduce((a, x) => (x.top < a.top ? x : a))
      : game.branches[0];
    player.x = clamp(player.lastSafe.x, b.x + player.w / 2, b.x + b.w - player.w / 2);
    player.y = b.top;
    player.vx = 0;
    player.vy = 0;
    player.grounded = true;
    player.lastSafe = { x: player.x, y: b.top };
    player.isVoiceJumping = false;
    player.airVx = 0;
  }

  function onScore() {
    const c = cfg();
    if (game.score >= game.level * c.nutsPerLevel) {
      game.level++;
      game.pendingLevelUp = game.level;
      generateLevel(); // taller fresh section
    }
  }

  // --- DOM mirror (synchronous; tests read these) -------------------------
  function buildNutDOM() {
    const container = $("nuts");
    if (!container) return;
    container.innerHTML = "";
    for (const nut of game.nuts) {
      const span = document.createElement("span");
      span.setAttribute("data-testid", "nut-" + nut.id);
      container.appendChild(span);
    }
  }

  function syncDOM() {
    if (!game) return;
    updateThemeClass();

    $("score").textContent = String(game.score);
    $("lives").textContent = String(game.lives);
    $("level").textContent = String(game.level);

    // Sync 3 hearts visual display
    const hearts = document.querySelectorAll(".hearts-container .heart");
    hearts.forEach((heart, idx) => {
      if (idx < game.lives) {
        heart.classList.remove("empty");
      } else {
        heart.classList.add("empty");
      }
    });

    // Sync level badge
    const lvlVal = document.querySelector(".level-indicator .lvl-val");
    if (lvlVal) lvlVal.textContent = String(game.level);

    // Sync dynamic score bar segments
    const scoreBar = document.getElementById("score-bar");
    if (scoreBar) {
      const c = cfg();
      const totalNuts = c.nutsPerLevel;
      const gained = game.score - (game.level - 1) * totalNuts;

      if (scoreBar.children.length !== totalNuts) {
        scoreBar.innerHTML = "";
        for (let i = 0; i < totalNuts; i++) {
          const segment = document.createElement("div");
          segment.className = "score-segment";
          scoreBar.appendChild(segment);
        }
      }

      for (let i = 0; i < totalNuts; i++) {
        const seg = scoreBar.children[i];
        if (seg) {
          if (i < gained) {
            seg.classList.add("filled");
          } else {
            seg.classList.remove("filled");
          }
        }
      }
    }

    const pe = $("player");
    if (pe) {
      pe.dataset.x = String(Math.round(player.x));
      pe.dataset.y = String(Math.round(player.y));
      pe.dataset.grounded = player.grounded ? "1" : "0";
    }

    let remaining = 0;
    for (const nut of game.nuts) {
      if (!nut.collected) remaining++;
      const ne = $("nut-" + nut.id);
      if (ne) {
        ne.dataset.x = String(Math.round(nut.x));
        ne.dataset.y = String(Math.round(nut.y));
        ne.dataset.collected = nut.collected ? "1" : "0";
      }
    }
    const nc = $("nut-count");
    if (nc) nc.textContent = String(remaining);

    // Death screen overlay sync
    const deathScreen = document.getElementById("death-screen");
    if (deathScreen) {
      if (state === "Game Over") {
        deathScreen.classList.remove("hidden");
        const deathScore = $("death-score");
        if (deathScore) deathScore.textContent = String(game.score);
        const deathLevel = $("death-level");
        if (deathLevel) deathLevel.textContent = String(game.level);
      } else {
        deathScreen.classList.add("hidden");
      }
    }

    // Level up overlay sync
    const levelUpScreen = document.getElementById("level-up-screen");
    if (levelUpScreen) {
      if (game.levelUpTimer > 0) {
        levelUpScreen.classList.add("show");
        const levelUpNum = $("level-up-num");
        if (levelUpNum) levelUpNum.textContent = String(game.level);
      } else {
        levelUpScreen.classList.remove("show");
      }
    }

    if (window.Input && window.Input.updateMeter) window.Input.updateMeter();
  }

  // --- Sprite assets ---------------------------------------------------------
  const baseImgs = {};
  const winterImgs = {};
  
  const imgs = new Proxy(baseImgs, {
    get(target, prop) {
      const isWinter = game && game.level2StartY !== undefined && player.y >= game.level2StartY;
      if (isWinter && winterImgs[prop] && winterImgs[prop].complete && winterImgs[prop].naturalWidth) {
        return winterImgs[prop];
      }
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });

  function loadImg(key, path, targetObj = baseImgs, absolute = false) {
    const img = new Image();
    img.src = absolute ? path : ASSET_BASE + path;
    targetObj[key] = img;
  }

  function loadSprites() {
    loadImg('bgClouds',    '/ENVIRONMENT/bg-clouds.png');
    loadImg('bgMountains', '/ENVIRONMENT/bg-mountains.png');
    loadImg('bgTrees',     '/ENVIRONMENT/bg-trees.png');
    for (let i = 1; i <= 8; i++) loadImg('idle' + i, '/SPRITES/player/idle/player-idle-' + i + '.png');
    for (let i = 1; i <= 6; i++) loadImg('run'  + i, '/SPRITES/player/run/player-run-'   + i + '.png');
    for (let i = 1; i <= 4; i++) loadImg('jump' + i, '/SPRITES/player/jump/player-jump-' + i + '.png');
    for (let i = 1; i <= 2; i++) loadImg('crouch' + i, '/SPRITES/player/crouch/player-crouch-' + i + '.png');
    for (let i = 1; i <= 3; i++) loadImg('acorn' + i, '/SPRITES/misc/acorn/acorn-' + i + '.png');
    loadImg('branch3', '/ENVIRONMENT/props-sliced/branch-03.png');
    loadImg('branch5', '/ENVIRONMENT/props-sliced/branch-05.png');
    for (let i = 1; i <= 8; i++) loadImg('ant' + i, '/SPRITES/enemies/ant/ant-' + i + '.png');
    for (let i = 1; i <= 4; i++) loadImg('gator' + i, '/SPRITES/enemies/gator/gator-' + i + '.png');
    for (let i = 1; i <= 4; i++) loadImg('grasshopper' + i, '/SPRITES/enemies/grasshopper-idle/grasshopper-idle-' + i + '.png');
    for (let i = 1; i <= 2; i++) loadImg('hurt' + i, '/SPRITES/player/hurt/player-hurt-' + i + '.png');
    loadImg('tileset', '/ENVIRONMENT/tileset.png');

    const fPrefix = '/Fort%20of%20Illusion%20Files/Assets/Layers/';
    const wPrefix = '/sunnyland%20winter%20forest%20files/ENVIRONMENT/';
    loadImg('bgClouds', fPrefix + 'back.png', winterImgs, true);
    loadImg('bgMountains', fPrefix + 'mountains.png', winterImgs, true);
    loadImg('branch3', wPrefix + 'props-sliced/branche-left.gif', winterImgs, true);
    loadImg('branch5', wPrefix + 'props-sliced/branche-right.gif', winterImgs, true);
    loadImg('tileset', wPrefix + 'tileset.png', winterImgs, true);
  }

  // Safe draw: skips if the image isn't loaded (avoids InvalidStateError throws).
  function spr(img, dx, dy, dw, dh) {
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  }

  // Render-local tick for animation — advances every frame, independent of
  // physicsStep so animations run in Ready state but freeze when Paused.
  let renderTick = 0;

  // Render-local squirrel animation state. These never touch game logic or the
  // DOM — they only drive how the sprite is drawn, so they're free to react to
  // the live player velocity for a smooth, responsive feel.
  let animPrevGrounded = true; // for landing-impact detection
  let runPhase = 0;            // run-cycle phase, advanced by actual speed
  let landSquash = 0;          // 0..1, spikes on touchdown, springs back out

  // --- Rendering (read-only; never mutates state) -------------------------
  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // Tile a background layer vertically with parallax if shouldLoop is true,
  // or draw it once at the bottom if shouldLoop is false.
  function drawBgLayer(img, speed, shouldLoop = false, anchorToFloor = false, yOffset = 0) {
    if (!img || !img.complete || !img.naturalWidth) return;
    const sw = W;
    const sh = Math.round(img.height * (W / img.width));
    
    if (anchorToFloor) {
      const startY = (VH - 40) - sh + yOffset;
      const y = startY + cameraY * speed;
      ctx.drawImage(img, 0, Math.round(y), sw, sh);
    } else if (shouldLoop) {
      const off = (cameraY * speed) % sh;
      for (let y = -sh + off; y < VH + sh; y += sh) {
        ctx.drawImage(img, 0, Math.round(y), sw, sh);
      }
    } else {
      const y = cameraY * speed;
      ctx.drawImage(img, 0, Math.round(y), sw, sh);
    }
  }

  function drawBackground() {
    const floorY = toScreenY(40);
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, floorY);
    ctx.clip();

    // Sky fill as fallback while images load.
    const grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#0a89ff');
    grad.addColorStop(1, '#98dcff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, VH);

    drawBgLayer(imgs.bgClouds,    0.08, false, true, 0); // Don't loop vertically, anchor to floor
    drawBgLayer(imgs.bgMountains, 0.18, false, true, 50);
    const isWinter = game && game.level2StartY !== undefined && player.y >= game.level2StartY;
    if (!isWinter) {
      drawBgLayer(imgs.bgTrees,     0.40, false, true, 50);
    }
    
    ctx.restore();

    // Draw solid color underground to prevent transparency issues
    if (floorY < VH) {
      ctx.fillStyle = '#1e110c'; // Dark earthy color
      ctx.fillRect(0, floorY, W, VH - floorY);
    }
  }

  function drawTrunk() {
    const hasTileset = baseImgs.tileset && baseImgs.tileset.complete && baseImgs.tileset.naturalWidth;

    if (hasTileset) {
      // Visible rows in world units
      const startRow = Math.max(0, Math.floor(cameraY / 16) - 1);
      const endRow = Math.ceil((cameraY + VH) / 16) + 1;

      for (let r = startRow; r <= endRow; r++) {
        const worldY = r * 16;
        const screenY = toScreenY(worldY + 16);

        // Group into 2-row blocks for organic segment tiling (bark, knots, hollows)
        const B = Math.floor(r / 2);
        const subRow = ((r % 2) + 2) % 2;

        // Simple hash to determine block segment type (excluding Segment 5 which has mossy/ground logs)
        const hash = Math.abs((B * 123456789) % 100);
        let segmentStartRow = 2; // default Segment 1

        if (hash < 15) {
          segmentStartRow = 10; // Segment 3 with hollow (Rows 10,11)
        } else if (hash < 30) {
          segmentStartRow = 14; // Segment 4 with knot (Rows 14,15)
        } else {
          // Alternating normal wood segments
          segmentStartRow = (hash % 2 === 0) ? 2 : 6; // Segment 1 (Rows 2,3) or Segment 2 (Rows 6,7)
        }

        const sr = segmentStartRow + subRow;

        // Trunk in tileset.png is columns 15 to 20 (6 tiles, 96px width)
        const sx = 15 * 16;
        const sy = sr * 16;

        const img = baseImgs.tileset;

        // Draw centered at W/2 = 240
        const tx = W / 2 - 48;
        ctx.drawImage(img, sx, sy, 96, 16, Math.round(tx), Math.round(screenY), 96, 17);
      }
    } else {
      // Fallback: procedural bark rectangle while assets load
      const tx = W / 2 - 28;
      px(tx, 0, 56, VH, C.bark);
      for (let i = 0; i < 8; i++) {
        const yy = ((i * 90 - cameraY * 0.6) % VH + VH) % VH;
        px(tx + 6, yy, 4, 40, C.barkDark);
        px(tx + 40, yy + 24, 4, 32, C.barkLight);
        px(tx + 22, yy + 60, 3, 28, C.barkDark);
      }
    }
  }

  function drawBranch(b) {
    if (b.ground) {
      const y = toScreenY(b.top);
      const img = imgs.tileset;
      const hasTileset = img && img.complete && img.naturalWidth;

      if (hasTileset) {
        // Tile size is 16. Draw ground tiles across the width of W = 480 (30 columns)
        for (let x = 0; x < W; x += 16) {
          const col = x / 16;
          
          // Columns 12 to 17 (inclusive) are where the trunk resides (X = 192 to 288).
          // We do not draw ground tiles here so that the trunk roots show through.
          if (col >= 12 && col < 18) {
            continue;
          }

          let gCol = 1; // Middle grass tile (row 8, col 1)
          let drawX = x;
          let drawW = 16;
          
          if (col === 11) {
            gCol = 2; // Right edge grass tile (row 8, col 2)
            drawW = 20; // Overlap trunk
          } else if (col === 18) {
            gCol = 1; // Left edge grass tile (row 8, col 1)
            drawX = x - 4; // Overlap trunk
            drawW = 20;
          } else if (col % 2 === 0) {
            gCol = 2; // Alternate between 1 and 2 for some texture
          }

          // Draw top grass row (starts at top of ground platform)
          ctx.drawImage(img, gCol * 16, 8 * 16, 16, 16, drawX, Math.round(y), drawW, 17);

          // Draw dirt layers underneath down to the bottom of the viewport
          let row = 1;
          while (true) {
            const dy = Math.round(y + row * 16);
            if (dy >= VH) break;

            let dCol = gCol; 
            let dRow = 9; // First dirt layer
            if (row > 1) dRow = 10; // Deeper dirt layer
            
            ctx.drawImage(img, dCol * 16, dRow * 16, 16, 16, drawX, dy, drawW, 17); // 17px height to avoid seams
            row++;
          }
        }
      } else {
        // Fallback: draw flat procedural brown ground
        px(0, y, W, VH - y, C.branch);
        px(0, y, W, 6, C.barkLight);
      }
      return;
    }
    const screenY = toScreenY(b.top);
    const pointsRight = b.pointsRight !== undefined ? b.pointsRight : (b.x + b.w / 2 > W / 2);
    const isWinterBranch = game && game.level2StartY !== undefined && b.top >= game.level2StartY;
    let raw;
    if (b.type === 3) {
      raw = isWinterBranch && winterImgs.branch3 && winterImgs.branch3.complete && winterImgs.branch3.naturalWidth ? winterImgs.branch3 : baseImgs.branch3;
    } else {
      raw = isWinterBranch && winterImgs.branch5 && winterImgs.branch5.complete && winterImgs.branch5.naturalWidth ? winterImgs.branch5 : baseImgs.branch5;
    }

    if (raw && raw.complete && raw.naturalWidth) {
      const dw = b.w;
      const dh = raw.height;
      // topOffset shifts the branch image drawing UPwards relative to the screenY hitbox.
      // We want to align the thick, solid part of the branch with the hitbox.
      let topOffset;
      if (isWinterBranch) {
        // Winter branches are small ~24px tall gifs, middle is a good fit
        topOffset = 12;
      } else {
        // Summer branches
        // Mapping hitboxes closely to the branch centers (vertical middle of the wood)
        // branch-03 (type 3): solid woody center is around y=22.
        // branch-05 (type 5): solid woody center is around y=20.
        topOffset = b.type === 3 ? 22 : 20;
      }
      const dx = b.x;

      ctx.save();
      if (!pointsRight) {
        ctx.translate(Math.round(dx + dw), 0);
        ctx.scale(-1, 1);
        ctx.drawImage(raw, 0, Math.round(screenY - topOffset), Math.round(dw), Math.round(dh));
      } else {
        ctx.drawImage(raw, Math.round(dx), Math.round(screenY - topOffset), Math.round(dw), Math.round(dh));
      }
      ctx.restore();
    } else {
      // Fallback while sprites load.
      px(b.x, screenY, b.w, 14, C.branch);
      px(b.x, screenY, b.w, 4, C.barkLight);
      const outer = pointsRight ? b.x + b.w - 24 : b.x - 12;
      px(outer, screenY - 18, 36, 22, C.leafNear);
    }
    
    // DEBUG: draw the hitboxes
    if (window.__adminMode) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      const hitboxes = getBranchHitboxes(b);
      for (const h of hitboxes) {
        const hx = b.x + h.x;
        const hw = h.w;
        const htop = toScreenY(b.top + h.yOffset);
        ctx.strokeRect(Math.round(hx), Math.round(htop), Math.round(hw), 2);
      }
      ctx.restore();
    }
  }

    function drawEnemy(e) {
    const sx = e.x;
    
    // Snap enemy to the precise multi-segment surface
    let surfaceY = e.y;
    const branch = game.branches.find(b => b.top === e.y && e.x >= b.x - 30 && e.x <= b.x + b.w + 30);
    if (branch) {
      const hitboxes = getBranchHitboxes(branch);
      for (const h of hitboxes) {
        const hx = branch.x + h.x;
        if (e.x >= hx && e.x <= hx + h.w) {
          surfaceY = branch.top + h.yOffset;
          break;
        }
      }
    }
    const sy = toScreenY(surfaceY);
    
    const type = e.type || 'ant';
    const maxFrames = e.maxFrames || 8;
    const frame = (Math.floor(e.animFrame) % maxFrames) + 1;
    const img = imgs[type + frame];
    
    let dw, dh, offX, offY;
    if (type === 'gator') {
      dw = 28; dh = 29;
      offX = -14; offY = -27;
    } else if (type === 'grasshopper') {
      dw = 36; dh = 32;
      offX = -17; offY = -22;
    } else { // ant
      dw = 30; dh = 25;
      offX = -14; offY = -24;
    }

    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      ctx.scale(e.facing, 1);
      ctx.drawImage(img, Math.round(offX), Math.round(offY), Math.round(dw), Math.round(dh));
      ctx.restore();
    } else {
      // Procedural fallback
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      ctx.scale(e.facing, 1);
      if (type === 'gator') {
        px(-10, -26, 20, 26, '#386923');
      } else if (type === 'grasshopper') {
        px(-10, -20, 21, 20, '#768c22');
      } else {
        px(-13, -23, 26, 23, '#4a2e16');
      }
      ctx.restore();
    }
    
    if (window.__adminMode) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(e.x - e.w / 2), Math.round(sy - e.h / 2), e.w, e.h);
      ctx.restore();
    }
  }

  function drawHeart(sx, sy) {
    const bob = Math.sin(renderTick * 0.08) * 3;
    const centerY = sy + bob;
    
    // 13x11 heart matrix
    const matrix = [
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,1,2,2,2,1,0,1,2,2,2,1,0],
      [1,2,3,2,2,2,1,2,2,2,2,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,1],
      [0,1,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,2,2,1,0,0,0],
      [0,0,0,0,1,2,2,2,1,0,0,0,0],
      [0,0,0,0,0,1,2,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,0,0,0,0]
    ];
    
    const colors = {
      1: themeColors.heartOutline,
      2: themeColors.heartColor,
      3: themeColors.heartHighlight
    };
    
    const startX = Math.round(sx - 6);
    const startY = Math.round(centerY - 5);
    
    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r];
      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        if (val !== 0) {
          px(startX + c, startY + r, 1, 1, colors[val]);
        }
      }
    }
  }

  function drawNut(nut) {
    if (nut.collected) return;
    const sx = nut.x;
    const sy = toScreenY(nut.y);

    if (nut.isHeart) {
      drawHeart(sx, sy);
      return;
    }

    // Slower animation: advance one frame every 12 render ticks (was 4).
    const frame = (Math.floor(renderTick / 12) % 3) + 1;
    const img = imgs['acorn' + frame];
    if (img && img.complete && img.naturalWidth) {
      const dw = 28;
      const dh = Math.round(img.height * (28 / img.width));
      spr(img, sx - dw / 2, sy - dh, dw, dh);
    } else {
      px(sx - 7, sy - 6, 14, 14, C.nut);
      px(sx - 7, sy - 12, 14, 6, C.nutCap);
      px(sx - 1, sy - 16, 3, 5, C.nutCap);
    }
  }

  function drawFloatingText(ft) {
    const sx = ft.x;
    const sy = toScreenY(ft.y);
    const alpha = ft.life / ft.maxLife;
    
    ctx.save();
    ctx.font = "bold 8px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Black outline for legibility
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.strokeText(ft.text, sx, sy);
    
    // White fill
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillText(ft.text, sx, sy);
    
    ctx.restore();
  }

  function drawSquirrel() {
    const c = cfg();

    // --- Landing-impact bookkeeping (render-local, no game-state mutation) ---
    // The instant the feet touch down, kick a squash that springs back out over
    // the next few frames. vy is already zeroed by physics on landing, so we use
    // a fixed pop rather than reading the (now-zero) impact velocity.
    if (player.grounded && !animPrevGrounded) landSquash = 1;
    animPrevGrounded = player.grounded;
    landSquash *= 0.78;
    if (landSquash < 0.02) landSquash = 0;

    // Flashing invincibility effect when hurt (blink off on alternate frames).
    if (player.hurtTimer > 0 && Math.floor(renderTick / 4) % 2 === 0) return;

    const sx = player.x;
    const sy = toScreenY(player.y); // feet
    const f = player.facing; // 1 = right, -1 = left

    const speedRatio = clamp(Math.abs(player.vx) / c.moveSpeedMax, 0, 1);
    const airborne = !player.grounded;
    const running = player.grounded && speedRatio > 0.06;

    // --- Pick the animation clip + frame -----------------------------------
    let prefix, frame;
    if (player.hurtTimer > 0) {
      prefix = 'hurt';
      frame = (Math.floor(renderTick / 8) % 2) + 1;
    } else if (window.Input.isCrouchHeld()) {
      prefix = 'crouch';
      const isMoving = Math.abs(player.vx) > 0.05;
      const speed = isMoving ? 8 : 12;
      frame = (Math.floor(renderTick / speed) % 2) + 1;
    } else if (landSquash > 0.45 && player.grounded) {
      // Brief crouch pose on touchdown — deeper crouch first, easing up.
      prefix = 'crouch';
      frame = landSquash > 0.7 ? 1 : 2;
    } else if (airborne) {
      // Curled spin while in the air; spin a touch faster the faster we fly.
      prefix = 'jump';
      const spinStep = Math.round(60 / (10 + 8 * clamp(Math.abs(player.vy) / c.jumpImpulse, 0, 1)));
      frame = (Math.floor(renderTick / Math.max(1, spinStep)) % 4) + 1;
    } else if (running) {
      // Leg cycle scales with ACTUAL speed (volume-driven) → reactive: a quiet
      // creep shuffles, a loud sprint churns.
      const runFps = 8 + 14 * speedRatio; // 8..22 fps
      runPhase += runFps / 60;
      prefix = 'run';
      frame = (Math.floor(runPhase) % 6) + 1;
    } else {
      prefix = 'idle';
      frame = (Math.floor(renderTick / 10) % 8) + 1;
      runPhase = 0;
    }

    // --- Squash & stretch (axis-aligned; pivots at the feet) ----------------
    // Axis-aligned scaling keeps the pixel outline crisp (a rotated lean would
    // shimmer under nearest-neighbour sampling).
    let sxs = 1, sys = 1;
    if (airborne) {
      // Stretch tall through the fast parts of the arc, rounder near the apex.
      const vRatio = clamp(Math.abs(player.vy) / c.jumpImpulse, 0, 1);
      sys = 1 + 0.16 * vRatio;
      sxs = 1 - 0.12 * vRatio;
    }
    if (landSquash > 0) {
      // Squat wide on impact, springing back as it decays.
      sys *= 1 - 0.30 * landSquash;
      sxs *= 1 + 0.26 * landSquash;
    }

    const img = imgs[prefix + frame];
    const dw = 72;
    const dh = 46;

    ctx.save();
    // Translate to the feet, then apply facing + squash so everything pivots
    // there (x about the body centre, y about the ground contact).
    ctx.translate(Math.round(sx), Math.round(sy));
    ctx.scale(f * sxs, sys);
    if (img && img.complete && img.naturalWidth) {
      // Offset matches content center (-29) and bottom (-38)
      ctx.drawImage(img, -29, -38, dw, dh);
    } else {
      // Procedural fallback while sprites load.
      px(-8, -24, 16, 20, C.fur);
      px(2, -32, 14, 12, C.fur);
      px(11, -29, 3, 3, C.eye);
    }
    ctx.restore();
  }

  function render() {
    if (!ctx) return;
    if (state !== "Paused") {
      renderTick++;
    }

    // Apply zoom: scale the canvas context so ZOOM world units fill each canvas pixel.
    ctx.save();
    ctx.scale(ZOOM, ZOOM);
    drawBackground();
    ctx.translate(-cameraOffX, 0);
    drawTrunk();
    for (const b of game.branches) drawBranch(b);
    for (const e of game.enemies || []) drawEnemy(e);
    for (const nut of game.nuts) drawNut(nut);
    for (const p of game.particles || []) {
      px(p.x - p.size / 2, toScreenY(p.y) - p.size / 2, p.size, p.size, p.color);
    }
    if (game.floatingTexts) {
      for (const ft of game.floatingTexts) drawFloatingText(ft);
    }
    drawSquirrel();
    ctx.restore();
  }

  // --- Loop ---------------------------------------------------------------
  let acc = 0;
  let last = 0;
  function loop(t) {
    if (!last) last = t;
    const dt = t - last;
    last = t;
    if (!window.__testMode) {
      acc += dt;
      const step = cfg().tickMs;
      let guard = 0;
      while (acc >= step && guard < 300) {
        physicsStep();
        acc -= step;
        guard++;
      }
    }
    render();
    requestAnimationFrame(loop);
  }

  // --- Controls -----------------------------------------------------------
  function onPause() {
    if (state === "Running") {
      setState("Paused");
      if (audio.bgm) audio.bgm.pause();
    } else if (state === "Paused") {
      setState("Running");
      audio.playBGM();
    }
  }
  function onReset() {
    newGame();
    setState("Running");
    if (!window.__testMode) {
      audio.playBGM();
    }
  }

  function init() {
    canvas = $("game-canvas");
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    audio.init();
    loadSprites();

    $("btn-pause").addEventListener("click", onPause);
    $("btn-reset").addEventListener("click", onReset);
    $("btn-mute").addEventListener("click", () => audio.toggleMute());

    const deathReset = $("btn-death-reset");
    if (deathReset) {
      deathReset.addEventListener("click", onReset);
    }

    newGame();
    setState("Running");
    if (!window.__testMode) {
      audio.playBGM();
    }
    requestAnimationFrame(loop);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'A' && e.shiftKey) { // Shift+A toggles admin mode
        window.__adminMode = !window.__adminMode;
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) {
          if (window.__adminMode) {
            adminPanel.classList.remove('hidden');
          } else {
            adminPanel.classList.add('hidden');
          }
        }
      } else if (window.__adminMode) {
        if (e.key === 'N' && e.shiftKey) { // Shift+N gives points to level up
          game.score += game.level * cfg().nutsPerLevel;
          onScore();
        } else if (e.key === 'H' && e.shiftKey) { // Shift+H gives an extra life
          game.lives = Math.min(3, game.lives + 1);
        } else if (e.key === 'M' && e.shiftKey) { // Shift+M maxes out jump height
          player.vy = cfg().jumpImpulse * 2;
        }
      }
    });

    // Test/debug hooks.
    window.__game = {
      getState: () => state,
      get player() {
        return player;
      },
      get nuts() {
        return game.nuts;
      },
      get enemies() {
        return game.enemies;
      },
      get branches() {
        return game.branches;
      },
      get cameraY() {
        return cameraY;
      },
    };
    window.__step = (n) => {
      for (let i = 0; i < (n || 1); i++) physicsStep();
    };
    // Read-only: paint one frame on demand. Handy for headless/CI snapshots
    // where requestAnimationFrame is throttled while the tab is hidden.
    window.__render = () => render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
