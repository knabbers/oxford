// Worcester College: hand-built ranges that the generic city builder got wrong, drawn in the college's own atlas
// (_worcester_kit.js) by places/worcester.js. From the owner's bird's-eye picture of the college (2026-11-22; the
// picture is of the 2020s, the game is c. 2013: only buildings that stood in 2013 are here).
//
//   buildSainsbury  the Sainsbury Building (MacCormac Jamieson Prichard, 1983) at the head of the lake: not one
//                   flat-topped block but a stepped cluster of square pavilions, each under its own pitched roof,
//                   stepping down to two storeys at the water. KNOWN: the mapped outline (OSM w69991357), the date,
//                   that it stands in the water's edge, buff brick, pitched roofs, the roofscape of small separate
//                   roofs in the picture. GUESSES: storey heights and counts, window sizes and rhythm, the timber
//                   oriels (the building is known for projecting timber bays; where they are is not), the doors.
import * as THREE from 'three';
import { Batch, frame, rectPts } from './_worcester_kit.js';
// 2026-11-22: the Sainsbury Building is rebuilt in _worcester_sainsbury.js (its constants live there; `?wsb=0` draws the
// one below, as it was before). The two files import each other: nothing of the other is used while a module loads.
import { SAINSBURY, SB_TERRACE, SB_PASSAGE, SB_REBUILT, SB_LEVELS, buildSainsburyNew } from './_worcester_sainsbury.js';
export { SAINSBURY, SB_TERRACE, SB_PASSAGE, SB_REBUILT, SB_LEVELS };

// 2026-11-22, Nash Quad from the owner's photograph (places/worcester_nash.js; `reference/worcester/`): the Sainsbury
// Building's east wing closes the quad's west end. `?wnash=0` (node: GTO_WNASH=0) draws it as it was before that pass.
export const NASHQ_ON = !((typeof location !== 'undefined' && location && /[?&]wnash=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_WNASH === '0'));

/**
 * A modern window in the wall plane of the current face frame (x along, y up, z out): the opening's reveals, a flat
 * frame set back in it and clean panes of glass (no glazing bars) in `cols` lights, with a transom at `tr` (0..1 of the
 * height; 0 = none). The panes take the glass of the atlas's sash cell with the window's own bay number, so each
 * window is lit on its own at night like every other. o: { wall, frame, cols, tr, depth, sill }
 */
export function paneWin(B, x0, y0, x1, y1, bay, o = {}) {
  const wall = o.wall || 'buff', fk = o.frame || 'alu', cols = o.cols || 2, tr = o.tr || 0, d = o.depth === undefined ? 0.1 : o.depth, m = o.bar || 0.055;
  const pts = rectPts(x0, y0, x1, y1);
  if (d > 0) B.reveal(wall, pts, 0, -d);
  B.poly(fk, pts.map((p) => [p[0], p[1], -d]), [0, 0, 1]);
  const pane = (a0, b0, a1, b1) => B.poly('sash', [[a0, b0, -d + 0.016], [a1, b0, -d + 0.016], [a1, b1, -d + 0.016], [a0, b1, -d + 0.016]], [0, 0, 1],
    [[bay[0] + 0.16, bay[1] + 0.79], [bay[0] + 0.27, bay[1] + 0.79], [bay[0] + 0.27, bay[1] + 0.87], [bay[0] + 0.16, bay[1] + 0.87]]);
  const w = (x1 - x0 - m) / cols, yt = tr ? y0 + (y1 - y0) * tr : y1;
  for (let i = 0; i < cols; i++) {
    const a0 = x0 + m + i * w, a1 = a0 + w - m;
    pane(a0, y0 + m, a1, yt - (tr ? m / 2 : m));
    if (tr) pane(a0, yt + m / 2, a1, y1 - m);
  }
  if (o.sill) B.box(o.sill, (x0 + x1) / 2, y0 - 0.03, 0.06, x1 - x0 + 0.12, 0.05, 0.1, 0, { bottom: true });      // (wholly in front of the wall: no face near the reveal's)
}

/** a hipped roof over the rectangle x0..x1, z0..z1 (current frame), eaves at y, overhanging by o */
export function hipRoof(B, key, x0, x1, z0, z1, y, pitch, o, sof) {
  x0 -= o; x1 += o; z0 -= o; z1 += o; y -= o * Math.tan(pitch) * 0.6;
  const w = x1 - x0, d = z1 - z0, tn = Math.tan(pitch);
  // the eaves' soffit (seen from the ground)
  B.poly(sof || 'white', [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, -1, 0]);
  if (w >= d) {
    const r = (d / 2) * tn, zc = (z0 + z1) / 2, xa = x0 + d / 2, xb = x1 - d / 2;
    B.poly(key, [[x0, y, z1], [x1, y, z1], [xb, y + r, zc], [xa, y + r, zc]], [0, 1, 1]);
    B.poly(key, [[x1, y, z0], [x0, y, z0], [xa, y + r, zc], [xb, y + r, zc]], [0, 1, -1]);
    B.poly(key, [[x1, y, z1], [x1, y, z0], [xb, y + r, zc]], [1, 1, 0]);
    B.poly(key, [[x0, y, z0], [x0, y, z1], [xa, y + r, zc]], [-1, 1, 0]);
    return y + r;
  }
  const r = (w / 2) * tn, xc = (x0 + x1) / 2, za = z0 + w / 2, zb = z1 - w / 2;
  B.poly(key, [[x1, y, z0], [x1, y, z1], [xc, y + r, zb], [xc, y + r, za]], [1, 1, 0]);
  B.poly(key, [[x0, y, z1], [x0, y, z0], [xc, y + r, za], [xc, y + r, zb]], [-1, 1, 0]);
  B.poly(key, [[x0, y, z1], [x1, y, z1], [xc, y + r, zb]], [0, 1, 1]);
  B.poly(key, [[x1, y, z0], [x0, y, z0], [xc, y + r, za]], [0, 1, -1]);
  return y + r;
}

// ------------------------------------------------------------------------------------------------ Sainsbury Building
// Its own frame: origin at the outline's north-west corner (the west wing's, by the water), a east along the west
// wing, b south; the mapped outline is rectilinear in it to 0.1 m:
//   west wing 0..18.4 x 0..11.1; north stub 18.4..25.5 x -4.6..3.8; core 18.4..35.4 x 3.8..10.9;
//   south wing 20.5..31.6 x 10.9..30.6; a low piece in the angle 16.3..20.5 x 11.1..15.6.
const SB = [
  // [a0, a1, b0, b1, storeys, eaves trim, { face: [[s0, s1] spans with windows, in a (n, s) or b (w, e)] }]
  { r: [0, 9.3, 0.3, 10.8], st: 2, win: { n: [[0.6, 8.7]], s: [[0.6, 8.7]], w: [[0.9, 10.2]] }, oriel: 'w' },          // the west wing's end, at the water: two storeys
  { r: [9.0, 18.6, 0, 11.1], st: 3, dy: 0.06, win: { n: [[9.6, 18.0]], s: [[9.6, 16.0]] }, oriel: 's' },
  { r: [18.4, 25.5, -4.6, 4.0], st: 3, dy: 0.12, win: { n: [[19.0, 24.9]], w: [[-4.2, -0.4]], e: [[-4.2, 3.4]] }, door: 'n' },   // the north stub: the door from the Worcester Place court
  { r: [18.2, 35.4, 3.8, 10.9], st: 3, dy: -0.06, win: { n: [[26.2, 34.8]], e: [[4.4, 10.3]], s: [[32.2, 34.8]] }, oriel: 'e' },   // the core
  { r: [20.5, 31.6, 10.7, 21.0], st: 3, dy: 0.03, win: { w: [[16.2, 20.6]], e: [[11.5, 20.6]] }, oriel: 'e' },                    // the south wing
  { r: [20.8, 31.3, 20.8, 30.6], st: 2, dy: 0.05, win: { w: [[21.4, 30.0]], e: [[21.4, 30.0]], s: [[21.4, 30.7]] }, oriel: 's' },  // its end: two storeys
  { r: [16.3, 20.7, 11.0, 15.6], st: 2, dy: -0.08, win: { w: [[11.5, 15.2]], s: [[16.8, 20.2]] } },                                // the low piece in the angle
];

// From the photographs of Nash Quad and of this front (`reference/worcester/14 sainsbury building/`; K: plain buff
// brick with no stone bands, black-stained timber windows and glazed bays, slate roofs with deep eaves, seven steps
// between brick cheek walls up to a paved passage straight through the wing at a raised level under a concrete lintel;
// G: which windows stand where, the roofs' form — the photographs show monopitches, these are hipped).
// The south wing's lower end is taken to start north of the passage (mapped footway w169617906 runs through it).
const SB_NASH = [
  SB[0], SB[1], SB[2],
  SB[3],
  { r: [20.5, 31.6, 10.7, 16.9], st: 3, dy: 0.03, win: { e: [[11.4, 16.4]] }, oriel: 'e', noG: 'e' },      // (a single-storey bay stands against its east face: places/worcester_nash.js)
  { r: [20.8, 31.3, 16.7, 30.6], st: 2, dy: 0.05, win: { w: [[20.6, 30.0]], e: [[20.6, 30.0]], s: [[21.4, 30.7]] }, oriel: 's', pass: true },
  SB[6],
];
/** the Sainsbury Building's ground outline as two rings either side of the passage (world points) */
export function sainsburyRings(poly) {
  const i6 = poly.findIndex((p) => Math.hypot(p[0] + 362.2, p[1] + 105.6) < 0.6), i13 = poly.findIndex((p) => Math.hypot(p[0] + 373.3, p[1] + 104.3) < 0.6);
  if (i6 < 0 || i13 < 0 || i13 < i6) return [poly];
  const hw = (SB_PASSAGE.b1 - SB_PASSAGE.b0) / 2, n = poly.length;
  const tow = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + ((b[0] - a[0]) / l) * hw, a[1] + ((b[1] - a[1]) / l) * hw]; };
  const north = [...poly.slice(0, i6), tow(poly[i6], poly[i6 - 1]), tow(poly[i13], poly[(i13 + 1) % n]), ...poly.slice(i13 + 1)];
  const south = [tow(poly[i6], poly[i6 + 1]), ...poly.slice(i6 + 1, i13), tow(poly[i13], poly[i13 - 1])];
  return [north, south];
}

export function buildSainsbury(game, M) {
  if (SB_REBUILT && NASHQ_ON) return buildSainsburyNew(game, M);
  const world = game.world, col = game.worldCollider, { O, th, storey: SH } = SAINSBURY;
  const c = Math.cos(th), s = Math.sin(th);
  const B = new Batch();
  const grp = new THREE.Group(); grp.name = 'worcester-sainsbury';
  world.addStatic(grp);
  B.push(frame(O[0], 0, O[1], c, -s));      // x = a (east along the west wing), z = b (south)
  let bayN = 600;
  const bay = (y0) => [1 + (bayN++ % 251), y0 < 2.5 ? 0 : 1 + (bayN % 5)];
  const NQ = NASHQ_ON, PS = SB_PASSAGE;
  for (const [bi, blk] of (NQ ? SB_NASH : SB).entries()) {
    const [a0, a1, b0, b1] = blk.r, H = blk.st * SH + (blk.dy || 0);
    // the four faces: frame, length, the coordinate its window spans are given in
    const faces = {
      n: [frame(a1, 0, b0, -1, 0), a1 - a0, (v) => a1 - v], s: [frame(a0, 0, b1, 1, 0), a1 - a0, (v) => v - a0],
      w: [frame(a0, 0, b0, 0, 1), b1 - b0, (v) => v - b0], e: [frame(a1, 0, b1, 0, -1), b1 - b0, (v) => b1 - v],
    };
    for (const [k, [F, L, toS]] of Object.entries(faces)) {
      const wins = [], spans = (blk.win && blk.win[k]) || [];
      for (const [v0, v1] of spans) {
        const sa = Math.min(toS(v0), toS(v1)), sb = Math.max(toS(v0), toS(v1)), n = Math.max(1, Math.floor((sb - sa) / 2.7));
        for (let i = 0; i < n; i++) wins.push(sa + ((sb - sa) * (i + 0.5)) / n);
      }
      const holes = [], door = blk.door === k ? wins[Math.floor(wins.length / 2)] : null;
      for (const sc of wins) for (let f = 0; f < blk.st; f++) {
        if (f === 0 && blk.noG === k) continue;                               // (the terrace stands against this face)
        if (blk.pass && (k === 'e' || k === 'w') && f === 0 && Math.abs((k === 'e' ? b1 - sc : sc + b0) - (PS.b0 + PS.b1) / 2) < (PS.b1 - PS.b0) / 2 + 0.95) continue;
        if (sc === door && f === 0) { holes.push({ pts: rectPts(sc - 0.55, 0, sc + 0.55, 2.15), door: true }); continue; }
        holes.push({ pts: rectPts(sc - 0.7, f * SH + 0.95, sc + 0.7, f * SH + 2.3), f, sc });
      }
      B.push(F);
      // the passage's mouth in the east and west faces of the lower south wing
      const outline = rectPts(0, 0, L, H); let tdoor = null;
      if (NQ && blk.pass && (k === 'e' || k === 'w')) { const p0 = Math.min(toS(PS.b0), toS(PS.b1)), p1 = Math.max(toS(PS.b0), toS(PS.b1)); tdoor = rectPts(p0, SB_TERRACE, p1, PS.h); }      // (tdoor: the mouth, a hole in the face)
      B.face('buff', outline, holes.filter((h) => !h.door).map((h) => h.pts).concat(holes.filter((h) => h.door).map((h) => h.pts), tdoor ? [tdoor] : []));
      if (NQ && blk.pass && (k === 'e' || k === 'w')) B.box('stoneDress', toS((PS.b0 + PS.b1) / 2), PS.h + 0.11, 0.02, PS.b1 - PS.b0 + 0.5, 0.22, 0.08, 0, { bottom: true });      // the concrete lintel
      for (const h of NQ ? holes : []) {
        if (h.door) { B.reveal('buff', h.pts, 0, -0.14, false); B.unit('doorDark', h.pts, -0.12); continue; }
        paneWin(B, h.pts[0][0], h.pts[0][1], h.pts[2][0], h.pts[2][1], bay(h.pts[0][1]), { frame: 'frame', depth: 0.14, bar: 0.07 });
      }
      for (const h of NQ ? [] : holes) {
        B.reveal('buff', h.pts, 0, -0.14, false);
        if (h.door) { B.unit('doorDark', h.pts, -0.12); B.box('stoneDress', h.pts[0][0] + 0.55, 2.24, 0.02, 1.4, 0.18, 0.1); continue; }
        B.unit('sash', h.pts, -0.12, bay(h.pts[0][1]));
        B.box('stoneDress', h.sc, h.f * SH + 0.9, 0.03, 1.56, 0.1, 0.12);      // a stone sill
      }
      // bands of pale stone at each floor and under the eaves
      for (let f = 1; f <= (NQ ? 0 : blk.st); f++) B.box('stoneDress', L / 2, f * SH - 0.1 + (f === blk.st ? blk.dy || 0 : 0), 0.02, L, 0.2, 0.07);
      if (!NQ) B.box('greyStone', L / 2, 0.22, 0.02, L, 0.44, 0.07);          // plinth
      else B.box('frame', L / 2, H - 0.09, 0.03, L, 0.16, 0.1, 0, { bottom: true });      // a dark timber eaves board
      // projecting timber oriels over the middle windows of the upper storeys (GUESS: where)
      if (blk.oriel === k && wins.length) {
        const sc = wins[Math.floor((wins.length - 1) / 2)];
        for (let f = 1; f < blk.st; f++) {
          const y0 = f * SH + 0.55, y1 = f * SH + 2.45;
          B.box(NQ ? 'frame' : 'timber', sc, (y0 + y1) / 2, 0.31, 1.9, y1 - y0, 0.58);      // (0.02 .. 0.6 out from the wall: no face in the wall's plane)
          if (NQ) { B.push(new THREE.Matrix4().makeTranslation(0, 0, 0.625)); paneWin(B, sc - 0.86, y0 + 0.2, sc + 0.86, y1 - 0.12, bay(y0), { frame: 'frame', depth: 0, cols: 3, bar: 0.07 }); B.pop(); }
          else B.unit('sash', rectPts(sc - 0.75, y0 + 0.35, sc + 0.75, y1 - 0.2), 0.625, bay(y0));
          B.box('lead', sc, y1 + 0.05, 0.33, 2.1, 0.1, 0.72);
        }
      }
      B.pop();
    }
    hipRoof(B, 'slate', a0, a1, b0, b1, H, 0.56 + (bi % 3) * 0.02, 0.55, NQ ? 'frame' : 'white');
    // the passage: brick sides, a concrete soffit, a paved floor at the head of the steps (places/worcester_nash.js builds those)
    if (NQ && blk.pass) {
      const y = PS.h;
      B.poly('buff', [[a0, 0, PS.b0], [a1, 0, PS.b0], [a1, y, PS.b0], [a0, y, PS.b0]], [0, 0, 1]);
      B.poly('buff', [[a0, 0, PS.b1], [a1, 0, PS.b1], [a1, y, PS.b1], [a0, y, PS.b1]], [0, 0, -1]);
      B.poly('plasterLit', [[a0, y, PS.b0], [a1, y, PS.b0], [a1, y, PS.b1], [a0, y, PS.b1]], [0, -1, 0]);
      B.poly('pavingSolid', [[a0, SB_TERRACE, PS.b0], [a1, SB_TERRACE, PS.b0], [a1, SB_TERRACE, PS.b1], [a0, SB_TERRACE, PS.b1]], [0, 1, 0]);
    }
  }
  // brick stacks on the three-storey pavilions
  for (const [a, b] of [[13.8, 5.5], [26.8, 7.3], [26.0, 15.8]]) { B.boxXZ('buff', a - 0.45, a + 0.45, 8.6, 12.0, b - 0.3, b + 0.3); B.boxXZ('stoneDress', a - 0.52, a + 0.52, 12.0, 12.15, b - 0.37, b + 0.37); }
  B.pop();
  const meshes = B.build(M, grp, { pack: M._pack, noCast: new Set(['signs']) });
  const mb = game.map && game.map.buildings && game.map.buildings.find((x) => x.id === SAINSBURY.id);
  if (mb) for (const ring of NQ ? sainsburyRings(mb.poly) : [mb.poly]) col.addPolygon(ring, { tag: 'building' });
  return { meshes, tris: meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0) };
}

// ------------------------------------------------------------------------------------------------ Provost's Yard roofs
// The Besse Building and the ranges round Provost's Yard (OSM w93711480) and the Provost's Lodgings (w169617900) are
// drawn by the generic city builder — the Memorial Room is fitted to the Besse west range's generic bays, so the walls
// stay — but it gives both a flat top (measured: 11.70 m and 10.60 m). The picture shows brown stone-slate hipped
// roofs round the little yard and a hipped slate roof behind the parapet of the Lodgings: those roofs are put on here.
// College LOCAL frame (worcester.js: u east, v south, the world turned by PHI about (-250, 10)); the mapped outlines
// are rectilinear in it. GUESSES: pitches, eaves overhang, chimney stacks, the Lodgings' parapet height.
const PHI = 0.0761, C0 = [-250, 10];
export const YARD_ROOFS = {
  besseY: 11.7, lodgingsY: 10.6,
  // [u0, u1, v0, v1]: the three ranges; the east and west ones run 1.8 m in under the north range's roof (no shared plane)
  besse: [[-47.95, -27.65, -60.3, -51.17], [-34.3, -27.65, -53.0, -29.3], [-53.25, -46.43, -53.0, -35.74]],
  lodgings: [-65.2, -51.7, -35.75, -15.0],
};
export function buildYardRoofs(game, M) {
  const world = game.world, R = YARD_ROOFS;
  const B = new Batch();
  const grp = new THREE.Group(); grp.name = 'worcester-yard-roofs';
  world.addStatic(grp);
  B.push(frame(C0[0], 0, C0[1], Math.cos(PHI), -Math.sin(PHI)));      // x = u, z = v
  // Besse: an eaves board round each range, the hipped roof over it, a stone stack on each ridge
  R.besse.forEach(([u0, u1, v0, v1], i) => {
    const y = R.besseY + 0.02 + i * 0.015;
    B.boxXZ('stoneDress', u0 - 0.12, u1 + 0.12, y - 0.22, y, v0 - 0.12, v1 + 0.12, { bottom: true });
    const top = hipRoof(B, 'stoneSlate', u0, u1, v0, v1, y + 0.05, 0.72 + i * 0.01, 0.35);
    const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2, along = u1 - u0 > v1 - v0;
    for (const t of [-0.28, 0.28]) { const u = along ? uc + (u1 - u0) * t : uc, v = along ? vc : vc + (v1 - v0) * t; B.boxXZ('stone', u - 0.45, u + 0.45, top - 1.2, top + 1.3, v - 0.3, v + 0.3); B.boxXZ('stoneDress', u - 0.52, u + 0.52, top + 1.3, top + 1.45, v - 0.37, v + 0.37); }
  });
  // Provost's Lodgings: a blocking course round the wall head, the hipped slate roof set back behind it, two stacks
  { const [u0, u1, v0, v1] = R.lodgings, y = R.lodgingsY;
    B.boxXZ('stoneDress', u0 - 0.2, u1 + 0.2, y - 0.25, y + 0.05, v0 - 0.2, v1 + 0.2, { bottom: true });      // cornice
    for (const [a0, a1, b0, b1] of [[u0, u1, v0, v0 + 0.35], [u0, u1, v1 - 0.35, v1], [u0, u0 + 0.35, v0 + 0.35, v1 - 0.35], [u1 - 0.35, u1, v0 + 0.35, v1 - 0.35]]) B.boxXZ('stoneDress', a0, a1, y + 0.05, y + 0.75, b0, b1);
    const top = hipRoof(B, 'slate', u0 + 0.9, u1 - 0.9, v0 + 0.9, v1 - 0.9, y + 0.3, 0.5, 0);
    const uc = (u0 + u1) / 2;
    for (const v of [v0 + 5.2, v1 - 5.2]) { B.boxXZ('stone', uc - 0.5, uc + 0.5, top - 1.0, top + 1.4, v - 0.35, v + 0.35); B.boxXZ('stoneDress', uc - 0.58, uc + 0.58, top + 1.4, top + 1.55, v - 0.43, v + 0.43); }
  }
  B.pop();
  const meshes = B.build(M, grp, { pack: M._pack, noCast: new Set(['signs']) });
  return { meshes, tris: meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0) };
}
