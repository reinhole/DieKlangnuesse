import { ASSET_BASE, SOUND_PATHS } from './Config.js';

export class AudioController {
  constructor() {
    this.muted = false;
    this.bgm = null;
    this.sounds = {};
    this.autoplayHandlerAdded = false;
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
      el.classList.toggle('muted', this.muted);
      el.setAttribute('aria-label', this.muted ? "Unmute" : "Mute");
    }
  }

  playBGM() {
    if (!this.bgm) return;
    this.bgm.play().catch(() => {
      if (this.autoplayHandlerAdded) return;
      this.autoplayHandlerAdded = true;
      const startOnInteraction = () => {
        if (this.bgm && !this.muted && this.bgm.paused) {
          this.bgm.play().catch(() => {});
        }
        window.removeEventListener('click', startOnInteraction);
        window.removeEventListener('keydown', startOnInteraction);
        window.removeEventListener('touchstart', startOnInteraction);
        this.autoplayHandlerAdded = false;
      };
      window.addEventListener('click', startOnInteraction);
      window.addEventListener('keydown', startOnInteraction);
      window.addEventListener('touchstart', startOnInteraction);
    });
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

export const audio = new AudioController();
