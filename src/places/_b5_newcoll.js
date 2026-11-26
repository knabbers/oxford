// New College (founded 1379): geometry for places/new_college.js — see docs/research/landmarks_batch5.md.
// Everything is laid out in the Great Quad's own frame (the mapped chapel's north wall runs 8.7° south of east): u east
// along the chapel, v south across the quad, origin Q0. Footprints come from the map (ids in new_college.js); heights,
// window rhythms and details are from photographs remembered and the sources listed in the research notes (G = guessed).
import { RB, rect, corners, at, range, tower, statue, crown, trunk, pointPts, frame, rectPts, cityWall, TAU } from './_b5_kit.js';

export const A = 0.1513, Q0 = [560, 95];
const cA = Math.cos(A), sA = Math.sin(A);
/** quad frame -> world [x, z] */
export const Q = (u, v) => [Q0[0] + u * cA - v * sA, Q0[1] + u * sA + v * cA];
/** world -> quad frame [u, v] */
export const toQ = (x, z) => { const dx = x - Q0[0], dz = z - Q0[1]; return [dx * cA + dz * sA, -dx * sA + dz * cA]; };
/** an E-W rect from quad-frame bounds */
export const QR = (u0, u1, v0, v1) => { const c = Q((u0 + u1) / 2, (v0 + v1) / 2); return rect(c[0], c[1], A, u1 - u0, v1 - v0); };
/** a N-S rect (long axis along v): side 0 faces west, 1 east, 2 south, 3 north */
export const QRv = (u0, u1, v0, v1) => { const c = Q((u0 + u1) / 2, (v0 + v1) / 2); return rect(c[0], c[1], A + Math.PI / 2, v1 - v0, u1 - u0); };
const HEAD_W = Math.atan2(-cA, -sA), HEAD_E = Math.atan2(cA, sA), HEAD_S = Math.atan2(-sA, cA);

// ---- the parts (quad-frame bounds from the mapped footprints)
export const NC = {
  choir: QR(-14.6, 18, -33.2, -17.7), ante: QRv(-27.6, -14.6, -36.3, -8.8), hall: QR(17.8, 41.1, -29.4, -17.8),
  muniment: { c: Q(37.2, -13.8), w: 8, top: 24.5 }, bell: { c: Q(-44.55, -42.5), w: 9.6, top: 27 },
  gate: QR(-31, -20, -1, 7), gateV: 2.9,
  cloister: { u0: -83.5, u1: -32.6, v0: -37.5, v1: -1.5, gu0: -76, gu1: -39.5, gv0: -32, gv1: -9, h: 5.4, door: -5.2 },
  oak: Q(-57.7, -20.5),
  robinson: { c: [640.8, 22.2], w: 7.2, top: 21.5 },
  mound: { c: [726, 118.5], r: 14.5, top: 6.4, steps: -Math.PI / 2 - 0.25 },
  // the city wall on the garden's north and east sides (mapped w23762464, simplified: the bastion points left out) and its
  // six bastions (centres from the mapped bumps, outward normal); the stretch north of the cloister (w126369476)
  wall: [[526.3, 51.5], [581.8, 60.7], [588.1, 61.8], [640.4, 69.5], [646.5, 69.6], [696.6, 78], [702.9, 79], [753.5, 84.7], [757.5, 89.7], [756.4, 118], [755.4, 145.4], [755.3, 151.5], [756.8, 210.3], [757, 219.9], [757.2, 221.9]],
  wall2: [[473.8, 42.3], [477.2, 42.8], [515.6, 49.6], [516.8, 49.9]],
  bastions: [[585.2, 58.4, 0], [643.8, 66.6, 0], [699.9, 76.2, 0], [758.6, 83.6, 0.75], [757.2, 148.5, 1], [758.4, 215.0, 1]],
  wallH: 7.2,
};
const N_OUT = [Math.sin(A) * 1, -Math.cos(A)];   // the wall's outward normal on the north side (to Holywell)

/** the chapel, the ante-chapel, the hall, the Muniment Tower and the bell tower: q 0 near, 1 mid, 2 far */
export function buildChapelRange(q) {
  const B = new RB();
  const perp = (w) => [5.4, 16.4, 'perp', w, 'point'];
  // choir: five tall Perpendicular windows each side between buttresses with pinnacles, a battlemented parapet, lead roof
  range(B, { R: NC.choir, farWin: true, h: 17.6, wall: 'stoneGrey', dress: 'dress', roof: 'gable', roofKey: 'lead', pitch: 0.42, crenel: true, parapet: 0.9, plinth: 0.5, strings: [5.0],
    buttress: { w: 1.0, d: 1.5, h: 15.5, pinnacle: true },
    sides: [{ rows: [perp(3.3)], bay: 6.2 }, { rows: [perp(3.3)], bay: 6.2 }, { rows: [] }, {}], noWalls: [3] }, q);
  // ante-chapel: the great west window to the cloister, two more on the west face, one to the quad
  const P = (x, w, y0 = 6.0, y1 = 15.6) => ({ x, y0, y1, key: 'perp', w, pts: pointPts(x, w, y0, y1 - w * 0.7) });
  range(B, { R: NC.ante, farWin: true, h: 17.6, wall: 'stoneGrey', roof: 'gable', roofKey: 'lead', pitch: 0.42, crenel: true, parapet: 0.9, plinth: 0.5, strings: [5.0],
    buttress: { w: 1.0, d: 1.4, h: 15.5, pinnacle: true },
    sides: [{ extra: [P(-2.9, 6.4, 4.6, 16.6), P(-11.4, 2.8), P(7.6, 2.8)], bay: 9.2 }, { extra: [P(9.3, 3.0)], noButtress: true }, { extra: [P(0, 4.2, 9.5, 16.4)] }, { extra: [P(0, 3.6)] }] }, q);
  // hall over its undercroft: four high windows to the quad, small lights below, the Muniment Tower in front of the east bay
  const hc = (NC.hall.L / 2) - 7.4;
  range(B, { R: NC.hall, farWin: true, h: 16.0, wall: 'stoneGrey', roof: 'gable', roofKey: 'lead', pitch: 0.5, crenel: true, parapet: 0.9, plinth: 0.5, strings: [6.6],
    buttress: { w: 0.9, d: 1.2, h: 14.5, pinnacle: true },
    sides: [{ rows: [[8.0, 14.6, 'perp', 2.3, 'point'], [2.2, 4.2, 'leaded', 1.1]], bay: 4.6, skip: (x) => x > hc - 1.6 }, { rows: [[8.0, 14.6, 'perp', 2.3, 'point']], bay: 4.6 }, { extra: [P(0, 3.2, 9, 15.2)] }, {}], noWalls: [3] }, q);
  // the Muniment Tower: four storeys of small windows, the hall stair's arch at its foot
  {
    const M = NC.muniment, faces = [[], [], [], []];
    const win = (y, w = 1.0, hgt = 1.7, key = 'leaded') => ({ key, pts: rectPts(-w / 2, y, w / 2, y + hgt) });
    faces[0] = [{ key: 'archDoorDk', pts: pointPts(0, 2.4, 0, 3.4) }, win(6.4, 1.3, 2.2, 'mullion'), win(11.2, 1.3, 2.2, 'mullion'), win(16.0, 1.3, 2.2, 'mullion'), win(20.4)];
    faces[3] = [win(11.2), win(16.0), win(20.4)]; faces[1] = [win(20.4)]; faces[2] = [win(20.4)];
    tower(B, { cx: M.c[0], cz: M.c[1], a: A, w: M.w, top: M.top, wall: 'stoneGrey', stages: [[0, M.top, 'stoneGrey']], strings: [5.6, 10.4, 15.2, 19.6], crenel: true, merlons: 4, pinnacles: [2.0], corner: 0.9, faces }, q);
  }
  // the bell tower (c. 1400) on the line of the city wall: plain, massive, a belfry of paired louvred lights
  {
    const T = NC.bell, faces = [0, 1, 2, 3].map(() => [{ key: 'leaded', pts: pointPts(0, 0.9, 9.0, 11.4) }, { key: 'leaded', pts: pointPts(0, 0.9, 14.2, 16.6) }]);
    tower(B, { cx: T.c[0], cz: T.c[1], a: A, w: T.w, top: T.top, wall: 'stoneGrey', stages: [[0, T.top, 'stoneGrey']], strings: [7.5, 12.6, 18.4], crenel: true, merlons: 5, pinnacles: [2.6, true], corner: 1.1,
      belfry: { y0: 19.4, y1: 24.6, key: 'louvre', n: 2, w: 1.5 }, faces }, q);
  }
  return B;
}

/** the gate tower on New College Lane: the gate passage, three statues in niches on each face, battlements */
export function buildGate(q) {
  const B = new RB(), R = NC.gate, h = 18.2, gw = 3.2, gx = 0;
  // the passage axis is along u; on the west (lane) face x runs from north to south: local x of the gate = v - centre v
  const vc = (-1 + 7) / 2, xg = NC.gateV - vc;
  const gate = (side) => ({ x: side ? -xg : xg, y0: 0, y1: 4.8, key: null, farKey: 'shade', w: gw, rec: R.L, open: true, noReveal: side === 1, pts: pointPts(side ? -xg : xg, gw, 0, 4.8 - gw * 0.55) });
  const niche = (x) => ({ x, y0: 7.4, y1: 10.6, key: 'niche', w: 1.25, rec: 0.35, pts: pointPts(x, 1.25, 7.4, 10.6 - 0.9) });
  const win = (x) => ({ x, y0: 12.0, y1: 14.6, key: 'mullion', w: 1.9, pts: rectPts(x - 0.95, 12.0, x + 0.95, 14.6) });
  // rect R is along u: side 2 = east (quad), side 3 = west (lane); a side frame's local x runs +v on side 3, -v on side 2
  range(B, { R, h, wall: 'stoneGrey', dress: 'dress', roof: 'flat', roofKey: 'lead', crenel: true, parapet: 0.9, plinth: 0.45, strings: [6.6, 11.2],
    sides: [{ rows: [[12.0, 14.6, 'mullion', 1.8]], bay: 3.4 }, {}, { extra: [gate(1), niche(-xg - 2.3), niche(-xg), niche(-xg + 2.3), win(-xg)] }, { extra: [gate(0), niche(xg - 2.3), niche(xg), niche(xg + 2.3), win(xg)] }] }, q);
  // the statues (the Virgin and Child in the middle, an angel and the kneeling founder either side: G which is which)
  if (q < 2) for (const [side, hd] of [[3, HEAD_W], [2, HEAD_E]]) {
    const u = side === 3 ? -31 - 0.0 : -20 + 0.0, dir = side === 3 ? 1 : -1;
    for (const dv of [-2.3, 0, 2.3]) {
      const p = Q(u + dir * 0.17, NC.gateV + dv);
      statue(B, p[0], 7.45, p[1], hd, q, dv === 0 ? 'statue' : 'statueDk', dv === 0 ? 0.95 : 0.85);
    }
  }
  // the vault of the passage: a dark ceiling just under the reveal's top, and the gates' leaves folded back (open by day)
  if (q === 0) {
    for (const s of [-1, 1]) { const p0 = Q(-30.2, NC.gateV + s * (gw / 2 - 0.08)), p1 = Q(-28.8, NC.gateV + s * (gw / 2 - 0.08)); B.beam('oak', [p0[0], 2.0, p0[1]], [p1[0], 2.0, p1[1]], 0.1, 4.0); }
    // a door into the cloister from the quad, in the mapped block north of the gate (its quad face)
    { const d = Q(-19.68, NC.cloister.door); B.push(frame(d[0], 0, d[1], sA, -cA)); }
    B.unit('archDoorDk', pointPts(0, 1.6, 0, 2.6 - 0.9), 0.02, [3, 0]);
    B.pop();
    // the name board beside the gate on the lane
    const nb = Q(-31.2, NC.gateV - 3.4);
    B.push(frame(nb[0], 0, nb[1], -sA, cA)); B.card('sign_newcoll', [-0.9, 2.3, -0.02], [0.9, 2.3, -0.02], [0.9, 2.75, -0.02], [-0.9, 2.75, -0.02], [0.004, 0.004, 0.996, 0.996]); B.pop();
  }
  // the founder's plaque inside the passage (plain history)
  if (q === 0) { const pp = Q(-25.5, NC.gateV - gw / 2 + 0.03); B.push(frame(pp[0], 0, pp[1], cA, sA)); B.card('sign_plaque', [-0.9, 1.5, 0], [0.9, 1.5, 0], [0.9, 2.0, 0], [-0.9, 2.0, 0], [0.004, 0.004, 0.996, 0.996]); B.pop(); }
  void gx; void HEAD_S;
  return B;
}

/** the cloister (consecrated 1400): four walks under pitched stone-slate roofs with wagon ceilings, unglazed traceried
 *  openings to the garth, the holm oak in the garth */
export function buildCloister(q) {
  const B = new RB(), C = NC.cloister, h = C.h, roofTop = h + 2.6;
  // the outer wall: a ring of four faces, outward and inward
  const ring = [[C.u0, C.v0], [C.u1, C.v0], [C.u1, C.v1], [C.u0, C.v1]];
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = ring[i], [u1, v1] = ring[(i + 1) % 4], L = Math.hypot(u1 - u0, v1 - v0), p0 = Q(u0, v0), p1 = Q(u1, v1);
    const ax = (p1[0] - p0[0]) / L, az = (p1[1] - p0[1]) / L, mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
    // ring is clockwise seen from above in the quad frame (z down): outward = left of travel = (az, -ax)
    for (const out of [1, -1]) {
      B.push(frame(mx + az * out * 0.45, 0, mz - ax * out * 0.45, out * -ax, out * -az));
      const holes = [];
      // the door from the quad passage (east side, i = 1) and a window or two
      if (i === 1 && out === -1) holes.push(rectPts((C.door - (v0 + v1) / 2) - 0.8, 0.04, (C.door - (v0 + v1) / 2) + 0.8, 2.6));
      if (i === 1 && out === 1) holes.push(rectPts(-(C.door - (v0 + v1) / 2) - 0.8, 0.04, -(C.door - (v0 + v1) / 2) + 0.8, 2.6));
      if (q === 0 && holes.length) { B.face('wallOld', rectPts(-L / 2, 0, L / 2, h + (out === 1 ? 0.6 : 0)), holes, 0); if (out === 1) B.reveal('stoneGrey', holes[0], 0, -0.9, true); }
      else B.poly(out === 1 ? 'wallOld' : 'stoneGrey', [[-L / 2, 0, 0], [L / 2, 0, 0], [L / 2, h + (out === 1 ? 0.6 : 0), 0], [-L / 2, h + (out === 1 ? 0.6 : 0), 0]], [0, 0, 1], [[-L / 2, 0], [L / 2, 0], [L / 2, h], [-L / 2, h]]);
      B.pop();
    }
  }
  // the garth arcade: per side a wall with arched openings over a low wall, mullions; a doorway in the middle of each side
  const g = [[C.gu0, C.gv0], [C.gu1, C.gv0], [C.gu1, C.gv1], [C.gu0, C.gv1]], T = 0.9;
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = g[i], [u1, v1] = g[(i + 1) % 4], L = Math.hypot(u1 - u0, v1 - v0), p0 = Q(u0, v0), p1 = Q(u1, v1);
    const ax = (p1[0] - p0[0]) / L, az = (p1[1] - p0[1]) / L, mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
    const bay = 3.3, n = Math.floor((L - 1.2) / bay), xs = []; for (let k = 0; k < n; k++) xs.push(-((n - 1) * bay) / 2 + k * bay);
    const mid = Math.floor(n / 2);
    for (const out of [1, -1]) {     // out = 1: the face to the walk (outward of the garth ring); -1: to the garth
      const off = out === 1 ? T / 2 : -T / 2;
      B.push(frame(mx + az * off * 0 + (out === 1 ? az : -az) * 0, 0, mz, out * -ax, out * -az));
      B.push(frame(0, 0, T / 2, 1, 0));
      const holes = xs.map((x, k) => { const xx = out === 1 ? x : -x; return k === mid ? pointPts(xx, 2.0, 0.04, 3.0) : pointPts(xx, 2.3, 0.85, 3.3); });
      if (q === 0) {
        B.face('stoneGrey', rectPts(-L / 2, 0, L / 2, h - 0.2), holes, 0);
        if (out === 1) holes.forEach((pts, k) => B.reveal('stoneGrey', pts, 0, -T, k === mid));
      } else if (q === 1) {
        B.poly('stoneGrey', [[-L / 2, 0, 0], [L / 2, 0, 0], [L / 2, h - 0.2, 0], [-L / 2, h - 0.2, 0]], [0, 0, 1]);
        for (const pts of holes) B.unit('shade', pts, 0.02, [0, 0]);
      } else if (out === -1) B.poly('stoneGrey', [[-L / 2, 0, 0], [L / 2, 0, 0], [L / 2, h - 0.2, 0], [-L / 2, h - 0.2, 0]], [0, 0, 1]);
      if (q === 0 && out === 1) xs.forEach((x, k) => { if (k !== mid) { B.box('stoneGrey', x, 2.05, -T / 2, 0.16, 2.5, 0.2, 0, { bottom: true }); B.box('stoneGrey', x, 3.05, -T / 2, 2.3, 0.14, 0.2, 0, { bottom: true }); } });
      if (q < 2 && out === -1) B.box('dress', 0, h - 0.2 + 0.08, -T / 2, L + 0.1, 0.16, T + 0.12, 0, {});
      B.pop(); B.pop();
    }
  }
  // the roofs over the walks (each a pitched stone-slate roof from the outer wall to the arcade) and the wagon ceilings
  const walks = [
    [C.u0, C.u1, C.v0, C.gv0, 'ns'], [C.u0, C.u1, C.gv1, C.v1, 'ns'],
    [C.u0, C.gu0, C.gv0, C.gv1, 'ew'], [C.gu1, C.u1, C.gv0, C.gv1, 'ew'],
  ];
  for (const [u0, u1, v0, v1, dir] of walks) {
    const along = dir === 'ns';
    const R = along ? QR(u0, u1, v0, v1) : QRv(u0, u1, v0, v1);
    const ux = Math.cos(R.a), uz = Math.sin(R.a), vx = -uz, vz = ux, hl = R.L / 2, hw = R.W / 2;
    const P = (u, v, y) => [R.cx + ux * u + vx * v, y, R.cz + uz * u + vz * v];
    const e = 0.7;
    for (const sg of [-1, 1]) B.poly('stoneSlate', [P(-hl, sg * (hw + e), h - 0.2), P(hl, sg * (hw + e), h - 0.2), P(hl, 0, roofTop), P(-hl, 0, roofTop)], [vx * sg, 1, vz * sg]);
    if (q < 2) B.beam('stoneDk', P(-hl, 0, roofTop + 0.05), P(hl, 0, roofTop + 0.05), 0.2, 0.14);
    if (q === 0) {
      // the wagon ceiling: a five-facet barrel of oak boards under the roof, seen from the walk
      const N = 5, rw = hw - 0.15, y0 = h - 0.45, rise = 1.7;
      const pt = (k) => { const t = Math.PI * (k / N); return [-Math.cos(t) * rw, y0 + Math.sin(t) * rise]; };
      for (let k = 0; k < N; k++) { const [a0, b0] = pt(k), [a1, b1] = pt(k + 1); B.poly('oak', [P(-hl, a0, b0), P(hl, a0, b0), P(hl, a1, b1), P(-hl, a1, b1)], [-vx * (a0 + a1) * 0, -1, 0]); }
      // ribs every 1.6 m
      for (let u = -hl + 0.8; u < hl; u += 1.6) for (let k = 0; k < N; k++) { const [a0, b0] = pt(k), [a1, b1] = pt(k + 1); B.beam('bark', P(u, a0, b0 - 0.03), P(u, a1, b1 - 0.03), 0.1, 0.06); }
    }
    // the walk floor: worn flags (a hair above the mapped ground)
    if (q === 0) B.poly('flags', [P(-hl, -hw, 0.03), P(hl, -hw, 0.03), P(hl, hw, 0.03), P(-hl, hw, 0.03)], [0, 1, 0]);
  }
  // the holm oak: a huge dark evergreen, its crown filling the garth's middle
  const [ox, oz] = NC.oak;
  B.push(frame(0, 0, 0, 1, 0));
  trunk(B, ox, oz, 6.2, 0.75);
  if (q < 2) { for (const [a, l] of [[0.6, 4.8], [2.4, 4.2], [4.3, 4.6]]) B.beam('bark', [ox, 4.6, oz], [ox + Math.sin(a) * l, 7.2, oz + Math.cos(a) * l], 0.4, 0.4); }
  crown(B, ox, oz, 4.2, 8.2, 10.5, q === 2 ? 3 : 7, 41, q);
  B.pop();
  return B;
}

/** the city wall with its bastions (rubble, a crenellated parapet on the outer edge, a wall-walk), the herbaceous border
 *  inside, the Mound; and the Robinson Tower on Holywell Street */
export function buildWall(q, part) {
  const B = new RB(), H = NC.wallH;
  const lines = part === 'west' ? [NC.wall2, NC.wall.slice(0, 5)] : part === 'north' ? [NC.wall.slice(4, 9)] : [NC.wall.slice(8)];
  const bs = (part === 'west' ? NC.bastions.slice(0, 1) : part === 'north' ? NC.bastions.slice(1, 4) : NC.bastions.slice(4)).map(([bx, bz, k]) => {
    const nx0 = N_OUT[0] * (1 - k) + k, nz0 = N_OUT[1] * (1 - k), nl = Math.hypot(nx0, nz0); return [bx, bz, nx0 / nl, nz0 / nl];
  });
  cityWall(B, { lines, bastions: bs, H, key: 'wallOld', Rb: 3.4 }, q);
  // the herbaceous border along the north wall inside (lumps of planting in a few colours) — near only
  if (q === 0 && part === 'north') {
    const L0 = NC.wall.slice(3, 8);
    let k = 0;
    for (let i = 0; i < L0.length - 1; i++) {
      const p = L0[i], r = L0[i + 1], L = Math.hypot(r[0] - p[0], r[1] - p[1]), ax = (r[0] - p[0]) / L, az = (r[1] - p[1]) / L;
      for (let s = 1.2; s < L - 1.2; s += 1.6) {
        const d = 2.3 + ((k * 37) % 7) * 0.12, x = p[0] + ax * s - az * d, z = p[1] + az * s + ax * d, hh = 0.5 + ((k * 13) % 5) * 0.18;
        B.box(k % 3 === 0 ? 'hedge' : 'foliage', x, hh / 2, z, 1.4, hh, 1.6, Math.atan2(ax, az), { top: true });
        if (k % 2 === 0) B.box(['flowerPink', 'flowerBlue', 'flowerGold'][k % 3], x + 0.2, hh + 0.12, z, 0.8, 0.24, 0.8, 0, { top: true });
        k++;
      }
    }
  }
  return B;
}

/** the Mound (laid out 1594, steps 1649): a grassed cone with one flight of steps, a little planting round its foot */
export function buildMound(q) {
  const B = new RB(), M = NC.mound, [cx, cz] = M.c, seg = q === 2 ? 10 : q === 1 ? 16 : 28;
  B.lathe('turf', cx, cz, [[M.r, 0.0], [M.r - 2.2, 1.1], [M.r - 5.5, 3.4], [M.r - 9.2, 5.6], [3.6, M.top], [0, M.top + 0.15]], { seg, crease: 0.9 });
  // the steps: a straight flight up the west side to the top, stone treads
  const t = M.steps, ux = Math.sin(t), uz = Math.cos(t), wx = uz, wz = -ux, n = q === 0 ? 18 : 6;
  for (let k = 0; k < n; k++) {
    const f0 = k / n, f1 = (k + 1) / n, rr = M.r - (M.r - 3.4) * f0, y = M.top * (f1 * 0.98);
    const x = cx + ux * (rr - 0.3), z = cz + uz * (rr - 0.3), d = (M.r - 3.4) / n;
    B.box(q === 0 ? 'stoneGrey' : 'stoneDk', x - ux * d * 0.5, y / 2, z - uz * d * 0.5, 1.6, y, d + 0.02, Math.atan2(ux, uz), { top: true });
  }
  void wx; void wz;
  // a yew hedge ring and box planting round the foot (the 1810 guide's quarters, simplified)
  if (q < 2) for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU + 0.2; if (Math.abs(Math.atan2(Math.sin(a - t), Math.cos(a - t))) < 0.35) continue; const r = M.r + 1.6; B.box('hedge', cx + Math.sin(a) * r, 0.55, cz + Math.cos(a) * r, 2.8, 1.1, 1.0, a, { top: true }); }
  // the sign at the foot of the steps
  if (q === 0) { const sx = cx + ux * (M.r + 2.6) + uz * 1.6, sz = cz + uz * (M.r + 2.6) - ux * 1.6; B.box('oak', sx, 0.6, sz, 0.08, 1.2, 0.08, 0); B.push(frame(sx, 0, sz, uz, -ux)); B.card('sign_mound', [-0.55, 1.05, 0.05], [0.55, 1.05, 0.05], [0.55, 1.45, 0.05], [-0.55, 1.45, 0.05], [0.004, 0.004, 0.996, 0.996]); B.pop(); }
  return B;
}
/** the foot of the Mound's steps (where "Climb the Mound" is offered) and the top */
export function moundFoot() { const M = NC.mound, t = M.steps; return [M.c[0] + Math.sin(t) * (M.r + 1.2), M.c[1] + Math.cos(t) * (M.r + 1.2)]; }

/** the Robinson Tower (Champneys, 1896) over the Holywell Street gate */
export function buildRobinson(q) {
  const B = new RB(), T = NC.robinson, faces = [[], [], [], []];
  // face 2 (north, to Holywell): the gate arch, an oriel-like two-light window over it, a statue niche
  faces[2] = [{ key: 'archDoor', pts: pointPts(0, 3.0, 0, 4.4 - 1.7) }, { key: 'sign_newcoll', pts: rectPts(-1.3, 5.0, 1.3, 5.6) }, { key: 'mullion', pts: rectPts(-1.2, 7.4, 1.2, 10.2) }, { key: 'niche', pts: pointPts(0, 1.1, 12.0, 14.6 - 0.8) }, { key: 'perp', pts: pointPts(0, 1.6, 16.0, 19.2 - 1.1) }];
  faces[0] = [{ key: 'mullion', pts: rectPts(-1.2, 7.4, 1.2, 10.2) }, { key: 'perp', pts: pointPts(0, 1.6, 16.0, 19.2 - 1.1) }];
  faces[1] = [{ key: 'perp', pts: pointPts(0, 1.4, 16.0, 19.0 - 1.0) }]; faces[3] = [{ key: 'perp', pts: pointPts(0, 1.4, 16.0, 19.0 - 1.0) }];
  tower(B, { cx: T.c[0], cz: T.c[1], a: A, w: T.w, top: T.top, wall: 'stone', stages: [[0, T.top, 'stone']], strings: [6.4, 11.4, 15.4], crenel: true, merlons: 4, pinnacles: [2.4], corner: 0.8, faces }, q);
  return B;
}
