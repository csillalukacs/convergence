// ─── SCENE OBJECTS ───

let shooterPivot;
let shooterBallMesh, nextBallMesh;
let shooterColorIdx = 0, nextColorIdx = 0;
let gears = [];
let bgStars = [];

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
  playSound('swap');
  const tmp = shooterColorIdx;
  shooterColorIdx = nextColorIdx;
  nextColorIdx = tmp;
  rebuildShooterVisuals();
}

// ─── CHAIN BALL MESH ───

function createBallMesh(colorIdx) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({ color: COLORS[colorIdx], metalness: 0.5, roughness: 0.3, emissive: COLOR_EMISSIVE[colorIdx] }));
  mesh.add(new THREE.Mesh(new THREE.TorusGeometry(BALL_RADIUS * 0.95, 0.03, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0xD4A847, metalness: 1, roughness: 0.1 })));
  return mesh;
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
