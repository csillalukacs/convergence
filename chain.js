// ─── CHAIN STATE ───

let chain = [];
let gaps = [];

// Pending push-forwards: front segments that need to slide forward after ball insertion.
// Tracked by ball references so indices don't go stale.
let pushForwards = []; // { insertedBall, frontBall } — everything ahead of insertedBall pushes forward

function spawnChainBall() {
  const colorIdx = pickColor();
  const mesh = createBallMesh(colorIdx);
  scene.add(mesh);
  let startS = -BALL_SPACING;
  if (chain.length > 0) startS = chain[chain.length - 1].s - BALL_SPACING;
  chain.push({ mesh, colorIdx, s: startS, alive: true });
}

// hitBallIdx: the chain index of the ball the projectile physically collided
// with (chain[i] at the call site). Used to determine which side of a
// collapsing gap the new ball joins when insertIdx falls between frontBall and
// backBall.
function insertBallInChain(insertIdx, colorIdx, hitBallIdx = -1) {
  const mesh = createBallMesh(colorIdx);
  scene.add(mesh);

  // Detect whether insertIdx splits an existing collapsing gap, and which side:
  //   Case A — hit frontBall from behind (hitBallIdx === fi):
  //     newBall joins front segment, placed just behind frontBall.
  //     Gap becomes newBall → originalBackBall.
  //   Case B — hit backBall from front (hitBallIdx === bi):
  //     newBall joins back segment, placed at backBall's position.
  //     Gap becomes originalFrontBall → newBall.
  // In both cases the pushForward is suppressed: the new ball is already
  // correctly positioned relative to its front neighbor.
  let splitGap = null;
  let splitCase = null; // 'A' or 'B'
  for (let gi = 0; gi < gaps.length; gi++) {
    const cg = gaps[gi];
    const fi = chain.indexOf(cg.frontBall);
    const bi = chain.indexOf(cg.backBall);
    if (bi !== fi + 1 || insertIdx !== bi) continue;
    if (hitBallIdx === fi) { splitGap = cg; splitCase = 'A'; }
    else if (hitBallIdx === bi) { splitGap = cg; splitCase = 'B'; }
    break;
  }

  let refS;
  if (splitCase === 'A') {
    // Place newBall snug behind frontBall; the remaining gap is between newBall
    // and originalBackBall.
    refS = splitGap.frontBall.s - BALL_SPACING;
  } else if (insertIdx < chain.length) {
    refS = chain[insertIdx].s;
  } else if (chain.length > 0) {
    refS = chain[chain.length - 1].s;
  } else {
    refS = 0;
  }

  const newBall = { mesh, colorIdx, s: refS, alive: true };

  if (splitCase === 'A') {
    // newBall becomes the new frontBall; gap is now newBall → oldBackBall
    splitGap.frontBall = newBall;
    splitGap.matching = colorIdx === splitGap.backBall.colorIdx;
  } else if (splitCase === 'B') {
    // newBall becomes the new backBall; gap is now oldFrontBall → newBall
    splitGap.backBall = newBall;
    splitGap.matching = splitGap.frontBall.colorIdx === colorIdx;
  }

  chain.splice(insertIdx, 0, newBall);

  // Suppress pushForward when landing inside a gap: the new ball is already
  // placed correctly and the collapse handles the remaining gap animation.
  if (insertIdx > 0 && splitGap === null) {
    pushForwards.push({ insertedBall: newBall, frontBall: chain[insertIdx - 1] });
  }

  // Ensure inserted ball is spaced from back neighbor
  if (insertIdx < chain.length - 1) {
    const maxS = chain[insertIdx + 1].s + BALL_SPACING;
    if (newBall.s < maxS) {
      newBall.s = maxS;
    }
  }
}

// ─── MATCHING & CHAIN REACTIONS ───

function hasGapBetween(frontIdx, backIdx) {
  // frontIdx has higher s (closer to skull), backIdx = frontIdx + 1
  return chain[frontIdx].s - chain[backIdx].s > BALL_SPACING * 1.5;
}

function checkMatches(idx, fromChainReaction = false) {
  if (idx < 0 || idx >= chain.length) return;
  const col = chain[idx].colorIdx;
  let start = idx, end = idx;
  while (start > 0 && chain[start - 1].colorIdx === col && !hasGapBetween(start - 1, start)) start--;
  while (end < chain.length - 1 && chain[end + 1].colorIdx === col && !hasGapBetween(end, end + 1)) end++;

  if (!fromChainReaction) combo = 1;

  const count = end - start + 1;
  if (count >= 3) {
    if (fromChainReaction) {
      combo++;
      const midPos = chain[Math.floor((start + end) / 2)].mesh.position.clone();
      spawnComboText(midPos, combo);
    }
    playSound('match', combo);
    for (let i = start; i <= end; i++) {
      explodeBall(chain[i]);
      chain[i].alive = false;
    }
    chain = chain.filter(b => b.alive);
    score += count * 10 * combo + chainBonus * 10;
    if (!fromChainReaction) chainBonus++;
    updateHUD();

    // Gap collapse: if there are balls on both sides of the removed section
    if (start > 0 && start < chain.length) {
      scheduleCollapse(start);
    }
  } else {
    combo = 1; // cascade ended with no match
    if (!fromChainReaction) chainBonus = 1;
    updateHUD();
  }
}

function scheduleCollapse(gapFrontIdx) {
  const frontBall = chain[gapFrontIdx - 1];
  const backBall = chain[gapFrontIdx];
  const matching = frontBall && backBall && frontBall.colorIdx === backBall.colorIdx;
  const initialGapSize = backBall && frontBall ? frontBall.s - backBall.s - BALL_SPACING : 0;
  gaps.push({ frontBall, backBall, matching, initialGapSize });
}

function updatePushForwards(dt) {
  if (pushForwards.length === 0) return;

  for (let g = pushForwards.length - 1; g >= 0; g--) {
    const pf = pushForwards[g];

    const insertedIdx = chain.indexOf(pf.insertedBall);
    const frontIdx = chain.indexOf(pf.frontBall);

    if (insertedIdx < 0 || frontIdx < 0 || frontIdx >= insertedIdx) {
      pushForwards.splice(g, 1); continue;
    }

    const targetS = pf.insertedBall.s + BALL_SPACING;
    const currentOverlap = targetS - pf.frontBall.s;

    if (currentOverlap <= 0.02) {
      pf.frontBall.s = targetS;
      // Propagate spacing forward within the contiguous segment only
      for (let i = frontIdx - 1; i >= 0; i--) {
        const gapHere = gaps.some(cg => {
          const fi = chain.indexOf(cg.frontBall);
          const bi = chain.indexOf(cg.backBall);
          return fi === i && bi === i + 1;
        });
        if (gapHere) break;
        const tgt = chain[i + 1].s + BALL_SPACING;
        if (chain[i].s < tgt) chain[i].s = tgt; else break;
      }
      pushForwards.splice(g, 1);
    } else {
      const pushSpeed = 15;
      const move = Math.min(pushSpeed * dt, currentOverlap);
      // Only move the contiguous segment from frontIdx back to insertedIdx-1,
      // but also push everything ahead of frontIdx that's contiguous (no gap)
      let pushStart = frontIdx;
      for (let i = frontIdx - 1; i >= 0; i--) {
        const gapHere = gaps.some(cg => {
          const fi = chain.indexOf(cg.frontBall);
          const bi = chain.indexOf(cg.backBall);
          return fi === i && bi === i + 1;
        });
        if (gapHere) break;
        pushStart = i;
      }
      for (let i = pushStart; i <= frontIdx; i++) chain[i].s += move;
    }
  }
}

function updateCollapses(dt) {
  if (gaps.length === 0) return;

  for (let g = gaps.length - 1; g >= 0; g--) {
    const gap = gaps[g];

    // Find current indices of the referenced balls
    const frontIdx = chain.indexOf(gap.frontBall);
    const backIdx = chain.indexOf(gap.backBall);

    // Validate: frontBall should be at a lower index (higher s) than backBall
    if (frontIdx < 0 || backIdx < 0 || backIdx !== frontIdx + 1) {
      // Balls removed or no longer adjacent gap — discard
      gaps.splice(g, 1); continue;
    }

    const targetS = gap.frontBall.s - BALL_SPACING;
    const currentGap = targetS - gap.backBall.s;

    if (currentGap <= 0.05) {
      // Gap closed — snap spacing
      gap.backBall.s = targetS;
      for (let i = backIdx + 1; i < chain.length; i++) {
        const tgt = chain[i - 1].s - BALL_SPACING;
        if (chain[i].s > tgt) chain[i].s = tgt; else break;
      }
      gaps.splice(g, 1);

      // Apply snap-back impulse proportional to the gap that just closed
      snapImpulse = Math.min(snapImpulse + gap.initialGapSize * 1.2, 8.0);

      // Chain reaction check
      if (gap.frontBall.colorIdx === gap.backBall.colorIdx) {
        const checkIdx = backIdx;
        setTimeout(() => {
          if (chain.length > 0) {
            playSound('chain', combo);
            checkMatches(Math.min(checkIdx, chain.length - 1), true);
          }
        }, 100);
      } else {
        combo = 1; // gap closed, no chain reaction — cascade over
        updateHUD();
      }
    } else if (gap.matching) {
      // Matching colors: front segment actively slides backward to close gap.
      // Only move the contiguous segment (stop at other gaps).
      let moveStart = frontIdx;
      for (let i = frontIdx - 1; i >= 0; i--) {
        const gapHere = gaps.some(cg => {
          if (cg === gap) return false; // skip self
          const fi = chain.indexOf(cg.frontBall);
          const bi = chain.indexOf(cg.backBall);
          return fi === i && bi === i + 1;
        }) || pushForwards.some(pf => {
          const ii = chain.indexOf(pf.insertedBall);
          return ii === i + 1;
        });
        if (gapHere) break;
        moveStart = i;
      }
      const collapseSpeed = 15;
      const move = Math.min(collapseSpeed * dt, currentGap);
      for (let i = moveStart; i <= frontIdx; i++) chain[i].s -= move;
    }
    // Non-matching: do nothing — back segment's natural advance closes it
  }
}
