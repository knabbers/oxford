// Walls (college stone, brick, the city wall), hedges, fences and railings, with openings + gateposts + an open iron
// gate wherever a gate node sits on the line.
// Graphics pass 7: front-garden walls and hedges are low. The map gives nearly every wall the same default height
// (2.6 m), which hid the ground floors, bays and doors of the north Oxford and Jericho houses: the stretch of a garden
// wall or hedge that runs within a front garden's depth of a street, by a house, is 0.95-1.25 m (hedges ~1.2 m), the
// rest of that wall at most ~2 m; where a house door looks at its front wall there is a closed boarded garden gate
// (collision still treats the line as solid, so a gate you cannot walk through is the consistent picture).
// Paid for inside the same tiles: the top face of a wall under its coping is no longer drawn, low walls have no
// separate coping, a capped gatepost has no top (GeoBuf.saved7 / spent7).
import { FACADE_CELLS as F, HEDGE_CELL } from './textures.js';
import { WIN } from './facadedetail.js';
import { flatRibbon, sideStrip, wallQuad, pointAt, polylineLength, slicePolyline, cleanLine, distToSeg, SpatialGrid, hash01, orientedBox, pointInPoly, polyBounds } from './util.js';
import { railingStrip } from './roads.js';

const GATE_KINDS = new Set(['gate', 'lift_gate', 'kissing_gate', 'swing_gate', 'door', 'turnstile', 'cycle_barrier', 'ticket_barrier', 'entrance']);
const GAP = 1.6; // half-width of an opening

/** Solid wall along pts (centreline offset by opts.offset), y0..y1, thickness t, with top and end caps. */
export function thickWall(buf, pts, y0, y1, t, opts = {}) {
  const o = opts.offset || 0, su = opts.uScale || 3, sv = opts.vScale || 3;
  if (pts.length < 2) return;
  sideStrip(buf, pts, o + t / 2, y0, y1, 1, su, sv);
  sideStrip(buf, pts, o - t / 2, y0, y1, -1, su, sv);
  if (opts.top !== false) flatRibbon(buf, pts, o + t / 2, o - t / 2, y1, su, 'along');
  if (opts.caps !== false) for (const end of [0, 1]) {
    if (end ? opts.capB === false : opts.capA === false) continue;
    const P = pointAt(pts, end ? polylineLength(pts) : 0), lx = -P.dz, lz = P.dx, tx = end ? P.dx : -P.dx, tz = end ? P.dz : -P.dz;
    wallQuad(buf, P.x + lx * (o + t / 2), P.z + lz * (o + t / 2), P.x + lx * (o - t / 2), P.z + lz * (o - t / 2), y0, y1, tx, tz, 0, t / su, y0 / sv, y1 / sv);
  }
}

const STREET_KINDS = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street']);
const FRONT = 8.5;        // a wall this close (m) to a street's edge is in a front garden
const GATE_HW = 0.5;      // half-width of a garden gate

/**
 * Plan every barrier (pass 7; runs after planBuildings, before the buildings are emitted): gate openings, style,
 * and for garden walls / hedges the low and normal stretches. Books what the new emitters save against pass 6 into the
 * barrier's facade tile (GeoBuf.saved7), which the quad-facing walls (buildings.js) and the garden gates then spend.
 */
export function planBarriers(ctx) {
  const { map, batch, ov } = ctx;
  const gates = new SpatialGrid(30);
  for (const g of map.gates) if (GATE_KINDS.has(g.kind) && !ov.skip.has(g.id)) gates.insertPoint(g.p[0], g.p[1], g);
  const colleges = map.sites.filter((s) => s.kind === 'university').map((s) => ({ s, bb: polyBounds(s.poly) }));
  // photo comparison item 19: plank fences stood where the real boundary is an iron railing (Magdalen's and the Botanic
  // Garden's on the High, the approach to Magdalen Bridge). A fence inside any named site (college, school, garden) or
  // along a main road is drawn as railings; close-board stays for back gardens and yards.
  const anySite = map.sites.map((s) => ({ s, bb: polyBounds(s.poly) }));
  const MAIN = new Set(['primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link']);
  const byMainRoad = (x, z) => { let hit = false; ctx.roadGrid.queryRadius(x, z, 20, (it) => { if (MAIN.has(it.kind) && distToSeg(x, z, it.ax, it.az, it.bx, it.bz) - it.w / 2 < 9) { hit = true; return true; } }); return hit; };
  const roadGap = (x, z) => { let d = 99; ctx.roadGrid.queryRadius(x, z, 16, (it) => { if (!STREET_KINDS.has(it.kind)) return; const q = distToSeg(x, z, it.ax, it.az, it.bx, it.bz) - it.w / 2; if (q < d) d = q; }); return d; };
  const houseNear = (x, z) => {
    let hit = false;
    ctx.buildingGrid.queryRadius(x, z, 13, (r) => {
      if (!r.pl || !(r.pl.sty.dwelling || (r.pl.sty.house && r.pl.sty.bt === 'residential')) || r.pl.small) return;
      const q = r.b.poly; for (let i = 0; i < q.length; i++) { const a = q[i], c = q[(i + 1) % q.length]; if (distToSeg(x, z, a[0], a[1], c[0], c[1]) < 13) { hit = true; return true; } }
    });
    return hit;
  };
  const plan = [], st = { low: 0, lowM: 0, saved: 0 }, deferred = [];
  // Boundaries mapped twice (z-fighting pass, 2026-11): where a wall or a hedge runs along another of its own kind —
  // two records of one boundary, a retaining wall mapped inside the wall above it, two hedges that share a stretch —
  // both were built in the same planes (both faces and the top; no depth hair tells two walls of one texture apart):
  // 600 m of them. Along such a stretch only one is built now: the taller, else the one with the smaller id; the other
  // is cut there as it is at a gate (twinCut: its arc-length intervals). Collision (core/mapcollision.js) is unchanged.
  const twinCut = new Map();
  {
    const SOLID = { wall: 1, retaining_wall: 1, city_wall: 1, hedge: 2 }, G2 = new SpatialGrid(30), recs = [];
    for (const b of map.barriers) {
      if (ov.skip.has(b.id) || !SOLID[b.kind]) continue;
      const pts = cleanLine(b.pts, 0.05); if (pts.length < 2) continue;
      const r = { b, pts, L: polylineLength(pts), cov: [] }; recs.push(r);
      for (let i = 0; i < pts.length - 1; i++) G2.insertSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], { r, i });
    }
    const seen = new Set();
    for (const r of recs) for (let i = 0, acc = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], c = r.pts[i + 1], l = Math.hypot(c[0] - a[0], c[1] - a[1]), at = acc; acc += l; if (l < 0.2) continue;
      const ux = (c[0] - a[0]) / l, uz = (c[1] - a[1]) / l; seen.clear();
      G2.query(Math.min(a[0], c[0]) - 0.1, Math.min(a[1], c[1]) - 0.1, Math.max(a[0], c[0]) + 0.1, Math.max(a[1], c[1]) + 0.1, (it) => {
        const o = it.r; if (o === r || SOLID[o.b.kind] !== SOLID[r.b.kind] || seen.has(it)) return; seen.add(it);
        const p = o.pts[it.i], q = o.pts[it.i + 1];
        if (Math.abs((p[0] - a[0]) * uz - (p[1] - a[1]) * ux) > 0.05 || Math.abs((q[0] - a[0]) * uz - (q[1] - a[1]) * ux) > 0.05) return;
        const t0 = (p[0] - a[0]) * ux + (p[1] - a[1]) * uz, t1 = (q[0] - a[0]) * ux + (q[1] - a[1]) * uz, len = Math.min(l, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
        if (len < 0.3) return;
        // (who is built along this stretch: the taller; of two of one height, the smaller id)
        const hr = r.b.h || 2, ho = o.b.h || 2;
        if (hr < ho - 0.01 || (Math.abs(hr - ho) <= 0.01 && r.b.id > o.b.id)) r.cov.push([at + Math.max(0, Math.min(t0, t1)), at + Math.min(l, Math.max(t0, t1))]);
      });
    }
    let cutM = 0;
    for (const r of recs) if (r.cov.length) { twinCut.set(r.b.id, r.cov); for (const q of r.cov) cutM += q[1] - q[0]; }
    ctx.stats.twinBarriers = twinCut.size; ctx.stats.twinBarrierM = Math.round(cutM);
  }
  for (const b of map.barriers) {
    if (ov.skip.has(b.id)) continue;
    const pts = cleanLine(b.pts, 0.05); if (pts.length < 2) continue;
    const L = polylineLength(pts); if (L < 0.3) continue;
    const mid = pointAt(pts, L / 2), hv = hash01(b.id);
    // gate openings along the line
    const cuts = [];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], c = pts[i + 1], l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      gates.query(Math.min(a[0], c[0]) - 1.5, Math.min(a[1], c[1]) - 1.5, Math.max(a[0], c[0]) + 1.5, Math.max(a[1], c[1]) + 1.5, (g) => {
        if (distToSeg(g.p[0], g.p[1], a[0], a[1], c[0], c[1]) > 1.2) return;
        const t = l > 0 ? ((g.p[0] - a[0]) * (c[0] - a[0]) + (g.p[1] - a[1]) * (c[1] - a[1])) / (l * l) : 0;
        const s = acc + Math.max(0, Math.min(1, t)) * l;
        if (!cuts.some((x) => Math.abs(x.s - s) < GAP * 2)) cuts.push({ s, g });
      });
      acc += l;
    }
    cuts.sort((x, y) => x.s - y.s);
    const ivs = []; let s0 = 0;
    for (const c of cuts) { if (c.s - GAP > s0) ivs.push([s0, c.s - GAP]); s0 = c.s + GAP; }
    if (s0 < L) ivs.push([s0, L]);
    // (the stretches where another boundary of this kind is built in its place: see twinCut)
    { const tc = twinCut.get(b.id); if (tc) for (const [c0, c1] of tc) for (let k = ivs.length - 1; k >= 0; k--) {
      const [i0, i1] = ivs[k]; if (c1 <= i0 || c0 >= i1) continue;
      const rest = []; if (c0 - i0 > 0.3) rest.push([i0, c0]); if (i1 - c1 > 0.3) rest.push([c1, i1]);
      ivs.splice(k, 1, ...rest);
    } }

    const kind = b.kind, h = Math.max(0.6, Math.min(kind === 'city_wall' ? 8 : 4.5, b.h || 2));
    const zone = ctx.zoneAt(mid.x, mid.z);
    const inCollege = colleges.some(({ s, bb }) => mid.x >= bb.minX && mid.x <= bb.maxX && mid.z >= bb.minZ && mid.z <= bb.maxZ && pointInPoly(mid.x, mid.z, s.poly));
    let style;
    if (kind === 'hedge') style = 'hedge';
    else if (kind === 'fence') {
      const sited = inCollege || anySite.some(({ s, bb }) => mid.x >= bb.minX && mid.x <= bb.maxX && mid.z >= bb.minZ && mid.z <= bb.maxZ && pointInPoly(mid.x, mid.z, s.poly));
      style = b.material === 'metal' || zone === 'centre' || sited || (b.material !== 'wood' && (byMainRoad(mid.x, mid.z) || byMainRoad(pts[0][0], pts[0][1]))) ? 'railing' : b.material === 'wood' || hv < 0.75 ? 'woodfence' : 'railing';
    }
    else if (kind === 'railing' || kind === 'guard_rail') style = 'railing';
    else if (b.material === 'brick' || (!inCollege && kind === 'wall' && (zone === 'north' || zone === 'jericho' || zone === 'east' || zone === 'west' || zone === 'south') && hv < 0.7)) style = 'brick';
    else style = 'stone';
    const solid = style === 'stone' || style === 'brick', buf = solid || style === 'hedge' ? batch.buf('facade', mid.x, mid.z) : null;
    // garden walls and hedges at the map's default height (a mapped height is respected)
    const garden = !inCollege && zone !== 'centre' && ((kind === 'wall' && Math.abs((b.h || 0) - 2.6) < 0.01) || (kind === 'hedge' && Math.abs((b.h || 0) - 1.8) < 0.01));
    const hLow = kind === 'hedge' ? 1.1 + 0.25 * hv : 0.95 + 0.3 * hv, hCap = kind === 'hedge' ? h : Math.min(h, 1.9 + 0.25 * hv);
    const quads = (m, low) => (style === 'hedge' || kind === 'city_wall' ? 3 * m + 2 : low ? 3 * m + 2 : 5 * m + 4);   // what the pass-7 emitter draws
    const pieces = [];
    for (const [a0, a1] of ivs) {
      const seg = a0 <= 0 && a1 >= L ? pts : slicePolyline(pts, a0, a1);
      if (seg.length < 2) continue;
      const m = seg.length - 1, old = style === 'hedge' || kind === 'city_wall' ? 3 * m + 2 : 6 * m + 4;
      if (!buf) { pieces.push([[{ seg, h, low: false }]]); continue; }
      let out = null;
      if (garden) {
        // per vertex: how far from a street; a stretch is low while it stays within a front garden's depth of one
        const dR = seg.map((p) => roadGap(p[0], p[1])), cls = [], cut = [];
        let lowLen = 0, len = 0;
        for (let i = 0; i < m; i++) {
          const l = Math.hypot(seg[i + 1][0] - seg[i][0], seg[i + 1][1] - seg[i][1]), n0 = dR[i] < FRONT, n1 = dR[i + 1] < FRONT;
          len += l;
          if (n0 && n1) { cls.push(1); cut.push(-1); lowLen += l; }
          else if (!n0 && !n1) { cls.push(0); cut.push(-1); }
          else { const t = (FRONT - dR[i]) / (dR[i + 1] - dR[i]), ll = n0 ? l * t : l * (1 - t); if (ll > l - 3) { cls.push(1); cut.push(-1); lowLen += l; } else if (ll < 1.5) { cls.push(0); cut.push(-1); } else { cls.push(n0 ? 2 : 3); cut.push(t); lowLen += ll; } }
        }
        const mp = pointAt(seg, len / 2);
        if (lowLen > 1.5 && (houseNear(mp.x, mp.z) || houseNear(seg[0][0], seg[0][1]) || houseNear(seg[m][0], seg[m][1]))) {
          // build the low / normal runs (a mixed segment is split where it leaves the front garden)
          const runs = []; let cur = null;
          const add = (A, B, low) => { if (cur && cur.low === low) cur.seg.push(B); else { cur = { seg: [A, B], h: low ? hLow : hCap, low }; runs.push(cur); } };
          for (let i = 0; i < m; i++) {
            const A = seg[i], B = seg[i + 1], k = cls[i];
            if (k < 2) add(A, B, k === 1);
            else { const X = [A[0] + (B[0] - A[0]) * cut[i], A[1] + (B[1] - A[1]) * cut[i]]; add(A, X, k === 2); add(X, B, k !== 2); }
          }
          for (const r of runs) r.seg = cleanLine(r.seg, 0.05);
          out = runs.filter((r) => r.seg.length >= 2);
          let nq = 0; for (const r of out) nq += quads(r.seg.length - 1, r.low);
          // a stepped wall that needs more triangles than pass 6 drew for it (a short low front, a long side wall) waits
          // until every other barrier has booked its savings: it is built stepped if its tile can then pay the
          // difference, else at one height for the whole stretch
          if (nq > old) { const one = [{ seg, h: lowLen > len * 0.5 ? hLow : hCap, low: lowLen > len * 0.5 }], slot = [one]; deferred.push({ buf, slot, runs: out, old, nq, quads, solid }); pieces.push(slot); continue; }
        }
      }
      if (!out) out = [{ seg, h, low: false }];
      let nq = 0; for (const r of out) nq += quads(r.seg.length - 1, r.low && solid);
      buf.saved7 += (old - nq) * 2; st.saved += (old - nq) * 2;
      pieces.push([out]);
    }
    // a capped stone gatepost has no top face of its own (hidden by the cap)
    if (style === 'stone' && h > 1.5) for (const c of cuts) if (c.s >= 0.5 && c.s <= L - 0.5) { const P = pointAt(pts, c.s), pb = batch.buf('facade', P.x, P.z); pb.saved7 += 4; st.saved += 4; }
    plan.push({ b, pts, L, mid, hv, cuts, kind, h, style, pieces, solid, quads });
  }
  for (const d of deferred) {
    const extra = (d.nq - d.old) * 2;
    if (d.buf.saved7 - d.buf.spent7 >= extra) { d.buf.spent7 += extra; d.slot[0] = d.runs; st.stepped = (st.stepped || 0) + 1; }
    else { const q = d.slot[0][0], nq = d.quads(q.seg.length - 1, q.low && d.solid); d.buf.saved7 += (d.old - nq) * 2; st.saved += (d.old - nq) * 2; }
  }
  for (const bp of plan) { bp.pieces = bp.pieces.flatMap((sl) => sl[0]); for (const r of bp.pieces) if (r.low) { st.low++; st.lowM += polylineLength(r.seg); } }
  ctx.barrierPlan = plan;
  ctx.stats.pass7 = { lowWalls: st.low, lowWallMetres: Math.round(st.lowM), steppedWalls: st.stepped || 0, barrierSavedTris: st.saved };
}

export function buildBarriers(ctx) {
  const { batch } = ctx;
  if (!ctx.barrierPlan) planBarriers(ctx);
  // ---- garden gates: every house door that looks at a low front wall within a front garden's depth gets a gate in it
  const gateAt = new Map();   // piece -> [{s, seed}]
  {
    const lowGrid = new SpatialGrid(30);
    for (const bp of ctx.barrierPlan) if (bp.style === 'stone' || bp.style === 'brick') for (const pc of bp.pieces) if (pc.low) for (let i = 0; i < pc.seg.length - 1; i++) lowGrid.insertSeg(pc.seg[i][0], pc.seg[i][1], pc.seg[i + 1][0], pc.seg[i + 1][1], { pc, i });
    for (const rec of ctx.buildingRecs || []) {
      const res = rec.res; if (!res || !res.hasGround || res.small) continue;
      for (const E of res.edges) {
        const P = E.plan; if (!E.street || !P || !P.ground || (P.kind !== 'house' && P.kind !== 'town')) continue;
        const bw = E.len / P.bays;
        for (let bi = 0; bi < P.bays; bi++) {
          const sp = WIN[P.ground[bi]]; if (!sp || !sp.door) continue;
          const dx0 = E.lx + E.rx * (bi + 0.5) * bw, dz0 = E.lz + E.rz * (bi + 0.5) * bw;
          let best = null, bt = 10.5;
          lowGrid.queryRadius(dx0 + E.nx * 5, dz0 + E.nz * 5, 6.5, (it) => {
            const A = it.pc.seg[it.i], B = it.pc.seg[it.i + 1], ex = B[0] - A[0], ez = B[1] - A[1], den = E.nx * ez - E.nz * ex;
            if (Math.abs(den) < 0.3 * Math.hypot(ex, ez)) return;                       // the path from the door must cross the wall, not graze it
            const t = ((A[0] - dx0) * ez - (A[1] - dz0) * ex) / den, u = ((A[0] - dx0) * E.nz - (A[1] - dz0) * E.nx) / den, l = Math.hypot(ex, ez);
            if (t < 0.8 || t >= bt || u * l < 0.9 || (1 - u) * l < 0.9) return;
            bt = t; best = { it, u };
          });
          if (!best) continue;
          const pc = best.it.pc; let s = 0; for (let k = 0; k < best.it.i; k++) s += Math.hypot(pc.seg[k + 1][0] - pc.seg[k][0], pc.seg[k + 1][1] - pc.seg[k][1]);
          s += best.u * Math.hypot(pc.seg[best.it.i + 1][0] - pc.seg[best.it.i][0], pc.seg[best.it.i + 1][1] - pc.seg[best.it.i][1]);
          let arr = gateAt.get(pc); if (!arr) gateAt.set(pc, (arr = []));
          if (!arr.some((g) => Math.abs(g.s - s) < 2.6)) arr.push({ s, seed: 1 + (Math.floor(hash01(res.id + 'gate' + bi) * 900) | 0) });
        }
      }
    }
  }
  let nGates = 0, noBudget = 0, spent = 0;
  for (const bp of ctx.barrierPlan) {
    const { b, pts, L, mid, hv, cuts, kind, h, style } = bp;
    for (const pc of bp.pieces) {
      const seg = pc.seg, ph = pc.h;
      if (style === 'stone' || style === 'brick') {
        const buf = batch.buf('facade', mid.x, mid.z);
        const t = kind === 'city_wall' ? 1.6 : kind === 'retaining_wall' ? 0.5 : pc.low ? 0.34 : 0.42;
        // stone pass (2026-11): the city wall and most boundary walls are coursed rubble (photo comparison items 3 and
        // 19: New College Lane, St John's, Carfax, the castle); a quarter stay ashlar (dressed walls in front of houses)
        const rub = kind === 'city_wall' || kind === 'retaining_wall' || hv < 0.75 || b.rubble === true;   // (b.rubble: a place module's preMap says so — places/_worcester_street.js)
        const body = () => { if (style === 'stone') buf.setCell(rub ? F.stoneRubble : F.stoneBlank).setTint(kind === 'city_wall' ? [0.86, 0.84, 0.8] : rub ? [0.92 + hv * 0.12, 0.91 + hv * 0.08, 0.88 + hv * 0.02] : [0.94 + hv * 0.08, 0.92 + hv * 0.06, 0.86]); else buf.setCell(F.brickBlank).setTint(hv < 0.5 ? [1, 0.78, 0.72] : [0.9, 0.7, 0.62]); };
        const wopt = { uScale: style === 'stone' ? 3.2 : 2.6, vScale: style === 'stone' ? 3.2 : 2.9 };
        buf.setDetail(kind !== 'city_wall');
        if (pc.low) {
          // low front-garden wall: no separate coping; a closed boarded gate where a house door looks at it
          const PL = polylineLength(seg), gs = (gateAt.get(pc) || []).filter((g) => g.s > GATE_HW + 0.5 && g.s < PL - GATE_HW - 0.5).sort((x, y) => x.s - y.s), ok = [];
          for (const g of gs) { if (buf.saved7 - buf.spent7 >= 14) { buf.spent7 += 14; spent += 14; ok.push(g); } else noBudget++; }
          buf.setTop(); body();
          let s0 = 0;
          for (let k = 0; k <= ok.length; k++) {
            const s1 = k < ok.length ? ok[k].s - GATE_HW : PL, part = s0 <= 0 && s1 >= PL ? seg : slicePolyline(seg, s0, s1);
            if (part.length >= 2) thickWall(buf, part, -0.05, ph, t, wopt);
            if (k < ok.length) s0 = ok[k].s + GATE_HW;
          }
          for (const g of ok) {
            const P = pointAt(seg, g.s), x0 = P.x - P.dx * GATE_HW, z0 = P.z - P.dz * GATE_HW, x1 = P.x + P.dx * GATE_HW, z1 = P.z + P.dz * GATE_HW, gh = Math.max(0.8, ph - 0.06);
            buf.setCell(F.gardenGate, F.gardenGate, -1, g.seed).setTint(1, 1, 1);
            wallQuad(buf, x0, z0, x1, z1, 0.06, gh, -P.dz, P.dx, 0, 1, 0, 1);
            wallQuad(buf, x0, z0, x1, z1, 0.06, gh, P.dz, -P.dx, 1, 0, 0, 1);
            nGates++;
          }
        } else {
          buf.setTop(ph); body();
          // pass 7: the top of the wall is hidden under its coping — not drawn (the city wall has no coping and keeps it)
          thickWall(buf, seg, -0.05, ph, t, { ...wopt, top: kind === 'city_wall' });
          buf.setTop();
          // coping
          buf.setTint(1.05, 1.03, 1.0);
          if (kind !== 'city_wall') thickWall(buf, seg, ph, ph + 0.12, t + 0.1, { uScale: 3.2, vScale: 3.2 });
        }
        buf.setDetail(false);
      } else if (style === 'hedge') {
        // hedges live in the city atlas (one draw with the buildings); near tiles only
        const buf = batch.buf('facade', mid.x, mid.z);
        buf.setDetail(true).setCell(HEDGE_CELL).setTint(0.92 + hv * 0.16, 0.95 + hv * 0.1, 0.9);
        thickWall(buf, seg, 0, ph, pc.low ? 0.75 : 0.9, { uScale: 2, vScale: 2 });
        buf.setDetail(false);
      } else {
        const buf = batch.buf('fence', mid.x, mid.z);
        const hh = kind === 'guard_rail' ? 0.9 : Math.min(h, 2.2);
        railingStrip(buf, seg, 0, 0, hh, style === 'railing' ? [0.52, 0.98] : [0.02, 0.48]);
      }
    }
    // gateposts + open gate at each opening
    for (const c of cuts) {
      if (c.s < 0.5 || c.s > L - 0.5) continue;
      const P = pointAt(pts, c.s), lx = -P.dz, lz = P.dx;
      const ph = style === 'hedge' || style === 'woodfence' ? Math.min(h + 0.1, 1.6) : h + 0.35;
      const pbuf = batch.buf('facade', P.x, P.z);
      pbuf.setDetail(true).setCell(style === 'brick' ? F.brickBlank : F.stoneBlank).setTint(1.02, 1, 0.95);
      for (const sgn of [-1, 1]) {
        const x = P.x + P.dx * sgn * (GAP + 0.1), z = P.z + P.dz * sgn * (GAP + 0.1);
        const ps = style === 'stone' || style === 'brick' ? 0.32 : 0.12, capped = style === 'stone' && h > 1.5;
        orientedBox(pbuf, x, z, P.dx, P.dz, ps, ps, -0.05, ph, { uvScale: 3.2, top: !capped });
        if (capped) orientedBox(pbuf, x, z, P.dx, P.dz, ps + 0.06, ps + 0.06, ph, ph + 0.18, { uvScale: 3.2 });
      }
      pbuf.setDetail(false);
      if (c.g.kind === 'gate' || c.g.kind === 'swing_gate' || c.g.kind === 'kissing_gate') {
        // open iron gate leaf hinged at one post, swung ~70°
        const hx = P.x - P.dx * GAP, hz = P.z - P.dz * GAP, ang = 1.2 * (hash01(c.g.id) < 0.5 ? 1 : -1);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const dx = P.dx * ca - lx * sa, dz = P.dz * ca - lz * sa;
        const leaf = [[hx, hz], [hx + dx * 1.45, hz + dz * 1.45]];
        railingStrip(batch.buf('fence', hx, hz), leaf, 0, 0.05, Math.min(2.2, Math.max(1.1, h)), [0.52, 0.98]);
      }
    }
  }
  Object.assign(ctx.stats.pass7, { gardenGates: nGates, gatesNoBudget: noBudget, gateSpentTris: spent });
}
