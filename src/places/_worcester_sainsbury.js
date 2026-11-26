// Worcester College: the Sainsbury Building (MacCormac Jamieson Prichard, 1982-83; map w69991357), rebuilt 2026-11-22
// from the photographs in `reference/worcester/14 sainsbury building/` and `35 lake bridges and island/`, the owner's
// photograph of Nash Quad (`reference/worcester/worcester building.jpg`), satellite picture S3 and the 2022 height
// survey (docs/research/worcester_survey.md, B18 and "Package E as built"). Looked at, never copied, never textures.
// Drawn by places/worcester.js through `buildSainsbury` (_worcester_ranges.js) in the college's atlas: atlas keys only.
//
// WHAT IT IS. Buff brick in three tiers that step down to the lake: a top tier of three storeys under slate roofs with
// glazed ridges (the core along the north, a short arm south and the block by the gate court), a middle tier of two
// storeys under slate skirts round a lead flat, and single-storey ends whose slate monopitches stand round planted
// flat roofs. In the angle of the two wings a brick-paved UPPER TERRACE; it is the roof of the Sainsbury Common Room,
// a glazed room on round concrete columns under two concrete slabs (the upper one is the terrace's parapet and bench).
// A flight goes down from each end of the terrace to the stone-flagged LOWER TERRACE at the water. The way through
// from Nash Quad (seven steps, a passage: places/worcester_nash.js) comes out three steps below the upper terrace.
//
// The frame is the mapped outline's (origin its north-west corner, a east along the west wing, b south): the height
// survey lies about (2.5, 1.5) m further east / south than the map here and is brought to the map, which the lake,
// Nash Quad and the paths are drawn on. Heights are above Nash Quad (58.0 m above sea level). What is KNOWN and what
// is a GUESS is in SB_ATTR. `?wsb=0` (node: GTO_WSB=0) draws the building as it was before this pass.
import * as THREE from 'three';
import { Batch, frame, rectPts } from './_worcester_kit.js';
import { paneWin } from './_worcester_ranges.js';
import { TERRAIN, terrainH } from '../world/terrain.js';

export const SB_REBUILT = !((typeof location !== 'undefined' && location && /[?&]wsb=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_WSB === '0'));
export const SAINSBURY = { id: 'w69991357', O: [-395.6, -120.6], th: 0.1052, storey: 2.8 };
export const SB_TERRACE = 1.12;                                  // the passage's floor above the court: seven risers
export const SB_PASSAGE = { b0: 17.25, b1: 19.65, h: SB_TERRACE + 2.3 };      // the passage through the south wing (b across it; h: its soffit above the court)

// ---- levels (m above Nash Quad). ONE place: everything below is written from these.
//   lake: the lower terrace: -1.0 (57.0 m: 0.2 m above the water, the height survey).
// THE DRAWN GROUND (world/terrain.js, 2026-11-22). The terrain holds 58.0 under the building and its upper terrace
// and 57.0 on the lower terrace, and lifts every drawn vertex by the ground under THAT vertex. A building authored
// level would shear wherever the field blends between the two, so this one is drawn RIGID: after the mesh is built
// each vertex's height is corrected by (the field at the datum point - the field under the vertex), which cancels the
// lift's differences: everything stands exactly as written here against the 58.0 datum, its lower terrace parts at
// the true -1.0. Walking heights on its flights are given likewise (real height less the field's difference), so the
// drawn player stays on the drawn steps and the heights the game walks on stay continuous with the flat ground.
// With the terrain off (`?terrain=0`) the flat world draws the lake at Nash Quad's own level: the lower terrace then
// stands on local ground (0.045), the common room shows 1.4 m of itself and the flights have nine risers.
// `?wsblake=real|flat` (node: GTO_WSBLAKE) forces either, for pictures and tests.
const _qs = typeof location !== 'undefined' && location.search ? location.search : '', _env = typeof process !== 'undefined' && process.env ? process.env : {};
const _force = (/[?&]wsblake=(real|flat)/.exec(_qs) || [])[1] || _env.GTO_WSBLAKE;
export const SB_REAL = _force === 'real' ? true : _force === 'flat' ? false : TERRAIN.mode === 'real';
export const SB_LV = { pass: SB_TERRACE, terr: 1.55, lake: SB_REAL ? -1.0 : 0.045, lakeReal: -1.0, lakeFlat: 0.045, f1: 4.35, f2: 7.15, low: 3.85, mid: 6.45, top: 8.8, ridge: 9.9 };
/** the datum point (frame): inside the building, where the field is its one 58.0 level */
const DATUM_AT = [27.0, 7.0];
const cs = Math.cos(SAINSBURY.th), sn = Math.sin(SAINSBURY.th);
/** frame (a, b) -> world [x, z] and back */
export const sbPt = (a, b) => [SAINSBURY.O[0] + a * cs + b * sn, SAINSBURY.O[1] - a * sn + b * cs];
export const sbInv = (x, z) => [(x - SAINSBURY.O[0]) * cs - (z - SAINSBURY.O[1]) * sn, (x - SAINSBURY.O[0]) * sn + (z - SAINSBURY.O[1]) * cs];

// ---- the plan (frame metres)
const PS = SB_PASSAGE;
const TER = { a0: 11.1, a1: 17.5, b0: 15.1, b1: 24.0, slab: 0.6, bench: 0.8 };      // the upper terrace over the common room
const CZ = { a0: 17.5, a1: 20.5, b0: 11.1, b1: 19.9 };                             // its corner piece in the angle of the wings
const CHAM = [[17.9, 11.1], [20.5, 13.7]];                                         // the entrance front across the angle
const RISE = 0.165, GO = 0.33, FLW = 1.6;
const nR = Math.max(2, Math.round((SB_LV.terr - SB_LV.lake) / RISE)), runLen = (nR - 1) * GO;
const FW = { b0: TER.b0, b1: TER.b0 + FLW, aTop: TER.a0, aFoot: TER.a0 - runLen };  // the west flight: down to the west along the terrace's north edge
const FS = { a0: TER.a1 - FLW, a1: TER.a1, bTop: TER.b1, bFoot: TER.b1 + runLen }; // the south flight: down to the south along its east edge
const UP = { a0: 19.6, a1: 20.5 };                                                 // three risers from the passage up to the terrace
// the low blocks with lead-clad planted tops: [ring, base y, top y]. H north of the terrace, I east of it, J on Nash Quad
const LOWB = {
  H: [[10.1, 15.1], [15.5, 15.1], [16.6, 14.0], [16.6, 11.05], [10.1, 11.05]],
  I: [[17.5, 24.0], [20.55, 24.0], [20.55, 19.9], [18.6, 19.9], [17.5, 21.0]],
  J: [[31.55, 24.6], [33.9, 24.6], [33.9, 21.1], [32.8, 20.0], [31.55, 20.0]],
};
// the mapped lake edge beside the building (frame): the quay's outer line
const QUAY = [[0.6, 15.9], [1.2, 30.9], [1.2, 32.6], [4.3, 32.5], [17.1, 32.1], [35.6, 30.8]];
const NORTH_RING = [[0, 0], [18.4, 0], [18.4, -4.6], [25.5, -4.6], [25.5, 3.8], [35.4, 3.8], [35.4, 10.9], [31.6, 10.9], [31.6, PS.b0], [20.5, PS.b0], [20.5, 13.7], [17.9, 11.1], [0, 11.1]];
const SOUTH_RING = [[20.5, PS.b1], [31.6, PS.b1], [31.6, 30.6], [27.8, 30.6], [27.8, 29.4], [24.5, 29.4], [24.5, 31.4], [20.5, 31.4]];
const toW = (ring) => ring.map(([a, b]) => { const p = sbPt(a, b); return [+p[0].toFixed(2), +p[1].toFixed(2)]; });
/** for the terrain (world x, z rings): one level, `datumOD`, under `outline` (both rings and the low blocks) and under
 *  `upperTerrace` (built +1.55 above it); the lower terrace `quay`, with the two `flights` that stand on it, out to the
 *  mapped lake edge at `quayOD`, flat right up to the structure: the blend between the two levels belongs INSIDE
 *  `outline` and `upperTerrace`, where no ground is seen (this building is drawn rigid: see SB_LV) */
export const SB_LEVELS = {
  datumOD: 58.0, quayOD: 57.0, lakeOD: 56.8, terraceOD: 58.0 + SB_LV.terr,
  outline: [toW(NORTH_RING), toW(SOUTH_RING), toW(LOWB.H), toW(LOWB.I), toW(LOWB.J)],
  upperTerrace: [toW([[TER.a0 - TER.slab, FW.b1], [TER.a0, FW.b1], [TER.a0, TER.b0], [CZ.a0, TER.b0], [CZ.a0, CZ.b0], [CZ.a1, CZ.b0], [CZ.a1, CZ.b1], [TER.a1, CZ.b1], [TER.a1, TER.b1], [FS.a0, TER.b1], [FS.a0, TER.b1 + TER.slab], [TER.a0 - TER.slab, TER.b1 + TER.slab]])],
  flights: [toW([[FW.aFoot, FW.b0], [FW.aTop, FW.b0], [FW.aTop, FW.b1], [FW.aFoot, FW.b1]]), toW([[FS.a0, FS.bTop], [FS.a1, FS.bTop], [FS.a1, FS.bFoot], [FS.a0, FS.bFoot]])],
  quay: [toW([...QUAY.slice(0, 5), [20.5, 31.9], [20.5, 31.4], [20.5, 24.0], [FS.a0, 24.0], [FS.a0, TER.b1 + TER.slab], [TER.a0 - TER.slab, TER.b1 + TER.slab], [TER.a0 - TER.slab, FW.b1], [TER.a0, FW.b1], [TER.a0, FW.b0], [LOWB.H[0][0], FW.b0], [LOWB.H[0][0], 11.1], [0, 11.1]])],      // (the lower terrace with the two flights that stand on it: 57.0 right up to this line)
  quayEdge: toW(QUAY),
  datumAt: (() => { const p = sbPt(DATUM_AT[0], DATUM_AT[1]); return [+p[0].toFixed(2), +p[1].toFixed(2)]; })(),      // (where this module reads the field's 58.0)
};
export const SB_TEMPORARY = [
  ...(SB_REAL ? [] : ['SB_LV.lake = 0.045 (local ground, the terrain being off): the lower terrace and the foot of the common room stand 1.0 m too high against the building. Real: -1.0 (SB_LV.lakeReal). The common room shows 1.4 m, the two flights have 9 risers instead of 15.']),
  'the rubble wall along the south wing stands on the mapped lake edge, 0.5 m from the building: the real bay is wider and has a planted border between the wall and the water',
];
/** attribute by attribute: [K | G, the picture, plan or measurement it rests on] */
export const SB_ATTR = {
  tiers: ['K', 'height survey (appendix A, re-read at 1 m): top 8.7-9.9 m, middle 6.4-7.5, low 3.8-5.0 above Nash Quad; which part is which tier'],
  walls: ['K', '14/… all photographs: buff stretcher-bond brick, no bands; exposed concrete lintels, slabs and planter beams; rubble piers and walls on the garden side'],
  windows: ['K', 'black-stained timber; projecting glazed corner bays on dark boxed sills at first and second floor (14/…upper brick terrace…, the owner\'s Nash Quad photograph). Where each one is: G except the ones named below'],
  topRoofs: ['K', 'S3 + height survey: slate, a ridge with a strip of glazing along it on the core and on the south arm; eaves 8.7, ridge 9.9'],
  midRoof: ['K', 'the owner\'s Nash Quad photograph, S3, height survey: slate skirts from eaves at 6.45 up to a flat at about 7.5 with rooflights'],
  lowEnds: ['K', 'S3, height survey, 14/garden-side wing… x2: slate monopitches (3.9 to 5.0) round planted flat roofs at 3.85, a concrete planter beam with lavender in the south recess, rubble piers, wide glazed bays. Which way each monopitch rises: G'],
  eastFront: ['K', 'the owner\'s Nash Quad photograph (true way round; the college JCR page\'s picture of the same front is MIRRORED): the passage, a first-floor black bay and a ground-floor window north of it, the top storey\'s corner bay over the passage\'s north side, the low canted bay with a triangular-headed window and lavender on its lead-clad top SOUTH of the steps'],
  upperTerrace: ['K', 'height survey (a level 1.5 m above Nash Quad, bench top 1.9), the map\'s paved court w169617915, 14/…upper brick terrace… x2, …terrace detail…: buff brick paviors, concrete parapet slab as a bench, low flanking blocks with angled windows and dark planted troughs'],
  terraceSteps: ['K', 'the owner\'s photograph and the JCR page\'s: steps going UP beyond the passage; 3 risers from the two levels (1.12 and 1.55)'],
  angle: ['K', '14/…upper brick terrace looking north-east…: a central opening with a black balustrade between brick piers, a door each side, a concrete lintel band, a projecting glazed bay with timber lights over it. G: that this front crosses the angle at 45 degrees, its size'],
  commonRoom: ['K', '14/…lake (south-west) front from the lower terrace…, …whole lake front…, 35/lake north arm…: a glazed room on round concrete columns under two board-marked concrete slabs, its corner to the lake. G: 3 columns a side as built here, glass 0.6 m inside them'],
  flights: ['K', 'same photographs (steel handrails each side of the room), S3, the map\'s steps w1480325739; height survey for where they run. G: riser count, that both are straight'],
  lowerTerrace: ['K', 'height survey (57.0 m), the map\'s garden w1480325738, 14/…lake front… x3: stone flags with planted beds, a straight stone edge at the water, a teak bench'],
  stairLink: ['K', '14/…entrance undercroft with glazed stair link above…: brick undercroft openings under concrete lintels, a black door, a black-framed glazed link with a boarded balustrade climbing diagonally. G: where it stands (the north stub\'s west part), which way it climbs'],
  northSide: ['G', 'windows and the door of the block by the gate court'],
  position: ['K', 'the mapped outline; the height survey shows the same shapes 2.5 m east / 1.5 m south of it'],
};

/** on one of the two flights: how far up it (t: 0 at the foot, 1 at the top) and a point on the ground just beyond its foot (frame), or null */
export function sbFlightAt(a, b) {
  if (a >= FW.aFoot && a < FW.aTop && b >= FW.b0 && b <= FW.b1) return { t: (a - FW.aFoot) / (FW.aTop - FW.aFoot), foot: [FW.aFoot - 0.1, (FW.b0 + FW.b1) / 2] };
  if (b > FS.bTop && b <= FS.bFoot && a >= FS.a0 && a <= FS.a1) return { t: (FS.bFoot - b) / (FS.bFoot - FS.bTop), foot: [(FS.a0 + FS.a1) / 2, FS.bFoot + 0.1] };
  return null;
}
/** height of the terrace, its flights and the three steps at a point of the frame, or null */
export function sbGroundY(a, b) {
  const L = SB_LV;
  if (b > PS.b0 - 0.15 && b < PS.b1 + 0.15 && a >= UP.a0 && a <= 31.65) return a >= UP.a1 ? L.pass : L.pass + ((L.terr - L.pass) * (UP.a1 - a)) / (UP.a1 - UP.a0);      // (the passage; east of it the landing and the seven steps are worcester_nash.js's)
  if (a >= FW.aFoot && a < FW.aTop && b >= FW.b0 && b <= FW.b1) return L.lake + ((L.terr - L.lake) * (a - FW.aFoot)) / (FW.aTop - FW.aFoot);
  if (b > FS.bTop && b <= FS.bFoot && a >= FS.a0 && a <= FS.a1) return L.lake + ((L.terr - L.lake) * (FS.bFoot - b)) / (FS.bFoot - FS.bTop);
  if (a >= TER.a0 && a <= TER.a1 && b >= TER.b0 && b <= TER.b1) return L.terr;
  if (a >= TER.a0 - TER.slab && a < TER.a0 && b >= FW.b1 && b <= TER.b1 + TER.slab) return L.terr;
  if (b > TER.b1 && b <= TER.b1 + TER.slab && a >= TER.a0 - TER.slab && a < FS.a0) return L.terr;
  if (a > 16.5 && a <= CZ.a1 + 0.3 && b >= CZ.b0 - 0.1 && b <= (a > TER.a1 ? 21.1 : TER.b0)) return L.terr;
  return null;
}

export function buildSainsburyNew(game, M) {
  const world = game.world, col = game.worldCollider, O = SAINSBURY.O, L = SB_LV;
  const pack = M._pack, K = pack && pack.cells;
  const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  const cell = (key, from, tint) => { if (K && K.get(from) && !K.get(key)) K.set(key, { ...K.get(from), tint: Array.isArray(tint) ? tint : lin(tint) }); };
  cell('sbConc', 'plaster', [0.72, 0.68, 0.6]); cell('sbConcD', 'plaster', [0.5, 0.48, 0.44]); cell('sbPaver', 'buff', [0.98, 0.9, 0.78]);
  cell('sbLeadD', 'lead', 0x4a4f55); cell('sbLav', 'leafC', 0x8f96a8); cell('sbLavF', 'flP', 0x9a86c4); cell('sbRubble', 'rubble', [1.12, 1.04, 0.86]);
  cell('sbGlassR', 'lead', 0x5f7684); cell('sbHyd', 'flR', 0xc9a9b6); cell('sbTeak', 'teak', [0.9, 0.86, 0.8]); cell('sbTimber', 'wood', 0xc98a4a);
  const B = new Batch();
  const grp = new THREE.Group(); grp.name = 'worcester-sainsbury';
  world.addStatic(grp);
  B.push(frame(O[0], 0, O[1], cs, -sn));      // x = a (east along the west wing), z = b (south)
  let bayN = 600;
  const bay = (y0) => [1 + (bayN++ % 251), y0 < 2.5 ? 0 : 1 + (bayN % 5)];
  const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

  // ---- faces of axis-aligned walls. k: n | s | w | e (the way the wall looks); u0 < u1 along it (a for n / s, b for
  // w / e); `at`: the other coordinate. Returns the frame and the map from the plan coordinate to the face's x.
  const FR = {
    n: (u0, u1, at) => [frame(u1, 0, at, -1, 0), (u) => u1 - u], s: (u0, u1, at) => [frame(u0, 0, at, 1, 0), (u) => u - u0],
    w: (u0, u1, at) => [frame(at, 0, u0, 0, 1), (u) => u - u0], e: (u0, u1, at) => [frame(at, 0, u1, 0, -1), (u) => u1 - u],
  };
  const WIN = { frame: 'frame', depth: 0.14, bar: 0.07 };
  const FOOT = Math.min(0, L.lake - 0.2);      // a wall standing on the ground runs down past the lower terrace: where the ground is higher it is in the ground
  /**
   * a wall: `top` a height or [[u, y], …] along it; y0 its foot. items: ['w', u0, u1, y0, y1, cols]  a window;
   * ['o', u0, u1, y0, y1, out, cols] a glazed bay standing `out` proud on a dark boxed sill; ['d', u0, u1, y0, y1] a
   * dark door under a concrete lintel; ['h', u0, u1, y0, y1] a plain hole (drawn elsewhere).
   */
  const wall = (k, u0, u1, at, y0, top, items = [], key = 'buff') => {
    const [F, toS] = FR[k](u0, u1, at), Lw = u1 - u0;
    let tp = (Array.isArray(top) ? top : [[u0, top], [u1, top]]).map(([u, y]) => [toS(u), y]);
    if (tp[0][0] < tp[tp.length - 1][0]) tp = tp.reverse();      // (given along u; the outline wants them from the face's far end back)
    const span = (it) => [Math.min(toS(it[1]), toS(it[2])), Math.max(toS(it[1]), toS(it[2]))];
    B.push(F);
    B.face(key, [[0, y0 === 0 ? FOOT : y0], [Lw, y0 === 0 ? FOOT : y0], ...tp], items.filter((it) => it[0] !== 'o').map((it) => { const [s0, s1] = span(it); return rectPts(s0, it[3], s1, it[4]); }));
    for (const it of items) {
      const [s0, s1] = span(it), ya = it[3], yb = it[4];
      if (it[0] === 'w') paneWin(B, s0, ya, s1, yb, bay(ya), { ...WIN, wall: key, cols: it[5] || (s1 - s0 > 1.5 ? 2 : 1) });
      else if (it[0] === 'd') { B.reveal(key, rectPts(s0, ya, s1, yb), 0, -0.2, true); B.unit('doorDark', rectPts(s0, ya, s1, yb), -0.18); B.box('sbConc', (s0 + s1) / 2, yb + 0.11, 0.03, s1 - s0 + 0.5, 0.22, 0.1, 0, { bottom: true }); }
      else if (it[0] === 'o') oriel(s0, s1, ya, yb, it[5] || 0.4, it[6] || Math.max(2, Math.round((s1 - s0) / 0.8)));
    }
    B.pop();
  };
  /** a glazed bay in the current face frame: black box, panes on its front and ends, a dark sill board, a lead top */
  const oriel = (s0, s1, ya, yb, out, cols) => {
    B.box('frame', (s0 + s1) / 2, (ya + yb) / 2, out / 2 + 0.01, s1 - s0, yb - ya, out - 0.02, 0, { bottom: true });
    B.push(T(0, 0, out + 0.012)); paneWin(B, s0 + 0.04, ya + 0.16, s1 - 0.04, yb - 0.08, bay(ya), { frame: 'frame', depth: 0, cols, bar: 0.07 }); B.pop();
    for (const [s, dx] of [[s0 - 0.012, -1], [s1 + 0.012, 1]]) { B.push(T(s, 0, 0.02).multiply(new THREE.Matrix4().makeRotationY((dx * Math.PI) / 2))); paneWin(B, dx > 0 ? -out + 0.02 : 0.02, ya + 0.16, dx > 0 ? -0.02 : out - 0.02, yb - 0.08, bay(ya), { frame: 'frame', depth: 0, cols: 1, bar: 0.06 }); B.pop(); }
    B.box('sbLeadD', (s0 + s1) / 2, yb + 0.04, out / 2 + 0.03, s1 - s0 + 0.12, 0.08, out + 0.06);
  };
  /** a roof plane as a thin slab: four (or three) top corners [a, y, b], slate above, black boards below and at its edges */
  let planeN = 0;
  const plane = (pts, key = 'slate', t = 0.14) => {
    const lo = pts.map((p) => [p[0], p[1] - t, p[2]]);
    B.poly(key, pts, [0, 1, 0]); B.poly('frame', lo, [0, -1, 0]);
    let cx = 0, cz = 0; for (const p of pts) { cx += p[0] / pts.length; cz += p[2] / pts.length; }
    // (its edge boards stand 12 to 26 mm proud of the slab, a different amount from one slab to the next: where a slab ends
    //  flush with a wall, or two slabs' edges pass one another in one plane, the faces are told apart at any distance)
    const e = 0.012 + (planeN++ % 3) * 0.007;
    for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length, mx = (pts[i][0] + pts[j][0]) / 2, mz = (pts[i][2] + pts[j][2]) / 2;
      let nx = pts[j][2] - pts[i][2], nz = -(pts[j][0] - pts[i][0]); const nl = Math.hypot(nx, nz) || 1, sg = nx * (mx - cx) + nz * (mz - cz) < 0 ? -1 : 1; nx *= (sg * e) / nl; nz *= (sg * e) / nl;
      B.poly('frame', [lo[i], lo[j], pts[j], pts[i]].map((q) => [q[0] + nx, q[1], q[2] + nz]), [mx - cx, 0, mz - cz]); }
  };
  /** a ridged slate roof over a0..a1, b0..b1: ridge along `ax` at `at`; eaves at ye, ridge at yr; overhang o (ends: oe) */
  const ridged = (a0, a1, b0, b1, ax, at, ye, yr, o = 0.5, oe = 0.3, glaze = null) => {
    if (ax === 'a') {
      const dn = ((yr - ye) / (at - b0)) * o, ds = ((yr - ye) / (b1 - at)) * o;
      plane([[a0 - oe, ye - dn, b0 - o], [a1 + oe, ye - dn, b0 - o], [a1 + oe, yr, at], [a0 - oe, yr, at]]);
      plane([[a0 - oe, yr, at], [a1 + oe, yr, at], [a1 + oe, ye - ds, b1 + o], [a0 - oe, ye - ds, b1 + o]]);
      if (glaze) B.boxXZ('sbGlassR', glaze[0], glaze[1], yr - 0.1, yr + 0.16, at - 0.55, at + 0.55);
    } else {
      const dw = ((yr - ye) / (at - a0)) * o, de = ((yr - ye) / (a1 - at)) * o;
      plane([[a0 - o, ye - dw, b0 - oe], [at, yr, b0 - oe], [at, yr, b1 + oe], [a0 - o, ye - dw, b1 + oe]]);
      plane([[at, yr, b0 - oe], [a1 + o, ye - de, b0 - oe], [a1 + o, ye - de, b1 + oe], [at, yr, b1 + oe]]);
      if (glaze) B.boxXZ('sbGlassR', at - 0.55, at + 0.55, yr - 0.1, yr + 0.16, glaze[0], glaze[1]);
    }
  };
  /** a slate monopitch over a0..a1, b0..b1 rising towards side `hi` from yl to yh; overhang o on the other three sides */
  const mono = (a0, a1, b0, b1, hi, yl, yh, o = 0.45) => {
    const A0 = a0 - (hi === 'w' ? 0 : o), A1 = a1 + (hi === 'e' ? 0 : o), B0 = b0 - (hi === 'n' ? 0 : o), B1 = b1 + (hi === 's' ? 0 : o);
    const run = hi === 'e' || hi === 'w' ? a1 - a0 : b1 - b0, d = ((yh - yl) / run) * o;
    const y = (a, b) => (hi === 'e' ? yl - d + ((yh - yl + d) * (a - A0)) / (A1 - A0) : hi === 'w' ? yl - d + ((yh - yl + d) * (A1 - a)) / (A1 - A0) : hi === 's' ? yl - d + ((yh - yl + d) * (b - B0)) / (B1 - B0) : yl - d + ((yh - yl + d) * (B1 - b)) / (B1 - B0));
    plane([[A0, y(A0, B0), B0], [A1, y(A1, B0), B0], [A1, y(A1, B1), B1], [A0, y(A0, B1), B1]]);
  };
  /** lavender on a planted roof: a low soil bed and a few mounds */
  const lavender = (a0, a1, b0, b1, y, n = 3) => {
    B.boxXZ('soil', a0, a1, y, y + 0.06, b0, b1);
    for (let i = 0; i < n; i++) { const a = a0 + ((a1 - a0) * (i + 0.5)) / n, b = (b0 + b1) / 2 + (i % 2 ? 0.18 : -0.18) * Math.min(1, b1 - b0), r = Math.min(0.62, (a1 - a0) / n / 1.9, (b1 - b0) / 1.9); B.cyl('sbLav', a, y + 0.05, b, r * 0.72, 0.42, 7, false, r); B.cyl('sbLavF', a, y + 0.47, b, r * 0.3, 0.16, 7, true, r * 0.72); }
  };

  // ================================================================= the top tier
  // B: the core along the north (ridge east-west, a strip of glazing along it)
  { const a0 = 15.8, a1 = 35.4, b0 = 3.8, b1 = 10.9, br = 6.9, ye = L.top - 0.05, yr = L.ridge, g = [[b0, ye - 0.12], [br, yr - 0.14], [b1, ye - 0.12]];
    wall('n', a0, a1, b0, 0, ye - 0.12, [['w', 26.6, 28.0, 1.95, 3.25], ['w', 29.6, 31.0, 1.95, 3.25], ['w', 32.6, 34.0, 1.95, 3.25], ['w', 26.6, 28.0, 4.9, 6.2], ['w', 29.6, 31.0, 4.9, 6.2], ['o', 32.9, 35.38, 4.7, 6.3, 0.4, 3], ['w', 27.6, 29.0, 7.4, 8.5], ['o', 32.9, 35.38, 7.3, 8.55, 0.4, 3], ['w', 16.3, 17.6, 7.4, 8.5]]);
    wall('e', b0, b1, a1, 0, g, [['w', 6.6, 8.0, 1.95, 3.25], ['o', 3.82, 5.6, 4.7, 6.3, 0.4, 2], ['o', 3.82, 5.6, 7.3, 8.55, 0.4, 2], ['o', 8.6, 10.88, 4.7, 6.3, 0.4, 3], ['o', 8.6, 10.88, 7.3, 8.55, 0.4, 3]]);
    wall('s', a0, a1, b1, 0, ye - 0.12, [['o', 32.6, 35.38, 4.7, 6.3, 0.4, 3], ['o', 32.6, 35.38, 7.3, 8.55, 0.4, 3], ['w', 32.4, 33.8, 1.95, 3.25], ['o', 17.0, 19.4, 7.3, 8.55, 0.45, 3], ['d', 16.75, 17.65, L.terr, L.terr + 2.05]]);
    wall('w', b0, b1, a0, L.mid - 0.2, g, [['w', 7.9, 9.3, 7.5, 8.5]]);
    ridged(a0, a1, b0, b1, 'a', br, ye, yr, 0.5, 0.35, [17.0, 31.0]); }
  // A: the block by the gate court (ridge north-south); its south end dies into the core's roof
  { const a0 = 21.0, a1 = 25.5, b0 = -4.6, b1 = 3.8, ar = 23.25, ye = 8.6, yr = 9.55;
    wall('n', a0, a1, b0, 0, [[a0, ye - 0.12], [ar, yr - 0.14], [a1, ye - 0.12]], [['d', 22.7, 23.8, 0.02, 2.15], ['w', 22.5, 24.0, 4.9, 6.2], ['w', 22.5, 24.0, 7.4, 8.5]]);
    wall('e', b0, b1, a1, 0, ye - 0.12, [['w', -3.4, -2.0, 1.95, 3.25], ['w', 0.4, 1.8, 1.95, 3.25], ['w', -3.4, -2.0, 4.9, 6.2], ['w', 0.4, 1.8, 4.9, 6.2], ['w', -3.4, -2.0, 7.4, 8.4], ['w', 0.4, 1.8, 7.4, 8.4]]);
    wall('w', b0, b1, a0, 0, ye - 0.12, [['w', -1.0, 0.4, 7.4, 8.4]]);
    ridged(a0, a1, b0, b1 + 2.4, 'b', ar, ye, yr, 0.45, 0.3); }
  // C: the top storey of the south arm (ridge north-south, glazed); its corner bay stands over the passage's north side
  { const a0 = 23.0, a1 = 29.8, b0 = 10.6, b1 = 18.3, ar = 26.4, ye = L.top + 0.05, yr = L.ridge;
    wall('s', a0, a1, b1, L.mid + 0.6, [[a0, ye - 0.12], [ar, yr - 0.14], [a1, ye - 0.12]], [['o', 27.4, 29.78, 7.3, 8.6, 0.4, 3], ['o', 23.02, 25.2, 7.3, 8.6, 0.4, 3]]);
    wall('e', b0, b1, a1, L.mid + 0.3, ye - 0.12, [['o', 15.9, 18.28, 7.3, 8.6, 0.4, 3], ['w', 12.2, 13.2, 7.6, 8.5, 1]]);
    wall('w', b0, b1, a0, L.mid + 0.3, ye - 0.12, [['o', 16.2, 18.28, 7.3, 8.6, 0.4, 3], ['w', 12.4, 13.6, 7.5, 8.5, 1]]);
    ridged(a0, a1, b0 - 3.4, b1, 'b', ar, ye, yr, 0.5, 0.35, [11.5, 17.6]); }

  // ================================================================= the middle tier
  // D: two storeys of the south arm, the passage through it; slate skirts up to a lead flat
  { const a0 = 20.5, a1 = 31.6, b0 = 10.9, b1 = 23.0, ye = L.mid, yf = 7.5, sk = 2.5;
    wall('e', b0, b1, a1, 0, ye - 0.1, [['h', PS.b0, PS.b1, L.pass, PS.h], ['w', 14.4, 16.2, 1.95, 3.2], ['o', 15.2, 16.8, 4.7, 6.3, 0.35, 2], ['w', 12.0, 13.2, 4.9, 6.2, 1], ['w', 20.6, 22.0, 4.9, 6.2]]);
    wall('w', b0, b1, a0, 0, ye - 0.1, [['h', PS.b0, PS.b1, L.pass, PS.h], ['d', 14.2, 15.1, L.terr, L.terr + 2.05], ['o', 13.9, 15.5, 4.7, 6.3, 0.35, 2], ['w', 20.6, 22.2, 4.9, 6.2]]);
    wall('s', a0, a1, b1, L.low - 0.3, ye - 0.1, [['w', 24.9, 26.0, 4.75, 6.1, 1], ['w', 26.4, 27.5, 4.75, 6.1, 1]]);
    for (const [k, at] of [['e', a1], ['w', a0]]) { const [F, toS] = FR[k](b0, b1, at); B.push(F); B.box('sbConc', toS((PS.b0 + PS.b1) / 2), PS.h + 0.11, 0.02, PS.b1 - PS.b0 + 0.5, 0.22, 0.08, 0, { bottom: true }); B.pop(); }      // the concrete lintels of the passage
    // skirts: east (the whole length), west (south of the entrance front), south, with hips at the two south corners
    const o = 0.5, d = ((yf - ye) / sk) * o, ys = ye - d, A0 = a0 - o, A1 = a1 + o, B1 = b1 + o, bN = 10.7;
    plane([[a1 - sk, yf, bN], [A1, ys, bN], [A1, ys, B1], [a1 - sk, yf, b1 - sk]]);
    plane([[A0, ys, 13.9], [a0 + sk, yf, 13.9], [a0 + sk, yf, b1 - sk], [A0, ys, B1]]);
    plane([[a0, ye, bN], [a0 + sk, yf, bN], [a0 + sk, yf, 13.9], [a0, ye, 13.9]]);      // (behind the entrance front: no overhang)
    plane([[a0 + sk, yf, b1 - sk], [a1 - sk, yf, b1 - sk], [A1, ys, B1], [A0, ys, B1]]);
    B.poly('lead', [[a0 + sk, yf, bN], [a1 - sk, yf, bN], [a1 - sk, yf, b1 - sk], [a0 + sk, yf, b1 - sk]], [0, 1, 0]);
    for (const a of [24.6, 27.4]) B.boxXZ('sbGlassR', a - 0.5, a + 0.5, yf, yf + 0.22, 19.0, 20.0);      // rooflights on the flat
    // the passage: brick sides, a concrete soffit, a paved floor at the head of the steps, three risers up to the terrace
    // (the cheek walls of worcester_nash.js run 0.3 m into the mouth, 1.9 m high: the sides stop at them and go on above them)
    for (const [b, n] of [[PS.b0, 1], [PS.b1, -1]]) { B.poly('buff', [[a0, 0, b], [31.3, 0, b], [31.3, PS.h, b], [a0, PS.h, b]], [0, 0, n]); B.poly('buff', [[31.3, 1.91, b], [a1, 1.91, b], [a1, PS.h, b], [31.3, PS.h, b]], [0, 0, n]); }
    B.poly('plasterLit', [[a0, PS.h, PS.b0], [a1, PS.h, PS.b0], [a1, PS.h, PS.b1], [a0, PS.h, PS.b1]], [0, -1, 0]);
    B.poly('sbPaver', [[a0, L.pass, PS.b0], [31.3, L.pass, PS.b0], [31.3, L.pass, PS.b1], [a0, L.pass, PS.b1]], [0, 1, 0]);      // (its landing begins at 31.3)
    for (const [a, b, h] of [[33.2, 12.4, 3.6], [34.4, 13.6, 3.1], [33.6, 15.0, 3.4], [34.9, 11.6, 2.8], [32.6, 14.0, 3.2], [35.2, 14.9, 2.9]]) for (const [da, db, k] of [[0, 0, 'leafB'], [0.22, 0.12, 'leafC'], [-0.15, 0.2, 'leafA']]) { B.cyl('leafC', a + da, 1.3, b + db, 0.035, h - 1.9, 5, false); B.cyl(k, a + da, h - 1.1, b + db, 0.1, 0.9, 6, true, 0.3); B.cyl(k, a + da, h - 1.75, b + db, 0.26, 0.65, 6, false, 0.12); }      // bamboo behind the court wall (the owner's photograph): canes with a plume each
    const n = 3, r = (L.terr - L.pass) / n, go = (UP.a1 - UP.a0) / n;
    for (let i = 0; i < n; i++) B.boxXZ('sbPaver', UP.a0, UP.a1 - i * go, L.pass + i * r - (i ? 0 : 0.3), L.pass + (i + 1) * r - (i === n - 1 ? 0.006 : 0), PS.b0, PS.b1); }      // (each riser stands on the one below: no faces shared)
  // K: the entrance front across the angle, one storey of openings and a storey with the glazed bay; slate over it
  { const [p, q] = CHAM, l = Math.hypot(q[0] - p[0], q[1] - p[1]), y0 = L.terr, yh = y0 + 2.25, mid = l / 2, ye = L.mid;
    const holes = [rectPts(0.2, y0, 0.65, yh), rectPts(mid - 0.78, y0, mid + 0.78, yh), rectPts(l - 0.65, y0, l - 0.2, yh)];
    B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1]));
    B.face('buff', rectPts(0, 0, l, ye - 0.1), holes);
    for (const h of holes) { B.reveal('buff', h, 0, -0.7, true); B.poly('dark', h.map((c) => [c[0], c[1], -0.7]), [0, 0, 1]); }
    B.box('sbConc', mid, yh + 0.12, 0.03, l - 0.1, 0.24, 0.1, 0, { bottom: true });                                   // the lintel band
    for (const y of [y0 + 0.5, y0 + 1.0]) B.box('iron', mid, y, -0.12, 1.56, 0.05, 0.05, 0, { bottom: true });        // the stair well's balustrade
    for (const s of [mid - 0.74, mid, mid + 0.74]) B.box('iron', s, y0 + 0.5, -0.12, 0.04, 1.0, 0.04);
    oriel(mid - 1.25, mid + 1.25, 4.6, 6.2, 0.5, 4);
    for (const s of [mid - 1.25, mid + 1.25]) B.box('sbTimber', s + Math.sign(s - mid) * 0.3, 5.45, 0.56, 0.62, 1.3, 0.05, Math.sign(s - mid) * 0.7, { bottom: true });      // the timber lights standing open
    B.pop();
    plane([[p[0] - 0.7, ye - 0.18, 10.8], [q[0], ye - 0.18, q[1] + 0.4], [q[0], 6.95, 10.8]]); }
  // W2: the two-storey part of the west wing (ridge east-west)
  { const a0 = 9.2, a1 = 16.0, b0 = 0, b1 = 11.1, br = 5.55, ye = L.mid, yr = 7.5, g = [[b0, ye - 0.1], [br, yr - 0.14], [b1, ye - 0.1]];
    wall('n', a0, a1 + 2.4, b0, 0, ye - 0.1, [['w', 10.2, 11.6, 1.95, 3.25], ['w', 13.4, 14.8, 1.95, 3.25], ['w', 10.2, 11.6, 4.9, 6.2], ['w', 13.4, 14.8, 4.9, 6.2], ['w', 16.4, 17.8, 4.9, 6.2]]);
    wall('s', a0, a1, b1, 0, ye - 0.1, [['o', 9.22, 11.4, 4.7, 6.3, 0.4, 3], ['w', 13.0, 14.4, 4.9, 6.2]]);
    wall('w', b0, b1, a0, L.low - 0.3, g, [['o', 3.6, 7.5, 4.7, 6.2, 0.35, 4]]);
    ridged(a0, a1 + 2.4, b0, b1, 'a', br, ye, yr, 0.5, 0.35);
    B.poly('buff', [[a1 + 2.4, 6.9, b0], [a1 + 2.4, 6.9, 3.8], [a1 + 2.4, 7.1, 3.8], [a1 + 2.4, ye - 0.1, b0]], [1, 0, 0]); }

  // ================================================================= the single-storey ends
  const ey = L.low - 0.05;      // their eaves
  // W1: the west end at the water: monopitches on three sides of a planted flat roof
  { const g = [[0, ey], [4.2, 4.9], [4.2, ey], [9.2, ey]];
    wall('n', 0, 9.2, 0, 0, g, [['o', 0.02, 2.4, 1.7, 3.3, 0.4, 3], ['w', 5.2, 6.6, 1.95, 3.25], ['w', 7.4, 8.8, 1.95, 3.25]]);
    wall('s', 0, 9.2, 11.1, 0, g, [['o', 0.02, 2.6, 1.7, 3.3, 0.4, 3], ['w', 4.8, 6.2, 1.95, 3.25], ['d', 7.2, 8.1, 0.9, 2.95]]);
    wall('w', 0, 11.1, 0, 0, ey, [['o', 0.02, 2.2, 1.7, 3.3, 0.4, 3], ['w', 4.8, 6.3, 1.95, 3.25], ['o', 8.7, 11.08, 1.7, 3.3, 0.4, 3]]);
    mono(0, 4.2, 0, 11.1, 'e', L.low, 5.0); mono(4.2, 9.25, 0, 4.0, 's', L.low, 4.6); mono(4.2, 9.25, 9.0, 11.1, 'n', L.low, 4.5);
    wall('e', 4.0, 9.0, 4.2, L.low, 4.9, [['w', 4.4, 8.6, 4.0, 4.75, 5]], 'frame');
    wall('s', 4.2, 9.2, 4.0, L.low, 4.5, [], 'frame'); wall('n', 4.2, 9.2, 9.0, L.low, 4.4, [], 'frame');
    wall('e', 0, 4.0, 4.2, L.low - 0.15, 4.9, []); wall('e', 9.0, 11.1, 4.2, L.low - 0.15, 4.9, []);
    B.poly('lead', [[4.2, L.low, 4.0], [9.2, L.low, 4.0], [9.2, L.low, 9.0], [4.2, L.low, 9.0]], [0, 1, 0]);
    B.boxXZ('sbConcD', 5.0, 8.6, L.low, L.low + 0.4, 4.8, 5.3); B.boxXZ('sbConcD', 5.0, 5.5, L.low, L.low + 0.4, 5.3, 8.2);      // the L-shaped planter (S3)
    lavender(5.05, 8.55, 4.85, 5.25, L.low + 0.36, 4); }
  // E: the south end: monopitches rising to a planted roof in the middle, rubble piers and wide glazed bays to the water
  { const gW = [[20.5, ey], [24.3, 4.9]], gE = [[28.0, 5.0], [31.6, ey]];
    wall('s', 20.5, 24.5, 31.4, 0, [[20.5, ey], [24.3, 4.9], [24.5, 4.9]], [['o', 20.52, 23.4, 1.7, 3.4, 0.4, 4]]);
    wall('s', 23.7, 24.5, 31.42, 0, 4.92, [], 'sbRubble');                                             // its rubble pier
    wall('e', 29.4, 31.4, 24.5, 0, 4.9, [], 'sbRubble'); wall('w', 29.4, 30.6, 27.8, 0, 5.0, [], 'sbRubble');
    wall('s', 24.5, 27.8, 29.4, 0, L.low, [['w', 25.2, 27.1, 1.95, 3.25, 3]]);
    wall('s', 27.8, 31.6, 30.6, 0, [[27.8, 5.0], [28.0, 5.0], [31.6, ey]], [['o', 28.8, 31.58, 1.7, 3.5, 0.4, 4]]);
    wall('s', 27.8, 28.6, 30.62, 0, 5.02, [], 'sbRubble');
    wall('e', 23.0, 30.6, 31.6, 0, ey, [['w', 25.4, 26.8, 1.95, 3.25], ['o', 28.4, 30.58, 1.7, 3.5, 0.4, 3]]);
    wall('w', 23.0, 31.4, 20.5, 0, ey, [['w', 25.0, 26.4, 1.95, 3.25], ['o', 29.0, 31.38, 1.7, 3.4, 0.4, 3]]);
    mono(20.5, 24.3, 23.0, 31.4, 'e', L.low, 4.95); mono(28.0, 31.6, 23.0, 30.6, 'w', L.low, 5.05);
    wall('e', 23.0, 29.4, 24.3, L.low, 4.9, [['w', 23.6, 28.8, 4.0, 4.75, 6]], 'frame'); wall('w', 23.0, 29.4, 28.0, L.low, 5.0, [['w', 23.6, 28.8, 4.0, 4.85, 6]], 'frame');
    B.poly('lead', [[24.3, L.low, 23.0], [28.0, L.low, 23.0], [28.0, L.low, 29.4], [24.3, L.low, 29.4]], [0, 1, 0]);
    B.boxXZ('sbConc', 24.4, 27.9, L.low - 0.05, L.low + 0.5, 29.0, 29.55, { bottom: true }); lavender(24.5, 27.8, 29.08, 29.47, L.low + 0.46, 4);      // the planter beam and its lavender
    B.boxXZ('sbGlassR', 25.5, 26.8, L.low, L.low + 0.3, 25.2, 26.5); }      // the square rooflight (S3)
  // the low blocks: brick to a lead-clad trough with lavender; a window with a triangular head in the canted corner
  for (const [name, ring] of Object.entries(LOWB)) {
    const yT = name === 'J' ? 4.0 : L.low + 0.05, yP = yT + 0.45, n = ring.length, cant = name === 'H' ? 1 : name === 'I' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const p = ring[i], q = ring[(i + 1) % n], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if ((name === 'H' && i === 3) || (name === 'I' && i === 1) || (name === 'J' && i === 4)) continue;      // (the side against the wing)
      B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1]));
      const fy = name === 'J' ? L.pass : L.terr, hole = i === cant ? [rectPts(0.3, fy + 0.8, l - 0.3, fy + 2.3)] : [];
      B.face('buff', rectPts(0, FOOT, l, yT), hole);
      if (hole.length) { paneWin(B, 0.3, fy + 0.8, l - 0.3, fy + 2.3, bay(fy), { ...WIN, cols: 1, depth: 0.22 }); B.beam('frame', [0.33, fy + 1.9, -0.19], [l - 0.33, fy + 2.27, -0.19], 0.05); }
      B.box('sbLeadD', l / 2, (yT + yP) / 2, 0.02, l + 0.1, yP - yT, 0.12, 0, { bottom: true });
      B.pop();
    }
    B.flat('sbLeadD', ring, yP - 0.14);
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of ring) { a0 = Math.min(a0, p[0]); a1 = Math.max(a1, p[0]); b0 = Math.min(b0, p[1]); b1 = Math.max(b1, p[1]); }
    if (a1 - a0 > b1 - b0) lavender(a0 + 0.3, a1 - 1.2, b0 + 0.5, b1 - 0.5, yP - 0.16, 5);
    else { B.push(frame((a0 + a1) / 2, 0, b0, 0, 1)); lavender(0.9, b1 - b0 - 0.4, -(a1 - a0) / 2 + 0.4, (a1 - a0) / 2 - 0.4, yP - 0.16, name === 'J' ? 3 : 4); B.pop(); }
  }
  // L: the glazed stair link on the gate-court side: brick undercroft openings under concrete lintels, a black door,
  // black-framed glazing over a boarded balustrade that climbs with the stair, a lead flat
  { const a = 18.4, b0 = -4.6, b1 = 0, yT = 7.0, [F] = FR.w(b0, b1, a), l = b1 - b0;
    B.push(F);
    const brick = [[0, 0], [l, 0], [l, 3.3], [l * 0.42, 3.3], [0, 5.6]], op = [rectPts(1.0, 0.02, 2.2, 2.45), rectPts(2.8, 0.02, 4.0, 2.45)];
    B.face('buff', brick, op);
    for (const h of op) { B.reveal('buff', h, 0, -0.5, true); B.poly('dark', h.map((c) => [c[0], c[1], -0.5]), [0, 0, 1]); B.box('sbConc', (h[0][0] + h[1][0]) / 2, 2.57, 0.03, 1.5, 0.24, 0.1, 0, { bottom: true }); }
    B.unit('doorDark', rectPts(1.15, 0.02, 2.05, 2.1), -0.48);
    B.face('frame', [[l, 3.3], [l, yT], [0, yT], [0, 5.6], [l * 0.42, 3.3]]);
    B.push(T(0, 0, 0.02));
    for (let i = 0; i < 4; i++) { const x0 = 0.1 + (i * (l - 0.2)) / 4, x1 = 0.1 + ((i + 1) * (l - 0.2)) / 4 - 0.08, yb = Math.max(3.4, 5.6 - ((x0 + x1) / 2 / (l * 0.42)) * 2.3) + 1.0; if (yT - 0.15 - yb > 0.5) paneWin(B, x0, yb, x1, yT - 0.15, bay(4), { frame: 'frame', depth: 0, cols: 1, bar: 0.06 }); }
    B.pop(); B.pop();
    wall('n', a, 21.0, b0, 0, yT, [['w', 18.9, 20.5, 5.0, 6.6, 2]]);
    B.poly('lead', [[a, yT, b0], [21.0, yT, b0], [21.0, yT, 3.8], [a, yT, 3.8]], [0, 1, 0]);
    B.boxXZ('frame', a - 0.05, 21.0, yT - 0.12, yT + 0.06, b0 - 0.05, b0 + 0.1, { bottom: true }); }

  // ================================================================= the upper terrace over the common room
  { const y = L.terr, yl = L.lake, t = 0.35, sA = TER.a0 - TER.slab, sB = TER.b1 + TER.slab;
    // paviors: the terrace, its corner piece up to the entrance front
    B.flat('sbPaver', [[TER.a0, TER.b0], LOWB.H[1], LOWB.H[2], [16.6, CZ.b0], [CHAM[0][0], CZ.b0], CHAM[1], [CZ.a1, PS.b0], [UP.a0, PS.b0], [UP.a0, PS.b1], [CZ.a1, PS.b1], [CZ.a1, CZ.b1], LOWB.I[3], LOWB.I[4], [TER.a1, TER.b1], [TER.a0, TER.b1]], y + 0.008);
    B.poly('sbPaver', [[TER.a0, y - (L.terr - L.lake) / nR, FW.b0], [TER.a0, y - (L.terr - L.lake) / nR, FW.b1], [TER.a0, y, FW.b1], [TER.a0, y, FW.b0]], [-1, 0, 0]);      // the top risers of the two flights
    B.poly('sbPaver', [[FS.a0, y - (L.terr - L.lake) / nR, TER.b1], [FS.a1, y - (L.terr - L.lake) / nR, TER.b1], [FS.a1, y, TER.b1], [FS.a0, y, TER.b1]], [0, 0, 1]);
    // the lower slab (the terrace's own edge) and, set back on it, the upper slab: the parapet you sit on
    B.boxXZ('sbConc', sA, TER.a0 + 0.02, y - t, y, FW.b1, sB, { bottom: true }); B.boxXZ('sbConc', TER.a0 + 0.02, FS.a0, y - t, y, TER.b1 - 0.02, sB, { bottom: true });
    B.boxXZ('sbConc', TER.a0, TER.a0 + TER.bench, y + 0.12, y + 0.45, FW.b1 + 0.2, TER.b1, { bottom: true }); B.boxXZ('sbConc', TER.a0 + TER.bench, FS.a0 - 0.2, y + 0.12, y + 0.45, TER.b1 - TER.bench, TER.b1, { bottom: true });
    B.boxXZ('sbConcD', TER.a0 + 0.15, TER.a0 + TER.bench - 0.15, y, y + 0.12, FW.b1 + 0.5, TER.b1 - 0.15, { top: false }); B.boxXZ('sbConcD', TER.a0 + TER.bench, FS.a0 - 0.5, y, y + 0.12, TER.b1 - TER.bench + 0.15, TER.b1 - 0.15, { top: false });
    // the room: glass 0.6 m inside the slab's edge, round columns outside it, a dark soffit
    const gA = TER.a0, gB = TER.b1, cA = sA + 0.28, cB = sB - 0.28;
    { const [F] = FR.w(FW.b1, gB, gA); B.push(F); paneWin(B, 0.05, yl + 0.06, gB - FW.b1, y - t, bay(0), { frame: 'frame', depth: 0, cols: 5, bar: 0.07 }); B.pop(); }
    { const [F] = FR.s(gA, FS.a0, gB); B.push(F); paneWin(B, 0, yl + 0.06, FS.a0 - gA - 0.05, y - t, bay(0), { frame: 'frame', depth: 0, cols: 4, bar: 0.07 }); B.pop(); }
    for (const [a, b] of [[cA, cB], [cA, (FW.b1 + cB) / 2 + 0.1], [cA, FW.b1 + 0.3], [(cA + FS.a0) / 2, cB], [FS.a0 - 0.3, cB]]) B.cyl('sbConc', a, yl, b, 0.21, y - t - yl, 10, false);
    B.boxXZ('sbConcD', sA, gA, yl, yl + 0.06, FW.b1, sB); B.boxXZ('sbConcD', gA, FS.a0, yl, yl + 0.06, gB, sB);      // the paved apron under the slab
  }
  // the two flights (brick treads between brick walls, a steel handrail on each wall) and the way they land
  { const y = L.terr, yl = L.lake, r = (y - yl) / nR;
    for (let i = 0; i < nR - 1; i++) {
      const yt = y - (i + 1) * r;
      B.boxXZ('sbPaver', FW.aTop - (i + 1) * GO, FW.aTop - i * GO, yl - 0.02, yt, FW.b0, FW.b1);
      B.boxXZ('sbPaver', FS.a0, FS.a1, yl - 0.02, yt, FS.bTop + i * GO, FS.bTop + (i + 1) * GO);
    }
    /** a brick wall 0.24 m thick from plan point p to q, its concrete-capped top going from t0 to t1 */
    const slopeWall = (p, q, t0, t1) => {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]), o = [[0, yl - 0.02], [l, yl - 0.02], [l, t1], [0, t0]];
      B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1]));
      B.face('buff', o, [], 0.12); B.face('buff', o, [], -0.12, true);
      B.poly('sbConc', [[0, t0, -0.12], [l, t1, -0.12], [l, t1, 0.12], [0, t0, 0.12]], [0, 1, 0]);
      B.poly('buff', [[0, yl - 0.02, -0.12], [0, yl - 0.02, 0.12], [0, t0, 0.12], [0, t0, -0.12]], [-1, 0, 0]); B.poly('buff', [[l, yl - 0.02, -0.12], [l, yl - 0.02, 0.12], [l, t1, 0.12], [l, t1, -0.12]], [1, 0, 0]);
      B.pop();
    };
    const tW = (a) => yl + (y - yl) * Math.max(0, Math.min(1, (a - FW.aFoot) / (FW.aTop - FW.aFoot))) + 0.9, tS = (b) => yl + (y - yl) * Math.max(0, Math.min(1, (FS.bFoot - b) / (FS.bFoot - FS.bTop))) + 0.9;
    const sA = TER.a0 - TER.slab, sB = TER.b1 + TER.slab, hA = LOWB.H[0][0];
    slopeWall([FW.aFoot - 0.3, FW.b0 - 0.12], [hA, FW.b0 - 0.12], tW(FW.aFoot - 0.3), tW(hA));            // west flight: north side, up to block H
    slopeWall([FW.aFoot - 0.3, FW.b1 + 0.12], [sA, FW.b1 + 0.12], tW(FW.aFoot - 0.3), tW(sA));            // ... south side, up to the room's slab
    slopeWall([FS.a0 - 0.12, sB], [FS.a0 - 0.12, FS.bFoot + 0.3], tS(sB), tS(FS.bFoot + 0.3));            // south flight: west side, from the slab
    slopeWall([FS.a1 + 0.12, TER.b1], [FS.a1 + 0.12, FS.bFoot + 0.3], tS(TER.b1), tS(FS.bFoot + 0.3));    // ... east side, from block I
    for (const hb of [FW.b0 + 0.07, FW.b1 - 0.07]) {
      B.beam('alu', [FW.aFoot, yl + 0.95, hb], [FW.aTop, y + 0.95, hb], 0.04);
      for (const f of [0, 0.5, 1]) B.boxXZ('alu', FW.aFoot + runLen * f - 0.02, FW.aFoot + runLen * f + 0.02, yl + (y - yl) * f, yl + (y - yl) * f + 0.95, hb - 0.02, hb + 0.02, { top: false });
    }
    for (const ha of [FS.a0 + 0.07, FS.a1 - 0.07]) {
      B.beam('alu', [ha, y + 0.95, FS.bTop], [ha, yl + 0.95, FS.bFoot], 0.04);
      for (const f of [0, 0.5, 1]) B.boxXZ('alu', ha - 0.02, ha + 0.02, y - (y - yl) * f, y - (y - yl) * f + 0.95, FS.bTop + runLen * f - 0.02, FS.bTop + runLen * f + 0.02, { top: false });
    }
  }

  // ================================================================= the lower terrace at the water
  // (its flags and beds are ordinary map ground: places/worcester_north.js) the stone edge, a bench, hydrangeas, the
  // rubble wall along the south wing
  { const yl = L.lake;
    const kerb = (p, q) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); B.push(frame(p[0], 0, p[1], q[0] - p[0], q[1] - p[1])); B.boxXZ('stoneDress', 0, l, yl - 0.2, yl + 0.13, 0, 0.32, { bottom: false }); B.pop(); };
    // (the frame's z is to the left of the direction of travel turned the other way: walk the edge clockwise so the kerb lies inside it)
    const E = QUAY, gap = [3.6, 5.0];      // (the island bridge's foot: left open)
    kerb(E[1], E[0]); kerb(E[2], E[1]); kerb([gap[0], 32.52], E[2]); kerb(E[4], [gap[1], 32.48]); kerb([20.5, 31.86], E[4]);
    // a teak bench facing the water (the photograph from the lower terrace)
    { B.push(frame(7.2, 0, 27.4, 1, 1)); B.boxXZ('sbTeak', -0.85, 0.85, yl + 0.4, yl + 0.46, -0.25, 0.25, { bottom: true }); B.boxXZ('sbTeak', -0.85, 0.85, yl + 0.5, yl + 0.95, 0.22, 0.27, { bottom: true });
      for (const s of [-0.8, 0.8]) { B.boxXZ('sbTeak', s - 0.04, s + 0.04, yl, yl + 0.62, -0.25, 0.27); B.boxXZ('sbTeak', s - 0.04, s + 0.04, yl + 0.6, yl + 0.66, -0.3, 0.27, { bottom: true }); }
      B.pop(); const q = sbPt(7.2, 27.4); col.addCircle(q[0], q[1], 0.7, { tag: 'furniture', low: true }); }
    // hydrangeas either side of the room
    for (const [a, b, r] of [[9.0, 19.0, 0.9], [8.6, 21.2, 0.7], [12.6, 26.0, 0.9], [14.6, 25.9, 0.75], [19.0, 26.6, 0.8]]) { B.cyl('leafB', a, yl, b, r, r * 0.75, 9, false, r * 0.6); B.cyl('leafA', a, yl + r * 0.75, b, r * 0.72, r * 0.28, 9, false, r); B.cyl('sbHyd', a, yl + r * 1.03, b, r * 0.3, r * 0.14, 9, true, r * 0.72); for (let k = 0; k < 5; k++) { const t = k * 1.2566 + a; B.cyl('sbHyd', a + Math.cos(t) * r * 0.78, yl + r * 0.5, b + Math.sin(t) * r * 0.78, r * 0.2, r * 0.22, 6, true, r * 0.26); } const q = sbPt(a, b); col.addCircle(q[0], q[1], r * 0.8, { tag: 'planter', low: true }); }
    // the rubble wall with its ashlar coping along the south wing (it stands at the water here: SB_TEMPORARY)
    const w0 = [24.5, 31.36], w1 = [36.2, 30.52], l = Math.hypot(w1[0] - w0[0], w1[1] - w0[1]);
    B.push(frame(w0[0], 0, w0[1], w1[0] - w0[0], w1[1] - w0[1]));
    B.boxXZ('sbRubble', 0, l, yl - 0.2, 1.62, -0.2, 0.2, { top: false }); B.boxXZ('stoneDress', -0.04, l + 0.04, 1.62, 1.74, -0.25, 0.25, { bottom: true });
    B.boxXZ('stoneDress', l - 0.55, l + 0.05, yl - 0.2, 2.1, -0.3, 0.3);      // its end pier
    B.pop();
    const a = sbPt(w0[0], w0[1]), b = sbPt(w1[0], w1[1]); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'wall', h: 1.7 });
  }
  B.pop();
  const meshes = B.build(M, grp, { pack, noCast: new Set(['signs']) });
  // drawn rigid at the datum (see SB_LV): the lift's differences from the datum point are taken out of every vertex
  const dAt = sbPt(DATUM_AT[0], DATUM_AT[1]), H0 = TERRAIN.mode === 'real' ? terrainH(dAt[0], dAt[1]) : 0, dH = (x, z) => (TERRAIN.mode === 'real' ? terrainH(x, z) - H0 : 0);
  if (TERRAIN.mode === 'real') for (const m of meshes) {
    m.updateMatrixWorld(true); const e = m.matrixWorld.elements, P = m.geometry.attributes.position, sy = Math.hypot(e[4], e[5], e[6]) || 1;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), wx = e[0] * x + e[4] * y + e[8] * z + e[12], wz = e[2] * x + e[6] * y + e[10] * z + e[14]; P.setY(i, y - dH(wx, wz) / sy); }
    P.needsUpdate = true; m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere();
    m.geometry.userData.terrainDraped = true;      // (world/_terrain_drape.js leaves it alone: cut along its lattice, the level paving would follow the field's step under it)
  }

  // ================================================================= colliders and walking heights
  const ringW = (r) => r.map(([a, b]) => sbPt(a, b));
  for (const r of [NORTH_RING, SOUTH_RING, LOWB.H, LOWB.I, LOWB.J]) col.addPolygon(ringW(r), { tag: 'building' });
  const seg = (p, q, o = {}) => { const a = sbPt(p[0], p[1]), b = sbPt(q[0], q[1]); col.addSegment(a[0], a[1], b[0], b[1], { tag: 'wall', ...o }); };
  const sA = TER.a0 - TER.slab, sB = TER.b1 + TER.slab;
  seg([sA, FW.b1], [sA, sB]); seg([sA, sB], [FS.a0, sB]);                                       // the room's edge under the slab
  seg([TER.a0 + TER.bench, FW.b1 + 0.2], [TER.a0 + TER.bench, TER.b1 - TER.bench], { h: 0.5 }); seg([TER.a0 + TER.bench, TER.b1 - TER.bench], [FS.a0 - 0.2, TER.b1 - TER.bench], { h: 0.5 });      // the bench, from the terrace
  seg([FW.aFoot - 0.3, FW.b0 - 0.1], [LOWB.H[0][0], FW.b0 - 0.1], { h: 1 }); seg([FW.aFoot - 0.3, FW.b1 + 0.1], [sA, FW.b1 + 0.1], { h: 1 });      // the west flight's walls
  seg([FS.a0 - 0.1, sB], [FS.a0 - 0.1, FS.bFoot + 0.3], { h: 1 }); seg([FS.a1 + 0.1, TER.b1], [FS.a1 + 0.1, FS.bFoot + 0.3], { h: 1 });           // the south flight's walls
  seg([FS.a0 - 0.2, TER.b1 - TER.bench], [FS.a0 - 0.2, TER.b1], { h: 0.5 }); seg([TER.a0, FW.b1 + 0.2], [TER.a0 + TER.bench, FW.b1 + 0.2], { h: 0.5 });      // the bench's ends
  const prev = world.groundHeight.bind(world);
  world.groundHeight = (x, z) => {
    if (x > -391 && x < -359 && z > -110 && z < -91) {
      // real height less the field's difference: drawn, the player stands on the drawn steps. On a flight the foot is
      // also made to meet the ground beyond it exactly (the field may not be quite the lower terrace's level under the
      // foot): that correction dies away up the flight
      const q = sbInv(x, z), h = sbGroundY(q[0], q[1]);
      if (h !== null) { const f = sbFlightAt(q[0], q[1]); if (!f) return h - dH(x, z); const w = sbPt(f.foot[0], f.foot[1]), e = prev(w[0], w[1]) - (L.lake - dH(w[0], w[1])); return h - dH(x, z) + e * (1 - f.t); }
    }
    return prev(x, z);
  };
  return { meshes, tris: meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0) };
}
