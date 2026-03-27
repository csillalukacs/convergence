// ─── AUDIO ───
//
// All sounds go through playSound(name). Currently uses Web Audio API synthesis
// so nothing to load. To swap in real audio files:
//   1. Add files to a sounds/ folder
//   2. Uncomment SOUND_FILES and loadSounds() below
//   3. Replace each entry in SOUNDS with: () => playBuffer(name)
//   4. Call loadSounds() inside init() in main.js after buildPath()

/* const SOUND_FILES = {
  shoot:    'sounds/shoot.wav',
  hit:      'sounds/hit.wav',
  match:    'sounds/match.wav',
  chain:    'sounds/chain.wav',
  swap:     'sounds/swap.wav',
  levelup:  'sounds/levelup.wav',
  gameover: 'sounds/gameover.wav',
}; */

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// async function loadSounds() {
//   const ctx = getAudioCtx();
//   for (const [name, url] of Object.entries(SOUND_FILES)) {
//     const res = await fetch(url);
//     const buf = await res.arrayBuffer();
//     audioBuffers[name] = await ctx.decodeAudioData(buf);
//   }
// }
// const audioBuffers = {};
// function playBuffer(name) {
//   const ctx = getAudioCtx();
//   if (!audioBuffers[name]) return;
//   const src = ctx.createBufferSource();
//   src.buffer = audioBuffers[name];
//   src.connect(ctx.destination);
//   src.start();
// }

const SOUNDS = {
  shoot:    () => synthTone({ freq: 520, endFreq: 260, duration: 0.10, gain: 0.25, type: 'square' }),
  hit:      () => synthTone({ freq: 180, endFreq: 120, duration: 0.07, gain: 0.45, type: 'sine' }),
  match:    () => synthExplosion(),
  chain:    () => synthTone({ freq: 120, endFreq: 40, duration: 0.18, gain: 0.80, type: 'sine' }),
  swap:     () => synthTone({ freq: 400, endFreq: 560, duration: 0.07, gain: 0.18, type: 'sine' }),
  levelup:  () => synthArp([350, 530, 700, 880], 0.16, 0.45),
  gameover: () => synthTone({ freq: 280, endFreq: 70,  duration: 0.90, gain: 0.30, type: 'sawtooth' }),
};

function playSound(name) {
  if (!SOUNDS[name]) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    SOUNDS[name]();
  } catch (e) {}
}

function synthTone({ freq, endFreq, duration, gain, type }) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.connect(env);
  env.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
  env.gain.setValueAtTime(gain, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration + 0.01);
}

function synthArp(freqs, noteDuration, gain) {
  const ctx = getAudioCtx();
  freqs.forEach((freq, i) => {
    const t = ctx.currentTime + i * noteDuration * 0.6;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env);
    env.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.75, t + noteDuration);
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + noteDuration);
    osc.start(t);
    osc.stop(t + noteDuration + 0.01);
  });
}

function synthExplosion() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  const duration = 0.45;

  // White noise burst
  const bufSize = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0.9, t);
  noiseEnv.gain.exponentialRampToValueAtTime(0.001, t + duration);
  // Low-pass the noise so it sounds boomier
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(800, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + duration);
  noise.connect(lp); lp.connect(noiseEnv); noiseEnv.connect(ctx.destination);
  noise.start(t); noise.stop(t + duration);

  // Low sine thud underneath
  const osc = ctx.createOscillator();
  const oscEnv = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.20);
  oscEnv.gain.setValueAtTime(1.0, t);
  oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
  osc.connect(oscEnv); oscEnv.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.25);
}
