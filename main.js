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
let projectiles = [];
let particles = [];
let score = 0, combo = 1, chainBonus = 1, level = 1;
let gameActive = false;
let gamePaused = false;
let mouseX = 0, mouseY = 0;
let chainSpeed = 1.6; // world units per second (arc-length)
let spawnTimer = 0;
let spawnInterval = 0.45;

// Progress / spawning
let progress = 0;
let progressMax = 250; // score points needed to fill gauge
let levelStartScore = 0;
let spawningDone = false;

// Roll-back (triggered when gauge fills)
const ROLL_BACK_DURATION = 2.0;
const ROLL_BACK_SPEED    = 3.0;
let rollBackTimer = 0;

// Snap-back impulse (triggered when a gap closes)
let snapImpulse = 0;        // current backwards velocity (world units/sec), decays to 0
const SNAP_FRICTION = 5.0;  // deceleration rate

// Roll-in phase
let rollInCount = 20;
const ROLL_IN_SPEED = 8.0;
const ROLL_IN_INTERVAL = 0.1;
let rollInRemaining = 0;
let rollInSpawned = 0;

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

  scene.add(new THREE.AmbientLight(0x6a4a20, 1.4));
  const dl = new THREE.DirectionalLight(0xD4A847, 1.8);
  dl.position.set(5, 8, 15); scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffd080, 1.0);
  dl2.position.set(-8, -5, 10); scene.add(dl2);
  const pl = new THREE.PointLight(0xF0C040, 1.4, 40);
  pl.position.set(0, 0, 8); scene.add(pl);
  const pl2 = new THREE.PointLight(0xffffff, 0.8, 25);
  pl2.position.set(-6, 6, 10); scene.add(pl2);

  loadLevel(LEVELS[0]);
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
  });

  animate();
}

// ─── SHOOTING ───

function onShoot(e) {
  if (!gameActive || e.button !== 0) return;
  playSound('shoot');
  const dir = getAimDir(e.clientX, e.clientY);
  const proj = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
    new THREE.MeshStandardMaterial({ color: COLORS[shooterColorIdx], metalness: 0.5, roughness: 0.3, emissive: COLOR_EMISSIVE[shooterColorIdx] }));
  proj.position.set(SHOOTER_POS.x + dir.x * 2, SHOOTER_POS.y + dir.y * 2, 0);
  scene.add(proj);
  projectiles.push({ mesh: proj, vx: dir.x * 28, vy: dir.y * 28, colorIdx: shooterColorIdx, alive: true });

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
        playSound('hit');
        insertBallInChain(insertIdx, proj.colorIdx, i);
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

  if (gameActive && !gamePaused) {
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

  if (gameActive && !gamePaused) {
    spawnTimer += dt;

    // Spawn at back of chain
    const rollingIn = rollInRemaining > 0;
    const effectiveInterval = rollInSpawned < rollInCount ? ROLL_IN_INTERVAL : spawnInterval;
    if (!spawningDone && spawnTimer > effectiveInterval) {
      spawnChainBall();
      spawnTimer = 0;
      if (rollInSpawned < rollInCount) {
        chain[chain.length - 1].isRollIn = true;
        rollInSpawned++;
      }
    }

    // Advance chain
    if (rollBackTimer > 0) {
      rollBackTimer = Math.max(0, rollBackTimer - dt);
      for (let i = 0; i < chain.length; i++) chain[i].s -= ROLL_BACK_SPEED * dt;
    } else if (chain.length > 0) {
      const activeSpeed = rollingIn ? ROLL_IN_SPEED : chainSpeed;
      // Collect all split points (indices where a gap or push-forward boundary exists)
      const splitIndices = new Set();

      for (const g of gaps) {
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

        // Also enforce spacing within each other segment (but don't cross gaps)
        // Segments: [0..sorted[0]-1], [sorted[0]..sorted[1]-1], etc.
        let segStart = 0;
        for (const split of sorted) {
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

    // Apply snap-back impulse from gap closures
    if (snapImpulse > 0) {
      for (let i = 0; i < chain.length; i++) chain[i].s -= snapImpulse * dt;
      snapImpulse = Math.max(0, snapImpulse - SNAP_FRICTION * dt);
    }

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
    if (spawningDone && !chain.some(b => b.s >= -10)) levelUp();
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

function togglePause() {
  if (!gameActive) return;
  gamePaused = !gamePaused;
  document.getElementById('pause-screen').style.display = gamePaused ? 'flex' : 'none';
  if (!gamePaused) clock.getDelta(); // discard time accumulated while paused
}

function loadLevel(def) {
  levelColors    = def.colors;
  chainSpeed     = def.chainSpeed;
  spawnInterval  = def.spawnInterval;
  rollInCount    = def.rollInCount;
  progressMax    = def.progressThreshold;
  clearTrack();
  buildPath(def.waypoints);
  createTrack();
}

function startGame() {
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('game-over').style.display = 'none';
  document.getElementById('pause-screen').style.display = 'none';

  chain.forEach(b => scene.remove(b.mesh)); chain = [];
  projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
  particles.forEach(p => scene.remove(p)); particles = [];
  gaps = [];
  pushForwards = [];

  score = 0; combo = 1; chainBonus = 1; level = 1;
  loadLevel(LEVELS[0]);
  spawnTimer = 0;
  progress = 0; levelStartScore = 0; spawningDone = false; rollBackTimer = 0; snapImpulse = 0;
  rollInRemaining = rollInCount; rollInSpawned = 0;

  updateHUD(); updateProgressBar();
  loadShooterBalls();
  gameActive = true;
  gamePaused = false;
  showBanner('LEVEL 1');
}

function gameOver() {
  gameActive = false;
  playSound('gameover');
  document.getElementById('game-over').style.display = 'flex';
  document.getElementById('final-score').textContent = 'Score: ' + score;
  document.getElementById('final-level').textContent = 'Level: ' + level;
  document.getElementById('go-title').textContent = 'GEARS HALTED';
}

function levelUp() {
  level++;
  playSound('levelup');
  loadLevel(LEVELS[level - 1] || LEVELS[LEVELS.length - 1]);
  spawnTimer = -2;
  progress = 0; levelStartScore = score; chainBonus = 1;
  spawningDone = false; rollBackTimer = 0; snapImpulse = 0;
  rollInRemaining = rollInCount; rollInSpawned = 0;
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
  document.getElementById('chain-bonus-val').textContent = 'x' + chainBonus;
  progress = Math.min(1, (score - levelStartScore) / progressMax);
  updateProgressBar();
  if (progress >= 1 && !spawningDone) {
    spawningDone = true;
    rollBackTimer = ROLL_BACK_DURATION;
    showBanner('NO MORE BALLS!');
  }
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
