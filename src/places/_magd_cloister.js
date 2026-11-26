// Magdalen College — the Cloister (Great Quad; showpiece, fine-detail pass).
// William Orchard, 1474-80; the north, east and south walks rebuilt by Joseph Parkinson 1822-27. The mapped Cloister
// building (OSM r182657, a ring round the garth) is replaced entirely: an open walk on worn flags under a ribbed timber
// ceiling, lit from the garth through three-light Perpendicular openings between two-stage buttresses; over it one
// storey of two-light windows under a battlemented parapet, with an oriel over each walk's doorway. On 22 of the
// buttresses (three sides) sit the "hieroglyphics", the carved figures of 1508-09 (invented grotesques here: lions,
// griffins, a pelican, a dragon, horned beasts, robed men, wrestlers). Wisteria on the north range.
// docs/research/christ_church_botanic_magdalen.md §3.
//
//   build(ctx) -> { meshes: [near, far], lod, colliders: segs, passages, figures: [{x, z, h, kind}], garth: poly, ring: poly }
// One draw (the shared fine material of _se_fine.js): the near mesh inside CLOISTER.lodR, else the far one.
import * as THREE from 'three';
import { Batch, prism, lathe, tudorPts, rectPts, hh, distToPoly } from './_chch_kit.js';
import { buildFine, tracery, hoodMould, crenelFine, robedFigure, triCount, col, AIR_FAR } from './_se_fine.js';

export const CLOISTER = { id: 'r182657', walkH: 4.2, upperH: 11.6, wallH: 7.9, bay: 3.25, figures: 22, lodR: 95,
  passages: [[[898, 314], [911.6, 320.8]], [[938, 288], [943, 278]], [[944, 346], [951, 350.5]]] };   // St John's Quad (by Founder's Tower), north to the New Building, south-east to Chaplain's Quad
const wm = (x, y, z, ax, az) => new THREE.Matrix4().makeBasis(new THREE.Vector3(ax, 0, az), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-az, 0, ax)).setPosition(x, y, z);
const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const TH = 0.45;                                              // thickness of the arcade wall
const WALK = col('ashlar', 0.64, 0.53, 0.37);                 // the walk's walls, darker (under its roof): the arcade reads open from the garth

export function cloisterRing(map) {
  const b = map.buildings.find((q) => q.id === CLOISTER.id); if (!b || !b.holes || !b.holes.length) return null;
  return { outer: b.poly, garth: b.holes[0] };
}

/** one "hieroglyphic" on its buttress: wall frame, centred x = c, standing at y, 0.4 m out from the wall, facing +z */
function grotesque(B, kind, c, y, lite) {
  const K = 'stoneGrey', z = 0.52;
  if (lite) { B.box(K, c, y + 0.4, z, 0.36, 0.8, 0.42, 0, { top: false }); prism(B, K, c, z + 0.08, 0.17, y + 0.75, y + 1.05, 5); return; }
  const head = (hx, hy, hz, r, n = 6) => lathe(B, K, hx, hz, [[r * 0.5, hy - r], [r, hy - r * 0.3], [r * 0.95, hy + r * 0.4], [r * 0.4, hy + r]], n, 0);
  const sit = (r = 0.22) => lathe(B, K, c, z - 0.05, [[r * 1.1, y], [r * 1.2, y + 0.26], [r * 0.85, y + 0.55], [r * 0.6, y + 0.74]], 6, 0);
  const paws = () => { for (const s of [-1, 1]) { B.beam(K, [c + s * 0.11, y + 0.56, z + 0.1], [c + s * 0.12, y + 0.04, z + 0.2], 0.08, 0.09); B.box(K, c + s * 0.12, y + 0.04, z + 0.25, 0.1, 0.08, 0.16); } };
  switch (kind) {
    case 0:   // a lion sejant: mane, ears, a tail curled round
      sit(); paws(); prism(B, K, c, z + 0.04, 0.25, y + 0.6, y + 0.86, 8, { cap: true }); head(c, y + 0.95, z + 0.12, 0.17); B.box(K, c, y + 0.9, z + 0.29, 0.14, 0.11, 0.1);
      for (const s of [-1, 1]) B.box(K, c + s * 0.13, y + 1.13, z + 0.08, 0.07, 0.09, 0.05); B.beam(K, [c + 0.2, y + 0.1, z - 0.12], [c + 0.3, y + 0.5, z + 0.05], 0.05); break;
    case 1:   // a griffin: hooked beak, wings raised
      sit(0.2); paws(); head(c, y + 0.92, z + 0.1, 0.15); B.poly(K, [[c - 0.07, y + 0.95, z + 0.2], [c + 0.07, y + 0.95, z + 0.2], [c, y + 0.8, z + 0.42]], [0, 1, 1]); B.poly(K, [[c - 0.07, y + 0.95, z + 0.2], [c, y + 0.8, z + 0.42], [c, y + 0.86, z + 0.2]], [-1, -1, 0]); B.poly(K, [[c + 0.07, y + 0.95, z + 0.2], [c, y + 0.86, z + 0.2], [c, y + 0.8, z + 0.42]], [1, -1, 0]);
      for (const s of [-1, 1]) { const w = [[c + s * 0.14, y + 0.4, z - 0.1], [c + s * 0.5, y + 1.25, z - 0.2], [c + s * 0.2, y + 0.9, z - 0.16]]; B.poly(K, w, [0, 0, 1]); B.poly(K, w, [0, 0, -1]); B.box(K, c + s * 0.1, y + 1.1, z + 0.05, 0.05, 0.12, 0.04); } break;
    case 2:   // a robed doctor with his staff
      robedFigure(B, K, c, y, z, 1.15, { staff: true, n: 6 }); break;
    case 3: { // a horned beast crouching out over the edge like a gargoyle
      B.beam(K, [c, y + 0.3, z - 0.25], [c, y + 0.42, z + 0.3], 0.34, 0.36); head(c, y + 0.52, z + 0.45, 0.17); B.box(K, c, y + 0.44, z + 0.64, 0.16, 0.12, 0.14);
      for (const s of [-1, 1]) { B.beam(K, [c + s * 0.1, y + 0.66, z + 0.42], [c + s * 0.24, y + 0.98, z + 0.3], 0.05); B.beam(K, [c + s * 0.17, y + 0.3, z + 0.25], [c + s * 0.2, y + 0.02, z + 0.4], 0.08); } break; }
    case 4: { // a pelican in her piety: long neck bent to the breast, wings half spread
      lathe(B, K, c, z, [[0.1, y], [0.24, y + 0.25], [0.22, y + 0.5], [0.08, y + 0.72]], 6, 0); B.beam(K, [c, y + 0.66, z + 0.02], [c, y + 1.0, z + 0.12], 0.08); head(c, y + 1.02, z + 0.14, 0.1, 5); B.beam(K, [c, y + 1.0, z + 0.2], [c, y + 0.62, z + 0.3], 0.045);
      for (const s of [-1, 1]) { const w = [[c + s * 0.18, y + 0.2, z], [c + s * 0.46, y + 0.8, z - 0.14], [c + s * 0.16, y + 0.66, z - 0.02]]; B.poly(K, w, [0, 0, 1]); B.poly(K, w, [0, 0, -1]); } break; }
    case 5: { // a dragon: coiled neck, bat wings, a barbed tail
      sit(0.19); let pv = [c, y + 0.7, z]; for (const q of [[c + 0.1, y + 0.95, z + 0.12], [c - 0.02, y + 1.12, z + 0.26], [c, y + 0.98, z + 0.42]]) { B.beam(K, pv, q, 0.1); pv = q; } B.box(K, c, y + 0.95, z + 0.5, 0.13, 0.11, 0.24);
      for (const s of [-1, 1]) { const w = [[c + s * 0.12, y + 0.5, z - 0.1], [c + s * 0.6, y + 1.05, z - 0.12], [c + s * 0.42, y + 0.55, z - 0.16], [c + s * 0.2, y + 0.3, z - 0.12]]; B.poly(K, w, [0, 0, 1]); B.poly(K, w, [0, 0, -1]); } B.beam(K, [c - 0.18, y + 0.08, z - 0.1], [c - 0.34, y + 0.4, z + 0.12], 0.05); break; }
    default:  // two wrestlers locked together
      robedFigure(B, K, c - 0.16, y, z, 1.0, { ry: 0.5, n: 5 }); robedFigure(B, K, c + 0.16, y, z, 1.0, { ry: -0.5, n: 5 }); B.beam(K, [c - 0.12, y + 0.75, z + 0.12], [c + 0.12, y + 0.8, z + 0.12], 0.07);
  }
}

function make(R, lite) {
  const C = CLOISTER, B = new Batch(), segs = [], figures = [], WH = C.wallH;
  // ---- floor (worn flags), the boarded ceiling of the walk, the lead flat behind the parapets
  B.flat('flags', R.outer, 0.05, [R.garth]);
  B.flat('oak', R.outer, C.walkH, [R.garth], true);
  B.flat('lead', R.outer, WH - 0.05, [R.garth]);
  // ---- the outer wall of the ring (back wall of the walk below, one storey of windows above), the passages left open
  const ccwO = area(R.outer) > 0, ccwG = area(R.garth) > 0;
  const inPassage = (x, z) => C.passages.some(([a, b]) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 1.6; });
  for (let i = 0; i < R.outer.length; i++) {
    const a = R.outer[i], b = R.outer[(i + 1) % R.outer.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, out = ccwO ? [uz, -ux] : [-uz, ux];   // outward normal of the ring
    const n = Math.max(1, Math.ceil(L / 0.5)); let s0 = null, o0 = null;
    const wall = (p0, p1, y0, y1, keyOut, keyIn, yIn) => {
      B.poly(keyOut, [[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]], [out[0], 0, out[1]]);
      B.poly(keyIn, [[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], yIn, p1[1]], [p0[0], yIn, p0[1]]], [-out[0], 0, -out[1]]);
    };
    for (let k = 0; k <= n; k++) {
      const s = (k / n) * L, x = a[0] + ux * s, z = a[1] + uz * s, open = k < n && inPassage(x, z);
      if (!open && s0 === null && k < n) s0 = s;
      if (open && o0 === null) o0 = s;
      if ((open || k === n) && s0 !== null) { const p0 = [a[0] + ux * s0, a[1] + uz * s0], p1 = [x, z]; wall(p0, p1, 0, WH, 'stone', WALK, C.walkH); segs.push([p0[0], p0[1], p1[0], p1[1]]); s0 = null; }
      if ((!open || k === n) && o0 !== null) { const p0 = [a[0] + ux * o0, a[1] + uz * o0], p1 = [x, z]; wall(p0, p1, 3.3, WH, 'stone', 'stoneWarm', C.walkH); B.poly('stoneDark', [[p0[0], 3.3, p0[1]], [p1[0], 3.3, p1[1]], [p1[0] - out[0] * 0.5, 3.3, p1[1] - out[1] * 0.5], [p0[0] - out[0] * 0.5, 3.3, p0[1] - out[1] * 0.5]], [0, -1, 0]); o0 = null; }
    }
    // upper windows and battlements on the outside
    const M = wm(a[0], 0, a[1], out[1] * 1 > 0 || out[0] !== 0 ? (ccwO ? ux : -ux) : ux, ccwO ? uz : -uz), Mo = ccwO ? wm(a[0], 0, a[1], ux, uz) : wm(b[0], 0, b[1], -ux, -uz);
    void M;
    B.push(Mo);
    const nw = Math.floor(L / 3.4);
    for (let k = 0; k < nw; k++) { const c = (k + 0.5) * (L / nw); B.face(k % 3 === 1 ? 'winDim' : 'win', rectPts(c - 0.65, 5.2, c + 0.65, 6.8), [], 0.02); if (!lite) B.box('mould', c, 6.9, 0.06, 1.6, 0.12, 0.12, 0, { bottom: true, top: false }); }
    if (L > 1.2) { if (lite) B.box('stone', L / 2, WH + 0.45, 0, L, 0.9, 0.35, 0, { top: true }); else { crenelFine(B, 0, -0.18, L, -0.18, WH, { lite: true, mw: 1.1, gap: 0.75, h: 0.6, base: 0.45, t: 0.35 }); B.box('mould', L / 2, WH - 0.2, 0.05, L, 0.2, 0.14); } }
    B.pop();
  }
  // ---- the arcade towards the garth: bays, three-light openings, buttresses, figures on three sides; the storey over it
  let fig = 0;
  for (let i = 0; i < R.garth.length; i++) {
    const a = R.garth[i], b = R.garth[(i + 1) % R.garth.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, toGarth = ccwG ? [-uz, ux] : [uz, -ux];
    const nb = Math.max(1, Math.round(L / C.bay)), bw = L / nb, dc = L / 2;   // the doorway in the middle of each walk
    const along = toGarth[0] * -uz + toGarth[1] * ux > 0 ? [ux, uz, a] : [-ux, -uz, b];
    const F = wm(along[2][0], 0, along[2][1], along[0], along[1]);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ww = Math.min(6.5, Math.max(2.5, distToPoly(mid[0], mid[1], R.outer)));
    const holes = [], bays = [], openings = [[dc - 0.8, dc + 0.8]];
    for (let k = 0; k < nb; k++) { const c = (k + 0.5) * bw; if (Math.abs(c - dc) < 1.9) continue; bays.push(c); holes.push(tudorPts(c, bw - 1.1, 0.8, 2.85, 0.75, lite ? 3 : 6)); }
    const outline = [[0, 0]]; for (const [d0, d1] of openings) { outline.push([d0, 0], [d0, 2.7], [(d0 + d1) / 2, 3.3], [d1, 2.7], [d1, 0]); } outline.push([L, 0], [L, WH], [0, WH]);
    const outlineIn = outline.map(([x, y]) => [x, Math.min(y, C.walkH)]);
    B.push(F);
    if (lite) { B.face('stone', outline); for (let k = 0; k < holes.length; k++) { B.face('shadow', holes[k], [], 0.02); B.face('win', rectPts(bays[k] - 0.72, 5.2, bays[k] + 0.72, 6.8), [], 0.03); } B.box('stone', L / 2, WH + 0.45, -0.2, L, 0.9, 0.35); }
    else {
      B.face('stone', outline, holes); B.face(WALK, outlineIn, holes, -TH, true);
      for (let k = 0; k < holes.length; k++) {
        const h = holes[k], c = bays[k];
        B.reveal('stonePale', h, 0, -TH);
        tracery(B, h, { open: true, noReveal: true, lights: 3, headY: 2.85, d: TH, zb: -TH / 2 - 0.06, bar: 'mouldPale', bw: 0.1, cusp: 2 });
        B.box('mouldPale', c, 0.78, 0.06, bw - 0.95, 0.1, 0.2, 0, { bottom: true });
        // the storey over the walk: a two-light square-headed window under a label
        B.box('mouldPale', c, 6.0, 0.02, 1.8, 1.9, 0.04, 0, { top: false }); B.face(hh(i, k, 5) < 0.3 ? 'winLit' : 'win', rectPts(c - 0.72, 5.2, c + 0.72, 6.8), [], 0.05); B.box('mouldPale', c, 6.0, 0.07, 0.11, 1.6, 0.1, 0, { top: false });
        B.box('mould', c, 6.98, 0.07, 1.95, 0.12, 0.16, 0, { bottom: true });
      }
      { const pts = [[dc - 0.8, 0], [dc - 0.8, 2.7], [dc, 3.3], [dc + 0.8, 2.7], [dc + 0.8, 0]]; B.reveal('stonePale', pts, 0, -TH, true); hoodMould(B, pts, { w: 0.14, d: 0.1, fromY: 2.3 }); }
      for (const y of [4.45, WH - 0.3]) { B.box('mouldPale', L / 2, y, 0.06, L, 0.2, 0.14, 0, { bottom: true }); }
      crenelFine(B, 0, -0.18, L, -0.18, WH, { lite: true, mw: 1.1, gap: 0.75, h: 0.6, base: 0.45, t: 0.35 });
      // an oriel over the doorway: canted, corbelled out, three lights and its own little parapet
      { const ow = 1.15, od = 0.65, y0 = 4.9, y1 = 7.3, P = [[dc - ow - 0.55, 0], [dc - ow, od], [dc + ow, od], [dc + ow + 0.55, 0]];
        for (let k = 0; k < 3; k++) { const p = P[k], q = P[k + 1], nx = q[1] - p[1], nz = -(q[0] - p[0]); B.poly('stonePale', [[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]], [-nx, 0, -nz].map((v) => -v)); const e = 0.14; const li = (t) => [p[0] + (q[0] - p[0]) * t + (-nx) * 0 , p[1] + (q[1] - p[1]) * t]; const ln = Math.hypot(nx, nz), ox = (nx / ln) * 0.015, oz = (nz / ln) * 0.015; const l0 = li(e), l1 = li(1 - e); B.poly(i % 2 ? 'winLit' : 'winDim', [[l0[0] + ox, y0 + 0.5, l0[1] + oz], [l1[0] + ox, y0 + 0.5, l1[1] + oz], [l1[0] + ox, y1 - 0.45, l1[1] + oz], [l0[0] + ox, y1 - 0.45, l0[1] + oz]], [nx, 0, nz]); }
        B.box('mouldPale', dc, y0 + 1.4, od + 0.03, 0.09, y1 - y0 - 0.95, 0.06); for (const s of [-0.5, 0.5]) B.box('mouldPale', dc + s * 1.5, y0 + 1.4, od + 0.03, 0.07, y1 - y0 - 0.95, 0.06);
        B.box('mould', dc, y1 + 0.1, od / 2, 2 * ow + 1.3, 0.2, od + 0.2); B.box('mould', dc, y0 - 0.1, od / 2, 2 * ow + 1.2, 0.2, od + 0.1, 0, { bottom: true });
        lathe(B, 'mould', dc, 0, [[0.1, y0 - 1.3], [0.5, y0 - 0.8], [1.1, y0 - 0.3], [1.5, y0 - 0.2]], 8, Math.PI / 8);
        crenelFine(B, dc - ow, od, dc + ow, od, y1 + 0.2, { lite: true, mw: 0.42, gap: 0.3, h: 0.35, base: 0.2, t: 0.2 }); }
      // the timber ceiling: a moulded beam over every bay line, wall plates, a rib down the middle
      for (let k = 0; k <= nb; k++) B.box('oakDark', k * bw, C.walkH - 0.13, -TH - (ww - TH) / 2, 0.22, 0.26, ww - TH + 1.2, 0, { bottom: true, top: false });
      for (const zz of [-TH - 0.1, -TH - (ww - TH) / 2, -ww + 0.1]) B.box('oakDark', L / 2, C.walkH - 0.08, zz, L + 2 * ww, 0.16, 0.16, 0, { bottom: true, top: false });
    }
    B.pop();
    // colliders: the arcade wall with the doorway open
    const pw = (t) => { const w = new THREE.Vector3(t, 0, 0).applyMatrix4(F); return [w.x, w.z]; };
    let s = 0; for (const [d0, d1] of openings) { const q0 = pw(s), q1 = pw(d0); segs.push([q0[0], q0[1], q1[0], q1[1]]); s = d1; }
    { const q0 = pw(s), q1 = pw(L); segs.push([q0[0], q0[1], q1[0], q1[1]]); }
    // buttresses between the bays (two stages with weathered offsets), figures on three sides (not the chapel side; guess)
    const figSide = i !== 3;
    for (let k = 1; k < nb; k++) {
      if (Math.abs(k * bw - dc) < 1.2) continue;
      const c = k * bw, w = new THREE.Vector3(c, 0, 0.35).applyMatrix4(F);
      B.push(F);
      B.box('stone', c, 1.8, 0.38, 0.56, 3.6, 0.76, 0, { top: false });
      B.poly('mould', [[c - 0.28, 3.6, 0.76], [c + 0.28, 3.6, 0.76], [c + 0.28, 3.95, 0.3], [c - 0.28, 3.95, 0.3]], [0, 1, 1]);
      if (!lite) { B.box('stonePale', c, 5.4, 0.16, 0.44, 3.0, 0.32, 0, { top: false }); B.poly('mould', [[c - 0.22, 6.9, 0.32], [c + 0.22, 6.9, 0.32], [c + 0.22, 7.3, 0.0], [c - 0.22, 7.3, 0.0]], [0, 1, 1]); B.box('mould', c, 0.25, 0.42, 0.66, 0.5, 0.84, 0, { top: true }); }
      if (figSide && fig < C.figures) {
        const kind = Math.floor(hh(fig, 1509) * 7 + fig) % 7, y = 3.72;
        grotesque(B, kind, c, y, lite);
        figures.push({ x: w.x, z: w.z, h: Math.atan2(toGarth[0], toGarth[1]), kind }); fig++;
      }
      B.pop();
    }
    // wisteria on the north range: stems up the buttresses, leaves and hanging racemes over the arcade
    if (i === 1 && !lite) {
      B.push(F);
      for (let v = 0; v < 4; v++) { let pv = [2.2 + v * (L - 4) / 3, 0, 0.5]; for (let k = 1; k <= 6; k++) { const q = [pv[0] + (hh(v, k, 3) - 0.5) * 1.6, k * 1.15, 0.12 + hh(v, k, 4) * 0.2]; B.beam('bark', pv, q, 0.09 - k * 0.008); pv = q; } }
      for (let k = 0; k < 90; k++) {
        const c = 1 + (L - 2) * hh(k, 7), y = 4.4 + hh(k, 9) * 3.6, z = 0.14 + hh(k, 3) * 0.2;
        if (k % 3 !== 2) { const w = 0.3 + hh(k, 4) * 0.4, t = hh(k, 6) * 0.8 - 0.4; const q = [[c - w, y, z], [c + w, y + t * 0.3, z + 0.12], [c + w * 0.8, y + 0.42, z + 0.3], [c - w * 0.7, y + 0.5, z + 0.2]]; B.poly(k % 2 ? 'leaf' : 'leafDark', q, [0, 0.3, 1]); B.poly('leafDark', q, [0, -0.3, -1]); }
        else lathe(B, hh(k, 8) < 0.7 ? 'flowerPurple' : col('plain', 0.78, 0.62, 1.05), c, z + 0.16, [[0, y - 0.62], [0.07, y - 0.4], [0.1, y - 0.12], [0.03, y]], 4, hh(k, 2));
      }
      B.pop();
    }
  }
  return { B, segs, figures };
}

export function build(ctx) {
  const { world, parent, map } = ctx, C = CLOISTER;
  const R = cloisterRing(map); if (!R) return null;
  const N = make(R, false), Fm = make(R, true);
  const near = buildFine(N.B, world, parent, 'magd:cloister:near'), far = buildFine(Fm.B, world, parent, 'magd:cloister:far');
  near.visible = false;
  const g = R.garth, c = [g.reduce((s, p) => s + p[0], 0) / g.length, g.reduce((s, p) => s + p[1], 0) / g.length];
  return { meshes: [near, far], lod: { near, far, c, r: C.lodR, rFar: 900, airFar: AIR_FAR, minScale: 0.8 }, colliders: N.segs, passages: C.passages, figures: N.figures, garth: R.garth, ring: R.outer, tris: { near: triCount(near), far: triCount(far) } };
}
