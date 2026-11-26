// University Parks helper: a real-distance query over every map road and path (world.roadGrid holds only vehicle
// roads, and its queryRadius returns whole 40 m cells, so it cannot tell "on the path" from "near a road").
export function parkPaths(game) {
  if (game._parksPaths) return game._parksPaths;
  const G = new game.world.util.SpatialGrid(30);
  for (const r of game.map.roads) {
    if (r.kind === 'corridor' || !r.pts || r.pts.length < 2 || r.tunnel) continue;
    for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; G.insertSeg(a[0], a[1], b[0], b[1], { ax: a[0], az: a[1], bx: b[0], bz: b[1], w: r.w || 2, kind: r.kind, name: r.name || null }); }
  }
  let best = 0, bestSeg = null, bx = 0, bz = 0;
  /** distance from (x,z) to the nearest road/path EDGE within `r` (Infinity if none); also sets .seg / .px / .pz */
  const api = {
    grid: G,
    dist(x, z, r = 10) {
      best = Infinity; bestSeg = null;
      G.queryRadius(x, z, r + 8, (s) => {
        const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
        const px = s.ax + dx * t, pz = s.az + dz * t, d = Math.hypot(px - x, pz - z) - s.w / 2;
        if (d < best) { best = d; bestSeg = s; bx = px; bz = pz; }
      });
      api.seg = bestSeg; api.px = bx; api.pz = bz;
      return best;
    },
    near(x, z, r) { return api.dist(x, z, r) < r; },
    seg: null, px: 0, pz: 0,
  };
  game._parksPaths = api;
  return api;
}
