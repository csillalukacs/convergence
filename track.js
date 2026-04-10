// ═══════════════════════════════════════════════
//  Track — encapsulates all per-track state and logic
// ═══════════════════════════════════════════════
//
// Globals still used from outside:
//   scene, camera, clock          (Three.js core — from main.js)
//   score, updateHUD, showBanner  (scoring / HUD — from main.js)
//   playSound                     (audio.js)
//   COLORS, COLOR_EMISSIVE        (path.js constants)
//   BALL_RADIUS, BALL_SPACING     (path.js constants)
//   createBallMesh, explodeBall, spawnParticleBurst  (scene.js)
//   createPowerupSprite, createPowerupHalo, removePowerupVisuals (scene.js)
//   particles, shockwaves         (visual arrays — from main.js)
//   debugFastForward              (debug flag — from main.js)
//



// Score popup helpers referenced directly:
//   spawnScoreText, spawnGapBonusText, spawnComboText, spawnChainText

class Track {
  constructor() {
    // ─── Path state ───
    this.pathPoints = [];
    this.pathLength = 0;
    this.arcLengths = null;

    // ─── Chain state ───
    this.chain = [];
    this.gaps = [];
    this.pushForwards = [];
    this._nextGapId = 1;
    this.snapImpulses = [];
    this.chainTimeouts = [];

    // ─── Level config ───
    this.levelColors = 3;
    this.chainSpeed = 2.0;
    this.progressMax = 250;

    // ─── Dynamics / timers ───
    this.chainFreezeTimer = 0;
    this.powerupBackTimer = 0;
    this.rearSegmentPauseTimer = 0;
    this.rollBackTimer = 0;
    this.rollInSpawned = 0;
    this.lastFrontS = 0;
    this.levelClearing = false;

    // ─── Spawning / progress ───
    this.spawningDone = false;
    this.progress = 0;
    this.levelStartScore = 0;
    this.levelElapsedTime = 0;

    // ─── Scoring context ───
    this.combo = 1;
    this.chainBonus = 1;
    this.pendingGapBonus = false;

    // ─── Powerup timers ───
    this.pauseSpawnTimer = 15;
    this.backSpawnTimer = 20;
    this.blastSpawnTimer = 25;
    this.chromaticSpawnTimer = 30;

    // ─── Visuals owned by track ───
    this.chromaticAnimations = [];
    this.trackMeshes = [];
    this.vortexMeshes = null; // { outer, mid, inner, core, arms[] } for danger animation
    this.bonusCrystals = [];
    this.bonusCrystalSpawnTimer = 8.0;
  }

  // ─── PATH METHODS (from path.js) ───

  buildPath(waypoints) {
    const curve = new THREE.CatmullRomCurve3(
      waypoints.map(p => new THREE.Vector3(p.x, p.y, p.z ?? 0)),
      false, 'catmullrom', 0.5
    );
    this.pathPoints = [];
    const steps = 600;
    for (let i = 0; i <= steps; i++) {
      this.pathPoints.push(curve.getPoint(i / steps));
    }
    this.arcLengths = new Float64Array(this.pathPoints.length);
    this.arcLengths[0] = 0;
    for (let i = 1; i < this.pathPoints.length; i++) {
      this.arcLengths[i] = this.arcLengths[i - 1] + this.pathPoints[i].distanceTo(this.pathPoints[i - 1]);
    }
    this.pathLength = this.arcLengths[this.arcLengths.length - 1];
  }

  getPathPosFromS(s) {
    s = Math.max(0, Math.min(s, this.pathLength));
    let lo = 0, hi = this.arcLengths.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.arcLengths[mid] <= s) lo = mid; else hi = mid;
    }
    const segLen = this.arcLengths[hi] - this.arcLengths[lo];
    const frac = segLen > 0 ? (s - this.arcLengths[lo]) / segLen : 0;
    return new THREE.Vector3().lerpVectors(this.pathPoints[lo], this.pathPoints[hi], frac);
  }

  getClosestPathS(px, py) {
    let bestDist2 = Infinity, bestS = 0;
    for (let i = 0; i < this.pathPoints.length; i++) {
      const dx = this.pathPoints[i].x - px;
      const dy = this.pathPoints[i].y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) { bestDist2 = d2; bestS = this.arcLengths[i]; }
    }
    return { s: bestS, dist: Math.sqrt(bestDist2) };
  }

  getPathTangentFromS(s) {
    const eps = 0.5;
    const p1 = this.getPathPosFromS(Math.max(0, s - eps));
    const p2 = this.getPathPosFromS(Math.min(this.pathLength, s + eps));
    return new THREE.Vector3().subVectors(p2, p1).normalize();
  }

  // ─── TRACK VISUALS (from scene.js) ───

  createTrackVisuals() {
    const curve = new THREE.CatmullRomCurve3(this.pathPoints);
    const t1 = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.15, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.1, roughness: 0.0, emissive: 0x224466, transparent: true, opacity: 0.30 }));
    t1.position.z = -0.3; scene.add(t1); this.trackMeshes.push(t1);
    const t2 = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.05, 6, false),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.0, roughness: 0.0, emissive: 0x99ddff }));
    t2.position.z = -0.25; scene.add(t2); this.trackMeshes.push(t2);

    this._createPipeEntrance();
    this._createSkullEnd();
  }

  _createSkullEnd() {
    const ep = this.getPathPosFromS(this.pathLength);
    const add = m => { scene.add(m); this.trackMeshes.push(m); };

    // Void Vortex — concentric purple rings with spiral arms and dark core
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 12, 24),
      new THREE.MeshStandardMaterial({ color: 0x220033, metalness: 0.9, roughness: 0.1, emissive: 0x440066 }));
    outer.position.copy(ep); outer.position.z = -0.1; add(outer);
    const mid = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x8800aa, metalness: 0.7, roughness: 0.1, emissive: 0x660088 }));
    mid.position.copy(ep); mid.position.z = -0.05; add(mid);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xcc44ff, metalness: 0.5, roughness: 0.0, emissive: 0xaa22dd }));
    inner.position.copy(ep); add(inner);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 1.0, roughness: 0.0, emissive: 0x110022 }));
    core.position.copy(ep); core.position.z = 0.05; add(core);
    const arms = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const arm = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x8800cc, emissive: 0x440066, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      arm.position.copy(ep);
      arm.position.x += Math.cos(a) * 0.3; arm.position.y += Math.sin(a) * 0.3; arm.position.z = 0.02;
      arm.rotation.z = a + 0.4; add(arm);
      arms.push(arm);
    }
    this.vortexMeshes = { outer, mid, inner, core, arms };
  }

  _updateDangerVisuals(dt) {
    const v = this.vortexMeshes;
    if (!v) return;

    // Danger ratio: 0 = safe, 1 = about to die
    const frontS = this.chain.length > 0 && this.chain[0].s >= 0 ? this.chain[0].s : 0;
    const dangerStart = this.pathLength * 0.55;
    const danger = Math.max(0, Math.min(1, (frontS - dangerStart) / (this.pathLength * 0.43)));

    const t = clock.elapsedTime;
    const pulseSpeed = 3 + danger * 9; // faster pulse when closer
    const pulse = 0.5 + 0.5 * Math.sin(t * pulseSpeed);

    // Vortex rings: shift from purple toward red, scale up, pulse emissive
    const rLerp = danger; // 0 = purple palette, 1 = red palette
    const outerEmR = 0x44 + Math.round(0xbb * rLerp);
    const outerEmG = Math.round(0x00 * (1 - rLerp) + 0x00 * rLerp);
    const outerEmB = Math.round(0x66 * (1 - rLerp));
    v.outer.material.emissive.setRGB(outerEmR / 255, outerEmG / 255, outerEmB / 255);
    v.outer.material.emissiveIntensity = 1 + danger * 2 * pulse;
    v.outer.scale.setScalar(1 + danger * 0.15 * pulse);

    v.mid.material.emissive.setRGB(
      (0x66 + 0x99 * rLerp) / 255,
      0x00,
      (0x88 * (1 - rLerp)) / 255
    );
    v.mid.material.emissiveIntensity = 1 + danger * 2.5 * pulse;
    v.mid.scale.setScalar(1 + danger * 0.1 * pulse);

    v.inner.material.emissive.setRGB(
      (0xaa + 0x55 * rLerp) / 255,
      (0x22 * (1 - rLerp)) / 255,
      (0xdd * (1 - rLerp)) / 255
    );
    v.inner.material.emissiveIntensity = 1 + danger * 3 * pulse;

    // Core glows red-hot at max danger
    v.core.material.emissive.setRGB(
      (0x11 + 0xcc * danger) / 255,
      0,
      (0x22 * (1 - danger)) / 255
    );
    v.core.material.emissiveIntensity = 1 + danger * 4 * pulse;

    // Spin arms faster as danger increases
    const spinDelta = dt * (0.3 + danger * 2.5);
    for (const arm of v.arms) {
      arm.rotation.z += spinDelta;
      arm.material.opacity = 0.6 + danger * 0.4 * pulse;
      arm.material.emissive.setRGB(
        (0x44 + 0xbb * rLerp) / 255,
        0,
        (0x66 * (1 - rLerp)) / 255
      );
    }

    // Tint balls in the danger zone (last 30% of path) with red emissive boost
    const dangerZoneS = this.pathLength * 0.70;
    for (let i = 0; i < this.chain.length; i++) {
      const ball = this.chain[i];
      if (!ball.alive || ball.s < 0) continue;
      if (ball.s > dangerZoneS) {
        const ballDanger = (ball.s - dangerZoneS) / (this.pathLength * 0.30);
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

  _createPipeEntrance() {
    const startPos = this.getPathPosFromS(0);
    const tangent = this.getPathTangentFromS(0);
    const add = m => { scene.add(m); this.trackMeshes.push(m); };

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
      new THREE.MeshStandardMaterial({ color: 0x1a2244, metalness: 0.8, roughness: 0.05, emissive: 0x112244, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
    );
    conduit.position.copy(pipeCenter); conduit.quaternion.copy(quatCyl); add(conduit);

    // Inner energy flow (bright core tube)
    const flow = new THREE.Mesh(
      new THREE.CylinderGeometry(PIPE_RADIUS * 0.6, PIPE_RADIUS * 0.6, PIPE_LENGTH, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.0, roughness: 0.0, emissive: 0x336699, emissiveIntensity: 0.8, transparent: true, opacity: 0.15, side: THREE.BackSide })
    );
    flow.position.copy(pipeCenter); flow.quaternion.copy(quatCyl); add(flow);

    // Arcane rings spaced along the conduit
    const ringCount = 5;
    for (let i = 0; i < ringCount; i++) {
      const t = i / (ringCount - 1); // 0..1 along pipe
      const offset = PIPE_OVERHANG - t * PIPE_LENGTH;
      const rPos = startPos.clone().addScaledVector(tangent, offset);
      rPos.z = -0.05;

      const isMouth = i === 0; // mouth ring is brightest
      const radius = PIPE_RADIUS + (isMouth ? 0.05 : -0.02);
      const thickness = isMouth ? 0.08 : 0.04;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, thickness, 8, 20),
        new THREE.MeshStandardMaterial({
          color: isMouth ? 0xaaddff : 0x6688aa,
          metalness: 0.9, roughness: 0.0,
          emissive: isMouth ? 0x4488bb : 0x223355,
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
        new THREE.MeshStandardMaterial({ color: 0xaaddff, metalness: 0.5, roughness: 0.0, emissive: 0x4488cc, emissiveIntensity: 1.5 }));
      rune.position.copy(mouthPos).addScaledVector(perp, side * (PIPE_RADIUS + 0.25));
      rune.position.z = 0.05;
      add(rune);
    }
  }

  clearTrackVisuals() {
    this.trackMeshes.forEach(m => {
      scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
    this.trackMeshes = [];
    this.vortexMeshes = null;
  }

  // ─── BONUS CRYSTALS (from scene.js) ───

  spawnBonusCrystal() {
    const s = this.pathLength * (0.15 + Math.random() * 0.70);
    const pos = this.getPathPosFromS(s);
    const tan = this.getPathTangentFromS(s);
    const side = Math.random() < 0.5 ? 1 : -1;
    const OFFSET = 0.8 + Math.random() * 0.6;
    const nx = -tan.y * side * OFFSET;
    const ny =  tan.x * side * OFFSET;
    const phase = Math.random() * Math.PI * 2;

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62, 0),
      new THREE.MeshStandardMaterial({
        color: 0xFFFFCC, emissive: 0xFFCC00, emissiveIntensity: 2.5,
        metalness: 0.3, roughness: 0.0
      })
    );
    const mid = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.92, 1),
      new THREE.MeshStandardMaterial({
        color: 0xFFAA00, emissive: 0xFF8800, emissiveIntensity: 1.0,
        metalness: 0.0, roughness: 0.0, transparent: true, opacity: 0.38, side: THREE.DoubleSide
      })
    );
    const cage = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.15, 0),
      new THREE.MeshBasicMaterial({ color: 0xFFEE44, transparent: true, opacity: 0.55, wireframe: true })
    );
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xFFCC00, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    );

    const group = new THREE.Group();
    group.add(core, mid, cage, glow);
    group.position.set(pos.x + nx, pos.y + ny, -1.8);
    group.userData = { phase, core, cage, mid, glow };

    scene.add(group);
    this.bonusCrystals.push({ mesh: group, alive: true, life: 9.0 });
  }

  clearBonusCrystals() {
    this.bonusCrystals.forEach(c => {
      scene.remove(c.mesh);
      // Dispose children (core, mid, cage, glow) inside the Group
      c.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    this.bonusCrystals = [];
  }

  // ─── CHAIN METHODS (from chain.js) ───

  cancelChainReactions() {
    this.chainTimeouts.forEach(clearTimeout);
    this.chainTimeouts = [];
  }

  getSegmentBounds(idx, skipGap = null, checkPushForwards = false) {
    let start = idx, end = idx;
    for (let i = idx - 1; i >= 0; i--) {
      const gapHere = this.gaps.some(cg => {
        if (cg === skipGap) return false;
        const fi = this.chain.indexOf(cg.frontBall);
        const bi = this.chain.indexOf(cg.backBall);
        return fi === i && bi === i + 1;
      }) || (checkPushForwards && this.pushForwards.some(pf => {
        const ii = this.chain.indexOf(pf.insertedBall);
        return ii === i + 1;
      }));
      if (gapHere) break;
      start = i;
    }
    for (let i = idx + 1; i < this.chain.length; i++) {
      const gapHere = this.gaps.some(cg => {
        if (cg === skipGap) return false;
        const fi = this.chain.indexOf(cg.frontBall);
        const bi = this.chain.indexOf(cg.backBall);
        return fi === i - 1 && bi === i;
      }) || (checkPushForwards && this.pushForwards.some(pf => {
        const ii = this.chain.indexOf(pf.insertedBall);
        return ii === i;
      }));
      if (gapHere) break;
      end = i;
    }
    return { start, end };
  }

  pickColor() {
    if (this.spawningDone && this.chain.length > 0) {
      const present = [...new Set(this.chain.map(b => b.colorIdx))];
      if (present.length > 0) return present[Math.floor(Math.random() * present.length)];
    }
    return Math.floor(Math.random() * this.levelColors);
  }

  spawnChainBall() {
    const colorIdx = this.pickColor();
    const mesh = createBallMesh(colorIdx);
    scene.add(mesh);
    let startS = -BALL_SPACING;
    if (this.chain.length > 0) startS = this.chain[this.chain.length - 1].s - BALL_SPACING;
    this.chain.push({ mesh, colorIdx, s: startS, alive: true });
  }

  insertBallInChain(insertIdx, colorIdx, hitBallIdx = -1) {
    const mesh = createBallMesh(colorIdx);
    scene.add(mesh);

    let splitGap = null;
    let splitCase = null;
    for (let gi = 0; gi < this.gaps.length; gi++) {
      const cg = this.gaps[gi];
      const fi = this.chain.indexOf(cg.frontBall);
      const bi = this.chain.indexOf(cg.backBall);
      if (bi !== fi + 1 || insertIdx !== bi) continue;
      if (hitBallIdx === fi) { splitGap = cg; splitCase = 'A'; }
      else if (hitBallIdx === bi) { splitGap = cg; splitCase = 'B'; }
      break;
    }

    let refS;
    if (splitCase === 'A') {
      refS = splitGap.frontBall.s - BALL_SPACING;
    } else if (insertIdx < this.chain.length) {
      refS = this.chain[insertIdx].s;
    } else if (this.chain.length > 0) {
      refS = this.chain[this.chain.length - 1].s;
    } else {
      refS = 0;
    }

    const newBall = { mesh, colorIdx, s: refS, alive: true };
    const pos = this.getPathPosFromS(refS);
    mesh.position.copy(pos);

    if (splitCase === 'A') {
      splitGap.frontBall = newBall;
      splitGap.matching = colorIdx === splitGap.backBall.colorIdx;
    } else if (splitCase === 'B') {
      splitGap.backBall = newBall;
      splitGap.matching = splitGap.frontBall.colorIdx === colorIdx;
    }

    this.chain.splice(insertIdx, 0, newBall);

    if (insertIdx > 0 && splitGap === null) {
      this.pushForwards.push({ insertedBall: newBall, frontBall: this.chain[insertIdx - 1] });
    }

    if (insertIdx < this.chain.length - 1) {
      const maxS = this.chain[insertIdx + 1].s + BALL_SPACING;
      if (newBall.s < maxS) {
        newBall.s = maxS;
      }
    }
  }

  hasGapBetween(frontIdx, backIdx) {
    return this.chain[frontIdx].s - this.chain[backIdx].s > BALL_SPACING * 1.1;
  }

  checkMatches(idx, fromChainReaction = false) {
    if (idx < 0 || idx >= this.chain.length) return;
    const col = this.chain[idx].colorIdx;
    let start = idx, end = idx;
    while (start > 0 && this.chain[start - 1].colorIdx === col && !this.hasGapBetween(start - 1, start)) start--;
    while (end < this.chain.length - 1 && this.chain[end + 1].colorIdx === col && !this.hasGapBetween(end, end + 1)) end++;

    if (!fromChainReaction) this.combo = 1;

    const count = end - start + 1;
    if (count >= 3) {
      const midIdx = Math.floor((start + end) / 2);
      const midPos = this.chain[midIdx] ? this.getPathPosFromS(this.chain[midIdx].s) : new THREE.Vector3();

      if (fromChainReaction) this.combo++;

      const triggeredPowerups = [];
      for (let i = start; i <= end; i++) {
        if (this.chain[i].powerup) {
          triggeredPowerups.push({ type: this.chain[i].powerup, s: this.chain[i].s, colorIdx: col });
          removePowerupVisuals(this.chain[i]);
          this.chain[i].powerup = null;
        }
      }

      let preLastSplit = -1;
      for (const g of this.gaps) {
        const bi = this.chain.indexOf(g.backBall);
        if (bi > preLastSplit) preLastSplit = bi;
      }
      const rearmostSegmentBalls = preLastSplit >= 0 ? this.chain.slice(preLastSplit) : [];
      const ballAheadOfRearmost = preLastSplit > 0 ? this.chain[preLastSplit - 1] : null;

      const hasChromatic = triggeredPowerups.some(pw => pw.type === 'chromatic');
      const matchedBalls = [];
      for (let i = start; i <= end; i++) matchedBalls.push(this.chain[i]);

      playSound('match', this.combo);
      if (!hasChromatic) {
        for (const b of matchedBalls) {
          explodeBall(b);
          b.alive = false;
        }
      }
      this.chain = this.chain.filter(b => b.alive || (hasChromatic && matchedBalls.includes(b)));

      if (rearmostSegmentBalls.length > 0 && rearmostSegmentBalls.every(b => !b.alive)) {
        const gapSize = ballAheadOfRearmost
          ? ballAheadOfRearmost.s - rearmostSegmentBalls[0].s
          : 0;
        this.rearSegmentPauseTimer = Math.min(gapSize * 0.04, 1.2);
      }

      for (const pw of triggeredPowerups) {
        if (pw.type === 'chromatic') {
          this.activateChromatic(pw.colorIdx, matchedBalls);
        } else {
          this.activatePowerup(pw.type, pw.s, pw.colorIdx);
        }
      }
      const gapMult = (this.pendingGapBonus && !fromChainReaction) ? 10 : 1;
      const matchScore = (count * 10 * this.combo * gapMult + (this.chainBonus > 1 ? this.chainBonus * 10 : 0));

      if (this.pendingGapBonus && !fromChainReaction) {
        this.pendingGapBonus = false;
        playSound('gapbonus');
        spawnGapBonusText(midPos, matchScore);
      } else if (fromChainReaction) {
        spawnComboText(midPos, this.combo, matchScore);
      } else if (this.chainBonus > 1) {
        spawnChainText(midPos, this.chainBonus, matchScore);
      } else {
        spawnScoreText(midPos, matchScore);
      }
      score += matchScore;
      if (!fromChainReaction) this.chainBonus++;
      updateHUD();

      if (start > 0 && start < this.chain.length) {
        this.scheduleCollapse(start);
      }
    } else {
      this.combo = 1;
      if (!fromChainReaction) { this.chainBonus = 1; this.pendingGapBonus = false; }
      updateHUD();
    }
  }

  scheduleCollapse(gapFrontIdx) {
    const frontBall = this.chain[gapFrontIdx - 1];
    const backBall = this.chain[gapFrontIdx];
    if (!frontBall || !backBall) return;
    if (this.gaps.some(g => g.frontBall === frontBall && g.backBall === backBall)) return;
    const matching = frontBall.colorIdx === backBall.colorIdx;
    const initialGapSize = frontBall.s - backBall.s - BALL_SPACING;
    this.gaps.push({ id: this._nextGapId++, frontBall, backBall, matching, initialGapSize });
  }

  updatePushForwards(dt) {
    if (this.pushForwards.length === 0) return;

    for (let g = this.pushForwards.length - 1; g >= 0; g--) {
      const pf = this.pushForwards[g];
      const insertedIdx = this.chain.indexOf(pf.insertedBall);
      const frontIdx = this.chain.indexOf(pf.frontBall);

      if (insertedIdx < 0 || frontIdx < 0 || frontIdx >= insertedIdx) {
        this.pushForwards.splice(g, 1); continue;
      }

      const targetS = pf.insertedBall.s + BALL_SPACING;
      const currentOverlap = targetS - pf.frontBall.s;

      if (currentOverlap <= 0.02) {
        pf.frontBall.s = targetS;
        const { start: propStart } = this.getSegmentBounds(frontIdx);
        for (let i = frontIdx - 1; i >= propStart; i--) {
          const tgt = this.chain[i + 1].s + BALL_SPACING;
          if (this.chain[i].s < tgt) this.chain[i].s = tgt; else break;
        }
        this.pushForwards.splice(g, 1);
      } else {
        const pushSpeed = 30;
        const move = Math.min(pushSpeed * dt, currentOverlap);
        const { start: pushStart } = this.getSegmentBounds(frontIdx);
        for (let i = pushStart; i <= frontIdx; i++) this.chain[i].s += move;
      }
    }
  }

  updateCollapses(dt) {
    if (this.gaps.length === 0) return;

    for (let g = this.gaps.length - 1; g >= 0; g--) {
      const gap = this.gaps[g];
      const frontIdx = this.chain.indexOf(gap.frontBall);
      const backIdx = this.chain.indexOf(gap.backBall);

      if (frontIdx < 0 || backIdx < 0 || backIdx !== frontIdx + 1) {
        this.gaps.splice(g, 1); continue;
      }

      const targetS = gap.frontBall.s - BALL_SPACING;
      const currentGap = targetS - gap.backBall.s;

      if (currentGap <= 0.05) {
        gap.backBall.s = targetS;
        for (let i = backIdx + 1; i < this.chain.length; i++) {
          const tgt = this.chain[i - 1].s - BALL_SPACING;
          if (this.chain[i].s > tgt) this.chain[i].s = tgt; else break;
        }
        this.gaps.splice(g, 1);

        if (gap.matching) {
          const impulse = Math.min(gap.initialGapSize * 1.2, 8.0);
          this.snapImpulses.push({ frontBall: gap.frontBall, impulse });
        }

        if (gap.frontBall.colorIdx === gap.backBall.colorIdx) {
          const checkIdx = backIdx;
          const tid = setTimeout(() => {
            this.chainTimeouts = this.chainTimeouts.filter(t => t !== tid);
            if (this.chain.length > 0) {
              playSound('chain', this.combo);
              this.checkMatches(Math.min(checkIdx, this.chain.length - 1), true);
            }
          }, 100);
          this.chainTimeouts.push(tid);
        } else {
          this.combo = 1;
          updateHUD();
        }
      } else if (gap.matching) {
        const { start: moveStart } = this.getSegmentBounds(frontIdx, gap);
        const collapseSpeed = 25;
        const move = Math.min(collapseSpeed * dt, currentGap);
        for (let i = moveStart; i <= frontIdx; i++) this.chain[i].s -= move;
      }
    }
  }

  updateSnapImpulses(dt) {
    const SNAP_FRICTION = 5.0;
    for (let g = this.snapImpulses.length - 1; g >= 0; g--) {
      const si = this.snapImpulses[g];
      si.impulse = Math.max(0, si.impulse - SNAP_FRICTION * dt);
      if (si.impulse <= 0) { this.snapImpulses.splice(g, 1); continue; }

      const anchorIdx = this.chain.indexOf(si.frontBall);
      if (anchorIdx < 0) { this.snapImpulses.splice(g, 1); continue; }

      const { start: segStart, end: segEnd } = this.getSegmentBounds(anchorIdx);
      for (let i = segStart; i <= segEnd; i++) this.chain[i].s -= si.impulse * dt;
    }
  }

  // Scan for physical gaps that aren't tracked by any gap or pushForward entry.
  // These "orphan gaps" can arise when a gap entry is invalidated (e.g., a ball
  // inserted between frontBall/backBall) but the physical distance persists.
  healOrphanGaps() {
    if (this.chain.length < 2) return;
    for (let i = 0; i < this.chain.length - 1; i++) {
      const dist = this.chain[i].s - this.chain[i + 1].s;
      if (dist <= BALL_SPACING * 1.1) continue; // no physical gap here

      // Check if already tracked by a gap entry
      const front = this.chain[i], back = this.chain[i + 1];
      const tracked = this.gaps.some(g => g.frontBall === front && g.backBall === back);
      if (tracked) continue;

      // Check if a pushForward covers this boundary (ball still being pushed in)
      const pushing = this.pushForwards.some(pf => {
        const ii = this.chain.indexOf(pf.insertedBall);
        return ii === i + 1;
      });
      if (pushing) continue;

      // Orphan gap found — schedule a collapse so it closes properly
      this.scheduleCollapse(i + 1);
    }
  }

  // ─── POWERUP METHODS (from main.js) ───

  tickBallPowerups(dt) {
    for (const ball of this.chain) {
      if (!ball.powerup) continue;
      ball.powerupTimer -= dt;
      if (ball.powerupTimer <= 0) {
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
  }

  tryAssignPowerup(type) {
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
  }

  clearAllPowerupVisuals() {
    for (const ball of this.chain) {
      if (ball.powerup) removePowerupVisuals(ball);
    }
  }

  activatePowerup(type, s = 0, colorIdx = -1) {
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
  }

  activateBlast(s) {
    const BLAST_RADIUS = BALL_SPACING * 3;
    const blastPos = this.getPathPosFromS(s);
    showBanner('NOVA BLAST!');
    playSound('powerup');

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
  }

  activateChromatic(colorIdx, sourceBalls = []) {
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
  }

  // ─── COLLISION (from main.js) ───

  checkProjectileCollisions(dt) {
    for (let p = projectiles.length - 1; p >= 0; p--) {
      const proj = projectiles[p];
      if (!proj.alive) continue;
      proj.mesh.position.x += proj.vx * dt;
      proj.mesh.position.y += proj.vy * dt;

      const bound = 14 * (window.innerWidth / window.innerHeight) + 2;
      if (Math.abs(proj.mesh.position.x) > bound || Math.abs(proj.mesh.position.y) > 16) {
        scene.remove(proj.mesh); disposeMesh(proj.mesh); proj.alive = false; continue;
      }

      // Gap-crossing detection
      if (!proj.gapBonus) {
        const { s: closestS, dist: closestDist } = this.getClosestPathS(proj.mesh.position.x, proj.mesh.position.y);
        if (closestDist < BALL_RADIUS * 1.5) {
          for (let gi = 0; gi < this.chain.length - 1; gi++) {
            if (this.chain[gi].s - this.chain[gi + 1].s > BALL_SPACING * 1.5 &&
                closestS > this.chain[gi + 1].s && closestS < this.chain[gi].s) {
              proj.gapBonus = true;
              break;
            }
          }
        }
      }

      for (let i = 0; i < this.chain.length; i++) {
        const ball = this.chain[i];
        if (!ball.alive) continue;
        const dx = proj.mesh.position.x - ball.mesh.position.x;
        const dy = proj.mesh.position.y - ball.mesh.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < BALL_RADIUS * 2.1) {
          const tangent = this.getPathTangentFromS(ball.s);
          const dot = tangent.x * dx / dist + tangent.y * dy / dist;
          const insertIdx = dot > 0 ? i : i + 1;

          scene.remove(proj.mesh); disposeMesh(proj.mesh); proj.alive = false;
          this.pendingGapBonus = proj.gapBonus;
          playSound('hit');
          this.insertBallInChain(insertIdx, proj.colorIdx, i);
          this.checkMatches(insertIdx);
          break;
        }
      }

      // Bonus crystal pickup
      if (proj.alive) {
        for (let ci = this.bonusCrystals.length - 1; ci >= 0; ci--) {
          const c = this.bonusCrystals[ci];
          if (!c.alive) continue;
          const dx = proj.mesh.position.x - c.mesh.position.x;
          const dy = proj.mesh.position.y - c.mesh.position.y;
          if (dx * dx + dy * dy < (BALL_RADIUS + 1.0) * (BALL_RADIUS + 1.0)) {
            c.alive = false;
            scene.remove(c.mesh);
            c.mesh.traverse(child => { if (child.geometry) child.geometry.dispose(); if (child.material) child.material.dispose(); });
            this.bonusCrystals.splice(ci, 1);
            this.bonusCrystalSpawnTimer = 14.0; // BONUS_CRYSTAL_INTERVAL
            scene.remove(proj.mesh); disposeMesh(proj.mesh); proj.alive = false;
            playSound('crystal');
            score += 500;
            updateHUD();
            spawnScoreText(c.mesh.position.clone(), 500);
            spawnParticleBurst(c.mesh.position, 14, 0xFFDD00, { minSize: 0.07, maxSize: 0.14, minSpeed: 2, maxSpeed: 7, decay: 0.020 });
            break;
          }
        }
      }
    }
    projectiles = projectiles.filter(p => p.alive);
  }

  // ─── MAIN UPDATE (extracted from animate()) ───

  update(dt) {
    if (!this.levelClearing) this.levelElapsedTime += dt;

    // Animate bonus crystals
    for (let ci = this.bonusCrystals.length - 1; ci >= 0; ci--) {
      const c = this.bonusCrystals[ci];
      if (!c.alive) continue;
      c.life -= dt;
      if (c.life <= 0) {
        scene.remove(c.mesh);
        c.mesh.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.bonusCrystals.splice(ci, 1);
        continue;
      }
      const phase = c.mesh.userData.phase;
      const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3 + phase);
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

    // Bonus crystal spawning
    if (!this.levelClearing) {
      this.bonusCrystalSpawnTimer -= dt;
      if (this.bonusCrystalSpawnTimer <= 0 && this.bonusCrystals.filter(c => c.alive).length === 0) {
        this.spawnBonusCrystal();
        this.bonusCrystalSpawnTimer = 14.0; // BONUS_CRYSTAL_INTERVAL
      }
    }

    if (!this.levelClearing) {
      // Spawn at back of chain
      const fillFraction = tracks.length > 1 ? 0.25 : 0.5;
      const maxTrackBalls = Math.floor((this.pathLength * fillFraction) / BALL_SPACING);
      const rollInLimit = Math.min(40, maxTrackBalls);
      const rollingIn = this.rollInSpawned < rollInLimit;
      if (!this.spawningDone) {
        while (this.chain.length === 0 || this.chain[this.chain.length - 1].s > -BALL_SPACING) {
          this.spawnChainBall();
          this.rollInSpawned++;
        }
      }

      // Advance chain
      if (this.rollBackTimer > 0) {
        this.rollBackTimer = Math.max(0, this.rollBackTimer - dt);
        for (let i = 0; i < this.chain.length; i++) this.chain[i].s -= 3.0 * dt; // ROLL_BACK_SPEED
      } else if (this.powerupBackTimer > 0) {
        this.powerupBackTimer = Math.max(0, this.powerupBackTimer - dt);
        for (let i = 0; i < this.chain.length; i++) this.chain[i].s -= 3.0 * dt; // ROLL_BACK_SPEED
      } else if (this.chainFreezeTimer > 0) {
        this.chainFreezeTimer = Math.max(0, this.chainFreezeTimer - dt);
      } else if (this.rearSegmentPauseTimer > 0) {
        this.rearSegmentPauseTimer = Math.max(0, this.rearSegmentPauseTimer - dt);
      } else if (this.chain.length > 0) {
        const activeSpeed = (rollingIn ? 16.0 : this.chainSpeed) * (typeof debugFastForward !== 'undefined' && debugFastForward ? 5 : 1); // ROLL_IN_SPEED
        const splitIndices = new Set();

        for (const g of this.gaps) {
          const bi = this.chain.indexOf(g.backBall);
          if (bi > 0) splitIndices.add(bi);
        }
        for (const p of this.pushForwards) {
          const ii = this.chain.indexOf(p.insertedBall);
          if (ii > 0) splitIndices.add(ii);
        }

        if (splitIndices.size === 0) {
          for (let i = 0; i < this.chain.length; i++) {
            this.chain[i].s += activeSpeed * dt;
          }
          for (let i = 1; i < this.chain.length; i++) {
            const tgt = this.chain[i - 1].s - BALL_SPACING;
            if (this.chain[i].s > tgt) this.chain[i].s = tgt;
          }
        } else {
          const sorted = [...splitIndices].sort((a, b) => a - b);
          const lastSplit = sorted[sorted.length - 1];

          for (let i = lastSplit; i < this.chain.length; i++) {
            this.chain[i].s += activeSpeed * dt;
          }
          for (let i = lastSplit + 1; i < this.chain.length; i++) {
            const tgt = this.chain[i - 1].s - BALL_SPACING;
            if (this.chain[i].s > tgt) this.chain[i].s = tgt;
          }

          let segStart = 0;
          for (const split of sorted) {
            for (let i = segStart + 1; i < split; i++) {
              const tgt = this.chain[i - 1].s - BALL_SPACING;
              if (this.chain[i].s > tgt) this.chain[i].s = tgt;
            }
            segStart = split;
          }
        }
      }

      this.updateCollapses(dt);
      this.updatePushForwards(dt);
      this.healOrphanGaps();
      this.tickBallPowerups(dt);

      if (!this.spawningDone) {
        this.pauseSpawnTimer -= dt;
        if (this.pauseSpawnTimer <= 0) {
          this.tryAssignPowerup('pause');
          this.pauseSpawnTimer = 15; // PAUSE_SPAWN_INTERVAL
        }
        this.backSpawnTimer -= dt;
        if (this.backSpawnTimer <= 0) {
          this.tryAssignPowerup('backwards');
          this.backSpawnTimer = 18; // BACK_SPAWN_INTERVAL
        }
        this.blastSpawnTimer -= dt;
        if (this.blastSpawnTimer <= 0) {
          this.tryAssignPowerup('blast');
          this.blastSpawnTimer = 22; // BLAST_SPAWN_INTERVAL
        }
        this.chromaticSpawnTimer -= dt;
        if (this.chromaticSpawnTimer <= 0) {
          this.tryAssignPowerup('chromatic');
          this.chromaticSpawnTimer = 28; // CHROMATIC_SPAWN_INTERVAL
        }
      }

      this.updateSnapImpulses(dt);
    }

    // Update ball positions (always — even during levelClearing for visual continuity)
    for (let i = 0; i < this.chain.length; i++) {
      const ball = this.chain[i];
      ball.mesh.visible = ball.s >= 0;
      if (!ball.mesh.visible) continue;
      const pos = this.getPathPosFromS(ball.s);
      ball.mesh.position.copy(pos);
      ball.mesh.rotation.z += dt * 1.5;
      ball.mesh.rotation.x += dt * 0.8;
    }

    // ─── Danger zone: vortex + ball visual feedback ───
    this._updateDangerVisuals(dt);

    // Update chromatic ray animations
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

    // Track frontmost ball position
    if (this.chain.length > 0 && this.chain[0].s >= 0) this.lastFrontS = this.chain[0].s;
  }

  // ─── LEVEL MANAGEMENT ───

  loadLevel(def) {
    const map = MAPS[def.map];
    const waypoints = map.tracks ? map.tracks[0].waypoints : map.waypoints;
    this.loadLevelMulti(def, waypoints);
  }

  loadLevelMulti(def, waypoints) {
    this.levelColors = def.colors;
    this.chainSpeed = def.chainSpeed;
    this.progressMax = def.progressThreshold;
    this.clearTrackVisuals();
    this.clearBonusCrystals();
    this.buildPath(waypoints);
    this.createTrackVisuals();
  }

  resetState() {
    this.cancelChainReactions();
    this.clearAllPowerupVisuals();
    this.chain.forEach(b => { scene.remove(b.mesh); disposeMesh(b.mesh); });
    this.chain = [];
    this.gaps = [];
    this.pushForwards = [];
    this.snapImpulses = [];
    this.chromaticAnimations.forEach(ca => ca.rays.forEach(r => {
      scene.remove(r.mesh); disposeMesh(r.mesh);
      scene.remove(r.glow); disposeMesh(r.glow);
    }));
    this.chromaticAnimations = [];

    this.progress = 0;
    this.combo = 1;
    this.chainBonus = 1;
    this.spawningDone = false;
    this.rollBackTimer = 0;
    this.rollInSpawned = 0;
    this.levelClearing = false;
    this.chainFreezeTimer = 0;
    this.powerupBackTimer = 0;
    this.rearSegmentPauseTimer = 0;
    this.pauseSpawnTimer = 15;
    this.backSpawnTimer = 20;
    this.blastSpawnTimer = 25;
    this.chromaticSpawnTimer = 30;
    this.bonusCrystalSpawnTimer = 8.0;
    this.lastFrontS = 0;
    this.pendingGapBonus = false;
    this.levelElapsedTime = 0;
  }

  reset(levelDef) {
    this.resetState();
    this.loadLevel(levelDef);
  }

  // Returns true if chain reached the skull
  isGameOver() {
    return this.chain.length > 0 && this.chain[0].s >= this.pathLength * 0.98;
  }

  // Returns true if all balls cleared after spawning stopped
  isCleared() {
    return !this.levelClearing && this.spawningDone && !this.chain.some(b => b.s >= -2);
  }
}
