// ═══════════════════════════════════════════════
//  DEBUG TOOLS  —  exclude this file from production
//  (remove the <script src="debug.js"> tag in index.html)
// ═══════════════════════════════════════════════

let debugMode = false;
let debugFastForward = false;
let debugShowGaps = false;
let debugGapMarkers = [];
let _debugRingGeom = null;

function toggleDebugMode() {
  debugMode = !debugMode;
  document.getElementById('debug-overlay').classList.toggle('visible', debugMode);
  if (!debugMode) {
    debugFastForward = false;
    debugShowGaps = false;
    clearDebugGapMarkers();
  }
}

function handleDebugKey(e) {
  if (!gameActive) return;
  const debugKeys = ['KeyB', 'KeyF', 'KeyR', 'KeyC', 'KeyS', 'KeyN', 'KeyA', 'KeyD', 'KeyG'];
  if (debugKeys.includes(e.code)) debugUsedThisRun = true;
  if (e.code === 'KeyB') tracks.forEach(t => t.tryAssignPowerup('blast'));
  if (e.code === 'KeyF') tracks.forEach(t => t.tryAssignPowerup('pause'));
  if (e.code === 'KeyR') tracks.forEach(t => t.tryAssignPowerup('backwards'));
  if (e.code === 'KeyC') tracks.forEach(t => t.tryAssignPowerup('chromatic'));
  if (e.code === 'KeyS') { tracks.forEach(t => t.spawningDone = true); showBanner('SPAWNING STOPPED'); }
  if (e.code === 'KeyN') levelUp();
  if (e.code === 'KeyG') { debugShowGaps = !debugShowGaps; if (!debugShowGaps) clearDebugGapMarkers(); }
  if (e.code === 'KeyA') debugFastForward = true;
  if (e.code === 'KeyD') tracks.forEach(t => t.chainFreezeTimer = t.chainFreezeTimer > 0 ? 0 : 99999);
}

function handleDebugKeyUp(e) {
  if (e.code === 'KeyA') debugFastForward = false;
}

function tickDebug() {
  if (!gameActive) return;
  const totalGaps = tracks.reduce((sum, t) => sum + t.gaps.length, 0);
  document.getElementById('dbg-gap-count').textContent = totalGaps;
  if (debugShowGaps) updateDebugGapMarkers();
}

function clearDebugGapMarkers() {
  for (const m of debugGapMarkers) {
    scene.remove(m);
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      if (m.material.map) m.material.map.dispose();
      m.material.dispose();
    }
  }
  debugGapMarkers = [];
}

function getDebugRingGeom() {
  if (!_debugRingGeom) _debugRingGeom = new THREE.RingGeometry(0.3, 0.5, 4);
  return _debugRingGeom;
}

function updateDebugGapMarkers() {
  clearDebugGapMarkers();
  for (const track of tracks) {
    const chain = track.chain;
    if (chain.length < 2) continue;

    for (let i = 0; i < chain.length - 1; i++) {
      const dist = chain[i].s - chain[i + 1].s;
      if (dist <= BALL_SPACING * 1.05) continue;

      const trackedGap = track.gaps.find(g => g.frontBall === chain[i] && g.backBall === chain[i + 1]);
      const tracked = !!trackedGap;
      const pushing = track.pushForwards.some(pf => {
        const ii = chain.indexOf(pf.insertedBall);
        return ii === i + 1;
      });
      const blocksMatch = dist > BALL_SPACING * 1.1;

      let color;
      if (tracked || pushing) {
        color = 0x00ff00;
      } else if (blocksMatch) {
        color = 0xff0000;
      } else {
        color = 0xffff00;
      }

      const midS = (chain[i].s + chain[i + 1].s) / 2;
      const pos = track.getPathPosFromS(midS);

      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false });
      const marker = new THREE.Mesh(getDebugRingGeom(), mat);
      marker.position.set(pos.x, pos.y, 1);
      marker.rotation.z = Math.PI / 4;
      scene.add(marker);
      debugGapMarkers.push(marker);

      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 40;
      const ctx = canvas.getContext('2d');
      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = color === 0xff0000 ? '#ff4444' : color === 0x00ff00 ? '#44ff44' : '#ffff44';
      const label = (dist / BALL_SPACING).toFixed(2) + 'x' + (tracked ? ' #' + trackedGap.id : pushing ? ' P' : ' !!');
      ctx.fillText(label, 2, 28);
      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(pos.x, pos.y + 0.9, 1);
      sprite.scale.set(2.5, 0.8, 1);
      scene.add(sprite);
      debugGapMarkers.push(sprite);
    }
  }
}
