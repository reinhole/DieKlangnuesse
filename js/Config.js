export const W = 480;
export const H = 640;
export const ZOOM = 1.5;
export const VH = Math.round(H / ZOOM);            // 427 — visible world height at zoom
export const cameraOffX = Math.round((W - W / ZOOM) / 2); // 80 — horizontal crop to centre trunk

export const ASSET_BASE = '/assets/sunnyland-woods';
export const SOUND_PATHS = {
  bgm: '/sounds/the_valley.m4a',
  jump: '/sounds/jump.m4a',
  item: '/sounds/item.m4a',
  hurt: '/sounds/hurt.m4a',
  enemyDeath: '/sounds/enemy-death.m4a',
};

// Limited, Shovel-Knight-ish palette.
export const C = {
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

export const DEFAULTS = {
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

// Attach config to window for testing
window.__config = Object.assign({}, DEFAULTS, window.__initialConfig || {});

export const cfg = () => window.__config;

// World coordinate helper
export const toScreenY = (worldY, cameraY) => VH - (worldY - cameraY);
