// Facade depth (graphics pass 6): the pieces that stop a street front being a painted box. Everything here is emitted
// into the building's own facade tile (same material, no extra draw) and is PAID FOR by triangles buildings.js no
// longer emits (party walls, merged back walls): see GeoBuf.saved / .spent and TileBatcher.refreshDyn in util.js.
//   recessBay   one bay × one storey with its window / door / shop window really set back: wall with a hole, four
//               reveals, the glazing on a plane behind (same atlas cell, same UVs -> same paint colour and lit windows)
//   slab        a projecting band: cornice, string course, plinth, sill, door hood, step
//               (pass 7: reveals are mapped at the wall's own scale; beds of high openings are not drawn)
//   bayWindow   canted bay, awning, hangingSign, gablet (wall-dormer gable), buttress: static near-tile geometry
// All positions are given in wall space of an edge E from buildings.js: s = metres from the viewer's left end, y = up,
// o = metres out of the wall plane (negative = into the building).
import { FACADE_CELLS as F } from './textures.js';

const W1 = (x0, x1, t, b, d, o) => ({ x: [[x0, x1]], t, b, d, sill: true, ...o });
/** Openings painted in the atlas cells: x = [[x0, x1]…] across the bay, t / b = head / foot as fractions from the TOP of the cell, d = set-back (m). */
export const WIN = {
  [F.stoneSash]: W1(0.32, 0.68, 0.16, 0.76, 0.2), [F.stoneTudor]: W1(0.22, 0.78, 0.2, 0.7, 0.24), [F.brickSash]: W1(0.31, 0.69, 0.2, 0.76, 0.15),
  [F.renderSash]: W1(0.31, 0.69, 0.17, 0.75, 0.15), [F.stoneSashTall]: W1(0.32, 0.68, 0.17, 0.85, 0.2), [F.stoneRustic]: W1(0.33, 0.67, 0.2, 0.8, 0.22),
  [F.stoneSmall]: W1(0.33, 0.67, 0.3, 0.74, 0.18), [F.brickGeorgian]: W1(0.32, 0.68, 0.18, 0.78, 0.14), [F.brickPoly]: W1(0.32, 0.68, 0.145, 0.78, 0.15),
  [F.brickPair]: { x: [[0.2, 0.476], [0.524, 0.8]], t: 0.2, b: 0.76, d: 0.15, sill: true }, [F.renderGeorgian]: W1(0.32, 0.68, 0.17, 0.79, 0.15),
  [F.collegeGround]: W1(0.27, 0.73, 0.17, 0.57, 0.26), [F.collegeGothic]: W1(0.26, 0.74, 0.2, 0.72, 0.26), [F.collegeWide]: W1(0.14, 0.86, 0.19, 0.73, 0.26),
  // roofscape / college-front pass: arched heads stay painted on the wall face; only the part below the springing is set back
  [F.collegeTwo]: W1(0.3, 0.7, 0.24, 0.68, 0.24), [F.stoneRoundArch]: W1(0.27, 0.73, 0.3, 0.88, 0.3), [F.venetianPair]: { x: [[0.26, 0.475], [0.525, 0.74]], t: 0.38, b: 0.8, d: 0.24, sill: true },
  [F.stoneDoor]: { x: [[0.32, 0.68]], t: 0.22, b: 1, d: 0.38, door: true }, [F.brickDoor]: { x: [[0.32, 0.68]], t: 0.2, b: 1, d: 0.3, door: true },
  [F.renderDoor]: { x: [[0.33, 0.67]], t: 0.22, b: 1, d: 0.3, door: true }, [F.stoneArchDoor]: { x: [[0.27, 0.73]], t: 0.18, b: 1, d: 0.6, door: true },
  // (photo comparison item 9: the shopfront cells' painted fascias are 15-16 % of the storey now and the recessed openings
  // rise to meet them, as the painted glass does; the Turl Street name plate moved off the opening, buildings.js PLAQUE_MOVE)
  [F.shopA]: { x: [[0.07, 0.93]], t: 0.185, b: 0.85, d: 0.24 }, [F.shopB]: { x: [[0.024, 0.976]], t: 0.18, b: 0.94, d: 0.12 }, [F.shopfront]: { x: [[0.0625, 0.9375]], t: 0.24, b: 0.84, d: 0.22 },
  [F.pubFront]: { x: [[0.078, 0.438], [0.562, 0.922]], t: 0.27, b: 0.77, d: 0.18 }, [F.cafeFront]: { x: [[0.055, 0.945]], t: 0.185, b: 0.88, d: 0.22 },
  // recessed shop lobby: splayed returns (the side display windows), tiled threshold, the door on the back wall
  // pass 7: the leaded casement of a timber-framed upper storey (set in the frame: shallow, no stone sill)
  [F.timberUp]: { x: [[0.375, 0.625]], t: 0.2, b: 0.64, d: 0.11 },
  [F.shopDoorA]: { x: [[0.3, 0.7]], t: 0.185, b: 1, d: 0.95, door: true, back: [0.35, 0.65], jamb: [[0.1, 0.27], [0.76, 0.93]], floorV: [0.968, 0.998] },
};

/** Quad through four wall-space points [s, y, o] (perimeter order) with world normal from wall-space (ns, ny, no) and per-corner uv. */
function quad(fb, E, p0, p1, p2, p3, ns, ny, no, uv) {
  const nx = E.rx * ns + E.nx * no, nz = E.rz * ns + E.nz * no, l = Math.hypot(nx, ny, nz) || 1;
  const V = (p, k) => fb.v(E.lx + E.rx * p[0] + E.nx * p[2], p[1], E.lz + E.rz * p[0] + E.nz * p[2], nx / l, ny / l, nz / l, uv[k * 2], uv[k * 2 + 1]);
  fb.quadFacing(V(p0, 0), V(p1, 1), V(p2, 2), V(p3, 3), nx, ny, nz);
}
/** Vertical quad parallel to the wall at depth o. */
function wq(fb, E, s0, s1, y0, y1, o, u0, u1, v0, v1) {
  quad(fb, E, [s0, y0, o], [s1, y0, o], [s1, y1, o], [s0, y1, o], 0, 0, 1, [u0, v0, u1, v0, u1, v1, u0, v1]);
}

/**
 * One bay (sA..sB) × one storey (yA..yB) whose cell is mapped u0..u0+1, v0..v0+1, with the openings of `sp` set back.
 * Window: 18 triangles; the caller has set cell / tint / top on fb. Returns nothing.
 */
export function recessBay(fb, E, sA, sB, yA, yB, u0, v0, sp0, noSill = false) {
  // the hole is cut a few texels outside the painted glass, so the wall round it never samples (blue) glass
  const e = sp0.back ? 0 : sp0.door ? 0.004 : 0.007, n1 = sp0.x.length - 1;
  const sp = e ? { ...sp0, t: sp0.t - e, b: sp0.b >= 0.999 ? 1 : sp0.b + e, x: sp0.x.map((q, i) => [q[0] - (i === 0 ? e : e / 2), q[1] + (i === n1 ? e : e / 2)]) } : sp0;
  const w = sB - sA, hg = yB - yA, d = sp.d, floor = sp.b >= 0.999;
  const X = (f) => sA + f * w, Yt = (ft) => yA + (1 - ft) * hg, U = (f) => u0 + f, V = (ft) => v0 + 1 - ft;
  const wall = (fa, fc, ta, tb) => wq(fb, E, X(fa), X(fc), Yt(tb), Yt(ta), 0, U(fa), U(fc), V(tb), V(ta));
  if (sp.t > 0.002) wall(0, 1, 0, sp.t);
  if (!floor) wall(0, 1, sp.b, 1);
  let prev = 0;
  for (const [x0, x1] of sp.x) { wall(prev, x0, sp.t, sp.b); prev = x1; }
  wall(prev, 1, sp.t, sp.b);
  const yLo = Yt(sp.b), yHi = Yt(sp.t);
  for (const [x0, x1] of sp.x) {
    const [k0, k1] = sp.back && sp.x.length === 1 ? sp.back : [x0, x1];
    // pass 7: a reveal is the wall turning the corner — it shows the strip of wall beside the opening at the wall's own
    // scale (it used to stretch a 7-texel sliver of the surround across the whole depth: streaks). Between the two
    // windows of a paired cell there is no room for that, so the mullion keeps the sliver.
    const dw = d / w, dh = d / hg, i0 = x0 === sp.x[0][0], i1 = x1 === sp.x[n1][1];
    const jl = sp.jamb ? sp.jamb[0] : i0 ? [x0 - 0.034, Math.max(0.012, x0 - 0.034 - dw)] : [x0 - 0.016, x0 - 0.03];
    const jr = sp.jamb ? sp.jamb[1] : i1 ? [x1 + 0.034, Math.min(0.988, x1 + 0.034 + dw)] : [x1 + 0.016, x1 + 0.03];
    const hv = sp.jamb ? [sp.t - 0.016, sp.t - 0.03] : [sp.t - 0.034, Math.max(0.012, sp.t - 0.034 - dh)];
    // glazing / door on the back plane
    wq(fb, E, X(k0), X(k1), yLo, yHi, -d, U(x0), U(x1), V(sp.b), V(sp.t));
    // reveals: left and right jambs, head, sill (or the threshold of a doorway)
    quad(fb, E, [X(x0), yLo, 0], [X(k0), yLo, -d], [X(k0), yHi, -d], [X(x0), yHi, 0], 1, 0, sp.back ? 0.25 : 0, [U(jl[0]), V(sp.b), U(jl[1]), V(sp.b), U(jl[1]), V(sp.t), U(jl[0]), V(sp.t)]);
    quad(fb, E, [X(x1), yLo, 0], [X(k1), yLo, -d], [X(k1), yHi, -d], [X(x1), yHi, 0], -1, 0, sp.back ? 0.25 : 0, [U(jr[0]), V(sp.b), U(jr[1]), V(sp.b), U(jr[1]), V(sp.t), U(jr[0]), V(sp.t)]);
    quad(fb, E, [X(x0), yHi, 0], [X(x1), yHi, 0], [X(k1), yHi, -d], [X(k0), yHi, -d], 0, -1, 0, [U(x0), V(hv[0]), U(x1), V(hv[0]), U(x1), V(hv[1]), U(x0), V(hv[1])]);
    const fv = floor ? sp.floorV || [0.98, 0.996] : [sp.b + 0.004, sp.b + 0.02];
    // (the bed of an opening high above any eye — top deck of a bus included — is never seen: not drawn, pass 7)
    // (the threshold of a doorway is a step 2 cm up: laid at the bay's foot it lay in the very plane of the ground under
    //  the building, and one shop lobby in sixteen — those whose wall bias is hair 0 — flickered between its own floor
    //  and the paving or grass of the base ground)
    const yF = floor ? yLo + 0.02 : yLo;
    if (!noSill || floor) quad(fb, E, [X(x0), yF, 0], [X(x1), yF, 0], [X(k1), yF, -d], [X(k0), yF, -d], 0, 1, 0, [U(x0), V(fv[1]), U(x1), V(fv[1]), U(x1), V(fv[0]), U(x0), V(fv[0])]);
  }
}

/**
 * Projecting band sA..sB × yA..yB standing d out of the wall. faces: any of F(ront) T(op) B(ottom) L R. The cell is
 * expected to be a band cell (stoneBand / paintFlat: light top edge, shaded foot) or a plain one.
 */
export function slab(fb, E, sA, sB, yA, yB, d, faces = 'FTB', o0 = 0) {
  const ua = sA / 2.4 + 0.07, ub = ua + (sB - sA) / 2.4;
  if (faces.includes('F')) wq(fb, E, sA, sB, yA, yB, d, ua, ub, 0.05, 0.95);
  if (faces.includes('T')) quad(fb, E, [sA, yB, o0], [sB, yB, o0], [sB, yB, d], [sA, yB, d], 0, 1, 0, [ua, 0.62, ub, 0.62, ub, 0.5, ua, 0.5]);
  if (faces.includes('B')) quad(fb, E, [sA, yA, o0], [sB, yA, o0], [sB, yA, d], [sA, yA, d], 0, -1, 0, [ua, 0.03, ub, 0.03, ub, 0.075, ua, 0.075]);
  if (faces.includes('L')) quad(fb, E, [sA, yA, o0], [sA, yA, d], [sA, yB, d], [sA, yB, o0], -1, 0, 0, [0.1, 0.05, 0.2, 0.05, 0.2, 0.95, 0.1, 0.95]);
  if (faces.includes('R')) quad(fb, E, [sB, yA, o0], [sB, yA, d], [sB, yB, d], [sB, yB, o0], 1, 0, 0, [0.1, 0.05, 0.2, 0.05, 0.2, 0.95, 0.1, 0.95]);
}

/**
 * Canted bay window standing on the ground in front of a window bay: two splays and a front, each showing the window
 * cell (u0..u0+1, v0..v0+rows over yA..yB), under a flat lead top (caller emits `top` after switching cell). 6 triangles.
 */
export function bayWindow(fb, E, sA, sB, yA, yB, u0, v0, rows, sp, p) {
  const f0 = sA + sp, f1 = sB - sp, k = Math.SQRT1_2;
  quad(fb, E, [sA, yA, 0], [f0, yA, p], [f0, yB, p], [sA, yB, 0], -k, 0, k, [u0 + 0.3, v0, u0 + 0.7, v0, u0 + 0.7, v0 + rows, u0 + 0.3, v0 + rows]);
  quad(fb, E, [f0, yA, p], [f1, yA, p], [f1, yB, p], [f0, yB, p], 0, 0, 1, [u0 + 0.24, v0, u0 + 0.76, v0, u0 + 0.76, v0 + rows, u0 + 0.24, v0 + rows]);
  quad(fb, E, [f1, yA, p], [sB, yA, 0], [sB, yB, 0], [f1, yB, p], k, 0, k, [u0 + 0.3, v0, u0 + 0.7, v0, u0 + 0.7, v0 + rows, u0 + 0.3, v0 + rows]);
}
/** Lid of a bay (or any trapezoid standing p out of the wall), slightly oversailing. 2 triangles. */
export function bayTop(fb, E, sA, sB, y, sp, p) {
  quad(fb, E, [sA - 0.06, y, 0], [sB + 0.06, y, 0], [sB - sp + 0.04, y + 0.02, p + 0.07], [sA + sp - 0.04, y + 0.02, p + 0.07], 0, 1, 0.1, [0.1, 0.1, 0.6, 0.1, 0.5, 0.35, 0.2, 0.35]);
}

/** Underside of an oriel: the same trapezoid seen from below. 2 triangles. */
export function bayUnder(fb, E, sA, sB, y, sp, p) {
  quad(fb, E, [sA, y, 0], [sB, y, 0], [sB - sp, y, p], [sA + sp, y, p], 0, -1, 0, [0.1, 0.03, 0.6, 0.03, 0.5, 0.07, 0.2, 0.07]);
}

/** Shop awning: canvas sloping out and down from yTop, seen from above and below, with a valance. 6 triangles. */
export function awning(fb, E, sA, sB, yTop, proj, drop) {
  const ua = sA / 1.3, ub = sB / 1.3, yF = yTop - drop;
  quad(fb, E, [sA, yTop, 0.04], [sB, yTop, 0.04], [sB, yF, proj], [sA, yF, proj], 0, proj, drop, [ua, 0.95, ub, 0.95, ub, 0.2, ua, 0.2]);
  quad(fb, E, [sA, yTop, 0.04], [sB, yTop, 0.04], [sB, yF, proj], [sA, yF, proj], 0, -proj, -drop, [ua, 0.95, ub, 0.95, ub, 0.2, ua, 0.2]);
  wq(fb, E, sA, sB, yF - 0.2, yF, proj, ua, ub, 0.02, 0.2);
}

/** Hanging sign board at right angles to the wall, both faces. 4 triangles. */
export function hangingSign(fb, E, s, y0, y1, o0, o1, q = -1) {
  // q 0..3: one of the four painted boards of the signBoard cell (pass 7); -1 = a plain cell
  const u0 = q < 0 ? 0.1 : (q % 2) * 0.5 + 0.015, u1 = q < 0 ? 0.7 : u0 + 0.47, v0 = q < 0 ? 0.1 : (1 - (q >> 1)) * 0.5 - 0.485, v1 = q < 0 ? 0.9 : v0 + 0.47;
  for (const sd of [1, -1]) quad(fb, E, [s, y0, o0], [s, y0, o1], [s, y1, o1], [s, y1, o0], sd, 0, 0, [u0, v0, u1, v0, u1, v1, u0, v1]);
}

/**
 * Wall-dormer gable on the eaves line: a triangle of wall flush with the front (current cell) — the caller then
 * switches to the roof cell and calls gabletRoof. gw = width, gh = height. 1 + 4 triangles.
 */
export function gabletFront(fb, E, sC, y0, gw, gh, bay, storey) {
  const nx = E.nx, nz = E.nz, P = (s, y) => fb.v(E.lx + E.rx * s, y, E.lz + E.rz * s, nx, 0, nz, s / bay, y / storey);
  fb.triFacing(P(sC - gw / 2, y0), P(sC + gw / 2, y0), P(sC, y0 + gh), nx, 0, nz);
}
export function gabletRoof(fb, E, sC, y0, gw, gh, depth, rs) {
  const ov = 0.2, sl = Math.hypot(gw / 2, gh);
  for (const sd of [-1, 1]) {
    const sE = sC + sd * (gw / 2 + 0.08), yE = y0 - 0.08 * (gh / (gw / 2));
    quad(fb, E, [sE, yE, ov], [sC, y0 + gh, ov], [sC, y0 + gh, -depth], [sE, yE, 0], sd * gh, gw / 2, 0, [0, 0, 0, sl / rs, (depth + ov) / rs, sl / rs, ov / rs, 0]);
  }
}

/** Buttress with a weathered (sloping) head. 8 triangles. */
export function buttress(fb, E, sC, y0, y1, w, d) {
  const a = sC - w / 2, b = sC + w / 2, yt = y1 + d * 1.4, S = 3.2;
  wq(fb, E, a, b, y0, y1, d, a / S, b / S, y0 / S, y1 / S);
  quad(fb, E, [a, y0, 0], [a, y0, d], [a, y1, d], [a, yt, 0], -1, 0, 0, [0, y0 / S, d / S, y0 / S, d / S, y1 / S, 0, yt / S]);
  quad(fb, E, [b, y0, 0], [b, y0, d], [b, y1, d], [b, yt, 0], 1, 0, 0, [0, y0 / S, d / S, y0 / S, d / S, y1 / S, 0, yt / S]);
  quad(fb, E, [a, y1, d], [b, y1, d], [b, yt, 0], [a, yt, 0], 0, d, yt - y1, [a / S, 0.1, b / S, 0.1, b / S, 0.4, a / S, 0.4]);
}
