import { GameState } from './GameState.js';

export function getBranchHitboxes(b) {
  if (b._hitboxes) return b._hitboxes;

  let boxes = [];
  if (b.ground) {
    boxes = [{x: b.x, w: b.w, yOffset: 0}];
  } else {
    const isWinter = GameState.game && GameState.game.level2StartY !== undefined && b.top >= GameState.game.level2StartY;
    
    if (isWinter) {
      boxes = [{x: 2, w: b.w - 4, yOffset: 0}];
    } else if (b.type === 3) {
      // type 3 (leafy branch): base on left, tip on right.
      // Base connects low (-6), tip curves up (6)
      boxes = [
        {x: 10, w: 10, yOffset: -18},
        {x: 20, w: 10, yOffset: -16},
        {x: 30, w: 10, yOffset: -8},
        {x: 40, w: 10, yOffset: -6},
        {x: 50, w: 10, yOffset: -2},
        {x: 60, w: 10, yOffset: -0},
        {x: 70, w: 10, yOffset: 2},
        {x: 80, w: 10, yOffset: 4},
      ];
    } else {
      // type 5 (dark branch): tip on left, base on right.
      // Tip curves up (4), base connects low (-6)
      boxes = [
        {x: 10,  w: 10, yOffset: 2},
        {x: 20,  w: 10, yOffset: -1},
        {x: 30,  w: 10, yOffset: -6},
        {x: 40,  w: 10, yOffset: -6},
        {x: 50,  w: 10, yOffset: -5},
        {x: 60,  w: 10, yOffset: -4},
        {x: 70,  w: 10, yOffset: -2},
        {x: 80,  w: 10, yOffset: 1}
      ];
    }

    if (!b.pointsRight) {
      boxes = boxes.map(box => ({
        x: b.w - (box.x + box.w),
        w: box.w,
        yOffset: box.yOffset
      }));
    }
  }

  b._hitboxes = boxes;
  return boxes;
}

export function getSurfaceY(x, baseY, branches) {
  let surfaceY = baseY;
  const branch = branches.find(b => b.top === baseY && x >= b.x - 30 && x <= b.x + b.w + 30);
  if (branch) {
    const hitboxes = getBranchHitboxes(branch);
    for (const h of hitboxes) {
      const hx = branch.x + h.x;
      if (x >= hx && x <= hx + h.w) {
        surfaceY = branch.top + h.yOffset;
        break;
      }
    }
  }
  return surfaceY;
}

export function checkAABBCentered(x1, y1, w1, h1, x2, y2, w2, h2, paddingX = 0, paddingY = 0) {
  const overlapX = Math.abs(x1 - x2) < (w1 / 2 + w2 / 2 - paddingX);
  const overlapY = Math.abs(y1 - y2) < (h1 / 2 + h2 / 2 - paddingY);
  return overlapX && overlapY;
}

export function getPlatformLandingY(playerX, playerW, playerY, prevY, wasGrounded, isCrouchHeld, branches) {
  let finalHtop = null;
  for (const b of branches) {
    if (isCrouchHeld && !b.ground) {
      continue;
    }
    
    let bestHtop = -Infinity;
    let validHit = false;
    
    const hitboxes = getBranchHitboxes(b);
    for (const h of hitboxes) {
      const hx = b.x + h.x;
      const hw = h.w;
      const htop = b.top + h.yOffset;
      
      const overlapX = playerX + playerW / 2 > hx && playerX - playerW / 2 < hx + hw;
      const stepLeniency = wasGrounded ? 12 : 0;
      const dropLeniency = wasGrounded ? 12 : 0;
      
      if (overlapX && prevY + stepLeniency >= htop && playerY - dropLeniency <= htop) {
        if (htop > bestHtop) {
          bestHtop = htop;
          validHit = true;
        }
      }
    }
    
    if (validHit) {
      finalHtop = bestHtop;
      break;
    }
  }
  return finalHtop;
}
