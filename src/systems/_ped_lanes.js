// Lanes: how much of a street's WIDTH the street walkers use (systems/pedestrians.js).
//
// The walk graph is lines: both pavements of a street with a carriageway, but ONE line down the middle of a
// pedestrianised street (Cornmarket, Queen Street), a square or a wide paved place — and every walker kept within half a
// metre of its line, so a busy pedestrian street was a single file down the middle of fifteen metres of empty paving.
//
// Here each walker has a LANE: a fixed share of the way across (from its look seed, so it is the same walker in the same
// lane on every player's screen, whoever owns it — nothing is sent), leaning to the left of the way it is going so the
// two directions pass each other. At each graph node the room either side of the line is measured once (and kept):
//   - within the mapped way's own half width (graph.W: a 2.2 m footway is 1.1 m either side, a pedestrian street 3.5 m,
//     a pavement line 1.1 m), and beyond that only over mapped PAVING (map.areas kind 'paved': Cornmarket and Queen
//     Street wall to wall, Broad Street's wide paving, Gloucester Green, Bonn Square, Radcliffe Square, the paved
//     quads) that is not under a lawn, a flowerbed or a garden — so a park path or a quad's path is walked as before;
//   - never past a wall or a shopfront (0.9 m short of it: clear of a door opening outwards), into a building, onto a
//     carriageway, into water or off the map.
// The walker then makes for its share of that room at the next node, on a line tested every 0.7 m against the collider
// (walls, lamp posts, trees, bins, A-boards, cabinets) and the world's furniture that has no collider (benches, bins,
// pillar boxes, phone boxes, picnic tables, shelters, bike stands, bollards) and whatever on wheels is standing still
// there just now (a taxi on its rank, a parked car: the traffic's neighbour grid); the nearest clear line is taken
// instead, else the least obstructed. Groups walk as before round their leader, who keeps half a metre more from the edges.
import { pointInPoly } from '../core/collision.js';
import { K_PED, K_PLAYER, capsulePoint } from './_motion.js';

const MAX = 9, STEP = 0.25;                 // the furthest a lane may lie from the graph's line; the probe's step
const WALL = 0.9, EDGE = 0.25;              // kept clear of a wall / of the edge of the paving
const BODY = 0.4;                           // the walker and a little air, for the clear-line test
const SOFT = new Set(['water', 'garden', 'grass', 'meadow', 'pitch', 'wood', 'scrub', 'flowerbed', 'sand']);
// the world's furniture (world/furniture.js InstanceSets): [radius, half length along the thing (circles strung along it)]
const FURN = { bench: [0.32, 0.6], bin: [0.27, 0], postBox: [0.3, 0], busStop: [0.08, 0], shelter: [0.8, 1.2], stand: [0.15, 0.25], phone: [0.55, 0], signal: [0.1, 0], bollard: [0.1, 0], belisha: [0.08, 0], picnic: [1.0, 0] };
const RAY = { ignoreLow: false };
const KERB = 0.55;                          // a lane's edge is this far outside the carriageway's (as the old half metre either side of the pavement line)
const _vi = new Int32Array(256), _cp = { x: 0, z: 0 };

/** integer hash -> [0, 1): the same on every client */
function h01(a, b) {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca77)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** a walker's share of the way across, 0 (hard left of the way it is going) .. 1 (hard right): from who it is */
export function laneShare(p) {
  const u = h01(p.lookKind >= 0 ? p.lookSeed : (p.sid || p.poolIdx + 1), 0x1a9e);
  const f = 2 * u - 1;
  return (f - 0.35 * (1 - f * f) + 1) / 2;      // (keep left: the middle of the spread sits left of the line)
}

export class Lanes {
  /** sys: the Pedestrians system (graph, wet, road, bounds) */
  constructor(game, sys) {
    this.game = game; this.sys = sys;
    this.spans = new Map();          // a * N + b -> [room to the left, room to the right] of node b, going a -> b
    this.L = 0; this.R = 0; this._vn = 0;
    this._areas = null; this._furn = null;
    this.stats = { spans: 0, picks: 0, moved: 0, line: 0 };
  }

  // ---------------------------------------------------------------- what is underfoot
  _buildAreas() {
    const C = 32, paved = new Map(), soft = new Map(), ovr = this.game.overrides || {};
    for (const a of this.game.map.areas || []) {
      const isP = a.kind === 'paved'; if (!isP && !SOFT.has(a.kind)) continue;
      if (!a.poly || a.poly.length < 3 || (ovr.skip && ovr.skip.has(a.id))) continue;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const q of a.poly) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
      const g = isP ? paved : soft;
      for (let cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx++) for (let cz = Math.floor(z0 / C); cz <= Math.floor(z1 / C); cz++) { const k = cx * 65536 + cz; let l = g.get(k); if (!l) g.set(k, (l = [])); l.push(a); }
    }
    this._areas = { C, paved, soft };
  }
  _in(g, x, z) {
    const A = this._areas, l = g.get(Math.floor(x / A.C) * 65536 + Math.floor(z / A.C));
    if (l) for (let i = 0; i < l.length; i++) { const a = l[i]; if (pointInPoly(x, z, a.poly) && !(a.holes && a.holes.some((h) => pointInPoly(x, z, h)))) return true; }
    return false;
  }
  /** mapped paving that nothing green is drawn over */
  paved(x, z) { if (!this._areas) this._buildAreas(); return this._in(this._areas.paved, x, z) && !this._in(this._areas.soft, x, z); }
  /** inside a building's outline (beside an archway the collider is open: nothing else says so) */
  _inBuilding(x, z) {
    const W = this.game.world, BG = W && W.buildingGrid; if (!BG) return false;
    const ovr = this.game.overrides || {}; let hit = false;
    BG.queryRadius(x, z, 1, (q) => { const b = q.b; if (!b || b.part || (b.minH || 0) > 2.5 || (b.tags && b.tags.building === 'roof') || (ovr.skip && ovr.skip.has(b.id)) || (ovr.skipCollision && ovr.skipCollision.has(b.id))) return; if (pointInPoly(x, z, b.poly) && !(b.holes || []).some((h) => pointInPoly(x, z, h))) { hit = true; return true; } });
    return hit;
  }
  _buildFurn() {
    const OB = (this._furn = new Map()), W = this.game.world, F = W && W.furniture && W.furniture.sets;
    const ob = (x, z, r) => { const k = Math.floor(x / 8) * 65536 + Math.floor(z / 8); let a = OB.get(k); if (!a) OB.set(k, (a = [])); a.push(x, z, r); };
    if (F) for (const kind in FURN) {
      const st = F[kind]; if (!st || !st.xz || !st.mat) continue; const rr = FURN[kind][0], hl = FURN[kind][1];
      for (let i = 0; i < st.n; i++) {
        const x = st.xz[i * 2], z = st.xz[i * 2 + 1]; if (!(Math.abs(x) < 1e8)) continue;      // (removed ones are parked far away)
        const yaw = Math.atan2(st.mat[i * 16 + 8], st.mat[i * 16 + 10]), ux = Math.cos(yaw), uz = -Math.sin(yaw);
        if (hl) { ob(x - ux * hl, z - uz * hl, rr); ob(x, z, rr); ob(x + ux * hl, z + uz * hl, rr); } else ob(x, z, rr);
      }
    }
  }
  /** a piece of the world's furniture within r of (x, z)? */
  furniture(x, z, r) {
    if (!this._furn) this._buildFurn();
    const OB = this._furn;
    for (let cx = Math.floor((x - 2) / 8); cx <= Math.floor((x + 2) / 8); cx++) for (let cz = Math.floor((z - 2) / 8); cz <= Math.floor((z + 2) / 8); cz++) {
      const a = OB.get(cx * 65536 + cz); if (a) for (let i = 0; i < a.length; i += 3) { const dx = a[i] - x, dz = a[i + 1] - z, R = a[i + 2] + r; if (dx * dx + dz * dz < R * R) return true; }
    }
    return false;
  }

  // ---------------------------------------------------------------- the room either side of a node
  _onMap(x, z) {
    const B = this.sys.bounds, inR = (q) => x > q.minX + 2 && x < q.maxX - 2 && z > q.minZ + 2 && z < q.maxZ - 2;
    if (B.boxes) { for (let i = 0; i < B.boxes.length; i++) if (inR(B.boxes[i])) return true; return false; }
    return inR(B);
  }
  /** how far a walker may be from node b along (ux, uz): see the top of the file */
  _room(b, ux, uz) {
    const S = this.sys, G = S.graph, col = this.game.worldCollider, bx = G.X[b], bz = G.Z[b], hw = G.W ? G.W[b] : 1.1;
    const t = col.raycast(bx, bz, bx + ux * (MAX + WALL), bz + uz * (MAX + WALL), RAY), wall = t === null ? 1e9 : t * (MAX + WALL) - WALL;
    let ext = 0, edge = true;
    for (let d = STEP; d <= MAX + 1e-6; d += STEP) {
      if (d > wall) { edge = false; break; }
      const x = bx + ux * d, z = bz + uz * d;
      if (!this._onMap(x, z) || S.wet(x, z) || S.road(x, z, KERB) || (d > hw && !this.paved(x, z)) || this._inBuilding(x, z)) break;
      ext = d;
    }
    return edge ? Math.max(0, ext - EDGE) : ext;
  }
  /** room to the left and to the right of node b for a walker going a -> b: sets this.L, this.R (metres, >= 0) */
  span(a, b) {
    const G = this.sys.graph, k = a * G.count + b;
    let v = this.spans.get(k);
    if (!v) {
      let dx = G.X[b] - G.X[a], dz = G.Z[b] - G.Z[a]; const l = Math.hypot(dx, dz);
      if (a === b || l < 1e-3 || this.sys.road(G.X[b], G.Z[b])) v = [0, 0];
      else {
        dx /= l; dz /= l;
        // (a short link between two lines swings the "across" direction round: no further out than the link is long)
        let cap = Math.max(0.6, l * 1.2);
        // (an edge that crosses a carriageway is walked straight over, as it always was: a lane far along the other
        // pavement made the crossing a long diagonal, with the traffic waiting for it)
        for (let s = 1; s < l; s += 1) if (this.sys.road(G.X[a] + dx * s, G.Z[a] + dz * s)) { cap = 0.55; break; }
        v = [Math.min(cap, this._room(b, -dz, dx)), Math.min(cap, this._room(b, dz, -dx))];
      }
      this.spans.set(k, v); this.stats.spans++;
    }
    this.L = v[0]; this.R = v[1];
    return v;
  }

  // ---------------------------------------------------------------- a walker's line to the next node
  /** how much of the straight walk from (x0, z0) to (x1, z1) is in the way: 0 = clear of walls, furniture and water;
   *  else the number of blocked spots along it, tested every 0.7 m (1000: a wall across it, or water at the far end).
   *  The first metre is where the walker already stands: not tested. */
  blocked(x0, z0, x1, z1) {
    const S = this.sys, col = this.game.worldCollider, dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    if (S.wet(x1, z1)) return 1000;
    let bad = !col.isFree(x1, z1, BODY) || this.furniture(x1, z1, BODY) || this._parked(x1, z1) ? 1 : 0;
    if (L < 1) return bad;
    if (col.raycast(x0, z0, x1, z1, RAY) !== null) return 1000;
    const n = Math.ceil(L / 0.7);
    for (let i = 1; i < n; i++) {
      const f = i / n; if (f * L < 1) continue;
      const x = x0 + dx * f, z = z0 + dz * f;
      if (S.wet(x, z)) return 1000;
      if (!col.isFree(x, z, BODY) || this.furniture(x, z, BODY) || this._parked(x, z) || this._inBuilding(x, z)) bad++;      // (in a building: beside an archway, where the collider is open)
    }
    return bad;
  }
  /** what is standing still on wheels in the box (x0, z0)-(x1, z1) (the traffic's neighbour grid, last frame): kept for _parked */
  _vehicles(x0, z0, x1, z1) {
    const T = this.game.traffic, G = T && T.grid; this._vn = 0;
    if (!G || !G.n) return;
    const n = G.gatherBox(x0 - 4, z0 - 4, x1 + 4, z1 + 4, _vi);
    for (let j = 0; j < n; j++) { const i = _vi[j], k = G.K[i]; if (k === K_PED || k === K_PLAYER || G.V[i] > 0.5 || !(G.HALF[i] > 0)) continue; _vi[this._vn++] = i; }
  }
  _parked(x, z) {
    if (!this._vn) return false;
    const G = this.game.traffic.grid;
    for (let j = 0; j < this._vn; j++) { const i = _vi[j]; if (capsulePoint(G, i, x, z, _cp) < G.R[i] + BODY) return true; }
    return false;
  }
  /**
   * The offset (m, + = right of travel) from node b that walker p makes for on the edge a -> b, from where it stands
   * (x, z). inset: metres more kept from both edges (a group's leader). Deterministic in (p's seed, a, b, x, z, the world).
   */
  pick(p, a, b, x, z, inset = 0) {
    this.span(a, b);
    let L = this.L - inset, R = this.R - inset; if (L < 0) L = 0; if (R < 0) R = 0;
    if (L + R < 0.05) return 0;
    this.stats.picks++;
    const G = this.sys.graph, bx = G.X[b], bz = G.Z[b];
    let dx = bx - G.X[a], dz = bz - G.Z[a]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const px = dz, pz = -dx, want = -L + laneShare(p) * (L + R);
    { const lx = bx - px * L, lz = bz - pz * L, rx = bx + px * R, rz = bz + pz * R; this._vehicles(Math.min(x, lx, rx), Math.min(z, lz, rz), Math.max(x, lx, rx), Math.max(z, lz, rz)); }
    let best = want, bb = this.blocked(x, z, bx + px * want, bz + pz * want);
    if (!bb) return want;
    // something stands on that line: the nearest clear one across the room there is; with none, the least obstructed
    // (a bus shelter that fills the pavement: the side of it with more room)
    this.stats.moved++;
    for (let k = 1; k <= 12; k++) for (let s = -1; s <= 1; s += 2) {
      let o = want + s * k * 0.4;
      if (o < -L) { if (o > -L - 0.4) o = -L; else continue; } else if (o > R) { if (o < R + 0.4) o = R; else continue; }
      const q = this.blocked(x, z, bx + px * o, bz + pz * o);
      if (!q) return o;
      if (q < bb) { bb = q; best = o; }
    }
    // (the graph's own line where it is no worse: through an archway, along a covered way)
    this.stats.line++;
    if (bb >= 1000 || this.blocked(x, z, bx, bz) <= bb) return 0;
    return best;
  }
  /** where a new walker stands at node n, about to walk to `next`: its own lane there, or null (the node itself) */
  start(p, n, next) {
    if (n === next) return null;
    const G = this.sys.graph, col = this.game.worldCollider, S = this.sys, nx = G.X[n], nz = G.Z[n];
    this.span(next, n);          // (the room at n, measured for the other way along this edge: left and right change places)
    const L = this.R, R = this.L; if (L + R < 0.05) return null;
    let dx = G.X[next] - nx, dz = G.Z[next] - nz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const o = -L + laneShare(p) * (L + R), x = nx + dz * o, z = nz - dx * o;
    this._vn = 0;
    if (S.wet(x, z) || S.road(x, z, KERB) || !col.isFree(x, z, BODY) || this.furniture(x, z, BODY) || col.raycast(nx, nz, x, z, RAY) !== null) return null;
    return { x, z };
  }
}
