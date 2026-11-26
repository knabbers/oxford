// Christ Church — the Hall staircase and the Hall (showpieces, fine-detail pass: one merged mesh each on the shared
// fine material of _se_fine.js, plus the portraits).
//   buildStair(ctx, game)  the stair hall under Bodley's tower: fan vault (1638-40) springing from one central column,
//                          Wyatt's stair (1805) in two flights round the walls to the landing at the Hall door.
//   buildHall(ctx, game)   the Hall (1529): ~35 x 12 m, hammerbeam roof, panelling, generic portraits (invented
//                          canvases), four long tables with brass lamps, high table on the dais at the west end.
// Interior frames (metres, x east, z south, floor y = 0):
//   stair: x 0..11, z 0..11; door from Tom Quad on the north wall at x = 8.5; landing (y = STAIR.top) in the SW corner,
//          the Hall door on its west wall.
//   hall:  x -L..0, z -W/2..W/2; door at the east end (x = 0, z = 0); high table at the west end.
// Facts: docs/research/christ_church_botanic_magdalen.md §1.
import * as THREE from 'three';
import { Batch, frame, rectPts, sharedMats, portrait, refectoryTable, benchAlong, chairAt, addPoint, buildBatch } from './_worcint_kit.js';
import { lathe, pointedPts, prism } from './_chch_kit.js';
import { buildFine, stringCourse, hoodMould, tracery, ribStrip, col as col2 } from './_se_fine.js';
import { stonePassage, stoneRoom, stoneMats } from './_wc_stone.js';
import { stainedGlass, archLining, reveal } from './_walkin_city.js';
import { HALL_WIN, hallWinPts } from './_chch_tomquad.js';

export const STAIR = { W: 11, D: 11, H: 10.6, top: 4.4, door: [8.5, 0], hallDoor: [0.75, 8.6], column: [5.5, 5.5] };
export const HALL = { L: 35, W: 12, HW: 10, ridge: 15.5, dais: 4.6, daisH: 0.35, bay: 3.5, tables: [-4.2, -1.5, 1.5, 4.2], tx0: -29, tx1: -3, highX: -32.4 };

// ---- Walk-in (core/interiors.js "seamless"; plan in christ_church.js): the stair hall and the Hall are ONE room
// ('chch_hall', in the HALL's frame so everything in the Hall keeps its coordinates): the stair hall stands east of
// the Hall at offset (OX, -TOP, -OZ) — its floor is TOP below the Hall's — joined by a short passage through the wall
// from the landing. TOP is 3.3 m (not 4.4) so that the hammerbeam roof stays under the mapped building's ridge.
// The door from Tom Quad is in the bay of Bodley's tower west of the corner (doorX, in the stair hall's own x): a low
// pointed stone doorway (door.rise). The side windows are the front's (HALL_WIN, _chch_tomquad.js): each opening is the
// window's bounding rectangle, sill to point.
export const JOIN = { OX: 5.0, OZ: 7.6, TOP: 3.3, passW: 2.0, passH: 3.4, doorX: 7.0, door: { w: 1.6, h: 2.75, head: 'pointed', rise: 1.0 },
  win: { w: HALL_WIN.w, y0: HALL_WIN.sill, y1: HALL_WIN.spring + HALL_WIN.rise, head: 'pointed', rise: HALL_WIN.rise } };
/** the whole room's floor, in the Hall's frame */
export function joinedGround(x, z) { return x <= JOIN.OX ? (x < 0 ? hallGround(x) : 0) : stairGround(x - JOIN.OX, z + JOIN.OZ, JOIN.TOP) - JOIN.TOP; }

/** stair hall floor height */
export function stairGround(x, z, top) {
  const T = top ?? STAIR.top;
  if (x >= 8 && z >= 2.5 && z < 8.5) return Math.floor(((z - 2.5) / 6) * 12) / 12 * (T / 2);   // flight A (east wall), 12 risers
  if (x >= 8 && z >= 8.5) return T / 2;                                                           // half landing
  if (z >= 8 && x >= 2 && x < 8) return T / 2 + Math.floor(((8 - x) / 6) * 12) / 12 * (T / 2);  // flight B (south wall)
  if (x < 2 && z >= 6) return T;                                                                  // top landing
  return 0;
}
/** hall floor (the dais at the west end) */
export function hallGround(x) { return x < -HALL.L + HALL.dais ? HALL.daisH : 0; }

const T3 = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
/** a traceried window whose glass UV starts at its lower-left corner (so heraldic lights line up with the mullions) */
function glazed(B, x0, y0, w, sill2spring, k, o) {
  B.push(T3(x0, y0, 0));
  const pts = o.rise ? hallWinPts(w / 2, w, 0, sill2spring, o.rise) : pointedPts(w / 2, w, 0, sill2spring, k, 6);
  B.pop();
  return { pts: pts.map(([x, y]) => [x + x0, y + y0]), draw() { B.push(T3(x0, y0, 0)); tracery(B, pts, o); hoodMould(B, pts, { w: 0.13, d: 0.1, key: 'mouldPale', fromY: sill2spring - 0.1 }); B.pop(); } };
}

// ============================================================================================ the Hall staircase
export function buildStair(ctx, game, o = {}) {
  const SL = !!o.sl, S = sharedMats(game), B = new Batch(), sc = ctx.scene, col = ctx.collider, T = o.top ?? STAIR.top, H = STAIR.H, W = STAIR.W, D = STAIR.D;
  void S;
  // ---- walls (ashlar), with the two tall east windows, a string course at the springing of the vault
  const SP = 6.3;                                             // springing of the fans
  const eastW = [3, 8].map((z) => glazed(B, z - 0.9, 4.6, 1.8, 2.6, 0.8, { lights: 2, transoms: [1.3], headY: 2.6, glass: 'glassDay', bar: 'mouldPale', reveal: 'stoneIn', d: 0.5 }));
  // (walk-in: real doorways — the Tom Quad door in the north wall, the way through to the Hall from the landing)
  const gapN = SL ? [rectPts(JOIN.doorX - JOIN.door.w / 2, 0, JOIN.doorX + JOIN.door.w / 2, JOIN.door.h)] : [], gapW = SL ? [rectPts(D - JOIN.OZ - JOIN.passW / 2, T, D - JOIN.OZ + JOIN.passW / 2, T + JOIN.passH)] : [];
  const walls = [[0, 0, 1, 0, W, [], gapN], [W, D, -1, 0, W, [], []], [0, D, 0, -1, D, [], gapW], [W, 0, 0, 1, D, eastW, []]];
  for (const [x, z, ax, az, len, wins, gaps] of walls) {
    B.push(frame(x, 0, z, ax, az)); B.face('stoneIn', rectPts(0, 0, len, H), [...wins.map((w) => w.pts), ...gaps]); for (const w of wins) w.draw();
    stringCourse(B, 0, len, SP - 0.35, { h: 0.3, d: 0.16, key: 'mouldPale', ends: false });
    if (gaps === gapN && gapN.length) { const g0 = JOIN.doorX - JOIN.door.w / 2, g1 = JOIN.doorX + JOIN.door.w / 2; B.box('mouldPale', g0 / 2, 0.2, 0.05, g0, 0.4, 0.1); B.box('mouldPale', (g1 + len) / 2, 0.2, 0.05, len - g1, 0.4, 0.1); }   // (the plinth stops at the doorway)
    else B.box('mouldPale', len / 2, 0.2, 0.05, len, 0.4, 0.1);
    B.pop();
  }
  B.flat('flags', rectPts(0, 0, W, D), 0);
  B.flat('stoneFine', rectPts(0, 0, W, D), H, [], true);
  // ---- Wyatt's stair: two flights (solid stepped masses with nosings) and the landings
  for (let i = 0; i < 12; i++) { const z0 = 2.5 + i * 0.5, y = ((i + 1) / 12) * (T / 2); B.boxXZ('stonePale', 8, W, 0, y - 0.04, z0, z0 + 0.5); B.boxXZ('mouldPale', 7.96, W, y - 0.04, y, z0 - 0.04, z0 + 0.5); }
  B.boxXZ('stonePale', 8, W, 0, T / 2, 8.5, D);
  for (let i = 0; i < 12; i++) { const x1 = 8 - i * 0.5, y = T / 2 + ((i + 1) / 12) * (T / 2); B.boxXZ('stonePale', x1 - 0.5, x1, 0, y - 0.04, 8, D); B.boxXZ('mouldPale', x1 - 0.5, x1 + 0.04, y - 0.04, y, 7.96, D); }
  B.boxXZ('stonePale', 0, 2, 0, T, 6, D);
  // balustrades on the open sides: turned stone balusters under a moulded rail
  const rail = (x0, z0, x1, z1, y0, y1) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.34));
    for (let k = 0; k <= n; k++) { const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t; lathe(B, 'mouldPale', x, z, [[0.05, y], [0.085, y + 0.22], [0.04, y + 0.5], [0.06, y + 0.84]], 5, 0); }
    B.beam('mouldPale', [x0, y0 + 0.9, z0], [x1, y1 + 0.9, z1], 0.2, 0.12); B.beam('mouldPale', [x0, y0 + 0.03, z0], [x1, y1 + 0.03, z1], 0.18, 0.06);
  };
  rail(8, 2.5, 8, 8.5, 0, T / 2); rail(8, 8, 2, 8, T / 2, T); rail(0, 6, 2, 6, T, T); rail(2, 6, 2, 8, T, T);
  for (const [x, z, y] of [[8, 2.5, 0], [8, 8.25, T / 2], [2, 8, T], [2, 6, T]]) { B.box('stonePale', x, y + 0.55, z, 0.3, 1.1, 0.3); lathe(B, 'mouldPale', x, z, [[0.2, y + 1.1], [0.2, y + 1.18], [0.1, y + 1.22], [0.16, y + 1.36], [0, y + 1.5]], 8, 0); }
  col.addSegment(8, 2.5, 8, 8.4); col.addSegment(8.1, 8, 2, 8); col.addSegment(0, 6, 2, 6); col.addSegment(2, 6, 2, 7.9);
  // ---- the fan vault (1638-40): four bays round ONE slender pier. Every springing point carries a conoid of radius
  //      half a bay: the full fan on the pier, half fans on the walls, quarter fans in the corners; ribs double at each
  //      ring; a carved and gilded boss hangs in the middle of each bay's spandrel.
  const [cx, cz] = STAIR.column, R = Math.min(cx, cz, W - cx, D - cz) / 1 * 0.5 + 0.02, hF = H - SP;
  const prof = []; const NP = 9; for (let k = 0; k <= NP; k++) { const th = (k / NP) * Math.PI / 2; prof.push([0.3 + (R - 0.3) * (1 - Math.cos(th)), SP + hF * Math.sin(th)]); }
  const inRoom = (x, z) => x > -0.05 && x < W + 0.05 && z > -0.05 && z < D + 0.05;
  const fan = (fx, fz) => {
    lathe(B, 'stoneFine', fx, fz, prof, 24, 0);
    const rib = (a, k0, k1, w) => { const sa = Math.sin(a), ca = Math.cos(a); if (!inRoom(fx + sa * prof[k1][0] * 0.98, fz + ca * prof[k1][0] * 0.98)) return; const pts = []; for (let k = k0; k <= k1; k++) pts.push([fx + sa * prof[k][0], prof[k][1], fz + ca * prof[k][0]]); ribStrip(B, 'mouldPale', pts, (q) => { const i = Math.min(NP - 1, Math.max(0, pts.indexOf(q) + k0 - (pts.indexOf(q) === pts.length - 1 ? 1 : 0))), dr = prof[i + 1][0] - prof[i][0], dy = prof[i + 1][1] - prof[i][1], l = Math.hypot(dr, dy); return [sa * dy / l, -dr / l, ca * dy / l]; }, w); };
    for (let i = 0; i < 8; i++) rib((i / 8) * Math.PI * 2, 0, NP, 0.09);
    for (let i = 0; i < 8; i++) rib(((i + 0.5) / 8) * Math.PI * 2, 3, NP, 0.075);
    for (let i = 0; i < 16; i++) rib(((i + 0.5) / 16) * Math.PI * 2, 6, NP, 0.06);
    for (const k of [3, 6, NP]) { const [r, y] = prof[k], kk = Math.min(k, NP - 1), dr = prof[kk + 1][0] - prof[kk][0], dy = prof[kk + 1][1] - prof[kk][1], l = Math.hypot(dr, dy);
      for (let i = 0; i < 24; i++) { const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2, am = (a0 + a1) / 2; if (!inRoom(fx + Math.sin(am) * r * 0.97, fz + Math.cos(am) * r * 0.97)) continue; ribStrip(B, 'mouldPale', [[fx + Math.sin(a0) * r, y - (k === NP ? 0.02 : 0), fz + Math.cos(a0) * r], [fx + Math.sin(a1) * r, y - (k === NP ? 0.02 : 0), fz + Math.cos(a1) * r]], () => [Math.sin(am) * dy / l, -dr / l - (k === NP ? 1 : 0), Math.cos(am) * dy / l], 0.07); } }
  };
  for (const fx of [0, cx, W]) for (const fz of [0, cz, D]) fan(fx, fz);
  for (const bx of [cx / 2, (cx + W) / 2]) for (const bz of [cz / 2, (cz + D) / 2]) {
    lathe(B, 'mouldPale', bx, bz, [[0.62, H - 0.01], [0.55, H - 0.12], [0.3, H - 0.2], [0.2, H - 0.5], [0.1, H - 0.62], [0, H - 0.7]], 8, 0);
    lathe(B, 'gilt', bx, bz, [[0.12, H - 0.6], [0.16, H - 0.72], [0, H - 0.84]], 6, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; B.box('carve', bx + Math.sin(a) * 0.8, H - 0.04, bz + Math.cos(a) * 0.8, 0.3, 0.08, 0.14, a); }
  }
  // the pier: an octagonal shaft with four attached colonnettes, a moulded base and capital
  prism(B, 'mouldPale', cx, cz, 0.24, 0.5, SP - 0.3, 8, { cap: false });
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * Math.PI * 2; prism(B, 'mouldPale', cx + Math.sin(a) * 0.24, cz + Math.cos(a) * 0.24, 0.08, 0.5, SP - 0.3, 6, { cap: false }); }
  lathe(B, 'mouldPale', cx, cz, [[0.46, 0], [0.46, 0.22], [0.36, 0.34], [0.36, 0.44], [0.3, 0.52]], 8);
  lathe(B, 'mouldPale', cx, cz, [[0.3, SP - 0.4], [0.36, SP - 0.28], [0.3, SP - 0.2], [0.4, SP - 0.04], [0.4, SP + 0.06], [0.3, SP + 0.1]], 8);
  col.addCircle(cx, cz, 0.42);
  // ---- doors: Tom Quad (north wall) and the Hall (west wall at the landing): oak leaves in moulded pointed arches
  const door = (M, c) => { B.push(M); const pts = pointedPts(c, 1.8, 0, 2.3, 0.8, 5); B.face('darkWood', pts, [], 0.03); hoodMould(B, pts, { w: 0.16, d: 0.14, key: 'mouldPale', fromY: -1 }); B.box('oakDark', c, 1.45, 0.05, 0.05, 2.9, 0.04); for (const y of [0.5, 1.9]) B.box('iron', c, y, 0.06, 1.5, 0.07, 0.03); B.pop(); };
  if (!SL) { door(frame(8.5 - 0.9, 0, 0.0, 1, 0), 0.9); door(frame(0.0, T, 9.6, 0, -1), 1.0); }
  // a brass lantern hung from the central boss line
  for (const [lx, lz] of [[cx / 2, (cz + D) / 2], [(cx + W) / 2, cz / 2]]) { B.box('iron', lx, H - 1.5, lz, 0.03, 1.4, 0.03); B.box('lampOn', lx, H - 2.45, lz, 0.3, 0.46, 0.3); lathe(B, 'brass', lx, lz, [[0.24, H - 2.2], [0.1, H - 2.05], [0, H - 2.0]], 6); lathe(B, 'brass', lx, lz, [[0, H - 2.78], [0.2, H - 2.7], [0.22, H - 2.66]], 6); }
  buildFine(B, game.world, sc, 'chch:stair:fine', { interior: true, cast: false }).receiveShadow = false;
  if (SL) addPoint(sc, cx, H - 3.2, cz + 1.6, 0xffe2b0, 10, 18, 1.3);      // (one lamp: the joined room already has the Hall's)
  else { addPoint(sc, cx / 2, H - 2.6, (cz + D) / 2, 0xffe2b0, 7, 16, 1.3); addPoint(sc, (cx + W) / 2, H - 2.6, cz / 2, 0xffe2b0, 7, 16, 1.3); addPoint(sc, 9.6, 6, 5.5, 0xdfe8ff, 5, 12, 1.4); }
  if (!SL) ctx.setGround(stairGround);
  return { spawn: [8.5, 1.3], heading: 0 };
}

// ============================================================================================ the Hall
export function buildHall(ctx, game, o = {}) {
  // (walk-in: o.bays = { x0, bw, n } — the exterior's window bays in the Hall's x: the windows, portraits and trusses follow
  //  them, so the real openings are where the front's traceried windows are; o.open = [north[], south[]] which are real)
  const SL = !!o.sl, EB = SL ? o.bays : null;
  const S = sharedMats(game), B = new Batch(), BP = new Batch(), sc = ctx.scene, col = ctx.collider, H = EB ? { ...HALL, bay: HALL.L / EB.n } : HALL, L = H.L, hz = H.W / 2, HW = H.HW;
  const bays = Math.round(L / H.bay), PH = 3.36, WN = HALL_WIN;
  const sAt = (i, sd) => (EB ? (sd ? -(EB.x0 - (sd ? bays - 1 - i + 0.5 : i + 0.5) * EB.bw) : EB.x0 - (bays - 1 - i + 0.5) * EB.bw + L) : (i + 0.5) * H.bay);
  const isOpen = (i, sd) => !!(SL && o.open && o.open[sd] && o.open[sd][i]);                 // linenfold panelling: three tiers of 1.12 m
  const blind = [];      // (walk-in: every window's glass is leaded and coloured — stainedGlass in buildJoined — real opening or not)
  // ---- side walls: a tall three-light Perpendicular window in every bay, glazed with heraldic lights
  const sideWins = (sd) => { const out = []; for (let i = 0; i < bays; i++) { const s = sAt(i, sd); out.push(SL ? glazed(B, s - WN.w / 2, WN.sill, WN.w, WN.spring - WN.sill, 0, { rise: WN.rise, lights: 3, transoms: [WN.transom], headY: WN.spring - WN.sill, open: true, noReveal: isOpen(i, sd), bar: 'mouldPale', reveal: 'stoneIn', d: 0.55, bw: 0.1 })
      : glazed(B, s - 1.35, 5.0, 2.7, 3.6, 0.62, { lights: 3, transoms: [1.8], headY: 3.6, glass: 'herald', open: isOpen(i, sd), bar: 'mouldPale', reveal: 'stoneIn', d: 0.55, bw: 0.1 })); } return out; };
  for (const [M, sd] of [[frame(-L, 0, -hz, 1, 0), 0], [frame(0, 0, hz, -1, 0), 1]]) {
    B.push(M); const wins = sideWins(sd); B.face('stoneIn', rectPts(0, PH, L, HW), wins.map((w) => w.pts)); for (const w of wins) w.draw();
    B.face('linen', rectPts(0, 0, L, PH), [], 0.04); B.box('oakDark', L / 2, PH + 0.07, 0.07, L, 0.14, 0.14); B.box('gilt', L / 2, PH + 0.17, 0.06, L, 0.05, 0.08); B.box('oakDark', L / 2, 0.08, 0.06, L, 0.16, 0.08);
    for (let i = 0; i < bays; i++) { const s = sAt(i, sd); B.box('mouldPale', s, 4.93, 0.06, 3.0, 0.14, 0.2, 0, { bottom: true }); if (SL) blind.push({ at: sd ? [-s, hz] : [s - L, -hz], out: sd ? 0 : Math.PI, w: WN.w, y0: WN.sill, y1: WN.spring + WN.rise, head: 'pointed', rise: WN.rise, lights: 2, depth: 0.5, real: isOpen(i, sd) }); }
    stringCourse(B, 0, L, HW - 0.5, { h: 0.3, d: 0.16, key: 'oakDark', ends: false }); B.box('gilt', L / 2, HW - 0.28, 0.2, L, 0.06, 0.04);
    B.pop();
  }
  // gable ends: the door from the stair (east), the great window over high table (west)
  const gable = (c) => [[0, PH], [H.W, PH], [H.W, HW], [c, H.ridge], [0, HW]];
  { B.push(frame(0, 0, -hz, 0, 1)); const doorE = pointedPts(hz, 1.9, 0, 1.75, 0.8, 5);
    const w = glazed(B, hz - 1.8, 6.4, 3.6, 3.2, 0.62, { lights: 4, transoms: [1.8], headY: 3.2, glass: 'herald', open: SL, bar: 'mouldPale', reveal: 'stoneIn', d: 0.5 });
    if (SL) blind.push({ at: [0, 0], out: Math.PI / 2, w: 3.6, y0: 6.4, y1: 9.6 + 0.608 * 3.6, head: 'pointed', rise: 0.608 * 3.6, lights: 3, depth: 0.47 });
    B.face('stoneIn', gable(hz), [w.pts]); w.draw(); B.face('linen', rectPts(0, 0, hz - 1.15, PH), [], 0.04); B.face('linen', rectPts(hz + 1.15, 0, H.W, PH), [], 0.04); B.face('oakDark', rectPts(hz - 1.15, 0, hz + 1.15, PH), [doorE], 0.04);
    if (!SL) B.face('darkWood', doorE, [], 0.02); hoodMould(B, doorE, { w: 0.12, d: 0.1, key: 'gilt', fromY: 1.6, z: 0.04 }); B.box('oakDark', H.W / 2, PH + 0.07, 0.07, H.W, 0.14, 0.14); B.box('gilt', H.W / 2, PH + 0.17, 0.06, H.W, 0.05, 0.08); B.pop(); }
  { B.push(frame(-L, 0, hz, 0, -1)); const w = glazed(B, hz - 2.25, 6.2, 4.5, 4.0, 0.62, { lights: 5, transoms: [1.8, 3.6], headY: 4.0, glass: 'herald', open: SL, bar: 'mouldPale', reveal: 'stoneIn', d: 0.55, bw: 0.11 });
    if (SL) blind.push({ at: [-L, 0], out: -Math.PI / 2, w: 4.5, y0: 6.2, y1: 10.2 + 0.608 * 4.5, head: 'pointed', rise: 0.608 * 4.5, lights: 4, depth: 0.52 });
    B.face('stoneIn', gable(hz), [w.pts]); w.draw(); B.face('linen', rectPts(0, 0, H.W, PH + 1.12), [], 0.04); B.box('oakDark', H.W / 2, PH + 1.19, 0.07, H.W, 0.14, 0.14); B.box('gilt', H.W / 2, PH + 1.29, 0.06, H.W, 0.05, 0.08);
    // the canopy of state behind high table: a carved and gilded cresting
    for (let k = 0; k < 9; k++) { const s = hz - 3.2 + k * 0.8; lathe(B, 'gilt', s, 0.12, [[0.1, PH + 1.3], [0.16, PH + 1.42], [0.05, PH + 1.5], [0.09, PH + 1.6], [0, PH + 1.72]], 4, Math.PI / 4); }
    B.pop(); }
  // ---- floor (worn flags), the oak dais
  B.flat('flags', rectPts(-L, -hz, 0, hz), 0);
  B.boxXZ('oak', -L, -L + H.dais, 0, H.daisH, -hz, hz);
  // ---- portraits (invented canvases) in gilt frames on the panelling and above it, each with a brass picture light
  const PU = S.portraitUV;
  for (let i = 0; i < bays; i++) {
    for (const [M, k, sd] of [[frame(-L, 0, -hz, 1, 0), i % 8, 0], [frame(0, 0, hz, -1, 0), (i + 3) % 8, 1]]) {
      const s = sAt(i, sd);
      BP.push(M); portrait(BP, s, 4.12, 0.86, 1.1, k, PU, 0.06, 0.1); if (i % 2 === 0) portrait(BP, s + H.bay / 2, 2.2, 0.7, 0.9, (k + 5) % 8, PU, 0.07, 0.08); BP.pop();
      B.push(M); B.box('brass', s, 4.82, 0.2, 0.5, 0.04, 0.06); B.box('lampOn', s, 4.79, 0.2, 0.44, 0.02, 0.05); B.pop();
    }
  }
  BP.push(frame(-L, 0, hz, 0, -1)); portrait(BP, hz, 3.05, 1.5, 2.0, 4, PU, 0.07, 0.16); portrait(BP, hz - 3.4, 2.9, 1.0, 1.3, 1, PU, 0.07, 0.1); portrait(BP, hz + 3.4, 2.9, 1.0, 1.3, 2, PU, 0.07, 0.1); BP.pop();
  // ---- the hammerbeam roof: boarded slopes, and at every bay a truss — wall post on a stone corbel, hammer beam with a
  //      carved and gilded end, curved braces, hammer post, the great arch brace to the collar; purlins, ridge, gilt bosses
  for (const s of [-1, 1]) B.poly('oakRoof', [[-L, HW, s * hz], [0, HW, s * hz], [0, H.ridge, 0], [-L, H.ridge, 0]], [0, -1, -s]);
  const zh0 = hz - 2.0, yAt = (az) => HW + (H.ridge - HW) * (1 - az / hz);
  for (let i = 0; i <= bays; i++) {
    const x = Math.min(-0.16, Math.max(-L + 0.16, EB ? EB.x0 - (bays - i) * EB.bw : -L + i * H.bay));
    for (const s of [-1, 1]) {
      const zw = s * (hz - 0.14), zh = s * zh0;
      lathe(B, 'mouldPale', x, s * hz, [[0.02, 6.4], [0.2, 6.6], [0.3, 6.86], [0.34, 7.0], [0, 7.0]], 6, 0);          // corbel
      B.beam('oakDark', [x, 7.0, zw], [x, HW + 0.1, zw], 0.26, 0.3);                                                // wall post
      B.beam('oakDark', [x, HW, zw], [x, HW, zh], 0.3, 0.34);                                                       // hammer beam
      let pv = null; for (let k = 0; k <= 4; k++) { const t = (k / 4) * Math.PI / 2, pt = [x, 7.15 + 2.68 * Math.sin(t), zw + (zh + s * 0.2 - zw) * (1 - Math.cos(t))]; if (pv) B.beam('oakRoof', pv, pt, 0.16, 0.24); pv = pt; }   // brace under the hammer
      B.beam('oakDark', [x, HW, zh], [x, yAt(zh0) + 0.05, zh], 0.26, 0.26);                                         // hammer post
      pv = null; for (let k = 0; k <= 6; k++) { const t = (k / 6) * Math.PI / 2, pt = [x, HW + 0.25 + (13.45 - HW) * Math.sin(t), zh * Math.cos(t)]; if (pv) B.beam('oakRoof', pv, pt, 0.18, 0.3); pv = pt; }                    // arch brace
      B.beam('oakDark', [x, HW, s * hz], [x, H.ridge, 0], 0.2, 0.26);                                               // principal rafter
      for (const az of [3.1, 1.2]) B.beam('oakRoof', [x, yAt(az) - 0.1, s * az], [x, HW + 0.25 + (13.45 - HW) * Math.sin(Math.acos(az / zh0)), s * az], 0.08, 0.1);                                              // spandrel struts
      // the carved hammer end: a gilded shield with coloured quarters, and a turned pendant under the post
      B.push(T3(x, 0, zh)); B.box('gilt', 0, HW, -s * 0.2, 0.42, 0.5, 0.08); B.box(s > 0 ? 'red' : col2('plain', 0.1, 0.16, 0.5), 0.1, HW + 0.1, -s * 0.25, 0.16, 0.2, 0.02); B.box(s > 0 ? col2('plain', 0.1, 0.16, 0.5) : 'red', -0.1, HW - 0.12, -s * 0.25, 0.16, 0.2, 0.02); B.pop();
      lathe(B, 'oakDark', x, zh, [[0, HW - 0.75], [0.1, HW - 0.62], [0.06, HW - 0.5], [0.16, HW - 0.34], [0.16, HW - 0.17]], 6, 0); lathe(B, 'gilt', x, zh, [[0, HW - 0.86], [0.07, HW - 0.78], [0, HW - 0.7]], 6, 0);
      for (const az of [zh0, 2.0]) B.box('gilt', x, yAt(az) - 0.2, s * az, 0.34, 0.1, 0.34);                         // bosses where the purlins cross
    }
    B.beam('oakDark', [x, 13.6, -2.0], [x, 13.6, 2.0], 0.24, 0.28);                                                 // collar
    lathe(B, 'gilt', x, 0, [[0, 13.1], [0.14, 13.25], [0.14, 13.45]], 6, 0);
  }
  for (const s of [-1, 1]) { for (const az of [zh0, 2.0]) B.beam('oakDark', [-L, yAt(az) - 0.12, s * az], [0, yAt(az) - 0.12, s * az], 0.2, 0.24); B.beam('oakDark', [-L, HW, s * (hz - 0.2)], [0, HW, s * (hz - 0.2)], 0.3, 0.3); }
  B.beam('oakDark', [-L, H.ridge - 0.16, 0], [0, H.ridge - 0.16, 0], 0.24, 0.26);
  // ---- the long tables set for dinner: benches, a shaded brass lamp every 1.8 m, a place laid at every seat
  for (const tz of H.tables) {
    refectoryTable(B, H.tx0, H.tx1, tz, 'darkWood', 0.82, 0.76);
    benchAlong(B, H.tx0, H.tx1, tz - 0.72, 'darkWood'); benchAlong(B, H.tx0, H.tx1, tz + 0.72, 'darkWood');
    for (let x = H.tx0 + 0.9; x < H.tx1 - 0.5; x += 1.8) tableLamp(B, x, 0.76, tz);
    for (let x = H.tx0 + 0.6; x < H.tx1 - 0.3; x += 0.9) for (const sd of [-1, 1]) { lathe(B, 'white', x, tz + sd * 0.24, [[0.115, 0.775], [0.07, 0.765], [0, 0.765]], 8, 0); B.box('white', x + 0.2, 0.8, tz + sd * 0.3, 0.05, 0.08, 0.05, 0, { top: true }); }
    col.addBox((H.tx0 + H.tx1) / 2, tz, H.tx1 - H.tx0, 1.78);      // (the table AND its two benches: the benches used to be walked through; 0.9 m aisles are left)
  }
  { const x = H.highX; B.boxXZ('darkWood', x - 0.5, x + 0.5, H.daisH + 0.7, H.daisH + 0.78, -4.6, 4.6); B.boxXZ('white', x - 0.54, x + 0.54, H.daisH + 0.78, H.daisH + 0.795, -4.66, 4.66);
    for (const sd of [-1, 1]) B.boxXZ('white', x + sd * 0.54 - 0.005, x + sd * 0.54 + 0.005, H.daisH + 0.5, H.daisH + 0.79, -4.66, 4.66);
    for (const zz of [-4.3, -1.5, 1.5, 4.3]) for (const sd of [-1, 1]) B.box('darkWood', x + sd * 0.4, H.daisH + 0.35, zz, 0.09, 0.7, 0.09);
    for (let z = -4.2; z <= 4.21; z += 0.9) { B.push(T3(0, H.daisH, 0)); chairAt(B, x - 0.9, z, Math.PI / 2, 'red', 'darkWood', 1.2); B.pop(); lathe(B, 'white', x - 0.15, z, [[0.12, H.daisH + 0.81], [0.07, H.daisH + 0.8], [0, H.daisH + 0.8]], 8, 0); }
    for (let z = -4; z <= 4.1; z += 1.6) tableLamp(B, x + 0.15, H.daisH + 0.795, z);
    for (const z of [-2.4, 0, 2.4]) { lathe(B, 'gilt', x + 0.2, z + 0.8, [[0.09, H.daisH + 0.8], [0.03, H.daisH + 0.86], [0.03, H.daisH + 1.0], [0.11, H.daisH + 1.06], [0.1, H.daisH + 1.14]], 6, 0); }
    col.addBox(x - 0.35, 0, 1.7, 9.2); }      // (the high table and the row of chairs behind it)
  // ---- the great fireplace on the north wall (a glow in the grate)
  { const fx = -L + 5.5 * H.bay; B.push(frame(-L, 0, -hz, 1, 0)); const s = fx + L; const op = tudorP(s, 2.0, 0, 1.25, 0.45);
    B.box('mouldPale', s, 1.2, 0.2, 3.2, 2.4, 0.36); B.face('void', op, [], 0.39); B.box('mouldPale', s, 2.5, 0.24, 3.5, 0.2, 0.46); B.box('carve', s, 2.05, 0.39, 2.6, 0.5, 0.03);
    B.box(col2('plain', 1.0, 0.36, 0.08, 1.4, 1), s, 0.2, 0.3, 1.2, 0.3, 0.2); B.box('iron', s, 0.42, 0.42, 1.5, 0.05, 0.05); for (const dx of [-0.7, 0.7]) B.box('iron', s + dx, 0.25, 0.42, 0.05, 0.5, 0.05);
    B.pop(); addPoint(sc, fx, 0.9, -hz + 1.0, 0xff8a40, 3, 9, 1.6); }
  // walls
  col.addSegment(-L, -hz, 0, -hz); col.addSegment(-L, hz, 0, hz); col.addSegment(-L, -hz, -L, hz);
  if (SL) { col.addSegment(0, -hz, 0, -JOIN.passW / 2); col.addSegment(0, JOIN.passW / 2, 0, hz); } else col.addSegment(0, -hz, 0, hz);
  buildFine(B, game.world, sc, 'chch:hall:fine', { interior: true, cast: false }).receiveShadow = false;
  buildBatch(BP, sc, S);
  for (const x of [-30, -21, -12, -4]) addPoint(sc, x, 2.4, 0, 0xffc98a, 9, 15, 1.2);
  addPoint(sc, -17.5, 9, 0, 0xffe6c0, 5, 30, 1.0);
  if (!SL) ctx.setGround((x) => hallGround(x));
  return { spawn: [-1.4, 0], heading: -Math.PI / 2, glass: blind };
}
/** a brass table lamp with a glowing parchment shade */
function tableLamp(B, x, y, z) {
  lathe(B, 'brass', x, z, [[0.07, y], [0.07, y + 0.02], [0.02, y + 0.05], [0.02, y + 0.26]], 6, 0);
  lathe(B, 'lampOn', x, z, [[0.13, y + 0.24], [0.07, y + 0.42]], 8, 0);
}
function tudorP(x, w, y0, ys, h) { const r = w / 2, p = [[x - r, y0], [x + r, y0], [x + r, ys]]; for (let i = 1; i < 6; i++) { const t = i / 6, k = 1 - Math.abs(2 * t - 1); p.push([x + r * Math.cos(t * Math.PI), ys + h * (1 - Math.pow(1 - k, 2.2))]); } p.push([x - r, ys]); return p; }

/** seats for diners / the player: [{x, z, h}] on the benches (facing the table) */
export function hallSeats() {
  const out = [];
  for (const tz of HALL.tables) for (let x = HALL.tx0 + 0.6; x < HALL.tx1 - 0.3; x += 0.9) { out.push({ x, z: tz - 0.72, h: 0 }); out.push({ x, z: tz + 0.72, h: Math.PI }); }
  return out;
}

/**
 * The walk-in room: the Hall + the passage + the stair hall, in the Hall's frame (see JOIN). plan = the room's plan
 * (places/_walkin_city.js), o = { bays, open } as buildHall. Returns { spawn, heading } (the foot of the stair).
 */
export function buildJoined(ctx, game, plan, o = {}) {
  const J = JOIN, sc = ctx.scene, col = ctx.collider, hz = HALL.W / 2;
  const hall = buildHall(ctx, game, { ...o, sl: true });
  // the stair hall, in its own frame inside a group (its lamp too), its colliders shifted into the Hall's frame
  const G = new THREE.Group(); G.name = 'chch:stair'; G.position.set(J.OX, -J.TOP, -J.OZ); sc.add(G);
  const X = (x) => x + J.OX, Z = (z) => z - J.OZ;
  const shifted = { addSegment: (a, b, c, d, q) => col.addSegment(X(a), Z(b), X(c), Z(d), q), addCircle: (x, z, r) => col.addCircle(X(x), Z(z), r), addBox: (x, z, w, d, r) => col.addBox(X(x), Z(z), w, d, r), addPolygon: (p) => col.addPolygon(p.map(([x, z]) => [X(x), Z(z)])) };
  buildStair({ ...ctx, scene: G, collider: shifted, setGround() {} }, game, { sl: true, top: J.TOP });
  G.updateMatrixWorld(true);
  // the passage through the wall between the landing and the Hall, the doorway linings
  sc.add(stoneRoom({ x0: 0.02, x1: J.OX - 0.02, z0: -J.passW / 2, z1: J.passW / 2, y0: 0.003, h: J.passH, holes: [{ wall: 'w', c: 0, w: J.passW, h: J.passH }, { wall: 'e', c: 0, w: J.passW, h: J.passH }] }));
  sc.add(stonePassage(plan.seamless.portals[0]));
  { const a = archLining({ sl: plan.seamless }, [{ p: 0, head: J.door.head, rise: J.door.rise }], { color: 0xbfb393 }); if (a) sc.add(a); }
  // the glass: leaded heraldic lights (abstract shields and quarries, no real arms) in every window, the stone tracery
  // the Hall's own; the real openings are lined in stone from the glass out to the face of the wall
  const ops = plan.seamless.openings.filter((w) => w.hall);
  // (a real window's glass stands just behind the front's tracery, at the outer face of the thick wall — `glassAt`)
  const opOf = (w) => ops.find((q) => Math.abs(q.at[0] - w.at[0]) < 0.3 && Math.abs(q.at[1] - w.at[1]) < 0.3);
  // The walls are far thicker than the glass is deep, so each real window is glazed twice with the same lights: the
  // pane seen from INSIDE just behind the Hall's own tracery (every window has it), the pane seen from OUTSIDE just
  // behind the front's tracery; the stone between them is never seen.
  // (a real window's panes are plain rectangles filling the stone-lined opening — the pointed shape is the tracery's and the
  //  wall's, in front of them — so nothing is seen past the edge of the glass from below)
  const SG = stainedGlass(hall.glass.map((w, i) => ({ ...w, seed: 3 + i, ...(w.real && opOf(w) ? { head: 'flat' } : {}) })), { palette: HERALD, border: false, pane: 0.28, inset: 1, floor: 0, floorReach: 2.0 });
  const SGo = stainedGlass(hall.glass.map((w, i) => ({ ...w, seed: 3 + i, q: w.real ? opOf(w) : null })).filter((w) => w.q).map((w) => ({ ...w, head: 'flat', depth: w.q.glassAt ?? w.q.depth - 0.3 })), { palette: HERALD, border: false, pane: 0.28, inset: 1 });
  for (const [G, drop] of [[SG, 'wc:sg-out'], [SGo, 'wc:sg-in']]) { for (const m of [...G.group.children]) { if (m.name === drop) G.group.remove(m); else m.name = 'wc:win-' + m.name.slice(3); } sc.add(G.group); }
  if (ops.length) sc.add(reveal(ops.map((w) => ({ ...w, y: w.y0, h: w.y1 - w.y0, depth: w.depth + (w.proud ?? 0.03) })), { floor: true, mat: stoneMats().reveal }));
  // the foot of the stair, dressed: a mat inside the door, a rope on two brass posts keeping visitors to the stair, a
  // visitors' board on an easel (all in ONE vertex-coloured mesh)
  sc.add(stairDressing(J));
  // walls: the passage, the stair hall (its north wall is the portal's: the passage through it opens with the door)
  const W = STAIR.W, D = STAIR.D, x0 = J.OX, x1 = J.OX + W, z0 = -J.OZ, z1 = D - J.OZ, pw = J.passW / 2;
  for (const s of [-1, 1]) col.addSegment(0, s * pw, x0, s * pw);
  col.addSegment(x0, z0, x1, z0); col.addSegment(x1, z0, x1, z1); col.addSegment(x1, z1, x0, z1); col.addSegment(x0, z0, x0, -pw); col.addSegment(x0, pw, x0, z1);
  void hz;
  ctx.setGround(joinedGround);
  return { spawn: [J.OX + J.doorX, -J.OZ + 1.3], heading: 0, setLight: (d, l) => { SG.setLight(d, l); SGo.setLight(d, l); } };
}

// heraldic glass: a red and blue border, clear quarries, a few gold and coloured pieces (abstract: no real arms)
const HERALD = [0xa0182a, 0xd8d4c0, 0xcfd6c8, 0x1c3f9a, 0xd6cfae, 0xe0d8b8, 0xc8961c, 0xc4cfd6, 0xd8d4c0, 0x1f6b3a, 0xcfd6c8, 0xe0d8b8, 0xd8d4c0];
function stairDressing(J) {
  const P = [], N = [], C = [], col = new THREE.Color();
  const box = (x0, x1, y0, y1, z0, z1, hex) => {
    col.set(hex);
    const q = (a, b, c, d, n) => { for (const v of [a, b, c, a, c, d]) { P.push(v[0] + J.OX, v[1] - J.TOP, v[2] - J.OZ); N.push(n[0], n[1], n[2]); C.push(col.r, col.g, col.b); } };
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
  };
  const dx = J.doorX;
  box(dx - 0.75, dx + 0.75, 0, 0.022, 0.25, 1.35, 0x5a4a34);                                  // coir mat
  for (const x of [2.6, 4.4]) { box(x - 0.14, x + 0.14, 0, 0.04, 5.36, 5.64, 0xb09a5a); box(x - 0.025, x + 0.025, 0.04, 0.95, 5.475, 5.525, 0xb09a5a); box(x - 0.05, x + 0.05, 0.95, 1.0, 5.45, 5.55, 0xb09a5a); }
  for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6, sag = (t) => 0.9 - 0.22 * Math.sin(t * Math.PI); box(2.6 + 1.8 * t0, 2.6 + 1.8 * t1, Math.min(sag(t0), sag(t1)) - 0.02, Math.max(sag(t0), sag(t1)) + 0.02, 5.48, 5.52, 0x6a1420); }   // the rope
  // an easel board by the door (plain cream sheet, dark lines: no words)
  box(4.7, 4.74, 0, 1.5, 3.2, 3.24, 0x3a2a1a); box(5.26, 5.3, 0, 1.5, 3.2, 3.24, 0x3a2a1a); box(4.68, 5.32, 0.7, 1.45, 3.17, 3.2, 0x2e2116); box(4.73, 5.27, 0.75, 1.4, 3.165, 3.17, 0xe9e2cf);
  for (let k = 0; k < 6; k++) box(4.79 + (k % 3) * 0.07, 5.21, 1.28 - k * 0.09, 1.3 - k * 0.09, 3.162, 3.165, 0x2a2a2a);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, name: 'chch:stair:dress' })); m.name = 'chch:stair:dress'; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false;
  return m;
}
