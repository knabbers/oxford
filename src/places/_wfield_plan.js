// Worcester College, the playing fields (places/worcester_fields.js; work package J of docs/research/worcester_survey.md,
// G08 and B25): frames, sizes, levels and the record of what is known. Pure: no THREE, no world (tools/smoke_worc_fields.mjs).
//
// THE SEASON. The game's calendar is Michaelmas term (systems/_weather_model.js: early October to early December and
// back), so the field is in its AUTUMN state: rugby posts and white pitch lines up, the cricket table roped off, the
// sight screen wheeled to the edge (K: the photograph of 29 September 2011 and the aerial picture of December 2023).
// What the summer pictures show (the boundary rope, stumps and creases, the screens at the ends) is not put out.
//
// LEVELS. The field is flat to 0.3 m (height survey, 57.2 m): everything here stands on local ground y = 0; every
// height is in LV. Nothing here is a stand-in for missing terrain except what TEMPORARY lists.
const qs = (typeof location !== 'undefined' && location && location.search) || '', env = (typeof process !== 'undefined' && process.env) || {};
/** `?wfield=0` (node: GTO_WFIELD=0): the fields as they were before this pass, for before / after pictures */
export const ON = !(/[?&]wfield=0(&|$)/.test(qs) || env.GTO_WFIELD === '0');

export const IDS = { field: 'w23153013', pavilion: 'w154770764', courts: ['w925090778', 'w925090777', 'w925090776'] };
/** heights above local ground, metres */
export const LV = {
  floor: 0.76,          // pavilion: veranda and room floor (K: four brick risers)
  eaves: 3.2, ridge: 6.95,      // ... its eaves' edge and ridge (K: height survey 4.0 over a 1 m cell at the eaves, 6.9 - 7.0)
  court: 0.05,          // tennis hardstanding and the nets' carpet over the grass
  fence: 2.74,          // the courts' chain-link fence (K: planning 14/03019/VAR, "+59.84" on ground 57.10)
  cage: 3.6,            // the cricket net cage (G: scaled off the maker's views against the 2.74 m fence)
  shedFloor: 0.3, shedDoor: 3.4, shedHi: 4.2, shedLo: 2.95,      // machinery shed: slab +57.40, door head +60.50, ridge +61.30 on ground +57.10 (K: the same application's section)
  post: 9.5, bar: 3.0,  // rugby posts (G: the 2011 photograph has them well over the pavilion's ridge)
};
export const TEMPORARY = [
  'the field is dead level (real: flat to 0.3 m, 57.0 - 57.45 m); the pavilion\'s floor is 0.76 m over it on every side (real: the ground at its back is not seen)',
];

// ------------------------------------------------------------------------------------------------ small maths
export function pip(x, z, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }
export function dSeg(x, z, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)) : 0; return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz); }
export function dRing(x, z, ring) { let d = 1e9; for (let i = 0; i < ring.length; i++) d = Math.min(d, dSeg(x, z, ring[i], ring[(i + 1) % ring.length])); return d; }
/** a frame on the ground: origin o, a along dir, b to the RIGHT of a seen from above with north up (a = north -> b = east) */
export function mkFrame(o, dir) {
  const l = Math.hypot(dir[0], dir[1]), ux = dir[0] / l, uz = dir[1] / l;
  return { o, ux, uz, bx: -uz, bz: ux, pt: (a, b) => [o[0] + a * ux - b * uz, o[1] + a * uz + b * ux], inv: (x, z) => [(x - o[0]) * ux + (z - o[1]) * uz, -(x - o[0]) * uz + (z - o[1]) * ux], yaw: Math.atan2(-uz, ux) };
}
/** keep the part of a polygon where n . p <= d (Sutherland - Hodgman, one half-plane) */
export function clipHP(poly, n, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = a[0] * n[0] + a[1] * n[1] - d, db = b[0] * n[0] + b[1] * n[1] - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
/** a polygon less a convex ring (given counter-clockwise or clockwise): -> pieces */
export function minusConvex(poly, ring) {
  let area = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = area > 0 ? 1 : -1, hp = ring.map((a, i) => { const b = ring[(i + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [(sg * (b[1] - a[1])) / l, (-sg * (b[0] - a[0])) / l]; return [n, n[0] * a[0] + n[1] * a[1]]; });      // n . p <= d inside
  const out = []; let rest = poly;
  for (const [n, d] of hp) { if (rest.length < 3) break; const outside = clipHP(rest, [-n[0], -n[1]], -d); if (outside.length >= 3) out.push(outside); rest = clipHP(rest, n, d); }
  return out;
}

// ------------------------------------------------------------------------------------------------ the pavilion (B25)
// c. 1900 (the college's history page), a rear extension of 1967 (planning 67/19551). K (three pictures in `20 sports
// pavilion/`, of 2013 and 2024, which agree on which end is which): one storey; a big hipped roof of orange-red plain
// tiles with bonnet hips sweeping down over a veranda along the field side; a gablet low on the front slope with white
// bargeboards and a white clock dial; a flat-topped dormer on each end hip; a red-brick stack on the short ridge; walls
// dark grey-green; the veranda on white posts with curved braces, a white balustrade in the three bays at its east end
// and the two at its west, the three between open over broad brick steps of four risers; at the east end a closed room
// with a small sash, standing forward flush with the veranda's edge; a black scoreboard lettered in white at the
// veranda's west end; two part-glazed white doors and two 12-pane casement pairs on its back wall.
// Frame: s along the front towards the WEST (a spectator on the field looking at it has s to the right), t out of
// the front (north, to the field). Sizes scaled off the square-on picture of 2024 against the mapped 14.8 m: G to 0.2 m.
export const PAV = (() => {
  const L = 14.8, D = 10.4, VER = 2.4;      // body length, depth; the veranda's depth
  const bays = [1.5, 1.5, 1.5, 1.65, 1.65, 1.65, 1.55, 1.55], s0 = -L / 2 + 2.25;      // the veranda's bays from its east end; the closed room east of it
  const posts = [s0]; for (const w of bays) posts.push(posts[posts.length - 1] + w);
  const front = D / 2, back = D / 2 - VER;      // t of the veranda's edge and of its back wall
  const stepC = (posts[3] + posts[6]) / 2;
  return {
    L, D, VER, bays, posts, front, back, room: [-L / 2, s0], ov: 0.45, ridgeHalf: 1.6,
    steps: { c: stepC, w: 5.2, n: 4, tread: 0.3 },
    gablet: { c: stepC, w: 3.8, base: 3.42, apex: 5.25, t: D / 2 - 0.15 },
    dormer: { in: 2.0, h: 0.95, w: 2.3 },      // on each end hip: how far in from the eaves' edge its front stands, its height and width
    stack: { s: -1.05, w: 1.05, d: 0.6, h: 0.95 },
    board: { s0: posts[6] + 0.1, s1: posts[8] + 0.05, y0: 1.72, y1: 2.9 },      // the scoreboard
    rear: { s0: -6.6, s1: 2.6, d: 3.2, h: 3.0 },      // the 1967 extension at the back (G: its form; the height survey has a low flat roof there)
    doors: [[-3.7, 0.86, 2.0, 'half'], [1.25, 1.3, 2.05, 'pair']], wins: [[-0.5, 1.15], [3.0, 1.15]],      // on the veranda's back wall: [s, width, height, kind], [s, width]
  };
})();
/** the pavilion's frame from its mapped outline (six points: the front edge runs from point 1 to point 4) */
export function pavFrame(poly) {
  const B = poly[1], C = poly[poly.length === 6 ? 4 : 2], A = poly[0], Dd = poly[poly.length - 1];
  const o = [(A[0] + B[0] + C[0] + Dd[0]) / 4, (A[1] + B[1] + C[1] + Dd[1]) / 4];
  return mkFrame(o, [B[0] - C[0], B[1] - C[1]]);      // a = s (west), b = t (north, out of the front)
}
/** drawn floor height on the veranda and its steps, in the pavilion's frame; null = not ours */
export function pavGroundY(s, t) {
  const P = PAV, st = P.steps;
  if (s >= P.room[1] && s <= P.L / 2 && t > P.back && t <= P.front) return LV.floor;
  if (Math.abs(s - st.c) <= st.w / 2 && t > P.front && t <= P.front + st.n * st.tread) { const k = Math.min(st.n - 1, Math.floor((t - P.front) / st.tread)); return (LV.floor * (st.n - 1 - k)) / st.n; }
  return null;
}

// ------------------------------------------------------------------------------------------------ tennis, the shed, the nets
// K (planning 14/03019/VAR, Niall McLaughlin Architects 2014: site plan, court layout, shed plan, section, elevation):
// three hard courts inside one green chain-link fence 2.74 m high: a two-court enclosure 34.75 x 33.53 m (exactly two
// courts with the standard 5.49 m behind the baselines, 3.66 m beside and 4.27 m between) and, along its south-east
// side behind a dividing curtain, a third court's enclosure 36.57 m long and 16.26 m wide, its south-west end in line
// with the other's and its north-east end 1.82 m beyond (the map's third court, centred 18.3 m along, bears that out); gates in the north-east and south-west fences. The gardeners' machinery shed stands 1.5 m
// outside the north-west fence: 21.0 x 5.5 m, six bays of 3.5 m, a mono-pitch metal roof (high side north-west, 4.2 m;
// low side at about the fence's height), timber cladding, five pairs of timber-clad doors 3.0 x 3.1 m on the north-west
// face, 6 m of hardstanding at its north-east end, the first 2.2 m under the overhanging roof.
// WHERE: the map's three court outlines (regulation 23.77 x 10.97 m rectangles, long axes north-east) fix the frame;
// the height survey has the shed's roof (26.5 x 6 m, 4.5 m on its north-west edge, 2.9 m on its south-east) with its
// centre at world (-637.7, -177.3), which puts its south-west gable SHED.a0 along the fence (G to a metre).
// K (planning 19/00432/FUL, 2019: site plan on the OS base, the maker's views): the two-lane cricket net cage, 25.77 x
// 7.66 m, green synthetic turf, black netting on a steel frame over the batting end, dark green boards; its long side
// parallel to the courts' north-east fence with a 0.83 m walkway between; its west corner about 5 m from the two-court
// enclosure's east corner on the plan. G: which end the batting end is (the north-west, nearest the courts), the
// cage's height and the length of its netted part (18.3 m).
export const TENNIS = { A: 34.75, B: 33.53, ext: { a0: 0, a1: 36.57, b0: 33.53, b1: 49.79 }, gates: [['ne', 26.0], ['ne', 38.2], ['sw', 30.6]], gateW: 1.2 };
export const SHED = { len: 21.0, w: 5.5, gap: 1.5, bay: 3.5, hard: 6.0, cover: 2.2, centre: [-637.7, -177.3], roofLen: 26.5 };
export const CAGE = { len: 25.77, w: 7.66, walk: 0.83, along: 4.4, netted: 18.3, lane: 3.66 };
/** -> { F (a north-east along the courts, b south-east), ring (the fence, world), courts: [[centre a, centre b]], shedA0 } from the map's three court outlines */
export function tennisLayout(courts) {
  const c0 = courts[0], e0 = [c0[1][0] - c0[0][0], c0[1][1] - c0[0][1]], e1 = [c0[2][0] - c0[1][0], c0[2][1] - c0[1][1]];
  let dir = Math.hypot(e0[0], e0[1]) > Math.hypot(e1[0], e1[1]) ? e0 : e1; if (dir[0] < 0) dir = [-dir[0], -dir[1]];      // the long side, pointing north-east
  const cen = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  const m = [cen(courts[0]), cen(courts[1])], mid = [(m[0][0] + m[1][0]) / 2, (m[0][1] + m[1][1]) / 2];
  const F0 = mkFrame(mid, dir), o = F0.pt(-TENNIS.A / 2, -TENNIS.B / 2), F = mkFrame(o, dir), T = TENNIS, E = T.ext;
  const ringAB = [[0, 0], [T.A, 0], [T.A, E.b0], [E.a1, E.b0], [E.a1, E.b1], [E.a0, E.b1]];
  // the two courts stand where the regulation margins put them; the third is centred in its own enclosure
  const cab = [[T.A / 2, 3.66 + 10.97 / 2], [T.A / 2, T.B - 3.66 - 10.97 / 2], [(E.a0 + E.a1) / 2, (E.b0 + E.b1) / 2]];
  const sc = F.inv(SHED.centre[0], SHED.centre[1]);
  return { F, ringAB, ring: ringAB.map((q) => F.pt(q[0], q[1])), courts: cab, shedA0: sc[0] + 0.75 - (SHED.len + SHED.hard) / 2, shedSeen: sc, mapped: courts.map((p) => F.inv(...cen(p))) };
}
/** the nets' rectangle in the tennis frame: [a0, a1, b0, b1] */
export const cageAB = () => { const a0 = TENNIS.ext.a1 + CAGE.walk, b0 = TENNIS.B + CAGE.along; return [a0, a0 + CAGE.w, b0, b0 + CAGE.len]; };

// ------------------------------------------------------------------------------------------------ the field
// The cricket table. K (`40 satellite (google maps)/cricket table satellite 51.756072,-1.267147.jpg`, 2026, measured
// off its 10 m scale bar: 9.8 px a metre, the picture's centre = world (-492.5, -118.5)): a close-mown table about
// 30 x 16.5 m whose middle is 3.0 m east and 1.8 m south of the picture's centre, i.e. world (-489.5, -116.7), its
// length bearing 135 degrees; a white cover sheet and a bare strip 22.9 m long on it, 7.8 m apart; a painted
// boundary line about 60 m out; the outfield mown in bands 4.6 m wide parallel to the table. The owner's bird's-eye
// picture (`reference/worcester college birdseye.png`), registered on the tennis courts and the pavilion, had given
// (-492.5, -118.5) +- 3 m: the same place. The architects' published site plan of the Shah Centre draws a dashed
// "Cricket Field" table 26 x 15.9 m at (-484.3, -117.1): 5 m further east, not followed.
export const TABLE = { c: [-489.5, -116.7], bearing: 135, len: 29.0, strips: 5, strip: 3.05, rope: 2.0 };
export const BANDS = { w: 4.6, bearing: 135 };
/** the croquet court's site (places/worcester_grounds.js COURT: centre, long axis 42 degrees, 32 x 25.6 m with a 4 m margin): the bands stop round it */
export const CROQUET = { c: [-436, -124], ang: (42 * Math.PI) / 180, w: 25.6, l: 32, m: 4.4 };
export function croquetRing() { const K = CROQUET, F = mkFrame(K.c, [Math.sin(K.ang), Math.cos(K.ang)]); return [[-K.l / 2 - K.m, -K.w / 2 - K.m], [K.l / 2 + K.m, -K.w / 2 - K.m], [K.l / 2 + K.m, K.w / 2 + K.m], [-K.l / 2 - K.m, K.w / 2 + K.m]].map((q) => F.pt(q[0], q[1])); }
/**
 * The rugby pitch (K that it is there in term: white H posts in front of the pavilion in the 2011 photograph; the
 * December 2023 aerial picture has one set near the pavilion and one near the tennis courts with white lines between.
 * G: its exact place and size): along the field's south-west side, parallel to it, clear of the cricket table.
 * field = the mapped field's outline. -> { F (a from the pavilion end's goal line to the far one, b to the north-east), len, w, lines, posts }
 */
export const RUGBY = { len: 92, w: 52, off: 30, start: 20, ingoal: 5 };
export function rugbyLayout(field) {
  const i = field.findIndex((p) => Math.hypot(p[0] + 508.1, p[1] + 34.9) < 1.5), P0 = i >= 0 ? field[i] : [-508.1, -34.9], P1 = i >= 0 ? field[(i + 1) % field.length] : [-604.2, -130.7];
  const E = mkFrame(P0, [P1[0] - P0[0], P1[1] - P0[1]]), R = RUGBY;      // a north-west along the field's edge, b to its right = north-east, into the field
  const o = E.pt(R.start, R.off - R.w / 2), F = mkFrame(o, [E.ux, E.uz]);
  const L = R.len, W = R.w, seg = (a0, b0, a1, b1) => [F.pt(a0, b0), F.pt(a1, b1)];
  const lines = [seg(0, 0, L, 0), seg(0, W, L, W), seg(0, 0, 0, W), seg(L, 0, L, W), seg(L / 2, 0, L / 2, W), seg(22, 0, 22, W), seg(L - 22, 0, L - 22, W), seg(-R.ingoal, 0, -R.ingoal, W), seg(L + R.ingoal, 0, L + R.ingoal, W), seg(-R.ingoal, 0, 0, 0), seg(-R.ingoal, W, 0, W), seg(L, 0, L + R.ingoal, 0), seg(L, W, L + R.ingoal, W)];
  return { F, len: L, w: W, lines, posts: [[0, W / 2], [L, W / 2]].map(([a, b]) => ({ p: F.pt(a, b), l: F.pt(a, b - 2.8), r: F.pt(a, b + 2.8) })) };
}

/** K = seen in a named picture / plan / measurement, G = a flagged guess: [what, K | G, what it rests on] */
export const CHECKED = [
  ['pavilion: where it stands, 14.8 x 10.4 m, facing the field (north-north-east)', 'K', 'the map\'s outline; the height survey (its roof lies about a metre north-east of the outline: not moved)'],
  ['pavilion: hipped roof of orange-red plain tiles, eaves 3.2 m, ridge 6.95 m, a short ridge', 'K', '20/pavilion - front (north-east side) square-on… (Apr 2024); height survey 6.9 - 7.0 m'],
  ['pavilion: clock gablet with white bargeboards low on the front slope, over the steps', 'K', 'the same picture; 20/pavilion - front in 2013…'],
  ['pavilion: a flat-topped dormer on each end hip', 'K', 'the 2024 square-on picture (east dormer), 20/pavilion - from the east along the lake path… (Jun 2024), 36/field - whole width… (2011: both)'],
  ['pavilion: red-brick stack with four pots on the ridge, east of the middle', 'K', 'the 2024 square-on picture'],
  ['pavilion: dark grey-green walls (pale blue-grey in 2013)', 'K', 'both 2024 pictures; the 2013 picture'],
  ['pavilion: veranda of eight bays on white posts with curved braces; balustrade in three bays at the east and two at the west; brick steps of four risers before the three open bays', 'K', 'the 2024 square-on picture; bay widths G to 0.15 m'],
  ['pavilion: closed room at the east end standing forward to the veranda\'s edge, a small sash in its front, a sash in the east wall', 'K', 'both 2024 pictures'],
  ['pavilion: black scoreboard lettered TOTAL / WKTS / OVERS / LAST INNS at the veranda\'s west end', 'K', 'the 2024 square-on picture'],
  ['pavilion: two white part-glazed doors and two 12-pane casement pairs on the veranda\'s back wall, two benches', 'K', 'the 2024 square-on picture; exact places G'],
  ['pavilion: west wall, back wall and the 1967 extension', 'G', 'not seen in any picture; planning 67/19551 ("additional changing accommodation and tea-rooms and garage for groundsman vehicles"); the height survey has a low flat roof about 3.6 m at the back: a flat-roofed boarded block with a pair of doors'],
  ['tennis: three hard courts in one 2.74 m green chain-link fence, 34.75 x 33.53 m + 36.57 x 16.26 m, dividing curtain, three gates', 'K', '36/PLAN tennis courts and gardeners machinery shed - 14-03019-VAR… (court layout sheet, site plan sheet)'],
  ['tennis: where the enclosure stands', 'K', 'the map\'s three court outlines (regulation rectangles); the third court\'s place inside its enclosure G to a metre'],
  ['tennis: green surround, blue-grey courts', 'K', 'the owner\'s bird\'s-eye picture'],
  ['machinery shed: 21.0 x 5.5 m, six bays, mono-pitch metal roof 4.2 m on the north-west, timber cladding, five pairs of timber doors, 6 m hardstanding', 'K', 'the same application\'s shed plan, section AA and north-west elevation'],
  ['machinery shed: where it stands', 'K', 'height survey: a roof 26.5 x 6 m centred (-637.7, -177.3), high side north-west; 1.5 m from the fence by the plan'],
  ['cricket nets: two-lane cage 25.77 x 7.66 m, green carpet, black netting on a steel frame, dark green boards, 0.83 m from the fence', 'K', '36/PLAN cricket nets three-dimensional views… (2018), …site plan with OS base… (2019); the owner\'s bird\'s-eye picture has it north-east of the third court'],
  ['cricket nets: height, netted length, which end is the batting end', 'G', 'scaled off the maker\'s views'],
  ['cricket table: where it is, its bearing', 'K', '40/cricket table satellite 51.756072,-1.267147.jpg (2026) measured off its scale bar: (-489.5, -116.7), 135 degrees; the owner\'s bird\'s-eye picture agrees to 3 m; the architects\' site plan draws it 5 m further east'],
  ['cricket table: 29 x 15.25 m, five strips', 'K', 'the same satellite picture (about 30 x 16.5 m); 18/snsc - DRAWING site plan 1-500… draws 26 x 15.9 m; the number of strips G'],
  ['cricket table roped off in term; no stumps, creases or boundary rope', 'K', '36/field - whole width with old cricket nets, roped square, rugby posts and pavilion… (29 Sep 2011)'],
  ['rugby posts in front of the pavilion and by the tennis courts, white pitch lines', 'K', 'the 2011 photograph; streetview/worcester aerial 2023 - down west… (Dec 2023)'],
  ['rugby pitch: its exact place and size (92 x 52 m)', 'G', 'laid along the south-west side clear of the cricket table'],
  ['white sight screen on wheels, parked at the north edge by the nets', 'K', 'the December 2023 aerial picture; 36/field - looking north across the outfield to a white sight screen (2013); exactly where: G'],
  ['mown in bands 4.6 m wide parallel to the table', 'K', 'the cricket table satellite picture; the owner\'s bird\'s-eye picture'],
  ['the field is a mown lawn (it was drawn as rough park grass with daisies)', 'K', 'every picture of it'],
  ['croquet lawn at the field\'s north-east corner', 'G', 'the owner: "croquet is played on the lawn near / behind the Earl Building"; no source locates it; the ground between the Shah Centre and the Earl Building is a planted garden (the published plan), so the court stays where it was'],
  ['old practice nets on green poles in the field\'s north-east', 'K', 'NOT BUILT: removed in 2019 (planning 19/00432/FUL)'],
  ['floodlights', 'K', 'none in any picture: none built'],
];
