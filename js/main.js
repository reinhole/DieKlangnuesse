import './rng.js';
import './input.js';
import { GameState } from './GameState.js';
import { cfg } from './Config.js';
import { audio } from './AudioController.js';
import { $, setState } from './DOMUpdater.js';
import { newGame } from './LevelGenerator.js';
import { physicsStep, onScore } from './PhysicsEngine.js';
import { initRenderer, render } from './Renderer.js';

window.__adminMode = false;

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
  if (GameState.state !== "Paused") {
    GameState.renderTick++;
  }
  render();
  requestAnimationFrame(loop);
}

// --- Controls -----------------------------------------------------------
function onPause() {
  if (GameState.state === "Running") {
    setState("Paused");
    if (audio.bgm) audio.bgm.pause();
  } else if (GameState.state === "Paused") {
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
  const canvas = $("game-canvas");
  initRenderer(canvas);
  
  audio.init();

  const pauseBtn = $("btn-pause");
  if (pauseBtn) pauseBtn.addEventListener("click", onPause);
  
  const resetBtn = $("btn-reset");
  if (resetBtn) resetBtn.addEventListener("click", onReset);
  
  const muteBtn = $("btn-mute");
  if (muteBtn) muteBtn.addEventListener("click", () => audio.toggleMute());

  const deathReset = $("btn-death-reset");
  if (deathReset) {
    deathReset.addEventListener("click", onReset);
  }

  const tabs = ['adventure', 'shrine', 'logbook'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`btn-tab-${tab}`);
    if (btn) {
      btn.addEventListener('click', () => {
        tabs.forEach(t => {
          document.getElementById(`btn-tab-${t}`).classList.remove('active');
          document.getElementById(`content-${t}`).classList.add('hidden');
        });
        btn.classList.add('active');
        document.getElementById(`content-${tab}`).classList.remove('hidden');
      });
    }
  });

  const btnSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsMenu = document.getElementById('settings-menu');
  if (btnSettings && settingsMenu) {
    btnSettings.addEventListener('click', () => settingsMenu.showModal());
    btnCloseSettings.addEventListener('click', () => settingsMenu.close());
  }

  const btnResume = document.getElementById('btn-resume');
  const btnAbort = document.getElementById('btn-abort');
  if (btnResume) btnResume.addEventListener('click', onPause);
  if (btnAbort) btnAbort.addEventListener('click', () => {
    GameState.game.lives = 0;
    setState("Game Over");
  });

  const btnDeathReset = document.querySelector('[data-testid="btn-death-reset"]');
  if (btnDeathReset) btnDeathReset.addEventListener("click", () => {
    newGame();
    setState("Running");
  });

  const btnDeathHome = document.querySelector('[data-testid="btn-death-home"]');
  if (btnDeathHome) btnDeathHome.addEventListener("click", () => {
    newGame();
    setState("Home");
  });

  const startAdvBtn = document.getElementById("btn-start-adventure");
  if (startAdvBtn) {
    startAdvBtn.addEventListener("click", () => {
      setState("Running");
      if (!window.__testMode) {
        audio.playBGM();
        if (window.Input && window.Input.enableMic) {
          window.Input.enableMic();
        }
      }
    });
  }

  newGame();
  setState("Home");
  requestAnimationFrame(loop);

  // --- Admin Mode Actions ---
  window.__showHitboxes = false;
  const adminPanel = document.getElementById('admin-panel');
  
  const toggleAdmin = () => {
    window.__adminMode = !window.__adminMode;
    if (adminPanel) {
      if (window.__adminMode) {
        adminPanel.classList.remove('hidden');
      } else {
        adminPanel.classList.add('hidden');
      }
    }
  };

  const adminActions = {
    godMode: () => { GameState.player.invincible = !GameState.player.invincible; },
    addLife: () => { GameState.game.lives = Math.min(3, GameState.game.lives + 1); },
    addNuts: () => { GameState.game.score += 100; onScore(); },
    superJump: () => { GameState.player.vy = cfg().jumpImpulse * 2; },
    killEnemies: () => { if (GameState.game.enemies) GameState.game.enemies = []; },
    teleportUp: () => {
      if (GameState.game && GameState.game.topY) {
        GameState.player.y = GameState.game.topY - 100;
        GameState.cameraY = Math.max(0, GameState.player.y - 200);
      }
    },
    spawnHeart: () => {
      GameState.game.nuts.push({ x: GameState.player.x, y: GameState.player.y + 60, collected: false, id: Date.now(), isHeart: true });
      import('./DOMUpdater.js').then(m => m.buildNutDOM());
    },
    spawnPlatform: () => {
      GameState.game.branches.push({ x: GameState.player.x - 40, w: 100, top: GameState.player.y - 20, type: 3 });
    },
    toggleHitboxes: () => {
      window.__showHitboxes = !window.__showHitboxes;
      const btn = document.getElementById('btn-admin-hitboxes');
      if (btn) {
        btn.classList.toggle('active', window.__showHitboxes);
        btn.textContent = window.__showHitboxes ? "Show Hitboxes: ON" : "Show Hitboxes: OFF";
      }
    }
  };

  // Bind Buttons
  const bindBtn = (id, action) => { const el = document.getElementById(id); if (el) el.addEventListener('click', action); };
  bindBtn('btn-admin-god', adminActions.godMode);
  bindBtn('btn-admin-life', adminActions.addLife);
  bindBtn('btn-admin-nuts', adminActions.addNuts);
  bindBtn('btn-admin-jump', adminActions.superJump);
  bindBtn('btn-admin-kill', adminActions.killEnemies);
  bindBtn('btn-admin-teleport', adminActions.teleportUp);
  bindBtn('btn-admin-spawn-heart', adminActions.spawnHeart);
  bindBtn('btn-admin-spawn-plat', adminActions.spawnPlatform);
  bindBtn('btn-admin-hitboxes', adminActions.toggleHitboxes);

  // Bind Sliders
  const bindSlider = (id, valId, configKey) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (el && valEl) {
      el.value = window.__config[configKey];
      valEl.textContent = el.value;
      el.addEventListener('input', (e) => {
        window.__config[configKey] = parseFloat(e.target.value);
        valEl.textContent = e.target.value;
      });
    }
  };
  bindSlider('admin-gravity', 'admin-gravity-val', 'gravity');
  bindSlider('admin-jump-impulse', 'admin-jump-impulse-val', 'jumpImpulse');
  bindSlider('admin-speed', 'admin-speed-val', 'tickMs');

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (GameState.state === "Running" || GameState.state === "Paused") onPause();
    }
    if (e.key === 'A' && e.shiftKey) { toggleAdmin(); }
    else if (window.__adminMode) {
      if (e.key === 'N' && e.shiftKey) adminActions.teleportUp();
      else if (e.key === 'H' && e.shiftKey) adminActions.addLife();
      else if (e.key === 'M' && e.shiftKey) adminActions.superJump();
      else if (e.key === 'I' && e.shiftKey) adminActions.godMode();
      else if (e.key === 'K' && e.shiftKey) adminActions.killEnemies();
      else if (e.key === 'O' && e.shiftKey) adminActions.spawnHeart();
      else if (e.key === 'V' && e.shiftKey) adminActions.addNuts();
      else if (e.key === 'S' && e.shiftKey) adminActions.spawnPlatform();
    }
  });

  // Test/debug hooks.
  window.__game = {
    getState: () => GameState.state,
    get player() {
      return GameState.player;
    },
    get nuts() {
      return GameState.game.nuts;
    },
    get enemies() {
      return GameState.game.enemies;
    },
    get branches() {
      return GameState.game.branches;
    },
    get cameraY() {
      return GameState.cameraY;
    },
    GameState: GameState
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
