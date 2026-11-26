// Port Meadow — the static dressing, merged into one mesh per material (owned by places/port_meadow.js):
//   river     the Thames: a three-strip ribbon in the city's water material (aEdge 1 at the banks, 0 mid-channel)
//   flood     the shallow flood water over the low ground (same material, own mesh: shown only on flood days)
//   gravel    the white pebble path, the Thames Path along the bank, the car park at the end of Walton Well Road
//   timber    post-and-rail fence along the railway, the field gate, the kissing gate, the notice-board frame
//   paint     the white iron bowstring footbridge: deck, two arch ribs, hangers, railings
//   board     the notice board's painted face (lettering texture)
//   trees     willows and a few crack willows along the banks (world tree model, one instanced draw per species)
//   build(game) -> { meshes, trees, colliders: {water: [pts, w], walk: [poly], segs: [[x1,z1,x2,z2]], circles}, stats }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RIVER, PATH, CAR_PARK, FENCE, GATE, BRIDGE, BOARD, FLOODS, SURF_Y, riverX, h01 } from './_pm_site.js';
import { buildTrees } from './_grounds_static.js';
import { puddles } from './_pm_ground.js';

export class Acc {
  constructor() { this.g = new Map(); }
  push(key, geo) { let a = this.g.get(key); if (!a) this.g.set(key, (a = [])); a.push(geo.index ? geo.toNonIndexed() : geo); }
  box(key, K, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0) {
    const g = K.box(w, h, d); g.rotateZ(rz); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); this.push(key, g);
  }
  /** a box along a segment (a beam / rail / rib) from a to b ([x, y, z]), section t × h */
  beam(key, K, a, b, t, h) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
    const g = K.box(t, h, L), m = new THREE.Matrix4();
    const dir = new THREE.Vector3(dx, dy, dz).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    m.compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m); this.push(key, g);
  }
  merged(key) {
    const L = this.g.get(key); if (!L || !L.length) return null;
    const names = Object.keys(L[0].attributes).filter((n) => L.every((q) => q.attributes[n]));
    for (const q of L) for (const n of Object.keys(q.attributes)) if (!names.includes(n)) q.deleteAttribute(n);
    const g = mergeGeometries(L); for (const q of L) q.dispose();
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

/** a river ribbon: three strips across (bank, centre, bank) with aEdge; pts centre line, w width */
export function riverGeometry(pts, w, y) {
  const P = [], E = [], UV = [], I = [];
  const across = [-1, -0.55, 0, 0.55, 1], edge = [1, 0.25, 0, 0.25, 1];
  let along = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    if (i) along += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (let k = 0; k < across.length; k++) { const s = across[k] * (w / 2); P.push(pts[i][0] + nx * s, y, pts[i][1] + nz * s); E.push(edge[k]); UV.push(s, along); }
  }
  const n = across.length;
  for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < n - 1; k++) { const a = i * n + k, b = a + 1, c = a + n, d = c + 1; I.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(E, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); upFacing(g); g.computeBoundingSphere();
  return g;
}
/** flip every triangle of an indexed flat geometry whose normal points down (front faces must face the sky) */
function upFacing(g) {
  const P = g.attributes.position.array, I = g.index.array;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ny = (P[c + 2] - P[a + 2]) * (P[b] - P[a]) - (P[c] - P[a]) * (P[b + 2] - P[a + 2]);
    if (ny > 0) { const k = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = k; }
  }
  g.computeVertexNormals();
}
/** densify a polyline to steps of at most d metres, with a gentle wobble (rivers are not straight between survey points) */
export function densify(pts, d, wob = 0, seed = 1) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / d));
    for (let k = 0; k < n; k++) { const t = k / n, j = wob ? (h01(seed, i * 97 + k) - 0.5) * wob * Math.sin(Math.PI * t) : 0; out.push([a[0] + (b[0] - a[0]) * t + j, a[1] + (b[1] - a[1]) * t]); }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}
/** smooth 1D noise in [0, 1] (deterministic) */
const sn = (t) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return h01(i, 77) + (h01(i + 1, 77) - h01(i, 77)) * u; };
/** flat polygon (fan from centroid: the flood blobs are star-shaped) with aEdge 1 on the rim, 0 inside */
function floodGeometry(ring, y) {
  let cx = 0, cz = 0; for (const p of ring) { cx += p[0] / ring.length; cz += p[1] / ring.length; }
  const P = [cx, y, cz], E = [0], UV = [cx, cz], I = [];
  // two rings: an inner one (aEdge 0.15) at 80 %, the rim (1)
  for (const [k, e] of [[0.8, 0.15], [1, 1]]) for (const p of ring) { const x = cx + (p[0] - cx) * k, z = cz + (p[1] - cz) * k; P.push(x, y, z); E.push(e); UV.push(x, z); }
  const n = ring.length;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; I.push(0, 1 + j, 1 + i); I.push(1 + i, 1 + j, 1 + n + i, 1 + j, 1 + n + j, 1 + n + i); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aEdge', new THREE.Float32BufferAttribute(E, 1)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); upFacing(g);
  return g;
}

/** the notice board's face: painted lettering on a canvas */
function boardTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384;
  const x = c.getContext('2d');
  x.fillStyle = '#1f3a2a'; x.fillRect(0, 0, 512, 384);
  x.strokeStyle = '#e8e0c8'; x.lineWidth = 6; x.strokeRect(10, 10, 492, 364);
  x.fillStyle = '#f1ead2'; x.textAlign = 'center';
  x.font = 'bold 46px serif'; x.fillText('PORT MEADOW', 256, 70);
  x.font = '22px serif';
  const L = ['Common land of the Freemen of Oxford', 'and the Commoners of Wolvercote', '', 'Horses and cattle graze here freely.', 'Please do not feed the animals.', 'Keep dogs under close control.', 'Close the gate behind you.', '', 'The meadow floods: take care by the river.'];
  L.forEach((t, i) => x.fillText(t, 256, 118 + i * 27));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** a box without its top and bottom faces (BoxGeometry groups: +x, -x, +y, -y, +z, -z), moved to (x, y, z) */
function sides(g, x, y, z) {
  const n = g.index ? g.toNonIndexed() : g, out = new THREE.BufferGeometry();
  for (const [nm, at] of Object.entries(n.attributes)) { const k = at.itemSize, src = at.array, dst = new Float32Array(24 * k); dst.set(src.subarray(0, 12 * k), 0); dst.set(src.subarray(24 * k, 36 * k), 12 * k); out.setAttribute(nm, new THREE.BufferAttribute(dst, k)); }
  out.translate(x, y, z); return out;
}

export function build(game) {
  const W = game.world, K = W.interiorKit, A = new Acc(), out = { meshes: [], trees: [], colliders: { segs: [], circles: [], walk: [] }, stats: {} };
  // ---- the river
  const rp = densify(RIVER.pts, 24, 7, 3);
  out.riverPts = rp;
  const water = W.mats.water;
  // the river and the standing puddles by the gate and on the path: one mesh, one draw
  const river = new THREE.Mesh(mergeGeometries([riverGeometry(rp, RIVER.w, SURF_Y), ...puddles(0.06)].map((g) => { const n = g.toNonIndexed ? (g.index ? g.toNonIndexed() : g) : g; for (const k of Object.keys(n.attributes)) if (!['position', 'aEdge', 'uv', 'normal'].includes(k)) n.deleteAttribute(k); if (!n.attributes.normal) n.computeVertexNormals(); return n; })), water);
  river.name = 'pm:river'; river.receiveShadow = false; river.userData.airFar = 3000;
  out.meshes.push(river); out.river = river;
  out.colliders.water = [rp, RIVER.w];
  // banks: a thin muddy strip each side (gravel key tinted) — part of the gravel mesh below
  // ---- flood water (own mesh, toggled)
  {
    // a soft, ragged edge: the rim densified to 4 m and pushed in and out by a smooth noise (no straight runs), and a
    // scatter of small pools just outside it (the ground is not equally low everywhere); the wet margin round it is
    // _pm_ground.js's decals
    const fl = [];
    FLOODS.forEach((F, f) => {
      let cx = 0, cz = 0; for (const p of F) { cx += p[0] / F.length; cz += p[1] / F.length; }
      const rim = densify(F.concat([F[0]]), 4, 0, 9).slice(0, -1).map(([x, z], i) => { const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1, o = 7 * (sn(i * 0.11 + f * 7) - 0.5) + 2.5 * (sn(i * 0.47 + f * 3 + 11) - 0.5); return [x + (dx / l) * o, z + (dz / l) * o]; });
      fl.push(floodGeometry(rim, SURF_Y + 0.005));
      for (let k = 0; k < 22; k++) {
        const i = Math.floor(h01(f * 50 + k, 3) * rim.length), [x, z] = rim[i], dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1, d = 3 + 12 * h01(f * 50 + k, 5), r = 1.2 + 3.5 * h01(f * 50 + k, 7);
        const px = x + (dx / l) * d, pz = z + (dz / l) * d, ring = [];
        for (let j = 0; j < 9; j++) { const a = (j / 9) * Math.PI * 2, rr = r * (0.75 + 0.5 * h01(f * 500 + k * 9 + j, 9)); ring.push([px + Math.cos(a) * rr * 1.3, pz + Math.sin(a) * rr]); }
        fl.push(floodGeometry(ring, SURF_Y + 0.004));
      }
    });
    const g = mergeGeometries(fl); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, water); m.name = 'pm:flood'; m.visible = false; m.receiveShadow = false;
    out.meshes.push(m); out.flood = m;
  }
  // ---- gravel: the paths and the car park (flat ribbons just above the ground)
  const gy = 0.05;
  const ribbon = (pts, w) => { const g = W.ribbon(pts, w, gy); A.push('gravel', g); };
  ribbon(densify(PATH, 8, 1.4, 5), 2.6);
  // the Thames Path: a worn track 7 m in from the east bank, from the bridge north to the box edge
  { const tp = []; for (let z = BRIDGE.z - 4; z > -1830; z -= 20) tp.push([riverX(z) + RIVER.w / 2 + 6 + 1.5 * Math.sin(z / 37), z]); ribbon(tp, 1.6); out.towpath = tp; }
  // the west bank: a narrow path from the bridge north (the Binsey side)
  { const tp = []; for (let z = BRIDGE.z - 3; z > -1830; z -= 25) tp.push([riverX(z) - RIVER.w / 2 - 5, z]); ribbon(tp, 1.3); }
  A.push('gravel', W.flat(CAR_PARK, gy));
  // the road on from the over-bridge to the car park
  ribbon([[-899.1, -841], [-906, -846], [-912, -850]], 5.5);
  // ---- fence: post and rail, posts every 2.6 m, gaps for the gates
  const gapA = GATE.x - GATE.w / 2, gapB = GATE.x + GATE.w / 2, kiss = [GATE.x + GATE.w / 2 + 1.4, GATE.z];
  const runs = [];
  for (let i = 0; i < FENCE.length - 1; i++) runs.push([FENCE[i], FENCE[i + 1]]);
  for (const [a, b] of runs) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    const on = (x, z) => !(Math.abs(z - GATE.z) < 0.5 && ((x > gapA - 0.05 && x < gapB + 0.05) || Math.abs(x - kiss[0]) < 0.9));
    // posts every 3 m (no top or bottom faces), rails as one beam per unbroken stretch
    let run0 = null, last = null;
    const close = () => { if (run0 && last && Math.hypot(last[0] - run0[0], last[1] - run0[1]) > 0.5) { for (const y of [0.55, 1.05]) A.beam('timber', K, [run0[0], y, run0[1]], [last[0], y, last[1]], 0.06, 0.11); out.colliders.segs.push([run0[0], run0[1], last[0], last[1]]); } run0 = null; };
    for (let s = 0; s <= L + 0.01; s += 0.5) {
      const x = a[0] + ux * s, z = a[1] + uz * s;
      if (!on(x, z)) { close(); continue; }
      if (!run0) run0 = [x, z];
      last = [x, z];
      if (Math.abs((s / 3) - Math.round(s / 3)) < 0.01 || s + 0.5 > L) A.push('timber', sides(K.box(0.13, 1.2, 0.13), x, 0.6, z));
    }
    close();
  }
  // the field gate (five-bar, closed) — players climb it ([E]); the kissing gate beside it is the way through
  {
    const z = GATE.z, x0 = gapA + 0.15, x1 = gapB - 0.15;
    for (const x of [gapA, gapB]) A.box('timber', K, x, 0.7, z, 0.2, 1.4, 0.2);
    for (let k = 0; k < 5; k++) A.beam('timber', K, [x0, 0.25 + k * 0.24, z], [x1, 0.25 + k * 0.24, z], 0.05, 0.1);
    A.beam('timber', K, [x0, 0.25, z], [x1, 1.21, z], 0.05, 0.1);
    for (const x of [x0 + 0.05, x1 - 0.05]) A.box('timber', K, x, 0.73, z, 0.1, 1.0, 0.06);
    out.colliders.segs.push([gapA, z, gapB, z]);
    out.gateAt = [GATE.x, z];
    // kissing gate: a small V-shaped pen (open to walk round)
    const [kx, kz] = kiss;
    for (const dx of [-0.75, 0.75]) A.box('timber', K, kx + dx, 0.6, kz, 0.12, 1.2, 0.12);
    A.beam('timber', K, [kx - 0.7, 1.0, kz + 0.6], [kx + 0.7, 1.0, kz + 0.6], 0.05, 0.1);
    A.box('timber', K, kx, 0.55, kz + 0.6, 0.08, 1.1, 0.08);
    A.beam('timber', K, [kx - 0.1, 1.0, kz], [kx + 0.5, 1.0, kz - 0.55], 0.04, 0.08);
    A.beam('timber', K, [kx - 0.1, 0.5, kz], [kx + 0.5, 0.5, kz - 0.55], 0.04, 0.08);
  }
  // ---- the notice board inside the gate
  {
    const [bx, bz] = BOARD;
    for (const dx of [-0.75, 0.75]) A.box('timber', K, bx + dx, 0.95, bz, 0.1, 1.9, 0.1);
    A.box('timber', K, bx, 1.95, bz, 1.8, 0.06, 0.32);
    A.box('timber', K, bx, 1.45, bz - 0.01, 1.56, 1.04, 0.04);
    const face = new THREE.PlaneGeometry(1.44, 1.0); face.rotateY(Math.PI); face.translate(bx, 1.45, bz - 0.04);   // faces north (-z): read from inside the meadow
    const fm = new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.8 });
    const fmesh = new THREE.Mesh(face, fm); fmesh.name = 'pm:board'; out.meshes.push(fmesh);
    out.colliders.circles.push([bx - 0.75, bz, 0.2], [bx + 0.75, bz, 0.2]);
  }
  // ---- the footbridge: flat deck on two iron beams, a bowstring arch rib each side with hangers, railings
  {
    const B0 = BRIDGE, z = B0.z, hw = B0.w / 2, span = B0.x1 - B0.x0, mx = (B0.x0 + B0.x1) / 2, dy = 0.06;
    A.box('deck', K, mx, dy - 0.04, z, span, 0.1, B0.w);
    for (const s of [-1, 1]) {
      A.box('paint', K, mx, -0.2, z + s * (hw + 0.05), span, 0.36, 0.12);                     // edge girder
      const N = 12, pts = [];
      for (let i = 0; i <= N; i++) { const t = i / N, x = B0.x0 + 3 + (span - 6) * t, y = 0.2 + B0.arch * 4 * t * (1 - t); pts.push([x, y, z + s * (hw + 0.08)]); }
      for (let i = 0; i < N; i++) A.beam('paint', K, pts[i], pts[i + 1], 0.16, 0.22);
      for (let i = 1; i < N; i++) A.beam('paint', K, [pts[i][0], 0.05, pts[i][2]], pts[i], 0.05, 0.05);        // hangers
      A.beam('paint', K, [B0.x0, 1.05, z + s * (hw - 0.02)], [B0.x1, 1.05, z + s * (hw - 0.02)], 0.06, 0.06);   // handrail
      A.beam('paint', K, [B0.x0, 0.55, z + s * (hw - 0.02)], [B0.x1, 0.55, z + s * (hw - 0.02)], 0.03, 0.03);
      for (let x = B0.x0; x <= B0.x1 + 0.01; x += 1.7) A.box('paint', K, x, 0.55, z + s * (hw - 0.02), 0.05, 1.05, 0.05);
      out.colliders.segs.push([B0.x0, z + s * hw, B0.x1, z + s * hw]);
      // abutments: low stone piers at the ends
      for (const x of [B0.x0 + 0.8, B0.x1 - 0.8]) A.box('pier', K, x, -0.1, z + s * (hw + 0.1), 1.6, 0.5, 0.5);
    }
    out.colliders.walk.push([[B0.x0, z - hw], [B0.x1, z - hw], [B0.x1, z + hw], [B0.x0, z + hw]]);
  }
  // ---- materials, meshes
  const mats = {
    gravel: W.layerMaterial ? W.layerMaterial(W.mats.gravel, 'path') : W.mats.gravel,
    timber: new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 0.95, map: W.mats.wood && W.mats.wood.map || null, name: 'pm:timber' }),
    paint: new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.55, metalness: 0.1, name: 'pm:paint' }),
    deck: new THREE.MeshStandardMaterial({ color: 0x6d6255, roughness: 0.9, name: 'pm:deck' }),
    pier: W.mats.stone,
  };
  for (const key of ['gravel', 'timber', 'paint', 'deck', 'pier']) {
    const g = A.merged(key); if (!g) continue;
    const m = new THREE.Mesh(g, mats[key]); m.name = 'pm:' + key; m.castShadow = key !== 'gravel'; m.receiveShadow = true;
    out.meshes.push(m); out.stats[key] = g.attributes.position.count / 3;
  }
  // ---- willows on both banks (city tree model), a crack willow or two in the meadow by the river
  const trees = [];
  for (let i = 0; i < 40; i++) {
    const z = -720 - i * 28 - 10 * h01(i, 1), side = h01(i, 2) < 0.7 ? -1 : 1;
    if (Math.abs(z - BRIDGE.z) < 14 || h01(i, 3) > 0.55) continue;
    const x = riverX(z) + side * (RIVER.w / 2 + 2.5 + 3 * h01(i, 4));
    trees.push({ sp: 'willow', x, z, h: 9 + 6 * h01(i, 5) });
  }
  // the Binsey side: a ragged line of field trees beyond the west bank path closes the view across the river
  for (let i = 0; i < 48; i++) {
    const z = -700 - i * 24 - 8 * h01(i, 11); if (h01(i, 12) > 0.68 || Math.abs(z - BRIDGE.z) < 10) continue;
    trees.push({ sp: h01(i, 13) < 0.25 ? 'willow' : 'broad', x: Math.max(-1187, riverX(z) - RIVER.w / 2 - 10 - 6 * h01(i, 14)), z, h: 11 + 7 * h01(i, 15) });
  }
  try { out.trees = buildTrees(W, trees); } catch (e) { console.warn('[port_meadow] trees', e); }
  for (const t of out.trees) t.name = 'pm:' + t.name;
  out.treeList = trees;
  for (const t of trees) out.colliders.circles.push([t.x, t.z, 0.5]);
  return out;
}
