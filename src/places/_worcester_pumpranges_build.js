// Worcester College, the ranges of Pump Quad: the geometry (see _worcester_pumpranges_plan.js for the plan, its sources
// and what is known or guessed). Everything is built in the college's LOCAL frame (x = u east, z = v south) at heights
// above the core's datum; places/worcester_pumpranges.js stands it rigid on the drawn ground.
import { frame, rectPts, tudorPts } from './_worcester_kit.js';
import { RG, LEVEL, front, back, eastU, RANGE_OPENINGS as RO, STAIR_DOORS } from './_worcester_pumpranges_plan.js';

const { yE, tan: TAN, ov: OV } = RG;
let bayN = 0;
const nextBay = (y0) => [1 + ((bayN += 7) % 251), y0 < 1.5 ? 0 : 1 + (bayN % 5)];

/** a sash of real bars (8-over-8: four panes wide) in the current wall frame at depth z: dark glass, white frame and bars */
function barSash(B, x0, x1, y0, y1, z, cols = 4, rows = 4) {
  const bay = nextBay(y0), g = (fx, fy) => [bay[0] + 0.44 + fx * 0.12, bay[1] + 0.8 + fy * 0.07];      // (inside ONE pane of the painted sash cell: plain glass that the shader lights by this window's own bay at night)
  B.poly('sash', [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], [g(0, 0), g(1, 0), g(1, 1), g(0, 1)]);
  const t = 0.05, zc = z + 0.005, w = x1 - x0, h = y1 - y0, o = { top: false };      // (every bar's back is BEHIND the glass: no face lies a hair in front of it)
  B.box('white', (x0 + x1) / 2, y0 + t / 2, zc, w, t, 0.05, 0, o); B.box('white', (x0 + x1) / 2, y1 - t / 2, zc, w, t, 0.05, 0, o);
  B.box('white', x0 + t / 2, (y0 + y1) / 2, zc, t, h - 2 * t, 0.05, 0, o); B.box('white', x1 - t / 2, (y0 + y1) / 2, zc, t, h - 2 * t, 0.05, 0, o);
  // (fronts AND backs of the frame, the rail, the uprights and the cross bars each in a plane of their own, 8 mm or more apart where they cross)
  B.box('white', (x0 + x1) / 2, (y0 + y1) / 2, zc + 0.006, w - 2 * t, 0.045, 0.046, 0, o);      // the meeting rail
  for (let k = 1; k < cols; k++) B.box('white', x0 + (w * k) / cols, (y0 + y1) / 2, zc - 0.008, 0.022, h - 2 * t, 0.044, 0, o);
  for (let k = 1; k < rows; k++) if (k * 2 !== rows) B.box('white', (x0 + x1) / 2, y0 + (h * k) / rows, zc - 0.007, w - 2 * t, 0.022, 0.026, 0, o);
}

/**
 * A wall face from local a to b ([u, v]; walked with the OUTSIDE ON THE RIGHT HAND: the north face westwards, the east
 * face northwards) between y0 and `top` (a height, or a profile [[s, y]...] from s = L back to 0), with openings.
 * op: { u | v | s: centre along the wall, w, y0, y1, kind, d, fr } — only those wholly inside y0 .. top are cut.
 * kinds: sash (painted six-over-six) | bars (real 8-over-8) | pane (bare glass) | case (leaded two-light casement) | door | arch
 * (four-centred, `spring`, `rise`) | grille | blind | plate (a number plate: no opening). fr: 'ash' = a flush ashlar surround.
 */
export function mkWall(B, a, b, y0, top, ops = [], key = 'rubble') {
  const du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv), yTop = typeof top === 'number' ? top : Math.max(...top.map((p) => p[1]));
  const O = [];
  for (const q of ops) {
    const s = q.s !== undefined ? q.s : q.u !== undefined ? ((q.u - a[0]) * L) / du : ((q.v - a[1]) * L) / dv;
    if (!(s - q.w / 2 > 0.05 && s + q.w / 2 < L - 0.05 && q.y0 >= y0 - 1e-6 && q.y1 <= yTop + 1e-6)) continue;
    const g = q.kind === 'pane' ? 0.012 : 0;      // (a walk-in room's window: the stone opening a centimetre larger all round than the room's own frame, which would otherwise lie against the reveal)
    const pts = q.kind === 'arch' ? tudorPts(s, q.w, q.y0, q.spring, q.rise, 8) : rectPts(s - q.w / 2 - g, q.y0 - g, s + q.w / 2 + g, q.y1 + g);
    O.push({ ...q, s, pts, d: q.d ?? (q.kind === 'door' ? 0.2 : q.kind === 'blind' ? 0.07 : 0.14) });
  }
  B.push(frame(a[0], 0, a[1], du, dv));
  const out = [[0, y0], [L, y0]]; if (typeof top === 'number') out.push([L, top], [0, top]); else for (const p of top) out.push(p);
  B.face(key, out, O.filter((q) => q.kind !== 'plate').map((q) => q.pts));
  for (const q of O) {
    const x0 = q.s - q.w / 2, x1 = q.s + q.w / 2, d = q.d, k = q.kind, ash = q.fr === 'ash' || k === 'door' || k === 'arch' || k === 'grille' || k === 'case';
    if (k !== 'plate') B.reveal(ash ? 'stone' : key, q.pts, 0, -d, k === 'door' || k === 'arch');
    if (k === 'sash') B.unit(q.y1 - q.y0 < 1.3 ? 'sashAttic' : 'sash', q.pts, -d + 0.01, nextBay(q.y0));
    else if (k === 'bars') barSash(B, x0, x1, q.y0, q.y1, -d + 0.01, q.cols || 4, q.rows || 4);
    else if (k === 'pane') B.face('glassDark', q.pts, [], -d);      // (a walk-in room's window: its frame and bars are drawn by the room's own dressing, in front)
    else if (k === 'case') { B.unit('leaded', q.pts, -d + 0.01, nextBay(q.y0)); for (let i = 1; i < (q.lights || 2); i++) B.box('stone', x0 + (q.w * i) / (q.lights || 2), (q.y0 + q.y1) / 2, -d / 2, 0.09, q.y1 - q.y0, d, 0, { top: false }); }
    else if (k === 'door') B.unit(q.unit || 'doorDark', q.pts, -d + 0.01);
    else if (k === 'arch') { if (q.open) B.face('dark', q.pts, [], -d); else B.unit(q.unit || 'doorOak', q.pts, -d + 0.01); }
    else if (k === 'blind') B.face(key, q.pts, [], -d);
    else if (k === 'grille') { B.face('dark', q.pts, [], -d); for (let i = 0; i < 6; i++) B.box('iron', x0 + (q.w * (i + 0.5)) / 6, (q.y0 + q.y1) / 2, -0.06, 0.03, q.y1 - q.y0, 0.03, 0, { top: false }); for (const f of [0.3, 0.7]) B.box('iron', q.s, q.y0 + (q.y1 - q.y0) * f, -0.085, q.w, 0.035, 0.03, 0, { top: false }); }      // (the cross bars a clear centimetre behind the uprights' faces)
    // dressings: a sill under every window; flush ashlar jambs and a lintel where the pictures have them
    if (k === 'sash' || k === 'bars' || k === 'case' || k === 'pane') B.box('stoneDress', q.s, q.y0 - 0.07, 0.075, q.w + 0.2, 0.12, 0.13);      // (wholly in front of the wall, a centimetre under the reveal's own bottom)
    if (k === 'plate') { B.sign('signs', x0, q.y0, x1, q.y1, 0.03, q.uv); continue; }
    if (ash) {
      const j = q.jamb ?? 0.16, z = 0.02, yb = k === 'door' || k === 'arch' || k === 'grille' ? q.y0 : q.y0 - 0.12, yt = k === 'arch' ? q.spring + q.rise : q.y1, lh = q.lintel ?? 0.24;
      B.face('stone', rectPts(x0 - j, yb, x0, yt + lh), [], z); B.face('stone', rectPts(x1, yb, x1 + j, yt + lh), [], z);
      if (k === 'arch') { const sp = [[x0, yt + lh], [x0, q.spring], ...q.pts.slice(3, -1).reverse(), [x1, q.spring], [x1, yt + lh]]; B.face('stone', sp, [], z); }
      else B.face('stone', rectPts(x0, yt, x1, yt + lh), [], z);
    } else if (k === 'sash' || k === 'bars' || k === 'pane') B.face('stoneDress', rectPts(x0 - 0.12, q.y1, x1 + 0.12, q.y1 + 0.2), [], 0.02);      // a flat stone lintel
    if (q.label) { B.box('stone', q.s, q.y1 + 0.34, 0.08, q.w + 0.5, 0.1, 0.12); for (const x of [x0 - 0.2, x1 + 0.2]) B.box('stone', x, q.y1 + 0.12, 0.08, 0.1, 0.34, 0.12, 0, { top: false }); }      // (the stops end at the label's underside: nothing of the two in one plane)
    if (q.plate) B.sign('signs', q.s - 0.46, q.y1 + 0.34, q.s + 0.46, q.y1 + 0.72, 0.035, q.plate);
    if (q.num) B.sign('signs', q.s + (q.numSide || 1) * (q.w / 2 + 0.34) - 0.17, q.y0 + 1.5, q.s + (q.numSide || 1) * (q.w / 2 + 0.34) + 0.17, q.y0 + 1.84, 0.03, q.num);
    if (q.step) B.box('stoneDress', q.s, q.y0 - 0.05, 0.2, q.w + 0.3, 0.1, 0.38);
  }
  B.pop();
}
/** an ashlar chimney stack on plan rectangle u0..u1, v0..v1 from y0 to y1: a cap, pots, optionally a battlemented top */
function stack(B, u0, u1, v0, v1, y0, y1, o = {}) {
  B.boxXZ(o.key || 'stone', u0, u1, y0, y1, v0, v1, { top: false });
  B.boxXZ('stoneDress', u0 - 0.07, u1 + 0.07, y1, y1 + 0.14, v0 - 0.07, v1 + 0.07, { bottom: true });
  if (o.shoulder) B.boxXZ('stoneDress', u0 - 0.06, u1 + 0.06, y1 - o.shoulder - 0.1, y1 - o.shoulder, v0 - 0.06, v1 + 0.06, { bottom: true });
  const n = o.pots ?? 2, alongU = u1 - u0 >= v1 - v0;
  if (o.crenel) for (const [cu, cv] of [[u0 + 0.12, v0 + 0.12], [u1 - 0.12, v0 + 0.12], [u0 + 0.12, v1 - 0.12], [u1 - 0.12, v1 - 0.12]]) B.box('stoneDress', cu, y1 + 0.26, cv, 0.24, 0.24, 0.24);
  for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; B.cyl('terracotta', alongU ? u0 + (u1 - u0) * f : (u0 + u1) / 2, y1 + 0.14, alongU ? (v0 + v1) / 2 : v0 + (v1 - v0) * f, 0.11, 0.42, 6, true, 0.13); }
}
const P3 = (p, y) => [p[0], y, p[1]];
let gutterN = 0;
/** a roof slope: planar points [u, y, v]; t = the eaves' direction [du, dv]: the tiles' courses run along it on every piece */
function slope(B, key, pts, t) {
  const [a, b, c] = pts, e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const nl = Math.hypot(...n) * (n[1] < 0 ? -1 : 1); n = n.map((x) => x / nl);
  const tl = Math.hypot(t[0], t[1]), T = [t[0] / tl, 0, t[1] / tl]; let s = [n[1] * T[2] - n[2] * T[1], n[2] * T[0] - n[0] * T[2], n[0] * T[1] - n[1] * T[0]]; if (s[1] < 0) s = s.map((x) => -x);
  B.poly(key, pts, n, pts.map((p) => { const d = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; return [d[0] * T[0] + d[2] * T[2], d[0] * s[0] + d[1] * s[1] + d[2] * s[2]]; }));
}
/** a gutter and a boarded soffit along an eaves: wall line a -> b (outside on the right hand), the roof's edge OV out and `drop` below yw */
function eaves(B, a, b, yw, drop) {
  const du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv), n = [-dv / L, du / L], e = (p, k) => [p[0] + n[0] * k, p[1] + n[1] * k];
  // (the soffit hangs a hand below the roof's own plane — in that plane it lay back to back with the tiles — behind a fascia board)
  B.poly('oak', [P3(a, yw - 0.1), P3(b, yw - 0.1), P3(e(b, OV), yw - drop - 0.1), P3(e(a, OV), yw - drop - 0.1)], [0, -1, 0]);
  B.poly('oak', [P3(e(a, OV), yw - drop - 0.1), P3(e(b, OV), yw - drop - 0.1), P3(e(b, OV), yw - drop), P3(e(a, OV), yw - drop)], [n[0], 0, n[1]]);
  const gy = yw - drop - 0.02 - (gutterN++ % 3) * 0.011;      // (runs that meet at a corner hang a centimetre apart: their tops and bottoms are never in one plane)
  B.beam('lead', P3(e(a, OV + 0.03), gy), P3(e(b, OV + 0.03), gy), 0.12, 0.1);
}
/** a downpipe with its hopper on the current wall line a -> b at local (u, v): from yb up to yt */
function pipe(B, u, v, n, yb, yt) { B.boxXZ('lead', u + n[0] * 0.05 - 0.045, u + n[0] * 0.05 + 0.045, yb, yt, v + n[1] * 0.05 - 0.045, v + n[1] * 0.05 + 0.045, { top: false }); B.boxXZ('lead', u + n[0] * 0.09 - 0.1, u + n[0] * 0.09 + 0.1, yt, yt + 0.2, v + n[1] * 0.09 - 0.1, v + n[1] * 0.09 + 0.1); }

export function buildRanges(B, K) {
  bayN = 0; gutterN = 0;      // (the same build every time it is run)
  const { atlas, lantern } = K, C = RG.cant, UE = RG.ue, UW = RG.uW, E = RG.east, W1 = RG.w1, W2 = RG.w2, PQ = LEVEL.court;
  const fU = (u) => [u, front(u)], bU = (u) => [u, back(u)], BAND = 5.0, num = (n) => atlas.uv('num' + n);
  const [g0, g1] = RG.g, [a0, a1] = RG.f1, [t0, t1] = RG.f2, lamps = [];
  const cA = fU(C.u0), cB = [UE, C.v1], SE = E[2];

  // ================================================================= SOUTH RANGE, court (north) face
  {
    const D = RO.door, Wn = RO.win, ops = [
      // ground floor, from the angle westwards (K: corner photograph, 1939 plan)
      { u: 19.2, w: 0.36, y0: PQ + 0.7, y1: PQ + 1.6, kind: 'blind', fr: 'ash', jamb: 0.1, lintel: 0.12 },
      { u: 19.57, w: 0.34, y0: PQ + 1.85, y1: PQ + 2.19, kind: 'plate', uv: num(15) },                                             // Staircase 15's plate, beside the angle doorway
      { u: Wn.u, w: Wn.w, y0: PQ + Wn.y0, y1: PQ + Wn.y1, kind: 'pane', d: Wn.recess }, { u: RO.win2.u, w: RO.win2.w, y0: PQ + RO.win2.y0, y1: PQ + RO.win2.y1, kind: 'pane', d: RO.win2.recess },                                        // the pigeonhole room's two windows
      { u: D.u, w: D.w, y0: PQ + D.y0, y1: PQ + D.y1, kind: 'door', d: D.recess, step: true, jamb: 0.14, lintel: 0.2, plate: atlas.uv('pidgeSign') },                                 // ... and its door
      { u: STAIR_DOORS[14].uv[0], w: 1.0, y0: PQ + 0.08, y1: PQ + 2.15, kind: 'door', num: num(14), step: true },
      { u: 9.3, w: 1.25, y0: g0, y1: g1, kind: 'bars' }, { u: 7.1, w: 0.95, y0: g0, y1: g1, kind: 'sash' }, { u: 5.5, w: 0.95, y0: g0, y1: g1, kind: 'sash' },
      { u: STAIR_DOORS[13].uv[0], w: 1.4, y0: PQ + 0.05, spring: PQ + 1.75, rise: 0.5, y1: PQ + 2.25, kind: 'arch', d: 0.35, num: num(13), numSide: -1 },
      // first floor: tall sashes (K by the angle; G west of u 12)
      { u: 17.7, w: 0.9, y0: a0, y1: a1, kind: 'sash' }, { u: 15.2, w: 1.25, y0: a0, y1: a1, kind: 'bars', rows: 6 }, { u: 12.5, w: 1.25, y0: a0, y1: a1, kind: 'bars', rows: 6 },
      { u: 9.3, w: 1.25, y0: a0, y1: a1, kind: 'bars', rows: 6 }, { u: 7.1, w: 1.0, y0: a0, y1: a1, kind: 'sash' }, { u: 5.5, w: 1.0, y0: a0, y1: a1, kind: 'sash' }, { u: 3.5, w: 1.0, y0: a0, y1: a1, kind: 'sash' },
      // second floor
      { u: 19.35, w: 0.6, y0: t0, y1: t1, kind: 'sash' }, { u: 17.7, w: 0.9, y0: t0, y1: t1, kind: 'sash' }, { u: 15.2, w: 1.2, y0: t0, y1: t1, kind: 'bars', fr: 'ash' }, { u: 12.5, w: 0.9, y0: t0, y1: t1, kind: 'sash' },
      { u: 9.3, w: 1.2, y0: t0, y1: t1, kind: 'bars' }, { u: 7.1, w: 0.9, y0: t0, y1: t1, kind: 'sash' }, { u: 5.5, w: 0.9, y0: t0, y1: t1, kind: 'sash' }, { u: 3.5, w: 0.9, y0: t0, y1: t1, kind: 'sash' },
    ];
    mkWall(B, cA, fU(UW), PQ - 0.4, BAND, ops, 'rubbleN');
    mkWall(B, fU(UE), cA, C.top, BAND, [], 'rubbleN');                       // over the canted angle
    mkWall(B, fU(UE), fU(UW), BAND, yE, ops, 'prUpperN');
    // a lantern beside the pigeonhole room's door (G: a door in use after dark)
    lamps.push(lantern(B, D.u - 0.95, PQ + 1.95, front(D.u - 0.95), 0, -1, 0.4));
    for (const u of [16.45, 6.3]) pipe(B, u, front(u), [0, -1], PQ + 0.1, yE - 0.5);
    // the return at the Cottages' gable (their south face stops half a metre short of this range: closed here)
    mkWall(B, [2.75, front(2.75) + 0.02], [2.75, 29.3], PQ - 0.7, yE, [], 'rubbleN');
  }
  // ================================================================= THE CANTED ANGLE: doorway, hood, cusped light
  {
    const L = Math.hypot(cA[0] - cB[0], cA[1] - cB[1]), m = L / 2, yd = PQ + 0.05;
    mkWall(B, cB, cA, PQ - 0.4, C.top, [
      { s: m, w: 0.95, y0: yd, spring: yd + 1.42, rise: 0.4, y1: yd + 1.82, kind: 'arch', d: 0.5, open: true, jamb: 0.2, lintel: 0.16 },
      { s: m, w: 0.4, y0: PQ + 3.37, spring: PQ + 4.05, rise: 0.22, y1: PQ + 4.27, kind: 'arch', d: 0.16, unit: 'leaded', jamb: 0.13, lintel: 0.14 },
    ], 'rubble');
    B.push(frame(cB[0], 0, cB[1], cA[0] - cB[0], cA[1] - cB[1]));
    // the stone-slated hood on two stone brackets (2.4 - 3.0 m above the court)
    const h0 = PQ + 2.42, h1 = PQ + 3.0, hx0 = 0.1, hx1 = L - 0.1, hz = 0.62;
    B.poly('stoneSlate', [[hx0, h0, hz], [hx1, h0, hz], [hx1, h1, 0.02], [hx0, h1, 0.02]], [0, 1, 1]);
    B.poly('oak', [[hx0, h0 - 0.05, hz], [hx1, h0 - 0.05, hz], [hx1, h0 - 0.05, 0.02], [hx0, h0 - 0.05, 0.02]], [0, -1, 0]);
    B.poly('stone', [[hx0, h0 - 0.05, hz], [hx1, h0 - 0.05, hz], [hx1, h0, hz], [hx0, h0, hz]], [0, 0, 1]);
    for (const [x, n] of [[hx0, -1], [hx1, 1]]) { B.poly('stone', [[x, h0 - 0.05, 0.02], [x, h0 - 0.05, hz], [x, h0, hz], [x, h1, 0.02]], [n, 0, 0]); B.box('stone', x - n * 0.09, h0 - 0.3, 0.2, 0.14, 0.5, 0.36, 0, { bottom: true }); }
    B.box('stone', m, PQ + 4.5, 0.05, 0.75, 0.09, 0.1);                       // the label over the cusped light
    B.box('lampGlass', m, PQ + 2.08, 0.05, 0.16, 0.16, 0.08);                 // the round lamp over the arch
    B.pop();
    lamps.push([(cA[0] + cB[0]) / 2 - 0.12, PQ + 2.08, (cA[1] + cB[1]) / 2 - 0.16]);
    // the cant dies back into the square corner under a weathered stone top
    const k = fU(UE);
    B.poly('stoneSlate', [P3(cB, C.top), P3(cA, C.top), [k[0], C.top + 0.5, k[1]]], [-0.5, 1, -0.5]);
  }
  // ================================================================= EAST RANGE, court (west) face
  {
    const ops = [
      { v: 20.9, w: 0.95, y0: g0, y1: g1, kind: 'sash' }, { v: 23.0, w: 0.95, y0: g0, y1: g1, kind: 'sash' },
      { v: STAIR_DOORS[16].uv[1], w: 1.0, y0: PQ + 0.08, y1: PQ + 2.15, kind: 'door', num: num(16), step: true },
      { v: 26.9, w: 1.25, y0: g0, y1: g1, kind: 'bars' }, { v: 29.3, w: 1.25, y0: g0, y1: g1, kind: 'bars' },
      { v: 20.9, w: 1.05, y0: a0, y1: a1, kind: 'sash' }, { v: 23.0, w: 1.05, y0: a0, y1: a1, kind: 'sash' }, { v: 25.05, w: 1.05, y0: a0, y1: a1, kind: 'sash' }, { v: 26.9, w: 1.05, y0: a0, y1: a1, kind: 'sash' }, { v: 29.3, w: 1.05, y0: a0, y1: a1, kind: 'sash' },
      { v: 20.9, w: 0.9, y0: t0, y1: t1, kind: 'sash' }, { v: 23.0, w: 0.9, y0: t0, y1: t1, kind: 'sash' }, { v: 25.05, w: 0.9, y0: t0, y1: t1, kind: 'sash' },
      { v: 27.7, w: 1.2, y0: t0, y1: t1, kind: 'bars', fr: 'ash' }, { v: 30.7, w: 0.75, y0: t0, y1: t1, kind: 'sash' },
    ];
    mkWall(B, [UE, RG.vN], cB, PQ - 0.4, BAND, ops, 'rubble');
    mkWall(B, cB, fU(UE), C.top, BAND, [], 'rubble');
    mkWall(B, [UE, RG.vN], fU(UE), BAND, yE, ops, 'prUpper');
    pipe(B, UE, 24.05, [-1, 0], PQ + 0.1, yE - 0.5);
  }
  // ================================================================= EAST RANGE, Worcester Street
  {
    const [s1a, s1b] = RG.sf1, [s2a, s2b] = RG.sf2, ops = [
      { v: 35.5, w: 0.85, y0: s2a, y1: s2b, kind: 'sash', fr: 'ash', jamb: 0.12, lintel: 0.14 }, { v: 33.45, w: 0.85, y0: s2a, y1: s2b, kind: 'sash', fr: 'ash', jamb: 0.12, lintel: 0.14 },
      { v: 29.6, w: 0.85, y0: s2a, y1: s2b, kind: 'sash', fr: 'ash', jamb: 0.12, lintel: 0.14 }, { v: 26.9, w: 0.85, y0: s2a, y1: s2b, kind: 'sash', fr: 'ash', jamb: 0.12, lintel: 0.14 },
      { v: 22.3, w: 0.85, y0: s2a, y1: s2b, kind: 'sash', fr: 'ash', jamb: 0.12, lintel: 0.14 },
      { v: 38.9, w: 0.9, y0: 1.5, y1: 3.3, kind: 'sash' }, { v: 34.5, w: 0.85, y0: 2.3, y1: 3.7, kind: 'case' }, { v: 29.75, w: 0.8, y0: 1.9, y1: s1b - 0.1, kind: 'sash' },
      { v: 26.9, w: 0.85, y0: s1a, y1: s1b, kind: 'sash' }, { v: 22.3, w: 0.9, y0: s1a, y1: s1b, kind: 'sash', fr: 'ash', jamb: 0.12, lintel: 0.14, label: true },
      { v: 35.1, w: 0.95, y0: 0.06, y1: 1.3, kind: 'grille', d: 0.3, jamb: 0.2, lintel: 0.3 },                      // the low grilled doorway (the floor inside is 1.25 m below the pavement)
      { v: 25.3, w: 0.9, y0: 0.06, y1: 1.95, kind: 'door', unit: 'doorGrey', jamb: 0.18 },
    ];
    for (const [a, b] of [[E[2], E[1]], [E[1], E[0]]]) { mkWall(B, a, b, -0.4, BAND, ops, 'prStreet'); mkWall(B, a, b, BAND, yE, ops, 'prStreetUp'); }
    mkWall(B, E[0], [28.0, RG.vN], -0.4, yE, [], 'prStreet');             // the return where the range stands proud of the Hall wing
    for (const v of [31.3, 37.8]) pipe(B, eastU(v), v, [1, 0], 0.25, yE - 0.5);
  }
  // ================================================================= garden / kitchen-yard face, the west end
  {
    const GY = LEVEL.yard, ops = [
      { u: 18.7, w: 0.9, y0: GY + 0.75, y1: GY + 2.45, kind: 'sash' }, { u: 20.4, w: 0.95, y0: GY + 0.05, y1: GY + 2.1, kind: 'door', unit: 'doorGrey' }, { u: 23.3, w: 0.9, y0: GY + 0.75, y1: GY + 2.45, kind: 'sash' }, { u: 25.6, w: 0.9, y0: GY + 0.75, y1: GY + 2.45, kind: 'sash' },
      { u: 15.0, w: 0.9, y0: a0, y1: a1 - 0.5, kind: 'sash' }, { u: 18.7, w: 0.9, y0: a0, y1: a1 - 0.5, kind: 'sash' }, { u: 20.4, w: 0.9, y0: a0, y1: a1 - 0.5, kind: 'sash' }, { u: 23.3, w: 0.9, y0: a0, y1: a1 - 0.5, kind: 'sash' }, { u: 25.6, w: 0.9, y0: a0, y1: a1 - 0.5, kind: 'sash' },
      { u: 15.0, w: 0.9, y0: t0, y1: t1, kind: 'sash' }, { u: 18.7, w: 0.9, y0: t0, y1: t1, kind: 'sash' }, { u: 20.4, w: 0.9, y0: t0, y1: t1, kind: 'sash' },
      { u: 23.3, w: 0.95, y0: t0, y1: t1, kind: 'sash', fr: 'ash' }, { u: 25.6, w: 0.95, y0: t0, y1: t1, kind: 'sash', fr: 'ash' },      // (K: the two seen over the street wall)
    ];
    mkWall(B, bU(UW), SE, LEVEL.garden - 0.5, BAND, ops, 'rubble'); mkWall(B, bU(UW), SE, BAND, yE, ops, 'prUpper');
    // the chimney breast on the yard face (K: 1939 plan, LIDAR) and its stack (G: height)
    { const u0 = 16.0, u1 = 17.3, v0 = back(16.65) - 0.05, v1 = v0 + 0.75; B.boxXZ('rubble', u0, u1, GY - 0.4, yE - 0.3, v0, v1, { top: false }); B.poly('stoneSlate', [[u0, yE - 0.3, v1], [u1, yE - 0.3, v1], [u1, yE + 0.35, v0], [u0, yE + 0.35, v0]], [0, 1, 1]); stack(B, u0 + 0.2, u1 - 0.2, v0 - 0.45, v0 + 0.25, yE - 0.2, 9.5); }
    // west end (G, temporary: the Old Kitchen runs on west at this height): a rubble gable
    const a = fU(UW), b = bU(UW), L = b[1] - a[1];
    mkWall(B, a, b, LEVEL.garden - 0.5, [[L, yE], [L / 2, yE + TAN * (L / 2)], [0, yE]], [], 'rubble');
  }
  // ================================================================= ROOFS of the two ranges: clay tiles, a valley in the court's angle, a hip at the street corner
  {
    const yd = yE - TAN * OV, nE = (u) => front(u) - OV, sE = (u) => back(u) + OV, rV = (u) => (nE(u) + sE(u)) / 2, rY = (u) => yd + TAN * (sE(u) - nE(u)) / 2;
    const wE = UE - OV, eE = (v) => eastU(v) + OV, rU = (v) => (wE + eE(v)) / 2, reY = (v) => yd + TAN * (eE(v) - wE) / 2;
    let xu = 24.9; for (let i = 0; i < 6; i++) xu = rU(rV(xu));               // where the two ridges meet
    const X = [xu, rY(xu), rV(xu)], I = [wE, yd, nE(wE)], O = (() => { let u = SE[0] + OV; for (let i = 0; i < 4; i++) u = eE(sE(u)); return [u, yd, sE(u)]; })();
    const u0 = UW - 0.12, W0n = [u0, yd, nE(u0)], W0s = [u0, yd, sE(u0)], W0r = [u0, rY(u0), rV(u0)];
    const tS = [1, RG.ov * 0 + (front(1) - front(0))], tE = [0, 1];
    slope(B, 'prTile', [W0n, I, X, W0r], tS); slope(B, 'prTile', [O, W0s, W0r, X], [1, back(1) - back(0)]);
    const v0 = RG.vN + 0.02, vb = E[1][1], Rn = [rU(v0), reY(v0), v0], Rb = [rU(vb), reY(vb), vb], Wn = [wE, yd, v0], Wb = [wE, yd, vb], En = [eE(v0), yd, v0], Eb = [eE(vb), yd, vb];
    slope(B, 'prTile', [Wb, Wn, Rn, Rb], tE); slope(B, 'prTile', [I, Wb, X], tE); slope(B, 'prTile', [Wb, Rb, X], tE);
    slope(B, 'prTile', [En, Eb, Rb, Rn], [E[1][0] - E[0][0], E[1][1] - E[0][1]]); slope(B, 'prTile', [Eb, O, X], [E[2][0] - E[1][0], E[2][1] - E[1][1]]); slope(B, 'prTile', [Eb, X, Rb], [E[2][0] - E[1][0], E[2][1] - E[1][1]]);
    // ridge and hip tiles
    for (const [p, q] of [[W0r, X], [Rn, Rb], [Rb, X], [X, O]]) B.beam('prRidge', [p[0], p[1] + 0.03, p[2]], [q[0], q[1] + 0.03, q[2]], 0.2, 0.12);
    // eaves: gutters and boarded soffits
    // (the two court eaves stop at the valley's foot: run on to the walls' corner they crossed each other there)
    eaves(B, fU(UE - OV - 0.1), fU(UW), yE, TAN * OV); eaves(B, bU(UW), SE, yE, TAN * OV); eaves(B, [UE, RG.vN], [UE, front(UE) - OV - 0.1], yE, TAN * OV);
    eaves(B, E[2], E[1], yE, TAN * OV); eaves(B, E[1], E[0], yE, TAN * OV);
    // the verge at the west gable
    B.poly('oak', [W0n, W0r, [UW, W0r[1] - 0.03, W0r[2]], [UW, yE - 0.03, front(UW)]], [-0.3, -1, 0]); B.poly('oak', [W0r, W0s, [UW, yE - 0.03, back(UW)], [UW, W0r[1] - 0.03, W0r[2]]], [-0.3, -1, 0]);
    // stacks (K: LIDAR, the photographs): on the ridge at the Old Kitchen's east wall; on the garden eaves; the tall
    // battlemented one near the street wall's south end
    stack(B, 2.0, 2.8, rV(2.4) - 0.45, rV(2.4) + 0.45, rY(2.4) - 0.5, 10.55, { shoulder: 0.5 });
    for (const [u, top] of [[-1.0, 10.5], [5.5, 10.3]]) stack(B, u - 0.45, u + 0.45, back(u) - 0.72, back(u) - 0.02, yE - 0.1, top, { shoulder: 0.6 });
    stack(B, 25.85, 26.65, 36.05, 37.0, yE + 0.2, 10.6, { crenel: true, pots: 0, shoulder: 0.9 });
  }
  // ================================================================= WEST WING (two storeys and dormers under stone slates)
  {
    const GG = LEVEL.garden, sl = (W1.ridgeY - W1.yE) / (W1.ridgeU - W1.u0), vS = W1.v1, vN = back(W1.u0) - 2.2;
    mkWall(B, bU(W1.u0), [W1.u0, vS], GG - 0.5, W1.yE, [
      { v: 38.3, w: 1.0, y0: 1.75, y1: 2.95, kind: 'case', jamb: 0.13, lintel: 0.16 }, { v: 41.0, w: 1.0, y0: 1.75, y1: 2.95, kind: 'case', jamb: 0.13, lintel: 0.16 }, { v: 43.7, w: 1.0, y0: 1.75, y1: 2.95, kind: 'case', jamb: 0.13, lintel: 0.16 },
      { v: 38.3, w: 1.0, y0: GG + 0.85, y1: GG + 2.05, kind: 'case', jamb: 0.13, lintel: 0.16 }, { v: 41.0, w: 0.95, y0: GG + 0.05, y1: GG + 2.05, kind: 'door', unit: 'doorOak', jamb: 0.14 }, { v: 43.7, w: 1.0, y0: GG + 0.85, y1: GG + 2.05, kind: 'case', jamb: 0.13, lintel: 0.16 },
    ], 'rubble');
    const Lg = W1.u1 - W1.u0, e2 = W1.ridgeY - (W1.u1 - W1.ridgeU) * 0.42;
    mkWall(B, [W1.u0, vS], [W1.u1, vS], GG - 0.5, [[Lg, e2], [W1.ridgeU - W1.u0, W1.ridgeY], [0, W1.yE]], [], 'rubble');
    for (const y of [GG + 0.3, GG + 1.2, GG + 2.1, GG + 3.0, GG + 3.9]) B.box('stone', W1.u0 + 0.13, y, vS - 0.19, 0.3, 0.42, 0.42, 0, { top: false });      // long-and-short quoins at the corner (K: PXL photograph)
    // roof: the steep west slope, the short east slope down to the valley against the east wing
    const ue = W1.u0 - OV, ye = W1.yE - sl * OV, vv = vS + 0.2;
    B.poly('stoneSlate', [[ue, ye, vv], [ue, ye, vN], [W1.ridgeU, W1.ridgeY, vN], [W1.ridgeU, W1.ridgeY, vv]], [-1, 1, 0]);
    B.poly('stoneSlate', [[W1.u1 + 0.08, e2 - 0.03, vN], [W1.u1 + 0.08, e2 - 0.03, vv], [W1.ridgeU, W1.ridgeY, vv], [W1.ridgeU, W1.ridgeY, vN]], [1, 1, 0]);
    B.beam('stoneDress', [W1.ridgeU, W1.ridgeY + 0.03, vN], [W1.ridgeU, W1.ridgeY + 0.03, vv], 0.2, 0.12);
    B.poly('oak', [[ue, ye, vv], [W1.ridgeU, W1.ridgeY, vv], [W1.ridgeU, W1.ridgeY - 0.04, vS], [W1.u0, W1.yE - 0.04, vS]], [0, -1, 0.3]);
    eaves(B, bU(W1.u0), [W1.u0, vS], W1.yE, sl * OV);
    // three gabled dormers with white Gothick lights (K: the Mathis photograph)
    for (const v of [38.3, 41.0, 43.7]) {
      const uf = W1.u0 + 0.85, yb = W1.yE + sl * 0.85, yc = yb + 1.15, yr = yc + 0.62, hw = 0.68, uc = W1.u0 + (yc - W1.yE) / sl, ur = W1.u0 + (yr - W1.yE) / sl;
      B.poly('plaster', [[uf, yb, v + hw], [uf, yb, v - hw], [uf, yc, v - hw], [uf, yr, v], [uf, yc, v + hw]], [-1, 0, 0]);
      for (const sg of [-1, 1]) {
        B.poly('plaster', [[uf, yb, v + sg * hw], [uf, yc, v + sg * hw], [uc, yc, v + sg * hw]], [0, 0, sg]);
        B.poly('stoneSlate', [[uf - 0.15, yc - 0.1, v + sg * (hw + 0.13)], [uc + 0.1, yc - 0.1, v + sg * (hw + 0.13)], [ur, yr, v], [uf - 0.15, yr, v]], [0, 1, sg]);
      }
      B.push(frame(uf - 0.012, 0, v - 0.5, 0, 1)); B.unit('leaded', rectPts(0, yb + 0.22, 1.0, yc - 0.02), 0, nextBay(yb)); for (const x of [0, 1 / 3, 2 / 3, 1]) B.box('white', x, (yb + yc) / 2 + 0.085, 0.012, 0.05, yc - yb - 0.29, 0.03, 0, { top: false }); B.box('white', 0.5, yb + 0.2, 0.022, 1.05, 0.05, 0.03); B.box('white', 0.5, yc - 0.03, 0.022, 1.05, 0.05, 0.03); B.pop();      // (head and sill a centimetre proud of the uprights, which stop short of them)
    }
    // the bracket lantern on its south-west corner (K: three photographs)
    lamps.push(lantern(B, W1.u0, GG + 2.75, vS - 0.3, -1, 0, 0.45));
  }
  // ================================================================= EAST WING (three storeys under clay tiles) and its narrower south end
  {
    const GY = LEVEL.yard, S = W2.s, e = 7.0, vN = back(W2.ridgeU) - 3.7, sl2 = (W2.ridgeY - e) / (W2.u1 - W2.ridgeU), yw = W2.ridgeY - (W2.ridgeU - W2.u0) * sl2;
    const top = (v) => ({ v, w: 0.85, y0: 5.3, y1: 6.65, kind: 'sash', fr: 'ash', jamb: 0.12, lintel: 0.14 });
    mkWall(B, [W2.u1, W2.v1], bU(W2.u1), GY - 0.5, e, [39.6, 41.2, 42.8, 44.4, 46.0, 47.4].map(top).concat(
      [39.6, 42.8, 46.0].map((v) => ({ v, w: 0.9, y0: 2.1, y1: 3.9, kind: 'sash' })), [39.6, 46.0].map((v) => ({ v, w: 0.9, y0: GY + 0.8, y1: GY + 2.4, kind: 'sash' })), [{ v: 42.8, w: 0.95, y0: GY + 0.05, y1: GY + 2.1, kind: 'door', unit: 'doorGrey' }]), 'rubble');
    const Lg = W2.u1 - W2.u0;
    mkWall(B, [W2.u0, W2.v1], [W2.u1, W2.v1], LEVEL.garden - 0.5, [[Lg, e], [W2.ridgeU - W2.u0, W2.ridgeY], [0, yw]], [], 'rubble');      // its south gable (the south end stands against it)
    mkWall(B, [W2.u0, W1.v1], [W2.u0, W2.v1], LEVEL.garden - 0.5, yw, [{ v: 47.0, w: 0.85, y0: 5.3, y1: 6.65, kind: 'sash' }, { v: 47.0, w: 0.9, y0: 2.1, y1: 3.9, kind: 'sash' }], 'rubble');
    const yd = e - sl2 * OV, vv = W2.v1 + 0.2;
    B.poly('prTile', [[W2.u1 + OV, yd, vN], [W2.u1 + OV, yd, vv], [W2.ridgeU, W2.ridgeY, vv], [W2.ridgeU, W2.ridgeY, vN]], [1, 1, 0]);
    B.poly('prTile', [[W2.u0 - OV, yw - sl2 * OV, vv], [W2.u0 - OV, yw - sl2 * OV, vN], [W2.ridgeU, W2.ridgeY, vN], [W2.ridgeU, W2.ridgeY, vv]], [-1, 1, 0]);
    B.beam('prRidge', [W2.ridgeU, W2.ridgeY + 0.03, vN], [W2.ridgeU, W2.ridgeY + 0.03, vv], 0.2, 0.12);
    eaves(B, [W2.u1, W2.v1], bU(W2.u1), e, sl2 * OV); eaves(B, [W2.u0, W1.v1 + 0.3], [W2.u0, W2.v1], yw, sl2 * OV);
    // the south end
    const rc = (S.u0 + S.u1) / 2, Ls = S.u1 - S.u0, sl3 = (S.ridgeY - e) / (Ls / 2), vs = S.v1 + 0.2;
    mkWall(B, [S.u1, S.v1], [S.u1, W2.v1], GY - 0.5, e, [{ v: 50.5, w: 0.85, y0: 4.9, y1: 6.2, kind: 'sash' }, { v: 50.5, w: 0.9, y0: 2.1, y1: 3.7, kind: 'sash' }], 'rubble');
    mkWall(B, [S.u0, W2.v1], [S.u0, S.v1], LEVEL.garden - 0.5, e, [{ v: 50.5, w: 0.85, y0: 4.9, y1: 6.2, kind: 'sash' }], 'rubble');
    mkWall(B, [S.u0, S.v1], [S.u1, S.v1], LEVEL.garden - 0.5, [[Ls, e], [Ls / 2, S.ridgeY], [0, e]], [{ s: Ls / 2, w: 0.9, y0: 4.9, y1: 6.2, kind: 'sash' }, { s: Ls / 2, w: 0.9, y0: 2.1, y1: 3.7, kind: 'sash' }], 'rubble');
    B.poly('prTile', [[S.u1 + OV, e - sl3 * OV, W2.v1], [S.u1 + OV, e - sl3 * OV, vs], [rc, S.ridgeY, vs], [rc, S.ridgeY, W2.v1]], [1, 1, 0]);
    B.poly('prTile', [[S.u0 - OV, e - sl3 * OV, vs], [S.u0 - OV, e - sl3 * OV, W2.v1], [rc, S.ridgeY, W2.v1], [rc, S.ridgeY, vs]], [-1, 1, 0]);
    B.beam('prRidge', [rc, S.ridgeY + 0.03, W2.v1], [rc, S.ridgeY + 0.03, vs], 0.2, 0.12);
    eaves(B, [S.u1, S.v1], [S.u1, W2.v1], e, sl3 * OV); eaves(B, [S.u0, W2.v1], [S.u0, S.v1], e, sl3 * OV);
    // its great stack at the junction with the range (K: LIDAR 72.4 mOD; the 2026 street view)
    stack(B, 10.95, 12.05, back(11.5) - 0.2, back(11.5) + 0.75, yE, 11.45, { pots: 3, shoulder: 0.8 });
  }
  return { lamps };
}
