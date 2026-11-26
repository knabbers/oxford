// Streetscape: the everyday texture of an English city street c. 2013, everywhere on the map, in TWO draw calls.
//
//   street:solid   one merged, camera-centred mesh (refilled as the camera moves) holding every street item — lamp
//                  columns, litter bins, pillar boxes, bollards, signs, cabinets, grit bins, pay-and-display machines,
//                  benches, A-boards, hanging baskets, wheelie bins, cones, estate agents' boards, chained bikes,
//                  pedestrian signals — AND the grass blades near the camera. Vertex-coloured, one small atlas,
//                  alpha-tested; lamp glass / signal lenses glow from a per-vertex gate (lamps switch on one by one at
//                  dusk); grass sways in the wind. No shadow pass (budget: +2 draws): contact shadows are decals.
//   street:decals  one premultiplied-alpha mesh (systems/_street_light.js): pools of lamplight, halos, Belisha flashes,
//                  contact shadows, tree grilles, fallen leaves, pavement stains.
//
// Street lighting: the world's generated lamp posts (world/furniture.js) are taken over at install through the public
// world.clearArea API and redrawn here by type — heritage lanterns (warm white) in the centre and on footways, 8 m
// columns with high-pressure sodium on the arterial roads, 5.5 m columns with low-pressure sodium in the residential
// streets — each with its own photocell threshold; parks and meadows stay unlit. world.lampPositions keeps the heads
// (the 4 pooled point lights follow them and are tinted / gated to match, after world.update). That removes the world's
// lamp-head and lamp-pool InstancedMeshes from every view, which is what pays for the two draws here.
//
// Placement: systems/_street_place.js (pure, deterministic). Footprints the street keeps out of: college sites away
// from the street, museum forecourts, Christ Church Meadow, South Park, the airfield, Radcliffe Square, the May
// Morning crowd on the High below Magdalen, 2 m round every place module's interaction point, and every polygon any
// module passes to world.clearArea (wrapped: it also clears our items, and counts our lamps it removes).
//
// Interactivity (local, cosmetic): walk or drive into a cone, wheelie bin or A-board and it goes over, back up 25 s
// later; [E] at any pillar box posts a letter. Wheelie bins are out on one game day in seven, street by street.
// API: game.streetscape = { stats(), plan, lamps, refresh(), knock(i) }.   Test: tools/smoke_streetscape.mjs
import * as THREE from 'three';
import { BARRIER_HALF, SANITY } from './_clearance.js';
import { busyOn, CENTRE_BAYS } from './_busy.js';
import { buildProtos, paintAtlas, LAMP_COL, LAMP_HEAD } from './_street_geo.js';
import { planStreet, h3, turnSweeps } from './_street_place.js';
import { createGrass } from './_street_grass.js';
import { paintDecals, decalMaterial, DecalWriter, DRECT } from './_street_light.js';
import { sanitiseMap } from './_street_sanity.js';

import { DAY_MS } from '../core/time.js';
// per tier: draw radius of lamp columns (big), ordinary furniture (mid), small things (small), grass radius / spacing,
// decal radius, lamp pools, halos
export const RANGES = {
  low: { big: 140, mid: 60, small: 32, grass: 9, step: 0.95, decal: 45, pool: 90, halo: 450, lod: 45, grassMax: 700 },
  medium: { big: 180, mid: 80, small: 45, grass: 14, step: 0.8, decal: 60, pool: 120, halo: 650, lod: 55, grassMax: 1500 },
  high: { big: 210, mid: 100, small: 60, grass: 19, step: 0.75, decal: 75, pool: 150, halo: 850, lod: 65, grassMax: 2400 },
  ultra: { big: 240, mid: 120, small: 70, grass: 22, step: 0.7, decal: 85, pool: 170, halo: 1000, lod: 80, grassMax: 3000 },
};
const CLASS = { lampH: 'big', lampS: 'big', lampR: 'big', basket: 'small', wheelieG: 'small', wheelieB: 'small', caddy: 'small', recBox: 'small', cone: 'small', agent: 'small', bike: 'small' };
const LAMP_LIN = {}; for (const [k, v] of Object.entries(LAMP_COL)) { const c = new THREE.Color(v); LAMP_LIN[k] = [c.r, c.g, c.b]; }
const POST_LINES = ['You post a letter. Second class: it should be there by Thursday.', 'Into the box it goes. Last collection 5.30pm.', 'Posted. Your tutor will have your essay by Monday. Probably.', 'You post a birthday card to your gran.', 'A postcard of the Radcliffe Camera, posted home.'];

export default {
  id: 'streetscape',
  // before the map collision, the world, traffic and the parked cars read the map: mapped furniture and trees that the
  // data puts inside a drawn carriageway go to the kerb (or are dropped) — systems/_street_sanity.js. Runs with ?street=0 too.
  preMap(game) {
    if (!game.map) return;
    try { game.mapSanity = sanitiseMap(game.map, { skip: game.overrides && game.overrides.skip }); } catch (e) { console.error('[streetscape] map sanity', e); }
    // 2026-11 sanity check: the way down the middle of Broad Street that is given over to the two rows of centre bays
    // (vehicles.js, _busy.js CENTRE_BAYS) had a raised pavement either side of it, under the tails of the parked cars
    // (each stood half up a 9 cm kerb). It is the middle of a paved street: no pavements of its own.
    if (SANITY && busyOn()) for (const r of game.map.roads) if (r.id === CENTRE_BAYS.road && r.pw === undefined) r.pw = 0;
  },
  install(game) {
    if (!game.world || !game.map) return;
    if (typeof location !== 'undefined' && /[?&]street=0/.test(location.search || '')) return;   // ?street=0: off (before/after comparisons)
    const s = new Streetscape(game);
    game.streetscape = s.api;
    return s;
  },
};

class Streetscape {
  constructor(game) {
    const self = this;
    this.game = game; this.id = 'streetscape';
    const W = (this.W = game.world), map = game.map;
    this.P = buildProtos();
    this.items = []; this.lamps = []; this.beacons = []; this.trees = [];
    this.ready = false; this.cleared = []; this.colliders = [];
    this.fillAt = { x: 1e9, z: 1e9 }; this.grassAt = { x: 1e9, z: 1e9 }; this.decalAt = { x: 1e9, z: 1e9 };
    this.tierKey = ''; this.binDay = -1; this.nightOn = null; this.knocked = new Map(); this.timer = 0; this.ms = {};

    // ---- materials
    let atlas = null, dtex = null;
    try { atlas = paintAtlas(); dtex = paintDecals(); } catch (e) { atlas = new THREE.Texture(); dtex = new THREE.Texture(); }
    const U = W.uniforms;
    const mat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, roughness: 0.72, metalness: 0.12, name: 'street:solid' });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = U.night; sh.uniforms.uTime = U.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aFx;\nuniform float uNight, uTime;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          if (aFx.z > 0.0) { float ph = position.x * 0.7 + position.z * 0.53; transformed.x += (sin(uTime * 1.7 + ph) + 0.4 * sin(uTime * 4.3 + ph * 2.1)) * 0.035 * aFx.z; transformed.z += (cos(uTime * 1.3 + ph * 1.2) + 0.3 * sin(uTime * 3.9 + ph)) * 0.03 * aFx.z; }
          float gg = aFx.x;
          vGlow = gg >= 0.0 ? smoothstep(gg, gg + 0.05, uNight) : gg < -2.5 ? 0.3 + 0.7 * uNight : gg < -1.5 ? step(0.5, fract(uTime * 0.8 + position.x * 0.37 + position.z * 0.11)) : 0.0;
          vGlow *= aFx.y;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * vGlow;');
    };
    mat.customProgramCacheKey = () => 'street-solid-1';
    this.mat = mat;
    // ---- the merged solid buffer: furniture vertices [0, VF), grass vertices [VF, VF + VG)
    const VF = (this.VF = 90000), VG = (this.VG = 3000 * 8), NV = VF + VG;
    const geo = new THREE.BufferGeometry();
    const A = (n, k) => { const a = new THREE.BufferAttribute(new Float32Array(n * k), k); a.setUsage(THREE.DynamicDrawUsage); return a; };
    geo.setAttribute('position', A(NV, 3)); geo.setAttribute('normal', A(NV, 3)); geo.setAttribute('color', A(NV, 3)); geo.setAttribute('uv', A(NV, 2)); geo.setAttribute('aFx', A(NV, 3));
    const idx = new THREE.BufferAttribute(new Uint32Array(VF * 1.7 + VG * 1.5), 1); idx.setUsage(THREE.DynamicDrawUsage); geo.setIndex(idx);
    geo.setDrawRange(0, 0); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);   // camera-centred: always drawn
    this.fIdx = new Uint32Array(VF * 1.7); this.gIdx = new Uint32Array(VG * 1.5); this.nfI = 0; this.ngI = 0; this.nfV = 0; this.ngV = 0;
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.name = 'street:solid'; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
    // no shadow pass: the place modules' own lamps keep the world's lamp-head draw alive, so a shadow draw here would be a
    // third call; contact shadows are decals. (castShadow = true works — the depth material below is ready for it.)
    this.mesh.castShadow = false;
    // shadow pass: the columns, bins and signs cast (the world's lamp posts did); the grass does not (its vertices carry
    // aFx.y = -1 and are thrown out of the clip volume), the bike wheels are alpha-tested
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: 0.5 });
    dm.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aFx;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n\tif (aFx.y < -0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');
    };
    dm.customProgramCacheKey = () => 'street-depth-1';
    this.mesh.customDepthMaterial = dm;
    this.mesh.matrixAutoUpdate = false; this.mesh.visible = false;
    game.worldScene.add(this.mesh);
    // ---- decals
    this.dw = new DecalWriter(40000);
    const dg = new THREE.BufferGeometry(), dw = this.dw;
    const DA = (arr, k) => { const a = new THREE.BufferAttribute(arr, k); a.setUsage(THREE.DynamicDrawUsage); return a; };
    dg.setAttribute('position', DA(dw.pos, 3)); dg.setAttribute('uv', DA(dw.uv, 2)); dg.setAttribute('aCol', DA(dw.col, 4)); dg.setAttribute('aP', DA(dw.p, 4)); dg.setIndex(DA(dw.idx, 1)); dg.setDrawRange(0, 0); dg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.dmat = decalMaterial(dtex, U);
    this.dmesh = new THREE.Mesh(dg, this.dmat); this.dmesh.name = 'street:decals'; this.dmesh.frustumCulled = false; this.dmesh.renderOrder = 3; this.dmesh.matrixAutoUpdate = false; this.dmesh.visible = false;
    game.worldScene.add(this.dmesh);

    // ---- take over the world's generated lamp posts (only world lamps exist yet: systems install before places)
    this.takeLamps();
    // ---- every later world.clearArea also clears our items in that polygon (and counts our lamps it removes)
    const orig = (this.origClear = W.clearArea.bind(W));
    W.clearArea = (poly, opts = {}) => { const n = orig(poly, opts); return n + this.clearPoly(poly, opts); };
    // ---- the pooled point lights: tint and gate them to the lamp they sit at, after world.update set them
    const wu = W.update;
    W.update = (dt) => { wu.call(W, dt); try { this.afterWorld(); } catch (e) { /* cosmetic */ } };
    // ---- the post box
    this.postTarget = new THREE.Vector3(0, -1000, 0); this.posted = 0;
    if (game.interact) game.interact.add({ pos: () => this.postTarget, radius: 1.5, label: 'Post a letter', onUse: () => { game.ui && game.ui.toast(POST_LINES[this.posted++ % POST_LINES.length], 3.5); }, enabled: () => this.postTarget.y > -1 });
    this.api = {
      stats: () => this.stats(), get plan() { return null; }, lamps: this.lamps, items: this.items,
      refresh: () => { this.fillAt.x = 1e9; this.grassAt.x = 1e9; this.decalAt.x = 1e9; },
      knock: (i) => this.knock(this.items[i], 0, 1),
      build: () => this.build(), ms: this.ms,
      // [props] hooks for systems/props.js (dynamic props): ids are indexes into `all` (lamps, then items)
      itemsNear: (x, z, r, fn) => this.itemsNear(x, z, r, fn),
      takeItem: (i) => this.takeItem(i), restoreItem: (i) => this.restoreItem(i), lampDark: (i, dark) => this.lampDark(i, dark),
      item: (i) => this.all && this.all[i], protoFor: (it) => this.protoOf(it, 0),
      get all() { return self.all; }, get material() { return self.mat; }, get depthMaterial() { return self.mesh.customDepthMaterial; }, get ready() { return self.ready; },
    };
    Object.defineProperty(this.api, 'plan', { get: () => this.plan });
  }

  // ---------------------------------------------------------------- lamps
  takeLamps() {
    const W = this.W, L = W.lampPositions, map = this.game.map, U = W.util;
    const STREETK = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'primary_link', 'secondary_link', 'tertiary_link']);
    const MAIN = new Set(['primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link', 'tertiary_link']);
    // green ground with no street through it is left dark
    const greens = map.areas.filter((a) => a.kind === 'park' || a.kind === 'meadow' || a.kind === 'pitch' || a.kind === 'wood' || a.kind === 'garden' || (a.kind === 'grass' && Math.abs(U.signedArea(a.poly)) > 3000)).map((a) => ({ a, bb: U.polyBounds(a.poly) }));
    const inGreen = (x, z) => greens.some(({ a, bb }) => x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && U.pointInPoly(x, z, a.poly) && !(a.holes || []).some((h) => U.pointInPoly(x, z, h)));
    const snap = [];
    // 2026-11 placement pass: a post in a drawn carriageway (junction mouths, the other half of a dual carriageway, the
    // data's kerb inside our wider road), in a building (or one a place module rebuilt), in the water or on the walking
    // line of a crossing goes to the nearest clear kerb spot of that road, a metre or three along; failing that, it goes
    this.crossKerbs = crossingKerbs(map, W.roadGrid, U);
    const kerbG = new U.SpatialGrid(8); for (const k of this.crossKerbs) kerbG.insertPoint(k[0], k[1], k);
    const skipB = new U.SpatialGrid(20);
    for (const b of map.buildings) if (!b.part && this.game.overrides.skip.has(b.id) && (b.minH || 0) <= 2.5) { const bb = U.polyBounds(b.poly); skipB.insertBox(bb.minX, bb.minZ, bb.maxX, bb.maxZ, b); }
    const col = this.game.worldCollider;
    const inB = (x, z, pad) => { let hit = false; const t = (b) => { if (b.part || (b.tags && b.tags.building === 'roof')) return; if ((U.pointInPoly(x, z, b.poly) && !(b.holes || []).some((h) => U.pointInPoly(x, z, h))) || distPoly(U, x, z, b.poly) < pad) { hit = true; return true; } }; W.buildingGrid.queryRadius(x, z, 1 + pad, (r) => t(r.b)); if (!hit) skipB.queryRadius(x, z, 1 + pad, t); return hit; };
    const carriage = (x, z, rad) => { let worst = null; W.roadGrid.queryRadius(x, z, 12, (it) => { if (it.kind === 'pedestrian' || (it.kind === 'service' && it.w < 3.5) || (it.road && it.road.tunnel && it.road.tunnel !== 'building_passage')) return; const d = U.distToSeg(x, z, it.ax, it.az, it.bx, it.bz), pen = it.kind === 'service' ? it.w / 2 - 0.3 - d : it.w / 2 + rad - d; if (pen > 0 && (!worst || pen > worst.pen)) worst = { it, d, pen }; }); return worst; };
    const skipA = map.areas.filter((a) => this.game.overrides.skip.has(a.id) && a.kind !== 'water').map((a) => ({ p: a.poly, bb: U.polyBounds(a.poly) }));
    const inSkipA = (x, z) => skipA.some((q) => x >= q.bb.minX && x <= q.bb.maxX && z >= q.bb.minZ && z <= q.bb.maxZ && U.pointInPoly(x, z, q.p));
    const onCross = (x, z) => { let hit = false; kerbG.queryRadius(x, z, 1.2, (k) => { if (Math.hypot(k[0] - x, k[1] - z) < 0.95) { hit = true; return true; } }); return hit; };
    // (2026-11 sanity check: nor through one of the world's bike stands, benches, bins or boxes - they have no colliders)
    const furnG = new U.SpatialGrid(8), FR0 = { stand: 0.42, bench: 0.5, bin: 0.3, postBox: 0.32, phone: 0.55, picnic: 1.0 };
    if (SANITY && W.furniture) for (const k in FR0) { const st = W.furniture.sets[k]; if (st) for (let i = 0; i < st.n; i++) { const fx = st.xz[i * 2], fz = st.xz[i * 2 + 1]; if (Math.abs(fx) < 1e8) furnG.insertPoint(fx, fz, [fx, fz, FR0[k]]); } }
    const onFurn = (x, z) => { let hit = false; furnG.queryRadius(x, z, 1.2, (q) => { if (Math.hypot(q[0] - x, q[1] - z) < q[2] + 0.13) { hit = true; return true; } }); return hit; };
    const bad = (x, z) => onFurn(x, z) || !!carriage(x, z, 0.13) || inB(x, z, 0.15) || (col && (col.isWet(x, z) || blockedAt(col, x, z, 0.14))) || onCross(x, z) || inSkipA(x, z);
    const fixLamp = (x, z) => {
      if (!bad(x, z)) return [x, z];
      let road = carriage(x, z, 0.13);
      if (!road) W.roadGrid.queryRadius(x, z, 12, (it) => { if (!STREETK.has(it.kind)) return; const d = U.distToSeg(x, z, it.ax, it.az, it.bx, it.bz); if (d < it.w / 2 + 3 && (!road || d < road.d)) road = { it, d }; });
      if (!road) return null;
      const it = road.it, dx = it.bx - it.ax, dz = it.bz - it.az, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
      const t = Math.max(0, Math.min(len, (x - it.ax) * ux + (z - it.az) * uz)), fx = it.ax + ux * t, fz = it.az + uz * t;
      const sg = (x - fx) * -uz + (z - fz) * ux, side = sg > 0.1 ? 1 : sg < -0.1 ? -1 : h3(x, z, 7) < 0.5 ? 1 : -1;
      for (const sd of [side, -side]) for (const al of [0, 1.5, -1.5, 3, -3]) {
        const qx = fx + ux * al - uz * sd * (it.w / 2 + 0.45), qz = fz + uz * al + ux * sd * (it.w / 2 + 0.45);
        if (!bad(qx, qz)) return [qx, qz];
      }
      return null;
    };
    // a post on a pavement that leaves less than 0.9 m behind it (to the house fronts / garden walls) stands at the kerb edge
    const PW = { primary: 2.6, secondary: 2.4, tertiary: 2.2, primary_link: 2, secondary_link: 2, tertiary_link: 2, unclassified: 1.8, residential: 1.8 };
    const RAY = { hit: {} }, doorG = new U.SpatialGrid(8); for (const g of map.gates) if (g.kind === 'entrance' && !this.game.overrides.skip.has(g.id)) doorG.insertPoint(g.p[0], g.p[1], g.p);
    const onDoor = (x, z) => { let hit = false; doorG.queryRadius(x, z, 1.2, (q) => { if (Math.hypot(q[0] - x, q[1] - z) < 1.1) { hit = true; return true; } }); return hit; };
    const lampG = new U.SpatialGrid(16); for (let i = 0; i < L.length; i += 3) if (Math.abs(L[i]) < 1e8) lampG.insertPoint(L[i], L[i + 2], [L[i], L[i + 2]]);
    const toKerb = (x, z) => {
      let best = null;
      W.roadGrid.queryRadius(x, z, 12, (it) => { const pw = it.road && it.road.pw !== undefined ? it.road.pw : PW[it.kind]; if (!pw) return; const d = U.distToSeg(x, z, it.ax, it.az, it.bx, it.bz); if (d >= it.w / 2 && d <= it.w / 2 + pw && (!best || d < best.d)) best = { it, d, pw }; });
      if (!best || best.d < best.it.w / 2 + 0.33 || !col) return null;
      const it = best.it, dx = it.bx - it.ax, dz = it.bz - it.az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - it.ax) * dx + (z - it.az) * dz) / l2)), fx = it.ax + dx * t, fz = it.az + dz * t;
      const nl = Math.hypot(x - fx, z - fz) || 1, nx = (x - fx) / nl, nz = (z - fz) / nl, hw = it.w / 2, max = best.pw + 0.05;
      const rc = col.raycast(fx + nx * hw, fz + nz * hw, fx + nx * (hw + max), fz + nz * (hw + max), RAY), back = Math.min(best.pw, rc === null ? best.pw : rc * max);
      if (back - (best.d - hw + 0.13) >= 0.9) return null;
      // 2026-11 sanity check: where a garden wall, hedge or fence closes the footway, the column goes to the BACK of it
      // (0.2 m off the drawn face, clear of doorways) - one clear width between it and the kerb, 0.1 m more than a post
      // 0.3 m in from the kerb leaves behind it, and not within reach of a wing mirror. Kerb edge only where that fails.
      // (a garden wall, hedge or fence only: against a house or shop front it would stand in a window, a doorway or up
      // through a shop's awning)
      if (SANITY && rc !== null && rc * max <= best.pw && RAY.hit.s && BARRIER_HALF[RAY.hit.s.tag] !== undefined) {
        const bo = rc * max - ((RAY.hit.s && BARRIER_HALF[RAY.hit.s.tag]) || 0) - 0.2, sl = Math.sqrt(l2), ux = dx / sl, uz = dz / sl;
        if (bo >= 0.5) for (const al of [0, 1.2, -1.2, 2.4, -2.4]) { const qx = fx + ux * al + nx * (hw + bo), qz = fz + uz * al + nz * (hw + bo); if (!bad(qx, qz) && !onDoor(qx, qz) && Math.abs(W.groundHeight(qx, qz) - W.Y.pavement) < 0.004) return [qx, qz]; }
      }
      // ... and where this footway is too narrow for a column at all (under 0.75 m left either way) while the one across
      // the street has room to walk past one (0.9 m), the column stands over there (no other lamp within 7 m of the spot)
      if (SANITY && back - 0.43 < 0.75) {
        const rc2 = col.raycast(fx - nx * hw, fz - nz * hw, fx - nx * (hw + max), fz - nz * (hw + max), RAY), back2 = Math.min(best.pw, rc2 === null ? best.pw : rc2 * max);
        const bo2 = rc2 !== null && rc2 * max <= best.pw && RAY.hit.s && BARRIER_HALF[RAY.hit.s.tag] !== undefined ? rc2 * max - ((RAY.hit.s && BARRIER_HALF[RAY.hit.s.tag]) || 0) - 0.2 : -1, sl = Math.sqrt(l2), ux = dx / sl, uz = dz / sl;
        const offs = []; if (bo2 - 0.13 >= 0.9) offs.push(bo2); if (back2 - 0.43 >= 0.9) offs.push(0.3);
        for (const o of offs) for (const al of [0, 1.5, -1.5, 3, -3]) {
          const qx = fx + ux * al - nx * (hw + o), qz = fz + uz * al - nz * (hw + o);
          if (bad(qx, qz) || onDoor(qx, qz) || Math.abs(W.groundHeight(qx, qz) - W.Y.pavement) > 0.004) continue;
          let near = false; lampG.queryRadius(qx, qz, 7, (q) => { if ((q[0] !== x || q[1] !== z) && Math.hypot(q[0] - qx, q[1] - qz) < 7) { near = true; return true; } });
          if (!near) return [qx, qz];
        }
      }
      const qx = fx + nx * (hw + 0.3), qz = fz + nz * (hw + 0.3);
      return bad(qx, qz) ? null : [qx, qz];
    };
    this.lampsMoved = 0; this.lampsRejected = 0;
    for (let i = 0; i < L.length; i += 3) {
      let x = L[i], y = L[i + 1], z = L[i + 2];
      if (!(Math.abs(x) < 1e8) || Math.abs(y - 4.35) > 0.02) continue;     // world posts only
      { const q = fixLamp(x, z); if (!q) { this.lampsRejected++; snap.push({ i, x, z, drop: true }); continue; } if (q[0] !== x || q[1] !== z) { this.lampsMoved++; x = q[0]; z = q[1]; } }
      { const q = toKerb(x, z); if (q) { this.lampsMoved++; x = q[0]; z = q[1]; } }
      let best = null;
      W.roadGrid.queryRadius(x, z, 12, (it) => { if (it.kind === 'service') return; const d = U.distToSeg(x, z, it.ax, it.az, it.bx, it.bz); if (d < it.w / 2 + 2.2 && (!best || d < best.d)) best = { it, d }; });
      let type = 'H', h = 0;
      if (best && STREETK.has(best.it.kind)) {
        const it = best.it, zone = W.zoneAt(x, z), centre = zone === 'centre';
        type = centre ? 'H' : MAIN.has(it.kind) ? 'S' : 'R';
        const dx = it.bx - it.ax, dz = it.bz - it.az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - it.ax) * dx + (z - it.az) * dz) / l2));
        h = Math.atan2(it.ax + dx * t - x, it.az + dz * t - z);
      } else if (!best && inGreen(x, z)) { snap.push({ i, x, z, drop: true }); continue; }
      else h = h3(x, z, 3) * 6.283;
      snap.push({ i, x, z, type, h });
    }
    this.lampsDropped = snap.filter((s) => s.drop).length;
    // remove the world's posts, heads and pools everywhere (the airfield box excepted: nothing of ours there)
    const b = this.game.map.bounds, big = [[b.minX - 50, b.minZ - 50], [b.maxX + 50, b.minZ - 50], [b.maxX + 50, b.maxZ + 50], [b.minX - 50, b.maxZ + 50]];
    this.worldLampsRemoved = this.W.clearArea(big, { trees: false, furniture: false, lamps: true });
    for (const s of snap) {
      if (s.drop) continue;
      const hd = LAMP_HEAD[s.type], cs = Math.cos(s.h), sn = Math.sin(s.h);
      const hx = s.x + hd[2] * sn, hz = s.z + hd[2] * cs, hy = hd[1];
      L[s.i] = hx; L[s.i + 1] = hy + 0.2; L[s.i + 2] = hz;          // pooled point lights hang 0.3 m under these
      const lamp = { k: 'lamp' + s.type, type: s.type, x: s.x, z: s.z, y: 0, h: s.h, on: 0.16 + 0.24 * h3(s.x, s.z, 5), hx, hy, hz, li: s.i, r: 0.13, sh: 0.35 };
      this.lamps.push(lamp);
    }
    this.lampByKey = new Map(); for (const l of this.lamps) this.lampByKey.set(Math.round(l.hx * 4) + ',' + Math.round(l.hz * 4), l);
  }

  afterWorld() {
    if (!this.ready) return;
    const sc = this.game.worldScene;
    if (!this.lights) { this.lights = []; sc.traverse((o) => { if (o.isPointLight && o.name === 'world:lampLight') this.lights.push(o); }); }
    const night = this.W.night;
    for (const l of this.lights) {
      if (l.intensity <= 0) continue;
      const lamp = this.lampByKey.get(Math.round(l.position.x * 4) + ',' + Math.round(l.position.z * 4));
      if (!lamp) continue;
      const c = LAMP_LIN[lamp.type]; l.color.setRGB(c[0], c[1], c[2]);
      const g = Math.min(1, Math.max(0, (night - lamp.on) / 0.05)); l.intensity *= g * g * (3 - 2 * g) * (lamp.type === 'S' ? 1.25 : 1);
    }
  }

  // ---------------------------------------------------------------- footprints
  makeExcl() {
    const game = this.game, map = game.map, W = this.W, U = W.util;
    const polys = [];
    const area = (id) => { const a = map.areas.find((q) => q.id === id); return a ? a.poly : null; };
    for (const id of ['r1102976', 'w23945602']) { const p = area(id); if (p) polys.push({ p, pad: 0 }); }      // the Meadow, South Park
    { const p = area('r54084'); if (p) polys.push({ p, pad: 3 }); }                                        // Radcliffe Square
    const box = (x0, z0, x1, z1) => polys.push({ p: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], pad: 0 });
    box(190, -455, 305, -335);      // Natural History Museum lawn and forecourt
    box(-48, -42, 36, -6);          // Ashmolean forecourt
    box(812, 296, 988, 452);        // May Morning: the High below Magdalen Tower to the bridge
    for (const c of this.cleared) if (c.o.furniture !== false) polys.push({ p: c.p, pad: 0 });
    // buildings and areas a place module skipped: it draws them itself, generic street things stay out
    for (const b of map.buildings) if (!b.part && game.overrides.skip.has(b.id) && (b.minH || 0) <= 2.5) polys.push({ p: b.poly, pad: 0.3 });
    for (const a of map.areas) if (game.overrides.skip.has(a.id) && a.kind !== 'water') polys.push({ p: a.poly, pad: 0 });
    for (const q of polys) q.bb = U.polyBounds(q.p);
    const boxes = map.boxes || [map.bounds];
    const colleges = (map.sites || []).filter((s) => s.kind === 'university' && /College|Hall\b|Christ Church/.test(s.name)).map((s) => ({ s, bb: U.polyBounds(s.poly) }));
    const near = (x, z, r) => { let hit = false; W.roadGrid.queryRadius(x, z, r + 10, (it) => { if (it.kind === 'service' || it.kind === 'pedestrian') return; if (U.distToSeg(x, z, it.ax, it.az, it.bx, it.bz) < it.w / 2 + r) { hit = true; return true; } }); return hit; };
    const spots = [];
    if (game.interact) for (const it of game.interact.items) { if (it.place !== 'world' || typeof it.pos === 'function' || !it.pos) continue; spots.push([it.pos.x, it.pos.z]); }
    const spotGrid = new U.SpatialGrid(16); for (const s of spots) spotGrid.insertPoint(s[0], s[1], s);
    return (x, z) => {
      let inBox = false; for (let i = 0; i < Math.min(2, boxes.length); i++) { const q = boxes[i]; if (x > q.minX + 6 && x < q.maxX - 6 && z > q.minZ + 6 && z < q.maxZ - 6) { inBox = true; break; } }
      if (!inBox) return true;
      for (const q of polys) if (x >= q.bb.minX - q.pad && x <= q.bb.maxX + q.pad && z >= q.bb.minZ - q.pad && z <= q.bb.maxZ + q.pad && (U.pointInPoly(x, z, q.p) || (q.pad && distPoly(U, x, z, q.p) < q.pad))) return true;
      for (const { s, bb } of colleges) if (x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && U.pointInPoly(x, z, s.poly) && !near(x, z, 4.5)) return true;
      let hit = false; spotGrid.queryRadius(x, z, 2.2, (s) => { if (Math.hypot(s[0] - x, s[1] - z) < 2.2) { hit = true; return true; } });
      return hit;
    };
  }

  clearPoly(poly, opts) {
    if (!this.ready) { this.cleared.push({ p: poly, o: opts }); return opts.lamps === false ? 0 : this.lamps.filter((l) => inPoly(this.W.util, poly, l.x, l.z)).length; }
    const U = this.W.util; let n = 0;
    const drop = (it) => { if (it.gone) return; it.gone = true; n++; if (it.col) for (const s of [].concat(it.col)) s.on = false; };
    if (opts.lamps !== false) for (const l of this.lamps) if (!l.gone && inPoly(U, poly, l.x, l.z)) drop(l);
    if (opts.furniture !== false) for (const it of this.items) if (!it.gone && inPoly(U, poly, it.x, it.z)) drop(it);
    if (n) this.api.refresh();
    return n;
  }

  // ---------------------------------------------------------------- build (first frame: every place module is installed)
  build() {
    if (this.ready) return;
    const t0 = now(), game = this.game, W = this.W, map = game.map;
    const excl = (this.excl = this.makeExcl());
    // lamps inside polygons cleared before we were ready
    for (const c of this.cleared) if (c.o.lamps !== false) for (const l of this.lamps) if (inPoly(W.util, c.p, l.x, l.z)) l.gone = true;
    // 2026-11: after every place module is installed — trees and mapped furniture that ended up in water a module added
    // (Port Meadow's river, the boathouse cut) are taken away; then the planner keeps clear of the lamp posts, the
    // mapped furniture, the crossings' kerbs, and whatever the collider holds (walls, parked cars, module props)
    const wc = game.worldCollider;
    if (wc) {
      const wet = (x, z) => wc.isWet(x, z);
      this.wetRemoved = 0;
      if (W.vegetation) for (const st of W.vegetation.sets) this.wetRemoved += st.removeWhere(wet);
      // 2026-11 sanity check: a garden shrub whose foliage (0.42 of its drawn width) covers a street's raised pavement to
      // within 0.6 m of the kerb goes (the world keeps shrubs 2.2 m off the carriageway whatever their size: a 5.5 m one
      // filled the whole footway of St Bernard's Road)
      this.shrubsRemoved = 0;
      const bushes = SANITY && W.vegetation && W.vegetation.sets.find((q) => q.name === 'trees:bush');
      if (bushes) {
        const gone = new Set(), PWD = { primary: 2.6, secondary: 2.4, tertiary: 2.2, primary_link: 2, secondary_link: 2, tertiary_link: 2, unclassified: 1.8, residential: 1.8 };
        for (let i = 0; i < bushes.n; i++) {
          const x = bushes.xz[i * 2], z = bushes.xz[i * 2 + 1]; if (!(Math.abs(x) < 1e8)) continue;
          const m = bushes.mat, fol = Math.hypot(m[i * 16], m[i * 16 + 1], m[i * 16 + 2]) * 0.42; let bad = false;
          W.roadGrid.queryRadius(x, z, 14, (it) => {
            const pw = it.road && it.road.pw !== undefined ? it.road.pw : PWD[it.kind]; if (!pw) return;
            const dx = it.bx - it.ax, dz = it.bz - it.az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - it.ax) * dx + (z - it.az) * dz) / l2)), fx = it.ax + dx * t, fz = it.az + dz * t, d = Math.hypot(x - fx, z - fz) || 1;
            if (d <= it.w / 2 || d - fol - it.w / 2 >= 0.6) return;
            if (Math.abs(W.groundHeight(fx + (x - fx) / d * (it.w / 2 + 0.5), fz + (z - fz) / d * (it.w / 2 + 0.5)) - W.Y.pavement) < 0.004) { bad = true; return true; }
          });
          if (bad) gone.add(Math.round(x * 100) + ',' + Math.round(z * 100));
        }
        if (gone.size) for (const st of W.vegetation.sets) this.shrubsRemoved += st.removeWhere((x, z) => gone.has(Math.round(x * 100) + ',' + Math.round(z * 100)));
      }
      // a mapped tree that is not drawn (in the water, cleared by a module, inside a building a module rebuilt) has no trunk either
      const far = W.vegetation && W.vegetation.sets.find((st) => st.name === 'trees:far'), drawn = new Set();
      if (far) for (let i = 0; i < far.n; i++) if (Math.abs(far.xz[i * 2]) < 1e8) drawn.add(Math.round(far.xz[i * 2] * 10) + ',' + Math.round(far.xz[i * 2 + 1] * 10));
      this.ghostTrunks = 0;
      if (far) for (const t of map.trees) if (!drawn.has(Math.round(t[0] * 10) + ',' + Math.round(t[1] * 10))) wc._near(t[0] - 0.4, t[1] - 0.4, t[0] + 0.4, t[1] + 0.4, (q) => { if (!q.seg && q.tag === 'tree' && q.on && Math.abs(q.x - t[0]) < 0.01 && Math.abs(q.z - t[1]) < 0.01) { q.on = false; this.ghostTrunks++; } });
      // a lamp post on a place module's doorstep (its interaction points exist only now) goes
      const doors = []; if (game.interact) for (const it of game.interact.items) if (it.place === 'world' && it.pos && typeof it.pos !== 'function') doors.push(it.pos);
      const L = W.lampPositions;
      for (const l of this.lamps) if (!l.gone && doors.some((d) => Math.abs(d.x - l.x) < 0.9 && Math.abs(d.z - l.z) < 0.9 && Math.hypot(d.x - l.x, d.z - l.z) < 0.8)) { l.gone = true; if (l.li !== undefined) { L[l.li] = 1e9; L[l.li + 2] = 1e9; } this.lampsOnDoors = (this.lampsOnDoors || 0) + 1; }
      if (W.furniture) for (const [k, st] of Object.entries(W.furniture.sets)) if (k !== 'lampPost' && k !== 'lampHead' && k !== 'pool') this.wetRemoved += st.removeWhere(wet);
    }
    const FURN_R = { bench: 0.9, bin: 0.3, postBox: 0.35, busStop: 0.3, shelter: 1.7, stand: 0.45, phone: 0.6, signal: 0.2, bollard: 0.15, belisha: 0.15, picnic: 1.2 }, furniture = [];
    if (W.furniture) for (const [k, st] of Object.entries(W.furniture.sets)) { const r = FURN_R[k]; if (!r) continue; for (let i = 0; i < st.n; i++) { const x = st.xz[i * 2], z = st.xz[i * 2 + 1]; if (Math.abs(x) < 1e8) furniture.push([x, z, r]); } }
    this.planEnv = { map, gh: W.groundHeight, Y: W.Y, roadGrid: W.roadGrid, buildingGrid: W.buildingGrid, zoneAt: W.zoneAt, util: W.util, skip: game.overrides.skip,
      lamps: this.lamps.filter((l) => !l.gone), furniture, crossKerbs: this.crossKerbs || [], solid: wc ? (x, z, r) => blockedAt(wc, x, z, r) || wc.isWet(x, z) : null,
      room: wc ? (x, z, nx, nz, max) => { const t = wc.raycast(x, z, x + nx * (max + 0.05), z + nz * (max + 0.05)); return t === null ? max : t * (max + 0.05); } : null };
    // 2026-11: nothing in the corner a turning vehicle sweeps (a bus's tail cuts the inside of the Carfax bend over the
    // pavement edge, where a heritage lamp, a bin and a bollard stood): the planner keeps out of it, and a lamp post in it
    // moves along its kerb out of it (or goes). tools/audit_placement.mjs "sweep" checks the same shape.
    const sweeps = (this.sweeps = turnSweeps(game.traffic));
    this.sweepMoved = 0; this.sweepDropped = 0;
    {
      const L = W.lampPositions, U = W.util, Y = W.Y;
      const okAt = (x, z) => !sweeps.hit(x, z, 0.2, -0.1) && Math.abs(W.groundHeight(x, z) - Y.pavement) < 0.004 && !(wc && blockedAt(wc, x, z, 0.15)) && !excl(x, z)
        && !(() => { let bad = false; W.roadGrid.queryRadius(x, z, 12, (it) => { if (it.kind === 'pedestrian' || (it.kind === 'service' && it.w < 3.5)) return; if (U.distToSeg(x, z, it.ax, it.az, it.bx, it.bz) < it.w / 2 + 0.2) { bad = true; return true; } }); return bad; })()
        && !this.lamps.some((o) => !o.gone && Math.abs(o.x - x) < 1.5 && Math.abs(o.z - z) < 1.5);
      for (const l of this.lamps) {
        if (l.gone || !sweeps.hit(l.x, l.z, 0.13, -0.1)) continue;
        // along the kerb (the lamp's arm points at the road: the kerb runs across it), away from the corner first
        const ax = Math.cos(l.h), az = -Math.sin(l.h);
        let to = null;
        for (const d of [2, -2, 3.5, -3.5, 5, -5, 7, -7]) { const x = l.x + ax * d, z = l.z + az * d; if (okAt(x, z)) { to = [x, z]; break; } }
        if (!to) { l.gone = true; if (l.li !== undefined) { L[l.li] = 1e9; L[l.li + 2] = 1e9; } this.sweepDropped++; continue; }
        const dx = to[0] - l.x, dz = to[1] - l.z;
        this.lampByKey.delete(Math.round(l.hx * 4) + ',' + Math.round(l.hz * 4));
        l.x += dx; l.z += dz; l.hx += dx; l.hz += dz;
        if (l.li !== undefined) { L[l.li] += dx; L[l.li + 2] += dz; }
        this.lampByKey.set(Math.round(l.hx * 4) + ',' + Math.round(l.hz * 4), l);
        this.sweepMoved++;
      }
      this.planEnv.lamps = this.lamps.filter((l) => !l.gone);
    }
    const plan = (this.plan = planStreet({ ...this.planEnv, excl: (x, z) => excl(x, z) || !!sweeps.hit(x, z, 0.35, -0.1) }));
    this.ms.plan = Math.round(now() - t0);
    for (const it of plan.items) { it.y = (it.y || 0) + W.groundHeight(it.x, it.z); this.items.push(it); }
    this.densify(excl);
    for (const l of this.lamps) l.y = W.groundHeight(l.x, l.z);
    this.beacons = plan.beacons;
    // heritage lamps in the centre: one in three has a bike chained to it
    for (const l of this.lamps) {
      if (l.type !== 'H' || l.gone || W.zoneAt(l.x, l.z) !== 'centre' || h3(l.x, l.z, 61) > 0.33) continue;
      const s = h3(l.x, l.z, 62) < 0.5 ? 1 : -1, ax = Math.cos(l.h), az = -Math.sin(l.h);     // along the kerb
      const x = l.x - Math.sin(l.h) * 0.24 + ax * 0.1 * s, z = l.z - Math.cos(l.h) * 0.24 + az * 0.1 * s;
      let inB = false; W.buildingGrid.queryRadius(x, z, 1.5, (r) => { if (!r.b.part && x > r.bb.minX - 0.6 && x < r.bb.maxX + 0.6 && z > r.bb.minZ - 0.6 && z < r.bb.maxZ + 0.6 && (W.util.pointInPoly(x, z, r.b.poly) || W.util.pointInPoly(x + Math.cos(l.h) * 0.6, z - Math.sin(l.h) * 0.6, r.b.poly) || W.util.pointInPoly(x - Math.cos(l.h) * 0.6, z + Math.sin(l.h) * 0.6, r.b.poly))) { inB = true; return true; } });
      if (inB || excl(x, z) || Math.abs(W.groundHeight(x, z) - W.Y.pavement) > 0.004 || (this.planEnv.solid && this.planEnv.solid(x, z, 0.05))) continue;
      this.items.push({ k: 'bike', x, z, y: W.groundHeight(x, z), h: l.h + Math.PI / 2, roll: -0.14, tint: bikeCol(x, z), sh: 0 });
    }
    // trees standing in the pavement get an iron grille; leaves under street trees
    for (const t of map.trees) {
      const g = W.groundHeight(t[0], t[1]), pave = Math.abs(g - W.Y.pavement) < 0.004;
      let street = pave; if (!street) W.roadGrid.queryRadius(t[0], t[1], 14, (it) => { if (W.util.distToSeg(t[0], t[1], it.ax, it.az, it.bx, it.bz) < it.w / 2 + 6) { street = true; return true; } });
      if (street && !excl(t[0], t[1])) this.trees.push({ x: t[0], z: t[1], y: g, pave, s: t[2] || 10 });
    }
    // colliders: solid to the player and cars like a tree trunk; cabinets and grit bins low (cars ride the kerb past)
    const col = game.worldCollider;
    if (col) {
      for (const l of this.lamps) if (!l.gone) l.col = col.addCircle(l.x, l.z, 0.13, { tag: 'lamp' });
      for (const it of this.items) {
        if (it.r) it.col = col.addCircle(it.x, it.z, it.r, { tag: 'street', low: !!it.low });
        else if (it.box) it.col = col.addBox(it.x, it.z, it.box[0], it.box[1], it.h, { tag: 'street', low: true });
      }
    }
    // spatial index (32 m cells) over items + lamps
    this.all = [...this.lamps, ...this.items];
    this.cells = new Map();
    this.all.forEach((it, i) => { const k = ck(it.x, it.z); let a = this.cells.get(k); if (!a) this.cells.set(k, (a = [])); a.push(i); });
    this.postBoxes = this.items.filter((it) => it.k === 'postBox').map((it) => [it.x, it.z]);
    for (const p of map.pois) if (p.kind === 'post_box' && !game.overrides.skip.has(p.id)) this.postBoxes.push(p.p);
    this.grass = createGrass({ map, util: W.util, gh: W.groundHeight, Y: W.Y, inCollege: (x, z) => this.inCollege(x, z), excl: (x, z) => this.grassExcl(x, z), skip: game.overrides.skip });
    // worn corners: where a path through grass meets another path or a street, the grass is trodden bare
    this.worn = [];
    const PATHK = new Set(['footway', 'path', 'cycleway', 'bridleway', 'track']), ends = new W.util.SpatialGrid(20);
    for (const r of map.roads) if (r.pts && r.pts.length >= 2 && (PATHK.has(r.kind) || r.kind === 'residential' || r.kind === 'pedestrian' || r.kind === 'service')) for (const p of r.pts) ends.insertPoint(p[0], p[1], { p, r });
    const seen = new Set();
    for (const r of map.roads) {
      if (!PATHK.has(r.kind) || !r.pts || r.pts.length < 2 || game.overrides.skip.has(r.id)) continue;
      for (const p of [r.pts[0], r.pts[r.pts.length - 1]]) {
        const key = Math.round(p[0]) + ',' + Math.round(p[1]); if (seen.has(key)) continue;
        let meets = 0; ends.queryRadius(p[0], p[1], 0.6, (o) => { if (o.r !== r && Math.hypot(o.p[0] - p[0], o.p[1] - p[1]) < 0.5) meets++; });
        if (!meets || !this.grass.cellKind(p[0], p[1]) || h3(p[0], p[1], 81) > 0.7) continue;
        seen.add(key);
        this.worn.push([p[0] + (h3(p[0], p[1], 82) - 0.5) * 1.2, W.groundHeight(p[0], p[1]) + 0.009, p[1] + (h3(p[0], p[1], 83) - 0.5) * 1.2, 1.5 + h3(p[0], p[1], 84) * 1.2, h3(p[0], p[1], 85) * 6.28]);
      }
    }
    this.ready = true;
    this.ms.build = Math.round(now() - t0);
    this.mesh.visible = true; this.dmesh.visible = true;
  }
  // the centre's streets are lit more closely than the generated one-lamp-per-~30-m-alternating: a heritage lantern on
  // the opposite kerb half-way between each pair (Oxford's centre has them roughly every 15 m)
  densify(excl) {
    const W = this.W, U = W.util, L = W.lampPositions, added = [];
    const near = new U.SpatialGrid(16); for (const l of this.lamps) near.insertPoint(l.x, l.z, l);
    const crossings = new U.SpatialGrid(16); for (const p of this.game.map.pois) if (p.kind === 'crossing' || p.kind === 'traffic_signals' || p.kind === 'bus_stop' || p.kind === 'telephone' || p.kind === 'post_box') crossings.insertPoint(p.p[0], p.p[1], p);
    const entr = new U.SpatialGrid(16); for (const g of this.game.map.gates) entr.insertPoint(g.p[0], g.p[1], g);
    for (const l of this.lamps) {
      if (l.type !== 'H' || l.gone || W.zoneAt(l.x, l.z) !== 'centre') continue;
      let best = null;
      W.roadGrid.queryRadius(l.x, l.z, 10, (it) => { if (it.kind === 'service' || it.kind === 'pedestrian') return; const d = U.distToSeg(l.x, l.z, it.ax, it.az, it.bx, it.bz); if (d < it.w / 2 + 1.2 && (!best || d < best.d)) best = { it, d }; });
      if (!best) continue;
      const it = best.it, dx = it.bx - it.ax, dz = it.bz - it.az, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
      const t = ((l.x - it.ax) * ux + (l.z - it.az) * uz), cx = it.ax + ux * t, cz = it.az + uz * t;
      for (const sh of [13, -13, 9, -9]) {
        const x = 2 * cx - l.x + ux * sh, z = 2 * cz - l.z + uz * sh;
        if (Math.abs(W.groundHeight(x, z) - W.Y.pavement) > 0.004 || excl(x, z) || (this.sweeps && this.sweeps.hit(x, z, 0.13, -0.1))) continue;
        let clash = false;
        near.queryRadius(x, z, 9, (o) => { if (Math.hypot(o.x - x, o.z - z) < 9) { clash = true; return true; } });
        crossings.queryRadius(x, z, 4, (p) => { if (Math.hypot(p.p[0] - x, p.p[1] - z) < 3.5) { clash = true; return true; } });
        entr.queryRadius(x, z, 3, (g) => { if (Math.hypot(g.p[0] - x, g.p[1] - z) < 2) { clash = true; return true; } });
        for (const k of this.crossKerbs || []) if (Math.abs(k[0] - x) < 1.2 && Math.abs(k[1] - z) < 1.2 && Math.hypot(k[0] - x, k[1] - z) < 1.1) { clash = true; break; }
        if (this.planEnv && this.planEnv.solid && this.planEnv.solid(x, z, 0.15)) clash = true;
        if (!clash) for (const it of this.itemsNear9(x, z)) if (Math.hypot(it.x - x, it.z - z) < (it.box ? Math.max(it.box[0], it.box[1]) / 2 : it.r || 0.2) + 0.3) { clash = true; break; }
        let inB = false; W.buildingGrid.queryRadius(x, z, 1, (r) => { if (!r.b.part && U.pointInPoly(x, z, r.b.poly)) { inB = true; return true; } });
        let road = false; W.roadGrid.queryRadius(x, z, 12, (q) => { const d = U.distToSeg(x, z, q.ax, q.az, q.bx, q.bz); if (d < q.w / 2 + 0.3 || (q.kind !== 'service' && Math.abs(d - (q.w / 2 + 1.1)) < 0.45)) { road = true; return true; } });
        if (clash || inB || road) continue;
        const h = Math.atan2(cx + ux * sh - x, cz + uz * sh - z);
        const n = { k: 'lampH', type: 'H', x, z, y: 0, h, on: 0.16 + 0.24 * h3(x, z, 5), hx: x, hy: LAMP_HEAD.H[1], hz: z, r: 0.13, sh: 0.35, extra: true };
        near.insertPoint(x, z, n); added.push(n); n.li = L.length;     // [props] its entry in world.lampPositions
        L.push(x, LAMP_HEAD.H[1] + 0.2, z);
        break;
      }
    }
    for (const n of added) { this.lamps.push(n); this.lampByKey.set(Math.round(n.hx * 4) + ',' + Math.round(n.hz * 4), n); }
    this.lampsAdded = added.length;
  }
  /** plan items in the 9 m grid cells round (x, z) (for densify(); built on first use) */
  itemsNear9(x, z) {
    if (!this._g9) { this._g9 = new Map(); for (const it of this.items) { const k = Math.floor(it.x / 9) * 65536 + Math.floor(it.z / 9); let a = this._g9.get(k); if (!a) this._g9.set(k, (a = [])); a.push(it); } }
    const out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = this._g9.get((Math.floor(x / 9) + i) * 65536 + Math.floor(z / 9) + j); if (a) out.push(...a); }
    return out;
  }
  inCollege(x, z) {
    if (!this.colleges) { const U = this.W.util; this.colleges = (this.game.map.sites || []).filter((s) => s.kind === 'university').map((s) => ({ s, bb: U.polyBounds(s.poly) })); }
    const U = this.W.util; for (const { s, bb } of this.colleges) if (x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && U.pointInPoly(x, z, s.poly)) return true; return false;
  }
  grassExcl(x, z) {
    // grass grows in parks (South Park included) but not in the Meadow (its own long grass), the airfield or a cleared poly
    if (!this.gx) {
      const U = this.W.util, map = this.game.map, ps = [];
      const m = map.areas.find((a) => a.id === 'r1102976'); if (m) ps.push(m.poly);
      for (const c of this.cleared) if (c.o.furniture !== false) ps.push(c.p);
      this.gx = ps.map((p) => ({ p, bb: U.polyBounds(p) }));
    }
    const U = this.W.util, boxes = this.game.map.boxes || [];
    if (boxes.length > 2) for (let i = 2; i < boxes.length; i++) { const q = boxes[i]; if (x > q.minX && x < q.maxX && z > q.minZ && z < q.maxZ) return true; }
    for (const { p, bb } of this.gx) if (x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && U.pointInPoly(x, z, p)) return true;
    return false;
  }

  ranges() {
    const q = this.game.quality, t = (q && q.tier && RANGES[q.tier.name]) || RANGES.medium, d = q && q.dist ? Math.max(0.7, q.dist) : 1;
    const air = this.W.aerial;
    return { t, big: t.big * d, mid: air ? 0 : t.mid * d, small: air ? 0 : t.small * d, grass: air ? 0 : t.grass, step: t.step, decal: air ? 0 : t.decal * d, pool: t.pool * d, halo: t.halo * d, lod: t.lod, grassMax: t.grassMax, key: (t === RANGES.low ? 'l' : t === RANGES.medium ? 'm' : t === RANGES.high ? 'h' : 'u') + d.toFixed(2) + (air ? 'a' : '') };
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const game = this.game;
    if (!this.ready) { try { this.build(); } catch (e) { console.error('[streetscape] build', e); this.ready = true; return; } }
    if (game.scene !== game.worldScene) return;
    const cam = game.camera.position, W = this.W;
    this.dmat.uniforms.uFogD.value = game.worldScene.fog ? game.worldScene.fog.density || 0 : 0;
    this.dmat.uniforms.uAmb.value = 1 - 0.72 * W.night;
    this.dmat.uniforms.uPool.value = W.lightmap && W.lightmap.stats.drawn ? 0.45 : 1;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.2;
      const R = this.ranges(), day = Math.floor(game.time.now() / DAY_MS) % 7, nightOn = W.night > 0.08;
      if (R.key !== this.tierKey || day !== this.binDay) { this.tierKey = R.key; this.binDay = day; this.fillAt.x = 1e9; this.grassAt.x = 1e9; this.decalAt.x = 1e9; }
      if (nightOn !== this.nightOn) { this.nightOn = nightOn; this.decalAt.x = 1e9; }
      if (d2(cam, this.fillAt) > 64) this.fillSolid(cam.x, cam.z, R);
      if (d2(cam, this.grassAt) > 6.25) this.fillGrass(cam.x, cam.z, R);
      if (d2(cam, this.decalAt) > 100) this.fillDecals(cam.x, cam.z, R);
      // nearest post box for the [E] prompt
      const p = game.player.pos; let best = null, bd = 2.2;
      if (game.player.place === 'world') for (const b of this.postBoxes) { const d = Math.abs(b[0] - p.x) + Math.abs(b[1] - p.z); if (d < bd) { bd = d; best = b; } }
      if (best) this.postTarget.set(best[0], 0, best[1]); else this.postTarget.set(0, -1000, 0);
    }
    this.knockUpdate(dt);
  }

  // write one item into the solid buffer at vertex offset base -> [verts, indices] written (0 if no room)
  writeItem(it, proto, vBase, iArr, iBase, tilt = null) {
    const geo = this.mesh.geometry, A = geo.attributes, n = proto.nv;
    if (vBase + n > (iArr === this.fIdx ? this.VF : this.VF + this.VG) || iBase + proto.ni > iArr.length) return null;
    const pos = A.position.array, nor = A.normal.array, col = A.color.array, uv = A.uv.array, fx = A.aFx.array;
    const cs = Math.cos(it.h || 0), sn = Math.sin(it.h || 0), roll = it.roll || 0, cr = Math.cos(roll), sr = Math.sin(roll), sc = it.sc || 1;
    const tint = it.tint, on = it.on !== undefined ? it.on : 0;
    let ta = null; if (tilt) { const c = Math.cos(tilt.a), s = Math.sin(tilt.a); ta = { c, s, ax: tilt.ax, az: tilt.az }; }
    for (let i = 0; i < n; i++) {
      let px = proto.pos[i * 3] * sc, py = proto.pos[i * 3 + 1] * sc, pz = proto.pos[i * 3 + 2] * sc;
      let nx = proto.nor[i * 3], ny = proto.nor[i * 3 + 1], nz = proto.nor[i * 3 + 2];
      if (roll) { const y2 = py * cr - pz * sr, z2 = py * sr + pz * cr; py = y2; pz = z2; const ny2 = ny * cr - nz * sr, nz2 = ny * sr + nz * cr; ny = ny2; nz = nz2; }
      let X = px * cs + pz * sn, Z = -px * sn + pz * cs, NX = nx * cs + nz * sn, NZ = -nx * sn + nz * cs, Y = py, NY = ny;
      if (ta) { [X, Y, Z] = rodrigues(X, Y, Z, ta); [NX, NY, NZ] = rodrigues(NX, NY, NZ, ta); }
      const o = (vBase + i) * 3;
      pos[o] = it.x + X; pos[o + 1] = it.y + Y; pos[o + 2] = it.z + Z; nor[o] = NX; nor[o + 1] = NY; nor[o + 2] = NZ;
      if (tint) { col[o] = proto.col[i * 3] * tint[0]; col[o + 1] = proto.col[i * 3 + 1] * tint[1]; col[o + 2] = proto.col[i * 3 + 2] * tint[2]; }
      else { col[o] = proto.col[i * 3]; col[o + 1] = proto.col[i * 3 + 1]; col[o + 2] = proto.col[i * 3 + 2]; }
      uv[(vBase + i) * 2] = proto.uv[i * 2]; uv[(vBase + i) * 2 + 1] = proto.uv[i * 2 + 1];
      const g = proto.fx[i * 3]; fx[o] = g >= 0 ? g + on : g; fx[o + 1] = it.grass ? -1 : proto.fx[i * 3 + 1]; fx[o + 2] = proto.fx[i * 3 + 2];
    }
    for (let k = 0; k < proto.ni; k++) iArr[iBase + k] = vBase + proto.idx[k];
    return [n, proto.ni];
  }
  protoOf(it, d) {
    const P = this.P;
    if (it.type) return d > this.R.lod ? P['lamp' + it.type + 'F'] : P['lamp' + it.type];
    const p = P[it.k]; return Array.isArray(p) ? p[it.v || 0] : p;
  }

  fillSolid(cx, cz, R) {
    const t0 = now();
    this.fillAt.x = cx; this.fillAt.z = cz; this.R = R; this.fillN = (this.fillN || 0) + 1;
    let nv = 0, ni = 0;
    const rad = { big: R.big, mid: R.mid, small: R.small }, rmax = R.big;
    const visible = [], bin = this.binDay;
    for (let i = Math.floor((cx - rmax) / 32); i <= Math.floor((cx + rmax) / 32); i++) for (let j = Math.floor((cz - rmax) / 32); j <= Math.floor((cz + rmax) / 32); j++) {
      const a = this.cells.get(i * 65536 + j); if (!a) continue;
      for (const k of a) {
        const it = this.all[k]; if (it.gone || it.taken || (it.day !== undefined && it.day >= 0 && it.day !== bin) || it.nday === bin) continue;
        const r = rad[CLASS[it.k] || (it.type ? 'big' : 'mid')], dx = it.x - cx, dz = it.z - cz, d = dx * dx + dz * dz;
        if (d > r * r) continue;
        visible.push(k, d);
      }
    }
    this.inBuf = [];
    for (let q = 0; q < visible.length; q += 2) {
      const it = this.all[visible[q]], d = Math.sqrt(visible[q + 1]), proto = this.protoOf(it, d);
      const kn = this.knocked.get(it);
      const w = this.writeItem(it, proto, nv, this.fIdx, ni, kn ? kn.tilt : null); if (!w) break;
      it._bv = nv; it._bp = proto; it._bf = this.fillN;      // [props] where it sits in the buffer (takeItem hides it in place)
      if (it.knock && d < 40) this.inBuf.push({ it, v: nv, proto });
      nv += w[0]; ni += w[1];
    }
    this.nfV = nv; this.nfI = ni;
    this.compose(true, false);
    this.ms.solid = +(now() - t0).toFixed(2); this.ms.solidTris = ni / 3;
  }

  fillGrass(cx, cz, R) {
    const t0 = now();
    this.grassAt.x = cx; this.grassAt.z = cz;
    let nv = 0, ni = 0;
    const P = this.P, base = this.VF, gh = this.W.groundHeight, item = { x: 0, y: 0, z: 0, h: 0, sc: 1, tint: null, grass: true };
    if (R.grass > 0) this.grass.fill(cx, cz, R.grass, R.step, (proto, x, z, yaw, sc, tint) => {
      item.x = x; item.z = z; item.y = gh(x, z) + 0.004; item.h = yaw; item.sc = sc; item.tint = tint;
      const w = this.writeItem(item, P[proto], base + nv, this.gIdx, ni); if (!w) return false;
      nv += w[0]; ni += w[1]; return true;
    }, R.grassMax);
    this.ngV = nv; this.ngI = ni;
    this.compose(false, true);
    this.ms.grass = +(now() - t0).toFixed(2); this.ms.grassTris = ni / 3;
  }

  /** copy the furniture and grass index runs into the geometry's index and flag the changed ranges for upload */
  compose(solid, grass) {
    const geo = this.mesh.geometry, I = geo.index, A = geo.attributes;
    I.array.set(this.fIdx.subarray(0, this.nfI), 0); I.array.set(this.gIdx.subarray(0, this.ngI), this.nfI);
    I.clearUpdateRanges(); I.addUpdateRange(0, this.nfI + this.ngI); I.needsUpdate = true;
    // (2026-11 fix, the "black triangles": the vertex ranges are ADDED to, never cleared here — three clears them once
    // it has uploaded. A furniture refill and a grass refill in the same 0.2 s tick (anything faster than ~12 m/s: a
    // car) used to clear the furniture range again, so the GPU kept the OLD furniture vertices under the NEW index
    // buffer: sheets stretched between items tens of metres apart, signal heads drawn with a bus stop's vertices…)
    for (const k of ['position', 'normal', 'color', 'uv', 'aFx']) {
      const a = A[k], s = a.itemSize;
      if (solid && this.nfV) a.addUpdateRange(0, this.nfV * s);
      if (grass && this.ngV) a.addUpdateRange(this.VF * s, this.ngV * s);
      if ((solid && this.nfV) || (grass && this.ngV)) a.needsUpdate = true;
    }
    geo.setDrawRange(0, this.nfI + this.ngI);
  }

  fillDecals(cx, cz, R) {
    const t0 = now(), D = this.dw, W = this.W, night = this.nightOn;
    this.decalAt.x = cx; this.decalAt.z = cz;
    D.reset();
    const near = (x, z, r) => (x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r;
    // lamplight: pools on the ground under the heads, halos round them (night only)
    if (night) {
      for (const l of this.lamps) {
        if (l.gone || l.dark) continue;        // [props] l.dark: knocked down, its light out
        const c = LAMP_LIN[l.type];
        if (near(l.hx, l.hz, R.pool)) {
          const r = l.type === 'S' ? 8 : l.type === 'R' ? 6 : 5.4, k = l.type === 'H' ? 0.7 : 0.62;
          D.octagon(DRECT.pool, l.hx, W.Y.pavement + 0.012, l.hz, r, l.type === 'H' ? 1 : 1.25, [c[0] * k, c[1] * k, c[2] * k, 0], l.on, l.h);
        }
        if (l.type === 'H' && near(l.hx, l.hz, 35)) for (let m = 0; m < 3; m++) D.bill(DRECT.disc, l.hx + (m - 1) * 0.07, l.hy + 0.05 * m, l.hz + 0.05 * (m - 1), 0.03, [0.9, 0.8, 0.6, 0], -5);
        if (near(l.hx, l.hz, R.halo)) { const k = l.type === 'H' ? 0.75 : 0.6; D.bill(DRECT.halo, l.hx, l.hy - (l.type === 'H' ? 0.0 : 0.12), l.hz, l.type === 'S' ? 0.7 : l.type === 'R' ? 0.55 : 0.75, [c[0] * k, c[1] * k, c[2] * k, 0], l.on); }
      }
    }
    // Belisha beacons flash day and night
    for (const b of this.beacons) if (near(b[0], b[2], Math.max(R.pool, 120))) D.bill(DRECT.halo, b[0], b[1], b[2], 0.5, [1.0, 0.45, 0.06, 0], -2);
    if (R.decal > 0) {
      // contact shadows under the furniture and lamp columns (soft dark discs; the furniture casts no shadow map)
      for (let i = Math.floor((cx - R.decal) / 32); i <= Math.floor((cx + R.decal) / 32); i++) for (let j = Math.floor((cz - R.decal) / 32); j <= Math.floor((cz + R.decal) / 32); j++) {
        const a = this.cells.get(i * 65536 + j); if (!a) continue;
        for (const k of a) {
          const it = this.all[k]; if (it.gone || it.taken || !it.sh || (it.day !== undefined && it.day >= 0 && it.day !== this.binDay) || it.nday === this.binDay || !near(it.x, it.z, R.decal)) continue;
          const r = it.sh; D.ground(DRECT.disc, it.x, it.y + 0.006, it.z, r, r, 0, [0, 0, 0, 0.42], -4);
          if (it.k === 'binC' && h3(it.x, it.z, 71) < 0.7) D.ground(DRECT.stain, it.x + 0.4, it.y + 0.005, it.z + 0.3, 1.3, 1.3, h3(it.x, it.z, 72) * 6, [1, 1, 1, 0.75], -1);
        }
      }
      // worn grass at the corners where paths meet (desire lines)
      for (const w of this.worn) if (near(w[0], w[2], R.decal)) D.ground(DRECT.worn, w[0], w[1], w[2], w[3], w[3] * 0.8, w[4], [1, 1, 1, 0.75], -1);
      // trees: grilles in the pavement, fallen leaves round the trunk
      for (const t of this.trees) {
        if (!near(t.x, t.z, R.decal)) continue;
        if (t.pave) D.ground(DRECT.grille, t.x, t.y + 0.007, t.z, 0.65, 0.65, h3(t.x, t.z, 73) * 1.57, [1, 1, 1, 1], -1);
        const r = 1.6 + Math.min(2.4, t.s * 0.16); D.ground(DRECT.leaves, t.x + (h3(t.x, t.z, 74) - 0.5), t.y + 0.008, t.z + (h3(t.x, t.z, 75) - 0.5), r, r, h3(t.x, t.z, 76) * 6.28, [1, 1, 1, 0.9], -1);
      }
    }
    const g = this.dmesh.geometry;
    for (const k of ['position', 'uv', 'aCol', 'aP']) { const a = g.attributes[k]; a.clearUpdateRanges(); a.addUpdateRange(0, D.nv * a.itemSize); a.needsUpdate = true; }
    g.index.clearUpdateRanges(); g.index.addUpdateRange(0, D.ni); g.index.needsUpdate = true;
    g.setDrawRange(0, D.ni);
    this.dmesh.visible = D.ni > 0;
    this.ms.decals = +(now() - t0).toFixed(2); this.ms.decalTris = D.ni / 3;
  }

  // ---------------------------------------------------------------- knocking things over
  knock(it, dx, dz) {
    if (!it || this.knocked.has(it)) return false;
    const l = Math.hypot(dx, dz) || 1, ax = -dz / l, az = dx / l;     // tip away from the push: axis across it
    this.knocked.set(it, { t: 0, tilt: { a: 0, ax, az }, back: 25 });
    return true;
  }
  knockUpdate(dt) {
    if (this.game.props) { if (this.knocked.size) this.knockTick(dt); return; }      // [props] systems/props.js knocks things over now
    if (!this.inBuf || !this.inBuf.length) { if (this.knocked.size) this.knockTick(dt); return; }
    const p = this.game.player.pos, veh = this.game.player.vehicle, rr = veh ? 1.6 : 0.55;
    for (const e of this.inBuf) {
      const it = e.it; if (this.knocked.has(it) || it.gone) continue;
      const dx = it.x - p.x, dz = it.z - p.z;
      if (dx * dx + dz * dz < rr * rr && Math.abs(it.y - p.y) < 1.5) this.knock(it, dx, dz);
    }
    if (this.knocked.size) this.knockTick(dt);
  }
  knockTick(dt) {
    let dirty = false;
    for (const [it, k] of this.knocked) {
      k.t += dt;
      const target = k.t < k.back ? 1.45 : 0, a0 = k.tilt.a;
      k.tilt.a += (target - k.tilt.a) * Math.min(1, dt * (target ? 9 : 3));
      if (k.t >= k.back && k.tilt.a < 0.01) { this.knocked.delete(it); k.tilt.a = 0; }
      if (Math.abs(k.tilt.a - a0) > 1e-4 || !this.knocked.has(it)) {
        const e = this.inBuf && this.inBuf.find((q) => q.it === it);
        if (e) { const save = this.nfI; this.writeItem(it, e.proto, e.v, this.scratch || (this.scratch = new Uint32Array(4096)), 0, k.tilt.a ? k.tilt : null); dirty = true; this.nfI = save; }
      }
    }
    if (dirty) { const A = this.mesh.geometry.attributes; for (const n of ['position', 'normal']) { const a = A[n]; a.addUpdateRange(0, this.nfV * 3); a.needsUpdate = true; } }
  }

  // ---------------------------------------------------------------- [props] hooks (systems/props.js)
  /** fn(it, i) for every live item / lamp within r of (x, z) (32 m cells: no scan of the whole street) */
  itemsNear(x, z, r, fn) {
    if (!this.cells) return;
    for (let i = Math.floor((x - r) / 32); i <= Math.floor((x + r) / 32); i++) for (let j = Math.floor((z - r) / 32); j <= Math.floor((z + r) / 32); j++) {
      const a = this.cells.get(i * 65536 + j); if (!a) continue;
      for (const k of a) { const it = this.all[k]; if (it.gone || it.taken || (it.day !== undefined && it.day >= 0 && it.day !== this.binDay) || it.nday === this.binDay) continue; const dx = it.x - x, dz = it.z - z; if (dx * dx + dz * dz < r * r && fn(it, k)) return; }
    }
  }
  /** hide item i (its vertices collapse in place, its collider goes off) -> false if it is not there to take */
  takeItem(i) {
    const it = this.all && this.all[i]; if (!it || it.gone || it.taken) return false;
    it.taken = true;
    if (it.col) for (const s of [].concat(it.col)) s.on = false;
    if (it._bf === this.fillN && it._bp) {
      const A = this.mesh.geometry.attributes, pos = A.position.array, n = it._bp.nv, v0 = it._bv;
      for (let k = v0; k < v0 + n; k++) { pos[k * 3] = it.x; pos[k * 3 + 1] = -60; pos[k * 3 + 2] = it.z; }
      A.position.addUpdateRange(v0 * 3, n * 3); A.position.needsUpdate = true;
    }
    return true;
  }
  /** put item i back where it was */
  restoreItem(i) {
    const it = this.all && this.all[i]; if (!it || !it.taken) return false;
    it.taken = false;
    if (it.col) for (const s of [].concat(it.col)) s.on = true;
    if (it.dark) this.lampDark(i, false);
    if (it._bf === this.fillN && it._bp) {
      const save = this.nfI;
      this.writeItem(it, it._bp, it._bv, this.scratch || (this.scratch = new Uint32Array(4096)), 0);
      this.nfI = save;
      const A = this.mesh.geometry.attributes, n = it._bp.nv;
      for (const k of ['position', 'normal', 'color', 'uv', 'aFx']) { const a = A[k]; a.addUpdateRange(it._bv * a.itemSize, n * a.itemSize); a.needsUpdate = true; }
    } else this.fillAt.x = 1e9;
    return true;
  }
  /** a lamp's light (pool, halo, the pooled point light) goes out / comes back */
  lampDark(i, dark) {
    const l = this.all && this.all[i]; if (!l || !l.type || !!l.dark === !!dark) return;
    l.dark = !!dark;
    const L = this.W.lampPositions;
    if (l.li === undefined) for (let k = 0; k < L.length; k += 3) if (Math.abs(L[k] - l.hx) < 0.05 && Math.abs(L[k + 2] - l.hz) < 0.05) { l.li = k; break; }
    if (l.li !== undefined) { if (dark) { L[l.li] = 1e9; L[l.li + 2] = 1e9; } else { L[l.li] = l.hx; L[l.li + 2] = l.hz; } }
    this.decalAt.x = 1e9;
  }

  stats() {
    const by = {}; for (const it of this.items) if (!it.gone) by[it.k] = (by[it.k] || 0) + 1;
    const lamps = { H: 0, S: 0, R: 0 }; for (const l of this.lamps) if (!l.gone) lamps[l.type]++;
    return { ready: this.ready, items: this.items.filter((i) => !i.gone).length, by, lamps, lampsDropped: this.lampsDropped, lampsAdded: this.lampsAdded, lampsMoved: this.lampsMoved, lampsRejected: this.lampsRejected, wetRemoved: this.wetRemoved, mapSanity: this.game.mapSanity ? { moved: this.game.mapSanity.moved, dropped: this.game.mapSanity.dropped } : null, worldLampsRemoved: this.worldLampsRemoved, beacons: this.beacons.length, trees: this.trees.length, solidTris: this.nfI / 3 + this.ngI / 3, grassTris: this.ngI / 3, decalTris: this.dw.ni / 3, ms: this.ms };
  }
}

// ---------------------------------------------------------------- helpers
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);
const ck = (x, z) => Math.floor(x / 32) * 65536 + Math.floor(z / 32);
/** anything solid in the collider within r of (x, z) — walls, trunks, parked cars, module props (passages are open; unlike
 *  Collider.isFree the map edge does not count, so the streets drawn beyond it keep their lamps) */
function blockedAt(col, x, z, r) {
  if (col.inPassage(x, z)) return false;
  let hit = false;
  // (2026-11 sanity check: a mapped wall / hedge counts by its DRAWN thickness - a lamp, a wheelie bin or a recycling
  // box 0.15 m from the middle of a hedge stood in its leaves)
  const R = r + (SANITY ? 0.8 : 0);
  col._near(x - R, z - R, x + R, z + R, (s) => {
    if (hit || s.tag === 'lamp' || s.tag === 'street') return;      // (our own posts and the furniture: kept apart by the planner itself)
    if (s.seg) { const dx = s.x2 - s.x1, dz = s.z2 - s.z1, l2 = dx * dx + dz * dz; let t = l2 ? ((x - s.x1) * dx + (z - s.z1) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; if (Math.hypot(x - s.x1 - dx * t, z - s.z1 - dz * t) < r + ((SANITY && BARRIER_HALF[s.tag]) || 0)) hit = true; }
    else if (Math.hypot(x - s.x, z - s.z) < s.r + r) hit = true;
  });
  return hit;
}
/** the walking lines of the mapped crossings, where they leave the kerb: [x, z] points 0.4 / 1.0 / 1.6 m behind it, both sides */
export function crossingKerbs(map, roadGrid, U) {
  const out = [];
  for (const p of map.pois) {
    if (p.kind !== 'crossing' && p.kind !== 'traffic_signals') continue;
    let best = null;
    roadGrid.queryRadius(p.p[0], p.p[1], 8, (it) => { if (it.kind === 'service' || it.kind === 'pedestrian') return; const d = U.distToSeg(p.p[0], p.p[1], it.ax, it.az, it.bx, it.bz); if (d <= 8 && (!best || d < best.d)) best = { it, d }; });
    if (!best) continue;
    const it = best.it, l = Math.hypot(it.bx - it.ax, it.bz - it.az) || 1, dx = (it.bx - it.ax) / l, dz = (it.bz - it.az) / l;
    const t = Math.max(0, Math.min(1, ((p.p[0] - it.ax) * (it.bx - it.ax) + (p.p[1] - it.az) * (it.bz - it.az)) / (l * l))), cx = it.ax + (it.bx - it.ax) * t, cz = it.az + (it.bz - it.az) * t;
    for (const s of [1, -1]) for (const o of [0.4, 1.0, 1.6]) out.push([cx - dz * s * (it.w / 2 + o), cz + dx * s * (it.w / 2 + o)]);
  }
  return out;
}
function inPoly(U, poly, x, z) { const bb = poly._bb || (poly._bb = U.polyBounds(poly)); return x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && U.pointInPoly(x, z, poly); }
function distPoly(U, x, z, p) { let d = 1e9; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; d = Math.min(d, U.distToSeg(x, z, a[0], a[1], b[0], b[1])); } return d; }
function rodrigues(x, y, z, t) {
  // rotate (x, y, z) by angle (c, s) about the horizontal unit axis (ax, 0, az)
  const { c, s, ax, az } = t, dot = x * ax + z * az;
  const cx = -az * y, cy = az * x - ax * z, cz = ax * y;      // axis x v
  return [x * c + cx * s + ax * dot * (1 - c), y * c + cy * s, z * c + cz * s + az * dot * (1 - c)];
}
const BIKE = [[0.05, 0.05, 0.06], [0.55, 0.06, 0.05], [0.08, 0.16, 0.4], [0.75, 0.75, 0.72], [0.12, 0.3, 0.14], [0.45, 0.42, 0.4]];
const bikeCol = (x, z) => BIKE[Math.floor(h3(x, z, 63) * BIKE.length)];
