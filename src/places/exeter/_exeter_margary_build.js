// Exeter College, STANDALONE model, part 'margary' (B09 + G02): the build functions. Called by exeter_margary.js with
// ctx.B already in the college's LOCAL frame (x = u east, z = v south, y above the datum). Every figure comes from
// _exeter_margary_plan.js (sources and K / G there). Local helpers written here (not in the kit): a ground polygon laid
// on a sloping plane, strips along a polyline, a 5 x 7 block font painted as geometry (the fascia's words), Sheffield
// cycle stands, a plain standing figure.
import * as K from './_exeter_kit.js';
import * as P from './_exeter_margary_plan.js';
import { shrub } from './_exeter_plants.js';

const { THREE, frame, wall, rectPts } = K;
const { TURL: T, GROUND: G, BW, WIN_B, TW, TOWER: TO, SW } = P;
const FOOT = G.foot;
const REV = 0.32;          // the deep plain reveals (photographs; G depth)

// ------------------------------------------------------------------------------------------------ cells
export function addCells(pack) {
  K.addCell(pack, 'twStone', 'stone', [1.12, 1.08, 0.98], { seed: 0.35 });     // the 1964 pale ashlar cladding
  K.addCell(pack, 'twDress', 'stoneDress', [1.14, 1.11, 1.04]);
  K.addCell(pack, 'galv', 'lead', 0x9ea3a6);
  K.addCell(pack, 'rustIron', 'lead', 0x4a3428);
  K.addCell(pack, 'bronze', 'lead', 0x5b4632);
  K.addCell(pack, 'fascia', 'lead', 0x1b2230);
  // Margary Quad's ground (second pass): pale buff York flags and pale grey granite setts (the satellite: the quad reads pale
  // buff-grey, near the stonework's tone; the 16/01398 photograph: weathered buff flags, grey / pinkish granite setts). G tints
  addGround(pack, 'mqFlags', 'paving', P.FLAGS_TINT);
  addGround(pack, 'mqSetts', 'setts', P.SETTS_TINT);       // (fix-up pass: raised from [2.05, 2.0, 1.9]: plan SETTS_TINT)
  K.addCell(pack, 'marble', 'stoneDress', [1.25, 1.24, 1.2]);
  // (fix-up pass) the bins' screens: weathered timber, mid brown-grey (the kit's 'bench' read black in the Chapel's shade)
  K.addCell(pack, 'binTimber', 'boards', 0xb3a58e);
  K.addCell(pack, 'binPost', 'boards', 0x8f806b);
  K.addCell(pack, 'binGrey', 'lead', 0x6a7074);
  K.addCell(pack, 'binGreen', 'lead', 0x2e5a34);
  K.addCell(pack, 'binLid', 'lead', 0x24472a);
  K.addCell(pack, 'bikeFrame', 'lead', 0x24364f);
  K.addCell(pack, 'bikeFrame2', 'lead', 0x6e2420);
}

/** a tinted copy of one of the pack's GROUND cells (pack.groundCells: 'paving', 'setts', ...; K.addCell covers the wall
 *  cells only): a helper the kit lacks, written here */
function addGround(pack, key, from, tint) {
  const G = pack.groundCells; if (!G || !G.get(from) || G.get(key)) return;
  G.set(key, { ...G.get(from), tint });
}

// ------------------------------------------------------------------------------------------------ helpers
/** the Broad wing's frame: x along Broad Street (east) from the corner, z into the quad */
export const MB = () => new THREE.Matrix4().makeBasis(new THREE.Vector3(P.BE[0], 0, P.BE[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(P.BN[0], 0, P.BN[1])).setPosition(P.CORNER[0], 0, P.CORNER[1]);
/** x (Broad frame) where the quad face (z 10) meets the wing's quad face u = T.uWingQ */
export const XWQ = (T.uWingQ - P.CORNER[0] + P.BROAD_DEPTH * Math.sin(P.BROAD_ANG)) / Math.cos(P.BROAD_ANG);
export const QW = P.bw(XWQ, P.BROAD_DEPTH);          // that point in LOCAL (u -17.4, v -52.1)
const VCS = QW[1];                                    // the corner block's south side (= the Broad wing's quad face at the wing)

const op = (s, sill, head, w, lights = 1, o = {}) => ({ pts: rectPts(s - w / 2, sill, s + w / 2, head), kind: 'win', d: REV, lights, glass: 'glassDark', mullionKey: 'frame', mullionW: 0.07, sill: false, ...o });
/** the openings of one bay type over the three upper floors of the Broad wing / corner block */
function broadBay(s, k) {
  const out = [];
  for (let f = 0; f < 3; f++) {
    const dy = f * P.FLOOR, W = WIN_B[k];
    if (k === 'W01') out.push(op(s, W.sill + dy, W.head + dy, W.w, 2, { transoms: [W.panel + dy] }));
    else out.push(op(s, W.sill + dy, W.head + dy, W.w));
  }
  return out;
}
/** the Turl wing's windows of one kind over three floors (head-aligned) */
function wingBay(s, k) {
  const out = [];
  for (const head of TW.heads) {
    const W = TW[k];
    if (k === 'W03') continue;
    out.push(op(s, head - W.h, head, W.w, k === 'W01' ? 2 : k === 'W04' ? 2 : 1, k === 'W01' ? { transoms: [head - W.h + 0.3] } : {}));
  }
  if (k === 'W03') for (const top of TW.W03.tops) out.push(op(s, top - TW.W03.h, top, TW.W03.w, 1, { d: 0.2 }));
  return out;
}
function towerBay(s, k) {
  const W = TO[k];
  return TO.heads.map((head) => op(s, head - W.h, head, W.w, k === 'W01' ? 2 : 1, k === 'W01' ? { transoms: [head - W.h + 0.3] } : {}));
}
/** a glazed stair strip (tall lights, a door at the foot) in the CURRENT wall frame: s0..s1, the lights' [y0, y1] list */
function stairStrip(s0, s1, lights, yGround) {
  const out = [], w = s1 - s0 - 0.2, c = (s0 + s1) / 2;
  for (const [a, b] of lights) out.push(op(c, a, b, w, 1, { d: 0.22 }));
  out.push({ pts: rectPts(c - 0.62, yGround, c + 0.28, yGround + 2.1), kind: 'door', doorKey: 'doorDark', d: 0.25 });
  out.push(op(c + 0.47, yGround + 0.15, yGround + 2.1, 0.28, 1, { d: 0.25 }));      // the door's side light
  return out;
}
/** fins framing a stair strip (CURRENT frame) */
function stripFins(B, s0, s1, y0, y1) { for (const s of [s0, s1]) B.box('twDress', s, (y0 + y1) / 2, 0.05, 0.1, y1 - y0, 0.1, 0, {}); }
/** a plain vertical quad between plan points a, b from y0 to y1 facing `n` ([nu, nv]) */
function plain(B, key, a, b, y0, y1, n) { B.poly(key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [n[0], 0, n[1]]); }
/** a balustrade (galvanised posts and two rails) along a plan polyline, from y0 */
function balustrade(B, line, y0, h = 0.5, pitch = 1.6) {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / pitch));
    for (const y of [y0 + h, y0 + h * 0.5]) B.beam('galv', [a[0], y, a[1]], [b[0], y, b[1]], 0.045);
    for (let k = 0; k <= n; k++) { if (i > 0 && k === 0) continue; const f = k / n; B.beam('galv', [a[0] + (b[0] - a[0]) * f, y0, a[1] + (b[1] - a[1]) * f], [a[0] + (b[0] - a[0]) * f, y0 + h + 0.02, a[1] + (b[1] - a[1]) * f], 0.05); }
  }
}

// ------------------------------------------------------------------------------------------------ the fascia's words
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'], K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'], "'": ['1', '1', '1', '0', '0', '0', '0'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'], ' ': ['000', '000', '000', '000', '000', '000', '000'],
};
/** paint `str` centred at s = sc with its foot at y0, letter pixels px, on the CURRENT frame's plane z (facing +z) */
function words(B, str, sc, y0, px, z, key = 'gold') {
  const adv = (ch) => (FONT[ch] || FONT[' '])[0].length + 1;
  let total = 0; for (const ch of str) total += adv(ch); total -= 1;
  let x = sc - (total * px) / 2;
  for (const ch of str) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 7; r++) {
      const row = g[r], y = y0 + (6 - r) * px;
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== '1') continue;
        let e = c; while (e + 1 < row.length && row[e + 1] === '1') e++;
        const a = x + c * px, b = x + (e + 1) * px;
        B.poly(key, [[a, y, z], [b, y, z], [b, y + px, z], [a, y + px, z]], [0, 0, 1]);
        c = e;
      }
    }
    x += adv(ch) * px;
  }
}
const SHOP_WORDS = "BLACKWELL'S ART & POSTER SHOP";

// ------------------------------------------------------------------------------------------------ a shopfront (CURRENT wall frame)
/** a dark shopfront from s0 to s1 under a head at `top`: piers (s list), glazing set back `rec`, stall riser, doors ([a, b] list) */
function shopfront(B, s0, s1, top, piers, doors, rec = 0.3, o = {}) {
  const pw = o.pierW ?? 0.42, yb = FOOT, riser = o.riser ?? 0.45, ground = o.ground ?? -0.5;
  B.poly(o.soffit || 'twDress', [[s0, top, 0], [s1, top, 0], [s1, top, -rec], [s0, top, -rec]], [0, -1, 0]);
  // the glazed screen, pane by pane between piers and doors
  const cuts = [s0, ...piers.flatMap((p) => [p - pw / 2, p + pw / 2]), s1];
  for (let i = 0; i < cuts.length; i += 2) {
    const a = cuts[i], b = cuts[i + 1]; if (b - a < 0.05) continue;
    B.box('frame', (a + b) / 2, (yb + ground + riser) / 2, -rec + 0.04, b - a, ground + riser - yb, 0.08, 0, {});       // stall riser
    B.poly('glassDark', [[a, ground + riser, -rec], [b, ground + riser, -rec], [b, top - 0.12, -rec], [a, top - 0.12, -rec]], [0, 0, 1]);
    B.box('frame', (a + b) / 2, top - 0.06, -rec + 0.04, b - a, 0.12, 0.1, 0, {});                                   // head rail
    B.box('frame', (a + b) / 2, ground + riser + 0.03, -rec + 0.05, b - a, 0.06, 0.12, 0, {});                        // sill rail
    const n = Math.max(1, Math.round((b - a) / 1.3));
    for (let k = 1; k < n; k++) B.box('frame', a + ((b - a) * k) / n, (ground + riser + top) / 2, -rec + 0.04, 0.06, top - ground - riser, 0.1, 0, {});
    // side reveals of the recess
    if (rec > 0) {
      B.poly('frame', [[a, yb, 0], [a, yb, -rec], [a, top, -rec], [a, top, 0]], [1, 0, 0]);
      B.poly('frame', [[b, yb, -rec], [b, yb, 0], [b, top, 0], [b, top, -rec]], [-1, 0, 0]);
    }
  }
  for (const p of piers) B.box(o.pierKey || 'frame', p, (yb + top) / 2, -0.02, pw, top - yb, 0.12, 0, {});
  for (const [a, b] of doors) B.unit('doorDark', rectPts(a, ground, b, Math.min(ground + 2.25, top - 0.15)), -rec + 0.015, K.nextBay(0));
}

// ------------------------------------------------------------------------------------------------ THE BROAD WING and the CORNER BLOCK
export function buildBroad(ctx) {
  const { B } = ctx, L = P.BROAD_LEN, D = P.BROAD_DEPTH, xw = XWQ, sh = BW.shop;
  const gB = (x) => G.broadW + ((G.broadE - G.broadW) * x) / L;     // Broad pavement under x
  B.push(MB());
  // ---- the street face (faces north; s = L - x runs west)
  {
    const ops = []; for (const b of P.BROAD_BAYS) ops.push(...broadBay(L - b.x, b.k));
    wall(B, frame(L, 0, 0, -1, 0), rectPts(0, sh.fascia[0], L, BW.roof), ops, 'twStone');
    B.push(frame(L, 0, 0, -1, 0));
    // shopfront: piers (s), the corner bay's entrance; a solid stone pier at each end
    const piers = P.BROAD_PIERS.map((x) => L - x), S0 = L - P.BROAD_SHOP.x1, S1 = L - P.BROAD_SHOP.x0;
    B.box('twStone', S0 / 2, (FOOT + sh.fascia[0]) / 2, -0.15, S0, sh.fascia[0] - FOOT, 0.3, 0, {});
    B.box('twStone', (S1 + L) / 2, (FOOT + sh.fascia[0]) / 2, -0.15, L - S1, sh.fascia[0] - FOOT, 0.3, 0, {});
    shopfront(B, S0, S1, sh.fascia[0], piers, [[L - P.BROAD_SHOP.door[1], L - P.BROAD_SHOP.door[0]]], 0.3, { ground: gB(10) });
    // fascia, the panelled band over it, the words
    B.box('fascia', L / 2, (sh.fascia[0] + sh.fascia[1]) / 2, 0.05, L, sh.fascia[1] - sh.fascia[0], 0.1, 0, { bottom: true });
    B.box('twDress', L / 2, (sh.band[0] + sh.band[1]) / 2, 0.02, L, sh.band[1] - sh.band[0], 0.04, 0, { bottom: true });
    for (let s = 1.25; s < L; s += 2.5) B.box('twStone', s, (sh.band[0] + sh.band[1]) / 2, 0.045, 0.06, sh.band[1] - sh.band[0] - 0.08, 0.01, 0, {});
    words(B, SHOP_WORDS, L - 10.0, sh.fascia[0] + 0.135, 0.05, 0.106);
    B.pop();
  }
  // ---- the quad face (faces south; s = x - xw runs east)
  {
    const Lq = L - xw, Q = P.BQ, S = BW.stairHead, s0h = S.x0 - xw, s1h = S.x1 - xw, yq = P.quadY(-10, -52);
    const ops = [];
    for (const b of Q.bays) ops.push(...broadBay(b.d, b.k));
    ops.push(...stairStrip(Q.stair.d0, Q.stair.d1, WIN_B.W08, yq));
    ops.push(op((s0h + s1h) / 2, 12.35, 12.9, s1h - s0h - 0.7, 3, { d: 0.2 }));      // W-09 over the stair
    for (const d of Q.vents) ops.push(op(d, Q.ventY[0], Q.ventY[1], Q.ventW, 1, { d: 0.15 }));
    for (const g of P.TW_GROUND.broad) ops.push(op(g.s, yq + 0.55, yq + 1.95, g.w, 2, { d: 0.32 }));
    const outline = [[0, FOOT], [Lq, FOOT], [Lq, BW.roof], [s1h, BW.roof], [s1h, S.top], [s0h, S.top], [s0h, BW.roof], [0, BW.roof]];
    wall(B, frame(xw, 0, D, 1, 0), outline, ops, 'twStone');
    B.push(frame(xw, 0, D, 1, 0));
    B.box('twDress', Lq / 2, (Q.band[0] + Q.band[1]) / 2, 0.03, Lq, Q.band[1] - Q.band[0], 0.06, 0, { bottom: true });
    stripFins(B, Q.stair.d0, Q.stair.d1, yq, BW.roof);
    B.pop();
    // the stair head's sides and top (from the quad face back to the roof storey)
    const zr = D - BW.terrace;
    plain(B, 'twStone', [S.x0, zr], [S.x0, D], BW.roof, S.top, [-1, 0]);
    plain(B, 'twStone', [S.x1, D], [S.x1, zr], BW.roof, S.top, [1, 0]);
    B.box('twDress', (S.x0 + S.x1) / 2, S.top + 0.06, D - BW.terrace / 2, S.x1 - S.x0 + 0.1, 0.12, BW.terrace + 0.1, 0, { bottom: true });
  }
  // ---- the east (party) wall: plain to the roof's end
  plain(B, 'twStone', [L, D], [L, 0], FOOT, BW.roof, [1, 0]);
  B.poly('twStone', [[L, BW.roof, D - BW.northFoot], [L, BW.ridge, D - BW.ridgeD], [L, BW.storeyTop, D - BW.slopeFoot], [L, BW.storeyTop, D - BW.terrace], [L, BW.roof, D - BW.terrace]], [1, 0, 0]);
  // ---- parapets (street, east, quad either side of the stair head) with copings, and the balustrades
  const t = 0.3, pH = BW.parapet - 0.1 - BW.roof;
  K.parapet(B, 'twStone', [[0, t / 2], [L - t / 2, t / 2], [L - t / 2, D - t / 2]], BW.roof, pH, t, { coping: 'twDress' });
  K.parapet(B, 'twStone', [[xw, D - t / 2], [BW.stairHead.x0, D - t / 2]], BW.roof, pH, t, { coping: 'twDress' });
  K.parapet(B, 'twStone', [[BW.stairHead.x1, D - t / 2], [L - t / 2, D - t / 2]], BW.roof, pH, t, { coping: 'twDress' });
  balustrade(B, [[1.45, 0.45], [19.5, 0.45]], BW.parapet);
  balustrade(B, [[xw + 0.3, D - 0.45], [BW.stairHead.x0 - 0.1, D - 0.45]], BW.parapet);
  balustrade(B, [[BW.stairHead.x1 + 0.1, D - 0.45], [L - 0.5, D - 0.45]], BW.parapet);
  // ---- the roof: storey with its doors to the terrace, lead flat, slate slopes, hip, dormers
  {
    const zr = D - BW.terrace, zs = D - BW.slopeFoot, zR = D - BW.ridgeD, zN = D - BW.northFoot, x0 = BW.roofX0, xr = x0 + BW.hipRun;
    const Ls = L - x0;
    const rOps = [];
    // W-06 strips at the ends, DW-11 glazed doors (elevation 3, s from the roof storey's west end)
    for (const [a, b] of [[0.15, 1.6], [12.0, 13.25]]) rOps.push(op((a + b) / 2, 12.85, 13.35, b - a, 2, { d: 0.18 }));
    for (const [a, b] of [[1.75, 4.6], [8.6, 11.5]]) { rOps.push({ pts: rectPts(a, BW.roof + 0.05, a + 0.95, 13.4), kind: 'door', doorKey: 'doorDark', d: 0.15 }); rOps.push(op((a + 0.95 + b) / 2 + 0.05, BW.roof + 0.15, 13.4, b - a - 1.05, 2, { d: 0.15 })); }
    wall(B, frame(x0, 0, zr, 1, 0), rectPts(0, BW.roof, Ls, BW.storeyTop), rOps, 'twStone');
    plain(B, 'twStone', [x0, zs], [x0, zr], BW.roof, BW.storeyTop, [-1, 0]);
    B.poly('lead', [[x0, BW.storeyTop, zs], [L, BW.storeyTop, zs], [L, BW.storeyTop, zr], [x0, BW.storeyTop, zr]], [0, 1, 0]);
    B.box('lead', (x0 + L) / 2, BW.storeyTop + 0.04, zr + 0.05, Ls, 0.08, 0.2, 0, {});
    const xs = x0 + ((BW.storeyTop - BW.roof) / (BW.ridge - BW.roof)) * BW.hipRun;   // where the hip meets the south slope's foot
    B.poly('slate', [[xr, BW.ridge, zR], [L, BW.ridge, zR], [L, BW.storeyTop, zs], [xs, BW.storeyTop, zs]], [0, 1, 1]);          // south slope
    B.poly('slate', [[x0, BW.roof, zN], [L, BW.roof, zN], [L, BW.ridge, zR], [xr, BW.ridge, zR]], [0, 1, -1]);                   // north slope
    B.poly('slate', [[x0, BW.roof, zN], [xr, BW.ridge, zR], [xs, BW.storeyTop, zs], [x0, BW.roof, zs]], [-1, 1, 0]);               // the hip
    B.poly('twStone', [[x0, BW.roof, zs], [xs, BW.storeyTop, zs], [x0, BW.storeyTop, zs]], [0, 0, -1]);
    B.beam('lead', [xr, BW.ridge + 0.03, zR], [L, BW.ridge + 0.03, zR], 0.12, 0.08);
    // the triangular dormers W-10 on the north slope (x from the corner)
    const slopeY = (z) => BW.roof + ((z - zN) / (zR - zN)) * (BW.ridge - BW.roof);
    for (const d of BW.dormers) {
      const zf = zN + ((d.base - BW.roof) / (BW.ridge - BW.roof)) * (zR - zN), zb = zN + ((d.apex - BW.roof) / (BW.ridge - BW.roof)) * (zR - zN), h = d.w / 2;
      void slopeY;
      B.poly('slate', [[d.x - h - 0.06, d.base - 0.04, zf - 0.06], [d.x, d.apex + 0.05, zf - 0.06], [d.x, d.apex + 0.05, zb]], [-1, 1, -0.6]);
      B.poly('slate', [[d.x, d.apex + 0.05, zf - 0.06], [d.x + h + 0.06, d.base - 0.04, zf - 0.06], [d.x, d.apex + 0.05, zb]], [1, 1, -0.6]);
      B.push(frame(d.x + h, 0, zf, -1, 0));
      B.poly('twDress', [[0, d.base, 0], [d.w, d.base, 0], [h, d.apex, 0]], [0, 0, 1]);
      B.unit('glassDark', [[0.3, d.base + 0.12], [d.w - 0.3, d.base + 0.12], [h, d.apex - 0.3]], 0.01, K.nextBay(9));
      B.pop();
    }
  }
  // ---- the flats (the whole wing at the roof level, under everything)
  B.pop();
  const ring = [P.CORNER, P.EAST_END, P.bw(P.BROAD_LEN, P.BROAD_DEPTH), QW, [T.uCorner, VCS]];
  B.flat('lead', ring, BW.roof);
  // ---- the corner block's Turl face (faces west; s = v - corner v)
  {
    const L2 = VCS - P.CORNER[1], C = P.CORNER_TURL, ops = [];
    for (const b of C.bays) ops.push(...broadBay(b.d, b.k));
    wall(B, frame(T.uCorner, 0, P.CORNER[1], 0, 1), rectPts(0, sh.fascia[0], L2, BW.roof), ops, 'twStone');
    B.push(frame(T.uCorner, 0, P.CORNER[1], 0, 1));
    shopfront(B, 0.35, L2 - 0.45, sh.fascia[0], [3.1], [[C.shopDoor[0] + 0.3, C.shopDoor[0] + 1.25], [C.shopDoor[1] - 1.25, C.shopDoor[1] - 0.3]], 0.3, { ground: G.turlN });
    B.box('twStone', 0.175, (FOOT + sh.fascia[0]) / 2, 0, 0.35, sh.fascia[0] - FOOT, 0.02, 0, {});
    B.box('twStone', L2 - 0.225, (FOOT + sh.fascia[0]) / 2, 0, 0.45, sh.fascia[0] - FOOT, 0.02, 0, {});
    B.box('fascia', L2 / 2 - 0.05, (sh.fascia[0] + sh.fascia[1]) / 2, 0.05, L2 + 0.1, sh.fascia[1] - sh.fascia[0], 0.1, 0, { bottom: true });
    B.box('twDress', L2 / 2, (sh.band[0] + sh.band[1]) / 2, 0.02, L2, sh.band[1] - sh.band[0], 0.04, 0, { bottom: true });
    words(B, SHOP_WORDS, L2 / 2, sh.fascia[0] + 0.135, 0.05, 0.106);
    B.pop();
    // the corner block's south side above the wing's roof, and its short return at the wing's set-back street face
    plain(B, 'twStone', [T.uWingQ, VCS], [T.uCorner, VCS], TW.roof, BW.roof, [0, 1]);
    plain(B, 'twStone', [T.uWing, VCS], [T.uCorner, VCS], FOOT, TW.roof, [0, 1]);
    const t2 = 0.3;
    K.parapet(B, 'twStone', [[T.uCorner + t2 / 2, P.CORNER[1] + 0.02], [T.uCorner + t2 / 2, VCS - t2 / 2], [T.uWingQ, VCS - t2 / 2]], BW.roof, BW.parapet - 0.1 - BW.roof, t2, { coping: 'twDress' });
    balustrade(B, [[T.uCorner + 0.45, -61.8], [T.uCorner + 0.45, -52.85]], BW.parapet);
  }
  // ---- the standing iron figure on the roof edge over Broad Street (plain; no likeness)
  {
    const s = BW.statue, p = P.bw(s.x, s.z);
    figure(B, p[0], BW.parapet, p[1], s.h, Math.PI + P.BROAD_ANG, 'rustIron', false);
  }
}

/** a plain standing human figure (feet at y0, height h) facing `ry` (0 = +z); robe: a long garment instead of legs */
export function figure(B, x, y0, z, h, ry, key, robe) {
  const k = h / 1.9, M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y0, z);
  B.push(M);
  if (robe) B.cyl(key, 0, 0, 0, 0.2 * k, 1.05 * k, 10, true, 0.3 * k);
  else for (const sx of [-0.1, 0.1]) B.cyl(key, sx * k, 0, 0, 0.075 * k, 0.92 * k, 7, true, 0.06 * k);
  B.box(key, 0, (robe ? 1.0 : 0.92) * k + 0.27 * k, 0, 0.38 * k, (robe ? 0.48 : 0.56) * k, 0.22 * k, 0, { bottom: true });
  for (const sx of [-0.235, 0.235]) B.cyl(key, sx * k, 0.82 * k, 0, 0.055 * k, 0.62 * k, 6, true, 0.045 * k);
  B.cyl(key, 0, 1.48 * k, 0, 0.05 * k, 0.1 * k, 6, false);
  B.cyl(key, 0, 1.57 * k, 0.01, 0.085 * k, 0.26 * k, 8, true, 0.1 * k);
  B.pop();
}

// ------------------------------------------------------------------------------------------------ THE TURL WING (Staircase 14)
export function buildWing(ctx) {
  const { B } = ctx, L = T.vTowerN - VCS;       // 12.36
  // street face (faces west; s = v - VCS)
  {
    const ops = []; for (const b of TW.street) ops.push(...wingBay(b.d, b.k));
    wall(B, frame(T.uWing, 0, VCS, 0, 1), rectPts(0, TW.shopTop, L, TW.roof), ops, 'twStone');
    B.push(frame(T.uWing, 0, VCS, 0, 1));
    const doors = TW.shop.filter((q) => q[2] === 'door').map((q) => [q[0] + 0.1, q[1] - 0.1]);
    const piers = []; for (let i = 0; i < TW.shop.length - 1; i++) piers.push((TW.shop[i][1] + TW.shop[i + 1][0]) / 2);
    B.box('twStone', 0.025, (FOOT + TW.shopTop) / 2, 0, 0.05, TW.shopTop - FOOT, 0.02, 0, {});
    shopfront(B, 0.0, L, TW.shopTop, piers, doors, 0.25, { ground: (G.turlN + G.turlS) / 2, pierW: 0.3, soffit: 'frame' });
    B.box('frame', L / 2, TW.shopTop + 0.08, 0.03, L, 0.16, 0.06, 0, { bottom: true });
    B.pop();
  }
  // quad face (faces east; s = v1 - v from the tower's north face)
  {
    const yq = P.quadY(-17.4, -46), ops = [];
    for (const b of TW.quad) ops.push(...wingBay(b.d, b.k));
    for (const st of TW.stairs) ops.push(...stairStrip(st.d0, Math.min(st.d1, L), TW.W08, yq));
    // the ground floor as a real 1964 storey (second pass: the gym, the laundry and an accessible bedroom open off the quad:
    // the access guide): a glazed door between two windows in deep plain reveals. G places and sizes
    for (const g of P.TW_GROUND.wing) ops.push(g.door ? op(g.s, yq + 0.02, yq + 2.05, g.w, 1, { d: 0.32, transoms: [yq + 1.75] }) : op(g.s, yq + 0.55, yq + 1.95, g.w, 2, { d: 0.32 }));
    wall(B, frame(T.uWingQ, 0, T.vTowerN, 0, -1), rectPts(0, FOOT, L, TW.roof), ops, 'twStone');
    B.push(frame(T.uWingQ, 0, T.vTowerN, 0, -1));
    B.box('twDress', L / 2, (TW.quadBand[0] + TW.quadBand[1]) / 2, 0.03, L, TW.quadBand[1] - TW.quadBand[0], 0.06, 0, { bottom: true });
    B.box('twDress', L / 2, 9.96, 0.03, L, 0.08, 0.06, 0, { bottom: true });
    for (const st of TW.stairs) stripFins(B, st.d0, Math.min(st.d1, L), yq, TW.roof);
    B.pop();
  }
  // roof: flat, parapets with copings on both long sides, balustrades
  const ring = [[T.uWing, VCS], [T.uWingQ, VCS], [T.uWingQ, T.vTowerN], [T.uWing, T.vTowerN]];
  B.flat('lead', ring, TW.roof);
  const t = 0.3, pH = TW.parapet - 0.1 - TW.roof;
  K.parapet(B, 'twStone', [[T.uWing + t / 2, VCS + t / 2], [T.uWing + t / 2, T.vTowerN - t / 2]], TW.roof, pH, t, { coping: 'twDress' });
  K.parapet(B, 'twStone', [[T.uWingQ - t / 2, VCS + t / 2], [T.uWingQ - t / 2, T.vTowerN - t / 2]], TW.roof, pH, t, { coping: 'twDress' });
  balustrade(B, [[T.uWing + 0.45, VCS + 0.3], [T.uWing + 0.45, T.vTowerN - 0.3]], TW.parapet);
  balustrade(B, [[T.uWingQ - 0.45, VCS + 0.3], [T.uWingQ - 0.45, T.vTowerN - 0.3]], TW.parapet);
  // the city's bracket street lamp on the wing's street face (Cunliffe 2011)
  {
    const Ls = P.STREET_LAMP, u = T.uWing;
    B.box('ironBlack', u - 0.04, Ls.y + 0.55, Ls.v, 0.08, 0.5, 0.35, 0, {});
    B.beam('ironBlack', [u - 0.05, Ls.y + 0.75, Ls.v], [u - Ls.arm, Ls.y + 0.75, Ls.v], 0.05);
    B.beam('ironBlack', [u - 0.05, Ls.y + 0.35, Ls.v], [u - Ls.arm * 0.7, Ls.y + 0.73, Ls.v], 0.03);
    const p = K.lantern(B, u - Ls.arm, Ls.y + 0.05, Ls.v, { size: 0.34 });
    ctx.lamp(p[0], p[1], p[2]);
  }
}

// ------------------------------------------------------------------------------------------------ THE TOWER and the link strip
export function buildTower(ctx) {
  const { B } = ctx, top = TO.roof, vN = T.vTowerN, vS = T.vTowerS, uQ = T.uTowerQ, uS = T.uTower;
  // street face (faces west; s = v - vN)
  {
    const L = vS - vN, ops = [];
    for (const b of TO.street) ops.push(...towerBay(b.d, b.k));
    ops.push({ pts: rectPts(0.58, G.turlS, 1.23, G.turlS + 0.65), kind: 'win', glass: 'glassDark', d: 0.1, sill: false });   // the low grille (elevation 2)
    wall(B, frame(uS, 0, vN, 0, 1), rectPts(0, FOOT, L, top), ops, 'twStone');
    B.push(frame(uS, 0, vN, 0, 1));
    B.box('twDress', L / 2, G.turlS + 0.97, 0.03, L, 0.08, 0.06, 0, { bottom: true });
    B.pop();
  }
  // quad face (faces east; s = vChapel - v: from the Chapel's wall northwards, the link strip first)
  {
    const L = T.vChapel - vN, sTop = T.vChapel - SW.well.vTop, ops = [];
    for (const b of TO.quad) ops.push(...towerBay(T.vChapel - (vN + b.d), b.k));
    const pa = SW.passage;
    ops.push({ pts: rectPts(T.vChapel - pa.v1, P.LANDING_Y, T.vChapel - pa.v0, P.LANDING_Y + pa.h), kind: 'void', d: uQ - pa.uIn + 0.02, revealKey: 'twStone' });
    const outline = [[0, FOOT], [sTop, FOOT], [sTop, P.BASEMENT_Y - 0.3], [L, P.BASEMENT_Y - 0.3], [L, top], [0, top]];
    wall(B, frame(uQ, 0, T.vChapel, 0, -1), outline, ops, 'twStone');
    B.push(frame(uQ, 0, T.vChapel, 0, -1));
    B.box('twDress', (T.vChapel - pa.v1 + T.vChapel - pa.v0) / 2, P.LANDING_Y + pa.h + 0.1, 0.05, pa.v1 - pa.v0 + 0.3, 0.2, 0.1, 0, { bottom: true });   // a plain lintel band
    B.pop();
  }
  // the passage's floor (rising westwards) and its far end (the west range's quad wall: theirs; a dark stand-in face
  // 2 cm in front of it so the end reads even before the west range opens its side)
  {
    const pa = SW.passage;
    B.poly('pavingSolid', [[uQ + 0.02, P.LANDING_Y + 0.01, pa.v1], [uQ + 0.02, P.LANDING_Y + 0.01, pa.v0], [pa.uIn, pa.yIn, pa.v0], [pa.uIn, pa.yIn, pa.v1]], [0, 1, 0]);
  }
  // north face (faces north; s = uQ - u runs west), plain: low between the wing's faces
  {
    const s1 = uQ - T.uWingQ, s2 = uQ - T.uWing, L = uQ - uS;
    plain(B, 'twStone', [uQ, vN], [T.uWingQ, vN], FOOT, top, [0, -1]);
    plain(B, 'twStone', [T.uWingQ, vN], [T.uWing, vN], TW.roof, top, [0, -1]);
    plain(B, 'twStone', [T.uWing, vN], [uS, vN], FOOT, top, [0, -1]);
    void s1; void s2; void L;
  }
  // south faces above the neighbours (the west range's roof, the Chapel's parapet) and the link strip's west face
  plain(B, 'twStone', [uS, vS], [T.uLinkW, vS], 11.0, top, [0, 1]);
  plain(B, 'twStone', [T.uLinkW, T.vChapel], [uQ, T.vChapel], 13.5, top, [0, 1]);
  plain(B, 'twStone', [T.uLinkW, vS], [T.uLinkW, T.vChapel], 11.5, top, [-1, 0]);
  // roof, parapet with coping, plant room
  const ring = [[uS, vN], [uQ, vN], [uQ, T.vChapel], [T.uLinkW, T.vChapel], [T.uLinkW, vS], [uS, vS]];
  B.flat('lead', ring, top);
  const t = 0.35, pH = TO.parapet - 0.12 - top, h = t / 2;
  K.parapet(B, 'twStone', [[uS + h, vS - h], [uS + h, vN + h], [uQ - h, vN + h], [uQ - h, T.vChapel - h], [T.uLinkW + h, T.vChapel - h], [T.uLinkW + h, vS - h], [uS + h, vS - h]], top, pH, t, { coping: 'twDress' });
  const pr = TO.plant;
  K.prism(B, 'concrete', [[pr.u0, pr.v0], [pr.u1, pr.v0], [pr.u1, pr.v1], [pr.u0, pr.v1]], top, pr.top, { top: true, topKey: 'lead' });
}

// ------------------------------------------------------------------------------------------------ the south-west corner: landing, basement stair
export function buildCorner(ctx) {
  const { B } = ctx, w = SW.well, yL = P.LANDING_Y, yB = P.BASEMENT_Y;
  const n = SW.flight1.n + SW.flight2.n, rise = (yL - yB) / n;
  const v1 = w.vTop - SW.flight1.n * SW.flight1.going, v2 = v1 - SW.landing2, v3 = v2 - SW.flight2.n * SW.flight2.going;
  K.steps(B, 'pavingSolid', w.u0, w.u1, w.vTop, -1, SW.flight1.n, rise, SW.flight1.going, yL, yB - 0.2);
  const yM = yL - SW.flight1.n * rise;
  B.box('pavingSolid', (w.u0 + w.u1) / 2, (yM + yB - 0.2) / 2, (v1 + v2) / 2, w.u1 - w.u0, yM - yB + 0.2, v1 - v2, 0, {});
  K.steps(B, 'pavingSolid', w.u0, w.u1, v2, -1, SW.flight2.n, rise, SW.flight2.going, yM, yB - 0.2);
  B.flat('pavingSolid', [[w.u0, v3], [w.u1, v3], [w.u1, T.vTowerN], [w.u0, T.vTowerN]], yB);
  // the retaining parapet wall on the quad side, with a coping
  const uw = w.u1 + SW.wallT / 2, top = P.quadY(-12, -37) + SW.wallTop + 0.4;
  B.box('twStone', uw, (top + yB - 0.3) / 2, (w.vTop + T.vTowerN - 0.25) / 2, SW.wallT, top - yB + 0.3, w.vTop - T.vTowerN + 0.25, 0, {});
  B.box('twDress', uw, top + 0.05, (w.vTop + T.vTowerN - 0.25) / 2, SW.wallT + 0.1, 0.1, w.vTop - T.vTowerN + 0.35, 0, { bottom: true });
  // the end wall at the foot with the basement door
  B.box('twStone', (w.u0 + w.u1) / 2, (top + yB - 0.3) / 2, T.vTowerN - 0.125, w.u1 - w.u0, top - yB + 0.3, 0.25, 0, {});
  B.box('twDress', (w.u0 + w.u1) / 2, top + 0.05, T.vTowerN - 0.125, w.u1 - w.u0 + 0.05, 0.1, 0.35, 0, { bottom: true });
  B.push(frame(w.u0, 0, T.vTowerN, 1, 0));
  B.unit('doorDark', rectPts(0.22, yB, 1.08, yB + SW.door.h), 0.01, K.nextBay(0));
  B.pop();
  // the landing's flags (survey "64.06"), level, before the lobby
  const Ld = SW.landing;
  B.flat('pavingSolid', [[Ld.u0, Ld.v1], [Ld.u1, Ld.v1], [Ld.u1, Ld.v0], [Ld.u0, Ld.v0]], P.LANDING_Y + 0.01);
  B.box('pavingSolid', (w.u1 + Ld.u1) / 2, (P.LANDING_Y + P.quadY(-11, -35) - 0.2) / 2, Ld.v0 + 0.08, Ld.u1 - w.u1,P.LANDING_Y - P.quadY(-11, -35) + 0.2, 0.16, 0, { top: false });
  // floors: the stair (stepped), the landing, the passage (ramp), the lobby
  ctx.floor([[w.u0, w.vTop], [w.u1, w.vTop], [w.u1, T.vTowerN], [w.u0, T.vTowerN]], (u, v) => {
    if (v >= v1) return yL - Math.min(SW.flight1.n, Math.ceil((w.vTop - v) / SW.flight1.going)) * rise;
    if (v >= v2) return yM;
    if (v >= v3) return yM - Math.min(SW.flight2.n, Math.ceil((v2 - v) / SW.flight2.going)) * rise;
    return yB;
  });
  ctx.floor([[Ld.u0, Ld.v0], [Ld.u1, Ld.v0], [Ld.u1, Ld.v1], [Ld.u0, Ld.v1]], P.LANDING_Y + 0.01);
  const pa = SW.passage;
  ctx.floor([[pa.uIn, pa.v1], [T.uTowerQ, pa.v1], [T.uTowerQ, pa.v0], [pa.uIn, pa.v0]], (u) => P.LANDING_Y + ((T.uTowerQ - u) / (T.uTowerQ - pa.uIn)) * (pa.yIn - P.LANDING_Y));
  buildLobby(ctx);
  return { top };
}

/** the single-storey lobby in front of the Chapel's west bay (survey outline; LIDAR roof): the covered way comes out
 *  through it; its north door opens on the landing. Plain pale ashlar like the Thomas Wood Building (G), flat roof. */
function buildLobby(ctx) {
  const { B } = ctx, Lb = SW.lobby, y0 = P.LANDING_Y, t = Lb.t, [d0, d1] = Lb.door;
  // north face (faces north: s runs west from the east end)
  wall(B, frame(Lb.u1, 0, Lb.v0, -1, 0), rectPts(0, FOOT, Lb.u1 - Lb.u0, Lb.top), [{ pts: rectPts(Lb.u1 - d1, y0 + 0.01, Lb.u1 - d0, y0 + Lb.doorH), kind: 'void', d: t }], 'twStone');
  B.push(frame(Lb.u1, 0, Lb.v0, -1, 0)); B.box('twDress', Lb.u1 - (d0 + d1) / 2, y0 + Lb.doorH + 0.09, 0.04, d1 - d0 + 0.4, 0.18, 0.08, 0, { bottom: true }); B.pop();
  // the door stands OPEN (a way through): the leaf swung back against the inside of the wall
  B.box('doorDark', d1 - 0.02, y0 + Lb.doorH / 2 + 0.01, Lb.v0 + t + 0.5, 0.05, Lb.doorH - 0.02, 0.92, 0, {});
  // east face (faces east: s runs north from the Chapel) and its inside
  wall(B, frame(Lb.u1, 0, Lb.v1, 0, -1), rectPts(0, FOOT, Lb.v1 - Lb.v0, Lb.top), [], 'twStone');
  plain(B, 'twStone', [Lb.u1 - t, Lb.v1], [Lb.u1 - t, Lb.v0 + t], y0, 2.9, [-1, 0]);
  plain(B, 'twStone', [Lb.u0, Lb.v0 + t], [d0, Lb.v0 + t], y0, 2.9, [0, 1]);
  plain(B, 'twStone', [d1, Lb.v0 + t], [Lb.u1 - t, Lb.v0 + t], y0, 2.9, [0, 1]);
  plain(B, 'twStone', [d0, Lb.v0 + t], [d1, Lb.v0 + t], y0 + Lb.doorH, 2.9, [0, 1]);
  plain(B, 'twStone', [Lb.u1 - t, Lb.v1 - 0.02], [Lb.u0, Lb.v1 - 0.02], y0, 2.9, [0, -1]);
  // floor, ceiling, roof with a low coped parapet
  const inner = [[Lb.u0, Lb.v0 + t], [Lb.u1 - t, Lb.v0 + t], [Lb.u1 - t, Lb.v1], [Lb.u0, Lb.v1]];
  B.flat('pavingSolid', inner, y0 + 0.01);
  B.flat('twStone', inner, 2.9, [], true);
  B.flat('lead', [[Lb.u0, Lb.v0], [Lb.u1, Lb.v0], [Lb.u1, Lb.v1], [Lb.u0, Lb.v1]], Lb.top - 0.05);
  K.parapet(B, 'twStone', [[Lb.u0, Lb.v0 + 0.15], [Lb.u1 - 0.15, Lb.v0 + 0.15], [Lb.u1 - 0.15, Lb.v1]], Lb.top - 0.05, Lb.parapet, 0.3, { coping: 'twDress' });
  ctx.floor(inner, y0 + 0.01);
  ctx.floor([[d0, Lb.v0 - 0.02], [d1, Lb.v0 - 0.02], [d1, Lb.v0 + t + 0.02], [d0, Lb.v0 + t + 0.02]], y0 + 0.01);
  // its lamp: a small lantern over the door (the covered way's own light, moved from the tower face)
  const p = K.lantern(B, (d0 + d1) / 2, y0 + Lb.doorH + 0.3, Lb.v0 - 0.3, { size: 0.2 });
  B.beam('ironBlack', [(d0 + d1) / 2, y0 + Lb.doorH + 0.55, Lb.v0], [(d0 + d1) / 2, y0 + Lb.doorH + 0.55, Lb.v0 - 0.3], 0.04);
  ctx.lamp(p[0], p[1], p[2]);
}

// ------------------------------------------------------------------------------------------------ MARGARY QUAD's ground
/** a ground polygon (LOCAL ring + holes) laid on y = f(u, v) + dy, uv = metres / sc (3 for flags, as the Front Quad's; 1 for setts) */
function groundPoly(B, key, ring, holes, f, dy = 0, sc = 3) {
  const pts = [...ring, ...holes.flat()];
  const tris = THREE.ShapeUtils.triangulateShape(ring.map(([u, v]) => new THREE.Vector2(u, v)), holes.map((h) => h.map(([u, v]) => new THREE.Vector2(u, v))));
  for (const t of tris) {
    let [a, b, c] = t.map((i) => pts[i]);
    const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);     // (u, v) with v south: cr < 0 means the triangle faces up
    if (cr > 0) [b, c] = [c, b];
    const P3 = (p) => [p[0], f(p[0], p[1]) + dy, p[1]], U = (p) => [p[0] / sc, p[1] / sc];
    B.tri(key, P3(a), P3(b), P3(c), U(a), U(b), U(c));
  }
}
/** a ground polygon (ring + holes) on a curved surface: triangulated once, then every triangle split at its edges'
 *  midpoints until no edge is longer than `cell` (the quad is a shallow dish: a 3 m edge sags 1 - 2 mm, no cracks seen) */
function gridPoly(B, key, ring, holes, f, dy, sc, cell = 3) {
  const pts = [...ring, ...holes.flat()];
  const tris = THREE.ShapeUtils.triangulateShape(ring.map(([u, v]) => new THREE.Vector2(u, v)), holes.map((h) => h.map(([u, v]) => new THREE.Vector2(u, v))));
  const P3 = (p) => [p[0], f(p[0], p[1]) + dy, p[1]], U = (p) => [p[0] / sc, p[1] / sc], mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const emit = (a, b, c, depth) => {
    const L = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
    if (L > cell && depth < 6) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); emit(a, ab, ca, depth + 1); emit(ab, b, bc, depth + 1); emit(ca, bc, c, depth + 1); emit(ab, bc, ca, depth + 1); return; }
    const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cr > 0) [b, c] = [c, b];
    B.tri(key, P3(a), P3(b), P3(c), U(a), U(b), U(c));
  };
  for (const t of tris) emit(...t.map((i) => pts[i]), 0);
}
const box4 = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
export function buildGround(ctx, corner) {
  const { B } = ctx, f = P.groundY, LW = P.LIGHT_WELL;
  const ring = P.QUAD_RING();
  // York flags over the whole ring (the light well left open), granite setts in the panels and bays a centimetre proud
  gridPoly(B, 'mqFlags', ring, [box4(LW.u0, LW.v0, LW.u1, LW.v1)], f, 0, 3);
  ctx.floor(ring, f);
  for (const p of P.SETT_PANELS) gridPoly(B, 'mqSetts', p, [], f, 0.012, 1);
  for (const b of P.BAYS) gridPoly(B, 'mqSetts', box4(b.u0, b.v0, b.u1, b.v1 ?? -31.9), [], f, 0.012, 1);
  gridPoly(B, 'mqSetts', P.BIG_BAY, [], f, 0.012, 1);
  // kerb stops at the bays' north ends
  for (const b of P.BAYS) if (b.stop) { const S = P.STOP, u = (b.stop[0] + b.stop[1]) / 2, v = (S.v0 + S.v1) / 2, y = f(u, v); B.box('quadStone', u, y + S.h / 2 - 0.03, v, b.stop[1] - b.stop[0], S.h + 0.06, S.v1 - S.v0, 0, {}); }
  // gullies
  for (const [u, v] of P.GULLIES) B.box('ironBlack', u, f(u, v) + 0.014, v, 0.36, 0.012, 0.36, 0, { bottom: false });
  // the forecourt and the bed before the Rector's Lodgings, the steps to the Chapel's north door, the bins
  forecourt(ctx);
  chapelSteps(ctx);
  binStore(ctx);
  void corner;
}

/** the raised forecourt (64.39) along the Lodgings' west front with two steps along its west edge, and the walled bed */
function forecourt(ctx) {
  const { B } = ctx, T2 = P.TERRACE, BD = P.BED, rL = P.rL, f = P.groundY;
  const ring = (e0, s0, e1, s1) => [rL(e0, s0), rL(e1, s0), rL(e1, s1), rL(e0, s1)];
  const y1 = T2.y, y0 = T2.y - T2.rise, foot = (e, s) => f(...rL(e, s)) - 0.1;
  const et = T2.e0 + T2.tread;
  // the lower step (tread), the upper step's riser, the forecourt
  const lo = ring(T2.e0, T2.s0, et, T2.s1), hi = ring(et, T2.s0, T2.e1, T2.s1);
  B.flat('pavingSolid', lo, y0); B.flat('pavingSolid', hi, y1);
  const vert = (a, b, ya, yb, n) => B.poly('pavingSolid', [[a[0], ya, a[1]], [b[0], ya, b[1]], [b[0], yb, b[1]], [a[0], yb, a[1]]], [n[0], 0, n[1]]);
  const nW = [-Math.cos((5.4 * Math.PI) / 180), -Math.sin((5.4 * Math.PI) / 180)];
  vert(rL(T2.e0, T2.s1), rL(T2.e0, T2.s0), Math.min(foot(T2.e0, T2.s0), foot(T2.e0, T2.s1)), y0, nW);
  vert(rL(et, T2.s1), rL(et, T2.s0), y0, y1, nW);
  vert(rL(T2.e0, T2.s0), rL(T2.e1, T2.s0), foot(T2.e0, T2.s0), y1, [-nW[1], nW[0]].map((x) => -x));
  vert(rL(T2.e1, T2.s1), rL(T2.e0, T2.s1), foot(T2.e0, T2.s1), y1, [nW[1], -nW[0]].map((x) => -x));
  ctx.floor(lo, y0); ctx.floor(hi, y1);
  // the bed: a coped ashlar kerb wall round soil, shrubs
  const top = f(...rL(BD.e0, BD.s0)) + BD.top, t = BD.wallT;
  const outer = ring(BD.e0, BD.s0, BD.e1, BD.s1), innerR = ring(BD.e0 + t, BD.s0 + t, BD.e1, BD.s1 - t);
  K.prism(B, 'bathOld', outer, foot(BD.e0, BD.s0) - 0.1, top, { top: false });
  for (const [a, b] of [[[BD.e0, BD.s0], [BD.e0, BD.s1]], [[BD.e0, BD.s0], [BD.e1, BD.s0]], [[BD.e0, BD.s1], [BD.e1, BD.s1]]]) {
    const p = rL(...a), q = rL(...b); B.beam('bathDress', [p[0], top + 0.04, p[1]], [q[0], top + 0.04, q[1]], t + 0.06, 0.08);
  }
  B.flat('flowerbed', innerR, top - 0.1);
  ctx.solid(outer);
  for (let i = 0; i < 4; i++) {
    const s = BD.s0 + 0.9 + i * ((BD.s1 - BD.s0 - 1.8) / 3), e = (BD.e0 + BD.e1) / 2 + (i % 2 ? 0.5 : -0.5), q = rL(e, s);
    shrub(ctx, q[0], top - 0.1, q[1], { kind: ['laurel', 'box', 'flower', 'laurel'][i], r: 0.55 + 0.1 * (i % 2), h: 0.9 + 0.2 * (i % 3), seed: 71 + i * 5, lod: 0.8, blooms: ['bloomWhite'] });
  }
}

/** the steps up to the Chapel's north door: a landing at 65.05 and eight risers climbing west, a low cheek wall on the north */
function chapelSteps(ctx) {
  const { B } = ctx, S = P.CHAPEL_STEPS, f = P.groundY, vm = (S.v0 + S.v1) / 2;
  const yG = f(S.u1, vm), n = S.n, rise = (S.yTop - yG) / n, go = (S.u1 - S.uL) / (n - 1);
  B.box('pavingSolid', (S.u0 + S.uL) / 2, (S.yTop + yG - 0.2) / 2, vm, S.uL - S.u0, S.yTop - yG + 0.2, S.v1 - S.v0, 0, {});
  for (let k = 1; k < n; k++) { const yt = S.yTop - rise * k, a = S.uL + (k - 1) * go; B.box('pavingSolid', a + go / 2, (yt + yG - 0.2) / 2, vm, go, yt - yG + 0.2, S.v1 - S.v0, 0, {}); }
  // the cheek wall on the north side, stepped with the flight, coped
  const vw = S.v0 - S.wall / 2;
  B.box('bathOld', (S.u0 + S.uL) / 2, (S.yTop + S.wallH + yG - 0.2) / 2, vw, S.uL - S.u0 + 0.0, S.yTop + S.wallH - yG + 0.2, S.wall, 0, {});
  for (let k = 1; k < n; k++) { const yt = S.yTop - rise * k + S.wallH, a = S.uL + (k - 1) * go; B.box('bathOld', a + go / 2, (yt + yG - 0.2) / 2, vw, go, yt - yG + 0.2, S.wall, 0, {}); }
  B.beam('bathDress', [S.u0, S.yTop + S.wallH + 0.04, vw], [S.uL, S.yTop + S.wallH + 0.04, vw], S.wall + 0.06, 0.08);
  B.beam('bathDress', [S.uL, S.yTop + S.wallH + 0.04, vw], [S.u1, yG + S.wallH + 0.04, vw], S.wall + 0.06, 0.08);
  // floors; colliders: the cheek wall (the landing's back is the north projection's own solid: part 'chapel' NPROJ; the
  // stand-in segment along v -33.45 is gone, fix-up pass)
  ctx.floor(box4(S.u0, S.v0, S.uL, S.v1), S.yTop);
  ctx.floor(box4(S.uL, S.v0, S.u1, S.v1), (u) => S.yTop - rise * Math.min(n - 1, Math.max(1, Math.ceil((u - S.uL) / go))));
  ctx.seg(S.u0, S.v0 - S.wall, S.u1, S.v0 - S.wall);
}

/** the bins enclosure in the third bay: timber-boarded screens on posts, a few bins inside (survey "BINS"; satellite) */
function binStore(ctx) {
  const { B } = ctx, Bn = P.BINS, f = P.groundY;
  const screen = (u, va, vb) => {
    const y0 = Math.min(f(u, va), f(u, vb)) - 0.05, L = vb - va;
    B.box('binTimber', u, y0 + Bn.h / 2 + 0.05, (va + vb) / 2, Bn.t, Bn.h - 0.05, L, 0, {});
    for (let v = va; v <= vb + 1e-6; v += L / Math.max(1, Math.round(L / 1.8))) B.box('binPost', u, y0 + (Bn.h + 0.15) / 2, v, 0.09, Bn.h + 0.15, 0.09, 0, {});
    B.box('binPost', u, y0 + Bn.h + 0.06, (va + vb) / 2, Bn.t + 0.05, 0.04, L, 0, {});
    ctx.seg(u, va, u, vb);
  };
  screen(Bn.u0, Bn.v0, Bn.v1 - 0.05);
  screen(Bn.u1, Bn.eastFrom, Bn.v1 - 0.05);
  // two 1100-litre bins and four 240-litre wheelie bins (plain)
  // (fix-up pass) the bins: dark green and grey bodies a shade lighter than before, a lid that overhangs, a handle bar on
  // the front (east, the open side), wheels; two 1100-litre and four 240-litre (0.58 x 0.74 x 1.07: the standard size)
  const bin = (u, v, w, d, h, ry, key = 'binGreen') => {
    const y = f(u, v), c = Math.cos(ry), sn = Math.sin(ry);
    B.box(key, u, y + 0.1 + (h - 0.16) / 2, v, w, h - 0.16, d, ry, {});
    B.box(key === 'binGreen' ? 'binLid' : key, u, y + h - 0.03, v, w + 0.05, 0.06, d + 0.06, ry, {});
    const fx = u + sn * (d / 2 + 0.03), fz = v + c * (d / 2 + 0.03);      // the front face's middle (local +z)
    B.box('ironBlack', fx, y + h - 0.12, fz, w * 0.8, 0.035, 0.035, ry, {});
    for (const sx of [-0.38, 0.38]) B.box('ironBlack', u + c * sx * w, y + 0.06, v - sn * sx * w, 0.08, 0.12, 0.08, 0, {});
  };
  bin(0.45, -37.9, 1.37, 1.07, 1.33, Math.PI / 2);
  bin(0.45, -36.4, 1.37, 1.07, 1.33, Math.PI / 2, 'binGrey');
  for (let i = 0; i < 4; i++) bin(0.1 + 0.37, -34.8 + i * 0.7, 0.58, 0.74, 1.07, Math.PI / 2, i % 2 ? 'binGrey' : 'binGreen');
  ctx.solid(box4(-0.25, -38.6, 1.15, -35.7));
}

// ------------------------------------------------------------------------------------------------ things in the quad, lamps
/** a plain bicycle standing at (u, v) on ground y, its length along direction ry (0 = along +u) */
function bicycle(B, u, v, y, ry, k = 'bikeFrame') {
  const M = new THREE.Matrix4().makeRotationY(ry).setPosition(u, y, v);
  B.push(M);
  const r = 0.34, wb = 1.05;
  for (const x of [-wb / 2, wb / 2]) { B.push(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, r, 0)); B.cyl('ironBlack', 0, -0.02, 0, r, 0.04, 14, false, r); B.cyl('ironBlack', 0, -0.02, 0, r - 0.025, 0.04, 14, false, r - 0.025); B.beam('galv', [0, -0.005, -r + 0.03], [0, -0.005, r - 0.03], 0.012); B.beam('galv', [-r + 0.03, -0.005, 0], [r - 0.03, -0.005, 0], 0.012); B.pop(); }      // (fix-up pass: a tyre and rim with two spokes, not a solid black disc)
  const P0 = [-wb / 2, r, 0], P1 = [wb / 2, r, 0], Sd = [-0.12, r + 0.02, 0], H = [0.36, 0.86, 0], Se = [-0.18, 0.9, 0];
  B.beam(k, P0, Sd, 0.03); B.beam(k, Sd, Se, 0.03); B.beam(k, Sd, H, 0.035); B.beam(k, Se, H, 0.03); B.beam(k, P0, Se, 0.025); B.beam(k, H, P1, 0.03);
  B.box('ironBlack', Se[0], Se[1] + 0.03, 0, 0.24, 0.05, 0.1, 0, {}); B.box('ironBlack', H[0] + 0.03, H[1] + 0.12, 0, 0.04, 0.04, 0.55, 0, {});
  B.pop();
}
export function buildFurniture(ctx) {
  const { B } = ctx, f = P.groundY;
  // "Alma Mater" (J. de Alberdi 1968, marble): a pale abstracted standing figure on a pedestal on a round stone base
  {
    const A = P.ALMA_MATER, y0 = f(A.u, A.v);
    B.cyl('quadStone', A.u, y0 - 0.05, A.v, A.base, A.baseH + 0.05, 16, true, A.base);
    B.box('marble', A.u, y0 + A.baseH + A.ped[1] / 2, A.v, A.ped[0], A.ped[1], A.ped[0], 0, { bottom: true });
    figure(B, A.u, y0 + A.baseH + A.ped[1], A.v, A.h, Math.PI, 'marble', true);
    const r = A.base; ctx.solid([[A.u - r, A.v - r], [A.u + r, A.v - r], [A.u + r, A.v + r], [A.u - r, A.v + r]]);
  }
  // Sheffield cycle stands with a few bicycles
  {
    let nb = 0;
    for (const R of P.CYCLES.rows) for (let i = 0; i < R.n; i++) {
      const t = R.n > 1 ? i / (R.n - 1) : 0, u = R.axis === 'u' ? R.u : R.u0 + (R.u1 - R.u0) * t, v = R.axis === 'u' ? R.v0 + (R.v1 - R.v0) * t : R.v;
      const y0 = f(u, v) - 0.05, du = R.axis === 'u' ? 0.4 : 0, dv = R.axis === 'u' ? 0 : 0.4;
      const a = [u - du, v - dv], b = [u + du, v + dv];
      B.beam('galv', [a[0], y0, a[1]], [a[0], y0 + 0.8, a[1]], 0.05); B.beam('galv', [b[0], y0, b[1]], [b[0], y0 + 0.8, b[1]], 0.05);
      B.beam('galv', [a[0] - du * 0.06, y0 + 0.8, a[1] - dv * 0.06], [b[0] + du * 0.06, y0 + 0.8, b[1] + dv * 0.06], 0.05);
      if (nb < P.CYCLES.bikes && (i % 3 !== 2)) { const side = nb % 2 ? 0.22 : -0.22; bicycle(B, u + (R.axis === 'u' ? 0.15 : side), v + (R.axis === 'u' ? side : 0.15), f(u, v), R.axis === 'u' ? 0 : Math.PI / 2, ['bikeFrame', 'bikeFrame2', 'ironBlack'][nb % 3]); nb++; }
    }
  }
  // planters with clipped shrubs
  for (const Pl of P.PLANTERS) {
    const y0 = f(Pl.u, Pl.v), h = 0.55;
    if (Pl.round) B.cyl('quadStone', Pl.u, y0 - 0.03, Pl.v, Pl.w / 2, h, 12, true, Pl.w / 2 - 0.05);
    else B.box('quadStone', Pl.u, y0 + h / 2 - 0.03, Pl.v, Pl.w, h, Pl.w, Pl.rot || 0, {});
    shrub(ctx, Pl.u, y0 + h - 0.05, Pl.v, { kind: 'box', r: Pl.w * 0.5, h: Pl.w * 0.8, seed: 13 + Pl.u, lod: 0.8 });
    ctx.solid([[Pl.u - Pl.w / 2, Pl.v - Pl.w / 2], [Pl.u + Pl.w / 2, Pl.v - Pl.w / 2], [Pl.u + Pl.w / 2, Pl.v + Pl.w / 2], [Pl.u - Pl.w / 2, Pl.v + Pl.w / 2]]);
  }
  // lanterns (16/00769/LBC): C1 on the TW, W1 on the Chapel's north wall
  for (const L of P.LAMPS) {
    let u, v, nu, nv;
    if (L.face === 'S') { const p = P.bw(XWQ + L.d, P.BROAD_DEPTH); u = p[0]; v = p[1]; nu = P.BN[0]; nv = P.BN[1]; }
    else if (L.face === 'E') { u = L.u; v = L.v; nu = 1; nv = 0; }
    else { u = L.u; v = L.v; nu = 0; nv = -1; }
    const y = f(u, v) + L.y + 0.45, arm = L.face === 'N' ? 0.59 : 0.28;
    B.box('ironBlack', u + nu * 0.02, y + 0.2, v + nv * 0.02, nu ? 0.04 : 0.25, 0.38, nu ? 0.25 : 0.04, 0, {});
    B.beam('ironBlack', [u, y + 0.28, v], [u + nu * arm, y + 0.28, v + nv * arm], 0.04);
    const p = K.lantern(B, u + nu * arm, y - 0.1, v + nv * arm, { size: L.face === 'N' ? 0.26 : 0.2 });
    ctx.lamp(p[0], p[1], p[2]);
  }
}

// ------------------------------------------------------------------------------------------------ colliders
export function registerSolids(ctx, corner) {
  // (fix-up pass) the ring takes staircase 12's door reveal in (stairStrip: the door c - 0.62 .. c + 0.28, 0.25 deep), so a
  // walker reaches the door without rubbing the face line drawn across its mouth; a threshold floor in the reveal
  const c12 = XWQ + (P.BQ.stair.d0 + P.BQ.stair.d1) / 2, dA = c12 - 0.62, dB = c12 + 0.28, zR = P.BROAD_DEPTH - 0.21, yq = P.quadY(-10, -52);
  ctx.solid([P.CORNER, P.EAST_END, P.bw(P.BROAD_LEN, P.BROAD_DEPTH), P.bw(dB, P.BROAD_DEPTH), P.bw(dB, zR), P.bw(dA, zR), P.bw(dA, P.BROAD_DEPTH), QW, [T.uWingQ, VCS], [T.uWing, VCS], [T.uCorner, VCS]]);
  ctx.floor([P.bw(dA, zR), P.bw(dB, zR), P.bw(dB, P.BROAD_DEPTH + 0.05), P.bw(dA, P.BROAD_DEPTH + 0.05)], yq);
  ctx.solid([[T.uWing, VCS], [T.uWingQ, VCS], [T.uWingQ, T.vTowerN], [T.uWing, T.vTowerN]]);
  const pa = SW.passage;
  // (lead, touch-up: the ring ran across this part's own doorway and across the west range's passage behind it; the
  //  doorway v pa.v0 .. pa.v1 is left open, the west range's corner mass closes the south side)
  ctx.solid([[T.uTower, T.vTowerS], [T.uTower, T.vTowerN], [T.uTowerQ, T.vTowerN], [T.uTowerQ, pa.v0], [pa.uIn, pa.v0], [pa.uIn, T.vTowerS]]);
  ctx.seg(T.uTowerQ, pa.v1, pa.uIn, pa.v1);
  // the lobby: its north wall either side of the door, its east wall, the Chapel's wall behind it
  const Lb = SW.lobby, vi = Lb.v0 + Lb.t;
  ctx.seg(Lb.u0, vi, Lb.door[0], vi); ctx.seg(Lb.door[1], vi, Lb.u1 - Lb.t, vi);
  ctx.seg(Lb.u0, Lb.v0, Lb.door[0], Lb.v0); ctx.seg(Lb.door[1], Lb.v0, Lb.u1, Lb.v0);
  ctx.seg(Lb.u1 - Lb.t, vi, Lb.u1 - Lb.t, Lb.v1); ctx.seg(Lb.u1, Lb.v0, Lb.u1, Lb.v1); ctx.seg(Lb.u0, Lb.v1 - 0.05, Lb.u1, Lb.v1 - 0.05);
  const w = SW.well;
  ctx.solid([[w.u1, w.vTop], [w.u1 + SW.wallT, w.vTop], [w.u1 + SW.wallT, T.vTowerN - 0.25], [w.u0, T.vTowerN - 0.25], [w.u0, T.vTowerN], [w.u1, T.vTowerN]]);
  void corner;
}
