// Worcester College Chapel interior (Wyatt shell, Burges decoration 1864-66, Holiday glass). See
// docs/research/worcester_interiors.md §1. Room frame: x = 0 (west, door to the loggia) .. L (east, altar),
// z = -W/2 (north) .. +W/2 (south), floor y = 0. Decoration is mostly canvas paintings on flat walls.
//
// A WALK-IN room (core/interiors.js "seamless"; plan and fit: _worcint_hall_plan.js CHAPEL_PLAN): it stands in the north
// wing of the Main Quad's east range, its west doorway the oak door in the loggia's back wall (a real pair of heavy
// leaves, no fade), its floor the top of the loggia's ramp. Every window is a real opening glazed with the painted
// glass as TRANSLUCENT coloured panes (the world's light and dark come through; at night the candle-lit room glows
// through them): three on the forecourt (south), three on the slip against the Senior Common Room range (north), the
// three lights of the Venetian window on Walton Street.
//
// 2026-11-22 TRUE SIZE: 17.9 x 9.0 m ("exactly the same dimensions" as the Hall, whose plan the college publishes; it
// was 23.0 x 10.4), 7.9 m to the cornice, 8.9 m to the flat of the ceiling, the saucer dome 0.4 m more. What is where,
// and how it is known (K = seen in a named plan / picture, G = guess):
//   K 1939 RCHM plan: the ANTECHAPEL — a screen 2.4 m in from the west wall (two columns on pedestals 2.25 m off the
//     centre line, a square pier outboard of each, a short wall from each pier to the side wall), a closed compartment
//     in the antechapel's north part; four wall piers a side, between and outside the three windows (they were six);
//     windows in BOTH side walls; three sanctuary steps beginning 3.1 m from the east wall; the east end's inner
//     corners ROUNDED; a pair of columns each side of the east window, clear of all three of its lights.
//   K photographs (the research note): stalls in three tiers facing a mosaic aisle a quarter of the room wide; carved
//     animals on the bench ends; candelabra standards; the paschal candlestick; the painted zones of the walls; the
//     saucer dome; niches with the evangelists "in the corners".
//   G: the niches are put IN the four rounded corners (a flat aedicule on each curve); the organ fills the closed
//     compartment (its place is not in any photograph); the stalls' runs, lengths and the 24 places; the heights of
//     the painted zones (1.8 m wainscot, 1.2 m frieze: fitted under the windows' true sills); the west pair of rounded
//     corners (the plan shows fillets there, less plainly); the east side lights' glass.
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts, sharedMats, windowGlass, buildBatch, fitTexture, addPoint, candle, ambientOf, speckle } from './_worcint_kit.js';
import { chapelWall, chapelCeiling, domeTex, coveTex, mosaicTex, shaftTex, glassAtlas, tex } from './_worcint_tex.js';
import { CHAPEL_PLAN as PL, wingSeamless, OUTSIDE, PUNCH } from './_worcint_hall_plan.js';

const r3 = (x) => +x.toFixed(3);
export const CHAPEL = { L: PL.L, W: PL.W, HW: PL.HW, HC: PL.HC, cove: 1.0, door: { x: 0, z: PL.door.z }, doorUV: PL.doorUV, aisle: 1.15, sanctX: r3(PL.L - PL.sanct), domeX: r3(PL.L / 2), seamless: wingSeamless(PL) };
// the side windows are where the outside has them (the same stations on both sides)
const WIN = PL.win.x, WINW = PL.win.w, WY0 = PL.win.y0, WY1 = PL.win.y1;
// giant pilasters: one between each pair of windows and one a bay beyond each end window (1939 plan: four a side)
const M1 = (WIN[0] + WIN[1]) / 2, M2 = (WIN[1] + WIN[2]) / 2, PIL = [r3(2 * WIN[0] - M1), r3(M1), r3(M2), r3(2 * WIN[2] - M2)], PW = 0.7;
const RUNS = [[3.5, 6.8], [7.25, 10.55], [11.0, 14.3]];             // the three runs of stalls a side, between the screen and the sanctuary steps
const STANDARDS = [3.2, 7.025, 10.775, 14.55];                       // candelabra standards: at the ends of the runs
// the painted zones of the walls (metres): dark wainscot, wave band, the maroon frieze of figures, a patterned band —
// ending just under the windows' sills — and the entablature under the cornice
const ZONES = { wain: 1.8, wave: 0.22, frieze: 1.2, band: 0.2, ent: 0.55 }, Z4 = ZONES.wain + ZONES.wave + ZONES.frieze + ZONES.band;
const PED = ZONES.wain, CYH = r3(PL.HW - ZONES.ent - 0.25 - PED);     // pedestals as high as the wainscot; shafts up to the capitals under the entablature

// ------------------------------------------------------------------------------------------------ translucent glass
// Painted glass in a REAL opening (also used by the Hall's east window): what is behind the pane (the live world from
// inside; the lit room from outside) is multiplied by the glass's colours, plus a little of the glass's own colour for
// the daylight it scatters: result = glass x (behind + glow). Two one-sided panes share the texture: the one facing
// into the room glows with the day outside, the one facing out hardly at all (stained glass is dark from outside by
// day and glows at night with the light of the room behind it — which the multiply gives for nothing).
export function stainedPair(map, name = 'stained') {
  // (second pass) Nearly opaque, as painted glass is: its own colours, bright with the day from inside, dark from
  // outside by day and glowing at night when the room behind is lit (`lit`); a few per cent of what is behind still
  // comes through. It was a multiply-blended pane, which wrote no alpha: core's far-off picture of the room (the
  // impostor, core/_roomview.js) then showed clear holes where the glass is.
  const mk = (side) => new THREE.MeshBasicMaterial({ name: name + side, map, color: 0xffffff, transparent: true, opacity: 0.94, depthWrite: false, toneMapped: false, side: THREE.FrontSide });
  const inn = mk('In'), out = mk('Out');
  return { in: inn, out, setDay(d, lit = 0) { inn.color.setScalar(0.07 + 1.08 * d); out.color.setScalar(Math.max(0.035 + 0.32 * d, 1.05 * lit * (1 - 0.6 * d))); } };
}
/** a pane in the pushed wall frame: convex outline [[s, y]] at depth z, the atlas cell `uv` over its bounding box; one
 *  face into the room (keyIn), one outwards (keyOut; omit for a blind window) */
export function pane(B, keyIn, keyOut, pts, z, uv) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const P3 = pts.map(([s, y]) => [s, y, z]), U = pts.map(([s, y]) => [uv[0] + ((s - x0) / (x1 - x0)) * (uv[2] - uv[0]), uv[1] + ((y - y0) / (y1 - y0)) * (uv[3] - uv[1])]);
  B.poly(keyIn, P3, [0, 0, 1], U);
  if (keyOut) B.poly(keyOut, P3, [0, 0, -1], U);
}
/** A pair of leaves in one doorway answer as one door: anyone walking at the doorway (or standing in it) asks both
 *  leaves, whichever leaf they are nearer (core/_doors.js drives each leaf from the people near its own middle).
 *  (cx, cz) the middle of the doorway, (nx, nz) the unit normal pointing to the side the leaves open towards. */
export function linkLeaves(leaves, cx, cz, nx, nz, w) {
  for (const D of leaves) {
    const update = D.update;
    D.update = (dt, people, env) => {
      for (let i = 0; i < people.length; i++) {
        const p = people[i], rx = p.x - cx, rz = p.z - cz, off = rx * nx + rz * nz, along = Math.abs(rx * nz - rz * nx);
        if (along > w / 2 + 0.3) continue;
        const dist = Math.hypot(rx, rz), vn = -(p.vx * nx + p.vz * nz) * Math.sign(off || 1);
        const inWay = Math.abs(off) < 0.85 && along < w / 2 + 0.1 && (Math.abs(leaves[0].th) > 0.5 || Math.abs(leaves[1].th) > 0.5);
        if ((vn > 0.35 && dist < (off > 0 ? 2.45 : 1.45)) || inWay) { if (D.want < 0.3) D.want = 0.3; break; }
      }
      update(dt, people, env);
    };
  }
  return leaves;
}
/** an opening's outline drawn in by e all round (about its own middle) */
export function insetPts(pts, e = 0.008) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, kx = 1 - 2 * e / (x1 - x0), ky = 1 - 2 * e / (y1 - y0);
  return pts.map(([x, y]) => [cx + (x - cx) * kx, cy + (y - cy) * ky]);
}
/** A real window's stone reveal OUTSIDE its glass, in the pushed wall frame: only the few centimetres from the glass
 *  (depth d in from the room's wall face) out to the plane the opening is punched on (`punch` in from the wall's outer
 *  face, `through` the wall's thickness) — beyond it the reveal is the exterior's own — and 8 mm inside the exterior's
 *  outline, so that no face of it lies in a plane the exterior draws. */
export function outerReveal(B, key, pts, d, through, punch) { if (through - punch > d + 0.005) B.reveal(key, insetPts(pts), -d, -(through - punch)); }
/** A wing's west doorway through the loggia's back wall, in the pushed west-wall frame: stone reveals from the room's
 *  wall face to the back of the exterior's door recess, then (drawn in 8 mm) on to the punched plane. */
export function doorReveal(B, key, pts, P) {
  const a = P.wall.w - OUTSIDE.door.recess;
  B.reveal(key, pts, 0, -a, true); B.reveal(key, insetPts(pts), -a, -(P.wall.w - PUNCH.door), true);
}
/** ... and its threshold (room frame): the room's floor to the back of the exterior's recess, a bead 8 mm proud beyond */
export function doorSill(B, key, P) {
  const z0 = P.door.z - P.door.w / 2, z1 = P.door.z + P.door.w / 2, a = -(P.wall.w - OUTSIDE.door.recess), b = -(P.wall.w - PUNCH.door);
  B.flat(key, [[a, z0], [0, z0], [0, z1], [a, z1]], 0); B.flat(key, [[b, z0 + 0.008], [a, z0 + 0.008], [a, z1 - 0.008], [b, z1 - 0.008]], 0.008);
}
/** The leaves' own material: the room's oak, which also takes the light of the loggia's lanterns after dark. (The leaves
 *  hang in the ROOM, whose lights are out when it is empty at night: under the lit loggia the doors were black holes.
 *  The loggia's lamplight is painted into its stone, not cast, so the leaves glow a little by the same amount: call
 *  userData.setDay(daylight) from the room's setLight.) */
export function wingLeafMat(base) {
  const m = base.clone(); m.emissive = new THREE.Color(0xffc48a); m.emissiveMap = m.map || null; m.emissiveIntensity = 0;
  m.userData.setDay = (d) => { const n = 1 - Math.min(1, Math.max(0, d)); m.emissiveIntensity = 0.3 * n * n; };
  return m;
}
/** the oak pair in a wing's west doorway (walk-in rooms): hinged at the jambs, opening into the room, left ajar */
export function wingDoors(ctx, P, mats) {
  const D = P.door, x = D.leafX, hw = D.w / 2;
  const o = { kind: 'hinged', style: 'oak', y: 0, w: hw, h: (D.spring ?? D.h) - 0.02, closer: false, heavy: true, rest: 0.5, thick: 0.06, mats, portal: 0 };
  const a = ctx.addDoor({ ...o, at: [x, D.z - hw], dir: 0, swing: 1 }), b = ctx.addDoor({ ...o, at: [x, D.z + hw], dir: Math.PI, swing: -1 });
  return linkLeaves([a, b], x, D.z, 1, 0, D.w);
}
/** Round-headed leaves: each leaf of a wing's pair carries a quarter-round head (the two make the semicircle of the
 *  arched doorway), in the leaf's own group — it swings with the leaf, and core draws it with the leaf when the door is
 *  shut and seen from outside (door-leaf proxies, core/_roomview.js). Leaf space: z from the hinge to the meeting stile,
 *  x through its thickness, y up. (GUESS: boarded heads; the leaves' real pattern is not known.) */
export function wingLeafHeads(doors, P, mat, strap) {
  const D = P.door, r = D.w / 2, y0 = (D.spring ?? D.h) - 0.02, t = 0.03, N = 8;
  for (const L of doors || []) {
    const B = new Batch();
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI / 2, a1 = ((i + 1) / N) * Math.PI / 2, p0 = [r - r * Math.cos(a0), y0 + r * Math.sin(a0)], p1 = [r - r * Math.cos(a1), y0 + r * Math.sin(a1)];
      B.poly('leaf', [[t, y0, r], [t, p0[1], p0[0]], [t, p1[1], p1[0]]], [1, 0, 0]); B.poly('leaf', [[-t, y0, r], [-t, p1[1], p1[0]], [-t, p0[1], p0[0]]], [-1, 0, 0]);
      B.poly('leaf', [[-t, p0[1], p0[0]], [-t, p1[1], p1[0]], [t, p1[1], p1[0]], [t, p0[1], p0[0]]], [0, Math.sin((a0 + a1) / 2), -Math.cos((a0 + a1) / 2)]);
    }
    B.poly('leaf', [[-t, y0, r], [t, y0, r], [t, y0 + r, r], [-t, y0 + r, r]], [0, 0, 1]);      // the meeting edge
    if (strap) for (const sg of [-1, 1]) { B.boxXZ('strap', sg * (t + 0.006) - 0.006, sg * (t + 0.006) + 0.006, y0 + 0.02, y0 + 0.08, 0.02, r - 0.02); B.boxXZ('strap', sg * (t + 0.006) - 0.006, sg * (t + 0.006) + 0.006, y0 + 0.08, y0 + r * 0.82, r * 0.52, r * 0.52 + 0.05); }
    for (const m of buildBatch(B, L.group, { leaf: mat, strap: strap || mat })) m.name = 'wing:leafHead';
  }
}
export const ANIMALS = ['dodo', 'pangolin', 'unicorn', 'elephant', 'kangaroo', 'whale', 'owl', 'peacock', 'lion', 'tortoise', 'hare', 'monkey'];
// sourced: dodo, pangolin, unicorn (tour sheet), elephant (chapel page), kangaroo, whale (visitor guides). Rest: guesses.

// animal silhouettes, x 0..1 (head towards +x), y 0..1, outline points
const SIL = {
  dodo: [[0.1, 0.05], [0.3, 0.05], [0.3, 0.15], [0.45, 0.15], [0.45, 0.05], [0.6, 0.05], [0.62, 0.2], [0.75, 0.35], [0.78, 0.6], [0.9, 0.62], [1.0, 0.55], [0.98, 0.7], [0.88, 0.85], [0.75, 0.88], [0.65, 0.75], [0.55, 0.55], [0.3, 0.6], [0.08, 0.5], [0.0, 0.3]],
  pangolin: [[0.0, 0.1], [0.15, 0.25], [0.2, 0.05], [0.28, 0.05], [0.3, 0.2], [0.6, 0.2], [0.62, 0.05], [0.7, 0.05], [0.72, 0.25], [0.88, 0.3], [1.0, 0.25], [0.95, 0.4], [0.75, 0.6], [0.5, 0.7], [0.25, 0.6], [0.1, 0.35]],
  unicorn: [[0.12, 0.0], [0.2, 0.0], [0.22, 0.3], [0.62, 0.3], [0.64, 0.0], [0.72, 0.0], [0.74, 0.4], [0.82, 0.62], [0.95, 0.62], [1.0, 0.98], [0.9, 0.75], [0.84, 0.8], [0.72, 0.62], [0.62, 0.58], [0.2, 0.58], [0.05, 0.65], [0.08, 0.45], [0.14, 0.4]],
  elephant: [[0.12, 0.0], [0.25, 0.0], [0.27, 0.22], [0.6, 0.22], [0.62, 0.0], [0.75, 0.0], [0.77, 0.25], [0.88, 0.2], [0.92, 0.0], [1.0, 0.02], [0.96, 0.35], [0.95, 0.65], [0.82, 0.78], [0.6, 0.78], [0.3, 0.8], [0.1, 0.65], [0.08, 0.35]],
  kangaroo: [[0.0, 0.05], [0.25, 0.12], [0.45, 0.0], [0.62, 0.0], [0.6, 0.1], [0.5, 0.15], [0.55, 0.4], [0.68, 0.5], [0.62, 0.62], [0.72, 0.8], [0.78, 1.0], [0.85, 0.85], [0.9, 0.82], [0.75, 0.68], [0.68, 0.72], [0.52, 0.65], [0.4, 0.45], [0.3, 0.25]],
  whale: [[0.0, 0.55], [0.05, 0.35], [0.12, 0.45], [0.2, 0.3], [0.5, 0.15], [0.8, 0.15], [0.98, 0.25], [1.0, 0.45], [0.9, 0.6], [0.6, 0.68], [0.25, 0.55], [0.12, 0.62], [0.05, 0.75]],
  owl: [[0.25, 0.0], [0.75, 0.0], [0.8, 0.3], [0.78, 0.7], [0.85, 1.0], [0.65, 0.85], [0.5, 0.88], [0.35, 0.85], [0.15, 1.0], [0.22, 0.7], [0.2, 0.3]],
  peacock: [[0.55, 0.0], [0.62, 0.0], [0.62, 0.2], [0.8, 0.3], [0.88, 0.62], [0.95, 0.75], [0.85, 0.75], [0.75, 0.45], [0.6, 0.42], [0.45, 0.9], [0.2, 0.95], [0.02, 0.75], [0.0, 0.45], [0.15, 0.2], [0.45, 0.25]],
  lion: [[0.1, 0.0], [0.2, 0.0], [0.22, 0.25], [0.6, 0.25], [0.62, 0.0], [0.72, 0.0], [0.75, 0.3], [0.85, 0.35], [0.98, 0.5], [0.95, 0.75], [0.8, 0.85], [0.68, 0.72], [0.6, 0.6], [0.2, 0.58], [0.05, 0.75], [0.0, 0.7], [0.08, 0.5]],
  tortoise: [[0.05, 0.05], [0.95, 0.05], [1.0, 0.2], [0.92, 0.3], [0.85, 0.22], [0.8, 0.35], [0.65, 0.6], [0.4, 0.62], [0.2, 0.45], [0.1, 0.2]],
  hare: [[0.1, 0.0], [0.7, 0.0], [0.75, 0.15], [0.7, 0.3], [0.8, 0.45], [0.9, 0.48], [0.88, 1.0], [0.82, 0.55], [0.76, 1.0], [0.7, 0.55], [0.5, 0.45], [0.2, 0.42], [0.05, 0.3]],
  monkey: [[0.25, 0.0], [0.65, 0.0], [0.7, 0.4], [0.75, 0.6], [0.62, 0.72], [0.65, 0.95], [0.5, 1.0], [0.38, 0.92], [0.4, 0.72], [0.28, 0.6], [0.2, 0.3], [0.05, 0.25], [0.0, 0.4], [0.05, 0.55], [0.0, 0.5], [0.0, 0.15], [0.15, 0.12]],
};


export function buildChapel(ctx, game) {
  const S = sharedMats(game), C = CHAPEL, L = C.L, W = C.W, HW = C.HW, hz = W / 2;
  const scene = ctx.scene, col = ctx.collider;
  const B = new Batch();
  const mats = { ...S, flame: S.flame.clone() };
  const walkIn = !!(ctx.seamless && ctx.addDoor);      // in place in the wing: real doorway, real windows (core/interiors.js)
  mats.stoneReveal = new THREE.MeshStandardMaterial({ color: 0xd9caa6, roughness: 0.92 });   // the wall's own stone, in the doorway and outside the glass
  const XS = PL.screen.x, RC = PL.cornerR, E = PL.east;
  const XW = XS + 0.2;                                 // the east face of the screen's side walls: the chapel proper begins here

  // ------------------------------------------------------------------ walls (painted canvases)
  const winDef = (s) => ({ s, w: WINW, y0: WY0, y1: WY1 });
  const PY0 = Z4 + 0.1, PY1 = HW - ZONES.ent - 0.25;
  const sidePanels = (sFromX) => {
    const P = [];
    // grotesque uprights either side of each window, and one in the antechapel
    for (const x of WIN) { P.push({ s0: sFromX(x - WINW / 2 - 0.68), s1: sFromX(x - WINW / 2 - 0.2), y0: PY0, y1: PY1, seed: Math.round(x * 3) }); P.push({ s0: sFromX(x + WINW / 2 + 0.2), s1: sFromX(x + WINW / 2 + 0.68), y0: PY0, y1: PY1, seed: Math.round(x * 5) }); }
    P.push({ s0: sFromX(0.45), s1: sFromX(XS - 0.65), y0: PY0 + 0.1, y1: PY1 - 0.1, seed: 77 });
    for (const p of P) if (p.s0 > p.s1) { const t = p.s0; p.s0 = p.s1; p.s1 = t; }
    return P;
  };
  const friezeBlocks = (sFromX) => {
    const B2 = [];
    const bays = [[0.25, XS - 0.45]]; for (let i = 1; i < PIL.length; i++) bays.push([PIL[i - 1] + 0.4, PIL[i] - 0.4]);
    for (const [a, b] of bays) {
      if (b - a > 2.5) { B2.push({ s0: a + 0.1, s1: b - 1.05 }); B2.push({ s0: b - 0.85, s1: b - 0.1 }); } else B2.push({ s0: a + 0.1, s1: b - 0.1 });
    }
    return B2.map((p) => { const s0 = sFromX(p.s0), s1 = sFromX(p.s1); return { s0: Math.min(s0, s1), s1: Math.max(s0, s1) }; });
  };
  const north = chapelWall(L, HW, { zones: ZONES, windows: WIN.map((x) => winDef(x)), panels: sidePanels((x) => x), frieze: friezeBlocks((x) => x), face: 1, seed: 3 });
  const south = chapelWall(L, HW, { zones: ZONES, windows: WIN.map((x) => winDef(L - x)), panels: sidePanels((x) => L - x), frieze: friezeBlocks((x) => L - x), face: -1, seed: 4 });
  // east wall: the Venetian window's three lights between the two pairs of columns
  const sE = hz + E.z, sideS = (E.sideIn + E.sideOut) / 2, sideW = E.sideOut - E.sideIn;
  const east = chapelWall(W, HW, { zones: ZONES, windows: [{ s: sE, w: E.cw, y0: E.y0, y1: E.spring }, { s: sE - sideS, w: sideW, y0: E.y0, y1: E.sideTop }, { s: sE + sideS, w: sideW, y0: E.y0, y1: E.sideTop }],
    panels: [{ s0: sE - E.sideOut, s1: sE - E.sideIn, y0: E.sideTop + 0.3, y1: PY1, seed: 5 }, { s0: sE + E.sideIn, s1: sE + E.sideOut, y0: E.sideTop + 0.3, y1: PY1, seed: 6 }], frieze: [{ s0: sE - 1.9, s1: sE + 1.9 }], face: 1, seed: 6 });
  const doorS = hz - C.door.z, dw = PL.door.w / 2, dh = PL.door.h, doorPts = archPts(doorS, PL.door.w, 0, PL.door.spring, 12);      // round-arched, as the loggia's wall has it
  const west = chapelWall(W, HW, { zones: ZONES, panels: [{ s0: doorS + 1.2, s1: doorS + 2.3, y0: PY0, y1: PY1, seed: 9 }, { s0: 0.7, s1: doorS - 1.3, y0: PY0, y1: PY1, seed: 10 }], frieze: [{ s0: doorS + 1.1, s1: doorS + 2.4 }, { s0: 0.4, s1: doorS - 1.1 }], face: -1, seed: 7 });
  const arcLen = RC * Math.PI / 2, cornerC = chapelWall(arcLen, HW, { zones: ZONES, frieze: [], seed: 12 });
  const wallMat = (c, Lw) => { const t = tex(c, { wrap: false }); fitTexture(t, Lw, HW); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }); };
  mats.wN = wallMat(north, L); mats.wS = wallMat(south, L); mats.wE = wallMat(east, W); mats.wW = wallMat(west, W); mats.wC = wallMat(cornerC, arcLen);
  mats.cornice = new THREE.MeshStandardMaterial({ color: 0xe8d6a6, roughness: 0.7 });
  const winHoles = (sFromX) => WIN.map((x) => rectPts(sFromX(x) - WINW / 2, WY0, sFromX(x) + WINW / 2, WY1));
  const FN = frame(0, 0, -hz, 1, 0), FS = frame(L, 0, hz, -1, 0), FE = frame(L, 0, -hz, 0, 1), FW = frame(0, 0, hz, 0, -1);
  // (the flat walls stop where the rounded corners begin: nothing stands behind the niches in the curves)
  B.push(FN); B.face('wN', rectPts(0, 0, XS - 0.2, HW)); B.face('wN', rectPts(XW + RC, 0, L - RC, HW), winHoles((x) => x)); B.pop();
  B.push(FS); B.face('wS', rectPts(L - XS + 0.2, 0, L, HW)); B.face('wS', rectPts(RC, 0, L - XW - RC, HW), winHoles((x) => L - x)); B.pop();
  const eastWin = archPts(sE, E.cw, E.y0, E.spring, 12), eastL = rectPts(sE - E.sideOut, E.y0, sE - E.sideIn, E.sideTop), eastR = rectPts(sE + E.sideIn, E.y0, sE + E.sideOut, E.sideTop);
  B.push(FE); B.face('wE', rectPts(RC, 0, W - RC, HW), [eastWin, eastL, eastR]); B.pop();
  B.push(FW); B.face('wW', [[0, 0], [doorS - dw, 0], ...doorPts.slice(2).reverse(), [doorS + dw, 0], [W, 0], [W, HW], [0, HW]]); B.pop();
  // window reveals (painted in maroon/gold) + glass
  const glassCells = [{ figures: 2 }, { figures: 1 }, { figures: 2 }, { figures: 2, pal: ['#3a2a8a', '#a82030', '#2a6a4a', '#d8a830', '#7a2a6a', '#f0e6c8'] }, { figures: 1 }, { figures: 2 }, { theme: 'cross', figures: 3, pal: ['#2a4aa0', '#b02030', '#3a7a3a', '#d8b040', '#5a2a7a', '#f0e8d0'] }, { figures: 1 }, { figures: 1 }];
  const GA = glassAtlas(glassCells);
  mats.glass = windowGlass(GA.texture, { day: 1.15, night: 0.04 });
  mats.reveal = new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.8 });
  const ST = stainedPair(GA.texture, 'chapelGlass'); mats.stIn = ST.in; mats.stOut = ST.out;
  // a window in wall frame F: painted reveal in to the glass; `through` = the wall's whole thickness when the window is a
  // real opening (stone reveal outside the glass, translucent pane, iron saddle bars), 0 = blind (lit glass)
  const SR = OUTSIDE.side.recess, ER = OUTSIDE.east.recess;      // the painted reveals end, and the glass stands, at the back of the exterior's recesses
  const glassIn = (F, pts, d, cell, through, punch) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const s = (x0 + x1) / 2, w = x1 - x0;
    B.push(F); B.reveal('reveal', pts, 0, -d);
    if (through && walkIn) { outerReveal(B, 'stoneReveal', pts, d, through, punch); pane(B, 'stIn', 'stOut', pts, -d + 0.02, GA.uv(cell)); for (let k = 1; k < 4; k++) B.box('iron', s, y0 + ((y1 - y0) * k) / 4, -d + 0.02, w, 0.03, 0.03, 0, { bottom: true }); }
    else pane(B, 'glass', null, pts, -d + 0.02, GA.uv(cell));
    for (const sx of [-1, 1]) B.box('brass', s + sx * w / 2, (y0 + pts[2][1]) / 2, -d + 0.04, 0.05, pts[2][1] - y0, 0.03);
    B.box('reveal', s, y0 - 0.06, 0.06, w + 0.3, 0.12, 0.16); B.pop();
  };
  WIN.forEach((x, i) => { glassIn(FN, rectPts(x - WINW / 2, WY0, x + WINW / 2, WY1), PL.win.depth.n - SR, i, PL.win.depth.n, PUNCH.side); glassIn(FS, rectPts(L - x - WINW / 2, WY0, L - x + WINW / 2, WY1), PL.win.depth.s - SR, i + 3, PL.win.depth.s, PUNCH.side); });
  glassIn(FE, eastWin, E.depth - ER, 6, E.depth, PUNCH.east); glassIn(FE, eastL, E.depth - ER, 7, E.depth, PUNCH.east); glassIn(FE, eastR, E.depth - ER, 8, E.depth, PUNCH.east);
  // colour on the floor by day: the side windows throw theirs across the aisle, the east window on the sanctuary floor
  // (additive pools, one soft blotched texture; faded with the daylight in setLight)
  { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
    try { g.globalCompositeOperation = 'lighter';
    [[14, 18, '#2a4aa0'], [40, 14, '#a8202a'], [26, 34, '#d8a830'], [46, 40, '#2a4aa0'], [16, 50, '#3a7a3a'], [36, 54, '#6a2a7a'], [52, 24, '#d8a830']].forEach(([x, y, c]) => { const r = g.createRadialGradient(x, y, 1, x, y, 15); r.addColorStop(0, c); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
    const edge = g.createRadialGradient(32, 32, 18, 32, 32, 34); edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, '#000'); g.globalCompositeOperation = 'source-over'; g.fillStyle = edge; g.fillRect(0, 0, 64, 64); } catch { /* (a canvas without gradients: a test's stub) */ }
    mats.pool = new THREE.MeshBasicMaterial({ name: 'chapelPool', map: tex(cv, { wrap: false }), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const quad = (x0, x1, z0, z1, y, sk = 0) => B.poly('pool', [[x0 + sk, y, z0], [x1 + sk, y, z0], [x1, y, z1], [x0, y, z1]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    if (walkIn) { for (const x of WIN) quad(x - 1.0, x + 1.0, -1.1, 1.1, 0.014, -0.5); quad(L - 2.3, L - 0.9, -1.0, 1.0, 0.466); } }

  // ------------------------------------------------------------------ the rounded corners, an evangelist's niche in each
  // (1939 plan: the east end's inner corners are quarter-rounds, and the screen's side walls meet the side walls in
  //  fillets. The niche is a flat aedicule across the middle of the curve — GUESS: the college has the evangelists "in
  //  the corners".) (cx, cz): the curve's centre; (sx, sz): which corner it rounds.
  mats.statue = new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.7 });
  mats.shell = new THREE.MeshStandardMaterial({ color: 0xd98a7a, roughness: 0.8 });
  mats.gilt = new THREE.MeshStandardMaterial({ color: 0xd8b058, metalness: 0.55, roughness: 0.4 });
  const NB = 2.35, NSP = 4.05, NW = 0.6, NSEGC = 12;
  const corner = (cx, cz, sx, sz) => {
    const pt = (th) => [cx + sx * RC * Math.cos(th), cz + sz * RC * Math.sin(th)], lo = NB - 0.14, hi = NSP + NW / 2 + 0.16;
    for (let i = 0; i < NSEGC; i++) {
      const t0 = (i / NSEGC) * Math.PI / 2, t1 = ((i + 1) / NSEGC) * Math.PI / 2, a = pt(t0), b = pt(t1), u0 = RC * t0, u1 = RC * t1, tm = (t0 + t1) / 2;
      const quad = (y0, y1) => B.poly('wC', [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [-sx * Math.cos(tm), 0, -sz * Math.sin(tm)], [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]);
      if (i >= 2 && i < NSEGC - 2) { quad(0, lo); quad(hi, HW); } else quad(0, HW);
    }
    const p0 = pt(Math.PI / 12), p1 = pt(5 * Math.PI / 12), half = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2, np = archPts(0, NW, NB, NSP, 10);
    B.push(frame((p0[0] + p1[0]) / 2, 0, (p0[1] + p1[1]) / 2, -sz, sx));      // s across the chord, the face towards the room
    B.face('cornice', rectPts(-half, lo, half, hi), [np]);
    B.reveal('reveal', np, 0, -0.3); B.face('shell', np, [], -0.3);
    B.box('marble', 0, NB - 0.07, 0.03, 2 * half, 0.14, 0.26); B.box('gilt', 0, hi + 0.03, 0.01, 2 * half, 0.06, 0.22);
    for (const e of [-1, 1]) B.box('gilt', e * (half - 0.02), (lo + hi) / 2, 0.005, 0.04, hi - lo, 0.02);
    // the evangelist: a robed figure
    B.cyl('statue', 0, NB, -0.13, 0.19, 1.25, 10, false, 0.22);
    B.cyl('statue', 0, NB + 1.25, -0.13, 0.09, 0.1, 8, true, 0.15);
    B.box('statue', 0, NB + 1.47, -0.13, 0.17, 0.22, 0.19);
    B.box('statue', 0.1, NB + 0.85, -0.02, 0.1, 0.34, 0.1);
    B.pop();
    const m = pt(Math.PI / 4), e0 = pt(0), e1 = pt(Math.PI / 2);
    col.addSegment(e0[0], e0[1], m[0], m[1]); col.addSegment(m[0], m[1], e1[0], e1[1]);
  };
  for (const sz of [-1, 1]) { corner(L - RC, sz * (hz - RC), 1, sz); corner(XW + RC, sz * (hz - RC), -1, sz); }

  // ------------------------------------------------------------------ pilasters, columns, cornice
  const shaft = shaftTex(0.42); shaft.repeat.set(1 / PW, 1 / CYH); shaft.needsUpdate = true;
  mats.shaft = new THREE.MeshStandardMaterial({ map: shaft, roughness: 0.5 });
  for (const x of PIL) for (const sz of [-1, 1]) {
    const z = sz * (hz - 0.09);
    B.box('shaft', x, PED + CYH / 2, z, PW, CYH, 0.18);
    B.box('gilt', x, PED + CYH + 0.13, sz * (hz - 0.13), PW + 0.2, 0.26, 0.26);
    B.box('gilt', x, PED, sz * (hz - 0.12), PW + 0.14, 0.12, 0.24);
  }
  const colTex = shaftTex(0.4, 9); colTex.wrapS = THREE.RepeatWrapping; colTex.repeat.set(1 / (Math.PI * 2 * 0.24), 1 / CYH); colTex.needsUpdate = true;
  mats.column = new THREE.MeshStandardMaterial({ map: colTex, roughness: 0.5 });
  // a column on a dark panelled pedestal as high as the wainscot (y0: the floor it stands on)
  const column = (x, z, y0, r = 0.24) => {
    B.boxXZ('darkOak', x - 0.36, x + 0.36, y0, PED, z - 0.36, z + 0.36);
    B.cyl('gilt', x, PED, z, r + 0.06, 0.12, 12, true);
    B.cyl('column', x, PED + 0.12, z, r, CYH - 0.12, 16, false, r * 1.04);
    B.box('gilt', x, PED + CYH + 0.12, z, r * 2.8, 0.24, r * 2.8);
    for (const s of [-1, 1]) B.cyl('gilt', x + s * r * 1.15, PED + CYH + 0.02, z - 0.13, 0.07, 0.26, 8, true);
  };
  // east end: a pair of columns each side of the window (1939 plan), an entablature block over each pair
  const EC = PL.eastCols, ETOP = PED + CYH + 0.24;
  for (const sz of [-1, 1]) { for (const z of EC) column(L - 0.55, sz * z, 0.45); B.boxXZ('gilt', L - 0.9, L, ETOP, HW - 0.04, Math.min(sz * (EC[0] - 0.35), sz * (EC[1] + 0.35)), Math.max(sz * (EC[0] - 0.35), sz * (EC[1] + 0.35)), { bottom: true }); }
  // the antechapel screen (1939 plan): two columns on pedestals, a square pier outboard of each, a short wall from each
  // pier to the side wall, one entablature across the room
  mats.screenWall = new THREE.MeshStandardMaterial({ color: 0xd9bf84, roughness: 0.8 });
  for (const sz of [-1, 1]) {
    const zc = sz * PL.screen.col, zp = sz * PL.screen.pier, za = sz * (PL.screen.pier + 0.25), zb = sz * hz;
    column(XS, zc, 0);
    B.boxXZ('darkOak', XS - 0.3, XS + 0.3, 0, PED, zp - 0.3, zp + 0.3); B.box('shaft', XS, PED + CYH / 2, zp, 0.5, CYH, 0.5); B.box('gilt', XS, PED + CYH + 0.12, zp, 0.62, 0.24, 0.62); B.box('gilt', XS, PED, zp, 0.58, 0.1, 0.58);
    B.boxXZ('darkOak', XS - 0.22, XS + 0.22, 0, PED, Math.min(za, zb), Math.max(za, zb)); B.boxXZ('screenWall', XS - 0.2, XS + 0.2, PED, ETOP, Math.min(za, zb), Math.max(za, zb));
    col.addBox(XS, sz * (PL.screen.pier - 0.3 + hz) / 2, 0.6, hz - PL.screen.pier + 0.3, 0); col.addBox(XS, zc, 0.72, 0.72, 0);
  }
  B.boxXZ('cornice', XS - 0.36, XS + 0.36, ETOP, HW - 0.04, -hz, hz, { bottom: true }); B.boxXZ('gilt', XS - 0.4, XS + 0.4, ETOP + 0.16, ETOP + 0.24, -hz, hz, { bottom: true });
  // cornice + architrave running round the room
  for (const [x0, x1, z0, z1] of [[0, L, -hz, -hz + 0.28], [0, L, hz - 0.28, hz], [0, 0.28, -hz, hz], [L - 0.28, L, -hz, hz]]) {
    B.boxXZ('gilt', x0, x1, HW - 0.04, HW + 0.06, z0, z1, { bottom: true });
    B.boxXZ('cornice', Math.max(0, x0 - (x0 > 0 ? 0.1 : 0)), x1, HW + 0.06, HW + 0.24, z0, z1, { bottom: true });
  }

  // ------------------------------------------------------------------ cove + flat ceiling + saucer dome
  const bay = PIL[1] - PIL[0], EOFF = WIN[0] % bay; const ct = coveTex(); ct.repeat.set(1 / bay, 1); ct.offset.set(0.5 - WIN[0] / bay, 0); ct.needsUpdate = true;      // a fan-shell lunette over each bay
  mats.cove = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.7 });
  const NSEG = 7, y0c = HW + 0.24, rise = C.HC - y0c, inset = C.cove;
  const ring = (k) => { const th = (k / NSEG) * Math.PI / 2; return { d: inset * (1 - Math.cos(th)), y: y0c + rise * Math.sin(th), v: k / NSEG }; };
  for (let k = 0; k < NSEG; k++) {
    const a = ring(k), b = ring(k + 1);
    // north (z = -hz + d), south, west, east sides
    B.poly('cove', [[a.d, a.y, -hz + a.d], [L - a.d, a.y, -hz + a.d], [L - b.d, b.y, -hz + b.d], [b.d, b.y, -hz + b.d]], [0, -0.3, 1], [[a.d, a.v], [L - a.d, a.v], [L - b.d, b.v], [b.d, b.v]]);
    B.poly('cove', [[L - a.d, a.y, hz - a.d], [a.d, a.y, hz - a.d], [b.d, b.y, hz - b.d], [L - b.d, b.y, hz - b.d]], [0, -0.3, -1], [[L - a.d, a.v], [a.d, a.v], [b.d, b.v], [L - b.d, b.v]]);
    B.poly('cove', [[a.d, a.y, hz - a.d], [a.d, a.y, -hz + a.d], [b.d, b.y, -hz + b.d], [b.d, b.y, hz - b.d]], [1, -0.3, 0], [[hz - a.d + EOFF, a.v], [-hz + a.d + EOFF, a.v], [-hz + b.d + EOFF, b.v], [hz - b.d + EOFF, b.v]]);
    B.poly('cove', [[L - a.d, a.y, -hz + a.d], [L - a.d, a.y, hz - a.d], [L - b.d, b.y, hz - b.d], [L - b.d, b.y, -hz + b.d]], [-1, -0.3, 0], [[-hz + a.d + EOFF, a.v], [hz - a.d + EOFF, a.v], [hz - b.d + EOFF, b.v], [-hz + b.d + EOFF, b.v]]);
  }
  const fx0 = inset, fx1 = L - inset, fz = hz - inset, domeR = 2.2;
  const ceilC = chapelCeiling(fx1 - fx0, 2 * fz, C.domeX - fx0, domeR);
  const ceilT = tex(ceilC, { wrap: false }); ceilT.repeat.set(1 / (fx1 - fx0), 1 / (2 * fz)); ceilT.offset.set(-fx0 / (fx1 - fx0), fz / (2 * fz)); ceilT.needsUpdate = true;
  mats.ceil = new THREE.MeshStandardMaterial({ map: ceilT, roughness: 0.6, metalness: 0.15 });
  const circ = []; for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; circ.push([C.domeX + Math.cos(a) * domeR, Math.sin(a) * domeR]); }
  B.flat('ceil', [[fx0, -fz], [fx1, -fz], [fx1, fz], [fx0, fz]], C.HC, [circ], true);
  const dt = domeTex(); mats.dome = new THREE.MeshStandardMaterial({ map: dt, roughness: 0.45, metalness: 0.3 });
  const DS = 32, DR = 6, domeH = PL.top - C.HC;         // a shallow saucer: its crown stays under the storey above
  for (let k = 0; k < DR; k++) for (let i = 0; i < DS; i++) {
    const t0 = k / DR, t1 = (k + 1) / DR, a0 = (i / DS) * Math.PI * 2, a1 = ((i + 1) / DS) * Math.PI * 2;
    const r0 = domeR * Math.cos(t0 * Math.PI / 2), r1 = domeR * Math.cos(t1 * Math.PI / 2);
    const h0 = C.HC + domeH * Math.sin(t0 * Math.PI / 2), h1 = C.HC + domeH * Math.sin(t1 * Math.PI / 2);
    const P = (r, a, h) => [C.domeX + Math.cos(a) * r, h, Math.sin(a) * r];
    B.poly('dome', [P(r0, a0, h0), P(r0, a1, h0), P(r1, a1, h1), P(r1, a0, h1)], [-Math.cos((a0 + a1) / 2), -1.5, -Math.sin((a0 + a1) / 2)], [[i / DS, t0], [(i + 1) / DS, t0], [(i + 1) / DS, t1], [i / DS, t1]]);
  }
  // gilded central boss
  B.cyl('gilt', C.domeX, C.HC + domeH - 0.1, 0, 0.3, 0.08, 12, false);

  // ------------------------------------------------------------------ floor: mosaic aisle, marble, stall platforms, sanctuary
  const mt = mosaicTex(); mt.repeat.set(1 / 2.3, 1 / 1.53); mt.offset.set(0, 0.5); mt.needsUpdate = true;
  mats.mosaic = new THREE.MeshStandardMaterial({ map: mt, roughness: 0.55 });
  mats.paleMarble = new THREE.MeshStandardMaterial({ map: speckle(21, 0.1, 3), color: 0xbdb6a8, roughness: 0.45 });
  B.flat('mosaic', [[0, -C.aisle], [C.sanctX, -C.aisle], [C.sanctX, C.aisle], [0, C.aisle]], 0);
  B.flat('paleMarble', [[0, -hz], [C.sanctX, -hz], [C.sanctX, -C.aisle], [0, -C.aisle]], 0);
  B.flat('paleMarble', [[0, C.aisle], [C.sanctX, C.aisle], [C.sanctX, hz], [0, hz]], 0);
  // three white marble steps (1939 plan: 0.33 m treads)
  const TREAD = 0.33, TOPX = r3(C.sanctX + 2 * TREAD);
  for (let k = 0; k < 3; k++) B.boxXZ('marble', C.sanctX + k * TREAD, L, 0, 0.15 * (k + 1), -hz, hz);
  B.flat('mosaic', [[TOPX + 0.25, -1.9], [L - 0.9, -1.9], [L - 0.9, 1.9], [TOPX + 0.25, 1.9]], 0.452);
  // altar + frontal + candles
  const AX = L - 1.4;
  B.boxXZ('marble', AX - 0.45, AX + 0.45, 0.45, 1.45, -1.1, 1.1);
  mats.frontal = new THREE.MeshStandardMaterial({ color: 0x7a1a2a, roughness: 0.85 });
  B.boxXZ('frontal', AX - 0.47, AX - 0.45, 0.5, 1.4, -1.0, 1.0);
  B.boxXZ('gilt', AX - 0.48, AX - 0.46, 1.25, 1.33, -1.0, 1.0);
  for (const z of [-0.8, -0.45, 0.45, 0.8]) { B.cyl('brass', AX, 1.45, z, 0.05, 0.3, 8, true); candle(B, AX, 1.75, z, 0.25); }
  B.box('brass', AX + 0.1, 1.85, 0, 0.05, 0.8, 0.05); B.box('brass', AX + 0.1, 2.1, 0, 0.05, 0.05, 0.4);   // cross
  // tall white paschal candlestick in the aisle before the steps (photos)
  B.cyl('marble', C.sanctX - 0.6, 0, 0, 0.32, 0.12, 12, true);
  B.cyl('marble', C.sanctX - 0.6, 0.12, 0, 0.12, 1.6, 10, true, 0.2);
  B.cyl('marble', C.sanctX - 0.6, 1.72, 0, 0.22, 0.1, 10, true, 0.12);
  candle(B, C.sanctX - 0.6, 1.82, 0, 0.7);
  col.addCircle(C.sanctX - 0.6, 0, 0.35);

  // ------------------------------------------------------------------ stalls (collegiate seating facing the aisle)
  // three tiers a side between the aisle (1.15 m) and the wall (4.5 m): front desk and bench on the floor, the middle
  // stalls on a 0.12 m platform from 2.05 m, the back stalls on a 0.3 m platform from 3.2 m
  const sides = [-1, 1];
  for (const sz of sides) for (const [x0, x1] of RUNS) {
    const Z = (a) => sz * a;
    const zr = (a, b) => [Math.min(Z(a), Z(b)), Math.max(Z(a), Z(b))];
    const bx = (key, a, b, y0, y1, za, zb) => { const [z0, z1] = zr(za, zb); B.boxXZ(key, a, b, y0, y1, z0, z1); };
    // platforms
    bx('darkOak', x0, x1, 0, 0.12, 2.05, 3.2); bx('darkOak', x0, x1, 0, 0.3, 3.2, hz - 0.02);
    // front row: book desk (on cast-iron scroll supports) + bench behind it
    bx('darkOak', x0, x1, 0.86, 0.92, 1.22, 1.58); for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.6) bx('books', x - 0.1, x + 0.1, 0.92, 0.95, 1.32, 1.46);
    bx('darkOak', x0, x1, 0.42, 0.47, 1.7, 2.0);
    for (let x = x0 + 0.2; x < x1; x += 1.45) { bx('iron', x - 0.03, x + 0.03, 0, 0.86, 1.28, 1.52); bx('iron', x - 0.03, x + 0.03, 0, 0.42, 1.75, 1.95); bx('iron', x - 0.03, x + 0.03, 0.4, 0.46, 1.28, 1.95); }
    // middle row: desk front panel + seat with back
    bx('darkOak', x0, x1, 0.12, 0.98, 2.08, 2.16); bx('darkOak', x0, x1, 0.98, 1.03, 2.0, 2.35); for (let x = x0 + 0.4; x < x1 - 0.2; x += 0.6) bx('books', x - 0.1, x + 0.1, 1.03, 1.06, 2.1, 2.24);
    bx('darkOak', x0, x1, 0.55, 0.6, 2.55, 2.95); bx('darkOak', x0, x1, 0.6, 1.25, 2.95, 3.05);
    // back stalls: desk + seat; the panelled wainscot behind is painted on the wall
    bx('darkOak', x0, x1, 0.3, 1.18, 3.22, 3.3); bx('darkOak', x0, x1, 1.18, 1.23, 3.15, 3.5); for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.6) bx('books', x - 0.1, x + 0.1, 1.23, 1.26, 3.24, 3.38);
    bx('darkOak', x0, x1, 0.75, 0.8, 3.75, 4.2); bx('darkOak', x0, x1, 0.3, 0.75, 4.1, 4.2); bx('darkOak', x0, x1, 0.8, 1.5, 4.2, 4.28);
    // armrests between seats
    for (let x = x0 + 0.6; x < x1 - 0.3; x += 0.6) { bx('darkOak', x - 0.03, x + 0.03, 0.8, 1.05, 3.75, 4.2); }
    // bench ends: tall carved ends at each run end, front-row ends lower
    for (const x of [x0 + 0.05, x1 - 0.05]) { bx('oak', x - 0.05, x + 0.05, 0.12, 1.35, 2.0, 3.15); bx('oak', x - 0.05, x + 0.05, 0.3, 1.55, 3.15, hz - 0.1); }
    const [cz0, cz1] = zr(1.18, hz);
    col.addBox((x0 + x1) / 2, (cz0 + cz1) / 2, x1 - x0, cz1 - cz0, 0);
  }
  // carved animals on the tall back-stall ends
  mats.carve = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.55 });
  const animalSpots = [];
  let ai = 0;
  for (const sz of sides) for (const [x0, x1] of RUNS) for (const x of [x0 + 0.05, x1 - 0.05]) {
    const name = ANIMALS[ai++ % ANIMALS.length];
    const pts = SIL[name], sc = 0.42;
    const zc = sz * (hz - 0.1 + 3.15) / 2;
    // silhouette in the x-y plane of a frame facing along x (so it is seen from the aisle side-on)
    const F = new THREE.Matrix4().makeTranslation(x - 0.05, 1.55, zc + sz * 0.21).multiply(new THREE.Matrix4().makeRotationY(sz > 0 ? Math.PI / 2 : -Math.PI / 2));
    B.push(F);
    const P2 = pts.map(([u, v]) => [u * sc, v * sc * 0.9]);
    B.face('carve', P2, [], 0.05); B.face('carve', P2, [], -0.05, true); B.reveal('carve', P2, 0.05, -0.05);
    B.pop();
    animalSpots.push({ name, x, z: sz * (C.aisle - 0.25) });
  }

  // ------------------------------------------------------------------ candelabra standards (bronze, glass shades)
  mats.shade = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, emissive: 0xffc070, emissiveIntensity: 0.2, transparent: true, opacity: 0.85, roughness: 0.2 });
  const standards = [];
  for (const sz of sides) for (const x of STANDARDS) {
    const z = sz * 1.75;
    B.cyl('bronze', x, 0, z, 0.2, 0.15, 10, true); B.cyl('bronze', x, 0.15, z, 0.045, 2.15, 8, false, 0.06);
    B.box('bronze', x, 2.3, z, 0.9, 0.05, 0.05); B.box('bronze', x, 2.3, z, 0.05, 0.05, 0.9);
    for (const [dx, dz] of [[0, 0], [0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]]) { B.cyl('shade', x + dx, 2.33, z + dz, 0.05, 0.2, 8, true, 0.065); candle(B, x + dx, 2.33, z + dz, 0.12); }
    standards.push([x, z]);
  }

  // ------------------------------------------------------------------ organ (GUESS: it fills the closed compartment the
  // 1939 plan draws in the antechapel's north part; its real place is not in any photograph found)
  const OX0 = 0.15, OX1 = 2.0, OZ0 = -hz, OZ1 = PL.ante.z - 0.45;
  B.boxXZ('darkOak', OX0, OX1, 0, 1.3, OZ0, OZ1);
  B.boxXZ('darkOak', OX0 + 0.1, OX1 - 0.1, 1.3, 5.2, OZ0, OZ1 - 0.25);
  B.boxXZ('gilt', OX0, OX1, 5.2, 5.4, OZ0, OZ1 - 0.15);
  for (let i = 0; i < 7; i++) { const x = OX0 + 0.29 + i * 0.21, h = 2.3 + (i < 3.5 ? i : 6 - i) * 0.3; B.cyl('gilt', x, 1.45, OZ1 - 0.2, 0.065, h, 8, true); B.cyl('gilt', x, 1.3, OZ1 - 0.2, 0.025, 0.15, 6, false, 0.065); }
  // console with its shutters (closed): the organ scholars' list is painted on the inside
  B.boxXZ('darkOak', 0.55, 1.65, 0, 1.15, OZ1, PL.ante.z);
  col.addBox((OX0 + OX1) / 2, (OZ0 + PL.ante.z) / 2, OX1 - OX0, PL.ante.z - OZ0, 0);
  // notice board by the door
  B.push(FW); B.sign('notice', doorS + 1.1, 1.2, doorS + 1.9, 1.85, 0.03, [0, 0, 1, 1]); B.pop();
  // the doorway: stone reveals through the wall's thickness, a cream architrave inside, the threshold; the pair of
  // dark oak leaves stands where the loggia's wall has its door (wingDoors; left ajar once used)
  B.push(FW);
  for (const sx of [-1, 1]) B.box('cornice', doorS + sx * (dw + 0.1), dh / 2 + 0.1, 0.03, 0.2, dh + 0.2, 0.06);
  B.box('cornice', doorS, dh + 0.1, 0.03, PL.door.w, 0.2, 0.06); B.box('gilt', doorS, dh + 0.24, 0.04, PL.door.w + 0.5, 0.08, 0.1);
  if (walkIn) doorReveal(B, 'stoneReveal', doorPts, PL);
  else { B.face('darkOak', doorPts, [], -0.35); B.reveal('cornice', doorPts, 0, -0.35, true); }
  B.pop();
  if (walkIn) doorSill(B, 'stoneFloor', PL);
  const leafMat = wingLeafMat(S.darkOak);
  const doors = walkIn ? wingDoors(ctx, PL, { leaf: leafMat, handle: S.iron }) : null;
  wingLeafHeads(doors, PL, leafMat, S.iron);
  // wall colliders
  col.addSegment(0, -hz, L, -hz); col.addSegment(L, -hz, L, hz); col.addSegment(L, hz, 0, hz); col.addSegment(0, hz, 0, -hz);
  // sanctuary columns' pedestals + altar
  for (const sz of [-1, 1]) for (const z of EC) col.addBox(L - 0.55, sz * z, 0.72, 0.72, 0);
  col.addBox(AX, 0, 0.9, 2.2, 0);
  for (const [x, z] of standards) col.addCircle(x, z, 0.2);

  const meshes = buildBatch(B, scene, mats);

  // ------------------------------------------------------------------ lights: daylight through the windows + candle light
  const { amb, hemi } = ambientOf(scene);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.0); sun.position.set(L / 2 - 3, 12, 9); sun.target.position.set(L / 2, 0, 0); scene.add(sun, sun.target);
  const lamps = [addPoint(scene, 5.2, 3.2, 0, 0xffb860, 3, 13), addPoint(scene, 11.0, 3.2, 0, 0xffb860, 3, 13), addPoint(scene, L - 1.6, 3.0, 0, 0xffc070, 3, 9)];
  const floorY = (x, z) => {
    if (x > C.sanctX) return Math.min(0.45, 0.15 * Math.min(3, 1 + Math.floor((x - C.sanctX) / TREAD)));
    if (x > RUNS[0][0] && x < RUNS[RUNS.length - 1][1]) { const a = Math.abs(z); if (a > 3.2) return 0.3; if (a > 2.05) return 0.12; }
    return 0;
  };
  ctx.setGround(floorY);
  // seats the player can use (middle rows) and where to stand to use them (aisle edge)
  const seats = [];
  for (const sz of sides) for (const [x0, x1] of RUNS) for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.8) seats.push({ x: r3(x), z: sz * 2.75, h: sz > 0 ? Math.PI : 0, ax: r3(x), az: sz * (C.aisle - 0.2) });

  let tris = 0; for (const m of meshes) tris += m.geometry.attributes.position.count / 3;
  return {
    meshes, tris, seats, animals: animalSpots, standards, doors, plan: PL,
    spawn: [1.3, C.door.z], heading: Math.PI / 2,
    exit: [0.7, C.door.z],
    // where people stand at a service (room frame; worcester_interiors.js): the choir in the front rows of the western
    // stalls, the organ scholar at the console, the chaplain before the sanctuary steps; and the console's shutters
    spots: { choir: [[4.3, -1.64, 0], [5.5, -1.64, 0], [4.3, 1.64, Math.PI], [5.5, 1.64, Math.PI]], organist: [1.1, PL.ante.z + 0.42, Math.PI], chaplain: [C.sanctX - 1.1, 0.6, -Math.PI / 2], console: [1.1, PL.ante.z + 0.5] },
    /** light the room: daylight 0..1, candles 0..1 (evensong / evening) */
    setLight(day, candles) {
      // (no candles after dark = the Chapel is shut for the night: dark, and dark from the forecourt and the street)
      mats.glass.userData.setDay(day); ST.setDay(day, candles); mats.pool.opacity = 0.34 * day * day; leafMat.userData.setDay(day);
      sun.intensity = 0.15 + day * 1.1;
      if (amb) amb.intensity = 0.1 + day * 0.7 + candles * 0.35;
      if (hemi) hemi.intensity = 0.08 + day * 0.67 + candles * 0.15;
      const li = 0.12 + candles * 5.9;
      for (const l of lamps) l.intensity = li;
      mats.shade.emissiveIntensity = 0.15 + candles * 1.6;
      mats.flame.color.setRGB(candles > 0.1 ? 1 : 0.85, candles > 0.1 ? 0.82 : 0.8, candles > 0.1 ? 0.45 : 0.72);
    },
  };
}
