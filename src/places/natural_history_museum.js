// Oxford University Museum of Natural History (Deane & Woodward, 1855-60) and the Pitt Rivers Museum behind it,
// c. 2013 — see docs/research/museums.md for what is known and what is guessed.
//
//   preMap   the mapped museum (w25999883) stays the world's for far views, inset 0.45 m and 11.6 m high so it hides
//            inside the hand-built shell, plus a tower added to the map (pyramidal roof) — both in the city's own
//            tiles; the shell is drawn within 300 m (no budget view is nearer). The Pitt Rivers (w99873920) restyled
//            as the yellow-brick gabled hall it is; the Wellingtonia taken out of the city's trees (drawn here, 35 m).
//   install  the front (_mus_nhm_front.js: tower, six bays either side, steep roof, turrets, the court's glass ridges);
//            the lawn: the dinosaur footprint trackway, the Wellingtonia, a notice board; the interiors — the court
//            (_mus_nhm_interior.js) entered by the front door, the Pitt Rivers (_mus_pitt.js) entered only through
//            the arch at the back of the court — both walk-in rooms (core/interiors.js): the Pitt Rivers is a room
//            entered from a room (its portal is `off` the court), dark, with its own lamps and floors, seen through
//            the arch from the court and the court from it. Open 10:00-17:00 (Pitt Rivers to 16:30). Out of hours the
//            front door is locked ("Closed" card) and a rope is across the arch. At closing time nobody is moved:
//            the staff say so, go and stand by the way out, the lights go down in three stages; the way out stays
//            open to anyone inside and shuts behind them (never trapped).
//   play     the museum trail (six exhibits across the three museums; leaflet and prize at the information desks —
//            here and at the Ashmolean), "Please don't touch" attendants who follow you if you keep at it, the T. rex
//            that wobbles if you walk into it, a donation box, borrowing a torch in the Pitt Rivers.
// Test hooks: game.museums (shared with ashmolean.js), game.nhm = { stats(), front, play(), pitt() }   tools/smoke_museums.mjs
import { NORTH } from './_north_kit.js';
import * as THREE from 'three';
import { frame, Geo, museumMats, costOf, buildGeo } from './_mus_kit.js';
import { COURT, PITT_ARCH } from './_mus_nhm_court.js';
import { PITT } from './_mus_pitt_hall.js';
import { buildFront, NHM } from './_mus_nhm_front.js';
import { buildNhmInterior, NHM_IN, NHM_DOOR, nhmPlanSpec } from './_mus_nhm_interior.js';
import { planWalkin, streetDoor, cityDoor, warmLater } from './_walkin_city.js';
import { buildPittInterior, PITT_IN } from './_mus_pitt.js';
import { makePlay, museumsApi, trailDesk } from './_mus_play.js';
import { isOpen, closedNotice, trailState, TRAIL } from './_mus_logic.js';
import { AIR_FAR, airKeep } from './_se_fine.js';

export const IDS = { nhm: 'w25999883', pitt: 'w99873920' };
export const NHM_ID = 'mus_nhm', PITT_ID = 'mus_pitt';
// the front frame: origin = the main door on the front wall line; local +z = out of the front (west), +x = south
export const FRAME = { ox: 275.4, oz: -396.4, th: -1.213 };
export const WELLINGTONIA = { x: 244.4, z: -402, h: 35.5 };
// annexes of the mapped outline beyond the main block (local coords)
const ANNEX = [
  [[29.9, -8.5], [32.3, -7.5], [34.2, -9.6], [34.3, -12.4], [46.8, -12.5], [46.8, -16.4], [46.6, -28.7], [37, -29], [37.4, -36.3], [37.4, -38.4], [29.9, -38.3]],
  [[-29.2, -4.2], [-30.6, -4.1], [-30.5, -9.4], [-34.1, -9.4], [-34, -15.2], [-31.1, -15.1], [-30.7, -35.9], [-29.2, -35.9]],
];
const FAR_DETAIL = 140, NEAR = 300;
export const TOWER_ID = 'mus-nhm-tower', RANGE_ID = 'mus-nhm-range';
/** drop convex corners (cutting inwards only) whose triangle is under maxArea m^2: fewer far-LOD wall quads */
export function cutCorners(P, maxArea) {
  P = P.slice();
  let a2 = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
  const sgn = a2 > 0 ? 1 : -1;
  for (;;) {
    let best = -1, ba = maxArea;
    for (let i = 0; i < P.length && P.length > 4; i++) {
      const a = P[(i + P.length - 1) % P.length], p = P[i], c = P[(i + 1) % P.length];
      const cr = ((p[0] - a[0]) * (c[1] - a[1]) - (p[1] - a[1]) * (c[0] - a[0])) * sgn, ar = Math.abs(cr) / 2;
      if (cr >= 0 && ar < ba) { ba = ar; best = i; }   // convex (or straight): removing it cuts the corner off
    }
    if (best < 0) return P;
    P.splice(best, 1);
  }
}
/** a ring moved inwards by d (mitred, clamped) */
export function insetRing(P, d) {
  let a2 = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
  const sgn = a2 > 0 ? 1 : -1, n = P.length;
  return P.map((p, i) => {
    const a = P[(i + n - 1) % n], c = P[(i + 1) % n];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [c[0] - p[0], c[1] - p[1]], l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const n1 = [-e1[1] / l1 * sgn, e1[0] / l1 * sgn], n2 = [-e2[1] / l2 * sgn, e2[0] / l2 * sgn];
    let bx = n1[0] + n2[0], bz = n1[1] + n2[1]; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
    const k = Math.min(3, 1 / Math.max(0.35, bx * n1[0] + bz * n1[1]));
    return [p[0] + bx * d * k, p[1] + bz * d * k];
  });
}

export const sights = [];

export default {
  id: 'natural_history_museum',
  preMap(game) {
    try {
      const ov = game.overrides, map = game.map;
      // the far view is the world's: the mapped outline drawn inset 0.45 m and 11.6 m high (hidden inside the hand-built
      // shell when near), plus a tower added to the map with a pyramidal roof — both in the city's own tiles, so no
      // view far from the museum gets a draw call more; the hand-built front is drawn within NEAR m only.
      const b = map.buildings.find((q) => q.id === IDS.nhm);
      if (b && !b._musInset) { b._musOrig = b.poly; b.poly = cutCorners(insetRing(b.poly, 0.45), 14); b.roofH = 0.7; b._musInset = true; }
      ov.heights.set(IDS.nhm, 11.6);
      ov.style.set(IDS.nhm, { wall: 'gothic', roof: 'slate', shape: 'gabled', tint: [1.0, 0.94, 0.8], ivy: false });   // a 0.7 m roof: no parapet
      if (!map.buildings.some((q) => q.id === TOWER_ID)) {
        const F = frame(FRAME.ox, FRAME.oz, FRAME.th), poly = [[-3.6, 0.3], [3.6, 0.3], [3.6, -6.9], [-3.6, -6.9]].map(([x, z]) => F.w(x, z));
        map.buildings.push({ id: TOWER_ID, h: 33.5, roofH: 9.5, poly, c: F.w(0, -3.3), tags: { building: 'yes', 'roof:shape': 'pyramidal' } });
        ov.style.set(TOWER_ID, { wall: 'gothic', roof: 'slate', tint: [1.0, 0.94, 0.8], ivy: false });
      }
      // ...and the front range with its steep slate roof, inset inside the shell (eaves 12.8, ridge 20.2 against the
      // shell's 13 / 20.6), so the far stand-in has the museum's silhouette and the swap at 300 m is a change of detail
      if (!map.buildings.some((q) => q.id === RANGE_ID)) {
        const F = frame(FRAME.ox, FRAME.oz, FRAME.th), poly = [[-28.6, -0.55], [29.3, -0.55], [29.3, -10.45], [-28.6, -10.45]].map(([x, z]) => F.w(x, z));
        map.buildings.push({ id: RANGE_ID, h: 20.2, roofH: 7.4, poly, c: F.w(0, -5.5), tags: { building: 'yes', 'roof:shape': 'gabled' } });
        ov.style.set(RANGE_ID, { wall: 'gothic', roof: 'slate', shape: 'gabled', tint: [1.0, 0.94, 0.8], ivy: false });
      }
      // the Abbot's Kitchen (the old chemistry laboratory, after Glastonbury): stone, with its tall pyramidal roof
      const ak = map.buildings.find((q) => q.id === 'w770743340');
      if (ak && !ak._musAk) { ak._musAk = true; ak.roofH = 6.5; ak.tags = { ...ak.tags, 'roof:shape': 'pyramidal' }; ov.heights.set('w770743340', 15.5); ov.style.set('w770743340', { wall: 'gothic', roof: 'slate', shape: 'pyramidal', tint: [1.0, 0.94, 0.8], ivy: false }); }
      ov.style.set(IDS.pitt, { wall: 'brick', roof: 'slate', tint: [1.18, 1.02, 0.74], shape: 'gabled', storeys: 3, up: 'brickBlank', ground: 'brickBlank', first: 'brickBlank', ivy: false });
      ov.heights.set(IDS.pitt, 15);
      // the Wellingtonia: drawn by this module at its real height
      const i = map.trees.findIndex((t) => Math.hypot(t[0] - WELLINGTONIA.x, t[1] - WELLINGTONIA.z) < 1.5);
      if (i >= 0) map.trees.splice(i, 1);
    } catch (e) { console.error('[natural_history_museum] preMap', e); }
  },

  install(game) {
    const W = game.world, F = frame(FRAME.ox, FRAME.oz, FRAME.th), M = museumMats();
    const api = museumsApi(game);
    const S = { err: false, t: 0, closeT: 0, near: true, detail: true };
    // ---------------------------------------------------------------- exterior
    const front = buildFront({ game, frame: F, annexes: ANNEX });
    W.addStatic(front.group);
    const b = game.map.buildings.find((q) => q.id === IDS.nhm);
    if (b) game.worldCollider.addPolygon(b._musOrig || b.poly);   // the shell's own outline (the world collides the inset one)
    // the lawn: footprints, the Wellingtonia, a notice board by the path
    const D = new Geo();
    {
      // the Ardley trackway replicas: three-toed prints in a line across the lawn
      const a = F.w(-22, 34), c = F.w(16, 13), L = Math.hypot(c[0] - a[0], c[1] - a[1]), ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
      const hd = Math.atan2(ux, uz);
      for (let s = 0, k = 0; s < L; s += 1.4, k++) {
        const side = k % 2 ? 0.32 : -0.32, x = a[0] + ux * s + uz * side, z = a[1] + uz * s - ux * side;
        D.at(x, 0.047, z, hd); D.color(0x5a5a52);
        D.poly('paint', [[-0.16, 0, -0.18], [0.16, 0, -0.18], [0.12, 0, 0.08], [-0.12, 0, 0.08]], [0, 1, 0]);
        for (const [tx, tz] of [[-0.24, 0.42], [0, 0.5], [0.24, 0.42]]) D.poly('paint', [[-0.06, 0, 0.02], [0.06, 0, 0.02], [tx, 0, tz]].map((p, j) => (j === 2 ? p : [p[0] + tx * 0.25, 0, p[2]])), [0, 1, 0]);
        D.pop();
      }
      const nb = F.w(-6, 6.4);
      D.at(nb[0], 0, nb[1], F.h(0)); D.color(0x2a3a2a); D.box('paint', -0.6, 0.9, -0.04, 0.6, 1.7, 0.04); D.color(0x3a3a3a); for (const x of [-0.5, 0.5]) D.box('paint', x - 0.04, 0, -0.04, x + 0.04, 0.9, 0.04); D.color(0xe8e0c8); D.box('paint', -0.52, 0.98, 0.04, 0.52, 1.62, 0.05); D.pop();
      game.worldCollider.addCircle(nb[0], nb[1], 0.4);
    }
    // near-only relief of the front (shafts, sills, corbels, portal, crestings) in the same single 'paint' mesh
    D.push(F.matrix()); front.details(D, 'paint'); D.pop();
    const detail = new THREE.Group(); detail.name = 'mus:nhm-lawn';
    D.build({ paint: M.paint }, detail, { name: 'mus-nhm-lawn', cast: false });
    W.addStatic(detail);
    // the Wellingtonia (Sequoiadendron giganteum): spongy red-brown trunk, dense dark conical crown
    const T = new Geo();
    {
      const { x, z, h } = WELLINGTONIA;
      // trees pass (photo comparison item 5: "a toy, fat red trunk, three flat cones"): a dull brown buttressed trunk
      // tapering into the crown, and the crown built of several offset, uneven boughs per tier from 2.6 m up, so the
      // outline is ragged and the foliage reaches down almost to the lawn as on an old specimen
      T.color(0x5e4436); T.cyl('paint', x, 0, z, 0.95, h * 0.82, 9, 0.16, false);
      T.cyl('paint', x, 0, z, 1.35, 1.1, 9, 0.95, false);
      const tiers = 18, base = 2.4, PAL = [0x283f25, 0x2f4729, 0x253a22, 0x3a5530, 0x324d2b];
      for (let i = 0; i < tiers; i++) {
        const t = i / tiers, y0 = base + t * (h - base - 2.2), env = NORTH ? 4.0 * (1 - t) ** 0.62 + 0.5 : 4.6 * (1 - t) ** 0.9 + 0.5, step = (h - base) / tiers;   // (north pass: a column that narrows late, as the real tree)
        { const o = ((i * 5) % 7) / 7 - 0.5, o2 = ((i * 3) % 5) / 5 - 0.5; T.color(PAL[i % 3]); if (NORTH) { const env2 = 4.0 * (1 - (i + 1) / tiers) ** 0.62 + 0.5, hc = (h - base - 2.2) / tiers; T.cyl('paint', x + o * 0.3, y0, z + o2 * 0.3, env * 0.8, hc * 1.04, 8, i === tiers - 1 ? 0.4 : env2 * 0.8, i === tiers - 1); } else T.cyl('paint', x + o * env * 0.4, y0 + o2 * step, z + o2 * env * 0.4, env * (0.45 + 0.15 * ((i * 7) % 3) / 2), step * (1.3 + 0.8 * ((i * 11) % 5) / 4), 6, 0.05, true); }     // the dark core, staggered
        const nb = 2 + Math.round(4 * (1 - t));
        for (let k = 0; k < nb; k++) {
          const hv = ((i * 7 + k * 13) % 11) / 11, a = (k / nb) * 6.283 + i * 0.9, off = env * (0.42 + 0.3 * hv), r = env * (0.3 + 0.18 * ((hv * 7) % 1));
          const hh = step * (1.4 + 0.9 * ((hv * 3) % 1)), sag = 0.35 * r;
          T.color(PAL[(i * 3 + k) % 5]);
          // (north pass, photo "redwood": blunt drooping lumps on a dense column, not upward spikes)
          if (NORTH) T.cyl('paint', x + Math.sin(a) * env * (0.5 + 0.14 * hv), y0 - sag * 0.6, z + Math.cos(a) * env * (0.5 + 0.14 * hv), r * 0.85, hh * 0.5, 6, r * 0.62, true); else T.cyl('paint', x + Math.sin(a) * off, y0 - sag, z + Math.cos(a) * off, r, hh, 6, 0.04, true);
        }
      }
      T.color(0x2a4126); T.cyl('paint', x, h - 2.6, z, 0.9, 2.6, 7, 0.05, true);   // the leader
      game.worldCollider.addCircle(x, z, 1.4);
    }
    const tree = new THREE.Group(); tree.name = 'mus:wellingtonia';
    T.build({ paint: M.paint }, tree, { name: 'mus-wellingtonia', cast: true });
    W.addStatic(tree);

    // ---------------------------------------------------------------- interiors
    const doorW = F.w(0, 1.6);
    const nhmDoor = { pos: doorW, facing: F.h(0), label: 'Enter the Museum of Natural History', locked: () => (isOpen(NHM_ID, game.time.hour) ? false : closedNotice(NHM_ID, game.time.hour)) };
    const pittDoor = { pos: NHM_IN.pitt, from: NHM_ID, facing: 0, label: 'Through to the Pitt Rivers Museum', locked: () => (isOpen(PITT_ID, game.time.hour) ? false : 'The Pitt Rivers is closed for the day. A rope across the door, and a look from the attendant.') };
    let nhm = null, nhmPlay = null, pitt = null, pittPlay = null;
    // Walk-in (core/interiors.js "seamless"; plan and fit: _walkin_city.js): the court in place inside the museum. The
    // shell the room must fit is the mapped outline as it was before preMap inset it, with the tower's front added
    // where the hand-built face stands (NHM_DOOR.proud m forward of the mapped line: measured against the front's mesh).
    // Out of hours the door is locked (it does not open; a "Closed" card on it) instead of the old notice toast.
    let plan = null;
    try {
      const orig = b && (b._musOrig || b.poly);
      if (orig) {
        const shell = []; let bump = false;
        for (const p of orig) {
          const l = F.l(p[0], p[1]);
          if (Math.abs(l[0]) < 3.6 && Math.abs(l[1]) < 0.6) { if (!bump) { bump = true; for (const q of [[3.6, 0], [3.6, NHM_DOOR.proud], [-3.6, NHM_DOOR.proud], [-3.6, 0]]) shell.push(F.w(q[0], q[1])); } continue; }
          shell.push([p[0], p[1]]);
        }
        plan = planWalkin(game, { id: NHM_ID, building: shell, door: { pos: F.w(NHM_DOOR.x, 1.6), facing: F.h(0) }, hours: { open: () => isOpen(NHM_ID, game.time.hour), testShut: 3.5 }, ...nhmPlanSpec() });
        if (plan) streetDoor(game, plan, { every: 45, dwell: [25, 70] });      // (visitors off the lawn path)
      }
    } catch (e) { console.error('[natural_history_museum] plan', e); }
    // (bounds: the inside of the room — the court to its glass ridge, the hall under the tower — so the camera and other
    //  people are placed by where they are: a room with a room off it needs them)
    const nhmDef = game.interiors.register({
      id: NHM_ID, name: 'Museum of Natural History', doors: [nhmDoor], background: 0xc8d4dc, ambient: 0.5,
      seamless: plan && plan.fit.ok ? Object.assign(plan.seamless, { bounds: [{ x0: -COURT.R - 0.2, x1: COURT.R + 0.2, z0: -COURT.R, z1: COURT.R + 0.2, y0: 0, y1: COURT.midRidge }, { x0: -COURT.LW - 0.2, x1: COURT.LW + 0.2, z0: COURT.R, z1: COURT.R + COURT.L, y0: 0, y1: COURT.G1 }] }) : null,
      *build(ctx) {      // (in pieces: core/interiors.js `*build`)
        const SL = !!(ctx.seamless && plan);
        nhm = yield* buildNhmInterior(ctx, game, SL);
        yield;
        if (SL) {
          // the arch to the Pitt Rivers: a rope on two brass posts across it out of hours, and darkness behind it until
          // the Pitt Rivers itself is there to be seen
          const G = new Geo(), z = -COURT.R + 0.3, hw = PITT_ARCH.w / 2 - 0.12;
          G.color(0xb09a5a); for (const sx of [-1, 1]) { G.cyl('paint', sx * hw, 0, z, 0.035, 0.96, 8); G.cyl('paint', sx * hw, 0, z, 0.15, 0.03, 10); G.cyl('paint', sx * hw, 0.96, z, 0.05, 0.05, 8); }
          G.color(0x6a1418); for (let i = 0; i < 8; i++) { const a = -hw + (2 * hw * i) / 8, b = -hw + (2 * hw * (i + 1)) / 8, ya = 0.93 - 0.2 * Math.sin((Math.PI * i) / 8), yb = 0.93 - 0.2 * Math.sin((Math.PI * (i + 1)) / 8); G.beam('paint', [a, ya, z], [b, yb, z], 0.035); }
          rope = new THREE.Group(); rope.name = 'mus:pitt-rope'; buildGeo(G, rope); rope.visible = false; ctx.scene.add(rope);
          dark = new THREE.Mesh(new THREE.PlaneGeometry(PITT_ARCH.w + 0.1, PITT_ARCH.h + 0.1), new THREE.MeshBasicMaterial({ color: 0x060504, name: 'mus-pitt-dark' }));
          dark.name = 'mus:pitt-dark'; dark.position.set(0, PITT_ARCH.h / 2, -COURT.R - PITT_ARCH.depth + 0.02); dark.matrixAutoUpdate = false; dark.updateMatrix(); ctx.scene.add(dark);
        }
        if (SL) nhm.door = cityDoor(ctx, plan, { style: 'oak', heavy: true, hinge: -1, thick: 0.08, setBack: NHM_DOOR.wall - 0.12, open: plan.hours.open });
        else game.interact.add({ place: ctx.id, pos: [NHM_IN.exit[0], 0.1, NHM_IN.exit[1]], radius: 1.6, label: 'Leave the museum', onUse: () => game.interiors.exit() });   // ground floor only (a 3D pos)
        nhmPlay = makePlay(game, ctx, { id: NHM_ID, floors: nhm.floors, touch: nhm.touch, staff: nhm.staff, visitors: nhm.visitors, exhibits: nhm.exhibits,
          donate: { x: NHM_IN.donate[0], z: NHM_IN.donate[1] + 0.6, floor: 0, thanks: ['Thank you! That\'s a vertebra\'s worth.', 'Thank you — the dodo thanks you too, posthumously.', 'Thanks! Spent wisely: on more glue for the T. rex.'] } });
        game.interact.add({ place: NHM_ID, pos: [NHM_IN.desk[0], 0.1, NHM_IN.desk[1] + 0.9], radius: 1.6, label: () => { const t = trailState(game.state.flags); return !t.has ? 'Pick up a museum trail leaflet' : !t.done && t.found.length >= TRAIL.length ? 'Hand in your trail leaflet' : 'Ask at the information desk'; }, onUse: () => trailDesk(game) });
        return { spawn: NHM_IN.spawn, heading: Math.PI };
      },
      onEnter() { if (nhm) { nhm.floors.set(0); game.player.pos.y = game.groundHeight(game.player.pos.x, game.player.pos.z); } },
      update(dt) { try { nhm && nhm.update(dt); nhmPlay && nhmPlay.update(dt); gate(); } catch (e) { if (!S.err) { S.err = true; console.error('[natural_history_museum] nhm', e); } } },
      // (seen from the lawn, or from the Pitt Rivers through the arch: the daylight by the hour, the house lights)
      updateShown() { try { nhm && nhm.light(); gate(); } catch (e) { if (!S.err) { S.err = true; console.error('[natural_history_museum] nhm shown', e); } } },
    });
    // The Pitt Rivers: a walk-in room OFF the court (core/interiors.js: `off`). Its frame is the court's: the arch is in
    // the middle of its south wall (room z = +PITT.Z), PITT_ARCH.depth behind the court's north wall face. It has no
    // opening on the world: it is seen only through the arch, in its own light.
    const pittSL = !!(nhmDef && nhmDef.sl);
    const pittDef = game.interiors.register({
      id: PITT_ID, name: 'Pitt Rivers Museum', doors: [pittDoor], background: 0x060504, ambient: 0.1,
      seamless: pittSL ? {
        portals: [{ at: [0, PITT.Z], out: 0, w: PITT_ARCH.w, h: PITT_ARCH.h, y: 0, depth: PITT_ARCH.depth, off: NHM_ID, offAt: [0, -COURT.R - PITT_ARCH.depth], offOut: 0, offY: 0 }],
        // (it is seen only from the court: its distances are measured from the middle of the COURT — built as you come up
        //  the lawn, never because you walked round the back of the museum)
        openings: [], center: [0, PITT.Z + PITT_ARCH.depth + COURT.R], showR: 24, bounds: [{ x0: -PITT.X - 0.2, x1: PITT.X + 0.2, z0: -PITT.Z - 0.2, z1: PITT.Z, y0: 0, y1: PITT.ridge }],
      } : null,
      build(ctx) {
        pitt = buildPittInterior(ctx, game, ctx.seamless ? { w: PITT_ARCH.w, h: PITT_ARCH.h } : null);
        if (!ctx.seamless) game.interact.add({ place: ctx.id, pos: [PITT_IN.exit[0], 0.1, PITT_IN.exit[1]], radius: 1.6, label: 'Back to the Natural History Museum', onUse: () => game.interiors.exit() });   // ground floor only (a 3D pos)
        pittPlay = makePlay(game, ctx, { id: PITT_ID, floors: pitt.floors, touch: pitt.touch, staff: pitt.staff, visitors: pitt.visitors, exhibits: pitt.exhibits });
        game.interact.add({ place: PITT_ID, pos: [PITT_IN.desk[0], 0.1, PITT_IN.desk[1] - 0.9], radius: 1.6, label: () => (pitt.torch.on ? 'Hand the torch back' : 'Borrow a wind-up torch'),
          onUse: () => { const on = !pitt.torch.on; pitt.torch.set(on); game.ui.toast(on ? 'You wind up the torch. Click-click-click. A small pool of light.' : 'You hand the torch back. Darkness resumes.', 3); } });
        return { spawn: PITT_IN.spawn, heading: Math.PI };
      },
      onEnter() { if (pitt) { pitt.floors.set(0); game.player.pos.y = game.groundHeight(game.player.pos.x, game.player.pos.z); } },
      onExit() { if (pitt && pitt.torch.on) { pitt.torch.set(false); game.ui.toast('You hand the torch back on the way out.', 2.5); } },
      update(dt) { try { pittPlay && pittPlay.update(dt); pitt && pitt.torch.update(game.player); gate(); } catch (e) { if (!S.err) { S.err = true; console.error('[natural_history_museum] pitt', e); } } },
      updateShown() { try { gate(); } catch { /* */ } },
    });
    // The arch between the two: open to walk through only on the ground floor of whichever you are in (both rooms keep
    // their floors on one 2D collider: the gallery above the arch must not find a way through the wall), in the Pitt
    // Rivers' hours — or at any hour to someone inside the Pitt Rivers (they can always leave; the rope goes up behind them).
    let rope = null, dark = null;
    function gate() {
      const P = pittDef && pittDef.sl ? pittDef.sl.portals[0] : null; if (!P) return;
      const pl = game.player.place, pp = game.player.pos;
      // (in hours — or with you still in the arch itself: the court's side of the crossing is the Pitt Rivers' wall face,
      //  PITT_ARCH.depth behind the court's wall, and nobody is shut into the thickness of a wall)
      const hrs = isOpen(PITT_ID, game.time.hour) || (pl === NHM_ID && pp.z < -COURT.R && Math.abs(pp.x) < PITT_ARCH.w / 2 + 0.3);
      P.open = pl === PITT_ID ? !pitt || pitt.floors.cur === 0 : hrs && (pl !== NHM_ID || !nhm || nhm.floors.cur === 0);
      if (rope) rope.visible = !hrs && pl !== PITT_ID;
      if (dark) dark.visible = !(pittDef.sl.shown && (pl === NHM_ID || pl === PITT_ID));
    }
    if (plan && plan.fit.ok) warmLater(game, NHM_ID, { heavy: true });      // (168k triangles: built on the loading screen, not on the walk up the lawn)
    api.register(NHM_ID, { door: nhmDoor, floors: () => nhm && nhm.floors, looks: {} });
    api.register(PITT_ID, { door: pittDoor, parent: NHM_ID, floors: () => pitt && pitt.floors, looks: { heads: { x: PITT_IN.heads[0] - 3.2, z: PITT_IN.heads[1] + 4.6, h: 2.5 } } });

    // ---------------------------------------------------------------- sights
    const at = (x, z) => F.w(x, z);
    const w0 = at(0, 0);
    sights.length = 0;
    sights.push(
      { id: 'nhm-front', name: 'Museum of Natural History', x: w0[0], z: w0[1], blurb: 'Deane and Woodward\'s Gothic cathedral to science (1855-60): six bays either side of the tower, half the carving never finished.' },
      { id: 'nhm-footprints', name: 'Dinosaur footprints', x: at(-3, 24)[0], z: at(-3, 24)[1], blurb: 'Casts of a Megalosaurus trackway from Ardley quarry, set across the front lawn.' },
      { id: 'nhm-wellingtonia', name: 'The Wellingtonia', x: WELLINGTONIA.x, z: WELLINGTONIA.z, blurb: 'A giant sequoia in front of the museum, about 35 m: the tallest thing in central Oxford.' },
      { id: 'nhm-court', name: 'The glass court', x: at(0, -28)[0], z: at(0, -28)[1], blurb: 'A glass roof on iron trees over a stone cloister, each column a different British stone.' },
      { id: 'nhm-trex', name: 'T. rex', x: at(0, -20)[0], z: at(0, -20)[1], blurb: 'A cast of "Stan", rearing up to greet you in the central aisle.' },
      { id: 'nhm-dodo', name: 'The Oxford Dodo', x: at(0, -30)[0], z: at(0, -30)[1], blurb: 'All that is left of a dodo\'s soft tissue anywhere: the bird that made Lewis Carroll a Dodo.' },
      { id: 'nhm-whales', name: 'The whales', x: at(0, -32)[0], z: at(0, -32)[1], blurb: 'Seven whale and dolphin skeletons hung under the glass roof.' },
      { id: 'pitt-rivers', name: 'Pitt Rivers Museum', x: at(4, -66)[0], z: at(4, -66)[1], blurb: 'A dim hall crammed with cases and drawers, reached only through the back of the Natural History Museum. Borrow a torch.' },
      { id: 'pitt-totem', name: 'Haida house post', x: at(4, -78)[0], z: at(4, -78)[1], blurb: 'An eleven-metre carved cedar house post from Haida Gwaii, in Oxford since 1901.' },
    );
    for (const s of sights) api.sights.push(s);

    // ---------------------------------------------------------------- per frame
    // Closing time. Nobody is moved and nothing fades: with you inside after hours the staff say so (three times, flatly),
    // two of them go and stand by the way out, and the lights go down in three stages. The way out is open to anyone
    // inside (the front door opens from inside; the arch has no rope while you are in the Pitt Rivers) and is shut behind
    // you: the front door locked with its "Closed" card, the rope across the arch. Open again at ten.
    const DIM = [1, 0.7, 0.45, 0.22], STAGE_AT = [0, 20, 45], AGAIN = 75;
    const SAY = {
      [NHM_ID]: ['The museum is now closed. The exhibits will be here tomorrow. They have been here some time.', 'This is the second announcement. There is not a third.', 'The lights are going down now. The dinosaurs do not mind. The staff do.', 'The door is behind you. It opens from the inside.'],
      [PITT_ID]: ['The Pitt Rivers closes at half past four. It is now past that.', 'The torch stays. You go. The arch is where you left it.', 'We are turning the cases off. The witch is used to it.', 'The way out is the way in. This has always been the case.'],
    };
    const CL = { [NHM_ID]: { t: 0, stage: 0, k: 1, left: false }, [PITT_ID]: { t: 0, stage: 0, k: 1, left: false } };
    function closeOne(id, dt, inside, play, room, posts) {
      const c = CL[id];
      if (isOpen(id, game.time.hour)) { if (c.stage || c.left) { c.stage = 0; c.t = 0; c.left = false; if (play) for (const q of posts) play.post(q[0], null); } c.target = 1; }
      else if (!inside) { if (c.stage && !c.left) { c.left = true; if (play) for (const q of posts) play.post(q[0], null); } c.target = DIM[3]; }      // (shut, and nobody of ours in it: the cleaners' light)
      else if (play) {
        if (c.left) { c.left = false; c.stage = 0; c.t = 0; }      // (walked back in before the way was shut: it starts again)
        c.t += dt;
        if (c.stage < 3 && c.t >= STAGE_AT[c.stage]) {
          play.say(posts[0][0], SAY[id][c.stage]); c.stage++;
          if (c.stage === 1) for (const q of posts) play.post(q[0], q[1], q[2]);
        } else if (c.stage === 3 && c.t >= STAGE_AT[2] + AGAIN) { c.t = STAGE_AT[2]; play.say(posts[0][0], SAY[id][3]); }
        c.target = DIM[c.stage];
      }
      if (room && c.k !== c.target) { const d = c.target - c.k, st = dt * 0.35; c.k = Math.abs(d) <= st ? c.target : c.k + Math.sign(d) * st; room.dim(c.k); }
    }
    // (staff by index in each room's list: who goes where, by what way — clear of the desk, the donation box and the door's swing)
    const NHM_POSTS = [[0, [[5.6, 16], [5.6, 20.8], [2.6, 21.6], [2.4, 24.6]], Math.PI], [1, [[1.0, 18.6], [-1.6, 21.2], [-3.0, 24.6]], Math.PI]];
    const PITT_POSTS = [[0, [[2.6, 11.2], [2.2, 12.9]], Math.PI]];
    function closing(dt = 0) {
      const pl = game.player.place;
      closeOne(NHM_ID, dt, pl === NHM_ID || pl === PITT_ID, nhmPlay, nhm, NHM_POSTS);      // (the Pitt Rivers is inside the museum: its visitors hear it too)
      closeOne(PITT_ID, dt, pl === PITT_ID, pittPlay, pitt, PITT_POSTS);
    }
    game.nhm = {
      front, frame: F, play: () => nhmPlay, pitt: () => pitt, pittPlay: () => pittPlay, inside: () => nhm, plan: () => plan,
      stats() {
        const out = { exterior: costOf(front.group), lawn: costOf(detail), tree: costOf(tree), detail: S.detail };
        if (nhm) out.court = costOf(game.interiors.get(NHM_ID).scene);
        if (pitt) out.pitt = costOf(game.interiors.get(PITT_ID).scene);
        return out;
      },
      closing, closeState: () => CL, rope: () => rope, pittDef: () => pittDef,
    };
    function tick(dt) {
      if (nhm || pitt) closing(dt);
      const cam = game.camera.position, out = game.player.place === 'world';
      // from a glider (W.aerial) the near work goes by 3D distance and the hand-built front stays on out to AIR_FAR
      // (cull.js keeps it: airKeep below), so the museum does not drop to the map's plain stand-in under the wing
      const air = !!(W && W.aerial), dy = air ? cam.y : 0;
      const d = Math.hypot(cam.x - FRAME.ox, cam.z - FRAME.oz, dy);
      const det = out && d < FAR_DETAIL;
      if (det !== S.detail) { S.detail = det; detail.visible = det; }
      const dc = Math.hypot(cam.x - 300, cam.z + 405);
      const near = out && (dc < NEAR || (air && dc < AIR_FAR));
      if (near !== S.near) { S.near = near; front.group.visible = near; tree.visible = near; }
    }
    airKeep([...Object.values(front.meshes), ...detail.children, ...tree.children]);
    tick(0);
    return { update(dt) { try { tick(dt); } catch (e) { if (!S.err) { S.err = true; console.error('[natural_history_museum]', e); } } } };
  },
};
