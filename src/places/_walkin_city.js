// City walk-in interiors: the shared plan / fit / door helpers for every room outside Worcester College that is
// registered `seamless` (core/interiors.js; docs/ARCHITECTURE.md "Walk-in interiors").
//
// A room keeps its own LOCAL coordinates (so its contents, interact points and tests are unchanged); this file works
// out where that room sits in its real building and checks that it fits:
//   const P = planWalkin(game, { id, building, door: { pos, facing }, portal: { at, out, w, h, y }, rects, ... });
//   game.interiors.register({ id, ..., seamless: P.seamless, build(ctx) { ...; cityDoor(ctx, P, {...}); } });
// * the building's outline comes from the map (`building`: a map id, or an outline [[x, z]…] for a hand-built shell);
// * the doorway is snapped onto the outline's edge nearest the old door prompt, facing square out of that edge, so the
//   room is turned the way its wall runs;
// * `rects` (the room's floor plan in its own coordinates: [x0, z0, x1, z1] each, the inside faces of its walls) are
//   checked against the outline: P.fit = { min: the least clearance inside the shell (m), out: [...] };
// * windows: `windows` given by hand, or by rule (`autoWindows`): a window is kept only where the room's wall is close
//   behind an outside face of its own building with open air beyond it (not a party wall).
// Everything is a pure function of the map: every player gets the same rooms. No three.js needed until cityDoor().
// Test: tools/smoke_walkin_city.mjs walks every room in game.walkin.list.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WIN } from '../world/facadedetail.js';

const TAU = Math.PI * 2;
export const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

/** even-odd point in polygon */
export function inPoly(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
  return c;
}
/** distance from (x, z) to the outline; positive inside, negative outside */
export function insideDist(poly, x, z) {
  let d = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1e-9;
    let t = ((x - a[0]) * ex + (z - a[1]) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const q = Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t); if (q < d) d = q;
  }
  return inPoly(poly, x, z) ? d : -d;
}
/** ray (px, pz) + t (dx, dz), t > 0: the nearest crossing of the outline -> { t, i (edge poly[i-1]→poly[i]), nx, nz (the edge's normal, pointing against the ray) } or null */
export function rayPoly(poly, px, pz, dx, dz, tMax = 1e9) {
  let best = null;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - px) * ez - (a[1] - pz) * ex) / den, u = ((a[0] - px) * dz - (a[1] - pz) * dx) / den;
    if (t <= 1e-6 || t > tMax || u < 0 || u > 1) continue;
    if (!best || t < best.t) { const L = Math.hypot(ex, ez) || 1; let nx = ez / L, nz = -ex / L; if (nx * dx + nz * dz > 0) { nx = -nx; nz = -nz; } best = { t, i, nx, nz, a, b }; }
  }
  return best;
}
export function outlineOf(game, building) {
  if (Array.isArray(building)) return { poly: building, b: null };
  const b = game.map && game.map.buildings && game.map.buildings.find((q) => q.id === building);
  return { poly: b ? b.poly : null, b };
}

/**
 * The painted ground-floor bays of a mapped building's walls (world/buildings.js, through world.facadeOf): where the
 * generic facade draws its windows, shopfront glass and doors -> [{ x, z (centre, on the shell face), nx, nz, w, y0, y1,
 * door, recess (m: a shop door at the back of a recessed lobby), covered }] or null when the building has no generic
 * facade (hand-built shells). A room's openings are put ON these, so what is punched is the painted glass itself.
 */
export function facadeBays(game, id) {
  const F = id && game.world && game.world.facadeOf ? game.world.facadeOf(id) : null;
  if (!F || !F.edges || (game.overrides && game.overrides.skip && game.overrides.skip.has(id))) return null;
  const out = [], H = F.sH || 3.2, y = F.minH || 0;
  for (const E of F.edges) {
    const P = E.plan; if (!P || P.kind === 'blank' || !(E.len > 1)) continue;
    // (bays are counted from the wall's LEFT end seen from outside: E.lx / lz along E.rx / rz, as buildings.js draws them)
    const nb = Math.max(1, Math.round(P.bays)), bw = E.len / nb, ux = E.rx ?? (E.bx - E.ax) / E.len, uz = E.rz ?? (E.bz - E.az) / E.len, ox = E.lx ?? E.ax, oz = E.lz ?? E.az;
    for (let bi = 0; bi < nb; bi++) {
      const cell = P.ground ? P.ground[bi] : F.W && F.W.gr, sp = WIN[cell]; if (!sp) continue;
      for (const [f0, f1] of sp.back && sp.door ? [sp.back] : sp.x) {
        const sm = (bi + (f0 + f1) / 2) * bw;
        out.push({ x: ox + ux * sm, z: oz + uz * sm, nx: E.nx, nz: E.nz, w: (f1 - f0) * bw, y0: y + (sp.door ? 0 : H * (1 - sp.b)), y1: y + H * (1 - sp.t), door: !!sp.door, recess: sp.door && sp.d >= 0.5 ? sp.d : 0, covered: !!E.covered, explicit: !!P.ground, kind: P.kind,
          // (the wall it is on, for whoever needs the whole shop unit: its left end, direction, length, units, and how far along this bay is)
          ox, oz, ux, uz, len: E.len, units: P.units || 0, sm });
      }
    }
  }
  return out;
}

/**
 * Where a room sits in its building.
 *   o.id
 *   o.building   map building id, or the shell's outline [[x, z]…] (world)
 *   o.door       { pos: [x, z], facing }   the old door prompt: a point at / just outside the entrance, heading out
 *   o.portal     { at: [x, z], out, w, h, y }   the doorway in ROOM coordinates: centre on the room's wall face, outward heading
 *   o.rects      [[x0, z0, x1, z1]…]  the room's floor plan in room coordinates (inside wall faces)
 *   o.wall       thickness from the room's wall face out to the shell face at the doorway (default 0.3)
 *   o.snap       false: keep door.facing as given (default: square to the outline's edge at the door)
 *   o.slide      move the doorway along its edge by this many metres (+ = to the right seen from outside), to make a room fit
 *   o.windows    [{ at: [x, z], out, w, y0, y1, depth? }]   in room coordinates; depth worked out from the outline when absent
 *   o.auto       { walls: [{ a: [x, z], b: [x, z] }…] | 'rects', every, w, y0, y1, maxDepth, inset }   windows by rule (see autoWindows)
 *   o.more       [{ at, out, w, h, y, door: { pos, facing } }]   further doorways (their world point is derived from the first)
 *   o.under      true for a room below ground: it needs no fit (the ground hides it)
 *   o.mid / o.route / o.tour   for the test: the middle of the room; waypoints from the door to it; a walk from there and back
 *                [[x, z, y?]…] (other floors: y = the floor height expected there)
 * -> { seamless, fit: { min, out, ok }, toWorld, toLocal, rot, poly, shell: [x, z] (the doorway on the shell face), pavement: [x, z, facing] }
 */
export function planWalkin(game, o) {
  const { poly, b } = outlineOf(game, o.building);
  const pt = o.portal;
  let f = o.door.facing, sx = o.door.pos[0], sz = o.door.pos[1];
  if (poly) {
    // the shell face at the door: look inwards from a little outside the prompt point; else outwards from it
    let fx = Math.sin(f), fz = Math.cos(f), hit = rayPoly(poly, sx + fx * 2.5, sz + fz * 2.5, -fx, -fz, 9);
    if (!hit) { hit = rayPoly(poly, sx, sz, fx, fz, 6); if (hit) hit = { ...hit, t: 2.5 - hit.t }; }
    if (hit) {
      sx = sx + fx * (2.5 - hit.t); sz = sz + fz * (2.5 - hit.t);
      if (o.snap !== false) { const nf = Math.atan2(hit.nx, hit.nz); if (Math.abs(wrapPi(nf - f)) < 0.6) f = nf; }
    }
  }
  const fx = Math.sin(f), fz = Math.cos(f), tx = Math.cos(f), tz = -Math.sin(f);      // out; tangent (to the right seen from inside)
  if (o.slide) { sx -= tx * o.slide; sz -= tz * o.slide; }
  // the painted bays of the generic facade: the doorway may be moved along its wall onto the painted door (snapBay: the
  // furthest it may move, m) — the room stays where it is, the door moves in it; a shop door at the back of a recessed
  // lobby is punched on the lobby's back wall, the room's wall behind that
  const bays = b ? facadeBays(game, b.id) : null;
  let proud, wall = o.wall ?? 0.3, pAt = pt.at, pW = pt.w || 1.1, pH = pt.h || 2.1, doorBay = null;
  if (bays && pt.snapBay) {
    let best = null;
    for (const q of bays) { if (!q.door || q.covered || q.nx * fx + q.nz * fz < 0.95) continue; const dx = q.x - sx, dz = q.z - sz, lat = dx * tx + dz * tz, off = Math.abs(dx * fx + dz * fz); if (off < 0.6 && Math.abs(lat) <= pt.snapBay && (!best || Math.abs(lat) < Math.abs(best.lat))) best = { q, lat }; }
    if (best) {
      doorBay = best.q; sx += tx * best.lat; sz += tz * best.lat;
      pAt = [pt.at[0] + Math.cos(pt.out) * best.lat, pt.at[1] - Math.sin(pt.out) * best.lat];
      if (best.q.recess) { wall = Math.max(wall, best.q.recess + 0.22); proud = 0.03 - best.q.recess; }
      pW = Math.min(pW, Math.max(0.85, best.q.w - 0.06)); pH = Math.min(pH, best.q.y1 - 0.04);
    }
  }
  const wx = sx - fx * wall, wz = sz - fz * wall;                                       // the doorway on the room's wall face, in the world
  const rot = f - pt.out, c = Math.cos(rot), s = Math.sin(rot);
  const toWorld = (x, z) => { const dx = x - pAt[0], dz = z - pAt[1]; return [wx + dx * c + dz * s, wz - dx * s + dz * c]; };
  const toLocal = (x, z) => { const dx = x - wx, dz = z - wz; return [pAt[0] + dx * c - dz * s, pAt[1] + dx * s + dz * c]; };
  const portals = [{ at: pAt, out: pt.out, w: pW, h: pH, y: pt.y || 0, depth: wall, world: [wx, wz, f], ...(proud !== undefined ? { proud } : {}), ...(pt.from ? { from: pt.from } : {}) }];
  for (const m of o.more || []) portals.push({ at: m.at, out: m.out, w: m.w || 1.1, h: m.h || 2.1, y: m.y || 0, depth: m.depth ?? wall, ...(m.from ? { from: m.from } : {}) });
  // ---- fit
  const fit = { min: 1e9, out: [], ok: true };
  if (poly && !o.under) for (const r of o.rects || []) {
    const [x0, z0, x1, z1] = r, n = 2 * Math.max(2, Math.ceil(Math.max(x1 - x0, z1 - z0) / 0.5));
    for (let i = 0; i < n * 4; i++) {
      const k = (i % n) / n, e = Math.floor(i / n);
      const x = e === 0 ? x0 + (x1 - x0) * k : e === 1 ? x1 : e === 2 ? x1 - (x1 - x0) * k : x0, z = e === 0 ? z0 : e === 1 ? z0 + (z1 - z0) * k : e === 2 ? z1 : z1 - (z1 - z0) * k;
      const w = toWorld(x, z), d = insideDist(poly, w[0], w[1]);
      if (d < fit.min) fit.min = d;
      if (d < 0.15) fit.out.push([+x.toFixed(2), +z.toFixed(2), +d.toFixed(2)]);
    }
  }
  if (fit.min === 1e9) fit.min = null;
  fit.ok = !fit.out.length;
  // ---- windows
  const openings = [];
  const addWin = (w) => {
    let depth = w.depth;
    if (depth === undefined) {
      if (!poly) depth = wall; else {
        const p = toWorld(w.at[0], w.at[1]), h = w.out + rot, hit = rayPoly(poly, p[0], p[1], Math.sin(h), Math.cos(h), w.maxDepth ?? 1.6);
        if (!hit) return false; depth = hit.t;
      }
    }
    openings.push({ ...w, depth }); return true;
  };
  for (const w of o.windows || []) addWin(w);
  if (o.auto) for (const w of autoWindows(game, { poly, toWorld, toLocal, rot, rects: o.rects, portals, own: b && b.id, bays: o.auto.facade === false ? null : bays, ...o.auto })) openings.push(w);
  const cx = o.center || (o.rects && o.rects.length ? [(o.rects[0][0] + o.rects[0][2]) / 2, (o.rects[0][1] + o.rects[0][3]) / 2] : pt.at);
  const P = {
    id: o.id, poly, building: b, rot, toWorld, toLocal, fit, shell: [sx, sz], facing: f, doorBay, bays,
    pavement: [sx + fx * 1.6, sz + fz * 1.6, f],
    seamless: { portals, openings, center: cx, lift: o.lift ?? 0.04 },
    mid: o.mid || cx, rects: o.rects || [], under: !!o.under, hours: o.hours || null, route: o.route || null, tour: o.tour || null, spec: o,
  };
  const W = (game.walkin = game.walkin || { list: [], byId: new Map() });
  if (!W.byId.has(o.id)) W.list.push(P); else W.list[W.list.indexOf(W.byId.get(o.id))] = P;
  W.byId.set(o.id, P);
  return P;
}

/**
 * Windows by rule: along each given wall run (room coordinates, a → b with the room on the LEFT of a → b… the outward
 * side is worked out from the outline), one window every `every` metres, kept only where
 *   - the shell face is within maxDepth beyond the wall (so the room's wall really is behind an outside wall), and
 *   - there is open air for 2.5 m beyond the shell (no other mapped building: not a party wall), and
 *   - it is clear of the doorways.
 */
export function autoWindows(game, { poly, toWorld, toLocal, rot, rects, portals, walls = 'rects', every = 3.2, w = 1.5, y0 = 0.9, y1 = 2.2, maxDepth = 1.2, inset = 0.9, own = null, max = 12, air = 2.5, bays = null, maxY = 1e9, minY = 0 }) {
  const out = []; if (!poly) return out;
  const B = (game.map && game.map.buildings) || [];
  const runs = [];
  if (walls === 'rects') for (const [x0, z0, x1, z1] of rects || []) runs.push({ a: [x0, z0], b: [x1, z0], out: Math.PI }, { a: [x1, z0], b: [x1, z1], out: Math.PI / 2 }, { a: [x1, z1], b: [x0, z1], out: 0 }, { a: [x0, z1], b: [x0, z0], out: -Math.PI / 2 });
  else for (const r of walls) runs.push(r);
  const nearB = (x, z) => { for (const q of B) { if (!q.poly || q.id === own || (q.c && Math.abs(q.c[0] - x) + Math.abs(q.c[1] - z) > 260)) continue; if (inPoly(q.poly, x, z)) return true; } return false; };
  if (bays && toLocal) {
    // on the painted windows: every painted ground-floor window (or shopfront glass) that has one of the room's walls
    // close behind it becomes an opening of exactly its size and place
    for (const q of bays) {
      if (q.door || q.covered || out.length >= max) continue;
      const l = toLocal(q.x, q.z), lo = wrapPi(Math.atan2(q.nx, q.nz) - rot);
      for (const r of runs) {
        if (Math.abs(wrapPi(r.out - lo)) > 0.12) continue;
        const L = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), ux = (r.b[0] - r.a[0]) / L, uz = (r.b[1] - r.a[1]) / L, ox = Math.sin(r.out), oz = Math.cos(r.out);
        let al = (l[0] - r.a[0]) * ux + (l[1] - r.a[1]) * uz, ww = q.w - 0.04; const depth = (l[0] - r.a[0]) * ox + (l[1] - r.a[1]) * oz;
        if (depth < 0.05 || depth > maxDepth) continue;
        // (a painted window wider than the wall behind it is opened as far as the wall goes, if that is most of it)
        { const s0 = Math.max(al - ww / 2, 0.22), s1 = Math.min(al + ww / 2, L - 0.22); if (s1 - s0 < ww * 0.6 || s1 - s0 < 0.5) continue; al = (s0 + s1) / 2; ww = s1 - s0; }
        const at = [r.a[0] + ux * al, r.a[1] + uz * al];
        if (portals.some((p) => Math.abs(wrapPi(p.out - r.out)) < 0.3 && Math.hypot(p.at[0] - at[0], p.at[1] - at[1]) < (p.w + ww) / 2 + 0.2)) continue;
        if (nearB(q.x + q.nx * 0.4, q.z + q.nz * 0.4) || nearB(q.x + q.nx * air, q.z + q.nz * air)) continue;
        const ya = Math.max(q.y0, minY), yb = Math.min(q.y1, maxY); if (yb - ya < 0.5) continue;
        out.push({ at, out: r.out, w: ww, y0: +ya.toFixed(3), y1: +yb.toFixed(3), depth: +depth.toFixed(3), auto: true, painted: true, shop: q.kind === 'shop' }); break;
      }
    }
    return out;
  }
  const near = (x, z) => { for (const q of B) { if (!q.poly || q.id === own || (q.c && Math.abs(q.c[0] - x) + Math.abs(q.c[1] - z) > 260)) continue; if (inPoly(q.poly, x, z)) return true; } return false; };
  for (const r of runs) {
    const L = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), n = Math.floor((L - 2 * inset + (every - w)) / every);
    if (n < 1) continue;
    const ux = (r.b[0] - r.a[0]) / L, uz = (r.b[1] - r.a[1]) / L, pad = (L - (n * every - (every - w))) / 2;
    for (let i = 0; i < n && out.length < max; i++) {
      const s = pad + w / 2 + i * every, at = [r.a[0] + ux * s, r.a[1] + uz * s];
      if (portals.some((p) => Math.abs(wrapPi(p.out - r.out)) < 0.3 && Math.hypot(p.at[0] - at[0], p.at[1] - at[1]) < (p.w + w) / 2 + 0.45)) continue;
      let ok = true, depth = 0;
      for (const k of [-w / 2, 0, w / 2]) {
        const p = toWorld(at[0] + ux * k, at[1] + uz * k), h = r.out + rot, dx = Math.sin(h), dz = Math.cos(h), hit = rayPoly(poly, p[0], p[1], dx, dz, maxDepth);
        if (!hit || !inPoly(poly, p[0], p[1])) { ok = false; break; }
        depth = Math.max(depth, hit.t);
        if (near(p[0] + dx * (hit.t + 0.4), p[1] + dz * (hit.t + 0.4)) || near(p[0] + dx * (hit.t + air), p[1] + dz * (hit.t + air))) { ok = false; break; }
      }
      if (ok) out.push({ at, out: r.out, w, y0: r.y0 ?? y0, y1: r.y1 ?? y1, depth: +depth.toFixed(3), auto: true });
    }
  }
  return out;
}

/**
 * The street's walkers use this room's street door (systems/pedestrians.js addDoorway): now and then one turns off the
 * pavement, goes in through the real door, stands a while at the end of the plan's own walk (route, mid — or o.inside,
 * room coordinates) and comes out again. Open by the plan's hours. o: portal, inside, cap, every, dwell (see addDoorway).
 */
export function streetDoor(game, P, o = {}) {
  if (!P || !P.seamless) return null;
  const flat = (q) => q && (q[2] === undefined || Math.abs(q[2] - (P.seamless.portals[o.portal | 0].y || 0)) < 0.3);
  const inside = o.inside || [...(P.route || []), P.mid].filter(flat).map((q) => [q[0], q[1]]);
  const spec = { placeId: P.id, hours: P.hours && P.hours.open, ...o, inside };
  if (game.pedestrians && game.pedestrians.addDoorway) return game.pedestrians.addDoorway(spec);
  (game.streetDoors || (game.streetDoors = [])).push(spec);
  return spec;
}

// ------------------------------------------------------------------------------------------------ doors
let _mats = null, _sign = null;
/** the shared door materials of the city's rooms (one set: every door of every room is the same few programs) */
export function cityDoorMats() {
  if (_mats) return _mats;
  _mats = {
    oak: new THREE.MeshLambertMaterial({ color: 0x4a3220, name: 'wc:door-oak' }),
    paint: new THREE.MeshLambertMaterial({ color: 0x23302a, name: 'wc:door-paint' }),
    handle: new THREE.MeshLambertMaterial({ color: 0xb09a5a, name: 'wc:door-brass' }),
    frame: new THREE.MeshLambertMaterial({ color: 0x8a8d90, name: 'wc:door-frame' }),
    glass: new THREE.MeshLambertMaterial({ color: 0xbfd4dc, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, name: 'wc:door-glass' }),
    // (transparent: true keeps the card out of core's door-leaf proxies, which are drawn whether or not the card is showing)
    sign: new THREE.MeshLambertMaterial({ color: 0xf2efe6, emissive: 0x2a2a28, name: 'wc:door-sign', side: THREE.DoubleSide, transparent: true }),
    signInk: new THREE.MeshLambertMaterial({ color: 0x8a1410, name: 'wc:door-sign-ink', side: THREE.DoubleSide, transparent: true }),
  };
  return _mats;
}
// "CLOSED" in plain block strokes (no texture: nothing to upload at the threshold). 5 x 7 cells per letter.
const GLYPH = { C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'] };
function closedSign() {
  if (_sign) return _sign;
  const M = cityDoorMats(), W = 0.3, H = 0.11, cell = 0.0072, P = [], N = [];
  const word = 'CLOSED', tw = word.length * 6 * cell - cell;
  for (const sgn of [1, -1]) for (let k = 0; k < word.length; k++) { const g = GLYPH[word[k]]; for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) { if (g[r][q] !== '1') continue;
    const z0 = sgn * (tw / 2 - (k * 6 + q) * cell), z1 = z0 - sgn * cell, y1 = 3.5 * cell - r * cell, y0 = y1 - cell, x = sgn * 0.004;      // (read left to right from the side it faces)
    const a = [x, y0, z0], b = [x, y0, z1], c = [x, y1, z1], d = [x, y1, z0];
    for (const v of sgn > 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d]) { P.push(...v); N.push(sgn, 0, 0); } } }
  const ink = new THREE.BufferGeometry(); ink.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ink.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  _sign = { card: new THREE.BoxGeometry(0.006, H, W), ink, M };
  return _sign;
}

/**
 * The street door of a city room: ctx.addDoor (core/_doors.js) on portal `portal` of plan P, plus opening hours.
 *   kind 'hinged' (default) | 'slide';  style 'oak' | 'paint' (a panelled painted shop / pub door) | 'glass'
 *   open: () => boolean   false = locked: the door stays shut and carries a plain "Closed" card (people already inside
 *                         can still leave: a door that is open finishes its swing, and it opens from inside)
 *   hinge: +1 | -1   which jamb the hinge is on (default +1: the left jamb seen from outside);  swing: default inwards
 * Returns the door (D.locked, D.sign).
 */
export function cityDoor(ctx, P, o = {}) {
  if (!ctx.addDoor || !ctx.seamless) return null;
  const pi = o.portal || 0, pt = ctx.seamless.portals[pi], M = cityDoorMats();
  const w = pt.w, tx = Math.cos(pt.out), tz = -Math.sin(pt.out), dx = Math.sin(pt.out), dz = Math.cos(pt.out);
  const style = o.style || 'paint', mats = { leaf: o.leaf || (style === 'oak' ? M.oak : M.paint), handle: M.handle, glass: M.glass, frame: M.frame, plate: M.handle };
  const back = o.setBack ?? Math.min(0.12, pt.depth * 0.5);        // the leaf sits in the wall, a little out from the room's face
  const cx = pt.at[0] + dx * back, cz = pt.at[1] + dz * back;
  let D;
  if (o.kind === 'slide') {
    D = ctx.addDoor({ kind: 'slide', style: 'glass', at: [cx, cz], y: pt.y, w, h: pt.h, dir: pt.out - Math.PI / 2, mats, portal: pi, rangeOut: o.rangeOut ?? 3.2, rangeIn: o.rangeIn ?? 2.4, hold: o.hold ?? 1.2 });
  } else {
    const hs = o.hinge || 1;                                        // hinge at the +tangent (hs = 1) or -tangent jamb
    const hx = cx + tx * hs * w / 2, hz = cz + tz * hs * w / 2, dir = Math.atan2(-tx * hs, -tz * hs);
    // the normal of the closed leaf is n = (cos dir, -sin dir); swing +1 opens to n's side. Inwards = against `out`.
    const nIn = -(Math.cos(dir) * dx - Math.sin(dir) * dz);
    const swing = o.swing === 0 ? 0 : (o.swing === 'out' ? -1 : 1) * (nIn >= 0 ? 1 : -1);
    D = ctx.addDoor({ kind: 'hinged', style: style === 'paint' ? 'oak' : style, at: [hx, hz], y: pt.y, w, h: pt.h, dir, swing, closer: o.closer ?? true, heavy: !!o.heavy, vision: o.vision, mats, portal: pi, thick: o.thick, rest: o.rest });
  }
  if (o.open) {
    const S = closedSign(), g = new THREE.Group(); g.name = 'wc:closed';
    const card = new THREE.Mesh(S.card, M.sign), ink = new THREE.Mesh(S.ink, M.signInk); card.castShadow = ink.castShadow = false; g.add(card, ink);
    if (D.kind === 'hinged') { g.position.set(0, 1.5, w / 2); D.group.add(g); } else { g.position.set(0, 1.5, w / 4); D.leaves[1].add(g); }
    D.sign = g; D.locked = false; D.isOpenNow = o.open;
    const upd = D.update;
    D.update = (dt, people, env) => {
      let lk = false; try { lk = !o.open(); } catch { lk = false; }
      D.locked = lk; if (g.visible !== lk) g.visible = lk;
      if (lk) {
        const shut = D.kind === 'hinged' ? Math.abs(D.th) < 0.02 && D.target === 0 : D.slide < 0.01 && !(D.clearT > 0);
        // locked and shut: only someone INSIDE the room at the door (leaving at closing time) moves it
        if (shut) { let inside = false; for (const p of people) { const rx = p.x - cx, rz = p.z - cz, off = rx * dx + rz * dz; if (off < -0.05 && off > -1.6 && Math.abs(rx * tx + rz * tz) < w / 2 + 0.3) { inside = true; break; } } if (!inside) { D.want = 0; return; } }
      }
      upd(dt, people, env);
    };
  }
  return D;
}

/** a plain glazed pane for a window opening (the world shows through it): room coordinates, on the wall face */
export function glazing(ops, { y = 0, inset = 0.5, bars = 0, frame = 0.05, mats = null } = {}) {
  const M = mats || cityDoorMats(), g = new THREE.Group(); g.name = 'wc:glazing';
  const P = [], N = [], FP = [], FN = [], RP = [], RN = [];
  const quad = (arr, nar, a, b, c, d, n) => { for (const v of [a, b, c, a, c, d]) { arr.push(...v); nar.push(...n); } };
  for (const o of ops) {
    const dx = Math.sin(o.out), dz = Math.cos(o.out), tx = Math.cos(o.out), tz = -Math.sin(o.out), k = (o.depth ?? 0.3) * inset;
    const cx = o.at[0] + dx * k, cz = o.at[1] + dz * k, y0 = (o.y0 ?? 0) + y, y1 = (o.y1 ?? 2) + y, hw = o.w / 2;
    const pt = (s, yy, e = 0) => [cx + tx * s + dx * e, yy, cz + tz * s + dz * e];
    quad(P, N, pt(-hw, y0), pt(hw, y0), pt(hw, y1), pt(-hw, y1), [dx, 0, dz]);
    // the reveal: the opening lined from the room's wall face out to the shell face
    // (measured from the wall face, not from the pane — `pt` is at the pane, k out: it used to stand k proud of the shell)
    { const D = (o.depth ?? 0.3) + 0.02, rp = (s, yy, e = 0) => pt(s, yy, e - k), rq = (a, b, c, d, n) => quad(RP, RN, a, b, c, d, n);
      rq(rp(-hw, y0), rp(-hw, y0, D), rp(-hw, y1, D), rp(-hw, y1), [tx, 0, tz]); rq(rp(hw, y0, D), rp(hw, y0), rp(hw, y1), rp(hw, y1, D), [-tx, 0, -tz]);
      rq(rp(-hw, y0), rp(hw, y0), rp(hw, y0, D), rp(-hw, y0, D), [0, 1, 0]); rq(rp(-hw, y1, D), rp(hw, y1, D), rp(hw, y1), rp(-hw, y1), [0, -1, 0]); }
    // frame: four bars + glazing bars, as flat strips both ways round (double-sided material)
    const bar = (s0, s1, ya, yb) => quad(FP, FN, pt(s0, ya, 0.004), pt(s1, ya, 0.004), pt(s1, yb, 0.004), pt(s0, yb, 0.004), [dx, 0, dz]);
    const f = o.frame ?? frame;
    bar(-hw, hw, y0, y0 + f); bar(-hw, hw, y1 - f, y1); bar(-hw, -hw + f, y0, y1); bar(hw - f, hw, y0, y1);
    const nb = o.bars ?? bars; for (let i = 1; i <= nb; i++) { const s = -hw + (o.w * i) / (nb + 1); bar(s - f * 0.4, s + f * 0.4, y0, y1); }
    if (o.transom) bar(-hw, hw, y0 + o.transom - f * 0.4, y0 + o.transom + f * 0.4);
  }
  const mk = (arr, nar, mat, name) => { if (!arr.length) return; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nar, 3)); const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; g.add(m); };
  mk(FP, FN, (mats && mats.frame) || M.winFrame || (M.winFrame = new THREE.MeshLambertMaterial({ color: 0xe8e4da, side: THREE.DoubleSide, name: 'wc:win-frame' })), 'wc:win-frame');
  mk(RP, RN, (mats && mats.reveal) || M.reveal || (M.reveal = new THREE.MeshLambertMaterial({ color: 0xd8d2c4, side: THREE.DoubleSide, name: 'wc:reveal' })), 'wc:reveal');
  mk(P, N, M.glass, 'wc:win-glass');
  return g;
}

/** the lining of deep doorways (a recessed lobby): jambs, head and (floor: true) a threshold slab from the room's wall face out to the shell */
export function reveal(ops, { floor = false, mat = null } = {}) {
  const M = cityDoorMats(), P = [], N = [];
  const quad = (a, b, c, d, n) => { for (const v of [a, b, c, a, c, d]) { P.push(...v); N.push(...n); } };
  for (const o of ops) {
    const dx = Math.sin(o.out), dz = Math.cos(o.out), tx = Math.cos(o.out), tz = -Math.sin(o.out), D = (o.depth ?? 0.3) + 0.02, hw = o.w / 2, y0 = o.y ?? o.y0 ?? 0, y1 = o.h !== undefined ? y0 + o.h : o.y1;
    const pt = (s, yy, e = 0) => [o.at[0] + tx * s + dx * e, yy, o.at[1] + tz * s + dz * e];
    quad(pt(-hw, y0), pt(-hw, y0, D), pt(-hw, y1, D), pt(-hw, y1), [tx, 0, tz]); quad(pt(hw, y0, D), pt(hw, y0), pt(hw, y1), pt(hw, y1, D), [-tx, 0, -tz]);
    quad(pt(-hw, y1, D), pt(hw, y1, D), pt(hw, y1), pt(-hw, y1), [0, -1, 0]);
    if (floor) quad(pt(-hw, y0 + 0.004), pt(hw, y0 + 0.004), pt(hw, y0 + 0.004, D), pt(-hw, y0 + 0.004, D), [0, 1, 0]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  const m = new THREE.Mesh(geo, mat || M.reveal || (M.reveal = new THREE.MeshLambertMaterial({ color: 0xd8d2c4, side: THREE.DoubleSide, name: 'wc:reveal' }))); m.name = 'wc:reveal'; m.castShadow = false; m.matrixAutoUpdate = false;
  return m;
}

/** the doorway(s) and windows of plan P as world/interiorkit.js room() gaps, for a rectangular kit room centred at (x, z) */
export function kitGaps(P, { x = 0, z = 0 } = {}) {
  const out = [], side = (h) => { const a = wrapPi(h); return Math.abs(a) < 0.1 ? 's' : Math.abs(Math.abs(a) - Math.PI) < 0.1 ? 'n' : a > 0 ? 'e' : 'w'; };
  for (const p of P.seamless.portals) { const k = side(p.out); out.push({ wall: k, at: k === 's' || k === 'n' ? p.at[0] - x : p.at[1] - z, width: p.w, height: p.h, solid: true }); }
  for (const o of P.seamless.openings) { const k = side(o.out); out.push({ wall: k, at: k === 's' || k === 'n' ? o.at[0] - x : o.at[1] - z, width: o.w, height: o.y1, sill: o.y0 }); }
  return out;
}

/**
 * A room seen from the street is drawn every frame an opening is in view: merge its static meshes to one per material
 * (position / normal / uv only). Doors, skinned / instanced meshes, anything under an object in `skip`, anything whose
 * userData.live is set, and invisible meshes are left alone. Returns the number of meshes it made.
 */
let _flat = null;
const flatMat = () => _flat || (_flat = new THREE.MeshLambertMaterial({ vertexColors: true, name: 'wc:flat' }));
export function mergeRoom(scene, skip = null) {
  scene.updateMatrixWorld(true);
  const groups = new Map(), victims = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible || o.userData.live || Array.isArray(o.material)) return;
    for (let p = o; p; p = p.parent) { if (p.name === 'door' || p.userData.live || (skip && skip.has(p)) || p.visible === false) return; }
    const g = o.geometry; if (!g || !g.attributes.position || !g.attributes.normal || !g.attributes.uv || g.morphAttributes.position) return;
    // plain-coloured things (no texture, opaque, not glowing) of every such material go into ONE vertex-coloured mesh
    const M0 = o.material, flat = (M0.isMeshStandardMaterial || M0.isMeshLambertMaterial || M0.isMeshPhongMaterial) && !M0.map && !M0.transparent && !M0.emissiveMap && !M0.alphaTest && !M0.vertexColors && M0.side === THREE.FrontSide && (!M0.emissive || M0.emissive.getHex() === 0) && !(M0.metalness > 0.6) && !o.renderOrder;
    const col = flat || !!g.attributes.color, key = flat ? 'flat' : M0.uuid + (col ? ':c' : '') + ':' + o.renderOrder;
    o.userData._wcKey = key;
    let e = groups.get(key); if (!e) groups.set(key, (e = { mat: flat ? flatMat() : M0, geos: [], col, order: o.renderOrder, rs: o.receiveShadow, name: flat ? 'flat' : o.name }));
    const c = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k) && !(col && k === 'color')) c.deleteAttribute(k);
    if (flat) { const nV = c.attributes.position.count, A = new Float32Array(nV * 3), q = M0.color; for (let i = 0; i < nV; i++) { A[i * 3] = q.r; A[i * 3 + 1] = q.g; A[i * 3 + 2] = q.b; } c.setAttribute('color', new THREE.BufferAttribute(A, 3)); }
    c.applyMatrix4(o.matrixWorld); if (o.matrixWorld.determinant() < 0) { const ix = c.attributes.position.count; const idx = []; for (let i = 0; i < ix; i += 3) idx.push(i, i + 2, i + 1); c.setIndex(idx); const f = c.toNonIndexed(); c.dispose(); e.geos.push(f); } else e.geos.push(c);
    victims.push(o);
  });
  let n = 0;
  for (const e of groups.values()) {
    if (e.geos.length < 2) { for (const q of e.geos) q.dispose(); continue; }
    let g = null; try { g = mergeGeometries(e.geos, false); } catch { g = null; }
    if (!g) { for (const q of e.geos) q.dispose(); e.failed = true; continue; }
    for (const q of e.geos) q.dispose();
    const m = new THREE.Mesh(g, e.mat); m.name = 'wc:merged ' + (e.mat.name || e.name || ''); m.renderOrder = e.order; m.receiveShadow = e.rs; m.castShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); e.done = true; n++;
  }
  for (const o of victims) { const e = groups.get(o.userData._wcKey); if (e && e.done && o.parent) o.parent.remove(o); }
  return n;
}

/**
 * Build policy for a registered city room (ONE place decides it for all of them): rooms are built by core/interiors.js
 * when the player comes within its build distance; a room listed here as `heavy` is instead built on the loading
 * screen (game.warmups, world/prewarm.js), so that walking up to it never builds it inside a frame.
 */
export function warmLater(game, id, { heavy = false } = {}) {
  const W = (game.walkin = game.walkin || { list: [], byId: new Map() });
  (W.warm = W.warm || []).push({ id, heavy });
  if (heavy) (game.warmups || (game.warmups = [])).push({ id: 'walkin:' + id, fn: () => { game.interiors.warm(id); } });
}

/** is the hour inside [open, close) (close may wrap past midnight) */
export const hoursOpen = (h, open, close) => (open <= close ? h >= open && h < close : h >= open || h < close);

// ------------------------------------------------------------------------------------------------ the outside of an opening
// The shell of a building is never cut: core/interiors.js punches a RECTANGLE at each doorway / window and the room
// shows there. What makes that rectangle a window of the building — its frame, glazing bars, stone mullions, sill,
// arched head, door-case — is drawn here IN THE WORLD SCENE (so the sun, the hour and the weather light it exactly as
// they light the wall), a few centimetres in front of the punched rectangle, in the room's own coordinates (the mesh
// takes the room's matrix). Behind the rectangle goes a plain dark pane (or the colour of the door leaf): what is seen
// from further off than rooms are shown, so a window never vanishes. The painted window / door of the shell at that
// place must be removed (generic facades: world/walkin_bays.js 'blank'; hand-built shells: in the shell's own module).
//   dressOpenings(game, id, [{ p: 0 | o: 2 | o: [0, 1, 2]  (the registered portal / opening(s)),  or at, out, w, y0, y1, depth,
//       head: 'flat' | 'round' | 'pointed' | 'segment', rise (m: the arch's height; round = w / 2, pointed = 0.75 w, segment = 0.18 w),
//       wall: 0xb8ad94            the colour of the stone / brick that fills the corners above an arched head,
//       frame: { w, color }       a timber frame just inside the edge of the opening (follows an arched head),
//       surround: { w, color, proud }   an architrave / door-case band round the outside of the opening (follows the head),
//       bars: [cols, rows] + barColor, barW   thin glazing bars: cols × rows panes (rows below the springing),
//       mullions: n + transoms: [0..1 …] + stone: color, mullW   stone mullions (n uprights) and transoms (fractions of the height below the springing),
//       lights: true              with mullions under a pointed / round head: each light gets its own small arched head (tracery bars),
//       sill: { h, proj, over, color },  lintel: { h, over, color, proud },  step: { h, proj, over, color } (a door's stone step),
//       keystone: color,  fill: 0x1b2229 (the far pane; false = none) }], { name })
// Offsets (m in front of the shell face): pane 0.012, the punch 0.03 (core), corners of an arch 0.045, bars and frames
// 0.035 → 0.075, surround / sill / lintel to `proud` (default 0.07; a sill to its `proj`). Nothing stands further out
// than a real architrave does. Returns the mesh (already in the world scene).
let _dressMat = null, _paneMat = null;
const dressMat = () => _dressMat || (_dressMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, name: 'wc:dress' }));
const _col = new THREE.Color();
/** the underside of an arched head across an opening: (s in -w/2..w/2) -> height below the top (0 at the crown) */
export function headDrop(head, w, rise) {
  const hw = w / 2;
  if (!head || head === 'flat') return () => 0;
  if (head === 'pointed') { const h = rise ?? w * 0.75, R = (h * h + hw * hw) / w; return (s) => h - Math.sqrt(Math.max(0, R * R - (Math.abs(s) + R - hw) ** 2)); }
  const h = Math.min(rise ?? (head === 'segment' ? w * 0.18 : hw), hw), R = (h * h + hw * hw) / (2 * h);
  return (s) => R - Math.sqrt(Math.max(0, R * R - s * s));
}
/** a small builder of vertex-coloured faces in a wall's own space: s along the wall, y up, o out of the shell face */
class WallGeo {
  constructor() { this.P = []; this.N = []; this.C = []; }
  frame(at, out, depth) { this.ax = at[0]; this.az = at[1]; this.tx = Math.cos(out); this.tz = -Math.sin(out); this.dx = Math.sin(out); this.dz = Math.cos(out); this.d = depth; return this; }
  pt(s, y, o) { return [this.ax + this.tx * s + this.dx * (this.d + o), y, this.az + this.tz * s + this.dz * (this.d + o)]; }
  /** a quad (or triangle) through wall-space corners [s, y, o], turned to face `hint` (wall space [s, y, o]) */
  face(c, col, hint = [0, 0, 1]) {
    const p = c.map((q) => this.pt(q[0], q[1], q[2]));
    const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2], vx = p[p.length - 1][0] - p[0][0], vy = p[p.length - 1][1] - p[0][1], vz = p[p.length - 1][2] - p[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    const hx = this.tx * hint[0] + this.dx * hint[2], hy = hint[1], hz = this.tz * hint[0] + this.dz * hint[2];
    const flip = nx * hx + ny * hy + nz * hz < 0; if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    _col.set(col);
    const idx = p.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
    for (const i of flip ? idx.slice().reverse() : idx) { this.P.push(p[i][0], p[i][1], p[i][2]); this.N.push(nx, ny, nz); this.C.push(_col.r, _col.g, _col.b); }
  }
  /** a block s0..s1 × y0..y1 standing from o0 out to o1 (front and four sides) */
  box(s0, s1, y0, y1, o0, o1, col) {
    if (s1 - s0 < 1e-4 || y1 - y0 < 1e-4) return;
    this.face([[s0, y0, o1], [s1, y0, o1], [s1, y1, o1], [s0, y1, o1]], col, [0, 0, 1]);
    this.face([[s1, y0, o1], [s1, y0, o0], [s1, y1, o0], [s1, y1, o1]], col, [1, 0, 0]); this.face([[s0, y0, o0], [s0, y0, o1], [s0, y1, o1], [s0, y1, o0]], col, [-1, 0, 0]);
    this.face([[s0, y1, o1], [s1, y1, o1], [s1, y1, o0], [s0, y1, o0]], col, [0, 1, 0]); this.face([[s0, y0, o0], [s1, y0, o0], [s1, y0, o1], [s0, y0, o1]], col, [0, -1, 0]);
  }
  /** a band between two curves (lists of [s, y], the same length), standing from o0 to o1: front + both edges */
  band(a, b, o0, o1, col) {
    for (let i = 0; i + 1 < a.length; i++) {
      this.face([[a[i][0], a[i][1], o1], [a[i + 1][0], a[i + 1][1], o1], [b[i + 1][0], b[i + 1][1], o1], [b[i][0], b[i][1], o1]], col, [0, 0, 1]);
      const ma = [(a[i][0] + a[i + 1][0]) / 2, (a[i][1] + a[i + 1][1]) / 2], mb = [(b[i][0] + b[i + 1][0]) / 2, (b[i][1] + b[i + 1][1]) / 2];
      this.face([[a[i][0], a[i][1], o0], [a[i + 1][0], a[i + 1][1], o0], [a[i + 1][0], a[i + 1][1], o1], [a[i][0], a[i][1], o1]], col, [ma[0] - mb[0], ma[1] - mb[1], 0]);
      this.face([[b[i][0], b[i][1], o0], [b[i + 1][0], b[i + 1][1], o0], [b[i + 1][0], b[i + 1][1], o1], [b[i][0], b[i][1], o1]], col, [mb[0] - ma[0], mb[1] - ma[1], 0]);
    }
  }
  mesh(mat, name) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    if (this.C.length) geo.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; return m;
  }
}
/** the head of an opening as a list of [s, y] (crown at y1), n segments; and the same curve moved `k` outwards (k < 0: inwards) */
function headCurve(w, y1, drop, n, k = 0) {
  const hw = w / 2, out = [];
  for (let i = 0; i <= n; i++) {
    const s = -hw + (w * i) / n, y = y1 - drop(s);
    if (!k) { out.push([s, y]); continue; }
    const e = 1e-3, sa = Math.max(-hw, s - e), sb = Math.min(hw, s + e); let ts = sb - sa, ty = -(drop(sb) - drop(sa)); const l = Math.hypot(ts, ty) || 1; ts /= l; ty /= l;
    out.push([s - ty * k, y + ts * k]);                                // (the normal of the curve, turned upwards / outwards)
  }
  return out;
}
/** resolve dressing items against a registered room: { p: i } / { o: i | [i…] } take the portal's / opening's rectangle */
function dressItems(def, items) {
  const S = def && def.sl, out = [];
  for (const it of items || []) {
    const src = it.p !== undefined ? [S.portals[it.p]].map((p) => p && ({ at: p.at, out: p.out, w: p.w, y0: p.y || 0, y1: (p.y || 0) + p.h, depth: p.depth, proud: p.proud, door: true }))
      : it.o !== undefined ? (Array.isArray(it.o) ? it.o : [it.o]).map((i) => S.openings[i]).map((o) => o && ({ at: o.at, out: o.out, w: o.w, y0: o.y0, y1: o.y1, depth: o.depth, proud: o.proud }))
        : [{}];
    for (const q of src) if (q) { const { p, o, ...style } = it; out.push({ ...q, ...style }); }
  }
  return out;
}
export function dressGeo(G, it, F = G) {      // F: where the far pane goes (dressOpenings: a single-sided mesh, so it is not seen from inside the room)
  const w = it.w, hw = w / 2, y0 = it.y0 ?? 0, y1 = it.y1 ?? 2.1, drop = headDrop(it.head, w, it.rise), arched = it.head && it.head !== 'flat';
  const rise = arched ? drop(hw) : 0, spring = y1 - rise, NS = arched ? 14 : 1, pr = it.proud ?? 0.03;     // (pr: where core punches this opening)
  G.frame(it.at, it.out, it.depth ?? 0.3);
  const oP = pr - 0.018, oS = pr + 0.015, oB0 = pr + 0.005, oB1 = pr + 0.045;
  const stone = it.stone ?? it.wall ?? 0xb8ad94;
  if (it.fill !== false) { if (F !== G) F.frame(it.at, it.out, it.depth ?? 0.3); F.face([[-hw, y0, oP], [hw, y0, oP], [hw, y1, oP], [-hw, y1, oP]], it.fill ?? (it.door ? 0x2a2018 : 0x1b2229)); }
  const hc = headCurve(w, y1, drop, NS);
  // the corners above an arched head: wall
  if (arched) for (let i = 0; i < NS; i++) G.face([[hc[i][0], hc[i][1], oS], [hc[i + 1][0], hc[i + 1][1], oS], [hc[i + 1][0], y1, oS], [hc[i][0], y1, oS]], it.wall ?? 0xb8ad94);
  // frame inside the edge
  const fw = it.frame ? it.frame.w ?? 0.06 : 0;
  if (it.frame) {
    const c = it.frame.color ?? 0xe8e4da;
    G.box(-hw, -hw + fw, y0, spring, oB0, oB1, c); G.box(hw - fw, hw, y0, spring, oB0, oB1, c);
    if (!it.door || it.frame.foot) G.box(-hw + fw, hw - fw, y0, y0 + fw, oB0, oB1, c);
    if (arched) G.band(hc, headCurve(w, y1, drop, NS, -fw).map((q, i) => [Math.max(-hw + fw * 0.2, Math.min(hw - fw * 0.2, q[0])), Math.max(spring, Math.min(hc[i][1], q[1]))]), oB0, oB1, c);
    else G.box(-hw + fw, hw - fw, y1 - fw, y1, oB0, oB1, c);
  }
  // how far up a vertical at s may go (under the head), and the half-width of the opening at height y
  const topAt = (s) => y1 - drop(Math.max(-hw, Math.min(hw, s))) - (it.frame ? fw * 0.6 : 0);
  const halfAt = (y) => { if (y <= spring) return hw - fw; let lo = 0, hi = hw; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (y1 - drop(m) > y) lo = m; else hi = m; } return Math.max(0, lo - fw * 0.6); };
  const upr = (s, bw, o1, c) => { const yt = Math.min(topAt(s - bw / 2), topAt(s + bw / 2)); G.box(s - bw / 2, s + bw / 2, y0 + (it.frame && !it.door ? fw : 0), yt, oB0, o1, c); };
  const rail = (y, bh, o1, c) => { const h = Math.min(halfAt(y - bh / 2), halfAt(y + bh / 2)); if (h > 0.02) G.box(-h, h, y - bh / 2, y + bh / 2, oB0, o1, c); };
  if (it.mullions) {
    const mw = it.mullW ?? 0.11, n = it.mullions, o1 = pr + 0.06;
    for (let i = 1; i <= n; i++) upr(-hw + (w * i) / (n + 1), mw, o1, stone);
    for (const f of it.transoms || []) rail(y0 + (spring - y0) * f, mw * 0.9, o1, stone);
    if (it.lights && arched) {
      // each light's own little head: a bar following a pointed (or round) arch from the springing of the window
      const lw = w / (n + 1), ld = headDrop(it.head === 'round' ? 'round' : 'pointed', lw, it.head === 'round' ? lw / 2 : lw * 0.7), lr = ld(lw / 2);
      for (let i = 0; i <= n; i++) {
        const c0 = -hw + lw * (i + 0.5), a = [], b = [];
        for (let k = 0; k <= 8; k++) { const s = -lw / 2 + (lw * k) / 8, y = spring + lr - ld(s); if (y > topAt(c0 + s) + 0.01) { a.length = 0; b.length = 0; break; } a.push([c0 + s, y]); b.push([c0 + s, y - mw * 0.55]); }
        if (a.length) G.band(a, b, oB0, o1, stone);
      }
    }
  }
  if (it.bars) {
    const [nc, nr] = it.bars, bw = it.barW ?? 0.028, c = it.barColor ?? (it.frame ? it.frame.color ?? 0xe8e4da : 0xe8e4da);
    for (let i = 1; i < nc; i++) upr(-hw + (w * i) / nc, bw, oB1 - 0.008, c);
    for (let j = 1; j < nr; j++) rail(y0 + ((it.barsTo ?? spring) - y0) * j / nr, bw, oB1 - 0.008, c);
    if (it.meeting) rail(y0 + (spring - y0) * it.meeting, bw * 1.7, oB1, c);       // a sash window's meeting rail
  }
  // round the outside: architrave / door-case, lintel, keystone, sill, step
  if (it.surround) {
    const bw = it.surround.w ?? 0.14, c = it.surround.color ?? stone, o1 = it.surround.proud ?? 0.07, yb = it.door ? y0 : y0 - (it.sill ? 0 : 0);
    G.box(-hw - bw, -hw, yb, spring, 0.004, o1, c); G.box(hw, hw + bw, yb, spring, 0.004, o1, c);
    if (arched) { const oc = headCurve(w, y1, drop, NS, bw); oc[0] = [-hw - bw, spring]; oc[NS] = [hw + bw, spring]; G.band(oc, hc, 0.004, o1, c); }
    else G.box(-hw - bw, hw + bw, y1, y1 + bw, 0.004, o1, c);
  }
  if (it.lintel) { const L = it.lintel, h = L.h ?? 0.22, ov = L.over ?? 0.15; G.box(-hw - ov, hw + ov, y1, y1 + h, 0.004, L.proud ?? 0.05, L.color ?? stone); }
  if (it.keystone !== undefined && it.keystone !== false) { const kw = Math.min(0.26, w * 0.16); G.box(-kw / 2, kw / 2, y1 - 0.02, y1 + 0.3, 0.004, 0.1, it.keystone === true ? stone : it.keystone); }
  if (it.sill) { const L = it.sill, h = L.h ?? 0.08, ov = L.over ?? 0.08; G.box(-hw - ov, hw + ov, y0 - h, y0, 0.004, L.proj ?? 0.1, L.color ?? stone); }
  if (it.step) { const L = it.step, h = L.h ?? 0.12, ov = L.over ?? 0.2; G.box(-hw - ov, hw + ov, y0 - h - 0.3, y0 - 0.005, 0.004, L.proj ?? 0.35, L.color ?? 0xa9a294); }
  return G;
}
export function dressOpenings(game, id, items, { name } = {}) {
  const def = game.interiors && game.interiors.get(id); if (!def || !def.sl || !game.worldScene) return null;
  const G = new WallGeo(), F = new WallGeo(); for (const it of dressItems(def, items)) dressGeo(G, it, F);
  if (!G.P.length && !F.P.length) return null;
  const m = G.mesh(dressMat(), 'wc:dress:' + (name || id));
  // (the far panes: single-sided, facing out — looking out of the room through the opening they are not there)
  const pane = F.P.length ? F.mesh(_paneMat || (_paneMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide, name: 'wc:dress-pane' })), 'wc:dress-pane:' + (name || id)) : null;
  // (the room's own matrix: room coordinates -> the world; the ground height at the door is known once the world is)
  const place = () => { def.sl.matrix(m.matrix); m.matrixWorld.copy(m.matrix); m.matrixWorldNeedsUpdate = false; m.geometry.computeBoundingSphere(); if (pane) { pane.matrix.copy(m.matrix); pane.matrixWorld.copy(m.matrix); pane.matrixWorldNeedsUpdate = false; } };
  try { place(); } catch { /* placed on the first frame it is drawn */ }
  m.onBeforeRender = () => { if (!m.userData.placed && game.world && game.world.groundHeight) { m.userData.placed = true; def.sl.baseY = def.sl.baseY ?? null; place(); } };
  m.frustumCulled = false; m.userData.wcDress = id;
  game.worldScene.add(m);
  if (pane) { pane.frustumCulled = false; pane.userData.wcDress = id; m.userData.pane = pane; game.worldScene.add(pane); }
  return m;
}
/**
 * The room's side of an arched opening (room scene, lit by the room): the back of the wall that fills the corners above
 * the head, and the soffit of the arch through the thickness of the wall. Same items as dressOpenings.
 */
export function archLining(def, items, { color = 0xd8d2c4 } = {}) {
  const G = new WallGeo();
  for (const it of dressItems(def, items)) {
    if (!it.head || it.head === 'flat') continue;
    const w = it.w, y1 = it.y1, drop = headDrop(it.head, w, it.rise), D = it.depth ?? 0.3, NS = 14, hc = headCurve(w, y1, drop, NS), c = it.lining ?? color;
    G.frame(it.at, it.out, 0);
    for (let i = 0; i < NS; i++) {
      G.face([[hc[i][0], hc[i][1], 0.004], [hc[i + 1][0], hc[i + 1][1], 0.004], [hc[i + 1][0], y1, 0.004], [hc[i][0], y1, 0.004]], c, [0, 0, -1]);
      G.face([[hc[i][0], hc[i][1], 0.004], [hc[i + 1][0], hc[i + 1][1], 0.004], [hc[i + 1][0], hc[i + 1][1], D + 0.02], [hc[i][0], hc[i][1], D + 0.02]], c, [0, -1, 0]);
    }
  }
  if (!G.P.length) return null;
  return G.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, name: 'wc:arch-lining' }), 'wc:arch-lining');
}

// ------------------------------------------------------------------------------------------------ stained glass
const SG_PAL = { rich: [0xa0182a, 0x1c3f9a, 0xc8961c, 0x1f6b3a, 0x6a2a8a, 0xd8d0b4, 0x2a6aa8, 0xb8501c], pale: [0xd8d4c0, 0xcfd6c8, 0xd6cfae, 0xc4cfd6, 0xe0d8b8, 0xb9c7b0], blue: [0x1c3f9a, 0x2a6aa8, 0x7fa8c8, 0xd8d0b4, 0xa0182a, 0xc8961c] };
/**
 * Leaded, coloured glass for window openings (ROOM scene): panes of colour between dark leads, under the opening's
 * head; it glows outwards when the room is lit at night and inwards by day.
 *   ops: [{ at, out, w, y0, y1, depth, head, rise, lights (n: the stone mullions divide it into n + 1), seed }]
 *   opts: { palette: 'rich' | 'pale' | 'blue' | [hex…], pane: 0.34 (m), border: true, inset: 0.75 (of the wall's depth), floor: y | null }
 * -> { group, setLight(day 0..1, lit 0..1) }   call setLight from the room's update AND updateShown.
 * The glass is opaque (as real stained glass is from any distance): no world is seen through it. `floor`: faint pools
 * of its colours on the floor by day (additive, one quad per window).
 */
export function stainedGlass(ops, { palette = 'rich', pane = 0.34, border = true, inset = 0.75, floor = null, floorReach = 2.4 } = {}) {
  const pal = Array.isArray(palette) ? palette : SG_PAL[palette] || SG_PAL.rich, G = new WallGeo(), L = new WallGeo(), FP = [], FC = [];
  const rnd = (n) => { let t = (n * 2654435761) >>> 0; t ^= t >>> 15; t = Math.imul(t, 2246822519) >>> 0; t ^= t >>> 13; return (t >>> 0) / 4294967296; };
  let k = 0;
  for (const o of ops) {
    const w = o.w, hw = w / 2, y0 = o.y0, y1 = o.y1, drop = headDrop(o.head, w, o.rise), D = (o.depth ?? 0.3) * inset, seed = (o.seed ?? 0) * 977 + (k++) * 131;
    G.frame(o.at, o.out, 0); L.frame(o.at, o.out, 0);
    const nL = (o.lights ?? 0) + 1, lw = w / nL, nc = Math.max(2, Math.round(lw / pane)), cw = lw / nc, avg = [0, 0, 0]; let na = 0;
    for (let li = 0; li < nL; li++) for (let ci = 0; ci < nc; ci++) {
      const s0 = -hw + li * lw + ci * cw, s1 = s0 + cw, top = Math.min(y1 - drop(s0), y1 - drop(s1), y1 - drop((s0 + s1) / 2)), nr = Math.max(1, Math.round((top - y0) / (pane * 1.25)));
      const edge = border && (ci === 0 || ci === nc - 1);
      for (let r = 0; r < nr; r++) {
        const a = y0 + ((top - y0) * r) / nr, b = y0 + ((top - y0) * (r + 1)) / nr, h = rnd(seed + li * 53 + ci * 17 + r * 7 + 1);
        // a border of one colour per light, a figure-ish block of rich colour in the middle third, pale quarries elsewhere
        const mid = r > nr * 0.3 && r < nr * 0.75 && !edge;
        const c = edge ? pal[(li + (r & 1)) % 2 === 0 ? 0 : 1] : mid ? pal[Math.floor(h * pal.length)] : h < 0.25 ? pal[Math.floor(h * 4 * pal.length) % pal.length] : (pal === SG_PAL.rich ? 0xd8d0b4 : pal[(ci + r) % pal.length]);
        G.face([[s0, a, D], [s1, a, D], [s1, b, D], [s0, b, D]], c, [0, 0, 1]);
        _col.set(c); avg[0] += _col.r; avg[1] += _col.g; avg[2] += _col.b; na++;
        L.box(s0, s1, b - 0.008, b + 0.008, D - 0.006, D + 0.006, 0x16140f);
      }
      // the sliver under the head
      if (y1 - drop((s0 + s1) / 2) - top > 0.02 || true) G.face([[s0, top, D], [s1, top, D], [s1, y1 - drop(s1), D], [s0, y1 - drop(s0), D]], pal[(li + ci) % pal.length], [0, 0, 1]);
      L.box(s1 - 0.008, s1 + 0.008, y0, Math.min(y1 - drop(Math.min(hw, s1)), y1), D - 0.006, D + 0.006, 0x16140f);
    }
    if (floor !== null && na) {
      const dx = Math.sin(o.out), dz = Math.cos(o.out), tx = Math.cos(o.out), tz = -Math.sin(o.out), r0 = 0.5, r1 = r0 + floorReach, q = (s, r) => [o.at[0] + tx * s - dx * r, floor + 0.012, o.at[1] + tz * s - dz * r];
      const A = q(-hw * 0.9, r0), B = q(hw * 0.9, r0), C = q(hw * 1.1, r1), E = q(-hw * 1.1, r1);
      for (const v of [A, C, B, A, E, C]) { FP.push(...v); FC.push(avg[0] / na, avg[1] / na, avg[2] / na); }
    }
  }
  const group = new THREE.Group(); group.name = 'wc:stained';
  const mOut = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide, name: 'wc:sg-out' }), mIn = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, name: 'wc:sg-in' });
  const lead = new THREE.MeshBasicMaterial({ color: 0x0c0b09, name: 'wc:sg-lead', side: THREE.DoubleSide });
  const a = G.mesh(mOut, 'wc:sg-out'), b = new THREE.Mesh(a.geometry, mIn); b.name = 'wc:sg-in'; b.matrixAutoUpdate = false; b.castShadow = false;
  const l = L.mesh(lead, 'wc:sg-lead'); l.geometry.deleteAttribute('color');
  for (const m of [a, b, l]) { m.receiveShadow = false; m.userData.live = true; group.add(m); }
  let pool = null, mPool = null;
  if (FP.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(FP, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(FC, 3));
    mPool = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, name: 'wc:sg-pool' });
    pool = new THREE.Mesh(g, mPool); pool.name = 'wc:sg-pool'; pool.matrixAutoUpdate = false; pool.renderOrder = 2; pool.userData.live = true; group.add(pool);
  }
  const setLight = (day = 1, lit = 0) => {
    const o = Math.max(0.16 + 0.1 * day, 0.95 * lit * (1 - 0.75 * day)), i = 0.1 + 0.95 * day;
    mOut.color.setScalar(o); mIn.color.setScalar(i); if (mPool) { mPool.opacity = 0.22 * day; pool.visible = day > 0.05; }
  };
  setLight(1, 0);
  return { group, setLight };
}

// ------------------------------------------------------------------------------------------------ people
/**
 * The people of a walk-in room, there whenever the room is SHOWN (so they are seen from the street through its windows
 * and doorway), not only when you are in it.
 *   const C = roomCrowd(game, id, { populate(spawn, C) { spawn(x, z, look, opts) … }, signature: () => 'changes when the cast should' });
 *   register({ …, update: (dt) => C.tick(dt), updateShown: (dt) => C.tick(dt) })       (room coordinates; opts as pedestrians.spawnAt)
 * The cast is rebuilt when signature() changes (the hour band, open / closed); C.clear() removes it. People are static
 * by default (opts.static false for ones a module moves itself).
 * A BIG cast (cap over STAGE_CAP: the Covered Market's ninety) is not made in one frame — that was an 85-100 ms frame
 * the first time the market came into range, a body costing 7-10 ms to build. Everyone within STAGE_NEAR m of the
 * player is made at once (nobody appears at close range: inside the room, at its doorway, when it opens for the day);
 * the rest STAGE_PER a frame, nearest the player first. populate() is run again for each lot with a spawn() that makes
 * only that lot and hands back the people already made, so whatever the module keeps (a stallholder per counter) is
 * what it would have kept, and each person's seed — where he stands — is untouched: the same people in the same places
 * for every player once it is done. populate() of such a cast must be by rule (no random). ?crowdstage=0: at once.
 */
const STAGE_CAP = 24, STAGE_PER = 2, STAGE_NEAR = 30;
let STAGE_ON = true; try { if (/[?&]crowdstage=0(&|$)/.test(location.search)) STAGE_ON = false; } catch { /* no location */ }
export function roomCrowd(game, id, { populate, signature = null, every = 2, cap = 14 } = {}) {
  const C = { npcs: [], sig: undefined, t: 0, cap };
  C.spawn = (x, z, look, opts = {}) => {
    const peds = game.pedestrians, d = game.interiors.get(id); if (!peds || !peds.spawnAt || !d || !d.scene || C.npcs.length >= C.cap) return null;
    try { const p = peds.spawnAt(x, z, look, { place: id, scene: d.scene, knockable: false, static: true, ...opts }); if (p) C.npcs.push(p); return p; } catch (e) { console.warn('[walkin] spawn', id, e); return null; }
  };
  C.clear = () => { const peds = game.pedestrians; for (const p of C.npcs) { try { peds && peds.remove(p); } catch { /* */ } } C.npcs.length = 0; C.sig = undefined; C.stage = null; };
  const ALL = (game.walkin = game.walkin || { list: [], byId: new Map() }).crowds || (game.walkin.crowds = []); ALL.push(C);
  // one lot of a staged cast: populate() again, making those of its people not yet made that are near the player, and
  // STAGE_PER of the rest (nearest first)
  const stageStep = () => {
    const Q = C.stage, d = game.interiors.get(id), pl = game.player; let px = 0, pz = 0, have = false;
    try { if (pl.place === id) { px = pl.pos.x; pz = pl.pos.z; have = true; } else if (d && d.sl && d.sl.toLocal) { const w = pl.place === 'world' || !pl.worldPos ? pl.pos : pl.worldPos, l = d.sl.toLocal(w.x, w.z, [0, 0]); px = l[0]; pz = l[1]; have = true; } } catch { have = false; }
    // (which to make this time: a dry run for where everyone stands)
    const pos = []; let i = 0;
    try { populate((x, z) => { pos.push(i, x, z); i++; return null; }, C); } catch (e) { console.warn('[walkin] populate', id, e); C.stage = null; return; }
    const todo = []; for (let k = 0; k < pos.length; k += 3) if (!Q.made.has(pos[k])) todo.push([pos[k], have ? Math.hypot(pos[k + 1] - px, pos[k + 2] - pz) : 0]);
    todo.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const now = new Set(); let far = 0;
    for (const t of todo) { if (!have || t[1] < STAGE_NEAR) now.add(t[0]); else if (far < STAGE_PER) { now.add(t[0]); far++; } }
    i = 0;
    try { populate((x, z, look, opts) => { const k = i++; if (Q.made.has(k)) return Q.made.get(k); if (!now.has(k)) return null; const p = C.spawn(x, z, look, opts); Q.made.set(k, p); return p; }, C); } catch (e) { console.warn('[walkin] populate', id, e); C.stage = null; return; }
    if (todo.length <= now.size) { C.stage = null; C.empty = !C.npcs.length; }
  };
  C.tick = (dt) => {
    C.seen = game.frame || 0;
    if (C.stage) { stageStep(); return; }
    C.t -= dt; if (C.t > 0) return; C.t = every;
    // (a room that is no longer shown is no longer ticked: its people go)
    for (const q of ALL) if (q !== C && q.npcs.length && (game.frame || 0) - q.seen > 240) q.clear();
    const d = game.interiors.get(id); if (!d || !d.built) return;
    let s = ''; try { s = signature ? String(signature()) : ''; } catch { s = ''; }
    // (people the pedestrian system has dropped — the room was hidden — are put back)
    const alive = C.npcs.length && C.npcs.every((p) => p.active);
    if (s === C.sig && (alive || C.empty)) return;
    if (STAGE_ON && C.cap > STAGE_CAP) { C.clear(); C.sig = s; C.empty = false; C.stage = { made: new Map() }; stageStep(); return; }
    C.clear(); C.sig = s; try { populate(C.spawn, C); } catch (e) { console.warn('[walkin] populate', id, e); } C.empty = !C.npcs.length;
  };
  return C;
}
