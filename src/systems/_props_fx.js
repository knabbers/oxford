// Dynamic props: what draws them. Two small pieces, both invisible (0 draws) unless something is knocked:
//   DynMesh    one merged, CPU-transformed mesh for every knocked prop that shares a material — the street items with
//              the streetscape's own material and atlas (same shader program as street:solid), the world furniture with
//              world.M.furniture. Only bodies that moved this frame are rewritten (partial buffer upload).
//   Particles  one THREE.Points for sparks, spilt litter, shaken leaves and splash droplets (≤ 700 at once).
import * as THREE from 'three';

export class DynMesh {
  constructor(material, { name, cap = 48000, fx = true, depth = null, shadow = false }) {
    this.fx = fx; this.cap = cap;
    const g = new THREE.BufferGeometry();
    const A = (k) => { const a = new THREE.BufferAttribute(new Float32Array(cap * k), k); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', A(3)); g.setAttribute('normal', A(3)); g.setAttribute('color', A(3));
    if (fx) { g.setAttribute('uv', A(2)); g.setAttribute('aFx', A(3)); }
    const idx = new THREE.BufferAttribute(new Uint32Array(Math.floor(cap * 2.2)), 1); idx.setUsage(THREE.DynamicDrawUsage); g.setIndex(idx);
    g.setDrawRange(0, 0); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const m = (this.mesh = new THREE.Mesh(g, material));
    m.name = name; m.frustumCulled = false; m.matrixAutoUpdate = false; m.visible = false; m.receiveShadow = true; m.castShadow = shadow;
    if (depth) m.customDepthMaterial = depth;
    this.list = []; this.dirtyLayout = false; this.lo = 1e9; this.hi = -1;
  }
  add(e) { this.list.push(e); e.dm = this; this.dirtyLayout = true; return e; }
  remove(e) { const i = this.list.indexOf(e); if (i >= 0) { this.list.splice(i, 1); this.dirtyLayout = true; } e.dm = null; }
  _layout() {
    let v = 0, ni = 0; const I = this.mesh.geometry.index.array;
    const keep = [];
    for (const e of this.list) {
      let nv = 0, nI = 0; for (const p of e.pieces) { nv += p.proto.nv; nI += p.proto.ni; }
      if (v + nv > this.cap || ni + nI > I.length) { e.dm = null; continue; }
      keep.push(e);
      e.v0 = v; let o = v;
      for (const p of e.pieces) { const P = p.proto; for (let k = 0; k < P.ni; k++) I[ni + k] = o + P.idx[k]; ni += P.ni; o += P.nv; }
      e.nv = nv; v += nv; e.dirty = true;
    }
    this.list = keep;
    const g = this.mesh.geometry; g.index.clearUpdateRanges(); g.index.addUpdateRange(0, ni); g.index.needsUpdate = true; g.setDrawRange(0, ni);
    this.nv = v; this.dirtyLayout = false;
    this.mesh.visible = ni > 0;
  }
  /** write every entry flagged dirty (e.body pose, its pieces' hinges / glow), upload the changed range */
  flush() {
    if (this.dirtyLayout) this._layout();
    for (const e of this.list) if (e.dirty) { this._write(e); e.dirty = false; }
    if (this.hi >= 0) {
      const A = this.mesh.geometry.attributes, lo = this.lo, n = this.hi - lo;
      for (const k of this.fx ? ['position', 'normal', 'color', 'uv', 'aFx'] : ['position', 'normal', 'color']) { const a = A[k]; a.addUpdateRange(lo * a.itemSize, n * a.itemSize); a.needsUpdate = true; }
      this.lo = 1e9; this.hi = -1;
    }
  }
  _write(e) {
    const A = this.mesh.geometry.attributes, pos = A.position.array, nor = A.normal.array, col = A.color.array;
    const uv = this.fx ? A.uv.array : null, fx = this.fx ? A.aFx.array : null;
    const b = e.body, R = b.R, px = b.p[0], py = b.p[1], pz = b.p[2], com = e.com, roll = e.roll || 0, cr = Math.cos(roll), sr = Math.sin(roll), tint = e.tint, on = e.on || 0, glow = e.glow ?? 1;
    let o = e.v0;
    for (const pc of e.pieces) {
      const P = pc.proto, hg = pc.hinge, ha = hg ? hg.a : 0, hc = Math.cos(ha), hs = Math.sin(ha);
      for (let i = 0; i < P.nv; i++, o++) {
        let x = P.pos[i * 3], y = P.pos[i * 3 + 1], z = P.pos[i * 3 + 2], nx = P.nor[i * 3], ny = P.nor[i * 3 + 1], nz = P.nor[i * 3 + 2];
        if (ha) { const yy = y - hg.p[1], zz = z - hg.p[2]; y = hg.p[1] + yy * hc + zz * hs; z = hg.p[2] - yy * hs + zz * hc; const n2 = ny * hc + nz * hs; nz = -ny * hs + nz * hc; ny = n2; }
        if (roll) { const y2 = y * cr - z * sr, z2 = y * sr + z * cr; y = y2; z = z2; const n2 = ny * cr - nz * sr, n3 = ny * sr + nz * cr; ny = n2; nz = n3; }
        x -= com[0]; y -= com[1]; z -= com[2];
        const j = o * 3;
        pos[j] = px + R[0] * x + R[1] * y + R[2] * z; pos[j + 1] = py + R[3] * x + R[4] * y + R[5] * z; pos[j + 2] = pz + R[6] * x + R[7] * y + R[8] * z;
        nor[j] = R[0] * nx + R[1] * ny + R[2] * nz; nor[j + 1] = R[3] * nx + R[4] * ny + R[5] * nz; nor[j + 2] = R[6] * nx + R[7] * ny + R[8] * nz;
        if (tint) { col[j] = P.col[i * 3] * tint[0]; col[j + 1] = P.col[i * 3 + 1] * tint[1]; col[j + 2] = P.col[i * 3 + 2] * tint[2]; }
        else { col[j] = P.col[i * 3]; col[j + 1] = P.col[i * 3 + 1]; col[j + 2] = P.col[i * 3 + 2]; }
        if (uv) {
          uv[o * 2] = P.uv ? P.uv[i * 2] : 0; uv[o * 2 + 1] = P.uv ? P.uv[i * 2 + 1] : 0;
          const g = P.fx ? P.fx[i * 3] : -1; fx[j] = g >= 0 ? g + on : g; fx[j + 1] = (P.fx ? P.fx[i * 3 + 1] : 0) * glow; fx[j + 2] = 0;
        }
      }
    }
    if (e.v0 < this.lo) this.lo = e.v0;
    if (e.v0 + e.nv > this.hi) this.hi = e.v0 + e.nv;
  }
}

// kinds: 0 spark (falls, dies fast), 1 litter (lands, slides, stays), 2 leaf (flutters down, stays a while), 3 droplet
export class Particles {
  constructor(cap = 700) {
    this.cap = cap; this.n = 0; this.alive = 0;
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.kind = new Uint8Array(cap); this.ph = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(new Float32Array(cap * 3), 3); this.pa.setUsage(THREE.DynamicDrawUsage);
    this.ca = new THREE.BufferAttribute(new Float32Array(cap * 3), 3); this.ca.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) this.pa.array[i * 3 + 1] = -1000;
    g.setAttribute('position', this.pa); g.setAttribute('color', this.ca); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const m = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, sizeAttenuation: true, name: 'props:bits' });
    this.mesh = new THREE.Points(g, m); this.mesh.name = 'props:bits'; this.mesh.frustumCulled = false; this.mesh.matrixAutoUpdate = false; this.mesh.visible = false;
    this.cursor = 0;
  }
  emit(x, y, z, vx, vy, vz, life, r, g, b, kind) {
    // reuse a dead slot, else the oldest
    let i = -1;
    for (let k = 0; k < this.cap; k++) { const j = (this.cursor + k) % this.cap; if (this.life[j] <= 0) { i = j; break; } }
    if (i < 0) i = this.cursor;
    this.cursor = (i + 1) % this.cap;
    const o = i * 3;
    this.p[o] = x; this.p[o + 1] = y; this.p[o + 2] = z; this.v[o] = vx; this.v[o + 1] = vy; this.v[o + 2] = vz;
    this.life[i] = life; this.kind[i] = kind; this.ph[i] = (x * 7.3 + z * 3.1) % 6.28;
    this.ca.array[o] = r; this.ca.array[o + 1] = g; this.ca.array[o + 2] = b; this.ca.needsUpdate = true;
    this.alive++;
  }
  clear() { this.life.fill(0); for (let i = 0; i < this.cap; i++) this.pa.array[i * 3 + 1] = -1000; this.pa.needsUpdate = true; this.alive = 0; this.mesh.visible = false; }
  update(dt, ground) {
    if (this.alive <= 0) { this.alive = 0; if (this.mesh.visible) this.mesh.visible = false; return; }
    let alive = 0; const P = this.p, V = this.v, out = this.pa.array;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      const o = i * 3, k = this.kind[i];
      this.life[i] -= dt;
      if (this.life[i] <= 0) { out[o + 1] = -1000; continue; }
      alive++;
      if (k === 2) { this.ph[i] += dt * 3; V[o] += Math.sin(this.ph[i]) * 1.6 * dt; V[o + 2] += Math.cos(this.ph[i] * 0.8) * 1.6 * dt; V[o + 1] -= 2.0 * dt; const d = Math.exp(-2.2 * dt); V[o] *= d; V[o + 1] *= d; V[o + 2] *= d; }
      else { V[o + 1] -= (k === 1 ? 9.8 : 9.8) * dt; if (k === 1) { const d = Math.exp(-0.6 * dt); V[o] *= d; V[o + 2] *= d; } }
      P[o] += V[o] * dt; P[o + 1] += V[o + 1] * dt; P[o + 2] += V[o + 2] * dt;
      const gy = ground(P[o], P[o + 2]) + 0.02;
      if (P[o + 1] < gy) {
        P[o + 1] = gy;
        if (k === 0 || k === 3) this.life[i] = Math.min(this.life[i], 0.05);
        else { V[o + 1] = k === 1 && V[o + 1] < -2 ? -V[o + 1] * 0.25 : 0; const f = Math.exp(-(k === 1 ? 6 : 12) * dt); V[o] *= f; V[o + 2] *= f; }
      }
      out[o] = P[o]; out[o + 1] = P[o + 1]; out[o + 2] = P[o + 2];
    }
    this.alive = alive;
    this.pa.needsUpdate = true;
    this.mesh.visible = alive > 0;
  }
}
