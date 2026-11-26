// Everything swimming draws (underscore = not auto-loaded): ripple rings, splash droplets / bubbles / drips, the
// underwater set (river bed with caustics, the surface seen from below, light shafts, weed, joke junk) and the fish.
// Nothing here is in the scene until it is needed: a mesh is added when it has something to show and removed when it
// has not, so a dry player pays no draw calls for any of it.
import * as THREE from 'three';
import { SW, hash2, vnoise, schoolsIn, fishAt, FISH } from './_swim_logic.js';

const FOG_PARS_V = '#include <fog_pars_vertex>', FOG_V = '#include <fog_vertex>', FOG_PARS_F = '#include <fog_pars_fragment>';
const OUT_F = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';
const NOISE = /* glsl */`
float sHash(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float sNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float caustic(vec2 p, float t) {
  p += vec2(sin(p.y * 1.7 + t), cos(p.x * 1.9 - t * 0.8)) * 0.4;
  p += vec2(sin(p.y * 3.1 - t * 1.3), cos(p.x * 2.7 + t)) * 0.2;
  float a = sin(p.x * 2.1 + p.y * 1.3), b = sin(p.x * 1.2 - p.y * 2.4 + 1.7);
  float c = 1.0 - abs(a + b) * 0.5; c *= c; c *= c;
  return c * c;
}`;

/** display colour (sRGB 0..1) -> linear scene value three's ACES curve maps to it (bisection; as world/sky.js) */
function acesInv(d) {
  const lin = d <= 0.04045 ? d / 12.92 : Math.pow((d + 0.055) / 1.055, 2.4);
  let lo = 0, hi = 12;
  for (let i = 0; i < 16; i++) { const v = (lo + hi) / 2, y = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081); if (y < lin) lo = v; else hi = v; }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------- geometry helpers
class Acc {
  constructor() { this.p = []; this.c = []; this.i = []; }
  v(x, y, z, r, g, b) { this.p.push(x, y, z); this.c.push(r, g, b); return this.p.length / 3 - 1; }
  box(w, h, d, x, y, z, col, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); this.add(g, col);
  }
  cyl(r0, r1, h, x, y, z, col, rx = 0, rz = 0, seg = 8) {
    const g = new THREE.CylinderGeometry(r0, r1, h, seg, 1); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); this.add(g, col);
  }
  torus(R, r, x, y, z, col, ry = 0) { const g = new THREE.TorusGeometry(R, r, 5, 14); g.rotateY(ry); g.translate(x, y, z); this.add(g, col); }
  add(g, col) {
    const P = g.attributes.position, base = this.p.length / 3, c = new THREE.Color(col);
    for (let i = 0; i < P.count; i++) { this.p.push(P.getX(i), P.getY(i), P.getZ(i)); this.c.push(c.r, c.g, c.b); }
    const I = g.index; for (let i = 0; i < I.count; i++) this.i.push(base + I.getX(i));
    g.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeVertexNormals();
    return g;
  }
}

function fishGeometry() {
  // nose at +z, length 1, tall narrow body; vertex colour = shade (dark back, pale belly), tinted per instance
  const A = new Acc(), Z = [0.5, 0.4, 0.24, 0.02, -0.22, -0.37], H = [0.012, 0.075, 0.118, 0.12, 0.07, 0.03], N = 6;
  const ring = [];
  for (let s = 0; s < Z.length; s++) {
    const r = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, cy = Math.cos(a), sx = Math.sin(a), sh = 0.42 + 0.58 * (0.5 - 0.5 * cy) + 0.0;
      const shade = cy > 0.5 ? 0.34 : cy > -0.2 ? 0.8 : 1.0;
      r.push(A.v(sx * H[s] * 0.5, cy * H[s] + (s === 0 ? -0.01 : 0), Z[s], shade * (0.9 + 0.1 * sh), shade * (0.9 + 0.1 * sh), shade));
    }
    ring.push(r);
  }
  for (let s = 0; s < Z.length - 1; s++) for (let k = 0; k < N; k++) { const a = ring[s][k], b = ring[s][(k + 1) % N], c = ring[s + 1][k], d = ring[s + 1][(k + 1) % N]; A.i.push(a, c, b, b, c, d); }
  const fin = (pts, r, g, b) => { const ids = pts.map((p) => A.v(p[0], p[1], p[2], r, g, b)); for (let k = 1; k < ids.length - 1; k++) A.i.push(ids[0], ids[k], ids[k + 1], ids[0], ids[k + 1], ids[k]); };
  fin([[0, 0, -0.36], [0, 0.13, -0.52], [0, 0.02, -0.46], [0, -0.13, -0.52]], 0.62, 0.42, 0.34);       // tail
  fin([[0, 0.11, 0.12], [0, 0.2, -0.02], [0, 0.1, -0.14]], 0.4, 0.36, 0.3);                              // dorsal
  fin([[0, -0.1, 0.02], [0, -0.17, -0.06], [0, -0.08, -0.14]], 0.7, 0.4, 0.3);                           // anal
  fin([[0.05, -0.04, 0.26], [0.13, -0.1, 0.16], [0.05, -0.07, 0.17]], 0.7, 0.45, 0.35);
  fin([[-0.05, -0.04, 0.26], [-0.13, -0.1, 0.16], [-0.05, -0.07, 0.17]], 0.7, 0.45, 0.35);
  const eye = (sx) => A.box(0.012, 0.022, 0.022, sx * 0.034, 0.02, 0.4, 0x111111);
  eye(1); eye(-1);
  return A.build();
}

function weedGeometry() {
  // a clump of ribbon blades, 1 m tall (scaled per instance); aBend = how far up the blade (sway weight)
  const P = [], C = [], I = [], S = 5, B = 6;
  for (let b = 0; b < B; b++) {
    const a = (b / B) * Math.PI * 2 + b * 0.7, lean = 0.1 + 0.16 * ((b * 37) % 5) / 5, w = 0.05 + 0.02 * (b % 3), hgt = 0.6 + 0.4 * ((b * 53) % 7) / 7;
    const dx = Math.cos(a), dz = Math.sin(a), base = P.length / 3;
    for (let s = 0; s <= S; s++) {
      const u = s / S, y = u * hgt, out = lean * u * u + 0.05 * b / B, ww = w * (1 - 0.75 * u);
      const g = 0.16 + 0.42 * u, r = 0.07 + 0.2 * u, bl = 0.04 + 0.08 * u;
      P.push(dx * out - dz * ww, y, dz * out + dx * ww, dx * out + dz * ww, y, dz * out - dx * ww); C.push(r, g, bl, r * 0.9, g * 0.9, bl);
      if (s < S) { const k = base + s * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  return g;
}

function junkGeometries() {
  const steel = 0x9aa2a6, out = [];
  { // shopping trolley on its side, half sunk in the silt
    const A = new Acc(), L = 0.9, W = 0.55, H = 0.5;
    for (let i = 0; i <= 6; i++) { const z = -L / 2 + (i / 6) * L; A.box(0.012, H, 0.012, -W / 2, H / 2 + 0.25, z, steel); A.box(0.012, H, 0.012, W / 2, H / 2 + 0.25, z, steel); A.box(W, 0.012, 0.012, 0, 0.25, z, steel); }
    for (let i = 0; i <= 4; i++) { const x = -W / 2 + (i / 4) * W; A.box(0.012, H, 0.012, x, H / 2 + 0.25, -L / 2, steel); A.box(0.012, H * 0.8, 0.012, x, H * 0.4 + 0.35, L / 2, steel); A.box(0.012, 0.012, L, x, 0.25, 0, steel); }
    for (const y of [0.25, 0.5, 0.75]) { A.box(0.014, 0.014, L, -W / 2, y, 0, steel); A.box(0.014, 0.014, L, W / 2, y, 0, steel); A.box(W, 0.014, 0.014, 0, y, -L / 2, steel); }
    A.box(W + 0.06, 0.03, 0.03, 0, 0.92, L / 2 + 0.1, 0xc02828);                       // handle
    A.box(0.02, 0.2, 0.02, -W / 2, 0.84, L / 2 + 0.05, steel, -0.5); A.box(0.02, 0.2, 0.02, W / 2, 0.84, L / 2 + 0.05, steel, -0.5);
    for (const [x, z] of [[-0.22, -0.36], [0.22, -0.36], [-0.22, 0.36], [0.22, 0.36]]) { A.box(0.02, 0.2, 0.02, x, 0.14, z, steel); A.cyl(0.05, 0.05, 0.03, x, 0.05, z, 0x222222, 0, Math.PI / 2); }
    const g = A.build(); g.rotateZ(1.25); g.translate(0.1, 0.28, 0); out.push(g);
  }
  { // a bicycle, lying down, bearded with weed
    const A = new Acc(), fr = 0x2a5a8a;
    A.torus(0.33, 0.022, 0, 0.35, 0.52, 0x1a1a1a, Math.PI / 2); A.torus(0.33, 0.022, 0, 0.35, -0.52, 0x1a1a1a, Math.PI / 2);
    A.cyl(0.018, 0.018, 0.62, 0, 0.5, 0.2, fr, 0.95); A.cyl(0.018, 0.018, 0.55, 0, 0.68, 0.0, fr, Math.PI / 2); A.cyl(0.018, 0.018, 0.5, 0, 0.5, -0.22, fr, -0.3);
    A.cyl(0.015, 0.015, 0.55, 0, 0.36, -0.3, fr, Math.PI / 2 - 0.05); A.cyl(0.015, 0.015, 0.5, 0, 0.52, 0.47, fr, -0.25);
    A.box(0.42, 0.02, 0.02, 0, 0.86, 0.4, 0x888888); A.box(0.1, 0.04, 0.22, 0, 0.78, -0.2, 0x1a1a1a);
    A.box(0.3, 0.2, 0.2, 0, 0.72, 0.62, 0x6a4a2a);                                     // basket
    const g = A.build(); g.rotateZ(1.45); g.translate(0.3, 0.06, 0); out.push(g);
  }
  { // traffic cone
    const A = new Acc();
    A.box(0.36, 0.03, 0.36, 0, 0.015, 0, 0xd85a14); A.cyl(0.03, 0.14, 0.2, 0, 0.13, 0, 0xe8641a, 0, 0, 10); A.cyl(0.075, 0.105, 0.14, 0, 0.3, 0, 0xf2f2f2, 0, 0, 10);
    A.cyl(0.03, 0.075, 0.2, 0, 0.47, 0, 0xe8641a, 0, 0, 10);
    const g = A.build(); g.rotateZ(0.5); g.translate(0, 0.06, 0); out.push(g);
  }
  { // a tyre and a road sign someone carried home and thought better of
    const A = new Acc();
    A.torus(0.27, 0.085, 0, 0.09, 0, 0x151515, 0);
    const g = A.build(); g.rotateX(Math.PI / 2 - 0.2); g.translate(0, 0.1, 0);
    const B2 = new Acc(); B2.cyl(0.025, 0.025, 1.6, 0.9, 0.05, 0, steel, 0, Math.PI / 2 - 0.06); B2.cyl(0.3, 0.3, 0.02, 1.75, 0.12, 0, 0xc82020, 0.15, 0, 16); B2.cyl(0.22, 0.22, 0.024, 1.75, 0.123, 0, 0xf4f4f4, 0.15, 0, 16);
    const g2 = B2.build(), P = [], C = [], I = [];
    for (const [gg] of [[g], [g2]]) { const base = P.length / 3, p = gg.attributes.position.array, c = gg.attributes.color.array; for (let i = 0; i < p.length; i++) { P.push(p[i]); C.push(c[i]); } for (let i = 0; i < gg.index.count; i++) I.push(base + gg.index.getX(i)); gg.dispose(); }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); m.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); m.setIndex(I); m.computeVertexNormals();
    out.push(m);
  }
  return out;
}
export const JUNK_NAMES = ['trolley', 'bicycle', 'cone', 'tyre+sign'];

// ---------------------------------------------------------------- the lot
const RINGS = 40, DROPS = 150, FISH_CAP = 200, WEED_CAP = 240, JUNK_CAP = 4;

export class SwimFx {
  constructor(game) {
    this.game = game; this.scene = game.worldScene;
    this.U = { uTime: { value: 0 }, uDay: { value: 1 }, uSun: { value: 1 }, uSlant: { value: new THREE.Vector2(0.3, 0.1) }, uCam: { value: new THREE.Vector3() }, uSky: { value: new THREE.Color(0.7, 0.9, 0.7) }, uDeep: { value: new THREE.Color(0.05, 0.1, 0.06) } };
    this.rings = []; this.drops = []; this._ringMesh = null; this._dropMesh = null;
    this.under = false; this.uw = null; this.fish = null; this.fishMode = 0;      // fishMode 0 off, 1 seen from above, 2 under water
    this.schools = []; this._fcx = NaN; this._fcz = NaN; this.fishN = 0; this.junk = []; this.weedN = 0;
    this._far0 = null; this._bedV = -1;
  }

  // ---------------------------------------------------------- rings + droplets (above and below)
  _mkRings() {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3)); g.setIndex([0, 2, 1, 0, 3, 2]);
    this._ringA = new THREE.InstancedBufferAttribute(new Float32Array(RINGS * 4), 4); this._ringA.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aRing', this._ringA); g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: {},
      vertexShader: /* glsl */`attribute vec4 aRing; varying vec2 vUv; varying float vA;
void main() { vUv = position.xz; vA = aRing.w;
  vec4 mv = viewMatrix * vec4(aRing.x + position.x * aRing.z, ${(SW.surfY + 0.012).toFixed(3)}, aRing.y + position.z * aRing.z, 1.0);
  mv.xyz *= 1.0 - 0.006; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`varying vec2 vUv; varying float vA;
void main() { float r = length(vUv);
  float a = exp(-pow((r - 0.86) / 0.07, 2.0)) + 0.55 * exp(-pow((r - 0.6) / 0.06, 2.0)) + 0.3 * exp(-pow((r - 0.36) / 0.05, 2.0));
  float d = exp(-pow((r - 0.76) / 0.05, 2.0));
  gl_FragColor = vec4(mix(vec3(0.82, 0.9, 0.92), vec3(0.03, 0.06, 0.05), clamp(d * 0.6 - a * 0.3, 0.0, 1.0)), clamp((a * 0.55 + d * 0.3) * vA, 0.0, 1.0));
  ${OUT_F}
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.name = 'swim:ripples'; mesh.renderOrder = 3; mesh.userData.owner = 'swim';
    this._ringMesh = mesh;
  }
  _mkDrops() {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    this._dropA = new THREE.InstancedBufferAttribute(new Float32Array(DROPS * 4), 4); this._dropA.setUsage(THREE.DynamicDrawUsage);
    this._dropB = new THREE.InstancedBufferAttribute(new Float32Array(DROPS * 2), 2); this._dropB.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aP', this._dropA); g.setAttribute('aK', this._dropB); g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uDay: this.U.uDay },
      vertexShader: /* glsl */`attribute vec4 aP; attribute vec2 aK; varying vec2 vUv; varying vec2 vK;
void main() { vUv = position.xy; vK = aK; vec4 mv = viewMatrix * vec4(aP.xyz, 1.0); mv.xy += position.xy * aP.w * vec2(1.0, 1.0 + max(aK.y, 0.0) * 1.6); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`uniform float uDay; varying vec2 vUv; varying vec2 vK;
void main() { float r = length(vUv); if (r > 1.0) discard;
  float bubble = step(0.5, vK.y < 0.0 ? 1.0 : 0.0);
  float a = mix(1.0 - r * r, 0.25 + 0.75 * smoothstep(0.55, 0.95, r), bubble) * vK.x;
  vec3 c = mix(vec3(0.86, 0.93, 0.97), vec3(0.75, 0.95, 0.85), bubble) * (0.25 + 0.75 * uDay);
  gl_FragColor = vec4(c, a);
  ${OUT_F}
}`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.name = 'swim:drops'; mesh.renderOrder = 4; mesh.userData.owner = 'swim';
    this._dropMesh = mesh;
  }
  /** an expanding ring on the surface */
  ring(x, z, r0 = 0.2, speed = 1.2, life = 1.6, amp = 1) {
    if (this.rings.length >= RINGS) this.rings.shift();
    this.rings.push({ x, z, r: r0, v: speed, life, age: 0, amp });
  }
  /** a droplet (kind 0), a bubble (1: rises, dies at the surface) or a drip (2: falls to floorY) */
  drop(x, y, z, vx, vy, vz, size, life, kind = 0, floorY = 0) {
    if (this.drops.length >= DROPS) return;
    this.drops.push({ x, y, z, vx, vy, vz, size, life, age: 0, kind, floorY });
  }
  /** water going everywhere. power ~0.4 (slipping in) … 1 (a dive) … 2 (off a bridge) */
  splash(x, z, power = 1) {
    this.ring(x, z, 0.15, 2.6 * Math.sqrt(power), 1.5, 1); this.ring(x, z, 0.1, 1.7 * Math.sqrt(power), 2.1, 0.9); this.ring(x, z, 0.05, 1.0, 2.8, 0.7);
    const n = Math.min(90, Math.round(16 + 30 * power));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, crown = i < n * 0.55, out = (crown ? 0.9 + Math.random() * 1.3 : Math.random() * 0.6) * Math.sqrt(power);
      const up = (crown ? 2.2 + Math.random() * 2.2 : 3.5 + Math.random() * 3.5) * Math.sqrt(power);
      this.drop(x + Math.cos(a) * 0.25, SW.surfY + 0.05, z + Math.sin(a) * 0.25, Math.cos(a) * out, up, Math.sin(a) * out, 0.025 + Math.random() * 0.045 * Math.min(1.5, power), 1.6, 0, SW.surfY);
    }
    for (let i = 0; i < 14 * power; i++) this.drop(x + (Math.random() - 0.5) * 0.7, SW.surfY - 0.2 - Math.random() * 0.9 * power, z + (Math.random() - 0.5) * 0.7, 0, 0.5 + Math.random() * 0.6, 0, 0.02 + Math.random() * 0.03, 3, 1);
  }
  _stepFx(dt) {
    const R = this.rings, D = this.drops, sc = this.scene;
    if (R.length) {
      if (!this._ringMesh) this._mkRings();
      const a = this._ringA.array; let n = 0;
      for (let i = R.length - 1; i >= 0; i--) { const q = R[i]; q.age += dt; q.r += q.v * dt; q.v *= 1 - Math.min(1, dt * 0.6); if (q.age >= q.life) R.splice(i, 1); }
      for (const q of R) { const k = 1 - q.age / q.life; a[n * 4] = q.x; a[n * 4 + 1] = q.z; a[n * 4 + 2] = q.r; a[n * 4 + 3] = k * Math.sqrt(k) * q.amp * Math.min(1, q.age * 8); n++; }
      this._ringA.needsUpdate = true; this._ringMesh.geometry.instanceCount = n;
    }
    const rm = this._ringMesh;
    if (rm) { const want = R.length > 0 && !this.under; if (want !== !!rm.parent) { if (want) sc.add(rm); else rm.removeFromParent(); } }
    if (D.length) {
      if (!this._dropMesh) this._mkDrops();
      const a = this._dropA.array, b = this._dropB.array; let n = 0;
      for (let i = D.length - 1; i >= 0; i--) {
        const q = D[i]; q.age += dt;
        if (q.kind === 1) { q.y += q.vy * dt; q.x += Math.sin(q.age * 7 + q.z * 9) * 0.12 * dt; if (q.y > SW.surfY - 0.03) q.age = q.life; }
        else { q.vy -= 9.8 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.y < q.floorY && q.vy < 0) { if (q.kind === 0 && Math.random() < 0.12) this.ring(q.x, q.z, 0.03, 0.5, 0.8, 0.5); q.age = q.life; } }
        if (q.age >= q.life) D.splice(i, 1);
      }
      for (const q of D) {
        a[n * 4] = q.x; a[n * 4 + 1] = q.y; a[n * 4 + 2] = q.z; a[n * 4 + 3] = q.size;
        b[n * 2] = Math.min(1, (q.life - q.age) * 4) * (q.kind === 1 ? 0.7 : 0.85); b[n * 2 + 1] = q.kind === 1 ? -1 : Math.min(1, Math.abs(q.vy) * 0.12); n++;
      }
      this._dropA.needsUpdate = true; this._dropB.needsUpdate = true; this._dropMesh.geometry.instanceCount = n;
    }
    const dm = this._dropMesh;
    if (dm) { const want = D.length > 0; if (want !== !!dm.parent) { if (want) sc.add(dm); else dm.removeFromParent(); } }
  }

  // ---------------------------------------------------------- the underwater set
  _mkUnder(bed) {
    const U = this.U, g = new THREE.Group(); g.name = 'swim:underwater'; g.userData.owner = 'swim';
    const fogU = () => THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
    // river bed
    const n = bed.n, geo = new THREE.BufferGeometry(), idx = [];
    this._bedP = new THREE.BufferAttribute(new Float32Array(n * n * 3), 3); this._bedP.setUsage(THREE.DynamicDrawUsage);
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const k = j * n + i; idx.push(k, k + n, k + 1, k + 1, k + n, k + n + 1); }
    geo.setAttribute('position', this._bedP); geo.setIndex(idx);
    const bm = new THREE.ShaderMaterial({
      fog: true, uniforms: Object.assign(fogU(), { uTime: U.uTime, uDay: U.uDay, uSun: U.uSun }),
      vertexShader: `varying vec3 vW;\n${FOG_PARS_V}\nvoid main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n${FOG_V}\n}`,
      fragmentShader: /* glsl */`uniform float uTime; uniform float uDay; uniform float uSun; varying vec3 vW;
${FOG_PARS_F}
${NOISE}
void main() {
  vec2 p = vW.xz;
  float n1 = sNoise(p * 0.55), n2 = sNoise(p * 2.7 + 9.1), n3 = sNoise(p * 13.0), n4 = sNoise(p * 31.0 + 5.0);
  vec3 silt = vec3(0.21, 0.185, 0.115), gravel = vec3(0.34, 0.31, 0.24), mud = vec3(0.095, 0.085, 0.055), algae = vec3(0.10, 0.17, 0.06);
  float gr = smoothstep(0.42, 0.66, n1 + 0.25 * n2);
  vec3 col = mix(silt, gravel * (0.72 + 0.5 * n3), gr);
  col = mix(col, vec3(0.5, 0.47, 0.4), gr * smoothstep(0.7, 0.82, n4) * 0.7);                      // pale pebbles in the gravel
  col = mix(col, mud, (1.0 - gr) * smoothstep(0.45, 0.8, n2) * 0.8);
  col = mix(col, algae, smoothstep(0.55, 0.8, sNoise(p * 0.9 + 40.0)) * 0.5);
  vec3 N = normalize(cross(dFdx(vW), dFdy(vW))); N = N.y < 0.0 ? -N : N;
  float depth = max(0.0, ${SW.surfY.toFixed(3)} - vW.y);
  float lit = (0.5 + 0.5 * N.y) * exp(-depth * 0.22);
  float ca = caustic(p * 1.25, uTime * 0.9) * exp(-depth * 0.3) * uSun;
  col *= (0.5 + 0.2 * uDay) * lit * (0.25 + 0.75 * uDay) + ca * vec3(0.85, 1.0, 0.7) * 0.7;
  gl_FragColor = vec4(col, 1.0);
  ${OUT_F}
  #include <fog_fragment>
}`,
    });
    this.bedMesh = new THREE.Mesh(geo, bm); this.bedMesh.frustumCulled = false; this.bedMesh.name = 'swim:bed'; g.add(this.bedMesh);
    // the surface from below: Snell's window, total reflection of the murk outside it
    const sg = new THREE.CircleGeometry(60, 28); sg.rotateX(Math.PI / 2);
    const sm = new THREE.ShaderMaterial({
      fog: true, uniforms: Object.assign(fogU(), { uTime: U.uTime, uSky: U.uSky, uDeep: U.uDeep, uSun: U.uSun, uSlant: U.uSlant }),
      vertexShader: `varying vec3 vW;\n${FOG_PARS_V}\nvoid main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n${FOG_V}\n}`,
      fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uSky; uniform vec3 uDeep; uniform float uSun; uniform vec2 uSlant; varying vec3 vW;
${FOG_PARS_F}
${NOISE}
void main() {
  vec3 V = normalize(vW - cameraPosition);
  vec2 p = vW.xz; float t = uTime;
  float h = sNoise(p * 1.1 + vec2(t * 0.35, t * 0.2)) * 0.6 + sNoise(p * 2.9 - vec2(t * 0.5, -t * 0.3)) * 0.4;
  float cosT = V.y + (h - 0.5) * 0.3;
  float win = smoothstep(0.6, 0.74, cosT);
  float rim = exp(-pow((cosT - 0.66) / 0.05, 2.0));
  // the sun is a bright smear where the refracted ray comes down
  vec2 sp = p - (cameraPosition.xz - uSlant * (cameraPosition.y - 0.03) * -1.0);
  float glare = exp(-dot(sp, sp) * 0.55) * uSun;
  vec3 sky = uSky * (0.7 + 0.6 * h) + vec3(1.0, 0.98, 0.8) * glare * 1.6;
  vec3 refl = uDeep * (0.7 + 1.3 * h);
  vec3 col = mix(refl, sky, win) + uSky * rim * 0.35;
  gl_FragColor = vec4(col, 1.0);
  ${OUT_F}
  #include <fog_fragment>
}`,
    });
    this.topMesh = new THREE.Mesh(sg, sm); this.topMesh.frustumCulled = false; this.topMesh.name = 'swim:surface-below'; g.add(this.topMesh);
    // everything beyond the murk
    this.backMesh = new THREE.Mesh(new THREE.SphereGeometry(46, 12, 8), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: true }));
    this.backMesh.frustumCulled = false; this.backMesh.name = 'swim:murk'; g.add(this.backMesh);
    // light shafts: slanted sheets on a 24 m lattice that wraps round the camera
    {
      const P = [], B = [], I = [], N = 22;
      for (let i = 0; i < N; i++) {
        const bx = hash2(i, 1, 91) * 24, bz = hash2(i, 2, 91) * 24, a = hash2(i, 3, 91) * Math.PI, w = 0.35 + 0.9 * hash2(i, 4, 91), ph = hash2(i, 5, 91) * 6.28, k = P.length / 3;
        const dx = Math.cos(a) * w, dz = Math.sin(a) * w;
        P.push(-dx, 0, -dz, dx, 0, dz, dx, -1, dz, -dx, -1, -dz);
        for (let q = 0; q < 4; q++) B.push(bx, bz, ph);
        I.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
      const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); sgeo.setAttribute('aBase', new THREE.Float32BufferAttribute(B, 3)); sgeo.setIndex(I);
      const shm = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uTime: U.uTime, uSun: U.uSun, uSlant: U.uSlant, uCam: U.uCam },
        vertexShader: /* glsl */`attribute vec3 aBase; uniform vec3 uCam; uniform vec2 uSlant; uniform float uTime; varying float vA; varying float vY;
void main() {
  vec2 cell = floor((uCam.xz - aBase.xy) / 24.0 + 0.5) * 24.0 + aBase.xy;
  float d = -position.y * 3.4;
  vec3 w = vec3(cell.x + position.x + uSlant.x * d, ${SW.surfY.toFixed(3)} - 0.03 - d, cell.y + position.z + uSlant.y * d);
  float dist = length(w.xz - uCam.xz);
  float fl = 0.5 + 0.5 * sin(uTime * 0.9 + aBase.z) * sin(uTime * 0.37 + aBase.z * 2.3);
  vA = smoothstep(1.0, 3.5, dist) * (1.0 - smoothstep(7.0, 13.0, dist)) * fl; vY = -position.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,
        fragmentShader: /* glsl */`uniform float uSun; varying float vA; varying float vY;
void main() { float a = vA * (1.0 - vY) * (1.0 - vY) * uSun * 0.16; gl_FragColor = vec4(vec3(0.75, 1.0, 0.62) * a, a);
  ${OUT_F}
}`,
      });
      this.shaftMesh = new THREE.Mesh(sgeo, shm); this.shaftMesh.frustumCulled = false; this.shaftMesh.renderOrder = 5; this.shaftMesh.name = 'swim:shafts'; g.add(this.shaftMesh);
    }
    // weed
    const wm = new THREE.ShaderMaterial({
      fog: true, side: THREE.DoubleSide, vertexColors: true, uniforms: Object.assign(fogU(), { uTime: U.uTime, uDay: U.uDay }),
      vertexShader: /* glsl */`uniform float uTime; varying vec3 vC; varying float vH;
${FOG_PARS_V}
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 o = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float u = position.y, ph = o.x * 0.7 + o.z * 0.9;
  w.x += (sin(uTime * 1.1 + ph + u * 2.0) * 0.16 + 0.1) * u * u; w.z += cos(uTime * 0.8 + ph * 1.3 + u * 1.5) * 0.12 * u * u;
  vC = color; vH = u;
  vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
  ${FOG_V}
}`,
      fragmentShader: `uniform float uDay; varying vec3 vC; varying float vH;\n${FOG_PARS_F}\nvoid main() { gl_FragColor = vec4(vC * (0.3 + 0.75 * vH) * (0.1 + 0.9 * uDay * uDay), 1.0);\n${OUT_F}\n#include <fog_fragment>\n}`,
    });
    this.weedMesh = new THREE.InstancedMesh(weedGeometry(), wm, WEED_CAP); this.weedMesh.frustumCulled = false; this.weedMesh.count = 0; this.weedMesh.name = 'swim:weed'; g.add(this.weedMesh);
    // junk
    const jm = new THREE.MeshLambertMaterial({ vertexColors: true });
    this._junkGeo = junkGeometries(); this._junkMat = jm; this.junkMeshes = [];
    for (let i = 0; i < JUNK_CAP; i++) { const m = new THREE.Mesh(this._junkGeo[0], jm); m.visible = false; m.name = 'swim:junk'; g.add(m); this.junkMeshes.push(m); }
    this.uw = g;
  }

  /** re-lay the bed, the weed and the junk after BedField.recentre() */
  _syncBed(bed) {
    this._bedV = bed.version;
    const n = bed.n, c = bed.cell, a = this._bedP.array, x0 = bed.cx - bed.half, z0 = bed.cz - bed.half;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; a[k * 3] = x0 + i * c; a[k * 3 + 1] = bed.y[k]; a[k * 3 + 2] = z0 + j * c; }
    this._bedP.needsUpdate = true;
    // weed: clumps on a hashed 1.6 m lattice (world-anchored: the same clumps whoever looks)
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), E = new THREE.Euler();
    const L = 1.6; let w = 0;
    const i0 = Math.ceil(x0 / L), i1 = Math.floor((x0 + 2 * bed.half) / L), j0 = Math.ceil(z0 / L), j1 = Math.floor((z0 + 2 * bed.half) / L);
    for (let j = j0; j <= j1 && w < WEED_CAP; j++) for (let i = i0; i <= i1 && w < WEED_CAP; i++) {
      if (hash2(i, j, 41) > 0.55) continue;
      const x = (i + hash2(i, j, 42) - 0.5) * L, z = (j + hash2(i, j, 43) - 0.5) * L;
      if (vnoise(x / 5.5, z / 5.5, 44) < 0.5) continue;
      const d = bed.depthAt(x, z); if (d < 0.5) continue;
      const hgt = Math.min(d * 0.85, 0.5 + 1.1 * hash2(i, j, 45));
      E.set(0, hash2(i, j, 46) * 6.283, 0); Q.setFromEuler(E); S.set(0.8 + 0.6 * hash2(i, j, 47), hgt, 0.8 + 0.6 * hash2(i, j, 47)); T.set(x, SW.surfY - d - 0.02, z);
      M.compose(T, Q, S); this.weedMesh.setMatrixAt(w++, M);
    }
    this.weedMesh.count = w; this.weedN = w; this.weedMesh.instanceMatrix.needsUpdate = true;
    // junk: at most one thing per 26 m cell, where it is deep enough to hide it
    const J = 26; let q = 0; this.junk.length = 0;
    for (let cj = Math.floor(z0 / J); cj <= Math.floor((z0 + 2 * bed.half) / J) && q < JUNK_CAP; cj++) for (let ci = Math.floor(x0 / J); ci <= Math.floor((x0 + 2 * bed.half) / J) && q < JUNK_CAP; ci++) {
      if (hash2(ci, cj, 61) > 0.6) continue;
      let x = 0, z = 0, d = 0;
      for (let t = 0; t < 5 && d < 1.1; t++) { x = (ci + 0.1 + 0.8 * hash2(ci, cj, 62 + t * 7)) * J; z = (cj + 0.1 + 0.8 * hash2(ci, cj, 63 + t * 7)) * J; d = bed.depthAt(x, z); }
      if (d < 1.1) continue;
      const kind = Math.floor(hash2(ci, cj, 64) * this._junkGeo.length) % this._junkGeo.length, m = this.junkMeshes[q++];
      m.geometry = this._junkGeo[kind]; m.position.set(x, SW.surfY - d - 0.05, z); m.rotation.set(0, hash2(ci, cj, 65) * 6.283, 0); m.visible = true;
      this.junk.push({ kind, x, z });
    }
    for (; q < JUNK_CAP; q++) this.junkMeshes[q].visible = false;
  }

  /** the camera went under / came up: swap the world's haze for the river's murk */
  setUnder(on, bed) {
    if (on === this.under) return;
    this.under = on;
    const cam = this.game.camera;
    if (on) {
      if (!this.uw) this._mkUnder(bed);
      this._bedV = -1;
      this.scene.add(this.uw);
      this._far0 = cam.far; cam.far = 64; cam.updateProjectionMatrix();
    } else {
      if (this.uw) this.uw.removeFromParent();
      if (this._far0) { cam.far = this._far0; cam.updateProjectionMatrix(); }
    }
  }
  /** call every frame the camera is under, AFTER world.update (which sets the day's haze) */
  applyUnder(bed, haze) {
    const g = this.game, cam = g.camera, sc = this.scene, U = this.U;
    if (bed.version !== this._bedV) this._syncBed(bed);
    const day = Math.max(0, Math.min(1, g.time && g.time.daylight !== undefined ? g.time.daylight : 1)), lum = 0.1 + 0.9 * day;
    const r = 0.14 * lum, gg = 0.245 * lum, b = 0.135 * lum;
    if (sc.fog) {
      const post = !!g.postRender && g.scene === g.worldScene;
      if (post) { const k = ((g.renderer && g.renderer.toneMappingExposure) || 1) / 0.6; sc.fog.color.setRGB(acesInv(r) / k, acesInv(gg) / k, acesInv(b) / k); }
      else sc.fog.color.setRGB(r, gg, b, THREE.SRGBColorSpace);
      sc.fog.density = 0.17;
    }
    if (haze) { haze.sunCol[0] = haze.sunCol[1] = haze.sunCol[2] = 0; }
    U.uDay.value = day; U.uCam.value.copy(cam.position);
    let sx = 0.3, sz = 0.1, sun = day;
    const sky = g.world && g.world.sky, sd = sky && sky.sunDir;
    if (sd && sd.y > 0.02) { const k = 0.75 / Math.max(0.35, sd.y); sx = -sd.x * k * 0.6; sz = -sd.z * k * 0.6; sun = day * Math.min(1, sd.y * 4); } else if (sd) sun = 0;
    U.uSun.value = sun; U.uSlant.value.set(sx, sz);
    U.uSky.value.setRGB(0.5 * lum, 0.72 * lum, 0.5 * lum); U.uDeep.value.setRGB(0.035 * lum, 0.07 * lum, 0.04 * lum);
    this.topMesh.position.set(cam.position.x, SW.surfY - 0.03, cam.position.z);
    this.backMesh.position.copy(cam.position);
    this.shaftMesh.visible = sun > 0.03;
  }

  // ---------------------------------------------------------- fish
  _mkFish() {
    const geo = fishGeometry();
    this._fishPh = new THREE.InstancedBufferAttribute(new Float32Array(FISH_CAP * 2), 2); this._fishPh.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPh', this._fishPh);
    const wiggle = (sh) => {
      sh.uniforms.uTime = this.U.uTime;
      sh.vertexShader = 'attribute vec2 aPh;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n  transformed.x += sin(uTime * (5.0 + aPh.y * 9.0) + aPh.x + position.z * 5.5) * (0.56 - position.z) * (0.045 + 0.05 * aPh.y);');
    };
    const under = new THREE.MeshLambertMaterial({ vertexColors: true }); under.onBeforeCompile = wiggle;
    const above = new THREE.MeshBasicMaterial({ color: 0x76865e, transparent: true, opacity: 0.55, depthWrite: false, fog: false });      // pale olive backs just under the surface
    above.onBeforeCompile = (sh) => { wiggle(sh); sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  mvPosition.xyz *= 1.0 - 0.006; gl_Position = projectionMatrix * mvPosition;'); };
    this._fishMats = [null, above, under];
    const m = new THREE.InstancedMesh(geo, under, FISH_CAP); m.frustumCulled = false; m.count = 0; m.name = 'swim:fish'; m.userData.owner = 'swim'; m.renderOrder = 2;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FISH_CAP * 3), 3);
    this.fish = m;
    this._fOff = new Float32Array(FISH_CAP * 3);      // per fish: flee offset x, z, alarm 0..1
  }
  /** (re)build the list of schools round (x, z): the 3 × 3 fish cells, same for everyone */
  _schools(x, z, isWater) {
    const cx = Math.floor(x / SW.cell), cz = Math.floor(z / SW.cell);
    if (cx === this._fcx && cz === this._fcz) return;
    this._fcx = cx; this._fcz = cz; this.schools.length = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) schoolsIn(cx + i, cz + j, isWater, this.schools);
    if (this._fOff) this._fOff.fill(0);
    let n = 0; const col = this.fish.instanceColor.array;
    for (const s of this.schools) {
      const F = FISH[s.kind];
      for (let i = 0; i < s.n && n < FISH_CAP; i++, n++) { const v = 0.85 + 0.3 * hash2(s.seed, i, 5); col[n * 3] = F[5] * v; col[n * 3 + 1] = F[6] * v; col[n * 3 + 2] = F[7] * v; }
    }
    this.fish.instanceColor.needsUpdate = true; this.fishN = n;
  }
  /**
   * mode 0 none, 1 dark shapes under the surface (camera above), 2 the fish themselves (camera under).
   * swimmers: flat [x, z, x, z …] of people in the water (fish keep away from them); t: shared seconds.
   */
  updateFish(mode, dt, t, x, z, bed, isWater, swimmers, nSw) {
    if (!mode) { if (this.fish && this.fish.parent) this.fish.removeFromParent(); this.fishMode = 0; return; }
    if (!this.fish) this._mkFish();
    const m = this.fish;
    if (mode !== this.fishMode) { this.fishMode = mode; m.material = this._fishMats[mode]; }
    this._schools(x, z, isWater);
    if (!m.parent && this.fishN) this.scene.add(m); else if (m.parent && !this.fishN) m.removeFromParent();
    const o = this._o || (this._o = {}), M = this._M || (this._M = new THREE.Matrix4()), off = this._fOff, ph = this._fishPh.array, e = M.elements;
    let n = 0;
    for (const s of this.schools) {
      const wary = FISH[s.kind][9];
      for (let i = 0; i < s.n && n < FISH_CAP; i++, n++) {
        fishAt(s, i, t, o);
        let px = o.x + off[n * 3], pz = o.z + off[n * 3 + 1], alarm = off[n * 3 + 2], h = o.h, fled = false;
        for (let k = 0; k < nSw; k++) {
          const dx = px - swimmers[k * 2], dz = pz - swimmers[k * 2 + 1], d = Math.hypot(dx, dz);
          if (d < wary) {
            const push = (wary - d + 0.25) * Math.min(1, dt * (s.kind === 3 ? 2.5 : 7)), inv = 1 / Math.max(d, 0.05);
            const nx = off[n * 3] + dx * inv * push, nz = off[n * 3 + 1] + dz * inv * push;
            if (isWater(o.x + nx, o.z + nz)) { off[n * 3] = nx; off[n * 3 + 1] = nz; }
            h = Math.atan2(dx, dz); alarm = 1; fled = true;
          }
        }
        if (!fled) { const k = Math.exp(-dt * 0.45); off[n * 3] *= k; off[n * 3 + 1] *= k; alarm = Math.max(0, alarm - dt * 0.8); if (alarm > 0.02) h = Math.atan2(-off[n * 3], -off[n * 3 + 1]) * alarm + h * (1 - alarm); }
        off[n * 3 + 2] = alarm;
        px = o.x + off[n * 3]; pz = o.z + off[n * 3 + 1];
        const d = bed.depthAt(px, pz);
        let L = o.len, y;
        if (d < 0.45) L = 0;      // off the bed grid / in the shallows: not drawn
        if (mode === 2) y = Math.max(SW.surfY - d + 0.14, Math.min(SW.surfY - 0.22, SW.surfY - d * s.df + o.dy)); else y = SW.surfY + 0.012;
        const sn = Math.sin(h), cs = Math.cos(h), sy = mode === 2 ? L : L * 0.02, wx = mode === 2 ? L : L * 1.9;      // (from above: a flat, slightly fattened shadow)
        e[0] = cs * wx; e[1] = 0; e[2] = -sn * wx; e[3] = 0; e[4] = 0; e[5] = sy; e[6] = 0; e[7] = 0; e[8] = sn * L; e[9] = 0; e[10] = cs * L; e[11] = 0; e[12] = px; e[13] = y; e[14] = pz; e[15] = 1;
        m.setMatrixAt(n, M);
        ph[n * 2] = (s.seed % 97) + i * 1.7; ph[n * 2 + 1] = Math.min(1, alarm + o.v * 0.5);
      }
    }
    m.count = n; m.instanceMatrix.needsUpdate = true; this._fishPh.needsUpdate = true;
    // seen from above, what gives fish away is the rise: a ring where one comes up to take a fly (cosmetic, local)
    if (mode === 1 && n && (this._riseT = (this._riseT || 1) - dt) <= 0) {
      this._riseT = 0.7 + Math.random() * 2.2;
      const k = Math.floor(Math.random() * n), a = m.instanceMatrix.array, fx = a[k * 16 + 12], fz = a[k * 16 + 14];
      if (Math.abs(a[k * 16]) + Math.abs(a[k * 16 + 2]) > 0.01 && Math.hypot(fx - x, fz - z) < 22) { this.ring(fx, fz, 0.04, 0.45, 1.6, 0.8); this.ring(fx, fz, 0.02, 0.25, 2.0, 0.5); }
    }
  }

  update(dt) {
    if (this.hold) dt = 0;                  // (screenshots: hold the splash)
    this.U.uTime.value = (this.U.uTime.value + dt) % 3600;
    if (this.rings.length || this.drops.length || (this._ringMesh && this._ringMesh.parent) || (this._dropMesh && this._dropMesh.parent)) this._stepFx(dt);
  }
  /** true when nothing of ours is in the scene */
  get idle() { return !(this._ringMesh && this._ringMesh.parent) && !(this._dropMesh && this._dropMesh.parent) && !(this.uw && this.uw.parent) && !(this.fish && this.fish.parent); }
  stats() {
    let draws = 0, tris = 0;
    const add = (m) => { if (!m || !m.parent || m.visible === false) return; const g = m.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3, inst = m.isInstancedMesh ? m.count : g.isInstancedBufferGeometry ? g.instanceCount : 1; if (inst > 0) { draws++; tris += n * inst; } };
    add(this._ringMesh); add(this._dropMesh); add(this.fish);
    if (this.uw && this.uw.parent) { add(this.bedMesh); add(this.topMesh); add(this.backMesh); add(this.shaftMesh); add(this.weedMesh); for (const j of this.junkMeshes) add(j); }
    return { draws, tris: Math.round(tris), rings: this.rings.length, drops: this.drops.length, fish: this.fishN, schools: this.schools.length, weed: this.weedN, junk: this.junk.length, under: this.under };
  }
}
