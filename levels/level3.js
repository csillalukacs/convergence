// Level 3 — Figure-of-eight, 5 colours
// Skull at centre: (0, 0)
LEVELS.push({
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
  colors:            3,
  chainSpeed:        2.4,
  spawnInterval:     0.35,
  rollInCount:       25,
  progressThreshold: 600,
});
