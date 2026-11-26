// Fill the outdoor Collider from map data. Purely logical; drawing lives in src/world/.
const WALL_KINDS = { wall: 0, city_wall: 0, fence: 0, hedge: 0, retaining_wall: 1, railing: 1, guard_rail: 1 }; // 1 = low
const GATE_KINDS = new Set(['gate', 'lift_gate', 'kissing_gate', 'swing_gate', 'door', 'turnstile', 'cycle_barrier', 'ticket_barrier']);

export function buildMapCollision(collider, map, overrides) {
  for (const b of map.buildings) {
    if (b.part || overrides.skipCollision.has(b.id) || overrides.skip.has(b.id)) continue;
    if ((b.minH || 0) > 2.5) continue;                       // raised volumes (bridges between buildings)
    if (b.tags.building === 'roof') continue;                // canopies: open underneath
    b._segs = collider.addPolygon(b.poly, { tag: 'building' });
    // (how tall the walls are, m above the ground: the chase camera only lifts over a building it can see over)
    const H = (overrides.heights && overrides.heights.get(b.id)) || b.h || 10;
    for (const s of b._segs) s.h = H;
    for (const h of b.holes || []) for (const s of collider.addPolygon(h, { tag: 'building' })) s.h = H;
  }
  for (const w of map.barriers) {
    if (overrides.skip.has(w.id)) continue;
    // low walls (not fences, hedges or railings) can be jumped onto and walked along: their height is a floor (Collider.topAt)
    const top = (w.kind === 'wall' || w.kind === 'retaining_wall') && w.h > 0.25 && w.h <= 1.25 ? w.h : 0;
    const segs = collider.addPolyline(w.pts, { tag: w.kind, low: !!WALL_KINDS[w.kind], top });
    if (w.h > 0 && segs) for (const sg of segs) sg.sh = w.h;      // (the mapped height, for sound only — Collider.soundWalls; `h` is left unset: the camera and sightBlocked read that)
  }
  for (const g of map.gates) if (GATE_KINDS.has(g.kind)) collider.addPassage(g.p[0], g.p[1], g.p[0], g.p[1], 3.4);
  // ways mapped as passing through/under buildings: archways, covered passages
  for (const r of map.roads) {
    if (r.tunnel || r.covered) for (let i = 0; i < r.pts.length - 1; i++) collider.addPassage(r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1], Math.max(2.2, r.w));
    if (r.bridge) collider.addWalkable(r.pts, r.w + 1.5);
  }
  for (const t of map.trees) collider.addCircle(t[0], t[1], 0.3, { tag: 'tree' });
  for (const a of map.areas) {
    if (a.kind === 'water') collider.addWater(a.poly, a.holes || []);
    else if (a.kind === 'bridge' || a.kind === 'pier') collider.addWalkable(a.poly);
  }
  for (const w of map.waterlines) if (!w.tunnel && (w.kind === 'river' || w.kind === 'canal' || w.kind === 'stream')) collider.addWaterLine(w.pts, w.cw ?? w.w);
  const b = map.bounds;
  collider.bounds = { minX: b.minX + 5, maxX: b.maxX - 5, minZ: b.minZ + 5, maxZ: b.maxZ - 5 };
  // the playable area is the union of map.boxes (L-shaped since the East Oxford extension); `bounds` is its bounding
  // rectangle. Boxes overlap by 10 m after the 5 m inset so the seam between two of them is open.
  if (map.boxes && map.boxes.length > 1) collider.bounds.boxes = map.boxes.map((q) => ({ minX: q.minX + 5 - (q.minX > b.minX ? 10 : 0), maxX: q.maxX - 5 + (q.maxX < b.maxX ? 10 : 0), minZ: q.minZ + 5, maxZ: q.maxZ - 5 }));
}
