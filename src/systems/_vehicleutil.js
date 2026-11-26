// Shared helpers for vehicles.js / traffic.js (underscore: not auto-loaded).
import { pointInPoly } from '../core/collision.js';

/**
 * Grid-accelerated water test with exactly the semantics of Collider.isWater (water polygons with holes + river/canal
 * capsules). The core collider scans every waterline segment linearly (~1500 of them), too slow for per-frame hull tests.
 * Built from the collider's own (public) `water` / `waterLines` arrays, so it agrees with it by construction.
 */
export class WaterIndex {
  constructor(collider, cell = 24) {
    this.col = collider; this.cell = cell; this.g = new Map();
    for (const l of collider.waterLines || []) this._ins(l, Math.min(l.x1, l.x2) - l.r, Math.min(l.z1, l.z2) - l.r, Math.max(l.x1, l.x2) + l.r, Math.max(l.z1, l.z2) + l.r);
    for (const w of collider.water || []) this._ins(w, w.minX, w.minZ, w.maxX, w.maxZ);
  }
  _ins(e, x0, z0, x1, z1) {
    const c = this.cell;
    for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++) for (let cz = Math.floor(z0 / c); cz <= Math.floor(z1 / c); cz++) {
      const k = cx * 65536 + cz; let a = this.g.get(k); if (!a) this.g.set(k, (a = [])); a.push(e);
    }
  }
  isWater(x, z) {
    const a = this.g.get(Math.floor(x / this.cell) * 65536 + Math.floor(z / this.cell));
    if (!a) return false;
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.poly) {
        if (x < e.minX || x > e.maxX || z < e.minZ || z > e.maxZ || !pointInPoly(x, z, e.poly)) continue;
        let hole = false; for (const h of e.holes) if (pointInPoly(x, z, h)) { hole = true; break; }
        if (!hole) return true;
      } else {
        const dx = e.x2 - e.x1, dz = e.z2 - e.z1, l2 = dx * dx + dz * dz;
        let t = l2 ? ((x - e.x1) * dx + (z - e.z1) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ox = x - e.x1 - dx * t, oz = z - e.z1 - dz * t;
        if (ox * ox + oz * oz < e.r * e.r) return true;
      }
    }
    return false;
  }
  /** water and not on a bridge (Collider.isWet) */
  isWet(x, z) { return this.isWater(x, z) && !this.col.onBridge(x, z); }
}
