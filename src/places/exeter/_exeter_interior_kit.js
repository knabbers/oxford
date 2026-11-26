// Exeter College, STANDALONE model: the INTERIOR kit (walk-in rooms that are really there behind the walls: no fade, no
// teleport). Written for the Hall (exeter_hallint.js) and meant for the Chapel and any later room. It stands on what a
// part may reach without touching a shared file:
//   * GLAZING (real windows): the college atlas has no see-through cell (its glass is painted), so a part collects its
//     panes in a Glazing and adds two one-sided meshes of its own to the model's group (ctx.group, levelled with the
//     rest by exeter.js): an OUTWARD face (seen from outside: dark, a little reflective, leaded, by day as the painted
//     windows beside it; warm at night, the room being lit) and an INWARD face (seen from inside: bright pale quarries
//     by day so the quad shows through, deep blue at night), plus small heraldic roundels (plain colours, no arms).
//   * DOORS (real hinged leaves): core/_doors.js makeDoor, driven every frame from the part's result.update(dt, game)
//     (exeter.js calls it), placed in the world scene at the model's drawn level, each leaf with a collider segment that
//     follows it (as core/interiors.js does for its rooms). Walk at a door and it opens; it shuts behind you.
//   * LIGHT: by day the room is lit by the game's sun through the real windows and by the sky's fill; the interior keys
//     are the atlas's own cells with a tint (no new material). After dark the room's lamps glow (an emissive shade
//     material of its own) and their light falls on the floor, the tables and the lower walls through the world's light
//     map (world.lightmap.sources: the city's lamplight path, one instanced draw, nothing by day).
// Geometry helpers: four-centred openings, a splayed rear-arch (an outline joined to a larger one), raised-panel
// wainscot, a plain portrait (a dark frame and a muted smudge: no likeness), an arch-braced collar truss, a flat ring.
// Frames and conventions are the kit's (_exeter_kit.js): a wall frame F = K.frame(x, y, z, ax, az), s along, y up, +z out.
import * as THREE from 'three';
import * as K from './_exeter_kit.js';
import * as S from './_exeter_shared.js';
import { makeDoor } from '../../core/_doors.js';

const { L2W, PHI } = S;

// ------------------------------------------------------------------------------------------------ outlines
/** a FOUR-CENTRED (Perpendicular) opening: steep out of the springing, then nearly straight to a pointed apex h above
 *  the springing. CCW from the bottom left; `seg` points over the head (the same for two outlines of one window, so a
 *  splay can join them point to point) */
export function fourPts(x, w, y0, ys, h, seg = 12) {
  const r = w / 2, p = [[x - r, y0], [x + r, y0], [x + r, ys]], f = (k) => 0.62 * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k))) + 0.38 * k;
  const half = Math.floor(seg / 2);
  for (let i = 1; i < half; i++) { const k = 1 - Math.pow(1 - i / half, 1.8); p.push([x + r * (1 - k), ys + h * f(k)]); }
  p.push([x, ys + h]);
  for (let i = half - 1; i >= 1; i--) { const k = 1 - Math.pow(1 - i / half, 1.8); p.push([x - r * (1 - k), ys + h * f(k)]); }
  p.push([x - r, ys]);
  return p;
}
/** a round-headed (semicircular) opening, CCW from the bottom left, `seg` points over the head */
export function roundPts(x, w, y0, ys, seg = 10) {
  const r = w / 2, p = [[x - r, y0], [x + r, y0]];
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI; p.push([x + Math.cos(a) * r, ys + Math.sin(a) * r]); }
  return p;
}
const bbox = (pts) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, xc: (x0 + x1) / 2 }; };
/** the highest point of an opening outline over x */
export function topAt(pts, x) {
  let best = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    if (p[0] === q[0] || (p[0] - x) * (q[0] - x) > 0) continue;
    best = Math.max(best, p[1] + ((x - p[0]) / (q[0] - p[0])) * (q[1] - p[1]));
  }
  return best;
}

// ------------------------------------------------------------------------------------------------ glazing
let MATS = null;
function quarryTexture(alpha = 0.1, lead = 3) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  // two by two rectangular quarries (0.14 x 0.2 m each): CLEAR glass with the faintest green-grey wash (old crown glass,
  // a little uneven from pane to pane) and thin dark lead cames (3 px of 64 = 6.5 mm). From inside you see the quad
  // through it (2026-11-23: the quarries were 0.42 - 0.54 opaque white and read as frosted panes)
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const k = (i * 7 + j * 3) % 5; g.fillStyle = `rgba(${214 + k * 5}, ${226 + k * 3}, ${218 - k * 2}, ${Math.min(1, alpha + k * 0.012)})`; g.fillRect(i * 64, j * 64, 64, 64); }
  g.fillStyle = 'rgba(34, 36, 38, 0.95)';
  const h = lead / 2;
  for (const x of [0, 64]) g.fillRect(x - h, 0, lead, 128); g.fillRect(128 - h, 0, h, 128);
  for (const y of [0, 64]) g.fillRect(0, y - h, 128, lead); g.fillRect(0, 128 - h, 128, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.28, 1 / 0.4); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** the glazing and lamp materials (one set for the whole college); setDay(d: 0 night .. 1 day) */
export function glassMats() {
  if (MATS) return MATS;
  const map = quarryTexture(), mapOut = quarryTexture(0.62);      // (outside: dark and reflective by day, with a little of the room showing through)
  const inGlass = new THREE.MeshBasicMaterial({ name: 'exeter:glassIn', map, color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, side: THREE.FrontSide });
  const outGlass = new THREE.MeshStandardMaterial({ name: 'exeter:glassOut', map: mapOut, color: 0x46525a, emissive: 0x000000, emissiveMap: mapOut, roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.FrontSide });
  const her = [0x9a3a30, 0x3a5288, 0xc8a850, 0x4a7040].map((c, i) => new THREE.MeshBasicMaterial({ name: 'exeter:heraldic' + i, color: c, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.FrontSide }));   // (seen from inside only: from outside by day the glass is dark)
  const herCol = her.map((m) => m.color.clone());
  const shade = new THREE.MeshStandardMaterial({ name: 'exeter:lampShade', color: 0xf4e6c4, emissive: 0xffd9a0, emissiveIntensity: 0.6, roughness: 0.8, side: THREE.DoubleSide });
  const leaf = new THREE.MeshStandardMaterial({ name: 'exeter:doorOak', color: 0x5a3c24, roughness: 0.62 });
  const handle = new THREE.MeshStandardMaterial({ name: 'exeter:doorIron', color: 0x1c1b1a, metalness: 0.5, roughness: 0.5 });
  const day = new THREE.Color(0xffffff), dusk = new THREE.Color(0x1c2638), warm = new THREE.Color(0xffb062), tmp = new THREE.Color();
  MATS = {
    inGlass, outGlass, her, shade, leaf, handle, d: -1,
    setDay(d) {
      if (Math.abs(d - this.d) < 0.004) return; this.d = d;
      inGlass.color.copy(dusk).lerp(day, d * d); inGlass.opacity = 0.75 + 0.25 * d;
      // outside: by day a dark leaded window as the painted ones beside it; after dark the lit hall shows warm through it
      outGlass.opacity = 0.7 + 0.16 * d; outGlass.emissive.copy(warm).multiplyScalar(1 - d); outGlass.emissiveIntensity = 0.85;
      outGlass.color.setHex(0x46525a).lerp(tmp.setHex(0x8a6a48), 1 - d);
      her.forEach((m, i) => m.color.copy(herCol[i]).multiplyScalar(0.25 + 0.75 * d));
      shade.emissiveIntensity = 0.55 + 1.6 * (1 - d);
    },
  };
  return MATS;
}

/**
 * A collector of real panes for one part. pane(F, pts, z) puts a pane of the outline pts (wall frame F, plane z) with
 * its outward face and its inward face; roundel(F, x, y, r, z, colour) a small heraldic disc in it (both faces).
 * flush(ctx) builds the meshes into ctx.group (no shadows: the sun comes through) and returns them.
 */
export class Glazing {
  constructor() { this.B = new K.Batch(); this.B.push(S.localMatrix()); this.n = 0; }
  pane(F, pts, z) { this.B.push(F); this.B.face('gOut', pts, [], z + 0.004); this.B.face('gIn', pts, [], z - 0.004, true); this.B.pop(); this.n++; }
  roundel(F, x, y, r, z, c = 0, seg = 8) {
    const ring = Array.from({ length: seg }, (_, i) => { const a = (i / seg) * Math.PI * 2; return [x + Math.cos(a) * r, y + Math.sin(a) * r]; });
    this.B.push(F); this.B.face('her' + (c % 4), ring, [], z, true); this.B.pop();
  }
  flush(ctx) {
    if (!ctx.group) { this.B.parts.clear(); return []; }      // (an old exeter.js without ctx.group: the windows stay open)
    const M = glassMats(), mats = { gIn: M.inGlass, gOut: M.outGlass, her0: M.her[0], her1: M.her[1], her2: M.her[2], her3: M.her[3], shade: M.shade };
    const meshes = this.B.build(mats, ctx.group, { noShadow: true });
    for (const m of meshes) { m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; }
    return meshes;
  }
}
/** mullions (stone, through the whole reveal depth d) dividing an opening outline into n lights, transoms at the given
 *  heights, and the pane at z = -zg, in the CURRENT wall frame of B (pushed); the pane goes to the Glazing gl with F */
export function glazedLights(B, gl, F, pts, o = {}) {
  const bb = bbox(pts), n = o.lights || 1, d = o.d ?? 0.32, mw = o.mullionW ?? 0.13, mk = o.key || 'bathDress', zg = o.zg ?? 0.17;
  for (let i = 1; i < n; i++) {
    const x = bb.x0 + (bb.w * i) / n, top = Math.max(topAt(pts, x - mw / 2), topAt(pts, x + mw / 2));
    B.box(mk, x, (bb.y0 + top) / 2, -d / 2, mw, top - bb.y0, d, 0, { top: false });
  }
  for (const ty of o.transoms || []) B.box(mk, bb.xc, ty, -d / 2, bb.w, mw, d, 0, { bottom: true });
  gl.pane(F, pts, -zg);
  if (o.heraldry) {      // a roundel in the middle of each light of the lower tier (and of the upper, if there is one)
    const tiers = [bb.y0, ...(o.transoms || []), bb.y1];
    for (let t = 0; t < Math.min(2, tiers.length - 1); t++) {
      const yc = (tiers[t] + Math.min(tiers[t + 1], o.spring ?? bb.y1)) / 2; if (!(yc > bb.y0)) continue;
      // (2026-11-23: one small roundel, in the middle light of each tier — it was one in every light, 0.28 across)
      const i = Math.floor(n / 2), x = bb.x0 + (bb.w * (i + 0.5)) / n, r = Math.min(0.095, bb.w / n / 2 - 0.12);
      if (r > 0.04) gl.roundel(F, x, yc, r, -zg - 0.012, (i + t * 2 + Math.round(x * 3)) % 4, 10);
    }
  }
}

// ------------------------------------------------------------------------------------------------ walls inside
/**
 * A splay: the outline `a` (at z = za, the glass end) joined point by point to the outline `b` (at z = zb, the room's
 * face, wider and taller: a rear arch), the faces looking into the opening. a and b must have the same number of
 * points in the same order (fourPts with the same seg). The bottom edge (a sloping sill) is included.
 */
export function splay(B, key, a, za, b, zb) {
  const n = a.length; let cx = 0, cy = 0; for (const p of b) { cx += p[0]; cy += p[1]; } cx /= n; cy /= n;
  for (let i = 0; i < n; i++) {
    const p = a[i], q = a[(i + 1) % n], P = b[i], Q = b[(i + 1) % n];
    const mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
    B.poly(key, [[p[0], p[1], za], [q[0], q[1], za], [Q[0], Q[1], zb], [P[0], P[1], zb]], [cx - mx, cy - my, 0]);
  }
}
/**
 * Raised-panel wainscot in the CURRENT wall frame (facing +z), along s0..s1 from y0 to y1, standing t out from z0:
 * a plain backing board, rails and stiles as a frame, a field per panel and a capping rail. `skip` [[a, b], ...]: s
 * ranges left out (doors, a fireplace). Panels about `pw` wide, `rows` high.
 */
export function wainscot(B, key, s0, s1, y0, y1, z0 = 0, o = {}) {
  const pw = o.pw ?? 0.62, rows = o.rows ?? 2, t = o.t ?? 0.05, skip = o.skip || [];
  const spans = []; let a = s0;
  for (const [p, q] of skip.slice().sort((m, n) => m[0] - n[0])) { if (p > a + 0.05) spans.push([a, Math.min(p, s1)]); a = Math.max(a, q); }
  if (s1 > a + 0.05) spans.push([a, s1]);
  for (const [p, q] of spans) {
    const L = q - p; if (L < 0.08) continue;
    B.box(key, (p + q) / 2, (y0 + y1) / 2, z0 + t / 2, L, y1 - y0, t, 0, { top: false });
    B.box(o.capKey || key, (p + q) / 2, y1 + 0.04, z0 + t + 0.015, L + 0.02, 0.08, 0.06, 0, { bottom: true });
    B.box(o.capKey || key, (p + q) / 2, y0 + 0.11, z0 + t + 0.01, L, 0.22, 0.03, 0, { top: true });      // (the skirting)
    const n = Math.max(1, Math.round(L / pw)), w = L / n, ph = (y1 - y0 - 0.34) / rows;
    for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) {
      const cx = p + w * (i + 0.5), cy = y0 + 0.25 + ph * (j + 0.5);
      B.box(key, cx, cy, z0 + t + 0.012, w - 0.16, ph - 0.14, 0.024, 0, { bottom: false });
    }
  }
}
/** a portrait in the CURRENT wall frame: a dark (or gilt) moulded frame and a muted painted canvas with a lighter
 *  smudge where a sitter would be, NO likeness. (s, y) its middle, w x h the canvas */
export function portrait(B, s, y, w, h, z = 0, seed = 1, o = {}) {
  const fw = o.fw ?? 0.08, fk = o.frameKey || 'portraitFrame';
  B.box(fk, s, y, z + 0.035, w + fw * 2, h + fw * 2, 0.07, 0, { bottom: true });
  B.face(o.canvasKey || 'portraitDark', K.rectPts(s - w / 2, y - h / 2, s + w / 2, y + h / 2), [], z + 0.072);
  const k = ((seed * 7919) % 13) / 13, sx = s + (k - 0.5) * w * 0.15, sy = y + h * (0.08 + k * 0.08), r = Math.min(w, h) * 0.16;
  B.face(o.smudgeKey || 'portraitSmudge', Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * Math.PI * 2; return [sx + Math.cos(a) * r * 0.85, sy + Math.sin(a) * r * 1.15]; }), [], z + 0.074);
  B.face(o.bodyKey || 'portraitBody', [[sx - r * 2.2, y - h / 2 + 0.02], [sx + r * 2.2, y - h / 2 + 0.02], [sx + r * 1.3, sy - r * 1.2], [sx - r * 1.3, sy - r * 1.2]], [], z + 0.074);
}
/**
 * An ARCH-BRACED COLLAR TRUSS in a cross-section of the CURRENT frame (x across the room, y up, z along it: the truss
 * stands in z = 0): the room's inner faces at x = a (left) and x = b (right), wall plate at yp, the roof's underside
 * rising at `pitch` (rise per metre) to the apex; wall posts from the corbel tops yc to the plate; a collar at yCol;
 * arch braces from the posts' feet to a pointed apex at yArch under the collar; t = timber width (along z), dt = depth.
 */
export function archTruss(B, key, a, b, yp, pitch, yc, yCol, yArch, o = {}) {
  const t = o.t ?? 0.24, dt = o.dt ?? 0.26, m = (a + b) / 2, half = (b - a) / 2, yApex = yp + pitch * half, inset = o.inset ?? 0.14;
  const rafterAt = (x) => yp + pitch * Math.min(x - a, b - x);
  // principals (just under the boarding)
  for (const [x0, x1] of [[a, m], [b, m]]) B.beam(key, [x0, yp - dt / 2, 0], [x1, yApex - dt / 2 - 0.02, 0], t, dt);
  // the collar between them
  const cx = (yCol - yp) / pitch; B.box(key, m, yCol, 0, (b - a) - 2 * cx + 0.1, dt, t, 0, { bottom: true });
  // wall posts
  for (const x of [a + inset, b - inset]) B.box(key, x, (yc + yp) / 2, 0, dt, yp - yc, t, 0, { bottom: true });
  // arch braces: from the post's foot curving to the apex (a pointed arch of two arcs, each through the foot, tangent
  // to the post there, and meeting at the apex), in n straight pieces, with the spandrel to the principal filled by
  // a few struts
  const n = o.n ?? 8, x0 = a + inset, H = yArch - yc, W = m - x0;
  // the arc's centre lies on the level of the foot (tangent vertical there): centre (x0 + R, yc), R from the apex
  const R = (W * W + H * H) / (2 * W);
  const arc = (k) => { const ang = Math.asin(Math.min(1, (H * k) / R)), x = x0 + R - R * Math.cos(ang), y = yc + R * Math.sin(ang); return [x, y]; };
  for (const sg of [1, -1]) {
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const k = i / n, [x, y] = arc(k), X = sg > 0 ? x : 2 * m - x;
      if (prev) B.beam(key, [prev[0], prev[1], 0], [X, y, 0], t * 0.85, dt * 0.9);
      prev = [X, y];
    }
    for (const k of [0.38, 0.62, 0.85]) {      // struts from the brace up to the principal
      const [x, y] = arc(k), X = sg > 0 ? x : 2 * m - x, top = rafterAt(X);
      if (top - y > 0.25) B.box(key, X, (y + top) / 2, 0, 0.1, top - y, t * 0.6, 0, { bottom: true });
    }
  }
  // above the collar: a short king strut to the apex
  if (yApex - yCol > 0.4) B.box(key, m, (yCol + yApex) / 2, 0, 0.14, yApex - yCol - 0.1, t * 0.7, 0, {});
  return { yApex };
}
/** a carved stone corbel in the CURRENT wall frame (facing +z): its top at y, w wide, standing p out, tapering down */
export function corbel(B, key, s, y, w = 0.42, p = 0.36, h = 0.62) {
  B.box(key, s, y - 0.08, p / 2, w, 0.16, p, 0, { bottom: true });
  B.poly(key, [[s - w / 2, y - 0.16, p], [s + w / 2, y - 0.16, p], [s + w * 0.22, y - h, 0.06], [s - w * 0.22, y - h, 0.06]], [0, -0.4, 1]);
  B.poly(key, [[s - w / 2, y - 0.16, 0], [s - w / 2, y - 0.16, p], [s - w * 0.22, y - h, 0.06], [s - w * 0.22, y - h, 0]], [-1, -0.3, 0]);
  B.poly(key, [[s + w / 2, y - 0.16, p], [s + w / 2, y - 0.16, 0], [s + w * 0.22, y - h, 0], [s + w * 0.22, y - h, 0.06]], [1, -0.3, 0]);
  B.box(key, s, y - 0.42, p * 0.62, w * 0.5, 0.2, 0.12, 0, {});      // (the carved head's boss)
}

// ------------------------------------------------------------------------------------------------ doors
/**
 * Real hinged doors. add({ u, v, y, w, h, dir, swing, ... }) in the college's LOCAL frame: (u, v) the HINGE, y its floor
 * (above the datum), dir the heading of the shut leaf from hinge to latch in LOCAL terms (forward = (sin dir, cos dir)
 * in (u, v)), swing +1 | -1 (the side of the normal (cos dir, -sin dir) it opens to) or 0 (both ways). The rest are
 * makeDoor's options (style 'oak', heavy, closer, ...). update(dt, game) makes them on the first call (the model's
 * drawn level is known only after install), then drives them with the local player.
 */
export class DoorSet {
  constructor() { this.defs = []; this.doors = []; this.made = false; this._env = { audio: null, gain: 1, useKey: false }; this._me = null; this._people = []; }
  add(d) { this.defs.push(d); return this; }
  make(game) {
    this.made = true;
    const E = game.exeter, scene = game.worldScene || (game.world && game.world.scene) || game.scene; if (!E || !scene) return;
    const M = glassMats(), col = game.worldCollider;
    for (const d of this.defs) {
      const [x, z] = L2W(d.u, d.v), lift = E.lift ? E.lift(x, z) : 0;
      const D = makeDoor({ kind: 'hinged', at: [x, z], y: d.y + lift, w: d.w, h: d.h, dir: d.dir + PHI, swing: d.swing ?? 1, style: d.style || 'oak', heavy: d.heavy ?? true, closer: d.closer ?? true, thick: d.thick, handleY: d.handleY, mats: { leaf: M.leaf, handle: M.handle } });
      D.group.name = 'exeter:door:' + (d.name || this.doors.length);
      scene.add(D.group);
      // the leaf's collider: a segment from the hinge to the latch edge that turns with it (inserted over the whole
      // arc it can sweep, so the grid finds it wherever it is)
      if (col && col._insert) {
        const sg = { seg: true, x1: x, z1: z, x2: x + Math.sin(d.dir + PHI) * d.w, z2: z + Math.cos(d.dir + PHI) * d.w, tag: 'door', low: false, on: true, m: 0 };
        col._insert(sg, x - d.w - 0.1, z - d.w - 0.1, x + d.w + 0.1, z + d.w + 0.1); col.hasDoors = true; D._seg = sg;
      }
      this.doors.push(D);
    }
  }
  update(dt, game) {
    if (!this.made) this.make(game);
    if (!this.doors.length) return;
    const p = game.player; if (!p || !p.pos) return;
    let near = false; for (const D of this.doors) if (Math.abs(p.pos.x - D.pos[0]) + Math.abs(p.pos.z - D.pos[1]) < 12) { near = true; break; }
    if (!near && this._idle) return;
    const L = this._people; L.length = 0;
    if (!p.frozen && !p.vehicle) {
      const me = this._me || (this._me = { x: 0, z: 0, y: null, vx: 0, vz: 0, ix: 0, iz: 0, ch: null, me: true, map: null, shove: null });
      const inp = game.input, go = inp && (inp.moveX || inp.moveY) ? 1.2 : 0;
      me.x = p.pos.x; me.z = p.pos.z; me.y = Number.isFinite(p.pos.y) ? p.pos.y : null; me.vx = p.vx || 0; me.vz = p.vz || 0;
      me.ix = Math.sin(p.heading || 0) * go; me.iz = Math.cos(p.heading || 0) * go; me.ch = p.character || null;
      if (!me.shove) { const pt = { x: 0, z: 0 }; me.shove = (ax, az) => { pt.x = p.pos.x + ax; pt.z = p.pos.z + az; if (game.collider) game.collider.resolve(pt, p.radius || 0.32); const l = Math.hypot(ax, az) || 1, got = ((pt.x - p.pos.x) * ax + (pt.z - p.pos.z) * az) / l; p.pos.x = pt.x; p.pos.z = pt.z; return got; }; }
      L.push(me);
    }
    const env = this._env; env.audio = game.audio || null;
    let moving = false;
    for (const D of this.doors) {
      D.update(dt, L, env);
      const sg = D._seg; if (sg) { const a = D.o.dir + D.th; sg.x2 = D.o.at[0] + Math.sin(a) * D.o.w; sg.z2 = D.o.at[1] + Math.cos(a) * D.o.w; sg.wide = Math.abs(D.th) > 1.2; }
      if (Math.abs(D.th) > 0.001 || Math.abs(D.om) > 0.001) moving = true;
    }
    this._idle = !near && !moving;
  }
}

// ------------------------------------------------------------------------------------------------ the part's per-frame result
/**
 * What a part's build returns so that exeter.js drives it every frame: { update(dt, game) }. doors: a DoorSet (or null);
 * lights: [{ u, v, len, wid, dir, k }] warm pools of lamplight on the light map after dark (LOCAL frame: middle, half
 * length along dir (LOCAL heading), half width, strength). They are STATIC pools (world.lightmap.addPool): an ellipse,
 * brightest in the middle, that stops at the room's walls. (Until 2026-11-26 they were added as moving "beams", the
 * headlamps' shape: all at one end of the strip, fading to nothing at the other, and at these strengths too faint to
 * see: the Hall's tables stood dark under lit lamps.)
 */
const POOL_GAIN = 6;      // a light's k of 0.2 is a core of 1.2 (a street lantern's is 2.8): the look, 2026-11-26
export function roomResult({ doors = null, lights = [] } = {}) {
  let hooked = false;
  const M = glassMats(), W = lights.map((l) => { const [x, z] = L2W(l.u, l.v), a = (l.dir ?? 0) + PHI; return [x, z, Math.sin(a), Math.cos(a), l.len, l.wid, l.k ?? 0.5]; });
  const col = [1.0, 0.8, 0.56];
  return {
    doors,      // (the DoorSet, for tools: tools/exeter_doorwalk.mjs reads each door's open / passable)
    update(dt, game) {
      const d = game.time && Number.isFinite(game.time.daylight) ? game.time.daylight : 1;
      M.setDay(d);
      if (doors) doors.update(dt, game);
      if (!hooked && W.length && game.world && game.world.lightmap && Array.isArray(game.world.lightmap.sources)) {
        hooked = true;
        const Lm = game.world.lightmap;
        if (Lm.addPool) for (const [x, z, dx, dz, hl, hw, k] of W) Lm.addPool(x, z, dx, dz, hl, hw, col[0] * k * POOL_GAIN, col[1] * k * POOL_GAIN, col[2] * k * POOL_GAIN);
        else Lm.sources.push((add) => { for (const [x, z, dx, dz, hl, hw, k] of W) if (!add(x, z, dx, dz, hl, hw, col[0] * k, col[1] * k, col[2] * k)) break; });
      }
    },
  };
}

// ------------------------------------------------------------------------------------------------ stained glass (added for the Chapel)
// New exports only (the Hall's pieces above are unchanged). The Chapel's windows are figurative Victorian glass, deep
// blue and red: drawn as ABSTRACT colour fields (small coloured panes in a leaded pattern: borders of quarries, a medallion
// in each panel), never figures. The outward face is the shared outGlass (dark by day, warm at night); the inward face a
// stained material of its own, bright by day (the sun behind it), dim blue at night.
let SMATS = null;
/** one stained-glass design (seed: which of the variants). Irregular LEADING (2026-11-23: it was a regular 12 px grid on
 *  every light, and read as a grid): the field is cut into pieces on a jittered lattice, each piece split once at a
 *  random slant, every piece its own colour; a medallion (a ring of pieces round a rich centre) and a canopy band at the
 *  head, borders down both edges; then the leads drawn round every piece. Abstract colour, no figure. */
function stainedTexture(seed = 7) {
  if (typeof document === 'undefined') return null;
  const W = 128, H = 192, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  let s = seed * 7919 + 13; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pal = { blue: ['#1d2f86', '#24409e', '#162571', '#2c4cb0', '#3a5ab8'], red: ['#9c1f22', '#b8302a', '#7d1a1e', '#c4402e'], amber: ['#c8952c', '#d9b04a', '#e0c060'], green: ['#2f6b3a', '#3f7d44', '#4c8a3a'], white: ['#e0dcc4', '#cfc8aa', '#ebe6d2'], purple: ['#4b2a6a', '#5e3478'], ruby: ['#8a1830'] };
  const pick = (k) => pal[k][Math.floor(rnd() * pal[k].length)];
  const ground = seed % 2 ? ['blue', 'blue', 'blue', 'red', 'purple'] : ['red', 'blue', 'blue', 'ruby', 'blue'];
  const fig = ['red', 'white', 'amber', 'green', 'white', 'purple', 'red', 'blue', 'white'];
  // the lattice: points every ~14 px, jittered (the edges kept straight so the design tiles)
  const nx = 9, ny = 13, P = [];
  for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) { const ex = i === 0 || i === nx, ey = j === 0 || j === ny; row.push([(i / nx) * W + (ex ? 0 : (rnd() - 0.5) * 9), (j / ny) * H + (ey ? 0 : (rnd() - 0.5) * 9)]); } P.push(row); }
  const cx = W / 2, cy = H * (0.42 + 0.12 * ((seed * 3) % 3) / 2), R1 = 30 + (seed % 3) * 4;
  const pieces = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const q = [P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]], mx = (q[0][0] + q[2][0]) / 2, my = (q[0][1] + q[2][1]) / 2, d = Math.hypot(mx - cx, my - cy);
    const edge = i === 0 || i === nx - 1, head = j <= 1, inMed = d < R1, ring = d >= R1 && d < R1 + 10;
    // (no border or band at the tile's edges: repeated tile by tile they made stripes, a grid again; the mullions frame each light)
    const col = () => (ring ? pick(rnd() < 0.7 ? 'red' : 'amber') : inMed ? pick(fig[Math.floor(rnd() * fig.length)]) : rnd() < 0.08 ? pick(rnd() < 0.5 ? 'white' : 'amber') : pick(ground[Math.floor(rnd() * ground.length)]));
    void edge; void head;
    if (rnd() < 0.55) { const k = rnd() < 0.5, a1 = k ? [q[0], q[1], q[2]] : [q[0], q[1], q[3]], a2 = k ? [q[0], q[2], q[3]] : [q[1], q[2], q[3]]; a1.c = col(); a2.c = col(); pieces.push(a1, a2); }
    else { q.c = col(); pieces.push(q); }
  }
  for (const pc of pieces) { g.fillStyle = pc.c; g.beginPath(); g.moveTo(pc[0][0], pc[0][1]); for (const p of pc.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fill(); }
  // a few figure-like patches inside the medallion (pale and gold shapes on the coloured field: no figure)
  for (let k = 0; k < 5; k++) { const a = rnd() * Math.PI * 2, r = rnd() * R1 * 0.6; g.fillStyle = pick(['white', 'amber', 'white', 'green', 'red'][k]); g.beginPath(); g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4 + rnd() * 5, 7 + rnd() * 8, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  // leads: round every piece, thicker round the medallion and the edge
  g.strokeStyle = 'rgba(22, 19, 16, 1)'; g.lineJoin = 'round'; g.lineWidth = 1.6;
  for (const pc of pieces) { g.beginPath(); g.moveTo(pc[0][0], pc[0][1]); for (const p of pc.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.stroke(); }
  g.lineWidth = 3.5; g.beginPath(); g.arc(cx, cy, R1, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(cx, cy, R1 + 10, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / (0.86 + 0.06 * (seed % 2)), 1 / (1.3 + 0.1 * (seed % 3))); t.offset.set(0.13 * seed, 0.31 * seed); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const N_STAINED = 4;
/** the stained glass's inward materials (one per design: a window takes one of them), its outward face (darker and more
 *  opaque than the Hall's clear glass) and a candle-flame material; setDay(d) as glassMats */
export function stainedMats() {
  if (SMATS) return SMATS;
  const sIns = Array.from({ length: N_STAINED }, (_, k) => new THREE.MeshBasicMaterial({ name: 'exeter:stainedIn' + k, map: stainedTexture(7 + k * 5), color: 0xffffff, transparent: true, opacity: 0.94, depthWrite: false, side: THREE.FrontSide }));
  const M = glassMats(), sOut = M.outGlass.clone(); sOut.name = 'exeter:stainedOut'; sOut.map = sOut.emissiveMap = quarryTexture(0.92, 2);
  const flame = new THREE.MeshBasicMaterial({ name: 'exeter:flame', color: 0xffd890, side: THREE.DoubleSide });
  const day = new THREE.Color(0xffffff), night = new THREE.Color(0x1a2240), warmOut = new THREE.Color(0x8a6a48);
  SMATS = { sIn: sIns[0], sIns, sOut, flame, d: -1, setDay(d) {
    if (Math.abs(d - this.d) < 0.004) return; this.d = d;
    for (const m of sIns) m.color.copy(night).lerp(day, Math.min(1, d * 1.2));
    sOut.opacity = 0.82 + 0.14 * d; sOut.emissive.setHex(0xffb062).multiplyScalar((1 - d) * 0.6); sOut.emissiveIntensity = 0.85; sOut.color.setHex(0x46525a).lerp(warmOut, 1 - d);
  } };
  return SMATS;
}
/** a Glazing whose inward faces are stained glass (each pane one of the designs, in turn); flame(x, y, z, r, h) adds a
 *  candle flame (a small cone in the flame material). Same pane(F, pts, z) as Glazing. */
export class StainedGlazing extends Glazing {
  pane(F, pts, z) { const k = this.n % N_STAINED; this.B.push(F); this.B.face('gOut', pts, [], z + 0.004); this.B.face('gIn' + k, pts, [], z - 0.004, true); this.B.pop(); this.n++; }
  flame(x, y, z, r = 0.02, h = 0.06) { this.B.cyl('flame', x, y, z, r, h, 4, false, 0.002); }
  flush(ctx) {
    if (!ctx.group) { this.B.parts.clear(); return []; }
    const M = glassMats(), Sm = stainedMats(), mats = { gOut: Sm.sOut, flame: Sm.flame, her0: M.her[0], her1: M.her[1], her2: M.her[2], her3: M.her[3] };
    Sm.sIns.forEach((m, k) => { mats['gIn' + k] = m; });
    const meshes = this.B.build(mats, ctx.group, { noShadow: true });
    for (const m of meshes) { m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; }
    return meshes;
  }
}
/** roomResult plus the stained glass following the daylight */
export function chapelResult(o = {}) {
  const r = roomResult(o), Sm = stainedMats();
  return { doors: r.doors, update(dt, game) { const d = game.time && Number.isFinite(game.time.daylight) ? game.time.daylight : 1; Sm.setDay(d); r.update(dt, game); } };
}
