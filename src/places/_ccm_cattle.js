// Christ Church Meadow — the English Longhorn herd, drawn. ONE InstancedMesh (+ its shadow) for every cow: the model is
// built once from a few primitives with vertex colours, each vertex tagged with its body part (body, head, four legs,
// tail) and that part's pivot; the vertex shader swings the legs (walk), lowers the head (graze), folds the legs and
// drops the body (lie down) and swishes the tail from per-instance animation values. Where each cow is and what it is
// doing is _ccm_herd.js (a pure function of the shared clock).
//
// Breed look (docs/research/christ_church_meadow.md): long horns that sweep out, down and forward round the face; a
// dark red-brown brindled coat with the breed's white "finching" line down the back and over the tail, a white
// underline and white flecks; cream horns with dark tips. Coat shades vary per cow.
import * as THREE from 'three';

const PART = { body: 0, head: 1, legFL: 2, legFR: 3, legHL: 4, legHR: 5, tail: 6 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();


class CowBuilder {
  constructor() { this.p = []; this.n = []; this.c = []; this.part = []; this.piv = []; this.mask = []; this.tris = 0; }
  /** add a geometry; transform (pos, rot, scale); colour fn (x,y,z,nx,ny,nz) -> [r,g,b,mask]; part id; pivot */
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
/** a tapered tube along points (horns, tail): radius r0 -> r1 */
function taperTube(pts, r0, r1, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const seg = 8, pos = [], idx = [], fr = curve.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, P = curve.getPointAt(t), r = r0 + (r1 - r0) * t, N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j < radial; j++) { const a = (j / radial) * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a); pos.push(P.x + r * (cx * N.x + sx * B.x), P.y + r * (cx * N.y + sx * B.y), P.z + r * (cx * N.z + sx * B.z)); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = a + radial, d = b + radial; idx.push(a, c, b, b, c, d); }
  const tip = pos.length / 3; const E = curve.getPointAt(1); pos.push(E.x, E.y, E.z);
  for (let j = 0; j < radial; j++) idx.push(seg * radial + j, tip, seg * radial + ((j + 1) % radial));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** the cow model, facing +z, origin between the feet. Returns {geometry, tris} */
export function cowGeometry() {
  const B = new CowBuilder();
  // coat: brindle (mask 1: multiplied by the cow's coat colour in the shader) blending smoothly into the breed's white
  // "finching" line along the spine and the white underline (mask 0: stays white); all smooth fields, no per-vertex
  // noise, so the low-poly body does not read as facets
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const coat = (x, y, z, nx, ny, nz) => {
    const fin = ss(0.12, 0.05, Math.abs(x)) * ss(0.35, 0.7, ny) * ss(1.1, 1.22, y);
    const under = ss(-0.3, -0.75, ny) * ss(0.95, 0.72, y);
    const w = Math.max(fin, under);
    const v = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(z * 13 + y * 5 + Math.sin(x * 9 + z * 3) * 1.6));
    return [v + (0.72 - v) * w, v * 0.97 + (0.66 - v * 0.97) * w, v * 0.95 + (0.56 - v * 0.95) * w, 1 - w];
  };
  const solid = (r, g, b) => () => [r, g, b, 0];
  const dark = (k) => (x, y, z, nx, ny, nz) => { const c = coat(x, y, z, nx, ny, nz), m = 1 + (k - 1) * c[3]; return [c[0] * m, c[1] * m, c[2] * m, c[3]]; };
  // ---- body: barrel, deep chest, square hindquarters, a little shoulder hump
  B.add(new THREE.SphereGeometry(1, 16, 10), { pos: [0, 1.0, -0.02], rot: [Math.PI / 2, 0, 0], scl: [0.34, 0.98, 0.39], col: coat });   // poles along the body: a meridian runs down the spine
  B.add(new THREE.SphereGeometry(1, 12, 7), { pos: [0, 1.04, 0.55], rot: [Math.PI / 2, 0, 0], scl: [0.32, 0.5, 0.41], col: coat });      // chest / shoulders
  B.add(new THREE.SphereGeometry(1, 12, 7), { pos: [0, 1.06, -0.62], rot: [Math.PI / 2, 0, 0], scl: [0.34, 0.48, 0.37], col: coat });    // hindquarters
  B.add(new THREE.SphereGeometry(1, 8, 6), { pos: [0, 0.66, -0.42], scl: [0.14, 0.1, 0.16], col: solid(0.45, 0.25, 0.22) });   // udder
  B.add(new THREE.CylinderGeometry(0.17, 0.22, 0.18, 8), { pos: [0, 0.7, 0.7], rot: [0.5, 0, 0], col: dark(0.9) });           // dewlap
  // ---- head + neck (pivot at the base of the neck)
  const NP = [0, 1.12, 0.78], head = { part: PART.head, pivot: NP };
  B.add(new THREE.CylinderGeometry(0.2, 0.27, 0.5, 9), { ...head, pos: [0, 1.15, 1.0], rot: [1.25, 0, 0], col: coat });         // neck
  B.add(new THREE.BoxGeometry(0.3, 0.3, 0.3, 2, 2, 2), { ...head, pos: [0, 1.17, 1.27], rot: [0.55, 0, 0], col: dark(0.85) });   // poll / forehead
  B.add(new THREE.CylinderGeometry(0.11, 0.15, 0.38, 8), { ...head, pos: [0, 0.99, 1.42], rot: [-1.0, 0, 0], col: (x, y, z, nx, ny, nz) => (z > 1.48 ? [0.3, 0.19, 0.16, 0] : dark(0.8)(x, y, z, nx, ny, nz)) });   // face + muzzle
  B.add(new THREE.SphereGeometry(0.1, 8, 6), { ...head, pos: [0, 0.86, 1.56], scl: [1.15, 0.8, 0.8], col: solid(0.12, 0.08, 0.07) });                // nose
  for (const s of [-1, 1]) {
    B.add(new THREE.BoxGeometry(0.17, 0.05, 0.09), { ...head, pos: [s * 0.21, 1.19, 1.2], rot: [0, s * 0.3, s * 0.35], col: dark(0.75) });      // ears
    B.add(new THREE.SphereGeometry(0.025, 4, 3), { ...head, pos: [s * 0.135, 1.14, 1.34], col: solid(0.01, 0.008, 0.008) });                        // eyes
    // the horns: out from the poll, sweeping down and forward round the face, tips curling in towards the muzzle
    const hornCol = (x, y, z) => { const t = Math.min(1, Math.hypot(x - s * 0.12, y - 1.27, z - 1.24) / 0.75); return [0.79 - 0.74 * t * t * t, 0.68 - 0.64 * t * t * t, 0.46 - 0.43 * t * t * t, 0]; };
    B.add(taperTube([[s * 0.1, 1.27, 1.23], [s * 0.36, 1.26, 1.22], [s * 0.6, 1.12, 1.3], [s * 0.66, 0.92, 1.46], [s * 0.53, 0.76, 1.62], [s * 0.34, 0.72, 1.68]], 0.055, 0.012, 5), { ...head, col: hornCol });
  }
  // ---- legs (pivot at the top of each leg); hooves dark
  const legs = [[PART.legFL, -0.19, 0.62], [PART.legFR, 0.19, 0.62], [PART.legHL, -0.2, -0.66], [PART.legHR, 0.2, -0.66]];
  for (const [part, x, z] of legs) {
    const front = z > 0, top = 0.92, pv = [x, top, z];
    const legCol = dark(0.8);
    B.add(new THREE.CylinderGeometry(front ? 0.105 : 0.12, 0.065, 0.5, 6, 1, true), { part, pivot: pv, pos: [x, top - 0.25, z + (front ? 0 : -0.03)], col: legCol });
    B.add(new THREE.CylinderGeometry(0.06, 0.055, 0.42, 6, 1, true), { part, pivot: pv, pos: [x, 0.27, z + (front ? 0.01 : -0.06)], col: legCol });
    B.add(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 6), { part, pivot: pv, pos: [x, 0.04, z + (front ? 0.02 : -0.05)], col: solid(0.02, 0.016, 0.014) });
  }
  // ---- tail: white (the finching line runs down it), dark switch
  const TP = [0, 1.32, -1.08];
  B.add(taperTube([[0, 1.33, -1.07], [0, 1.15, -1.16], [0, 0.85, -1.17], [0, 0.55, -1.15]], 0.035, 0.022, 5), { part: PART.tail, pivot: TP, col: solid(0.66, 0.6, 0.5) });
  B.add(new THREE.ConeGeometry(0.07, 0.24, 6), { part: PART.tail, pivot: TP, pos: [0, 0.45, -1.15], rot: [Math.PI, 0, 0], col: solid(0.05, 0.03, 0.02) });
  return { geometry: B.geometry(), tris: B.tris };
}

// coat shades (linear multipliers of the brindle): red brindle, dark plum, brown, a greyer roan, a paler red
export const COATS = [[0.195, 0.045, 0.016], [0.069, 0.018, 0.009], [0.147, 0.05, 0.018], [0.205, 0.122, 0.087], [0.32, 0.09, 0.03]];   // linear: #7a3c22 red brindle, #4a2418 plum, #6b3f24 brown, #7d6253 roan, #9a5530 pale red

const GLSL_HEAD = /* glsl */`
attribute float aPart; attribute vec3 aPivot; attribute float aMask; attribute vec4 aAnim; attribute vec4 aCoat;
uniform float uCowTime;
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
// the rotation of this vertex's part (about aPivot) for the cow's walk / graze / lie values
mat3 cowRot() {
  float ph = aAnim.x, walk = aAnim.y, graze = aAnim.z, lie = aAnim.w, seed = aCoat.w;
  if (aPart > 1.5 && aPart < 5.5) {
    float idx = aPart - 2.0, front = idx < 1.5 ? 1.0 : 0.0, side = mod(idx, 2.0);
    // walk: diagonal pairs swing together (FL with HR)
    float sw = sin(ph + (side > 0.5 ? 3.14159 : 0.0) + (front > 0.5 ? 0.0 : 3.14159)) * 0.42 * walk;
    // lying: forelegs fold back under the chest, hind legs forward under the belly
    float fold = lie * (front > 0.5 ? 1.75 : -1.6);
    return rotX(sw + fold);
  }
  if (aPart > 0.5 && aPart < 1.5) {
    float t = uCowTime + seed * 40.0;
    float down = graze * (1.05 + 0.06 * sin(t * 2.1)) - 0.12 * (1.0 - graze) * (1.0 - lie) + 0.05 * sin(ph * 2.0) * walk + lie * 0.12;
    float yaw = (0.32 * sin(t * 0.37) * (1.0 - 0.6 * graze) + 0.12 * sin(t * 0.9) * graze) * (1.0 - walk);
    return rotY(yaw) * rotX(down);
  }
  if (aPart > 5.5) {
    float t = uCowTime + seed * 23.0;
    float sw = sin(t * 1.9) * (0.22 + 0.2 * max(0.0, sin(t * 0.31))) + 0.08 * sin(ph) * walk;
    return rotZ(sw) * rotX(-0.08 + lie * 0.35);
  }
  return mat3(1.0);
}
`;
/** patch a material so its vertices follow the cow rig (also used for the shadow depth material) */
function patch(mat, uniforms, colour) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCowTime = uniforms.uCowTime;
    sh.vertexShader = GLSL_HEAD + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = cowRot() * objectNormal;`)
      .replace('#include <begin_vertex>', `vec3 transformed = cowRot() * (position - aPivot) + aPivot;
        transformed.y -= aAnim.w * 0.6;`);
    if (colour) sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
        vColor.rgb = mix(vColor.rgb, vColor.rgb * aCoat.rgb, aMask);`);
  };
  mat.customProgramCacheKey = () => 'ccm-cow-' + (colour ? 'c' : 'd');
  return mat;
}

/**
 * The herd mesh: n instances. Returns {mesh, set(i, x, y, z, h, walk, graze, lie, phase, coatIdx, seed), commit(),
 * uniforms, tris}. Hidden until shown.
 */
export function createCattleMesh(n) {
  const { geometry, tris } = cowGeometry();
  const anim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), coat = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  anim.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aAnim', anim); geometry.setAttribute('aCoat', coat);
  const uniforms = { uCowTime: { value: 0 } };
  const mat = patch(new THREE.MeshLambertMaterial({ vertexColors: true, name: 'ccm:cattle' }), uniforms, true);
  const mesh = new THREE.InstancedMesh(geometry, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.customDepthMaterial = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms, false);
  mesh.name = 'ccm:cattle'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false;   // frustum culled by the instances' sphere (commit)
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1), M = new THREE.Matrix4();
  return {
    mesh, uniforms, tris,
    setCoat(i, coatIdx, seed, size = 1) { const c = COATS[coatIdx % COATS.length]; coat.setXYZW(i, c[0], c[1], c[2], seed); coat.needsUpdate = true; mesh.userData['s' + i] = size; },
    set(i, x, y, z, h, walk, graze, lie, phase) {
      const s = mesh.userData['s' + i] || 1;
      q.setFromAxisAngle(up, h); pos.set(x, y, z); scl.set(s, s, s); M.compose(pos, q, scl); mesh.setMatrixAt(i, M);
      anim.setXYZW(i, phase, walk, graze, lie);
    },
    commit() { mesh.instanceMatrix.needsUpdate = true; anim.needsUpdate = true; mesh.computeBoundingSphere(); if (mesh.boundingSphere) mesh.boundingSphere.radius += 2.5; },
  };
}
