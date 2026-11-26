// Worcester College, the Provost's Lodgings (Henry Keene, 1773-76): the garden (west) front with its pedimented
// centre, relieving arch and horseshoe stair, the south side, the black front door on the east return at the end of the
// terrace walk, the hipped slate roof round its lead flat. Called by places/worcester_yard.js with the college's Batch
// in the LOCAL frame; the plan, its sources and what is known or guessed are in _worcester_yard_plan.js (LODG, ATTR).
// Every height is above the garden at the house's foot (LODG.base = where that is in the drawn world).
import { rectPts, archPts } from './_worcester_kit.js';
import { WORC_TERRACE as WT } from './_worcester_shared.js';
import { LODG, L2W } from './_worcester_yard_plan.js';
import { face, wall, win, frustum, rail, T } from './_worcester_yard_kit.js';

const ROCK = 'wyRock';      // the rock-faced basement
/** the garden stair's footprint (a U: the well between the flights is open), local ring */
export function stairRing() {
  const S = LODG.stair, vc = (LODG.v0 + LODG.v1) / 2, uf = LODG.u0 - LODG.centre.out, P = (a, b) => [uf - b, vc + a];
  return [P(-S.half, 0), P(S.half, 0), P(S.half, S.out), P(S.well, S.out), P(S.well, S.landing), P(-S.well, S.landing), P(-S.well, S.out), P(-S.half, S.out)];
}

export function buildLodgings(game, B) {
  const L = LODG, Y = L.y, W = L.win, len = L.v1 - L.v0, wid = L.u1 - L.u0, xc = len / 2, cw = L.centre.w, c0 = xc - cw / 2, c1 = xc + cw / 2;
  B.push(T(0, L.base, 0));
  // the windows of an ordinary bay, storey by storey (o.d = 0: painted flat, on the sides nobody has a picture of)
  const bayWins = (c, o = {}) => [
    { c, y0: W.main[0], w: W.w, h: W.main[1] - W.main[0], hood: o.d === 0 ? null : 'cornice', hoodY: W.mainHood, ring: 0.14, floor: 1, ...o },
    { c, y0: W.first[0], w: W.w, h: W.first[1] - W.first[0], hood: o.d === 0 ? null : o.hood1 || 'cornice', hoodY: W.firstHood, ring: 0.14, floor: 2, ...o },
    { c, y0: W.second[0], w: W.w, h: W.second[1] - W.second[0], ring: 0.16, floor: 3, ...o },
  ];
  const baseWin = (c, o = {}) => ({ c, y0: W.base[0], w: 1.1, h: W.base[1] - W.base[0], key: 'sashAttic', floor: 0, ...o });
  // a face of the house: the rock-faced basement, the plat band, ashlar above with a band over the main storey
  const side = (x0, x1, wins = [], bwins = []) => {
    wall(B, ROCK, rectPts(x0, 0, x1, Y.plinth), bwins);
    wall(B, 'stone', rectPts(x0, Y.plinth, x1, Y.frieze), wins);
    B.boxXZ('stoneDress', x0, x1, Y.plinth, Y.main, 0, 0.07, { bottom: true });
    B.boxXZ('stoneDress', x0, x1, Y.band[0], Y.band[1], 0, 0.07, { bottom: true });
  };

  // ================================================================= the garden (west) front
  B.push(face('w', L.u0, L.v0));
  side(0, c0, bayWins(L.flankBay), [baseWin(L.flankBay)]);
  side(c1, len, bayWins(len - L.flankBay), [baseWin(len - L.flankBay)]);
  // the centre stands forward: its two cheeks, then its own face
  for (const [x, n] of [[c0, -1], [c1, 1]]) B.poly('stone', [[x, 0, 0], [x, 0, L.centre.out], [x, Y.frieze, L.centre.out], [x, Y.frieze, 0]], [n, 0, 0]);
  B.push(T(0, 0, L.centre.out));
  {
    const M = L.mid, tri = M.tri, sd = M.side, ys = M.ent[1], R = M.arch.r;
    // basement: the door under the stair's landing
    wall(B, ROCK, rectPts(c0, 0, c1, Y.plinth), [{ c: xc, y0: 0.02, w: 1.3, h: 1.55, arch: true, key: 'archDoor', d: 0.2, door: true, floor: 0 }]);
    B.boxXZ('stoneDress', c0, c1, Y.plinth, Y.main, 0, 0.07, { bottom: true });
    // main storey and above: the garden door between two narrow lights; the tripartite window; the lunette in its arch
    const lun = archPts(xc, 2 * R, ys + 0.06, ys + 0.1, 12);
    B.face('stone', rectPts(c0, Y.plinth, c1, Y.frieze), [
      rectPts(xc - M.door.w / 2, Y.main, xc + M.door.w / 2, M.door.y1), ...[-1, 1].map((s) => rectPts(xc + s * sd.d - sd.w / 2, sd.y0, xc + s * sd.d + sd.w / 2, sd.y1)),
      rectPts(xc - tri.cw / 2, tri.y0, xc + tri.cw / 2, tri.y1), ...[-1, 1].map((s) => rectPts(xc + s * sd.d - sd.w / 2, tri.y0, xc + s * sd.d + sd.w / 2, tri.y1)), lun]);
    win(B, 'stone', { c: xc, y0: Y.main, w: M.door.w, h: M.door.y1 - Y.main, door: true, hood: 'cornice', hoodY: W.mainHood, floor: 1 });
    for (const s of [-1, 1]) { win(B, 'stone', { c: xc + s * sd.d, y0: sd.y0, w: sd.w, h: sd.y1 - sd.y0, floor: 1 }); win(B, 'stone', { c: xc + s * sd.d, y0: tri.y0, w: sd.w, h: tri.y1 - tri.y0, floor: 2 }); }
    win(B, 'stone', { c: xc, y0: tri.y0, w: tri.cw, h: tri.y1 - tri.y0, floor: 2 });
    // the rusticated piers of the main storey: channelled joints (drawn as dark lines: no moulded blocks)
    for (const s of [-1, 1]) for (let y = Y.main + 0.45; y < Y.band[0] - 0.2; y += 0.47) { const a = xc + s * M.pier[0], b = xc + s * M.pier[1]; B.poly('wyGroove', [[Math.min(a, b), y, 0.012], [Math.max(a, b), y, 0.012], [Math.max(a, b), y + 0.05, 0.012], [Math.min(a, b), y + 0.05, 0.012]], [0, 0, 1]); }
    B.boxXZ('stoneDress', c0, c1, Y.band[0] - 0.2, Y.band[1], 0, 0.09, { bottom: true });
    // pilasters between and beside the three lights, their entablature
    for (const d of [0.95, 2.1, 3.0, 3.62]) for (const s of [-1, 1]) B.boxXZ('stoneDress', xc + s * d - 0.12, xc + s * d + 0.12, tri.y0, M.ent[0], 0, 0.1, { top: false });
    B.boxXZ('stoneDress', xc - 3.85, xc + 3.85, M.ent[0], ys - 0.18, 0, 0.14, { bottom: true });
    B.boxXZ('stoneDress', xc - 3.95, xc + 3.95, ys - 0.18, ys, 0, 0.26, { bottom: true });
    // the relieving arch: its ring, the lunette's glass with its two stone mullions and the sash in the middle
    { const n = 12, ro = R + M.arch.ring, y0 = ys + 0.06, pt = (r, i) => { const t = (i / n) * Math.PI; return [xc + Math.cos(t) * r, y0 + 0.04 + Math.sin(t) * r, 0.05]; };
      for (let i = 0; i < n; i++) B.poly('stoneDress', [pt(R, i), pt(ro, i), pt(ro, i + 1), pt(R, i + 1)], [0, 0, 1]);
      B.reveal('stone', lun, 0, -0.14, true);
      const gp = (i) => (i === 0 ? [xc + R, y0] : i === n ? [xc - R, y0] : pt(R, i));      // (the glass comes down to the ledge at both ends)
      for (let i = 0; i < n; i++) { const a = gp(i), b = gp(i + 1); B.poly('glassDark', [[xc, y0, -0.14], [a[0], a[1], -0.14], [b[0], b[1], -0.14]], [0, 0, 1], [[0, 0], [0, 0], [0, 0]]); }
      B.poly('stone', [[xc - R, y0, -0.14], [xc + R, y0, -0.14], [xc + R, y0, 0], [xc - R, y0, 0]], [0, 1, 0]);
      for (const s of [-1, 1]) B.boxXZ('stoneDress', xc + s * 0.72 - 0.09, xc + s * 0.72 + 0.09, y0, y0 + Math.sqrt(R * R - 0.81 * 0.81) + 0.02, -0.14, -0.02, { top: false });
      B.unit('sash', rectPts(xc - 0.55, y0 + 0.1, xc + 0.55, y0 + 1.55), -0.125, [77, 3]); }
    // the pediment: tympanum, raking cornices (a front and a soffit each), the slated roof behind it running back over
    // the main roof's flat to a small gable of its own
    { const e = 0.55, x0 = c0 - e, x1 = c1 + e, ap = Y.apex, zt = 0.08, zf = e - 0.1, th = 0.34, run = (x1 - x0) / 2, rise = ap - th - Y.top, back = -(L.centre.out + 2.7);
      B.poly('stone', [[x0, Y.top, zt], [x1, Y.top, zt], [xc, ap - th, zt]], [0, 0, 1]);
      for (const [xe, sg] of [[x0, -1], [x1, 1]]) {
        B.poly('stoneDress', [[xe, Y.top, zf], [xc, ap - th, zf], [xc, ap, zf], [xe, Y.top + th, zf]], [0, 0, 1]);
        B.poly('stoneDress', [[xe, Y.top, zt], [xc, ap - th, zt], [xc, ap - th, zf], [xe, Y.top, zf]], [sg * rise, -run, 0]);
        B.poly('slate', [[xe, Y.top + th + 0.02, e], [xc, ap + 0.02, e], [xc, ap + 0.02, back], [xe, Y.top + th + 0.02, back]], [sg * rise, run, 0]);
      }
      const dx = ((ap + 0.02 - Y.roof) * run) / rise;
      B.poly('slate', [[xc - dx, Y.roof, back], [xc + dx, Y.roof, back], [xc, ap + 0.02, back]], [0, 0, -1]); }
    gardenStair(B, xc);
  }
  B.pop();
  B.pop();

  // ================================================================= the south side: four bays
  B.push(face('s', L.u0, L.v1));
  side(0, wid, L.south.bays.flatMap((c, i) => bayWins(c, { hood1: L.south.hoods[i] })), L.south.bays.slice(0, 2).map((c) => baseWin(c)));
  B.pop();

  // ================================================================= the east side
  // south of the Terrace: the return with the black front door (six panels, a radial fanlight), two steps, a sash to each floor above
  { const a = WT.vS - L.v1, dx = L.v1 - L.door.v, d = L.door;      // (a < 0: the return's length is -a)
    B.push(face('e', L.u1, L.v1));
    wall(B, ROCK, rectPts(0, 0, -a, Y.plinth));
    // (the wisteria that smothers this wall in the photograph: the atlas's creeper, as on the Terrace's quad front)
    wall(B, 'stoneIvyT', rectPts(0, Y.plinth, -a, Y.frieze), [
      { c: dx, y0: Y.main, w: d.w, h: d.h, arch: true, key: 'archDoor', d: 0.2, door: true, ring: 0.16, floor: 0, reveal: 'stone' },
      { c: dx, y0: W.first[0], w: W.w, h: W.first[1] - W.first[0], ring: 0.14, floor: 2 }, { c: dx, y0: W.second[0], w: W.w, h: W.second[1] - W.second[0], ring: 0.16, floor: 3 }]);
    B.boxXZ('stoneDress', 0, -a, Y.band[0], Y.band[1], 0, 0.07, { bottom: true });
    B.boxXZ('pavingSolid', dx - 0.85, dx + 0.85, Y.main - 0.3, Y.main - 0.15, 0, 0.72, { bottom: true });
    B.boxXZ('pavingSolid', dx - 0.72, dx + 0.72, Y.main - 0.15, Y.main, 0, 0.4, { bottom: true });
    B.pop(); }
  // behind the Terrace (seen only over its roof), and north of it: two bays to each floor (a guess)
  B.push(face('e', L.u1, WT.vS)); B.face('stone', rectPts(0, 0, WT.vS - WT.vN, Y.frieze)); B.pop();
  B.push(face('e', L.u1, WT.vN));
  { const n = WT.vN - L.v0; wall(B, ROCK, rectPts(0, 0, n, Y.plinth)); wall(B, 'stone', rectPts(0, Y.plinth, n, Y.frieze), [n * 0.27, n * 0.72].flatMap((c) => bayWins(c, { d: 0 })));
    B.boxXZ('stoneDress', 0, n, Y.plinth, Y.main, 0, 0.07, { bottom: true }); B.boxXZ('stoneDress', 0, n, Y.band[0], Y.band[1], 0, 0.07, { bottom: true }); }
  B.pop();
  // ================================================================= the north side: three bays (a guess)
  B.push(face('n', L.u1, L.v0));
  side(0, wid, [2.3, 6.3, 10.3].flatMap((c) => bayWins(c, { d: 0 })), [2.3, 6.3].map((c) => baseWin(c, { d: 0, ring: 0.1 })));
  B.pop();

  // ================================================================= cornice, roof, stack
  const e1 = 0.18, e2 = 0.55, uf = L.u0 - L.centre.out, vc = (L.v0 + L.v1) / 2;
  B.boxXZ('stoneDress', L.u0 - e1, L.u1 + e1, Y.frieze, Y.cornice, L.v0 - e1, L.v1 + e1, { top: false, bottom: true });
  B.boxXZ('stoneDress', L.u0 - e2, L.u1 + e2, Y.cornice, Y.top, L.v0 - e2, L.v1 + e2, { bottom: true });
  // … carried round the centre where it stands forward (two blocks that only add what is in front of the others)
  B.boxXZ('stoneDress', uf - e1, L.u0 - e1, Y.frieze, Y.cornice, vc - cw / 2 - e1, vc + cw / 2 + e1, { top: false, bottom: true });
  B.boxXZ('stoneDress', uf - e2, L.u0 - e2, Y.cornice, Y.top, vc - cw / 2 - e2, vc + cw / 2 + e2, { bottom: true });
  frustum(B, 'slate', [L.u0 - 0.1, L.u1 + 0.1, L.v0 - 0.1, L.v1 + 0.1], Y.top + 0.02, [L.u0 + 2.6, L.u1 - 2.6, L.v0 + 2.6, L.v1 - 2.6], Y.roof, 'lead');
  { const uc = (L.u0 + L.u1) / 2;
    B.boxXZ('stone', uc - 1.1, uc + 1.1, Y.roof, Y.stack, vc - 0.45, vc + 0.45, { top: false });
    B.boxXZ('stoneDress', uc - 1.2, uc + 1.2, Y.stack, Y.stack + 0.18, vc - 0.55, vc + 0.55, { bottom: true });
    for (let i = 0; i < 6; i++) B.cyl('terracotta', uc - 0.9 + i * 0.36, Y.stack + 0.18, vc, 0.11, 0.42, 6, true, 0.13); }
  B.pop();

  // colliders: the house, the stair (not climbable: the garden door at its head is shut)
  const col = game.worldCollider;
  col.addPolygon([[L.u0, L.v0], [L.u1, L.v0], [L.u1, L.v1], [L.u0, L.v1]].map(([u, v]) => L2W(u, v)), { tag: 'building' });
  col.addPolygon(stairRing().map(([u, v]) => L2W(u, v)), { tag: 'wall' });
}

/**
 * The garden stair, in the west front's frame moved out to the centre's face (x along the front, z out): two flights
 * that begin side by side at the foot, 3.7 m out, come in towards the house and fan round a newel to the landing before
 * the garden door (the 1939 plan draws the fanned steps; the photograph the iron rails and the door under the landing).
 */
function gardenStair(B, xc) {
  const S = LODG.stair, h = S.rise, n = S.risers, ns = S.straight, nw = n - 1 - ns, going = (S.out - S.landing) / ns, top = (k) => k * h, yL = top(n);
  const Pa = S.well, Pb = S.landing, Wd = S.half - S.well, ac = Math.atan2(Pb, Wd);
  const hit = (al) => { const ca = Math.cos(al), sa = Math.sin(al), t = Math.min(ca > 1e-6 ? Wd / ca : 1e9, sa > 1e-6 ? Pb / sa : 1e9); return [Pa + ca * t, Pb - sa * t]; };
  const yc = top(ns + 1 + Math.floor((ac / (Math.PI / 2)) * nw));      // the tread at the outer corner by the wall
  for (const sg of [-1, 1]) {
    const A = (a) => xc + sg * a;
    for (let k = 1; k <= ns; k++) {      // the straight treads, coming in from the foot
      const b1 = S.out - (k - 1) * going, b0 = b1 - going, y = top(k);
      B.poly('pavingSolid', [[A(S.well), y, b1], [A(S.half), y, b1], [A(S.half), y, b0], [A(S.well), y, b0]], [0, 1, 0]);
      B.poly('stoneDress', [[A(S.well), y - h, b1], [A(S.half), y - h, b1], [A(S.half), y, b1], [A(S.well), y, b1]], [0, 0, 1]);
    }
    for (let j = 0; j < nw; j++) {      // the winders, fanned about the newel at the well's inner corner
      const a0 = (j / nw) * Math.PI / 2, a1 = ((j + 1) / nw) * Math.PI / 2, q0 = hit(a0), q1 = hit(a1), y = top(ns + 1 + j), pts = [[Pa, Pb], q0];
      if (q0[0] > S.half - 1e-6 && q1[1] < 1e-6 && q0[1] > 1e-6) pts.push([S.half, 0]);
      pts.push(q1);
      B.poly('pavingSolid', pts.map(([a, b]) => [A(a), y, b]), [0, 1, 0]);
      B.poly('stoneDress', [[A(Pa), y - h, Pb], [A(q0[0]), y - h, q0[1]], [A(q0[0]), y, q0[1]], [A(Pa), y, Pb]], [sg * Math.sin(a0), 0, Math.cos(a0)]);
    }
    B.poly('stoneDress', [[A(Pa), top(n - 1), 0], [A(Pa), top(n - 1), Pb], [A(Pa), yL, Pb], [A(Pa), yL, 0]], [sg, 0, 0]);      // the last riser, up to the landing
    B.poly('stone', [[A(Pa), 0, 0], [A(Pa), 0, Pb], [A(Pa), yL - 0.3, Pb], [A(Pa), yL - 0.3, 0]], [-sg, 0, 0]);                // the wall under it, towards the basement door
    // the strings: a stone wall each side of the flight, a little above the treads, the iron rail on it
    const t = 0.14, up = 0.16;
    const string = (a, ao, prof) => {      // prof: [[b, y]] along the string's top, from the foot
      const P = (p, aa, yy = p[1]) => [A(aa), yy, p[0]];
      for (let i = 0; i < prof.length - 1; i++) {
        const p = prof[i], q = prof[i + 1];
        B.poly('stone', [P(p, ao, 0), P(q, ao, 0), P(q, ao), P(p, ao)], [sg * Math.sign(ao - a), 0, 0]);
        B.poly('stone', [P(p, a, 0), P(q, a, 0), P(q, a), P(p, a)], [sg * Math.sign(a - ao), 0, 0]);
        B.poly('stoneDress', [P(p, a), P(q, a), P(q, ao), P(p, ao)], [0, 1, 0]);
      }
      B.poly('stone', [P(prof[0], a, 0), P(prof[0], ao, 0), P(prof[0], ao), P(prof[0], a)], [0, 0, 1]);
      // (the last post stands 0.25 m out from the house: clear of the bands on its wall)
      rail(B, prof.flatMap((p, i) => { const out = [[A((a + ao) / 2), p[1], i === 0 ? p[0] - 0.1 : Math.max(p[0], 0.25)]]; if (i < prof.length - 1) { const q = prof[i + 1]; out.push([A((a + ao) / 2), (p[1] + q[1]) / 2, (p[0] + q[0]) / 2]); } return out; }), 0.85);
    };
    string(S.half, S.half + t, [[S.out, top(1) + up], [S.landing, top(ns) + up + 0.1], [0.05, yc + up + 0.1]]);
    string(S.well, S.well - t, [[S.out, top(1) + up], [S.landing + 0.05, top(ns) + up + 0.1]]);
  }
  // the landing: a stone slab on the two walls, a rail across its front
  B.poly('pavingSolid', [[xc - Pa, yL, 0.07], [xc + Pa, yL, 0.07], [xc + Pa, yL, Pb], [xc - Pa, yL, Pb]], [0, 1, 0]);      // (from the plat band's face: the band's top is the same level)
  B.poly('stoneDress', [[xc - Pa, yL - 0.3, Pb], [xc + Pa, yL - 0.3, Pb], [xc + Pa, yL, Pb], [xc - Pa, yL, Pb]], [0, 0, 1]);
  B.poly('stoneLit', [[xc - Pa, yL - 0.3, 0], [xc + Pa, yL - 0.3, 0], [xc + Pa, yL - 0.3, Pb], [xc - Pa, yL - 0.3, Pb]], [0, -1, 0]);
  rail(B, [-Pa + 0.07, -Pa / 2, 0, Pa / 2, Pa - 0.07].map((a) => [xc + a, yL, Pb - 0.07]), 0.95);
}
