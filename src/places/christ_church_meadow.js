// Christ Church Meadow, c. 2013 — see docs/research/christ_church_meadow.md for what is known and what is guessed.
//
//   preMap   (_ccm_map.js) the two grazed fields as rough pasture inside iron estate railings with three closed field
//            gates; the board fences round the Memorial Garden, Merton Field and Poplar Walk as low railings; Broad
//            Walk and New Walk widened and gravelled; the avenue trees given the right species; Jubilee Bridge (2014)
//            left out; benches along Broad Walk; the Meadow Building restyled as Venetian Gothic.
//   install  the scattered park trees cleared from the open fields (mapped trees and the wood kept); gate leaves,
//            colliders and a "climb over" at each field gate (nobody can be shut in a field); notice boards; reeds on
//            the meadow banks (_ccm_dress.js); the English Longhorn herd (_ccm_herd.js behaviour on the shared clock,
//            _ccm_cattle.js one instanced draw), drawn and updated only within ~330 m.
// The river banks are NOT fenced: from the river walk and the Cherwell walk the water is open to step into and out of.
// Walkers, joggers, dog walkers and tourists come from systems/pedestrians.js (the meadow is a park + tourist zone and
// the Isis a river zone).
//
// Test hooks: game.ccMeadow = { stats(), herd, cows(tMs), fields, gates, dress }     tools/smoke_ccm.mjs
import { preMapMeadow, pointInPoly, distToPoly } from './_ccm_map.js';
import { makeHerd, cowState, hourOf } from './_ccm_herd.js';
import { createCattleMesh } from './_ccm_cattle.js';
import { buildDressing } from './_ccm_dress.js';
import { createLongGrass } from './_ccm_grass.js';
import { eightPath, eightAt, createEight } from './_ccm_eight.js';

// the whole herd in the big (south) field: the two fields are grazed in turn (a guess); it also keeps the cattle out of
// the Broad Walk budget view, whose camera looks over the north field
export const HERD = { south: 13, north: 0 };
// drawn within these distances (m) of the herd's own bounding box / of the nearest reed bank / of a field
const CATTLE_NEAR = 160, CATTLE_OUT = 175, REEDS_NEAR = 130, GRASS_NEAR = 12, EIGHT_NEAR = 220;

/** a polygon whose even-odd interior is `poly` minus `holes`, joined by zero-width bridges (for world.clearArea) */
export function bridged(poly, holes) {
  const P = poly.slice();
  for (const H of holes) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - H[0][0], P[i][1] - H[0][1]); if (d < bd) { bd = d; bi = i; } }
    P.splice(bi + 1, 0, ...H, H[0], P[bi]);
  }
  return P;
}

export default {
  id: 'christ_church_meadow',
  preMap(game) { try { preMapMeadow(game); } catch (e) { console.error('[christ_church_meadow] preMap', e); } },

  install(game) {
    const W = game.world, scene = game.worldScene, map = game.map;
    // the fields as drawn (preMap pushed them as areas)
    const north = map.areas.find((a) => a.id === 'ccm-field-north'), south = map.areas.find((a) => a.id === 'ccm-field-south');
    const fields = north && south ? { north: north.poly, south: south.poly, wood: north.holes && north.holes[0] } : null;
    const S = { cleared: 0, cattleOn: false, reedsOn: true, err: false, t: 0 };

    // ---- open fields: clear the world's scattered trees, keep the mapped ones and the wood
    if (fields) {
      for (const poly of [fields.north, fields.south]) {
        const keep = [];
        for (const t of map.trees) if (pointInPoly(t[0], t[1], poly)) { const r = 0.7; keep.push([[t[0] - r, t[1] - r], [t[0] + r, t[1] - r], [t[0] + r, t[1] + r], [t[0] - r, t[1] + r]]); }
        if (poly === fields.north && fields.wood) keep.push(fields.wood);
        try { S.cleared += W.clearArea(bridged(poly, keep), { trees: true, furniture: false, lamps: false }); } catch (e) { console.warn('[christ_church_meadow] clear', e); }
      }
    }

    // ---- no street lamps out on the meadow (it is locked at dusk): the world puts generated lamps along long footways
    { const park = map.areas.find((a) => a.id === 'r1102976'); if (park) { try { S.lamps = W.clearArea(park.poly, { trees: false, furniture: false, lamps: true }); } catch { /* optional */ } } }
    // ---- gates, boards, reeds
    let dress = null;
    try { dress = buildDressing(game, fields); } catch (e) { console.error('[christ_church_meadow] dressing', e); }

    // ---- the herd
    let herd = null, cattle = null;
    const st = {};
    if (fields) {
      herd = makeHerd([{ poly: fields.south, n: HERD.south }, { poly: fields.north, holes: fields.wood ? [fields.wood] : [], n: HERD.north }].filter((f) => f.n > 0));
      try {
        cattle = createCattleMesh(herd.cows.length);
        herd.cows.forEach((c, i) => cattle.setCoat(i, Math.floor(c.seed * 997) % 5, c.seed, 0.95 + 0.1 * ((c.seed * 31) % 1)));
        scene.add(cattle.mesh);
      } catch (e) { console.error('[christ_church_meadow] cattle', e); cattle = null; }
    }
    // ---- long grass in the fields near the camera (medium: 1,200 cards within 22 m; high: 2,600 within 30 m; none on low)
    const GRASS = { medium: { max: 1200, radius: 22 }, high: { max: 2600, radius: 30 }, ultra: { max: 2600, radius: 30 } };
    const level = () => (game.quality && game.quality.level) || 'medium';
    let grass = null;
    if (fields && GRASS[level()]) {
      try { grass = createLongGrass([fields.north, fields.south], fields.wood ? [fields.wood] : [], GRASS[level()]); scene.add(grass.mesh); } catch (e) { console.warn('[christ_church_meadow] grass', e); grass = null; }
    }
    // ---- a rowing eight on the Isis
    let eight = null; const P8 = eightPath(map), e8 = {};
    if (P8) { try { eight = createEight(); scene.add(eight.mesh); } catch (e) { console.warn('[christ_church_meadow] eight', e); eight = null; } }
    // the hour the herd lives by: the shared clock's, unless the hour is pinned (?time=…) — then that hour everywhere
    const hourAt = (ms) => (game.time && game.time.pinned != null ? game.time.pinned : hourOf(ms));
    let bb = null;
    if (fields) { bb = [Infinity, -Infinity, Infinity, -Infinity]; for (const [x, z] of fields.north.concat(fields.south)) { bb[0] = Math.min(bb[0], x); bb[1] = Math.max(bb[1], x); bb[2] = Math.min(bb[2], z); bb[3] = Math.max(bb[3], z); } }
    const distBB = (x, z) => (bb ? Math.hypot(Math.max(bb[0] - x, 0, x - bb[1]), Math.max(bb[2] - z, 0, z - bb[3])) : Infinity);

    // reed banks sampled every ~10 m, for the distance test
    const reedPts = []; if (dress && dress.banks) for (const pts of dress.banks) for (let i = 0; i < pts.length; i += 2) reedPts.push(pts[i]);
    const nearest = (P, x, z) => { let d = Infinity; for (const p of P) { const q = Math.hypot(p[0] - x, p[1] - z); if (q < d) d = q; } return d; };
    const fieldDist = (x, z) => (fields ? Math.min(...[fields.north, fields.south].map((P) => (pointInPoly(x, z, P) ? 0 : distToPoly(x, z, P)))) : Infinity);
    const hb = [0, 0, 0, 0], cS = [];
    function updateCattle() {
      const now = game.time.now();
      hb[0] = hb[2] = Infinity; hb[1] = hb[3] = -Infinity;
      cattle.uniforms.uCowTime.value = (now % 3600000) / 1000;
      // (two beasts whose walks cross are not drawn through each other: within 1.5 m each is drawn half the shortfall
      //  away from the other — one lying down is left where it lies. From the shared clock's positions, in a fixed
      //  order: the same herd for every player. As the Grove's deer: places/magdalen.js)
      const n = herd.cows.length;
      for (let i = 0; i < n; i++) { const s = cS[i] || (cS[i] = {}); cowState(herd, herd.cows[i], now, s, hourAt); s.ox = 0; s.oz = 0; }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = cS[i], b = cS[j]; let ex = a.x - b.x, ez = a.z - b.z; const d2 = ex * ex + ez * ez; if (d2 >= 2.25) continue;
        const d = Math.sqrt(d2), sh = 1.5 - d; if (d < 0.02) { ex = Math.cos(i * 2.4); ez = Math.sin(i * 2.4); } else { ex /= d; ez /= d; }
        const la = a.lie > 0.5, lb = b.lie > 0.5, ka = la ? 0 : lb ? 1 : 0.5, kb = 1 - ka;
        a.ox += ex * sh * ka; a.oz += ez * sh * ka; b.ox -= ex * sh * kb; b.oz -= ez * sh * kb;
      }
      for (let i = 0; i < n; i++) {
        const s = cS[i], x = s.x + s.ox, z = s.z + s.oz;
        cattle.set(i, x, W.groundHeight ? W.groundHeight(x, z) : 0.01, z, s.h, s.walk, s.graze, s.lie, s.phase);
        hb[0] = Math.min(hb[0], x); hb[1] = Math.max(hb[1], x); hb[2] = Math.min(hb[2], z); hb[3] = Math.max(hb[3], z);
      }
      // (a beast is solid to somebody on foot — it used to be walked straight through: they are held at its flank, a
      //  body 1.4 m long and 0.84 m across, and slide round it)
      { const pl = game.player, p = pl.pos;
        if (pl.place === 'world' && !pl.vehicle && p.x > hb[0] - 2 && p.x < hb[1] + 2 && p.z > hb[2] - 2 && p.z < hb[3] + 2 && p.y - (W.groundHeight ? W.groundHeight(p.x, p.z) : 0) < 1.0) for (let i = 0; i < n; i++) {
          const s = cS[i], cx = s.x + s.ox, cz = s.z + s.oz; if (Math.abs(p.x - cx) > 1.9 || Math.abs(p.z - cz) > 1.9) continue;
          const fx = Math.sin(s.h), fz = Math.cos(s.h); let u = (p.x - cx) * fx + (p.z - cz) * fz; u = u < -0.7 ? -0.7 : u > 0.7 ? 0.7 : u;
          const ex = p.x - cx - fx * u, ez = p.z - cz - fz * u, d = Math.hypot(ex, ez), R = 0.74;
          if (d < R && d > 1e-4) { p.x += (ex / d) * (R - d); p.z += (ez / d) * (R - d); if (game.collider && game.collider.resolve) game.collider.resolve(p, 0.32); }
        } }
      cattle.commit();
    }
    function tick(dt) {
      const pl = game.player, outdoors = pl.place === 'world', cam = game.camera.position;
      const d = outdoors ? distBB(cam.x, cam.z) : Infinity;
      if (cattle) {
        // where the herd is is known whenever the camera is anywhere near the meadow (13 cows: cheap); it is drawn only
        // within CATTLE_NEAR of the herd itself, every frame when close, at 4 Hz further off
        if (d < 400) {
          const dh = Math.hypot(Math.max(hb[0] - cam.x, 0, cam.x - hb[1]), Math.max(hb[2] - cam.z, 0, cam.z - hb[3]));
          S.t -= dt; if (S.t <= 0 || (S.cattleOn && dh < 90)) { S.t = 0.25; updateCattle(); }
          const want = dh < (S.cattleOn ? CATTLE_OUT : CATTLE_NEAR);
          if (want !== S.cattleOn) { S.cattleOn = want; cattle.mesh.visible = want; if (want) updateCattle(); }
        } else if (S.cattleOn) { S.cattleOn = false; cattle.mesh.visible = false; S.t = 0; }
      }
      if (grass) {
        const on = outdoors && !!GRASS[level()] && d < GRASS_NEAR && fieldDist(cam.x, cam.z) < GRASS_NEAR;
        if (on !== grass.mesh.visible) grass.mesh.visible = on;
        if (on) grass.update(cam.x, cam.z);
      }
      if (eight) {
        eightAt(P8, S.eightT ?? game.time.now(), e8);
        const on = outdoors && Math.hypot(cam.x - e8.x, cam.z - e8.z) < EIGHT_NEAR && game.time.hour > 6 && game.time.hour < 20.5;
        if (on !== eight.mesh.visible) eight.mesh.visible = on;
        if (on) { eight.mesh.position.set(e8.x, 0.02, e8.z); eight.mesh.rotation.y = e8.h; eight.uniforms.uStroke.value = e8.stroke % (Math.PI * 2000); eight.uniforms.uRow.value = e8.rowing; }
      }
      if (dress && dress.reeds) { const r = outdoors && d < 500 && nearest(reedPts, cam.x, cam.z) < REEDS_NEAR; if (r !== S.reedsOn) { S.reedsOn = r; dress.reeds.visible = r; } }
    }

    game.ccMeadow = {
      fields, herd, dress, eight: () => (P8 ? eightAt(P8, S.eightT ?? game.time.now(), {}) : null),
      /** hold the eight at shared time tMs (screenshots); null = follow the clock */
      freezeEight(tMs) { S.eightT = tMs; return this.eight(); },
      cows: (tMs = game.time.now()) => herd ? herd.cows.map((c) => ({ ...cowState(herd, c, tMs, {}, hourAt), field: c.field })) : [],
      stats() {
        let draws = 0, tris = 0;
        const count = (m) => { if (!m || !m.visible) return; draws++; const g = m.geometry; tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (m.isInstancedMesh ? m.count : 1); };
        if (cattle) count(cattle.mesh);
        if (grass) count(grass.mesh);
        if (eight) count(eight.mesh);
        if (dress) { count(dress.reeds); for (const m of dress.meshes) count(m); }
        return { cleared: S.cleared, cattleOn: S.cattleOn, cows: herd ? herd.cows.length : 0, cowTris: cattle ? cattle.tris : 0, reeds: dress ? dress.reedCount : 0, grass: grass && grass.mesh.visible ? grass.count : 0, reedsOn: S.reedsOn,
          gates: dress ? dress.gates.length : 0, draws, tris: Math.round(tris), report: map._ccmReport || null };
      },
      update: (dt) => tick(dt),
      /** a viewpoint d m from the herd of field fi (0 south, 1 north), looking at it from heading `from` (screenshots) */
      viewHerd(fi = 0, d = 12, from = 0.6) {
        const cs = this.cows().filter((c) => c.field === fi); if (!cs.length) return null;
        let x = 0, z = 0; for (const c of cs) { x += c.x / cs.length; z += c.z / cs.length; }
        return { x: x - Math.sin(from) * d, z: z - Math.cos(from) * d, h: from };
      },
    };
    tick(0);
    return {
      update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[christ_church_meadow]', e); } } },
    };
  },
};
