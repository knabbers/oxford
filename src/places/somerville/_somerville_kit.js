// Somerville College, STANDALONE model: the building kit every Somerville part uses (a copy of the Exeter kit with Somerville's materials). It stands on the game's own builders so
// the model drops into the city later unchanged: Batch / frame / the atlas pack of places/_worcester_kit.js (the
// college atlas: ashlar, rubble, slates, leaded lights, sashes, doors, the city's ground cells and its atlas shader
// with weathering, night-lit windows and contact shading), imported, never edited.
//
// CONVENTIONS
//   * A part builds into ONE Batch that is already in the college's LOCAL frame (x = u east, z = v south, y up from the
//     datum: _somerville_shared.js). Plan helpers take (x, z) = (u, v).
//   * A WALL is built in a wall frame F = frame(x, y, z, ax, az): s runs along (ax, az), y up, the outward normal is
//     (-az, 0, ax). So: a wall FACING SOUTH is frame(u0, y, v, 1, 0) (s runs east); FACING NORTH frame(u1, y, v, -1, 0)
//     (s runs west from its east end); FACING EAST frame(u, y, v1, 0, -1) (s runs north from its south end); FACING
//     WEST frame(u, y, v0, 0, 1) (s runs south from its north end). Outlines and openings are [[s, y], ...] counter-
//     clockwise seen from outside.
//   * Atlas cells 4 - 7 ('archDoor', 'leaded', 'slate', 'stoneSlate' and their tints) must never be used for a flat
//     surface at or below y 0.2 (the grass system reads them as lawn there). Flat ground: the ground keys ('lawn',
//     'gravel', 'paving', 'setts', 'asphalt', 'flowerbed') and, for stone floors and steps, 'pavingSolid'.
//   * Batch.cyl(key, cx, y0, cz, rTOP, h, seg, cap, rBOTTOM): the FIRST radius is the top's. Batch.box(key, cx, cy, cz,
//     w, h, d, ry, { top, bottom }) is centred. Batch.flat(key, ring, y, holes, down) is a level polygon; Batch.poly(key,
//     [[x, y, z], ...], normalHint) any planar convex polygon.
//   * Every dimension a part uses lives in its plan file as a named constant with K (known: source) or G (guess).
import * as THREE from 'three';
import { Batch, frame, rectPts, archPts, tudorPts, segPts, makePack, contactStrips } from '../_worcester_kit.js';

export { Batch, frame, rectPts, archPts, tudorPts, segPts, contactStrips, THREE };

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

/** The material pack (one for the whole college) with Somerville's own tinted cells added. */
export function somPack(world) {
  // The pack that makePack returns is WORCESTER's and there is one per world, made by whoever asks first with THAT
  // caller's ground kinds. In the game this college is installed before Worcester, so (1) it asks with exactly
  // Worcester's kinds ('apron' and 'yard' among them: asked for without them, Worcester's aprons and yards had no
  // material and were not drawn), and (2) it NEVER writes into that pack: its own keys go into a copy of the two
  // tables (the materials are shared). Written into the shared pack, Exeter's 'concrete' made worcester_nash.js skip
  // its own 'concrete', 'zinc', 'clad' and 'benchTeak', and a second college took the first one's tints.
  const shared = makePack(world, { ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' } });
  if (shared._somervillePack) return shared._somervillePack;
  const pack = { ...shared, cells: new Map(shared.cells), groundCells: new Map(shared.groundCells) };
  Object.defineProperty(shared, '_somervillePack', { value: pack, enumerable: false });
  pack._somerville = true;
  // (the ground kinds this college uses that the shared pack was not made with: 'cobbles')
  const LAYER = { paving: 7, gravel: 7, setts: 7, asphalt: 7, cobbles: 7, lawn: 3, grass: 3, flowerbed: 9 };
  for (const kind of Object.keys(LAYER)) {
    if (pack.groundCells.has(kind)) continue;
    const ci = world.tex && world.tex.cells && world.tex.cells.ground ? world.tex.cells.ground[kind] : undefined; if (ci === undefined) continue;
    const s = (world.tex.ground(kind).userData || {}).scale || 3;
    pack.groundCells.set(kind, { cell: ci, rx: 1 / s, ry: 1 / s, ox: 0, oy: 0, tint: [1, 1, 1], layer: LAYER[kind], seed: 0 });
  }
  // Somerville's materials (survey section 5). The college is mostly BRICK: Park, the Hall, Maitland and the ROQ
  // buildings red brick with stone or timber dressings; Walton House stucco; the Library, Darbishire, Penrose and the
  // Chapel stone; Wolfson, Vaughan and Fry exposed concrete frames with glass. (The 'bath*' and 'quadStone' keys are
  // the kit's defaults and stay.)
  addCell(pack, 'bath', 'stone', [1.04, 1.0, 0.92], { seed: 0.9 });
  addCell(pack, 'bathDress', 'stoneDress', [1.1, 1.07, 1.0]);
  addCell(pack, 'bathOld', 'stone', [0.92, 0.87, 0.78], { seed: 1.6 });
  addCell(pack, 'quadStone', 'stone', [1.0, 0.97, 0.88], { seed: 1.1 });
  addCell(pack, 'brick', 'redBrick', [1.0, 1.0, 1.0], { seed: 0.75 });          // the common red brick
  addCell(pack, 'brickWarm', 'redBrick', [1.1, 0.98, 0.9], { seed: 0.6 });      // orange-red (Park, the Hall)
  addCell(pack, 'brickDark', 'redBrick', [0.8, 0.74, 0.72], { seed: 1.4 });     // weathered / plum brick (plinths, north faces)
  addCell(pack, 'brickNew', 'redBrick', [1.06, 0.92, 0.84], { seed: 0.3 });     // the ROQ buildings and the Catherine Hughes Building (2011, 2019)
  addCell(pack, 'brickBuff', 'buff', [1.0, 1.0, 1.0], { seed: 0.6 });
  addCell(pack, 'stucco', 'lead', 0xe6dfcf);                                    // painted render (Walton House)
  addCell(pack, 'whitePaint', 'lead', 0xece9e2);                                // painted joinery, cornices, cupolas
  addCell(pack, 'timberOak', 'boards', 0x9a7a52);                               // the oak window bays of the ROQ buildings
  addCell(pack, 'timberGrey', 'boards', 0x8d867a);
  addCell(pack, 'precast', 'lead', 0xcfc8b8);                                   // pale precast concrete (Arup's frames)
  addCell(pack, 'zinc', 'lead', 0x7d8388);
  addCell(pack, 'concrete', 'lead', 0xb9b3a4);                                // 1964 dressings (Thomas Wood Building)
  addCell(pack, 'copper', 'lead', 0x6f9a86);
  addCell(pack, 'leadDark', 'lead', 0x5d6165);
  addCell(pack, 'ironBlack', 'lead', 0x17181a);
  addCell(pack, 'oakDoor', 'boards', 0x5a4230);
  addCell(pack, 'bench', 'boards', 0x8a7a62);
  return pack;
}
/** a tinted copy of an existing pack KEY ('stone', 'rubble', 'lead' = a plain colour, 'boards', 'slate', ...) under a new key
 *  (tint: hex or linear [r, g, b]) */
export function addCell(pack, key, from, tint, o = {}) {
  const K = pack.cells; if (!K || !K.get(from) || K.get(key)) return;
  K.set(key, { ...K.get(from), tint: Array.isArray(tint) ? tint : lin(tint), ...o });
}

// ------------------------------------------------------------------------------------------------ outlines
/** two-centred POINTED arch opening: width w centred at x, bottom y0, springing ys, apex `rise` above the springing */
export function pointedPts(x, w, y0, ys, rise, seg = 8) {
  const r = w / 2, p = [[x - r, y0], [x + r, y0], [x + r, ys]];
  // each side is an arc through the springing and the apex whose centre lies on the springing line
  const R = (r * r + rise * rise) / (2 * r), cx = r - R;      // centre of the RIGHT arc, measured from x (cx <= 0 when rise >= r)
  const a1 = Math.atan2(rise, -cx);                           // angle of the apex from the right arc's centre
  for (let i = 1; i <= seg; i++) { const a = (a1 * i) / seg; p.push([x + cx + R * Math.cos(a), ys + R * Math.sin(a)]); }
  for (let i = seg - 1; i >= 1; i--) { const a = (a1 * i) / seg; p.push([x - cx - R * Math.cos(a), ys + R * Math.sin(a)]); }
  p.push([x - r, ys]);
  return p;
}
const bbox = (pts) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, xc: (x0 + x1) / 2 }; };
/** the part of a convex-topped opening outline between x = a and x = b (a vertical strip of it), as a polygon */
function stripOf(pts, a, b) {
  const clip = (P, k, keepGreater) => {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length], ip = keepGreater ? p[0] >= k : p[0] <= k, iq = keepGreater ? q[0] >= k : q[0] <= k;
      if (ip) out.push(p);
      if (ip !== iq) { const t = (k - p[0]) / (q[0] - p[0]); out.push([k, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  };
  return clip(clip(pts, a, true), b, false);
}

// ------------------------------------------------------------------------------------------------ walls
let bayN = 0;
/** the next window "bay": which of the atlas shader's night-lit hashes a painted window takes */
export const nextBay = (y0 = 0) => [1 + (bayN++ % 251), y0 < 4.2 ? 0 : 1 + (bayN % 5)];

/**
 * A wall face with openings, in wall frame F (see CONVENTIONS). `outline` [[s, y]] CCW; ops:
 *   { pts, kind: 'win' | 'door' | 'void' | 'blind' | 'none', d: reveal depth (0.25),
 *     lights: n            stone mullions dividing the opening into n lights (Tudor and Gothic windows)
 *     transoms: [y, ...]   stone transoms at these heights
 *     glass: 'leaded' (default with lights) | 'sash' | 'sashAttic' | 'archSash' | 'glassDark'
 *     label: true          a square hood-mould (label) with drops over the head (Tudor windows and doorways)
 *     sill: false          no projecting sill
 *     doorKey: 'archDoorOak' | 'archDoor' | 'doorOak' | 'doorDark' | 'oakDoor' (a plain boarded leaf), spring: y of an arched door's springing
 *     mullionKey, mullionW (0.13), revealKey, notch: true (the opening reaches the outline's edge: cut it in the outline yourself) }
 */
export function wall(B, F, outline, ops = [], key = 'bath', o = {}) {
  B.push(F);
  B.face(key, outline, ops.filter((q) => !q.notch && q.kind !== 'blind').map((q) => q.pts));
  const dress = o.dress || 'bathDress';
  for (const q of ops) {
    const d = q.d ?? 0.25, bb = bbox(q.pts);
    if (q.kind === 'blind') { continue; }
    if (q.kind !== 'none') B.reveal(q.revealKey || key, q.pts, 0, -d, !!q.notch);
    if (q.kind === 'win') {
      const n = q.lights || 1, z = -d + 0.02, mw = q.mullionW ?? 0.13, mk = q.mullionKey || dress, g = q.glass || (q.lights || q.transoms ? 'leaded' : 'sash');
      if (g === 'archSash' && q.spring !== undefined) B.archUnit('archSash', bb.xc, bb.w, bb.y0, q.spring, z, nextBay(bb.y0));
      else if (n <= 1) B.unit(g, q.pts, z, nextBay(bb.y0));
      else for (let i = 0; i < n; i++) { const s = stripOf(q.pts, bb.x0 + (bb.w * i) / n, bb.x0 + (bb.w * (i + 1)) / n); if (s.length >= 3) B.unit(g, s, z, nextBay(bb.y0)); }
      for (let i = 1; i < n; i++) {      // mullions: up to the opening's own edge above them
        const x = bb.x0 + (bb.w * i) / n, s = stripOf(q.pts, x - 0.01, x + 0.01), top = s.length ? Math.max(...s.map((p) => p[1])) : bb.y1;
        B.box(mk, x, (bb.y0 + top) / 2, -d / 2 + 0.02, mw, top - bb.y0, d - 0.04, 0, { top: false });
      }
      for (const ty of q.transoms || []) B.box(mk, bb.xc, ty, -d / 2 + 0.02, bb.w, mw, d - 0.04, 0, { bottom: true });
      if (q.sill !== false) B.box(q.sillKey || dress, bb.xc, bb.y0 - 0.07, 0.07, bb.w + 0.2, 0.14, 0.14, 0, { bottom: true });
    } else if (q.kind === 'door') {
      const dk = q.doorKey || 'doorOak';
      if (q.spring !== undefined && (dk === 'archDoor' || dk === 'archDoorOak')) B.archUnit(dk, bb.xc, bb.w, bb.y0, q.spring, -d + 0.02, nextBay(bb.y0));
      else if (dk === 'oakDoor') B.face('oakDoor', q.pts, [], -d + 0.02);
      else B.unit(dk, q.pts, -d + 0.02);
    }
    if (q.label) label(B, bb.x0, bb.x1, bb.y1 + 0.06, q.labelDrop ?? 0.35, dress);
  }
  B.pop();
}
/** a square hood-mould (label) in the CURRENT wall frame: a bar over the head from x0 to x1 at y with short drops */
export function label(B, x0, x1, y, drop = 0.35, key = 'bathDress') {
  B.box(key, (x0 + x1) / 2, y + 0.05, 0.05, x1 - x0 + 0.36, 0.1, 0.1, 0, { bottom: true });
  for (const x of [x0 - 0.13, x1 + 0.13]) B.box(key, x, y - drop / 2, 0.05, 0.1, drop, 0.1, 0, { bottom: true });
}
/** a string-course / plinth offset in the CURRENT wall frame from x0 to x1: its top at y, h high, standing `proj` out */
export function stringCourse(B, key, x0, x1, y, h = 0.14, proj = 0.07) { B.box(key, (x0 + x1) / 2, y - h / 2, proj / 2, x1 - x0, h, proj, 0, { bottom: true }); }
/** a stepped buttress in the CURRENT wall frame centred at x: stages [[yTop, projection], ...] from the ground (y0) up,
 *  each stage weathered back to the next by a sloped top */
export function buttress(B, key, x, y0, w, stages) {
  let yb = y0;
  for (let i = 0; i < stages.length; i++) {
    const [yt, p] = stages[i], pn = i + 1 < stages.length ? stages[i + 1][1] : 0, sl = Math.min(0.45, (p - pn) * 1.2);
    B.box(key, x, (yb + yt - sl) / 2, p / 2, w, yt - sl - yb, p, 0, { top: false });
    // the weathering: a slope from the stage's front edge up to the next stage's face
    B.poly(key, [[x - w / 2, yt - sl, p], [x + w / 2, yt - sl, p], [x + w / 2, yt, pn], [x - w / 2, yt, pn]], [0, 1, 1]);
    B.poly(key, [[x - w / 2, yt - sl, pn], [x - w / 2, yt - sl, p], [x - w / 2, yt, pn]], [-1, 0, 0]);
    B.poly(key, [[x + w / 2, yt - sl, p], [x + w / 2, yt - sl, pn], [x + w / 2, yt, pn]], [1, 0, 0]);
    yb = yt - sl;
  }
}

// ------------------------------------------------------------------------------------------------ plan solids
/** vertical faces of a plan ring [[x, z], ...] (any winding) from y0 to y1, facing OUT; opts.top / opts.bottom add flat caps */
export function prism(B, key, ring, y0, y1, opts = {}) {
  let ar = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; ar += p[0] * q[1] - q[0] * p[1]; }
  const R = ar > 0 ? ring : ring.slice().reverse();      // (x east, z south: positive shoelace = clockwise seen from above)
  for (let i = 0; i < R.length; i++) {
    const p = R[i], q = R[(i + 1) % R.length], dx = q[0] - p[0], dz = q[1] - p[1];
    if (opts.skip && opts.skip.includes(i)) continue;
    B.poly(key, [[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]], [dz, 0, -dx]);
  }
  if (opts.top) B.flat(opts.topKey || key, ring, y1);
  if (opts.bottom) B.flat(key, ring, y0, [], true);
}
/** a roof over a plan ring rising to ONE apex [x, z] at y + rise (an apse's half-cone, a turret's cap, a pyramid) */
export function coneRoof(B, key, ring, y, apex, rise) {
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], mx = (p[0] + q[0]) / 2 - apex[0], mz = (p[1] + q[1]) / 2 - apex[1];
    B.poly(key, [[p[0], y, p[1]], [q[0], y, q[1]], [apex[0], y + rise, apex[1]]], [mx, 1, mz]);
  }
}
/**
 * A pitched roof over the rectangle x0..x1, z0..z1 (current frame) from eaves level y to a ridge `rise` higher.
 * o.axis 'x' | 'z': the way the ridge runs (default: the longer side). o.ends: [end at the low coordinate, end at the
 * high] each 'gable' (default; a wall triangle in o.wallKey is drawn unless o.gableWalls === false) | 'hip' | 'open'.
 * o.ov: eaves overhang (0.15). o.hipRun: plan length of a hipped end (default half the span). Returns the ridge's y.
 */
export function roof(B, key, x0, x1, z0, z1, y, rise, o = {}) {
  const axis = o.axis || (x1 - x0 >= z1 - z0 ? 'x' : 'z'), ends = o.ends || ['gable', 'gable'], ov = o.ov ?? 0.15;
  // work in (a along the ridge, c across): P(a, c, h) -> point
  const A0 = axis === 'x' ? x0 : z0, A1 = axis === 'x' ? x1 : z1, C0 = axis === 'x' ? z0 : x0, C1 = axis === 'x' ? z1 : x1;
  const P = (a, c, h) => (axis === 'x' ? [a, h, c] : [c, h, a]), N = (a, c, h) => (axis === 'x' ? [a, h, c] : [c, h, a]);
  const cm = (C0 + C1) / 2, half = (C1 - C0) / 2, run = o.hipRun ?? half, drop = (ov * rise) / half;
  const ra = ends[0] === 'hip' ? A0 + run : A0 - (ends[0] === 'gable' ? ov : 0), rb = ends[1] === 'hip' ? A1 - run : A1 + (ends[1] === 'gable' ? ov : 0);
  const ea = ends[0] === 'hip' ? A0 - ov : ra, eb = ends[1] === 'hip' ? A1 + ov : rb, yr = y + rise, ye = y - drop;
  B.poly(key, [P(ea, C1 + ov, ye), P(eb, C1 + ov, ye), P(rb, cm, yr), P(ra, cm, yr)], N(0, 1, 1));
  B.poly(key, [P(eb, C0 - ov, ye), P(ea, C0 - ov, ye), P(ra, cm, yr), P(rb, cm, yr)], N(0, -1, 1));
  if (ends[0] === 'hip') B.poly(key, [P(ea, C0 - ov, ye), P(ea, C1 + ov, ye), P(ra, cm, yr)], N(-1, 0, 1));
  else if (ends[0] === 'gable' && o.gableWalls !== false) B.poly(o.wallKey || 'bath', [P(A0, C0, y), P(A0, C1, y), P(A0, cm, yr)], N(-1, 0, 0));
  if (ends[1] === 'hip') B.poly(key, [P(eb, C1 + ov, ye), P(eb, C0 - ov, ye), P(rb, cm, yr)], N(1, 0, 1));
  else if (ends[1] === 'gable' && o.gableWalls !== false) B.poly(o.wallKey || 'bath', [P(A1, C1, y), P(A1, C0, y), P(A1, cm, yr)], N(1, 0, 0));
  return yr;
}
/** a parapet (or any low wall) along a plan polyline [[x, z], ...]: from y0, h high, t thick, centred on the line.
 *  o.battle = { merlon: 0.9, gap: 0.6, h: 0.55 } adds battlements on top; o.coping = key adds an oversailing coping. */
export function parapet(B, key, line, y0, h, t = 0.3, o = {}) {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.02) continue;
    const ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    B.box(key, cx, y0 + h / 2, cz, L + t, h, t, ry, { bottom: !!o.bottom });
    if (o.coping) B.box(o.coping, cx, y0 + h + 0.05, cz, L + t + 0.08, 0.1, t + 0.1, ry, { bottom: true });
    if (o.battle) {
      const m = o.battle.merlon ?? 0.9, g = o.battle.gap ?? 0.6, bh = o.battle.h ?? 0.55, n = Math.max(1, Math.round((L + g) / (m + g))), pitch = L / n, mw = pitch - g;
      for (let k = 0; k < n; k++) { const f = ((k + 0.5) * pitch) / L; B.box(key, a[0] + (b[0] - a[0]) * f, y0 + h + bh / 2, a[1] + (b[1] - a[1]) * f, mw, bh, t, ry); }
    }
  }
}
/** a square pinnacle: shaft w wide from y0 to y1 at (x, z), then a pyramid `spire` high */
export function pinnacle(B, key, x, z, y0, y1, w, spire, ry = 0) {
  B.box(key, x, (y0 + y1) / 2, z, w, y1 - y0, w, ry, { top: false });
  const h = w / 2 + 0.02; coneRoof(B, key, [[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]], y1, [x, z], spire);      // (square to the frame; ry turns the shaft only)
}
/** a chimney stack on the plan rectangle x0..x1, z0..z1 from y0 to y1 with a projecting cap and n pots along its longer side */
export function chimney(B, key, x0, x1, z0, z1, y0, y1, o = {}) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, n = o.pots ?? Math.max(1, Math.round(Math.max(w, d) / 0.55));
  B.box(key, cx, (y0 + y1) / 2, cz, w, y1 - y0, d, 0, { top: false });
  B.box(o.capKey || key, cx, y1 + 0.08, cz, w + 0.16, 0.16, d + 0.16, 0, { bottom: true });
  for (let i = 0; i < n; i++) { const f = (i + 0.5) / n - 0.5; B.cyl(o.potKey || 'terracotta', cx + (w >= d ? f * (w - 0.3) : 0), y1 + 0.16, cz + (w >= d ? 0 : f * (d - 0.3)), 0.13, o.potH ?? 0.45, 8, true, 0.1); }
}
/**
 * A gabled (or flat-topped) dormer in a wall frame F whose z = 0 is the DORMER'S OWN FRONT: centred at s = x, sill at
 * y, w wide, h to its eaves, running `depth` back (-z) into the roof slope. o.roof 'gable' (default) | 'flat' | 'hip';
 * o.rise (gable height, default w * 0.45); o.key cheeks and front; o.roofKey; o.glass ('leaded'), o.lights.
 */
export function dormer(B, F, x, y, w, h, depth, o = {}) {
  const key = o.key || 'bath', rk = o.roofKey || 'slate', rise = o.rise ?? w * 0.45, x0 = x - w / 2, x1 = x + w / 2, kind = o.roof || 'gable';
  const front = kind === 'gable' ? [[x0, y], [x1, y], [x1, y + h], [x, y + h + rise], [x0, y + h]] : [[x0, y], [x1, y], [x1, y + h], [x0, y + h]];
  const m = o.margin ?? 0.16, win = rectPts(x0 + m, y + m * 0.6, x1 - m, y + h - m * 0.5);
  wall(B, F, front, [{ pts: win, kind: 'win', d: 0.12, lights: o.lights, glass: o.glass || 'leaded', sill: false }], key);
  B.push(F);
  B.poly(key, [[x0, y, -depth], [x0, y, 0], [x0, y + h, 0], [x0, y + h, -depth]], [-1, 0, 0]);
  B.poly(key, [[x1, y, 0], [x1, y, -depth], [x1, y + h, -depth], [x1, y + h, 0]], [1, 0, 0]);
  if (kind === 'gable') {
    B.poly(rk, [[x0 - 0.08, y + h - 0.03, 0.1], [x, y + h + rise + 0.04, 0.1], [x, y + h + rise + 0.04, -depth], [x0 - 0.08, y + h - 0.03, -depth]], [-1, 1, 0]);
    B.poly(rk, [[x, y + h + rise + 0.04, 0.1], [x1 + 0.08, y + h - 0.03, 0.1], [x1 + 0.08, y + h - 0.03, -depth], [x, y + h + rise + 0.04, -depth]], [1, 1, 0]);
  } else B.poly(o.flatKey || 'lead', [[x0 - 0.08, y + h + 0.03, 0.1], [x1 + 0.08, y + h + 0.03, 0.1], [x1 + 0.08, y + h + 0.1, -depth], [x0 - 0.08, y + h + 0.1, -depth]], [0, 1, 0]);
  B.pop();
}
/** a straight flight of n steps in the CURRENT frame: across x0..x1, the top edge at z = zTop (level yTop), going DOWN
 *  towards +z if dir > 0 (or -z): each step `rise` high and `going` deep; solid down to yBase */
export function steps(B, key, x0, x1, zTop, dir, n, rise, going, yTop, yBase) {
  for (let i = 0; i < n; i++) {
    const yt = yTop - rise * (i + 1), za = zTop + dir * going * i, zb = zTop + dir * going * (i + 1);
    B.box(key, (x0 + x1) / 2, (yt + (yBase ?? yt - rise)) / 2, (za + zb) / 2, x1 - x0, yt - (yBase ?? yt - rise), Math.abs(zb - za), 0, {});
  }
}
/** a wall lantern (bracket + glass box) at a point of the CURRENT frame; returns [x, y, z] of its light for ctx.lamp */
export function lantern(B, x, y, z, o = {}) {
  const s = o.size ?? 0.26;
  B.box('ironBlack', x, y + s * 0.95, z, s * 1.25, 0.05, s * 1.25, 0, { bottom: true });
  B.box('lampGlass', x, y + s * 0.45, z, s, s * 0.9, s, 0, { bottom: true });
  B.box('ironBlack', x, y - 0.03, z, s * 0.8, 0.06, s * 0.8, 0, { bottom: true });
  { const h = s * 0.66; coneRoof(B, 'ironBlack', [[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]], y + s * 0.97, [x, z], s * 0.4); }
  return [x, y + s * 0.45, z];
}
/** a lamp post (a plain iron column with a lantern) standing at (x, z) on ground level y0; returns the light's point */
export function lampPost(B, x, z, y0, h = 3.2) {
  B.cyl('ironBlack', x, y0, z, 0.06, 0.5, 8, false, 0.09); B.cyl('ironBlack', x, y0 + 0.5, z, 0.045, h - 0.5, 8, false);
  return lantern(B, x, y0 + h, z, { size: 0.3 });
}
/** a garden bench (two slatted planes on four legs) centred at (x, z), facing ry, on ground y0 */
export function bench(B, x, z, y0, ry = 0, len = 1.8) {
  const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y0, z);
  B.push(M);
  B.box('bench', 0, 0.44, 0, len, 0.05, 0.45, 0, { bottom: true }); B.box('bench', 0, 0.75, -0.22, len, 0.42, 0.04, 0, { bottom: true });
  for (const sx of [-1, 1]) { B.box('bench', sx * (len / 2 - 0.08), 0.21, 0.17, 0.07, 0.42, 0.07); B.box('bench', sx * (len / 2 - 0.08), 0.48, -0.2, 0.07, 0.96, 0.07); B.box('bench', sx * (len / 2 - 0.08), 0.62, -0.02, 0.06, 0.05, 0.42); }
  B.pop();
}
/**
 * A simple broadleaf tree as geometry in the pack (trunk + a few leaf blobs), for trees the survey places exactly;
 * (x, z) foot, y0 ground, h total height, r crown radius. Seeded, so it is the same tree every time.
 */
export const hooks = { tree: null };      // (somerville.js sets hooks.tree while it builds: the tree is then drawn as the city's own tree model)
export function tree(B, x, z, y0, h, r, seed = 1) {
  if (hooks.tree) { hooks.tree(B, x, z, y0, h, r, seed); return; }
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const th = h * 0.38;
  B.cyl('oak', x, y0, z, Math.max(0.07, r * 0.05), th + 0.6, 7, false, Math.max(0.12, r * 0.09));
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(), d = r * (i === 0 ? 0 : 0.42 + rnd() * 0.2), rr = r * (0.52 + rnd() * 0.22), cy = y0 + th + (h - th) * (0.3 + rnd() * 0.4);
    blob(B, ['leafA', 'leafB', 'leafC'][i % 3], x + Math.cos(a) * d, cy, z + Math.sin(a) * d, rr, (h - th) * (0.3 + rnd() * 0.12));
  }
}
function blob(B, key, cx, cy, cz, r, ry) {
  const seg = 7, rings = 4;
  for (let j = 0; j < rings; j++) {
    const t0 = (j / rings) * Math.PI, t1 = ((j + 1) / rings) * Math.PI;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (t, a) => [cx + Math.sin(t) * Math.cos(a) * r, cy + Math.cos(t) * ry, cz + Math.sin(t) * Math.sin(a) * r];
      const q = [p(t0, a0), p(t1, a0), p(t1, a1), p(t0, a1)], n = [Math.cos((a0 + a1) / 2), Math.cos((t0 + t1) / 2) + 0.01, Math.sin((a0 + a1) / 2)];
      if (j === 0) B.poly(key, [q[0], q[1], q[2]], n); else if (j === rings - 1) B.poly(key, [q[0], q[1], q[3]], n); else B.poly(key, q, n);
    }
  }
}
