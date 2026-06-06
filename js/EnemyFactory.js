export const ENEMY_CONFIGS = [
  {
    type: 'ant',
    probabilityWeight: 0.4,
    w: 26,
    h: 23,
    maxFrames: 8,
    baseSpeed: 0.8,
    animSpeed: 0.15,
    particleColor: '#b5432f'
  },
  {
    type: 'gator',
    probabilityWeight: 0.3,
    w: 20,
    h: 26,
    maxFrames: 4,
    baseSpeed: 0.5,
    animSpeed: 0.1,
    particleColor: '#5c8f37'
  },
  {
    type: 'grasshopper',
    probabilityWeight: 0.3,
    w: 21,
    h: 20,
    maxFrames: 4,
    baseSpeed: 1.2,
    animSpeed: 0.12,
    particleColor: '#8fa33c'
  }
];

export class EnemyFactory {
  static createRandomEnemy(x, y, level, branchMinX, branchMaxX, rng) {
    const rand = rng.next();
    let cumulative = 0;
    let selectedConfig = ENEMY_CONFIGS[ENEMY_CONFIGS.length - 1]; // Default fallback

    for (const config of ENEMY_CONFIGS) {
      cumulative += config.probabilityWeight;
      if (rand < cumulative) {
        selectedConfig = config;
        break;
      }
    }

    return {
      type: selectedConfig.type,
      x: x,
      y: y,
      w: selectedConfig.w,
      h: selectedConfig.h,
      vx: selectedConfig.baseSpeed + (level - 1) * 0.15,
      facing: rng.next() < 0.5 ? -1 : 1,
      minX: branchMinX,
      maxX: branchMaxX,
      animFrame: 0,
      maxFrames: selectedConfig.maxFrames,
      animSpeed: selectedConfig.animSpeed,
      particleColor: selectedConfig.particleColor
    };
  }
}
