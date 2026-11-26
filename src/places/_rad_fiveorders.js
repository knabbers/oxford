// The Tower of the Five Orders (Old Schools Quadrangle, 1613-24), visual pass: the frontispiece on the quad face of the
// gate tower, five stages of coupled columns, each order with its own capital (Tuscan cushion; Doric with annulets and a
// triglyph frieze; Ionic volutes over an egg-and-dart echinus; Corinthian acanthus bell; Composite bell with Ionic
// volutes), entablatures breaking forward over the pairs, mullioned windows in the centre bay, the gate below, the
// James I group (gilded) in the fourth stage, a pierced cresting with obelisks; and the tower block rising two stages
// above the ranges, with the Great Gate on Catte Street. Three levels of detail.
//   build(ctx) -> { dims }   ctx = { front: [B0, B1, B2] (quad side), block: [B0, B1, B2] (outside), face: [[x,z],[x,z]]
//   (quad face, left -> right seen from the quad), back: [[x,z],[x,z]] (Catte Street face) }
import * as THREE from 'three';
import { frame, rectPts, archPts, tudorPts } from './_rad_kit.js';

export const FIVE = {
  width: 8.2,
  stages: [                       // [name, top (m), column radius] (G: proportions from photographs)
    ['Tuscan', 4.6, 0.27], ['Doric', 8.7, 0.25], ['Ionic', 12.7, 0.23], ['Corinthian', 16.9, 0.21], ['Composite', 20.9, 0.19],
  ],
  top: 22.6,                      // cresting / tower top (two stages above the 17.6 m ranges)
  colX: [2.55, 3.35],             // coupled columns either side of the centre bay
};
const trans = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

export function build(ctx) {
  const D = FIVE;
  const [a, b] = ctx.face, len = Math.hypot(b[0] - a[0], b[1] - a[1]), ax = (b[0] - a[0]) / len, az = (b[1] - a[1]) / len;
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  let Q = null, cx = mx, cz = mz;
  if (ctx.back) {
    const [c, d] = ctx.back, P = [a, b, c, d]; cx = (a[0] + b[0] + c[0] + d[0]) / 4; cz = (a[1] + b[1] + c[1] + d[1]) / 4;
    Q = P.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz); return [x + (x - cx) / l * 0.12, z + (z - cz) / l * 0.12]; });
  }
  // ---------------------------------------------------------------- the tower block (outside faces, battlements, the Great Gate)
  function block(B, q) {
    if (!Q) return;
    for (let i = 0; i < 4; i++) {
      const p = Q[i], r = Q[(i + 1) % 4], nx = (p[1] - r[1]), nz = (r[0] - p[0]), m = [(p[0] + r[0]) / 2, (p[1] + r[1]) / 2];
      const s = (m[0] - cx) * nx + (m[1] - cz) * nz > 0 ? 1 : -1, L = Math.hypot(r[0] - p[0], r[1] - p[1]);
      const ex = (r[0] - p[0]) / L, ez = (r[1] - p[1]) / L, flip = (-ez * nx * s + ex * nz * s) < 0;
      B.push(frame(m[0], 0, m[1], flip ? -ex : ex, flip ? -ez : ez));
      const isBack = i === 2;
      const gate = tudorPts(0, 3.0, 0, 3.0, 1.0, 8), wins = [tudorPts(0, 2.2, 7.4, 9.6, 0.5, 4), tudorPts(0, 2.2, 12.0, 14.2, 0.5, 4)];
      if (i === 0) { /* the quad face: the frontispiece stands here and covers it */ }
      else if (q === 0 && isBack) {
        B.face('radHoney', rectPts(-L / 2, 0, L / 2, D.top), [gate, ...wins], 0);
        B.reveal('radHoney', gate, 0, -1.6); B.unit('doorOak', gate, -1.6, [0, 0]);
        for (const w of wins) { B.reveal('radHoney', w, 0, -0.3); B.unit('mullion', w, -0.3, [0, 0]); }
        for (const y of [5.2, 17.6]) B.box('radPale', 0, y, 0.1, L, 0.3, 0.2, 0, { bottom: true });
      } else {
        B.poly('radHoney', [[-L / 2, 0, 0], [L / 2, 0, 0], [L / 2, D.top, 0], [-L / 2, D.top, 0]], [0, 0, 1]);
        if (isBack && q < 2) { B.unit('doorOak', gate, 0.02, [0, 0]); for (const w of wins) B.unit('mullion', w, 0.02, [0, 0]); }
      }
      // battlements (merlons) with a coping string
      if (q < 2) {
        B.box('radPale', 0, D.top + 0.1, -0.1, L, 0.2, 0.45, 0, { top: true, bottom: q === 0 });
        const n = Math.max(2, Math.round(L / 1.3));
        for (let k = 0; k < n; k += 2) B.box('radHoney', -L / 2 + (k + 0.5) * (L / n), D.top + 0.6, -0.15, L / n, 0.8, 0.35, 0, { top: true });
      }
      B.pop();
    }
    const pts = Q.map(([x, z]) => [x, z]);
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))), g = new THREE.ShapeGeometry(sh), pos = g.attributes.position, idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const T = [0, 1, 2].map((k) => [pos.getX(idx[i + k]), D.top - 0.05, pos.getY(idx[i + k])]); B.poly('radLead', T, [0, 1, 0], T.map((p) => [p[0], p[2]])); }
    g.dispose();
  }

  // ---------------------------------------------------------------- the frontispiece (quad face)
  let ox = -az, oz = ax;
  if (ctx.back) { const [c] = ctx.back; if ((c[0] - mx) * ox + (c[1] - mz) * oz > 0) { ox = -ox; oz = -oz; } }
  const flip = ox !== -az;
  const FF = frame(mx + ox * 0.12, 0, mz + oz * 0.12, flip ? -ax : ax, flip ? -az : az);
  const W = Math.max(D.width, len + 0.3), hw = W / 2;   // the frontispiece covers the whole quad face of the tower
  const band = (B, key, x0, x1, y0, y1, z) => B.poly(key, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], [[x0, 0], [x1, 0], [x1, 1], [x0, 1]]);
  function capital(B, i, x, y, z, r) {
    // y = top of the shaft (astragal); returns the top of the abacus
    B.lathe('radPale', x, z, [[r * 0.92, y], [r * 1.08, y + 0.04], [r * 1.08, y + 0.09], [r * 0.92, y + 0.11]], { seg: 8, crease: 0.5 });
    const y1 = y + 0.11;
    if (i <= 1) {
      B.lathe('radPale', x, z, [[r * 0.92, y1], [r * 0.95, y1 + 0.12], ...(i === 1 ? [[r * 1.02, y1 + 0.14], [r * 1.02, y1 + 0.18], [r * 0.95, y1 + 0.2]] : []), [r * 1.3, y1 + 0.32], [0, y1 + 0.32]], { seg: 8, crease: 0.5 });
      B.box('radPale', x, y1 + 0.39, z, r * 2.8, 0.14, r * 2.8, 0, { bottom: true });
      return y1 + 0.46;
    }
    if (i === 2) {
      B.lathe('radPale', x, z, [[r * 0.92, y1, 'egg', true], [r * 1.18, y1 + 0.16], [0, y1 + 0.16]], { seg: 8, crease: 0.4 });
      for (const s of [-1, 1]) { B.push(trans(x + s * r * 1.15, y1 + 0.02, z + 0.02)); B.push(new THREE.Matrix4().makeRotationX(Math.PI / 2)); B.lathe('radPale', 0, 0, [[0, -r * 1.0], [r * 0.42, -r * 1.0], [r * 0.5, -r * 0.7], [r * 0.5, r * 0.7], [r * 0.42, r * 1.0], [0, r * 1.0]], { seg: 8, crease: 0.6 }); B.pop(); B.pop(); }
      B.box('radPale', x, y1 + 0.24, z, r * 3.2, 0.12, r * 2.4, 0, { bottom: true });
      return y1 + 0.3;
    }
    const bt = y1 + r * 2.2;
    B.lathe('radPale', x, z, [[r * 0.92, y1, 'leaf', true], [r * 1.25, bt], [0, bt]], { seg: 8, crease: 0.4 });
    if (i === 3) for (let k = 0; k < 4; k++) { const a2 = Math.PI / 4 + k * Math.PI / 2; B.box('radPale', x + Math.sin(a2) * r * 1.2, bt - 0.08, z + Math.cos(a2) * r * 1.2, 0.1, 0.16, 0.1, a2, { top: false }); }
    else for (const s of [-1, 1]) { B.push(trans(x + s * r * 1.25, bt - 0.1, z + 0.02)); B.push(new THREE.Matrix4().makeRotationX(Math.PI / 2)); B.lathe('radPale', 0, 0, [[0, -r * 1.0], [r * 0.45, -r * 1.0], [r * 0.45, r * 1.0], [0, r * 1.0]], { seg: 8, crease: 0.6 }); B.pop(); B.pop(); }
    B.box('radPale', x, bt + 0.06, z, r * 3.1, 0.12, r * 3.1, 0, { bottom: true });
    return bt + 0.12;
  }
  function front(B, q) {
    B.push(FF);
    let y0 = 0;
    D.stages.forEach(([, top, r], i) => {
      const h = top - y0, ped = i === 0 ? 0.9 : 0.75, ent = 0.62, zc = 0.45 + r * 0.4;
      // the centre bay's opening
      const open = i === 0 ? archPts(0, 2.6, 0.02, 2.6, 10) : i === 3 ? archPts(0, 3.0, y0 + 0.5, y0 + 2.4, 10) : rectPts(-1.2, y0 + 0.75, 1.2, top - ent - 0.55);
      if (q === 0) {
        B.face('radHoney', rectPts(-hw, y0, hw, top - ent), [open], 0.1);
        for (const s of [-1, 1]) B.poly('radHoney', [[s * hw, y0, 0.1], [s * hw, y0, 0], [s * hw, top, 0], [s * hw, top, 0.1]], [s, 0, 0]);
        B.push(trans(0, 0, 0.1));
        if (i === 0) { B.reveal('radPale', open, 0, -1.4); B.unit('doorOak', open, -1.4, [0, 0]); }
        else if (i === 3) { B.reveal('radGroove', open, 0, -0.7); B.poly('radGroove', open.map(([x, y]) => [x, y, -0.7]), [0, 0, 1]); }
        else { B.reveal('radPale', open, 0, -0.3); B.unit('mullion', open, -0.3, [0, 0]); }
        B.pop();
        // between the pairs and outside them: a panel of blind ornament
        for (const s of [-1, 1]) band(B, 'panel', s > 0 ? 1.6 : -2.0, s > 0 ? 2.0 : -1.6, y0 + ped + 0.2, top - ent - 0.25, 0.11);
        // columns
        for (const s of [-1, 1]) for (const cxp of D.colX) {
          const x = s * cxp, colTop = top - ent - (i <= 1 ? 0.46 : i === 2 ? 0.41 : r * 2.2 + 0.23);
          B.box('radPale', x, y0 + ped / 2, zc, r * 2.9, ped, r * 2.9, 0, { top: false });
          B.box('radPale', x, y0 + ped - 0.05, zc, r * 3.2, 0.1, r * 3.2, 0, { bottom: true });
          B.lathe('radPale', x, zc, [[r * 1.3, y0 + ped], [r * 1.3, y0 + ped + 0.08], [r * 1.1, y0 + ped + 0.15], [r, y0 + ped + 0.22], [r, y0 + ped + 0.3 * (colTop - y0 - ped)], [r * 0.86, colTop]], { seg: 8, crease: 0.5 });
          capital(B, i, x, colTop, zc, r);
        }
        // entablature, breaking forward over each pair
        const ye = top - ent;
        B.box('radPale', 0, ye + 0.11, 0.2, W, 0.22, 0.2, 0, { bottom: true });
        if (i === 1) { for (let k = -6; k <= 6; k++) B.box('radPale', k * 0.66, ye + 0.33, 0.24, 0.24, 0.2, 0.08, 0, { top: false }); B.box('radHoney', 0, ye + 0.33, 0.15, W, 0.22, 0.1, 0, { top: false }); }
        else { B.box('radPale', 0, ye + 0.33, 0.15, W, 0.22, 0.1, 0, { top: false }); band(B, i === 2 ? 'egg' : i >= 3 ? 'dentil' : 'radPale', -hw, hw, ye + 0.22, ye + 0.44, 0.205); }
        B.box('radPale', 0, ye + 0.53, 0.32, W + 0.4, 0.18, 0.64, 0, { bottom: true, top: true });
        for (const s of [-1, 1]) {
          const xc = s * (D.colX[0] + D.colX[1]) / 2, wB = D.colX[1] - D.colX[0] + r * 3.2;
          B.box('radPale', xc, ye + 0.22, zc, wB, 0.44, r * 2.6, 0, { top: false, bottom: true });
          B.box('radPale', xc, ye + 0.53, zc + 0.05, wB + 0.3, 0.18, r * 2.6 + 0.3, 0, { bottom: true, top: true });
        }
      } else {
        B.poly('radPale', [[-hw, y0, 0.1], [hw, y0, 0.1], [hw, top, 0.1], [-hw, top, 0.1]], [0, 0, 1]);
        if (i === 0) B.unit('doorOak', open, 0.12, [0, 0]); else if (i !== 3) B.unit('mullion', open, 0.12, [0, 0]); else B.unit('radGroove', open, 0.12, [0, 0]);
        if (q === 1) for (const s of [-1, 1]) { const xc = s * (D.colX[0] + D.colX[1]) / 2; B.box('radPale', xc, (y0 + top - ent) / 2, zc, D.colX[1] - D.colX[0] + r * 2.2, top - ent - y0, r * 2.2, 0, { top: false }); }
        if (q === 1) B.box('radPale', 0, top - ent / 2, 0.35, W + 0.4, ent, 0.6, 0, { top: true });
      }
      // the James I group: the King enthroned, handing his works to a kneeling University; Fame with her trumpet (gilded)
      if (i === 3 && q < 2) {
        const zf = q === 0 ? -0.35 : 0.2;
        B.box('gold', 0, y0 + 0.9, zf, 0.9, 0.8, 0.5, 0, { top: true });
        B.lathe('gold', 0, zf + 0.05, [[0.3, y0 + 1.3], [0.32, y0 + 1.55], [0.22, y0 + 1.9], [0.15, y0 + 2.05], [0.06, y0 + 2.1], [0.11, y0 + 2.18], [0.11, y0 + 2.34], [0.14, y0 + 2.4], [0.06, y0 + 2.5], [0, y0 + 2.55]], { seg: q === 0 ? 8 : 5 });
        B.lathe('gold', -1.05, zf + 0.1, [[0.25, y0 + 0.5], [0.26, y0 + 0.85], [0.18, y0 + 1.35], [0.07, y0 + 1.45], [0.1, y0 + 1.55], [0, y0 + 1.7]], { seg: q === 0 ? 8 : 5 });
        B.lathe('gold', 1.08, zf + 0.1, [[0.24, y0 + 0.5], [0.2, y0 + 1.2], [0.15, y0 + 1.75], [0.06, y0 + 1.85], [0.1, y0 + 1.95], [0, y0 + 2.1]], { seg: q === 0 ? 8 : 5 });
        if (q === 0) { B.beam('gold', [1.15, y0 + 1.75, zf + 0.2], [1.55, y0 + 2.3, zf + 0.3], 0.06, 0.06); B.beam('gold', [-0.95, y0 + 1.3, zf + 0.25], [-0.45, y0 + 1.6, zf + 0.25], 0.12, 0.18); }
        B.box('white', 0, top - ent - 0.25, 0.13, 2.6, 0.32, 0.04);
      }
      y0 = top;
    });
    // the pierced cresting: open arcading, the University's arms panel, obelisks at the corners
    const yc = y0, yT = D.top;
    if (q === 0) {
      const holes = []; for (let k = -3; k <= 3; k++) if (Math.abs(k) > 0) holes.push(archPts(k * 1.1, 0.6, yc + 0.35, yc + 1.05, 6));
      B.face('radPale', rectPts(-hw, yc, hw, yT), holes, 0.3);
      B.face('radPale', rectPts(-hw, yc, hw, yT), holes, 0.1, true);
      for (const hl of holes) { B.push(trans(0, 0, 0.3)); B.reveal('radPale', hl, 0, -0.2); B.pop(); }
      B.box('radPale', 0, yT + 0.08, 0.2, W + 0.2, 0.16, 0.5, 0, { top: true, bottom: true });
      B.box('radNavy', 0, (yc + yT) / 2 + 0.1, 0.32, 1.3, 1.0, 0.04, 0, { top: false }); B.box('gold', 0, (yc + yT) / 2 + 0.1, 0.345, 0.5, 0.6, 0.02, 0, { top: false });
      for (const s of [-1, 1]) for (const xx of [hw - 0.3, 1.5]) { B.box('radPale', s * xx, yT + 0.4, 0.2, 0.42, 0.5, 0.42, 0, { top: true }); B.lathe('radPale', s * xx, 0.2, [[0.17, yT + 0.65], [0.0, yT + 2.1]], { seg: 4, a0: Math.PI / 4, a1: Math.PI / 4 + Math.PI * 2, facet: true }); B.lathe('radPale', s * xx, 0.2, [[0, yT + 2.05], [0.1, yT + 2.15], [0, yT + 2.3]], { seg: 5 }); }
    } else {
      B.poly('radPale', [[-hw, yc, 0.3], [hw, yc, 0.3], [hw, yT, 0.3], [-hw, yT, 0.3]], [0, 0, 1]);
      if (q === 1) for (const s of [-1, 1]) B.lathe('radPale', s * (hw - 0.3), 0.2, [[0.2, yT], [0.0, yT + 2.1]], { seg: 4, facet: true });
    }
    B.pop();
  }
  for (let q = 0; q < 3; q++) { if (ctx.front && ctx.front[q]) front(ctx.front[q], q); if (ctx.block && ctx.block[q]) block(ctx.block[q], q); }
  return { meshes: [], dims: { ...FIVE, face: ctx.face, back: ctx.back } };
}
