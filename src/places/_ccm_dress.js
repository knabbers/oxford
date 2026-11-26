// Christ Church Meadow — hand-built dressing: the closed field gates (leaf + collider + "climb over"), notice boards at
// the public gates, reeds along the meadow banks of the Isis and the Cherwell. All static, merged per spot, one shared
// material (a small canvas atlas: the boards' lettering + a white texel for the vertex-coloured ironwork).
// Wording on the boards is invented and neutral; no crests or logos.
import * as THREE from 'three';
import { gateSpots, GATE_W, RAIL_H, pointInPoly } from './_ccm_map.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color(), _n = new THREE.Vector3();
const WHITE_UV = [0.995, 0.005];

/** merge buffer: positions, normals, vertex colours (linear), uvs */
export class MB {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.tris = 0; this.base = new THREE.Matrix4(); }
  at(x, y, z, h = 0) { this.base.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, h, 0)), _s.set(1, 1, 1)); return this; }
  add(geo, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, uvFn = null) {
    const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(1, 1, 1)).premultiply(this.base);
    const nm = new THREE.Matrix3().getNormalMatrix(_m);
    _c.set(color);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); this.p.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); this.n.push(_n.x, _n.y, _n.z);
      this.c.push(_c.r, _c.g, _c.b);
      if (uvFn && U) { const uv = uvFn(U.getX(i), U.getY(i)); this.u.push(uv[0], uv[1]); } else this.u.push(WHITE_UV[0], WHITE_UV[1]);
    }
    this.tris += P.count / 3; if (g !== geo) g.dispose(); geo.dispose();
    return this;
  }
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry, rx, rz); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------------------------------------ boards
// [key, title, lines] — invented, neutral wording
export const BOARDS = [
  ['meadow', 'CHRIST CHURCH MEADOW', ['Open to visitors during daylight hours.', 'The gates are locked at dusk.', 'No cycling  ·  Dogs on leads, please', 'Please keep to the paths.']],
  ['cattle', 'CATTLE GRAZING', ['Please keep out of the fields', 'and close the gate behind you.']],
  ['river', 'RIVERSIDE WALK', ['Deep water and steep banks.', 'Rowing crews train from early morning.', 'Please take care.']],
];
const ROW = 256;
function boardAtlas() {
  const W = 512, H = ROW * BOARDS.length + 8, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  BOARDS.forEach(([, title, lines], i) => {
    const y = i * ROW;
    g.fillStyle = '#1d3326'; g.fillRect(0, y, W, ROW);
    g.strokeStyle = '#c9b98a'; g.lineWidth = 6; g.strokeRect(10, y + 10, W - 20, ROW - 20);
    g.fillStyle = '#efe6c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 38px Georgia, serif'; g.fillText(title, W / 2, y + 52);
    g.fillRect(70, y + 84, W - 140, 3);
    g.font = '25px Georgia, serif'; lines.forEach((l, k) => g.fillText(l, W / 2, y + 120 + k * 33));
  });
  g.fillStyle = '#ffffff'; g.fillRect(W - 8, H - 8, 8, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, H };
}

/** a notice board on two posts facing heading h (the board's face looks along +z after rotation by h) */
function board(mb, key, H) {
  const i = BOARDS.findIndex((b) => b[0] === key), v0 = 1 - ((i + 1) * ROW) / H, v1 = 1 - (i * ROW) / H;
  const post = 0x1a1e1b;
  for (const sx of [-0.52, 0.52]) mb.box(0.07, 1.75, 0.07, sx, 0, -0.03, post);
  mb.box(1.12, 0.78, 0.05, 0, 0.92, -0.06, 0x1d3326);                                                           // backing
  mb.add(new THREE.PlaneGeometry(1.04, 0.52), 0xffffff, 0, 1.31, -0.03, 0, 0, 0, (u, v) => [0.01 + u * 0.98, v0 + 0.01 + (v1 - v0 - 0.02) * v]);   // face
  mb.box(1.2, 0.05, 0.12, 0, 1.7, -0.06, post);                                                                  // little roof
}

/** a closed iron estate field gate across the gap [x0,z0]-[x1,z1] (two posts, five bars, a brace) */
function fieldGate(mb, len) {
  const iron = 0x16191a, h = RAIL_H + 0.05, L = len - 0.3;
  for (const sx of [-len / 2, len / 2]) { mb.box(0.13, h + 0.25, 0.13, sx, 0, 0, iron); mb.add(new THREE.SphereGeometry(0.08, 8, 5), iron, sx, h + 0.3, 0); }
  const x0 = -len / 2 + 0.12;
  for (let k = 0; k < 5; k++) { const y = 0.22 + (k * (h - 0.3)) / 4; mb.box(L, k === 4 ? 0.06 : 0.035, 0.035, x0 + L / 2, y, 0, iron); }
  for (const sx of [x0 + 0.02, x0 + L - 0.02]) mb.box(0.05, h - 0.12, 0.05, sx, 0.15, 0, iron);
  mb.box(0.035, Math.hypot(L * 0.62, h - 0.4), 0.03, x0 + L * 0.31, 0.2, 0, iron, 0, 0, -Math.atan2(L * 0.62, h - 0.4));      // brace
  mb.box(0.035, h - 0.35, 0.03, x0 + L * 0.62, 0.2, 0, iron);
  mb.box(0.12, 0.12, 0.08, x0 + L - 0.05, h - 0.42, 0.05, 0x3a3f40);                                              // latch
}

// ------------------------------------------------------------------------------------------------ reeds
function reedTexture() {
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 46; i++) {
    const x = 6 + r() * (W - 12), h = H * (0.45 + r() * 0.52), lean = (r() - 0.5) * 26, t = 0.7 + r() * 0.4, dry = r() < 0.25;
    g.strokeStyle = dry ? `rgb(${Math.round(150 * t)},${Math.round(138 * t)},${Math.round(84 * t)})` : `rgb(${Math.round(82 * t)},${Math.round(118 * t)},${Math.round(52 * t)})`;
    g.lineWidth = 1.4 + r() * 1.6;
    g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + lean * 0.2, H - h * 0.6, x + lean, H - h); g.stroke();
    if (r() < 0.3) { g.fillStyle = `rgba(${Math.round(110 + 30 * r())},${Math.round(80 + 20 * r())},${Math.round(60 + 10 * r())},0.95)`; g.beginPath(); g.ellipse(x + lean, H - h + 10, 3.2, 12, lean * 0.01, 0, Math.PI * 2); g.fill(); }   // plume
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  return t;
}
/** bank lines [[x,z],...] -> reed clump positions [x, z, h, rot] (deterministic) */
export function reedSpots(banks, ok) {
  const out = [];
  banks.forEach((pts, bi) => {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.01) continue;
      for (let s = (Math.ceil(acc / 1.7) * 1.7) - acc; s < l; s += 1.7) {
        const k = Math.round((acc + s) / 1.7), patch = Math.sin((acc + s) * 0.045 + bi * 2.1) + 0.6 * Math.sin((acc + s) * 0.17 + bi);
        const hk = ((Math.sin(k * 12.9898 + bi * 78.233) * 43758.5453) % 1 + 1) % 1;
        if (patch < 0.35 || hk < 0.2) continue;
        const t = s / l, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, o = (hk - 0.5) * 1.4;
        const X = x + nx * o, Z = z + nz * o;
        if (ok && !ok(X, Z)) continue;
        out.push([+X.toFixed(2), +Z.toFixed(2), 1.3 + hk * 0.9, hk * 6.283]);
      }
      acc += l;
    }
  });
  return out;
}
function reedMesh(spots) {
  const pos = [], uv = [], nor = [];
  for (const [x, z, h, rot] of spots) {
    for (let k = 0; k < 3; k++) {
      const a = rot + (k * Math.PI) / 3, w = 0.55 + 0.15 * k, cx = Math.cos(a) * w, cz = Math.sin(a) * w;
      const P = [[x - cx, 0, z - cz], [x + cx, 0, z + cz], [x + cx, h, z + cz], [x - cx, h, z - cz]], T = [[0, 0], [1, 0], [1, 1], [0, 1]];
      // both windings, front-sided, normals up: lit like the ground from either side (DoubleSide would flip the normal)
      for (const q of [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]) { pos.push(...P[q]); uv.push(...T[q]); nor.push(0, 1, 0); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}

/** the run of a water polygon's ring between the vertices nearest A and B (the shorter way round) */
export function ringRun(poly, A, B) {
  const nearest = (p) => { let bi = 0, bd = Infinity; poly.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const i0 = nearest(A), i1 = nearest(B), n = poly.length, fwd = [], back = [];
  for (let i = i0; ; i = (i + 1) % n) { fwd.push(poly[i]); if (i === i1 || fwd.length > n) break; }
  for (let i = i0; ; i = (i - 1 + n) % n) { back.push(poly[i]); if (i === i1 || back.length > n) break; }
  return fwd.length <= back.length ? fwd : back;
}
/** a waterline offset to one side (the side of point `toward`) by d */
export function offsetLine(pts, d, toward) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
    if ((toward[0] - pts[i][0]) * nx + (toward[1] - pts[i][1]) * nz < 0) { nx = -nx; nz = -nz; }
    out.push([pts[i][0] + nx * d, pts[i][1] + nz * d]);
  }
  return out;
}
/** the meadow's banks: the Isis's north bank, the Cherwell's west bank, the old Cherwell mouth's north bank */
export function meadowBanks(map) {
  const banks = [];
  const thames = map.areas.find((a) => a.id === 'r36896'), cher = map.areas.find((a) => a.id === 'r1046961');
  if (thames) banks.push(ringRun(thames.poly, [305, 934], [629, 1231]).filter(([, z]) => z < 1214));
  if (cher) banks.push(ringRun(cher.poly, [761, 596], [875, 1076]));
  for (const id of ['w3171300', 'w3171299']) { const w = map.waterlines.find((q) => q.id === id); if (w) banks.push(offsetLine(w.pts, (w.w || 14) / 2 - 0.5, [700, 1100])); }
  return banks;
}

/** build everything; returns {group, meshes, reeds, colliders, interacts, tris, draws} */
export function buildDressing(game, F) {
  const W = game.world, col = game.worldCollider, map = game.map, out = { meshes: [], tris: 0, draws: 0, gates: [], interacts: [] };
  const { tex, H } = boardAtlas();
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, name: 'ccm:dress' });
  const addMesh = (mb, name) => { const m = new THREE.Mesh(mb.geometry(), mat); m.name = name; m.castShadow = true; m.receiveShadow = true; W.addStatic(m); out.meshes.push(m); out.tris += mb.tris; out.draws++; return m; };
  const gh = (x, z) => (W.groundHeight ? W.groundHeight(x, z) : 0);
  // ---- the field gates (closed), each with a small board, a collider and a way over for the player
  (map._ccmGates || gateSpots(map)).forEach((g, gi) => {
    const h = Math.atan2(-g.dz, g.dx);                    // local +x along the railing
    const mb = new MB().at(g.x, gh(g.x, g.z), g.z, h);
    fieldGate(mb, GATE_W);
    // the board stands on the path side, a little to one side of the gate
    const nx = -g.dz, nz = g.dx, inS = !!F && (pointInPoly(g.x + nx * 3, g.z + nz * 3, F.south) || pointInPoly(g.x + nx * 3, g.z + nz * 3, F.north));
    const sgn = inS ? -1 : 1;                              // +n points into a field -> put the board on the other side
    mb.at(g.x - g.dx * (GATE_W / 2 + 1.0) + nx * sgn * 0.9, gh(g.x, g.z), g.z - g.dz * (GATE_W / 2 + 1.0) + nz * sgn * 0.9, Math.atan2(nx * sgn, nz * sgn));
    board(mb, 'cattle', H);
    addMesh(mb, 'ccm:gate' + gi);
    const seg = col.addSegment(g.x - g.dx * GATE_W / 2, g.z - g.dz * GATE_W / 2, g.x + g.dx * GATE_W / 2, g.z + g.dz * GATE_W / 2, { tag: 'ccm-gate', low: true });
    out.gates.push({ ...g, seg, nx, nz });
    // climbing over: from either side, to the other (so nobody is ever shut in a field)
    if (game.interact && game.interact.add) {
      for (const side of [1, -1]) {
        const it = game.interact.add({
          place: 'world', pos: [g.x + nx * side * 1.2, g.z + nz * side * 1.2], radius: 1.6, label: 'Climb over the gate',
          onUse: () => { const tx = g.x - nx * side * 1.3, tz = g.z - nz * side * 1.3, hd = Math.atan2(-nx * side, -nz * side); if (game.player.teleport) game.player.teleport(tx, tz, hd); else game.player.pos.set(tx, gh(tx, tz), tz); },
        });
        out.interacts.push(it);
      }
    }
  });
  // ---- notice boards at the public gates (inside, by the path)
  // [board, x, z, the point it faces]: inside the Memorial Gate, Folly Bridge gate, Rose Lane gate, Merton Grove gate; river boards beside the river walk on the landward side
  const BOARD_AT = [['meadow', 248, 658.6, 239, 656], ['meadow', 314.5, 941, 309, 934], ['meadow', 753.5, 468, 760, 457], ['meadow', 493, 527.5, 488, 519]];
  for (const [id, s0] of [['w1209131112', 30], ['w1209131112', 150], ['w3171321', 70]]) {
    const r = map.roads.find((q) => q.id === id); if (!r) continue;
    let acc = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (acc + l >= s0) { const t = (s0 - acc) / l, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; let nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l; if (nx * (600 - x) + nz * (880 - z) < 0) { nx = -nx; nz = -nz; } BOARD_AT.push(['river', x + nx * 3.2, z + nz * 3.2, x, z]); break; }
      acc += l;
    }
  }
  BOARD_AT.forEach(([key, x, z, tx, tz], i) => { const h = Math.atan2(tx - x, tz - z); const mb = new MB().at(x, gh(x, z), z, h); board(mb, key, H); addMesh(mb, 'ccm:board' + i); col.addCircle(x, z, 0.35, { tag: 'ccm-board', low: true }); });
  // ---- reeds on the meadow banks (one draw, no shadow); not on the bridge approaches
  const banks = meadowBanks(map);
  const spots = reedSpots(banks, (x, z) => x > 300 && z < 1214 && !(Math.hypot(x - 305, z - 934) < 12));
  const rm = new THREE.Mesh(reedMesh(spots), new THREE.MeshLambertMaterial({ map: reedTexture(), alphaTest: 0.5, name: 'ccm:reeds' }));
  rm.name = 'ccm:reeds'; rm.castShadow = false; rm.receiveShadow = true; rm.frustumCulled = true;
  W.addStatic(rm); out.reeds = rm; out.reedCount = spots.length; out.tris += spots.length * 12; out.draws++;
  out.banks = banks;
  return out;
}
