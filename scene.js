// ─── SCENE OBJECTS ───

let shooterPivot;
let shooterBallMesh, nextBallMesh;
let shooterColorIdx = 0, nextColorIdx = 0;
let gears = []; // crystal shards (reuses gears array for animate loop)
let bgStars = [];

// ─── TRACK ───

let trackMeshes = [];

function clearTrack() {
  trackMeshes.forEach(m => scene.remove(m));
  trackMeshes = [];
}

function createPipeEntrance() {
  const startPos = getPathPosFromS(0);
  const tangent = getPathTangentFromS(0);

  const PIPE_LENGTH = 4.5;
  const PIPE_RADIUS = BALL_RADIUS * 1.22;

  // Quaternion to rotate cylinder's Y-axis to align with tangent
  const quatCyl = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  // Quaternion to rotate torus's Z-axis to align with tangent (torus hole faces Z)
  const quatTorus = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

  // Pipe body — extends a little past s=0 and mostly behind it
  const PIPE_OVERHANG = 0.5;
  const pipeCenter = startPos.clone().addScaledVector(tangent, -(PIPE_LENGTH / 2) + PIPE_OVERHANG);
  pipeCenter.z = -0.15;
  const pipeMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, PIPE_LENGTH, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2a4a66, metalness: 0.95, roughness: 0.08, emissive: 0x0a1a2a, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
  );
  pipeMesh.position.copy(pipeCenter);
  pipeMesh.quaternion.copy(quatCyl);
  scene.add(pipeMesh); trackMeshes.push(pipeMesh);

  // Inner glow sleeve
  const glowMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS * 0.78, PIPE_RADIUS * 0.78, PIPE_LENGTH, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.0, roughness: 0.0, emissive: 0x224488, emissiveIntensity: 0.6, transparent: true, opacity: 0.18, side: THREE.BackSide })
  );
  glowMesh.position.copy(pipeCenter);
  glowMesh.quaternion.copy(quatCyl);
  scene.add(glowMesh); trackMeshes.push(glowMesh);

  // Exit ring — glowing torus at pipe exit (slightly past s=0)
  const ringPos = startPos.clone().addScaledVector(tangent, PIPE_OVERHANG); ringPos.z = -0.05;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(PIPE_RADIUS, 0.09, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0xaaddff, metalness: 0.9, roughness: 0.0, emissive: 0x4488bb, emissiveIntensity: 1.2 })
  );
  ring.position.copy(ringPos);
  ring.quaternion.copy(quatTorus);
  scene.add(ring); trackMeshes.push(ring);

  // Second accent ring slightly inside the pipe
  const ring2Pos = startPos.clone().addScaledVector(tangent, PIPE_OVERHANG - 0.6); ring2Pos.z = -0.05;
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(PIPE_RADIUS, 0.06, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.9, roughness: 0.0, emissive: 0x224466, emissiveIntensity: 0.8 })
  );
  ring2.position.copy(ring2Pos);
  ring2.quaternion.copy(quatTorus);
  scene.add(ring2); trackMeshes.push(ring2);
}

function createTrack() {
  const curve = new THREE.CatmullRomCurve3(pathPoints);
  // Outer glow shell — translucent crystal
  const t1 = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.15, 8, false),
    new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.1, roughness: 0.0, emissive: 0x224466, transparent: true, opacity: 0.30 }));
  t1.position.z = -0.3; scene.add(t1); trackMeshes.push(t1);
  // Inner glowing core
  const t2 = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.05, 6, false),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.0, roughness: 0.0, emissive: 0x99ddff }));
  t2.position.z = -0.25; scene.add(t2); trackMeshes.push(t2);

  createPipeEntrance();

  // Danger zone at skull end
  const ep = getPathPosFromS(pathLength);
  const dg = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0xFF2255, emissive: 0x880020, metalness: 0.5, side: THREE.DoubleSide }));
  dg.position.copy(ep); dg.position.z = -0.2; scene.add(dg); trackMeshes.push(dg);
  const cm = new THREE.MeshStandardMaterial({ color: 0xFF2255, emissive: 0xaa0030, side: THREE.DoubleSide });
  const c1 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), cm);
  c1.position.copy(ep); c1.position.z = -0.15; scene.add(c1); trackMeshes.push(c1);
  const c2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), cm);
  c2.position.copy(ep); c2.position.z = -0.15; c2.rotation.z = Math.PI / 2; scene.add(c2); trackMeshes.push(c2);
}

// ─── RESONANCE NODES (bonus pickups) ───

let bonusCrystals = [];

const BONUS_CRYSTAL_LIFESPAN = 9.0; // seconds before it fades out

function spawnBonusCrystal() {
  // Pick a random position along the path, slightly off-centre, z behind the chain
  const s = pathLength * (0.15 + Math.random() * 0.70);
  const pos = getPathPosFromS(s);
  const tan = getPathTangentFromS(s);
  const side = Math.random() < 0.5 ? 1 : -1;
  // Small perpendicular offset so it's not dead-centre on the track
  const OFFSET = 0.8 + Math.random() * 0.6;
  const nx = -tan.y * side * OFFSET;
  const ny =  tan.x * side * OFFSET;
  const phase = Math.random() * Math.PI * 2;

  // Core crystal — bright white-gold
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshStandardMaterial({
      color: 0xFFFFCC, emissive: 0xFFCC00, emissiveIntensity: 2.5,
      metalness: 0.3, roughness: 0.0
    })
  );

  // Mid shell — translucent amber
  const mid = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.92, 1),
    new THREE.MeshStandardMaterial({
      color: 0xFFAA00, emissive: 0xFF8800, emissiveIntensity: 1.0,
      metalness: 0.0, roughness: 0.0, transparent: true, opacity: 0.38, side: THREE.DoubleSide
    })
  );

  // Outer wireframe cage
  const cage = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.15, 0),
    new THREE.MeshBasicMaterial({ color: 0xFFEE44, transparent: true, opacity: 0.55, wireframe: true })
  );

  // Large soft glow sphere
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xFFCC00, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
  );

  const group = new THREE.Group();
  group.add(core, mid, cage, glow);
  // z=-1.8: visually behind the chain (balls sit at z~0, track at z~-0.3)
  group.position.set(pos.x + nx, pos.y + ny, -1.8);
  group.userData = { phase, core, cage, mid, glow };

  scene.add(group);
  bonusCrystals.push({ mesh: group, alive: true, life: BONUS_CRYSTAL_LIFESPAN });
}

function clearBonusCrystals() {
  bonusCrystals.forEach(c => scene.remove(c.mesh));
  bonusCrystals = [];
}

// ─── BACKGROUND ───

function createBackground() {
  const hw = camera.right + 4; // half-width with margin beyond frustum edge
  const hh = camera.top + 3;  // half-height with margin

  // Floating crystal shards
  const shardColors = [0xFF2255, 0x00AAFF, 0x00FF88, 0xFFCC00, 0xCC44FF, 0xffffff, 0x88ccff];
  for (let i = 0; i < 20; i++) {
    const col = shardColors[Math.floor(Math.random() * shardColors.length)];
    const size = 0.12 + Math.random() * 0.45;
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(size, 0),
      new THREE.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: 0.35,
        metalness: 0.3, roughness: 0.0, transparent: true, opacity: 0.55 + Math.random() * 0.3
      })
    );
    shard.position.set((Math.random() - 0.5) * hw * 2, (Math.random() - 0.5) * hh * 2, -1.5 - Math.random() * 2);
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    shard.userData.spinSpeed = (Math.random() - 0.5) * 0.5;
    scene.add(shard);
    gears.push(shard);
  }

  // Colorful twinkling stars
  const starPalette = [0xffffff, 0xaaddff, 0xff88cc, 0x88ffdd, 0xffddaa, 0xcc88ff];
  for (let i = 0; i < 80; i++) {
    const col = starPalette[Math.floor(Math.random() * starPalette.length)];
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: Math.random() * 0.5 + 0.1 });
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.02 + Math.random() * 0.04, 4, 4), mat);
    s.position.set((Math.random() - 0.5) * hw * 2, (Math.random() - 0.5) * hh * 2, -1 + Math.random() * 2);
    s.userData = { vy: (Math.random() - 0.3) * 0.3, vx: (Math.random() - 0.5) * 0.12, baseOp: mat.opacity };
    scene.add(s); bgStars.push(s);
  }
}

// ─── SHOOTER ───

function createShooter() {
  shooterPivot = new THREE.Group();
  shooterPivot.position.set(SHOOTER_POS.x, SHOOTER_POS.y, 0);
  scene.add(shooterPivot);

  // Crystal base disc
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x224466, metalness: 0.9, roughness: 0.1, emissive: 0x112233 }));
  base.rotation.x = Math.PI / 2; shooterPivot.add(base);

  // Glow ring
  shooterPivot.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.8, roughness: 0.0, emissive: 0x336699 })));

  // Crystal barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xaaddff, metalness: 0.8, roughness: 0.05, emissive: 0x112244, transparent: true, opacity: 0.85 }));
  barrel.position.y = 0.9; shooterPivot.add(barrel);

  const tip = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.0, emissive: 0x4488aa }));
  tip.position.y = 1.65; shooterPivot.add(tip);

  loadShooterBalls();
}

function pickColor() {
  if (spawningDone && chain.length > 0) {
    const present = [...new Set(chain.map(b => b.colorIdx))];
    if (present.length > 0) return present[Math.floor(Math.random() * present.length)];
  }
  return Math.floor(Math.random() * levelColors);
}

function makeBallPreview(colorIdx, size) {
  return new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10),
    new THREE.MeshStandardMaterial({ map: getBallTexture(colorIdx), color: 0xffffff, metalness: 0.8, roughness: 0.05, emissive: COLOR_EMISSIVE[colorIdx] }));
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

// ─── COMBO TEXT ───

let activeScorePopup = null;

function spawnScorePopup(worldPos, className, html) {
  if (activeScorePopup) { activeScorePopup.remove(); activeScorePopup = null; }

  const ndc = worldPos.clone().project(camera);
  const x = (ndc.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-ndc.y * 0.5 + 0.5) * window.innerHeight;

  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = html;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  activeScorePopup = el;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = 'translate(-50%, -120px)';
    el.style.opacity = '0';
  }));
  setTimeout(() => { if (activeScorePopup === el) activeScorePopup = null; el.remove(); }, 2600);
}

function spawnScoreText(worldPos, points) {
  spawnScorePopup(worldPos, 'score-text', '+' + points);
}

function spawnGapBonusText(worldPos, matchScore) {
  spawnScorePopup(worldPos, 'gap-bonus-text', 'GAP BONUS +' + matchScore);
}

function spawnComboText(worldPos, comboVal, matchScore) {
  spawnScorePopup(worldPos, 'combo-text', 'COMBO ×' + comboVal + '<br><span class="combo-score">+' + matchScore + '</span>');
}

// ─── BALL TEXTURES ───

const ballTextures = [];

function getBallTexture(colorIdx) {
  if (!ballTextures[colorIdx]) ballTextures[colorIdx] = createBallTexture(colorIdx);
  return ballTextures[colorIdx];
}

function createBallTexture(colorIdx) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');

  const hex = COLORS[colorIdx];
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  const cols = {
    base: `rgb(${r},${g},${b})`,
    dark: `rgb(${Math.round(r * 0.15)},${Math.round(g * 0.15)},${Math.round(b * 0.15)})`,
    mid:  `rgb(${Math.round(r * 0.45)},${Math.round(g * 0.45)},${Math.round(b * 0.45)})`,
    lite: `rgb(${Math.min(255, Math.round(r * 1.5 + 80))},${Math.min(255, Math.round(g * 1.5 + 80))},${Math.min(255, Math.round(b * 1.5 + 80))})`,
  };

  ctx.fillStyle = cols.base;
  ctx.fillRect(0, 0, S, S);

  [texBrilliant, texHexFacets, texEmeraldCut, texStarburst, texDiamondGrid][colorIdx](ctx, S, cols);

  return new THREE.CanvasTexture(cv);
}

// 0 — Ruby: brilliant-cut radial facets
function texBrilliant(ctx, S, cols) {
  const cx = S / 2, cy = S / 2;
  const slices = 8;
  for (let i = 0; i < slices; i++) {
    const a1 = (i / slices) * Math.PI * 2;
    const a2 = ((i + 1) / slices) * Math.PI * 2;
    const aMid = (a1 + a2) / 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, S * 0.48, a1, a2); ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? cols.mid : cols.lite; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a1) * S * 0.22, cy + Math.sin(a1) * S * 0.22);
    ctx.lineTo(cx + Math.cos(aMid) * S * 0.22, cy + Math.sin(aMid) * S * 0.22);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? cols.lite : cols.mid; ctx.fill();
  }
  ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.015;
  for (let i = 0; i < slices; i++) {
    const a = (i / slices) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * S * 0.48, cy + Math.sin(a) * S * 0.48); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = cols.lite; ctx.fill();
}

// 1 — Sapphire: hexagonal facet grid
function texHexFacets(ctx, S, cols) {
  const r = S * 0.14, w = r * Math.sqrt(3);
  for (let row = -1; row < 7; row++) {
    for (let col = -1; col < 7; col++) {
      const cx = col * w + (row % 2 === 0 ? 0 : w / 2);
      const cy = row * r * 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = cx + Math.cos(a) * r * 0.9, y = cy + Math.sin(a) * r * 0.9;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = (row + col) % 2 === 0 ? cols.mid : cols.lite; ctx.fill();
      ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.018; ctx.stroke();
    }
  }
}

// 2 — Emerald: diagonal step cuts
function texEmeraldCut(ctx, S, cols) {
  const step = S / 6;
  for (let i = -2; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step, 0); ctx.lineTo((i + 1) * step, 0);
    ctx.lineTo((i + 1) * step - S, S); ctx.lineTo(i * step - S, S);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? cols.mid : cols.lite; ctx.fill();
  }
  ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.022;
  for (let i = -2; i < 10; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step - S, S); ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * step + step * 0.5); ctx.lineTo(S, i * step + step * 0.5); ctx.stroke();
  }
}

// 3 — Amber: starburst
function texStarburst(ctx, S, cols) {
  const cx = S / 2, cy = S / 2, rays = 12;
  for (let i = 0; i < rays; i++) {
    const a1 = (i / rays) * Math.PI * 2;
    const a2 = ((i + 0.5) / rays) * Math.PI * 2;
    const a3 = ((i + 1) / rays) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, S * 0.46, a1, a3); ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? cols.mid : cols.lite; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, S * 0.22, a1, a2); ctx.closePath();
    ctx.fillStyle = cols.lite; ctx.fill();
  }
  ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.015;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * S * 0.46, cy + Math.sin(a) * S * 0.46); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = cols.lite; ctx.fill();
}

// 4 — Amethyst: rotated diamond grid
function texDiamondGrid(ctx, S, cols) {
  ctx.save();
  ctx.translate(S / 2, S / 2); ctx.rotate(Math.PI / 4); ctx.translate(-S / 2, -S / 2);
  const step = S / 5;
  for (let row = -2; row < 8; row++) {
    for (let col = -2; col < 8; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? cols.mid : cols.lite;
      ctx.fillRect(col * step, row * step, step, step);
    }
  }
  ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.022;
  for (let i = -2; i < 9; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, -S); ctx.lineTo(i * step, S * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-S, i * step); ctx.lineTo(S * 2, i * step); ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = cols.lite; ctx.fill();
}

// ─── CHAIN BALL MESH ───

function createBallMesh(colorIdx) {
  return new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({ map: getBallTexture(colorIdx), color: 0xffffff, metalness: 0.8, roughness: 0.05, emissive: COLOR_EMISSIVE[colorIdx] }));
}

// ─── POWERUP SPRITES ───

function createPowerupSprite(type) {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#aaddff';
  ctx.shadowBlur = 10;

  if (type === 'pause') {
    // Two vertical bars
    const bw = S * 0.13, bh = S * 0.40, cy = S / 2, cx = S / 2;
    ctx.fillRect(cx - bw - S * 0.06, cy - bh / 2, bw, bh);
    ctx.fillRect(cx + S * 0.06,      cy - bh / 2, bw, bh);
  } else if (type === 'backwards') {
    // Left-pointing rewind arrow: triangle + bar
    const cx = S / 2, cy = S / 2, r = S * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - r,       cy);
    ctx.lineTo(cx + r * 0.6, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.6, cy + r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - r - S * 0.10, cy - r * 0.7, S * 0.09, r * 1.4);
  } else if (type === 'blast') {
    // Starburst / nova icon — 8 radiating spikes
    const cx = S / 2, cy = S / 2, spikes = 8;
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 14;
    for (let k = 0; k < spikes; k++) {
      const a = (k / spikes) * Math.PI * 2;
      const aHalf = a + Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * S * 0.42, cy + Math.sin(a) * S * 0.42);
      ctx.lineTo(cx + Math.cos(aHalf) * S * 0.16, cy + Math.sin(aHalf) * S * 0.16);
      ctx.closePath();
      ctx.fillStyle = k % 2 === 0 ? '#ffffff' : '#ffdd44';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 1.6, 1);
  return sprite;
}

function createPowerupHalo() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS * 1.55, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0xaaddff, transparent: true, opacity: 0,
      side: THREE.BackSide, depthWrite: false
    })
  );
}

// ─── EXPLOSIONS ───

function explodeBall(ball) {
  const pos = ball.mesh.position.clone();
  scene.remove(ball.mesh);

  // Colored crystal shards
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.06 + Math.random() * 0.08, 0),
      new THREE.MeshBasicMaterial({ color: COLORS[ball.colorIdx], transparent: true, opacity: 1 }));
    p.position.copy(pos);
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
    p.userData = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.022 + Math.random() * 0.02 };
    scene.add(p); particles.push(p);
  }
  // White prismatic flash sparks
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.07, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    s.position.copy(pos);
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5;
    s.userData = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.03 };
    scene.add(s); particles.push(s);
  }
}
