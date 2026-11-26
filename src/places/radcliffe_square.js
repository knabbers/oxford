// Radcliffe Square and the university's historic core, c. 2013 — see docs/research/radcliffe_square.md (sources, what is
// known and what is guessed).
//
//   preMap    the generic Camera, St Mary's, Sheldonian, Bridge of Sighs and All Souls towers are skipped (rebuilt here);
//             the underground book stores / Gladstone Link (mapped as 0.6 m buildings) are not drawn
//   install   the Radcliffe Camera (_rad_camera.js), St Mary the Virgin with its tower climb (_rad_stmary.js), the
//             Old Schools Quadrangle dressing + Tower of the Five Orders (_rad_bodleian.js, _rad_fiveorders.js), the
//             Divinity School interior (_rad_divinity.js), the Sheldonian with the Emperors' Heads, the Clarendon's Muses
//             (_rad_sheldonian.js), the Bridge of Sighs, St Helen's Passage and the Turf's yard (_rad_bridge.js), All
//             Souls' towers and gate (_rad_allsouls.js); the games (_rad_games.js): the Camera porter and the reader's
//             card, photobombing tourists, the walking-tour job, degree days at the Sheldonian.
// Everything people see together (porter lines, tourists, the procession) is a function of the shared clock and the game
// day; no Math.random, no network traffic. Static meshes are merged into a few draws per site through the shared
// Worcester/Radcliffe atlas material.
//
// Test hooks: game.radcliffe = { sights, stats(), debugClimb(on), debugEnter(id), debugExit(), games, dims }
//             tools/smoke_radcliffe.mjs
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as Camera from './_rad_camera.js';
import { ROOFSCAPE } from '../world/buildings.js';
import * as StMary from './_rad_stmary.js';
import { createClimb } from './_rad_climb.js';
import * as Bod from './_rad_bodleian.js';
import * as Div from './_rad_divinity.js';
import { planWalkin, cityDoor, warmLater, dressOpenings, roomCrowd } from './_walkin_city.js';
import { randomLook } from '../core/characters.js';
import * as Shel from './_rad_sheldonian.js';
import * as Bridge from './_rad_bridge.js';
import * as Souls from './_rad_allsouls.js';
import * as Reading from './_rad_reading.js';
import { createGames, TOUR, TOURIST_LINES } from './_rad_games.js';
import { Batch, radSigns, signQuad, signsMesh, pack, pip } from './_rad_kit.js';
import { Lod, splitByCell } from './_rad_lod.js';
import { tn } from '../core/features.js';

export const IDS = {
  divinity: 'w114320058', camera: 'w4884600', cameraParts: ['w385163420', 'w237779894', 'w1259054050', 'w1259054048'],
  underground: ['w243977516', 'w243977518', 'r3369170', 'r3369170_1'],
  stmary: 'w60903337',
  bodleian: ['r62123', 'w390903488'],
  sheldonian: 'w27582068',
  bridge: 'w62333303',
  turf: 'w97822057',
  allsoulsTowers: 'w227773847', allsoulsScreen: 'w301650408',
};
/** every id this module removes from the generic world (and rebuilds by hand) */
export const SKIP = [IDS.camera, ...IDS.cameraParts, ...IDS.underground, IDS.stmary, ...IDS.bodleian, IDS.sheldonian, IDS.bridge, IDS.divinity];

export const CAMERA_CENTRE = [413.9, 172.1];

/** pure: where the Camera's door faces (towards the mapped entrance steps) */
export function entranceAngle(map) {
  const st = map.buildings.find((b) => b.id === 'w1259054048');
  const p = st ? st.c : [408.9, 157.4];
  return Math.atan2(p[0] - CAMERA_CENTRE[0], p[1] - CAMERA_CENTRE[1]);
}

export const SIGHTS = [];
const _fwd = new THREE.Vector3();

// the whole area's static exterior is ONE draw (_rad_lod.js): the showpieces register their own near / mid / far chunks;
// whatever a helper still builds as a plain atlas mesh is cut into 48 m cells here, each its own LOD group (near = as
// built, mid / far = without its small triangles). Lettering (notices, school boards) is one more draw, shown only
// within SIGNS_D of a board.
export const AREA_BB = [300, 500, 20, 270];   // x0, x1, z0, z1 of everything built here
export const AREA_C = [405, 160], MID_MIN_AREA = 0.45, FAR_MIN_AREA = 1.6, SIGNS_D = 25, CELL_M = 48;
function mergeAll(root, lod, P) {
  const groups = new Map();      // material -> {geos, castShadow, name}
  const drop = [], stats = {}, signPts = [];
  root.traverse((m) => {
    if (!m.isMesh || m === root) return;
    m.updateMatrixWorld(true);
    const geo0 = m.geometry.clone(); geo0.applyMatrix4(m.matrixWorld);
    const geo = geo0.index ? geo0.toNonIndexed() : geo0;
    drop.push(m);
    if (m.material === P.atlas) {
      // a helper's plain atlas mesh -> LOD groups by 48 m cell
      const what = m.name.split(':')[1] || 'site';
      for (const [key, g] of splitByCell(geo, CELL_M)) {
        g.computeBoundingSphere();
        const s = g.boundingSphere, grp = lod.group(what + ':' + key, [s.center.x, s.center.y, s.center.z], s.radius, [65, 165, 1100]);
        grp.add(0, g); grp.add(1, farCopy(g, MID_MIN_AREA)); grp.add(2, farCopy(g, FAR_MIN_AREA));
        stats['rad:' + what] = (stats['rad:' + what] || 0) + g.attributes.position.count / 3;
      }
      return;
    }
    if (/signs$/.test(m.name)) { const p = geo.attributes.position.array; for (let i = 0; i < p.length; i += 18) signPts.push((p[i] + p[i + 6]) / 2, (p[i + 1] + p[i + 7]) / 2, (p[i + 2] + p[i + 8]) / 2); }
    const key = m.material.uuid;
    let g = groups.get(key); if (!g) groups.set(key, (g = { mat: m.material, geos: [], cast: false, names: [] }));
    g.geos.push(geo); g.cast = g.cast || m.castShadow; g.names.push(m.name);
  });
  for (const m of drop) { m.removeFromParent(); }
  for (const o of root.children.slice()) root.remove(o);
  for (const g of groups.values()) {
    // only the attributes every piece has
    const names = Object.keys(g.geos[0].attributes).filter((a) => g.geos.every((q) => q.attributes[a]));
    for (const q of g.geos) for (const a of Object.keys(q.attributes)) if (!names.includes(a)) q.deleteAttribute(a);
    const geo = mergeGeometries(g.geos); for (const q of g.geos) q.dispose();
    if (!geo) continue;
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const kind = g.names.some((n) => /signs$/.test(n)) ? 'signs' : 'city' + (g.mat.name ? '-' + g.mat.name.replace(/[^a-z]/gi, '').slice(0, 10) : stats.__n = (stats.__n || 0) + 1);
    const mesh = new THREE.Mesh(geo, g.mat); mesh.name = 'rad:' + kind; mesh.castShadow = g.cast && kind !== 'signs'; mesh.receiveShadow = true;
    root.add(mesh); stats[mesh.name] = Math.round(geo.attributes.position.count / 3);
    if (kind === 'signs') { root.userData.signs = mesh; root.userData.signPts = signPts; mesh.visible = false; }
  }
  return { stats };
}
/** a copy of a non-indexed geometry without its triangles smaller than minArea m² */
export function farCopy(geo, minArea, only = null) {
  const P = geo.attributes.position.array, nT = P.length / 9, keep = [];
  for (let t = 0; t < nT; t++) {
    const o = t * 9, ax = P[o + 3] - P[o], ay = P[o + 4] - P[o + 1], az = P[o + 5] - P[o + 2], bx = P[o + 6] - P[o], by = P[o + 7] - P[o + 1], bz = P[o + 8] - P[o + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (0.5 * Math.hypot(cx, cy, cz) >= minArea) keep.push(t);
  }
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geo.attributes)) {
    if (only && !only.includes(name)) continue;
    const sz = a.itemSize, src = a.array, dst = new Float32Array(keep.length * 3 * sz);
    keep.forEach((t, i) => dst.set(src.subarray(t * 3 * sz, (t + 1) * 3 * sz), i * 3 * sz));
    out.setAttribute(name, new THREE.BufferAttribute(dst, sz));
  }
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

export default {
  id: 'radcliffe_square',
  preMap(game) {
    try {
      for (const id of SKIP) game.overrides.skip.add(id);
      // the Divinity School's mapped building is skipped (SKIP) and built by hand (_rad_divinity.js buildShell: 12.8 m,
      // Duke Humfrey's Library above the School; buttresses, battlements, the great windows as real openings)
      // the Turf: a low, old, whitewashed two-storey pub under a tiled roof (it was drawn as a 10 m block)
      game.overrides.heights.set(IDS.turf, 6.4);
      // All Souls' cloister screen on Catte Street is a single storey (the gateway + cupola are built here)
      game.overrides.heights.set(IDS.allsoulsScreen, Souls.ALLSOULS.screen);
      game.overrides.style.set(IDS.turf, { wall: 'render', roof: 'tile', color: '#ece4cf', ground: 'pubFront', storeys: 2 });
      // photo comparison item 14 (sheldonian): the railings between the Emperors' piers are tall spiked iron, not knee high
      if (ROOFSCAPE) for (const b of game.map.barriers || []) if (b.id === 'w114320059' || b.id === 'w114320054' || b.id === 'w1418421918') b.h = 2.2;
    } catch (e) { console.error('[radcliffe_square] preMap', e); }
  },

  install(game) {
    const W = game.world, map = game.map, col = game.worldCollider;
    const S = { err: false, built: {} };
    const root = new THREE.Group(); root.name = 'rad:root';
    const P = pack(W), lod = new Lod();
    const sights = [];
    const sight = (id, name, x, z, blurb) => { sights.push({ id, name, x, z, blurb }); };

    // the Camera's lawn is bare mown grass inside its railings: the world's rough-grass scatter put a conifer and a round
    // tree on it (photo comparison item 5; brasenose / radcam). No trees in the square.
    try {
      // (and the strip of St Mary's grounds on the square, whose round tree and yew read as standing in the square)
      S.treesCleared = 0;
      for (const id of ['w28666269', 'w556632295']) { const a = map.areas.find((q) => q.id === id); if (a) S.treesCleared += W.clearArea(a.poly, { trees: true, furniture: false, lamps: false }); }
    } catch (e) { console.warn('[radcliffe_square] lawn trees', e); }

    // ---------------------------------------------------------------- the Radcliffe Camera
    let cam = null;
    try {
      const a0 = entranceAngle(map);
      cam = Camera.build({ world: W, parent: root, centre: CAMERA_CENTRE, entranceAngle: a0, lod });
      col.addCircle(CAMERA_CENTRE[0], CAMERA_CENTRE[1], Camera.CAMERA.R + 0.55);
      // The north door is a real doorway now (the reading room is a walk-in room: _rad_games.js). Its steps are walkable
      // — the ground rises in four treads to the plinth (0.62 m) across the door bay and through the wall's thickness —
      // and the porch recess is open up to the door leaf (the leaf and the room's portal do the rest).
      { const C = Camera.CAMERA, [cx, cz] = CAMERA_CENTRE, sx = Math.sin(a0), sz = Math.cos(a0), prev = W.groundHeight.bind(W);
        W.groundHeight = (x, z) => { const dx = x - cx, dz = z - cz; if (Math.abs(dx) < 19 && Math.abs(dz) < 19) { const r = dx * sx + dz * sz, u = dx * sz - dz * sx; if (r > 11 && r < C.A + 2.06 && Math.abs(u) < 1.9 + Math.max(0, r - C.A - 0.62) * 0.6) { const k = Math.max(0, Math.ceil((r - C.A - 0.98) / 0.36)); return prev(x, z) + Math.max(0, C.plinth - 0.155 * k); } } return prev(x, z); };
        // (the always-open way through the collider's circle ends 15 cm short of the oak leaf, which hangs at the back of the
        //  reveal: you walk up to the leaf and your hand is on its handle — the leaf is 1.6 m wide for that: core/_doors.js ARM)
        col.addPassage(cx + sx * (C.A - C.door.rec + 0.09), cz + sz * (C.A - C.door.rec + 0.09), cx + sx * (C.A + 3), cz + sz * (C.A + 3), 2.0); }
      S.built.camera = cam.dims.tris;
      sight('radcliffe-camera', 'Radcliffe Camera', CAMERA_CENTRE[0], CAMERA_CENTRE[1], "Gibbs's domed rotunda of 1737-49, the Bodleian's reading room: readers only.");
    } catch (e) { console.error('[radcliffe_square] camera', e); }

    // ---------------------------------------------------------------- St Mary the Virgin, the tower climb
    let sm = null, climb = null;
    try {
      sm = StMary.build({ world: W, parent: root, map, lod });
      const nave = map.buildings.find((b) => b.id === StMary.ID);
      if (nave) col.addPolygon(nave.poly);
      const T = StMary.TOWER, h = T.half + 0.3;
      col.addPolygon([[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, z]) => StMary.towerPt(x, z)));
      const P = StMary.PORCH; col.addBox(P.at[0], P.at[1] + 0.3 + P.front / 2, P.w + 0.6, 2.0 + P.front); for (const sx of [-1, 1]) col.addCircle(P.at[0] + sx * 2.2, P.at[1] + P.front + 0.55, 0.6);
      // doors to the tower: the north door off the churchyard (by the tower) and the High Street porch
      const north = StMary.towerPt(-T.half - 1.6, T.half + 1.4), porchDoor = [P.at[0], P.at[1] + P.front + 1.8];
      col.addPassage(426.2, 215.6, 426.6, 221.0, 1.5);           // the churchyard gate (mapped gate node n2361749792)
      climb = createClimb(game, { doors: [{ pos: north, facing: StMary.towerHeading(0, 1) }, { pos: porchDoor, facing: 0 }] });
      S.built.stmary = 1;
      const tp = StMary.towerPt(0, 0);
      sight('stmary-tower', "St Mary's tower and spire", tp[0], tp[1], 'The University Church: a 13th-century tower and a 14th-century pinnacled spire, 58 m. Climb it for the view of the Camera.');
      sight('stmary-porch', "St Mary's south porch", P.at[0], P.at[1] + 1.5, "Nicholas Stone's baroque porch of 1637 on the High: twisted columns and the Virgin and Child.");
      sight('stmary-gallery', 'The gallery round the spire', tp[0], tp[1], 'Twenty-six metres up: the Radcliffe Camera from above.');
    } catch (e) { console.error('[radcliffe_square] st mary', e); }

    // ---------------------------------------------------------------- the Old Schools Quadrangle, the Divinity School
    let bod = null;
    try {
      bod = Bod.build({ world: W, parent: root, map, lod });
      const b = map.buildings.find((q) => q.id === Bod.ID);
      if (b) { col.addPolygon(b.poly); for (const h of b.holes || []) col.addPolygon(h); }
      col.addCircle(Bod.PEMBROKE[0], Bod.PEMBROKE[1], 0.95);
      // the three covered ways into the quad (the Great Gate, the south gate by the Camera, the north from the Clarendon
      // quad): the mapped footways stop just short of the walls, so their passages are carried 2 m beyond each end
      for (const id of ['w114573931', 'w114573932', 'w114573933']) {
        const r = map.roads.find((q) => q.id === id); if (!r) continue;
        const a = r.pts[0], c = r.pts[r.pts.length - 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
        col.addPassage(a[0] - ux * 2, a[1] - uz * 2, c[0] + ux * 2, c[1] + uz * 2, 2.6);
      }
      S.built.bodleian = bod.meshes.length;
      sight('five-orders', 'Tower of the Five Orders', 404.4, 100.3, 'The Schools\' gate tower, 1613-24: Tuscan, Doric, Ionic, Corinthian and Composite columns stacked up its quad face, James I in the fourth stage.');
      sight('schools-quad', 'Old Schools Quadrangle', 388, 105, 'The Bodleian\'s Jacobean quad: the doors still carry the schools\' names, painted in gold.');
      sight('pembroke', 'The Earl of Pembroke', Bod.PEMBROKE[0], Bod.PEMBROKE[1], 'Bronze of the 3rd Earl, after Rubens; here since 1723.');
      // walk-in (core/interiors.js "seamless"; _walkin_city.js): the quad door is a real door (heavy oak; locked out of
      // hours — 9 to 5, GUESS — and to the skint: it is £1, taken as you step in), then the Proscholium, then the School
      // in place in its mapped building. The outline given is the strip the room uses: the School's own footprint
      // continued through the west range to the modelled quad face (0.92 m behind the old prompt point).
      const divOpen = () => { const h = game.time.hour; if (S.walkinTest) return h >= 8 && h < 20; return h >= 9 && h < 17 && ((game.state.money ?? 0) >= 1 || !!S.debugFree); };
      let divPlan = null;
      try {
        const [dx0, dz0] = Bod.DIVINITY_DOOR.pos, f = Bod.DIVINITY_DOOR.facing, fx = Math.sin(f), fz = Math.cos(f), tx = Math.cos(f), tz = -Math.sin(f);
        const at = (t, n) => [dx0 + tx * t - fx * n, dz0 + tz * t - fz * n];
        divPlan = planWalkin(game, { id: 'rad_divinity', building: [at(-5.4, 0.92), at(5.4, 0.92), at(5.4, 34.3), at(-5.4, 34.25)], door: Bod.DIVINITY_DOOR,
          hours: { open: divOpen, get testOpen() { S.walkinTest = true; return 14; }, testShut: 3.5 }, ...Div.divPlanSpec() });
        // (punched just in front of the painted door of the quad face — _rad_bodleian.js, 5 cm proud — which is the far look)
        divPlan.seamless.portals[0].proud = 0.075;
        { const hl = Div.DIVS.L / 2, hw = Div.DIV.W / 2, V = Div.DIVS.vest; divPlan.seamless.bounds = [{ x0: -hl, x1: hl, z0: -hw, z1: hw, y0: 0, y1: Div.DIV.crown }, { x0: hl, x1: hl + V.wall + V.len, z0: -V.hw, z1: V.hw, y0: 0, y1: V.h }]; }
      } catch (e) { console.warn('[radcliffe_square] divinity plan', e); }
      // the School's own outside (its mapped building is skipped), solid; the tracery of its windows and the quad door's
      // stone case are drawn in the world over the room's openings (lit as the walls are)
      try {
        const db = map.buildings.find((q) => q.id === IDS.divinity);
        if (db) col.addPolygon(db.poly);
        if (divPlan && divPlan.fit.ok) S.built.divinityShell = !!Div.buildShell({ world: W, lod, map, plan: divPlan, id: IDS.divinity });
      } catch (e) { console.warn('[radcliffe_square] divinity shell', e); }
      // tourists and a guide in opening hours, an attendant at the desk in the Proscholium (the same for every player)
      const divHours = () => { const h = game.time.hour; return h >= 9 && h < 17; };
      const divCrowd = roomCrowd(game, 'rad_divinity', { cap: 9, signature: () => (divHours() ? 'open' : 'shut'), populate(sp) {
        if (!divHours()) return;
        const hl = Div.DIVS.L / 2, V = Div.DIVS.vest, xv = hl + V.wall + V.len / 2;
        sp(xv + 0.8, V.hw - 1.5, randomLook('rad-div-attendant', { outfit: 'smart' }), { heading: Math.PI, label: 'Attendant' });
        sp(3.6, -1.4, randomLook('rad-div-guide', { outfit: 'tweed', prop: 'clipboard' }), { heading: Math.PI / 2, pose: 'talk', label: 'Guide' });
        [[5.2, -2.3, -1.9], [5.6, -0.9, -1.6], [5.0, 0.2, -1.2], [6.3, -1.8, -1.7]].forEach(([x, z, h], i) => sp(x, z, randomLook('rad-div-tour-' + i, { outfit: 'tourist', prop: i === 1 ? 'camera' : undefined }), { heading: h, pose: i === 1 ? 'photo' : 'stand', label: '', lines: TOURIST_LINES }));
        sp(-2.4, 2.6, randomLook('rad-div-visitor-a', { outfit: 'casual', prop: 'camera' }), { heading: 0.4, pose: 'photo', label: '' });
        sp(-1.5, -2.5, randomLook('rad-div-visitor-b', { outfit: 'casual' }), { heading: 2.9, label: '' });
      } });
      const divTick = (dt) => { try { const dd = S.divRoom; if (dd && dd.setLight) dd.setLight(divHours() ? 0.72 + 0.28 * (1 - (game.time.daylight ?? 1)) : 0.06 + 0.45 * (game.time.daylight ?? 0)); divCrowd.tick(dt); } catch { /* */ } };
      game.interiors.register({
        id: 'rad_divinity', name: 'The Divinity School', background: 0x2a2620, ambient: 0.35,
        update: divTick, updateShown: divTick,
        seamless: divPlan && divPlan.fit.ok ? divPlan.seamless : null,
        doors: [{ pos: Bod.DIVINITY_DOOR.pos, facing: Bod.DIVINITY_DOOR.facing, label: 'Enter the Divinity School (£1)', locked: () => ((game.state.money ?? 0) < 1 && !S.debugFree ? 'The Divinity School is £1. You are skint.' : false) }],
        build(ctx) { const r = Div.build({ ...ctx, world: W, plan: divPlan }); ctx.addExit(r.exit[0], r.exit[1], 'Back out to the Proscholium'); S.divDims = r.dims; S.divRoom = r;
          if (ctx.seamless && divPlan) S.divDoor = cityDoor(ctx, divPlan, { style: 'oak', heavy: true, setBack: 0.25, open: divOpen });
          return { spawn: r.spawn, heading: r.heading }; },
        onEnter() { if (!S.debugFree && !S.walkinTest) { game.pay(-1); } S.debugFree = false; try { game.ui.toast('The Divinity School, 1427-83: look up. Four hundred and fifty-five carved bosses.', 6); } catch { /* */ } },
      });
      if (divPlan) warmLater(game, 'rad_divinity');
      try { if (divPlan && divPlan.fit.ok) {
        dressOpenings(game, 'rad_divinity', [...Div.traceryItems(divPlan.seamless.openings),
          { p: 0, head: 'segment', rise: Div.DIVS.door.rise, wall: 0xcbbb94, surround: { w: 0.2, color: 0xdcd2b8, proud: 0.13 }, step: { h: 0.06, proj: 0.3, over: 0.25, color: 0xb9ae96 }, fill: false }]);
      } } catch (e) { console.warn('[radcliffe_square] divinity dressing', e); }
      sight('divinity-school', 'The Divinity School', 350.3, 112.3, "Oxford's oldest teaching room: William Orchard's lierne vault of 1480-83, its pendants hanging like lanterns.");
    } catch (e) { console.error('[radcliffe_square] bodleian', e); }

    // ---------------------------------------------------------------- the Sheldonian, the Emperors' Heads, the Clarendon's Muses
    let shel = null;
    try {
      shel = Shel.build({ world: W, parent: root, map, lod });
      if (shel.footprint) col.addPolygon(shel.footprint);
      for (const hd of shel.heads) col.addCircle(hd.x, hd.z, ROOFSCAPE ? 0.55 : 0.42);   // the piers are 0.9 m square now (item 14)
      S.built.sheldonian = 1;
      const c = shel.centre || [343, 73];
      sight('sheldonian', 'Sheldonian Theatre', c[0], c[1], "Wren's first building (1664-69): a Roman theatre with a roof, where degrees are conferred. The cupola is from 1838.");
      sight('emperors-heads', "The Emperors' Heads", 341.7, 49.5, 'Seventeen bearded stone heads on piers along Broad Street; this set was carved in 1970-72.');
      sight('clarendon', 'Clarendon Building', 374, 40, "Hawksmoor's giant Doric portico (1711-15) and nine lead Muses on the roof.");
      sight('history-of-science', 'Museum of the History of Science', 312, 75, 'The Old Ashmolean of 1683, the first purpose-built museum in Britain; four of the heads stand in front of it.');
    } catch (e) { console.error('[radcliffe_square] sheldonian', e); }

    // ---------------------------------------------------------------- the Bridge of Sighs, St Helen's Passage, the Turf
    try {
      const br = Bridge.build({ world: W, parent: root, map, lod, isFree: (x, z, r) => col.isFree(x, z, r) });
      for (const [x, y, z] of br.lamps) { try { W.addLampGlow(x, y, z); } catch { /* stub */ } }
      for (const y of br.yard) { col.addCircle(y.x, y.z, y.kind === 'table' ? 0.9 : 0.4); if (y.kind === 'brazier') { try { W.addLampGlow(y.x, 1.05, y.z); } catch { /* */ } } }
      S.built.bridge = br.meshes.length; S.yard = br.yard;
      const D = Bridge.BRIDGE;
      sight('bridge-of-sighs', 'The Bridge of Sighs', (D.x0 + D.x1) / 2, (D.zN + D.zS) / 2, "Hertford College's bridge over New College Lane (T. G. Jackson, 1914): more Rialto than Venice.");
      sight('st-helens-passage', "St Helen's Passage", 438.5, 45, tn('Once Hell Passage: a twisting alley off New College Lane to the Turf.', 'Once Hell Passage: a twisting alley off New College Lane to the old tavern under the city wall.'));
      sight('turf-tavern', tn('The Turf Tavern', 'The Bastion'), 490, 30, 'An old inn hidden behind the city wall, reached only by alleys: low beams inside, braziers in the garden.');
    } catch (e) { console.error('[radcliffe_square] bridge', e); }

    // ---------------------------------------------------------------- All Souls: twin towers, the gate on Catte Street
    try {
      const so = Souls.build({ world: W, parent: root, map });
      S.built.allsouls = so.meshes.length; S.soulsGate = so.gate;
      sight('all-souls-towers', "All Souls' twin towers", 490.7, 161, "Hawksmoor's Gothic towers of 1716-34 over the North Quad, seen through the screen from the square.");
      sight('all-souls-gate', 'All Souls gate', so.gate.x, so.gate.z, 'The wrought-iron gate in the cloister screen, under its cupola, facing the Camera. Fellows only.');
    } catch (e) { console.error('[radcliffe_square] all souls', e); }

    // ---------------------------------------------------------------- the games
    let games = null;
    try {
      const signs = radSigns(W);
      // the walking-tours board on Broad Street (a post and a painted board)
      { // notices: "Readers only" by the Camera's door, the tower's prices at both church doors
        const Bn = new Batch();
        if (cam) { const a = cam.dims.entranceAngle, [dx, dz] = cam.door, ox = Math.cos(a), oz = -Math.sin(a), nx = Math.sin(a), nz = Math.cos(a), x = dx - ox * 2.2 - nx * 1.9, z = dz - oz * 2.2 - nz * 1.9; signQuad(Bn, signs.uv('readers'), x - ox * 0.5, z - oz * 0.5, x + ox * 0.5, z + oz * 0.5, 1.2, 1.7, nx, nz, 0.0); }
        if (sm) { const T = StMary.TOWER; const [x, z] = StMary.towerPt(-T.half - 0.02, T.half - 1.2); const [x2, z2] = StMary.towerPt(-T.half - 0.02, T.half - 2.2); const [ux, uz] = T.u; signQuad(Bn, signs.uv('tower'), x, z, x2, z2, 1.3, 1.95, ux, uz, 0.02);
          const P = StMary.PORCH; signQuad(Bn, signs.uv('tower'), P.at[0] + 3.4, P.at[1] + 0.62, P.at[0] + 4.4, P.at[1] + 0.62, 1.3, 1.95, 0, 1, 0.02); }
        signsMesh(Bn, W, root, 'notices');
      }
      { const Bs = new Batch(), [x, z] = TOUR.board; signQuad(Bs, signs.uv('tours'), x - 0.6, z, x + 0.6, z, 1.0, 2.2, 0, -1, 0.0); signQuad(Bs, signs.uv('tours'), x + 0.6, z + 0.01, x - 0.6, z + 0.01, 1.0, 2.2, 0, 1, 0.0); signsMesh(Bs, W, root, 'tours'); col.addCircle(x, z, 0.35); }
      const yardTable = (S.yard || []).find((y) => y.kind === 'table');
      games = createGames(game, {
        cameraDoor: cam ? cam.door : [408, 156], cameraFacing: cam ? cam.dims.entranceAngle : Math.PI, cameraCentre: cam ? CAMERA_CENTRE : null, cameraA: Camera.CAMERA.A, sights, signs,
        buildReading: (c) => Reading.build(c), cardAt: yardTable ? [yardTable.x + 0.3, yardTable.z, 0.77] : [389.0, 110.0, 0.5],
      });
    } catch (e) { console.error('[radcliffe_square] games', e); }

    // nothing of the Camera's or St Mary's lower parts can be seen from inside the Schools quad (the ranges are 17.6 m)
    { const bq = map.buildings.find((q) => q.id === Bod.ID), hole = bq && bq.holes && bq.holes[0];
      if (hole) { const out = (cam) => cam.position.y > 15 || !pip(cam.position.x, cam.position.z, hole); for (const c of lod.chunks) if (/^camera:sector|^stmary:(nave|porch)/.test(c.name)) c.need = out; } }
    const merged = mergeAll(root, lod, P);
    S.merged = merged.stats;
    // the one LOD draw for every exterior (_rad_lod.js), and its shadow proxy
    const atlasMesh = lod.finish(P.atlas);
    root.add(atlasMesh); S.merged['rad:atlas'] = lod.total;
    const proxy = new THREE.Mesh(lod.proxyGeo(2), new THREE.MeshBasicMaterial({ colorWrite: false }));
    proxy.name = 'rad:shadowProxy'; proxy.castShadow = true; proxy.receiveShadow = false; proxy.visible = false;
    root.add(proxy); S.merged['rad:shadowProxy'] = proxy.geometry.attributes.position.count / 3;
    W.addStatic(root);
    // shadows come from the position-only proxy, drawn in the shadow pass only: the world's own shadow sentinel (first
    // child of the scene, met by the shadow pass first) switches it on, the scene's onAfterRender switches it off
    {
      const sen = game.worldScene.children.find((o) => o.name === 'world:shadowSentinel');
      let lit = false;
      const on = () => { if (lit || !S.proxyOn) return; lit = true; proxy.visible = true; };
      if (sen) { const prevB = sen.onBeforeShadow; sen.onBeforeShadow = function (...a) { if (prevB) prevB.apply(this, a); on(); }; }
      const prev = game.worldScene.onAfterRender;
      game.worldScene.onAfterRender = function (...a) { if (lit) { lit = false; proxy.visible = false; } if (prev) prev.apply(this, a); };
      S.sentinel = !!sen;
    }
    SIGHTS.length = 0; SIGHTS.push(...sights);
    root.traverse((m) => { if (m.isMesh) { m.matrixAutoUpdate = false; m.updateMatrix(); } });

    function tick(dt) {
      if (climb && climb.on) climb.guard();
      if (games) games.update(dt);
      const c = game.camera.position, k = Math.max(0.75, (game.quality && game.quality.dist) || 1);
      lod.update(game.camera, k, W.aerial ? 2.7 : 1);
      // the sun's shadow box is ±60 m round the player: cast only when the player is that close to something we built
      const pp = game.player.place === 'world' ? game.player.pos : c, bx = Math.max(AREA_BB[0] - pp.x, 0, pp.x - AREA_BB[1]), bz = Math.max(AREA_BB[2] - pp.z, 0, pp.z - AREA_BB[3]);
      S.proxyOn = Math.hypot(bx, bz) < 70;
      // painted notices and boards: only within SIGNS_D of one (they are lettering, unreadable further off)
      const sg = root.userData.signs;
      if (sg) { const pts = root.userData.signPts, R2 = (SIGNS_D * k) ** 2, f = game.camera.getWorldDirection(_fwd); let on = false; for (let i = 0; i < pts.length && !on; i += 3) { const dx = pts[i] - c.x, dy = pts[i + 1] - c.y, dz = pts[i + 2] - c.z; on = dx * dx + dy * dy + dz * dz < R2 && dx * f.x + dy * f.y + dz * f.z > -3; } if (sg.visible !== on) sg.visible = on; }
    }
    game.radcliffe = {
      sights, dims: { camera: cam && cam.dims, stmary: sm && sm.dims },
      climb: () => climb, games: () => games,
      debugClimb(on) { return climb ? climb.debug(on) : null; },
      debugEnter(id) { if (climb && climb.on) climb.down(); S.debugFree = true; const d = game.interiors.get(id); return d ? game.interiors.enter(id, d.doors[0]) : null; },
      debugExit() { if (climb && climb.on) climb.down(); if (game.player.place !== 'world' && game.interiors.current) return game.interiors.exit(); return null; },
      lod, stats() {
        let draws = 0, tris = 0;
        root.traverse((m) => { if (m.isMesh && m.visible) { draws++; const g = m.geometry; tris += Math.min(g.index ? g.index.count : g.attributes.position.count, g.drawRange.count) / 3; } });
        const far = !lod.groups.some((g) => g.level === 0 || g.level === 1);
        return { draws, tris: Math.round(tris), built: S.built, merged: S.merged, far, proxyOn: !!S.proxyOn, lod: lod.stats, sentinel: S.sentinel };
      },
    };
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[radcliffe_square]', e); } } } };
  },
};
