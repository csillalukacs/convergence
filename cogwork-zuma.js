// ═══════════════════════════════════════════════
//  COGWORK ZUMA — Full Zuma Rules
// ═══════════════════════════════════════════════
//
// Chain convention:
//   chain[0] = FRONT ball (highest t, closest to skull)
//   chain[last] = BACK ball (lowest t, spawn point)
//
// Rules:
//   1. Balls roll toward skull — game over if they reach it
//   2. Shooter rotates with mouse, click to fire
//   3. Match 3+ same color to destroy
//   4. Two balls held — right-click/space to swap
//   5. Gap collapse: after match, back segment slides forward;
//      if colors match at edges, chain reaction triggers
//   6. Progress bar: shooting fills it; once full, spawning stops
// ═══════════════════════════════════════════════

let scene, camera, renderer, clock;
let shooterPivot;
let shooterBallMesh, nextBallMesh;
let shooterColorIdx = 0, nextColorIdx = 0;
let chain = [];
let projectiles = [];
let particles = [];
let score = 0, combo = 1, level = 1;
let gameActive = false;
let mouseX = 0, mouseY = 0;
let pathPoints = [];
let pathLength = 0;
let chainSpeed = 1.2; // world units per second (arc-length)
let spawnTimer = 0;
let gears = [];
let bgStars = [];

// Progress / spawning
let progress = 0;
let progressMax = 40;
let shotsFired = 0;
let spawningDone = false;

// Roll-in phase
const ROLL_IN_COUNT = 20;
const ROLL_IN_SPEED = 8.0;
const ROLL_IN_INTERVAL = 0.1;
let rollInRemaining = 0;
let rollInSpawned = 0;

// Gap collapse
let collapseGaps = [];

const COLORS = [
  0xC0392B, 0x2980B9, 0x27AE60, 0xD4A847, 0x8E44AD,
];

const COLOR_EMISSIVE = [
  0x601010, 0x103050, 0x104020, 0x604010, 0x401050,
];

const BALL_RADIUS = 0.55;
const SHOOTER_POS = { x: 0, y: 0, z: 0 };

// ─── PATH ───
function buildPath() {
  pathPoints = [];
  const steps = 600;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 4.5 + Math.PI;
    const radius = 11 - t * 8.5;
    pathPoints.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  // Build arc-length table: arcLengths[i] = cumulative distance from pathPoints[0] to pathPoints[i]
  arcLengths = new Float64Array(pathPoints.length);
  arcLengths[0] = 0;
  for (let i = 1; i < pathPoints.length; i++) {
    arcLengths[i] = arcLengths[i - 1] + pathPoints[i].distanceTo(pathPoints[i - 1]);
  }
  pathLength = arcLengths[arcLengths.length - 1];
}

let arcLengths;

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

// Spacing in arc-length units (world distance between ball centers)
const BALL_SPACING = BALL_RADIUS * 2.05;

// ─── INIT ───
function init() {
  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0806);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0806, 0.018);

  const aspect = window.innerWidth / window.innerHeight;
  const f = 14;
  camera = new THREE.OrthographicCamera(-f * aspect, f * aspect, f, -f, -50, 50);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);

  clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight(0x3a2a10, 0.6));
  const dl = new THREE.DirectionalLight(0xD4A847, 0.8);
  dl.position.set(5, 8, 15); scene.add(dl);
  const pl = new THREE.PointLight(0xF0C040, 0.6, 30);
  pl.position.set(0, 0, 8); scene.add(pl);

  buildPath();
  createTrack();
  createBackground();
  createShooter();

  canvas.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  canvas.addEventListener('click', onShoot);
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); onSwapAction(); });
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY; }, { passive: false });
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); onSwapAction(); } });

  animate();
}

// ─── TRACK ───
function createTrack() {
  const curve = new THREE.CatmullRomCurve3(pathPoints);
  const t1 = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.12, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x3a2a10, metalness: 0.8, roughness: 0.3, emissive: 0x1a1005 }));
  t1.position.z = -0.3; scene.add(t1);
  const t2 = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.06, 4, false),
    new THREE.MeshStandardMaterial({ color: 0x8B6914, metalness: 0.9, roughness: 0.2, emissive: 0x2a1a05 }));
  t2.position.z = -0.25; scene.add(t2);

  // Skull / danger zone
  const ep = getPathPosFromS(pathLength);
  const dg = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0xC0392B, emissive: 0x601010, metalness: 0.5, side: THREE.DoubleSide }));
  dg.position.copy(ep); dg.position.z = -0.2; scene.add(dg);
  const cm = new THREE.MeshStandardMaterial({ color: 0xC0392B, emissive: 0x801515, side: THREE.DoubleSide });
  const c1 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), cm);
  c1.position.copy(ep); c1.position.z = -0.15; scene.add(c1);
  const c2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), cm);
  c2.position.copy(ep); c2.position.z = -0.15; c2.rotation.z = Math.PI / 2; scene.add(c2);
}

// ─── BACKGROUND ───
function createBackground() {
  [
    { x: -10, y: 8, s: 2.5, sp: 0.3 }, { x: 12, y: -7, s: 3, sp: -0.2 },
    { x: -8, y: -9, s: 1.8, sp: 0.4 }, { x: 11, y: 9, s: 2, sp: -0.35 },
    { x: -13, y: 0, s: 1.5, sp: 0.25 }, { x: 7, y: 11, s: 1.2, sp: -0.5 },
  ].forEach(gp => {
    const gear = createGearMesh(gp.s, 12);
    gear.position.set(gp.x, gp.y, -2);
    gear.userData.spinSpeed = gp.sp;
    scene.add(gear); gears.push(gear);
  });

  [
    { x1: -15, y1: -5, x2: -15, y2: 12 },
    { x1: 15, y1: -12, x2: 15, y2: 8 },
    { x1: -12, y1: -12, x2: 8, y2: -12 },
  ].forEach(pd => {
    const dir = new THREE.Vector3(pd.x2 - pd.x1, pd.y2 - pd.y1, 0);
    const len = dir.length(); dir.normalize();
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, len, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a3a1a, metalness: 0.9, roughness: 0.3 }));
    pipe.position.set((pd.x1 + pd.x2) / 2, (pd.y1 + pd.y2) / 2, -1.5);
    pipe.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2;
    scene.add(pipe);
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4),
        new THREE.MeshStandardMaterial({ color: 0x8B6914, metalness: 1, roughness: 0.2 }));
      r.position.set(pd.x1 + (pd.x2 - pd.x1) * t, pd.y1 + (pd.y2 - pd.y1) * t, -1.35);
      scene.add(r);
    }
  });

  for (let i = 0; i < 40; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xF0C040, transparent: true, opacity: Math.random() * 0.4 + 0.1 });
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), mat);
    s.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 28, -1 + Math.random() * 2);
    s.userData = { vy: (Math.random() - 0.3) * 0.5, vx: (Math.random() - 0.5) * 0.2, baseOp: mat.opacity };
    scene.add(s); bgStars.push(s);
  }
}

function createGearMesh(radius, teeth) {
  const shape = new THREE.Shape();
  const th = radius * 0.15, steps = teeth * 2;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = (i % 2 === 0) ? radius + th : radius - th * 0.3;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new THREE.Path();
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 2, hr = radius * 0.21;
    if (i === 0) hole.moveTo(Math.cos(a) * hr, Math.sin(a) * hr);
    else hole.lineTo(Math.cos(a) * hr, Math.sin(a) * hr);
  }
  shape.holes.push(hole);
  return new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0x2a1a0a, metalness: 0.8, roughness: 0.4, emissive: 0x0a0500 })
  );
}

// ─── SHOOTER ───
function createShooter() {
  shooterPivot = new THREE.Group();
  shooterPivot.position.set(SHOOTER_POS.x, SHOOTER_POS.y, 0);
  scene.add(shooterPivot);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x5a4020, metalness: 0.9, roughness: 0.2 }));
  base.rotation.x = Math.PI / 2; shooterPivot.add(base);

  shooterPivot.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xD4A847, metalness: 1, roughness: 0.1 })));

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3a1a, metalness: 0.9, roughness: 0.2, emissive: 0x1a0a00 }));
  barrel.position.y = 0.9; shooterPivot.add(barrel);

  const tip = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xD4A847, metalness: 1, roughness: 0.1, emissive: 0x3a2a05 }));
  tip.position.y = 1.65; shooterPivot.add(tip);

  loadShooterBalls();
}

function pickColor() {
  return Math.floor(Math.random() * Math.min(3 + Math.floor(level / 2), COLORS.length));
}

function makeBallPreview(colorIdx, size) {
  return new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10),
    new THREE.MeshStandardMaterial({ color: COLORS[colorIdx], metalness: 0.5, roughness: 0.3, emissive: COLOR_EMISSIVE[colorIdx] }));
}

function loadShooterBalls() {
  if (shooterBallMesh) shooterPivot.remove(shooterBallMesh);
  if (nextBallMesh) shooterPivot.remove(nextBallMesh);
  shooterColorIdx = pickColor();
  nextColorIdx = pickColor();
  shooterBallMesh = makeBallPreview(shooterColorIdx, BALL_RADIUS);
  shooterBallMesh.position.y = 1.7; shooterPivot.add(shooterBallMesh);
  nextBallMesh = makeBallPreview(nextColorIdx, BALL_RADIUS * 0.6);
  nextBallMesh.position.set(0.55, -0.1, 0.3); shooterPivot.add(nextBallMesh);
}

function rebuildShooterVisuals() {
  if (shooterBallMesh) shooterPivot.remove(shooterBallMesh);
  if (nextBallMesh) shooterPivot.remove(nextBallMesh);
  shooterBallMesh = makeBallPreview(shooterColorIdx, BALL_RADIUS);
  shooterBallMesh.position.y = 1.7; shooterPivot.add(shooterBallMesh);
  nextBallMesh = makeBallPreview(nextColorIdx, BALL_RADIUS * 0.6);
  nextBallMesh.position.set(0.55, -0.1, 0.3); shooterPivot.add(nextBallMesh);
}

function reloadPrimary() {
  shooterColorIdx = nextColorIdx;
  nextColorIdx = pickColor();
  rebuildShooterVisuals();
}

function onSwapAction() {
  if (!gameActive) return;
  const tmp = shooterColorIdx;
  shooterColorIdx = nextColorIdx;
  nextColorIdx = tmp;
  rebuildShooterVisuals();
}

// ─── CHAIN BALL ───
function createBallMesh(colorIdx) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({ color: COLORS[colorIdx], metalness: 0.5, roughness: 0.3, emissive: COLOR_EMISSIVE[colorIdx] }));
  mesh.add(new THREE.Mesh(new THREE.TorusGeometry(BALL_RADIUS * 0.95, 0.03, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0xD4A847, metalness: 1, roughness: 0.1 })));
  return mesh;
}

// ─── CHAIN MANAGEMENT ───
// Ball positions stored as `s` = arc-length distance along path (0 to pathLength)
function spawnChainBall() {
  const colorIdx = pickColor();
  const mesh = createBallMesh(colorIdx);
  scene.add(mesh);
  let startS = -BALL_SPACING;
  if (chain.length > 0) startS = chain[chain.length - 1].s - BALL_SPACING;
  chain.push({ mesh, colorIdx, s: startS, alive: true });
}

// Pending push-forwards: front segments that need to slide forward after ball insertion
// Tracked by ball references so indices don't go stale
let pushForwards = []; // { insertedBall, frontBall } — everything ahead of insertedBall pushes forward

function insertBallInChain(insertIdx, colorIdx) {
  const mesh = createBallMesh(colorIdx);
  scene.add(mesh);

  let refS;
  if (insertIdx < chain.length) {
    refS = chain[insertIdx].s;
  } else if (chain.length > 0) {
    refS = chain[chain.length - 1].s;
  } else {
    refS = 0;
  }

  const newBall = { mesh, colorIdx, s: refS, alive: true };
  chain.splice(insertIdx, 0, newBall);

  // The back segment (insertIdx+1..end) stays put.
  // The front segment (0..insertIdx-1) needs to slide FORWARD (toward skull).
  if (insertIdx > 0) {
    pushForwards.push({ insertedBall: newBall, frontBall: chain[insertIdx - 1] });
  }

  // Ensure inserted ball is spaced from back neighbor
  if (insertIdx < chain.length - 1) {
    const maxS = chain[insertIdx + 1].s + BALL_SPACING;
    if (newBall.s < maxS) {
      newBall.s = maxS;
    }
  }
}

// ─── MATCHING & CHAIN REACTIONS ───
function hasGapBetween(frontIdx, backIdx) {
  // frontIdx has higher s (closer to skull), backIdx = frontIdx + 1
  return chain[frontIdx].s - chain[backIdx].s > BALL_SPACING * 1.5;
}

function checkMatches(idx) {
  if (idx < 0 || idx >= chain.length) return;
  const col = chain[idx].colorIdx;
  let start = idx, end = idx;
  while (start > 0 && chain[start - 1].colorIdx === col && !hasGapBetween(start - 1, start)) start--;
  while (end < chain.length - 1 && chain[end + 1].colorIdx === col && !hasGapBetween(end, end + 1)) end++;

  const count = end - start + 1;
  if (count >= 3) {
    for (let i = start; i <= end; i++) {
      explodeBall(chain[i]);
      chain[i].alive = false;
    }
    chain = chain.filter(b => b.alive);
    score += count * 10 * combo;
    combo++;
    updateHUD();

    // Gap collapse: if there are balls on both sides of the removed section
    if (start > 0 && start < chain.length) {
      scheduleCollapse(start);
    }
  } else {
    combo = 1;
    updateHUD();
  }
}

function scheduleCollapse(gapFrontIdx) {
  const frontBall = chain[gapFrontIdx - 1];
  const backBall = chain[gapFrontIdx];
  const matching = frontBall && backBall && frontBall.colorIdx === backBall.colorIdx;
  collapseGaps.push({ frontBall, backBall, matching });
}

function updatePushForwards(dt) {
  if (pushForwards.length === 0) return;

  for (let g = pushForwards.length - 1; g >= 0; g--) {
    const pf = pushForwards[g];

    const insertedIdx = chain.indexOf(pf.insertedBall);
    const frontIdx = chain.indexOf(pf.frontBall);

    if (insertedIdx < 0 || frontIdx < 0 || frontIdx >= insertedIdx) {
      pushForwards.splice(g, 1); continue;
    }

    const targetS = pf.insertedBall.s + BALL_SPACING;
    const currentOverlap = targetS - pf.frontBall.s;

    if (currentOverlap <= 0.02) {
      pf.frontBall.s = targetS;
      // Propagate spacing forward within the contiguous segment only
      for (let i = frontIdx - 1; i >= 0; i--) {
        // Check if there's a gap between i and i+1
        const gapHere = collapseGaps.some(cg => {
          const fi = chain.indexOf(cg.frontBall);
          const bi = chain.indexOf(cg.backBall);
          return fi === i && bi === i + 1;
        });
        if (gapHere) break;
        const tgt = chain[i + 1].s + BALL_SPACING;
        if (chain[i].s < tgt) chain[i].s = tgt; else break;
      }
      pushForwards.splice(g, 1);
    } else {
      const pushSpeed = 15;
      const move = Math.min(pushSpeed * dt, currentOverlap);
      // Only move the contiguous segment from frontIdx back to insertedIdx-1
      // But also push everything ahead of frontIdx that's contiguous (no gap)
      let pushStart = frontIdx;
      for (let i = frontIdx - 1; i >= 0; i--) {
        const gapHere = collapseGaps.some(cg => {
          const fi = chain.indexOf(cg.frontBall);
          const bi = chain.indexOf(cg.backBall);
          return fi === i && bi === i + 1;
        });
        if (gapHere) break;
        pushStart = i;
      }
      for (let i = pushStart; i <= frontIdx; i++) chain[i].s += move;
    }
  }
}

function updateCollapses(dt) {
  if (collapseGaps.length === 0) return;

  for (let g = collapseGaps.length - 1; g >= 0; g--) {
    const gap = collapseGaps[g];

    // Find current indices of the referenced balls
    const frontIdx = chain.indexOf(gap.frontBall);
    const backIdx = chain.indexOf(gap.backBall);

    // Validate: frontBall should be at a lower index (higher s) than backBall
    if (frontIdx < 0 || backIdx < 0 || backIdx !== frontIdx + 1) {
      // Balls removed or no longer adjacent gap — discard
      collapseGaps.splice(g, 1); continue;
    }

    const targetS = gap.frontBall.s - BALL_SPACING;
    const currentGap = targetS - gap.backBall.s;

    if (currentGap <= 0.05) {
      // Gap closed — snap spacing
      gap.backBall.s = targetS;
      for (let i = backIdx + 1; i < chain.length; i++) {
        const tgt = chain[i - 1].s - BALL_SPACING;
        if (chain[i].s > tgt) chain[i].s = tgt; else break;
      }
      collapseGaps.splice(g, 1);

      // Chain reaction check
      if (gap.frontBall.colorIdx === gap.backBall.colorIdx) {
        const checkIdx = backIdx;
        setTimeout(() => {
          if (chain.length > 0) checkMatches(Math.min(checkIdx, chain.length - 1));
        }, 100);
      }
    } else if (gap.matching) {
      // Matching colors: front segment actively slides backward to close gap
      // Only move the contiguous segment (stop at other gaps)
      let moveStart = frontIdx;
      for (let i = frontIdx - 1; i >= 0; i--) {
        const gapHere = collapseGaps.some(cg => {
          if (cg === gap) return false; // skip self
          const fi = chain.indexOf(cg.frontBall);
          const bi = chain.indexOf(cg.backBall);
          return fi === i && bi === i + 1;
        }) || pushForwards.some(pf => {
          const ii = chain.indexOf(pf.insertedBall);
          return ii === i + 1;
        });
        if (gapHere) break;
        moveStart = i;
      }
      const collapseSpeed = 15;
      const move = Math.min(collapseSpeed * dt, currentGap);
      for (let i = moveStart; i <= frontIdx; i++) chain[i].s -= move;
    }
    // Non-matching: do nothing — back segment's natural advance closes it
  }
}

// ─── EXPLOSIONS ───
function explodeBall(ball) {
  const pos = ball.mesh.position.clone();
  scene.remove(ball.mesh);

  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4),
      new THREE.MeshBasicMaterial({ color: COLORS[ball.colorIdx], transparent: true, opacity: 1 }));
    p.position.copy(pos);
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3;
    p.userData = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.025 + Math.random() * 0.02 };
    scene.add(p); particles.push(p);
  }
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xccbbaa, transparent: true, opacity: 0.5 }));
    s.position.copy(pos);
    s.userData = { vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 2, life: 1, decay: 0.018 };
    scene.add(s); particles.push(s);
  }
}

// ─── SHOOTING ───
function onShoot(e) {
  if (!gameActive || e.button !== 0) return;
  const dir = getAimDir(e.clientX, e.clientY);
  const proj = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({ color: COLORS[shooterColorIdx], metalness: 0.5, roughness: 0.3, emissive: COLOR_EMISSIVE[shooterColorIdx] }));
  proj.position.set(SHOOTER_POS.x + dir.x * 2, SHOOTER_POS.y + dir.y * 2, 0);
  scene.add(proj);
  projectiles.push({ mesh: proj, vx: dir.x * 28, vy: dir.y * 28, colorIdx: shooterColorIdx, alive: true });

  shotsFired++;
  progress = Math.min(1, shotsFired / progressMax);
  updateProgressBar();
  if (progress >= 1 && !spawningDone) {
    spawningDone = true;
    showBanner('NO MORE BALLS!');
  }
  reloadPrimary();
}

function onTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 2) { onSwapAction(); return; }
  mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY;
  onShoot({ clientX: mouseX, clientY: mouseY, button: 0 });
}

function getAimDir(cx, cy) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndcX = ((cx - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((cy - rect.top) / rect.height) * 2 + 1;
  const wp = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
  return new THREE.Vector2(wp.x - SHOOTER_POS.x, wp.y - SHOOTER_POS.y).normalize();
}

// ─── COLLISION ───
function checkProjectileCollisions(dt) {
  for (let p = projectiles.length - 1; p >= 0; p--) {
    const proj = projectiles[p];
    if (!proj.alive) continue;
    proj.mesh.position.x += proj.vx * dt;
    proj.mesh.position.y += proj.vy * dt;

    if (Math.abs(proj.mesh.position.x) > 16 || Math.abs(proj.mesh.position.y) > 16) {
      scene.remove(proj.mesh); proj.alive = false; continue;
    }

    for (let i = 0; i < chain.length; i++) {
      const ball = chain[i];
      if (!ball.alive) continue;
      const dx = proj.mesh.position.x - ball.mesh.position.x;
      const dy = proj.mesh.position.y - ball.mesh.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < BALL_RADIUS * 2.1) {
        const tangent = getPathTangentFromS(ball.s);
        const dot = tangent.x * dx / dist + tangent.y * dy / dist;
        const insertIdx = dot > 0 ? i : i + 1;

        scene.remove(proj.mesh); proj.alive = false;
        insertBallInChain(insertIdx, proj.colorIdx);
        checkMatches(insertIdx);
        break;
      }
    }
  }
  projectiles = projectiles.filter(p => p.alive);
}

// ─── GAME LOOP ───
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameActive) {
    const dir = getAimDir(mouseX, mouseY);
    shooterPivot.rotation.z = -Math.atan2(dir.x, dir.y);
  }

  gears.forEach(g => { g.rotation.z += g.userData.spinSpeed * dt; });

  bgStars.forEach(s => {
    s.position.x += s.userData.vx * dt;
    s.position.y += s.userData.vy * dt;
    s.material.opacity = s.userData.baseOp * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2 + s.position.x));
    if (s.position.y > 15) { s.position.y = -15; s.position.x = (Math.random() - 0.5) * 30; }
    if (s.position.y < -15) { s.position.y = 15; }
  });

  if (gameActive) {
    spawnTimer += dt;

    // Spawn at back of chain
    const rollingIn = rollInRemaining > 0;
    const spawnInterval = rollInSpawned < ROLL_IN_COUNT ? ROLL_IN_INTERVAL : 0.45;
    if (!spawningDone && spawnTimer > spawnInterval) {
      spawnChainBall();
      spawnTimer = 0;
      if (rollInSpawned < ROLL_IN_COUNT) {
        chain[chain.length - 1].isRollIn = true;
        rollInSpawned++;
      }
    }

    // Advance chain
    const activeSpeed = rollingIn ? ROLL_IN_SPEED : chainSpeed;
    if (chain.length > 0) {
      // Collect all split points (indices where a gap or push-forward boundary exists)
      let splitIndices = new Set();

      for (const g of collapseGaps) {
        const bi = chain.indexOf(g.backBall);
        if (bi > 0) splitIndices.add(bi);
      }
      for (const p of pushForwards) {
        const ii = chain.indexOf(p.insertedBall);
        if (ii > 0) splitIndices.add(ii);
      }

      if (splitIndices.size === 0) {
        // No gaps — advance all balls uniformly
        for (let i = 0; i < chain.length; i++) {
          chain[i].s += activeSpeed * dt;
        }
        // Enforce spacing (front to back)
        for (let i = 1; i < chain.length; i++) {
          const tgt = chain[i - 1].s - BALL_SPACING;
          if (chain[i].s > tgt) chain[i].s = tgt;
        }
      } else {
        // Only the rearmost segment advances
        const sorted = [...splitIndices].sort((a, b) => a - b);
        const lastSplit = sorted[sorted.length - 1];

        for (let i = lastSplit; i < chain.length; i++) {
          chain[i].s += activeSpeed * dt;
        }
        // Enforce spacing only within the back segment
        for (let i = lastSplit + 1; i < chain.length; i++) {
          const tgt = chain[i - 1].s - BALL_SPACING;
          if (chain[i].s > tgt) chain[i].s = tgt;
        }

        // Also enforce spacing within each OTHER segment (but don't cross gaps)
        // Segments: [0..sorted[0]-1], [sorted[0]..sorted[1]-1], etc.
        let segStart = 0;
        for (const split of sorted) {
          // Enforce spacing within segment [segStart..split-1]
          for (let i = segStart + 1; i < split; i++) {
            const tgt = chain[i - 1].s - BALL_SPACING;
            if (chain[i].s > tgt) chain[i].s = tgt;
          }
          segStart = split;
        }
      }
    }

    updateCollapses(dt);
    updatePushForwards(dt);

    // Update ball positions
    for (let i = 0; i < chain.length; i++) {
      const ball = chain[i];
      if (ball.isRollIn && !ball.rolledIn && ball.s >= 0) {
        ball.rolledIn = true;
        rollInRemaining--;
      }
      ball.mesh.visible = ball.s >= 0;
      if (!ball.mesh.visible) continue;
      const pos = getPathPosFromS(ball.s);
      ball.mesh.position.copy(pos);
      ball.mesh.position.z = 0;
      ball.mesh.rotation.z += dt * 1.5;
      ball.mesh.rotation.x += dt * 0.8;
    }

    // Game over
    if (chain.length > 0 && chain[0].s >= pathLength * 0.98) gameOver();

    checkProjectileCollisions(dt);

    // Level clear
    if (chain.length === 0 && spawningDone) levelUp();
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.position.x += p.userData.vx * dt;
    p.position.y += p.userData.vy * dt;
    p.userData.life -= p.userData.decay;
    p.material.opacity = Math.max(0, p.userData.life);
    p.scale.setScalar(Math.max(0.01, p.userData.life));
    if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
  }

  renderer.render(scene, camera);
}

// ─── GAME STATE ───
function startGame() {
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('game-over').style.display = 'none';

  chain.forEach(b => scene.remove(b.mesh)); chain = [];
  projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
  particles.forEach(p => scene.remove(p)); particles = [];
  collapseGaps = [];
  pushForwards = [];

  score = 0; combo = 1; level = 1;
  chainSpeed = 1.2; spawnTimer = 0;
  shotsFired = 0; progress = 0; progressMax = 40; spawningDone = false;
  rollInRemaining = ROLL_IN_COUNT; rollInSpawned = 0;

  updateHUD(); updateProgressBar();
  loadShooterBalls();
  gameActive = true;
  showBanner('LEVEL 1');
}

function gameOver() {
  gameActive = false;
  document.getElementById('game-over').style.display = 'flex';
  document.getElementById('final-score').textContent = 'Score: ' + score;
  document.getElementById('go-title').textContent = 'GEARS HALTED';
}

function levelUp() {
  level++;
  chainSpeed = Math.min(3.0, 1.2 + level * 0.2);
spawnTimer = -2;
  shotsFired = 0; progress = 0;
  progressMax = Math.min(60, 40 + level * 5);
  spawningDone = false;
  rollInRemaining = ROLL_IN_COUNT; rollInSpawned = 0;
  updateProgressBar();
  showBanner('LEVEL ' + level);
  updateHUD();
}

function showBanner(text) {
  const b = document.getElementById('level-banner');
  b.textContent = text; b.style.opacity = '1';
  setTimeout(() => { b.style.opacity = '0'; }, 2000);
}

function updateHUD() {
  document.getElementById('score-val').textContent = score;
  document.getElementById('level-val').textContent = level;
  document.getElementById('combo-val').textContent = 'x' + combo;
}

function updateProgressBar() {
  document.getElementById('progress-bar').style.width = (progress * 100) + '%';
  document.getElementById('progress-label').textContent = spawningDone ? 'PRESSURE MAXED — CLEAR THE TRACK!' : 'PRESSURE GAUGE';
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  const a = w / h, f = 14;
  camera.left = -f * a; camera.right = f * a; camera.top = f; camera.bottom = -f;
  camera.updateProjectionMatrix();
}

init();
