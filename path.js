// ─── CONSTANTS ───

const COLORS = [
  0xFF2255, // ruby
  0x00AAFF, // sapphire
  0x00FF88, // emerald
  0xFFCC00, // amber
  0xCC44FF, // amethyst
];

const COLOR_EMISSIVE = [
  0x880020,
  0x004488,
  0x007744,
  0x886600,
  0x661188,
];

const BALL_RADIUS = 0.75;
const SHOOTER_POS = { x: 0, y: 0, z: 0 };

let levelColors = 3;

// ─── PATH ───

let pathPoints = [];
let pathLength = 0;
let arcLengths;

const BALL_SPACING = BALL_RADIUS * 2.05;

// waypoints: array of {x, y} — the skull sits at the last waypoint
function buildPath(waypoints) {
  const curve = new THREE.CatmullRomCurve3(
    waypoints.map(p => new THREE.Vector3(p.x, p.y, p.z ?? 0)),
    false, 'catmullrom', 0.5
  );
  pathPoints = [];
  const steps = 600;
  for (let i = 0; i <= steps; i++) {
    pathPoints.push(curve.getPoint(i / steps));
  }
  arcLengths = new Float64Array(pathPoints.length);
  arcLengths[0] = 0;
  for (let i = 1; i < pathPoints.length; i++) {
    arcLengths[i] = arcLengths[i - 1] + pathPoints[i].distanceTo(pathPoints[i - 1]);
  }
  pathLength = arcLengths[arcLengths.length - 1];
}

// Get position on path by arc-length distance s (0 to pathLength)
function getPathPosFromS(s) {
  s = Math.max(0, Math.min(s, pathLength));
  // Binary search for the segment
  let lo = 0, hi = arcLengths.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (arcLengths[mid] <= s) lo = mid; else hi = mid;
  }
  const segLen = arcLengths[hi] - arcLengths[lo];
  const frac = segLen > 0 ? (s - arcLengths[lo]) / segLen : 0;
  return new THREE.Vector3().lerpVectors(pathPoints[lo], pathPoints[hi], frac);
}

function getPathTangentFromS(s) {
  const eps = 0.5; // small arc-length offset
  const p1 = getPathPosFromS(Math.max(0, s - eps));
  const p2 = getPathPosFromS(Math.min(pathLength, s + eps));
  return new THREE.Vector3().subVectors(p2, p1).normalize();
}
