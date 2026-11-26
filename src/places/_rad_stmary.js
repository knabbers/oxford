// University Church of St Mary the Virgin (visual pass): the Perpendicular nave and chancel (c. 1463-1510) on the mapped
// outline with real traceried openings, buttresses, battlements and pinnacles; the north tower (c. 1270-80, 27 m) with
// its belfry lights and ball-flower; the pinnacled octagonal spire (c. 1310-20, to 58 m) with rolled, crocketed angles
// and two tiers of gabled spire-lights, four tall two-stage pinnacles and eight gabled tabernacles with statues; the
// viewing gallery round its foot; and Nicholas Stone's 1637 south porch on the High: twisted (Solomonic) columns,
// Composite capitals, a broken segmental pediment with scrolled ends, the Virgin and Child in a shell-headed niche.
// Three levels of detail in the area's one LOD draw (_rad_lod.js). build(ctx) -> { meshes, tower, porch, dims }
//   ctx = { world, parent, map, lod }
import * as THREE from 'three';
import { RB, frame, rectPts, archPts, bayLit, TAU, emitRange, pack } from './_rad_kit.js';
import { geoOf } from './_rad_lod.js';

export const ID = 'w60903337';
export const TOWER = {
  centre: [420.9, 233.3], u: [0.9768, -0.2143],   // along the north wall (east); the tower's outward face is north
  half: 4.2,          // 8.4 m square
  shaft: 18.5,        // top of the plain lower stages
  belfry: 26.0,       // gallery floor (top of the belfry stage)
  parapet: 27.0,      // top of the parapet (27 m tower, K): chest-high from the gallery
  spireR: 2.5,        // octagon circumradius at the spire's foot
  top: 58.0,          // spire tip (K: 191 ft)
  walk: [2.55, 3.6],  // the gallery (tower-local half-widths): between the spire's plinth and the parapet's inner face
};
export const PORCH = { at: [416.6, 264.2], w: 6.4, d: 2.4, h: 9.6, front: 1.6 };   // front: how far the porch's face stands out from `at` (south)

const LIT = []; for (let i = 2100; i < 4000 && LIT.length < 12; i++) if (bayLit(i, 0) < 0.08) LIT.push(i);

/** world point of tower-local (x: west along the north wall, z: north, out of the church) — the frame the tower is built in */
export function towerPt(x, z) { const [ux, uz] = TOWER.u, nx = uz, nz = -ux; return [TOWER.centre[0] - ux * x + nx * z, TOWER.centre[1] - uz * x + nz * z]; }
/** heading (game convention) of tower-local direction (dx, dz) */
export function towerHeading(dx, dz) { const [ux, uz] = TOWER.u, nx = uz, nz = -ux; const wx = -ux * dx + nx * dz, wz = -uz * dx + nz * dz; return Math.atan2(wx, wz); }

/** an equilateral-ish pointed arch outline (CCW): width w centred at x, from y0, springing ys */
export function pointPts(x, w, y0, ys, seg = 4) {
  const r = w * 0.9, p = [[x - w / 2, y0], [x + w / 2, y0], [x + w / 2, ys]];
  // right arc centred at (x + w/2 - r, ys), up to the apex; then the left arc down
  const cR = x + w / 2 - r, cL = x - w / 2 + r, apexA = Math.acos((x - cR) / r);
  for (let i = 1; i <= seg; i++) { const a = (i / seg) * apexA; p.push([cR + Math.cos(a) * r, ys + Math.sin(a) * r]); }
  for (let i = seg - 1; i >= 1; i--) { const a = (i / seg) * apexA; p.push([cL - Math.cos(a) * r, ys + Math.sin(a) * r]); }
  p.push([x - w / 2, ys]);
  return p;
}
/** a quad in the current frame facing +z whose v runs 0..1 across it (ornament bands: egg, dentil, leaf, balus) */
const band = (B, key, x0, x1, y0, y1, z) => B.poly(key, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], [[x0, 0], [x1, 0], [x1, 1], [x0, 1]]);
const rotY = (a) => new THREE.Matrix4().makeRotationY(a);
const trans = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

export function build(ctx) {
  const { world, map, lod } = ctx, T = TOWER, P = pack(world);
  const out = { meshes: [] };
  const b = map.buildings.find((q) => q.id === ID);
  const [ux, uz] = T.u, h = T.half;
  const TF = frame(T.centre[0], 0, T.centre[1], -ux, -uz);       // local x = west along the wall, local z = north (out)
  const faceM = (k) => rotY(k * Math.PI / 2);                     // k=0 north (local +z), 1 local +x (west), 2 south, 3 east
  let li = 0;

  // ------------------------------------------------------------------------------------------- nave, aisles, chancel
  const skip = (x, z) => Math.hypot(x - T.centre[0], z - T.centre[1]) < 6.2 || Math.hypot(x - PORCH.at[0], z - PORCH.at[1]) < 4.2;
  function nave(B, q) {
    if (!b) return;
    emitRange(B, [b.poly], { h: 13.2, storeys: [2.6, 11.2], win: 'perp', winW: 2.6, bay: 4.6, strings: q < 2 ? [2.2] : [], crenel: q < 2, pinnacles: q === 0 ? 4.6 : 0, bay0: 1300,
      recess: q === 0 ? 0.32 : 0, hood: q === 0, buttress: q === 0 ? [0.75, 0.9, 9.0] : null, wall: 'radHoney', dress: 'radPale', skip });
  }

  // ------------------------------------------------------------------------------------------- the tower
  function tower(B, q) {
    B.push(TF);
    const y0 = T.belfry;
    if (q === 0) {
      // plinth, the plain lower stages in coursed rubble with ashlar strings, a lancet on three faces
      B.box('radPale', 0, 0.4, 0, 2 * h + 0.5, 0.8, 2 * h + 0.5, 0, { top: true });
      for (let k = 0; k < 4; k++) {
        B.push(faceM(k));
        const lan = k !== 2 ? [pointPts(0, 0.8, 8.4, 10.2, 3)] : [];
        B.face('rubble', rectPts(-h, 0.8, h, T.shaft), lan, h);
        if (lan.length) { B.push(trans(0, 0, h)); B.reveal('radHoney', lan[0], 0, -0.4); B.unit('leaded', lan[0], -0.4, [LIT[li++ % LIT.length], 0]); B.pop(); B.box('radPale', 0, 10.75, h + 0.08, 1.2, 0.12, 0.16, 0, { bottom: true }); }
        // belfry stage: two tall pointed lights, louvred, under hood moulds; ball-flower on the string below
        const lights = [-1, 1].map((s) => pointPts(s * 1.55, 1.55, T.shaft + 1.0, T.belfry - 2.2, 4));
        B.face('radHoney', rectPts(-h + 0.1, T.shaft, h - 0.1, T.belfry), lights, h - 0.1);
        B.push(trans(0, 0, h - 0.1));
        for (const L of lights) { B.reveal('radHoney', L, 0, -0.5); B.unit('louvre', L, -0.5, [0, 0]); }
        for (const s of [-1, 1]) { B.box('radPale', s * 1.55, T.shaft + 0.92, 0.08, 1.85, 0.12, 0.16, 0, { bottom: true }); B.box('radPale', s * 1.55, (T.shaft + T.belfry - 1.2) / 2, 0.05, 0.12, T.belfry - T.shaft - 2.2, 0.1, 0, { top: false }); }
        B.pop();
        for (const y of [6.5, 12.5]) B.box('radPale', 0, y, h + 0.08, 2 * h + 0.16, 0.22, 0.16, 0, { bottom: true });
        B.box('radPale', 0, T.shaft - 0.05, h + 0.06, 2 * h + 0.2, 0.32, 0.22, 0, { bottom: true });
        band(B, 'egg', -h + 0.1, h - 0.1, T.shaft + 0.12, T.shaft + 0.42, h - 0.04);
        // parapet: blind panelling outside, plain inside, a moulded coping; a ball-flower band under it
        B.box('radPale', 0, y0 + 0.1, h + 0.08, 2 * h + 0.36, 0.32, 0.3, 0, { bottom: true });
        band(B, 'egg', -h, h, y0 - 0.32, y0 - 0.04, h - 0.05);
        B.poly('panel', [[-h, y0 + 0.26, h], [h, y0 + 0.26, h], [h, T.parapet - 0.12, h], [-h, T.parapet - 0.12, h]], [0, 0, 1], [[0, 0], [2 * h / 1.6 * 1.6, 0], [2 * h, 0.76], [0, 0.76]]);
        B.poly('radHoney', [[h - 0.6, y0, h - 0.6], [-h + 0.6, y0, h - 0.6], [-h + 0.6, T.parapet - 0.12, h - 0.6], [h - 0.6, T.parapet - 0.12, h - 0.6]], [0, 0, -1]);
        B.box('radPale', 0, T.parapet - 0.06, h - 0.28, 2 * h + 0.1, 0.14, 0.72, 0, { bottom: false });
        B.pop();
      }
      // corner buttresses: two per corner, set back in three stages with sloped weatherings
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) for (const [ax, az] of [[1, 0], [0, 1]]) {
        const ox = sa * (h - 0.55), oz = sb * (h - 0.55);
        const stages = [[0.8, 6.3, 1.25], [6.3, 12.3, 0.95], [12.3, 18.2, 0.65]];
        for (const [ya, yb, pr] of stages) {
          const x = ox + ax * sa * (pr / 2 + 0.5), z = oz + az * sb * (pr / 2 + 0.5), w = 1.0;
          B.box('radHoney', ax ? x : ox, (ya + yb) / 2, az ? z : oz, ax ? pr : w, yb - ya, az ? pr : w, 0, { top: false });
          // weathering
          const fx = ax * sa, fz = az * sb, tx = az ? 1 : 0, tz = ax ? 1 : 0, cxp = ax ? ox + fx * (h - Math.abs(ox) + pr - 0.0) : ox, czp = az ? oz + fz * (h - Math.abs(oz) + pr) : oz;
          const outer = [ax ? ox + sa * (0.5 + pr) : ox, az ? oz + sb * (0.5 + pr) : oz], inner = [ax ? ox + sa * 0.5 : ox, az ? oz + sb * 0.5 : oz];
          void cxp; void czp;
          B.poly('radPale', [[outer[0] - tx * w / 2, yb, outer[1] - tz * w / 2], [outer[0] + tx * w / 2, yb, outer[1] + tz * w / 2], [inner[0] + tx * w / 2, yb + 0.55, inner[1] + tz * w / 2], [inner[0] - tx * w / 2, yb + 0.55, inner[1] - tz * w / 2]], [fx, 0.8, fz]);
        }
      }
      B.box('radLead', 0, y0 + 0.02, 0, 2 * h - 0.3, 0.04, 2 * h - 0.3, 0, { top: true });
    } else {
      B.box('rubble', 0, T.shaft / 2, 0, 2 * h, T.shaft, 2 * h, 0, { top: false });
      B.box('radHoney', 0, (T.shaft + T.parapet) / 2, 0, 2 * h - 0.1, T.parapet - T.shaft, 2 * h - 0.1, 0, { top: true });
      if (q === 1) for (let k = 0; k < 4; k++) { B.push(faceM(k)); for (const s of [-1, 1]) B.unit('louvre', pointPts(s * 1.55, 1.55, T.shaft + 1.0, T.belfry - 2.2, 2), h - 0.03, [0, 0]); B.box('radPale', 0, T.shaft, h, 2 * h + 0.2, 0.3, 0.3, 0, { top: true }); B.pop(); }
    }
    // ---- pinnacles: four tall two-stage ones at the corners, eight gabled tabernacles with statues
    const spirelet = (x, z, r, yb, yt, crk) => {
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4, b2 = a + Math.PI / 2, rr = r * Math.SQRT2;
        const A = [x + Math.sin(a) * rr, yb, z + Math.cos(a) * rr], Bq = [x + Math.sin(b2) * rr, yb, z + Math.cos(b2) * rr];
        B.poly('radPale', [A, Bq, [x, yt, z]], [Math.sin(a + Math.PI / 4), 0.3, Math.cos(a + Math.PI / 4)]);
        if (crk) for (let i = 1; i <= crk; i++) {   // crockets up the angle
          const f = i / (crk + 1), px = A[0] + (x - A[0]) * f, py = yb + (yt - yb) * f, pz = A[2] + (z - A[2]) * f, ox = Math.sin(a) * 0.16, oz = Math.cos(a) * 0.16;
          B.poly('radPale', [[px, py, pz], [px + ox, py + 0.05, pz + oz], [px, py + 0.2, pz]], [Math.cos(a), 0, -Math.sin(a)]);
          B.poly('radPale', [[px, py, pz], [px, py + 0.2, pz], [px + ox, py + 0.05, pz + oz]], [-Math.cos(a), 0, Math.sin(a)]);
        }
      }
    };
    const gables = (x, z, r, y, gh) => { for (let k = 0; k < 4; k++) { B.push(trans(x, 0, z)); B.push(faceM(k)); B.poly('radPale', [[-r, y, r], [r, y, r], [0, y + gh, r]], [0, 0, 1]); for (const s of [-1, 1]) B.poly('radPale', [[s * r, y, r + 0.04], [0, y + gh, r + 0.04], [0, y + gh, 0], [s * r * 0.3, y + gh * 0.7, 0]], [s * 0.7, 0.7, 0.2]); B.pop(); B.pop(); } };
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const x = sa * (h - 0.42), z = sb * (h - 0.42);
      if (q === 0) {
        B.box('radPale', x, y0 + 1.6, z, 0.84, 3.2, 0.84, 0, { top: false });
        for (let k = 0; k < 4; k++) { B.push(trans(x, 0, z)); B.push(faceM(k)); band(B, 'panel', -0.42, 0.42, y0 + 0.4, y0 + 3.0, 0.425); B.pop(); B.pop(); }
        gables(x, z, 0.42, y0 + 3.2, 0.7);
        B.box('radPale', x, y0 + 4.15, z, 0.56, 1.5, 0.56, Math.PI / 4, { top: false });
        spirelet(x, z, 0.36, y0 + 4.9, y0 + 8.4, 4);
        B.lathe('radPale', x, z, [[0, y0 + 8.3], [0.11, y0 + 8.45], [0, y0 + 8.75]], { seg: 5 });
      } else if (q === 1) { B.box('radPale', x, y0 + 2.2, z, 0.84, 4.4, 0.84, 0, { top: false }); spirelet(x, z, 0.42, y0 + 4.4, y0 + 8.6, 0); }
      else spirelet(x, z, 0.5, y0, y0 + 8.6, 0);
      // the two lesser tabernacles at this corner, a statue in each
      if (q < 2) for (const [tx, tz] of [[sa * (h - 0.36), sb * (h - 1.55)], [sa * (h - 1.55), sb * (h - 0.36)]]) {
        const r = 0.33;
        B.box('radPale', tx, y0 + 1.25, tz, 2 * r, 2.5 - 0.2, 2 * r, 0, { top: false });
        if (q === 0) {
          const outK = Math.abs(tx) > Math.abs(tz) ? (sa > 0 ? 1 : 3) : (sb > 0 ? 0 : 2);
          B.push(trans(tx, 0, tz)); B.push(faceM(outK)); B.unit('niche', archPts(0, 0.5, y0 + 0.35, y0 + 1.85, 4), r + 0.01, [0, 0]); B.pop(); B.pop();
          gables(tx, tz, r, y0 + 2.4, 0.5);
          spirelet(tx, tz, 0.26, y0 + 2.6, y0 + 4.6, 2);
        } else spirelet(tx, tz, r, y0 + 2.4, y0 + 4.4, 0);
      }
    }
    // ---- the spire: octagonal plinth, eight faces to the tip, rolled angles with crockets, two tiers of spire-lights
    const sR = T.spireR, yS = y0 + 1.0, oct = (r, y, a) => { const t = (a + 0.5) / 8 * TAU; return [Math.sin(t) * r, y, Math.cos(t) * r]; };
    B.lathe('radHoney', 0, 0, q === 2 ? [[sR + 0.1, y0], [sR + 0.1, yS], [sR, yS]] : [[sR + 0.1, y0, 'radPale'], [sR + 0.1, y0 + 0.25, 'radPale'], [sR, y0 + 0.35], [sR, yS - 0.18], [sR + 0.1, yS - 0.12, 'radPale'], [sR + 0.1, yS, 'radPale'], [sR - 0.02, yS + 0.04]], { facet: true, seg: 8, a0: 0, a1: TAU, crease: 0.3 });
    for (let k = 0; k < 8; k++) {
      const A2 = oct(sR - 0.02, yS, k), B2 = oct(sR - 0.02, yS, k + 1), tm = (k + 1) / 8 * TAU, top = [0, T.top - 0.9, 0];
      B.poly(q === 2 ? 'radHoney' : 'radWarm', [A2, B2, top], [Math.sin(tm), 0.09, Math.cos(tm)]);
      if (q === 2) continue;
      const a = oct(sR + 0.0, yS, k), out = [Math.sin((k + 0.5) / 8 * TAU), 0, Math.cos((k + 0.5) / 8 * TAU)];
      B.sweep('radPale', [a, [0, T.top - 0.6, 0]], q === 0 ? [[-0.13, -0.02], [-0.09, 0.1], [0.09, 0.1], [0.13, -0.02]] : [[-0.12, 0], [0, 0.1], [0.12, 0]], out);
      if (q === 0) {
        const n = 22;
        for (let i = 1; i <= n; i++) {
          const f = i / (n + 1.5), px = a[0] * (1 - f), py = yS + (T.top - 0.9 - yS) * f, pz = a[2] * (1 - f), ox = out[0] * 0.3 * (1 - f * 0.6), oz = out[2] * 0.3 * (1 - f * 0.6), tx = out[2], tz = -out[0];
          B.poly('radPale', [[px, py, pz], [px + ox, py + 0.12, pz + oz], [px, py + 0.42 * (1 - f * 0.5), pz]], [tx, 0, tz]);
          B.poly('radPale', [[px, py, pz], [px, py + 0.42 * (1 - f * 0.5), pz], [px + ox, py + 0.12, pz + oz]], [-tx, 0, -tz]);
        }
      }
    }
    // spire-lights: a tall gabled lucarne on each cardinal face low down, a smaller one higher up
    const apo = (y) => sR * Math.cos(Math.PI / 8) * (T.top - 0.9 - y) / (T.top - 0.9 - yS);
    if (q < 2) for (let k = 0; k < 4; k++) {
      B.push(faceM(k));
      for (const [yb, w, hh] of [[yS + 0.6, 1.25, 3.3], [yS + 10.5, 0.8, 2.1]]) {
        const d0 = apo(yb + hh) - 0.1, d1 = apo(yb) + 0.25, yt = yb + hh, gt = yt + w * 0.95;
        const op = pointPts(0, w * 0.55, yb + 0.25, yt - w * 0.35, 3);
        if (q === 0) { B.face('radPale', rectPts(-w / 2, yb, w / 2, yt), [op], d1); B.push(trans(0, 0, d1)); B.reveal('radPale', op, 0, -0.25); B.unit('louvre', op, -0.25, [0, 0]); B.pop(); }
        else { B.poly('radPale', [[-w / 2, yb, d1], [w / 2, yb, d1], [w / 2, yt, d1], [-w / 2, yt, d1]], [0, 0, 1]); B.unit('louvre', op, d1 + 0.01, [0, 0]); }
        for (const s of [-1, 1]) B.poly('radPale', [[s * w / 2, yb, d0 - 0.4], [s * w / 2, yb, d1], [s * w / 2, yt, d1], [s * w / 2, yt, d0 - 0.4]], [s, 0, 0]);
        B.poly('radPale', [[-w / 2 - 0.08, yt, d1 + 0.04], [w / 2 + 0.08, yt, d1 + 0.04], [0, gt, d1 + 0.04]], [0, 0, 1]);
        for (const s of [-1, 1]) B.poly('radPale', [[s * (w / 2 + 0.08), yt, d1 + 0.04], [0, gt, d1 + 0.04], [0, gt - 0.1, d0 - 0.6], [s * (w / 2 + 0.08), yt - 0.2, d0 - 0.6]], [s * 0.7, 0.7, 0]);
        if (q === 0) B.lathe('radPale', 0, d1 + 0.02, [[0, gt - 0.05], [0.08, gt + 0.05], [0, gt + 0.35]], { seg: 4 });
      }
      B.pop();
    }
    // finial and weathervane
    B.lathe('radPale', 0, 0, [[0.32, T.top - 1.1], [0.36, T.top - 0.9], [0.2, T.top - 0.7], [0, T.top - 0.5]], { seg: 6 });
    if (q < 2) { B.lathe('radLeadLt', 0, 0, [[0.04, T.top - 0.6], [0.04, T.top + 1.1], [0, T.top + 1.2]], { seg: 4 }); B.box('radLeadLt', 0.25, T.top + 0.8, 0, 0.7, 0.28, 0.03); }
    B.pop();
  }

  // ------------------------------------------------------------------------------------------- the south porch (1637)
  const Pp = PORCH, PF = frame(Pp.at[0], 0, Pp.at[1], 1, 0);            // local x east, local z south (towards the High)
  function porch(B, q) {
    B.push(PF);
    const W = Pp.w / 2, zf = 1.6, door = archPts(0, 2.4, 0.15, 3.0, 10);
    if (q === 0) {
      B.face('radHoney', rectPts(-W, 0, W, 7.25), [door], zf);
      for (const s of [-1, 1]) B.poly('radHoney', [[s * W, 0, zf], [s * W, 0, zf - Pp.d - 1.0], [s * W, Pp.h, zf - Pp.d - 1.0], [s * W, Pp.h, zf]], [s, 0, 0]);
      B.push(trans(0, 0, zf)); B.reveal('radHoney', door, 0, -0.55); B.unit('archDoorOak', door, -0.55, [LIT[0], 0]); B.pop();
      // archivolt, keystone, imposts
      { const path = []; for (let i = 0; i <= 10; i++) { const a = Math.PI - (i / 10) * Math.PI; path.push([Math.cos(a) * 1.4, 3.0 + Math.sin(a) * 1.4, zf]); } B.sweep('radPale', path, [[-0.2, 0], [-0.2, 0.08], [0.2, 0.08], [0.2, 0]], [0, 0, 1]); }
      B.box('radPale', 0, 4.65, zf + 0.1, 0.5, 0.8, 0.2, 0, { bottom: true });
      for (const s of [-1, 1]) B.box('radPale', s * 1.45, 3.0, zf + 0.06, 0.5, 0.22, 0.12, 0, { bottom: true });
      // twisted columns: pedestals, a true helix (an 8-sided tube wound 2.5 turns round the axis), Composite capitals
      for (const s of [-1, 1]) {
        const x = s * 2.2, z = zf + 0.55, yB = 1.85, yT = 6.75;
        B.box('radPale', x, 0.9, z, 1.05, 1.8, 1.05, 0, { top: false });
        B.box('radPale', x, 1.82, z, 1.15, 0.1, 1.15, 0, { top: true, bottom: true });
        B.lathe('radPale', x, z, [[0.4, yB], [0.4, yB + 0.08], [0.34, yB + 0.16], [0.36, yB + 0.24], [0.31, yB + 0.3]], { seg: 10, crease: 0.6 });
        const N = 28, M = 8, rr = 0.27, hr = 0.11, turns = 2.5, y0 = yB + 0.3, y1 = yT - 0.1;
        const ctr = (i) => { const f = i / N, a = f * turns * TAU * s; return [x + Math.sin(a) * hr, y0 + (y1 - y0) * f, z + Math.cos(a) * hr]; };
        for (let i = 0; i < N; i++) {
          const c0 = ctr(i), c1 = ctr(i + 1);
          for (let j = 0; j < M; j++) {
            const b0 = (j / M) * TAU, b1 = ((j + 1) / M) * TAU, n0 = [Math.sin(b0), 0, Math.cos(b0)], n1 = [Math.sin(b1), 0, Math.cos(b1)];
            const p = (c, n) => [c[0] + n[0] * rr, c[1], c[2] + n[2] * rr];
            B.quadN('radPale', p(c0, n0), p(c0, n1), p(c1, n1), p(c1, n0), n0, n1, n1, n0, [b0 * rr, c0[1]], [b1 * rr, c0[1]], [b1 * rr, c1[1]], [b0 * rr, c1[1]]);
          }
        }
        B.lathe('radPale', x, z, [[0.3, y1], [0.33, y1 + 0.06], [0.33, y1 + 0.12], [0.3, y1 + 0.14, 'leaf', true], [0.42, yT + 0.45], [0.0, yT + 0.45]], { seg: 10, crease: 0.4 });
        for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * TAU; B.lathe('radPale', x + Math.sin(a) * 0.42, z + Math.cos(a) * 0.42, [[0, yT + 0.12], [0.13, yT + 0.18], [0.13, yT + 0.36], [0, yT + 0.42]], { seg: 6 }); }
        B.box('radPale', x, yT + 0.52, z, 0.95, 0.14, 0.95, 0, { bottom: true });
        // the entablature breaks forward over the column
        B.box('radHoney', x, yT + 0.92, z - 0.08, 1.1, 0.66, 1.2, 0, { top: false });
        B.box('radPale', x, yT + 1.33, z - 0.05, 1.35, 0.2, 1.45, 0, { bottom: true, top: true });
      }
      B.box('radHoney', 0, 7.67, zf + 0.15, 2 * W - 1.0, 0.66, 0.3, 0, { top: false });
      B.box('radPale', 0, 8.08, zf + 0.2, 2 * W + 0.3, 0.2, 0.55, 0, { bottom: true, top: true });
      // broken segmental pediment, its ends scrolled; a shell-headed niche rising through the gap
      for (const s of [-1, 1]) {
        const path = []; for (let i = 0; i <= 6; i++) { const t = i / 6, a = Math.PI * (0.5 + s * (0.42 - 0.3 * t)); path.push([Math.cos(a) * 3.6, 7.6 + Math.sin(a) * 2.4, zf + 1.0]); }
        B.sweep('radPale', path, [[-0.14, -0.25], [-0.14, 0.12], [0.14, 0.12], [0.14, -0.25]], [0, 0, 1]);
      }
      B.pop();
      // the scroll ends (axis across the front, in the porch frame)
      B.push(PF);
      for (const s of [-1, 1]) {
        const a = Math.PI * (0.5 + s * 0.12), ex = Math.cos(a) * 3.6, ey = 7.6 + Math.sin(a) * 2.4;
        B.push(trans(ex, ey - 0.12, zf + 0.85)); B.push(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        B.lathe('radPale', 0, 0, [[0, -0.15], [0.22, -0.15], [0.22, 0.15], [0, 0.15]], { seg: 8, crease: 0.3 });
        B.pop(); B.pop();
      }
      // the niche: an aedicule with a shell head, the Virgin and Child standing in it
      B.box('radHoney', 0, 9.35, zf + 0.35, 1.9, 2.4, 0.7, 0, { top: true });
      B.push(trans(0, 0, zf + 0.7));
      { const r = 0.62, ys = 9.75, prof = [[0, 8.3], [r, 8.3], [r, ys]]; for (let i = 1; i <= 4; i++) { const p = (i / 4) * Math.PI / 2; prof.push([r * Math.cos(p), ys + r * Math.sin(p)]); }
        B.lathe('radGroove', 0, 0, prof, { inside: true, a0: Math.PI / 2, a1: Math.PI * 1.5, seg: 8, crease: 1.2 });
        for (let i = 0; i < 7; i++) { const a = Math.PI * (0.08 + i * 0.14); B.poly('radPale', [[0, ys, 0.02], [Math.cos(a) * r, ys + Math.sin(a) * r, 0.02], [Math.cos(a + 0.06) * r, ys + Math.sin(a + 0.06) * r, 0.02]], [0, 0, 1]); } }
      B.box('radPale', 0, 8.22, 0.12, 1.5, 0.16, 0.28, 0, { bottom: true });
      B.pop();
      // the Virgin (a draped figure) with the Child on her left arm
      const zs = zf + 0.42;
      B.lathe('statue', 0, zs, [[0.3, 8.3], [0.33, 8.6], [0.27, 9.2], [0.2, 9.55], [0.16, 9.72], [0.07, 9.78], [0.08, 9.84], [0.11, 9.95], [0.1, 10.08], [0, 10.18]], { seg: 8, crease: 0.7 });
      B.lathe('statue', -0.17, zs + 0.12, [[0.0, 9.28], [0.1, 9.32], [0.11, 9.52], [0.07, 9.6], [0.075, 9.66], [0, 9.76]], { seg: 6, crease: 0.8 });
      // pediment over the niche
      B.poly('radPale', [[-1.1, 10.55, zf + 0.75], [1.1, 10.55, zf + 0.75], [0, 11.25, zf + 0.75]], [0, 0, 1]);
      for (const s of [-1, 1]) B.poly('radPale', [[s * 1.1, 10.55, zf + 0.75], [0, 11.25, zf + 0.75], [0, 11.25, zf - 0.05], [s * 1.1, 10.55, zf - 0.05]], [s * 0.6, 1, 0]);
      // gothic pinnacles at the porch's back corners and its parapet
      for (const s of [-1, 1]) { B.box('radHoney', s * (W - 0.3), 9.6, zf - 1.9, 0.6, 1.4, 0.6, 0, { top: false }); B.lathe('radPale', s * (W - 0.3), zf - 1.9, [[0.42, 10.3], [0.0, 12.4]], { seg: 4, a0: Math.PI / 4, a1: Math.PI / 4 + TAU, facet: true }); }
      B.box('radHoney', 0, 8.9, zf - 1.0, 2 * W, 1.6, 2.0, 0, { top: true });
    } else {
      B.box('radHoney', 0, Pp.h / 2 - 0.5, zf - Pp.d / 2 - 0.5, Pp.w, Pp.h - 1, Pp.d + 1.0, 0, { top: true });
      B.unit('archDoorOak', door, zf + 0.01, [LIT[0], 0]);
      for (const s of [-1, 1]) B.box('radPale', s * 2.2, 3.9, zf + 0.5, 0.7, 7.8, 0.7, 0, { top: true });
      B.box('radPale', 0, 8.0, zf + 0.4, Pp.w + 0.3, 0.6, 0.9, 0, { top: true });
      B.box('radHoney', 0, 9.6, zf + 0.2, 1.9, 2.6, 0.7, 0, { top: true });
      B.unit('radGroove', archPts(0, 1.24, 8.3, 9.75, 4), zf + 0.56, [0, 0]);
    }
    B.pop();
  }

  // ------------------------------------------------------------------------------------------- register the levels
  const tc = towerPt(0, 0), tw = lod.group('stmary:tower', [tc[0], 30, tc[1]], 30, [110, 185, 1250]);
  const nc = b ? b.poly.reduce((a, p) => [a[0] + p[0] / b.poly.length, a[1] + p[1] / b.poly.length], [0, 0]) : tc;
  const nv = lod.group('stmary:nave', [nc[0], 7, nc[1]], 30, [70, 170, 1100]);
  const pc = lod.group('stmary:porch', [Pp.at[0], 6, Pp.at[1]], 7, [55, 140, 500]);
  for (const q of [0, 1, 2]) {
    const Bt = new RB(); tower(Bt, q); tw.add(q, geoOf(Bt, P), { name: 'stmary:tower' + q });
    const Bn = new RB(); nave(Bn, q); nv.add(q, geoOf(Bn, P), { name: 'stmary:nave' + q });
    if (q < 2) { const Bp = new RB(); porch(Bp, q); pc.add(q, geoOf(Bp, P), { name: 'stmary:porch' + q }); }
  }
  out.tower = { ...T, pt: towerPt };
  out.porch = Pp;
  out.dims = { tower: T, porch: Pp };
  return out;
}

/** the gallery walkway: is (a, b) tower-local on the walk? (a square ring round the spire) */
export function onWalk(a, b) { const m = Math.max(Math.abs(a), Math.abs(b)); return m >= TOWER.walk[0] && m <= TOWER.walk[1]; }
