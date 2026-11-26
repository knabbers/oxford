// Oxford Castle — geometry (owned by places/oxford_castle.js). Research: docs/research/city_centre_west.md.
// KNOWN: St George's Tower, coral rag rubble, ~9 m square at the base and tapering, the oldest standing building in
// Oxford (c. 1020–1070); the motte, ~18 m (60–64 ft) high, ~25 m across the top, a stepped path up and the well chamber
// under its top; the castle buildings were a prison until 1996 and became a hotel and restaurants round a courtyard
// (opened 2005–06); the Castle Mill Stream along the west side, the mill (gone 1930) by the tower, a weir marks it.
// Outlines (tower, motte, prison ranges, Castle Yard, the stream) from OSM.
// GUESSED: the tower's height (20.4 m to the leads; sources give 18–24 m), its window pattern and parapet, the mound's
// profile and where its path climbs, the top's well-head, the weir's form.
import { RB, frame, geoOf, TAU, hash, pip, vnoise, tintGeo, mergeGeos } from './_cw_kit.js';
import { emitRange } from './_rad_kit.js';
import { NORTH } from './_north_kit.js';

export const TOWER_ID = 'w30668669', MOTTE_SITE = 'r12555899', DWING = 'r12557836', ROUND = 'r12557835', RANGE = 'w30668671';
// St George's Tower: centre, axes (u: east-south-east face normal, v: south-south-west face normal), base half-sizes
export const TW = { c: [-241.2, 375.95], u: [0.9, -0.435], v: [0.395, 0.918], ha: 4.85, hb: 5.05, taper: 0.84, roof: 20.4, top: 21.4 };
export const tw = (a, b, y = 0) => { const k = 1 - (1 - TW.taper) * Math.min(1, y / TW.roof); return [TW.c[0] + (TW.u[0] * a + TW.v[0] * b) * k, TW.c[1] + (TW.u[1] * a + TW.v[1] * b) * k]; };
export const twH = (da, db) => Math.atan2(TW.u[0] * da + TW.v[0] * db, TW.u[1] * da + TW.v[1] * db);
// the motte: top centre and radius, height
export const MOUND = { c: [-203.5, 310.0], top: 9.8, h: 18.0, ang: 36 };
export const TOWER_DOOR = (() => { const p = tw(0.6, TW.hb + 2.0); return { pos: p, facing: twH(0, 1) }; })();

/** the motte's base outline (OSM site) */
export function moundBase(map) { const s = map.sites.find((q) => q.id === MOTTE_SITE); return s ? s.poly : null; }
/** distance from the top centre to the base outline along angle a (ray / polygon) */
function rayR(poly, c, a) {
  const dx = Math.sin(a), dz = Math.cos(a); let best = 40;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], ex = q[0] - p[0], ez = q[1] - p[1];
    const den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((p[0] - c[0]) * ez - (p[1] - c[1]) * ex) / den, u = ((p[0] - c[0]) * dz - (p[1] - c[1]) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}
/** the mound's height profile: f(t) for t = 0 at the base edge … 1 at the top's rim */
// (photo comparison north, item 3: the real motte is a steep straight-sided cone, not a dome: three quarters straight
// slope, a quarter eased at the foot and the rim; `?north=0` gives the old dome)
const prof = (t) => { const u = Math.min(1, Math.max(0, t)), c = 0.5 - 0.5 * Math.cos(Math.PI * u); return NORTH ? MOUND.h * (0.78 * u + 0.22 * c) : MOUND.h * Math.pow(c, 0.85); };
/** pure: the mound's surface height at (x, z) (0 off it) */
export function moundHeight(map, x, z) {
  const base = moundBase(map); if (!base || !pip(x, z, base)) return 0;
  const dx = x - MOUND.c[0], dz = z - MOUND.c[1], r = Math.hypot(dx, dz);
  if (r <= MOUND.top) return MOUND.h;
  const R = rayR(base, MOUND.c, Math.atan2(dx, dz));
  return prof(1 - (r - MOUND.top) / Math.max(0.1, R - MOUND.top));
}
/** the path up: a spiral from the foot on the Castle Yard side to the top's rim -> [[x, y, z], …] */
export function moundPath(map) {
  const base = moundBase(map), pts = [];
  const a0 = Math.atan2(-207.6 - MOUND.c[0], 341.0 - MOUND.c[1]);     // the foot of the mapped steps by the yard
  const N = 90, turns = 1.15;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = a0 + t * turns * TAU, R = rayR(base, MOUND.c, a);
    const r = MOUND.top + 0.6 + (R - MOUND.top - 1.6) * (1 - t);
    const x = MOUND.c[0] + Math.sin(a) * r, z = MOUND.c[1] + Math.cos(a) * r;
    pts.push([x, moundHeight(map, x, z), z]);
  }
  return pts;
}

/** distance in plan from (x, z) to a polyline [[x, y, z], …] */
function distToPath(path, x, z) {
  let best = 1e9;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], ex = b[0] - a[0], ez = b[2] - a[2], L2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[2]) * ez) / L2));
    best = Math.min(best, Math.hypot(x - a[0] - ex * t, z - a[2] - ez * t));
  }
  return best;
}
/** a handrail: a 6 cm band seen from both sides (4 triangles; a beam is 12) */
function rail(B, a, b) { const q = [[a[0], a[1] - 0.03, a[2]], [b[0], b[1] - 0.03, b[2]], [b[0], b[1] + 0.03, b[2]], [a[0], a[1] + 0.03, a[2]]], n = [b[2] - a[2], 0, a[0] - b[0]]; B.poly('cwTimberDk', q, n); B.poly('cwTimberDk', q, [-n[0], 0, -n[2]]); }
const ensure = (P, key, base, o) => { if (!P.cells.has(key)) P.cells.set(key, { ...P.cells.get(base), ...o }); };

/** the mound, the path, the well-head on top; the tower; the weir; D-Wing and the round building -> {near, far} */
export function build(P, map) {
  // coral rag: a smaller, greyer, rougher rubble than the city's (rusty and grey stones, wide joints)
  ensure(P, 'cwRagG', 'cwRag', { rx: 1 / 2.1, ry: 1 / 2.1, tint: [0.74, 0.72, 0.66], seed: 5.5 });
  ensure(P, 'cwRagGDk', 'cwRag', { rx: 1 / 2.1, ry: 1 / 2.1, tint: [0.58, 0.56, 0.51], seed: 5.5 });
  ensure(P, 'cwQuoin', 'stone', { rx: 1 / 1.6, ry: 1 / 1.6, tint: [0.8, 0.78, 0.72] });
  ensure(P, 'cwDressG', 'stone', { tint: [0.86, 0.85, 0.8] });
  ensure(P, 'cwBars', 'leaded', { tint: [0.4, 0.42, 0.46] });
  ensure(P, 'cwMud', 'cwGrass', { tint: [0.2, 0.15, 0.09] });
  // rough unmown grass on the motte: four shades from dark green to dry straw, mixed by a noise field per patch
  const ROUGH = ['cwRough0', 'cwRough1', 'cwRough2', 'cwRough3'];
  [[0.13, 0.19, 0.07], [0.17, 0.22, 0.08], [0.22, 0.25, 0.1], [0.28, 0.28, 0.13]].forEach((t, i) => ensure(P, ROUGH[i], 'cwGrass', { tint: t }));
  ensure(P, 'cwLeaf0', 'cwGrass', { tint: [0.05, 0.1, 0.035] }); ensure(P, 'cwLeaf1', 'cwGrass', { tint: [0.07, 0.13, 0.04] }); ensure(P, 'cwLeaf2', 'cwGrass', { tint: [0.09, 0.15, 0.05] });
  const roughKey = (x, z) => (NORTH ? ROUGH[Math.min(3, Math.floor((vnoise(x, z, 5.5, 31) * 0.65 + vnoise(x, z, 1.7, 47) * 0.35) * 4.6))] : 'cwGrass');
  const B = new RB(), F = new RB(), Bm = new RB(), Bt = new RB();
  const base = moundBase(map);
  let path = null;
  // ---- the mound: rings from the base outline up to the top's rim, then the top (smooth normals from the profile)
  if (base) {
    const K = NORTH ? 64 : 48, RINGS = NORTH ? 14 : 10, ring = [];
    for (let j = 0; j <= RINGS; j++) {
      const row = [];
      for (let k = 0; k < K; k++) {
        const a = (k / K) * TAU, R = rayR(base, MOUND.c, a), t = j / RINGS;
        const r = R + (MOUND.top - R) * t, x = MOUND.c[0] + Math.sin(a) * r, z = MOUND.c[1] + Math.cos(a) * r;
        row.push([x, j === 0 ? -0.05 : prof(t) + (j < RINGS ? (vnoise(x, z, 3.5, 2) - 0.5) * 0.35 : 0), z]);
      }
      ring.push(row);
    }
    const nor = ring.map((row, j) => row.map((p, k) => {
      const pa = row[(k + 1) % K], pb = row[(k + K - 1) % K], qa = ring[Math.min(RINGS, j + 1)][k], qb = ring[Math.max(0, j - 1)][k];
      const tx = pa[0] - pb[0], ty = pa[1] - pb[1], tz = pa[2] - pb[2], sx = qa[0] - qb[0], sy = qa[1] - qb[1], sz = qa[2] - qb[2];
      let nx = ty * sz - tz * sy, ny = tz * sx - tx * sz, nz = tx * sy - ty * sx; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
    }));
    for (let j = 0; j < RINGS; j++) for (let k = 0; k < K; k++) {
      const k1 = (k + 1) % K, a = ring[j][k], b = ring[j][k1], c = ring[j + 1][k1], d = ring[j + 1][k];
      Bm.quadN(roughKey((a[0] + c[0]) / 2, (a[2] + c[2]) / 2), a, b, c, d, nor[j][k], nor[j][k1], nor[j + 1][k1], nor[j + 1][k], [a[0], a[2]], [b[0], b[2]], [c[0], c[2]], [d[0], d[2]]);
      if (j % 2 === 0 && k % 2 === 0) F.poly(NORTH ? ROUGH[1 + ((k >> 1) + (j >> 1)) % 2] : 'cwGrass', [a, ring[j][(k + 2) % K], ring[Math.min(RINGS, j + 2)][(k + 2) % K], ring[Math.min(RINGS, j + 2)][k]], [a[0] - MOUND.c[0], 3, a[2] - MOUND.c[1]]);
    }
    const top = ring[RINGS];
    for (let k = 0; k < K; k++) { const a = top[k], b = top[(k + 1) % K]; Bm.triN('cwGrass', [MOUND.c[0], MOUND.h, MOUND.c[1]], a, b, [0, 1, 0], nor[RINGS][k], nor[RINGS][(k + 1) % K], [MOUND.c[0], MOUND.c[1]], [a[0], a[2]], [b[0], b[2]]); if (k % 2 === 0) F.poly('cwGrass', [[MOUND.c[0], MOUND.h, MOUND.c[1]], a, top[(k + 2) % K]], [0, 1, 0]); }
    // the trees on the top (photo: two or three big sycamores on the rim away from New Road; number, size and place a
    // GUESS): a trunk and a crown of overlapping lumps, standing just below the rim on the south-east side
    if (NORTH) for (const [ang, hgt, sp, sd] of [[2.35, 10.5, 4.6, 1], [1.55, 9.0, 4.0, 2], [3.2, 8.2, 3.6, 3]]) {
      const r = MOUND.top + 1.4, x = MOUND.c[0] + Math.sin(ang) * r, z = MOUND.c[1] + Math.cos(ang) * r, y0 = moundHeight(map, x, z) - 0.4;
      for (const [T, lod] of [[B, 0], [F, 1]]) {
        T.cyl('cwTimberDk', x, y0, z, 0.2, hgt * 0.42, lod ? 5 : 7, false, 0.36);
        const lumps = lod ? 2 : 5;
        for (let i = 0; i < lumps; i++) {
          const a = hash(i + sd * 7, 3) * TAU, d = i === 0 ? 0 : sp * (0.28 + 0.3 * hash(i + sd * 7, 5)), cy = y0 + hgt * (i === 0 ? 0.66 : 0.5 + 0.22 * hash(i + sd * 7, 9)), rr = (i === 0 ? sp : sp * (0.55 + 0.25 * hash(i + sd * 7, 11))) * (lod ? 1.12 : 1), hh = rr * 0.86;
          T.lathe('cwLeaf' + (i % 3), x + Math.sin(a) * d, z + Math.cos(a) * d, [[0.01, cy - hh], [rr * 0.62, cy - hh * 0.72], [rr, cy - hh * 0.1], [rr * 0.86, cy + hh * 0.5], [rr * 0.45, cy + hh * 0.9], [0.01, cy + hh]], { seg: lod ? 6 : 9, crease: 2 });
        }
      }
    }
    // daisies and buttercups in the grass (tiny flat stars; near level only)
    path = moundPath(map);
    for (let i = 0; i < 420; i++) {
      const a = hash(i, 1.3, 7) * TAU, R = rayR(base, MOUND.c, a), r = MOUND.top * 0.9 + (R - MOUND.top) * (0.05 + 0.85 * hash(i, 2.9, 7)) ;
      const x = MOUND.c[0] + Math.sin(a) * r, z = MOUND.c[1] + Math.cos(a) * r;
      if (distToPath(path, x, z) < 1.6 || vnoise(x, z, 4, 9) < 0.42) continue;
      const y = moundHeight(map, x, z) + 0.05, s = 0.07, key = hash(i, 4.4) < 0.3 ? 'cwYellow' : 'white';
      Bm.poly(key, [[x - s, y, z], [x, y + 0.01, z - s], [x + s, y, z], [x, y + 0.01, z + s]], [0, 1, 0]);
    }
    // the path: a gravel ribbon with timber risers and a handrail on the outside
    const w = 0.85;
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i], q = path[i + 1], dx = q[0] - p[0], dz = q[2] - p[2], L = Math.hypot(dx, dz) || 1, ox = (dz / L) * w, oz = (-dx / L) * w;
      const lift = 0.12;
      B.poly('cwGravel', [[p[0] - ox, p[1] + lift, p[2] - oz], [p[0] + ox, p[1] + lift, p[2] + oz], [q[0] + ox, q[1] + lift, q[2] + oz], [q[0] - ox, q[1] + lift, q[2] - oz]], [0, 1, 0]);
      if (q[1] - p[1] > 0.05) B.poly('cwTimberDk', [[q[0] - ox, p[1] + lift, q[2] - oz], [q[0] + ox, p[1] + lift, q[2] + oz], [q[0] + ox, q[1] + lift, q[2] + oz], [q[0] - ox, q[1] + lift, q[2] - oz]], [-dx, 0, -dz]);
      const sOut = Math.hypot(p[0] + ox - MOUND.c[0], p[2] + oz - MOUND.c[1]) > Math.hypot(p[0] - ox - MOUND.c[0], p[2] - oz - MOUND.c[1]) ? 1 : -1;
      if (i % 3 === 0) B.box('cwTimberDk', p[0] + ox * sOut * 1.1, p[1] + 0.55, p[2] + oz * sOut * 1.1, 0.08, 0.9, 0.08);
      const r0 = [p[0] + ox * sOut * 1.1, p[1] + 1.0, p[2] + oz * sOut * 1.1], r1 = [q[0] + ox * sOut * 1.1, q[1] + 1.0, q[2] + oz * sOut * 1.1];
      rail(B, r0, r1);
    }
    // the well-head on top, a bench, a fence round the rim
    { const [x, z] = [MOUND.c[0] + 0.5, MOUND.c[1] + 4.0], y = MOUND.h + 0.1;
      B.box('cwRagG', x, y + 0.7, z, 2.6, 1.4, 2.2, 0.3, { bottom: false });
      B.box('radLead', x, y + 1.48, z, 2.9, 0.16, 2.5, 0.3);
      B.push(frame(x + Math.sin(0.3) * 1.11, 0, z + Math.cos(0.3) * 1.11, Math.cos(0.3), -Math.sin(0.3))); B.unit('doorDark', [[-0.4, y], [0.4, y], [0.4, y + 1.2], [-0.4, y + 1.2]], 0.02, [3, 0]); B.pop();
      B.box('cwTimber', MOUND.c[0] - 3.5, y + 0.45, MOUND.c[1] - 2.5, 1.6, 0.08, 0.4, 0.8); B.box('cwTimberDk', MOUND.c[0] - 3.5, y + 0.22, MOUND.c[1] - 2.5, 1.5, 0.44, 0.3, 0.8, { top: false });
      const RR = MOUND.top - 0.3, n = 28;
      for (let k = 0; k < n; k++) { const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU, p0 = [MOUND.c[0] + Math.sin(a0) * RR, MOUND.h + 1.0, MOUND.c[1] + Math.cos(a0) * RR], p1 = [MOUND.c[0] + Math.sin(a1) * RR, MOUND.h + 1.0, MOUND.c[1] + Math.cos(a1) * RR]; B.box('cwTimberDk', p0[0], MOUND.h + 0.5, p0[2], 0.08, 1.0, 0.08, 0, { top: false }); rail(B, p0, p1); }
    }
  }
  // ---- St George's Tower: a battered, tapering shaft of coral rag, dressed quoins, two set-offs, put-log holes, a few
  // small round-headed windows, a plain parapet on a corbel course, the door
  {
    const Y = TW.roof, faces = [[1, 0, TW.hb], [-1, 0, TW.hb], [0, 1, TW.ha], [0, -1, TW.ha]];
    const batter = 2.6, flare = 0.7;
    for (const [na, nb, half] of faces) {
      const P0 = (s, y, out = 0) => { const q = na ? tw(na * (TW.ha + out), s, y) : tw(s, nb * (TW.hb + out), y); return [q[0], y, q[1]]; };
      const hint = [TW.u[0] * na + TW.v[0] * nb, 0.12, TW.u[1] * na + TW.v[1] * nb];
      // the shaft in a 4 x 8 grid (so the weathering tint can vary over it), above the batter
      const NX = 4, NY = 8;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const s0 = -half + (2 * half * i) / NX, s1 = -half + (2 * half * (i + 1)) / NX, y0 = batter + ((Y - batter) * j) / NY, y1 = batter + ((Y - batter) * (j + 1)) / NY;
        const q = [P0(s0, y0), P0(s1, y0), P0(s1, y1), P0(s0, y1)];
        Bt.poly('cwRagG', q, hint, [[s0 + half, y0], [s1 + half, y0], [s1 + half, y1], [s0 + half, y1]]);
      }
      // the batter: the base flares out, a sloping face
      F.poly('cwRagG', [P0(-half, 0), P0(half, 0), P0(half, TW.top), P0(-half, TW.top)], hint);
      // set-offs: a sloped weathering course at two heights
      for (const yo of [8.2, 14.6]) { B.poly('cwDressG', [P0(-half, yo, 0.16), P0(half, yo, 0.16), P0(half, yo + 0.22, 0), P0(-half, yo + 0.22, 0)], [hint[0], 0.8, hint[2]]); B.poly('cwRagGDk', [P0(-half, yo - 0.12, 0.16), P0(half, yo - 0.12, 0.16), P0(half, yo, 0.16), P0(-half, yo, 0.16)], hint); }
      // put-log holes in rows (the scaffold's sockets), deterministic gaps
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { if (hash(na * 5 + nb + r, c, 11) < 0.45) continue; const s = -half + 1.0 + c * ((2 * half - 2) / 3), y = 4.2 + r * 3.4; const d = [hint[0] * 0.03, 0, hint[2] * 0.03]; B.poly('radShade', [P0(s - 0.11, y), P0(s + 0.11, y), P0(s + 0.11, y + 0.18), P0(s - 0.11, y + 0.18)].map((p) => [p[0] + d[0], p[1], p[2] + d[2]]), hint); }
      // corbel course under the parapet and the parapet itself, a little proud of the shaft's head
      const pp = (s, y, o = 1.03) => { const q = na ? tw(na * TW.ha * o, s * o, Y) : tw(s * o, nb * TW.hb * o, Y); return [q[0], y, q[1]]; };
      B.poly('cwDressG', [pp(-half - 0.05, Y - 0.45, 1.0), pp(half + 0.05, Y - 0.45, 1.0), pp(half + 0.05, Y - 0.25), pp(-half - 0.05, Y - 0.25)], [hint[0], -0.5, hint[2]]);
      for (let c = 0; c < 9; c++) { const s = -half + 0.4 + c * ((2 * half - 0.8) / 8), a = pp(s - 0.12, Y - 0.6, 1.0), b = pp(s + 0.12, Y - 0.6, 1.0), e = pp(s + 0.12, Y - 0.45, 1.02), f = pp(s - 0.12, Y - 0.45, 1.02); B.poly('cwDressG', [a, b, e, f], hint); }
      Bt.poly('cwRagGDk', [pp(-half - 0.05, Y - 0.25), pp(half + 0.05, Y - 0.25), pp(half + 0.05, TW.top), pp(-half - 0.05, TW.top)], hint);
      // windows: small round-headed lights in dressed surrounds
      const ox = (s, y) => P0(s, y);
      for (const [sx, y, w, h] of [[-1.2, 6.5, 0.45, 1.0], [1.5, 11.2, 0.55, 1.3], [-0.6, 15.8, 0.5, 1.2], [0.9, 18.2, 0.4, 0.9]].filter((_, k) => hash(na * 3 + nb, k, 5) > 0.25)) {
        const c0 = ox(sx - w / 2, y), c1 = ox(sx + w / 2, y), c2 = ox(sx + w / 2, y + h), c3 = ox(sx - w / 2, y + h);
        const d = 0.04, n = [hint[0] * d, 0, hint[2] * d], ap = [(c2[0] + c3[0]) / 2, c2[1] + w * 0.5, (c2[2] + c3[2]) / 2];
        B.poly('cwDressG', [ox(sx - w / 2 - 0.18, y - 0.12), ox(sx + w / 2 + 0.18, y - 0.12), ox(sx + w / 2 + 0.18, y + h), ox(sx - w / 2 - 0.18, y + h)].map((p) => [p[0] + n[0] * 0.5, p[1], p[2] + n[2] * 0.5]), hint);
        B.poly('cwDressG', [ox(sx - w / 2 - 0.18, y + h), ox(sx + w / 2 + 0.18, y + h), [ap[0], ap[1] + 0.2, ap[2]]].map((p) => [p[0] + n[0] * 0.5, p[1], p[2] + n[2] * 0.5]), hint);
        B.poly('radShade', [c0, c1, c2, c3].map((p) => [p[0] + n[0], p[1], p[2] + n[2]]), hint);
        B.poly('radShade', [c3, c2, ap].map((p) => [p[0] + n[0], p[1], p[2] + n[2]]), hint);
      }
      // the door (south face): a porch built out through the batter, a round-headed doorway, a heavy oak door
      if (nb === 1) {
        const c = tw(0.6, TW.hb, 0);
        B.push(frame(c[0], 0, c[1], TW.v[1], -TW.v[0]));
        B.box('cwRagGDk', 0, 1.6, 0.45, 2.2, 3.2, 0.9, 0, { top: true });
        B.box('cwDressG', 0, 3.25, 0.5, 2.4, 0.18, 1.0);
        B.box('cwDressG', 0, 1.45, 0.92, 1.6, 2.9, 0.05, 0, { top: false });
        B.archUnit('archDoorOak', 0, 1.15, 0.0, 1.95, 0.955, [7, 0], 8);
        B.pop();
      }
    }
    // dressed quoins up every corner, long and short alternately
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let k = 0; k < 26; k++) {
        const y0 = batter + k * ((Y - 0.5 - batter) / 26), y1 = y0 + (Y - 0.5 - batter) / 26 - 0.03, L = k % 2 ? 0.55 : 0.32, M = k % 2 ? 0.32 : 0.55;
        const c = tw(a * TW.ha, b * TW.hb, y0), pa = tw(a * TW.ha - a * L, b * TW.hb, y0), pb = tw(a * TW.ha, b * TW.hb - b * M, y0), o = 0.03;
        const ua = [TW.u[0] * a * o, TW.u[1] * a * o], vb = [TW.v[0] * b * o, TW.v[1] * b * o];
        Bt.poly('cwQuoin', [[pa[0] + vb[0], y0, pa[1] + vb[1]], [c[0] + vb[0] + ua[0], y0, c[1] + vb[1] + ua[1]], [c[0] + vb[0] + ua[0], y1, c[1] + vb[1] + ua[1]], [pa[0] + vb[0], y1, pa[1] + vb[1]]], [TW.v[0] * b, 0, TW.v[1] * b]);
        Bt.poly('cwQuoin', [[c[0] + ua[0] + vb[0], y0, c[1] + ua[1] + vb[1]], [pb[0] + ua[0], y0, pb[1] + ua[1]], [pb[0] + ua[0], y1, pb[1] + ua[1]], [c[0] + ua[0] + vb[0], y1, c[1] + ua[1] + vb[1]]], [TW.u[0] * a, 0, TW.u[1] * a]);
      }
    }
    const r = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => tw(a * (TW.ha - 0.45 / TW.taper), b * (TW.hb - 0.45 / TW.taper), Y));
    B.poly('radLead', r.map(([x, z]) => [x, Y, z]), [0, 1, 0]);
    for (let i = 0; i < 4; i++) { const a = r[i], b = r[(i + 1) % 4]; B.poly('cwRagGDk', [[a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], TW.top, b[1]], [a[0], TW.top, a[1]]], [TW.c[0] - (a[0] + b[0]) / 2, 0, TW.c[1] - (a[1] + b[1]) / 2]); }
    const o = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => tw(a * TW.ha * 1.03, b * TW.hb * 1.03, Y));
    for (let i = 0; i < 4; i++) { const a = o[i], b = o[(i + 1) % 4], p = r[i], q = r[(i + 1) % 4]; B.poly('cwDressG', [[a[0], TW.top, a[1]], [b[0], TW.top, b[1]], [q[0], TW.top, q[1]], [p[0], TW.top, p[1]]], [0, 1, 0]); }
    F.poly('radLead', o.map(([x, z]) => [x, TW.top, z]), [0, 1, 0]);
    const [fx, fz] = tw(-TW.ha + 1.6, -TW.hb + 1.6, Y); B.cyl('white', fx, Y, fz, 0.05, 6, 6, true, 0.07);
    // the batter's top: a sloped weathering where the flare meets the shaft
    const pl = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => tw(a * (TW.ha + flare), b * (TW.hb + flare), 0)), pt = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => tw(a * TW.ha, b * TW.hb, batter));
    for (let i = 0; i < 4; i++) { const a = pl[i], b = pl[(i + 1) % 4], c = pt[(i + 1) % 4], d = pt[i], mx = (a[0] + b[0]) / 2 - TW.c[0], mz = (a[1] + b[1]) / 2 - TW.c[1]; B.poly('cwRagGDk', [[a[0], 0, a[1]], [b[0], 0, b[1]], [c[0], batter, c[1]], [d[0], batter, d[1]]], [mx, 0.3, mz]); }
  }
  // ---- the weir on the Castle Mill Stream by the tower (where the mill stood): a step of white water
  { const a = [-256.5, 381.5], b = [-243.8, 384.5], n = 6; for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, p = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], q = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]; B.poly('cwWhite', [[p[0], 0.06, p[1]], [q[0], 0.06, q[1]], [q[0] + 0.4, 0.05, q[1] + 1.4], [p[0] + 0.4, 0.05, p[1] + 1.4]], [0, 1, 0]); B.poly('cwConcrete', [[p[0], 0.02, p[1] - 0.3], [q[0], 0.02, q[1] - 0.3], [q[0], 0.1, q[1]], [p[0], 0.1, p[1]]], [0, 0.3, -1]); } }
  // ---- D-Wing and the round building (the old gaol, a hotel since 2005): grey rubble, rows of small barred windows
  prison(B, F, map);
  // per-vertex colour: patchy grass, a worn earth margin along the path, damp at the foot; streaky weathered rag
  const grass = (x, y, z, t) => {
    if (t[1] < t[0] * 1.2) return t;      // daisies, buttercups
    const n1 = vnoise(x, z, 6, 1), n2 = vnoise(x, z, 2.2, 3), k = 0.72 + 0.7 * n1 + 0.25 * n2, yel = 0.8 + 0.5 * vnoise(x, z, 9, 5);
    let r = 0.15 * k * yel, g = 0.235 * k, b = 0.07 * k * (2 - yel);
    const foot = Math.max(0, 1 - y / 2.5) * 0.25; r *= 1 - foot; g *= 1 - foot; b *= 1 - foot;
    if (path) { const d = distToPath(path, x, z), wv = Math.max(0, Math.min(1, (2.0 - d) / 1.1)) * (0.7 + 0.3 * n2); r += (0.22 - r) * wv; g += (0.17 - g) * wv; b += (0.1 - b) * wv; }
    return [r, g, b];
  };
  const rag = (x, y, z, t) => { const n = vnoise(x + z, y, 1.6, 4), st = vnoise((x - z) * 3, y * 0.3, 1.2, 6), k = 0.8 + 0.35 * n - 0.18 * st * Math.min(1, y / 6) - (y < 1.5 ? 0.12 : 0); return [t[0] * k, t[1] * k * 0.99, t[2] * k * 0.97]; };
  const near = mergeGeos([tintGeo(geoOf(Bm, P), grass), tintGeo(geoOf(Bt, P), rag), geoOf(B, P)]);
  const far = tintGeo(geoOf(F, P), (x, y, z, t) => (t[1] > t[0] * 1.2 && t[1] < 0.5 ? grass(x, y, z, t) : t));
  return { near, far };
}

/** D-Wing (a long range of four floors of small windows under a slate roof) and the round building at its east end
 *  (a bastion of rubble with a battlemented parapet and the arched gate into the yard), in the shared atlas */
function prison(B, F, map) {
  const dw = map.buildings.find((q) => q.id === DWING), rd = map.buildings.find((q) => q.id === ROUND);
  if (dw) {
    emitRange(B, [dw.poly], { h: 10.0, wall: 'cwRagG', dress: 'cwDressG', win: 'cwBars', winW: 0.7, bay: 2.4, storeys: [1.5, 2.5, 4.4, 5.4, 7.3, 8.3], strings: [3.6, 6.6], roof: 'radLead', bay0: 700 });
    // a slate roof over the range's long axis (gabled), and its far version
    const p = dw.poly, e = [p[1][0] - p[0][0], p[1][1] - p[0][1]], L = Math.hypot(e[0], e[1]), ax = [e[0] / L, e[1] / L], pr = [-ax[1], ax[0]];
    let s0 = 1e9, s1 = -1e9, t0 = 1e9, t1 = -1e9;
    for (const q of p) { const s = (q[0] - p[0][0]) * ax[0] + (q[1] - p[0][1]) * ax[1], t = (q[0] - p[0][0]) * pr[0] + (q[1] - p[0][1]) * pr[1]; s0 = Math.min(s0, s); s1 = Math.max(s1, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t); }
    s0 += 0.6; s1 -= 2.2; t0 += 0.5; t1 -= 0.5;
    const W = (s, t, y) => [p[0][0] + ax[0] * s + pr[0] * t, y, p[0][1] + ax[1] * s + pr[1] * t], tm = (t0 + t1) / 2, ridge = 10 + (t1 - t0) * 0.42;
    for (const R of [B, F]) {
      R.poly('slate', [W(s0, t0, 10), W(s1, t0, 10), W(s1, tm, ridge), W(s0, tm, ridge)], [pr[0] * -1, 1, pr[1] * -1]);
      R.poly('slate', [W(s1, t1, 10), W(s0, t1, 10), W(s0, tm, ridge), W(s1, tm, ridge)], [pr[0], 1, pr[1]]);
      for (const s of [s0, s1]) R.poly('cwRagG', [W(s, t0, 10), W(s, t1, 10), W(s, tm, ridge)], [ax[0] * (s === s0 ? -1 : 1), 0, ax[1] * (s === s0 ? -1 : 1)]);
    }
    for (let k = 0; k < 4; k++) { const s = s0 + 2 + k * ((s1 - s0 - 4) / 3); B.box('cwRagGDk', ...((q) => [q[0], ridge + 0.6, q[2]])(W(s, tm, 0)), 0.7, 1.4, 0.9, Math.atan2(ax[0], ax[1])); }
    F.flat('cwRagG', p, 10.0);
  }
  if (rd) {
    emitRange(B, [rd.poly], { h: 8.9, wall: 'cwRagG', dress: 'cwDressG', win: 'cwBars', winW: 0.6, bay: 2.6, storeys: [4.6, 5.5, 7.0, 7.8], crenel: true, roof: 'radLead', bay0: 900 });
    F.flat('radLead', rd.poly, 8.9);
    for (let i = 0; i < rd.poly.length; i++) { const a = rd.poly[i], b = rd.poly[(i + 1) % rd.poly.length]; F.poly('cwRagG', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 9.8, b[1]], [a[0], 9.8, a[1]]], null); }
    // the gate into the yard (north side): a round-headed arch in a dressed surround, studded oak doors
    const a = [-206.9, 361.4], b = [-204.3, 362.0], d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]), n = [d[1] / L, -d[0] / L];
    const Fm = frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, -d[0] / L, -d[1] / L);
    B.push(Fm);
    const fz = n[1] < 0 ? 1 : -1; void fz;
    B.box('cwDressG', 0, 1.9, 0.15, 2.6, 3.8, 0.3, 0, { bottom: false });
    B.archUnit('archDoorOak', 0, 1.7, 0.0, 1.9, 0.31, [5, 0], 8);
    B.box('cwDressG', 0, 4.0, 0.2, 3.0, 0.3, 0.4);
    B.pop();
  }
  void F;
}

/** the courtyard dressing: tables with parasols outside the restaurants -> geometry; returns also the board spots */
export function courtyard(P, map) {
  const B = new RB();
  const tables = [[-214, 378.5], [-210.5, 380.0], [-207.5, 375.5], [-199, 362.5], [-195.5, 364.5], [-226, 372.5]];
  tables.forEach(([x, z], i) => {
    B.cyl('cwWhite', x, 0.72, z, 0.45, 0.04, 10); B.cyl('iron', x, 0, z, 0.04, 0.72, 5, false);
    B.cyl('cwSteel', x, 0.76, z, 0.03, 1.6, 4, false);
    B.lathe(i % 2 ? 'cwCream' : 'cwMaroon', x, z, [[0.0, 2.15], [1.3, 1.95], [1.25, 1.85], [0.0, 2.1]], { seg: 8 });
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4; B.box('cwTimberDk', x + Math.sin(a) * 0.8, 0.45, z + Math.cos(a) * 0.8, 0.42, 0.06, 0.42, a); B.box('cwTimberDk', x + Math.sin(a) * 1.0, 0.75, z + Math.cos(a) * 1.0, 0.42, 0.6, 0.05, a); }
  });
  void map;
  return { geo: geoOf(B, P), tables };
}
