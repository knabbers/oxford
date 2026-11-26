// Facade helpers for the district passes (places/cowley_road.js, places/jericho.js): find a mapped building's street
// front, lay things on it in a local frame, check that a pavement spot is clear of the carriageway. Pure apart from the
// Batch it writes into (the batch-4 atlas draw, _b4_kit.js).
import { frame } from './_b4_kit.js';

export const pip = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const distSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
export function centroid(poly) { let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; } return [x / poly.length, z / poly.length]; }
export function signedArea(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }

/** the mapped building with this id, or the (non-part) building containing (x, z) */
export function buildingById(map, id) { return map.buildings.find((b) => b.id === id) || null; }
export function buildingAt(map, x, z) { for (const b of map.buildings) { if (b.part || Math.abs(b.c[0] - x) > 60 || Math.abs(b.c[1] - z) > 60) continue; if (pip(x, z, b.poly)) return b; } return null; }

/**
 * The edges of a footprint as faces seen from outside: {a, b, L, mx, mz, ux, uz (along, viewer's left -> right),
 * nx, nz (outward)}. Works for either winding.
 */
export function faces(poly) {
  const out = [], s = signedArea(poly) > 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.5) continue;
    const dx = (q[0] - p[0]) / L, dz = (q[1] - p[1]) / L;
    // outward normal: for a positive (x-z) area ring, (dz, -dx) points out
    let nx = dz * s, nz = -dx * s;
    // the viewer's right seen from outside (facing -n): (nz, -nx); then frame()'s local +z = (-uz, ux) = n
    const ux = nz, uz = -nx, a = ux * dx + uz * dz > 0 ? p : q, b = a === p ? q : p;
    out.push({ i, a, b, L, mx: (p[0] + q[0]) / 2, mz: (p[1] + q[1]) / 2, ux, uz, nx, nz });
  }
  return out;
}
/** the local frame of a face: origin at its middle on the ground, local x along it (left -> right), local +z outward */
export function faceFrame(f, off = 0) { return frame(f.mx + f.nx * off, 0, f.mz + f.nz * off, f.ux, f.uz); }

/** faces of `poly` that front roads (dist(x, z) -> distance to the road centre lines); within `reach` of the line */
export function streetFaces(poly, dist, reach = 9, minL = 2.5) {
  return faces(poly).filter((f) => f.L >= minL && dist(f.mx + f.nx * 3, f.mz + f.nz * 3) < dist(f.mx - f.nx * 1, f.mz - f.nz * 1) && dist(f.mx, f.mz) < reach);
}
/** distance to the nearest road of `names` (map roads), as a function */
export function roadDist(map, names) {
  const rs = map.roads.filter((r) => names.includes(r.name));
  return (x, z) => { let d = Infinity; for (const r of rs) for (let i = 0; i < r.pts.length - 1; i++) d = Math.min(d, distSeg(x, z, r.pts[i], r.pts[i + 1]) - (r.w || 6) / 2); return d; };
}
/** is (x, z) off every drawn carriageway (by `clear` m) — map roads that cars use */
const CARS = /^(primary|secondary|tertiary|unclassified|residential|living_street|service|.*_link)$/;
// (Both tests below used to walk every road and every building of the map for each point asked about — 3–4 s of the
//  loading screen between them. Now a grid per map, made at the first question and again if the map's lists have
//  changed length; the answers are the same, the old tests' own shortcuts included.)
const GRID = 40, _idx = new WeakMap();
const cellKey = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);
function indexOf(map) {
  let I = _idx.get(map);
  if (I && I.nr === map.roads.length && I.nb === map.buildings.length) return I;
  I = { nr: map.roads.length, nb: map.buildings.length, segs: new Map(), halfMax: 0, blds: new Map() };
  for (const r of map.roads) {
    if (!CARS.test(r.kind) || r.tunnel) continue;
    const hw = (r.w || 6) / 2; if (hw > I.halfMax) I.halfMax = hw;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const p = r.pts[i], q = r.pts[i + 1], e = { a: p, b: q, hw };
      const x0 = Math.floor(Math.min(p[0], q[0]) / GRID), x1 = Math.floor(Math.max(p[0], q[0]) / GRID), z0 = Math.floor(Math.min(p[1], q[1]) / GRID), z1 = Math.floor(Math.max(p[1], q[1]) / GRID);
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const k = cellKey(ix, iz); let L = I.segs.get(k); if (!L) I.segs.set(k, (L = [])); L.push(e); }
    }
  }
  for (const bd of map.buildings) {
    if (bd.part) continue;
    const k = cellKey(Math.floor(bd.c[0] / GRID), Math.floor(bd.c[1] / GRID)); let L = I.blds.get(k); if (!L) I.blds.set(k, (L = [])); L.push(bd);
  }
  _idx.set(map, I);
  return I;
}
export function offCarriage(map, x, z, clear = 0.5) {
  const I = indexOf(map), R = I.halfMax + Math.max(0, clear) + 0.01;
  const x0 = Math.floor((x - R) / GRID), x1 = Math.floor((x + R) / GRID), z0 = Math.floor((z - R) / GRID), z1 = Math.floor((z + R) / GRID);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const L = I.segs.get(cellKey(ix, iz)); if (!L) continue;
    for (let i = 0; i < L.length; i++) { const e = L[i], a = e.a, b = e.b; if (Math.abs(a[0] - x) > 80 && Math.abs(b[0] - x) > 80) continue; if (distSeg(x, z, a, b) < e.hw + clear) return false; }
  }
  return true;
}
/** is (x, z) clear of every mapped building footprint (by margin) */
export function offBuildings(map, x, z, margin = 0.3) {
  const I = indexOf(map);
  const x0 = Math.floor((x - 50) / GRID), x1 = Math.floor((x + 50) / GRID), z0 = Math.floor((z - 50) / GRID), z1 = Math.floor((z + 50) / GRID);
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const L = I.blds.get(cellKey(ix, iz)); if (!L) continue;
    for (let n = 0; n < L.length; n++) {
      const b = L[n];
      if (Math.abs(b.c[0] - x) > 50 || Math.abs(b.c[1] - z) > 50) continue;
      if (pip(x, z, b.poly)) return false;
      for (let i = 0; i < b.poly.length; i++) if (distSeg(x, z, b.poly[i], b.poly[(i + 1) % b.poly.length]) < margin) return false;
    }
  }
  return true;
}
/** split a face of length L into shop units about `w` m wide -> [[x0, x1]] in face-local x (centred) */
export function units(L, w = 4.6, gap = 0.35) { const n = Math.max(1, Math.round(L / w)), u = L / n, out = []; for (let k = 0; k < n; k++) out.push([-L / 2 + k * u + gap, -L / 2 + (k + 1) * u - gap]); return out; }
/** merge neighbouring faces that are nearly in line (a front mapped as two or three segments) */
export function mergeFaces(fs, cos = 0.97) {
  const out = fs.slice().sort((p, q) => p.i - q.i), res = [];
  for (const f of out) {
    const last = res[res.length - 1];
    if (last && last.nx * f.nx + last.nz * f.nz > cos && (Math.hypot(last.b[0] - f.a[0], last.b[1] - f.a[1]) < 0.05 || Math.hypot(last.a[0] - f.b[0], last.a[1] - f.b[1]) < 0.05)) {
      const a = Math.hypot(last.b[0] - f.a[0], last.b[1] - f.a[1]) < 0.05 ? last.a : f.a, b = a === last.a ? f.b : last.b;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      res[res.length - 1] = { i: f.i, a, b, L, mx: (a[0] + b[0]) / 2, mz: (a[1] + b[1]) / 2, ux, uz, nx: -uz, nz: ux };
    } else res.push(f);
  }
  return res;
}
