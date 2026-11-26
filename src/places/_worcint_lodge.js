// Porters' Lodge (off the gate hall). Photo: the college's `porters lodge door …` (reference/worcester/01 …; the same
// picture as Porters-Lodge-scaled on its accessibility page), taken from inside the vaulted gate hall: through the
// doorway a counter curving away from the left of the door — pale green in front, a wooden plinth and top, a square
// wooden post at its end, a glazed screen standing on its left part — the top carrying on to the right over a wooden
// cabinet, pigeonholes on the wall behind; the pair of dark panelled leaves folded back inside the doorway.
// GUESSES (out of the photograph's sight): what stands east of the cabinet and behind the counter — the porters' desk
// and its monitors, the board of spare keys, the parcels, the small post rack by the window. Student pigeonholes are
// in the pidge room in Pump Quad (_worcint_pidge.js).
// A WALK-IN room (core/interiors.js "seamless"; plan: _worcint_lodge_plan.js LODGE): in place north of the gate hall,
// 4.3 x 4.5 m (the 1939 plan). Its doorway is a real opening in the gate hall's north wall, where the exterior
// (_worcester_block.js) draws its arch and lettered tympanum; its one window is the street front's north ground-floor
// window, round-headed, onto the forecourt.
// Room frame: x -2.2..2.1 (west..east; 0 = the door's centre), z -4.5 (north) .. 0 (the south wall, to the gate hall).
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts, sharedMats, buildBatch, addPoint, ambientOf, mergeStatic, wallShade, speckle, outGlass } from './_worcint_kit.js';
import { LODGE as PL } from './_worcint_lodge_plan.js';
import { pidgeTex, tex, canvas, rng } from './_worcint_tex.js';

/** board of spare room keys: rows of numbered brass hooks, keys on coloured fobs (some hooks empty) */
function keyBoardTex() {
  const { c, g } = canvas(512, 256), R = rng(55);
  g.fillStyle = '#6a4a2c'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#7a5836'; g.fillRect(6, 6, 500, 244);
  const cols = 16, rows = 6, cw = 500 / cols, ch = 244 / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = 6 + k * cw, y = 6 + r * ch;
    g.fillStyle = '#f0e6c8'; g.fillRect(x + 6, y + 3, cw - 12, 8); g.fillStyle = '#222'; g.font = 'bold 7px Arial'; g.textAlign = 'center'; g.fillText(String((r + 1) * 100 + k + 1).slice(-3), x + cw / 2, y + 10);
    g.fillStyle = '#c8a050'; g.fillRect(x + cw / 2 - 1.5, y + 13, 3, 6);
    if (R() < 0.78) { g.fillStyle = '#b8b8b0'; g.fillRect(x + cw / 2 - 1, y + 18, 2, 9); g.beginPath(); g.arc(x + cw / 2, y + 18, 3, 0, 7); g.fill(); g.fillStyle = ['#c83030', '#3060c8', '#30a050', '#e0c030', '#ffffff'][Math.floor(R() * 5)]; g.fillRect(x + cw / 2 - 4, y + 27, 8, 11); }
  }
  return tex(c, { wrap: false });
}

export function buildLodge(ctx, game) {
  const S = sharedMats(game), sc = ctx.scene, col = ctx.collider;
  const { X0, X1, Z0, H, WALL, door: DR, win: WN } = PL, Z = -Z0, LW = X1 - X0;
  const walkIn = !!(ctx.seamless && ctx.addDoor);
  const mats = { ...S };
  mats.wallC = new THREE.MeshStandardMaterial({ map: wallShade(H, { top: 0, bottom: 0 }), color: 0xeee8d8, roughness: 0.9 });
  mats.counterFront = new THREE.MeshStandardMaterial({ color: 0xa9b8ac, roughness: 0.7 });
  mats.pidge = new THREE.MeshStandardMaterial({ map: pidgeTex(), roughness: 0.7 });
  mats.keys = new THREE.MeshStandardMaterial({ map: keyBoardTex(), roughness: 0.6 });
  mats.vinyl = new THREE.MeshStandardMaterial({ map: speckle(13, 0.16, 2), color: 0xb9b4aa, roughness: 0.6 });
  mats.screen = new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x6a8aa8, emissiveIntensity: 0.9 });
  mats.glass = new THREE.MeshStandardMaterial({ color: 0xcfe4ee, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.1, depthWrite: false });
  mats.glassOut = outGlass();
  mats.parcel = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 });
  mats.doorBlack = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.45 });      // the leaves: dark paint (the photograph)
  const B = new Batch();
  // ---------------------------------------------------------------- shell: the doorway and the window are real holes
  const wallFace = (x0, z0, x1, z1, outline, holes = []) => { B.push(frame(x0, 0, z0, x1 - x0, z1 - z0)); B.face('wallC', outline, holes); B.pop(); };
  wallFace(X0, Z0, X1, Z0, rectPts(0, 0, LW, H));                    // north (faces south)
  wallFace(X0, 0, X0, Z0, rectPts(0, 0, Z, H));                      // west
  { const c = PL.nwCut; wallFace(X0, Z0 + c, X0 + c, Z0, rectPts(0, 0, c * Math.SQRT2, H)); col.addSegment(X0, Z0 + c, X0 + c, Z0); }      // the cut-off north-west corner (the 1939 plan)
  // east: the street front's north ground-floor window (a real opening: the forecourt and Walton Street beyond),
  // round-headed, at the back of a deep white reveal
  const ws = WN.z - Z0, wp = archPts(ws, WN.w, WN.y0, WN.ys, 12), GD = PL.seamless.openings[0].depth;      // (the pane: 3 cm inside the punched plane)
  wallFace(X1, Z0, X1, 0, rectPts(0, 0, Z, H), [wp]);
  const sd0 = X1 - (DR.x + DR.w / 2), sd1 = X1 - (DR.x - DR.w / 2);      // along the south wall from its east end
  wallFace(X1, 0, X0, 0, [[0, 0], [sd0, 0], [sd0, DR.h], [sd1, DR.h], [sd1, 0], [LW, 0], [LW, H], [0, H]]);
  col.addSegment(X0, Z0, X1, Z0); col.addSegment(X0, 0, X0, Z0); col.addSegment(X1, Z0, X1, 0);
  col.addSegment(X0, 0, X1, 0);      // (whole: the walk-in doorway's passage opens it)
  B.flat('vinyl', [[X0, Z0], [X1, Z0], [X1, 0], [X0, 0]], 0);
  B.flat('wallC', [[X0, Z0], [X1, Z0], [X1, 0], [X0, 0]], H, [], true);   // (same material as the walls: its map is mottling only, so no banding here)
  const DOUT = PL.seamless.portals[0].depth + 0.03;      // the doorway's punched plane, out from the room's wall face
  B.push(frame(X1, 0, 0, -1, 0));      // the south wall from inside: s from its east end, -z = out through the wall
  B.reveal('plasterWhite', rectPts(sd0, 0, sd1, DR.h), 0, -DOUT + 0.07, true); B.reveal('plasterWhite', rectPts(sd0 + 0.008, 0, sd1 - 0.008, DR.h - 0.008), -DOUT + 0.07, -DOUT, true);      // (its last 7 cm lie in the exterior's own recess: 8 mm inside its outline)                                 // door reveal, out to the stone one
  B.boxXZ('oak', sd0 - 0.07, sd0, 0, DR.h + 0.07, 0, 0.025); B.boxXZ('oak', sd1, sd1 + 0.07, 0, DR.h + 0.07, 0, 0.025); B.boxXZ('oak', sd0 - 0.07, sd1 + 0.07, DR.h, DR.h + 0.07, 0, 0.025);   // architrave
  B.boxXZ('stoneFloor', sd0, sd1, -0.02, 0.004, -DOUT, 0);                                              // threshold
  if (!walkIn) B.boxXZ('doorBlack', sd0, sd1, 0, DR.h, -0.14, -0.1);      // (old door path only: a shut leaf)
  // a notice board on the wall east of the door (GUESS)
  B.sign('notice', 0.15, 1.2, sd0 - 0.3, 2.0, 0.02, [0, 0, 1, 1]);
  B.pop();
  // the window from inside (s from the wall's north end, -z = out through the wall): white sashes three lights wide
  // under a fan, as the street front has them
  B.push(frame(X1, 0, Z0, 0, 1));
  { const r = WN.w / 2, hgt = WN.ys - WN.y0, zb = -GD + 0.03, top = (dx) => WN.ys + Math.sqrt(Math.max(0, r * r - dx * dx));
    B.reveal('plasterWhite', wp, 0, -GD + 0.02); B.reveal('plasterWhite', archPts(ws, WN.w - 0.016, WN.y0 + 0.008, WN.ys, 12), -GD + 0.02, -GD - 0.03);      // (the last 5 cm, in the exterior's recess, 8 mm inside its outline) B.face('glass', wp, [], -GD); B.face('glassOut', wp, [], -GD + 0.065, true);
    for (const dx of [-r / 3, r / 3]) B.box('plasterWhite', ws + dx, (WN.y0 + WN.ys) / 2, zb, 0.035, hgt, 0.03);
    for (let k = 1; k <= 4; k++) B.box('plasterWhite', ws, WN.y0 + (k * hgt) / 4, zb, WN.w, k === 2 ? 0.07 : 0.04, k === 2 ? 0.05 : 0.03);
    for (const sx of [-1, 1]) B.box('plasterWhite', ws + sx * (r - 0.04), (WN.y0 + WN.ys) / 2, zb, 0.08, hgt, 0.05);
    B.box('plasterWhite', ws, WN.y0 + 0.04, zb, WN.w, 0.08, 0.05);
    for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI, a1 = ((k + 1) / 8) * Math.PI, rr = r - 0.04; B.beam('plasterWhite', [ws + Math.cos(a0) * rr, WN.ys + Math.sin(a0) * rr, zb], [ws + Math.cos(a1) * rr, WN.ys + Math.sin(a1) * rr, zb], 0.05, 0.08); }
    for (const an of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) B.beam('plasterWhite', [ws, WN.ys, zb], [ws + Math.cos(an) * (r - 0.04), WN.ys + Math.sin(an) * (r - 0.04), zb], 0.03, 0.035);
    void top;
    B.box('plasterWhite', ws, WN.y0 - 0.03, 0.03, WN.w + 0.12, 0.06, 0.16); }      // sill board
  B.pop();
  // ---------------------------------------------------------------- the counter (the photograph)
  // Measured in the photograph (14 mm lens; the doorway 1.25 m wide puts the camera 2.6 m from the threshold): the green
  // front crosses the line of the doorway's west jamb 1.25 m inside the room, and ends at a square post 0.15 m east of
  // the door's axis 2.35 m in; the cabinet beyond the post stands 0.6 m further back, 0.6 - 1.0 m east of the axis.
  // So: a round counter about a centre on the west wall, from that wall round to the post, bulging towards the door;
  // then the top carries on back and east over a flap (the way in behind) to the cabinet, and (GUESS) on to the east
  // wall. The front is clear of the doorway's own passage (core: 0.9 m inside the door, as wide as the doorway, in
  // which no collider counts while the leaves are open).
  // (r: 2.49 fits those two points exactly; 2.40 — 0.1 m inside the measurement's own uncertainty — keeps a body in the
  //  doorway's passage off the counter's face)
  const cx = X0, cz = -3.18, r = 2.40, a0 = Math.atan2(-2.35 - cz, 0.15 - cx), a1 = Math.PI / 2, n = 10, CH = 1.1, tScr = 0.87;
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n, tm = (t0 + t1) / 2;
    const px = cx + Math.cos(tm) * r, pz = cz + Math.sin(tm) * r, len = r * (t1 - t0) + 0.02, rot = -tm + Math.PI / 2;
    B.box('counterFront', px, 0.1 + (CH - 0.1) / 2, pz, len, CH - 0.1, 0.06, rot); B.box('lightOak', px, 0.05, pz, len, 0.1, 0.07, rot);
    const qx = cx + Math.cos(tm) * (r - 0.25), qz = cz + Math.sin(tm) * (r - 0.25);
    B.box('lightOak', qx, CH + 0.025, qz, len + 0.03, 0.05, 0.6, rot);
    B.box('lightOak', cx + Math.cos(tm) * (r - 0.5), 0.76, cz + Math.sin(tm) * (r - 0.5), len, 0.04, 0.5, rot);      // the porters' desk top behind it
    col.addBox(qx, qz, len, 0.55, rot);
    // the glazed screen standing on the counter's western part, a white post at its end
    if (tm > tScr) B.box('glass', cx + Math.cos(tm) * (r - 0.03), CH + 0.05 + 0.45, cz + Math.sin(tm) * (r - 0.03), len, 0.9, 0.012, rot);
  }
  { const te = a0 + Math.ceil(((tScr - a0) / (a1 - a0)) * n) * ((a1 - a0) / n), px = cx + Math.cos(te) * (r - 0.03), pz = cz + Math.sin(te) * (r - 0.03); B.box('plasterWhite', px, (CH + 2.05) / 2, pz, 0.06, 2.05 - CH, 0.06, -te + Math.PI / 2); }
  const PX = cx + Math.cos(a0) * r, PZ = cz + Math.sin(a0) * r;      // the post at the counter's end
  B.box('lightOak', PX - 0.03, 0.6, PZ - 0.03, 0.09, 1.2, 0.09);
  // beyond the post: the top over the flap, back to the cabinet; the cabinet; the counter on to the east wall
  const KZ = PZ - 0.62, K0 = 0.59, K1 = 0.97, KD = 0.55;
  { const dx = K0 - PX, dz = KZ - PZ, L = Math.hypot(dx, dz), rot = Math.atan2(-dz, dx);
    const mx = (PX + K0) / 2 + 0.2 * (dz / L), mz = (PZ + KZ) / 2 - 0.2 * (dx / L);      // (0.2 m behind the line from the post to the cabinet: the porters' side)
    B.box('lightOak', mx, CH + 0.025, mz, L + 0.1, 0.05, 0.5, rot); col.addBox(mx, mz, L + 0.1, 0.5, rot); }
  B.boxXZ('lightOak', K0, X1, CH, CH + 0.05, KZ - KD, KZ + 0.03);
  B.boxXZ('lightOak', K0, K1, 0, CH, KZ - KD, KZ); B.boxXZ('lightOak', K0 + 0.03, K1 - 0.03, 0.08, CH - 0.06, KZ, KZ + 0.012);      // the cabinet and its raised front panel
  B.boxXZ('lightOak', K1, X1, 0, CH, KZ - KD + 0.05, KZ - 0.03);
  col.addBox((K0 + X1) / 2, KZ - KD / 2, X1 - K0, KD, 0);
  // ---------------------------------------------------------------- behind the counter
  // pigeonholes on the north wall (the photograph: right of the door's axis), a low rack under them
  const rackX = X1 - 2.1;
  B.push(frame(rackX, 0, Z0, 1, 0)); B.boxXZ('lightOak', -0.04, 2.04, 0.96, 2.34, 0, 0.35); B.sign('pidge', 0, 1.0, 2.0, 2.3, 0.352, [0, 0, 1, 1]);
  B.boxXZ('lightOak', -0.04, 2.04, 0, 0.82, 0, 0.42); B.sign('pidge', 0, 0.06, 2.0, 0.78, 0.422, [0, 0, 1, 0.5]); B.pop();
  col.addBox(rackX + 1.0, Z0 + 0.21, 2.08, 0.42, 0);
  // GUESSES from here: the board of spare keys on the north wall west of the pigeonholes, parcels under it
  const kbL = 1.3, kb0 = X0 + PL.nwCut + 0.1;
  B.push(frame(kb0, 0, Z0, 1, 0));
  B.boxXZ('lightOak', -0.05, kbL + 0.05, 1.05, 2.25, 0, 0.08); B.sign('keys', 0.0, 1.1, kbL, 2.2, 0.081, [0, 0, 0.54, 1]);
  B.boxXZ('brass', kbL - 0.2, kbL - 0.16, 1.6, 1.72, 0.08, 0.1);
  B.pop();
  for (let i = 0; i < 6; i++) B.box('parcel', kb0 + 0.2 + (i % 3) * 0.43, 0.12 + Math.floor(i / 3) * 0.25, Z0 + 0.3 + (i % 2) * 0.08, 0.4, 0.24, 0.32);
  col.addBox(kb0 + 0.65, Z0 + 0.28, 1.3, 0.5, 0);
  // the porters' desk on the west wall with the CCTV monitors, the signing-in book on the counter, a key cabinet
  B.boxXZ('lightOak', X0, X0 + 0.6, 0, 0.76, -3.7, -2.7);
  col.addBox(X0 + 0.3, -3.2, 0.6, 1.0, 0);
  for (const z of [-3.45, -2.95]) { B.box('black', X0 + 0.3, 1.0, z, 0.08, 0.38, 0.44); B.box('screen', X0 + 0.345, 1.0, z, 0.02, 0.32, 0.4); }
  { const tb = a0 + 0.3; B.box('paper', cx + Math.cos(tb) * (r - 0.25), CH + 0.065, cz + Math.sin(tb) * (r - 0.25), 0.4, 0.03, 0.3, -tb + Math.PI / 2); }
  B.boxXZ('oak', X0, X0 + 0.15, 1.3, 2.3, -2.5, -1.6); B.box('brass', X0 + 0.16, 1.8, -2.05, 0.01, 0.8, 0.7);
  // a small post rack on the east wall by the door (Prof. Yang looks into it: places/_friends_yang.js)
  const prZ = -1.45, prL = 1.0;
  B.push(frame(X1, 0, prZ, 0, 1)); B.boxXZ('lightOak', -0.04, prL + 0.04, 1.02, 1.9, 0, 0.2); B.sign('pidge', 0, 1.06, prL, 1.86, 0.202, [0, 0, 0.5, 0.6]); B.pop();
  col.addBox(X1 - 0.1, prZ + prL / 2, 0.2, prL + 0.08, 0);
  // ceiling light
  B.box('lampGlow', 0, H - 0.04, -2.3, 0.9, 0.04, 0.9, 0, { bottom: true });
  const meshes = buildBatch(B, sc, mats);
  mergeStatic(sc);
  // the doors to the gate hall: a pair of dark panelled leaves hung at the jambs, opening inwards. They stand FOLDED
  // BACK against the doorway's sides, as the photograph has them (an old door stays where it is left: `rest` is open)
  let door = null; const doors = [];
  if (walkIn) {
    const lw = DR.w / 2 - 0.03, lh = DR.h - 0.02, zh = DOUT - 0.1, OPEN = 1.5;      // (hinged 3 cm inside each jamb: folded back, a leaf lies against the doorway's side, not in it)
    const o = { kind: 'hinged', style: 'oak', kick: false, y: 0, w: lw, h: lh, closer: false, heavy: true, rest: OPEN, thick: 0.05, mats: { leaf: mats.doorBlack, handle: S.brass }, portal: 0 };
    doors.push(ctx.addDoor({ ...o, at: [DR.x - lw, zh], dir: Math.PI / 2, swing: 1 }), ctx.addDoor({ ...o, at: [DR.x + lw, zh], dir: -Math.PI / 2, swing: -1 }));
    // (two leaves on one doorway: the way through is open while either leaf is)
    const P0 = ctx.seamless.portals && ctx.seamless.portals[0], sync = () => { if (P0) P0.open = doors[0].passable || doors[1].passable; };
    for (const D of doors) { if (D.onPass) D.onPass(sync); if (D.group && D.o) { D.th = OPEN * D.o.swing; D.target = OPEN; D.side = D.o.swing; D.open = 1; D.group.rotation.y = D.o.dir + D.th; } }
    // a body does not pass through the folded-back leaves: core lets one through a wide-open leaf (it lies beside the
    // way), and nothing else counts inside a doorway's passage but a 'door' line — so each leaf's line, as it stands
    for (const sg of [-1, 1]) { const a = sg * (Math.PI / 2 + OPEN); col.addSegment(DR.x - sg * lw, zh, DR.x - sg * lw + Math.sin(a) * lw, zh + Math.cos(a) * lw, { tag: 'door' }); }
    door = doors[0];
  }
  const { amb, hemi } = ambientOf(sc);
  const lamp = addPoint(sc, 0, 3.2, -2.3, 0xfff0d8, 4, 10);
  const PORTER = [cx + 1.3 * Math.cos(0.7), cz + 1.3 * Math.sin(0.7)];      // behind the counter, facing the door
  return {
    spawn: [0.2, -0.9], heading: Math.PI, exit: [0, -0.35],
    // (pidge: the anchor of the friends' Yang scene, places/_friends_yang.js: he stands 1.2 m south of it, 0.1 m west, facing the post rack on the east wall)
    keys: [1.3, KZ + 0.6], pidge: [X1 - 0.65, prZ + prL / 2 - 1.2], counter: [PX + 0.3, PZ + 0.95], porter: [PORTER[0], PORTER[1], Math.atan2(-PORTER[0], -PORTER[1])],
    window: [X1 - 0.6, WN.z + 1.2], meshes, door, doors,
    setLight(d) { mats.glassOut.userData.setDay(d); if (amb) amb.intensity = 0.45 + d * 0.2; if (hemi) hemi.intensity = 0.3 + d * 0.2; lamp.intensity = 2.6 + (1 - d) * 1.6; },
  };
}
