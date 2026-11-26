// Somerville College, STANDALONE model, part 'wolfson' (B06): the build functions. Called by somerville_wolfson.js with
// ctx.B already in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from
// _somerville_wolfson_plan.js (sources and K / G there). Inside Wolfson's own frame the Batch's x = s (south along the
// building), z = t (WEST across it). Helpers written here (not in the kit): pane (a glazed unit between two plan
// points, facing a given way), monoBlock (a block with a sloping top), wallRun (a street-wall stretch on a polyline).
import * as P from './_somerville_wolfson_plan.js';

const { BAYS, LEN, TW, BOX, FAH, COURT, WALL } = P;

// ------------------------------------------------------------------------------------------------ cells
function addCells(K, pack) {
  K.addCell(pack, 'wolfCon', 'lead', 0xb0ada4);      // the smooth grey precast frame (columns, beams, boxes)
  K.addCell(pack, 'wolfSpar', 'lead', 0x76736c);     // the Derbyshire spar-aggregate panels: darker, granular grey
  K.addCell(pack, 'sedum', 'lead', 0x6e6a40);        // the Hall's planted roof (brown-green)
  K.addCell(pack, 'fahCon', 'lead', 0xc9c4b7);
  K.addCell(pack, 'fahDoor', 'boards', 0xc99d62);     // the Hall's pale honey door frames (touch-up 1)
  K.addCell(pack, 'fahTimber', 'boards', 0xd9d3c6);  // the Hall's weathered (silver-grey) iroko       // the Hall's pale concrete piers and walls
}

// ------------------------------------------------------------------------------------------------ helpers
/** a glazed (or door) unit between plan points a = [x, z] and b in the CURRENT frame, y0..y1, facing `out` ([x, z]) */
function pane(K, B, key, a, b, y0, y1, out) {
  let p = a, q = b; const dx0 = b[0] - a[0], dz0 = b[1] - a[1];
  if (-dz0 * out[0] + dx0 * out[1] < 0) { p = b; q = a; }
  const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
  B.push(K.frame(p[0], 0, p[1], dx, dz)); B.unit(key, K.rectPts(0, y0, L, y1), 0, K.nextBay(y0)); B.pop();
}
/** a block over x s0..s1, z t0..t1 from y0 up to a top sloping from ya (at s0) to yb (at s1); o.bottom: underside key */
function monoBlock(B, key, s0, s1, t0, t1, y0, ya, yb, o = {}) {
  B.poly(key, [[s0, y0, t0], [s0, y0, t1], [s0, ya, t1], [s0, ya, t0]], [-1, 0, 0]);
  B.poly(key, [[s1, y0, t0], [s1, y0, t1], [s1, yb, t1], [s1, yb, t0]], [1, 0, 0]);
  B.poly(key, [[s0, y0, t0], [s1, y0, t0], [s1, yb, t0], [s0, ya, t0]], [0, 0, -1]);
  B.poly(key, [[s0, y0, t1], [s1, y0, t1], [s1, yb, t1], [s0, ya, t1]], [0, 0, 1]);
  const c = o.coping || 'bathDress', e = 0.06;
  B.poly(c, [[s0 - e, ya + 0.08, t0 - e], [s1 + e, yb + 0.08, t0 - e], [s1 + e, yb + 0.08, t1 + e], [s0 - e, ya + 0.08, t1 + e]], [0, 1, 0]);
  B.poly(c, [[s0 - e, ya, t0 - e], [s1 + e, yb, t0 - e], [s1 + e, yb + 0.08, t0 - e], [s0 - e, ya + 0.08, t0 - e]], [0, 0, -1]);
  B.poly(c, [[s0 - e, ya, t1 + e], [s1 + e, yb, t1 + e], [s1 + e, yb + 0.08, t1 + e], [s0 - e, ya + 0.08, t1 + e]], [0, 0, 1]);
  B.poly(c, [[s0 - e, ya, t0 - e], [s0 - e, ya, t1 + e], [s0 - e, ya + 0.08, t1 + e], [s0 - e, ya + 0.08, t0 - e]], [-1, 0, 0]);
  B.poly(c, [[s1 + e, yb, t0 - e], [s1 + e, yb, t1 + e], [s1 + e, yb + 0.08, t1 + e], [s1 + e, yb + 0.08, t0 - e]], [1, 0, 0]);
  if (o.bottom) B.poly(o.bottom, [[s0, y0, t0], [s1, y0, t0], [s1, y0, t1], [s0, y0, t1]], [0, -1, 0]);
}

// ------------------------------------------------------------------------------------------------ Wolfson
/** one face's frame: side -1 = east (slab line t 0, out -t), +1 = west (slab line t TW, out +t). Z(d): t at d out */
const face = (side) => ({ side, Z: (d) => (side < 0 ? -d : TW + d) });

function buildBox(K, B, f, c, T) {
  const { Z, side } = f, h = BOX.half, pr = BOX.proj, out = [0, side];
  const gTop = T - BOX.head, gBot = gTop - BOX.glass;
  B.box('wolfCon', c, T - BOX.head / 2, Z(pr / 2), 2 * h, BOX.head, pr);                                   // precast head
  B.box('leadDark', c, T + 0.015, Z(pr / 2 + 0.02), 2 * h + 0.06, 0.03, pr + 0.06);                          // lead weathering
  B.box('wolfCon', c, gBot - BOX.sill / 2, Z(pr / 2), 2 * h, BOX.sill, pr, 0, { bottom: true });            // sill
  const sb = gBot - BOX.sill;                                                                                // the seat's splayed underside
  B.poly('wolfCon', [[c - h, sb, Z(pr)], [c + h, sb, Z(pr)], [c + h - BOX.soffitIn, sb - BOX.soffit, Z(BOX.soffitBack)], [c - h + BOX.soffitIn, sb - BOX.soffit, Z(BOX.soffitBack)]], [0, -0.6, side]);
  B.poly('wolfCon', [[c - h + BOX.soffitIn, sb - BOX.soffit, Z(BOX.soffitBack)], [c + h - BOX.soffitIn, sb - BOX.soffit, Z(BOX.soffitBack)], [c + h - BOX.soffitIn, sb - BOX.soffit, Z(0)], [c - h + BOX.soffitIn, sb - BOX.soffit, Z(0)]], [0, -1, 0]);
  for (const sg of [-1, 1]) B.poly('wolfCon', [[c + sg * h, sb, Z(0)], [c + sg * h, sb, Z(pr)], [c + sg * (h - BOX.soffitIn), sb - BOX.soffit, Z(BOX.soffitBack)], [c + sg * (h - BOX.soffitIn), sb - BOX.soffit, Z(0)]], [sg, -0.3, 0]);
  // the big pane and its returns
  pane(K, B, 'glassDark', [c - h + 0.05, Z(pr - 0.03)], [c + h - 0.05, Z(pr - 0.03)], gBot, gTop, out);
  for (const sg of [-1, 1]) pane(K, B, 'glassDark', [c + sg * (h - 0.02), Z(0.06)], [c + sg * (h - 0.02), Z(pr - 0.06)], gBot, gTop, [sg, 0]);
  // dark frames
  for (const sg of [-1, 1]) B.box('frame', c + sg * (h - 0.04), (gBot + gTop) / 2, Z(pr - 0.04), 0.08, BOX.glass, 0.08, 0, { top: false });
  B.box('frame', c, gTop - 0.03, Z(pr - 0.03), 2 * h, 0.06, 0.07, 0, { bottom: true });
  B.box('frame', c, gBot + 0.03, Z(pr - 0.03), 2 * h, 0.06, 0.07);
}

function buildFace(K, B, side) {
  const f = face(side), { Z } = f;
  // columns, full height from the foot to the posts over the roof (two to a box)
  for (const c of BAYS) for (const sg of [-1, 1]) B.box('wolfCon', c + sg * P.MOD / 2, (P.FOOT + P.POST) / 2, Z((P.COLD - 0.3) / 2), P.COLW, P.POST - P.FOOT, P.COLD + 0.3, 0, { bottom: false });
  // floor beams across the whole face at each tier, the roof's edge beam
  for (const T of BOX.tops) B.box('wolfCon', LEN / 2, P.BEAM_Y(T), Z(0.05), LEN, 0.2, 0.1, 0, { bottom: true });
  B.box('wolfCon', LEN / 2, P.ROOF - 0.15, Z(0.08), LEN, 0.3, 0.16, 0, { bottom: true });
  // boxes
  for (const c of BAYS) for (const T of BOX.tops) buildBox(K, B, f, c, T);
}

function buildSlab(ctx, K, B) {
  // the upper floors' body (spar panels where it shows), the roof, the soffits over the recessed ground floor
  K.prism(B, 'wolfSpar', [[0, 0], [LEN, 0], [LEN, TW], [0, TW]], P.FIRST, P.ROOF_MEMBRANE);
  B.flat('leadDark', [[0, 0], [LEN, 0], [LEN, TW], [0, TW]], P.ROOF_MEMBRANE);
  const r = P.GF_RECESS;
  B.box('wolfCon', LEN / 2, P.FIRST - 0.1, TW - r / 2, LEN, 0.2, r, 0, { bottom: true });
  B.box('wolfCon', LEN / 2, P.FIRST - 0.1, r / 2, LEN, 0.2, r, 0, { bottom: true });
  // the ground floor: brick, recessed; windows on the west between piers
  const wops = BAYS.map((c) => ({ pts: K.rectPts(c - P.GF_WIN.half, P.GF_WIN.sill, c + P.GF_WIN.half, P.GF_WIN.head), kind: 'win', glass: 'glassDark', lights: 2, d: 0.16, mullionKey: 'frame', mullionW: 0.06, sill: false, revealKey: 'wolfCon' }));
  K.wall(B, K.frame(0, 0, TW - r, 1, 0), K.rectPts(0, P.FOOT, LEN, P.FIRST - 0.2), wops, 'brickDark');
  B.poly('brickDark', [[0, P.FOOT, r], [0, P.FOOT, TW - r], [0, P.FIRST, TW - r], [0, P.FIRST, r]], [-1, 0, 0]);
  B.poly('brickDark', [[LEN, P.FOOT, r], [LEN, P.FOOT, TW - r], [LEN, P.FIRST, TW - r], [LEN, P.FIRST, r]], [1, 0, 0]);
  B.poly('brickDark', [[0, P.FOOT, r], [LEN, P.FOOT, r], [LEN, P.FIRST, r], [0, P.FIRST, r]], [0, 0, -1]);
  // the two faces
  buildFace(K, B, -1); buildFace(K, B, 1);
  // the rooflight box: sloping glazed flanks, lead ends and top, on a precast kerb
  const L = P.LANTERN, y0 = P.ROOF_MEMBRANE + 0.2, y1 = L.top;
  B.box('wolfCon', L.s, P.ROOF_MEMBRANE + 0.1, L.t, 2 * L.hs0, 0.2, 2 * L.ht0, 0, { top: false });
  const a0 = [L.s - L.hs0, L.t - L.ht0], a1 = [L.s + L.hs0, L.t - L.ht0], a2 = [L.s + L.hs0, L.t + L.ht0], a3 = [L.s - L.hs0, L.t + L.ht0];
  const b0 = [L.s - L.hs1, L.t - L.ht1], b1 = [L.s + L.hs1, L.t - L.ht1], b2 = [L.s + L.hs1, L.t + L.ht1], b3 = [L.s - L.hs1, L.t + L.ht1];
  const V = (p, y) => [p[0], y, p[1]];
  B.poly('glassDark', [V(a0, y0), V(a1, y0), V(b1, y1), V(b0, y1)], [0, 0.6, -1]);
  B.poly('glassDark', [V(a2, y0), V(a3, y0), V(b3, y1), V(b2, y1)], [0, 0.6, 1]);
  B.poly('leadDark', [V(a1, y0), V(a2, y0), V(b2, y1), V(b1, y1)], [1, 0.3, 0]);
  B.poly('leadDark', [V(a3, y0), V(a0, y0), V(b0, y1), V(b3, y1)], [-1, 0.3, 0]);
  B.poly('leadDark', [V(b0, y1), V(b1, y1), V(b2, y1), V(b3, y1)], [0, 1, 0]);
  for (let i = 1; i < 6; i++) { const s = L.s - L.hs0 + (2 * L.hs0 * i) / 6, s2 = L.s + ((s - L.s) * L.hs1) / L.hs0; for (const sg of [-1, 1]) B.beam('frame', [s, y0, L.t + sg * L.ht0], [s2, y1, L.t + sg * L.ht1], 0.05); }
}

function buildLinks(ctx, K, B) {
  // north: the brick link against Park's south gable, the glazed stair slot against Wolfson's north end
  const N = P.NLINK, NS = P.NSLOT, S2 = P.SSLOT, SL = P.SLINK;
  monoBlock(B, 'brick', N.s0, N.s1, N.t0, N.t1, P.FOOT, N.ya, N.yb);
  K.prism(B, 'wolfCon', [[NS.s0, NS.t0], [NS.s1, NS.t0], [NS.s1, NS.t1], [NS.s0, NS.t1]], P.FOOT, NS.top, { top: true, topKey: 'leadDark' });
  slotGlass(K, B, NS, -0.95);
  // south: the glazed slot and the brick link over the open passage
  K.prism(B, 'wolfCon', [[S2.s0, S2.t0], [S2.s1, S2.t0], [S2.s1, S2.t1], [S2.s0, S2.t1]], S2.bot, S2.top, { top: true, topKey: 'leadDark', bottom: true });
  slotGlass(K, B, S2, S2.bot + 0.25);
  monoBlock(B, 'brick', SL.s0, SL.s1, SL.t0, SL.t1, SL.bot, SL.ya, SL.yb, { bottom: 'wolfCon' });
  // ... carried on over the open way to Penrose's west wing (touch-up 1), narrower: the width of Penrose's wing
  const S3 = P.SLINK2;
  monoBlock(B, 'brick', S3.s0, S3.s1, S3.t0, S3.t1, S3.bot, S3.ya, S3.yb, { bottom: 'wolfCon' });
  // the passage's concrete lintels on both faces (running on to Penrose's corner), and its soffit under the slot's ends
  for (const t of [SL.t0 - 0.1, SL.t1 + 0.1]) B.box('wolfCon', (P.PASSAGE.s0 + SL.s1) / 2, SL.bot + 0.15, t, SL.s1 - P.PASSAGE.s0, 0.3, 0.25, 0, { bottom: true });
  for (const t of [S3.t0 - 0.1, S3.t1 + 0.1]) B.box('wolfCon', (S3.s0 + S3.s1) / 2, S3.bot + 0.15, t, S3.s1 - S3.s0, 0.3, 0.25, 0, { bottom: true });
  B.box('wolfCon', (S2.s0 + S2.s1) / 2, S2.bot - 0.1, (SL.t0 + S2.t0) / 2, S2.s1 - S2.s0, 0.2, S2.t0 - SL.t0, 0, { bottom: true });
  B.box('wolfCon', (S2.s0 + S2.s1) / 2, S2.bot - 0.1, (SL.t1 + S2.t1) / 2, S2.s1 - S2.s0, 0.2, SL.t1 - S2.t1, 0, { bottom: true });
}
/** the stair slot's glazing on its east and west faces, floor by floor */
function slotGlass(K, B, Sl, yStart) {
  const bands = [[yStart, P.FIRST - 0.25], [P.FIRST + 0.1, 4.45], [4.65, 7.27], [7.47, Sl.top - 0.3]];
  for (const [y0, y1] of bands) {
    if (y1 - y0 < 0.4) continue;
    pane(K, B, 'glassDark', [Sl.s0 + 0.08, Sl.t0 - 0.02], [Sl.s1 - 0.08, Sl.t0 - 0.02], y0, y1, [0, -1]);
    pane(K, B, 'glassDark', [Sl.s0 + 0.08, Sl.t1 + 0.02], [Sl.s1 - 0.08, Sl.t1 + 0.02], y0, y1, [0, 1]);
  }
}

// ------------------------------------------------------------------------------------------------ the Flora Anderson Hall
function buildHall(ctx, K, B) {
  const H = FAH, gT = H.glassT, F = H.floor, gB = F + H.upstand, gTop = H.glassTop, D = H.door;
  // roof: deck with the paved rim, the sedum bed, the timber edge, the pergola beam ends
  B.box('fahTimber', (H.r0 + H.r1) / 2, (H.deckBot + H.deck) / 2, (0.3 + H.roofT) / 2, H.r1 - H.r0, H.deck - H.deckBot, 0.3 - H.roofT, 0, { top: false, bottom: true });
  B.flat('pavingSolid', [[H.r0, H.roofT], [H.r1, H.roofT], [H.r1, 0.3], [H.r0, 0.3]], H.deck);
  const sd = [[H.r0 + 0.4, H.sedumT], [H.r1 - 0.4, H.sedumT], [H.r1 - 0.4, 0.0], [H.r0 + 0.4, 0.0]];
  K.prism(B, 'fahCon', sd, H.deck, H.roof - 0.03);
  B.flat('sedum', sd, H.roof);
  for (let s = H.r0 + 0.3; s <= H.r1 - 0.2; s += H.beams) B.box('fahTimber', s, H.deckBot + 0.16, (gT + H.beamT) / 2, 0.22, 0.32, gT - H.beamT, 0, { bottom: true });
  // the louvre units hung between beam ends over the clerestory: thin fins slanting in ELEVATION (the striped units of
  // the Street View 2015 look; touch-up 1: they were turned in plan), each a slat 0.3 deep (t) drawn both ways
  const ly0 = H.fasciaTop + 0.03, ly1 = H.deckBot - 0.06, run = ly1 - ly0, ta = gT - 0.70, tb = gT - 0.40;
  for (const k of H.louvres) {
    const sa = H.r0 + 0.3 + k * H.beams, sb = sa + H.beams;
    for (let s = sa + 0.12; s + run < sb - 0.1; s += FAH.finPitch) {
      const a = [s, ly0], b = [s + run, ly1];
      B.poly('fahTimber', [[a[0], a[1], ta], [b[0], b[1], ta], [b[0], b[1], tb], [a[0], a[1], tb]], [1, -1, 0]);
      B.poly('fahTimber', [[a[0], a[1], tb], [b[0], b[1], tb], [b[0], b[1], ta], [a[0], a[1], ta]], [-1, 1, 0]);
    }
    B.box('fahTimber', (sa + sb) / 2, H.deckBot - 0.03, (ta + tb) / 2, sb - sa, 0.06, 0.32);
    B.box('fahTimber', (sa + sb) / 2, H.fasciaTop + 0.015, (ta + tb) / 2, sb - sa, 0.03, 0.32, 0, { bottom: true });
  }
  // the east front: upstand, glass between timber posts, the door in its concrete surround, the deep fascia, clerestory
  const s0 = H.s0, s1 = H.s1, dA = D.s - D.half - D.pier, dB = D.s + D.half + D.pier;
  B.box('fahCon', (s0 + s1) / 2, (F - 0.4 + gB) / 2, gT + 0.1, s1 - s0, gB - F + 0.4, 0.2);
  const posts = [...H.mullions, s1].filter((s) => s >= s0).sort((a, b) => a - b), cuts = [s0, ...posts.filter((s) => s > s0 && s < s1), s1];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1];
    const parts = a < dA && b > dB ? [[a, dA], [dB, b]] : b <= dA || a >= dB ? [[a, b]] : a < dA ? [[a, dA]] : b > dB ? [[dB, b]] : [];
    for (const [p, q] of parts) if (q - p > 0.2) pane(K, B, 'glassDark', [p + 0.05, gT + 0.02], [q - 0.05, gT + 0.02], gB, gTop, [0, -1]);
  }
  for (const s of cuts) if (s < dA || s > dB) B.box('fahTimber', s, (gB + gTop) / 2, gT, 0.1, gTop - gB, 0.14);
  B.box('fahCon', dA + D.pier / 2, (F + H.fasciaTop) / 2, gT - D.proj / 2 + 0.05, D.pier, H.fasciaTop - F, D.proj + 0.1);
  B.box('fahCon', dB - D.pier / 2, (F + H.fasciaTop) / 2, gT - D.proj / 2 + 0.05, D.pier, H.fasciaTop - F, D.proj + 0.1);
  // the pair of doors: PALE (honey) timber frames round full-height glass (touch-up 1: they drew as dark boarded doors).
  // K: Street View 2015, A Gast 2019, NMLA 2013 (the frame's members G)
  const dt = gT - 0.1, fr = FAH.doorFrame;
  for (const [a, b] of [[D.s - D.half, D.s], [D.s, D.s + D.half]]) {
    pane(K, B, 'glassDark', [a + fr.stile, dt + 0.01], [b - fr.stile, dt + 0.01], F + fr.bottom, gTop - fr.top, [0, -1]);
    for (const x of [a + fr.stile / 2, b - fr.stile / 2]) B.box('fahDoor', x, (F + gTop) / 2, dt, fr.stile, gTop - F, 0.06, 0, {});
    B.box('fahDoor', (a + b) / 2, gTop - fr.top / 2, dt, b - a - 2 * fr.stile, fr.top, 0.06, 0, {});
    B.box('fahDoor', (a + b) / 2, F + fr.bottom / 2, dt, b - a - 2 * fr.stile, fr.bottom, 0.06, 0, {});
    B.box('ironBlack', (a + b) / 2 + (a < D.s ? 0.28 : -0.28), F + 1.05, dt - 0.06, 0.03, 0.6, 0.03, 0, {});      // pull handles
  }
  B.box('fahCon', D.s, F + 0.03, gT - 0.2, 2 * D.half, 0.06, 0.4);
  B.box('fahTimber', (s0 + s1) / 2, (gTop + H.fasciaTop) / 2, gT - 0.08, s1 - s0 + 0.2, H.fasciaTop - gTop, 0.22, 0, { bottom: true });
  pane(K, B, 'glassDark', [s0 + 0.1, gT + 0.12], [s1 - 0.1, gT + 0.12], H.fasciaTop, H.deckBot, [0, -1]);
  // ends: north glazed over a concrete upstand, south concrete with a clerestory strip and glazing at its west end
  const nUp = -0.95;
  B.box('fahCon', s0 - 0.1, (F - 0.4 + nUp) / 2, (gT + 0.3) / 2, 0.2, nUp - F + 0.4, 0.3 - gT);
  for (let t = gT; t < -0.3; t += 2.25) { const t1 = Math.min(-0.3, t + 2.25); pane(K, B, 'glassDark', [s0 - 0.02, t + 0.05], [s0 - 0.02, t1 - 0.05], nUp, gTop, [-1, 0]); B.box('fahTimber', s0, (nUp + gTop) / 2, t, 0.14, gTop - nUp, 0.1); }
  B.box('fahTimber', s0 - 0.08, (gTop + H.fasciaTop) / 2, (gT + 0.3) / 2, 0.22, H.fasciaTop - gTop, 0.3 - gT);
  pane(K, B, 'glassDark', [s0 - 0.02, gT + 0.1], [s0 - 0.02, -0.2], H.fasciaTop, H.deckBot, [-1, 0]);
  const SS = H.southSolid;
  B.box('fahCon', s1 + 0.1, (F - 0.4 + SS.top) / 2, (SS.t0 + SS.t1) / 2, 0.2, SS.top - F + 0.4, SS.t1 - SS.t0);
  pane(K, B, 'glassDark', [s1 + 0.02, SS.t0 + 0.05], [s1 + 0.02, SS.t1], SS.top, gTop, [1, 0]);
  B.box('fahCon', s1 + 0.1, (F - 0.4 + gB) / 2, (SS.t1 + 0.3) / 2, 0.2, gB - F + 0.4, 0.3 - SS.t1);
  pane(K, B, 'glassDark', [s1 + 0.02, SS.t1 + 0.05], [s1 + 0.02, -0.2], gB, gTop, [1, 0]);
  B.box('fahTimber', s1 + 0.08, (gTop + H.fasciaTop) / 2, (gT + 0.3) / 2, 0.22, H.fasciaTop - gTop, 0.3 - gT);
  pane(K, B, 'glassDark', [s1 + 0.02, gT + 0.1], [s1 + 0.02, -0.2], H.fasciaTop, H.deckBot, [1, 0]);
  // the south-east corner pier under the overhang
  B.box('fahCon', H.r1 - 0.2, (F - 0.4 + H.deckBot) / 2, gT - 0.18, 0.35, H.deckBot - F + 0.4, 0.35);
}

// ------------------------------------------------------------------------------------------------ ground at its walls
function buildCourt(ctx, K, B, WF) {
  const { G, S } = ctx, C = COURT, R = (s0, s1, t0, t1) => WF.ring([[s0, t0], [s1, t0], [s1, t1], [s0, t1]]);
  const st = C.strip, sp = C.steps;
  // the sunk strip at the glass and its ramp (the surveyed surface itself falls 0.8 m here), the bed north of the door
  G.drape(B, 'paving', R(st.s0, st.s1, st.t0, st.t1), 0.08);
  G.drape(B, 'flowerbed', R(C.bedFront.s0, C.bedFront.s1, st.t0, st.t1), 0.07);
  G.drape(B, 'flowerbed', R(FAH.s0, sp.s0, C.bed.t0, C.bed.t1), 0.07);
  G.drape(B, 'flowerbed', R(sp.s1, st.s1, C.bed.t0, C.bed.t1), 0.07);
  // steps up east from the door's strip to the forecourt, the paved way on to the Quad's cross path
  const yLo = WF.groundY((sp.s0 + sp.s1) / 2, sp.t0) + 0.08, yHi = WF.groundY((sp.s0 + sp.s1) / 2, sp.t1) + 0.08;
  const n = Math.max(1, Math.round((yHi - yLo) / 0.16)), rise = (yHi - yLo) / n, going = (sp.t0 - sp.t1) / n;
  G.drape(B, 'paving', R(sp.s0, sp.s1, sp.t1, C.path.t1), 0.08);
  B.push(WF.M);
  if (yHi - yLo > 0.06) K.steps(B, 'pavingSolid', sp.s0, sp.s1, sp.t1, 1, n, rise, going, yHi, yLo - 0.3);
  ctx.floor(R(sp.s0, sp.s1, sp.t1, sp.t0), (u, v) => { const t = WF.P(u, v)[1], k = Math.min(n - 1, Math.max(0, Math.floor((t - sp.t1) / going))); return yHi - rise * (k + 1); });
  ctx.floor(R(st.s0, st.s1, st.t0, st.t1), (u, v) => S.groundY(u, v) + 0.08);
  ctx.floor(R(sp.s0, sp.s1, sp.t1, C.path.t1), (u, v) => S.groundY(u, v) + 0.08);
  // the ramp's handrail
  const rl = C.rail;
  for (let s = rl.s0; s <= rl.s1 + 0.01; s += 1.35) { const y = WF.groundY(s, rl.t) + 0.08; B.cyl('ironBlack', s, y, rl.t, 0.025, 0.95, 6, true); }
  for (let s = rl.s0; s < rl.s1 - 0.1; s += 1.35) { const s2 = Math.min(rl.s1, s + 1.35); B.beam('ironBlack', [s, WF.groundY(s, rl.t) + 1.0, rl.t], [s2, WF.groundY(s2, rl.t) + 1.0, rl.t], 0.045); }
  B.pop();
  // the passage from the Walton Street gate under the south link to the court
  const ps = P.PASSAGE;
  G.drape(B, 'paving', R(ps.s0 + 0.05, ps.s1, -1.5, 16.7), 0.08);
  ctx.floor(R(ps.s0 + 0.05, ps.s1, -1.5, 16.7), (u, v) => S.groundY(u, v) + 0.08);
  // the walk along the west foot and the bed under the wall
  const w = C.westWalk;
  G.drape(B, 'paving', R(P.NLINK.s0 + 0.3, ps.s0 + 0.05, w.t0, w.t1), 0.08);
  { // the bed runs to the wall's inner face (on the registered WALL_LINE)
    const a = WF.L(P.NLINK.s0 + 0.3, w.t1), b = WF.L(ps.s0 - 0.3, w.t1), inner = (v) => [streetU(v) + WALL.th, v];
    const mid = P.WALL_LINE.filter((p) => p[1] > a[1] && p[1] < b[1]).map((p) => inner(p[1])).reverse();
    G.drape(B, 'flowerbed', [a, b, inner(b[1]), ...mid, inner(a[1])], 0.06);
  }
  for (let i = 0; i < P.TREES_WEST.length; i++) { const [u, v, h] = P.TREES_WEST[i]; K.tree(B, u, v, S.groundY(u, v), h, 1.5, 41 + i); }
}

// ------------------------------------------------------------------------------------------------ the Walton Street wall
/** the street face's u at v (on WALL_LINE) */
function streetU(v) {
  const L = P.WALL_LINE;
  for (let i = 0; i < L.length - 1; i++) { const a = L[i], b = L[i + 1]; if (v <= b[1] || i === L.length - 2) { const f = (v - a[1]) / (b[1] - a[1]); return a[0] + f * (b[0] - a[0]); } }
  return L[0][0];
}
/** a straight stretch of wall from va to vb (street face on WALL_LINE), th thick (centred th/2 in from the face unless
 *  o.out pushes it out), body key up to top - coping, a coping of `cop` (null: none) */
function wallRun(ctx, B, va, vb, top, key, o = {}) {
  const { S } = ctx, th = o.th ?? WALL.th, out = o.out ?? 0;
  const a = [streetU(va), va], b = [streetU(vb), vb], du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv);
  const nu = dv / L, nv = -du / L;                // the inward normal (+u side)
  const off = th / 2 - out, cu = (a[0] + b[0]) / 2 + nu * off, cv = (a[1] + b[1]) / 2 + nv * off, ry = Math.atan2(-dv, du);
  let gmin = Infinity; for (const p of [a, b]) for (const d of [-0.5, th + 0.5]) gmin = Math.min(gmin, S.groundY(p[0] + nu * d, p[1] + nv * d));
  const y0 = gmin - 0.6, cop = o.coping === undefined ? WALL.coping : o.coping, ch = cop ? (o.copH ?? 0.12) : 0;
  B.box(key, cu, (y0 + top - ch) / 2, cv, L, top - ch - y0, th, ry, { top: !cop });
  if (cop) B.box(cop, cu, top - ch / 2, cv, L + (o.copL ?? 0), ch, th + 0.1, ry, { bottom: true });
  const ring = [[a[0] - nu * out, a[1] - nv * out], [b[0] - nu * out, b[1] - nv * out], [b[0] + nu * (th - out), b[1] + nv * (th - out)], [a[0] + nu * (th - out), a[1] + nv * (th - out)]];
  ctx.solid(ring);
  return { a, b, nu, nv, ry, cu, cv, y0, L };
}

function buildWall(ctx, K, B) {
  const W = WALL, bl = W.blocked, gt = W.gate, ash = W.ashlar, sp = W.servicePier;
  const runs = (v0, v1, top, key, o) => { const n = Math.max(1, Math.ceil((v1 - v0) / 4)); for (let i = 0; i < n; i++) wallRun(ctx, B, v0 + ((v1 - v0) * i) / n, v0 + ((v1 - v0) * (i + 1)) / n, top, key, o); };
  const pier = (v0, v1, top) => { wallRun(ctx, B, v0, v1, top, 'bathOld', { th: W.th + 0.2, out: 0.1, coping: 'bathDress', copH: 0.18, copL: 0.1 }); };
  ctx.K.addCell(ctx.pack, 'rubblePale', 'rubble', [1.12, 1.08, 0.98], { seed: 2.1 });      // the raised stretch's paler squared rubble
  runs(W.v0, bl.v0, W.top, W.key);
  pier(bl.v0, bl.v0 + bl.pier, bl.pierTop);
  wallRun(ctx, B, bl.v0 + bl.pier, bl.v1 - bl.pier, W.top, 'bathOld', { out: -0.05, th: W.th - 0.05 });      // the blocking: ashlar, set back a little
  pier(bl.v1 - bl.pier, bl.v1, bl.pierTop);
  runs(bl.v1, gt.v0, W.top, W.key);
  pier(gt.v0, gt.v0 + gt.pier, gt.pierTop);
  pier(gt.v1 - gt.pier, gt.v1, gt.pierTop);
  runs(gt.v1, ash.v0, W.topSouth, W.key);
  runs(ash.v0, ash.v1, W.topAshlar, 'rubblePale');
  pier(sp.v0, sp.v1, sp.top);
  // the gate's two railing leaves, standing open against the inner faces of the piers
  for (const [vp, dir] of [[gt.v0 + gt.pier, 1], [gt.v1 - gt.pier, -1]]) {
    const u0 = streetU(vp) + W.th + 0.05, g = ctx.S.groundY(u0, vp), w = (gt.v1 - gt.v0 - 2 * gt.pier) / 2, h = 2.3;
    void dir;
    for (let i = 0; i <= 7; i++) { const u = u0 + (w * i) / 7; B.box('ironBlack', u, g + h / 2 + 0.05, vp + dir * 0.05, 0.025, h, 0.025); }
    for (const y of [0.15, h - 0.1, h - 0.3]) B.box('ironBlack', u0 + w / 2, g + y, vp + dir * 0.05, w, 0.04, 0.03);
  }
}

// ------------------------------------------------------------------------------------------------ registration
function registerSolids(ctx, WF) {
  const R = (s0, s1, t0, t1) => WF.ring([[s0, t0], [s1, t0], [s1, t1], [s0, t1]]);
  ctx.solid(R(0, LEN, 0.9, TW + P.COLD));           // Wolfson's ground floor with the west columns
  ctx.solid(R(FAH.s0, FAH.s1, FAH.glassT, 0.9));                         // the Hall
  ctx.solid(R(P.NLINK.s0, 0, P.NLINK.t0, P.NLINK.t1));                   // the north link and slot
  ctx.solid(R(FAH.r1 - 0.38, FAH.r1 - 0.02, FAH.glassT - 0.36, FAH.glassT));      // the south-east pier
  ctx.solid(R(FAH.door.s - FAH.door.half - FAH.door.pier, FAH.door.s - FAH.door.half, FAH.glassT - FAH.door.proj, FAH.glassT));
  ctx.solid(R(FAH.door.s + FAH.door.half, FAH.door.s + FAH.door.half + FAH.door.pier, FAH.glassT - FAH.door.proj, FAH.glassT));
}

export function buildWolfson(ctx) {
  const { B, K, S, pack } = ctx;
  addCells(K, pack);
  const WF = S.ownFrame(P.UE, P.VN, P.UE + Math.sin(P.ANG) * 20, P.VN + Math.cos(P.ANG) * 20);
  B.push(WF.M);
  buildSlab(ctx, K, B);
  buildLinks(ctx, K, B);
  buildHall(ctx, K, B);
  B.pop();
  buildCourt(ctx, K, B, WF);
  buildWall(ctx, K, B);
  registerSolids(ctx, WF);
  return { len: LEN };
}
