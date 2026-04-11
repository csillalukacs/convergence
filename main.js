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
let gameMode = 'story'; // 'story' | 'single'
let mouseX = 0, mouseY = 0;

let tracks = []; // Track instances — one per path in the current level

// Debug usage flag — stays here because it affects score saving
let debugUsedThisRun = false;

let shockwaves = []; // expanding ring visuals from blast

// ─── MULTI-TRACK HELPERS ───

function loadTracksForLevel(levelDef) {
  const map = MAPS[levelDef.map];
  const trackDefs = map.tracks || [{ waypoints: map.waypoints }];
  tracks.forEach(t => { t.clearTrackVisuals(); t.clearBonusCrystals(); });
  tracks = [];
  for (const td of trackDefs) {
    const t = new Track();
    t.loadLevelMulti(levelDef, td.waypoints);
    tracks.push(t);
  }
}

function resetTracksForLevel(levelDef) {
  const map = MAPS[levelDef.map];
  const trackDefs = map.tracks || [{ waypoints: map.waypoints }];
  // If track count changed (different map shape), rebuild entirely
  if (tracks.length !== trackDefs.length) {
    tracks.forEach(t => {
      t.resetState();
      t.clearTrackVisuals();
      t.clearBonusCrystals();
    });
    tracks = [];
    for (const td of trackDefs) {
      const t = new Track();
      t.loadLevelMulti(levelDef, td.waypoints);
      tracks.push(t);
    }
  } else {
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].resetState();
      tracks[i].loadLevelMulti(levelDef, trackDefs[i].waypoints);
    }
  }
}

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

  loadAudioSettings();

  loadTracksForLevel(LEVELS[0]);
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

    if (e.code === 'Backquote') {
      if (typeof toggleDebugMode === 'function') toggleDebugMode();
      return;
    }
    if (typeof debugMode !== 'undefined' && debugMode) {
      if (typeof handleDebugKey === 'function') handleDebugKey(e);
    }
  });
  window.addEventListener('keyup', e => {
    if (typeof handleDebugKeyUp === 'function') handleDebugKeyUp(e);
  });

  animate();
  hideLoadingScreen();

  const fsBtn = document.getElementById('fullscreen-btn');
  if (!document.fullscreenEnabled) fsBtn.style.display = 'none';
  document.addEventListener('fullscreenchange', updateFullscreenBtn);
}

// ─── LOADING / FULLSCREEN ───

function hideLoadingScreen() {
  const label = document.getElementById('loading-label');
  const enter = document.getElementById('loading-enter');
  const bar = document.querySelector('.loading-bar-wrap');
  if (label) label.style.display = 'none';
  if (bar) bar.style.display = 'none';
  if (enter) enter.style.display = 'block';
  const el = document.getElementById('loading-screen');
  if (el) el.style.cursor = 'pointer';
  el.addEventListener('click', onLoadingClick, { once: true });
}

function onLoadingClick() {
  getAudioCtx().resume();
  const el = document.getElementById('loading-screen');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 1);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

function updateFullscreenBtn() {
  const btn = document.getElementById('fullscreen-btn');
  if (!btn) return;
  const active = !!document.fullscreenElement;
  btn.textContent = active ? 'EXIT' : 'FULL';
  btn.classList.toggle('fullscreen-active', active);
  if (typeof syncOptionsPanel === 'function') syncOptionsPanel();
}

// ─── SHOOTING ───

function onShoot(e) {
  if (!gameActive || tracks.some(t => t.levelClearing) || e.button !== 0) return;
  playSound('shoot');
  const dir = getAimDir(e.clientX, e.clientY);
  const proj = new THREE.Mesh(getSharedBallGeom(),
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
    for (const t of tracks) t.update(dt);

    // Game over if any track reaches skull
    if (tracks.some(t => t.isGameOver())) gameOver();

    for (const t of tracks) t.checkProjectileCollisions(dt);
    updateTimer();

    // Level clear when all tracks are cleared
    if (tracks.every(t => t.isCleared())) levelUp();
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.position.x += p.userData.vx * dt;
    p.position.y += p.userData.vy * dt;
    p.userData.life -= p.userData.decay;
    p.material.opacity = Math.max(0, p.userData.life);
    p.scale.setScalar(Math.max(0.01, p.userData.life));
    if (p.userData.life <= 0) { scene.remove(p); p.geometry.dispose(); p.material.dispose(); particles.splice(i, 1); }
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life -= dt;
    if (sw.life <= 0) { scene.remove(sw.mesh); sw.mesh.geometry.dispose(); sw.mesh.material.dispose(); shockwaves.splice(i, 1); continue; }
    const t = 1 - sw.life / sw.maxLife;
    sw.mesh.scale.setScalar(1 + t * 5);
    sw.mesh.material.opacity = (1 - t) * 0.7;
  }

  if (typeof tickDebug === 'function') tickDebug();

  renderer.render(scene, camera);
}

// ─── GAME STATE ───

function togglePause() {
  if (!gameActive) return;
  if (document.getElementById('level-summary').style.display === 'flex') return;
  gamePaused = !gamePaused;
  playSound(gamePaused ? 'pause' : 'unpause');
  document.getElementById('pause-screen').style.display = gamePaused ? 'flex' : 'none';
  if (!gamePaused) clock.getDelta(); // discard time accumulated while paused
}

function resetGameState(levelDef) {
  projectiles.forEach(p => { scene.remove(p.mesh); disposeMesh(p.mesh); }); projectiles = [];
  particles.forEach(p => { scene.remove(p); p.geometry.dispose(); p.material.dispose(); }); particles = [];
  shockwaves.forEach(sw => { scene.remove(sw.mesh); sw.mesh.geometry.dispose(); sw.mesh.material.dispose(); }); shockwaves = [];
  if (typeof clearDebugGapMarkers === 'function') clearDebugGapMarkers();

  resetTracksForLevel(levelDef);
  tracks.forEach(t => t.levelStartScore = score);
  gamePaused = false;

  updateHUD(); updateProgressBar(); loadShooterBalls();
}

function hideAllScreens() {
  ['title-screen','game-over','victory-screen','level-summary','pause-screen',
   'levels-overlay','scores-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function startGame(startLevel = 1) {
  hideAllScreens();
  gameMode = 'story';
  score = 0; level = startLevel;
  lives = 3; nextExtraLife = 50000;
  debugUsedThisRun = false;
  resetGameState(LEVELS[startLevel - 1] || LEVELS[0]);
  gameActive = true;
  const startDef = LEVELS[startLevel - 1] || LEVELS[0];
  showBanner('LEVEL ' + startLevel + '\n' + MAPS[startDef.map].name);
}

function startSingleLevel(n) {
  hideAllScreens();
  gameMode = 'single';
  score = 0; level = n;
  lives = 0; nextExtraLife = Infinity;
  debugUsedThisRun = false;
  resetGameState(LEVELS[n - 1] || LEVELS[0]);
  gameActive = true;
  const def = LEVELS[n - 1] || LEVELS[0];
  showBanner('LEVEL ' + n + '\n' + MAPS[def.map].name);
}

function jumpToLevel(n) {
  document.getElementById('pause-screen').style.display = 'none';
  debugUsedThisRun = true;
  score = 0; level = n;
  lives = 3; nextExtraLife = 50000;
  const jumpDef = LEVELS[n - 1] || LEVELS[LEVELS.length - 1];
  resetGameState(jumpDef);
  showBanner('LEVEL ' + n + '\n' + MAPS[jumpDef.map].name);
}

function gameOver() {
  if (gameMode === 'single') {
    gameActive = false;
    playSound('gameover');
    document.getElementById('game-over').style.display = 'flex';
    document.getElementById('final-score').textContent = 'Score: ' + score.toLocaleString();
    document.getElementById('final-level').textContent = 'Level: ' + level;
    const goTitle = document.getElementById('go-title');
    goTitle.textContent = 'CONVERGENCE LOST';
    goTitle.classList.remove('go-highscore');
    document.getElementById('go-retry-btn').style.display = 'inline-block';
    document.getElementById('go-menu-btn').style.display = 'inline-block';
    renderHighScores('go-highscores');
    return;
  }
  lives--;
  updateHUD();
  if (lives < 0) {
    gameActive = false;
    playSound('gameover');
    const isNewHigh = saveHighScore(false);
    document.getElementById('game-over').style.display = 'flex';
    document.getElementById('final-score').textContent = 'Score: ' + score.toLocaleString();
    document.getElementById('final-level').textContent = 'Level: ' + level;
    const goTitle = document.getElementById('go-title');
    goTitle.textContent = isNewHigh ? 'NEW HIGH SCORE!' : 'CONVERGENCE LOST';
    goTitle.classList.toggle('go-highscore', isNewHigh);
    document.getElementById('go-retry-btn').style.display = 'inline-block';
    document.getElementById('go-menu-btn').style.display = 'none';
    renderHighScores('go-highscores');
  } else {
    score = tracks[0].levelStartScore;
    playSound('lifelost');
    showBanner('LIFE LOST');
    resetGameState(LEVELS[level - 1] || LEVELS[LEVELS.length - 1]);
  }
}

function levelUp() {
  if (tracks.some(t => t.levelClearing)) return; // guard against double-call
  tracks.forEach(t => { t.levelClearing = true; t.clearBonusCrystals(); });
  playSound('levelup');

  // Per-level score
  const levelScore = score - tracks[0].levelStartScore;

  // Time bonus: 50 pts per second under par
  const levelDef = LEVELS[level - 1] || LEVELS[LEVELS.length - 1];
  let timeBonus = 0;
  const maxElapsed = Math.floor(Math.max(...tracks.map(t => t.levelElapsedTime)));
  if (levelDef.parTime && maxElapsed < levelDef.parTime) {
    timeBonus = (levelDef.parTime - maxElapsed) * 50;
  }

  // Calculate clearance bonus: sum across all tracks
  let totalBonusSlots = 0;
  const trackBonusInfo = tracks.map(t => {
    const emptyDistance = t.pathLength - t.lastFrontS;
    const slots = Math.floor(emptyDistance / BALL_SPACING);
    return { track: t, slots, lastFrontS: t.lastFrontS };
  });
  totalBonusSlots = trackBonusInfo.reduce((sum, info) => sum + info.slots, 0);

  let clearanceTotal = 0;

  function showLevelSummary() {
    score += timeBonus;
    updateHUD();
    gamePaused = true; // freeze game loop while summary is showing

    const elapsed = Math.floor(maxElapsed);
    const par = levelDef.parTime || 0;

    function fmt(t) {
      return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    }

    const mapName = MAPS[levelDef.map].name;
    document.getElementById('ls-title').textContent = 'LEVEL ' + level + ' CLEAR';
    document.getElementById('ls-track').textContent = mapName;
    document.getElementById('ls-score').textContent = levelScore.toLocaleString();
    document.getElementById('ls-clearance').textContent = clearanceTotal > 0 ? '+' + clearanceTotal.toLocaleString() : '—';
    document.getElementById('ls-time-elapsed').textContent = fmt(elapsed);
    document.getElementById('ls-time-par').textContent = fmt(par);
    document.getElementById('ls-time-row').style.display = timeBonus > 0 ? 'flex' : 'none';
    document.getElementById('ls-time').textContent = '+' + timeBonus.toLocaleString();
    const levelTotal = levelScore + clearanceTotal + timeBonus;
    document.getElementById('ls-total').textContent = levelTotal.toLocaleString();
    document.getElementById('ls-score-current').textContent = levelTotal.toLocaleString();

    const isVictory = gameMode === 'story' && level >= LEVELS.length;
    const btn = document.getElementById('ls-continue');
    const menuBtn = document.getElementById('ls-menu');

    if (gameMode === 'single') {
      btn.textContent = 'TRY AGAIN';
      menuBtn.style.display = 'inline-block';
      btn.onclick = () => {
        document.getElementById('level-summary').style.display = 'none';
        gamePaused = false;
        clock.getDelta();
        startSingleLevel(level);
      };
    } else {
      btn.textContent = isVictory ? 'ONWARD' : 'CONTINUE';
      menuBtn.style.display = 'none';
      btn.onclick = () => {
        document.getElementById('level-summary').style.display = 'none';
        gamePaused = false;
        clock.getDelta();
        if (isVictory) {
          victory();
        } else {
          level++;
          tracks.forEach(t => { t.levelClearing = false; t.lastFrontS = 0; });
          resetGameState(LEVELS[level - 1] || LEVELS[LEVELS.length - 1]);
          const nextDef = LEVELS[level - 1] || LEVELS[LEVELS.length - 1];
          showBanner('LEVEL ' + level + '\n' + MAPS[nextDef.map].name);
        }
      };
    }

    // Unlock next level in story mode (before the player clicks Continue)
    if (gameMode === 'story' && !debugUsedThisRun && level < LEVELS.length) unlockLevel(level + 1);

    // Per-level best score (counts in both story and single mode, never in debug)
    const prevBest = loadLevelScores()[level] || 0;
    const isNewLevelBest = !debugUsedThisRun && saveLevelScore(level, levelTotal);
    const bestScoreEl = document.getElementById('ls-score-best');
    const bestLabelEl = document.getElementById('ls-best-label');
    const newBestEl = document.getElementById('ls-new-best');
    bestLabelEl.textContent = isNewLevelBest ? 'PREVIOUS BEST' : 'BEST';
    bestScoreEl.textContent = prevBest > 0 ? prevBest.toLocaleString() : '—';
    newBestEl.style.display = isNewLevelBest ? 'block' : 'none';

    document.getElementById('level-summary').style.display = 'flex';
  }

  if (totalBonusSlots > 0) {
    let tickIdx = 0;
    for (const info of trackBonusInfo) {
      for (let i = 0; i < info.slots; i++) {
        const s = info.lastFrontS + (i + 0.5) * BALL_SPACING;
        const t = info.track;
        setTimeout(() => {
          const pos = t.getPathPosFromS(Math.min(s, t.pathLength));
          playSound('cleartick');
          spawnScoreText(pos, 100);
          score += 100;
          clearanceTotal += 100;
          updateHUD();
        }, tickIdx * 30);
        tickIdx++;
      }
    }
    setTimeout(showLevelSummary, totalBonusSlots * 30 + 400);
  } else {
    showLevelSummary();
  }
}

function victory() {
  gameActive = false;
  gamePaused = false;
  tracks.forEach(t => t.levelClearing = false);
  playSound('victory');
  const isNewHigh = saveHighScore(true);
  spawnVictoryParticles();
  document.getElementById('victory-screen').style.display = 'flex';
  document.getElementById('victory-score').textContent =
    (isNewHigh ? 'NEW HIGH SCORE! ' : 'Final Score: ') + score.toLocaleString();
  renderHighScores('victory-highscores');
}

function showBanner(text) {
  const b = document.getElementById('level-banner');
  b.textContent = text; b.style.opacity = '1';
  setTimeout(() => { b.style.opacity = '0'; }, 2000);
}

function updateHUD() {
  document.getElementById('score-val').textContent = score;
  document.getElementById('level-val').textContent = level;
  if (gameMode === 'single') {
    document.getElementById('lives-val').textContent = '—';
    document.getElementById('lives-label').textContent = 'Single Level';
  } else {
    document.getElementById('lives-val').textContent = '♥'.repeat(Math.max(0, lives));
    document.getElementById('lives-label').textContent = lives === 0 ? 'Last life!' : 'Lives:';
  }
  while (gameMode === 'story' && score >= nextExtraLife) {
    lives++;
    nextExtraLife += 50000;
    document.getElementById('lives-val').textContent = '♥'.repeat(Math.max(0, lives));
    document.getElementById('lives-label').textContent = lives === 0 ? 'Last life!' : 'Lives:';
    playSound('extralife');
    showBanner('EXTRA LIFE!');
  }
  for (const t of tracks) {
    t.progress = Math.min(1, (score - t.levelStartScore) / t.progressMax);
  }
  updateProgressBar();
  if (tracks.every(t => t.progress >= 1) && tracks.some(t => !t.spawningDone)) {
    tracks.forEach(t => { t.spawningDone = true; t.rollBackTimer = 2.0; });
    playSound('resonance');
    showBanner('NO MORE BALLS!');
  }
}

function updateProgressBar() {
  const avgProgress = tracks.reduce((sum, t) => sum + t.progress, 0) / tracks.length;
  document.getElementById('progress-bar').style.width = (avgProgress * 100) + '%';
  document.getElementById('progress-label').textContent = tracks.every(t => t.spawningDone) ? 'RESONANCE PEAKED — CLEAR THE CHAIN!' : 'RESONANCE';
}

function updateTimer() {
  const elapsed = Math.max(...tracks.map(t => t.levelElapsedTime));
  const levelDef = LEVELS[level - 1] || LEVELS[LEVELS.length - 1];
  const par = levelDef.parTime || 0;
  const remaining = Math.max(0, par - Math.floor(elapsed));
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  document.getElementById('timer-val').textContent = mins + ':' + String(secs).padStart(2, '0');
  document.getElementById('timer-par').textContent = '';

  const panel = document.getElementById('timer-panel');
  panel.classList.toggle('under-par', elapsed < par);
  panel.classList.toggle('over-par', elapsed >= par);
}

// ─── HIGH SCORES ───

function loadHighScores() {
  try {
    return JSON.parse(localStorage.getItem('convergence-highscores')) || [];
  } catch { return []; }
}

function saveHighScore(won) {
  if (debugUsedThisRun || score === 0) return false;
  const scores = loadHighScores();
  const wouldPlace = scores.length < 5 || score > scores[scores.length - 1].score;
  if (!wouldPlace) return false;
  scores.push({ score, level, date: new Date().toISOString().slice(0, 10), won });
  scores.sort((a, b) => b.score - a.score);
  if (scores.length > 5) scores.length = 5;
  localStorage.setItem('convergence-highscores', JSON.stringify(scores));
  return true;
}

// ─── LEVEL PROGRESS & PER-LEVEL HIGH SCORES ───

function loadUnlockedLevel() {
  return parseInt(localStorage.getItem('convergence-unlocked') || '1', 10);
}

function unlockLevel(n) {
  if (n > loadUnlockedLevel()) {
    localStorage.setItem('convergence-unlocked', String(n));
  }
}

function loadLevelScores() {
  try { return JSON.parse(localStorage.getItem('convergence-level-scores')) || {}; }
  catch { return {}; }
}

function saveLevelScore(levelNum, sc) {
  const scores = loadLevelScores();
  const isNew = sc > (scores[levelNum] || 0);
  if (isNew) {
    scores[levelNum] = sc;
    localStorage.setItem('convergence-level-scores', JSON.stringify(scores));
  }
  return isNew;
}

function renderHighScores(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const scores = loadHighScores();
  if (scores.length === 0) {
    el.innerHTML = '<div class="hs-empty">No high scores yet</div>';
    return;
  }
  el.innerHTML = scores.map((s, i) =>
    `<div class="hs-row">` +
      `<span class="hs-rank">${i + 1}.</span>` +
      `<span class="hs-score">${s.score.toLocaleString()}</span>` +
      `<span class="hs-level">Lv ${s.level}${s.won ? ' \u2605' : ''}</span>` +
      `<span class="hs-date">${s.date}</span>` +
    `</div>`
  ).join('');
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  const a = w / h, f = 14;
  camera.left = -f * a; camera.right = f * a; camera.top = f; camera.bottom = -f;
  camera.updateProjectionMatrix();
}

init();
