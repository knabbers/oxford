// Exeter College, STANDALONE model, part 'garden' (survey G04 + G05 + G06): THE PLAN of the Fellows' Garden, the Mound
// (the raised terrace in its south-east corner, overlooking Radcliffe Square) and the boundary wall on Brasenose Lane and
// Radcliffe Square. Pure data and small pure functions: every dimension a named constant with its source; the build
// functions are in _exeter_garden_build.js. LOCAL frame (u east, v south, y above the datum 64.40 m: _exeter_shared.js).
// Research: docs/research/exeter_survey.md G04 - G06, sections 2, 11; reference/exeter/20 planning drawings/DIMENSIONS.md.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (the 0.5 m resample of tools/exeter_lidar.py, read with a script of my own: tables every 1 - 2 m, the
//     wall line sampled every 2 m across a 3 m strip). The BARE-GROUND model has FILTERED THE MOUND OUT (it reads 63.8 -
//     64.5 where the walk stands at 67.2): every level on the Mound is read off the SURFACE model in its open cells
//     (walk 67.04 - 67.44; the corner 67.15 - 67.3) and off the topographic survey. The lawn's levels are the bare
//     ground's (a 2 m grid, the median of 16 samples a node: GROUND below). The wall's top reads 67.1 - 67.8 along the
//     lawn (the cells mix wall and ground: the highest is the coping) and 67.7 - 68.6 along the Mound; outside, Brasenose
//     Lane falls from 64.9 at the east range to 63.9 at the square, Radcliffe Square 63.6 - 63.9.
//   * Planning 05/02492/FUL (Montgomery Architects 2005; drg 3 proposed plan 1:200 and drg 4 sections 1:50, rendered at
//     110 dpi and scaled: 21.65 px a metre): the Mound fills the corner, about 20.7 m along the lane and 19 m along the
//     square; STAIR 1 (south-west) runs square to the lane wall, rising south, 18 risers / 17 goings of 233 mm, overall 2.0
//     m between its side walls, its top 2.1 m from the wall, a rounded landing at its foot; the GARDENER'S SHED (a stone box
//     whose flat roof is part of the walk, "new railings to top of gardener's shed", a 300 mm parapet) west of it against
//     the wall, about 3.5 x 2.8 m; STAIR 2 (north) runs square to the Radcliffe Square wall, rising east from the gravel by
//     the pond, 14 risers of 162 mm, goings 280 mm, York stone on an RC flight, handrails both sides, a top landing, then
//     "a rising walk"; a LEANING STONE RETAINING WALL along its north side; the walk 1.5 - 1.9 m wide with planting on
//     both sides; the inner edge of the Mound a sweeping planted bank, concave to the north-west; a bench at the
//     "protected view point" on the square side. Design statement: parapet 850 - 960 mm above the walk; the 4 m fall
//     outside.
//   * The 1:500 topographic survey (21/00354/FUL tree report p20; DIMENSIONS.md): lawn 64.10 - 64.29, walk 67.02 - 67.30
//     (67.30 by the shed), the bank 64.48 .. 67.02, stair 1 foot 64.42, stair 2 foot 64.49 / part-way 65.98, the pond
//     enclosure 64.44 - 64.49, the lane 64.93 .. 63.94, trees T1 - T7 with heights and crown radii.
//   * OpenStreetMap (public/data/map.json, to LOCAL with the shared frame): the lawn w230240247, the paths w932806554,
//     w1418668130 (round the lawn), w932806556 (the walk), w932806557 / w932806558 (the two stairs), w1418668129 (round the
//     pond), the pond w1418668128, the wall w113003418.
//   * Photographs (reference/exeter/09, 12, 08): the corner by hand 2026-11-23 (coursed rubble 4 - 4.5 m, flat coping,
//     plain square corner); B Rudiak-Gould 2008 and Basher Eyre 2011 (the lane face at the east end: the X tie, two rows
//     of square iron plates, the coping a heavy weathered slab, ashlar quoining at the corner); Medarduss 2023 (the coping
//     from the walk, flat slabs with rounded arrises, NO railing on the square side); A Baxter 2012 panorama, Simon Q 2010,
//     J Freeman 2005, the c.2005 view of the two stairs.
import { Y } from './_exeter_shared.js';

// ------------------------------------------------------------------------------------------------ helpers (pure)
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [a, ya] = tab[i - 1], [b, yb] = tab[i]; return ya + ((x - a) / (b - a)) * (yb - ya); } return tab[tab.length - 1][1]; };
/** distance from (u, v) to a polyline */
export function distLine(line, u, v) {
  let d = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = L ? clamp(((u - ax) * dx + (v - az) * dz) / L, 0, 1) : 0;
    d = Math.min(d, Math.hypot(u - ax - dx * t, v - az - dz * t));
  }
  return d;
}

// ------------------------------------------------------------------------------------------------ the lawn's ground
/** bare-ground levels (y above the datum) on a 2 m grid: u 26 .. 98 (37 columns), v -2 .. 42 (23 rows). K: LIDAR 2022
 *  bare ground, the median of 16 samples round each node (+-0.1 m). Valid on the open garden; under the Mound the
 *  survey's filter has taken the bank out (those nodes are the lawn's level carried under it: the Mound is built over). */
export const GROUND = { u0: 26, v0: -2, step: 2, rows: [
  [-0.58, -0.15, -0.02, 0.01, 0.02, 0.00, -0.02, -0.05, -0.03, -0.05, -0.22, -0.41, -0.50, -0.45, -0.43, -0.38, -0.34, -0.29, -0.22, -0.18, -0.13, -0.09, -0.06, -0.03, -0.04, -0.00, 0.01, 0.01, -0.00, -0.04, 0.03, 0.06, 0.07, 0.13, 0.13, 0.13, 0.13],
  [-0.06, -0.02, -0.06, 0.06, 0.00, -0.01, -0.00, -0.00, -0.00, 0.04, -0.04, -0.26, -0.42, -0.40, -0.37, -0.33, -0.31, -0.28, -0.24, -0.19, -0.15, -0.12, -0.08, -0.05, -0.06, -0.05, -0.03, -0.04, -0.04, -0.09, -0.00, 0.00, 0.04, 0.08, 0.08, 0.08, 0.10],
  [0.03, -0.01, 0.13, 0.11, 0.02, -0.03, 0.00, 0.01, 0.01, 0.11, 0.00, -0.08, -0.33, -0.33, -0.31, -0.29, -0.24, -0.22, -0.19, -0.17, -0.12, -0.11, -0.09, -0.08, -0.09, -0.08, -0.07, -0.07, -0.09, -0.12, -0.05, -0.05, -0.00, 0.03, 0.04, 0.04, 0.03],
  [0.14, 0.09, 0.15, 0.12, -0.02, -0.04, 0.06, 0.04, 0.02, 0.10, 0.02, -0.03, -0.20, -0.29, -0.25, -0.22, -0.19, -0.15, -0.10, -0.06, -0.09, -0.06, -0.05, -0.06, -0.05, -0.06, -0.05, -0.06, -0.06, -0.06, -0.07, -0.06, -0.01, 0.00, 0.01, 0.03, 0.05],
  [0.04, -0.03, 0.05, 0.10, -0.04, -0.04, 0.05, 0.06, 0.04, 0.08, 0.07, -0.02, -0.07, -0.20, -0.19, -0.17, -0.11, -0.05, 0.01, -0.01, -0.02, -0.02, -0.03, -0.04, 0.02, 0.06, -0.00, 0.06, 0.04, 0.05, 0.04, 0.06, 0.02, 0.02, 0.04, 0.08, 0.12],
  [-0.23, -0.05, 0.00, 0.14, -0.05, 0.01, 0.10, 0.07, 0.04, 0.06, 0.05, -0.00, -0.05, -0.13, -0.12, -0.06, 0.00, 0.07, 0.09, 0.10, 0.08, 0.03, -0.01, -0.00, 0.04, 0.05, 0.06, 0.06, 0.06, 0.08, 0.08, 0.09, 0.02, 0.03, 0.07, 0.11, 0.14],
  [-0.13, -0.01, -0.08, -0.11, -0.12, 0.02, 0.03, -0.07, -0.04, -0.06, -0.02, 0.01, -0.03, -0.04, -0.03, 0.02, 0.07, 0.13, 0.12, 0.12, 0.10, 0.08, 0.05, 0.03, 0.05, 0.05, 0.06, 0.06, 0.06, 0.08, 0.10, 0.07, 0.04, 0.04, 0.07, 0.11, 0.11],
  [-0.09, -0.01, -0.10, -0.14, -0.12, -0.11, -0.12, -0.13, -0.12, -0.17, -0.11, -0.08, -0.06, -0.06, -0.03, -0.01, 0.06, 0.05, 0.05, 0.07, 0.06, 0.05, 0.05, 0.01, -0.04, -0.00, -0.04, 0.04, 0.06, 0.06, 0.08, 0.06, 0.07, 0.04, 0.07, 0.08, 0.05],
  [-0.00, 0.02, -0.11, -0.17, -0.20, -0.21, -0.24, -0.23, -0.22, -0.25, -0.22, -0.23, -0.17, -0.18, -0.09, -0.05, -0.10, -0.08, -0.17, -0.18, -0.20, -0.16, -0.23, -0.25, -0.24, -0.14, -0.15, -0.18, -0.14, -0.04, 0.05, 0.05, 0.04, 0.03, 0.01, 0.08, 0.11],
  [0.07, 0.05, -0.11, -0.18, -0.19, -0.23, -0.25, -0.28, -0.28, -0.27, -0.24, -0.26, -0.27, -0.26, -0.26, -0.27, -0.28, -0.28, -0.30, -0.32, -0.33, -0.32, -0.32, -0.29, -0.28, -0.21, -0.19, -0.25, -0.24, -0.18, 0.03, 0.07, 0.04, 0.04, -0.02, 0.10, 0.08],
  [0.08, 0.05, -0.11, -0.19, -0.19, -0.21, -0.24, -0.25, -0.27, -0.26, -0.23, -0.25, -0.28, -0.28, -0.29, -0.28, -0.29, -0.29, -0.31, -0.32, -0.31, -0.32, -0.33, -0.32, -0.32, -0.30, -0.26, -0.27, -0.27, -0.23, 0.00, 0.08, 0.08, 0.07, 0.02, 0.10, -0.08],
  [0.03, -0.02, -0.21, -0.19, -0.19, -0.21, -0.24, -0.22, -0.26, -0.27, -0.25, -0.24, -0.26, -0.26, -0.28, -0.27, -0.28, -0.31, -0.32, -0.33, -0.31, -0.32, -0.35, -0.32, -0.32, -0.30, -0.27, -0.26, -0.26, -0.17, 0.02, 0.05, 0.09, 0.12, 0.11, 0.11, -0.20],
  [0.07, -0.06, -0.14, -0.17, -0.19, -0.20, -0.21, -0.23, -0.25, -0.27, -0.25, -0.26, -0.28, -0.25, -0.24, -0.27, -0.28, -0.28, -0.31, -0.30, -0.27, -0.31, -0.35, -0.34, -0.31, -0.29, -0.28, -0.28, -0.25, -0.06, 0.06, 0.11, 0.08, 0.04, 0.05, -0.03, -0.27],
  [0.09, 0.03, -0.14, -0.17, -0.20, -0.23, -0.24, -0.23, -0.22, -0.23, -0.24, -0.26, -0.27, -0.25, -0.22, -0.25, -0.26, -0.27, -0.28, -0.28, -0.27, -0.28, -0.32, -0.32, -0.31, -0.30, -0.29, -0.27, -0.14, 0.01, 0.06, 0.04, -0.01, -0.07, -0.15, -0.21, -0.44],
  [0.13, 0.09, -0.10, -0.18, -0.12, -0.15, -0.17, -0.13, -0.23, -0.22, -0.21, -0.23, -0.24, -0.26, -0.27, -0.28, -0.27, -0.26, -0.27, -0.26, -0.26, -0.30, -0.28, -0.28, -0.26, -0.27, -0.24, -0.20, -0.09, -0.03, -0.01, -0.04, -0.09, -0.18, -0.24, -0.34, -0.49],
  [0.18, 0.08, -0.02, -0.08, -0.08, -0.01, -0.01, -0.05, 0.02, 0.05, 0.11, -0.13, -0.15, -0.22, -0.26, -0.24, -0.26, -0.26, -0.28, -0.26, -0.27, -0.26, -0.28, -0.26, -0.25, -0.24, -0.20, -0.15, -0.12, -0.07, -0.09, -0.12, -0.19, -0.26, -0.33, -0.40, -0.49],
  [0.24, 0.11, -0.00, 0.03, 0.02, 0.03, 0.06, 0.07, 0.09, 0.14, 0.22, 0.15, 0.02, -0.00, 0.09, 0.10, -0.03, -0.04, -0.14, -0.21, -0.14, -0.17, -0.22, -0.22, -0.26, -0.25, -0.19, -0.16, -0.14, -0.12, -0.17, -0.22, -0.29, -0.34, -0.41, -0.47, -0.57],
  [0.30, 0.15, 0.06, 0.09, 0.10, 0.08, 0.14, 0.13, 0.15, 0.16, 0.20, 0.17, 0.15, 0.18, 0.21, 0.22, 0.23, 0.10, 0.11, 0.17, 0.29, 0.35, 0.00, -0.14, -0.19, -0.21, -0.12, -0.15, -0.19, -0.18, -0.22, -0.29, -0.36, -0.41, -0.47, -0.53, -0.61],
  [0.35, 0.25, 0.24, 0.23, 0.23, 0.28, 0.34, 0.39, 0.36, 0.32, 0.24, 0.27, 0.30, 0.37, 0.29, 0.26, 0.28, 0.25, 0.28, 0.29, 0.46, 0.44, 0.05, -0.14, -0.19, -0.17, -0.15, -0.20, -0.23, -0.25, -0.28, -0.34, -0.40, -0.47, -0.53, -0.59, -0.62],
  [0.47, 0.40, 0.35, 0.31, 0.29, 0.31, 0.31, 0.36, 0.33, 0.33, 0.33, 0.30, 0.30, 0.30, 0.35, 0.22, 0.22, 0.22, 0.22, 0.33, 0.32, 0.21, 0.01, -0.15, -0.21, -0.20, -0.19, -0.23, -0.28, -0.29, -0.33, -0.40, -0.46, -0.52, -0.58, -0.61, -0.75],
  [0.47, 0.50, 0.49, 0.41, 0.38, 0.33, 0.27, 0.24, 0.22, 0.21, 0.18, 0.15, 0.13, 0.11, 0.11, 0.12, 0.10, 0.08, 0.06, 0.05, 0.03, 0.03, -0.05, -0.14, -0.22, -0.24, -0.23, -0.26, -0.31, -0.35, -0.39, -0.46, -0.52, -0.57, -0.60, -0.66, -0.83],
  [0.43, 0.45, 0.45, 0.45, 0.42, 0.39, 0.34, 0.25, 0.25, 0.24, 0.20, 0.14, 0.13, 0.10, 0.07, 0.03, -0.01, -0.06, -0.06, -0.11, -0.10, -0.14, -0.19, -0.17, -0.24, -0.27, -0.27, -0.30, -0.34, -0.40, -0.45, -0.52, -0.57, -0.59, -0.61, -0.71, -0.78],
  [0.38, 0.38, 0.40, 0.40, 0.24, 0.13, 0.05, 0.13, 0.31, 0.29, 0.22, 0.20, 0.22, 0.18, 0.15, 0.11, 0.09, -0.00, -0.07, -0.11, -0.20, -0.22, -0.23, -0.30, -0.35, -0.39, -0.38, -0.42, -0.43, -0.46, -0.50, -0.55, -0.60, -0.62, -0.63, -0.75, -0.81],
] };
/** the garden's ground (y) at (u, v): the grid bilinear, clamped to the topographic survey's range on the lawn
 *  (64.08 .. 64.70). K: LIDAR + topo */
export function groundY(u, v) {
  const G = GROUND, fu = clamp((u - G.u0) / G.step, 0, G.rows[0].length - 1.001), fv = clamp((v - G.v0) / G.step, 0, G.rows.length - 1.001);
  const i = Math.floor(fu), j = Math.floor(fv), a = fu - i, b = fv - j, R = G.rows;
  const y = (R[j][i] * (1 - a) + R[j][i + 1] * a) * (1 - b) + (R[j + 1][i] * (1 - a) + R[j + 1][i + 1] * a) * b;
  return clamp(y, Y(64.08), Y(64.70));
}

// ------------------------------------------------------------------------------------------------ the boundary wall
/** centre line, west to east along Brasenose Lane, round the corner, north up Radcliffe Square to the Bodleian.
 *  K: map w113003418 (its corners (25.69, 31.01), (44.5, 33.8), (84.0, 39.7), (96.1, 40.8), (97.3, 20.9)) moved 0.3 m out
 *  to the LIDAR's wall cells (the coping reads 0.3 - 0.8 m south of the map's line along the lawn); the west end at the
 *  east range's south-east corner as the east range's builder has it after the survey's registration: (27.46, 32.01)
 *  (_exeter_east_plan.js R.vSg: LOCAL (27.43, 32.02); was (26.8, 31.45)). The middle point (44.5, 33.8) lies on the
 *  straight line (map): dropped. */
export const WALL = {
  line: [[27.46, 32.01], [84.0, 40.0], [96.4, 41.05], [97.6, 20.9]],
  t: 0.6,               // thickness. G (medieval rubble boundary walls 0.5 - 0.7; the Mound's retaining part may be thicker below: not seen)
  coping: { h: 0.2, over: 0.06 },   // heavy flat slab coping, rounded arrises. K: Rudiak-Gould 2008, Medarduss 2023, corner look 2026-11-23 (flat, no pier); figures G
  foot: 0.4,            // the wall's foot goes this far into the ground on both sides (house rule)
  // coping top (y) along the lawn: 67.75 at the east range rising to 68.15 at the shed. K: LIDAR wall cells 67.1 - 67.8
  // (u 30 - 43, partly mixed) and the Mound's figures at the east end; the straight rise between is G
  copWest: Y(67.75), copShed: Y(68.15), uShed: 72.3,
  parapet: 0.9,         // coping above the walk along the Mound. K: design statement 850 - 960 mm
  quoin: 0.9,           // the last 0.9 m each way at the Radcliffe Square corner in ashlar. K: Rudiak-Gould 2008 (squared ashlar
                        // at the lane's east end); section 11: a plain square corner, no pier (the brief's "ashlar end pier" is this)
};
/** Brasenose Lane outside the wall, y by u. K: topo 64.93 .. 63.94; LIDAR 2 m outside the wall */
export const LANE = [[26.8, Y(64.92)], [34, Y(64.80)], [44, Y(64.70)], [50, Y(64.55)], [60, Y(64.40)], [70, Y(64.20)], [78, Y(64.02)], [84, Y(63.92)], [90, Y(63.80)], [96.4, Y(63.65)]];
/** Radcliffe Square outside the east wall, y by v. K: LIDAR (63.6 at the corner, 63.9 at the Bodleian) */
export const SQUARE = [[20.9, Y(63.92)], [30, Y(63.78)], [41.05, Y(63.62)]];
/** the iron X tie and the square iron plates on the lane face (u of the centre, y of the centre above the lane, size).
 *  K: Rudiak-Gould 2008, Slowking4 2014, Basher Eyre 2011 (the X about 4.5 m west of the corner at three fifths of the
 *  height; plates in two rows further west). Positions +-1 m: G */
export const IRON = {
  x: { u: 91.4, up: 2.55, w: 1.25, h: 1.55, bar: 0.1 },
  plates: [[86.6, 2.6, 0.55], [83.2, 2.6, 0.55], [86.6, 0.85, 0.55], [83.2, 0.85, 0.55]],
};
/** a small door in the lane wall at the garden's south-west corner, two steps down into the garden. K: topo (a stepped
 *  gate, spot level 64.93 outside, PSL 64.64 inside); its look (a plain boarded door under a flat stone lintel): G */
export const LANE_DOOR = { u: 30.2, w: 1.0, h: 2.05 };

// ------------------------------------------------------------------------------------------------ the Mound
// Stair 1's frame: s along the lane wall (east), n inward (north) from the wall's centre line, origin on the line at u 76.8.
export const A1 = (() => { const [a, b] = WALL.line, L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; })();
export const N1 = [A1[1], -A1[0]];
export const O1 = [76.8, WALL.line[0][1] + (76.8 - WALL.line[0][0]) * (A1[1] / A1[0])];
export const P1 = (s, n) => [O1[0] + s * A1[0] + n * N1[0], O1[1] + s * A1[1] + n * N1[1]];
/** STAIR 1 (south-west): K plan drg 3 (2.0 m overall, square to the wall, top 2.1 m from it) and section AA (18 risers,
 *  goings 233 mm); the rise from the topo (foot 64.42, walk 67.25 at its head: 157 mm risers, not the section's
 *  scaled 179); map w932806557 (top (76.5, 36.3), foot (76.9, 31.4)). Side walls 0.4: G (1.2 m clear treads: DIMENSIONS) */
export const ST1 = { s0: -1.0, s1: 1.0, wall: 0.4, nTop: 2.15, risers: 18, going: 0.233, yFoot: Y(64.42), yTop: Y(67.25), apronR: 1.0, kerb: 0.25 };
/** the gardener's shed (the Fellows' Garden substation per the topo?) west of stair 1: K plan drg 3 (3.5 x 2.8 m, its
 *  roof part of the walk with railings on its north and west edges, a 300 mm parapet); roof 67.30 (topo); door G */
export const SHED = { s0: -4.5, s1: -1.0, n0: 0.3, n1: 3.1, roof: Y(67.30), parapet: 0.3, door: { s: -2.6, w: 1.0, h: 2.0 } };
// Stair 2's frame: x east along the stair (square to the Radcliffe Square wall), l lateral (south), origin the foot's centre.
export const E2 = (() => { const [a, b] = [WALL.line[3], WALL.line[2]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; return [d[1], -d[0]]; })();
export const L2 = [-E2[1], E2[0]];
export const O2 = [88.3, 21.2];
export const P2 = (x, l) => [O2[0] + x * E2[0] + l * L2[0], O2[1] + x * E2[1] + l * L2[1]];
/** STAIR 2 (north, rebuilt 2006): K section DD (14 risers of 162 mm, goings 280 mm, a top landing, handrails both sides,
 *  York stone), plan drg 3 (1.0 - 1.2 m wide, a leaning retaining wall along its north side, square to the square's wall);
 *  topo foot 64.49; map w932806558 ((88.0, 20.5) .. (92.7, 21.2)). Landing length, wall thicknesses: G */
export const ST2 = { clear: 1.1, nWall: 0.35, sKerb: 0.3, risers: 14, rise: 0.162, going: 0.28, yFoot: Y(64.49), landTo: 5.2 };
ST2.yTop = ST2.yFoot + ST2.risers * ST2.rise;     // 66.76 (topo "65.98 part-way", the walk beyond 67.03)

/** the walk's level (y) at (u, v) on the Mound: 66.76 at stair 2's head rising to 67.03 within 3.3 m (the "rising walk"),
 *  67.12 at the corner, 67.25 at stair 1's head. K: topo 67.03, 67.07, 67.12, 67.15, 67.16; LIDAR 67.04 - 67.44 */
export function walkY(u, v) {
  const east = v < 24.5 ? ST2.yTop + (clamp(v - 21.2, 0, 3.3) / 3.3) * (Y(67.03) - ST2.yTop) : Y(67.03) + (v - 24.5) * 0.0072;
  const lane = Math.min(Y(67.25), Y(67.12) + (94.5 - Math.min(u, 94.5)) * 0.0081);
  const w = smooth(90.5, 93.5, u) * (1 - smooth(36.5, 38.5, v));
  return lerp(lane, east, w);
}
/** the bank's FOOT and TOP (the planted slope on the garden side), south-west to north-east. K: LIDAR surface in its
 *  open cells (u 80: 64.2 at v 30, 65.85 at v 34, 67.1 at v 36; u 88: 65.2 - 65.6 at v 25 - 29; u 90: 67.05 at v 25),
 *  plan drg 3 (a curve concave to the north-west), map (the path at its foot). The lines between the cells: G (+-0.7 m) */
export const BANK = {
  foot: [P1(1.0, 6.11), [80.5, 31.6], [82.5, 29.9], [84.8, 27.4], [86.6, 25.0], [87.7, 23.0], P2(0, 0.85)],
  top: [P1(1.0, 2.15), [80.5, 36.0], [83.6, 34.7], [86.6, 32.6], [89.0, 29.8], [90.5, 26.8], [91.3, 24.0], P2(3.9, 0.85)],
};
/** the walk's centre line (gravel, 1.7 m wide: plan 1.5 - 1.9), from stair 2's head round to stair 1's head, with its
 *  half-width at each point. Along the lane it runs against the parapet (section AA); along the square 0.75 m of
 *  planting lies between it and the wall (plan: "existing planting provides protection from fall"). K plan + map
 *  w932806556; offsets G (+-0.3) */
export const WALK = [
  [93.5, 21.2, 0.5], [94.6, 21.55, 0.6], [95.35, 22.6, 0.75], [95.5, 24.2, 0.85], [95.4, 26.0, 0.85], [95.16, 30.0, 0.85], [94.92, 34.0, 0.85],
  [94.75, 36.7, 0.85], [94.5, 38.4, 0.85], [93.6, 39.35, 0.85], [92.0, 39.37, 0.85], [88.1, 39.04, 0.85], [84.1, 38.70, 0.85],
  [80.2, 38.11, 0.85], P1(-1.0, 1.3).concat(0.85),
];
/** the bench at the "protected view point" (plan drg 3) on the square side, facing east over the wall. K place (+-1 m) */
export const VIEW_BENCH = [96.4, 35.6];

// ------------------------------------------------------------------------------------------------ the garden in plan
/** the garden's NORTH EDGE (joins pass, 2026-11-23: the buildings moved onto the topographic survey): the Library's south
 *  face from its SW corner (30.92, 6.79) to its SE corner (50.25, 7.80) (_exeter_library_plan.js toL(0 .. L, W); the
 *  buttresses stand 0.72 further out on it), the 2021-3 link's front set back 0.3 (toL(L .. L + 3.94, W - 0.3)), the
 *  Convocation House's south face through v 8.33 at u 59.5 (the survey; it was 9.1 - 9.4 from LIDAR), its slope kept.
 *  K: survey registered on 18 walls (rms 0.21 m); the link's set-back G (the Library's builder's) */
export const NORTH_EDGE = [[30.92, 6.79], [50.25, 7.80], [50.26, 7.50], [54.20, 7.71], [54.20, 8.18], [64.8, 8.48]];
// (the Convocation House is the CITY's building, not this model's: its mesh stands on the map's line (v 9.1 - 9.4), 0.8 -
// 0.9 m south of the survey's face. Laid to the survey line the gravel leaves a dark strip of earth at the city mesh's foot;
// run on under the mesh to the map's line it showed a pale gap there instead (both looked at 2026-11-23): the survey line
// is kept. When the model is merged the city's building should move onto v 8.33.)
/** the Library's frame (a east from the west face, c south from the north face), as _exeter_library_plan.js has it:
 *  ORIGIN (31.34, -1.18), turned 3.0 deg; W 7.98; buttresses 0.83 wide, 0.72 out at a 0.44 .. 18.89; DG1 at a 3.11 */
export const LIB = { o: [31.34, -1.18], th: (3.0 * Math.PI) / 180, W: 7.98, butA: [0.44, 5.17, 9.66, 14.13, 18.89], butW: 0.83, butOut: 0.72, dg1: [2.05, 4.17], aEnd: 19.35 };
export const libL = (a, c) => [LIB.o[0] + a * Math.cos(LIB.th) - c * Math.sin(LIB.th), LIB.o[1] + a * Math.sin(LIB.th) + c * Math.cos(LIB.th)];
/** the east range's garden face (LOCAL u at v): 26.86 at v 6.4 to 27.46 at v 31.6, Peryam's two three-sided bays 0.8 m out
 *  (3.6 m bases, 2.6 m fronts) centred v 16.2 and 25.7. K: _exeter_east_plan.js (survey registered); the wall with the
 *  gate between the range and the Library at v 4.07 (its south face; _exeter_library_plan.js): the garden stops there */
export const EAST_FACE = { v0: 6.4, u0: 26.86, v1: 31.6, u1: 27.46, bays: [16.2, 25.7], base: 3.6, front: 2.6, out: 0.8, gateV: 4.07, gateU1: 31.06 };
export const eastU = (v) => EAST_FACE.u0 + ((v - EAST_FACE.v0) / (EAST_FACE.v1 - EAST_FACE.v0)) * (EAST_FACE.u1 - EAST_FACE.u0);
/** the whole of this part's ground at lawn level (the garden minus the Mound, its stairs and the shed), as one ring.
 *  K: SITE_RING (map site w23680304) with the surveyed faces where they differ; G where noted in the build */
export const GARDEN_RING = () => {
  const E = EAST_FACE, r = [[eastU(E.gateV), E.gateV], [E.gateU1, E.gateV], ...NORTH_EDGE, [64.8, 1.8], [89.0, 1.8], [88.6, 9.7], [94.85, 10.15], [94.85, 12.2], [94.4, 20.35]];
  r.push(P2(ST2.landTo, -ST2.clear / 2 - ST2.nWall), P2(-0.35, -ST2.clear / 2 - ST2.nWall), P2(-0.35, ST2.clear / 2 + ST2.sKerb));
  for (const p of BANK.foot.slice().reverse().slice(1, -1)) r.push(p);
  r.push(P1(ST1.s1, ST1.nTop + (ST1.risers - 1) * ST1.going), P1(ST1.s0, ST1.nTop + (ST1.risers - 1) * ST1.going));
  r.push(P1(ST1.s0, SHED.n1), P1(SHED.s0, SHED.n1), P1(SHED.s0, 0.3));
  const wi = inner(WALL.line[0][0] + 0.05, 0.3);
  r.push(wi, [eastU(wi[1]), wi[1]]);
  // north along the range's garden face, round Peryam's two bays (south one first)
  for (const vc of E.bays.slice().reverse()) { const hb = E.base / 2, hf = E.front / 2; r.push([eastU(vc + hb), vc + hb], [eastU(vc + hf) + E.out, vc + hf], [eastU(vc - hf) + E.out, vc - hf], [eastU(vc - hb), vc - hb]); }
  r.push([E.u0, E.v0]);
  return r;
};
/** a point on the lane wall's inner face (n from the centre line) at u */
export function inner(u, n) { const v = WALL.line[0][1] + (u - WALL.line[0][0]) * (A1[1] / A1[0]); return [u + n * N1[0], v + n * N1[1]]; }

/** the LAWN (one sheet: the map's w230240247, its north edge moved off the Library so the bed and path fit (the panorama
 *  and Simon Q 2010: bed with buttresses, a 1.8 m path), its south edge 2.9 m off the lane wall (bed 1.2 + path 1.4);
 *  the east edge along the path at the bank's foot). K shape: map; offsets G (+-0.5) */
export const LAWN = [
  [32.2, 10.6], [52.5, 11.9], [60.0, 12.25], [63.5, 12.0], [67.0, 10.9], [71.3, 10.6], [80.0, 10.9], [84.0, 11.4], [86.0, 12.8],
  [86.9, 15.0], [86.8, 19.5], [86.3, 21.6], [85.3, 23.6], [83.5, 25.6], [81.0, 27.5], [78.6, 29.1], [76.6, 30.0],
  [75.2, 30.9], [74.0, 32.3], inner(72.0, 4.6), inner(60.0, 2.9), inner(45.0, 2.9), inner(36.0, 2.9), [32.3, 28.6], [31.1, 27.9],
  [30.3, 26.7], [29.8, 25.3], [29.7, 23.9], [29.7, 14.1], [29.9, 12.2], [30.6, 11.1], [31.3, 10.8],
];
/** planting beds on the lawn level (flowerbed): along the Library's front between its buttresses, along the lane wall's
 *  foot, the planted bay north of the path (the cherry and the thuja; Divinity School beyond), round the stair 1 foot.
 *  K: panorama 2012 (bed along the Library, dark bed along the wall), Freeman 2005, Simon Q 2010; widths G */
// (joins pass: the Library's bed follows its surveyed face, 1.1 m deep (the buttresses 0.72), in two pieces either side of
// DG1's paving (BEDS[0] east of the door, BEDS[3] west of it, the clasping corner buttress to the door's paving); the lane
// bed starts at the range's moved corner; the bay's edge follows the Convocation House's surveyed face)
const LIB_BED = 1.1;
export const BEDS = [
  [libL(LIB.dg1[1], LIB.W), libL(LIB.aEnd - 0.05, LIB.W), libL(LIB.aEnd - 0.05, LIB.W + LIB_BED), libL(LIB.dg1[1], LIB.W + LIB_BED)],
  [inner(27.9, 0.3), inner(71.9, 0.3), inner(71.9, 1.5), inner(27.9, 1.5)],
  [[64.8, 1.8], [89.0, 1.8], [88.7, 8.3], [84.4, 8.9], [71.3, 7.5], [67.0, 7.8], [64.8, 8.48]],
  [libL(0.86, LIB.W), libL(LIB.dg1[0], LIB.W), libL(LIB.dg1[0], LIB.W + LIB_BED), libL(0.86, LIB.W + LIB_BED)],
];
/** the POND: an octagonal stone kerb about 3 x 3.7 m (map w1418668128; topo "POND", octagonal, about 3 x 2), dark still
 *  water 0.15 m below the kerb (brief), in a gravel enclosure at 64.44 - 64.49 (topo). Kerb width / height: G */
export const POND = { ring: [[90.7, 13.7], [90.5, 15.7], [91.0, 16.5], [92.4, 16.6], [93.0, 16.0], [93.3, 13.9], [92.6, 13.0], [91.4, 12.9]], kerbW: 0.3, kerbH: 0.18, y: Y(64.46), water: 0.15 };

// ------------------------------------------------------------------------------------------------ trees, shrubs, benches
/** trees: [u, v, height, crown radius, label]. K: the tree report's schedule (AIA 210239-PD-10, surveyed 2021): positions
 *  from its 1:500 survey (E / N of the Front Quad lawn's NW kerb corner (-13, -14) turned into LOCAL; +-1 m), heights and
 *  crown radii as surveyed; checked against the LIDAR crowns (the plane to 91 m above sea level over (66, 33)). One more
 *  small tree on the Mound where the LIDAR shows a 4 m crown (93, 30): G. The horse chestnuts are gone (18/00704) */
export const TREES = [
  [65.4, 6.7, 4.0, 3.6, 'T1 Japanese cherry'],
  [71.2, 4.8, 13.0, 3.1, 'T2 Thuja (2 stems)'],
  [76.0, 13.0, 22.0, 7.1, 'T3 silver birch'],
  [82.0, 24.3, 5.5, 3.2, 'T4 walnut (commemorative)'],
  [65.8, 32.9, 27.0, 11.6, 'T5 London plane'],
  [55.4, 30.8, 23.0, 5.2, 'T6 ginkgo'],
  [44.8, 29.7, 19.0, 6.0, 'T7 common lime'],
  [92.3, 30.8, 4.5, 2.0, 'small tree on the Mound (LIDAR crown only)'],
];
/** PLANTING (drawn by _exeter_plants.js: leaf-card shrubs over dark cores, kinds 'box' 'yew' 'laurel' 'gold' 'flower'
 *  'fern' 'hosta' 'lavender'). Per area: grid spacing `every` (m, jittered), crown radius r and height h ranges (m), the mix
 *  of kinds (weights), lod (1 near; lower = fewer, larger leaf cards for planting seen mostly from across the lawn).
 *  K what is seen: the bank a dense mass of dark evergreen shrubs 1.5 - 3 m with a yellow-green one and pink flowering
 *  plants (Japanese anemones) at the foot of stair 1 (09 "mound stair with handrail and planting (simononly 2012)", 09 "the
 *  Mound at east end ... (zh-wiki c2005)": the masses rise to about the walk's level and a little over); the Library's
 *  border a mixed one, shrubs 1 - 2 m, a dark cone, strap and broad leaves at the front, pink flowers by the door (08
 *  "library south face from Fellows Garden (exeter.ox.ac.uk c2017)"; lavender by the bench in 09 Simon Q 2010); the bay
 *  north of the path dark shrubs 1.5 - 2.5 m (Simon Q 2010, panorama 2012). G: the lane-side bed (bare dark soil in the
 *  winter panorama 2012, under the plane and the lime: sparse ferns and hostas guessed), every place and size, the mixes. */
export const PLANTING = {
  bank: { every: 1.7, r: [0.75, 1.4], h: [1.4, 2.9], mix: { laurel: 6, gold: 1, yew: 1, flower: 1 }, lod: 0.7 },
  bankFoot: { band: 1.4, every: 1.9, r: [0.45, 0.8], h: [0.6, 1.1], mix: { flower: 3, fern: 1, laurel: 1, hosta: 1 }, lod: 0.8, blooms: ['bloomPink', 'bloomWhite'] },
  plateau: { every: 2.3, r: [0.5, 1.0], h: [0.8, 1.7], mix: { laurel: 3, box: 1, flower: 1, gold: 1 }, lod: 0.55 },
  library: { every: 1.2, r: [0.45, 0.85], h: [0.7, 2.0], mix: { laurel: 3, flower: 2, box: 1, yew: 1, hosta: 1, lavender: 1 }, lod: 1, blooms: ['bloomPink', 'bloomMauve'] },
  lane: { every: 3.4, r: [0.35, 0.6], h: [0.35, 0.75], mix: { fern: 3, hosta: 2, laurel: 1 }, lod: 0.8 },
  bay: { every: 2.2, r: [0.5, 1.05], h: [0.9, 2.2], mix: { laurel: 3, yew: 1, box: 1, flower: 1 }, lod: 0.7, blooms: ['bloomWhite'] },
};
/** benches (u, v, and the point the seat faces). K: c.2005 photograph (two in front of the bank, one by
 *  stair 1), Simon Q 2010 and the panorama (on the lawn by the Library path); places G */
export const BENCHES = [[79.6, 28.6, 60, 18], [82.6, 26.0, 60, 18], [40.0, 12.2, 44, 24], [74.2, 11.6, 74, 24], [36.0, 9.5, 36, 20]];

// ------------------------------------------------------------------------------------------------ known and guessed
export const CHECKED = [
  ['garden: whole ground at its surveyed levels (lawn 64.08 - 64.35, rising to 64.45 - 64.7 at the edges)', 'K', 'LIDAR 2022 bare ground (2 m grid); topographic survey p20 of the tree report, 21/00354/FUL'],
  ['lawn outline', 'K', 'map w230240247; its north and south edges moved off the Library and the wall to fit the beds and paths (G +-0.5 m)'],
  ['gravel paths round the lawn, along the east range, round the pond', 'K', 'map w932806554, w1418668130, w1418668129; panorama 2012, Simon Q 2010 (gravel)'],
  ['lane-side path 2 m off the wall, not on the map\'s line (which runs through the trees T5 - T7)', 'G', 'map w1418668130 against the tree survey; panorama 2012'],
  ['planting beds: Library front, the lane wall\'s foot, the bay north of the path', 'K', 'panorama 2012, Freeman 2005, Simon Q 2010; widths G'],
  ['north edge on the Library\'s surveyed south face (30.92, 6.79) .. (50.25, 7.80), the link 0.3 behind it; the Convocation House\'s south face through v 8.33 at u 59.5 (was 9.1 - 9.4: the city\'s own mesh still stands on that line, a 0.9 m strip of earth shows between)', 'K', 'topographic survey 210239-P-10 registered on 18 walls (rms 0.21 m); _exeter_library_plan.js (moved Library)'],
  ['the Library bed 1.1 m deep between the buttresses, broken for the paving before DG1 (the first pass ran it through the door)', 'G', 'depth by eye (panorama 2012); the break K (the Library\'s paving and door)'],
  ['west edge on the east range\'s garden face 26.86 (v 6.4) .. 27.46 (v 31.6) round Peryam\'s two bays (0.8 out, bases 3.6, centres 16.2 / 25.7); the garden stops at the wall with the gate (v 4.07)', 'K', '_exeter_east_plan.js and _exeter_library_plan.js (survey registered)'],
  ['lane wall\'s west end at the range\'s south-east corner (27.46, 32.01) (was 26.8, 31.45)', 'K', '_exeter_east_plan.js (survey); the wall bends 0.5 deg there against the map\'s straight line (G)'],
  ['pond: octagonal stone kerb, dark still water 0.15 m down, gravel enclosure 64.46', 'K', 'map w1418668128; topo "POND" octagonal, 64.44 - 64.49; kerb size G'],
  ['the Mound: walk 66.76 (stair 2 head) .. 67.03 .. 67.12 (corner) .. 67.25 (stair 1 head)', 'K', 'topo 67.02 - 67.30; LIDAR surface 67.04 - 67.44 (the bare-ground model has filtered the Mound out)'],
  ['the Mound in plan: 20.7 m along the lane, 19 m along the square; the inner edge a planted bank, concave to the NW', 'K', '05/02492/FUL drg 3 (1:200); LIDAR; the bank\'s lines between cells G (+-0.7 m)'],
  ['bank profile: an S-curve from the lawn to the walk', 'K', 'topo spot levels 64.48, 64.57, 64.69, 65.20, 65.28, 66.39, 66.79, 67.02 up the slope'],
  ['walk 1.7 m gravel; on the lane side against the parapet, on the square side 0.75 m of planting between it and the wall', 'K', 'drg 3 (1.5 - 1.9 m, planting both sides), section AA; offsets G'],
  ['stair 1: 18 risers of 157 mm, goings 233 mm, 2.0 m overall, square to the lane wall, top 2.15 m from it, rounded foot landing', 'K', 'drg 3, section AA; topo (foot 64.42, head 67.25); the 179 mm the section scales is off its scale (DIMENSIONS contradiction 4)'],
  ['stair 1 side walls 0.4 m, their sloping coping 0.25 m over the nosings, an iron handrail 0.9 m on the west', 'G', 'section AA (a sloping coping and handrail); c.2005 photograph (a solid parapet)'],
  ['stair 2: 14 risers of 162 mm, goings 280 mm, 1.1 m clear, rising east square to the square\'s wall, top landing to 5.2 m, handrails both sides', 'K', 'section DD, drg 3, topo foot 64.49; landing length G'],
  ['stair 2: the leaning stone retaining wall along its north side, its top following the flight', 'K', 'drg 3 ("leaning stone retaining wall to be rebuilt"), section CC; thickness and top line G'],
  ['gardener\'s shed: stone box 3.5 x 2.8 m west of stair 1, its roof (67.30) part of the walk, a 0.3 m parapet and railings on N and W', 'K', 'drg 3; design statement; topo 67.30; its door G'],
  ['shed = the "Fellows\' Garden Substation" of the topo', 'G', 'topographic survey label at the Mound\'s south-west corner'],
  ['boundary wall line', 'K', 'map w113003418 moved 0.3 m out to the LIDAR\'s wall cells'],
  ['wall: coursed rubble, 0.6 m thick, a heavy flat slab coping with rounded arrises', 'K', 'corner look 2026-11-23, Rudiak-Gould 2008, Medarduss 2023; thickness and coping size G'],
  ['coping 67.75 at the east range rising to 68.15 at the shed; 0.9 m over the walk along the Mound (68.0 - 68.15)', 'K', 'LIDAR wall cells; design statement 850 - 960 mm; the straight rise G'],
  ['wall 4.0 - 4.4 m high outside at the Mound (lane 63.9 - 64.0, square 63.6 - 63.9), 2.8 - 3.3 m along the lawn', 'K', 'LIDAR; topo; corner look 2026-11-23 (4 - 4.5 m)'],
  ['Radcliffe Square corner: plain and square, the last 0.9 m each way ashlar', 'K', 'corner look 2026-11-23 (no pier); Rudiak-Gould 2008 (squared ashlar at the end); width G'],
  ['iron X tie and four square iron plates on the lane face near the east end', 'K', 'Rudiak-Gould 2008, Slowking4 2014, Basher Eyre 2011; positions +-1 m G'],
  ['NO perimeter railing on the parapet (drg 3 proposes one at 1100 mm)', 'K', 'Rudiak-Gould 2008 (people lean on the lane coping), Medarduss 2023 (square side): none seen'],
  ['small door in the lane wall at the SW corner, two steps down', 'G', 'topo ("stepped gate", 64.93 / 64.64); none seen in the photographs; its look a guess'],
  ['trees T1 - T7 at the surveyed places, heights and crown radii', 'K', 'AIA 210239-PD-10 (2021); LIDAR crowns'],
  ['tree shapes (the kit\'s broadleaf for all, the thuja and ginkgo narrower)', 'G', 'species K; form a stand-in'],
  ['shrubs on the bank: a dense mass of dark evergreens 1.3 - 2.7 m, a yellow-green one, a clipped cone; pink anemones and ferns at the foot', 'K', '09 simononly 2012 (mound stair with handrail and planting), zh-wiki c2005 (the Mound with two stairs); places, sizes and the mix G (seeded)'],
  ['planting on the Mound\'s top either side of the walk, 0.8 - 1.7 m', 'K', 'drg 3 ("planting both sides"); Medarduss 2023; places, sizes, kinds G'],
  ['the Library\'s border: mixed shrubs 0.6 - 1.9 m, a dark cone, broad / strap leaves at the front, pink and mauve flowers, lavender', 'K', '08 exeter.ox.ac.uk c2017; 09 Simon Q 2010 (lavender by the bench); places and sizes G'],
  ['the bed along the lane wall: sparse ferns and hostas under the plane and the lime', 'G', 'panorama 2012 (winter: bare dark soil); summer planting not seen'],
  ['the bay north of the path: dark shrubs 0.9 - 2.2 m round the cherry and the thuja', 'K', 'Simon Q 2010, panorama 2012; places, sizes, kinds G'],
  ['plants drawn as leaf cards over dark cores (shrubs 60 - 440 triangles by size; fewer, larger cards on the Mound\'s top, seen from below)', 'G', 'the look of the east range\'s creeper (accepted); colours by eye from the photographs'],
  ['the Library bed\'s shrubs and the creeper (lod 1, beside the path) clad in leaf-shaped cards (pointed ovals of two triangles, folded on the midrib, 0.62 of the old card, layered over a deeper core): _exeter_plants.js NEAR', 'G', 'by eye at 1.5 m against the spiky single triangles; sizes held to the college\'s 45 000-triangle planting budget'],
  ['benches: two before the bank, one by the Library path, one by the birch, one in the Library bed; one on the Mound at the view point', 'K', 'c.2005 photograph, Simon Q 2010, panorama 2012, drg 3 ("existing bench"); places G'],
  ['no lamps in the garden', 'K', '16/00769/LBC (garden lanterns only on the east range and the Library door: theirs)'],
];
