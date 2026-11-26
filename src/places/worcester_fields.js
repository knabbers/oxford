// Worcester College, the playing fields (2026-11-22; work package J of docs/research/worcester_survey.md: G08, B25):
//   the pavilion     (c. 1900) rebuilt from its three photographs: the tall hipped roof of orange-red tiles over a
//                    veranda on white posts, the clock gablet, a dormer on each end hip, the brick stack, dark
//                    grey-green boarding, brick steps, the black scoreboard; the veranda can be walked onto and its
//                    benches sat on.
//   tennis           three hard courts inside their 2.74 m green chain-link fence (three gates, a dividing curtain),
//                    as the 2014 planning drawings have them; the gardeners' machinery shed outside its north-west
//                    side (21 x 5.5 m, mono-pitch roof, five pairs of timber doors); the two-lane cricket net cage
//                    beyond its north-east end.
//   the field        a mown lawn in broad bands (it was rough park grass with daisies); in its Michaelmas state: the
//                    cricket table roped off where the owner's bird's-eye picture has it, a rugby pitch with white
//                    lines and an H at each end, the white sight screen wheeled to the edge.
//   _wfield_plan.js   frames, sizes, LV (every height), TEMPORARY, CHECKED (K / G); pure (tools/smoke_worc_fields.mjs)
//   _wfield_build.js  what is drawn
// The croquet lawn (places/_grounds_croquet.js) and the birds are places/worcester_grounds.js's as before; its own
// pavilion, cricket square, rugby posts and tennis courts stand down when this module is on.
// `?wfield=0` (node: GTO_WFIELD=0) = the fields as they were.
import * as THREE from 'three';
import { Batch, makePack } from './_worcester_kit.js';
import * as P from './_wfield_plan.js';
import { cells, buildFields, Nets, scoreboardTexture } from './_wfield_build.js';

export const CHECKED = P.CHECKED, TEMPORARY = P.TEMPORARY;
const grow = (ring, d) => { const c = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]; return ring.map((p) => { const l = Math.hypot(p[0] - c[0], p[1] - c[1]) || 1; return [p[0] + ((p[0] - c[0]) / l) * d, p[1] + ((p[1] - c[1]) / l) * d]; }); };

export default {
  id: 'worcester_fields',
  preMap(game) {
    if (!P.ON || game.worcesterFields) return;
    try {
      const map = game.map, ov = game.overrides; if (!map || !map.areas) return;
      const area = (id) => map.areas.find((a) => a.id === id);
      const field = area(P.IDS.field), courts = P.IDS.courts.map(area), pb = map.buildings.find((b) => b.id === P.IDS.pavilion);
      if (!field || courts.some((c) => !c || !c.poly || c.poly.length !== 4) || !pb) { console.warn('[worcester_fields] the map is not the one this was drawn for: left alone'); return; }
      const T = P.tennisLayout(courts.map((c) => c.poly)), R = P.rugbyLayout(field.poly), pav = P.pavFrame(pb.poly), V = P.PAV, S = P.SHED;
      field.kind = 'grass';      // a mown college lawn (K: every picture of it); it was park grass with tufts and daisies
      ov.skip.add(P.IDS.pavilion); for (const id of P.IDS.courts) ov.skip.add(id);
      const cg = P.cageAB(), W = (a, b) => T.F.pt(a, b);
      const rings = {
        tennis: T.ring, shed: [W(T.shedA0 - 0.4, -S.gap - S.w - 0.5), W(T.shedA0 + S.len + S.hard, -S.gap - S.w - 0.5), W(T.shedA0 + S.len + S.hard, 0), W(T.shedA0 - 0.4, 0)],
        cage: [W(cg[0], cg[2]), W(cg[1], cg[2]), W(cg[1], cg[3]), W(cg[0], cg[3])],
        pavilion: [pav.pt(-V.L / 2, -V.D / 2 - V.rear.d), pav.pt(V.L / 2, -V.D / 2 - V.rear.d), pav.pt(V.L / 2, V.front + 1.4), pav.pt(-V.L / 2, V.front + 1.4)],
      };
      // nothing wild grows where something is built (systems/_flora_plan.js leaves a skipped area alone)
      Object.entries(rings).forEach(([k, poly]) => { const id = 'worc:site-field-' + k; if (!area(id)) { map.areas.unshift({ id, kind: 'paved', poly }); ov.skip.add(id); } });
      // the white sight screen, wheeled to the north edge beside the nets, its face to the table
      const sc = W(50, 44), tn = [P.TABLE.c[0] - sc[0], P.TABLE.c[1] - sc[1]], tl = Math.hypot(tn[0], tn[1]), screen = { c: sc, dir: [tn[1] / tl, -tn[0] / tl] };
      const big = { tennis: grow(rings.tennis, 1.2), shed: grow(rings.shed, 1.0), cage: grow(rings.cage, 0.8), pavilion: grow(rings.pavilion, 1.0) };
      /** where no tree, bench or reed of another module may stand */
      const keep = (x, z) => Object.values(big).some((r) => P.pip(x, z, r)) || R.posts.some((q) => Math.hypot(x - q.p[0], z - q.p[1]) < 4.5) || Math.hypot(x - sc[0], z - sc[1]) < 4;
      game.worcesterFields = { on: true, T, R, pav, rings, keep, screen, field: field.poly };
    } catch (e) { console.error('[worcester_fields] preMap', e); }
  },
  install(game) {
    const WF = game.worcesterFields; if (!P.ON || !WF || !WF.on) return null;
    const world = game.world, col = game.worldCollider, { T, R, pav } = WF, V = P.PAV, LV = P.LV;
    const pack = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
    cells(pack);
    const B = new Batch(), N = new Nets(), grp = new THREE.Group(); grp.name = 'worcester-fields';
    world.addStatic(grp);
    const { built, out } = buildFields(B, N, { pav, field: WF.field, T, R, screen: WF.screen });
    // (two chunks: the pavilion's end and the courts' end, 150 m apart)
    const meshes = B.build({ _pack: pack }, grp, { pack, chunk: (x, z) => (x < -548 && z < -112 ? 1 : 0) });
    const nets = N.mesh(); if (nets) { grp.add(nets); meshes.push(nets); }
    try {      // the scoreboard's lettering
      const b = V.board, c = pav.pt((b.s0 + b.s1) / 2, V.front + 0.055), m = new THREE.Mesh(new THREE.PlaneGeometry(b.s1 - b.s0 - 0.08, b.y1 - b.y0 - 0.08), new THREE.MeshBasicMaterial({ map: scoreboardTexture(), toneMapped: true }));
      m.name = 'worcester-fields:scoreboard'; m.position.set(c[0], (b.y0 + b.y1) / 2, c[1]); m.rotation.y = Math.atan2(pav.bx, pav.bz); m.matrixAutoUpdate = false; m.updateMatrix(); grp.add(m); meshes.push(m);
    } catch (e) { console.error('[worcester_fields] scoreboard', e); }
    const tris = meshes.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);

    // ================================================================= colliders: what is drawn is what is solid
    const seg = (p, q, o) => col.addSegment(p[0], p[1], q[0], q[1], o), L2 = V.L / 2, D2 = V.D / 2, rs = V.room[1];
    { const body = [[-L2, -D2], [L2, -D2], [L2, V.back], [rs, V.back], [rs, V.front], [-L2, V.front]].map((q) => pav.pt(q[0], q[1])), sg = col.addPolygon(body, { tag: 'building' }); if (sg) for (const s of sg) s.h = LV.eaves;
      const Rr = V.rear, sr = col.addPolygon([[Rr.s0, -D2 - Rr.d], [Rr.s1, -D2 - Rr.d], [Rr.s1, -D2], [Rr.s0, -D2]].map((q) => pav.pt(q[0], q[1])), { tag: 'building' }); if (sr) for (const s of sr) s.h = Rr.h;
      seg(pav.pt(L2, V.back), pav.pt(L2, V.front), { tag: 'wall' });      // the boarded screen at the veranda's west end
      for (const i of [0, 1, 2, 6, 7]) seg(pav.pt(V.posts[i], V.front - 0.1), pav.pt(V.posts[i + 1], V.front - 0.1), { tag: 'railing' });      // (full height: the floor behind is 0.76 m up)
      const st = V.steps; for (const e of [-1, 1]) seg(pav.pt(st.c + e * st.w / 2, V.front), pav.pt(st.c + e * (st.w / 2), V.front + st.n * st.tread), { tag: 'railing', low: true });
      for (const i of [3, 4, 5, 6]) col.addCircle(...pav.pt(V.posts[i], V.front - 0.1), 0.09, { tag: 'furniture' }); }
    const tn = out['tennis courts and fence'] || {};
    for (const [p, q] of tn.solid || []) { const s = seg(p, q, { tag: 'fence' }); if (s) s.h = LV.fence; }
    for (const p of tn.posts || []) col.addCircle(p[0], p[1], 0.08, { tag: 'furniture' });
    for (const [ca, cb] of T.courts) seg(T.F.pt(ca, cb - 10.97 / 2 - 0.9), T.F.pt(ca, cb + 10.97 / 2 + 0.9), { tag: 'railing', low: true });      // the nets
    { const sh = out['machinery shed']; if (sh && sh.ring) { const sg = col.addPolygon(sh.ring, { tag: 'building' }); if (sg) for (const s of sg) s.h = LV.shedLo; } }
    for (const [p, q] of (out['cricket nets'] || {}).solid || []) { const s = seg(p, q, { tag: 'fence' }); if (s) s.h = LV.cage; }
    for (const q of R.posts) for (const p of [q.l, q.r]) col.addCircle(p[0], p[1], 0.2, { tag: 'furniture' });
    { const s = WF.screen; col.addBox(s.c[0], s.c[1], 4.7, 1.9, -Math.atan2(s.dir[1], s.dir[0]), { tag: 'furniture' }); }

    // ================================================================= walkable heights: the veranda and its steps
    const prev = world.groundHeight.bind(world), po = pav.o;
    world.groundHeight = (x, z) => { if (Math.abs(x - po[0]) < 11 && Math.abs(z - po[1]) < 11) { const q = pav.inv(x, z), h = P.pavGroundY(q[0], q[1]); if (h !== null) return h; } return prev(x, z); };
    // the two benches on the veranda can be sat on (they face the field)
    const seats = [];
    for (const [s, len] of [[2.15, 1.7], [-2.15, 1.5]]) {
      const p = pav.pt(s, V.back + 0.5), h = Math.atan2(pav.bx, pav.bz), rec = { x: p[0], z: p[1], y: LV.floor, h, kind: 'bench', set: null, i: -1, it: { gone: false, taken: false }, len }; seats.push(rec);
      col.addBox(p[0], p[1], len, 0.5, h, { tag: 'furniture', low: true });
      if (game.interact && game.interact.add) game.interact.add({ pos: [p[0] + pav.bx * 0.55, p[1] + pav.bz * 0.55], radius: 1.5, label: 'Sit down', enabled: () => !!(game.sitting && game.sitting.sit && !game.sitting.seated && !game.activity), onUse: () => { try { game.sitting.sit(rec); } catch (e) { /* */ } } });
    }
    // generated trees, lamps and benches where something now stands
    if (world.clearArea) for (const r of [grow(WF.rings.tennis, 1.5), grow(WF.rings.shed, 1.5), grow(WF.rings.cage, 1), grow(WF.rings.pavilion, 1.5)]) { try { world.clearArea(r); } catch (e) { /* */ } }

    Object.assign(WF, { tris, meshes: meshes.length, built, checked: CHECKED, temporary: TEMPORARY, plan: P, group: grp, seats, groundY: (x, z) => { const q = pav.inv(x, z); return P.pavGroundY(q[0], q[1]); } });
    console.log(`[gto] worcester_fields: ${meshes.length} meshes, ${Math.round(tris)} triangles`, JSON.stringify(built));
    const pp = game.player.pos; let vis = true;
    return { id: 'worcester_fields', update() { const e = game.eye || pp, dx = e.x + 540, dz = e.z + 110, show = game.player.place === 'world' && dx * dx + dz * dz < 600 * 600; if (show !== vis) { vis = show; grp.visible = show; } } };
  },
};
