// ─── MAPS ───
// Each map defines a path shape. Levels reference maps by index.
// Adding a new map here automatically adds 4 new levels (one per color tier).

const MAPS = [
  // {
  //   name: "Two Snakes",
  //   tracks: [
  //     {
  //       waypoints: [
  //         { x: -11.4, y: 4.92 },
  //         { x: 11.0, y: 5.05 },
  //         { x: 10.11, y: -7.79 },
  //       ],
  //     },
  //     {
  //       waypoints: [
  //         { x: 7.65, y: -8.16 },
  //         { x: -11.1, y: -7.79 },
  //         { x: -13.93, y: 4.47 },
  //       ],
  //     },
  //   ],
  // },
  // {
  //   name: "Three Snakes",
  //   tracks: [
  //     {
  //       waypoints: [
  //         { x: 0.14, y: 11.54 },
  //         { x: 14.1, y: -8.26 },
  //         { x: -12.22, y: -9.63 },
  //       ],
  //     },
  //     {
  //       waypoints: [
  //         { x: -13.8, y: -7.24 },
  //         { x: -0.41, y: 13.28 },
  //         { x: 18.13, y: -5.02 },
  //       ],
  //     },
  //     {
  //       waypoints: [
  //         { x: 8.5, y: -7.14 },
  //         { x: -9.39, y: -6.42 },
  //         { x: -1.84, y: 7.2 },
  //       ],
  //     },
  //   ],
  // },
  {
    name: "Inward Spiral",
    tracks: [
      {
        waypoints: [
          { x: -11.0, y: 0.0 },
          { x: -7.83, y: -7.91 },
          { x: 0.0, y: -10.06 },
          { x: 6.78, y: -6.78 },
          { x: 9.11, y: 0.0 },
          { x: 6.11, y: 6.11 },
          { x: 0.0, y: 8.17 },
          { x: -5.87, y: 6.42 },
          { x: -9.26, y: 0.9 },
          { x: -6.38, y: -6.69 },
          { x: 0.12, y: -8.44 },
          { x: 5.95, y: -5.2 },
          { x: 7.37, y: 0.9 },
          { x: 3.95, y: 5.52 },
          { x: -0.71, y: 6.43 },
          { x: -5.01, y: 5.01 },
          { x: -7.48, y: 0.59 },
          { x: -5.01, y: -5.24 },
          { x: -0.16, y: -6.86 },
          { x: 4.75, y: -4.3 },
          { x: 5.54, y: 0.65 },
          { x: 3.02, y: 4.1 },
          { x: -0.55, y: 4.73 },
          { x: -3.97, y: 3.67 },
          { x: -5.77, y: 0.73 },
          { x: -3.93, y: -3.99 },
          { x: 0.51, y: -4.85 },
          { x: 3.81, y: -2.34 },
          { x: 3.53, y: 1.51 },
          { x: 0.51, y: 3.0 },
          { x: -2.79, y: 2.53 },
          { x: -3.77, y: -0.18 },
          { x: -2.4, y: -2.57 },
          { x: 0.27, y: -2.96 },
        ],
      },
    ],
  },
  {
    name: 'Diamond',
    waypoints: [
      { x: -11.00, y:   0.00 },
      { x:   0.00, y: -10.00 },
      { x:  10.00, y:   0.00 },
      { x:   0.00, y:   9.00 },
      { x:  -7.57, y:   0.43 },
      { x:   0.00, y:  -7.00 },
      { x:   6.31, y:   0.12 },
      { x:   0.00, y:   5.43 },
      { x:  -4.23, y:   0.12 },
      { x:   0.08, y:  -3.59 },
      { x:   3.14, y:  -0.59 },
    ],
  },
  {
    name: 'Slippery Slope',
    waypoints: [
      { x:  -1.37, y: -11.10 },
      { x:  10.00, y:  -6.00 },
      { x:   9.00, y:   4.00 },
      { x:   0.00, y:   7.00 },
      { x:  -9.00, y:   4.00 },
      { x: -10.00, y:  -6.00 },
      { x:   0.00, y:  -3.00 },
      { x:   5.00, y:   1.00 },
      { x:   0.00, y:   3.00 },
      { x:  -5.00, y:   1.00 },
      { x:  -8.38, y:  -3.99 },
    ],
  },
  {
    name: "Wide Sweep",
    tracks: [
      {
        waypoints: [
          { x: -20.7, y: 2.18 },
          { x: -10.05, y: 8.71 },
          { x: 12.05, y: 6.34 },
          { x: 21.31, y: -4.09 },
          { x: 6.0, y: -11.21 },
          { x: -11.9, y: -10.39 },
          { x: -17.99, y: -1.24 },
        ],
      },
    ],
  },
  {
    name: "Deep Breath",
    tracks: [
      {
        waypoints: [
          { x: -20.72, y: 6.87 },
          { x: -21.74, y: -9.54 },
          { x: -16.22, y: -11.66 },
          { x: -4.42, y: -11.02 },
          { x: -3.6, y: -4.06 },
          { x: -4.11, y: -0.22 },
          { x: -4.27, y: 3.97 },
          { x: -4.19, y: 7.81 },
          { x: -9.4, y: 9.46 },
          { x: -14.65, y: 8.95 },
          { x: -16.84, y: 7.86 },
          { x: -18.37, y: 3.66 },
          { x: -18.52, y: -0.33 },
          { x: -18.41, y: -5.03 },
          { x: -18.13, y: -8.63 },
          { x: -15.82, y: -8.99 },
          { x: -12.06, y: -8.83 },
          { x: -8.58, y: -8.36 },
          { x: -8.46, y: -4.52 },
          { x: -8.65, y: 0.02 },
          { x: -8.93, y: 3.43 },
          { x: -10.03, y: 6.83 },
          { x: -13.08, y: 6.87 },
          { x: -14.96, y: 5.19 },
          { x: -15.63, y: 2.37 },
          { x: -15.7, y: -1.35 },
          { x: -16.06, y: -4.25 },
          { x: -14.88, y: -5.78 },
          { x: -11.98, y: -6.76 },
          { x: -11.08, y: -3.03 },
          { x: -11.28, y: 0.96 },
          { x: -11.94, y: 4.44 },
          { x: -13.28, y: 1.74 },
          { x: -13.43, y: -1.08 },
          { x: -13.47, y: -2.64 },
        ],
      },
      {
        waypoints: [
          { x: 21.58, y: 6.75 },
          { x: 20.79, y: -5.39 },
          { x: 16.26, y: -9.18 },
          { x: 8.23, y: -10.75 },
          { x: 4.15, y: -8.99 },
          { x: 3.8, y: -4.79 },
          { x: 3.41, y: 3.58 },
          { x: 3.84, y: 8.83 },
          { x: 7.71, y: 9.85 },
          { x: 17.74, y: 8.83 },
          { x: 18.01, y: -5.81 },
          { x: 8.93, y: -8.28 },
          { x: 7.68, y: -0.18 },
          { x: 7.83, y: 7.46 },
          { x: 14.84, y: 7.54 },
          { x: 16.53, y: 5.23 },
          { x: 16.45, y: 0.45 },
          { x: 16.25, y: -3.15 },
          { x: 15.0, y: -6.09 },
          { x: 11.98, y: -6.36 },
          { x: 10.69, y: -4.37 },
          { x: 11.08, y: -0.18 },
          { x: 11.87, y: 4.48 },
          { x: 14.1, y: 5.62 },
          { x: 15.0, y: 1.39 },
          { x: 14.22, y: -2.13 },
        ],
      },
    ],
  },
];

// ─── LEVEL GENERATION ───
// Levels = MAPS x COLOR_TIERS. Each tier plays all maps in order
// with increasing speed. Colors increase monotonously across tiers.

const COLOR_TIERS = [3, 4, 5, 6];

const BASE_CHAIN_SPEED = 2.5;

const TIER_THEMES = [
  {
    // Tier 0 — The Void: cold deep space
    name: 'The Void',
    clearColor: 0x00000e,
    bgColor: 0x00000e,
    shardColors: [0xFF2255, 0x00AAFF, 0x00FF88, 0xFFCC00, 0xCC44FF, 0xffffff, 0x88ccff],
    starPalette: [0xffffff, 0xaaddff, 0xff88cc, 0x88ffdd, 0xffddaa, 0xcc88ff],
    vortexPalette: { outer: 0x440066, mid: 0x660088, inner: 0xaa22dd, core: 0x110022, arms: 0x440066 },
    lights: { ambient: { color: 0x112244, intensity: 1.2 }, dir1: { color: 0xaaddff, intensity: 1.8 }, dir2: { color: 0xff88ff, intensity: 0.9 }, point1: { color: 0x88ccff, intensity: 1.8 }, point2: { color: 0xffffff, intensity: 1.0 } },
    cssVars: { accent: '#88ccff', glowRgb: '136,204,255', border: '#1e3a55', barA: '#0055aa', barB: '#88ccff', barC: '#cc88ff' },
    pipe: { conduit: [0x1a2244, 0x112244], flow: [0x88ccff, 0x336699], mouthRing: [0xaaddff, 0x4488bb], innerRing: [0x6688aa, 0x223355], rune: [0xaaddff, 0x4488cc] },
    track: { outer: [0x88ccff, 0x224466], inner: [0xffffff, 0x99ddff] },
    flashColor: 0x88ccff,
  },
  {
    // Tier 1 — Nebula: deep violet
    name: 'Nebula',
    clearColor: 0x0d0020,
    bgColor: 0x0d0020,
    shardColors: [0xCC44FF, 0xFF44AA, 0xAA22FF, 0xFF88DD, 0x8833CC, 0xffffff, 0xDD99FF],
    starPalette: [0xffffff, 0xdd99ff, 0xff88cc, 0xcc44ff, 0xffaaee, 0xaa66ff],
    vortexPalette: { outer: 0x660099, mid: 0x8800bb, inner: 0xcc44ff, core: 0x220044, arms: 0x660099 },
    lights: { ambient: { color: 0x180830, intensity: 1.2 }, dir1: { color: 0xcc88ff, intensity: 1.6 }, dir2: { color: 0xff44aa, intensity: 1.1 }, point1: { color: 0xaa44ff, intensity: 2.0 }, point2: { color: 0xff88dd, intensity: 0.8 } },
    cssVars: { accent: '#cc44ff', glowRgb: '204,68,255', border: '#551188', barA: '#5500aa', barB: '#cc44ff', barC: '#ff88dd' },
    pipe: { conduit: [0x1e0a38, 0x12062a], flow: [0xcc88ff, 0x663399], mouthRing: [0xdd99ff, 0x9944cc], innerRing: [0x7744aa, 0x441166], rune: [0xee99ff, 0xaa44cc] },
    track: { outer: [0xcc88ff, 0x442266], inner: [0xffffff, 0xddaaff] },
    flashColor: 0xcc44ff,
  },
  {
    // Tier 2 — Crystal Reef: deep teal
    name: 'Crystal Reef',
    clearColor: 0x001818,
    bgColor: 0x001818,
    shardColors: [0x00FFCC, 0x00AAFF, 0x00FF88, 0x44FFEE, 0x0088AA, 0xffffff, 0x88FFDD],
    starPalette: [0xffffff, 0x88ffee, 0x00ffcc, 0x44ddff, 0xaaffdd, 0x00bbaa],
    vortexPalette: { outer: 0x006666, mid: 0x008899, inner: 0x00ddbb, core: 0x002233, arms: 0x006666 },
    lights: { ambient: { color: 0x061a18, intensity: 1.2 }, dir1: { color: 0x44ffcc, intensity: 1.6 }, dir2: { color: 0x0088ff, intensity: 0.8 }, point1: { color: 0x00ffcc, intensity: 2.0 }, point2: { color: 0x88ffee, intensity: 0.8 } },
    cssVars: { accent: '#00ffcc', glowRgb: '0,255,200', border: '#007755', barA: '#005544', barB: '#00ffcc', barC: '#44ffee' },
    pipe: { conduit: [0x062a20, 0x041a14], flow: [0x44ffcc, 0x009966], mouthRing: [0x88ffee, 0x00aa88], innerRing: [0x009977, 0x004433], rune: [0x88ffee, 0x00ccaa] },
    track: { outer: [0x44ffcc, 0x224433], inner: [0xffffff, 0x99ffee] },
    flashColor: 0x00ffcc,
  },
  {
    // Tier 3 — Solar Fringe: deep amber
    name: 'Solar Fringe',
    clearColor: 0x1a0800,
    bgColor: 0x1a0800,
    shardColors: [0xFF8800, 0xFF4400, 0xFFCC00, 0xFF6633, 0xFFAA44, 0xffffff, 0xFFDD88],
    starPalette: [0xffffff, 0xffdd88, 0xff8800, 0xffaa44, 0xffcc66, 0xff6622],
    vortexPalette: { outer: 0x884400, mid: 0xaa6600, inner: 0xff8800, core: 0x221100, arms: 0x884400 },
    lights: { ambient: { color: 0x1a0800, intensity: 1.2 }, dir1: { color: 0xffaa44, intensity: 1.8 }, dir2: { color: 0xff4400, intensity: 0.7 }, point1: { color: 0xff8800, intensity: 2.2 }, point2: { color: 0xffdd88, intensity: 0.8 } },
    cssVars: { accent: '#ffaa44', glowRgb: '255,170,68', border: '#884400', barA: '#773300', barB: '#ffaa44', barC: '#ffdd88' },
    pipe: { conduit: [0x2a1000, 0x1a0800], flow: [0xff8800, 0x884400], mouthRing: [0xffaa44, 0xaa5500], innerRing: [0x884400, 0x442200], rune: [0xffcc66, 0xcc6600] },
    track: { outer: [0xffaa44, 0x664422], inner: [0xffffff, 0xffddaa] },
    flashColor: 0xff8800,
  },
];

const TIER_CONFIG = [
  { thresholds: [750, 900, 1100, 1300, 1500], parTime: 70 },
  { thresholds: [1000, 1200, 1500, 1800, 2100], parTime: 80 },
  { thresholds: [1200, 1500, 1800, 2200, 2600], parTime: 100 },
  { thresholds: [1400, 1700, 2100, 2500, 3000], parTime: 110 },
];

function generateLevels() {
  const levels = [];
  for (let ti = 0; ti < COLOR_TIERS.length; ti++) {
    const colors = COLOR_TIERS[ti];
    const cfg = TIER_CONFIG[ti];
    for (let mi = 0; mi < MAPS.length; mi++) {
      levels.push({
        map: mi,
        colors: colors,
        chainSpeed: BASE_CHAIN_SPEED,
        progressThreshold:
          cfg.thresholds[mi] || cfg.thresholds[cfg.thresholds.length - 1],
        parTime: cfg.parTime,
        tier: ti,
      });
    }
  }
  return levels;
}

const LEVELS = generateLevels();
