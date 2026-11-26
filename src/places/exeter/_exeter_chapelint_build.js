// Exeter College, STANDALONE model, part 'chapelint': the build functions of the CHAPEL'S INTERIOR. Everything is drawn in
// the LOCAL frame (ctx.B) and in wall frames:
//   the OUTER frames of part 'chapel' (so the splays meet its glass exactly): FS south (s = u - WEST, +z south), FN north
//   (s = JUNCTION - u, +z north), FW west (s = v - WALL_N, +z west), the apse facets (s from the facet's south end); the
//   room's inner faces are drawn in them at z = -T, facing -z (into the room);
//   INNER frames facing into the room for what stands on a face: FSi (s = JUNCTION - u), FNi (s = u - UW), FWi (s = VS - v),
//   the apse's inner facets (s from the facet's north end).
// Figures and sources: _exeter_chapelint_plan.js. Reusable pieces: _exeter_interior_kit.js.
import * as K from './_exeter_kit.js';
import * as IK from './_exeter_interior_kit.js';
import * as P from './_exeter_chapelint_plan.js';
import { APSE, apsePt, BUTTRESS_U } from './_exeter_chapel_plan.js';

const { frame, rectPts } = K;
const D2R = Math.PI / 180;
const { F, T, VS, VN, HW, UW, C, RI, APO, TA, SPRING, CROWN, LUN, DIV, WEST, WALL_S, WALL_N, JUNCTION, VC } = P;

// ------------------------------------------------------------------------------------------------ the vault's surface
/** a pointed profile (two arcs centred on the springing line): half-span r, rise; f(x) height at x from its middle, inv(y) */
function pointed(r, rise) {
  const R = (r * r + rise * rise) / (2 * r), xc = r - R;
  return {
    r, rise,
    f: (x) => { const a = Math.min(Math.abs(x), r); return SPRING + Math.sqrt(Math.max(0, R * R - (a - xc) * (a - xc))); },
    inv: (y) => Math.max(0, Math.min(r, xc + Math.sqrt(Math.max(0, R * R - (y - SPRING) * (y - SPRING))))),
  };
}
const MAIN = pointed(HW, CROWN - SPRING);
const BAYS = DIV.slice(0, -1).map((a, i) => { const b = DIV[i + 1], h = (b - a) / 2; return { a, b, m: (a + b) / 2, h, lun: pointed(h, (i === 0 ? LUN.west : LUN.nave) - SPRING) }; });
const HF = RI * Math.sin(18 * D2R);                    // half an inner apse facet (1.41)
const LUNA = pointed(HF, LUN.apse - SPRING);
const ANG = APSE.angs;
const MID_A = ANG.slice(0, -1).map((a, i) => (a + ANG[i + 1]) / 2);
function sectorOf(u, v) {
  const a = Math.atan2(v - C[1], u - C[0]) / D2R;
  for (let i = 0; i < 5; i++) if (a <= ANG[i] + 1e-6 && a >= ANG[i + 1] - 1e-6) return i;
  return a > 0 ? 0 : 4;
}
/** the vault's underside over LOCAL (u, v); which: 'main' | 'lun' (the part that wins) */
function vault(u, v) {
  if (u <= JUNCTION) {
    let bay = BAYS[BAYS.length - 1]; for (const b of BAYS) if (u <= b.b) { bay = b; break; }
    const m = MAIN.f(v - VC), l = bay.lun.f(u - bay.m);
    return m >= l ? { y: m, which: 'main' } : { y: l, which: 'lun' };
  }
  const i = sectorOf(u, v), a = MID_A[i] * D2R, du = u - C[0], dv = v - C[1];
  const proj = du * Math.cos(a) + dv * Math.sin(a), tt = -du * Math.sin(a) + dv * Math.cos(a);
  const m = MAIN.f((HW * proj) / APO), l = LUNA.f(tt);
  return m >= l ? { y: m, which: 'main' } : { y: l, which: 'lun' };
}
const vy = (u, v) => vault(u, v).y;
/** the downward normal of the vault at (u, v) (towards the room), from its slope */
function vnorm(u, v) {
  const e = 0.03, gu = (vy(u + e, v) - vy(u - e, v)) / (2 * e), gv = (vy(u, v + e) - vy(u, v - e)) / (2 * e);
  const cl = (g) => Math.max(-25, Math.min(25, g)), x = cl(gu), z = cl(gv), L = Math.hypot(x, 1, z);
  return [x / L, -1 / L, z / L];
}

// ------------------------------------------------------------------------------------------------ small helpers
const circ = (x, y, r, n = 8, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + (i / n) * Math.PI * 2; return [x + Math.cos(a) * r, y + Math.sin(a) * r]; });
/** a flat-faced bar in the current frame from a to b ([s, y]), w wide, its face at z0 standing d deep (front + 2 sides) */
function bar(B, key, a, b, w, z0, d) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1e-4) return;
  const px = (-dy / L) * (w / 2), py = (dx / L) * (w / 2), z1 = z0 - d;
  B.poly(key, [[a[0] + px, a[1] + py, z0], [a[0] - px, a[1] - py, z0], [b[0] - px, b[1] - py, z0], [b[0] + px, b[1] + py, z0]], [0, 0, 1]);
  B.poly(key, [[a[0] + px, a[1] + py, z0], [b[0] + px, b[1] + py, z0], [b[0] + px, b[1] + py, z1], [a[0] + px, a[1] + py, z1]], [px, py, 0]);
  B.poly(key, [[a[0] - px, a[1] - py, z0], [b[0] - px, b[1] - py, z0], [b[0] - px, b[1] - py, z1], [a[0] - px, a[1] - py, z1]], [-px, -py, 0]);
}
const bars = (B, key, pts, w, z0, d, closed = false) => { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) bar(B, key, pts[i], pts[(i + 1) % pts.length], w, z0, d); };
/** the arc of a pointed arch (springing to springing over the apex) */
const arcOf = (x, w, ys, rise, seg = 6) => K.pointedPts(x, w, ys - 1, ys, rise, seg).slice(2);
/** a quatrefoil outline (CCW) centred (x, y) */
const quatrefoil = (x, y, r, n = 16) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, k = 0.62 + 0.38 * Math.abs(Math.cos(2 * a)); return [x + Math.cos(a) * r * k, y + Math.sin(a) * r * k]; });
/** clip a plan polygon to u0 <= u <= u1 (Sutherland-Hodgman) */
function clipU(poly, u0, u1) {
  const cut = (Pl, k, keepGreater) => { const o = []; for (let i = 0; i < Pl.length; i++) { const p = Pl[i], q = Pl[(i + 1) % Pl.length], ip = keepGreater ? p[0] >= k : p[0] <= k, iq = keepGreater ? q[0] >= k : q[0] <= k; if (ip) o.push(p); if (ip !== iq) { const t = (k - p[0]) / (q[0] - p[0]); o.push([k, p[1] + (q[1] - p[1]) * t]); } } return o; };
  return cut(cut(poly, u0, true), u1, false);
}
/** the room's half-width at u (the apse narrows it) */
function halfAt(u) {
  if (u <= JUNCTION) return HW;
  let best = 0; const R = P.INNER;
  for (let i = 0; i < R.length; i++) { const p = R[i], q = R[(i + 1) % R.length]; if ((p[0] - u) * (q[0] - u) > 0 || p[0] === q[0]) continue; const v = p[1] + ((u - p[0]) / (q[0] - p[0])) * (q[1] - p[1]); best = Math.max(best, Math.abs(v - VC)); }
  return best;
}
/** a rib hung under the vault along LOCAL plan points [[u, v], ...] (y from the vault, or given as [u, v, y]) */
function rib(B, key, pts, o = {}) {
  const w = (o.w ?? P.RIB.w) / 2, d = o.d ?? P.RIB.d;
  const S = pts.map((p) => { const y = p.length > 2 ? p[2] : vy(p[0], p[1]); return { p: [p[0], y - 0.004, p[1]], n: vnorm(p[0], p[1]) }; });
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1], t = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]];
    const n = [(a.n[0] + b.n[0]) / 2, (a.n[1] + b.n[1]) / 2, (a.n[2] + b.n[2]) / 2];
    let s = [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]]; const sl = Math.hypot(...s) || 1; s = s.map((c) => (c / sl) * w);
    const A0 = a.p, B0 = b.p, off = (P0, N) => [P0[0] + N[0] * d, P0[1] + N[1] * d, P0[2] + N[2] * d];
    const A1 = off(A0, a.n), B1 = off(B0, b.n), add = (P0, k) => [P0[0] + s[0] * k, P0[1] + s[1] * k, P0[2] + s[2] * k];
    B.poly(key, [add(A1, -1), add(A1, 1), add(B1, 1), add(B1, -1)], n);
    B.poly(key, [add(A0, 1), add(B0, 1), add(B1, 1), add(A1, 1)], s);
    B.poly(key, [add(A0, -1), add(A1, -1), add(B1, -1), add(B0, -1)], s.map((c) => -c));
  }
}
/** n + 1 samples 0..1 dense at both ends (cosine) or at the start only ('start') */
const dense = (n, mode = 'both') => Array.from({ length: n + 1 }, (_, i) => (mode === 'both' ? 0.5 - 0.5 * Math.cos((Math.PI * i) / n) : 1 - Math.cos((Math.PI / 2) * (i / n))));
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ------------------------------------------------------------------------------------------------ cells
function cells(pack) {
  const add = (k, from, t, o) => K.addCell(pack, k, from, t, o);
  add('chStone', 'stone', [1.12, 1.08, 0.97], { seed: 0.3 });
  add('chDress', 'stoneDress', [1.16, 1.11, 1.0]);
  // (2026-11-23: the webs' bands were cream against a strong brown (0xdab680) and read as dark stripes; the photographs
  //  (Hoser 2015, Diliff 2014) show cream Bath stone with only a slightly darker buff course of Temple Guiting stone)
  add('vaultA', 'stoneDress', 0xeee2c4); add('vaultB', 'stoneDress', 0xe6d5b2);
  add('chMarble', 'lead', 0x2e2a28); add('chMarbleR', 'lead', 0x7a3226); add('chRing', 'gold', 0x8a7040);
  // (Diliff 2014: a warm mid oak, dark under the canopies but never black: linear multipliers of the light neutral boards, set
  //  for the room's dim light; 2026-11-23 raised from 0x9e6c44 / 0x6e4a2c / 0xb48452, which read black under the hoods)
  add('chOak', 'boards', [0.5, 0.3, 0.145]); add('chOakDk', 'boards', [0.3, 0.17, 0.08]); add('chOakLt', 'boards', [0.68, 0.44, 0.22]);
  add('chFlag', 'white', 0xd6cdb6); add('chCream', 'white', 0xe9dfc6); add('chStrip', 'dark', 0x34302c);
  add('tileRed', 'white', 0x8c3e26); add('tileBuff', 'white', 0xc6a46c); add('tileDark', 'dark', 0x3c2416);
  add('chMarbleStep', 'white', 0x9c8c80); add('tablet', 'white', 0xd9d2c2);      // (the antechapel's memorial tablets: a pale grey-white marble)
  add('mosaicGold', 'gold', 0xd0a640); add('mosaicShape', 'dark', 0x6c5232); add('mosaicBand', 'gold', 0xa8823a); add('hangBlue', 'dark', 0x1e2a5c);
  add('shield0', 'dark', 0xa02c24); add('shield1', 'dark', 0x2a3c86); add('shield2', 'dark', 0x2e5c32); add('shield3', 'gold', 0xd0aa44); add('shieldW', 'white', 0xe2dac2);
  add('chBrass', 'gold', 0xc0a04c); add('candle', 'white', 0xf2ecda);
  add('organCase', 'boards', 0x3a2618); add('pipeGold', 'gold', 0xc4a454); add('pipeBlue', 'lead', 0x3c4c80); add('pipeRed', 'lead', 0x8c3c30);
  add('tapestry', 'dark', 0x2c2620); add('tapMuted', 'dark', 0x504034); add('tapGreen', 'dark', 0x34402e); add('tapRed', 'dark', 0x5a2a22);
  add('altarCloth', 'dark', 0x3c5c3c); add('tabPaint', 'gold', 0xd2aa4c); add('tabRed', 'dark', 0x7c2c24);
}

// ------------------------------------------------------------------------------------------------ frames
const FS = () => frame(WEST, 0, WALL_S, 1, 0), sS = (u) => u - WEST;
const FN = () => frame(JUNCTION, 0, WALL_N, -1, 0), sN = (u) => JUNCTION - u;
const FW = () => frame(WEST, 0, WALL_N, 0, 1), sW = (v) => v - WALL_N;
const FSi = () => frame(JUNCTION, 0, VS, -1, 0), sSi = (u) => JUNCTION - u;
const FNi = () => frame(UW, 0, VN, 1, 0), sNi = (u) => u - UW;
const FWi = () => frame(UW, 0, VS, 0, -1), sWi = (v) => VS - v;
/** the apse's outer facet i (s from its south end, as part 'chapel'), and its inner facet (s from the north end, facing in) */
function apseFacet(i) {
  const a = apsePt(ANG[i]), b = apsePt(ANG[i + 1]), L = Math.hypot(b[0] - a[0], b[1] - a[1]), t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const ia = P.apseIn(ANG[i]), ib = P.apseIn(ANG[i + 1]), Li = Math.hypot(ib[0] - ia[0], ib[1] - ia[1]);
  const proj = (p) => (p[0] - a[0]) * t[0] + (p[1] - a[1]) * t[1];
  return { F: frame(a[0], 0, a[1], t[0], t[1]), L, s0: proj(ia), s1: proj(ib), Fi: frame(ib[0], 0, ib[1], (ia[0] - ib[0]) / Li, (ia[1] - ib[1]) / Li), Li, ia, ib };
}
/** the top of a long wall's inner face: the lunette curves of the bays between s(u) of a and b (n points a bay) */
function lunetteTop(sOf, n = 10) {
  const pts = [];
  for (const [bi, b] of BAYS.entries()) for (let k = bi ? 1 : 0; k <= n; k++) { const u = b.a + ((b.b - b.a) * k) / n; pts.push([sOf(u), b.lun.f(u - b.m)]); }
  return pts;
}

// ------------------------------------------------------------------------------------------------ walls and windows inside
const winPts = (x, W) => K.pointedPts(x, W.w, W.sill, W.spring, W.apex - W.spring, 8);
const rearPts = (x, R) => K.pointedPts(x, R.w, R.sill, R.spring, R.apex - R.spring, 8);
const ROSE_GLASS = () => K.pointedPts(sS(P.ROSE_U), P.ROSE.w, P.ROSE.low, P.ROSE.spring, P.ROSE.apex - P.ROSE.spring, 8);
const DOOR = () => { const Q = P.PORCH, uc = (Q.u0 + Q.u1) / 2, hw = Q.door[2] / 2; return { uc, hw, y0: Q.door[0], y1: Q.door[1] }; };

function southWall(ctx) {
  const { B } = ctx, D = DOOR();
  const top = lunetteTop(sS).reverse(), outline = [[sS(UW), F - 0.05], [sS(JUNCTION), F - 0.05], ...top];
  const holes = P.WINDOW_U.map((u) => rearPts(sS(u), P.REAR));
  holes.push(rearPts(sS(P.ROSE_U), P.REAR_ROSE));
  holes.push(rectPts(sS(D.uc - D.hw), D.y0, sS(D.uc + D.hw), D.y1));
  B.push(FS());
  B.face('chStone', outline, holes, -T, true);
  for (const u of P.WINDOW_U) IK.splay(B, 'chStone', winPts(sS(u), P.WIN), -P.GLASS_Z, rearPts(sS(u), P.REAR), -T);
  IK.splay(B, 'chStone', ROSE_GLASS(), -P.GLASS_Z, rearPts(sS(P.ROSE_U), P.REAR_ROSE), -T);
  B.pop();
}
function northWall(ctx) {
  const { B } = ctx, A = P.N_ARCH, outer = archOrders()[0];
  const ring = [[0, F - 0.05], [sN(UW), F - 0.05], ...lunetteTop(sN)];      // (lunetteTop runs west to east: s falls to 0)
  const holes = P.WINDOW_U.map((u) => rearPts(sN(u), P.REAR));
  holes.push(K.pointedPts(sN(A.u), outer.w, F, A.spring, outer.apex - A.spring, 8));
  B.push(FN());
  B.face('chStone', ring, holes, -T, true);
  for (const u of P.WINDOW_U) IK.splay(B, 'chStone', winPts(sN(u), P.WIN), -P.GLASS_Z, rearPts(sN(u), P.REAR), -T);
  B.pop();
}
function westWall(ctx) {
  const { B } = ctx, m = (WALL_S - WALL_N) / 2, R = P.WEST_GABLE.rose, n = 24;
  const top = []; for (let k = n; k >= 0; k--) { const v = VN + ((VS - VN) * k) / n; top.push([sW(v), MAIN.f(v - VC)]); }
  const ring = [[sW(VN), F - 0.05], [sW(VS), F - 0.05], ...top];
  B.push(FW());
  B.face('chStone', ring, [circ(m, R.cy, P.REAR_WROSE, 14)], -T, true);
  IK.splay(B, 'chStone', circ(m, R.cy, R.r, 14), -P.GLASS_Z, circ(m, R.cy, P.REAR_WROSE, 14), -T);
  B.pop();
}
function apseWalls(ctx) {
  const { B } = ctx;
  for (let i = 0; i < 5; i++) {
    const f = apseFacet(i), mid = f.L / 2, top = [];
    for (let k = 10; k >= 0; k--) { const s = f.s0 + ((f.s1 - f.s0) * k) / 10; top.push([s, LUNA.f(s - mid)]); }
    B.push(f.F);
    B.face('chStone', [[f.s0, F - 0.05], [f.s1, F - 0.05], ...top], [rearPts(mid, P.REAR_APSE)], -TA, true);
    IK.splay(B, 'chStone', winPts(mid, P.APSE_WIN), -P.GLASS_Z, rearPts(mid, P.REAR_APSE), -TA);
    B.pop();
    // the sill string under the window (over the arcade's band)
    B.push(f.Fi); B.box('chDress', f.Li / 2, P.ARCADE.sill - 0.06, 0.06, f.Li - 0.3, 0.12, 0.12, 0, { bottom: true }); B.pop();
  }
}

// ------------------------------------------------------------------------------------------------ the vault
function vaultWebs(ctx) {
  const { B } = ctx, key = (which, i, j) => ((which === 'main' ? i : j) % 2 ? 'vaultB' : 'vaultA');
  const quad = (p00, p10, p11, p01, k) => B.poly(k, [p00, p10, p11, p01], [0, -1, 0]);
  // the straight part, bay by bay: u dense at the bay's ends (the lunettes' feet), v dense at the walls
  const vs = dense(22).map((t) => VN + (VS - VN) * t);
  for (const b of BAYS) {
    const us = dense(12).map((t) => b.a + (b.b - b.a) * t);
    const Y = us.map((u) => vs.map((v) => vy(u, v)));
    for (let j = 0; j < us.length - 1; j++) for (let i = 0; i < vs.length - 1; i++) {
      const w = vault((us[j] + us[j + 1]) / 2, (vs[i] + vs[i + 1]) / 2).which;
      quad([us[j], Y[j][i], vs[i]], [us[j + 1], Y[j + 1][i], vs[i]], [us[j + 1], Y[j + 1][i + 1], vs[i + 1]], [us[j], Y[j][i + 1], vs[i + 1]], key(w, Math.floor(i / 1), j));
    }
  }
  // the apse, sector by sector: from the wall (p = APO) to the centre, across the facet
  const np = 10, nt = 10;
  for (let s = 0; s < 5; s++) {
    const a = MID_A[s] * D2R, n = [Math.cos(a), Math.sin(a)], t = [-Math.sin(a), Math.cos(a)], tan = Math.tan(18 * D2R);
    const pt = (p, k) => { const tt = p * tan * (-Math.cos((Math.PI * k) / nt)); const u = C[0] + n[0] * p + t[0] * tt, v = C[1] + n[1] * p + t[1] * tt; return [u, vy(u, v), v]; };
    const ps = Array.from({ length: np + 1 }, (_, k) => APO * Math.cos((Math.PI / 2) * (k / np)));
    for (let k = 0; k < np; k++) for (let j = 0; j < nt; j++) {
      const A0 = pt(ps[k], j), A1 = pt(ps[k], j + 1), B1 = pt(ps[k + 1], j + 1), B0 = pt(ps[k + 1], j);
      const w = vault((A0[0] + B1[0]) / 2, (A0[2] + B1[2]) / 2).which;
      if (k === np - 1) B.poly(key(w, k, j), [A0, A1, B0], [0, -1, 0]);
      else quad(A0, A1, B1, B0, key(w, k, j));
    }
  }
}
function vaultRibs(ctx) {
  const { B } = ctx, n = P.RIB.seg, k = 'chDress';
  const path = (a, b, mode = 'both', m = n) => dense(m, mode).map((t) => lerp2(a, b, t));
  const yLunMain = (b) => MAIN.inv(b.lun.f(0));       // the distance from the axis of a lunette's apex
  // transverse ribs at every division (and a wall rib on the west wall)
  for (const u of DIV) rib(B, k, path([u === UW ? u + 0.09 : u, VS], [u === UW ? u + 0.09 : u, VN], 'both', 2 * n));
  // the ridge rib
  rib(B, k, path([UW + 0.1, VC], [C[0], VC], 'both', 30).map(([u, v]) => [u, v, CROWN]));
  for (const b of BAYS) {
    for (const side of [1, -1]) {
      const vw = side > 0 ? VS : VN, xA = yLunMain(b), apex = [b.m, VC + side * xA];
      // wall ribs along the lunette
      rib(B, k, dense(n).map((t) => { const u = b.a + (b.b - b.a) * t; return [u, vw - side * 0.08, b.lun.f(u - b.m)]; }), { w: 0.14, d: 0.12 });
      // groin ribs: from each corner along the crease to the lunette's apex
      for (const e of [-1, 1]) {
        const pts = dense(n, 'start').map((t) => { const y = SPRING + (b.lun.f(0) - SPRING) * t; return [b.m + e * b.lun.inv(y), VC + side * MAIN.inv(y), y]; });
        rib(B, k, pts);
      }
      // tiercerons: from each corner to the bay's middle boss
      for (const e of [-1, 1]) rib(B, k, path([b.m + e * b.h, vw], [b.m, VC], 'start'));
      // the lateral ridge: from the lunette's apex to the middle boss
      rib(B, k, path(apex, [b.m, VC], 'both', 5), { w: 0.14 });
    }
  }
  // the apse: radial ribs from the inner corners, the facets' wall ribs and ridges
  for (let i = 1; i < 5; i++) rib(B, k, path(P.apseIn(ANG[i]), C, 'start'));
  for (let i = 0; i < 5; i++) {
    const f = apseFacet(i), a = MID_A[i] * D2R, nrm = [Math.cos(a), Math.sin(a)], tg = [-Math.sin(a), Math.cos(a)];
    rib(B, k, dense(n).map((t) => { const tt = -HF + 2 * HF * t, p = APO - 0.08; return [C[0] + nrm[0] * p + tg[0] * tt, C[1] + nrm[1] * p + tg[1] * tt, LUNA.f(tt)]; }), { w: 0.14, d: 0.12 });
    rib(B, k, path([C[0] + nrm[0] * APO, C[1] + nrm[1] * APO], C, 'both', 6), { w: 0.14 });
    void f;
  }
  // bosses: on the ridge at the divisions and mid-bays, the apse's centre
  const boss = (u, v) => { const y = vy(u, v); B.box('chDress', u, y - 0.12, v, P.BOSS, 0.24, P.BOSS, Math.PI / 4, { bottom: true }); B.box('vaultB', u, y - 0.25, v, P.BOSS * 0.55, 0.1, P.BOSS * 0.55, 0, { bottom: true }); };
  for (const u of DIV.slice(1)) boss(u, VC);
  for (const b of BAYS) boss(b.m, VC);
  boss(C[0] + 0.6, VC);
}

// ------------------------------------------------------------------------------------------------ shafts
function shaftAt(B, u, v, nu, nv, y0) {
  const S = P.SHAFT, tu = -nv, tv = nu, cu = u + nu * S.off, cv = v + nv * S.off, h = SPRING - y0 - S.cap;
  B.cyl('chMarble', cu, y0, cv, S.r, h, 8, false);
  for (const e of [-1, 1]) B.cyl('chDress', cu + tu * e * 0.21 - nu * 0.06, y0, cv + tv * e * 0.21 - nv * 0.06, S.r2, h, 6, false);
  for (const y of S.rings) if (y > y0 + 0.3) B.cyl('chRing', cu, y, cv, S.r + 0.035, 0.07, 8, true);
  const yc = SPRING - S.cap;      // the foliage capital: a bell flaring out, an abacus
  B.cyl('chDress', cu - nu * 0.05, yc, cv - nv * 0.05, 0.36, S.cap - 0.12, 8, false, 0.16);
  B.cyl('chDress', cu - nu * 0.05, SPRING - 0.12, cv - nv * 0.05, 0.4, 0.12, 8, true);
  if (y0 > F + 1) {      // a pale carved corbel under it (the choir)
    B.cyl('chDress', cu - nu * 0.05, y0 - 0.55, cv - nv * 0.05, 0.3, 0.55, 8, true, 0.08);
  }
}
function shafts(ctx) {
  const { B } = ctx, S = P.SHAFT;
  for (const u of BUTTRESS_U) {
    const y0 = u < -10 ? P.SCREEN.top : S.corbel;
    shaftAt(B, u, VS, 0, -1, y0); shaftAt(B, u, VN, 0, 1, y0);
  }
  shaftAt(B, JUNCTION, VS, 0, -1, F); shaftAt(B, JUNCTION, VN, 0, 1, F);
  for (let i = 1; i < 5; i++) { const p = P.apseIn(ANG[i]), a = ANG[i] * D2R; shaftAt(B, p[0], p[1], -Math.cos(a), -Math.sin(a), P.ARCADE.base); }
  for (const v of [VS, VN]) shaftAt(B, UW + 0.12, v, 0.5, v === VS ? -0.86 : 0.86, P.GALLERY.floor);
}

// ------------------------------------------------------------------------------------------------ floors, sanctuary
function floors(ctx) {
  const { B } = ctx, Sa = P.SANCT, r = Sa.rise, A = P.AISLE, D = DOOR();
  const room = P.INNER;
  // levels across the sanctuary (u breaks, the level beyond each)
  const steps = [[Sa.step1, F + r], [Sa.tilesTo, F + 2 * r], [Sa.tilesTo + Sa.going, F + 3 * r], [Sa.landing[1], F + 4 * r], [Sa.landing[1] + Sa.going, F + 5 * r]];
  const spans = [[UW, Sa.step1, F, 'chFlag']];
  for (let i = 0; i < steps.length; i++) spans.push([steps[i][0], i + 1 < steps.length ? steps[i + 1][0] : 99, steps[i][1], i === 0 ? 'tileRed' : i === 2 ? 'tileBuff' : i === 4 ? 'tileRed' : 'chMarbleStep']);
  for (const [u0, u1, y, key] of spans) {
    const poly = clipU(room, u0, u1); if (poly.length < 3) continue;
    B.flat(key, poly, y + 0.002);
    ctx.floor(poly, y);
    // the riser at u0 (not the first span)
    if (u0 > UW + 0.1) { const h = halfAt(u0) - 0.01, yb = y - r; B.poly('chMarbleStep', [[u0, yb, VC - h], [u0, yb, VC + h], [u0, y, VC + h], [u0, y, VC - h]], [-1, 0, 0]); B.box('chMarbleStep', u0 + 0.03, y + 0.01, VC, 0.08, 0.03, 2 * h - 0.02, 0, {}); }
  }
  // the tiles' pattern: a buff border and a big cross panel on the first span (gilbertscott.org)
  {
    const u0 = Sa.step1 + 0.25, u1 = Sa.tilesTo - 0.25, y = F + r + 0.006, hw = HW - 0.25;
    for (const [a, b, c, d] of [[u0, u1, VC - hw, VC - hw + 0.18], [u0, u1, VC + hw - 0.18, VC + hw], [u0, u0 + 0.18, VC - hw, VC + hw], [u1 - 0.18, u1, VC - hw, VC + hw]]) B.flat('tileBuff', [[a, c], [b, c], [b, d], [a, d]], y);
    const cu = (u0 + u1) / 2; B.flat('tileDark', [[cu - 1.3, VC - 1.9], [cu + 1.3, VC - 1.9], [cu + 1.3, VC + 1.9], [cu - 1.3, VC + 1.9]], y);
    B.flat('tileBuff', [[cu - 0.2, VC - 1.5], [cu + 0.2, VC - 1.5], [cu + 0.2, VC + 1.5], [cu - 0.2, VC + 1.5]], y + 0.002);
    B.flat('tileBuff', [[cu - 0.9, VC - 0.2], [cu + 0.9, VC - 0.2], [cu + 0.9, VC + 0.2], [cu - 0.9, VC + 0.2]], y + 0.002);
  }
  // the aisle: cream lozenges framed by dark strips, iron grilles either side (from the screen to the sanctuary step)
  {
    const u0 = P.SCREEN.u1, u1 = Sa.step1, y = F + 0.006, h = A.half, L = 1.6, sw = 0.05;
    B.flat('chCream', [[u0, VC - h], [u1, VC - h], [u1, VC + h], [u0, VC + h]], y);
    for (const e of [-1, 1]) {
      B.flat('chStrip', [[u0, VC + e * h - 0.05], [u1, VC + e * h - 0.05], [u1, VC + e * h + 0.05], [u0, VC + e * h + 0.05]], y + 0.002);
      B.flat('ironBlack', [[u0, VC + e * (h + 0.05)], [u1, VC + e * (h + 0.05)], [u1, VC + e * (h + A.grille)], [u0, VC + e * (h + A.grille)]], y + 0.001);
    }
    for (let c = u0 + L / 2; c + L / 2 <= u1 + 1e-6; c += L) for (const e of [-1, 1]) {
      const a = [c - L / 2, VC - e * h], b = [c + L / 2, VC + e * h], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), px = (-dz / l) * sw, pz = (dx / l) * sw;
      B.poly('chStrip', [[a[0] + px, y + 0.003, a[1] + pz], [b[0] + px, y + 0.003, b[1] + pz], [b[0] - px, y + 0.003, b[1] - pz], [a[0] - px, y + 0.003, a[1] - pz]], [0, 1, 0]);
    }
  }
  // the doorway through the south wall (the leaves' threshold) and the antechapel's flags
  ctx.floor([[D.uc - D.hw, P.PORCH.doorV - 0.02], [D.uc + D.hw, P.PORCH.doorV - 0.02], [D.uc + D.hw, VS - 0.05], [D.uc - D.hw, VS - 0.05]], F);
  B.flat('chFlag', [[D.uc - D.hw, P.PORCH.doorV], [D.uc + D.hw, P.PORCH.doorV], [D.uc + D.hw, VS], [D.uc - D.hw, VS]], F + 0.002);
}
function altar(ctx, gl) {
  const { B } = ctx, A = P.ALTAR, y = F + 5 * P.SANCT.rise, uc = (A.u0 + A.u1) / 2;
  B.box('chDress', uc, y + A.h / 2, VC, A.u1 - A.u0, A.h, A.w, 0, {});
  B.poly('altarCloth', [[A.u0 - 0.012, y + 0.02, VC + A.w / 2], [A.u0 - 0.012, y + 0.02, VC - A.w / 2], [A.u0 - 0.012, y + A.h - 0.05, VC - A.w / 2], [A.u0 - 0.012, y + A.h - 0.05, VC + A.w / 2]], [-1, 0, 0]);
  B.box('mosaicBand', A.u0 - 0.02, y + A.h - 0.12, VC, 0.02, 0.14, A.w, 0, {});
  B.box('shieldW', uc, y + A.h + 0.005, VC, A.u1 - A.u0 + 0.06, 0.01, A.w + 0.06, 0, {});
  for (const e of [-1, 1]) { const v = VC + e * (A.w / 2 - 0.25); B.cyl('chBrass', uc + 0.2, y + A.h, v, 0.07, 0.05, 6, true, 0.1); B.cyl('chBrass', uc + 0.2, y + A.h + 0.05, v, 0.025, 0.42, 5, false); B.cyl('candle', uc + 0.2, y + A.h + 0.47, v, 0.03, 0.3, 5, true); gl.flame(uc + 0.2, y + A.h + 0.78, v, 0.02, 0.06); }
  B.box('chBrass', uc + 0.25, y + A.h + 0.35, VC, 0.03, 0.7, 0.03, 0, {}); B.box('chBrass', uc + 0.25, y + A.h + 0.55, VC, 0.03, 0.03, 0.36, 0, {});   // a cross between them
  ctx.solid([[A.u0, VC - A.w / 2], [A.u1, VC - A.w / 2], [A.u1, VC + A.w / 2], [A.u0, VC + A.w / 2]]);
}

// ------------------------------------------------------------------------------------------------ the apse's arcade, the sedilia
function arcade(ctx) {
  const { B } = ctx, A = P.ARCADE;
  for (let i = 0; i < 5; i++) {
    const f = apseFacet(i), L = f.Li, outer = i === 0 || i === 4, base = outer ? F + 3 * P.SANCT.rise : A.base, x0 = 0.22, w = (L - 2 * x0) / 3;
    B.push(f.Fi);
    // the band of mosaic over the arches and the plinth
    B.face('mosaicBand', [[0.05, A.apex + 0.15], [L - 0.05, A.apex + 0.15], [L - 0.05, A.band], [0.05, A.band]], [], 0.01);
    B.box('chDress', L / 2, A.band + 0.05, 0.08, L - 0.1, 0.1, 0.16, 0, { bottom: true });
    B.box('chDress', L / 2, (F - 0.02 + base) / 2, 0.15, L - 0.1, base - F + 0.02, 0.3, 0, {});
    for (let j = 0; j < 3; j++) {
      const a = x0 + j * w, m = a + w / 2;
      // the panel in the arch: gold with a muted shape (no likeness), or a dark blue hanging
      const panel = K.pointedPts(m, w - 0.1, base, A.spring, A.apex - A.spring - 0.05, 5);
      B.face(outer ? 'hangBlue' : 'mosaicGold', panel, [], 0.012);
      if (!outer) B.face('mosaicShape', [[m - 0.09, base + 0.25], [m + 0.09, base + 0.25], [m + 0.13, base + 1.1], [m + 0.07, A.spring - 0.05], [m, A.spring + 0.1], [m - 0.07, A.spring - 0.05], [m - 0.13, base + 1.1]], [], 0.016);
      // the trefoiled head (an arc and two cusps), the colonnettes
      bars(B, 'chDress', arcOf(m, w, A.spring, A.apex - A.spring, 5), 0.07, 0.1, 0.08);
      for (const e of [-1, 1]) bar(B, 'chDress', [m + e * w * 0.3, A.spring + 0.18], [m + e * w * 0.14, A.spring + 0.28], 0.05, 0.08, 0.06);
      B.cyl(outer ? 'chMarbleR' : 'chMarble', a + 0.02, base, 0.07, 0.045, A.spring - base, 6, false);
      if (j === 2) B.cyl(outer ? 'chMarbleR' : 'chMarble', a + w - 0.02, base, 0.07, 0.045, A.spring - base, 6, false);
      if (outer && i === 0) B.box('chDress', m, base + 0.44, 0.24, w - 0.1, 0.08, 0.42, 0, { bottom: true });      // the sedilia's seats
    }
    B.pop();
  }
}

// ------------------------------------------------------------------------------------------------ the north archway and its door
function archOrders() { const A = P.N_ARCH; return Array.from({ length: A.orders }, (_, k) => ({ w: A.w + 0.3 * (A.orders - 1 - k), apex: A.apex + 0.15 * (A.orders - 1 - k), z: -0.22 * (k + 1) })); }
function northArch(ctx) {
  const { B } = ctx, A = P.N_ARCH, O = archOrders(), s = sNi(A.u);
  B.push(FNi());
  let z = 0;
  for (let k = 0; k < O.length; k++) {
    const pts = K.pointedPts(s, O[k].w, F, A.spring, O[k].apex - A.spring, 8);
    B.reveal('chDress', pts, z, O[k].z, true);
    if (k + 1 < O.length) B.face('chDress', pts, [K.pointedPts(s, O[k + 1].w, F, A.spring, O[k + 1].apex - A.spring, 8)], O[k].z);
    for (const e of [-1, 1]) B.cyl('chMarble', s + e * (O[k].w / 2 - 0.06), F, O[k].z + 0.08, 0.05, A.spring - F - 0.15, 6, false);
    for (const e of [-1, 1]) B.box('chDress', s + e * (O[k].w / 2 - 0.06), A.spring - 0.08, O[k].z + 0.08, 0.2, 0.18, 0.2, 0, {});
    z = O[k].z;
  }
  const inner = K.pointedPts(s, O[O.length - 1].w, F, A.spring, O[O.length - 1].apex - A.spring, 8);
  B.face('oakDoor', inner, [], z + 0.01);
  for (const yy of [F + 0.6, F + 1.9]) B.box('ironBlack', s, yy, z + 0.03, O[O.length - 1].w - 0.2, 0.05, 0.02, 0, {});
  B.box('ironBlack', s + 0.45, F + 1.05, z + 0.06, 0.05, 0.16, 0.05, 0, {});
  // the outer moulding's foliage: small carved blocks along the hood
  const hood = arcOf(s, O[0].w + 0.24, A.spring, O[0].apex - A.spring + 0.12, 8);
  bars(B, 'chDress', hood, 0.14, 0.08, 0.08);
  for (let i = 1; i < hood.length - 1; i += 2) B.box('chDress', hood[i][0], hood[i][1] + 0.05, 0.1, 0.14, 0.14, 0.1, 0, {});
  B.pop();
}

// ------------------------------------------------------------------------------------------------ the stalls
function stallSide(ctx, gl, south) {
  const { B } = ctx, S = P.STALLS, L = S.u1 - S.u0, bk = S.back, r2 = S.rows[0], r1 = S.rows[1];
  const Fr = south ? frame(S.u1, 0, VS, -1, 0) : frame(S.u0, 0, VN, 1, 0);
  const z1 = bk.d, z2 = z1 + r2.d, z3 = z2 + r1.d, yb = F + bk.y, y2 = F + r2.y;
  B.push(Fr);
  // platforms (the back row's step, row 2's lower step)
  B.box('chOakDk', L / 2, (F + yb) / 2, z1 / 2, L, yb - F, z1, 0, {});
  B.box('chOakDk', L / 2, (F + y2) / 2, (z1 + z2) / 2, L, y2 - F, r2.d, 0, {});
  // the panelled backs with a shield on each stall; the seats and arms
  const n = Math.round(L / bk.pitch), pw = L / n, yTop = F + bk.panel;
  B.box('chOak', L / 2, (yb + yTop) / 2, 0.03, L, yTop - yb, 0.06, 0, { top: false });
  for (let i = 0; i < n; i++) {
    const m = (i + 0.5) * pw, yS = yb + 1.55;
    B.box('chOakDk', m, (yb + 0.9 + yTop - 0.15) / 2, 0.075, pw - 0.16, yTop - 0.15 - yb - 0.9, 0.03, 0, {});
    const k = (i * 7 + (south ? 1 : 3)) % 4, sh = [[m - 0.13, yS + 0.17], [m + 0.13, yS + 0.17], [m + 0.13, yS - 0.02], [m, yS - 0.2], [m - 0.13, yS - 0.02]];
    B.face('shield' + k, sh, [], 0.095);
    if (i % 2) B.face('shieldW', [[m - 0.13, yS + 0.03], [m, yS + 0.12], [m + 0.13, yS + 0.03], [m + 0.13, yS - 0.03], [m, yS + 0.06], [m - 0.13, yS - 0.03]], [], 0.097);
    else B.face('shieldW', [[m - 0.13, yS + 0.02], [m + 0.13, yS + 0.02], [m + 0.13, yS + 0.08], [m - 0.13, yS + 0.08]], [], 0.097);
    B.box('chOakDk', i * pw, yb + 0.42, 0.33, 0.06, 0.84, 0.6, 0, {});      // the arm / division
  }
  B.box('chOakDk', L, yb + 0.42, 0.33, 0.06, 0.84, 0.6, 0, {});
  B.box('chOak', L / 2, yb + bk.seatH, 0.3, L, 0.05, 0.46, 0, { bottom: true });
  // the canopies: a hood, a crocketed gable with a pierced trefoil over every stall, pinnacles between, to S.canopy.top
  const C0 = S.canopy, yh = F + C0.y0, yf = F + C0.hood, yt = F + C0.top, zp = C0.proj;
  B.box('chOakDk', L / 2, (yh + yf - 0.35) / 2, zp / 2, L, yf - 0.35 - yh, zp, 0, { bottom: true });
  for (let i = 0; i < n; i++) {
    const a = i * pw, m = a + pw / 2, ya = yf - 0.35, ge = yt - 0.45;
    bars(B, 'chOak', [[a + 0.05, ya], [m, ge], [a + pw - 0.05, ya]], 0.07, zp + 0.02, 0.06);
    bars(B, 'chOakDk', circ(m, (ya + ge) / 2 - 0.12, 0.13, 6, Math.PI / 6), 0.04, zp + 0.01, 0.05, true);
    bars(B, 'chOakDk', arcOf(m, pw - 0.14, yh + 0.1, 0.28, 3), 0.05, zp - 0.02, 0.05);
    B.box('chOak', m, ge + 0.12, zp + 0.0, 0.05, 0.24, 0.05, 0, {});
    B.face('chOakDk', [[a + 0.04, ya], [a + pw - 0.04, ya], [m, ge - 0.04]], [circ(m, (ya + ge) / 2 - 0.12, 0.13, 6, Math.PI / 6)], zp - 0.08);
  }
  for (let i = 0; i <= n; i++) { const x = i * pw; B.box('chOak', x, (yh + yt - 0.3) / 2, zp - 0.02, 0.09, yt - 0.3 - yh, 0.09, 0, { top: false }); K.coneRoof(B, 'chOak', [[x - 0.06, zp - 0.08], [x + 0.06, zp - 0.08], [x + 0.06, zp + 0.04], [x - 0.06, zp + 0.04]], yt - 0.3, [x, zp - 0.02], 0.3); }
  // the desks (one at each row's front) and the benches of rows 2 and 1
  const desk = (z, yFloor, yRow, k = 'chOak') => {
    const yd = yRow + S.desk;
    B.box(k, L / 2, (yFloor + yd - 0.06) / 2, z - 0.03, L, yd - 0.06 - yFloor, 0.06, 0, { top: false });
    B.poly('chOakLt', [[0, yd, z - 0.38], [L, yd, z - 0.38], [L, yd + 0.06, z], [0, yd + 0.06, z]], [0, 1, 0.15]);
    B.box('chOakDk', L / 2, yd + 0.03, z + 0.01, L, 0.08, 0.05, 0, {});
  };
  desk(z1, y2, yb); desk(z2, F, y2); desk(z3, F, F, 'chOakDk');
  B.box('chOak', L / 2, y2 + 0.45, z1 + 0.25, L, 0.05, 0.38, 0, { bottom: true });
  B.box('chOak', L / 2, F + 0.45, z2 + 0.25, L, 0.05, 0.38, 0, { bottom: true });
  // bench ends with scrolled tops, carved panels on the front (blocks), candlesticks on the desks
  for (let x = 0; x <= L + 1e-6; x += L / 4) {
    B.box('chOakDk', x, (F + F + 1.05) / 2, (z1 + z3) / 2 + 0.02, 0.08, 1.05, z3 - z1 - 0.04, 0, {});
    B.box('chOakDk', x, F + 1.12, z3 - 0.12, 0.1, 0.14, 0.24, 0, {});
  }
  for (let x = 0.6; x < L - 0.3; x += 1.2) B.box('chOakLt', x, F + 0.55, z3 + 0.004, 0.32, 0.3, 0.02, 0, {});
  for (const [z, yRow] of [[z2, y2], [z3, F]]) for (let x = 0.8; x < L - 0.4; x += 1.6) {
    const yd = yRow + S.desk + 0.08;
    B.cyl('chBrass', x, yd, z - 0.18, 0.05, 0.03, 5, true, 0.07); B.cyl('chBrass', x, yd + 0.03, z - 0.18, 0.018, 0.3, 4, false);
    B.cyl('candle', x, yd + 0.33, z - 0.18, 0.022, 0.14, 4, true);
    const [cu, cv] = south ? [S.u1 - x, VS - (z - 0.18)] : [S.u0 + x, VN + (z - 0.18)];
    gl.flame(cu, yd + 0.48, cv, 0.016, 0.05);
  }
  // the stalls' east end: a tall panelled end
  B.box('chOakDk', south ? 0 : L, (F + yt - 0.4) / 2, z1 / 2, 0.1, yt - 0.4 - F, z1, 0, {});
  B.pop();
  // a collider round the whole block (the aisle stays open)
  const v0 = south ? VS : VN, v1 = south ? VS - z3 : VN + z3;
  ctx.solid([[S.u0, v0], [S.u1, v0], [S.u1, v1], [S.u0, v1]]);
  ctx.floor([[S.u0, Math.min(v0, v1)], [S.u1, Math.min(v0, v1)], [S.u1, Math.max(v0, v1)], [S.u0, Math.max(v0, v1)]], F);
}

// ------------------------------------------------------------------------------------------------ the screen, gallery, organ
function screen(ctx) {
  const { B } = ctx, S = P.SCREEN, W = VS - VN, m = W / 2, A = S.arch, d = S.u1 - S.u0;
  const ord = [0, 1, 2].map((k) => K.pointedPts(m, A.w + 0.5 - 0.25 * k, F, A.spring, A.apex - A.spring + 0.25 - 0.12 * k, 8));
  const Fe = () => frame(S.u1, 0, VS, 0, -1);      // the east face (s = VS - v)
  const Fw = () => frame(S.u0, 0, VN, 0, 1);       // the west face (s = v - VN)
  B.push(Fe());
  B.face('chStone', [[0, F - 0.05], [W, F - 0.05], [W, S.top], [0, S.top]], [ord[0]], 0);
  B.reveal('chDress', ord[0], 0, -0.12, true); B.face('chDress', ord[0], [ord[1]], -0.12);
  B.reveal('chDress', ord[1], -0.12, -0.24, true); B.face('chDress', ord[1], [ord[2]], -0.24);
  B.reveal('chDress', ord[2], -0.24, -d, true);
  // clustered red marble shafts at the jambs with foliage capitals; a hood with carved foliage
  for (const e of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = m + e * (A.w / 2 + 0.25 - 0.12 * k + 0.02);
    B.cyl('chMarbleR', x, F + 0.35, 0.06 - 0.12 * k, 0.07, A.spring - F - 0.6, 8, false);
    B.box('chDress', x, F + 0.17, 0.06 - 0.12 * k, 0.22, 0.34, 0.22, 0, {});
    B.cyl('chDress', x, A.spring - 0.25, 0.06 - 0.12 * k, 0.17, 0.2, 6, true, 0.07);
  }
  const hood = arcOf(m, A.w + 0.85, A.spring, A.apex - A.spring + 0.45, 8);
  bars(B, 'chDress', hood, 0.18, 0.1, 0.1);
  for (let i = 1; i < hood.length - 1; i++) B.box('chDress', hood[i][0], hood[i][1] + 0.1, 0.12, 0.16, 0.16, 0.12, 0, {});
  // the painted tabernacles either side: shafts, a pointed head, a gable with a finial, a painted panel
  const T0 = S.tab;
  for (const e of [-1, 1]) {
    const x = m + e * T0.off, w = T0.w;
    B.face('tabRed', K.pointedPts(x, w - 0.12, T0.y0, T0.spring, T0.apex - T0.spring - 0.35, 5), [], 0.02);
    B.face('tabPaint', K.pointedPts(x, w - 0.42, T0.y0 + 0.15, T0.spring - 0.1, T0.apex - T0.spring - 0.55, 5), [], 0.025);
    for (const sx of [-1, 1]) { B.box('chDress', x + sx * (w / 2 - 0.04), (T0.y0 - 0.3 + T0.spring) / 2, 0.08, 0.1, T0.spring - T0.y0 + 0.3, 0.14, 0, {}); K.pinnacle(B, 'chDress', x + sx * (w / 2 - 0.04), 0.08, T0.spring, T0.spring + 0.3, 0.12, 0.45); }
    bars(B, 'chDress', [[x - w / 2 + 0.06, T0.spring], [x, T0.apex], [x + w / 2 - 0.06, T0.spring]], 0.09, 0.1, 0.1);
    B.box('chDress', x, T0.apex + 0.14, 0.08, 0.08, 0.28, 0.08, 0, {});
    B.box('chDress', x, T0.y0 - 0.1, 0.1, w + 0.1, 0.2, 0.22, 0, { bottom: true });
  }
  // the gallery's parapet: a band of pierced quatrefoils between a base and a coping; the cross
  const pb = S.top, pt = S.parapet - 0.12, nq = Math.round(W / 0.55), holes = [];
  for (let i = 0; i < nq; i++) holes.push(quatrefoil(((i + 0.5) * W) / nq, (pb + 0.1 + pt) / 2, 0.19, 12));
  B.face('chDress', [[0, pb], [W, pb], [W, pt], [0, pt]], holes, 0.0);
  B.face('chDress', [[0, pb], [W, pb], [W, pt], [0, pt]], holes, -0.16, true);
  for (const h of holes) B.reveal('chDress', h, 0, -0.16);
  B.box('chDress', W / 2, pt + 0.06, -0.08, W, 0.12, 0.3, 0, { bottom: true });
  B.box('chDress', W / 2, pb - 0.06, 0.04, W, 0.12, 0.12, 0, { bottom: true });
  { const yc = S.parapet, h = S.cross - yc; B.box('chDress', m, yc + h / 2, -0.08, 0.2, h, 0.16, 0, {}); B.box('chDress', m, yc + h * 0.7, -0.08, 0.95, 0.18, 0.16, 0, {}); for (const [dx, dy] of [[0, h], [-0.48, h * 0.7], [0.48, h * 0.7]]) B.box('chDress', m + dx, yc + dy, -0.08, 0.28, 0.28, 0.18, Math.PI / 4, {}); B.box('chDress', m, yc + 0.15, -0.08, 0.5, 0.3, 0.3, 0, {}); }
  B.pop();
  // the west face (plain, the arch's outer order) and the screen's top
  B.push(Fw()); B.face('chStone', [[0, F - 0.05], [W, F - 0.05], [W, P.GALLERY.under], [0, P.GALLERY.under]], [ord[2]], 0); B.pop();
  // the iron gates, standing open against the arch's east jambs (each leaf in the plane of the vessel's length)
  for (const e of [-1, 1]) {
    const v = VC + e * (A.w / 2 - 0.02), u0 = S.u1, u1 = S.u1 + A.w / 2 - 0.05, yt = A.spring - 0.1;
    B.push(frame(u0, 0, v, 1, 0));
    const Lg = u1 - u0;
    for (const y of [F + 0.08, F + 1.0, yt]) B.box('ironBlack', Lg / 2, y, 0, Lg, 0.04, 0.03, 0, {});
    for (let x = 0.02; x <= Lg; x += 0.11) B.box('ironBlack', x, (F + yt) / 2, 0, 0.022, yt - F, 0.022, 0, {});
    for (let x = 0.1; x < Lg; x += 0.22) bars(B, 'ironBlack', circ(x + 0.05, yt - 0.18, 0.09, 6), 0.02, 0.015, 0.03, true);
    B.pop();
  }
  // colliders: the screen either side of the arch
  const hw = A.w / 2;
  ctx.solid([[S.u0, VN], [S.u1, VN], [S.u1, VC - hw], [S.u0, VC - hw]]);
  ctx.solid([[S.u0, VC + hw], [S.u1, VC + hw], [S.u1, VS], [S.u0, VS]]);
  ctx.floor([[S.u0, VC - hw], [S.u1, VC - hw], [S.u1, VC + hw], [S.u0, VC + hw]], F);
  B.flat('chFlag', [[S.u0, VC - hw], [S.u1, VC - hw], [S.u1, VC + hw], [S.u0, VC + hw]], F + 0.003);
}
function gallery(ctx) {
  const { B } = ctx, G = P.GALLERY, S = P.SCREEN;
  B.flat('chOakDk', [[UW, VN], [S.u1, VN], [S.u1, VS], [UW, VS]], G.floor);
  B.flat('chOak', [[UW, VN], [S.u0, VN], [S.u0, VS], [UW, VS]], G.under, [], true);
  for (let u = UW + 0.6; u < S.u0 - 0.2; u += 0.95) B.box('chOakDk', u, G.under - 0.11, VC, 0.2, 0.22, VS - VN, 0, { bottom: true });
  B.box('chOakDk', (UW + S.u0) / 2, G.under - 0.1, VS - 0.1, S.u0 - UW, 0.2, 0.2, 0, { bottom: true });
  B.box('chOakDk', (UW + S.u0) / 2, G.under - 0.1, VN + 0.1, S.u0 - UW, 0.2, 0.2, 0, { bottom: true });
}
function organ(ctx) {
  const { B } = ctx, O = P.ORGAN, G = P.GALLERY, W = VS - VN, wa = W / 3, ua = O.u1 + 0.25;
  // the case: a dark timber body from the gallery floor to the impost, a crowning cornice over the pipes
  B.box('organCase', (O.u0 + O.u1) / 2, (G.floor + O.impost) / 2, VC, O.u1 - O.u0, O.impost - G.floor, W - 0.5, 0, {});
  B.box('organCase', (O.u0 + O.u1) / 2 - 0.2, (O.impost + O.pipesTop) / 2, VC, O.u1 - O.u0 - 0.4, O.pipesTop - O.impost, W - 0.7, 0, {});
  B.box('organCase', O.u1 - 0.05, O.impost + 0.08, VC, 0.3, 0.16, W - 0.4, 0, {});
  // the facade pipes in three flats (painted), behind an iron grille
  const keys = ['pipeGold', 'pipeBlue', 'pipeGold', 'pipeRed'];
  for (let f = 0; f < 3; f++) {
    const v0 = VS - wa * f - 0.35, v1 = VS - wa * (f + 1) + 0.35, np = 9;
    for (let i = 0; i < np; i++) {
      const v = v0 + ((v1 - v0) * (i + 0.5)) / np, c = Math.abs(i - (np - 1) / 2) / ((np - 1) / 2), h = (O.pipesTop - O.impost - 0.5) * (1 - 0.35 * c * c);
      B.cyl(keys[(i + f) % 4], O.u1 + 0.02, O.impost + 0.18, v, 0.075, h, 6, false);
      B.cyl('pipeGold', O.u1 + 0.02, O.impost + 0.18 + h * 0.18, v, 0.08, 0.06, 6, false, 0.04);
    }
  }
  for (let v = VN + 0.4; v < VS - 0.3; v += 0.22) B.box('ironBlack', O.u1 + 0.17, (O.impost + O.pipesTop) / 2, v, 0.02, O.pipesTop - O.impost - 0.2, 0.02, 0, {});
  for (const y of [O.impost + 1.2, O.impost + 2.4]) B.box('ironBlack', O.u1 + 0.17, y, VC, 0.02, 0.03, W - 0.8, 0, {});
  // three pointed arches standing before it on shafts, a wall over them to a string, a ledge back to the west wall
  const top = O.arches.apex + 0.2, holes = [0, 1, 2].map((k) => K.pointedPts(wa * (k + 0.5), wa - 0.32, G.floor, O.arches.spring, O.arches.apex - O.arches.spring, 8));
  B.push(frame(ua, 0, VS, 0, -1));
  B.face('chStone', [[0, G.floor], [W, G.floor], [W, top], [0, top]], holes, 0);
  B.face('chStone', [[0, G.floor], [W, G.floor], [W, top], [0, top]], holes, -0.3, true);
  for (const h of holes) B.reveal('chDress', h, 0, -0.3, true);
  for (let k = 0; k <= 3; k++) { const x = Math.max(0.12, Math.min(W - 0.12, wa * k)); B.cyl('chMarble', x, G.floor, 0.1, 0.1, O.arches.spring - G.floor - 0.3, 8, false); B.cyl('chDress', x, O.arches.spring - 0.3, 0.1, 0.22, 0.3, 6, true, 0.1); }
  for (let k = 0; k < 3; k++) bars(B, 'chDress', arcOf(wa * (k + 0.5), wa - 0.1, O.arches.spring, O.arches.apex - O.arches.spring + 0.15, 7), 0.14, 0.08, 0.08);
  B.box('chDress', W / 2, top + 0.06, -0.1, W, 0.12, 0.4, 0, { bottom: true });
  B.pop();
  B.flat('chStone', [[UW, VN], [ua - 0.3, VN], [ua - 0.3, VS], [UW, VS]], top);
}

// ------------------------------------------------------------------------------------------------ the tapestry, the turret door
function tapestry(ctx) {
  const { B } = ctx, Tp = P.TAPESTRY, s = sSi(Tp.u), w = Tp.w;
  B.push(FSi());
  B.box('chOakDk', s, (Tp.y0 + Tp.y1) / 2, 0.04, w + 0.24, Tp.y1 - Tp.y0 + 0.24, 0.08, 0, {});
  B.face('tapestry', rectPts(s - w / 2, Tp.y0, s + w / 2, Tp.y1), [], 0.085);
  // a muted woven pattern (bands and lozenges: NOT the real design)
  B.face('tapGreen', rectPts(s - w / 2 + 0.1, Tp.y0 + 0.1, s + w / 2 - 0.1, Tp.y0 + 0.55), [], 0.087);
  B.face('tapRed', rectPts(s - w / 2 + 0.1, Tp.y1 - 0.4, s + w / 2 - 0.1, Tp.y1 - 0.12), [], 0.087);
  for (let i = 0; i < 4; i++) { const x = s - w / 2 + (w * (i + 0.5)) / 4, y = (Tp.y0 + Tp.y1) / 2 + 0.15; B.face('tapMuted', [[x, y - 0.75], [x + 0.28, y], [x, y + 0.75], [x - 0.28, y]], [], 0.088); }
  B.box('chOakDk', s, Tp.y1 + 0.2, 0.09, w + 0.5, 0.16, 0.18, 0, { bottom: true });      // the carved cornice
  for (let x = s - w / 2 - 0.1; x <= s + w / 2 + 0.11; x += (w + 0.2) / 8) B.box('chOakDk', x, Tp.y1 + 0.34, 0.12, 0.1, 0.12, 0.08, Math.PI / 4, {});
  B.pop();
}
function turretDoor(ctx) {
  const { B } = ctx, Dd = P.TURRET_DOOR, s = sSi(Dd.u);
  B.push(FSi());
  const pts = K.pointedPts(s, Dd.w, F, F + Dd.h - 0.35, 0.35, 5);
  B.face('oakDoor', pts, [], 0.012);
  bars(B, 'chDress', arcOf(s, Dd.w + 0.16, F + Dd.h - 0.35, 0.42, 5), 0.12, 0.06, 0.06);
  for (const e of [-1, 1]) B.box('chDress', s + e * (Dd.w / 2 + 0.06), F + (Dd.h - 0.35) / 2, 0.03, 0.12, Dd.h - 0.35, 0.06, 0, {});
  B.box('ironBlack', s + Dd.w * 0.3, F + 1.0, 0.03, 0.04, 0.12, 0.04, 0, {});
  B.pop();
}
/** THE ANTECHAPEL (2026-11-23, second pass: its floor and walls were plain): the choir aisle's floor carried across it (cream
 *  lozenges framed by dark strips, P.ANTE.loz), and on its north and west walls a blind arcade over a stone bench with a
 *  plain marble tablet in each arch (memorials: blank, no names), more tablets on the south wall's piers. K: that the
 *  antechapel has a patterned floor and memorials (Diliff 2014 looking west, the photo sphere 2016); G: the arcade's form
 *  and every figure (P.ANTE) */
function antechapel(ctx) {
  const { B } = ctx, A = P.ANTE, S = P.SCREEN, u0 = UW, u1 = S.u0, v0 = VN, v1 = VS, y = F + 0.005;
  // the floor: a cream field, a dark border strip, the diagonal strips of the lozenges clipped to the field
  const e = A.border;
  B.flat('chCream', [[u0 + e, v0 + e], [u1 - e, v0 + e], [u1 - e, v1 - e], [u0 + e, v1 - e]], y);
  for (const [a, b, c, d] of [[u0, u1, v0, v0 + e], [u0, u1, v1 - e, v1], [u0, u0 + e, v0, v1], [u1 - e, u1, v0, v1]]) B.flat('chStrip', [[a, c], [b, c], [b, d], [a, d]], y + 0.001);
  const ua = u0 + e, ub = u1 - e, va = v0 + e, vb = v1 - e, L = A.loz, sw = 0.025;
  const clipLine = (p, q) => {      // a segment clipped to the field (Liang-Barsky)
    let t0 = 0, t1 = 1; const dx = q[0] - p[0], dz = q[1] - p[1];
    for (const [pp, qq] of [[-dx, p[0] - ua], [dx, ub - p[0]], [-dz, p[1] - va], [dz, vb - p[1]]]) { if (Math.abs(pp) < 1e-9) { if (qq < 0) return null; continue; } const r = qq / pp; if (pp < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); }
    return t0 < t1 ? [[p[0] + dx * t0, p[1] + dz * t0], [p[0] + dx * t1, p[1] + dz * t1]] : null;
  };
  const span = (ub - ua) + (vb - va);
  for (let k = -span; k <= span; k += L) for (const sg of [1, -1]) {
    const c = [(ua + ub) / 2 + k, (va + vb) / 2], d = [sg, 1], p = [c[0] - d[0] * span, c[1] - d[1] * span], q = [c[0] + d[0] * span, c[1] + d[1] * span], seg = clipLine(p, q);
    if (!seg) continue;
    const [a, b] = seg, l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.05) continue;
    const px = (-(b[1] - a[1]) / l) * sw, pz = ((b[0] - a[0]) / l) * sw;
    B.poly('chStrip', [[a[0] + px, y + 0.002, a[1] + pz], [b[0] + px, y + 0.002, b[1] + pz], [b[0] - px, y + 0.002, b[1] - pz], [a[0] - px, y + 0.002, a[1] - pz]], [0, 1, 0]);
  }
  // the blind arcade: bench, shafts, pointed arches, a string over them; a blank tablet in each arch
  const arcade = (Fr, s0, s1, n) => {
    B.push(Fr);
    const w = (s1 - s0) / n;
    B.box('chDress', (s0 + s1) / 2, F + A.bench / 2, A.benchD / 2, s1 - s0, A.bench, A.benchD, 0, { bottom: false });
    for (let i = 0; i <= n; i++) { const x = s0 + w * i; B.cyl('chMarbleR', x, F + A.bench, 0.07, 0.04, A.spring - F - A.bench - 0.14, 6, false); B.box('chDress', x, A.spring - 0.07, 0.07, 0.16, 0.14, 0.16, 0, {}); }
    for (let i = 0; i < n; i++) {
      const x = s0 + w * (i + 0.5);
      bars(B, 'chDress', arcOf(x, w - 0.04, A.spring, A.apex - A.spring, 6), 0.1, 0.09, 0.09);
      // a tablet of pale marble in a stone surround, the sizes varying from arch to arch (some with a small pediment)
      const k = (i * 5 + n) % 3, tw = Math.min([0.46, 0.38, 0.52][k], w - 0.4), ty0 = F + A.tablet[0] + [0.1, 0, 0.2][k], ty1 = F + A.tablet[1] - [0.1, 0, 0.25][k];
      B.box('chDress', x, (ty0 + ty1) / 2, 0.02, tw + 0.1, ty1 - ty0 + 0.1, 0.04, 0, {});
      B.box('tablet', x, (ty0 + ty1) / 2, 0.045, tw, ty1 - ty0, 0.02, 0, {});
      if (k === 1) B.poly('chDress', [[x - tw / 2 - 0.06, ty1 + 0.05, 0.04], [x + tw / 2 + 0.06, ty1 + 0.05, 0.04], [x, ty1 + 0.22, 0.04]], [0, 0, 1]);
    }
    B.box('chDress', (s0 + s1) / 2, A.apex + 0.12, 0.05, s1 - s0, 0.12, 0.1, 0, { bottom: true });
    B.pop();
  };
  arcade(FNi(), sNi(u0) + 0.1, sNi(u1) - 0.1, A.north);
  arcade(FWi(), 0.1, VS - VN - 0.1, A.west);
  // the benches are in the way: colliders
  ctx.solid([[u0, VN], [u1, VN], [u1, VN + A.benchD], [u0, VN + A.benchD]]);
  ctx.solid([[u0, VN], [u0 + A.benchD, VN], [u0 + A.benchD, VS], [u0, VS]]);
  // tablets on the south wall's piers (between the turret door, the porch door and the screen)
  B.push(FSi());
  for (const [s, w, ya, yb] of A.southTablets.map(([u, w, ya, yb]) => [sSi(u), w, ya, yb])) {
    B.box('chDress', s, F + (ya + yb) / 2, 0.02, w + 0.1, yb - ya + 0.1, 0.04, 0, {});
    B.box('tablet', s, F + (ya + yb) / 2, 0.045, w, yb - ya, 0.02, 0, {});
    B.box('chDress', s, F + ya - 0.1, 0.06, w + 0.18, 0.08, 0.12, 0, { bottom: true });
  }
  B.pop();
}
/** the porch door's inner architrave (a moulding round the leaves' opening) */
function doorInside(ctx) {
  const { B } = ctx, D = DOOR(), s = sSi(D.uc);
  B.push(FSi());
  bars(B, 'chDress', [[s - D.hw - 0.08, F], [s - D.hw - 0.08, D.y1 + 0.08], [s + D.hw + 0.08, D.y1 + 0.08], [s + D.hw + 0.08, F]], 0.16, 0.05, 0.05);
  bars(B, 'chDress', arcOf(s, 2 * D.hw + 0.3, D.y1 + 0.1, 0.75, 6), 0.14, 0.05, 0.05);
  B.face('chStone', [[s - D.hw - 0.08, D.y1 + 0.16], [s + D.hw + 0.08, D.y1 + 0.16], ...arcOf(s, 2 * D.hw + 0.16, D.y1 + 0.16, 0.68, 6).slice(1, -1).reverse()], [], 0.012);
  B.pop();
}

// ------------------------------------------------------------------------------------------------ lights: chandeliers, brackets, the lectern
function chandelier(ctx, gl, u, v, y) {
  const { B } = ctx, Ch = P.CHANDELIERS, top = vy(u, v) - 0.05;
  B.box('ironBlack', u, (y + 0.45 + top) / 2, v, 0.014, top - y - 0.45, 0.014, 0, {});
  B.cyl('chBrass', u, y - 0.15, v, 0.05, 0.6, 6, false, 0.03);
  B.cyl('chBrass', u, y - 0.2, v, 0.02, 0.08, 6, true, 0.09);
  for (let i = 0; i < Ch.arms; i++) {
    const a = (i / Ch.arms) * Math.PI * 2, x = u + Math.cos(a) * Ch.r, z = v + Math.sin(a) * Ch.r, xm = u + Math.cos(a) * Ch.r * 0.55, zm = v + Math.sin(a) * Ch.r * 0.55;
    B.beam('chBrass', [u, y - 0.05, v], [xm, y - 0.12, zm], 0.025, 0.025);
    B.beam('chBrass', [xm, y - 0.12, zm], [x, y + 0.02, z], 0.025, 0.025);
    B.cyl('chBrass', x, y + 0.02, z, 0.035, 0.03, 5, true, 0.05);
    B.cyl('candle', x, y + 0.05, z, 0.02, 0.14, 4, true);
    gl.flame(x, y + 0.2, z, 0.016, 0.05);
  }
}
function lights(ctx, gl) {
  const { B } = ctx, Ch = P.CHANDELIERS;
  for (const u of Ch.u) for (const e of [-1, 1]) chandelier(ctx, gl, u, VC + e * Ch.off, Ch.y);
  // brass branches on brackets at the apse's shafts
  for (let i = 1; i < 5; i++) {
    const p = P.apseIn(ANG[i]), a = ANG[i] * D2R, nu = -Math.cos(a), nv = -Math.sin(a), tu = -nv, tv = nu, y = F + 3.15;
    const x0 = p[0] + nu * 0.15, z0 = p[1] + nv * 0.15, x1 = p[0] + nu * 0.75, z1 = p[1] + nv * 0.75;
    B.beam('chBrass', [x0, y - 0.25, z0], [x1, y, z1], 0.035, 0.035);
    for (const e of [-1, 0, 1]) { const x = x1 + tu * e * 0.22, z = z1 + tv * e * 0.22; B.beam('chBrass', [x1, y, z1], [x, y + 0.05, z], 0.02, 0.02); B.cyl('candle', x, y + 0.06, z, 0.02, 0.14, 4, true); gl.flame(x, y + 0.21, z, 0.016, 0.05); }
  }
  // the brass eagle lectern
  const u = P.LECTERN.u, v = VC;
  B.cyl('chBrass', u, F, v, 0.32, 0.08, 8, true, 0.36);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; B.box('chBrass', u + Math.cos(a) * 0.3, F + 0.08, v + Math.sin(a) * 0.3, 0.12, 0.16, 0.12, 0, {}); }
  B.cyl('chBrass', u, F + 0.08, v, 0.06, 1.0, 8, false, 0.09);
  B.cyl('chBrass', u, F + 0.55, v, 0.13, 0.12, 8, false, 0.08);
  B.cyl('chBrass', u, F + 1.08, v, 0.16, 0.2, 8, true, 0.08);           // the globe the eagle stands on
  B.box('chBrass', u + 0.05, F + 1.36, v, 0.5, 0.18, 0.2, 0, {});       // the eagle's body
  B.box('chBrass', u - 0.27, F + 1.46, v, 0.14, 0.12, 0.1, 0, {});      // its head (looking west, down the choir)
  B.poly('chBrass', [[u + 0.05, F + 1.5, v - 0.35], [u + 0.05, F + 1.5, v + 0.35], [u + 0.25, F + 1.32, v + 0.35], [u + 0.25, F + 1.32, v - 0.35]], [-1, 1, 0]);   // the wings: the book rest (facing west)
  ctx.solid([[u - 0.34, v - 0.34], [u + 0.34, v - 0.34], [u + 0.34, v + 0.34], [u - 0.34, v + 0.34]]);
}

// ------------------------------------------------------------------------------------------------ the whole room
export function buildInterior(ctx) {
  const { B } = ctx, n0 = B.tris();
  cells(ctx.pack);
  const gl = new IK.StainedGlazing();
  southWall(ctx); northWall(ctx); westWall(ctx); apseWalls(ctx);
  const nWalls = B.tris();
  vaultWebs(ctx); vaultRibs(ctx);
  const nVault = B.tris();
  shafts(ctx); floors(ctx); altar(ctx, gl); arcade(ctx); northArch(ctx);
  stallSide(ctx, gl, true); stallSide(ctx, gl, false);
  const nStalls = B.tris();
  screen(ctx); gallery(ctx); organ(ctx); tapestry(ctx); turretDoor(ctx); doorInside(ctx); antechapel(ctx); lights(ctx, gl);
  gl.flush(ctx);
  // colliders: the room's inner faces (the south door open; the leaves are the doors' own), the apse
  const D = DOOR(), sw = P.PORCH.orders[2].w / 2 - 0.01;
  ctx.seg(UW, VS, D.uc - sw, VS); ctx.seg(D.uc + sw, VS, JUNCTION, VS);
  const R = P.INNER; for (let i = 1; i < R.length; i++) { const a = R[i], b = R[(i + 1) % R.length]; ctx.seg(a[0], a[1], b[0], b[1]); }
  // the lamps' light after dark (LOCAL; dir = heading: along u is PI / 2)
  const S = P.STALLS, mu = (S.u0 + S.u1) / 2, hl = (S.u1 - S.u0) / 2;
  const lit = [
    { u: mu, v: VC, len: hl + 1, wid: 1.4, dir: Math.PI / 2, k: 0.32 },
    { u: mu, v: VC + 2.6, len: hl, wid: 1.2, dir: Math.PI / 2, k: 0.26 },
    { u: mu, v: VC - 2.6, len: hl, wid: 1.2, dir: Math.PI / 2, k: 0.26 },
    { u: 7.8, v: VC, len: 3.6, wid: 3.4, dir: Math.PI / 2, k: 0.24 },
    { u: -13.0, v: VC, len: 2.2, wid: 3.6, dir: Math.PI / 2, k: 0.12 },
  ];
  return { lights: lit, tris: { all: B.tris() - n0, walls: nWalls - n0, vault: nVault - nWalls, stalls: nStalls - nVault } };
}
