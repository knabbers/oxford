// The Martyrs' Memorial (G. G. Scott, 1841-43) at the south end of St Giles', and the cross in the road in Broad Street.
// Owned by places/martyrs_memorial.js; see docs/research/landmarks_batch4.md (what is known, what is guessed).
//
// G (guessed, from photographs remembered, not measured): a hexagonal plan (it follows the Waltham Eleanor Cross, which is
// hexagonal) with one face to the north; four hexagonal steps; a panelled pedestal with the inscription on its north
// face; the statue stage with three figures under gabled canopies at 120 degrees (Cranmer to the north, Ridley to the
// east-south-east, Latimer to the west-south-west, as near to "faces east / west" as a hexagon allows); an open
// traceried lantern; a crocketed hexagonal spire with a cross; ~22.4 m overall.
import { RB, Batch, TAU, prismN, signCard, frame } from './_b4_kit.js';

export const MM = {
  c: [69.3, -10.2], a0: Math.PI / 6,              // the mapped node n16252895; hexagon with a face to the north
  steps: [[5.0, 0.0, 0.24], [4.6, 0.24, 0.48], [4.2, 0.48, 0.72], [3.8, 0.72, 0.96]],   // [circumradius, y0, y1]
  ped: { r: 2.95, y0: 0.96, y1: 4.9 }, stage2: { r: 1.7, y0: 5.3, y1: 10.4 }, stage3: { r: 1.25, y0: 10.9, y1: 14.6 },
  spire: { r: 1.1, y0: 15.4, y1: 21.2 }, top: 22.4,
  statues: [{ name: 'Cranmer', t: Math.PI, prop: 'book' }, { name: 'Ridley', t: Math.PI / 3, prop: 'hands' }, { name: 'Latimer', t: -Math.PI / 3, prop: 'arms' }],
};
// the cross in Broad Street (G: position in the carriageway outside Balliol's Master's Lodgings; arms of dark setts)
export const CROSS = { x: 146, z: 81.2, a: Math.atan2(31, -7), arm: 0.75, w: 0.32 };

const faceDir = (t) => [Math.sin(t), Math.cos(t)];
/** the hexagon's face-centre angles (t: 0 = +z / south, PI = north) */
export const FACES = [0, 1, 2, 3, 4, 5].map((i) => MM.a0 + (i + 0.5) * (TAU / 6));

/** a robed figure, ~1.95 m, facing angle t (lathe body + head + an attribute) */
function statue(B, x, y, z, t, prop, q) {
  const seg = q ? 6 : 10, key = 'statue';
  const prof = [[0.36, 0], [0.37, 0.12], [0.33, 0.6], [0.3, 1.05], [0.27, 1.32], [0.24, 1.45], [0.11, 1.53], [0.08, 1.56]];
  B.push(frame(x, y, z, Math.cos(t), -Math.sin(t)));
  B.lathe(key, 0, 0, prof, { seg });
  B.lathe('statueDk', 0, 0.03, [[0, 1.55], [0.1, 1.57], [0.12, 1.7], [0.1, 1.84], [0.06, 1.9], [0, 1.92]], { seg });   // head (and cap)
  if (!q) {
    // robe folds: three shallow ribs down the front, the shoulders' cape
    for (const s of [-0.13, 0, 0.13]) B.box('statueDk', s, 0.65, 0.31 - Math.abs(s) * 0.25, 0.05, 1.1, 0.06, 0, { top: false });
    B.lathe(key, 0, 0, [[0.31, 1.18], [0.36, 1.25], [0.3, 1.42], [0.2, 1.5]], { seg });
    if (prop === 'book') { B.box('statueDk', 0, 1.12, 0.36, 0.28, 0.36, 0.08, 0); B.box(key, 0, 1.0, 0.3, 0.42, 0.1, 0.12, 0); }
    if (prop === 'arms') B.box(key, 0, 1.18, 0.3, 0.5, 0.13, 0.14, 0);
    if (prop === 'hands') { B.box(key, 0, 1.05, 0.33, 0.14, 0.24, 0.1, 0); }
  }
  B.pop();
}
/** a gabled canopy (G) over a statue: two shafts, a pointed arch, a steep gable with crockets and a finial */
function canopy(B, x, z, t, y0, w, q) {
  const ux = Math.cos(t), uz = -Math.sin(t);           // along the face
  B.push(frame(x, 0, z, ux, uz));                       // local +z = outward
  const yS = y0 + 2.6, yG = y0 + 3.9;
  for (const s of [-1, 1]) { B.cyl('mag', s * (w / 2), y0, 0.18, 0.09, yS - y0, q ? 5 : 8, false); B.box('magDk', s * (w / 2), yS + 0.08, 0.18, 0.26, 0.16, 0.26, 0); }
  // the arch ring (pointed), as a swept band
  const N = q ? 5 : 9, ring = [];
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI, sx = -Math.cos(a) * (w / 2), sy = yS + Math.sin(a) * (w * 0.62) * (1 - 0.18 * Math.abs(Math.cos(a))); ring.push([sx, sy, 0.24]); }
  B.sweep('mag', ring, [[0, 0], [0, 0.04], [0.16, 0.04], [0.16, 0]], [0, 0, 1]);
  // gable (two sloped faces) and its crockets
  const gw = w / 2 + 0.22;
  B.poly('mag', [[-gw, yS + 0.2, 0.26], [gw, yS + 0.2, 0.26], [0, yG + 0.9, 0.26]], [0, 0, 1]);
  B.poly('magDk', [[-gw, yS + 0.2, 0.26], [0, yG + 0.9, 0.26], [0, yG + 0.9, -0.1], [-gw, yS + 0.2, -0.1]], [-0.6, 0.8, 0]);
  B.poly('magDk', [[gw, yS + 0.2, 0.26], [gw, yS + 0.2, -0.1], [0, yG + 0.9, -0.1], [0, yG + 0.9, 0.26]], [0.6, 0.8, 0]);
  if (!q) for (let k = 1; k < 4; k++) for (const s of [-1, 1]) { const f = k / 4; B.box('mag', s * gw * (1 - f), yS + 0.2 + (yG + 0.7 - yS) * f + 0.08, 0.1, 0.14, 0.14, 0.2, 0); }
  B.cyl('mag', 0, yG + 0.9, 0.08, 0.02, 0.5, 4, false, 0.1);
  B.pop();
}
/** a crocketed pinnacle: square shaft, gablets, needle */
function pinnacle(B, x, y, z, s, h, q) {
  B.box('mag', x, y + h * 0.3, z, s, h * 0.6, s, 0, { top: false });
  B.cyl('mag', x, y + h * 0.6, z, 0.02, h * 0.4, 4, false, s * 0.72);
  if (!q) for (const f of [0.68, 0.8, 0.9]) B.box('magDk', x, y + h * f, z, s * (1.05 - f) * 1.4 + 0.06, 0.07, s * (1.05 - f) * 1.4 + 0.06, Math.PI / 4);
}

/** q 0 near, 1 mid, 2 far -> Batch */
export function buildMemorial(q) {
  const B = new RB(), [cx, cz] = MM.c, a0 = MM.a0;
  const seg = q === 2 ? 0 : 1;
  // steps (each a hex prism; the treads are their tops)
  for (const [r, y0, y1] of MM.steps) prismN(B, 'magDk', cx, cz, r, 6, y0, y1, a0, true);
  // pedestal: a moulded plinth, the panelled body, a carved cornice
  const P = MM.ped;
  prismN(B, 'mag', cx, cz, P.r + 0.18, 6, P.y0, P.y0 + 0.5, a0, true);
  prismN(B, 'mag', cx, cz, P.r, 6, P.y0 + 0.5, P.y1, a0, false);
  // blind tracery on every face (Perpendicular panel cell), the inscription panel on the north face
  FACES.forEach((t) => {
    const [nx, nz] = faceDir(t), ap = P.r * Math.cos(Math.PI / 6), mx = cx + nx * ap, mz = cz + nz * ap, ux = Math.cos(t), uz = -Math.sin(t);
    const w = P.r * 0.78;
    B.push(frame(mx, 0, mz, ux, uz));
    if (Math.cos(t) < -0.99) {  // north: the inscription under a cusped panel
      B.unit('perp', [[-w / 2, 2.8], [w / 2, 2.8], [w / 2, P.y1 - 0.35], [-w / 2, P.y1 - 0.35]], 0.03, [0, 0]);
      B.card('sign_memorialPanel', [-w / 2, 1.65, 0.05], [w / 2, 1.65, 0.05], [w / 2, 2.55, 0.05], [-w / 2, 2.55, 0.05], [0.004, 0.004, 0.996, 0.996]);
    } else B.unit('perp', [[-w / 2, 1.7], [w / 2, 1.7], [w / 2, P.y1 - 0.35], [-w / 2, P.y1 - 0.35]], 0.03, [0, 0]);
    if (q === 0) { B.box('magDk', 0, P.y1 - 0.25, 0.08, w + 0.2, 0.12, 0.12, 0); B.box('magDk', 0, 1.55, 0.08, w + 0.2, 0.1, 0.12, 0); }
    B.pop();
  });
  prismN(B, 'mag', cx, cz, P.r + 0.2, 6, P.y1, P.y1 + 0.18, a0, false);
  if (q === 0) for (let i = 0; i < 6; i++) { const t0 = a0 + (i / 6) * TAU, t1 = a0 + ((i + 1) / 6) * TAU, R = P.r + 0.21; B.poly('carve', [[cx + Math.sin(t0) * R, P.y1 + 0.18, cz + Math.cos(t0) * R], [cx + Math.sin(t1) * R, P.y1 + 0.18, cz + Math.cos(t1) * R], [cx + Math.sin(t1) * R, P.y1 + 0.42, cz + Math.cos(t1) * R], [cx + Math.sin(t0) * R, P.y1 + 0.42, cz + Math.cos(t0) * R]], [Math.sin((t0 + t1) / 2), 0, Math.cos((t0 + t1) / 2)], [[0, 0.01], [P.r, 0.01], [P.r, 0.99], [0, 0.99]]); }
  else prismN(B, 'mag', cx, cz, P.r + 0.2, 6, P.y1 + 0.18, P.y1 + 0.42, a0, false);
  prismN(B, 'mag', cx, cz, P.r + 0.05, 6, P.y1 + 0.42, MM.stage2.y0, a0, true, P.r - 0.25);   // the weathered top
  // corner buttress-pinnacles of the pedestal
  for (let i = 0; i < 6; i++) { const t = a0 + (i / 6) * TAU, R = P.r + 0.05; if (q < 2) pinnacle(B, cx + Math.sin(t) * R, P.y1 + 0.42, cz + Math.cos(t) * R, 0.34, 1.5, q); }
  // statue stage: the core, three statues under canopies, blind panels between
  const S2 = MM.stage2;
  prismN(B, 'magDk', cx, cz, S2.r, 6, S2.y0, S2.y1, a0, false);
  for (const st of MM.statues) {
    const [nx, nz] = faceDir(st.t), d = S2.r * Math.cos(Math.PI / 6) + 0.55;
    B.cyl('mag', cx + nx * d, S2.y0, cz + nz * d, 0.42, 0.28, q === 2 ? 6 : 10, true);         // pedestal
    statue(B, cx + nx * d, S2.y0 + 0.28, cz + nz * d, st.t, st.prop, q);
    if (q < 2) canopy(B, cx + nx * (d + 0.15), cz + nz * (d + 0.15), st.t, S2.y0 + 0.4, 1.25, q);
  }
  FACES.forEach((t) => {
    if (MM.statues.some((s) => Math.abs(Math.atan2(Math.sin(s.t - t), Math.cos(s.t - t))) < 0.2)) return;
    const [nx, nz] = faceDir(t), ap = S2.r * Math.cos(Math.PI / 6);
    B.push(frame(cx + nx * ap, 0, cz + nz * ap, Math.cos(t), -Math.sin(t)));
    B.unit('perp', [[-0.7, S2.y0 + 0.6], [0.7, S2.y0 + 0.6], [0.7, S2.y1 - 0.5], [-0.7, S2.y1 - 0.5]], 0.02, [0, 0]);
    B.pop();
  });
  // corner shafts of the statue stage rising to pinnacles
  for (let i = 0; i < 6; i++) { const t = a0 + (i / 6) * TAU, R = S2.r + 0.62, x = cx + Math.sin(t) * R, z = cz + Math.cos(t) * R; B.box('mag', x, (S2.y0 + S2.y1) / 2, z, 0.34, S2.y1 - S2.y0, 0.34, t, { top: false }); if (q < 2) pinnacle(B, x, S2.y1, z, 0.36, 2.0, q); else B.cyl('mag', x, S2.y1, z, 0.02, 1.6, 4, false, 0.24); }
  prismN(B, 'mag', cx, cz, S2.r + 0.95, 6, S2.y1, S2.y1 + 0.35, a0, true, S2.r + 0.7);
  prismN(B, 'magDk', cx, cz, S2.r + 0.4, 6, S2.y1 + 0.35, MM.stage3.y0, a0, true, MM.stage3.r + 0.1);
  // lantern stage: open tracery (dark behind), gablets, corner pinnacles
  const S3 = MM.stage3;
  prismN(B, 'magShade', cx, cz, S3.r - 0.15, 6, S3.y0, S3.y1, a0, false);
  FACES.forEach((t) => {
    const [nx, nz] = faceDir(t), ap = S3.r * Math.cos(Math.PI / 6);
    B.push(frame(cx + nx * ap, 0, cz + nz * ap, Math.cos(t), -Math.sin(t)));
    const w = S3.r * 0.85;
    B.unit('perp', [[-w / 2, S3.y0 + 0.3], [w / 2, S3.y0 + 0.3], [w / 2, S3.y1 - 0.2], [-w / 2, S3.y1 - 0.2]], 0.0, [0, 0]);
    B.poly('mag', [[-w / 2 - 0.18, S3.y1, 0.04], [w / 2 + 0.18, S3.y1, 0.04], [0, S3.y1 + 1.3, 0.04]], [0, 0, 1]);
    B.pop();
  });
  for (let i = 0; i < 6; i++) { const t = a0 + (i / 6) * TAU, R = S3.r + 0.1, x = cx + Math.sin(t) * R, z = cz + Math.cos(t) * R; B.box('mag', x, (S3.y0 + S3.y1) / 2, z, 0.26, S3.y1 - S3.y0, 0.26, t, { top: false }); if (q < 2) pinnacle(B, x, S3.y1, z, 0.28, 1.6, q); }
  prismN(B, 'mag', cx, cz, S3.r + 0.2, 6, S3.y1, S3.y1 + 0.25, a0, true);
  prismN(B, 'magDk', cx, cz, S3.r, 6, S3.y1 + 0.25, MM.spire.y0, a0, false, MM.spire.r);
  // the spire with crockets up its arrises, the finial and the cross
  const Sp = MM.spire;
  prismN(B, 'mag', cx, cz, Sp.r, 6, Sp.y0, Sp.y1, a0, false, 0.1);
  if (q === 0) for (let i = 0; i < 6; i++) { const t = a0 + (i / 6) * TAU; for (let k = 1; k <= 5; k++) { const f = k / 6.2, R = Sp.r + (0.1 - Sp.r) * f + 0.06; B.box('mag', cx + Math.sin(t) * R, Sp.y0 + (Sp.y1 - Sp.y0) * f, cz + Math.cos(t) * R, 0.16, 0.12, 0.16, t); } }
  B.lathe('mag', cx, cz, [[0.1, Sp.y1], [0.22, Sp.y1 + 0.2], [0.18, Sp.y1 + 0.42], [0.06, Sp.y1 + 0.55]], { seg: q ? 4 : 8 });
  B.box('mag', cx, Sp.y1 + 1.1, cz, 0.12, 1.2, 0.12, 0); B.box('mag', cx, Sp.y1 + 1.35, cz, 0.6, 0.12, 0.12, Math.PI / 2 - MM.a0 * 0);
  void seg;
  return B;
}

/** the cross in Broad Street: a flat cross of dark setts with a pale granite border (a ground decal, aLayer 8) */
export function buildCross() {
  const B = new Batch(), C = CROSS, ux = Math.sin(C.a), uz = Math.cos(C.a), vx = uz, vz = -ux, y = 0.052;
  const rect = (key, a0, a1, b0, b1) => { const P = (a, b) => [C.x + ux * a + vx * b, y, C.z + uz * a + vz * b]; B.poly(key, [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], [0, 1, 0]); };
  const L = C.arm, w = C.w / 2, e = 0.06;
  rect('concrete', -L - e, L + e, -w - e, w + e); rect('concrete', -w - e, w + e, -L * 0.75 - e, L * 1.05 + e);
  const y2 = y + 0.004;
  const rect2 = (key, a0, a1, b0, b1) => { const P = (a, b) => [C.x + ux * a + vx * b, y2, C.z + uz * a + vz * b]; B.poly(key, [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], [0, 1, 0]); };
  rect2('dark', -L, L, -w, w); rect2('dark', -w, w, -L * 0.75, L * 1.05);
  return B;
}
