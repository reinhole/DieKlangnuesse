import { GameState, clamp } from './GameState.js';
import { cfg, W, VH, cameraOffX, ASSET_BASE, C, toScreenY, ZOOM } from './Config.js';
import { getBranchHitboxes, getSurfaceY } from './PhysicsUtils.js';

export let canvas, ctx;

export function initRenderer(cvs) {
  canvas = cvs;
  ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  loadSprites();
}

// --- Sprite assets ---------------------------------------------------------
const baseImgs = {};
const winterImgs = {};

export const imgs = new Proxy(baseImgs, {
  get(target, prop) {
    const isWinter = GameState.game && GameState.game.level2StartY !== undefined && GameState.player.y >= GameState.game.level2StartY;
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

export function loadSprites() {
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
  loadImg('trunk', '/ENVIRONMENT/trunk-repeat.png');

  const fPrefix = '/assets/fort-of-illusion/Layers/';
  const wPrefix = '/assets/sunnyland-winter/';
  loadImg('bgClouds', fPrefix + 'back.png', winterImgs, true);
  loadImg('bgMountains', fPrefix + 'mountains.png', winterImgs, true);
  loadImg('branch3', wPrefix + 'props-sliced/branche-left.gif', winterImgs, true);
  loadImg('branch5', wPrefix + 'props-sliced/branche-right.gif', winterImgs, true);
  loadImg('tileset', wPrefix + 'tileset.png', winterImgs, true);
  loadImg('trunk', wPrefix + 'trunk-repeat.png', winterImgs, true);
}

// Safe draw: skips if the image isn't loaded (avoids InvalidStateError throws).
function spr(img, dx, dy, dw, dh) {
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
}

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
    const y = startY + GameState.cameraY * speed;
    ctx.drawImage(img, 0, Math.round(y), sw, sh);
  } else if (shouldLoop) {
    const off = (GameState.cameraY * speed) % sh;
    for (let y = -sh + off; y < VH + sh; y += sh) {
      ctx.drawImage(img, 0, Math.round(y), sw, sh);
    }
  } else {
    const y = GameState.cameraY * speed;
    ctx.drawImage(img, 0, Math.round(y), sw, sh);
  }
}

function drawBackground() {
  const floorY = toScreenY(40, GameState.cameraY);
  
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
  const isWinter = GameState.game && GameState.game.level2StartY !== undefined && GameState.player.y >= GameState.game.level2StartY;
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
  const img = imgs.trunk;

  if (img && img.complete && img.naturalWidth) {
    const tx = W / 2 - 48;
    const h = img.height; // 192
    
    // We start the trunk at ground level (40) and it repeats upwards and downwards.
    const trunkStartY = 40; 

    // We only need to draw tiles that are visible
    const minVisibleY = GameState.cameraY - VH;
    const maxVisibleY = GameState.cameraY + VH;
    
    // Calculate which trunk loops to draw based on world Y coordinates
    const startK = Math.floor((minVisibleY - trunkStartY) / h);
    const endK = Math.ceil((maxVisibleY - trunkStartY) / h);

    for (let k = startK; k <= endK; k++) {
      const wy = trunkStartY + k * h;
      const screenY = Math.floor(toScreenY(wy + h, GameState.cameraY));
      
      // Draw exactly h pixels (no +1 stretching hack) to maintain perfect seamless pixels
      ctx.drawImage(img, Math.floor(tx), screenY, 96, h);
    }
  } else {
    // Fallback: procedural bark rectangle while assets load
    const tx = W / 2 - 28;
    px(tx, 0, 56, VH, C.bark);
    for (let i = 0; i < 8; i++) {
      const yy = ((i * 90 - GameState.cameraY * 0.6) % VH + VH) % VH;
      px(tx + 6, yy, 4, 40, C.barkDark);
      px(tx + 40, yy + 24, 4, 32, C.barkLight);
      px(tx + 22, yy + 60, 3, 28, C.barkDark);
    }
  }
}

function drawBranch(b) {
  if (b.ground) {
    const y = Math.floor(toScreenY(b.top, GameState.cameraY));
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
        ctx.drawImage(img, gCol * 16, 8 * 16, 16, 16, drawX, y, drawW, 16);

        // Draw dirt layers underneath down to the bottom of the viewport
        let row = 1;
        while (true) {
          const dy = y + row * 16;
          if (dy >= VH) break;

          let dCol = gCol; 
          let dRow = 9; // First dirt layer
          if (row > 1) dRow = 10; // Deeper dirt layer
          
          ctx.drawImage(img, dCol * 16, dRow * 16, 16, 16, drawX, dy, drawW, 16);
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
  const screenY = toScreenY(b.top, GameState.cameraY);
  const pointsRight = b.pointsRight !== undefined ? b.pointsRight : (b.x + b.w / 2 > W / 2);
  const isWinterBranch = GameState.game && GameState.game.level2StartY !== undefined && b.top >= GameState.game.level2StartY;
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
  if (window.__showHitboxes) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    const hitboxes = getBranchHitboxes(b);
    for (const h of hitboxes) {
      const hx = b.x + h.x;
      const hw = h.w;
      const htop = toScreenY(b.top + h.yOffset, GameState.cameraY);
      ctx.strokeRect(Math.round(hx), Math.round(htop), Math.round(hw), 2);
    }
    ctx.restore();
  }
}

function drawEnemy(e) {
  const sx = e.x;
  
  // Snap enemy to the precise multi-segment surface
  const surfaceY = getSurfaceY(e.x, e.y, GameState.game.branches);
  const sy = toScreenY(surfaceY, GameState.cameraY);
  
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
  
  if (window.__showHitboxes) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(e.x - e.w / 2), Math.round(sy - e.h / 2), e.w, e.h);
    ctx.restore();
  }
}

let preRenderedHeart = null;
let lastHeartColor = null;

function getPreRenderedHeart() {
  if (preRenderedHeart && lastHeartColor === GameState.themeColors.heartColor) {
    return preRenderedHeart;
  }
  
  lastHeartColor = GameState.themeColors.heartColor;
  const canvas = document.createElement('canvas');
  canvas.width = 13;
  canvas.height = 11;
  const tCtx = canvas.getContext('2d');
  
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
    1: GameState.themeColors.heartOutline || '#241404',
    2: GameState.themeColors.heartColor || '#ff3b55',
    3: GameState.themeColors.heartHighlight || '#ffffff'
  };
  
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val !== 0) {
        tCtx.fillStyle = colors[val];
        tCtx.fillRect(c, r, 1, 1);
      }
    }
  }
  
  preRenderedHeart = canvas;
  return preRenderedHeart;
}

function drawHeart(sx, sy) {
  const bob = Math.sin(GameState.renderTick * 0.08) * 3;
  const centerY = sy + bob;
  
  const startX = Math.round(sx - 6);
  const startY = Math.round(centerY - 5);
  
  ctx.drawImage(getPreRenderedHeart(), startX, startY);
}

function drawNut(nut) {
  if (nut.collected) return;
  const sx = nut.x;
  const sy = toScreenY(nut.y, GameState.cameraY);

  if (nut.isHeart) {
    drawHeart(sx, sy);
    return;
  }

  // Slower animation: advance one frame every 12 render ticks (was 4).
  const frame = (Math.floor(GameState.renderTick / 12) % 3) + 1;
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
  const sy = toScreenY(ft.y, GameState.cameraY);
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
  if (GameState.player.grounded && !GameState.animPrevGrounded) GameState.landSquash = 1;
  GameState.animPrevGrounded = GameState.player.grounded;
  GameState.landSquash *= 0.78;
  if (GameState.landSquash < 0.02) GameState.landSquash = 0;

  // Flashing invincibility effect when hurt (blink off on alternate frames).
  if (GameState.player.hurtTimer > 0 && Math.floor(GameState.renderTick / 4) % 2 === 0) return;

  const sx = GameState.player.x;
  const sy = toScreenY(GameState.player.y, GameState.cameraY); // feet
  const f = GameState.player.facing; // 1 = right, -1 = left

  const speedRatio = clamp(Math.abs(GameState.player.vx) / c.moveSpeedMax, 0, 1);
  const airborne = !GameState.player.grounded;
  const running = GameState.player.grounded && speedRatio > 0.06;

  // --- Pick the animation clip + frame -----------------------------------
  let prefix, frame;
  if (GameState.player.hurtTimer > 0) {
    prefix = 'hurt';
    frame = (Math.floor(GameState.renderTick / 8) % 2) + 1;
  } else if (window.Input.isCrouchHeld()) {
    prefix = 'crouch';
    const isMoving = Math.abs(GameState.player.vx) > 0.05;
    const speed = isMoving ? 8 : 12;
    frame = (Math.floor(GameState.renderTick / speed) % 2) + 1;
  } else if (GameState.landSquash > 0.45 && GameState.player.grounded) {
    // Brief crouch pose on touchdown — deeper crouch first, easing up.
    prefix = 'crouch';
    frame = GameState.landSquash > 0.7 ? 1 : 2;
  } else if (airborne) {
    // Curled spin while in the air; spin a touch faster the faster we fly.
    prefix = 'jump';
    const spinStep = Math.round(60 / (10 + 8 * clamp(Math.abs(GameState.player.vy) / c.jumpImpulse, 0, 1)));
    frame = (Math.floor(GameState.renderTick / Math.max(1, spinStep)) % 4) + 1;
  } else if (running) {
    // Leg cycle scales with ACTUAL speed (volume-driven) → reactive: a quiet
    // creep shuffles, a loud sprint churns.
    const runFps = 8 + 14 * speedRatio; // 8..22 fps
    GameState.runPhase += runFps / 60;
    prefix = 'run';
    frame = (Math.floor(GameState.runPhase) % 6) + 1;
  } else {
    prefix = 'idle';
    frame = (Math.floor(GameState.renderTick / 10) % 8) + 1;
    GameState.runPhase = 0;
  }

  // --- Squash & stretch (axis-aligned; pivots at the feet) ----------------
  let sxs = 1, sys = 1;
  if (airborne) {
    const vRatio = clamp(Math.abs(GameState.player.vy) / c.jumpImpulse, 0, 1);
    sys = 1 + 0.16 * vRatio;
    sxs = 1 - 0.12 * vRatio;
  }
  if (GameState.landSquash > 0) {
    sys *= 1 - 0.30 * GameState.landSquash;
    sxs *= 1 + 0.26 * GameState.landSquash;
  }

  const img = imgs[prefix + frame];
  const dw = 72;
  const dh = 46;

  ctx.save();
  ctx.translate(Math.round(sx), Math.round(sy));
  ctx.scale(f * sxs, sys);
  if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, -29, -38, dw, dh);
  } else {
    px(-8, -24, 16, 20, C.fur);
    px(2, -32, 14, 12, C.fur);
    px(11, -29, 3, 3, C.eye);
  }
  ctx.restore();
}

export function render() {
  if (!ctx) return;
  
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  
  drawBackground();
  ctx.translate(-cameraOffX, 0);
  drawTrunk();
  for (const b of GameState.game.branches) drawBranch(b);
  for (const e of GameState.game.enemies || []) drawEnemy(e);
  for (const nut of GameState.game.nuts) drawNut(nut);
  for (const p of GameState.game.particles || []) {
    px(p.x - p.size / 2, toScreenY(p.y, GameState.cameraY) - p.size / 2, p.size, p.size, p.color);
  }
  if (GameState.game.floatingTexts) {
    for (const ft of GameState.game.floatingTexts) drawFloatingText(ft);
  }
  

  drawSquirrel();
  ctx.restore();
}
