// Carfax Tower (St Martin's Tower) at the Carfax crossroads — geometry (owned by places/carfax_tower.js).
// KNOWN: the 13th/14th-century west tower of St Martin's church (the nave was pulled down in 1896), 74 ft (≈ 23 m), plain
// coursed stone, battlemented; the stair turret on the north side (OSM outline); the clock of 1898 (dial and surround by
// T. G. Jackson) on the EAST face with the two "quarter boys" above it striking the quarters on bells; 99 steps to the roof.
// GUESSED (see docs/research/city_centre_west.md): the exact stage heights, the belfry openings' form, the turret's cap,
// the door under the clock, the canopy over the quarter boys and their dress.
import * as THREE from 'three';
import { RB, frame, archPts, geoOf, TAU, tintGeo, vnoise } from './_cw_kit.js';

export const ID = 'w311139684';
// the tower's square in plan (from the OSM outline): centre, east axis u, south axis v, half-sizes
export const T = { c: [126.95, 337.1], u: [0.938, -0.345], v: [0.345, 0.938], ha: 3.62, hb: 3.8, roof: 20.6, para: 21.55, top: 22.5,
  turret: { a: 1.8, b: -4.45, r: 1.3, top: 24.2, cap: 25.6 }, dial: { y: 13.1, r: 0.75 }, boys: { y: 8.9 } };
// Photographs (docs/research/photo_comparison.md) refute the first guess (a navy dial 8.6 m up with the quarter boys above
// it): the dial is WHITE with black numerals, about 1.5 m across and a little over half way up the east face (~13 m of
// 23), and the quarter boys' niche is directly BELOW it.
// the quarter boys are drawn this much bigger than life-size figures of 1.3 m would be (GUESS: they read from the street)
export const QB = 1.4;
export const PRICE = 2.2, OPEN = [10, 17];
/** local (a east, b south) -> world [x, z] */
export const tp = (a, b) => [T.c[0] + T.u[0] * a + T.v[0] * b, T.c[1] + T.u[1] * a + T.v[1] * b];
/** heading (game convention) of the local direction (da, db) */
export const th = (da, db) => { const x = T.u[0] * da + T.v[0] * db, z = T.u[1] * da + T.v[1] * db; return Math.atan2(x, z); };
/** frame on face with local outward normal (na, nb) at local offset (a, b) */
function faceF(a, b, na, nb) {
  const [x, z] = tp(a, b), nx = T.u[0] * na + T.v[0] * nb, nz = T.u[1] * na + T.v[1] * nb;
  return frame(x, 0, z, nz, -nx);
}
// the four faces: outward normal (local), half-length along the face
const FACES = [{ n: [1, 0], h: T.hb, name: 'E' }, { n: [-1, 0], h: T.hb, name: 'W' }, { n: [0, 1], h: T.ha, name: 'S' }, { n: [0, -1], h: T.ha, name: 'N' }];
export const DOOR = (() => { const p = tp(T.ha + 1.2, 0.0); return { pos: p, facing: th(1, 0) }; })();

/** the tower: {near, mid, far} geometries in the pack, plus the dynamic parts' rest geometry and their animators */
export function build(P) {
  const B = new RB();
  const wall = 'cwTower', dress = 'radPale', H = T.para;
  for (const f of FACES) {
    const half = f.n[0] ? T.hb : T.ha, off = f.n[0] ? T.ha : T.hb;
    B.push(faceF(f.n[0] * off, f.n[1] * off, f.n[0], f.n[1]));
    // openings: the belfry pair on every face, the door on the east face
    const holes = [];
    const bel = [-0.62, 0.62].map((x) => archPts(x, 0.72, 15.2, 17.9, 6));
    holes.push(...bel);
    const door = f.name === 'E' ? archPts(0, 1.15, 0.05, 1.95, 6) : null;
    if (door) holes.push(door);
    // the wall in three stages between the string courses (sootier below, paler and cleaner above)
    const st0 = [0, 7.1, 14.2, H], keys = ['cwTowerA', wall, 'cwTowerB'];
    for (let k = 0; k < 3; k++) B.face(keys[k], [[-half, st0[k]], [half, st0[k]], [half, st0[k + 1]], [-half, st0[k + 1]]], holes.filter((hp) => { const y = Math.min(...hp.map((q) => q[1])); return y >= st0[k] - 0.01 && y < st0[k + 1]; }), 0);
    bel.forEach((hp, k) => { B.reveal('radWarm', hp, 0, -0.55); B.unit('louvre', hp, -0.5, [k + 1, 2]); });
    // a hood mould over the pair and a shaft between
    B.box(dress, 0, 18.45, 0.06, 2.4, 0.16, 0.14, 0, { bottom: true });
    B.box(dress, 0, 16.55, 0.03, 0.18, 2.7, 0.06);
    if (door) {
      B.reveal('radWarm', door, 0, -0.45); B.unit('archDoorOak', door, -0.42, [3, 0]);
      B.box(dress, 0, 2.62, 0.07, 1.8, 0.14, 0.16, 0, { bottom: true });
    }
    // slit lights to the stair and ringing chamber (painted, slightly proud)
    if (f.name !== 'E') for (const y of [5.2, 10.4]) B.unit('leaded', [[-0.16, y], [0.16, y], [0.16, y + 1.1], [-0.16, y + 1.1]], 0.02, [f.name.charCodeAt(0) % 7, y > 8 ? 1 : 0]);
    // plinth, string courses, the parapet's coping and merlons
    B.box('radWarm', 0, 0.3, 0.06, 2 * half + 0.24, 0.6, 0.12, 0, { top: true });
    // string courses: a moulded band with a sloped weathering on top and a drip under it
    for (const y of [7.1, 14.2, 19.8]) {
      B.box(dress, 0, y, 0.1, 2 * half + 0.24, 0.3, 0.2, 0, { bottom: true, top: false });
      B.poly(dress, [[-half - 0.12, y + 0.15, 0.2], [half + 0.12, y + 0.15, 0.2], [half + 0.12, y + 0.32, 0.0], [-half - 0.12, y + 0.32, 0.0]], [0, 0.7, 0.7]);
      B.box('radGroove', 0, y - 0.2, 0.03, 2 * half + 0.1, 0.1, 0.06, 0, { top: false });
    }
    const m = 5, mw = (2 * half) / m;
    for (let k = 0; k < m; k++) B.box(wall, -half + (k + 0.5) * mw, H + 0.42, -0.2, mw * 0.55, 0.84, 0.4, 0, { top: false });
    for (let k = 0; k < m; k++) B.box(dress, -half + (k + 0.5) * mw, H + 0.88, -0.2, mw * 0.55 + 0.08, 0.1, 0.48, 0);
    B.box(dress, 0, H - 0.05, -0.2, 2 * half + 0.1, 0.12, 0.5, 0);
    // the parapet's inner face (seen from the roof)
    B.poly(wall, [[half - 0.4, T.roof, -0.4], [-half + 0.4, T.roof, -0.4], [-half + 0.4, H, -0.4], [half - 0.4, H, -0.4]], [0, 0, -1]);
    B.pop();
  }
  // the roof: lead flat at T.roof, with the corners' gargoyle spouts
  {
    const r = [[-T.ha + 0.4, -T.hb + 0.4], [T.ha - 0.4, -T.hb + 0.4], [T.ha - 0.4, T.hb - 0.4], [-T.ha + 0.4, T.hb - 0.4]].map(([a, b]) => tp(a, b));
    B.poly('radLead', r.map(([x, z]) => [x, T.roof, z]), [0, 1, 0], r.map(([x, z]) => [x, z]));
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const [x, z] = tp(a * (T.ha + 0.15), b * (T.hb + 0.15)); B.box('radWarm', x, 19.55, z, 0.32, 0.26, 0.32, th(a, b));
    }
    // a flagpole on the south-west corner
    const [fx, fz] = tp(-T.ha + 0.8, T.hb - 0.8); B.cyl('white', fx, T.roof, fz, 0.05, 6.2, 6, true, 0.07);
  }
  // the stair turret: an octagon against the north face, rising above the parapet, with a battlemented top and a cap
  {
    const tr = T.turret, [cx, cz] = tp(tr.a, tr.b);
    B.lathe(wall, cx, cz, [[tr.r + 0.1, 0], [tr.r + 0.1, 0.6], [tr.r, 0.62], [tr.r, tr.top], [tr.r + 0.1, tr.top + 0.02], [tr.r + 0.1, tr.top + 0.2], [0.0, tr.top + 0.2]], { seg: 8, facet: true, crease: 0.2 });
    for (let k = 0; k < 8; k += 2) { const a = (k / 8) * TAU + TAU / 16; B.box(wall, cx + Math.sin(a) * tr.r, tr.top + 0.5, cz + Math.cos(a) * tr.r, 0.55, 0.6, 0.3, a); }
    B.lathe('radLead', cx, cz, [[tr.r * 0.82, tr.top + 0.18], [0.08, tr.cap - 0.15], [0.0, tr.cap]], { seg: 8, facet: true });
    // the turret door onto the roof
    B.push(faceF(tr.a, tr.b + tr.r * 0.93, 0, 1)); B.unit('doorOak', [[-0.4, T.roof], [0.4, T.roof], [0.4, T.roof + 1.85], [-0.4, T.roof + 1.85]], 0.02, [5, 1]); B.pop();
    B.push(faceF(tr.a, tr.b - tr.r * 0.93, 0, -1)); for (const y of [4, 9, 13, 17]) B.unit('leaded', [[-0.13, y], [0.13, y], [0.13, y + 0.8], [-0.13, y + 0.8]], 0.02, [y, 0]); B.pop();
  }
  // the clock (east face): a dial in a square stone surround under a little gabled hood, and below it the quarter boys'
  // canopied niche with their two bells
  const D = T.dial, by = T.boys.y;
  B.push(faceF(T.ha, 0, 1, 0));
  {
    // the dial (a 1.5 m white dial with black Roman numerals in a gilt-framed square surround under a gabled hood; the
    // quarter boys in armour on a ledge below it under a green canopy with a gilt valance: their dress is still a GUESS)
    const s = D.r + 0.4;
    B.box('radPale', 0, D.y, 0.12, 2 * s, 2 * s, 0.24, 0, { bottom: true });
    B.box('cwNavy', 0, D.y, 0.245, 2 * s - 0.24, 2 * s - 0.24, 0.02);
    for (const [x, y, w, h] of [[0, s - 0.06, 2 * s, 0.12], [0, -s + 0.06, 2 * s, 0.12], [s - 0.06, 0, 0.12, 2 * s], [-s + 0.06, 0, 0.12, 2 * s]]) B.box('cwGilt', x, D.y + y, 0.27, w, h, 0.06);
    for (const [cx, cy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) B.poly('cwGilt', [[cx * (s - 0.12), D.y + cy * (s - 0.12), 0.262], [cx * (s - 0.12), D.y + cy * (D.r * 0.6), 0.262], [cx * (D.r * 0.6), D.y + cy * (s - 0.12), 0.262]], [0, 0, 1]);
    B.poly('radPale', [[-s - 0.15, D.y + s, 0.27], [s + 0.15, D.y + s, 0.27], [0, D.y + s + 0.8, 0.27]], [0, 0, 1]);
    B.poly('radLead', [[-s - 0.18, D.y + s, 0.32], [0, D.y + s + 0.82, 0.32], [0, D.y + s + 0.82, -0.02], [-s - 0.18, D.y + s, -0.02]], [-0.6, 0.8, 0]);
    B.poly('radLead', [[0, D.y + s + 0.82, 0.32], [s + 0.18, D.y + s, 0.32], [s + 0.18, D.y + s, -0.02], [0, D.y + s + 0.82, -0.02]], [0.6, 0.8, 0]);
    const n = 24, z = 0.29;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      B.poly('cwDial', [[0, D.y, z], [Math.sin(a0) * D.r, D.y + Math.cos(a0) * D.r, z], [Math.sin(a1) * D.r, D.y + Math.cos(a1) * D.r, z]], [0, 0, 1]);
      for (const [R0, R1] of [[D.r, D.r + 0.1], [D.r * 0.66, D.r * 0.69]]) B.poly('cwGilt', [[Math.sin(a0) * R0, D.y + Math.cos(a0) * R0, z + 0.01], [Math.sin(a0) * R1, D.y + Math.cos(a0) * R1, z + 0.01], [Math.sin(a1) * R1, D.y + Math.cos(a1) * R1, z + 0.01], [Math.sin(a1) * R0, D.y + Math.cos(a1) * R0, z + 0.01]], [0, 0, 1]);
    }
    // Roman numerals as black strokes, upright round the chapter ring (IIII, as on most church dials)
    const NUM = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    const hgt = 0.16, sw = 0.026, gap = 0.04;
    NUM.forEach((txt, k) => {
      const a = (k / 12) * TAU, rc = D.r * 0.83, cx = Math.sin(a) * rc, cy = D.y + Math.cos(a) * rc;
      const widths = [...txt].map((c) => (c === 'I' ? sw : 0.1)), W0 = widths.reduce((q, w) => q + w, 0) + gap * (txt.length - 1);
      let x = cx - W0 / 2;
      const quad = (x0, y0, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = (-dy / L) * w / 2, ny = (dx / L) * w / 2; B.poly('cwBlack', [[x0 + nx, y0 + ny, z + 0.02], [x0 - nx, y0 - ny, z + 0.02], [x1 - nx, y1 - ny, z + 0.02], [x1 + nx, y1 + ny, z + 0.02]], [0, 0, 1]); };
      for (const [j, ch] of [...txt].entries()) {
        const w = widths[j], y0 = cy - hgt / 2, y1 = cy + hgt / 2;
        if (ch === 'I') quad(x + sw / 2, y0, x + sw / 2, y1, sw);
        else if (ch === 'V') { quad(x, y1, x + w / 2, y0, sw); quad(x + w / 2, y0, x + w, y1, sw); }
        else { quad(x, y1, x + w, y0, sw); quad(x, y0, x + w, y1, sw); }
        x += w + gap;
      }
    });
    for (let k = 0; k < 60; k++) { if (k % 5 === 0) continue; const a = (k / 60) * TAU, r0 = D.r * 0.95, r1 = D.r * 0.99; B.push(new THREE.Matrix4().makeRotationZ(-a).setPosition(0, D.y, 0)); B.poly('cwBlack', [[-0.012, r0, z + 0.012], [0.012, r0, z + 0.012], [0.012, r1, z + 0.012], [-0.012, r1, z + 0.012]], [0, 0, 1]); B.pop(); }
    // the niche: a navy back plate (so the figures stand out), a moulded ledge on brackets, a canopy with a gilt valance
    const w = 2.9, y0 = by - 0.12, y1 = by + 1.75 * QB;
    B.box('radWarm', 0, (y0 + y1) / 2, 0.06, w + 0.2, y1 - y0, 0.12, 0, { bottom: true });
    B.box('cwNavy', 0, (y0 + y1) / 2, 0.13, w - 0.1, y1 - y0 - 0.1, 0.02);
    B.box('radPale', 0, y0 - 0.07, 0.36, w + 0.35, 0.16, 0.72, 0, { bottom: true });
    for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2]) B.poly('radPale', [[x - 0.12, y0 - 0.15, 0.6], [x + 0.12, y0 - 0.15, 0.6], [x + 0.12, y0 - 0.55, 0.12], [x - 0.12, y0 - 0.55, 0.12]], [0, -0.6, 0.8]);
    B.box('cwGreen', 0, y1 + 0.03, 0.38, w + 0.4, 0.16, 0.76, 0, { bottom: true });
    B.poly('radLead', [[-w / 2 - 0.2, y1 + 0.11, 0.76], [w / 2 + 0.2, y1 + 0.11, 0.76], [w / 2 + 0.2, y1 + 0.6, 0.0], [-w / 2 - 0.2, y1 + 0.6, 0.0]], [0, 0.8, 0.6]);
    for (let k = 0; k < 9; k++) { const x = -w / 2 - 0.1 + (k + 0.5) * ((w + 0.2) / 9); B.poly('cwGilt', [[x - 0.16, y1 - 0.05, 0.765], [x + 0.16, y1 - 0.05, 0.765], [x, y1 - 0.3, 0.765]], [0, 0, 1]); }
    B.box('cwGilt', 0, y1 + 0.13, 0.77, w + 0.4, 0.05, 0.03);
    for (const x of [-w / 2 - 0.1, w / 2 + 0.1]) { B.box('radPale', x, (y0 + y1) / 2, 0.36, 0.16, y1 - y0, 0.16); B.cyl('cwGilt', x, y1 + 0.1, 0.36, 0.02, 0.6, 4, false, 0.1); }
    // the two bells, hung from the canopy between the boys
    for (const x of [-0.36, 0.36]) {
      B.lathe('cwBronze', x, 0.4, [[0.0, by + 1.2], [0.25, by + 1.2], [0.22, by + 1.29], [0.16, by + 1.52], [0.12, by + 1.7], [0.0, by + 1.74]], { seg: 10 });
      B.box('iron', x, by + 1.95, 0.4, 0.035, 0.45, 0.035);
    }
    // the two quarter boys (scaled QB): legs in hose, a red kilt, a gilt cuirass with shoulder guards, a gilt helmet with
    // a red crest; the striking arm and hammer are dynamic (moving() below)
    const q = QB;
    for (const sx of [-1, 1]) {
      const x = sx * 1.02, zf = 0.42;
      for (const lx of [-0.075, 0.075]) { B.box('cwFlesh', x + lx * q, by + 0.22 * q, zf, 0.1 * q, 0.44 * q, 0.11 * q, 0, { bottom: true }); B.box('cwBlack', x + lx * q, by + 0.03 * q, zf + 0.02, 0.11 * q, 0.06 * q, 0.15 * q); }
      B.lathe('cwRed', x, zf, [[0.17 * q, by + 0.42 * q], [0.2 * q, by + 0.45 * q], [0.16 * q, by + 0.62 * q], [0.0, by + 0.62 * q]], { seg: 8 });
      B.box('cwGilt', x, by + 0.78 * q, zf, 0.32 * q, 0.34 * q, 0.2 * q);
      for (const e of [-1, 1]) B.box('cwGilt', x + e * 0.19 * q, by + 0.92 * q, zf, 0.12 * q, 0.08 * q, 0.2 * q);
      B.box('cwFlesh', x - sx * 0.2 * q, by + 0.76 * q, zf, 0.085 * q, 0.34 * q, 0.085 * q);
      B.cyl('cwFlesh', x, by + 0.96 * q, zf, 0.095 * q, 0.16 * q, 8, true);
      B.lathe('cwGilt', x, zf, [[0.125 * q, by + 1.07 * q], [0.12 * q, by + 1.17 * q], [0.08 * q, by + 1.25 * q], [0.0, by + 1.28 * q]], { seg: 10 });
      B.box('cwGilt', x, by + 1.08 * q, zf + 0.04, 0.27 * q, 0.03 * q, 0.22 * q);
      B.box('cwRed', x, by + 1.33 * q, zf - 0.02, 0.04 * q, 0.12 * q, 0.24 * q);
    }
  }
  B.pop();
  // weathering: soot and damp towards the foot of each stage, a little streaking
  const near = tintGeo(geoOf(B, P), (x, y, z, t) => { if (t[0] > 1.3 || t[1] < t[0] * 0.6) return t; const k = 0.88 + 0.16 * vnoise(x + z, y, 2.5, 4) - (y < 3 ? 0.08 * (1 - y / 3) : 0); return [t[0] * k, t[1] * k, t[2] * k]; });
  // far: the plain shaft, the parapet and the turret (the city's far tiles do the same with a box)
  const F = new RB();
  for (const f of FACES) {
    const half = f.n[0] ? T.hb : T.ha, off = f.n[0] ? T.ha : T.hb;
    F.push(faceF(f.n[0] * off, f.n[1] * off, f.n[0], f.n[1]));
    F.poly(wall, [[-half, 0, 0], [half, 0, 0], [half, T.top, 0], [-half, T.top, 0]], [0, 0, 1], [[0, 0], [2 * half, 0], [2 * half, T.top], [0, T.top]]);
    F.poly('louvre', [[-0.9, 15.2, 0.02], [0.9, 15.2, 0.02], [0.9, 18.2, 0.02], [-0.9, 18.2, 0.02]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    if (f.name === 'E') { const d = T.dial, e = d.r + 0.4; F.poly('cwGilt', [[-e, d.y - e, 0.05], [e, d.y - e, 0.05], [e, d.y + e, 0.05], [-e, d.y + e, 0.05]], [0, 0, 1]); F.poly('cwDial', [[-d.r, d.y - d.r, 0.07], [d.r, d.y - d.r, 0.07], [d.r, d.y + d.r, 0.07], [-d.r, d.y + d.r, 0.07]], [0, 0, 1]); }
    F.pop();
  }
  { const r = [[-T.ha, -T.hb], [T.ha, -T.hb], [T.ha, T.hb], [-T.ha, T.hb]].map(([a, b]) => tp(a, b)); F.poly('radLead', r.map(([x, z]) => [x, T.top - 0.3, z]), [0, 1, 0]); }
  { const tr = T.turret, [cx, cz] = tp(tr.a, tr.b); F.cyl(wall, cx, 0, cz, tr.r, tr.top + 0.5, 6, true); F.lathe('radLead', cx, cz, [[tr.r * 0.8, tr.top + 0.5], [0, tr.cap]], { seg: 6, facet: true }); }
  const far = geoOf(F, P);
  return { near, far, door: DOOR };
}

// ------------------------------------------------------------------------------------------------ the moving parts
/**
 * The clock hands and the boys' striking arms as one small non-indexed buffer (fixed vertex count) in the pack's
 * layout. pose(minutes, swing[2]) rewrites the positions/normals in place. Returns {geo, pose}.
 */
export function moving(P) {
  const parts = [];
  // a box = 12 triangles; local box description, transformed per pose
  const unitBox = (() => { const B = new RB(); B.box('cwGilt', 0, 0, 0, 1, 1, 1, 0, { bottom: true }); return geoOf(B, P); })();
  const nB = unitBox.attributes.position.count;
  const mk = (key) => { const B = new RB(); B.box(key, 0, 0, 0, 1, 1, 1, 0, { bottom: true }); return geoOf(B, P); };
  const hands = mk('cwBlack'), flesh = mk('cwFlesh'), iron = mk('iron');
  // hour hand, minute hand, two arms, two hammer heads
  parts.push({ g: hands, kind: 'hour' }, { g: hands, kind: 'min' }, { g: flesh, kind: 'arm', s: -1 }, { g: flesh, kind: 'arm', s: 1 }, { g: iron, kind: 'ham', s: -1 }, { g: iron, kind: 'ham', s: 1 });
  const n = parts.length * nB;
  const geo = new THREE.BufferGeometry();
  const src = {};
  for (const name of Object.keys(unitBox.attributes)) {
    const sz = unitBox.attributes[name].itemSize, arr = new Float32Array(n * sz);
    parts.forEach((p, i) => arr.set(p.g.attributes[name].array, i * nB * sz));
    geo.setAttribute(name, new THREE.BufferAttribute(arr, sz));
    src[name] = arr.slice();
  }
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array;
  const base = faceF(T.ha, 0, 1, 0), m = new THREE.Matrix4(), t = new THREE.Matrix4(), s = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  const D = T.dial, by = T.boys.y;
  function place(i, mat) {
    nm.getNormalMatrix(mat);
    const o = i * nB * 3;
    for (let k = 0; k < nB; k++) {
      v.fromArray(src.position, o + k * 3).applyMatrix4(mat).toArray(pos, o + k * 3);
      v.fromArray(src.normal, o + k * 3).applyMatrix3(nm).normalize().toArray(nor, o + k * 3);
    }
  }
  /** minutes past midnight (float); swing: [-1..1] per boy (0 = arm down at rest, 1 = hammer on the bell) */
  function pose(minutes, swing) {
    const mm = minutes % 60, hh = (minutes / 60) % 12;
    const hand = (ang, len, wid, zz) => { m.copy(base); t.makeTranslation(0, D.y, zz); m.multiply(t); t.makeRotationZ(-ang); m.multiply(t); t.makeTranslation(0, len * 0.4, 0); m.multiply(t); s.makeScale(wid, len, 0.025); m.multiply(s); return m; };
    place(0, hand((hh / 12) * TAU, D.r * 0.6, 0.085, 0.34));
    place(1, hand((mm / 60) * TAU, D.r * 0.88, 0.055, 0.36));
    for (const k of [0, 1]) {
      const sx = k ? 1 : -1, x = sx * 1.02 + sx * 0.2 * QB, a = (0.35 + 0.95 * Math.max(0, swing[k])) * -sx;  // raise the arm towards the bell
      m.copy(base); t.makeTranslation(x, by + 0.92 * QB, 0.46); m.multiply(t); t.makeRotationZ(-a); m.multiply(t);
      const am = m.clone(); t.makeTranslation(0, -0.2 * QB, 0); am.multiply(t); s.makeScale(0.085 * QB, 0.4 * QB, 0.085 * QB); am.multiply(s); place(2 + k, am);
      const hm = m.clone(); t.makeTranslation(0, -0.42 * QB, 0); hm.multiply(t); s.makeScale(0.2 * QB, 0.08 * QB, 0.08 * QB); hm.multiply(s); place(4 + k, hm);
    }
  }
  pose(0, [0, 0]);
  return { geo, pose };
}
