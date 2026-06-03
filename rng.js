// Seedable PRNG (mulberry32) — the single source of randomness for game logic.
// Game code MUST use window.__rng.next() instead of Math.random() so that runs
// are deterministic and reproducible (set the seed via window.__setSeed).
class SeededRNG {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  // Returns a float in [0, 1).
  next() {
    let a = this.state;
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    this.state = a;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  setSeed(seed) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }
}

// One global, seedable instance. Default seed is time-based for normal play;
// tests call window.__setSeed(n) before starting for deterministic worlds.
const initialSeed = (typeof window !== 'undefined' && window.__initialSeed !== undefined) ? window.__initialSeed : Date.now();
const globalRNG = new SeededRNG(initialSeed);

window.__rng = globalRNG;
window.__setSeed = (seed) => globalRNG.setSeed(seed);
