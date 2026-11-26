// The Radcliffe Camera (James Gibbs, 1737-49), built by hand on the mapped footprint (the world's generic drum + dome is
// skipped in preMap). Visual pass: three levels of detail registered with the area's single-draw LOD (_rad_lod.js):
//   near   16 sectors (one per ground bay, each with its column pair, entablature, balustrade and urn: drawn only when
//          they face the camera) + the top (lead terrace, attic drum, eight scrolled buttresses, the ribbed lead dome,
//          the lantern). Real openings with reveals, rusticated ground stage, smooth lathed columns with entasis and
//          Corinthian capitals, every projecting moulding a profile with its soffit.
//   mid    one chunk: the same massing with painted units, six-sided shafts, a balustrade band, a 32 x 10 dome
//   far    one chunk (~1k triangles): the silhouette for the city and the air, to ~1.1 km (3 km in aerial mode)
// Interface: build(ctx) -> { meshes, dims, door, litWindows }   ctx = { world, parent, centre: [x, z], entranceAngle, lod }
// Facing: angle t measured from +z (south) towards +x (east): a point is centre + (sin t, cos t) * r.
// Facts: docs/research/radcliffe_square.md. Buttresses and ribs stand over the NARROW (niche) bays: "the buttresses of the
// dome come down between and not over the pairs of columns" (Summerson); 8 of them (K). Wide bays carry the pedimented
// windows over mezzanine openings (K); bay widths alternate (K); the exact offsets, the 8 major ribs and the window
// glazing colours are guessed.
import * as THREE from 'three';
import { RB, frame, rectPts, archPts, bayLit, TAU, pack } from './_rad_kit.js';
import { geoOf } from './_rad_lod.js';
import { ROOFSCAPE } from '../world/buildings.js';

export const CAMERA = {
  R: 15.25,           // ground-stage outer radius (collider: R + 0.55)
  A: 15.1,            // ground-stage face apothem (16 flat rusticated faces)
  plinth: 0.62,       // plinth / step course
  ground: 10.0,       // top of the rusticated stage (cornice 9.3 - 10.0)
  Rc: 15.0,           // column-stage wall: corner radius of its 16 chord faces (behind the column pairs)
  Rcol: 15.2,         // column axis radius; shafts 0.42 -> 0.36 (three-quarter columns)
  ent: [21.3, 22.88], // entablature
  main: 22.88,        // top of the main cornice
  bal: 24.4,          // top of the balustrade coping
  R3: 10.8,           // attic drum radius
  drum: 28.3,         // top of the drum cornice
  // photo comparison item 13 (radcam): the dome was a squat quarter ellipse (crown 37.9 m) with a lantern too small to
  // read. Now a fuller, raised profile (y = H sin(p)^0.78, crown about 40 m) and a bigger lantern; overall height to the
  // finial about 45.5 m. Proportions measured off the photograph, not from drawings: a GUESS within a metre or two.
  // (?roofs=0 keeps the old dome for before / after shots)
  ...(ROOFSCAPE ? { domeR: 10.6, domeY: 28.5, domeH: 11.0, domeK: 0.78, domeEnd: 2.9, lanR: 2.55, lanY: 39.3, lanTop: 43.4, top: 45.6 }
    : { domeR: 10.6, domeY: 28.5, domeH: 9.4, domeK: 1, domeEnd: 2.5, lanR: 2.15, lanY: 37.5, lanTop: 40.75, top: 42.7 }),
  bays: 16, pairs: 16, ribs: 8, delta: 0.02,   // bay width alternation (rad each side)
  // the north door (a real doorway: the reading room is a walk-in room, _rad_games.js) and the eight arched windows of the
  // projecting bays, as modelled: width, sill / threshold, springing of the round head (m above the square)
  door: { w: 1.6, spring: 3.45, rec: 0.36 }, win: { w: 2.5, y0: 1.05, spring: 5.35, rec: 0.42 },
};

/** always-lit window bays (the reading room is in use late: its windows glow whenever any are lit) */
const LIT = []; for (let i = 300; i < 2000 && LIT.length < 60; i++) if (bayLit(i, 0) < 0.08) LIT.push(i);

export function build(ctx) {
  const { world } = ctx, [cx, cz] = ctx.centre, D = CAMERA;
  const P = pack(world);
  const a0 = ctx.entranceAngle ?? Math.PI;    // the entrance bay faces this way (north = PI)
  const step = TAU / D.bays;
  let lit = 0;
  const litBay = () => [LIT[lit++ % LIT.length], 0];
  const at = (t, r) => [cx + Math.sin(t) * r, cz + Math.cos(t) * r];
  const F = (t, r, y = 0) => { const [x, z] = at(t, r); return frame(x, y, z, Math.cos(t), -Math.sin(t)); };   // local +z = outward, +x = increasing t
  const tBay = (k) => a0 + k * step;
  const pairA = (j) => tBay(j) + step / 2 + (j % 2 ? D.delta : -D.delta);    // pair between bay j and j+1: wide (odd) bays wider
  const cos16 = Math.cos(Math.PI / D.bays), Lf = 2 * D.A * Math.tan(Math.PI / D.bays);

  // ------------------------------------------------------------------------------------------- shared pieces
  /** a semicircular band round an arch (centre x, springing ys, mid radius rm, half width w, proud dz) in the current frame */
  const archBand = (B, key, x, ys, rm, w, z0, dz, seg = 10) => {
    const path = []; for (let i = 0; i <= seg; i++) { const a = Math.PI - (i / seg) * Math.PI; path.push([x + Math.cos(a) * rm, ys + Math.sin(a) * rm, z0]); }
    B.sweep(key, path, [[-w, 0], [-w, dz], [w, dz], [w, 0]], [0, 0, 1]);
  };
  /** a recessed opening: reveal back to depth, the glazing unit at the back */
  const opening = (B, unitKey, pts, depth, bay, revealKey = 'radHoney') => { B.reveal(revealKey, pts, 0, -depth); B.unit(unitKey, pts, -depth, bay); };
  /** a round-headed niche (half cylinder + quarter-sphere head) of radius r from y0, springing ys, in the current frame */
  const niche = (B, r, y0, ys, seg = 6, key = 'radHoney') => {
    const prof = [[0, y0], [r, y0], [r, ys]];
    for (let i = 1; i <= 4; i++) { const p = (i / 4) * Math.PI / 2; prof.push([r * Math.cos(p), ys + r * Math.sin(p)]); }
    B.lathe(key, 0, 0, prof, { inside: true, a0: Math.PI / 2, a1: Math.PI * 1.5, seg, crease: 0.9 });
  };
  /** cornice profile [[r, y], ...] from wall radius r0 at y0, projecting `pr`, height h (soffit included) */
  const cornice = (r0, y0, pr, h, rTop, key = 'radPale') => [
    [r0, y0, key], [r0 + 0.06, y0], [r0 + 0.06, y0 + 0.12 * h], [r0 + 0.3 * pr, y0 + 0.36 * h], [r0 + pr, y0 + 0.42 * h],
    [r0 + pr, y0 + 0.78 * h], [r0 + pr - 0.1, y0 + 0.9 * h], [r0 + pr - 0.14, y0 + h], [rTop, y0 + h]];

  // ------------------------------------------------------------------------------------------- ground stage, bay k
  function groundBay(B, k, q) {
    const t = tBay(k), proj = k % 2 === 1, door = k === 0, y1 = 9.3;
    B.push(F(t, D.A));
    if (q === 0) {
      const holes = proj ? [] : door ? [archPts(0, D.door.w, D.plinth, D.door.spring, 10)] : [archPts(0, 1.7, 2.3, 5.3, 8)];
      B.face('rustic', rectPts(-Lf / 2, D.plinth, Lf / 2, y1), holes, 0);
      if (proj) {
        const w = 4.5, d = 0.5, aw = 2.5, ys = 5.35, top = 7.85, arch = archPts(0, aw, 1.05, ys, 12);
        B.face('rustic', rectPts(-w / 2, D.plinth, w / 2, top), [arch], d);
        for (const s of [-1, 1]) B.poly('rustic', [[s * w / 2, D.plinth, 0], [s * w / 2, D.plinth, d], [s * w / 2, top, d], [s * w / 2, top, 0]], [s, 0, 0]);
        B.push(new THREE.Matrix4().makeTranslation(0, 0, d)); B.reveal('radHoney', arch, 0, -0.42); B.pop();
        B.unit('archIron', arch, d - 0.42, litBay());
        archBand(B, 'radPale', 0, ys, aw / 2 + 0.18, 0.18, d, 0.07, 10);
        B.box('radPale', 0, ys + aw / 2 + 0.42, d + 0.09, 0.55, 0.85, 0.18, 0, { bottom: true });            // keystone
        for (const s of [-1, 1]) B.box('radPale', s * (aw / 2 + 0.22), ys - 0.1, d + 0.06, 0.52, 0.22, 0.12, 0, { bottom: true });   // imposts
        B.box('radPale', 0, 0.98, d + 0.1, aw + 0.5, 0.14, 0.2, 0, { bottom: true });                        // sill
        // pediment: a horizontal cornice (with its soffit), raking cornices, the tympanum
        const py = top, ph = 0.95, hw = w / 2 + 0.25;
        B.box('radPale', 0, py + 0.13, d / 2 + 0.12, w + 0.5, 0.26, d + 0.24, 0, { bottom: true });
        B.poly('radHoney', [[-hw + 0.25, py + 0.26, d + 0.02], [hw - 0.25, py + 0.26, d + 0.02], [0, py + 0.26 + ph - 0.15, d + 0.02]], [0, 0, 1]);
        for (const s of [-1, 1]) B.sweep('radPale', [[s * hw, py + 0.26, 0], [0, py + 0.26 + ph, 0]], [[-0.12, -0.04], [-0.12, d + 0.24], [0.12, d + 0.24], [0.12, -0.04]], [0, 0, 1]);
      } else if (door) {
        // (one doorway: the arch is the size of the real oak leaf behind it — the leaf is the room's, core/_doors.js)
        const arch = archPts(0, D.door.w, D.plinth, D.door.spring, 10), dr = D.door.w / 2;
        B.reveal('radHoney', arch, 0, -D.door.rec); B.unit('archDoorOak', arch, -D.door.rec, litBay());
        archBand(B, 'radPale', 0, D.door.spring, dr + 0.18, 0.18, 0, 0.08, 10);
        B.box('radPale', 0, D.door.spring + dr + 0.42, 0.09, 0.5, 0.8, 0.18, 0, { bottom: true });
        for (const s of [-1, 1]) B.box('radPale', s * (dr + 0.2), D.door.spring - 0.1, 0.05, 0.46, 0.2, 0.1, 0, { bottom: true });   // imposts
        for (let s = 0; s < 4; s++) { const yt = D.plinth - 0.155 * s; B.box('radPale', 0, yt / 2, 0.62 + 0.36 * (s + 0.5), 3.8 + s * 0.45, yt, 0.38); }
        for (const s of [-1, 1]) B.box('radPale', s * 2.25, 0.55, 1.6, 0.5, 1.1, 2.0, 0, { bottom: false });   // the step cheeks
      } else {
        B.push(new THREE.Matrix4().makeTranslation(0, 0, 0)); niche(B, 0.85, 2.3, 5.3, 6); B.pop();
        archBand(B, 'radPale', 0, 5.3, 1.03, 0.17, 0, 0.07, 8);
        B.box('radPale', 0, 6.35, 0.08, 0.45, 0.65, 0.16, 0, { bottom: true });
        B.box('radPale', 0, 2.2, 0.1, 2.1, 0.18, 0.2, 0, { bottom: true });
        for (const s of [-1, 1]) B.box('radPale', s * 1.06, 5.25, 0.05, 0.44, 0.2, 0.1, 0, { bottom: true });
      }
    } else {
      B.poly('rustic', [[-Lf / 2, D.plinth, 0], [Lf / 2, D.plinth, 0], [Lf / 2, y1, 0], [-Lf / 2, y1, 0]], [0, 0, 1]);
      if (proj) {
        const w = 4.5, d = 0.5, top = 7.85;
        B.box('rustic', 0, (D.plinth + top) / 2, d / 2, w, top - D.plinth, d, 0, { top: false });
        B.unit('archIron', archPts(0, 2.5, 1.05, 5.35, 6), d + 0.02, litBay());
        B.box('radPale', 0, top + 0.13, d / 2 + 0.12, w + 0.5, 0.26, d + 0.24, 0, { bottom: q === 1 });
        B.poly('radPale', [[-w / 2 - 0.25, top + 0.26, d + 0.2], [w / 2 + 0.25, top + 0.26, d + 0.2], [0, top + 1.2, d + 0.2]], [0, 0, 1]);
        if (q === 1) for (const s of [-1, 1]) B.poly('radPale', [[s * (w / 2 + 0.25), top + 0.26, d + 0.2], [0, top + 1.2, d + 0.2], [0, top + 1.2, -0.05], [s * (w / 2 + 0.25), top + 0.26, -0.05]], [s * 0.4, 1, 0]);
      } else if (door) B.unit('archDoor', archPts(0, D.door.w, D.plinth, D.door.spring, 6), 0.02, litBay());
      else if (q === 1) B.unit('radGroove', archPts(0, 1.7, 2.3, 5.3, 6), 0.02, [0, 0]);
    }
    B.pop();
    // plinth and the stage cornice (faceted with the 16 faces, carried round over the projections)
    const fa = { facet: true, seg: 1, a0: t - step / 2, a1: t + step / 2 };
    if (q === 0) {
      B.lathe('radPale', cx, cz, [[D.A + 0.5, 0], [D.A + 0.5, 0.3], [D.A + 0.32, 0.42], [D.A + 0.32, 0.5], [D.A + 0.06, D.plinth], [D.A, D.plinth]], fa);
      B.lathe('radPale', cx, cz, cornice(D.A, y1, 0.75, D.ground - y1, D.Rc - 0.2), fa);
    } else {
      B.lathe('radPale', cx, cz, [[D.A + 0.45, 0], [D.A + 0.45, D.plinth], [D.A, D.plinth]], fa);
      B.lathe('radPale', cx, cz, [[D.A, y1], [D.A + 0.75, y1 + 0.3], [D.A + 0.75, D.ground], [D.Rc - 0.2, D.ground]], fa);
    }
  }

  // ------------------------------------------------------------------------------------------- column stage, bay k
  const yW0 = 11.3, yW1 = D.ent[0];
  function upperBay(B, k, q) {
    const wide = k % 2 === 1, tA = pairA(k - 1), tB = pairA(k);
    const [x0, z0] = at(tA, D.Rc), [x1, z1] = at(tB, D.Rc), L = Math.hypot(x1 - x0, z1 - z0);
    B.push(frame((x0 + x1) / 2, 0, (z0 + z1) / 2, (x1 - x0) / L, (z1 - z0) / L));
    const mez = wide ? rectPts(-0.8, 11.75, 0.8, 13.05) : rectPts(-0.58, 11.75, 0.58, 12.85);
    const tall = rectPts(-1.05, 14.3, 1.05, 19.1), nch = archPts(0, 1.3, 14.5, 17.9, 8);
    if (q === 0) {
      B.face('radHoney', rectPts(-L / 2, yW0, L / 2, yW1), wide ? [mez, tall] : [mez, nch], 0);
      opening(B, 'sash', mez, 0.3, litBay());
      const frameAround = (pts, w, dz) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), xa = Math.min(...xs), xb = Math.max(...xs), ya = Math.min(...ys), yb = Math.max(...ys);
        B.box('radPale', (xa + xb) / 2, yb + w / 2, dz / 2, xb - xa + 2 * w, w, dz, 0, { bottom: true });
        for (const s of [xa - w / 2, xb + w / 2]) B.box('radPale', s, (ya + yb) / 2, dz / 2, w, yb - ya, dz, 0, { top: false });
        return [xa, xb, ya, yb]; };
      frameAround(mez, 0.16, 0.07);
      B.box('radPale', 0, 11.68, 0.09, (wide ? 1.6 : 1.16) + 0.5, 0.12, 0.18, 0, { bottom: true });
      if (wide) {
        opening(B, 'sash', tall, 0.32, litBay());
        frameAround(tall, 0.22, 0.09);
        B.box('radPale', 0, 14.2, 0.12, 2.9, 0.16, 0.24, 0, { bottom: true });                                     // sill
        for (const s of [-1, 1]) B.box('radPale', s * 1.42, 18.85, 0.14, 0.22, 0.75, 0.28, 0, { bottom: true });  // consoles
        B.box('radPale', 0, 19.42, 0.17, 3.2, 0.2, 0.34, 0, { bottom: true });                                     // cornice
        if (k % 4 === 1) {   // triangular pediment
          B.poly('radHoney', [[-1.45, 19.52, 0.05], [1.45, 19.52, 0.05], [0, 20.2, 0.05]], [0, 0, 1]);
          for (const s of [-1, 1]) B.sweep('radPale', [[s * 1.62, 19.52, 0], [0, 20.38, 0]], [[-0.09, 0], [-0.09, 0.32], [0.09, 0.32], [0.09, 0]], [0, 0, 1]);
        } else {             // segmental pediment
          const path = []; for (let i = 0; i <= 6; i++) { const a = Math.PI * (0.8 - 0.6 * (i / 6)); path.push([Math.cos(a) * 2.0, 18.95 + Math.sin(a) * 1.35, 0]); }
          B.sweep('radPale', path, [[-0.1, 0], [-0.1, 0.32], [0.1, 0.32], [0.1, 0]], [0, 0, 1]);
          const fan = []; for (let i = 0; i <= 6; i++) fan.push(path[i]);
          for (let i = 0; i < 6; i++) B.poly('radHoney', [[0, 19.52, 0.05], [fan[i][0], Math.max(19.52, fan[i][1] - 0.1), 0.05], [fan[i + 1][0], Math.max(19.52, fan[i + 1][1] - 0.1), 0.05]], [0, 0, 1]);
        }
      } else {
        niche(B, 0.65, 14.5, 17.9, 6);
        archBand(B, 'radPale', 0, 17.9, 0.78, 0.13, 0, 0.06, 8);
        B.box('radPale', 0, 14.42, 0.1, 1.8, 0.16, 0.2, 0, { bottom: true });
        B.box('radPale', 0, 18.75, 0.07, 0.38, 0.5, 0.14, 0, { bottom: true });
      }
    } else {
      B.poly('radHoney', [[-L / 2, yW0, 0], [L / 2, yW0, 0], [L / 2, yW1, 0], [-L / 2, yW1, 0]], [0, 0, 1]);
      B.unit('sash', mez, 0.03, litBay());
      if (wide) {
        B.unit('sash', tall, 0.03, litBay());
        B.box('radPale', 0, 19.42, 0.17, 3.2, 0.2, 0.34, 0, { bottom: false });
        B.poly('radPale', [[-1.6, 19.52, 0.2], [1.6, 19.52, 0.2], [0, 20.3, 0.2]], [0, 0, 1]);
      } else B.unit('radGroove', nch, 0.03, [0, 0]);
    }
    B.pop();
    // podium under the column stage (a smooth ring between the pairs)
    const seg = q === 0 ? 4 : 2, la = { a0: tA, a1: tB, seg };
    if (q === 0) B.lathe('radHoney', cx, cz, [[15.3, D.ground, 'radPale'], [15.3, D.ground + 0.1, 'radPale'], [15.18, D.ground + 0.2], [15.18, 11.08, 'radPale'], [15.3, 11.16, 'radPale'], [15.3, yW0, 'radPale'], [D.Rc * Math.cos(step / 2 + D.delta) - 0.05, yW0]], la);
    else B.lathe('radHoney', cx, cz, [[15.25, D.ground], [15.25, yW0], [14.6, yW0]], la);
  }

  // ------------------------------------------------------------------------------------------- column pair j
  const shaftProf = (y0, y1) => {
    const H = y1 - y0;
    return [[0.52, y0], [0.52, y0 + 0.08], [0.45, y0 + 0.18], [0.425, y0 + 0.3], [0.425, y0 + 0.2 * H], [0.405, y0 + 0.55 * H], [0.36, y1 - 0.13], [0.4, y1 - 0.08], [0.36, y1]];
  };
  function pair(B, j, q) {
    const tp = pairA(j), cap0 = 20.5, capT = yW1 - 0.14;
    // the pedestal die under the pair
    B.push(F(tp, D.Rcol));
    if (q === 0) {
      B.box('radHoney', 0, (D.ground + yW0) / 2, -0.05, 2.55, yW0 - D.ground, 1.15, 0, { top: false });
      B.box('radPale', 0, D.ground + 0.07, 0.0, 2.75, 0.14, 1.3, 0, { top: true });
      B.box('radPale', 0, yW0 - 0.07, 0.0, 2.75, 0.14, 1.3, 0, { top: true, bottom: true });
      B.box('radPale', 0, yW0 + 0.07, 0.0, 2.45, 0.14, 1.05, 0, { top: true });                                    // the columns' plinths
    } else B.box('radHoney', 0, (D.ground + yW0) / 2, -0.05, 2.55, yW0 - D.ground, 1.15, 0, { top: false });
    B.pop();
    for (const s of [-1, 1]) {
      const tt = tp + s * (0.62 / D.Rcol), [x, z] = at(tt, D.Rcol);
      if (q === 0) {
        B.lathe('radPale', x, z, shaftProf(yW0 + 0.14, cap0), { seg: 8, crease: 0.55 });
        // Corinthian capital: an acanthus bell, eight out-curling leaves, angle volutes, a concave abacus
        B.lathe('radPale', x, z, [[0.36, cap0, 'leaf', true], [0.42, capT - 0.08], [0.48, capT - 0.02], [0.3, capT]], { seg: 8, crease: 0.4 });
        for (let i = 0; i < 8; i++) {
          const a = tt + (i / 8) * TAU, sa = Math.sin(a), ca = Math.cos(a), ta = [ca, -sa];
          const b0 = [x + sa * 0.36, cap0 + 0.02, z + ca * 0.36], b1 = [x + sa * 0.5, cap0 + 0.36, z + ca * 0.5];
          B.poly('leaf', [[b0[0] - ta[0] * 0.13, b0[1], b0[2] - ta[1] * 0.13], [b0[0] + ta[0] * 0.13, b0[1], b0[2] + ta[1] * 0.13], [b1[0] + ta[0] * 0.1, b1[1], b1[2] + ta[1] * 0.1], [b1[0] - ta[0] * 0.1, b1[1], b1[2] - ta[1] * 0.1]], [sa, 0.4, ca], [[0, 0], [0.16, 0], [0.16, 1], [0, 1]]);
        }
        for (let i = 0; i < 4; i++) { const a = tt + Math.PI / 4 + (i / 4) * TAU; B.box('radPale', x + Math.sin(a) * 0.5, capT - 0.17, z + Math.cos(a) * 0.5, 0.2, 0.26, 0.2, a, { top: false }); }
        B.box('radPale', x, capT + 0.07, z, 1.08, 0.14, 1.08, tt, { bottom: true });
      } else {
        B.lathe('radPale', x, z, [[0.42, yW0], [0.36, cap0, 'leaf', true], [0.47, capT], [0.0, capT]], { seg: q === 1 ? 5 : 4, crease: 0.3 });
      }
    }
  }

  // ------------------------------------------------------------------------------------------- entablature + balustrade, arc between pairs
  const [e0, e1] = D.ent, rB = 15.85;
  const entProf = (q) => q === 0 ? [
    [14.6, e0, 'radHoney'], [15.6, e0, 'radHoney'], [15.6, e0 + 0.3, 'radHoney'], [15.66, e0 + 0.34, 'radHoney'], [15.66, e0 + 0.6, 'radPale'], [15.72, e0 + 0.64, 'radPale'], [15.72, e0 + 0.7, 'radHoney'],
    [15.58, e0 + 0.72, 'radHoney'], [15.58, e0 + 1.02, 'radPale'], [15.66, e0 + 1.06, 'dentil', true], [15.74, e0 + 1.2, 'radPale'], [15.76, e0 + 1.22, 'radPale'],
    [16.25, e1 - 0.32, 'radPale'], [16.25, e1 - 0.12, 'radPale'], [16.12, e1 - 0.03, 'radPale'], [16.05, e1, 'radPale'], [rB - 0.25, e1]] : [
    [14.6, e0, 'radHoney'], [15.62, e0, 'radHoney'], [15.62, e0 + 1.1, 'dentil', true], [15.74, e0 + 1.24, 'radPale'], [16.25, e1 - 0.3, 'radPale'], [16.25, e1, 'radPale'], [rB - 0.25, e1]];
  function entablature(B, k, q) {
    const tA = pairA(k - 1), tB = pairA(k), seg = q === 0 ? Math.max(3, Math.ceil((tB - tA) / (TAU / 72))) : 1;
    B.lathe('radPale', cx, cz, entProf(q), { a0: tA, a1: tB, seg, crease: 0.35 });
    // balustrade: plinth, balusters (or a painted band), coping; dies + urns over the pairs
    const y0 = e1, yP = y0 + 0.27, yC = D.bal - 0.35;
    const hw = 1.3 / rB;
    if (q === 0) {
      B.lathe('radPale', cx, cz, [[rB - 0.3, y0], [rB + 0.04, y0], [rB + 0.04, yP - 0.06], [rB, yP], [rB - 0.32, yP], [rB - 0.32, y0]], { a0: tA, a1: tB, seg, crease: 0.3 });
      B.lathe('radPale', cx, cz, [[rB - 0.34, yC], [rB + 0.1, yC], [rB + 0.12, yC + 0.22], [rB + 0.04, D.bal], [rB - 0.38, D.bal], [rB - 0.38, yC + 0.05], [rB - 0.34, yC]], { a0: tA, a1: tB, seg, crease: 0.3 });
      const s0 = tA + hw, s1 = tB - hw, n = Math.max(1, Math.floor(((s1 - s0) * rB) / 0.31));
      for (let i = 0; i < n; i++) {
        const t = s0 + ((i + 0.5) / n) * (s1 - s0), [x, z] = at(t, rB - 0.12);
        B.lathe('radPale', x, z, [[0.11, yP], [0.15, yP + 0.3], [0.07, yC - 0.26], [0.12, yC]], { seg: 5, a0: t, a1: t + TAU, crease: 0.9 });
      }
    } else {
      B.lathe('radPale', cx, cz, [[rB, y0], [rB, yP, 'balus', true], [rB, yC, 'radPale'], [rB + 0.1, yC], [rB + 0.1, D.bal], [rB - 0.38, D.bal], [rB - 0.38, y0 + 0.3]], { a0: tA, a1: tB, seg: q === 1 ? 2 : 1, crease: 0.1 });
    }
    // the die and urn over pair k
    const tp = tB;
    B.push(F(tp, rB - 0.1));
    B.box('radPale', 0, (y0 + D.bal) / 2 - 0.06, 0, 2.6, D.bal - y0 - 0.12, 0.8, 0, { top: false });
    B.box('radPale', 0, D.bal - 0.06, 0.02, 2.8, 0.14, 0.95, 0, { bottom: q === 0 });
    B.pop();
    const [ux, uz] = at(tp, rB - 0.1), yU = D.bal;
    if (q === 0) B.lathe('radPale', ux, uz, [[0.36, yU], [0.36, yU + 0.1], [0.2, yU + 0.18], [0.14, yU + 0.3], [0.3, yU + 0.48], [0.4, yU + 0.72], [0.36, yU + 0.92], [0.2, yU + 1.08], [0.12, yU + 1.25], [0, yU + 1.55]], { seg: 8, crease: 0.6 });
    else if (q === 1) B.lathe('radPale', ux, uz, [[0.3, yU], [0.4, yU + 0.7], [0.15, yU + 1.1], [0, yU + 1.5]], { seg: 4, crease: 0.9 });
  }

  // ------------------------------------------------------------------------------------------- the top: terrace, drum, buttresses, dome, ribs, lantern
  function top(B, q) {
    const seg = q === 0 ? 40 : q === 1 ? 24 : 20, yT = e1;
    // lead terrace behind the balustrade
    B.lathe('radLead', cx, cz, [[rB - 0.38, yT + 0.02], [D.R3 + 0.3, yT + 0.02]], { seg: q === 2 ? 16 : 32 });
    // attic drum with its cornice
    const dc = D.drum - 0.75;
    B.lathe('radHoney', cx, cz, q > 0 ? [[D.R3, yT], [D.R3, dc], [D.R3 + 0.45, dc + 0.4, 'radPale'], [D.R3 + 0.45, D.drum, 'radPale'], [D.domeR + 0.3, D.drum]]
      : [[D.R3 + 0.18, yT, 'radPale'], [D.R3 + 0.18, yT + 0.35, 'radPale'], [D.R3, yT + 0.45], [D.R3, dc], ...cornice(D.R3, dc, 0.5, 0.75, D.domeR + 0.3).slice(1)], { seg, crease: 0.4, a0: a0, a1: a0 + TAU });
    // attic windows: one small window per bay between the buttresses (16), two in each wide bay's interval
    if (q < 2) for (let k = 0; k < D.bays; k++) {
      if (k % 2 === 0) continue;   // narrow bays carry the buttresses
      for (const s of [-1, 1]) {
        const t = tBay(k) + s * step * 0.3;
        B.push(F(t, D.R3 + 0.02));
        B.unit('sash', rectPts(-0.55, yT + 1.4, 0.55, yT + 3.2), 0.0, litBay());
        B.pop();
      }
    }
    // eight scrolled buttresses over the narrow bays (concave fronts, a volute at the foot)
    for (let k = 0; k < D.bays; k += 2) {
      const t = tBay(k), half = q === 0 ? 0.42 : 0.4;
      const N = q === 0 ? 8 : 3, front = [];
      for (let i = 0; i <= N; i++) { const s = i / N; front.push([D.R3 + 0.1 + 2.7 * Math.pow(1 - s, 1.7), yT + 0.6 + (dc - 0.2 - yT - 0.6) * s]); }
      B.push(F(t, 0));
      const outline = [[D.R3 - 0.05, yT], [front[0][0], yT], ...front, [D.R3 - 0.05, dc - 0.2]];
      for (const sx of [-1, 1]) {
        B.push(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -sx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(sx, 0, 0)).setPosition(sx * half, 0, 0));
        B.face('radHoney', outline.map(([r, y]) => [-sx * r, y]));
        B.pop();
      }
      for (let i = 0; i < N; i++) {
        const [r0, y0] = front[i], [r1, y1] = front[i + 1], nr = y1 - y0, ny = -(r1 - r0), l = Math.hypot(nr, ny);
        B.poly(i === N - 1 ? 'radPale' : 'radHoney', [[-half, y0, r0], [half, y0, r0], [half, y1, r1], [-half, y1, r1]], [0, ny / l, nr / l]);
      }
      B.poly('radHoney', [[-half, yT, front[0][0]], [half, yT, front[0][0]], [half, front[0][1], front[0][0]], [-half, front[0][1], front[0][0]]], [0, 0, 1]);
      if (q === 0) {
        // the volute: a short horizontal drum across the foot, and a smaller one where the scroll meets the drum
        const vol = (r, y, rad) => { const n = 8; for (let i = 0; i < n; i++) { const p0 = (i / n) * TAU, p1 = ((i + 1) / n) * TAU, pm = (p0 + p1) / 2;
          const pt = (p, x) => [x, y + Math.sin(p) * rad, r + Math.cos(p) * rad];
          B.poly('radPale', [pt(p0, -half - 0.04), pt(p1, -half - 0.04), pt(p1, half + 0.04), pt(p0, half + 0.04)], [0, Math.sin(pm), Math.cos(pm)]);
          for (const sx of [-1, 1]) B.poly('radPale', [[sx * (half + 0.04), y, r], pt(p0, sx * (half + 0.04)), pt(p1, sx * (half + 0.04))], [sx, 0, 0]); } };
        vol(front[0][0] - 0.25, yT + 0.75, 0.5); vol(D.R3 + 0.45, dc - 0.45, 0.32);
      }
      B.pop();
    }
    // the dome: two stepped lead rings, then a quarter ellipse to the lantern's foot
    const rings = q === 0 ? 12 : q === 1 ? 8 : 6, pTop = Math.acos(D.domeEnd / D.domeR), dy = (p) => D.domeY + D.domeH * Math.pow(Math.sin(p), D.domeK);
    const dome = [[D.domeR + 0.3, D.drum], [D.domeR + 0.3, D.drum + 0.08], [D.domeR + 0.12, D.drum + 0.12], [D.domeR + 0.12, D.domeY - 0.04], [D.domeR, D.domeY]];
    if (q === 2) dome.splice(1, 3);
    for (let i = 1; i <= rings; i++) { const p = (i / rings) * pTop; dome.push([D.domeR * Math.cos(p), dy(p)]); }
    B.lathe('radLead', cx, cz, dome, { seg: q === 0 ? 48 : q === 1 ? 24 : 20, crease: 0.3, a0, a1: a0 + TAU });
    // the eight major ribs, over the buttresses
    if (q < 2) for (let k = 0; k < D.bays; k += 2) {
      const t = tBay(k), n = q === 0 ? 10 : 5, path = [];
      for (let i = 0; i <= n; i++) { const p = (i / n) * (pTop - 0.02); const r = D.domeR * Math.cos(p) + 0.02, y = dy(p); path.push([r, y, p]); }
      const w = 0.36, h = q === 0 ? 0.3 : 0.24;
      for (let i = 0; i < n; i++) {
        const [r0, y0, p0] = path[i], [r1, y1, p1] = path[i + 1];
        // outward normal of the profile at each end (perpendicular to its tangent)
        const nrm = (p) => { const e = 1e-3, tr = D.domeR * (Math.cos(p + e) - Math.cos(p - e)), ty = dy(p + e) - dy(p - e), l = Math.hypot(tr, ty); return [ty / l, -tr / l]; };
        const n0 = nrm(Math.max(p0, 0.004)), n1 = nrm(p1);
        const W = (r, y, nn, s, o) => { const rr = r + nn[0] * o, yy = y + nn[1] * o, ws = s / Math.max(rr, 0.5); return [cx + Math.sin(t + ws) * rr, yy, cz + Math.cos(t + ws) * rr]; };
        const N3 = (nn) => [Math.sin(t) * nn[0], nn[1], Math.cos(t) * nn[0]], Ts = [Math.cos(t), 0, -Math.sin(t)], Tn = [-Math.cos(t), 0, Math.sin(t)];
        B.quadN('radLeadLt', W(r0, y0, n0, -w, h), W(r0, y0, n0, w, h), W(r1, y1, n1, w, h), W(r1, y1, n1, -w, h), N3(n0), N3(n0), N3(n1), N3(n1), [0, i * 0.8], [0.6, i * 0.8], [0.6, (i + 1) * 0.8], [0, (i + 1) * 0.8]);
        for (const sx of [-1, 1]) B.quadN('radLead', W(r0, y0, n0, sx * w, 0), W(r1, y1, n1, sx * w, 0), W(r1, y1, n1, sx * w, h), W(r0, y0, n0, sx * w, h), sx > 0 ? Ts : Tn, sx > 0 ? Ts : Tn, sx > 0 ? Ts : Tn, sx > 0 ? Ts : Tn, [i * 0.8, 0], [(i + 1) * 0.8, 0], [(i + 1) * 0.8, 0.3], [i * 0.8, 0.3]);
      }
    }
    // the lantern: a base ring on the dome, an octagon with round-headed openings, engaged shafts, entablature, lead cupola
    const lY = D.lanY, lR = D.lanR, lE = D.lanTop - 0.5, oct = { facet: true, seg: 8, a0: a0 + Math.PI / 8, a1: a0 + Math.PI / 8 + TAU };
    B.lathe('radPale', cx, cz, [[lR + 0.65, lY - 0.5], [lR + 0.65, lY + 0.25], [lR + 0.35, lY + 0.35], [lR, lY + 0.35]], oct);
    if (q === 0) {
      const Lo = 2 * lR * Math.tan(Math.PI / 8);
      for (let i = 0; i < 8; i++) {
        const t = a0 + (i / 8) * TAU + Math.PI / 8 + Math.PI / 8;
        B.push(F(t, lR));
        const op = archPts(0, 0.9, lY + 0.7, lE - 1.0, 8);
        B.face('radPale', rectPts(-Lo / 2, lY + 0.35, Lo / 2, lE), [op], 0);
        B.reveal('radPale', op, 0, -0.35); B.unit('radShade', op, -0.35, [0, 0]);
        B.pop();
        const [x, z] = at(t + Math.PI / 8, lR / Math.cos(Math.PI / 8) + 0.05);
        B.lathe('radPale', x, z, [[0.16, lY + 0.35], [0.12, lE - 0.25], [0.17, lE - 0.05], [0.0, lE]], { seg: 5, crease: 0.6 });
      }
      B.lathe('radPale', cx, cz, [[lR, lE], ...cornice(lR, lE, 0.32, 0.5, lR - 0.35).slice(1)], oct);
    } else {
      B.lathe('radPale', cx, cz, [[lR, lY + 0.35], [lR, lE], [lR + 0.3, lE + 0.2], [lR + 0.3, lE + 0.5], [lR - 0.35, lE + 0.5]], oct);
      if (q === 1) for (let i = 0; i < 8; i++) { const t = a0 + (i / 8) * TAU + Math.PI / 4; B.push(F(t, lR + 0.02)); B.unit('radShade', archPts(0, 0.9, lY + 0.7, lE - 1.0, 4), 0, [0, 0]); B.pop(); }
    }
    // cupola (an ogee in lead), ball and finial
    const cr = lR - 0.1, cu = [[cr, D.lanTop], [cr - 0.1, D.lanTop + 0.2], [cr * 0.78, D.lanTop + 0.55], [cr * 0.49, D.lanTop + 0.95], [0.45, D.lanTop + 1.15], [0.22, D.lanTop + 1.3]];
    B.lathe('radLead', cx, cz, q === 2 ? [[cr, D.lanTop], [cr * 0.58, D.lanTop + 0.9], [0.15, D.lanTop + 1.3], [0, D.top]] : [...cu, [0.0, D.lanTop + 1.32]], { seg: q === 0 ? 16 : 8, crease: 0.7 });
    if (q < 2) B.lathe('radLeadLt', cx, cz, [[0, D.lanTop + 1.3], [0.12, D.lanTop + 1.32], [0.1, D.lanTop + 1.45], [0.26, D.lanTop + 1.6], [0.27, D.lanTop + 1.75], [0.16, D.lanTop + 1.9], [0.06, D.lanTop + 1.95], [0.05, D.top - 0.25], [0.11, D.top - 0.15], [0, D.top]], { seg: q === 0 ? 6 : 4, crease: 0.9 });
  }

  // ------------------------------------------------------------------------------------------- the far silhouette (~1k triangles)
  function far(B) {
    B.lathe('rustic', cx, cz, [[D.A + 0.45, 0, 'radPale'], [D.A + 0.45, D.plinth, 'radPale'], [D.A, D.plinth], [D.A, 9.3], [D.A + 0.75, 9.6, 'radPale'], [D.A + 0.75, D.ground, 'radPale'], [15.25, D.ground]], { facet: true, seg: 16, a0: a0 - step / 2, a1: a0 - step / 2 + TAU, crease: 0.1 });
    for (let k = 1; k < D.bays; k += 2) { B.push(F(tBay(k), D.A)); B.box('rustic', 0, 4.2, 0.25, 4.5, 7.2, 0.5, 0, { top: true }); B.unit('archIron', archPts(0, 2.5, 1.05, 5.35, 4), 0.52, litBay()); B.pop(); }
    B.lathe('radHoney', cx, cz, [[15.25, D.ground, 'radPale'], [15.25, yW0, 'radPale'], [14.8, yW0], [14.8, e0], [15.62, e0 + 0.02, 'radPale'], [15.62, e0 + 1.1, 'radPale'], [16.2, e1, 'radPale'], [rB, e1, 'radPale'], [rB, D.bal, 'balus', true], [rB - 0.4, D.bal]], { seg: 32, a0, a1: a0 + TAU, crease: 0.1 });
    for (let j = 0; j < D.pairs; j++) { B.push(F(pairA(j), D.Rcol)); B.box('radPale', 0, (yW0 + e0) / 2, 0, 1.9, e0 - yW0, 0.7, 0, { top: false }); B.pop(); }
    top(B, 2);
  }

  // ------------------------------------------------------------------------------------------- register with the LOD
  const lod = ctx.lod;
  const G = lod.group('camera', [cx, 21, cz], 27, [95, 140, 1150], { facingR: 16.3, facingPad: Math.PI / D.bays + 0.14 });
  for (let k = 0; k < D.bays; k++) {
    const B = new RB();
    groundBay(B, k, 0); upperBay(B, k, 0); pair(B, k, 0); entablature(B, k, 0);
    const t = tBay(k);
    G.add(0, geoOf(B, P), { n: [Math.sin(t), Math.cos(t)], top: D.bal + 1.6, name: 'camera:sector' + k });
  }
  { const B = new RB(); top(B, 0); G.add(0, geoOf(B, P), { name: 'camera:top' }); }
  { const B = new RB(); for (let k = 0; k < D.bays; k++) { groundBay(B, k, 1); upperBay(B, k, 1); pair(B, k, 1); entablature(B, k, 1); } top(B, 1); G.add(1, geoOf(B, P), { name: 'camera:mid' }); }
  { const B = new RB(); far(B); G.add(2, geoOf(B, P), { name: 'camera:far' }); }
  const tris = (lv) => G.chunks.filter((c) => c.level === lv).reduce((s, c) => s + c.count / 3, 0);
  return { meshes: [], dims: { ...CAMERA, centre: [cx, cz], entranceAngle: a0, tris: [tris(0), tris(1), tris(2)] }, door: at(a0, D.R + 2.4), litWindows: lit };
}
