// Exeter College, STANDALONE model, part 'hallint': the build functions of the Hall's INTERIOR. Everything is drawn in
// the Hall's sheared frame (_exeter_hall_build.js pushHall / hallCtx: hall u = LOCAL u, hall z = LOCAL v less the
// shear), in the room's four inner-face frames:
//   FIN  north inner face (faces south into the room), s = u - ROOM.uW, z = hall z - ROOM.zN (negative = into the wall)
//   FIS  south inner face (faces north), s = ROOM.uE - u, z = ROOM.zS - hall z
//   FIW  west gable's inner face (faces east), s = ROOM.zS - hall z
//   FIE  east (dais) wall (faces west), s = hall z - ROOM.zN
// Figures and sources: _exeter_hallint_plan.js. Reusable pieces: _exeter_interior_kit.js.
import * as K from './_exeter_kit.js';
import * as IK from './_exeter_interior_kit.js';
import { HALL, WIN, PORCH, ORIEL } from './_exeter_hall_plan.js';
import { pushHall, hallCtx, hallToL, hallDirToL, shearMatrix, orielPts } from './_exeter_hall_build.js';
import {
  F, ROOM, MID, HT, PITCH, TRUSSES, REAR, NORTH_BAYS, SOUTH_BAYS, BAY, SCREEN, GALLERY, VAULT, WEST_DOORS, STAIR,
  GALLERY_DOOR, FIRE, ROWS, TABLE, HIGH, CHAIR, LAMP, PORCH_IN,
} from './_exeter_hallint_plan.js';

const { frame, rectPts, THREE } = K;
const { fourPts, roundPts } = IK;
const R = ROOM, WP = F + HT.plate, RIDGE = F + HT.ridge, W = R.zS - R.zN;
const FIN = () => frame(R.uW, 0, R.zN, 1, 0), sIN = (u) => u - R.uW;
const FIS = () => frame(R.uE, 0, R.zS, -1, 0), sIS = (u) => R.uE - u;
const FIW = () => frame(R.uW, 0, R.zS, 0, -1), sIW = (z) => R.zS - z;
const FIE = () => frame(R.uE, 0, R.zN, 0, 1), sIE = (z) => z - R.zN;
/** the boarding's height over hall z (the underside of the roof) */
const roofY = (z) => WP + PITCH * Math.min(z - R.zN, R.zS - z);
const zOnSlope = (y, north) => (north ? R.zN + (y - WP) / PITCH : R.zS - (y - WP) / PITCH);

/** the interior's own tinted cells (the college atlas; no new material) */
export function interiorCells(pack) {
  K.addCell(pack, 'hallStone', 'stone', [1.08, 1.04, 0.95], { seed: 0.2 });      // the coursed stone inside (sheltered, warm bounce)
  K.addCell(pack, 'hallDress', 'stoneDress', [1.12, 1.09, 1.02], { seed: 0 });
  // (2026-11-23, after a walk by day: the room is lit only by the sky through its windows and the panelling, tables and
  //  chairs read near-black; their tints are LINEAR multipliers of the atlas's light neutral boards, so they are set by
  //  the 2010 photograph's look in the room's light (warm mid-brown oak, glossy chestnut tables, aubergine chairs), not
  //  by the wood's colour in full sun. By night under the lamps they read a little lighter than before.)
  K.addCell(pack, 'hallOak', 'boards', [0.62, 0.36, 0.17]);        // panelling, screen, tables' frames
  K.addCell(pack, 'hallOakDk', 'boards', [0.4, 0.22, 0.1]);        // the screen's darker members, chair frames
  K.addCell(pack, 'roofOak', 'boards', [0.14, 0.085, 0.05]);       // the roof's dark-stained timbers (dark in every photograph)
  K.addCell(pack, 'hallPlaster', 'plaster', [1.0, 0.94, 0.82]);
  K.addCell(pack, 'hallFloor', 'white', 0xe9e3d4);
  K.addCell(pack, 'portraitFrame', 'gold', 0x7a5a2a);
  K.addCell(pack, 'portraitDark', 'dark', 0x2c241b);
  K.addCell(pack, 'portraitSmudge', 'dark', 0x6a5640);
  K.addCell(pack, 'portraitBody', 'dark', 0x3e3026);
  K.addCell(pack, 'chairCloth', 'dark', [0.4, 0.1, 0.26]);         // aubergine (N Smith 2010)
  K.addCell(pack, 'brass', 'gold', 0xb89848);
  K.addCell(pack, 'tableTop', 'boards', [0.64, 0.3, 0.115]);       // the polished chestnut tops (N Smith 2010: they shine)
}

// ------------------------------------------------------------------------------------------------ walls, windows, floor
function northFace(ctx) {
  const { B } = ctx, L = R.uE - R.uW, holes = [];
  // rear arches of the four bays and of the porch bay's window (over the gallery)
  for (const u of NORTH_BAYS) holes.push(fourPts(sIN(u), REAR.w, REAR.sillN, REAR.spring, REAR.rise, 12));
  const PU = PORCH.upper, RP = REAR.porch, pc = PORCH.doorU;
  holes.push(fourPts(sIN(pc), RP.w, RP.sill, RP.spring, RP.rise, 12));
  // the arch from the porch, the oriel bay, the fireplace's opening
  const A = PORCH.arch;
  holes.push(fourPts(sIN((A.u0 + A.u1) / 2), A.u1 - A.u0, F, F + A.spring, A.rise, 10));
  holes.push(rectPts(sIN(BAY.u0), F, sIN(BAY.u1), BAY.head));
  B.push(FIN());
  B.face('hallStone', [[0, F - 0.05], [L, F - 0.05], [L, WP], [0, WP]], holes, 0);
  // splays: the glass's outline at the end of the outer reveal (z = -(wall - reveal)) to the rear arch
  const zg = -(HALL.wall - WIN.reveal);
  for (const u of NORTH_BAYS) IK.splay(B, 'hallStone', fourPts(sIN(u), WIN.w, WIN.sill, WIN.spring, WIN.apex - WIN.spring, 12), zg, fourPts(sIN(u), REAR.w, REAR.sillN, REAR.spring, REAR.rise, 12), 0);
  IK.splay(B, 'hallStone', fourPts(sIN(pc), PU.w, PU.sill, PU.spring, PU.apex - PU.spring, 12), zg, fourPts(sIN(pc), RP.w, RP.sill, RP.spring, RP.rise, 12), 0);
  // the bay's reveal through the wall
  B.reveal('hallStone', rectPts(sIN(BAY.u0), F, sIN(BAY.u1), BAY.head), 0, -HALL.wall, true);
  // wainscot (skipping the porch arch, the bay, the fireplace), then the fireplace
  IK.wainscot(B, 'hallOak', sIN(R.screenE), sIN(BAY.u0), F, F + HT.wainscot, 0, { skip: [[sIN(FIRE.u) - FIRE.w / 2, sIN(FIRE.u) + FIRE.w / 2]] });
  fireplaceOak(B, sIN(FIRE.u));
  B.pop();
}
function southFace(ctx) {
  const { B } = ctx, L = R.uE - R.uW, holes = [], rear = (u) => fourPts(sIS(u), u < R.screenE ? 2.4 : REAR.w, u < R.screenE ? REAR.sillPassage : REAR.sillS, REAR.spring, REAR.rise, 12);
  for (const u of SOUTH_BAYS) holes.push(rear(u));
  B.push(FIS());
  B.face('hallStone', [[0, F - 0.05], [L, F - 0.05], [L, WP], [0, WP]], holes, 0);
  const zg = -(HALL.wall - WIN.reveal);
  for (const u of SOUTH_BAYS) IK.splay(B, 'hallStone', fourPts(sIS(u), WIN.w, WIN.sillS, WIN.spring, WIN.apex - WIN.spring, 12), zg, rear(u), 0);
  IK.wainscot(B, 'hallOak', 0, sIS(R.screenE), F, F + HT.wainscot, 0, { skip: [[sIS(FIRE.u) - FIRE.w / 2, sIS(FIRE.u) + FIRE.w / 2]] });
  fireplaceStone(B, sIS(FIRE.u));
  B.pop();
}
/** a gable's inner face: up to the wall plate at both sides and the boarding's apex in the middle */
function gableOutline(y0) { return [[0, y0], [W, y0], [W, WP], [W / 2, RIDGE], [0, WP]]; }
function westFace(ctx) {
  const { B } = ctx;
  B.push(FIW());
  B.face('hallPlaster', gableOutline(F - 0.05), [], 0);
  // the passage's walls are plastered (G); its doors to the servery and the kitchen side, shut
  for (const d of WEST_DOORS) { const s = sIW(d.z); B.unit('doorOak', K.tudorPts(s, d.w, F, F + d.h - 0.22, 0.22, 6), 0.03, [3, 0]); B.box('hallOakDk', s, F + d.h + 0.06, 0.04, d.w + 0.24, 0.12, 0.08, 0, {}); for (const sx of [-1, 1]) B.box('hallOakDk', s + sx * (d.w / 2 + 0.06), F + d.h / 2, 0.04, 0.12, d.h, 0.08, 0, {}); }
  // the gallery's door to staircase 3
  { const s = sIW(GALLERY_DOOR.z), y0 = F + GALLERY.floor; B.unit('doorOak', rectPts(s - GALLERY_DOOR.w / 2, y0, s + GALLERY_DOOR.w / 2, y0 + GALLERY_DOOR.h), 0.03, [5, 0]); B.box('hallOakDk', s, y0 + GALLERY_DOOR.h + 0.06, 0.04, GALLERY_DOOR.w + 0.2, 0.12, 0.08, 0, {}); }
  // portraits over the gallery (22/01860 west elevation: a big one between two pairs)
  IK.portrait(B, W / 2, F + 7.6, 1.5, 2.0, 0, 11);
  for (const [s, y, w, h, k] of [[W / 2 - 2.35, F + 6.6, 1.05, 1.35, 12], [W / 2 + 2.35, F + 6.6, 1.05, 1.35, 13], [W / 2 - 2.1, F + 8.4, 0.7, 0.9, 14], [W / 2 + 2.1, F + 8.4, 0.7, 0.9, 15]]) IK.portrait(B, s, y, w, h, 0, k);
  B.pop();
}
function eastFace(ctx) {
  const { B } = ctx, yd = F + R.dais.h;
  B.push(FIE());
  B.face('hallPlaster', gableOutline(F - 0.05), [], 0);
  IK.wainscot(B, 'hallOak', 0, W, yd, F + HT.wainscotE, 0, { rows: 3, pw: 0.55 });
  // the big portrait in the middle and the rows about it (N Smith 2010, 22/01860 east elevation)
  IK.portrait(B, W / 2, F + 5.3, 1.6, 2.2, 0, 1);
  const rows = [[F + 5.6, [W / 2 - 2.6, W / 2 + 2.6], 0.95, 1.25], [F + 3.55, [W / 2 - 3.3, W / 2 - 2.0, W / 2 - 0.65, W / 2 + 0.65, W / 2 + 2.0, W / 2 + 3.3], 0.85, 1.05], [F + 7.6, [W / 2 - 1.7, W / 2 + 1.7], 0.8, 1.0]];
  let k = 2; for (const [y, ss, w, h] of rows) for (const s of ss) IK.portrait(B, s, y, w, h, 0, k++);
  for (const s of [W / 2 - 1.5, W / 2, W / 2 + 1.5]) IK.portrait(B, s, F + HT.wainscotE - 0.55, 0.5, 0.6, 0.06, k++, { frameKey: 'gold' });     // small ovals on the panelling (drawn square)
  B.pop();
}
/** portraits on the piers between the windows of the long walls */
function pierPortraits(ctx) {
  const { B } = ctx;
  B.push(FIN());
  const nb = [...NORTH_BAYS].sort((a, b) => a - b);
  for (let i = 0; i < nb.length - 1; i++) { const u = (nb[i] + nb[i + 1]) / 2; if (Math.abs(u - FIRE.u) < 0.2) { IK.portrait(B, sIN(u), F + 3.2, 0.45, 0.62, 0, 20 + i); continue; } IK.portrait(B, sIN(u), F + 2.5, 0.45, 0.62, 0, 20 + i); IK.portrait(B, sIN(u), F + 3.4, 0.45, 0.62, 0, 30 + i); }
  IK.portrait(B, sIN(R.screenE + 0.65), F + 2.8, 0.7, 0.95, 0, 40);
  B.pop();
  B.push(FIS());
  const sb = SOUTH_BAYS.filter((u) => u > R.screenE).sort((a, b) => a - b);
  for (let i = 0; i < sb.length - 1; i++) { const u = (sb[i] + sb[i + 1]) / 2; if (Math.abs(u - FIRE.u) < 0.2) continue; IK.portrait(B, sIS(u), F + 2.6, 0.45, 0.65, 0, 50 + i); }
  IK.portrait(B, sIS(R.screenE + 0.65), F + 2.6, 0.7, 0.95, 0, 60);
  B.pop();
}
function fireplaceOak(B, s) {
  const Fp = FIRE, [ow, oh] = Fp.open, z = Fp.breast;
  B.box('hallOak', s, F + Fp.surround / 2, z / 2, Fp.w, Fp.surround, z, 0, {});      // the breast and surround, oak-faced
  B.face('dark', rectPts(s - ow / 2, F, s + ow / 2, F + oh), [], z + 0.005);
  B.box('hallOakDk', s, F + Fp.surround + 0.05, z / 2 + 0.06, Fp.w + 0.16, 0.1, z + 0.12, 0, { bottom: true });     // the shelf
  for (const sx of [-1, 1]) B.box('hallOakDk', s + sx * (ow / 2 + 0.22), F + oh / 2 + 0.1, z + 0.03, 0.18, oh + 0.2, 0.06, 0, {});
  B.box('hallOakDk', s, F + oh + 0.18, z + 0.03, ow + 0.6, 0.16, 0.06, 0, {});
  B.box('hallDress', s, F + 0.02, z + 0.35, ow + 0.8, 0.04, 0.7, 0, {});     // the hearth stone
}
function fireplaceStone(B, s) {
  const Fp = FIRE, [ow, oh] = Fp.open, z = Fp.breast, OM = Fp.overmantel;
  B.box('hallDress', s, F + Fp.surround / 2 + 0.3, z / 2, Fp.w, Fp.surround + 0.6, z, 0, {});
  B.face('dark', rectPts(s - ow / 2, F, s + ow / 2, F + oh), [], z + 0.005);
  for (const sx of [-1, 1]) B.box('hallDress', s + sx * (ow / 2 + 0.25), F + oh / 2, z + 0.08, 0.26, oh, 0.16, 0, {});      // pilasters
  B.box('hallDress', s, F + Fp.surround + 0.42, z / 2 + 0.06, Fp.w + 0.14, 0.12, z + 0.12, 0, { bottom: true });
  B.box('hallDress', s, (F + Fp.surround + 0.48 + F + OM.top) / 2, z / 2, OM.w, OM.top - Fp.surround - 0.48, z, 0, {});   // the overmantel
  IK.portrait(B, s, F + (Fp.surround + 0.48 + OM.top) / 2, OM.w - 0.5, 0.55, z, 70, { frameKey: 'hallDress', canvasKey: 'hallStone', smudgeKey: 'hallDress', bodyKey: 'hallStone' });   // (a carved panel: drawn plain)
  for (const sx of [-1, 1]) K.pinnacle(B, 'hallDress', s + sx * (Fp.w / 2 - 0.2), z / 2, F + Fp.surround + 0.48, F + Fp.surround + 0.75, 0.16, 0.55);
  B.box('hallDress', s, F + 0.02, z + 0.35, ow + 0.8, 0.04, 0.7, 0, {});
}
function floors(ctx) {
  const { B } = ctx, fy = F + 0.002;
  // the hall's floor east of the screen, the dais, the passage (flags), the porch
  B.flat('hallFloor', [[R.screenE, R.zN], [R.dais.u, R.zN], [R.dais.u, R.zS], [R.screenE, R.zS]], fy);
  B.flat('hallFloor', [[R.dais.u, R.zN], [R.uE, R.zN], [R.uE, R.zS], [R.dais.u, R.zS]], F + R.dais.h);
  B.poly('hallOakDk', [[R.dais.u, F, R.zS], [R.dais.u, F, R.zN], [R.dais.u, F + R.dais.h, R.zN], [R.dais.u, F + R.dais.h, R.zS]], [-1, 0, 0]);
  B.flat('pavingSolid', [[R.uW, R.zN], [R.screenE, R.zN], [R.screenE, R.zS], [R.uW, R.zS]], fy);
  // the black diamonds at the flags' corners (0.6 m flags square to the walls)
  const st = 0.6, d = 0.075;
  for (let u = R.screenE + st; u < R.uE - 0.1; u += st) for (let z = R.zN + st * 0.65; z < R.zS - 0.1; z += st) {
    const y = u > R.dais.u ? F + R.dais.h + 0.004 : fy + 0.003;
    if (Math.abs(u - R.dais.u) < 0.1) continue;
    B.poly('dark', [[u, y, z - d], [u + d, y, z], [u, y, z + d], [u - d, y, z]], [0, 1, 0]);
  }
  ctx.floor([[R.uW, R.zN], [R.uE, R.zN], [R.uE, R.zS], [R.uW, R.zS]], F);
  ctx.floor([[R.dais.u, R.zN], [R.uE, R.zN], [R.uE, R.zS], [R.dais.u, R.zS]], F + R.dais.h);
  // the porch's arch through the north wall: level with both
  const A = PORCH.arch; ctx.floor([[A.u0, HALL.vN - 0.05], [A.u1, HALL.vN - 0.05], [A.u1, R.zN + 0.05], [A.u0, R.zN + 0.05]], F);
  B.flat('pavingSolid', [[A.u0, HALL.vN], [A.u1, HALL.vN], [A.u1, R.zN], [A.u0, R.zN]], fy);
}

// ------------------------------------------------------------------------------------------------ the oriel bay
function orielBay(ctx, gl) {
  const { B } = ctx, yd = F + R.dais.h, [P0, P1, P2, P3] = orielPts();
  const zIn = ORIEL.z + BAY.wall;
  const ring = [[BAY.u0, R.zN], [BAY.u0, HALL.vN], [P1[0] + 0.12, zIn], [P2[0] - 0.12, zIn], [BAY.u1, HALL.vN], [BAY.u1, R.zN]];
  B.flat('hallFloor', ring, yd);
  B.flat('hallPlaster', ring, BAY.head, [], true);
  ctx.floor(ring, yd);
  // the oriel's walls inside: each face 0.3 in from the outside's, the window's reveal from the glass to it
  for (const [i, [a, b]] of [[P3, P2], [P2, P1], [P1, P0]].entries()) {
    const Lw = Math.hypot(b[0] - a[0], b[1] - a[1]), Fr = frame(a[0], 0, a[1], b[0] - a[0], b[1] - a[1]), x0 = i === 1 ? 0.16 : 0.2, win = rectPts(x0, ORIEL.y[0], Lw - x0, ORIEL.y[1]);
    B.push(Fr);
    // (the east return has no window: part hall's north-east corner fills the junction with the east range outside it)
    B.face('hallStone', [[0, yd], [Lw, yd], [Lw, BAY.head], [0, BAY.head]], i === 0 ? [] : [win], -BAY.wall, true);
    if (i !== 0) B.reveal('hallStone', win, -0.24, -BAY.wall);
    if (i === 1) { B.box('hallOak', Lw / 2, (yd + ORIEL.y[0]) / 2, -BAY.wall - 0.3, Lw - 0.5, ORIEL.y[0] - yd - 0.05, 0.6, 0, {}); }      // the servery cupboard under the window (22/01860 "timber servery area")
    B.pop();
  }
  for (let i = 1; i < 4; i++) ctx.seg(ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]);
}

// ------------------------------------------------------------------------------------------------ the roof inside
function roof(ctx) {
  const { B } = ctx, u0 = R.uW, u1 = R.uE;
  // the plastered ceiling between the rafters (the boarding's underside)
  B.poly('hallPlaster', [[u0, WP, R.zN], [u1, WP, R.zN], [u1, RIDGE, MID], [u0, RIDGE, MID]], [0, -1, 1 / PITCH]);
  B.poly('hallPlaster', [[u0, RIDGE, MID], [u1, RIDGE, MID], [u1, WP, R.zS], [u0, WP, R.zS]], [0, -1, -1 / PITCH]);
  // wall plates with a moulded cornice, purlins, a ridge piece
  for (const [z, sg] of [[R.zN, 1], [R.zS, -1]]) { B.beam('roofOak', [u0, WP - 0.12, z + sg * 0.14], [u1, WP - 0.12, z + sg * 0.14], 0.28, 0.24); B.beam('roofOak', [u0, WP - 0.3, z + sg * 0.06], [u1, WP - 0.3, z + sg * 0.06], 0.12, 0.12); }
  const PY = HT.purlins.map((h) => F + h);
  for (const y of PY) for (const north of [true, false]) { const z = zOnSlope(y, north) + (north ? 0.08 : -0.08); B.beam('roofOak', [u0, y - 0.14, z], [u1, y - 0.14, z], 0.18, 0.22); }
  B.beam('roofOak', [u0, RIDGE - 0.1, MID], [u1, RIDGE - 0.1, MID], 0.14, 0.2);
  // close-set rafters
  for (let u = u0 + 0.25; u < u1; u += 0.5) for (const north of [true, false]) B.beam('roofOak', [u, WP - 0.04, north ? R.zN + 0.05 : R.zS - 0.05], [u, RIDGE - 0.06, MID], 0.09, 0.1);
  // arched wind-braces in every panel (bay x tier), in the roof's plane, rising from the purlin (or plate) below to
  // the one above at mid-bay
  const lev = [WP, ...PY];
  for (let i = 0; i < TRUSSES.length - 1; i++) {
    const a = TRUSSES[i] + 0.12, b = TRUSSES[i + 1] - 0.12;
    for (let j = 0; j < lev.length - 1; j++) for (const north of [true, false]) {
      const y0 = lev[j] - 0.05, y1 = lev[j + 1] - 0.2, n = 6, pt = (k) => { const t = k / n, u = a + (b - a) * t, y = y0 + (y1 - y0) * Math.sin(Math.PI * t), z = zOnSlope(y, north) + (north ? 0.12 : -0.12); return [u, y - 0.06, z]; };
      for (let k = 0; k < n; k++) B.beam('roofOak', pt(k), pt(k + 1), 0.08, 0.1);
    }
  }
  // the trusses on their corbels
  for (const ut of TRUSSES) {
    const M = new THREE.Matrix4().set(0, 0, -1, ut, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
    B.push(M);
    IK.archTruss(B, 'roofOak', R.zN, R.zS, WP, PITCH, F + HT.corbel, F + HT.collar, F + HT.arch, { t: ut < R.uW + 0.5 || ut > R.uE - 0.5 ? 0.18 : 0.24, inset: 0.16 });
    B.pop();
    for (const [Fr, s] of [[FIN(), sIN(ut)], [FIS(), sIS(ut)]]) { B.push(Fr); IK.corbel(B, 'hallDress', s, F + HT.corbel, 0.4, 0.34, 0.6); B.pop(); }
  }
}

// ------------------------------------------------------------------------------------------------ the screen and the gallery
function screen(ctx, doors) {
  const { B } = ctx, S = SCREEN, uE = R.screenE, uW = uE - R.screenT, um = (uE + uW) / 2, zc = MID, top = F + S.top;
  const Fs = () => frame(uE, 0, R.zS, 0, -1), sS = (z) => R.zS - z;       // its east face (faces east, into the hall)
  const Fw = () => frame(uW, 0, R.zN, 0, 1), sW = (z) => z - R.zN;        // its west face (faces the passage)
  const doorsZ = [zc - S.doorZ, zc + S.doorZ], dTop = F + S.doorTop, dw = S.doorW, spring = dTop - dw / 2;
  const holes = (sf) => doorsZ.map((z) => roundPts(sf(z), dw, F, spring, 10));
  // the screen's body to the band (both faces), the doorways' reveals and the fanlights
  for (const [Fr, sf, key] of [[Fs, sS, 'hallOak'], [Fw, sW, 'hallOak']]) { B.push(Fr()); B.face(key, [[0, F - 0.05], [W, F - 0.05], [W, F + S.band], [0, F + S.band]], holes(sf), 0); B.pop(); }
  B.push(Fs());
  for (const z of doorsZ) {
    const s = sS(z), op = roundPts(s, dw, F, spring, 10);
    B.reveal('hallOakDk', op, 0, -R.screenT, true);
    // the fanlight: glass, a radiating set of bars and a hub (real glass both ways)
    const fan = [[s - dw / 2, spring], ...roundPts(s, dw, spring, spring, 10).slice(2)];
    ctx._gl.pane(Fs(), fan, -R.screenT / 2);
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI; B.beam('hallOakDk', [s, spring, -R.screenT / 2], [s + Math.cos(a) * dw / 2, spring + Math.sin(a) * dw / 2, -R.screenT / 2], 0.035, 0.04); }
    B.box('hallOakDk', s, spring, -R.screenT / 2, dw, 0.07, 0.08, 0, {});      // the transom the leaves shut against
    for (const r of [0.18, 0.38]) { const ring = roundPts(s, r * 2, spring, spring, 8).slice(2); for (let i = 0; i < ring.length - 1; i++) B.beam('hallOakDk', [ring[i][0], ring[i][1], -R.screenT / 2], [ring[i + 1][0], ring[i + 1][1], -R.screenT / 2], 0.035, 0.04); }
    // the moulded architrave round the arch
    const arc = roundPts(s, dw + 0.2, F, spring, 10).slice(2); for (let i = 0; i < arc.length - 1; i++) B.beam('hallOakDk', [arc[i][0], arc[i][1], 0.03], [arc[i + 1][0], arc[i + 1][1], 0.03], 0.1, 0.06);
  }
  // panels of the three panel bays (fielded squares with a lozenge, as plate 114: drawn as raised squares)
  const bays = [[0, sS(zc + S.cols[1])], [sS(zc + S.cols[0]), sS(zc - S.cols[0])], [sS(zc - S.cols[1]), W]];
  for (const [a, b] of bays) { const w = b - a - 0.3; if (w < 0.3) continue; const nx = Math.max(1, Math.round(w / 0.55)), ny = 4, pw = w / nx, ph = (F + S.frieze[0] - 0.15 - (F + 0.25)) / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = a + 0.15 + pw * (i + 0.5), y = F + 0.25 + ph * (j + 0.5); B.box('hallOakDk', x, y, 0.02, pw - 0.1, ph - 0.1, 0.04, 0, {}); B.box('hallOak', x, y, 0.05, pw * 0.45, ph * 0.45, 0.03, 0, {}); } }
  // columns on pedestals (and half-columns against the walls), the frieze, the cornice, the band of small panels
  const colS = [...S.cols.map((c) => sS(zc + c)), ...S.cols.map((c) => sS(zc - c))];
  for (const s of colS) {
    B.box('hallOakDk', s, F + S.pedestal[1] / 2, 0.12, S.pedestal[0], S.pedestal[1], 0.28, 0, {});
    B.cyl('hallOak', s, F + S.pedestal[1], 0.14, S.colR * 0.85, S.frieze[0] - S.pedestal[1] - 0.12, 8, false, S.colR);
    B.box('hallOakDk', s, F + S.frieze[0] - 0.06, 0.14, 0.3, 0.12, 0.3, 0, {});     // capital
  }
  for (const s of [0.08, W - 0.08]) B.box('hallOakDk', s, F + S.frieze[0] / 2, 0.06, 0.16, S.frieze[0], 0.14, 0, {});
  B.box('hallOakDk', W / 2, F + (S.frieze[0] + S.frieze[1]) / 2, 0.08, W, S.frieze[1] - S.frieze[0], 0.16, 0, { bottom: true });
  B.box('hallOak', W / 2, F + S.frieze[1] + 0.05, 0.14, W, 0.1, 0.28, 0, { bottom: true });       // the cornice
  for (let s = 0.3; s < W - 0.2; s += 0.42) B.box('hallOakDk', s, F + (S.top + S.band) / 2 + 0.02, 0.05, 0.3, S.band - S.top - 0.06, 0.04, 0, {});
  // the gallery front: pedestal blocks over the columns, fielded panels between, a capping rail
  B.box('hallOak', W / 2, F + (S.band + S.front) / 2, 0.06, W, S.front - S.band, 0.12, 0, {});
  for (const s of colS) B.box('hallOakDk', s, F + (S.band + S.front) / 2 + 0.05, 0.16, 0.3, S.front - S.band + 0.1, 0.2, 0, {});
  for (let s = 0.35; s < W - 0.3; s += 0.5) B.box('hallOakDk', s, F + (S.band + S.front) / 2, 0.13, 0.36, (S.front - S.band) * 0.55, 0.03, 0, {});
  B.box('hallOakDk', W / 2, F + S.front + 0.04, 0.08, W + 0.06, 0.08, 0.24, 0, { bottom: true });
  // the crestings: pierced strapwork (rings and scrolls of flat bars) over the three panel bays, the middle one taller
  // with a blank shield; obelisks over the inner columns; small figures (drawn as plain posts) on the pedestals
  const crest = (s, w, h, mid) => {
    const y0 = F + S.front + 0.08, cy = y0 + h * 0.5, r = Math.min(w, h) * 0.36;
    const ring = (x, y, rr, n = 12) => { for (let k = 0; k < n; k++) { const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2; B.beam('hallOakDk', [x + Math.cos(a0) * rr, y + Math.sin(a0) * rr, 0.08], [x + Math.cos(a1) * rr, y + Math.sin(a1) * rr, 0.08], 0.06, 0.05); } };
    ring(s, cy, r); ring(s, cy, r * 0.55, 10);
    for (const sx of [-1, 1]) { ring(s + sx * (w * 0.36), y0 + h * 0.28, h * 0.2, 10); B.beam('hallOakDk', [s + sx * r * 0.8, y0 + 0.02, 0.08], [s + sx * (w / 2), y0 + h * 0.5, 0.08], 0.06, 0.05); }
    B.beam('hallOakDk', [s - w / 2, y0 + 0.03, 0.08], [s + w / 2, y0 + 0.03, 0.08], 0.08, 0.06);
    B.box('hallOakDk', s, y0 + h - 0.06, 0.08, 0.1, 0.22, 0.06, 0, {});
    if (mid) B.poly('hallOak', [[s - 0.24, cy + 0.34, 0.12], [s + 0.24, cy + 0.34, 0.12], [s + 0.24, cy - 0.05, 0.12], [s, cy - 0.38, 0.12], [s - 0.24, cy - 0.05, 0.12]], [0, 0, 1]);
  };
  crest(W / 2, 1.6, S.crestMid - S.front - 0.08, true);
  for (const a of [[0, sS(zc + S.cols[1])], [sS(zc - S.cols[1]), W]]) crest((a[0] + a[1]) / 2, a[1] - a[0] - 0.3, S.crest - S.front - 0.08, false);
  for (const s of S.cols.map((c) => sS(zc + c)).concat(S.cols.map((c) => sS(zc - c)))) {
    if (Math.abs(s - W / 2) < 1) K.pinnacle(B, 'hallOakDk', s, 0.1, F + S.front + 0.1, F + S.front + 0.45, 0.16, S.obelisk - S.front - 0.45);
    else B.box('hallOak', s, F + S.front + 0.38, 0.1, 0.12, 0.6, 0.12, 0, {});
  }
  B.pop();
  // the gallery: floor over the passage, a plain back to the gable; the passage's vault under it (both faces drawn)
  const gy = F + GALLERY.floor;
  B.flat('hallOak', [[R.uW, R.zN], [uW, R.zN], [uW, R.zS], [R.uW, R.zS]], gy);
  const vs = F + VAULT.spring, vc = F + VAULT.crown, n = 8, span = uW - R.uW;
  for (let k = 0; k < n; k++) { const ua = R.uW + (span * k) / n, ub = R.uW + (span * (k + 1)) / n, ya = vs + (vc - vs) * Math.sin((Math.PI * k) / n), yb = vs + (vc - vs) * Math.sin((Math.PI * (k + 1)) / n); B.poly('hallPlaster', [[ua, ya, R.zN], [ub, yb, R.zN], [ub, yb, R.zS], [ua, ya, R.zS]], [0, -1, 0]); }
  // (the vault's lunettes at the long walls: the stone face shows above the springing; its north end opens over the arch)
  // doors: two pairs of oak leaves, opening into the hall
  for (const z of doorsZ) for (const [zh, a, sw] of [[z - dw / 2, 0, 1], [z + dw / 2, Math.PI, -1]]) {
    const [lu, lv] = hallToL(uE - 0.06, zh);
    doors.add({ name: 'screen', u: lu, v: lv, y: F, w: dw / 2 - 0.01, h: spring - F - 0.04, dir: hallDirToL(a), swing: sw, style: 'oak', heavy: true, thick: 0.06 });
  }
  // colliders: the screen with its two doorways open (the leaves are the doors' own)
  const segs = [[R.zN, doorsZ[0] - dw / 2], [doorsZ[0] + dw / 2, doorsZ[1] - dw / 2], [doorsZ[1] + dw / 2, R.zS]];
  for (const [a, b] of segs) ctx.solid([[uW, a], [uE, a], [uE, b], [uW, b]]);
}
function passage(ctx) {
  const { B } = ctx;
  // the boxed stair in the south-west corner (G), with a door
  const St = STAIR, y1 = F + St.h;
  B.box('hallOak', (St.u0 + St.u1) / 2, (F + y1) / 2, (St.z0 + R.zS) / 2, St.u1 - St.u0, y1 - F, R.zS - St.z0, 0, { top: false });
  B.push(frame(St.u1, 0, St.z0 - 0.003, -1, 0)); B.unit('doorOak', rectPts(0.25, F, 1.05, F + 2.05), 0, [7, 0]); B.pop();
  ctx.solid([[St.u0, St.z0], [St.u1, St.z0], [St.u1, R.zS], [St.u0, R.zS]]);
  // a lantern hanging in the passage (G)
  const u = (R.uW + R.screenE - R.screenT) / 2;
  B.cyl('ironBlack', u, F + 2.45, MID, 0.015, F + VAULT.crown - (F + 2.45), 4, false);
  ctx._shade(u, F + 2.25, MID, 0.16, 0.2);
}
function porchInside(ctx) {
  const { B } = ctx, P = PORCH_IN, y0 = F + P.vault[0], y1 = F + P.vault[1], zb = HALL.vN;
  // side walls' inner faces, the front wall's inner face round the door
  B.push(frame(P.u0, 0, zb, 0, -1)); B.face('hallStone', [[0, F - 0.05], [zb - P.zF, F - 0.05], [zb - P.zF, y0], [0, y0]], [], 0); B.pop();
  B.push(frame(P.u1, 0, P.zF, 0, 1)); B.face('hallStone', [[0, F - 0.05], [zb - P.zF, F - 0.05], [zb - P.zF, y0], [0, y0]], [], 0); B.pop();
  const D = PORCH.door, door = K.pointedPts(P.u1 - PORCH.doorU, D.w, PORCH.landing, D.spring, D.rise, 8);
  // (the front wall seen from inside: frame facing south at zF, s running west from u1 like the outside's)
  B.push(frame(P.u0, 0, P.zF, 1, 0));
  B.face('hallStone', [[0, F - 0.05], [P.u1 - P.u0, F - 0.05], [P.u1 - P.u0, y0], [0, y0]], [door.map(([s, y]) => [P.u1 - P.u0 - s, y])], 0);
  B.pop();
  // the vault: four cells to a boss, with diagonal ribs
  const c = [(P.u0 + P.u1) / 2, y1, (P.zF + zb) / 2], q = [[P.u0, y0, P.zF], [P.u1, y0, P.zF], [P.u1, y0, zb], [P.u0, y0, zb]];
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; B.poly('hallPlaster', [a, b, c], [c[0] - (a[0] + b[0]) / 2, -1, c[2] - (a[2] + b[2]) / 2]); B.beam('hallDress', a, c, 0.12, 0.1); }
  B.box('hallDress', c[0], y1 - 0.08, c[2], 0.22, 0.16, 0.22, 0, { bottom: true });
  ctx.solid([[P.u0 - 0.02, P.zF], [P.u0, P.zF], [P.u0, zb], [P.u0 - 0.02, zb]]);
  ctx.solid([[P.u1, P.zF], [P.u1 + 0.02, P.zF], [P.u1 + 0.02, zb], [P.u1, zb]]);
}

// ------------------------------------------------------------------------------------------------ furniture
function chair(B, u, z, face) {      // face: +1 looks toward +z (sits on the -z side of a table), -1 the other way
  const S = CHAIR, hw = S.w / 2, y = F + S.seat;
  B.box('hallOakDk', u, y - 0.03, z, S.w, 0.06, S.w, 0, { bottom: true });
  B.box('chairCloth', u, y + 0.015, z, S.w - 0.04, 0.03, S.w - 0.04, 0, {});
  B.box('chairCloth', u, (y + F + S.back) / 2 + 0.05, z - face * (hw - 0.03), S.w - 0.02, F + S.back - y - 0.1, 0.05, 0, {});
  for (const sx of [-1, 1]) B.box('hallOakDk', u + sx * (hw - 0.03), (F + y) / 2, z, 0.05, y - F - 0.06, S.w - 0.02, 0, { top: false });
}
function table(B, u0, u1, z, h = TABLE.h, w = TABLE.w, key = 'tableTop') {
  const y = F + h;
  B.box(key, (u0 + u1) / 2, y - TABLE.top / 2, z, u1 - u0, TABLE.top, w, 0, { bottom: true });
  const n = Math.max(1, Math.round((u1 - u0) / TABLE.seg));
  for (let i = 0; i <= n; i++) { const u = u0 + 0.12 + ((u1 - u0 - 0.24) * i) / n; B.box('hallOakDk', u, (F + y - TABLE.top) / 2, z, 0.08, y - TABLE.top - F, w - 0.16, 0, { top: false }); }
  B.box('hallOakDk', (u0 + u1) / 2, F + 0.12, z, u1 - u0 - 0.3, 0.06, 0.06, 0, {});
}
function lamp(ctx, u, y, z) {
  const { B } = ctx, L = LAMP;
  B.cyl('brass', u, y, z, 0.05, 0.03, 8, true, 0.07);
  B.cyl('brass', u, y + 0.03, z, 0.012, L.h - 0.08, 5, false);
  ctx._shade(u, y + L.h - 0.1, z, L.shadeR[1], L.shadeH, L.shadeR[0]);
}
function furniture(ctx) {
  const { B } = ctx, lights = [];
  let seats = 0;
  for (const r of ROWS) for (const [a, b] of r.pieces) {
    table(B, a, b, r.z);
    ctx.solid([[a, r.z - TABLE.w / 2], [b, r.z - TABLE.w / 2], [b, r.z + TABLE.w / 2], [a, r.z + TABLE.w / 2]]);
    const n = Math.floor((b - a) / CHAIR.pitch);
    for (let i = 0; i < n; i++) { const u = a + ((b - a) * (i + 0.5)) / n; chair(B, u, r.z - CHAIR.off, 1); chair(B, u, r.z + CHAIR.off, -1); seats += 2; }
    const nl = Math.max(1, Math.round((b - a) / LAMP.pitch));
    for (let i = 0; i < nl; i++) lamp(ctx, a + ((b - a) * (i + 0.5)) / nl, F + TABLE.h, r.z);
    // (the light map lights by position only, through walls: the strips are kept inside the room, the outer rows' half
    //  width 1.2 so that the north row's (z 23.6) stops 1.4 m short of the north face's inner side and 2.5 m of its outer)
    lights.push({ u: (a + b) / 2, z: r.z, len: (b - a) / 2 + 0.4, wid: r === ROWS[1] ? 1.5 : 1.2, k: 0.2 });
  }
  // the high table across the dais, its chairs facing down the hall
  const yd = R.dais.h;
  B.push(new THREE.Matrix4().makeTranslation(0, yd, 0));
  B.box('tableTop', HIGH.u, F + TABLE.h - TABLE.top / 2, (HIGH.z0 + HIGH.z1) / 2, HIGH.w, TABLE.top, HIGH.z1 - HIGH.z0, 0, { bottom: true });
  B.box('hallOakDk', HIGH.u, F + (TABLE.h - TABLE.top) / 2, (HIGH.z0 + HIGH.z1) / 2, HIGH.w - 0.2, TABLE.h - TABLE.top, HIGH.z1 - HIGH.z0 - 0.3, 0, { top: false });
  const n = Math.floor((HIGH.z1 - HIGH.z0) / 0.7);
  for (let i = 0; i < n; i++) {
    const z = HIGH.z0 + ((HIGH.z1 - HIGH.z0) * (i + 0.5)) / n;
    B.push(new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(HIGH.u + 0.62, 0, z)); chair(B, 0, 0, 1); B.pop(); seats++;
  }
  B.pop();
  ctx.solid([[HIGH.u - HIGH.w / 2, HIGH.z0], [HIGH.u + HIGH.w / 2, HIGH.z0], [HIGH.u + HIGH.w / 2, HIGH.z1], [HIGH.u - HIGH.w / 2, HIGH.z1]]);
  for (let i = 0; i < 3; i++) lamp(ctx, HIGH.u, F + yd + TABLE.h, HIGH.z0 + ((HIGH.z1 - HIGH.z0) * (i + 0.5)) / 3);
  lights.push({ u: HIGH.u, z: (HIGH.z0 + HIGH.z1) / 2, len: 0.9, wid: (HIGH.z1 - HIGH.z0) / 2 + 0.5, k: 0.22, along: 'z' });
  return { lights, seats };
}

// ------------------------------------------------------------------------------------------------ the whole room
/**
 * Build the interior into ctx.B (LOCAL) and its own glass and lamp shades into a Glazing (ctx.group); returns
 * { doors, lights (LOCAL, for the light map), seats }.
 */
export function buildInterior(ctx0) {
  const ctx = hallCtx(ctx0), { B } = ctx;
  interiorCells(ctx0.pack);
  const gl = new IK.Glazing(); gl.B.push(shearMatrix());
  const doors = new IK.DoorSet();
  ctx._gl = gl;
  ctx._shade = (u, y, z, r1, h, r0 = r1 * 0.6) => { gl.B.cyl('shade', u, y, z, r0, h, 10, false, r1); };
  pushHall(B);
  floors(ctx); northFace(ctx); southFace(ctx); westFace(ctx); eastFace(ctx); pierPortraits(ctx);
  orielBay(ctx, gl); roof(ctx); screen(ctx, doors); passage(ctx); porchInside(ctx);
  const fu = furniture(ctx);
  // colliders: the room's inner faces (the porch arch and the oriel bay open), the passage's west wall, the dais step is a floor
  const A = PORCH.arch;
  ctx.seg(R.uW, R.zN, A.u0, R.zN); ctx.seg(A.u1, R.zN, BAY.u0, R.zN); ctx.seg(BAY.u1, R.zN, R.uE, R.zN);
  ctx.seg(R.uE, R.zN, R.uE, R.zS); ctx.seg(R.uE, R.zS, R.uW, R.zS); ctx.seg(R.uW, R.zS, R.uW, R.zN);
  // (the follow camera stops 0.3 short of a collider: behind the high table it backed into the east gable's truss, whose
  //  braces then crossed the view as black strokes (the door walk, 2026-11-23); a line 0.35 in front of the gable keeps
  //  it out of the truss. Nobody walks that strip: the high table's chairs stand at 17.4)
  ctx.seg(R.uE - 0.35, R.zN, R.uE - 0.35, R.zS);
  ctx.seg(A.u0, R.zN, A.u0, HALL.vN); ctx.seg(A.u1, R.zN, A.u1, HALL.vN);
  ctx.seg(BAY.u0, R.zN, BAY.u0, HALL.vN); ctx.seg(BAY.u1, R.zN, BAY.u1, HALL.vN);
  for (const u of [FIRE.u]) { ctx.solid([[u - FIRE.w / 2, R.zN], [u + FIRE.w / 2, R.zN], [u + FIRE.w / 2, R.zN + FIRE.breast], [u - FIRE.w / 2, R.zN + FIRE.breast]]); ctx.solid([[u - FIRE.w / 2, R.zS - FIRE.breast], [u + FIRE.w / 2, R.zS - FIRE.breast], [u + FIRE.w / 2, R.zS], [u - FIRE.w / 2, R.zS]]); }
  B.pop(); gl.B.pop();
  gl.flush(ctx0);
  // the lamps' light after dark (LOCAL)
  const lights = fu.lights.map((l) => { const [u, v] = hallToL(l.u, l.z); return { u, v, len: l.along === 'z' ? l.wid : l.len, wid: l.along === 'z' ? l.len : l.wid, dir: hallDirToL(l.along === 'z' ? 0 : Math.PI / 2), k: l.k }; });
  lights.push((() => { const [u, v] = hallToL(-2.6, MID); return { u, v, len: 2.5, wid: 1.2, dir: 0, k: 0.22 }; })());
  return { doors, lights, seats: fu.seats };
}
