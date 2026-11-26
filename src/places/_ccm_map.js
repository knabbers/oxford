// Christ Church Meadow — what the module changes in the MAP before the world is built (preMap). Pure functions of the
// map: deterministic, no DOM, no THREE, also used by tools/smoke_ccm.mjs. See docs/research/christ_church_meadow.md.
//
//  * the two grazed fields: the mapped boundary fence (w3662825, a closed ring inside the paths) and the cross fence
//    (w40779858) become iron estate railings, 1.25 m; the ring is split into the two field polygons, which are drawn
//    as rough 'meadow' (holes in the mown park around them), and three closed field gates are left as gaps that
//    christ_church_meadow.js fills with a gate leaf and a collider. THE RIVER BANKS ARE NOT FENCED: the ring runs
//    inland of the river walk and the Cherwell walk, and nothing here adds a barrier between a path and the water.
//  * the Memorial Garden, Merton Field and Poplar Walk fences become low railings (they are drawn as close-board
//    garden fences otherwise: the meadow is outside the 'centre' zone).
//  * the walks: Broad Walk as wide as the world draws a path (6 m + worn margins), New Walk 4.5 m, both pale
//    gravel; the river and Cherwell walks 3 m.
//  * the mapped avenue trees keep their mapped positions and heights but get the right species: the world picks a
//    mapped tree's species from a hash of its position, so each is nudged by at most 0.3 m to a spot whose hash gives
//    a plane (Broad Walk, the replanted avenue) or a broad crown (New Walk's hybrid black poplars, raised to 21-24 m).
//  * Jubilee Bridge (Cherwell footbridge, opened 2014) is left out: the game is c. 2013.
//  * benches along Broad Walk and the river; the Meadow Building restyled (Venetian Gothic: pointed two-light windows,
//    paler stone, slate).
import { ROOFSCAPE } from '../world/landmarks.js';   // roofscape pass: the city atlas's Venetian pair cell
import { hash2 } from '../world/util.js';

export const IDS = {
  meadow: 'r1102976', ring: 'w3662825', cross: 'w40779858', wood: 'w935399603',
  broadWalk: ['w24449151'], newWalk: ['w8125937', 'w1209131111'], riverWalks: ['w1209131112', 'w3171321', 'w2988126', 'w1209131110', 'w95826215'],
  lowRailings: { w931474943: 1.0, w931474944: 1.0, w3662794: 1.3, w165745462: 1.25 },
  jubilee: ['w287882726', 'w570001859', 'n12566120071'],
  meadowBuilding: ['w931938828', 'w931938834', 'w931938835', 'w931938836', 'w931938837', 'w931938838', 'w931938839', 'w931938840', 'w931938841', 'w931938842', 'w931938843', 'w931938844', 'w931938845', 'w931938846', 'w931938847', 'w931938848'],
  meadowGate: 'w931938854', boathouse: 'w95661025',
};
/** field gates: a point on the ring (snapped to it), the gap is GATE_W wide */
export const FIELD_GATES = [[396, 740], [405, 930], [596, 1146]];
export const GATE_W = 3.6;
export const RAIL_H = 1.25;

const dseg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
export function pointInPoly(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < ((P[j][0] - P[i][0]) * (z - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; }
export function distToPoly(x, z, P) { let d = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; d = Math.min(d, dseg(x, z, a[0], a[1], b[0], b[1])); } return d; }
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5;
function lineLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
/** arc length s of the point of pts nearest (x,z), and that point */
function project(pts, x, z) {
  let best = Infinity, bs = 0, bp = null, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 1e-6) continue;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / (l * l); t = Math.max(0, Math.min(1, t));
    const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bs = acc + t * l; bp = [px, pz, dx / l, dz / l]; }
    acc += l;
  }
  return { s: bs, p: bp, d: best };
}
function slice(pts, s0, s1) {
  const out = []; let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const at = (s) => { const t = l ? (s - acc) / l : 0; return [+(a[0] + (b[0] - a[0]) * t).toFixed(2), +(a[1] + (b[1] - a[1]) * t).toFixed(2)]; };
    if (acc + l >= s0 && acc <= s1) {
      if (!out.length) out.push(at(Math.max(s0, acc)));
      if (acc + l <= s1) out.push([b[0], b[1]]); else { out.push(at(s1)); break; }
    }
    acc += l;
  }
  return out;
}

/** The two fields as polygons (open rings) from the mapped fences: {north, south, ring, cross} or null. */
export function fieldPolys(map) {
  const ringB = map.barriers.find((b) => b.id === IDS.ring), crossB = map.barriers.find((b) => b.id === IDS.cross);
  if (!ringB || !crossB) return null;
  const R = ringB.pts.slice(); if (near(R[0], R[R.length - 1])) R.pop();
  const C = crossB.pts, ia = R.findIndex((p) => near(p, C[C.length - 1])), ib = R.findIndex((p) => near(p, C[0]));   // (401,814) and (782,910)
  if (ia < 0 || ib < 0) return null;
  const walk = (i0, i1) => { const o = []; for (let i = i0; ; i = (i + 1) % R.length) { o.push(R[i]); if (i === i1) break; } return o; };
  // south: ring from the west end of the cross fence down New Walk, along the river, up the Cherwell to its east end
  const south = walk(ia, ib).concat(C.slice(1, -1));
  const north = walk(ib, ia).concat(C.slice(1, -1).reverse());
  return { north, south, ring: ringB.pts, cross: C };
}

/** where the field gates are: [{x, z, dx, dz, s}] on the ring (dx,dz = along the railing) */
export function gateSpots(map) {
  const ringB = map.barriers.find((b) => b.id === IDS.ring); if (!ringB) return [];
  return FIELD_GATES.map(([x, z]) => { const q = project(ringB.pts, x, z); return { x: q.p[0], z: q.p[1], dx: q.p[2], dz: q.p[3], s: q.s }; });
}

/** the ring railing as pieces with the gate gaps cut out */
export function ringPieces(map) {
  const ringB = map.barriers.find((b) => b.id === IDS.ring); if (!ringB) return [];
  const pts = ringB.pts, L = lineLen(pts), cuts = gateSpots(map).map((g) => g.s).sort((a, b) => a - b);
  const ivs = []; let s0 = 0;
  for (const s of cuts) { ivs.push([s0, s - GATE_W / 2]); s0 = s + GATE_W / 2; }
  ivs.push([s0, L]);
  const pieces = ivs.map(([a, b]) => slice(pts, a, b)).filter((p) => p.length >= 2);
  // the ring is closed: join the last piece to the first across the start vertex
  if (pieces.length > 1 && near(pts[0], pts[pts.length - 1])) { const last = pieces.pop(); pieces[0] = last.concat(pieces[0].slice(1)); }
  return pieces;
}

/** species the world will give a mapped tree at (x, z): mirrors world/vegetation.js step 1 (not near water) */
const mappedHash = (x, z) => hash2(Math.round(x * 10), Math.round(z * 10));
/** nudge (x, z) by <= 0.3 m so that the world's hash falls in [lo, hi); returns [x, z] (unchanged if none found) */
export function nudgeTo(x, z, lo, hi) {
  let best = null, bd = Infinity;
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    const nx = Math.round(x * 10 + i) / 10, nz = Math.round(z * 10 + j) / 10, r = mappedHash(nx, nz), d = i * i + j * j;
    if (r >= lo && r < hi && d < bd) { bd = d; best = [nx, nz]; }
  }
  return best || [x, z];
}
function polyline(map, ids) { const out = []; for (const id of ids) { const r = map.roads.find((q) => q.id === id); if (r) out.push(r.pts); } return out; }
const nearLines = (x, z, lines, d) => lines.some((pts) => { for (let i = 0; i < pts.length - 1; i++) if (dseg(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < d) return true; return false; });

/** benches along Broad Walk (south verge, under the trees) and the river walk: [{id, p, kind}] */
export function extraBenches(map) {
  const out = [], bw = map.roads.find((r) => r.id === IDS.broadWalk[0]);
  if (bw) {
    const L = lineLen(bw.pts);
    for (let s = 150, k = 0; s < L - 20; s += 34, k++) {
      const q = slice(bw.pts, s, s + 1); if (q.length < 2) continue;
      const [a, b] = q, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, side = nz > 0 ? 1 : -1;   // the meadow side (south)
      const x = a[0] + nx * side * 5.6, z = a[1] + nz * side * 5.6;   // (just off the 9 m walk's edge)
      if (map.pois.some((p) => p.kind === 'bench' && Math.hypot(p.p[0] - x, p.p[1] - z) < 12)) continue;
      out.push({ id: 'ccm-bench-bw' + k, p: [+x.toFixed(2), +z.toFixed(2)], kind: 'bench' });
    }
  }
  return out;
}

/** everything preMap does, applied to game.map / game.overrides (idempotent) */
export function preMapMeadow(game) {
  const map = game.map; if (!map || map._ccmDressed) return null;
  map._ccmDressed = true;
  const ov = game.overrides, report = { railings: 0, fields: 0, trees: 0, benches: 0, gates: 0 };
  const F = fieldPolys(map);
  // ---- fences -> railings, the ring split at the gates
  if (F) {
    map._ccmGates = gateSpots(map);                     // (before the ring is split: afterwards IDS.ring is only its first piece)
    const ringIdx = map.barriers.findIndex((b) => b.id === IDS.ring);
    const pieces = ringPieces(map);
    const ring = map.barriers[ringIdx];
    map.barriers.splice(ringIdx, 1, ...pieces.map((pts, i) => ({ id: i ? IDS.ring + '-ccm' + i : IDS.ring, kind: 'railing', h: RAIL_H, pts, material: 'metal' })));
    report.gates = pieces.length >= 1 ? FIELD_GATES.length : 0;
    report.railings += pieces.length;
    void ring;
  }
  for (const b of map.barriers) {
    if (b.id === IDS.cross) { b.kind = 'railing'; b.h = RAIL_H; b.material = 'metal'; report.railings++; }
    else if (IDS.lowRailings[b.id]) { b.kind = 'railing'; b.h = IDS.lowRailings[b.id]; b.material = 'metal'; report.railings++; }
  }
  // ---- the fields: rough pasture, holes in the mown park
  if (F) {
    const park = map.areas.find((a) => a.id === IDS.meadow), wood = map.areas.find((a) => a.id === IDS.wood);
    if (park) { park.holes = (park.holes || []).concat([F.north, F.south]); }
    const northHoles = wood && wood.poly.every(([x, z]) => pointInPoly(x, z, F.north)) ? [wood.poly] : [];
    map.areas.push({ id: 'ccm-field-north', kind: 'meadow', name: 'Christ Church Meadow (north field)', poly: F.north, holes: northHoles },
      { id: 'ccm-field-south', kind: 'meadow', name: 'Christ Church Meadow', poly: F.south, holes: [] });
    report.fields = 2;
  }
  // ---- the walks
  for (const r of map.roads) {
    // trees pass (photo comparison items 5 and 19, "broad_walk"): Broad Walk is a wide walk of pale buff gravel, not a
    // 6 m grey path (width a GUESS from the photograph: about 9 m). roads.js honours `wide` (no 6 m path cap) and `tint`.
    if (IDS.broadWalk.includes(r.id)) { r.w = 9; r.surface = 'fine_gravel'; r.wide = true; r.tint = [1.3, 1.24, 1.12]; }
    else if (IDS.newWalk.includes(r.id)) { r.w = 4.5; r.surface = 'fine_gravel'; }
    else if (IDS.riverWalks.includes(r.id)) { r.w = 3; }
    else if (r.id === 'w23799643') { r.surface = 'fine_gravel'; r.tint = [1.2, 1.15, 1.05]; }    // the path north of the avenue: gravel, not bare earth
  }
  // ---- avenue species (positions nudged <= 0.3 m, see nudgeTo) and New Walk's height
  const bwL = polyline(map, IDS.broadWalk), nwL = polyline(map, IDS.newWalk);
  // Broad Walk's avenue (photo comparison item 5): the real planes are far bigger and about twice as far apart as the
  // mapped rows (~9.7 m): every other one is taken out and the rest are 19-24 m
  const drop = new Set();
  for (const t of map.trees) {
    const [x, z] = t;
    if (x < 300 || x > 800 || z < 600 || z > 1040) continue;
    if (nearLines(x, z, bwL, 11) && x > 440) {
      if (Math.round(x / 9.65) % 2) drop.add(t);
      const [nx, nz] = nudgeTo(x, z, 0.56, 0.78); t[0] = nx; t[1] = nz; t[2] = Math.max(t[2] || 0, 19 + mappedHash(nx, nz) * 5); report.trees++;
    }
    else if (nearLines(x, z, nwL, 10) && !(F && (pointInPoly(x, z, F.south) || pointInPoly(x, z, F.north)) && distToPoly(x, z, F.south) > 4)) {
      const [nx, nz] = nudgeTo(x, z, 0, 0.5); t[0] = nx; t[1] = nz; t[2] = 21 + ((mappedHash(nx, nz) * 37) % 1) * 3; t[3] = 'broad'; report.trees++;   // (named: the world makes a mapped tree of 19 m+ a plane)
    }
  }
  if (drop.size) { for (let i = map.trees.length - 1; i >= 0; i--) if (drop.has(map.trees[i])) map.trees.splice(i, 1); report.thinned = drop.size; }
  // ---- c. 2013: no Jubilee Bridge yet
  for (const id of IDS.jubilee) ov.skip.add(id);
  // ---- benches
  for (const b of extraBenches(map)) { map.pois.push(b); report.benches++; }
  // ---- the Meadow Building (1862-66): Venetian Gothic — pointed two-light windows, a paler stone, slate roofs
  for (const id of IDS.meadowBuilding) if (!ov.style.has(id)) ov.style.set(id, { wall: 'college', roof: 'slate', tint: [1.02, 1.0, 0.96], up: ROOFSCAPE ? 'venetianPair' : 'collegeGothic', ground: 'collegeGothic', door: 'stoneArchDoor', ivy: false });
  if (!ov.style.has(IDS.meadowGate)) ov.style.set(IDS.meadowGate, { wall: 'college', roof: 'slate', tint: [1.02, 1.0, 0.96], up: 'collegeGothic', ground: 'stoneArchDoor', door: 'stoneArchDoor', ivy: false });
  // the boathouse at the tip of Boathouse Island (the rest of the island is south of the map): boat bays below, a
  // clubroom above (details guessed)
  if (!ov.style.has(IDS.boathouse)) ov.style.set(IDS.boathouse, { wall: 'brick', roof: 'slate', tint: [1.05, 0.98, 0.92], ground: 'garageDoor', door: 'garageDoor', up: 'brickPair', storeys: 2, ivy: false });
  map._ccmReport = report;
  return report;
}
