// Cheap pooled effects for vehicle physics (underscore: a helper of vehicles.js). Each pool is ONE draw, hidden when
// empty, and allocates nothing per frame:
//   SkidMarks  a ring buffer of dark quads laid down behind skidding / spinning / locked tyres (strips per wheel)
//   Puffs      a points cloud: tyre smoke, dust off grass, bonnet steam, smoke from a wrecked engine, sparks
//   Debris     an instanced pool of small rigid bits (hubcaps, bumper corners) that bounce, slide and lie in the road
// Everything is cosmetic and local (Math.random is fine here: nothing has to agree between players).
import { TERRAIN_VS } from '../world/terrain.js';
import * as THREE from 'three';
import { markRange } from '../world/util.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------- skid marks
export class SkidMarks {
  constructor(scene, n = 1200) {
    this.n = n; this.i = 0; this.frame = 0; this.used = 0;
    const pos = new Float32Array(n * 4 * 3), col = new Float32Array(n * 4 * 4), idx = new Uint32Array(n * 6);
    for (let q = 0; q < n; q++) { const v = q * 4, o = q * 6; idx[o] = v; idx[o + 1] = v + 2; idx[o + 2] = v + 1; idx[o + 3] = v + 1; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(g, m); this.mesh.name = 'vehicle:skidmarks'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.mesh.visible = false; this.mesh.userData.owner = 'vehicles';
    scene.add(this.mesh);
    this.pos = pos; this.col = col;
  }
  /** an emitter (one per wheel): keep it on the vehicle */
  static emitter() { return { x: 0, z: 0, f: -10 }; }
  /** call every frame a tyre is marking the road: (x, y, z) contact point, width, darkness 0..1 */
  mark(e, x, y, z, w, a) {
    const f = this.frame;
    if (e.f < f - 1) { e.x = x; e.z = z; e.f = f; return; }      // a new strip starts here
    e.f = f;
    const dx = x - e.x, dz = z - e.z, l2 = dx * dx + dz * dz;
    if (l2 < 0.09) return;                                       // a quad every 30 cm
    if (l2 > 4) { e.x = x; e.z = z; return; }                    // (a jump: don't draw a line across)
    const l = Math.sqrt(l2), px = dz / l * w * 0.5, pz = -dx / l * w * 0.5, q = this.i, P = this.pos, C = this.col, yy = y + 0.012;
    let o = q * 12;
    P[o] = e.x - px; P[o + 1] = yy; P[o + 2] = e.z - pz; P[o + 3] = e.x + px; P[o + 4] = yy; P[o + 5] = e.z + pz;
    P[o + 6] = x - px; P[o + 7] = yy; P[o + 8] = z - pz; P[o + 9] = x + px; P[o + 10] = yy; P[o + 11] = z + pz;
    const al = clamp(a, 0, 1) * 0.55;
    o = q * 16;
    for (let k = 0; k < 4; k++) { C[o + k * 4] = 0.05; C[o + k * 4 + 1] = 0.05; C[o + k * 4 + 2] = 0.05; C[o + k * 4 + 3] = al; }
    this.i = (q + 1) % this.n; if (this.used < this.n) this.used++; this.total = (this.total || 0) + 1;
    e.x = x; e.z = z;
    // flag the quad for upload here, not in update(): vehicles.update() runs update() first and lays its marks after,
    // so they used to reach the GPU a frame late. markRange folds into what is pending (never clear + add: a frame's
    // quads must still go up if the last frame's never did — the mesh is not drawn while the player is indoors, and
    // other players' cars lay skids then too)
    const g = this.mesh.geometry;
    markRange(g.attributes.position, q * 12, 12); markRange(g.attributes.color, q * 16, 16);
    g.drawRange.count = this.used * 6; this.mesh.visible = true;
  }
  update() { this.frame++; }
  clear() { this.used = 0; this.i = 0; this.mesh.geometry.setDrawRange(0, 0); this.mesh.visible = false; }
}

// ---------------------------------------------------------------- puffs (smoke, dust, steam, sparks)
const PUFF_VS = `attribute vec4 aCol; attribute float aSize; varying vec4 vCol;` + TERRAIN_VS + `
void main() { vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xyz += GTO_DH(position.xz); gl_PointSize = aSize * 300.0 / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PUFF_FS = `varying vec4 vCol;
void main() { vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0) discard; gl_FragColor = vec4(vCol.rgb, vCol.a * (1.0 - r)); }`;
// kinds: [r, g, b, alpha, size0, size1 (grows to), life, rise (m/s), drag, gravity]
export const PUFF = {
  smoke: [0.82, 0.82, 0.82, 0.35, 0.35, 1.6, 1.4, 0.5, 2.0, 0],
  dust: [0.55, 0.47, 0.34, 0.4, 0.3, 1.3, 1.1, 0.25, 2.5, 0],
  steam: [0.95, 0.95, 0.95, 0.4, 0.25, 1.1, 1.3, 1.2, 1.5, 0],
  black: [0.18, 0.18, 0.18, 0.45, 0.35, 1.8, 2.2, 1.0, 1.2, 0],
  spark: [1.0, 0.75, 0.3, 1.0, 0.06, 0.03, 0.35, 0, 0.5, 9],
  splash: [0.85, 0.9, 0.95, 0.6, 0.12, 0.25, 0.7, 0, 0.6, 9],
};
export class Puffs {
  constructor(scene, n = 192) {
    this.n = n; this.i = 0; this.alive = 0;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.t = new Float32Array(n); this.life = new Float32Array(n); this.k = new Array(n).fill(null);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({ vertexShader: PUFF_VS, fragmentShader: PUFF_FS, transparent: true, depthWrite: false });
    this.mesh = new THREE.Points(g, m); this.mesh.name = 'vehicle:puffs'; this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 3;
    this.mesh.userData.owner = 'vehicles';
    scene.add(this.mesh);
  }
  /** one particle of kind K (a PUFF row) at (x, y, z) moving (vx, vy, vz), plus a little scatter */
  emit(K, x, y, z, vx = 0, vy = 0, vz = 0, scatter = 0.3) {
    const i = this.i; this.i = (i + 1) % this.n;
    const r = () => (Math.random() - 0.5) * 2 * scatter;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx + r(); this.v[i * 3 + 1] = vy + Math.abs(r()) * 0.5; this.v[i * 3 + 2] = vz + r();
    this.k[i] = K; this.t[i] = 0; this.life[i] = K[6] * (0.75 + Math.random() * 0.5);
    this.alive = this.n;        // (re-counted in update)
  }
  update(dt) {
    if (!this.alive) return;
    let n = 0;
    const P = this.p, V = this.v, O = this.pos, C = this.col, S = this.size;
    for (let i = 0; i < this.n; i++) {
      const K = this.k[i];
      if (!K) { S[i] = 0; C[i * 4 + 3] = 0; continue; }
      const t = (this.t[i] += dt), L = this.life[i];
      if (t >= L) { this.k[i] = null; S[i] = 0; C[i * 4 + 3] = 0; continue; }
      n++;
      const dr = Math.exp(-K[8] * dt);
      V[i * 3] *= dr; V[i * 3 + 2] *= dr; V[i * 3 + 1] = V[i * 3 + 1] * dr + (K[7] * (1 - dr)) - K[9] * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      const u = t / L;
      O[i * 3] = P[i * 3]; O[i * 3 + 1] = P[i * 3 + 1]; O[i * 3 + 2] = P[i * 3 + 2];
      C[i * 4] = K[0]; C[i * 4 + 1] = K[1]; C[i * 4 + 2] = K[2]; C[i * 4 + 3] = K[3] * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
      S[i] = K[4] + (K[5] - K[4]) * u;
    }
    this.alive = n;
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
    this.mesh.visible = n > 0;
  }
}

// ---------------------------------------------------------------- debris
export class Debris {
  constructor(scene, groundFn, n = 24) {
    this.n = n; this.list = []; this.ground = groundFn;
    const g = new THREE.CylinderGeometry(0.17, 0.17, 0.035, 10);
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.3 });
    this.mesh = new THREE.InstancedMesh(g, m, n); this.mesh.name = 'vehicle:debris'; this.mesh.count = 0; this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    this.mesh.userData.owner = 'vehicles';
    scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
    for (let i = 0; i < n; i++) this.list.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, sx: 1, sy: 1, sz: 1, t: 0, rest: false, hex: 0xcccccc });
    this.next = 0; this.active = 0;
  }
  /** a bit flies off: kind 'hubcap' | 'bumper' | 'glass', colour (for bumper bits: the car's paint) */
  spawn(kind, x, y, z, vx, vy, vz, hex) {
    const d = this.list[this.next]; this.next = (this.next + 1) % this.n;
    d.on = true; d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz; d.t = 0; d.rest = false;
    d.rx = Math.random() * 6; d.ry = Math.random() * 6; d.rz = 0;
    d.wx = (Math.random() - 0.5) * 14; d.wy = (Math.random() - 0.5) * 10; d.wz = (Math.random() - 0.5) * 14;
    if (kind === 'hubcap') { d.sx = 1; d.sy = 1; d.sz = 1; d.hex = 0xc8ccd0; }
    else if (kind === 'glass') { d.sx = 0.35; d.sy = 0.6; d.sz = 0.3; d.hex = 0x9fb7c2; }
    else { d.sx = 1.9 + Math.random() * 0.8; d.sy = 1.6; d.sz = 0.55; d.hex = hex ?? 0x777777; }
    this.dirty = true;
  }
  update(dt) {
    let n = 0;
    const M = this.mesh, A = M.instanceMatrix.array, CC = M.instanceColor.array;
    for (const d of this.list) {
      if (!d.on) continue;
      d.t += dt;
      if (d.t > 40) { d.on = false; continue; }
      if (!d.rest) {
        d.vy -= 9.81 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
        const gy = this.ground(d.x, d.z) + 0.02 * d.sy;
        if (d.y < gy) {
          d.y = gy;
          if (d.vy < -1.2) { d.vy *= -0.3; d.wx *= 0.5; d.wz *= 0.5; }
          else {
            d.vy = 0;
            // sliding / spinning down on the road, then settling flat
            const s = Math.hypot(d.vx, d.vz), k = Math.max(0, s - 5 * dt) / (s || 1); d.vx *= k; d.vz *= k;
            d.rx += (Math.round(d.rx / Math.PI) * Math.PI - d.rx) * Math.min(1, dt * 8); d.rz += (Math.round(d.rz / Math.PI) * Math.PI - d.rz) * Math.min(1, dt * 8);
            d.wx *= Math.exp(-6 * dt); d.wz *= Math.exp(-6 * dt); d.wy *= Math.exp(-2.5 * dt);
            if (s < 0.05 && Math.abs(d.wy) < 0.1) d.rest = true;
          }
        }
      }
      const fade = d.t > 37 ? (40 - d.t) / 3 : 1;
      this._e.set(d.rx, d.ry, d.rz); this._q.setFromEuler(this._e); this._p.set(d.x, d.y, d.z); this._s.set(d.sx * fade, d.sy * fade, d.sz * fade);
      this._m.compose(this._p, this._q, this._s); this._m.toArray(A, n * 16);
      this._c.setHex(d.hex); CC[n * 3] = this._c.r; CC[n * 3 + 1] = this._c.g; CC[n * 3 + 2] = this._c.b;
      n++;
    }
    if (n || this.active) { M.count = n; M.instanceMatrix.needsUpdate = true; M.instanceColor.needsUpdate = true; M.visible = n > 0; }
    this.active = n;
  }
}
