// Memorial Room (War Memorial Room, 1949; former kitchen/brewhouse, west range of Provost's Yard / Besse Quad).
// Photo: CEH-Memorial-Room (college venue-hire page). Cream walls, oak dado, herringbone parquet, beamed ceiling,
// sash windows with patterned curtains on one long wall, big gilt-framed portraits, half-glazed oak double doors at the
// far end, boardroom tables with magenta chairs, a lectern. The memorial board itself: GUESS (not visible in the photo).
// A WALK-IN room (core/interiors.js "seamless"; plan: _worcint_lodge_plan.js MEMORIAL): in place on the ground floor of
// the tall block at the north end of Provost's Yard's west range, as places/worcester_yard.js builds it (5.7 x 8.5 m
// inside; refitted 2026-11-22: it was 6 x 12 m in the generator's range). The yard door is a real doorway with a pair
// of half-glazed oak leaves; the sash in the west wall (the photograph's, near the north end, between the still life
// and the small portrait) and the one to the yard are real openings exactly where the range paints its sashes. The
// deep beam crosses on its pier a third of the way from the south end; the bishop hangs south of the pier; the glazed
// double doors are in the north wall's east corner (shut: they lead on into the range).
// Room frame: x -X (west) .. X (east, the yard), z -Z (north) .. Z (south); the yard door in the east wall at door.z.
import * as THREE from 'three';
import { Batch, frame, rectPts, sharedMats, buildBatch, addPoint, ambientOf, mergeStatic, sash, outGlass, panelling, portrait, wallShade, woodGrain } from './_worcint_kit.js';
import { canvas, tex, rng } from './_worcint_tex.js';
import { MEMORIAL as PM } from './_worcint_lodge_plan.js';

function parquetTex() {
  const { c, g } = canvas(512, 512), R = rng(17);
  g.fillStyle = '#6a3a1e'; g.fillRect(0, 0, 512, 512);
  const bw = 32, bl = 128;
  for (let y = -bl; y < 512 + bl; y += bw) for (let x = -bl; x < 512 + bl; x += bl) {
    const v = 0.75 + R() * 0.35, col = (k) => `rgb(${(150 * v * k) | 0},${(82 * v * k) | 0},${(42 * v * k) | 0})`;
    // herringbone: two blocks at 45° per cell
    g.save(); g.translate(x + ((y / bw) % 2) * 64, y); g.rotate(Math.PI / 4); g.fillStyle = col(1); g.fillRect(0, 0, bl * 0.7, bw * 0.7); g.restore();
    g.save(); g.translate(x + 64 + ((y / bw) % 2) * 64, y); g.rotate(-Math.PI / 4); g.fillStyle = col(0.85); g.fillRect(0, 0, bl * 0.7, bw * 0.7); g.restore();
  }
  g.strokeStyle = 'rgba(30,15,5,0.5)'; g.lineWidth = 1; for (let i = 0; i < 512; i += 23) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 512, 512); g.stroke(); }
  return tex(c, { wrap: true });
}
function curtainTex() {
  const { c, g } = canvas(128, 256); g.fillStyle = '#e8dcc4'; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 32) for (let x = 0; x < 128; x += 32) { g.fillStyle = (x + y) % 64 ? '#9a4a3a' : '#7a6a8a'; g.beginPath(); g.ellipse(x + 16, y + 16, 9, 12, 0, 0, Math.PI * 2); g.fill(); }
  for (let x = 0; x < 128; x += 16) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 0, 6, 256); }
  return tex(c, { wrap: true });
}
function memorialBoard() {
  const { c, g } = canvas(512, 384); g.fillStyle = '#2a1a10'; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = '#c9a44c'; g.lineWidth = 6; g.strokeRect(10, 10, 492, 364);
  g.fillStyle = '#d8b450'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('1939 — 1945', 256, 58);
  g.font = '16px Georgia, serif'; g.fillText('IN MEMORY OF THE MEMBERS OF THIS COLLEGE', 256, 88);
  const R = rng(5); g.fillStyle = '#c9a44c';
  for (let col = 0; col < 3; col++) for (let row = 0; row < 14; row++) g.fillRect(40 + col * 156, 112 + row * 18, 70 + R() * 50, 5);   // names, illegible at this size
  return tex(c, { wrap: false });
}

export function buildMemorial(ctx, game) {
  const S = sharedMats(game), sc = ctx.scene, col = ctx.collider;
  const { X, Z, H, DADO } = PM, DW = PM.door.w / 2, DH = PM.door.h;
  const walkIn = !!(ctx.seamless && ctx.addDoor);
  const mats = { ...S };
  mats.wallC = new THREE.MeshStandardMaterial({ map: wallShade(H, { top: 0.35, bottom: 0.4 }), color: 0xf0e8d4, roughness: 0.92 });
  const pt = parquetTex(); pt.repeat.set(1 / 1.6, 1 / 1.6); mats.parquet = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.4 });
  const ct = curtainTex(); ct.repeat.set(1 / 0.6, 1 / 1.2); mats.curtain = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 });
  mats.magenta = new THREE.MeshStandardMaterial({ color: 0xd4106a, roughness: 0.7 });
  mats.chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.8, roughness: 0.3 });
  mats.tableTop = new THREE.MeshStandardMaterial({ map: woodGrain(false, 1, true), color: 0xead2a4, roughness: 0.45 });
  mats.walnut = new THREE.MeshStandardMaterial({ map: woodGrain(true), color: 0x7c4826, roughness: 0.45 });
  mats.board = new THREE.MeshStandardMaterial({ map: memorialBoard(), roughness: 0.5 });
  mats.glass = new THREE.MeshStandardMaterial({ color: 0xcfe4ee, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.1, depthWrite: false });      // real glass: the gardens are beyond it
  mats.glassOut = outGlass();
  mats.dimGlass = new THREE.MeshStandardMaterial({ color: 0x2a3138, roughness: 0.25, metalness: 0.3 });      // the inner doors' panes (an unlit lobby beyond)
  const B = new Batch();
  const FW = frame(-X, 0, Z, 0, -1), FE = frame(X, 0, -Z, 0, 1), FN = frame(-X, 0, -Z, 1, 0), FS = frame(X, 0, Z, -1, 0);
  const WWIN = PM.wins, EWIN = PM.winsE, DZ = PM.door.z, SD = PM.winDepth;   // the sashes on the west wall (s = Z - z) and the east (s = z + Z): where the range's faces have them
  B.push(FW); B.face('wallC', rectPts(0, 0, 2 * Z, H), WWIN.map((w) => rectPts(Z - w.z - w.w / 2, w.y0, Z - w.z + w.w / 2, w.y1))); B.pop();
  const doorS = Z + DZ;   // the east wall's door
  B.push(FE); B.face('wallC', [[0, 0], [doorS - DW, 0], [doorS - DW, DH], [doorS + DW, DH], [doorS + DW, 0], [2 * Z, 0], [2 * Z, H], [0, H]], EWIN.map((w) => rectPts(Z + w.z - w.w / 2, w.y0, Z + w.z + w.w / 2, w.y1))); B.reveal('oak', rectPts(doorS - DW, 0, doorS + DW, DH), 0, -PM.WALL, true); B.boxXZ('stoneFloor', doorS - DW, doorS + DW, -0.02, 0.004, -(PM.WALL - 0.01), 0); B.pop();      // (out to the range's wall face, where the door-case's jambs begin: it ran 6 cm on into them)
  const ND0 = 2 * X - 2.0, ND1 = 2 * X - 0.4;   // the glazed double doors in the north wall's east corner
  B.push(FN); B.face('wallC', [[0, 0], [ND0, 0], [ND0, 2.4], [ND1, 2.4], [ND1, 0], [2 * X, 0], [2 * X, H], [0, H]]); B.pop();
  B.push(FS); B.face('wallC', rectPts(0, 0, 2 * X, H)); B.pop();
  // dado panelling all round (gaps at doors), windows with curtains
  B.push(FW); panelling(B, 0, 2 * Z, DADO, 'oak'); for (const w of WWIN) { const s = Z - w.z, hw = w.w / 2; sash(B, s - hw, s + hw, w.y0, w.y1, SD, { cols: 3, rows: 4, glassKey: 'glass', outKey: 'glassOut' }); for (const sx of [-1, 1]) B.box('curtain', s + sx * (hw + 0.25), (w.y1 + 0.75) / 2 + 0.05, 0.12, 0.42, w.y1 - 0.65, 0.08); B.box('curtain', s, w.y1 + 0.12, 0.12, w.w + 0.7, 0.26, 0.1); } B.pop();
  B.push(FE); panelling(B, 0, doorS - DW - 0.08, DADO, 'oak'); panelling(B, doorS + DW + 0.08, 2 * Z, DADO, 'oak');
  for (const w of EWIN) { const s = Z + w.z, hw = w.w / 2; sash(B, s - hw, s + hw, w.y0, w.y1, SD, { cols: 3, rows: 4, glassKey: 'glass', outKey: 'glassOut' }); for (const sx of [-1, 1]) B.box('curtain', s + sx * (hw + 0.25), (w.y1 + 0.75) / 2 + 0.05, 0.12, 0.42, w.y1 - 0.65, 0.08); B.box('curtain', s, w.y1 + 0.12, 0.12, w.w + 0.7, 0.26, 0.1); B.box('radiator', s, 0.47, 0.1, 1.0, 0.6, 0.1); }
  if (!walkIn) B.box('oak', doorS, DH / 2, -0.2, 2 * DW, DH, 0.06);      // (old door path only: a shut leaf)
  B.box('oak', doorS, DH + 0.06, 0.04, 2 * DW + 0.3, 0.12, 0.1); for (const sx of [-1, 1]) B.box('oak', doorS + sx * (DW + 0.04), DH / 2, 0.03, 0.08, DH, 0.06);      // architrave
  B.sign('board', doorS + 1.15, 1.4, doorS + 2.75, 2.7, 0.03, [0, 0, 1, 1]); B.box('giltFrame', doorS + 1.95, 2.05, 0.01, 1.75, 1.45, 0.03);      // (between the door and the yard window)
  B.pop();
  B.push(FN); panelling(B, 0, ND0 - 0.1, DADO, 'oak'); panelling(B, ND1 + 0.1, 2 * X, DADO, 'oak', 0.3);
  // half-glazed oak double doors (closed; lead elsewhere in the range)
  for (const s of [ND0 + 0.4, ND0 + 1.2]) { B.box('oak', s, 1.2, -0.05, 0.78, 2.4, 0.06); B.face('dimGlass', rectPts(s - 0.25, 1.45, s + 0.25, 2.15), [], 0.0); for (const yy of [1.8]) B.box('oak', s, yy, 0.0, 0.5, 0.04, 0.04); B.box('oak', s, 1.8, 0.0, 0.04, 0.7, 0.04); }
  B.pop();
  B.push(FS); panelling(B, 0, 2 * X, DADO, 'oak'); B.pop();
  // pictures on the west wall, as the photograph has them from the south end: the big bishop south of the pier, the
  // still life north of it, the window, a small portrait by the north corner
  const BZ = PM.beamZ;
  B.push(FW); portrait(B, Z - (BZ + 0.3 + Z) / 2, 2.3, 1.6, 1.25, 5, S.portraitUV, 0.02, 0.15); portrait(B, Z + 0.25, 2.15, 1.7, 1.05, 3, S.portraitUV, 0.02, 0.1); portrait(B, 2 * Z - 0.75, 2.2, 0.5, 0.65, 0, S.portraitUV, 0.02, 0.06); B.pop();
  // floor, ceiling with the deep cross beam
  B.flat('parquet', [[-X, -Z], [X, -Z], [X, Z], [-X, Z]], 0);
  B.flat('plasterWhite', [[-X, -Z], [X, -Z], [X, Z], [-X, Z]], H, [], true);
  B.boxXZ('plasterWhite', -X, X, H - 0.4, H, BZ - 0.25, BZ + 0.25, { bottom: true });      // the deep beam
  B.boxXZ('wallC', -X, -X + 0.42, DADO, H - 0.4, BZ - 0.3, BZ + 0.3, { top: false }); B.boxXZ('oak', -X, -X + 0.45, 0, DADO, BZ - 0.33, BZ + 0.33);      // … on its pier
  for (const [x0, x1, z0, z1] of [[-X, X, -Z, -Z + 0.09], [-X, X, Z - 0.09, Z], [-X, -X + 0.09, -Z, Z], [X - 0.09, X, -Z, Z]]) B.boxXZ('plasterWhite', x0, x1, H - 0.12, H, z0, z1, { bottom: true });   // plain cornice
  for (const z of [-3.2, -1.2, 0.5, 3.0]) { B.cyl('chrome', -1, H - 0.08, z, 0.08, 0.08, 8, false); B.cyl('lampGlow', -1, H - 0.1, z, 0.06, 0.02, 8, false); B.cyl('chrome', 1, H - 0.08, z, 0.08, 0.08, 8, false); B.cyl('lampGlow', 1, H - 0.1, z, 0.06, 0.02, 8, false); }
  // radiators under the windows
  B.push(FW); for (const w of WWIN) B.box('radiator', Z - w.z, 0.47, 0.1, 1.0, 0.6, 0.1); B.pop();
  // boardroom block of tables + magenta stacking chairs
  const tx0 = -0.75, tx1 = 0.75, tz0 = -2.6, tz1 = 2.6;      // (two 0.75 m tables side by side, as the photograph)
  B.boxXZ('tableTop', tx0, tx1, 0.72, 0.76, tz0, tz1);
  for (const [x, z] of [[tx0 + 0.1, tz0 + 0.1], [tx1 - 0.1, tz0 + 0.1], [tx0 + 0.1, tz1 - 0.1], [tx1 - 0.1, tz1 - 0.1], [0, 0], [tx0 + 0.1, 0], [tx1 - 0.1, 0]]) B.cyl('chrome', x, 0, z, 0.025, 0.72, 6, false);
  col.addBox(0, 0, tx1 - tx0 + 1.2, tz1 - tz0, 0);      // (the tables and the chairs drawn up along both sides: those chairs used to be walked through; the way round each END of the table is left as it was)
  const chairs = [];
  const chair = (x, z, h) => {
    const c = Math.cos(h), s = Math.sin(h);
    B.box('magenta', x, 0.47, z, 0.46, 0.06, 0.44, h);
    B.box('magenta', x - s * 0.2, 0.8, z - c * 0.2, 0.44, 0.5, 0.05, h);
    for (const [lx, lz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) B.cyl('chrome', x + lx * c + lz * s, 0, z - lx * s + lz * c, 0.012, 0.45, 5, false);
    chairs.push({ x, z, h });
  };
  for (let z = tz0 + 0.33; z < tz1; z += 0.65) { chair(tx0 - 0.45, z, Math.PI / 2); chair(tx1 + 0.45, z, -Math.PI / 2); }
  chair(0, tz0 - 0.45, 0); chair(0, tz1 + 0.45, Math.PI);
  // lectern (walnut, with vents) by the south end
  B.boxXZ('walnut', -2.45, -1.75, 0, 1.15, 3.55, 4.15); for (const y of [0.25, 0.95]) B.box('black', -2.1, y, 3.54, 0.4, 0.05, 0.01);
  col.addBox(-2.1, 3.85, 0.7, 0.6, 0); col.addBox(-X + 0.22, BZ, 0.45, 0.66, 0);
  col.addSegment(-X, -Z, X, -Z); col.addSegment(X, -Z, X, Z); col.addSegment(X, Z, -X, Z); col.addSegment(-X, Z, -X, -Z);
  buildBatch(B, sc, mats);
  mergeStatic(sc);
  // the yard door: a pair of half-glazed oak leaves in the 0.47 m reveal, opening inwards; old doors, they stay ajar
  const doors = [];
  if (walkIn) {
    const lw = DW, lh = DH - 0.02, o = { kind: 'hinged', style: 'fire', kick: false, y: 0, w: lw, h: lh, closer: false, heavy: true, rest: 0.5, thick: 0.05, vision: [0.13, lw - 0.13, 1.15, lh - 0.2], mats: { leaf: S.oak, handle: S.brass, glass: mats.glass }, portal: 0 };
    doors.push(ctx.addDoor({ ...o, at: [X + 0.07, DZ - DW], dir: 0, swing: -1 }), ctx.addDoor({ ...o, at: [X + 0.07, DZ + DW], dir: Math.PI, swing: 1 }));
    // (two leaves on one doorway: the way through is open while either leaf is)
    const P0 = ctx.seamless.portals[0], sync = () => { P0.open = doors[0].passable || doors[1].passable; };
    for (const D of doors) D.onPass(sync);
    for (const D of doors) { const L = new Batch(); for (const sx of [-1, 1]) L.boxXZ('oak', sx * 0.025 - 0.006, sx * 0.025 + 0.006, 0.2, 1.0, 0.13, lw - 0.13); L.boxXZ('oak', -0.02, 0.02, 1.58, 1.62, 0.13, lw - 0.13); for (const m of buildBatch(L, D.group, mats)) m.name = 'memorial:doorPanels'; }
  }
  const { amb, hemi } = ambientOf(sc);
  const sun = new THREE.DirectionalLight(0xfff2e0, 0.8); sun.position.set(-8, 6, 2); scene_add(sc, sun);
  const lamp = addPoint(sc, 0, H - 0.4, 0, 0xfff0dc, 4, 12);
  return {
    spawn: [X - 0.9, DZ], heading: -Math.PI / 2, exit: [X - 0.3, DZ], chairs, doors, window: [-X + 0.9, WWIN[0].z],
    /** daylight 0..1; on: the lights are on (a tutorial is sitting, or you are in the room) — an empty room at night is dark */
    setLight(d, on = true) { mats.glassOut.userData.setDay(d); sun.intensity = 0.1 + d * 0.9; if (amb) amb.intensity = (on ? 0.35 : 0.12) + d * 0.3; if (hemi) hemi.intensity = (on ? 0.25 : 0.08) + d * 0.3; lamp.intensity = on ? 1.6 + (1 - d) * 3.4 : 0.1 + d * 1.4; },
  };
}
function scene_add(sc, l) { l.target.position.set(0, 0, 0); sc.add(l, l.target); }
