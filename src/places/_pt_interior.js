// Purple Turtle — the cellars (interior scene). Three parallel brick barrel vaults under the Oxford Union, joined by
// arched openings through the piers, "deeper and deeper" from the stair:
//   R1 (north) bar room: stair foot + pay desk + cloakroom hatch at the east end, the bar along the north wall;
//   R2 (middle) the dance floor at the back (west) with the DJ booth, mirror ball, coloured lights and haze;
//   R3 (south) games room (table football, jukebox) at the east end, a quiet vaulted nook with sofas at the west end;
//   a corridor off R2 to the toilets; the stair up to Frewin Court off R1.
// Layout is a GUESS from the sources (low brick vaults, connected rooms, small dance floor at the back, jukebox, table
// football, sweaty walls) — no floor plan was found. Static geometry is merged per material (≈ 14 draw calls).
import * as THREE from 'three';
import { GB } from './_pt_geo.js';
import { ptAtlas, uvRect, ptFloor, ptGlow, ptBeam } from './_pt_tex.js';

export const LAY = {
  X0: -8, X1: 9,
  R1: { za: -5, zb: 0, wh: 1.9, crown: 2.6 },
  R2: { za: 0.6, zb: 6.6, wh: 1.95, crown: 2.8 },
  R3: { za: 7.2, zb: 11.2, wh: 1.85, crown: 2.45 },
  open12: [[-5.5, -3.5], [1, 3]], open23: [[-4, -2.5], [4, 6]], openH: 1.8,
  // (top = the depth of the cellar floor below Frewin Court: 3.0 m, so that the vault crowns — 2.8 at most — are under the
  //  ground everywhere: the club is a walk-in room in place, and what is above ground would be seen from the street)
  stair: { x0: 9, x1: 14, xe: 15.5, za: -4.2, zb: -2.4, top: 3.0 },
  corr: { x0: 9, x1: 15, za: 3.0, zb: 4.4, h: 2.2 },
  cloak: { x0: 6.2, x1: 8.0, z0: -6.3, hole: [6.4, 7.8, 0.95, 1.75] },
  spawn: [8.4, -3.3], spawnH: -Math.PI / 2, exit: [15.0, -3.3],
  // the street doorway at the head of the stair (walk-in: a real opening in the end wall; purple_turtle.js)
  streetDoor: { z: -3.3, w: 1.3, h: 2.15 },
  bar: { x0: -3.5, x1: 4.5, front: -3.4, depth: 0.6, top: 1.05, staffZ: -4.35, orderAt: [0.5, -2.8] },
  cash: { x: 7.4, z: -0.85 }, dj: { x: -6.8, z: 3.6 }, ball: [-2.5, 2.42, 3.6],
  floor: { x0: -6.2, x1: 2.4, z0: 1.3, z1: 6.0 },
  foos: { x: 5.0, z: 9.2 }, jukebox: { x: 8.6, z: 10.2 },
  sofaA: { x: -5.2, z: 10.75 }, sofaB: { x: -7.55, z: 8.8 },
  toilets: { x: 13.5 },
};

/** vault ceiling height over a room */
function vaultY(R, z) {
  const hw = (R.zb - R.za) / 2, rise = R.crown - R.wh, Rr = (hw * hw + rise * rise) / (2 * rise), cy = R.crown - Rr, s = Math.min(hw, Math.abs(z - (R.za + R.zb) / 2));
  return cy + Math.sqrt(Rr * Rr - s * s);
}
export function ceilAt(x, z) {
  if (x > LAY.X1) { const S = LAY.stair; if (z > S.za && z < S.zb) return groundAt(x, z) + 2.3; return LAY.corr.h; }
  for (const k of ['R1', 'R2', 'R3']) { const R = LAY[k]; if (z >= R.za && z <= R.zb) return vaultY(R, z); }
  return LAY.openH;
}
export function groundAt(x, z) {
  const S = LAY.stair;
  if (x > S.x0 && z > S.za - 0.05 && z < S.zb + 0.05) return Math.min(S.top, Math.max(0, ((x - S.x0) / (S.x1 - S.x0)) * S.top));
  return 0;
}

export function buildInterior(scene, col, game, opts = {}) {
  const WALKIN = !!opts.walkin;      // the stair's head is a real doorway onto Frewin Court (core/interiors.js "seamless")
  const world = game.world, M = world.mats;
  const brick = M.brick, out = {};
  const purpleBrick = brick.clone(); purpleBrick.color = new THREE.Color(0xb48ad0);
  const warmBrick = brick.clone(); warmBrick.color = new THREE.Color(0xe0c8b8);
  const paint = new THREE.MeshStandardMaterial({ color: 0x4a1f66, roughness: 0.9 });
  const floorM = new THREE.MeshStandardMaterial({ map: ptFloor(), roughness: 0.5, metalness: 0.05, color: 0xffffff });
  const wood = M.darkWood;
  const colM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const glowM = new THREE.MeshBasicMaterial({ vertexColors: true });
  const atlas = ptAtlas();
  const signM = new THREE.MeshBasicMaterial({ map: atlas });
  const muralM = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.8 });
  const B1 = new GB(), B2 = new GB(), B3 = new GB(), PT = new GB(), FL = new GB(), WD = new GB(), CO = new GB(true), GL = new GB(true), SG = new GB(), MU = new GB();
  const seg = (x1, z1, x2, z2, tag = 'wall') => col.addSegment(x1, z1, x2, z2, { tag });
  const { X0, X1 } = LAY, OH = LAY.openH;

  // ------------------------------------------------------------------ vaults
  function barrel(gb, R) {
    const hw = (R.zb - R.za) / 2, zc = (R.za + R.zb) / 2, rise = R.crown - R.wh, Rr = (hw * hw + rise * rise) / (2 * rise), cy = R.crown - Rr, am = Math.asin(hw / Rr), N = 18;
    for (let i = 0; i < N; i++) {
      const a0 = -am + (2 * am * i) / N, a1 = -am + (2 * am * (i + 1)) / N;
      const z0 = zc + Rr * Math.sin(a0), y0 = cy + Rr * Math.cos(a0), z1 = zc + Rr * Math.sin(a1), y1 = cy + Rr * Math.cos(a1);
      const n0 = [0, -Math.cos(a0), -Math.sin(a0)], n1 = [0, -Math.cos(a1), -Math.sin(a1)];
      gb.quad([X0, y0, z0], [X1, y0, z0], [X1, y1, z1], [X0, y1, z1], [0, -1, 0], [[X0, Rr * a0], [X1, Rr * a0], [X1, Rr * a1], [X0, Rr * a1]], [n0, n0, n1, n1]);
    }
  }
  /** arched end wall at x (facing nx = ±1), with rectangular holes [[za, zb, h]] */
  function endWall(gb, R, x, nx, holes = []) {
    const pts = [], hw = (R.zb - R.za) / 2, zc = (R.za + R.zb) / 2;
    pts.push(new THREE.Vector2(R.za, 0), new THREE.Vector2(R.zb, 0));
    for (let i = 0; i <= 16; i++) { const z = R.zb - (i / 16) * (R.zb - R.za); pts.push(new THREE.Vector2(z, vaultY(R, z))); }
    const hs = holes.map(([a, b, h]) => [new THREE.Vector2(a, 0.001), new THREE.Vector2(a, h), new THREE.Vector2(b, h), new THREE.Vector2(b, 0.001)]);
    // holes touching the floor: cut them out of the contour instead
    const contour = [];
    const sorted = holes.slice().sort((p, q) => p[0] - q[0]);
    contour.push(new THREE.Vector2(R.za, 0));
    for (const [a, b, h] of sorted) contour.push(new THREE.Vector2(a, 0), new THREE.Vector2(a, h), new THREE.Vector2(b, h), new THREE.Vector2(b, 0));
    contour.push(new THREE.Vector2(R.zb, 0));
    for (let i = 0; i <= 16; i++) { const z = R.zb - (i / 16) * (R.zb - R.za); contour.push(new THREE.Vector2(z, vaultY(R, z))); }
    void hs; void hw; void zc; void pts;
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const [i, j, k] of tris) {
      const p = [contour[i], contour[j], contour[k]];
      gb.tri([x, p[0].y, p[0].x], [x, p[1].y, p[1].x], [x, p[2].y, p[2].x], [nx, 0, 0], [p[0].x, p[0].y], [p[1].x, p[1].y], [p[2].x, p[2].y]);
    }
    // collider along the base, minus holes
    let z = R.za; for (const [a, b] of sorted) { if (a > z) seg(x, z, x, a); z = b; } if (R.zb > z) seg(x, z, x, R.zb);
  }
  /** long side wall at z (facing nz) from X0..X1 with openings [[x0,x1,h,y0=0]] */
  function sideWall(gb, z, nz, wh, opens, collide = true) {
    const o = opens.slice().sort((a, b) => a[0] - b[0]); let x = X0;
    for (const [a, b, h, y0 = 0] of o) {
      if (a > x) gb.wall(x, z, a, z, 0, wh, [0, 0, nz]);
      if (h < wh) gb.wall(a, z, b, z, h, wh, [0, 0, nz]);
      if (y0 > 0) gb.wall(a, z, b, z, 0, y0, [0, 0, nz]);
      if (collide) { if (a > x) seg(x, z, a, z); if (y0 > 0) seg(a, z, b, z); }
      x = b;
    }
    if (X1 > x) { gb.wall(x, z, X1, z, 0, wh, [0, 0, nz]); if (collide) seg(x, z, X1, z); }
  }
  /** pier passage between rooms: jambs + soffit, z0..z1 */
  function passage(gb, a, b, z0, z1, h) {
    gb.wall(a, z0, a, z1, 0, h, [1, 0, 0]); gb.wall(b, z0, b, z1, 0, h, [-1, 0, 0]);
    gb.quad([a, h, z0], [b, h, z0], [b, h, z1], [a, h, z1], [0, -1, 0], [[a, z0], [b, z0], [b, z1], [a, z1]]);
    seg(a, z0, a, z1); seg(b, z0, b, z1);
  }
  const { R1, R2, R3 } = LAY;
  barrel(warmBrick === null ? B1 : B1, R1); barrel(B2, R2); barrel(B3, R3);
  const o12 = LAY.open12.map(([a, b]) => [a, b, OH]), o23 = LAY.open23.map(([a, b]) => [a, b, OH]);
  const ch = LAY.cloak.hole;
  sideWall(B1, R1.za, 1, R1.wh, [[ch[0], ch[1], ch[3], ch[2]]]);
  sideWall(B1, R1.zb, -1, R1.wh, o12);
  sideWall(B2, R2.za, 1, R2.wh, o12); sideWall(B2, R2.zb, -1, R2.wh, o23);
  sideWall(B3, R3.za, 1, R3.wh, o23); sideWall(B3, R3.zb, -1, R3.wh, []);
  endWall(B1, R1, X0, 1); endWall(B1, R1, X1, -1, [[LAY.stair.za, LAY.stair.zb, 2.1]]);
  endWall(B2, R2, X0, 1); endWall(B2, R2, X1, -1, [[LAY.corr.za, LAY.corr.zb, 2.1]]);
  endWall(B3, R3, X0, 1); endWall(B3, R3, X1, -1);
  for (const [a, b] of LAY.open12) passage(B1, a, b, R1.zb, R2.za, OH);
  for (const [a, b] of LAY.open23) passage(B3, a, b, R2.zb, R3.za, OH);
  // floors
  FL.flat(X0, R1.za, X1, R1.zb, 0); FL.flat(X0, R2.za, X1, R2.zb, 0); FL.flat(X0, R3.za, X1, R3.zb, 0);
  for (const [a, b] of LAY.open12) FL.flat(a, R1.zb, b, R2.za, 0);
  for (const [a, b] of LAY.open23) FL.flat(a, R2.zb, b, R3.za, 0);
  // cloakroom recess behind its hatch
  { const C = LAY.cloak; PT.wall(C.x0, C.z0, C.x1, C.z0, 0, 1.9, [0, 0, 1]); PT.wall(C.x0, C.z0, C.x0, R1.za, 0, 1.9, [1, 0, 0]); PT.wall(C.x1, C.z0, C.x1, R1.za, 0, 1.9, [-1, 0, 0]);
    PT.flat(C.x0, C.z0, C.x1, R1.za, 1.9, -1); FL.flat(C.x0, C.z0, C.x1, R1.za, 0);
    // hatch reveal + ledge
    WD.box((ch[0] + ch[1]) / 2, ch[2] - 0.05, R1.za + 0.02, ch[1] - ch[0] + 0.1, 0.05, 0.35);
    // coats on a rail
    CO.color(0x777777).rod([C.x0 + 0.1, 1.55, C.z0 + 0.35], [C.x1 - 0.1, 1.55, C.z0 + 0.35], 0.012);
    const coats = [0x1a1a1a, 0x5a3a2a, 0x2a3a5a, 0x7a1a2a, 0x1a1a1a, 0x3a4a3a, 0xc8b89a, 0x1a2a4a];
    coats.forEach((c, i) => CO.color(c).box(C.x0 + 0.2 + i * 0.2, 0.75, C.z0 + 0.35, 0.12, 0.8, 0.42)); }

  // ------------------------------------------------------------------ the stair up to Frewin Court
  { const S = LAY.stair, n = Math.round(S.top / 0.2), run = (S.x1 - S.x0) / n, rise = S.top / n;
    for (let i = 0; i < n; i++) { const x = S.x0 + i * run, y = (i + 1) * rise;
      PT.wall(x, S.za, x, S.zb, y - rise, y, [-1, 0, 0]); FL.flat(x, S.za, x + run, S.zb, y); }
    FL.flat(S.x1, S.za, S.xe, S.zb, S.top);
    const top = (x) => groundAt(x, (S.za + S.zb) / 2) + 2.3;
    for (let i = 0; i < 14; i++) { const xa = S.x0 + (i / 14) * (S.xe - S.x0), xb = S.x0 + ((i + 1) / 14) * (S.xe - S.x0);
      PT.quad([xa, 0, S.za], [xb, 0, S.za], [xb, top(xb), S.za], [xa, top(xa), S.za], [0, 0, 1]);
      PT.quad([xa, 0, S.zb], [xb, 0, S.zb], [xb, top(xb), S.zb], [xa, top(xa), S.zb], [0, 0, -1]);
      PT.quad([xa, top(xa), S.za], [xb, top(xb), S.za], [xb, top(xb), S.zb], [xa, top(xa), S.zb], [0, -1, 0]); }
    if (WALKIN) { const D = LAY.streetDoor, z0 = D.z - D.w / 2, z1 = D.z + D.w / 2;
      PT.wall(S.xe, S.za, S.xe, z0, S.top, S.top + 2.3, [-1, 0, 0]); PT.wall(S.xe, z1, S.xe, S.zb, S.top, S.top + 2.3, [-1, 0, 0]); PT.wall(S.xe, z0, S.xe, z1, S.top + D.h, S.top + 2.3, [-1, 0, 0]);
    } else PT.wall(S.xe, S.za, S.xe, S.zb, S.top, S.top + 2.3, [-1, 0, 0]);
    seg(S.x0, S.za, S.xe, S.za); seg(S.x0, S.zb, S.xe, S.zb); seg(S.xe, S.za, S.xe, S.zb);
    // street door at the top (closed), handrail
    if (!WALKIN) CO.color(0x2a0a3a).box(S.xe - 0.04, S.top, (S.za + S.zb) / 2, 0.06, 2.1, 1.2);
    CO.color(0x161616).rod([S.x0 + 0.2, 0.95, S.zb - 0.06], [S.x1, S.top + 0.95, S.zb - 0.06], 0.02);
    SG.wall(S.xe - 0.08, -3.0, S.xe - 0.08, -3.6, S.top + 2.12, S.top + 2.27, [-1, 0, 0], uvRect('exit', 2)); }
  // ------------------------------------------------------------------ toilets corridor
  { const C = LAY.corr;
    PT.wall(C.x0, C.za, C.x1, C.za, 0, C.h, [0, 0, 1]); PT.wall(C.x0, C.zb, C.x1, C.zb, 0, C.h, [0, 0, -1]); PT.wall(C.x1, C.za, C.x1, C.zb, 0, C.h, [-1, 0, 0]);
    PT.flat(C.x0, C.za, C.x1, C.zb, C.h, -1); FL.flat(C.x0, C.za, C.x1, C.zb, 0);
    seg(C.x0, C.za, C.x1, C.za); seg(C.x0, C.zb, C.x1, C.zb); seg(C.x1, C.za, C.x1, C.zb);
    const tx = LAY.toilets.x;
    CO.color(0x5a1a5a).box(tx, 0, C.za + 0.03, 0.85, 2.0, 0.05); CO.color(0x1a2a5a).box(tx, 0, C.zb - 0.03, 0.85, 2.0, 0.05);
    SG.wall(tx - 0.3, C.za + 0.07, tx + 0.3, C.za + 0.07, 2.02, 2.17, [0, 0, 1], uvRect('ladies', 2));
    SG.wall(tx + 0.3, C.zb - 0.07, tx - 0.3, C.zb - 0.07, 2.02, 2.17, [0, 0, -1], uvRect('gents', 2));
    CO.color(0xd8d8d8).box(C.x1 - 0.12, 1.2, (C.za + C.zb) / 2, 0.2, 0.3, 0.3);   // hand dryer
    GL.color(0x6a3a9a).box(C.x0 + 3, C.h - 0.05, (C.za + C.zb) / 2, 2.4, 0.04, 0.08); }   // strip light

  // ------------------------------------------------------------------ the bar
  { const b = LAY.bar, cx = (b.x0 + b.x1) / 2, w = b.x1 - b.x0, zc = b.front - b.depth / 2;
    CO.color(0x3a1050).box(cx, 0, zc, w, b.top - 0.05, b.depth);
    WD.box(cx, b.top - 0.05, zc - 0.03, w + 0.1, 0.05, b.depth + 0.14);
    GL.color(0xa040ff).box(cx, 0.08, b.front + 0.01, w, 0.03, 0.02);                  // purple LED kick strip
    col.addBox(cx, zc, w, b.depth);
    // back bar: shelves, bottles, glowing fridges
    WD.box(cx, 0.9, R1.za + 0.18, w - 0.6, 0.04, 0.32); WD.box(cx, 1.3, R1.za + 0.15, w - 0.6, 0.04, 0.28);
    const bc = [0x2a6a2a, 0x8a5a1a, 0xc8c8d8, 0x6a1a1a, 0x1a3a6a, 0xd8a020, 0x3a1a0a, 0xe8e8e8];
    for (let i = 0; i < 44; i++) { const x = b.x0 + 0.45 + (i % 22) * ((w - 0.9) / 21), y = i < 22 ? 0.94 : 1.34; const z = R1.za + 0.15; CO.color(bc[(i * 5) % bc.length]).cyl(x, y, z, 0.035, 0.15, 5, 0.035, false).cyl(x, y + 0.15, z, 0.035, 0.035, 5, 0.012, false).cyl(x, y + 0.185, z, 0.012, 0.06, 5); }   // body, shoulder, neck (were plain cones)
    for (let i = 0; i < 3; i++) GL.color(0xd8f0ff).box(b.x0 + 1.2 + i * 2.6, 0.12, R1.za + 0.31, 1.0, 0.65, 0.02);
    // taps
    for (let i = 0; i < 4; i++) { const x = cx - 1.5 + i * 0.35; CO.color(0xc8c8c8).cyl(x, b.top, zc - 0.1, 0.02, 0.3, 6); CO.color([0xd02020, 0x2050c0, 0xe0c040, 0x111111][i]).box(x, b.top + 0.3, zc - 0.1, 0.05, 0.1, 0.03); }
    // hanging shots board
    const zb = b.front - 0.4, by0 = 1.25, by1 = 2.38;
    SG.wall(b.x0 + 2.6, zb, b.x0 + 2.6 + (by1 - by0) * 1.333, zb, by0, by1, [0, 0, 1], uvRect('menu', 2));
    CO.color(0x111111).box(b.x0 + 2.6 + 0.75, by0 - 0.02, zb - 0.03, 1.58, by1 - by0 + 0.04, 0.03);
    out.menuAt = [b.x0 + 2.6 + 0.75, zb]; }
  // pay desk + cloakroom sign + mind your head
  { const c = LAY.cash; CO.color(0x2a0a40).box(c.x, 0, c.z, 1.2, 1.0, 0.5); WD.box(c.x, 1.0, c.z, 1.3, 0.04, 0.6);
    SG.wall(c.x - 0.58, c.z - 0.26, c.x + 0.58, c.z - 0.26, 0.55, 0.9, [0, 0, -1], uvRect('cashdesk', 2)); col.addBox(c.x, c.z, 1.2, 0.5);
    CO.color(0x111111).box(c.x + 0.3, 1.04, c.z, 0.1, 0.12, 0.06);   // the stamp
    const C = LAY.cloak; SG.wall(C.x0 + 0.15, R1.za + 0.02, C.x1 - 0.15, R1.za + 0.02, 1.78, 1.88, [0, 0, 1], uvRect('cloak', 2));
    SG.wall(X1 - 0.02, -4.0, X1 - 0.02, -2.6, 2.13, 2.33, [-1, 0, 0], uvRect('head', 1)); }
  // ------------------------------------------------------------------ decor: mural, crests, neon turtle, fairy lights
  MU.wall(X0 + 0.02, -0.6, X0 + 0.02, -4.4, 0.95, 1.66, [1, 0, 0], uvRect('mural', 1));
  MU.wall(-7.6, R1.za + 0.02, -4.1, R1.za + 0.02, 0.62, 1.71, [0, 0, 1], uvRect('crests', 1));
  MU.wall(X1 - 0.02, R3.za + 0.6, X1 - 0.02, R3.za + 1.7, 1.0, 1.6, [-1, 0, 0], uvRect('poster2', 2));
  [[-2.0, 'poster0'], [5.5, 'poster1'], [7.2, 'poster3']].forEach(([x, k]) => MU.wall(x, R2.zb - 0.02, x - 0.55, R2.zb - 0.02, 0.9, 1.86, [0, 0, -1], uvRect(k, 2)));
  SG.wall(X0 + 0.02, 4.13, X0 + 0.02, 3.07, 1.55, 2.6, [1, 0, 0], uvRect('neon', 2));
  { const pts = [], cols = []; const pal = [[1, 0.75, 0.4], [1, 0.4, 0.8], [0.6, 0.5, 1], [1, 0.9, 0.6]];
    const string = (R, x0, x1, off) => { for (let x = x0; x <= x1; x += 0.28) { const k = Math.round(x * 7), z = (R.za + R.zb) / 2 + off + Math.sin(x * 1.3) * 0.15; pts.push(x, vaultY(R, z) - 0.05 - 0.07 * Math.abs(Math.sin(x * 0.9)), z); cols.push(...pal[((k % 4) + 4) % 4]); } };
    string(R1, -7.6, 8.6, -0.8); string(R1, -7.6, 8.6, 0.8); string(R3, -7.6, 8.6, 0); string(R2, 2.6, 8.6, -1.2); string(R2, 2.6, 8.6, 1.2);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    out.fairy = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, map: ptGlow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(out.fairy); }

  // ------------------------------------------------------------------ furniture
  // high tables + stools in the bar room (west) and a drinks ledge in R2 east
  for (const [x, z] of [[-6.6, -3.2], [-6.6, -1.2], [-4.6, -1.0], [6.2, 2.0], [7.6, 5.2]]) {
    WD.cyl(x, 1.02, z, 0.38, 0.05, 12); CO.color(0x222222).cyl(x, 0, z, 0.04, 1.02, 6).cyl(x, 0, z, 0.24, 0.03, 10); col.addCircle(x, z, 0.3, { tag: 'table' });
  }
  WD.box(5.8, 1.08, R2.za + 0.15, 5.4, 0.04, 0.3);
  // DJ booth, speakers, lighting truss with cans
  { const d = LAY.dj; CO.color(0x101010).box(d.x, 0, d.z, 0.8, 1.05, 2.4); SG.wall(d.x + 0.41, d.z + 1.15, d.x + 0.41, d.z - 1.15, 0.15, 0.95, [1, 0, 0], uvRect('dj', 2));
    CO.color(0x202020).box(d.x, 1.05, d.z - 0.55, 0.5, 0.06, 0.5).box(d.x, 1.05, d.z + 0.55, 0.5, 0.06, 0.5); CO.color(0x050505).cyl(d.x, 1.11, d.z - 0.55, 0.16, 0.01, 14).cyl(d.x, 1.11, d.z + 0.55, 0.16, 0.01, 14);
    GL.color(0x40c0ff).box(d.x - 0.05, 1.08, d.z, 0.28, 0.02, 0.4); col.addBox(d.x, d.z, 0.8, 2.4);
    for (const z of [R2.za + 0.5, R2.zb - 0.5]) { CO.color(0x141414).box(X0 + 0.4, 0, z, 0.6, 1.3, 0.6); CO.color(0x303030).cyl(X0 + 0.71, 0.85, z, 0.18, 0.01, 12); col.addBox(X0 + 0.4, z, 0.6, 0.6); }
    CO.color(0x2a2a2a).rod([-6.4, 2.48, 3.6], [1.6, 2.48, 3.6], 0.03);
    out.cans = [-5.6, -4.0, -2.4, -0.8, 0.8].map((x) => { CO.color(0x111111).box(x, 2.28, 3.6, 0.16, 0.2, 0.16); return [x, 2.3, 3.6]; }); }
  // table football
  { const f = LAY.foos; CO.color(0x3a2a1a);
    for (const [dx, dz] of [[-0.62, -0.3], [0.62, -0.3], [-0.62, 0.3], [0.62, 0.3]]) CO.box(f.x + dx, 0, f.z + dz, 0.07, 0.65, 0.07);
    CO.color(0x5a3a1a).box(f.x, 0.65, f.z, 1.4, 0.25, 0.78, { top: true });
    MU.flat(f.x - 0.66, f.z - 0.35, f.x + 0.66, f.z + 0.35, 0.7, 1, uvRect('foos', 2));
    CO.color(0x5a3a1a).box(f.x, 0.7, f.z - 0.37, 1.4, 0.2, 0.04).box(f.x, 0.7, f.z + 0.37, 1.4, 0.2, 0.04).box(f.x - 0.68, 0.7, f.z, 0.04, 0.2, 0.78).box(f.x + 0.68, 0.7, f.z, 0.04, 0.2, 0.78);
    [-0.5, -0.17, 0.17, 0.5].forEach((dx, i) => { const x = f.x + dx; CO.color(0xb0b0b0).rod([x, 0.85, f.z - 0.75], [x, 0.85, f.z + 0.75], 0.012); CO.color(0x111111).box(x, 0.8, f.z + (i % 2 ? 0.7 : -0.7), 0.05, 0.1, 0.16);
      const men = i === 0 || i === 3 ? [0] : [-0.22, 0, 0.22]; for (const m of men) CO.color(i < 2 ? 0xc02020 : 0x2050c0).box(x, 0.72, f.z + m, 0.05, 0.16, 0.05); });
    col.addBox(f.x, f.z, 1.45, 0.8); }
  // jukebox
  { const j = LAY.jukebox; CO.color(0x6a2a1a).box(j.x, 0, j.z, 0.55, 1.45, 0.78); SG.wall(j.x - 0.28, j.z + 0.36, j.x - 0.28, j.z - 0.36, 0.1, 1.38, [-1, 0, 0], uvRect('jukebox', 2));
    GL.color(0xffb040).box(j.x, 1.45, j.z, 0.5, 0.05, 0.7); col.addBox(j.x, j.z, 0.55, 0.78); }
  // sofas + low table in the nook
  const sofa = (x, z, ry, w) => { CO.at(x, 0, z, ry); CO.color(0x5a1430).box(0, 0, 0, w, 0.42, 0.8).box(0, 0.42, -0.32, w, 0.42, 0.18).box(-w / 2 + 0.1, 0.42, 0, 0.2, 0.2, 0.8).box(w / 2 - 0.1, 0.42, 0, 0.2, 0.2, 0.8); CO.reset(); col.addBox(x, z, ...(Math.abs(Math.sin(ry)) > 0.5 ? [0.8, w] : [w, 0.8])); };
  sofa(LAY.sofaA.x, LAY.sofaA.z - 0.05, Math.PI, 2.2); sofa(LAY.sofaB.x, LAY.sofaB.z, Math.PI / 2, 2.0);
  WD.box(-5.3, 0, 9.4, 1.0, 0.4, 0.6); col.addBox(-5.3, 9.4, 1.0, 0.6);
  CO.color(0xd8a020).cyl(-5.5, 0.4, 9.4, 0.03, 0.1, 6).cyl(-5.1, 0.4, 9.3, 0.035, 0.08, 6);

  // ------------------------------------------------------------------ add static meshes
  const meshes = [B1.mesh(warmBrick, scene), B2.mesh(purpleBrick, scene), B3.mesh(warmBrick, scene), PT.mesh(paint, scene), FL.mesh(floorM, scene), WD.mesh(wood, scene),
    CO.mesh(colM, scene), GL.mesh(glowM, scene), SG.mesh(signM, scene), MU.mesh(muralM, scene)];
  for (const m of meshes) if (m) m.receiveShadow = false;
  out.static = meshes.filter(Boolean);

  // ------------------------------------------------------------------ lights (4 points + the scene's ambient + hemi = 6)
  const L = (x, y, z, c, i, d) => { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(x, y, z); l.userData = { base: i, color: c }; scene.add(l); return l; };
  out.lights = { bar: L(0.5, 2.1, -2.6, 0xffb070, 8, 15), dance: L(-2.5, 2.2, 3.6, 0xc040ff, 9, 11), back: L(1.0, 2.0, 9.2, 0xffa0d0, 6, 15), lobby: L(8.0, 2.0, -2.0, 0xd0b0ff, 4, 9),
    stair: L(12.4, 4.05, -3.3, 0xf0d0ff, 5, 8.5) };      // (walk-in: the stair is seen from Frewin Court through the doorway — a bulkhead lamp half-way down, so it is never a black hole)

  // ------------------------------------------------------------------ dance-floor effects (all additive, no real volumetrics)
  const pal = [0xff2080, 0x2080ff, 0x20ff80, 0xffe020, 0xa040ff, 0x20e0ff];
  { const pm = new THREE.MeshBasicMaterial({ map: ptGlow(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    out.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), pm, 5); out.pools.frustumCulled = false;
    const bm = new THREE.MeshBasicMaterial({ map: ptBeam(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    out.beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.55, 1, 10, 1, true), bm, 5); out.beams.frustumCulled = false;
    const c = new THREE.Color(); for (let i = 0; i < 5; i++) { out.pools.setColorAt(i, c.setHex(pal[i])); out.beams.setColorAt(i, c.setHex(pal[i])); }
    scene.add(out.pools, out.beams);
    const hm = new THREE.MeshBasicMaterial({ map: ptGlow(), color: 0x8a50c0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
    out.haze = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 1.6), hm, 11); out.haze.frustumCulled = false; scene.add(out.haze);
    out.hazePos = [[-5.5, 1.5, 2.2], [-3.5, 1.9, 4.8], [-1.0, 1.4, 2.6], [0.8, 1.8, 5.0], [-4.5, 1.2, 3.6], [-2.0, 2.1, 3.6], [1.8, 1.3, 3.0], [-3.2, 1.75, 2.9], [-0.6, 1.9, 4.2], [-5.0, 1.9, 4.9], [0.9, 1.6, 2.2]];
    out.pal = pal; }
  // mirror ball + its moving reflections
  { const [bx, by, bz] = LAY.ball;
    out.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 0.9, roughness: 0.15, flatShading: true, emissive: 0x403050 }));
    out.ball.position.set(bx, by, bz); scene.add(out.ball);
    CO.reset();
    const N = 150, dirs = new Float32Array(N * 3); let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < N; i++) { const a = r() * Math.PI * 2, dy = -0.05 - r() * 0.85, h = Math.sqrt(1 - dy * dy); dirs[i * 3] = Math.cos(a) * h; dirs[i * 3 + 1] = dy; dirs[i * 3 + 2] = Math.sin(a) * h; }
    out.ballDirs = dirs;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    out.dots = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, map: ptGlow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    out.dots.frustumCulled = false; scene.add(out.dots); }

  // ------------------------------------------------------------------ cheap instanced crowd stand-ins (back of the dance floor, edges)
  // Low-poly humanoid silhouettes, one InstancedMesh per arm variant (crowdBody = arms down, crowdHead = arms up):
  // head + hair, tapered torso, arms + hands, legs as one tapered block. Per instance: top colour (instanceColor) on the
  // torso and sleeves, skin colour (instSkin) on the head and hands; legs, shoes and hair keep their vertex colours.
  { const n = 70;
    const mat = crowdMaterial();
    out.crowdBody = new THREE.InstancedMesh(crowdFigure(false, n), mat, n);
    out.crowdHead = new THREE.InstancedMesh(crowdFigure(true, n), mat, n);
    out.crowdBody.count = out.crowdHead.count = 0; out.crowdBody.frustumCulled = out.crowdHead.frustumCulled = false;
    out.crowdBody.setColorAt(0, new THREE.Color(1, 1, 1)); out.crowdHead.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(out.crowdBody, out.crowdHead);
    const slots = [];
    for (let x = -6.0; x <= -0.6; x += 0.78) for (let z = 1.35; z <= 5.9; z += 0.72) slots.push([x + (Math.round(z * 3) % 2) * 0.3, z, 'dance']);
    for (const [x, z] of [[-7.4, -4.3], [-5.9, -4.3], [-7.4, -2.2], [-5.6, -2.3], [-7.2, -0.5], [-3.0, -0.6], [-1.6, -0.5], [5.3, -0.5], [4.3, -1.4]]) slots.push([x, z, 'stand']);
    for (const [x, z] of [[4.4, 1.3], [5.3, 1.25], [6.9, 1.3], [8.4, 1.6], [8.3, 3.0], [8.4, 5.3], [6.6, 6.1], [4.8, 6.1], [3.2, 5.9]]) slots.push([x, z, 'stand']);
    for (const [x, z] of [[-1.0, 10.6], [0.5, 10.7], [2.4, 7.7], [7.8, 7.8]]) slots.push([x, z, 'stand']);
    for (const [x, z] of [[-3.4, -2.3], [-0.3, -2.5], [1.0, -2.3], [3.3, -2.5], [4.2, -2.6], [-2.0, -1.4], [0.3, -1.1], [-0.9, -0.5], [3.6, -0.6], [-6.0, -1.1], [-3.2, -4.6], [5.0, -3.4]]) slots.push([x, z, 'stand']);
    // fill order: shuffled (deterministically) so a half-full club is spread out
    slots.sort((a, b) => ((Math.sin(a[0] * 12.9898 + a[1] * 78.233) * 43758.5453) % 1) - ((Math.sin(b[0] * 12.9898 + b[1] * 78.233) * 43758.5453) % 1));
    out.crowdSlots = slots.slice(0, n); }
  return out;
}

// ------------------------------------------------------------------ crowd stand-in figure
// part: 0 = keep vertex colour, 1 = clothing (× instanceColor), 2 = skin (instSkin per instance)
function crowdFigure(armsUp, n) {
  const P = [], N = [], C = [], A = [], I = [];
  const add = (geo, col, part, m) => {
    geo.applyMatrix4(m);
    const g = geo.index ? geo.toNonIndexed() : geo, pa = g.attributes.position.array, na = g.attributes.normal.array, base = P.length / 3;
    const c = new THREE.Color(col);
    for (let k = 0; k < pa.length; k += 3) { P.push(pa[k], pa[k + 1], pa[k + 2]); N.push(na[k], na[k + 1], na[k + 2]); C.push(c.r, c.g, c.b); A.push(part); }
    for (let k = 0; k < pa.length / 3; k++) I.push(base + k);
  };
  const M = (x, y, z, rz = 0, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1));
  const taper = (wb, db, wt, dt, h) => { const g = new THREE.CylinderGeometry(0.5, 0.5, h, 4, 1); g.rotateY(Math.PI / 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setX(i, p.getX(i) * Math.SQRT2 * (top ? wt : wb)); p.setZ(i, p.getZ(i) * Math.SQRT2 * (top ? dt : db)); } g.computeVertexNormals(); return g; };
  // legs: one tapered block with a shallow notch look from darker shoes
  add(taper(0.2, 0.16, 0.34, 0.2, 0.8), 0x23232c, 0, M(0, 0.48, 0));
  add(new THREE.BoxGeometry(0.3, 0.08, 0.26), 0x111114, 0, M(0, 0.04, 0.03));
  // torso (tapered: waist -> shoulders), neck, head, hair
  add(taper(0.3, 0.19, 0.42, 0.22, 0.56), 0xffffff, 1, M(0, 1.15, 0));
  add(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 6), 0xffffff, 2, M(0, 1.47, 0));
  add(new THREE.SphereGeometry(0.11, 8, 6), 0xffffff, 2, M(0, 1.6, 0.005));
  add(new THREE.SphereGeometry(0.118, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x2a1a12, 0, M(0, 1.615, -0.01, 0, -0.25));
  // arms + hands
  for (const sd of [-1, 1]) {
    const rz = armsUp ? sd * 2.75 : sd * 0.12, L = 0.58, sx = sd * 0.235, sy = 1.38;
    const ex = sx + Math.sin(rz) * L * 0.5, ey = sy - Math.cos(rz) * L * 0.5;
    add(new THREE.BoxGeometry(0.1, L, 0.11), 0xffffff, 1, M(ex, ey, 0, rz));
    const hx = sx + Math.sin(rz) * (L + 0.05), hy = sy - Math.cos(rz) * (L + 0.05);
    add(new THREE.BoxGeometry(0.075, 0.1, 0.08), 0xffffff, 2, M(hx, hy, 0, rz));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('part', new THREE.Float32BufferAttribute(A, 1));
  g.setAttribute('instSkin', new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(0.85), 3));
  g.computeBoundingSphere();
  return g;
}
function crowdMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float part;\nattribute vec3 instSkin;')
      .replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= part > 1.5 ? instSkin : (part > 0.5 ? instanceColor.xyz : vec3(1.0));');
  };
  m.customProgramCacheKey = () => 'pt-crowd-figure';
  return m;
}
