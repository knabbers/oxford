// The Ashmolean as a walk-in building: the PLAN (pure numbers: no three, no DOM), shared by the room
// (_mus_ash_interior.js, _mus_ash_atrium.js), the outside (_mus_ash_front.js), ashmolean.js and tools/smoke_museums.mjs.
//
// Coordinates are the portico frame of ashmolean.js (FRAME): origin = the middle of the portico's front line on the
// ground of the forecourt, +x = east, +z = SOUTH (out of the building, to Beaumont Street). The room's own (local)
// coordinates are the same numbers, with y = 0 the museum's ground floor = the top of the portico's podium.
//
// What is researched (the museum's own printed floor plan of c. 2011-13 and its cross-section; a 2014 photograph of the
// Beaumont Street front): the entrance through the portico into Cockerell's front range; the Greek and Roman sculpture
// gallery (gallery 21) running WEST from the entrance along the forecourt, lit by one high window in each bay; the
// information desk east of the entrance; Egypt at the west end of the sculpture gallery; an orientation gallery straight
// ahead and the top-lit atrium with the cascading stair beyond it; Mather's floors behind (G, 1, 2, 3) with only G and
// "2" in Cockerell's range (the upper front galleries are top-lit: no upper windows on the forecourt); England 400-1600
// (the Alfred Jewel) and Music and Tapestry (the "Messiah" violin) on level 2 west of the atrium, Western art over the
// front range; the restaurant on the roof.
// What is GUESSED: every dimension (scaled off the plan against the mapped outline: ± a metre or two); the atrium as a
// straight well 16 m wide with three alternating flights (the real stair cascades along a curved wall); storey heights
// (4.4 m, to keep three floors under the mapped shell's roof); level 3 (special exhibitions) and the lower ground floor
// (café, shop) are left out — the stair goes G, 1, 2 and then to the rooftop restaurant; the cast gallery is put in the
// north-west room (the real one is the separate block just beyond that wall); the east ground gallery's contents.
export const ASH_PLAN = {
  LV: [0, 4.4, 8.8, 13.05],        // floor heights (room y): G, 1, 2, the roof (the restaurant pavilion: the shell's roof deck is at 13.0)
  SH: 4.4, CEIL: 4.05, DOOR: 3.4,  // storey, ceiling above a floor, height of an internal doorway
  PODIUM: 1.2,                     // room y = 0 above the forecourt
  ZF: -4.4,                        // inside face of Cockerell's front wall
  ZH: -12.8,                       // back of the front range = south end of the atrium
  ZM: -30,                         // between the two west ground-floor galleries
  ZN: -49.4,                       // inside face of the north wall = north end of the atrium
  WX: -30, HW: 8, EX: 16,          // west wall of the west galleries; half-width of the atrium; east wall
  FW: -21.35, FE: 21.5,            // the ends of the front range (the sculpture gallery … the information hall)
  EGW: -37.5,                      // west wall of Egypt (beyond the west end of the sculpture gallery)
  RZ: -27.4, ROOF: 16.55,          // the restaurant's south (glass) wall; the atrium's roof light
  // the front door (in the wall behind the portico) and the forecourt windows: one per bay of Cockerell's range
  door: { x: 0, w: 2.8, h: 5.5, leaf: 2.5, depth: 1.28 },
  bay: 3.71, winW: 2.1, winY0: 3.4, winY1: 4.7,
  // the outside faces (frame z) of the front wall: behind the portico, west of it, east of it (the mapped line is
  // not straight — z -3.30 at the west end of the portico, -3.79 at the east end of the range — and the generic wall
  // drawn on it has window surrounds that stand proud: the hand-built faces stand 0.2-0.7 m in front of it)
  faceZ: { mid: -3.12, w: -3.10, e: -3.10 }, faceX: 7.1,
};
const P = ASH_PLAN;
/** the forecourt windows: [{ x (centre), z (outside face), depth (room wall face -> outside face) }] west then east */
export const ASH_WINDOWS = [-4, -3, -2, -1, 1, 2, 3, 4].map((i) => { const s = Math.sign(i), x = s * (6.81 + (Math.abs(i) - 0.5) * P.bay), z = s < 0 ? P.faceZ.w : P.faceZ.e; return { x, z, depth: +(z - P.ZF).toFixed(3) }; });

/** the rooms as rectangles [x0, z0, x1, z1] (inside wall faces): what must fit inside the mapped outline */
export const ASH_RECTS = [
  [P.FW, P.ZH, P.FE, P.ZF],          // Cockerell's front range (the hall: sculpture gallery, entrance, information)
  [P.EGW, P.ZH, P.FW, P.ZF],         // Egypt
  [P.WX, P.ZN, P.EX, P.ZH],          // Mather's building: the west galleries, the atrium, the east galleries
];
/** the inside of the building, storey by storey (core/interiors.js `bounds`: which room a person / the camera is in) */
export const ASH_BOUNDS = [
  { x0: P.FW, x1: P.FE, z0: P.ZH, z1: P.ZF, y0: -0.2, y1: P.LV[2] - 0.35 },            // the hall (two storeys high)
  { x0: P.EGW, x1: P.FW, z0: P.ZH, z1: P.ZF, y0: -0.2, y1: P.CEIL },                   // Egypt
  { x0: P.WX, x1: P.EX, z0: P.ZN, z1: P.ZH, y0: -0.2, y1: P.LV[3] - 0.35 },            // G, 1, 2 behind
  { x0: -P.HW, x1: P.HW, z0: P.ZN, z1: P.ZH, y0: P.LV[3] - 0.35, y1: P.ROOF },         // the atrium's lantern
  { x0: P.FW, x1: P.FE, z0: P.ZH, z1: P.ZF, y0: P.LV[2] - 0.35, y1: P.LV[3] - 0.35 },  // the galleries over the hall
  { x0: P.HW, x1: P.EX, z0: P.ZN, z1: P.RZ, y0: P.LV[3] - 0.35, y1: P.LV[3] + 3.4 },   // the rooftop restaurant
];
/** zones (the room's merged meshes are cut by these so whole storeys are culled) */
export const ASH_ZONES = [
  { x0: -60, x1: 40, z0: P.ZH, z1: 0, y0: -1, y1: P.LV[2] - 0.2 },
  { x0: -60, x1: 40, z0: -60, z1: P.ZH, y0: -1, y1: P.LV[1] - 0.2 },
  { x0: -60, x1: 40, z0: -60, z1: P.ZH, y0: P.LV[1] - 0.2, y1: P.LV[2] - 0.2 },
  { x0: -60, x1: 40, z0: -60, z1: 0, y0: P.LV[2] - 0.2, y1: P.LV[3] - 0.2 },
  { x0: -60, x1: 40, z0: -60, z1: 0, y0: P.LV[3] - 0.2, y1: 30 },
];
/** the rooftop restaurant's glass walls (real openings on to the roofs of the city): east and south */
export const ASH_ROOF_GLASS = [
  { at: [P.EX, (P.ZN + 2 + P.RZ - 2) / 2], out: Math.PI / 2, w: P.RZ - 2 - (P.ZN + 2), y0: P.LV[3] + 0.06, y1: P.LV[3] + 2.9, depth: 0.25, roof: true },
  { at: [(P.HW + P.EX) / 2, P.RZ], out: 0, w: P.EX - P.HW - 1.2, y0: P.LV[3] + 0.06, y1: P.LV[3] + 2.9, depth: 0.25, roof: true },
];
/** the mapped outline (world points) with the front where the hand-built faces stand -> the shell the plan must fit (world points). l / w = frame conversions */
export function ashShell(poly, l, w) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = l(p[0], p[1]);
    // the two corners where the portico's projection met the wall, and the two ends of the front
    if (Math.abs(q[1] + 3.5) < 0.5 && Math.abs(Math.abs(q[0]) - 6.92) < 0.3) {
      const s = Math.sign(q[0]), side = [s * P.faceX, s < 0 ? P.faceZ.w : P.faceZ.e], mid = [s * P.faceX, P.faceZ.mid];
      const pr = poly[(i + poly.length - 1) % poly.length], pq = l(pr[0], pr[1]), fromOut = Math.abs(pq[0]) > P.faceX && Math.sign(pq[0]) === s;
      for (const c of fromOut ? [side, mid] : [mid, side]) out.push(w(c[0], c[1]));
      continue;
    }
    if (Math.abs(q[1] + 3.5) < 0.5 && q[0] < -20 && q[0] > -23) { out.push(w(q[0], P.faceZ.w)); continue; }
    if (Math.abs(q[1] + 3.6) < 0.5 && q[0] > 22 && q[0] < 25) { out.push(w(q[0], P.faceZ.e)); continue; }
    out.push([p[0], p[1]]);
  }
  return out;
}
