// University Parks: static detail (owned by places/university_parks.js, built after _parks_dress.js).
// Cricket ground furniture (boundary rope, sight screens, scoreboard, covers, roller, practice nets), pitch markings and
// goals for the winter pitches, grass tennis courts, croquet lawns + club hut, the quidditch field, white posts round
// the informal-games areas, the Parks Road railings and gate piers, finger-posts at the named walk junctions, no-cycling
// signs, the seven Wellingtonias, the 2013 Diamond Jubilee saplings, the Genetic Garden beds, the Hayrick Border, tree
// labels, leaf litter, worn grass and desire paths. Sources and guesses: docs/research/venues.md §9 "University Parks".
//
// Draw calls: geometry is merged per material — `solid` (vertex colours) and `cut` (one 1024² atlas: signs, railings,
// nets; alpha-tested) are split into 300 m clusters that are hidden beyond ~300 m; `mark` (pitch lines, rugs) and `decal`
// (worn grass, leaf litter) are one park-wide flat mesh each with no shadow. Typically 6–9 calls + 4–6 shadow calls.
import { NORTH } from './_north_kit.js';
import * as THREE from 'three';
import { canvasTex } from './_music_batch.js';
import { CRICKET, GATES } from './_parks_dress.js';
import { parkPaths } from './_parks_paths.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** Geometry accumulator with per-vertex colour and (optional) atlas-cell UVs. */
class Acc {
  constructor() { this.P = []; this.N = []; this.C = []; this.U = []; }
  get count() { return this.P.length / 3; }
  add(geo, color, x = 0, y = 0, z = 0, rot = 0, cell = null, sx = 1, sy = 1, sz = 1) {
    if (typeof rot === 'number') _e.set(0, rot, 0); else _e.set(rot[0] || 0, rot[1] || 0, rot[2] || 0, rot[3] || 'XYZ');
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
    return this.addM(geo, color, _m, cell);
  }
  addM(geo, color, m, cell = null) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(m);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    _c.set(color);
    for (let i = 0; i < P.count; i++) {
      this.P.push(P.getX(i), P.getY(i), P.getZ(i)); this.N.push(N.getX(i), N.getY(i), N.getZ(i)); this.C.push(_c.r, _c.g, _c.b);
      if (cell && U) this.U.push(cell[0] + U.getX(i) * cell[2], cell[1] + U.getY(i) * cell[3]); else this.U.push(WHITE_UV[0], WHITE_UV[1]);
    }
    if (g !== geo) g.dispose(); geo.dispose();
    return this;
  }
  /** -> Mesh (null if empty). uvWorld: metres per texture repeat for flat ground pieces (UV from world x/z). */
  mesh(mat, name, { uvWorld = 0, cast = false } = {}) {
    if (!this.P.length) return null;
    const g = new THREE.BufferGeometry();
    const P = new Float32Array(this.P);
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.N), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.C), 3));
    const U = new Float32Array(this.U);
    if (uvWorld) for (let i = 0; i < P.length / 3; i++) { U[i * 2] = P[i * 3] / uvWorld; U[i * 2 + 1] = P[i * 3 + 2] / uvWorld; }
    g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat); mesh.name = name; mesh.castShadow = cast; mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    this.P = this.N = this.C = this.U = null;
    return mesh;
  }
}
/** Spatial split of an accumulator family: one Acc per 300 m cell. */
class Clusters {
  constructor(size = 300) { this.size = size; this.map = new Map(); }
  at(x, z) { const k = Math.floor(x / this.size) + ',' + Math.floor(z / this.size); let a = this.map.get(k); if (!a) this.map.set(k, (a = new Acc())); return a; }
}

// ------------------------------------------------------------------------------------------------ the atlas
// 1024 x 1024; rects in px [x, y, w, h] (y from the top). Opaque cells fill their background; the rest is alpha.
const R = {
  railing: [0, 0, 256, 256], net: [256, 0, 256, 256], netWhite: [512, 0, 256, 256], tennisNet: [768, 0, 256, 128], gateLeaf: [768, 128, 256, 128],
  score: [0, 256, 256, 256], notice: [256, 256, 256, 256], noCycle: [512, 256, 128, 128], noCyclePlate: [640, 256, 128, 64], keepOff: [640, 320, 128, 64],
  genetic: [768, 256, 256, 128], hayrick: [768, 384, 256, 128], hut: [512, 384, 256, 128],
};
const WALKS = ['North Walk', 'West Walk', 'South Walk', 'Thorn Walk', 'Oak Walk', 'Lucas Walk', 'Riverside Walk', "Lazenbee's Ground Walk", 'High Bridge', 'Keble Gate', 'North Lodge', 'South Lodge', 'Pavilion', 'Lady Margaret Hall'];
WALKS.forEach((n, i) => { R['blade:' + n] = [(i % 2) * 256, 512 + Math.floor(i / 2) * 32, 256, 32]; });
const LABELS = [
  ['Sequoiadendron giganteum', 'Wellingtonia · planted c. 1888'], ['Styphnolobium japonicum', 'Japanese pagoda tree · 1888'], ['Catalpa bignonioides', 'Indian bean tree'],
  ['Liriodendron tulipifera', 'Tulip tree · Diamond Jubilee 2013'], ['Zelkova carpinifolia', 'Caucasian elm'], ['Fagus sylvatica \'Pendula\'', 'Weeping beech'],
  ['Aesculus hippocastanum', 'Horse chestnut'], ['Cedrus libani', 'Cedar of Lebanon'],
];
LABELS.forEach((l, i) => { R['label' + i] = [512 + (i % 2) * 256, 512 + Math.floor(i / 2) * 64, 256, 64]; });
const WHITE_UV = [32 / 1024, 1 - 800 / 1024];   // centre of the plain white cell: untextured (vertex-coloured) parts
const cellUV = (k) => { const [x, y, w, h] = R[k]; return [x / 1024, 1 - (y + h) / 1024, w / 1024, h / 1024]; };

function drawAtlas(g) {
  g.clearRect(0, 0, 1024, 1024);
  g.fillStyle = '#ffffff'; g.fillRect(0, 768, 64, 64);
  const fit = (t, maxW, px, style = 'bold', fam = 'Georgia, "Times New Roman", serif') => { let s = px; do { g.font = `${style} ${s}px ${fam}`; s -= 1; } while (g.measureText(t).width > maxW && s > 6); };
  const text = (t, cx, cy, maxW, px, col, style, fam) => { fit(t, maxW, px, style, fam); g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, cx, cy); };
  // railing: black bars with spear heads, two rails
  { const [x0, y0, w, h] = R.railing; g.fillStyle = '#16181a';
    for (let x = 4; x < w; x += 16) { g.fillRect(x0 + x, y0 + 22, 5, h - 26); g.beginPath(); g.moveTo(x0 + x - 3, y0 + 24); g.lineTo(x0 + x + 2.5, y0 + 6); g.lineTo(x0 + x + 8, y0 + 24); g.fill(); }
    g.fillRect(x0, y0 + 34, w, 7); g.fillRect(x0, y0 + h - 30, w, 7); }
  // gate leaf: bars + diagonal brace + scroll band
  { const [x0, y0, w, h] = R.gateLeaf; g.fillStyle = '#16181a';
    g.fillRect(x0, y0, 8, h); g.fillRect(x0 + w - 8, y0, 8, h); g.fillRect(x0, y0 + 10, w, 7); g.fillRect(x0, y0 + h - 12, w, 7); g.fillRect(x0, y0 + 40, w, 5);
    for (let x = 16; x < w - 8; x += 14) g.fillRect(x0 + x, y0 + 10, 4, h - 16);
    g.lineWidth = 6; g.strokeStyle = '#16181a'; g.beginPath(); g.moveTo(x0 + 8, y0 + h - 12); g.lineTo(x0 + w - 8, y0 + 17); g.stroke(); }
  // nets
  const grid = (r, col, step, lw) => { const [x0, y0, w, h] = r; g.fillStyle = col; for (let x = 0; x < w; x += step) g.fillRect(x0 + x, y0, lw, h); for (let y = 0; y < h; y += step) g.fillRect(x0, y0 + y, w, lw); };
  grid(R.net, 'rgba(24,30,26,0.9)', 6, 2); grid(R.netWhite, 'rgba(240,240,236,0.95)', 7, 2);
  { grid(R.tennisNet, 'rgba(20,22,24,1)', 4, 2); const [x0, y0, w] = R.tennisNet; g.fillStyle = '#f4f4f0'; g.fillRect(x0, y0, w, 14); }
  // scoreboard: black board, white painted numbers (guess: a simple manual board)
  { const [x0, y0, w, h] = R.score; g.fillStyle = '#1b1e1c'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#e8e4d8'; g.lineWidth = 4; g.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
    const rows = [['TOTAL', '187'], ['WKTS', '4'], ['OVERS', '52'], ['LAST MAN', '31'], ['1ST INNS', '—']];
    rows.forEach(([a, b], i) => { const y = y0 + 34 + i * 46; text(a, x0 + 70, y, 110, 22, '#e8e4d8', 'bold', 'Arial, sans-serif'); g.fillStyle = '#0c0d0c'; g.fillRect(x0 + 150, y - 18, 86, 36); text(b, x0 + 193, y, 80, 30, '#f4f0e4', 'bold', 'Arial, sans-serif'); }); }
  // park notice board with a sketch map and the hours
  { const [x0, y0, w, h] = R.notice; g.fillStyle = '#1e3a28'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#f2ecd8'; g.lineWidth = 4; g.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
    text('UNIVERSITY PARKS', x0 + w / 2, y0 + 26, w - 30, 24, '#f2ecd8');
    g.fillStyle = '#7fa06a'; g.beginPath(); g.moveTo(x0 + 30, y0 + 150); g.lineTo(x0 + 70, y0 + 60); g.lineTo(x0 + 150, y0 + 50); g.lineTo(x0 + 226, y0 + 70); g.lineTo(x0 + 200, y0 + 170); g.lineTo(x0 + 120, y0 + 190); g.closePath(); g.fill();
    g.strokeStyle = '#3a78b8'; g.lineWidth = 6; g.beginPath(); g.moveTo(x0 + 226, y0 + 66); g.quadraticCurveTo(x0 + 190, y0 + 130, x0 + 205, y0 + 190); g.stroke();
    g.strokeStyle = '#e8dcb8'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 70, y0 + 62); g.lineTo(x0 + 120, y0 + 188); g.moveTo(x0 + 40, y0 + 140); g.lineTo(x0 + 210, y0 + 80); g.stroke();
    g.fillStyle = '#c47a62'; g.fillRect(x0 + 120, y0 + 104, 12, 8);
    text('Open daily 7.45 am · gates close at dusk', x0 + w / 2, y0 + 212, w - 24, 15, '#f2ecd8', 'normal');
    text('No cycling · Dogs under control', x0 + w / 2, y0 + 234, w - 24, 15, '#f2ecd8', 'italic'); }
  // no cycling: white disc, red ring, black bicycle (UK regulatory sign, guess for the Parks)
  { const [x0, y0, w] = R.noCycle, cx = x0 + w / 2, cy = y0 + w / 2; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 60, 0, 7); g.fill(); g.strokeStyle = '#c8102e'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, 52, 0, 7); g.stroke();
    g.strokeStyle = '#111'; g.lineWidth = 4; for (const dx of [-22, 22]) { g.beginPath(); g.arc(cx + dx, cy + 10, 15, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 22, cy + 10); g.lineTo(cx - 6, cy - 14); g.lineTo(cx + 14, cy - 14); g.lineTo(cx + 22, cy + 10); g.moveTo(cx - 6, cy - 14); g.lineTo(cx + 2, cy + 10); g.lineTo(cx + 14, cy - 14); g.moveTo(cx - 10, cy - 20); g.lineTo(cx - 2, cy - 20); g.stroke(); }
  { const [x0, y0, w, h] = R.noCyclePlate; g.fillStyle = '#ffffff'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(x0 + 3, y0 + 3, w - 6, h - 6); text('NO CYCLING', x0 + w / 2, y0 + 22, w - 14, 20, '#111', 'bold', 'Arial, sans-serif'); text('in the Parks', x0 + w / 2, y0 + 46, w - 14, 15, '#111', 'normal', 'Arial, sans-serif'); }
  { const [x0, y0, w, h] = R.keepOff; g.fillStyle = '#1e3a28'; g.fillRect(x0, y0, w, h); text('PLEASE KEEP OFF', x0 + w / 2, y0 + 22, w - 12, 17, '#f2ecd8'); text('THE SQUARE', x0 + w / 2, y0 + 44, w - 12, 17, '#f2ecd8'); }
  { const [x0, y0, w, h] = R.genetic; g.fillStyle = '#1e3a28'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#f2ecd8'; g.lineWidth = 3; g.strokeRect(x0 + 5, y0 + 5, w - 10, h - 10);
    text('THE GENETIC GARDEN', x0 + w / 2, y0 + 30, w - 24, 24, '#f2ecd8'); text('Established 1964 by C. D. Darlington', x0 + w / 2, y0 + 66, w - 24, 15, '#f2ecd8', 'italic'); text('Plants showing hybrids, chimeras & variation', x0 + w / 2, y0 + 94, w - 24, 14, '#f2ecd8', 'normal'); }
  { const [x0, y0, w, h] = R.hayrick; g.fillStyle = '#1e3a28'; g.fillRect(x0, y0, w, h); g.strokeStyle = '#f2ecd8'; g.lineWidth = 3; g.strokeRect(x0 + 5, y0 + 5, w - 10, h - 10);
    text('THE HAYRICK BORDER', x0 + w / 2, y0 + 40, w - 24, 22, '#f2ecd8'); text('Herbaceous border · salvias', x0 + w / 2, y0 + 82, w - 24, 16, '#f2ecd8', 'italic'); }
  { const [x0, y0, w, h] = R.hut; g.fillStyle = '#2c4a30'; g.fillRect(x0, y0, w, h); text('O.U. CROQUET CLUB', x0 + w / 2, y0 + h / 2, w - 20, 26, '#f2ecd8'); }
  // finger-post blades: cream on dark green, name + arrow (guessed design)
  for (const n of WALKS) { const [x0, y0, w, h] = R['blade:' + n]; g.fillStyle = '#23402c'; g.fillRect(x0, y0, w, h); g.fillStyle = '#f2ecd8'; g.textAlign = 'center'; fit(n, w - 24, 20); g.textBaseline = 'middle'; g.fillText(n, x0 + w / 2, y0 + h / 2 + 1); }
  // tree labels: black plaque, white engraved text (guessed design)
  LABELS.forEach(([a, b], i) => { const [x0, y0, w, h] = R['label' + i]; g.fillStyle = '#151716'; g.fillRect(x0, y0, w, h); text(a, x0 + w / 2, y0 + 22, w - 16, 20, '#eeeae0', 'italic'); text(b, x0 + w / 2, y0 + 46, w - 16, 14, '#cfcabb', 'normal', 'Arial, sans-serif'); });
}

// ------------------------------------------------------------------------------------------------ small geometry
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n);
const planeXY = (w, h) => new THREE.PlaneGeometry(w, h);
const flatQuad = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);

export function buildParkDetail(game) {
  const W = game.world, col = game.worldCollider, map = game.map, ped = game.pedestrians;
  const inP = W.util.pointInPoly;
  const area = (id) => map.areas.find((a) => a.id === id);
  const park = area('r12532311_2').poly;
  const PP = parkPaths(game);
  const nearPath = (x, z, r) => PP.near(x, z, r);
  const solids = new Clusters(420), cuts = solids, mark = new Acc(), decal = new Acc(), nets = new Acc();
  const S = (x, z) => solids.at(x, z), Cu = (x, z) => cuts.at(x, z);
  const obstacles = [], spectatorSeats = [];
  const solid = (x, z, r, tag = 'parks') => { col.addCircle(x, z, r, { tag }); if (ped && nearPath(x, z, r + 3)) obstacles.push(ped.addObstacle({ x, z, r: r + 0.15 })); };
  const solidBox = (x, z, w, d, rot, tag = 'parks') => { col.addBox(x, z, w, d, rot, { tag }); if (ped && nearPath(x, z, Math.max(w, d) / 2 + 3)) obstacles.push(ped.addObstacle({ x, z, r: Math.max(w, d) / 2 + 0.2 })); };
  const stats = { piers: 0, gateMiss: [], rope: 0, screens: 0, posts: 0, signs: 0, trees: 0, clumps: 0, removed: 0, decals: 0 };
  const rng = W.rng(18640);
  // a flat line on the ground (pitch marking) from (x0,z0) to (x1,z1), width w
  // pitch lines are not drawn inside the cricket boundary (the summer outfield)
  const inRope = (x, z) => Math.hypot(x - CRICKET.c[0], z - CRICKET.c[1]) < 61;
  const line = (x0, z0, x1, z1, w = 0.1, c = 0xf4f4ee) => {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.01) return;
    if (L > 6) { const n = Math.ceil(L / 5); for (let i = 0; i < n; i++) { const a0 = i / n, a1 = (i + 1) / n, mx = x0 + dx * (a0 + a1) / 2, mz = z0 + dz * (a0 + a1) / 2; if (!inRope(mx, mz)) mark.add(flatQuad(w, L / n + 0.01), c, mx, 0.05, mz, Math.atan2(dx, dz)); } return; }
    if (!inRope((x0 + x1) / 2, (z0 + z1) / 2)) mark.add(flatQuad(w, L), c, (x0 + x1) / 2, 0.05, (z0 + z1) / 2, Math.atan2(dx, dz));
  };
  const arc = (cx, cz, r, a0, a1, w = 0.1, n = 24, c) => { for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * (i / n), t1 = a0 + (a1 - a0) * ((i + 1) / n); line(cx + Math.sin(t0) * r, cz + Math.cos(t0) * r, cx + Math.sin(t1) * r, cz + Math.cos(t1) * r, w, c); } };
  // rectangle frame from a 4-point area: centre, long axis a (unit), short axis b, lengths
  const rect = (poly) => {
    const e0 = [poly[1][0] - poly[0][0], poly[1][1] - poly[0][1]], e1 = [poly[2][0] - poly[1][0], poly[2][1] - poly[1][1]];
    const l0 = Math.hypot(...e0), l1 = Math.hypot(...e1), long = l0 > l1 ? e0 : e1, short = l0 > l1 ? e1 : e0;
    const L = Math.max(l0, l1), Wd = Math.min(l0, l1);
    const c = [(poly[0][0] + poly[1][0] + poly[2][0] + poly[3][0]) / 4, (poly[0][1] + poly[1][1] + poly[2][1] + poly[3][1]) / 4];
    const a = [long[0] / L, long[1] / L], b = [short[0] / Wd, short[1] / Wd];
    const at = (u, v) => [c[0] + a[0] * u + b[0] * v, c[1] + a[1] * u + b[1] * v];
    return { c, a, b, L, Wd, at, h: Math.atan2(a[0], a[1]) };
  };
  const lineL = (R0, u0, v0, u1, v1, w, c) => { const p = R0.at(u0, v0), q = R0.at(u1, v1); line(p[0], p[1], q[0], q[1], w, c); };
  const boxL = (acc, R0, u, v, y, w, h, d, c, extraRot = 0) => { const [x, z] = R0.at(u, v); acc.add(box(w, h, d), c, x, y, z, R0.h + extraRot); };
  const WHITE = 0xf2f0ea, POSTGREEN = 0x2a4630, BLACK = 0x1a1c1c, TIMBER = 0x7a5a3a, DARKTIMBER = 0x4a3826;

  // ============================================================================================ cricket ground
  const [cx, cz] = CRICKET.c, [ux, uz] = CRICKET.u, vx = uz, vz = -ux;
  const cw = (a, b) => [cx + ux * a + vx * b, cz + uz * a + vz * b];
  const cricketH = Math.atan2(ux, uz);
  {
    // boundary rope (guess: white rope laid on the grass), ellipse 56 m towards the pavilion, 60 m elsewhere
    const N = 150, ropeR = (t) => { const ca = Math.cos(t); return ca > 0 ? 60 - 4 * ca * ca : 60; };
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2, r = ropeR(t), p = cw(Math.cos(t) * r, Math.sin(t) * r);
      if (prev) { const dx = p[0] - prev[0], dz = p[1] - prev[1], L = Math.hypot(dx, dz); S(p[0], p[1]).add(box(0.07, 0.06, L + 0.05), 0xf6f4ee, (p[0] + prev[0]) / 2, 0.04, (p[1] + prev[1]) / 2, Math.atan2(dx, dz)); stats.rope++; }
      prev = p;
    }
    // sight screens behind the bowler's arm at both ends (guess: white boarded screens on wheels)
    for (const [a, tag] of [[-63, 'norham']]) {   // none at the pavilion end: it would hide the pavilion (guess)
      const [x, z] = cw(a, 0), h = cricketH + Math.PI / 2, A = S(x, z);   // board spans along v
      const sw = 9, sh = 3.6;
      A.add(box(sw, sh, 0.12), WHITE, x, 0.55 + sh / 2, z, cricketH);
      for (let k = -1; k <= 1; k++) {   // struts, sole beams and wheels behind (away from the pitch)
        const [bx, bz] = [x + vx * k * (sw / 2 - 0.4), z + vz * k * (sw / 2 - 0.4)], s = Math.sign(a), back = [ux * s * 1.0, uz * s * 1.0];
        A.add(box(0.12, 0.12, 2.0), 0xdedad0, bx + back[0] * 0.5, 0.25, bz + back[1] * 0.5, cricketH);
        A.add(box(0.1, 3.6, 0.1), 0xdedad0, bx + back[0] * 0.5, 2.0, bz + back[1] * 0.5, [Math.atan2(1.0, 3.4) * -s, cricketH, 0, 'YXZ']);
        A.add(cyl(0.22, 0.22, 0.1, 10).rotateX(Math.PI / 2), 0x3a3a3a, bx + back[0] * 1.0, 0.22, bz + back[1] * 1.0, h);
        A.add(cyl(0.22, 0.22, 0.1, 10).rotateX(Math.PI / 2), 0x3a3a3a, bx, 0.22, bz, h);
      }
      solidBox(x + ux * Math.sign(a) * 0.5, z + uz * Math.sign(a) * 0.5, sw, 1.3, cricketH);
      stats.screens++; void tag;
    }
    // scoreboard hut (guess: small timber hut with a black manual board, on the western side of the ground)
    {
      const [x, z] = cw(30, -64), h = Math.atan2(cx - x, cz - z), A = S(x, z), sx = Math.cos(h), sz = -Math.sin(h);
      A.add(box(3.6, 2.6, 2.2), 0x8a6a48, x, 1.3, z, h);
      A.add(box(4.2, 0.12, 1.5), 0x6a3a2e, x - Math.sin(h) * 0.5, 2.9, z - Math.cos(h) * 0.5, [-0.35, h, 0, 'YXZ']);
      A.add(box(4.2, 0.12, 1.5), 0x6a3a2e, x + Math.sin(h) * 0.5, 2.9, z + Math.cos(h) * 0.5, [0.35, h, 0, 'YXZ']);
      Cu(x, z).add(planeXY(3.2, 2.1), 0xffffff, x + Math.sin(h) * 1.12, 1.35, z + Math.cos(h) * 1.12, h, cellUV('score'));
      solidBox(x, z, 3.8, 2.4, h); void sx; void sz;
    }
    // mobile cover parked beside the square + a heavy roller (guess)
    {
      const [x, z] = cw(4, 17), A = S(x, z);
      A.add(box(6.5, 0.08, 3.2), 0x2f5a8a, x, 1.05, z, [0.12, cricketH + Math.PI / 2, 0, 'YXZ']);
      for (const a of [-3, 3]) for (const b of [-1.4, 1.4]) { const px = x + ux * b + vx * a, pz = z + uz * b + vz * a; A.add(cyl(0.04, 0.04, 1.0, 6), 0xc8c8c8, px, 0.55, pz); A.add(cyl(0.12, 0.12, 0.08, 10).rotateZ(Math.PI / 2), 0x222222, px, 0.12, pz, cricketH); }
      solidBox(x, z, 3.3, 6.6, cricketH);
      const [rx, rz] = cw(-6, 16);
      S(rx, rz).add(cyl(0.45, 0.45, 1.5, 14).rotateZ(Math.PI / 2), 0x2a4a2e, rx, 0.45, rz, cricketH);
      S(rx, rz).add(box(0.06, 0.06, 1.8), 0x2a4a2e, rx + ux * 1.1, 0.8, rz + uz * 1.1, [0.5, cricketH, 0, 'YXZ']);
      solidBox(rx, rz, 1.7, 1.2, cricketH);
      // "keep off the square" board on the square's edge (guess)
      const [kx, kz] = cw(-13, 14);
      S(kx, kz).add(box(0.06, 0.9, 0.06), 0x23402c, kx, 0.45, kz);
      Cu(kx, kz).add(planeXY(0.7, 0.35), 0xffffff, kx + Math.sin(cricketH) * 0.04, 0.85, kz + Math.cos(cricketH) * 0.04, cricketH + Math.PI, cellUV('keepOff'));
      solid(kx, kz, 0.1);
    }
    // spectators' benches outside the rope in front of the pavilion (guess), facing the square
    for (const b of [-17, -10, 10, 17]) {
      const [x, z] = cw(59, b), h = cricketH + Math.PI, A = S(x, z), fx = Math.sin(h), fz = Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h);
      A.add(box(1.8, 0.05, 0.42), 0x8a6a46, x, 0.45, z, h);
      for (const yy of [0.62, 0.76, 0.9]) A.add(box(1.8, 0.07, 0.03), 0x8a6a46, x - fx * 0.22, yy, z - fz * 0.22, h);
      for (const o of [-0.8, 0.8]) { A.add(box(0.06, 0.45, 0.4), 0x5a4630, x + sx * o, 0.225, z + sz * o, h); A.add(box(0.06, 0.95, 0.06), 0x5a4630, x + sx * o - fx * 0.22, 0.475, z + sz * o - fz * 0.22, h); }
      solidBox(x, z, 1.85, 0.5, h, 'bench');
      spectatorSeats.push([x + fx * 0.05, z + fz * 0.05, h]);
    }
    // worn ends of the strip (bowlers' footholds) — darker grass/soil on the square
    for (const s of [-1, 1]) { const [x, z] = cw(s * 11.5, 0); decal.add(flatQuad(3.2, 3.0), 0x8a7a56, x, 0.035, z, cricketH); stats.decals++; }
  }

  // practice nets (OSM pitch w559483871, cricket;cricket_nets): three lanes, open-ended at the bowlers' end
  {
    const a = area('w559483871');
    if (a) {
      const P = rect(a.poly), lanes = 3, laneW = 3.4, len = 28, hgt = 3.2;
      const v0 = -(lanes * laneW) / 2;
      for (let i = 0; i < lanes; i++) {
        const vc = v0 + laneW * (i + 0.5);
        const [mx, mz] = P.at(-P.L / 2 + 4 + len / 2 - 6, vc);
        mark.add(flatQuad(2.0, 20), 0x3f7a3a, mx, 0.045, mz, P.h);    // artificial pitch strip
        const [bx, bz] = P.at(-P.L / 2 + 4 + len - 21, vc);
        decal.add(flatQuad(2.4, 3), 0x8a7650, bx, 0.035, bz, P.h);
      }
      const A = S(P.c[0], P.c[1]);
      const u0 = -P.L / 2 + 4, u1 = u0 + len;
      for (let i = 0; i <= lanes; i++) {
        const v = v0 + laneW * i;
        for (let u = u0; u < u1 - 0.01; u += 4) { const [x, z] = P.at(u + 2, v); nets.add(planeXY(4, hgt), 0xffffff, x, hgt / 2, z, P.h + Math.PI / 2, cellUV('net')); }
        for (let u = u0; u <= u1 + 0.01; u += 4) { const [x, z] = P.at(u, v); A.add(cyl(0.04, 0.04, hgt + 0.1, 6), 0x9a9a92, x, (hgt + 0.1) / 2, z); }
        const p = P.at(u0, v), q = P.at(u1, v); col.addSegment(p[0], p[1], q[0], q[1], { tag: 'net' });
      }
      // closed back end
      for (let i = 0; i < lanes; i++) { const [x, z] = P.at(u0, v0 + laneW * (i + 0.5)); nets.add(planeXY(laneW, hgt), 0xffffff, x, hgt / 2, z, P.h, cellUV('net')); }
      { const p = P.at(u0, v0), q = P.at(u0, -v0); col.addSegment(p[0], p[1], q[0], q[1], { tag: 'net' }); }
      // top wire
      for (let i = 0; i <= lanes; i++) { const v = v0 + laneW * i, [x, z] = P.at((u0 + u1) / 2, v); A.add(box(0.03, 0.03, len), 0x9a9a92, x, hgt + 0.05, z, P.h); }
      // stumps at the batting end of each lane
      for (let i = 0; i < lanes; i++) for (const k of [-1, 0, 1]) { const [x, z] = P.at(u0 + 2.5, v0 + laneW * (i + 0.5) + k * 0.11); A.add(cyl(0.018, 0.018, 0.71, 6), 0xf4efe0, x, 0.355, z); }
    }
  }

  // ============================================================================================ winter pitches
  const rugbyPosts = (P, endU) => {    // H posts on the try line at u = endU (5.6 m apart, crossbar 3 m, 11 m uprights)
    for (const s of [-1, 1]) { const [x, z] = P.at(endU, s * 2.8); S(x, z).add(cyl(0.07, 0.08, 11, 8), WHITE, x, 5.5, z); solid(x, z, 0.12); stats.posts++; }
    const [x, z] = P.at(endU, 0); S(x, z).add(cyl(0.05, 0.05, 5.6, 8).rotateZ(Math.PI / 2), WHITE, x, 3.0, z, P.h);
  };
  const goal = (P, endU, w, h, depth, frame, netCell, inward) => {   // goal frame + net box; inward = +1/-1 (towards the field)
    const A = S(...P.at(endU, 0));
    for (const s of [-1, 1]) { const [x, z] = P.at(endU, s * w / 2); A.add(cyl(0.05, 0.05, h, 8), frame, x, h / 2, z); solid(x, z, 0.08); }
    { const [x, z] = P.at(endU, 0); A.add(cyl(0.05, 0.05, w, 8).rotateZ(Math.PI / 2), frame, x, h, z, P.h); }
    const back = endU - inward * depth;
    { const [x, z] = P.at(back, 0); nets.add(planeXY(w, h), 0xffffff, x, h / 2, z, P.h, cellUV(netCell)); }
    for (const s of [-1, 1]) { const [x, z] = P.at((endU + back) / 2, s * w / 2); nets.add(planeXY(depth, h), 0xffffff, x, h / 2, z, P.h + Math.PI / 2, cellUV(netCell)); }
    { const [x, z] = P.at((endU + back) / 2, 0); nets.add(planeXY(w, depth).rotateX(-Math.PI / 2), 0xffffff, x, h, z, P.h, cellUV(netCell)); }
    const p = P.at(back, -w / 2), q = P.at(back, w / 2); col.addSegment(p[0], p[1], q[0], q[1], { tag: 'goal' });
  };
  const FADED = 0xdcdcd4, lw = 0.1;
  const outline = (P, inset = 1.5, c = FADED) => { const hu = P.L / 2 - inset, hv = P.Wd / 2 - inset; lineL(P, -hu, -hv, hu, -hv, lw, c); lineL(P, -hu, hv, hu, hv, lw, c); lineL(P, -hu, -hv, -hu, hv, lw, c); lineL(P, hu, -hv, hu, hv, lw, c); return [hu, hv]; };
  for (const id of ['w201409629', 'w183253810', 'w201409630']) {    // rugby union, rugby league (OSM), soccer;rugby_union -> rugby
    const a = area(id); if (!a) continue;
    const P = rect(a.poly), [hu, hv] = outline(P);
    const tl = hu - Math.min(10, P.L * 0.08);
    for (const s of [-1, 1]) {
      lineL(P, s * tl, -hv, s * tl, hv, lw, FADED);
      const t22 = s * (tl - Math.min(22, tl * 0.45)); lineL(P, t22, -hv, t22, hv, lw, FADED);
      for (let v = -hv + 2; v < hv - 2; v += 5) { const t10 = s * 10; lineL(P, t10, v, t10, v + 1.6, lw, FADED); }
      for (const vv of [-hv + 5, hv - 5, -hv + 15, hv - 15]) for (let u = -tl + 3; u < tl - 3; u += 12) lineL(P, u, vv, u + 1.6, vv, lw, FADED);
      rugbyPosts(P, s * tl);
      const [gx, gz] = P.at(s * tl, 0); decal.add(flatQuad(9, 5), 0x9a8a5c, gx, 0.035, gz, P.h); stats.decals++;
    }
    lineL(P, 0, -hv, 0, hv, lw, FADED);
  }
  { // soccer (w201409634): full markings + goals with nets
    const a = area('w201409634');
    if (a) {
      const P = rect(a.poly), [hu, hv] = outline(P);
      lineL(P, 0, -hv, 0, hv, lw, FADED); const [mx, mz] = P.at(0, 0); arc(mx, mz, 9.15, 0, Math.PI * 2, lw, 40, FADED);
      for (const s of [-1, 1]) {
        const bw = Math.min(40.3, P.Wd - 8) / 2, bd = Math.min(16.5, hu * 0.33), gw = 9.16, gd = 5.5;
        lineL(P, s * hu, -bw, s * (hu - bd), -bw, lw, FADED); lineL(P, s * hu, bw, s * (hu - bd), bw, lw, FADED); lineL(P, s * (hu - bd), -bw, s * (hu - bd), bw, lw, FADED);
        lineL(P, s * hu, -gw, s * (hu - gd), -gw, lw, FADED); lineL(P, s * hu, gw, s * (hu - gd), gw, lw, FADED); lineL(P, s * (hu - gd), -gw, s * (hu - gd), gw, lw, FADED);
        goal(P, s * hu, 7.32, 2.44, 1.8, WHITE, 'netWhite', -s);
        const [gx, gz] = P.at(s * (hu - 3), 0); decal.add(flatQuad(6, 4), 0x9a8a5c, gx, 0.035, gz, P.h);
      }
    }
  }
  for (const id of ['w559483864', 'w559483869']) {   // lacrosse: boundary, centre line, creases and goals (orange frames)
    const a = area(id); if (!a) continue;
    const P = rect(a.poly), [hu, hv] = outline(P, 2);
    lineL(P, 0, -hv, 0, hv, lw, FADED);
    for (const s of [-1, 1]) { const gu = s * (hu - 13); const [x, z] = P.at(gu, 0); arc(x, z, 2.74, 0, Math.PI * 2, lw, 28, FADED); goal(P, gu, 1.83, 1.83, 1.6, 0xe86a1a, 'netWhite', -s); }
  }
  // grass tennis courts (8): lines + net + posts
  for (const a of map.areas) {
    if (a.kind !== 'pitch' || a.sport !== 'tennis' || !inP(a.poly[0][0], a.poly[0][1], park)) continue;
    const P = rect(a.poly), hl = 23.77 / 2, hd = 10.97 / 2, hs = 8.23 / 2, sl = 6.4, c = 0xf6f6f0, w = 0.05;
    lineL(P, -hl, -hd, hl, -hd, w, c); lineL(P, -hl, hd, hl, hd, w, c); lineL(P, -hl, -hd, -hl, hd, w, c); lineL(P, hl, -hd, hl, hd, w, c);
    lineL(P, -hl, -hs, hl, -hs, w, c); lineL(P, -hl, hs, hl, hs, w, c); lineL(P, -sl, -hs, -sl, hs, w, c); lineL(P, sl, -hs, sl, hs, w, c); lineL(P, -sl, 0, sl, 0, w, c);
    lineL(P, -hl, 0, -hl + 0.15, 0, w, c); lineL(P, hl, 0, hl - 0.15, 0, w, c);
    for (const s of [-1, 1]) { const [x, z] = P.at(0, s * (hd + 0.914)); S(x, z).add(cyl(0.04, 0.04, 1.07, 8), 0x2e4a34, x, 0.535, z); solid(x, z, 0.06); }
    const [nx, nz] = P.at(0, 0); nets.add(planeXY(2 * (hd + 0.914), 0.95), 0xffffff, nx, 0.95 / 2 + 0.02, nz, P.h, cellUV('tennisNet'));
    const p = P.at(0, -(hd + 0.914)), q = P.at(0, hd + 0.914); col.addSegment(p[0], p[1], q[0], q[1], { tag: 'net', low: true });
    for (const s of [-1, 1]) { const [x, z] = P.at(s * (hl - 0.6), 0); decal.add(flatQuad(1.2, 3.5), 0xa09464, x, 0.035, z, P.h); }
  }
  // croquet lawns (Oxford University Croquet Club, two lawns): boundary, six hoops, the peg, corner flags; club hut
  for (const id of ['w935442940', 'w935442941']) {
    const a = area(id); if (!a) continue;
    const P = rect(a.poly), hu = P.L / 2 - 0.6, hv = P.Wd / 2 - 0.6; outline(P, 0.6, 0xf4f4ee);
    const iu = hu * 0.6, iv = hv * 0.55;
    const hoops = [[-iu, -iv], [iu, -iv], [iu, iv], [-iu, iv], [-iu * 0.32, 0], [iu * 0.32, 0]];
    hoops.forEach(([u, v], i) => {
      for (const s of [-1, 1]) { const [x, z] = P.at(u, v + s * 0.05); S(x, z).add(cyl(0.008, 0.008, 0.3, 4), WHITE, x, 0.15, z); }
      const [x, z] = P.at(u, v); S(x, z).add(box(0.012, 0.012, 0.11), i === 0 ? 0x2a4ab0 : i === 3 ? 0xc02a2a : WHITE, x, 0.3, z, P.h + Math.PI / 2);
    });
    { const [x, z] = P.at(0, 0); S(x, z).add(cyl(0.02, 0.02, 0.45, 8), WHITE, x, 0.225, z); for (let k = 0; k < 4; k++) S(x, z).add(cyl(0.021, 0.021, 0.04, 8), [0x2a4ab0, 0xc02a2a, 0x1a1a1a, 0xe0c020][k], x, 0.33 + k * 0.035, z); }
    [[-hu, -hv, 0x2a4ab0], [hu, -hv, 0xc02a2a], [hu, hv, 0x1a1a1a], [-hu, hv, 0xe0c020]].forEach(([u, v, c]) => { const [x, z] = P.at(u, v); S(x, z).add(cyl(0.01, 0.01, 0.35, 4), WHITE, x, 0.175, z); S(x, z).add(box(0.005, 0.1, 0.14), c, x, 0.3, z + 0.07); });
  }
  { // the croquet club hut (verified: the club has a hut by the lawns; position and look guessed)
    const x = 546, z = -578, h = Math.atan2(521 - 546, -581 + 578), A = S(x, z);
    A.add(box(3.4, 2.3, 2.6), 0x3c5a3e, x, 1.15, z, h);
    for (const s of [-1, 1]) A.add(box(3.9, 0.1, 1.75), 0x40403c, x + Math.sin(h) * s * 0.7, 2.55, z + Math.cos(h) * s * 0.7, [s * 0.32, h, 0, 'YXZ']);
    A.add(box(0.9, 1.75, 0.05), DARKTIMBER, x + Math.sin(h) * 1.31, 0.875, z + Math.cos(h) * 1.31, h);
    Cu(x, z).add(planeXY(1.9, 0.36), 0xffffff, x + Math.sin(h) * 1.32, 2.05, z + Math.cos(h) * 1.32, h, cellUV('hut'));
    solidBox(x, z, 3.5, 2.7, h);
  }
  // quidditch: Oxford University Quidditch Club moved to a permanent marked-out field in the Parks in May 2012
  // (Wikipedia). Which field is NOT known: placed on the Keble Gate informal-games area (guess). 3 hoops per end.
  {
    const a = area('w559483868');
    if (a) {
      const P = rect(a.poly), hl = 27, hw = 16;
      // oval boundary: straight sides + semicircular ends
      lineL(P, -hl + hw, -hw, hl - hw, -hw, lw, FADED); lineL(P, -hl + hw, hw, hl - hw, hw, lw, FADED);
      for (const s of [-1, 1]) { for (let i = 0; i < 18; i++) { const t0 = (i / 18) * Math.PI, t1 = ((i + 1) / 18) * Math.PI; lineL(P, s * (hl - hw + Math.sin(t0) * hw), -Math.cos(t0) * hw, s * (hl - hw + Math.sin(t1) * hw), -Math.cos(t1) * hw, lw, FADED); } }
      lineL(P, 0, -hw, 0, hw, lw, FADED);
      for (const s of [-1, 1]) {
        lineL(P, s * 11, -hw, s * 11, hw, lw, FADED);
        [[-2.34, 1.37], [0, 1.83], [2.34, 0.91]].forEach(([v, ph]) => {
          const [x, z] = P.at(s * 16.5, v), A = S(x, z);
          A.add(cyl(0.035, 0.035, ph, 6), 0xe8c020, x, ph / 2, z);
          A.add(new THREE.TorusGeometry(0.45, 0.035, 6, 20), 0xe8c020, x, ph + 0.45, z, P.h + Math.PI / 2);
          A.add(cyl(0.2, 0.24, 0.08, 10), 0xe8c020, x, 0.04, z);
          solid(x, z, 0.12);
        });
        const [gx, gz] = P.at(s * 16.5, 0); decal.add(flatQuad(4, 7), 0xa09464, gx, 0.035, gz, P.h);
      }
    }
  }
  // white posts round the informal-games areas (Parks rules: informal games only "in areas marked by white posts")
  for (const id of ['w559483866', 'w559483868', 'w1425277507']) {
    const a = area(id); if (!a) continue;
    const poly = a.poly;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / 22));
      for (let k = 0; k < n; k++) {
        const t = k / n, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
        if (nearPath(x, z, 1.6) || !col.isFree(x, z, 0.3)) continue;
        S(x, z).add(cyl(0.06, 0.07, 0.75, 6), WHITE, x, 0.375, z); solid(x, z, 0.08); stats.posts++;
      }
    }
  }

  // ============================================================================================ Parks Road railings + gate piers
  // The boundary is "largely iron railings and gates" (Parks website); colour black (guess). Runs along the Parks Road
  // edge of the Parks polygon from North Lodge to Keble Gate, with gaps where paths come through.
  {
    const edge = [[17, -765], [30, -727], [63, -657], [81, -632], [96, -609], [131, -571], [155, -552], [164, -545], [168, -544]];
    const H = 1.65, panel = 2.4;
    const gaps = [];
    for (const gt of GATES) if (gt.p[0] < 200) gaps.push([gt.p[0], gt.p[1], 2.2]);
    // any path crossing the edge also gets a gap
    for (let i = 0; i < edge.length - 1; i++) {
      const [ax, az] = edge[i], [bx, bz] = edge[i + 1];
      const segs = []; PP.grid.queryRadius((ax + bx) / 2, (az + bz) / 2, Math.hypot(bx - ax, bz - az) / 2 + 3, (s) => segs.push(s));
      for (const s of segs) {
        const d = (bx - ax) * (s.bz - s.az) - (bz - az) * (s.bx - s.ax); if (Math.abs(d) < 1e-6) continue;
        const t = ((s.ax - ax) * (s.bz - s.az) - (s.az - az) * (s.bx - s.ax)) / d, u = ((s.ax - ax) * (bz - az) - (s.az - az) * (bx - ax)) / d;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) gaps.push([ax + (bx - ax) * t, az + (bz - az) * t, Math.max(2.0, s.w / 2 + 1.2)]);
      }
    }
    const inGap = (x, z, m = 0) => gaps.some(([gx, gz, r]) => Math.hypot(x - gx, z - gz) < r + m);
    for (let i = 0; i < edge.length - 1; i++) {
      const [ax, az] = edge[i], [bx, bz] = edge[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / panel)), h = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
      let run = null;
      const flush = (ex, ez) => { if (run) { col.addSegment(run[0], run[1], ex, ez, { tag: 'railing' }); run = null; } };
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        if (inGap(mx, mz, L / n / 2)) { flush(x0, z0); continue; }
        Cu(mx, mz).add(planeXY(L / n, H), 0xffffff, mx, H / 2, mz, h, cellUV('railing'));
        S(mx, mz).add(box(0.06, 0.06, L / n), 0x16181a, mx, H - 0.25, mz, h - Math.PI / 2);
        if (!run) run = [x0, z0];
        if (k === n - 1) flush(x1, z1);
      }
      flush(bx, bz);
    }
    // gate piers either side of every named gate on Parks Road (stone with caps; guess), set square to the path that
    // comes through, with the iron gate leaves standing open into the Parks
    for (const gt of GATES) {
      if (gt.p[0] > 200) continue;
      let best = null, bd = 6;
      PP.grid.queryRadius(gt.p[0], gt.p[1], 6, (sg) => { const dx = sg.bx - sg.ax, dz = sg.bz - sg.az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((gt.p[0] - sg.ax) * dx + (gt.p[1] - sg.az) * dz) / l2)), d = Math.hypot(sg.ax + dx * t - gt.p[0], sg.az + dz * t - gt.p[1]); if (d < bd && !/tertiary|residential|primary|secondary|cycleway/.test(sg.kind)) { bd = d; best = [dx / Math.sqrt(l2), dz / Math.sqrt(l2), sg.w || 2.2]; } });
      if (!best) { stats.gateMiss.push(gt.name); continue; }
      const [dx, dz, pw] = best, px = -dz, pz = dx, h = Math.atan2(dx, dz), off = pw / 2 + 0.75;
      const into = (430 - gt.p[0]) * dx + (-760 - gt.p[1]) * dz > 0 ? 1 : -1;
      for (const s of [-1, 1]) {
        const x = gt.p[0] + px * s * off, z = gt.p[1] + pz * s * off, A = S(x, z);
        if (!col.isFree(x, z, 0.05)) { stats.gateMiss.push(gt.name + s); continue; }
        stats.piers++;
        A.add(box(0.62, 2.1, 0.62), 0xcdb98e, x, 1.05, z, h); A.add(box(0.78, 0.14, 0.78), 0xbca97e, x, 2.17, z, h); A.add(new THREE.SphereGeometry(0.2, 10, 6), 0xbca97e, x, 2.42, z);
        solid(x, z, 0.4, 'pier');
        const lx = x + dx * into * 0.95 - px * s * 0.12, lz = z + dz * into * 0.95 - pz * s * 0.12;
        Cu(lx, lz).add(planeXY(1.6, 1.5), 0xffffff, lx, 0.8, lz, h + Math.PI / 2, cellUV('gateLeaf'));
        col.addSegment(x + dx * into * 0.3 - px * s * 0.12, z + dz * into * 0.3 - pz * s * 0.12, x + dx * into * 1.75 - px * s * 0.12, z + dz * into * 1.75 - pz * s * 0.12, { tag: 'gate' });
      }
    }
  }

  // ============================================================================================ signs
  const post = (x, z, hgt, c = 0x23402c, w = 0.08) => { S(x, z).add(box(w, hgt, w), c, x, hgt / 2, z); };
  // finger-posts at the junctions of the named walks (design guessed: dark green posts, cream lettering)
  {
    const walks = map.roads.filter((r) => r.kind === 'footway' && r.name && /Walk$/.test(r.name) && r.pts.some(([x, z]) => inP(x, z, park)));
    const ends = [];
    for (const r of walks) for (const [p, q] of [[r.pts[0], r.pts[1]], [r.pts[r.pts.length - 1], r.pts[r.pts.length - 2]]]) ends.push({ p, dir: Math.atan2(q[0] - p[0], q[1] - p[1]), name: r.name });
    const extra = [[GATES[0].p, 'Keble Gate'], [GATES[2].p, 'North Lodge'], [GATES[3].p, 'South Lodge'], [GATES[4].p, 'High Bridge']];
    const used = [];
    for (const e of ends) {
      if (used.some((u) => Math.hypot(u[0] - e.p[0], u[1] - e.p[1]) < 6)) continue;
      const here = ends.filter((f) => Math.hypot(f.p[0] - e.p[0], f.p[1] - e.p[1]) < 4);
      const names = new Map(); for (const f of here) if (!names.has(f.name)) names.set(f.name, f.dir);
      if (names.size < 2 && !extra.some(([g]) => Math.hypot(g[0] - e.p[0], g[1] - e.p[1]) < 40)) continue;
      used.push(e.p);
      // stand the post 2 m off the junction, between two of the walks, on free ground
      let px = null, pz = null;
      for (let k = 0; k < 16 && px === null; k++) { const a = (k / 16) * Math.PI * 2 + 0.3, x = e.p[0] + Math.sin(a) * 3.4, z = e.p[1] + Math.cos(a) * 3.4; if (!nearPath(x, z, 0.6) && col.isFree(x, z, 0.4) && inP(x, z, park)) { px = x; pz = z; } }
      if (px === null) continue;
      post(px, pz, 2.3, 0x2a3a2c, 0.1); S(px, pz).add(new THREE.ConeGeometry(0.09, 0.12, 4).rotateY(Math.PI / 4), 0x2a3a2c, px, 2.36, pz);
      let y = 2.05;
      const list = [...names.entries()];
      for (const [g, n] of extra) if (Math.hypot(g[0] - e.p[0], g[1] - e.p[1]) < 40 && list.length < 4) list.push([n, Math.atan2(g[0] - e.p[0], g[1] - e.p[1])]);
      for (const [n, dir] of list.slice(0, 4)) {
        if (!R['blade:' + n]) continue;
        // blade 0.9 x 0.13, pointing along `dir`, centred 0.5 m out from the post, readable both sides
        const bx = px + Math.sin(dir) * 0.5, bz = pz + Math.cos(dir) * 0.5, hb = dir - Math.PI / 2;
        const ox = Math.sin(hb) * 0.016, oz = Math.cos(hb) * 0.016;
        Cu(bx, bz).add(planeXY(0.86, 0.12), 0xffffff, bx + ox, y, bz + oz, hb, cellUV('blade:' + n));
        Cu(bx, bz).add(planeXY(0.86, 0.12), 0xffffff, bx - ox, y, bz - oz, hb + Math.PI, cellUV('blade:' + n));
        S(bx, bz).add(box(0.9, 0.15, 0.025), 0x23402c, bx, y, bz, hb);
        S(bx, bz).add(new THREE.ConeGeometry(0.075, 0.12, 3).rotateZ(-Math.PI / 2).scale(1, 1, 0.2), 0x23402c, bx + Math.sin(dir) * 0.51, y, bz + Math.cos(dir) * 0.51, hb);
        y -= 0.2;
      }
      solid(px, pz, 0.12, 'sign'); stats.signs++;
    }
  }
  // no-cycling signs at every gate (rule verified; the sign design is a guess) + a notice board with a map
  for (const gt of [...GATES, { p: [389.9, -995.2], name: 'Lady Margaret Hall Gate' }]) {
    const [gx, gz] = gt.p; let ix = 430 - gx, iz = -760 - gz; const l = Math.hypot(ix, iz); ix /= l; iz /= l;
    const sx = -iz, sz = ix;
    let x = gx - sx * 2.6 + ix * 2.0, z = gz - sz * 2.6 + iz * 2.0;
    if (nearPath(x, z, 1.3) || !col.isFree(x, z, 0.3)) { x = gx + sx * 3.4 + ix * 3.2; z = gz + sz * 3.4 + iz * 3.2; }
    if (nearPath(x, z, 1.0) || !col.isFree(x, z, 0.3)) continue;
    const h = Math.atan2(-ix, -iz);
    post(x, z, 2.2, 0x6a6e70, 0.06);
    Cu(x, z).add(planeXY(0.45, 0.45), 0xffffff, x - ix * 0.035, 1.95, z - iz * 0.035, h, cellUV('noCycle'));
    Cu(x, z).add(planeXY(0.45, 0.22), 0xffffff, x - ix * 0.035, 1.55, z - iz * 0.035, h, cellUV('noCyclePlate'));
    S(x, z).add(box(0.47, 0.72, 0.02), 0xdedede, x, 1.8, z, h);
    solid(x, z, 0.08, 'sign'); stats.signs++;
    // the map board, a little further in (guessed design)
    const mx = gx + sx * 3.2 + ix * 4.5, mz = gz + sz * 3.2 + iz * 4.5;
    if (!nearPath(mx, mz, 1.4) && col.isFree(mx, mz, 0.6)) {
      for (const o of [-0.7, 0.7]) post(mx + Math.cos(h) * o, mz - Math.sin(h) * o, 2.0, 0x23402c, 0.09);
      S(mx, mz).add(box(1.5, 0.08, 0.2), 0x23402c, mx, 2.02, mz, h);
      Cu(mx, mz).add(planeXY(1.2, 1.2), 0xffffff, mx - ix * 0.05, 1.3, mz - iz * 0.05, h, cellUV('notice'));
      S(mx, mz).add(box(1.26, 1.26, 0.06), 0x23402c, mx, 1.3, mz, h);
      solidBox(mx, mz, 1.6, 0.3, h); stats.signs++;
    }
  }

  // ============================================================================================ trees
  const labelAt = (x, z, i, face) => {   // a small black plaque on a low stake, sloped towards the path
    post(x, z, 0.75, 0x2a2a2a, 0.05);
    const nx = 0.825 * Math.sin(face) * 0.012, ny = 0.565 * 0.012, nz = 0.825 * Math.cos(face) * 0.012;
    Cu(x, z).add(planeXY(0.34, 0.085), 0xffffff, x + nx, 0.78 + ny, z + nz, [-0.6, face, 0, 'YXZ'], cellUV('label' + i));
    S(x, z).add(box(0.36, 0.1, 0.02), 0x151716, x, 0.775, z, [-0.6, face, 0, 'YXZ']);
    solid(x, z, 0.06, 'label');
  };
  const nearestPathDir = (x, z) => (PP.dist(x, z, 25) < 25 ? [PP.px, PP.pz] : null);
  // the seven Wellingtonias (planted c. 1888; the smallest 1972), in the grove OSM names "Wellingtonians"
  {
    const a = area('w1425277500');
    if (a) {
      stats.removed += W.clearArea(a.poly, { trees: true, furniture: false, lamps: false });
      const spots = [];
      for (let k = 0; k < 400 && spots.length < 7; k++) {
        const x = 54 + rng() * 42, z = -772 + rng() * 64;
        if (!inP(x, z, a.poly) || nearPath(x, z, 4) || spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 11)) continue;
        spots.push([x, z]);
      }
      spots.forEach(([x, z], i) => {
        const young = i === spots.length - 1, H = young ? 19 : 31 + rng() * 9, r0 = young ? 0.5 : 0.9 + rng() * 0.25, A = S(x, z);
        // trees pass (photo comparison item 5: "stacked cones on a fat red trunk"): a dull brown tapering trunk, mostly
        // inside the crown, and a ragged crown of offset boughs reaching down to ~2.5 m (the rng draws are unchanged in
        // number per tree up to the boughs, so the spots and heights are as before)
        A.add(cyl(r0 * 0.15, r0, H * 0.86, 9).translate(0, H * 0.43, 0), 0x5e4436, x, 0, z);
        A.add(cyl(r0 * 1.0, r0 * 1.4, 1.1, 9).translate(0, 0.55, 0), 0x56402f, x, 0, z);       // buttressed foot
        // a dark core spire, then many small drooping bough clumps round it (lighter where the sun catches the tips)
        const tiers = 18, base = young ? 1.4 : 2.4, R0 = young ? 2.6 : 4.8, PAL = [0x283f25, 0x2f4729, 0x253a22, 0x3a5530, 0x324d2b];
        for (let t = 0; t < tiers; t++) {
          const f = t / tiers, y0 = base + (H - base - 2) * f, env = NORTH ? R0 * 0.88 * (1 - f) ** 0.62 + 0.4 : R0 * (1 - f) ** 0.9 + 0.4, step = (H - base) / tiers;
          { const ox = (rng() - 0.5) * env * 0.4, oz = (rng() - 0.5) * env * 0.4, hc = step * (1.3 + 0.8 * rng()), rc = env * (0.45 + 0.15 * rng()), yc = y0 + (rng() - 0.5) * step + hc / 2;
            // north pass (photo "redwood"): the crown read as a spiky Christmas tree. The core is now a dense column of blunt
            // frusta (same rng draws), the boughs blunt drooping lumps: a narrow, solid, slightly ragged spire
            const env2 = R0 * 0.88 * (1 - (t + 1) / tiers) ** 0.62 + 0.4, hs = (H - base - 2) / tiers;
            A.add(NORTH ? new THREE.CylinderGeometry(t === tiers - 1 ? 0.15 : env2 * 0.8, env * 0.8, hs * (t === tiers - 1 ? 2.2 : 1.04), 8, 1, true).translate(0, y0 + hs * (t === tiers - 1 ? 1.1 : 0.52), 0) : new THREE.ConeGeometry(rc, hc, 6, 1).translate(0, yc, 0), PAL[t % 3], x + ox * (NORTH ? 0.15 : 1), 0, z + oz * (NORTH ? 0.15 : 1), rng() * 6); }
          const nb = 2 + Math.round(4 * (1 - f));
          for (let k = 0; k < nb; k++) {
            const a = (k / nb) * 6.283 + rng() * 1.2, off = env * (0.42 + 0.3 * rng()), rr = env * (0.3 + 0.18 * rng()), hh = step * (1.4 + 0.9 * rng());
            const g = NORTH ? new THREE.CylinderGeometry(rr * 0.5, rr * 0.85, hh * 0.5, 6, 1, true).translate(0, y0 - rr * 0.2 + hh * 0.25, 0) : new THREE.ConeGeometry(rr, hh, 6, 1).translate(0, y0 - rr * 0.35 + hh / 2, 0);
            { const of2 = NORTH ? env * 0.5 + (off - env * 0.42) * 0.45 : off; A.add(g, PAL[(t * 3 + k) % 5], x + Math.sin(a) * of2, 0, z + Math.cos(a) * of2, rng() * 6); }
          }
        }
        solid(x, z, r0 + 0.1, 'tree'); stats.trees++;
        if (i === 0) { const p = nearestPathDir(x, z); if (p) { const t = 0.6, lx = x + (p[0] - x) * t, lz = z + (p[1] - z) * t; if (!nearPath(lx, lz, 1.2)) labelAt(lx, lz, 0, Math.atan2(p[0] - x, p[1] - z) + Math.PI); } }
      });
    }
  }
  // Diamond Jubilee ring (verified: six tulip trees round a magnolia, planted 2013) — young staked saplings
  {
    const a = area('w1425278192');
    if (a) {
      stats.removed += W.clearArea(a.poly, { trees: true, furniture: false, lamps: false });
      const c = a.poly.reduce((s, p) => [s[0] + p[0] / a.poly.length, s[1] + p[1] / a.poly.length], [0, 0]);
      const sap = (x, z, hgt, leaf, crown) => {
        const A = S(x, z);
        A.add(cyl(0.05, 0.07, hgt * 0.6, 6).translate(0, hgt * 0.3, 0), 0x6a5a48, x, 0, z);
        A.add(new THREE.IcosahedronGeometry(crown, 1).scale(1, 1.25, 1), leaf, x, hgt * 0.6 + crown * 0.9, z);
        for (const s of [-1, 1]) A.add(cyl(0.035, 0.035, 1.6, 5), 0xb09a72, x + s * 0.35, 0.8, z);
        A.add(box(0.76, 0.05, 0.03), 0x222222, x, 1.3, z);
        A.add(cyl(0.22, 0.22, 0.9, 10, 1, true), 0x2a4a2a, x, 0.45, z);   // spiral guard
        solid(x, z, 0.4, 'tree'); stats.trees++;
      };
      for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2 + 0.4; sap(c[0] + Math.sin(t) * 9.5, c[1] + Math.cos(t) * 9.5, 3.6, 0x5e8a3a, 0.9); }
      sap(c[0], c[1], 2.4, 0x4e7a34, 1.1);
      const [lx, lz] = [c[0] + 9.5 * Math.sin(0.4) * 0.8, c[1] + 9.5 * Math.cos(0.4) * 0.8 + 1.5];
      if (!nearPath(lx, lz, 1) && col.isFree(lx, lz, 0.2)) labelAt(lx, lz, 3, 0);
    }
  }
  // labels on a few other specimen trees: the 1888 pagoda tree at Keble Gate, the Bean Tree Avenue (South Walk), and
  // a horse chestnut in the Coronation Clump. Tree positions = nearest OSM tree to the documented spot (guess).
  {
    const trees = map.trees.filter(([x, z]) => inP(x, z, park));
    const nearestTree = (x, z, r) => { let b = null, bd = r; for (const t of trees) { const d = Math.hypot(t[0] - x, t[1] - z); if (d < bd) { bd = d; b = t; } } return b; };
    for (const [x, z, li, r] of [[178, -556, 1, 25], [470, -606, 2, 30], [225, -690, 6, 30]]) {
      const t = nearestTree(x, z, r) || [x, z, 10];
      const p = nearestPathDir(t[0], t[1]);
      let lx = t[0] + 1.6, lz = t[1] + 1.6, face = 0;
      if (p) { const d = Math.hypot(p[0] - t[0], p[1] - t[1]) || 1, k = Math.min(1.8, d * 0.5); lx = t[0] + (p[0] - t[0]) / d * k; lz = t[1] + (p[1] - t[1]) / d * k; face = Math.atan2(p[0] - t[0], p[1] - t[1]) + Math.PI; }
      if (!nearPath(lx, lz, 1.1) && col.isFree(lx, lz, 0.2)) labelAt(lx, lz, li, face);
    }
  }

  // ============================================================================================ gardens
  const clump = (A, x, z, r, hgt, leaf, flower) => {
    A.add(new THREE.IcosahedronGeometry(1, 0).scale(r, hgt * 0.7, r), leaf, x, hgt * 0.35, z, rng() * 6);
    if (flower !== null) for (let k = 0; k < 2; k++) { const a = rng() * 6.28, rr = r * 0.55 * rng(); A.add(new THREE.OctahedronGeometry(1, 0).scale(r * 0.32, hgt * 0.22, r * 0.32), flower, x + Math.sin(a) * rr, hgt * 0.72 + rng() * hgt * 0.15, z + Math.cos(a) * rr); }
    stats.clumps++;
  };
  // the Genetic Garden (1964, Darlington; formal beds grouped by evolutionary process): low-edged rectangular beds
  {
    const a = area('w1475233648');
    if (a) {
      const poly = a.poly, A = S(405, -580);
      const ex = [427.9 - 373.4, -602.0 - -590.9], el = Math.hypot(...ex), ax = [ex[0] / el, ex[1] / el], bx = [-ax[1], ax[0]], h = Math.atan2(ax[0], ax[1]);
      const c0 = [405, -579];
      const flowers = [0xc83a6a, 0xe8c840, 0x8a5ac8, 0xf0f0f0, 0xe87830, 0xd04040, 0x6a8ad8];
      for (let i = -3; i <= 3; i++) for (const j of [-1, 1]) {
        const x = c0[0] + ax[0] * i * 6.6 + bx[0] * j * 3.4, z = c0[1] + ax[1] * i * 6.6 + bx[1] * j * 3.4;
        if (!inP(x, z, poly) || [[0, 0], [2.6, 1.4], [-2.6, 1.4], [2.6, -1.4], [-2.6, -1.4]].some(([a, b]) => nearPath(x + ax[0] * a + bx[0] * b, z + ax[1] * a + bx[1] * b, 0.5))) continue;
        A.add(box(2.6, 0.22, 5.0), 0x7a6a50, x, 0.11, z, h);                              // timber edging (long side along the garden)
        A.add(box(2.35, 0.04, 4.75), 0x4a3628, x, 0.21, z, h);                            // soil
        for (let k = 0; k < 7; k++) { const uu = (rng() - 0.5) * 4.0, vv = (rng() - 0.5) * 1.8; clump(A, x + ax[0] * uu + bx[0] * vv, z + ax[1] * uu + bx[1] * vv, 0.35 + rng() * 0.25, 0.5 + rng() * 0.6, rng() < 0.3 ? 0x8aa060 : 0x4a7a38, rng() < 0.75 ? flowers[(rng() * flowers.length) | 0] : null); }
        solidBox(x, z, 2.6, 5.0, h, 'bed');
        // a small plant label per bed (white stake tags)
        const [tx, tz] = [x + bx[0] * 1.75, z + bx[1] * 1.75]; S(tx, tz).add(box(0.12, 0.2, 0.01), WHITE, tx, 0.32, tz, h);
      }
      // board at the garden's edge
      const bx2 = 402, bz2 = -596; if (!nearPath(bx2, bz2, 1.2) && col.isFree(bx2, bz2, 0.3)) {
        for (const o of [-0.55, 0.55]) post(bx2 + Math.cos(h) * o, bz2 - Math.sin(h) * o, 1.3, 0x23402c, 0.07);
        Cu(bx2, bz2).add(planeXY(1.2, 0.6), 0xffffff, bx2 + Math.sin(h + Math.PI) * 0.04, 1.0, bz2 + Math.cos(h + Math.PI) * 0.04, h + Math.PI, cellUV('genetic'));
        S(bx2, bz2).add(box(1.24, 0.64, 0.04), 0x23402c, bx2, 1.0, bz2, h);
        solidBox(bx2, bz2, 1.3, 0.2, h, 'sign');
      }
    }
  }
  // the Hayrick Border (herbaceous border running north from South Lodge, "many salvias"): dense clumps
  {
    const a = area('w1390965306');
    if (a) {
      const poly = a.poly, A = S(620, -555), cols = [0x6a3aa8, 0x8a4ac8, 0xc02a48, 0x4a5ad0, 0xe8a8c8, 0xf0e8d8, 0xd87830, 0xe0c840];
      let n = 0;
      for (let k = 0; k < 1500 && n < 120; k++) {
        const x = 596 + rng() * 47, z = -586 + rng() * 59;
        if (!inP(x, z, poly) || nearPath(x, z, 1.3)) continue;
        clump(A, x, z, 0.35 + rng() * 0.35, 0.6 + rng() * 0.9, rng() < 0.5 ? 0x3e6a32 : 0x56803c, rng() < 0.85 ? cols[(rng() * cols.length) | 0] : null); n++;
      }
      decal.addM(W.flat(poly, 0.036), 0x6a5038, new THREE.Matrix4());
      const [bx, bz] = [617, -540]; if (!nearPath(bx, bz, 1.2) && col.isFree(bx, bz, 0.3)) { post(bx, bz, 1.2, 0x23402c, 0.07); Cu(bx, bz).add(planeXY(0.8, 0.4), 0xffffff, bx, 1.15, bz, -2.0, cellUV('hayrick')); S(bx, bz).add(box(0.84, 0.44, 0.03), 0x23402c, bx - Math.sin(-2) * 0.02, 1.15, bz - Math.cos(-2) * 0.02, -2.0); solid(bx, bz, 0.08, 'sign'); }
    }
  }

  // ============================================================================================ ground: leaf litter, worn grass, desire paths
  {
    const woods = map.areas.filter((a) => (a.kind === 'wood' || a.kind === 'scrub') && inP(a.poly[0][0], a.poly[0][1], park)).map((a) => a.poly);
    for (const [x, z, h] of map.trees) {
      if (!inP(x, z, park) || woods.some((w) => inP(x, z, w))) continue;
      const r = Math.min(3.2, 1.3 + (h || 10) * 0.1), n = 9, pts = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = r * (0.9 + rng() * 0.15); pts.push([x + Math.sin(a) * rr, z + Math.cos(a) * rr]); }
      decal.addM(W.flat(pts, 0.033), rng() < 0.5 ? 0x8a9450 : 0x909a56, new THREE.Matrix4());
      stats.decals++;
    }
    // desire lines (guessed): short cuts worn across the grass between walks, gates and the pavilion
    const lines = [[[60, -770], [150, -790]], [[200, -585], [262, -620]], [[431, -731], [455, -742]], [[499, -756], [470, -790], [430, -800]], [[614, -959], [585, -930]], [[654, -882], [625, -872], [600, -866]]];
    for (const pts of lines) { decal.addM(W.ribbon(pts, 0.55, 0.037), 0x948a5e, new THREE.Matrix4()); decal.addM(W.ribbon(pts, 1.3, 0.031), 0x86945a, new THREE.Matrix4()); stats.decals++; }
  }

  // ============================================================================================ materials + meshes
  const atlas = canvasTex(1024, 1024, drawAtlas);
  if (atlas) { atlas.anisotropy = 8; atlas.generateMipmaps = true; }
  const mCut = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, name: 'parks-detail-cut' });
  const mNet = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.8, name: 'parks-detail-net' });
  const mMark = W.layerMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, name: 'parks-detail-mark' }), 'marking');
  const noise = canvasTex(128, 128, (g) => { g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { const v = 150 + Math.random() * 105 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 2 + Math.random() * 3); } }, { repeat: true });
  const mDecal = W.layerMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, map: noise, roughness: 1, name: 'parks-detail-decal' }), 'area2');
  const group = new THREE.Group(); group.name = 'parks-detail';
  const clusters = [];
  const addCluster = (acc, mat, name, cast) => { const m = acc.mesh(mat, name, { cast }); if (!m) return; group.add(m); const s = m.geometry.boundingSphere; clusters.push({ m, x: s.center.x, z: s.center.z, r: s.radius }); };
  for (const [k, a] of solids.map) addCluster(a, mCut, 'parks-detail:' + k, true);   // solids + signs/railings: one atlas material
  const markMesh = mark.mesh(mMark, 'parks-detail-mark'), decalMesh = decal.mesh(mDecal, 'parks-detail-decal', { uvWorld: 2.5 }), netMesh = nets.mesh(mNet, 'parks-detail-net');
  for (const m of [markMesh, decalMesh, netMesh]) if (m) { m.castShadow = false; group.add(m); }
  if (netMesh) netMesh.renderOrder = 2;
  group.matrixAutoUpdate = false; group.updateMatrix();
  W.addStatic(group);

  // ============================================================================================ runtime
  let cullT = 0, lx = 0, lz = 0;
  const FAR = 300;
  return {
    group, obstacles, spectatorSeats, stats: () => ({ ...stats, clusters: clusters.length, visible: clusters.filter((c) => c.m.visible).length, obstacles: obstacles.length }),
    update(dt, px, pz, far) {
      if (Math.abs(px - lx) + Math.abs(pz - lz) > 30) cullT = 0;
      lx = px; lz = pz;
      if ((cullT -= dt) > 0) return; cullT = 0.5;
      for (let i = 0; i < clusters.length; i++) { const c = clusters[i], d = Math.hypot(px - c.x, pz - c.z) - c.r; c.m.visible = !far && d < FAR; }   // player, not camera: right on a teleport
      const low = !!(game.quality && game.quality.level === 'low');   // low tier: no decals, no shadows from the detail
      if (markMesh) markMesh.visible = !far; if (decalMesh) decalMesh.visible = !far && !low; if (netMesh) netMesh.visible = !far;
      for (let i = 0; i < clusters.length; i++) clusters[i].m.castShadow = !low;
    },
  };
}
