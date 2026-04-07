// ─── MAPS ───
// Each map defines a path shape. Levels reference maps by index.
// Adding a new map here automatically adds 4 new levels (one per color tier).

const MAPS = [
  {
    name: 'Inward Spiral',
    waypoints: [
      { x: -11.00, y:   0.00 },
      { x:  -7.83, y:  -7.91 },
      { x:   0.00, y: -10.06 },
      { x:   6.78, y:  -6.78 },
      { x:   9.11, y:   0.00 },
      { x:   6.11, y:   6.11 },
      { x:   0.00, y:   8.17 },
      { x:  -5.87, y:   6.42 },
      { x:  -9.26, y:   0.90 },
      { x:  -6.38, y:  -6.69 },
      { x:   0.12, y:  -8.44 },
      { x:   5.95, y:  -5.20 },
      { x:   7.37, y:   0.90 },
      { x:   3.95, y:   5.52 },
      { x:  -0.71, y:   6.43 },
      { x:  -5.01, y:   5.01 },
      { x:  -7.48, y:   0.59 },
      { x:  -5.01, y:  -5.24 },
      { x:  -0.16, y:  -6.86 },
      { x:   4.75, y:  -4.30 },
      { x:   5.54, y:   0.65 },
      { x:   3.02, y:   4.10 },
      { x:  -0.55, y:   4.73 },
      { x:  -3.97, y:   3.67 },
      { x:  -5.77, y:   0.73 },
      { x:  -3.93, y:  -3.99 },
      { x:   0.51, y:  -4.85 },
      { x:   3.81, y:  -2.34 },
      { x:   3.53, y:   1.51 },
      { x:   0.51, y:   3.00 },
      { x:  -2.79, y:   2.53 },
      { x:  -3.77, y:  -0.18 },
      { x:  -2.40, y:  -2.57 },
      { x:   0.27, y:  -2.96 },
    ],
  },
  {
    name: 'Tight Spiral',
    waypoints: [
      { x: -11, y:   0 },
      { x:   0, y: -10 },
      { x:  10, y:   0 },
      { x:   0, y:   9 },
      { x:  -8, y:   0 },
      { x:   0, y:  -7 },
      { x:   6, y:   0 },
      { x:   0, y:   5 },
      { x:  -4, y:   0 },
      { x:   0, y:  -3 },
      { x:   2, y:   0 },
      { x:   1, y:   0 },
    ],
  },
  {
    name: 'Figure of Eight',
    waypoints: [
      { x:   0, y: -12 },
      { x:  10, y:  -6 },
      { x:   9, y:   4 },
      { x:   0, y:   7 },
      { x:  -9, y:   4 },
      { x: -10, y:  -6 },
      { x:   0, y:  -3 },
      { x:   5, y:   1 },
      { x:   0, y:   3 },
      { x:  -5, y:   1 },
      { x:   0, y:   0 },
    ],
  },
  {
    name: 'Loop',
    waypoints: [
      { x: -14.45, y:   1.12 },
      { x: -13.55, y:  -2.69 },
      { x:  -8.09, y:  -4.61 },
      { x:   0.82, y:  -5.75 },
      { x:   6.40, y:  -5.16 },
      { x:  11.55, y:  -1.55 },
      { x:   7.74, y:   4.65 },
      { x:  -0.04, y:   8.11 },
      { x:  -7.11, y:   5.40 },
      { x: -10.29, y:   0.77, z:  3.0 },
      { x: -12.25, y:  -7.64 },
      { x:  -9.42, y: -10.86 },
      { x:  -0.82, y: -10.35 },
      { x:  12.49, y:  -7.60 },
      { x:  14.41, y:  -2.81 },
    ],
  },
  {
    name: 'Wide Sweep',
    waypoints: [
      { x: -20.70, y:   2.18 },
      { x: -10.05, y:   8.71 },
      { x:  12.05, y:   6.34 },
      { x:  21.31, y:  -4.09 },
      { x:   6.00, y: -11.21 },
      { x: -11.90, y: -10.39 },
      { x: -17.99, y:  -1.24 },
    ],
  },
  {
    name: 'Dual Helix',
    tracks: [
      {
        waypoints: [
          { x: -14, y:  10 },
          { x:  -8, y:  12 },
          { x:  -1, y:  10 },
          { x:   6, y:  12 },
          { x:  12, y:   9 },
          { x:  14, y:   5 },
          { x:  10, y:   2 },
          { x:   4, y:   4 },
          { x:  -2, y:   6 },
          { x:  -8, y:   4 },
          { x: -12, y:   2 },
          { x: -10, y:  -1 },
          { x:  -4, y:   0 },
          { x:   3, y:   2 },
          { x:   8, y:   0 },
          { x:   5, y:  -2 },
          { x:   0, y:  -1 },
          { x:  -3, y:   1 },
        ],
      },
      {
        waypoints: [
          { x:  14, y: -10 },
          { x:   8, y: -12 },
          { x:   1, y: -10 },
          { x:  -6, y: -12 },
          { x: -12, y:  -9 },
          { x: -14, y:  -5 },
          { x: -10, y:  -2 },
          { x:  -4, y:  -4 },
          { x:   2, y:  -6 },
          { x:   8, y:  -4 },
          { x:  12, y:  -2 },
          { x:  10, y:   1 },
          { x:   4, y:   0 },
          { x:  -3, y:  -2 },
          { x:  -8, y:   0 },
          { x:  -5, y:   2 },
          { x:   0, y:   1 },
          { x:   3, y:  -1 },
        ],
      },
    ],
  },
];


// ─── LEVEL GENERATION ───
// Levels = MAPS x COLOR_TIERS. Each tier plays all maps in order
// with increasing speed. Colors increase monotonously across tiers.

const COLOR_TIERS = [3, 4, 5, 6];

const TIER_CONFIG = [
  { speeds: [2.2, 2.5, 2.8, 3.1, 3.4], thresholds: [ 750,  900, 1100, 1300, 1500], parTime:  70 },
  { speeds: [2.4, 2.7, 3.0, 3.3, 3.6], thresholds: [1000, 1200, 1500, 1800, 2100], parTime:  80 },
  { speeds: [2.5, 2.8, 3.1, 3.4, 3.7], thresholds: [1200, 1500, 1800, 2200, 2600], parTime: 100 },
  { speeds: [2.6, 2.9, 3.2, 3.5, 3.8], thresholds: [1400, 1700, 2100, 2500, 3000], parTime: 110 },
];

function generateLevels() {
  const levels = [];
  for (let ti = 0; ti < COLOR_TIERS.length; ti++) {
    const colors = COLOR_TIERS[ti];
    const cfg = TIER_CONFIG[ti];
    for (let mi = 0; mi < MAPS.length; mi++) {
      levels.push({
        map:                mi,
        colors:             colors,
        chainSpeed:         cfg.speeds[mi] || cfg.speeds[cfg.speeds.length - 1],
        progressThreshold:  cfg.thresholds[mi] || cfg.thresholds[cfg.thresholds.length - 1],
        parTime:            cfg.parTime,
      });
    }
  }
  return levels;
}

const LEVELS = generateLevels();
