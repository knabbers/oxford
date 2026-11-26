// Worcester College Cellar Bar — THE WAY DOWN from Pump Quad to its doors (pure data, no three.js). Read by the court's
// builder (places/_worcester_pump.js: the outer flight, the area at its foot, the lobby in the annex, all OUTDOOR
// geometry), by the bar's plan (places/_bar_plan.js: where the double doors are, the levels) and by the friends'
// walking graph.
//
// From the college's fire plan of the bar (reference/worcester/00 college maps/Cellar-Bar-GEEP-plan-p2.png), read at
// 90 px to the metre and anchored on the main block's true plan (WORC_BLOCK). The plan is drawn SOUTH UP: Pump Quad at
// the top, the loggia on the right (its exit arrow runs west to "Arcway 12"; its westmost room, the "Hall Wine Cellar",
// is 4.9 m wide like the loggia above it; the pool room is "one stone step up on the left inside" only in that reading).
//
//   Pump Quad's court, 59.8 mOD
//   |  THE OUTER FLIGHT: 1.4 m wide, in the court's north-east corner, under the glazed canopy, going down NORTH.
//   |  K: where its foot is, its width and direction (the plan draws the area and marks "Up" at its south end; the
//   |  satellite view and LIDAR have the glass over it; the owner, 2026-11-22: "it should start from near the corner of
//   v  the pump quad (closest to the main street) and it should have a canopy atop it"). G: nine risers.
//   THE AREA at its foot, against the Hall's wall, under the glass (K)
//   <- left (west) through an opening into THE LOBBY IN THE ANNEX, 2.9 x 2.1 m, under the annex's flat roof (K: the
//      plan; LIDAR has the 4.4 m roof over it); the Bar Store's door in its west wall
//   v  right (north): DOUBLE DOORS in the Hall's south wall, 1.25 m; the wall is 1.34 m thick; three steps down inside
//      (K: the plan draws two treads there and "Up"; the college: "down two short flights of steps")
import { WORC_LEVELS, WORC_BLOCK } from './_worcester_shared.js';
const r4 = (x) => +x.toFixed(4);
const VS = WORC_BLOCK.vS, PQY = WORC_LEVELS.pumpQuad;

// the cellar's south-east inner corner (the plan's origin here): 1.3 m inside the wing's street face, 1.34 m inside
// its south face
export const CELLAR_SE = { u: 26.7, v: r4(VS - 1.34) };
/** fire-plan metres (a: west of that corner, b: north of it) -> college local (u, v) */
export const planUV = (a, b) => [r4(CELLAR_SE.u - a), r4(CELLAR_SE.v - b)];

// levels (world y): twelve risers of 0.17 m from the court to the bar's floor, nine outside and three inside (G; with
// them a 3 m vault's crown is 0.6 m under the Hall's floor)
const RISE = 0.17;
export const LEVEL = { court: PQY, yard: r4(PQY - 9 * RISE), floor: r4(PQY - 12 * RISE), rise: RISE };

export const OUT = {
  flight: { u0: 18.15, u1: 19.55, vHead: 23.8, vFoot: 21.55, n: 9 },      // head on the court's flags, at the canopy's eaves
  area: { u0: 18.15, u1: 19.55, v0: r4(VS + 0.04), v1: 21.55 },
  lobby: { u0: 15.05, u1: 18.0, v0: r4(VS + 0.04), v1: 21.25, h: 2.6 },    // h: its ceiling above its floor (G)
  gap: { v0: 20.05, v1: 21.05, h: 2.05 },                                   // the opening between the area and the lobby, in the wall u lobby.u1 .. area.u0
  store: { v0: 20.2, v1: 21.0, h: 2.0 },                                    // the Bar Store's door, in the lobby's west wall (shut)
  // the double doors through the Hall's south wall: the opening, its head above the yard's floor, how far in from
  // the wall's outer face the leaves hang
  door: { u0: 15.2, u1: 16.45, h: 2.1, vOut: VS, vIn: CELLAR_SE.v, recess: 0.3 },
  // the splayed window of the bar's main room in the same wall, just east of the flight, in the court's corner:
  // 1.7 m wide outside (world y of its sill and head: just above the court)
  window: { u0: planUV(7.3, 0)[0], u1: planUV(5.6, 0)[0], y0: r4(PQY + 0.2), y1: r4(PQY + 1.0), uIn: [planUV(7.8, 0)[0], planUV(5.1, 0)[0]] },
  y: LEVEL.yard,
};
OUT.door.top = r4(LEVEL.yard + OUT.door.h);

/** the ground on the way down at local (u, v): world y, or null off it */
export function outY(u, v) {
  const F = OUT.flight, A = OUT.area, L = OUT.lobby, D = OUT.door;
  if (u > F.u0 && u < F.u1 && v >= F.vFoot && v < F.vHead) return r4(LEVEL.court - (LEVEL.court - LEVEL.yard) * (F.vHead - v) / (F.vHead - F.vFoot));
  if (u > A.u0 && u < A.u1 && v > A.v0 - 0.1 && v < A.v1) return LEVEL.yard;
  if (u > L.u0 && u <= A.u0 && v > L.v0 - 0.1 && v < L.v1) return LEVEL.yard;
  if (u > D.u0 && u < D.u1 && v > D.vIn - 0.3 && v <= VS + 0.05) return LEVEL.yard;      // the doorway (the three steps down are inside the leaves: the room's own)
  return null;
}
/** every tread of the outer flight from its head down: [v0, v1, world y of its top] (the ninth riser lands on the area) */
export const OUT_TREADS = (() => { const F = OUT.flight, w = (F.vHead - F.vFoot) / (F.n - 1), o = []; for (let k = 1; k < F.n; k++) o.push([r4(F.vHead - w * k), r4(F.vHead - w * (k - 1)), r4(LEVEL.court - RISE * k)]); return o; })();
/** for actors that walk here themselves (places/friends.js): the way down in the LOCAL frame [u, v, world y], from the flags at the head of the flight to just outside the double doors */
export const OUT_PATH = (() => {
  const F = OUT.flight, uf = (F.u0 + F.u1) / 2, G = OUT.gap, gv = (G.v0 + G.v1) / 2, D = OUT.door, ud = (D.u0 + D.u1) / 2;
  return [[uf, F.vHead + 0.6, LEVEL.court], [uf, F.vHead, LEVEL.court], [uf, F.vFoot, LEVEL.yard], [uf, gv, LEVEL.yard], [OUT.lobby.u1 - 0.5, gv, LEVEL.yard], [ud, gv - 0.2, LEVEL.yard], [ud, VS + 0.3, LEVEL.yard]];
})();
