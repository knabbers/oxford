// 2D collision on the ground plane (x,z in metres). One Collider per "place" (the outdoor world, or an interior).
// Static geometry is line segments + circles in a spatial hash; movers are circles pushed out of them.

const CELL = 8;
const SOFT = { hedge: 1, fence: 1, railing: 1, net: 1, rope: 1, goal: 1, tree: 1, car: 1, vehicle: 1, van: 1 }, HARD = { wall: 1, city_wall: 1, gate: 1 };      // (soundWalls)
const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;

export function pointInPoly(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

function distToSeg(x, z, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((x - x1) * dx + (z - z1) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = x1 + dx * t, pz = z1 + dz * t;
  return Math.hypot(x - px, z - pz);
}

export class Collider {
  constructor() {
    this.grid = new Map();      // cell -> array of shapes
    this.pgrid = new Map();     // cell -> passages overlapping it
    this.passages = [];         // capsules where static shapes are ignored (archways, gates, doorways)
    this.water = [];            // {poly, holes, minX,maxX,minZ,maxZ}
    this.waterLines = [];       // {x1,z1,x2,z2,r}
    this.walkable = [];         // capsules / polys over water that can be walked on (bridges, piers)
    this.wgrid = new Map();     // 16 m cells -> water polys / lines / walkables touching them
    this.bounds = null;         // {minX,maxX,minZ,maxZ} hard limit
    this._stamp = 0;
    this.lastHit = null;
  }

  _insert(shape, minX, minZ, maxX, maxZ) {
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const k = key(cx, cz);
        let a = this.grid.get(k);
        if (!a) this.grid.set(k, (a = []));
        a.push(shape);
      }
    }
    return shape;
  }

  /** Solid wall segment. opts.tag is free-form (e.g. 'building', 'wall'); opts.low = true means vehicles/cameras ignore it.
   *  opts.top (m above the ground, optional): something you can stand on (a low wall, a parked car): resolve() with
   *  opts.y at or above it lets a mover pass over it, and topAt() reports it as a floor. opts.h: how tall it is, if known. */
  addSegment(x1, z1, x2, z2, opts = {}) {
    const s = { seg: true, x1, z1, x2, z2, tag: opts.tag || '', low: !!opts.low, on: true, m: 0 };
    if (opts.top > 0) s.top = opts.top;
    if (opts.h > 0) s.h = opts.h;          // (a wall's height, when known: the chase camera lifts over it only from above)
    return this._insert(s, Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2));
  }

  /** Closed ring [[x,z],...] -> wall segments. Returns the array of segments (set .on=false to disable). */
  addPolygon(poly, opts = {}) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      out.push(this.addSegment(a[0], a[1], b[0], b[1], opts));
    }
    return out;
  }

  /** Open polyline -> wall segments. */
  addPolyline(pts, opts = {}) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) out.push(this.addSegment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], opts));
    return out;
  }

  /** Axis-aligned or rotated box (centre, size, rotation about Y) -> 4 wall segments. */
  addBox(cx, cz, w, d, rot = 0, opts = {}) {
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
    const p = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
    return this.addPolygon(p, opts);
  }

  /** Solid circle (tree trunk, pillar, table). opts.floor (with opts.top): only a floor to stand on, never a wall — a
   *  footbridge's deck, whose height above the ground under it changes by a kerb's height (resolve() used to shove a
   *  walker whose feet dipped 3 cm under it out across the railing, and down they fell). */
  addCircle(x, z, r, opts = {}) {
    const s = { seg: false, x, z, r, tag: opts.tag || '', low: !!opts.low, on: true, m: 0 };
    if (opts.top > 0) s.top = opts.top;
    if (opts.floor && s.top) s.floor = true;
    return this._insert(s, x - r, z - r, x + r, z + r);
  }

  /** Capsule region in which static shapes are ignored, so you can walk through a wall/building there. */
  addPassage(x1, z1, x2, z2, width) {
    const p = { x1, z1, x2, z2, r: width / 2, on: true };
    this.passages.push(p);
    const r = p.r;
    for (let cx = Math.floor((Math.min(x1, x2) - r) / CELL); cx <= Math.floor((Math.max(x1, x2) + r) / CELL); cx++) {
      for (let cz = Math.floor((Math.min(z1, z2) - r) / CELL); cz <= Math.floor((Math.max(z1, z2) + r) / CELL); cz++) {
        const k = key(cx, cz);
        let a = this.pgrid.get(k);
        if (!a) this.pgrid.set(k, (a = []));
        a.push(p);
      }
    }
    return p;
  }

  inPassage(x, z) {
    const a = this.pgrid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (a) for (const p of a) if (p.on && distToSeg(x, z, p.x1, p.z1, p.x2, p.z2) < p.r) return true;
    return false;
  }

  addWater(poly, holes = []) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    const w = { poly, holes, minX, maxX, minZ, maxZ };
    this.water.push(w);
    this._windex(w, 'p', minX, minZ, maxX, maxZ);
  }

  _windex(item, kind, minX, minZ, maxX, maxZ) {
    for (let cx = Math.floor(minX / 16); cx <= Math.floor(maxX / 16); cx++) {
      for (let cz = Math.floor(minZ / 16); cz <= Math.floor(maxZ / 16); cz++) {
        const k = key(cx, cz);
        let c = this.wgrid.get(k);
        if (!c) this.wgrid.set(k, (c = { p: [], l: [], b: [] }));
        c[kind].push(item);
      }
    }
  }
  _wseg(l, kind) { this._windex(l, kind, Math.min(l.x1, l.x2) - l.r, Math.min(l.z1, l.z2) - l.r, Math.max(l.x1, l.x2) + l.r, Math.max(l.z1, l.z2) + l.r); }

  addWaterLine(pts, width) {
    for (let i = 0; i < pts.length - 1; i++) {
      const l = { x1: pts[i][0], z1: pts[i][1], x2: pts[i + 1][0], z2: pts[i + 1][1], r: width / 2 };
      this.waterLines.push(l); this._wseg(l, 'l');
    }
  }

  /** Bridge / pier: a capsule (polyline + width) or polygon over water that counts as ground. */
  addWalkable(ptsOrPoly, width) {
    if (width) {
      for (let i = 0; i < ptsOrPoly.length - 1; i++) {
        const l = { x1: ptsOrPoly[i][0], z1: ptsOrPoly[i][1], x2: ptsOrPoly[i + 1][0], z2: ptsOrPoly[i + 1][1], r: width / 2 };
        this.walkable.push(l); this._wseg(l, 'b');
      }
    } else {
      const w = { poly: ptsOrPoly };
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of ptsOrPoly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      this.walkable.push(w); this._windex(w, 'b', minX, minZ, maxX, maxZ);
    }
  }

  /** True if (x,z) is open water (ignores bridges). */
  isWater(x, z) {
    const c = this.wgrid.get(key(Math.floor(x / 16), Math.floor(z / 16)));
    if (!c) return false;
    for (const w of c.p) {
      if (x < w.minX || x > w.maxX || z < w.minZ || z > w.maxZ) continue;
      if (!pointInPoly(x, z, w.poly)) continue;
      let hole = false;
      for (const h of w.holes) if (pointInPoly(x, z, h)) { hole = true; break; }
      if (!hole) return true;
    }
    for (const l of c.l) if (distToSeg(x, z, l.x1, l.z1, l.x2, l.z2) < l.r) return true;
    return false;
  }

  onBridge(x, z) {
    const c = this.wgrid.get(key(Math.floor(x / 16), Math.floor(z / 16)));
    if (!c) return false;
    for (const w of c.b) {
      if (w.poly ? pointInPoly(x, z, w.poly) : distToSeg(x, z, w.x1, w.z1, w.x2, w.z2) < w.r) return true;
    }
    return false;
  }

  /** True if somebody on foot / on wheels would be in the drink here. */
  isWet(x, z) { return this.isWater(x, z) && !this.onBridge(x, z); }

  _near(minX, minZ, maxX, maxZ, fn) {
    const stamp = ++this._stamp;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const a = this.grid.get(key(cx, cz));
        if (!a) continue;
        for (const s of a) { if (s.m === stamp || !s.on) continue; s.m = stamp; fn(s); }
      }
    }
  }

  /**
   * Push a circle out of solid geometry. Mutates pos {x,z}. Returns true if it touched anything.
   * opts.ignoreLow: skip shapes flagged low (kerbs, low fences).  opts.ignorePassages: treat passages as solid.
   * opts.y: height of the mover's feet above the ground: shapes with a `top` at or below it are passed over.
   */
  resolve(pos, radius, opts = {}) {
    let hit = false; this.lastHit = null;      // (lastHit: the last shape that pushed the mover — its tag tells systems/_crash_audio.js what was hit)
    const free = !opts.ignorePassages && this.passages.length && this.inPassage(pos.x, pos.z);
    const fy = opts.y;
    // (in a passage — a doorway — the walls are not there, but a door's own leaf still is: core/interiors.js tags it 'door')
    if (!free || this.hasDoors) {
      for (let iter = 0; iter < 3; iter++) {
        let moved = false;
        this._near(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, (s) => {
          if (free && (s.tag !== 'door' || s.wide)) return;      // (a leaf standing wide open lies beside the doorway: as before)
          if (opts.ignoreLow && s.low) return;
          if (s.floor) return;
          if (fy !== undefined && s.top !== undefined && fy >= s.top - 0.03) return;
          let px, pz;
          if (s.seg) {
            const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
            const l2 = dx * dx + dz * dz;
            let t = l2 ? ((pos.x - s.x1) * dx + (pos.z - s.z1) * dz) / l2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            px = s.x1 + dx * t; pz = s.z1 + dz * t;
          } else { px = s.x; pz = s.z; }
          const r = radius + (s.seg ? 0 : s.r);
          let ox = pos.x - px, oz = pos.z - pz;
          const d2 = ox * ox + oz * oz;
          if (d2 >= r * r) return;
          let d = Math.sqrt(d2);
          if (d < 1e-5) { ox = 1; oz = 0; d = 1; }
          const push = r - d;
          pos.x += (ox / d) * push; pos.z += (oz / d) * push;
          moved = hit = true; this.lastHit = s;
        });
        if (!moved) break;
      }
    }
    if (this.bounds) {
      let b = this.bounds;
      if (b.boxes) {
        // union of rectangles: inside any -> free; otherwise clamp into the nearest one
        let best = null, bd = Infinity;
        for (let i = 0; i < b.boxes.length; i++) {
          const q = b.boxes[i], dx = Math.max(q.minX - pos.x, 0, pos.x - q.maxX), dz = Math.max(q.minZ - pos.z, 0, pos.z - q.maxZ), d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = q; }
        }
        b = best;
      }
      if (pos.x < b.minX) { pos.x = b.minX; hit = true; } else if (pos.x > b.maxX) { pos.x = b.maxX; hit = true; }
      if (pos.z < b.minZ) { pos.z = b.minZ; hit = true; } else if (pos.z > b.maxZ) { pos.z = b.maxZ; hit = true; }
    }
    return hit;
  }

  /** Is the view along (x1,z1)->(x2,z2) shut off by something a person cannot be seen over: a building's wall, or a wall
   *  known to stand 3 m or more (plan view; kerbs, railings, low walls, street furniture and parked cars do not count)?
   *  For "may somebody come or go here unseen" (pedestrians._unseen): cheap, nothing allocated but the closure. */
  sightBlocked(x1, z1, x2, z2) {
    let hit = false;
    const dx = x2 - x1, dz = z2 - z1;
    this._near(Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2), (s) => {
      if (hit || !s.seg || s.low || s.on === false || !(s.tag === 'building' || s.h >= 3)) return;
      const ex = s.x2 - s.x1, ez = s.z2 - s.z1, den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) return;
      const t = ((s.x1 - x1) * ez - (s.z1 - z1) * ex) / den, u = ((s.x1 - x1) * dz - (s.z1 - z1) * dx) / den;
      if (t > 0.01 && t < 0.99 && u >= 0 && u <= 1) hit = true;
    });
    return hit;
  }

  /** How many walls that stop SOUND does the line (x1,z1)->(x2,z2) cross: 0..max (it stops counting at max)? A wall
   *  counts when it is a building's, or known to stand 2.2 m or more (`h`, or `sh`: the map's height of a barrier), or
   *  tagged 'wall' / 'city_wall' / 'gate' with no height known and nothing to stand on (not kerbs, railings, low walls,
   *  furniture, parked cars; never hedges, fences, nets: SOFT). passages: a crossing
   *  inside an open passage (an archway, an open doorway) does not count. skipA / skipB: metres at the first / second
   *  end within which a crossing is ignored (a door's own sound comes from IN the wall). Only the grid cells the line
   *  passes through are looked at (raycast and sightBlocked look at its whole bounding box): core/_occlusion.js asks
   *  this many times a frame. Nothing is allocated. */
  soundWalls(x1, z1, x2, z2, max = 2, passages = true, skipA = 0.05, skipB = 0.05) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    if (!(len > 1e-6) || !isFinite(len)) return 0;
    const t0 = skipA / len, t1 = 1 - skipB / len;
    if (!(t1 > t0)) return 0;
    const stamp = ++this._stamp, usePass = passages && this.passages.length > 0;
    let n = 0, cx = Math.floor(x1 / CELL), cz = Math.floor(z1 / CELL);
    const ex = Math.floor(x2 / CELL), ez = Math.floor(z2 / CELL), sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? CELL / Math.abs(dx) : Infinity, tdz = dz !== 0 ? CELL / Math.abs(dz) : Infinity;
    let tx = dx !== 0 ? (dx > 0 ? (cx + 1) * CELL - x1 : x1 - cx * CELL) / Math.abs(dx) : Infinity;
    let tz = dz !== 0 ? (dz > 0 ? (cz + 1) * CELL - z1 : z1 - cz * CELL) / Math.abs(dz) : Infinity;
    for (let guard = 0; guard < 600; guard++) {
      const a = this.grid.get(key(cx, cz));
      if (a) for (let i = 0; i < a.length; i++) {
        const s = a[i];
        if (s.m === stamp) continue; s.m = stamp;
        if (!s.seg || s.low || s.on === false) continue;
        if (s.tag !== 'building') { const hh = s.h ?? s.sh; if (SOFT[s.tag] || !(hh >= 2.2 || (hh === undefined && s.top === undefined && HARD[s.tag]))) continue; }
        const sex = s.x2 - s.x1, sez = s.z2 - s.z1, den = dx * sez - dz * sex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((s.x1 - x1) * sez - (s.z1 - z1) * sex) / den, u = ((s.x1 - x1) * dz - (s.z1 - z1) * dx) / den;
        if (!(t > t0 && t < t1 && u >= 0 && u < 1)) continue;      // (u < 1: a line through the corner two walls share is one crossing)
        if (usePass && this.inPassage(x1 + dx * t, z1 + dz * t)) continue;
        if (++n >= max) return n;
      }
      if (cx === ex && cz === ez) break;
      if (tx < tz) { tx += tdx; cx += sx; } else { tz += tdz; cz += sz; }
    }
    return n;
  }

  /** First hit along the segment (x1,z1)->(x2,z2) against wall segments: returns t in [0,1] or null. */
  /** nearest wall hit along the segment -> t in 0..1 or null. opts.hit.s = the segment; opts.passages: a hit inside an open passage (doorway) does not count */
  raycast(x1, z1, x2, z2, opts = {}) {
    let best = null, bestS = null;
    const dx = x2 - x1, dz = z2 - z1;
    this._near(Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2), (s) => {
      if (!s.seg || (opts.ignoreLow !== false && s.low)) return;
      const ex = s.x2 - s.x1, ez = s.z2 - s.z1;
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) return;
      const t = ((s.x1 - x1) * ez - (s.z1 - z1) * ex) / den;
      const u = ((s.x1 - x1) * dz - (s.z1 - z1) * dx) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best === null || t < best)) {
        if (opts.passages && this.passages.length && this.inPassage(x1 + dx * t, z1 + dz * t)) return;      // (through an open doorway / archway)
        best = t; bestS = s;
      }
    });
    if (opts.hit) opts.hit.s = bestS;      // (the segment hit: core/game.js reads a building wall's height, s.h)
    return best;
  }

  /**
   * Highest standable `top` (see addSegment) within `radius` of (x, z) that is no more than `reach` above feet height y
   * (above the ground), or -1. A low wall's top is a floor while you are over it.
   */
  topAt(x, z, radius, y, reach = 0.05) {
    let best = -1;
    this._near(x - radius, z - radius, x + radius, z + radius, (s) => {
      if (s.top === undefined || s.top > y + reach || s.top <= best) return;
      let d;
      if (s.seg) d = distToSeg(x, z, s.x1, s.z1, s.x2, s.z2); else d = Math.hypot(x - s.x, z - s.z) - s.r;
      if (d < radius) best = s.top;
    });
    return best;
  }

  /** Is a circle at (x,z) free of solid geometry? */
  isFree(x, z, radius) {
    const p = { x, z };
    return !this.resolve(p, radius);
  }
}
