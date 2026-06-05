// Input layer for "Die Klangnüsse".
//
// The engine reads a single facade each physics tick:
//   Input.getVolume()    -> number in [0,1]  (loudness; drives speed + jump)
//   Input.getDirection() -> -1 | 0 | 1       (facing/move direction)
//   Input.consumeJump()  -> boolean          (rising-edge jump request)
//
// Two sources feed the facade:
//   * ManualInput (always available, fully testable): the volume slider,
//     the on-screen left/right/jump buttons, and the arrow keys.
//   * MicInput (optional enhancement): the microphone, layered on top via
//     getUserMedia + Web Audio. It drives the SAME volume value, so the game
//     plays identically with or without a mic. Tests never touch the mic.
//
// Test hooks: window.__setVolume(0..1), window.__setDirection(-1..1|null),
// window.__queueJump().
(function () {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);

  // --- Manual state -------------------------------------------------------
  let manualVolume = 0; // set by the slider or window.__setVolume
  let dirOverride = null; // set by window.__setDirection; null => use buttons/keys
  let leftHeld = false;
  let rightHeld = false;
  let jumpQueued = false; // one-shot from the Jump button / key / __queueJump
  let jumpHeld = false;
  let crouchHeld = false;
  let crouchOverride = null;

  // --- Mic state ----------------------------------------------------------
  let micActive = false;
  let micVolume = 0;
  let analyser = null;
  let micData = null;

  // Rising-edge tracking for the "loud peak = jump" mapping.
  let prevHigh = false;

  function jumpThreshold() {
    const cfg = window.__config || {};
    return cfg.jumpThreshold != null ? cfg.jumpThreshold : 0.7;
  }

  function getVolume() {
    const v = micActive ? Math.max(micVolume, manualVolume) : manualVolume;
    return Math.max(0, Math.min(1, v));
  }

  function getDirection() {
    if (dirOverride !== null) return dirOverride;
    let d = 0;
    if (leftHeld) d -= 1;
    if (rightHeld) d += 1;
    return d;
  }

  // Returns true once per rising crossing of the jump threshold, or when an
  // explicit jump (button/key/hook) was queued. The engine still gates the
  // actual jump on being grounded.
  function consumeJump() {
    const vol = getVolume();
    const high = vol >= jumpThreshold();
    const edge = high && !prevHigh;
    prevHigh = high;
    if (jumpQueued) {
      jumpQueued = false;
      window.Input.lastJumpInfo = { source: "manual", volume: vol };
      return true;
    }
    if (edge) {
      window.Input.lastJumpInfo = { source: "voice", volume: vol };
      return true;
    }
    return false;
  }

  // --- Meter (visible numeric volume 0..100) ------------------------------
  function updateMeter() {
    const meter = $("volume-meter");
    if (!meter) return;
    const pct = Math.round(getVolume() * 100);
    meter.textContent = String(pct);
    const bar = document.querySelector("#volume-bar");
    if (bar) bar.style.width = pct + "%";
  }

  // --- Microphone ---------------------------------------------------------
  async function enableMic() {
    if (micActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      micData = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
      micActive = true;
      const btn = $("btn-mic");
      if (btn) {
        btn.classList.add("mic-on");
        btn.setAttribute("aria-label", "Microphone on");
        btn.disabled = true;
      }
      sampleMic();
    } catch (err) {
      // Permission denied or unavailable: silently keep the manual path.
      const btn = $("btn-mic");
      if (btn) {
        btn.classList.add("mic-unavailable");
        btn.setAttribute("aria-label", "Microphone unavailable");
      }
    }
  }

  // Continuously sample RMS loudness from the analyser and smooth it.
  function sampleMic() {
    if (!micActive || !analyser) return;
    analyser.getByteTimeDomainData(micData);
    let sum = 0;
    for (let i = 0; i < micData.length; i++) {
      const x = (micData[i] - 128) / 128; // [-1,1]
      sum += x * x;
    }
    const rms = Math.sqrt(sum / micData.length);
    // Map a usable speaking/shouting range onto [0,1] and smooth it.
    const norm = Math.min(1, rms / 0.15);
    micVolume = micVolume * 0.6 + norm * 0.4;
    updateMeter();
    requestAnimationFrame(sampleMic);
  }

  // --- Wiring -------------------------------------------------------------
  function bind() {
    const slider = $("volume-input");
    if (slider) {
      slider.addEventListener("input", () => {
        manualVolume = Number(slider.value) / 100;
        updateMeter();
      });
    }



    const micBtn = $("btn-mic");
    if (micBtn) micBtn.addEventListener("click", enableMic);

    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") leftHeld = true;
      else if (e.key === "ArrowRight") rightHeld = true;
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") crouchHeld = true;
      else if (e.key === " " || e.key === "ArrowUp") {
        jumpQueued = true;
        jumpHeld = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft") leftHeld = false;
      else if (e.key === "ArrowRight") rightHeld = false;
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") crouchHeld = false;
      else if (e.key === " " || e.key === "ArrowUp") jumpHeld = false;
    });

    updateMeter();
  }

  // --- Test hooks ---------------------------------------------------------
  window.__setVolume = (v) => {
    manualVolume = Math.max(0, Math.min(1, v));
    updateMeter();
  };
  window.__setDirection = (d) => {
    dirOverride = d === null ? null : Math.sign(d);
  };
  window.__queueJump = () => {
    jumpQueued = true;
  };
  window.__setCrouch = (c) => {
    crouchOverride = c === null ? null : !!c;
  };

  const isJumpHeld = () => jumpHeld || getVolume() >= jumpThreshold();
  const isCrouchHeld = () => crouchOverride !== null ? crouchOverride : crouchHeld;
  const isMicActive = () => micActive;
  const isKeyboardMoving = () => leftHeld || rightHeld;

  window.Input = { getVolume, getDirection, consumeJump, isJumpHeld, isCrouchHeld, enableMic, updateMeter, isMicActive, isKeyboardMoving, lastJumpInfo: { source: null, volume: 0 } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
