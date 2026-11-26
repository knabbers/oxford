// Somerville College, Oxford (the Woodstock Road / Walton Street / Little Clarendon Street site), STANDALONE model:
// the frame, the datum, the surveyed ground and the map ids every Somerville module shares. Research and sources:
// docs/research/somerville_survey.md (each fact graded C / I / U there; K known / G guessed here). Nothing in this
// directory is installed in the game: the server lists only the top level of places/ (server/index.js listModules),
// and the only page that loads these modules is public/somerville/index.html.
//
// FRAMES
//   world   x east, z SOUTH, y up, metres; origin lat 51.755, lon -1.26 (docs/WORLD_API.md).
//   LOCAL   u "east" (towards Woodstock Road), v "south" (towards Little Clarendon Street) ALONG THE SOUTH SIDE OF THE
//           MAIN QUAD (Penrose, Vaughan, the Chapel and the Fellows' Garden stand square to it to within a degree);
//           the world turned PHI = 0.5585 rad (32.0 deg) about C0 = (-206.60, -460.35), the middle of the Quad's lawn
//           (map w303764955, registered to the LIDAR: see REGISTRATION):
//               x = -206.60 + u cos PHI + v sin PHI,     z = -460.35 - u sin PHI + v cos PHI.
//           So the college's "north" (the Library side) is really north-north-west (bearing 328 deg), Woodstock Road
//           runs down the east side and Walton Street down the west. NOT everything is square to this frame: the
//           Library, Holtby, Park and ROQ West run 6 - 8 deg anticlockwise of it (their long walls fall towards the
//           east in v), the Hall, Maitland, Walton House, Darbishire, the Hostel and ROQ East 5.5 - 7 deg clockwise,
//           and the Woodstock Road front about 13 - 18 deg clockwise: those parts take their own wall frames (kit
//           `frame`) from corner points given in LOCAL coordinates.
//   REGISTRATION (found 2026-11-23 by the first builders and measured by the lead): on this site the game's map and
//           the LIDAR differ by a rigid 1.6 m east, 0.75 m south (tools/somerville_lidar.py MAP_SHIFT). The LOCAL
//           frame is the one the LIDAR tool measures in (origin as the tool has it, at the lawn's middle), and the
//           model is PLACED in the game's world moved back by that much: C0 below = (-205.00 - 1.60, -459.60 - 0.75).
//           So a building built where the LIDAR has it stands where the map's streets expect it. Everything taken
//           from the map (SITE_RING, the outlines in _somerville_massing_data.js) is in LOCAL coordinates through
//           the same registration.
//   y       0 = the DATUM, 62.50 m above sea level = the Quad's lawn at its middle (LIDAR 2022: 62.53). THE SITE IS
//           NOT LEVEL: it falls about 3.3 m from Woodstock Road (64.2) to Walton Street (60.9). Every level is
//           authored as (metres above sea level - 62.50); `groundY(u, v)` below gives the surveyed bare ground
//           anywhere on the site, and the whole model is stood rigid at the datum when it is built (somerville.js:
//           world.terrainLevelObject).
import * as THREE from 'three';
import { GRID, H } from './_somerville_ground_data.js';

export const PHI = 0.5585;
export const C0 = [-206.60, -460.35];
const COS = Math.cos(PHI), SIN = Math.sin(PHI);
/** LOCAL (u, v) -> world [x, z] */
export const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];
/** world (x, z) -> LOCAL [u, v] */
export const W2L = (x, z) => { const dx = x - C0[0], dz = z - C0[1]; return [dx * COS - dz * SIN, dx * SIN + dz * COS]; };
/** the matrix that carries LOCAL coordinates (x = u, y, z = v) into the world (for a Batch or a Group) */
export const localMatrix = () => new THREE.Matrix4().makeBasis(new THREE.Vector3(COS, 0, -SIN), new THREE.Vector3(0, 1, 0), new THREE.Vector3(SIN, 0, COS)).setPosition(C0[0], 0, C0[1]);

/** metres above sea level of y = 0 */
export const DATUM = 62.50;
/** a level in metres above sea level -> y */
export const Y = (mOD) => mOD - DATUM;

/** THE SURVEYED BARE GROUND at a LOCAL point, metres above the datum (LIDAR 2022 DTM on a 2 m grid; +-0.15 m on open
 *  ground; under a building it is the survey's interpolation between the ground round it). K. The surface is
 *  PIECEWISE PLANAR: each 2 m cell is two triangles split along the diagonal from its (low u, low v) corner to its
 *  (high u, high v) corner, exactly as _somerville_ground.js `drape` draws it, so a thing stood at groundY(u, v)
 *  stands on the drawn ground. */
export function groundY(u, v) {
  const fu = Math.max(0, Math.min(GRID.NU - 1.001, (u - GRID.U0) / GRID.STEP)), fv = Math.max(0, Math.min(GRID.NV - 1.001, (v - GRID.V0) / GRID.STEP));
  const i = Math.floor(fu), j = Math.floor(fv), a = fu - i, b = fv - j, h00 = H[j][i], h11 = H[j + 1][i + 1];
  return (a >= b ? h00 + a * (H[j][i + 1] - h00) + b * (h11 - H[j][i + 1]) : h00 + b * (H[j + 1][i] - h00) + a * (h11 - H[j + 1][i])) / 100;
}
export { GRID as GROUND_GRID };

/**
 * A BUILDING'S OWN FRAME. Few of the college's buildings are square to the LOCAL frame, so a part works in the frame
 * of its own long wall: s runs along the edge from LOCAL (u0, v0) to (u1, v1), t across it TO THE RIGHT of that
 * direction seen from above (v is south: walking east, right is south), y up from the datum as everywhere. The same
 * (s, t) as `tools/somerville_lidar.py fbox / fsec <u0> <v0> <u1> <v1> ...` prints.
 *   F.M            the matrix to B.push() so that the Batch's (x, y, z) = (s, y, t); B.pop() after
 *   F.L(s, t)      -> LOCAL [u, v]   (for ctx.floor / ctx.solid / ctx.seg / ctx.lamp rings, which are always LOCAL)
 *   F.P(u, v)      -> [s, t]
 *   F.ring(pts)    [[s, t], ...] -> LOCAL ring
 *   F.groundY(s, t)  the surveyed ground under a point of the frame
 *   F.len          the edge's length;  F.deg  its turn from the LOCAL u axis, degrees (positive = towards +v)
 */
export function ownFrame(u0, v0, u1, v1) {
  const len = Math.hypot(u1 - u0, v1 - v0), du = (u1 - u0) / len, dv = (v1 - v0) / len;
  const L = (s, t) => [u0 + du * s - dv * t, v0 + dv * s + du * t], P = (u, v) => [(u - u0) * du + (v - v0) * dv, -(u - u0) * dv + (v - v0) * du];
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(du, 0, dv), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-dv, 0, du)).setPosition(u0, 0, v0);
  return { M, L, P, len, deg: (Math.atan2(dv, du) * 180) / Math.PI, ring: (pts) => pts.map((p) => L(p[0], p[1])), groundY: (s, t) => { const q = L(s, t); return groundY(q[0], q[1]); } };
}

// The college's boundary (map site w242287393, OpenStreetMap), LOCAL coordinates, from the Woodstock Road front's
// middle anticlockwise seen on a north-up plan. K: map; checked against LIDAR roofs and walls to about 1 m. One change:
// the podium of Vaughan and Fry over the Little Clarendon Street shops (map w355810535) is taken in whole.
export const SITE_RING = [[127.43, 15.54], [126.5, 19.67], [124.48, 20.06], [113.88, 18.16], [102.35, 16.61], [86.11, 13.54], [82.98, 12.88], [70.42, 9.4], [68.43, 8.62], [67.55, 9.84], [66.36, 10.04], [62.53, 15.43], [55.86, 28.36], [58.37, 28.87], [63.26, 27.09], [73.43, 29.67], [71.86, 42.95], [85.81, 44.6], [99.6, 46.49], [101.27, 37.4], [109.48, 38.04], [105.71, 51.61], [100.38, 70.33], [93.6, 69.87], [78.7, 69.75], [72.38, 69.1], [50.63, 68.25], [47.4, 68.12], [47.9, 63.36], [20.71, 62.53], [17.75, 62.56], [17.72, 63.73], [17.58, 71.89], [17.59, 78.85], [17.51, 85.76], [17.49, 97.31], [0.08, 97.63], [-6.58, 97.71], [-38.39, 97.29], [-38.45, 85.69], [-39.15, 83.61], [-44.03, 80.09], [-50.86, 80.07], [-52.3, 80.11], [-52.44, 75.42], [-56.52, 75.35], [-56.46, 79.98], [-57.99, 79.97], [-58.06, 75.56], [-62.06, 75.54], [-61.91, 79.64], [-61.88, 96.76], [-77.94, 96.99], [-78.4, 87.73], [-76.5, 70.53], [-77.27, 65.92], [-78.3, 65.87], [-84.78, 65.47], [-91.59, 64.87], [-89.84, 51.11], [-88.02, 32.55], [-88.62, 16.14], [-94.12, -24.68], [-70.49, -30.43], [-38.22, -29.6], [0.81, -33.75], [29.47, -36.59], [39.27, -36.25], [41.69, -36.15], [41.91, -38.96], [88.24, -33.83], [87.45, -26.54], [100.73, -24.96], [100.56, -23.18], [105.41, -22.63], [105.58, -24.41], [118.3, -23.07], [135.78, -21.22], [130.81, 3.15]];
/** the box the site lies in (LOCAL) */
export const SITE_BOX = { u0: -95, u1: 137, v0: -39, v1: 99 };

// What the city's map draws on the site today, by id (public/data/map.json; id = OpenStreetMap way / relation id). The
// standalone module takes all of it out and builds its own. Names as the map has them (the college's own names: the
// survey, section 3).
export const MAP_IDS = {
  buildings: ['w97853751', 'w97853752', 'w97853758', 'w97853764', 'w97853773', 'w97853780', 'w97853781', 'w97853782', 'w97853784', 'w97853788', 'w131312897', 'w131312905', 'w227470836', 'w228186801', 'w228236349', 'w296174577', 'w296174578', 'w303764432', 'w303765359', 'w303766519', 'w303766882', 'w355810535', 'w1040787560', 'w1040787563', 'w1040787564', 'r1404465', 'r4047418', 'r4047418_1'],
  areas: ['w97853754', 'w303764954', 'w303764955', 'w687435715', 'w687435717', 'w687435718', 'w687435719', 'w687435721', 'w728819855', 'w1040787561', 'r12528130', 'r12528130_1'],
  paths: ['w97853742', 'w97853743', 'w97853746', 'w97853750', 'w97853753', 'w97853755', 'w97853765', 'w97853768', 'w97853770', 'w97853771', 'w97853772', 'w97853786', 'w97853787', 'w97853789', 'w97853790', 'w97853791', 'w97853792', 'w728819857', 'w925221117', 'w1040787562'],
  barriers: ['w303766881'],
  // not the college's, though they touch it or lie inside the ring: w303766520 the Oratory's block between the Hall's
  // kitchens and Radcliffe House (the 2016 site plan hatches it "non-college": the city's generator draws it), w65699768 the Oxford Oratory (St Aloysius), w1040787566 / w1040787565 its
  // presbytery, w113720982 .. w113720963 the Woodstock Road shops (13 - 21), w355810534 and w131312900 on Little
  // Clarendon Street / Walton Street
};

// Spot levels, metres above sea level (Environment Agency LIDAR Composite 2022, 1 m; tools/somerville_lidar.py). K.
export const LEVELS = {
  quadLawnMiddle: 62.53, quadLawnWest: 62.19, quadLawnEast: 63.12,
  woodstockRoadAtLodge: 64.15, waltonStreetAtWolfson: 60.95, littleClarendonAtFry: 63.3,
};

/** point in polygon (ring of [a, b]) */
export function inRing(a, b, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const p = ring[i], q = ring[j];
    if ((p[1] > b) !== (q[1] > b) && a < ((q[0] - p[0]) * (b - p[1])) / (q[1] - p[1]) + p[0]) c = !c;
  }
  return c;
}

/** THE SURVEYED BARE GROUND at a WORLD point, metres above sea level: the surface the model stands on. The city's
 *  terrain field is made this same surface under the site (tools/terrain_precincts.json "somerville": `surface`). */
export const groundOD = (x, z) => { const l = W2L(x, z); return DATUM + groundY(l[0], l[1]); };
