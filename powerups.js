// ═══════════════════════════════════════════════
//  Powerups — visuals, assignment, and activation
// ═══════════════════════════════════════════════
//
// Globals used from outside:
//   scene, clock                   (Three.js core — from main.js)
//   score, updateHUD, showBanner   (scoring / HUD — from main.js)
//   gameActive                     (state — from main.js)
//   shockwaves                     (visual array — from main.js)
//   playSound                      (audio.js)
//   COLORS, COLOR_EMISSIVE         (path.js constants)
//   BALL_RADIUS, BALL_SPACING      (path.js constants)
//   explodeBall, spawnParticleBurst, disposeMesh, spawnScoreText (scene.js)

// ─── POWERUP VISUALS (from scene.js) ───

function removePowerupVisuals(ball) {
  if (ball.powerupSprite) {
    scene.remove(ball.powerupSprite);
    if (ball.powerupSprite.material) {
      if (ball.powerupSprite.material.map) ball.powerupSprite.material.map.dispose();
      ball.powerupSprite.material.dispose();
    }
    ball.powerupSprite = null;
  }
  if (ball.powerupHalo) {
    ball.mesh.remove(ball.powerupHalo);
    if (ball.powerupHalo.material) ball.powerupHalo.material.dispose();
    if (ball.powerupHalo.geometry) ball.powerupHalo.geometry.dispose();
    ball.powerupHalo = null;
  }
  ball.mesh.material.emissiveIntensity = 1;
}

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
  } else if (type === 'chromatic') {
    // Connected-dots icon — three circles linked by lines
    const cx = S / 2, cy = S / 2;
    ctx.shadowColor = '#ff66ff';
    ctx.shadowBlur = 10;
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: cx + Math.cos(a) * S * 0.25, y: cy + Math.sin(a) * S * 0.25 });
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(pts[k].x, pts[k].y);
      ctx.lineTo(pts[(k + 1) % 3].x, pts[(k + 1) % 3].y);
      ctx.stroke();
    }
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, S * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, S * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = '#ff88ff';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 1.6, 1);
  return sprite;
}

function createPowerupHalo() {
  const m = new THREE.Mesh(
    _haloGeom(),
    new THREE.MeshBasicMaterial({
      color: 0xaaddff, transparent: true, opacity: 0,
      side: THREE.BackSide, depthWrite: false
    })
  );
  m.scale.setScalar(BALL_RADIUS * 1.55);
  return m;
}

// ─── TRACK POWERUP METHODS (from track.js) ───

Track.prototype.tickBallPowerups = function(dt) {
  for (const ball of this.chain) {
    if (!ball.powerup) continue;
    ball.powerupTimer -= dt;
    if (ball.powerupTimer <= 0) {
      playSound('powerupexpire');
      removePowerupVisuals(ball);
      ball.powerup = null;
    } else {
      const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 5);
      // Flash icon when about to expire (last 3 seconds)
      const expiring = ball.powerupTimer < 3;
      const flashOn = !expiring || Math.sin(clock.elapsedTime * (ball.powerupTimer < 1.5 ? 20 : 10)) > 0;
      if (ball.powerupSprite) {
        ball.powerupSprite.visible = ball.mesh.visible && flashOn;
        ball.powerupSprite.position.copy(ball.mesh.position);
        ball.powerupSprite.material.opacity = 0.7 + 0.3 * pulse;
      }
      if (ball.powerupHalo) {
        ball.powerupHalo.material.opacity = (0.12 + 0.22 * pulse) * (flashOn ? 1 : 0.15);
        ball.powerupHalo.scale.setScalar(1 + 0.12 * pulse);
      }
      ball.mesh.material.emissiveIntensity = 1 + 2.5 * pulse * (flashOn ? 1 : 0.3);
    }
  }
};

Track.prototype.tryAssignPowerup = function(type) {
  if (!gameActive || this.chain.length < 6) return;
  const candidates = this.chain.filter(
    (b, i) => !b.powerup && b.alive && b.s >= 0 && i > 0 && i < this.chain.length - 1
  );
  if (candidates.length === 0) return;
  const ball = candidates[Math.floor(Math.random() * candidates.length)];
  ball.powerup = type;
  ball.powerupTimer = 10; // POWERUP_BALL_DURATION
  ball.powerupSprite = createPowerupSprite(type);
  scene.add(ball.powerupSprite);
  ball.powerupHalo = createPowerupHalo();
  ball.mesh.add(ball.powerupHalo);
  playSound('powerupspawn');
};

Track.prototype.clearAllPowerupVisuals = function() {
  for (const ball of this.chain) {
    if (ball.powerup) removePowerupVisuals(ball);
  }
};

Track.prototype.activatePowerup = function(type, s, colorIdx) {
  if (type === 'pause') {
    this.chainFreezeTimer = 4.0;
    showBanner('CHAIN FROZEN');
  } else if (type === 'backwards') {
    this.powerupBackTimer = 2.5;
    showBanner('REVERSED!');
  } else if (type === 'blast') {
    this.activateBlast(s);
    return;
  } else if (type === 'chromatic') {
    this.activateChromatic(colorIdx);
    return;
  }
  playSound('powerup');
};

Track.prototype.activateBlast = function(s) {
  const BLAST_RADIUS = BALL_SPACING * 3;
  const blastPos = this.getPathPosFromS(s);
  showBanner('NOVA BLAST!');
  playSound('powerup');

  if (!_noPart()) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.12, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.7, depthWrite: false })
    );
    ring.position.copy(blastPos); ring.position.z = 0.2;
    scene.add(ring);
    shockwaves.push({ mesh: ring, life: 0.55, maxLife: 0.55 });

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.07, 6, 28),
      new THREE.MeshBasicMaterial({ color: 0xFFFFAA, transparent: true, opacity: 0.5, depthWrite: false })
    );
    ring2.position.copy(blastPos); ring2.position.z = 0.15;
    scene.add(ring2);
    shockwaves.push({ mesh: ring2, life: 0.4, maxLife: 0.4 });
  }

  let blastCount = 0;
  for (let i = 0; i < this.chain.length; i++) {
    const b = this.chain[i];
    const dx = b.mesh.position.x - blastPos.x;
    const dy = b.mesh.position.y - blastPos.y;
    if (dx * dx + dy * dy <= BLAST_RADIUS * BLAST_RADIUS) {
      if (b.powerup) {
        const type = b.powerup;
        const triggerS = b.s;
        const triggerColor = b.colorIdx;
        removePowerupVisuals(b);
        b.powerup = null;
        this.activatePowerup(type, triggerS, triggerColor);
      }
      explodeBall(b);
      b.alive = false;
      blastCount++;
    }
  }

  if (blastCount > 0) {
    this.chain = this.chain.filter(b => b.alive);
    const pts = blastCount * 15;
    score += pts;
    updateHUD();
    spawnScoreText(blastPos, pts);
    if (this.chain.length > 1) {
      for (let i = 0; i < this.chain.length - 1; i++) {
        if (this.chain[i].s - this.chain[i + 1].s > BALL_SPACING * 1.1) {
          this.scheduleCollapse(i + 1);
        }
      }
    }
  }

  spawnParticleBurst(blastPos, 20, [0xFF6600, 0xFFEE44], { minSize: 0.08, maxSize: 0.18, minSpeed: 3, maxSpeed: 9, decay: 0.018 });
};

Track.prototype.activateChromatic = function(colorIdx, sourceBalls) {
  if (!sourceBalls) sourceBalls = [];
  if (colorIdx < 0 || colorIdx >= COLORS.length) return;
  showBanner('COLOR PURGE!');
  playSound('powerup');

  const targets = this.chain.filter(b => b.colorIdx === colorIdx && b.alive && b.s >= 0);
  // Include source balls (the original match) so they animate with the purge
  for (const b of sourceBalls) {
    if (b.alive && !targets.includes(b)) targets.push(b);
  }
  if (targets.length === 0) return;

  const rays = [];
  const color = COLORS[colorIdx];
  const rayCounts = new Map();
  for (const ball of targets) rayCounts.set(ball, 0);

  const shuffledTargets = [...targets].sort(() => Math.random() - 0.5);
  for (const ball of shuffledTargets) {
    const desired = 2 + Math.floor(Math.random() * 2);
    const need = desired - rayCounts.get(ball);
    if (need <= 0) continue;
    const partners = targets
      .filter(b => b !== ball && rayCounts.get(b) < 3)
      .sort(() => Math.random() - 0.5)
      .sort((a, b) => rayCounts.get(a) - rayCounts.get(b))
      .slice(0, need);
    for (const other of partners) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1, 4),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false })
      );
      mesh.position.z = 0.3;
      scene.add(mesh);

      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 1, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
      );
      glow.position.z = 0.3;
      scene.add(glow);

      rays.push({ mesh, glow, ballA: ball, ballB: other });
      rayCounts.set(ball, rayCounts.get(ball) + 1);
      rayCounts.set(other, rayCounts.get(other) + 1);
    }
  }

  this.chromaticAnimations.push({
    targets, rays, timer: 0, duration: 1.0, colorIdx, exploded: false
  });
};

// ─── CHROMATIC ANIMATION (from track.js update loop) ───

Track.prototype.updateChromaticAnimations = function(dt) {
  for (let ci = this.chromaticAnimations.length - 1; ci >= 0; ci--) {
    const ca = this.chromaticAnimations[ci];
    ca.timer += dt;
    const t = ca.timer / ca.duration;

    if (!ca.exploded) {
      const pulse = 0.5 + 0.5 * Math.sin(ca.timer * 12);
      for (const ball of ca.targets) {
        if (ball.alive) ball.mesh.material.emissiveIntensity = 1 + 3 * pulse * Math.min(1, t / 0.4);
      }
    }

    for (const ray of ca.rays) {
      if (!ray.ballA.alive || !ray.ballB.alive) {
        ray.mesh.visible = false;
        ray.glow.visible = false;
        continue;
      }
      const posA = ray.ballA.mesh.position;
      const posB = ray.ballB.mesh.position;
      const dir = new THREE.Vector3().subVectors(posB, posA);
      const length = dir.length();
      if (length < 0.01) continue;

      const mid = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
      mid.z = 0.3;
      const dirNorm = dir.clone().normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirNorm);

      for (const m of [ray.mesh, ray.glow]) {
        m.position.copy(mid);
        m.scale.set(1, length, 1);
        m.quaternion.copy(quat);
      }

      if (t < 0.4) {
        const fadeIn = t / 0.4;
        ray.mesh.material.opacity = fadeIn * 0.9;
        ray.glow.material.opacity = fadeIn * 0.25;
      } else if (t < 0.7) {
        const pulse = 0.5 + 0.5 * Math.sin((t - 0.4) / 0.3 * Math.PI * 6);
        ray.mesh.material.opacity = 0.7 + 0.3 * pulse;
        ray.glow.material.opacity = 0.15 + 0.15 * pulse;
      }
    }

    if (t >= 0.7 && !ca.exploded) {
      ca.exploded = true;
      playSound('chromaticboom');
      let count = 0;
      let sumX = 0, sumY = 0, sumZ = 0;
      for (const ball of ca.targets) {
        if (!ball.alive) continue;
        sumX += ball.mesh.position.x;
        sumY += ball.mesh.position.y;
        sumZ += ball.mesh.position.z;
        if (ball.powerup) {
          const ptype = ball.powerup, ps = ball.s, pc = ball.colorIdx;
          removePowerupVisuals(ball);
          ball.powerup = null;
          this.activatePowerup(ptype, ps, pc);
        }
        explodeBall(ball);
        ball.alive = false;
        count++;
      }
      if (count > 0) {
        this.chain = this.chain.filter(b => b.alive);
        const pts = count * 15;
        score += pts;
        updateHUD();
        const centroid = new THREE.Vector3(sumX / count, sumY / count, sumZ / count);
        spawnScoreText(centroid, pts);
        if (this.chain.length > 1) {
          for (let i = 0; i < this.chain.length - 1; i++) {
            if (this.chain[i].s - this.chain[i + 1].s > BALL_SPACING * 1.1) {
              this.scheduleCollapse(i + 1);
            }
          }
        }
      }
    }

    if (t >= 0.7 && t < 1.0) {
      const fadeOut = 1 - (t - 0.7) / 0.3;
      for (const ray of ca.rays) {
        ray.mesh.material.opacity = Math.max(0, fadeOut * 0.9);
        ray.glow.material.opacity = Math.max(0, fadeOut * 0.25);
      }
    }

    if (t >= 1.0) {
      for (const ray of ca.rays) {
        scene.remove(ray.mesh); disposeMesh(ray.mesh);
        scene.remove(ray.glow); disposeMesh(ray.glow);
      }
      for (const ball of ca.targets) {
        if (ball.alive) ball.mesh.material.emissiveIntensity = 1;
      }
      this.chromaticAnimations.splice(ci, 1);
    }
  }
};
