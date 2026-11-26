// The Covered Market — plan and exterior (owned by places/covered_market.js). Research: docs/research/city_centre_west.md.
// KNOWN: opened 1774 between the High and Market Street; John Gwynn's High Street frontage (Nos. 10–16, rebuilt to match
// in 1774) with the avenues entering through it; four avenues running north–south (Avenue 1 cut through No. 10 in 1838)
// crossed by east–west ways; iron (1830s) and later timber roofs over the avenues, glazed along their ridges; butchers,
// game dealers, greengrocers, bakers and cafés inside. Avenue lines and the outline from OSM.
// GUESSED: the Market Street front's design, the roofs' exact form (one raised glazed lantern per avenue over flat
// roofs), the entrance gates, the stall grid.
import { RB, frame, rectPts, geoOf, pip } from './_cw_kit.js';

export const ID = 'w3663178';
export const FRONT_IDS = ['w1278860864', 'w1278861296', 'w1278861923'];       // Nos. 10–12, 13–14, 15–16 High Street
// avenue centrelines, from the back of the High Street passage (south) to the Market Street door (north)
export const AVENUES = [
  { n: 1, s: [212.1, 298.5], e: [199.5, 219.7], mouth: [214.9, 312.1], infill: [[212.85, 309.8], [215.7, 309.3]], back: [[210.5, 298.5], [213.6, 298.5]] },
  { n: 2, s: [227.7, 295.9], e: [211.1, 211.5], mouth: [229.8, 306.65], infill: [[228.7, 306.8], [230.9, 306.5]], back: [[226.6, 296.0], [228.8, 295.7]] },
  { n: 3, s: [242.8, 293.0], e: [222.3, 203.7], mouth: [244.95, 303.6], infill: [[243.9, 304.0], [246.0, 303.2]], back: [[241.8, 293.2], [243.8, 292.8]] },
  { n: 4, s: [255.3, 291.1], e: [233.3, 197.8], mouth: [257.5, 301.7], infill: [[256.3, 301.1], [258.55, 300.64]], back: [[254.1, 290.7], [256.3, 291.5]] },
];
// the east–west ways: behind the frontage, and across the middle (Golden Cross comes in at its west end)
export const CROSS = [{ a: [211.4, 294.1], b: [256.4, 286.4] }, { a: [204.0, 257.9], b: [248.4, 246.5] }];
export const GOLDEN = { door: [201.0, 258.5], inside: [205.2, 257.6], facing: -Math.PI / 2 - 0.27 };
export const H = { wall: 6.6, ceil: 3.4, fascia: 4.0, eave: 4.3, ridge: 7.6, lantern: 7.9, peak: 9.2, aveW: 3.0, stallD: 3.9 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const norm = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
/** the Market Street door of an avenue: just outside the north wall */
export function northDoor(av) { const d = norm(sub(av.e, av.s)); return { pos: [av.e[0] + d[0] * 1.6, av.e[1] + d[1] * 1.6], facing: Math.atan2(d[0], d[1]), inside: [av.e[0] - d[0] * 2.2, av.e[1] - d[1] * 2.2] }; }
/** the High Street door of an avenue: in the passage, 2.5 m short of the market's back wall */
export function southDoor(av) { const d = norm(sub(av.mouth, av.s)); return { pos: [av.s[0] + d[0] * 2.5, av.s[1] + d[1] * 2.5], facing: Math.atan2(d[0], d[1]), inside: [av.s[0] - d[0] * 2.0, av.s[1] - d[1] * 2.0] }; }

/** the market's outline without the High Street frontage band (roof and walls) */
export function body(map) {
  const b = map.buildings.find((q) => q.id === ID);
  if (!b) return null;
  return (b.cwOrig || b.poly).filter((p) => p[1] <= 296.5);
}

/**
 * The generic block is KEPT in the city (not skipped) but shrunk out of sight, so its neighbours' party walls stay hidden
 * exactly as in the bare world (skipping it exposed them, which grew a city facade tile at (366, 105) into the Cornmarket
 * view: +1 draw, +11.7k triangles). Its outline becomes the market body (no High Street band: the passages stay open)
 * with every edge that does not stand against another building pulled 0.55 m inwards (behind the hand-built walls),
 * and it is marked a building part (no shop signs, awnings or POIs on it; no map collision: chainsOf() keeps the real
 * walls solid). Pure: returns the new ring.
 */
export function hiddenBlock(map, inset = 0.55) {
  const b = map.buildings.find((q) => q.id === ID);
  if (!b) return null;
  const ring = body(map), n = ring.length, others = [];
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of ring) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  for (const q of map.buildings) { if (q === b || !q.poly || q.part) continue; const c = q.c || q.poly[0]; if (c[0] > x0 - 60 && c[0] < x1 + 60 && c[1] > z0 - 60 && c[1] < z1 + 60) others.push(q.poly); }
  let A = 0; for (let i = 0; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
  const sg = A > 0 ? 1 : -1, off = [], nrm = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i], c = ring[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const nx = (dz / L) * sg, nz = (-dx / L) * sg;          // outward
    const ns = Math.max(2, Math.ceil(L / 0.6)); let covered = true;
    for (let k = 0; k <= ns && covered; k++) { const t = Math.min(L - 0.1, Math.max(0.1, (k / ns) * L)) / L, x = a[0] + dx * t + nx * 0.15, z = a[1] + dz * t + nz * 0.15; covered = others.some((P) => pip(x, z, P)); }
    off.push(covered ? 0 : inset); nrm.push([nx, nz]);
  }
  // each vertex: where its two edges' offset lines meet (inward = -normal * offset)
  return ring.map((p, i) => {
    const j = (i + n - 1) % n, [ax, az] = nrm[j], [bx, bz] = nrm[i], oa = off[j], ob = off[i];
    if (!oa && !ob) return [p[0], p[1]];
    const det = ax * bz - az * bx;
    if (Math.abs(det) < 0.15) { const o = Math.max(oa, ob), mx = ax + bx, mz = az + bz, ml = Math.hypot(mx, mz) || 1; return [p[0] - (mx / ml) * o, p[1] - (mz / ml) * o]; }
    // solve n_a·d = -oa, n_b·d = -ob
    const dx = (-oa * bz + ob * az) / det, dz = (-ob * ax + oa * bx) / det;
    return [p[0] + dx, p[1] + dz];
  });
}
/** pure: is (x, z) on an avenue or a cross way (within half-width + pad)? */
export function onWay(x, z, pad = 0) {
  const seg = (a, b) => { const d = sub(b, a), L = len(d), t = Math.max(0, Math.min(1, ((x - a[0]) * d[0] + (z - a[1]) * d[1]) / (L * L))); return Math.hypot(x - a[0] - d[0] * t, z - a[1] - d[1] * t); };
  for (const av of AVENUES) if (seg(av.s, av.e) < H.aveW / 2 + pad) return true;
  for (const c of CROSS) if (seg(c.a, c.b) < H.aveW / 2 + pad) return true;
  return false;
}

/**
 * Stall slots along both sides of every avenue: [{x, z, ax, az (unit along the avenue, northwards), nx, nz (into the
 * avenue), w, d, avenue, side, i}] — the stall's front centre on the avenue edge. Deterministic.
 */
export function stallSlots(map) {
  const bodyP = body(map), out = [];
  for (const av of AVENUES) {
    const d = norm(sub(av.e, av.s)), L = len(sub(av.e, av.s)), W = 4.1;
    for (const side of [-1, 1]) {
      const nOut = [d[1] * side, -d[0] * side];       // from the avenue's centre out to this side
      for (let t = 4.5; t < L - 2.6; t += W) {
        const cx = av.s[0] + d[0] * t + nOut[0] * (H.aveW / 2), cz = av.s[1] + d[1] * t + nOut[1] * (H.aveW / 2);
        const mid = [cx + nOut[0] * H.stallD / 2, cz + nOut[1] * H.stallD / 2];
        const back = [cx + nOut[0] * (H.stallD - 0.2), cz + nOut[1] * (H.stallD - 0.2)];
        if (CROSS.some((c) => { const e = sub(c.b, c.a), l = len(e), u = Math.max(0, Math.min(1, ((cx - c.a[0]) * e[0] + (cz - c.a[1]) * e[1]) / (l * l))); return Math.hypot(cx - c.a[0] - e[0] * u, cz - c.a[1] - e[1] * u) < H.aveW / 2 + W / 2 + 0.3; })) continue;
        if (!bodyP || !pip(mid[0], mid[1], bodyP) || !pip(back[0], back[1], bodyP)) continue;
        if (onWay(back[0], back[1], 0.2) || onWay(mid[0], mid[1], 0.2)) continue;
        out.push({ x: cx, z: cz, ax: d[0], az: d[1], nx: -nOut[0], nz: -nOut[1], w: W - 0.12, d: H.stallD, avenue: av.n, side, i: out.length });
      }
    }
  }
  return out;
}

/** the market's collision (world): its walls but the frontage band (whose houses are mapped and solid), each passage's
 *  back, and the east side of Avenue 4's passage (its neighbour is not mapped as a building) */
export function chainsOf(map) {
  const chains = AVENUES.map((av) => av.back);
  chains.push([[256.3, 291.5], [258.7, 302.3]]);
  const b = map.buildings.find((q) => q.id === ID); if (!b) return chains;
  const ring = b.cwOrig || b.poly;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length]; if (a[1] > 296.45 && c[1] > 296.45) continue; chains.push([a, c]); }
  return chains;
}

/** wall pieces along a polyline with openings (arclength centres, width w, head y) — faces on the side `sgn` */
function wallAlong(B, pts, key, y1, holes, outward) {
  let s0 = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = len(sub(b, a)); if (L < 0.05) continue;
    const d = norm(sub(b, a)), n = outward(a, b);
    const F = frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, n[1], -n[0]);
    // the frame's +x runs along (n.z, -n.x): decide the local x of a and b
    const fx = (p) => (p[0] - (a[0] + b[0]) / 2) * n[1] - (p[1] - (a[1] + b[1]) / 2) * n[0];
    const xa = fx(a), xb = fx(b), lo = Math.min(xa, xb), hi = Math.max(xa, xb);
    const hs = [];
    for (const h of holes) {
      const c = h.s - s0;  // along a->b
      if (c + h.w / 2 < 0 || c - h.w / 2 > L) continue;
      const xc = xa + (xb - xa) * (c / L), x0 = Math.max(lo + 0.01, xc - h.w / 2), x1 = Math.min(hi - 0.01, xc + h.w / 2);
      if (x1 - x0 > 0.2) hs.push([x0, x1, h.top, h]);
    }
    B.push(F);
    B.face(key, rectPts(lo, 0, hi, y1), hs.map(([x0, x1, t]) => rectPts(x0, 0, x1, t)), 0);
    for (const [x0, x1, t, h] of hs) {
      B.reveal('radWarm', rectPts(x0, 0, x1, t), 0, -0.4, true);
      B.poly('radShade', [[x0, 0, -0.38], [x1, 0, -0.38], [x1, t, -0.38], [x0, t, -0.38]], [0, 0, 1]);
      if (h.sign) h.sign(F, x0, x1, t);
    }
    B.pop();
    s0 += L;
  }
}

/** the exterior: {near, mid, far} geometries, signs (a Batch of sign quads), collider chains */
export function buildExterior(P, map, signsUv) {
  const B = new RB(), Bs = new (B.constructor)();
  const bodyP = body(map), chains = [];
  if (!bodyP) return null;
  const area = (() => { let A = 0; for (let i = 0; i < bodyP.length; i++) { const p = bodyP[i], q = bodyP[(i + 1) % bodyP.length]; A += p[0] * q[1] - q[0] * p[1]; } return A; })();
  const outward = (a, b) => { const d = norm(sub(b, a)); return area > 0 ? [d[1], -d[0]] : [-d[1], d[0]]; };
  // the Market Street front: from the north-east corner west along the north edge, with the four avenue doors
  const north = bodyP.filter((p) => p[1] < 224 && p[0] < 241);
  north.sort((p, q) => q[0] - p[0]);
  const sAt = (pt) => { let s = 0, best = 1e9, bs = 0; for (let i = 0; i < north.length - 1; i++) { const a = north[i], b = north[i + 1], d = sub(b, a), L = len(d), t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * d[0] + (pt[1] - a[1]) * d[1]) / (L * L))), e = Math.hypot(pt[0] - a[0] - d[0] * t, pt[1] - a[1] - d[1] * t); if (e < best) { best = e; bs = s + t * L; } s += L; } return bs; };
  const holes = AVENUES.map((av) => ({ s: sAt(av.e), w: 3.0, top: 3.1 }));
  // over each Market Street door: a green fascia with the board on it, and the door's posts (one frame per door, facing
  // out along the avenue, so a door on a corner of the frontage still gets one straight board)
  for (const av of AVENUES) {
    const d = norm(sub(av.e, av.s)), F = frame(av.e[0] + d[0] * 0.25, 0, av.e[1] + d[1] * 0.25, d[1], -d[0]);
    B.push(F); B.box('cwGreen', 0, 3.55, 0.0, 3.4, 0.55, 0.12, 0, { bottom: true }); for (const sx of [-1.5, 1.5]) B.box('cwGreen', sx, 1.55, -0.05, 0.14, 3.1, 0.14); B.pop();
    Bs.push(F); Bs.card('signs', [-1.55, 3.33, 0.07], [1.55, 3.33, 0.07], [1.55, 3.77, 0.07], [-1.55, 3.77, 0.07], signsUv('market')); Bs.pop();
  }
  wallAlong(B, north, 'cwStucco', H.wall, holes, outward);
  // the Market Street front: a green shop fascia and shop windows between the doors, a cornice
  for (let i = 0; i < north.length - 1; i++) {
    const a = north[i], b = north[i + 1], L = len(sub(b, a)); if (L < 2) continue;
    const n = outward(a, b), F = frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, n[1], -n[0]);
    B.push(F);
    B.box('radPale', 0, H.wall - 0.15, 0.12, L + 0.2, 0.3, 0.24, 0, { bottom: true });
    B.box('cwGreen', 0, 3.45, 0.06, L, 0.12, 0.12, 0, { bottom: true });
    const k = Math.floor((L - 3.2) / 3.4);
    for (let j = 0; j < k; j++) {
      const x = -L / 2 + 1.6 + (j + 0.5) * ((L - 3.2) / k);
      const p = [x + (a[0] + b[0]) / 2, 0]; void p;
      B.unit('sashDark', rectPts(x - 1.1, 0.6, x + 1.1, 2.7), 0.05, [i * 7 + j, 0]);
      B.box('cwGreen', x, 0.3, 0.08, 2.4, 0.6, 0.16, 0, { top: true });
      B.unit('sash', rectPts(x - 0.55, 4.2, x + 0.55, 5.8), 0.03, [i * 7 + j, 1]);
    }
    B.pop();
  }
  // the other walls (party walls, seen from above and from Golden Cross)
  for (let i = 0; i < bodyP.length; i++) {
    const a = bodyP[i], b = bodyP[(i + 1) % bodyP.length];
    if (north.includes(a) && north.includes(b)) continue;
    const L = len(sub(b, a)); if (L < 0.05) continue;
    const n = outward(a, b);
    B.poly('cwStucco', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H.wall, b[1]], [a[0], H.wall, a[1]]], [n[0], 0, n[1]], [[0, 0], [L, 0], [L, H.wall], [0, H.wall]]);
  }
  // the roof: flat between the avenues, a raised glazed lantern with a slate ridge over every avenue and cross way
  B.flat('leadFlat', bodyP, H.wall);
  const lantern = (a, b, cut = 0) => {
    const d = norm(sub(b, a)), L = len(sub(b, a)) - cut, n = [d[1], -d[0]];
    const F = frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, d[0], d[1]);
    void n; B.push(F);
    const hw = 2.2, rw = 2.5;
    for (const sx of [-1, 1]) {
      B.poly('cwGlassRoof', [[-L / 2, H.wall, sx * hw], [L / 2, H.wall, sx * hw], [L / 2, H.lantern, sx * hw], [-L / 2, H.lantern, sx * hw]], [0, 0, sx], [[0, 0], [L / 3, 0], [L / 3, 1], [0, 1]].map(([u, v]) => [u * 0 + v * 0 + u / (L / 3), v]));
      B.poly('cwSlate', [[-L / 2 - 0.3, H.lantern - 0.05, sx * rw], [L / 2 + 0.3, H.lantern - 0.05, sx * rw], [L / 2 + 0.3, H.peak, 0], [-L / 2 - 0.3, H.peak, 0]], [0, 1, sx * 0.6]);
      B.poly('cwStucco', [[sx * L / 2, H.wall, -hw], [sx * L / 2, H.wall, hw], [sx * L / 2, H.lantern, hw], [sx * L / 2, H.lantern, -hw]], [sx, 0, 0]);
      B.poly('cwStucco', [[sx * L / 2, H.lantern - 0.05, -rw], [sx * L / 2, H.lantern - 0.05, rw], [sx * L / 2, H.peak, 0]], [sx, 0, 0]);
    }
    B.box('radLead', 0, H.peak + 0.05, 0, L + 0.6, 0.12, 0.25);
    B.pop();
  };
  for (const av of AVENUES) lantern(av.s, av.e, 1.0);
  for (const c of CROSS) lantern(c.a, c.b, 3.0);
  // the High Street: each passage's front between the frontage houses (an opening, the board over it, a stone front
  // above in the houses' style), the passage ceiling, and the gates at the back
  for (const av of AVENUES) {
    const [L0, R0] = av.infill, d = norm(sub(R0, L0)), w = len(sub(R0, L0)), n = [d[1], -d[0]];
    const nn = n[1] > 0 ? n : [-n[0], -n[1]];        // facing the street (south)
    const F = frame((L0[0] + R0[0]) / 2, 0, (L0[1] + R0[1]) / 2, nn[1], -nn[0]);
    B.push(F);
    B.poly('radHoney', [[-w / 2, 3.45, 0], [w / 2, 3.45, 0], [w / 2, 11.0, 0], [-w / 2, 11.0, 0]], [0, 0, 1]);
    B.unit('sash', rectPts(-0.5, 5.0, 0.5, 6.9), 0.03, [av.n, 1]); B.unit('sash', rectPts(-0.5, 8.0, 0.5, 9.6), 0.03, [av.n + 5, 1]);
    B.box('radPale', 0, 3.3, 0.06, w + 0.1, 0.3, 0.14, 0, { bottom: true });
    B.box('cwGreen', 0, 2.95, 0.05, w, 0.45, 0.1, 0, { bottom: true });
    B.pop();
    Bs.push(F); Bs.card('signs', [-w / 2 + 0.05, 2.76, 0.12], [w / 2 - 0.05, 2.76, 0.12], [w / 2 - 0.05, 3.14, 0.12], [-w / 2 + 0.05, 3.14, 0.12], signsUv('market')); Bs.pop();
    // ceiling of the passage (3.45 m), from the street front to the back
    const [bl, br] = av.back;
    B.poly('cwStucco', [[L0[0], 3.45, L0[1]], [R0[0], 3.45, R0[1]], [br[0], 3.45, br[1]], [bl[0], 3.45, bl[1]]], [0, -1, 0]);
    // the back: the market's wall with a doorway (dark: the market is darker than the street), gates folded back
    const db = norm(sub(br, bl)), wb = len(sub(br, bl)), nb = [db[1], -db[0]], nbs = nb[1] > 0 ? nb : [-nb[0], -nb[1]];
    const Fb = frame((bl[0] + br[0]) / 2, 0, (bl[1] + br[1]) / 2, nbs[1], -nbs[0]);
    B.push(Fb);
    B.poly('cwStucco', [[-wb / 2, 2.9, 0], [wb / 2, 2.9, 0], [wb / 2, 3.45, 0], [-wb / 2, 3.45, 0]], [0, 0, 1]);
    B.poly('radShade', [[-wb / 2, 0, -0.3], [wb / 2, 0, -0.3], [wb / 2, 2.9, -0.3], [-wb / 2, 2.9, -0.3]], [0, 0, 1]);
    for (const sx of [-1, 1]) { const x = sx * (wb / 2 - 0.08); B.box('cwGreen', x, 1.45, 0.25, 0.06, 2.9, 0.5); for (let k = 0; k < 4; k++) B.box('cwGreen', x, 0.5 + k * 0.7, 0.25, 0.08, 0.05, 0.55); }
    B.box('cwGreen', 0, 2.75, 0.05, wb, 0.3, 0.1);
    B.pop();
  }
  chains.push(...chainsOf(map));
  const near = geoOf(B, P);
  // far: the flat roof and the lanterns' big faces (no walls: the market is behind the frontage from the ground)
  const Fr = new RB(); Fr.flat('leadFlat', bodyP, H.wall);
  const farL = (a, b, cut) => { const d = norm(sub(b, a)), L = len(sub(b, a)) - cut, F = frame((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, d[0], d[1]); Fr.push(F); for (const sx of [-1, 1]) Fr.poly('cwSlate', [[-L / 2, H.wall, sx * 2.5], [L / 2, H.wall, sx * 2.5], [L / 2, H.peak, 0], [-L / 2, H.peak, 0]], [0, 1, sx * 0.6]); Fr.pop(); };
  for (const av of AVENUES) farL(av.s, av.e, 1); for (const c of CROSS) farL(c.a, c.b, 3);
  const far = geoOf(Fr, P);
  return { near, far, signs: Bs, chains, bodyP };
}
