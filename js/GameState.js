import { W } from './Config.js';

export const GameState = {
  state: "Ready",
  cameraY: 0,
  frameCount: 0,
  game: null,
  
  player: {
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
  },
  
  themeColors: {
    heartColor: '#ff3b55',
    heartHighlight: '#ffffff',
    heartOutline: '#241404'
  },

  // Render-local state
  renderTick: 0,
  animPrevGrounded: true,
  runPhase: 0,
  landSquash: 0,
};

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
