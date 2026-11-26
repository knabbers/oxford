// Oxford Botanic Garden — the walled garden's frame and what the module adds to the MAP (preMap): pure functions of the
// map, deterministic, no THREE / DOM (also used by tools/smoke_southeast.mjs). docs/research/christ_church_botanic_magdalen.md §2.
//
// Frame: origin O = the middle of the Danby Gateway (mapped w112185735), u along the High Street wall (east), v into the
// garden (south-west). The walled garden (1621-33; RCHME c. 104 x 116 m) is u -59.5..55, v 0..104.5 — fitted to the
// mapped perimeter path (3-4 m inside the walls), the Ticket Office and the glasshouses outside the east wall.
//  * the walls: ashlar, 4.6 m with a coping, as map barriers (drawn and collided by the world) with gaps at the gates:
//    the Danby Gateway (north, hand-built), two east doors (to the glasshouse range and the river), the south gate (to
//    the lower garden and the lily pond) and a south-east door. Rose Lane's west gate is kept shut (no gap).
//  * the family beds: long rectangular "order beds" in the four quarters (as flowerbed areas, between the mapped paths).
import { localFrame, pointInPoly, dseg } from './_chch_kit.js';
import { hash01 } from '../world/util.js';
import { EASTPASS } from '../world/terrain.js';
/** a barrier id the world draws as ashlar, not brick (barriers.js picks brick for some walls outside the centre by a hash of the id) */
export function stoneId(base) { for (let k = 0; k < 200; k++) { const id = base + (k ? '-' + k : ''); if (hash01(id) >= 0.72) return id; } return base; }

export const O = [877.5, 399.7], DIR = [0.867, 0.498];
export const F = localFrame(O, DIR);
export const WALL = { u0: -59.5, u1: 54.2, v0: 0, v1: 105.5, h: 4.6 };   // E, S and W walls on the mapped lines (w84202171, w1214845456/7)
// gates: [u, v, width, side]
export const GATES = { danby: [0, 0, 9.4, 'n'], east1: [54.2, 13.5, 3.2, 'e'], east2: [54.2, 54, 3.2, 'e'], south: [-2.5, 105.5, 3.4, 's'], southEast: [51, 105.5, 2.6, 's'] };
export const IDS = {
  danby: 'w112185735', ticket: 'w112185736', site: 'r16470745', pond: 'w112185733', mappedWalls: ['w84202171', 'w1214845456', 'w1214845457'],
  glass: { conservatory: 'w228387550', insectivorous: 'w927927814', lily: 'w927927815', fernery: 'w927927816', alpine: 'w927927817', palm: 'w112185732', arid: 'w220257037' },
};
export const HOURS = { open: 9, close: 17, lastEntry: 16.25, warn: 16.75 };
export const FEE = 4.5;              // adult, c. 2013 (guess; £5 a few years later)
export const isOpen = (hour) => hour >= HOURS.open && hour < HOURS.close;

/** the walled garden polygon (world) */
export function wallRing() { const W = WALL; return [[W.u0, W.v0], [W.u1, W.v0], [W.u1, W.v1], [W.u0, W.v1]].map(([u, v]) => F.toW(u, v)); }
export function inWalled(x, z) { const [u, v] = F.toL(x, z); return u > WALL.u0 && u < WALL.u1 && v > WALL.v0 && v < WALL.v1; }
/** wall runs (world polylines) with the gate gaps cut out; doorsV = extra east-wall gaps (v of each glasshouse door) */
export function wallRuns(doorsV = []) {
  const W = WALL, runs = [];
  const side = (a, b, gates) => {        // a, b in (u, v); gates: positions along the side (distance from a), widths
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), du = (b[0] - a[0]) / L, dv = (b[1] - a[1]) / L;
    let s = 0;
    for (const [c, w] of gates.sort((p, q) => p[0] - q[0])) { if (c - w / 2 > s) runs.push([[a[0] + du * s, a[1] + dv * s], [a[0] + du * (c - w / 2), a[1] + dv * (c - w / 2)]]); s = c + w / 2; }
    if (L > s) runs.push([[a[0] + du * s, a[1] + dv * s], [b[0], b[1]]]);
  };
  const g = (sd) => Object.values(GATES).filter((q) => q[3] === sd).concat(sd === 'e' ? doorsV.map((v) => [W.u1, v, 2.4, 'e']) : []);
  side([W.u0, W.v0], [W.u1, W.v0], g('n').map((q) => [q[0] - W.u0, q[2]]));
  side([W.u1, W.v0], [W.u1, W.v1], g('e').map((q) => [q[1] - W.v0, q[2]]));
  side([W.u0, W.v1], [W.u1, W.v1], g('s').map((q) => [q[0] - W.u0, q[2]]));
  side([W.u0, W.v0], [W.u0, W.v1], []);
  return runs.map((r) => r.map(([u, v]) => F.toW(u, v)).map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]));
}
/** the order beds: [{u0,u1,v0,v1}] rectangles in the quarters, clear of the mapped paths */
export function familyBeds(map) {
  const paths = [];
  for (const r of map.roads) if ((r.kind === 'footway' || r.kind === 'path') && r.pts.some(([x, z]) => inWalled(x, z))) paths.push(r.pts.map(([x, z]) => F.toL(x, z)));
  const clear = (u, v, m) => { for (const P of paths) for (let i = 0; i < P.length - 1; i++) if (dseg(u, v, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]) < m) return false; return true; };
  const out = [];
  // the quarters: between the cross paths (u = 0 / 29.5 axes, v = 54 axis) and inside the perimeter path
  for (let v = 18; v < 99; v += 4.2) for (let u = -52; u < 48; u += 9.6) {
    const b = { u0: u, u1: u + 7.6, v0: v, v1: v + 1.5 };
    if (Math.hypot((b.u0 + b.u1) / 2 + 2, (b.v0 + b.v1) / 2 - 53.5) < 9) continue;            // round the pond
    let okk = true; for (const [cu, cv] of [[b.u0, b.v0], [b.u1, b.v0], [b.u1, b.v1], [b.u0, b.v1], [(b.u0 + b.u1) / 2, b.v0]]) if (!clear(cu, cv, 1.6)) { okk = false; break; }
    if (okk) out.push(b);
  }
  return out;
}

/** preMap: walls as barriers, the beds as flowerbeds, the hand-built buildings skipped (idempotent) */
export function preMapGarden(game, doorsV = []) {
  const map = game.map; if (!map || map._botDressed) return null;
  map._botDressed = true;
  const ov = game.overrides, rep = { walls: 0, beds: 0 };
  for (const id of IDS.mappedWalls) ov.skip.add(id);
  // (photo comparison east, 2026-11) Rose Lane: the gate to the Meadow at the lane's foot and the fences along the
  // lane and Dead Man's Walk are iron railings in the photographs, not close-board planks 3 m high
  if (EASTPASS) for (const b of map.barriers) { if (b.id === 'w407662654') { b.kind = 'railing'; b.h = 2.1; } else if (b.id === 'w927927809' || b.id === 'w1214844865') { b.kind = 'railing'; b.h = 1.5; } }
  wallRuns(doorsV).forEach((pts, i) => { map.barriers.push({ id: stoneId('bot-wall-' + i), kind: 'wall', h: WALL.h, pts, material: 'stone' }); rep.walls++; });
  for (const b of familyBeds(map)) { map.areas.push({ id: 'bot-bed-' + rep.beds, kind: 'flowerbed', poly: [[b.u0, b.v0], [b.u1, b.v0], [b.u1, b.v1], [b.u0, b.v1]].map(([u, v]) => F.toW(u, v)) }); rep.beds++; }
  ov.skip.add(IDS.danby);
  for (const id of Object.values(IDS.glass)) ov.skip.add(id);
  map._botReport = rep;
  return rep;
}
export { pointInPoly };
