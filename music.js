// ─── BACKGROUND MUSIC ───
// Procedural ambient soundtracks per world tier, powered by Tone.js.
// Adapted from soundscapes.html — each tier has its own synth palette and gestures.

let musicInited = false;
let musicPlaying = false;
let musicCurrentTrack = null;
let musicDensity = 0.4;
let musicMainLoop = null;
let musicAuxLoop1 = null;
let musicAuxLoop2 = null;
let musicMasterGain = null;
let musicVolume = 0.7;

const TIER_TO_TRACK = ['void', 'nebula', 'crystal', 'solar'];

function musicPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function musicRand(a, b) { return a + Math.random() * (b - a); }
function musicLerp(a, b, t) { return a + (b - a) * t; }

// ── SHARED EFFECTS ──

let musicReverb, musicCompressor, musicMasterChain;
let musicTrackEffects = {};
let musicTrackSynths = {};
let musicTrackGestures = {};
let musicTrackAux = {};

function initMusicEffects() {
  musicReverb = new Tone.Reverb({ decay: 6, wet: 0.6, preDelay: 0.15 });
  musicCompressor = new Tone.Compressor({ threshold: -20, ratio: 3 });
  musicMasterGain = new Tone.Gain(musicVolume);
  musicMasterChain = [musicReverb, musicCompressor, musicMasterGain, Tone.Destination];
}

// ══════════════════════════════════════════════════════
// THE VOID — warm, open, hopeful
// ══════════════════════════════════════════════════════

function initMusicVoid() {
  const chorus = new Tone.Chorus({ frequency: 0.3, delayTime: 4, depth: 0.5, wet: 0.3 }).start();
  const delay = new Tone.FeedbackDelay({ delayTime: '4n.', feedback: 0.2, wet: 0.15 });
  const warmFilter = new Tone.Filter({ frequency: 4000, type: 'lowpass', rolloff: -12 });

  const pad = new Tone.FMSynth({
    harmonicity: 1, modulationIndex: 0.8,
    oscillator: { type: 'sine' },
    envelope: { attack: 3, decay: 2, sustain: 0.5, release: 5 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 2, decay: 3, sustain: 0.3, release: 3 },
    volume: -20
  }).chain(chorus, warmFilter, ...musicMasterChain);

  const pluck = new Tone.PluckSynth({
    attackNoise: 0.5, dampening: 3000, resonance: 0.98, release: 1.5, volume: -16
  }).chain(delay, ...musicMasterChain);

  const bell = new Tone.FMSynth({
    harmonicity: 2, modulationIndex: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 1.5, sustain: 0, release: 2 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.01, decay: 0.8, sustain: 0, release: 1 },
    volume: -22
  }).chain(chorus, ...musicMasterChain);

  const air = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 2, decay: 2, sustain: 0.15, release: 3 },
    volume: -32
  });
  const airFilter = new Tone.Filter({ frequency: 2000, type: 'bandpass', Q: 0.5 });
  air.chain(airFilter, ...musicMasterChain);

  const sub = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 3, decay: 2, sustain: 0.4, release: 4 },
    volume: -24
  }).chain(new Tone.Filter({ frequency: 300, type: 'lowpass' }), ...musicMasterChain);

  const LOW = ['C3','D3','E3','G3','A3'];
  const MID = ['C4','D4','E4','G4','A4','C5'];
  const HI  = ['E5','G5','A5','C6','D6'];

  const gestures = [
    { fn: () => pluck.triggerAttackRelease(musicPick(MID), musicRand(0.5,1)), weight: 3 },
    { fn: () => { bell.modulationIndex.value=musicRand(2,6); bell.triggerAttackRelease(musicPick(HI), musicRand(0.5,1.5)); }, weight: 2 },
    { fn: () => {
      const c = Math.floor(musicRand(2,4));
      for (let i=0;i<c;i++) Tone.Transport.scheduleOnce(t => pluck.triggerAttackRelease(musicPick(MID),0.8,t), `+${i*musicRand(0.3,0.7)}`);
    }, weight: 1 },
    { fn: () => { airFilter.frequency.value=musicRand(1000,4000); air.triggerAttackRelease(musicRand(2,5)); }, weight: 1 },
    { fn: () => {
      pad.triggerAttackRelease(musicPick(LOW), musicRand(4,7));
      setTimeout(() => bell.triggerAttackRelease(musicPick(HI),1), musicRand(200,800));
    }, weight: 1 },
  ];

  musicTrackSynths.void = [pad, pluck, bell, air, sub];
  musicTrackEffects.void = [chorus, delay, warmFilter, airFilter];
  musicTrackGestures.void = gestures;
  musicTrackAux.void = {
    pad: () => { pad.modulationIndex.value=musicRand(0.3,1.5); pad.triggerAttackRelease(musicPick(LOW), musicRand(5,10)); },
    sub: () => sub.triggerAttackRelease(musicPick(['C2','C3','G2']), musicRand(4,8)),
    padInterval: [8,16],
    subInterval: [10,20],
    mainInterval: () => { const mn=2.5-musicDensity; const mx=5-musicDensity*2; return musicRand(mn,mx); }
  };
}

// ══════════════════════════════════════════════════════
// CRYSTAL REEF — twinkling, ethereal, underwater
// ══════════════════════════════════════════════════════

function initMusicCrystal() {
  const filter = new Tone.Filter({ frequency: 3000, type: 'lowpass', rolloff: -12 });
  const chorus = new Tone.Chorus({ frequency: 0.4, delayTime: 3.5, depth: 0.7, wet: 0.4 }).start();
  const delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.3, wet: 0.25 });

  const metal = new Tone.MetalSynth({
    frequency: 200,
    envelope: { attack: 0.001, decay: 0.4, release: 0.3 },
    harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    volume: -18
  }).chain(filter, chorus, delay, ...musicMasterChain);

  const fm = new Tone.FMSynth({
    harmonicity: 3, modulationIndex: 10,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.8, sustain: 0.1, release: 1.5 },
    modulation: { type: 'triangle' },
    modulationEnvelope: { attack: 0.1, decay: 0.5, sustain: 0.2, release: 0.8 },
    volume: -20
  }).chain(filter, chorus, delay, ...musicMasterChain);

  const pluck = new Tone.PluckSynth({
    attackNoise: 1, dampening: 4000, resonance: 0.97, release: 1.2, volume: -14
  }).chain(filter, chorus, delay, ...musicMasterChain);

  const pad = new Tone.FMSynth({
    harmonicity: 1, modulationIndex: 2,
    oscillator: { type: 'sine' },
    envelope: { attack: 2, decay: 1, sustain: 0.6, release: 3 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 1, decay: 2, sustain: 0.3, release: 2 },
    volume: -26
  }).chain(new Tone.Filter({ frequency: 1200, type: 'lowpass' }), ...musicMasterChain);

  const SCALE = [];
  ['C','D','E','G','A'].forEach(n => { for(let o=5;o<=7;o++) SCALE.push(n+o); });

  const gestures = [
    { fn: () => { metal.frequency.value=musicRand(200,800); metal.triggerAttackRelease('16n'); }, weight: 3 },
    { fn: () => { fm.modulationIndex.value=musicRand(4,20); fm.triggerAttackRelease(musicPick(SCALE), musicRand(0.2,0.8)); }, weight: 2 },
    { fn: () => pluck.triggerAttackRelease(musicPick(SCALE), musicRand(0.3,0.8)), weight: 3 },
    { fn: () => {
      const c=Math.floor(musicRand(2,5));
      for(let i=0;i<c;i++) Tone.Transport.scheduleOnce(t => { metal.frequency.value=musicRand(300,1200); metal.triggerAttackRelease('32n',t); }, `+${i*musicRand(0.05,0.15)}`);
    }, weight: 1 },
  ];

  musicTrackSynths.crystal = [metal, fm, pluck, pad];
  musicTrackEffects.crystal = [filter, chorus, delay];
  musicTrackGestures.crystal = gestures;
  musicTrackAux.crystal = {
    pad: () => pad.triggerAttackRelease(musicPick(['C3','D3','E3','G3','A3','C4','E4']), musicRand(3,6)),
    sub: null,
    padInterval: [4,10],
    subInterval: null,
    mainInterval: () => { const mx=2.5-musicDensity*(2.5-0.15); return musicRand(mx*0.5, mx*1.5); }
  };
}

// ══════════════════════════════════════════════════════
// SOLAR FRINGE — shimmering, cloth, heat haze
// ══════════════════════════════════════════════════════

function initMusicSolar() {
  const phaser = new Tone.Phaser({ frequency: 0.2, octaves: 3, baseFrequency: 800, wet: 0.5 });
  const autoPan = new Tone.AutoPanner({ frequency: 0.1, depth: 0.6 }).start();

  const am = new Tone.AMSynth({
    harmonicity: 2.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.8, decay: 1.5, sustain: 0.4, release: 2 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.5, decay: 0.8, sustain: 0.5, release: 1 },
    volume: -18
  }).chain(phaser, autoPan, ...musicMasterChain);

  const noise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.3, decay: 0.8, sustain: 0.2, release: 1.5 },
    volume: -22
  });
  const autoFilter = new Tone.AutoFilter({ frequency: 0.3, baseFrequency: 400, octaves: 4, type: 'sine', depth: 0.8, wet: 1 }).start();
  noise.chain(autoFilter, phaser, ...musicMasterChain);

  const fmShimmer = new Tone.FMSynth({
    harmonicity: 1.5, modulationIndex: 3,
    oscillator: { type: 'sine' },
    envelope: { attack: 1, decay: 2, sustain: 0.3, release: 2.5 },
    modulation: { type: 'triangle' },
    modulationEnvelope: { attack: 0.5, decay: 1, sustain: 0.4, release: 1.5 },
    volume: -20
  });
  const vibrato = new Tone.Vibrato({ frequency: 3, depth: 0.15 });
  fmShimmer.chain(vibrato, autoPan, ...musicMasterChain);

  const drone = new Tone.FMSynth({
    harmonicity: 1, modulationIndex: 1,
    oscillator: { type: 'sine' },
    envelope: { attack: 3, decay: 2, sustain: 0.5, release: 4 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 2, decay: 3, sustain: 0.3, release: 3 },
    volume: -24
  }).chain(new Tone.Filter({ frequency: 1000, type: 'lowpass' }), ...musicMasterChain);

  const MID = ['C4','D4','E4','G4','A4'];
  const HI  = ['C5','D5','E5','G5','A5'];
  const LOW = ['C3','D3','E3','G3','A3'];

  const gestures = [
    { fn: () => { am.harmonicity.value=musicRand(1.5,4); am.triggerAttackRelease(musicPick(MID), musicRand(1,3)); }, weight: 3 },
    { fn: () => { autoFilter.baseFrequency=musicRand(200,1200); noise.triggerAttackRelease(musicRand(0.3,1.2)); }, weight: 3 },
    { fn: () => { fmShimmer.modulationIndex.value=musicRand(1,8); fmShimmer.triggerAttackRelease(musicPick(HI), musicRand(0.8,2)); }, weight: 2 },
    { fn: () => {
      am.triggerAttackRelease(musicPick(MID), musicRand(1.5,3));
      setTimeout(() => { autoFilter.baseFrequency=musicRand(600,2000); noise.triggerAttackRelease(musicRand(0.5,1)); }, musicRand(50,200));
    }, weight: 1 },
  ];

  musicTrackSynths.solar = [am, noise, fmShimmer, drone];
  musicTrackEffects.solar = [phaser, autoPan, autoFilter, vibrato];
  musicTrackGestures.solar = gestures;
  musicTrackAux.solar = {
    pad: () => drone.triggerAttackRelease(musicPick(LOW), musicRand(4,8)),
    sub: null,
    padInterval: [5,12],
    subInterval: null,
    mainInterval: () => { const iv=2.5-musicDensity*2; return musicRand(iv*0.5, iv*1.5); }
  };
}

// ══════════════════════════════════════════════════════
// NEBULA — swirling, seething, climax
// ══════════════════════════════════════════════════════

function initMusicNebula() {
  const distortion = new Tone.Distortion({ distortion: 0.05, wet: 0.3 });
  const fbDelay = new Tone.FeedbackDelay({ delayTime: '4n', feedback: 0.2, wet: 0.2 });

  const fmChaos = new Tone.FMSynth({
    harmonicity: 2, modulationIndex: 2,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.1, decay: 1, sustain: 0.3, release: 1.5 },
    modulation: { type: 'sawtooth' },
    modulationEnvelope: { attack: 0.2, decay: 0.8, sustain: 0.4, release: 1 },
    volume: -16
  }).chain(distortion, fbDelay, ...musicMasterChain);

  const monoSweep = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 4, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.3, decay: 1, sustain: 0.4, release: 1.5 },
    filterEnvelope: { attack: 0.5, decay: 1.5, sustain: 0.3, release: 1, baseFrequency: 200, octaves: 4 },
    volume: -20
  }).chain(fbDelay, ...musicMasterChain);

  const noiseSynth = new Tone.NoiseSynth({
    noise: { type: 'brown' },
    envelope: { attack: 0.5, decay: 1, sustain: 0.3, release: 2 },
    volume: -24
  });
  const noiseFilter = new Tone.Filter({ frequency: 400, type: 'bandpass', Q: 2 });
  noiseSynth.chain(noiseFilter, ...musicMasterChain);

  const padPoly = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5, modulationIndex: 3,
    oscillator: { type: 'sine' },
    envelope: { attack: 1.5, decay: 2, sustain: 0.4, release: 3 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 1, decay: 2, sustain: 0.3, release: 2 },
    volume: -22
  }).chain(...musicMasterChain);

  const subDrone = new Tone.FMSynth({
    harmonicity: 0.5, modulationIndex: 1,
    oscillator: { type: 'sine' },
    envelope: { attack: 2, decay: 3, sustain: 0.5, release: 4 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 1, decay: 2, sustain: 0.4, release: 2 },
    volume: -20
  }).chain(new Tone.Filter({ frequency: 200, type: 'lowpass' }), ...musicMasterChain);

  const SCALE = ['C3','D3','Eb3','G3','Ab3','C4','D4','Eb4','G4','Ab4','C5','D5','Eb5','G5'];

  let intensityPhase = 0;
  let intensity = 0;

  function updateIntensity() {
    if (musicCurrentTrack !== 'nebula' || !musicPlaying) return;
    intensityPhase += 0.0003 + musicDensity * 0.0002;
    const raw = Math.sin(intensityPhase);
    intensity = Math.max(0, Math.pow(Math.max(0, raw), 0.7));
    distortion.distortion = musicLerp(0.02, 0.5, intensity);
    fbDelay.feedback.value = musicLerp(0.15, 0.55, intensity);
    requestAnimationFrame(updateIntensity);
  }

  const gestures = [
    { fn: () => {
      fmChaos.modulationIndex.value=musicLerp(2,30,intensity);
      fmChaos.harmonicity.value=musicLerp(1.5,5,intensity);
      fmChaos.triggerAttackRelease(musicPick(SCALE), musicRand(0.2,1+intensity));
    }, weight: 3 },
    { fn: () => {
      monoSweep.filterEnvelope.octaves=musicLerp(2,7,intensity);
      monoSweep.triggerAttackRelease(musicPick(SCALE.slice(0,8)), musicRand(0.5,1.5));
    }, weight: 2 },
    { fn: () => {
      noiseFilter.frequency.value=musicLerp(200,2000,intensity);
      noiseFilter.Q.value=musicLerp(1,8,intensity);
      noiseSynth.triggerAttackRelease(musicRand(0.5,2));
    }, weight: 2 },
    { fn: () => {
      const root=Math.floor(Math.random()*5);
      const count=Math.floor(musicLerp(2,5,intensity));
      const notes=[];
      for(let i=0;i<count;i++) notes.push(SCALE[Math.min(root+i*2, SCALE.length-1)]);
      padPoly.triggerAttackRelease(notes, musicRand(2,4));
    }, weight: 1 },
  ];

  musicTrackSynths.nebula = [fmChaos, monoSweep, noiseSynth, padPoly, subDrone];
  musicTrackEffects.nebula = [distortion, fbDelay, noiseFilter];
  musicTrackGestures.nebula = gestures;
  musicTrackAux.nebula = {
    pad: () => subDrone.triggerAttackRelease(musicPick(['C2','Eb2','G2','Ab2']), musicRand(4,8)),
    sub: null,
    padInterval: [5,12],
    subInterval: null,
    mainInterval: () => {
      const base = musicLerp(2.5, 0.3, musicDensity);
      const iMod = musicLerp(1, 0.3, intensity);
      return musicRand(base*iMod*0.6, base*iMod*1.4);
    },
    onStart: updateIntensity,
    getIntensity: () => intensity,
  };
}


// ══════════════════════════════════════════════════════
// ENGINE
// ══════════════════════════════════════════════════════

function initMusic() {
  if (musicInited) return;
  initMusicEffects();
  initMusicVoid();
  initMusicCrystal();
  initMusicSolar();
  initMusicNebula();
  musicInited = true;
}

function stopMusicLoops() {
  musicMainLoop?.stop();
  musicAuxLoop1?.stop();
  musicAuxLoop2?.stop();
  Tone.Transport.stop();
  Tone.Transport.cancel();
  musicMainLoop = null;
  musicAuxLoop1 = null;
  musicAuxLoop2 = null;
}

function musicPickFrom(gestures) {
  const total = gestures.reduce((s,g) => s+g.weight, 0);
  let r = Math.random() * total;
  for (const g of gestures) { r -= g.weight; if (r <= 0) return g.fn; }
  return gestures[0].fn;
}

function startMusicTrack(name) {
  stopMusicLoops();

  const g = musicTrackGestures[name];
  const aux = musicTrackAux[name];
  if (!g || !aux) return;

  musicMainLoop = new Tone.Loop(() => {
    musicPickFrom(g)();

    const extra = name === 'nebula'
      ? (aux.getIntensity?.() || 0) * 0.5
      : musicDensity * 0.25;

    if (Math.random() < extra) {
      Tone.Transport.scheduleOnce(() => musicPickFrom(g)(), `+${musicRand(0.05, 0.5)}`);
    }

    musicMainLoop.interval = aux.mainInterval();
  }, 1.5);

  if (aux.pad) {
    musicAuxLoop1 = new Tone.Loop(() => {
      aux.pad();
      musicAuxLoop1.interval = musicRand(...aux.padInterval);
    }, musicRand(...aux.padInterval));
    musicAuxLoop1.start(0);
  }

  if (aux.sub) {
    musicAuxLoop2 = new Tone.Loop(() => {
      aux.sub();
      musicAuxLoop2.interval = musicRand(...aux.subInterval);
    }, musicRand(...aux.subInterval));
    musicAuxLoop2.start(0);
  }

  musicMainLoop.start(0);
  Tone.Transport.start();

  if (aux.onStart) aux.onStart();
}

// ── PUBLIC API ──

let musicTierIndex = 0;

function startWorldMusic(tierIndex) {
  musicTierIndex = tierIndex;
  if (isMuted) return;
  try {
    Tone.start();
    initMusic();
    const trackName = TIER_TO_TRACK[tierIndex] || 'void';
    if (musicPlaying && musicCurrentTrack === trackName) return;
    musicCurrentTrack = trackName;
    musicPlaying = true;
    startMusicTrack(trackName);
  } catch(e) { console.warn('Music error:', e); }
}

function stopWorldMusic() {
  if (!musicPlaying) return;
  try {
    stopMusicLoops();
    musicPlaying = false;
    musicCurrentTrack = null;
  } catch(e) { console.warn('Music stop error:', e); }
}

function pauseWorldMusic() {
  if (!musicPlaying) return;
  try { Tone.Transport.pause(); } catch(e) {}
}

function resumeWorldMusic() {
  if (!musicPlaying || isMuted) return;
  try { Tone.Transport.start(); } catch(e) {}
}

function setMusicVolume(normalizedVol) {
  musicVolume = normalizedVol * 0.7;
  if (musicMasterGain) {
    musicMasterGain.gain.rampTo(musicVolume, 0.1);
  }
}

function muteWorldMusic() {
  if (musicMasterGain) musicMasterGain.gain.rampTo(0, 0.1);
}

function unmuteWorldMusic() {
  if (musicMasterGain) musicMasterGain.gain.rampTo(musicVolume, 0.1);
  // If game is active but music was stopped due to mute, restart it
  if (gameActive && !musicPlaying) {
    startWorldMusic(musicTierIndex);
  }
}
