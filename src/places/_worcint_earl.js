// Earl Building (ADP, c. 2006–07; 49 en-suite rooms, 3 kitchens per floor, lift, laundry). Sources: New Oxford
// Architecture, college accommodation page, JCR guide, and the OWNER'S TWO PHOTOGRAPHS of a study bedroom and of the
// shared kitchen "Miguel likes to make chicken dippers in" (described in docs/research/worcester.md, "Earl Building
// interior"; the pictures themselves stay out of the game).
// A WALK-IN building (core/interiors.js "seamless"): the rooms are in place inside the real footprint (OSM w69991346),
// planned in _worcint_earl_plan.js; you walk in through the automatic sliding door in the west recess, up the stair, and
// along the first-floor corridor to the kitchen at its end. The windows are real openings onto the live world.
// EXTERIOR: the OSM footprint is kept (massing, roof) as plain pale buff brick; this file adds the entrance canopy, the
// sills of the real windows (whose timber frames, blinds and curtains are the rooms' own, seen through the openings), the
// painted windows of the rooms that are not modelled, and the projecting bays of the other wings (as before).
// Fittings: _worcint_earl_fit.js. Un-merged, returned for friends.js to animate: the oven door, glass / glow, timer.
import * as THREE from 'three';
import { woodGrain, wallShade, speckle, Batch, frame, rectPts, sharedMats, buildBatch, addPoint, ambientOf } from './_worcint_kit.js';
import { canvas, tex } from './_worcint_tex.js';
import { makePack } from './_worcester_kit.js';
import { FF, CH, G, CHG, FRAME, toWorld, ENTRANCE, LOBBY, GDOOR, UDOOR, HALL, STAIR, stairY, LANDING, GALLERY, UPHALL, CORR, ROOMS, ROOM_Z, PASS_Z, PASS_X, ROOM_DOOR, KIT, K, WINDOWS, WALL_T, BAY_OUT, DOOR_OUT, SHELL, EAST_Z, ANGLE_X, ENTRY_Z } from './_worcint_earl_plan.js';
import { PAINT, paintMesh, timberWindow, kitchenFittings, studyRoom } from './_worcint_earl_fit.js';

const ID = 'w69991346';
const N = Math.PI, E = Math.PI / 2, S0 = 0, Wd = -Math.PI / 2;
/** a study room's entry (plan x) and the door in the corridor wall */
const passOf = (r) => [r.x0 + PASS_X[0], r.x0 + PASS_X[1]], doorOf = (r) => [r.x0 + ROOM_DOOR[0], r.x0 + ROOM_DOOR[1]];
// the world side of the entrance (for tools and the friends' walking graph): a point under the canopy, before the door
const doorW = toWorld(DOOR_OUT[0], DOOR_OUT[1]);
export const EARL = {
  door: doorW, doorFacing: ENTRANCE.out + FRAME.rot,
  /** the registration's `seamless` block (core/interiors.js) */
  seamless: {
    // `from`: where inside an opening can be seen from (the world is only drawn for openings the eye could see): the
    // entrance from the lobby, the stair hall and the corridor by its door; the kitchen's windows from the kitchen and
    // through its door; a study room's window from that room, its entry and the corridor outside its door
    portals: [{ at: ENTRANCE.at, out: ENTRANCE.out, w: ENTRANCE.w, h: ENTRANCE.h, y: G, depth: WALL_T, world: [...toWorld(ENTRANCE.at[0], ENTRANCE.at[1]), ENTRANCE.out + FRAME.rot], from: { x0: HALL.x0, x1: LOBBY.x1, z0: HALL.z0, z1: CORR.z1, y0: G, y1: G + CHG + 0.1 } }],
    openings: WINDOWS.map((w) => ({ at: w.at, out: w.out, w: w.w, y0: w.fy + w.y0, y1: w.fy + w.y1, depth: WALL_T + (w.bay || 0), id: w.id, lights: w.lights, tr: w.tr,
      from: w.kind === 'room' ? { x0: w.at[0] - 1.8, x1: w.at[0] + 1.8, z0: CORR.z0, z1: ROOM_Z[0], y0: FF - 0.3, y1: FF + CH + 0.2 } : { x0: KIT.x0 - 3.2, x1: KIT.x1, z0: KIT.z0, z1: KIT.z1, y0: -0.3, y1: CH + 0.2 } })),
    center: [-8, 5], lift: 0.04,
    // the inside, storey by storey (which room a person / the camera is in), and the zones its merged meshes are cut
    // into so that only the part of the building in view is drawn (core/interiors.js splitByZones)
    bounds: [
      { x0: LOBBY.x0, x1: LOBBY.x1, z0: LOBBY.z0, z1: LOBBY.z1 + 0.12, y0: G, y1: G + CHG }, { x0: HALL.x0, x1: HALL.x1, z0: HALL.z0, z1: HALL.z1, y0: G, y1: G + CHG },
      { x0: STAIR.x0, x1: STAIR.x1, z0: STAIR.z0, z1: STAIR.z1 + 0.2, y0: G, y1: FF + CH },
      { x0: CORR.x0, x1: CORR.x1, z0: CORR.z0, z1: CORR.z1, y0: G, y1: CH }, { x0: KIT.x0, x1: KIT.x1, z0: KIT.z0, z1: KIT.z1, y0: G, y1: CH },
      { x0: LANDING.x0, x1: UPHALL.x1, z0: LANDING.z0, z1: LANDING.z1 + 0.12, y0: FF, y1: FF + CH },
      { x0: CORR.x0, x1: CORR.x1, z0: CORR.z0, z1: CORR.z1, y0: FF, y1: FF + CH },
      ...ROOMS.filter((r) => r.open).map((r) => ({ x0: r.x0, x1: r.x1, z0: CORR.z1 - 0.05, z1: ROOM_Z[0], y0: FF, y1: FF + CH })),
    ],
    zones: [
      { x0: -30, x1: LOBBY.x1 + 1, z0: -6, z1: CORR.z0 - 0.06, y1: FF - 0.3 },                  // ground floor: the lobby, the stair hall, the lower flight
      { x0: -30, x1: LOBBY.x1 + 1, z0: -6, z1: CORR.z0 - 0.06, y0: FF - 0.3 },                  // first floor: the upper flight, landing, gallery, upper hall
      { x0: KIT.x0 - 0.02, x1: 2, z0: 2, z1: 14, y1: FF - 0.3 },                                // the kitchen
      ...ROOMS.filter((r) => r.open).map((r) => ({ x0: r.x0 - 0.05, x1: r.x1 + 0.05, z0: CORR.z1 + 0.02, z1: 14, y0: FF - 0.3 })),      // each study room with its entry
      { x0: -30, x1: KIT.x0 - 0.02, z0: CORR.z0 - 0.06, z1: 14, y1: FF - 0.3 },                 // the ground-floor corridor
      { x0: -30, x1: 2, z0: CORR.z0 - 0.06, z1: 14, y0: FF - 0.3 },                             // the first-floor corridor
    ],
  },
};

// ------------------------------------------------------------------------------------------------ exterior
// Hand-built 2026-11-22 in place of the city builder's block (which stood 3.6 m too tall under guessed roofs, with teal
// bays), from ADP's four elevations and site plan (planning 05/00326/FUL), the college's two photographs, the 2024
// street view and the 28 m satellite view (`reference/worcester/16 earl building/`), and the 2022 height survey:
// pale buff brick, three storeys, eaves 9.0 m, slate roofs (wing ridge 11.0, the middle 11.1, the street range 10.6),
// dark-framed windows, bays of brown horizontal timber boarding and of green patinated copper breaking the eaves, the
// copper entrance canopy on its steel column in the angle, the dwarf wall and railings on Worcester Place; and the
// Gym: a single storey of buff brick under a timber clerestory and a green copper roof, with the flat-roofed link.
// The outline is the map's (it agrees with ADP's plan; like its neighbours it lies 2.5 m west / 1.5 m north of the
// height survey). KNOWN / GUESS per element: EARL_ATTR.
/** the windows' frames outside: dark green (16/earl building - timber-boarded bay…) */
export const EARL_FRAME = 0x3b4a3d;
export const EARL_HEIGHTS = { eaves: 9.0, wing: 11.0, middle: 11.1, street: 10.6, gymEaves: 3.15, gymRidge: 3.75, canopy: 2.6 };
export const EARL_ATTR = {
  outline: ['K', 'the map w69991346 = ADP site plan WCO1-D-060A; height survey (same shapes 2.5 m east / 1.5 m south)'],
  heights: ['K', 'height survey: eaves 9.0-9.3, wing ridge 10.9-11.0, middle 11.0-11.2, street range about 10.6; ADP elevations: eaves 9.0-9.4, ridge 10.8'],
  walls: ['K', '16/earl building - timber-boarded bay…, 16/…west side and gym…, street view 2024: pale buff brick; reconstituted-stone surrounds to the street side\'s ground-floor windows (ADP schedule)'],
  roofs: ['K', 'satellite 28 m: slate; the wing\'s ridge along it with a gable to the south and two rooflights on its west slope, a broad east-west roof over the middle, the street range\'s own ridge; ADP: gables to the wing\'s south end and the street range\'s ends'],
  westFace: ['K', 'ADP west elevation + 16/…west side and gym…: six window columns, two green copper bays breaking the eaves over timber boarding'],
  streetFace: ['K', 'ADP east elevation + street view 2024: four square copper bays (two storeys of copper over a ground-floor window) standing about 0.6 m out under flat oversailing lids, a two-light window to each floor in the front and a tall narrow light in each cheek (the street view, enlarged: seen from the south each shows its cheek and its front, the lid\'s near corner reading as a peak); the glazed timber-panelled stair bay with the street door, dwarf wall with hooped railings (the gate at its south end: places/_wplace_gloucester.js)'],
  southFace: ['K', 'ADP south elevation: timber-boarded bays, the entrance canopy with painted steel column and copper roof; which bay stands where on the map\'s shorter face: G'],
  wingEast: ['K', 'ADP sectional east elevation + 16/earl building - timber-boarded bay…: a full-height brown timber bay with dark corner windows at the wing\'s south-east corner'],
  canopy: ['K', 'ADP south and sectional east elevations ("new projecting canopy to entrance into the new development"), satellite 28 m (a green patch in the angle), height survey (2.9 m there)'],
  door: ['G', 'that the automatic door is the one under the canopy, in the short wall facing south-south-east; its width (1.2 m)'],
  kitchenWindows: ['K', 'the blinds window at the east corner of the wing\'s end wall: ADP south elevation (a timber-boarded bay with a two-light window to each floor at that corner of the gable end), the owner\'s photograph (on the long wall beside the table) and 16/earl building - timber-boarded bay… (coral blinds seen in the bay\'s upper windows); the far window in the west wall is ADP\'s WF/14 and the two-light one by the table\'s end, in the timber boarding on the east side of the corner, WF/13. G: THREE blinds (the owner\'s arrangement as first built; ADP and the photograph of the bay show two lights), the bay\'s exact width and projection (0.45 m)'],
  northSide: ['K', 'ADP north elevation: mostly blank, small windows, an angled copper bay to a kitchen (satellite: a green patch); positions G'],
  gym: ['K', 'ADP west and sectional east elevations, 16/…west side and gym…, satellite 28 m: single storey, buff brick, timber clerestory, green copper roof with standing seams, a flat-roofed link to the wing; its plan is the map\'s prong (G: doors)'],
};
export const earlExterior = {
  preMap(game) {
    game.overrides.skip.add(ID);      // (the whole shell is drawn in install below)
    // the paved garden between the Earl Building, the Gym and Gloucester House (ADP site plan: "relandscaped garden",
    // "new paved access to development"; satellite 28 m: a paved yard with two trees), and the gated way to the street
    const map = game.map; if (!map || !map.areas) return;
    map.areas.push({ id: 'worc:earl:garden', kind: 'paved', surface: 'paving_stones', poly: [[-390.2, -147.9], [-378.0, -147.9], [-379.5, -153.6], [-381.2, -161.5], [-381.5, -163.8], [-381.7, -166.1], [-392.3, -164.8], [-394.0, -164.0], [-391.7, -159.1], [-391.4, -155.9], [-390.5, -148.0]] });
    map.areas.push({ id: 'worc:earl:passage', kind: 'paved', surface: 'paving_stones', poly: [[-381.5, -163.8], [-381.2, -161.7], [-369.7, -163.0], [-370.0, -164.9]] });
    if (map.trees) map.trees.push([-388.4, -163.6, 7, 'broad'], [-385.6, -155.6, 4, 'broad']);
  },
  install(game) {
    const world = game.world, col = game.worldCollider;
    const pack = makePack(world), KC = pack && pack.cells;
    const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
    const cell = (key, from, tint) => { if (KC && KC.get(from) && !KC.get(key)) KC.set(key, { ...KC.get(from), tint: Array.isArray(tint) ? tint : lin(tint) }); };
    cell('earlBrick', 'buff', [1.08, 1.05, 0.98]); cell('earlTimber', 'boards', 0x8a5a34); cell('earlCopper', 'lead', 0x6fae98); cell('earlCopperD', 'lead', 0x4f8a78); cell('earlBayCu', 'lead', 0x3f9c95); cell('earlBayCuD', 'lead', 0x2f7c77);      // (the bays' copper is a stronger blue-green than the Gym's roof: street view 2024)
    cell('earlFrame', 'frame', EARL_FRAME); cell('earlCoral', 'white', 0xe8746a); cell('earlSteel', 'alu', 0x9aa0a4); cell('earlGlass', 'lead', 0x2a3338); cell('earlWoodL', 'wood', 0xb98a58);
    const B = new Batch(), H = EARL_HEIGHTS, T30 = Math.tan(Math.PI / 6);
    const gy = world.groundHeight ? world.groundHeight(...toWorld(ENTRANCE.at[0], ENTRANCE.at[1])) : 0;
    B.push(new THREE.Matrix4().makeRotationY(FRAME.rot).setPosition(FRAME.O[0], gy + EARL.seamless.lift - G, FRAME.O[1]));      // the plan's frame
    let bayN = 520;
    const bay = (f) => [1 + (bayN++ % 251), f > 0 ? 1 + (bayN % 5) : 0];
    /** the panes of one light between y0 and y1: a top-hung casement over a low fixed light, a transom between (16/earl building - timber-boarded bay…; street view 2024); a short window is one pane */
    const lights = (y0, y1, m) => { const h = y1 - y0, t = y0 + Math.max(0.3, h * 0.27); return h < 1.0 ? [[y0 + m, y1 - m]] : [[y0 + m, t - m / 2], [t + m / 2, y1 - m]]; };
    /** a dark-framed two-light window in the current face frame, set 0.1 m into the wall */
    const win = (s0, y0, s1, y1, f, cols = 2) => {
      const d = 0.1, m = 0.06, pts = rectPts(s0, y0, s1, y1), w = (s1 - s0 - m) / cols, bb = bay(f);
      B.reveal('earlBrick', pts, 0, -d); B.poly('earlFrame', pts.map((q) => [q[0], q[1], -d]), [0, 0, 1]);
      for (let i = 0; i < cols; i++) { const a0 = s0 + m + i * w, a1 = a0 + w - m; for (const [ya, yb] of lights(y0, y1, m)) B.poly('sash', [[a0, ya, -d + 0.016], [a1, ya, -d + 0.016], [a1, yb, -d + 0.016], [a0, yb, -d + 0.016]], [0, 0, 1], [[bb[0] + 0.16, bb[1] + 0.79], [bb[0] + 0.27, bb[1] + 0.79], [bb[0] + 0.27, bb[1] + 0.87], [bb[0] + 0.16, bb[1] + 0.87]]); }
      B.box('earlSteel', (s0 + s1) / 2, y0 - 0.035, 0.045, s1 - s0 + 0.14, 0.07, 0.09, 0, { bottom: true });
    };
    /** panes on the front of a bay (no reveal): z = out */
    const bayWin = (s0, y0, s1, y1, out, f, cols = 2) => { const m = 0.06, w = (s1 - s0 - m) / cols, bb = bay(f); B.poly('earlFrame', rectPts(s0, y0, s1, y1).map((q) => [q[0], q[1], out + 0.012]), [0, 0, 1]);
      for (let i = 0; i < cols; i++) { const a0 = s0 + m + i * w, a1 = a0 + w - m; for (const [ya, yb] of lights(y0, y1, m)) B.poly('sash', [[a0, ya, out + 0.026], [a1, ya, out + 0.026], [a1, yb, out + 0.026], [a0, yb, out + 0.026]], [0, 0, 1], [[bb[0] + 0.16, bb[1] + 0.79], [bb[0] + 0.27, bb[1] + 0.79], [bb[0] + 0.27, bb[1] + 0.87], [bb[0] + 0.16, bb[1] + 0.87]]); } };
    const FLY = [0.9, 3.9, 6.9], WH = 1.35;      // window sills by floor, their height
    /** a bay standing out of the face from z0 to z1: its front and cheeks, a lid or a floor where asked. No back: through a real window behind it nothing of it is seen from inside */
    const bayBox = (key, s0, s1, y0, y1, z0, z1, top = false, bottom = false) => {
      const hz = key === 'earlTimber', Q = (pts, n, k) => B.poly(key, pts, n, hz ? pts.map((q) => [q[1], q[k]]) : null);      // (the boarding runs level: the pack's boards stand upright)
      Q([[s0, y0, z1], [s1, y0, z1], [s1, y1, z1], [s0, y1, z1]], [0, 0, 1], 0);
      Q([[s1, y0, z1], [s1, y0, z0], [s1, y1, z0], [s1, y1, z1]], [1, 0, 0], 2); Q([[s0, y0, z0], [s0, y0, z1], [s0, y1, z1], [s0, y1, z0]], [-1, 0, 0], 2);
      if (top) B.poly(key, [[s0, y1, z1], [s1, y1, z1], [s1, y1, z0], [s0, y1, z0]], [0, 1, 0]);
      if (bottom) B.poly(key, [[s0, y0, z0], [s1, y0, z0], [s1, y0, z1], [s0, y0, z1]], [0, -1, 0]);
    };
    /** the kitchen's blinds window as painted on a bay's front (three coral blinds over the low lights): what is seen from further off than the room is shown */
    const coralWin = (s0, y0, s1, y1, out) => { const w = s1 - s0;
      B.poly('earlFrame', rectPts(s0, y0, s1, y1).map((p) => [p[0], p[1], out + 0.012]), [0, 0, 1]);
      for (let i = 0; i < 3; i++) { const a = s0 + (w / 3) * i + 0.05, b = a + w / 3 - 0.1; B.poly('earlCoral', rectPts(a, y0 + 0.3, b, y1 - 0.05).map((p) => [p[0], p[1], out + 0.022]), [0, 0, 1]); B.poly('sash', rectPts(a, y0 + 0.05, b, y0 + 0.28).map((p) => [p[0], p[1], out + 0.022]), [0, 0, 1], [[7.16, 0.79], [7.27, 0.79], [7.27, 0.87], [7.16, 0.87]]); } };
    /**
     * one face of the shell from plan point p to q (outside on the side of (-dz, dx)): brick to the eaves (or to a gable
     * `peak` at its middle), and what stands on it: ['w', s, floors, width] a column of windows; ['t', s0, s1, o] a
     * full-height timber-boarded bay with a window to each floor (o.cols lights; o.real: the rectangle [s0, y0, s1, y1]
     * of the real ground-floor window in it; o.coral: that one has the blinds); ['c', s0, s1, y0, tb, o] a copper bay from y0 up through
     * the eaves, timber below it down to `tb` (default none), a window to each of its floors
     */
    const face = (p, q, items = [], peak = 0) => {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]), holes = [];
      for (const it of items) if (it[0] === 'w') for (const f of it[2]) holes.push([it[1] - (it[3] || 1.25) / 2, FLY[f], it[1] + (it[3] || 1.25) / 2, FLY[f] + WH, f]);
      B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1]));
      B.face('earlBrick', peak ? [[0, 0], [l, 0], [l, H.eaves], [l / 2, peak], [0, H.eaves]] : rectPts(0, 0, l, H.eaves), holes.map((h) => rectPts(h[0], h[1], h[2], h[3])));
      for (const h of holes) win(h[0], h[1], h[2], h[3], h[4]);
      for (const it of items) {
        if (it[0] === 't') { const [, s0, s1, o = {}] = it, out = BAY_OUT, R = o.real, a0 = R ? R[0] : s0 + 0.12, a1 = R ? R[2] : s1 - 0.12;
          bayBox('earlTimber', s0, s1, 0.25, H.eaves - 0.12, 0, out); bayBox('earlBrick', s0, s1, 0, 0.25, 0, out); B.boxXZ('earlFrame', s0 - 0.04, s1 + 0.04, H.eaves - 0.12, H.eaves - 0.02, 0.004, out + 0.05, { bottom: true });
          for (let f = 0; f < 3; f++) { if (f === 0 && R && o.coral) coralWin(R[0], R[1], R[2], R[3], out); else if (f === 0 && R) bayWin(R[0], R[1], R[2], R[3], out, f, o.cols || 3); else bayWin(a0, FLY[f], a1, FLY[f] + WH + 0.1, out, f, o.cols || 3); for (const [sx, ry] of [[s0, -Math.PI / 2], [s1, Math.PI / 2]]) { B.push(new THREE.Matrix4().makeTranslation(sx, 0, 0).multiply(new THREE.Matrix4().makeRotationY(ry))); bayWin(ry > 0 ? -out + 0.04 : 0.04, FLY[f], ry > 0 ? -0.04 : out - 0.04, FLY[f] + WH + 0.1, 0, f, 1); B.pop(); } } }      // (dark corner windows: the front's and the cheeks')
        if (it[0] === 'c') { const [, s0, s1, y0, tb, o = {}] = it, out = o.out || 0.5, lid = o.lid || 0.06, yt = H.eaves + (o.up || 0.55);
          bayBox('earlBayCu', s0, s1, y0, yt, 0, out, false, true); B.boxXZ('earlBayCuD', s0 - lid, s1 + lid, yt, yt + 0.1, -0.4, out + lid, { bottom: true }); B.boxXZ('earlBayCu', s0 + 0.01, s1 - 0.01, H.eaves - 0.2, yt, -0.38, 0.02);
          if (tb !== undefined) bayBox('earlTimber', s0, s1, tb, y0, 0, out - 0.12, false, true);
          for (let f = 0; f < 3; f++) if (FLY[f] > y0 - 0.2) bayWin(s0 + 0.15, FLY[f], s1 - 0.15, FLY[f] + WH + 0.15, out, f, 2); else if (tb === undefined || FLY[f] < tb) { /* a plain window below: listed as 'w' */ } else bayWin(s0 + 0.25, FLY[f], s1 - 0.25, FLY[f] + WH, out - 0.12, f, 2);
          // standing seams (street view 2024: the copper is in upright trays about 0.45 m wide): on the front between, below and above its windows, and one up each cheek
          { const wf = [0, 1, 2].filter((f) => FLY[f] > y0 - 0.2), zs = [], n = Math.max(2, Math.round((s1 - s0) / 0.45)); let yb = y0 + 0.02;
            for (const f of wf) { zs.push([yb, FLY[f] - 0.03]); yb = FLY[f] + WH + 0.18; } zs.push([yb, yt - 0.02]);
            for (const [ya, yc] of zs) if (yc - ya > 0.12) for (let k = 1; k < n; k++) { const x = s0 + ((s1 - s0) * k) / n; B.poly('earlBayCuD', [[x - 0.012, ya, out + 0.009], [x + 0.012, ya, out + 0.009], [x + 0.012, yc, out + 0.009], [x - 0.012, yc, out + 0.009]], [0, 0, 1]); }
            const zc = o.slits ? out - 0.1 : out * 0.5;
            B.poly('earlBayCuD', [[s0 - 0.009, y0 + 0.02, zc - 0.012], [s0 - 0.009, y0 + 0.02, zc + 0.012], [s0 - 0.009, yt - 0.02, zc + 0.012], [s0 - 0.009, yt - 0.02, zc - 0.012]], [-1, 0, 0]);
            B.poly('earlBayCuD', [[s1 + 0.009, y0 + 0.02, zc + 0.012], [s1 + 0.009, y0 + 0.02, zc - 0.012], [s1 + 0.009, yt - 0.02, zc - 0.012], [s1 + 0.009, yt - 0.02, zc + 0.012]], [1, 0, 0]); }
          // (o.slits: a tall narrow light in each cheek to each of its floors)
          if (o.slits) for (let f = 0; f < 3; f++) if (FLY[f] > y0 - 0.2) for (const [sx, ry] of [[s0, -Math.PI / 2], [s1, Math.PI / 2]]) { B.push(new THREE.Matrix4().makeTranslation(sx, 0, 0).multiply(new THREE.Matrix4().makeRotationY(ry))); bayWin(ry > 0 ? -out + 0.14 : 0.14, FLY[f], ry > 0 ? -out + 0.4 : 0.4, FLY[f] + WH + 0.15, 0, f, 1); B.pop(); } }
      }
      B.pop();
    };
    /** a slate roof over the quad c (c0 -> c1 one long side, c2 -> c3 the other): ridge at yr between the middles of its ends; an end is a gable (g) or hipped */
    let roofN = 0;
    const roof = (c, yr, g0, g1) => {
      const ov = 0.4, ye = H.eaves, cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, cz = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
      const q = c.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz) || 1; return [x + ((x - cx) / l) * ov * 1.3, z + ((z - cz) / l) * ov * 1.3]; });
      const m0 = [(q[0][0] + q[3][0]) / 2, (q[0][1] + q[3][1]) / 2], m1 = [(q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2];
      const half = (Math.hypot(q[0][0] - q[3][0], q[0][1] - q[3][1]) + Math.hypot(q[1][0] - q[2][0], q[1][1] - q[2][1])) / 4, len = Math.hypot(m1[0] - m0[0], m1[1] - m0[1]), k = Math.min(0.48, half / len);
      const r0 = g0 ? m0 : [m0[0] + (m1[0] - m0[0]) * k, m0[1] + (m1[1] - m0[1]) * k], r1 = g1 ? m1 : [m1[0] + (m0[0] - m1[0]) * k, m1[1] + (m0[1] - m1[1]) * k];
      const E3 = (p) => [p[0], ye - 0.12, p[1]], R3 = (p) => [p[0], yr, p[1]];
      const pl = (pts) => { const n = [0, 0, 0]; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } const s = n[1] < 0 ? -1 : 1; B.poly('slate', pts, [n[0] * s, n[1] * s, n[2] * s]); };
      pl([E3(q[0]), E3(q[1]), R3(r1), R3(r0)]); pl([E3(q[2]), E3(q[3]), R3(r0), R3(r1)]);
      if (!g1) pl([E3(q[1]), E3(q[2]), R3(r1)]); if (!g0) pl([E3(q[3]), E3(q[0]), R3(r0)]);
      B.flat('earlFrame', q, ye - 0.14 - 0.009 * roofN++, [], true);                                 // the eaves' soffit (each roof's a little lower than the last: where two roofs meet their soffits are not in one plane)
    };
    const V = SHELL, A0 = [ANGLE_X, EAST_Z], A1 = [ANGLE_X, ENTRY_Z[0]], SE = [0, EAST_Z], SW = [0, 10.72], NW = [V[13][0], 10.72];
    const all = [0, 1, 2];
    // ---- the west wing
    // its south end: a gable; the link to the Gym stands against its middle; at its east corner the timber-boarded bay
    // with a window to each floor (ADP south elevation; 16/earl building - timber-boarded bay…): the ground floor's is
    // the kitchen's window with the coral blinds (the real one is punched through the bay's front)
    { const Wb = WINDOWS[0], s0 = SW[1] - (Wb.at[1] + Wb.w / 2), s1 = s0 + Wb.w;
      face(SW, SE, [['t', s0 - 0.12, s1 + 0.12, { cols: 2, real: [s0, Wb.y0, s1, Wb.y1], coral: true }]], H.wing - 0.1); }
    // its east side at the kitchen: the timber bay on the other side of the same corner, a two-light window to each floor
    // (ADP sectional east elevation; the kitchen's real one behind the ground floor's); the corridor's windows above
    { const Wk = WINDOWS.find((w) => w.id === 'kitEast'), s0 = -(Wk.at[0] + Wk.w / 2), s1 = s0 + Wk.w;
      face(SE, A0, [['t', 0.15, 2.95, { cols: 2, real: [s0, Wk.y0, s1, Wk.y1] }], ['w', 4.35, [1, 2]]]); }
    face(A0, A1, [['w', 0.9, [1, 2], 1.0]]);                                                               // the entrance wall under the canopy
    face(A1, V[0], [['t', 1.7, 3.5], ['w', 5.3, all], ['t', 6.7, 8.5], ['w', 9.75, all]]);                 // the middle section's south side
    face(V[0], V[20], [['w', 1.2, all, 1.0]]);                                                             // the street range's return
    face(V[20], V[19], [['t', 1.4, 3.6], ['w', 5.6, all], ['w', 9.9, all, 0.9]], H.street - 0.1);      // its south gable end: plain narrow windows towards the street (street view 2024; the copper seen at this corner in ADP's south elevation is the first street bay side-on)
    { const st0 = 7.6, st1 = 12.6;      // the street side: four copper bays and the glazed, timber-panelled stair bay with the street door
      const SB = { out: 0.62, lid: 0.16, up: 0.75, slits: true };      // (street view 2024: the bays stand about 0.6 m out, a tall narrow light in each cheek, under flat lids that oversail)
      face(V[19], V[18], [['c', 1.2, 3.3, 2.95, undefined, SB], ['w', 2.25, [0]], ['c', 4.5, 6.5, 2.95, undefined, SB], ['w', 5.5, [0]], ['c', 13.8, 15.8, 2.95, undefined, SB], ['w', 14.8, [0]], ['c', 17.0, 19.1, 2.95, undefined, SB], ['w', 18.05, [0]]]);
      B.push(frame(V[19][0], 0, V[19][1], V[18][0] - V[19][0], V[18][1] - V[19][1]));
      bayBox('earlTimber', st0, st1, 0.2, H.eaves - 0.15, 0, 0.2); B.boxXZ('earlSteel', st0 - 0.1, st0, 0, H.eaves - 0.1, 0.02, 0.28); B.boxXZ('earlSteel', st1, st1 + 0.1, 0, H.eaves - 0.1, 0.02, 0.28); B.boxXZ('earlSteel', st0 - 0.1, st1 + 0.1, H.eaves - 0.15, H.eaves - 0.03, 0.02, 0.28, { bottom: true });
      for (let f = 0; f < 3; f++) bayWin(st0 + 0.9, f * 3 + (f ? 0.5 : 0.35), st1 - 1.3, f * 3 + 2.55, 0.2, f, 3);
      B.poly('earlGlass', rectPts(st1 - 1.15, 0.05, st1 - 0.2, 2.15).map((p) => [p[0], p[1], 0.215]), [0, 0, 1]); B.boxXZ('earlSteel', st1 - 0.7, st1 - 0.66, 0.05, 2.15, 0.21, 0.24);      // the street door (shut: the way in from the college is the canopy's)
      for (const it of [2.25, 5.5, 14.8, 18.05]) { B.boxXZ('stoneDress', it - 0.78, it + 0.78, FLY[0] - 0.14, FLY[0] - 0.02, 0.01, 0.07, { bottom: true }); B.boxXZ('stoneDress', it - 0.78, it + 0.78, FLY[0] + WH + 0.02, FLY[0] + WH + 0.16, 0.01, 0.06, { bottom: true }); }      // stone surrounds
      // the dwarf wall with hooped railings, 1.7 m out (the gate between brick piers at its south end, and the wall on
      // to Gloucester House, are drawn by places/_wplace_gloucester.js: its north pier ends where this begins)
      const dw = 1.7, gap = [10.6, 12.6];
      for (const [a, b] of [[0.25, gap[0]], [gap[1], 19.8]]) { B.boxXZ('earlBrick', a, b, 0, 0.5, dw - 0.11, dw + 0.11); B.boxXZ('stoneDress', a - 0.02, b + 0.02, 0.5, 0.56, dw - 0.14, dw + 0.14, { bottom: true }); B.boxXZ('iron', a, b, 1.12, 1.16, dw - 0.02, dw + 0.02, { bottom: true }); for (let x = a + 0.1; x < b; x += 0.9) B.boxXZ('iron', x - 0.015, x + 0.015, 0.56, 1.14, dw - 0.015, dw + 0.015, { top: false }); }
      B.pop();
      const W2 = (s, d) => { const l = Math.hypot(V[18][0] - V[19][0], V[18][1] - V[19][1]), ux = (V[18][0] - V[19][0]) / l, uz = (V[18][1] - V[19][1]) / l; return toWorld(V[19][0] + s * ux - d * uz, V[19][1] + s * uz + d * ux); };
      for (const [a, b] of [[0.25, gap[0]], [gap[1], 19.8]]) { const p = W2(a, dw), q = W2(b, dw); col.addSegment(p[0], p[1], q[0], q[1], { tag: 'wall', h: 1.2 }); }
      // generated street furniture and trees inside the railings, or within a metre of them on the narrow footway, go
      if (world.clearArea) { try { world.clearArea([W2(0.25, 0.1), W2(19.8, 0.1), W2(19.8, dw + 1.05), W2(0.25, dw + 1.05)], { lamps: false }); } catch (e) { /* */ } } }
    face(V[18], V[17], [['w', 3.0, all], ['w', 8.4, [1, 2], 1.0]], H.street - 0.1);                        // the street range's north gable end
    face(V[17], V[16], [['w', 2.9, all, 1.0]]);
    face(V[16], V[15], [['w', 2.2, [1, 2], 0.9], ['c', 5.0, 6.9, 0.4], ['w', 9.6, [1, 2], 0.9]]);          // the north side: nearly blank; the angled copper bay of a kitchen (drawn square)
    face(V[15], V[14], []);
    face(V[14], NW, [['w', 3.2, all], ['w', 8.3, all]]);                                                   // the wing's north end
    { const xs = (x) => x - NW[0];      // the wing's west side: six columns, two copper bays over timber breaking the eaves
      face(NW, SW, [['w', xs(-19.9), all], ['c', xs(-17.7), xs(-15.5), 2.95, 0.3], ['w', xs(-12.65), all, 2.0], ['w', xs(-9.65), all, 2.0], ['c', xs(-7.5), xs(-5.3), 2.95, 0.3], ['w', xs(-2.9), all, 2.0]]); }
    // ---- the roofs
    roof([SE, [V[14][0], EAST_Z], NW, SW], H.wing, true, false);                                            // the wing: a gable to the south, hipped where the middle's roof takes over
    roof([[-20.26, 6.97], V[16], V[0], [-7.34, 7.05]], H.middle, false, false);                             // the middle (run into the wing's roof)
    roof([V[18], V[19], V[20], V[17]], H.street, true, true);                                               // the street range
    for (const x of [-15.2, -6.0]) B.boxXZ('earlSteel', x - 0.45, x + 0.45, H.eaves + 0.5, H.eaves + 0.85, 8.7, 9.6);      // two rooflights on the wing's west slope (the satellite view)
    B.flat('lead', [V[14], V[15], [V[15][0], EAST_Z], [V[14][0], EAST_Z]], H.eaves - 0.02);                 // the flat at the wing's north-east corner (the satellite view)
    // ---- the entrance: the copper canopy on its painted steel column, the door's frame and how it looks from far off
    { const y = H.canopy, x0 = ANGLE_X, x1 = ANGLE_X + 2.4, z0 = ENTRY_Z[0] - 1.0, z1 = EAST_Z - 0.03;
      B.poly('earlCopper', [[x0, y + 0.28, z0], [x1, y, z0], [x1, y, z1], [x0, y + 0.28, z1]], [0, 1, 0]); B.poly('earlCopperD', [[x0, y + 0.18, z0], [x1, y - 0.1, z0], [x1, y - 0.1, z1], [x0, y + 0.18, z1]], [0, -1, 0]);
      B.poly('earlCopperD', [[x1, y - 0.1, z0], [x1, y - 0.1, z1], [x1, y, z1], [x1, y, z0]], [1, 0, 0]); B.poly('earlCopperD', [[x0, y + 0.18, z0], [x1, y - 0.1, z0], [x1, y, z0], [x0, y + 0.28, z0]], [0, 0, -1]);
      B.cyl('earlSteel', x1 - 0.2, 0, z0 + 0.2, 0.06, y - 0.1, 8, false);
      const q = toWorld(x1 - 0.2, z0 + 0.2); col.addCircle(q[0], q[1], 0.09, { tag: 'building' }); }
    { const face0 = frame(ENTRANCE.at[0] + WALL_T, 0, ENTRANCE.at[1] + ENTRANCE.w / 2, 0, -1);      // (the entrance wall's outside: x = along it to the east)
      B.push(face0);
      for (const s of [-0.05, ENTRANCE.w + 0.05]) B.box('earlSteel', s, G + ENTRANCE.h / 2, 0.04, 0.1, ENTRANCE.h, 0.1);
      B.box('earlSteel', ENTRANCE.w / 2, G + ENTRANCE.h + 0.06, 0.04, ENTRANCE.w + 0.2, 0.12, 0.1);
      // the door as seen from far off, before the building's inside is drawn in place (the opening is punched 3 cm out, in front of this)
      B.face('earlGlass', rectPts(0, G, ENTRANCE.w, G + ENTRANCE.h), [], 0.01); B.face('earlSteel', rectPts(0, G, ENTRANCE.w, G + 0.1), [], 0.016);
      B.pop(); }
    // ---- the Gym and its link (the map's prong south of the wing)
    { const g = [V[9], V[8], V[7], V[6]], ye = H.gymEaves, yb = 2.35;      // (west side, south end, east side, north end)
      for (let i = 0; i < 4; i++) { const p = g[i], q = g[(i + 1) % 4], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
        B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1]));
        B.face('earlBrick', rectPts(0, 0, l, yb)); B.face('earlWoodL', rectPts(0, yb, l, ye));
        if (l > 6) { const n = Math.round(l / 1.3); for (let k = 0; k < n; k++) { const a = 0.2 + (k * (l - 0.4)) / n; bayWin(a + 0.06, yb + 0.1, a + (l - 0.4) / n - 0.06, ye - 0.12, 0, 0, 1); } }
        if (i === 2) B.unit('doorDark', rectPts(l - 2.0, 0.02, l - 1.0, 2.1), 0.012);      // its door, towards the paved garden (G)
        B.pop(); }
      const m0 = [(g[0][0] + g[3][0]) / 2, (g[0][1] + g[3][1]) / 2], m1 = [(g[1][0] + g[2][0]) / 2, (g[1][1] + g[2][1]) / 2], o = 0.35;
      const ex = (p, m) => { const l = Math.hypot(p[0] - m[0], p[1] - m[1]); return [p[0] + ((p[0] - m[0]) / l) * o, p[1] + ((p[1] - m[1]) / l) * o]; };
      const e = [ex(g[0], m0), ex(g[1], m1), ex(g[2], m1), ex(g[3], m0)], yr = H.gymRidge;
      B.poly('earlCopper', [[e[0][0], ye, e[0][1]], [e[1][0], ye, e[1][1]], [m1[0], yr, m1[1]], [m0[0], yr, m0[1]]], [0, 1, 0]); B.poly('earlCopper', [[e[2][0], ye, e[2][1]], [e[3][0], ye, e[3][1]], [m0[0], yr, m0[1]], [m1[0], yr, m1[1]]], [0, 1, 0]);
      B.flat('earlCopperD', e, ye - 0.02, [], true);
      for (const [p, q, m] of [[e[0], e[3], m0], [e[1], e[2], m1]]) B.poly('earlCopperD', [[p[0], ye, p[1]], [q[0], ye, q[1]], [m[0], yr, m[1]]], [m[0] - (m0[0] + m1[0]) / 2, 0, m[1] - (m0[1] + m1[1]) / 2]);
      for (let k = 1; k < 9; k++) { const t = k / 9, a = [m0[0] + (m1[0] - m0[0]) * t, m0[1] + (m1[1] - m0[1]) * t]; for (const [p, q] of [[e[0], e[1]], [e[3], e[2]]]) { const b = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; B.beam('earlCopperD', [a[0], yr + 0.02, a[1]], [b[0], ye + 0.02, b[1]], 0.05); } }      // standing seams
      // the link: flat-roofed, with a rooflight
      const L = [[0.02, V[4][1]], [V[5][0] + 0.3, V[4][1]], [V[10][0] + 0.3, V[11][1]], [0.02, V[11][1]]];
      const lw = (w, n) => { const pts = [[0, 0, 0], [w, 0, 0], [w, 2.7, 0], [0, 2.7, 0]]; B.poly('earlTimber', pts, [0, 0, n], pts.map((q) => [q[1], q[0]])); };      // (boarded level, as the bays)
      B.push(frame(L[0][0], 0, L[0][1], 1, 0)); lw(L[1][0] - L[0][0], -1); B.pop();
      B.push(frame(L[3][0], 0, L[3][1], 1, 0)); lw(L[2][0] - L[3][0], 1); B.pop();
      B.flat('lead', L, 2.7); B.boxXZ('white', 0.7, 1.5, 2.7, 2.95, V[4][1] + 0.6, V[4][1] + 1.5);
      col.addPolygon(g.map((p) => toWorld(p[0], p[1])), { tag: 'building' }); col.addPolygon(L.map((p) => toWorld(p[0], p[1])), { tag: 'building' }); }
    B.pop();
    // ---- the shell's collider (the map's building is skipped): the ring the faces were drawn on
    const ring = [SW, SE, A0, A1, V[0], V[20], V[19], V[18], V[17], V[16], V[15], V[14], NW];
    col.addPolygon(ring.map((p) => toWorld(p[0], p[1])), { tag: 'building' });
    const grp = new THREE.Group(); grp.name = 'worcester-earl'; world.addStatic(grp);
    const meshes = B.build({}, grp, { pack, noCast: new Set(['signs']) });
    grp.updateMatrixWorld(true);
    const tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
    return { meshes: meshes.length, tris, ring: ring.map((p) => toWorld(p[0], p[1])), gym: [V[6], V[7], V[8], V[9]].map((p) => toWorld(p[0], p[1])), heights: H, attr: EARL_ATTR };
  },
};

// ------------------------------------------------------------------------------------------------ textures
function gridTex() { const { c, g } = canvas(64, 64); g.fillStyle = '#e9e8e3'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#b4b2aa'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 0, 2, 64); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect((i * 37) % 62, (i * 23) % 62, 2, 2); } const t = tex(c); t.repeat.set(1 / 0.6, 1 / 0.6); return t; }
// splashback: grey-blue rectangular tiles, 0.2 x 0.1 m, stretcher bond (one repeat = 0.4 x 0.2 m)
function splashTex() { const { c, g } = canvas(128, 64); g.fillStyle = '#c9cdd0'; g.fillRect(0, 0, 128, 64); const tile = (x, y) => { g.fillStyle = `rgb(${150 + ((x * 7 + y * 13) % 14)},${160 + ((x * 5 + y * 11) % 12)},${172 + ((x * 3 + y * 17) % 12)})`; g.fillRect(x + 1.5, y + 1.5, 61, 29); }; tile(0, 0); tile(64, 0); tile(-32, 32); tile(32, 32); tile(96, 32); const t = tex(c); t.repeat.set(1 / 0.4, 1 / 0.2); return t; }
function hessianTex() { const { c, g } = canvas(64, 64); g.fillStyle = '#b89f72'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 64; i += 2) { g.fillStyle = `rgba(60,40,10,${0.06 + ((i * 7) % 5) * 0.012})`; g.fillRect(i, 0, 1, 64); g.fillRect(0, i, 64, 1); } const t = tex(c); t.repeat.set(1 / 0.12, 1 / 0.12); return t; }
function blindTex() { const { c, g } = canvas(32, 128); g.fillStyle = '#e4685f'; g.fillRect(0, 0, 32, 128); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(0,0,0,0.16)'); gr.addColorStop(0.2, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.06)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 128); for (let y = 6; y < 120; y += 3) { g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(0, y, 32, 1); } g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, 119, 32, 2); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, 121, 32, 7); return tex(c, { wrap: false }); }      // (a faint weave, and the hem pocket with its bar at the bottom)
// one sheet of small signs: door numbers, "Kitchen", the corridor signs, the cleaning rota (plain words; no names)
const SIGN = { W: 512, H: 256 };
function signsTex() {
  const { c, g } = canvas(SIGN.W, SIGN.H), uv = {};
  const cell = (key, x, y, w, h, draw) => { g.save(); g.translate(x, y); draw(w, h); g.restore(); uv[key] = [x / SIGN.W, 1 - (y + h) / SIGN.H, (x + w) / SIGN.W, 1 - y / SIGN.H]; };
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, SIGN.W, SIGN.H);
  const plate = (t) => (w, h) => { g.fillStyle = '#e9e9e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#20242a'; g.font = `bold ${Math.round(h * 0.62)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, w / 2, h / 2 + 1); };
  [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111].forEach((n, i) => cell('n' + n, (i % 8) * 64, Math.floor(i / 8) * 32, 64, 32, plate(String(n))));
  cell('kitchen', 192, 32, 128, 32, plate('Kitchen')); cell('lift', 320, 32, 64, 32, plate('Lift')); cell('store', 384, 32, 64, 32, plate('Store'));
  const blue = (lines) => (w, h) => { g.fillStyle = '#1e4c6e'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle'; lines.forEach((t, i) => { g.font = `${i ? '' : 'bold '}${i ? 17 : 21}px sans-serif`; g.fillText(t, 10, (h / (lines.length + 1)) * (i + 1) + (i ? 3 : 0)); }); };
  cell('up', 0, 64, 256, 64, blue(['↑ First floor', 'Kitchen · Rooms 101–109']));
  cell('gf', 256, 64, 256, 64, blue(['Ground floor', 'Rooms G1–G9 · Kitchen']));
  cell('fl1', 0, 128, 256, 64, blue(['First floor', 'Kitchen → · Rooms 101–109']));
  cell('exit', 256, 128, 128, 48, (w, h) => { g.fillStyle = '#1f9a4a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Fire exit', w / 2, h / 2); });
  cell('rota', 384, 128, 128, 128, (w, h) => {
    g.fillStyle = '#fbfaf4'; g.fillRect(0, 0, w, h); g.fillStyle = '#20242a'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CLEANING ROTA', w / 2, 12);
    g.strokeStyle = '#70747a'; g.lineWidth = 1; for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(8, 24 + i * 13); g.lineTo(w - 8, 24 + i * 13); g.stroke(); } for (let j = 0; j <= 4; j++) { const x = 8 + j * (w - 16) / 4; g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 102); g.stroke(); }
    g.font = '8px sans-serif'; ['Bins', 'Hob', 'Floor', 'Fridge'].forEach((t, j) => g.fillText(t, 8 + (j + 0.5) * (w - 16) / 4, 31)); g.fillStyle = '#2a7a3a'; for (const [i, j] of [[1, 0], [2, 2], [3, 1], [4, 3], [2, 0], [5, 2]]) g.fillText('✓', 8 + (j + 0.5) * (w - 16) / 4, 31 + i * 13);
    g.fillStyle = '#b02a24'; g.font = 'bold 9px sans-serif'; g.fillText('Please wash up after yourself', w / 2, 114);
  });
  return { map: tex(c, { wrap: false }), uv };
}

// ------------------------------------------------------------------------------------------------ interior
export function buildEarl(ctx, game) {
  const S = sharedMats(game), sc = ctx.scene, colF = ctx.collider, colG = ctx.newCollider ? ctx.newCollider() : ctx.collider;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const sg = signsTex();
  const mats = {
    beech: S.beech, signUV: sg.uv,
    wallK: std({ map: wallShade(FF, { skirt: 0.1, skirtCol: '#eeeeea', top: 0.2, bottom: 0.7 }), color: 0xe6e5e4, roughness: 0.92 }),          // kitchen: pale grey, white skirting
    wallR: std({ map: wallShade(FF, { skirt: 0.1, skirtCol: '#eeeeea', top: 0.2, bottom: 0.7, seed: 11 }), color: 0xd7dde2, roughness: 0.92 }),  // rooms: pale blue-grey
    wallC: std({ map: wallShade(FF, { skirt: 0.1, skirtCol: '#8a8d90', top: 0.25, bottom: 0.8, seed: 5 }), color: 0xf1eee7, roughness: 0.9 }),    // corridors, stair
    vinyl: std({ map: speckle(5, 0.16, 2.0), color: 0x7f8b97, roughness: 0.5 }),              // grey-blue sheet vinyl
    carpet: std({ map: speckle(9, 0.3, 1.2), color: 0x5d6672, roughness: 1 }),                // corridor carpet
    carpetR: std({ map: speckle(13, 0.34, 1.1), color: 0x566170, roughness: 1 }),             // rooms: grey-blue
    tiles: std({ color: 0xecebe6, roughness: 0.7 }),
    ceilGrid: std({ map: gridTex(), roughness: 0.95 }),
    maple: std({ map: woodGrain(true, 1.4, true), color: 0xf4ead8, roughness: 0.5 }),         // kitchen units: pale maple laminate
    oakL: std({ map: woodGrain(false, 1, true), color: 0xdcae70, roughness: 0.5 }),           // room furniture: light oak laminate
    pine: std({ map: woodGrain(false, 0.6, true), color: 0xdcae6e, roughness: 0.55 }),        // window frames: clear-finished softwood
    splash: std({ map: splashTex(), roughness: 0.35 }),
    pinboard: std({ map: hessianTex(), roughness: 1 }),
    signs: std({ map: sg.map, roughness: 0.7 }),
    fireDoor: std({ map: woodGrain(true, 1, true), color: 0xd0a468, roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe4ee, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.1, depthWrite: false }),
    blind: std({ map: blindTex(), roughness: 0.95, emissive: 0xe4685f, emissiveIntensity: 0.3, side: THREE.DoubleSide }),
    dome: std({ color: 0xf6f3e6, roughness: 0.4, emissive: 0xfff0c8, emissiveIntensity: 0 }),
    ovenGlow: std({ color: 0x2a2420, roughness: 0.8, emissive: 0xffa040, emissiveIntensity: 0 }),
    paint: std({ vertexColors: true, roughness: 0.62 }),
  };
  const ovenGlass = std({ color: 0x141414, roughness: 0.15, metalness: 0.3, emissive: 0xff8a30, emissiveIntensity: 0 });
  const B = new Batch(), P = new Batch();
  // (the paint batch draws in whatever frame B is in: one transform stack for both)
  Object.defineProperty(P, 'm', { get: () => B.m, set() {} }); P.push = (m) => { B.push(m); return P; }; P.pop = () => { B.pop(); return P; };
  const seg = (cols, x0, z0, x1, z1) => { for (const c of cols) c.addSegment(x0, z0, x1, z1); };
  const F = [colF], Gc = [colG], FG = colG === colF ? [colF] : [colF, colG];
  // wall face from (x0,z0) to (x1,z1), seen from the side of n = (-dz, dx); holes = [[s0, ya, s1, yb]] (s from the start)
  const wall = (key, x0, z0, x1, z1, y0, y1, holes = []) => { const L = Math.hypot(x1 - x0, z1 - z0); B.push(frame(x0, 0, z0, x1 - x0, z1 - z0)); B.face(key, rectPts(0, y0, L, y1), holes.map((h) => rectPts(h[0], h[1], h[2], h[3]))); B.pop(); };
  const rect = (r) => [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];
  // round dome light, flush under a ceiling at y
  const cnt = { domes: 0, detectors: 0, blinds: 0, kitchenDomes: 0, chairs: K.seats.length, rooms: 0, roomSeeds: [] };
  const dome = (x, y, z, r = 0.3) => { cnt.domes++; const ring = (rr, yy) => { const p = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]); } return p; };
    // a shallow bowl: two drums and a flat bottom (seen from below), on a white ceiling ring
    B.cyl('dome', x, y - 0.045, z, r, 0.045, 16, false); B.flat('dome', ring(r, 0), y - 0.045, [ring(r * 0.72, 0)], true); B.cyl('dome', x, y - 0.085, z, r * 0.72, 0.04, 16, false); B.flat('dome', ring(r * 0.72, 0), y - 0.085, [], true);
    P.cyl('white', x, y - 0.012, z, r + 0.035, 0.012, 16, false); P.flat('white', ring(r + 0.035, 0), y - 0.012, [ring(r, 0)], true); };
  const detector = (x, y, z) => { cnt.detectors++; P.cyl('white', x, y - 0.035, z, 0.055, 0.035, 10, false); const p = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; p.push([x + Math.cos(a) * 0.055, z + Math.sin(a) * 0.055]); } P.flat('white', p, y - 0.035, [], true); P.box('red', x + 0.03, y - 0.037, z, 0.008, 0.004, 0.008); };
  // a closed door (leaf, frame, lever, number plate) on a wall frame at s, floor y
  const sdoor = (fr, s, y, num, w = 0.86) => { B.push(fr); B.box('fireDoor', s, y + 1.02, 0.02, w, 2.04, 0.04); B.box('beech', s, y + 2.07, 0.02, w + 0.14, 0.07, 0.06); for (const sx of [-1, 1]) B.box('beech', s + sx * (w / 2 + 0.035), y + 1.035, 0.02, 0.07, 2.07, 0.06);
    P.box('chrome', s + w / 2 - 0.1, y + 1.0, 0.055, 0.12, 0.02, 0.03); P.boxXZ('chrome', s - w / 2 + 0.02, s + w / 2 - 0.02, y + 0.01, y + 0.2, 0.04, 0.043); if (num && sg.uv[num]) B.sign('signs', s - 0.09, y + 1.5, s + 0.09, y + 1.59, 0.045, sg.uv[num]); B.pop(); };
  // the timber lining of a doorway through a thin wall (opening from s0 to s1 along the wall frame fr, thickness t behind it)
  const lining = (fr, s0, s1, y, t = 0.1, h = 2.05) => { B.push(fr); B.boxXZ('beech', s0 - 0.05, s0, y, y + h + 0.05, -t - 0.02, 0.02); B.boxXZ('beech', s1, s1 + 0.05, y, y + h + 0.05, -t - 0.02, 0.02); B.boxXZ('beech', s0 - 0.05, s1 + 0.05, y + h, y + h + 0.05, -t - 0.02, 0.02, { bottom: true }); B.pop(); };

  // ================================================================ GROUND FLOOR (y = 0): the entrance lobby, the stair hall
  const U = FF, TOP = FF + CH, gt = G + CHG, up = new THREE.Matrix4().makeTranslation(0, U, 0);
  B.flat('vinyl', rect(LOBBY), G); B.flat('vinyl', rect(HALL), G);
  B.flat('tiles', rect(LOBBY), gt, [], true); B.flat('tiles', rect(HALL), gt, [], true);
  P.boxXZ('dark', LOBBY.x1 - 1.25, LOBBY.x1 - 0.1, G, G + 0.012, LOBBY.z0 + 0.25, LOBBY.z1 - 0.25);                              // entrance matting
  { const s0 = ENTRANCE.at[1] - ENTRANCE.w / 2 - LOBBY.z0, s1 = s0 + ENTRANCE.w;
    wall('wallC', LOBBY.x1, LOBBY.z0, LOBBY.x1, LOBBY.z1, G, gt, [[s0, G, s1, G + ENTRANCE.h]]);                                // the entrance wall (it faces the lobby)
    B.push(frame(LOBBY.x1, 0, LOBBY.z0, 0, 1)); B.reveal('wallC', rectPts(s0, G, s1, G + ENTRANCE.h), 0, -WALL_T, true); B.pop(); }
  wall('wallC', LOBBY.x0, LOBBY.z0, LOBBY.x1, LOBBY.z0, G, gt);                                                                 // the lobby's east wall
  wall('wallC', HALL.x1, HALL.z0, HALL.x1, LOBBY.z0, G, gt);                                                                    // the hall's south wall beside the lobby
  // "you go in, turn left": the fire door into the corridor, in the wall between the lobby and the corridor (this face;
  // the corridor's own face of that wall is drawn with the corridor)
  { const a = LOBBY.x1 - GDOOR.x1, b = LOBBY.x1 - GDOOR.x0, fr = frame(LOBBY.x1, 0, HALL.z1, -1, 0);
    wall('wallC', LOBBY.x1, HALL.z1, HALL.x0, HALL.z1, G, gt, [[a, G, b, G + 2.05]]);
    lining(fr, a, b, G, CORR.z0 - HALL.z1);
    B.push(fr); B.sign('signs', b + 0.2, G + 2.0, b + 1.4, G + 2.3, 0.02, sg.uv.gf); B.pop(); }
  wall('wallC', STAIR.x0, HALL.z0, HALL.x1, HALL.z0, G, TOP); wall('wallC', LANDING.x0, HALL.z0, STAIR.x0, HALL.z0, U, TOP);    // the foyer's east wall, full height by the stair
  wall('wallC', HALL.x0, HALL.z1, HALL.x0, GALLERY.z0, G, gt);                                                                  // back of the hall (store under the gallery)
  seg(Gc, LOBBY.x1, LOBBY.z0, LOBBY.x1, LOBBY.z1); seg(Gc, LOBBY.x0, LOBBY.z0, LOBBY.x1, LOBBY.z0); seg(Gc, HALL.x1, HALL.z0, HALL.x1, LOBBY.z0); seg(Gc, HALL.x0, HALL.z1, HALL.x0, GALLERY.z0);
  seg(FG, LANDING.x0, HALL.z0, HALL.x1, HALL.z0);
  sdoor(frame(HALL.x0, 0, HALL.z1, 0, -1), 1.2, G, 'store', 0.7);                                                               // store under the stair
  B.push(frame(HALL.x1, 0, HALL.z0, 0, 1)); B.box('pinboard', 0.95, G + 1.5, 0.012, 1.3, 0.8, 0.024); P.box('paper', 0.6, G + 1.55, 0.026, 0.21, 0.3, 0.002); P.box('note', 0.95, G + 1.6, 0.026, 0.15, 0.15, 0.002); P.box('pink', 1.25, G + 1.45, 0.026, 0.21, 0.3, 0.002); B.sign('signs', 0.3, G + 2.05, 1.6, G + 2.37, 0.02, sg.uv.up); B.pop();
  dome((LOBBY.x0 + LOBBY.x1) / 2, gt, 2.9, 0.24); dome(-9.4, gt, 2.5, 0.24);

  // ================================================================ STAIR: one straight flight along the foyer's east wall, up to the first floor
  { const n = STAIR.n, run = (STAIR.x1 - STAIR.x0) / n, rise = FF / n;
    for (let i = 0; i < n; i++) { const xa = STAIR.x1 - run * (i + 1), xb = STAIR.x1 - run * i, y = G + rise * (i + 1);
      B.boxXZ('tiles', xa, xb + 0.02, G + rise * i - (i ? 0.3 : 0), y, STAIR.z0, STAIR.z1, { bottom: true }); P.boxXZ('dark', xb - 0.04, xb + 0.022, y, y + 0.004, STAIR.z0 + 0.03, STAIR.z1 - 0.03); }
    // the flight's soffit hides behind the spandrel wall; the wall on its east side rises to a parapet 1 m over the gallery
    const z0 = STAIR.z1, z1 = GALLERY.z0, L = STAIR.x1 - STAIR.x0, PT = U + 1.0;
    B.push(frame(STAIR.x1, 0, z0, -1, 0)); B.face('wallC', [[0, G], [L, U], [L, PT], [0, PT]]); B.pop();                         // stair side
    wall('wallC', STAIR.x0, z1, HALL.x0, z1, U, PT); wall('wallC', HALL.x0, z1, STAIR.x1, z1, G, PT);                             // gallery / hall side
    wall('wallC', STAIR.x1, z1, STAIR.x1, z0, G, PT);                                                                             // its end, facing the hall
    B.flat('beech', [[STAIR.x0, z0 - 0.02], [STAIR.x1 + 0.02, z0 - 0.02], [STAIR.x1 + 0.02, z1 + 0.02], [STAIR.x0, z1 + 0.02]], PT);    // capping
    seg(FG, STAIR.x0, (z0 + z1) / 2, STAIR.x1, (z0 + z1) / 2);
    // parapet across the top of the hall (the upper hall looks down the flight)
    wall('wallC', STAIR.x1, z0, STAIR.x1, HALL.z0, U, PT); wall('wallC', STAIR.x1 - 0.1, HALL.z0, STAIR.x1 - 0.1, z0, gt, PT);
    B.flat('beech', [[STAIR.x1 - 0.12, HALL.z0], [STAIR.x1 + 0.02, HALL.z0], [STAIR.x1 + 0.02, z0], [STAIR.x1 - 0.12, z0]], PT);
    seg(F, STAIR.x1 - 0.05, HALL.z0, STAIR.x1 - 0.05, z0 + 0.1);
    P.beam('chrome', [STAIR.x1, G + 0.95, STAIR.z0 + 0.06], [STAIR.x0, U + 0.95, STAIR.z0 + 0.06], 0.04); for (let i = 0; i <= 4; i++) { const x = STAIR.x1 - (i / 4) * L; P.box('chrome', x, stairY(x) + 0.93, STAIR.z0 + 0.03, 0.03, 0.03, 0.06); }
    B.flat('tiles', [[LANDING.x0, HALL.z0], [STAIR.x1, HALL.z0], [STAIR.x1, GALLERY.z0], [LANDING.x0, GALLERY.z0]], TOP, [], true);   // ceiling over the stair void
  }

  // ================================================================ THE WING'S CORRIDOR on either floor (drawn at y; y = 0 inside)
  // along the wing's east side. Ground floor: the lobby's fire door in its east wall, the kitchen at its south end,
  // every room door shut. First floor: the door from the gallery at its north end, two study rooms open off it, a shut
  // kitchen door at its south end (that floor's kitchen is not modelled).
  const openR = ROOMS.filter((r) => r.open);
  const wing = (y, cols, upper) => {
    B.push(new THREE.Matrix4().makeTranslation(0, y, 0));
    B.flat('carpet', rect(CORR), 0); B.flat('tiles', rect(CORR), CH, [], true);
    { const D = upper ? UDOOR : GDOOR, a = D.x0 - CORR.x0, b = D.x1 - CORR.x0, zm = (HALL.z1 + CORR.z0) / 2;                     // east side, its one door
      wall('wallC', CORR.x0, CORR.z0, CORR.x1, CORR.z0, 0, CH, [[a, 0, b, 2.05]]);
      seg(cols, CORR.x0, zm, D.x0, zm); seg(cols, D.x1, zm, CORR.x1, zm);
      B.push(frame(CORR.x0, 0, CORR.z0, 1, 0)); B.sign('signs', a - 0.9, 2.12, a - 0.26, 2.36, 0.02, sg.uv.exit); B.pop(); }
    wall('wallC', CORR.x0, CORR.z1, CORR.x0, CORR.z0, 0, CH); seg(cols, CORR.x0, CORR.z0, CORR.x0, CORR.z1);                    // north end
    // west side: the study rooms (two are modelled, upstairs)
    { const open = (upper ? openR : []).slice().sort((p, q) => p.x0 - q.x0), holes = open.map((r) => { const [a, b] = doorOf(r); return [CORR.x1 - b, 0, CORR.x1 - a, 2.05]; });
      wall('wallC', CORR.x1, CORR.z1, CORR.x0, CORR.z1, 0, CH, holes);
      let x = CORR.x0; for (const r of open) { const [a, b] = doorOf(r); seg(cols, x, CORR.z1, a, CORR.z1); x = b; } seg(cols, x, CORR.z1, CORR.x1, CORR.z1);
      const fr = frame(CORR.x1, 0, CORR.z1, -1, 0);
      for (const r of ROOMS) { const [a, b] = doorOf(r), s = CORR.x1 - (a + b) / 2; if (upper && r.open) { lining(fr, CORR.x1 - b, CORR.x1 - a, 0, PASS_Z[0] - CORR.z1); B.push(fr); B.sign('signs', CORR.x1 - a + 0.09, 1.5, CORR.x1 - a + 0.27, 1.59, 0.012, sg.uv['n' + r.n]); B.pop(); } else sdoor(fr, s, 0, upper ? 'n' + r.n : null, 0.85); } }
    if (upper) {      // the south end of the first-floor corridor: that floor's kitchen, its door shut
      wall('wallC', CORR.x1, CORR.z0, CORR.x1, CORR.z1, 0, CH); seg(cols, CORR.x1, CORR.z0, CORR.x1, CORR.z1);
      const fk = frame(CORR.x1, 0, CORR.z0, 0, 1), sk = (KIT.door[0] + KIT.door[1]) / 2 - CORR.z0; sdoor(fk, sk, 0, null, 0.9);
      B.push(fk); B.sign('signs', sk - 0.22, 2.14, sk + 0.22, 2.25, 0.012, sg.uv.kitchen); B.pop();
    }
    for (let x = CORR.x0 + 1.4; x < CORR.x1 - 0.8; x += 3.1) dome(x, CH, (CORR.z0 + CORR.z1) / 2, 0.24);
    detector(-10.5, CH, 4.85);
    B.pop();
  };
  wing(0, Gc, false);
  wing(U, F, true);

  // ================================================================ FIRST FLOOR (y = FF): landing, gallery, upper hall
  B.push(up);
  for (const r of [LANDING, GALLERY, UPHALL]) B.flat('carpet', rect(r), 0);
  for (const r of [{ x0: LANDING.x0, x1: GALLERY.x1, z0: GALLERY.z0, z1: GALLERY.z1 }, UPHALL]) B.flat('tiles', rect(r), CH, [], true);
  wall('wallC', LANDING.x0, LANDING.z1, LANDING.x0, LANDING.z0, 0, CH);                         // the foyer's north end
  { const a = UPHALL.x1 - UDOOR.x1, b = UPHALL.x1 - UDOOR.x0, fr = frame(UPHALL.x1, 0, UPHALL.z1, -1, 0);      // the wall to the corridor: its door at the corridor's north end (ADP)
    wall('wallC', UPHALL.x1, UPHALL.z1, LANDING.x0, UPHALL.z1, 0, CH, [[a, 0, b, 2.05]]); lining(fr, a, b, 0, CORR.z0 - UPHALL.z1); }
  wall('wallC', UPHALL.x1, UPHALL.z0, UPHALL.x1, UPHALL.z1, 0, CH);                             // its south end (ADP: the comms room beyond)
  seg(F, LANDING.x0, LANDING.z1, LANDING.x0, LANDING.z0); seg(F, UPHALL.x1, UPHALL.z0, UPHALL.x1, UPHALL.z1);
  sdoor(frame(LANDING.x0, 0, LANDING.z1, 0, -1), 1.3, 0, null); sdoor(frame(UPHALL.x1, 0, UPHALL.z0, 0, 1), 2.6, 0, null, 0.8);
  B.push(frame(UPHALL.x1, 0, UPHALL.z0, 0, 1)); B.sign('signs', 0.5, 1.55, 1.8, 1.87, 0.02, sg.uv.fl1); B.pop();
  P.box('green', LANDING.x0 + 0.05, 2.2, 0.6, 0.02, 0.14, 0.36);
  for (const [x, z] of [[-15.3, 2.0], [-12.0, 2.75], [-8.7, 2.0]]) dome(x, CH, z, 0.24);
  detector(-11.0, CH, 2.8);
  B.pop();

  // ================================================================ KITCHEN, GROUND FLOOR (the end of the corridor, across the end of the wing)
  { const { x0: kx0, x1: kx1, z0: kz0, z1: kz1 } = KIT, [da, db] = KIT.door, [Wb, We] = WINDOWS;
    B.flat('vinyl', [[kx0, kz0], [kx1, kz0], [kx1, kz1], [kx0, kz1]], 0);
    B.flat('ceilGrid', [[kx0, kz0], [kx1, kz0], [kx1, kz1], [kx0, kz1]], CH, [], true);
    // corridor wall: both faces, the doorway
    wall('wallC', kx0, CORR.z0, kx0, CORR.z1, 0, CH, [[da - CORR.z0, 0, db - CORR.z0, 2.05]]);
    wall('wallK', kx0, kz1, kx0, kz0, 0, CH, [[kz1 - db, 0, kz1 - da, 2.05]]);
    lining(frame(kx0, 0, CORR.z0, 0, 1), da - CORR.z0, db - CORR.z0, 0, 0.0);
    B.push(frame(kx0, 0, CORR.z0, 0, 1)); B.sign('signs', (da + db) / 2 - CORR.z0 - 0.22, 2.14, (da + db) / 2 - CORR.z0 + 0.22, 2.25, 0.012, sg.uv.kitchen); B.pop();
    seg(Gc, kx0, kz0, kx0, da); seg(Gc, kx0, db, kx0, kz1);
    // window wall with the long window (three bays, coral roller blinds drawn most of the way down)
    { const s0 = Wb.at[1] - Wb.w / 2 - kz0, s1 = s0 + Wb.w;
      wall('wallK', kx1, kz0, kx1, kz1, 0, CH, [[s0, Wb.y0, s1, Wb.y1]]);
      B.push(frame(kx1, 0, kz0, 0, 1));
      timberWindow(B, P, s0, s1, Wb.y0, Wb.y1, WALL_T + Wb.bay, [1 / 3, 2 / 3], Wb.tr, { reveal: 'wallK' });      // (glazed at the front of the bay: a deep sill)
      for (let i = 0; i < 3; i++) { const a = s0 + (Wb.w / 3) * i + 0.07, b = a + Wb.w / 3 - 0.14, drop = [0.27, 0.3, 0.26][i];
        cnt.blinds++;
        B.push(new THREE.Matrix4().makeTranslation(0, 0, -WALL_T * 0.3)); B.sign('blind', a, Wb.y0 + drop, b, Wb.y1 - 0.05, 0, [0, 0, 1, 1]); B.pop();
        P.box('offwhite', (a + b) / 2, Wb.y1 - 0.04, -WALL_T * 0.3, b - a + 0.04, 0.05, 0.05); P.box('offwhite', (a + b) / 2, Wb.y0 + drop, -WALL_T * 0.3, b - a, 0.02, 0.015); }
      B.pop(); }
    // end wall: the timber window (two panes over small opening lights)
    { const s0 = kx1 - (We.at[0] + We.w / 2), s1 = s0 + We.w;
      wall('wallK', kx1, kz1, kx0, kz1, 0, CH, [[s0, We.y0, s1, We.y1]]);
      B.push(frame(kx1, 0, kz1, -1, 0)); timberWindow(B, P, s0, s1, We.y0, We.y1, WALL_T, [0.5], 0.38, { reveal: 'wallK' }); B.pop(); }
    { const Wk = WINDOWS.find((w) => w.id === 'kitEast'), s0 = Wk.at[0] - Wk.w / 2 - kx0, s1 = s0 + Wk.w;      // the door-end wall: the window in the timber bay (ADP)
      wall('wallK', kx0, kz0, kx1, kz0, 0, CH, [[s0, Wk.y0, s1, Wk.y1]]);
      B.push(frame(kx0, 0, kz0, 1, 0)); timberWindow(B, P, s0, s1, Wk.y0, Wk.y1, WALL_T + Wk.bay, [0.5], Wk.tr, { reveal: 'wallK' }); B.pop(); }
    seg(Gc, kx1, kz0, kx1, kz1); seg(Gc, kx1, kz1, kx0, kz1); seg(Gc, kx0, kz0, kx1, kz0);
    // ceiling: two rows of round dome lights, detectors
    { const n0 = cnt.domes; for (const x of [-1.7, -3.5]) for (const z of [5.15, 7.25, 9.35]) dome(x, CH, z, 0.3); cnt.kitchenDomes = cnt.domes - n0; }
    detector(-2.6, CH, 5.3); detector(-2.6, CH, 7.7); detector(-3.4, CH, 9.9);
    P.box('white', kx0 + 0.03, 2.2, 5.62, 0.05, 0.1, 0.1);                                                                      // sounder
    kitchenFittings(B, P, colG, mats);
  }

  // ================================================================ STUDY ROOMS, FIRST FLOOR (two modelled: the photograph's room, with different clutter)
  // on the wing's west side: the window in the west face, the room's entry (beside its en-suite pod) from the corridor
  B.push(up);
  for (const r of openR) {
    const a = r.x0, b = r.x1, zW = ROOM_Z[0], zI = ROOM_Z[1], [p0, p1] = passOf(r), [d0, d1] = doorOf(r), Wn = WINDOWS.find((w) => w.id === 'room' + r.n), zP = PASS_Z[0];
    B.flat('carpetR', [[a, zI], [b, zI], [b, zW], [a, zW]], 0); B.flat('tiles', [[a, zI], [b, zI], [b, zW], [a, zW]], CH, [], true);
    B.flat('carpetR', [[p0, zP], [p1, zP], [p1, zI], [p0, zI]], 0); B.flat('tiles', [[p0, zP], [p1, zP], [p1, zI], [p0, zI]], CH, [], true);
    wall('wallR', a, zW, a, zI, 0, CH); wall('wallR', b, zI, b, zW, 0, CH);                                                       // side walls
    wall('wallR', a, zI, b, zI, 0, CH, [[p0 - a, 0, p1 - a, 2.3]]);                                                               // its inner end: the entry comes in at the -x side
    wall('wallR', p0, zI, p0, zP, 0, CH); wall('wallR', p1, zP, p1, zI, 0, CH);                                                   // the entry's sides
    wall('wallR', p0, zP, p1, zP, 0, CH, [[d0 - p0, 0, d1 - p0, 2.05]]);                                                         // the corridor wall's back, the door in it
    { const s0 = b - (Wn.at[0] + Wn.w / 2), s1 = s0 + Wn.w; wall('wallR', b, zW, a, zW, 0, CH, [[s0, Wn.y0, s1, Wn.y1]]); B.push(frame(b, 0, zW, -1, 0)); timberWindow(B, P, s0, s1, Wn.y0, Wn.y1, WALL_T, [1 / 3, 2 / 3], 0.42, { reveal: 'wallR' }); /* (three lights: behind the three of the outside's frame) */ B.pop(); }
    seg(F, a, zW, a, zI); seg(F, b, zI, b, zW); seg(F, a, zW, b, zW); seg(F, a, zI, p0, zI); seg(F, p1, zI, b, zI); seg(F, p0, zI, p0, zP); seg(F, p1, zP, p1, zI);
    dome((a + b) / 2 - 0.3, CH, zW - 1.6, 0.24); detector(b - 1.2, CH, zW - 3.0);
    studyRoom(B, P, colF, r, r.seed); cnt.rooms++; cnt.roomSeeds.push(r.seed);
  }
  B.pop();

  // ================================================================ build: one mesh per textured material + the paint mesh
  buildBatch(B, sc, mats);
  paintMesh(P, sc, mats.paint);

  // ---------------- doors (core/_doors.js): the automatic entrance, the corridor fire door, the kitchen door, the room doors
  const alu = std({ color: 0xb4b8bc, metalness: 0.6, roughness: 0.35 }), dglass = new THREE.MeshStandardMaterial({ color: 0xbfd6e2, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
  const dm = { leaf: mats.fireDoor, handle: alu, glass: dglass, frame: alu, plate: alu };
  const doors = {};
  if (ctx.addDoor) {
    doors.entrance = ctx.addDoor({ kind: 'slide', style: 'glass', at: [ENTRANCE.at[0] + WALL_T * 0.5, ENTRANCE.at[1]], y: G, w: ENTRANCE.w, h: ENTRANCE.h, dir: S0, mats: dm, portal: 0, rangeOut: 4.2, rangeIn: 2.0, hold: 1.2 });      // (the sensor reaches the edge of the canopy)
    const vp = [0.52, 0.72, 0.95, 1.75], gnd = [colG], fst = [colF], zm = (HALL.z1 + CORR.z0) / 2;
    // ground floor: lobby -> corridor (two-way; hung on its north jamb, so that open into the corridor it lies clear of the way to the kitchen), the kitchen door (opens into the kitchen)
    doors.lobby = ctx.addDoor({ kind: 'hinged', style: 'fire', at: [GDOOR.x0, zm], y: G, w: GDOOR.x1 - GDOOR.x0, h: 2.04, dir: E, swing: 0, closer: true, vision: vp, mats: dm, colliders: gnd });
    doors.kitchen = ctx.addDoor({ kind: 'hinged', style: 'fire', at: [KIT.x0, KIT.door[0]], y: G, w: KIT.door[1] - KIT.door[0], h: 2.04, dir: S0, swing: 1, closer: true, vision: vp, mats: dm, colliders: gnd });
    // first floor: the gallery's door into the corridor, and the study rooms' doors (they open into the room's entry)
    doors.corridorUp = ctx.addDoor({ kind: 'hinged', style: 'fire', at: [UDOOR.x0, zm], y: U, w: UDOOR.x1 - UDOOR.x0, h: 2.04, dir: E, swing: 0, closer: true, vision: vp, mats: dm, colliders: fst });
    for (const r of openR) { const [d0, d1] = doorOf(r); doors['room' + r.n] = ctx.addDoor({ kind: 'hinged', style: 'fire', at: [d0, CORR.z1 + 0.05], y: U, w: d1 - d0, h: 2.04, dir: E, swing: -1, closer: true, plate: true, plateSides: [1], mats: dm, colliders: fst }); }
    if (ctx.portalColliders) ctx.portalColliders(0, gnd);      // (the entrance is a way through the ground floor's wall only)
  }

  // ---------------- un-merged oven parts (animated by friends.js): door on a bottom hinge, timer display
  const doorMat = std({ color: 0x111111, roughness: 0.6 }), steelM = std({ color: 0x9a9ea2, metalness: 0.7, roughness: 0.3 }), ov = K.oven;
  const pivot = new THREE.Group(); pivot.position.set(ov.x, ov.y0, ov.z); pivot.name = 'earl:ovenDoor';
  const dh = ov.y1 - ov.y0;
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); pivot.add(m); return m; };
  mk(new THREE.BoxGeometry(0.035, dh, ov.w - 0.01), doorMat, 0.018, dh / 2, 0);
  mk(new THREE.BoxGeometry(0.008, dh * 0.55, ov.w * 0.7), ovenGlass, 0.038, dh * 0.52, 0);
  mk(new THREE.BoxGeometry(0.02, 0.02, ov.w * 0.78), steelM, 0.075, dh * 0.86, 0);
  for (const dz of [-0.2, 0.2]) mk(new THREE.BoxGeometry(0.04, 0.015, 0.015), steelM, 0.055, dh * 0.86, dz);
  sc.add(pivot);
  const tc = canvas(96, 40), timerTex = tex(tc.c, { wrap: false });
  const timer = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.055), new THREE.MeshBasicMaterial({ map: timerTex }));
  timer.position.set(K.unitsX + 0.004, 0.81, K.oven.z); timer.rotation.y = Math.PI / 2; timer.name = 'earl:ovenTimer';
  sc.add(timer);
  let timerText = null;
  const setTimer = (text) => {
    if (text === timerText) return; timerText = text;
    const g = tc.g; g.fillStyle = '#0a0c0a'; g.fillRect(0, 0, 96, 40);
    g.fillStyle = text ? '#5cff7a' : '#1d3a22'; g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text || '88:88', 48, 21); timerTex.needsUpdate = true;
  };
  setTimer('');

  // ---------------- floors: the two storeys overlap in plan almost everywhere (the lobby and the corridor are on both),
  // so the level is carried: it changes on the stair, and where only the first floor exists (the landing, the gallery) it is that
  let lvl = 0;
  const foyer = (x, z) => z < (HALL.z1 + CORR.z0) / 2;      // (east of the corridor's wall: the lobby, the stair hall and, above them, landing / gallery / upper hall)
  const onStair = (x, z) => x > STAIR.x0 && x < STAIR.x1 && z < STAIR.z1 + 0.08;
  const upOnly = (x, z) => foyer(x, z) && (x <= STAIR.x0 || (x < HALL.x0 && !onStair(x, z)));
  const level = (p) => { const x = p.pos.x, z = p.pos.z; if (onStair(x, z)) lvl = p.pos.y > G + FF / 2 ? 1 : 0; else if (upOnly(x, z)) lvl = 1; return lvl; };
  ctx.setGround((x, z) => { if (onStair(x, z)) return stairY(x); if (upOnly(x, z)) return U; return lvl ? U : G; });
  if (ctx.setCollider) ctx.setCollider((p) => (level(p) ? colF : colG));

  const { amb, hemi } = ambientOf(sc);
  const l1 = addPoint(sc, -7.6, G + 2.2, 2.7, 0xfff6e8, 2.6, 9), l2 = addPoint(sc, -10.5, CH - 0.3, 4.85, 0xfff6e8, 3.0, 12);
  const l3 = addPoint(sc, -2.5, CH - 0.3, 7.2, 0xfff4e0, 4.0, 11), l4 = addPoint(sc, -13.2, U + CH - 0.3, 2.4, 0xfff6e8, 2.6, 9), l5 = addPoint(sc, -10.5, U + CH - 0.3, 4.85, 0xfff6e8, 3.0, 12);
  const bedR = openR[0];
  return {
    spawn: [ENTRANCE.at[0] - 0.9, ENTRANCE.at[1]], heading: Wd, exit: [ENTRANCE.at[0] - 0.5, ENTRANCE.at[1]],
    /** 0 = the ground floor (the entrance, the corridor, the kitchen), 1 = the first floor (the study rooms) */
    setLevel(v) { lvl = v ? 1 : 0; }, get level() { return lvl; }, counts: cnt, firstFloorY: U,
    // kitchenSeats[0] and `hob` are used by worcester_interiors.js for the generic flatmates (a sitter + someone at the microwave)
    kitchenSeats: K.seats, kettle: K.kettle, hob: K.microwave, bed: [bedR.x0 + 1.3, U, ROOM_Z[0] - 1.3], doors, colliders: { ground: colG, first: colF },
    oven: { pivot, glass: ovenGlass, glow: mats.ovenGlow, setTimer },
    /** d = daylight 0..1: the ceiling lights come on as it gets dark; the blinds glow with the day behind them */
    setLight(d) {
      const n = 1 - Math.min(1, Math.max(0, (d - 0.25) / 0.4));
      mats.dome.emissiveIntensity = 1.5 * n; mats.blind.emissiveIntensity = 0.06 + 0.5 * d;
      if (amb) amb.intensity = 0.36 + d * 0.3; if (hemi) hemi.intensity = 0.28 + d * 0.24;
      l1.intensity = 1.2 + 1.6 * n; l2.intensity = 1.2 + 2.0 * n; l3.intensity = 1.0 + 3.6 * n; l4.intensity = 1.2 + 1.6 * n; l5.intensity = 1.2 + 2.0 * n;
    },
  };
}
