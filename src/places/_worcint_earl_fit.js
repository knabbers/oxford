// Earl Building: the kitchen's fittings and a study bedroom's furniture (called by _worcint_earl.js).
// From the owner's two photographs (described in docs/research/worcester.md "Earl Building interior"); what the photos
// do not show is a guess and marked GUESS here. Nothing is branded.
// Two batches: B = textured materials (one mesh each), P = "paint": every plain-coloured thing in the building in ONE
// vertex-coloured mesh (appliances, handles, clutter, curtains, books…): key = a colour name from PAINT.
import * as THREE from 'three';
import { frame, rectPts } from './_worcint_kit.js';
import { rng } from './_worcint_tex.js';
import { KIT, K, CH, WINDOWS, ROOM_Z } from './_worcint_earl_plan.js';

export const PAINT = {
  white: 0xf3f3f0, offwhite: 0xe6e4dc, chrome: 0xc4c8cc, steel: 0x9ca0a4, black: 0x141416, dark: 0x2c2c30, worktop: 0x2a2826, plinth: 0x3a3632,
  grey: 0x7c8086, midgrey: 0x5c6066, bin: 0x3a3e44, green: 0x3f8a46, leaf: 0x2f6e34, terracotta: 0xb4623c, yellow: 0xe8c634, card: 0xb08a58,
  teal: 0x2a8f9a, red: 0xc02a24, blue: 0x3a5f96, curtain: 0x5a7aa6, curtainD: 0x4a6892, duvet: 0x76828e, pillow: 0xe9e6de, cream: 0xe8dcc0,
  purple: 0x5a3c7a, orange: 0xd8792a, pink: 0xd87a8a, sky: 0x8fb4d8, navy: 0x1e2a44, wood: 0xc8934e, amp: 0x1c1c1e, cloth: 0x8c8c86, seat: 0x8a8d8a,
  paper: 0xf4f0e4, note: 0xf2e27a, mug: 0xd0d4d8, glassy: 0x9fb8c4, banana: 0xe6c83a, lilac: 0xb8a8c8, sock: 0xf8f6ee, sill: 0xf6f6f2, rad: 0xeeeeea,
};

/** the paint batch as one mesh (position / normal / colour; uv kept for mergeStatic-style tools) */
export function paintMesh(P, scene, mat) {
  let n = 0; for (const p of P.parts.values()) n += p.pos.length / 3;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), c = new THREE.Color();
  let o = 0;
  for (const [key, p] of P.parts) {
    const k = p.pos.length / 3; pos.set(p.pos, o * 3); nor.set(p.nor, o * 3);
    c.setHex(PAINT[key] ?? 0xff00ff);
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += k;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, mat); m.name = 'earl:paint'; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.userData.keep = true;
  scene.add(m);
  return m;
}

/** chair with a slatted back (the kitchen's): seat 0.45 high, facing heading h */
export function slatChair(B, x, z, h, key = 'beech') {
  const c = Math.cos(h), s = Math.sin(h);
  const T = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const bx = (lx, y, lz, w, hh, d) => { const p = T(lx, lz); B.box(key, p[0], y, p[1], w, hh, d, h); };
  bx(0, 0.44, 0, 0.42, 0.035, 0.4);
  for (const lx of [-0.19, 0.19]) { bx(lx, 0.21, 0.17, 0.04, 0.42, 0.04); bx(lx, 0.46, -0.19, 0.04, 0.92, 0.04); }
  bx(0, 0.89, -0.19, 0.42, 0.07, 0.03); bx(0, 0.52, -0.19, 0.36, 0.04, 0.025);
  for (const lx of [-0.11, 0, 0.11]) bx(lx, 0.7, -0.19, 0.05, 0.32, 0.018);
  bx(0, 0.2, -0.19, 0.36, 0.03, 0.025); for (const lx of [-0.19, 0.19]) bx(lx, 0.2, 0, 0.025, 0.03, 0.36);
}

/** a timber window in a wall frame F (s along the wall, y up, z = into the room): opening s0..s1, y0..y1, reveal `depth`
 *  out to the shell. Frame at mid reveal: mullions at `mull` (fractions), a transom `tr` above the sill, white sill board. */
export function timberWindow(B, P, s0, s1, y0, y1, depth, mull = [0.5], tr = 0.42, o = {}) {
  const w = s1 - s0, zf = -depth + 0.04, t = 0.07, key = o.key || 'pine';      // (zf: at the outer end of the reveal — the white-painted outside of the same frame is the world's: worcester_interiors.js dressOpenings)
  B.reveal(o.reveal || 'wallK', rectPts(s0, y0, s1, y1), 0, -depth, false);
  const bar = (cx, cy, bw, bh) => B.box(key, cx, cy, zf, bw, bh, 0.07);
  bar((s0 + s1) / 2, y0 + t / 2, w, t); bar((s0 + s1) / 2, y1 - t / 2, w, t); bar(s0 + t / 2, (y0 + y1) / 2, t, y1 - y0); bar(s1 - t / 2, (y0 + y1) / 2, t, y1 - y0);
  for (const m of mull) bar(s0 + w * m, (y0 + y1) / 2, t * 1.15, y1 - y0);
  if (tr) {
    bar((s0 + s1) / 2, y0 + tr, w, t);
    // the small opening lights under the transom: a thinner sash frame in each bay, with a stay
    const xs = [0, ...mull, 1];
    for (let i = 0; i < xs.length - 1; i++) { const a = s0 + w * xs[i] + t * 0.6, b = s0 + w * xs[i + 1] - t * 0.6; B.box(key, (a + b) / 2, y0 + tr - t * 0.5 - 0.02, zf + 0.03, b - a, 0.035, 0.035); P.box('chrome', (a + b) / 2, y0 + tr - 0.07, zf + 0.06, 0.12, 0.015, 0.02); }
  }
  // glass: one faint sheet (the world shows through it)
  B.face('glass', rectPts(s0 + t, y0 + t, s1 - t, y1 - t), [], zf);
  // sill board
  P.box('sill', (s0 + s1) / 2, y0 - 0.015, 0.02 - depth / 2 + 0.06, w + 0.12, 0.03, depth + 0.16);
}

// ------------------------------------------------------------------------------------------------ kitchen
export function kitchenFittings(B, P, col, mats) {
  const { x0: kx0, x1: kx1, z1: kz1 } = KIT, WY = K.worktopY, FX = K.frontX;
  // ============ the photographed run on the window wall (fronts at x = FX, facing -x), from the blinds to the far corner
  // short fridge: bananas on top
  { const F = K.fridge2; P.boxXZ('white', F.x0, F.x1, 0.02, F.top, F.z0 + 0.01, F.z1 - 0.01); P.boxXZ('dark', F.x0 + 0.03, F.x1, 0, 0.02, F.z0 + 0.03, F.z1 - 0.03);
    P.boxXZ('grey', F.x0 - 0.002, F.x0, 0.05, F.top - 0.02, F.z0 + 0.012, F.z0 + 0.016); P.boxXZ('chrome', F.x0 - 0.03, F.x0, F.top - 0.2, F.top - 0.05, F.z1 - 0.07, F.z1 - 0.05);
    for (let i = 0; i < 4; i++) P.box('banana', F.x0 + 0.28, F.top + 0.02 + (i === 3 ? 0.03 : 0), F.z0 + 0.16 + i * 0.033 - (i === 3 ? 0.05 : 0), 0.19, 0.035, 0.03, 0.25 - i * 0.1); P.box('dark', F.x0 + 0.19, F.top + 0.035, F.z0 + 0.2, 0.02, 0.03, 0.05); }
  // tall fridge-freezer (the freezer's lower door + drawers are drawn by _friends_dippers.js); boxes stored on top
  { const F = K.freezer; P.boxXZ('white', F.x0, F.x1, 0.03, F.top, F.z0 + 0.008, F.z1 - 0.008); P.boxXZ('dark', F.x0 + 0.04, F.x1, 0, 0.03, F.z0 + 0.03, F.z1 - 0.03);
    P.boxXZ('grey', F.x0 - 0.003, F.x0, 0.865, 0.875, F.z0 + 0.01, F.z1 - 0.01); P.boxXZ('chrome', F.x0 - 0.035, F.x0, 1.05, 1.5, F.z1 - 0.075, F.z1 - 0.05);
    P.boxXZ('card', F.x0 + 0.12, F.x1 - 0.06, F.top, F.top + 0.2, F.z0 + 0.06, F.z0 + 0.42); P.boxXZ('offwhite', F.x0 + 0.118, F.x0 + 0.12, F.top + 0.06, F.top + 0.14, F.z0 + 0.14, F.z0 + 0.3); }
  // dishwasher (free-standing, white; its own top a little under the worktop)
  { const D = K.dish; P.boxXZ('white', FX, kx1, 0.03, 0.86, D.z0 + 0.006, D.z1 - 0.006); P.boxXZ('dark', FX + 0.04, kx1, 0, 0.03, D.z0 + 0.03, D.z1 - 0.03);
    P.boxXZ('offwhite', FX - 0.012, FX, 0.72, 0.84, D.z0 + 0.01, D.z1 - 0.01); P.boxXZ('grey', FX - 0.014, FX - 0.012, 0.76, 0.8, D.z0 + 0.08, D.z0 + 0.3); for (let i = 0; i < 3; i++) P.cyl('chrome', FX - 0.014, 0.775, D.z1 - 0.1 - i * 0.07, 0.012, 0.01, 6, true);
    P.boxXZ('chrome', FX - 0.03, FX - 0.012, 0.66, 0.68, D.z0 + 0.1, D.z1 - 0.1); P.boxXZ('lilac', FX + 0.1, FX + 0.4, 0.86, 0.94, D.z0 + 0.1, D.z0 + 0.42); P.boxXZ('cloth', FX + 0.2, FX + 0.5, 0.86, 0.9, D.z0 + 0.3, D.z1 - 0.05); }
  // three base units (drawer over door), plinth, worktop on to the corner, sink + tall tap, washing-up
  { const U = K.base;
    B.boxXZ('maple', FX, kx1, 0.1, 0.88, U.z0, kz1); P.boxXZ('plinth', FX + 0.05, kx1, 0, 0.1, U.z0, kz1);
    for (let i = 0; i < 3; i++) { const a = U.z0 + i * 0.6, b = a + 0.6;
      P.boxXZ('dark', FX - 0.004, FX, 0.12, 0.86, b - 0.004, b + 0.004); P.boxXZ('dark', FX - 0.004, FX, 0.7, 0.712, a + 0.005, b - 0.005);
      P.box('chrome', FX - 0.03, 0.785, (a + b) / 2, 0.012, 0.012, 0.13); for (const dz of [-0.06, 0.06]) P.box('chrome', FX - 0.015, 0.785, (a + b) / 2 + dz, 0.03, 0.012, 0.012);
      P.box('chrome', FX - 0.03, 0.56, b - 0.07, 0.012, 0.13, 0.012); for (const dy of [-0.06, 0.06]) P.box('chrome', FX - 0.015, 0.56 + dy, b - 0.07, 0.03, 0.012, 0.012); }
    P.boxXZ('worktop', FX - 0.04, kx1, 0.88, WY, U.z0, kz1);
    const sz = K.sinkZ; P.boxXZ('steel', FX + 0.07, kx1 - 0.06, WY, WY + 0.008, sz - 0.34, sz + 0.62); P.boxXZ('midgrey', FX + 0.13, kx1 - 0.14, WY + 0.008, WY + 0.011, sz - 0.27, sz + 0.2);
    for (let i = 0; i < 6; i++) P.boxXZ('grey', FX + 0.13, kx1 - 0.14, WY + 0.008, WY + 0.012, sz + 0.27 + i * 0.055, sz + 0.285 + i * 0.055);       // drainer ribs
    // tall swan-neck tap
    P.cyl('chrome', kx1 - 0.1, WY, sz, 0.022, 0.3, 8, true); P.beam('chrome', [kx1 - 0.1, WY + 0.3, sz], [kx1 - 0.2, WY + 0.38, sz], 0.022); P.beam('chrome', [kx1 - 0.2, WY + 0.38, sz], [kx1 - 0.3, WY + 0.3, sz], 0.022); P.box('chrome', kx1 - 0.3, WY + 0.27, sz, 0.024, 0.06, 0.024); P.box('chrome', kx1 - 0.09, WY + 0.1, sz + 0.06, 0.02, 0.02, 0.09);
    // washing-up: a board propped against the splashback, a pan, bowls, a bottle of washing-up liquid, a sponge (the two glasses are the dippers scene's)
    P.box('offwhite', kx1 - 0.05, WY + 0.16, sz - 0.02, 0.02, 0.32, 0.24); P.cyl('dark', FX + 0.25, WY + 0.011, sz - 0.1, 0.1, 0.06, 12, true); P.cyl('mug', FX + 0.36, WY + 0.011, sz + 0.12, 0.07, 0.05, 10, true);
    P.cyl('green', kx1 - 0.1, WY, sz - 0.5, 0.03, 0.17, 8, true); P.box('yellow', kx1 - 0.1, WY + 0.02, sz - 0.4, 0.06, 0.035, 0.09); P.cyl('teal', kx1 - 0.12, WY, sz - 0.62, 0.04, 0.1, 8, true);
    P.cyl('steel', FX + 0.3, WY, sz + 0.78, 0.12, 0.09, 12, true); P.cyl('dark', FX + 0.3, WY + 0.09, sz + 0.78, 0.125, 0.012, 12, true);      // a covered pan on the corner
    // splashback: grey-blue rectangular tiles
    const C0 = K.dish.z0;      // the wall cupboards and the tiles start over the dishwasher, beside the fridge-freezer
    B.push(frame(kx1, 0, C0, 0, 1)); B.face('splash', rectPts(0, WY, kz1 - C0, 1.5), [], 0.012); B.pop();
    // wall cupboards: a tall one next to the fridge, then shorter ones over a pale canopy
    B.boxXZ('maple', kx1 - 0.33, kx1, 1.36, 2.16, C0, C0 + 0.6); B.boxXZ('maple', kx1 - 0.33, kx1, 1.62, 2.16, C0 + 0.6, U.z1);
    P.boxXZ('offwhite', kx1 - 0.45, kx1, 1.55, 1.62, C0 + 0.62, C0 + 1.8); P.boxXZ('chrome', kx1 - 0.452, kx1 - 0.45, 1.565, 1.6, C0 + 0.8, C0 + 1.6);
    for (const z of [C0 + 1.2, C0 + 1.8]) P.boxXZ('dark', kx1 - 0.334, kx1 - 0.33, 1.63, 2.15, z - 0.004, z + 0.004);
    P.box('chrome', kx1 - 0.35, 1.5, C0 + 0.5, 0.012, 0.13, 0.012); for (const z of [C0 + 0.9, C0 + 1.5, C0 + 2.1]) P.box('chrome', kx1 - 0.35, 1.69, z, 0.012, 0.012, 0.13);
    P.boxXZ('card', kx1 - 0.3, kx1 - 0.04, 2.16, 2.3, C0 + 0.1, C0 + 0.45); P.boxXZ('white', kx1 - 0.22, kx1 - 0.06, 2.16, 2.36, C0 + 1.5, C0 + 1.66);       // boxes / a kettle box on top
    // the return along the end wall: base unit + worktop + a wall cupboard, pans on it
    const R = K.ret;
    B.boxXZ('maple', R.x0, FX, 0.1, 0.88, kz1 - 0.6, kz1); P.boxXZ('plinth', R.x0, FX, 0, 0.1, kz1 - 0.55, kz1); P.boxXZ('worktop', R.x0 - 0.02, FX, 0.88, WY, kz1 - 0.64, kz1);
    for (const x of [R.x0 + 0.45]) { P.boxXZ('dark', x - 0.004, x + 0.004, 0.12, 0.86, kz1 - 0.604, kz1 - 0.6); } for (const x of [R.x0 + 0.37, R.x0 + 0.53]) P.box('chrome', x, 0.6, kz1 - 0.63, 0.012, 0.13, 0.012);
    B.boxXZ('maple', R.x0 + 0.2, kx1, 1.45, 2.0, kz1 - 0.33, kz1); P.box('chrome', R.x0 + 0.85, 1.52, kz1 - 0.35, 0.012, 0.1, 0.012);
    P.cyl('dark', R.x0 + 0.35, WY, kz1 - 0.3, 0.13, 0.11, 12, true); P.cyl('leaf', R.x0 + 0.75, WY, kz1 - 0.32, 0.11, 0.07, 12, true); P.cyl('orange', R.x0 + 1.1, WY, kz1 - 0.22, 0.05, 0.12, 8, true);
    col.addBox((FX + kx1) / 2 - 0.02, (K.fridge2.z0 + kz1) / 2, kx1 - FX + 0.06, kz1 - K.fridge2.z0, 0); col.addBox((R.x0 + FX) / 2, kz1 - 0.31, FX - R.x0, 0.62, 0);
  }

  // ============ GUESS (the wall the photo does not show): the cooker run on the corridor wall — where the dippers are cooked
  { const UX = K.unitsX, ov = K.oven, oz0 = ov.z - ov.w / 2, oz1 = ov.z + ov.w / 2, r0 = K.run.z0, r1 = K.run.z1;
    for (const [a, b] of [[r0, oz0], [oz1, r1]]) {
      B.boxXZ('maple', kx0, UX, 0.1, 0.88, a, b); P.boxXZ('plinth', kx0, UX - 0.05, 0, 0.1, a, b);
      const n = Math.max(1, Math.round((b - a) / 0.6)), w = (b - a) / n;
      for (let i = 0; i < n; i++) { const z = a + i * w; if (i) P.boxXZ('dark', UX, UX + 0.004, 0.12, 0.86, z - 0.004, z + 0.004); P.boxXZ('dark', UX, UX + 0.004, 0.7, 0.712, z + 0.005, z + w - 0.005);
        P.box('chrome', UX + 0.03, 0.785, z + w / 2, 0.012, 0.012, 0.13); for (const dz of [-0.06, 0.06]) P.box('chrome', UX + 0.015, 0.785, z + w / 2 + dz, 0.03, 0.012, 0.012); P.box('chrome', UX + 0.03, 0.56, z + 0.07, 0.012, 0.13, 0.012); }
    }
    P.boxXZ('worktop', kx0, UX + 0.04, 0.88, WY, r0, r1);
    B.push(frame(kx0, 0, r1, 0, -1)); B.face('splash', rectPts(0, WY, r1 - r0, 1.45), [], 0.012); B.pop();
    // oven housing: plinth, control strip + knobs, cavity (thin slabs so its inside shows when the door is open), glowing back, shelf
    P.boxXZ('black', kx0, UX - 0.02, 0, ov.y0, oz0, oz1); P.boxXZ('steel', UX - 0.05, UX, 0.74, 0.88, oz0, oz1);
    for (const dz of [-0.24, -0.14, 0.14, 0.24]) P.cyl('black', UX + 0.012, 0.8, ov.z + dz, 0.018, 0.02, 8, true);
    P.boxXZ('black', kx0 + 0.02, UX - 0.02, ov.y1 - 0.02, 0.74, oz0, oz1); P.boxXZ('black', kx0 + 0.02, UX - 0.02, ov.y0, ov.y0 + 0.02, oz0, oz1);
    P.boxXZ('black', kx0 + 0.02, UX - 0.02, ov.y0, ov.y1, oz0, oz0 + 0.02); P.boxXZ('black', kx0 + 0.02, UX - 0.02, ov.y0, ov.y1, oz1 - 0.02, oz1);
    B.boxXZ('ovenGlow', kx0 + 0.04, kx0 + 0.06, ov.y0, ov.y1, oz0, oz1); P.boxXZ('chrome', kx0 + 0.06, UX - 0.06, 0.37, 0.375, oz0 + 0.02, oz1 - 0.02);
    // hob (black glass + four rings), extractor hood + chimney
    P.boxXZ('black', kx0 + 0.05, UX - 0.03, WY, WY + 0.01, oz0 + 0.02, oz1 - 0.02);
    for (const [dx, dz, r] of [[-0.13, -0.14, 0.09], [-0.13, 0.14, 0.07], [0.12, -0.14, 0.07], [0.12, 0.14, 0.09]]) P.cyl('dark', K.hob[0] + dx, WY + 0.01, K.hob[1] + dz, r, 0.003, 14, true);
    P.boxXZ('steel', kx0, kx0 + 0.5, 1.55, 1.68, ov.z - 0.35, ov.z + 0.35); P.boxXZ('steel', kx0, kx0 + 0.25, 1.68, CH, ov.z - 0.15, ov.z + 0.15);
    P.box('chrome', K.gloveHook[0] + 0.01, K.gloveHook[1] + 0.11, K.gloveHook[2], 0.03, 0.02, 0.02);
    // wall cupboards either side of the hood
    for (const [a, b] of [[r0, ov.z - 0.45], [ov.z + 0.45, r1]]) {
      B.boxXZ('maple', kx0, kx0 + 0.33, 1.45, 2.15, a, b);
      const m = Math.max(1, Math.round((b - a) / 0.6)), w = (b - a) / m;
      for (let k = 0; k < m; k++) { if (k) P.boxXZ('dark', kx0 + 0.33, kx0 + 0.334, 1.46, 2.14, a + k * w - 0.003, a + k * w + 0.003); P.box('chrome', kx0 + 0.35, 1.53, a + (k + 0.5) * w, 0.012, 0.1, 0.012); }
    }
    // microwave, kettle, toaster
    { const M = K.microwaveBox; P.boxXZ('white', kx0 + 0.1, kx0 + 0.5, WY, WY + 0.29, M.z0, M.z1); P.boxXZ('black', kx0 + 0.5, kx0 + 0.504, WY + 0.04, WY + 0.25, M.z0 + 0.04, M.z1 - 0.14); P.boxXZ('grey', kx0 + 0.5, kx0 + 0.504, WY + 0.05, WY + 0.24, M.z1 - 0.11, M.z1 - 0.03); }
    P.cyl('white', K.kettle[0], WY, K.kettle[1], 0.075, 0.2, 10, true, 0.06); P.box('black', K.kettle[0] + 0.085, WY + 0.12, K.kettle[1], 0.03, 0.11, 0.025); P.cyl('dark', K.kettle[0], WY, K.kettle[1], 0.085, 0.02, 10, true);
    P.boxXZ('steel', K.toaster[0] - 0.08, K.toaster[0] + 0.08, WY, WY + 0.17, K.toaster[1] - 0.14, K.toaster[1] + 0.14); P.boxXZ('black', K.toaster[0] - 0.03, K.toaster[0] + 0.03, WY + 0.17, WY + 0.172, K.toaster[1] - 0.11, K.toaster[1] + 0.11);
    col.addBox((kx0 + UX) / 2, (r0 + r1) / 2, UX - kx0 + 0.02, r1 - r0, 0);
  }
  // GUESS: bins (general, recycling, food caddy), fire blanket + extinguisher by the door, noticeboard with the cleaning rota
  { const [b0, b1, b2] = K.bins;
    P.cyl('bin', b0[0], 0, b0[1], 0.19, 0.66, 12, true); P.cyl('dark', b0[0], 0.66, b0[1], 0.2, 0.03, 12, true); col.addCircle(b0[0], b0[1], 0.21);
    P.cyl('green', b1[0], 0, b1[1], 0.19, 0.66, 12, true); P.cyl('dark', b1[0], 0.66, b1[1], 0.2, 0.03, 12, true); col.addCircle(b1[0], b1[1], 0.21);
    P.box('midgrey', b2[0] - 0.03, 0.14, b2[1], 0.22, 0.28, 0.24); P.box('green', b2[0] - 0.03, 0.29, b2[1], 0.23, 0.02, 0.25);
    P.box('red', kx0 + 0.04, 1.55, 5.6, 0.07, 0.3, 0.16); P.box('white', kx0 + 0.077, 1.6, 5.6, 0.004, 0.1, 0.1);                 // fire blanket (between the door and the cooker run)
    P.cyl('red', kx0 + 0.42, 0.05, KIT.z0 + 0.12, 0.07, 0.42, 10, true); P.cyl('black', kx0 + 0.42, 0.47, KIT.z0 + 0.12, 0.03, 0.07, 8, true);    // extinguisher (behind the door)
    B.push(frame(K.notice.x0, 0, KIT.z0, 1, 0)); B.box('pinboard', (K.notice.x1 - K.notice.x0) / 2, 1.5, 0.012, K.notice.x1 - K.notice.x0, 0.9, 0.024); P.box('chrome', (K.notice.x1 - K.notice.x0) / 2, 1.5, 0.008, K.notice.x1 - K.notice.x0 + 0.04, 0.94, 0.016);
    B.sign('signs', 0.12, 1.3, 0.62, 1.9, 0.026, mats.signUV.rota); P.box('note', 0.82, 1.7, 0.026, 0.14, 0.14, 0.002); P.box('paper', 1.05, 1.45, 0.026, 0.21, 0.3, 0.002); P.box('pink', 0.85, 1.32, 0.026, 0.2, 0.14, 0.002);
    B.pop(); }
  // ============ table (rectangular, light wood) + six slat-back chairs; on it: a water bottle, mugs, notes (no computers: c. 2013 paper)
  { const T = K.tableRect, y = K.table.y;
    B.boxXZ('beech', T.x0, T.x1, y - 0.035, y, T.z0, T.z1, { bottom: true });
    for (const [x, z] of [[T.x0 + 0.07, T.z0 + 0.07], [T.x1 - 0.07, T.z0 + 0.07], [T.x0 + 0.07, T.z1 - 0.07], [T.x1 - 0.07, T.z1 - 0.07]]) B.box('beech', x, (y - 0.035) / 2, z, 0.06, y - 0.035, 0.06);
    B.boxXZ('beech', T.x0 + 0.08, T.x1 - 0.08, y - 0.12, y - 0.035, T.z0 + 0.05, T.z0 + 0.07); B.boxXZ('beech', T.x0 + 0.08, T.x1 - 0.08, y - 0.12, y - 0.035, T.z1 - 0.07, T.z1 - 0.05);
    B.boxXZ('beech', T.x0 + 0.05, T.x0 + 0.07, y - 0.12, y - 0.035, T.z0 + 0.08, T.z1 - 0.08); B.boxXZ('beech', T.x1 - 0.07, T.x1 - 0.05, y - 0.12, y - 0.035, T.z0 + 0.08, T.z1 - 0.08);
    col.addBox((T.x0 + T.x1) / 2, (T.z0 + T.z1) / 2, T.x1 - T.x0, T.z1 - T.z0, 0);
    K.seats.forEach((s) => slatChair(B, s.x, s.z, s.h));
    const mx = (T.x0 + T.x1) / 2;
    P.cyl('teal', mx + 0.12, y, T.z0 + 0.5, 0.036, 0.2, 10, true); P.cyl('dark', mx + 0.12, y + 0.2, T.z0 + 0.5, 0.03, 0.03, 8, true);                      // water bottle
    P.box('paper', mx - 0.1, y + 0.003, T.z0 + 0.3, 0.21, 0.004, 0.3, 0.2); P.box('paper', mx + 0.2, y + 0.003, T.z0 + 0.85, 0.21, 0.004, 0.3, -0.35); P.box('navy', mx - 0.18, y + 0.012, T.z0 + 0.75, 0.2, 0.022, 0.28, 0.1);
    P.cyl('mug', mx - 0.28, y, T.z0 + 0.42, 0.04, 0.09, 8, true); P.cyl('red', mx + 0.3, y, T.z0 + 0.25, 0.04, 0.09, 8, true); P.box('black', mx - 0.02, y + 0.006, T.z0 + 0.6, 0.012, 0.01, 0.14, 0.6);
  }
  // sill of the long window: plant pots; of the end window: a jug
  { const Wb = WINDOWS[0], z0 = Wb.at[1] - Wb.w / 2;
    for (const [dz, k, h] of [[0.3, 'terracotta', 0.11], [0.55, 'offwhite', 0.09], [1.05, 'terracotta', 0.12], [1.45, 'red', 0.1]]) { P.cyl(k, kx1 + 0.07, Wb.y0, z0 + dz, 0.055, h, 8, true, 0.07); P.cyl('leaf', kx1 + 0.07, Wb.y0 + h, z0 + dz, 0.09, 0.13, 7, true, 0.03); }
    const We = WINDOWS[1]; P.cyl('green', We.at[0] - 0.55, We.y0, kz1 + 0.07, 0.05, 0.11, 8, true, 0.06); P.cyl('leaf', We.at[0] - 0.55, We.y0 + 0.11, kz1 + 0.07, 0.07, 0.1, 7, true, 0.02); }
}

// ------------------------------------------------------------------------------------------------ study bedroom
/**
 * Furniture of one study room r = { x0, x1 } (plan frame; its window wall is z = ROOM_Z[0], the wing's west face, its
 * inner end z = ROOM_Z[1]). It is laid out in the room's own frame, turned half round in the plan's: a = 0 is the
 * desk wall (the room's +x wall), b its other side wall, z from 0 = the window wall to the inner end. From the photograph: the long oak desk along the wall to the window with a drawer
 * unit and a chrome leg, the pinboard wall, the high oak shelf unit, the socket upstand, blue curtains, swivel chair,
 * oak-armed easy chair, bin. GUESS: the bed, wardrobe and shower-room pod (the photo is taken from among them).
 * Clutter by seed (plain coloured rectangles for pinned-up photos; no names, no real pictures).
 */
export function studyRoom(B, P, col0, r, seed) {
  // (the room's frame: plan x = r.x1 - x', plan z = ROOM_Z[0] - z')
  const X0 = r.x1, Z0 = ROOM_Z[0], a = 0, b = r.x1 - r.x0;
  const col = { addBox: (cx, cz, w, d, rot, o) => col0.addBox(X0 - cx, Z0 - cz, w, d, rot, o), addCircle: (x, z, rr, o) => col0.addCircle(X0 - x, Z0 - z, rr, o), addSegment: (x1, z1, x2, z2, o) => col0.addSegment(X0 - x1, Z0 - z1, X0 - x2, Z0 - z2, o) };
  B.push(new THREE.Matrix4().makeRotationY(Math.PI).setPosition(X0, 0, Z0));
  const R = rng(1000 + seed * 77), zw = 0, zc = Math.abs(ROOM_Z[1] - ROOM_Z[0]), pick = (arr) => arr[Math.floor(R() * arr.length) % arr.length];
  const dz1 = zc - 1.36;                               // the desk runs from the window wall to the pod
  // desk: top, back upstand with socket plates, drawer unit at the near end, chrome leg
  B.boxXZ('oakL', a, a + 0.62, 0.71, 0.745, zw, dz1, { bottom: true });
  B.boxXZ('oakL', a, a + 0.03, 0.745, 0.92, zw, dz1); B.boxXZ('oakL', a, a + 0.09, 0.9, 0.92, zw, dz1);
  for (const z of [zw + 0.75, zw + 0.95]) { P.box('sock', a + 0.032, 0.83, z, 0.004, 0.085, 0.145); P.box('dark', a + 0.035, 0.83, z, 0.002, 0.02, 0.05); }
  B.boxXZ('oakL', a + 0.04, a + 0.6, 0.12, 0.71, dz1 - 0.48, dz1 - 0.02); P.boxXZ('dark', a + 0.6, a + 0.603, 0.42, 0.428, dz1 - 0.47, dz1 - 0.03); P.box('chrome', a + 0.62, 0.57, dz1 - 0.25, 0.012, 0.014, 0.16); P.box('chrome', a + 0.62, 0.3, dz1 - 0.25, 0.012, 0.014, 0.16);
  P.cyl('chrome', a + 0.54, 0, zw + 1.25, 0.025, 0.71, 8, false);
  col.addBox(a + 0.31, (zw + dz1) / 2, 0.62, dz1 - zw, 0);
  // pinboard wall (hessian) above the desk, the oak shelf unit hung high towards the window, a smaller board under it
  B.push(frame(a, 0, dz1, 0, -1));       // s runs towards the window; faces +x
  const L = dz1 - zw, sh0 = L - 1.25, sh1 = L - 0.33;
  B.box('pinboard', (sh0 - 0.05) / 2 + 0.02, 1.62, 0.012, sh0 - 0.09, 1.32, 0.024);
  B.box('pinboard', (sh0 + sh1) / 2 + 0.1, 1.09, 0.012, sh1 - sh0 + 0.25, 0.3, 0.024);
  // shelf unit: 2 bays x 3 shelves, 0.3 deep
  { const y0 = 1.28, y1 = 2.38, d = 0.3;
    for (const s of [sh0, (sh0 + sh1) / 2, sh1]) B.box('oakL', s, (y0 + y1) / 2, d / 2, 0.02, y1 - y0, d);
    for (const y of [y0, y0 + 0.37, y0 + 0.74, y1]) B.box('oakL', (sh0 + sh1) / 2, y, d / 2, sh1 - sh0, 0.02, d);
    B.box('oakL', (sh0 + sh1) / 2, (y0 + y1) / 2, 0.006, sh1 - sh0, y1 - y0, 0.012);
    // on the shelves: a few books, a mug, a small framed card, a trailing plant in some rooms
    for (let k = 0; k < 4; k++) { const bay = R() < 0.5 ? 0 : 1, row = Math.floor(R() * 3), s = (bay ? (sh0 + sh1) / 2 : sh0) + 0.06 + R() * 0.2, y = y0 + 0.01 + row * 0.37;
      const kind = R(); if (kind < 0.5) { for (let i = 0; i < 2 + Math.floor(R() * 3); i++) P.box(pick(['red', 'navy', 'green', 'cream', 'orange', 'purple']), s + i * 0.034, y + 0.11, 0.14, 0.028, 0.2 + R() * 0.04, 0.15); } else if (kind < 0.75) P.cyl(pick(['mug', 'teal', 'terracotta']), s + 0.05, y, 0.15, 0.04, 0.09, 8, true); else P.box(pick(['dark', 'wood']), s + 0.07, y + 0.07, 0.1, 0.13, 0.11, 0.015); }
    if (seed % 2 === 1) { P.cyl('offwhite', sh0 + 0.14, y1 + 0.01, 0.16, 0.06, 0.1, 8, true); for (let i = 0; i < 9; i++) P.box('leaf', sh0 + 0.14 + Math.sin(i * 2.1) * 0.05, y1 - 0.05 - i * 0.075, 0.3 + Math.cos(i * 1.7) * 0.03, 0.07, 0.07, 0.012, i * 0.7); }
  }
  // pinned up: photos as plain coloured rectangles in a loose grid, a generic wall planner (a white sheet with a red border)
  { const cols = 5 + Math.floor(R() * 2), rows = 5 + Math.floor(R() * 3), x0 = 0.1, y1 = 1.0 + rows * 0.117, cw = 0.15, chh = 0.105;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { if (R() < 0.14) continue; P.box(pick(['sky', 'green', 'orange', 'purple', 'pink', 'cream', 'blue', 'navy', 'leaf', 'red', 'lilac', 'teal']), x0 + i * (cw + 0.012) + cw / 2 + (R() - 0.5) * 0.01, y1 - j * (chh + 0.012) - chh / 2, 0.026, cw, chh, 0.002); }
    const px = x0 + cols * (cw + 0.012) + 0.06; if (px + 0.44 < sh0 + 0.1) { P.box('red', px + 0.21, 1.42, 0.026, 0.44, 0.62, 0.002); P.box('paper', px + 0.21, 1.42, 0.0275, 0.4, 0.58, 0.002); for (let i = 1; i < 12; i++) P.box('grey', px + 0.21, 1.15 + i * 0.045, 0.0285, 0.38, 0.003, 0.001); }
    P.box('note', sh0 + 0.2, 1.1, 0.026, 0.09, 0.09, 0.002); P.box('pink', sh0 + 0.42, 1.08, 0.026, 0.09, 0.09, 0.002); }
  B.pop();
  // on the desk: books in a stack, a pot plant, a lamp or a mug, paper (varied)
  { const z = dz1 - 0.75 - R() * 0.2; for (let i = 0; i < 2 + (seed % 3); i++) P.box(pick(['navy', 'green', 'cream', 'red', 'purple']), a + 0.36, 0.76 + i * 0.034, z + (R() - 0.5) * 0.03, 0.2, 0.032, 0.27, (R() - 0.5) * 0.25);
    if (seed % 3 !== 1) { P.cyl('offwhite', a + 0.22, 0.745, dz1 - 1.15, 0.07, 0.11, 8, true, 0.085); for (let i = 0; i < 6; i++) P.box('leaf', a + 0.22 + Math.cos(i * 1.05) * 0.07, 0.93 + (i % 3) * 0.05, dz1 - 1.15 + Math.sin(i * 1.05) * 0.07, 0.15, 0.012, 0.07, i * 1.05); }
    P.cyl(pick(['mug', 'red', 'teal']), a + 0.16, 0.745, zw + 0.7, 0.04, 0.09, 8, true); P.box('paper', a + 0.36, 0.748, zw + 1.0, 0.21, 0.004, 0.3, R() - 0.5); P.box(pick(['red', 'navy', 'teal']), a + 0.1, 0.83, zw + 0.42, 0.03, 0.17, 0.22);
    if (seed % 2 === 0) { P.cyl('dark', a + 0.2, 0.745, zw + 0.22, 0.07, 0.015, 10, true); P.beam('dark', [a + 0.2, 0.75, zw + 0.22], [a + 0.25, 1.15, zw + 0.3], 0.015); P.cyl('dark', a + 0.3, 1.1, zw + 0.36, 0.07, 0.07, 8, true, 0.03); } }
  // swivel chair (black), mesh bin under the desk
  { const cx = a + 0.98, cz = zw + 1.55 + (seed % 2) * 0.25, h = -Math.PI / 2 + (R() - 0.5) * 0.9, c = Math.cos(h), s = Math.sin(h);
    P.cyl('dark', cx, 0.42, cz, 0.22, 0.06, 10, true); P.cyl('chrome', cx, 0.06, cz, 0.025, 0.36, 6, false);
    for (let i = 0; i < 5; i++) { const t = i * 1.2566; P.beam('black', [cx, 0.07, cz], [cx + Math.cos(t) * 0.28, 0.04, cz + Math.sin(t) * 0.28], 0.03); P.cyl('black', cx + Math.cos(t) * 0.28, 0, cz + Math.sin(t) * 0.28, 0.025, 0.04, 6, true); }
    P.box('dark', cx - s * 0.2, 0.78, cz - c * 0.2, 0.4, 0.44, 0.05, h); P.beam('black', [cx - s * 0.16, 0.44, cz - c * 0.16], [cx - s * 0.2, 0.6, cz - c * 0.2], 0.03);
    col.addCircle(cx, cz, 0.24);
    P.cyl('steel', a + 0.3, 0, dz1 - 0.75, 0.12, 0.28, 10, false, 0.14); P.cyl('dark', a + 0.3, 0, dz1 - 0.75, 0.11, 0.01, 10, true); }
  // curtains: long blue, on a track, either side of the window (gathered: three folds each)
  { const Wr = WINDOWS.find((w) => w.kind === 'room' && w.at[0] > r.x0 && w.at[0] < r.x1), Wn = { ...Wr, at: [X0 - Wr.at[0], 0] }, w0 = Wn.at[0] - Wn.w / 2, w1 = Wn.at[0] + Wn.w / 2;
    P.boxXZ('offwhite', Math.max(a + 0.02, w0 - 0.42), Math.min(b - 0.02, w1 + 0.42), 2.36, 2.4, zw + 0.05, zw + 0.09);
    for (const [c0, c1] of [[Math.max(a + 0.03, w0 - 0.4), w0 + 0.12], [w1 - 0.12, Math.min(b - 0.03, w1 + 0.4)]]) { const n = 4, w = (c1 - c0) / n; for (let i = 0; i < n; i++) P.boxXZ(i % 2 ? 'curtainD' : 'curtain', c0 + i * w, c0 + (i + 1) * w, 0.42, 2.36, zw + 0.05 + (i % 2) * 0.02, zw + 0.1 + (i % 2) * 0.02); }
    for (let i = 0; i < 2 + (seed % 2); i++) { P.cyl(pick(['terracotta', 'offwhite', 'green']), w0 + 0.3 + i * 0.32, Wn.y0, zw - 0.08, 0.045, 0.08, 8, true, 0.055); P.cyl('leaf', w0 + 0.3 + i * 0.32, Wn.y0 + 0.08, zw - 0.08, 0.05, 0.09, 6, true, 0.015); } }
  // easy chair: oak arms, grey seat, under the window; a cushion in some rooms
  { const ex = b - 1.42, ez = zw + 0.72;
    B.boxXZ('oakL', ex - 0.31, ex - 0.26, 0, 0.62, ez - 0.3, ez + 0.3); B.boxXZ('oakL', ex + 0.26, ex + 0.31, 0, 0.62, ez - 0.3, ez + 0.3); B.boxXZ('oakL', ex - 0.31, ex + 0.31, 0.58, 0.62, ez - 0.32, ez - 0.27);
    P.boxXZ('seat', ex - 0.26, ex + 0.26, 0.3, 0.42, ez - 0.26, ez + 0.3); P.boxXZ('seat', ex - 0.26, ex + 0.26, 0.42, 0.86, ez - 0.3, ez - 0.2);
    if (seed % 2 === 1) P.box(pick(['purple', 'cream', 'teal']), ex, 0.6, ez - 0.14, 0.4, 0.4, 0.1, 0);
    col.addBox(ex, ez, 0.64, 0.64, 0); }
  // GUESS: single bed along the b wall (head to the window), wardrobe by the door, shower-room pod with its own door
  { P.boxXZ('wood', b - 0.94, b - 0.02, 0, 0.3, zw + 0.02, zw + 1.92); P.boxXZ('duvet', b - 0.95, b - 0.01, 0.3, 0.46, zw + 0.5, zw + 1.93); P.boxXZ('pillow', b - 0.86, b - 0.1, 0.3, 0.44, zw + 0.06, zw + 0.5); P.boxXZ('wood', b - 0.95, b - 0.01, 0, 0.7, zw + 0.0, zw + 0.03);
    col.addBox(b - 0.48, zw + 0.97, 0.94, 1.92, 0);
    B.boxXZ('oakL', b - 0.57, b - 0.01, 0, 1.95, zw + 1.96, zw + 2.8); P.boxXZ('dark', b - 0.574, b - 0.57, 0.05, 1.9, zw + 2.378, zw + 2.382); for (const z of [zw + 2.33, zw + 2.43]) P.box('chrome', b - 0.59, 1.0, z, 0.012, 0.14, 0.012);
    col.addBox(b - 0.29, zw + 2.38, 0.58, 0.84, 0);
    // pod: a = wall side, 1.45 x 1.36, its door on the +x face
    B.boxXZ('wallR', a, a + 1.45, 0, CH, dz1, zc, { top: false }); col.addBox(a + 0.725, (dz1 + zc) / 2, 1.45, zc - dz1, 0);
    B.push(frame(a + 1.45, 0, zc, 0, -1)); B.box('fireDoor', 0.72, 1.0, 0.02, 0.72, 2.0, 0.035); P.box('chrome', 1.0, 1.0, 0.045, 0.1, 0.02, 0.03); B.box('oakL', 0.72, 2.03, 0.012, 0.84, 0.06, 0.03); for (const s of [0.33, 1.11]) B.box('oakL', s, 1.0, 0.012, 0.06, 2.0, 0.03); B.pop(); }
  // some rooms: a guitar on a stand and a small practice amp by the window (nothing branded)
  if (seed % 5 === 3) { const gx = a + 1.55, gz = zw + 0.34;
    P.boxXZ('amp', gx - 0.62, gx - 0.3, 0, 0.3, zw + 0.12, zw + 0.36); P.boxXZ('cloth', gx - 0.6, gx - 0.32, 0.03, 0.22, zw + 0.36, zw + 0.365); P.boxXZ('chrome', gx - 0.6, gx - 0.32, 0.25, 0.28, zw + 0.36, zw + 0.364);
    P.box('wood', gx, 0.3, gz, 0.3, 0.4, 0.045, 0.15); P.box('pillow', gx, 0.3, gz + 0.025, 0.2, 0.28, 0.006, 0.15); P.beam('wood', [gx, 0.48, gz], [gx + 0.02, 1.08, gz - 0.12], 0.05, 0.025); P.box('wood', gx + 0.025, 1.15, gz - 0.135, 0.07, 0.17, 0.02, 0.15);
    P.beam('black', [gx - 0.2, 0, gz + 0.2], [gx, 0.2, gz - 0.02], 0.02); P.beam('black', [gx + 0.2, 0, gz + 0.2], [gx, 0.2, gz - 0.02], 0.02); }
  B.pop();
}
