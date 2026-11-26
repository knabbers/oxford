// Exeter College (the Turl Street site), STANDALONE model: the frame, the datum, the surveyed levels and the map ids
// every Exeter module shares. Research and sources: docs/research/exeter_survey.md (each fact graded C / I / U there;
// K known / G guessed here). Nothing in this directory is installed in the game: the server lists only the top level of
// places/ (server/index.js listModules), and the only page that loads these modules is public/exeter/index.html.
//
// FRAMES
//   world   x east, z SOUTH, y up, metres; origin lat 51.755, lon -1.26 (docs/WORLD_API.md).
//   LOCAL   u east, v south ALONG THE FRONT QUAD'S AXES (the west range, the Chapel, the Hall and the east range stand
//           square to them to within a degree or two); the world turned PHI = 0.2950 rad (16.9 deg) about
//           C0 = (278.30, 140.80), the middle of the Front Quad's lawn (map w114320052):
//               x = 278.30 + u cos PHI + v sin PHI,     z = 140.80 - u sin PHI + v cos PHI.
//           The Library, the Fellows' Garden's walls and the Bodleian side run about 13.3 deg, the Rector's Lodgings
//           and the east half of the Broad Street range about 11.5 deg, Broad Street's front about 13.5 deg: those
//           parts take their own wall frames (kit `frame`) from points given in LOCAL coordinates.
//   y       0 = the DATUM, 64.40 m above sea level = the Front Quad's paving at the gate (LIDAR 2022: lawn 64.3 - 64.5,
//           Turl Street's carriageway at the gate 64.35). Every level is authored as (metres above sea level - 64.40)
//           and the whole model is stood rigid at the datum when it is built (exeter.js: world.terrainLevelObject).
import * as THREE from 'three';

export const PHI = 0.2950;
export const C0 = [278.30, 140.80];
const COS = Math.cos(PHI), SIN = Math.sin(PHI);
/** LOCAL (u, v) -> world [x, z] */
export const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];
/** world (x, z) -> LOCAL [u, v] */
export const W2L = (x, z) => { const dx = x - C0[0], dz = z - C0[1]; return [dx * COS - dz * SIN, dx * SIN + dz * COS]; };
/** the matrix that carries LOCAL coordinates (x = u, y, z = v) into the world (for a Batch or a Group) */
export const localMatrix = () => new THREE.Matrix4().makeBasis(new THREE.Vector3(COS, 0, -SIN), new THREE.Vector3(0, 1, 0), new THREE.Vector3(SIN, 0, COS)).setPosition(C0[0], 0, C0[1]);

/** metres above sea level of y = 0 */
export const DATUM = 64.40;
/** a level in metres above sea level -> y */
export const Y = (mOD) => mOD - DATUM;

// The college's boundary (map site w23680304, OpenStreetMap), LOCAL coordinates, clockwise from the north-east corner
// of the Rector's Garden. K: map; checked against LIDAR roofs to about 1 m.
export const SITE_RING = [[56.68, -34.51], [55.78, -22.24], [55.16, -12.29], [54.67, -3.14], [54.08, 6.4], [54.01, 7.63], [64.25, 8.34], [64.8, -0.69], [88.79, 0.85], [88.2, 9.66], [94.86, 10.12], [94.85, 12.2], [94.35, 20.73], [97.33, 20.9], [96.09, 40.8], [83.98, 39.73], [44.5, 33.8], [25.69, 31.01], [17.3, 30.76], [-6.41, 30.03], [-23.32, 29.28], [-24.65, 29.19], [-24.34, 20.93], [-23.97, 8.71], [-23.65, 1.49], [-23.64, -5.09], [-23.5, -16.23], [-23.33, -32.59], [-23.23, -36.01], [-23.19, -46.13], [-23.15, -63.47], [-16.69, -63.39], [-4.3, -62.55], [8.27, -61.97], [17.91, -61.34], [20.47, -61.19], [23.45, -61.02], [38.59, -60.28], [39.58, -61.13], [41.58, -60.84], [42.43, -59.85], [43.26, -59.81], [42.86, -55.75], [42.02, -46.8], [41.41, -40.3], [40.99, -35.83]];

// What the city's map draws on the site today, by id (public/data/map.json; id = OpenStreetMap way / node id). The
// standalone module takes all of it out and builds its own. The map's staircase NAMES are not the college's: see the
// survey, section 3.
export const MAP_IDS = {
  buildings: ['w60903334', 'w114575323', 'w227761181', 'w227762234', 'w301630464', 'w301630465', 'w301630466', 'w301630467', 'w301630468', 'w301630469', 'w301630470', 'w301630471', 'w301630472', 'w301630473', 'w301630474', 'w301630475', 'w301630476', 'w301630477', 'w301630478', 'w301630479', 'w1418427621',
    'w1418421919'],      // (a low building 2 - 3 m high along the Old Ashmolean's yard and the Schools Wall, which the map draws as a 10.5 m block over the Rector's Garden's walls: part 'rector' builds the walls and the low roof as LIDAR has them)
  areas: ['w114320052', 'w230240247', 'w230240248', 'w301630462', 'w556632296', 'w1418427625', 'w1418668128'],
  paths: ['w301630481', 'w301630482', 'w301630483', 'w301630484', 'w932806554', 'w932806555', 'w932806556', 'w932806557', 'w932806558', 'w932806559', 'w1418427622', 'w1418427623', 'w1418427624', 'w1418427626', 'w1418427627', 'w1418667059', 'w1418668129', 'w1418668130'],
  barriers: ['w113003418', 'w113003396', 'w1237650406'],      // (the last is the Schools Wall, list entry 1348696: built by part 'rector')
  // not the college's, though they touch it: w114575324 Convocation House, w114320058 the Divinity School
};

// Spot levels, metres above sea level (Environment Agency LIDAR Composite 2022, 1 m; tools/exeter_lidar.py). K: measured.
export const LEVELS = {
  frontQuadLawn: 64.45,        // middle; 64.30 at its north and east edges, 64.52 at the south
  frontQuadPathGate: 64.54, frontQuadPathHall: 64.54, frontQuadPathChapel: 64.37, frontQuadPathEast: 64.22,
  turlAtGate: 64.35, turlPavementAtGate: 64.29, turlNorthEnd: 63.96, turlSouthEnd: 64.61,
  broadPavement: 63.71, broadCarriageway: 63.96,
  margaryQuad: 63.90,          // 64.0 west, 63.75 east
  brasenoseLaneWest: 65.06, brasenoseLaneMid: 64.58, radcliffeSquare: 63.65,
  fellowsGardenLawn: 64.30,    // 64.15 west .. 64.45 east
  terraceTop: 67.25,           // the raised walk along Brasenose Lane and Radcliffe Square: 67.1 - 67.4
  rectorsGardenLawn: 63.80,
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
