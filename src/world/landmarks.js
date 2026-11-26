// Landmark heights (OSM heights are mostly random defaults) and a few cheap custom silhouettes.
// ALL VALUES APPROXIMATE (from general knowledge, not survey data). game.overrides.heights still wins over these.
import { FACADE_CELLS as F, ROOF_CELLS as RC, ROOF_SCALE as RS, ROOF_OFS } from './textures.js';
import { EASTPASS } from './terrain.js';
import { prism, cap, polyCentroid, wallQuad, orientedBox, polylineLength, pointAt } from './util.js';

/** id -> { h, roof?, roofH?, crenel?, wall?, note } */
/** Roofscape / college-front pass (2026-11): `?roofs=0` (GTO_ROOFS=0 in node) turns it off for before / after shots. */
export const ROOFSCAPE = !((typeof location !== 'undefined' && location && /[?&]roofs=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_ROOFS === '0'));
export const LANDMARKS = {
  w130731852: { h: 17, note: 'Randolph Hotel (~5 storeys)' },
  // graphics pass 5: `stages` = [top (m), cell, rows, bay (m), alt cell, p] stacked up each wall (buildings.js), so a tower
  // is plain below and opens up at the belfry instead of being an office block of windows. `simplify` merges collinear
  // footprint edges first (one bay per face). roofMat forces the roof material.
  w77881357: { h: 40, roof: 'flat', crenel: true, wall: 'college', bay: 3.8, stages: [[9, F.stoneBlank], [26.5, F.stoneSmall, 5, 3.8, F.stoneBlank, 0.5], [27.5, F.stoneBand, 1], [1e3, F.stoneGothic, 1]], note: 'Magdalen Tower (44 m to pinnacle tops): plain lower stages, tall paired belfry openings' },
  w394438029: { h: 44.5, roof: 'cone', roofH: 3.5, wall: 'college', note: 'Magdalen Tower pinnacle' },
  w394438032: { h: 44.5, roof: 'cone', roofH: 3.5, wall: 'college', note: 'Magdalen Tower pinnacle' },
  w394438034: { h: 44.5, roof: 'cone', roofH: 3.5, wall: 'college', note: 'Magdalen Tower pinnacle' },
  w394438035: { h: 44.5, roof: 'cone', roofH: 3.5, wall: 'college', note: 'Magdalen Tower pinnacle' },
  w311139684: { h: 23, roof: 'flat', crenel: true, wall: 'college', simplify: 0.4, bay: 5.5, stages: [[14.5, F.stoneBlank], [15.3, F.stoneBand, 1], [1e3, F.towerBelfry, 1]], note: 'Carfax Tower: rubble shaft, clock and bell stage' },
  w146574165: { h: 24, roof: 'flat', crenel: true, wall: 'college', simplify: 0.6, bay: 9, stages: [[7.5, F.stoneArchDoor, 1], [18, F.collegeGothic, 3, 3.3], [18.8, F.stoneBand, 1], [1e3, F.towerBelfry, 1]], note: 'Tom Tower, the square gatehouse stage (Tom Gate arch, clock)' },
  w931973513: { wall: 'gothic', note: 'Tom Tower octagon (Wren, 1681-2)' },
  w931973512: { roof: 'onion', roofH: 6, roofMat: 'lead', note: 'Tom Tower ogee dome' },
  w849367646: { h: 12.5, roof: 'flat', crenel: true, wall: 'college', note: "Christ Church, St Aldate's front north of Tom Tower" },
  w931973511: { h: 12.5, roof: 'flat', crenel: true, wall: 'college', note: "Christ Church, St Aldate's front south of Tom Tower" },
  w110348109: { h: 10.5, roof: 'gabled', wall: 'gothic', note: 'St Mary Magdalen (+ west tower)' },
  w27582068: { h: 15, roof: 'hipped', roofH: 3.4, wall: 'stone', roofMat: 'slate', bay: 3.7, stages: [[5.4, F.stoneRustic, 1, 3.7, F.stoneArchDoor, 0.2], [6.1, F.stoneBand, 1], [1e3, F.stoneSashTall, 1]], note: 'Sheldonian Theatre (+ cupola to ~25 m): rusticated ground storey, tall upper windows' },
  w60903337: { h: 14, roof: 'gabled', wall: 'gothic', note: "St Mary the Virgin nave (+ tower/spire to ~62 m)" },
  w87344211: { h: 12, roof: 'flat', wall: 'stone', note: 'Radcliffe Observatory (+ octagonal tower to ~30 m)' },
  w1427073779: { h: 46, roof: 'cone', roofH: 12, note: 'Nuffield College tower + copper spire' },
  r62123: { h: 18, roof: 'flat', crenel: true, wall: 'college', bay: 3.6, stages: [[4.3, F.collegeGround, 1], [1e3, F.collegeWide, 3]], note: 'Bodleian Old Schools Quadrangle: three storeys of mullioned and transomed windows' },
  // photo comparison item 14 (clarendon): two storeys of round-headed windows (were rectangular sashes)
  w29387139: { h: 15, roof: 'hipped', roofH: 2.5, wall: 'stone', roofMat: 'lead', bay: 3.6, stages: ROOFSCAPE ? [[5.6, F.stoneRoundArch, 1], [6.2, F.stoneBand, 1], [1e3, F.stoneRoundArch, 1]] : [[5.6, F.stoneSash, 1], [6.2, F.stoneBand, 1], [1e3, F.stoneSashTall, 1]], note: 'Clarendon Building (+ giant portico)' },
  r1337584: { h: 15, roof: 'flat', wall: 'stone', bay: 3.8, stages: [[6.6, F.stoneRustic, 1, 3.8, F.stoneBlank, 0.3], [7.3, F.stoneBand, 1], [1e3, F.stoneSashTall, 1, 3.8, F.stoneBlank, 0.4]], note: 'Ashmolean Museum (+ portico)' },
  r12885061: { h: 20, roof: 'flat', wall: 'stone', note: 'Oxford Town Hall' },
  w114320058: { h: 14, roof: 'flat', crenel: true, wall: 'gothic', note: 'Divinity School' },
  w25999883: { h: 18, roof: 'gabled', wall: 'gothic', note: 'Museum of Natural History' },
  w60903334: { h: 22, roof: 'gabled', wall: 'gothic', note: 'Exeter College Chapel' },
  w90709819: { h: 25, roof: 'gabled', wall: 'gothic', note: 'Keble College Chapel' },
  w39606739: { h: 20, roof: 'gabled', wall: 'gothic', note: 'Merton College Chapel' },
  w30668669: { h: 24.4, roof: 'flat', crenel: true, wall: 'college', note: "St George's Tower (castle)" },
  w110341979: { h: 20, roof: 'flat', crenel: true, wall: 'college', note: 'Saxon Tower, St Michael at the Northgate' },
  w146575301: { h: 24, wall: 'gothic', note: 'Christ Church Great Hall' },
};

/** Building ids replaced entirely by custom geometry below. */
export const LANDMARK_SKIP = new Set(['w385163420', 'w237779894', 'w1259054050', 'w1259054048']); // Radcliffe Camera parts

const STONE = [1.02, 0.98, 0.9], LEAD = [0.95, 0.97, 1.0];

/** Custom silhouettes. ctx.batch layers 'facade' and 'roof'. Each piece skipped if its anchor id is in overrides.skip. */
export function buildLandmarks(ctx) {
  const { map, batch, ov } = ctx;
  const byId = new Map(map.buildings.map((b) => [b.id, b]));
  const seed = 321;
  const F_ = (x, z) => batch.buf('facade', x, z), R_ = (x, z) => batch.buf('roof', x, z);

  // Radcliffe Camera: rusticated 16-sided base, colonnaded drum, balustrade, lead dome, lantern
  const rc = byId.get('w4884600');
  if (rc && !ov.skip.has('w4884600')) {
    const [cx, cz] = polyCentroid(rc.poly), r = 15.5;
    let f = F_(cx, cz);
    f.setCell(F.stoneRustic, F.stoneArchDoor, 0.25, seed).setTint(STONE);   // rusticated base, alternate bays open as arches (gated since 1863)
    prism(f, cx, cz, r, 16, 0, 12, { bayPerSide: true, vScale: 6, v0: 0 });
    f.setCell(F.stoneSashTall, F.stoneSashTall, 0, seed).setTint(STONE);
    prism(f, cx, cz, r * 0.93, 16, 12, 24, { bayPerSide: true, vScale: 12 });
    f.setCell(F.stoneBlank).setTint(STONE);
    prism(f, cx, cz, r * 0.96, 16, 11.6, 12.4, { cap: true, capUv: 3 }); // cornice ring
    prism(f, cx, cz, r * 0.95, 16, 24, 25.4, { cap: true, capUv: 3 }); // balustrade
    prism(f, cx, cz, r * 0.66, 16, 25.4, 29, { bayPerSide: true, vScale: 3.6 });
    const ro = R_(cx, cz); ro.setCell(ROOF_OFS + RC.lead).setTint(LEAD);
    cap(ro, cx, cz, r * 0.66, 32, 29, 8.5, 'dome', { uvScale: RS[RC.lead] });
    f.setCell(F.stoneSash).setTint(STONE);
    prism(f, cx, cz, 2.0, 8, 37.2, 40, { bayPerSide: true, vScale: 2.8 });
    ro.setCell(ROOF_OFS + RC.lead).setTint(LEAD); cap(ro, cx, cz, 2.0, 8, 40, 1.6, 'dome', { uvScale: 2 });
    f.setCell(F.stoneBlank).setTint(STONE); prism(f, cx, cz, 0.25, 6, 41.4, 42.4, { cap: true });
  }
  // Sheldonian: the octagonal cupola (Blore's, 1838) with a lead dome, and the Emperors' heads on their piers along the
  // Broad Street railing (KNOWN: 13 heads on tall piers on the curved screen; GUESS: even spacing along the mapped fence)
  const sh = byId.get('w27582068');
  if (sh && !ov.skip.has('w27582068')) {
    const [cx, cz] = polyCentroid(sh.poly);
    const f = F_(cx, cz); f.setCell(F.stoneSashTall).setTint(STONE);
    prism(f, cx, cz, 3.3, 8, 13.5, 20.5, { bayPerSide: true, vScale: 7 });
    f.setCell(F.stoneBlank).setTint(STONE); prism(f, cx, cz, 3.6, 8, 20.5, 21.1, { cap: true, capUv: 3 });
    const ro = R_(cx, cz); ro.setCell(ROOF_OFS + RC.lead).setTint(0.72, 0.86, 0.8);
    cap(ro, cx, cz, 3.1, 8, 21.1, 2.6, 'dome', { uvScale: 2, rings: 3 });
    f.setCell(F.stoneBlank).setTint(STONE); prism(f, cx, cz, 0.28, 4, 23.6, 25.2, { cap: true });
    const rail = (map.barriers || []).find((q) => q.id === 'w114320059');
    if (rail && !ov.skip.has(rail.id)) {
      const L = polylineLength(rail.pts);
      f.setDetail(true);
      for (let i = 0; i < 13; i++) {
        const P = pointAt(rail.pts, ((i + 0.5) / 13) * L);
        f.setCell(F.stoneBlank).setTint(0.98, 0.95, 0.88); orientedBox(f, P.x, P.z, P.dx, P.dz, 0.25, 0.25, 0, 2.0, { uvScale: 3.2, top: false });
        orientedBox(f, P.x, P.z, P.dx, P.dz, 0.34, 0.3, 2.0, 2.2, { uvScale: 3.2 });                                             // shoulders
        f.setTint(0.82, 0.8, 0.74); prism(f, P.x, P.z, 0.2, 6, 2.2, 2.78, { cap: true, uScale: 3.2, vScale: 3.2, r1: 0.24 });   // head
      }
      f.setDetail(false);
    }
  }
  // Clarendon Building (Hawksmoor, 1711-15): giant tetrastyle Doric portico and pediment to Broad Street. KNOWN: the
  // portico and its side; GUESS: column size and spacing.
  const cl = byId.get('w29387139');
  if (cl && !ov.skip.has('w29387139')) {
    // the north face of the projecting centre (two collinear mapped edges): the footprint vertices nearest its two ends
    const near = (x, z) => cl.poly.reduce((m, p) => (Math.hypot(p[0] - x, p[1] - z) < Math.hypot(m[0] - x, m[1] - z) ? p : m), cl.poly[0]);
    const a = near(363.6, 37.3), c = near(378.8, 33.7);
    // photo comparison item 14: the portico stands free of the wall, a full intercolumniation deep, on a flight of steps
    // (depth and column size measured off the photograph: a GUESS within half a metre)
    if (Math.hypot(c[0] - a[0], c[1] - a[1]) > 8) portico(F_, R_, a, c, polyCentroid(cl.poly), ROOFSCAPE ? { cols: 4, r: 0.74, colH: 10.0, base: 1.3, out: 3.8, ped: 3.3 } : { cols: 4, r: 0.66, colH: 10.2, base: 1.1, out: 2.1, ped: 3.3 });
  }
  // Ashmolean (Cockerell, 1841-5): the Ionic portico in the middle of the Beaumont Street front. GUESS: which mapped
  // edge it stands on (the long south-facing edge nearest the middle of the front) and its size.
  const as = byId.get('r1337584');
  if (as && !ov.skip.has('r1337584')) {
    let best = null;
    for (let i = 0; i < as.poly.length; i++) { const a = as.poly[i], c = as.poly[(i + 1) % as.poly.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]), mz = (a[1] + c[1]) / 2, mx = (a[0] + c[0]) / 2; if (l > 12 && mz > -20 && (!best || Math.abs(mx + 46) < Math.abs(best.mx + 46))) best = { a, c, l, mz, mx }; }
    if (best) portico(F_, R_, best.a, best.c, polyCentroid(as.poly), { cols: 4, r: 0.62, colH: 9.4, base: 1.2, out: 2.2, ped: 2.8, width: 12.5, ionic: true });
  }
  // Bodleian, Old Schools Quadrangle: pinnacles along the battlements and the Tower of the Five Orders rising over the
  // east range (KNOWN: gate tower in the middle of the east range, pinnacled parapets; GUESS: exact position and size)
  const bod = byId.get('r62123');
  if (bod && !ov.skip.has('r62123')) {
    const f = F_(388, 105);
    f.setDetail(true).setCell(F.stoneBlank).setTint(STONE);
    for (const ring of [bod.poly, ...(bod.holes || [])]) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.round(l / 7.5));
      for (let k = 0; k < n; k++) { const t = k / n; spire(f, a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, 0.42, 4, 17.6, 2.9); }
    }
    f.setDetail(false);
    const ux = 0.261, uz = 0.965, tx = 406.4, tz = 99;
    f.setCell(F.collegeGothic, F.collegeGothic, 0, seed).setTint(STONE).setTop(23.5);
    boxStage(f, tx, tz, ux, uz, 4.7, 5.6, 16.8, 23.5, 2, 3, 2);
    f.setTop();
    const ro = R_(tx, tz); ro.setCell(ROOF_OFS + RC.lead).setTint(LEAD); lid(ro, tx, tz, ux, uz, 4.7, 5.6, 23.5);
    f.setCell(F.stoneBlank).setTint(STONE);
    for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = tx + ux * 4.4 * sa - uz * 5.3 * sb, z = tz + uz * 4.4 * sa + ux * 5.3 * sb; prism(f, x, z, 0.62, 4, 23.5, 24.8, { uScale: 3.2, vScale: 3.2 }); spire(f, x, z, 0.62, 4, 24.8, 2.8); }
  }
  // Tom Tower: the two octagonal turrets flanking Tom Gate on St Aldate's, with ogee caps like the great one
  const tt = byId.get('w146574165');
  if (tt && !ov.skip.has('w146574165')) {
    const c0 = polyCentroid(tt.poly);
    // the two most westerly corners
    const west = tt.poly.slice().sort((p, q) => p[0] - q[0]).filter((p, i, arr) => i === 0 || Math.hypot(p[0] - arr[0][0], p[1] - arr[0][1]) > 6).slice(0, 2);
    for (const p of west) {
      const f = F_(c0[0], c0[1]); f.setCell(F.stoneBlank).setTint(STONE);
      prism(f, p[0], p[1], 1.55, 8, 0, 27.2, { uScale: 3.2, vScale: 3.6 });
      const ro = R_(c0[0], c0[1]); ro.setCell(ROOF_OFS + RC.lead).setTint(LEAD);
      cap(ro, p[0], p[1], 1.55, 8, 27.2, 3.0, 'onion', { uvScale: 2, rings: 3 });
    }
  }
  // Carfax Tower: the stair turret standing above the parapet at the north-west corner
  const cf = byId.get('w311139684');
  if (cf && !ov.skip.has('w311139684')) {
    const p = cf.poly.slice().sort((a, c) => (a[1] - a[0] * 0.2) - (c[1] - c[0] * 0.2))[0];
    const f = F_(p[0], p[1]); f.setCell(F.stoneBlank).setTint(STONE);
    prism(f, p[0] + 0.3, p[1] + 0.9, 1.3, 6, 19, 26, { uScale: 3.2, vScale: 3.6, cap: true });
  }
  // Magdalen Tower: the four lesser pinnacles in the middle of each face (the corner ones are mapped building parts)
  const mt = byId.get('w77881357');
  if (mt && !ov.skip.has('w77881357')) {
    const f = F_(mt.c[0], mt.c[1]); f.setCell(F.stoneBlank).setTint(STONE);
    for (let i = 0; i < mt.poly.length; i++) { const a = mt.poly[i], c = mt.poly[(i + 1) % mt.poly.length]; if (Math.hypot(c[0] - a[0], c[1] - a[1]) > 5) spire(f, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 0.5, 4, 39.6, 4.2); }
    // (photo comparison east, 2026-11) the crown: an octagonal turret at each corner, standing clear of the parapet and
    // carrying a tall pinnacle, with a second, lesser pinnacle beside each mid-face one — the silhouette from the High
    if (EASTPASS) { const cs = [], cx = mt.c[0], cz = mt.c[1];
      for (let i = 0; i < mt.poly.length; i++) { const a = mt.poly[i], c = mt.poly[(i + 1) % mt.poly.length]; if (Math.hypot(c[0] - a[0], c[1] - a[1]) > 5) for (const p of [a, c]) if (!cs.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 2.5)) cs.push(p); }
      for (const p of cs.slice(0, 4)) {
        const d = Math.hypot(p[0] - cx, p[1] - cz) || 1, x = p[0] + (p[0] - cx) / d * 0.35, z = p[1] + (p[1] - cz) / d * 0.35;
        prism(f, x, z, 1.25, 8, 27.5, 42.4, { uScale: 3.2, vScale: 3.6, cap: true }); prism(f, x, z, 1.42, 8, 39.4, 39.9, { uScale: 3.2, vScale: 3.6, cap: true });
        spire(f, x, z, 1.05, 8, 42.4, 6.4);
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; spire(f, x + Math.cos(a) * 1.0, z + Math.sin(a) * 1.0, 0.22, 4, 42.4, 2.2); }
      }
      for (let i = 0; i < mt.poly.length; i++) { const a = mt.poly[i], c = mt.poly[(i + 1) % mt.poly.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L > 5) for (const t of [0.3, 0.7]) spire(f, a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, 0.3, 4, 40.2, 2.6); } }
  }
  // St Mary Magdalen: the battlemented west tower (KNOWN: a west tower; GUESS: position, 20 m)
  const mg = byId.get('w110348109');
  if (mg && !ov.skip.has('w110348109')) {
    const tx = 73.3, tz = 44.2, f = F_(tx, tz);
    f.setCell(F.stoneBlank).setTint(STONE).setTop(20); boxStage(f, tx, tz, 0, 1, 3.6, 3.4, 0, 13.5, 2.2, 2.2, 3.75);
    f.setCell(F.stoneGothic); boxStage(f, tx, tz, 0, 1, 3.6, 3.4, 13.5, 20, 1, 1, 1); f.setTop();
    const ro = R_(tx, tz); ro.setCell(ROOF_OFS + RC.lead).setTint(LEAD); lid(ro, tx, tz, 0, 1, 3.6, 3.4, 20);
    f.setCell(F.stoneBlank);
    for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) spire(f, tx - 3.1 * sb, tz + 3.3 * sa, 0.5, 4, 20, 2.6);
  }
  // St Mary the Virgin: tower with corner pinnacles and the spire (approx. position on the north side)
  const sm = byId.get('w60903337');
  if (sm && !ov.skip.has('w60903337')) {
    const cx = 421, cz = 233, s = 4.3;
    const f = F_(cx, cz); f.setCell(F.stoneGothic, F.stoneBlank, 0.3, seed).setTint(STONE);
    prism(f, cx, cz, s * Math.SQRT2, 4, 0, 28, { rot: Math.PI / 4, bayPerSide: true, vScale: 9.3, cap: true, capUv: 3 });
    const ro = R_(cx, cz); ro.setCell(ROOF_OFS + RC.slate).setTint(0.95, 0.92, 0.85);
    // stone spire (use the facade stone so it reads as masonry)
    f.setCell(F.stoneBlank).setTint(STONE);
    spire(f, cx, cz, 3.4, 8, 28, 34);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      prism(f, cx + dx * (s - 0.6), cz + dz * (s - 0.6), 0.6, 6, 28, 31, { bayPerSide: false, uScale: 3.2, vScale: 3.2 });
      spire(f, cx + dx * (s - 0.6), cz + dz * (s - 0.6), 0.6, 6, 31, 6);
    }
  }
  // Radcliffe Observatory: octagonal Tower of the Winds
  const ob = byId.get('w87344211');
  if (ob && !ov.skip.has('w87344211')) {
    const [cx, cz] = polyCentroid(ob.poly);
    const f = F_(cx, cz); f.setCell(F.stoneSash, F.stoneBlank, 0.2, seed).setTint(STONE);
    prism(f, cx, cz, 5, 8, 0, 25, { bayPerSide: true, vScale: 4.2, cap: true, capUv: 3 });
    f.setCell(F.stoneBlank); prism(f, cx, cz, 5.3, 8, 25, 26, { cap: true, capUv: 3 });
    const ro = R_(cx, cz); ro.setCell(ROOF_OFS + RC.lead).setTint(LEAD); cap(ro, cx, cz, 4, 8, 26, 2.2, 'cone', { uvScale: 2 });
    f.setCell(F.stoneBlank).setTint(STONE); prism(f, cx, cz, 1.2, 8, 28.2, 29.8, { cap: true }); // the globe-bearing figures, abstracted
  }
  // Martyrs' Memorial (St Giles): gothic spire in three tiers on steps
  const mm = map.pois.find((p) => p.name === "Martyrs' Memorial");
  if (mm && !ov.skip.has(mm.id)) {
    const [cx, cz] = mm.p;
    const f = F_(cx, cz); f.setCell(F.stoneBlank).setTint(0.96, 0.94, 0.88);
    prism(f, cx, cz, 4.0, 8, 0, 0.5, { cap: true, capUv: 3 }); prism(f, cx, cz, 3.3, 8, 0.5, 1.0, { cap: true, capUv: 3 });
    f.setCell(F.stoneGothic).setTint(0.96, 0.94, 0.88);
    prism(f, cx, cz, 2.2, 6, 1.0, 7.5, { bayPerSide: true, vScale: 6.5, cap: true, capUv: 3 });
    prism(f, cx, cz, 1.7, 6, 7.5, 12, { bayPerSide: true, vScale: 4.5, cap: true, capUv: 3 });
    prism(f, cx, cz, 1.2, 6, 12, 15.5, { bayPerSide: true, vScale: 3.5, cap: true, capUv: 3 });
    f.setCell(F.stoneBlank); spire(f, cx, cz, 1.1, 6, 15.5, 6.5);
    // crocketed pinnacles at the corners of the two lower tiers, and the cross (Scott, 1841-3, after the Eleanor crosses)
    f.setDetail(true);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; spire(f, cx + Math.cos(a) * 2.0, cz + Math.sin(a) * 2.0, 0.3, 4, 7.5, 2.6); spire(f, cx + Math.cos(a) * 1.5, cz + Math.sin(a) * 1.5, 0.24, 4, 12, 2.0); }
    orientedBox(f, cx, cz, 1, 0, 0.07, 0.07, 21.8, 23.0, { uvScale: 3.2 }); orientedBox(f, cx, cz, 1, 0, 0.32, 0.07, 22.4, 22.56, { uvScale: 3.2 });
    f.setDetail(false);
  }
}

/** One wall of a hand-built block: a -> c, facing (nx, nz), `bays` cells across and `rows` up. */
function face(buf, ax, az, bx, bz, y0, y1, nx, nz, bays, rows) {
  const flip = (bx - ax) * nz - (bz - az) * nx < 0;
  wallQuad(buf, ax, az, bx, bz, y0, y1, nx, nz, flip ? bays : 0, flip ? 0 : bays, 0, rows);
}
/** Four walls of an oriented box (centre, unit axis u, half sizes hl along u / hw across), bl / bw bays on the long / short pair. */
function boxStage(buf, cx, cz, ux, uz, hl, hw, y0, y1, bl, bw, rows) {
  const vx = -uz, vz = ux, P = (a, b) => [cx + ux * a + vx * b, cz + uz * a + vz * b];
  const c = [P(-hl, -hw), P(hl, -hw), P(hl, hw), P(-hl, hw)];
  face(buf, c[0][0], c[0][1], c[1][0], c[1][1], y0, y1, -vx, -vz, bl, rows);
  face(buf, c[1][0], c[1][1], c[2][0], c[2][1], y0, y1, ux, uz, bw, rows);
  face(buf, c[2][0], c[2][1], c[3][0], c[3][1], y0, y1, vx, vz, bl, rows);
  face(buf, c[3][0], c[3][1], c[0][0], c[0][1], y0, y1, -ux, -uz, bw, rows);
}
function lid(buf, cx, cz, ux, uz, hl, hw, y) {
  const vx = -uz, vz = ux, i = buf.n;
  for (const [a, b] of [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]]) { const x = cx + ux * a + vx * b, z = cz + uz * a + vz * b; buf.v(x, y, z, 0, 1, 0, x / 2.6, z / 2.6); }
  buf.quadFacing(i, i + 1, i + 2, i + 3, 0, 1, 0);
}
/**
 * A classical portico against the wall a -> c (outward = away from `centre`): columns on a stepped base, entablature,
 * pediment with a lead roof. ~75 triangles. o: {cols, r, colH, base, out (projection), ped (pediment height), width}
 */
function portico(F_, R_, a, c, centre, o) {
  const l = Math.hypot(c[0] - a[0], c[1] - a[1]), ux = (c[0] - a[0]) / l, uz = (c[1] - a[1]) / l, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
  let nx = uz, nz = -ux; if ((mx - centre[0]) * nx + (mz - centre[1]) * nz < 0) { nx = -nx; nz = -nz; }
  const W = Math.min(o.width || l, l), hw = W / 2, f = F_(mx, mz), y1 = o.base + o.colH, ent = o.colH * 0.13, tint = [1.14, 1.1, 1.0];
  const px = mx + nx * o.out / 2, pz = mz + nz * o.out / 2;                // middle of the portico floor
  f.setCell(F.stoneBlank).setTint(tint);
  orientedBox(f, px + nx * 0.35, pz + nz * 0.35, ux, uz, hw + 0.5, o.out / 2 + 0.6, 0, o.base, { uvScale: 3.2 });          // steps / stylobate
  for (let i = 0; i < o.cols; i++) {
    const t = -hw + o.r + ((W - 2 * o.r) * i) / (o.cols - 1), x = mx + ux * t + nx * (o.out - o.r), z = mz + uz * t + nz * (o.out - o.r);
    // pass 6: round (smooth-shaded) tapering shafts on a square plinth, with an echinus and abacus under the entablature
    const hc = o.r * 0.42, ha = o.r * 0.3, hb = o.r * 0.45;
    orientedBox(f, x, z, ux, uz, o.r * 1.22, o.r * 1.22, o.base, o.base + hb, { uvScale: 3.2 });
    shaft(f, x, z, o.r, o.r * 0.85, o.base + hb, y1 - hc - ha, 8);
    shaft(f, x, z, o.r * 0.85, o.r * (o.ionic ? 1.0 : 1.18), y1 - hc - ha, y1 - ha, 8);
    orientedBox(f, x, z, ux, uz, o.r * (o.ionic ? 1.5 : 1.24), o.r * 1.24, y1 - ha, y1, { uvScale: 3.2, bottom: true, top: false });
    f.spent += 40;
  }
  f.setCell(F.stoneBand).setTint(tint);
  orientedBox(f, px, pz, ux, uz, hw + 0.15, o.out / 2 + 0.1, y1, y1 + ent, { uvScale: 3.2, bottom: true, top: false });   // entablature (soffit seen from the street)
  // pediment: stone tympanum, two lead slopes running back to the wall
  const e0 = [mx - ux * (hw + 0.3) + nx * (o.out + 0.2), mz - uz * (hw + 0.3) + nz * (o.out + 0.2)], e1 = [mx + ux * (hw + 0.3) + nx * (o.out + 0.2), mz + uz * (hw + 0.3) + nz * (o.out + 0.2)];
  const yb = y1 + ent, yt = yb + o.ped, ap = [mx + nx * (o.out + 0.2), mz + nz * (o.out + 0.2)];
  f.setCell(F.stoneBlank).setTint(tint);
  const A = f.v(e0[0], yb, e0[1], nx, 0, nz, 0, 0), B = f.v(e1[0], yb, e1[1], nx, 0, nz, (W + 0.6) / 3.2, 0), C = f.v(ap[0], yt, ap[1], nx, 0, nz, (W + 0.6) / 6.4, o.ped / 3.2);
  f.triFacing(A, B, C, nx, 0, nz);
  const ro = R_(mx, mz); ro.setCell(ROOF_OFS + RC.lead).setTint(LEAD);
  for (const sg of [-1, 1]) {
    const e = sg < 0 ? e0 : e1, sx = ux * sg * o.ped, sy = hw + 0.3, sl = Math.hypot(o.ped, sy), nxx = sx / sl, nyy = sy / sl, nzz = (uz * sg * o.ped) / sl;
    const q0 = ro.v(e[0], yb, e[1], nxx, nyy, nzz, 0, 0), q1 = ro.v(ap[0], yt, ap[1], nxx, nyy, nzz, 0, sl / 2.6);
    const q2 = ro.v(ap[0] - nx * (o.out + 0.2), yt, ap[1] - nz * (o.out + 0.2), nxx, nyy, nzz, o.out / 2.6, sl / 2.6), q3 = ro.v(e[0] - nx * (o.out + 0.2), yb, e[1] - nz * (o.out + 0.2), nxx, nyy, nzz, o.out / 2.6, 0);
    ro.quadFacing(q0, q1, q2, q3, nxx, nyy, nzz);
  }
}

/** Round column shaft: n sides with radial vertex normals (smooth shading), radius r0 at y0 to r1 at y1. 2n triangles. */
function shaft(buf, cx, cz, r0, r1, y0, y1, n) {
  let pa = -1, pb = -1;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), u = (i / n) * (2 * Math.PI * r0) / 3.2;
    const A = buf.v(cx + c * r0, y0, cz + s * r0, c, 0, s, u, y0 / 3.2), B = buf.v(cx + c * r1, y1, cz + s * r1, c, 0, s, u, y1 / 3.2);
    if (pa >= 0) { const am = ((i - 0.5) / n) * Math.PI * 2; buf.quadFacing(pa, A, B, pb, Math.cos(am), 0, Math.sin(am)); }
    pa = A; pb = B;
  }
}

/** Masonry spire: n-gon cone using the facade atlas (stone) at (cx,cz), base radius r, from y0 rising h. */
function spire(buf, cx, cz, r, n, y0, h) {
  const top = buf.v(cx, y0 + h, cz, 0, 1, 0, 0, h / 3.2);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const nx = Math.cos(am), nz = Math.sin(am), ny = r / h, l = Math.hypot(nx, ny, nz);
    const A = buf.v(cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r, nx / l, ny / l, nz / l, 0, 0);
    const B = buf.v(cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r, nx / l, ny / l, nz / l, (2 * r * Math.sin(Math.PI / n)) / 3.2, 0);
    buf.triFacing(A, B, top, nx, ny, nz);
  }
}
