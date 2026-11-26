// The Library over the loggia, and the stone stair up to it. Photos: college blog "On the occasion of the Library's
// 300th birthday" (empty-lower-library, looking-down-from-gallery, the-readers-view-red-desk-lamp); the quad front
// (Commons, Godot13 2014) for its windows; the stair: the college's `library cantilevered spiral staircase looking up`
// and Commons 165456703, the 1939 RCHM plan (all in reference/worcester/01 …).
// Long narrow room; windows on the west (quad) side with reading desks and red lamps (Godfrey 1960); white bookcases
// with brass grilles along the east wall under a cantilevered gallery on gilded Corinthian columns (1825); pale blue
// ceiling with three roses; crystal chandeliers.
// A WALK-IN room (core/interiors.js "seamless"), in place in the main block as it is: the plan, its frame and what is
// known / guessed are in _worcint_library_plan.js. The way up is the real one (the owner, 2026-11-22): a doorway in the
// gate hall directly opposite the Porters' Lodge door, and behind it the round drum with its open-well cantilevered
// stair — 66 moulded stone steps rising clockwise, a wrought-iron balustrade and dark handrail round the well, one
// barred window to the forecourt: just under one full turn to the LIBRARY's landing on the west side (a short passage
// through the wall and a baize door into the room), another full turn to the top landing under a saucer ceiling with a
// plaster rose, and off that the ATTIC LIBRARY — this room's upper storey: a link over the gate hall and the two wings'
// attics, bookstacks and desks behind the small square windows under the cornice. The Library's nine windows are real
// openings onto the live Main Quad; the attic's ten onto the forecourt and the street.
// Frame: x north->south, z west (0 = the quad front's face), y = height above the datum less 2 cm. The Library x
// 0.9..34.9, z -0.8..-5.9, floor LF; the drum centre (22.15, -9.5), radius 2.3; the attic east of z -6.9, floor AF.
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts, sharedMats, buildBatch, addPoint, ambientOf, mergeStatic, skyGlass, chairAt, sash, outGlass, woodGrain, wallShade, windowGlass } from './_worcint_kit.js';
import { bookSpines, grilleTex, greekKey, rosette, canvas, tex, rng } from './_worcint_tex.js';
import { LF, LH, TOP, GY, WT, ZW, ZE, ROOM, CASE, GAL, SP, spAt, treadA, treadW, treadOf, treadY, drumX, drumXS, AF, ATOP, ATTIC, AWIN, ADESKS, STACKS, LINK, PASS_X, setRef, groundY, azOf, DOOR, INNER, PRESS, SWIN, WINDOWS, GLASS_IN, PUNCH_IN, DESKS, DESK, COLUMNS, OPENINGS, PORTAL, BOUNDS, CENTER, BASE, toWorld, ROT } from './_worcint_library_plan.js';

export const LIB = {
  LF, LH, LL: ROOM.x1 - ROOM.x0,
  /** the world side of the foot door, for tools: [x, z] on the gate hall's floor in front of it, and the heading out of it */
  door: toWorld(PASS_X - 0.55, DOOR.at[1]), doorFacing: DOOR.out + ROT,
  doorUV: DOOR.uv, doorW: DOOR.w, doorH: DOOR.h,
  /** the registration's `seamless` block (core/interiors.js). The room's y is the height above the college's datum
   *  less BASE (2 cm): the drum's flags, drawn at y0, are then exactly the gate hall's paving. */
  seamless: {
    portals: [{ ...PORTAL, world: [...toWorld(DOOR.at[0], DOOR.at[1]), DOOR.out + ROT] }],
    openings: OPENINGS, bounds: BOUNDS, center: CENTER, lift: BASE, baseY: BASE,
  },
};

/** honey ashlar in 0.3 m courses (the drum's bare stone wall: the college's photograph); 3.6 x 2.4 m a repeat */
function ashlarTex() {
  const { c, g } = canvas(384, 256), R = rng(73), ch = 32;
  g.fillStyle = '#d9c391'; g.fillRect(0, 0, 384, 256);
  for (let r = 0; r < 8; r++) {
    let x = -(r % 2) * 40 - R() * 30;
    while (x < 384) {
      const w = 60 + R() * 70, k = R();
      g.fillStyle = `rgb(${205 + k * 26 | 0},${183 + k * 24 | 0},${128 + k * 28 | 0})`; g.fillRect(x, r * ch, w - 1, ch - 1);
      for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,90,50' : '255,244,214'},${0.05 + R() * 0.06})`; g.fillRect(x + R() * w, r * ch + R() * ch, 6 + R() * 22, 2 + R() * 7); }
      g.fillStyle = 'rgba(96,74,44,0.5)'; g.fillRect(x + w - 1, r * ch, 1, ch);
      x += w;
    }
    g.fillStyle = 'rgba(96,74,44,0.5)'; g.fillRect(0, r * ch + ch - 1, 384, 1);
  }
  const t = tex(c); t.repeat.set(1 / 3.6, 1 / 2.4); return t;
}
/** the wrought-iron balustrade, two balusters to a repeat (white on nothing; the material's colour is the iron): a bar
 *  carrying a pair of scrolls under the rail, then a plain bar with a knop — as the photographs have them alternate */
function ironTex() {
  const { c, g } = canvas(128, 256);
  g.clearRect(0, 0, 128, 256); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
  const bar = (x) => { g.fillRect(x - 3.5, 0, 7, 256); };
  bar(32); bar(96);
  for (const X of [32, 96]) for (const y of [204, 150]) { g.beginPath(); g.ellipse(X, y, 6, 5, 0, 0, Math.PI * 2); g.fill(); }      // collars
  g.lineWidth = 5;
  for (const X of [32, 96]) for (const sx of [-1, 1]) {      // every baluster (the college's photograph): a C-scroll each side under the rail, a smaller pair below
    g.beginPath(); g.moveTo(X, 150);
    g.bezierCurveTo(X + sx * 6, 110, X + sx * 30, 104, X + sx * 29, 76);
    g.bezierCurveTo(X + sx * 28, 54, X + sx * 10, 52, X + sx * 11, 70);
    g.bezierCurveTo(X + sx * 12, 82, X + sx * 22, 80, X + sx * 20, 70); g.stroke();
    g.beginPath(); g.moveTo(X, 204);      // and a smaller one below, turned down
    g.bezierCurveTo(X + sx * 5, 226, X + sx * 22, 228, X + sx * 21, 212);
    g.bezierCurveTo(X + sx * 20, 202, X + sx * 11, 204, X + sx * 12, 212); g.stroke();
  }
  const t = tex(c, { wrap: false }); t.wrapS = THREE.RepeatWrapping; t.needsUpdate = true; return t;
}
/** an armorial panel of painted glass (one hangs in each window's lower sash: the 2014 photograph). GUESS: its arms. */
function armsTex() {
  const { c, g } = canvas(64, 80);
  g.fillStyle = '#d8dccb'; g.fillRect(0, 0, 64, 80); g.strokeStyle = '#3a3a34'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 78);
  g.beginPath(); g.moveTo(12, 14); g.lineTo(52, 14); g.lineTo(52, 44); g.quadraticCurveTo(50, 62, 32, 70); g.quadraticCurveTo(14, 62, 12, 44); g.closePath();
  g.fillStyle = '#e8e2c6'; g.fill(); g.stroke();
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(14, 46); g.lineTo(32, 30); g.lineTo(50, 46); g.lineTo(50, 54); g.lineTo(32, 38); g.lineTo(14, 54); g.closePath(); g.fill();      // a chevron
  for (const [x, y] of [[22, 22], [42, 22], [32, 56]]) { g.fillStyle = '#1a1a1a'; g.fillRect(x - 4, y - 2, 8, 4); g.fillRect(x - 1, y - 5, 3, 3); }                                        // three birds, as blots
  g.fillStyle = '#a8322a'; g.fillRect(4, 4, 56, 5); g.fillStyle = '#c9a23a'; g.fillRect(4, 72, 56, 4);
  return tex(c, { wrap: false });
}
function roseTex() {
  const { c, g } = canvas(128, 128);
  g.fillStyle = '#d8c8a2'; g.fillRect(0, 0, 128, 128);
  rosette(g, 64, 64, 58, '#b9a67c', '#8c7a55', 8); rosette(g, 64, 64, 34, '#cdbb92', '#7d6c4a', 8);
  return tex(c, { wrap: false });
}

export function buildLibrary(ctx, game) {
  // three colliders: `col` (the room's own: the Library, the passage from its landing, both flights of the stair and the
  // Library's landing), `colT` (the top landing and the attic) and `colG` (the drum's ground floor and the foot
  // doorway). They differ where the stair passes over itself and over the floor: the Library's doorway is a wall for
  // someone on the top landing above it, the attic's doorways are walls for someone below, the foot doorway is a wall
  // for someone on the stair, and the low space under the first treads is shut to someone on the floor
  const S = sharedMats(game), sc = ctx.scene, col = ctx.collider, colT = ctx.newCollider ? ctx.newCollider() : ctx.collider, colG = ctx.newCollider ? ctx.newCollider() : ctx.collider;
  const walkIn = !!(ctx.seamless && ctx.addDoor);
  const { x0: X0, x1: X1 } = ROOM, LL = X1 - X0;
  const mats = { ...S };
  { const wt = wallShade(LH, { top: 0.6, bottom: 0.8 }); wt.offset.y = -(LF % LH) / LH; mats.green = new THREE.MeshStandardMaterial({ map: wt, color: 0x808d7f, roughness: 0.9 }); }
  mats.blue = new THREE.MeshStandardMaterial({ color: 0xb4d0e0, emissive: 0x6a8494, emissiveIntensity: 0.45, roughness: 0.9 });
  mats.white = new THREE.MeshStandardMaterial({ color: 0xf0eee6, roughness: 0.7 });
  const bt = bookSpines(); bt.repeat.set(1 / 2.0, 1 / 2.4); mats.books2 = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.8 });
  const gt = grilleTex(); gt.repeat.set(1 / 0.12, 1 / 0.12); mats.grille = new THREE.MeshStandardMaterial({ map: gt, transparent: true, alphaTest: 0.3, metalness: 0.6, roughness: 0.4, color: 0xffffff });
  mats.gilt = new THREE.MeshStandardMaterial({ color: 0xd8b458, metalness: 0.55, roughness: 0.35 });
  mats.redLamp = new THREE.MeshStandardMaterial({ color: 0xd8201c, emissive: 0xff4020, emissiveIntensity: 0.2, roughness: 0.4 });
  mats.redChair = new THREE.MeshStandardMaterial({ color: 0xb02028, roughness: 0.8 });
  mats.crystal = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, emissive: 0xfff2d8, emissiveIntensity: 0.4, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.8 });
  const kc = canvas(512, 32); greekKey(kc.g, 0, 0, 512, 32, '#1a1a1a', '#f0eee6'); const kt = tex(kc.c); kt.repeat.set(1 / 1.0, 1 / 0.22); mats.key = new THREE.MeshStandardMaterial({ map: kt, roughness: 0.7 });
  // glass: a real opening onto the quad (walk-in); the old path keeps a sky-coloured pane
  mats.glass = walkIn ? new THREE.MeshStandardMaterial({ color: 0xcfe0ea, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.09, depthWrite: false }) : skyGlass();
  mats.glassOut = outGlass();
  mats.arms = windowGlass(armsTex(), { color: 0x555555, day: 0.9, night: 0.04 });
  mats.stoneR = new THREE.MeshStandardMaterial({ color: 0xd6c59e, roughness: 0.95 });      // the outer part of a window's reveal: the front's own stone
  mats.boards = new THREE.MeshStandardMaterial({ map: woodGrain(), color: 0x735a3e, roughness: 0.5 });   // wide dark boards running the length of the room
  mats.flagsL = new THREE.MeshStandardMaterial({ map: S.stoneFloor.map, color: 0xcfc8b8, roughness: 0.8 });
  mats.atticW = new THREE.MeshStandardMaterial({ map: wallShade(2.43, { top: 0.2, bottom: 0.3 }), color: 0xe9e4d6, roughness: 0.92 });
  mats.greenLamp = new THREE.MeshStandardMaterial({ color: 0x1f7a4a, emissive: 0x38c070, emissiveIntensity: 0.2, roughness: 0.35 });
  mats.baize = new THREE.MeshStandardMaterial({ color: 0x2f5a44, roughness: 1 });
  // the stair: bare honey ashlar, stone treads (their ends and mouldings paler), a plastered soffit under the top landing
  mats.drum = new THREE.MeshStandardMaterial({ map: ashlarTex(), roughness: 0.95 });
  mats.tread = new THREE.MeshStandardMaterial({ color: 0xcbbd98, emissive: 0x8a7a55, emissiveIntensity: 0.3, roughness: 0.9 });      // (soffits and risers: lit only by what the stone walls throw back — the one lamp is above them)
  mats.treadEnd = new THREE.MeshStandardMaterial({ color: 0xe2d8bd, roughness: 0.85 });
  mats.drumCeil = new THREE.MeshStandardMaterial({ color: 0xd3c092, roughness: 0.95 });
  mats.rose = new THREE.MeshStandardMaterial({ map: roseTex(), roughness: 0.9 });
  mats.ironwork = new THREE.MeshStandardMaterial({ map: ironTex(), color: 0x16181e, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.45, roughness: 0.5 });      // (0.3: the bars are thin, and must not thin away in the small mip levels seen up the well)
  mats.winFrame = new THREE.MeshStandardMaterial({ color: 0xaab5a4, roughness: 0.7 });       // the stair window's pale green frame (the photograph)
  const B = new Batch();
  const seg = (x0, z0, x1, z1) => col.addSegment(x0, z0, x1, z1);
  // wall face from (x0,z0) to (x1,z1), seen from the side of n = (-dz, dx); outline / holes in (metres along, height)
  const wall = (key, x0, z0, x1, z1, outline, holes = []) => { B.push(frame(x0, 0, z0, x1 - x0, z1 - z0)); B.face(key, outline, holes); B.pop(); };

  // ================================================================ THE ROOM (y = LF)
  // ---------------- floor, ceiling, roses
  const plan = [[X0, ZE], [X1, ZE], [X1, ZW], [X0, ZW]], zMid = (ZE + ZW) / 2, roses = [CENTER[0] - 10.5, CENTER[0], CENTER[0] + 10.5];
  B.flat('boards', plan, LF);
  B.flat('blue', plan, TOP, [], true);
  for (const x of roses) { B.cyl('white', x, TOP - 0.06, zMid, 0.6, 0.06, 20, false); B.cyl('white', x, TOP - 0.1, zMid, 0.25, 0.04, 12, false); B.flat('white', Array.from({ length: 20 }, (_, i) => [x + Math.cos(i / 20 * Math.PI * 2) * 0.6, zMid + Math.sin(i / 20 * Math.PI * 2) * 0.6]), TOP - 0.06, [], true); }
  B.boxXZ('white', X0, X1, TOP - 0.3, TOP, ZW - 0.3, ZW, { bottom: true });                                   // cornice over the windows
  // ---------------- window wall (west, z = ZW): nine windows over the nine arches, the middle three round-headed (Hawksmoor) — real openings
  const sOf = (x) => X1 - x;
  const holes = WINDOWS.map((w) => (w.arched ? archPts(sOf(w.x), w.w, w.y0, w.ys, 12) : rectPts(sOf(w.x) - w.w / 2, w.y0, sOf(w.x) + w.w / 2, w.ys)));
  B.push(frame(X1, 0, ZW, -1, 0));   // faces -z (into the room); s = X1 - x; out through the wall is -z of this frame
  B.face('green', rectPts(0, LF, LL, TOP), holes);
  WINDOWS.forEach((w, i) => {
    // the sash stands GLASS_IN behind the front's face (which the middle three have 0.15 m further out): a deep white
    // reveal inside it, the front's own stone outside it
    const p = holes[i], c = sOf(w.x), GD = WT + w.out - GLASS_IN, hgt = w.ys - w.y0, IN = 0.008;
    // (out by the glass the reveal lies in the exterior's own recess: drawn 8 mm inside its outline, so no plane is shared)
    const pi = w.arched ? archPts(c, w.w - 2 * IN, w.y0 + IN, w.ys, 12) : rectPts(c - w.w / 2 + IN, w.y0 + IN, c + w.w / 2 - IN, w.ys - IN);
    B.reveal('stoneR', pi, -GD, -(WT + w.out - PUNCH_IN));      // (from the punched plane in: in front of it the front's own reveal is drawn by the exterior, and a second one in the same planes flickered — 2026-11-22 cross audit)
    if (w.arched) {
      B.reveal('white', p, 0, -GD + 0.12); B.reveal('white', pi, -GD + 0.12, -GD); B.face('glass', p, [], -GD + 0.01); B.face('glassOut', p, [], -GD + 0.075, true);
      const r = w.w / 2, top = (dx) => w.ys + Math.sqrt(Math.max(0, r * r - dx * dx)), zb = -GD + 0.04;
      // four lights wide, eight high to the springing (the meeting rail half way), the bars carried up into an intersecting head
      for (const dx of [-r / 2, 0, r / 2]) B.box('white', c + dx, (w.y0 + top(dx)) / 2, zb, 0.035, top(dx) - w.y0, 0.03);
      for (let k = 1; k <= 8; k++) B.box('white', c, w.y0 + (k * hgt) / 8, zb, w.w, k === 4 ? 0.07 : 0.035, k === 4 ? 0.05 : 0.03);
      for (const sx of [-1, 1]) B.box('white', c + sx * (r - 0.04), (w.y0 + w.ys) / 2, zb, 0.08, hgt, 0.05);
      B.box('white', c, w.y0 + 0.04, zb, w.w, 0.08, 0.05);
      const arc = (cx, rr, a0, a1, t) => { for (let k = 0; k < 6; k++) { const p0 = a0 + ((a1 - a0) * k) / 6, p1 = a0 + ((a1 - a0) * (k + 1)) / 6; B.beam('white', [cx + Math.cos(p0) * rr, w.ys + Math.sin(p0) * rr, zb], [cx + Math.cos(p1) * rr, w.ys + Math.sin(p1) * rr, zb], 0.03, t); } };
      arc(c, r - 0.04, 0, Math.PI, 0.08);                                                    // the head of the frame
      arc(c - r / 2, r, 0, Math.PI / 3, 0.035); arc(c + r / 2, r, Math.PI * 2 / 3, Math.PI, 0.035);   // the two arcs that cross at the crown's foot
      B.box('white', c, w.y0 - 0.03, 0.03, w.w + 0.12, 0.06, 0.16);
      B.sign('arms', c - 0.26, w.y0 + hgt * 0.27, c + 0.26, w.y0 + hgt * 0.27 + 0.62, -GD + 0.02, [0, 0, 1, 1]);
    } else {
      B.reveal('white', p, 0, -GD + 0.12);
      sash(B, c - w.w / 2 + IN, c + w.w / 2 - IN, w.y0 + IN, w.ys - IN, GD, { cols: 3, rows: 6, glassKey: 'glass', outKey: 'glassOut', revealKey: 'white', barKey: 'white', sillKey: 'white' });
      B.sign('arms', c - 0.19, w.y0 + hgt / 6 + 0.05, c + 0.19, w.y0 + hgt / 3 - 0.05, -GD + 0.02, [0, 0, 1, 1]);
    }
  });
  B.box('white', LL / 2, LF + 0.1, 0.03, LL, 0.2, 0.06);
  B.pop();
  seg(X0, ZW, X1, ZW);
  // ---------------- bookcases: white, brass wire grilles; two tiers
  const tier = (L, y0, y1) => {
    const m = Math.max(1, Math.round(L / 1.2)), w = L / m, hs = [];
    for (let k = 0; k < m; k++) {
      const r = rectPts(k * w + 0.08, y0 + 0.15, (k + 1) * w - 0.08, y1 - 0.15); hs.push(r);
      B.face('books2', r, [], -0.25); B.face('grille', r, [], -0.02); B.reveal('white', r, 0, -0.25);
    }
    B.face('white', rectPts(0, y0, L, y1), hs);
  };
  const zf = ZE + CASE, ge = ZE + GAL, xs = PRESS.x1, xe = X1 - CASE;
  // the east wall under the gallery: the lower tier parts either side of the door from the stair
  { const a = INNER.x0 - 0.1 - xs, b = INNER.x1 + 0.1 - xs, L = xe - xs;
    B.push(frame(xs, 0, zf, 1, 0));
    tier(a, LF, GY - 0.25);
    B.push(new THREE.Matrix4().makeTranslation(b, 0, 0)); tier(L - b, LF, GY - 0.25); B.pop();
    // the doorcase: white architrave, the wall over the door, the reveal back through the cases and the wall
    B.face('white', [[a, LF], [a + 0.1, LF], [a + 0.1, LF + INNER.h], [b - 0.1, LF + INNER.h], [b - 0.1, LF], [b, LF], [b, GY - 0.25], [a, GY - 0.25]]);
    B.reveal('white', rectPts(a + 0.1, LF, b - 0.1, LF + INNER.h), 0, -(CASE + 0.02), true);
    B.pop(); }
  // the east wall on the gallery: cases the whole length
  { const L = xe - X0; B.push(frame(X0, 0, zf, 1, 0)); tier(L, GY, TOP - 0.35); B.face('white', rectPts(0, TOP - 0.35, L, TOP)); B.pop(); }
  // the south end wall: both tiers, a Greek-key band between them
  { const L = ZW - zf; B.push(frame(xe, 0, zf, 0, 1)); tier(L, LF, GY - 0.25); tier(L, GY, TOP - 0.35); B.face('white', rectPts(0, TOP - 0.35, L, TOP)); B.face('key', rectPts(0, GY - 0.25, L, GY)); B.pop(); }
  for (const [a, b, c, d] of [[xs, zf, INNER.x0, zf], [INNER.x1, zf, xe, zf], [xe, zf, xe, ZW]]) seg(a, b, c, d);
  // gallery along the whole east wall: floor slab, Greek-key fascia, black iron balustrade with gilt rail
  B.boxXZ('white', X0, xe, GY - 0.25, GY, ZE, ge, { bottom: true });
  B.push(frame(X0, 0, ge + 0.01, 1, 0)); B.face('key', rectPts(0, GY - 0.24, xe - X0, GY - 0.02)); B.pop();
  B.boxXZ('black', X0, xe, GY + 0.95, GY + 1.0, ge - 0.07, ge - 0.01); B.boxXZ('gilt', X0, xe, GY + 1.0, GY + 1.04, ge - 0.08, ge);
  for (let x = X0 + 0.1, k = 0; x < xe; x += 0.22, k++) { B.box('black', x, GY + 0.48, ge - 0.04, 0.02, 0.95, 0.02, 0, { top: false }); if (k % 2) B.box('gilt', x, GY + 0.5, ge - 0.04, 0.08, 0.08, 0.025); }
  // gilded Corinthian columns carrying the gallery
  for (const [x, z] of COLUMNS) { B.cyl('gilt', x, LF, z, 0.13, GY - 0.45 - LF, 14, false, 0.15); B.box('gilt', x, GY - 0.35, z, 0.38, 0.2, 0.38); B.cyl('white', x, LF, z, 0.2, 0.15, 10, true); col.addCircle(x, z, 0.2); }
  // ---------------- north end: a plain wall, a press in the corner by the cases
  { wall('green', X0, ZW, X0, ZE, rectPts(0, LF, ZW - ZE, TOP));
    seg(X0, ZE, X0, ZW);
    wall('white', X0, ZE, PRESS.x1, ZE, rectPts(0, LF, PRESS.x1 - X0, GY));                      // the east wall behind the press
    const P = PRESS, pm = (P.z0 + P.z1) / 2;
    B.boxXZ('white', P.x0, P.x1, LF, LF + P.h, P.z0, P.z1);
    B.boxXZ('white', P.x0, P.x1 + 0.04, LF + P.h, LF + P.h + 0.08, P.z0, P.z1 + 0.04);
    for (const z of [P.z0 + (pm - P.z0) / 2, pm + (P.z1 - pm) / 2]) for (const [ya, yb] of [[0.2, 1.1], [1.25, P.h - 0.15]]) B.box('white', P.x1 + 0.012, LF + (ya + yb) / 2, z, 0.02, yb - ya, (P.z1 - P.z0) / 2 - 0.16);
    for (const z of [pm - 0.06, pm + 0.06]) B.box('brass', P.x1 + 0.03, LF + 1.2, z, 0.03, 0.03, 0.03);
    seg(P.x1, P.z0, P.x1, P.z1); seg(P.x0, P.z1, P.x1, P.z1); }
  seg(X1, ZE, X1, ZW);
  // ---------------- reading desks under the windows, red conical lamps, red chairs (seats face the window)
  const desks = [], dz1 = ZW - DESK.off, dz0 = dz1 - DESK.d, hw = DESK.w / 2;
  for (const d of DESKS) {
    const x = d.cx;
    B.boxXZ('lightOak', x - hw, x + hw, LF + 0.72, LF + 0.76, dz0, dz1);
    for (const sx of [-1, 1]) B.boxXZ('lightOak', x + sx * (hw - 0.05) - 0.03, x + sx * (hw - 0.05) + 0.03, LF, LF + 0.72, dz0 + 0.05, dz1 - 0.05);
    B.cyl('brass', x + 0.45, LF + 0.76, dz1 - 0.2, 0.02, 0.3, 6, false); B.cyl('redLamp', x + 0.45, LF + 1.02, dz1 - 0.2, 0.04, 0.16, 12, false, 0.17);
    B.push(new THREE.Matrix4().makeTranslation(0, LF, 0)); chairAt(B, d.x, d.z, 0, 'redChair', 'lightOak', 0.95); B.pop();
    col.addBox(x, (dz0 + dz1) / 2, DESK.w, DESK.d, 0); col.addCircle(d.x, d.z, 0.22);      // (the desk; and its chair)
    desks.push({ x: d.x, z: d.z, h: d.h, ax: d.ax, az: d.az });
  }
  // a globe by the gallery's columns
  const GLOBE = [COLUMNS[3][0] + 1.5, ge + 0.55];
  B.cyl('lightOak', GLOBE[0], LF, GLOBE[1], 0.03, 0.8, 6, false); B.cyl('gilt', GLOBE[0], LF + 0.8, GLOBE[1], 0.3, 0.02, 16, false);
  { const g = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc8a868, roughness: 0.5 })); g.position.set(GLOBE[0], LF + 1.1, GLOBE[1]); sc.add(g); col.addCircle(GLOBE[0], GLOBE[1], 0.35); }
  // crystal chandeliers, one from each ceiling rose
  const chz = zMid;
  for (const x of roses) { B.cyl('brass', x, TOP - 1.6, chz, 0.012, 1.6, 4, false); B.cyl('crystal', x, TOP - 2.5, chz, 0.12, 0.9, 10, true, 0.4); B.cyl('crystal', x, TOP - 2.75, chz, 0.35, 0.25, 12, true, 0.12); }

  // ================================================================ THE STAIR (plan: SP; angles in degrees, 0 = north, up CLOCKWISE)
  const seamsT = [];      // (the top collider's wall segments are added once the attic's are known)
  { const { xc, zc, R, RW, y0, n, a0, aL0, aL1, a1, a2, kLand, rise, ceil, TH, rb, rail: HR, aOpen } = SP, D2R = Math.PI / 180, AN = ATTIC.north, AS = ATTIC.south;
    const P3 = (a, r, y) => { const [x, z] = spAt(a, r); return [x, y, z]; };
    const inward = (a) => [Math.cos(a * D2R), 0, Math.sin(a * D2R)], tang = (a) => [Math.sin(a * D2R), 0, -Math.cos(a * D2R)], neg = (v) => v.map((q) => -q);
    const norm = (a) => ((a % 360) + 360) % 360;
    // ---- the openings in the drum wall, by angle: the foot doorway and, straight over it, the attic's north doorway
    // (north, on the skew: the door stands west of the drum's axis); the window (east); the way into the Library off
    // its landing (west); the passage to the Hall wing's attic (south-west)
    const zA = DOOR.at[1] - DOOR.w / 2, zB = DOOR.at[1] + DOOR.w / 2;
    const fd = [360 + Math.asin((zc - zB) / R) / D2R, 360 + Math.asin((zc - zA) / R) / D2R];      // (unwrapped: its east jamb may stand east of north, past 360)
    const wn = [Math.acos((xc - (SWIN.x - SWIN.w / 2)) / R) / D2R, Math.acos((xc - (SWIN.x + SWIN.w / 2)) / R) / D2R];
    const hd = [360 - Math.acos((xc - LINK.x1) / R) / D2R, 360 - Math.acos((xc - LINK.x0) / R) / D2R];
    const sd = [180 + Math.asin((AS.z0 - zc) / R) / D2R, 180 + Math.asin((AS.z1 - zc) / R) / D2R];
    const inSpan = (a, s) => (a > s[0] - 1e-6 && a < s[1] + 1e-6) || (a + 360 > s[0] - 1e-6 && a + 360 < s[1] + 1e-6);
    const fdCuts = cuts0 => cuts0.map((a) => (a < 180 ? a + 360 : a)).filter((a) => a > fd[0] - 1e-6 && a < fd[1] + 1e-6).sort((p, q) => q - p);      // the wall's corners across the north doorways, east to west
    const WSEG = 6, wAng = Array.from({ length: WSEG + 1 }, (_, i) => Math.acos((xc - (SWIN.x - SWIN.w / 2 + (SWIN.w * i) / WSEG)) / R) / D2R);
    const special = [...fd.map(norm), ...hd, ...sd, ...wAng];
    const cuts = [...special];
    for (let a = 0; a < 360 - 1e-6; a += 7.5) if (!special.some((q) => Math.abs(q - a) < 2.6 || Math.abs(q - a - 360) < 2.6 || Math.abs(q - a + 360) < 2.6) && !inSpan(a, wn)) cuts.push(a);
    cuts.sort((p, q) => p - q);
    const flats = cuts.map((a, i) => [a, i + 1 < cuts.length ? cuts[i + 1] : cuts[0] + 360]);
    const kind = ([a, b]) => { const m = norm((a + b) / 2); return inSpan(m, fd) ? 'foot' : inSpan(m, hd) ? 'head' : inSpan(m, sd) ? 'south' : inSpan(m, wn) ? 'win' : 'wall'; };
    const wTop = (a) => { const dx = xc - R * Math.cos(a * D2R) - SWIN.x, r = SWIN.w / 2; return SWIN.ys + Math.sqrt(Math.max(0, r * r - dx * dx)); };
    const strip = (a, b, ya, yb) => { if (yb - ya > 1e-4) B.poly('drum', [P3(a, R, ya), P3(b, R, ya), P3(b, R, yb), P3(a, R, yb)], inward((a + b) / 2), [[R * a * D2R, ya], [R * b * D2R, ya], [R * b * D2R, yb], [R * a * D2R, yb]]); };
    const HOLES = { foot: [[y0, y0 + DOOR.h], [AF, AF + AN.h]], head: [[LF, LF + LINK.h]], south: [[AF, AF + AS.h]], wall: [] };
    for (const f of flats) {
      const [a, b] = f, k = kind(f);
      if (k === 'win') {
        // (where the flight crosses the window's lower part the inside sill rakes with it: the wall stands to the tread's top)
        const sill = Math.max(SWIN.y0, treadY(treadOf(b - 0.01)));
        strip(a, b, y0, sill);
        const ta = Math.max(sill, wTop(a)), tb = Math.max(sill, wTop(b));
        B.poly('drum', [P3(a, R, ta), P3(b, R, tb), P3(b, R, ceil), P3(a, R, ceil)], inward((a + b) / 2), [[R * a * D2R, ta], [R * b * D2R, tb], [R * b * D2R, ceil], [R * a * D2R, ceil]]);
      } else { let y = y0; for (const [ha, hb] of HOLES[k]) { strip(a, b, y, ha); y = hb; } strip(a, b, y, ceil); }
    }
    // ---- the floor (flags: one polygon, its edge the wall's own flats, out through the foot doorway to the gate
    // hall's face) and the saucer ceiling with its plaster rose and the lamp in it
    { const fl = [];
      for (const a of cuts) {
        const u = a < 180 ? a + 360 : a;
        if (u > fd[0] + 1e-6 && u < fd[1] - 1e-6) continue;
        fl.push(spAt(a, R));
        if (Math.abs(u - fd[0]) < 1e-6) fl.push([PASS_X + 0.058, zB], [PASS_X + 0.058, zA]);      // (from just inside the punched plane: outward of it the threshold is the exterior's)
      }
      B.flat('flagsL', fl, y0); }
    { const lv = [[R, 0], [R * 0.72, 0.3], [R * 0.4, 0.46], [0.5, 0.52]];
      for (let i = 0; i < 24; i++) { const a = i * 15, b = a + 15; for (let j = 0; j < lv.length - 1; j++) B.poly('drumCeil', [P3(a, lv[j][0], ceil + lv[j][1]), P3(b, lv[j][0], ceil + lv[j][1]), P3(b, lv[j + 1][0], ceil + lv[j + 1][1]), P3(a, lv[j + 1][0], ceil + lv[j + 1][1])], [0, -1, 0]); }
      for (let i = 0; i < 24; i++) { const a = i * 15, b = a + 15;      // a moulding round the ceiling's rim
        B.poly('treadEnd', [P3(a, R - 0.07, ceil - 0.12), P3(b, R - 0.07, ceil - 0.12), P3(b, R - 0.07, ceil + 0.02), P3(a, R - 0.07, ceil + 0.02)], inward(a + 7.5));
        B.poly('treadEnd', [P3(a, R, ceil - 0.12), P3(b, R, ceil - 0.12), P3(b, R - 0.07, ceil - 0.12), P3(a, R - 0.07, ceil - 0.12)], [0, -1, 0]); }
      const rr = 0.52, yr = ceil + 0.515;
      B.poly('rose', [[xc - rr, yr, zc - rr], [xc + rr, yr, zc - rr], [xc + rr, yr, zc + rr], [xc - rr, yr, zc + rr]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      B.box('lampGlow', xc, yr - 0.09, zc, 0.11, 0.16, 0.11, 0, { bottom: true }); }
    // ---- the two doorways through the north wall (the foot's, and the attic's over it): jambs as far as the drum's
    // wall on each side, heads; the attic's has its own floor out to the link room's wall face
    { const xa = drumX(zA), xb = drumX(zB);
      // (the foot's: from the punched plane in, 8 mm inside the exterior's own doorway where they overlap; the attic's: from the link's wall face)
      for (const [yb, h, xs, i8] of [[y0, DOOR.h, PASS_X + 0.058, 0.008], [AF, AN.h, PASS_X, 0]]) {
        B.poly('drum', [[xs, yb, zA + i8], [xa, yb, zA + i8], [xa, yb + h - i8, zA + i8], [xs, yb + h - i8, zA + i8]], [0, 0, 1]); B.poly('drum', [[xs, yb, zB - i8], [xb, yb, zB - i8], [xb, yb + h - i8, zB - i8], [xs, yb + h - i8, zB - i8]], [0, 0, -1]);
        B.poly('drum', [[xs, yb + h - i8, zA], [xa, yb + h - i8, zA], [xb, yb + h - i8, zB], [xs, yb + h - i8, zB]], [0, -1, 0]); }
      B.flat('flagsL', [[PASS_X, zB], [PASS_X, zA], ...fdCuts(cuts).map((a) => spAt(a, R))], AF); }
    // ---- the window: its reveal through the drum's wall out to the pane (plastered white, as the photograph), the
    // pane and its pale green frame — three lights wide under a fan — and the iron bars inside it
    { const zp = SWIN.zPane, xOf = (a) => xc - R * Math.cos(a * D2R), zOf = (a) => zc - R * Math.sin(a * D2R);
      for (let i = 0; i < WSEG; i++) { const a = wAng[i], b = wAng[i + 1];
        B.poly('white', [[xOf(a), wTop(a), zOf(a)], [xOf(b), wTop(b), zOf(b)], [xOf(b), wTop(b), zp], [xOf(a), wTop(a), zp]], [0, -1, 0]);
        B.poly('treadEnd', [[xOf(a), SWIN.y0, zOf(a)], [xOf(b), SWIN.y0, zOf(b)], [xOf(b), SWIN.y0, zp], [xOf(a), SWIN.y0, zp]], [0, 1, 0]); }
      for (const [a, sg] of [[wAng[0], 1], [wAng[WSEG], -1]]) B.poly('white', [[xOf(a), SWIN.y0, zOf(a)], [xOf(a), SWIN.y0, zp], [xOf(a), SWIN.ys, zp], [xOf(a), SWIN.ys, zOf(a)]], [sg, 0, 0]);
      B.push(frame(SWIN.x, 0, zp, 1, 0));      // s = x - the window's centre line, facing +z (into the drum)
      const p = archPts(0, SWIN.w, SWIN.y0, SWIN.ys, 12), r = SWIN.w / 2, hgt = SWIN.ys - SWIN.y0, top = (dx) => SWIN.ys + Math.sqrt(Math.max(0, r * r - dx * dx));
      B.face('glass', p, [], 0); B.face('glassOut', p, [], 0.05, true);
      for (const dx of [-r / 3, r / 3]) B.box('winFrame', dx, (SWIN.y0 + SWIN.ys) / 2, 0.02, 0.04, hgt, 0.03);
      for (let k = 1; k <= 4; k++) B.box('winFrame', 0, SWIN.y0 + (k * hgt) / 4, 0.02, SWIN.w, k === 4 ? 0.06 : 0.04, 0.03);
      for (const sx of [-1, 1]) B.box('winFrame', sx * (r - 0.03), (SWIN.y0 + SWIN.ys) / 2, 0.02, 0.06, hgt, 0.04);
      B.box('winFrame', 0, SWIN.y0 + 0.03, 0.02, SWIN.w, 0.06, 0.04);
      for (let k = 0; k < 8; k++) { const p0 = (k / 8) * Math.PI, p1 = ((k + 1) / 8) * Math.PI, rr = r - 0.03; B.beam('winFrame', [Math.cos(p0) * rr, SWIN.ys + Math.sin(p0) * rr, 0.02], [Math.cos(p1) * rr, SWIN.ys + Math.sin(p1) * rr, 0.02], 0.04, 0.06); }
      for (const an of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) B.beam('winFrame', [0, SWIN.ys, 0.02], [Math.cos(an) * (r - 0.03), SWIN.ys + Math.sin(an) * (r - 0.03), 0.02], 0.03, 0.035);
      for (const f of [0.22, 0.5, 0.78]) B.box('iron', 0, SWIN.y0 + hgt * f + (f > 0.7 ? 0.25 : 0), 0.055, SWIN.w - 0.04, 0.022, 0.022);
      for (const dx of [-r * 0.6, -r * 0.2, r * 0.2, r * 0.6]) B.box('iron', dx, (SWIN.y0 + top(dx) - 0.05) / 2 + 0.01, 0.055, 0.022, top(dx) - 0.07 - SWIN.y0, 0.022);
      B.pop(); }
    // ---- the cantilevered treads: each a stone built into the drum wall — its top, its moulded nosing, its riser, its
    // end to the well, its own flat soffit (stepped, as the photographs show them from below)
    for (let k = 1; k < n; k++) {
      if (k === kLand) continue;
      const aa = treadA(k), ab = aa + treadW(k), y = treadY(k), RO = R + 0.02, nR = 0.03 / RO / D2R, nW = 0.03 / RW / D2R;      // (RO: 2 cm into the wall)
      B.poly('flagsL', [P3(aa, RW, y), P3(ab, RW, y), P3(ab, RO, y), P3(aa, RO, y)], [0, 1, 0]);
      B.poly('tread', [P3(aa, RW, y - TH), P3(aa, RO, y - TH), P3(aa, RO, y - 0.035), P3(aa, RW, y - 0.035)], neg(tang(aa)));               // riser, under the nosing
      B.poly('treadEnd', [P3(aa - nW, RW, y), P3(aa, RW, y), P3(aa, RO, y), P3(aa - nR, RO, y)], [0, 1, 0]);                                // the nosing: top, face, underside
      B.poly('treadEnd', [P3(aa - nW, RW, y - 0.035), P3(aa - nR, RO, y - 0.035), P3(aa - nR, RO, y), P3(aa - nW, RW, y)], neg(tang(aa)));
      B.poly('treadEnd', [P3(aa - nW, RW, y - 0.035), P3(aa, RW, y - 0.035), P3(aa, RO, y - 0.035), P3(aa - nR, RO, y - 0.035)], [0, -1, 0]);
      B.poly('treadEnd', [P3(aa - nW, RW, y - TH), P3(aa - nW, RW, y), P3(ab, RW, y), P3(ab, RW, y - TH)], inward((aa + ab) / 2));            // the end to the well
      B.poly('tread', [P3(ab, RW, y - TH), P3(ab, RO, y - TH), P3(ab, RO, y + rise - TH), P3(ab, RW, y + rise - TH)], tang(ab));              // its back edge below the next tread (the step in the soffit)
      B.poly('tread', [P3(aa, RW, y - TH), P3(ab, RW, y - TH), P3(ab, RO, y - TH), P3(aa, RO, y - TH)], [0, -1, 0]);                          // soffit
    }
    // ---- the two landings: slabs at their levels (the top one's soffit plastered white, as the photograph)
    const slabCuts = (aS, aE) => { const A = [aS, aE]; for (const k of [0, 360, 720]) for (const c of cuts) if (c + k > aS + 0.5 && c + k < aE - 0.5) A.push(c + k); return A.sort((p, q) => p - q); };
    const slab = (aS, aE, y, under, th = 0.16) => {
      const A = slabCuts(aS, aE);      // (its outer edge is the wall's own flats)
      for (let i = 0; i + 1 < A.length; i++) { const a = A[i], b = A[i + 1];
        B.poly('flagsL', [P3(a, RW, y), P3(b, RW, y), P3(b, R, y), P3(a, R, y)], [0, 1, 0]);
        B.poly('treadEnd', [P3(a, RW, y - th), P3(a, RW, y), P3(b, RW, y), P3(b, RW, y - th)], inward((a + b) / 2));
        B.poly(under, [P3(a, RW, y - th), P3(b, RW, y - th), P3(b, R, y - th), P3(a, R, y - th)], [0, -1, 0]); }
      B.poly('tread', [P3(aS, RW, y - th), P3(aS, R, y - th), P3(aS, R, y), P3(aS, RW, y)], neg(tang(aS)));
      B.poly(under, [P3(aE, RW, y - th), P3(aE, R, y - th), P3(aE, R, y), P3(aE, RW, y)], tang(aE));
    };
    slab(aL0, aL1, LF, 'tread'); slab(a1, a2, AF, 'white');
    // ---- the wrought-iron balustrade round the well: a baluster on every tread, a dark handrail over them, level over
    // the landings; a scroll on the newel at the first step; a return to the wall at the top landing's far end
    const HC = HR + 0.03;
    const card = (a, b, r0, r1, y, u0, u1) => B.poly('ironwork', [P3(a, r0, y), P3(b, r1, y), P3(b, r1, y + HC), P3(a, r0, y + HC)], inward((a + b) / 2), [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]);
    const railTo = (p, q) => B.beam('darkOak', p, q, 0.055, 0.045);
    for (let k = 1; k < n; k++) { if (k === kLand) continue; const aa = treadA(k), ab = aa + treadW(k), y = treadY(k); card(aa, ab, rb, rb, y, (k % 2) * 0.5, (k % 2) * 0.5 + 0.5); railTo(P3(aa, rb, y + HR - rise / 2), P3(ab, rb, y + HR + rise / 2)); }
    const level = (aS, aE, y) => { const m = Math.round((aE - aS) / 8.5), st = (aE - aS) / m; for (let i = 0; i < m; i++) { const a = aS + i * st; card(a, a + st, rb, rb, y, (i % 2) * 0.5, (i % 2) * 0.5 + 0.5); railTo(P3(a, rb, y + HR), P3(a + st, rb, y + HR)); } };
    level(aL0, aL1, LF); level(a1, a2, AF);
    card(a2, a2, rb, R - 0.05, AF, 0, 3); railTo(P3(a2, rb, AF + HR), P3(a2, R - 0.03, AF + HR));
    { const p = P3(a0 - 1.5, rb, y0), top = y0 + rise + HR - rise / 2;
      B.box('iron', p[0], (y0 + top) / 2, p[2], 0.035, top - y0, 0.035); B.cyl('darkOak', p[0], top - 0.01, p[2], 0.085, 0.05, 12, true); B.cyl('darkOak', p[0], top + 0.04, p[2], 0.035, 0.02, 8, true);
      for (const c of [colG, col]) c.addCircle(p[0], p[2], 0.07); }
    // ---- a stone tablet on the wall beyond the window (the photographs; what it says is not legible in them)
    { const a = 166, y = treadY(treadOf(a)) + 1.75, p = P3(a, R - 0.03, y); B.box('marble', p[0], y, p[2], 0.62, 0.86, 0.05, Math.PI / 2 - a * D2R); }
    // ---- the passage from the Library's landing through the back wall to the Library's east side (on the skew)
    { const { x0, x1, z1, h } = LINK, zW = (x) => zc + Math.sqrt(R * R - (x - xc) * (x - xc)), za = zW(x0), zb = zW(x1);
      B.flat('flagsL', [[x0, z1 + 0.02], [x1, z1 + 0.02], ...cuts.filter((a) => a > hd[0] - 1e-6 && a < hd[1] + 1e-6).map((a) => spAt(a, R))], LF);      // (from the landing's own edge)
      B.poly('cream', [[x0, LF + h, za], [x1, LF + h, zb], [x1, LF + h, z1], [x0, LF + h, z1]], [0, -1, 0]);
      wall('drum', x0, z1, x0, za, rectPts(0, LF, z1 - za, LF + h)); wall('drum', x1, zb, x1, z1, rectPts(0, LF, z1 - zb, LF + h));
      col.addSegment(x0, za, x0, z1 + CASE); col.addSegment(x1, zb, x1, z1 + CASE); }
    // ---- the passage from the top landing's first metre southwards to the Hall wing's attic
    { const { z0, z1, x1, h } = AS, xa = drumXS(z0), xb = drumXS(z1);
      B.flat('boards', [[x1, z0], [x1, z1], ...cuts.filter((a) => a > sd[0] - 1e-6 && a < sd[1] + 1e-6).reverse().map((a) => spAt(a, R))], AF);
      B.poly('cream', [[xa, AF + h, z0], [xb, AF + h, z1], [x1, AF + h, z1], [x1, AF + h, z0]], [0, -1, 0]);
      B.poly('atticW', [[xa, AF, z0], [x1, AF, z0], [x1, AF + h, z0], [xa, AF + h, z0]], [0, 0, 1]); B.poly('atticW', [[xb, AF, z1], [x1, AF, z1], [x1, AF + h, z1], [xb, AF + h, z1]], [0, 0, -1]);
      seamsT.push([xa, z0, x1, z0], [xb, z1, x1, z1]); }
    // ---- colliders: the drum wall (a gap at the foot doorway on the floor; at the Library's doorway for the two
    // flights and its landing; at the attic's two doorways for the top landing), the balustrade round the well; on
    // the floor, the well is open and the stair is entered at its first riser: the balustrade stands from there round
    // to where a body can stand upright under the treads (aOpen), where the low space is shut off
    for (const [c, gaps] of [[colG, ['foot']], [col, ['head']], [colT, ['foot', 'south']]]) {
      for (const f of flats) if (!gaps.includes(kind(f))) c.addSegment(...spAt(f[0], R), ...spAt(f[1], R));
      if (c === colG && colG !== col) { for (let a = a0; a < aOpen - 1e-6; a += 14.5) c.addSegment(...spAt(a, rb), ...spAt(Math.min(aOpen, a + 14.5), rb)); c.addSegment(...spAt(aOpen, rb), ...spAt(aOpen, R)); }
      else for (let a = 0; a < 360; a += 15) c.addSegment(...spAt(a, rb), ...spAt(a + 15, rb));
      if (c === colG || c === colT) { c.addSegment(PASS_X, zA, drumX(zA) + 0.03, zA); c.addSegment(PASS_X, zB, drumX(zB) + 0.03, zB); }
      if (c === colG) c.addSegment(PASS_X, zA, PASS_X, zB);      // (across the foot doorway: the portal's passage opens it)
    }
    colT.addSegment(...spAt(a2, rb), ...spAt(a2, R));               // the top landing's far end
    if (!walkIn) B.boxXZ('oak', DOOR.leafX - 0.03, DOOR.leafX + 0.03, y0, y0 + DOOR.h, zA, zB);   // (old path: a shut leaf; you leave with E)
  }

  // ================================================================ THE ATTIC LIBRARY (plan: ATTIC, AWIN, ADESKS, STACKS — a GUESS)
  const adesks = [];
  { const A = ATTIC, Y0 = AF, Y1 = ATOP, zN0 = A.north.z - A.north.w / 2, zN1 = A.north.z + A.north.w / 2;
    // a wall of a room, seen from inside: from (xa, za) to (xb, zb) with the room on the side of n = (-dz, dx);
    // holes [s0, s1, ya, yb] in metres along it; `win`: the windows in it (their reveals, panes and frames)
    const side = (xa, za, xb, zb, holes = [], wins = []) => {
      const L = Math.hypot(xb - xa, zb - za), ux = (xb - xa) / L, uz = (zb - za) / L, sOf = (x, z) => (x - xa) * ux + (z - za) * uz;
      const hs = holes.map(([s0, s1, ya, yb]) => [Math.min(s0, s1), Math.max(s0, s1), ya, yb]), ws = wins.map((w) => ({ w, s: sOf(w.at[0], w.at[1]) }));
      // doorways reach the floor: notch them out of the outline; windows are holes
      let outline = [[0, Y0]]; for (const [s0, s1, , yb] of hs.sort((p, q) => p[0] - q[0])) outline.push([s0, Y0], [s0, yb], [s1, yb], [s1, Y0]); outline.push([L, Y0], [L, Y1], [0, Y1]);
      B.push(frame(xa, 0, za, xb - xa, zb - za));
      B.face('atticW', outline, ws.map(({ w, s }) => rectPts(s - w.w / 2, w.y0, s + w.w / 2, w.y1)));
      for (const { w, s } of ws) sash(B, s - w.w / 2, s + w.w / 2, w.y0, w.y1, w.pane, { cols: 3, rows: 2, glassKey: 'glass', outKey: 'glassOut', revealKey: 'white', barKey: 'white', sillKey: 'white' });
      B.box('white', L / 2, Y0 + 0.06, 0.012, L, 0.12, 0.024);
      B.pop();
      let s = 0; for (const [s0, s1] of hs) { if (s0 > s) seamsT.push([xa + ux * s, za + uz * s, xa + ux * s0, za + uz * s0]); s = s1; } if (L > s) seamsT.push([xa + ux * s, za + uz * s, xb, zb]);
    };
    const W = (room) => AWIN.filter((w) => w.room === room);
    for (const key of ['link', 'chapel', 'hall']) { const r = A[key]; B.flat('boards', [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]], Y0); B.flat('cream', [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]], Y1, [], true); }
    { const r = A.link;      // the link over the Lodge and the gate hall
      side(r.x1, r.z0, r.x1, r.z1, [[zN0 - r.z0, zN1 - r.z0, Y0, Y0 + A.north.h]]);                       // south wall (the door from the stair)
      side(r.x0, r.z0, r.x1, r.z0, [], W('link'));                                                         // east wall: two of the street centre's top windows
      side(r.x1, r.z1, r.x0, r.z1);                                                                        // west wall (the Library's upper air behind it)
      side(r.x0, r.z1, r.x0, r.z0, [[r.z1 - A.arch.z1, r.z1 - A.arch.z0, Y0, Y0 + A.arch.h]]); }           // north wall: the opening to the Chapel wing
    { const r = A.chapel;
      side(r.x1, r.z0, r.x1, r.z1, [[A.arch.z0 - r.z0, A.arch.z1 - r.z0, Y0, Y0 + A.arch.h]], W('chapel').filter((w) => w.out !== Math.PI));      // south wall: the forecourt windows, the opening
      side(r.x0, r.z0, r.x1, r.z0, [], W('chapel').filter((w) => w.out === Math.PI)); side(r.x1, r.z1, r.x0, r.z1); side(r.x0, r.z1, r.x0, r.z0); }
    { const r = A.hall;
      side(r.x0, r.z1, r.x0, r.z0, [[r.z1 - A.south.z1, r.z1 - A.south.z0, Y0, Y0 + A.south.h]], W('hall').filter((w) => w.out !== Math.PI));     // north wall: the forecourt windows, the passage from the stair
      side(r.x0, r.z0, r.x1, r.z0, [], W('hall').filter((w) => w.out === Math.PI)); side(r.x1, r.z1, r.x0, r.z1); side(r.x1, r.z0, r.x1, r.z1); }
    // the opening through the Chapel wing's wall: floor, jambs, head
    { const x0 = A.chapel.x1, x1 = A.link.x0, { z0, z1, h } = A.arch;
      B.flat('boards', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], Y0); B.poly('white', [[x0, Y0 + h, z0], [x1, Y0 + h, z0], [x1, Y0 + h, z1], [x0, Y0 + h, z1]], [0, -1, 0]);
      B.poly('white', [[x0, Y0, z0], [x1, Y0, z0], [x1, Y0 + h, z0], [x0, Y0 + h, z0]], [0, 0, 1]); B.poly('white', [[x0, Y0, z1], [x1, Y0, z1], [x1, Y0 + h, z1], [x0, Y0 + h, z1]], [0, 0, -1]);
      seamsT.push([x0, z0, x1, z0], [x0, z1, x1, z1]); }
    // bookstacks: double-sided, white ends, spines both ways
    for (const s of STACKS) { const d = A.stack.d / 2, L = s.x1 - s.x0;
      B.boxXZ('white', s.x0, s.x1, Y0, Y0 + A.stack.h, s.z - d, s.z + d);
      B.push(frame(s.x0, 0, s.z + d, 1, 0)); B.face('books2', rectPts(0.05, Y0 + 0.1, L - 0.05, Y0 + A.stack.h - 0.06), [], 0.004); B.pop();
      B.push(frame(s.x1, 0, s.z - d, -1, 0)); B.face('books2', rectPts(0.05, Y0 + 0.1, L - 0.05, Y0 + A.stack.h - 0.06), [], 0.004); B.pop();
      colT.addBox((s.x0 + s.x1) / 2, s.z, L, A.stack.d, 0); }
    // wall shelving on the link's west wall
    { const r = A.link; B.push(frame(r.x1 - 1.6, 0, r.z1 - 0.3, -1, 0)); B.face('books2', rectPts(0, Y0 + 0.1, r.x1 - 1.6 - r.x0 - 2.4, Y0 + 2.05), [], 0.004); B.pop(); B.boxXZ('white', r.x0 + 2.4, r.x1 - 1.6, Y0, Y0 + 2.1, r.z1 - 0.3, r.z1); colT.addBox((r.x0 + 2.4 + r.x1 - 1.6) / 2, r.z1 - 0.15, r.x1 - 1.6 - r.x0 - 2.4, 0.3, 0); }
    // reading desks under the windows, a lamp on each (green glass shades: GUESS), chairs
    for (const d of ADESKS) {
      const dx = Math.sin(d.out), dz = Math.cos(d.out), cxd = d.cx - dx * 0.44, czd = d.cz - dz * 0.44, alongX = Math.abs(dz) > 0.5, w = alongX ? DESK.w : DESK.d, dd = alongX ? DESK.d : DESK.w;
      B.boxXZ('lightOak', cxd - w / 2, cxd + w / 2, Y0 + 0.72, Y0 + 0.76, czd - dd / 2, czd + dd / 2);
      for (const sg of [-1, 1]) { const ex = alongX ? sg * (w / 2 - 0.05) : 0, ez = alongX ? 0 : sg * (dd / 2 - 0.05); B.boxXZ('lightOak', cxd + ex - (alongX ? 0.03 : w / 2 - 0.05), cxd + ex + (alongX ? 0.03 : w / 2 - 0.05), Y0, Y0 + 0.72, czd + ez - (alongX ? dd / 2 - 0.05 : 0.03), czd + ez + (alongX ? dd / 2 - 0.05 : 0.03)); }
      const lx2 = cxd + (alongX ? 0.45 : dx * 0.1), lz2 = czd + (alongX ? dz * 0.1 : 0.45);
      B.cyl('brass', lx2, Y0 + 0.76, lz2, 0.02, 0.3, 6, false); B.cyl('greenLamp', lx2, Y0 + 1.02, lz2, 0.04, 0.14, 12, false, 0.16);
      B.push(new THREE.Matrix4().makeTranslation(0, Y0, 0)); chairAt(B, d.x, d.z, d.out, 'redChair', 'lightOak', 0.95); B.pop();
      colT.addBox(cxd, czd, w, dd, 0); colT.addCircle(d.x, d.z, 0.22);
      adesks.push({ x: d.x, z: d.z, h: d.h, ax: d.ax, az: d.az, y: Y0 });
    }
    for (const q of seamsT) colT.addSegment(q[0], q[1], q[2], q[3]);
  }
  // the floor is the plan's; in the drum, where the stair passes over itself, it is the level under the asker's feet
  ctx.setGround(groundY);
  if (ctx.setCollider && colT !== col) ctx.setCollider((p) => {
    const y = p.pos.y; setRef(y);
    if (y >= SP.split) return colT;
    const dx = p.pos.x - SP.xc, dz = p.pos.z - SP.zc, r2 = dx * dx + dz * dz;
    if (r2 > SP.RW * SP.RW && r2 < (SP.R + 0.2) * (SP.R + 0.2)) { const a = azOf(p.pos.x, p.pos.z); if (a > SP.a0 && a < SP.aOpen) return col; }      // on the first treads
    return y < 1.2 ? colG : col;
  });
  if (ctx.portalColliders && colG !== col) ctx.portalColliders(0, [colG]);

  buildBatch(B, sc, mats);
  mergeStatic(sc);
  // ---------------- doors (core/_doors.js): a heavy oak door at the foot (stays where it is left), baize doors on closers at the Library and at the attic's two doorways
  const doors = {};
  if (walkIn) {
    // ONE oak leaf, hung on the doorway's WEST jamb and opening in: the stair's foot is to the east of the door, so
    // the leaf swings away from whoever comes off the stair and stands clear of the way between the stair and the
    // doorway. (GUESS: no picture shows this door. A pair of half-width leaves was tried: the east one stood, open,
    // in the path from the first riser; and 0.98 m is a single door's width.)
    const lx = DOOR.leafX, zd = DOOR.at[1], lw = DOOR.w - 0.04;
    doors.foot = ctx.addDoor({ kind: 'hinged', style: 'oak', y: SP.y0, w: lw, h: DOOR.h, closer: false, heavy: true, rest: 0.45, thick: 0.06, mats: { leaf: S.oak, handle: S.iron }, portal: 0, colliders: [colG], at: [lx, zd + DOOR.w / 2 - 0.02], dir: Math.PI, swing: -1 });
    // anyone walking at the doorway asks it: from inside the drum the door is come at from the side (off the stair,
    // across the floor), not square on, so closing on it within IN_REACH asks; from the gate hall, walking at it within
    // its own width
    { const D = doors.foot, cx = lx, cz = zd, hw2 = DOOR.w / 2, IN_REACH = 2.6, update = D.update;
      D.update = (dt, people, env) => {
        for (let i = 0; i < people.length; i++) { const p = people[i]; if (p.y !== undefined && p.y !== null && Math.abs(p.y - SP.y0) > 1.4) continue;
          const off = p.x - cx, along = Math.abs(p.z - cz), dist = Math.hypot(off, p.z - cz); if (off <= 0 && along > hw2 + 0.3) continue;
          const vn = off > 0 ? -(p.vx * off + (p.vz || 0) * (p.z - cz)) / (dist || 1) : p.vx;
          if (vn > 0.35 && dist < (off > 0 ? IN_REACH : 2.3)) { if (D.want < 0.3) D.want = 0.3; break; } }
        update(dt, people, env); }; }
    const baize = { kind: 'hinged', style: 'fire', swing: 0, closer: true, kick: false, mats: { leaf: mats.baize, handle: S.brass } };
    doors.inner = ctx.addDoor({ ...baize, colliders: [col], at: [INNER.x0 + 0.02, INNER.z], y: LF, w: INNER.x1 - INNER.x0 - 0.04, h: INNER.h - 0.02, dir: Math.PI / 2 });
    doors.atticN = ctx.addDoor({ ...baize, colliders: [colT], at: [PASS_X + 0.03, zd - ATTIC.north.w / 2 + 0.02], y: AF, w: ATTIC.north.w - 0.04, h: ATTIC.north.h - 0.02, dir: 0 });
    doors.atticS = ctx.addDoor({ ...baize, colliders: [colT], at: [ATTIC.south.x1 - 0.03, ATTIC.south.z0 + 0.02], y: AF, w: ATTIC.south.z1 - ATTIC.south.z0 - 0.04, h: ATTIC.south.h - 0.02, dir: 0 });
  }
  const { amb, hemi } = ambientOf(sc);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.0); sun.position.set(LL / 2 + 4, TOP + 6, 14); sun.target.position.set(LL / 2, LF, -2); sc.add(sun, sun.target);
  const lights = [CENTER[0] - 7.5, CENTER[0] + 7.5].map((x) => addPoint(sc, x, TOP - 2.9, chz, 0xffe0b0, 2, 20));
  const deskLight = addPoint(sc, CENTER[0], LF + 1.5, ZW - 1, 0xff9a70, 1, 24);
  const stairLight = addPoint(sc, SP.xc, SP.ceil - 0.6, SP.zc, 0xffd9a0, 1.5, 16);
  // the attic: a ceiling lamp over each wing's reading aisle (GUESS: its fittings)
  const atticLights = ['chapel', 'hall'].map((k) => { const r = ATTIC[k], x = k === 'chapel' ? r.x1 - 1.6 : r.x0 + 1.6, z = (r.z0 + r.z1) / 2; return addPoint(sc, x, ATOP - 0.4, z, 0xffe6c0, 2, 22); });
  return {
    spawn: [DOOR.at[0] + 0.75, DOOR.at[1]], heading: Math.PI / 2, exit: [DOOR.at[0] + 0.45, DOOR.at[1]], desks, adesks, doors, floor: LF, attic: AF, globe: GLOBE, colliders: { main: col, top: colT, ground: colG },
    /** daylight 0..1; evening: the desk lamps are on; on: the room is open (readers in, or you are): shut for the night it is dark */
    setLight(d, evening, on = true) { if (mats.glass.userData.setDay) mats.glass.userData.setDay(d); mats.glassOut.userData.setDay(d); mats.arms.userData.setDay(d); mats.blue.emissiveIntensity = 0.1 + 0.35 * d;      /* (the pale blue ceiling glowed like a day sky through the window heads at night) */ sun.intensity = 0.1 + d * 1.1; if (amb) amb.intensity = (on ? 0.3 : 0.1) + d * 0.35; if (hemi) hemi.intensity = (on ? 0.2 : 0.06) + d * 0.35; for (const l of lights) l.intensity = on ? 1 + (1 - d) * 3 : 0.1 + d * 0.9; deskLight.intensity = !on ? 0.05 : evening ? 2.5 : 0.6; mats.redLamp.emissiveIntensity = !on ? 0.05 : evening ? 1.2 : 0.2; mats.greenLamp.emissiveIntensity = !on ? 0.05 : evening ? 1.2 : 0.2; for (const l of atticLights) l.intensity = on ? 1 + (1 - d) * 2.6 : 0.1 + d * 0.8; stairLight.intensity = on ? 1.4 + (1 - d) * 1.8 : 0.3 + d; mats.tread.emissiveIntensity = on ? 0.3 : 0.06 + 0.12 * d; },
  };
}
