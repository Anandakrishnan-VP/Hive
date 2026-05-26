"use client";

let audioCtx: AudioContext | null = null;
let isSoundEnabled = true;

// Initialize AudioContext on first user interaction to satisfy browser policies
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    // Standard AudioContext initialization
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      
      // Load preference from localStorage if available
      try {
        const saved = localStorage.getItem("hive_sound_enabled");
        if (saved !== null) {
          isSoundEnabled = saved === "true";
        }
      } catch (e) {
        console.warn("localStorage is not accessible:", e);
      }
    }
  }
  
  // Resume context if suspended (browser security policy check)
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch((err) => {
      console.warn("Autoplay check: AudioContext resume deferred until next gesture.", err);
    });
  }
  
  return audioCtx;
}

// Global user interaction listener to wake up AudioContext on the first gesture
if (typeof window !== "undefined") {
  const resumeAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().then(() => {
        if (ctx.state === "running") {
          cleanUp();
        }
      }).catch(() => {});
    } else if (ctx && ctx.state === "running") {
      cleanUp();
    }
  };

  const gestureEvents = ["click", "mousedown", "keydown", "touchstart"];
  const cleanUp = () => {
    gestureEvents.forEach((evt) => {
      window.removeEventListener(evt, resumeAudio);
    });
  };

  gestureEvents.forEach((evt) => {
    window.addEventListener(evt, resumeAudio, { passive: true });
  });
}

export const audioManager = {
  isEnabled: () => isSoundEnabled,
  
  toggle: () => {
    isSoundEnabled = !isSoundEnabled;
    try {
      localStorage.setItem("hive_sound_enabled", String(isSoundEnabled));
    } catch (e) {
      console.warn("Failed to save sound preference:", e);
    }
    return isSoundEnabled;
  },

  // 1. Hover Beep (Short 30ms high-pitched sine)
  playHover: () => {
    if (!isSoundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(2000, ctx.currentTime); // High pitch beep

    gain.gain.setValueAtTime(0.015, ctx.currentTime); // Low volume
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.04); // Fast decay

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  },

  // 2. Tech Click (Triangle wave with rapid decay)
  playClick: () => {
    if (!isSoundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // Lower pitch transient click
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  },

  // 3. Cyber Alert (Warning alarm)
  playAlert: () => {
    if (!isSoundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    
    // Play two alarm blips
    [0, 0.15].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(988, now + delay); // B5 note
      osc.frequency.setValueAtTime(784, now + delay + 0.06); // G5 note

      gain.gain.setValueAtTime(0.03, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + delay + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.13);
    });
  },

  // 4. Data Tick (Very fast low-fi click for streaming text)
  playDataTick: () => {
    if (!isSoundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1500, ctx.currentTime);

    gain.gain.setValueAtTime(0.008, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.015); // Ultra fast click

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.02);
  },

  // 5. Triumphant Chord Sweep (Pentatonic arpeggio)
  playSuccess: () => {
    if (!isSoundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440.00, 554.37, 659.25, 880.00, 1108.73]; // A major pentatonic chord sweep
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const delay = idx * 0.07; // Cascading delay (arpeggio)

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.02, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + delay + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    });
  }
};
