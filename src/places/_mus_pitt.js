// The Pitt Rivers Museum as an interior: the crammed dark cases on the court floor and on both galleries (drawers
// beneath to open), the "Treatment of Dead Enemies" case with its permanent crowd (nothing modelled inside), the
// witch in a bottle on the upper gallery, the torch you can borrow at the desk, the floors and colliders. The hall
// itself is _mus_pitt_hall.js.
import * as THREE from 'three';
import { Geo, buildGeo, displayCase, plaque, Labels, labelMaterial, CELL, cellUV, museumMats, envTexture } from './_mus_kit.js';
import { buildPittHall, PITT } from './_mus_pitt_hall.js';
import { Floors } from './_mus_logic.js';
import { canvas, canvasTexture } from './_mus_fine.js';

export const PITT_IN = { spawn: [0, 12.6], exit: [0, 13.2], desk: [4.5, 11.8], heads: [6.6, 4.6], witch: [20.4, 2.5] };

/** arch = { w, h }: walk-in (the real doorway from the court, open in the south wall; natural_history_museum.js) */
export function buildPittInterior(ctx, game, arch = null) {
  const sc = ctx.scene, col = ctx.collider, P = PITT, I = PITT_IN;
  const hall = buildPittHall({ scene: sc, arch });
  const floors = new Floors([0, P.G1, P.G2]);
  const A = P.laneA, B = P.laneB;
  floors.ramp({ b: 0, ...A, axis: 'z', lo: A.z1 });
  floors.ramp({ b: 1, ...B, axis: 'z', lo: B.z0 });
  ctx.setGround((x, z) => floors.ground(x, z));
  const W = (ks, s) => floors.walls(ks, s);
  const { X, Z, IX, IZ } = P;
  col.addPolyline([[-X, -Z], [X, -Z], [X, Z], [-X, Z], [-X, -Z]]);
  for (const [x, z] of hall.dims.piers) W([0], col.addCircle(x, z, 0.3));
  // the galleries' edge (upstairs), the lanes' walls and end caps
  W([1, 2], col.addPolyline([[-IX, -IZ], [IX, -IZ], [IX, IZ], [-IX, IZ], [-IX, -IZ]]));
  W([0, 1], col.addSegment(A.x1 + 0.05, A.z0, A.x1 + 0.05, A.z1));
  W([0], col.addSegment(A.x0, A.z0, A.x1, A.z0));          // can't walk into the top of lane A from the ground floor
  W([1], col.addSegment(A.x0 - 0.4, A.z1, A.x1 + 0.05, A.z1));   // ...nor fall into its bottom from the gallery
  W([1, 2], col.addSegment(B.x0 - 0.05, B.z0, B.x0 - 0.05, B.z1));
  W([1, 2], col.addSegment(B.x1, B.z0, B.x1, B.z1));
  W([2], col.addSegment(B.x0 - 0.05, B.z0, B.x1, B.z0));
  W([1], col.addSegment(B.x0 - 0.05, B.z1, B.x1, B.z1));

  // ---------------------------------------------------------------- cases
  const G = new Geo(), Lb = new Labels(32), touch = [];
  const drawers = (x, z, rot, w, d, y) => {   // drawer fronts on both long faces of a case base
    G.at(x, y, z, rot); const uv = cellUV(CELL.drawers);
    for (const s of [1, -1]) { const zz = s * (d / 2 + 0.005); const a = [-w / 2 + 0.05, 0.08, zz], b = [w / 2 - 0.05, 0.08, zz], c = [w / 2 - 0.05, 0.7, zz], e = [-w / 2 + 0.05, 0.7, zz]; if (s > 0) G.quadUV('contents', a, b, c, e, uv); else G.quadUV('contents', b, a, e, c, uv); }
    G.pop();
  };
  const caseAt = (x, z, rot, o, floor = 0, name = 'case') => {
    const y = floor === 0 ? 0 : floor === 1 ? P.G1 : P.G2;
    const f = displayCase(G, x, z, rot, { wood: 0x2a1a10, base: 0.75, ...o, y });
    if (o.drawers !== false && o.kind !== 'wall-single') drawers(x, z, rot, f[2], f[3], y);
    W([floor], col.addBox(x, z, f[2] + 0.1, f[3] + 0.1, rot));
    touch.push({ x, z, w: f[2], d: f[3], rot, floor, name });
  };
  const pr = [CELL.prA, CELL.prB, CELL.prC, CELL.tools, CELL.masks];
  let k = 0;
  // the court floor: rows of tall cases either side of a clear view to the totem pole; table cases between
  for (const x of [-14.2, -10.4, -6.6, -2.9, 2.9, 6.6, 10.4, 14.2]) for (const z of [-5.2, -0.2, 4.8]) {
    if (Math.abs(x - I.heads[0]) < 1 && Math.abs(z - I.heads[1]) < 1) continue;
    if (z === 4.8 && Math.abs(x) < 4) continue;   // room by the door
    caseAt(x, z, Math.PI / 2, { w: 3.2, d: 1.1, h: 2.5, cell: pr[k++ % pr.length], kind: 'wall' }, 0);
  }
  // the "Treatment of Dead Enemies" case: a tall case with its label; the crowd round it hides the contents
  caseAt(I.heads[0], I.heads[1], 0, { w: 2.0, d: 1.2, h: 2.2, cell: CELL.heads, kind: 'table' }, 0, 'the Treatment of Dead Enemies case');
  plaque(G, I.heads[0], 2.42, I.heads[1] + 0.62, 0, 1.9, 0.26, Lb.add('TREATMENT OF DEAD ENEMIES', { bg: '#efe6cc', fg: '#2a1a10' }));
  // under the galleries: wall cases along the outer walls (all three floors)
  for (const fl of [0, 1, 2]) {
    for (let x = -14; x <= 14; x += 4) {
      if (fl === 0 && Math.abs(x) < 3) continue;   // the door
      caseAt(x, Z - 0.5, Math.PI, { w: 3.4, d: 0.7, h: 2.4, cell: pr[(k++) % pr.length], kind: 'wall', drawers: false }, fl);
      caseAt(x, -Z + 0.5, 0, { w: 3.4, d: 0.7, h: 2.4, cell: pr[(k++) % pr.length], kind: 'wall', drawers: false }, fl);
    }
    for (const z of [-6, -2, 2, 6]) caseAt(X - 0.5, z, -Math.PI / 2, { w: 3.4, d: 0.7, h: 2.4, cell: pr[(k++) % pr.length], kind: 'wall', drawers: false }, fl);
    // gallery-edge table cases upstairs
    if (fl > 0) for (let x = -13; x <= 13; x += 6.5) for (const z of [IZ + 1.4, -IZ - 1.4]) caseAt(x, z, 0, { w: 2.6, d: 0.9, h: 1.5, cell: pr[(k++) % pr.length], kind: 'table' }, fl);
  }
  // the witch in a bottle: a little silver bottle in its own case, upper gallery, east end
  {
    const [wx, wz] = I.witch, y = P.G2;
    caseAt(wx, wz, -Math.PI / 2, { w: 1.0, d: 0.8, h: 1.7, cell: CELL.plain, kind: 'table' }, 2, 'the witch in a bottle');
    G.color(0xc8ccd0); G.cyl('iron', wx, y + 0.76, wz, 0.07, 0.16, 10, 0.07); G.cyl('iron', wx, y + 0.92, wz, 0.07, 0.06, 10, 0.025); G.cyl('iron', wx, y + 0.98, wz, 0.025, 0.06, 6, 0.02);
    plaque(G, wx - 0.42, y + 0.55, wz, -Math.PI / 2, 0.8, 0.12, Lb.add('WITCH IN A BOTTLE — DO NOT OPEN', { bg: '#efe6cc' }));
  }
  // the desk (torches) by the door
  G.color(0x2a1a10); G.box('wood', I.desk[0] - 1.0, 0, I.desk[1] - 0.4, I.desk[0] + 1.0, 1.0, I.desk[1] + 0.4);
  G.color(0xc8a050); for (let i = 0; i < 4; i++) G.cyl('iron', I.desk[0] - 0.6 + i * 0.25, 1.0, I.desk[1], 0.035, 0.18, 6);
  plaque(G, I.desk[0], 1.25, I.desk[1] + 0.42, 0, 1.4, 0.18, Lb.add('TORCHES — PLEASE RETURN', { bg: '#efe6cc' }));
  W([0], col.addBox(I.desk[0], I.desk[1], 2.0, 0.8, 0));
  plaque(G, P.totem.x, 1.3, P.totem.z + 0.75, 0, 1.3, 0.2, Lb.add('HAIDA HOUSE POST', { bg: '#efe6cc', sub: 'Old Massett, Haida Gwaii · came to Oxford 1901' }));
  W([0], col.addCircle(P.totem.x, P.totem.z, 0.8));
  touch.push({ x: P.totem.x, z: P.totem.z, w: 1.4, d: 1.4, floor: 0, name: 'the house post' });
  plaque(G, 0, P.G1 + 1.8, -Z + 0.08, 0, 3.4, 0.4, Lb.add('PITT RIVERS MUSEUM', { bg: '#1a120c', fg: '#d8c8a0' }));
  // the cases are lit from within (small warm lamps in every case): the contents glow in the dark hall, and the
  // glass catches the lamps
  const MM = museumMats();
  const lit = MM.contents.clone(); lit.emissiveMap = MM.contents.map; lit.emissive = new THREE.Color(0xffc890); lit.emissiveIntensity = 0.5; lit.name = 'mus-pitt-contents';
  const glass = MM.glass.clone(); glass.envMap = envTexture('#120c08', '#ffb060', '#100a06'); glass.envMapIntensity = 2.2; glass.opacity = 0.2; glass.roughness = 0.12; glass.name = 'mus-pitt-glass';
  buildGeo(G, sc, { labels: labelMaterial(Lb, 0.55), contents: lit, glass });

  // ---------------------------------------------------------------- the torch
  const torch = new THREE.SpotLight(0xfff0d0, 0, 14, 0.42, 0.55, 1.3);
  torch.castShadow = false; sc.add(torch); sc.add(torch.target);
  // the beam you can see in the dusty air: an open cone (24 tris, additive, drawn only while the torch is on)
  const beam = (() => {
    const L = 5.5, geo = new THREE.ConeGeometry(L * Math.tan(0.3), L, 12, 1, true);
    geo.translate(0, -L / 2, 0); geo.rotateX(-Math.PI / 2);          // apex at the origin, opening along +z
    const { canvas: c, g } = canvas(4, 64), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.65, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');     // canvas top = the apex at the lamp; gone by the open end (no hard rim)
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: canvasTexture(c), color: 0xffe6b8, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, name: 'mus-pitt-beam' }));
    m.name = 'mus-pitt-beam'; m.visible = false; m.frustumCulled = false; m.renderOrder = 6; sc.add(m);
    return m;
  })();
  const tState = { on: false };
  const exhibits = [
    { x: P.totem.x, z: P.totem.z + 1.8, floor: 0, title: 'the Haida house post', trail: 'totem', lines: ['A carved house post over eleven metres tall, from the Star House at Old Massett on Haida Gwaii, British Columbia. It came to the museum in 1901.', 'The largest thing in the museum. It got in before the roof did, more or less.'] },
    { x: I.witch[0] - 1.1, z: I.witch[1], floor: 2, title: 'the witch in a bottle', trail: 'witch', lines: ['A small silver bottle, given to the museum in 1915 with a warning that there is a witch in it, and that it should never be opened.', 'Nobody has opened it.', 'You do not open it either.'] },
    { x: I.heads[0], z: I.heads[1] + 1.6, floor: 0, title: 'the crowd round the case', lines: ['You can\'t see a thing for the crowd.', 'Everyone came to see this case. Everyone is standing in front of it.', '"Treatment of Dead Enemies," reads the label. You decide the drawers are more your thing.'] },
    { x: -6.6, z: 1.2, floor: 0, title: 'the drawers', r: 1.4, lines: ['You slide open a drawer under the case: a hundred tiny labelled keys.', 'The next one: forty spoons. The next: a single feather and a note that says "see drawer 3".'] },
  ];
  const staff = [
    { x: I.desk[0], z: I.desk[1] - 0.9, h: Math.PI, floor: 0, label: 'Pitt Rivers desk', lines: ['Torch? It\'s darker than you think.', 'Please don\'t lean on the cases. They\'re older than the building.'] },
    { x: -12.8, z: 8.2, h: 2.4, floor: 0, label: 'Attendant', lines: ['The stairs are in the corner.', 'Mind the drawers.'] },
    { x: 18.5, z: -11.5, h: -2.6, floor: 2, label: 'Gallery attendant', lines: ['The witch is just along there. Don\'t.'] },
  ];
  // the crowd round the case (looking in), and a few others with torches
  const hx = I.heads[0], hz = I.heads[1];
  const visitors = [
    { x: hx - 0.6, z: hz + 1.05, h: Math.PI, pose: 'stand' }, { x: hx + 0.5, z: hz + 1.1, h: Math.PI - 0.2 }, { x: hx + 1.35, z: hz + 0.5, h: -Math.PI / 2 - 0.3 },
    { x: hx + 1.45, z: hz - 0.4, h: -Math.PI / 2 }, { x: hx - 1.4, z: hz + 0.3, h: Math.PI / 2 + 0.2 }, { x: hx, z: hz + 1.75, h: Math.PI, pose: 'photo' },
    { x: hx - 1.45, z: hz - 0.5, h: Math.PI / 2 },
    { x: -9, z: 2.4, h: 0.5, wander: 4 }, { x: 9, z: -2.6, h: 2.5, wander: 4 }, { x: 0.5, z: -4.5, h: Math.PI, pose: 'photo' },
    { x: 12, z: 11.6, h: 0.8, floor: 1 }, { x: -12, z: -11.6, h: 0.3, floor: 2 },
  ];
  // closing time: the lamps and the cases go down (k = 1 lit … 0 out), nothing else changes
  const L0 = hall.lights.map((l) => l.intensity), E0 = lit.emissiveIntensity, P0 = hall.pool.opacity;
  let dimK = 1;
  return {
    floors, touch, exhibits, staff, visitors, dims: hall.dims, lights: hall.lights,
    get dimK() { return dimK; },
    dim(k) { if (Math.abs(k - dimK) < 1e-3) return; dimK = k; for (let i = 0; i < L0.length; i++) hall.lights[i].intensity = L0[i] * k; lit.emissiveIntensity = E0 * (0.12 + 0.88 * k); hall.pool.opacity = P0 * k; },
    torch: {
      get on() { return tState.on; },
      set(on) { tState.on = !!on; torch.intensity = on ? 40 : 0; beam.visible = tState.on; },
      /** per frame: the beam from the player's hand along their heading */
      update(player) {
        if (!tState.on) return;
        const h = player.heading, x = player.pos.x, y = player.pos.y + 1.25, z = player.pos.z;
        torch.position.set(x + Math.sin(h) * 0.3, y, z + Math.cos(h) * 0.3);
        torch.target.position.set(x + Math.sin(h) * 6, y - 0.9, z + Math.cos(h) * 6);
        torch.target.updateMatrixWorld();
        beam.position.copy(torch.position); beam.lookAt(torch.target.position);
      },
    },
  };
}
