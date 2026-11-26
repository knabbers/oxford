// Christ Church — Tom Quad (showpiece): the raised terrace walk (Chantrey, 1842) round the sunken lawn, the step
// flights (at the mapped steps), the round stone basin of Mercury (1670) with the statue on Lutyens's pedestal (1935),
// lily pads and koi, the springers of Wolsey's unbuilt cloister on the walls, the lamp brackets. Plain massing for a
// later fine-detail pass. Facts: docs/research/christ_church_botanic_magdalen.md §1.
//
// The world is flat, so the lawn cannot sink: the TERRACE is raised (TERRACE_Y) and the lawn stays at ground level;
// heightAt(x, z) gives the terrace / steps / ramps at the entrances (null elsewhere: the world's height).
//
//   QUAD                         local frame + extents (pure data)
//   lawnLocal(), inQuad(x,z), onLawn(x,z), onLawnPath(x,z, paths)  pure tests (also tools/smoke_southeast.mjs)
//   heightAt(x, z)               terrace height or null
//   build(ctx) -> { meshes, koi, update(dt, camPos, nowMs), colliders: [[x1,z1,x2,z2], …], stats }
import * as THREE from 'three';
import { Batch, localFrame, prism, lathe, rectPts, hh } from './_chch_kit.js';
import { buildFine, AIR_FAR, ribStrip, tracery, hoodMould, pinnacle, crenelFine } from './_se_fine.js';

export const TERRACE_Y = 0.62;
// The walk-in rooms (the Hall's stair, the Cathedral's passage) open on the terrace: their floors are one small step
// (4 cm) above it. HALL_FLOOR = the Hall's floor above the ground (the stair climbs 3.3 m: _chch_hall.js JOIN.TOP).
export const ROOM_Y = TERRACE_Y + 0.04, HALL_FLOOR = ROOM_Y + 3.3;
// The Hall's side windows, the SAME outside (hallFront) and inside (_chch_hall.js): width, and sill / springing / rise
// above the Hall's floor. A Perpendicular head: straight shoulders to a low point.
export const HALL_WIN = { w: 2.5, sill: 5.0, spring: 8.4, rise: 1.4, transom: 1.8 };
/** the outline of such a window, centre c, from `sill` up (7 points, anticlockwise from the lower left) */
export function hallWinPts(c, w, sill, spring, rise) { const h = w / 2; return [[c - h, sill], [c + h, sill], [c + h, spring], [c + h * 0.56, spring + rise * 0.69], [c, spring + rise], [c - h * 0.56, spring + rise * 0.69], [c - h, spring]]; }
export const QUAD = {
  o: [284.2, 526.8], dir: [0.9966, -0.0826],            // origin on Mercury, u along the north range (east), v south
  outer: [-41.5, 42.0, -43.5, 38.7],                     // the paved quad (mapped w60860874) in u/v
  lawn: [-38.4, 37.1, -39.0, 34.2],                      // the lawn = foot of the terrace wall (mapped step heads)
  steps: [                                               // [u, v, axis 'u'|'v' (the direction you walk down), sign into the lawn]
    [-10, -39, 'v', 1], [0, -39, 'v', 1], [9.6, -39, 'v', 1], [-9.9, 34.2, 'v', -1], [0.1, 34.2, 'v', -1], [9.6, 34.2, 'v', -1],
    [-38.4, -8.4, 'u', 1], [-38.4, 8.0, 'u', 1], [37.1, -7.45, 'u', -1], [37.1, 6.85, 'u', -1],
    // (guess) a flight at each of the two visitors' doors: opposite the Cathedral's door in the east range, and at the
    // south-east corner for the Hall stair — so that both are reached straight across the lawn's paths
    [37.1, 26.1, 'u', -1], [35.4, 34.2, 'v', -1],
  ],
  stepW: 2.4, stepL: 2.6,
  // doorways onto the terrace (world x, z): ground level at the door, ramp up over RAMP m. A third entry `true` = a
  // walk-in room's door AT terrace level (the Hall stair, the Cathedral): no ramp, the terrace runs flat to the door.
  entries: [[243.6, 530.2], [324.6, 561.6, true], [327.3, 549.4, true], [320.0, 480.6], [271.0, 487.6], [290.2, 485.6], [242.0, 489.0]],
  pond: { r: 6.05, rim: 0.55, rimH: 0.5 },
  // the Hall (mapped w146575301) closes the quad's south side: its north face, wall head, bay count (guess: 8 windows)
  hall: { a: [313.4, 563.2], b: [277.1, 566.3], s: [[278.5, 582.0], [314.7, 578.6]], head: 17.5, bays: 8, sill: HALL_FLOOR + HALL_WIN.sill, spring: HALL_FLOOR + HALL_WIN.spring, rise: HALL_WIN.rise, w: HALL_WIN.w },
};
const RAMP = 2.6;
export const F = localFrame(QUAD.o, QUAD.dir);

export function inQuad(x, z) { const [u, v] = F.toL(x, z), O = QUAD.outer; return u > O[0] && u < O[1] && v > O[2] && v < O[3]; }
export function onLawn(x, z) { const [u, v] = F.toL(x, z), L = QUAD.lawn; return u > L[0] && u < L[1] && v > L[2] && v < L[3] && Math.hypot(u, v) > QUAD.pond.r + QUAD.pond.rim; }
/** is (x, z) on one of the gravel paths that cross the lawn (map footways inside the lawn), within 1.3 m */
export function onLawnPath(x, z, paths) {
  for (const pts of paths) for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; let t = l2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 1.3) return true;
  }
  return false;
}
/** the footways of the map that lie on the lawn (the circle and the cross) */
export function lawnPaths(map) {
  const out = [];
  for (const r of map.roads) if ((r.kind === 'footway' || r.kind === 'path') && r.pts.length >= 2 && r.pts.every(([x, z]) => { const [u, v] = F.toL(x, z), L = QUAD.lawn; return u > L[0] - 1 && u < L[1] + 1 && v > L[2] - 1 && v < L[3] + 1; })) out.push(r.pts);
  return out;
}
/** terrace / step / ramp height at (x, z), or null (lawn, outside) */
export function heightAt(x, z) {
  const [u, v] = F.toL(x, z), O = QUAD.outer, L = QUAD.lawn;
  if (u < O[0] - 0.5 || u > O[1] + 0.5 || v < O[2] - 0.5 || v > O[3] + 0.5) return null;
  // step flights first (they stand on the lawn, against the terrace wall)
  for (const [su, sv, ax, sg] of QUAD.steps) {
    const along = ax === 'v' ? (v - sv) * sg : (u - su) * sg, lat = ax === 'v' ? u - su : v - sv;
    if (Math.abs(lat) < QUAD.stepW / 2 && along >= -0.05 && along < QUAD.stepL) return 0.03 + (TERRACE_Y - 0.03) * Math.max(0, Math.min(1, 1 - Math.floor((along / QUAD.stepL) * 4 + 0.5) / 4));
  }
  if (u > L[0] && u < L[1] && v > L[2] && v < L[3]) return null;          // the lawn (and the pond)
  let h = TERRACE_Y;
  for (const [ex, ez, flat] of QUAD.entries) { if (flat) continue; const d = Math.hypot(x - ex, z - ez); if (d < RAMP) h = Math.min(h, TERRACE_Y * Math.max(0, d / RAMP)); }
  return Math.max(0.02, h);
}
export const lawnLocal = () => QUAD.lawn.slice();

/** Mercury (after Giambologna): poised on the ball of one foot on a puff of wind, the other leg trailing, one arm
 *  raised with a finger to the sky, the caduceus in the other hand, a winged hat. Base at (0, y, 0), facing +z. */
function mercury(B, key, y, h, lite) {
  const s = h / 1.75, P = (x, yy, z) => [x * s, y + yy * s, z * s];
  const limb = (a, b, w0) => B.beam(key, P(...a), P(...b), w0 * s, w0 * s);
  // the supporting leg (on its toes), the trailing leg bent up behind
  limb([0.07, 0.0, 0.02], [0.07, 0.1, -0.03], 0.07); limb([0.07, 0.1, -0.03], [0.09, 0.54, 0.05], 0.085); limb([0.09, 0.54, 0.05], [0.09, 1.0, 0.03], 0.125);
  limb([-0.09, 1.0, 0.03], [-0.12, 0.66, -0.2], 0.12); limb([-0.12, 0.66, -0.2], [-0.1, 0.8, -0.62], 0.08); limb([-0.1, 0.8, -0.62], [-0.1, 0.72, -0.78], 0.06);
  // hips, the torso leaning into the run, neck and head tilted up
  B.beam(key, P(0, 0.96, 0.03), P(0, 1.2, 0.07), 0.3 * s, 0.19 * s); B.beam(key, P(0, 1.2, 0.07), P(0, 1.46, 0.12), 0.36 * s, 0.2 * s);
  limb([0, 1.46, 0.12], [0, 1.56, 0.13], 0.08);
  lathe(B, key, 0, 0.14 * s, [[0.04 * s, y + 1.52 * s], [0.1 * s, y + 1.58 * s], [0.105 * s, y + 1.68 * s], [0.07 * s, y + 1.75 * s]], lite ? 5 : 8, 0);
  // the winged hat
  lathe(B, key, 0, 0.14 * s, [[0.15 * s, y + 1.72 * s], [0.1 * s, y + 1.76 * s], [0.08 * s, y + 1.82 * s], [0, y + 1.85 * s]], lite ? 5 : 8, 0);
  // the raised arm, finger pointing up; the other arm carrying the caduceus forward
  limb([-0.2, 1.42, 0.11], [-0.27, 1.7, 0.16], 0.075); limb([-0.27, 1.7, 0.16], [-0.2, 1.98, 0.22], 0.06); limb([-0.2, 1.98, 0.22], [-0.19, 2.12, 0.24], 0.025);
  limb([0.2, 1.42, 0.11], [0.33, 1.17, 0.08], 0.075); limb([0.33, 1.17, 0.08], [0.35, 1.02, 0.3], 0.06);
  limb([0.35, 0.9, 0.14], [0.37, 1.34, 0.72], 0.025);
  if (lite) return;
  for (const sd of [-1, 1]) {
    B.poly(key, [P(sd * 0.09, 1.76, 0.12), P(sd * 0.26, 1.9, 0.02), P(sd * 0.12, 1.84, 0.16)], [0, 0, 1]); B.poly(key, [P(sd * 0.09, 1.76, 0.12), P(sd * 0.12, 1.84, 0.16), P(sd * 0.26, 1.9, 0.02)], [0, 0, -1]);   // hat wings
    B.poly(key, [P(0.07 + sd * 0.04, 0.1, -0.04), P(0.07 + sd * 0.13, 0.26, -0.14), P(0.07 + sd * 0.04, 0.2, -0.02)], [sd, 0, 0]); B.poly(key, [P(0.07 + sd * 0.04, 0.1, -0.04), P(0.07 + sd * 0.04, 0.2, -0.02), P(0.07 + sd * 0.13, 0.26, -0.14)], [-sd, 0, 0]);   // ankle wings
    B.poly(key, [P(0.37, 1.3, 0.66), P(0.37 + sd * 0.14, 1.4, 0.66), P(0.37, 1.36, 0.74)], [0, 0, 1]); B.poly(key, [P(0.37, 1.3, 0.66), P(0.37, 1.36, 0.74), P(0.37 + sd * 0.14, 1.4, 0.66)], [0, 0, -1]);                   // the caduceus's wings
  }
  B.beam(key, P(0.2, 1.36, 0.1), P(-0.05, 1.05, 0.2), 0.03 * s, 0.1 * s);                                                                // a fold of drapery
}

function make(Q, lite) {
  const Y = TERRACE_Y, L = Q.lawn, O = Q.outer;
  const B = new Batch();
  B.push(F.matrix());
  // ---- terrace: flagged walk over the quad minus the lawn, the terrace wall (ashlar) with a moulded coping, the step flights
  const outer = rectPts(O[0], O[2], O[1], O[3]).map(([a, b]) => [a, b]), lawn = rectPts(L[0], L[2], L[1], L[3]);
  B.flat('flagsWarm', outer, Y, [lawn]);
  const edges = [[L[0], L[2], L[1], L[2]], [L[1], L[2], L[1], L[3]], [L[1], L[3], L[0], L[3]], [L[0], L[3], L[0], L[2]]];
  for (const [x0, z0, x1, z1] of edges) {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    B.box('stone', (x0 + x1) / 2, Y / 2 - 0.04, (z0 + z1) / 2, len, Y - 0.08, 0.12, ry, { top: false });
    B.box('mouldPale', (x0 + x1) / 2, Y - 0.02, (z0 + z1) / 2, len + 0.5, 0.13, 0.62, ry, { bottom: true });
    if (!lite) B.box('mould', (x0 + x1) / 2, Y - 0.13, (z0 + z1) / 2, len + 0.3, 0.09, 0.36, ry, { bottom: true });
  }
  for (const [su, sv, ax, sg] of Q.steps) {
    for (let k = 0; k < 4; k++) {
      const a0 = (k / 4) * Q.stepL - (lite ? 0 : 0.04), a1 = ((k + 1) / 4) * Q.stepL, top = Y - (k / 4) * (Y - 0.03) - (Y - 0.03) / 8;
      if (ax === 'v') B.boxXZ('mouldPale', su - Q.stepW / 2, su + Q.stepW / 2, 0, top, sv + sg * a0, sv + sg * a1);
      else B.boxXZ('mouldPale', su + sg * a0, su + sg * a1, 0, top, sv - Q.stepW / 2, sv + Q.stepW / 2);
    }
    // cheek walls with a coping and a ball at the foot
    for (const s of [-1, 1]) {
      if (ax === 'v') B.boxXZ('stone', su + s * (Q.stepW / 2) - 0.14, su + s * (Q.stepW / 2) + 0.14, 0, Y + 0.12, Math.min(sv, sv + sg * Q.stepL), Math.max(sv, sv + sg * Q.stepL));
      else B.boxXZ('stone', Math.min(su, su + sg * Q.stepL), Math.max(su, su + sg * Q.stepL), 0, Y + 0.12, sv + s * (Q.stepW / 2) - 0.14, sv + s * (Q.stepW / 2) + 0.14);
      if (!lite) { const bu = ax === 'v' ? su + s * Q.stepW / 2 : su + sg * (Q.stepL - 0.16), bv = ax === 'v' ? sv + sg * (Q.stepL - 0.16) : sv + s * Q.stepW / 2; lathe(B, 'mouldPale', bu, bv, [[0.2, Y + 0.12], [0.2, Y + 0.2], [0.1, Y + 0.24], [0.18, Y + 0.4], [0, Y + 0.56]], 6, 0); }
    }
  }
  // ---- Mercury: the round basin (moulded stone kerb), Lutyens's pedestal, the statue (dark bronze)
  const P = Q.pond, NS = lite ? 20 : 40;
  lathe(B, 'stone', 0, 0, [[P.r + P.rim + 0.12, 0], [P.r + P.rim + 0.12, 0.12], [P.r + P.rim, 0.18], [P.r + P.rim, P.rimH - 0.14], [P.r + P.rim + 0.08, P.rimH - 0.06], [P.r + P.rim + 0.08, P.rimH], [P.r - 0.06, P.rimH], [P.r - 0.06, P.rimH - 0.1], [P.r, P.rimH - 0.14], [P.r, -0.3]].filter((_, i) => !lite || ![1, 2, 4, 7, 8].includes(i)), NS, 0);
  lathe(B, 'stonePale', 0, 0, [[1.5, -0.2], [1.5, 0.3], [1.3, 0.42], [1.02, 0.5], [0.8, 0.62], [0.62, 0.9], [0.56, 1.5], [0.6, 1.68], [0.84, 1.84], [1.0, 1.96], [1.0, 2.1], [0.7, 2.16], [0, 2.16]].filter((_, i) => !lite || i % 2 === 0), lite ? 8 : 16, 0);   // pedestal (guess)
  lathe(B, 'bronze', 0, 0, [[0.34, 2.16], [0.36, 2.3], [0.22, 2.42], [0, 2.44]], lite ? 6 : 10, 0);                                    // the puff of wind he stands on
  B.push(new THREE.Matrix4().makeRotationY(Math.PI * 0.85)); mercury(B, 'bronze', 2.42, 1.8, lite); B.pop();
  if (!lite) {
    // lily pads (notched discs) and a few flowers
    for (let i = 0; i < 30; i++) {
      const a = hh(i, 3, 7) * Math.PI * 2, r = 1.9 + Math.sqrt(hh(i, 5, 1)) * (P.r - 2.4), cx = Math.sin(a) * r, cz = Math.cos(a) * r, pr = 0.2 + hh(i, 9, 2) * 0.24, notch = hh(i, 4, 4) * 6.28, key = i % 3 ? 'padGreen' : 'leaf';
      for (let k = 0; k < 9; k++) { const b0 = notch + 0.3 + (k / 9) * (Math.PI * 2 - 0.6), b1 = notch + 0.3 + ((k + 1) / 9) * (Math.PI * 2 - 0.6); B.tri(key, [cx, 0.05, cz], [cx + Math.sin(b0) * pr, 0.05, cz + Math.cos(b0) * pr], [cx + Math.sin(b1) * pr, 0.05, cz + Math.cos(b1) * pr], [0, 0], [0, 0], [0, 0]); }
      if (i % 5 === 0) { lathe(B, i % 10 ? 'flowerPink' : 'flowerWhite', cx + 0.05, cz + 0.05, [[0.03, 0.05], [0.11, 0.1], [0.07, 0.17], [0, 0.19]], 6, 0); }
    }
  }
  // ---- the springers of Wolsey's unbuilt cloister: wall shafts with capitals, the first stones of the vault ribs, and
  //      the wall arches traced on the ranges between them; an iron lamp bracket on every other one
  const wallsL = [[O[0] + 0.1, O[2] + 0.1, O[1] - 0.1, O[2] + 0.1, 0, 1], [O[1] - 0.1, O[2] + 0.1, O[1] - 0.1, O[3] - 0.1, -1, 0], [O[0] + 0.1, O[3] - 0.1, O[1] - 0.1, O[3] - 0.1, 0, -1], [O[0] + 0.1, O[2] + 0.1, O[0] + 0.1, O[3] - 0.1, 1, 0]];
  const nearEntry = (u, v) => Q.entries.some(([ex, ez]) => { const [eu, ev] = F.toL(ex, ez); return Math.hypot(eu - u, ev - v) < 3.2; });
  const springers = [], SH = 3.9;
  for (const [x0, z0, x1, z1, nx, nz] of wallsL) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 6.2), bayL = len / n, tx = (x1 - x0) / len, tz = (z1 - z0) / len;
    let prev = false;
    for (let i = 1; i < n; i++) {
      const t = i / n, u = x0 + (x1 - x0) * t, v = z0 + (z1 - z0) * t;
      const skip = nearEntry(u, v) || (nz === 0 && nx > 0 && Math.abs(v - 0.5) < 6);     // not across a doorway or Tom Gate
      if (!skip) {
        springers.push([u, v, nx, nz]);
        const ang = Math.atan2(nx, nz);
        if (lite) { B.box('stone', u + nx * 0.16, Y + SH / 2, v + nz * 0.16, nz ? 0.4 : 0.32, SH, nx ? 0.4 : 0.32, 0, { top: false }); B.box('stone', u + nx * 0.5, Y + SH + 0.45, v + nz * 0.5, nz ? 0.46 : 1.0, 0.9, nx ? 0.46 : 1.0); }
        else {
          B.box('mould', u + nx * 0.2, Y + 0.3, v + nz * 0.2, nz ? 0.56 : 0.44, 0.6, nx ? 0.56 : 0.44);                                  // base
          prism(B, 'stonePale', u + nx * 0.14, v + nz * 0.14, 0.21, Y + 0.6, Y + SH, 8, { rot: ang + Math.PI / 8, cap: false });           // shaft
          lathe(B, 'mould', u + nx * 0.14, v + nz * 0.14, [[0.21, Y + SH - 0.1], [0.34, Y + SH + 0.1], [0.36, Y + SH + 0.28]], 8, ang + Math.PI / 8);   // capital
          // the first voussoirs of three ribs, fanning out and curving up, cut off short
          for (const da of [-0.75, 0, 0.75]) { const dx = Math.sin(ang + da), dz = Math.cos(ang + da), pts = []; for (let k = 0; k <= 3; k++) { const q = k / 3, rr = 0.2 + 1.15 * (1 - Math.cos(q * 1.1)) / (1 - Math.cos(1.1)), yy = Y + SH + 0.28 + 1.5 * Math.sin(q * 1.1) / Math.sin(1.1); pts.push([u + nx * 0.14 + dx * rr, yy, v + nz * 0.14 + dz * rr]); } const up = [dx * 0.5, -0.85, dz * 0.5]; ribStrip(B, 'stonePale', pts, () => up, 0.16); B.poly('stonePale', [pts[3], [pts[3][0] + dz * 0.16, pts[3][1], pts[3][2] - dx * 0.16], [pts[3][0] + up[0] * 0.16, pts[3][1] + up[1] * 0.16, pts[3][2] + up[2] * 0.16]], [dx, 0.3, dz]); }
        }
      }
      // the wall arch (formeret) of the bay that ends here
      if (!lite && !skip && prev) { const pts = []; for (let k = 0; k <= 8; k++) { const q = k / 8, kk = 1 - Math.abs(2 * q - 1), s = -bayL + q * bayL; pts.push([u + tx * s + nx * 0.07, Y + SH + 0.3 + 1.7 * (1 - Math.pow(1 - kk, 2.2)), v + tz * s + nz * 0.07]); } ribStrip(B, 'mould', pts, () => [nx, 0, nz], 0.1); }
      prev = !skip;
    }
  }
  if (!lite) for (let i = 0; i < springers.length; i += 2) {
    const [u, v, nx, nz] = springers[i], x = u + nx * 0.7, z = v + nz * 0.7, y = Y + 2.75;
    B.beam('iron', [u + nx * 0.3, y + 0.5, v + nz * 0.3], [x, y + 0.5, z], 0.04, 0.04);
    B.box('lampGlow', x, y + 0.2, z, 0.2, 0.4, 0.2, 0, { top: false }); lathe(B, 'iron', x, z, [[0.17, y + 0.45], [0.05, y + 0.6], [0, y + 0.66]], 4, Math.PI / 4);
  }
  hallFront(B, lite);
  B.pop();
  return { B, springers };
}

/** the Hall's north front over the quad (the world draws its plain walls; map id w146575301 restyled blank in
 *  christ_church.js): eight tall three-light Perpendicular windows between buttresses that end in pinnacles above the
 *  battlements; the same, plainer, to the south; the louvre on the ridge. Batch in the QUAD frame. */
function hallFront(B, lite) {
  // (the windows are walk-in openings of the Hall, core/interiors.js: each is punched as its bounding rectangle a little in
  //  front of the painted glass — christ_church.js `proud` 0.08 / 0.33 — so the stone above the shoulders of the head is
  //  drawn here, in front of the punch, and the tracery in front of that)
  const Hh = QUAD.hall, faces = [[Hh.a, Hh.b, 0.05, false], [Hh.s[0], Hh.s[1], 0.3, true]];
  for (const [aw, bw, off, plain] of faces) {
    const a = F.toL(aw[0], aw[1]), b = F.toL(bw[0], bw[1]), L = Math.hypot(b[0] - a[0], b[1] - a[1]), ax = (b[0] - a[0]) / L, az = (b[1] - a[1]) / L, simple = lite || plain;
    B.push(new THREE.Matrix4().makeBasis(new THREE.Vector3(ax, 0, az), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-az, 0, ax)).setPosition(a[0], 0, a[1]));
    const bw2 = L / Hh.bays;
    for (let i = 0; i < Hh.bays; i++) {
      const c = (i + 0.5) * bw2, hw = Hh.w / 2, top = Hh.spring + Hh.rise, pts = hallWinPts(c, Hh.w, Hh.sill, Hh.spring, Hh.rise);
      B.face(i % 3 === 1 ? 'winDim' : 'win', pts, [], off);
      for (const sg of [-1, 1]) B.face('stone', sg > 0 ? [pts[2], [c + hw, top], [c, top], pts[3]] : [pts[6], pts[5], [c, top], [c - hw, top]], [], off + 0.085);
      if (lite) { for (const k of [-1, 1]) B.box('mouldPale', c + k * Hh.w / 6, (Hh.sill + Hh.spring) / 2 + 0.3, off + 0.11, 0.12, Hh.spring - Hh.sill + 0.6, 0.1); B.box('mouldPale', c, Hh.sill + HALL_WIN.transom, off + 0.11, Hh.w, 0.12, 0.1); continue; }
      B.push(new THREE.Matrix4().makeTranslation(0, 0, off + 0.39)); tracery(B, pts, { open: true, noReveal: true, lights: 3, transoms: [Hh.sill + HALL_WIN.transom], headY: Hh.spring, d: 0.35, zb: -0.4, bar: 'mouldPale', bw: 0.12, cusp: 2, lite: plain }); B.pop();
      hoodMould(B, pts, { w: 0.2, d: 0.16, key: 'mouldPale', fromY: Hh.sill - 0.3, z: off - 0.02 });
    }
    for (let i = 0; i <= Hh.bays; i++) {
      const c = Math.min(L - 0.35, Math.max(0.35, i * bw2));
      B.box('stone', c, 11.4, off + 0.3, 0.7, 9.6, 0.6, 0, { top: false }); B.poly('mould', [[c - 0.35, 16.2, off + 0.6], [c + 0.35, 16.2, off + 0.6], [c + 0.35, 16.9, off], [c - 0.35, 16.9, off]], [0, 1, 1]);
      if (!simple) B.box('mould', c, 11.6, off + 0.33, 0.78, 0.2, 0.66);
      pinnacle(B, c, Hh.head + 0.3, off + 0.1, { w: 0.5, shaft: 0.9, spire: 2.1, lite: simple });
    }
    B.box('mould', L / 2, Hh.head - 0.5, off + 0.1, L, 0.3, 0.3, 0, { bottom: true }); B.box('mould', L / 2, Hh.sill - 0.5, off + 0.06, L, 0.22, 0.2, 0, { bottom: true });
    crenelFine(B, 0, off - 0.1, L, off - 0.1, Hh.head - 0.2, { lite: true, mw: 0.9, gap: 0.65, h: 0.65, base: 0.5, t: 0.4 });
    B.pop();
  }
  // the louvre lantern on the ridge
  const c = F.toL(295.9, 572.6); lathe(B, 'lead', c[0], c[1], [[0.9, 19.0], [0.9, 21.2], [1.1, 21.3], [1.1, 21.5], [0.5, 22.3], [0.12, 23.9], [0, 24.6]], 8);
}

export function build(ctx) {
  const { parent, world } = ctx, Q = QUAD, Y = TERRACE_Y, L = Q.lawn;
  const N = make(Q, false), FAR = make(Q, true), springers = N.springers;
  const near = buildFine(N.B, world, parent, 'chch:tomquad:near'), far = buildFine(FAR.B, world, parent, 'chch:tomquad:far', { cast: false });
  near.visible = false;
  const meshes = [near, far], lod = { near, far, c: Q.o, r: 78, rFar: 236, airFar: AIR_FAR, minScale: 0.85, gate: (x, z) => { const [u, v] = F.toL(x, z), O = Q.outer; return u > O[0] - 11 && u < O[1] + 3 && v > O[2] - 3 && v < O[3] + 3; } };   // near only from inside the quad (or looking in through Tom Gate)
  // lamp brackets (11 on the listing): a glow on every other springer
  for (let i = 0; i < springers.length; i += 2) { const [u, v, nx, nz] = springers[i]; const [x, z] = F.toW(u + nx * 0.7, v + nz * 0.7); world.addLampGlow(x, Y + 2.95, z); }
  // ---- koi: one instanced draw, positions from the shared clock (same for everyone), updated only when near
  const koiGeo = new THREE.ConeGeometry(0.09, 0.5, 6); koiGeo.rotateX(Math.PI / 2);
  const koiMat = new THREE.MeshStandardMaterial({ color: 0xf08a2a, roughness: 0.5 });
  const NK = 7, koi = new THREE.InstancedMesh(koiGeo, koiMat, NK); koi.name = 'chch:tomquad:koi'; koi.castShadow = false; koi.frustumCulled = false; koi.visible = false;
  const tints = [0xf08a2a, 0xf4f0e8, 0xe04a20, 0xf6c040, 0xf08a2a, 0xffffff, 0xc83a18];
  for (let i = 0; i < NK; i++) koi.setColorAt(i, new THREE.Color(tints[i]));
  parent.add(koi);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const [pcx, pcz] = Q.o;
  function koiAt(i, tMs, out) {
    const t = tMs / 1000, w = (0.12 + 0.05 * hh(i, 2)) * (i % 2 ? 1 : -1), r = 2.2 + 2.6 * hh(i, 7) + 0.4 * Math.sin(t * 0.3 + i);
    const a = t * w + i * 1.7; out[0] = pcx + Math.sin(a) * r; out[1] = pcz + Math.cos(a) * r; out[2] = a + (w > 0 ? Math.PI / 2 : -Math.PI / 2);
    return out;
  }
  const tmp = [0, 0, 0];
  function update(dt, cam, nowMs, outdoors) {
    const near = outdoors && Math.hypot(cam.x - pcx, cam.z - pcz) < 55;
    if (near !== koi.visible) koi.visible = near;
    if (!near) return;
    for (let i = 0; i < NK; i++) { koiAt(i, nowMs, tmp); q.setFromAxisAngle(up, tmp[2]); pos.set(tmp[0], -0.06, tmp[1]); M.compose(pos, q, one); koi.setMatrixAt(i, M); }
    koi.instanceMatrix.needsUpdate = true;
  }
  // colliders: the terrace wall along the lawn edges with gaps at the step flights; the flights' cheeks; the pond kerb is the water
  const colliders = [];
  const gapsOn = (edgeAxis, fixed) => Q.steps.filter(([su, sv, ax]) => (edgeAxis === 'u' ? ax === 'v' && Math.abs(sv - fixed) < 0.1 : ax === 'u' && Math.abs(su - fixed) < 0.1)).map(([su, sv]) => (edgeAxis === 'u' ? su : sv)).sort((a, b) => a - b);
  const seg = (u0, v0, u1, v1) => { const a = F.toW(u0, v0), b = F.toW(u1, v1); colliders.push([a[0], a[1], b[0], b[1]]); };
  for (const [fixed, axis] of [[L[2], 'u'], [L[3], 'u'], [L[0], 'v'], [L[1], 'v']]) {
    const lo = axis === 'u' ? L[0] : L[2], hi = axis === 'u' ? L[1] : L[3];
    let s = lo;
    for (const c of gapsOn(axis, fixed)) { const e = c - Q.stepW / 2; if (e > s) axis === 'u' ? seg(s, fixed, e, fixed) : seg(fixed, s, fixed, e); s = c + Q.stepW / 2; }
    axis === 'u' ? seg(s, fixed, hi, fixed) : seg(fixed, s, fixed, hi);
  }
  for (const [su, sv, ax, sg] of Q.steps) for (const s of [-1, 1]) {
    if (ax === 'v') seg(su + s * Q.stepW / 2, sv, su + s * Q.stepW / 2, sv + sg * Q.stepL); else seg(su, sv + s * Q.stepW / 2, su + sg * Q.stepL, sv + s * Q.stepW / 2);
  }
  const tris = near.geometry.attributes.position.count / 3;
  return { meshes, lod, koi, update, colliders, koiAt, stats: { tris, trisFar: far.geometry.attributes.position.count / 3, springers: springers.length, draws: 2 } };
}
