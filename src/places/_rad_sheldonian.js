import * as THREE from 'three';
// The Sheldonian Theatre (Wren, 1664-69) rebuilt plain on its mapped D-shaped footprint, its octagonal cupola (1838),
// the Emperors' Heads on their piers along Broad Street (13 + 4 in front of the Old Ashmolean, at the mapped artwork
// points), and the nine lead Muses on the Clarendon Building's roofline.  build(ctx) -> { meshes, dims, heads, muses }
import { RB, frame, rectPts, archPts, bayLit, TAU, strHash, flatUp, pack } from './_rad_kit.js';
import { geoOf } from './_rad_lod.js';
import { ROOFSCAPE } from '../world/landmarks.js';

export const ID = 'w27582068', CLARENDON = 'w29387139';
export const SHELD = { wall: 13.0, string: 6.4, bal: 14.0, roofTop: 17.4, cupR: 3.3, cupY: 17.0, cupTop: 21.2, domeTop: 23.6, top: 25.0, pier: 2.2, head: 0.75, pierW: 0.62, headK: 1 };
// photo comparison item 14 (sheldonian): the piers are about 3.5 m and the heads about 1.2 m (were 2.2 m and 0.75 m);
// measured against the people in the photograph. ?roofs=0 keeps the old size.
if (ROOFSCAPE) Object.assign(SHELD, { pier: 3.4, head: 1.2, pierW: 0.9, headK: 1.6 });
const HEAD_IDS = ['n1297497296', 'n1297497316', 'n1052886478', 'n323259595', 'n1297497284', 'n4117376837', 'n1260357348', 'n1260357318', 'n1260357333', 'n1297497319', 'n1297497302', 'n1260357352', 'n1297497311', // 13 at the theatre
  'n1052886918', 'n13012121392', 'n13012121391', 'n1052886520'];                                                                                                                               // 4 at the Old Ashmolean
const LIT = []; for (let i = 4000; i < 6000 && LIT.length < 20; i++) if (bayLit(i, 0) < 0.1) LIT.push(i);

/** pure: the heads' positions and which way each faces (out to Broad Street) */
export function headSpots(map) {
  const sh = map.buildings.find((b) => b.id === ID), c = sh ? sh.c : [343, 73];
  const out = [];
  for (const id of HEAD_IDS) {
    const p = map.pois.find((q) => q.id === id); if (!p) continue;
    const museum = HEAD_IDS.indexOf(id) >= 13;
    const h = museum ? Math.PI : Math.atan2(p.p[0] - c[0], p.p[1] - c[1]);
    out.push({ id, x: p.p[0], z: p.p[1], h, museum, seed: strHash(id) });
  }
  return out;
}

export function build(ctx) {
  const { world, map, lod } = ctx, D = SHELD, PK = pack(world);
  const out = { meshes: [] };
  const sh = map.buildings.find((b) => b.id === ID);
  let li = 0;
  function theatre(B, q) {
    if (!sh) return;
    li = 0;
    const P = sh.poly, n = P.length, c = sh.c;
    let cx = 0, cz = 0; for (const p of P) { cx += p[0] / n; cz += p[1] / n; }
    // south front = the longest edge (straight, facing the Divinity School)
    let si = 0, sl = 0; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > sl) { sl = l; si = i; } }
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.3) continue;
      const ax = (b[0] - a[0]) / L, az = (b[1] - a[1]) / L, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      let nx = -az, nz = ax; if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
      const flip = nx !== -az;                                        // frame's local +z is (-az, ax): outward unless flipped
      B.push(frame(mx, 0, mz, flip ? -ax : ax, flip ? -az : az));
      const hl = L / 2;
      B.poly(i === si ? 'radHoney' : 'rustic', [[-hl, 0, 0], [hl, 0, 0], [hl, D.string, 0], [-hl, D.string, 0]], [0, 0, 1], [[0, 0], [L, 0], [L, D.string], [0, D.string]]);
      B.poly('radHoney', [[-hl, D.string, 0], [hl, D.string, 0], [hl, D.wall, 0], [-hl, D.wall, 0]], [0, 0, 1], [[0, D.string], [L, D.string], [L, D.wall], [0, D.wall]]);
      B.box('radPale', 0, D.string, 0.08, L + 0.02, 0.35, 0.16);
      B.box('radPale', 0, D.wall - 0.25, 0.15, L + 0.05, 0.5, 0.3);
      if (i === si) {
        // the south front: 4 attached Corinthian columns, the central arched doorway, two niches; pilasters above
        for (const x of [-6.3, -2.3, 2.3, 6.3]) { if (Math.abs(x) > hl - 0.5 || q === 2) continue; B.cyl('radPale', x, 0.6, 0.35, 0.36, D.string - 1.1, 10, false, 0.4); B.box('radPale', x, 0.3, 0.35, 1.0, 0.6, 1.0); B.box('radPale', x, D.string - 0.3, 0.35, 1.0, 0.5, 1.0); B.box('radPale', x, (D.string + D.wall) / 2, 0.12, 0.8, D.wall - D.string - 0.6, 0.2); }
        B.unit('archDoorOak', archPts(0, 2.6, 0, 3.4, 10), 0.03, [LIT[li++ % LIT.length], 0]);
        for (const x of [-4.3, 4.3]) B.unit('radGroove', archPts(x, 1.2, 1.6, 4.0, 8), 0.03, [0, 0]);
        for (const x of [-8.6, 8.6]) if (Math.abs(x) < hl - 0.6) B.unit('archSash', archPts(x, 1.6, 1.2, 4.2, 8), 0.03, [LIT[li++ % LIT.length], 0]);
        for (const x of [-4.3, 0, 4.3]) B.unit('sash', rectPts(x - 0.9, D.string + 1.4, x + 0.9, D.wall - 1.4), 0.03, [LIT[li++ % LIT.length], 1]);
        // the pediment over the centre
        B.poly('radPale', [[-4.0, D.wall, 0.3], [4.0, D.wall, 0.3], [0, D.wall + 2.0, 0.3]], [0, 0, 1]);
      } else if (L > 2.2) {
        // curved north end: rusticated lower stage with a round-headed recess holding a square window; two lights above
        if (q === 2) { B.pop(); continue; }
        if (false) for (let y = 0.6; y < D.string - 0.3; y += 0.55) B.poly('radGroove', [[-hl, y, 0.01], [hl, y, 0.01], [hl, y + 0.06, 0.01], [-hl, y + 0.06, 0.01]], [0, 0, 1]);
        const w = Math.min(1.8, L - 0.8);
        B.unit('radGroove', archPts(0, w + 0.3, 0.9, D.string - 1.5, 8), 0.02, [0, 0]);
        B.unit('sash', rectPts(-w / 2 + 0.1, 1.3, w / 2 - 0.1, D.string - 1.6), 0.04, [LIT[li++ % LIT.length], 0]);
        B.unit('sash', rectPts(-w / 2, D.string + 1.2, w / 2, D.wall - 1.4), 0.03, [LIT[li++ % LIT.length], 1]);
        // the balustraded parapet
        B.box('radPale', 0, D.wall + 0.1, 0.1, L, 0.2, 0.5);
        B.box('radPale', 0, D.bal - 0.1, 0.1, L, 0.2, 0.5);
        if (q === 0) for (let k = 0; k < Math.floor(L / 0.45); k++) B.box('radPale', -hl + 0.22 + k * 0.45, (D.wall + D.bal) / 2, 0.1, 0.16, D.bal - D.wall - 0.4, 0.16, 0, { top: false });
      }
      B.pop();
    }
    // the roof: slate slopes from the eaves to a flat lead crown round the cupola
    const k = 0.42, Q = P.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n], qa = Q[i], qb = Q[(i + 1) % n];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.3) continue;
      const mx = (a[0] + b[0]) / 2 - cx, mz = (a[1] + b[1]) / 2 - cz;
      B.poly('slate', [[a[0], D.wall, a[1]], [b[0], D.wall, b[1]], [qb[0], D.roofTop, qb[1]], [qa[0], D.roofTop, qa[1]]], [mx, 6, mz], null, 1);
    }
    flatUp(B, 'radLead', Q, D.roofTop);
    // the cupola (1838): an octagonal drum with round-headed windows between pilasters, a cornice, an ogee lead dome,
    // a little open lantern and a ball
    const oct = { facet: true, seg: 8, a0: 0, a1: TAU, crease: 0.3 };
    if (q === 0) {
      const Lo = 2 * D.cupR * Math.tan(Math.PI / 8);
      for (let j = 0; j < 8; j++) {
        const t = (j + 0.5) / 8 * TAU, ap = D.cupR;
        B.push(frame(cx + Math.sin(t) * ap, 0, cz + Math.cos(t) * ap, Math.cos(t), -Math.sin(t)));
        const w = archPts(0, 1.3, D.cupY + 0.8, D.cupTop - 1.3, 8);
        B.face('radHoney', rectPts(-Lo / 2, D.cupY, Lo / 2, D.cupTop), [w], 0);
        B.reveal('radHoney', w, 0, -0.3); B.unit('archSash', w, -0.3, [LIT[li++ % LIT.length], 1]);
        for (const sx of [-1, 1]) B.box('radPale', sx * (Lo / 2 - 0.12), (D.cupY + D.cupTop) / 2, 0.06, 0.3, D.cupTop - D.cupY, 0.14, 0, { top: false });
        B.box('radPale', 0, D.cupY + 0.7, 0.08, 1.6, 0.12, 0.16, 0, { bottom: true });
        B.pop();
      }
      B.lathe('radPale', cx, cz, [[D.cupR + 0.15, D.cupY - 0.4], [D.cupR + 0.15, D.cupY], [D.cupR, D.cupY]], oct);
      B.lathe('radPale', cx, cz, [[D.cupR, D.cupTop], [D.cupR + 0.08, D.cupTop + 0.05], [D.cupR + 0.12, D.cupTop + 0.15], [D.cupR + 0.42, D.cupTop + 0.22], [D.cupR + 0.42, D.cupTop + 0.4], [D.cupR + 0.3, D.cupTop + 0.48], [D.cupR + 0.05, D.cupTop + 0.5]], oct);
    } else {
      B.lathe('radHoney', cx, cz, [[D.cupR + 0.15, D.cupY - 0.4], [D.cupR, D.cupY], [D.cupR, D.cupTop], [D.cupR + 0.4, D.cupTop + 0.25], [D.cupR + 0.4, D.cupTop + 0.5], [D.cupR + 0.05, D.cupTop + 0.5]], oct);
      if (q === 1) for (let j = 0; j < 8; j++) { const t = (j + 0.5) / 8 * TAU, ap = D.cupR + 0.02; B.push(frame(cx + Math.sin(t) * ap, 0, cz + Math.cos(t) * ap, Math.cos(t), -Math.sin(t))); B.unit('archSash', archPts(0, 1.3, D.cupY + 0.8, D.cupTop - 1.3, 4), 0, [LIT[li++ % LIT.length], 1]); B.pop(); }
    }
    const y0 = D.cupTop + 0.5, dH = D.domeTop - y0, R0 = D.cupR + 0.05;
    const prof = q === 0 ? [[R0, y0], [R0 * 0.99, y0 + 0.2 * dH], [R0 * 0.9, y0 + 0.42 * dH], [R0 * 0.7, y0 + 0.62 * dH], [R0 * 0.42, y0 + 0.8 * dH], [0.62, y0 + 0.93 * dH], [0.5, y0 + dH]]
      : [[R0, y0], [R0 * 0.9, y0 + 0.42 * dH], [R0 * 0.42, y0 + 0.8 * dH], [0.5, y0 + dH]];
    B.lathe('radLead', cx, cz, prof, { facet: true, seg: 8, a0: 0, a1: TAU, crease: 0.7 });
    // the lantern: eight little columns round a drum, a cap, a ball and finial
    const lt = D.domeTop;
    if (q === 0) { for (let j = 0; j < 8; j++) { const t = (j / 8) * TAU; B.lathe('radPale', cx + Math.sin(t) * 0.42, cz + Math.cos(t) * 0.42, [[0.07, lt], [0.06, lt + 0.75], [0, lt + 0.75]], { seg: 4 }); } B.lathe('radGroove', cx, cz, [[0.3, lt], [0.3, lt + 0.75], [0, lt + 0.75]], { seg: 8 }); }
    else B.lathe('radPale', cx, cz, [[0.45, lt], [0.45, lt + 0.75]], { seg: 6 });
    B.lathe('radLeadLt', cx, cz, [[0.55, lt + 0.75], [0.55, lt + 0.85], [0.3, lt + 1.1], [0.1, lt + 1.3], [0.18, lt + 1.42], [0.15, lt + 1.55], [0, lt + 1.6], [0.03, lt + 1.6], [0.03, D.top - 0.15], [0, D.top]], { seg: q === 0 ? 8 : 5, crease: 0.8 });
    out.footprint = P; out.centre = [cx, cz]; void c;
  }
  // ---- the Emperors' Heads (Michael Black's set of 1970-72): square piers with a moulded cap, each bust a different
  // bearded worthy: jaw, brow, beard length and shape, hair or baldness, tilt and turn all seeded by the mapped id
  const heads = headSpots(map);
  function head(B, hd, q) {
    const r = (k) => strHash(hd.id + ':' + k);
    B.push(frame(hd.x, 0, hd.z, Math.cos(hd.h), -Math.sin(hd.h)));       // local +z faces the street
    const pw = D.pierW, pk = pw / 0.62;
    B.box('radHoney', 0, D.pier / 2, 0, pw, D.pier, pw, 0, { top: false });
    if (q === 0) { B.box('radPale', 0, 0.12 * pk, 0, 0.74 * pk, 0.24 * pk, 0.74 * pk, 0, { top: true }); B.box('radPale', 0, D.pier - 0.06 * pk, 0, 0.72 * pk, 0.12 * pk, 0.72 * pk, 0, { bottom: true }); }
    B.box('radPale', 0, D.pier + 0.08 * pk, 0, 0.82 * pk, 0.16 * pk, 0.82 * pk, 0, { bottom: q === 0 });
    const y = D.pier + 0.16 * pk, key = r(9) < 0.3 ? 'radWarm' : r(9) < 0.6 ? 'stoneDress' : 'radPale';
    // the bust is modelled at its old size and scaled about its foot
    B.push(new THREE.Matrix4().makeTranslation(0, y, 0).multiply(new THREE.Matrix4().makeScale(D.headK, D.headK, D.headK)).multiply(new THREE.Matrix4().makeTranslation(0, -y, 0)));
    if (q > 0) { B.lathe(key, 0, 0.0, [[0.3, y], [0.28, y + 0.25], [0.12, y + 0.35], [0.17, y + 0.55], [0.15, y + 0.78], [0, y + 0.88]], { seg: 5 }); B.pop(); B.pop(); return; }
    // the bust: shoulders and chest (a squashed lathe), the neck
    B.push(new THREE.Matrix4().makeScale(1.45, 1, 0.8));
    B.lathe(key, 0, 0, [[0.22, y], [0.24, y + 0.12], [0.22, y + 0.22], [0.12, y + 0.3], [0, y + 0.31]], { seg: 8, crease: 0.9 });
    B.pop();
    B.lathe(key, 0, 0.0, [[0.09, y + 0.28], [0.085, y + 0.4]], { seg: 6 });
    // the head, turned and tilted a little
    const turn = (r(1) - 0.5) * 0.5, tilt = (r(2) - 0.5) * 0.25, hy = y + 0.38;
    B.push(new THREE.Matrix4().makeRotationY(turn).multiply(new THREE.Matrix4().makeRotationX(tilt)).setPosition(0, hy, 0.01));
    const jaw = 0.1 + 0.035 * r(3), crown = 0.2 + 0.06 * r(4), bald = r(5) < 0.3, beard = 0.12 + 0.2 * r(6), wild = r(7);
    B.push(new THREE.Matrix4().makeScale(1, 1, 1.12));
    B.lathe(key, 0, 0, [[0, -0.02], [jaw * 0.8, 0.0], [jaw, 0.06], [0.12, 0.14], [0.125, crown * 0.7], [0.11, crown * 0.9], [0.06, crown], [0, crown + 0.01]], { seg: 8, crease: 0.9 });
    if (!bald) B.lathe(key, 0, -0.012, [[0.128, crown * 0.55], [0.14, crown * 0.75], [0.12, crown * 0.95], [0.06, crown + 0.035], [0, crown + 0.045]], { seg: 6, a0: Math.PI * 0.6, a1: Math.PI * 2.2, crease: 0.9 });
    B.pop();
    // the beard: a cone hanging from the jaw, forked or full, curled outward when wild
    B.push(new THREE.Matrix4().makeTranslation(0, 0.02, 0.06).multiply(new THREE.Matrix4().makeRotationX(0.25 + 0.3 * wild)));
    B.lathe(key, 0, 0, [[0, -beard], [0.05 + 0.04 * wild, -beard * 0.7], [jaw * 1.05, -beard * 0.25], [jaw * 1.1, 0.02], [jaw * 0.6, 0.08], [0, 0.09]], { seg: 6, crease: 0.9 });
    if (wild > 0.6) for (const sx of [-1, 1]) B.lathe(key, sx * 0.05, 0.02, [[0, -beard - 0.04], [0.035, -beard * 0.6], [0, -beard * 0.2]], { seg: 5 });
    B.pop();
    // moustache, nose, brow ridge, deep-set eyes, ears
    B.box(key, 0, 0.06, 0.125, 0.12, 0.03, 0.05, 0, { top: true, bottom: true });
    B.poly(key, [[-0.025, 0.08, 0.13], [0.025, 0.08, 0.13], [0, 0.155, 0.12]], [0, 0, 1]); for (const sx of [-1, 1]) B.poly(key, [[0, 0.155, 0.12], [sx * 0.025, 0.08, 0.13], [0, 0.08, 0.17 + 0.02 * r(8)]], [sx, 0.2, 0.5]);
    B.poly(key, [[-0.025, 0.08, 0.13], [0, 0.08, 0.17 + 0.02 * r(8)], [0.025, 0.08, 0.13]], [0, -1, 0]);
    B.box(key, 0, 0.165, 0.11, 0.2, 0.035 + 0.02 * r(10), 0.04, 0, { bottom: true });
    for (const sx of [-1, 1]) { B.box('radGroove', sx * 0.045, 0.135, 0.105, 0.045, 0.025, 0.02, 0, { top: false }); B.box(key, sx * 0.125, 0.11, 0.0, 0.03, 0.07, 0.05); }
    B.pop();
    B.pop();
    B.pop();
  }
  out.heads = heads;
  // ---- the Clarendon's Muses: nine lead figures on the roofline (positions along the eaves: a guess), each with one arm
  // raised holding an attribute
  const cl = map.buildings.find((b) => b.id === CLARENDON), muses = [];
  const spots = [[354.8, 44.0], [363.9, 37.6], [371.4, 35.9], [379.1, 34.6], [391.4, 37.0], [395.4, 52.9], [386.2, 55.0], [367.4, 59.6], [358.3, 61.6]];
  function muse(B, x, z, k, q) {
    const h = Math.atan2(x - cl.c[0], z - cl.c[1]), y = 12.5;          // the eaves (world: 15 m less a 2.5 m roof)
    B.push(frame(x, y, z, Math.cos(h), -Math.sin(h)));
    // item 14 (clarendon): the lead figures read at once from Broad Street: over life size on a taller pedestal
    if (ROOFSCAPE) { B.box('radPale', 0, 0.3, 0, 0.9, 0.6, 0.9, 0, { top: true }); B.push(new THREE.Matrix4().makeTranslation(0, 0.2, 0).multiply(new THREE.Matrix4().makeScale(1.35, 1.35, 1.35))); }
    else B.box('radPale', 0, 0.2, 0, 0.7, 0.4, 0.7, 0, { top: true });
    const sg = q === 0 ? 8 : 4, lean = (k % 3 - 1) * 0.06;
    B.lathe('statueLead', lean, 0, [[0.32, 0.4], [0.3, 0.7], [0.22, 1.2], [0.18, 1.5], [0.15, 1.75], [0.08, 1.82], [0.06, 1.88], [0.1, 1.95], [0.09, 2.08], [0, 2.14]], { seg: sg, crease: 0.8 });
    if (q === 0) {
      const s = k % 2 ? 1 : -1;
      B.beam('statueLead', [s * 0.15, 1.72, 0], [s * 0.32, 2.05, 0.1], 0.07, 0.07); B.beam('statueLead', [s * 0.32, 2.05, 0.1], [s * 0.36, 2.4, 0.12], 0.06, 0.06);
      B.beam('statueLead', [-s * 0.15, 1.7, 0], [-s * 0.24, 1.35, 0.12], 0.07, 0.07);
      if (k % 3 === 0) B.box('statueLead', s * 0.38, 2.5, 0.12, 0.18, 0.24, 0.04);           // a lyre
      else if (k % 3 === 1) B.lathe('statueLead', s * 0.38, 0.12, [[0, 2.36], [0.06, 2.4], [0.06, 2.6], [0, 2.64]], { seg: 5 });   // a scroll / trumpet
      else B.box('statueLead', s * 0.38, 2.46, 0.12, 0.14, 0.16, 0.08);                         // a mask
    }
    if (ROOFSCAPE) B.pop();
    B.pop();
  }
  if (cl) for (const [x, z] of spots) muses.push([x, z]);
  out.muses = muses;
  // ---- register: the theatre, the heads (near only within ~45 m), the Muses
  const TB = [0, 1, 2].map((q) => { const B = new RB(); theatre(B, q); return B; });
  const c0 = out.centre || [343, 73];
  const gT = lod.group('sheldonian', [c0[0], 12, c0[1]], 24, [75, 170, 1150]);
  TB.forEach((B, q) => gT.add(q, geoOf(B, PK), { name: 'sheldonian' + q }));
  if (heads.length) {
    const hc = heads.reduce((a, h) => [a[0] + h.x / heads.length, a[1] + h.z / heads.length], [0, 0]);
    const hr = Math.max(...heads.map((h) => Math.hypot(h.x - hc[0], h.z - hc[1]))) + 1;
    const gH = lod.group('heads', [hc[0], 2.5, hc[1]], hr, ROOFSCAPE ? [40, 140, 320] : [30, 110, 260]);
    for (let q = 0; q < 2; q++) { const B = new RB(); for (const hd of heads) head(B, hd, q); gH.add(q, geoOf(B, PK), { name: 'heads' + q }); }
  }
  if (cl) {
    const gM = lod.group('muses', [cl.c[0], 14, cl.c[1]], 26, [60, 150, 400]);
    for (let q = 0; q < 2; q++) { const B = new RB(); spots.forEach(([x, z], k) => muse(B, x, z, k, q)); gM.add(q, geoOf(B, PK), { name: 'muses' + q }); }
  }
  out.dims = { ...SHELD, heads: heads.length, muses: muses.length };
  return out;
}
