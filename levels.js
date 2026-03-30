// ─── MAPS ───
// Each map defines a path shape. Levels reference maps by index.

const MAPS = [
  {
    name: 'Inward Spiral',
    waypoints: [
      { x: -11.00, y:   0.00 },
      { x:  -7.44, y:  -7.44 },
      { x:   0.00, y: -10.06 },
      { x:   6.78, y:  -6.78 },
      { x:   9.11, y:   0.00 },
      { x:   6.11, y:   6.11 },
      { x:   0.00, y:   8.17 },
      { x:  -5.44, y:   5.44 },
      { x:  -7.22, y:   0.00 },
      { x:  -4.77, y:  -4.77 },
      { x:   0.00, y:  -6.28 },
      { x:   4.10, y:  -4.10 },
      { x:   5.33, y:   0.00 },
      { x:   3.44, y:   3.44 },
      { x:   0.00, y:   4.39 },
      { x:  -2.77, y:   2.77 },
      { x:  -3.44, y:   0.00 },
      { x:  -2.10, y:  -2.10 },
      { x:   0.00, y:  -2.50 },
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
    name: 'Paisley Scroll',
    waypoints: [
      { x: -10, y:  -2 },
      { x:  -5, y:  -9 },
      { x:   3, y:  -8 },
      { x:   9, y:  -3 },
      { x:   9, y:   4 },
      { x:   3, y:   9 },
      { x:  -4, y:   8 },
      { x:  -8, y:   3 },
      { x:  -6, y:  -2 },
      { x:   0, y:  -5 },
      { x:   4, y:   0 },
      { x:   1, y:   4 },
      { x:  -2, y:   2 },
      { x:   0, y:   0 },
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
