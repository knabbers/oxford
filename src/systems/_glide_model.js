// Glider model: a modern glass two-seat club trainer in the ASK 21 mould (no real markings): 17 m slender double-tapered
// wings with 4° dihedral and a little built-in bend, a pod-and-boom fuselage, T-tail, a long two-piece bubble canopy
// with its frame and roll-over hoop, a cockpit you can see into (tub, seats, sticks, instrument binnacles with three
// live dials), Schempp-Hirth airbrake paddles that rise out of the upper wing, moving ailerons / elevator / rudder,
// wing flex under load, a main wheel in its fairing, nose skid, tail wheel and wing-tip skids. White gelcoat with a
// sky-reflecting fresnel sheen and a sun glint; the trim colour (nose, cheat line, wing tips, fin) tells the two
// gliders apart, and the rudder carries one or two plain bars instead of a number.
//
// build({trim: 0xRRGGBB, number: '1'}) -> {group, parts, dispose()}
//   group origin = the centre of gravity (sits wheelH = 0.62 m above the ground on its wheel); model faces +z, +x = left
//   parts: {wingL, wingR (outer panels: rotate .rotation.z for flex), ailL, ailR, elev, rud, abL, abR (airbrake paddles:
//           .position.y = deployed height), canopy, seatFront, seatRear (Object3D: where a pilot's hips go),
//           dummyFront, dummyRear (seated figures for remote players' gliders), far (single merged mesh for LOD),
//           near (Group of everything else), body, stick, string (yaw string), needles {asi, alt, vario}}
//   pose(parts, {ail, elev, rud, ab, flex, lod, V, alt, te, beta, t, cockpit}) moves the control surfaces and the cockpit
//   bits (drawn only with cockpit: true — the view from inside this glider)
// Cost: near = 12 draws / ~5.6k triangles in TWO programs (one for everything opaque: gloss rides in the vertex colour's
// alpha; one for the canopy) plus the dial faces; far (beyond ~180 m) = 1 draw / ~500 triangles.
import * as THREE from 'three';

export const DIM = { span: 17, length: 8.35, wheelH: 0.62, seatFront: [0, -0.22, 1.55], seatRear: [0, -0.12, 0.55], eyeFront: [0, 0.66, 1.33] };

const D2R = Math.PI / 180;
const WHITE = [0.9, 0.91, 0.92, 1], OFFW = [0.8, 0.81, 0.82, 0.6], DARK = [0.035, 0.037, 0.042, 0], TUB = [0.1, 0.105, 0.115, 0], TYRE = [0.02, 0.02, 0.022, 0], ALU = [0.5, 0.52, 0.55, 0.5], SEAT = [0.07, 0.11, 0.2, 0];
const hexRGB = (h, a = 1) => [Math.pow(((h >> 16) & 255) / 255, 2.2), Math.pow(((h >> 8) & 255) / 255, 2.2), Math.pow((h & 255) / 255, 2.2), a];

/** the sky the gelcoat reflects (uniform holders; gliding.js links the world's own with linkEnv) */
export const ENV = { zen: { value: new THREE.Color(0.2, 0.4, 0.8) }, hor: { value: new THREE.Color(0.7, 0.8, 0.9) }, sun: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, sunCol: { value: new THREE.Color(1, 1, 1) }, night: { value: 0 } };
export function linkEnv(U) { if (!U) return; if (U.skyZen) ENV.zen = U.skyZen; if (U.skyHor) ENV.hor = U.skyHor; if (U.sunDir) ENV.sun = U.sunDir; if (U.sunColor) ENV.sunCol = U.sunColor; if (U.night) ENV.night = U.night; }

// ---------------------------------------------------------------- geometry accumulation
// A Part collects flat arrays (non-indexed, smooth normals from each surface's own indexed build, colour per FACE so
// trim edges are crisp). surface(): indexed positions + triangles + a colour per triangle; oriented outwards by itself.
class Part {
  constructor() { this.p = []; this.n = []; this.c = []; }
  surface(pos, idx, cols, { flip = null, smooth = true } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    // orientation: triangles should face away from the surface's centroid (closed, roughly convex shapes)
    if (flip === null) {
      let cx = 0, cy = 0, cz = 0; const nv = pos.length / 3;
      for (let i = 0; i < pos.length; i += 3) { cx += pos[i]; cy += pos[i + 1]; cz += pos[i + 2]; }
      cx /= nv; cy /= nv; cz /= nv;
      let s = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        s += nx * ((pos[a] + pos[b] + pos[c]) / 3 - cx) + ny * ((pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - cy) + nz * ((pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - cz);
      }
      flip = s < 0;
    }
    if (flip) { for (let t = 0; t < idx.length; t += 3) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; } g.setIndex(idx); }
    g.computeVertexNormals();
    const N = g.attributes.normal.array;
    for (let t = 0; t < idx.length; t += 3) {
      const col = cols[t / 3] || WHITE;
      let fx = 0, fy = 0, fz = 0;
      if (!smooth) {
        const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        fx = uy * vz - uz * vy; fy = uz * vx - ux * vz; fz = ux * vy - uy * vx; const l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l;
      }
      for (let k = 0; k < 3; k++) {
        const i = idx[t + k] * 3;
        this.p.push(pos[i], pos[i + 1], pos[i + 2]);
        if (smooth) this.n.push(N[i], N[i + 1], N[i + 2]); else this.n.push(fx, fy, fz);
        this.c.push(col[0], col[1], col[2], col[3]);
      }
    }
    g.dispose();
    return this;
  }
  /** a three geometry (box, cylinder, sphere…) in one colour, after an optional matrix */
  geo(g, col, m = null) {
    if (m) g.applyMatrix4(m);
    const gg = g.index ? g.toNonIndexed() : g, P = gg.attributes.position.array, N = gg.attributes.normal.array;
    for (let i = 0; i < P.length; i += 3) { this.p.push(P[i], P[i + 1], P[i + 2]); this.n.push(N[i], N[i + 1], N[i + 2]); this.c.push(col[0], col[1], col[2], col[3]); }
    g.dispose(); if (gg !== g) gg.dispose();
    return this;
  }
  box(w, h, d, x, y, z, col, rx = 0, ry = 0, rz = 0) { return this.geo(new THREE.BoxGeometry(w, h, d), col, MAT(x, y, z, rx, ry, rz)); }
  cyl(r0, r1, len, x, y, z, col, rx = 0, ry = 0, rz = 0, seg = 10) { return this.geo(new THREE.CylinderGeometry(r0, r1, len, seg), col, MAT(x, y, z, rx, ry, rz)); }
  ball(r, x, y, z, col, sx = 1, sy = 1, sz = 1, seg = 10) { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)); g.scale(sx, sy, sz); return this.geo(g, col, MAT(x, y, z)); }
  add(o) { for (const k of ['p', 'n', 'c']) { const a = this[k], b = o[k]; for (let i = 0; i < b.length; i++) a.push(b[i]); } return this; }
  get tris() { return this.p.length / 9; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 4));
    g.computeBoundingSphere();
    return g;
  }
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
function MAT(x, y, z, rx = 0, ry = 0, rz = 0) { return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _one); }

/**
 * Loft through stations {z, w, t, b, yc, p} (half width, top, bottom depth, centre height, squareness of the upper half)
 * with n points round. colour(sMid, i, n) per face; skip(s, i) leaves a face out (the cockpit opening).
 */
function loft(part, st, n, colour, { skip = null, inward = false, shrink = 1 } = {}) {
  const pos = [], idx = [], cols = [];
  const pw = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), 2 / p);
  for (const S of st) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), p = sa >= 0 ? (S.p || 2) : (S.pb || 2);
      pos.push(S.w * shrink * pw(ca, p), (S.yc || 0) + (sa >= 0 ? S.t * pw(sa, p) : S.b * pw(sa, p)) * shrink, S.z);
    }
  }
  for (let s = 0; s < st.length - 1; s++) for (let i = 0; i < n; i++) {
    if (skip && skip(s, i, n)) continue;
    const a = s * n + i, b = s * n + (i + 1) % n, c = a + n, d = b + n, col = colour(s, i, n);
    idx.push(a, c, b, b, c, d); cols.push(col, col);
  }
  // (orientation by hand: the centroid test fails for an open shell) ring runs anticlockwise seen from +z
  part.surface(pos, idx, cols, { flip: !inward });
}

// aerofoil: thickness (NACA 4-digit, closed trailing edge) + a little camber
const yt = (u, t) => 5 * t * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u * u * u - 0.1036 * u * u * u * u);
const ycam = (u, m) => 4 * m * u * (1 - u);
const US_NEAR = [0, 0.012, 0.05, 0.13, 0.27, 0.45, 0.62, 0.76, 0.88, 1], US_FAR = [0, 0.1, 0.35, 0.72, 1];
/**
 * A lifting surface: at(x) -> {le, c, y, t, m} at span position x (leading-edge z, chord, height, thickness ratio,
 * camber), sampled at xs. o: {side ±1, u0, u1 (chord fractions kept), cap0, cap1, colour(xMid, uMid, upper), org [x,y,z]
 * subtracted (hinge frames), up: true = a fin (span runs up +y from the given y0 instead of out along x)}.
 */
function aero(part, at, xs, o = {}) {
  const { side = 1, u0 = 0, u1 = 1, cap0 = false, cap1 = false, colour = () => WHITE, org = [0, 0, 0], up = false, US = US_NEAR } = o;
  const ups = [u0, ...US.filter((u) => u > u0 + 1e-4 && u < u1 - 1e-4), u1];
  const ring = [];                                   // [u, upper?]
  for (const u of ups) ring.push([u, 1]);
  for (let k = ups.length - 1; k >= (u0 === 0 ? 1 : 0); k--) ring.push([ups[k], 0]);
  const R = ring.length, pos = [], idx = [], cols = [];
  const put = (x, S, u, upper) => {
    const th = yt(u, S.t) * S.c, cam = ycam(u, S.m || 0) * S.c;
    const px = side * x, py = S.y + cam + (upper ? th : -th), pz = S.le - u * S.c;
    if (up) pos.push(-(py - S.y) * side - org[0], S.y + x - org[1], pz - org[2]); else pos.push(px - org[0], py - org[1], pz - org[2]);
  };
  for (const x of xs) { const S = at(x); for (const [u, upper] of ring) put(x, S, u, upper); }
  for (let s = 0; s < xs.length - 1; s++) for (let j = 0; j < R; j++) {
    const j2 = (j + 1) % R, a = s * R + j, b = s * R + j2, c = a + R, d = b + R;
    const col = colour((xs[s] + xs[s + 1]) / 2, (ring[j][0] + ring[j2][0]) / 2, ring[j][1] && ring[j2][1]);
    idx.push(a, b, c, b, d, c); cols.push(col, col);
  }
  part.surface(pos, idx, cols);
  for (const [on, s] of [[cap0, 0], [cap1, xs.length - 1]]) {
    if (!on) continue;
    const cp = [], ci = [], cc = [], x = xs[s], S = at(x), col = colour(x, 0.5, true);
    for (const [u, upper] of ring) { const n0 = pos.length; put(x, S, u, upper); cp.push(...pos.splice(n0, 3)); }
    for (let j = 1; j < R - 1; j++) { ci.push(0, j, j + 1); cc.push(col); }
    // faces away from the rest of the surface
    const fl = up ? (s === 0) : (s === 0) === (side > 0);
    part.surface(cp, ci, cc, { flip: up ? !fl : fl, smooth: false });
  }
}

// ---------------------------------------------------------------- the shapes
const DIH = Math.tan(4 * D2R), YW = 0.14, XI = 4.0, TIP = 8.5;
// wing: double taper (1.50 m at the root, 1.14 m at 4 m, 0.50 m at the tip), straight-ish leading edge
function wingAt(x) {
  const t = x <= XI ? x / XI : 1 + (x - XI) / (TIP - XI);        // 0..1 inner, 1..2 outer
  const c = x <= XI ? 1.5 - 0.36 * t : Math.max(0.2, 1.14 - 0.64 * (t - 1) - (x > TIP - 0.12 ? (x - (TIP - 0.12)) * 1.6 : 0));
  const le = x <= XI ? 0.66 - 0.07 * t : 0.59 - 0.2 * (t - 1) - (x > TIP - 0.12 ? (x - (TIP - 0.12)) * 0.9 : 0);
  const bend = x > XI ? 0.011 * (x - XI) * (x - XI) : 0;          // built-in bend of the outer panel
  return { le, c, y: YW + x * DIH + bend, t: 0.17 - 0.02 * Math.min(2, t), m: 0.028 };
}
const outerAt = (xl) => { const S = wingAt(XI + xl); return { ...S, y: S.y - (YW + XI * DIH) }; };   // in the outer panel's pivot frame
const AIL = [0.55, 4.25, 0.77];                    // aileron: from / to (m out along the outer panel), hinge chord fraction
const finAt = (h) => { const t = h / 1.3; return { le: -4.02 - 0.4 * t, c: 1.06 - 0.36 * t, y: 0.1, t: 0.115, m: 0 }; };
const RUD_U = 0.62, ELE_U = 0.66;
const tailAt = (x) => { const t = x / 1.55; return { le: -4.6 - 0.1 * t, c: 0.64 - 0.24 * t, y: 1.4, t: 0.1, m: 0 }; };

const FUS = [
  { z: 3.33, w: 0.012, t: 0.012, b: 0.012, yc: -0.13 }, { z: 3.27, w: 0.09, t: 0.08, b: 0.09, yc: -0.125 }, { z: 3.12, w: 0.175, t: 0.16, b: 0.18, yc: -0.11 },
  { z: 2.9, w: 0.255, t: 0.26, b: 0.27, yc: -0.08 }, { z: 2.66, w: 0.31, t: 0.32, b: 0.33, yc: -0.05, p: 2.6 }, { z: 2.46, w: 0.34, t: 0.335, b: 0.38, yc: -0.04, p: 3.2 },
  { z: 2.0, w: 0.368, t: 0.32, b: 0.435, yc: -0.03, p: 3.6 }, { z: 1.4, w: 0.378, t: 0.31, b: 0.455, yc: -0.02, p: 3.6 }, { z: 0.8, w: 0.372, t: 0.31, b: 0.45, yc: -0.02, p: 3.6 },
  { z: 0.25, w: 0.352, t: 0.31, b: 0.43, yc: -0.02, p: 3.6 }, { z: -0.1, w: 0.33, t: 0.33, b: 0.41, yc: -0.02, p: 3.2 }, { z: -0.24, w: 0.31, t: 0.58, b: 0.4, yc: -0.02, p: 2.4 },
  { z: -0.6, w: 0.275, t: 0.56, b: 0.37, yc: -0.02, p: 2.2 }, { z: -1.1, w: 0.215, t: 0.42, b: 0.29, yc: -0.01 }, { z: -1.8, w: 0.16, t: 0.3, b: 0.2, yc: 0 }, { z: -2.7, w: 0.125, t: 0.22, b: 0.15, yc: 0.01 },
  { z: -3.6, w: 0.1, t: 0.18, b: 0.115, yc: 0.02 }, { z: -4.4, w: 0.08, t: 0.16, b: 0.09, yc: 0.03 }, { z: -4.95, w: 0.055, t: 0.14, b: 0.06, yc: 0.04 }, { z: -5.07, w: 0.015, t: 0.06, b: 0.02, yc: 0.05 },
];
const SILL = 0.285;                                   // canopy sill height
const CAN = [[2.5, 0.03, 0.02], [2.4, 0.16, 0.13], [2.2, 0.255, 0.29], [1.9, 0.315, 0.43], [1.5, 0.345, 0.53], [1.02, 0.355, 0.585], [0.6, 0.35, 0.59], [0.25, 0.33, 0.55], [-0.05, 0.3, 0.42], [-0.22, 0.28, 0.3]];
const canAt = (z) => { for (let i = 0; i < CAN.length - 1; i++) { const a = CAN[i], b = CAN[i + 1]; if (z <= a[0] && z >= b[0]) { const t = (a[0] - z) / (a[0] - b[0]); return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; } } return [0.3, 0.4]; };

function fuselage(part, T, n, far = false) {
  const st = far ? FUS.filter((_, i) => i % 2 === 0 || i === FUS.length - 1) : FUS;
  // cheat line: the ring segments either side of the widest point, from behind the nose cone to the tail
  const line = (i) => { const k = Math.round(n * 0.045); return i < k || i >= n - k || (i >= n / 2 - k && i < n / 2 + k); };
  loft(part, st, n, (s, i) => {
    const z = (st[s].z + st[s + 1].z) / 2;
    if (z > 3.2) return T;                              // a small trim-coloured nose cap (a big red nose fills the cockpit view)
    if (!far && z < -0.3 && z > -4.6 && line(i)) return T;          // cheat line along the boom (not beside the cockpit)
    return WHITE;
  }, { skip: far ? null : (s, i) => { const z = (st[s].z + st[s + 1].z) / 2, a = ((i + 0.5) / n) * Math.PI * 2; return z < 2.46 && z > -0.1 && Math.sin(a) > 0.62; } });
}

function cockpit(part, T) {
  // the tub: the inside of the pod below the sill (dark), a floor, two seats, sticks, the two instrument binnacles
  const st = FUS.filter((S) => S.z <= 2.66 && S.z >= -0.24);
  loft(part, st, 16, () => TUB, { inward: true, shrink: 0.955, skip: (s, i, n) => Math.sin(((i + 0.5) / n) * Math.PI * 2) > 0.62 });
  part.box(0.5, 0.02, 2.5, 0, -0.34, 1.15, TUB);
  for (const [sz, sy] of [[DIM.seatFront[2], DIM.seatFront[1]], [DIM.seatRear[2], DIM.seatRear[1]]]) {
    part.box(0.44, 0.06, 0.46, 0, sy - 0.1, sz + 0.12, SEAT, -0.12);                 // seat pan
    part.box(0.44, 0.62, 0.06, 0, sy + 0.2, sz - 0.25, SEAT, -0.42);                 // reclined back
    part.box(0.2, 0.16, 0.07, 0, sy + 0.55, sz - 0.39, TUB, -0.3);                   // headrest
    part.box(0.05, 0.3, 0.01, 0.11, sy + 0.22, sz - 0.2, [0.45, 0.07, 0.06, 0], -0.42); part.box(0.05, 0.3, 0.01, -0.11, sy + 0.22, sz - 0.2, [0.45, 0.07, 0.06, 0], -0.42);   // harness
  }
  // front binnacle: a slim mushroom pedestal low between the knees, glare shield over it (the view over the nose stays open)
  part.box(0.1, 0.36, 0.08, 0, -0.06, 2.16, TUB); part.box(0.34, 0.15, 0.05, 0, 0.2, 2.13, DARK); part.box(0.38, 0.022, 0.2, 0, 0.285, 2.19, DARK, 0.1);
  // rear binnacle on the back of the front seat
  part.box(0.3, 0.13, 0.04, 0, 0.3, 1.04, DARK); part.box(0.34, 0.02, 0.14, 0, 0.372, 1.08, DARK, 0.1);
  // rudder pedals, the airbrake (blue) and release (yellow) knobs on the left wall, trim (green)
  part.box(0.09, 0.12, 0.02, 0.13, -0.2, 2.42, ALU, 0.5); part.box(0.09, 0.12, 0.02, -0.13, -0.2, 2.42, ALU, 0.5);
  part.box(0.02, 0.02, 0.22, 0.31, 0.02, 1.75, ALU); part.ball(0.022, 0.31, 0.03, 1.64, [0.03, 0.15, 0.6, 0.3]); part.ball(0.022, 0.2, 0.12, 2.1, [0.85, 0.65, 0.03, 0.3]); part.ball(0.018, 0.31, -0.05, 1.62, [0.05, 0.4, 0.1, 0.3]);
  void T;
}

function canopyGeo() {
  // half loft over the sill, one-sided faces doubled by the material (DoubleSide)
  const pos = [], idx = [], n = 12;
  for (const [z, w, h] of CAN) for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pos.push(w * Math.cos(a), SILL + h * Math.pow(Math.sin(a), 0.82), z); }
  for (let s = 0; s < CAN.length - 1; s++) for (let i = 0; i < n; i++) { const a = s * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
/** the canopy frame: sill rails, the nose arch, the roll-over hoop between the two canopies, the rear arch */
function canopyFrame(part) {
  const arch = (z, wid, k = 1.012, col = WHITE) => {
    const [w, h] = canAt(z), [w2, h2] = canAt(z - wid), n = 12, pos = [], idx = [], cols = [];
    for (const [zz, ww, hh, kk] of [[z, w, h, k], [z - wid, w2, h2, k], [z - wid, w2, h2, k - 0.035], [z, w, h, k - 0.035]]) for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pos.push(ww * kk * Math.cos(a), SILL + hh * kk * Math.pow(Math.sin(a), 0.82), zz); }
    for (let r = 0; r < 4; r++) for (let i = 0; i < n; i++) { const a = r * (n + 1) + i, b = a + 1, c = ((r + 1) % 4) * (n + 1) + i, d = c + 1; idx.push(a, c, b, b, c, d); cols.push(col, col); }
    part.surface(pos, idx, cols, { flip: true });
  };
  arch(1.06, 0.075); arch(2.36, 0.05, 1.02); arch(-0.12, 0.07, 1.02);
  // sill rails
  for (const s of [1, -1]) for (let i = 0; i < CAN.length - 1; i++) {
    const a = CAN[i], b = CAN[i + 1]; if (a[0] > 2.45) continue;
    const mx = (a[1] + b[1]) / 2 * 1.005, mz = (a[0] + b[0]) / 2, len = Math.hypot(a[0] - b[0], a[1] - b[1]), ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
    part.box(0.03, 0.035, len + 0.01, s * mx, SILL + 0.005, mz, WHITE, 0, -ang * s);
  }
}

function wings(parts, near, T, M) {
  const tipCol = (xl) => (xl > 3.86 ? T : WHITE);
  const inner = new Part();
  for (const s of [1, -1]) {
    aero(inner, wingAt, [0.26, 1.2, 2.2, 3.1, XI], { side: s });
    // the airbrake box in the upper surface (a dark slot the paddle rises from)
    inner.box(1.5, 0.006, 0.07, s * 2.95, wingAt(2.95).y + yt(0.42, 0.16) * wingAt(2.95).c + ycam(0.42, 0.028) * wingAt(2.95).c - 0.006, wingAt(2.95).le - 0.42 * wingAt(2.95).c, DARK, 0, 0, s * Math.atan(DIH));
    const pivot = new THREE.Group(); pivot.position.set(XI * s, YW + XI * DIH, 0); near.add(pivot);
    const op = new Part();
    aero(op, outerAt, [0, AIL[0]], { side: s, colour: () => WHITE });
    aero(op, outerAt, [AIL[0], 1.5, 2.5, 3.4, 3.9, AIL[1]], { side: s, u1: AIL[2], colour: (x) => tipCol(x) });
    aero(op, outerAt, [AIL[1], TIP - XI - 0.12, TIP - XI + 0.02], { side: s, cap1: true, colour: (x) => tipCol(x) });
    // tip skid
    op.box(0.03, 0.09, 0.2, s * (TIP - XI - 0.1), outerAt(TIP - XI - 0.1).y - 0.06, 0.12, DARK);
    const m = new THREE.Mesh(op.geometry(), M.body); m.castShadow = true; m.name = 'glider:wing'; pivot.add(m);
    // aileron on its hinge
    const hs = outerAt(AIL[0]), hz = hs.le - AIL[2] * hs.c, org = [s * AIL[0], hs.y + ycam(AIL[2], 0.028) * hs.c, hz];
    const hinge = new THREE.Group(); hinge.position.set(org[0], org[1], org[2]); pivot.add(hinge);
    const ap = new Part();
    aero(ap, outerAt, [AIL[0] + 0.01, 1.5, 2.5, 3.4, 3.9, AIL[1] - 0.01], { side: s, u0: AIL[2] + 0.004, cap0: true, cap1: true, colour: (x) => tipCol(x), org });
    const ail = new THREE.Mesh(ap.geometry(), M.body); ail.name = 'glider:aileron'; ail.castShadow = true; hinge.add(ail);
    // airbrake paddle: a cap strip flush with the wing, the plate and its two arms below it; rises 0.2 m
    const W = wingAt(2.95), by = W.y + (yt(0.42, 0.16) + ycam(0.42, 0.028)) * W.c, bp = new Part();
    bp.box(1.46, 0.012, 0.06, 0, 0, 0, WHITE); bp.box(1.42, 0.2, 0.012, 0, -0.105, 0, [0.16, 0.3, 0.62, 0.5]);
    bp.box(0.03, 0.2, 0.03, 0.5, -0.105, -0.02, ALU); bp.box(0.03, 0.2, 0.03, -0.5, -0.105, -0.02, ALU);
    const ab = new THREE.Mesh(bp.geometry(), M.body); ab.position.set(2.95 * s, by + 0.002, W.le - 0.42 * W.c); ab.rotation.z = s * Math.atan(DIH); ab.userData.y0 = ab.position.y; ab.name = 'glider:airbrake'; near.add(ab);
    if (s > 0) { parts.wingL = pivot; parts.ailL = hinge; parts.abL = ab; } else { parts.wingR = pivot; parts.ailR = hinge; parts.abR = ab; }
  }
  return inner;
}

function tail(parts, near, body, T, M, bars) {
  // fin (trim on the top third), rudder with the glider's bars, T-tailplane, elevator
  const finCol = (h) => (h > 0.92 ? T : WHITE);
  aero(body, finAt, [0, 0.5, 0.93, 1.3], { up: true, u1: RUD_U, colour: finCol });
  body.box(0.1, 0.07, 0.74, 0, 1.42, -4.72, T);                                        // fin-top fairing under the tailplane
  for (const s of [1, -1]) aero(body, tailAt, [0.0, 0.6, 1.2, 1.5, 1.57], { side: s, u1: ELE_U, cap1: true, colour: (x) => (x > 1.3 ? T : WHITE) });
  const F0 = finAt(0), rz = F0.le - RUD_U * F0.c, rorg = [0, 0.1, rz];
  const rh = new THREE.Group(); rh.position.set(0, 0.1, rz); near.add(rh);
  const rp = new Part();
  aero(rp, finAt, [0.0, 0.3, 0.42, 0.5, 0.62, 0.7, 0.93, 1.28], { up: true, u0: RUD_U + 0.004, cap1: true, org: rorg, colour: (h) => (h > 0.92 ? T : (bars >= 1 && h > 0.5 && h < 0.62) || (bars >= 2 && h > 0.3 && h < 0.42) ? T : WHITE) });
  const rud = new THREE.Mesh(rp.geometry(), M.body); rud.name = 'glider:rudder'; rud.castShadow = true; rh.add(rud);
  const T0 = tailAt(0), ez = T0.le - ELE_U * T0.c, eorg = [0, 1.4, ez];
  const eh = new THREE.Group(); eh.position.set(0, 1.4, ez); near.add(eh);
  const ep = new Part();
  for (const s of [1, -1]) aero(ep, tailAt, [0.02, 0.6, 1.2, 1.5], { side: s, u0: ELE_U + 0.004, cap1: true, org: eorg, colour: (x) => (x > 1.3 ? T : WHITE) });
  const elev = new THREE.Mesh(ep.geometry(), M.body); elev.name = 'glider:elevator'; elev.castShadow = true; eh.add(elev);
  parts.elev = eh; parts.rud = rh;
}

function gear(part) {
  const wheel = (r, w, y, z) => { part.cyl(r, r, w, 0, y, z, TYRE, 0, 0, Math.PI / 2, 16); part.cyl(r * 0.5, r * 0.5, w + 0.012, 0, y, z, ALU, 0, 0, Math.PI / 2, 10); };
  wheel(0.19, 0.12, -DIM.wheelH + 0.19, 0.05);
  part.box(0.2, 0.1, 0.62, 0, -0.42, 0.05, OFFW);                                        // wheel-well fairing lip
  wheel(0.1, 0.07, -0.44, 2.32);                                                         // nose wheel
  part.box(0.1, 0.05, 0.5, 0, -0.39, 2.72, TYRE, 0.24);                                  // rubber nose skid ahead of it
  wheel(0.07, 0.05, -0.02, -4.9);                                                        // tail wheel
  part.box(0.03, 0.02, 0.06, 0, -0.33, 1.25, ALU);                                       // the belly (winch) hook
  part.cyl(0.006, 0.006, 0.22, 0, 0.0, 3.4, ALU, Math.PI / 2 - 0.05, 0, 0, 5);           // pitot in the nose
}

/** a seated pilot (reclined, hands on the stick, legs forward) with a sun hat; col = jacket */
function pilot(col, hat) {
  const p = new Part(), SKIN = [0.5, 0.3, 0.2, 0], LEG = [0.045, 0.055, 0.09, 0];
  p.geo(new THREE.CylinderGeometry(0.15, 0.185, 0.5, 10), col, MAT(0, 0.34, -0.1, -0.38));          // torso (reclined)
  p.ball(0.12, 0, 0.6, -0.2, col, 1.5, 0.75, 1.0);                                                    // shoulders
  p.ball(0.105, 0, 0.78, -0.23, SKIN, 0.95, 1.1, 1.0);                                                // head
  p.cyl(0.118, 0.125, 0.07, 0, 0.855, -0.24, hat, -0.12); p.cyl(0.185, 0.19, 0.012, 0, 0.823, -0.235, hat, -0.12, 0, 0, 14);   // bucket hat + brim
  p.box(0.15, 0.035, 0.03, 0, 0.79, -0.135, [0.02, 0.02, 0.025, 0.9]);                                // sunglasses
  for (const s of [1, -1]) {
    p.cyl(0.05, 0.045, 0.36, s * 0.2, 0.42, 0.02, col, 1.05, 0, s * 0.25);                            // upper arm
    p.cyl(0.04, 0.036, 0.32, s * 0.1, 0.27, 0.26, col, 1.45, 0, -s * 0.5);                            // forearm to the stick
    p.ball(0.045, s * 0.03, 0.27, 0.4, SKIN);
    p.cyl(0.085, 0.07, 0.46, s * 0.1, 0.14, 0.2, LEG, 1.3);                                           // thigh
    p.cyl(0.06, 0.05, 0.46, s * 0.11, 0.08, 0.62, LEG, 1.75);                                         // shin to the pedals
  }
  return p.geometry();
}

// ---------------------------------------------------------------- materials (shared by every glider)
let MATS = null;
function patch(m, canopy) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGZen = ENV.zen; sh.uniforms.uGHor = ENV.hor; sh.uniforms.uGSun = ENV.sun; sh.uniforms.uGSunCol = ENV.sunCol; sh.uniforms.uGNight = ENV.night;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGZen;\nuniform vec3 uGHor;\nuniform vec3 uGSun;\nuniform vec3 uGSunCol;\nuniform float uGNight;')
      .replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
	{
		// gelcoat / perspex: a fresnel reflection of the sky dome (zenith above, haze at the horizon, dark fields below) and a sun glint
		${canopy ? 'float gGloss = 1.0;' : 'float gGloss = vColor.a;'}
		vec3 gV = normalize(vViewPosition);
		vec3 gNn = normal * (dot(normal, gV) < 0.0 ? -1.0 : 1.0);
		float gF = 0.04 + 0.96 * pow(1.0 - clamp(dot(gNn, gV), 0.0, 1.0), 5.0);
		vec3 gR = (vec4(reflect(-gV, gNn), 0.0) * viewMatrix).xyz;
		vec3 gEnv = gR.y > 0.0 ? mix(uGHor, uGZen, 1.0 - exp(-gR.y * 3.5)) : mix(uGHor, uGHor * vec3(0.3, 0.38, 0.22), clamp(-gR.y * 4.0, 0.0, 1.0));
		float gS = pow(max(dot(gR, uGSun), 0.0), ${canopy ? '420.0' : '160.0'}) * (1.0 - uGNight);
		totalEmissiveRadiance += (gEnv * gF * ${canopy ? '0.9' : '0.5'} + uGSunCol * gS * ${canopy ? '2.4' : '0.9'}) * gGloss;
		${canopy ? 'diffuseColor.a = clamp(0.1 + 0.75 * gF + gS, 0.0, 1.0);' : 'roughnessFactor = mix(0.85, roughnessFactor, gGloss);'}
	}`);
  };
  m.customProgramCacheKey = () => 'glider2' + (canopy ? 'c' : 'b');
  return m;
}
function dialTexture() {
  // ASI / altimeter / vario faces side by side (plain, generic)
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 384; c.height = 128;
  const g = c.getContext && c.getContext('2d'); if (!g || !g.arc) return null;
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 384, 128);
  const face = (i, draw) => { g.save(); g.translate(64 + i * 128, 64); g.fillStyle = '#16181b'; g.beginPath(); g.arc(0, 0, 60, 0, 7); g.fill(); g.strokeStyle = '#4b5057'; g.lineWidth = 3; g.stroke(); draw(); g.restore(); };
  const ticks = (a0, a1, n, len, col = '#e8eaec', lw = 3) => { g.strokeStyle = col; g.lineWidth = lw; for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; g.beginPath(); g.moveTo(Math.cos(a) * 52, Math.sin(a) * 52); g.lineTo(Math.cos(a) * (52 - len), Math.sin(a) * (52 - len)); g.stroke(); } };
  const arc = (a0, a1, col) => { g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 55, a0, a1); g.stroke(); };
  const A = (f) => -Math.PI / 2 + f * Math.PI * 2;
  face(0, () => { arc(A(40 / 160), A(105 / 160), '#3fbf5a'); arc(A(105 / 160), A(150 / 160), '#e5c232'); arc(A(149 / 160), A(152 / 160), '#e23a2a'); ticks(A(0.125), A(0.95), 14, 9); g.fillStyle = '#e8eaec'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText('kt', 0, 30); });
  face(1, () => { ticks(A(0), A(0.9), 9, 10); ticks(A(0), A(0.98), 49, 5, '#b9bdc2', 1.5); g.fillStyle = '#e8eaec'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText('ft', 0, 30); });
  face(2, () => { arc(Math.PI, Math.PI * 1.75, '#3fbf5a'); arc(Math.PI * 0.25, Math.PI, '#39414a'); ticks(Math.PI * 0.25, Math.PI * 1.75, 10, 9); g.fillStyle = '#e8eaec'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText('kt', 22, 5); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function mats() {
  if (MATS) return MATS;
  MATS = {
    body: patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.0 }), false),
    canopy: patch(new THREE.MeshStandardMaterial({ color: 0x8fb0c4, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }), true),
    dials: null,
  };
  const dt = dialTexture();
  MATS.dials = dt ? new THREE.MeshBasicMaterial({ map: dt, fog: false }) : new THREE.MeshBasicMaterial({ color: 0x16181b });
  MATS.body.name = 'glider:body'; MATS.canopy.name = 'glider:canopy'; MATS.dials.name = 'glider:dials';
  return MATS;
}
const GEO = new Map();           // geometry shared between the two gliders where the trim does not enter
const shared = (k, f) => { let g = GEO.get(k); if (!g) GEO.set(k, (g = f())); return g; };

export function build({ trim = 0xc8202a, number = '1' } = {}) {
  const M = mats(), T = hexRGB(trim), bars = Math.max(1, Math.min(2, parseInt(number, 10) || 1));
  const group = new THREE.Group(); group.name = 'glider';
  const near = new THREE.Group(); near.name = 'glider:near'; group.add(near);
  const parts = {};
  // ---- everything rigid: fuselage, inner wings, fin, tailplane, cockpit, gear, canopy frame -> one mesh
  const body = new Part();
  fuselage(body, T, 22);
  cockpit(body, T);
  canopyFrame(body);
  gear(body);
  body.add(wings(parts, near, T, M));
  tail(parts, near, body, T, M, bars);
  const bodyMesh = new THREE.Mesh(body.geometry(), M.body); bodyMesh.castShadow = true; bodyMesh.name = 'glider:body'; near.add(bodyMesh);
  // ---- canopy
  const canopy = new THREE.Mesh(shared('canopy', canopyGeo), M.canopy); canopy.name = 'glider:canopy'; canopy.renderOrder = 3; near.add(canopy);
  // ---- cockpit moving bits: front stick, the yaw string on the canopy, three dial faces with needles
  const sp = new Part(); sp.cyl(0.013, 0.016, 0.36, 0, 0.18, 0, ALU, 0, 0, 0, 6); sp.cyl(0.022, 0.02, 0.1, 0, 0.39, 0, DARK, 0, 0, 0, 8);
  const stick = new THREE.Mesh(shared('stick', () => sp.geometry()), M.body); stick.position.set(0, -0.3, 1.95); stick.name = 'glider:stick'; near.add(stick);
  const yp = new Part(); yp.box(0.008, 0.004, 0.2, 0, 0.004, -0.1, [0.75, 0.03, 0.03, 0]); yp.box(0.03, 0.003, 0.03, 0, 0.002, 0, [0.9, 0.9, 0.85, 0]);
  const [, sh] = canAt(2.12);
  const string = new THREE.Mesh(shared('string', () => yp.geometry()), M.body); string.position.set(0, SILL + sh * 1.0 + 0.004, 2.12); string.rotation.x = 0.32; string.rotation.order = 'XYZ'; string.name = 'glider:string'; near.add(string);
  const dial = new THREE.Group(); dial.position.set(0, 0.2, 2.103); near.add(dial);
  const needles = {};
  const ng = shared('needle', () => { const p = new Part(); p.box(0.005, 0.034, 0.002, 0, 0.012, 0, [0.95, 0.95, 0.9, 0]); return p.geometry(); });
  ['asi', 'alt', 'vario'].forEach((k, i) => {
    const fg = shared('dial' + i, () => { const g = new THREE.PlaneGeometry(0.094, 0.094); const uv = g.attributes.uv; for (let q = 0; q < uv.count; q++) uv.setX(q, (uv.getX(q) + i) / 3); g.rotateY(Math.PI); return g; });
    const f = new THREE.Mesh(fg, M.dials); f.position.set((i - 1) * 0.108, 0, 0); f.name = 'glider:dial'; dial.add(f);
    const nd = new THREE.Mesh(ng, M.body); nd.position.set((i - 1) * 0.108, 0, -0.003); nd.name = 'glider:needle'; dial.add(nd); needles[k] = nd;
  });
  // ---- seated figures for other players' gliders (the local pilot uses their own character)
  const seatFront = new THREE.Object3D(); seatFront.position.set(...DIM.seatFront); near.add(seatFront);
  const seatRear = new THREE.Object3D(); seatRear.position.set(...DIM.seatRear); near.add(seatRear);
  const dummyFront = new THREE.Mesh(shared('pilotA', () => pilot([0.1, 0.16, 0.3, 0], [0.7, 0.66, 0.5, 0])), M.body); dummyFront.name = 'glider:pilot';
  dummyFront.position.set(DIM.seatFront[0], DIM.seatFront[1] - 0.12, DIM.seatFront[2]); dummyFront.visible = false; near.add(dummyFront);
  const dummyRear = new THREE.Mesh(shared('pilotB', () => pilot([0.3, 0.08, 0.07, 0], [0.75, 0.76, 0.78, 0])), M.body); dummyRear.name = 'glider:pilot';
  dummyRear.position.set(DIM.seatRear[0], DIM.seatRear[1] - 0.12, DIM.seatRear[2]); dummyRear.visible = false; near.add(dummyRear);
  // ---- far LOD: one merged static mesh (coarse fuselage, whole wings at rest, tail)
  const fp = new Part();
  fuselage(fp, T, 8, true);
  for (const s of [1, -1]) {
    aero(fp, wingAt, [0.26, XI, 6.4, TIP - 0.12, TIP + 0.02], { side: s, US: US_FAR, cap1: true, colour: (x) => (x > TIP - 0.64 ? T : WHITE) });
    aero(fp, tailAt, [0, 1.57], { side: s, US: US_FAR, cap1: true, colour: () => WHITE });
  }
  aero(fp, finAt, [0, 0.93, 1.3], { up: true, US: US_FAR, colour: (h) => (h > 0.92 ? T : WHITE) });
  { const pos = [], idx = [], n = 6; for (const [z, w, h] of CAN.filter((_, i) => i % 2 === 0 || i === CAN.length - 1)) for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pos.push(w * Math.cos(a), SILL + h * Math.sin(a), z); }
    const rows = pos.length / 3 / (n + 1), cols = []; for (let s2 = 0; s2 < rows - 1; s2++) for (let i = 0; i < n; i++) { const a = s2 * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, b, c, b, d, c); cols.push([0.16, 0.22, 0.28, 1], [0.16, 0.22, 0.28, 1]); }
    fp.surface(pos, idx, cols, { flip: false }); }
  const far = new THREE.Mesh(fp.geometry(), M.body); far.visible = false; far.name = 'glider:far'; far.castShadow = true; group.add(far);
  Object.assign(parts, { canopy, seatFront, seatRear, dummyFront, dummyRear, far, near, body: bodyMesh, stick, string, needles });
  group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });                      // (they move every frame: core/cull stores positions once)
  return { group, parts, tris: { near: 0, far: fp.tris }, dispose() { group.traverse((o) => { if (o.geometry && ![...GEO.values()].includes(o.geometry)) o.geometry.dispose(); }); } };
}

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
/**
 * control surfaces / airbrakes / wing flex / cockpit. c = {ail, elev, rud (−1..1), ab 0..1, flex (load factor − 1),
 * lod: 0 near / 1 far, and optionally V (m/s), alt (m), te (m/s), beta (rad), t (s) for the dials and the yaw string}
 */
export function pose(parts, c) {
  const far = c.lod === 1;
  if (parts.far.visible !== far) { parts.far.visible = far; parts.near.visible = !far; }
  if (far) return;
  const a = (c.ail || 0) * 0.34;
  parts.ailL.rotation.x = a; parts.ailR.rotation.x = -a;        // right stick: left aileron down, right aileron up
  parts.elev.rotation.x = -(c.elev || 0) * 0.38;                // back stick: elevator trailing edge up
  parts.rud.rotation.y = -(c.rud || 0) * 0.5;
  const ab = c.ab || 0;
  // draw calls: the paddles only when out (stowed they are flush, the slot is in the body), the cockpit's small moving
  // bits (stick, yaw string, dials and needles: 8 draws) only from the cockpit
  const abOn = ab > 0.01, ck = !!c.cockpit;
  if (parts.abL.visible !== abOn) { parts.abL.visible = abOn; parts.abR.visible = abOn; }
  if (parts.stick.visible !== ck) { parts.stick.visible = ck; parts.string.visible = ck; parts.needles.asi.parent.visible = ck; }
  parts.abL.position.y = parts.abL.userData.y0 + ab * 0.2; parts.abR.position.y = parts.abR.userData.y0 + ab * 0.2;
  const f = clamp((c.flex || 0) * 0.04 + 0.012, -0.05, 0.1);    // tips bend up under load (~0.5 m at 2 g); a touch at 1 g in flight
  parts.wingL.rotation.z = f; parts.wingR.rotation.z = -f;
  if (parts.stick) { parts.stick.rotation.x = -(c.elev || 0) * 0.22; parts.stick.rotation.z = (c.ail || 0) * 0.2; }
  if (c.V !== undefined && parts.needles) {
    const kt = c.V * 1.943844, N = parts.needles, t = c.t || 0;
    N.asi.rotation.z = clamp(kt / 160, 0, 0.97) * Math.PI * 2;
    N.alt.rotation.z = (((c.alt || 0) * 3.28084) % 1000) / 1000 * Math.PI * 2;
    N.vario.rotation.z = -Math.PI / 2 + clamp((c.te || 0) * 1.943844 / 10, -1, 1) * Math.PI * 0.75;
    const sp = clamp(c.V / 12, 0, 1);
    parts.string.rotation.y = clamp(-(c.beta || 0) * 3.2, -0.9, 0.9) * sp + Math.sin(t * 23) * 0.03 * sp;
    parts.string.rotation.x = 0.32 - (1 - sp) * 0.3 + Math.sin(t * 31) * 0.02 * sp;     // streams back up the canopy's slope
  }
}
