// Static dressing for the Worcester College grounds: cricket pavilion (from the 2016-17 darts team photo), cricket
// square + boundary + sight screens, tennis courts, rugby posts, benches, bridge railings, extra trees (willows, island,
// orchard), herbaceous borders, reeds, Provost's Garden sundial/rose beds/beehives.
// Everything of one material is merged into one mesh (the Acc accumulators are created by worcester_grounds.js).
import * as THREE from 'three';
const NI = (g) => (g.index ? g.toNonIndexed() : g);
import { treeModel } from '../world/vegetation.js';
import { pip, dSeg, dRing, alongRing, frame } from './_grounds_util.js';

export const C = {
  white: 0xf2f0ea, offwhite: 0xe4e2da, wallGrey: 0xc9ccc8, darkWood: 0x3a2a1e, teak: 0x8a6a48, teakDark: 0x6a5038,
  brick: 0x8a4a38, glass: 0x26303a, black: 0x141414, iron: 0x2a2c2e, green: 0x2f4a32, net: 0x1e1e1e, steel: 0x9a9ea2,
};

// ------------------------------------------------------------------------------------------------ benches
/** Wooden garden bench centred at (x,z); `h` = heading the sitter faces. */
export function bench(acc, x, z, h, len = 1.8, color = C.teak) {
  const f = frame(x, z, Math.cos(h), -Math.sin(h));   // u = sitter's right... any perpendicular to the facing dir
  const fx = Math.sin(h), fz = Math.cos(h);
  const at = (s, t) => [x + f.ux * s + fx * t, z + f.uz * s + fz * t];
  // seat slats
  for (let i = 0; i < 4; i++) { const [px, pz] = at(0, 0.2 - i * 0.11); acc.box(px, 0.42, pz, len, 0.035, 0.08, h, color); }
  // back slats (leaning back)
  for (let i = 0; i < 3; i++) { const [px, pz] = at(0, -0.24 - i * 0.025); acc.box(px, 0.55 + i * 0.13, pz, len, 0.09, 0.03, h, color, -0.2); }
  // legs + arms
  for (const s of [-len / 2 + 0.05, len / 2 - 0.05]) {
    let [px, pz] = at(s, 0.2); acc.box(px, 0, pz, 0.06, 0.62, 0.06, h, color);
    [px, pz] = at(s, -0.24); acc.box(px, 0, pz, 0.06, 0.92, 0.06, h, color);
    [px, pz] = at(s, -0.02); acc.box(px, 0.62, pz, 0.06, 0.05, 0.5, h, color);
  }
}

// ------------------------------------------------------------------------------------------------ the pavilion
/**
 * Single-storey white timber pavilion: brick plinth with vents, grey-white weatherboarded walls, full-width veranda with
 * white posts, arched brackets and a white balustrade, central steps, small-paned windows and glazed double doors, a
 * black scoreboard (TOTAL / OVERS / LAST INNS), tiled hipped roof with dark eaves. Front faces the field (north).
 */
export function buildPavilion(world, accs, foot, mats) {
  const { props } = accs;
  // footprint rectangle from OSM: A(-506,-25.7) B(-503.8,-35.9) C(-489.4,-32.9) D(-491.6,-22.7)
  const [A, B, Cc, D] = foot;
  const cx = (A[0] + B[0] + Cc[0] + D[0]) / 4, cz = (A[1] + B[1] + Cc[1] + D[1]) / 4;
  const len = Math.hypot(Cc[0] - B[0], Cc[1] - B[1]), dep = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const F = frame(cx, cz, Cc[0] - B[0], Cc[1] - B[1]);     // u along the front, n points to the front (north)
  // make sure n points towards the front edge B-C
  const midFront = [(B[0] + Cc[0]) / 2, (B[1] + Cc[1]) / 2];
  const sgn = ((midFront[0] - cx) * F.nx + (midFront[1] - cz) * F.nz) > 0 ? 1 : -1;
  const P = (s, t) => F.p(s, t * sgn);
  const H = Math.atan2(-F.uz, F.ux), HN = sgn > 0 ? F.headingN : F.headingN + Math.PI;   // heading of the front
  const L2 = len / 2, D2 = dep / 2, PL = 0.6, VER = 2.5, WALL = 3.15;
  const front = D2 - VER;                                   // body front wall at t = front
  const box = (s, t, y, w, h, d, c, rx = 0) => { const [x, z] = P(s, t); props.box(x, y, z, w, h, d, H, c, rx); };
  // plinth (brick) with vents on the front
  box(0, 0, 0, len, PL, dep, C.brick);
  for (let s = -L2 + 1; s < L2 - 0.5; s += 1.8) box(s, D2 + 0.005, 0.22, 0.22, 0.14, 0.02, 0x2a1a14);
  // veranda deck
  box(0, front + VER / 2, PL - 0.02, len, 0.06, VER, 0x8a8478);
  // body walls: weatherboard material
  const r = [P(-L2 + 0.25, -D2 + 0.25), P(L2 - 0.25, -D2 + 0.25), P(L2 - 0.25, front), P(-L2 + 0.25, front)];
  const walls = new THREE.Mesh(world.extrude(r, PL, WALL, { uScale: 1, vScale: 1 }), mats.weather);
  walls.castShadow = walls.receiveShadow = true;
  // windows: dark glass + white frame + glazing bars, on a wall line at t (front: facing +t)
  const windowAt = (s, t, y0, w, h, cols, rows, facing, door = false) => {
    // facing: +1 front (+t), -1 back; for side walls use sideWindow
    const tt = t + facing * 0.03;
    box(s, tt, y0, w, h, 0.03, C.glass);
    const fr = 0.06, bar = 0.025;
    box(s, tt + facing * 0.02, y0 - fr, w + fr * 2, fr, 0.04, C.white);
    box(s, tt + facing * 0.02, y0 + h, w + fr * 2, fr, 0.04, C.white);
    box(s - w / 2 - fr / 2, tt + facing * 0.02, y0, fr, h, 0.04, C.white);
    box(s + w / 2 + fr / 2, tt + facing * 0.02, y0, fr, h, 0.04, C.white);
    for (let i = 1; i < cols; i++) box(s - w / 2 + (w * i) / cols, tt + facing * 0.025, y0, door && i === cols / 2 ? 0.07 : bar, h, 0.03, C.white);
    for (let j = 1; j < rows; j++) box(s, tt + facing * 0.025, y0 + (h * j) / rows - bar / 2, w, bar, 0.03, C.white);
    if (door) box(s, tt + facing * 0.025, y0, w, 0.45, 0.035, C.white);   // bottom panels
  };
  windowAt(0, front, PL + 0.02, 1.7, 2.0, 4, 4, 1, true);         // glazed double doors
  windowAt(-2.9, front, 1.3, 1.5, 1.35, 3, 3, 1);
  windowAt(2.9, front, 1.3, 1.5, 1.35, 3, 3, 1);
  windowAt(5.6, front, PL + 0.02, 0.95, 2.0, 2, 4, 1, true);      // changing-room door
  windowAt(-3, -D2 + 0.25, 1.4, 1.2, 1.1, 3, 2, -1);
  windowAt(3, -D2 + 0.25, 1.4, 1.2, 1.1, 3, 2, -1);
  // scoreboard on the front wall, right of the windows (as in the photo)
  const [sbx, sbz] = P(-5.3, front + 0.05);
  props.box(sbx, 1.15, sbz, 1.6, 1.45, 0.06, H, C.black);
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.35), mats.scoreboard);
  const [sbx2, sbz2] = P(-5.3, front + 0.085);
  sb.position.set(sbx2, 1.15 + 0.725, sbz2); sb.rotation.y = HN;
  // veranda: posts, beam, arched brackets, balustrade, steps
  const bays = 6, postT = D2 - 0.12, span = (len - 0.4) / bays;
  const posts = [];
  for (let i = 0; i <= bays; i++) posts.push(-L2 + 0.2 + i * span);
  for (const s of posts) box(s, postT, PL, 0.13, WALL - PL, 0.13, C.white);
  box(0, postT, WALL - 0.22, len - 0.2, 0.2, 0.14, C.white);                   // beam
  for (let i = 0; i < bays; i++) {                                             // arched spandrels
    const s0 = posts[i] + 0.07, s1 = posts[i + 1] - 0.07, n = 8, yb = WALL - 0.75, rise = 0.5;
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const u = k / n, s = s0 + (s1 - s0) * u, y = yb + rise * Math.pow(Math.sin(Math.PI * u), 0.55);
      const [x, z] = P(s, postT);
      if (prev) props.beam(prev[0], prev[1], prev[2], x, y, z, 0.07, C.white, 0.09);
      prev = [x, y, z];
    }
  }
  const midBay = Math.floor(bays / 2) - 1;   // steps in the middle bay (bays 2..3 -> opening between posts[2] and posts[4]? keep one bay)
  const stepBay = [posts[3] - span / 2, posts[3] + span / 2];
  const railRun = (s0, s1, t) => {
    const yb = PL + 0.12, yt = PL + 0.92, l = s1 - s0, sm = (s0 + s1) / 2;
    box(sm, t, yt, l, 0.07, 0.1, C.white); box(sm, t, yb - 0.05, l, 0.06, 0.08, C.white);
    for (let s = s0 + 0.1; s < s1 - 0.05; s += 0.14) box(s, t, yb, 0.04, yt - yb, 0.04, C.white);
  };
  for (let i = 0; i < bays; i++) {
    let s0 = posts[i] + 0.065, s1 = posts[i + 1] - 0.065;
    if (Math.abs((s0 + s1) / 2 - (stepBay[0] + stepBay[1]) / 2) < span * 0.4) continue;   // opening for the steps
    railRun(s0, s1, postT);
  }
  // end balustrades (short sides of the veranda), as runs along t
  for (const s of [posts[0], posts[bays]]) {
    const t0 = front + 0.05, t1 = postT - 0.07, n = Math.floor((t1 - t0) / 0.14);
    const [ax, az] = P(s, t0), [bx, bz] = P(s, t1);
    props.beam(ax, PL + 0.95, az, bx, PL + 0.95, bz, 0.07, C.white); props.beam(ax, PL + 0.1, az, bx, PL + 0.1, bz, 0.06, C.white);
    for (let k = 1; k < n; k++) { const t = t0 + (k * (t1 - t0)) / n; const [x, z] = P(s, t); props.box(x, PL + 0.12, z, 0.04, 0.8, 0.04, H, C.white); }
  }
  // steps (three treads down to the grass)
  const sc = (stepBay[0] + stepBay[1]) / 2, sw = span - 0.3;
  for (let k = 0; k < 3; k++) box(sc, D2 + 0.15 + k * 0.3, 0, sw, PL - k * 0.2, 0.3, 0x9a948a);
  // eaves fascia + hipped tiled roof
  const ov = 0.45, rl = L2 + ov, rd = D2 + ov, eave = WALL, pitch = 0.5, rh = rd * Math.tan(pitch);
  const c4 = [P(-rl, -rd), P(rl, -rd), P(rl, rd), P(-rl, rd)];
  for (let i = 0; i < 4; i++) { const a = c4[i], b = c4[(i + 1) % 4]; props.beam(a[0], eave - 0.12, a[1], b[0], eave - 0.12, b[1], 0.24, C.darkWood, 0.1); }
  const ridge = [P(-(rl - rd), 0), P(rl - rd, 0)];
  const pos = [], uv = [];
  const tri = (p, q, s2) => { for (const v of [p, q, s2]) { pos.push(v[0], v[1], v[2]); uv.push(v[3], v[4]); } };
  const v3 = (pt, y, u, v) => [pt[0], y, pt[1], u, v];
  const slope = Math.hypot(rd, rh);
  // front + back slopes (trapezoids), ends (triangles); uv in metres along eave and up the slope
  const fA = v3(c4[3], eave, 0, 0), fB = v3(c4[2], eave, 2 * rl, 0), fR1 = v3(ridge[1], eave + rh, rl + (rl - rd), slope), fR0 = v3(ridge[0], eave + rh, rl - (rl - rd), slope);
  tri(fA, fB, fR1); tri(fA, fR1, fR0);
  const bA = v3(c4[1], eave, 0, 0), bB = v3(c4[0], eave, 2 * rl, 0), bR0 = v3(ridge[0], eave + rh, rl + (rl - rd), slope), bR1 = v3(ridge[1], eave + rh, rl - (rl - rd), slope);
  tri(bA, bB, bR0); tri(bA, bR0, bR1);
  tri(v3(c4[2], eave, 0, 0), v3(c4[1], eave, 2 * rd, 0), v3(ridge[1], eave + rh, rd, slope));
  tri(v3(c4[0], eave, 0, 0), v3(c4[3], eave, 2 * rd, 0), v3(ridge[0], eave + rh, rd, slope));
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  rg.computeVertexNormals();
  // ensure normals point up (flip winding if needed)
  if (rg.attributes.normal.getY(0) < 0) { const p2 = rg.attributes.position.array; for (let i = 0; i < p2.length; i += 9) for (let k = 0; k < 3; k++) { const t = p2[i + 3 + k]; p2[i + 3 + k] = p2[i + 6 + k]; p2[i + 6 + k] = t; } const u2 = rg.attributes.uv.array; for (let i = 0; i < u2.length; i += 6) for (let k = 0; k < 2; k++) { const t = u2[i + 2 + k]; u2[i + 2 + k] = u2[i + 4 + k]; u2[i + 4 + k] = t; } rg.computeVertexNormals(); }
  const roof = new THREE.Mesh(rg, mats.roof); roof.castShadow = roof.receiveShadow = true;
  // soffit (underside of the veranda roof) so the roof isn't see-through from below
  props.flat([c4[3], c4[2], P(rl, front), P(-rl, front)], eave - 0.01, 0xdcd8cc);
  // bench on the grass in front (the team photo)
  const [bx, bz] = P(0.4, D2 + 3.3); bench(props, bx, bz, HN, 2.1);
  return { meshes: [walls, sb, roof], front: P(0, D2 + 1.5), heading: HN, frontPoint: P, corners: [P(-L2, -D2), P(L2, -D2), P(L2, D2 + 1.2), P(-L2, D2 + 1.2)] };
}

/** Canvas texture for the weatherboarding: 1 m x 1 m, ~6 boards. */
export function weatherboardTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 6; i++) {
    const y = (i * 128) / 6, h = 128 / 6;
    const grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, '#e8ebe8'); grd.addColorStop(0.85, '#d2d6d3'); grd.addColorStop(1, '#a9adab');
    g.fillStyle = grd; g.fillRect(0, y, 128, h);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function scoreboardTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 232;
  const g = c.getContext('2d');
  g.fillStyle = '#121212'; g.fillRect(0, 0, 256, 232);
  g.fillStyle = '#f4f4f0'; g.font = 'bold 30px Arial'; g.textBaseline = 'middle';
  const rows = [['TOTAL', '1', '4', '7'], ['OVERS', '', '3', '2'], ['LAST', '', '9', '6']];
  rows.forEach((r, i) => {
    const y = 40 + i * 70;
    g.fillText(r[0], 12, y); if (i === 2) g.fillText('INNS', 12, y + 32);
    for (let k = 1; k < 4; k++) { g.fillStyle = '#f4f4f0'; g.fillRect(140 + (k - 1) * 38, y - 26, 34, 52); g.fillStyle = '#111'; g.font = 'bold 38px Arial'; if (r[k]) g.fillText(r[k], 146 + (k - 1) * 38, y + 2); g.fillStyle = '#f4f4f0'; g.font = 'bold 30px Arial'; }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------------------------------------ cricket
export function buildCricket(accs, field, centre, axisH, avoid, collider) {
  const { props, ground, lines } = accs;
  const [cx, cz] = centre, ux = Math.sin(axisH), uz = Math.cos(axisH), nx = uz, nz = -ux;
  const p = (s, t) => [cx + ux * s + nx * t, cz + uz * s + nz * t];
  // the square: 9 strips of 3.05 m x 24 m (lighter, closely mown), the middle one is the match strip (worn)
  for (let i = -4; i <= 4; i++) {
    const t0 = i * 3.05 - 1.525, t1 = t0 + 3.05;
    const col = i === 0 ? 0xf0e0b0 : i % 2 ? 0xe4f0c8 : 0xffffff;
    ground.quad(p(-12, t0), p(12, t0), p(12, t1), p(-12, t1), 0, col);
  }
  // creases on the match strip (popping crease 1.22 m in front of the stumps, return creases)
  for (const e of [-1, 1]) {
    const sS = e * 10.06, sP = e * (10.06 - 1.22);
    lines.strip([p(sS, -1.32), p(sS, 1.32)], 0.05, 0, 0xffffff);
    lines.strip([p(sP, -1.83), p(sP, 1.83)], 0.05, 0, 0xffffff);
    for (const t of [-1.32, 1.32]) lines.strip([p(sP, t), p(e * 11.5, t)], 0.05, 0, 0xffffff);
    // stumps + bails
    for (const t of [-0.114, 0, 0.114]) { const [x, z] = p(sS, t); props.cyl(x, 0, z, 0.018, 0.71, 0xe8dcc0, 6); }
    const [bx0, bz0] = p(sS, -0.114), [bx1, bz1] = p(sS, 0.114); props.beam(bx0, 0.72, bz0, bx1, 0.72, bz1, 0.022, 0xe8dcc0);
  }
  // boundary rope: circle of ~55 m clipped to the field (3.5 m inside its edge) and around avoided areas
  const ring = [];
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    let r = 56;
    for (let rr = 10; rr <= 56; rr += 0.5) {
      const x = cx + dx * rr, z = cz + dz * rr;
      if (!pip(x, z, field) || dRing(x, z, field) < 3.5 || avoid(x, z)) { r = rr - 0.5; break; }
    }
    ring.push([cx + dx * r, cz + dz * r]);
  }
  lines.strip(ring, 0.06, 0, 0xffffff, true);
  for (const q of alongRing(ring, 6)) props.cyl(q[0], 0, q[1], 0.03, 0.06, 0xf4f4f4, 6);   // rope (as a low white cord)
  ground.strip(ring, 0.08, 0.002, 0xffffff, true);
  // sight screens at both ends, just inside the boundary along the pitch axis
  const screens = [];
  for (const e of [-1, 1]) {
    let best = null;
    for (const q of ring) { const s = (q[0] - cx) * ux + (q[1] - cz) * uz, t = (q[0] - cx) * nx + (q[1] - cz) * nz; if (s * e > 0 && Math.abs(t) < 6 && (!best || Math.abs(t) < best[1])) best = [s, Math.abs(t)]; }
    const s = best ? best[0] - e * 2.5 : e * 45;
    const [x, z] = p(s, 0), h = axisH + (e > 0 ? Math.PI : 0);
    // white board on a timber frame with wheels: 9 m x 3.6 m
    props.box(x, 0.45, z, 9, 3.6, 0.12, h, 0xf6f6f2);
    for (const t of [-4, -1.3, 1.3, 4]) {
      const fx = x + nx * t * (e > 0 ? -1 : 1) * 0 + Math.cos(h) * t, fz = z - Math.sin(h) * t;
      const bx = fx - Math.sin(h) * 0.9, bz = fz - Math.cos(h) * 0.9;
      props.beam(fx - Math.sin(h) * 0.1, 3.6, fz - Math.cos(h) * 0.1, bx, 0.3, bz, 0.1, 0x5a4a3a);
      props.cyl(bx, 0, bz, 0.22, 0.12, 0x222222, 8);
    }
    collider && collider.addBox(x, z, 9, 0.6, h);
    screens.push([x, z]);
  }
  return { ring, screens };
}

// ------------------------------------------------------------------------------------------------ tennis
export function buildTennis(accs, polys, collider) {
  const { props, plain, lines } = accs;
  for (const poly of polys) {
    // rectangle axes from the polygon (4 points): long side = baseline-to-baseline
    const e0 = [poly[1][0] - poly[0][0], poly[1][1] - poly[0][1]], e1 = [poly[2][0] - poly[1][0], poly[2][1] - poly[1][1]];
    const l0 = Math.hypot(...e0), l1 = Math.hypot(...e1);
    const [L, W, uL, uW] = l1 > l0 ? [l1, l0, [e1[0] / l1, e1[1] / l1], [e0[0] / l0, e0[1] / l0]] : [l0, l1, [e0[0] / l0, e0[1] / l0], [e1[0] / l1, e1[1] / l1]];
    const cx = poly.reduce((a, q) => a + q[0], 0) / 4, cz = poly.reduce((a, q) => a + q[1], 0) / 4;
    const p = (s, t) => [cx + uL[0] * s + uW[0] * t, cz + uL[1] * s + uW[1] * t];
    // surface: court + run-off, green macadam; the playing area a little darker
    plain.quad(p(-L / 2 - 3, -W / 2 - 1.8), p(L / 2 + 3, -W / 2 - 1.8), p(L / 2 + 3, W / 2 + 1.8), p(-L / 2 - 3, W / 2 + 1.8), 0, 0x3f6a4a);
    plain.quad(p(-L / 2, -W / 2), p(L / 2, -W / 2), p(L / 2, W / 2), p(-L / 2, W / 2), 0.002, 0x355e40);
    // lines (doubles court 23.77 x 10.97, singles 8.23, service line 6.40 from the net)
    const hl = L / 2, hw = W / 2, hs = (8.23 / 10.97) * hw, sv = (6.40 / 23.77) * L, lw = 0.05;
    for (const t of [-hw, hw, -hs, hs]) lines.strip([p(-hl, t), p(hl, t)], lw, 0, 0xffffff);
    for (const s of [-hl, hl]) lines.strip([p(s, -hw), p(s, hw)], lw, 0, 0xffffff);
    for (const s of [-sv, sv]) lines.strip([p(s, -hs), p(s, hs)], lw, 0, 0xffffff);
    lines.strip([p(-sv, 0), p(sv, 0)], lw, 0, 0xffffff);
    for (const s of [-hl, hl]) lines.strip([p(s, 0), p(s - Math.sign(s) * 0.1, 0)], lw, 0, 0xffffff);
    // net: posts 0.914 m outside the doubles lines, 1.07 m high, dips to 0.914 in the middle
    const [ax, az] = p(0, -hw - 0.914), [bx, bz] = p(0, hw + 0.914), h = Math.atan2(uW[0], uW[1]);
    props.cyl(ax, 0, az, 0.04, 1.07, C.green, 8); props.cyl(bx, 0, bz, 0.04, 1.07, C.green, 8);
    const n = 8;
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, y0 = 1.07 - 0.156 * Math.sin(Math.PI * t0), y1 = 1.07 - 0.156 * Math.sin(Math.PI * t1);
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      props.beam(x0, y0 - 0.03, z0, x1, y1 - 0.03, z1, 0.06, 0xf2f2f2, 0.02);                          // white tape
      const xm = (x0 + x1) / 2, zm = (z0 + z1) / 2, ym = (y0 + y1) / 2;
      props.box(xm, 0.02, zm, Math.hypot(x1 - x0, z1 - z0), ym - 0.08, 0.012, h - Math.PI / 2, C.net);  // mesh (dark panel)
    }
    const [mx, mz] = p(0, 0); props.box(mx, 0, mz, 0.05, 0.914, 0.02, h - Math.PI / 2, 0xf2f2f2);     // centre strap
    collider && (collider.addCircle(ax, az, 0.08), collider.addCircle(bx, bz, 0.08));
  }
}

// ------------------------------------------------------------------------------------------------ rugby posts
export function rugbyPosts(props, x, z, h, collider) {
  const ux = Math.cos(h), uz = -Math.sin(h);
  for (const s of [-2.8, 2.8]) { const px = x + ux * s, pz = z + uz * s; props.cyl(px, 0, pz, 0.08, 11, C.white, 8); props.cyl(px, 0, pz, 0.2, 1.8, 0x1f3a7a, 10); collider && collider.addCircle(px, pz, 0.2); }
  props.beam(x - ux * 2.8, 3, z - uz * 2.8, x + ux * 2.8, 3, z + uz * 2.8, 0.09, C.white);
}

// ------------------------------------------------------------------------------------------------ bridge railings
export function bridgeRails(props, pts, w) {
  for (const side of [-1, 1]) {
    const off = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      off.push([pts[i][0] + (-(b[1] - a[1]) / L) * side * (w / 2), pts[i][1] + ((b[0] - a[0]) / L) * side * (w / 2)]);
    }
    for (let i = 0; i < off.length - 1; i++) {
      const [ax, az] = off[i], [bx, bz] = off[i + 1];
      props.beam(ax, 1.0, az, bx, 1.0, bz, 0.08, C.offwhite); props.beam(ax, 0.55, az, bx, 0.55, bz, 0.06, C.offwhite);
    }
    for (const q of alongRing(off, 1.2, false).concat([[...off[off.length - 1]]])) props.box(q[0], 0.04, q[1], 0.1, 1.0, 0.1, 0, C.offwhite);
  }
}

// ------------------------------------------------------------------------------------------------ trees (instanced)
/**
 * list: [{sp:'broad'|'willow'|'fruit', x, z, h, w?, color?}] -> [meshes] (ONE per species: the city's pass-4 leaf-card
 * tree, world/vegetation.js treeModel(sp), in the city's cityMats.treeNear material: crown tinted by the instance
 * colour, bark not, wind sway, casts but does not sample the shadow map, like the city's trees).
 */
export function buildTrees(world, list) {
  const out = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  const mat = world.cityMats.treeNear;
  if (!mat) return out;
  const groups = { broad: [], willow: [] };
  for (const t of list) (t.sp === 'willow' ? groups.willow : groups.broad).push(t);
  for (const sp of ['broad', 'willow']) {
    const L = groups[sp]; if (!L.length) continue;
    const tree = new THREE.InstancedMesh(treeModel(sp), mat, L.length);
    L.forEach((t, i) => {
      const w = t.w || t.h * (sp === 'willow' ? 1.15 : 1.0);
      q.setFromAxisAngle(up, (t.x * 7.1 + t.z * 3.3) % 6.28);
      m4.compose(v.set(t.x, 0, t.z), q, s.set(w, t.h, w));
      tree.setMatrixAt(i, m4);
      col.set(t.color || (sp === 'willow' ? 0x9ab04a : 0x5e7e34)); tree.setColorAt(i, col);
    });
    tree.castShadow = true; tree.receiveShadow = false; tree.computeBoundingSphere(); tree.matrixAutoUpdate = false;
    tree.name = 'grounds-trees-' + sp; out.push(tree);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ flowers + reeds
export function flowerMesh(list) {
  // list: [{x,z,c,s}] -> one InstancedMesh: green foliage mound + coloured flower heads (instance colour applies to heads only)
  const parts = [];
  // graphics pass 6: 35 triangles a clump (was 140: an icosahedron mound + six icosahedron heads), same silhouette at
  // walking distance: a five-sided leafy dome with five small tetrahedral flower heads standing out of it
  const leaf = NI(new THREE.SphereGeometry(0.3, 5, 2, 0, Math.PI * 2, 0, Math.PI / 2)); leaf.scale(1, 1.25, 1); leaf.translate(0, 0.04, 0);
  parts.push([leaf, 0x2e5a26]);
  for (let i = 0; i < 5; i++) { const h = NI(new THREE.TetrahedronGeometry(i ? 0.07 : 0.08, 0)); const a = i * 1.57; h.rotateY(a); if (i) h.translate(Math.cos(a) * 0.19, 0.3 + (i % 2) * 0.06, Math.sin(a) * 0.19); else h.translate(0, 0.44, 0); parts.push([h, 0xffffff]); }
  const geo = mergeColored(parts);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', 'vColor = vec3(1.0); vColor *= color; \n#ifdef USE_INSTANCING_COLOR\n if (color.g > 0.99) vColor *= instanceColor.xyz;\n#endif'); };
  mat.customProgramCacheKey = () => 'gto-flowers';
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  list.forEach((f, i) => { q.setFromAxisAngle(up, i * 2.4); m4.compose(v.set(f.x, 0, f.z), q, s.setScalar(f.s || 1)); im.setMatrixAt(i, m4); im.setColorAt(i, c.set(f.c)); });
  im.count = list.length; im.receiveShadow = true; im.computeBoundingSphere(); im.matrixAutoUpdate = false; im.name = 'grounds-flowers';
  return im;
}
export function reedMesh(list) {
  // list: [{x,z,h,s}] reed clumps standing in the shallows: green blades + brown seed heads
  const parts = [];
  // graphics pass 6: 46 triangles a clump (was ~140): each blade is one tapering double-sided triangle (they were
  // three-sided cones), the seed heads four-sided open tubes
  for (let i = 0; i < 16; i++) {
    const a = i * 0.9, r = 0.05 + (i % 4) * 0.07, h = 1.1 + (i % 4) * 0.25, lean = 0.12 + (i % 3) * 0.05;
    const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute([-0.03, 0, 0, 0.03, 0, 0, 0, h, 0], 3));
    b.rotateY(a * 2.3); b.rotateZ(Math.cos(a) * lean); b.rotateX(Math.sin(a) * lean); b.translate(Math.cos(a) * r, -0.15, Math.sin(a) * r);
    parts.push([b, i % 2 ? 0x6a8a3a : 0x7f9a46]);
    if (i % 4 === 0) { const hd = NI(new THREE.CylinderGeometry(0.03, 0.025, 0.2, 4, 1, true)); hd.translate(0, h - 0.1, 0); hd.rotateZ(Math.cos(a) * lean); hd.rotateX(Math.sin(a) * lean); hd.translate(Math.cos(a) * r, -0.15, Math.sin(a) * r); parts.push([hd, 0x6a4a2a]); }
  }
  const geo = mergeColored(parts);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), Math.max(1, list.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  list.forEach((f, i) => { q.setFromAxisAngle(up, i * 1.7); m4.compose(v.set(f.x, 0, f.z), q, s.set(f.s || 1, f.h || 1, f.s || 1)); im.setMatrixAt(i, m4); });
  im.count = list.length; im.computeBoundingSphere(); im.matrixAutoUpdate = false; im.name = 'grounds-reeds';
  return im;
}
function mergeColored(parts) {
  let n = 0; for (const [g] of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0; const c = new THREE.Color();
  for (const [g, hex] of parts) {
    c.set(hex);
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++, o++) { pos.set([P.getX(i), P.getY(i), P.getZ(i)], o * 3); nor.set([N.getX(i), N.getY(i), N.getZ(i)], o * 3); col.set([c.r, c.g, c.b], o * 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------------------------------------ garden bits
export function sundial(props, x, z) {
  props.cyl(x, 0, z, 0.55, 0.15, 0xc8b88a, 12); props.cyl(x, 0.15, z, 0.18, 0.85, 0xd2c296, 10); props.cyl(x, 1.0, z, 0.28, 0.06, 0xd2c296, 12);
  props.cyl(x, 1.06, z, 0.24, 0.015, 0x6a5a2a, 12); props.box(x, 1.07, z, 0.015, 0.14, 0.2, 0.6, 0x6a5a2a, 0.5);
}
export function beehive(props, x, z, h) {
  // WBC-style white hive: stand, stepped lifts, gabled roof
  props.box(x, 0, z, 0.55, 0.3, 0.55, h, 0x6a5a48);
  for (let i = 0; i < 4; i++) props.box(x, 0.3 + i * 0.17, z, 0.6 - (i % 2) * 0.04, 0.16, 0.6 - (i % 2) * 0.04, h, 0xf0eee6);
  props.box(x, 0.98, z, 0.68, 0.06, 0.68, h, 0xf0eee6);
  props.box(x, 1.04, z, 0.5, 0.18, 0.66, h, 0xf0eee6, 0, 0.0);
}
export { pip, dSeg, dRing };
