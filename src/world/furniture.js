// Street furniture from map POIs (+ generated street lamps): lamps, benches, bins, pillar boxes, bus stops/shelters,
// Sheffield bike stands, K6 phone boxes, traffic lights, bollards, Belisha beacons, picnic tables. All instanced.
// Night: lamp glass glows (emissive), additive light pools on the ground, and a small pool of PointLights is moved to
// the lamps nearest the player.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { InstanceSet } from './instancing.js';
import { paint, pointInPoly, distToSeg, hash01, SpatialGrid } from './util.js';
import { nearestRoad } from './roads.js';
import { ROUGH } from './textures.js';
import { barrierGap, barrierPush, SANITY } from '../systems/_clearance.js';

const C = { iron: 0x17181a, red: 0xb3140f, wood: 0x7a5434, grey: 0x8c9196, glass: 0x8fa4ae, gold: 0xb8933a, white: 0xeeeeea, amber: 0xffa21a, green: 0x1f4a2c, cream: 0xe8e0c8, dark: 0x0c0c0c };
const box = (w, h, d, col, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y + h / 2, z); return paint(g, col); };
const cyl = (r0, r1, h, seg, col, x = 0, y = 0, z = 0, open = false) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, open); g.translate(x, y + h / 2, z); return paint(g, col); };
const bar = (x0, y0, x1, y1, r, col, z = 0) => { const l = Math.hypot(x1 - x0, y1 - y0), g = new THREE.CylinderGeometry(r, r, l, 5, 1, true); g.rotateZ(-Math.atan2(x1 - x0, y1 - y0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z); return paint(g, col); };
const merge = (a) => mergeGeometries(a.map((g) => (g.index ? g : g)), false);

export const LAMP_HEAD_Y = 4.35;
function geoms() {
  const G = {};
  G.lampPost = merge([cyl(0.15, 0.11, 0.6, 6, C.iron, 0, 0, 0, true), cyl(0.07, 0.05, 3.6, 6, C.iron, 0, 0.6, 0, true), cyl(0.06, 0.12, 0.15, 6, C.iron, 0, 4.05, 0, true),   // (pass 5: the 12 cm collar at 1.2 m is gone: 12 triangles a lamp, spent on the landmarks)
   
    cyl(0.22, 0.05, 0.22, 4, C.iron, 0, 4.62), cyl(0.03, 0.03, 0.15, 4, C.iron, 0, 4.84, 0, true)]);
  G.lampHead = (() => { const g = new THREE.CylinderGeometry(0.2, 0.13, 0.42, 4); g.rotateY(Math.PI / 4); g.translate(0, 4.41, 0); return g; })();
  G.pool = (() => { const g = new THREE.PlaneGeometry(10, 10); g.rotateX(-Math.PI / 2); return g; })();
  G.bench = merge([box(1.8, 0.05, 0.45, C.wood, 0, 0.42, 0), box(1.8, 0.05, 0.06, C.wood, 0, 0.62, -0.22), box(1.8, 0.05, 0.06, C.wood, 0, 0.75, -0.24), box(1.8, 0.05, 0.06, C.wood, 0, 0.88, -0.26),
    box(0.06, 0.45, 0.5, C.iron, -0.8, 0, 0), box(0.06, 0.45, 0.5, C.iron, 0.8, 0, 0), box(0.06, 0.5, 0.05, C.iron, -0.8, 0.45, -0.25), box(0.06, 0.5, 0.05, C.iron, 0.8, 0.45, -0.25), box(0.06, 0.05, 0.45, C.iron, -0.8, 0.62, -0.02), box(0.06, 0.05, 0.45, C.iron, 0.8, 0.62, -0.02)]);
  // (photo comparison item 9: 0.46 m across, 0.95 m high, a dark posting aperture under the lid: it read as a bollard)
  G.bin = merge([cyl(0.21, 0.23, 0.7, 10, C.iron), cyl(0.233, 0.233, 0.05, 10, C.gold, 0, 0.5), cyl(0.205, 0.205, 0.12, 10, C.dark, 0, 0.7, 0, true), cyl(0.235, 0.235, 0.04, 10, C.iron, 0, 0.82), cyl(0.235, 0.08, 0.09, 10, C.iron, 0, 0.86)]);
  G.postBox = merge([cyl(0.27, 0.27, 0.12, 14, C.iron), cyl(0.25, 0.25, 1.2, 14, C.red, 0, 0.12), cyl(0.3, 0.3, 0.1, 14, C.red, 0, 1.32), (() => { const g = new THREE.SphereGeometry(0.28, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.45, 1); g.translate(0, 1.42, 0); return paint(g, C.red); })(), box(0.22, 0.04, 0.04, C.dark, 0, 1.12, 0.24), box(0.16, 0.12, 0.02, C.white, 0, 0.82, 0.25)]);
  G.busStop = merge([cyl(0.04, 0.04, 2.7, 6, C.grey), box(0.5, 0.38, 0.04, C.red, 0, 2.3, 0), box(0.42, 0.12, 0.05, C.white, 0, 2.42, 0), box(0.3, 0.45, 0.03, C.white, 0, 1.4, 0.04)]);
  G.shelter = merge([box(3.2, 0.08, 1.5, C.grey, 0, 2.4, 0), box(0.06, 2.4, 0.06, C.grey, -1.55, 0, -0.68), box(0.06, 2.4, 0.06, C.grey, 1.55, 0, -0.68), box(0.06, 2.4, 0.06, C.grey, -1.55, 0, 0.6), box(0.06, 2.4, 0.06, C.grey, 1.55, 0, 0.6),
    box(3.1, 1.9, 0.03, C.glass, 0, 0.35, -0.7), box(0.03, 1.9, 1.2, C.glass, -1.55, 0.35, -0.05), box(1.6, 0.04, 0.3, C.grey, 0.4, 0.55, -0.5), box(0.8, 1.4, 0.05, C.cream, -1.0, 0.6, -0.66)]);
  G.stand = merge([bar(-0.35, 0, -0.35, 0.7, 0.025, C.grey), bar(0.35, 0, 0.35, 0.7, 0.025, C.grey), bar(-0.35, 0.7, -0.25, 0.8, 0.025, C.grey), bar(0.35, 0.7, 0.25, 0.8, 0.025, C.grey), bar(-0.25, 0.8, 0.25, 0.8, 0.025, C.grey)]);
  G.phone = merge([box(0.96, 0.12, 0.96, C.red), box(0.9, 2.2, 0.9, C.red, 0, 0.12), box(0.62, 1.55, 0.94, 0x2a3036, 0, 0.55), box(0.94, 1.55, 0.62, 0x2a3036, 0, 0.55), box(0.94, 0.16, 0.94, C.cream, 0, 2.12),
    box(0.98, 0.1, 0.98, C.red, 0, 2.32), (() => { const g = new THREE.CylinderGeometry(0.46, 0.46, 0.18, 4, 1); g.rotateY(Math.PI / 4); g.scale(1.4, 1, 1.4); g.translate(0, 2.51, 0); return paint(g, C.red); })()]);
  G.signal = merge([cyl(0.07, 0.07, 2.9, 8, C.iron), box(0.32, 0.95, 0.24, C.dark, 0, 2.2, 0.1), cyl(0.09, 0.09, 0.03, 10, 0x6a0a0a, 0, 0, 0).rotateX(Math.PI / 2).translate(0, 2.98, 0.23), cyl(0.09, 0.09, 0.03, 10, 0x7a5a0a).rotateX(Math.PI / 2).translate(0, 2.68, 0.23), cyl(0.09, 0.09, 0.03, 10, 0x0a6a2a).rotateX(Math.PI / 2).translate(0, 2.38, 0.23)]);
  G.bollard = merge([cyl(0.085, 0.072, 0.85, 8, C.iron), cyl(0.08, 0.08, 0.05, 8, C.gold, 0, 0.7), (() => { const g = new THREE.SphereGeometry(0.075, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(0, 0.85, 0); return paint(g, C.iron); })()]);
  const bel = [];
  for (let i = 0; i < 6; i++) bel.push(cyl(0.05, 0.05, 0.4, 8, i % 2 ? C.white : C.dark, 0, i * 0.4));
  bel.push((() => { const g = new THREE.SphereGeometry(0.17, 10, 8); g.translate(0, 2.55, 0); return paint(g, C.amber); })());
  G.belisha = merge(bel);
  G.picnic = merge([box(1.8, 0.05, 0.75, C.wood, 0, 0.72, 0), box(1.8, 0.04, 0.28, C.wood, 0, 0.42, 0.55), box(1.8, 0.04, 0.28, C.wood, 0, 0.42, -0.55), bar(-0.7, 0, -0.7, 0.72, 0.04, C.wood, 0.4), bar(0.7, 0, 0.7, 0.72, 0.04, C.wood, -0.4)]);
  return G;
}

export function buildFurniture(ctx) {
  const { map, M, scene, ov } = ctx;
  const G = geoms();
  const fm = M.furniture;
  const mk = (name, geo, dist, cap, shadow = true) => new InstanceSet(scene, name, [{ meshes: [{ geometry: geo, material: fm, castShadow: shadow, colors: false }], maxDist: dist }], cap);
  const sets = {};
  // roughness pass: posts are not quite plumb. Most stand within a fraction of a degree, a few have been leant on or
  // backed into (up to `deg`); a hash of the spot, so every player sees the same lean. Visual only (colliders are upright).
  const lean = (x, z, deg) => {
    if (!ROUGH) return null;
    const a = hash01('lx' + x.toFixed(1) + ',' + z.toFixed(1)), b = hash01('lz' + x.toFixed(1) + ',' + z.toFixed(1)) * 6.2832, m = a * a * a * deg * 0.01745 / 1.4143;
    return [m * Math.cos(b), m * Math.sin(b)];
  };
  // 2026-11 placement pass: everything stands on the drawn ground (pavement 0.13, lawns 0.03 ...), not at y = 0; and
  // nothing goes into a building — the ones place modules rebuild by hand (overrides.skip) included — open water or a
  // drawn carriageway (the mapped POIs were moved out to the kerb by systems/_street_sanity.js; this keeps the rows of
  // bike stands, the shelters and the signal poles that are laid out from them out too)
  const gh = ctx.groundHeight || (() => 0), col = ctx.game && ctx.game.worldCollider;
  const skipB = new SpatialGrid(20);
  for (const b of map.buildings) if (!b.part && ov.skip.has(b.id) && (b.minH || 0) <= 2.5) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of b.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } skipB.insertBox(x0, z0, x1, z1, b); }
  const edgeD = (x, z, P) => { let d = 1e9; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; d = Math.min(d, distToSeg(x, z, a[0], a[1], c[0], c[1])); } return d; };
  const inBuilding = (x, z, pad = 0) => {
    let hit = false;
    const test = (b) => { if (b.part || (b.tags && b.tags.building === 'roof')) return; if ((pointInPoly(x, z, b.poly) && !(b.holes || []).some((h) => pointInPoly(x, z, h))) || (pad > 0 && edgeD(x, z, b.poly) < pad)) { hit = true; return true; } };
    ctx.buildingGrid.queryRadius(x, z, 1 + pad, (r) => test(r.b)); if (!hit) skipB.queryRadius(x, z, 1 + pad, test);
    return hit;
  };
  const inCarriage = (x, z, rad) => { let hit = false; ctx.roadGrid.queryRadius(x, z, 12, (it) => { if (it.kind === 'pedestrian' || (it.kind === 'service' && it.w < 3.5) || (it.road && (it.road.tunnel && it.road.tunnel !== 'building_passage'))) return; const d = distToSeg(x, z, it.ax, it.az, it.bx, it.bz); if (it.kind === 'service' ? d < it.w / 2 - 0.3 : d < it.w / 2 + rad - 0.05) { hit = true; return true; } }); return hit; };
  const onService = (x, z, rad) => { let hit = false; ctx.roadGrid.queryRadius(x, z, 8, (it) => { if (it.kind !== 'service' || it.w < 3.5 || (it.road && it.road.tunnel && it.road.tunnel !== 'building_passage')) return; if (distToSeg(x, z, it.ax, it.az, it.bx, it.bz) < it.w / 2 + rad) { hit = true; return true; } }); return hit; };
  const onPath = (x, z, rad) => { let hit = false; ctx.pathGrid.queryRadius(x, z, 6, (it) => { if (it.kind === 'steps' || it.road && it.road.footway === 'crossing') return; const d = distToSeg(x, z, it.ax, it.az, it.bx, it.bz), w = Math.max(1.2, Math.min(6, it.w)); if (d < w / 2 + rad - 0.05 && w / 2 + d - rad < 0.9) { hit = true; return true; } }); return hit; };
  const wet = (x, z) => !!(col && col.isWet(x, z));
  const clear = (x, z, rad) => !inBuilding(x, z, rad) && !inCarriage(x, z, rad) && !wet(x, z);
  const faceNearestWay = (x, z) => {
    let best = null, bd = 10;
    const test = (it) => { const d = distToSeg(x, z, it.ax, it.az, it.bx, it.bz); if (d < bd) { bd = d; best = it; } };
    ctx.roadGrid.queryRadius(x, z, 10, test); ctx.pathGrid.queryRadius(x, z, 10, test);
    if (!best) return { yaw: hash01(x * 7 + z) * 6.28, dir: 0 };
    const dx = best.bx - best.ax, dz = best.bz - best.az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - best.ax) * dx + (z - best.az) * dz) / l2));
    const px = best.ax + dx * t - x, pz = best.az + dz * t - z;
    return { yaw: Math.atan2(px, pz), dir: Math.atan2(dx, dz), d: bd, it: best };
  };

  // ---- street lamps: POIs + generated spots, deduped on a 9 m grid
  const lampGrid = new SpatialGrid(20), lamps = [];
  const addLampAt = (x, z) => {
    let clash = false; lampGrid.queryRadius(x, z, 9, (l) => { if (Math.hypot(l.x - x, l.z - z) < 9) { clash = true; return true; } });
    if (clash) return;
    const l = { x, z }; lampGrid.insertPoint(x, z, l); lamps.push(l);
  };
  for (const p of map.pois) if (p.kind === 'street_lamp' && !ov.skip.has(p.id) && clear(p.p[0], p.p[1], 0.13)) addLampAt(p.p[0], p.p[1]);
  for (const [x, z] of ctx.lampSpots) if (clear(x, z, 0.13)) addLampAt(x, z);
  const cap = lamps.length + 400;
  sets.lampPost = mk('lampPost', G.lampPost, 220, cap);     // (320 before the 2026-11 perf pass)
  sets.lampHead = new InstanceSet(scene, 'lampHead', [{ meshes: [{ geometry: G.lampHead, material: M.lampGlass, castShadow: false, colors: false }], maxDist: 1100 }], cap);
  sets.pool = new InstanceSet(scene, 'lampPool', [{ meshes: [{ geometry: G.pool, material: M.pool, castShadow: false, receiveShadow: false, colors: false }], maxDist: 160 }], cap);
  for (const m of sets.pool.meshes) m.renderOrder = 2;
  const addLamp = (x, z, y = 0, post = true) => {
    const ln = lean(x, z, 2);
    if (post) sets.lampPost.add(x, y, z, 0, 1, null, ln);
    sets.lampHead.add(x, y, z, 0, 1, null, post ? ln : null);
    const pool = sets.pool.add(x, 0.17, z, hash01(x + z * 3) * 6.28, 1);
    ctx.lampPositions.push(x, y + LAMP_HEAD_Y, z);
    return pool;      // (the pool's number: setPoolY)
  };
  for (const l of lamps) addLamp(l.x, l.z);

  // ---- POI furniture
  sets.bench = mk('bench', G.bench, 220, 1200);
  sets.bin = mk('bin', G.bin, 200, 800);
  sets.postBox = mk('postBox', G.postBox, 260, 200);
  sets.busStop = mk('busStop', G.busStop, 260, 300);
  sets.shelter = mk('shelter', G.shelter, 320, 200);
  sets.stand = mk('stand', G.stand, 110, 3000);
  sets.phone = mk('phone', G.phone, 320, 80);
  sets.signal = mk('signal', G.signal, 300, 300);
  sets.bollard = mk('bollard', G.bollard, 160, 600);
  sets.belisha = mk('belisha', G.belisha, 300, 300);
  sets.picnic = mk('picnic', G.picnic, 200, 100);
  const stands = (ctx.bikeStands = []), standGrid = new SpatialGrid(8);
  // (2026-11-24) the sites place modules rebuilt by hand (a mapped or added area they skip: a college inside its boundary
  // ring). A row of stands is laid out from the mapped point and slid back from the way, and where the way now runs wall
  // to wall (Brasenose Lane, places/exeter/_exeter_joins.js) it slid through the college's own wall - not a map building,
  // not a mapped barrier - onto the Mound of the Fellows' Garden, 3.2 m above the lane, and was drawn at the lane's level
  // under it. No stand is stood inside such a site: the module owns what stands there.
  const siteGrid = new SpatialGrid(40);
  for (const a of map.areas) if (ov.skip.has(a.id) && a.kind !== 'water' && a.poly && a.poly.length > 2) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [px, pz] of a.poly) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); } siteGrid.insertBox(x0, z0, x1, z1, a); }
  const inSite = (x, z) => { let hit = false; siteGrid.queryRadius(x, z, 0.5, (a) => { if (pointInPoly(x, z, a.poly)) { hit = true; return true; } }); return hit; };
  // the mapped furniture, for the shelters to keep clear of (a shelter is not built over a bench or a bin)
  const BARRIER_PAD = { bench: 0.3, waste_basket: 0.27, post_box: 0.32, telephone: 0.52, picnic_table: 0.95 };   // (how far the thing reaches towards a wall behind it)
  const POI_R = { bench: 0.95, waste_basket: 0.3, post_box: 0.35, telephone: 0.6, picnic_table: 1.2, bicycle_parking: 1.5 };
  const poiGrid = new SpatialGrid(8); for (const p of map.pois) if (POI_R[p.kind] && !ov.skip.has(p.id)) poiGrid.insertPoint(p.p[0], p.p[1], [p.p[0], p.p[1], POI_R[p.kind]]);
  const poiOther = new SpatialGrid(8), crossGrid = new SpatialGrid(16);
  for (const p of map.pois) { if (ov.skip.has(p.id)) continue; if (POI_R[p.kind] && p.kind !== 'bicycle_parking') poiOther.insertPoint(p.p[0], p.p[1], [p.p[0], p.p[1], POI_R[p.kind]]); else if (p.kind === 'crossing' || p.kind === 'traffic_signals') { const nr = nearestRoad(ctx, p.p[0], p.p[1], 8); if (!nr) continue; const it = nr.it, l = Math.hypot(it.bx - it.ax, it.bz - it.az) || 1, nx = -(it.bz - it.az) / l, nz = (it.bx - it.ax) / l, cx = it.ax + (it.bx - it.ax) * nr.t, cz = it.az + (it.bz - it.az) * nr.t; for (const sd of [1, -1]) for (const q of [0.3, 0.9, 1.5]) { const kx = cx + nx * sd * (it.w / 2 + q), kz = cz + nz * sd * (it.w / 2 + q); crossGrid.insertPoint(kx, kz, [kx, kz]); } } }
  const onPoiOther = (x, z, rad) => { let hit = false; poiOther.queryRadius(x, z, rad + 1.6, (q) => { if (Math.hypot(q[0] - x, q[1] - z) < q[2] + rad) { hit = true; return true; } }); return hit; };
  const onPoi = (x, z, rad) => { let hit = false; poiGrid.queryRadius(x, z, rad + 1.6, (q) => { if (Math.hypot(q[0] - x, q[1] - z) < q[2] + rad) { hit = true; return true; } }); return hit; };
  for (const p of map.pois) {
    if (ov.skip.has(p.id)) continue;
    let [x, z] = p.p;
    if (POI_R[p.kind] && p.kind !== 'bicycle_parking' && inBuilding(x, z, 0)) continue;     // inside a building (or one a place module rebuilt)
    // 2026-11 sanity check: a bench, bin, pillar box or phone box mapped against a garden wall that is drawn as a hedge
    // (0.9 m of leaves; the map sanity pass runs before the place modules turn walls into hedges) stands clear of the
    // drawn face, where that spot is free
    if (SANITY && BARRIER_PAD[p.kind]) { const q = barrierPush(col, x, z, BARRIER_PAD[p.kind]); if ((q[0] !== x || q[1] !== z) && clear(q[0], q[1], 0.2)) { x = q[0]; z = q[1]; } }
    const y = gh(x, z);
    switch (p.kind) {
      case 'bench': { const f = faceNearestWay(x, z); sets.bench.add(x, y, z, f.yaw, 1); break; }
      case 'waste_basket': sets.bin.add(x, y, z, ROUGH ? hash01(p.id) * 6.28 : 0, 1, null, lean(x, z, 4.5)); break;
      case 'post_box': sets.postBox.add(x, y, z, faceNearestWay(x, z).yaw, 1, null, lean(x, z, 1.5)); break;
      case 'telephone': sets.phone.add(x, y, z, faceNearestWay(x, z).yaw, 1); break;
      case 'picnic_table': sets.picnic.add(x, y, z, hash01(p.id) * 3, 1); break;
      case 'bus_stop': {
        const nr = nearestRoad(ctx, x, z, 14);
        let yaw = 0;
        if (nr) { const it = nr.it, px = it.ax + (it.bx - it.ax) * nr.t - x, pz = it.az + (it.bz - it.az) * nr.t - z; yaw = Math.atan2(px, pz); }
        sets.busStop.add(x, y, z, yaw, 1, null, lean(x, z, 3));
        if (nr && (nr.it.kind === 'primary' || nr.it.kind === 'secondary' || nr.it.kind === 'tertiary') && hash01(p.id) < 0.6) {
          // the shelter stands behind the pole and to one side of it: the first of a few spots that is clear of buildings,
          // the road, water and the line of a footway (a 3.2 x 1.5 m box: corners and middle tested)
          const fx = Math.sin(yaw), fz = Math.cos(yaw), ax = Math.cos(yaw), az = -Math.sin(yaw);
          for (const [back, side] of [[1.2, 2.2], [1.2, -2.2], [0.95, 2.4], [0.95, -2.4], [1.5, 2.2], [1.5, -2.2]]) {
            const sx = x - fx * back + ax * side, sz = z - fz * back + az * side;
            let good = !onPath(sx, sz, 0.75) && !onPoi(sx, sz, 1.3);
            for (const [u, v] of [[0, 0], [1.6, 0.75], [-1.6, 0.75], [1.6, -0.75], [-1.6, -0.75]]) { if (!good) break; if (!clear(sx + ax * u + fx * v, sz + az * u + fz * v, 0.02)) good = false; }
            if (SANITY) for (const [u, v] of [[0, -0.75], [1.6, -0.75], [-1.6, -0.75], [0.8, -0.75], [-0.8, -0.75], [1.6, 0], [-1.6, 0], [1.6, 0.75], [-1.6, 0.75]]) { if (!good) break; if (barrierGap(col, sx + ax * u + fx * v, sz + az * u + fz * v, 0.4) < 0.03) good = false; }     // (not in the leaves of a hedge / the stone of a wall)
            if (good) { sets.shelter.add(sx, gh(sx, sz), sz, yaw, 1); break; }
          }
        }
        break;
      }
      case 'bicycle_parking': {
        // 2026-11 sanity check: ONE layout of Sheffield stands per mapped bike park, this one (systems/vehicles.js laid a
        // second, differently spaced row over it and stood its bikes on that: doubled stands everywhere). A big park is
        // two rows. A stand is only stood where a bike locked to it has room: the whole bike's length either side clear
        // of buildings, the DRAWN thickness of walls and hedges (`barrierGap`), trunks, the carriageway, service roads,
        // water, the walking line of a path and other bike parks' stands, and both its wheels on one level (not half up
        // a kerb). The row as a whole is slid back from the way (up to 1.2 m) when that lets more of it stand.
        const f = faceNearestWay(x, z), dir = f.dir || 0;
        if (!SANITY) {     // (?sanity=0: the single row as it was)
          const n0 = Math.max(1, Math.min(12, Math.round((+p.capacity || 6) / 2))), ax = Math.sin(dir), az = Math.cos(dir), ex = Math.cos(dir) * 0.45, ez = -Math.sin(dir) * 0.45;
          for (let i = 0; i < n0; i++) {
            const o = (i - (n0 - 1) / 2) * 1.0, sx = x + ax * o, sz = z + az * o;
            if (!clear(sx + ex, sz + ez, 0.05) || !clear(sx - ex, sz - ez, 0.05) || onService(sx + ex, sz + ez, 0.05) || onService(sx - ex, sz - ez, 0.05)) continue;
            sets.stand.add(sx, gh(sx, sz), sz, dir, 1, null, lean(sx, sz, 3)); stands.push({ x: sx, z: sz, heading: dir + Math.PI / 2, poi: p.id });
          }
          break;
        }
        const cap = Math.max(2, Math.min(60, parseInt(p.capacity, 10) || 6));
        const rows = cap > 28 ? 2 : 1, n = Math.max(1, Math.min(14, Math.ceil(cap / 2 / rows)));
        const ax = Math.sin(dir), az = Math.cos(dir), ex = Math.cos(dir), ez = -Math.sin(dir);   // along the row / along a bike
        const good = (sx, sz) => {
          for (const u of [-0.85, -0.45, 0, 0.45, 0.85]) {
            const qx = sx + ex * u, qz = sz + ez * u;
            if (!clear(qx, qz, 0.05) || onService(qx, qz, 0.05) || barrierGap(col, qx, qz, 0.5) < 0.1) return false;
            if (col && !col.isFree(qx, qz, 0.1)) return false;                          // (trunks, walls a module added)
          }
          if (Math.abs(gh(sx + ex * 0.55, sz + ez * 0.55) - gh(sx - ex * 0.55, sz - ez * 0.55)) > 0.05) return false;
          if (onPath(sx, sz, 0.4) || onPoiOther(sx, sz, 0.45)) return false;
          if (inSite(sx, sz)) return false;                                            // (a site a place module rebuilt: above)
          // (not on the walking line of a crossing, where it leaves the kerb)
          let cross = false; crossGrid.queryRadius(sx, sz, 1.4, (c) => { if (Math.hypot(sx - c[0], sz - c[1]) < 1.15) { cross = true; return true; } });
          if (cross) return false;
          let dup = false; standGrid.queryRadius(sx, sz, 0.8, (q) => { if (Math.hypot(q[0] - sx, q[1] - sz) < 0.7) { dup = true; return true; } });
          return !dup;
        };
        const spots = (shift) => {
          const out = [];
          for (let row = 0; row < rows; row++) for (let i = 0; i < n; i++) {
            const o = (i - (n - 1) / 2) * 0.95, ro = (row - (rows - 1) / 2) * 2.6 + shift, sx = x + ax * o + ex * ro, sz = z + az * o + ez * ro;
            if (good(sx, sz)) out.push([sx, sz]);
          }
          return out;
        };
        let best = spots(0);
        if (best.length < rows * n) for (const sh of [0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) { const q = spots(sh); if (q.length > best.length) { best = q; if (q.length === rows * n) break; } }
        for (const [sx, sz] of best) {
          const yaw = dir; // stand plane perpendicular to the row: local +z (normal) along the row
          sets.stand.add(sx, gh(sx, sz), sz, yaw, 1, null, lean(sx, sz, 3));
          standGrid.insertPoint(sx, sz, [sx, sz]);
          // a parked bike runs along the stand's local x axis
          stands.push({ x: sx, z: sz, heading: yaw + Math.PI / 2, poi: p.id });
        }
        break;
      }
    }
  }
  for (const g of map.gates) if (g.kind === 'bollard' && !ov.skip.has(g.id) && !inBuilding(g.p[0], g.p[1], 0)) sets.bollard.add(g.p[0], gh(g.p[0], g.p[1]), g.p[1], 0, 1, null, lean(g.p[0], g.p[1], 5));
  // (2026-11-24: a pole is not stood in the stone of a wall. The spot is 0.5 m behind the kerb, and on Hythe Bridge
  //  Street Worcester's rubble wall, places/worcester_south.js, is 0.45 m behind it: the pole stood in the wall's face.
  //  Where a wall's or hedge's drawn face is nearer than the pole is thick, the pole comes out towards the kerb.)
  for (const [x0, z0, yaw] of ctx.signalSpots) {
    let x = x0, z = z0;
    if (SANITY && barrierGap(col, x, z, 0.5) < 0.1) { const q = barrierPush(col, x, z, 0.16, 0.5); if (clear(q[0], q[1], 0.1)) { x = q[0]; z = q[1]; } }
    if (clear(x, z, 0.1)) sets.signal.add(x, gh(x, z), z, yaw, 1, null, lean(x, z, 1.5));
  }
  for (const [x, z] of ctx.belishaSpots) if (clear(x, z, 0.06)) sets.belisha.add(x, gh(x, z), z, 0, 1, null, lean(x, z, 3));

  // ---- pooled point lights near the player
  const NL = 4, lights = [];
  for (let i = 0; i < NL; i++) {
    const l = new THREE.PointLight(0xffc690, 0, 24, 1.7);
    l.name = 'world:lampLight'; l.castShadow = false; scene.add(l); lights.push(l);
  }
  const bestD = new Float32Array(NL), bestI = new Int32Array(NL);
  // ---- graphics pass 1: with WEBGL_multi_draw every iron/wood/paint item is drawn by TWO BatchedMeshes (shadow casters /
  // the rest) instead of one InstancedMesh per kind (~12 draws -> 2 + 1 shadow). The InstanceSets stay the data store.
  const BATCHED = ['lampPost', 'bench', 'bin', 'postBox', 'busStop', 'shelter', 'stand', 'phone', 'signal', 'bollard', 'belisha', 'picnic'];
  let batched = null;
  try {
    const R = ctx.game && ctx.game.renderer;
    if (R && R.extensions && R.extensions.has && R.extensions.has('WEBGL_multi_draw') && THREE.BatchedMesh) batched = makeBatched();
  } catch (e) { console.warn('[world] furniture batching off', e); batched = null; }
  function makeBatched() {
    const geos = BATCHED.map((k) => sets[k].bands[0].meshes[0].geometry);
    let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : 0; }
    const mkB = (name, cast) => {
      const b = new THREE.BatchedMesh(2400, nv, ni, fm);
      b.name = 'world:' + name; b.castShadow = cast; b.receiveShadow = true; b.frustumCulled = false; b.perObjectFrustumCulled = true; b.sortObjects = false;
      b.matrixAutoUpdate = false; b.updateMatrix();
      const ids = geos.map((g) => b.addGeometry(g));
      for (let i = 0; i < 2400; i++) { b.addInstance(ids[0]); b.setVisibleAt(i, false); }
      scene.add(b);
      return { b, ids, used: 0 };
    };
    for (const k of BATCHED) for (const m of sets[k].meshes) { m.visible = false; m.userData.batched = true; }
    return { cast: mkB('furnitureCast', true), rest: mkB('furniture', false), lastX: 1e9, lastZ: 1e9 };
  }
  const _bm = new THREE.Matrix4();
  function refreshBatched(cx, cz, force) {
    const B = batched, dx0 = cx - B.lastX, dz0 = cz - B.lastZ;
    if (!force && dx0 * dx0 + dz0 * dz0 < 100) return;
    B.lastX = cx; B.lastZ = cz;
    let nc = 0, nr = 0;
    for (let k = 0; k < BATCHED.length; k++) {
      const set = sets[BATCHED[k]], band = set.bands[0], lim = band.maxDist * band.maxDist, XZ = set.xz;
      const toCast = set.meshes[0].castShadow;    // per-kind shadow flag, set by setQuality
      const T = toCast ? B.cast : B.rest;
      for (let i = 0; i < set.n; i++) {
        const dx = XZ[i * 2] - cx, dz = XZ[i * 2 + 1] - cz;
        if (dx * dx + dz * dz > lim) continue;
        const slot = toCast ? nc : nr; if (slot >= 2400) continue;
        _bm.fromArray(set.mat, i * 16);
        T.b.setGeometryIdAt(slot, T.ids[k]); T.b.setMatrixAt(slot, _bm); T.b.setVisibleAt(slot, true);
        if (toCast) nc++; else nr++;
      }
    }
    for (const [T, n] of [[B.cast, nc], [B.rest, nr]]) { for (let i = n; i < T.used; i++) T.b.setVisibleAt(i, false); T.used = n; T.b.visible = n > 0; }
  }

  let timer = 0, lampLit = true, lampFar = 1100;
  const LAMP_DAY = 240;
  const list = Object.values(sets);
  ctx.stats.lamps = lamps.length; ctx.stats.bikeStands = stands.length;
  return {
    sets, lights, addLamp,
    /** a lamp's pool of light at another height (m): a place's own floor under a lamp it added, see world.addLampGlow */
    setPoolY(i, y) { if (i >= 0 && i < sets.pool.n) { sets.pool.mat[i * 16 + 13] = y; sets.pool.lastX = 1e9; } },
    refresh(cx, cz, force) {
      for (const s of list) if (!batched || !s.meshes[0].userData.batched) s.refresh(cx, cz, force, 10);
      if (batched) refreshBatched(cx, cz, force);
    },
    get batched() { return !!batched; },
    /** quality tier: draw distances (×t.furniture; lamp heads t.lampHeadFar) and which sets cast shadows */
    setQuality(t) {
      for (const [k, set] of Object.entries(sets)) {
        const b = set.bands[0];
        if (b.base === undefined) { b.base = b.maxDist; b.cast = set.meshes.map((m) => m.castShadow); }
        if (k === 'lampHead') lampFar = t.lampHeadFar;
        b.maxDist = k === 'lampHead' ? (lampLit ? lampFar : LAMP_DAY) : k === 'pool' ? b.base : Math.round(b.base * t.furniture);
        set.meshes.forEach((m, i) => { m.castShadow = b.cast[i] && (t.furnitureShadows || k === 'lampPost' || k === 'shelter'); });
      }
      if (batched) batched.lastX = 1e9;
    },
    update(dt, px, pz, night) {
      // unlit lamp heads are invisible far away by day: short draw distance until dusk
      const lit = night > 0.25;
      if (lit !== lampLit) { lampLit = lit; sets.lampHead.bands[0].maxDist = lit ? lampFar : LAMP_DAY; sets.lampHead.refresh(px, pz, true); }
      M.pool.opacity = night * 0.9;
      M.pool.visible = night > 0.02;
      timer -= dt;
      if (timer <= 0) {
        timer = 0.35;
        bestD.fill(1e12); bestI.fill(-1);
        const L = ctx.lampPositions;
        for (let i = 0, n = L.length / 3; i < n; i++) {
          const dx = L[i * 3] - px, dz = L[i * 3 + 2] - pz, d = dx * dx + dz * dz;
          if (d >= bestD[NL - 1]) continue;
          let k = NL - 1; while (k > 0 && bestD[k - 1] > d) { bestD[k] = bestD[k - 1]; bestI[k] = bestI[k - 1]; k--; }
          bestD[k] = d; bestI[k] = i;
        }
        for (let k = 0; k < NL; k++) {
          const i = bestI[k];
          if (i >= 0 && bestD[k] < 80 * 80) lights[k].position.set(L[i * 3], L[i * 3 + 1] - 0.3, L[i * 3 + 2]);
          else lights[k].position.set(0, -1000, 0);
        }
      }
      const I = night > 0.05 ? night * 14 : 0;
      for (let k = 0; k < NL; k++) lights[k].intensity = I;
    },
  };
}
