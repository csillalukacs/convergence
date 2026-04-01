// ═══════════════════════════════════════════════
//  CONVERGENCE — Crystal Chain Puzzle
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
let pendingGapBonus = false; // set when the fired projectile passed through a gap
let gameActive = false;
let gamePaused = false;
let mouseX = 0, mouseY = 0;
let chainSpeed = 1.6; // world units per second (arc-length)

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

// Bonus crystal spawn timer
let bonusCrystalSpawnTimer = 8.0; // seconds until first crystal appears
const BONUS_CRYSTAL_INTERVAL = 14.0;

// Powerup state
let chainFreezeTimer = 0;         // pause powerup — chain doesn't advance
let powerupBackTimer  = 0;        // backwards powerup — chain reverses
let pauseSpawnTimer    = 15;      // countdown to next 'pause' ball assignment
let backSpawnTimer     = 20;      // countdown to next 'backwards' ball assignment
const PAUSE_SPAWN_INTERVAL = 15;  // seconds between pause powerup spawns
const BACK_SPAWN_INTERVAL  = 18;  // seconds between backwards powerup spawns
const POWERUP_BALL_DURATION = 10; // seconds a ball keeps its powerup icon

// Roll-in phase
const ROLL_IN_SPEED = 16.0;
const ROLL_IN_COUNT = 40;
let rollInSpawned = 0;

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

// ─── COLLISION ───

function checkProjectileCollisions(dt) {
  for (let p = projectiles.length - 1; p >= 0; p--) {
    const proj = projectiles[p];
    if (!proj.alive) continue;
    proj.mesh.position.x += proj.vx * dt;
    proj.mesh.position.y += proj.vy * dt;

    const bound = 14 * (window.innerWidth / window.innerHeight) + 2;
    if (Math.abs(proj.mesh.position.x) > bound || Math.abs(proj.mesh.position.y) > 16) {
      scene.remove(proj.mesh); proj.alive = false; continue;
    }

    // Gap-crossing detection: mark projectile if it passes through a gap in the chain
    if (!proj.gapBonus) {
      const { s: closestS, dist: closestDist } = getClosestPathS(proj.mesh.position.x, proj.mesh.position.y);
      if (closestDist < BALL_RADIUS * 1.5) {
        for (let gi = 0; gi < chain.length - 1; gi++) {
          if (chain[gi].s - chain[gi + 1].s > BALL_SPACING * 1.5 &&
              closestS > chain[gi + 1].s && closestS < chain[gi].s) {
            proj.gapBonus = true;
            break;
          }
        }
      }
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
        pendingGapBonus = proj.gapBonus;
        playSound('hit');
        insertBallInChain(insertIdx, proj.colorIdx, i);
        checkMatches(insertIdx);
        break;
      }
    }

    // Resonance node pickup — only reachable if chain didn't intercept
    if (proj.alive) {
      for (let ci = bonusCrystals.length - 1; ci >= 0; ci--) {
        const c = bonusCrystals[ci];
        if (!c.alive) continue;
        const dx = proj.mesh.position.x - c.mesh.position.x;
        const dy = proj.mesh.position.y - c.mesh.position.y;
        if (dx * dx + dy * dy < (BALL_RADIUS + 1.0) * (BALL_RADIUS + 1.0)) {
          c.alive = false;
          scene.remove(c.mesh);
          bonusCrystals.splice(ci, 1);
          bonusCrystalSpawnTimer = BONUS_CRYSTAL_INTERVAL;
          scene.remove(proj.mesh); proj.alive = false;
          score += 500;
          updateHUD();
          spawnScoreText(c.mesh.position.clone(), 500);
          for (let k = 0; k < 14; k++) {
            const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 + Math.random() * 0.07, 0),
              new THREE.MeshBasicMaterial({ color: 0xFFDD00, transparent: true, opacity: 1 }));
            sp.position.copy(c.mesh.position);
            const a = Math.random() * Math.PI * 2, spd = 2 + Math.random() * 5;
            sp.userData = { vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1, decay: 0.020 + Math.random() * 0.02 };
            scene.add(sp); particles.push(sp);
          }
          break;
        }
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

  gears.forEach(g => {
    g.rotation.z += g.userData.spinSpeed * dt;
    g.rotation.x += g.userData.spinSpeed * 0.7 * dt;
  });

  for (let ci = bonusCrystals.length - 1; ci >= 0; ci--) {
    const c = bonusCrystals[ci];
    if (!c.alive) continue;
    c.life -= dt;
    if (c.life <= 0) {
      scene.remove(c.mesh);
      bonusCrystals.splice(ci, 1);
      continue;
    }
    const phase = c.mesh.userData.phase;
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3 + phase);
    // Fade out in last 2 seconds
    const fadeAlpha = Math.min(1, c.life / 2.0);
    c.mesh.userData.core.rotation.y += dt * 2.5;
    c.mesh.userData.core.rotation.x += dt * 1.1;
    c.mesh.userData.core.material.emissiveIntensity = (1.8 + 2.0 * pulse) * fadeAlpha;
    c.mesh.userData.mid.rotation.y -= dt * 1.3;
    c.mesh.userData.mid.rotation.z += dt * 0.9;
    c.mesh.userData.mid.material.opacity = 0.38 * fadeAlpha;
    c.mesh.userData.cage.rotation.x += dt * 0.8;
    c.mesh.userData.cage.rotation.z -= dt * 0.6;
    c.mesh.userData.cage.material.opacity = 0.55 * fadeAlpha;
    c.mesh.position.z = -1.8 + Math.sin(clock.elapsedTime * 2 + phase) * 0.22;
    c.mesh.scale.setScalar((0.92 + 0.12 * pulse) * fadeAlpha);
  }

  if (gameActive && !gamePaused) {
    bonusCrystalSpawnTimer -= dt;
    if (bonusCrystalSpawnTimer <= 0 && bonusCrystals.filter(c => c.alive).length === 0) {
      spawnBonusCrystal();
      bonusCrystalSpawnTimer = BONUS_CRYSTAL_INTERVAL;
    }
  }

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
    // Spawn at back of chain — keep it filled
    const rollingIn = rollInSpawned < ROLL_IN_COUNT;
    if (!spawningDone) {
      while (chain.length === 0 || chain[chain.length - 1].s > -BALL_SPACING) {
        spawnChainBall();
        rollInSpawned++;
      }
    }

    // Advance chain
    if (rollBackTimer > 0) {
      rollBackTimer = Math.max(0, rollBackTimer - dt);
      for (let i = 0; i < chain.length; i++) chain[i].s -= ROLL_BACK_SPEED * dt;
    } else if (powerupBackTimer > 0) {
      powerupBackTimer = Math.max(0, powerupBackTimer - dt);
      for (let i = 0; i < chain.length; i++) chain[i].s -= ROLL_BACK_SPEED * dt;
    } else if (chainFreezeTimer > 0) {
      chainFreezeTimer = Math.max(0, chainFreezeTimer - dt);
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
    tickBallPowerups(dt);

    if (!spawningDone) {
      pauseSpawnTimer -= dt;
      if (pauseSpawnTimer <= 0) {
        tryAssignPowerup('pause');
        pauseSpawnTimer = PAUSE_SPAWN_INTERVAL;
      }
      backSpawnTimer -= dt;
      if (backSpawnTimer <= 0) {
        tryAssignPowerup('backwards');
        backSpawnTimer = BACK_SPAWN_INTERVAL;
      }
    }

    // Apply snap-back impulse from gap closures
    if (snapImpulse > 0) {
      for (let i = 0; i < chain.length; i++) chain[i].s -= snapImpulse * dt;
      snapImpulse = Math.max(0, snapImpulse - SNAP_FRICTION * dt);
    }

    // Update ball positions
    for (let i = 0; i < chain.length; i++) {
      const ball = chain[i];
      ball.mesh.visible = ball.s >= 0;
      if (!ball.mesh.visible) continue;
      const pos = getPathPosFromS(ball.s);
      ball.mesh.position.copy(pos);
      ball.mesh.rotation.z += dt * 1.5;
      ball.mesh.rotation.x += dt * 0.8;
    }

    // Game over
    if (chain.length > 0 && chain[0].s >= pathLength * 0.98) gameOver();

    checkProjectileCollisions(dt);

    // Level clear
    if (spawningDone && !chain.some(b => b.s >= -2)) levelUp();
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
  progressMax    = def.progressThreshold;
  clearTrack();
  clearBonusCrystals();
  buildPath(MAPS[def.map].waypoints);
  createTrack();
}

function startGame(startLevel = 1) {
  cancelChainReactions();
  clearAllPowerupVisuals();
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('game-over').style.display = 'none';
  document.getElementById('pause-screen').style.display = 'none';

  chain.forEach(b => scene.remove(b.mesh)); chain = [];
  projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
  particles.forEach(p => scene.remove(p)); particles = [];
  gaps = [];
  pushForwards = [];

  score = 0; combo = 1; chainBonus = 1; level = startLevel;
  loadLevel(LEVELS[startLevel - 1] || LEVELS[0]);
  progress = 0; levelStartScore = 0; spawningDone = false; rollBackTimer = 0; snapImpulse = 0; rollInSpawned = 0;
  chainFreezeTimer = 0; powerupBackTimer = 0; pauseSpawnTimer = 15; backSpawnTimer = 20; bonusCrystalSpawnTimer = 8.0;

  updateHUD(); updateProgressBar();
  loadShooterBalls();
  gameActive = true;
  gamePaused = false;
  showBanner('LEVEL ' + startLevel);
}

function jumpToLevel(n) {
  cancelChainReactions();
  clearAllPowerupVisuals();
  chain.forEach(b => scene.remove(b.mesh)); chain = [];
  projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
  gaps = []; pushForwards = [];

  level = n;
  loadLevel(LEVELS[n - 1] || LEVELS[LEVELS.length - 1]);
  score = 0; combo = 1; progress = 0; levelStartScore = 0; chainBonus = 1;
  spawningDone = false; rollBackTimer = 0; snapImpulse = 0; rollInSpawned = 0;
  chainFreezeTimer = 0; powerupBackTimer = 0; pauseSpawnTimer = 15; backSpawnTimer = 20; bonusCrystalSpawnTimer = 8.0;

  gamePaused = false;
  document.getElementById('pause-screen').style.display = 'none';
  updateProgressBar(); updateHUD(); loadShooterBalls();
  showBanner('LEVEL ' + n);
}

function gameOver() {
  gameActive = false;
  playSound('gameover');
  document.getElementById('game-over').style.display = 'flex';
  document.getElementById('final-score').textContent = 'Score: ' + score;
  document.getElementById('final-level').textContent = 'Level: ' + level;
  document.getElementById('go-title').textContent = 'CONVERGENCE LOST';
}

function levelUp() {
  cancelChainReactions();
  clearAllPowerupVisuals();
  chain.forEach(b => scene.remove(b.mesh)); chain = [];
  projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
  gaps = []; pushForwards = [];

  level++;
  playSound('levelup');
  loadLevel(LEVELS[level - 1] || LEVELS[LEVELS.length - 1]);
  progress = 0; levelStartScore = score; chainBonus = 1;
  spawningDone = false; rollBackTimer = 0; snapImpulse = 0; rollInSpawned = 0;
  chainFreezeTimer = 0; powerupBackTimer = 0; pauseSpawnTimer = 15; backSpawnTimer = 20; bonusCrystalSpawnTimer = 8.0;
  updateProgressBar();
  showBanner('LEVEL ' + level);
  updateHUD();
  loadShooterBalls();
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
  document.getElementById('progress-label').textContent = spawningDone ? 'RESONANCE PEAKED — CLEAR THE CHAIN!' : 'RESONANCE';
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  const a = w / h, f = 14;
  camera.left = -f * a; camera.right = f * a; camera.top = f; camera.bottom = -f;
  camera.updateProjectionMatrix();
}

// ─── POWERUPS ───

function tickBallPowerups(dt) {
  for (const ball of chain) {
    if (!ball.powerup) continue;
    ball.powerupTimer -= dt;
    if (ball.powerupTimer <= 0) {
      removePowerupVisuals(ball);
      ball.powerup = null;
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5);
      if (ball.powerupSprite) {
        ball.powerupSprite.visible = ball.mesh.visible;
        ball.powerupSprite.position.copy(ball.mesh.position);
        ball.powerupSprite.material.opacity = 0.7 + 0.3 * pulse;
      }
      if (ball.powerupHalo) {
        ball.powerupHalo.material.opacity = 0.12 + 0.22 * pulse;
        ball.powerupHalo.scale.setScalar(1 + 0.12 * pulse);
      }
      ball.mesh.material.emissiveIntensity = 1 + 2.5 * pulse;
    }
  }
}

function removePowerupVisuals(ball) {
  if (ball.powerupSprite) { scene.remove(ball.powerupSprite); ball.powerupSprite = null; }
  if (ball.powerupHalo)   { ball.mesh.remove(ball.powerupHalo); ball.powerupHalo = null; }
  ball.mesh.material.emissiveIntensity = 1;
}

function tryAssignPowerup(type) {
  if (!gameActive || chain.length < 6) return;
  const candidates = chain.filter(
    (b, i) => !b.powerup && b.alive && b.s >= 0 && i > 0 && i < chain.length - 1
  );
  if (candidates.length === 0) return;
  const ball = candidates[Math.floor(Math.random() * candidates.length)];
  ball.powerup = type;
  ball.powerupTimer = POWERUP_BALL_DURATION;
  ball.powerupSprite = createPowerupSprite(type);
  scene.add(ball.powerupSprite);
  ball.powerupHalo = createPowerupHalo();
  ball.mesh.add(ball.powerupHalo);
}

function clearAllPowerupVisuals() {
  for (const ball of chain) {
    if (ball.powerup) removePowerupVisuals(ball);
  }
}

function activatePowerup(type) {
  if (type === 'pause') {
    chainFreezeTimer = 4.0;
    showBanner('CHAIN FROZEN');
  } else if (type === 'backwards') {
    powerupBackTimer = 2.5;
    showBanner('REVERSED!');
  }
  playSound('powerup');
}

init();
