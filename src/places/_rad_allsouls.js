// All Souls from Radcliffe Square: Hawksmoor's North Quad (from 1716) — the cloister screen along Catte Street lowered to
// a single storey (it was drawn 14 m tall) with its central gateway, wrought-iron gate and cupola facing the Camera, and
// beyond it the twin Gothic towers of the east range, raised by hand out of the mapped 12.8 m block.
//   build(ctx) -> { meshes, dims, gate }
import { Batch, RB, frame, rectPts, archPts, tudorPts, buildBatch, packKeys, radSigns, signQuad, signsMesh, TAU } from './_rad_kit.js';

export const TOWERS_ID = 'w227773847', SCREEN_ID = 'w301650408';
export const ALLSOULS = {
  towers: [{ c: [492.35, 167.05] }, { c: [489.05, 154.85] }], u: [0.243, 0.970], hl: 2.85, hw: 2.3,
  range: 13.0, top: 27.5, pinnacle: 31.5, screen: 6.8,
  gate: { at: [440.2, 174.0], dir: [0.279, 0.960], w: 5.6, h: 11.0 },
};

export function build(ctx) {
  const { world, parent, map } = ctx, A = ALLSOULS;
  packKeys(world);
  const B = new RB(), Bs = new Batch(), S = radSigns(world), out = { meshes: [] };
  // ---- the two towers rise out of the mapped range (which the world still draws, 12.8 m): their walls stand 10 cm
  // outside the range's so nothing is coincident
  void map;
  const [ux, uz] = A.u;
  for (const T of A.towers) {
    const [cx, cz] = T.c;
    B.push(frame(cx, 0, cz, ux, uz));        // local x along the range (north-south), local +z = west (towards the quad)
    const hl = A.hl, hw = A.hw;
    // body in three stages with string courses; octagonal corner turrets rising into pinnacles
    B.box('radHoney', 0, A.top / 2, 0, 2 * hl, A.top, 2 * hw, 0, { top: true });
    for (const y of [A.range, 19.5, A.top - 0.6]) B.box('radPale', 0, y, 0, 2 * hl + 0.25, 0.32, 2 * hw + 0.25, 0, { top: true });
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      const x = s * (hl - 0.05), z = t * (hw - 0.05);
      // octagonal corner turret with string rings, an open-traceried top stage, a crocketed pinnacle
      const oct = { facet: true, seg: 8, a0: Math.PI / 8, a1: Math.PI / 8 + TAU, crease: 0.3 };
      B.lathe('radHoney', x, z, [[0.62, 0, 'radPale'], [0.62, 0.6], [0.56, 0.7], [0.56, A.range - 0.1], [0.64, A.range, 'radPale'], [0.64, A.range + 0.3], [0.56, A.range + 0.4], [0.56, 19.4], [0.64, 19.5, 'radPale'], [0.64, 19.8], [0.56, 19.9], [0.56, A.top + 0.6], [0.66, A.top + 0.7, 'radPale'], [0.66, A.top + 1.0, 'radPale'], [0.5, A.top + 1.05]], oct);
      B.lathe('radPale', x, z, [[0.5, A.top + 1.0], [0.0, A.pinnacle]], oct);
      for (let c = 0; c < 8; c++) { const a = Math.PI / 8 + (c / 8) * TAU; for (let i = 1; i <= 4; i++) { const f = i / 5, r = 0.54 * (1 - f), y = A.top + 1.0 + (A.pinnacle - A.top - 1.0) * f, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r, ox = Math.sin(a) * 0.2, oz = Math.cos(a) * 0.2;
        B.poly('radPale', [[px, y, pz], [px + ox, y + 0.08, pz + oz], [px, y + 0.3, pz]], [Math.cos(a), 0, -Math.sin(a)]); B.poly('radPale', [[px, y, pz], [px, y + 0.3, pz], [px + ox, y + 0.08, pz + oz]], [-Math.cos(a), 0, Math.sin(a)]); } }
      B.lathe('radPale', x, z, [[0, A.pinnacle - 0.1], [0.1, A.pinnacle], [0, A.pinnacle + 0.3]], { seg: 5 });
    }
    // Gothic windows on all four faces of the upper stages, a lantern stage on top
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2, L = k % 2 ? 2 * hl : 2 * hw, d = k % 2 ? hw : hl;
      B.push(frame(Math.sin(ang) * d, 0, Math.cos(ang) * d, Math.cos(ang), -Math.sin(ang)));
      B.unit('leaded', tudorPts(0, Math.min(1.6, L - 1.6), A.range + 1.2, 18.4, 0.6, 6), 0.03, [0, 0]);
      B.unit('radGroove', archPts(0, Math.min(1.5, L - 1.7), 20.4, A.top - 2.4, 8), 0.03, [0, 0]);
      B.pop();
    }
    // battlements
    for (let i = -2; i <= 2; i++) for (const t of [-1, 1]) { B.box('radHoney', i * hl / 2.5, A.top + 0.35, t * hw, 0.6, 0.7, 0.3); B.box('radHoney', t * hl, A.top + 0.35, i * hw / 2.5, 0.3, 0.7, 0.6); }
    // the central lantern / spirelet
    B.cyl('radPale', 0, A.top, 0, 1.0, 2.2, 8, false, 1.1);
    B.cyl('radPale', 0, A.top + 2.2, 0, 0.03, A.pinnacle + 1.5 - A.top - 2.2, 8, false, 1.05);
    B.pop();
  }
  // ---- the cloister screen's central gateway on Catte Street: arch, iron gate, a cupola above
  {
    const G = A.gate, [gx, gz] = G.at, [ax, az] = G.dir;
    // outward = towards the square (west): frame's local +z is (-az, ax) = (-0.96, 0.279) -> west-ish. Good.
    B.push(frame(gx, 0, gz, ax, az));
    const hw = G.w / 2;
    B.box('radHoney', 0, G.h / 2, -1.0, G.w, G.h, 2.4, 0, { top: true });
    B.unit('dark', archPts(0, 3.0, 0, 3.2, 10), 0.22, [0, 0]);
    for (const s of [-1, 1]) { B.box('radPale', s * (hw - 0.3), G.h / 2, 0.25, 0.5, G.h, 0.3); B.cyl('radPale', s * (hw - 0.3), G.h, 0.25, 0.03, 2.2, 4, false, 0.28); }
    B.box('radPale', 0, 6.5, 0.25, G.w, 0.3, 0.35);
    B.unit('leaded', tudorPts(0, 1.6, 7.2, 9.6, 0.4, 6), 0.21, [0, 0]);
    // cupola: an octagonal open lantern with a lead ogee cap
    const cy = G.h, R = 1.5;
    for (let j = 0; j < 8; j++) { const t = (j / 8) * TAU; B.cyl('radPale', Math.sin(t) * R, cy, -1.0 + Math.cos(t) * R, 0.12, 2.4, 6, false, 0.14); }
    B.cyl('radPale', 0, cy + 2.4, -1.0, R + 0.25, 0.35, 8, true, R + 0.25);
    B.cyl('radLead', 0, cy + 2.75, -1.0, 0.25, 1.6, 8, false, R + 0.15);
    B.cyl('radLeadLt', 0, cy + 4.35, -1.0, 0.02, 1.2, 6, false, 0.25);
    // the gate itself: wrought-iron bars in the arch (geometry in the atlas draw: seen from across the square)
    for (let i = -6; i <= 6; i++) { const x = i * 0.22, yTop = 3.2 + Math.sqrt(Math.max(0, 1.5 * 1.5 - x * x)) - 0.1; B.box('iron', x, yTop / 2, 0.3, 0.04, yTop, 0.04, 0, { top: false }); B.box('iron', x, yTop + 0.06, 0.3, 0.02, 0.14, 0.02, Math.PI / 4, { top: false }); }
    for (const y of [0.14, 1.9, 3.15]) B.box('iron', 0, y, 0.3, 3.0, 0.07, 0.05, 0, { bottom: true });
    B.pop();
    const nx = -az, nz = ax, ox = gx + nx * 0.28, oz = gz + nz * 0.28;
    signQuad(Bs, S.uv('allsouls'), ox - ax * 1.4, oz - az * 1.4, ox + ax * 1.4, oz + az * 1.4, 4.0, 4.6, nx, nz, 0.0);
    out.gate = { x: gx + nx * 0.9, z: gz + nz * 0.9, h: Math.atan2(nx, nz) };
  }
  out.meshes.push(...buildBatch(B, world, parent, 'allsouls', {}), ...signsMesh(Bs, world, parent, 'allsouls'));
  out.dims = { ...A };
  return out;
}
