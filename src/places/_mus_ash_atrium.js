// SHOWPIECE: the Ashmolean's 2009 atrium (Rick Mather) — a white top-lit well through all floors with
// the stair rising in alternating flights, landings at the north end, glass balustrades, and the glazed bridges at the
// south end. Facts: docs/research/museums.md §3.
//
// Interface: buildAtrium(ctx) -> { meshes, dims }
//   ctx = { scene }    dims = ATRIUM (below), in the Ashmolean interior frame (+z = towards the portico / Beaumont
//   Street): the well x ±HW, z N..S; floor levels; three flights (lanes) and the landings each floor has.
import * as THREE from 'three';
import { Geo, museumMats } from './_mus_kit.js';
import { canvas, canvasTexture } from './_randolph_kit.js';
import { ASH_PLAN as PL } from './_mus_ash_plan.js';

// (walk-in plan, _mus_ash_plan.js: the well runs from the back of Cockerell's front range to the north wall; the south
//  landings are deep — the "orientation galleries" that overlook the atrium on each floor)
const FZ0 = PL.ZN + 10, FZ1 = FZ0 + 14;
export const ATRIUM = {
  HW: PL.HW, N: PL.ZN, S: PL.ZH, levels: PL.LV, roof: PL.ROOF,
  flights: [
    { b: 0, x0: -6, x1: -2.5, z0: FZ0, z1: FZ1, lo: FZ1 },   // rises north
    { b: 1, x0: 2.5, x1: 6, z0: FZ0, z1: FZ1, lo: FZ0 },     // rises south
    { b: 2, x0: -6, x1: -2.5, z0: FZ0, z1: FZ1, lo: FZ1 },   // rises north (over the first), to the roof
  ],
  north: { z0: PL.ZN, z1: FZ0, floors: [1, 3] },    // landings across the well
  south: { z0: FZ1, z1: PL.ZH, floors: [1, 2] },
  // doorways in the well's side walls, metres from the north end, per floor (both sides; the roof: east only)
  doors: { 0: [[3, 7], [28, 32]], 1: [[3, 7], [28, 32]], 2: [[28, 32]], 3: [] }, doors3E: [[3, 7]],
  hallGap: [-4, 4],                                 // the opening in the south wall (to the hall; on 1 a balcony over it)
};
const WHITE = 0xf4f2ec, STONEFL = 0xd8d2c4, RAIL = 0x9aa0a4;

export function buildAtrium(ctx) {
  const sc = ctx.scene, A = ATRIUM, M = museumMats(), G = new Geo(), HW = A.HW;
  const lv = A.levels;
  // the well's walls (white plaster over pale stone base) with openings to the galleries are drawn by the interior
  // builder; here: landings, flights, balustrades, bridges, the roof light
  const slab = (x0, x1, z0, z1, y, glass = false) => {
    G.color(glass ? 0xffffff : 0xffffff); G.poly(glass ? 'glass' : 'floorPale', [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0]);
    G.color(WHITE); G.poly('paint', [[x0, y - 0.4, z0], [x1, y - 0.4, z0], [x1, y - 0.4, z1], [x0, y - 0.4, z1]], [0, -1, 0]);
    for (const [a, b, n] of [[[x0, z0], [x1, z0], [0, -1]], [[x1, z1], [x0, z1], [0, 1]]]) G.poly('paint', [[a[0], y - 0.4, a[1]], [b[0], y - 0.4, b[1]], [b[0], y, b[1]], [a[0], y, a[1]]], [n[0], 0, n[1]]);
  };
  const glassRail = (a, b, y) => {
    G.color(0xffffff); G.poly('glass', [[a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + 1.05, b[1]], [a[0], y + 1.05, a[1]]], [b[1] - a[1], 0, a[0] - b[0]]);
    G.color(RAIL); G.beam('iron', [a[0], y + 1.08, a[1]], [b[0], y + 1.08, b[1]], 0.06);
  };
  for (const k of A.north.floors) { slab(-HW, HW, A.north.z0, A.north.z1, lv[k]); }
  for (const k of A.south.floors) { slab(-HW, HW, A.south.z0, A.south.z0 + 3, lv[k], k === 1); slab(-HW, HW, A.south.z0 + 3, A.south.z1, lv[k]); }
  // balustrades along the landings' open edges (the well between them), leaving the flights' ends open
  const gaps = (z, y, openLanes) => {
    const xs = [-HW, ...openLanes.flatMap((f) => [f.x0, f.x1]), HW].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i += 2) glassRail([xs[i], z], [xs[i + 1], z], y);
  };
  const F = A.flights;
  gaps(A.north.z1, lv[1], [F[0], F[1]]);
  gaps(A.north.z1, lv[3], [F[2]]);
  gaps(A.south.z0, lv[1], []);
  gaps(A.south.z0, lv[2], [F[1], F[2]]);
  // the flights: pale stone treads with white risers on a white stepped stringer (the sawtooth reads from the well),
  // a smooth white soffit, sloping glass balustrades on a steel shoe with a thin steel handrail
  for (const f of F) {
    const y0 = lv[f.b], y1 = lv[f.b + 1], n = 28, north = f.lo === f.z1, L = f.z1 - f.z0, dz = L / n;
    const zb = north ? f.z1 : f.z0, zt = north ? f.z0 : f.z1, soff = (z) => y0 - 0.42 + (y1 - y0) * ((z - zb) / (zt - zb));
    for (let i = 0; i < n; i++) {
      const y = y0 + ((i + 1) / n) * (y1 - y0), za = north ? f.z1 - (i + 1) * dz : f.z0 + i * dz;
      G.color(i % 2 ? 0xe6e1d6 : 0xe1dccf); G.box('floorPale', f.x0 + 0.02, y - 0.05, za, f.x1 - 0.02, y, za + dz, { bottom: false });
      G.color(0xfbfaf6); G.poly('paint', north ? [[f.x0, y - 0.18, za + dz], [f.x1, y - 0.18, za + dz], [f.x1, y - 0.05, za + dz], [f.x0, y - 0.05, za + dz]] : [[f.x1, y - 0.18, za], [f.x0, y - 0.18, za], [f.x0, y - 0.05, za], [f.x1, y - 0.05, za]], [0, 0, north ? 1 : -1]);
      // the stringer: one sawtooth tooth per step on each side, from the soffit line up to the tread
      for (const [x, nx] of [[f.x0, -1], [f.x1, 1]]) { G.color(WHITE); G.poly('paint', [[x, soff(za), za], [x, soff(za + dz), za + dz], [x, y, za + dz], [x, y, za]], [nx, 0, 0]); }
    }
    G.color(0xeeece6); G.poly('paint', [[f.x0, y0 - 0.42, zb], [f.x1, y0 - 0.42, zb], [f.x1, y1 - 0.42, zt], [f.x0, y1 - 0.42, zt]], [0, -1, 0]);
    for (const x of [f.x0, f.x1]) {
      G.color(0xffffff); G.poly('glass', [[x, y0 + 0.04, zb], [x, y1 + 0.04, zt], [x, y1 + 1.05, zt], [x, y0 + 1.05, zb]], [1, 0, 0]);
      G.color(0xa9cfc4); G.beam('paint', [x, y0 + 1.04, zb], [x, y1 + 1.04, zt], 0.022, 0.012);       // the green edge of the glass
      G.color(RAIL); G.beam('iron', [x, y0 + 1.09, zb], [x, y1 + 1.09, zt], 0.045);
      G.color(0x8e9498); G.beam('iron', [x, y0 + 0.02, zb], [x, y1 + 0.02, zt], 0.05, 0.08);
    }
  }
  // the glazed bridge on the first floor: a steel edge beam each side under the glass deck
  G.color(0xdedcd6); for (const z of [A.south.z0 + 0.05, A.south.z0 + 2.95]) G.box('paint', -HW, lv[1] - 0.45, z - 0.05, HW, lv[1] - 0.02, z + 0.05);
  // the roof light over the well: bright sky through fritted glass between deep white fins
  G.color(0xffffff); G.poly('glassRoof', [[-HW, A.roof, A.N], [HW, A.roof, A.N], [HW, A.roof, A.S], [-HW, A.roof, A.S]], [0, -1, 0], [[0, 0], [8, 0], [8, 15], [0, 15]]);
  for (let z = A.N; z <= A.S + 0.01; z += 2) { G.color(0xf6f5f0); G.box('paint', -HW, A.roof - 0.9, z - 0.06, HW, A.roof, z + 0.06, { bottom: true, top: false }); }
  for (const x of [-HW + 0.1, 0, HW - 0.1]) { G.color(0xeeede8); G.box('paint', x - 0.1, A.roof - 1.0, A.N, x + 0.1, A.roof - 0.86, A.S, { bottom: true }); }
  // daylight down the well: an additive wash on the white walls, strongest under the roof light and fading by the
  // ground floor, kept off the gallery doorways; a pool of light on the floors the sky reaches
  {
    const DOOR = PL.DOOR, toZ = (g) => g.map(([a, b]) => [A.N + a, A.N + b]), gapsX = { 0: toZ(A.doors[0]), 1: toZ(A.doors[1]), 2: toZ(A.doors[2]), 3: [] }, gapsX3E = toZ(A.doors3E);
    const wash = (pts, k = 1) => { G.color(new THREE.Color(0xffffff).multiplyScalar(k).getHex()); G.poly('wash', pts.map((p) => p.slice(0, 3)), null, pts.map((p) => [0.5, p[1] / A.roof])); };
    const runs = (a, b, gaps) => { const out = []; let s = a; for (const [g0, g1] of gaps) { if (g0 > s) out.push([s, g0]); out.push([g0, g1, 1]); s = g1; } if (s < b) out.push([s, b]); return out; };
    for (const sx of [-1, 1]) {
      const x = sx * (HW - 0.03);
      for (let k = 0; k < 4; k++) {
        const ya = lv[k], yb = k === 3 ? A.roof : lv[k + 1], gp = k === 3 ? (sx > 0 ? gapsX3E : []) : gapsX[k];
        for (const [z0, z1, door] of runs(A.N, A.S, gp)) {
          const lo = door ? ya + DOOR : ya;
          wash(sx < 0 ? [[x, lo, z1], [x, lo, z0], [x, yb, z0], [x, yb, z1]] : [[x, lo, z0], [x, lo, z1], [x, yb, z1], [x, yb, z0]]);
        }
      }
    }
    wash([[-HW, 0, A.N + 0.03], [HW, 0, A.N + 0.03], [HW, A.roof, A.N + 0.03], [-HW, A.roof, A.N + 0.03]]);
    for (let k = 0; k < 4; k++) {
      const ya = lv[k], yb = k === 3 ? A.roof : lv[k + 1], z = A.S - 0.03;
      for (const [x0, x1, door] of runs(-HW, HW, k === 3 ? [] : [A.hallGap])) { const lo = door ? ya + DOOR : ya; wash([[x1, lo, z], [x0, lo, z], [x0, yb, z], [x1, yb, z]]); }
    }
    // pools: the well floor between the landings, the top landing, the stair treads catch a little too
    const pool = (x0, x1, z0, z1, y, k) => { G.color(new THREE.Color(0xffffff).multiplyScalar(k).getHex()); G.poly('wash', [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], [[0.5, 0.42], [0.5, 0.42], [0.5, 0.42], [0.5, 0.42]]); };
    pool(-HW + 0.2, HW - 0.2, FZ0 + 0.2, FZ1 - 0.2, 0.015, 0.9); pool(-HW + 0.2, HW - 0.2, A.south.z0 + 3.1, A.south.z1 - 0.2, lv[2] + 0.015, 1.2); pool(-HW + 0.2, HW - 0.2, A.north.z0 + 0.2, A.north.z1 - 0.2, lv[3] + 0.015, 1.6);
  }
  const sky = new THREE.MeshBasicMaterial({ map: (() => { const { canvas: c, g } = canvas(64, 64); g.fillStyle = '#f7fbff'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(190,210,225,0.55)'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 8, 64, 1.5); g.fillStyle = 'rgba(120,140,150,0.5)'; g.fillRect(0, 0, 2, 64); const t = canvasTexture(c, { repeat: true }); return t; })(), toneMapped: false, name: 'mus-ash-skylight' });
  const washMat = new THREE.MeshBasicMaterial({ map: (() => { const { canvas: c, g } = canvas(4, 128), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgb(255,250,240)'); gr.addColorStop(0.3, 'rgb(150,146,138)'); gr.addColorStop(0.7, 'rgb(60,58,55)'); gr.addColorStop(1, 'rgb(26,25,24)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return canvasTexture(c); })(), vertexColors: true, color: 0xfff4e4, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, name: 'mus-ash-wash' });
  const meshes = G.build({ ...M, glassRoof: sky, wash: washMat }, sc, { name: 'mus-ash-atrium', cast: false, receive: false });
  return { meshes, dims: A, sky, wash: washMat };
}
