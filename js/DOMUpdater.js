import { GameState } from './GameState.js';
import { cfg } from './Config.js';

const elCache = new Map();
export const $ = (id) => {
  if (!elCache.has(id)) {
    elCache.set(id, document.querySelector(`[data-testid="${id}"]`));
  }
  return elCache.get(id);
};

export function updateThemeClass() {
  const isWinter = GameState.game && GameState.game.level2StartY !== undefined && GameState.player.y >= GameState.game.level2StartY;
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

export function updateThemeColors() {
  const style = getComputedStyle(document.documentElement);
  GameState.themeColors.heartColor = style.getPropertyValue('--heart-color').trim() || '#ff3b55';
  GameState.themeColors.heartHighlight = style.getPropertyValue('--heart-highlight').trim() || '#ffffff';
  GameState.themeColors.heartOutline = style.getPropertyValue('--heart-outline').trim() || '#241404';
}

export function setState(s) {
  GameState.state = s;
  const el = $("game-status");
  if (el) el.textContent = s; // synchronous, exact-cased contract value
  updateButtons();
  syncDOM();
}

export function updateButtons() {
  const running = GameState.state === "Running";
  const paused = GameState.state === "Paused";
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

export function buildNutDOM() {
  const container = $("nuts");
  if (!container) return;
  container.innerHTML = "";
  // Clear any cached nut elements
  for (const key of elCache.keys()) {
    if (key.startsWith("nut-")) elCache.delete(key);
  }
  if (!GameState.game) return;
  for (const nut of GameState.game.nuts) {
    const span = document.createElement("span");
    span.setAttribute("data-testid", "nut-" + nut.id);
    container.appendChild(span);
  }
}

let lastState = {
  score: -1, lives: -1, level: -1, remaining: -1,
  deathScreen: null, levelUpTimer: -1, themeWinter: null,
  peGrounded: null, peX: null, peY: null
};

// Caches for non-testid elements
let cachedHearts = null;
let cachedLvlVal = null;
let cachedScoreBar = null;
let cachedDeathScreen = null;
let cachedLevelUpScreen = null;

export function syncDOM() {
  if (!GameState.game) return;
  updateThemeClass();

  if (lastState.score !== GameState.game.score) {
    const scoreEl = $("score");
    if (scoreEl) scoreEl.textContent = String(GameState.game.score);
    const scoreDisplay = document.querySelector('[data-testid="score-display"]');
    if (scoreDisplay) scoreDisplay.textContent = String(GameState.game.score);
    lastState.score = GameState.game.score;
  }

  if (lastState.lives !== GameState.game.lives) {
    const livesEl = $("lives");
    if (livesEl) livesEl.textContent = String(GameState.game.lives);

    if (!cachedHearts) cachedHearts = document.querySelectorAll(".hearts-container .heart");
    cachedHearts.forEach((heart, idx) => {
      if (idx < GameState.game.lives) {
        heart.classList.remove("empty");
      } else {
        heart.classList.add("empty");
      }
    });
    lastState.lives = GameState.game.lives;
  }

  if (lastState.level !== GameState.game.level) {
    const levelEl = $("level");
    if (levelEl) levelEl.textContent = String(GameState.game.level);

    if (!cachedLvlVal) cachedLvlVal = document.querySelector(".level-indicator .lvl-val");
    if (cachedLvlVal) cachedLvlVal.textContent = String(GameState.game.level);
    lastState.level = GameState.game.level;
  }

  // Sync dynamic score bar (smooth percentage based on height)
  if (!cachedScoreBar) cachedScoreBar = document.getElementById("level-progress");
  if (cachedScoreBar && GameState.game.levelStartY !== undefined) {
    const endY = GameState.game.topY - 800;
    const progress = Math.max(0, Math.min(100, ((GameState.player.y - GameState.game.levelStartY) / (endY - GameState.game.levelStartY)) * 100));
    cachedScoreBar.style.width = `${progress}%`;
  }

  const pe = $("player");
  if (pe) {
    const roundedX = String(Math.round(GameState.player.x));
    const roundedY = String(Math.round(GameState.player.y));
    const groundedStr = GameState.player.grounded ? "1" : "0";
    
    if (lastState.peX !== roundedX) { pe.dataset.x = roundedX; lastState.peX = roundedX; }
    if (lastState.peY !== roundedY) { pe.dataset.y = roundedY; lastState.peY = roundedY; }
    if (lastState.peGrounded !== groundedStr) { pe.dataset.grounded = groundedStr; lastState.peGrounded = groundedStr; }
  }

  let remaining = 0;
  for (const nut of GameState.game.nuts) {
    if (!nut.collected) remaining++;
    const ne = $("nut-" + nut.id);
    if (ne) {
      // Only set if different to avoid DOM mutation overhead.
      // But testing shows comparing datasets is slow, so we can cache or just write it.
      // Since it's string operations, dataset writes are slow. We cache nut states on the nut object.
      const roundedX = String(Math.round(nut.x));
      const roundedY = String(Math.round(nut.y));
      const collectedStr = nut.collected ? "1" : "0";
      
      if (nut._lastDomCollected !== collectedStr) { ne.dataset.collected = collectedStr; nut._lastDomCollected = collectedStr; }
      if (nut._lastDomX !== roundedX) { ne.dataset.x = roundedX; nut._lastDomX = roundedX; }
      if (nut._lastDomY !== roundedY) { ne.dataset.y = roundedY; nut._lastDomY = roundedY; }
    }
  }
  
  if (lastState.remaining !== remaining) {
    const nc = $("nut-count");
    if (nc) nc.textContent = String(remaining);
    lastState.remaining = remaining;
  }

  // Death screen overlay sync
  if (!cachedDeathScreen) cachedDeathScreen = document.getElementById("death-screen");
  if (cachedDeathScreen) {
    const isGameOver = GameState.state === "Game Over";
    if (lastState.deathScreen !== isGameOver) {
      if (isGameOver) {
        if (!cachedDeathScreen.open) cachedDeathScreen.showModal();
        const deathScore = $("death-score");
        if (deathScore) deathScore.textContent = String(GameState.game.score);
        const deathLevel = $("death-level");
        if (deathLevel) deathLevel.textContent = String(GameState.game.level);
      } else {
        if (cachedDeathScreen.open) cachedDeathScreen.close();
      }
      lastState.deathScreen = isGameOver;
    }
  }

  // Story screen overlay sync
  const storyScreen = document.getElementById("story-screen");
  if (storyScreen) {
    const isStory = GameState.state === "Story";
    if (lastState.storyScreen !== isStory) {
      if (isStory) {
        if (!storyScreen.open) storyScreen.showModal();
      } else {
        if (storyScreen.open) storyScreen.close();
      }
      lastState.storyScreen = isStory;
    }
  }

  // Level up overlay sync
  if (!cachedLevelUpScreen) cachedLevelUpScreen = document.getElementById("level-up-screen");
  if (cachedLevelUpScreen) {
    const isLevelUp = GameState.game.levelUpTimer > 0;
    if (lastState.levelUpTimer !== isLevelUp) {
      if (isLevelUp) {
        if (!cachedLevelUpScreen.open) cachedLevelUpScreen.showModal();
        const levelUpNum = $("level-up-num");
        if (levelUpNum) levelUpNum.textContent = String(GameState.game.level);
      } else {
        if (cachedLevelUpScreen.open) cachedLevelUpScreen.close();
      }
      lastState.levelUpTimer = isLevelUp;
    }
  }

  if (window.Input && window.Input.updateMeter) window.Input.updateMeter();
}
