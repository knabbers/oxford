// Oxford railway station c. 2013 — geometry and the platforms' plan (owned by places/oxford_station.js).
// Research: docs/research/city_centre_west.md.
// KNOWN: the 1990 Network SouthEast building (low, brick and glass) on the east side facing the forecourt by Park End
// Street / Frideswide Square; platform 1 on the building side, platform 2 to the west, a covered footbridge between
// them; bus stops, a taxi rank and very large cycle parking (a two-tier rack area between the forecourt and Botley Road)
// on the forecourt. Platform canopy / building outlines and the footbridge from OSM.
// GUESSED: the platforms' exact width and the track spacing (four roads, through lines between the platform lines), the
// canopy and building heights and details, the stair geometry, the covered way north of the station (invented: it is
// where the trains come from and go to).
import * as THREE from 'three';
import { RB, frame, geoOf, TAU, hash, BIKE_KEYS, vnoise, tintGeo, mergeGeos } from './_cw_kit.js';

export const SKIP = ['w27183562', 'w513918928', 'w569988673', 'w234429851'];
// the station frame: origin at the footbridge, u along the tracks (south), n across them (east)
export const O = [-719.3, 123.0], U = [0.178, 0.984], N = [0.984, -0.178];
export const L = (s, t) => [O[0] + U[0] * s + N[0] * t, O[1] + U[1] * s + N[1] * t];
export const toST = (x, z) => { const dx = x - O[0], dz = z - O[1]; return [dx * U[0] + dz * U[1], dx * N[0] + dz * N[1]]; };
export const headingS = Math.atan2(U[0], U[1]);    // facing south along the tracks
// plan (s, t ranges)
export const PLAT = { y: 0.95, s0: -95, s1: 104, p2: [-22.5, -10.0], p1: [8.0, 15.5] };
export const TRACKS = [-8.3, -3.3, 1.7, 6.3];
export const BRIDGE = { s0: 0.0, s1: 2.6, y: 6.4, t0: -14.2, t1: 12.3 };
export const STAIRS = [{ t0: -14.2, t1: -11.8, s0: 2.6, s1: 12.6 }, { t0: 9.9, t1: 12.3, s0: 2.6, s1: 12.6 }];
export const BLD = { t0: 15.5, t1: 35.0, s0: 14, s1: 92, h: 6.2, ridge: 8.6 };
export const ENTRANCE_S = 48;      // the forecourt doors (the middle of the east front)
export const TUNNEL = [-152, -120];

/** pure: the floor height on the platforms / stairs / footbridge; upper = the player is on the footbridge level */
export function floorAt(x, z, upper) {
  const [s, t] = toST(x, z);
  for (const st of STAIRS) if (t >= st.t0 - 0.05 && t <= st.t1 + 0.05 && s >= st.s0 && s <= st.s1) return PLAT.y + (BRIDGE.y - PLAT.y) * (st.s1 - s) / (st.s1 - st.s0);
  if (upper && s >= BRIDGE.s0 - 0.1 && s <= BRIDGE.s1 + 0.1 && t >= BRIDGE.t0 && t <= BRIDGE.t1) return BRIDGE.y;
  return PLAT.y;
}
/** pure: where a point is: 'p1' | 'p2' | 'stair' | 'bridge' | null (off the platforms: tracks) */
export function zoneAt(x, z, upper) {
  const [s, t] = toST(x, z);
  if (STAIRS.some((st) => t >= st.t0 && t <= st.t1 && s >= st.s0 && s <= st.s1)) return 'stair';
  if (upper && s >= BRIDGE.s0 && s <= BRIDGE.s1 && t >= BRIDGE.t0 && t <= BRIDGE.t1) return 'bridge';
  if (s >= PLAT.s0 && s <= PLAT.s1 && t >= PLAT.p2[0] && t <= PLAT.p2[1]) return 'p2';
  if (s >= PLAT.s0 && s <= PLAT.s1 && t >= PLAT.p1[0] && t <= PLAT.p1[1]) return 'p1';
  return null;
}
/** the two colliders of the platforms' place: lower (platforms + the stairs' sides) and upper (footbridge + stairs) */
export function colliders(Collider) {
  const lo = new Collider(), up = new Collider();
  const seg = (C, s0, t0, s1, t1) => { const a = L(s0, t0), b = L(s1, t1); C.addSegment(a[0], a[1], b[0], b[1]); };
  const rect = (C, s0, s1, t0, t1, open = null) => { seg(C, s0, t0, s1, t0); seg(C, s1, t1, s0, t1); if (open !== 's1') seg(C, s1, t0, s1, t1); if (open !== 's0') seg(C, s0, t1, s0, t0); };
  rect(lo, PLAT.s0, PLAT.s1, PLAT.p2[0], PLAT.p2[1]); rect(lo, PLAT.s0, PLAT.s1, PLAT.p1[0], PLAT.p1[1]);
  // the stairs' sides and their top (on the lower level you can only walk up from the foot)
  for (const st of STAIRS) { for (const C of [lo, up]) { seg(C, st.s0, st.t0, st.s1, st.t0); seg(C, st.s0, st.t1, st.s1, st.t1); } seg(lo, st.s0, st.t0, st.s0, st.t1); }
  // upper: the footbridge deck, open where the stairs come up, the stairs' feet open onto the platforms
  seg(up, BRIDGE.s0, BRIDGE.t0, BRIDGE.s0, BRIDGE.t1); seg(up, BRIDGE.s0, BRIDGE.t1, BRIDGE.s1, BRIDGE.t1); seg(up, BRIDGE.s1, BRIDGE.t0, BRIDGE.s0, BRIDGE.t0);
  let tPrev = BRIDGE.t0; for (const st of STAIRS) { if (st.t0 > tPrev + 0.01) seg(up, BRIDGE.s1, tPrev, BRIDGE.s1, st.t0); tPrev = st.t1; } if (BRIDGE.t1 > tPrev + 0.01) seg(up, BRIDGE.s1, tPrev, BRIDGE.s1, BRIDGE.t1);
  for (const C of [lo, up]) { const xs = [], zs = []; for (const s of [PLAT.s0, PLAT.s1]) for (const t of [PLAT.p2[0], PLAT.p1[1]]) { const p = L(s, t); xs.push(p[0]); zs.push(p[1]); } C.bounds = { minX: Math.min(...xs) - 1, maxX: Math.max(...xs) + 1, minZ: Math.min(...zs) - 1, maxZ: Math.max(...zs) + 1 }; }
  return { lo, up };
}

// ------------------------------------------------------------------------------------------------ geometry
/** build everything static: {near, far, bikes (near only), signs: [{name, s, t, y0, y1, w, face}]} */
export function build(P) {
  const ensure = (key, base, o) => { if (!P.cells.has(key)) P.cells.set(key, { ...P.cells.get(base), ...o }); };
  ensure('cwTarmacP', 'cwGreen', { tint: [0.3, 0.3, 0.3] }); ensure('cwBeam', 'cwGreen', { tint: [0.05, 0.09, 0.07] });
  ensure('cwBlister', 'flags', { rx: 1 / 0.42, ry: 1 / 0.42, tint: [0.86, 0.7, 0.44] });
  ensure('cwCoping', 'flags', { rx: 1 / 2.4, ry: 1 / 2.4, tint: [0.95, 0.93, 0.88] });
  ensure('cwLamp', 'white', { tint: [2.6, 2.55, 2.35] });
  ensure('cwCanopySoffit', 'boards', { rx: 1 / 1.2, ry: 1 / 1.2, tint: [1.0, 1.02, 1.04] });
  ensure('cwBrickBlue', 'cwBrick', { tint: [0.2, 0.19, 0.22] });
  ensure('cwStone', 'stone', { tint: [0.95, 0.92, 0.86] });
  const B = new RB(), F = new RB(), Bk = new RB(), Bp = new RB();
  // work in the station frame: local x = t (east), local z = s (south)
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(N[0], 0, N[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(U[0], 0, U[1])).setPosition(O[0], 0, O[1]);
  B.push(M); F.push(M); Bk.push(M); Bp.push(M);
  const Y = PLAT.y;
  // ---- the track bed: ballast, sleepers, rails, from the covered way to the south end
  const sA = TUNNEL[0] - 6, sB = 128;
  B.poly('cwBallast', [[-10.2, 0.04, sA], [9.0, 0.04, sA], [9.0, 0.04, sB], [-10.2, 0.04, sB]], [0, 1, 0]);
  F.poly('cwBallast', [[-10.2, 0.04, sA], [9.0, 0.04, sA], [9.0, 0.04, sB], [-10.2, 0.04, sB]], [0, 1, 0]);
  for (const tc of TRACKS) {
    for (let s = sA + 0.4; s < sB; s += 0.75) B.poly('cwSleeper', [[tc - 1.3, 0.1, s - 0.13], [tc + 1.3, 0.1, s - 0.13], [tc + 1.3, 0.1, s + 0.13], [tc - 1.3, 0.1, s + 0.13]], [0, 1, 0]);
    for (const rx of [-0.72, 0.72]) {
      const x = tc + rx;
      for (let s = sA; s < sB; s += 24) { const e = Math.min(sB, s + 24); B.poly('cwRailTop', [[x - 0.035, 0.27, s], [x + 0.035, 0.27, s], [x + 0.035, 0.27, e], [x - 0.035, 0.27, e]], [0, 1, 0]); for (const sx of [-1, 1]) B.poly('cwRail', [[x + sx * 0.035, 0.1, s], [x + sx * 0.035, 0.1, e], [x + sx * 0.035, 0.27, e], [x + sx * 0.035, 0.27, s]], [sx, 0, 0]); }
    }
  }
  // ---- the platforms: faces to the tracks, coping with a white edge and a yellow line, ramps at the ends
  const platform = (t0, t1, edgeT, side) => {
    const s0 = PLAT.s0, s1 = PLAT.s1;
    // the surface: tarmac (a grid, so its colour can be patched and worn), set back from the edge strips
    const tIn = edgeT - side * 1.5, ta = Math.min(tIn, edgeT === t0 ? t1 : t0), tb = Math.max(tIn, edgeT === t0 ? t1 : t0), ns = Math.ceil((s1 - s0) / 4), nt = Math.max(2, Math.round((tb - ta) / 2.5));
    for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) { const sa = s0 + ((s1 - s0) * i) / ns, sb = s0 + ((s1 - s0) * (i + 1)) / ns, tA = ta + ((tb - ta) * j) / nt, tB = ta + ((tb - ta) * (j + 1)) / nt; Bp.poly('cwTarmacP', [[tA, Y, sa], [tB, Y, sa], [tB, Y, sb], [tA, Y, sb]], [0, 1, 0]); }
    F.poly('cwTarmacP', [[t0, Y, s0], [t1, Y, s0], [t1, Y, s1], [t0, Y, s1]], [0, 1, 0]);
    B.poly('cwConcrete', [[edgeT, 0, s0], [edgeT, 0, s1], [edgeT, Y, s1], [edgeT, Y, s0]], [side, 0, 0]);
    F.poly('cwConcrete', [[edgeT, 0, s0], [edgeT, 0, s1], [edgeT, Y, s1], [edgeT, Y, s0]], [side, 0, 0]);
    const back = edgeT === t0 ? t1 : t0;
    B.poly('cwConcrete', [[back, 0, s0], [back, 0, s1], [back, Y, s1], [back, Y, s0]], [-side, 0, 0]);
    // from the edge back: the coping stones (pale, with a lip over the track), the buff blister strip, tarmac, the
    // yellow line, tarmac
    const strip = (a, b, key, y = Y) => { const lo = Math.min(edgeT - side * a, edgeT - side * b), hi = Math.max(edgeT - side * a, edgeT - side * b); B.poly(key, [[lo, y, s0], [hi, y, s0], [hi, y, s1], [lo, y, s1]], [0, 1, 0]); };
    strip(0, 0.45, 'cwCoping', Y + 0.012); strip(0.45, 0.85, 'cwBlister', Y + 0.012); strip(0.85, 1.5, 'cwTarmacP'); strip(1.12, 1.22, 'cwYellow', Y + 0.012);
    B.poly('cwCoping', [[edgeT + side * 0.05, Y - 0.12, s0], [edgeT + side * 0.05, Y - 0.12, s1], [edgeT + side * 0.05, Y + 0.012, s1], [edgeT + side * 0.05, Y + 0.012, s0]], [side, 0, 0]);
    B.poly('cwShade', [[edgeT, 0.15, s0], [edgeT, 0.15, s1], [edgeT + side * 0.05, Y - 0.12, s1], [edgeT + side * 0.05, Y - 0.12, s0]], [side, -1, 0]);
    for (const [se, dir] of [[s0, -1], [s1, 1]]) { B.poly('cwTarmacP', [[t0, Y, se], [t1, Y, se], [t1, 0.05, se + dir * 8], [t0, 0.05, se + dir * 8]], [0, 1, dir * 0.12]); B.poly('cwConcrete', [[edgeT, 0, se], [edgeT, 0, se + dir * 8], [edgeT, Y, se]], [side, 0, 0]); }
  };
  platform(PLAT.p2[0], PLAT.p2[1], PLAT.p2[1], 1);
  platform(PLAT.p1[0], PLAT.p1[1], PLAT.p1[0], -1);
  // ---- platform 2's buildings (waiting room, offices) and its canopy
  {
    const tb0 = -22.3, tb1 = -18.2, s0 = -2, s1 = 62, h = Y + 3.4;
    for (const [a, b, n] of [[[tb1, s0], [tb1, s1], [1, 0]], [[tb0, s1], [tb0, s0], [-1, 0]], [[tb0, s0], [tb1, s0], [0, -1]], [[tb1, s1], [tb0, s1], [0, 1]]]) {
      B.poly('cwBrick', [[a[0], Y, a[1]], [b[0], Y, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]], [n[0], 0, n[1]]);
      F.poly('cwBrick', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]], [n[0], 0, n[1]]);
    }
    for (let s = s0 + 3; s < s1 - 2; s += 5.5) { B.push(frame(tb1 + 0.01, 0, s, 0, -1)); B.unit(hash(s, 1) < 0.3 ? 'doorDark' : 'sashDark', [[-1.0, Y + 0.05], [1.0, Y + 0.05], [1.0, Y + 2.5], [-1.0, Y + 2.5]], 0.02, [Math.round(s), 0]); B.pop(); }
    canopy(B, F, -21.5, -11.2, -40, -0.8, Y + 3.9, -20.5); canopy(B, F, -21.5, -11.2, 13.6, 80, Y + 3.9, -20.5);   // open over the stairs
  }
  // ---- platform 1's canopy (from the building)
  canopy(B, F, 9.0, BLD.t0, -30, -0.8, Y + 4.1, BLD.t0 - 0.4); canopy(B, F, 9.0, BLD.t0, 13.6, 92, Y + 4.1, BLD.t0 - 0.4);
  // ---- the footbridge: a glazed box on steel legs, stairs down to each platform
  {
    const { s0, s1, y, t0, t1 } = BRIDGE, wy = y + 2.6;
    B.poly('cwConcrete', [[t0, y, s0], [t1, y, s0], [t1, y, s1], [t0, y, s1]], [0, 1, 0]);
    B.poly('cwSteel', [[t0, y - 0.6, s0], [t1, y - 0.6, s0], [t1, y - 0.6, s1], [t0, y - 0.6, s1]], [0, -1, 0]);
    for (const [ss, dir] of [[s0, -1], [s1, 1]]) {
      B.poly('cwSteel', [[t0, y - 0.6, ss], [t1, y - 0.6, ss], [t1, y + 0.9, ss], [t0, y + 0.9, ss]], [0, 0, dir]);
      B.poly('cwGlass', [[t0, y + 0.9, ss], [t1, y + 0.9, ss], [t1, wy, ss], [t0, wy, ss]], [0, 0, dir]);
      for (let k = 0; k <= 10; k++) { const t = t0 + (k / 10) * (t1 - t0); B.box('cwSteelLt', t, y + 1.75, ss, 0.08, 1.7, 0.08); }
      F.poly('cwSteel', [[t0, y - 0.6, ss], [t1, y - 0.6, ss], [t1, wy, ss], [t0, wy, ss]], [0, 0, dir]);
    }
    B.poly('cwSteelLt', [[t0 - 0.2, wy + 0.4, s0 - 0.3], [t1 + 0.2, wy + 0.4, s0 - 0.3], [t1 + 0.2, wy + 0.4, s1 + 0.3], [t0 - 0.2, wy + 0.4, s1 + 0.3]], [0, 1, 0]);
    B.poly('cwSteel', [[t0 - 0.2, wy, s0 - 0.3], [t1 + 0.2, wy, s0 - 0.3], [t1 + 0.2, wy + 0.4, s0 - 0.3], [t0 - 0.2, wy + 0.4, s0 - 0.3]], [0, 0, -1]);
    B.poly('cwSteel', [[t0 - 0.2, wy + 0.4, s1 + 0.3], [t1 + 0.2, wy + 0.4, s1 + 0.3], [t1 + 0.2, wy, s1 + 0.3], [t0 - 0.2, wy, s1 + 0.3]], [0, 0, 1]);
    F.poly('cwSteelLt', [[t0, wy + 0.4, s0], [t1, wy + 0.4, s0], [t1, wy + 0.4, s1], [t0, wy + 0.4, s1]], [0, 1, 0]);
    for (const t of [t0 + 0.3, -1.0, 4.2, t1 - 0.3]) for (const s of [s0 + 0.3, s1 - 0.3]) B.box('cwSteel', t, (y - 0.6) / 2 + (Math.abs(t) > 9 ? Y / 2 : 0), s, 0.3, y - 0.6 - (Math.abs(t) > 9 ? Y : 0), 0.3);
    for (const st of STAIRS) {
      const n = 20, ds = (st.s1 - st.s0) / n, dy = (y - Y) / n;
      for (let k = 0; k < n; k++) { const sa = st.s0 + k * ds, ya = y - k * dy; B.poly('cwConcrete', [[st.t0, ya, sa], [st.t1, ya, sa], [st.t1, ya, sa + ds], [st.t0, ya, sa + ds]], [0, 1, 0]); B.poly('cwEdge', [[st.t0, ya - dy, sa + ds], [st.t1, ya - dy, sa + ds], [st.t1, ya, sa + ds], [st.t0, ya, sa + ds]], [0, 0, 1]); }
      for (const tt of [st.t0, st.t1]) {
        const out = tt === st.t0 ? -1 : 1;
        B.poly('cwSteel', [[tt, y - 0.6, st.s0], [tt, Y, st.s1], [tt, Y + 1.0, st.s1], [tt, y + 1.0, st.s0]], [out, 0, 0]);
        B.poly('cwSteel', [[tt, y + 1.0, st.s0], [tt, Y + 1.0, st.s1], [tt, Y, st.s1], [tt, y - 0.6, st.s0]], [-out, 0, 0]);
        B.poly('cwGlass', [[tt, y + 1.0, st.s0], [tt, Y + 1.0, st.s1], [tt, Y + 2.6, st.s1], [tt, y + 2.6, st.s0]], [out, 0, 0]);
        F.poly('cwSteel', [[tt, y - 0.6, st.s0], [tt, Y, st.s1], [tt, Y + 2.6, st.s1], [tt, y + 2.6, st.s0]], [out, 0, 0]);
      }
      B.poly('cwSteelLt', [[st.t0 - 0.15, y + 3.0, st.s0], [st.t1 + 0.15, y + 3.0, st.s0], [st.t1 + 0.15, Y + 3.0, st.s1], [st.t0 - 0.15, Y + 3.0, st.s1]], [0, 1, 0.5]);
      B.poly('cwSteel', [[st.t0, y - 0.6, st.s0], [st.t1, y - 0.6, st.s0], [st.t1, Y, st.s1], [st.t0, Y, st.s1]], [0, -1, -0.5]);
    }
  }
  // ---- the 1990 building: brick plinth and piers, a glazed front to the forecourt, a pitched glazed roof over the hall
  {
    const { t0, t1, s0, s1, h, ridge } = BLD;
    const wallQ = (a, b, n, y0, y1, key) => B.poly(key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [n[0], 0, n[1]]);
    // the east front: piers every 6 m, glass between, the entrance in the middle under a canopy
    for (let s = s0; s < s1 - 0.1; s += 6) {
      const e = Math.min(s1, s + 6), mid = (s + e) / 2;
      wallQ([t1, s], [t1, s + 0.8], [1, 0], 0, h, 'cwBrick');
      wallQ([t1, s + 0.8], [t1, e], [1, 0], 0, 1.0, 'cwBrick');
      const door = Math.abs(mid - ENTRANCE_S) < 6;
      B.poly(door ? 'cwGlassLit' : 'cwGlass', [[t1 + 0.05, door ? 0.02 : 1.0, s + 0.8], [t1 + 0.05, door ? 0.02 : 1.0, e], [t1 + 0.05, h - 0.6, e], [t1 + 0.05, h - 0.6, s + 0.8]], [1, 0, 0]);
      for (const k of [0.33, 0.66]) B.box('cwSteel', t1 + 0.08, (h - 0.6) / 2, s + 0.8 + (e - s - 0.8) * k, 0.08, h - 0.6, 0.08);
      B.box('cwSteel', t1 + 0.08, 2.6, (s + 0.8 + e) / 2, 0.08, 0.08, e - s - 0.8);
      wallQ([t1, s + 0.8], [t1, e], [1, 0], h - 0.6, h, 'cwSteel');
    }
    F.poly('cwGlass', [[t1, 0, s0], [t1, 0, s1], [t1, h, s1], [t1, h, s0]], [1, 0, 0]);
    // the platform side (west) and the ends: brick with doors onto platform 1
    for (let s = s0; s < s1 - 0.1; s += 6) { const e = Math.min(s1, s + 6); wallQ([t0, e], [t0, s], [-1, 0], Y, h, 'cwBrick'); B.push(frame(t0 - 0.02, 0, (s + e) / 2, 0, 1)); B.unit(hash(s, 9) < 0.5 ? 'doorDark' : 'sashDark', [[-1.6, Y + 0.02], [1.6, Y + 0.02], [1.6, Y + 2.8], [-1.6, Y + 2.8]], 0.02, [s, 0], true); B.pop(); }
    wallQ([t0, s0], [t1, s0], [0, -1], 0, h, 'cwBrick'); wallQ([t1, s1], [t0, s1], [0, 1], 0, h, 'cwBrick');
    F.poly('cwBrick', [[t0, 0, s0], [t1, 0, s0], [t1, h, s0], [t0, h, s0]], [0, 0, -1]); F.poly('cwBrick', [[t1, 0, s1], [t0, 0, s1], [t0, h, s1], [t1, h, s1]], [0, 0, 1]);
    // roof: six pitched bays across the building, each with a gable to the forecourt (a glazed triangle in a brick
    // frame) and one to the platform, glazing on steel purlins, lead-grey valleys between them (GUESS: the 1990 hall's
    // roof broken into bays so it reads as a station front, not a shed)
    const nb = 6, bw = (s1 - s0) / nb, R = ridge + 0.8;
    for (let k = 0; k < nb; k++) {
      const sa = s0 + k * bw, sb = sa + bw, sm = (sa + sb) / 2;
      for (const [se, sgn] of [[sa, -1], [sb, 1]]) {
        B.poly('cwGlassRoof', [[t0, h, se], [t1, h, se], [t1, R, sm], [t0, R, sm]], [0, 1, sgn * 0.6]);
        F.poly('cwSteelLt', [[t0, h, se], [t1, h, se], [t1, R, sm], [t0, R, sm]], [0, 1, sgn * 0.6]);
        for (let q = 1; q < 4; q++) { const f = q / 4, ss = se + (sm - se) * f, yy = h + (R - h) * f; B.box('cwSteel', (t0 + t1) / 2, yy + 0.04, ss, t1 - t0, 0.08, 0.1, 0, { bottom: false }); }
      }
      B.box('radLead', (t0 + t1) / 2, R + 0.08, sm, t1 - t0 + 0.3, 0.16, 0.3);
      // gables: the forecourt one glazed in a brick frame with a stone coping, the platform one brick
      for (const [tg, n] of [[t1, 1], [t0, -1]]) {
        const front = n > 0, inset = 0.9;
        if (front) {
          B.poly('cwGlass', [[tg + 0.04, h, sa + inset], [tg + 0.04, h, sb - inset], [tg + 0.04, R - 0.7, sm]], [1, 0, 0]);
          B.poly('cwBrick', [[tg, h, sa], [tg, h, sa + inset], [tg, R - 0.7, sm], [tg, R, sm]], [1, 0, 0]);
          B.poly('cwBrick', [[tg, h, sb - inset], [tg, h, sb], [tg, R, sm], [tg, R - 0.7, sm]], [1, 0, 0]);
          for (let q = 1; q < 4; q++) { const ss = sa + inset + (q / 4) * (sb - sa - 2 * inset), ytop = h + (R - 0.7 - h) * (1 - Math.abs(ss - sm) / (sm - sa - inset)); B.box('cwSteel', tg + 0.07, (h + ytop) / 2, ss, 0.06, ytop - h, 0.06); }
        } else B.poly('cwBrick', [[tg, h, sb], [tg, h, sa], [tg, R, sm]], [-1, 0, 0]);
        F.poly('cwBrick', [[tg, h, front ? sa : sb], [tg, h, front ? sb : sa], [tg, R, sm]], [n, 0, 0]);
        for (const [a, b] of [[sa, sm], [sm, sb]]) { const ya = a === sa ? h : R, yb = b === sb ? h : R; B.beam('cwStone', [tg + n * 0.05, ya + 0.12, a], [tg + n * 0.05, yb + 0.12, b], 0.24, 0.16); }
      }
    }
    // the front's brick: a blue-brick plinth, a stone band at the canopy line, a parapet coping along the eaves
    B.box('cwBrickBlue', t1 + 0.02, 0.5, (s0 + s1) / 2, 0.06, 1.0, s1 - s0, 0, { top: true });
    B.box('cwStone', t1 + 0.06, h - 0.62, (s0 + s1) / 2, 0.18, 0.14, s1 - s0, 0, { bottom: true });
    B.box('cwStone', t1 + 0.06, h + 0.06, (s0 + s1) / 2, 0.22, 0.12, s1 - s0, 0, { bottom: true });
    // the entrance canopy over the forecourt doors, the barriers inside the glass
    B.box('cwSteelLt', t1 + 2.5, h - 1.2, ENTRANCE_S, 5.2, 0.3, 11);
    for (const s of [ENTRANCE_S - 5, ENTRANCE_S + 5]) B.cyl('cwSteel', t1 + 4.6, 0, s, 0.12, h - 1.3, 6, false);
    for (let k = 0; k < 7; k++) { const s = ENTRANCE_S - 4.5 + k * 1.5; B.box('cwSteel', t1 - 5.5, 0.55, s, 1.4, 1.1, 0.3); B.box('cwYellow', t1 - 5.5, 1.12, s, 1.3, 0.04, 0.25); B.box('cwGlass', t1 - 5.5, 0.9, s + 0.55, 0.05, 0.6, 0.55); }
    // inside the hall: a floor, the back wall, a departures board
    B.poly('cwCoping', [[t0 + 0.2, 0.03, s0 + 0.2], [t1 - 0.1, 0.03, s0 + 0.2], [t1 - 0.1, 0.03, s1 - 0.2], [t0 + 0.2, 0.03, s1 - 0.2]], [0, 1, 0]);
    B.poly('cwCream', [[t0 + 6, 0, s1 - 0.3], [t0 + 6, 0, s0 + 0.3], [t0 + 6, h, s0 + 0.3], [t0 + 6, h, s1 - 0.3]], [1, 0, 0]);
  }
  // ---- the forecourt: a taxi rank shelter post, the cycle racks (two tiers, a light canopy), hundreds of bikes
  {
    const racks = [[22, 98, 120, 0], [26.5, 98, 120, 1], [31, 98, 120, 2], [35.5, 98, 120, 3], [37.5, 70, 88, 4]];
    let nb = 0;
    for (const [t, sA0, sA1, r] of racks) {
      // the rack: a steel spine with a canopy over the double row
      B.box('cwSteel', t, 0.45, (sA0 + sA1) / 2, 0.08, 0.9, sA1 - sA0);
      B.box('cwSteelLt', t, 2.6, (sA0 + sA1) / 2, 0.08, 0.08, sA1 - sA0);
      if (r < 4) { B.poly('cwSteelLt', [[t - 2.1, 2.9, sA0], [t + 2.1, 2.9, sA0], [t + 2.1, 2.9, sA1], [t - 2.1, 2.9, sA1]], [0, 1, 0]); F.poly('cwSteelLt', [[t - 2.1, 2.9, sA0], [t + 2.1, 2.9, sA0], [t + 2.1, 2.9, sA1], [t - 2.1, 2.9, sA1]], [0, 1, 0]); for (let s = sA0; s <= sA1; s += 7) B.cyl('cwSteel', t, 0, s, 0.06, 2.9, 5, false); }
      for (let s = sA0 + 0.4; s < sA1; s += 0.62) for (const side of [-1, 1]) {
        const k = Math.floor(hash(s * 3.1, t, side) * 100);
        if (k < 12) continue;                         // the odd gap
        bike(Bk, t + side * 1.0, s, side, 'cwBike' + (k % BIKE_KEYS), k);
        nb++;
        if (r < 2 && k % 4 === 1) { bike(Bk, t + side * 1.1, s + 0.25, side, 'cwBike' + ((k >> 2) % BIKE_KEYS), k + 1, 1.35); nb++; }   // the top tier
      }
    }
    build.bikes = nb;
  }
  // ---- the covered way where the line comes in from the north (stylised): walls and a roof over the four roads
  {
    const [s0, s1] = TUNNEL, t0 = -11, t1 = 9.6, h = 6.5;
    for (const [t, n] of [[t0, 1], [t1, -1]]) { B.poly('cwBrickDk', [[t, 0, s0], [t, 0, s1], [t, h, s1], [t, h, s0]], [n, 0, 0]); B.poly('cwBrick', [[t - n * 0.6, 0, s0], [t - n * 0.6, 0, s1], [t - n * 0.6, h, s1], [t - n * 0.6, h, s0]], [-n, 0, 0]); F.poly('cwBrick', [[t - n * 0.6, 0, s0], [t - n * 0.6, 0, s1], [t - n * 0.6, h, s1], [t - n * 0.6, h, s0]], [-n, 0, 0]); }
    B.poly('cwShade', [[t0, h, s0], [t1, h, s0], [t1, h, s1], [t0, h, s1]], [0, -1, 0]);
    B.poly('cwConcrete', [[t0 - 0.6, h + 0.6, s0], [t1 + 0.6, h + 0.6, s0], [t1 + 0.6, h + 0.6, s1], [t0 - 0.6, h + 0.6, s1]], [0, 1, 0]);
    F.poly('cwConcrete', [[t0 - 0.6, h + 0.6, s0], [t1 + 0.6, h + 0.6, s0], [t1 + 0.6, h + 0.6, s1], [t0 - 0.6, h + 0.6, s1]], [0, 1, 0]);
    // the mouth: a parapet face with a dark arch of shadow inside it, and the north end closed in black
    B.poly('cwBrick', [[t0 - 0.6, h - 1.0, s1], [t1 + 0.6, h - 1.0, s1], [t1 + 0.6, h + 0.6, s1], [t0 - 0.6, h + 0.6, s1]], [0, 0, 1]);
    B.poly('cwShade', [[t0, 0.05, s0 + 1], [t1, 0.05, s0 + 1], [t1, h, s0 + 1], [t0, h, s0 + 1]], [0, 0, 1]);
    B.poly('cwShade', [[t0, 0.06, s0], [t1, 0.06, s0], [t1, 0.06, s1], [t0, 0.06, s1]], [0, 1, 0]);
    B.poly('cwBrick', [[t1 + 0.6, h + 0.6, s0], [t0 - 0.6, h + 0.6, s0], [t0 - 0.6, 0, s0], [t1 + 0.6, 0, s0]], [0, 0, -1]);
  }
  // ---- the palisade round the railway (green steel pales on the platforms' backs and across the ends)
  {
    const fence = (s0, t0, s1, t1, y0) => {
      const L = Math.hypot(s1 - s0, t1 - t0), n = Math.max(1, Math.round(L / 2.6));
      for (let k = 0; k <= n; k++) { const s = s0 + (s1 - s0) * k / n, t = t0 + (t1 - t0) * k / n; B.box('cwGreen', t, y0 + 1.0, s, 0.09, 2.0, 0.09); }
      for (const y of [y0 + 0.25, y0 + 1.7]) B.beam('cwGreen', [t0, y, s0], [t1, y, s1], 0.05);
      // the pales: one quad each way per bay, painted as a run of bars by the boards cell would be too fine; plain bars
      for (let k = 0; k < n * 4; k++) { const f = (k + 0.5) / (n * 4), s = s0 + (s1 - s0) * f, t = t0 + (t1 - t0) * f; B.box('cwGreen', t, y0 + 1.05, s, 0.03, 1.9, 0.03, 0, { top: false }); }
    };
    fence(PLAT.s0 - 9, PLAT.p2[0], PLAT.s1 + 9, PLAT.p2[0], 0);
    fence(PLAT.s0 - 9, PLAT.p1[1], BLD.s0, PLAT.p1[1], 0); fence(BLD.s1, PLAT.p1[1], PLAT.s1 + 9, PLAT.p1[1], 0);
    fence(120, PLAT.p2[0], 120, PLAT.p1[1], 0);
  }
  B.pop(); F.pop(); Bk.pop(); Bp.pop();
  // the platforms' tarmac: patched and darker where people stand, by a value noise over the grid
  const tarmac = tintGeo(geoOf(Bp, P), (x, y, z, t) => { const n = vnoise(x, z, 7, 3), m = vnoise(x, z, 1.8, 8), k = 0.78 + 0.4 * n + 0.14 * m; return [t[0] * k * 1.03, t[1] * k, t[2] * k * 0.95]; });
  return { near: mergeGeos([geoOf(B, P), tarmac]), far: geoOf(F, P), bikes: geoOf(Bk, P) };
}

/** a platform canopy: a flat roof on steel columns with knee braces, a ribbed soffit carried on cross beams, a deep
 *  valance on the track side, strip lights, timber benches between the columns */
function canopy(B, F, t0, t1, s0, s1, y, colT) {
  B.poly('cwSteelLt', [[t0, y + 0.35, s0], [t1, y + 0.35, s0], [t1, y + 0.35, s1], [t0, y + 0.35, s1]], [0, 1, 0]);
  B.poly('cwCanopySoffit', [[t0, y, s0], [t1, y, s0], [t1, y, s1], [t0, y, s1]], [0, -1, 0]);
  F.poly('cwSteelLt', [[t0, y + 0.35, s0], [t1, y + 0.35, s0], [t1, y + 0.35, s1], [t0, y + 0.35, s1]], [0, 1, 0]);
  const trackSide = Math.abs(t1) < Math.abs(t0) ? t1 : t0;          // the edge nearer the tracks (t = 0)
  for (const [t, n] of [[t0, -1], [t1, 1]]) { const deep = t === trackSide ? 0.75 : 0.4; B.poly('cwGreen', [[t, y - deep, s0], [t, y - deep, s1], [t, y + 0.35, s1], [t, y + 0.35, s0]], [n, 0, 0]); B.poly('cwGreen', [[t - n * 0.05, y + 0.35, s1], [t - n * 0.05, y + 0.35, s0], [t - n * 0.05, y - deep, s0], [t - n * 0.05, y - deep, s1]], [-n, 0, 0]); B.box('cwWhite', t + n * 0.02, y - deep + 0.04, (s0 + s1) / 2, 0.03, 0.06, s1 - s0); }
  for (const [s, n] of [[s0, -1], [s1, 1]]) B.poly('cwGreen', [[t0, y - 0.45, s], [t1, y - 0.45, s], [t1, y + 0.35, s], [t0, y + 0.35, s]], [0, 0, n]);
  // cross beams every 4 m and a spine beam over the columns
  for (let s = s0 + 2; s < s1; s += 4) B.box('cwBeam', (t0 + t1) / 2, y - 0.14, s, Math.abs(t1 - t0) - 0.1, 0.28, 0.14, 0, { top: false, bottom: true });
  B.box('cwGreen', colT, y - 0.22, (s0 + s1) / 2, 0.3, 0.44, s1 - s0, 0, { top: false, bottom: true });
  // strip lights in two lines
  for (const tl of [(colT + t0) / 2 + 0.6, (colT + t1) / 2 - 0.6]) for (let s = s0 + 4; s < s1 - 2; s += 6) { B.box('cwSteelLt', tl, y - 0.08, s, 0.22, 0.1, 1.5, 0, { top: false, bottom: false }); B.poly('cwLamp', [[tl - 0.08, y - 0.135, s - 0.7], [tl + 0.08, y - 0.135, s - 0.7], [tl + 0.08, y - 0.135, s + 0.7], [tl - 0.08, y - 0.135, s + 0.7]], [0, -1, 0]); }
  // columns with knee braces up to the cross beams; benches between them
  for (let s = s0 + 4; s < s1; s += 8) {
    B.cyl('cwGreen', colT, PLAT.y, s, 0.12, y - PLAT.y, 6, false);
    B.box('cwGreen', colT, PLAT.y + 0.15, s, 0.38, 0.3, 0.38);
    for (const d of [-1, 1]) B.beam('cwGreen', [colT, y - 1.1, s], [colT + d * 1.4, y - 0.2, s], 0.08);
    if (Math.round(s) % 16 === 12) B.box('cwBlack', colT, y - 0.75, s, 0.1, 0.45, 1.6);
    else if (s + 4 < s1) {
      const bs = s + 4, bt = colT;
      for (const sx of [-0.7, 0.7]) B.box('cwSteel', bt, PLAT.y + 0.22, bs + sx, 0.5, 0.44, 0.06);
      for (let k = 0; k < 4; k++) B.box('cwTimber', bt - 0.18 + k * 0.12, PLAT.y + 0.46, bs, 0.09, 0.04, 1.8);
      for (let k = 0; k < 3; k++) B.box('cwTimber', bt + 0.28, PLAT.y + 0.62 + k * 0.12, bs, 0.04, 0.08, 1.8);
    }
  }
}

/** a parked bike leaning in a rack at (t, s) in the station frame, front wheel towards +t*side; tier lifts it (~50 triangles) */
function bike(B, t, s, side, key, seed, tier = 0) {
  const y0 = tier, wr = 0.33, wb = 1.05, x0 = t - side * wb / 2, x1 = t + side * wb / 2, yc = y0 + wr;
  const lean = (hash(seed, 2) - 0.5) * 0.06, at = (x, y) => [x, y, s + lean * (y - y0)];
  for (const xc of [x0, x1]) for (let k = 0; k < 6; k++) {
    const a0 = (k / 6) * TAU, a1 = ((k + 1) / 6) * TAU, q = [at(xc, yc), at(xc + Math.cos(a0) * wr, yc + Math.sin(a0) * wr), at(xc + Math.cos(a1) * wr, yc + Math.sin(a1) * wr)];
    B.poly(k % 2 ? 'cwTyre' : 'cwBlack', q, [0, 0, 1]); B.poly(k % 2 ? 'cwTyre' : 'cwBlack', q, [0, 0, -1]);
  }
  // the frame: two flat plates (both faces), a saddle-and-bar box
  const tube = (a, b, w) => { const q = [at(a[0], a[1] - w), at(b[0], b[1] - w), at(b[0], b[1] + w), at(a[0], a[1] + w)]; B.poly(key, q, [0, 0, 1]); B.poly(key, q, [0, 0, -1]); };
  tube([x0, yc], [t - side * 0.2, yc + 0.5], 0.03); tube([t - side * 0.2, yc + 0.5], [x1, yc + 0.02], 0.03);
  B.box('cwBlack', t - side * 0.1, yc + 0.6, s + lean * 0.9, 0.9, 0.05, 0.12);
}
