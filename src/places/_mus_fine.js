// Museums, visual pass: smooth-shaded primitives that push straight into a Geo collector (the Geo of _randolph_kit.js
// is flat-shaded triangle soup; columns, bones, statues and pots want rounded normals), plus a few canvas helpers.
// Everything honours the Geo's current transform and colour, so a piece built here lands in the same merged mesh.
import * as THREE from 'three';
import { canvas, canvasTexture } from './_randolph_kit.js';
import { srng } from './_mus_logic.js';

const _v = new THREE.Vector3(), _n = new THREE.Vector3();
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3();

/** vertex record: [px,py,pz, nx,ny,nz, u,v, shade] in the Geo's current frame */
function emit(G, key, a, b, c) {
  const P = G._p(key), m = G.m, col = G.col;
  _pa.set(a[0], a[1], a[2]); _pb.set(b[0], b[1], b[2]); _pc.set(c[0], c[1], c[2]);
  _e1.subVectors(_pb, _pa); _e2.subVectors(_pc, _pa); _e1.cross(_e2);
  if (_e1.lengthSq() < 1e-14) return;
  // wind the triangle to agree with its vertex normals
  const flip = _e1.x * (a[3] + b[3] + c[3]) + _e1.y * (a[4] + b[4] + c[4]) + _e1.z * (a[5] + b[5] + c[5]) < 0;
  for (const q of flip ? [a, c, b] : [a, b, c]) {
    _v.set(q[0], q[1], q[2]).applyMatrix4(m); _n.set(q[3], q[4], q[5]).transformDirection(m);
    P.pos.push(_v.x, _v.y, _v.z); P.nor.push(_n.x, _n.y, _n.z); P.uv.push(q[6], q[7]);
    const s = q[8] === undefined ? 1 : q[8]; P.col.push(col[0] * s, col[1] * s, col[2] * s);
  }
}
function quad(G, key, a, b, c, d) { emit(G, key, a, b, c); emit(G, key, a, c, d); }

/**
 * A surface of revolution about the vertical through (cx, cz): prof = [[r, y], ...] bottom to top (repeat a point for
 * a crease). o: { sx, sz (ellipse), mod(a, i) -> radius multiplier, shade(a, i) -> colour multiplier, u0, u1 (u range
 * once round; default metric), vs (v per metre, default 1), mirrorU (u runs u0->u1->u0: no seam in an atlas column),
 * capTop, capBot, a0, a1 (partial sweep), uv: [u, v] (pin every vertex to one texel of an atlas; with u0/u1 only v is pinned) }
 */
export function lathe(G, key, cx, y0, cz, prof, seg = 12, o = {}) {
  const sx = o.sx || 1, sz = o.sz || 1, a0 = o.a0 || 0, a1 = o.a1 === undefined ? Math.PI * 2 : o.a1, vs = o.vs || 1;
  const rings = [];
  for (let i = 0; i < prof.length; i++) {
    const p = prof[i], pp = prof[Math.max(0, i - 1)], pn = prof[Math.min(prof.length - 1, i + 1)];
    // a crease: use the one-sided slope so the two copies of the point get different normals
    let dr, dy;
    if (i > 0 && pp[0] === p[0] && pp[1] === p[1]) { dr = pn[0] - p[0]; dy = pn[1] - p[1]; }
    else if (i < prof.length - 1 && pn[0] === p[0] && pn[1] === p[1]) { dr = p[0] - pp[0]; dy = p[1] - pp[1]; }
    else { dr = pn[0] - pp[0]; dy = pn[1] - pp[1]; }
    const l = Math.hypot(dr, dy) || 1, nr = dy / l, ny = -dr / l, ring = [];
    for (let k = 0; k <= seg; k++) {
      const t = k / seg, a = a0 + (a1 - a0) * t, ca = Math.cos(a), sa = Math.sin(a);
      const r = p[0] * (o.mod ? o.mod(a, i) : 1);
      let u; if (o.u0 !== undefined) { const tt = o.mirrorU ? 1 - Math.abs(1 - 2 * t) : t; u = o.u0 + (o.u1 - o.u0) * tt; } else u = a * Math.max(p[0], 0.05);
      const nl = Math.hypot(nr * ca / sx, ny, nr * sa / sz) || 1;
      const vv = o.vmap ? o.vmap[0] + (p[1] - prof[0][1]) * o.vmap[1] : o.uv ? o.uv[1] : (y0 + p[1]) * vs; if (o.uv && o.u0 === undefined) u = o.uv[0];
      ring.push([cx + ca * r * sx, y0 + p[1], cz + sa * r * sz, (nr * ca / sx) / nl, ny / nl, (nr * sa / sz) / nl, u, vv, o.shade ? o.shade(a, i) : 1]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    if (prof[i][0] === prof[i + 1][0] && prof[i][1] === prof[i + 1][1]) continue;
    for (let k = 0; k < seg; k++) quad(G, key, rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]);
  }
  const cu = o.uv ? o.uv[0] : 0, cv = o.uv ? o.uv[1] : 0;
  const cap = (ring, y, ny) => { for (let k = 0; k < seg; k++) emit(G, key, [cx, y, cz, 0, ny, 0, cu, cv, ring[k][8]], [ring[k][0], ring[k][1], ring[k][2], 0, ny, 0, cu, cv, ring[k][8]], [ring[k + 1][0], ring[k + 1][1], ring[k + 1][2], 0, ny, 0, cu, cv, ring[k][8]]); };
  if (o.capTop) cap(rings[rings.length - 1], y0 + prof[prof.length - 1][1], 1);
  if (o.capBot) cap(rings[0], y0 + prof[0][1], -1);
}

/** an ellipsoid centred (x, y, z) with radii (rx, ry, rz) */
export function ball(G, key, x, y, z, rx, ry = rx, rz = rx, seg = 8, rings = 5, o = {}) {
  const prof = []; for (let i = 0; i <= rings; i++) { const t = (i / rings) * Math.PI; prof.push([Math.max(1e-4, Math.sin(t)), -Math.cos(t) * (ry / rx)]); }
  lathe(G, key, x, y, z, prof.map((p) => [p[0] * rx, p[1] * rx]), seg, { sz: rz / rx, ...o });
}

/**
 * A tube swept along pts ([x,y,z]...): radius r (number or fn(t 0..1)); seg sides; o: { f (flatten: width across the
 * `up` axis = r, along it = r*f), up [x,y,z] (reference for the section's second axis), caps, shade(t, k), closed }
 */
export function tube(G, key, pts, r, seg = 6, o = {}) {
  const n = pts.length, up0 = new THREE.Vector3(...(o.up || [0, 1, 0])), f = o.f === undefined ? 1 : o.f;
  const T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), rings = [];
  let len = 0; const cum = [0]; for (let i = 1; i < n; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); cum.push(len); }
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    T.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    B.crossVectors(T, up0); if (B.lengthSq() < 1e-6) B.crossVectors(T, _v.set(1, 0, 0)); B.normalize();
    N.crossVectors(B, T).normalize();
    const t = len ? cum[i] / len : 0, rr = typeof r === 'function' ? r(t) : r, ring = [];
    for (let k = 0; k <= seg; k++) {
      const an = (k / seg) * Math.PI * 2 + (o.phase || 0), ca = Math.cos(an), sa = Math.sin(an);
      const nx = B.x * ca * f + N.x * sa, ny = B.y * ca * f + N.y * sa, nz = B.z * ca * f + N.z * sa, nl = Math.hypot(nx, ny, nz) || 1;
      ring.push([pts[i][0] + (B.x * ca + N.x * sa * f) * rr, pts[i][1] + (B.y * ca + N.y * sa * f) * rr, pts[i][2] + (B.z * ca + N.z * sa * f) * rr, nx / nl, ny / nl, nz / nl, o.uv ? o.uv[0] : k / seg, o.uv ? o.uv[1] : cum[i], o.shade ? o.shade(t, k) : 1]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) quad(G, key, rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]);
  if (o.caps !== false) for (const [ring, p, sgn, i] of [[rings[0], pts[0], -1, 0], [rings[n - 1], pts[n - 1], 1, n - 1]]) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; T.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize().multiplyScalar(sgn);
    const cu = o.uv ? o.uv[0] : 0, cv = o.uv ? o.uv[1] : 0;
    for (let k = 0; k < seg; k++) emit(G, key, [p[0], p[1], p[2], T.x, T.y, T.z, cu, cv, ring[k][8]], [ring[k][0], ring[k][1], ring[k][2], T.x, T.y, T.z, cu, cv, ring[k][8]], [ring[k + 1][0], ring[k + 1][1], ring[k + 1][2], T.x, T.y, T.z, cu, cv, ring[k][8]]);
  }
}

/** a smooth strip through cross-sections: secs = [[ [x,y,z], ... ], ...] (same count each), normals from the grid */
export function loft(G, key, secs, o = {}) {
  const R = secs.length, C = secs[0].length, closed = o.closed !== false, V = [];
  const at = (i, k) => secs[Math.max(0, Math.min(R - 1, i))][closed ? (k + C) % C : Math.max(0, Math.min(C - 1, k))];
  for (let i = 0; i < R; i++) {
    const row = [];
    for (let k = 0; k < (closed ? C + 1 : C); k++) {
      const p = at(i, k), a = at(i - 1, k), b = at(i + 1, k), c = at(i, k - 1), d = at(i, k + 1);
      _e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _e2.set(d[0] - c[0], d[1] - c[1], d[2] - c[2]); _e1.cross(_e2);
      if (_e1.lengthSq() < 1e-12) _e1.set(0, 1, 0); _e1.normalize();
      // orient away from the section's centroid
      let mx = 0, my = 0, mz = 0; for (const q of secs[i]) { mx += q[0]; my += q[1]; mz += q[2]; } mx /= C; my /= C; mz /= C;
      if (o.hint) { if (_e1.x * o.hint[0] + _e1.y * o.hint[1] + _e1.z * o.hint[2] < 0) _e1.multiplyScalar(-1); }
      else if (o.orient !== false && _e1.x * (p[0] - mx) + _e1.y * (p[1] - my) + _e1.z * (p[2] - mz) < 0) _e1.multiplyScalar(-1);
      row.push([p[0], p[1], p[2], _e1.x, _e1.y, _e1.z, k / C, i / (R - 1), o.shade ? o.shade(i, k) : 1]);
    }
    V.push(row);
  }
  for (let i = 0; i < R - 1; i++) for (let k = 0; k < V[i].length - 1; k++) quad(G, key, V[i][k], V[i][k + 1], V[i + 1][k + 1], V[i + 1][k]);
  if (o.caps) for (const [i, s] of [[0, -1], [R - 1, 1]]) {
    let mx = 0, my = 0, mz = 0; for (const q of secs[i]) { mx += q[0]; my += q[1]; mz += q[2]; } mx /= C; my /= C; mz /= C;
    const j = i === 0 ? 1 : R - 2; let ax = 0, ay = 0, az = 0; for (const q of secs[j]) { ax += q[0]; ay += q[1]; az += q[2]; }
    _e1.set(mx - ax / C, my - ay / C, mz - az / C).normalize(); void s;
    for (let k = 0; k < C; k++) { const a = secs[i][k], b = secs[i][(k + 1) % C]; emit(G, key, [mx, my, mz, _e1.x, _e1.y, _e1.z, 0, 0, 1], [a[0], a[1], a[2], _e1.x, _e1.y, _e1.z, 0, 0, 1], [b[0], b[1], b[2], _e1.x, _e1.y, _e1.z, 0, 0, 1]); }
  }
}

/** a planar polygon with explicit uv = (p . U, p . V) on two axes given as [x,y,z,offset] — textures that must line up */
export function polyUV(G, key, pts, hint, U, V) {
  G.poly(key, pts, hint, pts.map((p) => [p[0] * U[0] + p[1] * U[1] + p[2] * U[2] + (U[3] || 0), p[0] * V[0] + p[1] * V[1] + p[2] * V[2] + (V[3] || 0)]));
}

/** points of a two-centred pointed arch from (x0, ys) to (x1, ys) rising to ya at the middle: [[x, y], ...] (2n+1) */
export function pointedArch(x0, x1, ys, ya, n = 8) {
  const hw = (x1 - x0) / 2, h = ya - ys, xm = (x0 + x1) / 2;
  // each half is an arc of radius R centred on the springing line at distance R from its own springing point
  const R = (hw * hw + h * h) / (2 * hw), th = Math.asin(Math.min(1, h / R)), out = [];
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * th;
    if (h < hw) { const b = (k / n) * Math.PI / 2; out.push([x0 + hw * (1 - Math.cos(b)), ys + h * Math.sin(b)]); }   // too flat to be two-centred: a quarter ellipse
    else out.push([x0 + R - R * Math.cos(a), ys + R * Math.sin(a)]);
  }
  for (let k = n - 1; k >= 0; k--) { const p = out[k]; out.push([2 * xm - p[0], p[1]]); }
  return out;
}

/** paint soft mottling / speckle over a canvas area (stone, plaster, bone) */
export function mottle(g, x, y, w, h, r, n = 300, a = 0.05, s = 14) {
  for (let i = 0; i < n; i++) { const d = r() < 0.5; g.fillStyle = d ? `rgba(0,0,0,${a * r()})` : `rgba(255,255,255,${a * r()})`; const q = s * (0.3 + r()); g.beginPath(); g.ellipse(x + r() * w, y + r() * h, q, q * (0.4 + r() * 0.6), r() * 3.14, 0, 6.3); g.fill(); }
}

export { canvas, canvasTexture, srng };
