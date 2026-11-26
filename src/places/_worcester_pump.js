// Worcester College: PUMP QUAD's court as it is (survey G12, Appendix D.9) — buff gravel 1.25 m below the loggia; the
// flat-roofed rendered ANNEX along the Hall's wall; the GLAZED CANOPY in front of it on slim dark posts (real glass:
// see-through, white bars, a vine along its edge), glazed back to the Hall's wall at its east end over the CELLAR BAR'S
// STAIR; that stair as the college's fire plan has it (places/_bar_out.js: a flight down north in the court's
// north-east corner, an area at its foot, a lobby in the annex, double doors in the Hall's wall); the stone-slated
// open lean-to across the west end against the Cottages' gable; the Hall Wine Cellar's little stair under the loggia's
// south arch. Called by places/worcester.js, which owns the batch, the helpers and the colliders.
//
// K (known) / G (guess), with sources, are in worcester.js CHECKED. In short — K: gravel court, its level, the annex
// (LIDAR: 4.4 m high, 2.4 m deep; satellite: grey flat roof with a rooflight), the canopy (LIDAR: 3.4 m at the annex
// falling to 2.4 m at its eaves, 2.4 m deep; the owner's and the college's photographs: white bars, dark posts with
// brackets, a vine; satellite: about twelve bays, darker glass over the stair at the east end), the lean-to, where the
// bar's stair is and which way it goes (fire plan; the owner), the wine cellar's stair and door under the south arch
// (fire plan; "a rendered parapet" in the college's photograph). G: riser counts, the annex's doors, post spacing,
// the picnic tables' places.
//
// Everything below the court is REAL dug geometry (the base ground is already cut over the whole court:
// worcester.js preMap ov.groundHoles): no depth sheet over a hole, no render-order tricks.
import * as THREE from 'three';
import { WORC, WORC_LEVELS, WORC_BLOCK as BLK } from './_worcester_shared.js';
import { frame, rectPts } from './_worcester_kit.js';
import { OUT, LEVEL, OUT_TREADS, outY } from './_bar_out.js';

const PQY = WORC_LEVELS.pumpQuad, VS = BLK.vS, r4 = (x) => +x.toFixed(4);
// the court (local u, v): cw the Cottages' east gable, ue the east range's court face (1939 plan, LIDAR, fire plan:
// the map has 19.9), its south side the line of Staircases 13 - 15's fronts
export const PUMP = {
  cw: 2.7, ue: 21.3, vn: VS, south: (u) => 29.9 + (u - 1.4) * 0.095,
  // the annex along the Hall's wall; the canopy in front of it: av its upper edge, cv its eaves, heights above the court
  annex: { u0: 6.9, u1: OUT.area.u0, v1: r4(VS + 2.4), h: 4.4 },
  canopy: { u0: 3.4, av: r4(VS + 2.4), cv: r4(VS + 4.8), ya: 3.4, yc: 2.4, bays: 12 },
  // the stone-slated lean-to against the Cottages' gable (LIDAR: 2.4 - 2.9 m high, out to u 6.3, down to v 28)
  lean: { u1: 6.3, v1: 28.0, ya: 3.0, yb: 2.45 },
  // the Hall Wine Cellar's stair under the loggia's south arch (fire plan): three treads down north to its door
  wine: { u0: 4.9, u1: 6.35, v1: r4(VS + 1.0), n: 4, rise: 0.17 },
};
const CAN = PUMP.canopy, CS = (CAN.ya - CAN.yc) / (CAN.cv - CAN.av);
/** the glass's height above the court at v (one slope: from the Hall's wall, where there is no annex, down to the eaves) */
const glassY = (v) => CAN.ya - (v - CAN.av) * CS;

/** the court's own walking heights at local (u, v): the bar's way down, the wine cellar's steps; null = the court's floor */
export function pumpGround(u, v) {
  const g = outY(u, v); if (g !== null) return g;
  const W = PUMP.wine;
  if (u > W.u0 && u < W.u1 && v > VS && v < W.v1) return r4(PQY - W.rise * Math.min(W.n, Math.floor((W.v1 - v) / ((W.v1 - VS - 0.25) / (W.n - 1))) + 1));
  return null;
}
/** the underside (world y) of a roof over local (u, v) and its eaves' height: [under, eaves], or null in the open (for the follow camera) */
export function pumpRoofAt(u, v) {
  const L = OUT.lobby, A = PUMP.annex, N = PUMP.lean;
  if (u > L.u0 && u < L.u1 && v > VS && v < L.v1) return [LEVEL.yard + L.h - 0.15, LEVEL.yard + L.h - 0.15];
  if (u > CAN.u0 && u < PUMP.ue && v < CAN.cv && v > (u >= A.u1 ? VS : CAN.av)) return [PQY + glassY(v) - 0.12, PQY + CAN.yc - 0.12];
  if (u > PUMP.cw && u < N.u1 + 0.25 && v >= CAN.cv && v < N.v1) return [PQY + N.ya - (N.ya - N.yb) * (u - PUMP.cw) / (N.u1 + 0.25 - PUMP.cw) - 0.1, PQY + N.yb - 0.2];
  return null;
}
/** is local (u, v) in one of the places dug below the court for the bar: the flight, the area at its foot, the lobby
 *  in the annex, the doorway through the Hall's wall */
export function pumpDug(u, v) {
  const F = OUT.flight, A = OUT.area, L = OUT.lobby, D = OUT.door;
  return (u > F.u0 && u < F.u1 && v > A.v0 && v < F.vHead) || (u > L.u0 && u < A.u0 + 0.01 && v > L.v0 && v < L.v1) || (u > D.u0 && u < D.u1 && v > D.vIn && v <= L.v0);
}
/** may the follow camera stand at local (u, y, v) while the player is down there? In the open air over the flight and
 *  the area, under the lobby's ceiling, in the gap between them, in the doorway — never in the earth beside them or
 *  inside the annex's block (the walls are one-sided: from there the lobby was a cut-away box in the sky) */
export function pumpCamOK(u, y, v) {
  const F = OUT.flight, A = OUT.area, L = OUT.lobby, G = OUT.gap, D = OUT.door, m = 0.16, yd = LEVEL.yard;
  if (u > F.u0 + m && u < F.u1 - m && v > A.v0 + m && v < F.vHead + 2.5) return y > (v < F.vHead ? (outY(u, v) ?? PQY) : PQY) + 0.3;      // over the flight and the area; and standing back from the head
  if (u > L.u0 + m && u < L.u1 - m && v > L.v0 + m && v < L.v1 - m) return y > yd + 0.3 && y < yd + L.h - 0.12;
  if (u >= L.u1 - m && u <= A.u0 + m && v > G.v0 + m && v < G.v1 - m) return y > yd + 0.3 && y < yd + G.h - 0.1;
  if (u > D.u0 + 0.1 && u < D.u1 - 0.1 && v > D.vIn && v <= L.v0 + m) return y > yd + 0.3 && y < yd + D.h - 0.1;
  return false;
}
/** what the Hall's south wall needs cut and painted for the bar (places/_worcester_block.js): the double doors' notch, the splayed window */
export const HALL_SOUTH = { notch: [OUT.door.u0, OUT.door.u1, OUT.door.top], lights: [[OUT.window.u0, OUT.window.u1, OUT.window.y0, OUT.window.y1]], sign: [OUT.area.u0 + 0.7, PQY + 2.0] };

/**
 * K: { B, atlas, wall, outline, railRun, seg, pl, boxC, plant, tub, col, L2W, floorY, GAP, cotFront }
 * (floorY(u): the sunk ground's own level — the gap's gentle rise from the quad, then the court)
 */
export function buildPumpQuad(K) {
  const { B, atlas, wall, outline, railRun, seg, pl, boxC, plant, tub, col, L2W, floorY, GAP, lantern } = K;
  const { cw: CW, ue: UE } = PUMP, A = PUMP.annex, N = PUMP.lean, W = PUMP.wine, F = OUT.flight, AR = OUT.area, LB = OUT.lobby, D = OUT.door;
  const PQT = new THREE.Matrix4().makeTranslation(0, PQY, 0);      // y = 0 is the court
  const yd = LEVEL.yard - PQY;                                      // the yard's floor below the court (negative)
  const S = PUMP.south, WT = 0.25;                                  // WT: the stair's side walls
  const post = (u, v, h, yb = 0) => { B.cyl('iron', u, yb, v, 0.05, h - yb, 6, false); B.beam('iron', [u - 0.3, h - 0.12, v], [u, h - 0.42, v], 0.03); B.beam('iron', [u + 0.3, h - 0.12, v], [u, h - 0.42, v], 0.03); col.addCircle && col.addCircle(...L2W(u, v), 0.09, { tag: 'furniture' }); };
  // the sunk footprints, as holes in the court's surfaces

  // ================================================================= ground
  {
    // the gap from the quad and the court's west strip: gravel on the gentle rise (floorY)
    const y = (u) => floorY(u) + 0.045, g = (pts) => B.poly('gravel', pts.map(([u, v]) => [u, y(u), v]), [0, 1, 0], pts);
    if (GAP[0] < CW) g([[GAP[0], VS], [CW, VS], [CW, K.cotFront(CW)], [GAP[0], K.cotFront(GAP[0])]]);      // between the block's south face and the Cottages' north face
    g([[CW, VS], [GAP[1], VS], [GAP[1], S(GAP[1])], [CW, S(CW)]]);
    B.poly('soil', [[GAP[0], floorY(GAP[0]) - 0.07, VS], [GAP[1], PQY - 0.07, VS], [GAP[1], PQY - 0.07, S(GAP[1]) + 0.1], [GAP[0], floorY(GAP[0]) - 0.07, S(GAP[0]) + 0.1]], [0, 1, 0]);      // (earth under the seams: see the quad)
  }
  B.push(PQT);
  // (the earth plane goes ROUND the two dug places as one outline: both holes touch its north edge, and a hole that
  //  touches the outline is not cut — the first version left the plane lying across the lobby at chest height)
  const wu1 = W.u1 + WT, wOpen = W.u0 - WT <= GAP[1] + 1e-6;      // the wine stair's well takes the court's north-west corner
  const nw = wOpen ? [[GAP[1], W.v1], [wu1, W.v1], [wu1, VS]] : [[GAP[1], VS], [W.u0 - WT, VS], [W.u0 - WT, W.v1], [wu1, W.v1], [wu1, VS]];
  B.flat('soil', [...nw, [LB.u0 - 0.1, VS], [LB.u0 - 0.1, LB.v1 + 0.1], [F.u0 - WT, LB.v1 + 0.1], [F.u0 - WT, F.vHead], [F.u1 + WT, F.vHead], [F.u1 + WT, VS], [UE + 0.1, VS], [UE + 0.1, S(UE) + 0.1], [GAP[1], S(GAP[1]) + 0.1]], -0.07);
  // flags: the walk under the canopy (west of the flight), the nook east of the stair in the court's corner
  const walkW = [[GAP[1], CAN.av], [F.u0 - WT, CAN.av], [F.u0 - WT, CAN.cv], [GAP[1], CAN.cv]], nook = [[F.u1 + WT, VS], [UE, VS], [UE, CAN.cv], [F.u1 + WT, CAN.cv]];
  B.flat('paving', walkW, 0.057); B.flat('paving', nook, 0.057);
  B.flat('paving', [[F.u0 - WT, F.vHead], [F.u1 + WT, F.vHead], [F.u1 + WT, F.vHead + 0.9], [F.u0 - WT, F.vHead + 0.9]], 0.057);      // at the head of the flight
  // gravel: the open court, and the strip between the loggia's end and the annex's west end
  B.flat('gravel', [[GAP[1], CAN.cv + 0.3], [F.u0 - WT, CAN.cv + 0.3], [F.u0 - WT, F.vHead + 0.9], [F.u1 + WT, F.vHead + 0.9], [F.u1 + WT, CAN.cv + 0.3], [UE, CAN.cv + 0.3], [UE, S(UE)], [GAP[1], S(GAP[1])]], 0.045);
  { const wv = Math.min(W.v1, CAN.av - 0.01); B.flat('gravel', [...(wOpen ? [[GAP[1], wv], [wu1, wv], [wu1, VS]] : [[GAP[1], VS], [W.u0 - WT, VS], [W.u0 - WT, wv], [wu1, wv], [wu1, VS]]), [A.u0, VS], [A.u0, CAN.av], [GAP[1], CAN.av]], 0.045); }
  for (const [a, b] of [[GAP[1], F.u0 - WT], [F.u1 + WT, UE]]) { B.boxXZ('stone', a, b, 0, 0.09, CAN.cv, CAN.cv + 0.15); B.boxXZ('lead', a, b, 0, 0.03, CAN.cv + 0.15, CAN.cv + 0.3); }      // the kerb and the drain channel

  if (K.cotSouth !== undefined && K.cotSouth < S(CW)) B.boxXZ('rubble', CW - 0.5, CW, -0.7, 4.6, K.cotSouth - 0.05, S(CW) + 0.1);      // (closes the half-metre slot between the Cottages' east building and Staircase 13's front until that range is built by hand)
  // ================================================================= the annex (rendered, flat-roofed) along the Hall's wall
  {
    const L = A.u1 - A.u0;
    // court face: a louvred door by its west end, the store stair's door further east (G: which doors)
    const Fa = frame(A.u0, 0, A.v1, 1, 0);      // faces south; s from the west end
    wall(B, Fa, outline(0, L, 0, A.h, [rectPts(0.7, 0, 1.6, 2.0), rectPts(4.35, 0, 5.2, 2.0)]), [
      { pts: rectPts(0.7, 0, 1.6, 2.0), d: 0.06, kind: 'none', notch: true }, { pts: rectPts(4.35, 0, 5.2, 2.0), d: 0.06, kind: 'none', notch: true }], 'plaster');
    B.push(Fa); for (const [s, w] of [[0.7, 0.9], [4.35, 0.85]]) B.unit('doorGrey', rectPts(s, 0, s + w, 2.0), -0.05); B.pop();
    wall(B, frame(A.u0, 0, VS, 0, 1), outline(0, A.v1 - VS, 0, A.h), [], 'plaster');      // west end (faces west)
    // east end, over the area: above the opening into the lobby
    const G = OUT.gap, Fe = frame(A.u1, 0, A.v1, 0, -1), ge = rectPts(A.v1 - G.v1, yd, A.v1 - G.v0, yd + G.h);      // faces east; s north from the annex's court face
    wall(B, Fe, outline(0, A.v1 - VS, yd, A.h, [ge]), [{ pts: ge, d: A.u1 - LB.u1, kind: 'void', notch: true, revealKey: 'plasterLit' }], 'plaster');
    // roof: lead flat behind a stone coping, a rooflight
    B.flat('lead', [[A.u0, VS + 0.02], [A.u1, VS + 0.02], [A.u1, A.v1], [A.u0, A.v1]], A.h - 0.02);
    B.boxXZ('stoneDress', A.u0 - 0.05, A.u1 + 0.05, A.h - 0.12, A.h + 0.1, A.v1 - 0.2, A.v1 + 0.05); B.boxXZ('stoneDress', A.u0 - 0.05, A.u0 + 0.2, A.h - 0.12, A.h + 0.1, VS + 0.02, A.v1 - 0.2);
    B.boxXZ('white', 12.6, 15.0, A.h - 0.02, A.h + 0.28, VS + 0.6, VS + 1.7, { top: false }); B.flat('lampGlass', [[12.6, VS + 0.6], [15.0, VS + 0.6], [15.0, VS + 1.7], [12.6, VS + 1.7]], A.h + 0.28);
    seg(A.u0, VS, A.u0, A.v1); seg(A.u0, A.v1, A.u1, A.v1);
  }

  // ================================================================= the Cellar Bar's way down (places/_bar_out.js)
  {
    const uf0 = F.u0, uf1 = F.u1, G = OUT.gap, hc = yd + LB.h;      // hc: the lobby's ceiling
    // the outer flight: eight treads between two walls, down north to the area
    for (const [v0, v1, y] of OUT_TREADS) B.boxXZ('pavingSolid', uf0, uf1, yd - 0.1, y - PQY, v0, v1);
    B.boxXZ('pavingSolid', uf0, uf1, yd - 0.1, yd, AR.v0, AR.v1);                               // the area's floor
    // side walls of the flight and the area: stone below the court, a low wall and a rail above it (east side all the
    // way to the Hall's wall; west side from the annex's corner to the head)
    const side = (u, v0, v1, n) => {
      B.poly('stone', [[u, yd - 0.1, v0], [u, yd - 0.1, v1], [u, 0, v1], [u, 0, v0]], [n, 0, 0]);      // (to the court's level: above it the low wall's own inner face is this plane)
      B.boxXZ('stone', Math.min(u, u - n * WT), Math.max(u, u - n * WT), 0, 0.45, v0, v1); railRun(B, [u - n * WT / 2, v0], [u - n * WT / 2, v1], 0.45, 1.4);
      seg(u, v0, u, v1, 'wall');
    };
    side(uf1, AR.v0, F.vHead, -1); side(uf0, A.v1, F.vHead, 1);
    B.poly('stone', [[uf0, yd - 0.1, AR.v0], [uf1, yd - 0.1, AR.v0], [uf1, 0, AR.v0], [uf0, 0, AR.v0]], [0, 0, 1]);      // the Hall's wall, below the court (a hand in front of the wall's own face)
    for (const u of [uf0 - WT, uf1]) B.boxXZ('stone', u, u + WT, 0, 0.5, F.vHead - 0.02, F.vHead + 0.28);            // the piers at the head
    // the lobby in the annex: floor, plastered walls, ceiling; a bench; the Bar Store's door (shut)
    B.boxXZ('pavingLit', LB.u0, A.u1, yd - 0.1, yd, LB.v0, LB.v1);                                                  // (floor, through the opening too)
    const Ln = frame(LB.u0, 0, LB.v0, 1, 0), dn = rectPts(D.u0 - LB.u0, yd, D.u1 - LB.u0, yd + D.h);                 // north: the Hall's wall, the double doors
    wall(B, Ln, outline(0, LB.u1 - LB.u0, yd, hc, [dn]), [{ pts: dn, d: 0.01, kind: 'none', notch: true }], 'plasterLit');
    const Ls = frame(LB.u1, 0, LB.v1, -1, 0); wall(B, Ls, outline(0, LB.u1 - LB.u0, yd, hc), [], 'plasterLit');     // south
    const Lw = frame(LB.u0, 0, LB.v1, 0, -1), sd = rectPts(LB.v1 - OUT.store.v1, yd, LB.v1 - OUT.store.v0, yd + OUT.store.h);      // west: the store's door
    wall(B, Lw, outline(0, LB.v1 - LB.v0, yd, hc, [sd]), [{ pts: sd, d: 0.05, kind: 'door', notch: true }], 'plasterLit');
    const gl = rectPts(G.v0 - LB.v0, yd, G.v1 - LB.v0, yd + G.h);                                                    // east: the opening to the area (faces west)
    wall(B, frame(LB.u1, 0, LB.v0, 0, 1), outline(0, LB.v1 - LB.v0, yd, hc, [gl]), [{ pts: gl, d: 0.01, kind: 'none', notch: true }], 'plasterLit');
    B.flat('plasterLit', [[LB.u0, LB.v0], [LB.u1, LB.v0], [LB.u1, LB.v1], [LB.u0, LB.v1]], hc, [], true);
    B.boxXZ('oak', LB.u0 + 1.6, LB.u1 - 0.3, yd + 0.4, yd + 0.46, LB.v1 - 0.42, LB.v1 - 0.04); for (const u of [LB.u0 + 1.7, LB.u1 - 0.4]) B.boxXZ('oak', u - 0.04, u + 0.04, yd, yd + 0.4, LB.v1 - 0.4, LB.v1 - 0.06);      // the bench along its south wall (the plan draws one)
    // the double doors: a stone reveal through the Hall's wall, the painted leaves at its back (what is seen while
    // the room is not shown: the walk-in bar's own leaves hang in front of them, behind the opening the core punches)
    const vl = VS - D.recess, dc = (D.u0 + D.u1) / 2;
    for (const u of [D.u0, D.u1]) B.poly('stoneLit', [[u, yd, LB.v0], [u, yd, vl], [u, yd + D.h, vl], [u, yd + D.h, LB.v0]], [u === D.u0 ? 1 : -1, 0, 0]);
    B.poly('stoneLit', [[D.u0, yd + D.h, LB.v0], [D.u1, yd + D.h, LB.v0], [D.u1, yd + D.h, vl], [D.u0, yd + D.h, vl]], [0, -1, 0]);
    B.poly('pavingLit', [[D.u0, yd, LB.v0], [D.u1, yd, LB.v0], [D.u1, yd, vl], [D.u0, yd, vl]], [0, 1, 0]);
    B.push(frame(D.u0, 0, vl + 0.02, 1, 0)); B.unit('doorOak', rectPts(0, yd, dc - D.u0, yd + D.h), 0); B.unit('doorOak', rectPts(dc - D.u0, yd, D.u1 - D.u0, yd + D.h), 0); B.pop();
    // colliders: the lobby's walls (the annex's faces are above), with its two openings
    pl([[LB.u0, LB.v0], [LB.u0, LB.v1], [LB.u1, LB.v1], [LB.u1, G.v1]], 'wall'); seg(LB.u1, G.v0, LB.u1, LB.v0, 'wall');
    seg(A.u1, A.v1, A.u1, G.v1, 'wall'); seg(A.u1, G.v0, A.u1, VS, 'wall');
    // a lamp in the lobby, the bar's sign on the annex's end over the opening
    B.box('lampGlass', (LB.u0 + LB.u1) / 2, hc - 0.12, (LB.v0 + LB.v1) / 2, 0.3, 0.12, 0.3, 0, { top: false });
    B.push(frame(A.u1, 0, A.v1, 0, -1)); B.sign('signs', A.v1 - G.v1 - 0.2, yd + G.h + 0.25, A.v1 - G.v0 + 0.2, yd + G.h + 0.95, 0.03, atlas.uv('cellarBar')); B.pop();
  }

  // ================================================================= the glazed canopy
  {
    const UW = CAN.u0, GUV = (() => { const q = atlas.uv('glass'), mu = (q[0] + q[2]) / 2, mv = (q[1] + q[3]) / 2, du = (q[2] - q[0]) * 0.3, dv = (q[3] - q[1]) * 0.3; return [mu - du, mv - dv, mu + du, mv + dv]; })();
    const top = (u) => (u >= A.u1 - 0.01 ? VS + 0.03 : CAN.av);      // where the glass begins: the annex's face (a back beam west of it), the Hall's wall east of it
    // ONE see-through sheet per run, in the alpha-blended decal mesh (double sided, no shadow of its own)
    const pane = (u0, u1) => { const v0 = top((u0 + u1) / 2); B.card('signs', [u0, CAN.yc, CAN.cv], [u1, CAN.yc, CAN.cv], [u1, glassY(v0), v0], [u0, glassY(v0), v0], GUV); };
    pane(UW, A.u1); pane(A.u1, UE);
    const bw = (UE - UW) / CAN.bays;
    for (let k = 0; k <= CAN.bays; k++) { const u = Math.min(UE - 0.04, UW + bw * k), v0 = top(u); B.beam('white', [u, glassY(v0) + 0.035, v0], [u, CAN.yc + 0.035, CAN.cv], 0.05); }
    B.beam('white', [A.u1, glassY(VS + 0.03) + 0.035, VS + 0.03], [A.u1, CAN.ya + 0.035, CAN.av], 0.05);      // the bar on the annex's corner
    B.beam('iron', [UW, CAN.yc - 0.06, CAN.cv - 0.04], [UE, CAN.yc - 0.06, CAN.cv - 0.04], 0.09, 0.12);      // the eaves beam
    B.beam('iron', [UW, CAN.ya - 0.06, CAN.av + 0.04], [A.u0, CAN.ya - 0.06, CAN.av + 0.04], 0.09, 0.12);     // the back beam, where no annex carries the glass
    for (const u of [UW + 0.05, A.u0 - 0.6]) post(u, CAN.av + 0.04, CAN.ya - 0.1, floorY(u) - PQY);
    // posts under the eaves beam at every second bar, none across the head of the bar's flight
    for (let k = 0; k <= CAN.bays; k += 2) { let u = Math.min(UE - 0.15, UW + bw * k + (k ? 0 : 0.1)); if (u > F.u0 - WT - 0.2 && u < F.u1 + WT + 0.2) u = u < (F.u0 + F.u1) / 2 ? F.u0 - WT - 0.2 : F.u1 + WT + 0.2; post(u, CAN.cv - 0.04, CAN.yc - 0.1, floorY(u) - PQY); }
    // the vine along its edge (the owner's photograph)
    for (let u = UW + 0.4, i = 0; u < F.u0 - 0.8; u += 0.52, i++) plant(B, u + ((i * 7) % 5) * 0.03, CAN.cv - 0.03, CAN.yc - 0.3 - ((i * 3) % 4) * 0.05, 0.17 + (i % 3) * 0.03, 0.22 + (i % 2) * 0.06, i % 2 ? 'leafA' : 'leafC', null, i * 1.3);
  }

  // ================================================================= the stone-slated open lean-to across the west end
  {
    const u0 = CW + 0.02, u1 = N.u1, v0 = CAN.cv, v1 = N.v1, ya = N.ya, yb = N.yb;
    const q = [[u0, ya, v0], [u1 + 0.25, yb - 0.06, v0], [u1 + 0.25, yb - 0.06, v1], [u0, ya, v1]];
    B.poly('stoneSlate', q, [0.3, 1, 0]); B.poly('oak', q.map(([u, y, v]) => [u, y - 0.07, v]), [-0.3, -1, 0]);
    B.poly('oak', [[u0 + 0.03, floorY(u0) - PQY, v0], [u0 + 0.03, floorY(u0) - PQY, v1], [u0 + 0.03, ya - 0.1, v1], [u0 + 0.03, ya - 0.1, v0]], [1, 0, 0]);      // dark boarding behind
    B.beam('iron', [u1, yb - 0.14, v0], [u1, yb - 0.14, v1], 0.1, 0.12);
    for (const v of [v0 + 0.12, (v0 + v1) / 2, v1 - 0.12]) { B.cyl('iron', u1, floorY(u1) - PQY, v, 0.055, yb - 0.14 - (floorY(u1) - PQY), 6, false); col.addCircle && col.addCircle(...L2W(u1, v), 0.09, { tag: 'furniture' }); }
    for (const v of [v0, v1]) B.poly('oak', [[u0, ya - 0.07, v], [u1 + 0.25, yb - 0.13, v], [u1, yb - 0.3, v], [u0, yb - 0.3, v]], [0, 0, v === v0 ? -1 : 1]);
  }

  // ================================================================= the Hall Wine Cellar's stair, under the loggia's south arch
  {
    const tw = (W.v1 - VS - 0.25) / (W.n - 1), yb = -W.rise * W.n;
    for (let k = 1; k < W.n; k++) B.boxXZ('pavingSolid', W.u0, W.u1, yb - 0.1, -W.rise * k, W.v1 - tw * k, W.v1 - tw * (k - 1));
    B.boxXZ('pavingSolid', W.u0, W.u1, yb - 0.1, yb, VS + 0.02, W.v1 - tw * (W.n - 1));
    for (const [u, n] of [[W.u0, 1], [W.u1, -1]]) {      // rendered parapet walls either side (the college's photograph)
      B.boxXZ('plaster', Math.min(u, u - n * WT), Math.max(u, u - n * WT), 0, 1.0, VS + 0.02, W.v1);
      B.poly('plaster', [[u, yb - 0.1, VS + 0.02], [u, yb - 0.1, W.v1], [u, 0, W.v1], [u, 0, VS + 0.02]], [n, 0, 0]);
      seg(u, VS, u, W.v1, 'wall');
    }
    B.poly('stone', [[W.u0, yb - 0.1, VS + 0.02], [W.u1, yb - 0.1, VS + 0.02], [W.u1, 0, VS + 0.02], [W.u0, 0, VS + 0.02]], [0, 0, 1]);
    B.push(frame(W.u0 + 0.2, 0, VS + 0.035, 1, 0)); B.unit('doorDark', rectPts(0, yb, W.u1 - W.u0 - 0.4, yb + 1.85), 0); B.pop();      // the cellar's door, below the arch
  }

  // ================================================================= furniture
  // picnic tables on the gravel (the owner's photograph and the satellite view: a few; G: how many, where)
  for (const [u, v] of [[16.0, 28.2], [6.9, 29.1], [19.3, 28.6]]) {      // (clear of the friends' lines across the court, of the pigeonhole room's door and of the staircase doors as the hand-built ranges have them: 14 at u 11.4 — and 3 m from the friends' node in the court's middle, PQ_M at local (9.5, 27.2): a table 1.6 m from it stopped whoever was following the player)
    B.boxXZ('wood', u - 0.9, u + 0.9, 0.72, 0.77, v - 0.4, v + 0.4);
    for (const s of [-1, 1]) { B.boxXZ('wood', u - 0.9, u + 0.9, 0.43, 0.47, v + s * 0.62 - 0.14, v + s * 0.62 + 0.14); B.box('wood', u - 0.7, 0.37, v + s * 0.45, 0.08, 0.74, 0.08, 0); B.box('wood', u + 0.7, 0.37, v + s * 0.45, 0.08, 0.74, 0.08, 0); }
    boxC(u - 0.9, u + 0.9, v - 0.78, v + 0.78, 'furniture');
    for (const dv of [-0.62, 0, 0.62]) pl([[u - 0.9, v + dv], [u + 0.9, v + dv]], 'furniture');
  }
  B.pop();      // (PQT)
  for (const [u, v] of [[7.4, 24.4], [20.7, 23.6], [19.0, 30.9]]) tub(B, u, v, PQY);      // (not before Staircase 16's door at v 25.05 nor in the angle doorway)
  // wall lanterns (worcester.js gives each a glow). The owner, 2026-11-22: "real lanterns where they really are; no
  // general brightening". K: the one on a bracket beside the loggia's south arch (his photograph, the college's).
  // G, one only: on the annex's face at the head of the bar's flight, by its sign (an entrance in use after dark; no
  // picture shows that end of the court). The three further guesses of the first version are gone.
  lantern(B, BLK.southArch.u - BLK.southArch.w / 2 - 0.55, WORC.terraceY + 1.9, VS, 0, 1, 0.45);
  lantern(B, A.u1 - 1.0, PQY + 2.45, A.v1, 0, 1);
  // the lamp over the lobby, for the night
  // (no lamp glows of their own in the lobby or at the foot of the flight: seen from inside the bar through its doors
  //  and its window a glow there filled the opening with white. After dark the lobby and the area are lit by the bar
  //  itself — a lit walk-in room throws its light out of its doors and window — and by the lantern on the annex's
  //  face at the head of the flight; the lobby's bulkhead fitting is modelled, unlit.)
  return { lamps: [] };
}
