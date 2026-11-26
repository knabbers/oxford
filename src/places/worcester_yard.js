// Worcester College, Provost's Yard and the Provost's Lodgings (2026-11-22; package A, items A9 and A10 of
// docs/research/worcester_survey.md), hand-built in the college's atlas in place of the city generator's sash-window
// boxes (which stood 6 - 8 m too tall round the yard and gave the Lodgings no garden front):
//
//   Besse Building        (1955; the yard's north range) two low storeys under hipped stone slates, and THE ARCHWAY
//                         through it from the Orchard: a real ground-floor passage 3.5 m wide and 3.05 m high, flat
//                         soffit with its bulkhead light, ashlar walls solid either side, stone kerbs, setts, the
//                         floor above and the roof carried over. (The owner: "the path goes UNDER the building to get
//                         through to the orchard … there's a whole floor above it which should stay.")
//   the west range        the tall block of the old kitchen (the War Memorial Room, "M": the walk-in room
//                         _worcint_memorial.js stands in it) and south of it the low stone-slated range with two tall
//                         sashes ("R", the Rose Garden Room) and its little pedimented entrance.
//   Coach House           (the east range, former stables) one low storey, three rooflights, a flat-roofed end.
//   the veranda           a lead flat on slender wooden columns along the Terrace's foot (the bottom of Staircase 6)
//                         and up the east side.
//   the yard              tarmac, timber planters, the Wollemi pine in its square planter by the arch.
//   Provost's Lodgings    (Henry Keene, 1773-76) the garden front with its pedimented centre, relieving arch and
//                         horseshoe stair; the south side; the black front door at the end of the terrace walk.
//
// The plan, how it was measured, and what is KNOWN (K) or a GUESS (G) attribute by attribute: _worcester_yard_plan.js.
// The Terrace is not built here (its plan: _worcester_shared.js WORC_TERRACE): the veranda stands against its north
// face, the Lodgings join its west end. Heights are above the drawn ground at the site (YARD_LEVELS says what that
// leaves wrong until the terrain draws the yard 2.7 m below the terrace walk).
// `?wyard=0` (node: GTO_WYARD=0) turns the pass off for before / after pictures of the outside.
import * as THREE from 'three';
import { Batch, makePack, frame } from './_worcester_kit.js';
import { YARD, LODG, YARD_ON as ON, YARD_IDS as IDS, YARD_LEVELS, YARD_RINGS, YARD_GROUND, YARD_WAYS, YARD_MARKS, YARD_FRAME as FR, MEM_SHELL, CHECKED, ATTR, L2W, W2L } from './_worcester_yard_plan.js';
import { buildNorth, buildWest, buildEast, buildVeranda, buildFurniture } from './_worcester_yard_build.js';
import { buildLodgings, stairRing } from './_worcester_yard_lodgings.js';

export { CHECKED, ATTR };
const ringW = (ring) => ring.map(([u, v]) => { const p = L2W(u, v); return [+p[0].toFixed(3), +p[1].toFixed(3)]; });
const grow = (ring, d) => { const c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]); return ring.map((p) => { const l = Math.hypot(p[0] - c[0], p[1] - c[1]) || 1; return [p[0] + ((p[0] - c[0]) / l) * d, p[1] + ((p[1] - c[1]) / l) * d]; }); };

export default {
  id: 'worcester_yard',
  site: { x: -300, z: -24, r: 45 },      // (for the crop switch, core/_crop.js)
  preMap(game) {
    if (!ON) return;
    try {
      const ov = game.overrides, map = game.map, P = YARD.pass, N = YARD.north;
      ov.skip.add(IDS.ranges); ov.skip.add(IDS.lodgings);
      // ground: ordinary map areas, so the city's ground draws them (and the drawn terrain will carry them)
      if (map && map.areas) {
        map.areas.push({ id: 'worc:yard:tarmac', kind: 'paved', surface: 'asphalt', poly: ringW(YARD_GROUND.asphalt) });
        map.areas.push({ id: 'worc:yard:veranda', kind: 'paved', surface: 'paving_stones', poly: ringW(YARD_GROUND.flags) });
        map.areas.push({ id: 'worc:yard:setts', kind: 'paved', surface: 'sett', poly: ringW(YARD_GROUND.setts) });
      }
      // the mapped paths: through the archway where it is (the map has it a metre west, inside the west wall), across
      // the yard to the door of Staircase 6, and the Orchard's path up to the archway's mouth
      if (map && map.roads) {
        const road = (id) => map.roads.find((r) => r.id === id), s6 = (YARD.stair6Door.u0 + YARD.stair6Door.u1) / 2;
        const a = road(IDS.passage); if (a) { a.pts = [L2W(P.uc, N.v0 - 2.1), L2W(P.uc, N.v1 + 0.3)]; a.surface = 'sett'; a.w = 2.6; }
        const b = road(IDS.yardPath); if (b) { b.pts = [L2W(P.uc, N.v1 + 0.3), L2W(-38.9, -36.0), L2W(s6, YARD.veranda.vEdge - 0.3)]; b.surface = 'asphalt'; }      // (to the veranda's edge: a strip of tarmac is not drawn across its flags)
        const c = road(IDS.orchardPath); if (c && c.pts && c.pts.length) { const e = c.pts[c.pts.length - 1], l = W2L(e[0], e[1]); if (Math.abs(l[0] + 40.9) < 2 && Math.abs(l[1] + 60.3) < 2.5) c.pts[c.pts.length - 1] = L2W(P.uc, N.v0 - 2.1); }
      }
    } catch (e) { console.error('[worcester_yard] preMap', e); }
  },
  install(game) {
    if (!ON) return null;
    const world = game.world;
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    // colours the college's atlas did not have: tinted copies of its cells
    const K = pack.cells, cell = (key, from, tint, o = {}) => { if (K && K.get(from) && !K.get(key)) K.set(key, { ...K.get(from), tint: Array.isArray(tint) ? tint : lin(tint), ...o }); };
    cell('wyOld', 'rubble', [1.34, 1.24, 1.02]); cell('wyRock', 'rubble', [1.36, 1.24, 0.98], { seed: 0 });      // (the photographs: warm buff coursed stone, a shade lighter than the Cottages' rubble)
    cell('wyCol', 'grey', 0x68717b); cell('wyFascia', 'lead', 0x5d6165); cell('wyPlanter', 'boards', 0x8f8676); cell('wyGroove', 'plaster', 0x8f8263);
    const M = { _pack: pack }, B = new Batch();
    const grp = new THREE.Group(); grp.name = 'worcester-yard';
    world.addStatic(grp);
    B.push(frame(FR.c0[0], 0, FR.c0[1], FR.cos, -FR.sin));      // the college's local frame: x = u, z = v
    const built = {}, lamps = [];
    const parts = [['Besse Building', buildNorth], ['west range', buildWest], ['Coach House', buildEast], ['veranda', buildVeranda], ['yard', buildFurniture], ['Provost\'s Lodgings', buildLodgings]];
    for (const [what, fn] of parts) {
      const n0 = B.tris(), depth = B.stack.length;
      try { const r = fn(game, B, world); if (r && r.lamps) lamps.push(...r.lamps); } catch (e) { console.error('[worcester_yard] ' + what, e); while (B.stack.length > depth) B.pop(); }
      built[what] = Math.round(B.tris() - n0);
    }
    B.pop();
    // generated trees and street furniture that would stand in what is now built or paved go
    if (world.clearArea) for (const ring of [...Object.values(YARD_RINGS), YARD_GROUND.asphalt, YARD_GROUND.flags, YARD_GROUND.setts, stairRing()]) { try { world.clearArea(ringW(grow(ring, 0.6))); } catch (e) { /* */ } }
    // every lamp modelled here gives its own light at night
    // The follow camera knows walls but not ceilings: walking through the archway it would ride above the soffit and
    // look down through the floor above; under the veranda it would sit on the lead flat. As worcester.js does in its
    // two tunnels (game.cameraHook, chained): the follow camera does its work, then is held under whatever cover it is
    // in — or, while only the player is under cover, brought down to look in under the lintel or the eaves.
    {
      const P = YARD.pass, N = YARD.north, V = YARD.veranda, yv = V.beam - 0.3;
      const COVERS = [
        { u0: P.u0, u1: P.u1, v0: N.v0, v1: N.v1, y: P.h - 0.3 },
        { u0: V.u0, u1: V.u1, v0: V.vEdge, v1: YARD.vT, y: yv }, { u0: V.ret.uEdge, u1: V.u1, v0: V.ret.v0, v1: V.vEdge, y: yv },
      ];
      const coverAt = (x, z, m = 0) => { const [u, v] = W2L(x, z); for (const c of COVERS) if (u > c.u0 - m && u < c.u1 + m && v > c.v0 - m && v < c.v1 + m) return c; return null; };
      const prevHook = game.cameraHook;
      if (typeof game._followCamera === 'function') game.cameraHook = (dt, cam) => {
        if (prevHook && prevHook(dt, cam)) return true;
        const p = game.player;
        if (!p || p.place !== 'world' || p.vehicle || game.activity || game.firstPerson) return false;
        const pc = coverAt(p.pos.x, p.pos.z, 0.2);
        if (!pc && !coverAt(cam.position.x, cam.position.z)) return false;
        game._followCamera(dt);
        if (game._fp) return true;
        const cc = coverAt(cam.position.x, cam.position.z) || pc;
        if (cc && cam.position.y > p.pos.y + cc.y) { cam.position.y = p.pos.y + cc.y; cam.lookAt(p.pos.x, p.pos.y + 1.4, p.pos.z); }
        return true;
      };
      game.worcesterYardCovers = COVERS;
    }
    // two chunks, so that culling still drops the Lodgings from the yard and the yard from the garden
    // THE DRAWN GROUND (world/terrain.js: every vertex is lifted by the surveyed height under it). The yard and the
    // garden lie 2.7 - 3.1 m below the college's level core, and the drawn ground climbs to the core in a rim a few
    // metres wide along the Terrace's foot and under the Lodgings' east side: a building standing across that rim
    // would be sheared. So each vertex is built lower by what the ground under it stands above the building's own
    // ground: the Lodgings wholly rigid on the garden at the foot of its stair; the yard's buildings and the veranda
    // held down to the yard's level wherever the ground under them is higher (the rim, the Coach House's garden side).
    const TH = typeof world.terrainHeight === 'function' ? (x, z) => { const h = world.terrainHeight(x, z); return Number.isFinite(h) ? h : 0; } : null;
    const lodgRef = L2W(LODG.u0 - LODG.centre.out - LODG.stair.out - 0.6, (LODG.v0 + LODG.v1) / 2), yardRef = L2W(YARD_MARKS.yardMid[0], YARD_MARKS.yardMid[1]);
    const gLodg = TH ? TH(lodgRef[0], lodgRef[1]) : 0, gYard = TH ? TH(yardRef[0], yardRef[1]) : 0;
    const sink = (x, z) => (!TH ? 0 : W2L(x, z)[0] < YARD.uLodg + 0.7 ? gLodg - TH(x, z) : Math.min(0, gYard - TH(x, z)));
    const meshes = B.build(M, grp, { pack, chunk: (x, z) => (W2L(x, z)[0] < YARD.uLodg + 0.7 ? 1 : 0), base: TH ? (x, z) => sink(x, z) : undefined });
    if (TH) for (const m of meshes) {
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + sink(p.getX(i), p.getZ(i)));
      p.needsUpdate = true; m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox(); m.geometry.userData.terrainDraped = true;      // (sunk per vertex to stand level: the world's draping pass must leave it alone — the terrain builder)
    }
    for (const l of lamps) { const q = L2W(l[0], l[2]); l[1] += sink(q[0], q[1]); }
    for (const [u, y, v] of lamps) { const p = L2W(u, v); try { if (world.addLampGlow) world.addLampGlow(p[0], y, p[1]); } catch (e) { /* */ } }
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
    game.worcesterYard = { on: true, ground: { lodgings: gLodg, yard: gYard, sink }, group: grp, tris, meshes: meshes.length, built, lamps, checked: CHECKED, attr: ATTR, plan: YARD, lodgings: LODG, memorial: MEM_SHELL, levels: YARD_LEVELS, rings: YARD_RINGS, ways: YARD_WAYS, marks: YARD_MARKS };
    console.log(`[gto] worcester_yard: ${meshes.length} meshes, ${Math.round(tris)} triangles`, JSON.stringify(built));
    return null;
  },
};
