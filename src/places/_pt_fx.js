// Purple Turtle — the lighting rig, eyes adjusting on the way in, and the glow you walk home with.
//
// The rig (a cellar student club, c. 2013), all driven by the DJ's track — its beat and its sections, on the shared
// clock, so everyone sees the same show:
//   five moving heads on the truss over the floor (their beams read in the haze; pools on the floor);
//   four scanners on the east bar: thin beams that snap to a new place on the beat;
//   LED pars: the colour wash of the vault (the floor's own light), chasing round the palette bar by bar;
//   UV tubes along the walls and the mirror ball for breakdowns (no kick: the heads go out, the ball turns);
//   a strobe used sparingly: four flashes on the beat (about 2 Hz — never faster, never the whole screen) into a drop.
// The bar, the games room, the lobby and the corridor keep their own steady light.
import * as THREE from 'three';
import { sectionAt } from '../core/_groove.js';
import { LAY } from './_pt_interior.js';
import { ptGlow, ptBeam } from './_pt_tex.js';
import * as Lg from './_pt_logic.js';
import { LOVE_MS, MARK_MS } from './_pt_social_logic.js';
import { springTweak } from './_pt_chars.js';

const yUp = new THREE.Vector3(0, 1, 0);
export function createRig(game, scene, room, audio) {
  const R = room, F = LAY.floor, L = R.lights, G = { adapt: 1, mode: 'chase', up: false, strobe: 0 };
  const tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color(), dir = new THREE.Vector3();
  // scanners: on a bar across the east edge of the floor, throwing west over the dancers
  const scanAt = [[2.25, 2.4, 1.9], [2.25, 2.4, 3.1], [2.25, 2.4, 4.3], [2.25, 2.4, 5.5]];
  const scan = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.16, 1, 8, 1, true), new THREE.MeshBasicMaterial({ map: ptBeam(), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), scanAt.length);
  scan.frustumCulled = false; scan.setColorAt(0, tmpC.set(1, 1, 1)); scene.add(scan);
  const scanT = scanAt.map(() => [0, 0, 0]);
  // lenses: a bright point at every fixture, so the source of each beam reads
  const fix = [...R.cans, ...scanAt], lp = new Float32Array(fix.length * 3), lc = new Float32Array(fix.length * 3);
  fix.forEach((f, i) => { lp[i * 3] = f[0]; lp[i * 3 + 1] = f[1] - 0.12; lp[i * 3 + 2] = f[2]; });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
  const lens = new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, map: ptGlow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); lens.frustumCulled = false; scene.add(lens);
  // UV tubes under the springing of the vault, both sides of the floor
  const uvM = new THREE.MeshBasicMaterial({ color: 0x3a10a0 }), uvG = new THREE.BoxGeometry(3.2, 0.05, 0.05);
  const uv = new THREE.InstancedMesh(uvG, uvM, 4); [[-4.3, 1.9, LAY.R2.za + 0.07], [-0.4, 1.9, LAY.R2.za + 0.07], [-4.9, 1.9, LAY.R2.zb - 0.07], [-0.1, 1.9, LAY.R2.zb - 0.07]].forEach((p, i) => { tmpM.makeTranslation(p[0], p[1], p[2]); uv.setMatrixAt(i, tmpM); }); scene.add(uv);
  // more haze where the beams cross
  const WHITE = new THREE.Color(1, 1, 1);

  /** where the track is: {kick, build, drop, lead, bar} from its form */
  function section() {
    try {
      const a = audio.player.now(); if (!a) return null;
      const T = a.T, step = (audio.clock - a.t0) / (T.spb / 4), bar = Math.max(0, Math.floor(step / 16)), S = sectionAt(T, Math.min(bar, T.bars - 1)), H = S.has;
      return { kick: !!(H.k || H.K), build: !!H.R, lead: !!(H.l || H.L), muffled: !!H.m, bar, into: bar - S.start, bars: S.bars, ti: a.ti };
    } catch { return null; }
  }
  G.section = section;
  G.update = (dt, st, hemi, amb) => {
    const t = game.elapsed, up = st.lightsUp, bf = st.beat || 0, bi = Math.floor(bf), ph = bf - bi, kickEnv = Math.exp(-ph * 5);
    // eyes adjusting: dark when you first come down from the street, opening up over some seconds
    G.adapt = Math.min(1, G.adapt + dt / 9); const ad = 0.45 + 0.55 * G.adapt;
    if (up !== G.up) {
      G.up = up;
      for (const k in L) { L[k].color.setHex(up ? 0xfff4e8 : L[k].userData.color); }
      R.pools.visible = R.beams.visible = R.haze.visible = R.dots.visible = scan.visible = lens.visible = !up;
      uvM.color.setHex(up ? 0x30303a : 0x3a10a0);
    }
    if (hemi) hemi.intensity = (up ? 0.7 : 0.24) * ad; if (amb) amb.intensity = (up ? 0.6 : 0.15) * ad;
    for (const k of ['bar', 'back', 'lobby', 'stair']) L[k].intensity = L[k].userData.base * (up ? 2.2 : k === 'back' ? 0.85 + 0.15 * Math.sin(t * 0.7) : 1) * (k === 'stair' ? 1 : ad);
    if (up) { L.dance.intensity = L.dance.userData.base * 2.2; return; }
    const S = section() || { kick: true, build: false, lead: true, bar: Math.floor(bi / 4), into: 0, bars: 8, ti: 0 };
    const mode = !S.kick && !S.build ? 'uv' : S.build ? 'build' : S.lead ? 'chase' : (S.bar >> 2) % 2 ? 'scan' : 'wash';
    G.mode = mode;
    const pal = R.pal, bar4 = Math.floor(bi / 4);
    // LED pars: the wash of the floor. Colour steps round the palette each bar; a breath on every kick.
    const parC = pal[(bar4 + S.ti) % pal.length];
    tmpC.setHex(mode === 'uv' ? 0x5a20ff : parC);
    // a strobe, sparingly: the last four beats of a build flash on the beat (the track's own tempo: ~2 Hz)
    const lastBar = S.build && S.into === S.bars - 1;
    const flash = lastBar ? Math.exp(-ph * 9) : 0; G.strobe = flash;
    L.dance.color.copy(tmpC).lerp(WHITE, flash * 0.8);
    L.dance.intensity = L.dance.userData.base * ad * (mode === 'uv' ? 0.42 : mode === 'build' ? 0.5 + 0.5 * (S.into / Math.max(1, S.bars)) + 1.1 * flash : (0.6 + 0.5 * kickEnv) * (0.7 + 0.5 * st.density));
    uvM.color.setHex(mode === 'uv' ? 0x9a50ff : 0x3a10a0);
    // moving heads
    const cx = (F.x0 + F.x1) / 2, cz = (F.z0 + F.z1) / 2, ax = (F.x1 - F.x0) * 0.44, az = (F.z1 - F.z0) * 0.42;
    const lcA = lens.geometry.attributes.color;
    for (let i = 0; i < 5; i++) {
      let x, z, on = true;
      if (mode === 'chase') { const a = bf * Math.PI / 4 + i * 1.26; x = cx + Math.sin(a) * ax * (0.55 + 0.45 * Math.sin(bf * Math.PI / 16 + i)); z = cz + Math.cos(a * 0.5 + i) * az; on = ((bi >> 1) + i) % 5 !== 0; }
      else if (mode === 'scan' || mode === 'wash') { const a = bf * Math.PI / 16 + i * 1.26; x = R.cans[i][0] + Math.sin(a) * 1.1; z = cz + Math.cos(a + i) * az * 0.8; on = mode === 'wash' || (bar4 + i) % 2 === 0; }
      else if (mode === 'build') { const k = S.into / Math.max(1, S.bars - 1); x = R.cans[i][0] + (cx - R.cans[i][0]) * k; z = cz + (i - 2) * 0.5 * (1 - k); on = true; }
      else { x = R.cans[i][0]; z = cz; on = false; }
      x = Math.max(F.x0 + 0.2, Math.min(F.x1 - 0.2, x)); z = Math.max(F.z0 + 0.2, Math.min(F.z1 - 0.2, z));
      tmpV.set(x, 0.02, z); tmpQ.identity(); tmpS.set(1, 1, 1); tmpM.compose(tmpV, tmpQ, tmpS); R.pools.setMatrixAt(i, tmpM);
      const c = R.cans[i], dx = x - c[0], dy = -c[1], dz = z - c[2], len = Math.hypot(dx, dy, dz);
      dir.set(-dx / len, -dy / len, -dz / len); tmpQ.setFromUnitVectors(yUp, dir); tmpS.set(1, len, 1); tmpV.set((c[0] + x) / 2, c[1] / 2, (c[2] + z) / 2); tmpM.compose(tmpV, tmpQ, tmpS); R.beams.setMatrixAt(i, tmpM);
      const col = mode === 'build' ? 0xffffff : pal[(i + bar4) % pal.length], lvl = on ? (mode === 'build' ? 0.35 + 0.65 * flash + 0.3 * kickEnv : 0.55 + 0.45 * kickEnv) : 0.03;
      R.pools.setColorAt(i, tmpC.setHex(col).multiplyScalar(lvl * 0.9)); R.beams.setColorAt(i, tmpC.setHex(col).multiplyScalar(on ? 0.75 + 0.25 * kickEnv : 0.03));
      lcA.setXYZ(i, tmpC.r * 1.2 + (on ? 0.25 : 0), tmpC.g * 1.2 + (on ? 0.25 : 0), tmpC.b * 1.2 + (on ? 0.25 : 0));
    }
    // scanners: snap to a new spot on the beat, hold, snap again
    const scanOn = mode === 'scan' || mode === 'chase';
    for (let i = 0; i < scanAt.length; i++) {
      const s = scanAt[i], k = mode === 'chase' ? bi : bi >> 1, T = scanT[i];
      const tx = F.x0 + 0.6 + Lg.hash('sx', k, i) * (F.x1 - F.x0 - 2.2), tz = s[2] + (Lg.hash('sz', k, i) - 0.5) * 3.2, ty = Lg.hash('sy', k, i) < 0.3 ? 1.9 : 0.02;
      const e = Math.min(1, dt * 18); T[0] += (tx - T[0]) * e; T[1] += (ty - T[1]) * e; T[2] += (Math.max(F.z0, Math.min(F.z1, tz)) - T[2]) * e;
      const dx = T[0] - s[0], dy = T[1] - s[1], dz = T[2] - s[2], len = Math.hypot(dx, dy, dz) || 1;
      dir.set(-dx / len, -dy / len, -dz / len); tmpQ.setFromUnitVectors(yUp, dir); tmpS.set(1, len, 1); tmpV.set((s[0] + T[0]) / 2, (s[1] + T[1]) / 2, (s[2] + T[2]) / 2); tmpM.compose(tmpV, tmpQ, tmpS); scan.setMatrixAt(i, tmpM);
      const on = scanOn && (i + bi) % 3 !== 0; tmpC.setHex(pal[(i * 2 + (bi >> 3)) % pal.length]).multiplyScalar(on ? 0.9 : 0.0); scan.setColorAt(i, tmpC);
      lcA.setXYZ(5 + i, tmpC.r, tmpC.g, tmpC.b);
    }
    lcA.needsUpdate = true; scan.instanceMatrix.needsUpdate = true; scan.instanceColor.needsUpdate = true;
    R.pools.instanceMatrix.needsUpdate = R.beams.instanceMatrix.needsUpdate = true; R.pools.instanceColor.needsUpdate = R.beams.instanceColor.needsUpdate = true;
    // haze billboards (the smoke machine puffs at the start of a drop)
    const cq = game.camera.quaternion;
    R.hazePos.forEach((p, i) => { tmpV.set(p[0] + Math.sin(t * 0.13 + i) * 0.5, p[1], p[2] + Math.cos(t * 0.11 + i) * 0.3); tmpS.set(1 + 0.2 * Math.sin(t * 0.2 + i), 1, 1); tmpM.compose(tmpV, cq, tmpS); R.haze.setMatrixAt(i, tmpM); });
    R.haze.instanceMatrix.needsUpdate = true;
    const puff = mode === 'chase' && S.into === 0 ? 0.05 * (1 - Math.min(1, (bf % 4) / 4)) : 0;
    R.haze.material.opacity = (0.085 + 0.065 * st.density + puff) * (mode === 'uv' ? 0.8 : 1);
    R.beams.material.opacity = 0.34 + 0.1 * st.density;
    R.haze.material.color.copy(L.dance.color).multiplyScalar(0.55).addScalar(0.25);
    // mirror ball: always turning; lit properly in the breakdowns
    R.ball.rotation.y = t * 0.6; R.dots.material.opacity = mode === 'uv' ? 1 : 0.35; R.dots.material.size = mode === 'uv' ? 0.08 : 0.05;
    const D = R.ballDirs, pos = R.dots.geometry.attributes.position, [bx, by, bz] = LAY.ball, ca = Math.cos(t * 0.6), sa = Math.sin(t * 0.6), r2 = LAY.R2;
    for (let i = 0; i < D.length / 3; i++) {
      const dx = D[i * 3] * ca + D[i * 3 + 2] * sa, dy = D[i * 3 + 1], dz = -D[i * 3] * sa + D[i * 3 + 2] * ca;
      let tt = -by / dy;
      if (dx > 0) tt = Math.min(tt, (LAY.X1 - bx) / dx); else if (dx < 0) tt = Math.min(tt, (LAY.X0 - bx) / dx);
      if (dz > 0) tt = Math.min(tt, (r2.zb - 0.02 - bz) / dz); else if (dz < 0) tt = Math.min(tt, (r2.za + 0.02 - bz) / dz);
      pos.setXYZ(i, bx + dx * tt, Math.max(0.02, by + dy * tt), bz + dz * tt);
    }
    pos.needsUpdate = true;
  };
  /** coming down from the street: start dark */
  G.enter = (fromOutside = true) => { if (fromOutside) G.adapt = 0; };
  return G;
}

// ------------------------------------------------------------------------------------------------ the glow
/** After a goodnight on the doorstep: the world a little warmer and richer for a while, a spring in your step, and —
 *  after a kiss on the cheek from someone wearing lipstick — the mark of it till about lunchtime. */
export function createLove(game) {
  const V = { el: null, key: '', mark: null, marks: new Map(), t: 0, netT: 0 };
  const now = () => game.time.now();
  const st = () => game.state.ptLove || null;
  const lipGeo = new THREE.CircleGeometry(0.0095, 10);
  function mkMark(col) {
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
    const g = new THREE.Group(), a = new THREE.Mesh(lipGeo, m), b = new THREE.Mesh(lipGeo, m);
    a.scale.set(1.25, 0.5, 1); a.position.y = 0.0046; b.scale.set(1.15, 0.5, 1); b.position.y = -0.0046; g.add(a, b); g.userData.mat = m;
    return g;
  }
  function putMark(ch, g) {
    const head = ch.bones && ch.bones.head; if (!head) return; if (g.parent === head) return;
    const s = (ch.dims && ch.dims.s) || 1, top = ch.anchors.headTop.position.y;
    g.position.set(0.066 * s, top * 0.36, 0.088 * s); g.rotation.set(-0.12, 0.72, 0.2); g.scale.setScalar(s); head.add(g);
  }
  V.love = (kind, P) => {
    const t0 = now(), kiss = kind === 'kiss';
    game.state.ptLove = { t0, kind, name: P.name, until: t0 + LOVE_MS * (kiss ? 1 : 0.5), markUntil: kiss && P.sex === 'f' ? t0 + MARK_MS : 0, lip: 0xb8203f, night: P.night };
    game.save && game.save();
    // (optional hook: friends may tease about it in the morning — places/friends.js)
    try { if (game.friends && game.friends.onNews) game.friends.onNews('walked-home', { name: P.name, kiss, mark: game.state.ptLove.markUntil > 0 }); } catch { /* */ }
    V.netT = 0;
  };
  V.state = () => { const L = st(), t = now(); return L ? { name: L.name, kind: L.kind, glow: +Math.max(0, Math.min(1, (L.until - t) / (LOVE_MS * 0.3))).toFixed(2), mark: L.markUntil > t, minutesLeft: +((L.until - t) / 60000).toFixed(1) } : null; };
  const net = game.net;
  if (net && net.on) net.on('ptkiss', (d, o) => { if (!o || !d) return; let R = V.marks.get(o.id); if (!d.on) { if (R) { R.g.removeFromParent(); V.marks.delete(o.id); } return; } if (!R) { R = { g: mkMark(d.c || 0xb8203f) }; V.marks.set(o.id, R); } R.t = performance.now(); R.o = o; });
  V.update = (dt) => {
    const L = st(), t = now(), p = game.player; V.t += dt;
    let k = 0, mark = false;
    if (L) { if (t > Math.max(L.until, L.markUntil) || t < L.t0 - 1000) { delete game.state.ptLove; game.save && game.save(); } else { k = Math.max(0, Math.min(1, (L.until - t) / (LOVE_MS * 0.3))) * (L.kind === 'kiss' ? 1 : 0.6); mark = L.markUntil > t; } }
    // the colour of things: on the canvas itself, so it works on every graphics tier (optional hook: game.post.setMood)
    const q = Math.round(k * 20) / 20, key = String(q);
    if (key !== V.key) {
      V.key = key;
      const cv = game.renderer && game.renderer.domElement;
      if (game.post && game.post.setMood) { try { game.post.setMood(q); } catch { /* */ } }
      else if (cv && cv.style) cv.style.filter = q > 0 ? `saturate(${(1 + 0.3 * q).toFixed(3)}) brightness(${(1 + 0.035 * q).toFixed(3)}) sepia(${(0.07 * q).toFixed(3)})` : '';
      if (typeof document !== 'undefined') {
        if (!V.el && q > 0) { V.el = document.createElement('div'); V.el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2'; document.body.appendChild(V.el); }
        if (V.el) V.el.style.background = q > 0 ? `radial-gradient(ellipse at center, rgba(255,150,170,0) 52%, rgba(255,120,150,${(0.13 * q).toFixed(3)}) 100%)` : 'none';
      }
    }
    if (k > 0 && !p.vehicle && !game.activity && p.pose === 'stand' && !p.down) springTweak(p.character, V.t, p.speed, k);
    if (mark) { if (!V.mark) V.mark = mkMark(L.lip); putMark(p.character, V.mark); V.mark.visible = !game.firstPerson; }
    else if (V.mark) { V.mark.removeFromParent(); V.mark = null; }
    if (net && net.connected && (V.netT -= dt) <= 0) { V.netT = 6; if (mark || V.sentMark) net.send('ptkiss', { on: mark ? 1 : 0, c: L ? L.lip : 0 }); V.sentMark = mark; }
    for (const [id, R] of V.marks) { if (performance.now() - R.t > 20000 || !R.o.character) { R.g.removeFromParent(); V.marks.delete(id); continue; } putMark(R.o.character, R.g); }
  };
  return V;
}
