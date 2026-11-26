// The town's animals (2026-11-21, "make sure there are children and pets too"): dogs of a dozen breeds, cats, and the
// college tortoise — built here (lofted, vertex-coloured, drawn in the characters' shared material: no texture, no new
// shader) and posed here. Who has them and where they are is systems/pedestrians.js (dogs on leads) and
// systems/_ped_scenes.js (dogs off the lead in the parks, cats on walls and in quads, tortoises on college lawns).
// No animal is ever hurt: nothing can hit one (systems/_ped_protect.js) and they get out of the way first.
//
//   createAnimal(kind, { seed, breed? }) -> { kind, breed, group, collar (Vector3, group-local: where a lead clips on),
//       radius, length, height, update(dt, speed), setPose(name), look(yaw, pitch?), dispose(), pose }
//   kinds: 'dog' — poses stand sit lie sniff squat mark (a leg cocked at a lamp post) bark beg; walks, trots and gallops
//          'cat' — poses stand sit loaf crouch (slinking low); 'tortoise' — poses stand hide (head and legs drawn in)
// A dog is 8 meshes (body, head, two ears as one, tail, four legs), a cat 7, a tortoise 6; geometry is shared between
// animals of the same breed and coat (reference-counted).
import * as THREE from 'three';
import { characterMaterial } from '../core/characters.js';

const TAU = Math.PI * 2;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mulberry = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const _c = new THREE.Color();
const shade = (hex, k) => { _c.set(hex); _c.multiplyScalar(k); return _c.getHex(); };
/** 3-D value noise in 0..1 (coat patches: the same on every client, a function of the place on the body) */
function patch(x, y, z, seed) {
  const h = (i, j, k) => { let n = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(k | 0, 2147483647) ^ Math.imul(seed | 0, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), u), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v), L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}

// ------------------------------------------------------------------------------------------------ geometry
/** accumulates lofted tubes (rings of `sides` points along a spine) and boxes into one non-indexed, vertex-coloured geometry */
export class Loft {
  constructor() { this.P = []; this.N = []; this.C = []; }
  /** rings: [[x, y, z, rx, ry]…] centres and half-widths (across / up) along the tube; the ends are capped. `axis`:
   *  'z' (the tube runs along z: bodies, heads, tails) or 'y' (runs down: legs; rx across x, ry across z).
   *  col(x, y, z) -> hex */
  tube(rings, col, sides = 8, axis = 'z') {
    const pt = (k, j) => {
      const R = rings[k], a = (j / sides) * TAU, c = Math.cos(a), s = Math.sin(a);
      return axis === 'z' ? [R[0] + c * R[3], R[1] + s * R[4], R[2], c / (R[3] || 1), s / (R[4] || 1), 0] : [R[0] + c * R[3], R[1], R[2] + s * R[4], c / (R[3] || 1), 0, s / (R[4] || 1)];
    };
    const push = (v, n) => { this.P.push(v[0], v[1], v[2]); const l = Math.hypot(n[0], n[1], n[2]) || 1; this.N.push(n[0] / l, n[1] / l, n[2] / l); _c.set(col(v[0], v[1], v[2])); this.C.push(_c.r, _c.g, _c.b); };
    const tri = (a, b, c) => { push(a, a.slice(3)); push(b, b.slice(3)); push(c, c.slice(3)); };
    const flip = axis === 'y';
    for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < sides; j++) {
      const a = pt(k, j), b = pt(k, j + 1), c = pt(k + 1, j + 1), d = pt(k + 1, j);
      if (flip) { tri(a, b, c); tri(a, c, d); } else { tri(a, c, b); tri(a, d, c); }
    }
    for (const [k, sgn] of [[0, -1], [rings.length - 1, 1]]) {
      const R = rings[k], n = axis === 'z' ? [0, 0, sgn] : [0, sgn, 0], ctr = [R[0], R[1], R[2], ...n];
      for (let j = 0; j < sides; j++) {
        const a = pt(k, j).slice(0, 3).concat(n), b = pt(k, j + 1).slice(0, 3).concat(n);
        if ((sgn > 0) !== flip) tri(ctr, a, b); else tri(ctr, b, a);
      }
    }
    return this;
  }
  /** a flat slab (ears, a tortoise's plates): centre, half sizes, colour */
  box(x, y, z, hx, hy, hz, col, rotZ = 0, rotX = 0) {
    const g = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2).toNonIndexed(); if (rotX) g.rotateX(rotX); if (rotZ) g.rotateZ(rotZ); g.translate(x, y, z);
    const p = g.attributes.position, n = g.attributes.normal; _c.set(col);
    for (let i = 0; i < p.count; i++) { this.P.push(p.getX(i), p.getY(i), p.getZ(i)); this.N.push(n.getX(i), n.getY(i), n.getZ(i)); this.C.push(_c.r, _c.g, _c.b); }
    g.dispose(); return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.computeBoundingSphere();
    return g;
  }
}
/** rings -> n times as many, through the same points on a smooth curve (Catmull-Rom): round bodies from a few stations */
function sub(R, n = 3) {
  const out = [], at = (i) => R[Math.max(0, Math.min(R.length - 1, i))];
  for (let i = 0; i < R.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t, q = [];
      for (let j = 0; j < p1.length; j++) { const v = 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3); q.push(j >= 3 ? Math.max(0.0015, v) : v); }
      out.push(q);
    }
  }
  out.push(R[R.length - 1].slice());
  return out;
}
const cache = new Map();
function acquire(key, make) { let e = cache.get(key); if (!e) cache.set(key, (e = { g: make(), n: 0 })); e.n++; return e.g; }
function release(key) { const e = cache.get(key); if (e && --e.n <= 0) { e.g.dispose(); cache.delete(key); } }
export function animalCacheStats() { return { cached: cache.size }; }

// ------------------------------------------------------------------------------------------------ dogs
// h = height at the shoulder (m), len = chest to rump, w = body width, deep = chest depth as a share of h, snout = muzzle
// length, head = skull size, ear 'drop' | 'prick' | 'rose' | 'long', tail [length, 'up' | 'low' | 'curl' | 'stub' | 'sabre'],
// coat = the coats this breed comes in: [base, second, pattern]; patterns: plain, belly (paler underneath), saddle (dark
// back over tan), collie (white collar, chest, blaze, socks and tail tip), pied (white with patches of the base), tri
// (hound: black saddle, tan head and legs, white below), mask (dark muzzle and ears), brindle. (Sizes: the breed standards.)
export const DOGS = {
  labrador: { h: 0.57, len: 0.62, w: 0.24, deep: 0.46, snout: 0.11, head: 0.115, ear: 'drop', tail: [0.36, 'sabre'], coat: [[0xd9bd82, 0xe6d3a3, 'belly'], [0x1b1a1a, 0x232222, 'plain'], [0x5a3a26, 0x66432c, 'belly']] },
  retriever: { h: 0.58, len: 0.64, w: 0.25, deep: 0.47, snout: 0.11, head: 0.118, ear: 'drop', tail: [0.38, 'low'], coat: [[0xc99a52, 0xe0bf85, 'belly'], [0xdcc08a, 0xeeddb6, 'belly']], fluff: 1.12 },
  collie: { h: 0.52, len: 0.56, w: 0.2, deep: 0.44, snout: 0.115, head: 0.1, ear: 'rose', tail: [0.36, 'low'], coat: [[0x1a1a1c, 0xf0eee8, 'collie'], [0x5a3020, 0xf0eee8, 'collie']], fluff: 1.08 },
  spaniel: { h: 0.4, len: 0.44, w: 0.18, deep: 0.48, snout: 0.085, head: 0.092, ear: 'long', tail: [0.14, 'up'], coat: [[0x5a3320, 0xf0ece4, 'pied'], [0x1c1a1a, 0x1c1a1a, 'plain'], [0xb0793c, 0xc79250, 'belly'], [0x1c1a1a, 0xf0ece4, 'pied']], fluff: 1.06 },
  terrier: { h: 0.28, len: 0.33, w: 0.14, deep: 0.5, snout: 0.07, head: 0.078, ear: 'rose', tail: [0.13, 'up'], coat: [[0xa9703a, 0xf2efe8, 'pied'], [0x2a2420, 0xf2efe8, 'pied']] },
  westie: { h: 0.27, len: 0.31, w: 0.15, deep: 0.52, snout: 0.06, head: 0.085, ear: 'prick', tail: [0.13, 'up'], coat: [[0xf2f0ea, 0xf2f0ea, 'plain']], fluff: 1.14 },
  dachshund: { h: 0.2, len: 0.44, w: 0.13, deep: 0.62, snout: 0.085, head: 0.07, ear: 'long', tail: [0.22, 'low'], coat: [[0x7a3a1c, 0x8a4a26, 'belly'], [0x1c1a1a, 0x9a6234, 'saddle']] },
  pug: { h: 0.3, len: 0.32, w: 0.19, deep: 0.56, snout: 0.022, head: 0.092, ear: 'drop', tail: [0.1, 'curl'], coat: [[0xd9bb8c, 0x2a2420, 'mask'], [0x1f1d1d, 0x1f1d1d, 'plain']] },
  greyhound: { h: 0.7, len: 0.66, w: 0.17, deep: 0.5, snout: 0.14, head: 0.092, ear: 'rose', tail: [0.5, 'low'], coat: [[0x8a8a8e, 0xb6b6ba, 'belly'], [0xc7a273, 0xe6d3b0, 'belly'], [0x3a3026, 0x5a4a38, 'brindle'], [0xf0ece4, 0x2a2a2c, 'pied']], tuck: 0.5 },
  shepherd: { h: 0.62, len: 0.66, w: 0.23, deep: 0.45, snout: 0.125, head: 0.112, ear: 'prick', tail: [0.42, 'low'], coat: [[0x1c1a1a, 0xb8834a, 'saddle']], fluff: 1.06 },
  poodle: { h: 0.4, len: 0.4, w: 0.16, deep: 0.46, snout: 0.085, head: 0.09, ear: 'long', tail: [0.14, 'up'], coat: [[0xc79a62, 0xd3ab78, 'plain'], [0x2a2626, 0x2a2626, 'plain'], [0xeae6dc, 0xeae6dc, 'plain'], [0x6a4630, 0x6a4630, 'plain']], fluff: 1.2 },
  staffie: { h: 0.38, len: 0.4, w: 0.22, deep: 0.5, snout: 0.07, head: 0.105, ear: 'rose', tail: [0.22, 'low'], coat: [[0x3a2e26, 0x5a4636, 'brindle'], [0x6a6c74, 0xe8e6e0, 'collie'], [0xb07a46, 0xf0ece4, 'collie']] },
  beagle: { h: 0.37, len: 0.42, w: 0.18, deep: 0.5, snout: 0.085, head: 0.092, ear: 'long', tail: [0.24, 'up'], coat: [[0x1c1a1a, 0xb07a40, 'tri']] },
};
export const DOG_KINDS = Object.keys(DOGS);
// (how often each is met: the labradors, spaniels, terriers and mixes of an English town)
const DOG_ODDS = [['labrador', 16], ['spaniel', 13], ['terrier', 11], ['retriever', 8], ['collie', 8], ['staffie', 7], ['poodle', 8], ['westie', 6], ['dachshund', 6], ['pug', 5], ['greyhound', 5], ['shepherd', 4], ['beagle', 4]];

function coatFn(B, coat, seed, dims) {
  const [base, second, pat] = coat, { h, len } = dims, dark = shade(base, 0.55), tan = second;
  return (x, y, z, part) => {
    // y: metres above the ground in the standing pose; z: along the body (nose +)
    const n = patch(x * 9 + 3, y * 9, z * 7, seed), up = y / h;
    let c = base;
    switch (pat) {
      case 'belly': c = up < 0.55 && part !== 'ear' ? second : base; break;
      case 'saddle': c = (part === 'body' && up > 0.78) || part === 'tail' || part === 'ear' || (part === 'head' && y > h * 1.2 && z < len * 0.62) ? base : tan; break;
      case 'collie': c = (part === 'leg' && up < 0.3) || (part === 'body' && z > len * 0.3 && (up < 0.62 || z > len * 0.43)) || (part === 'head' && Math.abs(x) < 0.016 && z > len * 0.55) || (part === 'tail' && z < -len * 0.5 - B.tail[0] * 0.75) ? second : base; break;
      case 'pied': c = n > (part === 'head' || part === 'ear' ? 0.42 : 0.56) ? base : second; break;
      case 'tri': c = part === 'leg' || (part === 'body' && up < 0.5) || (part === 'tail' && z < -len * 0.5 - B.tail[0] * 0.6) ? 0xf0ece4 : part === 'head' || part === 'ear' || (part === 'body' && (up < 0.74 || z > len * 0.28)) ? tan : base; break;
      case 'mask': c = part === 'ear' || (part === 'head' && z > len * 0.5 + B.head * 1.25) ? second : base; break;
      case 'brindle': c = Math.sin(z * 55 + n * 5 + x * 20) > 0.25 ? base : second; break;
      default: c = base;
    }
    return shade(c, 0.93 + n * 0.14);
  };
}
function dogParts(breed, ci, seed) {
  const B = DOGS[breed], f = B.fluff || 1, h = B.h, len = B.len, w = B.w * f, deep = B.deep * h * f, top = h, tuck = B.tuck || 0.28;
  const col = coatFn(B, B.coat[ci], seed, { h, len });
  const chestY = top - deep / 2, hw = w / 2;
  const P = {};
  // body: rump, loin (tucked up), ribcage, chest, the base of the neck rising to the head
  { const g = new Loft(), c = (x, y, z) => col(x, y, z, 'body');
    g.tube([[0, top - deep * 0.3, -len * 0.52, hw * 0.45, deep * 0.22], [0, top - deep * 0.36, -len * 0.44, hw * 0.86, deep * 0.36], [0, top - deep * (0.5 - tuck * 0.32), -len * 0.18, hw * 0.84, deep * (0.5 - tuck * 0.36)],
      [0, chestY, len * 0.12, hw, deep * 0.5], [0, chestY + deep * 0.02, len * 0.34, hw * 0.94, deep * 0.5], [0, chestY + deep * 0.12, len * 0.47, hw * 0.62, deep * 0.36], [0, top - deep * 0.1, len * 0.54, hw * 0.4, deep * 0.2]].length ? sub([[0, top - deep * 0.34, -len * 0.55, hw * 0.2, deep * 0.12], [0, top - deep * 0.36, -len * 0.5, hw * 0.62, deep * 0.3], [0, top - deep * 0.4, -len * 0.4, hw * 0.92, deep * 0.4], [0, top - deep * (0.5 - tuck * 0.32), -len * 0.16, hw * 0.86, deep * (0.5 - tuck * 0.36)],
      [0, chestY, len * 0.12, hw, deep * 0.5], [0, chestY + deep * 0.02, len * 0.32, hw * 0.96, deep * 0.5], [0, chestY + deep * 0.1, len * 0.46, hw * 0.7, deep * 0.4], [0, chestY + deep * 0.16, len * 0.53, hw * 0.3, deep * 0.2]], 3) : [], c, 12);
    // neck, up and forward to the skull
g.tube(sub([[0, top - deep * 0.34, len * 0.34, hw * 0.66, deep * 0.3], [0, top - deep * 0.12, len * 0.44, hw * 0.6, B.head * 0.86], [0, top + h * 0.07, len * 0.52, hw * 0.5, B.head * 0.74], [0, top + h * 0.18, len * 0.58, hw * 0.44, B.head * 0.64]], 3), c, 10);
    g.box(0, top + h * 0.1, len * 0.52, hw * 0.52, 0.014, 0.02, 0xb02a2a, 0, -0.75);          // collar
    P.body = g.build(); P.bodyY = 0; }
  // head (its own frame: the origin is where it joins the neck): skull, stop, muzzle, nose, eyes
  { const g = new Loft(), R = B.head, s = B.snout, c = (x, y, z) => col(x, y + top + h * 0.2, z + len * 0.6, 'head');
g.tube(sub([[0, -R * 0.05, -R * 0.82, R * 0.3, R * 0.32], [0, R * 0.04, -R * 0.55, R * 0.64, R * 0.62], [0, R * 0.1, -R * 0.1, R * 0.78, R * 0.74], [0, R * 0.08, R * 0.34, R * 0.72, R * 0.66], [0, -R * 0.1, R * 0.7, R * 0.47, R * 0.44], [0, -R * 0.19, R * 0.74 + s * 0.5, R * 0.37, R * 0.33], [0, -R * 0.2, R * 0.74 + s * 0.92, R * 0.31, R * 0.27], [0, -R * 0.19, R * 0.74 + s, R * 0.16, R * 0.14]], 3), c, 10);
    g.box(0, -R * 0.1, R * 0.76 + s, R * 0.14, R * 0.1, 0.012, 0x151313);                                    // nose
    for (const sx of [1, -1]) g.box(sx * R * 0.42, R * 0.24, R * 0.55, 0.011, 0.012, 0.008, 0x120f0e);       // eyes
    P.head = g.build(); P.headAt = [0, top + h * 0.2, len * 0.6]; P.snoutTip = R * 0.74 + s; }
  // ears (one mesh: they move with the head)
  { const g = new Loft(), R = B.head, e = B.ear, cc = col(0, top + h * 0.3, len * 0.55, 'ear');
    for (const sx of [1, -1]) {
      if (e === 'prick') g.tube([[sx * R * 0.46, R * 0.5, -R * 0.2, R * 0.2, R * 0.07], [sx * R * 0.5, R * 0.95, -R * 0.24, R * 0.12, R * 0.05], [sx * R * 0.52, R * 1.3, -R * 0.27, R * 0.02, R * 0.02]].map((q) => [q[0], q[1], q[2], q[3], q[4]]), () => cc, 5, 'y');
      else if (e === 'long') g.tube(sub([[sx * R * 0.62, R * 0.5, -R * 0.12, R * 0.1, R * 0.2], [sx * R * 0.8, R * 0.2, -R * 0.1, R * 0.07, R * 0.32], [sx * R * 0.84, -R * 0.5, -R * 0.06, R * 0.06, R * 0.36], [sx * R * 0.8, -R * 1.05, -R * 0.04, R * 0.05, R * 0.24], [sx * R * 0.78, -R * 1.2, -R * 0.04, R * 0.02, R * 0.06]], 2), () => cc, 6, 'y');
      else if (e === 'rose') g.tube(sub([[sx * R * 0.5, R * 0.62, -R * 0.3, R * 0.14, R * 0.18], [sx * R * 0.72, R * 0.66, -R * 0.36, R * 0.07, R * 0.2], [sx * R * 0.86, R * 0.48, -R * 0.4, R * 0.04, R * 0.13], [sx * R * 0.9, R * 0.36, -R * 0.42, R * 0.015, R * 0.04]], 2), () => cc, 6, 'y');
      else g.tube(sub([[sx * R * 0.6, R * 0.52, -R * 0.14, R * 0.1, R * 0.2], [sx * R * 0.78, R * 0.3, -R * 0.1, R * 0.06, R * 0.3], [sx * R * 0.84, -R * 0.14, -R * 0.06, R * 0.05, R * 0.27], [sx * R * 0.82, -R * 0.42, -R * 0.03, R * 0.02, R * 0.08]], 2), () => cc, 6, 'y');
    }
    P.ears = g.build(); }
  // legs: hung from the shoulder / hip (origin at the joint), paw at -L
  const leg = (front) => {
    const g = new Loft(), L = h - deep * (front ? 0.62 : 0.5), r = Math.max(0.016, w * (front ? 0.15 : 0.17)), zs = front ? 1 : -1;
    const c = (x, y, z) => col(x, y + L, z, 'leg');
g.tube(front ? [[0, 0.02, 0, r * 1.5, r * 1.7], [0, -L * 0.22, 0.004, r * 1.3, r * 1.4], [0, -L * 0.5, 0.004, r * 1.02, r * 1.06], [0, -L * 0.86, 0, r * 0.82, r * 0.86], [0, -L + 0.03, r * 0.3, r * 0.95, r * 1.25], [0, -L + 0.008, r * 0.5, r * 1.0, r * 1.5], [0, -L, r * 0.5, r * 0.8, r * 1.3]]
      : [[0, 0.03, 0, r * 1.7, r * 2.4], [0, -L * 0.42, r * 0.9, r * 1.2, r * 1.5], [0, -L * 0.68, -r * 1.3, r * 0.85, r * 0.95], [0, -L * 0.9, -r * 0.5, r * 0.75, r * 0.8], [0, -L + 0.012, r * 0.4, r * 0.95, r * 1.45], [0, -L, r * 0.4, r * 0.85, r * 1.35]], c, 8, 'y');
    void zs; return { g: g.build(), L };
  };
  const lf = leg(true), lb = leg(false);
  P.legF = lf.g; P.legB = lb.g; P.LF = lf.L; P.LB = lb.L;
  // tail (origin at its root; runs back along -z, bent by the animation)
  { const g = new Loft(), T = B.tail[0], r = Math.max(0.012, w * 0.11) * f, c = (x, y, z) => col(x, y + top, z - len * 0.5, 'tail');
    const fe = f > 1.05 ? 1 + (f - 1) * 6 : 1, curl = B.tail[1] === 'curl';
    g.tube(sub(curl ? [[0, 0, 0, r * 1.1, r * 1.1], [0, T * 0.35, -T * 0.25, r, r], [0, T * 0.62, 0, r * 0.9, r * 0.9], [0, T * 0.45, T * 0.3, r * 0.75, r * 0.75], [0, T * 0.2, T * 0.25, r * 0.4, r * 0.4]]
      : [[0, 0, 0, r * 1.15, r * 1.15], [0, -r * 0.2 * fe, -T * 0.3, r * 0.95, r * 0.95 * fe], [0, -r * 0.25 * fe, -T * 0.65, r * 0.75, r * 0.8 * fe], [0, 0, -T * 0.92, r * 0.4, r * 0.45], [0, 0, -T, r * 0.12, r * 0.12]], 3), c, 6);
    P.tail = g.build(); }
  P.dims = { h, len, w, deep, top };
  return P;
}

// ------------------------------------------------------------------------------------------------ cats
export const CATS = [[0x2a2826, 0x2a2826, 'plain'], [0x8a8a8c, 0x4a4a4e, 'tabby'], [0xc97a2e, 0xe8a25a, 'tabby'], [0x1c1b1b, 0xf2efe8, 'tux'], [0xf0ece4, 0xf0ece4, 'plain'], [0x6e6e74, 0x6e6e74, 'plain'], [0xd9b98a, 0x3a2a20, 'point'], [0xf0ece4, 0xc97a2e, 'tortie']];
function catParts(ci, seed) {
  const [base, second, pat] = CATS[ci], h = 0.25, len = 0.34, hw = 0.062, deep = 0.12, top = h;
  const col = (x, y, z, part) => {
    const n = patch(x * 12 + 5, y * 12, z * 10, seed);
    let c = base;
    if (pat === 'tabby') c = Math.sin(z * 70 + n * 4) > 0.3 ? second : base;
    else if (pat === 'tux') c = (part === 'leg' && y < h * 0.3) || (part === 'body' && z > len * 0.25 && y < h * 0.75) || (part === 'head' && y < h + 0.035 && z > len * 0.5 + 0.03) ? second : base;
    else if (pat === 'point') c = part === 'tail' || part === 'ear' || (part === 'leg' && y < h * 0.4) || (part === 'head' && z > len * 0.5 + 0.045) ? second : base;
    else if (pat === 'tortie') c = n > 0.62 ? second : n < 0.36 ? 0x2a2420 : base;
    return shade(c, 0.93 + n * 0.14);
  };
  const P = {};
  { const g = new Loft(), c = (x, y, z) => col(x, y, z, 'body');
    g.tube([[0, top - deep * 0.4, -len * 0.5, hw * 0.5, deep * 0.3], [0, top - deep * 0.5, -len * 0.36, hw * 0.98, deep * 0.5], [0, top - deep * 0.5, 0, hw * 0.92, deep * 0.47], [0, top - deep * 0.48, len * 0.3, hw, deep * 0.5], [0, top - deep * 0.36, len * 0.46, hw * 0.66, deep * 0.38], [0, top - deep * 0.2, len * 0.54, hw * 0.5, deep * 0.3]], c, 8);
    P.body = g.build(); }
  { const g = new Loft(), R = 0.05, c = (x, y, z) => col(x, y + top + 0.02, z + len * 0.55, 'head');
    g.tube([[0, 0, -R * 0.8, R * 0.5, R * 0.5], [0, R * 0.05, -R * 0.2, R * 0.92, R * 0.82], [0, R * 0.02, R * 0.4, R * 0.86, R * 0.74], [0, -R * 0.16, R * 0.86, R * 0.42, R * 0.36], [0, -R * 0.2, R * 1.02, R * 0.24, R * 0.2]], c, 8);
    g.box(0, -R * 0.14, R * 1.03, 0.006, 0.005, 0.004, 0xc98a8a);
    for (const sx of [1, -1]) { g.box(sx * R * 0.4, R * 0.2, R * 0.74, 0.009, 0.008, 0.005, 0x8ab040); g.box(sx * R * 0.4, R * 0.2, R * 0.75, 0.0035, 0.008, 0.005, 0x101010); }
    const ec = col(0, top + 0.1, len * 0.5, 'ear');
    for (const sx of [1, -1]) g.tube([[sx * R * 0.55, R * 0.55, -R * 0.1, R * 0.3, R * 0.1], [sx * R * 0.62, R * 1.25, -R * 0.14, R * 0.02, R * 0.02]], () => ec, 4, 'y');
    P.head = g.build(); P.headAt = [0, top + 0.02, len * 0.55]; }
  const leg = () => { const g = new Loft(), L = h - deep * 0.55, r = 0.016, c = (x, y, z) => col(x, y + L, z, 'leg'); g.tube([[0, 0.012, 0, r * 1.3, r * 1.5], [0, -L * 0.5, 0, r * 0.9, r], [0, -L + 0.008, r * 0.4, r * 0.95, r * 1.4], [0, -L, r * 0.4, r * 0.85, r * 1.3]], c, 5, 'y'); return { g: g.build(), L }; };
  const l = leg(); P.legF = l.g; P.legB = l.g; P.LF = P.LB = l.L;
  { const g = new Loft(), T = 0.3, r = 0.014, c = (x, y, z) => col(x, y + top, z - len * 0.5, 'tail');
    g.tube([[0, 0, 0, r, r], [0, 0, -T * 0.33, r * 0.95, r * 0.95], [0, 0, -T * 0.66, r * 0.9, r * 0.9], [0, 0, -T, r * 0.5, r * 0.5]], c, 5);
    P.tail = g.build(); }
  P.dims = { h, len, w: hw * 2, deep, top };
  return P;
}

// ------------------------------------------------------------------------------------------------ tortoise
function tortoiseParts(seed) {
  const P = {}, len = 0.3, hw = 0.115, h = 0.15, shell = 0x6a5a34, plate = 0x8a7a44, skin = 0x7a7450;
  { const g = new Loft(), c = (x, y, z) => { const n = patch(x * 30 + 1, y * 30, z * 30, seed), ring = Math.sin(x * 60) * Math.sin(z * 50 + 1.2); return shade(y < 0.055 ? 0x9a8a5a : ring > 0.25 ? plate : shell, 0.9 + n * 0.2); };
    // the carapace: a dome, lofted from tail to head; the plastron: a flat plate under it
    g.tube([[0, 0.06, -len * 0.5, hw * 0.3, 0.02], [0, 0.085, -len * 0.38, hw * 0.8, 0.05], [0, 0.1, -len * 0.12, hw, 0.072], [0, 0.1, len * 0.14, hw * 0.98, 0.07], [0, 0.085, len * 0.38, hw * 0.76, 0.048], [0, 0.065, len * 0.5, hw * 0.3, 0.022]], c, 10);
    P.body = g.build(); }
  { const g = new Loft(), c = () => skin;
    g.tube([[0, 0, -0.03, 0.016, 0.014], [0, 0.004, 0.02, 0.018, 0.016], [0, 0.008, 0.05, 0.022, 0.02], [0, 0.006, 0.075, 0.016, 0.014]], c, 6);
    for (const sx of [1, -1]) g.box(sx * 0.017, 0.016, 0.06, 0.003, 0.004, 0.004, 0x101010);
    P.head = g.build(); P.headAt = [0, 0.07, len * 0.46]; }
  { const g = new Loft(), L = 0.065, r = 0.02; g.tube([[0, 0.005, 0, r * 1.1, r * 1.1], [0, -L * 0.6, 0, r, r], [0, -L, 0.004, r * 1.1, r * 1.2]], () => shade(skin, 0.9), 5, 'y'); P.legF = P.legB = g.build(); P.LF = P.LB = L; }
  { const g = new Loft(); g.tube([[0, 0, 0, 0.012, 0.01], [0, -0.01, -0.04, 0.004, 0.004]], () => skin, 4); P.tail = g.build(); }
  P.dims = { h, len, w: hw * 2, deep: 0.1, top: 0.1 };
  return P;
}

// ------------------------------------------------------------------------------------------------ the animal
class Animal {
  constructor(kind, opts = {}) {
    const seed = (opts.seed >>> 0) || 1, rnd = mulberry(seed ^ 0x3c6ef372);
    this.kind = kind; this.seed = seed;
    let P, key;
    if (kind === 'dog') {
      let breed = DOGS[opts.breed] ? opts.breed : null;
      if (!breed) { let tot = 0; for (const [, n] of DOG_ODDS) tot += n; let x = rnd() * tot; for (const [b, n] of DOG_ODDS) { x -= n; if (x <= 0) { breed = b; break; } } breed = breed || 'labrador'; } else rnd();
      const ci = Math.floor(rnd() * DOGS[breed].coat.length), ps = Math.floor(rnd() * 4);
      this.breed = breed; key = `dog:${breed}:${ci}:${ps}`; P = acquire(key, () => dogParts(breed, ci, ps + 1));
      this.gait = DOGS[breed].h < 0.33 ? 1.35 : 1;                       // (little legs go faster)
    } else if (kind === 'cat') {
      const ci = opts.coat !== undefined ? opts.coat % CATS.length : Math.floor(rnd() * CATS.length), ps = Math.floor(rnd() * 4);
      this.breed = CATS[ci][2]; key = `cat:${ci}:${ps}`; P = acquire(key, () => catParts(ci, ps + 1)); this.gait = 1.2;
    } else { this.breed = 'tortoise'; key = `tortoise:${seed % 3}`; P = acquire(key, () => tortoiseParts(seed % 3)); this.gait = 1; }
    this._key = key; this.P = P;
    // (the parts object holds the geometries: cache entries dispose through this)
    if (!P._wrapped) { P._wrapped = true; P.dispose = () => { for (const k of ['body', 'head', 'ears', 'legF', 'legB', 'tail']) if (P[k] && P[k].dispose) P[k].dispose(); }; }
    const D = P.dims, mesh = (g, name) => { const m = new THREE.Mesh(g, characterMaterial); m.name = name; m.castShadow = kind !== 'tortoise' || name === 'body'; return m; };
    this.size = Math.round((0.93 + rnd() * 0.14) * 100) / 100;
    this.group = new THREE.Group(); this.group.name = kind;
    this.rig = new THREE.Group(); this.rig.scale.setScalar(this.size); this.group.add(this.rig);
    this.body = mesh(P.body, 'body'); this.rig.add(this.body);
    this.head = mesh(P.head, 'head'); this.head.position.set(P.headAt[0], P.headAt[1], P.headAt[2]); this.body.add(this.head);
    if (P.ears) { this.ears = mesh(P.ears, 'ears'); this.head.add(this.ears); }
    this.tail = mesh(P.tail, 'tail'); this.tail.position.set(0, kind === 'tortoise' ? 0.06 : D.top - D.deep * 0.3, -D.len * 0.5); this.body.add(this.tail);
    this.legs = [];
    const lx = kind === 'tortoise' ? D.w * 0.42 : D.w * 0.3, fz = kind === 'tortoise' ? D.len * 0.3 : D.len * 0.36, bz = kind === 'tortoise' ? -D.len * 0.3 : -D.len * 0.38;
    for (let i = 0; i < 4; i++) {
      const front = i < 2, m = mesh(front ? P.legF : P.legB, 'leg');
      m.position.set((i % 2 ? -1 : 1) * lx, front ? P.LF : P.LB, front ? fz : bz); this.body.add(m); this.legs.push(m);
    }
    this.dims = D; this.height = D.h * this.size; this.length = (D.len + (kind === 'dog' ? DOGS[this.breed].snout + DOGS[this.breed].head : 0.1)) * this.size; this.radius = Math.max(0.16, D.len * 0.5 * this.size);
    this.collar = new THREE.Vector3(0, (D.top + D.h * 0.1) * this.size, D.len * 0.5 * this.size);
    this.pose = 'stand'; this.t = rnd() * 10; this.phase = rnd() * TAU; this.speed = 0; this.excite = 0.3 + rnd() * 0.5;
    this._gx = NaN; this._gz = NaN; this._moved = 0; this._k = { sit: 0, lie: 0, sniff: 0, squat: 0, mark: 0, bark: 0, beg: 0, loaf: 0, crouch: 0, hide: 0 };
    this._yaw = 0; this._pitch = 0; this._yawT = 0; this._pitchT = 0; this._markSide = rnd() < 0.5 ? 1 : -1;
  }
  setPose(name) { this.pose = name || 'stand'; }
  /** turn the head (radians, relative to the body): what it is watching */
  look(yaw = 0, pitch = 0) { this._yawT = Math.max(-1.3, Math.min(1.3, yaw)); this._pitchT = Math.max(-0.6, Math.min(0.6, pitch)); }
  update(dt, speed = 0) {
    dt = dt > 0 ? Math.min(dt, 0.1) : 0; this.t += dt;
    const K = this._k, kind = this.kind, D = this.dims, e = Math.min(1, dt * 7);
    for (const k in K) K[k] += ((this.pose === k ? 1 : 0) - K[k]) * e;
    // the gait follows the ground really covered (the group's own movement), as the walkers' does: no sliding paws
    const gp = this.group.position; let d = 0;
    if (this._gx === this._gx) { d = Math.hypot(gp.x - this._gx, gp.z - this._gz); if (d > 0.08 + 14 * dt) d = 0; }
    this._gx = gp.x; this._gz = gp.z; if (d > 0) this._moved += d;
    const real = this._moved > 0.15;
    this.speed += ((real ? (dt > 0 ? d / dt : this.speed) : Math.abs(speed)) - this.speed) * Math.min(1, dt * 9);
    const sp = this.speed, L = (kind === 'tortoise' ? 0.065 : D.h * 0.55) * this.size, m = sm(0.03, kind === 'tortoise' ? 0.05 : 0.5, sp), run = kind === 'dog' ? sm(2.6, 4.2, sp) : kind === 'cat' ? sm(2.2, 3.5, sp) : 0;
    const amp = (kind === 'tortoise' ? 0.5 : 0.42 + 0.3 * run) * m, stride = 4 * L * Math.max(0.15, Math.sin(amp)) * (1 + 0.9 * run);
    this.phase = (this.phase + TAU * (real ? d : dt * sp) / Math.max(0.05, stride)) % TAU;
    const tri = (a) => Math.asin(Math.sin(a)) * (2 / Math.PI);
    const still = 1 - m, sit = K.sit, lie = Math.max(K.lie, K.loaf), sq = K.squat, sniff = K.sniff, mark = K.mark, bark = K.bark, beg = K.beg, cr = K.crouch, hide = K.hide;
    // legs: a trot (diagonal pairs) that becomes a gallop (front pair, then back pair) when it runs
    const ph = this.phase, f0 = tri(ph), f1 = tri(ph + Math.PI * (1 - run * 0.82)), b0 = tri(ph + Math.PI * (1 - run * 0.5)), b1 = tri(ph + Math.PI * run * 0.32);
    const lg = this.legs;
    lg[0].rotation.x = f0 * amp; lg[1].rotation.x = f1 * amp; lg[2].rotation.x = b0 * amp; lg[3].rotation.x = b1 * amp;
    let bodyY = 0, pitch = 0, roll = 0;
    if (kind !== 'tortoise') {
      bodyY += Math.abs(Math.cos(ph)) * 0.012 * m * this.size + run * Math.sin(ph * 2) * 0.03;
      pitch += run * Math.sin(ph) * 0.14;
      // sitting: haunches down, forelegs straight; lying: all the way down, forelegs out in front
      const down = Math.max(sit * 0.5, lie * 0.9, sq * 0.32, cr * 0.3) * still;
      pitch += (-0.52 * sit - 0.3 * sq - 0.75 * beg + 0.2 * sniff * (kind === 'dog' ? 1 : 0.6)) * (sit + sq + beg + sniff > 0 ? 1 : 0);
      bodyY -= ((sit * 0.2 + sq * 0.12) * D.h * 0.9 + lie * (D.h - D.deep * 0.62) + cr * D.h * 0.22) * (lie > 0.02 || cr > 0.02 ? 1 : still);
      if (sit > 0.02 || sq > 0.02) { const a = -(1.15 * sit + 0.95 * sq); lg[2].rotation.x = lg[2].rotation.x * (1 - sit - sq) + a; lg[3].rotation.x = lg[3].rotation.x * (1 - sit - sq) + a; lg[0].rotation.x += 0.5 * sit; lg[1].rotation.x += 0.5 * sit; }
      if (lie > 0.02) { lg[0].rotation.x = lg[0].rotation.x * (1 - lie) + 1.45 * lie; lg[1].rotation.x = lg[1].rotation.x * (1 - lie) + 1.45 * lie; lg[2].rotation.x = lg[2].rotation.x * (1 - lie) + 1.35 * lie; lg[3].rotation.x = lg[3].rotation.x * (1 - lie) + 1.35 * lie; }
      if (beg > 0.02) { lg[0].rotation.x = 0.9 * beg + 0.25 * Math.sin(this.t * 9) * beg; lg[1].rotation.x = 0.9 * beg - 0.25 * Math.sin(this.t * 9) * beg; lg[2].rotation.x = -1.1 * beg; lg[3].rotation.x = -1.1 * beg; }
      // a cat loafing: the paws tucked away under it
      if (kind === 'cat') { const lf = K.loaf; for (const q of lg) q.scale.y = 1 - 0.8 * lf; if (lf > 0.02) for (const q of lg) q.rotation.x *= 1 - lf; }
      // a leg cocked at a lamp post
      const mi = this._markSide > 0 ? 2 : 3; lg[mi].rotation.z = this._markSide * 1.05 * mark; lg[5 - mi].rotation.z = 0; roll = -this._markSide * 0.08 * mark;
      if (mark > 0.02) lg[mi].rotation.x = lg[mi].rotation.x * (1 - mark) - 0.3 * mark;
      // barking: the forequarters jump with each bark
      if (bark > 0.02) { const b = Math.max(0, Math.sin(this.t * 13)) * bark; pitch -= 0.1 * b; bodyY += 0.025 * b * this.size; }
      void down;
    } else {
      // tortoise: a plod; drawn in when it hides
      bodyY = Math.abs(Math.sin(ph)) * 0.004 * m - hide * 0.022;
      for (const l of lg) { l.rotation.x = l.rotation.x * (1 - hide); l.scale.y = 1 - 0.55 * hide; }
    }
    const b = this.body;
    b.position.y += (bodyY - b.position.y) * Math.min(1, dt * 12);
    b.rotation.x += (pitch - b.rotation.x) * Math.min(1, dt * 10); b.rotation.z += (roll - b.rotation.z) * Math.min(1, dt * 8);
    // head: watches (look), noses the ground (sniff), lifts to bark; a cat's stays level when the body slinks
    this._yaw += (this._yawT - this._yaw) * Math.min(1, dt * 5); this._pitch += (this._pitchT - this._pitch) * Math.min(1, dt * 5);
    const hd = this.head;
    if (kind === 'tortoise') { hd.position.z = this.P.headAt[2] - 0.075 * hide; hd.rotation.y = this._yaw * 0.6 * (1 - hide); hd.rotation.x = -0.15 + 0.12 * Math.sin(this.t * 0.6); }
    else {
      hd.rotation.y = this._yaw + 0.22 * Math.sin(this.t * 0.6) * still * (1 - sniff) * (1 - bark);
      hd.rotation.x = this._pitch - pitch * 0.85 + sniff * (0.85 + 0.08 * Math.sin(this.t * 8)) + lie * 0.25 * (this.pose === 'loaf' ? 0.3 : 1) - bark * (0.3 + 0.2 * Math.max(0, Math.sin(this.t * 13))) + run * 0.1 + cr * 0.15;
      hd.position.y = this.P.headAt[1] - sniff * D.h * 0.16 - lie * D.h * 0.05 - cr * D.h * 0.1;
    }
    // tail
    const tl = this.tail;
    if (kind === 'dog') {
      const carry = DOGS[this.breed].tail[1], base = carry === 'up' ? 1.05 : carry === 'curl' ? 0.15 : carry === 'sabre' ? 0.25 : -0.45;
      const happy = Math.max(this.excite * still, bark * 0.6, beg, m * 0.5);
      tl.rotation.x = base + 0.35 * m + 0.3 * bark - 0.5 * sq - 0.25 * sniff * (carry === 'low' ? 0 : 1) - pitch;
      tl.rotation.y = Math.sin(this.t * (9 + 7 * this.excite)) * (0.25 + 0.55 * happy) * (1 - sq);
    } else if (kind === 'cat') {
      // up like a flag when it walks to you, low when it slinks, wrapped round the feet when it sits; the tip twitches
      tl.rotation.x = (1.2 * m * (1 - cr) - 0.35 * cr + 0.2) * (1 - sit - lie) - pitch; tl.rotation.y = (sit + lie) * 2.1 + Math.sin(this.t * 1.7) * 0.18 * (1 - sit - lie) + Math.max(0, Math.sin(this.t * 3.1) - 0.8) * 1.2;
    } else tl.rotation.y = Math.sin(this.t * 0.8) * 0.3;
  }
  dispose() { const e = cache.get(this._key); if (e && e.n <= 1 && this.P.dispose) { this.P.dispose(); cache.delete(this._key); } else if (e) e.n--; }
}
/** see the header */
export function createAnimal(kind, opts) { return new Animal(kind === 'cat' || kind === 'tortoise' ? kind : 'dog', opts); }
/** a dog for a lead (pedestrians.js): the old createDog contract — group, update, setPose, collar, dispose */
export function createTownDog(opts) { return new Animal('dog', opts); }

// ------------------------------------------------------------------------------------------------ sound
/** a bark at (x, y, z): one or two short yaps, pitched by the dog's size (a terrier yaps, a labrador woofs). Through
 *  game.audio.spatial when the game has it (core/audio.js, 2026-11), else panned and faded by distance as before. */
export function bark(audio, x, y, z, height = 0.45, n = 2) {
  if (!audio || !audio.ctx) return;
  const f0 = 620 - Math.min(0.75, Math.max(0.2, height)) * 560;
  let dest = null, gain = 0.2, pan = 0;
  if (audio.spatial) { const h = audio.spatial({ x, y: y + height, z }, { cls: 'small', ttl: 1.5 }); if (!h) return; dest = h.in || h; }
  else if (audio.place) { const pl = audio.place(x, z, 45); if (pl.gain < 0.02) return; gain *= pl.gain; pan = pl.pan; }
  for (let i = 0; i < n; i++) {
    const when = i * 0.19;
    audio.tone(f0 * 1.25, 0.07, { type: 'sawtooth', gain: gain * 0.8, attack: 0.004, when, dest, pan });
    audio.tone(f0 * 0.8, 0.11, { type: 'square', gain: gain * 0.5, attack: 0.01, when: when + 0.03, dest, pan });
    audio.noise(0.09, { gain: gain * 0.7, freq: f0 * 2.4, q: 1.2, when, dest, pan });
  }
}
/** a child's scooter's hard little wheels on the path: a short rattle (call it a few times a second while it rolls) */
export function scooterRattle(audio, x, y, z, speed = 2) {
  if (!audio || !audio.ctx) return;
  let dest = null, gain = 0.05 * Math.min(1.5, speed / 2), pan = 0;
  if (audio.spatial) { const h = audio.spatial({ x, y: y + 0.05, z }, { cls: 'step', ttl: 0.8 }); if (!h) return; dest = h.in || h; }
  else if (audio.place) { const pl = audio.place(x, z, 25); if (pl.gain < 0.03) return; gain *= pl.gain; pan = pl.pan; }
  audio.noise(0.22, { gain, freq: 2600, q: 0.7, dest, pan, attack: 0.02 });
}
