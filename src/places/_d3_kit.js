// Small builders shared by the districts-3 pass (places/hythe_bridge.js, walton_well.js, headington_hill.js; see
// docs/research/districts3.md). Everything writes into a Batch of the shared batch-4 atlas draw (_b4_kit.js), so
// nothing here makes a mesh of its own. q = LOD level (0 near, 1 mid, 2 far). Pure apart from the Batch.
import * as THREE from 'three';
import { RB, geoOf, b4Pack, bike } from './_b4_kit.js';
import { cumOf, along } from './_d2_kit.js';

/** ?nod3 in the URL (or GTO_NOD3=1 in node): this pass is not installed (before / after shots, budget comparisons) */
export const D3OFF = () => { try { return /[?&]nod3\b/.test((globalThis.location && globalThis.location.search) || '') || !!(globalThis.process && globalThis.process.env && globalThis.process.env.GTO_NOD3); } catch { return false; } };
export const UV1 = [0.004, 0.004, 0.996, 0.996];
/** the map's buildings and roads within r m of (cx, cz): a small stand-in for `map` in offCarriage / offBuildings searches */
export const nearMap = (map, cx, cz, r) => ({ buildings: map.buildings.filter((b) => !b.part && Math.abs(b.c[0] - cx) < r + 60 && Math.abs(b.c[1] - cz) < r + 60), roads: map.roads.filter((q) => q.pts.some((p) => Math.abs(p[0] - cx) < r + 90 && Math.abs(p[1] - cz) < r + 90)) });
export const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * An iron railing from A to B ([x, z]): top and mid rails at y0 + h and y0 + 0.12, close bars (q 0) or wide ones (q 1),
 * none at q 2. lift(t) raises the railing along its length (a hump), key the paint.
 */
export function railRun(B, A, C, y0, h, q, key = 'iron', pitch = 0.16, lift = null) {
  const L = Math.hypot(C[0] - A[0], C[1] - A[1]), n = Math.max(2, Math.round(L / (q ? pitch * 4 : pitch))), seg = Math.max(1, Math.round(L / 1.5));
  const P = (t, y) => { const p = lerp2(A, C, t); return [p[0], y + (lift ? lift(t) : 0), p[1]]; };
  for (let k = 0; k < seg; k++) { const t0 = k / seg, t1 = (k + 1) / seg; B.beam(key, P(t0, y0 + h), P(t1, y0 + h), 0.05); if (q < 2) B.beam(key, P(t0, y0 + 0.12), P(t1, y0 + 0.12), 0.035); }
  if (q < 2) for (let k = 0; k <= n; k++) { const t = k / n; B.beam(key, P(t, y0 + 0.1), P(t, y0 + h + 0.02), q ? 0.03 : 0.02); }
}

/**
 * A skin over the world's solid stone bridge parapet (roads.js bridgeParapets: 0.45 m thick, -0.6 .. 1.05 m, at
 * `off` from the centre line) along a road polyline: brick faces 3 cm proud both sides, a stone coping on top and a
 * pier at each end. key: the facing ('brick', 'brickDk', 'stone'), cap: the coping key.
 */
export function parapetSkin(B, pts, off, q, key = 'brick', cap = 'dress') {
  const cum = cumOf(pts), L = cum[cum.length - 1], t = 0.45 + 0.06, n = Math.max(1, Math.round(L / 6));
  for (const sd of [1, -1]) {
    for (let k = 0; k < n; k++) {
      const a = along(pts, cum, (k / n) * L), b = along(pts, cum, ((k + 1) / n) * L);
      const ax = a.x + a.nx * sd * off, az = a.z + a.nz * sd * off, bx = b.x + a.nx * sd * off, bz = b.z + a.nz * sd * off;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az), r = Math.atan2(a.ux, a.uz);
      B.box(key, mx, 0.4, mz, t, 1.3, len, r, { top: false });
      B.box(cap, mx, 1.13, mz, t + 0.12, 0.16, len, r, { bottom: true });
    }
    for (const s of [0, L]) { const p = along(pts, cum, s), x = p.x + p.nx * sd * off, z = p.z + p.nz * sd * off; B.box(key, x, 0.6, z, 0.75, 1.2, 0.75, Math.atan2(p.ux, p.uz)); B.box(cap, x, 1.27, z, 0.88, 0.14, 0.88, Math.atan2(p.ux, p.uz), { bottom: true }); if (q === 0) B.lathe(cap, x, z, [[0.22, 1.34], [0.25, 1.46], [0.16, 1.62], [0.0, 1.66]], { seg: 8 }); }
  }
}

/** a small own mesh for something that moves or shows only near (one draw while visible): the Batch in the b4 material */
export function ownMesh(game, B, name) {
  const P = b4Pack(game.world), m = new THREE.Mesh(geoOf(B, P), P.atlas);
  m.name = name; m.frustumCulled = false; m.visible = false; m.castShadow = false; m.matrixAutoUpdate = false;
  game.worldScene.add(m); return m;
}
/** Gerald: a green bicycle with a wicker basket on the handlebars (origin at the ground, facing +z) */
export function geraldBatch() {
  const B = new RB(); bike(B, 0, 0, 0, 'boatGreen', 0);
  B.box('basket', 0, 0.98, 0.62, 0.38, 0.26, 0.3, 0); B.box('dark', 0, 1.12, 0.62, 0.4, 0.02, 0.32, 0);
  return B;
}
/** a kingfisher (body, beak, orange breast), origin at the bird, flying along +z */
export function kingfisherBatch() {
  const B = new RB();
  B.box('kingBlue', 0, 0, 0, 0.07, 0.07, 0.16, 0); B.box('kingOrange', 0, -0.03, 0.01, 0.06, 0.03, 0.12, 0);
  B.beam('dark', [0, 0.01, 0.08], [0, 0.0, 0.15], 0.015); B.box('kingBlue', 0, 0.0, -0.11, 0.05, 0.02, 0.07, 0);
  for (const s of [-1, 1]) B.poly('kingBlue', [[s * 0.03, 0.02, 0.05], [s * 0.15, 0.03, 0.0], [s * 0.03, 0.02, -0.05]], [0, 1, 0]);
  return B;
}
export { cumOf, along };
