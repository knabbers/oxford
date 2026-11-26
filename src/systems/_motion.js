// One shared neighbour index for everything that moves outdoors (2026-11 motion pass): AI cars / buses / cyclists
// (systems/traffic.js), live vehicles (the player's, abandoned or shunted ones, police cars: systems/vehicles.js), walkers
// (systems/pedestrians.js), the player on foot and the other players. Rebuilt ONCE a frame by traffic.update() (before its
// agents drive; walkers read the previous frame's copy, ~1 frame old), true footprints (a capsule per vehicle: centre,
// heading, half segment length, radius; a circle per person). Flat typed arrays + a cell -> index list hash that is
// reused frame to frame: nothing is allocated per frame once warm. Pure (no THREE): node-testable.
//
//   grid.query(x, z, r, fn(i))   every entry whose cell lies within r (boxes; fn(i) gets the index; return true to stop)
//   grid.X[i] Z[i] FX[i] FZ[i]   centre, unit heading      HALF[i] R[i]  capsule half-length, radius
//   grid.V[i]                    speed along the heading   K[i] kind (K_* below)       ref[i] the object
//   grid.ROAD[i]                 people: on a carriageway this frame (vehicles: always 1)
export const K_CAR = 1, K_BUS = 2, K_BIKE = 3, K_PVEH = 4, K_LIVE = 5, K_PED = 6, K_PLAYER = 7, K_REMOTE = 8;
/** the bus network (by street name; plus every main road): traffic.js routes buses on it, vehicles.js leaves room beside
 *  its kerbside bays for a bus's mirrors */
export const BUS_NAMES = new Set(["St Giles'", 'Beaumont Street', 'Walton Street', 'High Street', "St Aldate's", 'Park End Street', 'Botley Road',
  'George Street', 'Magdalen Street', 'Worcester Street', 'Hythe Bridge Street', 'Frideswide Square', 'Banbury Road', 'Woodstock Road',
  'Longwall Street', 'Speedwell Street', 'Thames Street', 'Oxpens Road', 'Abingdon Road', 'Cowley Place', 'The Plain', 'Iffley Road']);
const CELL = 8, MAXN = 1024, MAXS = 4096, BUCKETS = 1024;

export class MotionGrid {
  constructor() {
    this.n = 0;
    this.X = new Float32Array(MAXN); this.Z = new Float32Array(MAXN); this.FX = new Float32Array(MAXN); this.FZ = new Float32Array(MAXN);
    this.HALF = new Float32Array(MAXN); this.R = new Float32Array(MAXN); this.V = new Float32Array(MAXN); this.K = new Uint8Array(MAXN);
    this.ROAD = new Uint8Array(MAXN);  // people: 1 = standing on a carriageway (set by the builder, once a frame)
    this.ref = new Array(MAXN).fill(null);
    // spatial hash in flat typed arrays (no Map, no arrays per cell): HEAD[bucket] -> first slot, slots chained by NEXT;
    // each slot is one (entry, cell) pair, the cell kept so a bucket shared by two cells is told apart
    this.HEAD = new Int32Array(BUCKETS).fill(-1);
    this.NEXT = new Int32Array(MAXS); this.SE = new Int32Array(MAXS); this.SX = new Int32Array(MAXS); this.SZ = new Int32Array(MAXS);
    this.ns = 0;
    this.usedB = new Int32Array(MAXS); this.nb = 0;   // buckets touched this frame (cleared next frame)
    this.seen = new Uint32Array(MAXN); this.stamp = 0;
    this.frame = 0;
  }
  clear() {
    for (let i = 0; i < this.nb; i++) this.HEAD[this.usedB[i]] = -1;
    this.nb = 0; this.ns = 0;
    for (let i = 0; i < this.n; i++) this.ref[i] = null;
    this.n = 0; this.frame++;
  }
  /** add one footprint; returns its index (or -1 when full) */
  add(ref, kind, x, z, h, half, r, v) {
    if (this.n >= MAXN || !(x === x) || !(z === z)) return -1;
    const i = this.n++;
    this.ROAD[i] = 1; this.X[i] = x; this.Z[i] = z; this.FX[i] = Math.sin(h); this.FZ[i] = Math.cos(h); this.HALF[i] = half; this.R[i] = r; this.V[i] = v; this.K[i] = kind; this.ref[i] = ref;
    const e = half + r, x0 = Math.floor((x - e) / CELL), x1 = Math.floor((x + e) / CELL), z0 = Math.floor((z - e) / CELL), z1 = Math.floor((z + e) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0, hx = Math.imul(cx, 73856093); cz <= z1; cz++) {
      if (this.ns >= MAXS) return i;
      const b = (hx ^ Math.imul(cz, 19349663)) & (BUCKETS - 1), sl = this.ns++;
      if (this.HEAD[b] === -1) this.usedB[this.nb++] = b;
      this.SE[sl] = i; this.SX[sl] = cx; this.SZ[sl] = cz; this.NEXT[sl] = this.HEAD[b]; this.HEAD[b] = sl;
    }
    return i;
  }
  /** indices of the entries in the cells overlapping the box (x±r, z±r) into out (an Int32Array); returns the count */
  gather(x, z, r, out) { return this.gatherBox(x - r, z - r, x + r, z + r, out); }
  /** the same for the box [minX, maxX] x [minZ, maxZ]; each entry once */
  gatherBox(minX, minZ, maxX, maxZ, out) {
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL), z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL), st = ++this.stamp, cap = out.length;
    const HEAD = this.HEAD, NEXT = this.NEXT, SE = this.SE, SX = this.SX, SZ = this.SZ, seen = this.seen;
    let n = 0;
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0, hx = Math.imul(cx, 73856093); cz <= z1; cz++) {
      // (the cell hash in 32-bit integer arithmetic, its column part once per column: the same buckets as the plain
      // product XORed, which went through doubles - the 2026-11 CPU pass)
      for (let sl = HEAD[(hx ^ Math.imul(cz, 19349663)) & (BUCKETS - 1)]; sl !== -1; sl = NEXT[sl]) {
        if (SX[sl] !== cx || SZ[sl] !== cz) continue;
        const i = SE[sl]; if (seen[i] === st) continue; seen[i] = st;
        if (n < cap) out[n++] = i;
      }
    }
    return n;
  }
  /** fn(i) for each entry in the cells overlapping the box (x±r, z±r), once each; return true to stop */
  query(x, z, r, fn) {
    const n = this.gatherBox(x - r, z - r, x + r, z + r, this._q || (this._q = new Int32Array(MAXN)));
    for (let j = 0; j < n; j++) if (fn(this._q[j]) === true) return;
  }
}
export const MAX_MOVERS = MAXN;

/** closest distance between capsule i of grid G and a capsule (x, z, fx, fz, half) — used by the walkers' push-out */
export function capsulePoint(G, i, px, pz, out) {
  const fx = G.FX[i], fz = G.FZ[i], h = G.HALF[i];
  let u = (px - G.X[i]) * fx + (pz - G.Z[i]) * fz; u = u < -h ? -h : u > h ? h : u;
  out.x = G.X[i] + fx * u; out.z = G.Z[i] + fz * u;
  return Math.hypot(px - out.x, pz - out.z);
}
