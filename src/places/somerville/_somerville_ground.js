// Somerville College, STANDALONE model: DRAPING. The site is not level (it falls 3.3 m from Woodstock Road to Walton
// Street), so no lawn, path or court is drawn flat: every ground polygon is laid on the surveyed surface
// (_somerville_shared.js groundY: LIDAR 2022 on a 2 m grid, two planar triangles a cell) by cutting it along the
// grid's own triangles. Two drapes of different rings with different lifts are therefore exactly parallel sheets.
//   drape(B, key, ring, dy, o)      a LOCAL ring [[u, v], ...] (any winding, may be concave) drawn in ground key `key`
//                                   at groundY + dy.  o.y = (u, v) => y replaces the surveyed surface (a levelled
//                                   terrace, a ramp), o.holes = [ring, ...] are left open, o.uv = metres per repeat (3).
//   strip(B, key, line, w, dy, o)   a path: the polyline [[u, v], ...] widened to w and draped.
//   edgeDown(B, key, ring, dy, depth)   a skirt from the draped ring's edge down `depth` (a kerb's or a terrace's face)
import * as THREE from 'three';
import { GROUND_GRID as G, groundY } from './_somerville_shared.js';

// clip polygon P (array of [u, v]) to the half plane a*u + b*v <= c
function clip(P, a, b, c) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
const area = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
function inRing(a, b, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const p = ring[i], q = ring[j]; if ((p[1] > b) !== (q[1] > b) && a < ((q[0] - p[0]) * (b - p[1])) / (q[1] - p[1]) + p[0]) c = !c; } return c; }

export function drape(B, key, ring, dy = 0, o = {}) {
  const yf = o.y || groundY, m = o.uv || 3, holes = o.holes || [];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of ring) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
  const S = G.STEP, i0 = Math.floor((u0 - G.U0) / S), i1 = Math.ceil((u1 - G.U0) / S), j0 = Math.floor((v0 - G.V0) / S), j1 = Math.ceil((v1 - G.V0) / S);
  const emit = (P) => {
    if (P.length < 3 || Math.abs(area(P)) < 1e-4) return;
    const T = P.length === 3 ? [[0, 1, 2]] : THREE.ShapeUtils.triangulateShape(P.map((p) => new THREE.Vector2(p[0], p[1])), []);
    for (const t of T) {
      let a = P[t[0]], b = P[t[1]], c = P[t[2]];
      const cu = (a[0] + b[0] + c[0]) / 3, cv = (a[1] + b[1] + c[1]) / 3;
      if (P.length > 3 && !inRing(cu, cv, ring)) continue;
      if (holes.some((h) => inRing(cu, cv, h))) continue;
      if ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]) < 0) { const x = b; b = c; c = x; }      // (so the face looks up: x east, z south)
      B.tri(key, [a[0], yf(a[0], a[1]) + dy, a[1]], [c[0], yf(c[0], c[1]) + dy, c[1]], [b[0], yf(b[0], b[1]) + dy, b[1]], [a[0] / m, a[1] / m], [c[0] / m, c[1] / m], [b[0] / m, b[1] / m]);
    }
  };
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const a = G.U0 + i * S, b = G.V0 + j * S;
    let P = clip(clip(clip(clip(ring, 1, 0, a + S), -1, 0, -a), 0, 1, b + S), 0, -1, -b);
    if (P.length < 3) continue;
    // the cell's two triangles: below the diagonal (u - a >= v - b) and above it
    emit(clip(P, -1, 1, b - a)); emit(clip(P, 1, -1, a - b));
  }
}

export function strip(B, key, line, w, dy = 0.03, o = {}) {
  for (let i = 0; i < line.length - 1; i++) {
    const p = line[i], q = line[i + 1], du = q[0] - p[0], dv = q[1] - p[1], l = Math.hypot(du, dv); if (l < 0.01) continue;
    const nu = (-dv / l) * w / 2, nv = (du / l) * w / 2, e = i < line.length - 2 ? w / 2 : 0;      // (run on half a width at a bend so the corner is filled)
    drape(B, key, [[p[0] - nu, p[1] - nv], [q[0] + (du / l) * e - nu, q[1] + (dv / l) * e - nv], [q[0] + (du / l) * e + nu, q[1] + (dv / l) * e + nv], [p[0] + nu, p[1] + nv]], dy, o);
  }
}

export function edgeDown(B, key, ring, dy, depth, o = {}) {
  const yf = o.y || groundY;
  let ar = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; ar += p[0] * q[1] - q[0] * p[1]; }
  const R = ar > 0 ? ring : ring.slice().reverse();
  for (let i = 0; i < R.length; i++) {
    const p = R[i], q = R[(i + 1) % R.length], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / G.STEP));
    for (let k = 0; k < n; k++) {
      const a = [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n], b = [p[0] + ((q[0] - p[0]) * (k + 1)) / n, p[1] + ((q[1] - p[1]) * (k + 1)) / n];
      const ya = yf(a[0], a[1]) + dy, yb = yf(b[0], b[1]) + dy;
      B.poly(key, [[a[0], ya - depth, a[1]], [b[0], yb - depth, b[1]], [b[0], yb, b[1]], [a[0], ya, a[1]]], [q[1] - p[1], 0, -(q[0] - p[0])]);
    }
  }
}
