// Worcester College, the far north-west corner by the canal (places/worcester_west.js): the PLAN. Where everything
// stands (world metres, +x east, +z south), the one table of levels, and the switch. No drawing here.
//
// Where the shapes come from (looked at, never copied or used as textures):
//   * the Ordnance Survey base of the 2019 cricket-nets site plan (`reference/worcester/36 …/PLAN cricket nets site
//     plan with OS base…`, 1:1000): the Canal Building's true outline (a cranked range of two wings, 65.8 and 55.5
//     degrees, with two cross wings), the bicycle shelter along the old boundary, the sub-station, the two blocks of
//     42 Nelson Street, the line of the gates across the end of the street;
//   * the game's own map for WHERE they stand: the building is fitted to its mapped outline's four end corners
//     (residual 0.4 m), the flats and the gates keep their mapped places. Between the two the map is stretched by
//     about 2 m east-west (the OS plan and the 2022 height survey agree on that); the forecourt takes it up.
//   * planning file 14/00285/FUL (M Jeffs 2013-14: layout plan, elevation, three photographs) for Gate 4;
//   * the 2014 site plan of the tennis courts (Niall McLaughlin Architects) for the field gate and the car park's edges.
import { mk } from './_worcester_south_kit.js';

// `?wwest=0` (node: GTO_WWEST=0): the corner as it was before this pass, for before / after pictures
export const WEST_ON = !((typeof location !== 'undefined' && location && /[?&]wwest=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_WWEST === '0'));

export const CANAL_ID = 'w93711465', FLATS_ID = 'w301621500';
const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];

// ---- LEVELS: every height of the package in one table (metres above the ground beside each thing; the ground
// itself, 57.4 - 57.8 m above sea level here and flat to 0.3 m, is the terrain's). Sources: worcester_west.js ATTR.
export const LV = {
  canal: {
    plinth: 0.65, gf: [0.95, 2.2], floor1: 2.7, ff: [3.55, 4.88], head: 0.225, band: 5.12, eaves: 5.4, ridge: 9.2,      // two storeys of 2.7 m; brick courses counted on the 2023 photograph; ridge from the height survey
    wingEaves: 6.9, wingApex: 9.1,      // the tall red cross wing (three storeys in its gable)
    porchEaves: 6.9, porchApex: 9.0, archSpring: 2.5, archRise: 0.38, porchCeil: 3.0,
    nBayEaves: 5.4, nBayApex: 7.6,      // the lower bay on the north side of the east wing (height survey 6.3 - 7.5 m)
    wBayEaves: 6.5, wBayApex: 8.6,      // the gabled projection of the west end
    bandLo: [0.53, 0.66], bandHi: [2.42, 2.58], gablet: 1.25, flagpole: 12.4,
  },
  flats: { storey: 2.7, top: 8.1, apexN: 9.2, apexS: 9.3, link: 7.6, sill: 0.95, winH: 1.3, slab: 0.2 },      // eaves 8.1 m, low pyramid roofs to 9.2 / 9.3 m (the height survey's 8.2 - 9.1 "flat top"; the 2026 satellite picture)
  gate: { pier: 2.65, cap: 0.18, plinth: 0.86, leafHinge: 2.52, leafMid: 2.3, door: 2.425, panel: 2.52, lowWall: 2.25, tallWall: 3.3, yardGate: 2.3, wallBand: [0.86, 0.98], eastWall: 2.0, palisade: 2.0, bands: [[1.05, 1.2], [1.9, 2.05]] },      // the 2013 elevation, 1:50
  wall: { body: 1.6, top: 1.85, brick: 2.1, old: 1.7 },      // the rubble wall with its half-round coping (the bicycle shelter's section)
  shelter: { front: 2.15, back: 2.3, post: 2.2 },
  ess: { wall: 2.0, kiosk: 2.3 }, fence: 1.8, fieldGate: 1.25,
};

// ---- the Canal Building. Two frames on its south (college) side: a along the wall, b out of it (south)
const F0 = [-663.10, -207.74], K0 = [-636.24, -219.80], P0 = [-619.43, -231.34];
export const WF = mk(F0, K0), EF = mk(K0, P0);
export const CB = {
  lenW: WF.L, lenE: EF.L, depthW: 11.65, depthE: 12.05,
  wing: { a0: 11.9, a1: 16.9, s: 1.84, n: 2.75 },      // the tall cross wing of the west range: south and north projections
  porch: { a0: 3.98, a1: 8.73, s: 1.74 },              // the porch bay of the east range
  nBay: { a0: 4.9, a1: 9.4, n: 3.25 },                 // its north bay
  wBay: { b0: -7.5, b1: -3.36, w: 1.66 },              // the west end's projection
  bendN: 27.34,                                        // where the north wall bends (west frame a)
};
const w = (a, b) => r2(WF.pt(a, b)), e = (a, b) => r2(EF.pt(a, b));
export const CP = (() => {
  const C = CB, W = C.wing, Pb = C.porch, N = C.nBay, B = C.wBay;
  return {
    F: w(0, 0), G: w(W.a0, 0), H: w(W.a0, W.s), I: w(W.a1, W.s), J: w(W.a1, 0), K: r2(K0),
    L: e(Pb.a0, 0), M: e(Pb.a0, Pb.s), N: e(Pb.a1, Pb.s), O: e(Pb.a1, 0), P: r2(P0),
    Q: e(C.lenE - 0.06, -C.depthE - 0.05), R: e(N.a1, -C.depthE), S: e(N.a1, -C.depthE - N.n), T: e(N.a0, -C.depthE - N.n), U: e(N.a0, -C.depthE + 0.08),
    V: w(C.bendN, -C.depthW), n4: w(W.a1, -C.depthW), n3: w(W.a1, -C.depthW - W.n), n2: w(W.a0, -C.depthW - W.n), n1: w(W.a0, -C.depthW),
    A: w(0, -C.depthW), B: w(0, B.b0), C: w(-B.w, B.b0), D: w(-B.w, B.b1), E: w(0, B.b1),
  };
})();
/** the building's outline, anticlockwise seen from above (so the outside is on the right of each edge) */
export const canalRing = () => 'F G H I J K L M N O P Q R S T U V n4 n3 n2 n1 A B C D E'.split(' ').map((k) => CP[k]);
/** the same without the open porch (for the collider: the porch is walked into) */
export const canalSolid = () => 'F G H I J K L O P Q R S T U V n4 n3 n2 n1 A B C D E'.split(' ').map((k) => CP[k]);

// ---- 42 Nelson Street: two blocks at 22 degrees to each other and the stair link between them
export const FL = (() => {
  const NE = [-607.9, -218.0], NW = [-614.0, -216.4], FN = mk(NE, NW);      // north block: its street face, a from the east corner, b out (north)
  const nb = [NW, NE, r2(FN.pt(0, -9.0)), r2(FN.pt(FN.L, -9.0))];           // NW, NE, SE, SW
  const sNE = [-612.4, -207.9], eS = [0.99190, 0.12703], sS = [-0.12703, 0.99190];      // south block: 6.6 x 8.7 m (OS), hung from its mapped north-east corner
  const sNW = r2(add(sNE, eS, -6.6)), sb = [sNW, sNE, r2(add(sNE, sS, 8.7)), r2(add(sNW, sS, 8.7))];      // NW, NE, SE, SW
  const lk1 = r2(add(sNW, eS, 1.6)), lk3 = r2(FN.pt(FN.L, -2.3)), lk4 = [-618.3, -213.7];
  return { FN, nb, sb, link: [lk1, sNE, nb[3], lk3, lk4], nbRing: [nb[3], nb[2], nb[1], nb[0]], sbRing: [sb[3], sb[2], sb[1], sb[0]] };      // rings anticlockwise from the south-west corner
})();

// ---- Gate 4: the line across the end of Nelson Street (the map's wall w1317537478 between its corner and its end).
// Frame: a north along the line from the south face of the end pier, b out to the street (east)
export const GC = [-620.8, -220.7];                    // the map's gate n12194122166 = the middle of the boarded pair
const UN = [-0.2886, -0.9575];
export const G4 = (() => {
  const o = add(GC, UN, -4.625), F = mk(o, add(o, UN, 1));
  return { F, o: r2(o), panel: [0, 2.24], door: [0.955, 1.955], pierB: [2.24, 2.84], gates: [2.84, 6.41], pierC: [6.41, 7.01], stub: [7.01, 8.58], corner: [-621.9, -224.5] };
})();
// the red wall on from the north pier along the street's north side (the 2026 street pictures): low, then a banded pier,
// a swept rise and the tall stretch with the yard's boarded doors. Its line is the map's wall: the short return in the
// line of the gates (the map's street is 1.5 m wider than the real one), the corner, then east. s = metres from the pier
export const NW = (() => {
  const c = G4.corner, m = [-620.2, -225.2], e = [-611.9, -228.7], A = mk(c, m), B = mk(m, e);      // (their outside, the street, is on the right going east)
  return { A, B, lenA: A.L, lenB: B.L, pier: [2.75, 3.35], rise: 0.9, doors: [4.7, 7.1], end: e };      // along B: the banded pier, the doors
})();
// three bicycles against the low stretch of that wall (the May 2026 street pictures). leg: which stretch of the wall
// (A or B), x = metres along it to the bicycle's middle, z = its wheels' distance from the wall's street face
export const BIKES = [
  { leg: 'A', x: 1.2, z: 0.3, lean: 0.24, frame: 'wwDark', basket: true },      // black, a basket on its bars: facing east along the wall
  { leg: 'B', x: 1.25, z: 0.44, lean: 0.27, frame: 'wwMaroon', pannier: true },      // dark red, a yellow pannier: beside it, facing east
  { leg: 'B', x: 2.15, z: 0.8, turn: 0.96, frame: 'wwBikeB' },      // pale blue, further east, nose-in to the wall at about 55 degrees
];
// the sliding palisade gate and the fixed fence: from the end pier to the south block's north-west corner
export const SG = (() => { const a = G4.o, b = FL.sb[0], F = mk(b, a); return { F, len: F.L, gate: 3.9 }; })();      // a from the flats' corner north to the pier; b out to the forecourt (east)
// the rubble wall and the bicycle shelter: from the end pier west along the old boundary. a west, b north (the Canal Building's side)
export const WL = (() => {
  const o = r2(G4.F.pt(0.335, 0)), F = mk(o, add(o, [-0.9475, 0.3197], 1));
  return { F, o, brick: [0.34, 2.1], gap: [3.7, 4.75], end: 19.3, shelter: [4.9, 19.3], posts: [5.0, 7.85, 10.7, 13.55, 16.4, 19.2], ess: { a0: 14.4, a1: 18.2, b0: -4.1 }, t: 0.5 };
})();
export const wallEnd = () => r2(WL.F.pt(WL.end, 0));
// the old boundary on from the shelter's end to the canal bank (OS 2019): the map's hedge is led along it
export const BOUNDARY = [[-652.47, -205.82], [-663.22, -200.55]];
// the car park's other edges: a boarded fence down its west side and along the south to the field gate
export const CPK = (() => {
  const sw = FL.sb[3], dir = [-0.9934, -0.1144], nw = r2(WL.F.pt(17.8, WL.ess.b0)), swc = r2(WL.F.pt(17.7, -9.8));
  const postE = r2(add(sw, dir, 2.68)), postW = r2(add(sw, dir, 5.18));
  return { fenceW: [nw, swc], fenceS: [swc, postW], fenceE: [postE, sw], postE, postW, gateMid: r2([(postE[0] + postW[0]) / 2, (postE[1] + postW[1]) / 2]) };
})();

// ---- the ground (ordinary map areas, added in preMap)
export function areas() {
  const P = CP, A = [], Wp = (a, b) => r2(WL.F.pt(a, b)), g = (a, b) => r2(G4.F.pt(a, b));
  const south = (a, b) => w(a, b), east = (a, b) => e(a, b), S2 = [-618.3, -217.5], SGp = r2(SG.F.pt(SG.len - 2.9, 0));
  // the forecourt south of the building: block paving from the gates to the west end, wall to wall
  A.push({ kind: 'paved', surface: 'sett', poly: [g(0.67, -0.25), g(8.4, -0.25), east(CB.lenE + 0.5, 0.2), P.P, P.O, P.N, P.M, P.L, P.K, P.J, P.I, P.H, P.G, P.F, south(-3.4, 0), BOUNDARY[1], BOUNDARY[0], Wp(WL.end, 0.25), Wp(WL.gap[1], 0.25), Wp(WL.gap[1], -0.25), Wp(WL.gap[0], -0.25), Wp(WL.gap[0], 0.25), Wp(0.4, 0.25)] });
  // the strip round the west end
  A.push({ kind: 'paved', surface: 'paving_stones', poly: [south(-3.4, 0), south(0.05, 0), south(0.05, -CB.depthW - 0.6), south(-3.4, -CB.depthW - 0.6)] });
  // planting at the wall's foot (grasses in the photograph), the bed east of the porch
  A.push({ kind: 'flowerbed', poly: [south(17.3, 0.03), south(CB.lenW - 0.1, 0.03), east(0.2, 0.03), east(3.6, 0.03), east(3.6, 1.1), east(0.25, 1.1), south(CB.lenW - 0.2, 1.1), south(17.3, 1.1)] });
  A.push({ kind: 'flowerbed', poly: [south(0.6, 0.03), south(11.5, 0.03), south(11.5, 1.1), south(0.6, 1.1)] });
  A.push({ kind: 'flowerbed', poly: [east(9.1, 0.03), east(CB.lenE - 0.5, 0.03), east(CB.lenE - 0.5, 1.15), east(9.1, 1.15)] });
  // the yard east of the east gable, behind the wall on the street's north side
  A.push({ kind: 'paved', surface: 'paving_stones', poly: [P.P, east(CB.lenE + 0.5, 0.2), g(8.4, -0.25), [-620.3, -225.5], [-615.9, -227.3], [-612.4, -228.9], [-618.9, -237.6], P.Q] });
  // the tarmac between the end of the mapped carriageway and the gates
  A.push({ kind: 'paved', surface: 'asphalt', poly: [G4.o, g(8.5, 0.2), [-619.2, -225.2], [-617.4, -221.9], S2] });
  // 42's forecourt (concrete, the crossover into the car park)
  A.push({ kind: 'paved', surface: 'concrete', poly: [G4.o, SGp, FL.link[4], FL.link[3], FL.nb[0], [-614.6, -218.4], S2] });
  // the car park, the way down its east side to the field gate
  const cp = [Wp(0.7, -0.3), Wp(14.35, -0.3), Wp(14.35, -3.0), [-629.0, -207.8], [-626.4, -203.8], CPK.postW, CPK.postE, FL.sb[3], FL.sb[0], SGp, G4.o];
  A.push({ kind: 'paved', surface: 'asphalt', poly: cp, carPark: true });
  // the path between the fence and the flats to their entrance
  A.push({ kind: 'paved', surface: 'concrete', poly: [FL.sb[0], SGp, FL.link[4], FL.link[0]] });
  // shrubs in the car park's south-west corner; the sub-station's yard
  A.push({ kind: 'flowerbed', poly: [Wp(14.35, -3.0), Wp(14.3, -4.3), CPK.fenceW[0], CPK.fenceW[1], CPK.postW, [-626.4, -203.8], [-629.0, -207.8]], bed: true });
  A.push({ kind: 'paved', surface: 'concrete', poly: [Wp(WL.ess.a0, -0.25), Wp(WL.ess.a1, -0.25), Wp(WL.ess.a1, WL.ess.b0), Wp(WL.ess.a0, WL.ess.b0)] });
  return A.map((a, i) => ({ id: 'worc:west:' + i, ...a }));
}

// ---- the mapped footways, led the way people really walk (both private: not in the pedestrians' graph)
export const ROUTES = {
  // from inside the pedestrian door past the shelter's end, through the gap in the rubble wall, down the car park to the field gate
  w251686320: () => [r2(G4.F.pt(1.45, -0.9)), r2(WL.F.pt(4.22, 1.5)), r2(WL.F.pt(4.22, -1.6)), [-623.2, -208.5], [-623.5, -203.5], CPK.gateMid],
  // from the field gate out to the path round the playing field (the grounds')
  w391915006: (p) => [CPK.gateMid, [-624.6, -198.3], p[p.length - 1]],
};
/** the three map nodes here: [id, what becomes of it] */
export const NODES = { gate4: 'n12194122166', door: 'n12194122167', inner: 'n2578689351' };

/** for the terrain: the ground under each of these is to be one plane (world x, z rings) */
export const FOOTPRINTS = { canalBuilding: canalRing(), flatsNorth: FL.nbRing, flatsSouth: FL.sbRing, flatsLink: FL.link, gateLine: [r2(G4.F.pt(0, 0)), r2(G4.F.pt(8.58, 0)), [-620.2, -225.2], [-611.9, -228.7]], shelter: [r2(WL.F.pt(0, -0.3)), r2(WL.F.pt(WL.end, -0.3)), r2(WL.F.pt(WL.end, 1.8)), r2(WL.F.pt(0, 1.8))] };
