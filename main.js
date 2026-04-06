// ═══════════════════════════════════════════════
//  CONVERGENCE — Crystal Chain Puzzle
// ═══════════════════════════════��═══════════════
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
//   5. Gap collapse: after match, front segment slides backward if colors match at edges
//   6. Progress bar: scoring points fills it; once full, spawning stops
// ════════════════════════════════════════���══════

let scene, camera, renderer, clock;
let projectiles = [];
let particles = [];
let score = 0, level = 1;
let lives = 3;
let nextExtraLife = 50000;
let gameActive = false;
let gamePaused = false;
let mouseX = 0, mouseY = 0;

let track; // Track instance — holds all per-track state

// Debug
let debugMode = false;
let debugFastForward = false;

let shockwaves = []; // expanding ring visuals from blast

// ─── INIT ───

function init() {
  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000008);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000208, 0.012);

  const aspect = window.innerWidth / window.innerHeight;
  const f = 14;
  camera = new THREE.OrthographicCamera(-f * aspect, f * aspect, f, -f, -50, 50);
  camera.position.set(0, 0, 20);
  camera.lookAt(0, 0, 0);

  clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight(0x112244, 1.2));
  const dl = new THREE.DirectionalLight(0xaaddff, 1.8);
  dl.position.set(5, 8, 15); scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xff88ff, 0.9);
  dl2.position.set(-8, -5, 10); scene.add(dl2);
  const pl = new THREE.PointLight(0x88ccff, 1.8, 40);
  pl.position.set(0, 0, 8); scene.add(pl);
  const pl2 = new THREE.PointLight(0xffffff, 1.0, 25);
  pl2.position.set(-6, 6, 10); scene.add(pl2);

  track = new Track();
  track.loadLevel(LEVELS[0]);
  createBackground();
  createShooter();

  canvas.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
  canvas.addEventListener('click', onShoot);
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); onSwapAction(); });
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY; }, { passive: false });
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); onSwapAction(); }
    if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); }

    // Toggle debug mode
    if (e.code === 'Backquote') {
      debugMode = !debugMode;
      document.getElementById('debug-overlay').classList.toggle('visible', debugMode);
      if (!debugMode) debugFastForward = false;
      return;
    }

    // Debug keys (only in debug mode)
    if (debugMode && gameActive) {
      if (e.code === 'KeyB') track.tryAssignPowerup('blast');
      if (e.code === 'KeyF') track.tryAssignPowerup('pause');
      if (e.code === 'KeyR') track.tryAssignPowerup('backwards');
      if (e.code === 'KeyC') track.tryAssignPowerup('chromatic');
      if (e.code === 'KeyS') { track.spawningDone = true; showBanner('SPAWNING STOPPED'); }
      if (e.code === 'KeyN') { levelUp(); }
      if (e.code === 'KeyA') debugFastForward = true;
      if (e.code === 'KeyD') track.chainFreezeTimer = track.chainFreezeTimer > 0 ? 0 : 99999;
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'KeyA') debugFastForward = false;
  });

  animate();
}

// ─── SHOOTING ───

function onShoot(e) {
  if (!gameActive || track.levelClearing || e.button !== 0) return;
  playSound('shoot');
  const dir = getAimDir(e.clientX, e.clientY);
  const proj = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({ color: COLORS[shooterColorIdx], metalness: 0.5, roughness: 0.3, emissive: COLOR_EMISSIVE[shooterColorIdx] }));
  proj.position.set(SHOOTER_POS.x + dir.x * 2, SHOOTER_POS.y + dir.y * 2, 0);
  scene.add(proj);
  projectiles.push({ mesh: proj, vx: dir.x * 28, vy: dir.y * 28, colorIdx: shooterColorIdx, alive: true, gapBonus: false });

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

// ─── GAME LOOP ───

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameActive && !gamePaused) {
    const dir = getAimDir(mouseX, mouseY);
    shooterPivot.rotation.z = -Math.atan2(dir.x, dir.y);
  }

  bgShards.forEach(g => {
    g.rotation.z += g.userData.spinSpeed * dt;
    g.rotation.x += g.userData.spinSpeed * 0.7 * dt;
  });

  const starHW = camera.right + 2;
  const starHH = camera.top + 1;
  bgStars.forEach(s => {
    s.position.x += s.userData.vx * dt;
    s.position.y += s.userData.vy * dt;
    s.material.opacity = s.userData.baseOp * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2 + s.position.x));
    if (s.position.y > starHH) { s.position.y = -starHH; s.position.x = (Math.random() - 0.5) * starHW * 2; }
    if (s.position.y < -starHH) { s.position.y = starHH; }
  });

  if (gameActive && !gamePaused) {
    track.update(dt);

    // Game over
    if (track.isGameOver()) gameOver();

    track.checkProjectileCollisions(dt);

    // Level clear
    if (track.isCleared()) levelUp();
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

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life -= dt;
    if (sw.life <= 0) { scene.remove(sw.mesh); shockwaves.splice(i, 1); continue; }
    const t = 1 - sw.life / sw.maxLife;
    sw.mesh.scale.setScalar(1 + t * 5);
    sw.mesh.material.opacity = (1 - t) * 0.7;
  }

  renderer.render(scene, camera);
}

// ─── GAME STATE ───

function togglePause() {
  if (!gameActive) return;
  gamePaused = !gamePaused;
  playSound(gamePaused ? 'pause' : 'unpause');
  document.getElementById('pause-screen').style.display = gamePaused ? 'flex' : 'none';
  if (!gamePaused) clock.getDelta(); // discard time accumulated while paused
}

function resetGameState(levelDef) {
  projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
  particles.forEach(p => scene.remove(p)); particles = [];
  shockwaves.forEach(sw => scene.remove(sw.mesh)); shockwaves = [];

  track.reset(levelDef);
  track.levelStartScore = score;
  gamePaused = false;

  updateHUD(); updateProgressBar(); loadShooterBalls();
}

function startGame(startLevel = 1) {
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('game-over').style.display = 'none';
  document.getElementById('pause-screen').style.display = 'none';

  score = 0; level = startLevel;
  lives = 3; nextExtraLife = 50000;
  resetGameState(LEVELS[startLevel - 1] || LEVELS[0]);

  gameActive = true;
  showBanner('LEVEL ' + startLevel);
}

function jumpToLevel(n) {
  document.getElementById('pause-screen').style.display = 'none';

  score = 0; level = n;
  lives = 3; nextExtraLife = 50000;
  resetGameState(LEVELS[n - 1] || LEVELS[LEVELS.length - 1]);

  showBanner('LEVEL ' + n);
}

function gameOver() {
  lives--;
  updateHUD();
  if (lives < 0) {
    gameActive = false;
    playSound('gameover');
    document.getElementById('game-over').style.display = 'flex';
    document.getElementById('final-score').textContent = 'Score: ' + score;
    document.getElementById('final-level').textContent = 'Level: ' + level;
    document.getElementById('go-title').textContent = 'CONVERGENCE LOST';
  } else {
    score = track.levelStartScore;
    playSound('lifelost');
    showBanner('LIFE LOST');
    resetGameState(LEVELS[level - 1] || LEVELS[LEVELS.length - 1]);
  }
}

function levelUp() {
  track.levelClearing = true;
  track.clearBonusCrystals();
  playSound('levelup');

  // Calculate clearance bonus: 100 pts per ball slot of empty space to the skull
  const emptyDistance = track.pathLength - track.lastFrontS;
  const bonusSlots = Math.floor(emptyDistance / BALL_SPACING);

  function advanceLevel() {
    level++;
    track.levelClearing = false;
    track.lastFrontS = 0;
    resetGameState(LEVELS[level - 1] || LEVELS[LEVELS.length - 1]);
  }

  if (bonusSlots > 0) {
    for (let i = 0; i < bonusSlots; i++) {
      const s = track.lastFrontS + (i + 0.5) * BALL_SPACING;
      setTimeout(() => {
        const pos = track.getPathPosFromS(Math.min(s, track.pathLength));
        playSound('cleartick');
        spawnScoreText(pos, 100);
        score += 100;
        updateHUD();
      }, i * 30);
    }
    setTimeout(advanceLevel, bonusSlots * 30 + 400);
  } else {
    advanceLevel();
  }
}

function showBanner(text) {
  const b = document.getElementById('level-banner');
  b.textContent = text; b.style.opacity = '1';
  setTimeout(() => { b.style.opacity = '0'; }, 2000);
}

function updateHUD() {
  document.getElementById('score-val').textContent = score;
  document.getElementById('level-val').textContent = level;
  document.getElementById('lives-val').textContent = '♥'.repeat(Math.max(0, lives));
  document.getElementById('lives-label').textContent = lives === 0 ? 'Last life!' : 'Lives:';
  while (score >= nextExtraLife) {
    lives++;
    nextExtraLife += 50000;
    document.getElementById('lives-val').textContent = '♥'.repeat(Math.max(0, lives));
    document.getElementById('lives-label').textContent = lives === 0 ? 'Last life!' : 'Lives:';
    playSound('extralife');
    showBanner('EXTRA LIFE!');
  }
  track.progress = Math.min(1, (score - track.levelStartScore) / track.progressMax);
  updateProgressBar();
  if (track.progress >= 1 && !track.spawningDone) {
    track.spawningDone = true;
    track.rollBackTimer = 2.0; // ROLL_BACK_DURATION
    playSound('resonance');
    showBanner('NO MORE BALLS!');
  }
}

function updateProgressBar() {
  document.getElementById('progress-bar').style.width = (track.progress * 100) + '%';
  document.getElementById('progress-label').textContent = track.spawningDone ? 'RESONANCE PEAKED — CLEAR THE CHAIN!' : 'RESONANCE';
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  const a = w / h, f = 14;
  camera.left = -f * a; camera.right = f * a; camera.top = f; camera.bottom = -f;
  camera.updateProjectionMatrix();
}

init();
