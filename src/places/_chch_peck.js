// Christ Church — Peckwater Quad's inner fronts (fine-detail pass). The world still draws the mapped ranges (restyled
// in christ_church.js preMap: pale Clipsham ashlar, three storeys of sashes over a rusticated ground floor, flat roof);
// this adds what makes them Peckwater, on the faces towards the quad only:
//   * Aldrich's three ranges (1706-11): a five-bay centrepiece on each, slightly proud, giant Ionic half-columns standing
//     on the rusticated ground storey, an entablature and a pediment; a balustrade along the whole roofline.
//   * Clarke's Library (1717-72) on the south side: a giant unfluted Corinthian order of three-quarter columns the full
//     height, arched ground-floor windows (the loggia, glazed in), tall upper windows, entablature and balustrade, the
//     columns and dressings paler than the walls (the "white and buff" of the front).
// Bay counts and heights are guesses fitted to the mapped footprints (docs/research/christ_church_botanic_magdalen.md).
//   build(ctx) -> { meshes: [near, far], lod, tris }    one draw (shared fine material), near inside PECK.lodR
import * as THREE from 'three';
import { Batch, lathe, prism, buildFine, triCount, col } from './_se_fine.js';

export const PECK = {
  c: [347, 409], lodR: 72, rFar: 120,
  rangeH: 13.7, rustH: 4.2, bay: 2.9,
  // inner faces [a, b] (world xz); the frame's +z is turned towards the quad centre
  pavilions: [[[350.5, 384.8], [335.6, 386.8]], [[323.1, 387.9], [328.9, 431.1]], [[365.7, 381.7], [371.7, 425.4]]],
  ranges: [[[365.7, 381.7], [323.1, 387.9]], [[323.1, 387.9], [328.9, 431.1]], [[365.7, 381.7], [371.7, 425.4]]],
  library: [[372.7, 430.7], [326.5, 437.0]], libH: 15.5, libBays: 7,
};
const PALE = col('ashlar', 0.95, 0.85, 0.64), PALEP = col('plain', 1.0, 0.92, 0.75),   // Clipsham, matched to the world's restyled ranges
      WHITE = col('ashlar', 1.02, 0.95, 0.8), WHITEP = col('plain', 1.04, 0.98, 0.85),   // the Library's columns and dressings, paler than its buff walls
      BUFF = col('ashlar', 0.93, 0.8, 0.57), CHAN = col('plain', 0.42, 0.36, 0.27);

function faceFrame(a, b, c) {
  let [p, q] = [a, b]; const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  let ax = (q[0] - p[0]) / L, az = (q[1] - p[1]) / L;
  if ((-az) * (c[0] - p[0]) + ax * (c[1] - p[1]) < 0) { [p, q] = [q, p]; ax = -ax; az = -az; }
  return { L, M: new THREE.Matrix4().makeBasis(new THREE.Vector3(ax, 0, az), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-az, 0, ax)).setPosition(p[0], 0, p[1]) };
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** a sash window: dark glass a little back, an architrave frame; cap 'tri' | 'seg' | 'cornice' | null */
function sash(B, x, y0, w, h, z, lite, cap) {
  B.face('win', rect(x - w / 2, y0, x + w / 2, y0 + h), [], z - 0.12);
  if (lite) return;
  const o = rect(x - w / 2, y0, x + w / 2, y0 + h);
  B.reveal(PALEP, o, z, z - 0.12, true);
  B.face(PALEP, rect(x - w / 2 - 0.16, y0, x + w / 2 + 0.16, y0 + h + 0.16), [o], z + 0.04);                          // the architrave, flat
  B.box(PALEP, x, y0 - 0.06, z + 0.06, w + 0.4, 0.12, 0.14, 0, { bottom: true });                                      // sill
  const bar = (x0, y0b, x1, y1b) => B.poly('whitePaint', [[x0, y0b, z - 0.1], [x1, y0b, z - 0.1], [x1, y1b, z - 0.1], [x0, y1b, z - 0.1]], [0, 0, 1]);
  bar(x - w / 2, y0 + h * 0.52 - 0.03, x + w / 2, y0 + h * 0.52 + 0.03); bar(x - 0.02, y0, x + 0.02, y0 + h);           // meeting rail, glazing bar
  if (cap === 'cornice' || cap === 'tri') B.box(PALEP, x, y0 + h + 0.26, z + 0.1, w + 0.5, 0.14, 0.2, 0, { bottom: true });
  if (cap === 'tri') { const y = y0 + h + 0.33, hw = w / 2 + 0.3; B.poly(PALEP, [[x - hw, y, z + 0.12], [x + hw, y, z + 0.12], [x, y + 0.5, z + 0.12]], [0, 0, 1]); B.poly(PALEP, [[x - hw - 0.08, y, z + 0.06], [x - hw, y, z + 0.12], [x, y + 0.5, z + 0.12], [x, y + 0.6, z + 0.06]], [-0.5, 1, 0.3]); B.poly(PALEP, [[x, y + 0.6, z + 0.06], [x, y + 0.5, z + 0.12], [x + hw, y, z + 0.12], [x + hw + 0.08, y, z + 0.06]], [0.5, 1, 0.3]); }
  if (cap === 'seg') { const y = y0 + h + 0.33, hw = w / 2 + 0.3, pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([x - hw + 2 * hw * t, y + 0.32 * Math.sin(t * Math.PI)]); } B.face(PALEP, pts, [], z + 0.12); B.box(PALEP, x, y - 0.05, z + 0.1, 2 * hw, 0.1, 0.2, 0, { bottom: true }); }
}
/** a column against the wall (frame: wall plane z = 0, +z out): base, shaft, capital; order 'ionic' | 'corinthian' */
function column(B, x, z, y0, y1, r, order, lite, K = PALE, KP = PALEP) {
  if (lite) { prism(B, K, x, z, r, y0, y1, 6, { cap: false, rot: 0 }); return; }
  lathe(B, KP, x, z, [[r * 1.42, y0], [r * 1.42, y0 + 0.1], [r * 1.3, y0 + 0.16], [r * 1.18, y0 + 0.3], [r * 1.05, y0 + 0.38]], 8, 0);
  const top = y1 - (order === 'ionic' ? r * 0.8 : r * 2.4);
  lathe(B, KP, x, z, [[r, y0 + 0.38], [r, y0 + 0.38 + (top - y0) * 0.33], [r * 0.86, top]], 8, 0);
  if (order === 'ionic') {
    lathe(B, KP, x, z, [[r * 0.86, top], [r * 0.94, top + 0.06], [r * 1.12, top + r * 0.5]], 8, 0);
    B.box(KP, x, top + r * 0.6, z, r * 2.7, r * 0.22, r * 2.0);                                      // the volute band
    for (const s of [-1, 1]) B.beam(KP, [x + s * r * 1.2, top + r * 0.32, z - r], [x + s * r * 1.2, top + r * 0.32, z + r * 1.05], r * 0.62, r * 0.62);   // the scrolls, end on
    B.box(KP, x, y1 - r * 0.07, z, r * 2.5, r * 0.14, r * 2.5);
  } else {
    // Corinthian: a bell clothed in two rows of acanthus (blocky leaves), caulicoles, a hollow abacus
    lathe(B, KP, x, z, [[r * 0.86, top], [r * 0.9, top + r * 1.2], [r * 1.2, top + r * 2.1], [r * 1.3, top + r * 2.2]], 8, 0);
    for (let row = 0; row < 2; row++) for (let k = 0; k < 8; k++) {
      const a = (k + row * 0.5) / 8 * Math.PI * 2; if (Math.cos(a) < -0.5) continue;
      const y = top + 0.1 + row * r * 0.75, rr = r * (0.96 + row * 0.1), dx = Math.sin(a), dz = Math.cos(a);
      B.poly(KP, [[x + dx * rr - dz * r * 0.26, y, z + dz * rr + dx * r * 0.26], [x + dx * rr + dz * r * 0.26, y, z + dz * rr - dx * r * 0.26], [x + dx * (rr + r * 0.3), y + r * 0.9, z + dz * (rr + r * 0.3)]], [dx, 0.3, dz]);
    }
    for (const s of [-1, 1]) B.beam(KP, [x + s * r * 0.5, top + r * 1.5, z + r * 0.8], [x + s * r * 1.3, top + r * 2.15, z + r * 1.1], r * 0.28, r * 0.28);
    B.box(KP, x, y1 - r * 0.1, z, r * 2.9, r * 0.2, r * 2.9);
  }
}
function entablature(B, x0, x1, y, h, z, lite, KP = PALEP) {
  const L = x1 - x0, xm = (x0 + x1) / 2;
  B.box(KP, xm, y + h * 0.17, z + 0.12, L, h * 0.34, 0.24, 0, { bottom: true });            // architrave
  B.box(BUFF, xm, y + h * 0.5, z + 0.08, L, h * 0.32, 0.16, 0, { top: false });                 // frieze
  B.box(KP, xm, y + h * 0.78, z + 0.22, L + 0.4, h * 0.24, 0.44, 0, { bottom: true });       // cornice
  B.box(KP, xm, y + h * 0.95, z + 0.36, L + 0.6, h * 0.1, 0.72, 0, { bottom: true });
  if (!lite) for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.7) B.box(KP, x, y + h * 0.84, z + 0.5, 0.16, h * 0.08, 0.16, 0, { top: false, bottom: true });   // modillions
}
/** a balustrade on the roof edge: plinth, balusters (single front-facing vase cards, near only), rail; dies every `die` */
function balustrade(B, x0, x1, y, z, die, lite) {
  const L = x1 - x0, xm = (x0 + x1) / 2, H = 1.0;
  B.box(PALEP, xm, y + 0.09, z, L, 0.18, 0.5, 0, { top: true });
  B.box(PALEP, xm, y + H - 0.07, z, L, 0.14, 0.5, 0, { bottom: true });
  if (lite) { B.box(col('plain', 0.62, 0.55, 0.42), xm, y + H / 2, z - 0.05, L, H - 0.32, 0.12, 0, { top: false }); return; }
  const n = Math.max(1, Math.round(L / die));
  for (let i = 0; i <= n; i++) B.box(PALEP, x0 + (i / n) * L, y + H / 2, z, 0.4, H - 0.05, 0.52, 0, { top: false });
  const prof = [[0.06, 0.18], [0.11, 0.4], [0.04, 0.7], [0.06, 0.86]];
  for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.36) {
    if (Math.abs(((x - x0) / L) * n - Math.round(((x - x0) / L) * n)) * (L / n) < 0.32) continue;
    const pts = []; for (const [r, yy] of prof) pts.push([x + r, y + yy]); for (let k = prof.length - 1; k >= 0; k--) pts.push([x - prof[k][0], y + prof[k][1]]);
    B.face(PALEP, pts, [], z + 0.1);
  }
}

function make(lite) {
  const B = new Batch(), P = PECK, H = P.rangeH, RU = P.rustH;
  // ---- balustrades along the three ranges (inner edge), then the centrepieces
  for (const [a, b] of P.ranges) { const { L, M } = faceFrame(a, b, P.c); B.push(M); balustrade(B, 0, L, H, -0.2, 2.9, lite); B.pop(); }
  for (const [a, b] of P.pavilions) {
    const { L, M } = faceFrame(a, b, P.c), nb = 5, W = nb * P.bay, x0 = (L - W) / 2, x1 = x0 + W, z = 0.12;
    B.push(M);
    const wins = [];
    for (let k = 0; k < nb; k++) wins.push(x0 + (k + 0.5) * P.bay);
    // the slab of the centrepiece (covers the world's windows behind), rusticated below
    const holes = [];
    for (const x of wins) { holes.push(rect(x - 0.58, 1.0, x + 0.58, 2.9)); holes.push(rect(x - 0.6, 5.3, x + 0.6, 7.75)); holes.push(rect(x - 0.6, 9.0, x + 0.6, 10.7)); }
    B.face(PALE, rect(x0, 0, x1, H), holes, z);
    for (const s of [0, 1]) { const xe = s ? x1 : x0; B.poly(PALE, [[xe, 0, 0], [xe, 0, z], [xe, H, z], [xe, H, 0]], [s ? 1 : -1, 0, 0]); }
    if (!lite) for (let y = 0.5; y < RU - 0.1; y += 0.5) B.box(CHAN, (x0 + x1) / 2, y, z + 0.005, W, 0.05, 0.02, 0, { top: false });   // channelled rustication
    B.box(PALEP, (x0 + x1) / 2, RU + 0.15, z + 0.12, W + 0.3, 0.3, 0.26, 0, { bottom: true });
    wins.forEach((x, k) => { sash(B, x, 1.0, 1.16, 1.9, z, lite, null); sash(B, x, 5.3, 1.2, 2.45, z, lite, k % 2 ? 'seg' : 'tri'); sash(B, x, 9.0, 1.2, 1.7, z, lite, null); if (!lite) B.box(PALEP, x, 3.12, z + 0.1, 0.36, 0.44, 0.16); });
    for (let k = 0; k <= nb; k++) column(B, x0 + k * P.bay, z + 0.18, RU + 0.3, H - 1.3, 0.4, 'ionic', lite);
    entablature(B, x0 - 0.2, x1 + 0.2, H - 1.3, 1.3, z, lite);
    // the pediment, its back closed (seen over the roof from outside)
    const ph = 2.5, y = H; B.poly(PALE, [[x0 - 0.3, y, z + 0.05], [x1 + 0.3, y, z + 0.05], [(x0 + x1) / 2, y + ph, z + 0.05]], [0, 0, 1]);
    B.poly(PALE, [[x1 + 0.3, y, z - 0.6], [x0 - 0.3, y, z - 0.6], [(x0 + x1) / 2, y + ph, z - 0.6]], [0, 0, -1]);
    for (const s of [-1, 1]) { const ex = s < 0 ? x0 - 0.6 : x1 + 0.6, mx = (x0 + x1) / 2; B.beam(PALEP, [ex, y - 0.05, z + 0.25], [mx, y + ph + 0.2, z + 0.25], 0.5, 0.36); B.beam('lead', [ex, y + 0.12, z - 0.2], [mx, y + ph + 0.36, z - 0.2], 0.9, 0.08); }
    if (!lite) B.box(PALEP, (x0 + x1) / 2, y + 0.9, z + 0.12, 1.4, 0.9, 0.12);                   // a plain cartouche in the tympanum
    B.pop();
  }
  // ---- the Library
  {
    const [a, b] = P.library, { L, M } = faceFrame(a, b, P.c), H2 = P.libH, nb = P.libBays, e = 0.9, bw = (L - 2 * e) / nb, z = 0.1;
    B.push(M);
    const holes = [], arch = (x) => { const pts = [[x - 1.15, 0.9], [x + 1.15, 0.9]]; for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([x + 1.15 * Math.cos(t * Math.PI), 4.7 + 1.15 * Math.sin(t * Math.PI)]); } return pts; };
    const bays = []; for (let k = 0; k < nb; k++) bays.push(e + (k + 0.5) * bw);
    for (const x of bays) { holes.push(arch(x)); holes.push(rect(x - 1.0, 7.9, x + 1.0, 11.6)); }
    B.face(BUFF, rect(0, 0, L, H2), holes, z);
    for (const s of [0, 1]) { const xe = s ? L : 0; B.poly(BUFF, [[xe, 0, 0], [xe, 0, z], [xe, H2, z], [xe, H2, 0]], [s ? 1 : -1, 0, 0]); }
    bays.forEach((x, k) => {
      const ap = arch(x); B.face('win', ap, [], z - 0.25);
      if (!lite) { B.reveal(PALEP, ap, z, z - 0.25, true); for (let j = 0; j < 8; j++) { const p = ap[2 + j], q = ap[3 + j]; B.beam(PALEP, [p[0], p[1] + 0.02, z + 0.06], [q[0], q[1] + 0.02, z + 0.06], 0.3, 0.12); } B.box(PALEP, x, 5.95, z + 0.1, 0.42, 0.62, 0.22); B.box('whitePaint', x, 3.2, z - 0.22, 0.05, 4.4, 0.03); B.box('whitePaint', x, 4.7, z - 0.22, 2.2, 0.05, 0.03); }
      sash(B, x, 7.9, 2.0, 3.7, z, lite, k % 2 ? 'cornice' : 'tri');
    });
    if (!lite) { B.box(PALEP, L / 2, 6.9, z + 0.1, L, 0.28, 0.2, 0, { bottom: true }); B.box(PALEP, L / 2, 0.45, z + 0.12, L, 0.9, 0.24); }
    for (let k = 0; k <= nb; k++) column(B, e + k * bw, z + 0.5, 0.9, H2 - 1.85, 0.66, 'corinthian', lite, WHITE, WHITEP);
    entablature(B, 0, L, H2 - 1.85, 1.85, z + 0.3, lite, WHITEP);
    balustrade(B, 0, L, H2, z + 0.1, bw, lite);
    B.pop();
  }
  return B;
}

export function build(ctx) {
  const { world, parent } = ctx;
  const near = buildFine(make(false), world, parent, 'chch:peck:near'), far = buildFine(make(true), world, parent, 'chch:peck:far');
  near.visible = false; far.visible = false;
  // inside a closed quad: the near mesh only receives (one draw, no shadow pass); the low tier keeps the world's ranges
  near.castShadow = false; far.castShadow = false;
  // the Library's columns stand on the ground: one collider circle each
  const [a, b] = PECK.library, { L, M } = faceFrame(a, b, PECK.c), e = 0.9, bw = (L - 2 * e) / PECK.libBays, colliders = [];
  for (let k = 0; k <= PECK.libBays; k++) { const v = new THREE.Vector3(e + k * bw, 0, 0.6).applyMatrix4(M); colliders.push({ x: v.x, z: v.z, r: 0.95 }); }
  return { colliders, meshes: [near, far], lod: { near, far, c: PECK.c, r: PECK.lodR, rFar: PECK.rFar, minScale: 0.7, lowOff: true }, tris: { near: triCount(near), far: triCount(far) } };
}
