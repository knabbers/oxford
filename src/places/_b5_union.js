// The Oxford Union (1857 / 1878): geometry for places/oxford_union.js — see docs/research/landmarks_batch5.md.
// Frame: St Michael's Street runs along u (v = -25); +v goes south towards Frewin Court. Origin U0.
import * as THREE from 'three';
import { RB, siteFrame, range, pointPts, rectPts, corners } from './_b5_kit.js';

export const F = siteFrame([45, 200], -0.3631);
const { Q, QRv } = F;

export const UN = {
  chamber: QRv(6.8, 16.2, -20.3, 12.0), chamberDoor: [6.8, -6.0],
  library: QRv(-16, -4.1, 20.4, 35.4), apse: [[-16, 35.4], [-12.7, 39.7], [-6.8, 39.7], [-4.1, 35.4]],
  lawn: [[-15.2, -19.4], [5.8, -19.4], [5.8, 18.6], [-13.8, 19.4], [-15.6, 12.2]],
  gate: [-4.5, -20.4],
  // the hall's garden door as modelled: a pointed arch (pointPts: rise 0.707 w), recessed; the walk-in room's oak leaf fills it
  door: { w: 1.7, spring: 1.9, rise: 1.7 * 0.7071, h: 1.9 + 1.7 * 0.7071, rec: 0.3 },
};
const circle = (cx, cy, r, n = 10) => { const p = []; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; p.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } return p; };

/** a coved eaves cornice along one long side of rect R (terracotta), outward side sg (±1 across v) */
function cove(B, R, h, sg, key = 'terracotta') {
  const ux = Math.cos(R.a), uz = Math.sin(R.a), vx = -uz, vz = ux, hl = R.L / 2 + 0.1, hw = R.W / 2;
  const P = (u, v, y) => [R.cx + ux * u + vx * v * sg, y, R.cz + uz * u + vz * v * sg];
  B.poly(key, [P(-hl, hw, h - 0.75), P(hl, hw, h - 0.75), P(hl, hw + 0.55, h - 0.05), P(-hl, hw + 0.55, h - 0.05)], [vx * sg, -0.7, vz * sg]);
  B.poly(key, [P(-hl, hw + 0.55, h - 0.05), P(hl, hw + 0.55, h - 0.05), P(hl, hw + 0.62, h + 0.12), P(-hl, hw + 0.62, h + 0.12)], [vx * sg, 0.2, vz * sg]);
}

/** Waterhouse's debating hall (1878): red brick, terracotta dressings, 2-light mullion-and-transom windows between
 *  buttresses, a deep coved eaves cornice, a steep slate roof with coped gables; the gable to St Michael's Street */
export function buildChamber(q) {
  const B = new RB(), R = UN.chamber, h = 10.2;
  const win = { rows: [[3.4, 8.6, 'mullion', 1.9]], bay: 3.7 };
  const doorX = UN.chamberDoor[1] - (-20.3 + 12) / 2;
  range(B, { R, h, wall: 'brick', dress: 'terracotta', roof: 'gable', roofKey: 'slateBlue', ridgeKey: 'terracotta', pitch: 0.95, coped: true, plinth: 0.6, strings: [3.0],
    buttress: { w: 0.8, d: 0.9, h: 8.6 },
    sides: [{ ...win, skip: (x) => Math.abs(x - doorX) < 1.5, extra: [{ x: doorX, y0: 0, y1: UN.door.h, key: 'archDoor', w: UN.door.w, rec: UN.door.rec, pts: pointPts(doorX, UN.door.w, 0, UN.door.spring, 6) }] }, {},
      {}, { extra: [{ x: 0, y0: 3.4, y1: 8.8, key: 'mullion', w: 3.6, pts: rectPts(-1.8, 3.4, 1.8, 8.8) }, { x: 0, y0: 11.0, y1: 12.6, key: 'leaded', w: 1.6, pts: circle(0, 11.8, 0.8) }], noButtress: true }] }, q);
  if (q < 2) { cove(B, R, h, 1); cove(B, R, h, -1); }
  return B;
}

/** Woodward's old debating room, now the Old Library (1857): brick Gothic, pointed lights below, a row of roundels under
 *  the eaves (where the murals are inside), a steep roof ending in a polygonal apse */
export function buildLibrary(q) {
  const B = new RB(), R = UN.library, h = 7.8, pitch = 1.0;
  const side = { rows: [[1.4, 3.9, 'perp', 1.2, 'point']], bay: 3.0, extra: [] };
  const sides = [JSON.parse(JSON.stringify(side)), JSON.parse(JSON.stringify(side))];
  for (const s of sides) for (let k = -2; k <= 2; k++) s.extra.push({ x: k * 3.0, y0: 5.0, y1: 6.6, key: 'leaded', w: 1.6, pts: circle(k * 3.0, 5.8, 0.8) });
  range(B, { R, h, wall: 'brick', dress: 'stoneGrey', roof: 'gable', roofKey: 'slate', pitch, coped: false, plinth: 0.5, strings: [4.4], sides: [...sides, {}, { extra: [{ x: 0, y0: 2.0, y1: 6.4, key: 'perp', w: 2.4, pts: pointPts(0, 2.4, 2.0, 6.4 - 1.6) }] }], noWalls: [2] }, q);
  // the apse: three brick facets and a hipped roof to the end of the ridge
  const A = UN.apse.map(([u, v]) => Q(u, v)), roofH = Math.tan(pitch) * (R.W / 2), top = Q(-10.05, 35.4);
  for (let i = 0; i < 3; i++) {
    const a = A[i], b = A[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
    // outward = right of travel here (the apse runs west -> east round the south end)
    const n = [-nx, -nz];
    B.poly('brick', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]], [n[0], 0, n[1]], [[0, 0], [L, 0], [L, h], [0, h]]);
    B.poly('slate', [[a[0] + n[0] * 0.3, h - 0.25, a[1] + n[1] * 0.3], [b[0] + n[0] * 0.3, h - 0.25, b[1] + n[1] * 0.3], [top[0], h + roofH, top[1]]], [n[0], 1, n[1]]);
    if (q < 2) { const m = [(a[0] + b[0]) / 2 + n[0] * 0.03, (a[1] + b[1]) / 2 + n[1] * 0.03], t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      const P = (x, y) => [m[0] + t[0] * x, y, m[1] + t[1] * x];
      const w = i === 1 ? 1.4 : 1.0, ys = 4.6;
      B.poly('perp', [P(-w / 2, 1.6), P(w / 2, 1.6), P(w / 2, ys), P(-w / 2, ys)], [n[0], 0, n[1]], [[0.004, 0.004], [0.996, 0.004], [0.996, 0.996], [0.004, 0.996]]);
    }
  }
  return B;
}

/** the railings' gate on St Michael's Street with the name board, and the lawn's edging */
export function buildGarden(q) {
  const B = new RB();
  const [gu, gv] = UN.gate;
  for (const du of [-1.7, 1.7]) { const p = Q(gu + du, gv); B.box('brick', p[0], 1.1, p[1], 0.6, 2.2, 0.6, -F.a, { top: true }); B.box('stoneGrey', p[0], 2.3, p[1], 0.75, 0.2, 0.75, -F.a, { top: true }); }
  if (q === 0) { B.push(F.face(gu, gv - 0.36, 'nv')); B.card('sign_union', [-1.4, 2.5, 0], [1.4, 2.5, 0], [1.4, 2.95, 0], [-1.4, 2.95, 0], [0.004, 0.004, 0.996, 0.996]); B.pop();
    // the debate notice on a board by the chamber door
    B.push(F.face(UN.chamberDoor[0] - 0.92, UN.chamberDoor[1] + 2.4, 'nu')); B.card('sign_debate', [-0.7, 1.3, 0], [0.7, 1.3, 0], [0.7, 1.75, 0], [-0.7, 1.75, 0], [0.004, 0.004, 0.996, 0.996]); B.box('oak', 0, 0.65, -0.05, 0.08, 1.3, 0.08, 0); B.pop(); }
  return B;
}
export const lawnWorld = () => UN.lawn.map(([u, v]) => Q(u, v));
export const SOLIDS = () => [corners(UN.chamber), [Q(-16, 20.4), Q(-4.1, 20.4), Q(-4.1, 35.4), Q(-6.8, 39.7), Q(-12.7, 39.7), Q(-16, 35.4)]];

// ------------------------------------------------------------------------------------------------ the debating chamber
/** an invented, harmless motion (no real people): the board and the debate's script */
export const MOTION = 'This House Believes That Pigeons Should Pay Rent';
export const SPEECH = {
  prop: ['"Madam President, the pigeon has lived rent-free in this city since the Middle Ages."', '"It roosts on our finest buildings and contributes nothing but commentary."', '"I say: a modest charge. Payable in breadcrumbs, if need be."'],
  opp: ['"Madam President, my honourable opponent would means-test a bird."', '"The pigeon was here first. It is not a tenant; it is a landlord."', '"If anyone pays rent round here, it should be us, to the pigeons."'],
  heckles: ['"Shame!"', '"Point of information!"', '"Hear, hear!"', '(a slow handclap from the gallery)', '"Order! Order!"'],
};
/** the house divides: a pure function of the game day and the side you spoke for -> {ayes, noes, won} */
export function division(day, side) {
  let h = Math.imul((day | 0) ^ 0x5bd1e995, 0x27d4eb2d) ^ (side === 'prop' ? 0x9e3779b9 : 0x7f4a7c15); h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  const r = (h >>> 0) / 4294967296, ayes = 120 + Math.floor(r * 160), noes = 120 + Math.floor(((r * 7.31) % 1) * 160);
  const forMotion = ayes > noes;
  return { ayes, noes, won: side === 'prop' ? forMotion : !forMotion };
}

/** the motion board: a canvas texture (interiors only) */
export function motionTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  try {
    g.fillStyle = '#1a2a4a'; g.fillRect(0, 0, 1024, 512); g.strokeStyle = '#c9a54a'; g.lineWidth = 10; g.strokeRect(14, 14, 996, 484);
    g.fillStyle = '#f0e6c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 44px Georgia, serif'; g.fillText('THE MOTION', 512, 92);
    g.font = 'bold 54px Georgia, serif'; g.fillText('This House Believes That', 512, 216); g.fillText('Pigeons Should Pay Rent', 512, 292);
    g.font = '32px Georgia, serif'; g.fillText('Thursday  ·  8.30 pm  ·  Members and their guests', 512, 410);
  } catch { /* node stub */ }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** the chamber's furniture as merged boxes (vertex colours): tiered benches facing each other, the despatch boxes on
 *  the table, the President's chair on a dais, the gallery on three sides; -> {geo, solids: [[x, z, w, d]]} */
export function chamberContents(D) {
  const parts = [], solids = [];
  const box = (x, y, z, w, h, d, col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g); };
  const LEATHER = 0x3f5a3a, WOOD = 0x5a3a22, DARK = 0x2e2016, BRASS = 0xb99a4a;
  // four tiers of benches each side, running the length of the floor (x across, z along; the dais at -z)
  // (walk-in plan, oxford_union.js: D.tiers benches a side, D.gal = gallery depth, D.gang = { side, z0, z1 }: a gangway
  //  through that side's benches from the door in the long wall)
  const NT = D.tiers || 4, gw = D.gal || 2.0, bx0 = D.tiers ? 2.2 : 2.75;
  for (const s of [-1, 1]) for (let t = 0; t < NT; t++) {
    const x = s * (bx0 + t * 0.85), y = t * 0.38, z0 = -D.d / 2 + 6.0, z1 = D.d / 2 - 2.6;
    const runs = D.gang && D.gang.side === s ? [[z0, D.gang.z0], [D.gang.z1, z1]] : [[z0, z1]];
    for (const [a, b2] of runs) { const L = b2 - a, zc = (a + b2) / 2;
      box(x, 0, zc, 0.85, y + 0.02, L, DARK);                 // the step
      box(x, y, zc, 0.62, 0.44, L - 0.1, LEATHER);            // the seat
      box(x + s * 0.34, y + 0.44, zc, 0.12, 0.55, L - 0.1, LEATHER);   // the back
    }
  }
  if (D.tiers) { for (const s of [-1, 1]) { const z0 = -D.d / 2 + 6.0, z1 = D.d / 2 - 2.6, w = NT * 0.85, xc = s * (bx0 - 0.425 + w / 2); for (const [a, b2] of D.gang && D.gang.side === s ? [[z0, D.gang.z0], [D.gang.z1, z1]] : [[z0, z1]]) solids.push([xc, (a + b2) / 2, w, b2 - a]); } }
  else for (const s of [-1, 1]) solids.push([s * 4.15, (-D.d / 2 + 6.0 + D.d / 2 - 2.6) / 2, 3.3, D.d / 2 - 2.6 + D.d / 2 - 6.0]);
  // the table with the two despatch boxes, the floor between the front benches
  box(0, 0, -1.0, 1.4, 0.82, 3.0, WOOD); solids.push([0, -1.0, 1.5, 3.1]);
  for (const s of [-1, 1]) { box(s * 0.42, 0.82, -1.0, 0.46, 0.3, 0.66, DARK); box(s * 0.42, 1.12, -1.0, 0.5, 0.03, 0.7, BRASS); }
  // the dais, the President's chair (tall-backed), the clerks' desk below it
  box(0, 0, -D.d / 2 + 2.0, 5.0, 0.5, 3.4, WOOD); solids.push([0, -D.d / 2 + 2.0, 5.0, 3.4]);
  box(0, 0.5, -D.d / 2 + 1.4, 1.1, 0.5, 0.9, LEATHER); box(0, 1.0, -D.d / 2 + 1.0, 1.2, 2.2, 0.22, DARK); box(0, 3.15, -D.d / 2 + 1.0, 1.4, 0.3, 0.26, BRASS);
  box(0, 0, -D.d / 2 + 4.2, 3.0, 0.9, 0.8, WOOD);
  // the gallery: a deck on posts along both sides and the far end, a panelled front
  const gy = 4.4;
  for (const s of [-1, 1]) { box(s * (D.w / 2 - gw / 2), gy, 0, gw, 0.25, D.d - 0.2, WOOD); box(s * (D.w / 2 - gw), gy + 0.25, 0, 0.1, 1.0, D.d - 0.2, DARK); if (!D.tiers) for (let z = -D.d / 2 + 2; z < D.d / 2; z += 4) box(s * (D.w / 2 - 2.0), 0, z, 0.18, gy, 0.18, DARK); }
  box(0, gy, D.d / 2 - 1.0, D.w - 2 * gw, 0.25, 2.0, WOOD); box(0, gy + 0.25, D.d / 2 - 2.0, D.w - 2 * gw, 1.0, 0.1, DARK);
  // gallery benches
  for (const s of [-1, 1]) box(s * (D.w / 2 - 0.6), gy + 0.25, 0, 0.6, 0.45, D.d - 1, LEATHER);
  const geo = mergeBoxes(parts);
  return { geo, solids, galleryY: gy };
}
function mergeBoxes(parts) {
  let n = 0; for (const g of parts) n += g.index.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { const I = g.index.array, P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array; for (let k = 0; k < I.length; k++, o++) { const i = I[k]; pos.set(P.subarray(i * 3, i * 3 + 3), o * 3); nor.set(N.subarray(i * 3, i * 3 + 3), o * 3); col.set(C.subarray(i * 3, i * 3 + 3), o * 3); } g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}
