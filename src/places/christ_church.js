// Christ Church, c. 2013 — see docs/research/christ_church_botanic_magdalen.md §1 for what is known and what is guessed.
//
//   preMap   Tom Tower's three mapped parts (base, Wren's octagon, the dome) and Canterbury Gate are skipped: they are
//            hand-built here; Peckwater's Palladian ranges and the Library restyled (paler Clipsham, tall sashes, flat).
//   install  Tom Tower (_chch_tomtower.js), Tom Quad's raised terrace, steps, Mercury and the koi (_chch_tomquad.js),
//            Canterbury Gate; the Hall staircase, the Hall (_chch_hall.js) and the Cathedral (_chch_cathedral.js) as
//            enterable interiors; Great Tom's 101 strokes at 21:05 on the shared clock (_chch_bell.js); custodians.
//   game     visitors pay at the Meadow Gate kiosk (Tom Gate turns them round) or slip in behind the tour group; the
//            custodian chases you off Tom Quad's lawn (a small fine if he catches you on it, never a wanted level); a
//            fine for a dip in Mercury; dinner in Hall for a few pounds; at 21:05 race Great Tom to Tom Gate before
//            the 101st stroke (the gate is shut after it till 06:00 — you can always get OUT).
// Cost: the exteriors are two merged batches (≤ 6 draws each, shared world materials); the koi, the tour group and the
// custodian exist only near; interiors are built on first entry and drawn only inside.
// Test hooks: game.chch = { stats(), tom(ms), enter(id), sights, state, inside(x,z), forceHour }   tools/smoke_southeast.mjs
import { randomLook } from '../core/characters.js';
import * as THREE from 'three';
import { Batch, seMats, buildMeshes, aliasParts, distCull, localFrame, prism, pointInPoly, recess, archPts, rectPts, hh, lathe } from './_chch_kit.js';
import { build as buildTomTower, DIMS as TOM_DIMS } from './_chch_tomtower.js';
import { build as buildTomQuad, heightAt as quadHeight, onLawn, onLawnPath, lawnPaths, inQuad, QUAD, ROOM_Y, HALL_FLOOR } from './_chch_tomquad.js';
import { buildStair, buildHall, buildJoined, hallSeats, joinedGround, STAIR, HALL, JOIN } from './_chch_hall.js';
import { buildCathedral, CATH, CATHS } from './_chch_cathedral.js';
import { planWalkin, cityDoor, warmLater, inPoly, rayPoly, dressOpenings, roomCrowd, wrapPi } from './_walkin_city.js';
import { SEAMLESS } from '../core/interiors.js';
import { build as buildPeck } from './_chch_peck.js';
import { TomBell } from './_chch_bell.js';
import { lodSwap, lodScale, shadowProxy, buildFine, airKeep, AIR_FAR } from './_se_fine.js';
import { FEE, DINNER_PRICE, LAWN_FINE, MERCURY_FINE, TOM, dayOf, dowOf, visitorsOpen, hallVisitors, dinnerTime, lunchTime, evensong, cathedralOpen, gateShut, tomAt, strokesBetween, tourAt, TOUR, lawnOffence } from './_chch_logic.js';
import { eatEffects } from './_pizza_logic.js';

export const IDS = {
  tomTower: ['w146574165', 'w931973513', 'w931973512'], canterbury: 'w301894833', site: 'r15595647',
  // the Cathedral's mapped parts (aisles, nave, transepts, crossing tower; the chapels north of the choir, the east end)
  cathedral: ['w931780664', 'w931780665', 'w931780666', 'w931833424', 'w931780659', 'w931780660', 'w931833415', 'w931833423', 'w931833425'],
  hall: 'w146575301', front: ['w849367646', 'w931973511', 'w931973510'], peckwater: ['w24449069'], library: 'w24448698', meadowGate: 'w931938854',
};
export const GATES = { tom: [232.4, 530.8], canterbury: [402.6, 433.4], meadow: [382.0, 616.0] };
export const KIOSK = [381.6, 624.2];
const SPIRE = [364.9, 540.6];                 // the crossing (OSM building parts w931833424 / w931833422)          // the visitors' kiosk outside the Meadow Gate (north of Broad Walk)
export const MERCURY = [284.2, 526.8];
export const sights = [
  { id: 'chch-tom-tower', name: 'Tom Tower', x: 237.5, z: 530.5, blurb: "Wolsey's gatehouse, finished by Wren in 1681-82 with an octagonal lantern and ogee dome. Great Tom rings 101 times at 21:05 every night." },
  { id: 'chch-tom-quad', name: 'Tom Quad', x: 284, z: 527, blurb: 'The largest quad in Oxford, about 80 m square: a raised terrace round a sunken lawn. Keep off the grass.' },
  { id: 'chch-mercury', name: 'Mercury', x: MERCURY[0], z: MERCURY[1], blurb: 'The round basin of 1670 with a copy of Giambologna\'s Mercury (1928) on a Lutyens pedestal. Swimming in it is a fineable offence.' },
  { id: 'chch-hall-stair', name: 'The Hall staircase', x: 326, z: 561, blurb: 'A fan vault of 1638-40 springing from a single slender column, over Wyatt\'s stair of 1805.' },
  { id: 'chch-hall', name: 'Christ Church Hall', x: 296, z: 572, blurb: 'Wolsey\'s hall of 1529 under a hammerbeam roof, lined with portraits. Dinner is served at long tables lit by brass lamps.' },
  { id: 'chch-cathedral', name: 'Christ Church Cathedral', x: 365, z: 540, blurb: 'England\'s smallest cathedral: a late-Norman nave and a spire of about 1230, with a pendant vault over the choir.' },
  { id: 'chch-peckwater', name: 'Peckwater Quad', x: 347, z: 406, blurb: 'Dean Aldrich\'s Palladian ranges of 1706-11, faced by George Clarke\'s Library (1717-72).' },
  { id: 'chch-canterbury-gate', name: 'Canterbury Gate', x: 399.5, z: 434, blurb: 'James Wyatt\'s gateway (1770s) from Canterbury Quad to Oriel Square.' },
  { id: 'chch-great-tom', name: 'Great Tom', x: 237.5, z: 530.5, blurb: 'Six and a quarter tons, recast in 1680. 101 strokes at 21:05 — one for each of the original scholars, plus one added in 1663.' },
];
const CUSTODIAN_LINES = ['Visitors\' entrance is the Meadow Gate, I\'m afraid.', 'Mind the grass.', 'No, this isn\'t Hogwarts. Well. Bits of it.', 'Lovely day for it.'];
const TURN_AWAY = {
  tom: ['Visitors round by the Meadow Gate, please. Down St Aldate\'s, left onto the Meadow.', 'College is closed to visitors this way, I\'m afraid.', 'Ticket? No ticket, no quad.'],
  shut: ['Gate\'s shut. Great Tom\'s rung. Come back at six.', 'We\'re closed for the night. Try the morning.'],
  meadow: ['Tickets at the kiosk, please. Just there.', 'Visitor ticket first, if you don\'t mind.'],
  closed: ['We\'re closed to visitors now. Nine-thirty tomorrow.', 'Closed, I\'m afraid. Try the Meadow, it\'s free.'],
};
const CATH_TINT = [1.0, 0.97, 0.9], CATH_WALL = 0xb8ad94, RANGE_WALL = 0xb8ad94, TOWER_WALL = 0xb8ad94, DRESS = 0xcfc3a4;
const ALIAS = { stoneDark: 'stone', stonePale: 'stone', iron: 'win', shadow: 'win', whitePaint: 'stone', blackPaint: 'win', bronze: 'lead', padGreen: 'lawn', flowerPink: 'gilt' };

export default {
  id: 'christ_church',
  preMap(game) {
    try {
      const ov = game.overrides;
      for (const id of IDS.tomTower) ov.skip.add(id);
      ov.skip.add(IDS.canterbury);
      // Peckwater (Aldrich 1706-11, refaced in Clipsham 1924-30): pale ashlar, tall sashes, a flat balustraded roof
      for (const id of IDS.peckwater) if (!ov.style.has(id)) ov.style.set(id, { wall: 'stone', roof: 'flat', tint: [1.04, 1.02, 0.96], up: 'stoneSashTall', ground: 'stoneRustic', door: 'stoneDoor', storeys: 3, ivy: false });
      if (!ov.style.has(IDS.library)) ov.style.set(IDS.library, { wall: 'stone', roof: 'flat', tint: [1.04, 1.02, 0.96], up: 'stoneSashTall', ground: 'stoneRustic', door: 'stoneDoor', storeys: 2, ivy: false });
      if (!ov.heights.has(IDS.library)) ov.heights.set(IDS.library, 15.5);
      // the Hall: plain ashlar under a low lead roof — its windows, buttresses, pinnacles and battlements are hand-built (_chch_tomquad.js hallFront)
      if (!ov.style.has(IDS.hall)) ov.style.set(IDS.hall, { wall: 'college', roof: 'lead', shape: 'gabled', up: 'stoneBlank', first: 'stoneBlank', top: 'stoneBlank', ground: 'stoneBlank', door: 'stoneBlank', ivy: false });
      if (!ov.heights.has(IDS.hall)) ov.heights.set(IDS.hall, 17.5);
      // the Cathedral: plain ashlar under lead — its pointed windows are drawn by this module (install: cathedral windows),
      // the ones with the nave's aisles behind them real openings of the walk-in room
      for (const id of IDS.cathedral) if (!ov.style.has(id)) ov.style.set(id, { wall: 'college', roof: 'lead', tint: CATH_TINT, up: 'stoneBlank', first: 'stoneBlank', top: 'stoneBlank', ground: 'stoneBlank', door: 'stoneBlank', ivy: false });
      // the St Aldate's front either side of Tom Tower: two storeys of two-light Tudor windows under battlements
      for (const id of IDS.front) if (!ov.style.has(id)) ov.style.set(id, { wall: 'college', storeys: 2, up: 'stoneTudor', first: 'stoneTudor', ground: 'stoneTudor', door: 'stoneTudor', ivy: false });
    } catch (e) { console.error('[christ_church] preMap', e); }
  },

  install(game) {
    const W = game.world, W_ = W, scene = game.worldScene, map = game.map, peds = game.pedestrians, ui = game.ui;
    const mats = seMats(W), col = game.worldCollider, P = game.player;
    const S = { err: false, ticketDay: -1, lastMs: game.time.now(), offT: 0, chase: null, dipped: false, raceDay: -1, raced: false, outside: null, inside: {}, fines: 0 };
    const flags = game.state.flags || (game.state.flags = {});
    const site = (map.sites || []).find((s) => s.id === IDS.site);
    const sitePoly = site ? site.poly : null;
    const inside = (x, z) => !!sitePoly && pointInPoly(x, z, sitePoly);
    // which side of a gate is "in": Tom Gate east of the front face, Canterbury Gate west of its Doric front, the Meadow
    // Gate north of the Meadow Building's south face (the site polygon itself takes in the St Aldate's pavement)
    const tomF = localFrame(TOM_DIMS.centre, TOM_DIMS.front), cantF = localFrame([399.5, 434.0], [0.148, 0.989]);
    const insideGate = (g, x, z) => (g === 'tom' ? tomF.toL(x, z)[1] < -1.5 : g === 'canterbury' ? cantF.toL(x, z)[1] > 1.0 : z < 608);
    const now = () => game.time.now(), hour = () => game.time.hour, day = () => dayOf(now()), dow = () => dowOf(now());

    // ================================================================ exteriors: Tom Tower + Tom Quad (one batch)
    const meshes = [];
    let tower = null, quad = null;
    try { tower = buildTomTower({ world: W, mats, parent: scene, alias: ALIAS }); meshes.push(...tower.meshes); for (const c of tower.colliders) col.addCircle(c.x, c.z, c.r - 0.15); const [x1, z1, x2, z2, w] = tower.passage; col.addPassage(x1, z1, x2, z2, w); } catch (e) { console.error('[christ_church] Tom Tower', e); }
    const paths = lawnPaths(map);
    try {
      try { W.clearArea(rectLocal(QUAD), { trees: true, furniture: true, lamps: true }); } catch { /* optional */ }   // before the quad's own lamp glows
      quad = buildTomQuad({ world: W, mats, parent: scene, map, alias: ALIAS });
      meshes.push(...quad.meshes);
      for (const [x1, z1, x2, z2] of quad.colliders) col.addSegment(x1, z1, x2, z2, { tag: 'wall', low: true });
      const prev = W.groundHeight.bind(W);
      W.groundHeight = (x, z) => { if (x > 236 && x < 335 && z > 474 && z < 572) { const h = quadHeight(x, z); if (h !== null) return h; } return prev(x, z); };
    } catch (e) { console.error('[christ_church] Tom Quad', e); }
    // ================================================================ Canterbury Gate (James Wyatt): hand-built so the arch is open
    let cant = [];
    try { cant = buildCanterbury(W, mats, scene, col); meshes.push(...cant); } catch (e) { console.error('[christ_church] Canterbury Gate', e); }
    // Tom Tower is a landmark (always drawn); the quad's detail and Canterbury Gate only from near
    // (from a glider — W.aerial — both stay on out to AIR_FAR: no hole where the gate stands in for the map's building)
    const CULL = [{ meshes: quad ? quad.meshes : [], c: [284, 525], r: 230, on: true, air: AIR_FAR, W }, { meshes: cant, c: [399.5, 434], r: 260, on: true, air: AIR_FAR, W }];
    airKeep(cant);
    // ================================================================ the Cathedral's spire (c. 1230), from the air only
    // The map has the crossing tower and the spire as building parts the city doesn't draw as a spire; from a glider a
    // plain octagonal spire on the crossing (to 44 m) with corner pinnacles, ~90 triangles on the showpiece material.
    let spire = null;
    try {
      const B = new Batch(), [sx, sz] = SPIRE, y0 = 26;
      lathe(B, 'stoneGrey', sx, sz, [[4.4, y0 - 0.4], [4.4, y0 + 1.0], [4.0, y0 + 1.0], [0.18, 43.4], [0, 44]], 8, Math.PI / 8);
      for (const [ax, az] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lathe(B, 'stoneGrey', sx + ax * 4.1, sz + az * 4.1, [[0.45, y0 - 0.4], [0.45, y0 + 2.4], [0, y0 + 4.6]], 4, Math.PI / 4);
      spire = buildFine(B, W, scene, 'chch:cathedral:spire', { cast: false });
      spire.visible = false; airKeep([spire]); meshes.push(spire);
    } catch (e) { console.error('[christ_church] spire', e); }

    // ================================================================ Peckwater: the centrepieces, balustrades and the Library's giant order
    let peck = null;
    try { peck = buildPeck({ world: W, parent: scene }); meshes.push(...peck.meshes); for (const c of peck.colliders) col.addCircle(c.x, c.z, c.r); } catch (e) { console.error('[christ_church] Peckwater', e); }
    const LOD = [tower && tower.lod, quad && quad.lod].filter(Boolean).map((l) => shadowProxy(W, l)).concat(peck ? [peck.lod] : []), _fwd = new THREE.Vector3();
    // ================================================================ interiors
    const R = game.interiors;
    const npcs = { chch_hall: [], chch_cathedral: [] };
    const clearNpcs = (id) => { for (const p of npcs[id]) { try { peds && peds.remove(p); } catch { /* */ } } npcs[id].length = 0; };
    const look = (seed, o = {}) => { const { outfit, prop, ...rest } = o; return { ...randomLook(seed, { outfit, prop }), ...rest }; };
    const spawnIn = (id, x, z, lk, opts = {}) => { if (!peds) return null; try { const p = peds.spawnAt(x, z, lk, { place: id, scene: R.get(id).scene, knockable: false, ...opts }); npcs[id].push(p); return p; } catch (e) { console.warn('[christ_church] npc', e); return null; } };
    // ---- Walk-in (core/interiors.js "seamless"; places/_walkin_city.js): the Hall (with its staircase, ONE room: 'chch_hall',
    // _chch_hall.js JOIN) and the Cathedral (with the passage from Tom Quad) sit in place in their mapped buildings and
    // are entered by walking through real, heavy oak doors — shut, with a "Closed" card, outside visiting hours.
    // ?seamless=0 keeps the three old rooms (stair, hall, cathedral) on the door prompt.
    const hallRule = () => { if (S.walkinTest) { const h = hour(); return h >= 8 && h < 20; } return !!(hallVisitors(hour(), dow()) || dinnerTime(hour()) || S.force); };
    const cathRule = () => { if (S.walkinTest) { const h = hour(); return h >= 8 && h < 20; } return !!(cathedralOpen(hour(), dow()) || S.force); };
    const testHours = (open) => ({ open, get testOpen() { S.walkinTest = true; return 14; }, testShut: 3.5 });
    const airBeyond = (x, z) => !map.buildings.some((b) => b.poly && Math.abs(b.c[0] - x) + Math.abs(b.c[1] - z) < 200 && inPoly(b.poly, x, z));
    let hallPlan = null, hallX = null, cathPlan = null, cathOpen = null;
    // the two visitors' doors, each in ONE bay of its range (world/walkin_bays.js blanks the painted sash of that bay):
    // the Hall stair in Bodley's tower at the quad's south-east corner, the Cathedral in the east range
    const HALL_DOOR = [324.6, 559.4], CATH_DOOR = [325.4, 549.4];
    const dayLight = () => Math.max(0, Math.min(1, game.time.daylight ?? 1)), lampsOn = () => { const h = hour(); return h >= 6.5 && h < 23 ? 1 : 0.1; };
    if (R && SEAMLESS) {
      try {
        // the Hall: outline = the Ante-Hall (stair tower) + the link + the Great Hall, from the map (door-frame t, n -> world)
        const U = [[-13.7, 1.4], [4.7, 3.0], [12.6, 3.8], [48.9, 6.9], [47.9, 17.9], [47.5, 22.6], [44.5, 22.3], [30.6, 21.2], [14.3, 19.4], [11.3, 19.2], [9.2, 19.1], [3.3, 18.5], [2.5, 18.4], [1.3, 18.3], [-3.3, 17.9], [-9.5, 17.4], [-13.4, 17.0], [-14.2, 17.0], [-15.1, 16.9], [-15.0, 16.0], [-14.9, 15.0], [-13.8, 2.3]].map(([t, n]) => [326 - t, 559.4 + n]);
        const J = JOIN, hz = HALL.W / 2;
        const spec = { id: 'chch_hall', building: U, door: { pos: HALL_DOOR, facing: Math.PI }, wall: 0.3,
          portal: { at: [J.OX + J.doorX, -J.OZ], out: Math.PI, w: J.door.w, h: J.door.h, y: -J.TOP },
          rects: [[-HALL.L, -hz, 0, hz], [0, -J.passW / 2, J.OX, J.passW / 2], [J.OX, -J.OZ, J.OX + STAIR.W, STAIR.D - J.OZ]], center: [-HALL.L / 2, 0], mid: [-6, 0],
          route: [[J.OX + J.doorX, -J.OZ + 1.4], [J.OX + 9.5, -J.OZ + 2.0], [J.OX + 9.5, -J.OZ + 9.7], [J.OX + 1.0, -J.OZ + 9.5], [J.OX + 1.0, 0], [2.5, 0], [-2, 0]], hours: testHours(hallRule) };
        const pre = planWalkin({ map }, spec), Hh = QUAD.hall, la = pre.toLocal(Hh.a[0], Hh.a[1]), lb = pre.toLocal(Hh.b[0], Hh.b[1]);
        const EB = { x0: la[0], bw: (la[0] - lb[0]) / Hh.bays, n: Hh.bays }, windows = [], open = [[], []];
        for (const sd of [0, 1]) for (let j = 0; j < EB.n; j++) {
          const xc = EB.x0 - (j + 0.5) * EB.bw, out = sd ? 0 : Math.PI, z = sd ? hz : -hz, dz = sd ? 1 : -1;
          if (xc > -1.45 || xc < -HALL.L + 1.45) continue;
          const w0 = pre.toWorld(xc, z), h = out + pre.rot, hit = rayPoly(U, w0[0], w0[1], Math.sin(h), Math.cos(h), 4);
          if (!hit) continue;
          const far = (k) => { const q = pre.toWorld(xc, z + dz * (hit.t + k)); return airBeyond(q[0], q[1]); };
          if (!far(0.5) || !far(2.5)) continue;
          // the punch goes 3 cm in front of the front's painted glass (_chch_tomquad.js hallFront: 0.05 / 0.3 m out from the
          // line of the wall), wherever the mapped outline runs; the room's glass 45 cm behind that (a stone reveal outside, as a real window has)
          const [A, Bq] = sd ? Hh.s : [Hh.a, Hh.b], ex = Bq[0] - A[0], ez = Bq[1] - A[1], den = Math.sin(h) * ez - Math.cos(h) * ex;
          const tL = Math.abs(den) > 1e-6 ? ((A[0] - w0[0]) * ez - (A[1] - w0[1]) * ex) / den : hit.t, off = sd ? 0.3 : 0.05;
          const proud = Math.max(0.03, tL + off + 0.03 - hit.t);
          windows.push({ at: [xc, z], out, w: J.win.w, y0: J.win.y0, y1: J.win.y1, depth: +hit.t.toFixed(3), proud: +proud.toFixed(3), glassAt: +(hit.t + proud - 0.48).toFixed(3), hall: true });
          open[sd][EB.n - 1 - j] = true;
        }
        hallPlan = planWalkin(game, { ...spec, windows }); hallX = { bays: EB, open };
        hallPlan.seamless.baseY = HALL_FLOOR;                               // (the door is on the terrace: _chch_tomquad.js)
      } catch (e) { console.error('[christ_church] hall plan', e); hallPlan = null; }
      try {
        // the Cathedral: outline = the passage through the quad's east range + the mapped aisles (door-frame t, n -> world)
        // (world: the passage from the door in the east range's bay, the vestibule, the aisles)
        const U = [[327.74, 548.0], [327.74, 550.8], [342.95, 550.8], [343.1, 550.2], [360.4, 550.1], [369.4, 550.0], [376.6, 549.9], [389.7, 549.8], [389.6, 544.7], [389.5, 535.4], [388.7, 535.4], [388.6, 532.3], [371.2, 532.4], [369.2, 532.5], [369.2, 532.0], [355.9, 532.1], [342.9, 532.3], [343.0, 546.7], [338.7, 546.7], [338.7, 548.0]];
        const C = CATHS, PS = C.pass, hw = CATH.HW;
        const spec = { id: 'chch_cathedral', building: U, door: { pos: CATH_DOOR, facing: -Math.PI / 2 }, wall: 0.4,
          portal: { at: [-PS.len, PS.doorZ], out: -Math.PI / 2, w: C.door.w, h: C.door.h },
          rects: [[0, -hw, C.LEN, hw], [-PS.len, PS.doorZ - PS.hw, -PS.vest, PS.doorZ + PS.hw], [-PS.vest, PS.z - PS.hw, -PS.throat, PS.doorZ + PS.hw], [-PS.throat, PS.z - PS.hw, 0, PS.z + PS.hw]],
          center: [14, 3], mid: [10, 6.2], route: [[-PS.vest - 1, PS.doorZ], [-2.2, PS.z + 0.2], [3, 6.3]], hours: testHours(cathRule) };
        const pre = planWalkin({ map }, spec), windows = []; cathOpen = [];
        const nb = Math.round(C.LEN / CATH.bay);
        for (const side of [-1, 1]) for (let i = 0; i < nb; i++) {
          const x = side < 0 ? (i + 0.5) * CATH.bay : C.LEN - (i + 0.5) * CATH.bay, z = side * hw, out = side < 0 ? Math.PI : 0;      // (as _chch_cathedral.js lays the two walls out)
          if (side > 0 && x < 3) continue;                                  // (the passage comes in beside the first south bay)
          const w0 = pre.toWorld(x, z), h = out + pre.rot, hit = rayPoly(U, w0[0], w0[1], Math.sin(h), Math.cos(h), 1.6);
          if (!hit) continue;
          let ok = true; for (const k of [0.5, 2.5]) for (const lat of [-0.9, 0, 0.9]) { const q = pre.toWorld(x + lat, z + side * (hit.t + k)); if (!airBeyond(q[0], q[1])) ok = false; }
          if (!ok) continue;
          windows.push({ at: [x, z], out, w: C.win.w, y0: C.win.y0, y1: C.win.y1, depth: +hit.t.toFixed(3) }); cathOpen.push({ side, x });
        }
        cathPlan = planWalkin(game, { ...spec, windows }); cathPlan.seamless.baseY = ROOM_Y;
      } catch (e) { console.error('[christ_church] cathedral plan', e); cathPlan = null; }
    }
    const walkHall = !!(hallPlan && hallPlan.fit.ok), walkCath = !!(cathPlan && cathPlan.fit.ok);
    const dinnerSeat = () => game.interact.add({ place: 'chch_hall', pos: [-4.5, 0.15], radius: 1.6, label: () => `Sit down to dinner (£${DINNER_PRICE})`, enabled: () => dinnerTime(hour()) || S.force === 'dinner', onUse: () => dinner() });
    if (R && walkHall) {
      R.register({
        id: 'chch_hall', name: 'Christ Church Hall', background: 0x120e0a, ambient: 0.32,
        doors: [{ pos: HALL_DOOR, facing: Math.PI, label: 'Go up to the Hall (staircase)', locked: () => (hallRule() ? false : lunchTime(hour()) ? 'The Hall is closed to visitors over lunch (12-2). The custodian taps his watch.' : 'The Hall is closed to visitors now.') }],
        seamless: hallPlan.seamless,
        build(ctx) {
          const r = buildJoined(ctx, game, hallPlan, hallX);
          S.hallDoor = cityDoor(ctx, hallPlan, { style: 'oak', heavy: true, open: hallRule });
          S.hallGlass = r.setLight;
          dinnerSeat();
          return r;
        },
        onEnter() { populateHall(); },
        onExit() { clearNpcs('chch_hall'); },
        update(dt) { hallTick(dt); }, updateShown(dt) { hallTick(dt); },
      });
      warmLater(game, 'chch_hall');
      try { dressHall(); } catch (e) { console.error('[christ_church] hall dressing', e); }
    }
    if (R && walkCath) {
      R.register({
        id: 'chch_cathedral', name: 'Christ Church Cathedral', background: 0x14120f, ambient: 0.5,
        doors: [{ pos: CATH_DOOR, facing: -Math.PI / 2, label: 'Enter the Cathedral', locked: () => (cathRule() ? false : 'The Cathedral is closed. Evensong is at six.') }],
        seamless: cathPlan.seamless,
        build(ctx) { const r = buildCathedral(ctx, game, { sl: !!ctx.seamless, plan: cathPlan, open: cathOpen }); S.cathGlass = r.setLight; if (ctx.seamless) S.cathDoor = cityDoor(ctx, cathPlan, { style: 'oak', heavy: true, open: cathRule }); else ctx.addExit(0.8, 0, 'Out to Tom Quad'); return r; },
        onEnter() { if ((evensong(hour()) || S.force === 'evensong') && game.ui) ui.toast('Choral Evensong. The choir sings from the stalls.', 4); },
        update(dt) { cathTick(dt); }, updateShown(dt) { cathTick(dt); },
      });
      warmLater(game, 'chch_cathedral');
      try { dressCathedral(); } catch (e) { console.error('[christ_church] cathedral dressing', e); }
    }
    if (R && !walkHall) {
      R.register({
        id: 'chch_stair', name: 'Christ Church — the Hall staircase', background: 0x1a1612, ambient: 0.5,
        doors: [{ pos: [326.0, 559.4], facing: Math.PI, label: 'Go up to the Hall (staircase)', locked: () => (hallVisitors(hour(), dow()) || dinnerTime(hour()) || S.force ? false : lunchTime(hour()) ? 'The Hall is closed to visitors over lunch (12-2). The custodian taps his watch.' : 'The Hall is closed to visitors now.') }],
        build(ctx) { const r = buildStair(ctx, game); ctx.addExit(STAIR.door[0], 0.7, 'Out to Tom Quad'); return r; },
      });
      R.register({
        id: 'chch_hall', name: 'Christ Church Hall', background: 0x120e0a, ambient: 0.3,
        doors: [{ from: 'chch_stair', pos: STAIR.hallDoor, facing: 0, radius: 1.4, label: 'Into the Hall' }],
        build(ctx) {
          const r = buildHall(ctx, game);
          ctx.addExit(-0.9, 0, 'Back to the staircase');
          // a seat at dinner
          game.interact.add({ place: 'chch_hall', pos: [-4.5, 0.15], radius: 1.6, label: () => `Sit down to dinner (£${DINNER_PRICE})`, enabled: () => dinnerTime(hour()) || S.force === 'dinner', onUse: () => dinner() });
          return r;
        },
        onEnter() { populateHall(); },
        onExit() { clearNpcs('chch_hall'); },
      });
    }
    if (R && !walkCath) {
      R.register({
        id: 'chch_cathedral', name: 'Christ Church Cathedral', background: 0x14120f, ambient: 0.5,
        doors: [{ pos: [325.4, 548.1], facing: -Math.PI / 2, label: 'Enter the Cathedral', locked: () => (cathedralOpen(hour(), dow()) || S.force ? false : 'The Cathedral is closed. Evensong is at six.') }],
        build(ctx) { const r = buildCathedral(ctx, game); ctx.addExit(0.8, 0, 'Out to Tom Quad'); return r; },
        onEnter() { clearNpcs('chch_cathedral'); const d = day(); for (let k = 0; k < 4; k++) spawnIn('chch_cathedral', 8 + k * 6, 6, look(`chch-cvis-${d}-${k}`, { outfit: 'tourist' }), { wander: { radius: 3, speed: 0.6 }, lines: ['Is that the oldest spire in England?', 'Shh.'] }); },
        onExit() { clearNpcs('chch_cathedral'); },
      });
    }
    function populateHall() {
      clearNpcs('chch_hall');
      const h = hour(), seats = hallSeats(), d = day();
      if (dinnerTime(h) || S.force === 'dinner') {
        for (let i = 0; i < seats.length; i += 3) { if (hh(i, d) < 0.35) continue; const s = seats[i]; if (Math.abs(s.x + 4.5) < 1 && s.z < 0 && s.z > -1) continue; spawnIn('chch_hall', s.x, s.z, look(`chch-din-${d}-${i}`, { outfit: hh(i, 3) < 0.7 ? 'gown' : 'casual' }), { pose: 'sit', heading: s.h }); }
        for (let k = 0; k < 4; k++) spawnIn('chch_hall', HALL.highX - 0.9, -3 + k * 2, look(`chch-don-${d}-${k}`, { outfit: 'tweed' }), { pose: 'stand', heading: Math.PI / 2, lines: ['Benedictus benedicat.', 'Pass the port. Clockwise!', 'Another excellent soup.'] });
        if (!walkHall) spawnIn('chch_hall', -14, 0, look(`chch-scout-${d}`, { outfit: 'barstaff' }), { wander: { radius: 10, speed: 1.1 }, lines: ['Mind your elbows.', 'Gravy?'] });
      } else if (!walkHall && (hallVisitors(h, dow()) || S.force)) {
        for (let k = 0; k < 7; k++) spawnIn('chch_hall', -6 - hh(k, d) * 24, (hh(k, 5) - 0.5) * 9.5 * (k % 2 ? 1 : 0) + (k % 2 ? 0 : (hh(k, 9) < 0.5 ? -2.85 : 2.85)), look(`chch-hallvis-${d}-${k}`, { outfit: 'tourist', prop: k % 3 ? 'camera' : 'phone' }), { wander: { radius: 4, speed: 0.7 }, lines: ['Is this the Harry Potter hall?', 'Look at all the portraits!', 'Where does Hagrid sit?', 'Smaller than in the film.'] });
      }
    }
    // ---- the outside of the two rooms' openings (places/_walkin_city.js dressOpenings: world scene, lit like the walls)
    function dressHall() {
      const J = JOIN;
      // the door from the quad: a low pointed stone doorway, moulded, with a worn step (the bay's painted sash is blanked)
      S.hallDress = dressOpenings(game, 'chch_hall', [{ p: 0, head: J.door.head, rise: J.door.rise, wall: TOWER_WALL, surround: { w: 0.24, color: DRESS, proud: 0.09 }, frame: { w: 0.07, color: 0xa99e84 }, step: { h: 0.05, proj: 0.4, over: 0.3, color: 0xa9a294 }, fill: false }]);
      S.hallPane = doorPane('chch_hall');
    }
    /** what a doorway shows from further off than its room is drawn: a dark oak pane just in front of the shell, seen from OUTSIDE only (from inside the open door shows the quad) */
    function doorPane(id, color = 0x33241a) {
      const SL = R.get(id).sl, p = SL.portals[0], k = p.depth + (p.proud ?? 0.03) - 0.018, m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshLambertMaterial({ color, name: 'chch:door-pane' }));
      const L = new THREE.Matrix4().makeRotationY(p.out).setPosition(p.at[0] + Math.sin(p.out) * k, (p.y || 0) + p.h / 2, p.at[1] + Math.cos(p.out) * k), RM = new THREE.Matrix4();
      SL.matrix(RM); m.matrix.multiplyMatrices(RM, L); m.matrixAutoUpdate = false; m.matrixWorld.copy(m.matrix); m.matrixWorldNeedsUpdate = false; m.name = 'wc:dress:pane:' + id; m.castShadow = false; m.receiveShadow = true;
      scene.add(m); return m;
    }
    function dressCathedral() {
      const d = R.get('chch_cathedral'), SL = d.sl, C = CATHS, W = C.win, items = [];
      // the door in the east range: a pointed stone doorway under a hood; then every window of the Cathedral, the same
      // two-light pointed window in stone: the six with the aisles behind them are the room's real openings (o), the rest
      // (the chapels, transepts and east end, where the room does not reach) painted dark panes of the same design
      items.push({ p: 0, head: C.door.head, rise: C.door.rise, wall: RANGE_WALL, surround: { w: 0.26, color: DRESS, proud: 0.1 }, frame: { w: 0.07, color: 0xa99e84 }, step: { h: 0.05, proj: 0.4, over: 0.3, color: 0xa9a294 }, fill: false });
      const win = { head: 'pointed', wall: CATH_WALL, stone: DRESS, mullions: 1, mullW: 0.13, lights: true, transoms: [0.5], surround: { w: 0.15, color: DRESS, proud: 0.07 }, sill: { h: 0.12, proj: 0.12, over: 0.12, color: DRESS } };
      items.push({ o: SL.openings.map((_, i) => i), ...win, rise: W.rise, fill: 0x14181d });
      const real = SL.openings.map((o) => SL.toWorld(o.at[0] + Math.sin(o.out) * o.depth, o.at[1] + Math.cos(o.out) * o.depth));
      const fake = (wx, wz, nx, nz, w, y0, y1, o = {}) => { const l = SL.toLocal(wx, wz); items.push({ at: l, out: wrapPi(Math.atan2(nx, nz) - SL.rot), depth: 0, w, y0: y0 - ROOM_Y, y1: y1 - ROOM_Y, ...win, rise: w * 0.75, ...o }); };
      S.cathFakes = 0;
      for (const id of IDS.cathedral) {
        const F = W_.facadeOf ? W_.facadeOf(id) : null, b = map.buildings.find((q) => q.id === id); if (!F || !F.edges || !b) continue;
        const h = b.h || 10, nave = id === 'w931780665', tower = id === 'w931833424';
        for (const E of F.edges) {
          const lx = E.lx ?? E.ax, lz = E.lz ?? E.az, rx = E.rx ?? (E.bx - E.ax) / E.len, rz = E.rz ?? (E.bz - E.az) / E.len;
          if (tower) { for (const k of [-1, 1]) fake(lx + rx * (E.len / 2 + k * 1.5), lz + rz * (E.len / 2 + k * 1.5), E.nx, E.nz, 1.2, 18.2, 23.4, { mullions: 0, lights: false, transoms: [], rise: 0.9, sill: null }); S.cathFakes += 2; continue; }
          if (nave) {            // the clerestory over the aisle roofs: small round-headed lights
            if (!E.covered || E.len < 8) continue;
            const n = Math.max(1, Math.round(E.len / 4.4)); for (let i = 0; i < n; i++) { const s = (i + 0.5) * E.len / n, qx = lx + rx * s + E.nx * 0.6, qz = lz + rz * s + E.nz * 0.6; if (map.buildings.some((q) => q.id !== id && q.poly && (q.h || 0) >= 13 && !(q.minH > 0) && IDS.cathedral.includes(q.id) && inPoly(q.poly, qx, qz))) continue; fake(lx + rx * s, lz + rz * s, E.nx, E.nz, 1.0, 11.0, 13.3, { head: 'round', rise: 0.5, mullions: 0, lights: false, transoms: [], surround: { w: 0.12, color: DRESS, proud: 0.06 } }); S.cathFakes++; }
            continue;
          }
          if (E.covered || E.len < 2.8 || !E.plan || E.plan.kind === 'blank') continue;
          const n = Math.max(1, Math.round(E.len / 4.4)), tall = h >= 12, w = Math.min(tall ? 2.4 : W.w, E.len / n - 1.0); if (w < 1.0) continue;
          for (let i = 0; i < n; i++) {
            const s = (i + 0.5) * E.len / n, x = lx + rx * s, z = lz + rz * s;
            if (real.some((q) => Math.hypot(q[0] - x, q[1] - z) < 3.0)) continue;                 // (a real window of the room is there)
            if (!airBeyond(x + E.nx * 1.2, z + E.nz * 1.2)) continue;
            fake(x, z, E.nx, E.nz, w, ROOM_Y + W.y0, tall ? Math.min(h - 3.0, ROOM_Y + W.y0 + w * 3.2) : ROOM_Y + W.y1, tall && w > 2 ? { mullions: 2 } : {}); S.cathFakes++;
          }
        }
      }
      S.cathDress = dressOpenings(game, 'chch_cathedral', items);
      S.cathPane = doorPane('chch_cathedral');
    }
    // ---- the people who are there whenever the room is SHOWN (seen through its doorway from the quad): roomCrowd.
    // The Hall: the custodian at the foot of the stair and visitors on it and in the Hall by day; scouts laying the tables
    // before dinner; at dinner a scout serving and two late gowns on the stair (the diners themselves sit down when you
    // come in: populateHall). The Cathedral: a verger and visitors by day; at Evensong the choir in the stalls.
    const at = (p, y) => { if (p) p.y = y; return p; };
    const hallBand = () => { const h = hour(); return dinnerTime(h) || S.force === 'dinner' ? 'dinner' : h >= 17 && h < 18.25 ? 'laying' : hallVisitors(h, dow()) || S.force ? 'visitors' : 'shut'; };
    // (two casts a room: the people by the door — stair hall, vestibule — whenever the room is shown; the people deep inside,
    //  who cannot be seen from the quad through the coloured glass, only while you are in the room)
    const inRoom = (id) => P.place === id;
    const hallCrowd = walkHall ? roomCrowd(game, 'chch_hall', { cap: 6, signature: () => hallBand() + '|' + day(), populate(spawn) {
      const band = hallBand(), d = day(), J = JOIN, sx = (x) => x + J.OX, sz = (z) => z - J.OZ, on = (x, z, lk, o) => at(spawn(sx(x), sz(z), lk, o), joinedGround(sx(x), sz(z)));
      if (band === 'visitors') {
        on(5.3, 1.9, look('chch-custodian-stair', { outfit: 'porter', hat: 'bowler' }), { heading: Math.PI * 0.75, lines: ['Up the stairs and mind the worn step.', 'No flash on the portraits, please.', 'Yes, the stair was in the film. No, you can\'t slide down it.'] });
        on(3.4, 3.2, look(`chch-stairvis-${d}-0`, { outfit: 'tourist', prop: 'camera' }), { heading: 0.9, lines: ['Look up! The ceiling!'] });
        on(9.6, 1.5, look(`chch-stairvis-${d}-1`, { outfit: 'tourist' }), { heading: 0.2 });
        on(1.0, 7.0, look(`chch-stairvis-${d}-2`, { outfit: 'tourist', prop: 'phone' }), { heading: Math.PI / 2 });
      } else if (band === 'dinner') {
        on(9.4, 5.0, look(`chch-late-${d}-0`, { outfit: 'gown' }), { heading: 0, lines: ['We\'re late. Grace has started.'] });
        on(9.9, 3.6, look(`chch-late-${d}-1`, { outfit: 'gown' }), { heading: 0 });
      }
    } }) : null;
    const hallIn = walkHall ? roomCrowd(game, 'chch_hall', { cap: 10, signature: () => hallBand() + '|' + day() + '|' + inRoom('chch_hall'), populate(spawn) {
      const band = hallBand(), d = day();
      if (!inRoom('chch_hall')) return;
      if (band === 'visitors') {
        for (let k = 0; k < 6; k++) spawn(-6 - hh(k, d) * 24, k % 2 ? (hh(k, 5) - 0.5) * 1.6 : (hh(k, 9) < 0.5 ? -2.85 : 2.85), look(`chch-hallvis-${d}-${k}`, { outfit: 'tourist', prop: k % 3 ? 'camera' : 'phone' }), { wander: { radius: 4, speed: 0.7 }, lines: ['Is this the Harry Potter hall?', 'Look at all the portraits!', 'Where does Hagrid sit?', 'Smaller than in the film.'] });
      } else if (band === 'laying') {
        for (const [x, z, hd] of [[-8, -2.85, 0], [-17.5, 0, Math.PI], [-26, 2.85, Math.PI]]) spawn(x, z, look(`chch-scout-${x}`, { outfit: 'barstaff' }), { heading: hd, lines: ['Forks on the left. Always on the left.', 'Formal tonight. Gowns.'] });
        spawn(-14, 0, look('chch-scout-w', { outfit: 'barstaff' }), { wander: { radius: 9, speed: 1.0 }, lines: ['Mind out, hot plates.'] });
      } else if (band === 'dinner') {
        spawn(-14, 0, look(`chch-scout-${d}`, { outfit: 'barstaff' }), { wander: { radius: 10, speed: 1.1 }, lines: ['Mind your elbows.', 'Gravy?'] });
      }
    } }) : null;
    const cathBand = () => (evensong(hour()) || S.force === 'evensong' ? 'evensong' : cathRule() ? 'open' : 'shut');
    const vergerLook = () => look('chch-verger', { outfit: 'gown', gown: 'scholar' });
    const cathCrowd = walkCath ? roomCrowd(game, 'chch_cathedral', { cap: 3, signature: () => cathBand() + '|' + day(), populate(spawn) {
      const band = cathBand(), d = day(), PS = CATHS.pass;
      if (band === 'evensong') spawn(-2.4, PS.z - 0.5, look('chch-sidesman', { outfit: 'smart' }), { heading: -Math.PI / 2 - 0.5, lines: ['Evensong has begun. Slip in at the back.'] });
      else if (band === 'open') {
        spawn(-2.4, PS.z - 0.5, vergerLook(), { heading: -Math.PI / 2 - 0.5, lines: ['Welcome. The shrine is at the far end.', 'Evensong is at six. Everyone welcome.', 'Hats off, please, sir.'] });
        spawn(-3.0, PS.z - 0.75, look(`chch-cvis-${d}-n`, { outfit: 'tourist' }), { heading: Math.PI, lines: ['What time is Evensong?'] });
      }
    } }) : null;
    const cathIn = walkCath ? roomCrowd(game, 'chch_cathedral', { cap: 13, signature: () => cathBand() + '|' + day() + '|' + inRoom('chch_cathedral'), populate(spawn) {
      const band = cathBand(), d = day(), verger = vergerLook();
      if (band === 'shut' || !inRoom('chch_cathedral')) return;
      if (band === 'evensong') {
        // the choir in the stalls (white tops under black gowns), a small congregation in the pews, the verger at the crossing
        for (let k = 0; k < 8; k++) { const s = k < 4 ? -1 : 1; at(spawn(30.6 + (k % 4) * 1.7, s * 1.3, look(`chch-choir-${k}`, { outfit: 'gown', gown: 'scholar', top: 0xf4f4f0 }), { heading: s < 0 ? 0 : Math.PI }), 0.3); }
        for (let k = 0; k < 4; k++) spawn(4.25 + (3 + k * 4) * 1.3, (k % 2 ? 1 : -1) * (1.3 + hh(k, d) * 1.6), look(`chch-cong-${d}-${k}`, {}), { pose: 'sit', heading: Math.PI / 2 });
        spawn(27.0, -3.0, verger, { heading: Math.PI / 2, lines: ['Shh.'] });
      } else {
        spawn(12, 0, look(`chch-cvis-${d}-a`, { outfit: 'tourist', prop: 'camera' }), { heading: Math.PI / 2, lines: ['Is that the oldest spire in England?'] });
        spawn(20.5, -5.9, look(`chch-cvis-${d}-b`, { outfit: 'tourist' }), { heading: Math.PI, lines: ['Shh.'] });
        spawn(4.25 + 9 * 1.3, 2.2, look(`chch-cvis-${d}-c`, {}), { pose: 'sit', heading: Math.PI / 2 });
        for (let k = 0; k < 3; k++) spawn(8 + k * 9, k === 1 ? -6 : 6, look(`chch-cvis-${d}-${k}`, { outfit: 'tourist', prop: k ? 'phone' : undefined }), { wander: { radius: 3, speed: 0.6 }, lines: ['Is that the oldest spire in England?', 'Shh.'] });
      }
    } }) : null;
    function hallTick(dt) { if (hallCrowd) { hallCrowd.tick(dt); hallIn.tick(dt); } if (S.hallGlass) S.hallGlass(dayLight(), lampsOn()); }
    function cathTick(dt) { if (cathCrowd) { cathCrowd.tick(dt); cathIn.tick(dt); } if (S.cathGlass) S.cathGlass(dayLight(), lampsOn()); }
    // dinner: pay, sit, eat (the pizza / kebab van pattern)
    let eating = false;
    function dinner() {
      if (eating) return;
      if (!game.pay(-DINNER_PRICE)) { ui.toast(`Dinner is £${DINNER_PRICE}. You have £${(game.state.money || 0).toFixed(2)}.`); return; }
      eating = true;
      const back = { x: P.pos.x, z: P.pos.z, h: P.heading }; let t = 0, ate = false;
      P.teleport(-4.5, 0.78, 0); P.pose = 'sit';
      game.beginActivity({
        name: 'dinner', hint: 'Dinner in Hall. (Esc to leave the table)',
        update(dt) { t += dt; if (!ate && t > 3) { ate = true; P.drunk = eatEffects(flags, P.drunk, now()); game.save(); ui.toast('Grace in Latin, then soup, roast and a crumble. Excellent value.', 4); } if (t > 9) game.endActivity(); },
        onEnd() { P.pose = 'stand'; eating = false; P.teleport(back.x, back.z, back.h); },
      });
    }

    // ================================================================ custodians (bowler hats): Tom Gate (the chaser), the kiosk, Canterbury Gate
    const CUST = [{ key: 'tom', x: 248.4, z: 533.6, h: -Math.PI / 2 }, { key: 'kiosk', x: KIOSK[0] + 1.6, z: KIOSK[1] - 0.2, h: 0 }, { key: 'canterbury', x: 393.4, z: 436.0, h: Math.PI / 2 }];
    const cust = {};
    const custLook = (k) => look(`chch-custodian-${k}`, { outfit: 'porter', hat: 'bowler' });
    function custodians(on) {
      for (const c of CUST) {
        if (on && !cust[c.key] && peds) { try { cust[c.key] = peds.spawnAt(c.x, c.z, custLook(c.key), { heading: c.h, label: null, lines: CUSTODIAN_LINES, role: 'porter', knockable: true }); } catch (e) { console.warn('[christ_church] custodian', e); } }
        else if (!on && cust[c.key]) { try { peds.remove(cust[c.key]); } catch { /* */ } cust[c.key] = null; }
      }
      if (!on) S.chase = null;
    }
    const sayAt = (p, text, secs = 3) => { if (p && peds && peds.say) peds.say(p, text, secs); };
    // ticket kiosk (pay at the Meadow Gate)
    game.interact.add({ pos: KIOSK, radius: 2.2, label: () => (S.ticketDay === day() ? 'Visitor ticket: valid today' : `Buy a Christ Church visitor ticket (£${FEE})`),
      enabled: () => visitorsOpen(hour(), dow()) || S.ticketDay === day(),
      onUse: () => { if (S.ticketDay === day()) { ui.toast('Your ticket is good for today. In through the Meadow Gate.'); return; } if (!game.pay(-FEE)) { ui.toast(`A ticket is £${FEE}.`); return; } S.ticketDay = day(); flags.chchTicket = day(); game.save(); ui.toast('Ticket bought. Tom Quad, the Hall and the Cathedral are yours (till five).', 4); sayAt(cust.kiosk, 'Enjoy your visit. Keep off the grass.'); } });
    if (flags.chchTicket != null) S.ticketDay = flags.chchTicket;

    // ================================================================ the tour group (sneak in behind it)
    const tour = []; const ts = {};
    function tourOn(on) {
      if (on && !tour.length && peds) {
        for (let i = 0; i < TOUR.members; i++) {
          const lk = i === 0 ? look('chch-guide', { outfit: 'smart', prop: 'umbrella' }) : look(`chch-tourist-${i}`, { outfit: 'tourist', prop: i % 3 === 1 ? 'camera' : undefined });
          try { const p = peds.spawnAt(TOUR.route[0][0], TOUR.route[0][1], lk, { knockable: false, lines: i === 0 ? ['And on your left, Tom Tower — Wren, 1682.', 'Keep together, please!', 'Mind the custodians, they bite.'] : ['Is this where they filmed it?', 'Wait for me!'] }); tour.push(p); if (peds.control) peds.control(p, () => true); } catch (e) { console.warn('[christ_church] tour', e); }
        }
      } else if (!on && tour.length) { for (const p of tour) { try { peds.remove(p); } catch { /* */ } } tour.length = 0; }
    }
    function tourTick(ms) {
      tour.forEach((p, i) => { tourAt(i, ms, ts); const was = p.x; p.x = ts.active ? ts.x : TOUR.route[0][0] - 400; p.z = ts.active ? ts.z : TOUR.route[0][1]; p.heading = ts.h; p.speed = ts.active && ts.moving ? TOUR.speed : 0; if (p.character) p.character.group.visible = ts.active; void was; });
    }
    const tourNear = (x, z, r = 3.5) => tour.some((p, i) => tourAt(i, now(), ts).active && Math.hypot(ts.x - x, ts.z - z) < r);

    // ================================================================ Great Tom
    const bell = new TomBell(game, TOM_DIMS.centre[0], TOM_DIMS.centre[1]);
    const TOM_QUAD = [284, 527], TOM_EARSHOT = 150;   // the quad's middle (its sight), and how near its count is shown
    function tomTick(ms) {
      for (const s of strokesBetween(S.lastMs, ms)) {
        if (s.k > TOM.ambient) bell.strike((s.at - ms) / 1000 + 0.05, s.k === TOM.strokes ? 1 : 0, s.k);
        const d = Math.hypot(P.pos.x - 237.5, P.pos.z - 530.5);
        // the count is shown only within earshot of Tom Quad; further off only the bell itself carries (bell.strike:
        // gain and delay from the distance). The race to the gate keeps its own range.
        const near = P.place === 'world' && Math.hypot(P.pos.x - TOM_QUAD[0], P.pos.z - TOM_QUAD[1]) < TOM_EARSHOT;
        if (P.place === 'world' && d < 700) {
          if (s.k === 1 && !(inside(P.pos.x, P.pos.z) && tomF.toL(P.pos.x, P.pos.z)[1] < -1.5) && d < 450 && S.raceDay !== day()) { S.raceDay = day(); S.raced = true; ui.objective('Great Tom is tolling 101. Get through Tom Gate before the last stroke!'); }
        }
        if (near && s.k % 20 === 0 && s.k < TOM.strokes) ui.toast(`Great Tom: ${s.k}…`, 1.6);
        if (s.k === TOM.strokes) {
          if (near) ui.toast('…101. The gates of Oxford are shut. (Since 1663, anyway.)', 4);
          if (S.raced) { S.raced = false; ui.objective(null); ui.toast('Too late! Tom Gate is shut for the night.', 4); }
        }
      }
    }

    // ================================================================ gates: who may come in
    const allowed = (gate) => {
      const h = hour();
      if (S.force === 'open') return { ok: true };
      if (gate === 'tom' && tomAt(now()).ringing) return { ok: true, race: true };
      if (gateShut(h)) return { ok: false, why: 'shut' };
      if (gate === 'tom' && dinnerTime(h)) return { ok: true, line: 'Dining in Hall? Up the stairs in the corner.' };
      if (gate === 'tom' && evensong(h)) return { ok: true, line: 'For Evensong? Straight across to the Cathedral.' };
      if (!visitorsOpen(h, dow())) return { ok: false, why: 'closed' };
      if (S.ticketDay === day()) return { ok: true };
      return { ok: false, why: gate === 'meadow' ? 'meadow' : 'tom' };
    };
    function gateTick() {
      if (P.place !== 'world' || P.vehicle || (game.swim && game.swim.active)) { S.outside = null; return; }
      const x = P.pos.x, z = P.pos.z;
      let gate = null; for (const k of Object.keys(GATES)) if (Math.hypot(x - GATES[k][0], z - GATES[k][1]) < 9) gate = k;
      if (!gate) { S.outside = null; return; }
      const inNow = insideGate(gate, x, z);
      if (!inNow) { S.outside = { x, z, h: P.heading, gate }; return; }
      if (!S.outside) return;                               // was already inside: leaving is always allowed
      const o = S.outside; S.outside = null;
      const a = allowed(gate);
      if (a.ok) {
        if (a.line) sayAt(cust[gate === 'canterbury' ? 'canterbury' : 'tom'], a.line);
        if (a.race && S.raced && gate === 'tom') { S.raced = false; ui.objective(null); game.pay(5); ui.toast('In before the gate shuts! The porter nods. (+£5)', 4); }
        return;
      }
      if (tourNear(x, z) || tourNear(o.x, o.z)) { if (!S.sneakDay || S.sneakDay !== day()) { S.sneakDay = day(); ui.toast('You slip in behind the tour group. The custodian counts heads and gives up.', 4); } return; }
      // turned away: back out through the gate
      const out = gate === 'tom' ? tomF.toW(0, 7.6) : gate === 'canterbury' ? cantF.toW(0, -6) : [381.8, 622.6];
      P.teleport(out[0], out[1], gate === 'tom' ? tomF.heading(0, 1) : gate === 'canterbury' ? cantF.heading(0, -1) : 0);
      const lines = TURN_AWAY[a.why] || TURN_AWAY.tom, line = lines[Math.floor(hh(day(), Math.floor(now() / 7000)) * lines.length)];
      ui.toast(line, 3.5); sayAt(cust[gate === 'meadow' ? 'kiosk' : gate === 'canterbury' ? 'canterbury' : 'tom'], line);
    }

    // ================================================================ the lawn: custodian chase; Mercury
    function lawnTick(dt) {
      const c = cust.tom; if (!c || !peds || !peds.control) return;
      const x = P.pos.x, z = P.pos.z, off = P.place === 'world' && !P.vehicle && lawnOffence(onLawn(x, z), onLawnPath(x, z, paths), hour());
      S.offT = off ? S.offT + dt : 0;
      if (!S.chase && S.offT > 1.2) {
        S.chase = { t: 0, calm: 0, fined: false };
        sayAt(c, 'Oi! OFF THE GRASS!', 3); ui.toast('A custodian has spotted you on the lawn!', 3);
        peds.control(c, (p, d) => {
          const C = S.chase; if (!C) { const rem = peds.moveTo(p, CUST[0].x, CUST[0].z, 1.3, d); if (rem < 0.2) { p.heading = CUST[0].h; p.speed = 0; return false; } return true; }
          C.t += d; C.calm = S.offT > 0 ? 0 : C.calm + d;
          if (C.calm > 2.5 || C.t > 40) { sayAt(p, C.fined ? 'And let that be a lesson.' : 'And STAY off it!', 3); S.chase = null; return true; }
          const rem = peds.moveTo(p, P.pos.x, P.pos.z, 4.2, d);
          if (rem < 1.1 && S.offT > 0 && !C.fined) {
            C.fined = true; S.fines++;
            const paid = game.pay(-LAWN_FINE);
            sayAt(p, paid ? `That's a ${LAWN_FINE}-pound fine. Grass is for Fellows.` : 'No money? Then off. Now.', 3.5);
            ui.toast(paid ? `Fined £${LAWN_FINE} for walking on Tom Quad's grass.` : 'Caught! But your pockets are empty.', 4);
            C.calm = 1.5;
          }
          return true;
        });
      }
      // Mercury: a dip costs you
      const inPond = game.swim && game.swim.active && Math.hypot(x - MERCURY[0], z - MERCURY[1]) < QUAD.pond.r + 0.5;
      if (inPond && !S.dipped) { S.dipped = true; const paid = game.pay(-MERCURY_FINE); ui.toast(paid ? `In Mercury! A custodian fines you £${MERCURY_FINE}. (The koi look unimpressed.)` : 'In Mercury! The koi look unimpressed.', 4); sayAt(c, 'Out of Mercury! Out!', 3); }
      if (!inPond && S.dipped && !(game.swim && game.swim.active)) S.dipped = false;
    }

    // ================================================================ per-frame
    const sights2 = sights;
    let nearT = 0, near = false;
    function tick(dt) {
      const ms = now(), cam = game.camera.position, outdoors = P.place === 'world';
      tomTick(ms); S.lastMs = ms;
      nearT -= dt;
      if (nearT <= 0) {
        nearT = 0.5;
        const d = Math.min(Math.hypot(P.pos.x - 300, P.pos.z - 530), Math.hypot(P.pos.x - KIOSK[0], P.pos.z - KIOSK[1]) + 30);
        const want = outdoors && d < 170;
        if (want !== near) { near = want; custodians(want); }
        tourOn(outdoors && Math.hypot(P.pos.x - 240, P.pos.z - 530) < 150);
      }
      distCull(CULL, cam, outdoors);
      game.camera.getWorldDirection(_fwd); { const l = Math.hypot(_fwd.x, _fwd.z) || 1; _fwd.x /= l; _fwd.z /= l; }
      lodSwap(LOD, cam, outdoors, _fwd, lodScale(game));
      if (spire) { const on = !!W.aerial && outdoors; if (spire.visible !== on) spire.visible = on; }
      if (quad) quad.update(dt, cam, ms, outdoors);
      if (tour.length) tourTick(ms);
      if (near) { gateTick(); lawnTick(dt); }
    }
    game.chch = {
      sights: sights2, state: S, inside, insideGate, tower, quad,
      tom: (ms = now()) => tomAt(ms),
      /** (walk-in: 'chch_stair' is the foot of the stair in the joined room 'chch_hall'; 'chch_hall' puts you in the Hall itself) */
      enter: async (id) => { if (walkHall && (id === 'chch_stair' || id === 'chch_hall')) { R.enterNow('chch_hall', R.get('chch_hall').doors[0], id === 'chch_hall' ? [-1.4, 0, -Math.PI / 2] : undefined); return P.place; } await R.enter(id, R.get(id).doors[0]); return P.place; },
      walkin: () => ({ hall: hallPlan, cathedral: cathPlan, hallDoor: S.hallDoor || null, cathDoor: S.cathDoor || null }),
      /** force rules for tests / screenshots: null | 'open' | 'dinner' | 'evensong' */
      setForce(f) { S.force = f; return f; },
      stats() {
        let draws = 0, tris = 0;
        for (const m of meshes) { if (!m.visible) continue; draws++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
        if (quad && quad.koi.visible) { draws++; tris += 8 * 7; }
        return { draws, tris: Math.round(tris), meshes: meshes.length, near, tour: tour.length, custodians: Object.values(cust).filter(Boolean).length, chase: !!S.chase, fines: S.fines, ticket: S.ticketDay === day() };
      },
      update: (dt) => tick(dt),
    };
    tick(0);
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[christ_church]', e); } } } };
  },
};

function rectLocal(Q) {
  const F = localFrame(Q.o, Q.dir), O = Q.outer;
  return [[O[0], O[2]], [O[1], O[2]], [O[1], O[3]], [O[0], O[3]]].map(([u, v]) => F.toW(u, v));
}

/** Canterbury Gate (Wyatt, 1770s): two piers and an arch through, an upper storey, a Doric front with a pediment on
 *  Oriel Square (the order is a guess). Mapped footprint w301894833. Returns meshes; adds the colliders + passage. */
function buildCanterbury(W, mats, scene, col) {
  const F = localFrame([399.5, 434.0], [0.148, 0.989]);   // u along the east face (south), v = west (into the quad)
  const hw = 4.05, hd = 3.2, H = 13.4, B = new Batch();
  B.push(F.matrix());
  const arch = archPts(0, 3.4, 0, 4.3, 10);
  const notch = (len) => [[0, 0], [hw - 1.7, 0], ...arch.slice(2).reverse().map(([x, y]) => [hw + x, y]), [hw + 1.7, 0], [len, 0], [len, H], [0, H]];
  const face = (x, z, ax, az, len, outline) => { const M = frameM(x, z, ax, az); B.push(M); B.face('stone', outline); B.pop(); };
  face(hw, -hd, -1, 0, 2 * hw, notch(2 * hw));                    // east face (towards Oriel Square), normal -v
  face(-hw, hd, 1, 0, 2 * hw, notch(2 * hw));                     // west face (into Canterbury Quad), normal +v
  face(-hw, -hd, 0, 1, 2 * hd, rectPts(0, 0, 2 * hd, H));         // normal -u
  face(hw, hd, 0, -1, 2 * hd, rectPts(0, 0, 2 * hd, H));          // normal +u
  for (const s of [-1, 1]) B.boxXZ('stone', s > 0 ? 1.7 : -2.0, s > 0 ? 2.0 : -1.7, 0, 4.3, -hd, hd);
  B.boxXZ('stone', -1.7, 1.7, 5.9, 6.2, -hd, hd, { bottom: true });
  B.boxXZ('lead', -hw, hw, H - 0.15, H, -hd, hd);
  // Doric front on the east face: four attached columns, entablature, pediment
  for (const u of [-3.4, -2.2, 2.2, 3.4]) { prism(B, 'stonePale', u, -hd - 0.3, 0.32, 0, 7.4, 12); B.box('stonePale', u, 7.55, -hd - 0.3, 0.8, 0.3, 0.8); }
  B.boxXZ('stonePale', -hw - 0.2, hw + 0.2, 7.7, 8.9, -hd - 0.75, -hd);
  for (let k = 0; k < 6; k++) { const t = k / 5; B.box('stonePale', -hw + t * 2 * hw, 8.3, -hd - 0.78, 0.25, 0.6, 0.04); }   // triglyphs
  B.poly('stonePale', [[-hw - 0.2, 8.9, -hd - 0.6], [hw + 0.2, 8.9, -hd - 0.6], [0, 11.0, -hd - 0.6]], [0, 0, -1]);
  B.poly('lead', [[-hw - 0.2, 8.9, -hd - 0.6], [0, 11.0, -hd - 0.6], [0, 11.0, -hd + 0.4], [-hw - 0.2, 8.9, -hd + 0.4]], [-1, 1, 0]);
  B.poly('lead', [[hw + 0.2, 8.9, -hd - 0.6], [hw + 0.2, 8.9, -hd + 0.4], [0, 11.0, -hd + 0.4], [0, 11.0, -hd - 0.6]], [1, 1, 0]);
  // windows of the upper storey (both faces)
  for (const [z, ax] of [[-hd, -1], [hd, 1]]) { B.push(frameM(ax > 0 ? -hw : hw, z, ax, 0)); for (const s of [hw - 2.4, hw, hw + 2.4]) recess(B, rectPts(s - 0.55, 9.4, s + 0.55, 11.6), 0.25); B.pop(); }
  B.pop();
  const out = buildMeshes(B, mats, scene, 'chch:canterbury:', { noCast: new Set(['win']), alias: ALIAS, mono: W });
  // colliders: the two piers; the passage
  for (const s of [-1, 1]) { const [x, z] = F.toW(s * (hw + 1.7) / 2, 0); col.addBox(x, z, hw - 1.7, 2 * hd, Math.atan2(-F.uz, F.ux)); }
  { const a = F.toW(0, -hd - 1.5), b = F.toW(0, hd + 1.5); col.addPassage(a[0], a[1], b[0], b[1], 3.0); }
  return out;
}
function frameM(x, z, ax, az) {
  // wall frame inside the current batch frame: along (ax, az), face normal (-az, ax)
  return new THREE.Matrix4().makeBasis({ x: ax, y: 0, z: az }, { x: 0, y: 1, z: 0 }, { x: -az, y: 0, z: ax }).setPosition(x, 0, z);
}
