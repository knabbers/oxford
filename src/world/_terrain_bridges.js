// Bridge sides (world/terrain.js). With the surveyed ground a deck stands 1-6 m over its water, and the flat world's
// bridges have nothing under them: the road ribbon and its parapets would hang in the air. For every mapped way that
// crosses water on a raised deck (tagged a bridge or not) this adds, into the city's own facade tiles (no draw call, no
// material of its own; only into a tile that already holds something, so no view gains a draw: a crossing out in the
// meadows with no building or wall within its 240 m tile goes without, counted in stats.bridgeBodies.skipped):
//   - a road or street: stone side walls under the parapet line, with elliptical arches over the water (one per ~11 m,
//     piers between, springing from the water line), the barrel under the deck, solid abutments at the banks;
//   - a path, cycleway or track: a girder: a fascia 0.5 m deep each side and the underside.
// Everything is a GUESS of form (the map knows a bridge's line and width, not its arches): the bridges that deserve
// hand modelling are listed in docs/ARCHITECTURE.md "Terrain". Heights come from the terrain field: all vertices
// stand on the deck's own plateau (the tool makes it wide enough), so y here is simply "below the deck".
import { pointAt, polylineLength, flatPoly } from './util.js';
import { FACADE_CELLS as FC, GROUND_CELLS as GC } from './textures.js';
import { TERRAIN } from './terrain.js';

const PAVEMENT_W = { primary: 2.6, secondary: 2.4, tertiary: 2.2, primary_link: 2, secondary_link: 2, tertiary_link: 2, unclassified: 1.8, residential: 1.8 };   // (as world/roads.js)
const PATHS = new Set(['footway', 'path', 'cycleway', 'steps', 'track', 'bridleway']);

/** Build the sides of every raised crossing. Returns { bridges, tris }. */
export function buildBridgeBodies(ctx) {
  const F = TERRAIN.field, out = { bridges: 0, arches: 0, girders: 0, slabs: 0, skipped: 0, tris: 0 };
  if (!F || TERRAIN.mode !== 'real') return out;
  const { map, batch, ov } = ctx;
  for (const r of map.roads) {
    if (!r.pts || r.pts.length < 2 || r.tunnel || r.covered || ov.skip.has(r.id) || r.kind === 'steps' || r.kind === 'corridor') continue;
    if (r.layer && +r.layer < 0 && !r.bridge) continue;
    const path = PATHS.has(r.kind), pw = r.pw !== undefined ? r.pw : PAVEMENT_W[r.kind] || 0;
    // the face: the outer face of the stone parapet (roads.js: 0.45 thick about w / 2 + pw + 0.25), the railing of a
    // footbridge, or the edge of the pavement where an untagged way simply crosses
    const stone = !path, parapet = stone && !!r.bridge;
    const face = path ? r.w / 2 + 0.2 : parapet ? r.w / 2 + (pw || 0.3) + 0.475 : r.w / 2 + pw + 0.05;
    const pts = r.pts, L = polylineLength(pts); if (L < 2) continue;
    const n = Math.max(2, Math.ceil(L)), ds = L / n, wet = [], clr = [];
    for (let k = 0; k <= n; k++) {
      const P = pointAt(pts, k * ds); let w = false, c = 1e9;
      for (const sg of [1, -1]) {
        const x = P.x - P.dz * sg * face, z = P.z + P.dx * sg * face, d = F.sample(F.R, x, z);
        if (F.sample(F.B, x, z) < d - 0.3) w = true;
        c = Math.min(c, d - F.sample(F.W, x, z));
      }
      wet.push(w); clr.push(c);
    }
    for (let k = 0; k <= n; k++) {
      if (!wet[k]) continue;
      let e = k; while (e < n && wet[e + 1]) e++;
      let cmin = 1e9; for (let q = k; q <= e; q++) cmin = Math.min(cmin, clr[q]);
      const s0 = Math.max(0, k * ds - 1), s1 = Math.min(L, e * ds + 1);
      if (s1 - s0 >= 1.5) {
        // (the slab under every crossing, however low: the water is drawn after the road and must not be drawn over it)
        out.tris += slab(batch, pts, s0, s1, face); out.slabs++;
        if (cmin >= 0.7) { out.tris += stone ? arches(F, batch, r, pts, s0, s1, face, cmin, parapet, out) : girder(F, batch, r, pts, s0, s1, face, out); out.bridges++; }
      }
      k = e;
    }
  }
  // mapped bridge and pier outlines (paving laid over the water as a layer of the ground): the same slab under each
  for (const a of map.areas) {
    if ((a.kind !== 'bridge' && a.kind !== 'pier') || !a.poly || a.poly.length < 3 || ov.skip.has(a.id)) continue;
    const c = a.poly.reduce((q, p) => [q[0] + p[0] / a.poly.length, q[1] + p[1] / a.poly.length], [0, 0]);
    if (F.sample(F.B, c[0], c[1]) > F.sample(F.R, c[0], c[1]) - 0.3) continue;      // (not over water)
    const buf = batch.buf('base', c[0], c[1]); buf.L = 0.6; buf.setCell(GC.paving).setTint(0.8, 0.79, 0.76);
    const n0 = buf.idx.length; flatPoly(buf, a.poly, a.holes || [], 0, 3); out.tris += (buf.idx.length - n0) / 3; out.slabs++;
  }
  return out;
}

// The deck itself, as far as depth goes: the road, pavement and paint on a bridge are layers of the ground and write no
// depth (world/terrain.js "THE GROUND'S LAYERS"), so whatever is under a deck (the water, a punt, the bridge's own
// barrel) would be drawn over them. A slab from face to face just under the road, drawn with the BASE ground (ground
// mesh, layer 0.6: lifted by the deck's field, writes depth), closes the deck.
function slab(batch, pts, s0, s1, face) {
  const mid = pointAt(pts, (s0 + s1) / 2), buf = batch.buf('base', mid.x, mid.z), cols = Math.max(1, Math.round((s1 - s0) / 3));
  buf.L = 0.6; buf.setCell(GC.paving).setTint(0.8, 0.79, 0.76);
  let pa = -1, pc = -1, tris = 0;
  for (let j = 0; j <= cols; j++) {
    const s = s0 + (s1 - s0) * j / cols, A = at(pts, s, 1, face), C = at(pts, s, -1, face);
    const va = buf.v(A[0], 0, A[1], 0, 1, 0, A[0] / 3, A[1] / 3), vc = buf.v(C[0], 0, C[1], 0, 1, 0, C[0] / 3, C[1] / 3);
    if (j > 0) { buf.quadFacing(pa, va, vc, pc, 0, 1, 0); tris += 2; }
    pa = va; pc = vc;
  }
  return tris;
}

// a vertex on the face line: s along the way, side +1 / -1, y below the deck
function at(pts, s, side, face) { const P = pointAt(pts, s); return [P.x - P.dz * side * face, P.z + P.dx * side * face, -P.dz * side, P.dx * side]; }
const below = (F, x, z) => F.sample(F.W, x, z) - F.sample(F.R, x, z);     // the water's surface, as y under the deck (negative)

function arches(F, batch, r, pts, s0, s1, face, cmin, parapet, out) {
  const Ls = s1 - s0, top = parapet ? -0.6 : 0.1, US = 3.2;
  const abut = Math.min(1.2, Ls * 0.15);
  let na = Math.max(1, Math.round(Ls / 11)), pier = 1.4, aw = 0, rise = 0;
  for (; na >= 1; na--) { aw = (Ls - 2 * abut - (na - 1) * pier) / na; if (aw >= 3) break; }
  if (na >= 1) rise = Math.min(aw * 0.5, cmin + top - 0.45);
  const open = na >= 1 && rise >= 0.45;
  // pieces along the face: [from, to, arch?]
  const pieces = [];
  if (!open) pieces.push([s0, s1, false]);
  else {
    let s = s0; pieces.push([s, s + abut, false]); s += abut;
    for (let i = 0; i < na; i++) { pieces.push([s, s + aw, true]); s += aw; if (i < na - 1) { pieces.push([s, s + pier, false]); s += pier; } }
    pieces.push([s, s1, false]);
    out.arches += na;
  }
  const mid = pointAt(pts, (s0 + s1) / 2);
  const buf = batch.peek('facade', mid.x, mid.z); if (!buf) { out.skipped++; return 0; }
  buf.A = NaN; buf.setDetail(false).setTop(1e4);
  let tris = 0;
  const K = 8;
  for (const [a, b, arch] of pieces) {
    const cols = arch ? K : Math.max(1, Math.round((b - a) / 3));
    const row = { 1: [], [-1]: [] };
    for (const side of [1, -1]) {
      buf.setCell(FC.stoneBlank, FC.stoneBlank, 0, r.id.length * 7 % 16).setTint(0.9, 0.88, 0.82);
      let pb = -1, pt = -1;
      for (let j = 0; j <= cols; j++) {
        const s = a + (b - a) * j / cols, [x, z, nx, nz] = at(pts, s, side, face), yw = below(F, x, z);
        const t = arch ? j / cols * 2 - 1 : 0;
        const yb = arch ? Math.min(top - 0.3, yw + rise * Math.sqrt(Math.max(0, 1 - t * t))) : yw - 0.8;
        const vb = buf.v(x, yb, z, nx, 0, nz, s / US, yb / US), vt = buf.v(x, top, z, nx, 0, nz, s / US, top / US);
        if (j > 0) { buf.quadFacing(pb, vb, vt, pt, nx, 0, nz); tris += 2; }
        pb = vb; pt = vt; row[side].push([x, yb, z, s]);
      }
    }
    if (arch) {
      // the barrel: from one face to the other along the curve, seen from the water
      buf.setTint(0.6, 0.585, 0.55);
      let pa = -1, pc = -1;
      for (let j = 0; j <= cols; j++) {
        const A = row[1][j], C = row[-1][j];
        const va = buf.v(A[0], A[1], A[2], 0, -1, 0, A[3] / US, 0), vc = buf.v(C[0], C[1], C[2], 0, -1, 0, A[3] / US, 2 * face / US);
        if (j > 0) { buf.quadFacing(pa, va, vc, pc, 0, -1, 0); tris += 2; }
        pa = va; pc = vc;
      }
    }
  }
  return tris;
}

function girder(F, batch, r, pts, s0, s1, face, out) {
  const cols = Math.max(1, Math.round((s1 - s0) / 2.5)), top = 0.03, bot = -0.5, US = 3.2;
  const mid = pointAt(pts, (s0 + s1) / 2), buf = batch.peek('facade', mid.x, mid.z); if (!buf) { out.skipped++; return 0; }
  buf.A = NaN; buf.setDetail(false).setTop(1e4).setCell(FC.stoneBlank, FC.stoneBlank, 0, 0);
  let tris = 0;
  const row = { 1: [], [-1]: [] };
  for (const side of [1, -1]) {
    buf.setTint(0.42, 0.43, 0.45);
    let pb = -1, pt = -1;
    for (let j = 0; j <= cols; j++) {
      const s = s0 + (s1 - s0) * j / cols, [x, z, nx, nz] = at(pts, s, side, face);
      const vb = buf.v(x, bot, z, nx, 0, nz, s / US, bot / US), vt = buf.v(x, top, z, nx, 0, nz, s / US, top / US);
      if (j > 0) { buf.quadFacing(pb, vb, vt, pt, nx, 0, nz); tris += 2; }
      pb = vb; pt = vt; row[side].push([x, z, s]);
    }
  }
  buf.setTint(0.3, 0.3, 0.32);
  let pa = -1, pc = -1;
  for (let j = 0; j <= cols; j++) {
    const A = row[1][j], C = row[-1][j];
    const va = buf.v(A[0], bot, A[1], 0, -1, 0, A[2] / US, 0), vc = buf.v(C[0], bot, C[1], 0, -1, 0, A[2] / US, 2 * face / US);
    if (j > 0) { buf.quadFacing(pa, va, vc, pc, 0, -1, 0); tris += 2; }
    pa = va; pc = vc;
  }
  out.girders++;
  return tris;
}
