// The Iffley Road running track (owned by places/iffley_track.js) — see docs/research/landmarks_batch4.md.
//
// K: the track is the University's, west of Iffley Road behind the houses (Wikipedia: 51.7459 N, 1.2431 W = x 1165,
// z 1006 here; the mapped football pitch w122664720 is its infield); Roger Bannister ran the first sub-four-minute mile
// here on 6 May 1954 (3:59.4); a blue plaque (Oxfordshire Blue Plaques, unveiled 2004) and the track's renaming after him
// (2007). The mapped grandstand w42138227 beside the north straight.
// G: a standard 400 m track (84.39 m straights, 36.5 m inner radius) on the pitch's axis; six lanes; the stand's form
// (rebuilt on the mapped footprint: a brick back block, six rows of benches under a lean-to roof); the plaque's place
// on a brick pier at the Iffley Road fence by the mapped memorial node.
import { RB, frame, flatUp, signCard, TAU, bulb, bench, glowCard } from './_b4_kit.js';

export const TRACK = {
  c: [1163.4, 1007.1], u: [0.849, -0.528], a: 42.195, R0: 36.5, lanes: 6, lw: 1.22, y: 0.05,
};
TRACK.v = [-TRACK.u[1], TRACK.u[0]];             // across (0.528, 0.849): +w is the south side; the stand is on -w
TRACK.R1 = TRACK.R0 + TRACK.lanes * TRACK.lw;
TRACK.Rm = TRACK.R0 + 0.3;                       // the measuring line (lane 1, 30 cm out)
TRACK.P = 4 * TRACK.a + 2 * Math.PI * TRACK.Rm;  // ≈ 400 m
export const STAND = { id: 'w42138227', poly: [[1116.6, 977.5], [1115.7, 976], [1110.4, 967.1], [1108.5, 963.4], [1150.4, 938.5], [1152.3, 941.4], [1156.9, 949.5], [1158.7, 952.6]], back: [[1108.5, 963.4], [1150.4, 938.5]], front: [[1116.6, 977.5], [1158.7, 952.6]] };
export const PLAQUE = { x: 1300.4, z: 938.6, n: [0.868, -0.496] };
/** world point from track coordinates (s along the straights, w across) */
export function tw(s, w) { const { c, u, v } = TRACK; return [c[0] + u[0] * s + v[0] * w, c[1] + u[1] * s + v[1] * w]; }
/** track coordinates of a world point */
export function ts(x, z) { const { c, u, v } = TRACK, dx = x - c[0], dz = z - c[1]; return [dx * u[0] + dz * u[1], dx * v[0] + dz * v[1]]; }
/** distance from the stadium's centre "spine" (the segment s in [-a, a] at w = 0) */
export function spineDist(s, w) { const a = TRACK.a, ds = Math.max(0, Math.abs(s) - a); return Math.hypot(ds, w); }
/** is (x, z) on the running surface (with a little give) */
export function onTrack(x, z) { const [s, w] = ts(x, z), d = spineDist(s, w); return d > TRACK.R0 - 1.5 && d < TRACK.R1 + 2.5; }
/**
 * Distance run from the finish line along the measuring line (0 .. P), anticlockwise (the infield on the runner's left):
 * from the finish at the west end of the home (north) straight round the west bend, east down the south straight, round
 * the east bend and west up the home straight.
 */
export function trackPos(x, z) {
  const { a, Rm } = TRACK, [s, w] = ts(x, z);
  if (s < -a) { const p = Math.atan2(-(s + a), -w); return Math.max(0, Math.min(Math.PI, p)) * Rm; }
  if (s > a) { const p = Math.atan2(s - a, w); return Math.PI * Rm + 2 * a + Math.max(0, Math.min(Math.PI, p)) * Rm; }
  if (w > 0) return Math.PI * Rm + (s + a);
  return 2 * Math.PI * Rm + 2 * a + (a - s);
}
/** a point on the loop d metres from the finish (anticlockwise), at radius offset dr from the measuring line -> {x, z, h} */
export function loopAt(d, dr = 0) {
  const { a, Rm, P } = TRACK, R = Rm + dr; d = ((d % P) + P) % P;
  const pt = (dd) => {
    let s, w;
    if (dd < Math.PI * Rm) { const f = dd / Rm; s = -a - R * Math.sin(f); w = -R * Math.cos(f); }
    else if (dd < Math.PI * Rm + 2 * a) { s = dd - Math.PI * Rm - a; w = R; }
    else if (dd < 2 * Math.PI * Rm + 2 * a) { const f = (dd - Math.PI * Rm - 2 * a) / Rm; s = a + R * Math.sin(f); w = R * Math.cos(f); }
    else { s = a - (dd - 2 * Math.PI * Rm - 2 * a); w = -R; }
    return tw(s, w);
  };
  const p = pt(d), q = pt((d + 0.5) % P);
  return { x: p[0], z: p[1], h: Math.atan2(q[0] - p[0], q[1] - p[1]) };
}
/** floodlight masts round the track (G: the real track has a few lighting columns; number and place guessed) */
export const MASTS = [[-TRACK.a, -1], [TRACK.a, -1], [-TRACK.a, 1], [TRACK.a, 1]].map(([s, k]) => tw(s, k * (TRACK.R1 + 4.5)));
/** the start / finish board and where you stand to start (outside lane 6 at the finish line, on the stand side) */
export const START = (() => { const p = tw(-TRACK.a, -(TRACK.R1 + 1.6)); return { x: p[0], z: p[1], board: tw(-TRACK.a - 2.2, -(TRACK.R1 + 2.4)), line: tw(-TRACK.a, -(TRACK.R0 + 2.2)) }; })();
export const RECORD = { secs: 239.4, label: '3:59.4' };
export const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };

// ------------------------------------------------------------------------------------------------ geometry
/** the running surface and its kerbs (aLayer 8 group): q 0 near, 1 mid, 2 far */
export function buildSurface(q) {
  const B = new RB(), { a, R0, R1, y } = TRACK;
  B.push(frame(TRACK.c[0], 0, TRACK.c[1], TRACK.u[0], TRACK.u[1]));     // local x = s, local z = w
  const W = R1 - R0, nb = q === 0 ? 28 : q === 1 ? 14 : 8;
  // straights (u along in metres, v across in metres from the inner edge)
  for (const side of [-1, 1]) {
    const w0 = side * R0, w1 = side * R1;
    B.poly('track', [[-a, y, w0], [a, y, w0], [a, y, w1], [-a, y, w1]], [0, 1, 0], [[0, 0], [2 * a, 0], [2 * a, W], [0, W]]);
  }
  // bends
  for (const end of [-1, 1]) {
    for (let i = 0; i < nb; i++) {
      const t0 = (i / nb) * Math.PI, t1 = ((i + 1) / nb) * Math.PI;
      const P = (t, r) => [end * (a + Math.sin(t) * r), y, -end * Math.cos(t) * r * 1];
      const u0 = t0 * (R0 + W / 2), u1 = t1 * (R0 + W / 2);
      B.poly('track', [P(t0, R0), P(t1, R0), P(t1, R1), P(t0, R1)], [0, 1, 0], [[u0, 0], [u1, 0], [u1, W], [u0, W]]);
    }
  }
  // the inner kerb (white rail) and the outer edge (a strip of grass-green surround)
  if (q < 2) {
    const kn = q === 0 ? 28 : 14;
    const ring = (r, h, key, wd) => {
      for (const side of [-1, 1]) B.box(key, 0, y + h / 2, side * r, 2 * a, h, wd, 0, { top: true });
      for (const end of [-1, 1]) for (let i = 0; i < kn; i++) { const t0 = (i / kn) * Math.PI, t1 = ((i + 1) / kn) * Math.PI, p0 = [end * (a + Math.sin(t0) * r), -end * Math.cos(t0) * r], p1 = [end * (a + Math.sin(t1) * r), -end * Math.cos(t1) * r]; B.beam(key, [p0[0], y + h / 2, p0[1]], [p1[0], y + h / 2, p1[1]], wd, h); }
    };
    ring(R0 - 0.03, 0.06, 'white', 0.06);
  }
  // the finish line across the home straight, the lane numbers' blocks (white) and a 200 m mark on the back straight
  B.poly('chalk', [[-a - 0.025, y + 0.004, -R0], [-a + 0.025, y + 0.004, -R0], [-a + 0.025, y + 0.004, -R1], [-a - 0.025, y + 0.004, -R1]], [0, 1, 0]);
  if (q === 0) for (let k = 0; k < TRACK.lanes; k++) { const w = -(R0 + (k + 0.5) * TRACK.lw); B.poly('chalk', [[-a + 0.35, y + 0.004, w - 0.22], [-a + 0.75, y + 0.004, w - 0.22], [-a + 0.75, y + 0.004, w + 0.22], [-a + 0.35, y + 0.004, w + 0.22]], [0, 1, 0]); }
  B.poly('chalk', [[a - 0.025, y + 0.004, R0], [a + 0.025, y + 0.004, R0], [a + 0.025, y + 0.004, R1], [a - 0.025, y + 0.004, R1]], [0, 1, 0]);
  B.pop();
  return B;
}

/** the stand on the mapped footprint, the start board, the plaque pier (aLayer 0 group) */
export function buildStand(q) {
  const B = new RB(), [b0, b1] = STAND.back, [f0, f1] = STAND.front;
  const L = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]), ux = (b1[0] - b0[0]) / L, uz = (b1[1] - b0[1]) / L;
  // frame: origin at the back line's middle, local x along it, local +z towards the track (front)
  const mx = (b0[0] + b1[0]) / 2, mz = (b0[1] + b1[1]) / 2, F = frame(mx, 0, mz, ux, uz);
  // the frame's +z is (-uz, ux): check it points at the front line, else flip
  const fz = (-uz) * ((f0[0] + f1[0]) / 2 - mx) + ux * ((f0[1] + f1[1]) / 2 - mz);
  const D = Math.abs(fz), H = L / 2;
  B.push(fz > 0 ? F : frame(mx, 0, mz, -ux, -uz));
  // rear block: changing rooms / store under the stand's back (brick, doors and windows to the back), 3.4 m
  B.box('brick', 0, 1.7, 2.6, L, 3.4, 5.2, 0, { top: false });
  if (q < 2) for (let k = 0; k < 9; k++) { const x = -H + 3 + k * (L - 6) / 8; B.push(frame(x, 0, -0.02, -1, 0)); B.unit(k % 3 ? 'sash' : 'door', k % 3 ? [[-0.6, 1.2], [0.6, 1.2], [0.6, 2.5], [-0.6, 2.5]] : [[-0.6, 0], [0.6, 0], [0.6, 2.3], [-0.6, 2.3]], 0, [4000 + k, 0]); B.pop(); }
  // the terraces: six rows stepping down towards the track, green benches
  const rows = 6, z0 = 5.2, rowD = (D - z0 - 1.6) / rows;
  for (let r = 0; r < rows; r++) {
    const yT = 3.4 - (r + 1) * 0.48, zA = z0 + r * rowD, zB = zA + rowD;
    B.box('concrete', 0, yT / 2, (zA + zB) / 2, L - 0.6, yT, rowD, 0, { top: true });
    if (q < 2) B.box('green', 0, yT + 0.42, zA + rowD * 0.45, L - 1.2, 0.06, 0.38, 0, { bottom: true });
    if (q === 0) for (let k = 0; k <= 12; k++) B.box('iron', -H + 1 + k * (L - 2) / 12, yT + 0.21, zA + rowD * 0.45, 0.06, 0.42, 0.3, 0, { top: false });
  }
  // the front wall with the track's name, the side screens
  B.box('brick', 0, 0.55, D - 1.4, L - 0.6, 1.1, 0.3, 0, { top: true });
  if (q < 2) B.card('sign_track', [-6, 0.25, D - 1.24], [6, 0.25, D - 1.24], [6, 1.0, D - 1.24], [-6, 1.0, D - 1.24], [0.004, 0.004, 0.996, 0.996]);
  for (const sx of [-1, 1]) B.box('brick', sx * (H - 0.15), 2.6, D / 2, 0.3, 5.2, D, 0, { top: true });
  // the roof: a lean-to on steel columns, high at the back
  const rb = 8.2, rf = 6.6;
  B.poly('slate', [[-H - 0.2, rb, 0], [H + 0.2, rb, 0], [H + 0.2, rf, D - 0.4], [-H - 0.2, rf, D - 0.4]], [0, 1, 0.2]);
  B.poly('concrete', [[-H - 0.2, rb - 0.15, 0], [-H - 0.2, rf - 0.15, D - 0.4], [H + 0.2, rf - 0.15, D - 0.4], [H + 0.2, rb - 0.15, 0]], [0, -1, 0]);
  B.box('white', 0, rf - 0.2, D - 0.4, L + 0.4, 0.45, 0.12, 0);
  B.box('brick', 0, (3.4 + rb) / 2, 0.15, L, rb - 3.4, 0.3, 0, { top: false });
  for (let k = 0; k <= 6; k++) B.box('iron', -H + 0.4 + k * (L - 0.8) / 6, rf / 2, D - 1.0, 0.2, rf, 0.2, 0, { top: false });
  B.pop();
  // visual pass: floodlight masts (heads lit after dark), a low rail round the outside, benches and the finish clock
  for (const [x, z] of MASTS) {
    B.cyl('lamp', x, 0, z, 0.16, 14, q ? 5 : 8, false, 0.24);
    B.box('lamp', x, 14.2, z, 2.2, 0.5, 0.25, Math.atan2(TRACK.c[0] - x, TRACK.c[1] - z) + Math.PI / 2);
    if (q < 2) { const dx = TRACK.c[0] - x, dz = TRACK.c[1] - z, L = Math.hypot(dx, dz), nx = dx / L, nz = dz / L, tx = -nz, tz = nx;
      for (const o of [-0.6, 0, 0.6]) glowCard(B, [x + tx * (o - 0.28) + nx * 0.14, 14.0, z + tz * (o - 0.28) + nz * 0.14], [x + tx * (o + 0.28) + nx * 0.14, 14.0, z + tz * (o + 0.28) + nz * 0.14], [x + tx * (o + 0.28) + nx * 0.14, 14.4, z + tz * (o + 0.28) + nz * 0.14], [x + tx * (o - 0.28) + nx * 0.14, 14.4, z + tz * (o - 0.28) + nz * 0.14], 20 + o * 3 + x); }
  }
  if (q < 2) {
    // the rail: posts and a top bar on a ring 2.2 m outside lane 6 (straights + bends), broken at the stand
    const R = TRACK.R1 + 2.2, nb = q === 0 ? 24 : 12, a = TRACK.a;
    const ringPts = [];
    for (let i = 0; i <= nb; i++) { const t = (i / nb) * Math.PI; ringPts.push([-a - Math.sin(t) * R, -Math.cos(t) * R]); }
    for (let i = 0; i <= nb; i++) { const t = (i / nb) * Math.PI; ringPts.push([a + Math.sin(t) * R, Math.cos(t) * R]); }
    for (let i = 0; i < ringPts.length; i++) {
      const [s0, w0] = ringPts[i], [s1, w1] = ringPts[(i + 1) % ringPts.length];
      if (w0 < -R + 0.5 && w1 < -R + 0.5 && Math.abs(s0 + s1) / 2 < 22) continue;     // the stand side's middle
      const p0 = tw(s0, w0), p1 = tw(s1, w1), L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(1, Math.round(L / 3));
      B.beam('white', [p0[0], 0.95, p0[1]], [p1[0], 0.95, p1[1]], 0.06);
      for (let k = 0; k < n; k++) { const t = k / n; B.box('white', p0[0] + (p1[0] - p0[0]) * t, 0.47, p0[1] + (p1[1] - p0[1]) * t, 0.06, 0.94, 0.06, 0, { top: false }); }
    }
    for (const s of [-20, 0, 20]) { const p = tw(s, TRACK.R1 + 4.0); bench(B, p[0], p[1], Math.atan2(-TRACK.v[0], -TRACK.v[1]), 'green'); }
    // the finish clock on a post by the line (a dark face, its digits are the HUD's)
    const fc = tw(-TRACK.a + 1.0, -(TRACK.R1 + 3.4));
    B.box('iron', fc[0], 1.4, fc[1], 0.1, 2.8, 0.1, 0); B.box('dark', fc[0], 3.0, fc[1], 1.4, 0.6, 0.16, Math.atan2(TRACK.u[0], TRACK.u[1]) + Math.PI / 2);
    for (let k = 0; k < 4; k++) { const p = [fc[0] + TRACK.u[0] * (-0.45 + k * 0.3), fc[1] + TRACK.u[1] * (-0.45 + k * 0.3)]; bulb(B, p[0] + TRACK.v[0] * 0.1, 3.0, p[1] + TRACK.v[1] * 0.1, 0.06, 30 + k); }
  }
  // the start board by the finish line
  {
    const [bx, bz] = START.board, [ux2, uz2] = TRACK.u;
    B.box('iron', bx - ux2 * 1.1, 1.1, bz - uz2 * 1.1, 0.08, 2.2, 0.08, 0); B.box('iron', bx + ux2 * 1.1, 1.1, bz + uz2 * 1.1, 0.08, 2.2, 0.08, 0);
    const nx = TRACK.v[0], nz = TRACK.v[1];      // the board faces the track (+w)
    signCard(B, 'sign_mile', bx - ux2 * 1.15, bz - uz2 * 1.15, bx + ux2 * 1.15, bz + uz2 * 1.15, 1.6, 2.2, nx, nz, 0.03);
    signCard(B, 'dark', bx - ux2 * 1.15, bz - uz2 * 1.15, bx + ux2 * 1.15, bz + uz2 * 1.15, 1.0, 1.6, nx, nz, 0.03);
  }
  return B;
}
/** the blue plaque on its brick pier at the Iffley Road fence */
export function buildPlaque() {
  const B = new RB();
  {
    const P = PLAQUE, tx = -P.n[1], tz = P.n[0];
    B.box('brick', P.x, 1.3, P.z, 0.9, 2.6, 0.9, Math.atan2(P.n[0], P.n[1]));
    B.box('dress', P.x, 2.66, P.z, 1.05, 0.12, 1.05, Math.atan2(P.n[0], P.n[1]));
    const cx = P.x + P.n[0] * 0.46, cz = P.z + P.n[1] * 0.46;
    signCard(B, 'plaque', cx - tx * 0.3, cz - tz * 0.3, cx + tx * 0.3, cz + tz * 0.3, 1.45, 2.05, P.n[0], P.n[1], 0.0);
  }
  return B;
}
void TAU; void flatUp;
