// ─── AUDIO ───
// All sounds are layered sine-wave crystal bells with inharmonic partials
// (modelled on real bell acoustics) routed through a synthetic reverb.
// To swap in real audio files, replace each SOUNDS entry with a buffer player.

let audioCtx = null;
let masterGain = null;
let reverbConvolver = null;
let reverbSend = null;
let currentVolume = 0.75;
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
    const duration = 2.2, decay = 2.8, sr = audioCtx.sampleRate;
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
// Inharmonic partials from real bell acoustics (Rossing ratios)
const BELL_PARTIALS = [
  { ratio: 1.000, amp: 1.00, decay: 1.00 },
  { ratio: 2.756, amp: 0.38, decay: 0.72 },
  { ratio: 5.404, amp: 0.16, decay: 0.52 },
  { ratio: 8.933, amp: 0.07, decay: 0.38 },
];

function crystalBellAt(freq, time, duration, gain) {
  const ctx = getAudioCtx();
  BELL_PARTIALS.forEach(p => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env); connectEnv(env);
    osc.type = 'sine';
    osc.frequency.value = freq * p.ratio;
    const pd = duration * p.decay;
    env.gain.setValueAtTime(gain * p.amp, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + pd);
    osc.start(time);
    osc.stop(time + pd + 0.1);
  });
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
    const p = Math.pow(2, Math.min(combo - 1, 6) * 2 / 12); // +2 semitones per combo, cap at 6
    crystalBellAt(523.25 * p, t,        1.4, 0.52);  // C5
    crystalBellAt(659.25 * p, t + 0.03, 1.2, 0.40);  // E5
    crystalBellAt(783.99 * p, t + 0.06, 1.1, 0.32);  // G5
    crystalBellAt(1046.5 * p, t + 0.10, 0.9, 0.20);  // C6
  },

  // Chain reaction — higher G major voicing, same pitch ladder as match
  chain: (combo = 1) => {
    const t = getAudioCtx().currentTime;
    const p = Math.pow(2, Math.min(combo - 1, 6) * 2 / 12);
    crystalBellAt(783.99 * p, t,        1.2, 0.44);  // G5
    crystalBellAt(987.77 * p, t + 0.03, 1.0, 0.34);  // B5
    crystalBellAt(1174.7 * p, t + 0.06, 0.9, 0.24);  // D6
  },

  // Two-note sparkle trill — swap
  swap: () => {
    const t = getAudioCtx().currentTime;
    crystalBellAt(783.99, t,       0.18, 0.22);  // G5
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

  // Descending A minor — game over
  gameover: () => {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    [440, 392, 349.23, 261.63, 220].forEach((f, i) => {
      crystalBellAt(f, t + i * 0.28, 1.6, 0.40);
    });
  },
};

function playSound(name, ...args) {
  if (!SOUNDS[name] || isMuted) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    SOUNDS[name](...args);
  } catch(e) {}
}

// ─── VOLUME CONTROL ───

function toggleMute() {
  isMuted = !isMuted;
  if (masterGain) masterGain.gain.value = isMuted ? 0 : currentVolume;
  document.getElementById('mute-btn').classList.toggle('muted', isMuted);
  document.getElementById('mute-btn').textContent = isMuted ? 'MUTED' : 'SOUND';
}

function setVolume(val) {
  currentVolume = val / 100;
  isMuted = currentVolume === 0;
  if (masterGain) masterGain.gain.value = currentVolume;
  document.getElementById('mute-btn').classList.toggle('muted', isMuted);
  document.getElementById('mute-btn').textContent = isMuted ? 'MUTED' : 'SOUND';
}
