// Drawing helpers of places/worcester_snsc.js over the college's Batch (_worcester_kit.js): the building's own frame
// (a along the front, y up, b into the building), walls with level courses, clipped sloping surfaces.
import * as THREE from 'three';
import { frame } from './_worcester_kit.js';
import { O, D } from './_snsc_plan.js';

const area2 = (p) => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]; return s / 2; };
/** the part of a polygon on one side of the line (axis = 0: u, 1: v) = c; sign +1 keeps the greater side */
function clip(poly, axis, c, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = sign * (a[axis] - c), db = sign * (b[axis] - c);
    if (da >= 0) out.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
/** a polygon cut along the lines u = cu[i] and v = cv[j]: the pieces (neighbours share their cut vertices: no cracks) */
export function cutPoly(poly, cu = [], cv = []) {
  let pieces = [poly];
  const split = (axis, c) => { const out = []; for (const p of pieces) for (const s of [-1, 1]) { const q = clip(p, axis, c, s); if (q.length >= 3 && Math.abs(area2(q)) > 1e-5) out.push(q); } pieces = out; };
  for (const c of cu) split(0, c);
  for (const c of cv) split(1, c);
  return pieces;
}
export const steps = (lo, hi, d) => { const out = []; for (let v = Math.ceil(lo / d + 1e-6) * d; v < hi - 1e-6; v += d) out.push(v); return out; };
/** a simple polygon moved inwards by d[i] along edge i (i: from point i to point i + 1), mitred; the ring is counter-clockwise */
export function inset(poly, d) {
  const n = poly.length, out = [];
  const line = (i) => { const p = poly[i], q = poly[(i + 1) % n], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = -(q[1] - p[1]) / l, ny = (q[0] - p[0]) / l; return [p[0] + nx * d[i], p[1] + ny * d[i], (q[0] - p[0]) / l, (q[1] - p[1]) / l]; };
  for (let i = 0; i < n; i++) {
    const A = line((i + n - 1) % n), Bn = line(i), den = A[2] * Bn[3] - A[3] * Bn[2];
    if (Math.abs(den) < 1e-6) { out.push([Bn[0], Bn[1]]); continue; }
    const t = ((Bn[0] - A[0]) * Bn[3] - (Bn[1] - A[1]) * Bn[2]) / den;
    out.push([A[0] + A[2] * t, A[1] + A[3] * t]);
  }
  return out;
}

export function tools(B) {
  const FR = frame(O[0], 0, O[1], D[0], D[1]);      // local x = a, local z = -b (outwards, south-west)
  let bayN = 0;
  const T = {
    FR,
    inFrame(fn) { B.push(FR); try { fn(); } finally { B.pop(); } },
    /** a fresh integer bay for a pane of glass (the atlas shader lights each on its own at night) */
    bay() { bayN++; return [300 + (bayN * 7) % 211, (bayN * 3) % 5]; },
    /** polygon through points [a, y, b] */
    q(key, pts, hint, uvs) { B.poly(key, pts.map((p) => [p[0], p[1], -p[2]]), hint ? [hint[0], hint[1], -hint[2]] : null, uvs); },
    /** the same for an upright face: u along it, v = height, so the courses run level whatever the outline */
    vq(key, pts, hint) {
      const p0 = pts[0]; let far = pts[1], fd = 0;
      for (const p of pts) { const dd = Math.hypot(p[0] - p0[0], p[2] - p0[2]); if (dd > fd) { fd = dd; far = p; } }
      const ux = (far[0] - p0[0]) / (fd || 1), uz = (far[2] - p0[2]) / (fd || 1);
      T.q(key, pts, hint, pts.map((p) => [(p[0] - p0[0]) * ux + (p[2] - p0[2]) * uz, p[1]]));
    },
    bx(key, a0, a1, y0, y1, b0, b1, o) { B.boxXZ(key, a0, a1, y0, y1, -b1, -b0, o); },
    fl(key, pts, y, holes = [], down = false) { B.flat(key, pts.map((p) => [p[0], -p[1]]), y, holes.map((h) => h.map((p) => [p[0], -p[1]])), down); },
    /** a wall's own frame from A to B (frame coordinates): s along it, y up, z outwards = to the right of A -> B */
    wall(A, Bp, fn) { const l = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]); B.push(frame(A[0], 0, -A[1], Bp[0] - A[0], -(Bp[1] - A[1]))); try { fn(l); } finally { B.pop(); } },
    /** a pane of the dark mirror glass in the current wall frame */
    pane(s0, y0, s1, y1, z = 0) { const b = T.bay(); B.poly('snscGlass', [[s0, y0, z], [s1, y0, z], [s1, y1, z], [s0, y1, z]], [0, 0, 1], [[b[0] + 0.16, b[1] + 0.79], [b[0] + 0.27, b[1] + 0.79], [b[0] + 0.27, b[1] + 0.87], [b[0] + 0.16, b[1] + 0.87]]); },
    /** a bronze-framed window in the current wall frame: frame plate at z, panes just proud of it; cols lights, a transom at tr (height), bar width m */
    win(s0, y0, s1, y1, o = {}) {
      const z = o.z || 0, m = o.bar || 0.07, cols = o.cols || 1, tr = o.tr || 0;
      B.poly(o.frame || 'snscBronze', [[s0, y0, z], [s1, y0, z], [s1, y1, z], [s0, y1, z]], [0, 0, 1]);
      const w = (s1 - s0 - m) / cols, yt = tr ? tr : y1;
      for (let i = 0; i < cols; i++) { const a0 = s0 + m + i * w, a1 = a0 + w - m; T.pane(a0, y0 + m, a1, yt - (tr ? m / 2 : m), z + 0.016); if (tr) T.pane(a0, yt + m / 2, a1, y1 - m, z + 0.016); }
    },
    /** an upright face between two points of the ground plan (the current frame's x, z), courses level, facing `toward` [x, z] */
    vface(key, p, q, y0, y1, toward) {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]), mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      const ya = typeof y1 === 'number' ? [y1, y1] : y1;
      B.poly(key, [[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], ya[1], q[1]], [p[0], ya[0], p[1]]], [toward[0] - mx, 0, toward[1] - mz], [[0, y0], [l, y0], [l, ya[1]], [0, ya[0]]]);
    },
    /** a low wall / kerb / board between two ground points: width w, from y0 to y1 */
    lowWall(key, p, q, w, y0, y1, o) { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1])); B.boxXZ(key, 0, l, y0, y1, -w / 2, w / 2, o); B.pop(); },
    /** a flat disc (its own UVs: a cylinder's cap takes them from the coordinates, far from the origin) */
    disc(key, x, y, z, r, n = 8) { B.poly(key, Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [x + Math.cos(t) * r, y, z - Math.sin(t) * r]; }), [0, 1, 0]); },
    /** a clipped mound of leaves */
    shrub(x, y, z, r, key = 'leafC', h = 1) {
      const R = [0.74, 1.0, 0.88, 0.5], H = [0, 0.32, 0.68, 0.95];
      for (let i = 0; i < 3; i++) B.cyl(key, x, y + H[i] * r * h, z, R[i + 1] * r, (H[i + 1] - H[i]) * r * h, 8, false, R[i] * r);
      T.disc(key, x, y + H[3] * r * h, z, R[3] * r, 8);
    },
    /**
     * A surface over a 2D polygon cut along cu / cv, each piece triangulated, every vertex placed by to3(u, v) -> [x, y, z]
     * in the current frame; uv(u, v) -> metres (default: the coordinates themselves).
     */
    surf(key, poly, to3, o = {}) {
      const uv = o.uv || ((u, v) => [u, v]);
      for (const piece of cutPoly(poly, o.cu || [], o.cv || [])) {
        const tris = THREE.ShapeUtils.triangulateShape(piece.map((p) => new THREE.Vector2(p[0], p[1])), []);
        for (const t of tris) {
          const P3 = t.map((i) => to3(piece[i][0], piece[i][1])), U = t.map((i) => uv(piece[i][0], piece[i][1]));
          const ny = (P3[1][2] - P3[0][2]) * (P3[2][0] - P3[0][0]) - (P3[1][0] - P3[0][0]) * (P3[2][2] - P3[0][2]);
          if (ny > 0) B.tri(key, P3[0], P3[1], P3[2], U[0], U[1], U[2]); else B.tri(key, P3[0], P3[2], P3[1], U[0], U[2], U[1]);
        }
      }
    },
  };
  return T;
}
