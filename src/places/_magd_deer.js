// Magdalen College — the Grove's fallow deer, drawn (showpiece, fine-detail pass: finer model, per-pixel dappled coat). The same
// technique as the Christ Church Meadow cattle (_ccm_cattle.js): ONE InstancedMesh (+ its shadow) for the whole herd,
// the model built once from primitives with vertex colours, each vertex tagged with its body part and pivot; the vertex
// shader swings the legs, lowers the head to graze, folds the legs to lie down and flicks the tail. Bucks carry palmate
// antlers (aCoat.w > 0.5), does none. Where each deer is comes from _ccm_herd.js (a pure function of the shared clock).
//
// Fallow look: fawn-chestnut back with white spots, a pale belly, a white rump patch edged in black, a black-and-white
// tail; a few menil (paler) and dark coats. ~0.9 m at the shoulder. docs/research/christ_church_botanic_magdalen.md §3.
import * as THREE from 'three';

const PART = { body: 0, head: 1, legFL: 2, legFR: 3, legHL: 4, legHR: 5, tail: 6, antler: 7 };
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
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aPart', new THREE.Float32BufferAttribute(this.part, 1));
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(this.piv, 3)); g.setAttribute('aMask', new THREE.Float32BufferAttribute(this.mask, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** the deer model, facing +z, origin between the feet: a slim barrel, deep chest, long upright neck, fine head with
 *  big ears, slender legs. The spots, the white flank line, the dark dorsal stripe are drawn per pixel (see patch()). */
export function deerGeometry() {
  const B = new Builder();
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // coat: masked (x coat colour) on the back and flanks, pale underneath and inside the legs
  const coat = (x, y, z, nx, ny) => { const w = ss(-0.15, -0.7, ny) * ss(0.97, 0.78, y); return [0.95 - 0.08 * w, 0.92 - 0.04 * w, 0.86, 1 - w]; };
  const solid = (r, g, b) => () => [r, g, b, 0];
  // body: barrel, chest, haunches with the white rump patch in its black horseshoe
  B.add(new THREE.SphereGeometry(1, 12, 8), { pos: [0, 0.98, 0], rot: [Math.PI / 2, 0, 0], scl: [0.17, 0.47, 0.215], col: coat });
  B.add(new THREE.SphereGeometry(1, 9, 6), { pos: [0, 0.97, 0.31], rot: [Math.PI / 2, 0, 0], scl: [0.165, 0.27, 0.25], col: coat });
  B.add(new THREE.SphereGeometry(1, 10, 7), { pos: [0, 1.0, -0.34], rot: [Math.PI / 2, 0, 0], scl: [0.175, 0.27, 0.235], col: (x, y, z, nx, ny, nz) => { if (nz < -0.5) { const d = Math.hypot(x * 1.15, y - 0.99); if (d < 0.115) return [0.97, 0.96, 0.92, 0]; if (d < 0.165 && y > 0.9) return [0.05, 0.04, 0.04, 0]; } return coat(x, y, z, nx, ny); } });
  // neck and head (pivot at the base of the neck)
  const NP = [0, 1.1, 0.42], head = { part: PART.head, pivot: NP };
  B.add(new THREE.CylinderGeometry(0.062, 0.125, 0.58, 7, 2, true), { ...head, pos: [0, 1.36, 0.53], rot: [0.4, 0, 0], col: (x, y, z, nx, ny, nz) => (nz > 0.5 && y < 1.45 ? [0.93, 0.9, 0.84, 0.25] : coat(x, y, z, nx, 0.5)) });
  B.add(new THREE.SphereGeometry(1, 8, 6), { ...head, pos: [0, 1.66, 0.66], scl: [0.068, 0.078, 0.105], col: (x, y, z) => coat(x, y, z, 0, 0.5) });
  B.add(new THREE.CylinderGeometry(0.028, 0.058, 0.2, 6), { ...head, pos: [0, 1.615, 0.795], rot: [Math.PI / 2 + 0.32, 0, 0], col: (x, y, z) => (z > 0.875 ? [0.07, 0.05, 0.05, 0] : y < 1.59 ? [0.9, 0.87, 0.8, 0.3] : coat(x, y, z, 0, 0.5)) });
  for (const s of [-1, 1]) {
    // ears: big, leaf-shaped, pale inside
    B.add(new THREE.ConeGeometry(0.05, 0.2, 5), { ...head, pos: [s * 0.115, 1.76, 0.6], rot: [-0.25, 0, -s * 1.0], scl: [1, 1, 0.45], col: (x, y, z, nx, ny, nz) => (nz > 0.3 ? [0.9, 0.82, 0.76, 0.2] : coat(x, y, z, 0, 0.5)) });
    B.add(new THREE.SphereGeometry(0.017, 4, 3), { ...head, pos: [s * 0.058, 1.685, 0.715], col: solid(0.02, 0.02, 0.02) });
    // palmate antlers (bucks only — folded away on does in the shader): beam, brow tine, the broad palm and its points
    const A = { part: PART.antler, pivot: NP, col: solid(0.42, 0.33, 0.22) };
    B.add(new THREE.CylinderGeometry(0.017, 0.028, 0.34, 5), { ...A, pos: [s * 0.1, 1.9, 0.57], rot: [-0.4, 0, -s * 0.38] });
    B.add(new THREE.CylinderGeometry(0.008, 0.017, 0.15, 4), { ...A, pos: [s * 0.065, 1.8, 0.7], rot: [1.05, 0, -s * 0.2] });
    B.add(new THREE.CylinderGeometry(0.008, 0.015, 0.13, 4), { ...A, pos: [s * 0.13, 1.96, 0.6], rot: [0.9, 0, -s * 0.5] });
    B.add(new THREE.BoxGeometry(0.035, 0.3, 0.17), { ...A, pos: [s * 0.2, 2.15, 0.44], rot: [-0.55, 0, -s * 0.42] });
    for (let k = 0; k < 4; k++) B.add(new THREE.ConeGeometry(0.014, 0.12, 4), { ...A, pos: [s * (0.215 + k * 0.022), 2.13 + k * 0.075, 0.34 - k * 0.03 + (k === 3 ? 0.07 : 0)], rot: [-1.15 + k * 0.28, 0, -s * 0.42] });
  }
  // legs (pivot at the top): long and fine, the hind pair angled at the hock; pale inside, dark hooves
  const legs = [[PART.legFL, -0.095, 0.36], [PART.legFR, 0.095, 0.36], [PART.legHL, -0.1, -0.4], [PART.legHR, 0.1, -0.4]];
  for (const [part, x, z] of legs) {
    const pv = [x, 0.88, z], hind = z < 0;
    B.add(new THREE.CylinderGeometry(hind ? 0.07 : 0.052, 0.03, 0.48, 6, 1, true), { part, pivot: pv, pos: [x, 0.66, z + (hind ? -0.03 : 0)], rot: [hind ? 0.2 : 0, 0, 0], col: coat });
    B.add(new THREE.CylinderGeometry(0.026, 0.02, 0.42, 5, 1, true), { part, pivot: pv, pos: [x, 0.235, z + (hind ? -0.055 : 0.005)], rot: [hind ? -0.1 : 0, 0, 0], col: (xx, y, zz, nx) => (nx * Math.sign(x) < -0.2 ? [0.9, 0.87, 0.8, 0.3] : coat(xx, y, zz, 0, 0.5)) });
    B.add(new THREE.CylinderGeometry(0.022, 0.03, 0.055, 5), { part, pivot: pv, pos: [x, 0.028, z + (hind ? -0.035 : 0.01)], col: solid(0.04, 0.03, 0.03) });
  }
  // tail: long, black above, white beneath
  const TP = [0, 1.1, -0.59];
  B.add(new THREE.BoxGeometry(0.06, 0.27, 0.035), { part: PART.tail, pivot: TP, pos: [0, 0.97, -0.615], col: (x, y, z, nx, ny, nz) => (nz < -0.5 && Math.abs(x) < 0.02 ? [0.04, 0.03, 0.03, 0] : nz < -0.5 ? [0.04, 0.03, 0.03, 0] : [0.94, 0.92, 0.88, 0]) });
  return { geometry: B.geometry(), tris: B.tris };
}

// coat colours (linear multipliers): common fawn-chestnut, menil (paler, spotted), dark, a rare white
export const COATS = [[0.38, 0.21, 0.1], [0.43, 0.26, 0.13], [0.6, 0.43, 0.25], [0.07, 0.05, 0.04], [0.85, 0.82, 0.76]];

const GLSL_HEAD = /* glsl */`
attribute float aPart; attribute vec3 aPivot; attribute float aMask; attribute vec4 aAnim; attribute vec4 aCoat;
uniform float uDeerTime;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
float buckOf() { return aCoat.w > 0.5 ? 1.0 : 0.0; }
mat3 deerRot() {
  float ph = aAnim.x, walk = aAnim.y, graze = aAnim.z, lie = aAnim.w, seed = fract(aCoat.w * 2.0);
  if (aPart > 1.5 && aPart < 5.5) {
    float idx = aPart - 2.0, front = idx < 1.5 ? 1.0 : 0.0, side = mod(idx, 2.0);
    // a walking gait: each leg a quarter-cycle after the last (hind left, fore left, hind right, fore right); the leg
    // swings back slowly on the ground and reaches forward quickly; a trot (walk > 1) pairs the diagonals
    float lag = walk > 1.0 ? (side > 0.5 ? 3.14159 : 0.0) + (front > 0.5 ? 0.0 : 3.14159) : (side > 0.5 ? 3.14159 : 0.0) + (front > 0.5 ? 1.5708 : 0.0);
    float a = ph + lag, sw = (sin(a) + 0.22 * sin(2.0 * a)) * 0.36 * min(walk, 1.0) * (walk > 1.0 ? 1.5 : 1.0);
    float fold = lie * (front > 0.5 ? 1.9 : -1.7);
    return rotX(sw + fold);
  }
  if ((aPart > 0.5 && aPart < 1.5) || aPart > 6.5) {
    float t = uDeerTime + seed * 40.0;
    float down = graze * (1.25 + 0.05 * sin(t * 2.3)) - 0.15 * (1.0 - graze) + 0.06 * sin(ph * 2.0) * min(walk, 1.0);
    float yaw = 0.4 * sin(t * 0.41) * (1.0 - graze) * (1.0 - min(walk, 1.0));
    return rotY(yaw) * rotX(down);
  }
  if (aPart > 5.5) { float t = uDeerTime + seed * 23.0; return rotX(-0.2 - 0.25 * max(0.0, sin(t * 3.1)) - min(walk, 1.0) * 0.5); }
  return mat3(1.0);
}
`;
function patch(mat, uniforms, colour) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDeerTime = uniforms.uDeerTime;
    sh.vertexShader = GLSL_HEAD + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = deerRot() * objectNormal;`)
      .replace('#include <begin_vertex>', `vec3 transformed = deerRot() * (position - aPivot) + aPivot;
        if (aPart > 6.5) transformed = mix(aPivot + vec3(0.0, 0.3, 0.1), transformed, buckOf());
        transformed.y -= aAnim.w * 0.5;
        transformed.y += 0.012 * sin(aAnim.x * 2.0) * min(aAnim.y, 1.0);${colour ? '\n        vDeerObj = position; vDeerFx = vec2(aMask, step(0.3, aCoat.r) * step(aCoat.r, 0.7));' : ''}`);
    if (colour) {
      sh.vertexShader = ('varying vec3 vDeerObj; varying vec2 vDeerFx;\n' + sh.vertexShader).replace('#include <color_vertex>', `#include <color_vertex>
        vColor.rgb = mix(vColor.rgb, vColor.rgb * aCoat.rgb, aMask);`);
      // the fallow coat, per pixel: white spots dappled over the back and flanks, the white line low on the flank, the
      // dark stripe down the spine (spotted coats only: common and menil)
      sh.fragmentShader = ('varying vec3 vDeerObj; varying vec2 vDeerFx;\n' + sh.fragmentShader).replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 o = vDeerObj; float m = vDeerFx.x;
          float body = step(-0.63, o.z) * step(o.z, 0.5);
          float flank = m * body * smoothstep(0.93, 1.0, o.y) * smoothstep(0.035, 0.09, abs(o.x));
          vec2 g = vec2(o.z * 15.0 + floor(o.y * 15.0) * 0.5, o.y * 15.0), c = floor(g), f = fract(g) - 0.5;
          float h = fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
          f += (vec2(h, fract(h * 7.31)) - 0.5) * 0.42;
          float spot = smoothstep(0.3, 0.19, length(f)) * step(0.22, h) * flank;
          float line = m * body * step(-0.45, o.z) * step(o.z, 0.36) * smoothstep(0.016, 0.006, abs(o.y - 0.915));
          float dors = m * step(-0.66, o.z) * step(o.z, 0.42) * step(1.1, o.y) * smoothstep(0.05, 0.02, abs(o.x));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.9, 0.82), max(spot * 0.88, line * 0.75) * vDeerFx.y);
          diffuseColor.rgb *= 1.0 - 0.62 * dors * vDeerFx.y;
        }`);
    }
  };
  mat.customProgramCacheKey = () => 'magd-deer-' + (colour ? 'c' : 'd');
  return mat;
}

/** the herd mesh: n instances. {mesh, set(i, x, y, z, h, walk, graze, lie, phase), setCoat(i, coat, buck, seed, size), commit(), uniforms, tris} */
export function createDeerMesh(n) {
  const { geometry, tris } = deerGeometry();
  const anim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), coat = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  anim.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aAnim', anim); geometry.setAttribute('aCoat', coat);
  const uniforms = { uDeerTime: { value: 0 } };
  const mat = patch(new THREE.MeshLambertMaterial({ vertexColors: true, name: 'magd:deer' }), uniforms, true);
  const mesh = new THREE.InstancedMesh(geometry, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.customDepthMaterial = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms, false);
  mesh.name = 'magd:deer'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false;
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1), M = new THREE.Matrix4(), sizes = new Float32Array(n).fill(1);
  return {
    mesh, uniforms, tris,
    /** buck: true for antlers; seed 0..1 (kept < 0.5 in w so the buck flag reads w > 0.5) */
    setCoat(i, coatIdx, buck, seed, size = 1) { const c = COATS[coatIdx % COATS.length]; coat.setXYZW(i, c[0], c[1], c[2], (buck ? 0.5 : 0) + 0.49 * seed); coat.needsUpdate = true; sizes[i] = size; },
    set(i, x, y, z, h, walk, graze, lie, phase) { const s = sizes[i]; q.setFromAxisAngle(up, h); pos.set(x, y, z); scl.set(s, s, s); M.compose(pos, q, scl); mesh.setMatrixAt(i, M); anim.setXYZW(i, phase, walk, graze, lie); },
    commit() { mesh.instanceMatrix.needsUpdate = true; anim.needsUpdate = true; mesh.computeBoundingSphere(); if (mesh.boundingSphere) mesh.boundingSphere.radius += 2.5; },
  };
}
