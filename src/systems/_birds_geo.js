// Birds — the one low-poly bird, its material and the instanced draw (systems/birds.js owns the instances).
// ONE geometry (100 triangles: a six-sided body, neck, head, bill, two two-panel wings, a tail, two legs) drawn ONCE for every bird in the game (InstancedMesh). The vertex shader makes each species out of it from a
// small float texture (one row a species: seven colours and eight shape numbers — wing span, neck, tail length and fork,
// girth, wing chord and sweep, leg) and poses it from one per-instance vec4:
//   aAnim = (inner wing angle, outer wing angle, fold, species + peck)
// fold 0 = flying (legs tucked away), 1 = standing with the wings shut along the body, 2 = afloat (no legs);
// the fraction of the last number bows the head to the ground (pecking). Wings beat in the shader from the two angles;
// their normals turn with them, so a distant bird flickers light / dark as it flaps. Lit like everything else outdoors
// (Lambert, fog, the hills' warp through three's own chunks), no shadow cast, no texture but the species table.
import * as THREE from 'three';
import { SPECIES } from './_birds_logic.js';

export const MAX_BIRDS = 256;
const COLS = 9;      // texture columns: 0-5 colours (underparts, mantle, wing tip, head, bill, tail), 6 legs, 7 / 8 shape

function birdGeometry() {
  const P = [], N = [], R = [];
  // kind: 0 body, 1 wing, 2 head / neck, 3 tail, 4 leg
  const v = (p, kind, part, a = 0, b = 0) => ({ p, rig: [kind * 8 + part, 0, a, b] });
  const tri = (A, B, C, n) => {
    if (!n) { const ux = B.p[0] - A.p[0], uy = B.p[1] - A.p[1], uz = B.p[2] - A.p[2], wx = C.p[0] - A.p[0], wy = C.p[1] - A.p[1], wz = C.p[2] - A.p[2]; n = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l]; }
    for (const q of [A, B, C]) { P.push(...q.p); N.push(...n); R.push(...q.rig); }
  };
  const quad = (A, B, C, D, n) => { tri(A, B, C, n); tri(A, C, D, n); };
  // ---- body: rings along z, six sides; the faces that look up take the mantle colour, the rest the underparts
  const rings = [[0.33, 0.042, 0.03], [0.2, 0.098, 0.012], [0.0, 0.115, 0.0], [-0.2, 0.08, 0.004], [-0.33, 0.028, 0.012]];
  const ring = (k, j) => { const [z, r, y] = rings[k], a = (j / 6) * Math.PI * 2 + Math.PI / 6; return [Math.cos(a) * r, y + Math.sin(a) * r * 0.86, z]; };
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < 6; j++) {
    const a = ring(k, j), b = ring(k, j + 1), c = ring(k + 1, j + 1), d = ring(k + 1, j), up = Math.sin(((j + 0.5) / 6) * Math.PI * 2 + Math.PI / 6) > 0.3, part = up ? 1 : 0;
    quad(v(a, 0, part), v(d, 0, part), v(c, 0, part), v(b, 0, part));
  }
  for (let j = 0; j < 6; j++) tri(v(ring(4, j), 0, 1), v([0, 0.012, -0.345], 0, 1), v(ring(4, j + 1), 0, 1));
  // ---- neck (stretches with the species' neck), head, bill
  const nk = (j, z, r, y, a) => { const an = (j / 4) * Math.PI * 2 + Math.PI / 4; return v([Math.cos(an) * r, y + Math.sin(an) * r, z], 2, 3, a); };
  for (let j = 0; j < 4; j++) quad(nk(j, 0.3, 0.05, 0.03, 0), nk(j, 0.37, 0.038, 0.045, 1), nk(j + 1, 0.37, 0.038, 0.045, 1), nk(j + 1, 0.3, 0.05, 0.03, 0));
  const hc = [0, 0.055, 0.395], hr = [0.052, 0.05, 0.062];
  const hp = (x, y, z) => v([hc[0] + x * hr[0], hc[1] + y * hr[1], hc[2] + z * hr[2]], 2, 3, 1);
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const A = hp(sx, 0, 0), B = hp(0, sy, 0), C = hp(0, 0, sz);
    if (sx * sy * sz > 0) tri(A, B, C); else tri(A, C, B);
  }
  const bill = (x, y, z) => v([x, y, z], 2, 4, 1), tip = bill(0, 0.04, 0.515), b0 = bill(-0.018, 0.058, 0.44), b1 = bill(0.018, 0.058, 0.44), b2 = bill(0, 0.03, 0.44);
  tri(b0, b1, tip); tri(b1, b2, tip); tri(b2, b0, tip);
  // ---- wings: x = distance along the span (0 root, 0.45 wrist, 1 tip), rig a = chord offset; the shader lays them out
  for (const s of [1, -1]) {
    const w = (ax, a, part) => v([s * ax, 0, a], 1, part, a), up = [0, 1, 0];
    const q = (A, B, C, D) => (s > 0 ? quad(A, B, C, D, up) : quad(A, D, C, B, up));
    q(w(0, 0.15, 1), w(0.45, 0.14, 1), w(0.45, -0.15, 1), w(0, -0.17, 1));
    q(w(0.45, 0.14, 1), w(0.76, 0.1, 1), w(0.76, -0.12, 1), w(0.45, -0.15, 1));
    if (s > 0) tri(w(0.76, 0.1, 2), w(1, -0.03, 2), w(0.76, -0.12, 2), up); else tri(w(0.76, 0.1, 2), w(0.76, -0.12, 2), w(1, -0.03, 2), up);
  }
  // ---- tail: a = 1 at the tip, b = 1 on the middle feather (drawn in for a fork)
  { const bl = v([-0.04, 0.014, -0.3], 3, 5, 0), br = v([0.04, 0.014, -0.3], 3, 5, 0), tl = v([-0.085, 0.014, -0.52], 3, 5, 1), tc = v([0, 0.014, -0.52], 3, 5, 1, 1), tr2 = v([0.085, 0.014, -0.52], 3, 5, 1), up = [0, 1, 0];
    tri(bl, tc, br, up); tri(bl, tl, tc, up); tri(br, tc, tr2, up); }
  // ---- legs: a = 0 at the belly, 1 at the foot; a toe forward
  for (const s of [1, -1]) {
    const L = (j, a) => { const an = (j / 3) * Math.PI * 2; return v([s * 0.04 + Math.cos(an) * 0.011, -0.07 - a, -0.03 + Math.sin(an) * 0.011], 4, 6, a); };
    for (let j = 0; j < 3; j++) quad(L(j, 0), L(j, 1), L(j + 1, 1), L(j + 1, 0));
    tri(v([s * 0.04, -1.07, -0.05], 4, 6, 1), v([s * 0.04 - 0.035, -1.07, 0.06], 4, 6, 1), v([s * 0.04 + 0.035, -1.07, 0.06], 4, 6, 1), [0, 1, 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N), 3));
  g.setAttribute('aRig', new THREE.BufferAttribute(new Float32Array(R), 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
  return g;
}

/** one row a species: colours (linear), the legs' colour, (span, neck, tail, fork), (girth, chord, sweep, leg) */
function speciesTexture() {
  const n = SPECIES.length, d = new Float32Array(COLS * n * 4), c = new THREE.Color();
  SPECIES.forEach((s, j) => {
    const o = j * COLS * 4;
    for (let k = 0; k < 6; k++) { c.set(s.col[k]); d[o + k * 4] = c.r; d[o + k * 4 + 1] = c.g; d[o + k * 4 + 2] = c.b; d[o + k * 4 + 3] = 1; }
    c.set(s.col[6] !== undefined ? s.col[6] : s.col[4]); d[o + 24] = c.r; d[o + 25] = c.g; d[o + 26] = c.b; d[o + 27] = 1;
    d[o + 28] = s.hs / s.len; d[o + 29] = s.neck; d[o + 30] = s.tail; d[o + 31] = s.fork;
    d[o + 32] = s.girth; d[o + 33] = s.chord; d[o + 34] = s.sweep; d[o + 35] = s.leg;
  });
  const t = new THREE.DataTexture(d, COLS, n, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; t.name = 'birds:species';
  return t;
}

function birdMaterial(tex) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  m.name = 'birds';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBirdTex = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aRig; attribute vec4 aAnim;
uniform highp sampler2D uBirdTex;
varying vec3 vBirdCol;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
	float bKind = floor(aRig.x / 8.0 + 0.01), bPart = aRig.x - bKind * 8.0;
	float bSpF = floor(aAnim.w + 0.001), bPeck = (aAnim.w - bSpF) * 1.1112;
	int bSp = int(bSpF);
	vec4 bA = texelFetch(uBirdTex, ivec2(7, bSp), 0), bB = texelFetch(uBirdTex, ivec2(8, bSp), 0);
	vBirdCol = texelFetch(uBirdTex, ivec2(int(bPart + 0.5), bSp), 0).rgb;
	float bFw = clamp(aAnim.z, 0.0, 1.0), bFl = aAnim.z > 1.5 ? 0.0 : max(aAnim.z, 0.0);
	vBirdCol *= 1.0 - 0.82 * clamp(-aAnim.z, 0.0, 1.0);      // (a negative fold: a flying bird seen against the sky, darkened to a silhouette)
	vec3 bp = position;
	if (bKind < 0.5) { bp.xy *= bB.x; }
	else if (bKind < 1.5) {
		float sd = sign(bp.x), ax = abs(bp.x), inn = min(ax, 0.45), outp = max(ax - 0.45, 0.0);
		vec2 q = (vec2(cos(aAnim.x), sin(aAnim.x)) * inn + vec2(cos(aAnim.y), sin(aAnim.y)) * outp) * bA.x;
		vec3 open = vec3(sd * (0.05 * bB.x + q.x), 0.03 * bB.x + q.y, 0.1 + aRig.z * bB.y - outp * bB.z * bA.x);
		vec3 shut = vec3(sd * (0.1 * bB.x + 0.012 - ax * 0.03), 0.035 * bB.x - ax * 0.035, 0.13 + aRig.z * 0.42 - ax * min(bA.x, 1.5) * 0.5);
		bp = mix(open, shut, bFw);
		float an = (ax > 0.45 ? aAnim.y : aAnim.x) * sd * (1.0 - bFw), cn = cos(an), sn = sin(an);
		objectNormal = vec3(objectNormal.x * cn - objectNormal.y * sn, objectNormal.x * sn + objectNormal.y * cn, objectNormal.z);
	}
	else if (bKind < 2.5) {
		bp.x *= 0.75 + 0.25 * bB.x + bA.y * 1.3;
		bp += aRig.z * (bA.y * mix(vec3(0.0, 0.15, 1.0), vec3(0.0, 0.95, 0.3), bFw) + vec3(0.0, 0.035 * bFw, 0.0));
		bp += aRig.z * bPeck * bFw * vec3(0.0, -(0.07 * bB.x + bB.w + 0.02 + bA.y * 0.95), 0.04 - bA.y * 0.2);
	}
	else if (bKind < 3.5) { bp.z = -0.3 + (bp.z + 0.3) * bA.z + aRig.w * bA.w * 0.22 * bA.z; bp.y += 0.01 * bB.x; }
	else { bp.x *= bB.x; bp.y = -0.066 * bB.x - aRig.z * bB.w * bFl; }`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = bp;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBirdCol;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vBirdCol, opacity );');
  };
  m.customProgramCacheKey = () => 'birds3';
  return m;
}

/** the instanced draw: begin(), put(...) per bird, end(). Positions of what was put are readable (px/py/pz, sp, tag). */
export class BirdLayer {
  constructor(scene, n = MAX_BIRDS) {
    this.geo = birdGeometry(); this.tex = speciesTexture(); this.mat = birdMaterial(this.tex);
    this.aAnim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aAnim', this.aAnim);
    const mesh = (this.mesh = new THREE.InstancedMesh(this.geo, this.mat, n));
    mesh.name = 'birds'; mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (scene) scene.add(mesh);
    this.n = n; this.c = 0;
    this.sp = new Uint8Array(n); this.tag = new Uint8Array(n);      // tag: 0 sky, 1 standing / afloat, 2 one of the landing birds in flight
  }
  get triangles() { return this.geo.attributes.position.count / 3; }
  begin() { this.c = 0; }
  /** one bird: species index, position (its body's centre), heading h, pitch (nose up), roll (left wing up), size (m
   *  per body length), wing angles a / b, fold (0 flying, 1 standing, 2 afloat), peck 0..0.9, tag */
  put(sp, x, y, z, h, pitch, roll, size, a, b, fold, peck, tag) {
    const c = this.c; if (c >= this.n) return;
    const M = this.mesh.instanceMatrix.array, o = c * 16;
    const sh = Math.sin(h), ch = Math.cos(h), sa = -Math.sin(pitch), ca = Math.cos(pitch), sb = Math.sin(roll), cb = Math.cos(roll);
    M[o] = (ch * cb + sh * sa * sb) * size; M[o + 1] = ca * sb * size; M[o + 2] = (-sh * cb + ch * sa * sb) * size; M[o + 3] = 0;
    M[o + 4] = (-ch * sb + sh * sa * cb) * size; M[o + 5] = ca * cb * size; M[o + 6] = (sh * sb + ch * sa * cb) * size; M[o + 7] = 0;
    M[o + 8] = sh * ca * size; M[o + 9] = -sa * size; M[o + 10] = ch * ca * size; M[o + 11] = 0;
    M[o + 12] = x; M[o + 13] = y; M[o + 14] = z; M[o + 15] = 1;
    const A = this.aAnim.array, q = c * 4;
    A[q] = a; A[q + 1] = b; A[q + 2] = fold; A[q + 3] = sp + (peck > 0 ? (peck > 0.9 ? 0.9 : peck) : 0);
    this.sp[c] = sp; this.tag[c] = tag;
    this.c = c + 1;
  }
  /** one flying bird by its axes: left (lx..), up (ux..), forward (fx..), each a unit vector; dark 0..1 (a silhouette against the sky) */
  putAxes(sp, x, y, z, lx, ly, lz, ux, uy, uz, fx, fy, fz, size, a, b, dark, tag) {
    const c = this.c; if (c >= this.n) return;
    const M = this.mesh.instanceMatrix.array, o = c * 16;
    M[o] = lx * size; M[o + 1] = ly * size; M[o + 2] = lz * size; M[o + 3] = 0;
    M[o + 4] = ux * size; M[o + 5] = uy * size; M[o + 6] = uz * size; M[o + 7] = 0;
    M[o + 8] = fx * size; M[o + 9] = fy * size; M[o + 10] = fz * size; M[o + 11] = 0;
    M[o + 12] = x; M[o + 13] = y; M[o + 14] = z; M[o + 15] = 1;
    const A = this.aAnim.array, q = c * 4;
    A[q] = a; A[q + 1] = b; A[q + 2] = -dark; A[q + 3] = sp;
    this.sp[c] = sp; this.tag[c] = tag;
    this.c = c + 1;
  }
  end() {
    const mesh = this.mesh, c = this.c;
    mesh.count = c; mesh.visible = c > 0;
    if (!c) return;
    const im = mesh.instanceMatrix; im.clearUpdateRanges(); im.addUpdateRange(0, c * 16); im.needsUpdate = true;
    const an = this.aAnim; an.clearUpdateRanges(); an.addUpdateRange(0, c * 4); an.needsUpdate = true;
  }
  hide() { if (this.mesh.visible) { this.mesh.visible = false; this.mesh.count = 0; } this.c = 0; }
  x(i) { return this.mesh.instanceMatrix.array[i * 16 + 12]; }
  y(i) { return this.mesh.instanceMatrix.array[i * 16 + 13]; }
  z(i) { return this.mesh.instanceMatrix.array[i * 16 + 14]; }
}
