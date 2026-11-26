// People standing where people stand (fidelity pass, 2026-11).
//   smokers   outside every pub and bar the map has (POIs and buildings tagged pub / bar: ~70), c. 2013 — six years
//             after the ban, so the smokers are on the pavement by the door: none to three of them from late afternoon
//             to closing (a few at lunchtime; one hardy soul at most in heavy rain), a wisp of smoke from each
//   the queue at every mapped cash machine (25): none to three people in a line back from the wall by day and on a
//             night out, shuffling nowhere
// Nothing is hand-placed. The spot is worked out from the map: the nearest stretch of the venue's own wall that has a
// street (a carriageway within 8 m, or a pedestrian street) in front of it, a metre out — outside every building
// footprint, off the carriageway, clear of walls, hedges, railings, street furniture and water. A venue with no such
// spot, or where a place module already keeps people of its own (a scripted NPC within 12 m), gets nobody.
//   who / when  a function of (venue, game day, hour, rain): the same people for every player. They are ordinary
//               scripted NPCs (pedestrians.spawnAt: stable id from the spot, look and idle lines from the shared
//               clock), made only while a player is within 60 m; they come and go only while you are indoors, or more than
//               22 m off and looking elsewhere (or arriving from 45 m+)
//   lines       bubble text only for now (no clips recorded: they show as speech bubbles): SMOKER_LINES, QUEUE_LINES
//   off         ?streetlife=0 (node: GTO_STREETLIFE=0)
//   drawn       the people are characters (at most 10, usually 0-3 near you); the cash machines themselves — the map has
//               the point but the world drew nothing there — are one merged draw of plain steel hole-in-the-walls (no
//               bank's name or colours), shown only within 90 m of one
//   cost        a 1 Hz pass over ~80 venues (a distance test each)
// game.streetlife = { ready, venues, people, plan(venue, timeMs, hour, rain), stats() }     test: tools/smoke_fidelity.mjs
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { randomLook } from '../core/characters.js';
import { pointInPoly } from '../core/collision.js';
import { fidOn, fidPuffs, h01, strSeed } from './_fid.js';
import { barrierGap } from './_clearance.js';

export const SMOKER_LINES = ["It's warmer inside, apparently.", "Last one. Then I'm quitting.", 'Whose round is it?', "You can't hear yourself think in there.", 'Got a light?', 'Five more minutes.', "I only smoke when I'm out.", 'Is the quiz tonight or tomorrow?', 'I said one drink. That was three hours ago.'];
export const QUEUE_LINES = ["It's eaten my card before, this one.", 'Is this the queue?', "Twenty quid, that's all I want.", "It's always the one in front.", "Don't look at my balance.", "It's out of tenners again.", 'Is there another one round the corner?'];
const NEAR = 60, FAR = 80, POP = 22, MAX_PEOPLE = 10;
import { DAY_MS, HOUR_MS } from '../core/time.js';

/** pure: how many smokers stand outside venue `seed` at this moment (0..3) */
export function smokerCount(seed, timeMs, hour, rain = 0) {
  const day = Math.floor(timeMs / DAY_MS), u = h01(seed, day, 1);
  let n = 0;
  if (hour >= 17.5 || hour < 0.2) n = u < 0.25 ? 0 : u < 0.6 ? 1 : u < 0.88 ? 2 : 3;
  else if (hour >= 12.2 && hour < 14.5) n = h01(seed, day, 2) < 0.35 ? 1 : 0;
  if (hour >= 17.5 && hour < 19 && n > 1) n = 1;               // (early doors)
  return rain > 0.4 ? Math.min(n, 1) : n;
}
/** pure: how many people queue at cash machine `seed` at this moment (0..3) */
export function queueCount(seed, timeMs, hour, rain = 0) {
  const slot = Math.floor(timeMs / (2 * HOUR_MS)), u = h01(seed, slot, 3);       // (re-drawn every two game hours)
  let n = 0;
  if (hour >= 8.5 && hour < 19) n = u < 0.3 ? 0 : u < 0.65 ? 1 : u < 0.9 ? 2 : 3;
  else if (hour >= 19 || hour < 1.5) n = u < 0.5 ? 0 : u < 0.85 ? 1 : 2;
  return rain > 0.5 ? Math.min(n, 1) : n;
}

export default {
  id: 'streetlife',
  install(game) {
    if (!fidOn('streetlife')) { game.streetlife = { off: true, ready: false, venues: [], people: [], stats: () => ({ off: true, venues: 0, people: 0 }) }; return null; }
    const venues = [], people = [], camDir = new THREE.Vector3();
    let ready = false, tick = 0, smokeT = 0, noSpot = 0, atmMesh = null;
    const K_CIG = [0.78, 0.78, 0.8, 0.22, 0.03, 0.3, 1.8, 0.35, 1.8, 0];
    const vs = () => game.vehicles && game.vehicles._sys;
    // every building outline the map has, canopies and parts included (32 m cells): nobody is stood inside one
    let bg = null;
    const inAnyBuilding = (x, z) => {
      if (!bg) { bg = new Map(); for (const b of game.map.buildings) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of b.poly) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
        for (let cx = Math.floor(x0 / 32); cx <= Math.floor(x1 / 32); cx++) for (let cz = Math.floor(z0 / 32); cz <= Math.floor(z1 / 32); cz++) { const k = cx * 65536 + cz; let l = bg.get(k); if (!l) bg.set(k, (l = [])); l.push(b); } } }
      const l = bg.get(Math.floor(x / 32) * 65536 + Math.floor(z / 32));
      if (l) for (const b of l) if (pointInPoly(x, z, b.poly) && !(b.holes || []).some((h) => pointInPoly(x, z, h))) return true;
      return false;
    };
    /** a place a person can stand: outside buildings, off the road, clear of solid things and boundaries, dry */
    const standOk = (x, z, r = 0.4) => {
      const V = vs(), col = game.worldCollider;
      if (!V || V.inBuilding(x, z) || inAnyBuilding(x, z) || V.onCarriage(x, z, 0.45) || V.wet(x, z) || col.isWet(x, z)) return false;
      if (!col.isFree(x, z, r) || barrierGap(col, x, z, 1) < 0.3) return false;
      const P = game.pedestrians; if (P && P.road && P.road(x, z, 0.2)) return false;
      for (const d of doors()) if ((d.x - x) ** 2 + (d.z - z) ** 2 < 1.1 * 1.1) return false;          // not on a doorstep
      return true;
    };
    // the doors you can go in by (core/interiors.js registers each as an "Enter ..." point in the world)
    let doorList = null;
    const doors = () => { if (!doorList) { doorList = []; for (const it of game.interact.items) if (it.place === 'world' && it.pos && typeof it.pos !== 'function' && (it.door || (typeof it.label === 'string' && /^Enter\b/.test(it.label)))) doorList.push({ x: it.pos.x, z: it.pos.z }); } return doorList; };
    function build() {
      const map = game.map, V = vs(); if (!V || !game.pedestrians || !game.pedestrians.spawnAt) return false;
      const st = game.streetscape; if (st && st.stats && !st.stats().ready) return false;
      // pedestrian streets (a frontage on one counts as a street front)
      const pedSegs = [];
      for (const r of map.roads) if ((r.kind === 'pedestrian' || r.kind === 'living_street') && r.pts) for (let i = 1; i < r.pts.length; i++) pedSegs.push([r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1], (r.w || 6) / 2]);
      const onStreet = (x, z) => {
        if (V.onCarriage(x, z, 8)) return true;
        for (const s of pedSegs) { const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1; let t = ((x - s[0]) * dx + (z - s[1]) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; if (Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t) < s[4] + 3) return true; }
        return false;
      };
      const raw = [], seen = [];
      const want = (kind, name, x, z, id, poly) => { for (const q of seen) if (q[0] === kind && Math.hypot(q[1] - x, q[2] - z) < (kind === 'atm' ? 3 : 22)) return; seen.push([kind, x, z]); raw.push({ kind, name: name || '', px: x, pz: z, id, poly: poly || null }); };
      for (const b of map.buildings) { const a = b.tags && b.tags.amenity; if ((a === 'pub' || a === 'bar') && !game.overrides.skip.has(b.id)) want('pub', b.tags.name, b.c[0], b.c[1], b.id, b.poly); }
      for (const p of map.pois) { if (game.overrides.skip.has(p.id)) continue; if (p.kind === 'pub' || p.kind === 'bar') want('pub', p.name, p.p[0], p.p[1], p.id, null); else if (p.kind === 'atm') want('atm', p.name, p.p[0], p.p[1], p.id, null); }
      for (const v of raw) {
        // the venue's own building: the one given, the one the point is in, else the nearest wall within 6 m
        let polys = v.poly ? [v.poly] : [];
        if (!polys.length) for (const b of map.buildings) { if (Math.abs(b.c[0] - v.px) > 60 || Math.abs(b.c[1] - v.pz) > 60 || b.part) continue; if (pointInPoly(v.px, v.pz, b.poly)) { polys = [b.poly]; break; } }
        if (!polys.length) for (const b of map.buildings) { if (Math.abs(b.c[0] - v.px) > 40 || Math.abs(b.c[1] - v.pz) > 40 || b.part) continue; polys.push(b.poly); }
        let best = null;
        for (const poly of polys) for (let i = 0; i < poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1.6) continue;
          const ux = dx / L, uz = dz / L;
          for (let d = 0.8; d <= L - 0.8; d += 1.2) {
            const wx = a[0] + ux * d, wz = a[1] + uz * d, dp = Math.hypot(wx - v.px, wz - v.pz); if (dp > (v.kind === 'atm' ? 7 : 26)) continue;
            for (const s of [1, -1]) {
              const nx = -uz * s, nz = ux * s, x = wx + nx * 1.0, z = wz + nz * 1.0;
              if (pointInPoly(x, z, poly) || !standOk(x, z) || !onStreet(x, z)) continue;
              const score = dp + (standOk(x + nx * 0.9, z + nz * 0.9) ? 0 : 1.5);
              if (!best || score < best.score) best = { score, x, z, nx, nz, ux, uz };
            }
          }
        }
        if (!best) { noSpot++; continue; }
        // the standing places: by the wall either side of the spot (smokers), back from the wall or along it (a queue)
        const spots = [];
        const tryAdd = (x, z, h) => { if (spots.length < 3 && standOk(x, z) && !spots.some((q) => Math.hypot(q[0] - x, q[1] - z) < 0.7)) spots.push([x, z, h]); };
        const out = Math.atan2(best.nx, best.nz), inw = out + Math.PI;
        if (v.kind === 'pub') {
          tryAdd(best.x, best.z, out + 0.5);
          tryAdd(best.x + best.ux * 0.95 + best.nx * 0.25, best.z + best.uz * 0.95 + best.nz * 0.25, out - 2.0);
          tryAdd(best.x - best.ux * 1.0 + best.nx * 0.1, best.z - best.uz * 1.0 + best.nz * 0.1, out + 0.9);
          tryAdd(best.x + best.ux * 1.9, best.z + best.uz * 1.9, out - 0.3);
        } else {
          tryAdd(best.x - best.nx * 0.25, best.z - best.nz * 0.25, inw);
          for (let k = 1; k <= 2; k++) { const n0 = spots.length; tryAdd(best.x + best.nx * (0.85 * k - 0.25), best.z + best.nz * (0.85 * k - 0.25), inw); if (spots.length === n0) break; }
          for (const s of [1, -1]) for (let k = 1; k <= 2 && spots.length < 3; k++) tryAdd(best.x - best.nx * 0.15 + best.ux * s * 0.9 * k, best.z - best.nz * 0.15 + best.uz * s * 0.9 * k, Math.atan2(-best.ux * s, -best.uz * s));
        }
        if (!spots.length) { noSpot++; continue; }
        venues.push({ kind: v.kind, name: v.name, id: v.id, seed: strSeed(v.kind + '|' + v.id), x: best.x, z: best.z, wx: best.x - best.nx, wz: best.z - best.nz, out, spots, peds: [], skip: false, want: 0 });
      }
      // the cash machines themselves (the map has the point, the world drew nothing): a plain hole-in-the-wall on the
      // wall the queue faces — steel surround, a lit screen, a keypad shelf; no bank's name or colours. ONE merged draw,
      // shown only within 90 m of one
      const parts = [];
      const box = (w, h, d, hex, x, y, z, v) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.deleteAttribute('uv'); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.translate(x, y, z); g.rotateY(v.out); g.translate(v.wx, game.world.groundHeight(v.x, v.z), v.wz); parts.push(g); };
      for (const v of venues) {
        if (v.kind !== 'atm') continue;
        box(0.66, 1.0, 0.07, 0x8d9297, 0, 1.3, 0.035, v); box(0.34, 0.26, 0.02, 0x3f78b8, 0, 1.52, 0.075, v); box(0.4, 0.05, 0.13, 0x6f7479, 0, 1.2, 0.09, v);
        box(0.2, 0.12, 0.02, 0x23262a, 0, 1.08, 0.075, v); box(0.12, 0.02, 0.02, 0x1fa04a, 0.2, 1.32, 0.075, v); box(0.66, 0.12, 0.09, 0x2a2e33, 0, 1.87, 0.045, v);
      }
      if (parts.length) {
        atmMesh = new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshLambertMaterial({ vertexColors: true }));
        atmMesh.name = 'fidelity:cashpoints'; atmMesh.castShadow = false; atmMesh.receiveShadow = false; atmMesh.frustumCulled = false; atmMesh.visible = false;
        if (game.world && game.world.terrainStandObject) game.world.terrainStandObject(atmMesh);      // (terrain: a cash machine is in a wall: it takes the level that building stands at)
        game.worldScene.add(atmMesh);
      }
      return true;
    }
    /** who should be standing at venue v now: [[x, z, heading, pose, lookSeed], ...] (the same on every client) */
    function plan(v, timeMs, hour, rain) {
      const n = Math.min(v.spots.length, v.kind === 'pub' ? smokerCount(v.seed, timeMs, hour, rain) : queueCount(v.seed, timeMs, hour, rain));
      const day = Math.floor(timeMs / DAY_MS), out = [];
      for (let i = 0; i < n; i++) {
        const s = v.spots[i], ls = (v.seed ^ Math.imul(day + 1, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca6b)) | 0, u = h01(ls, 5);
        out.push([s[0], s[1], s[2], v.kind === 'pub' ? (i === 1 ? 'talk' : u < 0.3 ? 'phone' : 'stand') : u < 0.25 && i > 0 ? 'phone' : 'stand', ls]);
      }
      return out;
    }
    const scriptedNear = (x, z, r) => { const L = game.pedestrians.list; for (const p of L) if (p.active !== false && p.scripted && !p._fid && (p.place || 'world') === 'world' && (p.homeX - x) ** 2 + (p.homeZ - z) ** 2 < r * r) return true; return false; };
    function clearVenue(v) { for (const p of v.peds) { try { game.pedestrians.remove(p); } catch { /* */ } const i = people.indexOf(p); if (i >= 0) people.splice(i, 1); } v.peds.length = 0; v.want = 0; }
    game.streetlife = { get ready() { return ready; }, venues, people, plan, get atmMesh() { return atmMesh; }, get doors() { return doors(); }, smokerCount, queueCount, standOk,
      stats: () => ({ ready, venues: venues.length, pubs: venues.filter((v) => v.kind === 'pub').length, atms: venues.filter((v) => v.kind === 'atm').length, noSpot, people: people.length }) };
    return {
      id: 'streetlife',
      update(dt) {
        if (!ready) { ready = build(); if (!ready) return; }
        const pl = game.player, P = game.fidPuffs;
        if (P) P.step(dt, 'streetlife');
        if ((tick -= dt) <= 0) {
          tick = 1;
          const out = pl.place === 'world', wp = pl.worldPos || pl.pos, now = game.time.now(), hour = game.time.hour, rain = game.weather ? game.weather.rain || 0 : 0;
          let atmNear = false;
          // (in view: within ~60 degrees of where the camera looks; indoors nothing outdoors is seen)
          const cam = game.camera, cd = cam.getWorldDirection(camDir), cl = Math.hypot(cd.x, cd.z) || 1;
          const seen = (v) => { if (!out) return false; const dx = v.x - cam.position.x, dz = v.z - cam.position.z, l = Math.hypot(dx, dz) || 1; return (dx * cd.x + dz * cd.z) / (l * cl) > 0.5; };
          for (const v of venues) {
            const d = Math.hypot(v.x - wp.x, v.z - wp.z);
            if (v.kind === 'atm' && d < 90) atmNear = true;
            if (v.peds.length && d > FAR) { clearVenue(v); continue; }
            if (d > NEAR) continue;
            const want = plan(v, now, hour, rain);
            if (want.length === v.want && (v.peds.length || !want.length)) continue;
            // never in or out under your nose: only while you are indoors (the door you will come out of is `wp`), or
            // beyond 22 m and outside the view
            // (2026-11-24: "outside the view" is now the walkers' own test - out of the camera's picture or a building in
            //  the way; 45 m off in plain view used to count as unnoticed)
            if (out && (d < POP || (game.pedestrians.unseen ? !(game.pedestrians.unseen(v.x, v.z) && want.every((w) => game.pedestrians.unseen(w[0], w[1])) && v.peds.every((q) => game.pedestrians.unseen(q.x, q.z))) : seen(v)))) continue;
            if (v.peds.length) clearVenue(v);
            v.want = want.length;
            if (!want.length || people.length + want.length > MAX_PEOPLE || scriptedNear(v.x, v.z, 12)) continue;
            for (const w of want) {
              try {
                const p = game.pedestrians.spawnAt(w[0], w[1], randomLook(w[4], { outfit: 'casual' }), { heading: w[2], pose: w[3], lines: v.kind === 'pub' ? SMOKER_LINES : QUEUE_LINES, role: 'townie' });
                if (p) { p._fid = v.kind; v.peds.push(p); people.push(p); }
              } catch (e) { if (!v.err) { v.err = true; console.warn('[streetlife] spawn', e); } }
            }
          }
          if (atmMesh) atmMesh.visible = atmNear && out;
        }
        // a wisp from each smoker (the pass's shared puff draw)
        if (people.length && (smokeT -= dt) <= 0) {
          smokeT = 0.45;
          const Pf = fidPuffs(game), day = game.time.daylight === undefined ? 1 : game.time.daylight, b = 0.3 + 0.7 * day;
          K_CIG[0] = K_CIG[1] = 0.78 * b; K_CIG[2] = 0.8 * b;
          for (const p of people) {
            if (p._fid !== 'pub' || !p.character || p.down) continue;
            const g = p.character.group, h = g.rotation.y, fx = Math.sin(h), fz = Math.cos(h);
            Pf.emit(K_CIG, g.position.x + fx * 0.22 - fz * 0.24, g.position.y + 1.02, g.position.z + fz * 0.22 + fx * 0.24, 0, 0.25, 0, 0.04);
          }
        }
      },
    };
  },
};
