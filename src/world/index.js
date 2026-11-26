// Outdoor world renderer for Grand Theft Oxford. Contract: export async function buildWorld(game, map) -> game.world
// with update(dt), groundHeight(x,z) and the helpers documented in docs/WORLD_API.md.
import * as THREE from 'three';
import * as util from './util.js';
import { TileBatcher, GeoBuf, mergeBufs, makeRng, hash01, pointInPoly, polyBounds, distToSeg, tick, flatPoly, flatRibbon, wallQuad, signedArea, cleanRing, makeStatic } from './util.js';
import { createCityMaterials, createPublicMaterials, U, updateNight, registerNight, addDepthBias, atlasMaterial, setAtlasFeature, HAZE } from './materials.js';
import * as T from './textures.js';
import { createSky } from './sky.js';
import { buildGround, Y } from './ground.js';
import { buildWater } from './water.js';
import { buildRoads, makeGroundHeight, LANES } from './roads.js';
import { planBuildings, buildBuildings, emitBuilding, WALL_STYLES } from './buildings.js';
import { buildLandmarks, LANDMARKS } from './landmarks.js';
import { planBarriers, buildBarriers, thickWall } from './barriers.js';
import { buildVegetation } from './vegetation.js';
import { buildFurniture, LAMP_HEAD_Y } from './furniture.js';
import { createInteriorKit } from './interiorkit.js';
import { createQuality, TIERS, guessFromGpu, capRatio } from './quality.js';
import { createBlobs } from './blobs.js';
import { createPost } from './post.js';
import { PX_ORDER, opaqueOrder } from './_px_order.js';
import { installLightSkip } from './_px_lights.js';
import { createLightmap, installLightmapChunk } from './lightmap.js';
import { createSkylight, installSkylightChunk } from './_fx_skylight.js';
import { createContact } from './_fx_contact.js';
import { createGrassFx } from './_fx_grass.js';
import { createWaterFx } from './_fx_water.js';
import { createTreeFx } from './_fx_trees.js';
import { createAirWarm } from './airwarm.js';
import { createTufts } from './tufts.js';
import { characterRim } from '../core/characters.js';
import { applyTradeNames } from './tradenames.js';
import { inventedNames } from '../core/features.js';
import { TERRAIN, terrainH, terrainSlope, terrainWater, terrainLevel, terrainAfloat, terrainOverWater, terrainGL, terrainAnchors, terrainStandY, terrainStill, terrainRoomPlane, terrainRoomLevel, terrainLiftOf } from './terrain.js';
import { WALKIN_BAYS } from './walkin_bays.js';
import { buildBridgeBodies } from './_terrain_bridges.js';
import { terrainDrape, drapeWorld } from './_terrain_drape.js';
import { terrainRings } from './_terrain_lod.js';
import { SURF, initSurfaces, setSurfaces, crispCanvasTexture, addSurfDetail, sharpenTextures, hiScale, autoDetail, kitSurf } from './_surf_detail.js';
import { setSharpen } from './_surf_sharpen.js';
import { createRoomPresent } from './_surf_present.js';
import { compressSupport, compressCanvasTexture, releaseCanvasAfterUpload } from './_surf_compress.js';
import { keepPainter } from './_tex_keep.js';
const KITC = (() => { try { return /[?&]kitc=1(&|$)/.test(location.search); } catch (e) { return false; } })();      // (memory pass: kit atlases block-compressed — see atlasMaterial in the world API below)
import { TEXC, texCacheInit, texCacheSettle, loadCompressed, loadCanvas, storeCompressed, storeCanvas } from './_surf_cache.js';

const COLLEGE_RE = /College|Hall|Christ Church|House|Blackfriars|Wycliffe|St Stephen|Cohen Quad/;
const NOT_COLLEGE_RE = /Science|Department|Faculty|School|Quarter|Centre|Library|Institute|Triangle|Acland|Examination|Smith|Statistics|Sociology|History|Education|Rhodes|Maison|Development|Botanic|Meadow|Castle|Museum|Weston/;

function zoneAt(x, z) {
  if (x > -170 && x < 720 && z > -240 && z < 650) return 'centre';
  if (z < -620) return 'north';
  if (x > -500 && x < -150 && z > -850 && z < -150) return 'jericho';
  if (x > 880) return 'east';
  if (x < -450) return 'west';
  if (z > 650) return 'south';
  return 'mid';
}

export async function buildWorld(game, map) {
  const t0 = performance.now();
  const scene = game.worldScene, ov = game.overrides;
  const timings = {};
  let tl = t0;
  const lap = (k) => { const t = performance.now(); timings[k] = Math.round(t - tl); tl = t; };
  // real business names by default (the map's own). Under ?invented=1 (core/features.js) every real business name in
  // the map becomes an invented one before anything reads it (after the places' preMaps, whose own invented names
  // win): fascias here, then jobs, bus stops, labels … (world/tradenames.js; idempotent)
  if (inventedNames()) { try { applyTradeNames(map); } catch (e) { console.error('[world] trade names', e); } }
  TERRAIN.scene = scene;      // (the one scene whose coordinates the field belongs to: world/terrain.js ROOM PASSES)
  try { terrainGL(game.renderer); } catch (e) { console.error('[world] terrain texture', e); }     // (world/terrain.js: the height field goes to the card before anything is drawn)

  // city atlas resolution: 512 px cells unless the GPU looks like the low tier (texture memory, see WORLD_API.md)
  T.ATLAS.cell = guessFromGpu(game.renderer || {}) === 'low' && !/[?&]q=(medium|high)/.test(typeof location !== 'undefined' ? location.search : '') ? 256 : 512;
  // start-up (pass 4): finished textures are kept in the browser's cache between visits (world/_surf_cache.js)
  await texCacheInit();
  // texture pass: the top tier's high-resolution surfaces — fetched and uploaded here, on the loading screen (never later)
  if (await initSurfaces(game, guessFromGpu(game.renderer || {}))) { T.HI.on = true; T.HI.aniso = SURF.maxAniso; T.ATLAS.cell = T.HI.cell; T.HI.leaves = SURF.leaves; T.HI.dxt = compressSupport(game.renderer);
    // vehicles' decal atlas (plates, blinds, wheels) twice as large on this tier
    // (not switched on yet — unverified in the browser: `const V = await import('../systems/_vehiclemeshes.js'); V.sharpenVehicleAtlas(2, SURF.maxAniso);`)
  }
  // start-up (pass 4): the painted atlases as they were finished on an earlier visit — restored, not painted
  {
    const hi = T.HI.on, cs = T.HI.dxt, pack = hi && cs && cs.dxt && cs.srgb, an = hi ? T.HI.aniso : 8;
    T.PRE.v = (hi ? 'hi' : 'std') + T.ATLAS.cell + (pack ? 'c' : 'u') + '/';
    const P = T.PRE, v = P.v, tR = performance.now();
    // (only the top tier's set: measured on the lower tiers, restoring their small atlases from PNG took as long as
    // painting them — 1.2 s against 2.0 s for the whole materials step — so they simply paint)
    if (TEXC.on && pack) {
      const [fm, fa, gm, tr, sg] = await Promise.all([loadCompressed(v + 'facade'), loadCanvas(v + 'aux', an), loadCompressed(v + 'ground'), loadCompressed(v + 'tree'), loadCompressed(v + 'sign')]);
      if (fm && fa) P.facade = { map: fm.texture, aux: fa.texture, bytes: fm.bytes };
      if (gm) P.ground = { map: gm.texture, bytes: gm.bytes };
      if (tr && tr.texture) P.tree = tr.texture;
      if (sg && sg.extra && sg.extra.hash) P.sign = { hash: sg.extra.hash, aspects: sg.extra.aspects, texture: sg.texture };
    }
    timings.texRestore = Math.round(performance.now() - tR);
  }
  const restored = { facade: !!T.PRE.facade, ground: !!T.PRE.ground };
  const M = createCityMaterials();
  {
    // what was painted just now: block-compress it on the top tier (pass 3: an eighth of the memory, canvases let go)
    // and keep the finished result for the next visit
    const hi = T.HI.on, cs = T.HI.dxt, v = T.PRE.v, F = M.textures.facade, G = M.textures.ground;
    if (!restored.facade) {
      if (hi) { await tick(); M.textures.facade.map = M.facade.map = compressCanvasTexture(F.map, 'dxt1', cs, 'facade-atlas'); }
      const packed = !!M.facade.map.isCompressedTexture;
      if (packed) storeCompressed(v + 'facade', M.facade.map);
      if (F.aux && F.aux.image && F.aux.image.toBlob) { if (packed) storeCanvas(v + 'aux', F.aux.image, { linear: true, anisotropy: 8 }); if (hi) releaseCanvasAfterUpload(F.aux); }
    }
    if (!restored.ground) {
      if (hi) { await tick(); M.textures.ground.map = M.ground.map = compressCanvasTexture(G.map, 'dxt1', cs, 'ground-atlas'); }
      if (M.ground.map.isCompressedTexture) storeCompressed(v + 'ground', M.ground.map);
    }
    if (TEXC.verify && (restored.facade || restored.ground)) {
      // ?texverify=1: paint as well and compare with what the cache gave (compressed: the level-0 bytes)
      const P = T.PRE, keep = { facade: P.facade, ground: P.ground }, same = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
      P.facade = P.ground = null;
      try {
        const f = T.makeFacadeAtlas(), g2 = T.makeGroundAtlas(), out = {};
        if (hi && keep.facade && keep.facade.bytes) { const c = compressCanvasTexture(f.map, 'dxt1', cs); out.facade = same(c.mipmaps[0].data, keep.facade.bytes); c.dispose(); }
        if (hi && keep.ground && keep.ground.bytes) { const c = compressCanvasTexture(g2.map, 'dxt1', cs); out.ground = same(c.mipmaps[0].data, keep.ground.bytes); c.dispose(); }
        if (keep.facade && keep.facade.aux && keep.facade.aux.image && f.aux) {
          // the masks: the restored picture (already flipped) against the painted canvas, pixel for pixel
          const b = keep.facade.aux.image, c2 = document.createElement('canvas'); c2.width = b.width; c2.height = b.height; const x = c2.getContext('2d'); x.translate(0, b.height); x.scale(1, -1); x.drawImage(b, 0, 0);
          let ok = b.width === f.aux.image.width && b.height === f.aux.image.height; const H = b.height, st = 512;
          for (let y = 0; ok && y < H; y += st) ok = same(x.getImageData(0, y, b.width, Math.min(st, H - y)).data, f.aux.image.getContext('2d').getImageData(0, y, b.width, Math.min(st, H - y)).data);
          out.aux = ok;
        }
        TEXC.verified = out; console.log('[texcache] verify', JSON.stringify(out));
        if (f.map.dispose) f.map.dispose(); if (f.aux) f.aux.dispose(); if (g2.map.dispose) g2.map.dispose();
      } catch (e) { console.warn('[texcache] verify failed', e); }
      P.facade = keep.facade; P.ground = keep.ground;
    }
  }
  // one line for anyone asking whether a visit restored or painted (start-up, pass 4)
  if (T.HI.on) console.log(`[texcache] ${restored.facade && restored.ground ? 'RESTORED' : 'PAINTED'} the top-tier atlases: restore ${timings.texRestore} ms, materials step ${Math.round(performance.now() - tl)} ms so far; cache ${TEXC.on ? 'on, key ' + TEXC.key : 'off'}; hits [${TEXC.hits.join(', ')}]; layers ${SURF.packed ? 'packed files' : SURF.cached ? 'cache' : 'encoded here'}`);
  const batch = new TileBatcher(scene);
  // East Oxford extension: everything east of the original rectangle is batched apart (see TileBatcher.buf) and drawn
  // from much nearer (ground 800 m tiles within 600 m, far facades within 750 m instead of 1.4 km), so no view of the
  // original city submits any of it
  if (map.boxes && map.boxes.length > 1) batch.eastX = map.boxes[0].maxX;
  // tile sizes / cull distances tuned in the 2026-11 performance pass (fewer, larger tiles for the cheap flat layers;
  // facades/roofs keep 320 m tiles, culled at 1.4 km + tile radius ≈ 1.6 km, deep in the fog)
  const atlas = { cell: true, tint: true };
  // ground: one material for every layer; base/landuse/roads as ONE mesh (≈80k tris, cheaper than the draws it saves), paths/pavements/kerbs in 500 m tiles
  // drawn within ~450 m
  // (terrain: `stack` = a layer of the ground, ordered by drawing: world/_terrain_lod.js; the base ground is drawn first, at renderOrder - 2, then the water, then these)
  batch.layer('ground', { material: M.ground, tile: 4000, cull: 3000, ...atlas, layered: true, east: { tile: 800, cull: 600 }, stack: 'split', renderOrder: TERRAIN.mode === 'real' ? -28 : undefined });
  // (lanes pass, 2026-11: 420 -> 414 m and markings 300 -> 294 m: the pavements now run on round junctions and across
  // splits in the mapped ways, which grew a few tiles' bounding spheres by 1-5 m; the views' draw counts are kept)
  batch.layer('groundNear', { material: M.ground, tile: 500, cull: LANES ? 414 : 420, ...atlas, layered: true, stack: 'top', renderOrder: TERRAIN.mode === 'real' ? -27 : undefined });
  const G_ = (name, layerIndex, to = 'ground') => batch.layer(name, { alias: to, layerIndex });
  G_('base', 0); G_('area0', 1); G_('area1', 2); G_('area2', 3); G_('road', 5); G_('road2', 6); G_('path', 7, 'groundNear'); G_('raised', 1, 'groundNear');
  batch.layer('water', { material: M.water, tile: 4000, cull: 3000, edge: true, receiveShadow: false, east: { tile: 800, cull: 600 }, renderOrder: TERRAIN.mode === 'real' ? -25 : undefined });     // (terrain: after the ground's layers, which write no depth: the water covers what the map lays across a river)
  batch.layer('waterEdge', { alias: 'water' });   // lake shore bands: same mesh as the water (one draw fewer; 1.8k triangles)
  batch.layer('markings', { material: M.markings, tile: 600, cull: LANES ? 294 : 300, stack: 'top', renderOrder: TERRAIN.mode === 'real' ? -26 : undefined });
  // graphics pass 1: walls, roofs, parapets and hedges are ONE material (4×6 atlas) -> one draw per 240 m tile near the camera,
  // 480 m far-LOD tiles (no chimneys/sheds/low walls/hedges, one quad per wall) beyond ~200 m; shadows come from position-only proxies on 100 m
  // cells (within ~200 m; three's shadow-frustum culling picks the ones that matter) instead of the full tiles
  batch.layer('facade', { material: M.facade, tile: 240, cull: 1400, castShadow: true, ...atlas, top: true, detail: true, anchor: true, far: { tile: 480, near: 200 }, shadow: { tile: 100, dist: 200 }, east: { cull: 750 } });
  batch.layer('roof', { alias: 'facade' });
  batch.layer('parapet', { alias: 'facade' });
  batch.layer('crenel', { material: M.parapet, tile: 640, cull: 185, color: true, anchor: true });   // pass 5: 220 -> 185 m pays for the extra battlemented college fronts
  try { terrainAnchors(batch, map.buildings, WALKIN_BAYS); } catch (e) { console.error('[world] terrain anchors', e); }     // (terrain: buildings on a slope stand level; world/terrain.js)
  batch.layer('aoStrip', { material: M.aoStrip, tile: 300, cull: 160, color: true, receiveShadow: false, renderOrder: 1 });
  batch.layer('fence', { material: M.fence, tile: 600, cull: 250, castShadow: true });
  batch.layer('hedge', { alias: 'facade' });

  const colleges = map.sites.filter((s) => s.kind === 'university' && COLLEGE_RE.test(s.name) && !NOT_COLLEGE_RE.test(s.name)).map((s) => ({ s, bb: polyBounds(s.poly) }));
  const keble = colleges.filter((c) => c.s.name === 'Keble College');
  const inSites = (list, x, z) => list.some(({ s, bb }) => x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && pointInPoly(x, z, s.poly));

  const ctx = {
    game, map, ov, batch, M, scene, zoneAt, stats: {},
    lampSpots: [], signalSpots: [], belishaSpots: [], waterSegs: [], lampPositions: [], bikeStands: [],
    inCollege: (x, z) => inSites(colleges, x, z),
    /** name of the college whose site contains (x, z), or '' */
    collegeAt: (x, z) => { for (const { s, bb } of colleges) if (x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && pointInPoly(x, z, s.poly)) return s.name; return ''; },
    inKeble: (x, z) => inSites(keble, x, z),
    streetFacing(a, c, nx, nz) {
      const wx = (a[0] + c[0]) / 2, wz = (a[1] + c[1]) / 2, mx = wx + nx * 4, mz = wz + nz * 4;
      let hit = false, far = null, fd = 1e9;
      const long = Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) > 4.5;     // the wide-street test only for real fronts
      ctx.roadGrid.queryRadius(mx, mz, long ? 24 : 14, (it) => {
        if (it.kind === 'service' && it.w < 5) return;
        const d = distToSeg(mx, mz, it.ax, it.az, it.bx, it.bz);
        if (d < it.w / 2 + 5) { hit = true; return true; }
        if (long && d < it.w / 2 + 17 && d < fd && it.kind !== 'service') { fd = d; far = it; }
      });
      // named cycleways / footways stand in for the street where it is closed to traffic (the west half of Broad Street)
      if (!hit && long) ctx.pathGrid.queryRadius(mx, mz, 24, (it) => {
        if (!it.name || it.kind === 'steps') return;
        const d = distToSeg(mx, mz, it.ax, it.az, it.bx, it.bz);
        if (d < it.w / 2 + 5) { hit = true; return true; }
        if (d < it.w / 2 + 17 && d < fd) { fd = d; far = it; }
      });
      if (hit || !far || !ctx.buildingGrid) return hit;
      // wide streets and squares (Broad Street, St Giles', Radcliffe Square): the front still faces the street if the
      // wall looks towards it and nothing is built in between
      const dx = far.bx - far.ax, dz = far.bz - far.az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((wx - far.ax) * dx + (wz - far.az) * dz) / l2));
      const px = far.ax + dx * t, pz = far.az + dz * t, vx = px - wx, vz = pz - wz, vl = Math.hypot(vx, vz) || 1;
      if ((vx * nx + vz * nz) / vl < 0.6) return false;
      for (const f of [0.2, 0.5, 0.8]) {
        const qx = wx + vx * f, qz = wz + vz * f; let blocked = false;
        ctx.buildingGrid.queryRadius(qx, qz, 1, (r) => { if (qx >= r.bb.minX && qx <= r.bb.maxX && qz >= r.bb.minZ && qz <= r.bb.maxZ && pointInPoly(qx, qz, r.b.poly)) { blocked = true; return true; } });
        if (blocked) return false;
      }
      return true;
    },
  };
  lap('materials');
  await tick();

  installLightmapChunk();
  installLightSkip(SURF.wanted);      // pixel-cost pass: unlit point / spot lights skipped per pixel (world/_px_lights.js), top-tier sessions
  installSkylightChunk();      // (after the light map's: its code runs first, so lamplight is not dimmed with the sky's)
  const sky = createSky(game);
  buildGround(ctx); lap('ground');
  await tick();
  buildWater(ctx); buildRoads(ctx); lap('roads');
  await tick();
  // pass 7: buildings and barriers are planned first — what the barrier emitters save in a tile pays for the doors of
  // the quad-facing ranges and for the garden gates in the same tile (GeoBuf.saved7 / spent7)
  planBuildings(ctx); planBarriers(ctx);
  buildBuildings(ctx); buildLandmarks(ctx); lap('buildings');
  await tick();
  buildBarriers(ctx); lap('barriers');
  await tick();
  // pass 6: the triangles taken out of the always-drawn ground mesh pay for the facade depth near the camera — less what
  // any facade tile spent beyond its own savings (splitting long fronts into units, landmark columns), as if all those
  // tiles were in view at once
  { let over = 0, n = 0; for (const fb of ctx.pass6Bufs || []) if (fb.spent > fb.saved) { over += fb.spent - fb.saved; n++; }
    if (ctx.stats.pass6) { ctx.stats.pass6.tilesOverBudget = n; ctx.stats.pass6.overspentTris = over; }
    batch.dynGlobal = Math.max(0, (ctx.stats.groundSaved || 0) - over); }
  // pass 7: quad-facing walls take depth only while the camera is inside their college — and not while it stands on a
  // street that the site polygon happens to include (from a street they are behind the front ranges)
  batch.siteAt = (x, z) => {
    const s = ctx.collegeAt(x, z); if (!s) return '';
    let onStreet = false;
    ctx.roadGrid.queryRadius(x, z, 16, (it) => { if (it.kind === 'service' || it.kind === 'pedestrian' || it.kind === 'track') return; if (distToSeg(x, z, it.ax, it.az, it.bx, it.bz) < it.w / 2 + 3.4) { onStreet = true; return true; } });
    return onStreet ? '' : s;
  };
  { let s7 = 0, p7 = 0, worst = 0; for (const fb of ctx.pass6Bufs || []) { s7 += fb.saved7; p7 += fb.spent7; worst = Math.max(worst, fb.spent7 - fb.saved7); } Object.assign(ctx.stats.pass7 || (ctx.stats.pass7 = {}), { savedTris: s7, spentTris: p7, worstTileNet: worst, openFaces: ctx.stats.openFaces || 0, openFacesLite: ctx.stats.openFacesLite || 0 }); }
  batch.dynOpen = ctx.stats.alwaysSaved7 || 0;
  try { ctx.stats.bridgeBodies = buildBridgeBodies(ctx); } catch (e) { console.error('[world] bridge sides', e); }     // (terrain: what stands under a raised deck; into tiles that exist)
  batch.finish(); lap('merge');
  await tick();
  // the drawn ground height (roads, pavements, paths, landuse) is known from here on: trees and furniture stand on it
  const groundHeight = (ctx.groundHeight = makeGroundHeight(ctx));
  let mapTreeKeys = null;
  const veg = buildVegetation(ctx); lap('trees');
  await tick();
  const furn = buildFurniture(ctx); lap('furniture');
  const blobs = createBlobs(game, scene);
  const post = createPost(game);
  const lightmap = createLightmap(game);
  lightmap.setShops(ctx.buildingRecs);
  (game.warmups = game.warmups || []).push({ id: 'lightmap', fn: () => lightmap.warm() });
  const skylight = createSkylight(game, scene, veg);      // shader pass 10: ambient by place + the sun's bounce (tier.skyl)
  game.warmups.push({ id: 'skylight', fn: () => skylight.warm() });
  const contact = createContact(game, scene, blobs);      // soft shade under people and vehicles in diffuse light (tier.contact)
  const tufts = createTufts(ctx, game, scene);
  // shader pass 10: blades round the camera + the sward's detail (tier.grassFx)
  const grassFx = createGrassFx(game, scene, { ground: M.ground, groundTex: M.textures.ground.map, nx: 4, ny: M.ground.defines ? +M.ground.defines.ATLAS_NY : 7, macro: 0.011,
    meshes: () => batch.meshes.filter((r) => r.layer === 'ground' || r.layer === 'groundNear').map((r) => r.mesh),
    water: () => batch.meshes.filter((r) => r.layer === 'water').map((r) => r.mesh) });
  const treeFx = createTreeFx(game, scene, veg, M);      // shader pass 11: finer crowns near the camera, leaves that move (tier.treeFx)
  const waterFx = createWaterFx(game, M.water);      // shader pass 10: wind-driven wavelets, the player's wake (tier.waterFx)
  (game.warmups = game.warmups || []).push({ id: 'grassFx', fn: () => {
    // (the mask draw; and the blades' and the contact shade's programs compiled for the scene's lights and the post target, so their first frame compiles nothing)
    if (!(game.quality && game.quality.tier.grassFx)) return false;
    grassFx.warm();
    for (const m of [grassFx.mesh, contact.mesh, treeFx.mesh]) if (m) { const v = m.visible; m.visible = true; try { compileAsync(m); } finally { m.visible = v; } }
    return true;
  } });

  // ---------------------------------------------------------------- public API
  const mats = createPublicMaterials(M);
  const kit = createInteriorKit(mats);
  const apiCtx = (id, style) => ({ ...ctx, ov: { skip: new Set(), heights: new Map(), style: new Map(style ? [[id, style]] : []) } });

  let cullT = 0, frames = 0, logged = false, lastNight = -1;
  // ---- aerial mode (world.setAerial: systems/gliding.js while someone local is flying). Off = every line below is
  // skipped and ground views are exactly what they were. On: the camera height enters the tile distances (near-ground
  // layers fall away as you climb, near LOD only within cityNear in 3D), the street-front depth and grass tufts are off,
  // near 3D trees give way to the impostor cards above ~45 m, and — paid for by that — the far city, the far tree cards
  // and East Oxford's own tiles are drawn further out, under a little less haze. All re-derived every cull tick from the
  // effective tier, so the quality governor keeps working while flying.
  let aerial = null, aerialNear = null;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const NO_RELIEF = [0, 0];
  // (visual pass) far clearer air from height: the city stays legible to its far edge and the haze gathers at the horizon
  const aerialFog = (y) => 1 - 0.84 * sstep(30, 420, y);
  // ---- aerial material variants (visual pass): the city's two big materials without the close-up work nobody can see
  // from the air (albedo relief, weathering streaks, creeper, wall-foot AO, damp-road sheen) and with drifting cloud
  // shadows instead. Compiled ahead of use, off the main thread where the driver allows (world.warmAerial()), and
  // swapped onto the tile meshes only while aerial mode is on — the ground never sees them.
  let airMats = null, airReady = false, airSwapped = false, airWarm = null;
  const makeAirMats = () => {
    if (airMats) return airMats;
    const mk = (src, drop) => {
      const m = src.clone();
      m.onBeforeCompile = src.onBeforeCompile; const key = src.customProgramCacheKey();
      m.defines = { ...src.defines, AIR_VIEW: '' }; for (const d of drop) delete m.defines[d];
      m.customProgramCacheKey = () => key + 'air';
      m.name = src.name + 'Air';
      return m;
    };
    airMats = new Map([[M.facade, mk(M.facade, ['USE_LBUMP', 'USE_WEATHER', 'WEATHER_CELLS', 'WEATHER_FROM2', 'USE_IVY'])], [M.ground, mk(M.ground, ['USE_LBUMP', 'USE_WET'])]]);
    return airMats;
  };
  const swapAir = (on) => {
    if (on === airSwapped || (on && !airReady)) return;
    airSwapped = on;
    const from = on ? airMats : new Map([...airMats].map(([k, v]) => [v, k]));
    scene.traverse((o) => { if (o.isMesh && from.has(o.material)) o.material = from.get(o.material); });
  };
  /** Compile the materials of `obj` (not yet in the scene) for the outdoor render path without stalling a frame -> Promise (null: no renderer to compile with) */
  const compileAsync = (obj) => {
    const r = game.renderer;
    if (!r || !r.compileAsync) return null;
    try {
      const rt = post.target ? post.target() : null, prev = r.getRenderTarget();
      if (rt) r.setRenderTarget(rt);
      const p = r.compileAsync(obj, game.camera, scene);
      if (rt) r.setRenderTarget(prev);
      return p.catch(() => obj);
    } catch (e) { return Promise.resolve(obj); }
  };
  // per-step CPU timings of the aerial warm-up (world.warmStats: probes / the real-GPU console check)
  const warmLog = { steps: 0, ms: 0, worst: [] };
  const wstat = (what, ms) => {
    warmLog.steps++; warmLog.ms += ms;
    const W = warmLog.worst;
    if (W.length < 6 || ms > W[W.length - 1].ms) { W.push({ what, ms: Math.round(ms * 10) / 10 }); W.sort((a, b) => b.ms - a.ms); if (W.length > 6) W.length = 6; }
  };
  // compiled is not enough on ANGLE Metal (Macs): the GPU pipeline is built at a program's first draw — so everything is
  // also drawn once, a couple of materials a frame, into a tiny target nobody sees (world/airwarm.js)
  // (on the loading screen — world.warmDraw calls outstanding, the player still in the start room — a few new
  // materials a batch instead of one: nobody is watching the frame rate there)
  // (and, on the top tier, two a batch while the player is in a room of its own scene with the loading screen's
  //  leftovers or the city's tiles still to go — warmRest / streamTiles below: the room is a light picture)
  const warm = createAirWarm({ game, scene, post, stat: wstat, burst: () => (game.scene !== game.worldScene ? (warmAnywhere > 0 ? 4 : restBusy > 0 || streamIn ? 2 : 1) : 1) });
  // ---- arrival-stutter pass (2026-11), TOP TIER ONLY (the lower tiers do exactly what they did):
  //   * what the loading screen's warm-draw budget did not reach is no longer dropped: it is worked through behind the
  //     game (warmLoad {rest}; ?warmrest=0: dropped as before), a few ms a tick, and in the start room at the room's pace;
  //   * the city's tiles go up to the graphics card while the player is indoors too, and faster there (?streamin=0: not);
  //   * a tile's buffers go up one attribute at a time (airwarm.upload {split}; ?upsplit=0: a tile at once);
  //   * a street-front depth pool is on the card before its tile is switched to it (batch.dynUpload; ?dynup=0: at its first draw).
  const qsHas = (re) => { try { return re.test(location.search); } catch (e) { return false; } };
  const topTier = () => !!game.quality && game.quality.level === 'ultra';
  const restOff = qsHas(/[?&]warmrest=0/), streamInOff = qsHas(/[?&]streamin=0/), splitOff = qsHas(/[?&]upsplit=0/), dynUpOff = qsHas(/[?&]dynup=0/);
  let restBusy = 0, streamIn = false;
  const restSt = { left: 0, done: 0, ms: 0, worst: 0 };
  /** compile obj's materials (off the main thread where the driver can), then draw each never-drawn one once -> Promise | null */
  const prepare = (obj, first = false, opts = null) => { const p = compileAsync(obj); return p ? p.then(() => warm.draw(obj, first, opts)) : null; };
  let warmAnywhere = 0;        // a warmLoad running (the loading screen)
  const loadQ = []; let loadSeq = 0;
  const warmLoad = (budget, opts = null) => {
    loadQ.sort((x, y) => y.prio - x.prio || x.seq - y.seq);
    const t0 = performance.now(), st = { ms: 0, done: [], dropped: [] };
    warmAnywhere++;
    const rest = !!(opts && opts.rest) && !restOff && topTier();
    return new Promise((resolve) => {
      let over = false, cur = null;
      const end = () => {
        // (the budget is spent with things still queued: the loading screen ends here, the queue goes on behind the game)
        if (rest && budget > 0 && (loadQ.length || cur)) {
          over = true; warmAnywhere--; st.ms = Math.round(performance.now() - t0);
          st.rest = loadQ.map((q) => q.opts.id || '?'); if (cur) st.rest.unshift((cur.opts.id || '?') + ' (part)');
          // (the item the budget cut off is taken again from its start: what it has already queued or drawn is skipped)
          const left = loadQ.splice(0); if (cur) left.unshift(cur);
          cur = null; warmRest(left, st);
          resolve(st); return;
        }
        for (const q of loadQ) { q.res(false); st.dropped.push(q.opts.id || '?'); }
        loadQ.length = 0;
        if (cur) { st.dropped.push((cur.opts.id || '?') + ' (part)'); cur.res(false); cur = null; }
        warm.cancel(); warmAnywhere--; st.ms = Math.round(performance.now() - t0); resolve(st);
      };
      if (!(budget > 0)) { over = true; end(); return; }
      const timer = setTimeout(() => { over = true; end(); }, budget);
      const next = () => {
        if (over) return;
        if (!loadQ.length) { clearTimeout(timer); over = true; end(); return; }
        const q = (cur = loadQ.shift());
        const fin = (ok) => { if (over || cur !== q) return; cur = null; st.done.push(q.opts.id || '?'); q.res(ok !== false); next(); };
        if (q.opts.upload) { warm.upload(q.opts.upload).then(fin, fin); return; }
        const p = compileAsync(q.obj);
        if (!p) { fin(false); return; }
        p.then(() => { if (over || cur !== q) return; warm.draw(q.obj, false, q.opts).then(fin, fin); });
      };
      next();
    });
  };
  // the rest of the loading screen's queue, behind the game: one thing at a time, never more than ~3 ms of this in a
  // tick. A whole scene is taken a top-level object at a time, and only the objects that hold something never drawn.
  const warmRest = (left, st) => {
    restBusy++; st.restDone = [];
    const t0 = performance.now(); let slice = t0;
    const items = [];
    for (const q of left) {
      if (q.opts.upload) items.push({ q, up: q.opts.upload });
      else if (q.obj && q.obj.isScene) { items.push({ q, kids: q.obj.children.slice(), k: 0, ps: [] }); }
      else items.push({ q, obj: q.obj });
    }
    restSt.left = items.length;
    const finish = () => { restBusy--; restSt.left = 0; restSt.ms = Math.round(performance.now() - t0); };
    const yieldThen = (fn) => { const a = performance.now() - slice; if (a > restSt.worst) restSt.worst = Math.round(a * 10) / 10; setTimeout(() => { slice = performance.now(); fn(); }, 30); };
    const step = () => {
      if (!items.length) { finish(); return; }
      const it = items[0];
      const done = (ok) => { slice = performance.now(); items.shift(); restSt.left = items.length; restSt.done++; st.restDone.push(it.q.opts.id || '?'); try { it.q.res(ok !== false); } catch (e) { /* */ } yieldThen(step); };
      try {
        if (it.up) { warm.upload(it.up, { split: !splitOff }).then(done, done); return; }
        if (it.kids) {
          while (it.k < it.kids.length && performance.now() - slice < 3) {
            const o = it.kids[it.k++];
            if (!o.parent || !(o.isMesh || o.children.length) || !warm.fresh(o)) continue;
            const p = compileAsync(o); if (p) it.ps.push(p.then(() => warm.draw(o, false, it.q.opts)));
          }
          if (it.k < it.kids.length) { yieldThen(step); return; }
          Promise.all(it.ps).then(done, done); return;
        }
        const p = compileAsync(it.obj);
        if (!p) { done(false); return; }
        p.then(() => warm.draw(it.obj, false, it.q.opts)).then(done, done);
      } catch (e) { done(false); }
    };
    yieldThen(step);
  };
  let airWalked = false, airWalkI = -1;
  const airWalk = () => {
    if (airWalkI >= 0) return;
    airWalkI = 0;
    const ps = [];
    // then the textures and the city tiles nobody has drawn yet from here (the far ones): their buffers go up to the GPU
    // a few MB a frame (airwarm.js), instead of ~100 of them uploading on the first frame up
    const texs = [];
    let texI = 0;
    const textures = () => {
      const r = game.renderer, t0 = performance.now();
      if (r && r.initTexture) while (texI < texs.length && performance.now() - t0 < 3) { const a = performance.now(), tx = texs[texI++]; try { r.initTexture(tx); } catch { /* */ } wstat('texture ' + (tx.name || (tx.image && tx.image.width + 'x' + tx.image.height) || ''), performance.now() - a); }
      if (texI < texs.length) { setTimeout(textures, 30); return; }
      const a = performance.now();
      // (the city tiles, their far LODs and shadow casters, and any other plain mesh in the scene — place modules — of
      // some size; one entry per geometry)
      const up = [], seen = new Set(), add = (m) => { if (m && m.geometry && !seen.has(m.geometry)) { seen.add(m.geometry); up.push(m.geometry); } };
      for (const t of batch.meshes) add(t.mesh); for (const f of batch.far) add(f.mesh); for (const p of batch.proxies) add(p.mesh);
      scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.isBatchedMesh && !o.isSkinnedMesh && !o.geometry.isInstancedBufferGeometry && !o.geometry.morphAttributes.position && o.geometry.attributes.position && o.geometry.attributes.position.count > 300) add(o); });
      wstat('upload list', performance.now() - a);
      ps.push(warm.upload(up));
      Promise.all(ps).then(() => { airWalked = true; });
    };
    const step = () => {
      const ch = scene.children, t0 = performance.now();
      while (airWalkI < ch.length && performance.now() - t0 < 4) { const o = ch[airWalkI++]; if (o.isMesh || o.children.length) { const a = performance.now(); const p = prepare(o); if (p) ps.push(p); wstat('compile ' + (o.name || o.type), performance.now() - a); } }
      if (airWalkI < ch.length) { setTimeout(step, 30); return; }
      const a = performance.now(), texSeen = new Set();
      scene.traverse((o) => { if (o.isMesh || o.isSprite || o.isPoints) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) if (m) for (const k of ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap', 'aoMap']) { const t = m[k]; if (t && t.isTexture && !texSeen.has(t)) { texSeen.add(t); texs.push(t); } } } });
      wstat('texture list', performance.now() - a);
      setTimeout(textures, 30);
    };
    setTimeout(step, 30);
  };
  const warmAerial = () => {
    if (airWarm) return airReady ? null : airWarm;
    const a0 = performance.now(), mats = makeAirMats(), g = new THREE.Group();
    scene.traverse((o) => { if (o.isMesh && mats.has(o.material) && !g.userData['m' + o.material.id]) { g.userData['m' + o.material.id] = 1; const m = new THREE.Mesh(o.geometry, mats.get(o.material)); m.receiveShadow = o.receiveShadow; g.add(m); } });
    const p = prepare(g);
    wstat('air materials', performance.now() - a0);
    if (!p) { airReady = true; airWarm = Promise.resolve(); if (aerial) swapAir(true); return null; }
    // and everything already in the scene, drawn or not: from the air the whole city comes into view at once, and every
    // material nobody has drawn yet from the ground (far landmarks, place modules) would compile on that first frame.
    // Walked a few top-level objects per tick (~5 ms), so even a driver without parallel compiling never stalls long.
    airWalk();
    airWarm = p.then(() => { airReady = true; if (aerial) swapAir(true); });
    return airWarm;
  };
  // While aerial: an object a place module adds to the scene (it came within its draw distance) whose materials have
  // never been compiled is held back, hidden, until its programs are ready, instead of compiling on its first frame.
  const airSeen = new WeakSet(), airHeld = new Set();
  const newMaterials = (o) => {
    const props = game.renderer && game.renderer.properties; if (!props) return false;
    let fresh = false;
    o.traverse((c) => { if (fresh || !c.material) return; const ms = Array.isArray(c.material) ? c.material : [c.material]; for (const m of ms) { const pp = props.get(m); if (!pp.programs || !pp.programs.size || !pp.uniformsList) { fresh = true; break; } } });
    return fresh;
  };
  const airGate = () => {
    const ch = scene.children;
    for (let i = 0; i < ch.length; i++) {
      const o = ch[i];
      if (airSeen.has(o)) continue;
      airSeen.add(o);
      if (!o.visible || airHeld.has(o) || !newMaterials(o)) continue;
      const p = prepare(o, true); if (!p) continue;
      o.visible = false; airHeld.add(o);
      p.then(() => { if (airHeld.delete(o) && !o.visible) o.visible = true; });
    }
  };
  const parallel = () => { const r = game.renderer; return !!(r && r.extensions && r.extensions.has && r.extensions.has('KHR_parallel_shader_compile')); };
  const gateOn = (on) => {
    if (on && !parallel()) return;
    if (on) { for (const o of scene.children) airSeen.add(o); scene.onBeforeRender = airGate; }
    else if (scene.onBeforeRender === airGate) scene.onBeforeRender = function () {};
  };
  const SHADOW_STEPS = [110, 160, 230, 330, 440, 560];
  const airShadowAt = [0, 0, 0], fwd = new THREE.Vector3();
  const aerialShadow = (t, y) => {
    // one big, rarely re-rendered shadow box over the ground ahead of the camera (sky.setAir); the small box round the
    // player again below ~55 m, where its sharp near shadows matter more
    const maxH = (sky.shadowMapSize || 2048) * 0.27;
    let H = 0; for (const s of SHADOW_STEPS) if (y * 1.9 >= s * (aerial.half === s ? 0.85 : 1) && s <= maxH) H = s;
    aerial.half = H;
    if (!H) { if (batch.shadowAt) { batch.shadowAt = null; sky.setAir(null); } return; }
    const cam = game.camera; cam.getWorldDirection(fwd);
    const hl = Math.hypot(fwd.x, fwd.z) || 1, reach = Math.min(H * 0.72, fwd.y < -0.02 ? (y / -fwd.y) * hl : 1e9);
    const q = H / 4, x = Math.round((cam.position.x + (fwd.x / hl) * reach) / q) * q, z = Math.round((cam.position.z + (fwd.z / hl) * reach) / q) * q;
    airShadowAt[0] = x; airShadowAt[1] = z; airShadowAt[2] = H * 1.25; batch.shadowAt = airShadowAt;
    sky.setAir({ half: H, x, z });
  };
  const applyAerial = (y) => {
    const t = game.quality ? game.quality.tier : TIERS.medium, k = 1 + 0.6 * sstep(60, 400, y);
    batch.dynR = NO_RELIEF;
    batch.eastK = 1 + 1.2 * sstep(30, 300, y);
    const nr = t.cityNear * (1 - 0.6 * sstep(20, 100, y));
    for (const f of batch.far) { const fc = t.farCull * k; f.cull = f.east ? Math.min(fc, f.east * batch.eastK) : fc; f.near = nr; }
    veg.setFar(t.treeFar * k);
    const wantNear = y < (aerialNear === false ? 25 : 45);
    if (wantNear !== aerialNear) { aerialNear = wantNear; veg.setNear(wantNear ? t.treeNear : 0); }
    if (tufts.enabled) tufts.set(false);
    // street furniture (lamp posts, benches, bins, signs) is a speck from above: its draw distance shrinks as you climb
    const fk = Math.round((1 - 0.85 * sstep(25, 80, y)) * 20) / 20;
    if (fk !== aerial.fk) { aerial.fk = fk; furn.setQuality({ ...t, furniture: t.furniture * fk, lampHeadFar: t.lampHeadFar * Math.max(0.4, fk) }); furn.refresh((game.eye || game.camera.position).x, (game.eye || game.camera.position).z, true); }
    aerialShadow(t, y);
    if (!airWarm) warmAerial(); else swapAir(true);
  };
  // Background upload of the city tiles nobody has drawn yet (smoothness 4). A tile's vertex buffers go up to the GPU at
  // its first draw, and on ANGLE Metal the copy costs the GPU process ~9 ms a MB with nothing on the main thread: arriving
  // somewhere new (a long jump, a fast ride into another district) first-drew ~10 MB of tiles at once, a 50–110 ms frame
  // three frames later (New College, North Oxford, St Giles', Headington). So outdoors on the ground, while the warm-up
  // drawer is idle, the nearest never-drawn tiles go up out of sight (airwarm.upload: one small batch, a GPU fence
  // apart), nearest first. Not the facade depth pools (made when a front comes within reach). ?tilestream=0: off.
  const STREAM_BYTES = 1.2e6, STREAM_R = 4000;
  const streamOff = typeof location !== 'undefined' && /[?&]tilestream=0/.test(location.search);
  let streamT = 1, streamL = null; const streamSt = { batches: 0, mb: 0, left: -1 };
  const drawnGeo = (g) => !!(g._listeners && g._listeners.dispose && g._listeners.dispose.length);
  function streamTiles(dt, cam, fast = false) {
    if (streamOff || !game.renderer || !game.renderer.compileAsync || (streamT -= dt) > 0) return;
    streamT = fast ? 0 : 0.2;
    if (!streamL) {
      streamL = []; const seen = new Set();
      const add = (g, x, z) => { if (g && g.attributes && g.attributes.position && !seen.has(g)) { seen.add(g); streamL.push({ g, x, z, b: 0 }); } };
      for (const t of batch.meshes) add(t.dyn ? t.dyn.staticGeo || t.mesh.geometry : t.mesh.geometry, t.x, t.z);
      for (const f of batch.far) { if (f.mesh) add(f.mesh.geometry, f.x, f.z); for (const r of f.recs) add(r.mesh.geometry, f.x, f.z); }
      for (const p of batch.proxies) add(p.mesh.geometry, p.x, p.z);
      for (const e of streamL) { const g = e.g; let b = g.index ? g.index.array.byteLength : 0; for (const n in g.attributes) b += g.attributes[n].array ? g.attributes[n].array.byteLength : 0; e.b = b; }
    }
    // the nearest never-drawn ones, up to STREAM_BYTES (at least one)
    const L = streamL, cx = cam.x, cz = cam.z;
    let keep = 0; for (let i = 0; i < L.length; i++) if (!L[i].sent && !drawnGeo(L[i].g)) L[keep++] = L[i]; L.length = keep;
    streamSt.left = keep;
    if (!keep) return;
    const near = [];
    for (const e of L) { const d = Math.hypot(e.x - cx, e.z - cz); if (d < STREAM_R) near.push([d, e]); }
    if (!near.length) return;
    near.sort((a, b) => a[0] - b[0]);
    const up = []; let bytes = 0;
    // (indoors — fast — the drawer is kept fed: it takes its own few MB a batch)
    const cap = fast ? STREAM_BYTES * 5 : STREAM_BYTES;
    for (const [, e] of near) { if (up.length && bytes + e.b > cap) break; up.push(e.g); bytes += e.b; e.sent = true; }
    streamSt.batches++; streamSt.mb += bytes / 1e6; if (fast) streamSt.indoors = (streamSt.indoors || 0) + bytes / 1e6;
    warm.upload(up, !splitOff && topTier() ? { split: true } : null);
  }
  // (terrain: the offset of the level-standing building at or within 0.75 m of a point, for what places build on it -
  //  _terrain_drape.js standMesh. The building is looked up once per half-metre cell: places have millions of vertices)
  const standCells = new Map();
  const standAuto = (x, z, y) => {
    if (TERRAIN.mode !== 'real' || !batch.anchors || !ctx.buildingGrid) return 0;
    const k = (Math.round(x * 2) + 40000) * 80000 + (Math.round(z * 2) + 40000);
    let A = standCells.get(k);
    if (A === undefined) {
      let best = null, bd = 0.75;
      ctx.buildingGrid.queryRadius(x, z, 1.75, (rec) => {
        const b = rec.b; if (!b || !b.poly || !b.c) return;
        let d = pointInPoly(x, z, b.poly) ? 0 : 1e9;
        if (d) for (let i = 0; i < b.poly.length; i++) { const p = b.poly[i], q = b.poly[(i + 1) % b.poly.length]; d = Math.min(d, distToSeg(x, z, p[0], p[1], q[0], q[1])); }
        if (d < bd) { bd = d; best = b; }
      });
      A = best ? batch.anchors.get(best.c[0] + ',' + best.c[1]) : undefined;
      if (A === undefined || A !== A) A = null;
      standCells.set(k, A);
    }
    return A === null ? 0 : terrainStandY(A, x, z, y);
  };
  const glowPools = []; let glowSettle = false;      // (addLampGlow: [pool, x, z, the lamp's height])
  const world = {
    /** per frame */
    update(dt) {
      if (game.quality) game.quality.tick();
      if (!TERRAIN.cam && game.camera) TERRAIN.cam = (game.eye || game.camera.position);     // (hills: the lift is relative to the ground under the camera)
      // (... or under the player, for a camera that follows them; swimming / in a punt, the water they are on. The player's
      //  own figure is marked afloat while over water, so it stays down with the boat under a bridge)
      if (game.quality) terrainRings(game.quality.level);      // (terrain: the rings' radii are per tier, _terrain_lod.js TIER_RINGS)
      if (glowSettle) {      // (lamps the places added: each pool down or up to the floor under its lamp, see addLampGlow)
        glowSettle = false;
        for (const [i, x, z, y] of glowPools) { let g = NaN; try { g = world.groundHeight(x, z); } catch (e) { /* */ } if (g === g && g !== null && Number.isFinite(g) && g < y - 1) furn.setPoolY(i, g + 0.17); }
        furn.refresh((game.eye || game.camera.position).x, (game.eye || game.camera.position).z, true);
      }
      { try { drapeWorld(scene, 2, standAuto); } catch (e) { if (!world._drapeErr) { world._drapeErr = 1; console.error('[world] terrain drape', e); } } }     // (terrain: hand-built ground is cut to the surveyed surface, a few ms a frame until done; indoors too: the memory pass holds uploaded arrays until this pass has been round, world/_geo_free.js)
      // (in a walk-in room the player's own coordinates are the room's: his place in the world is worldPos, and the
      //  reference is the room's one level, so that the room he stands in is drawn exactly where its logic has it)
      { const p = game.player; if (p && p.pos) { const fo = TERRAIN.focus || (TERRAIN.focus = [0, 0]), inRoom = p.place && p.place !== 'world', wp = inRoom && p.worldPos ? p.worldPos : p.pos; fo[0] = wp.x; fo[1] = wp.z;
        { const I = game.interiors, d = inRoom && I && I.defs ? I.defs.get(p.place) : null, t = d && d.sl ? d.sl.terrain : null, L = t ? terrainRoomLevel(t, wp.x, wp.z) : null; TERRAIN.focusLevel = L === null || L === undefined || L !== L ? null : L; }
        const fl = !!(p.swim || (p.vehicle && p.vehicle.kind === 'punt')) && terrainOverWater(fo[0], fo[1]); TERRAIN.focusAfloat = fl; const g = p.character && p.character.group; if (g && !!g._gtoAfloat !== fl) { terrainAfloat(g, fl); g._gtoAfloat = fl; } } }
      // (indoors too while something asked for on the loading screen is still queued — world.warmDraw: the start room)
      streamIn = !streamInOff && !streamOff && game.scene !== game.worldScene && streamSt.left !== 0 && topTier();
      if (warm.busy && (game.scene === game.worldScene || warmAnywhere > 0 || restBusy > 0 || streamIn)) warm.pump();
      sky.update(dt);
      const night = sky.state.night;
      if (Math.abs(night - lastNight) > 0.002) { updateNight(night); lastNight = night; }
      characterRim.value.copy(sky.hemi.color).multiplyScalar(sky.hemi.intensity * (game.scene === game.worldScene ? 0.42 : 0.25));
      if (game.scene !== game.worldScene) {
        // (top tier: the tiles round the room go up while the player is in it — nearest the player's place in the world first)
        if (streamIn && !aerial && !warm.busy && warmAnywhere === 0) { const pl = game.player; streamTiles(dt, pl && pl.place !== 'world' && pl.worldPos ? pl.worldPos : (game.eye || game.camera.position), true); }
        lightmap.update(0, 0); skylight.off(); return;     // (indoors: the lit materials there must not read the street's light)
      }
      const cam = (game.eye || game.camera.position);
      if (aerial) {
        // (sky.update set it this frame) less haze looking down from height — but growing with distance², so the ground
        // is fully hazed by the far plane and meets the sky's haze band without a seam
        scene.fog.density *= aerialFog(cam.y);
        const far = game.camera.far, dn = scene.fog.density * far;
        HAZE.fog[0] = dn > 0 ? Math.min(0.01, Math.max(0, (2.8 / dn - 1) / far)) : 0;
      } else if (HAZE.fog[0]) HAZE.fog[0] = 0;
      if (!aerial && !warm.busy) streamTiles(dt, cam);
      cullT -= dt;
      if (cullT <= 0) { cullT = 0.25; if (aerial) applyAerial(cam.y); batch.cull(cam.x, cam.z, aerial ? Math.max(0, cam.y) : 0); veg.refresh(cam.x, cam.z); furn.refresh(cam.x, cam.z); tufts.refresh(cam.x, cam.z); }
      const p = game.player.place === 'world' || !game.player.worldPos ? game.player.pos : game.player.worldPos;      // (in a walk-in room: the true world position)
      furn.update(dt, p.x, p.z, night);
      blobs.update(night);
      lightmap.update(dt, night);
      skylight.update(dt, sky, !!aerial);
      contact.update(sky.sun.shadow.intensity, night);
      grassFx.update(dt, sky, !!aerial);
      waterFx.update(dt, sky, U.time.value);
      treeFx.update(dt, sky, !!aerial);
      if (!logged && ++frames === 3 && game.renderer && game.renderer.info) {
        logged = true;
        const r = game.renderer.info.render;
        console.log(`[world] first frames: ${r.calls} draw calls, ${(r.triangles / 1e3).toFixed(0)}k triangles (camera at ${cam.x.toFixed(0)},${cam.z.toFixed(0)})`);
      }
    },
    /** the parts update() drives, for measuring tools only (tools/moving_probe.mjs --eval: one of them stubbed for an A/B) */
    _parts: { batch, veg, furn, tufts, blobs, lightmap, skylight, contact, grassFx, waterFx, treeFx, sky },
    /** height (m) of the drawn ground surface at (x, z): road, pavement (kerb = 0.35 m ramp), path or landuse — see roads.js */
    groundHeight,
    /** hills (world/terrain.js): how far the DRAWN ground at (x, z) is lifted above the flat world the game runs in; add it only to something drawn outside the scene's materials (they lift themselves) */
    terrainHeight: terrainH, terrainSlope, terrain: TERRAIN,
    /** the same for water and what floats on it; metres above sea level of the drawn ground; mark an object as afloat (it rides on the water's level: a boat under a bridge, alongside a bank) */
    terrainWater, terrainLevel, terrainAfloat,
    /** terrain: a picture of a room is being taken in the room's own frame (core/_roomview.js): on = no lift until off */
    terrainStill,
    /** terrain: the plane a walk-in room stands on, [A, Bx, Bz] in world x, z (world/terrain.js terrainRoomPlane; `room` = a room's sl.terrain) and its height at a point */
    terrainRoomPlane, terrainRoomLevel,
    /** terrain: a place's own SHELL made to stand at ONE level - `level` in metres above the datum as world.terrainHeight
     *  gives it (the field at the door of the walk-in room it stands round: that room is drawn at that one height):
     *  every vertex of every static mesh under `object` gets (level - the ground under it) added, less under `foot`
     *  metres (default 1: the foot stays on the ground and the bottom metre takes up the difference, as the city's own
     *  houses; 0 = the whole thing moves). Once, after it is built; the geometry is marked so the draping pass leaves
     *  it. Not for anything that moves, nor for the room itself (rooms are levelled where they are drawn). -> vertices moved */
    terrainLevelObject(object, level, foot = 1) {
      if (TERRAIN.mode !== 'real' || !object || !(level === level)) return 0;
      let n = 0; const v = new THREE.Vector3(), inv = new THREE.Matrix4(), im = new THREE.Matrix4();
      const ramp = (y) => { if (!(foot > 0)) return 1; const t = Math.max(0, Math.min(1, y / foot)); return t * t * (3 - 2 * t); };
      object.updateWorldMatrix(true, true);
      object.traverse((o) => {
        if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
        const lift = terrainLiftOf(o);      // (the same height the shader will add: the ground material's layers ride on other fields than the rest)
        if (o.isInstancedMesh) {
          // (an instance is lifted about its own place: it is moved as one)
          if (o.userData.terrainLevelled) return; o.userData.terrainLevelled = true;
          inv.copy(o.matrixWorld).invert(); const e = inv.elements;
          for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, im); v.setFromMatrixPosition(im).applyMatrix4(o.matrixWorld); const d = (level - lift(v.x, v.z, 1)) * ramp(v.y); if (!d) continue; im.elements[12] += e[4] * d; im.elements[13] += e[5] * d; im.elements[14] += e[6] * d; o.setMatrixAt(i, im); n++; }
          o.instanceMatrix.needsUpdate = true; if (o.computeBoundingSphere) o.computeBoundingSphere();
          return;
        }
        if (o.geometry.userData.terrainLevelled) return;
        const P = o.geometry.attributes.position, LA = o.geometry.attributes.aLayer; if (!P || P.isInterleavedBufferAttribute) return;
        inv.copy(o.matrixWorld).invert(); const e = inv.elements;
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld);
          const d = (level - lift(v.x, v.z, LA ? LA.getX(i) : 1)) * ramp(v.y); if (!d) continue;
          P.setXYZ(i, P.getX(i) + e[4] * d, P.getY(i) + e[5] * d, P.getZ(i) + e[6] * d); n++;
        }
        o.geometry.userData.terrainLevelled = true; o.geometry.userData.terrainDraped = true;
        P.needsUpdate = true; o.geometry.computeBoundingSphere(); if (o.geometry.boundingBox) o.geometry.computeBoundingBox();
      });
      return n;
    },
    /** terrain: what to add to the y of something fixed to a wall at (x, z) (a plaque, a wall lamp, a bracket) so that it
     *  keeps its place on a generated building that stands level on sloping ground: that building's level less the
     *  ground at the point; 0 off the surveyed ground, away from buildings (r metres) and on buildings that follow the ground */
    terrainStand(x, z, r = 2.5, y) {
      if (TERRAIN.mode !== 'real' || !batch.anchors || !ctx.buildingGrid) return 0;
      let best = null, bd = r;
      ctx.buildingGrid.queryRadius(x, z, r + 1, (rec) => {
        const b = rec.b; if (!b || !b.poly || !b.c) return;
        let d = pointInPoly(x, z, b.poly) ? 0 : 1e9;
        if (d) for (let i = 0; i < b.poly.length; i++) { const p = b.poly[i], q = b.poly[(i + 1) % b.poly.length]; d = Math.min(d, distToSeg(x, z, p[0], p[1], q[0], q[1])); }
        if (d < bd) { bd = d; best = b; }
      });
      const A = best ? batch.anchors.get(best.c[0] + ',' + best.c[1]) : undefined;
      return A === undefined ? 0 : terrainStandY(A, x, z, y);
    },
    /** the same for a whole object: every static mesh under it that a place has built ONTO the city's generated buildings
     *  (balconies, oriels, a dome on a turret, a hand-made shop front): each vertex takes the level of the building at or
     *  within r metres of it, as world.terrainStand. Call once, after it is built. Not for a place's own buildings. -> vertices moved */
    terrainStandObject(object, r = 2.5) {
      if (TERRAIN.mode !== 'real' || !batch.anchors || !object) return 0;
      let n = 0; const v = new THREE.Vector3(), inv = new THREE.Matrix4();
      object.updateWorldMatrix(true, true);
      object.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || o.geometry.userData.terrainStood) return;
        const P = o.geometry.attributes.position; if (!P || P.isInterleavedBufferAttribute) return;
        inv.copy(o.matrixWorld).invert(); const e = inv.elements; let any = false;
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld);
          const d = this.terrainStand(v.x, v.z, r, v.y); if (!d) continue;
          P.setXYZ(i, P.getX(i) + e[4] * d, P.getY(i) + e[5] * d, P.getZ(i) + e[6] * d); n++; any = true;      // (world up, in the mesh's own frame)
        }
        o.geometry.userData.terrainStood = true;
        if (any) { P.needsUpdate = true; o.geometry.computeBoundingSphere(); if (o.geometry.boundingBox) o.geometry.computeBoundingBox(); }
      });
      return n;
    },
    /** hand-built ground on real terrain: cut a mesh's / group's / geometry's flat, upward polygons so they follow the surveyed surface: terrainDrape(target, { grid = 5, lift = 0, up = 0.7, below, matrix }) -> { meshes, added }; ordinary static ground is draped by the world itself (world/_terrain_drape.js) */
    terrainDrape,

    // lighting / time
    sun: sky.sun, hemi: sky.hemi, sky,
    get night() { return sky.state.night; },
    get isDark() { return sky.state.night > 0.5; },
    get sunElevation() { return sky.state.sunEl; },
    sunDir: sky.sunDir, uniforms: U,
    registerNight(material, scale = 1, base = 0) { return registerNight(material, scale, base); },
    /** A mesh using a MeshStandardMaterial with an emissiveMap of window glass: its emissive follows the night factor. */
    registerWindows(mesh, scale = 1.2) { const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; for (const m of ms) { if (m.emissive && m.emissive.getHex() === 0) m.emissive.setHex(0xffb870); registerNight(m, scale, 0); } return mesh; },

    // materials & textures
    mats, cityMats: M, Y,
    tex: {
      facade: T.facadeTexture, ground: T.groundTexture, roof: T.roofTexture,
      /** {map, emissive} for one bay × one storey; windows: 'sash'|'tudor'|'gothic'|'door'|'none' */
      stoneWall: ({ windows = 'sash' } = {}) => T.facadeTexture({ sash: 'stoneSash', tudor: 'stoneTudor', gothic: 'stoneGothic', door: 'stoneDoor', none: 'stoneBlank' }[windows] || 'stoneSash'),
      brickWall: ({ windows = 'sash' } = {}) => T.facadeTexture({ sash: 'brickSash', door: 'brickDoor', none: 'brickBlank' }[windows] || 'brickSash'),
      renderWall: ({ windows = 'sash' } = {}) => T.facadeTexture({ sash: 'renderSash', door: 'renderDoor', shop: 'shopfront', shopDoor: 'shopfront', none: 'renderBlank' }[windows] || 'renderSash'),
      plaster: T.plasterTexture, woodFloor: T.woodFloorTexture, carpet: T.carpetTexture, tiles: T.tileTexture, panelling: T.panellingTexture,
      books: T.bookTexture, brick: T.brickTexture, stone: T.stoneTexture, glow: () => M.glowTex,
      sign(text, { bg = '#0f2a1d', fg = '#d9b45a', font } = {}) { const a = T.makeSignAtlas([{ text, bg, fg, font }]); const t = a.texture; const [u0, v0, u1, v1] = a.uv(0); t.repeat.set(u1 - u0, v1 - v0); t.offset.set(u0, v0); return t; },
      cells: { facade: T.FACADE_CELLS, roof: T.ROOF_CELLS, ground: T.GROUND_CELLS },
    },
    wallStyles: WALL_STYLES,
    /**
     * Standalone facade material (one texture repeat = one bay × one storey) whose windows glow at night.
     * opts: {material:'stone'|'brick'|'render'|'concrete'|'glass', windows:'sash'|'tudor'|'gothic'|'door'|'shop'|'none', tint}
     * material.userData = {bay, storey} metres -> use world.extrude(poly, y0, y1, {uScale: bay, vScale: storey}).
     */
    facadeMaterial({ material = 'stone', windows = 'sash', tint = null } = {}) {
      const kinds = { stone: { sash: 'stoneSash', tudor: 'stoneTudor', gothic: 'stoneGothic', door: 'stoneDoor', none: 'stoneBlank' }, brick: { sash: 'brickSash', door: 'brickDoor', none: 'brickBlank' }, render: { sash: 'renderSash', door: 'renderDoor', shop: 'shopfront', none: 'renderBlank' }, concrete: { sash: 'concreteBand', none: 'concreteBlank' }, glass: { sash: 'glass', none: 'glass' } };
      const kind = (kinds[material] || kinds.stone)[windows] || (kinds[material] || kinds.stone).sash;
      const t = T.facadeTexture(kind), st = WALL_STYLES[material === 'stone' && windows === 'tudor' ? 'college' : material === 'stone' && windows === 'gothic' ? 'gothic' : material] || WALL_STYLES.stone;
      const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffb870, emissiveIntensity: 0, roughness: 0.85, color: tint ?? 0xffffff });
      m.userData = { bay: st.bay, storey: st.single ? 9 : st.storey };
      registerNight(m, 0.9, 0);
      return m;
    },
    landmarks: LANDMARKS,
    /**
     * The city's atlas shader for hand-built geometry (see materials.js atlasMaterial): one draw for many surfaces.
     * Geometry needs uv in cell repeats, aCell (vec4: cell, cell, 0, seed), aTint (vec3 linear), aTop (float, with ao).
     */
    // (memory pass, `?kitc=1`, OFF until its pictures have been compared: a kit's atlas — the Radcliffe, batch-4, batch-5
    //  and Worcester sheets, 21-53 MB each on the card as RGBA8 with mipmaps — block-compressed like the city's own
    //  facade atlas, an eighth of that; the result keeps the sheet's painter for kits that copy cells out of it)
    atlasMaterial: (opts) => atlasMaterial(KITC && T.HI.on && T.HI.dxt && opts && opts.map && opts.map.isCanvasTexture ? { ...opts, map: keepPainter(compressCanvasTexture(opts.map, 'dxt1', T.HI.dxt, (opts.name || 'kit') + ' (compressed)'), opts.map) } : opts),
    /** texture pass (world/_surf_detail.js): crisp(canvas, opts) -> a sharp sign / notice texture; hiScale() = how much larger to paint it on
     *  this tier; surfDetail(material, layer) = scanned grain on a plain material; sharpenTextures(root) = fix filtering under a scene */
    /** texture pass 2: sharpened presentation for a room's frame (world/_surf_present.js; not installed here) */
    roomPresent: createRoomPresent(game),
    texCache: TEXC,
    surf: { crisp: crispCanvasTexture, hiScale, detail: addSurfDetail, autoDetail, sharpenTextures, kit: kitSurf, state: SURF,
      /** A/B (tools/surf_shots.mjs): the per-pixel work and the sharpening on / off without a reload */
      set: (on) => { setSurfaces(!!on); setSharpen(!!on && SURF.wanted && !!game.postRender); } },

    // geometry helpers (all UVs in metres unless stated)
    rng: makeRng, hash: hash01, util,
    extrude(poly, y0, y1, opts = {}) {
      const b = new GeoBuf(), s = opts.uvScale || 1, su = opts.uScale || s, sv = opts.vScale || s, rings = [poly, ...(opts.holes || [])];
      rings.forEach((ring, ri) => {
        const A = signedArea(ring), sg = (ri === 0 ? 1 : -1) * (A > 0 ? 1 : -1); let u = 0;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], c = ring[(i + 1) % ring.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]); if (l < 1e-4) continue;
          const nx = ((c[1] - a[1]) / l) * sg, nz = (-(c[0] - a[0]) / l) * sg, fl = (c[0] - a[0]) * nz - (c[1] - a[1]) * nx < 0;
          wallQuad(b, a[0], a[1], c[0], c[1], y0, y1, nx, nz, (fl ? u + l : u) / su, (fl ? u : u + l) / su, (y0 - (opts.vOrigin ?? y0)) / sv, (y1 - (opts.vOrigin ?? y0)) / sv); u += l;
        }
      });
      if (opts.top !== false) flatPoly(b, poly, opts.holes, y1, s);
      if (opts.bottom) flatPoly(b, poly, opts.holes, y0, s, true);
      return b.toGeometry();
    },
    flat(poly, y = 0, holes = [], opts = {}) { const b = new GeoBuf(); flatPoly(b, poly, holes, y, opts.uvScale || 1, !!opts.down); return b.toGeometry(); },
    ribbon(pts, width, y = 0, opts = {}) { const b = new GeoBuf(); flatRibbon(b, pts, width / 2, -width / 2, y, opts.uvScale || 1, opts.mode || 'world'); return b.toGeometry(); },
    wallAlong(pts, height, thickness = 0.4, opts = {}) { const b = new GeoBuf(); thickWall(b, pts, opts.y0 || 0, (opts.y0 || 0) + height, thickness, { uScale: opts.uvScale || 1, vScale: opts.uvScale || 1, offset: opts.offset || 0 }); return b.toGeometry(); },
    /**
     * A building in exactly the city's style (facade atlas, lit windows at night, roofs, parapets).
     * spec: {poly, holes?, h, minH?, style?:{wall, roof, color}, roof?:'gabled'|'hipped'|'flat'|'pyramidal'|'dome'|'cone', shop?:bool, id?, tags?}
     * -> THREE.Group (static) already added to game.worldScene unless spec.add === false.
     */
    makeBuilding(spec) {
      const id = spec.id || 'custom' + Math.floor(Math.random() * 1e9);
      const c = util.polyCentroid(spec.poly);
      const b = { id, poly: spec.poly, holes: spec.holes, h: spec.h || 10, minH: spec.minH || 0, c, tags: { building: 'yes', ...(spec.tags || {}), ...(spec.roof ? { 'roof:shape': spec.roof } : {}) }, roofH: spec.roofH };
      // (detail: the emitter flags what belongs only to the city's FAR tiles — one plain quad per wall, a blank wall up
      //  to the far roof line. A building made here has no far tile: those quads used to be drawn with the near walls,
      //  in the same plane with the same seed, and the two fought over every such wall — 430 m2 of the Music Faculty,
      //  280 m2 of the Randolph, 360 m2 of Worcester's street range. They are left out now.)
      const buf = new GeoBuf({ cell: true, tint: true, top: true, detail: true }), cren = new GeoBuf({ color: true }), out = { facade: buf, roof: buf, parapet: buf, crenel: cren };
      emitBuilding(apiCtx(id, spec.style || { wall: 'stone' }), b, out, { shop: !!spec.shop, street: spec.street || '' });
      const g = new THREE.Group(); g.name = 'building:' + id;
      if (!buf.empty) { const m = new THREE.Mesh((buf.det.includes(2) && mergeBufs([buf], { exclude: 2 })) || buf.toGeometry(), M.facade); m.castShadow = true; m.receiveShadow = true; g.add(m); }
      if (!cren.empty) { const m = new THREE.Mesh(cren.toGeometry(), M.parapet); m.castShadow = true; m.receiveShadow = true; g.add(m); }
      makeStatic(g);
      if (spec.add !== false) scene.add(g);
      return g;
    },
    /** Lamp glass + ground light pool + candidate for the pooled point lights, glowing at night. y = height of the glow. */
    // (its pool of light lies on the FLOOR UNDER THE LAMP - world.groundHeight there, a place's own levels included: a
    //  sunk court, a raised terrace - not at the street's 0.17 m, where it hung 1.4 m over Worcester's Pump Quad and cut
    //  a bright line across its walls and people. The floor is asked for at the next frame, not here: a place adds its
    //  lamps while it builds and gives the world its levels after)
    addLampGlow(x, y, z) { const i = furn.addLamp(x, z, y - LAMP_HEAD_Y, false); glowPools.push([i, x, z, y]); glowSettle = true; furn.refresh((game.eye || game.camera.position).x, (game.eye || game.camera.position).z, true); },
    /** Full Victorian street lamp standing at (x, z). */
    addLamp(x, z) { furn.addLamp(x, z, 0, true); furn.refresh((game.eye || game.camera.position).x, (game.eye || game.camera.position).z, true); },
    /** Clone a material with the polygon offset of a ground layer ('area0'..'markings') so it sits correctly on the ground. */
    layerMaterial(material, layer = 'area2') {
      const k = { base: 0, area0: 1, area1: 2, area2: 3, water: 4, road: 5, road2: 6, path: 7, marking: 9, markings: 9 }[layer] ?? 3;
      const m = material.clone(); if (k) addDepthBias(m, k, 'lm'); return m;   // same view-ray depth bias as the city ground
    },
    /**
     * Remove generated/map trees, street furniture and lamps inside polygon `poly` (e.g. a place module rebuilding a
     * quad by hand). opts: {trees=true, furniture=true, lamps=true}. Returns number of items removed.
     */
    clearArea(poly, opts = {}) {
      const bb = polyBounds(poly), inside = (x, z) => x >= bb.minX && x <= bb.maxX && z >= bb.minZ && z <= bb.maxZ && pointInPoly(x, z, poly);
      let n = 0;
      if (opts.trees !== false) for (const s of veg.sets) n += s.removeWhere(inside);
      // the trunk colliders of the mapped trees removed here go too (core/mapcollision.js adds one per map tree)
      if (opts.trees !== false && game.worldCollider && game.worldCollider._near) {
        const mk = mapTreeKeys || (mapTreeKeys = new Set(map.trees.map((t) => Math.round(t[0] * 100) + ',' + Math.round(t[1] * 100))));
        game.worldCollider._near(bb.minX, bb.minZ, bb.maxX, bb.maxZ, (s) => { if (!s.seg && s.tag === 'tree' && inside(s.x, s.z) && mk.has(Math.round(s.x * 100) + ',' + Math.round(s.z * 100))) s.on = false; });
      }
      for (const [k, s] of Object.entries(furn.sets)) {
        const lamp = k === 'lampPost' || k === 'lampHead' || k === 'pool';
        if (lamp ? opts.lamps === false : opts.furniture === false) continue;
        n += s.removeWhere(inside);
      }
      if (opts.lamps !== false) { const L = ctx.lampPositions; for (let i = 0; i < L.length; i += 3) if (inside(L[i], L[i + 2])) { L[i] = 1e9; L[i + 2] = 1e9; } }
      if (opts.furniture !== false) for (let i = ctx.bikeStands.length - 1; i >= 0; i--) if (inside(ctx.bikeStands[i].x, ctx.bikeStands[i].z)) ctx.bikeStands.splice(i, 1);
      const c = (game.eye || game.camera.position); veg.refresh(c.x, c.z, true); furn.refresh(c.x, c.z, true);
      return n;
    },
    /** Add a mesh/group to the world scene as static geometry (matrixAutoUpdate off). */
    addStatic(obj) { scene.add(obj); return makeStatic(obj); },
    /**
     * Blob shadow under a moving object (character group, vehicle root) while it is beyond the sun's shadow-map range.
     * radius in metres; opts.stretch = length/width along the object's facing. -> {remove()}. One instanced draw for all.
     */
    blobShadow(obj, radius = 0.45, opts = {}) { return blobs.add(obj, radius, opts); },
    blobs, post, tufts, lightmap, skylight, contact, grassFx, fxGrass: (on) => grassFx.set(on), waterFx, fxWater: (on) => waterFx.set(on), treeFx, fxTrees: (on) => treeFx.set(on),
    /** Pass 6: what the dynamic facade depth is doing around the camera -> {tiles, budget, extra, recessed, banded, wanted} (triangles / street-front units). */
    depthStats() {
      const o = { pool: 0, extra: 0, recessed: 0, banded: 0, flatInRange: 0, pooledTiles: 0, open: 0, site: '' }, c = (game.eye || game.camera.position), R2 = batch.dynR[1];
      batch.refreshDyn(c.x, c.z, true); o.site = batch.dynSite || '';
      for (const t of batch.dynTiles) {
        if (!t.mesh.visible) continue;
        for (const b of t.dyn.buckets) { if ((b.lv ? 0 : Math.hypot(b.x - c.x, b.z - c.z)) >= R2 || (b.site && b.site !== batch.dynSite)) continue; if (b.lv === 2) o.recessed++; else if (b.lv === 1) o.banded++; else o.flatInRange++; if (b.lv && b.site) o.open++; if (b.lv) o.extra += (b.geo.idx.length - (b.lv === 2 ? b.v0.length : 0)) / 3; }
      }
      o.pool = batch.dynState ? Math.round(batch.dynState.pool) : 0; o.openPool = batch.dynState ? Math.round(batch.dynState.open || 0) : 0; o.pooledTiles = batch.dynState ? batch.dynState.pooled : 0;
      return o;
    },

    /**
     * Aerial mode for flying (systems/gliding.js): on = the camera height counts in the tile culls, near-ground detail
     * is shed and the far city / far trees / East Oxford are drawn further out (see applyAerial above); off = back to
     * the effective tier exactly. Never on unless something calls this.
     */
    setAerial(on) {
      on = !!on;
      if (on === !!aerial) return;
      if (on) { aerial = {}; aerialNear = null; applyAerial((game.eye || game.camera.position).y); gateOn(true); }
      else { gateOn(false); HAZE.fog[0] = 0; aerial = null; aerialNear = null; batch.eastK = 0; batch.shadowAt = null; sky.setAir(null); if (airMats) swapAir(false); if (game.quality) applyQuality(game.quality.tier); }
    },
    get aerial() { return !!aerial; },
    /** true once warmAerial()'s background walk has pre-compiled every object in the scene (tests / probes) */
    get aerialWarmed() { return airWalked; },
    /** CPU time of the aerial warm-up's steps: {steps, ms, worst: [{what, ms}]} (each step should stay a few ms) */
    get warmStats() { return { steps: warmLog.steps, ms: Math.round(warmLog.ms), worst: warmLog.worst.slice() }; },
    /** (systems that warm their own things record their steps here too) */
    warmStat: (what, ms) => wstat(what, ms),
    /** Get the aerial material variants compiled before they are needed (call when a flight looks likely) -> Promise. */
    warmAerial: () => warmAerial(),
    /** Compile an object's materials for the outdoor scene ahead of adding it (no stalled frame where the driver compiles in parallel) -> Promise. */
    compileAsync: (obj) => compileAsync(obj),
    /** compileAsync, then draw each never-drawn material once out of sight (the GPU pipeline too: Metal builds it at first draw) -> Promise | null */
    prepare: (obj) => prepare(obj),
    /**
     * The loading screen's warm draws (game.warmups, world/prewarm.js): obj is queued, not compiled yet; warmLoad() then
     * compiles and first-draws the queue one object at a time, highest opts.prio first, pumped in the start room too,
     * until its time budget is spent — what is left is dropped (resolved false) and is met in play as it always was: a
     * cold first draw costs 50–450 ms on a Radeon Pro 460, so the loading screen cannot afford everything.
     * opts: {prio, fresh (only never-drawn materials), upload: [geometries] (instead of obj: their buffers go up)} -> Promise<bool>
     */
    warmDraw: (obj, opts = {}) => { if (!game.renderer || !game.renderer.compileAsync) return null; return new Promise((res) => { loadQ.push({ obj, opts, res, prio: opts.prio || 0, seq: loadSeq++ }); }); },
    warmLoad: (budget, opts) => warmLoad(budget, opts),
    /** the loading screen's leftovers being worked through behind the game: { left, done, ms, worst (ms of it in one tick) } */
    get warmRest() { return { ...restSt, busy: restBusy > 0 }; },
    /** run the streaming culls (city tiles, trees, furniture, grass tufts) for a camera at (x, z) now: world/prewarm.js,
     *  while the player is indoors and update() leaves them idle, so the first frames outside find them already done */
    cullAt(x, z) { batch.cull(x, z, 0); veg.refresh(x, z, true); furn.refresh(x, z, true); tufts.refresh(x, z, true); },
    /** the warm-up drawer's counters {batches, drawn, skipped, uploaded, mb, waits, strays, queued} */
    get warmDraws() { return warm.stats; },
    /** the background tile upload's counters {batches, mb, left (never-drawn tiles still to go)} */
    get tileStream() { return streamSt; },

    interiorKit: kit,
    /** [walk-in interiors] how a mapped building's walls were drawn: { edges: [{ ax, az, bx, bz, nx, nz, len, plan: { kind, bays, ground } }], sH,
     *  storeyH, minH, W (the style's cells), wallTop } or null — places/_walkin_city.js puts a room's windows on the painted ones */
    facadeOf(id) { const L = ctx.buildingPlan && ctx.buildingPlan.list; if (!L) return null; if (!ctx._facadeById) { ctx._facadeById = new Map(); for (const r of L) if (r.b && r.res) ctx._facadeById.set(r.b.id, r.res); } return ctx._facadeById.get(id) || null; },
    bikeStands: ctx.bikeStands,
    furniture: furn,        // [props] the furniture InstanceSets ({sets, refresh}): systems/props.js hides a knocked instance
    vegetation: veg,        // the tree InstanceSets ({sets}: per species near sets + 'trees:far' holding every tree; read by tools/audit_placement.mjs)
    lampPositions: ctx.lampPositions,
    roadGrid: ctx.roadGrid, buildingGrid: ctx.buildingGrid,
    barrierPlan: ctx.barrierPlan,   // [birds] the walls and hedges as drawn ({style, kind, pieces: [{seg, h, low}]}): systems/_birds_place.js perches on their tops
    /** [flora] is the base ground (where no landuse is mapped) drawn as grass at (x, z)? systems/flora.js */
    baseGreen: (x, z) => !!(ctx.baseGreen && ctx.baseGreen(x, z)),
    zoneAt,
    stats: null,
  };

  // ---------------------------------------------------------------- quality tiers (game.quality, see quality.js)
  const R = game.renderer;
  const applyQuality = (t) => {
    if (R && R.setPixelRatio && typeof devicePixelRatio !== 'undefined') {
      const pr = capRatio(Math.min(devicePixelRatio || 1, t.pixelRatio));
      if (Math.abs(R.getPixelRatio() - pr) > 1e-3) { R.setPixelRatio(pr); if (game.resize) game.resize(); }
    }
    sky.setQuality(t);
    batch.shadowDist = t.shadowDist;
    if (t.relief) batch.dynR = t.relief;   // pass 6: radii (m) of the recessed / banded street fronts
    // (top tier: a new street-front depth pool goes up to the card a few MB a frame BEFORE its tile is switched to it —
    //  util.js refreshDyn; null = switched at once and uploaded whole at its first draw, as on the other tiers)
    batch.dynUpload = (g) => (dynUpOff || !topTier() || !game.renderer || !game.renderer.compileAsync || game.scene !== game.worldScene ? null : warm.upload([g], { split: !splitOff, first: true }));
    for (const f of batch.far) { f.cull = f.east ? Math.min(t.farCull, f.east) : t.farCull; f.near = t.cityNear; }
    veg.setNear(t.treeNear); veg.setFar(t.treeFar);
    furn.setQuality(t);
    setAtlasFeature(M.facade, 'USE_LBUMP', t.bump || 0); setAtlasFeature(M.ground, 'USE_LBUMP', t.bump ? t.bump * 0.6 : 0); setAtlasFeature(M.ground, 'USE_WET', !!t.wet);
    batch.layerOff.aoStrip = !t.aoStrips;
    batch.layerOff.waterEdge = !t.aoStrips;
    blobs.enabled = t.blobs !== false; blobs.inner = t.shadowBox * 0.9;
    tufts.set(!!t.tufts); tufts.refresh((game.eye || game.camera.position).x, (game.eye || game.camera.position).z, true);
    try { post.set(!!t.post && !(R && R.capabilities && !R.capabilities.isWebGL2), { refl: !!t.refl, ao: !!t.ssao, rays: !!t.rays, glare: !!t.glare, adapt: !!t.adapt, sun4: t.name === 'ultra', onePass: t.name === 'ultra' }); } catch (e) { console.warn('[world] post', e); post.set(false); }
    lightmap.setEnabled(!!t.dynLight && !(R && R.capabilities && !R.capabilities.isWebGL2));
    skylight.setEnabled(!!t.skyl && !!t.post);
    contact.enabled = !!t.contact;
    setSurfaces(t.surfaces === 'hi'); setSharpen(t.surfaces === 'hi' && SURF.wanted && !!t.post);   // texture pass (top tier)
    if (R && R.setOpaqueSort) R.setOpaqueSort(t.name === 'ultra' && PX_ORDER.on ? opaqueOrder : null);      // pixel-cost pass: buildings first, the ground last (world/_px_order.js)
    grassFx.set(!!t.grassFx);
    waterFx.set(!!t.waterFx);
    treeFx.set(!!t.treeFx);
    const c = (game.eye || game.camera.position);
    if (aerial) { aerialNear = null; applyAerial(c.y); }     // a tier / rung change while flying: re-derive the aerial values
    veg.refresh(c.x, c.z, true); furn.refresh(c.x, c.z, true); batch.cull(c.x, c.z, aerial ? Math.max(0, c.y) : 0);
  };
  // texture pass (top tier): textures made by other modules with the default filtering (anisotropy 1-4) get the GPU's
  // maximum — the outdoor scene on the loading screen (game.warmups) and again whenever a place is entered, each room
  // the first time it is entered
  if (SURF.wanted) {
    const sweep = (sc) => { try { if (sc) sharpenTextures(sc); } catch (e) { /* */ } };
    (game.warmups || (game.warmups = [])).push({ id: 'surf:filter', fn: () => { sweep(scene); } });
    const sp = game.setPlace;
    if (typeof sp === 'function') game.setPlace = function (id, sc, ...rest) { sweep(sc); return sp.call(this, id, sc, ...rest); };
    // rooms: scanned grain on their big plain walls, ceilings and floors, right after the room's module has built it
    // (before its first frame: nothing is compiled twice); rooms already built by now are done here
    const I = game.interiors;
    if (SURF.on && I && typeof I._buildA === 'function') {
      const room = (d) => { try { if (d && d.scene && !d._surfDone) { d._surfDone = true; autoDetail(d.scene); sharpenTextures(d.scene); } } catch (e) { console.warn('[surf] room', d && d.id, e); } };
      const bA = I._buildA;
      I._buildA = function (d) { const r = bA.call(this, d); room(d); return r; };
      if (I.defs) for (const d of I.defs.values()) if (d.built || d._bs) room(d);
    }
  }
  game.quality = createQuality(game, applyQuality);
  world.quality = game.quality;
  world.tiers = TIERS;

  // initial fill so the first frame is complete
  const cp = game.player ? game.player.pos : (game.eye || game.camera.position);
  veg.refresh(cp.x, cp.z, true); furn.refresh(cp.x, cp.z, true); batch.cull(cp.x, cp.z);
  sky.update(0); updateNight(sky.state.night);

  // start-up (pass 4): on a visit that painted, the finished textures are written to the cache by now or within a
  // moment — wait for that here, on the loading screen, so nothing large is still being written when the game runs
  { const tS = performance.now(), nS = await texCacheSettle(); if (nS) { timings.texStore = Math.round(performance.now() - tS); console.log(`[texcache] ${nS < 0 ? 'stores still running after 6 s (left to finish)' : nS + ' stores finished'}; waited ${timings.texStore} ms; stored [${TEXC.stored.join(', ')}]${TEXC.failed.length ? '; failed [' + TEXC.failed.join(' | ') + ']' : ''}`); } }
  const ms = Math.round(performance.now() - t0);
  let instTris = 0, instCount = 0;
  scene.traverse((o) => { if (o.isInstancedMesh) { instCount++; const g = o.geometry; instTris += (g.index ? g.index.count : g.attributes.position.count) / 3 * o.count; } });
  world.stats = { buildMs: ms, timings, tiles: batch.meshes.length, staticTris: Math.round(batch.tris), trisBy: batch.trisBy, instancedMeshes: instCount, instancedTrisNear: Math.round(instTris), ...ctx.stats };
  console.log(`[world] built Oxford in ${ms} ms`, timings, `| ${batch.meshes.length} static tile meshes, ${(batch.tris / 1e3).toFixed(0)}k static tris, ${instCount} instanced meshes (${(instTris / 1e3).toFixed(0)}k tris near spawn), ${ctx.stats.trees} trees, ${ctx.stats.lamps} lamps, ${ctx.stats.signs} signs`);
  return world;
}
