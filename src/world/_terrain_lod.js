// The ground's layers on real terrain: order by drawing, and precision by distance (world/terrain.js "THE GROUND'S
// LAYERS"; called by the tile batcher, world/util.js, for layers defined with `stack`).
//
// One tile buffer of a stack layer (the city's single ground + roads mesh; a 500 m tile of pavements and paths; a tile
// of road paint) becomes a STORE:
//   - its triangles sorted by the real height of their layer (what the depth buffer used to decide), and that order is
//     kept in every index buffer built afterwards: a layer above is always drawn after the one below;
//   - for the ground mesh, two meshes on the same vertex buffers: the BASE ground (and the slabs under bridge decks),
//     which writes depth and is drawn first, and the layers above it, which do not write depth;
//   - 50 m CELLS (a triangle belongs to the cell its centre is in; large ones are first cut along the cells' own
//     lines) and three levels of cutting. NEAR, within 60 m of the camera (every cell that reaches into that
//     circle): cut along a 4 m lattice (the base ground's
//     25 m blocks along 5 m). MID, within 350 m, for the ground mesh only (base ground, landuse, carriageways: large
//     triangles): a 32 m lattice (the base ground: its 25 m). FAR: as built
//     (pavements, paths and paint are built in pieces of 10-30 m along their streets already; the base ground's
//     blocks are only given matching corners where blocks of different sizes meet). A flat piece of 4 m runs about
//     half a centimetre off the surveyed ground (nine in ten within 3 cm), one of 16 m about 4 cm (25 cm), one of
//     32 m 12 cm (60 cm), an uncut 100 m block up to a metre or two where the ground steps. A cell's near and mid
//     cuts are made when the ring first reaches it (a few cells a frame; kept while the camera is about) and written into spare room at the end
//     of the same vertex buffers: no draw call is added by any of this. In a band one cell wide two levels are drawn
//     together, so there is never a gap between cells at different levels. The height of every vertex, at every
//     level, is the full-precision field.
import * as THREE from 'three';
import { TERRAIN, terrainSubdivide } from './terrain.js';

const CELL = 50, MUST = 30;
/**
 * PRECISION PER QUALITY TIER, the one place for it. `near`: radius in metres of the fine ring (`grid` m lattice for the
 * layers above the base ground, `gridBase` for the base ground); `mid`: radius of the middle ring, for the ground mesh
 * only (`midGrid` m; base ground `midBase`). Beyond `mid`: as built. All tiers alike for now. Rules for whoever tunes
 * them: `gridBase` and `midBase` must divide 25 (the base ground's blocks stand on 25 m lines: 5, 12.5, 25); `near`
 * not under 40 (uncut ground closer than that can cover the road); a change is taken up at once at run time.
 * Node tests: GTO_TRINGS="near,mid,midGrid,midBase" overrides every tier.
 */
export const TIER_RINGS = {
  low: { near: 60, mid: 350, grid: 4, gridBase: 5, midGrid: 32, midBase: 25 },
  medium: { near: 60, mid: 350, grid: 4, gridBase: 5, midGrid: 32, midBase: 25 },
  high: { near: 60, mid: 350, grid: 4, gridBase: 5, midGrid: 32, midBase: 25 },
  ultra: { near: 60, mid: 350, grid: 4, gridBase: 5, midGrid: 32, midBase: 25 },
};
{
  const o = typeof process !== 'undefined' && process.env && process.env.GTO_TRINGS;
  if (o) { const [near, mid, midGrid, midBase] = o.split(',').map(Number); for (const k in TIER_RINGS) Object.assign(TIER_RINGS[k], { near, mid, midGrid, midBase }); }
}
let TIER = TIER_RINGS.ultra, RING = [TIER.near, TIER.mid], ringGen = 0;
/** The quality tier the rings are sized for (called every frame by the world; a change is taken up at once). */
export function terrainRings(level) { const t = TIER_RINGS[level]; if (t && t !== TIER) { let same = true; for (const k in t) if (t[k] !== TIER[k]) same = false; TIER = t; RING = [t.near, t.mid]; if (!same) ringGen++; } return TIER; }
const gridFor = (S, level) => (level === 0 ? (S.base ? TIER.gridBase : TIER.grid) : S.base ? TIER.midBase : TIER.midGrid);
const KEY = (y, lay) => Math.round((y + lay * 0.00085) * 20000);       // (one layer of the old depth bias was worth 0.85 mm at a walker's eye)
const ATTRS = [['position', 'pos', 3], ['normal', 'nor', 3], ['uv', 'uv', 2], ['aCell', 'cell', 4], ['aTint', 'tint', 3], ['color', 'col', 3], ['aLayer', 'lay', 1]];

/**
 * The store(s) for buffer `b` (a GeoBuf) of layer `L` named `name`: one, or for the ground mesh (`stack: 'split'`) two
 * - its base ground and the layers above it, each with its own vertices, cells and mesh. Adds the meshes through
 * `mk(geometry, isBaseGround)`. Returns an array of stores.
 */
export function buildStack(b, L, name, mk) {
  if (L.stack !== 'split') return [buildOne(b, name, 'thin', mk)];
  // the base ground (and the slabs under bridge decks: layers under 0.9) apart from the rest: no vertex is shared
  const part = (keep) => {
    const m = { pos: [], nor: [], uv: [], idx: [], n: 0, cell: b.cell ? [] : null, tint: b.tint ? [] : null, col: b.col ? [] : null, lay: [], edge: null, top: null, det: null, anc: null }, re = new Map();
    const take = (i) => {
      let j = re.get(i); if (j !== undefined) return j;
      j = m.n++; re.set(i, j);
      m.pos.push(b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]); m.nor.push(b.nor[i * 3], b.nor[i * 3 + 1], b.nor[i * 3 + 2]); m.uv.push(b.uv[i * 2], b.uv[i * 2 + 1]);
      if (m.cell) m.cell.push(b.cell[i * 4], b.cell[i * 4 + 1], b.cell[i * 4 + 2], b.cell[i * 4 + 3]);
      if (m.tint) m.tint.push(b.tint[i * 3], b.tint[i * 3 + 1], b.tint[i * 3 + 2]);
      if (m.col) m.col.push(b.col[i * 3], b.col[i * 3 + 1], b.col[i * 3 + 2]);
      m.lay.push(b.lay[i]);
      return j;
    };
    for (let t = 0; t < b.idx.length; t += 3) if ((b.lay[b.idx[t]] < 0.9) === keep) m.idx.push(take(b.idx[t]), take(b.idx[t + 1]), take(b.idx[t + 2]));
    return m;
  };
  const out = [];
  for (const [m, kind] of [[part(true), 'base'], [part(false), 'top']]) if (m.idx.length) out.push(buildOne(m, name, kind, mk));
  return out;
}

// kind: 'base' the base ground (writes depth; 25-100 m blocks on round numbers), 'top' the ground mesh's other layers
// (landuse, carriageways: large triangles), 'thin' pavements / paths / paint (built in pieces along their streets)
function buildOne(b, name, kind, mk) {
  const P = b.pos, LY = b.lay, base = kind === 'base';
  // ---- 1. the order: by real height, then by layer
  {
    const I = b.idx, nt = I.length / 3, key = new Float64Array(nt), ord = new Uint32Array(nt);
    for (let t = 0; t < nt; t++) { const a = I[t * 3], c = I[t * 3 + 1], e = I[t * 3 + 2]; key[t] = KEY(Math.max(P[a * 3 + 1], P[c * 3 + 1], P[e * 3 + 1]), LY ? LY[a] : 0); ord[t] = t; }
    ord.sort((p, q) => key[p] - key[q] || p - q);
    const J = new Array(I.length); for (let k = 0; k < nt; k++) { const t = ord[k] * 3; J[k * 3] = I[t]; J[k * 3 + 1] = I[t + 1]; J[k * 3 + 2] = I[t + 2]; }
    b.idx = J;
  }
  // ---- 2. the far level: as built, but (a) no side longer than 96 m, by halving (the base ground's blocks are at
  // most 100 m as built): a triangle belongs to ONE cell, whose level is decided by the distance to the nearest thing
  // it holds, and a cell that reaches far is cut finely from far away; (b) the base
  // ground's blocks, 25-100 m, meet at corners on a 25 m lattice: where one has a corner its neighbour's side is
  // given one (or the ground would open between blocks cut differently)
  const corners = new Set();
  if (base) for (let i = 0; i < b.n; i++) if (LY[i] < 0.5) corners.add(Math.round(P[i * 3] / 25) * 65536 + Math.round(P[i * 3 + 2] / 25));
  const diceHas = (x, z) => corners.has(Math.round(x / 25) * 65536 + Math.round(z / 25));
  const diceOf = base ? (i) => (LY[i] < 0.5 ? 25 : 0) : null;
  terrainSubdivide(b, 1, false, { tolOf: () => 1, gridOf: () => 0, maxOf: base ? () => 0 : () => 96, diceOf, diceHas });
  const src = b.idx, nsrc = src.length / 3, far = src, nfar = nsrc;       // (the near and mid cuts start from these)
  // ---- 3. cells
  const cellOf = new Int32Array(nsrc), cells = [], byKey = new Map();
  for (let t = 0; t < nsrc; t++) {
    const a = src[t * 3], c = src[t * 3 + 1], e = src[t * 3 + 2];
    const ix = Math.floor((P[a * 3] + P[c * 3] + P[e * 3]) / 3 / CELL), iz = Math.floor((P[a * 3 + 2] + P[c * 3 + 2] + P[e * 3 + 2]) / 3 / CELL), k = ix * 65536 + iz;
    let id = byKey.get(k); if (id === undefined) { id = cells.length; byKey.set(k, id); cells.push({ x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, diag: 0, tris: [], cut: [null, null], lv: 2, also: -1 }); }
    cellOf[t] = id; const cl = cells[id]; cl.tris.push(t);
    // (the box round the cell's triangles: the rings are measured to the nearest thing the cell holds)
    for (const v of [a, c, e]) { const x = P[v * 3], z = P[v * 3 + 2]; if (x < cl.x0) cl.x0 = x; if (x > cl.x1) cl.x1 = x; if (z < cl.z0) cl.z0 = z; if (z > cl.z1) cl.z1 = z; }
  }
  for (const cl of cells) cl.diag = Math.hypot(cl.x1 - cl.x0, cl.z1 - cl.z0);
  // ---- 4. geometry: the far level's vertices now, room for the near cuts when the ring first comes to this store
  const S = { name, kind, base, mid: kind !== 'thin', diceHas, cells, src: Uint32Array.from(src), cellOf, nStatic: b.n, cap: b.n, used: b.n, arrays: {}, attrs: {}, sets: [], sig: '', busy: 0, x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
  for (let i = 0; i < b.n; i++) { const x = P[i * 3], z = P[i * 3 + 2]; if (x < S.x0) S.x0 = x; if (x > S.x1) S.x1 = x; if (z < S.z0) S.z0 = z; if (z > S.z1) S.z1 = z; }
  for (const [an, bn, size] of ATTRS) { const A = b[bn]; if (!A) continue; S.arrays[an] = Float32Array.from(A); S.attrs[an] = new THREE.BufferAttribute(S.arrays[an], size); }
  // (a block corner at the world's origin, exactly 0, 0, 0: a micrometre up. The render audit, tools/audit_render.mjs, reads
  //  an exact zero vertex in a rewritten buffer as one that was never written, and that check is worth keeping whole)
  { const Y = S.arrays.position; for (let i = 0; i < b.n; i++) if (Y[i * 3] === 0 && Y[i * 3 + 1] === 0 && Y[i * 3 + 2] === 0) Y[i * 3 + 1] = 1e-6; }
  // per far triangle: its key (order) and its cell
  const fkey = new Float64Array(nfar), fcell = new Int32Array(nfar), fcls = new Uint8Array(nfar).fill(1);
  for (let k = 0; k < nfar; k++) { const a = src[k * 3], c = src[k * 3 + 1], e = src[k * 3 + 2]; fkey[k] = KEY(Math.max(P[a * 3 + 1], P[c * 3 + 1], P[e * 3 + 1]), LY ? LY[a] : 0); fcell[k] = cellOf[k]; }
  S.far = Uint32Array.from(far); S.fkey = fkey; S.fcell = fcell; S.fcls = fcls;
  {
    const g = new THREE.BufferGeometry();
    for (const an in S.attrs) g.setAttribute(an, S.attrs[an]);
    g.setIndex(new THREE.BufferAttribute(Uint32Array.from(far), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    S.sets.push({ cls: 1, geo: g, mesh: mk(g, base), nfar });
  }
  if (typeof process !== 'undefined' && process.env && process.env.GTO_TDEBUG) console.log('[stack]', name, kind, 'far', nfar, 'cells', cells.length);
  return S;
}

// one cell's cut at a level (0 near, 1 mid): its triangles as built, cut along that level's lattice, as arrays of their own
// How far a cut of the BASE ground stands over what should be seen there at its worst (metres; sampled every 2.5 m or
// so across each of its flat pieces): over the surveyed ground, or over the water where the ground is a river bed (a
// piece over the bed and under the water harms nothing). A piece that spans a hollow - a street between banks, a
// cutting - is a chord over it.
function overOf(N) {
  if (N.over !== undefined) return N.over;
  const F = TERRAIN.field, P = N.arrays.position, LA = N.arrays.aLayer, I = N.idx; let over = 0;
  if (F) for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2], deck = LA && LA[a] >= 0.5, ch = deck ? F.R : F.B;
    const ax = P[a * 3], az = P[a * 3 + 2], bx = P[b * 3], bz = P[b * 3 + 2], cx = P[c * 3], cz = P[c * 3 + 2];
    const ha = F.sample(ch, ax, az), hb = F.sample(ch, bx, bz), hc = F.sample(ch, cx, cz);
    const L = Math.max(Math.abs(bx - ax), Math.abs(bz - az), Math.abs(cx - ax), Math.abs(cz - az), Math.abs(cx - bx), Math.abs(cz - bz)), n = Math.min(12, Math.max(2, Math.ceil(L / 2.5)));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      if ((i === 0 || i === n) && (j === 0 || j === n - i) && (i + j === 0 || i + j === n)) continue;
      const u = i / n, v = j / n, w = 1 - u - v, x = w * ax + u * bx + v * cx, z = w * az + u * bz + v * cz;
      const d = w * ha + u * hb + v * hc - (deck ? F.sample(ch, x, z) : Math.max(F.sample(ch, x, z), F.sample(F.W, x, z)));
      if (d > over) over = d;
    }
  }
  return (N.over = over);
}
const sinkOf = (N) => Math.max(0.6, overOf(N) + 0.3);       // how far a coarser copy of the base ground is lowered

// The base ground's MIDDLE cut is refined where the tier's lattice would stand more than OVER_MID over the surface (a
// 25 m piece across Headington Road's cutting stood 1.15 m over the carriageway and hid it; what is built on the
// ground is pulled 1.1 m and more towards the eye from 60 m, world/terrain.js STACK, and has its own error): half the spacing, then
// the near lattice. The cut it replaces is kept as `fill` and drawn lowered beneath it: against a neighbour that was
// not refined the two do not meet edge to edge, and the fill is what shows through.
const OVER_MID = 0.5;
function cutCell(S, cell, level) {
  const N = cutAt(S, cell, gridFor(S, level));
  if (!S.base || level !== 1 || overOf(N) <= OVER_MID) return N;
  let R = N;
  for (const g of [TIER.midBase / 2, TIER.gridBase]) { if (g >= gridFor(S, 1) || g < TIER.gridBase) continue; R = cutAt(S, cell, g); if (overOf(R) <= OVER_MID) break; }
  if (R !== N) { R.fill = N; TERRAIN.lodRefined = (TERRAIN.lodRefined || 0) + 1; }
  return R;
}
function cutAt(S, cell, grid) {
  const A = S.arrays, remap = new Map(), m = { pos: [], nor: [], uv: [], idx: [], n: 0, cell: A.aCell ? [] : null, tint: A.aTint ? [] : null, col: A.color ? [] : null, lay: A.aLayer ? [] : null, edge: null, top: null, det: null, anc: null };
  const take = (i) => {
    let j = remap.get(i); if (j !== undefined) return j;
    j = m.n++; remap.set(i, j);
    m.pos.push(A.position[i * 3], A.position[i * 3 + 1], A.position[i * 3 + 2]); m.nor.push(A.normal[i * 3], A.normal[i * 3 + 1], A.normal[i * 3 + 2]); m.uv.push(A.uv[i * 2], A.uv[i * 2 + 1]);
    if (m.cell) m.cell.push(A.aCell[i * 4], A.aCell[i * 4 + 1], A.aCell[i * 4 + 2], A.aCell[i * 4 + 3]);
    if (m.tint) m.tint.push(A.aTint[i * 3], A.aTint[i * 3 + 1], A.aTint[i * 3 + 2]);
    if (m.col) m.col.push(A.color[i * 3], A.color[i * 3 + 1], A.color[i * 3 + 2]);
    if (m.lay) m.lay.push(A.aLayer[i]);
    return j;
  };
  const keys = [];
  for (const t of cell.tris) { const a = S.src[t * 3], c = S.src[t * 3 + 1], e = S.src[t * 3 + 2]; m.idx.push(take(a), take(c), take(e)); keys.push(KEY(Math.max(A.position[a * 3 + 1], A.position[c * 3 + 1], A.position[e * 3 + 1]), A.aLayer ? A.aLayer[a] : 0)); }
  const from = [];
  // (the base ground's blocks are 25 m squares on round numbers: their own lattices, 5 m and 25 m, on the same numbers)
  terrainSubdivide(m, 1, false, { tolOf: () => 1, gridOf: () => grid, zeroOf: S.base ? () => true : null, src: from, diceOf: S.base ? (i) => (m.lay[i] < 0.5 ? 25 : 0) : null, diceHas: S.diceHas });
  const nt = m.idx.length / 3, key = new Float64Array(nt), cls = new Uint8Array(nt).fill(1);
  for (let k = 0; k < nt; k++) key[k] = keys[from[k]];
  const out = { n: m.n, idx: Uint32Array.from(m.idx), key, cls, arrays: {} };
  for (const [an, bn] of ATTRS) if (A[an]) out.arrays[an] = Float32Array.from(m[bn]);
  { const Y = out.arrays.position; for (let i = 0; i < out.n; i++) if (Y[i * 3] === 0 && Y[i * 3 + 1] === 0 && Y[i * 3 + 2] === 0) Y[i * 3 + 1] = 1e-6; }      // (as in buildOne: no vertex at exactly 0, 0, 0)
  return out;
}

/**
 * Move the ring: (x, z) = the camera. Cuts at most `budget` new cells a call (the rest keep their far cut until their
 * turn; but a cell that comes within 30 m of the camera uncut - after a teleport - is cut at once: uncut ground that
 * close can stand a metre off the surface and cover the road), and rebuilds the index buffers of a store only when its set of near cells has changed.
 */
// (cells cut per call. In the browser four, so that no frame pays for more; in node - the tests - all of them at once:
//  a test then sees the finished rings whenever it looks, and what it counts does not depend on how many frames it
//  happened to run. GTO_TBUDGET=n sets it by hand)
const NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node), ENVB = +(NODE && process.env && process.env.GTO_TBUDGET) || 0;
const BUDGET = ENVB || (NODE ? 1e9 : 4);
export function updateStacks(stores, x, z, budget = BUDGET) {
  // (the rings are looked at again when the camera has gone 8 m, or while cells still wait for their cut)
  // (the state is the batcher's own: the centre and East Oxford each call this with their stores)
  const st = stores.lod || (stores.lod = { x: 1e9, z: 1e9, pending: true, gen: ringGen });
  if (st.gen !== ringGen) { st.gen = ringGen; st.pending = true; for (const S of stores) { for (const c of S.cells) { c.cut[0] = c.cut[1] = null; } } }      // (another tier: other lattices, the cuts are made again)
  if (!st.pending && Math.abs(x - st.x) < 8 && Math.abs(z - st.z) < 8) return 0;
  st.x = x; st.z = z; st.pending = false;
  let cut = 0, rebuilt = 0;
  const R1 = RING[1] + 3 * CELL;
  for (const S of stores) {
    if ((x < S.x0 - R1 || x > S.x1 + R1 || z < S.z0 - R1 || z > S.z1 + R1) && S.sig === '') continue;
    let sig = '', wait = false;
    for (let i = 0; i < S.cells.length; i++) {
      const c = S.cells[i], d = Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.z0 - z, 0, z - c.z1));
      // the level wanted here, and the coarser one drawn with it where a neighbour may be at that coarser level (any
      // cell whose far side reaches the ring's edge)
      // (a neighbour touches this cell's box, so it is no farther off than the box's farthest corner)
      const dmax = Math.hypot(Math.max(x - c.x0, c.x1 - x), Math.max(z - c.z0, c.z1 - z));
      let lv = d < RING[0] ? 0 : S.mid && d < RING[1] ? 1 : 2, also = -1;
      if (lv === 0 && dmax > RING[0]) also = S.mid ? 1 : 2; else if (lv === 1 && dmax > RING[1]) also = 2;
      // (a cut not made yet: its turn comes; until then the next coarser that exists)
      for (const q of [lv, also]) if (q === 0 || q === 1) { if (!c.cut[q]) { if (cut < budget || (q === 0 && d < MUST) || (S.base && lv === 0 && q === 1)) { c.cut[q] = cutCell(S, c, q); cut++; } else wait = true; } }
      if (lv === 0 && !c.cut[0]) { lv = c.cut[1] ? 1 : 2; also = -1; } else if (lv === 1 && !c.cut[1]) { lv = 2; also = -1; }
      if (also === 1 && !c.cut[1]) also = 2;
      c.lv = lv; c.also = also;
      // (a cut is kept while the camera is about; three cells beyond its ring it is let go, and made again on return)
      if (c.cut[0] && d > RING[0] + 3 * CELL) c.cut[0] = null;
      if (c.cut[1] && d > RING[1] + 4 * CELL) c.cut[1] = null;
      if (lv !== 2 || also !== -1) sig += i + ':' + lv + also + ',';
    }
    S.busy = wait ? 1 : 0; if (wait) st.pending = true;
    if (sig === S.sig) continue;
    S.sig = sig; rebuilt++;
    // ---- the pool: every near cell's vertices after the static ones
    // (in the band where two rings meet a cell is drawn at both levels, so that no gap opens between it and its coarser
    //  neighbour; the coarser copy of its base ground lies lower, by 0.6 m or by what it stands over the surface and 0.3 m
    //  more: it shows through a gap and never over the finer one)
    const live = [], low = [];
    for (const c of S.cells) {
      if (c.lv < 2) { const N = c.cut[c.lv]; live.push(N); low.push(0); if (N.fill) { live.push(N.fill); low.push(sinkOf(N.fill)); } }
      if (c.also === 0 || c.also === 1) { const N = c.cut[c.also]; live.push(N); low.push(S.base ? sinkOf(N) : 0.6); }
    }
    let need = S.nStatic; for (const N of live) need += N.n;
    if (need > S.cap) {
      S.cap = Math.ceil(need * 1.5) + 2000;
      for (const an in S.attrs) {
        const old = S.attrs[an], arr = new Float32Array(S.cap * old.itemSize); arr.set(S.arrays[an].subarray(0, S.nStatic * old.itemSize));
        S.arrays[an] = arr; const at = new THREE.BufferAttribute(arr, old.itemSize); at.setUsage(THREE.DynamicDrawUsage); S.attrs[an] = at;
        for (const set of S.sets) set.geo.setAttribute(an, at);
      }
    }
    let p = S.nStatic; const near = [];
    for (let q = 0; q < live.length; q++) {
      const N = live[q];
      for (const an in S.attrs) S.arrays[an].set(N.arrays[an], p * S.attrs[an].itemSize);
      if (low[q] && S.base) { const Y = S.arrays.position; for (let v = 0; v < N.n; v++) Y[(p + v) * 3 + 1] -= low[q]; }      // (the base ground only: the layers above write no depth, two copies of them cannot hide one another)
      // (and the coarser copy of a layer is drawn just before the finer copy of the same layer: where they differ the finer is on top)
      const kd = low[q] ? 0.5 : 0;
      for (let k = 0; k < N.key.length; k++) near.push([N.key[k] - kd, N.cls[k], N.idx[k * 3] + p, N.idx[k * 3 + 1] + p, N.idx[k * 3 + 2] + p]);
      p += N.n;
    }
    for (const an in S.attrs) { const at = S.attrs[an]; if (p > S.nStatic) { at.clearUpdateRanges(); at.addUpdateRange(S.nStatic * at.itemSize, (p - S.nStatic) * at.itemSize); at.needsUpdate = true; } }
    S.used = p;
    near.sort((a, b) => a[0] - b[0]);
    // ---- the index buffers: far triangles of the cells still drawn far, and the near ones, merged in the one order
    for (const set of S.sets) {
      const farOn = (k) => { const c = S.cells[S.fcell[k]]; return c.lv === 2 || c.also === 2; };
      let cnt = 0;
      for (let k = 0; k < S.fkey.length; k++) if (S.fcls[k] === set.cls && farOn(k)) cnt++;
      for (const q of near) if (q[1] === set.cls) cnt++;
      // (one index buffer with room to spare, rewritten in place and drawn as far as it is filled; a new, larger one
      //  only when it is outgrown: a buffer cannot be resized, and one made per rebuild would never be freed)
      let ia = set.geo.index;
      if (!set.dyn || ia.count < cnt * 3) { ia = new THREE.BufferAttribute(new Uint32Array(Math.ceil(cnt * 3 * 1.4) + 6000), 1); ia.setUsage(THREE.DynamicDrawUsage); set.geo.setIndex(ia); set.dyn = true; }
      const I = ia.array; let o = 0, j = 0;
      const nn = near.length;
      for (let k = 0; k < S.fkey.length; k++) {
        if (S.fcls[k] !== set.cls || !farOn(k)) continue;
        const fk = S.fkey[k];
        while (j < nn && near[j][0] < fk) { const q = near[j++]; if (q[1] === set.cls) { I[o++] = q[2]; I[o++] = q[3]; I[o++] = q[4]; } }
        I[o++] = S.far[k * 3]; I[o++] = S.far[k * 3 + 1]; I[o++] = S.far[k * 3 + 2];
      }
      while (j < nn) { const q = near[j++]; if (q[1] === set.cls) { I[o++] = q[2]; I[o++] = q[3]; I[o++] = q[4]; } }
      set.geo.setDrawRange(0, o); ia.clearUpdateRanges(); ia.addUpdateRange(0, o); ia.needsUpdate = true; set.tris = o / 3;
    }
  }
  if (rebuilt) { const by = {}; for (const S of stores) for (const set of S.sets) { const k = S.name + (S.base ? ':base' : ''), q = by[k] || (by[k] = [0, 0]); q[0] += set.nfar; q[1] += set.tris === undefined ? set.nfar : set.tris; } TERRAIN.lodTris = by; }
  if (rebuilt && typeof process !== 'undefined' && process.env && process.env.GTO_TDEBUG && !st.pending) console.log('[lod]', x.toFixed(0), z.toFixed(0), Object.entries(TERRAIN.lodTris).map(([k, v]) => k + ' ' + v[0] + '->' + v[1]).join('  '));
  TERRAIN.lod = { cut: (TERRAIN.lod ? TERRAIN.lod.cut : 0) + cut, rebuilt: (TERRAIN.lod ? TERRAIN.lod.rebuilt : 0) + rebuilt };
  return cut + rebuilt;
}
