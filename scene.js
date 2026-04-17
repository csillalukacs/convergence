// ─── SCENE OBJECTS ───

let shooterPivot;
let shooterBallMesh, nextBallMesh;
let shooterColorIdx = 0, nextColorIdx = 0;
let bgShards = [];
let bgStars = [];
let currentTier = 0;

// Scene lights (set in main.js init, updated by applyTheme)
let sceneAmbient, sceneDir1, sceneDir2, scenePoint1, scenePoint2;

function createFlashOverlay() {}
function triggerFlash() {}
function tickFlash() {}

// Track visuals are now managed by the Track class in track.js

// createPipeEntrance, createTrack moved to Track class in track.js

// Bonus crystals are now managed by the Track class in track.js

// ─── BACKGROUND ───

function _buildShards(theme, hw, hh) {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  if (theme.name === 'Nebula') {
    // Fog layer: overlapping large semi-transparent blobs in different colors
    const fogColors = [0x330055, 0x550088, 0x220044, 0x440066, 0x110033];
    for (let i = 0; i < 16; i++) {
      const col = fogColors[Math.floor(Math.random() * fogColors.length)];
      const blobSize = 2.5 + Math.random() * 5.0;
      const blob = new THREE.Mesh(
        _fogBlobGeom(),
        new THREE.MeshBasicMaterial({
          color: col, transparent: true,
          opacity: 0.04 + Math.random() * 0.09, depthWrite: false
        })
      );
      blob.scale.setScalar(blobSize);
      blob.position.set((Math.random() - 0.5) * hw * 2, (Math.random() - 0.5) * hh * 2, -3.5 - Math.random() * 2);
      blob.userData.spinSpeed = (Math.random() - 0.5) * 0.025;
      scene.add(blob); bgShards.push(blob);
    }
    // Shard layer: bright icosahedron crystal shards floating in the fog
    for (let i = 0; i < 14; i++) {
      const col = pick(theme.shardColors);
      const shardSize = 0.1 + Math.random() * 0.38;
      const shard = new THREE.Mesh(
        _bgIcoGeom(),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.5,
          metalness: 0.2, roughness: 0.0, transparent: true, opacity: 0.5 + Math.random() * 0.35
        })
      );
      shard.scale.setScalar(shardSize);
      shard.position.set((Math.random() - 0.5) * hw * 2, (Math.random() - 0.5) * hh * 2, -1.5 - Math.random() * 2);
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      shard.userData.spinSpeed = (Math.random() - 0.5) * 0.45;
      scene.add(shard); bgShards.push(shard);
    }
  } else if (theme.name === 'Crystal Reef') {
    // Tall thin mineral spires
    for (let i = 0; i < 18; i++) {
      const col = pick(theme.shardColors);
      const height = 0.5 + Math.random() * 1.4;
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.06 + Math.random() * 0.09, height, 5, 1),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.4,
          metalness: 0.2, roughness: 0.0, transparent: true, opacity: 0.45 + Math.random() * 0.35
        })
      );
      shard.position.set((Math.random() - 0.5) * hw * 2, (Math.random() - 0.5) * hh * 2, -1.5 - Math.random() * 2);
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      shard.userData.spinSpeed = (Math.random() - 0.5) * 0.25;
      scene.add(shard); bgShards.push(shard);
    }
  } else if (theme.name === 'Solar Fringe') {
    // Glowing rings / solar loops
    for (let i = 0; i < 15; i++) {
      const col = pick(theme.shardColors);
      const r = 0.22 + Math.random() * 0.65;
      const shard = new THREE.Mesh(
        new THREE.TorusGeometry(r, r * 0.2, 6, 18),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.55,
          metalness: 0.4, roughness: 0.0, transparent: true, opacity: 0.45 + Math.random() * 0.35
        })
      );
      shard.position.set((Math.random() - 0.5) * hw * 2, (Math.random() - 0.5) * hh * 2, -1.5 - Math.random() * 2);
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      shard.userData.spinSpeed = (Math.random() - 0.5) * 0.5;
      scene.add(shard); bgShards.push(shard);
    }
  } else {
    // The Void: sharp octahedron crystal shards
    for (let i = 0; i < 20; i++) {
      const col = pick(theme.shardColors);
      const shardSize = 0.12 + Math.random() * 0.45;
      const shard = new THREE.Mesh(
        _bgOctaGeom(),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.35,
          metalness: 0.3, roughness: 0.0, transparent: true, opacity: 0.55 + Math.random() * 0.3
        })
      );
      shard.scale.setScalar(shardSize);
      shard.position.set((Math.random() - 0.5) * hw * 2, (Math.random() - 0.5) * hh * 2, -1.5 - Math.random() * 2);
      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      shard.userData.spinSpeed = (Math.random() - 0.5) * 0.5;
      scene.add(shard); bgShards.push(shard);
    }
  }
}

function createBackground() {
  const theme = TIER_THEMES[0];
  const hw = camera.right + 4;
  const hh = camera.top + 3;

  _buildShards(theme, hw, hh);

  // Twinkling stars
  for (let i = 0; i < 80; i++) {
    const col = theme.starPalette[Math.floor(Math.random() * theme.starPalette.length)];
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: Math.random() * 0.5 + 0.1 });
    const starSize = 0.02 + Math.random() * 0.04;
    const s = new THREE.Mesh(_starGeom(), mat);
    s.scale.setScalar(starSize);
    s.position.set((Math.random() - 0.5) * hw * 2, (Math.random() - 0.5) * hh * 2, -1 + Math.random() * 2);
    s.userData = { vy: (Math.random() - 0.3) * 0.3, vx: (Math.random() - 0.5) * 0.12, baseOp: mat.opacity };
    scene.add(s); bgStars.push(s);
  }
}

function applyTheme(tierIndex) {
  const theme = TIER_THEMES[tierIndex] || TIER_THEMES[0];
  currentTier = tierIndex;

  // Background
  renderer.setClearColor(theme.clearColor);
  scene.fog.color.setHex(theme.bgColor);

  // Lighting
  if (sceneAmbient) {
    const l = theme.lights;
    sceneAmbient.color.setHex(l.ambient.color); sceneAmbient.intensity = l.ambient.intensity;
    sceneDir1.color.setHex(l.dir1.color);       sceneDir1.intensity   = l.dir1.intensity;
    sceneDir2.color.setHex(l.dir2.color);       sceneDir2.intensity   = l.dir2.intensity;
    scenePoint1.color.setHex(l.point1.color);   scenePoint1.intensity = l.point1.intensity;
    scenePoint2.color.setHex(l.point2.color);   scenePoint2.intensity = l.point2.intensity;
  }

  // CSS custom properties for HUD
  const cv = theme.cssVars;
  const root = document.documentElement.style;
  root.setProperty('--theme-accent',   cv.accent);
  root.setProperty('--theme-glow-rgb', cv.glowRgb);
  root.setProperty('--theme-border',   cv.border);
  root.setProperty('--theme-bar-a',    cv.barA);
  root.setProperty('--theme-bar-b',    cv.barB);
  root.setProperty('--theme-bar-c',    cv.barC);



  // Destroy and rebuild shards with new geometry
  bgShards.forEach(s => {
    scene.remove(s);
    if (s.material) s.material.dispose();
  });
  bgShards = [];
  _buildShards(theme, camera.right + 4, camera.top + 3);

  // Recolor stars
  bgStars.forEach(star => {
    const col = theme.starPalette[Math.floor(Math.random() * theme.starPalette.length)];
    star.material.color.setHex(col);
  });
}

// ─── SHOOTER ───

function createShooter() {
  shooterPivot = new THREE.Group();
  shooterPivot.position.set(SHOOTER_POS.x, SHOOTER_POS.y, 0);
  scene.add(shooterPivot);

  // Arcane Orb — floating crystal orb with orbiting rings
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.9, roughness: 0.0, emissive: 0x4488cc, transparent: true, opacity: 0.8 }));
  shooterPivot.add(orb);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.4 }));
  shooterPivot.add(inner);
  for (const ra of [0, Math.PI / 3, -Math.PI / 3]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.03, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xaaddff, metalness: 0.9, roughness: 0.0, emissive: 0x6699cc }));
    ring.rotation.x = ra; ring.rotation.y = ra * 0.5; shooterPivot.add(ring);
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 6),
    new THREE.MeshStandardMaterial({ color: 0xaaddff, metalness: 0.8, roughness: 0.05, emissive: 0x224466, transparent: true, opacity: 0.7 }));
  barrel.position.y = 0.8; shooterPivot.add(barrel);
  const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.0, emissive: 0x88ccff }));
  tip.position.y = 1.3; shooterPivot.add(tip);

  loadShooterBalls();
}

function pickColor() {
  // Pick from a random track's chain for color relevance
  const t = tracks[Math.floor(Math.random() * tracks.length)];
  return t.pickColor();
}

function makeBallPreview(colorIdx, size) {
  const m = new THREE.Mesh(_previewBallGeom(),
    new THREE.MeshStandardMaterial({ map: getBallTexture(colorIdx), color: 0xffffff, metalness: 0.8, roughness: 0.05, emissive: COLOR_EMISSIVE[colorIdx] }));
  m.scale.setScalar(size);
  return m;
}

function loadShooterBalls(primary, next) {
  if (shooterBallMesh) shooterPivot.remove(shooterBallMesh);
  if (nextBallMesh) shooterPivot.remove(nextBallMesh);
  shooterColorIdx = primary ?? pickColor();
  nextColorIdx = next ?? pickColor();
  shooterBallMesh = makeBallPreview(shooterColorIdx, BALL_RADIUS);
  shooterBallMesh.position.y = 1.7; shooterPivot.add(shooterBallMesh);
  nextBallMesh = makeBallPreview(nextColorIdx, BALL_RADIUS * 0.6);
  nextBallMesh.position.set(0.55, -0.1, 0.3); shooterPivot.add(nextBallMesh);
}

function reloadPrimary() {
  shooterColorIdx = nextColorIdx;
  nextColorIdx = pickColor();
  loadShooterBalls(shooterColorIdx, nextColorIdx);
}

function onSwapAction() {
  if (!gameActive) return;
  playSound('swap');
  const tmp = shooterColorIdx;
  shooterColorIdx = nextColorIdx;
  nextColorIdx = tmp;
  loadShooterBalls(shooterColorIdx, nextColorIdx);
}

// ─── COMBO TEXT ───

const MAX_SCORE_POPUPS = 5;

function spawnScorePopup(worldPos, className, html) {
  // Cap on-screen popups to avoid clutter during rapid combos
  const existing = document.querySelectorAll('.score-text, .combo-text, .gap-bonus-text');
  if (existing.length >= MAX_SCORE_POPUPS) existing[0].remove();

  const ndc = worldPos.clone().project(camera);
  const x = (ndc.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-ndc.y * 0.5 + 0.5) * window.innerHeight;

  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = html;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 2600);
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

function spawnChainText(worldPos, chainVal, matchScore) {
  spawnScorePopup(worldPos, 'combo-text', 'CHAIN ×' + chainVal + '<br><span class="combo-score">+' + matchScore + '</span>');
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

  [texRoseWindow, texIceShards, texLeafVeins, texFacetedGem, texTriFacets, texSpiral][colorIdx](ctx, S, cols);

  return new THREE.CanvasTexture(cv);
}

// 0 — Ruby: rose window — overlapping petal circles with radial lines
function texRoseWindow(ctx, S, cols) {
  const cx = S / 2, cy = S / 2, petals = 6;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const px = cx + Math.cos(a) * S * 0.22, py = cy + Math.sin(a) * S * 0.22;
    ctx.beginPath(); ctx.arc(px, py, S * 0.22, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? cols.lite : cols.mid; ctx.fill();
    ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.015; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.18, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = cols.mid; ctx.fill();
  ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.015; ctx.stroke();
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * S * 0.44, cy + Math.sin(a) * S * 0.44);
    ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.01; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = cols.lite; ctx.fill();
}

// 1 — Sapphire: ice shards — irregular angular shards radiating outward
function texIceShards(ctx, S, cols) {
  const cx = S / 2, cy = S / 2, shards = 10;
  for (let i = 0; i < shards; i++) {
    const a = (i / shards) * Math.PI * 2;
    const aNext = ((i + 1) / shards) * Math.PI * 2;
    const aMid = (a + aNext) / 2;
    const r1 = S * (0.30 + (i % 3) * 0.06);
    const r2 = S * (0.20 + ((i + 1) % 3) * 0.06);
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(aMid) * S * 0.46, cy + Math.sin(aMid) * S * 0.46);
    ctx.lineTo(cx + Math.cos(aNext) * r2, cy + Math.sin(aNext) * r2);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? cols.lite : cols.mid; ctx.fill();
    ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.012; ctx.stroke();
  }
  for (let i = 0; i < shards; i++) {
    const a = (i / shards) * Math.PI * 2 + Math.PI / shards;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * S * 0.2, cy + Math.sin(a) * S * 0.2);
    ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.008; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = cols.lite; ctx.fill();
}

// 2 — Emerald: leaf veins — central midrib with branching veins
function texLeafVeins(ctx, S, cols) {
  const cx = S / 2;
  const branches = 8;
  for (let i = 0; i < branches; i++) {
    const y = (i + 0.5) / branches * S;
    const side = i % 2 === 0 ? 1 : -1;
    const tipX = cx + side * S * 0.4;
    const tipY = y - S * 0.05;
    const nextY = (i + 1.5) / branches * S;
    ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(tipX, tipY);
    ctx.lineTo(cx + side * S * 0.38, nextY - S * 0.05); ctx.lineTo(cx, nextY);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? cols.lite : cols.mid; ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, S);
  ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.03; ctx.stroke();
  for (let i = 0; i < branches; i++) {
    const y = (i + 0.5) / branches * S;
    const side = i % 2 === 0 ? 1 : -1;
    const tipX = cx + side * S * 0.4;
    const tipY = y - S * 0.05;
    ctx.beginPath(); ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(cx + side * S * 0.2, y - S * 0.02, tipX, tipY);
    ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.015; ctx.stroke();
  }
}

// 3 — Amber: faceted gem — top-down gem view with table, crown and star facets
function texFacetedGem(ctx, S, cols) {
  const cx = S / 2, cy = S / 2, n = 8;
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * S * 0.18, cy + Math.sin(a1) * S * 0.18);
    ctx.lineTo(cx + Math.cos(a1) * S * 0.44, cy + Math.sin(a1) * S * 0.44);
    ctx.lineTo(cx + Math.cos(a2) * S * 0.44, cy + Math.sin(a2) * S * 0.44);
    ctx.lineTo(cx + Math.cos(a2) * S * 0.18, cy + Math.sin(a2) * S * 0.18);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? cols.mid : cols.lite; ctx.fill();
    ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.012; ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2;
    const aMid = (a1 + a2) / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a1) * S * 0.18, cy + Math.sin(a1) * S * 0.18);
    ctx.lineTo(cx + Math.cos(aMid) * S * 0.30, cy + Math.sin(aMid) * S * 0.30);
    ctx.lineTo(cx + Math.cos(a2) * S * 0.18, cy + Math.sin(a2) * S * 0.18);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? cols.lite : cols.mid; ctx.fill();
    ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.008; ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * S * 0.18, y = cy + Math.sin(a) * S * 0.18;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = cols.lite; ctx.fill();
  ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.012; ctx.stroke();
}

// 4 — Amethyst: triangular facet tessellation
function texTriFacets(ctx, S, cols) {
  const h = S * 0.12;
  const w = h * 2 / Math.sqrt(3);
  for (let row = -2; row < 12; row++) {
    for (let col = -2; col < 12; col++) {
      const cx = col * w + (row % 2 === 0 ? 0 : w / 2);
      const cy = row * h * 0.85;
      ctx.beginPath();
      ctx.moveTo(cx, cy - h * 0.6);
      ctx.lineTo(cx + w * 0.5, cy + h * 0.4);
      ctx.lineTo(cx - w * 0.5, cy + h * 0.4);
      ctx.closePath();
      const shade = (row + col) % 3;
      ctx.fillStyle = shade === 0 ? cols.lite : shade === 1 ? cols.mid : cols.base;
      ctx.fill();
      ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.012; ctx.stroke();
    }
  }
}

// 5 — Silver: Archimedean spiral bands
function texSpiral(ctx, S, cols) {
  const cx = S / 2, cy = S / 2;
  const turns = 3, steps = 200;
  for (let band = 0; band < 2; band++) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2 + band * Math.PI;
      const r = t * S * 0.46;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = band === 0 ? cols.lite : cols.mid;
    ctx.lineWidth = S * 0.06; ctx.stroke();
  }
  for (let band = 0; band < 2; band++) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * Math.PI * 2 + band * Math.PI;
      const r = t * S * 0.46;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = cols.dark; ctx.lineWidth = S * 0.012; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = cols.lite; ctx.fill();
}

// ─── CHAIN BALL MESH ───

// ─── SHARED GEOMETRIES ───
// Reuse geometry instances to avoid allocating hundreds of identical buffers.

const _sharedGeoms = {};
function _sg(key, factory) {
  if (!_sharedGeoms[key]) { _sharedGeoms[key] = factory(); _sharedGeoms[key]._shared = true; }
  return _sharedGeoms[key];
}

function getSharedBallGeom()      { return _sg('ball',       () => new THREE.SphereGeometry(BALL_RADIUS, 16, 12)); }
function _particleSphereGeom()    { return _sg('pSphere',    () => new THREE.SphereGeometry(1, 4, 4)); }
function _particleOctaGeom()      { return _sg('pOcta',      () => new THREE.OctahedronGeometry(1, 0)); }
function _starGeom()              { return _sg('star',        () => new THREE.SphereGeometry(1, 4, 4)); }
function _fogBlobGeom()           { return _sg('fogBlob',    () => new THREE.SphereGeometry(1, 7, 5)); }
function _bgIcoGeom()             { return _sg('bgIco',      () => new THREE.IcosahedronGeometry(1, 0)); }
function _bgOctaGeom()            { return _sg('bgOcta',     () => new THREE.OctahedronGeometry(1, 0)); }
function _previewBallGeom()       { return _sg('preview',    () => new THREE.SphereGeometry(1, 12, 10)); }
function _haloGeom()              { return _sg('halo',       () => new THREE.SphereGeometry(1, 8, 6)); }
function _vortexCoreGeom()        { return _sg('vortexCore', () => new THREE.SphereGeometry(1, 16, 12)); }

function createBallMesh(colorIdx) {
  return new THREE.Mesh(getSharedBallGeom(),
    new THREE.MeshStandardMaterial({ map: getBallTexture(colorIdx), color: 0xffffff, metalness: 0.8, roughness: 0.05, emissive: COLOR_EMISSIVE[colorIdx] }));
}

// Dispose a mesh's material (and owned textures). Does NOT dispose shared geometry.
function disposeMesh(mesh) {
  if (!mesh) return;
  if (mesh.material) {
    // Don't dispose the shared ball textures (getBallTexture cache)
    mesh.material.dispose();
  }
}

// Powerup visuals (removePowerupVisuals, createPowerupSprite, createPowerupHalo) moved to powerups.js

// ─── EXPLOSIONS ───

// Spawn a burst of particles at pos. colors can be a single hex or an array (cycled per particle).
function spawnParticleBurst(pos, count, colors, { minSize = 0.06, maxSize = 0.14, minSpeed = 2, maxSpeed = 4, decay = 0.022, decayRand = 0.02, opacity = 1, geo = 'octa' } = {}) {
  const colArr = Array.isArray(colors) ? colors : [colors];
  for (let i = 0; i < count; i++) {
    const col = colArr[i % colArr.length];
    const size = minSize + Math.random() * (maxSize - minSize);
    const mesh = new THREE.Mesh(
      geo === 'sphere' ? _particleSphereGeom() : _particleOctaGeom(),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity })
    );
    mesh.scale.setScalar(size);
    mesh.position.copy(pos);
    const a = Math.random() * Math.PI * 2, sp = minSpeed + Math.random() * (maxSpeed - minSpeed);
    mesh.userData = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: decay + Math.random() * decayRand, baseScale: size };
    scene.add(mesh); particles.push(mesh);
  }
}

function explodeBall(ball) {
  const pos = ball.mesh.position.clone();
  scene.remove(ball.mesh);
  disposeMesh(ball.mesh);

  const ballColor = COLORS[ball.colorIdx];
  const flashCol = TIER_THEMES[currentTier].flashColor;

  // Main colored shards — more than before
  spawnParticleBurst(pos, 18, ballColor, { minSize: 0.07, maxSize: 0.16, minSpeed: 2.5, maxSpeed: 5.5, decay: 0.02, decayRand: 0.015 });

  // Theme-colored glow spheres
  spawnParticleBurst(pos, 8, flashCol, { minSize: 0.08, maxSize: 0.18, minSpeed: 1, maxSpeed: 3.5, decay: 0.025, decayRand: 0, opacity: 0.85, geo: 'sphere' });

  // Streak particles — fast, elongated, fly outward
  const strCol = [ballColor, flashCol];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
    const sp = 6 + Math.random() * 5;
    const len = 0.22 + Math.random() * 0.18;
    const mesh = new THREE.Mesh(
      _particleOctaGeom(),
      new THREE.MeshBasicMaterial({ color: strCol[i % 2], transparent: true, opacity: 0.9 })
    );
    mesh.scale.set(0.18 * len, len, 0.18 * len); // elongate along local Y
    mesh.rotation.z = a;
    mesh.position.copy(pos);
    mesh.userData = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.045 + Math.random() * 0.02, baseScaleX: 0.18 * len, baseScaleY: len, baseScaleZ: 0.18 * len };
    scene.add(mesh); particles.push(mesh);
  }

  // Shockwave ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.04, 6, 24),
    new THREE.MeshBasicMaterial({ color: flashCol, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.position.copy(pos);
  scene.add(ring);
  shockwaves.push({ mesh: ring, life: 0.4, maxLife: 0.4 });
}

// ─── TRACK VISUALS ───

function createTrackVisuals(track) {
  const tc = TIER_THEMES[currentTier].track;
  const curve = new THREE.CatmullRomCurve3(track.pathPoints);
  const t1 = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.15, 8, false),
    new THREE.MeshStandardMaterial({ color: tc.outer[0], metalness: 0.1, roughness: 0.0, emissive: tc.outer[1], transparent: true, opacity: 0.30 }));
  t1.position.z = -0.3; scene.add(t1); track.trackMeshes.push(t1);
  const t2 = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.05, 6, false),
    new THREE.MeshStandardMaterial({ color: tc.inner[0], metalness: 0.0, roughness: 0.0, emissive: tc.inner[1] }));
  t2.position.z = -0.25; scene.add(t2); track.trackMeshes.push(t2);

  _createPipeEntrance(track);
  _createSkullEnd(track);
}

function _createSkullEnd(track) {
  const ep = track.getPathPosFromS(track.pathLength);
  const add = m => { scene.add(m); track.trackMeshes.push(m); };
  const arms = [];

  if (currentTier === 1) {
    // Nebula Drift — larger soft magenta rings, 8 wispy arms
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.10, 12, 28),
      new THREE.MeshStandardMaterial({ color: 0x330055, metalness: 0.8, roughness: 0.1, emissive: 0x660099 }));
    outer.position.copy(ep); outer.position.z = -0.1; add(outer);
    const mid = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.075, 10, 22),
      new THREE.MeshStandardMaterial({ color: 0x9900cc, metalness: 0.7, roughness: 0.1, emissive: 0x8800bb }));
    mid.position.copy(ep); mid.position.z = -0.05; add(mid);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.055, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xee55ff, metalness: 0.5, roughness: 0.0, emissive: 0xcc44ff }));
    inner.position.copy(ep); add(inner);
    const core = new THREE.Mesh(_vortexCoreGeom(),
      new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1.0, roughness: 0.0, emissive: 0x220044 }));
    core.scale.setScalar(0.30);
    core.position.copy(ep); core.position.z = 0.05; add(core);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xaa22ee, emissive: 0x660099, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      arm.position.copy(ep);
      arm.position.x += Math.cos(a) * 0.3; arm.position.y += Math.sin(a) * 0.3; arm.position.z = 0.02;
      arm.rotation.z = a + 0.4; add(arm); arms.push(arm);
    }
    track.vortexMeshes = { outer, mid, inner, core, arms };

  } else if (currentTier === 2) {
    // Crystal Maw — teal rings with 8 inward-pointing crystal spike arms
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.10, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0x003333, metalness: 0.9, roughness: 0.05, emissive: 0x006666 }));
    outer.position.copy(ep); outer.position.z = -0.1; add(outer);
    const mid = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.075, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x007788, metalness: 0.7, roughness: 0.05, emissive: 0x008899 }));
    mid.position.copy(ep); mid.position.z = -0.05; add(mid);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x00ccaa, metalness: 0.5, roughness: 0.0, emissive: 0x00ddbb }));
    inner.position.copy(ep); add(inner);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0x001122, metalness: 1.0, roughness: 0.0, emissive: 0x002233 }));
    core.position.copy(ep); core.position.z = 0.05; add(core);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.52, 4, 1),
        new THREE.MeshStandardMaterial({ color: 0x00ccaa, emissive: 0x006666, transparent: true, opacity: 0.75 }));
      arm.position.copy(ep);
      arm.position.x += Math.cos(a) * 0.3; arm.position.y += Math.sin(a) * 0.3; arm.position.z = 0.02;
      // point toward center: cone tip is +Y by default, rotate so it aims inward
      arm.rotation.z = a + Math.PI / 2; add(arm); arms.push(arm);
    }
    track.vortexMeshes = { outer, mid, inner, core, arms };

  } else if (currentTier === 3) {
    // Solar Drain — thick amber rings, 4 wide solar flare arms
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.90, 0.15, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0x331100, metalness: 0.8, roughness: 0.1, emissive: 0x884400 }));
    outer.position.copy(ep); outer.position.z = -0.1; add(outer);
    const mid = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.10, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0xaa4400, metalness: 0.7, roughness: 0.1, emissive: 0xaa6600 }));
    mid.position.copy(ep); mid.position.z = -0.05; add(mid);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xff8800, metalness: 0.5, roughness: 0.0, emissive: 0xff8800 }));
    inner.position.copy(ep); add(inner);
    const core = new THREE.Mesh(_vortexCoreGeom(),
      new THREE.MeshStandardMaterial({ color: 0x110500, metalness: 1.0, roughness: 0.0, emissive: 0x221100 }));
    core.scale.setScalar(0.30);
    core.position.copy(ep); core.position.z = 0.05; add(core);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.85),
        new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x884400, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
      arm.position.copy(ep);
      arm.position.x += Math.cos(a) * 0.3; arm.position.y += Math.sin(a) * 0.3; arm.position.z = 0.02;
      arm.rotation.z = a + 0.4; add(arm); arms.push(arm);
    }
    track.vortexMeshes = { outer, mid, inner, core, arms };

  } else {
    // Void Vortex — concentric purple rings with spiral arms and dark core (default)
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0x220033, metalness: 0.9, roughness: 0.1, emissive: 0x440066 }));
    outer.position.copy(ep); outer.position.z = -0.1; add(outer);
    const mid = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x8800aa, metalness: 0.7, roughness: 0.1, emissive: 0x660088 }));
    mid.position.copy(ep); mid.position.z = -0.05; add(mid);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xcc44ff, metalness: 0.5, roughness: 0.0, emissive: 0xaa22dd }));
    inner.position.copy(ep); add(inner);
    const core = new THREE.Mesh(_vortexCoreGeom(),
      new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1.0, roughness: 0.0, emissive: 0x110022 }));
    core.scale.setScalar(0.25);
    core.position.copy(ep); core.position.z = 0.05; add(core);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x8800cc, emissive: 0x440066, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      arm.position.copy(ep);
      arm.position.x += Math.cos(a) * 0.3; arm.position.y += Math.sin(a) * 0.3; arm.position.z = 0.02;
      arm.rotation.z = a + 0.4; add(arm); arms.push(arm);
    }
    track.vortexMeshes = { outer, mid, inner, core, arms };
  }
}

function updateDangerVisuals(track, dt) {
  const v = track.vortexMeshes;
  if (!v) return;

  // Danger ratio: 0 = safe, 1 = about to die
  const frontS = track.chain.length > 0 && track.chain[0].s >= 0 ? track.chain[0].s : 0;
  const dangerStart = track.pathLength * 0.55;
  const danger = Math.max(0, Math.min(1, (frontS - dangerStart) / (track.pathLength * 0.43)));

  const t = clock.elapsedTime;
  const pulseSpeed = 3 + danger * 9; // faster pulse when closer
  const pulse = 0.5 + 0.5 * Math.sin(t * pulseSpeed);

  // Vortex rings: shift from theme palette toward red as danger increases
  const vc = TIER_THEMES[currentTier].vortexPalette;
  const toRed = (hex, t) => {
    const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
    return [(r + (255 - r) * t) / 255, g * (1 - t) / 255, b * (1 - t) / 255];
  };

  v.outer.material.emissive.setRGB(...toRed(vc.outer, danger));
  v.outer.material.emissiveIntensity = 1 + danger * 2 * pulse;
  v.outer.scale.setScalar(1 + danger * 0.15 * pulse);

  v.mid.material.emissive.setRGB(...toRed(vc.mid, danger));
  v.mid.material.emissiveIntensity = 1 + danger * 2.5 * pulse;
  v.mid.scale.setScalar(1 + danger * 0.1 * pulse);

  v.inner.material.emissive.setRGB(...toRed(vc.inner, danger));
  v.inner.material.emissiveIntensity = 1 + danger * 3 * pulse;

  // Core glows red-hot at max danger
  v.core.material.emissive.setRGB(...toRed(vc.core, danger));
  v.core.material.emissiveIntensity = 1 + danger * 4 * pulse;

  // Spin arms faster as danger increases
  const spinDelta = dt * (0.3 + danger * 2.5);
  for (const arm of v.arms) {
    arm.rotation.z += spinDelta;
    arm.material.opacity = 0.6 + danger * 0.4 * pulse;
    arm.material.emissive.setRGB(...toRed(vc.arms, danger));
  }

  // Danger audio pulse — interval shrinks from 2.5 s to 0.5 s as danger peaks
  if (danger > 0.2) {
    const interval = 2.5 - danger * 2.0;
    track.dangerPulseTimer -= dt;
    if (track.dangerPulseTimer <= 0) {
      playSound('dangerpulse', danger);
      track.dangerPulseTimer = interval;
    }
  } else {
    track.dangerPulseTimer = 0;
  }

  // Tint balls in the danger zone (last 30% of path) with red emissive boost
  const dangerZoneS = track.pathLength * 0.70;
  for (let i = 0; i < track.chain.length; i++) {
    const ball = track.chain[i];
    if (!ball.alive || ball.s < 0) continue;
    if (ball.s > dangerZoneS) {
      const ballDanger = (ball.s - dangerZoneS) / (track.pathLength * 0.30);
      const bd = Math.min(1, ballDanger);
      // Additive red tint that intensifies — don't overwrite powerup pulse
      if (!ball.powerup) {
        ball.mesh.material.emissiveIntensity = 1 + bd * 2.5 * (0.6 + 0.4 * pulse);
      }
    } else if (!ball.powerup) {
      ball.mesh.material.emissiveIntensity = 1;
    }
  }
}

function _createPipeEntrance(track) {
  const startPos = track.getPathPosFromS(0);
  const tangent = track.getPathTangentFromS(0);
  const add = m => { scene.add(m); track.trackMeshes.push(m); };
  const pc = TIER_THEMES[currentTier].pipe;

  const PIPE_LENGTH = 4.5;
  const PIPE_RADIUS = BALL_RADIUS * 1.22;
  const PIPE_OVERHANG = 0.5;

  const quatCyl = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  const quatTorus = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
  const pipeCenter = startPos.clone().addScaledVector(tangent, -(PIPE_LENGTH / 2) + PIPE_OVERHANG);
  pipeCenter.z = -0.15;

  // Translucent energy conduit (outer shell)
  const conduit = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS * 0.95, PIPE_LENGTH, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: pc.conduit[0], metalness: 0.8, roughness: 0.05, emissive: pc.conduit[1], side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
  );
  conduit.position.copy(pipeCenter); conduit.quaternion.copy(quatCyl); add(conduit);

  // Inner energy flow (bright core tube)
  const flow = new THREE.Mesh(
    new THREE.CylinderGeometry(PIPE_RADIUS * 0.6, PIPE_RADIUS * 0.6, PIPE_LENGTH, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: pc.flow[0], metalness: 0.0, roughness: 0.0, emissive: pc.flow[1], emissiveIntensity: 0.8, transparent: true, opacity: 0.15, side: THREE.BackSide })
  );
  flow.position.copy(pipeCenter); flow.quaternion.copy(quatCyl); add(flow);

  // Arcane rings spaced along the conduit
  const ringCount = 5;
  for (let i = 0; i < ringCount; i++) {
    const t = i / (ringCount - 1);
    const offset = PIPE_OVERHANG - t * PIPE_LENGTH;
    const rPos = startPos.clone().addScaledVector(tangent, offset);
    rPos.z = -0.05;

    const isMouth = i === 0;
    const radius = PIPE_RADIUS + (isMouth ? 0.05 : -0.02);
    const thickness = isMouth ? 0.08 : 0.04;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, thickness, 8, 20),
      new THREE.MeshStandardMaterial({
        color: isMouth ? pc.mouthRing[0] : pc.innerRing[0],
        metalness: 0.9, roughness: 0.0,
        emissive: isMouth ? pc.mouthRing[1] : pc.innerRing[1],
        emissiveIntensity: isMouth ? 1.2 : 0.6,
      })
    );
    ring.position.copy(rPos); ring.quaternion.copy(quatTorus); add(ring);
  }

  // Rune markers flanking the mouth
  const mouthPos = startPos.clone().addScaledVector(tangent, PIPE_OVERHANG);
  const perp = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
  for (const side of [-1, 1]) {
    const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshStandardMaterial({ color: pc.rune[0], metalness: 0.5, roughness: 0.0, emissive: pc.rune[1], emissiveIntensity: 1.5 }));
    rune.position.copy(mouthPos).addScaledVector(perp, side * (PIPE_RADIUS + 0.25));
    rune.position.z = 0.05;
    add(rune);
  }
}

function clearTrackVisuals(track) {
  track.trackMeshes.forEach(m => {
    scene.remove(m);
    if (m.geometry && !m.geometry._shared) m.geometry.dispose();
    if (m.material) m.material.dispose();
  });
  track.trackMeshes = [];
  track.vortexMeshes = null;
}

// ─── BONUS CRYSTALS ───

function spawnBonusCrystal(track) {
  const s = track.pathLength * (0.15 + Math.random() * 0.70);
  const pos = track.getPathPosFromS(s);
  const tan = track.getPathTangentFromS(s);
  const side = Math.random() < 0.5 ? 1 : -1;
  const OFFSET = 0.8 + Math.random() * 0.6;
  const nx = -tan.y * side * OFFSET;
  const ny =  tan.x * side * OFFSET;
  const phase = Math.random() * Math.PI * 2;

  let core, mid, cage, glow;
  const group = new THREE.Group();

  if (currentTier === 1) {
    // Nebula: rounded icosahedron, soft violet aura
    core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.56, 0),
      new THREE.MeshStandardMaterial({ color: 0xDD99FF, emissive: 0xAA44FF, emissiveIntensity: 2.5, metalness: 0.1, roughness: 0.0 })
    );
    mid = new THREE.Mesh(
      _haloGeom(),
      new THREE.MeshStandardMaterial({ color: 0xCC44FF, emissive: 0x8800CC, emissiveIntensity: 0.6, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    mid.scale.setScalar(0.9);
    cage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.12, 1),
      new THREE.MeshBasicMaterial({ color: 0xFF88EE, transparent: true, opacity: 0.5, wireframe: true })
    );
    glow = new THREE.Mesh(
      _haloGeom(),
      new THREE.MeshBasicMaterial({ color: 0xAA44FF, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false })
    );
    glow.scale.setScalar(1.55);

  } else if (currentTier === 2) {
    // Crystal Reef: elongated teal spike with equatorial ring
    core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x88FFEE, emissive: 0x00CCAA, emissiveIntensity: 2.5, metalness: 0.4, roughness: 0.0 })
    );
    core.scale.set(0.55, 1.9, 0.55);
    mid = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.07, 6, 18),
      new THREE.MeshStandardMaterial({ color: 0x44FFDD, emissive: 0x00AACC, emissiveIntensity: 1.0, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    cage = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.12, 0),
      new THREE.MeshBasicMaterial({ color: 0x00FFCC, transparent: true, opacity: 0.5, wireframe: true })
    );
    // Second decorative ring at 90°
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.82, 0.04, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0x44FFEE, transparent: true, opacity: 0.3, wireframe: false })
    );
    ring2.rotation.x = Math.PI / 2;
    group.add(ring2);
    glow = new THREE.Mesh(
      _haloGeom(),
      new THREE.MeshBasicMaterial({ color: 0x00FFCC, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    );
    glow.scale.setScalar(1.5);

  } else if (currentTier === 3) {
    // Solar Fringe: faceted amber dodecahedron with solar rings
    core = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.56, 0),
      new THREE.MeshStandardMaterial({ color: 0xFFDD88, emissive: 0xFF8800, emissiveIntensity: 2.8, metalness: 0.5, roughness: 0.0 })
    );
    mid = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.07, 6, 20),
      new THREE.MeshStandardMaterial({ color: 0xFF8800, emissive: 0xFF6600, emissiveIntensity: 1.2, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    cage = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.045, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xFFCC44, transparent: true, opacity: 0.55, wireframe: false })
    );
    // Second solar ring at 90°
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.03, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xFFAA22, transparent: true, opacity: 0.35 })
    );
    ring2.rotation.x = Math.PI / 2;
    group.add(ring2);
    glow = new THREE.Mesh(
      _haloGeom(),
      new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.09, side: THREE.BackSide, depthWrite: false })
    );
    glow.scale.setScalar(1.6);

  } else {
    // The Void: sharp gold octahedron (default)
    core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62, 0),
      new THREE.MeshStandardMaterial({ color: 0xFFFFCC, emissive: 0xFFCC00, emissiveIntensity: 2.5, metalness: 0.3, roughness: 0.0 })
    );
    mid = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.92, 1),
      new THREE.MeshStandardMaterial({ color: 0xFFAA00, emissive: 0xFF8800, emissiveIntensity: 1.0, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
    );
    cage = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.15, 0),
      new THREE.MeshBasicMaterial({ color: 0xFFEE44, transparent: true, opacity: 0.55, wireframe: true })
    );
    glow = new THREE.Mesh(
      _haloGeom(),
      new THREE.MeshBasicMaterial({ color: 0xFFCC00, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    );
    glow.scale.setScalar(1.5);
  }

  group.add(core, mid, cage, glow);
  group.position.set(pos.x + nx, pos.y + ny, -1.8);
  group.userData = { phase, core, cage, mid, glow };

  scene.add(group);
  track.bonusCrystals.push({ mesh: group, alive: true, life: 9.0 });
  playSound('crystalspawn');
}

function clearBonusCrystals(track) {
  track.bonusCrystals.forEach(c => {
    scene.remove(c.mesh);
    c.mesh.traverse(child => {
      if (child.geometry && !child.geometry._shared) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  });
  track.bonusCrystals = [];
}

// ─── VICTORY ───

function spawnVictoryParticles() {
  // Cascade of crystal bursts from multiple points
  const allColors = COLORS.slice(0, 6);
  for (let wave = 0; wave < 5; wave++) {
    setTimeout(() => {
      for (let i = 0; i < 4; i++) {
        const pos = new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 16,
          0
        );
        spawnParticleBurst(pos, 20, allColors, {
          minSize: 0.08, maxSize: 0.25,
          minSpeed: 2, maxSpeed: 6,
          decay: 0.008, decayRand: 0.005,
          opacity: 1
        });
        spawnParticleBurst(pos, 10, 0xffffff, {
          minSize: 0.04, maxSize: 0.12,
          minSpeed: 1, maxSpeed: 4,
          decay: 0.01, decayRand: 0.005,
          opacity: 0.9, geo: 'sphere'
        });
      }
    }, wave * 300);
  }
}

