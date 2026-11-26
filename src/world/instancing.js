// Distance-refilled instancing: thousands of static items (trees, lamps, benches…) kept in a flat array; InstancedMeshes
// are refilled only with the items near the camera when it has moved far enough. No per-frame allocation.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

export class InstanceSet {
  /**
   * bands: [{ meshes: [{geometry, material, castShadow}], maxDist }]   nearest band first (e.g. near/far LOD)
   * capacity: max instances per band mesh
   */
  constructor(scene, name, bands, capacity) {
    this.name = name; this.n = 0; this.cap0 = 256;
    this.mat = new Float32Array(this.cap0 * 16); this.col = new Float32Array(this.cap0 * 3); this.xz = new Float32Array(this.cap0 * 2);
    this.bands = bands.map((b) => ({
      maxDist: b.maxDist,
      meshes: b.meshes.map((d) => {
        const m = new THREE.InstancedMesh(d.geometry, d.material, capacity);
        m.name = 'world:' + name; m.castShadow = !!d.castShadow; m.receiveShadow = d.receiveShadow !== false;
        m.count = 0; m.matrixAutoUpdate = false; m.updateMatrix();
        m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (d.colors !== false) { m.setColorAt(0, _c.setRGB(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
        scene.add(m);
        return m;
      }),
    }));
    this.capacity = capacity;
    this.lastX = 1e9; this.lastZ = 1e9;
  }
  _grow() {
    const c = this.mat.length / 16 * 2;
    const m = new Float32Array(c * 16); m.set(this.mat); this.mat = m;
    const k = new Float32Array(c * 3); k.set(this.col); this.col = k;
    const x = new Float32Array(c * 2); x.set(this.xz); this.xz = x;
  }
  /** Add an item at (x,y,z) with yaw, scale (number or [sx,sy,sz]) and colour (THREE.Color|hex|null); lean = [rx, rz]
   *  (radians, about the item's foot: the roughness pass's posts that are not quite plumb). */
  add(x, y, z, yaw = 0, scale = 1, color = null, lean = null) {
    if (this.n * 16 >= this.mat.length) this._grow();
    _p.set(x, y, z); _q.setFromEuler(lean ? _e.set(lean[0], yaw, lean[1]) : _e.set(0, yaw, 0));
    if (Array.isArray(scale)) _s.set(scale[0], scale[1], scale[2]); else _s.set(scale, scale, scale);
    _m.compose(_p, _q, _s); _m.toArray(this.mat, this.n * 16);
    if (color === null || color === undefined) _c.setRGB(1, 1, 1); else if (color.isColor) _c.copy(color); else _c.set(color);
    this.col[this.n * 3] = _c.r; this.col[this.n * 3 + 1] = _c.g; this.col[this.n * 3 + 2] = _c.b;
    this.xz[this.n * 2] = x; this.xz[this.n * 2 + 1] = z;
    return this.n++;
  }
  /** Refill meshes around (cx,cz). Returns true if refilled. */
  refresh(cx, cz, force = false, moveThreshold = 12) {
    const dx0 = cx - this.lastX, dz0 = cz - this.lastZ;
    if (!force && dx0 * dx0 + dz0 * dz0 < moveThreshold * moveThreshold) return false;
    this.lastX = cx; this.lastZ = cz;
    const B = this.bands, nb = B.length, counts = this._counts || (this._counts = new Int32Array(nb));
    counts.fill(0);
    const lim = this._lim || (this._lim = new Float32Array(nb));
    for (let b = 0; b < nb; b++) lim[b] = B[b].maxDist * B[b].maxDist;
    const cap = this.capacity, M = this.mat, C = this.col, XZ = this.xz;
    // `gate` {x, d}: items east of x (the East Oxford extension) are left out while the camera is more than d m west of
    // x — so a view from the original city instances exactly what it did before the map grew
    const gx = this.gate && cx < this.gate.x - this.gate.d ? this.gate.x : Infinity;
    for (let i = 0; i < this.n; i++) {
      if (XZ[i * 2] >= gx) continue;
      const dx = XZ[i * 2] - cx, dz = XZ[i * 2 + 1] - cz, d2 = dx * dx + dz * dz;
      let b = 0; while (b < nb && d2 > lim[b]) b++;
      if (b === nb) continue;
      const slot = counts[b]; if (slot >= cap) continue;
      counts[b] = slot + 1;
      const ms = B[b].meshes;
      for (let k = 0; k < ms.length; k++) {
        const arr = ms[k].instanceMatrix.array, o = slot * 16, s = i * 16;
        for (let j = 0; j < 16; j++) arr[o + j] = M[s + j];
        if (ms[k].instanceColor) { const ca = ms[k].instanceColor.array; ca[slot * 3] = C[i * 3]; ca[slot * 3 + 1] = C[i * 3 + 1]; ca[slot * 3 + 2] = C[i * 3 + 2]; }
      }
    }
    for (let b = 0; b < nb; b++) for (const m of B[b].meshes) {
      m.count = counts[b];
      const im = m.instanceMatrix;
      if (im.clearUpdateRanges) { im.clearUpdateRanges(); im.addUpdateRange(0, Math.max(1, counts[b]) * 16); }
      im.needsUpdate = true;
      if (m.instanceColor) { const ic = m.instanceColor; if (ic.clearUpdateRanges) { ic.clearUpdateRanges(); ic.addUpdateRange(0, Math.max(1, counts[b]) * 3); } ic.needsUpdate = true; }
      m.boundingSphere.center.set(cx, 10, cz); m.boundingSphere.radius = B[b].maxDist + 40;
      m.visible = counts[b] > 0;
    }
    return true;
  }
  /** Permanently drop items for which fn(x, z) is true (they are moved out of range). Returns how many. */
  removeWhere(fn) {
    let k = 0;
    for (let i = 0; i < this.n; i++) if (fn(this.xz[i * 2], this.xz[i * 2 + 1])) { this.xz[i * 2] = 1e9; this.xz[i * 2 + 1] = 1e9; k++; }
    if (k) this.lastX = 1e9;
    return k;
  }
  get meshes() { return this.bands.flatMap((b) => b.meshes); }
}
