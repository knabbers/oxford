// Worcester College: THE CORE'S RIM ON THE DRAWN GROUND (2026-11-23; docs/research/worcester_survey.md section 2 "One
// rule for levels" and Appendix D.3). Read by places/worcester.js.
//
// The core stands at its datum, 61.05 m above sea level (WORC_LEVELS). On its south and west sides the real ground is
// 1.9 to 2.9 m lower: the Nuffield Lawn's border and path at the foot of the Cottages, the rose garden behind the
// quad's west wall. The drawn terrain (world/terrain.js) takes that fall AT THE CORE'S WALLS: four precincts of the
// terrain (tools/terrain_precincts.json, entered after the core's own) hold the gardens at their surveyed levels right up to the
// walls and for 2.8 m in under them, and the core, which is rigid at its datum (worcester.js `coreLift`), stands over
// the step. So nothing of the gardens is laid here in geometry: the lawn, the paths, the beds and the trees are the
// map's and the gardens builder's, on the drawn ground. What the core builds is its own walls down to that ground,
// and the two garden passages level through them.
//
// RINGS AND LEVELS, as agreed with the terrain builder (college frame: u east, v south; K: Environment Agency LIDAR
// 2022 ground model, read in the map's frame, which lies 0.5 m west of the survey's):
//   S1  the Nuffield strip south of the Hanging Garden's mound and the Cottages: ONE PLANE, 59.25 m at (-5, 30),
//       rising 0.0175 m per metre east and falling 0.030 m per metre south (the survey at the wall's foot: 58.72 /
//       59.00 / 59.21 at u -40 / -20 / -10; at v 41: 58.26 / 58.76 / 58.89; within 0.1 m of the plane)
//   S2  the east passage's mouth and the lawn west of Staircase 13: 59.10 (survey 58.95 - 59.20)
//   W1  the rose garden's east margin, to the garden face of the quad's wall: 58.20 (survey 58.13 - 58.26)
//   W2  under the east end of the Hanging Garden's long walk, west of the mound: 58.40 (survey 58.30 - 58.50)
import { WORC_LEVELS } from './_worcester_shared.js';

const PHI = 0.0761, COS = Math.cos(PHI), SIN = Math.sin(PHI);
const L2W = (u, v) => [-250 + u * COS + v * SIN, 10 - u * SIN + v * COS];
const DATUM_H = WORC_LEVELS.datumOD - 58;      // the terrain field's height at the core's datum (the field's 0 is 58.00 m)

export const RIM = {
  rings: {
    S1: [[-60, 28.3], [-44.0, 28.3], [-43.7, 27.35], [-12.3, 28.8], [-12.3, 35.5], [-9.5, 35.5], [-9.5, 42.5], [-60, 42.5]],
    S2: [[-9.5, 35.5], [-1.3, 35.5], [-1.3, 36.2], [-2.1, 45.2], [0.7, 45.5], [0.7, 57.2], [-3.3, 57.2], [-3.3, 45.5], [-6.1, 45.2], [-5.3, 39.5], [-9.5, 39.5]],
    // (W1, W2: their east edges are AT the wall's garden face. Only a ring's own ground is certainly level: beyond its
    //  edge the level runs on for 0 to 2.8 m, as the 2 m lattice falls, and the step is the next cell. So the gardens
    //  are level to the wall for certain and the step falls in the first 4.9 m inside the core: wall, border, the
    //  quad's west path, part of the south-west passage. Pulled back, it fell in the rose garden against the wall.)
    W1: [[-56.6, -16.05], [-52.6, -16.05], [-52.6, 17.7], [-56.6, 17.7]],
    W2: [[-56.3, 17.7], [-52.3, 17.7], [-52.3, 28.3], [-56.3, 28.3]],
  },
  planeS: (u, v) => 59.25 + 0.0175 * (u + 5) - 0.030 * (v - 30), notch: 59.10, rose: 58.20, hang: 58.40,
  // the Hanging Garden's mound over the south-west passage: its lawn at 60.95 m (K: LIDAR surface 60.84 - 60.97 at
  // u -52 .. -48, v 24), its south wall at v 28.3 (K: LIDAR: the wall's top at v 28.0, the border's ground at 28.5;
  // it was drawn 2.1 m further south, to the end of the mapped passage)
  hangTop: 60.95, hangLen: 8.3,
  // the quad's west wall: 2.2 m of stone above the quad's path south of its door, 3.1 m from the door northwards (the
  // coping sweeps up beside the door), a railing of 1.2 m on top (K: 31/main quad west wall - door at the foot and
  // iron railing on top (2017), scaled from the door; LIDAR: the top at 60.4 m, 2.0 m above the path at 58.4; the
  // survey's G01: 1.5 - 2.5 m). The sweep's place and the heights to 0.2 m: G.
  wall: { low: 2.2, high: 3.1, sweep: [-5.6, -6.5], rake: -11.0, parapet: 1.1, rail: 1.18 },
};

// A PREVIEW OF THE TERRAIN'S PATCH, until it is in: `?rimprecincts=1` (node: GTO_RIM_PRECINCTS=1) writes the four
// precincts into the terrain's field as this module is loaded, i.e. before the field goes to the graphics card and
// before the world is built on it: each ring's level (S1: its plane) on every node in the ring or within 2.83 m of it,
// then back to the survey over a 3 m seam on the gardens' side (towards the core: at once). The game is then the one
// the patch will give — the passages level, the gardens at the walls' feet — and can be walked and looked at today.
// Off by default: the live game is the terrain's own data. DELETE with `rimDropped` when the precincts are in for good.
const qs = typeof location !== 'undefined' && location && location.search ? location.search : '', env = typeof process !== 'undefined' && process.env ? process.env : {};
export const RIM_PREVIEW = /[?&]rimprecincts=1(&|$)/.test(qs) || env.GTO_RIM_PRECINCTS === '1';
if (RIM_PREVIEW) {
  const { TERRAIN } = await import('../world/terrain.js'), F = TERRAIN.field;
  if (F && F.R) {
    const W2L = (x, z) => [(x + 250) * COS - (z - 10) * SIN, (x + 250) * SIN + (z - 10) * COS];
    const pip = (u, v, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > v) !== (b[1] > v) && u < ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const dist = (u, v, p) => { let d = 1e9; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], du = b[0] - a[0], dv = b[1] - a[1], t = Math.max(0, Math.min(1, ((u - a[0]) * du + (v - a[1]) * dv) / (du * du + dv * dv))); d = Math.min(d, Math.hypot(u - a[0] - du * t, v - a[1] - dv * t)); } return d; };
    const rings = [[RIM.rings.S1, RIM.planeS], [RIM.rings.S2, () => RIM.notch], [RIM.rings.W1, () => RIM.rose], [RIM.rings.W2, () => RIM.hang]];
    let n = 0;
    for (let j = 0; j < F.nz; j++) for (let i = 0; i < F.nx; i++) {
      const x = F.x0 + i * F.g, z = F.z0 + j * F.g; if (x < -335 || x > -225 || z < -25 || z > 90) continue;
      const [u, v] = W2L(x, z), k = j * F.nx + i;
      let best = 1e9, lv = 0;
      for (const [ring, level] of rings) { const d = pip(u, v, ring) ? 0 : dist(u, v, ring); if (d < best) { best = d; lv = level(u, v) - 58; } }
      if (best > 5.83) continue;
      const sv = F.R[k]; let h = lv;
      if (best > 2.83) { if (Math.abs(sv - lv) > 1) continue; const t = (best - 2.83) / 3; h = lv + (sv - lv) * t * t * (3 - 2 * t); }
      F.R[k] = h; F.W[k] = h; if (F.B) F.B[k] = h; n++;
    }
    console.log(`[worcester] rim PREVIEW (rimprecincts=1): ${n} nodes of the terrain's field set to the four garden precincts`);
  }
}

/** the garden's true ground (metres above sea level) at college-local (u, v) outside the core's walls */
export function rimLevel(u, v) {
  if (u < -52.3 && v < 17.7) return RIM.rose;
  if (u < -52.3 && v < 28.3) return RIM.hang;
  if (u > -9.5 && v > 35.4) return RIM.notch;
  return RIM.planeS(u, v);
}

/**
 * THE SWITCH. Has the drawn ground at college-local (u, v) dropped from the core's datum to the garden's level, i.e.
 * are the rim's precincts in the terrain? Where it has, the garden passages run level to the true garden; where the
 * drawn ground still stands at the datum (the terrain before those precincts: world/_terrain_data.js), they climb to
 * it as they did, so that the game can be walked before and after the terrain's patch. ONE place: when the precincts
 * are in for good, make this `return true` (or delete it and its two uses in worcester.js, `GARD`).
 * No drawn terrain to ask (the tests' dry run): the true levels. `?terrain=0` (a flat world): the old climb.
 */
export function rimDropped(world, u, v) {
  if (!world || typeof world.terrainHeight !== 'function') return true;
  if (world.terrain && world.terrain.on === false) return false;
  const [x, z] = L2W(u, v), h = world.terrainHeight(x, z);
  return Number.isFinite(h) && h < DATUM_H - 0.5;
}

/**
 * CUT A BUILT GEOMETRY TO THE TERRAIN'S LATTICE where the field under it steps. The warp lifts each VERTEX by the field
 * under it, and worcester.js then holds the core rigid by building each vertex higher by what the field under it falls
 * short of the datum: both are exact at the vertices only. A wall, a roof or a floor that crosses the step under the
 * core's edge (2.4 - 2.9 m in one 2 m cell) would be drawn bent between its corners: a bank in a passage's floor, a
 * kink in a roof. The field is flat on each half of each 2 m cell (two triangles, split along x + z = constant), so a
 * triangle cut along those three families of lines lies, piece by piece, where both the lift and its correction are
 * linear: it is drawn exactly where it was built. Only triangles under which the field is not one plane are touched
 * (to 3 mm), and of those only the ones with a corner where `inside(u, v)` says so (the core's level polygon: what
 * stands outside it is not held rigid, and is left to follow the ground between its own corners as it did); every
 * attribute is carried linearly. Geometry in the college's own frame (u, y, v), not indexed. opt.tol: how far off one
 * plane the field may be under a triangle that is left whole (m; 0.003); opt.minEdge: triangles smaller than this are
 * left whole (a clump of planting on the step bends by a hand; a wall does not).
 * COST: with the four garden precincts in, about 9,000 triangles more in the college (1,800 on the terrain as it is):
 * the step runs under 130 m of the core's edge and every floor, wall and roof over it is cut every metre or so. THE
 * CURE is the terrain's: a static mesh marked rigid and lifted by the ground under its ORIGIN (as is being done for
 * figures) would hold the whole core at its datum with no correction and no cut; then this and `coreLift` go.
 * Returns the triangles added.
 */
export function cutToField(geo, world, inside, opt = {}) {
  const TOL = opt.tol ?? 0.003, MINE = opt.minEdge ?? 0;
  const F = world && world.terrain && world.terrain.on !== false ? world.terrain.field : null;
  const P = geo && geo.attributes && geo.attributes.position;
  if (!F || !F.h || !P || geo.index) return 0;
  const names = Object.keys(geo.attributes), A = names.map((n) => geo.attributes[n]), size = A.map((a) => a.itemSize), W = size.reduce((s, k) => s + k, 0);
  const ip = names.indexOf('position'), po = size.slice(0, ip).reduce((s, k) => s + k, 0), n0 = P.count, inv = 1 / F.g;
  const H = (u, v) => F.h(-250 + u * COS + v * SIN, 10 - u * SIN + v * COS);
  // the three families of lattice lines as functions of (u, v) that are whole numbers on the lines
  const fam = [(u, v) => (-250 + u * COS + v * SIN - F.x0) * inv, (u, v) => (10 - u * SIN + v * COS - F.z0) * inv, (u, v) => (-240 + u * (COS - SIN) + v * (SIN + COS) - F.x0 - F.z0) * inv];
  const rec = (i) => { const r = new Float64Array(W + 1); let o = 0; for (let a = 0; a < A.length; a++) { const arr = A[a].array, k = size[a]; for (let q = 0; q < k; q++) r[o++] = arr[i * k + q]; } r[W] = H(r[po], r[po + 2]); return r; };
  const mix = (a, b, t) => { const r = new Float64Array(W + 1); for (let q = 0; q < W; q++) r[q] = a[q] + (b[q] - a[q]) * t; r[W] = H(r[po], r[po + 2]); return r; };
  // is the field one plane under triangle a b c? (sampled on a lattice of barycentric points)
  const flat = (a, b, c) => {
    if (MINE && Math.max(Math.hypot(a[po] - b[po], a[po + 1] - b[po + 1], a[po + 2] - b[po + 2]), Math.hypot(b[po] - c[po], b[po + 1] - c[po + 1], b[po + 2] - c[po + 2]), Math.hypot(c[po] - a[po], c[po + 1] - a[po + 1], c[po + 2] - a[po + 2])) < MINE) return true;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4 - i; j++) {
      if ((i === 4) || (j === 4) || (i + j === 0)) continue;
      const wa = i / 4, wb = j / 4, wc = 1 - wa - wb, u = a[po] * wa + b[po] * wb + c[po] * wc, v = a[po + 2] * wa + b[po + 2] * wb + c[po + 2] * wc;
      if (inside && !inside(u, v)) continue;      // (what lies outside is not held rigid: no need for it to be cut)
      if (Math.abs(H(u, v) - (a[W] * wa + b[W] * wb + c[W] * wc)) > TOL) return false;
    }
    return true;
  };
  const out = []; let touched = false;
  const stack = [];
  for (let t = 0; t < n0; t += 3) {
    const a = rec(t), b = rec(t + 1), c = rec(t + 2);
    if ((inside && !inside(a[po], a[po + 2]) && !inside(b[po], b[po + 2]) && !inside(c[po], c[po + 2])) || flat(a, b, c)) { out.push(a, b, c); continue; }
    touched = true; stack.length = 0; stack.push(a, b, c);
    let made = 0;
    while (stack.length) {
      const C = stack.pop(), Bv = stack.pop(), Av = stack.pop();
      if (made > 900 || flat(Av, Bv, C)) { out.push(Av, Bv, C); made++; continue; }
      // the lattice line that crosses it nearest the middle of its widest family
      let bf = -1, bk = 0, bw = 0, fa = 0, fb = 0, fc = 0;
      for (let f = 0; f < 3; f++) {
        const va = fam[f](Av[po], Av[po + 2]), vb = fam[f](Bv[po], Bv[po + 2]), vc = fam[f](C[po], C[po + 2]), lo = Math.min(va, vb, vc), hi = Math.max(va, vb, vc);
        const k0 = Math.ceil(lo + 1e-5), k1 = Math.floor(hi - 1e-5);
        if (k0 > k1 || hi - lo <= bw) continue;
        bf = f; bw = hi - lo; bk = Math.round((lo + hi) / 2); if (bk < k0) bk = k0; else if (bk > k1) bk = k1; fa = va; fb = vb; fc = vc;
      }
      if (bf < 0) { out.push(Av, Bv, C); made++; continue; }
      const V = [Av, Bv, C], d = [fa - bk, fb - bk, fc - bk], s = d.map((x) => (x > 1e-6 ? 1 : x < -1e-6 ? -1 : 0));
      const np = s.filter((x) => x > 0).length, nn = s.filter((x) => x < 0).length;
      if (!np || !nn) { out.push(Av, Bv, C); made++; continue; }
      if (np === 1 && nn === 1) {      // the line passes through a corner: two pieces
        const r = s.indexOf(0), X = V[r], Y = V[(r + 1) % 3], Z = V[(r + 2) % 3], m = mix(Y, Z, d[(r + 1) % 3] / (d[(r + 1) % 3] - d[(r + 2) % 3]));
        stack.push(X, Y, m, X, m, Z); continue;
      }
      const r = np === 1 ? s.indexOf(1) : s.indexOf(-1), X = V[r], Y = V[(r + 1) % 3], Z = V[(r + 2) % 3], dx = d[r], dy = d[(r + 1) % 3], dz = d[(r + 2) % 3];
      const p = mix(X, Y, dx / (dx - dy)), q = mix(X, Z, dx / (dx - dz));
      stack.push(X, p, q, p, Y, Z, p, Z, q);
    }
  }
  if (!touched) return 0;
  const n1 = out.length;
  let o = 0;
  for (let a = 0; a < A.length; a++) {
    const k = size[a], arr = new A[a].array.constructor(n1 * k);
    for (let i = 0; i < n1; i++) for (let q = 0; q < k; q++) arr[i * k + q] = out[i][o + q];
    o += k;
    geo.setAttribute(names[a], new A[a].constructor(arr, k, A[a].normalized));
  }
  return (n1 - n0) / 3;
}
