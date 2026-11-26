// Terrace Staircase 5 and "your room" (first floor, looking south over the Main Quad).
// A WALK-IN building (core/interiors.js "seamless"; plan and the shell it is fitted to: _worcint_lodge_plan.js STAIR):
// in place behind the Terrace front, in the door's own bay (bay 7 of the true Terrace: _worcester_terrace_plan.js). You walk in through the real round-headed doorway (a pair
// of heavy oak leaves under a fanlight), climb a dog-leg stair on foot — a flight north on the east side, a half-landing, a flight
// back south on the west side — to the first-floor landing over the hall, and go through a room door into your room.
// The landing's sash and the room's sash are real openings where the Terrace has its first-floor windows (over the
// door, and one bay west): the live Main Quad is outside them.
// No photo or plan of a Terrace stair interior was found: the arrangement is a plausible 18th-century one (GUESS) —
// stone-flagged entrance hall (+2 steps at the door, accessibility page), painted walls, an oak stair, oak doors with
// name boards. The room uses the college's own room photos (Staircase 11 sash + curtains, Terrace beech furniture,
// grey duvet).
// Frame: x east (0 = the door's centre), z south (0 = the inside face of the front wall), y = 0 at the threshold.
// Ground hall x -1.5..1.5, z -3..0; flights z -5.8..-3 (A: x 0.1..1.5 up to the north, B: x -1.5..-0.1 up to the south);
// half-landing z -7.2..-5.8 at HALF; first-floor landing over the hall at FH; the room x -4.9..-1.6, z -4.8..0 at FH,
// its door (z -2.9..-2.0) at the head of the upper flight.
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts, sharedMats, buildBatch, addPoint, ambientOf, mergeStatic, sash, outGlass, chairAt, wallShade } from './_worcint_kit.js';
import { canvas, tex } from './_worcint_tex.js';
import { STAIR as PS } from './_worcint_lodge_plan.js';
import { WORC_LEVELS } from './_worcester_shared.js';

// STOP-GAP (2026-11-23), TO BE REMOVED when core/interiors.js levels every walk-in room itself (`world.terrainLevelObject`,
// the terrain builder's general tool: the coordinator's next item). The drawn ground lifts every vertex by the surveyed
// height under it; Provost's Yard is a level field 2.8 m below the college's datum which reaches in under the Terrace's
// north side, and the step back up to the datum lies under this staircase's half-landing and the tops of its flights:
// left alone they are drawn sheared, up to 2 m low. With the switch ON the room's static geometry is raised vertex by
// vertex by what the field under it falls short of the datum, and the walking height with it — and nothing at all is
// done if the correction is under a millimetre everywhere, or if `world.terrainLevelObject` exists (so the correction
// cannot be doubled on the day the general tool lands). With the switch OFF the room builds exactly as it did before.
// For Staircase 5 and "your room" ONLY: not a facility for other rooms.
export const STAIR5_RIGID_STOPGAP = true;
/** -> { at(x, z): the correction at room (x, z); max: the largest measured } or null when there is nothing to do */
function stair5Rigid(game, meshes) {
  const world = game && game.world;
  if (!STAIR5_RIGID_STOPGAP || !world || typeof world.terrainHeight !== 'function' || typeof world.terrainLevelObject === 'function') return null;
  const D = WORC_LEVELS.datumOD - ((world.terrain && world.terrain.datum) || 58);      // the datum's height in the field's own measure
  const at = (x, z) => { const w = PS.toWorld(x, z), h = world.terrainHeight(w[0], w[1]); return Number.isFinite(h) ? D - h : 0; };
  let max = 0;
  for (const m of meshes) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) max = Math.max(max, Math.abs(at(p.getX(i), p.getZ(i)))); }
  if (max < 1e-3) return null;
  for (const m of meshes) {
    const g = m.geometry, p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const c = at(p.getX(i), p.getZ(i)); if (c) p.setY(i, p.getY(i) + c); }
    p.needsUpdate = true; g.computeBoundingSphere(); g.computeBoundingBox(); g.userData.terrainDraped = true;      // (the world's draping pass must leave it alone)
  }
  return { at, max };
}

function nameBoard(text) {
  const { c, g } = canvas(256, 64); g.fillStyle = '#f2ede0'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.strokeRect(3, 3, 250, 58);
  g.fillStyle = '#1a1a1a'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34);
  const t = tex(c, { wrap: false }); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
}
function curtainTex() {
  const { c, g } = canvas(128, 256); g.fillStyle = '#efe4cc'; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 40) for (let x = 0; x < 128; x += 40) { g.fillStyle = '#b8443a'; g.fillRect(x + 6, y + 6, 26, 26); g.fillStyle = '#efe4cc'; g.fillRect(x + 12, y + 12, 14, 14); }
  return tex(c, { wrap: true });
}

export function buildStair(ctx, game) {
  const S = sharedMats(game), sc = ctx.scene;
  const walkIn = !!(ctx.seamless && ctx.addDoor);
  // two storeys overlap in plan (the landing over the hall): a collider each; the stair well is in both
  const colG = ctx.collider, colF = ctx.newCollider ? ctx.newCollider() : ctx.collider;
  const { FH, HALF, RH, CHG, hall: HL, flights: FL, half: HF, room: RM, roomDoor: RD, door: DR, wins } = PS, TOP = FH + RH;
  const X0 = HL.x0, X1 = HL.x1, ZH = HL.z0, ZF = FL.z0, ZN = HF.z0, run = (FL.z1 - FL.z0) / FL.n, rise = HALF / FL.n, RAIL = 0.95;
  const mats = { ...S };
  mats.paint = new THREE.MeshStandardMaterial({ color: 0xe8e2cf, roughness: 0.9 });
  mats.paintDark = new THREE.MeshStandardMaterial({ color: 0xd4ccb4, roughness: 0.85 });
  { const wt = wallShade(RH, { top: 0.3, bottom: 0.5, skirt: 0.14, skirtCol: '#fbf6e6' }); wt.offset.y = -(FH % RH) / RH;   // room walls start at y = FH
    mats.roomWall = new THREE.MeshStandardMaterial({ map: wt, color: 0xf0e4b8, roughness: 0.92 }); }   // pale yellow (Staircase 11 photo)
  mats.flagsS = new THREE.MeshStandardMaterial({ map: S.stoneFloor.map, color: 0xcfc8b8, roughness: 0.8 });
  mats.glass = new THREE.MeshStandardMaterial({ color: 0xcfe4ee, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.1, depthWrite: false });   // real glass: the quad is beyond it
  mats.glassOut = outGlass();
  const ct = curtainTex(); ct.repeat.set(1 / 0.5, 1 / 1.0); mats.curtain = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 });
  mats.duvet = new THREE.MeshStandardMaterial({ color: 0x6e7884, roughness: 0.95 });
  mats.pillow = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.95 });
  mats.cork = new THREE.MeshStandardMaterial({ color: 0xa88a62, roughness: 1 });
  mats.essay = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  mats.bucket = new THREE.MeshStandardMaterial({ color: 0x3a66b0, roughness: 0.5 });
  const nb = (k, t) => { mats[k] = nameBoard(t); return k; };
  const me = (game.player && game.player.name) || 'You';
  const B = new Batch();
  const G = [colG], F1 = [colF], BOTH = colG === colF ? [colG] : [colG, colF];
  const seg = (cols, x0, z0, x1, z1) => { for (const c of cols) c.addSegment(x0, z0, x1, z1); };
  /** a wall face from (x0, z0) to (x1, z1), y0..y1: it faces the side of the normal (-(z1 - z0), x1 - x0) */
  const wall = (x0, z0, x1, z1, y0, y1, key = 'paint', cols = null) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    B.push(frame(x0, 0, z0, x1 - x0, z1 - z0)); B.face(key, rectPts(0, y0, L, y1)); B.pop();
    if (cols) seg(cols, x0, z0, x1, z1);
  };
  const flat = (key, x0, x1, z0, z1, y, down = false) => B.flat(key, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, [], down);

  // ================================================================ ground hall (flags), the front door at z = 0
  flat('flagsS', X0, X1, ZH, 0, 0); flat('paint', X0, X1, ZH, 0, CHG, true);
  {
    // south wall from inside (s from its east end; -z = out through the wall): the round-headed doorway is a real hole
    const c = X1 - DR.x, r = DR.w / 2, arch = archPts(c, DR.w, 0, DR.spring, 10);
    B.push(frame(X1, 0, 0, -1, 0));
    B.face('paint', [[0, 0], [c - r, 0], ...arch.slice(2).reverse(), [c + r, 0], [X1 - X0, 0], [X1 - X0, CHG], [0, CHG]]);
    B.reveal('paint', arch, 0, -0.06, true);
    B.boxXZ('stoneFloor', c - r, c + r, -0.02, 0.004, -0.06, 0);                                    // threshold
    // fanlight over the door: transom, a glazed lunette with three bars
    B.boxXZ('darkOak', c - r, c + r, DR.spring - 0.02, DR.spring + 0.06, -0.06, -0.005);
    const lun = [[c + r, DR.spring + 0.06]]; for (let i = 1; i < 10; i++) { const a = (i / 10) * Math.PI; lun.push([c + Math.cos(a) * r, DR.spring + Math.sin(a) * r]); } lun.push([c - r, DR.spring + 0.06]);
    B.face('glass', lun, [], -0.035); B.face('glassOut', lun, [], -0.012, true);
    for (const a of [Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4]) B.beam('plasterWhite', [c, DR.spring + 0.06, -0.035], [c + Math.cos(a) * (r - 0.01), DR.spring + Math.sin(a) * (r - 0.01), -0.035], 0.03);
    if (!walkIn) B.boxXZ('darkOak', c - r, c + r, 0, DR.spring, -0.06, -0.01);      // (old door path only: a shut leaf)
    B.pop();
  }
  seg(G, X0, 0, X1, 0);      // (whole: the walk-in doorway's passage opens it while the door is open)
  wall(X0, 0, X0, ZH, 0, CHG, 'paint', G);                               // west wall (faces east)
  wall(X1, ZH, X1, 0, 0, CHG, 'paint', G);                               // east wall (faces west)
  wall(X0, ZH, FL.A.x0, ZH, 0, CHG, 'paint', G);                         // north wall beside the stair foot: the cupboard under the upper flight
  B.boxXZ('oak', X0 + 0.25, X0 + 1.05, 0, 1.9, ZH, ZH + 0.03); B.boxXZ('brass', X0 + 0.95, X0 + 0.99, 0.95, 1.05, ZH + 0.03, ZH + 0.05);
  // ground floor room doors (5.1 / 5.2) with name boards
  for (const [x, nx, k] of [[X0 + 0.02, 1, nb('nb1', '5.1  R. J. M.')], [X1 - 0.02, -1, nb('nb2', '5.2  A. K.')]]) {
    B.boxXZ('oak', x - 0.03, x + 0.03, 0, 2.2, -2.0, -1.0);
    B.push(frame(x + nx * 0.035, 0, nx > 0 ? -0.75 : -2.25, 0, nx > 0 ? -1 : 1)); B.sign(k, 0.2, 2.3, 0.75, 2.45, 0.0, [0, 0, 1, 1]); B.pop();
  }

  // ================================================================ the stair well (in both colliders)
  wall(X1, ZN, X1, ZH, 0, TOP, 'paintDark', BOTH);                       // east wall
  wall(X0, ZN, X1, ZN, HALF, TOP, 'paintDark', BOTH);                    // north wall, over the half-landing
  wall(X0, ZH, X0, ZN, HALF, TOP, 'paintDark', BOTH);                    // west wall
  flat('paint', X0, X1, ZN, 0, TOP, true);                               // ceiling over the well and the landing
  flat('floorboards', X0, X1, ZN, ZF, HALF);                             // half-landing
  for (let i = 0; i < FL.n; i++) {
    // flight A: oak treads rising north, painted risers facing south
    let z0 = ZH - run * i, y = rise * i;
    B.poly('paintDark', [[FL.A.x0, y, z0], [FL.A.x1, y, z0], [FL.A.x1, y + rise - 0.035, z0], [FL.A.x0, y + rise - 0.035, z0]], [0, 0, 1]);
    B.boxXZ('oak', FL.A.x0, FL.A.x1, y + rise - 0.035, y + rise, z0 - run, z0 + 0.03);
    // flight B: rising south from the half-landing, risers facing north
    z0 = ZF + run * i; y = HALF + rise * i;
    B.poly('paintDark', [[FL.B.x0, y, z0], [FL.B.x1, y, z0], [FL.B.x1, y + rise - 0.035, z0], [FL.B.x0, y + rise - 0.035, z0]], [0, 0, -1]);
    B.boxXZ('oak', FL.B.x0, FL.B.x1, y + rise - 0.035, y + rise, z0 - 0.03, z0 + run);
  }
  // the spine between the flights: solid up to the upper flight's rail
  B.push(frame(FL.A.x0, 0, ZH, 0, -1)); B.face('paintDark', [[0, 0], [ZH - ZF, 0], [ZH - ZF, HALF + RAIL], [0, FH + RAIL]]); B.pop();                 // faces east, over flight A
  B.push(frame(FL.B.x1, 0, ZF, 0, 1)); B.face('paintDark', [[0, HALF], [ZH - ZF, FH], [ZH - ZF, FH + RAIL], [0, HALF + RAIL]]); B.pop();              // faces west, beside flight B
  B.push(frame(FL.A.x0, 0, ZF, -1, 0)); B.face('paintDark', rectPts(0, HALF, FL.A.x0 - FL.B.x1, HALF + RAIL)); B.pop();                               // its north end
  B.beam('darkOak', [0, HALF + RAIL + 0.025, ZF - 0.02], [0, FH + RAIL + 0.025, ZH], FL.A.x0 - FL.B.x1 + 0.06, 0.05);
  B.beam('darkOak', [X1 - 0.06, RAIL, ZH], [X1 - 0.06, HALF + RAIL, ZF], 0.05);                                                                     // wall rails
  B.beam('darkOak', [X0 + 0.06, HALF + RAIL, ZF], [X0 + 0.06, FH + RAIL, ZH], 0.05);
  seg(BOTH, FL.A.x0, ZH, FL.A.x0, ZF); seg(BOTH, FL.B.x1, ZH, FL.B.x1, ZF); seg(BOTH, FL.B.x1, ZF, FL.A.x0, ZF);
  B.push(frame(X0 + 0.9, 0, ZN + 0.02, 1, 0)); B.sign('notice', 0, HALF + 1.2, 1.2, HALF + 2.1, 0.0, [0, 0, 1, 1]); B.pop();                           // staircase notices on the half-landing

  // ================================================================ first-floor landing (over the hall)
  flat('floorboards', X0, X1, ZH, 0, FH);
  const wl = wins.find((w) => w.id === 'landing'), wr = wins.find((w) => w.id === 'room');
  {
    const s = X1 - wl.x, hw = wl.w / 2;      // south wall with the sash over the door
    B.push(frame(X1, 0, 0, -1, 0)); B.face('paint', rectPts(0, FH, X1 - X0, TOP), [rectPts(s - hw, wl.y0, s + hw, wl.y1)]);
    sash(B, s - hw, s + hw, wl.y0, wl.y1, 0.27, { cols: 3, rows: 4, glassKey: 'glass', outKey: 'glassOut' });
    B.pop();
  }
  seg(F1, X0, 0, X1, 0);
  wall(X1, ZH, X1, 0, FH, TOP, 'paint', F1);                              // east wall
  B.boxXZ('oak', X1 - 0.06, X1, FH, FH + 2.1, -2.2, -1.3); B.push(frame(X1 - 0.065, 0, -2.3, 0, 1)); B.sign(nb('nb4', '5.4  S. L.'), 1.15, FH + 1.5, 1.6, FH + 1.62, 0.0, [0, 0, 1, 1]); B.pop();
  // the well's edge over the lower flight: the landing's floor edge and a solid balustrade
  B.push(frame(X1, 0, ZH, -1, 0)); B.face('paintDark', rectPts(0, CHG, X1 - FL.B.x1, FH + RAIL)); B.pop();                                            // faces north, into the well
  wall(FL.B.x1, ZH, X1, ZH, FH, FH + RAIL, 'paint', F1);                                                                                               // faces south, to the landing
  B.boxXZ('darkOak', FL.B.x1 - 0.03, X1, FH + RAIL, FH + RAIL + 0.05, ZH - 0.06, ZH + 0.06);
  {
    // west wall with your room's door (z RD.z0..RD.z1): faces east, s = -z
    const a = -RD.z1, b = -RD.z0;
    B.push(frame(X0, 0, 0, 0, -1)); B.face('paint', [[0, FH], [a, FH], [a, FH + RD.h], [b, FH + RD.h], [b, FH], [-ZH, FH], [-ZH, TOP], [0, TOP]]);
    B.reveal('oak', rectPts(a, FH, b, FH + RD.h), 0, -(X0 - RM.x1), true);
    B.sign(nb('nbMe', `5.3  ${me.slice(0, 14)}`), a - 0.55, FH + 1.5, a - 0.1, FH + 1.62, 0.01, [0, 0, 1, 1]);
    B.pop();
    flat('floorboards', RM.x1, X0, RD.z0, RD.z1, FH);
    seg(F1, X0, 0, X0, RD.z1); seg(F1, X0, RD.z0, X0, ZH); seg(F1, RM.x1, RD.z1, X0, RD.z1); seg(F1, RM.x1, RD.z0, X0, RD.z0);
  }
  // scout's bucket outside your door
  B.cyl('bucket', X0 + 0.3, FH, RD.z1 + 0.75, 0.15, 0.3, 10, false, 0.13); B.cyl('black', X0 + 0.3, FH + 0.3, RD.z1 + 0.75, 0.01, 0.12, 4, false);
  for (const c of F1) c.addCircle(X0 + 0.3, RD.z1 + 0.75, 0.16);

  // ================================================================ your room (y = FH)
  const RX0 = RM.x0, RX1 = RM.x1, RZ0 = RM.z0, RZ1 = RM.z1, WX = wr.x;
  flat('carpetGrey', RX0, RX1, RZ0, RZ1, FH); flat('paint', RX0, RX1, RZ0, RZ1, TOP, true);
  {
    // south wall with the tall sash onto the quad (a real opening), curtains, radiator
    const ws = RX1 - WX, hw = wr.w / 2;
    B.push(frame(RX1, 0, RZ1, -1, 0));
    B.face('roomWall', rectPts(0, FH, RX1 - RX0, TOP), [rectPts(ws - hw, wr.y0, ws + hw, wr.y1)]);
    sash(B, ws - hw, ws + hw, wr.y0, wr.y1, 0.27, { cols: 3, rows: 4, glassKey: 'glass', outKey: 'glassOut' });
    for (const sx of [-1, 1]) B.box('curtain', ws + sx * (hw + 0.22), (wr.y1 + FH + 0.55) / 2, 0.1, 0.36, wr.y1 - FH - 0.45, 0.08);
    B.box('radiator', ws, FH + 0.4, 0.08, 1.0, 0.55, 0.08);
    B.pop();
  }
  seg(F1, RX0, RZ1, RX1, RZ1);
  wall(RX0, RZ1, RX0, RZ0, FH, TOP, 'roomWall', F1);                      // west
  wall(RX0, RZ0, RX1, RZ0, FH, TOP, 'roomWall', F1);                      // north
  { const a = RD.z0 - RZ0, b = RD.z1 - RZ0; B.push(frame(RX1, 0, RZ0, 0, 1)); B.face('roomWall', [[0, FH], [a, FH], [a, FH + RD.h], [b, FH + RD.h], [b, FH], [RZ1 - RZ0, FH], [RZ1 - RZ0, TOP], [0, TOP]]); B.pop(); }   // east, with the door
  seg(F1, RX1, RZ0, RX1, RD.z0); seg(F1, RX1, RD.z1, RX1, RZ1);
  // furniture: bed (grey duvet), beech bedside cabinet, wardrobe, bookcase, desk + chair under the window
  B.boxXZ('beech', RX0 + 0.02, RX0 + 0.95, FH, FH + 0.42, RZ0 + 0.05, RZ0 + 2.05);
  B.boxXZ('duvet', RX0 + 0.04, RX0 + 0.97, FH + 0.42, FH + 0.55, RZ0 + 0.35, RZ0 + 2.07);
  B.boxXZ('pillow', RX0 + 0.15, RX0 + 0.85, FH + 0.42, FH + 0.6, RZ0 + 0.08, RZ0 + 0.38);
  B.boxXZ('beech', RX0 + 1.05, RX0 + 1.5, FH, FH + 0.55, RZ0 + 0.05, RZ0 + 0.45);
  B.boxXZ('beech', RX1 - 0.95, RX1 - 0.05, FH, FH + 2.0, RZ0 + 0.05, RZ0 + 0.65);
  const BK = [RZ1 - 2.1, RZ1 - 1.1];      // bookcase on the west wall
  B.boxXZ('beech', RX0 + 0.05, RX0 + 0.4, FH, FH + 1.2, BK[0], BK[1]);
  // joinery detail so the furniture reads as furniture, not boxes: headboard, wardrobe doors + handles + plinth, drawer
  {
    const wc = RX1 - 0.5, wf = RZ0 + 0.65, bf = RZ0 + 0.45;
    B.boxXZ('beech', RX0 + 0.02, RX0 + 0.95, FH, FH + 0.95, RZ0 + 0.02, RZ0 + 0.06);
    B.boxXZ('darkOak', wc - 0.004, wc + 0.004, FH + 0.09, FH + 1.97, wf, wf + 0.004);
    B.boxXZ('darkOak', RX1 - 0.95, RX1 - 0.05, FH, FH + 0.08, wf, wf + 0.004);
    B.boxXZ('darkOak', RX1 - 0.95, RX1 - 0.05, FH + 1.97, FH + 2.0, wf, wf + 0.012);
    for (const sx of [-1, 1]) B.boxXZ('black', wc + sx * 0.05 - 0.008, wc + sx * 0.05 + 0.008, FH + 0.95, FH + 1.1, wf, wf + 0.025);
    B.boxXZ('darkOak', RX0 + 1.07, RX0 + 1.48, FH + 0.36, FH + 0.368, bf, bf + 0.004);
    B.boxXZ('black', RX0 + 1.255, RX0 + 1.295, FH + 0.44, FH + 0.46, bf, bf + 0.02);
  }
  B.push(frame(RX0 + 0.41, 0, BK[1], 0, -1)); for (let k = 0; k < 3; k++) B.box('books', 0.5, FH + 0.25 + k * 0.38, -0.12, 0.9, 0.25, 0.2); B.pop();
  B.boxXZ('beech', WX - 0.75, WX + 0.75, FH + 0.72, FH + 0.76, RZ1 - 0.7, RZ1 - 0.05);
  for (const sx of [-1, 1]) B.boxXZ('beech', WX + sx * 0.7 - 0.03, WX + sx * 0.7 + 0.03, FH, FH + 0.72, RZ1 - 0.68, RZ1 - 0.08);
  B.boxXZ('essay', WX - 0.3, WX + 0.1, FH + 0.76, FH + 0.77, RZ1 - 0.5, RZ1 - 0.2);
  B.cyl('redCloth', WX + 0.4, FH + 0.76, RZ1 - 0.35, 0.04, 0.1, 8, true);
  B.push(new THREE.Matrix4().makeTranslation(0, FH, 0)); chairAt(B, WX, RZ1 - 1.0, 0, 'carpetGrey', 'black', 0.95); B.pop();      // (facing the desk and the window)
  B.push(frame(RX0, 0, RZ0 + 4.3, 0, -1)); B.box('cork', 1.2, FH + 1.6, 0.02, 0.9, 0.6, 0.02); B.pop();
  B.box('lampGlow', (RX0 + RX1) / 2, TOP - 0.35, (RZ0 + RZ1) / 2, 0.3, 0.25, 0.3); B.cyl('black', (RX0 + RX1) / 2, TOP - 0.2, (RZ0 + RZ1) / 2, 0.006, 0.2, 4, false);
  for (const c of F1) { c.addBox(RX0 + 0.75, RZ0 + 1.05, 1.5, 2.0, 0); c.addBox(RX1 - 0.5, RZ0 + 0.35, 0.9, 0.6, 0); c.addBox(RX0 + 0.22, (BK[0] + BK[1]) / 2, 0.4, 1.0, 0); c.addBox(WX, RZ1 - 0.37, 1.5, 0.66, 0); }

  // ================================================================ floors: the hall and the landing over it overlap in plan,
  // so the level is carried: it changes on the flights (A belongs to the hall, B to the landing), the room is upstairs
  let lvl = 0, rigid = null;      // (rigid: STAIR5_RIGID_STOPGAP, set once the room's static geometry is merged)
  const inPlan = (x, z) => x > RX0 - 1 && x < X1 + 1 && z > ZN - 1 && z < 1.5;
  const level = (p) => { const x = p.pos.x, z = p.pos.z; if (!inPlan(x, z)) return lvl; if (x < X0 - 0.02) lvl = 1; else if (z < ZH && z >= ZF) lvl = x > 0 ? 0 : 1; return lvl; };
  const floorAt = (x, z) => {
    if (x < X0 - 0.02) return FH;                                           // the room and its doorway
    if (z < ZF) return HALF;                                                // half-landing
    if (z < ZH) return x > 0 ? HALF * (ZH - z) / (ZH - ZF) : HALF + HALF * (z - ZF) / (ZH - ZF);      // flight A / flight B
    return lvl ? FH : 0;                                                    // the landing over the hall
  };
  ctx.setGround((x, z) => floorAt(x, z) + (rigid ? rigid.at(x, z) : 0));
  if (ctx.setCollider) ctx.setCollider((p) => (level(p) ? colF : colG));

  buildBatch(B, sc, mats);
  mergeStatic(sc);
  { const ms = []; sc.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes.position) ms.push(o); }); rigid = walkIn ? stair5Rigid(game, ms) : null; }      // (STAIR5_RIGID_STOPGAP: before the doors are hung — they stand where the field is the datum)
  // doors: the front door (a pair of heavy oak leaves under the fanlight, opening into the hall: each folds back out of
  // the way in the 3 m hall; they stay where they are left) and your room's door (a light oak door hung on the north
  // jamb, opening into the room away from the window, and left ajar)
  const doors = {};
  if (walkIn) {
    const fo = { kind: 'hinged', style: 'oak', y: 0, w: DR.w / 2, h: DR.spring - 0.03, closer: false, heavy: true, rest: 0.5, thick: 0.05, mats: { leaf: S.darkOak, handle: S.iron }, portal: 0, colliders: G };
    doors.front = ctx.addDoor({ ...fo, at: [DR.x + DR.w / 2, 0.03], dir: -Math.PI / 2, swing: -1 });
    doors.front2 = ctx.addDoor({ ...fo, at: [DR.x - DR.w / 2, 0.03], dir: Math.PI / 2, swing: 1 });
    // (two leaves on one doorway: the way through is open while either leaf is)
    const P0 = ctx.seamless.portals[0], sync = () => { P0.open = doors.front.passable || doors.front2.passable; };
    doors.front.onPass(sync); doors.front2.onPass(sync);
    doors.room = ctx.addDoor({ kind: 'hinged', style: 'oak', at: [(X0 + RX1) / 2, RD.z0], y: FH, w: RD.z1 - RD.z0, h: RD.h - 0.02, dir: 0, swing: -1, closer: false, heavy: false, rest: 0.6, thick: 0.04, mats: { leaf: S.oak, handle: S.brass }, colliders: F1 });
  }
  // (core adds the front doorway's passage to every collider of the room; upstairs it would open the landing's wall
  //  under the window while the door below is open, so the first floor's copy is taken out once core has made it)
  let passFixed = false;
  const fixPassage = () => {
    const P = ctx.seamless && ctx.seamless.portals && ctx.seamless.portals[0]; if (!P || !P.passages || colF === colG || !colF.passages) { passFixed = true; return; }
    for (let i = P.passages.length - 1; i >= 0; i--) { const q = P.passages[i]; if (colF.passages.includes(q)) { q.on = false; P.passages.splice(i, 1); passFixed = true; } }
  };
  const { amb, hemi } = ambientOf(sc);
  const lHall = addPoint(sc, 0, CHG - 0.5, -1.5, 0xfff0d8, 3, 8), lLand = addPoint(sc, 0, TOP - 0.5, -2.6, 0xfff0d8, 3, 9), lRoom = addPoint(sc, (RX0 + RX1) / 2, TOP - 0.7, (RZ0 + RZ1) / 2, 0xffe8c8, 4, 9);
  return {
    spawn: [0, -1.2], heading: Math.PI, exit: [0, -0.5], doors, colliders: { ground: colG, first: colF },
    setLevel(v) { lvl = v ? 1 : 0; }, get level() { return lvl; }, rigid,      // (rigid: null, or { at(x, z), max } while STAIR5_RIGID_STOPGAP is at work)
    desk: [WX, RZ1 - 1.1], deskSeat: { x: WX, z: RZ1 - 0.95, h: 0 }, bed: [RX0 + 1.4, RZ0 + 1.4], shelf: [RX0 + 0.9, (BK[0] + BK[1]) / 2], window: [WX - 1.05, RZ1 - 0.6], bucket: [X0 + 0.6, RD.z1 + 0.75],
    /** daylight 0..1; home: someone is in (the staircase lights burn all night; your room's lamp is on only while you are in) */
    setLight(d, home = true) { if (!passFixed) fixPassage(); mats.glassOut.userData.setDay(d); if (amb) amb.intensity = 0.3 + d * 0.3; if (hemi) hemi.intensity = 0.2 + d * 0.3; lHall.intensity = 2 + (1 - d) * 1.5; lLand.intensity = 1.6 + (1 - d) * 1.8; lRoom.intensity = home ? 2 + (1 - d) * 3 : 0.1 + d * 1.6; lLand.distance = home ? 9 : 4.2; },
  };
}
