// ─── AUDIO ───
// All sounds are layered sine-wave crystal bells with inharmonic partials
// (modelled on real bell acoustics) routed through a synthetic reverb.
// To swap in real audio files, replace each SOUNDS entry with a buffer player.

let audioCtx = null;
let masterGain = null;
let reverbConvolver = null;
let reverbSend = null;
const SFX_SCALE = 0.5; // SFX max gain relative to music max — keeps sfx from overpowering music
let currentVolume = 0.35 * SFX_SCALE;
let currentMusicVolume = 0.70;
let isMuted = false;

function getAudioCtx() {
  if (!audioCtx) {
    const W = /** @type {any} */ (window);
    audioCtx = new (W.AudioContext || W.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = currentVolume;
    masterGain.connect(audioCtx.destination);

    // Synthetic hall reverb — white noise shaped with exponential decay
    reverbConvolver = audioCtx.createConvolver();
    const duration = 2.2,
      decay = 2.8,
      sr = audioCtx.sampleRate;
    const length = Math.ceil(sr * duration);
    const impulse = audioCtx.createBuffer(2, length, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    reverbConvolver.buffer = impulse;

    reverbSend = audioCtx.createGain();
    reverbSend.gain.value = 0.38;
    reverbConvolver.connect(reverbSend);
    reverbSend.connect(masterGain);
  }
  return audioCtx;
}

// Route a gain node dry to masterGain and wet into the reverb
function connectEnv(env) {
  env.connect(masterGain);
  env.connect(reverbConvolver);
}

// ─── BUILDING BLOCK ───
// Bell engine configuration — tweak in debug-audio.html, paste back here.
const BELL_CONFIG = {
  partials: [
    { ratio: 0.5, amp: 0.2, decay: 1.15, pan: -0.1 }, // Sub-octave warmth
    { ratio: 1.0, amp: 0.6, decay: 1.0, pan: 0.0 }, // Fundamental
    { ratio: 1.183, amp: 0.12, decay: 0.88, pan: 0.18 }, // Minor third mode
    { ratio: 1.506, amp: 0.09, decay: 0.78, pan: -0.22 }, // Fifth mode
    { ratio: 2.0, amp: 0.24, decay: 0.82, pan: 0.08 }, // Octave
    { ratio: 2.756, amp: 0.18, decay: 0.62, pan: -0.28 }, // Rossing partial
    { ratio: 3.657, amp: 0.06, decay: 0.48, pan: 0.32 }, // Upper mode
    { ratio: 5.404, amp: 0.04, decay: 0.38, pan: -0.35 }, // Shimmer
    { ratio: 8.933, amp: 0.02, decay: 0.26, pan: 0.4 }, // Air / brilliance
  ],
  envelope: {
    attackTime: 0.003, // seconds — ramp from silence to peak
    sustainLevel: 0.35, // fraction of peak at end of stage 1
    sustainPoint: 0.33, // fraction of duration where stage 1 ends
  },
  strike: {
    minDuration: 0.08, // bells shorter than this skip the strike
    freqMult: 2.5, // bandpass center = freq × this
    maxFreq: 11000, // bandpass center capped here
    Q: 1.8, // bandpass resonance
    gain: 0.18, // strike amplitude relative to bell gain
    duration: 0.04, // seconds — length of noise burst
  },
  chorus: {
    detuneCents: 3, // random detune range (±half this value)
  },
};

// Shared noise buffer for strike transients (created lazily)
let noiseBuffer = null;
function getNoiseBuffer() {
  if (noiseBuffer) return noiseBuffer;
  const ctx = getAudioCtx();
  const len = Math.ceil(ctx.sampleRate * 0.06);
  noiseBuffer = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = noiseBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function crystalBellAt(freq, time, duration, gain) {
  const ctx = getAudioCtx();
  const cfg = BELL_CONFIG;

  // ── Tonal partials with stereo spread ──
  cfg.partials.forEach((p) => {
    const f = freq * p.ratio;
    if (f > 16000) return;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const pan = ctx.createStereoPanner();
    osc.type = "sine";
    osc.frequency.value = f;
    osc.detune.value = (Math.random() - 0.5) * cfg.chorus.detuneCents;

    osc.connect(env);
    env.connect(pan);
    pan.connect(masterGain);
    pan.connect(reverbConvolver);
    pan.pan.value = p.pan;

    const pd = duration * p.decay;
    const peakGain = gain * p.amp;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peakGain, time + cfg.envelope.attackTime);
    env.gain.exponentialRampToValueAtTime(
      Math.max(peakGain * cfg.envelope.sustainLevel, 0.0001),
      time + pd * cfg.envelope.sustainPoint
    );
    env.gain.exponentialRampToValueAtTime(0.0001, time + pd);
    osc.start(time);
    osc.stop(time + pd + 0.05);
  });

  // ── Strike transient — filtered noise burst for the "hit" ──
  if (duration >= cfg.strike.minDuration) {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = Math.min(
      freq * cfg.strike.freqMult,
      cfg.strike.maxFreq
    );
    bp.Q.value = cfg.strike.Q;

    const nEnv = ctx.createGain();
    const nGain = gain * cfg.strike.gain;
    nEnv.gain.setValueAtTime(0.0001, time);
    nEnv.gain.linearRampToValueAtTime(nGain, time + 0.002);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, time + cfg.strike.duration);

    noise.connect(bp);
    bp.connect(nEnv);
    connectEnv(nEnv);
    noise.start(time);
    noise.stop(time + cfg.strike.duration + 0.02);
  }
}

// ─── SOUNDS ───

const SOUNDS = {
  // Quick bright ping — A5 shooting out
  shoot: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(880, t, 0.22, 0.28);
  },

  // Soft landing ting — ball joins chain, no match
  hit: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(659.25, t, 0.28, 0.18);
  },

  // Crystal chord burst — C major triad, pitched up 2 semitones per combo level
  match: (combo = 1) => {
    const t = getAudioCtx().currentTime;
    const p = Math.pow(2, (Math.min(combo - 1, 6) * 2) / 12); // +2 semitones per combo, cap at 6
    crystalBellAt(523.25 * p, t, 1.4, 0.52); // C5
    crystalBellAt(659.25 * p, t + 0.03, 1.2, 0.4); // E5
    crystalBellAt(783.99 * p, t + 0.06, 1.1, 0.32); // G5
    crystalBellAt(1046.5 * p, t + 0.1, 0.9, 0.2); // C6
  },

  // Chain reaction — higher G major voicing, same pitch ladder as match
  chain: (combo = 1) => {
    const t = getAudioCtx().currentTime;
    const p = Math.pow(2, (Math.min(combo - 1, 6) * 2) / 12);
    crystalBellAt(783.99 * p, t, 1.2, 0.44); // G5
    crystalBellAt(987.77 * p, t + 0.03, 1.0, 0.34); // B5
    crystalBellAt(1174.7 * p, t + 0.06, 0.9, 0.24); // D6
  },

  // Two-note sparkle trill — swap
  swap: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(783.99, t, 0.18, 0.22); // G5
    crystalBellAt(1046.5, t + 0.07, 0.18, 0.22); // C6
  },

  // Ascending C major arpeggio — level up
  levelup: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      crystalBellAt(f, t + i * 0.13, 0.7, 0.42);
    });
  },

  // Magical shimmer — powerup activated
  powerup: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    [523.25, 740, 1046.5, 1480].forEach((f, i) => {
      crystalBellAt(f, t + i * 0.07, 0.55, 0.38);
    });
  },

  // Grand ascending fanfare — victory
  victory: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    // Two-octave ascending arpeggio with harmony
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
      crystalBellAt(f, t + i * 0.15, 1.2, 0.45);
      crystalBellAt(f * 1.5, t + i * 0.15 + 0.06, 0.8, 0.28);
    });
  },

  // Descending A minor — game over
  gameover: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    [440, 392, 349.23, 261.63, 220].forEach((f, i) => {
      crystalBellAt(f, t + i * 0.28, 1.6, 0.4);
    });
  },

  // Warm chime — bonus crystal collected
  crystal: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(1174.7, t, 0.4, 0.3);
    crystalBellAt(1480, t + 0.05, 0.35, 0.24);
  },

  // Triumphant fanfare — extra life earned
  extralife: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    [659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => {
      crystalBellAt(f, t + i * 0.1, 0.6, 0.36);
    });
  },

  // Bright sparkle — gap crossing bonus (10x multiplier)
  gapbonus: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(1318.5, t, 0.3, 0.28);
    crystalBellAt(1568, t + 0.04, 0.3, 0.28);
    crystalBellAt(1760, t + 0.08, 0.4, 0.32);
  },

  // Deep swell — resonance gauge peaked, no more balls
  resonance: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    crystalBellAt(261.63, t, 1.8, 0.38);
    crystalBellAt(392, t + 0.12, 1.5, 0.32);
    crystalBellAt(523.25, t + 0.24, 1.2, 0.28);
    crystalBellAt(783.99, t + 0.36, 1.0, 0.22);
  },

  // Quick soft tick — level clearance bonus counting
  cleartick: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(1046.5, t, 0.1, 0.14);
  },

  // Soft thud — game paused
  pause: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(349.23, t, 0.3, 0.18);
  },

  // Light ting — game unpaused
  unpause: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(523.25, t, 0.2, 0.18);
  },

  // Whisper ping — menu button hover
  menuhover: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(1318.5, t, 0.12, 0.06);
  },

  // Crisp click — menu button press
  menuclick: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(1046.5, t, 0.18, 0.2);
    crystalBellAt(1318.5, t + 0.04, 0.14, 0.14);
  },

  // Sad descending tone — lost a life but still playing
  lifelost: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    crystalBellAt(440, t, 0.8, 0.32);
    crystalBellAt(349.23, t + 0.15, 0.7, 0.28);
    crystalBellAt(261.63, t + 0.3, 1.0, 0.34);
  },

  // Rising three-note sparkle — powerup icon appears on a chain ball
  powerupspawn: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(1174.7, t, 0.22, 0.13);
    crystalBellAt(1480, t + 0.05, 0.18, 0.11);
    crystalBellAt(1760, t + 0.1, 0.16, 0.09);
  },

  // Soft two-note drop — powerup timer ran out
  powerupexpire: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(783.99, t, 0.32, 0.11);
    crystalBellAt(587.33, t + 0.09, 0.28, 0.09);
  },

  // Bright inviting ting — bonus crystal materialises on screen
  crystalspawn: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(1318.5, t, 0.28, 0.15);
    crystalBellAt(1760, t + 0.07, 0.22, 0.11);
  },

  // Soft descending sigh — bonus crystal fades uncollected
  crystalfade: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(659.25, t, 0.38, 0.09);
    crystalBellAt(523.25, t + 0.11, 0.32, 0.07);
  },

  // Big resonant chord burst — chromatic purge detonates
  chromaticboom: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    [261.63, 392, 523.25, 783.99, 1046.5].forEach((f, i) => {
      crystalBellAt(f, t + i * 0.04, 1.4, 0.34);
    });
  },

  // Short two-note flourish — new level begins
  levelstart: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(659.25, t, 0.38, 0.28);
    crystalBellAt(1046.5, t + 0.13, 0.48, 0.32);
  },

  // Quiet low thud — fired ball goes out of bounds
  miss: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(220, t, 0.14, 0.07);
  },

  // Low ominous throb — chain approaching skull; danger scales volume
  dangerpulse: (danger = 0.5) => {
    const t = getAudioCtx().currentTime;
    const g = 0.08 + danger * 0.18;
    crystalBellAt(110, t, 0.4, g);
    crystalBellAt(146.83, t + 0.06, 0.34, g * 0.55);
  },

  // Delayed triumphant sparkle layered over gameover — new all-time high score
  newhighscore: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    // Starts after the gameover arpeggio settles (~1.8 s)
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
      crystalBellAt(f, t + 1.8 + i * 0.12, 0.65, 0.26);
    });
  },

  // Light three-note chime — new personal best on a level
  newlevelbest: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(1046.5, t, 0.32, 0.2);
    crystalBellAt(1318.5, t + 0.09, 0.28, 0.18);
    crystalBellAt(1568, t + 0.18, 0.26, 0.16);
  },


  // Quick ascending trill — time bonus awarded
  timebonus: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    [659.25, 783.99, 987.77, 1174.7].forEach((f, i) => {
      crystalBellAt(f, t + i * 0.07, 0.32, 0.2);
    });
  },
};

function playSound(name, ...args) {
  if (!SOUNDS[name] || isMuted) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    SOUNDS[name](...args);
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

// ─── LOOPING SOUNDS (start/stop) ───

const LOOPING_SOUNDS = {
  rollin: {
    scale: [261.63, 311.13, 392, 466.16, 523.25, 622.25, 783.99, 932.33, 1046.5, 1244.5, 1568, 1864.7, 2093],
    spacing: 0.05,
    bellDur: 0.2,
    vol: 0.3,
  },
  rollback: {
    scale: [2093, 1864.7, 1568, 1244.5, 1046.5, 932.33, 783.99, 622.25, 523.25, 466.16, 392, 311.13, 261.63],
    spacing: 0.05,
    bellDur: 0.2,
    vol: 0.3,
  },
};

const activeLoops = {};
const pausedLoops = {};

function startSound(name, startI = 0) {
  if (isMuted || activeLoops[name]) return;
  const cfg = LOOPING_SOUNDS[name];
  if (!cfg) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const state = { i: startI, nextT: ctx.currentTime };
    const scheduleAhead = 0.2;
    const tick = () => {
      while (state.nextT < getAudioCtx().currentTime + scheduleAhead) {
        const f = cfg.scale[state.i % cfg.scale.length];
        crystalBellAt(f, state.nextT, cfg.bellDur, cfg.vol);
        state.nextT += cfg.spacing;
        state.i++;
      }
    };
    tick();
    state.intervalId = setInterval(tick, 50);
    activeLoops[name] = state;
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

function stopSound(name) {
  if (activeLoops[name]) {
    clearInterval(activeLoops[name].intervalId);
    delete activeLoops[name];
  }
}

function pauseLoopingSounds() {
  for (const name in activeLoops) {
    pausedLoops[name] = { i: activeLoops[name].i };
    clearInterval(activeLoops[name].intervalId);
    delete activeLoops[name];
  }
}

function resumeLoopingSounds() {
  for (const name in pausedLoops) {
    startSound(name, pausedLoops[name].i);
    delete pausedLoops[name];
  }
}

// ─── VOLUME CONTROL ───

function toggleMute() {
  isMuted = !isMuted;
  if (masterGain) masterGain.gain.value = isMuted ? 0 : currentVolume;
  if (isMuted) {
    if (typeof muteWorldMusic === "function") muteWorldMusic();
  } else {
    if (typeof unmuteWorldMusic === "function") unmuteWorldMusic();
  }
  document.getElementById("mute-btn").classList.toggle("muted", isMuted);
  document.getElementById("mute-btn").textContent = isMuted ? "MUTED" : "SOUND";
  try {
    localStorage.setItem("convergence-muted", isMuted);
  } catch {}
}

function setSfxVolume(val) {
  currentVolume = (val / 100) * SFX_SCALE;
  if (masterGain) masterGain.gain.value = isMuted ? 0 : currentVolume;
  try {
    localStorage.setItem("convergence-sfx-volume", val);
  } catch {}
}

function setMusicVolumeControl(val) {
  currentMusicVolume = val / 100;
  if (!isMuted && typeof setMusicVolume === "function")
    setMusicVolume(currentMusicVolume);
  try {
    localStorage.setItem("convergence-music-volume", val);
  } catch {}
}

function loadAudioSettings() {
  try {
    const sfxVol = localStorage.getItem("convergence-sfx-volume");
    const musicVol = localStorage.getItem("convergence-music-volume");
    const muted = localStorage.getItem("convergence-muted");

    if (sfxVol !== null) {
      currentVolume = (Number(sfxVol) / 100) * SFX_SCALE;
      const el = document.getElementById('sfx-volume-slider');
      if (el) el.value = sfxVol;
    }
    if (musicVol !== null) {
      currentMusicVolume = Number(musicVol) / 100;
      const el = document.getElementById("music-volume-slider");
      if (el) el.value = musicVol;
    }
    if (muted !== null) {
      isMuted = muted === "true";
    }
    if (masterGain) masterGain.gain.value = isMuted ? 0 : currentVolume;
    if (!isMuted && typeof setMusicVolume === "function")
      setMusicVolume(currentMusicVolume);
    document.getElementById("mute-btn").classList.toggle("muted", isMuted);
    document.getElementById("mute-btn").textContent = isMuted
      ? "MUTED"
      : "SOUND";
  } catch {}
}
