// The Old Schools Quadrangle (Bodleian, 1610-24). The mapped ranges are re-emitted through the world's own building
// emitter (same look as before, LANDMARKS still gives the mullioned three-storey stages and battlements) WITHOUT the old
// landmark's tower box that stuck into the quad; this module adds the parapet pinnacles back, the Tower of the Five
// Orders (_rad_fiveorders.js), the schools' doors with their names painted in gold, the Earl of Pembroke in bronze, and
// the Divinity School door in the Proscholium. build(ctx) -> { meshes, doors, pembroke, divinityDoor, dims }.
import { Batch, RB, frame, tudorPts, radSigns, signQuad, signsMesh, pip, SCHOOLS, emitRange, pack } from './_rad_kit.js';
import { geoOf } from './_rad_lod.js';
import * as Five from './_rad_fiveorders.js';

export const ID = 'r62123', TOWER_PART = 'w390903488';
export const PEMBROKE = [375.1, 106.7];
/** where the covered ways cross the ranges (no school door there) and the Proscholium */
const KEEP_CLEAR = [[393.0, 121.0], [383.0, 89.5], [404.4, 100.3], [371.3, 108.4]];
export const DIVINITY_DOOR = { pos: [372.2, 108.2], facing: Math.PI / 2 + 0.23 };

/** pure: the school doors round the quad: [{x, z, ax, az (along the wall), nx, nz (into the quad), name}] */
export function schoolDoors(map) {
  const b = map.buildings.find((q) => q.id === ID); if (!b || !b.holes) return [];
  const H = b.holes[0], out = [];
  for (let i = 0; i < H.length; i++) {
    const p = H[i], q = H[(i + 1) % H.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 5.5) continue;
    const ax = (q[0] - p[0]) / L, az = (q[1] - p[1]) / L;
    let nx = -az, nz = ax; const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
    if (!pip(mx + nx * 0.5, mz + nz * 0.5, H)) { nx = -nx; nz = -nz; }
    if (Math.abs(nx) > 0.8 && nx > 0) continue;                 // the west range: the open Proscholium, no schools
    const n = Math.max(1, Math.floor(L / 8));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
      if (KEEP_CLEAR.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 4)) continue;
      out.push({ x, z, ax, az, nx, nz });
    }
  }
  out.sort((u, v) => Math.atan2(u.x - 388, u.z - 105) - Math.atan2(v.x - 388, v.z - 105));
  return out.slice(0, SCHOOLS.length).map((d, i) => ({ ...d, name: SCHOOLS[i], i }));
}

export function build(ctx) {
  const { world, parent, map, lod } = ctx, P = pack(world);
  const out = { meshes: [], doors: [] };
  const b = map.buildings.find((q) => q.id === ID);
  const Bs = new Batch(), S = radSigns(world);
  const doors0 = schoolDoors(map);
  const L = { out: [new RB(), new RB(), new RB()], in: [new RB(), new RB(), new RB()] };
  // ---- the ranges: three storeys of great mullioned windows (K: 32 in the contract) under label moulds, string courses,
  // battlements and pinnacles; ground-floor windows give way to the school doors and the covered ways. Near: real
  // openings with reveals; mid: the same windows painted on; far: walls and windows only.
  const rangeOpts = (q) => ({ h: 17.6, storeys: [1.2, 4.6, 6.8, 10.4, 12.6, 16.2], win: 'mullion', winW: 2.3, bay: 3.6, strings: q < 2 ? [5.9, 11.7] : [], crenel: q < 2, pinnacles: q === 0 ? 7.5 : 0, bay0: 700,
    recess: q === 0 ? 0.3 : 0, hood: q === 0, wall: 'radHoney', dress: 'radPale',
    skipEdge: (p, r) => Math.hypot((p[0] + r[0]) / 2 - 404.35, (p[1] + r[1]) / 2 - 100.3) < 3.0,   // the Five Orders' quad face: the frontispiece
    skip: (x, z, s) => s === 0 && (doors0.some((d) => Math.hypot(d.x - x, d.z - z) < 2.2) || KEEP_CLEAR.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 2.6)) });
  if (b) for (let q = 0; q < 3; q++) {
    emitRange(L.out[q], [b.poly, ...(b.holes || [])], { ...rangeOpts(q), part: 'outer' });
    emitRange(L.in[q], [b.poly, ...(b.holes || [])], { ...rangeOpts(q), part: 'inner' });
  }
  // ---- the Tower of the Five Orders: quad face from the mapped part, the back on Catte Street
  const face = [[403.3, 96.0], [405.4, 104.6]], back = [[412.9, 102.9], [410.8, 94.1]];
  const five = Five.build({ front: L.in, block: L.out, face, back });
  out.five = five.dims;
  // ---- the schools' doors (blue, under a stone label) and their painted names
  const doors = schoolDoors(map);
  for (const d of doors) {
    const s = (-d.az * d.nx + d.ax * d.nz) > 0 ? 1 : -1;          // local +z is (-az, ax): into the quad when s > 0
    for (let q = 0; q < 2; q++) {
      const B = L.in[q];
      B.push(frame(d.x, 0, d.z, d.ax * s, d.az * s));
      B.unit('doorNavy', tudorPts(0, 1.5, 0, 2.3, 0.35, q === 0 ? 8 : 4), 0.06, [0, 0]);
      if (q === 0) {
        for (const sx of [-1, 1]) B.box('radPale', sx * 0.88, 1.35, 0.08, 0.24, 2.7, 0.16, 0, { top: true });
        B.box('radPale', 0, 2.75, 0.12, 2.1, 0.16, 0.24, 0, { bottom: true, top: true });     // label course over the door
        B.box('radPale', 0, 3.25, 0.06, 2.7, 0.75, 0.1, 0, { top: true, bottom: true });     // the board's stone frame
      }
      B.pop();
    }
    const ex = d.ax * 1.25, ez = d.az * 1.25, ox = d.x + d.nx * 0.12, oz = d.z + d.nz * 0.12;
    // the board reads left-to-right seen from the quad: left = -along when the normal turns the other way
    const Ls = (d.ax * d.nz - d.az * d.nx) > 0 ? -1 : 1;
    signQuad(Bs, S.uv('school' + d.i), ox - ex * Ls, oz - ez * Ls, ox + ex * Ls, oz + ez * Ls, 2.95, 3.55, d.nx, d.nz, 0.0);
    out.doors.push(d);
  }
  // ---- the Earl of Pembroke (bronze after Rubens, 1723) on a pedestal in front of the Proscholium, facing the tower
  {
    const [x, z] = PEMBROKE, h = Math.atan2(404.4 - x, 100.3 - z);
    const F = frame(x, 0, z, Math.cos(h), -Math.sin(h));            // local +z = facing
    for (let q = 0; q < 2; q++) {
      const B = L.in[q];
      B.push(F);
      B.box('radPale', 0, 0.2, 0, 1.6, 0.4, 1.6, 0, { top: true }); B.box('radPale', 0, 1.15, 0, 1.15, 1.5, 1.15, 0, { top: false }); B.box('radPale', 0, 2.0, 0, 1.35, 0.2, 1.35, 0, { top: true, bottom: true });
      B.box('radBronze', 0, 2.15, 0, 0.9, 0.1, 0.9);
      const sg = q === 0 ? 8 : 5;
      for (const s of [-1, 1]) B.lathe('radBronze', s * 0.13, 0.02, [[0.11, 2.2], [0.1, 2.5], [0.12, 2.75], [0.1, 2.95], [0.0, 2.95]], { seg: sg });                    // boots and legs
      B.lathe('radBronze', 0, 0, [[0.0, 2.85], [0.3, 2.88], [0.36, 3.05], [0.3, 3.2], [0.24, 3.3], [0.27, 3.55], [0.26, 3.72], [0.16, 3.78], [0.0, 3.8]], { seg: sg });     // trunk hose, doublet
      B.lathe('bronzeLt', 0, 0, [[0.0, 3.76], [0.2, 3.78], [0.23, 3.84], [0.1, 3.88], [0, 3.88]], { seg: sg });                                                         // the ruff
      B.lathe('radBronze', 0, 0.02, [[0.0, 3.86], [0.08, 3.88], [0.12, 3.96], [0.11, 4.1], [0.06, 4.17], [0, 4.18]], { seg: sg });                                       // head
      B.lathe('radBronze', 0, -0.2, [[0.38, 2.4], [0.34, 3.0], [0.3, 3.6], [0.2, 3.78], [0, 3.8]], { seg: sg, a0: Math.PI / 2, a1: Math.PI * 1.5 });                     // the cloak behind
      B.beam('radBronze', [0.3, 3.6, 0], [0.42, 3.15, 0.3], 0.1, 0.1); B.beam('radBronze', [0.42, 3.15, 0.3], [0.5, 3.45, 0.75], 0.05, 0.05);   // arm + baton
      B.beam('radBronze', [-0.3, 3.6, 0], [-0.4, 3.05, 0.05], 0.1, 0.1);
      B.pop();
    }
    out.pembroke = { x, z, r: 1.0 };
  }
  // ---- the Divinity School door in the Proscholium (west range) with its notice
  {
    const [x, z] = DIVINITY_DOOR.pos, f = DIVINITY_DOOR.facing, ax = Math.cos(f), az = -Math.sin(f);
    // (the walk-in room's real door is punched over this painted one, the same four-centred shape — radcliffe_square.js dresses its stone case)
    for (let q = 0; q < 2; q++) { const B = L.in[q]; B.push(frame(x - Math.sin(f) * 0.9, 0, z - Math.cos(f) * 0.9, ax, az)); B.unit('archDoorOak', tudorPts(0, 1.8, 0, 2.6, 0.45, 8), 0.05, [0, 0]); B.pop(); }
    const nx = Math.sin(f), nz = Math.cos(f), bx = x - nx * 0.82 + ax * 1.7, bz = z - nz * 0.82 + az * 1.7;
    signQuad(Bs, S.uv('divinity'), bx - ax * 0.5, bz - az * 0.5, bx + ax * 0.5, bz + az * 0.5, 1.3, 1.8, nx, nz, 0.02);
  }
  // ---- register: outside faces by 48 m cell; the quad's own faces only when you can see into the quad (inside it, near
  // one of its covered ways, or above the roofs)
  const hole = b && b.holes && b.holes[0];
  const ways = [[393.6, 131.5], [415.0, 98.1], [382.9, 77.5], [393.0, 121.0], [383.0, 89.5], [404.4, 100.3]];
  const need = (cam) => { const p = cam.position; if (p.y > 15 || (hole && pip(p.x, p.z, hole))) return true; for (const [x, z] of ways) if (Math.hypot(p.x - x, p.z - z) < 22) return true; return false; };
  lod.cells('bodleian', L.out.map((B) => geoOf(B, P)), [70, 170, 1100]);
  lod.cells('bodleian:quad', L.in.map((B) => geoOf(B, P)), [70, 170, 700], { need });
  out.meshes.push(...signsMesh(Bs, world, parent, 'bodleian'));
  out.dims = { five: five.dims, doors: doors.length };
  return out;
}
