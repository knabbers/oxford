// Port Meadow — the animals, drawn. Like the Christ Church Meadow Longhorns (_ccm_cattle.js): ONE InstancedMesh per kind
// (+ its shadow), built once from a few primitives with vertex colours; every vertex is tagged with its body part and
// that part's pivot, and the vertex shader swings the legs (walk), lowers the head (graze), folds the legs (lie down)
// and swishes the tail from per-instance values. Where each animal is and what it does: _ccm_herd.js (shared clock).
//   horses  commoners' ponies and horses: bay, chestnut, black, grey, skewbald; long neck, mane, long tail
//   cattle  mixed commoners' cattle (short horns or none): black, red, belted, roan
//   geese / ducks  small rigid models, one instanced draw each (positions from _pm_site.js)
import * as THREE from 'three';

const PART = { body: 0, head: 1, legFL: 2, legFR: 3, legHL: 4, legHR: 5, tail: 6 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; this.part = []; this.piv = []; this.mask = []; this.tris = 0; }
  add(geo, { pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], col, part = PART.body, pivot = [0, 0, 0] }) {
    const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position, N = g.attributes.normal;
    _m.compose(_v.set(...pos), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ')), _s.set(...scl));
    const nm = new THREE.Matrix3().getNormalMatrix(_m), nv = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); nv.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      this.p.push(_v.x, _v.y, _v.z); this.n.push(nv.x, nv.y, nv.z);
      const k = col(_v.x, _v.y, _v.z, nv.x, nv.y, nv.z); this.c.push(k[0], k[1], k[2]); this.mask.push(k[3]);
      this.part.push(part); this.piv.push(...pivot);
    }
    this.tris += P.count / 3; if (g !== geo) g.dispose(); geo.dispose();
  }
  geometry(rig = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (rig) { g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1)); g.setAttribute('aPivot', new THREE.Float32BufferAttribute(this.piv, 3)); g.setAttribute('aMask', new THREE.Float32BufferAttribute(this.mask, 1)); }
    g.computeBoundingSphere();
    return g;
  }
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const solid = (r, g, b) => () => [r, g, b, 0];
function tube(pts, r0, r1, radial = 5, seg = 6) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const pos = [], idx = [], fr = curve.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, P = curve.getPointAt(t), r = r0 + (r1 - r0) * t, N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j < radial; j++) { const a = (j / radial) * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a); pos.push(P.x + r * (cx * N.x + sx * B.x), P.y + r * (cx * N.y + sx * B.y), P.z + r * (cx * N.z + sx * B.z)); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** a horse facing +z, origin between the feet, ~1.55 m at the withers. coat = mask 1 (tinted per horse); white blaze / socks mask 0 */
export function horseGeometry() {
  const B = new Builder();
  const coat = (x, y, z) => { const v = 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(z * 7 + y * 4)); return [v, v, v, 1]; };
  // barrel, chest, hindquarters (rounder rump, deeper chest than a cow; slimmer overall)
  B.add(new THREE.SphereGeometry(1, 10, 7), { pos: [0, 1.22, 0.02], rot: [Math.PI / 2, 0, 0], scl: [0.3, 0.78, 0.34], col: coat });
  B.add(new THREE.SphereGeometry(1, 8, 6), { pos: [0, 1.25, 0.5], rot: [Math.PI / 2, 0, 0], scl: [0.28, 0.36, 0.38], col: coat });
  B.add(new THREE.SphereGeometry(1, 8, 6), { pos: [0, 1.28, -0.5], rot: [Math.PI / 2, 0, 0], scl: [0.31, 0.4, 0.36], col: coat });
  for (const s of [-1, 1]) B.add(new THREE.SphereGeometry(1, 6, 4), { pos: [s * 0.14, 1.3, -0.62], scl: [0.17, 0.26, 0.24], col: coat });      // the quarters
  // neck, head (pivot at the withers) — the long neck rising forward; mane along its top
  const NP = [0, 1.45, 0.62], head = { part: PART.head, pivot: NP };
  B.add(new THREE.CylinderGeometry(0.12, 0.25, 0.88, 8, 2), { ...head, pos: [0, 1.72, 0.88], rot: [0.72, 0, 0], scl: [0.8, 1, 1.15], col: coat });
  // the head: a long tapering skull (muzzle narrower), round cheeks, a dark soft muzzle with nostrils
  B.add(new THREE.CylinderGeometry(0.075, 0.115, 0.6, 8, 1), { ...head, pos: [0, 1.98, 1.24], rot: [1.0 + Math.PI / 2, 0, 0], scl: [0.85, 1, 1.15], col: coat });
  B.add(new THREE.SphereGeometry(1, 6, 4), { ...head, pos: [0, 2.03, 1.1], scl: [0.11, 0.12, 0.14], col: coat });
  B.add(new THREE.SphereGeometry(1, 6, 4), { ...head, pos: [0, 1.79, 1.44], scl: [0.075, 0.07, 0.09], col: solid(0.16, 0.13, 0.12) });
  for (const s of [-1, 1]) B.add(new THREE.SphereGeometry(0.018, 4, 3), { ...head, pos: [s * 0.035, 1.79, 1.52], col: solid(0.02, 0.02, 0.02) });
  for (let k = 0; k < 5; k++) { const t = k / 4; B.add(new THREE.BoxGeometry(0.05, 0.14, 0.13), { ...head, pos: [0.025 * ((k % 2) * 2 - 1), 1.5 + 0.48 * t, 0.62 + 0.42 * t], rot: [0.72, 0, (k % 2 ? 0.25 : -0.25)], col: solid(0.06, 0.05, 0.04) }); }   // mane (dark, in locks)
  B.add(new THREE.BoxGeometry(0.1, 0.12, 0.05), { ...head, pos: [0, 2.15, 1.12], rot: [0.6, 0, 0], col: solid(0.06, 0.05, 0.04) });          // forelock
  B.add(new THREE.BoxGeometry(0.06, 0.08, 0.32), { ...head, pos: [0, 2.0, 1.28], rot: [1.0, 0, 0], col: (x, y, z) => [0.92, 0.9, 0.86, 0] });  // blaze
  for (const s of [-1, 1]) {
    B.add(new THREE.ConeGeometry(0.04, 0.14, 4), { ...head, pos: [s * 0.07, 2.2, 1.06], col: coat });                                      // ears
    B.add(new THREE.SphereGeometry(0.025, 3, 2), { ...head, pos: [s * 0.1, 2.06, 1.2], col: solid(0.01, 0.01, 0.01) });                     // eyes
  }
  // legs: long and slim, dark lower legs and hooves, white socks on some (mask 0 on the cannon)
  const legs = [[PART.legFL, -0.15, 0.5], [PART.legFR, 0.15, 0.5], [PART.legHL, -0.16, -0.55], [PART.legHR, 0.16, -0.55]];
  for (const [part, x, z] of legs) {
    const top = 1.1, pv = [x, top, z], front = z > 0;
    B.add(new THREE.CylinderGeometry(front ? 0.085 : 0.11, 0.055, 0.55, 6, 1, true), { part, pivot: pv, pos: [x, top - 0.27, z + (front ? 0 : -0.04)], col: coat });
    B.add(new THREE.SphereGeometry(0.062, 5, 3), { part, pivot: pv, pos: [x, 0.56, z + (front ? 0.01 : -0.03)], col: (X, Y, Z) => (part === PART.legHL || part === PART.legFR ? [0.9, 0.88, 0.84, 0] : coat(X, Y, Z)) });   // knee / hock
    B.add(new THREE.CylinderGeometry(0.042, 0.048, 0.48, 7, 1, true), { part, pivot: pv, pos: [x, 0.3, z], col: (X, Y, Z) => (part === PART.legHL || part === PART.legFR ? [0.9, 0.88, 0.84, 0] : [0.07, 0.06, 0.05, 0]) });
    B.add(new THREE.SphereGeometry(0.055, 5, 3), { part, pivot: pv, pos: [x, 0.09, z + 0.02], scl: [1, 0.8, 1], col: (X, Y, Z) => [0.07, 0.06, 0.05, 0] });   // fetlock
    B.add(new THREE.CylinderGeometry(0.055, 0.072, 0.08, 7, 1, false), { part, pivot: pv, pos: [x, 0.04, z + 0.03], col: solid(0.03, 0.025, 0.02) });
  }
  // tail: long dark hair, hanging
  const TP = [0, 1.36, -0.85];
  B.add(tube([[0, 1.38, -0.84], [0, 1.24, -0.98], [0, 0.9, -1.02], [0, 0.5, -0.98]], 0.075, 0.055, 6, 5), { part: PART.tail, pivot: TP, col: solid(0.05, 0.04, 0.03) });
  return { geometry: B.geometry(), tris: B.tris };
}
// horse coats (linear multipliers): bay, chestnut, black, grey, dun, dark bay
export const HORSE_COATS = [[0.2, 0.07, 0.025], [0.36, 0.12, 0.04], [0.025, 0.022, 0.02], [0.62, 0.6, 0.56], [0.45, 0.33, 0.18], [0.1, 0.04, 0.018]];

/** a commoners' cow: no long horns, a squarer head; coat mask 1, belly/belt mask 0 for the belted coats (aCoat.w > 0.5) */
export function cattleGeometry() {
  const B = new Builder();
  const coat = (x, y, z) => { const v = 0.85 + 0.15 * (0.5 + 0.5 * Math.sin(z * 11 + y * 3)); return [v, v, v, 1]; };
  B.add(new THREE.SphereGeometry(1, 16, 10), { pos: [0, 0.98, -0.02], rot: [Math.PI / 2, 0, 0], scl: [0.36, 0.95, 0.4], col: coat });
  B.add(new THREE.SphereGeometry(1, 12, 8), { pos: [0, 1.0, 0.55], rot: [Math.PI / 2, 0, 0], scl: [0.33, 0.48, 0.42], col: coat });
  B.add(new THREE.SphereGeometry(1, 12, 8), { pos: [0, 1.04, -0.6], rot: [Math.PI / 2, 0, 0], scl: [0.35, 0.46, 0.38], col: coat });
  const NP = [0, 1.1, 0.78], head = { part: PART.head, pivot: NP };
  B.add(new THREE.CylinderGeometry(0.21, 0.28, 0.45, 8), { ...head, pos: [0, 1.12, 0.98], rot: [1.25, 0, 0], col: coat });
  B.add(new THREE.BoxGeometry(0.32, 0.34, 0.42, 1, 1, 1), { ...head, pos: [0, 1.06, 1.3], rot: [0.75, 0, 0], col: coat });
  B.add(new THREE.BoxGeometry(0.26, 0.18, 0.16), { ...head, pos: [0, 0.88, 1.47], rot: [0.75, 0, 0], col: solid(0.32, 0.24, 0.22) });   // muzzle
  for (const s of [-1, 1]) {
    B.add(new THREE.BoxGeometry(0.17, 0.05, 0.09), { ...head, pos: [s * 0.22, 1.2, 1.2], rot: [0, s * 0.3, s * 0.35], col: coat });
    B.add(new THREE.ConeGeometry(0.025, 0.12, 4), { ...head, pos: [s * 0.13, 1.3, 1.22], rot: [0, 0, -s * 1.1], col: solid(0.7, 0.64, 0.5) });   // short horns
    B.add(new THREE.SphereGeometry(0.025, 3, 2), { ...head, pos: [s * 0.15, 1.12, 1.33], col: solid(0.01, 0.01, 0.01) });
  }
  const legs = [[PART.legFL, -0.2, 0.62], [PART.legFR, 0.2, 0.62], [PART.legHL, -0.21, -0.66], [PART.legHR, 0.21, -0.66]];
  for (const [part, x, z] of legs) {
    const top = 0.9, pv = [x, top, z];
    B.add(new THREE.CylinderGeometry(0.11, 0.07, 0.48, 6, 1, true), { part, pivot: pv, pos: [x, top - 0.24, z], col: coat });
    B.add(new THREE.CylinderGeometry(0.065, 0.06, 0.42, 6, 1, true), { part, pivot: pv, pos: [x, 0.25, z], col: coat });
    B.add(new THREE.CylinderGeometry(0.065, 0.075, 0.07, 5, 1, true), { part, pivot: pv, pos: [x, 0.035, z], col: solid(0.02, 0.016, 0.014) });
  }
  const TP = [0, 1.28, -1.04];
  B.add(tube([[0, 1.3, -1.03], [0, 1.1, -1.12], [0, 0.8, -1.13], [0, 0.52, -1.1]], 0.035, 0.022, 4), { part: PART.tail, pivot: TP, col: coat });
  B.add(new THREE.ConeGeometry(0.07, 0.22, 5), { part: PART.tail, pivot: TP, pos: [0, 0.42, -1.1], rot: [Math.PI, 0, 0], col: solid(0.04, 0.03, 0.02) });
  // belt: belted-Galloway style white band round the middle (mask 0 under a belted coat: see the shader)
  return { geometry: B.geometry(), tris: B.tris };
}
export const CATTLE_COATS = [[0.02, 0.018, 0.016], [0.24, 0.07, 0.025], [0.13, 0.05, 0.02], [0.4, 0.3, 0.26], [0.03, 0.025, 0.02], [0.3, 0.18, 0.08]];

const GLSL_HEAD = /* glsl */`
attribute float aPart; attribute vec3 aPivot; attribute float aMask; attribute vec4 aAnim; attribute vec4 aCoat;
uniform float uBeastTime; uniform float uNeck;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 beastRot() {
  float ph = aAnim.x, walk = aAnim.y, graze = aAnim.z, lie = aAnim.w, seed = fract(aCoat.w * 7.13);
  if (aPart > 1.5 && aPart < 5.5) {
    float idx = aPart - 2.0, front = idx < 1.5 ? 1.0 : 0.0, side = mod(idx, 2.0);
    float sw = sin(ph + (side > 0.5 ? 3.14159 : 0.0) + (front > 0.5 ? 0.0 : 3.14159)) * 0.42 * walk;
    float fold = lie * (front > 0.5 ? 1.75 : -1.6);
    return rotX(sw + fold);
  }
  if (aPart > 0.5 && aPart < 1.5) {
    float t = uBeastTime + seed * 40.0;
    float down = graze * (uNeck + 0.06 * sin(t * 2.1)) - 0.1 * (1.0 - graze) * (1.0 - lie) + 0.05 * sin(ph * 2.0) * walk + lie * 0.25;
    float yaw = (0.3 * sin(t * 0.37) * (1.0 - 0.6 * graze) + 0.1 * sin(t * 0.9) * graze) * (1.0 - walk);
    return rotY(yaw) * rotX(down);
  }
  if (aPart > 5.5) {
    float t = uBeastTime + seed * 23.0;
    float sw = sin(t * 1.7) * (0.18 + 0.18 * max(0.0, sin(t * 0.29))) + 0.08 * sin(ph) * walk;
    return rotZ(sw) * rotX(-0.05 + lie * 0.35);
  }
  return mat3(1.0);
}
`;
function patch(mat, uniforms, colour, key) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBeastTime = uniforms.uBeastTime; sh.uniforms.uNeck = uniforms.uNeck;
    sh.vertexShader = GLSL_HEAD + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = beastRot() * objectNormal;`)
      .replace('#include <begin_vertex>', `vec3 transformed = beastRot() * (position - aPivot) + aPivot;
        transformed.y -= aAnim.w * 0.6;`);
    // belted coats (aCoat.w >= 0.5): a white band round the barrel
    if (colour) sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
        float belt = step(0.5, aCoat.w) * step(abs(position.z + 0.02), 0.26) * step(0.55, position.y) * step(aPart, 0.5);
        vColor.rgb = mix(vColor.rgb, vColor.rgb * aCoat.rgb, aMask * (1.0 - belt));`);
  };
  mat.customProgramCacheKey = () => 'pm-beast-' + key + (colour ? 'c' : 'd');
  return mat;
}

/** n rigged instances of {geometry} -> {mesh, set(i, x, y, z, h, walk, graze, lie, phase), setCoat(i, rgb, seed, belted, size), commit()} */
export function createRigMesh(name, model, n, neck = 1.05) {
  const { geometry, tris } = model;
  const anim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), coat = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  anim.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aAnim', anim); geometry.setAttribute('aCoat', coat);
  const uniforms = { uBeastTime: { value: 0 }, uNeck: { value: neck } };
  const mat = patch(new THREE.MeshLambertMaterial({ vertexColors: true, name }), uniforms, true, name);
  const mesh = new THREE.InstancedMesh(geometry, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.customDepthMaterial = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms, false, name);
  mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false;
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1), M = new THREE.Matrix4();
  const size = new Float32Array(n).fill(1);
  return {
    mesh, uniforms, tris,
    setCoat(i, rgb, seed, belted = false, sz = 1) { coat.setXYZW(i, rgb[0], rgb[1], rgb[2], (belted ? 0.5 : 0) + (seed % 1) * 0.49); coat.needsUpdate = true; size[i] = sz; },
    set(i, x, y, z, h, walk, graze, lie, phase) {
      const s = size[i]; q.setFromAxisAngle(up, h); pos.set(x, y, z); scl.set(s, s, s); M.compose(pos, q, scl); mesh.setMatrixAt(i, M);
      anim.setXYZW(i, phase, walk, graze, lie);
    },
    commit() { mesh.instanceMatrix.needsUpdate = true; anim.needsUpdate = true; mesh.computeBoundingSphere(); if (mesh.boundingSphere) mesh.boundingSphere.radius += 2.5; },
  };
}

/** greylag-ish goose (grey-brown, orange bill) and a mallard pair colouring, both rigid: {geometry, tris} */
export function birdGeometry(kind) {
  const B = new Builder();
  const goose = kind === 'goose';
  const body = goose ? solid(0.42, 0.39, 0.33) : solid(0.36, 0.27, 0.18), breast = goose ? solid(0.66, 0.63, 0.57) : solid(0.32, 0.18, 0.12);
  const S = goose ? 1.25 : 0.62;     // a little larger than life: a flock should read at 60 m
  B.add(new THREE.SphereGeometry(1, 7, 5), { pos: [0, 0.32 * S, 0], scl: [0.17 * S, 0.14 * S, 0.3 * S], col: body });
  if (goose) for (const s of [-1, 1]) B.add(new THREE.SphereGeometry(1, 4, 3), { pos: [s * 0.12 * S, 0.36 * S, -0.06 * S], scl: [0.06 * S, 0.08 * S, 0.24 * S], col: solid(0.3, 0.28, 0.24) });   // folded wings
  B.add(new THREE.SphereGeometry(1, 5, 3), { pos: [0, 0.3 * S, 0.14 * S], scl: [0.15 * S, 0.12 * S, 0.14 * S], col: breast });
  B.add(new THREE.CylinderGeometry(0.035 * S, 0.055 * S, 0.3 * S, 4, 1, true), { pos: [0, 0.52 * S, 0.23 * S], rot: [0.35, 0, 0], col: goose ? solid(0.3, 0.28, 0.24) : solid(0.03, 0.18, 0.08) });
  B.add(new THREE.SphereGeometry(0.06 * S, 4, 3), { pos: [0, 0.68 * S, 0.29 * S], scl: [0.9, 0.9, 1.3], col: goose ? solid(0.3, 0.28, 0.24) : solid(0.02, 0.2, 0.09) });
  B.add(new THREE.ConeGeometry(0.025 * S, 0.1 * S, 4), { pos: [0, 0.665 * S, 0.38 * S], rot: [Math.PI / 2, 0, 0], col: goose ? solid(0.85, 0.42, 0.1) : solid(0.75, 0.65, 0.1) });
  B.add(new THREE.ConeGeometry(0.08 * S, 0.14 * S, 4), { pos: [0, 0.36 * S, -0.33 * S], rot: [-Math.PI / 2 - 0.3, 0, 0], col: goose ? solid(0.9, 0.88, 0.84) : solid(0.06, 0.05, 0.05) });
  if (goose) for (const s of [-1, 1]) B.add(new THREE.CylinderGeometry(0.015, 0.015, 0.2 * S, 4, 1, true), { pos: [s * 0.07, 0.1 * S, 0.02], col: solid(0.85, 0.45, 0.25) });
  return { geometry: B.geometry(false), tris: B.tris };
}
/** n rigid instances; set(i, x, y, z, h, pitch); commit() */
export function createBirdMesh(name, kind, n) {
  const { geometry, tris } = birdGeometry(kind);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, name });
  const mesh = new THREE.InstancedMesh(geometry, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.name = name; mesh.castShadow = kind === 'goose'; mesh.receiveShadow = false; mesh.visible = false;
  const q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), M = new THREE.Matrix4(), E = new THREE.Euler();
  return {
    mesh, tris,
    set(i, x, y, z, h, pitch = 0) { E.set(pitch, h, 0, 'YXZ'); q.setFromEuler(E); pos.set(x, y, z); M.compose(pos, q, one); mesh.setMatrixAt(i, M); },
    commit() { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); if (mesh.boundingSphere) mesh.boundingSphere.radius += 1.5; },
  };
}
