// Worcester College grounds: the lake and its birds (with "[E] Feed the ducks"), the croquet lawn by the Earl Building
// (Association Croquet minigame), the playing fields with the cricket pavilion, tennis courts and rugby posts, and the
// gardens (Provost's Garden, Orchard, Nuffield Lawn). Coordinates: docs/research/worcester.md, _worcester_shared.js.
// Helpers: _grounds_util.js (geometry accumulator), _grounds_static.js (scenery), _grounds_birds.js (flock),
// _grounds_croquet.js (+ _grounds_croquet_rules.js, pure; tested by tools/smoke_croquet.mjs).
import * as THREE from 'three';
import { WORC } from './_worcester_shared.js';
import { Acc, pip, dSeg, dRing, alongRing } from './_grounds_util.js';
import * as S from './_grounds_static.js';
import { createBirds } from './_grounds_birds.js';
import { createCroquet } from './_grounds_croquet.js';

const PAVILION = 'w154770764';
// Croquet court (full size 35 x 28 yd = 32 x 25.6 m): north-east corner of the playing fields, beside the path between
// the Sultan Nazrin Shah Centre and the lake, ~60 m south-west of the Earl Building. Long axis at 42° (parallel to the
// path). Verified against the map: on grass, >= 3 m from paths, buildings and water (see report / console log).
const COURT = { cx: -436, cz: -124, ang: (42 * Math.PI) / 180 };
// The square, from the owner's bird's-eye picture (2026-11-22): its middle is about 23 m east of where it was drawn
// (-514, -118) and the strips run north-west to south-east (47 degrees east of south), not across the pavilion's view
const CRICKET = { cx: -491, cz: -115, axis: 0.82 };
const CENTRE = [-450, -60];       // middle of the grounds, for distance culling
// 2026-11-22, the owner: "dont worry about the 2013 game era thing, its fine to use up to date data". The Sultan Nazrin
// Shah Centre (2017) is seen beside the field in the aerial pictures of today, so it stands again: a low pale limestone
// block with a flat roof and its taller auditorium (the generic builder's: the curved stone screen, the oak pergola and
// the glazed foyer are not modelled; GUESS: plain stone walls). `?snsc=0` (node: GTO_SNSC=0) puts the 2013 grass back.
const SNSC_BUILT = !((typeof location !== 'undefined' && location && /[?&]snsc=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_SNSC === '0'));
const SNSC_STYLE = { wall: 'stone', tint: [1.12, 1.1, 1.04], roof: 'flat', crenel: false, ivy: false, up: 'stoneBlank', ground: 'stoneBlank', door: 'stoneDoor' };

export default {
  id: 'worcester_grounds',
  preMap(game) {
    game.overrides.skip.add(PAVILION);
    // era c. 2013 (user decision): the Sultan Nazrin Shah Centre (OSM w131313832) opened in 2017 on what was the edge
    // of the playing field, and the generic city builder drew it as a battlemented stone block. Not built yet.
    if (SNSC_BUILT) game.overrides.style.set('w131313832', { ...SNSC_STYLE, storeys: 1 }); else game.overrides.skip.add('w131313832');
    // ... and its auditorium, mapped as a separate building part (w721939492), was still drawn: a stone drum standing
    // alone on bare paving at the corner of the field. Skipped too, and the site (which no mapped area covers) is
    // grass with the odd tree, as the edge of the playing field. GUESS: what stood here in 2013 is not known; the
    // outline shares its vertices with the field, the wood, the garden strip by the Earl Building and the ponds.
    if (SNSC_BUILT) game.overrides.style.set('w721939492', SNSC_STYLE); else game.overrides.skip.add('w721939492');
    if (!SNSC_BUILT && game.map && game.map.areas && !game.map.areas.some((a) => a.id === 'worc_snsc_site')) game.map.areas.push({ id: 'worc_snsc_site', kind: 'park', poly: [
      [-458.5, -166.7], [-450.3, -166.7], [-433.5, -180.2], [-425.9, -180.3], [-420.9, -177.4], [-415.8, -180.6], [-411.7, -185.0],
      [-406.2, -169.9], [-409.6, -166.0], [-412.2, -162.6], [-407.9, -158.7], [-404.1, -155.3], [-398.1, -149.4],
      [-403.2, -145.8], [-409.3, -138.9], [-404.6, -134.2], [-404.5, -132.6], [-404.4, -130.9], [-408.2, -126.0], [-408.1, -122.5], [-456.2, -165.2]] });
  },
  install(game) {
    const world = game.world, map = game.map, col = game.worldCollider;
    const area = (id) => map.areas.find((a) => a.id === id);
    const lake = area(WORC.lake || 'r1103089'), field = area('w23153013'), orchard = area('r18123045'), provost = area('w849457930'), nuffield = area('r4008715');
    const tennis = ['w925090776', 'w925090777', 'w925090778'].map(area).filter(Boolean);
    const lakeOuter = lake.poly, lakeHole = (lake.holes && lake.holes[0]) || [];
    const nearBuildings = map.buildings.filter((b) => b.c[0] < -300 && b.c[0] > -700 && b.c[1] > -260 && b.c[1] < 160).map((b) => b.poly);
    const pathSegs = [];
    for (const r of map.roads) for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; if (Math.min(a[0], b[0]) < -300 && Math.max(a[0], b[0]) > -700 && Math.min(a[1], b[1]) < 160 && Math.max(a[1], b[1]) > -260) pathSegs.push([a[0], a[1], b[0], b[1], r.w]); }
    const pathDist = (x, z) => { let d = 1e9; for (const s of pathSegs) d = Math.min(d, dSeg(x, z, s[0], s[1], s[2], s[3]) - s[4] / 2); return d; };
    const inBuilding = (x, z) => nearBuildings.some((p) => pip(x, z, p));
    const mine = (x, z) => x < -324 && !(x > -372 && z < -112);   // stay out of the college + the Worcester Place court
    // (2026-11-22) places/worcester_lake.js builds the bridges, the weirs, the kerb and the old gateway: this module's
    // trees, benches and reeds keep off them (keep), reeds off the stone kerb (hard), and its plain bridge rails go
    const WL = game.worcesterLake && game.worcesterLake.on ? game.worcesterLake : null;
    // ... and places/worcester_gardens.js plants every measured tree as a map tree (near model / far card, not full
    // geometry at any distance like the belt below) and builds the rose garden: this module's own trees and beds go
    const WG = !!(game.worcesterGardens && game.worcesterGardens.on);
    // ... and places/worcester_fields.js (work package J) builds the pavilion, the tennis courts with their fence, the
    // nets, the cricket table and the rugby posts from the planning drawings and the photographs: this module's own
    // pavilion, square, posts and courts stand down (the croquet lawn and the birds stay here)
    const WF = game.worcesterFields && game.worcesterFields.on ? game.worcesterFields : null;

    const group = new THREE.Group(); group.name = 'worcester-grounds';
    const accs = { props: new Acc(), ground: new Acc(), plain: new Acc(), lines: new Acc() };

    // clear the scattered park trees off the playing fields (cricket, croquet); the woods around the edge stay
    world.clearArea(field.poly, { furniture: false, lamps: false });

    // ---------------------------------------------------------------- pavilion
    const pb = map.buildings.find((b) => b.id === PAVILION);
    const foot = pb ? [pb.poly[0], pb.poly[1], pb.poly[4], pb.poly[5]] : [[-506, -25.7], [-503.8, -35.9], [-489.4, -32.9], [-491.6, -22.7]];
    const mats = { weather: new THREE.MeshStandardMaterial({ map: S.weatherboardTexture(), roughness: 0.8 }), scoreboard: new THREE.MeshBasicMaterial({ map: S.scoreboardTexture() }), roof: (() => { const m = world.mats.tile.clone(); m.color = new THREE.Color(0x8a6e62); return m; })() };
    const pav = WF ? null : S.buildPavilion(world, accs, foot, mats);
    if (pav) {
      for (const m of pav.meshes) group.add(m);
      col.addPolygon(pb ? pb.poly : foot, { tag: 'building' });
      // a couple of benches along the boundary in front of the pavilion
      for (const s of [-9, 9]) { const [x, z] = pav.frontPoint(s, 9); S.bench(accs.props, x, z, pav.heading); }
    }

    // ---------------------------------------------------------------- croquet (uses the shared accumulators)
    const croquet = createCroquet(game, { accs, frame: COURT, bench: S.bench });
    const cc = croquet.corners;
    console.log('[gto] worcester_grounds: croquet court (full size 32 x 25.6 m) corners', cc.map((p) => `(${p[0].toFixed(1)}, ${p[1].toFixed(1)})`).join(' '));
    game.croquet = croquet;
    const courtPoly = [croquet.toW(-4, -4), croquet.toW(29.6, -4), croquet.toW(29.6, 36), croquet.toW(-4, 36)];

    // ---------------------------------------------------------------- cricket, rugby, tennis
    if (!WF) {
      S.buildCricket(accs, field.poly, [CRICKET.cx, CRICKET.cz], CRICKET.axis,
        (x, z) => pip(x, z, courtPoly) || Math.hypot(x - pav.front[0], z - pav.front[1]) < 9, col);
      const rugbyH = Math.atan2(1, -0.1);
      for (const e of [-1, 1]) {
        const x = -550 + Math.sin(rugbyH) * 50 * e, z = -140 + Math.cos(rugbyH) * 50 * e;      // (west of the square: a post stood on it at -525, -118)
        if (pip(x, z, field.poly) && dRing(x, z, field.poly) > 4 && !pip(x, z, courtPoly)) S.rugbyPosts(accs.props, x, z, rugbyH, col);
      }
      S.buildTennis(accs, tennis.map((t) => t.poly), col);
    }

    // ---------------------------------------------------------------- trees
    const trees = [];
    const landSide = (q, dist) => {   // point `dist` m from a lake edge sample q=[x,z,heading], on the land side
      const nx = Math.cos(q[2]), nz = -Math.sin(q[2]);
      for (const sgn of [1, -1]) { const x = q[0] + nx * dist * sgn, z = q[1] + nz * dist * sgn; if (!col.isWater(x, z) && !pip(x, z, lakeOuter)) return [x, z]; }
      return null;
    };
    const okLand = (x, z, clear = 2.5) => mine(x, z) && !col.isWater(x, z) && !inBuilding(x, z) && pathDist(x, z) > clear && !(WL && WL.keep(x, z)) && !(WF && WF.keep(x, z));
    // weeping willows at the lake margins
    const edge = alongRing(lakeOuter, 1);
    for (const k of [40, 95, 150, 215, 300, 360, 410]) {
      const q = edge[Math.floor((k / 440) * edge.length) % edge.length]; const p = q && landSide(q, 3.2);
      if (p && okLand(p[0], p[1], 2) && p[1] > -105) trees.push({ sp: 'willow', x: p[0], z: p[1], h: 9 + (k % 3) });
    }
    // stone pass (2026-11, photographs: worc_lake2): the lake is enclosed by dense trees overhanging the water — horse
    // chestnut, lime, alder, willow — not open lawn. A belt of broadleaves 2-3 m in from the edge every ~7 m, broad
    // crowns reaching out over the water; kept off the paths, the benches' spots, the duck-feeding places and the
    // footbridges, and clear of the willows above
    const FEED = [[-400, 39.6], [-381, -92.3], [-469.2, -24.5]], BRIDGES = ['w1480325737', 'w1480325741', 'w849457924'].map((id) => map.roads.find((r) => r.id === id)).filter(Boolean);
    const nearBridge = (x, z) => BRIDGES.some((r) => { for (let i = 0; i < r.pts.length - 1; i++) if (dSeg(x, z, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]) < 6) return true; return false; });
    const BELT = [0x4e6e2c, 0x5a7a34, 0x466a30, 0x62803a, 0x3f6228];
    for (let k = 0; k < edge.length; k += 7) {
      const q = edge[k], hk = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
      const p = q && landSide(q, 2.2 + hk * 1.2); if (!p) continue;
      if (!okLand(p[0], p[1], 1.6) || p[1] < -108 || FEED.some(([x, z]) => Math.hypot(p[0] - x, p[1] - z) < 6) || nearBridge(p[0], p[1])) continue;
      if (trees.some((t) => Math.hypot(t.x - p[0], t.z - p[1]) < 5.5)) continue;
      if ([0.17, 0.21, 0.25, 0.04].some((f) => Math.abs(k - Math.floor(f * edge.length)) < 5)) continue;   // the benches on the bank (below)
      const h = 11 + hk * 6;
      trees.push({ sp: hk < 0.18 ? 'willow' : 'broad', x: p[0], z: p[1], h, w: h * (0.8 + hk * 0.25), color: BELT[k % BELT.length] });
    }
    // the island: a willow and an alder-ish broadleaf (geese and swans nest under them)
    if (lakeHole.length) {
      const ix = lakeHole.reduce((a, p) => a + p[0], 0) / lakeHole.length, iz = lakeHole.reduce((a, p) => a + p[1], 0) / lakeHole.length;
      trees.push({ sp: 'willow', x: ix - 1.2, z: iz + 1.0, h: 8 }, { sp: 'broad', x: ix + 1.6, z: iz - 1.3, h: 7, color: 0x4e7030 });
    }
    // the Orchard: rows of small apple and pear trees (west of the college buildings only)
    let fruit = 0;
    for (let x = -366; x < -326; x += 6.5) for (let z = -100; z < -34; z += 6.5) {
      const jx = x + Math.sin(z * 1.7) * 0.6, jz = z + Math.cos(x * 1.3) * 0.6;
      if (pip(jx, jz, orchard.poly) && okLand(jx, jz, 2.2) && dRing(jx, jz, orchard.poly) > 2) { trees.push({ sp: 'broad', x: jx, z: jz, h: 3.8 + ((jx * 13 + jz * 7) % 1.5), w: 4.2, color: 0x7a9a3a }); fruit++; }
    }
    // Nuffield Lawn arboretum: a couple of extra specimen planes on the open lawn (x < -330)
    let spec = 0;
    for (const [x, z] of [[-395, 62], [-372, 78], [-352, 95], [-338, 72]]) {
      const farFromMapTrees = map.trees.every((t) => Math.hypot(t[0] - x, t[1] - z) > 9);
      if (pip(x, z, nuffield.poly) && okLand(x, z, 4) && farFromMapTrees && spec < 3) { trees.push({ sp: 'broad', x, z, h: 19, w: 17, color: 0x557a32 }); spec++; }
    }
    if (WG) trees.length = 0;
    for (const m of S.buildTrees(world, trees)) group.add(m);
    for (const t of trees) if (t.h > 6) col.addCircle(t.x, t.z, 0.35, { tag: 'tree' });

    // ---------------------------------------------------------------- flowers: herbaceous border, rose beds
    const flowers = [];
    const herb = [0x8a5ac8, 0xd86aa0, 0xf2d24a, 0xf4f0f0, 0x5a7ad8, 0xe0703a, 0xc04a8a];
    const nuffPath = map.roads.find((r) => r.id === 'w251686319');
    if (nuffPath) {
      // the gravel walk west along the Nuffield Lawn to the lake: border on its south side
      const pts = nuffPath.pts.filter((p) => p[1] > 30 && p[0] < -334 && p[0] > -392);
      let i = 0;
      for (const q of alongRing(pts, 0.55, false)) {
        const nx = -Math.cos(q[2]), nz = Math.sin(q[2]);
        for (const d of [2.0, 2.6, 3.2]) {
          const x = q[0] + nx * d * (nz < 0 ? -1 : 1), z = q[1] + nz * d * (nz < 0 ? -1 : 1);
          if (!okLand(x, z, 1.2)) continue;
          flowers.push({ x: x + Math.sin(i * 2.1) * 0.15, z: z + Math.cos(i * 1.3) * 0.15, c: herb[(Math.floor(i / 3) + Math.floor(d * 2)) % herb.length], s: 0.8 + ((i * 37) % 10) / 20 }); i++;
        }
      }
    }
    // Provost's Garden: the small formal garden (Alfred Parsons, 1903) — sundial and rose beds; three beehives
    // (2026-11-22, the owner's bird's-eye picture: the formal garden is the walled strip directly west of the Main Quad
    // — the south-east corner of the Provost's Garden, mapped as the garden w169617898, 15 x 29 m — planted in rows
    // from end to end. The sundial and four small beds used to stand out on the open lawn 25 m further west.
    // GUESS: the number and size of the beds; the picture shows only that the strip is all planting.)
    const formal = area('w169617898');
    if (formal && !WG) {
      world.clearArea(formal.poly, { furniture: false, lamps: false });      // (the scattered garden trees: none in the picture)
      const fc = [-311.1, 17.6], PHI = 0.0761, ex = Math.cos(PHI), ez = -Math.sin(PHI);      // the quad's own axes (worcester.js)
      const fw = (a, b) => [fc[0] + a * ex - b * ez, fc[1] + a * ez + b * ex];                 // a east, b south
      S.sundial(accs.props, fc[0], fc[1]);
      const roses = [0xc81e3a, 0xf0a0b8, 0xf6f0e8, 0xe05a6a];
      let k = 0;
      for (const ca of [-3.3, 3.3]) for (const cb of [-9.0, -3.4, 3.4, 9.0]) {
        const w = 4.0, d = 4.6;
        if (![[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([i, j]) => pip(...fw(ca + i * (w / 2 + 0.3), cb + j * (d / 2 + 0.3)), formal.poly))) continue;
        accs.plain.quad(fw(ca - w / 2, cb - d / 2), fw(ca + w / 2, cb - d / 2), fw(ca + w / 2, cb + d / 2), fw(ca - w / 2, cb + d / 2), 0, 0x5a4232);
        for (let p = -w / 2 + 0.4; p < w / 2; p += 0.8) for (let q = -d / 2 + 0.4; q < d / 2; q += 0.76) { const [x, z] = fw(ca + p, cb + q); flowers.push({ x, z, c: roses[(k + Math.round(p * 3 + q * 5)) & 3], s: 1.1 }); }
        k++;
      }
    }
    [[-369, -51.5], [-367.6, -49.8], [-366.2, -48.1]].forEach(([x, z]) => { if (pip(x, z, provost.poly)) S.beehive(accs.props, x, z, 0.8); });
    const flowerIM = S.flowerMesh(flowers);

    // ---------------------------------------------------------------- reeds (dense by the Sainsbury Building)
    const reeds = [];
    for (const q of alongRing(lakeOuter, 0.8)) {
      const nearSainsbury = q[1] < -78 && q[0] > -400;
      if (!mine(q[0], q[1]) || q[1] < -108 || (WL && (WL.hard(q[0], q[1]) || WL.keep(q[0], q[1])))) continue;
      const hsh = Math.abs(Math.sin(q[0] * 12.9898 + q[1] * 78.233) * 43758.5453) % 1;
      if (hsh > (nearSainsbury ? 0.85 : 0.1)) continue;
      for (const sgn of [1, -1]) {
        const x = q[0] + Math.cos(q[2]) * 0.6 * sgn, z = q[1] - Math.sin(q[2]) * 0.6 * sgn;
        if (col.isWater(x, z) && !col.onBridge(x, z)) { reeds.push({ x, z, h: 0.85 + hsh * 0.4, s: 1 + hsh * 0.5 }); break; }
      }
    }
    // graphics pass 2: flowers + reeds never move: baked into ONE static mesh (was two instanced draws)
    const plants = bakePlants([[flowerIM, true], [S.reedMesh(reeds), false]]);
    for (const m of plants) group.add(m);

    // ---------------------------------------------------------------- bridge railings (footbridges over the lake)
    // w1480325737: the footbridge at the head of the lake into the Orchard; w1480325741: Sainsbury lawn to the island;
    // w849457924: south arm by the Provost's Garden gate (possibly the "Provost's Bridge" — unverified).
    for (const id of WL ? [] : ['w1480325737', 'w1480325741', 'w849457924']) { const r = map.roads.find((x) => x.id === id); if (r) S.bridgeRails(accs.props, r.pts, r.w + 0.2); }

    // ---------------------------------------------------------------- benches
    const benches = [];
    const benchOnBank = (frac, dist) => { const q = edge[Math.floor(frac * edge.length) % edge.length]; const p = q && landSide(q, dist); if (!p || !okLand(p[0], p[1], 0.8)) return; benches.push([p[0], p[1], Math.atan2(q[0] - p[0], q[1] - p[1])]); };
    for (const f of [0.17, 0.21, 0.25, 0.04]) benchOnBank(f, 2.6);
    for (const [x, z, h] of [[-346, -64, 0.6], [-338, -50, 2.2], [-385, 70, Math.PI], [-360, 88, -2.4], [-383, -100.5, 0]]) if (okLand(x, z, 0.8)) benches.push([x, z, h]);
    // (with the gardens module on, the benches are MAP benches where the college's memorials map and the photographs put
    //  them, so they can be sat on: places/_wgard_more.js BENCHES)
    if (WG) benches.length = 0;
    for (const [x, z, h] of benches) S.bench(accs.props, x, z, h);

    // ---------------------------------------------------------------- merge static meshes
    const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...o });
    const props = accs.props.mesh(vc()); props.castShadow = true; props.receiveShadow = true; props.name = 'grounds-props';
    const grassTex = world.tex.ground('grass'), gscale = (grassTex.userData && grassTex.userData.scale) || 4;
    // graphics pass 2: the grass, plain (courts, squares) and line layers are ONE mesh: per-vertex layer depth bias
    // (same scheme as world.layerMaterial) and a per-vertex "textured" flag, instead of three materials
    const flatGeo = mergeFlat([[accs.ground, world.Y.area2 + 0.002, 3, 1, gscale], [accs.plain, world.Y.path, 7, 0, 1], [accs.lines, world.Y.marking, 9, 0, 1]]);
    const flats = new THREE.Mesh(flatGeo, flatMaterial(grassTex)); flats.receiveShadow = true; flats.name = 'grounds-flats';
    for (const m of [props, flats]) group.add(m);
    world.addStatic(group);

    // ---------------------------------------------------------------- birds + feeding spots
    const birds = createBirds(game, {
      lakeOuter, lakeHole, buildings: nearBuildings,
      exclude: (x, z) => !mine(x, z) || z < -108,
    });
    const feedSpots = [];
    const spot = (x, z, h, name) => { if (!col.isWater(x, z)) feedSpots.push({ x, z, h, name }); };
    spot(-400, 39.6, Math.PI, 'south bank');                      // Nuffield Lawn side, on the lakeside walk
    spot(-381, -92.3, 0, 'Sainsbury lawn');                        // by the reeds and the island bridge
    spot(-469.2, -24.5, Math.atan2(0.608, 0.795), 'pavilion walk'); // west bank, the lakeside path from the pavilion
    // (2026-11-21) by day a parent and a child feed the ducks a few steps along the bank from the first spot that has
    // room (systems/_ped_scenes.js makes them and keeps the children's rules; the flock comes for their bread as for yours)
    for (const f of feedSpots) {
      let put = false;
      for (const sx of [2.8, -2.8]) {
        const x = f.x + Math.cos(f.h) * sx, z = f.z - Math.sin(f.h) * sx;
        if (put || col.isWater(x, z) || !col.isFree(x, z, 0.5) || !mine(x, z)) continue;
        (game.townScenes || (game.townScenes = [])).push({ kind: 'ducks', name: 'Worcester lake, ' + f.name, x, z, h: f.h, feed: (px, pz, ph) => { if (!birds.breadActive) birds.feed(px, pz, ph); } });
        put = true;
      }
      if (put) break;
    }
    const jokes = [
      'You lob a slice of Tesco Value bread. A Canada goose shoves a mallard out of the way.',
      'The ducks accept your offering. Somewhere a JCR welfare rep sighs about bread and duck nutrition.',
      'A moorhen sprints across the water for one crumb. Respect.',
      'The swans watch, unimpressed. They have had better from Fellows.',
      'A drake quacks something rude. Probably about Oriel.',
    ];
    for (const f of feedSpots) {
      game.interact.add({
        pos: [f.x, f.z], radius: 2.4,
        label: 'Feed the ducks (bread, £0.50)',
        enabled: () => !birds.breadActive,
        onUse: () => {
          if (!game.pay(-0.5)) { game.ui.toast('You can\'t even afford a slice of bread.'); return; }
          const st = game.state.flags; st.duckFeeds = (st.duckFeeds || 0) + 1;
          game.player.heading = f.h; game.player.syncMesh();
          try { game.player.character.setPose('wave', { duration: 1 }); } catch (e) { /* ignore */ }
          birds.feed(game.player.pos.x, game.player.pos.z, f.h);
          let msg = jokes[st.duckFeeds % jokes.length];
          if (st.duckFeeds % 6 === 0) { game.pay(0.2); msg = 'A goose was standing on a 20p. You pocket it. Karma: questionable. (+£0.20)'; }
          else if (st.duckFeeds % 10 === 5) msg = 'The Head Gardener appears: "Peas or oats, please, not bread." Karma +1.';
          game.ui.toast(msg, 4); game.save();
        },
      });
    }
    // read-only accessor for other modules (friends.js: Lorenzo's duck remark): distance from (x,z) to the nearest
    // visible mallard (drake / hen / duckling), or Infinity. Positions are this client's flock (cosmetic). Allocation-free.
    const DUCK_KINDS = new Set(['drake', 'hen', 'duckling']);
    const duckList = birds.birds.filter((b) => DUCK_KINDS.has(b.kind));
    game.worcesterGrounds = {
      nearestDuck(x, z) {
        let best = Infinity;
        for (let i = 0; i < duckList.length; i++) { const b = duckList[i]; if (!b.visible || b.state === 'fly') continue; const d = Math.hypot(b.x - x, b.z - z); if (d < best) best = d; }
        return best;
      },
    };
    console.log(`[gto] worcester_grounds: ${trees.length} trees (${fruit} fruit), ${flowers.length} flowers, ${reeds.length} reeds, ${benches.length} benches, birds water/bank/island cells ${birds.grid.waterCells}/${birds.grid.bankCells}/${birds.grid.islandCells}, feed spots ${feedSpots.length}, static tris ${(accs.props.tris + accs.ground.tris + accs.plain.tris + accs.lines.tris) | 0}`);

    // ---------------------------------------------------------------- per-frame
    const P = game.player.pos;
    let vis = true;
    const sys = {
      id: 'worcester_grounds',
      birds, croquet, feedSpots, group,
      update(dt) {
        if (!(dt > 0)) return;
        const d = Math.hypot(P.x - CENTRE[0], P.z - CENTRE[1]);
        const show = game.player.place === 'world' && d < 520;
        if (show !== vis) { vis = show; group.visible = show; birds.group.visible = show; croquet.balls.visible = show; }
        // flower / reed chunks: small detail, not drawn beyond ~90 m from the camera (graphics pass 2)
        if (show) { const c = game.camera.position; for (const m of plants) { const q = m.userData.c, dx = q[0] - c.x, dz = q[1] - c.z, r = 90 + q[2]; m.visible = dx * dx + dz * dz < r * r; } }
        if (d > 250 || game.player.place !== 'world') return;
        birds.update(dt);
      },
    };
    return sys;
  },
};

/** [[Acc, y, layer, textured, uvScale]] -> one geometry with aLayer + aTex */
function mergeFlat(list) {
  let n = 0; for (const [a] of list) n += a.pos.length / 3;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), lay = new Float32Array(n), tex = new Float32Array(n);
  let o = 0;
  for (const [a, y, layer, textured, sc] of list) {
    const k = a.pos.length / 3;
    for (let i = 0; i < k; i++) {
      pos[(o + i) * 3] = a.pos[i * 3]; pos[(o + i) * 3 + 1] = a.pos[i * 3 + 1] + y; pos[(o + i) * 3 + 2] = a.pos[i * 3 + 2];
      uv[(o + i) * 2] = a.uv[i * 2] / sc; uv[(o + i) * 2 + 1] = a.uv[i * 2 + 1] / sc;
      lay[o + i] = layer; tex[o + i] = textured;
    }
    nor.set(a.nor, o * 3); col.set(a.col, o * 3);
    o += k;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aLayer', new THREE.BufferAttribute(lay, 1)); g.setAttribute('aTex', new THREE.BufferAttribute(tex, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
function flatMaterial(map) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.96, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLayer;\nattribute float aTex;\nvarying float vTex;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvTex = aTex;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tmvPosition.xyz *= 1.0 - aLayer * 0.0005;\n\tgl_Position = projectionMatrix * mvPosition;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTex;')
      .replace('#include <map_fragment>', '#ifdef USE_MAP\n\tdiffuseColor *= mix(vec4(1.0), texture2D(map, vMapUv), vTex);\n#endif');
  };
  m.customProgramCacheKey = () => 'groundsFlat';
  return m;
}

/** Bake static InstancedMeshes into one vertex-coloured mesh. [[im, tintWhite]]: tintWhite = the instance colour applies
 *  to white vertices only (the flower heads, as the old flower shader did). */
function bakePlants(list) {
  let n = 0; for (const [im] of list) n += im.geometry.attributes.position.count * im.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const m4 = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), c = new THREE.Color();
  let o = 0;
  for (const [im, tintWhite] of list) {
    const g = im.geometry, P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color;
    for (let k = 0; k < im.count; k++) {
      im.getMatrixAt(k, m4); nm.getNormalMatrix(m4);
      if (im.instanceColor) im.getColorAt(k, c); else c.setRGB(1, 1, 1);
      for (let i = 0; i < P.count; i++, o++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m4); pos[o * 3] = v.x; pos[o * 3 + 1] = v.y; pos[o * 3 + 2] = v.z;
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[o * 3] = v.x; nor[o * 3 + 1] = v.y; nor[o * 3 + 2] = v.z;
        let r = C ? C.getX(i) : 1, gg = C ? C.getY(i) : 1, b = C ? C.getZ(i) : 1;
        if (tintWhite && gg > 0.99) { r *= c.r; gg *= c.g; b *= c.b; }
        col[o * 3] = r; col[o * 3 + 1] = gg; col[o * 3 + 2] = b;
      }
    }
    g.dispose();
  }
  // 40 m chunks (by triangle centroid) so the far ones can be skipped
  const C = 40, nT = n / 3, key = new Int32Array(nT), cnt = new Map();
  for (let t = 0; t < nT; t++) {
    const x = (pos[t * 9] + pos[t * 9 + 3] + pos[t * 9 + 6]) / 3, z = (pos[t * 9 + 2] + pos[t * 9 + 5] + pos[t * 9 + 8]) / 3;
    const k = Math.floor(x / C) * 4096 + Math.floor(z / C); key[t] = k; cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), out = [];
  for (const [k, c] of cnt) {
    const P2 = new Float32Array(c * 9), N2 = new Float32Array(c * 9), C2 = new Float32Array(c * 9);
    let w = 0;
    for (let t = 0; t < nT; t++) if (key[t] === k) { P2.set(pos.subarray(t * 9, t * 9 + 9), w); N2.set(nor.subarray(t * 9, t * 9 + 9), w); C2.set(col.subarray(t * 9, t * 9 + 9), w); w += 9; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P2, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N2, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C2, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true; m.castShadow = false; m.name = 'grounds-plants'; m.matrixAutoUpdate = false;
    const bs = geo.boundingSphere; m.userData.c = [bs.center.x, bs.center.z, bs.radius];
    out.push(m);
  }
  return out;
}
