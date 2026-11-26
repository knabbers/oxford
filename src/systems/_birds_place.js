// Birds — where a bird may land (systems/birds.js; checked by tools/smoke_birds.mjs). Pure functions of the shared
// map, the collider and what the world drew; no three.
// A landing spot is one of:
//   ground  open ground: free of every collider (walls, trunks, parked cars, street items), outside EVERY mapped
//           footprint (Collider.isFree is true in the middle of a building, so the footprints are tested themselves:
//           canopies, raised volumes and hand-built ones too), clear of the drawn face of a wall / hedge / fence
//           (_clearance.js barrierGap), dry, not on a bridge or under an archway, off every carriageway (the map's
//           drivable roads at their drawn width, service roads 3.5 m+, and every AI lane wherever it runs), clear of
//           the furniture that has no collider (benches, bike stands, parked bikes...), not in a mapped car park or
//           parking bay (Broad Street's centre), and not shut in on all sides
//   water   open water a metre clear of the bank, not under a bridge — water birds only
//   wall    the top of a stone / brick wall or the top of a hedge as DRAWN (world.barrierPlan: the pieces between the
//           gateways with their real heights), off the piece's ends, not where it runs into a building
//   bench   the top rail of a mapped bench's back (world/furniture.js: 0.905 m above its foot)
//   roof    the edge of a flat roof as drawn (the building's own record: its wall top, on the parapet where it has one),
//           low enough to be seen from the street, not an edge a taller neighbour stands against
// flightClear() is the same footprints with their heights: a bird flying in or out never passes through a building.
import { pointInPoly } from '../core/collision.js';
import { barrierGap, BARRIER_HALF } from './_clearance.js';

const CARRIAGE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
const FURN = { bench: [0.36, 0.6], bin: [0.3, 0], postBox: [0.32, 0], busStop: [0.1, 0], shelter: [0.8, 1.2], stand: [0.18, 0.25], phone: [0.55, 0], signal: [0.12, 0], bollard: [0.12, 0], belisha: [0.1, 0], picnic: [1.0, 0], lampPost: [0.15, 0] };
const dseg = (x, z, x1, z1, x2, z2) => { const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz; let t = l2 ? ((x - x1) * dx + (z - z1) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - x1 - dx * t, z - z1 - dz * t); };
const key = (cx, cz) => (cx + 4096) * 8192 + cz + 4096;

export class Spots {
  /** heightOf(b): a building's top (m) */
  constructor(game, heightOf) {
    this.game = game; this.col = game.worldCollider; this.ready = false;
    const map = game.map;
    // ---- every mapped footprint, with its height (32 m cells)
    this.bcell = new Map();
    for (const b of map.buildings || []) {
      if (!b.poly || b.poly.length < 3) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of b.poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
      const e = { poly: b.poly, holes: b.part ? null : b.holes || null, x0, x1, z0, z1, top: Math.max(3, heightOf(b) || 8), id: b.id };
      for (let i = Math.floor((x0 - 1) / 32); i <= Math.floor((x1 + 1) / 32); i++) for (let j = Math.floor((z0 - 1) / 32); j <= Math.floor((z1 + 1) / 32); j++) { const k = key(i, j); let a = this.bcell.get(k); if (!a) this.bcell.set(k, (a = [])); a.push(e); }
    }
    // ---- carriageways as drawn (20 m cells)
    this.rcell = new Map();
    for (const r of map.roads || []) {
      if (!r.pts || r.pts.length < 2) continue;
      if (!CARRIAGE.has(r.kind) && !(r.kind === 'service' && (r.w || 0) >= 3.5)) continue;
      if ((r.tunnel && r.tunnel !== 'building_passage') || r.covered || (r.layer && +r.layer < 0 && !r.bridge)) continue;
      const hw = (r.w || 6.5) / 2;
      for (let i = 0; i < r.pts.length - 1; i++) this._seg(this.rcell, 20, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1], hw);
    }
    // ---- car parks and parking bays (Broad Street's centre): tarmac that reads as road, cars come and go
    this.pcell = new Map();
    for (const a of map.areas || []) {
      if (a.kind !== 'parking' || !a.poly || a.poly.length < 3) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of a.poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
      const e = { poly: a.poly, x0, x1, z0, z1 };
      for (let i = Math.floor(x0 / 32); i <= Math.floor(x1 / 32); i++) for (let j = Math.floor(z0 / 32); j <= Math.floor(z1 / 32); j++) { const k = key(i, j); let l = this.pcell.get(k); if (!l) this.pcell.set(k, (l = [])); l.push(e); }
    }
    this.boxes = (game.worldCollider.bounds && (game.worldCollider.bounds.boxes || [game.worldCollider.bounds])) || map.boxes || [map.bounds];
    this.fcell = new Map(); this.wcell = new Map(); this.walls = [];
    this._c = [];
  }
  _seg(grid, C, x1, z1, x2, z2, hw) {
    const s = [x1, z1, x2, z2, hw], p = hw + 1.5;
    for (let i = Math.floor((Math.min(x1, x2) - p) / C); i <= Math.floor((Math.max(x1, x2) + p) / C); i++) for (let j = Math.floor((Math.min(z1, z2) - p) / C); j <= Math.floor((Math.max(z1, z2) + p) / C); j++) { const k = key(i, j); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(s); }
  }

  /** the late part (once the streetscape, the traffic's lanes and the parked bikes exist): AI lanes, furniture, drawn walls */
  build() {
    if (this.ready) return true;
    const g = this.game, SS = g.streetscape;
    if (SS && SS.ready === false && (this._waits = (this._waits || 0) + 1) < 40) return false;
    this.ready = true;
    // AI lanes (cars and cyclists), wherever they run
    const T = g.traffic;
    try {
      if (T && T.graph && T.lanePos) {
        const o = { x: 0, z: 0, dx: 0, dz: 0 };
        for (const l of T.graph.lanes) {
          const st = Math.max(1, Math.min(4, l.len / 3)); let px = null, pz = 0;
          for (let s = 0; s <= l.len + 1e-6; s += st) { T.lanePos(l, Math.min(s, l.len), l.off, o); if (px !== null) this._seg(this.rcell, 20, px, pz, o.x, o.z, 1.3); px = o.x; pz = o.z; }
        }
      }
    } catch (e) { /* no lanes: the mapped carriageways stand */ }
    // furniture with no collider, and parked bikes (8 m cells: x, z, r)
    const ob = (x, z, r) => { const k = key(Math.floor(x / 8), Math.floor(z / 8)); let a = this.fcell.get(k); if (!a) this.fcell.set(k, (a = [])); a.push(x, z, r); };
    const F = g.world && g.world.furniture && g.world.furniture.sets;
    if (F) for (const kind in FURN) {
      const st = F[kind]; if (!st) continue; const [rr, hl] = FURN[kind];
      for (let i = 0; i < st.n; i++) {
        const x = st.xz[i * 2], z = st.xz[i * 2 + 1]; if (!(Math.abs(x) < 1e8)) continue;
        const yaw = Math.atan2(st.mat[i * 16 + 8], st.mat[i * 16 + 10]), ux = Math.cos(yaw), uz = -Math.sin(yaw);
        if (hl) for (const u of [-hl, 0, hl]) ob(x + ux * u, z + uz * u, rr); else ob(x, z, rr);
      }
    }
    const VS = g.vehicles && g.vehicles._sys;
    if (VS && VS.pools) VS.pools.forEach((pl) => { if (/^bike_/.test(pl.type)) for (const q of pl.slots) { const sx = Math.sin(q.h) * 0.45, sz = Math.cos(q.h) * 0.45; ob(q.x + sx, q.z + sz, 0.32); ob(q.x - sx, q.z - sz, 0.32); } });
    // wall and hedge tops as drawn: [x1, z1, x2, z2, top, half thickness, hedge]
    const plan = g.world && g.world.barrierPlan;
    if (plan) for (const bp of plan) {
      const hedge = bp.style === 'hedge';
      if (!hedge && bp.style !== 'stone' && bp.style !== 'brick') continue;
      for (const pc of bp.pieces || []) {
        const seg = pc.seg; if (!seg || seg.length < 2) continue;
        const top = hedge ? pc.h : pc.low || bp.kind === 'city_wall' ? pc.h : pc.h + 0.12;
        const half = hedge ? (pc.low ? 0.375 : 0.45) : bp.kind === 'city_wall' ? 0.8 : bp.kind === 'retaining_wall' ? 0.25 : pc.low ? 0.17 : 0.26;
        if (!(top > 0.3) || top > 3.4) continue;
        for (let i = 0; i < seg.length - 1; i++) {
          const w = [seg[i][0], seg[i][1], seg[i + 1][0], seg[i + 1][1], top, half, hedge ? 1 : 0, i === 0 ? 1 : 0, i === seg.length - 2 ? 1 : 0];
          if (Math.hypot(w[2] - w[0], w[3] - w[1]) < 0.8) continue;
          this.walls.push(w);
          for (let a = Math.floor(Math.min(w[0], w[2]) / 16); a <= Math.floor(Math.max(w[0], w[2]) / 16); a++) for (let b = Math.floor(Math.min(w[1], w[3]) / 16); b <= Math.floor(Math.max(w[1], w[3]) / 16); b++) { const k = key(a, b); let l = this.wcell.get(k); if (!l) this.wcell.set(k, (l = [])); l.push(w); }
        }
      }
    }
    return true;
  }

  inMap(x, z) { for (const q of this.boxes) if (x >= q.minX + 1 && x <= q.maxX - 1 && z >= q.minZ + 1 && z <= q.maxZ - 1) return true; return false; }
  /** the footprint (x, z) is in, or within pad of the wall of; null when none. -> the entry {top, ...} */
  building(x, z, pad = 0) {
    const a = this.bcell.get(key(Math.floor(x / 32), Math.floor(z / 32)));
    if (a) for (const e of a) {
      if (x < e.x0 - pad || x > e.x1 + pad || z < e.z0 - pad || z > e.z1 + pad) continue;
      if (pointInPoly(x, z, e.poly)) { let hole = false; if (e.holes) for (const h of e.holes) if (pointInPoly(x, z, h)) { hole = true; if (pad > 0) for (let i = 0; i < h.length; i++) { const p = h[i], q = h[(i + 1) % h.length]; if (dseg(x, z, p[0], p[1], q[0], q[1]) < pad) return e; } break; } if (!hole) return e; continue; }
      if (pad > 0) { const P = e.poly; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; if (dseg(x, z, p[0], p[1], q[0], q[1]) < pad) return e; } }
    }
    return null;
  }
  /** is a circle (x, z, r) on a carriageway or an AI lane? */
  carriage(x, z, r) {
    const a = this.rcell.get(key(Math.floor(x / 20), Math.floor(z / 20)));
    if (a) for (const s of a) if (dseg(x, z, s[0], s[1], s[2], s[3]) < s[4] + r) return true;
    return false;
  }
  parking(x, z) {
    const a = this.pcell.get(key(Math.floor(x / 32), Math.floor(z / 32)));
    if (a) for (const e of a) if (x >= e.x0 && x <= e.x1 && z >= e.z0 && z <= e.z1 && pointInPoly(x, z, e.poly)) return true;
    return false;
  }
  furniture(x, z, r) {
    for (let cx = Math.floor((x - 2) / 8); cx <= Math.floor((x + 2) / 8); cx++) for (let cz = Math.floor((z - 2) / 8); cz <= Math.floor((z + 2) / 8); cz++) {
      const a = this.fcell.get(key(cx, cz)); if (a) for (let i = 0; i < a.length; i += 3) if (Math.hypot(a[i] - x, a[i + 1] - z) < a[i + 2] + r) return true;
    }
    return false;
  }
  wet(x, z) { return this.col.isWater(x, z) && !this.col.onBridge(x, z); }

  /** open ground a bird may stand on at (x, z)? -> its height, or NaN. `light`: the cheap re-test for a step taken from a good spot */
  ground(x, z, light = false) {
    const col = this.col;
    if (!this.inMap(x, z)) return NaN;
    if (col.isWater(x, z) || col.onBridge(x, z)) return NaN;
    if (!col.isFree(x, z, 0.3) || (col.inPassage && col.inPassage(x, z))) return NaN;
    if (this.building(x, z, 0.3)) return NaN;
    if (barrierGap(col, x, z, 1) < 0.25) return NaN;
    if (this.carriage(x, z, light ? 0.6 : 1.0)) return NaN;      // (a metre clear of the carriageway's edge to land; it may wander a little nearer)
    if (this.furniture(x, z, 0.3) || this.parking(x, z)) return NaN;
    if (!light) {
      for (let k = 0; k < 4; k++) { const a = k * 1.5708 + 0.4; if (col.isWater(x + Math.cos(a) * 0.5, z + Math.sin(a) * 0.5)) return NaN; }
      // shut in on every side (the inside of something a place module built without a mapped footprint)?
      let hits = 0;
      for (let k = 0; k < 8; k++) { const a = k * 0.7854 + 0.2; if (col.raycast(x, z, x + Math.cos(a) * 6, z + Math.sin(a) * 6, { ignoreLow: false }) !== null) hits++; }
      if (hits >= 7) return NaN;
    }
    const w = this.game.world, y = w && w.groundHeight ? w.groundHeight(x, z) : 0;
    return y === y && y > -0.5 && y < 3 ? y : NaN;
  }
  /** open water a water bird may sit on at (x, z)? */
  water(x, z) {
    const col = this.col;
    if (!this.inMap(x, z) || !col.isWater(x, z) || col.onBridge(x, z)) return false;
    for (let k = 0; k < 6; k++) { const a = k * 1.0472, px = x + Math.cos(a) * 1.1, pz = z + Math.sin(a) * 1.1; if (!col.isWater(px, pz) || col.onBridge(px, pz)) return false; }
    return col.isFree(x, z, 0.6) && !this.building(x, z, 0.5);
  }
  waterY() { const w = this.game.world; return (w && w.Y && w.Y.water) || 0.035; }

  /** is the air at (x, y, z) clear of every building (0.6 m over its top counts as clear)? */
  airClear(x, y, z, skipId = null) {
    const a = this.bcell.get(key(Math.floor(x / 32), Math.floor(z / 32)));
    if (a) for (const e of a) {
      if (y > e.top + 0.6 || e.id === skipId || x < e.x0 - 0.25 || x > e.x1 + 0.25 || z < e.z0 - 0.25 || z > e.z1 + 0.25) continue;
      if (pointInPoly(x, z, e.poly)) { let hole = false; if (e.holes) for (const h of e.holes) if (pointInPoly(x, z, h)) { hole = true; break; } if (!hole) return false; continue; }
      const P = e.poly; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; if (dseg(x, z, p[0], p[1], q[0], q[1]) < 0.25) return false; }
    }
    return true;
  }

  // ------------------------------------------------------------------------------------------ finding spots near a point
  /** o = {x, y, z, h, kind} ; rnd() in [0, 1). Each returns true when it found one within R of (cx, cz). */
  findGround(cx, cz, R, rnd, o, tries = 6) {
    for (let k = 0; k < tries; k++) {
      const a = rnd() * 6.2832, d = Math.sqrt(rnd()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = this.ground(x, z);
      if (y === y) { o.x = x; o.y = y; o.z = z; o.h = rnd() * 6.2832; o.kind = 'ground'; return true; }
    }
    return false;
  }
  findWater(cx, cz, R, rnd, o, tries = 8) {
    for (let k = 0; k < tries; k++) {
      const a = rnd() * 6.2832, d = Math.sqrt(rnd()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (this.water(x, z)) { o.x = x; o.y = this.waterY(); o.z = z; o.h = rnd() * 6.2832; o.kind = 'water'; return true; }
    }
    return false;
  }
  /** the top of a wall (or, hedge = true, of a hedge) as drawn; facing (fx, fz) = towards whoever it should look at */
  findWall(cx, cz, R, rnd, o, hedge = false, fx = cx, fz = cz) {
    const C = this._c; C.length = 0;
    for (let a = Math.floor((cx - R) / 16); a <= Math.floor((cx + R) / 16); a++) for (let b = Math.floor((cz - R) / 16); b <= Math.floor((cz + R) / 16); b++) {
      const l = this.wcell.get(key(a, b)); if (l) for (const w of l) if ((!w[6] || hedge) && C.indexOf(w) < 0 && dseg(cx, cz, w[0], w[1], w[2], w[3]) < R) C.push(w);
    }
    for (let k = 0; k < 5 && C.length; k++) {
      const w = C[Math.floor(rnd() * C.length)], L = Math.hypot(w[2] - w[0], w[3] - w[1]), m0 = w[7] ? 0.6 : 0.15, m1 = w[8] ? 0.6 : 0.15;
      if (L < m0 + m1 + 0.2) continue;
      const t = (m0 + rnd() * (L - m0 - m1)) / L, x = w[0] + (w[2] - w[0]) * t, z = w[1] + (w[3] - w[1]) * t;
      if (Math.hypot(x - cx, z - cz) > R || !this.inMap(x, z) || (this.col.inPassage && this.col.inPassage(x, z)) || this.building(x, z, 0.35) || this.wet(x, z)) continue;
      // (something else of the same kind across it — a taller wall, a crossing hedge — would stand through the bird)
      if (this._wallClash(w, x, z)) continue;
      const nx = -(w[3] - w[1]) / L, nz = (w[2] - w[0]) / L, sd = (fx - x) * nx + (fz - z) * nz > 0 ? 1 : -1;
      o.x = x; o.y = w[4]; o.z = z; o.h = Math.atan2(nx * sd, nz * sd); o.kind = w[6] ? 'hedge' : 'wall'; o.half = w[5];
      return true;
    }
    return false;
  }
  _wallClash(w, x, z) {
    const l = this.wcell.get(key(Math.floor(x / 16), Math.floor(z / 16)));
    if (l) for (const q of l) if (q !== w && q[4] > w[4] + 0.05 && dseg(x, z, q[0], q[1], q[2], q[3]) < q[5] + 0.2) return true;
    return false;
  }
  /** the top rail of a bench's back */
  findBench(cx, cz, R, rnd, o) {
    const st = this.game.world && this.game.world.furniture && this.game.world.furniture.sets && this.game.world.furniture.sets.bench;
    if (!st) return false;
    const C = this._c; C.length = 0;
    for (let i = 0; i < st.n; i++) { const x = st.xz[i * 2], z = st.xz[i * 2 + 1]; if (Math.abs(x - cx) < R && Math.abs(z - cz) < R && Math.hypot(x - cx, z - cz) < R) C.push(i); }
    if (!C.length) return false;
    const i = C[Math.floor(rnd() * C.length)], M = st.mat, q = i * 16, yaw = Math.atan2(M[q + 8], M[q + 10]), lx = (rnd() - 0.5) * 1.4, lz = -0.26;
    const x = M[q + 12] + Math.cos(yaw) * lx + Math.sin(yaw) * lz, z = M[q + 14] - Math.sin(yaw) * lx + Math.cos(yaw) * lz;
    if (!this.inMap(x, z) || this.building(x, z, 0.2) || this.wet(x, z)) return false;
    o.x = x; o.y = M[q + 13] + 0.905; o.z = z; o.h = yaw + (rnd() < 0.7 ? 0 : Math.PI); o.kind = 'bench'; o.ref = i;
    return true;
  }
  /** the edge of a low flat roof (on its parapet where it has one) */
  findRoof(cx, cz, R, rnd, o) {
    const BG = this.game.world && this.game.world.buildingGrid; if (!BG) return false;
    const C = this._c; C.length = 0;
    BG.queryRadius(cx, cz, R, (rec) => {
      const s = rec.res; if (!s || s.shape !== 'flat' || s.crenel || (s.minH || 0) > 0.5 || !(s.wallTop > 2.3) || !s.poly) return;
      const top = s.wallTop + (s.parapet ? s.pH || 0 : 0); if (top > 13.5) return;
      C.push(rec);
    });
    for (let k = 0; k < 6 && C.length; k++) {
      const rec = C[Math.floor(rnd() * C.length)], s = rec.res, P = s.poly, i = Math.floor(rnd() * P.length), a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1.6) continue;
      const top = s.wallTop + (s.parapet ? s.pH || 0 : 0);
      if (rec.hidden && rec.hidden.length === P.length && rec.hidden[i] > top - 1) continue;      // (a neighbour stands against this edge)
      const t = (0.4 + rnd() * (L - 0.8)) / L, ex = a[0] + (b[0] - a[0]) * t, ez = a[1] + (b[1] - a[1]) * t;
      if (Math.hypot(ex - cx, ez - cz) > R) continue;
      let nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
      if (!pointInPoly(ex + nx * 0.3, ez + nz * 0.3, P)) { nx = -nx; nz = -nz; if (!pointInPoly(ex + nx * 0.3, ez + nz * 0.3, P)) continue; }
      const ins = s.parapet ? 0.03 : 0.28, x = ex + nx * ins, z = ez + nz * ins;
      if ((s.holes || []).some((h) => pointInPoly(x, z, h))) continue;
      // nothing else mapped over this point or just outside the edge that stands as high (a part, a taller neighbour)
      if (this._over(x, z, top, rec.b) || this._over(ex - nx * 0.5, ez - nz * 0.5, top, rec.b)) continue;
      o.x = x; o.y = top; o.z = z; o.h = Math.atan2(-nx, -nz); o.kind = 'roof'; o.ref = rec.b.id;
      return true;
    }
    return false;
  }
  _over(x, z, y, self) {
    const a = this.bcell.get(key(Math.floor(x / 32), Math.floor(z / 32)));
    if (a) for (const e of a) { if (e.id === self.id || e.top < y - 0.6 || x < e.x0 || x > e.x1 || z < e.z0 || z > e.z1) continue; if (pointInPoly(x, z, e.poly)) return true; }
    return false;
  }
}
export { BARRIER_HALF };
