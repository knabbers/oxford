// Worcester College, the far north-west corner: 42 Nelson Street (the graduate flats), Gate 4 across the end of the
// street, and what stands round the flats' car park. Called by places/worcester_west.js (sources and K / G there; the
// plan and levels in _wwest_plan.js).
import { rectPts } from './_worcester_kit.js';
import { shrub } from './_worcester_south_kit.js';
import { LV, CB, WF, EF, FL, G4, NW, BIKES, SG, WL, CPK } from './_wwest_plan.js';
import { onFace, strip, bands, wallFace, flatWin, pyramid, pier, digits, mk } from './_wwest_kit.js';

const BRICK = 'wwFlat', CONC = 'wwConc', RED = 'wwRed', BUFF = 'wwBuff', DARK = 'wwDark', GALV = 'wwGalv';
const flip = (B, key, x0, y0, x1, y1, z = 0) => B.poly(key, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, -1]);
const both = (B, key, x0, y0, x1, y1, z = 0) => { strip(B, key, x0, y0, x1, y1, z + 0.004); flip(B, key, x0, y0, x1, y1, z - 0.004); };

// ================================================================= 42 Nelson Street (1973-74): two three-storey blocks
// of dark red-brown brick at 22 degrees to each other, each under a low pyramid roof, and the link between them
export function buildFlats(game, B) {
  const L = LV.flats, col = game.worldCollider, top = L.top, BROWN = 'wwBrown';
  const bw = (x0, y0, x1, y1, f, cols = 2) => [x0, y0, x1, y1, { flat: BROWN, floor: f, cols }];
  const sash = (c, f, w = 1.2) => bw(c - w / 2, L.sill + f * L.storey, c + w / 2, L.sill + f * L.storey + L.winH, f);
  const bays = (cs, w) => cs.flatMap((c) => [0, 1, 2].map((f) => sash(c, f, w)));
  const face = (p0, p1, wins = [], fn) => onFace(B, p0, p1, (len) => { wallFace(B, BRICK, rectPts(0, 0, len, top), wins, { head: CONC, headH: 0.15 }); if (fn) fn(len); });
  const [nSW, nSE, nNE, nNW] = FL.nbRing, [sSW, sSE, sNE, sNW] = FL.sbRing, [k1, , , k3, k4] = FL.link;

  // ---- the north block. Its street face (the 2013-14 photograph): a pier with a downpipe, three recessed balconies
  // with concrete edges one over another, the blank brick block with the boarded store doors, the number and a globe
  // light; over the store doors a lean-to canopy of ribbed sheet on two posts (the 2026 street picture)
  onFace(B, nNE, nNW, (len) => {
    const r0 = 0.75, r1 = 2.95, deep = 1.2, tiers = [[0.95, 2.7], [3.7, 5.4], [6.4, 7.95]];
    B.face(BRICK, rectPts(0, 0, len, top), tiers.map(([y0, y1]) => rectPts(r0, y0, r1, y1)));
    tiers.forEach(([y0, y1], f) => {
      strip(B, CONC, r0, y1 - L.slab, r1, y1);
      B.reveal(BRICK, rectPts(r0, y0, r1, y1 - L.slab), 0, -deep);
      strip(B, 'wwFlatD', r0, y0, r1, y1 - L.slab, -deep);
      flatWin(B, r0 + 0.4, y0 + 0.3, r1 - 0.4, y1 - L.slab - 0.2, BROWN, 3, f, -deep + 0.014);
    });
    strip(B, 'wwStain', 3.55, 0.25, 5.15, 1.75, 0.02); strip(B, DARK, 4.34, 0.25, 4.36, 1.75, 0.034);      // the store's boarded doors
    B.boxXZ(CONC, 3.45, 5.25, 0, 0.22, 0, 0.32, {});
    strip(B, DARK, 3.1, 2.0, 3.42, 2.2, 0.014); digits(B, 'white', '42', 3.14, 2.035, 0.13, 0.028);      // "42" (the photograph)
    B.cyl('lampGlass', r1 + 0.13, 2.3, 0.13, 0.1, 0.19, 6, true);
    B.boxXZ('grey', 0.33, 0.41, 0.1, top, 0.02, 0.1, { top: false });
    { const c0 = 3.3, c1 = 5.75, d = 1.3, ya = 2.62, yb = 2.3;      // the canopy
      B.poly('wwSheet', [[c0, ya, 0.01], [c1, ya, 0.01], [c1, yb, d], [c0, yb, d]], [0, 1, 0.2]); B.poly('wwSheet', [[c0, ya - 0.03, 0.01], [c1, ya - 0.03, 0.01], [c1, yb - 0.03, d], [c0, yb - 0.03, d]], [0, -1, -0.2]);
      B.boxXZ('wwFence', c0, c1, yb - 0.11, yb - 0.03, d - 0.08, d, { bottom: true });
      for (const x of [c0 + 0.05, c1 - 0.05]) B.boxXZ('wwFence', x - 0.04, x + 0.04, 0, yb - 0.11, d - 0.09, d - 0.01, { top: false }); }
  });
  face(nSW, nSE, bays([1.7, 4.6]));
  face(nSE, nNE);                                                   // the party wall against the terrace
  face(nNW, nSW);
  pyramid(B, 'wwSlate', FL.nbRing, top, L.apexN, { fascia: DARK });

  // ---- the south block (no picture of its walls: plain bays of windows, a guess)
  face(sSW, sSE, bays([1.7, 4.9]));
  face(sSE, sNE, bays([2.2, 6.5]));
  face(sNE, sNW);
  face(sNW, sSW, bays([2.2, 6.5]));
  pyramid(B, 'wwSlate', FL.sbRing, top, L.apexS, { fascia: DARK });

  // ---- the link. Its street face, set back (the 2026 street picture): on each floor a strip of three lights at the
  // head with a tall light at its west end, brown frames; a grey downpipe. The entrance on the car park side is a guess
  face(k3, k4, [0, 1, 2].flatMap((f) => [bw(0.45, 1.8 + f * L.storey, 1.9, 2.2 + f * L.storey, f, 3), bw(2.04, 0.93 + f * L.storey, 2.62, 2.2 + f * L.storey, f, 1)]), () => B.boxXZ('grey', 0.3, 0.38, 0.1, top, 0.02, 0.1, { top: false }));
  face(k4, k1, [sash(3.6, 1, 1.0), sash(3.6, 2, 1.0)], () => { strip(B, DARK, 1.0, 0, 2.5, 2.25, 0.012); B.unit('doorDark', rectPts(1.2, 0.03, 2.3, 2.1), 0.026); strip(B, CONC, 0.9, 2.25, 2.6, 2.42, 0.012); });
  face(sNE, nSW);
  B.flat('wwDeck', FL.link, L.link);

  for (const [r, h] of [[FL.nbRing, L.apexN], [FL.sbRing, L.apexS], [FL.link, top]]) { const sg = col.addPolygon(r, { tag: 'building' }); if (sg) for (const q of sg) q.h = h; }
  // a wheelie bin by the balconies (the photograph)
  bin(B, col, FL.FN.pt(1.7, 0.55), FL.FN);
}

/** a wheelie bin standing at p, square to the frame F */
function bin(B, col, p, F, key = DARK) {
  B.push(mk(p, [p[0] + F.ux, p[1] + F.uz]).mat());
  B.boxXZ(key, -0.28, 0.28, 0.06, 1.0, -0.35, 0.35, { top: false }); B.boxXZ(key, -0.3, 0.3, 1.0, 1.07, -0.38, 0.37, { bottom: true });
  B.pop();
  col.addCircle(p[0], p[1], 0.36, { tag: 'furniture', low: true });
}

// ================================================================= Gate 4
// The 2013 elevation and the 2026 street pictures, south to north across the end of the street: the black sliding gate
// and railings to the flats' car park; the grey pedestrian door with its dark notice in a flat-topped red-brick
// surround; a banded pier; the tall pair of grey boarded gates with a concave top and the "4" plate; a pier; then the
// red wall along the street's north side: low (bicycles lean on it), a banded pier, a swept rise, and the tall stretch
// with the yard's grey boarded doors. All shut.
export function buildGate4(game, B) {
  const L = LV.gate, G = G4, col = game.worldCollider, GATE = 'wwGate';
  const seg = (a, b, h) => { const s = col.addSegment(a[0], a[1], b[0], b[1], { tag: 'gate' }); if (s) s.h = h; };
  const cope = (x0, x1, y, z0, z1) => B.boxXZ(RED, x0, x1, y, y + 0.08, z0 - 0.03, z1 + 0.03, { bottom: true });
  B.push(G.F.mat());      // x north along the line, z out to the street
  const mid = (q) => (q[0] + q[1]) / 2, P = (q, wd) => pier(B, mid(q), 0, wd, L.pier, { key: RED, band: BUFF, bands: L.bands, plinth: L.plinth, cap: L.cap });
  P(G.pierB, 0.6); P(G.pierC, 0.6);
  // the door in its surround
  { const [x0, x1] = G.panel, [d0, d1] = G.door, t = 0.17, out = [[x0, 0], [d0, 0], [d0, L.door], [d1, L.door], [d1, 0], [x1, 0], [x1, L.panel], [x0, L.panel]];
    B.face(RED, out, [], t); B.face(RED, out, [], -t, true); B.reveal(RED, rectPts(d0, 0, d1, L.door), t, -t, true);
    B.poly(RED, [[x0, 0, -t], [x0, 0, t], [x0, L.panel, t], [x0, L.panel, -t]], [-1, 0, 0]);
    cope(x0 - 0.03, x1, L.panel, -t, t);
    strip(B, GATE, d0, 0.03, d1, L.door, 0.03); flip(B, GATE, d0, 0.03, d1, L.door, -0.03);
    strip(B, DARK, d0 + 0.33, 1.42, d0 + 0.62, 1.78, 0.045); }      // the dark notice on it
  // the pair of gates: high at the hinges, sweeping down to the meeting stiles
  { const [x0, x1] = G.gates, xm = mid(G.gates), n = 8, y = (f) => L.leafMid + (L.leafHinge - L.leafMid) * (1 - f) * (1 - f);
    for (const [xh, s] of [[x0 + 0.03, 1], [x1 - 0.03, -1]]) {
      const w = Math.abs(xm - xh) - 0.012, topPts = Array.from({ length: n + 1 }, (_, i) => [xh + s * w * (i / n), y(i / n)]);
      const out = s > 0 ? [[xh, 0.07], [xh + w, 0.07], ...topPts.slice().reverse()] : [[xh - w, 0.07], [xh, 0.07], ...topPts];
      B.face(GATE, out, [], 0.03); B.face(GATE, out, [], -0.03, true);
      for (let i = 0; i < n; i++) { const a = topPts[i], b = topPts[i + 1]; B.poly(GATE, [[a[0], a[1], -0.03], [b[0], b[1], -0.03], [b[0], b[1], 0.03], [a[0], a[1], 0.03]], [0, 1, 0]); }
    }
    strip(B, DARK, xm - 0.42, 1.02, xm + 0.42, 1.1, 0.045);      // the bar across the stiles
    strip(B, DARK, x0 + 0.14, 2.1, x0 + 0.4, 2.36, 0.045); digits(B, 'white', '4', x0 + 0.215, 2.15, 0.16, 0.06); }      // the "4" plate at the south leaf's top corner
  // the wall's short return from the north pier to the corner
  { const [x0, x1] = G.stub; B.boxXZ(RED, x0, x1 + 0.165, 0, L.lowWall, -0.165, 0.165, { top: false }); cope(x0, x1 + 0.165, L.lowWall, -0.165, 0.165); bands(B, BUFF, x0, x1, [L.wallBand], [], 0.18); }
  B.pop();
  seg(G.F.pt(0, 0), G.F.pt(G.stub[1], 0), L.pier);
  // ---- the red wall along the street: the low stretch
  const t = 0.33;
  onFace(B, NW.A.o, NW.B.o, (len) => { B.boxXZ(RED, 0, len, 0, L.lowWall, -t, 0, { top: false }); cope(0, len, L.lowWall, -t, 0); bands(B, BUFF, 0, len, [L.wallBand]); });
  onFace(B, NW.B.o, NW.end, (len) => {
    const [p0, p1] = NW.pier, r1 = p1 + NW.rise, [d0, d1] = NW.doors, dh = L.yardGate, n = 6;
    B.boxXZ(RED, 0, p0, 0, L.lowWall, -t, 0, { top: false }); cope(0, p0, L.lowWall, -t, 0); bands(B, BUFF, 0, p0, [L.wallBand]);
    pier(B, (p0 + p1) / 2, -t / 2, p1 - p0, L.pier, { key: RED, band: BUFF, bands: L.bands, plinth: L.plinth, cap: L.cap });
    // the swept rise and the tall stretch with the yard's doors
    const sweep = Array.from({ length: n + 1 }, (_, i) => [p1 + NW.rise * (i / n), L.lowWall + (L.tallWall - L.lowWall) * Math.sin((i / n) * Math.PI / 2)]);
    const out = [[p1, 0], [d0, 0], [d0, dh], [d1, dh], [d1, 0], [len, 0], [len, L.tallWall], ...sweep.slice().reverse()];
    B.face(RED, out); B.face(RED, out, [], -t, true); B.reveal(RED, rectPts(d0, 0, d1, dh), 0, -t, true);
    for (let i = 0; i < n; i++) { const a = sweep[i], b = sweep[i + 1]; B.poly(RED, [[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], -t], [a[0], a[1], -t]], [0, 1, 0]); }
    cope(r1, len, L.tallWall, -t, 0); B.poly(RED, [[len, 0, 0], [len, 0, -t], [len, L.tallWall, -t], [len, L.tallWall, 0]], [1, 0, 0]);
    bands(B, BUFF, p1, len, [L.wallBand], [[d0, d1]]);
    const dm = (d0 + d1) / 2;      // the doors: a grey boarded pair with black strap hinges, a white notice
    for (const [a, b] of [[d0 + 0.02, dm - 0.006], [dm + 0.006, d1 - 0.02]]) { strip(B, GATE, a, 0.05, b, dh - 0.02, -0.1); flip(B, GATE, a, 0.05, b, dh - 0.02, -0.16); }
    for (const yy of [0.45, 1.85]) { strip(B, DARK, d0 + 0.02, yy, d0 + 0.5, yy + 0.05, -0.085); strip(B, DARK, d1 - 0.5, yy, d1 - 0.02, yy + 0.05, -0.085); }
    strip(B, DARK, dm - 0.3, 1.15, dm + 0.3, 1.22, -0.085); strip(B, 'white', d0 + 0.32, 1.3, d0 + 0.55, 1.6, -0.085);
  });
  seg(NW.A.o, NW.B.o, L.lowWall); seg(NW.B.o, NW.end, L.tallWall);
  // two bins by the north pier (the photographs)
  bin(B, col, G.F.pt(7.35, 0.62), G.F, 'grey'); bin(B, col, G.F.pt(7.98, 0.66), G.F);

  // ---- the sliding gate (the 3.9 m next the door's surround) and the fixed railings: black upright bars between rails
  B.push(SG.F.mat());
  { const len = SG.len, g0 = len - SG.gate, h = L.palisade, step = 0.11, K = 'iron';
    const run = (x0, x1, z) => {
      const n = Math.max(1, Math.round((x1 - x0) / step));
      for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; both(B, K, x - 0.013, 0.1, x + 0.013, h - 0.04, z); }
      for (const yy of [0.12, 1.0, h - 0.04]) B.boxXZ(K, x0, x1, yy - 0.025, yy + 0.025, z - 0.045, z - 0.012, { bottom: true });
    };
    run(0.12, g0 - 0.1, 0); run(g0 + 0.08, len - 0.05, -0.14);
    for (const x of [0.04, g0 - 0.02]) B.boxXZ(K, x - 0.05, x + 0.05, 0, h + 0.05, -0.06, 0.06, {});
    B.boxXZ(K, g0 - 3.6, len - 0.05, 0.02, 0.07, -0.17, -0.11, {}); }      // the gate's track
  B.pop();
  seg(SG.F.pt(0, 0), SG.F.pt(SG.len, 0), L.palisade);
}

// ================================================================= the bicycles against the red wall
// Props, not vehicles: two thin wheels, four frame tubes, saddle and bars each, leaning on the wall's street face. The
// two that stand along the wall are drawn on their street side only (the wall is behind them); the one standing nose-in
// is seen from both sides.
export function buildBikes(game, B) {
  const col = game.worldCollider, R = 0.34, RI = 0.285, AX = 0.52, N = 8;
  for (const b of BIKES) {
    const F = b.leg === 'A' ? NW.A : NW.B;
    let P, hint;
    if (b.turn === undefined) { const c = Math.cos(b.lean), s = Math.sin(b.lean); P = (u, v, w = 0) => [b.x + u, v * c + w * s, b.z - v * s + w * c]; hint = [0, s, c]; }
    else { const dx = Math.cos(b.turn), dz = -Math.sin(b.turn), nx = -dz, nz = dx, sl = 0.07; P = (u, v, w = 0) => [b.x + u * dx + (w - v * sl) * nx, v, b.z + u * dz + (w - v * sl) * nz]; hint = [nx, 0.07, nz]; }
    B.push(F.mat());
    for (const sg of b.turn === undefined ? [1] : [1, -1]) {
      const h = [hint[0] * sg, hint[1], hint[2] * sg], q = (key, pts) => B.poly(key, pts, h), o = sg * 0.012;
      for (const cx of [-AX, AX]) for (let i = 0; i < N; i++) { const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2; q('wwDark', [P(cx + Math.cos(a0) * R, R + Math.sin(a0) * R), P(cx + Math.cos(a1) * R, R + Math.sin(a1) * R), P(cx + Math.cos(a1) * RI, R + Math.sin(a1) * RI), P(cx + Math.cos(a0) * RI, R + Math.sin(a0) * RI)]); }
      const tube = (a, c2) => { const l = Math.hypot(c2[0] - a[0], c2[1] - a[1]), n = [(-(c2[1] - a[1]) / l) * 0.018, ((c2[0] - a[0]) / l) * 0.018]; q(b.frame, [P(a[0] - n[0], a[1] - n[1], o), P(c2[0] - n[0], c2[1] - n[1], o), P(c2[0] + n[0], c2[1] + n[1], o), P(a[0] + n[0], a[1] + n[1], o)]); };
      tube([-0.08, 0.3], [-0.22, 0.92]); tube([-0.08, 0.3], [0.4, 0.74]); tube([-AX, R], [-0.08, 0.3]); tube([AX, R], [0.36, 1.0]);      // seat tube, down tube, chain stay, fork and head
      q('dark', [P(-0.35, 0.9, o), P(-0.1, 0.9, o), P(-0.1, 0.95, o), P(-0.35, 0.95, o)]);      // the saddle's side
      if (sg > 0) { B.poly('dark', [P(-0.35, 0.95, -0.07), P(-0.1, 0.95, -0.07), P(-0.1, 0.95, 0.07), P(-0.35, 0.95, 0.07)], [0, 1, 0]);      // its top, the bars
        B.poly('wwDark', [P(0.33, 1.0, -0.27), P(0.38, 1.02, -0.27), P(0.38, 1.02, 0.27), P(0.33, 1.0, 0.27)], [0, 1, 0]); }
    }
    if (b.basket) { const u0 = 0.42, u1 = 0.7, v0 = 0.78, v1 = 1.0, w = 0.17; B.poly('wwFence', [P(u0, v0, w), P(u1, v0, w), P(u1, v1, w), P(u0, v1, w)], hint); B.poly('wwFence', [P(u1, v0, -w), P(u1, v0, w), P(u1, v1, w), P(u1, v1, -w)], [1, 0, 0]); B.poly('wwFence', [P(u0, v1, -w), P(u1, v1, -w), P(u1, v1, w), P(u0, v1, w)], [0, 1, 0]); }
    if (b.pannier) { const u0 = -0.66, u1 = -0.36, v0 = 0.3, v1 = 0.72, w0 = 0.05, w1 = 0.2; B.poly('flY', [P(u0, v0, w1), P(u1, v0, w1), P(u1, v1, w1), P(u0, v1, w1)], hint); B.poly('flY', [P(u0, v0, w0), P(u0, v0, w1), P(u0, v1, w1), P(u0, v1, w0)], [-1, 0, 0]); B.poly('flY', [P(u0, v1, w0), P(u1, v1, w0), P(u1, v1, w1), P(u0, v1, w1)], [0, 1, 0]); }
    B.pop();
    for (const u of [-0.42, 0.42]) { const q3 = P(u, 0, 0), p = F.pt(q3[0], q3[2]); col.addCircle(p[0], p[1], 0.3, { tag: 'furniture', low: true }); }
  }
}
/** where each bicycle's middle stands on the ground (world [x, z]) */
export const bikeSpots = () => BIKES.map((b) => (b.leg === 'A' ? NW.A : NW.B).pt(b.x, b.z));

// ================================================================= round the car park
// The rubble wall with its half-round coping from the end pier (its first two metres rebuilt in brick in 2014), the gap
// that is the footway between the car park and the Canal Building, the bicycle shelter on the wall's north side, the
// sub-station, the boarded fences, the field gate to the college grounds.
export function buildYard(game, B) {
  const col = game.worldCollider, Lw = LV.wall, Ls = LV.shelter, W = WL, hw = W.t / 2;
  const seg = (F, a0, b0, a1, b1, o) => { const a = F.pt(a0, b0), b = F.pt(a1, b1); return col.addSegment(a[0], a[1], b[0], b[1], o); };
  B.push(W.F.mat());      // x west along the wall from the end pier, z north
  B.boxXZ(RED, W.brick[0], W.brick[1], 0, Lw.brick, -0.12, 0.12, { top: false }); B.boxXZ(RED, W.brick[0], W.brick[1] + 0.02, Lw.brick, Lw.brick + 0.08, -0.15, 0.15, { bottom: true });
  for (const [x0, x1] of [[W.brick[1], W.gap[0]], [W.gap[1], W.end]]) {
    B.boxXZ('rubble', x0, x1, 0, Lw.body, -hw, hw, { top: false });
    const prof = [[-hw - 0.03, Lw.body], [-hw * 0.72, Lw.body + (Lw.top - Lw.body) * 0.72], [0, Lw.top], [hw * 0.72, Lw.body + (Lw.top - Lw.body) * 0.72], [hw + 0.03, Lw.body]];      // the half-round coping
    for (let i = 0; i < prof.length - 1; i++) { const a = prof[i], b = prof[i + 1]; B.poly('stoneDress', [[x0, a[1], a[0]], [x1, a[1], a[0]], [x1, b[1], b[0]], [x0, b[1], b[0]]], [0, 1, (a[0] + b[0]) / 2]); }
    for (const [x, s] of [[x0, -1], [x1, 1]]) B.poly('stoneDress', prof.map((q) => [x, q[1], q[0]]), [s, 0, 0]);
    B.poly('stoneDress', [[x0, Lw.body, -hw - 0.03], [x1, Lw.body, -hw - 0.03], [x1, Lw.body, hw + 0.03], [x0, Lw.body, hw + 0.03]], [0, -1, 0]);
  }
  // the shelter: posts before the wall, a ribbed sheet roof over the wall's top falling to the front, hoops for the bicycles
  { const [x0, x1] = W.shelter, zb = -hw - 0.05, zf = 1.75;
    B.poly('wwSheet', [[x0, Ls.back, zb], [x1, Ls.back, zb], [x1, Ls.front, zf], [x0, Ls.front, zf]], [0, 1, 0]); B.poly('wwSheet', [[x0, Ls.back - 0.03, zb], [x1, Ls.back - 0.03, zb], [x1, Ls.front - 0.03, zf], [x0, Ls.front - 0.03, zf]], [0, -1, 0]);
    B.boxXZ(DARK, x0, x1, Ls.front - 0.1, Ls.front - 0.03, zf - 0.05, zf, { bottom: true });
    for (const x of W.posts) { B.boxXZ(DARK, x - 0.04, x + 0.04, 0, Ls.post, hw + 0.2, hw + 0.28, { top: false }); B.beam(DARK, [x, 1.55, hw + 0.24], [x, Ls.front - 0.06, 1.35], 0.04); }
    for (let x = x0 + 1.1; x < x1 - 0.5; x += 1.75) { for (const z of [0.72, 1.42]) B.boxXZ(GALV, x - 0.02, x + 0.02, 0, 0.78, z - 0.02, z + 0.02, { top: false }); B.boxXZ(GALV, x - 0.02, x + 0.02, 0.78, 0.82, 0.7, 1.44, { bottom: true }); } }
  // the sub-station: a brick-walled yard against the wall's south side, a green kiosk in it
  { const E = W.ess, h = LV.ess.wall;
    B.boxXZ(RED, E.a0, E.a0 + 0.22, 0, h, E.b0, -hw, { top: true }); B.boxXZ(RED, E.a1 - 0.22, E.a1, 0, h, E.b0, -hw, { top: true }); B.boxXZ(RED, E.a0 + 0.22, E.a1 - 0.22, 0, h, E.b0, E.b0 + 0.22, { top: true });
    B.poly('wwEss', [[E.a0 - 0.012, 0.05, -1.3], [E.a0 - 0.012, 0.05, -2.9], [E.a0 - 0.012, 1.9, -2.9], [E.a0 - 0.012, 1.9, -1.3]], [-1, 0, 0]);      // its doors, to the car park
    B.boxXZ('wwEss', E.a0 + 0.8, E.a1 - 0.7, 0, LV.ess.kiosk, E.b0 + 0.9, -hw - 0.8, {}); }
  B.pop();
  for (const [x0, x1] of [[W.brick[0], W.gap[0]], [W.gap[1], W.end]]) { const s = seg(W.F, x0, 0, x1, 0, { tag: 'wall' }); if (s) s.h = Lw.top; }
  for (const x of W.posts) { const p = W.F.pt(x, hw + 0.24); col.addCircle(p[0], p[1], 0.06, { tag: 'furniture' }); }
  { const E = W.ess, sg = col.addPolygon([W.F.pt(E.a0, -hw), W.F.pt(E.a1, -hw), W.F.pt(E.a1, E.b0), W.F.pt(E.a0, E.b0)], { tag: 'building' }); if (sg) for (const s of sg) s.h = LV.ess.kiosk; }

  // ---- the boarded fences of the car park's west and south sides
  for (const [a, b] of [CPK.fenceW, CPK.fenceS, CPK.fenceE]) {
    onFace(B, a, b, (len) => { B.boxXZ('wwFence', 0, len, 0, LV.fence, -0.03, 0.03, {}); for (let x = 0.05; x < len; x += 2.4) B.boxXZ('wwFence', x - 0.05, x + 0.05, 0, LV.fence + 0.06, -0.08, -0.03, {}); });
    const s = col.addSegment(a[0], a[1], b[0], b[1], { tag: 'fence' }); if (s) s.h = LV.fence;
  }
  // ---- the field gate: a pair of timber five-bar leaves standing open into the car park (a guess: that it stands open)
  { const d = [CPK.postW[0] - CPK.postE[0], CPK.postW[1] - CPK.postE[1]], l = Math.hypot(d[0], d[1]), n = [-d[1] / l, d[0] / l], h = LV.fieldGate, lw = l / 2 - 0.1;      // n: into the car park (north)
    for (const [p, s] of [[CPK.postE, 0.12], [CPK.postW, -0.12]]) {
      const q = [p[0] + n[0] * lw + (d[0] / l) * s, p[1] + n[1] * lw + (d[1] / l) * s];
      onFace(B, p, q, (len) => {
        B.boxXZ('wwFence', -0.09, 0.09, 0, h + 0.2, -0.09, 0.09, {});
        for (let i = 0; i < 5; i++) { const y = 0.14 + ((h - 0.2) * i) / 4; both(B, 'wwFence', 0.09, y, len - 0.09, y + 0.085); }
        both(B, 'wwFence', len - 0.09, 0.14, len, h + 0.03);
        for (const z of [0.02, -0.02]) B.poly('wwFence', [[0.1, 0.16, z], [0.1, 0.25, z], [len - 0.1, h - 0.03, z], [len - 0.1, h - 0.12, z]], [0, 0, z]);      // the brace, proud of the bars
      });
      col.addCircle(p[0], p[1], 0.12, { tag: 'furniture' }); const sg = col.addSegment(p[0], p[1], q[0], q[1], { tag: 'gate', low: true }); if (sg) sg.h = h;
    } }

  // ---- planting: shrubs in the car park's corner bed, tall pale grasses at the foot of the Canal Building's wall
  for (const [x, z, r] of [[-630.6, -205.2, 1.25], [-628.3, -203.3, 1.0], [-632.6, -208.2, 1.1]]) { shrub(B, 'leafC', x, z, r, 1.35, 7, 0); col.addCircle(x, z, r * 0.8, { tag: 'planter', low: true }); }
  { let k = 0; const tuft = (F, a, b) => { const p = F.pt(a, b), n = 9, s0 = k++ * 1.9;      // a clump: green blades, taller pale plumes among them
      for (let i = 0; i < n; i++) { const an = s0 + (i / n) * Math.PI * 2, dx = Math.sin(an), dz = Math.cos(an), plume = i % 2 === 0, h = plume ? 1.15 + 0.12 * ((i + k) % 3) : 0.7 + 0.1 * (i % 3), l = plume ? 0.22 : 0.38, bx = p[0] + dx * 0.1, bz = p[1] + dz * 0.1, tx = p[0] + dx * (0.1 + l), tz = p[1] + dz * (0.1 + l);
        if (plume) B.poly('wwGrass', [[bx - dz * 0.025, 0.02, bz + dx * 0.025], [bx + dz * 0.025, 0.02, bz - dx * 0.025], [tx + dz * 0.075, h, tz - dx * 0.075], [tx - dz * 0.075, h * 0.94, tz + dx * 0.075]], [dx, 0.25, dz]);
        else B.poly('leafA', [[bx - dz * 0.06, 0.02, bz + dx * 0.06], [bx + dz * 0.06, 0.02, bz - dx * 0.06], [tx, h, tz]], [dx, 0.3, dz]); } };
    for (let a = 18.2; a < CB.lenW - 0.6; a += 1.55) tuft(WF, a, 0.55); for (let a = 0.6; a < 3.4; a += 1.4) tuft(EF, a, 0.55); for (let a = 9.6; a < CB.lenE - 1; a += 1.7) tuft(EF, a, 0.6); }
}
