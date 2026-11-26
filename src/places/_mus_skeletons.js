// SHOWPIECE: the skeletons of the Natural History Museum court — the T. rex cast (rearing), the Iguanodon cast (the
// old upright "tripod" mount), and seven whale and dolphin skeletons hung from the roof.
// Every skeleton is ONE InstancedMesh of a unit bone (each vertebra, neural spine, process, chevron, limb bone, toe and
// finger is an instance: a smooth knuckled bone) plus ONE merged smooth-shaded mesh for the pieces that are not
// bone-shaped (skull with its openings and teeth, jaws, curved ribs, pelvis and shoulder blades, the iron mount and
// the plinth): 2 draws per skeleton, the whales all in one pair. Facts: docs/research/museums.md §1.
//
// Interface: buildSkeletons(ctx) -> { trex, iguanodon, whales, dims }
//   each of trex / iguanodon / whales is a THREE.Group (origin on the floor at the plinth centre, facing +z, the
//   whales' group at the floor with each whale at its hanging height); ctx = { THREE } (unused hooks for a later pass).
//   dims = { trex: {len, plinth:[w, d]}, iguanodon: {...}, whales: [{name, len, x, y, z, rot}] } (interior coordinates
//   relative to the whales group).
import * as THREE from 'three';
import { Geo, museumMats } from './_mus_kit.js';
import { lathe, ball, tube, loft } from './_mus_fine.js';

const BONE_TRIS = 48;
/** unit bone along +z (0..1): rounded knuckles of radius 1 at the ends, a waisted shaft of 0.5; smooth normals */
function boneGeometry() {
  const pos = [], nor = [], idx = [], N = 6;
  const prof = [[0, -0.05], [0.96, 0.07], [0.52, 0.3], [0.52, 0.72], [0.92, 0.93], [0, 1.05]];   // [r, z]
  for (let i = 0; i < prof.length; i++) {
    const p = prof[i], a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)];
    let nr = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nr, nz) || 1; nr /= l; nz /= l;
    for (let k = 0; k < N; k++) { const an = (k / N) * Math.PI * 2, c = Math.cos(an), s = Math.sin(an); pos.push(c * p[0], s * p[0], p[1]); nor.push(c * nr, s * nr, i === 0 ? -1 : i === prof.length - 1 ? 1 : nz); }
  }
  for (let i = 0; i < prof.length - 1; i++) for (let k = 0; k < N; k++) {
    const a = i * N + k, b = i * N + (k + 1) % N, c = (i + 1) * N + k, d = (i + 1) * N + (k + 1) % N;
    if (i > 0) idx.push(a, b, d); if (i < prof.length - 2) idx.push(a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  g.normalizeNormals();
  return g;
}
let _bone = null, _mat = null, _solid = null;
const boneGeo = () => _bone || (_bone = boneGeometry());
const boneMat = () => _mat || (_mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, envMap: museumMats().env, envMapIntensity: 0.18, name: 'mus-bone' }));
const solidMat = () => _solid || (_solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, envMap: museumMats().env, envMapIntensity: 0.18, name: 'mus-bone-solid' }));
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const lerpTab = (tab, t) => { for (let i = 0; i < tab.length - 1; i++) if (t <= tab[i + 1][0]) { const a = tab[i], b = tab[i + 1], u = (t - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * Math.max(0, u); } return tab[tab.length - 1][1]; };

class Bones {
  constructor() { this.list = []; }
  /** a bone from a to b ([x,y,z]) of radius r (and optional flattening f: x-radius = r*f) */
  add(a, b, r, f = 1) { this.list.push([a, b, r, f]); return this; }
  /**
   * a smooth chain of vertebrae through pts (Catmull-Rom): n centra of radius r(t), each with a neural spine
   * (spine(t) long, a flat blade raked back), optional chevrons below the tail and transverse processes (lat(t)).
   */
  chain(pts, n, r, spine = null, chevron = null, gap = 0.2, lat = null) {
    const curve = new THREE.CatmullRomCurve3(pts.map(V));
    const out = [], len = curve.getLength();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, p = curve.getPointAt(t), tg = curve.getTangentAt(t), L = len / n * (1 - gap);
      const a = p.clone().addScaledVector(tg, -L / 2), b = p.clone().addScaledVector(tg, L / 2), rr = r(t);
      this.add(a.toArray(), b.toArray(), rr);
      const up = new THREE.Vector3(0, 1, 0).addScaledVector(tg, -tg.y).normalize(), side = new THREE.Vector3().crossVectors(up, tg).normalize();
      const top = p.clone().addScaledVector(up, rr * 0.7);
      if (spine) { const s = spine(t); if (s > 0.01) this.add(top.toArray(), top.clone().addScaledVector(up, s).addScaledVector(tg, -s * 0.22).toArray(), Math.min(L * 0.5, rr * 0.75), 0.22); }
      if (chevron) { const s = chevron(t); if (s > 0.01) this.add(p.clone().addScaledVector(up, -rr * 0.7).toArray(), p.clone().addScaledVector(up, -rr * 0.7 - s).addScaledVector(tg, -s * 0.35).toArray(), rr * 0.4, 0.4); }
      if (lat) { const s = lat(t); if (s > 0.01) for (const sd of [-1, 1]) this.add(p.clone().addScaledVector(side, sd * rr * 0.6).toArray(), p.clone().addScaledVector(side, sd * (rr * 0.6 + s)).addScaledVector(tg, -s * 0.1).toArray(), Math.min(L * 0.5, rr * 0.6), 0.25); }
      out.push({ p, tg, up, side, r: rr, t });
    }
    return out;
  }
  /** a leg/arm chain of joints, radii per segment; mirrored about x if mirror */
  limb(joints, radii, mirror = true, f = 1) {
    for (const s of mirror ? [1, -1] : [1]) for (let i = 0; i < joints.length - 1; i++) {
      const a = joints[i], b = joints[i + 1];
      this.add([a[0] * s, a[1], a[2]], [b[0] * s, b[1], b[2]], radii[Math.min(i, radii.length - 1)], f);
    }
  }
  /** -> InstancedMesh; colour varies a little bone to bone, and darkens downward (the light is from the roof) */
  mesh(color, yLo = 0, yHi = 6) {
    const m = new THREE.InstancedMesh(boneGeo(), boneMat(), this.list.length);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), A = new THREE.Vector3(), B = new THREE.Vector3(), S = new THREE.Vector3(), D = new THREE.Vector3();
    const c = new THREE.Color(color);
    this.list.forEach(([a, b, r, f], i) => {
      A.fromArray(a); B.fromArray(b); D.subVectors(B, A); const L = D.length() || 1e-3;
      q.setFromUnitVectors(Z, D.multiplyScalar(1 / L)); S.set(r * f, r, L);
      M.compose(A, q, S); m.setMatrixAt(i, M);
      const h = Math.max(0, Math.min(1, ((a[1] + b[1]) / 2 - yLo) / (yHi - yLo)));
      const k = (0.92 + 0.14 * (((i * 2654435761) >>> 0) % 1000) / 1000) * (0.8 + 0.2 * h);
      m.setColorAt(i, c.clone().multiplyScalar(k));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere(); m.frustumCulled = false; m.name = 'mus:bones';
    return m;
  }
}

/** curved ribs hanging from the vertebra records between t = from..to: len(u) long; swept back, flattened blades */
function ribs(G, recs, from, to, len, r, { spread = 1, sweep = 0.22, turn = 0.86 } = {}) {
  for (const v of recs) {
    if (v.t < from || v.t > to) continue;
    const L = len((v.t - from) / (to - from)); if (L < 0.06) continue;
    const Wd = L * 0.34 * spread, Hh = L * 0.4;
    for (const s of [-1, 1]) {
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const th = (k / 6) * Math.PI * turn;
        const p = v.p.clone().addScaledVector(v.up, v.r * 0.5 - Hh * (1 - Math.cos(th))).addScaledVector(v.side, s * (v.r * 0.5 + Wd * Math.sin(th))).addScaledVector(v.tg, -L * sweep * (k / 6));
        pts.push(p.toArray());
      }
      tube(G, 'solid', pts, (u) => r * (1.15 - 0.55 * u), 4, { f: 0.55, up: v.tg.toArray(), shade: (u) => 1 - 0.22 * u });
    }
  }
}

/**
 * A reptile skull in its own frame: back of the skull at z = 0, the snout tip at z = L, the upper tooth row near
 * y = 0. Each side is an open frame — the roof edge, the tooth-bearing edge and the bars between the openings (nostril,
 * antorbital fenestra, eye socket, temporal fenestra) — joined across the top; a lower jaw of two rami hinged at the
 * back, open by `open` rad. o: { top, bot: [[t, y/L]...], w: [[t, halfwidth/L]...], bars: [[tTop, tBot, r/L]...],
 * teeth: [t0, t1, n, len/L], jawTeeth, jawDepth, beak }
 */
function skull(G, L, o, open = 0.2) {
  const W = (t) => lerpTab(o.w, t) * L, yT = (t) => lerpTab(o.top, t) * L, yB = (t) => lerpTab(o.bot, t) * L;
  const samp = (tab, n = 9) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push([t, lerpTab(tab, t)]); } return out; };
  for (const s of [-1, 1]) {
    const P = (t, y, k = 1) => [s * W(t) * k, y, t * L];
    tube(G, 'solid', samp(o.top).map(([t, y]) => P(t, y * L, 0.72)), o.rt * L, 5, { f: 0.7, up: [s, 0, 0] });
    tube(G, 'solid', samp(o.bot).map(([t, y]) => P(t, y * L + o.rb * L * 0.8)), (u) => o.rb * L * (1.15 - 0.3 * u), 5, { f: 0.45, up: [s, 0, 0] });
    for (const [t0, t1, rr] of o.bars) tube(G, 'solid', [P(t0, yT(t0), 0.74), P((t0 + t1) / 2, (yT(t0) + yB(t1)) / 2, 0.96), P(t1, yB(t1) + o.rb * L)], rr * L, 4, { f: 0.4, up: [s, 0, 0] });
  }
  // the roof between the two sides (a low ridge down the middle), and the back wall of the skull
  loft(G, 'solid', samp(o.top).map(([t, y]) => [[-W(t) * 0.72, y * L, t * L], [0, y * L + 0.035 * L, t * L], [W(t) * 0.72, y * L, t * L]]), { closed: false, hint: [0, 1, 0] });
  ball(G, 'solid', 0, yT(0.1) * 0.55, 0.11 * L, W(0.1) * 0.62, yT(0.1) * 0.36, 0.13 * L, 8, 5, { shade: () => 0.8 });   // the braincase, in shadow inside
  tube(G, 'solid', [[-W(0) * 0.9, yB(0) + 0.02 * L, 0.01 * L], [-W(0) * 0.75, yT(0) * 0.9, 0], [0, yT(0) * 1.02, 0], [W(0) * 0.75, yT(0) * 0.9, 0], [W(0) * 0.9, yB(0) + 0.02 * L, 0.01 * L]], 0.035 * L, 5, { f: 0.6, up: [0, 0, 1] });
  // the snout: premaxilla (or a horny beak's core)
  ball(G, 'solid', 0, (yT(0.97) + yB(0.97)) / 2 + (o.beak ? -0.03 * L : 0.01 * L), 0.965 * L, W(0.97) * 1.05, (yT(0.97) - yB(0.97)) * (o.beak ? 0.62 : 0.56), 0.06 * L, 8, 5);
  const tooth = (x, y, z, len, r, dir) => lathe(G, 'solid', x, y, z, dir < 0 ? [[0.002, -len], [r * 0.7, -len * 0.45], [r, 0]] : [[r, 0], [r * 0.7, len * 0.45], [0.002, len]], 5, { shade: () => 1.12 });
  const tc = G.col.slice();
  if (o.teeth) { const [t0, t1, n, tl] = o.teeth; for (let i = 0; i < n; i++) { const t = t0 + (t1 - t0) * (i / (n - 1)), k = 0.65 + 0.35 * Math.sin((i / (n - 1)) * Math.PI) + 0.12 * ((i * 7) % 3 - 1); for (const s of [-1, 1]) tooth(s * W(t), yB(t) + 0.005 * L, t * L, tl * L * k, tl * L * 0.2, -1); } }
  // lower jaw, hinged at the back
  const jy = yB(0) - 0.02 * L, jd = o.jawDepth || 0.075;
  G.push(new THREE.Matrix4().makeTranslation(0, jy, 0.03 * L).multiply(new THREE.Matrix4().makeRotationX(open)));
  for (const s of [-1, 1]) {
    const J = (t, y) => [s * (t > 0.9 ? W(t) * 0.55 : W(t) * 0.98), y * L, t * L];
    tube(G, 'solid', [J(-0.02, 0.03), J(0.12, -0.02), J(0.4, -0.05), J(0.7, -0.045), J(0.94, -0.03)], (u) => jd * L * (1.1 - 0.62 * u), 5, { f: 0.38, up: [s, 0, 0], shade: (u, k) => 0.92 });
    if (o.jawTeeth) { const [t0, t1, n, tl] = o.jawTeeth; for (let i = 0; i < n; i++) { const t = t0 + (t1 - t0) * (i / (n - 1)), k = 0.7 + 0.3 * Math.sin((i / (n - 1)) * Math.PI); tooth(s * (t > 0.9 ? W(t) * 0.55 : W(t) * 0.96), (-0.045 + jd * 0.55) * L, t * L, tl * L * k, tl * L * 0.2, 1); } }
  }
  ball(G, 'solid', 0, -0.035 * L, 0.94 * L, W(0.94) * 0.62, jd * L * 0.5, 0.045 * L, 6, 4);   // the chin where the rami meet
  G.pop(); G.col = tc;
}

/** the plinth (a dark moulded timber base with a brass rail of labels), and the iron armature: posts with collars */
function plinthAndMount(G, w, d, h, rods, oz = 0) {
  G.color(0x33291f); G.box('solid', -w / 2 - 0.06, 0, oz - d / 2 - 0.06, w / 2 + 0.06, 0.07, oz + d / 2 + 0.06);
  G.color(0x4a3b2c); G.box('solid', -w / 2, 0.07, oz - d / 2, w / 2, h - 0.04, oz + d / 2);
  G.color(0x5a4a38); G.box('solid', -w / 2 - 0.04, h - 0.04, oz - d / 2 - 0.04, w / 2 + 0.04, h, oz + d / 2 + 0.04);
  G.color(0x8f8774); G.box('solid', -w / 2 + 0.12, h, oz - d / 2 + 0.12, w / 2 - 0.12, h + 0.012, oz + d / 2 - 0.12);    // sanded top
  for (const [x, z, y1, x1 = x, z1 = z] of rods) {
    G.color(0x23262a); tube(G, 'solid', [[x, h, z], [x, h + (y1 - h) * 0.6, z], [x1, y1, z1]], 0.04, 6);
    lathe(G, 'solid', x, h, z, [[0.16, 0], [0.16, 0.03], [0.06, 0.07]], 8);
    G.color(0x3a3d42); lathe(G, 'solid', x1, y1 - 0.06, z1, [[0.07, 0], [0.07, 0.1]], 6, { capTop: true });
  }
}

// ------------------------------------------------------------------------------------------------ T. rex (rearing)
const TREX_COL = 0xcdb38c, IGU_COL = 0xa98d68, WHALE_COL = 0xf0e6cf;
function trex() {
  const B = new Bones(), G = new Geo(), H = 0.35;    // plinth height
  const lift = (p) => [p[0], p[1] + H, p[2]];
  const spine = [[0, 0.75, -7.4], [0, 1.15, -6.4], [0, 1.8, -5.1], [0, 2.55, -3.6], [0, 3.15, -2.0], [0, 3.55, -0.6], [0, 3.75, 0.2], [0, 4.15, 1.3], [0, 4.65, 2.2], [0, 5.25, 2.75], [0, 5.6, 2.92]].map(lift);
  const recs = B.chain(spine, 56, (t) => 0.045 + 0.125 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * (t > 0.8 ? 1 - (t - 0.8) * 1.4 : 1),
    (t) => (t > 0.25 && t < 0.9 ? 0.36 * Math.sin(((t - 0.25) / 0.65) * Math.PI) + 0.14 : t <= 0.25 ? 0.1 + t * 0.6 : 0.12),
    (t) => (t > 0.04 && t < 0.55 ? 0.34 * (t / 0.55) * (1 - t * 0.6) + 0.04 : 0), 0.2,
    (t) => (t > 0.3 && t < 0.62 ? 0.16 : t >= 0.86 ? 0.1 : 0));
  G.color(TREX_COL);
  // the ribcage: long curved ribs from the shoulders back to the hips, shortening toward the neck; short neck ribs
  ribs(G, recs, 0.63, 0.86, (u) => 0.5 + 1.25 * Math.sin(0.25 + u * 2.3), 0.05, { spread: 1.0 });
  ribs(G, recs, 0.87, 0.97, () => 0.34, 0.03, { spread: 0.7, sweep: 0.5 });
  // gastralia: the belly basket, a few thin hoops under the trunk
  for (const v of recs) if (v.t > 0.64 && v.t < 0.76) { const y = -1.55; const c = v.p.clone().addScaledVector(v.up, y); tube(G, 'solid', [-1, -0.5, 0, 0.5, 1].map((s) => c.clone().addScaledVector(v.side, s * 0.42).addScaledVector(v.up, Math.abs(s) * 0.22).toArray()), 0.018, 4); }
  // legs: femur, tibia + fibula, metatarsus, three toes of three phalanges with claws
  B.limb([[0.5, 3.62, 0.02], [0.6, 2.25, 0.66], [0.58, 0.9, -0.02], [0.58, 0.16, 0.44]].map(lift), [0.16, 0.115, 0.085]);
  B.limb([[0.68, 2.2, 0.6], [0.66, 0.95, -0.04]].map(lift), [0.045]);
  for (const dx of [-0.2, 0, 0.2]) { const x0 = 0.58 + dx * 0.25, x1 = 0.58 + dx, zt = 1.02 - Math.abs(dx) * 0.9; B.limb([[x0, 0.16, 0.44], [(x0 + x1) / 2, 0.09, 0.44 + (zt - 0.44) * 0.5], [x1, 0.06, zt - 0.13], [x1, 0.02, zt + 0.07]].map(lift), [0.06, 0.05, 0.042]); }
  // tiny arms: shoulder blade (a flat strap along the ribs), coracoid, humerus, forearm, two clawed fingers
  for (const s of [-1, 1]) {
    tube(G, 'solid', [[s * 0.44, 4.95, 0.75], [s * 0.5, 4.6, 1.3], [s * 0.4, 4.25, 1.85]].map(lift), (u) => 0.1 + 0.05 * u, 5, { f: 0.3, up: [s, 0, 0] });
    ball(G, 'solid', s * 0.3, 4.15 + H, 2.0, 0.07, 0.17, 0.16, 6, 4);
  }
  B.limb([[0.4, 4.22, 1.9], [0.47, 3.82, 2.12], [0.44, 3.62, 2.44]].map(lift), [0.065, 0.045]);
  for (const dx of [-0.045, 0.045]) B.limb([[0.44 + dx * 0.4, 3.62, 2.44], [0.44 + dx, 3.5, 2.6], [0.44 + dx, 3.4, 2.66]].map(lift), [0.026, 0.02]);
  // pelvis: the long blade of the ilium, the pubis with its boot, the ischium
  for (const s of [-1, 1]) {
    loft(G, 'solid', [-1.0, -0.7, -0.2, 0.3, 0.75, 1.02].map((z, i) => { const hh = [0.1, 0.3, 0.42, 0.42, 0.3, 0.08][i], y = 3.86 + H + z * 0.12; return [[s * 0.3, y - hh * 0.9, z - 0.1], [s * 0.37, y, z - 0.1], [s * 0.3, y + hh * 0.55, z - 0.1], [s * 0.24, y, z - 0.1]]; }), { caps: true });
  }
  B.add(lift([0.22, 3.5, 0.3]), lift([0.1, 1.98, 0.86]), 0.085); B.add(lift([-0.22, 3.5, 0.3]), lift([-0.1, 1.98, 0.86]), 0.085);
  G.at(0, 1.92 + H, 0.86); ball(G, 'solid', 0, 0, 0.05, 0.11, 0.1, 0.42, 6, 5); G.pop();
  B.add(lift([0.2, 3.42, -0.5]), lift([0.08, 2.55, -1.3]), 0.07); B.add(lift([-0.2, 3.42, -0.5]), lift([-0.08, 2.55, -1.3]), 0.07);
  // skull (1.5 m): big openings, a row of serrated teeth, the jaw hanging open
  const sk = spine[spine.length - 1];
  G.push(new THREE.Matrix4().makeTranslation(0, sk[1] - 0.36, sk[2] - 0.12).multiply(new THREE.Matrix4().makeRotationX(0.3)));
  skull(G, 1.5, {
    top: [[0, 0.36], [0.12, 0.44], [0.3, 0.44], [0.5, 0.37], [0.78, 0.31], [0.93, 0.25], [1, 0.13]],
    bot: [[0, 0.03], [0.15, 0.07], [0.33, 0.0], [0.7, -0.01], [1, 0.03]],
    w: [[0, 0.3], [0.3, 0.28], [0.5, 0.18], [1, 0.1]], rt: 0.045, rb: 0.055,
    bars: [[0.02, 0.01, 0.045], [0.25, 0.2, 0.04], [0.45, 0.42, 0.035], [0.74, 0.72, 0.06], [0.9, 0.9, 0.035]],
    teeth: [0.36, 0.97, 13, 0.085], jawTeeth: [0.42, 0.9, 11, 0.06], jawDepth: 0.085,
  }, 0.3);
  G.pop();
  plinthAndMount(G, 3.6, 9.6, H, [[0, -0.2, 3.3 + H], [0, 1.75, 4.05 + H, 0, 1.6], [0, -3.5, 2.5 + H]], -1.9);   // the plinth runs back under the tail
  const group = new THREE.Group(); group.name = 'mus:trex';
  group.add(B.mesh(TREX_COL, 0.3, 6));
  G.build({ solid: solidMat() }, group, { name: 'mus-trex', cast: false });
  return { group, instances: B.list.length, dims: { len: 12.4, height: 6.4, plinth: [3.6, 9.6, H], centre: [0, -1.9] } };
}

// ------------------------------------------------------------------------------------------------ Iguanodon (upright)
function iguanodon() {
  const B = new Bones(), G = new Geo(), H = 0.3;
  const lift = (p) => [p[0], p[1] + H, p[2]];
  const spine = [[0, 0.05, -4.4], [0, 0.35, -3.6], [0, 1.0, -2.6], [0, 1.75, -1.4], [0, 2.4, -0.2], [0, 2.75, 0.3], [0, 3.35, 0.85], [0, 3.95, 1.25], [0, 4.45, 1.55], [0, 4.75, 1.8]].map(lift);
  const recs = B.chain(spine, 46, (t) => 0.045 + 0.095 * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * (t > 0.82 ? 1 - (t - 0.82) * 2 : 1),
    (t) => (t > 0.12 && t < 0.86 ? 0.3 * Math.sin(((t - 0.12) / 0.74) * Math.PI) + 0.1 : 0.07), (t) => (t > 0.04 && t < 0.45 ? 0.24 * (t / 0.45) + 0.03 : 0), 0.22,
    (t) => (t > 0.3 && t < 0.56 ? 0.12 : 0));
  G.color(IGU_COL);
  ribs(G, recs, 0.58, 0.84, (u) => 0.45 + 0.95 * Math.sin(0.25 + u * 2.3), 0.04, { spread: 0.95 });
  ribs(G, recs, 0.85, 0.95, () => 0.26, 0.025, { spread: 0.7, sweep: 0.5 });
  B.limb([[0.42, 2.6, -0.1], [0.5, 1.5, 0.37], [0.48, 0.58, -0.1], [0.48, 0.12, 0.26]].map(lift), [0.125, 0.095, 0.07]);
  B.limb([[0.57, 1.46, 0.33], [0.55, 0.62, -0.12]].map(lift), [0.04]);
  for (const dx of [-0.16, 0, 0.16]) { const x1 = 0.48 + dx, zt = 0.7 - Math.abs(dx) * 0.8; B.limb([[0.48 + dx * 0.3, 0.12, 0.26], [(0.48 + x1) / 2 + dx * 0.15, 0.07, 0.26 + (zt - 0.26) * 0.55], [x1, 0.03, zt]].map(lift), [0.052, 0.045]); }
  // arms with the famous thumb spike; shoulder blades
  for (const s of [-1, 1]) tube(G, 'solid', [[s * 0.36, 4.2, 0.7], [s * 0.42, 3.9, 1.0], [s * 0.36, 3.6, 1.3]].map(lift), (u) => 0.08 + 0.04 * u, 5, { f: 0.3, up: [s, 0, 0] });
  B.limb([[0.36, 3.62, 1.0], [0.46, 2.95, 1.32], [0.5, 2.38, 1.66]].map(lift), [0.07, 0.05]);
  B.limb([[0.42, 2.92, 1.38], [0.45, 2.4, 1.7]].map(lift), [0.03]);
  for (const dx of [-0.05, 0, 0.05]) B.limb([[0.48 + dx * 0.5, 2.38, 1.66], [0.48 + dx, 2.18, 1.82], [0.48 + dx, 2.06, 1.86]].map(lift), [0.026, 0.02]);
  for (const s of [-1, 1]) lathe(G, 'solid', s * 0.4, 2.4 + H, 1.7, [[0.045, 0], [0.03, 0.12], [0.002, 0.27]], 6);      // the thumb spike, pointing up
  for (const s of [-1, 1]) loft(G, 'solid', [-0.8, -0.5, 0, 0.45, 0.75].map((z, i) => { const hh = [0.08, 0.22, 0.3, 0.24, 0.07][i], y = 2.78 + H + z * 0.1; return [[s * 0.26, y - hh * 0.8, z - 0.15], [s * 0.32, y, z - 0.15], [s * 0.26, y + hh * 0.5, z - 0.15], [s * 0.21, y, z - 0.15]]; }), { caps: true });
  B.add(lift([0.16, 2.5, 0.2]), lift([0.1, 1.55, 0.7]), 0.055); B.add(lift([-0.16, 2.5, 0.2]), lift([-0.1, 1.55, 0.7]), 0.055);
  B.add(lift([0.16, 2.45, -0.4]), lift([0.08, 1.7, -1.2]), 0.05); B.add(lift([-0.16, 2.45, -0.4]), lift([-0.08, 1.7, -1.2]), 0.05);
  // a long horse-like skull with a toothless beak, angled down
  const sk = spine[spine.length - 1];
  G.push(new THREE.Matrix4().makeTranslation(0, sk[1] - 0.18, sk[2] - 0.05).multiply(new THREE.Matrix4().makeRotationX(0.6)));
  skull(G, 0.9, {
    top: [[0, 0.3], [0.2, 0.36], [0.5, 0.31], [0.82, 0.22], [1, 0.08]],
    bot: [[0, 0.03], [0.3, 0.0], [0.8, 0.0], [1, -0.03]],
    w: [[0, 0.21], [0.4, 0.17], [0.85, 0.1], [1, 0.11]], rt: 0.04, rb: 0.05,
    bars: [[0.03, 0.01, 0.04], [0.27, 0.23, 0.035], [0.46, 0.44, 0.04], [0.78, 0.78, 0.05]],
    teeth: [0.3, 0.72, 14, 0.022], jawTeeth: [0.3, 0.7, 12, 0.02], jawDepth: 0.07, beak: true,
  }, 0.12);
  G.pop();
  plinthAndMount(G, 3.0, 6.4, H, [[0, -0.4, 2.45 + H], [0, 0.95, 3.5 + H, 0, 0.85]], -0.9);
  const group = new THREE.Group(); group.name = 'mus:iguanodon';
  group.add(B.mesh(IGU_COL, 0.3, 5));
  G.build({ solid: solidMat() }, group, { name: 'mus-iguanodon', cast: false });
  return { group, instances: B.list.length, dims: { len: 8, height: 5.3, plinth: [3.0, 6.4, H], centre: [0, -0.9] } };
}

// ------------------------------------------------------------------------------------------------ whales
const WHALES = [
  { name: 'Rorqual (fin whale)', len: 13, kind: 'baleen', x: 0, y: 11.2, z: -2, rot: 0.04 },
  { name: 'Sperm whale', len: 10.5, kind: 'sperm', x: -8.6, y: 9.6, z: -6, rot: -0.1 },
  { name: 'Killer whale', len: 6.5, kind: 'toothed', x: 8.6, y: 9.4, z: -7, rot: 0.12 },
  { name: 'Bottlenose dolphin', len: 3, kind: 'toothed', x: -8.6, y: 9.2, z: 7, rot: 0.3 },
  { name: 'Common dolphin', len: 2.2, kind: 'toothed', x: 8.6, y: 9.0, z: 5, rot: -0.25 },
  { name: 'Harbour porpoise', len: 1.6, kind: 'toothed', x: 8.6, y: 9.2, z: 10, rot: 0.2 },
  { name: 'Pilot whale', len: 5.2, kind: 'toothed', x: 2.5, y: 9.8, z: 10.5, rot: 0.6 },
];
function whales() {
  const B = new Bones(), G = new Geo();
  for (const w of WHALES) {
    const L = w.len, c = Math.cos(w.rot), s = Math.sin(w.rot);
    const P = (x, y, z) => [w.x + x * c + z * s, w.y + y, w.z - x * s + z * c];
    // skull at +z
    const skullL = w.kind === 'baleen' ? L * 0.25 : w.kind === 'sperm' ? L * 0.3 : L * 0.17;
    const spinePts = [P(0, 0.02 * L, L / 2 - skullL), P(0, 0.04 * L, L * 0.15), P(0, 0.03 * L, -L * 0.15), P(0, 0, -L * 0.38), P(0, -0.02 * L, -L / 2)];
    const n = Math.max(18, Math.round(L * 2.9)), big = L > 4;
    const recs = B.chain(spinePts, n, (t) => (0.012 + 0.03 * Math.sin(Math.PI * (0.25 + 0.75 * t))) * L * 0.6,
      (t) => (t > 0.14 ? 0.055 * L * Math.sin(Math.PI * Math.min(1, t * 1.1)) : 0.012 * L), (t) => (t > 0.06 && t < 0.38 ? 0.032 * L : 0), 0.2,
      big ? (t) => (t > 0.3 && t < 0.64 ? 0.05 * L * Math.sin(Math.PI * (t - 0.3) / 0.34) + 0.015 * L : 0) : null);   // the wide lumbar processes of a whale
    G.color(WHALE_COL);
    ribs(G, recs, 0.64, 0.9, (u) => 0.19 * L * Math.sin(0.5 + u * 2.1), 0.0085 * L, { spread: 1.05, sweep: 0.3, turn: 0.78 });
    // flippers (pectoral): shoulder blade, humerus, radius and ulna, rows of finger bones
    for (const sd of [-1, 1]) {
      const sh = P(sd * 0.065 * L, -0.05 * L, L * 0.21), el = P(sd * 0.1 * L, -0.09 * L, L * 0.195), wr = P(sd * 0.15 * L, -0.105 * L, L * 0.15);
      B.add(sh, el, 0.014 * L);
      B.add(el, wr, 0.008 * L); B.add(P(sd * 0.1 * L, -0.09 * L, L * 0.18), P(sd * 0.145 * L, -0.105 * L, L * 0.132), 0.008 * L);
      for (let f = 0; f < 4; f++) { const a = P(sd * (0.155 + f * 0.004) * L, -0.107 * L, L * (0.15 - f * 0.012)), b = P(sd * (0.215 + (f === 1 ? 0.03 : f === 2 ? 0.02 : 0)) * L, -0.118 * L, L * (0.12 - f * 0.024)); const mid = a.map((v, i) => (v + b[i]) / 2); B.add(a, mid, 0.0048 * L); B.add(mid, b, 0.004 * L); }
      G.at(w.x, w.y, w.z, w.rot); ball(G, 'solid', sd * 0.06 * L, -0.02 * L, L * 0.225, 0.008 * L, 0.035 * L, 0.035 * L, 6, 4); G.pop();
    }
    // skull
    const z0 = L / 2 - skullL, z1 = L / 2;
    G.at(w.x, w.y, w.z, w.rot);
    const flat = (zs, wf, hf, yf) => loft(G, 'solid', zs.map((z, i) => { const ww = wf[i] * L, hh = hf[i] * L, y = yf[i] * L; return [[-ww, y, z], [-ww * 0.5, y + hh, z], [ww * 0.5, y + hh, z], [ww, y, z], [0, y - hh * 0.6, z]]; }), { caps: true });
    const jaw = (pts, r, teeth = 0, tl = 0) => { for (const sd of [-1, 1]) { const pp = pts.map((p) => [sd * p[0] * L, p[1] * L, p[2]]); tube(G, 'solid', pp, (u) => r * L * (1.2 - 0.6 * u), 5, { f: 0.6, up: [sd, 0, 0], shade: () => 0.94 }); for (let i = 0; i < teeth; i++) { const u = 0.35 + 0.6 * (i / teeth), k = Math.min(pp.length - 2, Math.floor(u * (pp.length - 1))), f = u * (pp.length - 1) - k, a = pp[k], b = pp[k + 1]; lathe(G, 'solid', a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + r * L * 0.4, a[2] + (b[2] - a[2]) * f, [[tl * L * 0.28, 0], [0.002, tl * L]], 4); } } };
    const sp = (f) => z0 + skullL * f;
    if (w.kind === 'baleen') {
      // a long, flat, gently arched rostrum; a low braincase; two great bowed jaw bones
      ball(G, 'solid', 0, 0.022 * L, sp(0.1), 0.062 * L, 0.036 * L, skullL * 0.2, 8, 5);
      flat([sp(0.12), sp(0.4), sp(0.75), sp(1.0)], [0.072, 0.05, 0.03, 0.006], [0.02, 0.016, 0.01, 0.004], [0.012, 0.022, 0.016, -0.004]);
      for (const sd of [-1, 1]) tube(G, 'solid', [[sd * 0.07 * L, 0.02 * L, sp(0.14)], [sd * 0.085 * L, 0.0, sp(0.08)]], 0.014 * L, 5);
      jaw([[0.075, -0.028, sp(0.02)], [0.1, -0.05, sp(0.35)], [0.085, -0.052, sp(0.7)], [0.012, -0.03, sp(1.02)]], 0.011);
    } else if (w.kind === 'sperm') {
      // the basin of a sperm whale's skull behind a broad flat rostrum; a thin rod of a lower jaw set with teeth
      ball(G, 'solid', 0, 0.045 * L, sp(0.1), 0.07 * L, 0.06 * L, skullL * 0.16, 8, 5);
      for (const sd of [-1, 1]) tube(G, 'solid', [[sd * 0.02 * L, 0.1 * L, sp(0.08)], [sd * 0.07 * L, 0.07 * L, sp(0.18)], [sd * 0.062 * L, 0.02 * L, sp(0.42)]], 0.012 * L, 5, { f: 0.5, up: [sd, 0, 0] });
      flat([sp(0.14), sp(0.45), sp(0.8), sp(1.0)], [0.075, 0.062, 0.035, 0.01], [0.022, 0.014, 0.008, 0.004], [0.0, 0.0, -0.004, -0.008]);
      jaw([[0.06, -0.035, sp(0.05)], [0.03, -0.05, sp(0.35)], [0.006, -0.052, sp(0.55)], [0.004, -0.05, sp(0.98)]], 0.009, 9, 0.014);
    } else {
      // a domed braincase and a beak; orcas and pilot whales with teeth worth showing
      ball(G, 'solid', 0, 0.03 * L, sp(0.2), 0.052 * L, 0.048 * L, skullL * 0.3, 8, 5);
      flat([sp(0.3), sp(0.55), sp(0.85), sp(1.0)], [0.045, 0.026, 0.016, 0.006], [0.02, 0.012, 0.008, 0.004], [0.004, -0.004, -0.008, -0.01]);
      for (const sd of [-1, 1]) tube(G, 'solid', [[sd * 0.05 * L, 0.02 * L, sp(0.3)], [sd * 0.06 * L, 0.0, sp(0.42)], [sd * 0.045 * L, -0.012 * L, sp(0.36)]], 0.007 * L, 4);
      jaw([[0.048, -0.02, sp(0.12)], [0.034, -0.03, sp(0.5)], [0.006, -0.028, sp(0.99)]], 0.008, big ? 8 : 0, 0.012);
    }
    // the tail's last vertebrae dwindle to nothing; hanging rods to the roof with a spreader bar at each
    G.color(0x2c3036);
    for (const zz of [-L * 0.3, L * 0.22]) { G.beam('solid', [0, 0.05 * L, zz], [0, 18 - w.y, zz], 0.014); G.beam('solid', [-0.035 * L, 0.02 * L, zz], [0.035 * L, 0.02 * L, zz], 0.012); }
    G.pop();
  }
  const group = new THREE.Group(); group.name = 'mus:whales';
  group.add(B.mesh(WHALE_COL, 8.6, 11.8));
  G.build({ solid: solidMat() }, group, { name: 'mus-whales', cast: false });
  return { group, instances: B.list.length, dims: WHALES };
}

export function* buildSkeletons(ctx = {}) {      // (a generator: core/interiors.js builds a room a piece a frame)
  const t = trex(); yield; const i = iguanodon(); yield; const w = whales(); yield;
  return { trex: t.group, iguanodon: i.group, whales: w.group, dims: { trex: t.dims, iguanodon: i.dims, whales: w.dims }, instances: t.instances + i.instances + w.instances, boneTris: BONE_TRIS };
}
