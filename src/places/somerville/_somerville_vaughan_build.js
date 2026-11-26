// Somerville College, STANDALONE model, part 'vaughan' (B09): the build functions. Called by somerville_vaughan.js with
// ctx.B already in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from
// _somerville_vaughan_plan.js (sources and K / G there). Everything here is square to the LOCAL frame, so no own frame
// is pushed except the kit's wall frames (and ctx.G.drape is only ever called with none pushed).
// Helpers written here (not in the kit): rr (a rounded-rectangle opening), reveal (the kit's reveal with a shallower
// side at a corner post), frameFace (one face of an Arup exoskeleton: posts, floor beams, rounded openings, rails, the
// open rim, the recessed window wall behind), arcadeSpan (a post-to-post span of the street arcade's segmental beam).
import * as P from './_somerville_vaughan_plan.js';

const { FRAME: FR, V, F, PAV, POD, ARC, PARAPET, TUNNEL, MOUTH, LOW } = P;
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const box2 = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

// ------------------------------------------------------------------------------------------------ cells
function addCells(K, pack) {
  K.addCell(pack, 'vBrick', 'redBrick', [0.29, 0.80, 1.20], { seed: 1.1 });   // the podium's and Fry's dark brown brick (touch-up 2: was red; the cell's red is multiplied in linear colour, so green and blue go up and red down)
  K.addCell(pack, 'vPavers', 'redBrick', [0.30, 0.75, 1.30], { seed: 2.2 });  // the terrace's dark blue-brown brick pavers (touch-up 1: were too red)
  K.addCell(pack, 'vCon', 'lead', 0xb4b0a6);                                 // the weathered grey precast of the frames, the arcade (photographs: greyer than the kit's 'precast')
  K.addCell(pack, 'vPanel', 'lead', 0xa99b83);                               // the buff panels beside the windows behind the frame
  K.addCell(pack, 'vFrame', 'lead', 0x3d4145);                               // dark grey glazing frames (the pavilion, the shop fronts)
}

// ------------------------------------------------------------------------------------------------ helpers
/** a rounded rectangle x0..x1, y0..y1 (corner radius r, seg steps a corner), counter-clockwise */
function rr(x0, y0, x1, y1, r, seg = 2) {
  r = Math.max(0.02, Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01));
  const C = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]], p = [];
  for (const [cx, cy, a0] of C) for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * (Math.PI / 2); p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return p;
}
/** the reveals of an opening outline in the current wall frame, from z 0 back to -d; o.left / o.right: the depth of the
 *  straight side at the outline's x0 / x1 (a corner post is only as deep as it is wide) */
function reveal(B, key, pts, d, o = {}) {
  let cx = 0, cy = 0, x0 = Infinity, x1 = -Infinity;
  for (const p of pts) { cx += p[0]; cy += p[1]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
  cx /= pts.length; cy /= pts.length;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-5) continue;
    let dd = d;
    if (Math.abs(a[0] - b[0]) < 1e-6) { if (o.left !== undefined && Math.abs(a[0] - x0) < 1e-6) dd = o.left; if (o.right !== undefined && Math.abs(a[0] - x1) < 1e-6) dd = o.right; }
    B.poly(key, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], -dd], [a[0], a[1], -dd]], [cx - (a[0] + b[0]) / 2, cy - (a[1] + b[1]) / 2, 0]);
  }
}
/** n equal bays along a face L long between corner posts (FR.EPW) and posts (FR.PW): [[s0, s1], ...] */
function bayLayout(L, n) { const w = (L - 2 * FR.EPW - (n - 1) * FR.PW) / n, out = []; let s = FR.EPW; for (let i = 0; i < n; i++) { out.push([s, s + w]); s += w + FR.PW; } return out; }
/** an end: wide - narrow - wide */
function endLayout(L) { const w = (L - 2 * FR.EPW - 2 * FR.PW - P.END_NARROW) / 2, a = FR.EPW, c = a + w + FR.PW, e = c + P.END_NARROW + FR.PW; return [[a, a + w], [c, c + P.END_NARROW], [e, e + w]]; }
/** the post centres between bays (LOCAL position along the face = face start + dir * s) */
const postsOf = (bays) => bays.slice(0, -1).map((b) => b[1] + FR.PW / 2);

/**
 * One face of an Arup frame, in wall frame M (s along the face, y up, +z out), L long. o.y0: the frame's bottom (the
 * fascia's underside); o.floors: the framed floors; o.roof, o.rim; o.bays [[s0, s1]]; o.blank: no tier openings (a solid
 * end wall, the rim still open). Draws: the face with rounded openings, their reveals (the frame's depth FR.D), the
 * rim's back face, a precast rail across every opening, the window wall FR.D behind the face (buff panels, timber-framed
 * windows), between s = FR.D and L - FR.D so that two faces' window walls meet at the inner corner.
 */
function frameFace(B, K, M, L, o) {
  const D = FR.D, tiers = o.blank ? [] : o.floors.map((f, i) => ({ f, yb: f + FR.BEAM_UP, yt: (i + 1 < o.floors.length ? o.floors[i + 1] : o.roof) - FR.BEAM_DN }));
  const rimB = o.roof + FR.RIM_BOT, rimT = o.rim - FR.RIM_TOPBAR, rimHoles = [];
  for (const [s0, s1] of o.bays) {
    if (s1 - s0 > FR.WIDE) { const m = (s0 + s1) / 2; rimHoles.push(rr(s0, rimB, m - FR.RIM_POST / 2, rimT, 0.15), rr(m + FR.RIM_POST / 2, rimB, s1, rimT, 0.15)); }
    else rimHoles.push(rr(s0, rimB, s1, rimT, 0.15));
  }
  const holes = [];
  for (const t of tiers) o.bays.forEach(([s0, s1], i) => holes.push({ pts: rr(s0, t.yb, s1, t.yt, FR.R), first: i === 0, last: i === o.bays.length - 1 }));
  B.push(M);
  B.face('vCon', rect(0, o.y0, L, o.rim), [...holes.map((h) => h.pts), ...rimHoles]);
  for (const h of holes) reveal(B, 'vCon', h.pts, D, { left: h.first ? FR.EPW : undefined, right: h.last ? FR.EPW : undefined });
  for (const p of rimHoles) reveal(B, 'vCon', p, FR.RD);
  B.face('vCon', rect(0, o.roof, L, o.rim), rimHoles, -FR.RD, true);
  if (o.blank) B.face('vCon', rect(0, o.y0, L, o.roof + 0.02), [], -0.35, true);
  for (const t of tiers) {
    const wins = [];
    o.bays.forEach(([s0, s1], i) => {
      const a = Math.max(s0, D), b = Math.min(s1, L - D); if (b - a < 0.8) return;
      if (s1 - s0 > FR.WIDE) {
        const x0 = i === 0 ? a + 0.1 : i === o.bays.length - 1 ? b - 0.1 - FR.WIN_WIDE : (a + b) / 2 - FR.WIN_WIDE / 2;
        wins.push([x0, x0 + FR.WIN_WIDE]);
      } else if (s1 - s0 > P.END_NARROW + 0.05) wins.push([a + 0.08, a + (b - a) * FR.WIN]);
    });
    const yb = t.yb + 0.04, yt = t.yt - 0.06;
    B.face('vPanel', rect(D, t.yb - 0.02, L - D, t.yt + 0.02), wins.map(([x0, x1]) => rect(x0, yb, x1, yt)), -D);
    for (const [x0, x1] of wins) {
      B.unit('glassDark', rect(x0, yb, x1, yt), -D - 0.05, K.nextBay(yb));
      B.box('timberOak', (x0 + x1) / 2, yb + (yt - yb) * 0.74, -D - 0.03, x1 - x0, 0.07, 0.08, 0, { bottom: true });
      B.box('timberOak', (x0 + x1) / 2, yb + 0.05, -D - 0.03, x1 - x0, 0.1, 0.1);
    }
    for (const [s0, s1] of o.bays) B.box('vCon', (s0 + s1) / 2, t.f + FR.RAIL, -0.14, s1 - s0, 0.12, 0.14, 0, { bottom: true });
  }
  B.pop();
}
/** the underside of the frame (between its outer faces and the recessed walls), its rim's top and the roof */
function frameCaps(B, outer, inner, y0, roof, rim) {
  const ins = (r, d) => [[r[0][0] + d, r[0][1] + d], [r[1][0] - d, r[1][1] + d], [r[2][0] - d, r[2][1] - d], [r[3][0] + d, r[3][1] - d]];
  B.flat('vCon', outer, y0, [inner], true);
  B.flat('vCon', outer, rim, [ins(outer, FR.RD)]);
  B.flat('leadDark', ins(outer, FR.RD - 0.01), roof);
}
/** an iron railing along a LOCAL polyline at deck level y: posts and two rails */
function railing(B, line, y, h = P.RAIL_H) {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.5));
    for (let k = 0; k <= n; k++) { if (k === 0 && i > 0) continue; const f = k / n; B.box('ironBlack', a[0] + (b[0] - a[0]) * f, y + h / 2, a[1] + (b[1] - a[1]) * f, 0.05, h, 0.05, 0, { top: false }); }
    B.beam('ironBlack', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.055);
    B.beam('ironBlack', [a[0], y + 0.12, a[1]], [b[0], y + 0.12, b[1]], 0.035);
    B.beam('ironBlack', [a[0], y + h * 0.55, a[1]], [b[0], y + h * 0.55, b[1]], 0.03);
  }
}

// ------------------------------------------------------------------------------------------------ Vaughan
function buildVaughan(ctx, K, B) {
  const { S } = ctx, Lx = V.u1 - V.u0, Lz = V.v1 - V.v0, wi = P.V_WALL_IN, li = P.V_LG_IN;
  const common = { y0: P.V_FASCIA[0], roof: P.V_ROOF, rim: P.V_RIM, floors: P.V_FLOORS };
  const long = bayLayout(Lx, P.V_BAYS), end = endLayout(Lz);
  frameFace(B, K, K.frame(V.u0, 0, V.v1, 1, 0), Lx, { ...common, bays: long });       // south (the terrace)
  frameFace(B, K, K.frame(V.u1, 0, V.v0, -1, 0), Lx, { ...common, bays: long });      // north (the Fellows' Garden, the Chapel)
  frameFace(B, K, K.frame(V.u1, 0, V.v1, 0, -1), Lz, { ...common, bays: end });       // east (the walkway)
  frameFace(B, K, K.frame(V.u0, 0, V.v0, 0, 1), Lz, { ...common, bays: end });        // west (the Catherine Hughes yard)
  const outer = box2(V.u0, V.v0, V.u1, V.v1), inner = box2(V.u0 + wi, V.v0 + wi, V.u1 - wi, V.v1 - wi);
  frameCaps(B, outer, inner, P.V_FASCIA[0], P.V_ROOF, P.V_RIM);

  // the recessed first floor (+2.87 .. the fascia): brick, glazed on the north and to the walkway (G: its windows)
  const y1 = P.V_FASCIA[0] + 0.02, f1 = P.V_F1 - 0.05;
  const winRow = (len, pitch, w, yb, yt, o = {}) => { const ops = [], n = Math.floor(len / pitch); for (let i = 0; i < n; i++) { const c = (len - n * pitch) / 2 + pitch * (i + 0.5); ops.push({ pts: rect(c - w / 2, yb, c + w / 2, yt), kind: 'win', glass: 'glassDark', d: 0.12, sill: false, revealKey: 'vFrame', ...o }); } return ops; };
  const lenX = Lx - 2 * wi, lenZ = Lz - 2 * wi;
  K.wall(B, K.frame(V.u1 - wi, 0, V.v0 + wi, -1, 0), rect(0, f1, lenX, y1), winRow(lenX, 2.82, 2.3, P.V_F1 + 0.1, P.V_FASCIA[0] - 0.12), 'vBrick');
  K.wall(B, K.frame(V.u0 + wi, 0, V.v1 - wi, 1, 0), rect(0, f1, lenX, y1), winRow(lenX, 2.82, 1.5, P.V_F1 + 0.9, P.V_FASCIA[0] - 0.2), 'vBrick');
  K.wall(B, K.frame(V.u1 - wi, 0, V.v1 - wi, 0, -1), rect(0, f1, lenZ, y1), [...winRow(lenZ, 2.6, 1.9, P.V_F1 + 0.05, P.V_FASCIA[0] - 0.12, { kind: 'door', doorKey: 'doorDark' })], 'vBrick');
  K.wall(B, K.frame(V.u0 + wi, 0, V.v0 + wi, 0, 1), rect(0, f1, lenZ, y1), winRow(lenZ, 2.6, 1.5, P.V_F1 + 0.9, P.V_FASCIA[0] - 0.2), 'vBrick');

  // the lower ground floor on the north, the west and the south-west (beyond the podium), its balcony and railing
  let gmin = Infinity; for (let u = V.u0; u <= V.u1; u += 2) gmin = Math.min(gmin, S.groundY(u, V.v0 - 0.5)); for (let v = V.v0; v <= V.v1; v += 2) gmin = Math.min(gmin, S.groundY(V.u0 - 0.5, v));
  const plinth = gmin - 0.55, nU0 = V.u0 + li, nU1 = -12.65, sV = V.v1 - li;
  const lgN = nU1 - nU0, lgW = sV - (V.v0 + li), lgS = POD.u0 - nU0;
  const lgWin = (len, pitch) => winRow(len, pitch, 1.5, P.V_LG + 0.9, P.V_LG + 2.45);
  K.wall(B, K.frame(nU1, 0, V.v0 + li, -1, 0), rect(0, plinth, lgN, P.V_F1), lgWin(lgN, 2.82), 'vBrick');
  K.wall(B, K.frame(nU0, 0, V.v0 + li, 0, 1), rect(0, plinth, lgW, P.V_F1), lgWin(lgW, 2.6), 'vBrick');
  K.wall(B, K.frame(nU0, 0, sV, 1, 0), rect(0, plinth, lgS, P.V_F1), lgWin(lgS, 2.5), 'vBrick');
  B.poly('vBrick', [[nU1, plinth, V.v0 + li], [nU1, plinth, LOW.northWall.v], [nU1, P.V_F1, LOW.northWall.v], [nU1, P.V_F1, V.v0 + li]], [1, 0, 0]);
  const balc = [[nU0, V.v0 + li], [nU1, V.v0 + li], [nU1, V.v0 + wi], [V.u0 + wi, V.v0 + wi], [V.u0 + wi, V.v1 - wi], [POD.u0, V.v1 - wi], [POD.u0, sV], [nU0, sV]];
  B.flat('vCon', balc, P.V_F1);
  railing(B, [[POD.u0, sV - 0.08], [nU0 + 0.08, sV - 0.08], [nU0 + 0.08, V.v0 + li + 0.08], [nU1 - 0.1, V.v0 + li + 0.08]], P.V_F1, 1.0);

  // columns under the fascia where the decks run in under it (south from the podium's west wall, east)
  const sPosts = postsOf(long).map((s) => V.u0 + s).filter((u, i) => i % 2 === 1 && u > POD.u0 + 0.5 && (u < PAV.u0 - 0.3 || u > PAV.u1 + 0.3));
  for (const u of sPosts) B.box('vCon', u, (P.V_F1 + P.V_FASCIA[0]) / 2, V.v1 - 0.45, FR.PW, P.V_FASCIA[0] - P.V_F1, FR.PW);
  for (const s of postsOf(end)) B.box('vCon', V.u1 - 0.45, (P.V_F1 + P.V_FASCIA[0]) / 2, V.v1 - s, FR.PW, P.V_FASCIA[0] - P.V_F1, FR.PW);
  // round lamps on the fascia over the terrace and the walkway
  for (const [u, v] of [[-36.0, V.v1 + 0.02], [-15.0, V.v1 + 0.02], [V.u1 + 0.02, 74.0]]) {
    B.cyl('lampGlass', u, P.V_FASCIA[0] + 0.25, v, 0.16, 0.32, 8, true); ctx.lamp(u, P.V_FASCIA[0] + 0.4, v);
  }

  // the pitched glazed rooflight with its raised box
  const R = P.V_ROOFLIGHT, rb = R.box;
  K.prism(B, 'vCon', box2(R.u0, R.v0, R.u1, R.v1), P.V_ROOF, R.eaves, { top: false });
  K.roof(B, 'glassRoof', R.u0, R.u1, R.v0, R.v1, R.eaves, R.ridge - R.eaves, { axis: 'x', ends: ['gable', 'gable'], wallKey: 'glassRoof', ov: 0.05 });
  K.prism(B, 'glassRoof', box2(rb.u0, rb.v0, rb.u1, rb.v1), R.ridge - 0.35, rb.top, { top: true, topKey: 'leadDark' });
  for (let u = R.u0 + 1.1; u < R.u1 - 0.5; u += 1.1) { for (const [v, vv] of [[R.v0 - 0.03, (R.v0 + R.v1) / 2], [R.v1 + 0.03, (R.v0 + R.v1) / 2]]) B.beam('vFrame', [u, R.eaves, v], [u, R.ridge + 0.02, vv], 0.05); }

  // solids: the lower ground's line on the north and west, the recessed first floor where the decks run under the frame
  ctx.solid([[nU0, V.v0 + li], [nU1, V.v0 + li], [nU1, V.v0 + wi], [V.u1 - wi, V.v0 + wi], [V.u1 - wi, V.v1 - wi], [POD.u0, V.v1 - wi], [POD.u0, sV], [nU0, sV]]);
  for (const u of sPosts) ctx.solid(box2(u - 0.19, V.v1 - 0.64, u + 0.19, V.v1 - 0.26));
  for (const s of postsOf(end)) ctx.solid(box2(V.u1 - 0.64, V.v1 - s - 0.19, V.u1 - 0.26, V.v1 - s + 0.19));
  return { bays: long.length, end: end.map((b) => +(b[1] - b[0]).toFixed(2)) };
}

// ------------------------------------------------------------------------------------------------ the Terrace bar pavilion
function buildPavilion(ctx, K, B) {
  const p = PAV, tan = Math.tan(p.pitch), roofY = (v) => p.edge - (p.v1 - v) * tan, gridY = roofY(p.vGrid);
  // brick upstand to the cill, south and both ends
  B.box('vBrick', (p.u0 + p.u1) / 2, (p.floor - 0.2 + p.sill) / 2, p.v1 - 0.12, p.u1 - p.u0, p.sill - p.floor + 0.2, 0.24);
  for (const u of [p.u0 + 0.12, p.u1 - 0.12]) B.box('vBrick', u, (p.floor - 0.2 + p.sill) / 2, (p.vIn + p.v1) / 2, 0.24, p.sill - p.floor + 0.2, p.v1 - p.vIn);
  // the long south front: 12 panels, lower and upper lights, dark mullions, transom, top member
  B.push(K.frame(p.u0, 0, p.v1, 1, 0));
  const W = p.u1 - p.u0, pw = W / p.panels;
  for (let i = 0; i < p.panels; i++) {
    const x0 = i * pw + 0.04, x1 = (i + 1) * pw - 0.04;
    B.unit('glassDark', rect(x0, p.sill + 0.04, x1, p.transom - 0.04), -0.04, K.nextBay(p.sill));
    B.unit('glassDark', rect(x0, p.transom + 0.04, x1, p.edge - 0.08), -0.04, K.nextBay(p.transom));
  }
  for (let i = 0; i <= p.panels; i++) B.box('vFrame', i * pw, (p.sill + p.edge) / 2, -0.02, i % 4 === 0 ? 0.14 : 0.08, p.edge - p.sill, 0.12);
  B.box('vFrame', W / 2, p.transom, -0.02, W, 0.08, 0.12);
  B.box('vFrame', W / 2, p.sill + 0.03, -0.02, W, 0.08, 0.14);
  B.box('vFrame', W / 2, p.edge - 0.05, 0.0, W + 0.1, 0.16, 0.2, 0, { bottom: true });
  B.pop();
  // the ends (west faces west, east faces east): one panel under Vaughan's fascia, two under the sloping roof; a door in the outer one
  for (const [M, sgn] of [[K.frame(p.u0, 0, p.vIn, 0, 1), 1], [K.frame(p.u1, 0, p.v1, 0, -1), -1]]) {
    B.push(M);
    const sAt = (v) => (sgn > 0 ? v - p.vIn : p.v1 - v), cuts = [p.vIn, p.vGrid, (p.vGrid + p.v1) / 2, p.v1];
    for (let k = 0; k < 3; k++) {
      const va = cuts[k], vb = cuts[k + 1], sa = sAt(va), sb = sAt(vb), s0 = Math.min(sa, sb) + 0.04, s1 = Math.max(sa, sb) - 0.04;
      const top = (v) => (v <= p.vGrid + 1e-6 ? P.V_FASCIA[0] : roofY(v)) - 0.06, t0 = top(sgn > 0 ? va : vb), t1 = top(sgn > 0 ? vb : va);
      if (k === 2) { B.unit('doorDark', rect(s0, p.floor + 0.02, s1, p.transom - 0.04), -0.04); }
      else B.unit('glassDark', rect(s0, p.sill + 0.04, s1, p.transom - 0.04), -0.04, K.nextBay(p.sill));
      B.unit('glassDark', [[s0, p.transom + 0.04], [s1, p.transom + 0.04], [s1, sgn > 0 ? t1 : t0], [s0, sgn > 0 ? t0 : t1]], -0.04, K.nextBay(p.transom));
      B.box('vFrame', s1 + 0.04, (p.sill + Math.max(t0, t1)) / 2, -0.02, 0.1, Math.max(t0, t1) - p.sill, 0.12);
    }
    B.box('vFrame', (sAt(p.vIn) + sAt(p.v1)) / 2, p.transom, -0.02, p.v1 - p.vIn, 0.08, 0.12);
    B.pop();
  }
  // the glazed monopitch roof from the outer edge down to the fascia, glazing bars over the mullions
  B.poly('glassRoof', [[p.u0, p.edge, p.v1 + 0.08], [p.u1, p.edge, p.v1 + 0.08], [p.u1, gridY, p.vGrid], [p.u0, gridY, p.vGrid]], [0, 1, 0.1]);
  for (let i = 0; i <= p.panels; i++) { const u = p.u0 + i * pw; B.beam('vFrame', [u, p.edge + 0.03, p.v1 + 0.08], [u, gridY + 0.03, p.vGrid], 0.06); }
  ctx.solid(box2(p.u0, p.vIn, p.u1, p.v1));
  return { panels: p.panels };
}

// ------------------------------------------------------------------------------------------------ Fry
function buildFry(ctx, K, B) {
  const { S } = ctx, Lx = F.u1 - F.u0, Lz = F.v1 - F.v0, wi = P.F_WALL_IN;
  const common = { y0: P.F_FASCIA[0], roof: P.F_ROOF, rim: P.F_RIM, floors: P.F_FLOORS };
  const long = bayLayout(Lx, P.F_BAYS), end = endLayout(Lz);
  frameFace(B, K, K.frame(F.u0, 0, F.v1, 1, 0), Lx, { ...common, bays: long });                         // south (Little Clarendon Street)
  frameFace(B, K, K.frame(F.u1, 0, F.v0, -1, 0), Lx, { ...common, bays: long });                        // north (the walkway)
  frameFace(B, K, K.frame(F.u0, 0, F.v0, 0, 1), Lz, { ...common, bays: end });                          // west (the terrace)
  frameFace(B, K, K.frame(F.u1, 0, F.v1, 0, -1), Lz, { ...common, bays: bayLayout(Lz, 4), blank: true }); // east: a blank concrete end
  const SF = P.F_STREET, eb = P.F_EAST_BRICK;
  const inner = box2(F.u0 + wi, F.v0 + wi, eb, SF.clereFace);
  frameCaps(B, box2(F.u0, F.v0, F.u1, F.v1), inner, P.F_FASCIA[0], P.F_ROOF, P.F_RIM);
  const y1 = P.F_FASCIA[0] + 0.02;
  // the first floor: glazed to the terrace (west) and the walkway (north, over a brick base)
  const lenW = SF.clereFace - (F.v0 + wi), lenN = eb - (F.u0 + wi);
  K.wall(B, K.frame(F.u0 + wi, 0, F.v0 + wi, 0, 1), rect(0, P.F_F1 - 0.05, lenW, y1), [{ pts: rect(0.15, P.F_F1 + 0.05, lenW - 0.15, P.F_FASCIA[0] - 0.12), kind: 'win', glass: 'glassDark', lights: 6, mullionKey: 'vFrame', mullionW: 0.08, d: 0.1, sill: false, revealKey: 'vFrame' }], 'vBrick');
  K.wall(B, K.frame(eb, 0, F.v0 + wi, -1, 0), rect(0, P.DECK_LOW - 0.1, lenN, y1), [{ pts: rect(0.3, P.F_F1 + 0.1, lenN - 0.3, P.F_FASCIA[0] - 0.12), kind: 'win', glass: 'glassDark', lights: 11, mullionKey: 'vFrame', mullionW: 0.08, d: 0.1, sill: false, revealKey: 'vFrame' }], 'vBrick');
  // the street face under the frame: the brown brick band on the arcade's beams, the clerestory strip over it
  K.wall(B, K.frame(F.u0, 0, SF.brickFace, 1, 0), rect(0, ARC.top - 0.02, Lx, SF.brickTop), [], 'vBrick');
  K.wall(B, K.frame(F.u0, 0, SF.clereFace, 1, 0), rect(0, SF.brickTop - 0.02, Lx, y1), [{ pts: rect(0.1, SF.brickTop + 0.03, Lx - 0.1, P.F_FASCIA[0] - 0.03), kind: 'win', glass: 'glassDark', lights: 14, mullionKey: 'vFrame', mullionW: 0.07, d: 0.06, sill: false, revealKey: 'vFrame' }], 'vFrame');
  B.flat('vBrick', box2(F.u0, SF.clereFace, F.u1, SF.brickFace), SF.brickTop);
  B.flat('vCon', box2(F.u0, SF.brickFace, F.u1, F.v1), ARC.top);
  B.poly('vBrick', [[F.u0, ARC.top, SF.brickFace], [F.u0, ARC.top, F.v1], [F.u0, SF.brickTop, F.v1], [F.u0, SF.brickTop, SF.brickFace]], [-1, 0, 0]);
  // the east end: a brick storey under the blank concrete, the ground floor's end wall to the gap
  const gE = Math.min(S.groundY(F.u1 + 0.5, F.v0), S.groundY(F.u1 + 0.5, F.v1)) - 0.4;
  K.wall(B, K.frame(eb, 0, SF.clereFace, 0, -1), rect(0, ARC.top - 0.02, SF.clereFace - F.v0, y1), [], 'vBrick');
  K.wall(B, K.frame(eb, 0, ARC.walk, 0, -1), rect(0, gE, ARC.walk - F.v0, ARC.top), [], 'vBrick');
  B.flat('vCon', box2(eb, F.v0, F.u1, F.v1), P.F_FASCIA[0] - 0.001, [], true);

  // the platform under the west overhang, the steps up to it, the sculpture
  const pf = P.F_PLATFORM, fs = P.F_STEPS, nR = fs.n + 1, rise = (P.F_F1 - P.DECK_UP) / nR;
  B.box('pavingSolid', (pf.u0 + pf.u1) / 2, (P.DECK_UP - 0.3 + P.F_F1) / 2, (pf.v0 + pf.v1) / 2, pf.u1 - pf.u0, P.F_F1 - P.DECK_UP + 0.3, pf.v1 - pf.v0);
  B.push(K.frame(F.u0, 0, 0, 0, 1)); K.steps(B, 'pavingSolid', fs.v0, fs.v1, 0, 1, fs.n, rise, 0.3, P.F_F1, P.DECK_UP - 0.2); B.pop();
  railing(B, [[fs.u0 + 0.1, fs.v0 - 0.05], [F.u0 + 0.1, fs.v0 - 0.05]], P.DECK_UP + 0.2, 0.9);
  const sc = P.SCULPTURE;
  B.box('vBrick', sc.u, P.F_F1 + 0.2, sc.v, 0.7, 0.4, 1.1);
  B.cyl('bathOld', sc.u, P.F_F1 + 0.4, sc.v, 0.32, 0.6, 7, true, 0.48);
  for (const v of [88.0, 94.0]) { B.cyl('lampGlass', F.u0 - 0.02, P.F_FASCIA[0] + 0.25, v, 0.16, 0.32, 8, true); ctx.lamp(F.u0 - 0.1, P.F_FASCIA[0] + 0.4, v); }

  // the spiral escape stair at the east end: pole, treads, a helical handrail on stanchions
  const st = P.F_STAIR, sy0 = S.groundY(st.u, st.v), n = Math.floor((st.top - sy0) / st.step), da = (25 * Math.PI) / 180;
  B.cyl('ironBlack', st.u, sy0, st.v, 0.09, st.top - sy0 + 1.0, 8, true);
  const at = (a, r, y) => [st.u + Math.cos(a) * r, y, st.v + Math.sin(a) * r];
  for (let i = 0; i < n; i++) {
    const a = i * da, y = sy0 + (i + 1) * st.step;
    B.poly('ironBlack', [at(a, 0.09, y), at(a, st.r, y), at(a + da * 1.1, st.r, y), at(a + da * 1.1, 0.09, y)], [0, 1, 0]);
    B.poly('ironBlack', [at(a, 0.09, y - 0.03), at(a, st.r, y - 0.03), at(a + da * 1.1, st.r, y - 0.03), at(a + da * 1.1, 0.09, y - 0.03)], [0, -1, 0]);
    if (i % 2 === 0 && i + 2 <= n) {
      B.beam('ironBlack', at(a, st.r, y + 0.95), at(a + 2 * da, st.r, y + 2 * st.step + 0.95), 0.045);
      if (i % 4 === 0) B.beam('ironBlack', at(a, st.r, y), at(a, st.r, y + 0.95), 0.03);
    }
  }
  ctx.solid(box2(st.u - st.r, st.v - st.r, st.u + st.r, st.v + st.r));
  // the flue, the rooflight, the roof plant (telecom shrouds and cabinets)
  B.cyl('vCon', P.F_FLUE.u, P.F_ROOF, P.F_FLUE.v, P.F_FLUE.r, P.F_FLUE.top - P.F_ROOF, 12, true);
  B.cyl('leadDark', P.F_FLUE.u, P.F_FLUE.top, P.F_FLUE.v, P.F_FLUE.r + 0.04, 0.12, 12, true);
  const RL = P.F_ROOFLIGHT;
  K.prism(B, 'vCon', box2(RL.u0, RL.v0, RL.u1, RL.v1), P.F_ROOF, P.F_ROOF + 0.4, { top: false });
  K.roof(B, 'glassRoof', RL.u0, RL.u1, RL.v0, RL.v1, P.F_ROOF + 0.4, RL.top - P.F_ROOF - 0.4, { axis: 'x', ends: ['hip', 'hip'], ov: 0.05 });
  for (const [u, v, w, d, h] of P.F_PLANT) { if (w > 1) K.prism(B, 'grey', box2(u - w / 2, v - d / 2, u + w / 2, v + d / 2), P.F_ROOF, P.F_ROOF + h, { top: true }); else B.cyl('whitePaint', u, P.F_ROOF, v, w / 2, h, 8, true); }
  ctx.solid(box2(F.u0 + wi, F.v0 + wi, eb, ARC.walk));
  return { bays: long.length };
}

// ------------------------------------------------------------------------------------------------ the arcade, the shops, the podium's parapet
/** one span of the arcade's beam between post centres a < b: front face on the street, back face, the curved soffit */
function arcadeSpan(K, B, a, b, backTop) {
  const h = ARC.pw / 2, x0 = a + h, x1 = b - h, c = (x1 - x0) / 2, rise = ARC.crown - ARC.spring, R = (c * c + rise * rise) / (2 * rise), xm = (x0 + x1) / 2, cyc = ARC.crown - R;
  const arc = []; for (let i = 0; i <= 8; i++) { const x = x0 + ((x1 - x0) * i) / 8; arc.push([x, cyc + Math.sqrt(Math.max(0, R * R - (x - xm) * (x - xm)))]); }
  const z = ARC.pw;
  B.push(K.frame(0, 0, POD.front, 1, 0));
  B.face('vCon', [[a, ARC.spring], ...arc, [b, ARC.spring], [b, ARC.top], [a, ARC.top]]);
  B.face('vCon', [[a, ARC.spring], ...arc, [b, ARC.spring], [b, backTop], [a, backTop]], [], -z, true);
  for (let i = 0; i < arc.length - 1; i++) { const p = arc[i], q = arc[i + 1]; B.poly('vCon', [[p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], -z], [p[0], p[1], -z]], [0, -1, 0]); }
  B.pop();
}
function buildArcade(ctx, K, B) {
  const { S } = ctx, posts = ARC.posts.slice().sort((x, y) => x - y), zc = POD.front - ARC.pw / 2, walk = ARC.walk;
  for (const u of posts) {
    const g = S.groundY(u, zc) - 0.3;
    B.box('vCon', u, (g + ARC.spring) / 2, zc, ARC.pw, ARC.spring - g, ARC.pw);
    ctx.solid(box2(u - ARC.pw / 2, POD.front - ARC.pw, u + ARC.pw / 2, POD.front));
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i], b = posts[i + 1];
    arcadeSpan(K, B, a, b, a >= F.u0 - 0.01 ? ARC.soffitFry : ARC.top);
    const m = (a + b) / 2; B.cyl('lampGlass', m, ARC.soffitPod - 0.22 + (a >= F.u0 - 0.01 ? ARC.soffitFry - ARC.soffitPod : 0), (walk + POD.front) / 2, 0.17, 0.12, 8, true);
    ctx.lamp(m, (a >= F.u0 - 0.01 ? ARC.soffitFry : ARC.soffitPod) - 0.3, (walk + POD.front) / 2);
  }
  // the walk's soffits: under the podium and (higher) under Fry, the step between them
  B.flat('vCon', box2(POD.u0, walk, F.u0, POD.front - ARC.pw), ARC.soffitPod, [], true);
  B.flat('vCon', box2(F.u0, walk, F.u1, POD.front - ARC.pw), ARC.soffitFry, [], true);
  B.poly('vCon', [[F.u0, ARC.soffitPod, walk], [F.u0, ARC.soffitPod, POD.front - ARC.pw], [F.u0, ARC.soffitFry, POD.front - ARC.pw], [F.u0, ARC.soffitFry, walk]], [-1, 0, 0]);
  // the shop fronts under the podium, one a span (the tunnel's bay excepted)
  const tb = [MOUTH.u0 - TUNNEL.wall, MOUTH.u1 + TUNNEL.wall];      // the passage's mouth: the whole bay west of Fry (touch-up 1)
  for (let i = 0; i < posts.length - 1; i++) {
    let a = posts[i], b = posts[i + 1]; if (b > F.u0 + 0.01) break;
    if (i === 0) a = POD.u0;
    if (a < MOUTH.u0 && b > MOUTH.u1) {      // the passage's bay: the white side walls' ends either side of its mouth
      for (const [p, q] of [[a, tb[0]], [tb[1], b]]) { const g = S.groundY((p + q) / 2, walk) - 0.3; B.box('whitePaint', (p + q) / 2, (g + ARC.soffitPod) / 2, walk + 0.15, q - p, ARC.soffitPod - g, 0.3); }
      continue;
    }
    const len = b - a, g = Math.min(S.groundY(a, walk), S.groundY(b, walk)), gm = S.groundY((a + b) / 2, walk);
    K.wall(B, K.frame(a, 0, walk, 1, 0), rect(0, g - 0.3, len, ARC.soffitPod + 0.01), [
      { pts: rect(0.2, gm + P.SHOP.riser, len - 1.45, P.SHOP.fascia - 0.1), kind: 'win', glass: 'glassDark', lights: 3, mullionKey: 'vFrame', mullionW: 0.07, d: 0.1, sill: false, revealKey: 'vFrame' },
      { pts: rect(len - 1.3, gm + 0.02, len - 0.3, P.SHOP.fascia - 0.15), kind: 'door', doorKey: 'doorDark', d: 0.1, revealKey: 'vFrame' },
    ], 'vFrame');
  }
  ctx.seg(POD.u0, walk, tb[0], walk);
  // the ground floor under Fry: white-painted, the pair of timber doors (no. 14), cycle racks, the gate at the east end
  const fa = tb[1], fl = P.F_EAST_BRICK - fa, gF = Math.min(S.groundY(fa, walk), S.groundY(P.F_EAST_BRICK, walk)) - 0.3, gd = S.groundY((P.F_DOOR.u0 + P.F_DOOR.u1) / 2, walk);
  K.wall(B, K.frame(fa, 0, walk, 1, 0), rect(0, gF, fl, ARC.soffitFry + 0.01), [{ pts: rect(P.F_DOOR.u0 - fa, gd + 0.02, P.F_DOOR.u1 - fa, gd + P.F_DOOR.h), kind: 'door', doorKey: 'doorOak', d: 0.15 }], 'whitePaint');
  ctx.seg(tb[1], walk, F.u0 + P.F_WALL_IN, walk);
  for (const u of [4.6, 5.6, 6.6, 7.6, 9.4, 10.4]) { const g = S.groundY(u, walk + 0.9); B.beam('ironBlack', [u, g, walk + 0.4], [u, g + 0.8, walk + 0.4], 0.045); B.beam('ironBlack', [u, g + 0.8, walk + 0.4], [u, g + 0.8, walk + 1.3], 0.045); B.beam('ironBlack', [u, g, walk + 1.3], [u, g + 0.8, walk + 1.3], 0.045); }
  { const u = P.F_EAST_BRICK + 0.12, g = S.groundY(u, walk + 1.2); for (let v = walk + 0.1; v < POD.front - ARC.pw; v += 0.14) B.box('ironBlack', u, g + 1.2, v, 0.03, 2.4, 0.03, 0, { top: false }); for (const y of [0.1, 2.35]) B.box('ironBlack', u, g + y, (walk + POD.front - ARC.pw) / 2, 0.05, 0.06, POD.front - ARC.pw - walk); ctx.seg(u, walk, u, POD.front); }
  // the paved walk (on the surveyed street surface); brick setts in the passage's bay out to the posts (the look)
  const pa = posts.filter((u) => u < MOUTH.u0).pop() + ARC.pw / 2, pb = posts.find((u) => u > MOUTH.u1) - ARC.pw / 2;
  // THE MERGE (2026-11-24): the walk meets Little Clarendon Street's pavement FLUSH. The city draws its pavement 0.13 over
  // the surveyed ground (world/ground.js Y.pavement) from about v 98.4 out, with a bare strip of its base ground between
  // it and the boundary (v 97.7): the walk's paving now runs out over that strip at the pavement's own level (DRAWN to
  // P.PAVE_DRAW, the foot of the city's kerb ramp, never under the pavement; WALKED to P.PAVE_EDGE), and falls back across the walk to the surveyed ground + 0.08 at the
  // shop fronts and the passage's mouth (unchanged). G: the fall across the walk (the street's own cross-fall).
  const pave = (u) => S.groundY(u, P.PAVE_EDGE + 0.5) + P.PAVE_UP, front = POD.front - ARC.pw;
  const yA = (u, v) => { if (v >= front) return pave(u); const g = S.groundY(u, v) + 0.08, f = Math.max(0, (v - walk) / (front - walk)); return g + (pave(u) - g) * f; };
  const yD = yA;      // (drawn only to PAVE_DRAW, the foot of the city's kerb ramp: nothing of ours under its pavement)
  ctx.G.drape(B, 'paving', box2(POD.u0, walk, pa, P.PAVE_DRAW), 0, { y: yD });
  ctx.G.drape(B, 'setts', box2(pa, walk, pb, P.PAVE_DRAW), 0, { y: yD });
  ctx.G.drape(B, 'paving', box2(pb, walk, P.F_EAST_BRICK, P.PAVE_DRAW), 0, { y: yD });
  ctx.floor(box2(POD.u0, walk, P.F_EAST_BRICK, P.PAVE_EDGE), yA);
  { const r = box2(P.F_EAST_BRICK, front, 17.49, P.PAVE_EDGE); ctx.G.drape(B, 'paving', box2(P.F_EAST_BRICK, front, 17.49, P.PAVE_DRAW), 0, { y: yD }); ctx.floor(r, yA); }      // (on to the site's corner, before Fry's east gate)

  // the podium's brown brick parapet over the beams: railing panels in openings over every other span, a handrail over
  const pt = POD.t, pz = POD.front - pt / 2, top = PARAPET.top, pPosts = posts.filter((u) => u <= F.u0 + 0.01);
  const opens = []; for (let i = 0; i < pPosts.length - 1; i++) if (i % 2 === 1) { const m = (pPosts[i] + pPosts[i + 1]) / 2; opens.push([m - PARAPET.openW / 2, m + PARAPET.openW / 2]); }
  let s = POD.u0; const runs = []; for (const [o0, o1] of opens) { runs.push([s, o0]); s = o1; } runs.push([s, F.u0]);
  for (const [r0, r1] of runs) B.box('vBrick', (r0 + r1) / 2, (ARC.top + top) / 2, pz, r1 - r0, top - ARC.top, pt);
  for (const [o0, o1] of opens) {
    B.box('vBrick', (o0 + o1) / 2, (ARC.top + P.DECK_UP + 0.12) / 2, pz, o1 - o0, P.DECK_UP + 0.12 - ARC.top, pt);
    for (let u = o0 + 0.1; u < o1 - 0.05; u += 0.13) B.box('ironBlack', u, (P.DECK_UP + 0.12 + top) / 2, pz, 0.025, top - P.DECK_UP - 0.12, 0.025, 0, { top: false });
    for (const y of [P.DECK_UP + 0.16, top - 0.05]) B.box('ironBlack', (o0 + o1) / 2, y, pz, o1 - o0, 0.05, 0.05);
  }
  for (let u = POD.u0 + 0.3; u < F.u0 - 0.2; u += 2.75) B.box('alu', u, top + PARAPET.rail / 2, pz, 0.05, PARAPET.rail, 0.05, 0, { top: false });
  B.beam('alu', [POD.u0 + 0.3, top + PARAPET.rail, pz], [F.u0 - 0.2, top + PARAPET.rail, pz], 0.05);
  return { posts: posts.length, shops: posts.filter((u) => u < TUNNEL.u0).length };
}

// ------------------------------------------------------------------------------------------------ the decks, the steps, the tunnel
function buildDecks(ctx, K, B) {
  const { S } = ctx, LD = P.DECK_LOW, UD = P.DECK_UP;
  // the deck over the shops and the walkway / terrace strip, dark brick pavers
  const up = box2(POD.u0, POD.v0, F.u0, POD.front - POD.t);
  B.flat('vPavers', up, UD);
  for (const r of LOW.rings) B.flat('vPavers', r, LD);
  // four risers from the strip up to the deck either side of the pavilion
  const su = P.STAIR_UP, rise = (UD - LD) / (su.n + 1);
  for (const [x0, x1] of su.segs) K.steps(B, 'pavingSolid', x0, x1, su.vTop, -1, su.n, rise, 0.3, UD, LD - 0.2);
  const stepFloor = (u, v) => { const k = Math.min(su.n, Math.max(0, Math.floor((su.vTop - v) / 0.3))); return k >= su.n ? LD : UD - rise * (k + 1); };
  // the deck's west wall (the neighbouring shops beyond), two heights
  const gw = S.groundY(POD.u0 - 0.5, 90) - 0.3;
  B.box('vBrick', POD.u0 - 0.17, (gw + LD + 1.1) / 2, (V.v1 - P.V_WALL_IN + POD.v0) / 2, 0.34, LD + 1.1 - gw, POD.v0 - (V.v1 - P.V_WALL_IN));
  B.box('vBrick', POD.u0 - 0.17, (gw + PARAPET.top) / 2, (POD.v0 + POD.front) / 2, 0.34, PARAPET.top - gw, POD.front - POD.v0);
  ctx.seg(POD.u0, V.v1 - P.V_WALL_IN, POD.u0, ARC.walk);
  // the walkway's face to the Chapel forecourt, the passage's mouth and lintel, its railing; the strip's east end wall
  const nw = LOW.northWall, t0 = TUNNEL.u0 - TUNNEL.wall, t1 = TUNNEL.u1 + TUNNEL.wall;
  for (const [a, b] of [[nw.u0, t0], [t1, nw.u1]]) { const g = Math.min(S.groundY(a, nw.v - 0.3), S.groundY(b, nw.v - 0.3)) - 0.5; B.box('vBrick', (a + b) / 2, (g + LD) / 2, nw.v + nw.t / 2, b - a, LD - g, nw.t); }
  B.box('vCon', (t0 + t1) / 2, (TUNNEL.ceilLow + LD) / 2, nw.v + nw.t / 2, t1 - t0, LD - TUNNEL.ceilLow, nw.t + 0.02);
  railing(B, [[nw.u0 + 0.05, nw.v + 0.1], [nw.u1 - 0.05, nw.v + 0.1]], LD);
  ctx.seg(nw.u0, nw.v, TUNNEL.u0, nw.v); ctx.seg(TUNNEL.u1, nw.v, nw.u1, nw.v);
  { const e = LOW.eastEnd, g = S.groundY(e + 0.5, 82) - 0.4; B.box('vBrick', e + 0.17, (g + LD + 1.1) / 2, (80.0 + F.v0) / 2, 0.34, LD + 1.1 - g, F.v0 - 80.0); ctx.seg(e, 80.0, e, F.v0); }
  // the raised planter on the walkway's east edge (over part chapel's retaining wall)
  { const pl = LOW.planter; B.box('vBrick', (pl.u0 + pl.u1) / 2, (P.CHAPEL_TERRACE - 0.3 + pl.top) / 2, (pl.v0 + pl.v1) / 2, pl.u1 - pl.u0, pl.top - P.CHAPEL_TERRACE + 0.3, pl.v1 - pl.v0); B.flat('soil', box2(pl.u0 + 0.2, pl.v0 + 0.2, pl.u1 - 0.2, pl.v1 - 0.2), pl.top + 0.01); for (let v = pl.v0 + 0.8; v < pl.v1 - 0.5; v += 1.3) B.box(v % 2 < 1 ? 'leafA' : 'leafC', (pl.u0 + pl.u1) / 2, pl.top + 0.45, v, 1.5, 0.9, 1.1); ctx.solid(box2(pl.u0, pl.v0, pl.u1, pl.v1)); }
  // planting, tables and parasols, lamp standards on the decks
  for (const [u, v] of P.PLANTERS) { const y = v > POD.v0 ? UD : LD; B.box('vFrame', u, y + 0.35, v, 1.2, 0.7, 0.6); B.box('leafA', u, y + 1.05, v, 1.0, 0.8, 0.55); B.box('leafB', u + 0.15, y + 1.55, v, 0.5, 0.5, 0.4); }
  for (const [u, v] of P.TABLES) {
    const y = v > POD.v0 ? UD : LD;
    B.box('teak', u, y + 0.74, v, 1.8, 0.05, 0.75); B.box('teak', u, y + 0.44, v - 0.62, 1.8, 0.05, 0.28); B.box('teak', u, y + 0.44, v + 0.62, 1.8, 0.05, 0.28);
    for (const du of [-0.7, 0.7]) B.box('teak', u + du, y + 0.37, v, 0.06, 0.74, 1.4, 0, { top: false });
    if (y === UD) { B.cyl('alu', u, y + 0.74, v, 0.025, 1.6, 6, false); K.coneRoof(B, 'vFrame', [[u - 1.2, v], [u, v - 1.2], [u + 1.2, v], [u, v + 1.2]], y + 2.0, [u, v], 0.45); }
  }
  for (const [u, v] of P.LAMPS_DECK) { const y = v > POD.v0 ? UD : LD, l = K.lampPost(B, u, v, y, 3.0); ctx.lamp(l[0], l[1], l[2]); }
  // registration: the decks, then the steps (later floors win)
  ctx.floor(up, UD);
  for (const r of LOW.rings) ctx.floor(r, LD);
  for (const [x0, x1] of su.segs) ctx.floor(box2(x0, su.vTop - 0.3 * su.n, x1, su.vTop), stepFloor);
  const pf = P.F_PLATFORM, fs = P.F_STEPS, fr = (P.F_F1 - UD) / (fs.n + 1);
  ctx.floor(box2(fs.u0, pf.v0, pf.u1, ARC.walk), (u) => (u >= F.u0 ? P.F_F1 : UD + fr * (fs.n - Math.min(fs.n - 1, Math.floor((F.u0 - u) / 0.3)))));
  return { lowRings: LOW.rings.length };
}
function buildTunnel(ctx, K, B) {
  const { S } = ctx, T = TUNNEL, M = MOUTH, LD = P.DECK_LOW, mid = POD.v0, w = T.wall;
  let g = Infinity; for (let v = T.v0; v <= T.v1; v += 2) g = Math.min(g, S.groundY(M.u0, v), S.groundY(M.u1, v)); g -= 0.3;
  // the north part under the walkway (brick: seen in no look) and the south part under the podium, the full bay wide (white)
  for (const [a, b] of [[T.u0 - w, T.u0], [T.u1, T.u1 + w]]) B.box('vBrick', (a + b) / 2, (g + LD - 0.02) / 2, (T.v0 + mid) / 2, b - a, LD - 0.02 - g, mid - T.v0);
  for (const [a, b] of [[M.u0 - w, M.u0], [M.u1, M.u1 + w]]) B.box('whitePaint', (a + b) / 2, (g + P.DECK_UP - 0.05) / 2, (mid + T.v1) / 2, b - a, P.DECK_UP - 0.05 - g, T.v1 - mid);
  for (const [a, b] of [[M.u0, T.u0 - w], [T.u1 + w, M.u1]]) B.box('whitePaint', (a + b) / 2, (g + T.ceilUp) / 2, mid + 0.15, b - a, T.ceilUp - g, 0.3);      // the steps in its width at the podium's edge
  B.flat('vCon', box2(T.u0, T.v0, T.u1, mid), T.ceilLow, [], true);
  B.flat('vCon', box2(M.u0, mid, M.u1, T.v1), T.ceilUp, [], true);
  B.poly('vCon', [[T.u0, T.ceilLow, mid], [T.u1, T.ceilLow, mid], [T.u1, T.ceilUp, mid], [T.u0, T.ceilUp, mid]], [0, 0, -1]);
  for (const v of [74.0, 88.0]) { const c = v < mid ? T.ceilLow : T.ceilUp; B.box('lampGlass', (T.u0 + T.u1) / 2, c - 0.04, v, 0.9, 0.08, 0.3, 0, { bottom: true }); ctx.lamp((T.u0 + T.u1) / 2, c - 0.2, v); }
  // the pair of black iron bar gates a few metres in, standing open: each leaf hinged at its side wall, swung in (north) against it
  const half = (M.u1 - M.u0) / 2;
  for (const [u, dir] of [[M.u0 + 0.07, 1], [M.u1 - 0.07, -1]]) {
    const y0 = S.groundY(u, M.gateV) + 0.06, n = Math.round(half / M.bar);
    B.box('ironBlack', u - dir * 0.02, y0 + M.gateH / 2 - 0.05, M.gateV + 0.05, 0.1, M.gateH + 0.1, 0.1, 0, {});      // the hanging post
    for (let i = 1; i <= n; i++) B.box('ironBlack', u, y0 + M.gateH / 2, M.gateV - (half * i) / n, 0.025, M.gateH, 0.025, 0, { top: false });
    for (const y of [0.12, M.gateH * 0.55, M.gateH - 0.05]) B.box('ironBlack', u, y0 + y, M.gateV - half / 2, 0.035, 0.05, half, 0, {});
    ctx.seg(u, M.gateV, u, M.gateV - half);
  }
  // the notice board on the west wall near the mouth
  { const b = M.board, y0 = S.groundY(M.u0 + 0.5, b.v); B.box('vFrame', M.u0 + 0.03, y0 + (b.y0 + b.y1) / 2, b.v, 0.06, b.y1 - b.y0, b.w, 0, {}); B.box('whitePaint', M.u0 + 0.065, y0 + (b.y0 + b.y1) / 2, b.v, 0.01, b.y1 - b.y0 - 0.1, b.w - 0.1, 0, {}); }
  // the brick setts, the walls to walk into, the floors
  ctx.G.drape(B, 'setts', box2(T.u0, T.v0, T.u1, mid), 0.08);
  ctx.G.drape(B, 'setts', box2(M.u0, mid, M.u1, T.v1), 0.08);
  ctx.seg(T.u0, T.v0, T.u0, mid); ctx.seg(T.u1, T.v0, T.u1, mid); ctx.seg(M.u0, mid, M.u0, T.v1); ctx.seg(M.u1, mid, M.u1, T.v1);
  ctx.seg(M.u0, mid, T.u0, mid); ctx.seg(T.u1, mid, M.u1, mid);
  ctx.floor(box2(T.u0, T.v0, T.u1, mid), (u, v) => S.groundY(u, v) + 0.08);      // (registered last: the passage wins over the decks above it)
  ctx.floor(box2(M.u0, mid, M.u1, T.v1), (u, v) => S.groundY(u, v) + 0.08);
  return { len: +(T.v1 - T.v0).toFixed(1) };
}

export function buildVaughanPart(ctx) {
  const { B, K, pack } = ctx;
  addCells(K, pack);
  const out = {};
  out.vaughan = buildVaughan(ctx, K, B);
  out.pavilion = buildPavilion(ctx, K, B);
  out.fry = buildFry(ctx, K, B);
  out.decks = buildDecks(ctx, K, B);
  out.arcade = buildArcade(ctx, K, B);
  out.tunnel = buildTunnel(ctx, K, B);
  return out;
}
