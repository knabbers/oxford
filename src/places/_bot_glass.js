// Oxford Botanic Garden — the glasshouses (showpiece; plain-but-correct for a later fine-detail pass) and the garden's
// set pieces: the range outside the east wall towards the Cherwell (on the line of Daubeny's houses of 1851; rebuilt 1893,
// 1949, 1970s), walked through, not separate interiors: the Palm House (largest), the Lily House with its tank and giant
// waterlily pads, the Arid House (cacti, agaves), the Insectivorous House, the Fernery and the Alpine House; the
// lean-to Conservatory at the east end of the north wall (1997 copy of an 1893 house). The central pond and fountain,
// Bobart's yew (1645), Tolkien's black pine (standing in 2013) and the bench by the river. Each house is drawn on its
// mapped footprint (OSM names are today's: Rainforest = Palm House, Carnivorous = Insectivorous, Cloud Forest =
// Fernery, Plants from High Places = Alpine House). docs/research/christ_church_botanic_magdalen.md §2.
//
//   build(ctx) -> { meshes, houses: [{key, name, c, door, rect}], colliders: segments/circles, plants: {key: [x, z]} }
import * as THREE from 'three';
import { Batch, prism, lathe, buildMeshes, hh, pointInPoly } from './_chch_kit.js';
import { buildFine, col, AIR_FAR } from './_se_fine.js';
import { F, IDS, WALL } from './_bot_map.js';
// from a glider (world.aerial) the garden's far mesh (~10k triangles, the glasshouses) out to 1.2 km, not AIR_FAR: a few pixels beyond
export const GARDEN_AIR = Math.min(AIR_FAR, 1200);

export const HOUSES = {
  palm: { name: 'Palm House', wallH: 4.6, ridge: 8.2 },
  lily: { name: 'Lily House', wallH: 3.2, ridge: 5.0 },
  arid: { name: 'Arid House', wallH: 3.0, ridge: 4.8 },
  insectivorous: { name: 'Insectivorous House', wallH: 2.6, ridge: 3.8 },
  fernery: { name: 'Fernery', wallH: 2.6, ridge: 3.9 },
  alpine: { name: 'Alpine House', wallH: 2.4, ridge: 3.4 },
};
export const DOOR_W = 1.7;
export const POND = [848.6, 445.4];
export const YEW = F.toW(-20, 99.0);
export const PINE = [872.5, 531.5], BENCH = [876.4, 535.4];

/** oriented rectangle of a footprint: {c:[x,z], ax:[dx,dz] (long side), L, W} */
export function orientedRect(poly) {
  let best = 0, ax = [1, 0];
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > best) { best = l; ax = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; } }
  const ay = [-ax[1], ax[0]];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, z] of poly) { const u = x * ax[0] + z * ax[1], v = x * ay[0] + z * ay[1]; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  return { c: [cu * ax[0] + cv * ay[0], cu * ax[1] + cv * ay[1]], ax, L: u1 - u0, W: v1 - v0 };
}
/** a house rect's local -> world */
const R2W = (r, a, b) => [r.c[0] + r.ax[0] * a - r.ax[1] * b, r.c[1] + r.ax[1] * a + r.ax[0] * b];

/** the houses from the map: [{key, name, rect, door: {side ('+b'|'-b'|'+a'|'-a'), at, x, z, out:[x,z]}}] */
export function housePlan(map) {
  const out = [], polys = {};
  for (const [key, id] of Object.entries(IDS.glass)) { const b = map.buildings.find((q) => q.id === id); if (b) polys[key] = b.poly; }
  for (const [key, poly] of Object.entries(polys)) {
    if (key === 'conservatory') continue;
    const r = orientedRect(poly), H = HOUSES[key];
    // the door: in the middle of the side that faces the walled garden most (lowest garden u) and does not open into
    // a neighbouring house of the range
    const cands = [['+b', 0, r.W / 2, 1], ['-b', 0, -r.W / 2, 1], ['+a', r.L / 2, 0, 0], ['-a', -r.L / 2, 0, 0]].map(([s, a, b, long]) => {
      const sg = s[0] === '+' ? 1 : -1, o = s[1] === 'b' ? R2W(r, a, b + sg * 1.4) : R2W(r, a + sg * 1.4, b), [x, z] = R2W(r, a, b);
      const blocked = Object.entries(polys).some(([k, P]) => k !== key && pointInPoly(o[0], o[1], P));
      return { s, x, z, o, gu: F.toL(x, z)[0] - long * 0.5, blocked, len: s[1] === 'b' ? r.L : r.W };
    }).filter((c) => !c.blocked && c.len > DOOR_W + 0.8);
    cands.sort((p, q) => p.gu - q.gu);
    const d = cands[0];
    out.push({ key, name: H.name, rect: r, wallH: H.wallH, ridge: H.ridge, door: { side: d.s, x: d.x, z: d.z, out: d.o } });
  }
  return out;
}
/** the lean-to Conservatory against the inside of the north wall (u 30..52, v 0..7.5 of the garden frame) */
export const CONSERVATORY = { u0: 30, u1: 52, v0: 0.4, v1: 7.6, back: 4.4, front: 3.0 };

let LITE = false;
function construct(ctx, lite) {
  LITE = lite;
  const { map } = ctx, B = new Batch(), colliders = { segs: [], circles: [] }, plants = {};
  const houses = housePlan(map);
  for (const h of houses) {
    const r = h.rect, hl = r.L / 2, hw = r.W / 2;
    B.push(new (B.m.constructor)().makeBasis({ x: r.ax[0], y: 0, z: r.ax[1] }, { x: 0, y: 1, z: 0 }, { x: -r.ax[1], y: 0, z: r.ax[0] }).setPosition(r.c[0], 0, r.c[1]));
    const ds = h.door.side, doorB = ds === '+b' ? hw : ds === '-b' ? -hw : 0, doorA = ds === '+a' ? hl : ds === '-a' ? -hl : 0;
    // floor, dwarf wall, glass walls, frames, roof
    B.boxXZ(h.key === 'arid' ? 'sand' : 'paving', -hl, hl, 0, 0.06, -hw, hw);
    const walls = [[-hl, -hw, hl, -hw], [hl, -hw, hl, hw], [hl, hw, -hl, hw], [-hl, hw, -hl, -hw]];
    for (const [x0, z0, x1, z1] of walls) {
      const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L, isDoor = ds[1] === 'b' ? Math.abs(z0 - doorB) < 1e-6 && Math.abs(z1 - doorB) < 1e-6 : Math.abs(x0 - doorA) < 1e-6 && Math.abs(x1 - doorA) < 1e-6;
      const pieces = isDoor ? [[0, L / 2 - DOOR_W / 2], [L / 2 + DOOR_W / 2, L]] : [[0, L]];
      for (const [s0, s1] of pieces) {
        const a = [x0 + ux * s0, z0 + uz * s0], b = [x0 + ux * s1, z0 + uz * s1];
        B.poly('stone', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 0.6, b[1]], [a[0], 0.6, a[1]]], [uz, 0, -ux]);
        B.poly('glass', [[a[0], 0.6, a[1]], [b[0], 0.6, b[1]], [b[0], h.wallH, b[1]], [a[0], h.wallH, a[1]]], [uz, 0, -ux]);
        B.box('whiteFrame', (a[0] + b[0]) / 2, 0.64, (a[1] + b[1]) / 2, s1 - s0, 0.08, 0.12, Math.atan2(ux, uz) - Math.PI / 2);
        for (let s = s0; s <= s1 + 1e-6; s += Math.max(0.6, (s1 - s0) / Math.max(1, Math.round((s1 - s0) / 2.48)))) B.box('whiteFrame', x0 + ux * s, (0.6 + h.wallH) / 2, z0 + uz * s, 0.06, h.wallH - 0.6, 0.06, 0, { top: false });
        // world colliders
        const wa = R2W(r, a[0], a[1]), wb = R2W(r, b[0], b[1]); colliders.segs.push([wa[0], wa[1], wb[0], wb[1]]);
      }
      B.box('whiteFrame', (x0 + x1) / 2, h.wallH, (z0 + z1) / 2, L, 0.1, 0.12, Math.atan2(ux, uz) - Math.PI / 2);
    }
    if (ds[1] === 'b') { B.box('whiteFrame', 0, 2.3, doorB, DOOR_W + 0.1, 0.1, 0.1); for (const e of [-1, 1]) B.box('whiteFrame', e * DOOR_W / 2, 1.15, doorB, 0.08, 2.3, 0.1); }
    else { B.box('whiteFrame', doorA, 2.3, 0, 0.1, 0.1, DOOR_W + 0.1); for (const e of [-1, 1]) B.box('whiteFrame', doorA, 1.15, e * DOOR_W / 2, 0.1, 2.3, 0.08); }
    // pitched glass roof along the long axis, gable ends glazed, rafters
    const yR = h.ridge, yE = h.wallH;
    B.poly('glass', [[-hl, yE, -hw], [hl, yE, -hw], [hl, yR, 0], [-hl, yR, 0]], [0, 1, -1]);
    B.poly('glass', [[-hl, yE, hw], [-hl, yR, 0], [hl, yR, 0], [hl, yE, hw]], [0, 1, 1]);
    B.poly('glass', [[-hl, yE, -hw], [-hl, yR, 0], [-hl, yE, hw]], [-1, 0, 0]); B.poly('glass', [[hl, yE, -hw], [hl, yE, hw], [hl, yR, 0]], [1, 0, 0]);
    B.beam('whiteFrame', [-hl, yR, 0], [hl, yR, 0], 0.12, 0.12);
    for (let a = -hl; a <= hl + 1e-6; a += r.L / Math.max(2, Math.round(r.L / 2.48))) { B.beam('whiteFrame', [a, yE, -hw], [a, yR, 0], 0.05, 0.08); B.beam('whiteFrame', [a, yE, hw], [a, yR, 0], 0.05, 0.08); }
    for (const e of [-1, 1]) { lathe(B, 'whiteFrame', e * hl, 0, [[0.05, yR], [0.11, yR + 0.14], [0.04, yR + 0.3], [0.08, yR + 0.42], [0, yR + 0.72]], 5, 0); B.box('whiteFrame', e * hl, (yE + yR) / 2, 0, 0.05, yR - yE, 0.05, 0, { top: false }); }
    if (!lite) for (let k = 0; k < Math.floor(r.L / 0.62); k += 2) B.box('whiteFrame', -hl + (k + 0.5) * 0.62, yR + 0.12, 0, 0.3, 0.12, 0.02, 0, { top: false });   // ridge cresting
    // contents
    const P = (a, b) => R2W(r, a, b);
    if (h.key === 'palm') {
      for (let i = 0; i < 6; i++) { const a = -hl + 2.2 + ((r.L - 4.4) * i) / 5, b = (i % 2 ? 1 : -1) * (hw * 0.45), ht = 5.2 + hh(i, 3) * 2.2; palm(B, a, b, ht, i); const [x, z] = P(a, b); colliders.circles.push([x, z, 0.35]); }
      for (let i = 0; i < 10; i++) { const a = -hl + 1 + (r.L - 2) * hh(i, 11), b = (hh(i, 12) - 0.5) * (r.W - 2.4); if (Math.abs(b - (doorB > 0 ? hw - 1 : -hw + 1)) < 1.6 && Math.abs(a) < 2) continue; banana(B, a, b, 1.6 + hh(i, 13) * 1.4, i); }
      // planted beds either side of the central path: dark soil in a stone kerb, a thick understorey of ferns and aroids
      for (const sd of [-1, 1]) { const b0 = sd * 1.0, b1 = sd * (hw - 0.35); B.boxXZ('stoneDark', -hl + 0.5, hl - 3.4, 0.06, 0.24, Math.min(b0, b1), Math.max(b0, b1)); B.boxXZ('soil', -hl + 0.62, hl - 3.52, 0.2, 0.27, Math.min(b0, b1) + 0.12, Math.max(b0, b1) - 0.12);
        for (let i = 0; i < 16; i++) { const a = -hl + 1.0 + (r.L - 5.2) * hh(i, 71 + sd), b = sd * (1.3 + hh(i, 73 + sd) * (hw - 2.0)); if (ds[1] === 'b' && Math.sign(doorB) === sd && Math.abs(a) < 1.8) continue; if (i % 3 === 0) aroid(B, a, b, 0.7 + hh(i, 75) * 0.6, i); else fern(B, a, b, 0.6 + hh(i, 77) * 0.7, i * 1.7, 0.25); } }
      plants.amorphophallus = P(hl - 2.0, 0); titan(B, hl - 2.0, 0);
    } else if (h.key === 'lily') {
      const tl = r.L - 2.6, tw = r.W - 2.4;
      B.boxXZ('stone', -tl / 2 - 0.25, tl / 2 + 0.25, 0, 0.55, -tw / 2 - 0.25, tw / 2 + 0.25, { top: false });
      B.boxXZ('stone', -tl / 2 - 0.25, tl / 2 + 0.25, 0.5, 0.58, -tw / 2 - 0.25, -tw / 2); B.boxXZ('stone', -tl / 2 - 0.25, tl / 2 + 0.25, 0.5, 0.58, tw / 2, tw / 2 + 0.25);
      B.boxXZ('stone', -tl / 2 - 0.25, -tl / 2, 0.5, 0.58, -tw / 2, tw / 2); B.boxXZ('stone', tl / 2, tl / 2 + 0.25, 0.5, 0.58, -tw / 2, tw / 2);
      B.flat('pondWater', [[-tl / 2, -tw / 2], [tl / 2, -tw / 2], [tl / 2, tw / 2], [-tl / 2, tw / 2]], 0.42);
      for (let i = 0; i < 5; i++) { const a = -tl / 2 + 1.2 + ((tl - 2.4) * i) / 4, b = (i % 2 ? 0.6 : -0.6) * (tw / 2 - 1.2); giantPad(B, a, b, 0.75 + hh(i, 21) * 0.35, i); }
      for (let i = 0; i < 16; i++) { const a = (hh(i, 61) - 0.5) * (tl - 0.6), b = (hh(i, 62) - 0.5) * (tw - 0.6); smallPad(B, a, b, 0.14 + hh(i, 63) * 0.14, i); }
      for (const [ca, cb] of [[-tl / 2 - 0.9, -tw / 2 - 0.7], [tl / 2 + 0.9, tw / 2 + 0.7], [tl / 2 + 0.9, -tw / 2 - 0.7], [-tl / 2 - 0.9, tw / 2 + 0.7]]) if (Math.abs(ca) < hl - 0.4 && Math.abs(cb) < hw - 0.4) { fern(B, ca, cb, 0.9, ca + cb); banana(B, ca, cb, 1.5, ca); }
      plants.victoria = P(0, 0);
      const [x, z] = P(0, 0); colliders.box = colliders.box || []; colliders.box.push([x, z, tl + 0.5, tw + 0.5, Math.atan2(-r.ax[1], r.ax[0])]);
    } else if (h.key === 'arid') {
      for (let i = 0; i < 14; i++) { const a = -hl + 1 + (r.L - 2) * hh(i, 31), b = (hh(i, 32) - 0.5) * (r.W - 2.6); if (Math.abs(b - doorB * 0.8) < 1.4 && Math.abs(a) < 1.6) continue; if (i % 4 === 1) barrel(B, a, b, 0.25 + hh(i, 35) * 0.25, i); else if (i % 4 === 3) pear(B, a, b, 0.9 + hh(i, 36) * 0.5, i); else if (i % 4 === 2) cactus(B, a, b, 0.8 + hh(i, 33) * 2.0, i); else agave(B, a, b, 0.6 + hh(i, 34) * 0.5, i); }
      if (!lite) for (let i = 0; i < 10; i++) { const a = -hl + 0.8 + (r.L - 1.6) * hh(i, 37), b = (hh(i, 38) - 0.5) * (r.W - 1.4); prism(B, 'rock', a, b, 0.12 + hh(i, 39) * 0.2, 0.04, 0.14 + hh(i, 40) * 0.16, 5, { rot: i, r1: 0.06 + hh(i, 39) * 0.1 }); }
      plants.welwitschia = P(-hl + 1.6, 0); agave(B, -hl + 1.6, 0, 0.35, 99);
    } else if (h.key === 'insectivorous') {
      bench(B, 0, 0, r.L - 1.6, 0.9); for (let i = 0; i < 9; i++) { const a = -hl + 1.1 + ((r.L - 2.2) * i) / 8; pitcher(B, a, (i % 2 ? 0.2 : -0.2)); }
      plants.flytrap = P(0, 0);
    } else if (h.key === 'fernery') {
      for (let i = 0; i < 7; i++) { const a = -hl + 0.8 + (r.L - 1.6) * hh(i, 41), b = (hh(i, 42) - 0.5) * (r.W - 1.6); fern(B, a, b, 0.7 + hh(i, 43) * 0.5, i); }
      plants.treefern = P(0, 0); palm(B, 0, 0, 2.4, 7, true);
    } else if (h.key === 'alpine') {
      bench(B, 0, 0, r.L - 1.2, 0.8); for (let i = 0; i < 8; i++) { const a = -hl + 0.8 + ((r.L - 1.6) * i) / 7; pot(B, a, 0, i); }
      plants.edelweiss = P(0, 0);
    }
    B.pop();
  }
  // ---- the Conservatory (lean-to against the north wall, inside)
  {
    const K = CONSERVATORY;
    B.push(F.matrix());
    const yB = K.back, yF = K.front, mid = (K.u0 + K.u1) / 2;
    B.boxXZ('paving', K.u0, K.u1, 0, 0.06, K.v0, K.v1);
    const front = [[K.u0, K.v1], [mid - DOOR_W / 2, K.v1]], front2 = [[mid + DOOR_W / 2, K.v1], [K.u1, K.v1]];
    for (const [a, b] of [front, front2]) { B.poly('stone', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 0.5, b[1]], [a[0], 0.5, a[1]]], [0, 0, 1]); B.poly('glass', [[a[0], 0.5, a[1]], [b[0], 0.5, b[1]], [b[0], yF, b[1]], [a[0], yF, a[1]]], [0, 0, 1]); const wa = F.toW(a[0], a[1]), wb = F.toW(b[0], b[1]); colliders.segs.push([wa[0], wa[1], wb[0], wb[1]]); }
    for (const u of [K.u0, K.u1]) { B.poly('glass', [[u, 0, K.v0], [u, 0, K.v1], [u, yF, K.v1], [u, yB, K.v0]], [u === K.u0 ? -1 : 1, 0, 0]); const wa = F.toW(u, K.v0), wb = F.toW(u, K.v1); colliders.segs.push([wa[0], wa[1], wb[0], wb[1]]); }
    B.poly('glass', [[K.u0, yB, K.v0], [K.u1, yB, K.v0], [K.u1, yF, K.v1], [K.u0, yF, K.v1]], [0, 1, 1]);
    for (let u = K.u0; u <= K.u1 + 1e-6; u += (K.u1 - K.u0) / 14) { B.beam('whiteFrame', [u, yF, K.v1], [u, yB, K.v0], 0.06, 0.08); B.box('whiteFrame', u, yF / 2, K.v1, 0.07, yF, 0.07); }
    B.box('whiteFrame', mid, yF, K.v1, K.u1 - K.u0, 0.1, 0.12);
    for (let i = 0; i < 9; i++) { const u = K.u0 + 1.4 + ((K.u1 - K.u0 - 2.8) * i) / 8; if (Math.abs(u - mid) < 1.6) continue; banana(B, u, K.v0 + 1.5 + (i % 2) * 2.2, 1.2 + hh(i, 51) * 1.2, i + 20); }
    B.pop();
  }
  // ---- the central pond: stone kerb, raised basin and a jet
  {
    const [cx, cz] = POND, r = 3.15;
    for (let i = 0; i < 20; i++) { const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2; const p = (a, rr, y) => [cx + Math.sin(a) * rr, y, cz + Math.cos(a) * rr]; B.poly('stone', [p(a0, r, 0.4), p(a1, r, 0.4), p(a1, r + 0.45, 0.4), p(a0, r + 0.45, 0.4)], [0, 1, 0]); B.poly('stone', [p(a0, r + 0.45, 0), p(a1, r + 0.45, 0), p(a1, r + 0.45, 0.4), p(a0, r + 0.45, 0.4)], [Math.sin(a0), 0, Math.cos(a0)]); }
    lathe(B, 'stone', cx, cz, [[0.6, 0], [0.45, 0.6], [1.1, 0.75], [1.1, 0.85], [0, 0.85]], 12, 0);
    lathe(B, 'whiteFrame', cx, cz, [[0.05, 0.85], [0.03, 2.2], [0, 2.4]], 6, 0); B.flat('pondWater', Array.from({ length: 20 }, (_, i) => [cx + Math.sin((i / 20) * Math.PI * 2) * r, cz + Math.cos((i / 20) * Math.PI * 2) * r]), 0.3);
    plants.mandrake = F.toW(-30, 30);
  }
  // ---- Bobart's yew (1645, ~14 m by 2014), near the south wall
  { const [x, z] = YEW; B.cyl('bark', x, 0, z, 0.55, 2.6, 8, false); lathe(B, 'leafDark', x, z, [[0.4, 1.6], [3.6, 3.2], [4.4, 5.6], [3.8, 8.6], [2.6, 11.4], [1.0, 13.4], [0, 14.2]], 9, 0.3); colliders.circles.push([x, z, 0.7]); plants.yew = [x, z]; }
  // ---- Tolkien's black pine (Pinus nigra, felled 2014) and the bench beside it, by the river
  {
    const [x, z] = PINE; B.cyl('bark', x, 0, z, 0.5, 13, 8, false, 0.3);
    for (const [y, rr] of [[9.5, 4.2], [12.0, 3.6], [14.2, 2.6], [15.8, 1.4]]) lathe(B, 'leafDark', x + (y - 12) * 0.12, z, [[0.2, y - 0.6], [rr, y], [rr * 0.7, y + 1.1], [0, y + 1.6]], 9, y);
    colliders.circles.push([x, z, 0.6]);
    const [bx, bz] = BENCH, ry = Math.atan2(-(bx - x), -(bz - z));
    B.box('darkWood', bx, 0.45, bz, 1.8, 0.06, 0.45, ry); B.box('darkWood', bx - Math.sin(ry) * 0.22, 0.75, bz - Math.cos(ry) * 0.22, 1.8, 0.5, 0.05, ry);
    for (const s of [-0.8, 0.8]) B.box('iron', bx + Math.cos(ry) * s, 0.22, bz - Math.sin(ry) * s, 0.06, 0.45, 0.45, ry);
    plants.pine = [x, z];
  }
  // the glass keeps its own (transparent) draw: panes and slim glazing bars are painted in its texture; everything else
  // is ONE double-sided mesh on the shared fine material
  return { B, houses, colliders, plants };
}
export function build(ctx) {
  const { mats, parent } = ctx, N = construct(ctx, false), Fa = construct(ctx, true); LITE = false;
  const G = new Batch(); { const Pg = N.B.parts.get('glass'); if (Pg) { G.parts.set('glass', Pg); N.B.parts.delete('glass'); } Fa.B.parts.delete('glass'); }
  const near = buildFine(N.B, ctx.world, parent, 'bot:garden:near', { side: THREE.DoubleSide }), far = buildFine(Fa.B, ctx.world, parent, 'bot:garden:far', { side: THREE.DoubleSide });
  near.visible = false;
  const glass = buildMeshes(G, { ...mats, glass: glazing() }, parent, 'bot:garden:', { noCast: new Set(['glass']) });
  for (const m of glass) { m.renderOrder = 2; m.castShadow = false; }
  return { meshes: [near, far, ...glass], lods: [{ near, far, c: [896, 462], r: 105, rFar: 338, airFar: GARDEN_AIR, minScale: 0.7 }], houses: N.houses, colliders: N.colliders, plants: N.plants };
}

// ------------------------------------------------------------------------------------------------ plants (house frame)
let _glz = null;
/** greenhouse glazing: 0.62 x 1.24 m panes in slim white bars, a little sky in the glass (more towards the top of each pane) */
function glazing() {
  if (_glz) return _glz;
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(214,236,244,0.42)'); gr.addColorStop(0.45, 'rgba(190,222,232,0.2)'); gr.addColorStop(1, 'rgba(170,205,210,0.26)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.moveTo(20, 256); g.lineTo(70, 0); g.lineTo(100, 0); g.lineTo(50, 256); g.closePath(); g.fill();
  g.fillStyle = 'rgba(244,246,242,1)'; g.fillRect(0, 0, 7, 256); g.fillRect(0, 250, 128, 6); g.fillStyle = 'rgba(120,130,130,0.55)'; g.fillRect(7, 0, 2, 256); g.fillRect(0, 248, 128, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.62, 1 / 1.24); t.anisotropy = 4;
  _glz = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.06, metalness: 0.15, name: 'bot:glazing' });
  return _glz;
}
const LEAVES = ['leaf', 'leafDark', 'leafLight'];
/** an arching frond from (a, y, b): a V-section strip of leaflets along a rachis that rises, arches over and droops */
function frond(B, a, y, b, ang, L, rise, droop, w, key) {
  const dx = Math.sin(ang), dz = Math.cos(ang), N = LITE ? 2 : 4; let pv = null;
  for (let k = 0; k <= N; k++) {
    const t = k / N, r = L * t, yy = y + rise * Math.sin(t * Math.PI * 0.75) * 1.2 - droop * t * t, ww = w * Math.sin(Math.min(1, t * 1.25 + 0.12) * Math.PI) + 0.02;
    const c = [a + dx * r, yy, b + dz * r], l = [c[0] - dz * ww, yy - ww * 0.45, c[2] + dx * ww], rr = [c[0] + dz * ww, yy - ww * 0.45, c[2] - dx * ww];
    if (pv) { B.poly(key, [pv.c, c, l, pv.l], [0, 1, 0]); B.poly(key, [pv.c, pv.r, rr, c], [0, 1, 0]); }
    pv = { c, l, r: rr };
  }
}
function palm(B, a, b, h, seed, fernlike = false) {
  const lean = (hh(seed, 91) - 0.5) * 0.5, ta = a + lean, tb = b + (hh(seed, 92) - 0.5) * 0.4;
  // round, tapering, leaning trunk in stacked drums (the old leaf bases show as alternating bands); tree ferns dark and fibrous
  const NS = LITE ? 3 : 5, tk = [fernlike ? 'soil' : col('plain', 0.44, 0.38, 0.3), fernlike ? 'soil' : col('plain', 0.36, 0.3, 0.23)];
  for (let k = 0; k < NS; k++) { const t0 = k / NS, t1 = (k + 1) / NS, tm = (t0 + t1) / 2, x = a + (ta - a) * tm * tm, z = b + (tb - b) * tm * tm, r0 = 0.2 - 0.07 * t0, r1 = 0.2 - 0.07 * t1;
    lathe(B, tk[k % 2], x, z, [[r0 + (k ? 0 : 0.08), h * t0], [r1 + 0.025, h * t0 + 0.12], [r1, h * t1]], LITE ? 5 : 7, seed); }
  if (!fernlike) lathe(B, 'bark', ta, tb, [[0.14, h - 0.5], [0.24, h - 0.2], [0.16, h + 0.1], [0, h + 0.2]], 6, seed);
  const n = LITE ? 7 : fernlike ? 12 : 13;
  for (let k = 0; k < n; k++) { const up = k % 3 === 0; frond(B, ta, h, tb, (k / n) * Math.PI * 2 + seed, (fernlike ? 1.5 : 2.6) * (up ? 0.8 : 1), up ? 1.0 : 0.45, up ? 0.5 : (fernlike ? 0.9 : 1.7), fernlike ? 0.26 : 0.42, LEAVES[k % 3]); }
}
function banana(B, a, b, h, seed) {
  B.beam('leafLight', [a, 0, b], [a, h * 0.6, b], 0.14, 0.14);
  for (let k = 0; k < 6; k++) frond(B, a, h * 0.55, b, k * 1.05 + seed, h * 0.75, h * 0.32, h * 0.2, 0.32, LEAVES[(k + seed) % 3 | 0] || 'leaf');
}
/** an aroid / elephant-ear: big heart-shaped leaves on stalks */
function aroid(B, a, b, s, seed) {
  if (LITE) return;
  for (let k = 0; k < 5; k++) { const ang = k * 1.26 + seed, dx = Math.sin(ang), dz = Math.cos(ang), r = s * 0.5, y = s * (0.6 + 0.12 * (k % 3)), c = [a + dx * r, y, b + dz * r];
    B.beam('leafLight', [a, 0.2, b], c, 0.03, 0.03);
    B.poly(LEAVES[k % 3], [c, [c[0] - dz * s * 0.3 + dx * s * 0.1, y + 0.06, c[2] + dx * s * 0.3 + dz * s * 0.1], [c[0] + dx * s * 0.6, y - s * 0.22, c[2] + dz * s * 0.6], [c[0] + dz * s * 0.3 + dx * s * 0.1, y + 0.06, c[2] - dx * s * 0.3 + dz * s * 0.1]], [0, 1, 0]); }
}
/** the titan arum in flower: a pleated maroon spathe round a tall pale spadix, in a big pot */
function titan(B, a, b) {
  lathe(B, col('plain', 0.5, 0.3, 0.2), a, b, [[0.5, 0], [0.62, 0.5], [0.66, 0.56], [0.5, 0.56]], 10, 0); B.flat('soil', Array.from({ length: 10 }, (_, i) => [a + Math.sin(i * 0.628) * 0.52, b + Math.cos(i * 0.628) * 0.52]), 0.52);
  lathe(B, 'leafLight', a, b, [[0.1, 0.5], [0.16, 0.9]], 8, 0);
  lathe(B, col('plain', 0.42, 0.07, 0.16), a, b, [[0.14, 0.85], [0.42, 1.2], [0.62, 1.5], [0.7, 1.62]], 12, 0);
  lathe(B, col('plain', 0.74, 0.68, 0.42), a, b, [[0.13, 0.9], [0.17, 1.5], [0.13, 2.3], [0.06, 2.85], [0, 2.95]], 8, 0);
}
/** Victoria: a great flat pad with an upturned rim (green within, red-brown without), a notch, veins; sometimes a flower */
function giantPad(B, a, b, r, seed = 0) {
  const n = 18, y = 0.435, red = col('plain', 0.42, 0.2, 0.16), nt = hh(seed, 5) * 6.28;
  const p = (q, rr, yy) => [a + Math.sin(q) * rr, yy, b + Math.cos(q) * rr];
  for (let k = 0; k < n; k++) {
    const a0 = nt + 0.08 + (k / n) * (Math.PI * 2 - 0.16), a1 = nt + 0.08 + ((k + 1) / n) * (Math.PI * 2 - 0.16);
    B.poly(k % 2 ? 'padGreen' : 'leafLight', [p(a0, 0, y), p(a0, r, y), p(a1, r, y)], [0, 1, 0]);
    B.poly('leaf', [p(a0, r, y), p(a1, r, y), p(a1, r * 1.05, y + 0.11), p(a0, r * 1.05, y + 0.11)], [-Math.sin(a0), 0.4, -Math.cos(a0)]);
    B.poly(red, [p(a0, r * 1.012, y - 0.01), p(a1, r * 1.012, y - 0.01), p(a1, r * 1.062, y + 0.11), p(a0, r * 1.062, y + 0.11)], [Math.sin(a0), 0, Math.cos(a0)]);
  }
  if (seed % 2 === 0) { const fa = nt + 2, fx = a + Math.sin(fa) * (r + 0.4), fz = b + Math.cos(fa) * (r + 0.4); lathe(B, seed % 4 ? 'flowerPink' : 'flowerWhite', fx, fz, [[0.03, 0.44], [0.2, 0.5], [0.16, 0.62], [0.05, 0.7]], 9, 0); lathe(B, 'gilt', fx, fz, [[0.05, 0.56], [0, 0.66]], 5, 0); }
}
function smallPad(B, a, b, r, seed) { if (LITE) return; const nt = seed * 1.7; for (let k = 0; k < 7; k++) { const a0 = nt + 0.3 + (k / 7) * (Math.PI * 2 - 0.6), a1 = nt + 0.3 + ((k + 1) / 7) * (Math.PI * 2 - 0.6); B.poly(seed % 2 ? 'padGreen' : 'leaf', [[a, 0.432, b], [a + Math.sin(a0) * r, 0.432, b + Math.cos(a0) * r], [a + Math.sin(a1) * r, 0.432, b + Math.cos(a1) * r]], [0, 1, 0]); } }
function cactus(B, a, b, h, seed) {
  prism(B, 'cactus', a, b, 0.17, 0, h, 8, { cap: false }); lathe(B, 'cactus', a, b, [[0.17, h], [0.13, h + 0.12], [0, h + 0.18]], 8);
  if (!LITE) for (let i = 0; i < 8; i++) { const q = Math.PI / 8 + (i / 8) * Math.PI * 2; B.box('leafDark', a + Math.sin(q) * 0.172, h / 2, b + Math.cos(q) * 0.172, 0.02, h, 0.02, 0, { top: false }); }
  if (h > 1.4) for (const s of seed % 2 ? [1, -1] : [-1]) { const y = h * (s > 0 ? 0.5 : 0.62); B.beam('cactus', [a + s * 0.12, y, b], [a + s * 0.5, y + 0.08, b], 0.2, 0.2); prism(B, 'cactus', a + s * 0.5, b, 0.11, y, y + h * 0.3, 6, { cap: false }); lathe(B, 'cactus', a + s * 0.5, b, [[0.11, y + h * 0.3], [0, y + h * 0.3 + 0.12]], 6); }
}
function barrel(B, a, b, r, seed) { lathe(B, 'cactus', a, b, [[r * 0.6, 0.04], [r, r * 0.6], [r * 0.95, r * 1.3], [r * 0.5, r * 1.8], [0, r * 1.9]], 10, seed); lathe(B, seed % 2 ? 'flowerPink' : 'gilt', a, b, [[0.03, r * 1.86], [0.09, r * 1.98], [0, r * 2.02]], 6, 0); }
/** a prickly pear: flat oval pads growing out of one another */
function pear(B, a, b, s, seed) {
  const pad = (x, y, z, r, ry) => { const c = Math.cos(ry), sn = Math.sin(ry), pts = []; for (let k = 0; k < 8; k++) { const q = (k / 8) * Math.PI * 2; pts.push([x + Math.cos(q) * r * 0.75 * c, y + Math.sin(q) * r, z - Math.cos(q) * r * 0.75 * sn]); } B.poly('cactus', pts, [sn, 0, c]); };
  pad(a, s * 0.35, b, s * 0.34, seed); pad(a + Math.cos(seed) * s * 0.2, s * 0.85, b - Math.sin(seed) * s * 0.2, s * 0.28, seed + 0.7); pad(a - Math.cos(seed) * s * 0.22, s * 0.8, b + Math.sin(seed) * s * 0.22, s * 0.24, seed - 0.6); pad(a + Math.cos(seed) * s * 0.3, s * 1.25, b - Math.sin(seed) * s * 0.3, s * 0.2, seed + 1.2);
}
function agave(B, a, b, s, seed) { for (let k = 0; k < 11; k++) { const ang = (k / 11) * Math.PI * 2 + seed, dx = Math.sin(ang), dz = Math.cos(ang), up = k % 2 ? 0.9 : 0.5, rr = k % 2 ? 0.7 : 1; B.poly(k % 2 ? 'cactus' : 'leafLight', [[a - dz * 0.09, 0.05, b + dx * 0.09], [a + dx * s * rr, s * up, b + dz * s * rr], [a + dz * 0.09, 0.05, b - dx * 0.09]], [dx, 0.3, dz]); } }
function fern(B, a, b, s, seed, y0 = 0.05) { if (LITE && y0 > 0.1) return; for (let k = 0; k < 7; k++) frond(B, a, y0, b, (k / 7) * Math.PI * 2 + seed, s, s * 0.55, s * 0.35, s * 0.2, LEAVES[k % 3]); }
function bench(B, a, b, L, w) { B.boxXZ('darkWood', a - L / 2, a + L / 2, 0.8, 0.86, b - w / 2, b + w / 2); for (const s of [-1, 1]) for (const t of [-1, 1]) B.box('darkWood', a + s * (L / 2 - 0.1), 0.4, b + t * (w / 2 - 0.1), 0.06, 0.8, 0.06); }
function pitcher(B, a, b) { lathe(B, col('plain', 0.55, 0.3, 0.2), a, b, [[0.09, 0.86], [0.13, 1.0]], 8, 0); lathe(B, 'leafLight', a, b, [[0.03, 1.0], [0.09, 1.12], [0.06, 1.32], [0.1, 1.38], [0.08, 1.4]], 6, 0); lathe(B, col('plain', 0.5, 0.12, 0.18), a + 0.12, b + 0.05, [[0.02, 1.0], [0.07, 1.14], [0.05, 1.3], [0.08, 1.36]], 6, 0); B.poly(col('plain', 0.5, 0.12, 0.18), [[a + 0.06, 1.38, b + 0.05], [a + 0.2, 1.42, b + 0.05], [a + 0.13, 1.5, b + 0.12]], [0, 1, 0]); }
function pot(B, a, b, seed) { lathe(B, col('plain', 0.55, 0.3, 0.2), a, b, [[0.09, 0.86], [0.14, 1.0]], 8, 0); lathe(B, seed % 2 ? 'leaf' : 'leafLight', a, b, [[0.04, 1.0], [0.18, 1.06], [0.12, 1.15], [0, 1.2]], 7, seed); for (let k = 0; k < 3; k++) B.box(['flowerPink', 'flowerWhite', 'flowerPurple', 'gilt'][(seed + k) % 4], a + Math.sin(seed + k * 2.1) * 0.08, 1.2, b + Math.cos(seed + k * 2.1) * 0.08, 0.05, 0.04, 0.05); }
