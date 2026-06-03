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
    bgm: '/Demo/assets/sounds/the_valley.ogg',
    jump: '/Demo/assets/sounds/jump.ogg',
    item: '/Demo/assets/sounds/item.ogg',
    hurt: '/Demo/assets/sounds/hurt.ogg',
    enemyDeath: '/Demo/assets/sounds/enemy-death.ogg',
  };

  class AudioController {
    constructor() {
      this.muted = false;
      this.bgm = null;
      this.sounds = {};
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
        el.textContent = this.muted ? "🔇 Unmute" : "🔊 Mute";
      }
    }

    playBGM() {
      if (!this.bgm) return;
      this.bgm.play().catch(() => {});
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
    h: 28,
    grounded: true,
    facing: 1,
    lastSafe: { x: W / 2, y: 40 },
    isVoiceJumping: false,
    airVx: 0,
    hurtTimer: 0,
  };

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
      pause.textContent = paused ? "Resume" : "Pause";
    }
  }

  // --- World generation ---------------------------------------------------
  function generateLevel() {
    const c = cfg();
    game.branches = [];
    game.nuts = [];
    game.enemies = [];
    game.particles = [];

    // Ground platform spanning the whole width.
    game.branches.push({ x: 0, w: W, top: 40, ground: true });

    const numNuts = c.nutsPerLevel + (game.level - 1);
    const spacingY = Math.min(110, c.branchSpacingV + (game.level - 1) * 2);

    let nutIdCounter = 1;

    for (let i = 0; i < numNuts; i++) {
      const top = 40 + (i + 1) * spacingY;
      
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
        const branchWidth = type === 3 ? 100 : 133;
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
        game.nuts.push({ x: cx, y: top + 16, collected: false, id: nutIdCounter++ });

        const enemySpawnChance = Math.min(0.8, 0.4 + (game.level - 1) * 0.15);
        if (window.__rng.next() < enemySpawnChance) {
          game.enemies.push({
            x: cx,
            y: top,
            w: 24,
            h: 20,
            vx: 0.8 + (game.level - 1) * 0.15,
            facing: window.__rng.next() < 0.5 ? -1 : 1,
            minX: branch.x + 16,
            maxX: branch.x + branch.w - 16,
            animFrame: 0
          });
        }
      }
    }
    game.topY = 40 + (numNuts + 1) * spacingY;
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
    game = { score: 0, lives: cfg().startLives, level: 1, enemies: [], particles: [], levelUpTimer: 0 };
    generateLevel();
    placePlayerStart();
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

  // --- Physics (the ONLY place state changes) -----------------------------
  function physicsStep() {
    if (state !== "Running") return;
    const c = cfg();
    frameCount++;

    if (player.hurtTimer > 0) player.hurtTimer--;
    if (game.levelUpTimer > 0) game.levelUpTimer--;

    const d = window.Input.getDirection();
    let vol = window.Input.getVolume();
    if (window.Input.isMicActive && !window.Input.isMicActive() && window.Input.isKeyboardMoving && window.Input.isKeyboardMoving()) {
      vol = 1.0;
    }
    const runVol = Math.min(1, vol / (c.runThreshold != null ? c.runThreshold : 0.4));

    // Horizontal speed logic:
    if (!player.grounded && player.isVoiceJumping) {
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
    player.grounded = false;
    if (player.vy <= 0) {
      for (const b of game.branches) {
        const overlapX =
          player.x + player.w / 2 > b.x && player.x - player.w / 2 < b.x + b.w;
        if (overlapX && prevY >= b.top && player.y <= b.top) {
          player.y = b.top;
          player.vy = 0;
          player.grounded = true;
          player.lastSafe = { x: player.x, y: b.top };
          player.isVoiceJumping = false;
          player.airVx = 0;
          break;
        }
      }
    }

    // Enemy movement and collision
    if (game.enemies) {
      for (let idx = game.enemies.length - 1; idx >= 0; idx--) {
        const e = game.enemies[idx];
        e.x += e.vx * e.facing;
        if (e.x <= e.minX) {
          e.x = e.minX;
          e.facing = 1;
        } else if (e.x >= e.maxX) {
          e.x = e.maxX;
          e.facing = -1;
        }
        e.animFrame = (e.animFrame + 0.15) % 8;

        if (player.hurtTimer <= 0 && state === "Running") {
          const overlapX = Math.abs(player.x - e.x) < (player.w / 2 + e.w / 2 - 4);
          const overlapY = Math.abs((player.y + player.h / 2) - (e.y + e.h / 2)) < (player.h / 2 + e.h / 2 - 2);

          if (overlapX && overlapY) {
            const isSquish = player.vy < 0 && prevY >= e.y + e.h - 6;
            if (isSquish) {
              game.enemies.splice(idx, 1);
              audio.playSFX('enemyDeath');
              player.vy = c.jumpImpulse * 0.7;
              game.score++;
              spawnParticles(e.x, e.y + e.h / 2, 12, '#b5432f');
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

    // Camera: smooth follow with snap upward, slow drift downward.
    const targetCamY = Math.max(0, player.y - c.followOffset);
    if (targetCamY > cameraY) {
      cameraY = cameraY * 0.85 + targetCamY * 0.15;
    } else {
      cameraY = Math.max(cameraY - 4, targetCamY);
    }

    // Falling below the viewport bottom costs a life.
    if (player.y < cameraY) loseLife();

    // Nut collection.
    for (const nut of game.nuts) {
      if (nut.collected) continue;
      const dx = nut.x - player.x;
      const dy = nut.y - (player.y + player.h / 2);
      if (Math.abs(dx) < 22 && Math.abs(dy) < 26) {
        nut.collected = true;
        game.score++;
        audio.playSFX('item');
        spawnParticles(nut.x, nut.y, 10, '#e8c89a');
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
      game.levelUpTimer = 90; // show level-up banner for ~1.5s
      generateLevel(); // taller fresh section
      placePlayerStart();
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

    $("score").textContent = String(game.score);
    $("lives").textContent = String(game.lives);
    $("level").textContent = String(game.level);

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
  const imgs = {};

  function loadImg(key, path) {
    const img = new Image();
    img.src = ASSET_BASE + path;
    imgs[key] = img;
  }

  function loadSprites() {
    loadImg('bgClouds',    '/ENVIRONMENT/bg-clouds.png');
    loadImg('bgMountains', '/ENVIRONMENT/bg-mountains.png');
    loadImg('bgTrees',     '/ENVIRONMENT/bg-trees.png');
    for (let i = 1; i <= 8; i++) loadImg('idle' + i, '/SPRITES/player/idle/player-idle-' + i + '.png');
    for (let i = 1; i <= 6; i++) loadImg('run'  + i, '/SPRITES/player/run/player-run-'   + i + '.png');
    for (let i = 1; i <= 4; i++) loadImg('jump' + i, '/SPRITES/player/jump/player-jump-' + i + '.png');
    for (let i = 1; i <= 3; i++) loadImg('acorn' + i, '/SPRITES/misc/acorn/acorn-' + i + '.png');
    loadImg('branch3', '/ENVIRONMENT/props-sliced/branch-03.png');
    loadImg('branch5', '/ENVIRONMENT/props-sliced/branch-05.png');
    for (let i = 1; i <= 8; i++) loadImg('ant' + i, '/SPRITES/enemies/ant/ant-' + i + '.png');
    for (let i = 1; i <= 2; i++) loadImg('hurt' + i, '/SPRITES/player/hurt/player-hurt-' + i + '.png');
    loadImg('tileset', '/ENVIRONMENT/tileset.png');
  }

  // Safe draw: skips if the image isn't loaded (avoids InvalidStateError throws).
  function spr(img, dx, dy, dw, dh) {
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  }

  // Render-local tick for animation — advances every frame, independent of
  // physicsStep so animations run even while paused or in Ready state.
  let renderTick = 0;

  // --- Rendering (read-only; never mutates state) -------------------------
  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // Tile a background layer vertically with parallax if shouldLoop is true,
  // or draw it once at the bottom if shouldLoop is false.
  function drawBgLayer(img, speed, shouldLoop = false) {
    if (!img || !img.complete || !img.naturalWidth) return;
    const sw = W;
    const sh = Math.round(img.height * (W / img.width));
    if (shouldLoop) {
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
    // Sky fill as fallback while images load.
    const grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, '#4b8fd4');
    grad.addColorStop(1, '#8dc8e8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, VH);

    drawBgLayer(imgs.bgClouds,    0.08, true);
    drawBgLayer(imgs.bgMountains, 0.18, false);
    drawBgLayer(imgs.bgTrees,     0.40, false);
  }

  function drawTrunk() {
    const img = imgs.tileset;
    const hasTileset = img && img.complete && img.naturalWidth;

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

          // Grass tile selection (Row 14 of tileset.png)
          let gCol = 9; // Default grass tile
          let drawX = x;
          let drawW = 16;
          if (col === 11) {
            gCol = 13; // Right corner edge tile immediately before trunk
            drawW = 20; // Extend slightly to overlap trunk edge
          } else if (col === 18) {
            gCol = 8;  // Left corner edge tile immediately after trunk
            drawX = x - 4; // Shift left to overlap trunk edge
            drawW = 20;
          } else {
            // Alternate middle grass tiles for variation
            const grassCols = [9, 11, 12];
            gCol = grassCols[col % grassCols.length];
          }

          // Draw top grass row (starts at top of ground platform)
          ctx.drawImage(img, gCol * 16, 14 * 16, 16, 16, drawX, Math.round(y), drawW, 17);

          // Draw dirt layers underneath down to the bottom of the viewport
          let row = 1;
          const dirtCols = [9, 11, 12, 13];
          while (true) {
            const dy = Math.round(y + row * 16);
            if (dy >= VH) break;

            const dCol = dirtCols[(col + row) % dirtCols.length];
            ctx.drawImage(img, dCol * 16, 15 * 16, 16, 16, drawX, dy, drawW, 17); // 17px height to avoid seams
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
    const raw = b.type === 3 ? imgs.branch3 : imgs.branch5;

    if (raw && raw.complete && raw.naturalWidth) {
      const dw = b.w;
      const dh = raw.height;
      const topOffset = b.type === 3 ? 2 : 12;
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
  }

  function drawEnemy(e) {
    const sx = e.x;
    const sy = toScreenY(e.y);
    const frame = (Math.floor(e.animFrame) % 8) + 1;
    const img = imgs['ant' + frame];
    const dw = 32;
    const dh = 32;
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      ctx.scale(e.facing, 1);
      ctx.drawImage(img, Math.round(-dw / 2), Math.round(-dh), Math.round(dw), Math.round(dh));
      ctx.restore();
    } else {
      px(sx - 12, sy - 14, 24, 14, '#4a2e16');
      px(sx - 8, sy - 18, 16, 6, '#4a2e16');
      px(sx - 4, sy - 14, 8, 14, '#1a1208');
    }
  }

  function drawNut(nut) {
    if (nut.collected) return;
    const sx = nut.x;
    const sy = toScreenY(nut.y);

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

  function drawSquirrel() {
    // Flashing invincibility effect when hurt
    if (player.hurtTimer > 0 && Math.floor(renderTick / 4) % 2 === 0) {
      return;
    }

    const sx = player.x;
    const sy = toScreenY(player.y); // feet
    const f = player.facing; // 1 = right, -1 = left

    const running = player.grounded && Math.abs(player.vx) > 0.2;
    const airborne = !player.grounded;

    let prefix, count, fps;
    if (player.hurtTimer > 0) { prefix = 'hurt'; count = 2; fps = 8;  }
    else if (airborne)        { prefix = 'jump'; count = 4; fps = 8;  }
    else if (running)         { prefix = 'run';  count = 6; fps = 12; }
    else                      { prefix = 'idle'; count = 8; fps = 6;  }

    const frame = (Math.floor(renderTick / Math.round(60 / fps)) % count) + 1;
    const img = imgs[prefix + frame];

    const dw = 64;
    const dh = Math.round(58 * (dw / 90)); // ≈ 41

    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      if (f === -1) {
        ctx.translate(Math.round(sx + dw / 2), 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 1, Math.round(sy - dh), Math.round(dw), Math.round(dh));
      } else {
        spr(img, sx - dw / 2, sy - dh, dw, dh);
      }
      ctx.restore();
    } else {
      // Procedural fallback while sprites load.
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(sy));
      ctx.scale(f, 1);
      px(-8, -24, 16, 20, C.fur);
      px(2, -32, 14, 12, C.fur);
      px(11, -29, 3, 3, C.eye);
      ctx.restore();
    }
  }

  function render() {
    if (!ctx) return;
    renderTick++;

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

    // Test/debug hooks.
    window.__game = {
      getState: () => state,
      get player() {
        return player;
      },
      get nuts() {
        return game.nuts;
      },
      get cameraY() {
        return cameraY;
      },
    };
    window.__step = (n) => {
      for (let i = 0; i < (n || 1); i++) physicsStep();
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
