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

    // ─── Audio timers ───
    this.dangerPulseTimer = 0;
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

  // Track visuals (createTrackVisuals, _createSkullEnd, _createPipeEntrance,
  // updateDangerVisuals, clearTrackVisuals) and bonus crystals (spawnBonusCrystal,
  // clearBonusCrystals) moved to scene.js as standalone functions

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
        if (gap.backBall.s > targetS + 0.01) {
          // Back segment pushed forward into front — push front segment forward
          gap.frontBall.s = gap.backBall.s + BALL_SPACING;
          for (let i = frontIdx - 1; i >= 0; i--) {
            const tgt = this.chain[i + 1].s + BALL_SPACING;
            if (this.chain[i].s < tgt) this.chain[i].s = tgt; else break;
          }
        } else {
          // Normal collapse — snap back ball forward to meet front
          gap.backBall.s = targetS;
          for (let i = backIdx + 1; i < this.chain.length; i++) {
            const tgt = this.chain[i - 1].s - BALL_SPACING;
            if (this.chain[i].s > tgt) this.chain[i].s = tgt; else break;
          }
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

  // Powerup methods (tickBallPowerups, tryAssignPowerup, clearAllPowerupVisuals,
  // activatePowerup, activateBlast, activateChromatic) moved to powerups.js

  // ─── COLLISION (from main.js) ───

  checkProjectileCollisions(dt) {
    for (let p = projectiles.length - 1; p >= 0; p--) {
      const proj = projectiles[p];
      if (!proj.alive) continue;
      proj.mesh.position.x += proj.vx * dt;
      proj.mesh.position.y += proj.vy * dt;

      const bound = 14 * (window.innerWidth / window.innerHeight) + 2;
      if (Math.abs(proj.mesh.position.x) > bound || Math.abs(proj.mesh.position.y) > 16) {
        playSound('miss');
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
        playSound('crystalfade');
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
        spawnBonusCrystal(this);
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
    updateDangerVisuals(this, dt);

    // Update chromatic ray animations (logic in powerups.js)
    this.updateChromaticAnimations(dt);

    // Track frontmost ball position
    if (this.chain.length > 0 && this.chain[0].s >= 0) this.lastFrontS = this.chain[0].s;
  }

  // ─── LEVEL MANAGEMENT ───

  loadLevelMulti(def, waypoints) {
    this.levelColors = def.colors;
    this.chainSpeed = def.chainSpeed;
    this.progressMax = def.progressThreshold;
    clearTrackVisuals(this);
    clearBonusCrystals(this);
    this.buildPath(waypoints);
    createTrackVisuals(this);
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

  // Returns true if chain reached the skull
  isGameOver() {
    return this.chain.length > 0 && this.chain[0].s >= this.pathLength * 0.98;
  }

  // Returns true if all balls cleared after spawning stopped
  isCleared() {
    return !this.levelClearing && this.spawningDone && !this.chain.some(b => b.s >= -2);
  }
}
