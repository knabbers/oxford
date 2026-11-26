// The Natural History Museum court as an interior: layout of the exhibits (the T. rex and the Iguanodon greeting you
// in the central aisle, the Dodo and the central-aisle cases, rows of cases in the side aisles, the whales overhead,
// statues of scientists against the piers, the observation beehive in the upper gallery), the floors (the gallery
// is reached by the stair in the west arcade), lights, labels, NPCs and the touch / trail hooks. The architecture is
// _mus_nhm_court.js, the skeletons _mus_skeletons.js.
import * as THREE from 'three';
import { Geo, museumMats, buildGeo, displayCase, statue, plaque, Labels, labelMaterial, CELL } from './_mus_kit.js';
import { buildCourt, COURT } from './_mus_nhm_court.js';
import { buildSkeletons } from './_mus_skeletons.js';
import { Floors } from './_mus_logic.js';

export const NHM_IN = {
  spawn: [0, 24.6], exit: [0, 25.2], pitt: [0, -20.6],
  trex: { x: 2.9, z: 8.4, h: 0 }, igu: { x: -2.7, z: 9.6, h: 0 },
  dodo: [0, -1.5], desk: [3.0, 19.6], donate: [-2.6, 19.8], hive: [20.6, 0],
};
export const STATUES = ['Aristotle', 'Hippocrates', 'Francis Bacon', 'Galileo', 'Isaac Newton', 'Leibniz', 'Linnaeus', 'Charles Darwin', 'William Harvey', 'Joseph Priestley', 'Humphry Davy', 'Hans Christian Oersted'];

/** build(ctx, game) -> { floors, touch, exhibits, staff, visitors, trex, dims, lights } */
/**
 * The court as a walk-in room. The mapped museum is 59 m wide and 52.5 m deep behind the tower's front (hand-built
 * face 0.70 m forward of the mapped front line); the court of the game — the 43 m square with its 8 x 4.6 m hall under
 * the tower — sits inside it as it is (clearance 7 m at the sides, 4 m at the back), so nothing was re-proportioned.
 * The street door is the NORTH leaf of the great pair (the other leaf is drawn shut): 1.45 m wide, 3.4 m to the
 * springing of the arch, through a wall 1.0 m thick (GUESS: the depth of the tower's portal).
 */
export const NHM_DOOR = { x: -0.725, w: 1.45, h: 3.4, wall: 1.0, proud: 0.7 };
export const nhmPlanSpec = () => ({ portal: { at: [NHM_DOOR.x, COURT.R + COURT.L], out: 0, w: NHM_DOOR.w, h: NHM_DOOR.h }, wall: NHM_DOOR.wall, snap: false,
  rects: [[-COURT.R, -COURT.R, COURT.R, COURT.R], [-COURT.LW, COURT.R, COURT.LW, COURT.R + COURT.L]],
  mid: [0, 15.5], route: [[-0.7, 23.5], [0, 19.5]] });
// (a generator: core/interiors.js builds a room a piece a frame, left at each `yield`)
export function* buildNhmInterior(ctx, game, walkin = false) {
  const sc = ctx.scene, col = ctx.collider, K = COURT, C = K.C, R = K.R, I = NHM_IN;
  // (walk-in — core/interiors.js "seamless": `walkin` = the real doorway in the front wall, see NHM_DOOR)
  const court = yield* buildCourt({ scene: sc, game, walkin: walkin ? { x0: NHM_DOOR.x - NHM_DOOR.w / 2, x1: NHM_DOOR.x + NHM_DOOR.w / 2, h: NHM_DOOR.h, depth: NHM_DOOR.wall } : null, pitt: !!walkin });
  yield;
  // (the room's own soft lights, core/interiors.js _build: they go down with the house lights at closing time)
  const amb = sc.children.filter((o) => o.isAmbientLight || o.isHemisphereLight), amb0 = amb.map((l) => l.intensity);
  let dimK = 1;
  const sk = yield* buildSkeletons({});
  yield;
  const floors = new Floors([0, K.G1]);
  floors.ramp({ b: 0, x0: K.stair.x0, x1: K.stair.x1, z0: K.stair.z0, z1: K.stair.z1, axis: 'z', lo: K.stair.z1 });
  ctx.setGround((x, z) => floors.ground(x, z));
  const W = (ks, s) => floors.walls(ks, s);

  // ---------------------------------------------------------------- walls / colliders
  // outer box with the entrance hall
  col.addPolyline([[K.LW, R], [R, R], [R, -R], [-R, -R], [-R, R], [-K.LW, R]]);
  col.addPolyline([[-K.LW, R], [-K.LW, R + K.L], [K.LW, R + K.L], [K.LW, R]]);
  W([1], col.addSegment(-K.LW, R, K.LW, R));                                             // no entrance hall upstairs
  // ground floor: the court piers and the iron columns
  for (const p of court.dims.piers) W([0], col.addCircle(p.x, p.z, 0.32));
  for (const [x, z] of court.dims.cols) W([0], col.addCircle(x, z, 0.32));
  // the stair lane: side wall (both floors), caps at the ends that are not walkable from each floor
  const S = K.stair;
  W([0, 1], col.addSegment(S.x1 + 0.1, S.z0, S.x1 + 0.1, S.z1));
  W([0], col.addSegment(S.x0, S.z0, S.x1, S.z0));
  W([1], col.addSegment(S.x0, S.z1, S.x1 + 0.1, S.z1));
  // gallery parapet round the court (upstairs)
  W([1], col.addPolyline([[-C, -C], [C, -C], [C, C], [-C, C], [-C, -C]]));

  // ---------------------------------------------------------------- the skeletons
  const touch = [], exhibits = [];
  const place = (g, x, z, h) => { g.position.set(x, 0, z); g.rotation.y = h; sc.add(g); };
  place(sk.trex, I.trex.x, I.trex.z, I.trex.h); sk.trex.matrixAutoUpdate = true;
  place(sk.iguanodon, I.igu.x, I.igu.z, I.igu.h);
  sk.whales.position.set(0, 0, 0); sc.add(sk.whales);
  const tp = sk.dims.trex.plinth, ip = sk.dims.iguanodon.plinth;
  const wob = { a: 0, t: 0 };
  W([0], col.addBox(I.trex.x, I.trex.z + sk.dims.trex.centre[1], tp[0], tp[1], 0));
  W([0], col.addBox(I.igu.x, I.igu.z + sk.dims.iguanodon.centre[1], ip[0], ip[1], 0));
  touch.push({ x: I.trex.x, z: I.trex.z + sk.dims.trex.centre[1], w: tp[0], d: tp[1], floor: 0, name: 'T. rex', onTouch: () => { wob.a = Math.min(1.2, wob.a + 0.8); } });
  touch.push({ x: I.igu.x, z: I.igu.z + sk.dims.iguanodon.centre[1], w: ip[0], d: ip[1], floor: 0, name: 'Iguanodon' });
  yield;

  // ---------------------------------------------------------------- cases, statues, labels
  const G = new Geo(), Lb = new Labels(40);
  const caseAt = (x, z, rot, o, floor = 0, name = 'case') => {
    const y = floor ? K.G1 : 0;
    const f = displayCase(G, x, z, rot, { ...o, y });
    W([floor], col.addBox(f[0], f[1], f[2] + 0.1, f[3] + 0.1, rot));
    touch.push({ x, z, w: f[2], d: f[3], rot, floor, name });
  };
  // central aisle: the Dodo case, Buckland's finds, Oxfordshire dinosaurs, minerals
  caseAt(I.dodo[0], I.dodo[1], 0, { w: 2.0, d: 1.3, h: 2.0, base: 0.9, kind: 'table', cell: CELL.plain }, 0, 'the Dodo case');
  for (const [x, z, cell, n] of [[-3.6, -6.5, CELL.fossils, 'Buckland'], [3.6, -6.5, CELL.fossils, 'Megalosaurus'], [-3.6, -11.5, CELL.minerals, 'minerals'], [3.6, -11.5, CELL.minerals, 'minerals'], [0, -14.8, CELL.fossils, 'Cetiosaurus']]) caseAt(x, z, 0, { w: 2.4, d: 1.2, h: 1.7, base: 0.85, kind: 'table', cell }, 0, n);
  // side aisles: double rows of tall cases
  const cells = [CELL.insects, CELL.birds, CELL.shells, CELL.minerals, CELL.fossils, CELL.insects];
  let ci = 0;
  for (const x of [-14.25, -8.75, 8.75, 14.25]) for (const z of [-11.5, -5.5, 0.5, 6.5, 12.5]) {
    caseAt(x, z, Math.PI / 2, { w: 3.4, d: 0.9, h: 2.3, base: 0.75, cell: cells[ci++ % cells.length], kind: 'wall' }, 0, 'case');
  }
  // the dodo itself (in its case, a plump grey bird: body, head, hooked beak, tail tuft, yellow legs)
  {
    const [dx, dz] = I.dodo, y0 = 0.9;
    G.color(0x7a7a72); G.cyl('paint', dx, y0 + 0.18, dz, 0.24, 0.36, 10, 0.18);
    G.cyl('paint', dx, y0 + 0.5, dz + 0.12, 0.09, 0.22, 8, 0.07);
    G.color(0x6a6a62); G.cyl('paint', dx, y0 + 0.68, dz + 0.16, 0.1, 0.12, 8, 0.06);
    G.color(0xc8b46a); G.beam('paint', [dx, y0 + 0.72, dz + 0.24], [dx, y0 + 0.66, dz + 0.42], 0.06, 0.07);
    G.color(0xe8e0d0); G.beam('paint', [dx, y0 + 0.4, dz - 0.2], [dx, y0 + 0.5, dz - 0.34], 0.09);
    G.color(0xd8b040); G.beam('paint', [dx - 0.08, y0, dz], [dx - 0.08, y0 + 0.18, dz], 0.04); G.beam('paint', [dx + 0.08, y0, dz], [dx + 0.08, y0 + 0.18, dz], 0.04);
  }
  // statues of scientists against the piers (court side), on the east, west and north arcades
  let si = 0;
  for (const p of court.dims.piers) {
    if (p.side === 0 || p.i % 2 === 0 || si >= STATUES.length) continue;
    const hx = Math.sin(p.h), hz = Math.cos(p.h), x = p.x + hx * 0.75, z = p.z + hz * 0.75;
    statue(G, x, z, p.h, { col: 0xe4dccc, plinthCol: 0x9a8e7a, plinth: 1.0, seated: si % 5 === 3 });
    plaque(G, x + hx * 0.47, 0.72, z + hz * 0.47, p.h, 0.8, 0.12, Lb.add(STATUES[si].toUpperCase(), { bg: '#9a8e7a', fg: '#2a2418' }));
    W([0], col.addCircle(x, z, 0.55));
    touch.push({ x, z, w: 0.9, d: 0.9, rot: p.h, floor: 0, name: STATUES[si] });
    si++;
  }
  // signs: welcome board, Pitt Rivers door sign, the trail desk, the beehive
  plaque(G, 0, 4.9, -R + 0.1, 0, 3.2, 0.42, Lb.add('PITT RIVERS MUSEUM', { bg: '#2a2a2a', fg: '#e8dcc0' }));
  plaque(G, -3.3, 2.6, R + 0.2, Math.PI, 1.6, 0.5, Lb.add('MUSEUM OF NATURAL HISTORY', { bg: '#1e3a2e', fg: '#f0e8d0', sub: 'Open daily 10:00 – 17:00', size: 26 }));
  plaque(G, I.dodo[0], 0.6, I.dodo[1] + 0.67, 0, 1.0, 0.16, Lb.add('THE OXFORD DODO', { bg: '#efe6d0' }));
  plaque(G, I.trex.x + 1.9, 0.7, I.trex.z + 3.0, Math.PI / 2, 1.2, 0.2, Lb.add('TYRANNOSAURUS REX', { bg: '#efe6d0' }));
  plaque(G, I.igu.x - 1.6, 0.7, I.igu.z + 2.3, -Math.PI / 2, 1.2, 0.2, Lb.add('IGUANODON', { bg: '#efe6d0' }));
  plaque(G, I.desk[0], 1.35, I.desk[1] + 0.42, 0, 1.4, 0.2, Lb.add('INFORMATION · MUSEUM TRAIL', { bg: '#1e3a2e', fg: '#f0e8d0' }));
  plaque(G, I.donate[0], 1.25, I.donate[1] + 0.3, 0, 0.5, 0.1, Lb.add('DONATIONS', { bg: '#7a1e1e', fg: '#fff' }));
  // the desk and the donation box
  G.color(0x4a3020); G.box('wood', I.desk[0] - 1.4, 0, I.desk[1] - 0.4, I.desk[0] + 1.4, 1.05, I.desk[1] + 0.4);
  G.color(0x8a6a4a); G.box('wood', I.desk[0] - 1.45, 1.05, I.desk[1] - 0.45, I.desk[0] + 1.45, 1.1, I.desk[1] + 0.45);
  G.color(0xf0f0e8); G.box('paint', I.desk[0] - 0.9, 1.1, I.desk[1] - 0.1, I.desk[0] - 0.5, 1.2, I.desk[1] + 0.2);   // leaflets
  W([0], col.addBox(I.desk[0], I.desk[1], 2.9, 0.9, 0));
  G.color(0x7a1e1e); G.box('paint', I.donate[0] - 0.22, 0, I.donate[1] - 0.22, I.donate[0] + 0.22, 1.1, I.donate[1] + 0.22);
  G.color(0xe8e8f0); G.box('glass', I.donate[0] - 0.2, 0.75, I.donate[1] - 0.2, I.donate[0] + 0.2, 1.1, I.donate[1] + 0.2);
  W([0], col.addCircle(I.donate[0], I.donate[1], 0.3));
  yield;
  // ---------------------------------------------------------------- the upper gallery: cases along the outer walls, the beehive
  for (const [x, z, rot] of [[-20.6, -12, Math.PI / 2], [-20.6, -6, Math.PI / 2], [20.6, -12, -Math.PI / 2], [20.6, -6, -Math.PI / 2], [20.6, 7, -Math.PI / 2], [20.6, 12, -Math.PI / 2], [-12, -20.6, 0], [-6, -20.6, 0], [6, -20.6, 0], [12, -20.6, 0], [-12, 20.6, Math.PI], [12, 20.6, Math.PI]]) {
    caseAt(x, z, rot, { w: 3.0, d: 0.8, h: 2.1, base: 0.7, cell: [CELL.birds, CELL.shells, CELL.insects][Math.abs(Math.round(x + z)) % 3] }, 1, 'case');
  }
  {
    const [hx, hz] = I.hive, y = K.G1;
    G.color(0x6a4a2a); G.box('wood', hx - 0.5, y, hz - 0.5, hx + 0.3, y + 0.85, hz + 0.5);
    G.color(0xd8a840); G.box('paint', hx - 0.45, y + 0.9, hz - 0.45, hx + 0.25, y + 1.6, hz + 0.45);
    G.color(0xffffff); G.box('glass', hx - 0.5, y + 0.85, hz - 0.5, hx + 0.3, y + 1.65, hz + 0.5);
    G.color(0x9a9a9a); G.beam('paint', [hx + 0.2, y + 1.5, hz], [R - 0.05, y + 2.4, hz], 0.06);
    plaque(G, hx - 0.52, y + 1.3, hz, -Math.PI / 2, 0.9, 0.14, Lb.add('OBSERVATION HIVE · LIVE BEES', { bg: '#efe6d0' }));
    W([1], col.addBox(hx - 0.1, hz, 0.9, 1.1, 0));
    touch.push({ x: hx - 0.1, z: hz, w: 0.8, d: 1.0, floor: 1, name: 'the beehive' });
  }
  buildGeo(G, sc, { labels: labelMaterial(Lb, 0.3) });
  yield;

  // ---------------------------------------------------------------- light: daylight from the glass roof
  // (the sun, the sky fill, the shafts and the floor patches are the court's: court.light, moved with the hour below)

  // ---------------------------------------------------------------- exhibits to look at (and the trail)
  exhibits.push(
    { x: I.dodo[0], z: I.dodo[1] + 1.2, floor: 0, title: 'the Oxford Dodo', trail: 'dodo', lines: ['The remains of the Oxford Dodo: the only soft tissue of a dodo known anywhere — a head and a foot.', 'The model in the case is the dodo as it is usually drawn: plump, grey, unimpressed.', 'Lewis Carroll saw it here. Then he wrote himself into Alice as one.'] },
    { x: I.trex.x + 2.3, z: I.trex.z + 2.5, floor: 0, title: 'the T. rex', trail: 'trex', lines: ['A cast of "Stan", one of the most complete Tyrannosaurus rex skeletons ever found, mounted rearing up.', 'Twelve metres from nose to tail. The arms remain a mystery to everyone.'] },
    { x: I.igu.x - 2.0, z: I.igu.z + 2.0, floor: 0, title: 'the Iguanodon', lines: ['A cast of an Iguanodon from the herd found down a Belgian coal mine at Bernissart in 1878.', 'Mounted in the old upright pose, like a kangaroo with a thumb spike. Nobody stands like that now.'] },
    { x: 0, z: 2, floor: 0, title: 'the whales', r: 2.2, lines: ['Seven whale and dolphin skeletons hang from the roof, on display for over a century.', 'Please do not throw things at them. Somebody always asks.'] },
    { x: I.hive[0] - 1.1, z: I.hive[1], floor: 1, title: 'the observation hive', lines: ['A glass-sided hive of live honeybees; they come and go through a tube in the wall to the gardens outside.', 'One bee seems very interested in you. You decide not to find out why.'] },
  );
  const staff = [
    { x: 6.8, z: 12.5, h: -1.9, floor: 0, label: 'Attendant', lines: ['Lovely, isn\'t he?', 'No climbing on the dinosaurs.', 'The Pitt Rivers is through the door at the back.'] },
    { x: I.desk[0], z: I.desk[1] - 0.9, h: Math.PI, floor: 0, label: 'Information desk', lines: ['Welcome to the museum!', 'Trail leaflets are on the desk.'] },
    { x: 0, z: -18.4, h: 0, floor: 0, label: 'Attendant', lines: ['Pitt Rivers this way. Mind the dark.'] },
    { x: 18.5, z: -14, h: -2.4, floor: 1, label: 'Gallery attendant', lines: ['The bees are on the other side.', 'Lovely view of the whales from up here.'] },
  ];
  const visitors = [
    { x: -9, z: 3, h: 0.4, wander: 6 }, { x: 9, z: -3, h: 2.4, wander: 6 }, { x: 0, z: 4.5, h: Math.PI, wander: 3 },
    { x: -2, z: -8.5, h: 1.2, wander: 4 }, { x: 13, z: 9, h: -1.2, wander: 5 }, { x: -14, z: -9, h: 0.6, wander: 5 },
    { x: 1.2, z: 12.8, h: Math.PI + 0.3, pose: 'photo' }, { x: -1.2, z: 13.4, h: Math.PI - 0.4 },
    { x: -10, z: 19.2, h: Math.PI, floor: 1 }, { x: 8, z: -19.0, h: 0.3, floor: 1 },
  ];

  return {
    floors, touch, exhibits, staff, visitors, dims: court.dims, skeletons: sk,
    trex: sk.trex, wob,
    /** per frame: the T. rex wobble (a damped sway about its feet) */
    get dimK() { return dimK; },
    /** the house lights: 1 = up, lower as the museum closes (natural_history_museum.js) */
    dim(k) { if (Math.abs(k - dimK) < 1e-3) return; dimK = k; for (let i = 0; i < amb.length; i++) amb[i].intensity = amb0[i] * (0.3 + 0.7 * k); },
    /** the daylight by the hour (also while the court is only seen through a doorway) */
    light() { court.light.update(game && game.time ? game.time.hour : 13, dimK); },
    update(dt) {
      court.light.update(game && game.time ? game.time.hour : 13, dimK);
      if (wob.a > 0.001) { wob.t += dt; wob.a *= Math.exp(-dt * 0.9); sk.trex.rotation.z = Math.sin(wob.t * 6.5) * 0.035 * wob.a; sk.trex.rotation.x = Math.sin(wob.t * 4.1 + 1) * 0.015 * wob.a; }
      else if (wob.a) { wob.a = 0; sk.trex.rotation.z = 0; sk.trex.rotation.x = 0; }
    },
  };
}
