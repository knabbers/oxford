// Worcester College Cellar Bar — the room, built from the plan in _bar_plan.js: the college's own fire plan of the
// bar (walls, piers, doors, lights), the owner's description and photograph, and the reference photographs
// (docs/research/worcester_bar_photos.md) for what stands in it.
// Room-local metres, axes as the college's local frame (x east, z south). Walk-in (core/interiors.js "seamless"): the
// double doors from the annex and the splayed window to Pump Quad are real openings; opts.walkIn false builds the old
// closed box (painted leaves, a lit pane) for the door-prompt path (?seamless=0).
// Nothing of the court is modelled here: outside the doors is the outdoor world's own geometry (_worcester_pump.js),
// seen through the punched doorway. The room's own stone stops short of that plane and of every outdoor surface.
import * as THREE from 'three';
import { makeVault, arcadeX, ATLAS, Batch, shapeWall, scaleUV, seeded, planeXZ, arc,
  vaultTexture, plasterTexture, flagTexture, buttonTexture, tgTexture, whiteStoneTexture, drawAtlas } from './_bar_room.js';
import { LAY } from './_bar_plan.js';
export { LAY };

// (a generator: core/interiors.js builds a room a piece a frame, left at each `yield`)
export function buildRoom(...a) { const it = buildRoomSteps(...a); for (;;) { const r = it.next(); if (r.done) return r.value; } }      // (all at once: tools)
export function* buildRoomSteps(scene, col, world, opts = {}) {
  const L = LAY, walkIn = !!opts.walkIn;
  const T = { vault: vaultTexture(), plaster: plasterTexture(), flags: flagTexture(), button: buttonTexture(), tg: tgTexture(), wstone: whiteStoneTexture(), atlas: drawAtlas() };
  const std = (o) => new THREE.MeshStandardMaterial(o), DS = THREE.DoubleSide;
  const mats = {
    vault: std({ map: T.vault, roughness: 0.95, side: DS, emissive: 0x1e1b16, emissiveMap: T.vault }), // limewash bounce light
    plaster: std({ map: T.plaster, roughness: 0.92, side: DS, emissive: 0x161412, emissiveMap: T.plaster }),
    pink: std({ map: T.plaster, color: 0xe7a3bd, roughness: 0.9, side: DS }),
    green: std({ map: T.plaster, color: 0x22302a, roughness: 0.85, side: DS }),
    floor: std({ map: T.flags, roughness: 0.78 }),
    button: std({ map: T.button, roughness: 0.55 }),
    tg: std({ map: T.tg, roughness: 0.6, side: DS }),
    wstone: std({ map: T.wstone, roughness: 0.9, side: DS }),
    wood: (world && world.mats && world.mats.darkWood) || std({ color: 0x3a2414, roughness: 0.6 }),
    col: std({ vertexColors: true, roughness: 0.72 }),
    gloss: std({ vertexColors: true, roughness: 0.18, metalness: 0.15 }),
    atlas: std({ map: T.atlas, roughness: 0.45, vertexColors: true }),
    glow: new THREE.MeshBasicMaterial({ map: T.atlas, vertexColors: true }),
    // the panes of the blind lights (pavement lights: thick glass lenses, nothing is seen through them), lit by the
    // day (worcester_bar.js sets the colour from the hour); old path: the window's pane too
    window: new THREE.MeshBasicMaterial({ color: 0xdfeaf2, vertexColors: true, side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffd8a0, vertexColors: true }),
    // the glass of the splayed window (walk-in: a real opening behind it)
    glass: std({ color: 0xa9bcc0, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: DS }),
  };
  for (const [k, m] of Object.entries(mats)) if (m && m.isMaterial && !m.name) m.name = 'bar:' + k;
  const b = new Batch(), r = seeded(77);
  const { X0, X1, Z0, Z1, ZM } = L, E = L.entry, LB = L.lobby, DR = L.door, P = L.pool, pd = P.door, AL = L.alcove, PS = L.passage;
  const lineBox = (key, x0, z0, x1, z1, h, t, y, o = {}) => { const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0); b.box(key, len, h, t, (x0 + x1) / 2, y, (z0 + z1) / 2, { ...o, ry: -ang }); };
  /** a wall on the line a -> c ([x, z] each). top: a height, or (x, z) => the ceiling over it; o.notches: [[u0, u1, h]]
   *  openings from the floor (u: metres along from a; the head keeps under the ceiling); o.holes: [[[u, y], …]];
   *  o.foot: its foot; o.solid: false leaves the collider alone */
  const wall = (key, a, c, top, o = {}) => {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]), dx = (c[0] - a[0]) / len, dz = (c[1] - a[1]) / len, foot = o.foot || 0;
    const at = (u) => [a[0] + dx * u, a[1] + dz * u], topAt = (u) => (typeof top === 'number' ? top : top(...at(Math.max(0.002, Math.min(len - 0.002, u)))) + 0.03);
    const notches = (o.notches || []).slice().sort((p, q) => p[0] - q[0]), pts = [];
    if (!notches.length || notches[0][0] > 1e-6) pts.push([0, foot]);
    for (const [u0, u1, h] of notches) { pts.push([u0, foot]); for (let i = 0; i <= 6; i++) { const u = u0 + ((u1 - u0) * i) / 6; pts.push([u, Math.min(h, topAt(u) - 0.08)]); } if (u1 < len - 1e-6) pts.push([u1, foot]); }
    if (!notches.length || notches[notches.length - 1][1] < len - 1e-6) pts.push([len, foot]);
    const n = Math.max(2, Math.ceil(len / 0.12)); for (let i = 0; i <= n; i++) { const u = len - (len * i) / n; pts.push([u, topAt(u)]); }
    b.add(key, shapeWall(pts, o.holes || [], (u, v) => { const p = at(u); return [p[0], v, p[1]]; }));
    if (o.solid !== false) { let u = 0; for (const [u0, u1] of notches) { if (u0 > u + 1e-6) col.addSegment(...at(u), ...at(u0)); u = u1; } if (u < len - 1e-6) col.addSegment(...at(u), ...at(len)); }
  };
  /** one flat face (a, c, d, e in order round it), metric uv */
  const face = (key, a, c, d, e) => {
    const g = new THREE.BufferGeometry(), w = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]), h = Math.hypot(e[0] - a[0], e[1] - a[1], e[2] - a[2]);
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...c, ...d, ...a, ...d, ...e], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, w, 0, w, h, 0, 0, w, h, 0, h], 2)); g.computeVertexNormals();
    b.add(key, g);
  };
  /** the lining of a doorway through a wall: the opening is the plan rectangle x0..x1, z0..z1 from `foot` to `h`;
   *  `along`: the axis one walks through it on ('x' or 'z'). Jambs and head, 2 mm short of the wall's two faces. */
  const lining = (key, x0, x1, z0, z1, h, along, foot = 0) => {
    const e = 0.002;
    if (along === 'x') { for (const z of [z0, z1]) face(key, [x0 + e, foot, z], [x1 - e, foot, z], [x1 - e, h, z], [x0 + e, h, z]); face(key, [x0 + e, h, z0], [x1 - e, h, z0], [x1 - e, h, z1], [x0 + e, h, z1]); }
    else { for (const x of [x0, x1]) face(key, [x, foot, z0 + e], [x, foot, z1 - e], [x, h, z1 - e], [x, h, z0 + e]); face(key, [x0, h, z0 + e], [x1, h, z0 + e], [x1, h, z1 - e], [x0, h, z1 - e]); }
  };

  yield;
  // ================= main room: two aisles of vault on the plan's piers, walls, floor
  // (K: the bays' lines — the free pier, the nib's pier and a respond on the wall opposite each; G: the vault itself,
  //  as the photographs have it: shallow, springing at shoulder height, broad flat arches between the bays)
  const VS_ = makeVault({ za: ZM, zb: Z1, bays: L.baysS, ys: L.ys, crown: L.crown, archW: 0.25 });
  const VN = makeVault({ za: Z0, zb: ZM, bays: L.baysN, ys: L.ys, crown: L.crown, archW: 0.25 });
  /** the main room's ceiling (the alcove's too) */
  const ceil = (x, z) => (z < ZM || x < X0 ? VN.ceil(x, Math.min(z, ZM)) : VS_.ceil(x, z));
  for (const V of [VS_, VN]) { b.add('vault', scaleUV(V.geo, 1.7)); if (V.arches) b.add('vault', scaleUV(V.arches, 1.7)); }
  { const g = arcadeX(VS_, ZM, ceil, 0.25, 0.1); if (g) b.add('vault', scaleUV(g, 1.7)); }      // the arcade on the piers' line (east respond, free pier, nib pier)
  for (const q of [...L.piers, ...L.responds]) { b.box('plaster', q.X1 - q.X0, 2.15, q.Z1 - q.Z0, (q.X0 + q.X1) / 2, 0, (q.Z0 + q.Z1) / 2); col.addBox((q.X0 + q.X1) / 2, (q.Z0 + q.Z1) / 2, q.X1 - q.X0, q.Z1 - q.Z0, 0); }
  for (const q of L.piers) b.box('col', q.X1 - q.X0 + 0.03, 0.12, q.Z1 - q.Z0 + 0.03, (q.X0 + q.X1) / 2, 0, (q.Z0 + q.Z1) / 2, { color: 0x111111 });
  // --- south wall: the splayed window to Pump Quad in its middle bay. A cellar light: its mouth on the room's wall is
  // wide and low under the lunette (a segmental head), it narrows and climbs through the 1.34 m of wall to the pane,
  // which is above the court outside. An iron six-light frame and glass where the outside pane is.
  const Wn = L.window;
  {
    const mi0 = Wn.xIn - Wn.wIn / 2, mi1 = Wn.xIn + Wn.wIn / 2, ys = Wn.y1In - 0.27, N = 8, zo = Z1 + Wn.depth - 0.27, zg = Z1 + Wn.depth - 0.33;      // (zo: the punched plane, 1 cm in front of the pane the exterior paints; zg: the frame and glass, clear of that pane by 3.5 cm)
    const mouth = [[mi0, Wn.y0In], [mi1, Wn.y0In]], outer = [[Wn.x - Wn.w / 2, Wn.y0], [Wn.x + Wn.w / 2, Wn.y0]];
    for (let i = 0; i <= N; i++) { const t = i / N, x = mi1 + (mi0 - mi1) * t; mouth.push([x, ys + (Wn.y1In - ys) * Math.sin(Math.PI * t)]); outer.push([Wn.x + Wn.w / 2 - Wn.w * t, Wn.y1]); }
    wall('plaster', [X0, Z1], [X1, Z1], (x) => VS_.ceil(x, Z1 - 0.001), { holes: [mouth.map(([x, y]) => [x - X0, y])] });
    for (let i = 0; i < mouth.length; i++) { const j = (i + 1) % mouth.length, m0 = mouth[i], m1 = mouth[j], o0 = outer[i], o1 = outer[j]; face('plaster', [m0[0], m0[1], Z1], [m1[0], m1[1], Z1], [o1[0], o1[1], zo], [o0[0], o0[1], zo]); }
    const hh = Wn.y1 - Wn.y0, yc = (Wn.y0 + Wn.y1) / 2;
    for (const sx of [-1, 1]) b.box('col', 0.03, hh, 0.03, Wn.x + sx * (Wn.w / 2 - 0.015), Wn.y0, zg, { color: 0xd9d5c9 });
    for (let k = 1; k < 6; k++) b.box('col', 0.02, hh, 0.02, Wn.x - Wn.w / 2 + (Wn.w * k) / 6, Wn.y0, zg, { color: 0xd9d5c9 });
    for (const yy of [Wn.y0, Wn.y1 - 0.03]) b.box('col', Wn.w, 0.03, 0.03, Wn.x, yy, zg, { color: 0xd9d5c9 });
    b.quad('glass', Wn.w - 0.04, hh - 0.04, Wn.x, yc, zg, {});
    if (!walkIn) b.quad('window', Wn.w, hh, Wn.x, yc, zg + 0.02, { ry: Math.PI });      // (old path: a lit pane, nothing beyond it)
  }
  // --- the blind lights (east: two pavement lights in the street end; north: two, high, to the forecourt): a deep
  // square recess high in the wall, its head rising to a lit pane at the back, two iron bars
  const LY = [1.85, 2.4], lightHole = (q, u0) => [[q.c - q.w / 2 - u0, LY[0]], [q.c + q.w / 2 - u0, LY[0]], [q.c + q.w / 2 - u0, LY[1]], [q.c - q.w / 2 - u0, LY[1]]];
  const lightBox = (q) => {
    const d = 0.42, hw = q.w / 2, yb = LY[1] + 0.25;
    // (s: along the wall from the light's middle; k: into the wall)
    const P3 = q.wall === 'e' ? (s, y, k) => [X1 + k, y, q.c + s] : (s, y, k) => [q.c + s, y, Z0 - k];
    face('plaster', P3(-hw, LY[0], 0), P3(hw, LY[0], 0), P3(hw, LY[0], d), P3(-hw, LY[0], d)); face('plaster', P3(-hw, LY[1], 0), P3(hw, LY[1], 0), P3(hw, yb, d), P3(-hw, yb, d));
    for (const s of [-hw, hw]) face('plaster', P3(s, LY[0], 0), P3(s, LY[0], d), P3(s, yb, d), P3(s, LY[1], 0));
    face('window', P3(-hw, LY[0], d), P3(hw, LY[0], d), P3(hw, yb, d), P3(-hw, yb, d));
    for (const s of [-hw / 3, hw / 3]) { const p = P3(s, LY[0], d - 0.04); b.box('col', 0.02, yb - LY[0], 0.02, p[0], LY[0], p[2], { color: 0x2a2a2a }); }
  };
  const eL = L.lights.filter((q) => q.wall === 'e'), nL = L.lights.filter((q) => q.wall === 'n');
  for (const q of L.lights) lightBox(q);
  // --- east end wall (the screen in the north aisle; the two pavement lights in the south)
  wall('plaster', [X1, Z0], [X1, Z1], (x, z) => (z < ZM ? VN.ceil(X1, z) : VS_.ceil(X1, z)), { holes: eL.map((q) => lightHole(q, Z0)) });
  // --- north wall, east to west: the east recess (a light), the breast, the west recess, [the respond], the alcove's
  // rough white stone above its ledge (a light)
  const BRs = L.breast, RN = L.responds[0];
  wall('plaster', [BRs.X1, Z0], [X1, Z0], (x) => VN.ceil(x, Z0 + 0.001), { holes: nL.filter((q) => q.c > BRs.X1).map((q) => lightHole(q, BRs.X1)) });
  wall('plaster', [BRs.X1, Z0], [BRs.X1, BRs.Z1], ceil); wall('plaster', [BRs.X0, BRs.Z1], [BRs.X1, BRs.Z1], ceil); wall('plaster', [BRs.X0, Z0], [BRs.X0, BRs.Z1], ceil);
  wall('plaster', [RN.X1, Z0], [BRs.X0, Z0], (x) => VN.ceil(x, Z0 + 0.001));
  wall('wstone', [AL.X0, Z0], [RN.X0, Z0], (x) => VN.ceil(x, Z0 + 0.001), { holes: nL.filter((q) => q.c < RN.X0).map((q) => lightHole(q, AL.X0)), solid: false });
  b.box('wstone', RN.X0 - AL.X0, AL.ledgeH, AL.ledgeZ - Z0, (AL.X0 + RN.X0) / 2, 0, (Z0 + AL.ledgeZ) / 2);
  b.box('wstone', RN.X0 - AL.X0 + 0.02, 0.05, AL.ledgeZ - Z0 + 0.04, (AL.X0 + RN.X0) / 2, AL.ledgeH, (Z0 + AL.ledgeZ) / 2 + 0.01, { color: 0xd6d4ce });
  col.addBox((AL.X0 + RN.X0) / 2, (Z0 + AL.ledgeZ) / 2, RN.X0 - AL.X0, AL.ledgeZ - Z0, 0);
  // --- west side: the wall to the lobby with the main door at its south end (the south aisle's barrel is high enough
  // over it), the nib and its pier on the piers' line, the alcove beyond
  const NB = L.nib, e0 = Z1 - E.z1, e1 = Z1 - E.z0, ew = E.z1 - E.z0;
  wall('plaster', [X0, Z1], [X0, NB.Z1], (x, z) => VS_.ceil(X0 + 0.001, z), { notches: [[e0, e1, E.h]] });
  lining('plaster', LB.X1, X0, E.z0, E.z1, E.h, 'x');
  b.box('floor', X0 - LB.X1, 0.02, ew, (LB.X1 + X0) / 2, -0.02, (E.z0 + E.z1) / 2);
  // (the door between the lobby and the main room. K: the plan draws its leaf swinging into the room; G: it stands open, back against the wall)
  b.box('col', 0.045, 1.94, ew - 0.08, X0 + 0.05, 0, E.z0 - ew / 2 - 0.02, { color: 0x3b2716 });
  b.box('gloss', 0.03, 0.12, 0.04, X0 + 0.085, 1.0, E.z0 - ew + 0.12, { color: 0xb08a40 });
  for (const s of [-1, 1]) b.box('col', X0 - LB.X1 + 0.04, E.h, 0.05, (LB.X1 + X0) / 2, 0, (E.z0 + E.z1) / 2 + s * (ew / 2 - 0.028), { color: 0x1a1210 });
  b.box('col', X0 - LB.X1 + 0.04, 0.05, ew - 0.1, (LB.X1 + X0) / 2, E.h - 0.05, (E.z0 + E.z1) / 2, { color: 0x1a1210 });
  wall('plaster', [X0, NB.Z1], [NB.X1, NB.Z1], ceil);                                      // the nib's south face
  wall('plaster', [PS.X1, NB.Z0], [NB.X1, NB.Z0], ceil);                                   // its north face (and the end of the passage's wall)
  // the alcove: boarded west wall (the dartboard's), the mouth of the passage in its south-west corner
  wall('tg', [AL.X0 + 0.004, Z0], [AL.X0 + 0.004, AL.Z1], (x, z) => VN.ceil(AL.X0 + 0.001, z) - 0.03, { foot: 0.12 });
  b.box('col', 0.03, 0.12, AL.Z1 - Z0, AL.X0 + 0.015, 0, (Z0 + AL.Z1) / 2, { color: 0x111111 });
  wall('plaster', [AL.X0, AL.Z1], [PS.X1, AL.Z1], ceil, { notches: [[0.1, PS.X1 - AL.X0, 2.1]] });
  // floor: the main room, the alcove, the passage (flags)
  b.add('floor', scaleUV(planeXZ(X1 - X0, Z1 - Z0), 2.4), (X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  b.add('floor', scaleUV(planeXZ(X0 - AL.X0, AL.Z1 - Z0), 2.4), (AL.X0 + X0) / 2, 0, (Z0 + AL.Z1) / 2);
  b.add('floor', scaleUV(planeXZ(PS.X1 - PS.X0, LB.Z0 - AL.Z1), 2.4), (PS.X0 + PS.X1) / 2, 0, (AL.Z1 + LB.Z0) / 2);
  // dark green lower walls behind the seating
  const dado = (x0, z0, x1, z1) => lineBox('green', x0, z0, x1, z1, 1.15, 0.02, 0);
  dado(L.responds[3].X1, Z1 - 0.012, L.responds[2].X0, Z1 - 0.012); dado(L.responds[2].X1, Z1 - 0.012, X1, Z1 - 0.012);
  dado(X1 - 0.012, L.responds[1].Z1, X1 - 0.012, Z1); dado(BRs.X1 + 0.02, Z0 + 0.012, X1, Z0 + 0.012); dado(X0 + 0.012, NB.Z1, X0 + 0.012, E.z0 - ew - 0.07);

  yield;
  // ================= the passage from the lobby's north door to the alcove (the plan's escape route)
  wall('plaster', [PS.X0, AL.Z1], [PS.X0, PS.Z1], PS.h); wall('plaster', [PS.X1, AL.Z1], [PS.X1, PS.Z1], PS.h);
  wall('plaster', [AL.X0, AL.Z1 + 0.002], [PS.X1, AL.Z1 + 0.002], PS.h, { notches: [[0.1, PS.X1 - AL.X0, 2.1]], solid: false });      // its end over the mouth (the alcove's own wall there only rises to its vault)
  face('vault', [PS.X0, PS.h, AL.Z1], [PS.X1, PS.h, AL.Z1], [PS.X1, PS.h, PS.Z1], [PS.X0, PS.h, PS.Z1]);
  const lp = LB.pass;
  wall('plaster', [PS.X0, PS.Z1], [PS.X1, PS.Z1], PS.h, { notches: [[lp.x0 - PS.X0, lp.x1 - PS.X0, lp.h]] });
  lining('plaster', lp.x0, lp.x1, PS.Z1, LB.Z0, lp.h, 'z');
  // (its door. K: the plan draws a leaf here; G: it is kept open, back against the passage's wall)
  b.box('col', 0.045, 1.94, lp.x1 - lp.x0 - 0.08, PS.X1 - 0.05, 0, PS.Z1 - (lp.x1 - lp.x0) / 2 - 0.03, { color: 0x3b2716 });

  yield;
  // ================= the inner lobby: the double doors and their three steps in its south wall, the pool room on the
  // west (one stone step up), the main room on the east, the passage and the Bar Store's door on the north
  const corrA = arc(LB.X1 - LB.X0, LB.rise, 0), cx = (LB.X0 + LB.X1) / 2;
  const corrCeil = (x) => LB.spring + corrA.h(x - cx);
  {
    const pos = [], uv = [], NX = 12, NZ = 6;
    for (let i = 0; i < NZ; i++) for (let j = 0; j < NX; j++) {
      const z0 = LB.Z0 + ((LB.Z1 - LB.Z0) * i) / NZ, z1 = LB.Z0 + ((LB.Z1 - LB.Z0) * (i + 1)) / NZ, x0 = LB.X0 + ((LB.X1 - LB.X0) * j) / NX, x1 = LB.X0 + ((LB.X1 - LB.X0) * (j + 1)) / NX;
      const q = [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]];
      for (const [x, z] of q) { pos.push(x, corrCeil(x), z); uv.push(x / 1.7, z / 1.7); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    b.add('vault', g);
  }
  const sd = LB.store, dx0 = DR.x - DR.w / 2, dx1 = DR.x + DR.w / 2, dTop = DR.y + DR.h, pz0 = pd.z - pd.w / 2, pz1 = pd.z + pd.w / 2;
  const lobTop = (x) => corrCeil(x);
  wall('plaster', [LB.X0, LB.Z0], [LB.X0, LB.Z1], lobTop, { notches: [[pz0 - LB.Z0, pz1 - LB.Z0, pd.h]] });                 // west: the pool room's door
  wall('plaster', [LB.X1, LB.Z0], [LB.X1, LB.Z1], lobTop, { notches: [[E.z0 - LB.Z0, E.z1 - LB.Z0, E.h]] });                   // east: the main door
  wall('plaster', [LB.X0, LB.Z0], [LB.X1, LB.Z0], lobTop, { notches: [[lp.x0 - LB.X0, lp.x1 - LB.X0, lp.h]] });               // north: the passage (the store's door is shut)
  wall('plaster', [LB.X0, LB.Z1], [LB.X1, LB.Z1], lobTop, { notches: [[dx0 - LB.X0, dx1 - LB.X0, dTop]], solid: false });      // south: the double doors
  col.addSegment(LB.X0, LB.Z1, dx0, LB.Z1); if (dx1 < LB.X1 - 0.01) col.addSegment(dx1, LB.Z1, LB.X1, LB.Z1);
  lineBox('col', LB.X1 - 0.025, LB.Z0, LB.X1 - 0.025, E.z0, 1.0, 0.02, 0, { color: 0x121212 });
  b.add('floor', scaleUV(planeXZ(LB.X1 - LB.X0, LB.Z1 - LB.Z0), 2.4), cx, 0, (LB.Z0 + LB.Z1) / 2);
  // the way through the Hall's wall: from the leaves a landing at the yard's level, a step down in the wall, a second
  // on its inner face whose tread stands in the lobby, a third to the lobby's floor (K: the plan draws both treads)
  {
    const zi = DR.wallZ, ze = DR.quadZ - 0.005, S = DR.steps, tx0 = DR.treadX[0], tx1 = DR.treadX[1] - 0.002, stone = 0x8a8478;
    // (the landing stops 5 mm short of the outdoor reveal's own paving, which runs in to the leaves' line; the oak
    //  threshold lies over the joint, 2 cm proud of both)
    const zl = DR.quadZ - 0.055;
    b.box('col', DR.w, DR.y, zl - S[0][0], DR.x, 0, (S[0][0] + zl) / 2, { color: stone });                                    // the landing inside the leaves
    b.box('col', DR.w, S[0][1], S[0][0] - S[1][0] - 0.002, DR.x, 0, (S[0][0] + S[1][0]) / 2 + 0.001, { color: stone });      // the tread in the wall
    b.box('col', tx1 - tx0, S[1][1], S[1][0] - S[2][0], (tx0 + tx1) / 2, 0, (S[1][0] + S[2][0]) / 2 - 0.002, { color: stone });   // the tread in the lobby
    b.box('col', DR.w, 0.004, 0.05, DR.x, DR.y, S[0][0] + 0.028, { color: 0x5f5a52 }); b.box('col', DR.w, 0.004, 0.05, DR.x, S[0][1], S[1][0] + 0.03, { color: 0x5f5a52 });
    b.box('col', tx1 - tx0, 0.004, 0.05, (tx0 + tx1) / 2, S[1][1], S[2][0] + 0.026, { color: 0x5f5a52 });                                              // worn nosings
    lining('wstone', dx0, dx1, zi, ze - 0.1, dTop, 'z');
    // the oak frame the leaves hang in (it stands in front of the outdoor reveal's stone, which ends at the leaves)
    for (const s of [-1, 1]) b.box('col', 0.06, DR.h, 0.105, DR.x + s * (DR.w / 2 - 0.02), DR.y, ze - 0.0525, { color: 0x2a1a10 });
    b.box('col', DR.w - 0.08, 0.06, 0.105, DR.x, dTop - 0.05, ze - 0.0525, { color: 0x2a1a10 });
    b.box('col', DR.w - 0.08, 0.02, 0.13, DR.x, DR.y, ze - 0.065, { color: 0x5a5650 });      // worn threshold
    if (!walkIn) {      // (old path: the leaves are painted shut; the way out is the prompt)
      b.box('col', DR.w - 0.08, DR.h - 0.05, 0.06, DR.x, DR.y, DR.leafZ, { color: 0x2a1a10 });
      b.box('col', 0.02, DR.h - 0.05, 0.065, DR.x, DR.y, DR.leafZ, { color: 0x140c08 });
      for (const s of [-1, 1]) b.box('gloss', 0.08, 0.1, 0.04, DR.x + s * 0.09, DR.y + 1.0, DR.leafZ - 0.05, { color: 0x9a9a9a });
    }
    // the passage's cheeks (2 cm behind their faces: on the faces they lie on the edge of the portal's own way through,
    //  core/interiors.js, which takes colliders off inside it — and a body could then stand in the stone)
    col.addSegment(dx0 - 0.02, LB.Z1, dx0 - 0.02, DR.faceZ); col.addSegment(dx1 + 0.02, LB.Z1, dx1 + 0.02, DR.faceZ);
    // (the wall across the doorway: the portal's passage opens it while the doors are open — core/interiors.js)
    col.addSegment(dx0, walkIn ? DR.faceZ : DR.leafZ - 0.05, dx1, walkIn ? DR.faceZ : DR.leafZ - 0.05);
    if (walkIn) { col.addSegment(dx0, DR.faceZ, dx0 - 1.5, DR.faceZ); col.addSegment(dx1, DR.faceZ, dx1 + 1.5, DR.faceZ); }
  }
  // the Bar Store's door: shut, one step up (staff only)
  { const sx = (sd.x0 + sd.x1) / 2, sw = sd.x1 - sd.x0;
    b.box('col', sw, sd.h, 0.05, sx, sd.step, LB.Z0 + 0.03, { color: 0x3b2716 }); b.box('col', sw + 0.1, sd.step, 0.12, sx, 0, LB.Z0 + 0.065, { color: 0x8a8070 });
    b.box('gloss', 0.03, 0.12, 0.05, sx + 0.3, sd.step + 1.0, LB.Z0 + 0.07, { color: 0xb08a40 });
    b.quad('atlas', 0.28, 0.08, sx, sd.step + 1.6, LB.Z0 + 0.06, {}, [0, 1000, 200, 24]); }
  b.cyl('lamp', 0.09, 0.09, 0.05, 12, cx, corrCeil(cx) - 0.06, (LB.Z0 + LB.Z1) / 2 - 0.2, { color: 0xfff0d0 }); // bulkhead

  yield;
  // ================= pool room (the owner's photograph, taken from its north end looking south): small, whitewashed
  // rough stone under a white groin vault, brightly lit, a beige floor; the table's long axis north-south; the coat
  // rail and the boxed-in panel (cables above it) on the far (south) wall; the chest freezer and the storage heater
  // against the right-hand (west) wall; the door at the left (the south end of the east wall), one stone step up.
  const PF = P.floor;
  const PV = makeVault({ za: P.Z0, zb: P.Z1, bays: [[P.X0, P.X1]], ys: PF + P.ys, crown: PF + P.crown });
  b.add('wstone', scaleUV(PV.geo, 1.3));
  const pCeil = (x, z) => PV.ceil(Math.max(P.X0 + 0.001, Math.min(P.X1 - 0.001, x)), Math.max(P.Z0 + 0.001, Math.min(P.Z1 - 0.001, z)));
  wall('wstone', [P.X0, P.Z1], [P.X1, P.Z1], pCeil); wall('wstone', [P.X0, P.Z0], [P.X0, P.Z1], pCeil);
  wall('wstone', [P.X0, P.Z0], [P.X1, P.Z0], pCeil);
  wall('wstone', [P.X1 - 0.001, P.Z0], [P.X1 - 0.001, P.Z1], pCeil, { notches: [[pz0 - P.Z0, pz1 - P.Z0, pd.h]] });
  for (const x of [P.X0, P.X1 - P.nib]) for (const z of [P.Z0, P.Z1 - P.nib]) b.box('wstone', P.nib, PF + P.ys + 0.35, P.nib, x + P.nib / 2, 0, z + P.nib / 2);      // the vault's corner responds (K: the plan)
  b.box('col', P.X1 - P.X0, PF, P.Z1 - P.Z0, (P.X0 + P.X1) / 2, 0, (P.Z0 + P.Z1) / 2, { color: 0x9c8466 });   // plain beige floor
  b.box('col', LB.X0 - P.X1 - 0.004, PF, pd.w, (P.X1 + LB.X0) / 2, 0, pd.z, { color: 0x8a8070 });              // the stone step, in the wall's thickness
  lining('wstone', P.X1, LB.X0, pz0, pz1, pd.h, 'x', PF);
  // dark door frame, the door swung open into the lobby, back against its wall (K: the plan)
  for (const s of [-1, 1]) b.box('col', 0.12, pd.h - PF, 0.07, LB.X0 - 0.03, PF, pd.z + s * (pd.w / 2 - 0.038), { color: 0x1a1210 });
  b.box('col', 0.12, 0.08, pd.w - 0.14, LB.X0 - 0.03, pd.h - 0.08, pd.z, { color: 0x1a1210 });
  b.box('col', 0.045, pd.h - PF - 0.1, 0.78, LB.X0 + 0.055, PF, pz0 - 0.41, { color: 0x4a301a });
  // far (south) wall: a dark wooden coat-hook rail with coats on it; a boxed-in white panel in the south-west corner
  // with a bundle of cables going up above it
  const sZ = P.Z1, railX = P.X1 - 1.85, panX = P.X0 + 0.79;
  b.box('col', 1.0, 0.12, 0.04, railX, PF + 1.6, sZ - 0.03, { color: 0x3a2214 });
  for (let i = 0; i < 4; i++) b.box('gloss', 0.02, 0.02, 0.08, railX - 0.36 + i * 0.24, PF + 1.64, sZ - 0.08, { color: 0xb0b0b0, rx: 0.5 });
  b.box('col', 0.32, 0.75, 0.14, railX + 0.1, PF + 0.88, sZ - 0.12, { color: 0x6a1a24 }); b.box('col', 0.28, 0.6, 0.12, railX - 0.25, PF + 1.0, sZ - 0.11, { color: 0x2a2a30 });
  b.box('col', 1.3, 1.6, 0.25, panX, PF + 0.4, sZ - 0.13, { color: 0xeeeeea });
  b.box('col', 1.3, 0.4, 0.2, panX, PF, sZ - 0.105, { color: 0xd8d4c8 });
  for (let i = 0; i < 7; i++) b.cyl('col', 0.02, 0.02, 0.38, 6, panX + 0.42 + (i % 4) * 0.045, PF + 2.0, sZ - 0.06 - (i % 2) * 0.04, { color: [0x111111, 0x2a2a2a, 0x3a3a3a, 0xe0e0e0][i % 4] });
  b.cyl('col', 0.012, 0.012, P.X1 - P.X0 - 1.6, 6, (P.X0 + P.X1) / 2 + 0.5, PF + 2.02, sZ - 0.05, { rz: Math.PI / 2, center: true, color: 0xeeeeee });
  // right-hand (west) wall: the white chest freezer (people sit on it) and a cream storage heater nearer the corner
  const FZ = P.freezer, HT = P.heater;
  b.box('col', FZ.w, 0.85, FZ.l, FZ.x, PF, FZ.z, { color: 0xf0f0ec }); b.box('col', FZ.w + 0.01, 0.04, FZ.l + 0.01, FZ.x, PF + 0.85, FZ.z, { color: 0xdedede });
  b.quad('atlas', 0.16, 0.12, FZ.x + FZ.w / 2 + 0.006, PF + 0.6, FZ.z + 0.2, { ry: Math.PI / 2 }, ATLAS.sting);
  b.box('col', HT.w, 0.62, HT.l, HT.x, PF, HT.z, { color: 0xe8e2cc });
  for (let i = 0; i < 6; i++) b.box('col', 0.01, 0.012, 0.6, HT.x + HT.w / 2 + 0.005, PF + 0.42 + i * 0.025, HT.z, { color: 0x9a9480 });
  col.addBox(FZ.x, FZ.z, FZ.w, FZ.l, 0); col.addBox(HT.x, HT.z, HT.w, HT.l, 0); col.addBox(panX, sZ - 0.13, 1.3, 0.26, 0); col.addBox(railX, sZ - 0.1, 1.0, 0.2, 0);
  // the two Bar Store doors in the north wall (K: the plan; shut)
  for (const q of P.stores) { const sx = (q.x0 + q.x1) / 2; b.box('col', q.x1 - q.x0, 1.95, 0.05, sx, PF, P.Z0 + 0.03, { color: 0xe6e4dc }); b.box('gloss', 0.03, 0.12, 0.05, sx + 0.3, PF + 1.0, P.Z0 + 0.07, { color: 0x9a9a9a }); }
  // the pool table is walked round, not through (a body's half-width inside its rails: you stand up to the cushion, as
  // the shooter's stance does; low: the view from behind looks over it)
  { const turned = Math.abs(Math.sin(L.table.rot || 0)) > 0.5; col.addBox(L.table.x, L.table.z, turned ? 0.86 : 1.78, turned ? 1.78 : 0.86, 0, { low: true }); }
  // a cue rack on the east wall, north of the door — not in the photograph (guess)
  { const rz = P.Z0 + 1.2;
    b.box('col', 0.05, 1.1, 0.7, P.X1 - 0.03, PF + 0.5, rz, { color: 0x2a1a10 });
    for (let i = 0; i < 4; i++) { const z = rz - 0.25 + 0.17 * i; b.cyl('col', 0.006, 0.013, 1.45, 6, P.X1 - 0.09, PF + 0.15, z, { color: 0xc89a60 }); b.cyl('col', 0.0135, 0.0135, 0.4, 6, P.X1 - 0.09, PF + 0.15, z, { color: 0x1a1210 }); } }
  // bright white ceiling battens over the table, along it
  for (const dx of [-0.5, 0.5]) { b.box('col', 0.12, 0.06, 1.25, L.table.x + dx, PF + 2.2, L.table.z, { color: 0xdddddd }); b.box('lamp', 0.08, 0.01, 1.2, L.table.x + dx, PF + 2.19, L.table.z, { color: 0xffffff }); }
  b.quad('atlas', 0.6, 0.2, LB.X0 + 0.02, 2.25, pd.z, { ry: Math.PI / 2 }, ATLAS.poolSign);

  yield;
  // ================= the bar: the counter along the back (north) wall, the back bar against the breast behind it
  const BR = L.bar, bx = (BR.x0 + BR.x1) / 2, blen = BR.x1 - BR.x0, bz = BR.front - BR.depth / 2;
  b.box('wood', blen, BR.top - 0.05, BR.depth, bx, 0, bz);
  b.box('wood', blen + 0.08, 0.05, BR.depth + 0.1, bx, BR.top - 0.05, bz + 0.02);
  b.box('wood', 0.08, BR.top, BR.depth, BR.x0, 0, bz);
  b.box('wood', 0.6, BR.top - 0.05, 0.08, BR.x0 + 0.3, 0, BR.front - BR.depth - 0.5); // return towards the wall
  for (let i = 0; i < 6; i++) {
    const px = BR.x0 + (i + 0.5) * (blen / 6), pw = blen / 6 - 0.12;
    b.box('col', pw, 0.6, 0.02, px, 0.25, BR.front + 0.005, { color: 0x1c110a });                 // sunk field
    b.box('col', pw - 0.14, 0.46, 0.022, px, 0.32, BR.front + 0.012, { color: 0x4a2e18 });        // raised panel
    b.box('col', pw - 0.2, 0.4, 0.008, px, 0.35, BR.front + 0.026, { color: 0x5a3a20 });          // its bevelled face catches the light
  }
  b.box('col', blen + 0.1, 0.07, 0.03, bx, 0.9, BR.front + 0.012, { color: 0x3a2414 });          // frieze rail under the top
  b.box('col', blen + 0.12, 0.035, 0.05, bx, BR.top - 0.085, BR.front + 0.045, { color: 0x6a4424 });   // moulded nosing
  b.box('col', blen + 0.04, 0.16, 0.03, bx, 0, BR.front + 0.012, { color: 0x140c08 });           // kick plinth
  b.cyl('gloss', 0.019, 0.019, blen, 8, bx, 0.19, BR.front + 0.13, { rz: Math.PI / 2, center: true, color: 0xc09a48 });   // brass foot rail
  for (let i = 0; i <= 4; i++) b.box('gloss', 0.025, 0.03, 0.13, BR.x0 + 0.1 + i * ((blen - 0.2) / 4), 0.175, BR.front + 0.065, { color: 0xa88638 });
  b.box('col', 1.3, 0.008, 0.28, bx - 1.1, BR.top, BR.front - 0.2, { color: 0x1f5a30 });
  b.box('col', 1.3, 0.008, 0.28, bx + 1.1, BR.top, BR.front - 0.2, { color: 0x1f5a30 });
  const font = (x) => { b.cyl('gloss', 0.035, 0.05, 0.55, 10, x, BR.top, BR.front - 0.3, { color: 0xc8ccd0 }); b.cyl('gloss', 0.12, 0.12, 0.06, 16, x, BR.top + 0.62, BR.front - 0.3, { rx: Math.PI / 2, center: true, color: 0xd8d8d0 }); b.quad('atlas', 0.2, 0.2, x, BR.top + 0.62, BR.front - 0.265, {}, ATLAS.font); for (const s of [-1, 1]) b.cyl('col', 0.008, 0.008, 0.08, 6, x + s * 0.05, BR.top + 0.45, BR.front - 0.24, { color: 0x111111 }); };
  font(bx - 0.9); font(bx + 0.2);
  for (const x of [bx + 0.9, bx + 1.2]) { b.cyl('gloss', 0.02, 0.02, 0.3, 8, x, BR.top, BR.front - 0.3, { color: 0xc8ccd0 }); b.cyl('col', 0.022, 0.03, 0.3, 8, x, BR.top + 0.3, BR.front - 0.3, { color: 0x1a1a1a }); }
  b.box('gloss', 0.3, 0.02, 0.2, bx - 0.35, BR.top - 0.02, BR.front - 0.33, { color: 0x9aa0a4 });
  b.box('col', 0.35, 0.22, 0.25, BR.x1 - 0.35, BR.top, BR.front - 0.35, { color: 0x101010 });
  b.box('col', 0.3, 0.12, 0.02, BR.x1 - 0.35, BR.top + 0.22, BR.front - 0.36, { rx: -0.4, color: 0x2a5a8a });
  b.quad('atlas', 0.32, 0.4, BR.x0 + 0.35, BR.top + 0.2, BR.front - 0.4, { rx: -0.15 }, ATLAS.sting);
  for (let i = 0; i < 4; i++) { const x = BR.x0 + 0.75 + i * 0.95; b.box('col', 0.9, 0.85, 0.05, x, 0.05, BR.front - BR.depth - 0.03, { color: 0x1a1a1a }); for (const y of [0.5, 0.2]) b.quad('glow', 0.8, 0.32, x, y, BR.front - BR.depth - 0.06, { ry: Math.PI, color: 0x9aa0a0 }, ATLAS.cabinet); }
  const bb = BR.backX, bw = BR.backW, Zw = BR.backZ;
  b.box('wood', bw, 0.92, 0.5, bb, 0, Zw + 0.25);
  b.box('wood', bw + 0.05, 0.04, 0.54, bb, 0.92, Zw + 0.27);
  for (const s of [-1, 1]) b.box('wood', 0.06, 1.4, 0.32, bb + s * (bw / 2 - 0.03), 0.92, Zw + 0.16);
  b.quad('atlas', bw - 0.2, 0.42, bb, 1.45, Zw + 0.03, {}, ATLAS.mirror);
  b.box('wood', bw - 0.1, 0.035, 0.26, bb, 1.2, Zw + 0.13);
  b.box('wood', bw - 0.1, 0.06, 0.3, bb, 1.72, Zw + 0.15);
  b.box('wood', bw - 0.1, 0.04, 0.28, bb, 2.25, Zw + 0.14);
  for (const s of [-1, 1]) b.box('wood', 0.06, 0.55, 0.3, bb + s * (bw / 2 - 0.08), 1.74, Zw + 0.15);
  const bottleCols = [0x3a1a08, 0x5a2a0c, 0x1d3a1d, 0xd8dccf, 0x7a4a14, 0x2a2a2a, 0x8a1a1a, 0xc8b070, 0x1a2a4a, 0xa06a20];
  const bottle = (x, y, z, s = 1) => {
    const c = bottleCols[(r() * bottleCols.length) | 0], h = (0.2 + r() * 0.08) * s, rad = (0.035 + r() * 0.015) * s, sq = r() < 0.3;
    if (sq) b.box('gloss', rad * 1.9, h, rad * 1.3, x, y, z, { color: c }); else b.cyl('gloss', rad, rad, h, 8, x, y, z, { color: c });
    b.cyl('gloss', rad * 0.35, rad * 0.5, h * 0.35, 6, x, y + h, z, { color: c });
    b.cyl('col', rad * 0.38, rad * 0.38, 0.03, 6, x, y + h * 1.35, z, { color: r() < 0.5 ? 0x1a1a1a : 0xc8a040 });
    b.box('col', rad * 1.6, h * 0.35, 0.004, x, y + h * 0.25, z + rad * (sq ? 0.66 : 1.0) + 0.002, { color: [0xf0e8d0, 0xe8e0c0, 0x202020, 0xc03030, 0xf8f8f8][(r() * 5) | 0] });
  };
  const nb1 = Math.floor((bw - 0.3) / 0.155), nb2 = Math.floor((bw - 0.4) / 0.17), nc = Math.floor((bw - 0.14) / 0.061);
  for (let i = 0; i < nb1; i++) bottle(bb - bw / 2 + 0.15 + i * 0.155, 1.235, Zw + 0.15);
  for (let i = 0; i < nb2; i++) bottle(bb - bw / 2 + 0.2 + i * 0.17, 2.29, Zw + 0.14, 0.9);
  for (let i = 0; i < nc; i++) { const cc = [0xb87333, 0xc0c0c0, 0xb87333, 0xd4b040][(r() * 4) | 0]; b.cyl('gloss', 0.011 + r() * 0.003, 0.011 + r() * 0.003, 0.003, 10, bb - bw / 2 + 0.07 + i * 0.061, 1.75 + (r() - 0.5) * 0.02, Zw + 0.302, { rx: Math.PI / 2, center: true, color: cc }); }
  for (let i = 0; i < 8; i++) b.cyl('gloss', 0.035, 0.035, 0.25, 8, bb - bw / 2 + 0.2 + i * 0.09, 0.96, Zw + 0.35, { color: [0x7a0a0a, 0x101010, 0xd8d8e0, 0x30a030][i % 4] });
  for (let i = 0; i < 10; i++) b.cyl('gloss', 0.045, 0.035, 0.14, 8, bb + 0.35 + (i % 5) * 0.11, 0.96, Zw + 0.3 + (i / 5 | 0) * 0.11, { color: 0xdfe6ea });
  // (the photograph: a round white clock at the left end of the back bar, "No smoking" at the right) — the clock on the
  // west recess's wall beside the breast, the price board on the east recess's, a poster on the west wall
  const clockX = BRs.X0 - 0.3, clockZ = Z0 + 0.04;
  b.quad('atlas', 0.32, 0.32, clockX, 1.82, clockZ, {}, ATLAS.clock);
  b.quad('atlas', 0.16, 0.2, bb + bw / 2 - 0.25, 1.42, Zw + 0.33, {}, ATLAS.nosmoking);
  b.quad('atlas', 0.75, 0.32, BRs.X1 + 0.55, 1.6, Z0 + 0.02, {}, ATLAS.prices);
  b.quad('atlas', 0.34, 0.37, X0 + 0.02, 1.5, NB.Z1 + 1.2, { ry: Math.PI / 2 }, ATLAS.gig);
  col.addBox(bx, bz, blen + 0.1, BR.depth + 0.1, 0); col.addBox(bb, Zw + 0.25, bw, 0.5, 0); col.addBox(BR.x0 + 0.3, BR.front - BR.depth - 0.5, 0.6, 0.1, 0);
  const handMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const mkHand = (len, w) => { const g = new THREE.PlaneGeometry(w, len); g.translate(0, len / 2 - 0.015, 0); const m = new THREE.Mesh(g, handMat); m.position.set(clockX, 1.82, clockZ + 0.005); scene.add(m); return m; };
  const clockHands = { hour: mkHand(0.085, 0.014), minute: mkHand(0.125, 0.009) };
  clockHands.minute.position.z += 0.002;

  yield;
  // ================= the darts alcove (north-west): the board on its boarded west wall, the rough white stone north
  // wall with its deep ledge on the thrower's right; on his left a short row of dark tables between black padded
  // benches, a coat-hook rail and a small television on the wall, the jukebox against the pier at the alcove's edge
  const BD = L.board, WX = AL.X0, J = L.jukebox;
  b.box('gloss', 0.04, 0.012, 1.3, L.oche + 0.02, 0, BD.z, { color: 0xb8bcc0 });
  b.box('col', 0.02, 0.06, 1.3, WX + 0.04, 1.62, BD.z + 1.85, { color: 0x151515 });
  for (let i = 0; i < 7; i++) b.box('gloss', 0.07, 0.02, 0.02, WX + 0.08, 1.66, BD.z + 1.3 + i * 0.19, { color: 0x9a9a9a, rz: -0.4 });
  b.box('col', 0.05, 0.36, 0.62, WX + 0.06, 1.86, BD.z + 1.55, { color: 0x0c0c0c });
  b.quad('glow', 0.57, 0.32, WX + 0.09, 2.04, BD.z + 1.55, { ry: Math.PI / 2, color: 0x8a8a8a }, ATLAS.tv);
  b.box('col', 1.2, 0.04, 0.05, WX + 0.95, 2.3, BD.z, { color: 0x111111 });
  for (let i = 0; i < 3; i++) { const x = WX + 0.6 + i * 0.4; b.cyl('col', 0.035, 0.045, 0.12, 10, x, 2.15, BD.z, { rz: -0.9, color: 0x111111 }); b.cyl('lamp', 0.03, 0.03, 0.01, 10, x - 0.06, 2.17, BD.z, { rz: -0.9, color: 0xffffff }); }
  b.box('col', 0.01, 0.4, 0.01, WX + 0.035, 2.05, BD.z + 0.95, { color: 0xeeeeee });
  const seats = [];
  {
    // (clear of the passage's mouth, which is the plan's way out: the row stops short of it; and of the jukebox)
    const tx0 = PS.X1 + 0.05, tx1 = J.x - 0.37, tlen = tx1 - tx0, tcx = (tx0 + tx1) / 2, zS = AL.Z1 - 0.21, zT = AL.Z1 - 0.92, zN = AL.Z1 - 1.63;
    for (let i = 0; i < 2; i++) {
      const x = tx0 + (i + 0.5) * (tlen / 2);
      b.box('col', tlen / 2 - 0.05, 0.04, 0.62, x, 0.72, zT, { color: 0x3a2616 });
      b.box('col', tlen / 2 - 0.11, 0.05, 0.56, x, 0.67, zT, { color: 0x20140c });                          // apron
      b.cyl('col', 0.04, 0.055, 0.66, 8, x, 0.02, zT, { color: 0x24180e });                               // cast pedestal
      b.box('col', 0.4, 0.03, 0.09, x, 0, zT, { color: 0x161616 }); b.box('col', 0.09, 0.03, 0.42, x, 0, zT, { color: 0x161616 });
    }
    for (const zb of [zS, zN]) {
      for (let i = 0; i < 2; i++) b.box('col', tlen / 2 - 0.02, 0.1, 0.42, tx0 + (i + 0.5) * (tlen / 2), 0.36, zb, { color: 0x26262c });   // padded squabs
      b.box('col', tlen, 0.02, 0.44, tcx, 0.345, zb, { color: 0x0c0c0e }); b.box('col', tlen, 0.345, 0.34, tcx, 0, zb, { color: 0x3a2a1c });
      for (let i = 0; i < 2; i++) seats.push({ x: tx0 + (i + 0.5) * (tlen / 2), z: zb + (zb < zT ? -0.05 : 0.05), h: zb < zT ? 0 : Math.PI, kind: 'darts' });
    }
    col.addBox(tcx, zT, tlen + 0.05, zS - zN + 0.46, 0);
  }
  // jukebox / quiz machine against the nib's pier, facing north into the alcove's mouth
  // (a cabinet, not a black slab: a mahogany case, chrome corner strips and a black plinth)
  b.box('col', 0.62, 1.55, 0.5, J.x, 0, J.z, { color: 0x4a2218 });
  b.cyl('col', 0.31, 0.31, 0.5, 16, J.x, 1.55, J.z, { rx: Math.PI / 2, center: true, color: 0x4a2218 });
  b.box('col', 0.66, 0.1, 0.54, J.x, 0, J.z, { color: 0x121212 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('gloss', 0.025, 1.45, 0.025, J.x + sx * 0.31, 0.1, J.z + sz * 0.25, { color: 0xb9b6ac });
  b.quad('glow', 0.52, 1.25, J.x, 0.95, J.z - 0.255, { ry: Math.PI }, ATLAS.juke);
  b.quad('glow', 0.36, 0.28, J.x, 1.67, J.z - 0.255, { ry: Math.PI }, ATLAS.quiz);
  col.addBox(J.x, J.z, 0.7, 0.55, 0);

  yield;
  // ================= seating: deep-buttoned green benches round the walls, round tables, low stools
  const bench = (x0, z0, x1, z1, flip = false) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), ry = -ang;
    const nx = -Math.sin(ang) * (flip ? -1 : 1), nz = Math.cos(ang) * (flip ? -1 : 1);
    const cx2 = (x0 + x1) / 2, cz2 = (z0 + z1) / 2, at = (d) => [cx2 + nx * d, cz2 + nz * d];
    let [px, pz] = at(0.3); b.box('col', len, 0.34, 0.5, px, 0, pz, { ry, color: 0x111511 });
    b.box('button', len, 0.12, 0.52, px, 0.33, pz, { ry });
    [px, pz] = at(0.07); b.box('button', len, 0.72, 0.14, px, 0.42, pz, { ry });
    [px, pz] = at(0.05); b.box('col', len, 0.05, 0.12, px, 1.13, pz, { ry, color: 0x1a120c });
    [px, pz] = at(0.3); col.addBox(px, pz, Math.abs(Math.cos(ang)) * len + Math.abs(Math.sin(ang)) * 0.55, Math.abs(Math.sin(ang)) * len + Math.abs(Math.cos(ang)) * 0.55, 0);
    const n = Math.floor(len / 0.62);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; seats.push({ x: cx2 + Math.cos(ang) * t * len + nx * 0.36, z: cz2 + Math.sin(ang) * t * len + nz * 0.36, h: Math.atan2(nx, nz), kind: 'bench' }); }
  };
  const RS1 = L.responds[3], RS2 = L.responds[2], RE = L.responds[1], nb0 = BRs.X1 + 1.2;
  bench(RS1.X1 + 0.05, Z1, RS2.X0 - 0.05, Z1, true);      // south wall, under the window
  bench(RS2.X1 + 0.05, Z1, X1 - 0.55, Z1, true);          // south wall, east bay
  bench(X1, RE.Z1 + 0.1, X1, Z1 - 0.55);                  // east wall, under the pavement lights
  bench(nb0, Z0, X1 - 0.55, Z0);                          // the north wall's east recess
  const tables = [];
  const table = (x, z) => {
    b.cyl('col', 0.46, 0.46, 0.045, 20, x, 0.71, z, { color: 0x2a1a0f });
    b.cyl('col', 0.47, 0.47, 0.012, 20, x, 0.70, z, { color: 0x1a0f08 });
    b.cyl('col', 0.045, 0.06, 0.66, 8, x, 0.04, z, { color: 0x1e140c });
    b.box('col', 0.6, 0.05, 0.08, x, 0, z, { color: 0x1e140c }); b.box('col', 0.08, 0.05, 0.6, x, 0, z, { color: 0x1e140c });
    col.addCircle(x, z, 0.42); tables.push({ x, z });
  };
  const stool = (x, z) => {
    b.cyl('button', 0.19, 0.18, 0.08, 14, x, 0.43, z);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.6; b.cyl('col', 0.016, 0.02, 0.44, 6, x + Math.cos(a) * 0.12, 0, z + Math.sin(a) * 0.12, { color: 0x3a2414, rz: Math.cos(a) * 0.08, rx: -Math.sin(a) * 0.08 }); }
    b.box('col', 0.25, 0.02, 0.02, x, 0.18, z, { color: 0x3a2414 }); b.box('col', 0.02, 0.02, 0.25, x, 0.18, z, { color: 0x3a2414 });
    col.addCircle(x, z, 0.19); seats.push({ x, z, h: 0, kind: 'stool' });
  };
  const zt = Z1 - 1.18, zst = Z1 - 1.98;
  for (const x of [RS1.X1 + 0.75, RS1.X1 + 2.75, RS2.X1 + 0.6, RS2.X1 + 1.9]) { table(x, zt); stool(x - 0.42, zst); stool(x + 0.42, zst); }
  for (const z of [RE.Z1 + 0.67, RE.Z1 + 1.77]) { table(X1 - 1.05, z); stool(X1 - 1.9, z); }
  table((nb0 + X1 - 0.55) / 2, Z0 + 1.18);
  for (const s of seats) if (s.kind === 'stool') { let best = null, bd = 9; for (const t of tables) { const d = Math.hypot(t.x - s.x, t.z - s.z); if (d < bd) { bd = d; best = t; } } if (best) s.h = Math.atan2(best.x - s.x, best.z - s.z); }

  yield;
  // ================= PA speakers, projector + screen, wall lights, red cable
  const SC = L.screen;
  for (const z of [SC.z - SC.w / 2 - 0.3, SC.z + SC.w / 2 + 0.3]) b.box('col', 0.26, 0.46, 0.3, X1 - 0.2, 1.72, z, { color: 0x0e0e0e, rz: -0.2 });
  b.box('col', 0.3, 0.46, 0.26, (RS2.X1 + X1) / 2 + 0.9, 1.72, Z1 - 0.2, { color: 0x0e0e0e, rx: -0.25 });
  b.box('col', 0.3, 0.46, 0.26, BRs.X0 - 1.6, 1.72, Z0 + 0.2, { color: 0x0e0e0e, rx: 0.25 });
  const px0 = X1 - 2.6;
  b.cyl('col', 0.02, 0.02, 0.6, 6, px0, 2.4, SC.z, { color: 0x111111 });
  b.box('col', 0.34, 0.12, 0.3, px0, 2.3, SC.z, { color: 0x1a1a1a });
  b.cyl('gloss', 0.04, 0.04, 0.04, 10, px0 + 0.18, 2.36, SC.z, { rz: Math.PI / 2, center: true, color: 0x2a3a5a });
  b.box('col', 0.08, 0.1, SC.w + 0.15, X1 - 0.06, 2.45, SC.z, { color: 0x111111 });
  b.box('col', 0.01, 1.15, SC.w, X1 - 0.07, 1.3, SC.z, { color: 0xf2f2f0 });
  b.box('col', 0.012, 0.06, SC.w, X1 - 0.075, 1.27, SC.z, { color: 0x111111 });
  // (wall lights over the benches; the one by the bar's end, where people stand, above head height)
  for (const [x, zw, up] of [[X1 - 1.6, Z0, 0], [RS1.X1 + 1.75, Z1, 0], [RS2.X1 + 1.85, Z1, 0], [BRs.X0 - 1.2, Z0, 0.45]]) {
    const zz = zw + (zw < 0 ? 0.08 : -0.08);
    b.box('gloss', 0.05, 0.12, 0.08, x, 1.22 + up, zz, { color: 0xa07a3a });
    b.cyl('lamp', 0.1, 0.06, 0.14, 12, x, 1.3 + up, zz + (zw < 0 ? 0.08 : -0.08), { open: true, color: 0xffd08a });
  }
  // (a red cable clipped along the arch between the free pier and the south wall: the photographs)
  { const xa = L.baysS[2][0] + 0.27, n = 22, za = ZM + 0.3, zb = Z1 - 0.1;
    for (let i = 0; i < n; i++) { const z0 = za + ((zb - za) * i) / n, z1 = za + ((zb - za) * (i + 1)) / n, y0 = VS_.ceil(xa, z0) - 0.012, y1 = VS_.ceil(xa, z1) - 0.012; b.box('col', 0.008, 0.008, Math.hypot(z1 - z0, y1 - y0), xa, (y0 + y1) / 2, (z0 + z1) / 2, { center: true, rx: -Math.atan2(y1 - y0, z1 - z0), color: 0xb81818 }); } }

  const meshes = b.build(scene, mats);

  yield;
  // ================= lights (7 real lights: the lobby's is what glows in the doorway seen from the annex)
  const mk = (color, intensity, dist, x, y, z) => { const l = new THREE.PointLight(color, intensity, dist, 1.4); l.position.set(x, y, z); scene.add(l); return l; };
  const sMid = (ZM + Z1) / 2, nMid = (Z0 + ZM) / 2, bay = (k) => (L.baysS[k][0] + L.baysS[k][1]) / 2;
  const lights = {
    bar: mk(0xffd29a, 9, 11, BR.backX, 2.45, BR.front - 0.2),
    west: mk(0xffdcb4, 7, 11, bay(1), 2.5, sMid),
    bay3: mk(0xffdcb4, 6, 11, bay(2), 2.5, sMid),
    east: mk(0xffdcb4, 5, 10, X1 - 1.9, 2.4, nMid + 0.4),
    lobby: mk(0xffdcb4, 3.2, 6.5, cx, 2.2, (LB.Z0 + LB.Z1) / 2),
    pool: mk(0xfff4e2, 5.5, 7, L.table.x, PF + 1.9, L.table.z),
  };
  const spot = new THREE.SpotLight(0xffffff, 9, 7, 0.55, 0.85, 1.2);
  spot.position.set(BD.x + 1.4, 2.15, BD.z); spot.target.position.set(BD.x, BD.y, BD.z);
  scene.add(spot); scene.add(spot.target); lights.darts = spot;
  for (const l of Object.values(lights)) { l.userData.base = l.intensity; l.userData.color = l.color.getHex(); }

  const S = DR.steps;
  const ground = (x, z) => {
    if (x < LB.X0) return PF;                                          // pool room (and the stone step in its doorway)
    if (z > S[2][0] && x > DR.treadX[0] && x < DR.treadX[1]) return z > S[0][0] ? DR.y : z > S[1][0] ? S[0][1] : S[1][1];      // the three steps up to the doors
    return 0;
  };
  /** the ceiling anywhere in the bar (the bop's lasers and balloons) */
  const ceilAll = (x, z) => (x < LB.X0 ? pCeil(x, z) : x < X0 && z > AL.Z1 ? (z > LB.Z0 ? corrCeil(Math.max(LB.X0, Math.min(LB.X1, x))) : PS.h) : ceil(x, z));
  return { mats, meshes, lights, windowMat: mats.window, lampMat: mats.lamp, clockHands, ground, seats, tables, ceil: ceilAll, vault: VS_, vaults: [VS_, VN], walkIn };
}
