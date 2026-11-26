// Christ Church — Tom Tower (showpiece, fine-detail pass).
// Wolsey's gatehouse (1526): Tom Gate under a four-centred arch with a rib-vaulted passage, an oriel and a canopied
// statue niche over it, and the two big octagonal turrets that flank it on St Aldate's (two slimmer ones to the quad).
// Wren's upper part (1681-82): a square clock stage with a great ogee-headed belfry window in each face, the four
// turrets finished as ogee-capped lanterns at its corners, the octagonal lantern with an ogee window in every face
// and crocketed angle pinnacles, and the ribbed lead ogee dome with its finial and vane.
// Facts and guesses: docs/research/christ_church_botanic_magdalen.md §1.
//
//   build(ctx) -> { meshes: [near, far], lod, dims, frame, colliders: [{x, z, r}], passage: [x1, z1, x2, z2, w] }
//   ctx = { world, mats (seMats), parent }
// One draw: the near mesh (full detail) inside DIMS.lodR when the tower is in front of the camera, else the far mesh
// (the same silhouette at about a tenth of the triangles). Both use the shared fine material (_se_fine.js).
//
// Frame: origin = the middle of the mapped base (OSM w146574165), u along the St Aldate's front (to the south), v out
// of the front (to the west, the street). All dims in metres; edit DIMS to refine.
import * as THREE from 'three';
import { Batch, localFrame, prism, lathe, tudorPts, rectPts, pointedPts } from './_chch_kit.js';
import { buildFine, AIR_FAR, airKeep, stringCourse, ringCourse, ogeePts, hoodMould, tracery, pinnacle, crenelFine, crenelRing, blindPanels, robedFigure, ribLine, ribStrip, slats, triCount } from './_se_fine.js';

export const DIMS = {
  centre: [237.5, 530.5], front: [0.0798, 0.9968],   // mapped base: west face (231.8,525.9)-(232.6,535.9)
  w: 10.6, d: 10.0,                                   // base: along the front x depth (mapped)
  wolsey: 15.4,                                       // top of Wolsey's gatehouse = foot of Wren's clock stage (guess)
  baseH: 24.0, parapet: 1.3,                          // square stage to the cornice (mapped part: 24 m), battlements
  gate: { w: 4.2, spring: 4.6, rise: 1.7 },           // Tom Gate (four-centred arch; guess)
  turret: { r: 1.75, rBack: 1.2, h: 26.6, lantern: 2.6, cap: 3.5 },   // front turrets (octagonal); the slimmer pair to the quad
  pin: { r: 0.55, h: 2.6 },                           // (kept for older callers)
  oct: { r: 4.75, y0: 24.0, y1: 33.4 },               // Wren's octagon: circumradius (mapped 8.8 m across the flats, 24-33 m)
  dome: { y0: 33.5, h: 8.3, bulge: 1.06 },            // faceted ogee dome (mapped 33-39 m + the point)
  finial: { y0: 41.6, h: 4.4 },                       // lead lantern-finial, gilt orb and vane (top ~46 m)
  clock: { y: 17.75, r: 1.3 },                        // dials to the street and the quad (clock of 1889; position guessed)
  lodR: 56,                                          // near mesh inside this (x the tier's LOD scale: _se_fine.lodScale)
};
const wallM = (x, y, z, ax, az) => new THREE.Matrix4().makeBasis(new THREE.Vector3(ax, 0, az), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-az, 0, ax)).setPosition(x, y, z);

/** Wren's dome: a full bulge, then the long concave sweep to the point. [[r, y], …] */
function domeProfile(R, y0, h, bulge, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = t < 0.5 ? R * (1 + (bulge - 1) * Math.sin(Math.PI * t / 0.5) * 1.6 - 0.27 * (t / 0.5) * (t / 0.5)) : R * (0.09 + 0.64 * Math.pow(1 - (t - 0.5) / 0.5, 1.9));
    out.push([r, y0 + h * t]);
  }
  return out;
}
function capProfile(r, y0, h, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) { const t = i / steps; out.push([t < 0.5 ? r * (1 + 0.12 * Math.sin(Math.PI * t / 0.5) - 0.3 * (t / 0.5) * (t / 0.5)) : r * (0.06 + 0.64 * Math.pow(1 - (t - 0.5) / 0.5, 1.8)), y0 + h * t]); }
  return out;
}
/** a rotated rectangle in the XY plane at z (for clock hands and hour batons) */
function barXY(B, key, cx, cy, z, len, wid, ang, off = 0) {
  const c = Math.cos(ang), s = Math.sin(ang), P = (a, b) => [cx + a * s + b * c, cy + a * c - b * s, z];
  B.poly(key, [P(off, -wid / 2), P(off, wid / 2), P(off + len, wid / 2), P(off + len, -wid / 2)], [0, 0, 1]);
}

function make(D, F, lite) {   // eslint-disable-line no-param-reassign
  const B = new Batch();
  B.push(F.matrix());
  const hw = D.w / 2, hd = D.d / 2, H = D.baseH, g = D.gate, T = D.turret, O = D.oct, WY = D.wolsey;
  const ph = g.spring + g.rise;
  const gatePts = tudorPts(0, g.w, 0, g.spring, g.rise, lite ? 4 : 8);
  const gateNotch = [[hw - g.w / 2, 0], ...gatePts.slice(2).reverse().map(([x, y]) => [hw + x, y]), [hw + g.w / 2, 0]];
  const WALLS = { front: [-hw, hd, 1, 0, D.w], back: [hw, -hd, -1, 0, D.w], left: [-hw, -hd, 0, 1, D.d], right: [hw, hd, 0, -1, D.d] };
  const oriel = (c) => rectPts(c - 1.9, 7.7, c + 1.9, 11.0);
  const niche = (c) => pointedPts(c, 1.2, 12.0, 14.0, 0.8, lite ? 3 : 5);
  const belfry = (c) => ogeePts(c, 2.5, 19.9, 21.7, 23.55, lite ? 3 : 6);
  // ---- the four walls of the square (Wolsey's gatehouse + Wren's clock stage)
  for (const k of ['front', 'back', 'left', 'right']) {
    const [sx, sz, ax, az, len] = WALLS[k], c = len / 2, main = k === 'front' || k === 'back', street = k === 'front';
    B.push(wallM(sx, 0, sz, ax, az));
    const out = main ? [[0, 0], ...gateNotch, [len, 0], [len, H], [0, H]] : rectPts(0, 0, len, H);
    if (lite) {
      B.face('stone', out);
      B.face('shadow', belfry(c), [], 0.03);
      if (main) { B.face(k === 'front' ? 'winLit' : 'winDim', oriel(c), [], 0.03); B.face('shadow', niche(c), [], 0.03); B.box('stonePale', c, 13.0, 0.1, 0.5, 1.9, 0.3); dial(B, c, D.clock.y, 0.05, D.clock.r, 12); }
      for (const y of [7.1, 11.45, WY, H - 0.4]) B.box('mould', c, y + 0.15, 0.1, len, 0.3, 0.2);
    } else {
      B.face('stone', out, main ? [oriel(c), niche(c), belfry(c)] : [belfry(c)]);
      // Wren's great ogee-headed belfry window: two louvred lights, a hood mould running up to a finial through the cornice
      tracery(B, belfry(c), { d: 0.5, lights: 2, glass: 'void', headY: 21.7, bw: 0.12 });
      slats(B, 'stoneDark', c, 2.4, 20.0, 23.3, 8, -0.32);
      hoodMould(B, belfry(c), { w: 0.2, d: 0.16, fromY: 21.5 });
      pinnacle(B, c, 23.6, 0.12, { w: 0.26, shaft: 0.5, spire: 1.5, lite: true });
      stringCourse(B, 1.5, len - 1.5, 19.3, { h: 0.22, d: 0.14 });
      if (main) {
        // Tom Gate: square label over the four-centred arch, shields in the spandrels
        hoodMould(B, gateNotch.slice(1, -1), { w: 0.22, d: 0.14, fromY: g.spring - 0.2 });
        B.box('mould', c, ph + 0.62, 0.09, g.w + 1.5, 0.2, 0.18); for (const s of [-1, 1]) { B.box('mould', c + s * (g.w / 2 + 0.66), (ph + 0.6 + 3.6) / 2, 0.09, 0.2, ph + 0.6 - 3.6, 0.18); B.box('carve', c + s * (g.w / 2 - 0.25), ph - 0.05, 0.08, 0.55, 0.6, 0.16); }
        blindPanels(B, c - g.w / 2 - 0.5, c + g.w / 2 + 0.5, ph + 0.75, 7.05, { cols: 8, rows: 1, d: 0.06, bw: 0.06 });
        stringCourse(B, 1.5, len - 1.5, 7.1, { h: 0.32, d: 0.22 });
        // the oriel over the gate: four lights in two tiers, lit at night to the street
        tracery(B, oriel(c), { d: 0.32, lights: 4, transoms: [9.3], headY: 10.95, glass: street ? 'winLit' : 'winDim', bw: 0.1 });
        hoodMould(B, oriel(c), { w: 0.14, d: 0.12 }); B.box('mould', c, 7.62, 0.14, 4.3, 0.18, 0.3, 0, { bottom: true });
        for (const s of [-1, 1]) blindPanels(B, c + s * 2.95 - 0.72, c + s * 2.95 + 0.72, 7.6, 11.1, { cols: 2, rows: 2, d: 0.06, bw: 0.07 });
        stringCourse(B, 1.5, len - 1.5, 11.45, { h: 0.26, d: 0.18 });
        // the statue niche under its canopy (Queen Anne to the street, Wolsey to the quad), panelled bays with shields beside it
        B.reveal('stone', niche(c), 0, -0.55); B.face('shadow', niche(c), [], -0.55);
        hoodMould(B, niche(c), { w: 0.14, d: 0.14, fromY: 13.6 });
        pinnacle(B, c, 14.75, 0.14, { w: 0.3, shaft: 0.1, spire: 0.55, lite: true });
        B.box('mould', c, 11.92, 0.02, 1.5, 0.2, 0.75, 0, { bottom: true });
        robedFigure(B, 'mouldPale', c, 12.02, -0.12, 1.95, { crown: street, staff: !street });
        for (const s of [-1, 1]) { blindPanels(B, c + s * 2.25 - 1.25, c + s * 2.25 + 1.25, 11.85, 15.2, { cols: 3, rows: 1, d: 0.06, bw: 0.07 }); B.box('carve', c + s * 2.25, 13.2, 0.07, 0.5, 0.62, 0.12); }
        // the clock: a dark dial with gilt chapter ring, batons and hands in a moulded square
        dial(B, c, D.clock.y, 0.07, D.clock.r);
        hoodMould(B, rectPts(c - D.clock.r - 0.2, D.clock.y - D.clock.r - 0.2, c + D.clock.r + 0.2, D.clock.y + D.clock.r + 0.2), { w: 0.14, d: 0.1 });
      }
      stringCourse(B, 1.5, len - 1.5, WY, { h: 0.4, d: 0.3 });
      stringCourse(B, 0.6, len - 0.6, H - 0.45, { h: 0.45, d: 0.36 });
    }
    B.pop();
  }
  // ---- the gate passage: side walls, a four-centred vault with ribs, the great doors folded back, a lantern
  for (const s of [-1, 1]) B.boxXZ('stone', s > 0 ? g.w / 2 : -g.w / 2 - 0.3, s > 0 ? g.w / 2 + 0.3 : -g.w / 2, 0, g.spring + 0.05, -hd, hd);
  B.push(wallM(-hw, 0, hd, 1, 0)); B.reveal('stonePale', gatePts.slice(2).map(([x, y]) => [hw + x, y]), 0, -D.d, true); B.pop();
  if (!lite) {
    const arc = gatePts.slice(2);
    for (let k = 0; k <= 4; k++) { const z = -hd + 0.25 + (k / 4) * (D.d - 0.5); ribLine(B, 'mould', arc.map(([x, y]) => [x * 0.97, y - 0.06, z]), 0.16, 0.16); for (const s of [-1, 1]) B.box('mould', s * (g.w / 2 - 0.07), g.spring / 2, z, 0.14, g.spring, 0.2); }
    B.box('mould', 0, ph - 0.1, 0, 0.16, 0.14, D.d);                                             // ridge rib
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const z0 = -hd + 0.25 + (k / 4) * (D.d - 0.5), z1 = z0 + (D.d - 0.5) / 4; B.beam('mould', [s * g.w * 0.48, g.spring + 0.1, z0], [0, ph - 0.12, (z0 + z1) / 2], 0.1, 0.1); B.beam('mould', [s * g.w * 0.48, g.spring + 0.1, z1], [0, ph - 0.12, (z0 + z1) / 2], 0.1, 0.1); }
    for (let k = 0; k < 4; k++) lathe(B, 'gilt', 0, -hd + 0.25 + (k + 0.5) * (D.d - 0.5) / 4, [[0, ph - 0.36], [0.2, ph - 0.24], [0.2, ph - 0.12]], 6, 0);   // bosses
    // the oak doors, open against the passage walls (studded, with strap hinges)
    for (const s of [-1, 1]) { const x = s * (g.w / 2 - 0.09); B.boxXZ('darkWood', x - 0.06, x + 0.06, 0, 4.9, hd - 2.5, hd - 0.35); for (const y of [0.6, 2.4, 4.2]) B.boxXZ('iron', x - 0.08, x + 0.08, y, y + 0.12, hd - 2.45, hd - 0.4); }
    B.box('iron', 0, ph - 0.75, 1.5, 0.05, 0.9, 0.05); B.box('iron', 0, ph - 1.45, 1.5, 0.36, 0.08, 0.36); B.box('lampGlow', 0, ph - 1.2, 1.5, 0.26, 0.42, 0.26); B.box('iron', 0, ph - 0.96, 1.5, 0.36, 0.06, 0.36);
  }
  // ---- roof of the square stage and its battlements
  B.boxXZ('lead', -hw, hw, H - 0.2, H, -hd, hd);
  for (const [x0, z0, x1, z1] of [[-hw + 1.2, hd + 0.05, hw - 1.2, hd + 0.05], [hw - 0.9, -hd - 0.05, -hw + 0.9, -hd - 0.05], [-hw - 0.05, -hd + 0.9, -hw - 0.05, hd - 1.2], [hw + 0.05, hd - 1.2, hw + 0.05, -hd + 0.9]]) crenelFine(B, x0, z0, x1, z1, H, { h: 0.7, base: D.parapet - 0.7, t: 0.42, mw: 0.8, gap: 0.55, lite });
  // ---- the four turrets: Wolsey's octagons, finished by Wren as ogee-capped lanterns
  const turret = (cx, cz, r, y0, plain = false) => {
    const lite0 = lite; if (plain) lite = true;
    const top = T.h - T.lantern;
    prism(B, 'stone', cx, cz, r, y0, top, 8, { cap: false });
    for (const y of [7.1, 11.45, WY, 19.3, H - 0.45]) if (y > y0) lite ? prism(B, 'mould', cx, cz, r + 0.1, y, y + 0.3, 8, { cap: false }) : ringCourse(B, cx, cz, r, y, 8, Math.PI / 8, { h: 0.34, d: 0.16 });
    if (!lite) {
      // blind tracery panels on the faces that show (the outer five of each turret), three stages
      for (let i = 0; i < 8; i++) {
        const am = Math.PI / 8 + ((i + 0.5) / 8) * Math.PI * 2, nx = Math.sin(am), nz = Math.cos(am);
        if (nx * Math.sign(cx) + nz * Math.sign(cz) < 0.1) continue;
        const ap = r * Math.cos(Math.PI / 8), side = 2 * r * Math.sin(Math.PI / 8);
        B.push(wallM(cx + nx * ap - nz * side / 2, 0, cz + nz * ap + nx * side / 2, nz, -nx));
        for (const [a, b] of [[Math.max(y0, 7.5), 11.3], [11.9, WY - 0.15], [WY + 0.5, 19.2], [19.75, H - 0.6]]) if (b - a > 1) blindPanels(B, 0.14, side - 0.14, a, b, { cols: 2, rows: b - a > 3.6 ? 2 : 1, d: 0.05, bw: 0.06 });
        B.pop();
      }
    }
    // the lantern stage: a slimmer octagon with a dark opening in each face, then the lead ogee cap and gilt finial
    const lr = r * 0.84;
    lite ? prism(B, 'mould', cx, cz, r + 0.14, top - 0.3, top, 8) : ringCourse(B, cx, cz, r, top - 0.4, 8, Math.PI / 8, { h: 0.4, d: 0.22 });
    prism(B, 'stonePaleLit', cx, cz, lr, top, T.h, 8, { cap: false });
    for (let i = 0; i < 8; i++) {
      const am = Math.PI / 8 + ((i + 0.5) / 8) * Math.PI * 2, nx = Math.sin(am), nz = Math.cos(am), ap = lr * Math.cos(Math.PI / 8), side = 2 * lr * Math.sin(Math.PI / 8);
      B.push(wallM(cx + nx * ap - nz * side / 2, top, cz + nz * ap + nx * side / 2, nz, -nx));
      const op = lite ? rectPts(side * 0.24, 0.35, side * 0.76, T.lantern - 0.5) : ogeePts(side / 2, side * 0.56, 0.3, T.lantern - 1.0, T.lantern - 0.35, 3);
      B.face('shadow', op, [], 0.02);
      if (!lite) hoodMould(B, op, { w: 0.07, d: 0.07, fromY: 0.2, z: 0.02 });
      B.pop();
    }
    lite ? prism(B, 'mould', cx, cz, lr + 0.14, T.h - 0.25, T.h, 8) : ringCourse(B, cx, cz, lr, T.h - 0.3, 8, Math.PI / 8, { h: 0.3, d: 0.2 });
    const cap = capProfile(lr * 1.0, T.h, T.cap * (r / T.r), lite ? 5 : 7);
    lathe(B, 'lead', cx, cz, cap, 8);
    if (!lite) for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i / 8) * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a); ribStrip(B, 'leadDark', cap.map(([rr, y]) => [cx + sa * rr, y, cz + ca * rr]), () => [sa, 0.3, ca], 0.07); }
    const ty = T.h + T.cap * (r / T.r);
    lathe(B, 'gilt', cx, cz, [[0.07, ty - 0.15], [0.2, ty + 0.05], [0.2, ty + 0.2], [0.05, ty + 0.36], [0.04, ty + 0.9], [0, ty + 1.0]], 6);
    lite = lite0;
  };
  for (const s of [-1, 1]) { turret(s * hw, hd, T.r, 0); turret(s * (hw - 0.25), -hd + 0.1, T.rBack, 0, true); }
  // ---- Wren's octagon: an ogee-headed louvred window in each face, crocketed angle pinnacles, cornice and battlements
  prism(B, 'stone', 0, 0, O.r * 1.03, H - 0.2, O.y0 + 0.9, 8, { rot: 0 });
  const side = 2 * O.r * Math.sin(Math.PI / 8), oh = O.y1 - O.y0;
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    const p0 = [Math.sin(a0) * O.r, Math.cos(a0) * O.r], p1 = [Math.sin(a1) * O.r, Math.cos(a1) * O.r];
    const win = ogeePts(side / 2, 1.75, 1.7, 5.7, 7.95, lite ? 3 : 6);
    B.push(wallM(p0[0], O.y0, p0[1], (p1[0] - p0[0]) / side, (p1[1] - p0[1]) / side));
    if (lite) { B.face('stoneLit', rectPts(0, 0, side, oh)); B.face('shadow', win, [], 0.03); }
    else {
      B.face('stoneLit', rectPts(0, 0, side, oh), [win]);
      tracery(B, win, { d: 0.5, lights: 2, glass: 'void', headY: 5.7, transoms: [3.6], bw: 0.11 });
      slats(B, 'stoneDark', side / 2, 1.7, 1.8, 7.7, 14, -0.34);
      hoodMould(B, win, { w: 0.16, d: 0.14, fromY: 5.4 });
      pinnacle(B, side / 2, 8.0, 0.1, { w: 0.2, shaft: 0.3, spire: 1.5, lite: true });
      stringCourse(B, 0.3, side - 0.3, 1.25, { h: 0.2, d: 0.12, ends: false });
    }
    B.pop();
    // angle buttress and pinnacle
    const px = Math.sin(a0) * (O.r + 0.12), pz = Math.cos(a0) * (O.r + 0.12);
    prism(B, 'stonePale', px, pz, 0.42, O.y0, O.y1 + 0.5, 4, { rot: a0, cap: false });
    B.push(new THREE.Matrix4().makeRotationY(a0 - Math.PI / 4).setPosition(px, 0, pz)); pinnacle(B, 0, O.y1 + 0.5, 0, { w: 0.52, shaft: 0.7, spire: 2.2, lite }); B.pop();
  }
  lite ? prism(B, 'mould', 0, 0, O.r + 0.3, O.y1 - 0.45, O.y1, 8, { rot: 0 }) : ringCourse(B, 0, 0, O.r, O.y1 - 0.5, 8, 0, { h: 0.5, d: 0.36 });
  crenelRing(B, 0, 0, O.r + 0.12, O.y1, 8, 0, { mw: 0.55, gap: 0.42, h: 0.55, base: 0.4, t: 0.3, lite: true });
  // ---- the ogee dome (faceted, lead, rolls on the angles), the lantern-finial, orb and vane
  const Dm = D.dome, prof = domeProfile(O.r * 0.93, Dm.y0, Dm.h, Dm.bulge, lite ? 7 : 14);
  prism(B, 'leadDark', 0, 0, O.r * 0.95, O.y1 - 0.1, Dm.y0, 8, { rot: 0 });
  lathe(B, 'lead', 0, 0, prof, 8, 0);
  if (!lite) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a); ribStrip(B, 'leadDark', prof.map(([r, y]) => [sa * r, y, ca * r]), () => [sa, 0.35, ca], 0.13); }
  const f = D.finial, fy = f.y0;
  lathe(B, 'lead', 0, 0, [[0.5, fy - 0.2], [0.62, fy], [0.62, fy + 0.18], [0.42, fy + 0.3], [0.36, fy + 1.0], [0.56, fy + 1.12], [0.56, fy + 1.3], [0.2, fy + 1.7]], 8, 0);
  lathe(B, 'gilt', 0, 0, [[0.1, fy + 1.65], [0.36, fy + 1.95], [0.4, fy + 2.2], [0.3, fy + 2.45], [0.06, fy + 2.6], [0.05, fy + 3.9], [0, fy + f.h]], lite ? 6 : 10, 0);
  if (!lite) { B.box('gilt', 0, fy + 3.3, 0, 0.9, 0.06, 0.06); B.box('gilt', 0, fy + 3.3, 0, 0.06, 0.06, 0.9); B.box('gilt', 0.3, fy + 3.75, 0, 0.55, 0.3, 0.03); }
  B.pop();
  return B;
}

export function build(ctx) {
  const { parent, world } = ctx, D = DIMS;
  const F = localFrame(D.centre, D.front);
  const near = buildFine(make(D, F, false), world, parent, 'chch:tomtower:near');
  const far = buildFine(make(D, F, true), world, parent, 'chch:tomtower:far');
  near.visible = false;
  airKeep([far]);                                   // (from a glider: the far tower out to AIR_FAR, past cull.js's ~1.7 km)
  const hw = D.w / 2, hd = D.d / 2, T = D.turret;
  // world-space helpers: turret colliders, the passage through the gate
  const colliders = [];
  for (const s of [-1, 1]) { const [x, z] = F.toW(s * hw, hd); colliders.push({ x, z, r: T.r }); const [bx, bz] = F.toW(s * (hw - 0.25), -hd + 0.1); colliders.push({ x: bx, z: bz, r: T.rBack }); }
  const a = F.toW(0, hd + 1.5), b = F.toW(0, -hd - 1.5);
  try { const [lx, lz] = F.toW(0, 1.5); world.addLampGlow(lx, D.gate.spring + D.gate.rise - 1.2, lz); } catch { /* optional */ }
  return { meshes: [near, far], lod: { near, far, c: D.centre, r: D.lodR, facing: true, airFar: AIR_FAR }, dims: D, frame: F, colliders, passage: [a[0], a[1], b[0], b[1], D.gate.w - 0.4], tris: { near: triCount(near), far: triCount(far) } };
}

/** the clock dial facing +z at (x, y, z): dark blue, gilt ring, batons and hands (the gilt glows faintly at night) */
function dial(B, x, y, z, r, n = 24) {
  const p = (a, rr, zz) => [x + Math.sin(a) * rr, y + Math.cos(a) * rr, zz];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    B.poly('dial', [[x, y, z], p(a1, r, z), p(a0, r, z)], [0, 0, 1]);
    B.poly('dialGilt', [p(a0, r, z + 0.02), p(a1, r, z + 0.02), p(a1, r + 0.13, z + 0.02), p(a0, r + 0.13, z + 0.02)], [0, 0, 1]);
    B.poly('dialGilt', [p(a0, r * 0.62, z + 0.015), p(a1, r * 0.62, z + 0.015), p(a1, r * 0.66, z + 0.015), p(a0, r * 0.66, z + 0.015)], [0, 0, 1]);
  }
  if (n < 24) return;
  for (let h = 0; h < 12; h++) barXY(B, 'dialGilt', x, y, z + 0.02, r * 0.24, h % 3 ? 0.07 : 0.13, (h / 12) * Math.PI * 2, r * 0.7);
  barXY(B, 'dialGilt', x, y, z + 0.035, r * 0.56, 0.11, (10 / 12) * Math.PI * 2, -0.12);    // ten past ten
  barXY(B, 'dialGilt', x, y, z + 0.04, r * 0.86, 0.07, (2 / 12) * Math.PI * 2, -0.18);
}
