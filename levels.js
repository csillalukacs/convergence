// ─── MAPS ───
// Each map defines a path shape. Levels reference maps by index.

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
];


// ─── LEVELS ───
// map: index into MAPS
// colors: number of ball colors in play
// chainSpeed: world units per second
// progressThreshold: score needed to fill the resonance gauge

const LEVELS = [
  // ── 3 colors ──
  { map: 0, colors: 3, chainSpeed: 2.4, progressThreshold:  750 },
  { map: 1, colors: 3, chainSpeed: 2.8, progressThreshold: 1200 },
  { map: 2, colors: 3, chainSpeed: 3.0, progressThreshold: 1800 },
  { map: 3, colors: 3, chainSpeed: 3.4, progressThreshold: 2250 },

  // ── 4 colors ──
  { map: 0, colors: 4, chainSpeed: 2.6, progressThreshold: 1050 },
  { map: 1, colors: 4, chainSpeed: 2.8, progressThreshold: 1500 },
  { map: 2, colors: 4, chainSpeed: 2.7, progressThreshold: 2100 },
  { map: 3, colors: 4, chainSpeed: 3.1, progressThreshold: 3000 },

  // ── 5 colors ──
  { map: 0, colors: 5, chainSpeed: 2.2, progressThreshold: 1500 },
  { map: 1, colors: 5, chainSpeed: 2.6, progressThreshold: 1950 },
  { map: 2, colors: 5, chainSpeed: 3.0, progressThreshold: 2700 },
  { map: 3, colors: 5, chainSpeed: 3.4, progressThreshold: 3750 },

  // ── Wide ──
  { map: 4, colors: 4, chainSpeed: 2.0, progressThreshold: 1200 },
];
