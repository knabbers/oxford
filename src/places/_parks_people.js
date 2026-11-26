// University Parks: ambient life (owned by places/university_parks.js). All anonymous, adult, ordinarily dressed.
// - a cricket match on summer afternoons (11:00–18:30): 11 fielders, 2 batsmen, 2 umpires, ball by ball (bowler walks
//   back, runs in, bowls; the ball is left, defended, run for two or hit to the rope), overs alternate ends — derived
//   from the shared clock so every player sees the same ball; spectators on the benches by the pavilion
// - picnickers on rugs, people reading on the grass, a frisbee pair, two croquet players on the club lawns
// - grey squirrels round the trees (they bolt up the trunk when you come close) and pigeons/blackbirds on the grass
//   (they fly off when you get near)
// On every graphics tier (who is in the Parks does not depend on it), only near the player. update() is allocation-free.
// Draw calls: one per visible character (LOD'd, blob shadows when far), + 1 balls/disc, + 1 rugs, + 1 squirrels,
// + 1 birds, + 2 bats.
import * as THREE from 'three';
import { createCharacter, randomLook } from '../core/characters.js';
import { CRICKET } from './_parks_dress.js';
import { parkPaths } from './_parks_paths.js';

import { TB, BALLS, POS, SHOTS, CAST, hash, roleOf, ballAt } from './_parks_match.js';
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export function buildParkPeople(game, detail) {
  const W = game.world, col = game.worldCollider, map = game.map, inP = W.util.pointInPoly;
  const park = map.areas.find((a) => a.id === 'r12532311_2').poly;
  const woods = map.areas.filter((a) => (a.kind === 'wood' || a.kind === 'scrub' || a.kind === 'garden' || (a.kind === 'pitch' && (a.sport === 'tennis' || a.sport === 'croquet'))) && inP(a.poly[0][0], a.poly[0][1], park)).map((a) => a.poly);
  const PP = parkPaths(game);
  const [cx, cz] = CRICKET.c, [ux, uz] = CRICKET.u, vx = uz, vz = -ux;
  const okSpot = (x, z, r = 1.2) => {
    if (!inP(x, z, park) || !col.isFree(x, z, r) || col.isWater(x, z) || col.isWater(x + 4, z) || col.isWater(x - 4, z)) return false;
    if (Math.hypot(x - cx, z - cz) < 68) return false;
    for (const w of woods) if (inP(x, z, w)) return false;
    return !PP.near(x, z, r + 1.5);
  };
  const findSpot = (x, z, r = 1.5) => { for (let k = 0; k < 60; k++) { const a = k * 2.4, d = k * 1.3, px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d; if (okSpot(px, pz, r)) return [px, pz]; } return null; };
  const scene = game.worldScene;
  const vcol = (geo, c) => { const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
  const mergeV = (parts) => { const g = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'color']) { const tot = parts.reduce((s, p) => s + p.attributes[k].array.length, 0), out = new Float32Array(tot); let o = 0; for (const p of parts) { out.set(p.attributes[k].array, o); o += p.attributes[k].array.length; } g.setAttribute(k, new THREE.BufferAttribute(out, 3)); } return g; };
  const chars = [];
  const mk = (look, x, z, h) => {
    const ch = createCharacter(look); ch.group.position.set(x, 0, z); ch.group.rotation.y = h; ch.group.visible = false; scene.add(ch.group);
    let blob = null; try { blob = W.blobShadow(ch.group, 0.42); } catch { /* optional */ }
    const c = { ch, blob, pose: 'stand', x, z, h, speed: 0 }; chars.push(c); return c;
  };
  const setPose = (c, p, opts) => { if (c.pose !== p) { c.pose = p; c.ch.setPose(p, opts); } };
  const show = (list, on) => { for (const c of list) c.ch.group.visible = on; };

  // ------------------------------------------------------------------------------------------- small shared meshes
  const ballIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.45 }), 6);
  ballIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(18), 3);
  ballIM.frustumCulled = false; ballIM.castShadow = false; ballIM.name = 'parks-balls'; ballIM.count = 0; scene.add(ballIM);
  const cBall = new THREE.Color(0x9a1a1a);
  [0x9a1a1a, 0x1a3aa0, 0xb02020, 0x1a1a1a, 0xd8b020, 0xf2f2ec].forEach((c, i) => ballIM.setColorAt(i, new THREE.Color(c)));
  { const z0 = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < 6; i++) ballIM.setMatrixAt(i, z0); }
  const rugCols = [0xb03a3a, 0x3a6ab0, 0xd8c070, 0x6a3a8a, 0x3a8a5a];
  const rugIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.0, 1.6).rotateX(-Math.PI / 2), W.layerMaterial(new THREE.MeshStandardMaterial({ roughness: 1 }), 'marking'), 6);
  rugIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(18), 3); rugIM.frustumCulled = false; rugIM.count = 0; rugIM.name = 'parks-rugs'; scene.add(rugIM);
  const batMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const batGeo = (() => { const parts = [vcol(new THREE.BoxGeometry(0.105, 0.56, 0.04).translate(0, -0.5, 0), 0xd8c08a), vcol(new THREE.CylinderGeometry(0.017, 0.017, 0.24, 6).translate(0, -0.1, 0), 0x202020)]; const g = mergeV(parts); g.computeBoundingSphere(); return g; })();
  const mkBat = () => { const m = new THREE.Mesh(batGeo, batMat); m.castShadow = false; return m; };

  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), E = new THREE.Euler();
  // (ballsOn: a bit per slot shown — with none shown the mesh draws nothing, instead of six zero-scale spheres every
  // frame from anywhere in the city)
  let ballsOn = 0;
  const setBall = (i, x, y, z, r, sy = 1) => { M4.compose(V.set(x, y, z), Q.identity(), SC.set(r, r * sy, r)); ballIM.setMatrixAt(i, M4); ballsOn |= 1 << i; };
  const hideBall = (i) => { M4.makeScale(0, 0, 0); ballIM.setMatrixAt(i, M4); ballsOn &= ~(1 << i); };

  // ------------------------------------------------------------------------------------------- the cricket match
  const whites = (seed, extra = {}) => ({ ...randomLook(seed, { outfit: 'casual' }), outfit: 'casual', top: 0xf3f0e4, topStyle: 'shirt', sleeves: (seed % 3) ? 'short' : 'long', bottom: 0xf0ece0, legs: 'trousers', shoes: 0xf2f2ee, shoeStyle: 'trainer', jacket: undefined, backpack: undefined, prop: undefined, scarf: undefined, skirt: undefined, dress: undefined, gown: undefined, hat: undefined, ...extra });
  const umpire = (seed) => ({ ...randomLook(seed, { outfit: 'smart' }), jacket: 0xefece2, jacketLen: 'hip', shirt: 0xe8eef4, neck: 'tie', neckColor: 0x2a2a4a, bottom: 0x2a2a30, legs: 'trousers', hat: 'sunhat', hatColor: 0xf0eee6, shoes: 0x2a2018, prop: undefined, backpack: undefined, gown: undefined });
  const cr = { on: false, made: false, list: [], bats: [], roles: null, prev: new Float32Array(30), ballSeen: -1 };
  const CRK = CAST;
  function makeCricket() {
    cr.made = true;
    CRK.forEach((k, i) => {
      const look = k.startsWith('ump') ? umpire(7100 + i) : whites(7000 + i, k.startsWith('bat') ? { hat: 'cap', hatColor: 0x1a2a5a } : k === 'keeper' ? { hat: 'cap', hatColor: 0x1a2a5a } : (i % 4 === 0 ? { hat: 'sunhat', hatColor: 0xf0eee6 } : {}));
      const c = mk(look, cx, cz, 0); c.key = k; cr.list.push(c);
      if (k.startsWith('bat')) { const b = mkBat(); c.ch.anchors.handR.add(b); c.bat = b; cr.bats.push(b); }
    });
  }
  const toW = (a, b, s, out) => { a *= s; b *= s; out[0] = cx + ux * a + vx * b; out[1] = cz + uz * a + vz * b; return out; };
  const P2 = [0, 0], P3 = [0, 0], BALL = { a: 0, b: 0, y: 0, show: true };
  // where role r stands at time tb of a ball (s = +1 frame); returns [a, b] in L, sets pose hints
  const L = [0, 0];
  function rolePos(r, tb, shot, outcome, chaser) {
    const base = POS[r]; L[0] = base[0]; L[1] = base[1];
    let pose = 'stand';
    if (r === 'bowler') {
      const fx = 5, fb = 1.2;
      if (tb < 8) { const t = smooth(tb / 8); L[0] = lerp(fx, 28, t); L[1] = lerp(fb, 0.8, t); }
      else if (tb < 10) { L[0] = 28; L[1] = 0.8; }
      else if (tb < 13.6) { const t = (tb - 10) / 3.6; L[0] = lerp(28, 9.0, t * (0.6 + 0.4 * t)); L[1] = lerp(0.8, 0.6, t); }
      else if (tb < 15) { const t = smooth((tb - 13.6) / 1.4); L[0] = lerp(9.0, fx, t); L[1] = lerp(0.6, fb, t); }
      else if (outcome === 'defend' && tb < 19) { const t = smooth((tb - 15) / 2.5); L[0] = lerp(fx, -1.5, t); L[1] = lerp(fb, -2.6, t); }
      else if (outcome === 'defend') { const t = smooth((tb - 19) / 3); L[0] = lerp(-1.5, fx, t); L[1] = lerp(-2.6, fb, t); }
      else { L[0] = fx; L[1] = fb; }
      if (tb > 13.45 && tb < 14.1) pose = 'throw';
    } else if (r === 'striker' || r === 'nonstriker') {
      if (outcome === 'run' && tb > 14.6 && tb < 21.8) {
        const t = (tb - 14.6) / 7.2, leg = t < 0.5 ? smooth(t * 2) : 1 - smooth((t - 0.5) * 2);
        const from = r === 'striker' ? -8.9 : 9.6, to = r === 'striker' ? 9.2 : -8.6;
        L[0] = lerp(from, to, leg); L[1] = r === 'striker' ? lerp(0.35, -0.9, leg) : lerp(1.5, 0.9, leg);
      } else if (r === 'nonstriker' && tb > 12.6 && tb < 15.5) { L[0] = 9.6 - smooth((tb - 12.6) / 1.2) * 2.2 + smooth((tb - 14.5) / 1) * 2.2; }
    } else if (r === 'keeper') {
      if (outcome === 'run' && tb > 15 && tb < 22) { const t = smooth((tb - 15) / 2) - smooth((tb - 19.5) / 2.5); L[0] = lerp(-24, -11.2, t); L[1] = lerp(0, 0.8, t); }
      if (tb > 11.2 && tb < 14.35) pose = 'crouch';
    } else if (r !== 'umpB' && r !== 'umpS') {
      // fielders walk in with the bowler, then back
      const t = smooth((tb - 10) / 3.6) * (1 - smooth((tb - 16) / 6));
      const dx = -8.9 - base[0], db = 0.35 - base[1], d = Math.hypot(dx, db) || 1;
      L[0] = base[0] + dx / d * 2.5 * t; L[1] = base[1] + db / d * 2.5 * t;
      if (r === chaser && (outcome === 'run' || outcome === 'four')) {
        const tgt = shot, t0 = 14.3, t1 = outcome === 'run' ? 16.6 : 18.4, t2 = outcome === 'run' ? 24 : 28;
        if (tb > t0 && tb < t1) { const k = smooth((tb - t0) / (t1 - t0)); L[0] = lerp(L[0], tgt[0], k); L[1] = lerp(L[1], tgt[1], k); }
        else if (tb >= t1 && tb < t2) { const k = smooth((tb - t1 - 1.2) / (t2 - t1 - 1.2)); L[0] = lerp(tgt[0], base[0], k); L[1] = lerp(tgt[1], base[1], k); if (tb < t1 + 1.1 && tb > t1 + 0.3) pose = 'throw'; }
      }
    }
    return pose;
  }
  const shotT = [0, 0], BA = {};
  let a = 0, b = 0, y = 0;   // the ball, in the s = +1 frame (outer scope: no per-frame closures)
  const bow = (t0, t1, a0, b0, y0, a1, b1, y1, arcH, t) => { const k2 = clamp((t - t0) / (t1 - t0), 0, 1); a = lerp(a0, a1, k2); b = lerp(b0, b1, k2); y = lerp(y0, y1, k2) + Math.sin(k2 * Math.PI) * arcH; };
  function tickCricket(dt, nowS) {
    const B = ballAt(nowS, BA), overIdx = B.over, tin = B.tin, p = B.parity, s = B.s, k = B.ball, tb = B.tb, change = B.change, ballNo = B.n, outcome = B.outcome, chaser = B.chaser;
    const cp = POS[chaser];
    if (outcome === 'run') { shotT[0] = cp[0] * 0.82 + (hash(ballNo + 99) - 0.5) * 6; shotT[1] = cp[1] * 0.82 + (hash(ballNo + 77) - 0.5) * 6; }
    else if (outcome === 'four') { const ang = Math.atan2(cp[1], cp[0] + 8.9) + (hash(ballNo + 55) - 0.5) * 0.5, R = 57; shotT[0] = -8.9 + Math.cos(ang) * R; shotT[1] = Math.sin(ang) * R; const rr = Math.hypot(shotT[0], shotT[1]); if (rr > 57) { shotT[0] *= 57 / rr; shotT[1] *= 57 / rr; } }
    const strikerW = toW(POS.striker[0], POS.striker[1], s, P3);
    for (let i = 0; i < cr.list.length; i++) {
      const c = cr.list[i];
      let pose = 'stand';
      if (change) {
        const rOld = roleOf(c.key, p ^ 1), rNew = roleOf(c.key, p), f = smooth((tin - BALLS * TB) / 34);
        const a0 = POS[rOld], a1 = POS[rNew];
        toW(a0[0], a0[1], -s, P2); const x0 = P2[0], z0 = P2[1]; toW(a1[0], a1[1], s, P2);
        c.tx = lerp(x0, P2[0], f); c.tz = lerp(z0, P2[1], f);
      } else {
        const role = roleOf(c.key, p);
        pose = rolePos(role, tb, shotT, outcome, chaser);
        toW(L[0], L[1], s, P2); c.tx = P2[0]; c.tz = P2[1];
      }
      const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
      const sp = dt > 0 ? Math.min(9, d / dt) : 0;
      c.speed = lerp(c.speed, sp, Math.min(1, dt * 8));
      let want;
      if (d > 0.02 && sp > 0.4) want = Math.atan2(dx, dz); else want = Math.atan2(strikerW[0] - c.x, strikerW[1] - c.z);
      if (c.key.startsWith('bat') && roleOf(c.key, p) === 'striker' && !change && !(outcome === 'run' && tb > 14.6 && tb < 21.8)) want = Math.atan2(ux * s, uz * s);
      if (c.key.startsWith('bat') && roleOf(c.key, p) === 'nonstriker' && !change && sp < 0.4) want = Math.atan2(-ux * s, -uz * s);
      let dh = want - c.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.h += dh * Math.min(1, dt * 6);
      c.x = c.tx; c.z = c.tz;
      c.ch.group.position.set(c.x, 0, c.z); c.ch.group.rotation.y = c.h;
      setPose(c, pose);
      c.ch.update(dt, c.speed < 0.25 ? 0 : c.speed);
      if (c.bat) { const swing = !change && roleOf(c.key, p) === 'striker' && tb > 13.95 && tb < 14.6 && outcome !== 'leave' ? Math.sin(((tb - 13.95) / 0.65) * Math.PI) : 0; c.bat.rotation.x = -0.35 - swing * 1.6; }
    }
    // the ball
    a = 0; b = 0; y = 0; let vis = true;
    if (change) vis = false;
    else if (tb < 13.6) { rolePos('bowler', tb, shotT, outcome, chaser); a = L[0]; b = L[1] - 0.25; y = 1.05; if (tb > 13.0) { y = lerp(1.05, 2.2, (tb - 13.0) / 0.6); } }
    else if (tb < 14.0) bow(13.6, 14.0, 9.0, 0.5, 2.2, -4.5, 0.25, 0.04, 0.05, tb);
    else if (tb < 14.25) bow(14.0, 14.25, -4.5, 0.25, 0.04, -8.3, 0.3, 0.75, 0.25, tb);
    else if (outcome === 'leave') { if (tb < 14.65) bow(14.25, 14.65, -8.3, 0.3, 0.75, -23.6, 0, 0.9, 0.1, tb); else if (tb < 20) { rolePos('keeper', tb, shotT, outcome, chaser); a = L[0] + 0.3; b = L[1] - 0.25; y = 0.95; } else bow(20, 21.4, -24, 0, 1.4, 5, 1.2, 1.3, 7, tb); }
    else if (outcome === 'defend') { if (tb < 16.5) bow(14.25, 16.5, -8.3, 0.3, 0.7, -1.2, -2.6, 0.036, 0.1, tb); else if (tb < 17.6) { a = -1.2; b = -2.6; y = 0.036; } else { rolePos('bowler', tb, shotT, outcome, chaser); a = L[0]; b = L[1] - 0.25; y = 1.0; } if (tb < 16.5 && tb > 14.6) y = 0.036; }
    else {
      const run = outcome === 'run', t1 = run ? 16.6 : 17.6;
      if (tb < t1) { const k2 = smooth((tb - 14.25) / (t1 - 14.25)); a = lerp(-8.3, shotT[0], k2); b = lerp(0.3, shotT[1], k2); y = tb < 14.5 ? lerp(0.75, 0.036, (tb - 14.25) / 0.25) : 0.036; }
      else {
        const tr = run ? 17.3 : 19.2, ta = run ? 18.4 : 20.9, tk = run ? 21.5 : 22.5;
        if (tb < tr) { rolePos(chaser, tb, shotT, outcome, chaser); a = run ? L[0] : shotT[0]; b = run ? L[1] : shotT[1]; y = run ? 1.0 : 0.036; if (!run && tb > 18.4) { a = L[0]; b = L[1]; y = 1.0; } }
        else if (tb < ta) { rolePos(chaser, tr, shotT, outcome, chaser); bow(tr, ta, L[0], L[1], 1.6, -11.2, 0.8, 1.2, run ? 5 : 9, tb); }
        else if (tb < tk) { rolePos('keeper', tb, shotT, outcome, chaser); a = L[0] + 0.3; b = L[1] - 0.2; y = 0.95; }
        else bow(tk, tk + 1.6, -11.2, 0.8, 1.2, 5, 1.2, 1.3, 6, tb);
      }
    }
    if (vis) { toW(a, b, s, P2); setBall(0, P2[0], y, P2[1], 0.036); } else hideBall(0);
  }

  // ------------------------------------------------------------------------------------------- spectators, picnics, readers, frisbee, croquet
  const groups = [];
  const casual = (seed, extra = {}) => ({ ...randomLook(seed, { outfit: seed % 5 === 0 ? 'tweed' : 'casual' }), gown: undefined, ...extra });
  const addGroup = (g) => { groups.push(g); return g; };
  // spectators on the pavilion benches (match hours)
  addGroup({ name: 'spectators', x: cx + ux * 59, z: cz + uz * 59, h0: 11, h1: 18.5, make(G) {
    (detail?.spectatorSeats || []).slice(0, 4).forEach(([x, z, h], i) => { if (i === 2 || i === 0) return; const c = mk(casual(5200 + i, i === 1 ? { hat: 'sunhat', hatColor: 0xe8e0c8 } : { prop: i === 3 ? 'book' : undefined }), x, z, h); c.base = 'sit'; G.chars.push(c); });
  } });
  // picnic groups and readers: rough spots, each snapped to open grass (guessed spots: lawns that are popular in summer)
  const PICNICS = [[540, -1010, 3], [728, -742, 2], [262, -812, 3], [480, -930, 2]], READERS = [[610, -655], [205, -735], [690, -850], [455, -820]];
  PICNICS.forEach(([x0, z0, n], gi) => addGroup({ name: 'picnic' + gi, x: x0, z: z0, h0: 11.5, h1: 19.2, rug: gi, make(G) {
    const p = findSpot(x0, z0, 2.0); if (!p) return; G.x = p[0]; G.z = p[1];
    const rh = hash(gi + 3) * 6.28; G.rugH = rh;
    for (let i = 0; i < n; i++) { const a = rh + (i / n) * Math.PI * 2 + 0.4, x = p[0] + Math.sin(a) * 0.85, z = p[1] + Math.cos(a) * 0.65; const c = mk(casual(5300 + gi * 7 + i, i === 0 && gi % 2 ? { prop: 'bottle' } : {}), x, z, Math.atan2(p[0] - x, p[1] - z)); c.base = 'sitground'; G.chars.push(c); }
  } }));
  READERS.forEach(([x0, z0], ri) => addGroup({ name: 'reader' + ri, x: x0, z: z0, h0: 10, h1: 19.5, make(G) {
    const p = findSpot(x0, z0, 1.2); if (!p) return; G.x = p[0]; G.z = p[1];
    const c = mk(casual(5400 + ri, { prop: 'book' }), p[0], p[1], hash(ri + 40) * 6.28); c.base = 'sitground'; G.chars.push(c);
  } }));
  // frisbee pair on the open grass south-east of the cricket ground (guess)
  const fr = addGroup({ name: 'frisbee', x: 470, z: -885, h0: 12, h1: 20, make(G) {
    const p = findSpot(470, -885, 2.5); if (!p) return;
    const q = findSpot(p[0] + 13, p[1] - 4, 2.0); if (!q) return;
    G.a = p; G.b = q; G.x = (p[0] + q[0]) / 2; G.z = (p[1] + q[1]) / 2;
    G.chars.push(mk(casual(5500), p[0], p[1], 0), mk(casual(5501, { topStyle: 'tee' }), q[0], q[1], 0));
  } });
  // croquet on the OUCC lawns (10:00–19:00): two players, four balls
  const crq = addGroup({ name: 'croquet', custom: true, x: 492, z: -565, h0: 10, h1: 19, make(G) {
    const a = map.areas.find((x) => x.id === 'w935442940'); if (!a) return;
    const c0 = a.poly.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]); G.c = c0;
    G.chars.push(mk(casual(5600, { outfit: 'smart', top: 0xf2f0ea, bottom: 0xf0ece4, prop: 'mallet', shoes: 0xf2f2ee, shoeStyle: 'trainer' }), c0[0] - 3, c0[1], 0), mk(casual(5601, { top: 0xf2f0ea, bottom: 0xf0ece4, prop: 'mallet', shoes: 0xf2f2ee, shoeStyle: 'trainer', hat: 'sunhat', hatColor: 0xece6d2 }), c0[0] + 4, c0[1] + 2, 0));
    G.balls = [[c0[0] - 2.2, c0[1] + 1], [c0[0] + 3.3, c0[1] + 2.6], [c0[0] - 6, c0[1] - 5], [c0[0] + 7, c0[1] - 3]];
  } });
  for (const g of groups) { g.chars = []; g.made = false; g.on = false; }

  // ------------------------------------------------------------------------------------------- squirrels + birds
  const sqG = mergeV([
    vcol(new THREE.SphereGeometry(1, 6, 4).scale(0.07, 0.07, 0.12).translate(0, 0.09, 0), 0x8c8680),
    vcol(new THREE.SphereGeometry(1, 5, 3).scale(0.045, 0.045, 0.055).translate(0, 0.15, 0.11), 0x8c8680),
    vcol(new THREE.SphereGeometry(1, 6, 4).scale(0.055, 0.15, 0.06).rotateX(-0.35).translate(0, 0.2, -0.14), 0x9a948c),
    vcol(new THREE.SphereGeometry(1, 5, 4).scale(0.05, 0.035, 0.08).translate(0, 0.07, 0.02), 0xd8d0c4),
  ]);
  const vMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const SQN = 12, sqIM = new THREE.InstancedMesh(sqG, vMat, SQN); sqIM.count = 0; sqIM.frustumCulled = false; sqIM.castShadow = false; sqIM.name = 'parks-squirrels'; scene.add(sqIM);
  const bdG = mergeV([
    vcol(new THREE.SphereGeometry(1, 6, 4).scale(0.065, 0.06, 0.11).translate(0, 0.1, 0), 0xffffff),
    vcol(new THREE.SphereGeometry(1, 5, 3).scale(0.04, 0.04, 0.045).translate(0, 0.17, 0.08), 0xd0d0d0),
    vcol(new THREE.ConeGeometry(0.012, 0.035, 4).rotateX(Math.PI / 2).translate(0, 0.165, 0.13), 0xe0a030),
    vcol(new THREE.BoxGeometry(0.09, 0.01, 0.08).translate(0, 0.08, -0.1), 0xb0b0b0),
    vcol(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 3).translate(0.02, 0.03, 0), 0xc06060), vcol(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 3).translate(-0.02, 0.03, 0), 0xc06060),
  ]);
  const BDN = 16, bdIM = new THREE.InstancedMesh(bdG, vMat, BDN); bdIM.count = 0; bdIM.frustumCulled = false; bdIM.castShadow = false; bdIM.name = 'parks-birds'; scene.add(bdIM);
  bdIM.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BDN * 3), 3);
  const BIRD_COL = [new THREE.Color(0x8a8e98), new THREE.Color(0x8a8e98), new THREE.Color(0x7e828c), new THREE.Color(0x222222)];
  const parkTrees = map.trees.filter(([x, z]) => inP(x, z, park) && col.isFree(x + 2.5, z, 0.3));
  const sq = []; for (let i = 0; i < SQN; i++) sq.push({ tree: -1, x: 0, z: 0, y: 0, h: 0, tx: 0, tz: 0, st: 'idle', t: 0, ph: i * 1.7, climbY: 0 });
  const bd = []; for (let i = 0; i < BDN; i++) bd.push({ x: 0, z: 0, y: 0, h: 0, st: 'none', t: 0, fx: 0, fz: 0, tx: 0, tz: 0, ph: i * 0.9, kind: 0 });
  let rr = 1;
  const rnd = () => { rr = (rr * 16807) % 2147483647; return rr / 2147483647; };
  function pickTree(s, px, pz) {
    for (let k = 0; k < 12; k++) { const i = (rnd() * parkTrees.length) | 0, t = parkTrees[i]; if (!t) break; const d = Math.hypot(t[0] - px, t[1] - pz); if (d > 14 && d < 85) { s.tree = i; const a = rnd() * 6.28, r = 2 + rnd() * 4; s.x = t[0] + Math.sin(a) * r; s.z = t[1] + Math.cos(a) * r; s.tx = s.x; s.tz = s.z; s.y = 0; s.st = 'idle'; s.t = rnd() * 3; return true; } }
    s.tree = -1; return false;
  }
  function tickSquirrels(dt, px, pz, on) {
    let n = 0;
    if (on) for (let i = 0; i < SQN; i++) {
      const s = sq[i];
      if (s.tree < 0 || Math.hypot(s.x - px, s.z - pz) > 110) { if (!pickTree(s, px, pz)) continue; }
      const t = parkTrees[s.tree], pd = Math.hypot(s.x - px, s.z - pz);
      s.t -= dt; s.ph += dt;
      if ((s.st === 'idle' || s.st === 'hop') && pd < 7 && game.player.place === 'world') { s.st = 'flee'; s.tx = t[0] + 0.35; s.tz = t[1]; }
      if (s.st === 'idle' && s.t <= 0) { const a = rnd() * 6.28, r = 1.5 + rnd() * 5; s.tx = t[0] + Math.sin(a) * r; s.tz = t[1] + Math.cos(a) * r; s.st = 'hop'; }
      let hop = 0;
      if (s.st === 'hop' || s.st === 'flee') {
        const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz), v = s.st === 'flee' ? 4.5 : 1.3;
        if (d < 0.1) { if (s.st === 'flee') { s.st = 'climb'; s.climbY = 2.5 + rnd() * 3; s.t = 8 + rnd() * 8; } else { s.st = 'idle'; s.t = 1 + rnd() * 4; } }
        else { const st = Math.min(d, v * dt); s.x += dx / d * st; s.z += dz / d * st; s.h = Math.atan2(dx, dz); hop = Math.abs(Math.sin(s.ph * (s.st === 'flee' ? 14 : 9))) * 0.07; }
      } else if (s.st === 'climb') { s.y = Math.min(s.climbY, s.y + dt * 2.2); s.t -= 0; if (s.y >= s.climbY && s.t <= 0 && pd > 10) s.st = 'down'; }
      else if (s.st === 'down') { s.y -= dt * 1.4; if (s.y <= 0) { s.y = 0; s.st = 'idle'; s.t = 2; s.x = t[0] + 0.9; s.z = t[1]; } }
      const climbing = s.st === 'climb' || s.st === 'down';
      if (climbing) { E.set(s.st === 'down' ? Math.PI / 2 : -Math.PI / 2, s.h, 0, 'YXZ'); Q.setFromEuler(E); V.set(t[0] - Math.sin(s.h) * 0.32, s.y + 0.3, t[1] - Math.cos(s.h) * 0.32); }
      else { E.set(s.st === 'idle' ? Math.sin(s.ph * 3) * 0.15 - 0.1 : 0, s.h, 0, 'YXZ'); Q.setFromEuler(E); V.set(s.x, hop, s.z); }
      M4.compose(V, Q, SC.set(1, 1, 1)); sqIM.setMatrixAt(n++, M4);
    }
    sqIM.count = n; if (n) sqIM.instanceMatrix.needsUpdate = true;
  }
  function placeBird(b, px, pz, i) {
    for (let k = 0; k < 10; k++) {
      const a = rnd() * 6.28, d = 18 + rnd() * 45, x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
      if (!inP(x, z, park) || Math.hypot(x - cx, z - cz) < 14) continue;
      if (PP.near(x, z, 1.0) || !col.isFree(x, z, 0.5) || col.isWater(x, z)) continue;
      b.x = x; b.z = z; b.y = 0; b.st = 'peck'; b.t = rnd() * 3; b.h = rnd() * 6.28; b.kind = i % 5 === 4 ? 3 : (i % 3);
      bdIM.setColorAt(i, BIRD_COL[b.kind]); bdIM.instanceColor.needsUpdate = true; return true;
    }
    b.st = 'none'; return false;
  }
  function tickBirds(dt, px, pz, on, running) {
    let n = 0;
    if (on) for (let i = 0; i < BDN; i++) {
      const b = bd[i];
      if (b.st === 'none' || (b.st !== 'fly' && Math.hypot(b.x - px, b.z - pz) > 80)) { if (!placeBird(b, px, pz, i)) continue; }
      b.t -= dt; b.ph += dt;
      const pd = Math.hypot(b.x - px, b.z - pz);
      if (b.st !== 'fly' && game.player.place === 'world' && (pd < 4.5 || (running && pd < 9))) {
        b.st = 'fly'; b.t = 0; b.fx = b.x; b.fz = b.z; const a = Math.atan2(b.x - px, b.z - pz) + (rnd() - 0.5), d = 14 + rnd() * 16; b.tx = b.x + Math.sin(a) * d; b.tz = b.z + Math.cos(a) * d; b.h = a;
        if (!inP(b.tx, b.tz, park) || col.isWater(b.tx, b.tz)) { b.tx = b.x - Math.sin(a) * d; b.tz = b.z - Math.cos(a) * d; b.h = a + Math.PI; }
      }
      let pitch = 0, sx = 1;
      if (b.st === 'fly') {
        b.t += dt * 2; const k = Math.min(1, b.t / 2.4);
        b.x = lerp(b.fx, b.tx, k); b.z = lerp(b.fz, b.tz, k); b.y = Math.sin(k * Math.PI) * 3.5;
        sx = 1.0 + Math.abs(Math.sin(b.ph * 30)) * 1.6; pitch = -0.2;
        if (k >= 1) { b.st = 'peck'; b.y = 0; b.t = 1 + rnd() * 2; }
      } else if (b.st === 'peck') { pitch = Math.max(0, Math.sin(b.ph * 7)) * 0.7; if (b.t <= 0) { b.st = 'walk'; b.t = 0.6 + rnd() * 1.4; b.h += (rnd() - 0.5) * 2; } }
      else if (b.st === 'walk') { const v = 0.35; b.x += Math.sin(b.h) * v * dt; b.z += Math.cos(b.h) * v * dt; if (b.t <= 0) { b.st = 'peck'; b.t = 1 + rnd() * 3; } }
      E.set(pitch, b.h, 0, 'YXZ'); Q.setFromEuler(E);
      M4.compose(V.set(b.x, b.y, b.z), Q, SC.set(sx, 1, 1)); bdIM.setMatrixAt(n, M4);
      if (n !== i) { bdIM.getColorAt(i, cBall); bdIM.setColorAt(n, cBall); bdIM.instanceColor.needsUpdate = true; }
      n++;
    }
    bdIM.count = n; if (n) bdIM.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------------------------------- per frame
  let slow = 0, allowed = false, frT = 0, inParkNow = false, lastX = 0, lastZ = 0;
  const ballsShown = { croquet: false, frisbee: false };
  function tickGroups(dt, nowS) {
    let rugs = 0;
    for (const g of groups) {
      if (!g.on) continue;
      if (g.custom) continue;
      for (const c of g.chars) { if (c.base && c.pose !== c.base) setPose(c, c.base); c.ch.update(dt, 0); }
      if (g.rug !== undefined && g.chars.length) { M4.compose(V.set(g.x, 0, g.z), Q.setFromAxisAngle(UP, g.rugH || 0), SC.set(1, 1, 1)); rugIM.setMatrixAt(rugs, M4); rugIM.setColorAt(rugs, TMP_RUG[g.rug % TMP_RUG.length]); rugs++; }
    }
    rugIM.count = rugs; if (rugs) { rugIM.instanceMatrix.needsUpdate = true; rugIM.instanceColor.needsUpdate = true; }
    // frisbee: a throw every 3.2 s, alternate thrower; disc = ball slot 5 (a flattened sphere)
    if (fr.on && fr.a) {
      const T = 3.2, n = Math.floor(nowS / T), t = (nowS - n * T) / T, from = n & 1 ? fr.chars[1] : fr.chars[0], to = n & 1 ? fr.chars[0] : fr.chars[1];
      for (const c of fr.chars) { const o = c === from ? to : from; c.ch.group.rotation.y = Math.atan2(o.ch.group.position.x - c.ch.group.position.x, o.ch.group.position.z - c.ch.group.position.z); setPose(c, c === from && t < 0.18 ? 'throw' : 'stand'); }
      const k = clamp((t - 0.12) / 0.7, 0, 1), A = from.ch.group.position, B = to.ch.group.position;
      setBall(5, lerp(A.x, B.x, k), 1.2 + Math.sin(k * Math.PI) * 1.4, lerp(A.z, B.z, k), 0.13, 0.13);
      frT = 1; ballsShown.frisbee = true;
    } else if (ballsShown.frisbee) { hideBall(5); ballsShown.frisbee = false; }
    // croquet: one player at a time walks to a ball, lines up (crouch), strikes; balls creep between hoops
    if (crq.on && crq.c) {
      const T = 14, n = Math.floor(nowS / T), t = (nowS - n * T), pi = n & 1, p = crq.chars[pi], other = crq.chars[1 - pi], bi = n % 4, bl = crq.balls[bi];
      const r = hash(n + 300), dX = crq.c[0] + (r - 0.5) * 18, dZ = crq.c[1] + (hash(n + 301) - 0.5) * 16;
      const sX = bl[0] - Math.sin(r * 6.28) * 0.7, sZ = bl[1] - Math.cos(r * 6.28) * 0.7;
      const pp = p.ch.group.position, k = smooth(t / 5);
      if (p.cyc !== n) { p.cyc = n; p.wx = pp.x; p.wz = pp.z; }
      const nx = lerp(p.wx, sX, k), nz = lerp(p.wz, sZ, k);
      const sp = Math.hypot(nx - pp.x, nz - pp.z) / Math.max(dt, 1e-3);
      if (sp > 0.3) p.ch.group.rotation.y = Math.atan2(nx - pp.x, nz - pp.z); else p.ch.group.rotation.y = Math.atan2(bl[0] - pp.x, bl[1] - pp.z);
      pp.set(nx, 0, nz);
      setPose(p, t > 5.5 && t < 7.5 ? 'crouch' : 'stand'); p.ch.update(dt, sp > 0.3 ? Math.min(sp, 1.3) : 0);
      setPose(other, 'stand'); other.ch.update(dt, 0);
      if (t > 7.6) { const kk = smooth((t - 7.6) / 2.5); const bx = lerp(bl[0], dX, kk), bz = lerp(bl[1], dZ, kk); setBall(1 + bi, bx, 0.046, bz, 0.046); if (t > 13.8) { bl[0] = dX; bl[1] = dZ; } }
      for (let i = 0; i < 4; i++) if (i !== bi || t <= 7.6) setBall(1 + i, crq.balls[i][0], 0.046, crq.balls[i][1], 0.046);
      ballsShown.croquet = true;
    } else if (ballsShown.croquet) { for (let i = 1; i <= 4; i++) hideBall(i); ballsShown.croquet = false; }
    void frT;
  }
  const TMP_RUG = rugCols.map((c) => new THREE.Color(c));
  const dist = (x, z, px, pz) => Math.hypot(x - px, z - pz);

  return {
    cricket: cr, groups,
    /** the loading screen's share (game.warmups, university_parks.js): every lazily made figure made now, hidden — the
     *  match, the spectators, the picnics, readers, frisbee and croquet (~35 characters, one frame of ~40 ms on arrival) */
    warm() {
      if (!cr.made) makeCricket();
      for (const g of groups) if (!g.made) { g.made = true; try { g.make(g); } catch (e) { console.warn('[parks] people', g.name, e); } }
      // -> their geometries (each figure's own skin and props), for the loading screen to send up to the GPU: arriving, ~300
      // never-drawn buffers in one frame stalled the GPU process 40-60 ms three frames later
      const geos = new Set(); for (const c of chars) c.ch.group.traverse((o) => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry && o.layers.mask & 1) geos.add(o.geometry); });
      return [...geos];
    },
    stats: () => ({ allowed, inPark: inParkNow, cricket: cr.on ? (() => { const b = ballAt(game.time.now() / 1000); return { over: b.over, ball: b.change ? null : b.ball + 1, outcome: b.outcome, s: b.s }; })() : null, chars: chars.length, visible: chars.filter((c) => c.ch.group.visible).length, squirrels: sqIM.count, birds: bdIM.count, groups: groups.filter((g) => g.on).map((g) => g.name) }),
    update(dt, px, pz, far) {
      const h = game.time.hour, nowS = game.time.now() / 1000;
      if (Math.abs(px - lastX) + Math.abs(pz - lastZ) > 30) slow = 0;   // teleported: re-evaluate now
      lastX = px; lastZ = pz;
      if ((slow -= dt) <= 0) {
        slow = 1;
        allowed = !far && game.player.place === 'world';      // (on every graphics tier: who is in the Parks does not depend on it)
        inParkNow = inP(px, pz, park);
        const crOn = allowed && h >= 11 && h < 18.5 && dist(cx, cz, px, pz) < 230;
        if (crOn && !cr.made) makeCricket();
        if (crOn !== cr.on) { cr.on = crOn; show(cr.list, crOn); }
        for (const g of groups) {
          const on = allowed && h >= g.h0 && h < g.h1 && dist(g.x, g.z, px, pz) < 120;
          if (on && !g.made) { g.made = true; try { g.make(g); } catch (e) { console.warn('[parks] people', g.name, e); } }
          if (on !== g.on) { g.on = on; show(g.chars, on); }
        }
      }
      if (cr.on) tickCricket(dt, nowS); else if (cr.made) hideBall(0);
      tickGroups(dt, nowS);
      if (ballsOn) { ballIM.count = 6; ballIM.instanceMatrix.needsUpdate = true; } else ballIM.count = 0;
      ballIM.visible = ballsOn !== 0;
      const life = allowed && (inParkNow || inP(px + 20, pz, park) || inP(px - 20, pz, park));
      tickSquirrels(dt, px, pz, life && h > 6.5 && h < 20.5);
      tickBirds(dt, px, pz, life && h > 5.5 && h < 21, !!(game.input && game.input.run));
    },
  };
}
