// Worcester College Hall (James Wyatt 1784; Wyatt scheme recreated 1966 — the state before the 2018 blue
// redecoration). docs/research/worcester_interiors.md §2. Room frame: x = 0 (west: loggia door + column screen) .. L
// (east: Venetian window, high table), z = -W/2 (north, windows) .. +W/2 (south, fireplace), floor y = 0.
//
// A WALK-IN room (core/interiors.js "seamless"; plan and fit: _worcint_hall_plan.js HALL_PLAN): it stands in the south
// wing of the Main Quad's east range, its west doorway the oak door in the loggia's back wall beside the WWII memorial
// (a real pair of heavy leaves, no fade), its floor the top of the loggia's ramp.
//
// 2026-11-22 TRUE SIZE: 17.9 x 9.0 m (the college's venue plan; it was 23.0 x 10.4), 7.9 m to the cornice and 8.9 m to
// the flat of the coved ceiling. What is where, and how it is known (K = seen in a named plan / picture, G = guess):
//   K venue plan: the screen is TWO columns, 2.33 m in from the west wall and 2.2 m from each side wall (it was four);
//     the fireplace in the south wall opposite the middle window; the folding door to the servery in the south wall
//     behind the screen; the three north windows; the west door a little north of the centre line.
//   K photograph of the east end (Commons 165456697, 2010): three rows of long tables with benches along the room, one
//     on the centre line; the high table across the east end with its chairs; tall dark arabesque panels on the east
//     wall by the corners and one on each side wall next to them; an oval portrait under the Venetian window between
//     two sconces; plaster frames on the south wall that mirror the north windows (aprons with swags), a portrait in
//     each, a sconce under each window and frame; a low dado rail; side tables against the south wall by the east end;
//     a large chandelier.
//   G: the tables' length and the benches' places (84 at 0.7 m; the hall "seats 120"), the dais (the research note's
//     "low dais": the 2010 photograph does not show its edge), a second chandelier, the false doors (in the screen's
//     side bays: the note has "mahogany false doors in the west wall between the columns"), pilasters on the side walls
//     behind the columns, the portrait over the door, the hot counter and tray stack (the game's: the real servery is
//     beyond the folding door), colours (a black-and-white photograph).
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts, sharedMats, windowGlass, skyGlass, buildBatch, addPoint, ambientOf, portrait, sash, refectoryTable, benchAlong, chairAt, candle, wallShade, woodGrain, outGlass } from './_worcint_kit.js';
import { hallCeiling, hallCoveTex, plasterPanel, glassAtlas, tex } from './_worcint_tex.js';
import { HALL_PLAN as PL, HALL_MARKS, wingSeamless, OUTSIDE, PUNCH } from './_worcint_hall_plan.js';
import { stainedPair, pane, wingDoors, wingLeafHeads, wingLeafMat, outerReveal, doorReveal, doorSill } from './_worcint_chapel.js';

export const HALL = { L: PL.L, W: PL.W, HW: PL.HW, HC: PL.HC, cove: 1.0, door: { z: PL.door.z }, doorUV: PL.doorUV, dais: PL.L - 2.8, seamless: wingSeamless(PL) };
const NWIN = PL.win.x, WY0 = PL.win.y0, WY1 = PL.win.y1, WW = PL.win.w / 2;      // the north windows, where the forecourt front has them
// three rows of refectory tables, the middle one on the room's centre line, from just inside the screen to the cross
// aisle before the high table (plan: HALL_MARKS)
const TABLES = HALL_MARKS.rows, TX0 = HALL_MARKS.tx0, TX1 = HALL_MARKS.tx1, SEAT0 = HALL_MARKS.seat0, SEAT = HALL_MARKS.seat;
const GREEN = 0xc5d3bb, DADO = 0x8e9c86;   // "green tones chosen in the twentieth century" (shade: guess)
const COLX = PL.screen.x, COLS = [-PL.screen.col, PL.screen.col];

export function buildHall(ctx, game) {
  const S = sharedMats(game), H = HALL, L = H.L, W = H.W, hz = W / 2, HW = H.HW;
  const scene = ctx.scene, col = ctx.collider;
  const walkIn = !!(ctx.seamless && ctx.addDoor);      // in place in the wing: real doorway, real windows (core/interiors.js)
  const B = new Batch();
  const mats = { ...S, flame: S.flame.clone() };
  mats.wall = new THREE.MeshStandardMaterial({ map: wallShade(HW, { top: 1.1, bottom: 1.8 }), color: GREEN, roughness: 0.92 });
  mats.dado = new THREE.MeshStandardMaterial({ color: DADO, roughness: 0.85 });
  mats.stoneReveal = new THREE.MeshStandardMaterial({ color: 0xd9caa6, roughness: 0.92 });   // the wall's own stone, in the doorway and outside the glass
  mats.sky = skyGlass(); mats.glassOut = outGlass();
  if (walkIn) { mats.sky.transparent = true; mats.sky.opacity = 0.1; mats.sky.depthWrite = false; }      // clear glass: a faint sheen over the real view
  // Wyatt's arabesque panels: darker than the wall in the photograph, pale ornament (colour: guess)
  mats.panel = new THREE.MeshStandardMaterial({ map: plasterPanel('#74897b'), roughness: 0.9 });
  mats.canvasDark = new THREE.MeshStandardMaterial({ color: 0x2b2018, roughness: 0.6 });
  const GA = glassAtlas([{ figures: 3, pal: ['#3a4a8a', '#a8302a', '#4a7a3a', '#d8b040', '#6a3a6a', '#efe6c8'] }, { theme: 'plain', medallion: true }, { theme: 'plain', medallion: true }]);
  mats.stained = windowGlass(GA.texture, { day: 1.2, night: 0.05 });      // (the old path only: an opaque lit pane)
  const ST = stainedPair(GA.texture, 'hallGlass'); mats.stIn = ST.in; mats.stOut = ST.out;
  const ft = mats.stoneFloor.map.clone(); ft.repeat.set(1 / 1.6, 1 / 1.6); ft.needsUpdate = true;
  mats.flags = new THREE.MeshStandardMaterial({ map: ft, color: 0xe2ddd2, roughness: 0.7 });

  const FN = frame(0, 0, -hz, 1, 0), FS = frame(L, 0, hz, -1, 0), FE = frame(L, 0, -hz, 0, 1), FW = frame(0, 0, hz, 0, -1);
  // ---------------------------------------------------------------- walls
  const nHoles = NWIN.map((x) => rectPts(x - WW, WY0, x + WW, WY1));
  B.push(FN); B.face('wall', rectPts(0, 0, L, HW), nHoles); B.pop();
  // the folding door to the servery: south wall, behind the screen (venue plan; s = L - x: metres from the east wall)
  const sv0 = L - PL.servery.x1, sv1 = L - PL.servery.x0, svH = 2.4;
  B.push(FS); B.face('wall', [[0, 0], [sv0, 0], [sv0, svH], [sv1, svH], [sv1, 0], [L, 0], [L, HW], [0, HW]]); B.pop();
  // the Venetian window, as the street end has it: round-headed centre light, a flat-headed light each side
  const E = PL.east, ven = { c: hz + E.z, cw: E.cw, y0: E.y0, spring: E.spring, side: E.sideTop, a: E.sideIn, b: E.sideOut };
  const vC = archPts(ven.c, ven.cw, ven.y0, ven.spring, 12), vL = rectPts(ven.c - ven.b, ven.y0, ven.c - ven.a, ven.side), vR = rectPts(ven.c + ven.a, ven.y0, ven.c + ven.b, ven.side);
  B.push(FE); B.face('wall', rectPts(0, 0, W, HW), [vC, vL, vR]); B.pop();
  // the west doorway: the round-headed oak door of the loggia's back wall
  const doorS = hz - H.door.z, dw = PL.door.w / 2, dh = PL.door.h;
  const doorPts = archPts(doorS, PL.door.w, 0, PL.door.spring, 12);
  B.push(FW); B.face('wall', [[0, 0], [doorS - dw, 0], ...doorPts.slice(2).reverse(), [doorS + dw, 0], [W, 0], [W, HW], [0, HW]]); B.pop();
  // dado + rail all round (gaps at the doors)
  const dado = (F, segs) => { B.push(F); for (const [a, b] of segs) { B.box('dado', (a + b) / 2, 0.55, 0.02, b - a, 1.1, 0.04); B.box('plasterWhite', (a + b) / 2, 1.13, 0.04, b - a, 0.07, 0.08); B.box('plasterWhite', (a + b) / 2, 0.08, 0.03, b - a, 0.16, 0.06); } B.pop(); };
  dado(FN, [[0, L]]); dado(FS, [[0, sv0 - 0.1], [sv1 + 0.1, L]]); dado(FE, [[0, W]]); dado(FW, [[0, doorS - dw - 0.2], [doorS + dw + 0.2, W]]);
  // the plaster dressing of a window — and of the blind frames that mirror the windows on the south wall: architrave,
  // head, an apron with swags under the sill (the photograph)
  const dress = (s) => {
    B.box('plasterWhite', s, WY0 - 0.25, 0.05, 2 * WW + 0.2, 0.5, 0.08);
    for (let k = 0; k < 2; k++) { const a = s - WW + k * WW; for (let j = 0; j <= 6; j++) { const t = j / 6; B.box('plasterWhite', a + WW * t, WY0 - 0.55 - Math.sin(Math.PI * t) * 0.18, 0.06, 0.07, 0.05, 0.04); } }
    for (const sx of [-1, 1]) B.box('plasterWhite', s + sx * (WW + 0.03), (WY0 + WY1) / 2, 0.05, 0.12, WY1 - WY0 + 0.2, 0.06);
    B.box('plasterWhite', s, WY1 + 0.08, 0.05, 2 * WW + 0.2, 0.14, 0.08);
  };
  // north windows: sashes in their dressings
  const nd = PL.win.depth.n - OUTSIDE.side.recess;     // the glass stands where the outside has its sash
  B.push(FN);
  for (const x of NWIN) {
    sash(B, x - WW, x + WW, WY0, WY1, walkIn ? nd : 0.55, { cols: 3, rows: 6, glassKey: 'sky', outKey: walkIn ? 'glassOut' : null });
    if (walkIn) outerReveal(B, 'stoneReveal', rectPts(x - WW, WY0, x + WW, WY1), nd, PL.win.depth.n, PUNCH.side);
    dress(x);
  }
  B.pop();
  // east wall: the Venetian window (Burges glass in the centre light), its plaster dressings, the arabesque panels
  const ed = walkIn ? E.depth - OUTSIDE.east.recess : 0.5;
  B.push(FE);
  for (const pts of [vC, vL, vR]) { B.reveal('plasterWhite', pts, 0, -ed); if (walkIn) outerReveal(B, 'stoneReveal', pts, ed, E.depth, PUNCH.east); }
  if (walkIn) {
    pane(B, 'stIn', 'stOut', vC, -ed + 0.02, GA.uv(0)); pane(B, 'stIn', 'stOut', vL, -ed + 0.02, GA.uv(1)); pane(B, 'stIn', 'stOut', vR, -ed + 0.02, GA.uv(2));
    // iron saddle bars across the lights
    for (let k = 1; k < 4; k++) { const y = ven.y0 + ((ven.spring - ven.y0) * k) / 4; B.box('iron', ven.c, y, -ed + 0.02, ven.cw, 0.03, 0.03, 0, { bottom: true }); if (y < ven.side - 0.2) for (const sx of [-1, 1]) B.box('iron', ven.c + sx * (ven.a + ven.b) / 2, y, -ed + 0.02, ven.b - ven.a, 0.03, 0.03, 0, { bottom: true }); }
  } else { pane(B, 'stained', null, vC, -ed + 0.02, GA.uv(0)); pane(B, 'stained', null, vL, -ed + 0.03, GA.uv(1)); pane(B, 'stained', null, vR, -ed + 0.03, GA.uv(2)); }
  // (plaster dressings: the columns between the lights, the outer pilasters, the entablature over the side lights, the
  //  archivolt, the apron with its swags)
  for (const sx of [-1, 1]) {
    const sm = ven.c + sx * (ven.a + ven.cw / 2) / 2, so = ven.c + sx * (ven.b + 0.14);
    B.cyl('plasterWhite', sm, ven.y0, 0.1, 0.1, ven.side - ven.y0, 10, false);
    B.box('plasterWhite', so, (ven.y0 + ven.side) / 2, 0.06, 0.24, ven.side - ven.y0, 0.12);
    B.box('plasterWhite', ven.c + sx * (ven.cw / 2 + ven.b + 0.26) / 2, ven.side + 0.13, 0.09, ven.b + 0.26 - ven.cw / 2 + 0.1, 0.26, 0.2);
    B.box('plasterWhite', ven.c + sx * (ven.cw / 2 + ven.b + 0.26) / 2, ven.side + 0.3, 0.11, ven.b + 0.36 - ven.cw / 2 + 0.1, 0.08, 0.26);
  }
  for (let k = 0; k <= 12; k++) { const a = Math.PI * k / 12; if (ven.spring + Math.sin(a) * (ven.cw / 2 + 0.1) < ven.side + 0.34) continue; B.box('plasterWhite', ven.c + Math.cos(a) * (ven.cw / 2 + 0.1), ven.spring + Math.sin(a) * (ven.cw / 2 + 0.1), 0.06, 0.16, 0.16, 0.1); }
  B.box('plasterWhite', ven.c, ven.y0 - 0.2, 0.06, 2 * ven.b + 0.6, 0.4, 0.1); B.box('plasterWhite', ven.c, ven.y0 - 0.02, 0.09, 2 * ven.b + 0.7, 0.07, 0.18);
  for (let k = 0; k < 3; k++) { const a = ven.c - ven.b - 0.2 + k * (2 * ven.b + 0.4) / 3, w3 = (2 * ven.b + 0.4) / 3; for (let j = 0; j <= 8; j++) { const t = j / 8; B.box('plasterWhite', a + w3 * t, ven.y0 - 0.46 - Math.sin(Math.PI * t) * 0.2, 0.06, 0.07, 0.05, 0.04); } }
  // tall arabesque panels by the corners (their own UVs: one whole pattern to a panel), in plaster frames
  const panel = (s, w = 0.84, y0 = 1.75, y1 = 7.4) => { B.sign('panel', s - w / 2, y0, s + w / 2, y1, 0.03, [0, 0, 1, 1]); for (const sx of [-1, 1]) B.box('plasterWhite', s + sx * (w / 2 + 0.03), (y0 + y1) / 2, 0.03, 0.06, y1 - y0 + 0.12, 0.04); for (const y of [y0 - 0.03, y1 + 0.03]) B.box('plasterWhite', s, y, 0.03, w + 0.12, 0.06, 0.04); };
  for (const s of [ven.c - 3.75, ven.c + 3.75]) panel(s);
  // an oval portrait under the window, a sconce each side (placed below with the other sconces)
  const oval = (rx, ry, n = 20) => Array.from({ length: n }, (_, k) => [ven.c + Math.cos((k / n) * 2 * Math.PI) * rx, 2.2 + Math.sin((k / n) * 2 * Math.PI) * ry]);
  B.face('giltFrame', oval(0.5, 0.62), [], 0.04); B.face('canvasDark', oval(0.41, 0.53), [], 0.055);
  B.pop();
  B.push(FN); panel(L - 0.75, 0.7); B.pop(); B.push(FS); panel(0.75, 0.7); B.pop();
  // south wall: three plaster frames that mirror the north windows, a portrait in each (generic dark canvases in gilt
  // frames); the white marble chimney-piece under the middle one (behind it, the stack that rises over Pump Quad)
  const PU = S.portraitUV, FX = PL.fire.x, fs = L - FX;
  B.push(FS);
  NWIN.forEach((x, i) => { const s = L - x; dress(s); portrait(B, s, WY0 + 1.75, 1.05, 1.5, 3 + i, PU); });
  B.box('marble', fs, 0.8, 0.12, 2.3, 1.6, 0.24); B.box('marble', fs, 1.66, 0.2, 2.6, 0.14, 0.4);
  B.face('black', rectPts(fs - 0.6, 0.02, fs + 0.6, 1.1), [], 0.245);
  B.box('marble', fs, 0.02, 0.5, 2.6, 0.04, 0.6);
  for (const sx of [-1, 1]) { B.box('marble', fs + sx * 0.92, 0.75, 0.275, 0.3, 1.5, 0.07); B.box('marble', fs + sx * 0.92, 1.54, 0.29, 0.36, 0.1, 0.1); }   // jamb pilasters + blocks
  B.box('marble', fs, 1.34, 0.265, 1.0, 0.24, 0.05);                                                   // frieze tablet
  B.box('black', fs, 0.2, 0.36, 0.7, 0.3, 0.22); B.box('brass', fs, 0.1, 0.74, 1.6, 0.12, 0.025);       // grate, brass fender
  B.pop();
  col.addBox(FX, hz - 0.2, 2.6, 0.5, 0);
  B.push(FW); portrait(B, hz, 5.6, 1.0, 1.3, 6, PU); B.pop();
  // brass candle sconces (electric): one under each window and frame, two under the Venetian window (the photograph)
  const sconce = (F, s, y) => { B.push(F); B.box('brass', s, y, 0.08, 0.06, 0.25, 0.12); for (const sx of [-1, 1]) { B.box('brass', s + sx * 0.12, y + 0.05, 0.16, 0.26, 0.03, 0.03); B.cyl('paper', s + sx * 0.22, y + 0.06, 0.16, 0.015, 0.12, 6, true); B.box('lamp', s + sx * 0.22, y + 0.21, 0.16, 0.04, 0.06, 0.04); } B.pop(); };
  for (const x of NWIN) sconce(FN, x, 2.5);
  for (const x of [NWIN[0], NWIN[2]]) sconce(FS, L - x, 2.5);
  for (const s of [ven.c - 1.55, ven.c + 1.55]) sconce(FE, s, 2.25);
  mats.lamp = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffd8a0, emissiveIntensity: 1.0 });
  // ---------------------------------------------------------------- west end: the screen of two Corinthian columns
  mats.column = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.6 });
  mats.gilt = new THREE.MeshStandardMaterial({ color: 0xd8b860, metalness: 0.5, roughness: 0.45 });
  const CT = HW - 1.0;                                 // the top of the capitals: the entablature fills the last metre under the cornice
  for (const z of COLS) {
    B.cyl('column', COLX, 0, z, 0.4, 0.3, 14, true); B.cyl('column', COLX, 0.3, z, 0.3, CT - 0.9, 16, false, 0.33);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; B.box('plasterWhite', COLX + Math.cos(a) * 0.31, 0.3 + (CT - 0.9) / 2, z + Math.sin(a) * 0.31, 0.03, CT - 1.0, 0.03, -a); }
    B.cyl('column', COLX, CT - 0.6, z, 0.42, 0.45, 12, false, 0.3); B.box('gilt', COLX, CT - 0.09, z, 0.7, 0.12, 0.7); B.box('column', COLX, CT + 0.04, z, 0.86, 0.14, 0.86);
    col.addCircle(COLX, z, 0.4);
  }
  // (G) a flat pilaster on each side wall behind the columns, under the same beam
  for (const sz of [-1, 1]) { B.box('column', COLX, CT / 2, sz * (hz - 0.06), 0.6, CT, 0.12); B.box('gilt', COLX, CT - 0.09, sz * (hz - 0.08), 0.7, 0.12, 0.16); }
  B.boxXZ('plasterWhite', COLX - 0.38, COLX + 0.38, CT + 0.11, HW - 0.2, -hz, hz, { bottom: true });
  mats.mahogany = new THREE.MeshStandardMaterial({ map: woodGrain(true), color: 0x7a3e22, roughness: 0.4 });
  B.push(FW);
  // the false doors (G: one in each side bay of the screen), mahogany
  const fw = 1.3, fh = 2.6;
  for (const z of [-3.4, 3.4]) {
    const s = hz - z;
    B.box('mahogany', s, fh / 2, 0.06, fw, fh, 0.08);
    for (const sx of [-1, 1]) for (const [a, b] of [[0.3, 1.2], [1.4, fh - 0.25]]) B.box('mahogany', s + sx * fw / 4, (a + b) / 2, 0.11, fw / 2 - 0.16, b - a, 0.03);
    B.box('plasterWhite', s, fh + 0.15, 0.1, fw + 0.5, 0.26, 0.2); for (const sx of [-1, 1]) B.box('plasterWhite', s + sx * (fw / 2 + 0.09), fh / 2, 0.08, 0.18, fh, 0.12);
  }
  // the real doorway: a white architrave and cornice; stone reveals through the wall's thickness; its pair of oak
  // leaves stands where the loggia's wall has its door (wingDoors; left ajar once used)
  B.box('plasterWhite', doorS, dh + 0.17, 0.1, PL.door.w + 0.6, 0.3, 0.2); for (const sx of [-1, 1]) B.box('plasterWhite', doorS + sx * (dw + 0.11), dh / 2, 0.08, 0.22, dh, 0.12);
  if (walkIn) doorReveal(B, 'stoneReveal', doorPts, PL);
  else { B.face('oak', doorPts, [], -0.4); B.reveal('plasterWhite', doorPts, 0, -0.4, true); }
  B.pop();
  if (walkIn) doorSill(B, 'flags', PL);
  const leafMat = wingLeafMat(S.oak);
  const doors = walkIn ? wingDoors(ctx, PL, { leaf: leafMat, handle: S.iron }) : null;
  wingLeafHeads(doors, PL, leafMat, S.iron);
  // ---------------------------------------------------------------- cornice, cove, ceiling
  for (const [x0, x1, z0, z1] of [[0, L, -hz, -hz + 0.3], [0, L, hz - 0.3, hz], [0, 0.3, -hz, hz], [L - 0.3, L, -hz, hz]]) B.boxXZ('plasterWhite', x0, x1, HW - 0.2, HW + 0.12, z0, z1, { bottom: true });
  const ct = hallCoveTex(); ct.repeat.set(1 / 3.2, 1); mats.cove = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9 });
  const NSEG = 6, y0c = HW + 0.12, rise = H.HC - y0c, inset = H.cove;
  const ring = (k) => { const th = (k / NSEG) * Math.PI / 2; return { d: inset * (1 - Math.cos(th)), y: y0c + rise * Math.sin(th), v: k / NSEG }; };
  for (let k = 0; k < NSEG; k++) {
    const a = ring(k), b = ring(k + 1);
    B.poly('cove', [[a.d, a.y, -hz + a.d], [L - a.d, a.y, -hz + a.d], [L - b.d, b.y, -hz + b.d], [b.d, b.y, -hz + b.d]], [0, -0.3, 1], [[a.d, a.v], [L - a.d, a.v], [L - b.d, b.v], [b.d, b.v]]);
    B.poly('cove', [[L - a.d, a.y, hz - a.d], [a.d, a.y, hz - a.d], [b.d, b.y, hz - b.d], [L - b.d, b.y, hz - b.d]], [0, -0.3, -1], [[L - a.d, a.v], [a.d, a.v], [b.d, b.v], [L - b.d, b.v]]);
    B.poly('cove', [[a.d, a.y, hz - a.d], [a.d, a.y, -hz + a.d], [b.d, b.y, -hz + b.d], [b.d, b.y, hz - b.d]], [1, -0.3, 0], [[hz - a.d, a.v], [-hz + a.d, a.v], [-hz + b.d, b.v], [hz - b.d, b.v]]);
    B.poly('cove', [[L - a.d, a.y, -hz + a.d], [L - a.d, a.y, hz - a.d], [L - b.d, b.y, hz - b.d], [L - b.d, b.y, -hz + b.d]], [-1, -0.3, 0], [[-hz + a.d, a.v], [hz - a.d, a.v], [hz - b.d, b.v], [-hz + b.d, b.v]]);
  }
  // three plaster roses along the ceiling (the research note); the chandeliers hang from the outer two (G: the
  // photograph shows one, large, east of the middle of the room)
  const fx0 = inset, fx1 = L - inset, fz = hz - inset, roses = [L / 2 - 4.4, L / 2, L / 2 + 4.4], hung = [roses[0], roses[2]];
  const cc = hallCeiling(fx1 - fx0, 2 * fz, roses.map((x) => x - fx0));
  const ctx2 = tex(cc, { wrap: false }); ctx2.repeat.set(1 / (fx1 - fx0), 1 / (2 * fz)); ctx2.offset.set(-fx0 / (fx1 - fx0), 0.5); ctx2.needsUpdate = true;
  mats.ceil = new THREE.MeshStandardMaterial({ map: ctx2, roughness: 0.9 });
  B.flat('ceil', [[fx0, -fz], [fx1, -fz], [fx1, fz], [fx0, fz]], H.HC, [], true);
  // cornice uplighting strip (1966)
  mats.uplight = new THREE.MeshBasicMaterial({ color: 0xfff0d0 });
  for (const [x0, x1, z0, z1] of [[0.3, L - 0.3, -hz + 0.3, -hz + 0.34], [0.3, L - 0.3, hz - 0.34, hz - 0.3]]) B.boxXZ('uplight', x0, x1, HW + 0.12, HW + 0.14, z0, z1);
  // chandeliers: a gilt body, two tiers of arms, candle lamps in tall glass shades (the photograph)
  mats.shade = new THREE.MeshStandardMaterial({ color: 0xf4efe2, emissive: 0xffd8a0, emissiveIntensity: 0.3, transparent: true, opacity: 0.5, roughness: 0.2, depthWrite: false });
  for (const x of hung) {
    B.cyl('brass', x, 5.6, 0, 0.02, H.HC - 5.6, 6, false);
    B.cyl('gilt', x, 4.55, 0, 0.16, 0.5, 10, true, 0.05); B.cyl('gilt', x, 5.05, 0, 0.1, 0.55, 10, true, 0.16);
    for (const [r, y, n] of [[0.78, 4.85, 8], [0.42, 5.4, 4]]) for (let k = 0; k < n; k++) { const a = ((k + (n === 4 ? 0.5 : 0)) / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = Math.sin(a) * r; B.beam('gilt', [x, y - 0.12, 0], [px, y, pz], 0.035); B.cyl('gilt', px, y, pz, 0.06, 0.03, 8, true); B.cyl('paper', px, y + 0.03, pz, 0.014, 0.13, 6, true); B.box('lamp', px, y + 0.2, pz, 0.035, 0.06, 0.035); B.cyl('shade', px, y + 0.03, pz, 0.065, 0.3, 8, false, 0.05); }
  }
  // ---------------------------------------------------------------- floor, dais, tables, benches, high table
  B.flat('flags', [[0, -hz], [L, -hz], [L, hz], [0, hz]], 0);
  B.boxXZ('oak', H.dais, L, 0, 0.25, -hz, hz);
  for (const z of TABLES) { refectoryTable(B, TX0, TX1, z, 'oak', 0.85); for (const s of [-1, 1]) benchAlong(B, TX0 + 0.1, TX1 - 0.1, z + s * 0.64, 'oak', 0.3); col.addBox((TX0 + TX1) / 2, z, TX1 - TX0, 1.62, 0); }
  // high table across the east end (on the dais): the Fellows' chairs along its east side, facing down the room, and
  // chairs tucked in along its west side (the photograph: a row of chair backs towards the hall)
  const HX = L - 1.6, HT = 3.3;
  B.push(new THREE.Matrix4().makeTranslation(0, 0.25, 0));
  B.boxXZ('oak', HX - 0.45, HX + 0.45, 0.7, 0.76, -HT, HT);
  for (const z of [-HT + 0.2, 0, HT - 0.2]) for (const s of [-1, 1]) B.box('oak', HX + s * 0.3, 0.35, z, 0.1, 0.7, 0.1);
  mats.redSeat = new THREE.MeshStandardMaterial({ color: 0x8a2030, roughness: 0.8 });
  const highSeats = [];
  for (let k = -3; k <= 3; k++) { const z = k * 0.95; chairAt(B, HX + 0.75, z, -Math.PI / 2, 'redSeat', 'mahogany', 1.05); highSeats.push({ x: HX + 0.72, z, h: -Math.PI / 2, y: 0.25 }); chairAt(B, HX - 0.62, z, Math.PI / 2, 'redSeat', 'mahogany', 1.05); }
  B.pop();
  col.addBox(HX + 0.085, 0, 1.83, 2 * HT, 0);      // the table with the chairs along both sides
  // side tables against the south wall between the fireplace and the high table (the photograph)
  B.boxXZ('mahogany', 12.5, 14.9, 0, 0.92, hz - 0.5, hz - 0.05); col.addBox(13.7, hz - 0.28, 2.4, 0.5, 0);
  // the hot counter across the servery door, behind the screen, and the stack of trays beside it
  mats.steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.6, roughness: 0.35 });
  const CN = HALL_MARKS.counter;
  B.boxXZ('steel', CN.x0, CN.x1, 0, 0.92, CN.z0, CN.z1); B.boxXZ('steel', CN.x0, CN.x1, 0.92, 0.96, CN.z0 - 0.05, CN.z1 + 0.05);
  for (let k = 0; k < 3; k++) B.boxXZ('steel', CN.x0 + 0.12 + k * 0.52, CN.x0 + 0.54 + k * 0.52, 0.96, 1.02, CN.z0 + 0.1, CN.z1 - 0.1);
  B.boxXZ('brass', CN.x0, CN.x1, 1.32, 1.36, CN.z0 - 0.1, CN.z1 + 0.1);      // the shelf over the hot plates, on four posts
  for (const x of [CN.x0 + 0.04, CN.x1 - 0.04]) for (const z of [CN.z0 + 0.03, CN.z1 - 0.03]) B.boxXZ('brass', x - 0.015, x + 0.015, 0.96, 1.32, z - 0.015, z + 0.015);
  col.addBox((CN.x0 + CN.x1) / 2, (CN.z0 + CN.z1) / 2 - 0.02, CN.x1 - CN.x0, 0.84, 0);
  mats.tray = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5 });
  B.boxXZ('tray', CN.x1 + 0.1, CN.x1 + 0.55, 0, 0.9, hz - 0.85, hz - 0.45);
  B.boxXZ('tray', CN.x1 + 0.1, CN.x1 + 0.55, 0.9, 1.05, hz - 0.85, hz - 0.45);
  col.addBox(CN.x1 + 0.325, hz - 0.65, 0.45, 0.4, 0);
  // the folding door stands open (dark beyond: the servery passage), its leaves folded back against the jambs
  B.push(FS); B.face('black', rectPts(sv0, 0, sv1, svH), [], -0.3); B.reveal('plasterWhite', rectPts(sv0, 0, sv1, svH), 0, -0.3, true);
  for (const [s, sg] of [[sv0, 1], [sv1, -1]]) for (let k = 0; k < 2; k++) B.box('mahogany', s + sg * (0.04 + k * 0.06), svH / 2, -0.14, 0.04, svH - 0.04, 0.3);
  B.box('plasterWhite', (sv0 + sv1) / 2, svH + 0.08, 0.04, sv1 - sv0 + 0.3, 0.16, 0.08);
  B.pop();
  // formal-hall candles on the tables (shown only at formal hall)
  const candleB = new Batch();
  for (const z of TABLES) for (let x = TX0 + 1.2; x < TX1 - 0.5; x += 2.4) { candleB.cyl('brass', x, 0.76, z, 0.05, 0.04, 8, true); candle(candleB, x, 0.8, z, 0.28); }
  for (let z = -2.4; z <= 2.41; z += 1.6) { candleB.cyl('brass', HX, 1.01, z, 0.05, 0.04, 8, true); candle(candleB, HX, 1.05, z, 0.3); }
  mats.cloth = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.9 });
  for (const z of TABLES) candleB.boxXZ('cloth', TX0 - 0.02, TX1 + 0.02, 0.761, 0.765, z - 0.45, z + 0.45);
  const formalGroup = new THREE.Group(); scene.add(formalGroup);
  buildBatch(candleB, formalGroup, mats);
  formalGroup.visible = false;
  // walls (the segment across the doorway stays: the room's portal opens it while the door is open)
  col.addSegment(0, -hz, L, -hz); col.addSegment(L, -hz, L, hz); col.addSegment(L, hz, 0, hz); col.addSegment(0, hz, 0, -hz);
  // dais front edge is a step (0.25) — walkable
  ctx.setGround((x, z) => (x >= H.dais ? 0.25 : 0));

  const meshes = buildBatch(B, scene, mats);
  const { amb, hemi } = ambientOf(scene);
  const sun = new THREE.DirectionalLight(0xfff4e0, 0.9); sun.position.set(L / 2 + 2, 12, -12); sun.target.position.set(L / 2, 0, 2); scene.add(sun, sun.target);
  const chand = hung.map((x) => addPoint(scene, x, 4.7, 0, 0xffd29a, 3, 15));

  // seats: student benches (both sides of each table), high table. (84 bench places: worcester_interiors.js seats its
  // diners 13 apart, which must stay coprime with this number.)
  const seats = [];
  for (const z of TABLES) for (const s of [-1, 1]) for (let x = TX0 + SEAT0; x < TX1 - 0.4; x += SEAT) seats.push({ x: +x.toFixed(3), z: z + s * 0.68, h: s > 0 ? Math.PI : 0, table: z });
  let tris = 0; for (const m of meshes) tris += m.geometry.attributes.position.count / 3;
  return {
    meshes, tris, seats, highSeats, formalGroup, doors, plan: PL,
    spawn: [1.2, H.door.z], heading: Math.PI / 2, exit: [0.7, H.door.z],
    servery: HALL_MARKS.servery,
    staff: [9.0, HALL_MARKS.aisle, 0],                 // where the hall steward stands between meals (the aisle south of the middle row)
    setLight(day, evening, formal) {
      // (evening 0..1 = the chandeliers and sconces are ON: at a meal, in the early evening, or while you are in the room;
      //  an empty Hall after hours is dark from the forecourt and the street)
      mats.sky.userData.setDay(day); mats.stained.userData.setDay(day); ST.setDay(day, Math.max(evening, formal ? 1 : 0)); mats.glassOut.userData.setDay(day); leafMat.userData.setDay(day);
      // (the cornice's uplighting is one of the room's lights: off with them — it used to burn in the empty Hall all night)
      mats.uplight.color.setHex(0xfff0d0).multiplyScalar(formal || evening ? 1 : 0.06 + 0.5 * day);
      sun.intensity = 0.1 + day * 1.0;
      if (amb) amb.intensity = 0.07 + 0.18 * Math.max(day, evening) + day * 0.4; if (hemi) hemi.intensity = 0.05 + 0.15 * Math.max(day, evening) + day * 0.35;
      const li = formal ? 2.2 : evening ? 1.2 + evening * 3.5 : 0.1 + day * 1.1;
      for (const l of chand) l.intensity = li;
      mats.lamp.emissiveIntensity = formal ? 0.6 : evening ? 0.4 + evening * 1.2 : 0.05;
      mats.shade.emissiveIntensity = formal ? 0.4 : evening ? 0.3 + evening * 0.6 : 0.05;
      formalGroup.visible = !!formal;
    },
  };
}
