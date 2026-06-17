export const SAVE_KEY = "klangnuesse_save_v1";

const DEFAULT_STATE = {
  logbook: {
    runs: 0,
    maxHeight: 0,
    totalNuts: 0,
    anyPB: null // Time in milliseconds
  },
  currency: {
    goldenAcorns: 0
  },
  upgrades: {
    resonantLungs: 0,
    bellowingVoice: 0,
    acornAttractor: 0,
    fluffyTail: 0
  }
};

const UPGRADE_COSTS = [5, 15, 35, 75, 150]; // Costs for level 1, 2, 3, 4, 5

class StatsManager {
  constructor() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  load() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with default state to handle schema additions
        this.state = {
          logbook: { ...DEFAULT_STATE.logbook, ...(parsed.logbook || {}) },
          currency: { ...DEFAULT_STATE.currency, ...(parsed.currency || {}) },
          upgrades: { ...DEFAULT_STATE.upgrades, ...(parsed.upgrades || {}) }
        };
      }
    } catch (e) {
      console.warn("Failed to load save data, starting fresh.", e);
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      // Dispatch event to update UI
      window.dispatchEvent(new Event('stats-updated'));
    } catch (e) {
      console.error("Failed to save data.", e);
    }
  }

  addRunStats(distance, nuts, timeMs) {
    this.state.logbook.runs++;
    this.state.logbook.totalNuts += nuts;
    
    if (distance > this.state.logbook.maxHeight) {
      this.state.logbook.maxHeight = distance;
    }

    const earnedAcorns = Math.floor(nuts / 10);
    this.state.currency.goldenAcorns += earnedAcorns;

    this.save();
    return earnedAcorns;
  }

  getUpgradeCost(level) {
    if (level >= UPGRADE_COSTS.length) return -1; // Max level
    return UPGRADE_COSTS[level];
  }

  buyUpgrade(upgradeId) {
    const currentLevel = this.state.upgrades[upgradeId];
    if (currentLevel === undefined) return false;
    
    const cost = this.getUpgradeCost(currentLevel);
    if (cost === -1) return false; // Max level

    if (this.state.currency.goldenAcorns >= cost) {
      this.state.currency.goldenAcorns -= cost;
      this.state.upgrades[upgradeId]++;
      this.save();
      return true;
    }
    return false;
  }

  exportBase64() {
    return btoa(JSON.stringify(this.state));
  }

  importBase64(base64str) {
    try {
      const parsed = JSON.parse(atob(base64str));
      if (parsed && parsed.logbook && parsed.currency && parsed.upgrades) {
        this.state = parsed;
        this.save();
        return true;
      }
    } catch (e) {
      console.error("Failed to import save.", e);
    }
    return false;
  }
}

export const statsManager = new StatsManager();
