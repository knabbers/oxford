// Base ground and landuse areas (grass, parks, pitches, woods, parking, paved squares, flowerbeds...).
// Layer heights (metres) — see docs/WORLD_API.md. Each layer also has its own polygonOffset so they never z-fight.
import { GROUND_CELLS as G, GROUND_SCALE as GS, setGroundCell } from './textures.js';
import { flatPoly, obb, pointInPoly, polyCentroid, cleanRing, hash01, polyBounds } from './util.js';

export const Y = {
  base: 0.0, area0: 0.01, area1: 0.02, area2: 0.03, water: 0.035, road: 0.04, path: 0.045, marking: 0.05,
  kerb: 0.13, pavement: 0.13,
};

const AREA = {
  park: { layer: 'area0', cell: G.grass, tint: [1, 1, 1] },
  meadow: { layer: 'area0', cell: G.meadow, tint: [1, 1, 1] },
  wood: { layer: 'area0', cell: G.woodland, tint: [1, 1, 1] },
  scrub: { layer: 'area0', cell: G.meadow, tint: [0.78, 0.86, 0.7] },
  grass: { layer: 'area1', cell: G.grass, tint: [1, 1, 1] },
  garden: { layer: 'area1', cell: G.grass, tint: [0.9, 0.96, 0.86] },
  parking: { layer: 'area1', cell: G.parking, tint: [1, 1, 1] },
  paved: { layer: 'area1', cell: G.paving, tint: [1, 1, 1] },
  sand: { layer: 'area1', cell: G.sand, tint: [1, 1, 1] },
  bridge: { layer: 'area1', cell: G.paving, tint: [0.95, 0.93, 0.9] },
  pier: { layer: 'area1', cell: G.boards, tint: [1, 1, 1] },
  pitch: { layer: 'area2', cell: G.lawn, tint: [1, 1, 1] },
  flowerbed: { layer: 'area2', cell: G.flowerbed, tint: [1, 1, 1] },
};
export function surfaceCell(surface, fallback) {
  switch (surface) {
    case 'sett': return G.setts;
    case 'unhewn_cobblestone': case 'cobblestone': return G.cobbles;
    case 'gravel': case 'fine_gravel': case 'pebblestone': case 'grit': return G.gravel;
    case 'compacted': case 'ground': case 'dirt': case 'unpaved': case 'earth': case 'mud': return G.dirt;
    case 'asphalt': case 'chipseal': return G.asphalt;
    case 'paving_stones': case 'paved': case 'concrete': case 'concrete:plates': case 'paving_stonesq': case 'metal': case 'metal_grid': return G.paving;
    case 'grass': return G.grass;
    case 'wood': return G.boards;
    case 'sand': return G.sand;
    default: return fallback;
  }
}

export function buildGround(ctx) {
  const { map, batch, ov } = ctx;
  const b = map.bounds;

  // ---- base ground: 25 m grid, paved where buildings are dense, garden-grass where sparse
  const C = 25, pad = 300;
  const x0 = Math.floor((b.minX - pad) / C) * C, z0 = Math.floor((b.minZ - pad) / C) * C;
  const nx = Math.ceil((b.maxX + pad - x0) / C), nz = Math.ceil((b.maxZ + pad - z0) / C);
  const boxes = map.boxes && map.boxes.length > 1 ? map.boxes : null, eastX = boxes ? boxes[0].maxX : null;
  const cov = new Float32Array(nx * nz);
  for (const bd of map.buildings) {
    if (bd.part) continue;
    const ix = Math.floor((bd.c[0] - x0) / C), iz = Math.floor((bd.c[1] - z0) / C);
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
    const bb = polyBounds(bd.poly); cov[iz * nx + ix] += (bb.maxX - bb.minX) * (bb.maxZ - bb.minZ) * 0.8;
  }
  const blur = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    let s = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const jx = ix + dx, jz = iz + dz; if (jx >= 0 && jz >= 0 && jx < nx && jz < nz) s += cov[jz * nx + jx]; }
    blur[iz * nx + ix] = s / (9 * C * C);
  }
  // one quad per run of identical cells along a row (the open country round the map and the big grass areas are most of
  // the grid); paved cells keep their per-cell tone and stay single.
  const classify = (ix, iz) => {
    const cx = x0 + ix * C + C / 2, cz = z0 + iz * C + C / 2, zone = ctx.zoneAt(cx, cz), d = blur[iz * nx + ix];
    // the playable area is the union of map.boxes (the original rectangle + the East Oxford extension); cells of the
    // extension are a class of their own (5–7) so that blocks of the original area are merged exactly as before
    const east = eastX !== null && cx >= eastX;
    const outside = boxes ? !boxes.some((q) => cx >= q.minX && cx <= q.maxX && cz >= q.minZ && cz <= q.maxZ) : cx < b.minX || cx > b.maxX || cz < b.minZ || cz > b.maxZ;
    if (outside) return [G.meadow, 0.85, 0.9, 0.8, east ? 5 : 1];
    if (east) {
      if (d > 0.32) { const h = hash01(ix * 7 + iz * 131); return [h < 0.7 ? G.paving : G.gravel, 0.94 + h * 0.08, 0.94 + h * 0.06, 0.92, 0]; }
      return [G.grass, 0.85, 0.93, 0.8, 7];
    }
    // pass 5: no bare-earth cells any more (they showed as 25 m brown squares in yards and at junction corners): the
    // built-up centre is flagged throughout, gravel only in dense blocks outside it, everything else is garden grass
    if (zone === 'centre' ? d > 0.12 : d > 0.32) { const h = hash01(ix * 7 + iz * 131); return [zone === 'centre' || h < 0.7 ? G.paving : G.gravel, 0.94 + h * 0.08, 0.94 + h * 0.06, 0.92, 0]; }
    if (d > 0.18 && zone === 'mid') { const h = hash01(ix * 7 + iz * 131); return [G.paving, 0.94 + h * 0.08, 0.94 + h * 0.06, 0.92, 0]; }
    return [G.grass, 0.85, 0.93, 0.8, 3];
  };
  // (roughness pass: is the base ground at a point grass? world/rough.js frays lawn edges only against hard ground)
  ctx.baseGreen = (x, z) => { const ix = Math.floor((x - x0) / C), iz = Math.floor((z - z0) / C); if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return true; const c = classify(ix, iz)[0]; return c === G.grass || c === G.meadow; };
  // ---- holes in the ground (2026-11-22): a place module that builds ground BELOW y = 0 (Worcester's sunk quad) lists
  // the footprints in its preMap as `ov.groundHoles` = [convex world polygon [[x, z], ...], ...]. The base cells such
  // a polygon touches are drawn one by one with it cut out; a mapped area that wholly contains one gets it as a hole
  // (before the nesting pass below, so sub-layers are worked out on what is really drawn). Areas and paths that only
  // CROSS a hole are the place module's to skip (ov.skip): ctx.stats.holeCrossers counts them.
  const HOLES = (ov.groundHoles || []).filter((p) => p && p.length >= 3).map((p) => { let ar = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; ar += p[i][0] * q[1] - q[0] * p[i][1]; } return { p: ar < 0 ? p.slice().reverse() : p, bb: polyBounds(p) }; });
  const holeCell = (ix, iz) => { const xa = x0 + ix * C, za = z0 + iz * C; for (const h of HOLES) if (h.bb.maxX > xa && h.bb.minX < xa + C && h.bb.maxZ > za && h.bb.minZ < za + C) return true; return false; };
  // (Sutherland-Hodgman against the line a -> b: the part of convex `poly` on its left, or on its right)
  const clipHalf = (poly, a, b, left) => {
    const out = [], sd = (p) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * (left ? 1 : -1);
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], sp = sd(p), sq = sd(q); if (sp >= 0) out.push(p); if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } }
    return out;
  };
  const cutHoles = (rect) => {      // convex pieces of `rect` outside every hole
    let pieces = [rect];
    for (const h of HOLES) { const next = []; for (let rem of pieces) { for (let i = 0; i < h.p.length && rem.length >= 3; i++) { const a = h.p[i], b = h.p[(i + 1) % h.p.length], o = clipHalf(rem, a, b, false); if (o.length >= 3) next.push(o); rem = clipHalf(rem, a, b, true); } } pieces = next; }
    return pieces;
  };
  if (HOLES.length) {
    let crossers = 0;
    for (const a of map.areas) {
      if (a.kind === 'water' || ov.skip.has(a.id) || !a.poly || a.poly.length < 3) continue;
      const bb = polyBounds(a.poly);
      for (const h of HOLES) {
        if (h.bb.maxX < bb.minX || h.bb.minX > bb.maxX || h.bb.maxZ < bb.minZ || h.bb.minZ > bb.maxZ) continue;
        const inA = (q) => pointInPoly(q[0], q[1], a.poly) && !(a.holes || []).some((r) => pointInPoly(q[0], q[1], r));
        const n = h.p.filter(inA).length;
        if (n === h.p.length && !a.poly.some((q) => pointInPoly(q[0], q[1], h.p))) (a.holes || (a.holes = [])).push(h.p.map((q) => q.slice()));
        else if (n || a.poly.some((q) => pointInPoly(q[0], q[1], h.p))) crossers++;
      }
    }
    ctx.stats.groundHoles = HOLES.length; ctx.stats.holeCrossers = crossers;
  }
  const done = new Uint8Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    if (done[iz * nx + ix]) continue;
    const k = classify(ix, iz);
    if (HOLES.length && holeCell(ix, iz)) {
      done[iz * nx + ix] = 1;
      const xa = x0 + ix * C, za = z0 + iz * C, s = GS[k[0]], buf = batch.buf('base', xa + C / 2, za + C / 2);
      setGroundCell(buf, k[0]).setTint(k[1], k[2], k[3]);
      for (const pc of cutHoles([[xa, za], [xa + C, za], [xa + C, za + C], [xa, za + C]])) { const I = pc.map((q) => buf.v(q[0], 0, q[1], 0, 1, 0, q[0] / s, q[1] / s)); for (let i = 1; i < I.length - 1; i++) buf.triFacing(I[0], I[i], I[i + 1], 0, 1, 0); }
      continue;
    }
    // blocks of at most 100 m × 100 m (huge triangles lose depth precision); a merged quad overlaps its neighbours by
    // 2 cm so the T-junctions where blocks of different sizes meet cannot open hairline cracks
    let jx = ix + 1, jz = iz + 1;
    if (k[4]) {
      while (jx < nx && jx - ix < 4 && !done[iz * nx + jx] && classify(jx, iz)[4] === k[4] && !(HOLES.length && holeCell(jx, iz))) jx++;
      grow: while (jz < nz && jz - iz < 4) { for (let x = ix; x < jx; x++) if (done[jz * nx + x] || classify(x, jz)[4] !== k[4] || (HOLES.length && holeCell(x, jz))) break grow; jz++; }
    }
    for (let z = iz; z < jz; z++) for (let x = ix; x < jx; x++) done[z * nx + x] = 1;
    const e2 = (jx - ix) * (jz - iz) > 1 ? 0.02 : 0, x = x0 + ix * C - e2, z = z0 + iz * C - e2, xe = x0 + jx * C + e2, ze = z0 + jz * C + e2;
    const buf = batch.buf('base', (x + xe) / 2, (z + ze) / 2);
    setGroundCell(buf, k[0]).setTint(k[1], k[2], k[3]);
    const s = GS[k[0]];
    const a = buf.v(x, 0, z, 0, 1, 0, x / s, z / s), bb = buf.v(xe, 0, z, 0, 1, 0, xe / s, z / s);
    const c = buf.v(xe, 0, ze, 0, 1, 0, xe / s, ze / s), e = buf.v(x, 0, ze, 0, 1, 0, x / s, ze / s);
    buf.quadFacing(a, bb, c, e, 0, 1, 0);
  }

  // East Oxford extension: its real ground lives in tiles drawn only within ~1.1 km (TileBatcher east split). Under it,
  // in the always-drawn mesh, lies a plain green backdrop 0.3 m down (200 m quads: 2 triangles each, about what the
  // "outside the map" border cost there before), so from far away the extension is land, not a hole in the world.
  if (eastX !== null) {
    const Q = 200, s = GS[G.meadow], xa = Math.floor(eastX / Q) * Q, xb = b.maxX + pad, za = z0, zb = z0 + nz * C;
    for (let x = xa; x < xb; x += Q) for (let z = za; z < zb; z += Q) {
      const xs = Math.max(x, eastX), xe = Math.min(x + Q, xb) + 0.02, ze = Math.min(z + Q, zb) + 0.02;
      const buf = batch.buf('base', 0, 0, true);
      buf.setCell(G.meadow).setTint(0.8, 0.86, 0.74);
      const a = buf.v(xs, -0.3, z, 0, 1, 0, xs / s, z / s), bb = buf.v(xe, -0.3, z, 0, 1, 0, xe / s, z / s);
      const c = buf.v(xe, -0.3, ze, 0, 1, 0, xe / s, ze / s), e = buf.v(xs, -0.3, ze, 0, 1, 0, xs / s, ze / s);
      buf.quadFacing(a, bb, c, e, 0, 1, 0);
    }
  }

  // ---- areas
  const colleges = map.sites.filter((s) => s.kind === 'university');
  const inCollege = (x, z) => colleges.some((s) => pointInPoly(x, z, s.poly));
  ctx.areaList = [];
  const AT = (ctx.areaTris = []);   // [layer id, x0, z0, x1, z1, x2, z2] per drawn landuse triangle
  // Areas of ONE layer that lie over each other (z-fighting pass, 2026-11). The map nests them freely — the woods and
  // the shrubberies inside a park, a lawn inside a lawn, the same ground mapped twice — and two areas of one layer were
  // drawn in exactly the same plane with the same depth bias: 440,000 m2 of ground where grass and woodland floor (or
  // two tints of one grass) swapped over in stripes as the camera moved, the whole of the University Parks among it.
  // Now each area gets a SUB-layer by how deep it is nested among larger areas of its own layer (0 for the largest;
  // +0.3, +0.55, +0.75, +0.9 of a layer for those inside it, so the smaller one lies on top and they are told apart to
  // some 375 m), and lies up to 1.35 mm higher (world.groundHeight() is unchanged: the foot of a walker is a millimetre in).
  const SUBL = [0, 0.3, 0.55, 0.75, 0.9], subOf = new Map(), subT0 = performance.now();
  {
    const recs = [];
    for (const a of map.areas) {
      if (a.kind === 'water' || ov.skip.has(a.id)) continue;
      const def = AREA[a.kind]; if (!def) continue;
      const poly = cleanRing(a.poly); if (poly.length < 3) continue;
      const [cx, cz] = polyCentroid(poly);
      let ar = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; ar += p[0] * q[1] - q[0] * p[1]; }
      // (pts: the corners drawn 0.4 m in towards the middle, and the middle — points INSIDE the area: two areas that only
      //  share a boundary are neighbours, not one over the other)
      const pts = poly.map((p) => { const dx = cx - p[0], dz = cz - p[1], l = Math.hypot(dx, dz) || 1, k = Math.min(0.4, l * 0.5) / l; return [p[0] + dx * k, p[1] + dz * k]; }); pts.push([cx, cz]);
      recs.push({ a, poly, pts, holes: (a.holes || []).map((h) => cleanRing(h)).filter((h) => h.length >= 3), bb: polyBounds(poly), ar: Math.abs(ar) / 2, layer: a.kind === 'grass' && inCollege(cx, cz) ? 'area2' : def.layer, lv: 0 });
    }
    const inside = (x, z, r) => { if (x < r.bb.minX || x > r.bb.maxX || z < r.bb.minZ || z > r.bb.maxZ || !pointInPoly(x, z, r.poly)) return false; for (const h of r.holes) if (pointInPoly(x, z, h)) return false; return true; };
    for (const r of recs) r.pts = r.pts.filter((p) => inside(p[0], p[1], r));      // (once: only the points that really are inside it — a concave outline can throw one out)
    recs.sort((p, q) => q.ar - p.ar);      // (stable: of two areas of one size the later one in the map lies on top)
    for (let i = 1; i < recs.length; i++) {
      const B = recs[i];
      for (let j = 0; j < i; j++) {
        const A = recs[j];
        if (A.layer !== B.layer || A.lv < B.lv || A.bb.maxX < B.bb.minX || A.bb.minX > B.bb.maxX || A.bb.maxZ < B.bb.minZ || A.bb.minZ > B.bb.maxZ) continue;
        if (B.pts.some((p) => inside(p[0], p[1], A)) || A.pts.some((p) => inside(p[0], p[1], B))) B.lv = A.lv + 1;
      }
      if (B.lv) subOf.set(B.a, SUBL[Math.min(B.lv, SUBL.length - 1)]);
    }
    ctx.stats.nestedAreas = subOf.size; ctx.stats.nestedMs = Math.round(performance.now() - subT0);
  }
  for (const a of map.areas) {
    if (a.kind === 'water' || ov.skip.has(a.id)) continue;
    const def = AREA[a.kind]; if (!def) continue;
    const poly = cleanRing(a.poly); if (poly.length < 3) continue;
    const holes = (a.holes || []).map((h) => cleanRing(h)).filter((h) => h.length >= 3);
    const [cx, cz] = polyCentroid(poly);
    let layer = def.layer, cell = def.cell, tint = def.tint.slice(), uvRot = null;
    const hv = hash01(a.id);
    if (a.kind === 'paved' || a.kind === 'parking') cell = surfaceCell(a.surface, cell);
    if (a.kind === 'grass' && inCollege(cx, cz)) { layer = 'area2'; cell = G.lawn; }
    if (a.kind === 'pitch') {
      if (a.sport === 'tennis' && a.surface !== 'grass') { cell = G.asphalt; tint = hv < 0.5 ? [0.55, 0.95, 0.6] : [1.25, 0.75, 0.6]; }
      else if (a.surface && a.surface !== 'grass') cell = surfaceCell(a.surface, G.lawn);
    }
    if (cell === G.grass || cell === G.meadow || cell === G.lawn) tint = tint.map((t, i) => t * (0.93 + hv * 0.12 - (i === 1 ? 0 : 0.03)));
    if (cell === G.lawn) { const o = obb(poly); uvRot = [o.vx, o.vz, o.ux, o.uz]; }
    const buf = batch.buf(layer, cx, cz);
    buf.L += subOf.get(a) || 0;      // (its sub-layer among the areas of its own layer: see above)
    setGroundCell(buf, cell).setTint(tint);
    const i0 = buf.idx.length;
    // (and a real hair of height with it, at most 1.35 mm: the bias alone lifts a sub-layer by only sub x 0.0005 x the
    //  eye's height above the ground — a third of a millimetre for a walker — which the rounding of positions half a
    //  kilometre from the origin can swallow)
    flatPoly(buf, poly, holes, Y[layer] + (subOf.get(a) || 0) * 0.0015, GS[cell], false, uvRot);
    // the triangles actually drawn (a polygon that fails to triangulate draws nothing): groundHeight() rasterises these
    { const P = buf.pos, I = buf.idx, id = layer === 'area0' ? 1 : layer === 'area1' ? 2 : 3; for (let t = i0; t < I.length; t += 3) AT.push(id, P[I[t] * 3], P[I[t] * 3 + 2], P[I[t + 1] * 3], P[I[t + 1] * 3 + 2], P[I[t + 2] * 3], P[I[t + 2] * 3 + 2]); }
    ctx.areaList.push({ a, poly, holes, cx, cz, layer });
  }
}
