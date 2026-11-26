// Broad Street — Blackwell's, the academic bookshop ("Haldane & Crewe" under ?invented=1; the big Broad Street
// bookshop: a narrow old shopfront that opens into a deep ground floor, and a vast basement room of shelves
// dug under the college garden next door, opened in the 1960s). Owned by places/broad_street.js.
//   frontGeometry(world)          the shopfront extras on the mapped building's street face: fascia, window displays,
//                                 door, hanging sign — {meshes, door: {pos, facing}}
//   buildGround(ctx, world)       the ground floor interior (interior-local metres) -> {spawn, heading, exit, stairs, till}
//   buildBasement(ctx, world)     the basement room -> {spawn, heading, stairsUp, sections: [{name, x, z, h}]}
// Everything is merged per material: an interior is a handful of draws.
import * as THREE from 'three';
import { repaintable } from '../world/_tex_keep.js';
import { canvasScale, hiAniso } from '../world/_surf_detail.js';   // texture pass 2: larger canvases and 16x anisotropy on the top tier only
import { Acc } from './_pm_dress.js';
import { cwGoods } from './_cw_goods.js';
import { tn } from '../core/features.js';
import { kitGaps, cityDoor, mergeRoom, reveal } from './_walkin_city.js';

export const SHOP = {
  name: tn('Blackwell’s', 'Haldane & Crewe'),
  room: tn('The Norrington Room', 'The Basement Room'),   // the basement room (opened 1966, named after a President of Trinity)
  id: 'w29390262',
  // the street face of the mapped building (west end -> east end) and its outward normal (towards Broad Street)
  a: [301.7, 45.6], b: [317.0, 41.8],
};
{ const dx = SHOP.b[0] - SHOP.a[0], dz = SHOP.b[1] - SHOP.a[1], L = Math.hypot(dx, dz); SHOP.L = L; SHOP.u = [dx / L, dz / L]; }
// n = outward normal (the street is south of the face)
SHOP.n = [-SHOP.u[1], SHOP.u[0]]; if (SHOP.n[1] < 0) SHOP.n = [-SHOP.n[0], -SHOP.n[1]];
SHOP.facing = Math.atan2(SHOP.n[0], SHOP.n[1]);
// the mapped front steps forward ~0.46 m round the middle bay (x 307.5-310): the new shopfront stands proud of it all
for (const p of [SHOP.a, SHOP.b]) { p[0] += SHOP.n[0] * 0.5; p[1] += SHOP.n[1] * 0.5; }
export const along = (s, out = 0) => [SHOP.a[0] + SHOP.u[0] * s + SHOP.n[0] * out, SHOP.a[1] + SHOP.u[1] * s + SHOP.n[1] * out];
SHOP.doorS = 8.0;
SHOP.door = along(SHOP.doorS, 0.9);

export const SECTIONS = ['Philosophy', 'History', 'Law', 'Mathematics', 'Classics', 'English Literature', 'Theology', 'Medicine', 'Physics', 'Economics', 'Modern Languages', 'Computer Science'];
export const TITLES = [
  ['A Short History of the Footnote', 'History'], ['Being and Lunchtime', 'Philosophy'], ['Tort for the Terrified', 'Law'], ['Groups, Rings and Other Mistakes', 'Mathematics'],
  ['Latin Without Tears (with Some Tears)', 'Classics'], ['The Unread Victorian Novel', 'English Literature'], ['Angels on Pinheads: A Census', 'Theology'], ['Gray\'s Anatomy of a Hangover', 'Medicine'],
  ['Quantum Mechanics for Cats', 'Physics'], ['The Economics of the Overdue Essay', 'Economics'], ['Ordering Coffee in Nine Languages', 'Modern Languages'], ['Debugging at 3 a.m.', 'Computer Science'],
  ['Principia Procrastinatia', 'Mathematics'], ['The Collected Excuses of Undergraduates', 'English Literature'], ['Stoicism and the 9 a.m. Tutorial', 'Philosophy'], ['Magna Carta: The Small Print', 'Law'],
];
/** the book a customer wants in shared slot k (6-minute slots): deterministic for every player */
export function requestFor(k) { const h = Math.imul((k | 0) ^ 0x2545f491, 0x9e3779b1) >>> 0; return TITLES[(h >>> 7) % TITLES.length]; }

function canvasTex(w, h, draw) {
  // (memory pass: `draw` paints the same picture each time it is called, so the canvas goes once the texture is on the
  //  card and is painted again if the card ever needs it again — world/_tex_keep.js)
  const paint = () => { const c = document.createElement('canvas'), k = canvasScale(w, h); c.width = w * k; c.height = h * k; const x = c.getContext('2d'); if (k !== 1) x.scale(k, k); draw(x, w, h); return c; };   // (texture pass 2)
  const t = new THREE.CanvasTexture(paint()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = hiAniso(4); return repaintable(t, paint, 'broad street ' + w + 'x' + h);
}
/** fascia: deep blue board, gilt serif letters */
export function fasciaTexture(text = SHOP.name.toUpperCase() + '  ·  BOOKSELLERS') {
  return canvasTex(1024, 96, (x, w, h) => {
    x.fillStyle = '#16233f'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#c9a85a'; x.lineWidth = 4; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = '#e2c47a'; x.font = 'bold 52px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 2);
  });
}
/** a window display: rows of face-out covers in invented colours, a "New Books" card */
function displayTexture(seed) {
  return canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#2b2219'; x.fillRect(0, 0, w, h);
    let r = seed * 9301 + 49297;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    const cols = ['#a23b2c', '#2d4f7c', '#e8dcc0', '#3f6b45', '#d9a63a', '#5a3b6e', '#1d1d1d', '#c66a2b'];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
      const bx = 14 + i * 55, by = 20 + row * 76, bw = 42, bh = 60;
      x.fillStyle = cols[Math.floor(rnd() * cols.length)]; x.fillRect(bx, by, bw, bh);
      x.fillStyle = rnd() < 0.5 ? '#f4efe2' : '#111'; x.fillRect(bx + 5, by + 10, bw - 10, 4); x.fillRect(bx + 5, by + 18, bw - 16, 3);
      x.fillStyle = '#3a2d20'; x.fillRect(bx - 4, by + bh, bw + 8, 6);
    }
    x.fillStyle = '#f2ead2'; x.fillRect(190, 210, 132, 34); x.fillStyle = '#16233f'; x.font = 'bold 20px serif'; x.textAlign = 'center'; x.fillText('NEW BOOKS', 256, 234);
  });
}
/** section signs for the basement: one texture, one row per section (white on dark green) */
export function sectionAtlas() {
  const n = SECTIONS.length;
  const tex = canvasTex(512, 64 * n, (x, w) => {
    SECTIONS.forEach((s, i) => {
      x.fillStyle = '#21402e'; x.fillRect(0, i * 64, w, 64);
      x.fillStyle = '#f3efe2'; x.font = 'bold 38px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s.toUpperCase(), w / 2, i * 64 + 33);
    });
  });
  return { tex, uv: (i) => [0, 1 - (i + 1) / n, 1, 1 - i / n] };
}

/** a vertical quad facing (nx, nz) centred at (x, y, z), w × h, with a uv rect */
export function quad(x, y, z, w, h, nx, nz, uv = [0, 0, 1, 1]) {
  const g = new THREE.PlaneGeometry(w, h); const a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
  g.rotateY(Math.atan2(nx, nz)); g.translate(x, y, z); return g;
}

export function frontGeometry(world) {
  const K = world.interiorKit, A = new Acc(), out = { meshes: [] };
  const ry = Math.atan2(-SHOP.u[1], SHOP.u[0]);    // a box's local x along the face
  const at = (s, o, y, w, h, d, key) => { const [x, z] = along(s, o); A.box(key, K, x, y, z, w, h, d, ry); };
  const [nx, nz] = SHOP.n;
  // shopfront frame: pilasters, stall risers, cornice over the fascia
  for (const s of [0.4, 5.2, 10.8, 15.2]) at(s, -0.38, 2.0, 0.42, 4.0, 1.24, 'frame');
  if (world.bsWalkin) { const d0 = SHOP.doorS - 0.95, d1 = SHOP.doorS + 0.95; at((0.1 + d0) / 2, -0.4, 0.32, d0 - 0.1, 0.64, 1.2, 'frame'); at((d1 + SHOP.L - 0.1) / 2, -0.4, 0.32, SHOP.L - 0.1 - d1, 0.64, 1.2, 'frame'); }      // (walk-in: the stall riser stops either side of the real doorway)
  else at(SHOP.L / 2, -0.4, 0.32, SHOP.L - 0.2, 0.64, 1.2, 'frame');
  at(SHOP.L / 2, -0.25, 3.75, SHOP.L - 0.3, 0.95, 1.1, 'frame');      // the fascia's backing, back to the old wall
  at(SHOP.L / 2, -0.08, 4.35, SHOP.L + 0.4, 0.18, 1.04, 'frame');
  at(SHOP.L / 2, -0.4, 3.2, SHOP.L - 0.4, 0.1, 1.12, 'frame');
  // door: a recessed dark doorway with a glazed door
  if (!world.bsWalkin) at(SHOP.doorS, 0.02, 1.25, 1.7, 2.5, 0.06, 'dark');      // (walk-in: the doorway is real — a recessed lobby to the shop door)
  // signs + displays + glass (each its own small mesh / material)
  const F = quad(...[along(SHOP.L / 2, 0.36)].map(([x, z]) => [x, 3.75, z])[0], SHOP.L - 1.2, 0.72, nx, nz);
  const fascia = new THREE.Mesh(F, new THREE.MeshStandardMaterial({ map: fasciaTexture(), roughness: 0.5, name: 'bs:fascia' }));
  fascia.name = 'bs:fascia'; out.meshes.push(fascia);
  const dispMat = new THREE.MeshStandardMaterial({ map: displayTexture(7), roughness: 0.8, emissive: 0xffe2b0, emissiveIntensity: 0, name: 'bs:display' });
  world.registerNight && world.registerNight(dispMat, 0.8);
  // the windows have depth: the shelves of face-out books are the BACK of a 0.55 m deep window box (lined in dark wood,
  // a ceiling over it), and in front of them three stepped stands carry books standing face-out, stacks and a card
  const BACK = -0.3, WINS = [[0.7, 4.9], [11.1, 14.9], [5.1, 6.1], [9.9, 10.9]];
  const dg = []; for (const [s0, s1] of WINS) { const [x, z] = along((s0 + s1) / 2, BACK); dg.push(quad(x, 1.78, z, s1 - s0, 2.24, nx, nz)); }
  const disp = new THREE.Mesh(mergeQuads(dg), dispMat); disp.name = 'bs:display'; out.meshes.push(disp);
  const G = cwGoods(world), gm = G.material.clone(); gm.name = 'bs:window-books'; gm.emissive = new THREE.Color(0xffe2b0); gm.emissiveIntensity = 0.1;
  if (world.registerNight) world.registerNight(gm, 0.55, 0.06);
  const Bk = { P: [], N: [], U: [] };
  const card = (sA, sB, y0, y1, o0, o1, uv) => {   // a card from (sA, o0) at y0 to (sB, o1) at y1 (it may lean back)
    const p = [along(sA, o0), along(sB, o0), along(sB, o1), along(sA, o1)], Y = [y0, y0, y1, y1], T = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
    for (const i of [0, 1, 2, 0, 2, 3]) { Bk.P.push(p[i][0], Y[i], p[i][1]); Bk.N.push(nx, 0.3, nz); Bk.U.push(T[i][0], T[i][1]); }
  };
  WINS.forEach(([s0, s1], w) => {
    const sm = (s0 + s1) / 2, ww = s1 - s0;
    at(sm, (BACK + 0.12) / 2, 0.66, ww, 0.04, 0.12 - BACK, 'stand');                // the window bed
    at(sm, (BACK + 0.12) / 2, 2.88, ww, 0.04, 0.12 - BACK, 'dark');                 // the window head
    // three tiers: front low, middle, back high
    const tiers = [[0.78, 0.08, -0.06], [1.06, -0.06, -0.18], [1.42, -0.18, BACK + 0.02]];
    tiers.forEach(([top, oa, ob], t) => {
      at(sm, (oa + ob) / 2, (0.66 + top) / 2, ww - 0.08, top - 0.66, oa - ob, 'stand');
      // books standing face-out on the tier, leaning back a little; a stack at one end of the front tier
      const n = Math.max(1, Math.round((ww - 0.2) / 1.1));
      for (let k = 0; k < n; k++) { const a = s0 + 0.1 + (k * (ww - 0.2)) / n, b = s0 + 0.1 + ((k + 1) * (ww - 0.2)) / n - 0.04; card(a, b, top, top + 0.3, (oa + ob) / 2 + 0.02, (oa + ob) / 2 - 0.03, G.uv((k + t + w) % 2 ? 'covers' : 'coversB')); }
      if (t === 0 && ww > 2) { const a = s1 - 0.5; card(a, a + 0.36, top, top + 0.36, oa - 0.02, oa - 0.02, G.uv('stack')); }
    });
    if (ww > 2) { card(sm - 0.3, sm + 0.3, 1.9, 2.5, BACK + 0.06, BACK + 0.06, G.uv('poster')); }
  });
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Bk.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Bk.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(Bk.U, 2)); g.computeBoundingSphere(); const m = new THREE.Mesh(g, gm); m.name = 'bs:window-books'; m.castShadow = false; out.meshes.push(m); }
  const gg = []; for (const [s0, s1] of WINS) { const [x, z] = along((s0 + s1) / 2, 0.12); gg.push(quad(x, 1.77, z, s1 - s0, 2.22, nx, nz)); }
  const glass = new THREE.Mesh(mergeQuads(gg), world.mats.glass); glass.name = 'bs:glass'; out.meshes.push(glass);
  const mats = { frame: new THREE.MeshStandardMaterial({ color: 0x1b2a48, roughness: 0.6, name: 'bs:frame' }), dark: new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.4, name: 'bs:door' }), stand: world.mats.wood };
  for (const k of ['frame', 'dark', 'stand']) { const g = A.merged(k); if (!g) continue; const m = new THREE.Mesh(g, mats[k]); m.name = 'bs:' + k; m.castShadow = false; m.receiveShadow = true; out.meshes.push(m); }
  out.door = { pos: SHOP.door, facing: SHOP.facing };
  return out;
}
function mergeQuads(list) {
  const P = [], N = [], U = [];
  for (const g of list) { const n = g.index ? g.toNonIndexed() : g; P.push(...n.attributes.position.array); N.push(...n.attributes.normal.array); U.push(...n.attributes.uv.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeBoundingSphere(); return g;
}

/** a run of bookcases (merged): from (x0, z0) along +x for w metres (rot = heading the fronts face), h tall */
function shelves(A, K, books, x, z, w, rot, h = 2.3, d = 0.38, collider = null) {
  const c = Math.cos(rot), s = Math.sin(rot);
  // local frame: u along the run = (c, -s), front normal = (sin rot, cos rot)
  const fx = Math.sin(rot), fz = Math.cos(rot), ux = Math.cos(rot), uz = -Math.sin(rot);
  const P = (lu, lv) => [x + ux * lu + fx * lv, z + uz * lu + fz * lv];
  const [bx, bz] = P(0, -d / 2 + 0.01);
  A.box('wood', K, bx, h / 2, bz, w, h, 0.03, rot);                        // back
  for (let k = 0; k <= Math.round(w / 0.9); k++) { const [px, pz] = P(-w / 2 + Math.min(w, k * (w / Math.round(w / 0.9))), 0); A.box('wood', K, px, h / 2, pz, 0.04, h, d, rot); }
  for (const y of [0.05, h - 0.03]) { const [px, pz] = P(0, 0); A.box('wood', K, px, y, pz, w, 0.06, d, rot); }
  const [qx, qz] = P(0, -d / 2 + 0.12);
  const g = new THREE.PlaneGeometry(w - 0.06, h - 0.15); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w - 0.06) / 2, uv.getY(i) * (h - 0.15) / 2);
  g.rotateY(rot); g.translate(qx, h / 2 + 0.02, qz); books.push(g);
  if (collider) collider.addBox(x, z, w, d, rot);
  void c; void s;
}
function finish(scene, A, books, world, extra = {}) {
  const K = world.interiorKit, mats = { wood: K.mats.darkWood || world.mats.darkWood, table: world.mats.wood, carpet: world.mats.carpet, ...extra };
  for (const [k, m] of Object.entries(mats)) { const g = A.merged(k); if (!g) continue; const me = new THREE.Mesh(g, m); me.name = 'bs:' + k; me.receiveShadow = true; scene.add(me); }
  if (books.length) { const g = mergeQuads(books); const m = new THREE.Mesh(g, world.mats.books); m.name = 'bs:books'; scene.add(m); }
}

/** the ground floor: 15 m wide (along the street), 18 m deep; entrance on the south wall */
// Walk-in (core/interiors.js "seamless"; _walkin_city.js). The mapped building is 15.7 m wide at the street, narrowing
// to 14.9 behind, and its front steps back 0.8 m east of the door: the ground floor is re-planned 14.2 m wide with its
// front wall 0.8 m further back (z = GF.zF), so the shop door is at the back of a 1.1 m recessed lobby (as the real
// one is). The basement room is part of the SAME room: a real stair goes down from the gap in the back wall
// (18 treads, 5.2 m) to the basement's door; it lies north of the ground floor, under the garden next door (below
// ground: nothing to fit). GUESS: the stair's exact place and that it is one straight flight.
export const GF = { W: 14.2, D: 18, zF: 8.2, H: 3.3, t: 0.2, doorW: 1.8, doorH: 2.5, stairX: 4, stairW: 2.2, stairL: 5.2, drop: 3.5 };
GF.zB = -GF.D / 2; GF.base = [GF.stairX + 12, -GF.drop, GF.zB - GF.stairL - 13];      // the basement room's origin in the ground floor's frame
export const groundPlanSpec = () => ({ portal: { at: [0, GF.zF + GF.t / 2], out: 0, w: GF.doorW, h: GF.doorH, from: { x0: -9, x1: 9, z0: GF.zB - 1, z1: 12, y0: -1, y1: 5 } }, rects: [[-GF.W / 2, GF.zB, GF.W / 2, GF.zF]], wall: 1.12, slide: 0.45,
  mid: [0.2, 2.2], center: [0, 0],
  tour: [[GF.stairX, GF.zB + 1.2, 0], [GF.stairX, GF.zB - GF.stairL / 2, -GF.drop / 2], [GF.stairX, GF.zB - GF.stairL - 1.6, -GF.drop], [GF.base[0] - 4, GF.base[2] + 10.6, -GF.drop]] });
export const groundY = (x, z) => (z > GF.zB ? 0 : z > GF.zB - GF.stairL ? -GF.drop * (GF.zB - z) / GF.stairL : -GF.drop);
/** a collider that adds everything `d` away (the basement built in its own coordinates, placed under the shop) */
const shifted = (col, ox, oz) => ({ addSegment: (x1, z1, x2, z2, o) => col.addSegment(x1 + ox, z1 + oz, x2 + ox, z2 + oz, o), addBox: (x, z, w, d, r) => col.addBox(x + ox, z + oz, w, d, r), addCircle: (x, z, r) => col.addCircle(x + ox, z + oz, r), addPolygon: (p) => col.addPolygon(p.map((q) => [q[0] + ox, q[1] + oz])) });
export function buildGround(ctx, world, plan = null) {
  const K = world.interiorKit, s = ctx.scene, col = ctx.collider, A = new Acc(), books = [];
  const SL = !!(ctx.seamless && plan);
  const W = SL ? GF.W : 15, D = 18, H = 3.3;
  if (SL) K.room(s, { x: 0, z: (GF.zF + GF.zB) / 2, w: W, d: GF.zF - GF.zB, h: H, floor: 'wood', walls: 'plaster', collider: col, doors: [...kitGaps(plan, { z: (GF.zF + GF.zB) / 2 }), { wall: 'n', at: GF.stairX, width: GF.stairW, height: 2.4 }] });
  else K.room(s, { w: W, d: D, h: H, floor: 'wood', walls: 'plaster', collider: col, doors: [{ wall: 's', at: 0, width: 1.8, height: 2.5 }, { wall: 'n', at: 4, width: 2.2, height: 2.4 }] });
  // wall shelves all round (but the door gaps), island tables of new books, two freestanding runs
  shelves(A, K, books, -W / 2 + 0.2, 0, D - 2, Math.PI / 2, 2.6, 0.38, col);
  shelves(A, K, books, W / 2 - 0.2, 0, D - 2, -Math.PI / 2, 2.6, 0.38, col);
  shelves(A, K, books, -2.6, -D / 2 + 0.2, 9.0, 0, 2.6, 0.38, col);
  for (const z of [-3.5, 0.5]) { shelves(A, K, books, -3.2, z, 4.2, 0, 1.8, 0.36, null); shelves(A, K, books, -3.2, z - 0.4, 4.2, Math.PI, 1.8, 0.36, null); col.addBox(-3.2, z - 0.2, 4.2, 0.8, 0); }
  // display tables (face-out new books on a canvas texture)
  const cover = new THREE.MeshStandardMaterial({ map: displayTexture(3), roughness: 0.8, name: 'bs:covers' });
  const tops = [];
  for (const [x, z] of [[2.6, 3.8], [2.6, -0.6], [-3.0, 5.0]]) {
    A.box('table', K, x, 0.4, z, 2.2, 0.8, 1.1); col.addBox(x, z, 2.2, 1.1, 0);
    const g = new THREE.PlaneGeometry(2.0, 0.9); g.rotateX(-Math.PI / 2); g.translate(x, 0.815, z); tops.push(g);
  }
  // the till: a counter on the east side by the door
  A.box('wood', K, 5.0, 0.5, 6.0, 2.6, 1.0, 0.7); col.addBox(5.0, 6.0, 2.6, 0.7, 0);
  A.box('table', K, 5.0, 1.02, 6.0, 2.7, 0.05, 0.8);
  // a "Basement Room" sign over the stair door (north wall) — lettering on a board
  const sign = new THREE.Mesh(quad(4, 2.75, -D / 2 + 0.12, 2.6, 0.42, 0, 1), new THREE.MeshBasicMaterial({ map: canvasTex(512, 84, (x, w, h) => { x.fillStyle = '#21402e'; x.fillRect(0, 0, w, h); x.fillStyle = '#f3efe2'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('↓  ' + SHOP.room.toUpperCase(), w / 2, h / 2 + 2); }) }));
  s.add(sign);
  const topM = new THREE.Mesh(mergeQuads(tops), cover); s.add(topM);
  finish(s, A, books, world);
  for (const [x, z, i] of SL ? [[0, -5, 7], [-3, 3, 5], [3, 3, 5]] : [[-3, -5, 5], [3, -5, 5], [-3, 3, 5], [3, 3, 5]]) K.warmLight(s, { x, y: H - 0.3, z, intensity: i, distance: SL ? 13 : 11, color: 0xfff0dc });
  if (SL) {
    // ---- the recessed lobby, the shop door, the stair down and the basement room
    s.add(reveal(plan.seamless.portals, { floor: true }));
    cityDoor(ctx, plan, { style: 'glass', hinge: 1, open: plan.hours && plan.hours.open });
    const x0 = GF.stairX - GF.stairW / 2, x1 = GF.stairX + GF.stairW / 2, zb = GF.zB, n = 18, going = GF.stairL / n, rise = GF.drop / n;
    const B2 = new Acc();
    for (let i = 0; i < n; i++) B2.box('table', K, GF.stairX, -rise * (i + 1) + rise / 2 - 0.02, zb - going * (i + 0.5) - 0.1, GF.stairW, rise + 0.04, going + 0.02);
    B2.box('pier', K, x0 - 0.1, (H - GF.drop) / 2, zb - GF.stairL / 2 - 0.1, 0.2, H + GF.drop, GF.stairL + 0.2); B2.box('pier', K, x1 + 0.1, (H - GF.drop) / 2, zb - GF.stairL / 2 - 0.1, 0.2, H + GF.drop, GF.stairL + 0.2);
    B2.box('pier', K, GF.stairX, 2.46, zb - GF.stairL / 2 - 0.1, GF.stairW, 0.12, GF.stairL + 0.2);                              // the soffit over the flight
    B2.box('pier', K, GF.stairX, (2.4 - GF.drop + 2.9) / 2 + 0.3, zb - GF.stairL - 0.1, GF.stairW, 2.4 + GF.drop - 2.9 + 0.6 - 2.4 + 2.0, 0.2);      // the wall over the basement door
    for (const [x, sgn] of [[x0 + 0.06, 1], [x1 - 0.06, -1]]) { void sgn; B2.beam('wood', K, [x, 0.95, zb - 0.1], [x, 0.95 - GF.drop, zb - GF.stairL - 0.1], 0.05, 0.06); }      // handrails
    col.addSegment(x0, zb, x0, zb - GF.stairL - 0.2); col.addSegment(x1, zb, x1, zb - GF.stairL - 0.2);
    finish(s, B2, [], world, { pier: world.mats.plaster || world.mats.whitePaint });
    const g = new THREE.Group(); g.name = 'bs:basement'; g.position.set(GF.base[0], GF.base[1], GF.base[2]); g.updateMatrix(); s.add(g);
    const bctx = { ...ctx, scene: g, collider: shifted(col, GF.base[0], GF.base[2]), seamless: null, under: true, addExit() {} };
    const br = buildBasement(bctx, world);
    ctx.setGround(groundY);
    mergeRoom(s);
    return { spawn: [0, GF.zF - 1.4], heading: Math.PI, exit: [0, GF.zF - 0.5], stairs: [GF.stairX, -D / 2 + 0.9], till: [5.0, 5.2], W, D, basement: br, base: GF.base };
  }
  return { spawn: [0, D / 2 - 1.4], heading: Math.PI, exit: [0, D / 2 - 0.5], stairs: [4, -D / 2 + 0.9], till: [5.0, 5.2], W, D };
}

/** the basement room: 34 × 26 m under a low ceiling on square piers, row after row of shelving, section signs */
export function buildBasement(ctx, world) {
  const K = world.interiorKit, s = ctx.scene, col = ctx.collider, A = new Acc(), books = [], signs = [];
  const W = 34, D = 26, H = 2.9;
  K.room(s, { w: W, d: D, h: H, floor: 'carpet', walls: 'plaster', collider: col, doors: [{ wall: 's', at: -12, width: 2.2, height: 2.4 }] });
  // perimeter shelving
  shelves(A, K, books, -W / 2 + 0.2, 0, D - 1, Math.PI / 2, 2.4, 0.36, col);
  shelves(A, K, books, W / 2 - 0.2, 0, D - 1, -Math.PI / 2, 2.4, 0.36, col);
  shelves(A, K, books, 0, -D / 2 + 0.2, W - 1, 0, 2.4, 0.36, col);
  shelves(A, K, books, 5, D / 2 - 0.2, W - 12, Math.PI, 2.4, 0.36, col);
  // stacks: double-sided runs, 12 m long, in rows, with a main aisle; one section per run
  const sections = [], atlas = sectionAtlas();
  let si = 0;
  for (const z of [-8, -3, 2, 7]) for (const x of [-9, 9]) {
    if (si >= SECTIONS.length) break;
    shelves(A, K, books, x, z, 12, 0, 2.1, 0.34, null); shelves(A, K, books, x, z - 0.36, 12, Math.PI, 2.1, 0.34, null);
    col.addBox(x, z - 0.18, 12, 0.72, 0);
    // a hanging sign over the run's aisle end, both faces
    const uv = atlas.uv(si);
    signs.push(quad(x, 2.45, z + 0.9, 2.6, 0.32, 0, 1, uv), quad(x, 2.45, z + 0.88, 2.6, 0.32, 0, -1, uv));
    sections.push({ name: SECTIONS[si], x, z: z + 0.9, h: Math.PI });
    si++;
  }
  // the rest of the sections on the perimeter walls (east and west)
  for (; si < SECTIONS.length; si++) {
    const k = si - 8, x = k % 2 ? W / 2 - 1.2 : -W / 2 + 1.2, z = -6 + Math.floor(k / 2) * 10, nx = k % 2 ? -1 : 1;
    signs.push(quad(x + nx * 0.6, 2.45, z, 2.6, 0.32, nx, 0, atlas.uv(si)));
    sections.push({ name: SECTIONS[si], x: x + nx * 0.6, z, h: nx > 0 ? -Math.PI / 2 : Math.PI / 2 });
  }
  // square piers holding up the garden above
  for (const x of [-16 + 8, 0, 8]) for (const z of [-5.5, 4.5]) { A.box('pier', K, x === 0 ? 0 : x, H / 2, z, 0.6, H, 0.6); col.addBox(x, z, 0.6, 0.6, 0); }
  // a few low benches and kick-stools
  for (const [x, z] of [[0, -0.5], [0, 9.5]]) { A.box('table', K, x, 0.22, z, 1.6, 0.44, 0.45); col.addBox(x, z, 1.6, 0.45, 0); }
  const sg = new THREE.Mesh(mergeQuads(signs), new THREE.MeshBasicMaterial({ map: atlas.tex, side: THREE.DoubleSide })); sg.name = 'bs:sections'; s.add(sg);
  finish(s, A, books, world, { pier: world.mats.plaster || world.mats.whitePaint });
  // strip lights: a few point lights, low (the room is lit evenly; four lights keep the shader cheap)
  for (const [x, z, i] of ctx.under ? [[-8, 1, 10], [8, 1, 10]] : [[-8, -4, 7], [8, -4, 7], [-8, 6, 7], [8, 6, 7]]) K.warmLight(s, { x, y: H - 0.25, z, intensity: i, distance: ctx.under ? 24 : 16, color: 0xf4f6ff });
  return { spawn: [-12, D / 2 - 1.5], heading: Math.PI, stairsUp: [-12, D / 2 - 0.5], sections, W, D };
}
