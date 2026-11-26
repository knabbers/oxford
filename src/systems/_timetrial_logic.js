// The bike time trial (systems/timetrial.js): pure course data and the line-crossing test.
// Boathouses Walk, the riverside path in front of the college boathouses: a chalked start line, ~165 m of gravel by the
// river, a chalked finish (G: an invented "dash" that coaches and students might well time themselves on).
const S2 = Math.SQRT1_2;
const walkAt = (s, o) => [629 + S2 * s + S2 * o, 1225 + S2 * s - S2 * o];      // = _b4_boathouses.js at(s, o)
export const TRIALS = [
  { id: 'boathouses-dash', name: 'the Boathouses Walk dash', start: walkAt(10, 1.0), finish: walkAt(165, 1.0), dir: [S2, S2], half: 3.0, post: walkAt(7, -3.0),
    route: [walkAt(25, 1.0), walkAt(60, 1.0), walkAt(100, 1.0), walkAt(140, 1.0), walkAt(160, 1.0)] },
];
/** signed distance of (x, z) past line L (point p, direction d) along d, and the offset across it */
export function lineSide(p, d, x, z) { const dx = x - p[0], dz = z - p[1]; return [dx * d[0] + dz * d[1], -dx * d[1] + dz * d[0]]; }
/** did a move from (ax, az) to (bx, bz) cross the line forwards within half-width h? */
export function crossed(p, d, h, ax, az, bx, bz) {
  const [sa, oa] = lineSide(p, d, ax, az), [sb, ob] = lineSide(p, d, bx, bz);
  if (!(sa < 0 && sb >= 0)) return false;
  const t = sa / (sa - sb), o = oa + (ob - oa) * t;
  return Math.abs(o) <= h;
}
/** a point just before the start / just after the finish (for tests) */
export const before = (t) => [t.start[0] - t.dir[0] * 4, t.start[1] - t.dir[1] * 4];
export const after = (t) => [t.finish[0] + t.dir[0] * 4, t.finish[1] + t.dir[1] * 4];
export const fmt = (s) => `${Math.floor(s / 60) ? Math.floor(s / 60) + ':' + String((s % 60).toFixed(1)).padStart(4, '0') : s.toFixed(1) + ' s'}`;
