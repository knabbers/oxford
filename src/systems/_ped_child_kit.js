// What children have with them (2026-11-21): the pushchair a parent pushes (with the small child in it), a scooter, a
// kite on its line, a football. Vertex-coloured geometry in the characters' shared material (no texture, no new shader),
// one mesh each (the kite's line is a second, a THREE.Line in the dog lead's material). Shared, reference-free: built
// once per colour and kept (a handful of small geometries).
import * as THREE from 'three';
import { characterMaterial } from '../core/characters.js';
import { Loft } from './_ped_pets.js';

const cache = new Map();
const geo = (key, make) => { let g = cache.get(key); if (!g) cache.set(key, (g = make())); return g; };
const mesh = (g, name) => { const m = new THREE.Mesh(g, characterMaterial); m.name = name; m.castShadow = true; return m; };
const FABRIC = [0x1f2a44, 0x7a1f2a, 0x2a4a3a, 0x3a3a40, 0x5a3a6a, 0x1f5a6a];

/** a pushchair (stroller) with a small child sitting in it; origin on the ground under the middle, +z forwards; the
 *  handle is at (0, 1.0, -0.42). seed picks the fabric, the child's clothes and hair. */
export function createPushchair(seed = 1) {
  const k = (seed >>> 0) % 24;
  return mesh(geo('pram' + k, () => {
    const g = new Loft(), fab = FABRIC[k % FABRIC.length], frame = 0x2a2c30, skin = [0xf0c8a8, 0xe0b090, 0xb07850, 0x7a4a30][k % 4], hair = [0x3b2616, 0xc9a25a, 0x1a1412, 0x7a4a26][(k >> 2) % 4], top = [0xd23a3a, 0x2f6fd0, 0xe2b93a, 0x2f9a5a, 0xe26a9a, 0x8a4ab8][k % 6];
    const bar = (x0, y0, z0, x1, y1, z1, r, c) => g.tube([[0, 0, 0, r, r], [0, 0, 1, r, r]].map((q, i) => i ? [x1, y1, z1, r, r] : [x0, y0, z0, r, r]), () => c, 5, Math.abs(y1 - y0) > Math.abs(z1 - z0) ? 'y' : 'z');
    for (const sx of [1, -1]) {
      bar(sx * 0.24, 0.16, 0.34, sx * 0.24, 0.62, -0.12, 0.012, frame);        // front leg up to the seat hinge
      bar(sx * 0.24, 0.16, -0.3, sx * 0.24, 0.62, -0.12, 0.012, frame);        // rear leg
      bar(sx * 0.24, 0.62, -0.12, sx * 0.22, 1.0, -0.42, 0.012, frame);        // handle upright
      for (const z of [0.34, -0.3]) g.tube([[sx * 0.265, 0.09, z - 0.09, 0.02, 0.0], [sx * 0.265, 0.09, z - 0.064, 0.02, 0.064], [sx * 0.265, 0.09, z, 0.02, 0.09], [sx * 0.265, 0.09, z + 0.064, 0.02, 0.064], [sx * 0.265, 0.09, z + 0.09, 0.02, 0.0]], () => 0x18181a, 6);     // wheels
    }
    g.box(0, 1.0, -0.42, 0.24, 0.014, 0.014, 0x18181a);                        // handle bar
    g.box(0, 0.47, 0.08, 0.2, 0.02, 0.17, fab);                                // seat
    g.box(0, 0.68, -0.14, 0.2, 0.2, 0.02, fab, 0, 0.3);                        // back rest
    g.box(0, 0.3, 0.27, 0.19, 0.015, 0.07, fab, 0, -0.5);                      // foot rest
    g.box(0, 0.93, -0.12, 0.215, 0.012, 0.13, shade(fab, 0.8), 0, -0.25);      // hood
    g.box(0, 0.25, -0.02, 0.19, 0.01, 0.22, 0x33353a);                         // basket
    // the child: body, legs out in front, head
    g.tube([[0, 0.5, 0.0, 0.1, 0.085], [0, 0.6, -0.03, 0.11, 0.09], [0, 0.72, -0.06, 0.085, 0.075]], () => top, 7, 'y');
    for (const sx of [1, -1]) g.tube([[sx * 0.055, 0.52, 0.04, 0.04, 0.04], [sx * 0.06, 0.5, 0.2, 0.034, 0.034], [sx * 0.06, 0.4, 0.27, 0.03, 0.03]], () => 0x35507a, 5);
    g.tube([[0, 0.74, -0.06, 0.04, 0.04], [0, 0.79, -0.055, 0.082, 0.085], [0, 0.86, -0.05, 0.088, 0.09], [0, 0.93, -0.055, 0.06, 0.066]], (x, y, z) => (y > 0.89 || z < -0.1 ? hair : skin), 8, 'y');
    for (const sx of [1, -1]) g.box(sx * 0.03, 0.86, 0.035, 0.008, 0.009, 0.004, 0x1a1412);
    return g.build();
  }), 'pushchair');
}
const _c = new THREE.Color();
function shade(hex, k) { _c.set(hex); _c.multiplyScalar(k); return _c.getHex(); }

/** a child's kick scooter: origin on the ground under the deck's middle, +z forwards; the grips are at y = h */
export function createScooter(seed = 1, h = 0.72) {
  const k = (seed >>> 0) % 6, c = [0xd23a3a, 0x2f6fd0, 0xe26a9a, 0x2f9a5a, 0xc0c4cc, 0xe07a2a][k];
  return mesh(geo('scoot' + k + ':' + h.toFixed(2), () => {
    const g = new Loft();
    g.box(0, 0.045, -0.02, 0.055, 0.01, 0.2, c);
    g.tube([[0, 0.07, 0.2, 0.012, 0.012], [0, h, 0.24, 0.012, 0.012]], () => 0xb8bcc4, 5, 'y');
    g.box(0, h, 0.24, 0.15, 0.012, 0.012, 0x18181a);
    for (const z of [0.25, -0.24]) g.tube([[0, 0.05, z - 0.05, 0.014, 0.0], [0, 0.05, z - 0.035, 0.014, 0.036], [0, 0.05, z, 0.014, 0.05], [0, 0.05, z + 0.035, 0.014, 0.036], [0, 0.05, z + 0.05, 0.014, 0.0]], () => 0x222226, 6);
    return g.build();
  }), 'scooter');
}
/** a diamond kite with a tail (origin at its middle, flying in the x-y plane) */
export function createKite(seed = 1) {
  const k = (seed >>> 0) % 5, a = [0xd23a3a, 0x2f6fd0, 0xe2b93a, 0x2f9a5a, 0x8a4ab8][k], b = [0xe2b93a, 0xf0f0f0, 0xd23a3a, 0xe2b93a, 0xf0f0f0][k];
  const m = mesh(geo('kite' + k, () => {
    const P = [], N = [], C = [], col = new THREE.Color();
    const tri = (p, q, r, c) => { for (const v of [p, q, r]) { P.push(v[0], v[1], v[2]); N.push(0, 0, 1); col.set(c); C.push(col.r, col.g, col.b); } };
    const T = [0, 0.42, 0], B = [0, -0.5, 0], L = [-0.32, 0.12, 0], R = [0.32, 0.12, 0], M = [0, 0.12, 0.03];
    for (const z of [1, -1]) { const f = (p, q, r, c) => (z > 0 ? tri(p, q, r, c) : tri(p, r, q, c)); f(T, L, M, a); f(T, M, R, b); f(L, B, M, b); f(M, B, R, a); }
    for (let i = 0; i < 5; i++) { const y = -0.56 - i * 0.16, x = Math.sin(i * 1.3) * 0.05; tri([x - 0.05, y, 0], [x + 0.05, y, 0], [x, y - 0.08, 0], i % 2 ? a : b); tri([x - 0.05, y, 0], [x, y - 0.08, 0], [x + 0.05, y, 0], i % 2 ? a : b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeBoundingSphere();
    return g;
  }), 'kite');
  m.castShadow = false;
  return m;
}
/** a football (0.11 m radius; origin at its centre) */
export function createBall(seed = 1) {
  const k = (seed >>> 0) % 3;
  return mesh(geo('ball' + k, () => {
    const g = new THREE.IcosahedronGeometry(0.11, 1).toNonIndexed(), p = g.attributes.position, C = new Float32Array(p.count * 3), col = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) { col.set(((i / 3) * 7 + k) % 5 < 2 ? [0x1a1a1c, 0xd23a3a, 0x2f6fd0][k] : 0xf2f2ee); for (let j = 0; j < 3; j++) { C[(i + j) * 3] = col.r; C[(i + j) * 3 + 1] = col.g; C[(i + j) * 3 + 2] = col.b; } }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeVertexNormals();
    return g;
  }), 'ball');
}
