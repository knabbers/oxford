// Worcester College: THE TERRACE (the New North Range, Staircases 2 - 6) built by hand at its true size, the screen wall
// and roofed slip at its east end, and the SENIOR COMMON ROOM range (the surviving 15th-century north range) east of it
// as far as its gable on Walton Street. Called by places/worcester.js, which owns the batch, the helpers (wall, outline,
// pediment, lantern …) and the colliders; this file owns the shapes. Every number is in the plan,
// places/_worcester_terrace_plan.js (how it was measured; what is known and what is guessed: TERR_CHECKED).
//
// 2026-11-22, second pass. What changed from the first pass's Terrace: 19 bays where 17 were drawn, and not equal ones;
// the front 1.2 m further north and the range 10.2 m deep (11.4); the eaves at 12.17 m (10.15); a mansard roof of stone
// slates under a metal top with a dormer to every flank bay on both slopes (a hipped slate roof, 14 dormers); the
// flank bays' sunk panels, apron blocks, the centre's architraves and console cornices, a modillion cornice 0.7 m out;
// the north face with its basement storey down to Provost's Yard; Staircase 6 as a real way DOWN through the range
// (it was a level passage through bay 1); the old range east of it two storeys under stone slates (it was two more
// pieces of the Terrace at full height, and a guessed cottage on the street).
// LEVELS: everything is in the core's own coordinates (y = level - 61.05 m); worcester.js holds the core rigid on the
// drawn ground. The north side's ground is the yard's and the garden's, not this file's.
import * as THREE from 'three';
import { WORC_BLOCK as WB } from './_worcester_shared.js';
import { frame, rectPts, archPts } from './_worcester_kit.js';
import { TERR, S6, SLIP, SCR, scrN, scrS, s6Ground, doorGround } from './_worcester_terrace_plan.js';

const Y = TERR.y, NF = TERR.north;
const { u0, u1, vS, vN } = TERR, [C0, C1] = TERR.centre, OUT = TERR.breakOut;

/** the Terrace's own walking heights at local (u, v) — the doorways' steps, Staircase 6, the slip — or null. T: the walk's gravel. */
export function terraceGround(u, v, T) {
  if (v <= vS + 0.75 && v > vN - 0.02 && u > u0 && u < u1) {
    const d = doorGround(u, v); if (d !== null) return d;
    const s = s6Ground(u, v); if (s !== null) return s;
    return null;
  }
  if (u >= SLIP.u0 && u < SLIP.u1 && v > SLIP.v0 - 0.25 && v < SLIP.v1) return T;      // behind the screen's arch, under the slip's roof
  return null;
}
/** where the follow camera must stay under a ceiling (local boxes; y: the ceiling above the player's feet) */
export const TERR_COVERS = [
  { u0: S6.hall.u0, u1: S6.flight.u1, v0: S6.hall.v0, v1: vS, y: S6.ceil - S6.y0 - 0.3 },
  { u0: S6.flight.u0, u1: S6.flight.u1, v0: vN, v1: S6.flight.v1, y: 2.3 },
  { u0: SLIP.u0, u1: SLIP.u1, v0: SLIP.v0 - 0.25, v1: SLIP.v1, y: SLIP.roof.y - 0.4 },
];
/** the follow camera knows walls but not ceilings: inside Staircase 6 and under the slip's roof it is held under them
 *  (the same hook as the garden passages' and the yard's, chained in front of whatever is there) */
export function terraceCamera(game, W2L) {
  const at = (x, z, m = 0) => { const [u, v] = W2L(x, z); for (const c of TERR_COVERS) if (u > c.u0 - m && u < c.u1 + m && v > c.v0 - m && v < c.v1 + m) return c; return null; };
  const prev = game.cameraHook;
  if (typeof game._followCamera !== 'function') return;
  game.cameraHook = (dt, cam) => {
    if (prev && prev(dt, cam)) return true;
    const p = game.player;
    if (!p || p.place !== 'world' || p.vehicle || game.activity || game.firstPerson) return false;
    const pc = at(p.pos.x, p.pos.z, 0.15);
    if (!pc && !at(cam.position.x, cam.position.z)) return false;      // (… or only the camera is still under one: the player has just stepped out of the yard door)
    game._followCamera(dt);
    if (game._fp) return true;
    const cc = at(cam.position.x, cam.position.z) || pc;
    if (cc && cam.position.y > p.pos.y + cc.y) { cam.position.y = p.pos.y + cc.y; cam.lookAt(p.pos.x, p.pos.y + 1.4, p.pos.z); }
    return true;
  };
}

/**
 * K: { B, atlas, pack, wall, outline, pediment, lantern, plant, nextBay, seg, pl, T }
 * -> { lamps: [[u, v, y]] } (lights inside Staircase 6: the wall lanterns give their own through `lantern`)
 */
export function buildTerrace(K) {
  const { B, atlas, wall, outline, pediment, lantern, plant, nextBay, seg, pl, T } = K;
  const lamps = [];
  // a tint the college's atlas did not have: the roof's metal top (green copper by the aerial views)
  if (K.pack && K.pack.cells && K.pack.cells.get('lead') && !K.pack.cells.get('copperTop')) { const c = new THREE.Color(0x7f9c8e); K.pack.cells.set('copperTop', { ...K.pack.cells.get('lead'), tint: [c.r, c.g, c.b] }); }
  const TOP = K.pack && K.pack.cells && K.pack.cells.get('copperTop') ? 'copperTop' : 'lead';

  /** a block in the current frame drawn with only the faces named: f front (z1), k back (z0), t top, b bottom, l (x0), r (x1) */
  const blk = (key, x0, x1, y0, y1, z0, z1, f = 'ftblr') => {
    if (f.includes('f')) B.poly(key, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
    if (f.includes('k')) B.poly(key, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]);
    if (f.includes('t')) B.poly(key, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
    if (f.includes('b')) B.poly(key, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
    if (f.includes('l')) B.poly(key, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
    if (f.includes('r')) B.poly(key, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]);
  };
  /** a window's plain frame standing a little proud of the wall (current frame) */
  const ring = (c, w, y0, y1, m = 0.14, z = 0.03) => B.face('stoneDress', rectPts(c - w / 2 - m, y0 - m * 0.6, c + w / 2 + m, y1 + m), [rectPts(c - w / 2, y0, c + w / 2, y1)], z);
  const baysIn = (a, b) => TERR.bays.map((u, i) => [u, i]).filter(([u]) => u > a && u < b);

  // ================================================================= THE QUAD FRONT (south)
  const G = Y.gw, A = Y.arch, P = Y.panel;
  for (const [a, b, out] of [[u0, C0, 0], [C0, C1, OUT], [C1, u1, 0]]) {
    const len = b - a, F = frame(a, 0, vS + out, 1, 0), list = baysIn(a, b), centre = out > 0;
    // ---- the arcade storey: a rusticated round recess to every bay, holding a round-headed sash or a doorway
    const ops = [];
    for (const [u, i] of list) {
      const sc = u - a, door = TERR.doors[i];
      if (i === TERR.through) ops.push({ pts: archPts(sc, A.w, T + 0.02, A.spring, 10), kind: 'recess', d: A.d, inner: { pts: archPts(sc, G.w, Y.floor, G.spring, 8), kind: 'void', d: 0.5 - A.d } });      // Staircase 6: an open doorway through the wall
      else if (door) ops.push({ pts: archPts(sc, A.w, T + 0.02, A.spring, 10), kind: 'recess', d: A.d, inner: { pts: archPts(sc, G.w, Y.floor, G.spring, 8), kind: 'door', spring: G.spring, d: TERR.rec.door - A.d + 0.02 } });      // (the painted door stands rec.door behind the face)
      else ops.push({ pts: archPts(sc, A.w, A.foot, A.spring, 10), kind: 'recess', d: A.d, inner: { pts: archPts(sc, G.w, G.sill, G.spring, 8), kind: 'win', spring: G.spring, d: 0.2, seed: i } });
    }
    wall(B, F, outline(0, len, 0, Y.band[0]), ops, 'stoneIvyT');      // (the creeper: over the arcade storey, as in the photographs)
    B.push(F);
    for (const [u, i] of list) {
      const sc = u - a, r = A.w / 2, door = TERR.doors[i];
      // the voussoir ring over the recess, the impost blocks inside it
      for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI, a1 = ((k + 1) / 8) * Math.PI, q = (an, rr) => [sc + Math.cos(an) * rr, A.spring + Math.sin(an) * rr, 0.03]; B.poly('stoneDress', [q(a0, r), q(a0, r + A.ring), q(a1, r + A.ring), q(a1, r)], [0, 0, 1]); }
      for (const sx of [-1, 1]) B.poly('stoneDress', [[sc + sx * G.w / 2, Y.impost[0], -A.d + 0.04], [sc + sx * r, Y.impost[0], -A.d + 0.04], [sc + sx * r, Y.impost[1], -A.d + 0.04], [sc + sx * G.w / 2, Y.impost[1], -A.d + 0.04]], [0, 0, 1]);
      if (door) {
        // the staircase's number on a disc at the recess's crown; two steps and a slab up to the threshold
        B.sign('signs', sc - 0.17, G.spring + G.w / 2 + 0.01, sc + 0.17, G.spring + G.w / 2 + 0.35, -A.d + 0.02, atlas.uv('num' + door));
        const h = (Y.floor - T) / 3;
        blk('pavingSolid', sc - 0.75, sc + 0.75, 0, Y.floor - h, -A.d, 0.3, 'ftlr'); blk('pavingSolid', sc - 0.75, sc + 0.75, 0, Y.floor - 2 * h, 0.3, 0.68, 'ftlr');
      }
    }
    B.pop();
    // ---- the plat band
    B.push(F); blk('stoneDress', 0, len, Y.band[0], Y.band[1], centre ? 0 : -P.d, 0.1, centre ? 'ftblr' : 'ftb'); B.pop();      // (the centre's stops at its own face: its ends lay in the break's returns)
    // ---- the upper storeys
    if (!centre) {
      // flanks: each bay's two windows stand in one sunk panel; the piers between run up to the frieze
      const Fp = frame(a, 0, vS - P.d, 1, 0), up = [];
      for (const [u, i] of list) { const sc = u - a; up.push({ pts: rectPts(sc - Y.f1.w / 2, Y.f1.y0, sc + Y.f1.w / 2, Y.f1.y1), kind: 'win', d: TERR.rec.f1 - P.d + 0.02, sill: false, seed: 100 + i }, { pts: rectPts(sc - Y.f2.w / 2, Y.f2.y0, sc + Y.f2.w / 2, Y.f2.y1), kind: 'win', d: TERR.rec.f1 - P.d + 0.02, sill: false, seed: 200 + i }); }
      wall(B, Fp, outline(0, len, Y.band[1], P.y1 + 0.02), up, 'stone');
      B.push(Fp);
      let prev = 0;
      const pier = (x0, x1) => { if (x1 - x0 > 0.02) blk('stone', x0, x1, Y.band[1], P.y1, 0, P.d, (x0 > 0.01 ? 'l' : '') + 'f' + (x1 < len - 0.01 ? 'r' : '')); };
      for (const [u] of list) { const sc = u - a; pier(prev, sc - P.w / 2); prev = sc + P.w / 2;
        B.poly('stone', [[sc - P.w / 2, P.y1, 0], [sc + P.w / 2, P.y1, 0], [sc + P.w / 2, P.y1, P.d], [sc - P.w / 2, P.y1, P.d]], [0, -1, 0]);      // the panel's head
        blk('stone', sc - 0.6, sc + 0.6, Y.apron[0], Y.apron[1], 0, 0.045, 'fblr');                    // the apron block
        blk('stoneDress', sc - 0.68, sc + 0.68, Y.apron[1], Y.f2.y0, 0, 0.13, 'fblr');                 // … and the sill on it
      }
      pier(prev, len);
      blk('stone', 0, len, P.y1, Y.cornice, 0, P.d, 'f');      // the frieze over the panels, up behind the cornice
      B.pop();
    } else {
      // the centre: plain ashlar, moulded architraves, a cornice on consoles over each first-floor window
      const up = [], dy = Y.centreUp;
      for (const [u, i] of list) { const sc = u - a; up.push({ pts: rectPts(sc - Y.f1.w / 2, Y.f1.y0 + dy, sc + Y.f1.w / 2, Y.f1.y1 + dy), kind: 'win', d: TERR.rec.f1 + 0.02, sill: false, seed: 100 + i }, { pts: rectPts(sc - Y.f2.w / 2, Y.f2.y0 + dy, sc + Y.f2.w / 2, Y.f2.y1 + dy), kind: 'win', d: TERR.rec.f1 + 0.02, sill: false, seed: 200 + i }); }
      const Fu = frame(a, 0, vS + out, 1, 0);
      wall(B, Fu, outline(0, len, Y.band[1], Y.cornice), up, 'stone');
      B.push(Fu);
      for (const [u] of list) { const sc = u - a;
        ring(sc, Y.f1.w, Y.f1.y0 + dy, Y.f1.y1 + dy); ring(sc, Y.f2.w, Y.f2.y0 + dy, Y.f2.y1 + dy);
        blk('stoneDress', sc - 0.9, sc + 0.9, Y.hood[0] + dy, Y.hood[1] + dy, 0, 0.26, 'ftblr');
        for (const sx of [-1, 1]) blk('stoneDress', sc + sx * 0.74 - 0.07, sc + sx * 0.74 + 0.07, Y.hood[0] + dy - 0.36, Y.hood[0] + dy, 0, 0.15, 'fblr');
        blk('stoneDress', sc - 0.7, sc + 0.7, Y.f2.y0 + dy - 0.16, Y.f2.y0 + dy - 0.06, 0, 0.12, 'fblr');
      }
      for (const [s, n] of [[0, -1], [len, 1]]) B.poly('stone', [[s, 0, -out], [s, 0, 0], [s, Y.cornice, 0], [s, Y.cornice, -out]], [n, 0, 0]);      // the break's returns
      B.pop();
    }
    // ---- the modillion cornice: bed mould, brackets, the corona; the flanks' blocking course
    B.push(F);
    const cw = a === u0 ? 0 : centre ? -Y.co : Y.co, ce = b === u1 ? len + 0.5 : centre ? len + Y.co : len - Y.co;      // (the centre's corona returns over the flanks'; the east end's runs round the corner)
    blk('stoneDress', 0, len, Y.bed, Y.mod[0], 0, Y.bo, centre ? 'fblr' : 'fb');
    { const n = Math.max(1, Math.round(len / 0.46)); for (let k = 0; k < n; k++) { const x = (len * (k + 0.5)) / n; blk('stoneDress', x - 0.1, x + 0.1, Y.mod[0], Y.mod[1], Y.bo, Y.co - 0.06, 'fblr'); } }
    blk('stoneDress', cw, ce, Y.cornice, Y.corniceTop, centre ? -out : 0, Y.co, centre ? 'ftblr' : 'ftb' + (b === u1 ? 'r' : ''));
    if (!centre) blk('stoneBase', 0, len, Y.corniceTop, Y.blocking, -0.35, 0.05, 'ftk');
    B.pop();
    if (centre) pediment(B, frame(a, 0, vS + out + Y.co - 0.455, 1, 0), -Y.co + 0.35, len + Y.co - 0.35, Y.corniceTop, Y.apex - Y.corniceTop - 0.4, 'stoneSlate');
  }
  // wall lanterns (TERR.lanterns), planting against the wall between the doorways
  for (const q of TERR.lanterns) lantern(B, q.u, TERR.lanternY, vS + (q.u > C0 && q.u < C1 ? OUT : 0), 0, 1);
  {
    const doorU = Object.keys(TERR.doors).map((i) => TERR.bays[+i]).sort((p, q) => p - q), cuts = [u0 + 0.9, ...doorU.flatMap((u) => [u - 1.0, u + 1.0]), u1 - 0.2];
    for (let k = 0; k < cuts.length; k += 2) { const a = cuts[k], b = cuts[k + 1]; if (b - a < 0.5) continue; for (const [x0, x1] of [[a, Math.min(b, C0)], [Math.max(a, C0), Math.min(b, C1)], [Math.max(a, C1), b]]) { if (x1 - x0 < 0.3) continue; const o = x0 >= C0 - 1e-6 && x1 <= C1 + 1e-6 ? OUT : 0; B.flat('flowerbed', [[x0, vS + o], [x1, vS + o], [x1, vS + o + 0.85], [x0, vS + o + 0.85]], T + 0.012); } }
    const LEAF = ['leafA', 'leafB', 'leafC'], FLO = ['flP', null, 'flW', null, 'flR', null];
    [-48.6, -41.7, -37.5, -34.6, -26.0, -23.2, -17.3, -10.3, -7.6, -3.4].forEach((u, i) => plant(B, u, vS + (u > C0 && u < C1 ? OUT : 0) + 0.42, T + 0.01, 0.4 + (i % 3) * 0.06, 0.7 + (i % 4) * 0.22, LEAF[i % 3], FLO[i % 6], i * 1.9));
  }

  // ================================================================= THE NORTH FACE (to Provost's Yard and the Fellows' Garden)
  const yardDoor = S6.yardDoor;
  for (const [a, b, out] of [[C1, u1, 0], [C0, C1, OUT], [u0, C0, 0]]) {
    const len = b - a, F = frame(b, 0, vN - out, -1, 0), sOf = (u) => b - u, list = baysIn(a, b), centre = out > 0;
    const foot = a < NF.yard.u1 ? NF.yard.foot : NF.garden.foot;
    // ---- the basement storey: coursed rubble; the yard door of Staircase 6, the basement lights under the veranda
    const low = [], notch = [];
    if (yardDoor.u0 > a && yardDoor.u1 < b) { const pts = rectPts(sOf(yardDoor.u1), foot, sOf(yardDoor.u0), S6.y1 + yardDoor.h); low.push({ pts, kind: 'void', d: S6.foot.v0 - vN, notch: true, revealKey: 'stoneLit' }); notch.push(pts); }
    const lights = [];
    if (NF.lights.u0 > a && NF.lights.u1 < b) for (let k = 0; k < NF.lights.n; k++) { const c = sOf(NF.lights.u0 + ((NF.lights.u1 - NF.lights.u0) * (k + 0.5)) / NF.lights.n), w = ((NF.lights.u1 - NF.lights.u0) / NF.lights.n) - 0.22; lights.push([c, w]); low.push({ pts: rectPts(c - w / 2, NF.lights.y0, c + w / 2, NF.lights.y1), kind: 'win', d: 0.12, sill: false, rows: 1, lit: true }); }
    wall(B, F, outline(0, len, foot, NF.plinth, notch), low, 'rubble');
    // ---- above it: weathered ashlar, sashes in plain frames on bracketed sills (bay 1 the stair's tall window, bay 2 blind)
    const ops = [], frames = [];
    for (const [u, i] of list) {
      const sc = sOf(u), g = i === NF.tall.bay ? NF.tall : NF.gw;
      if (!NF.blind.includes(i)) ops.push({ pts: rectPts(sc - NF.gw.w / 2, g.y0, sc + NF.gw.w / 2, g.y1), kind: 'win', d: 0.18, sill: false, seed: 300 + i });
      frames.push([sc, NF.gw.w, g.y0, g.y1, true, u < NF.yard.u1 + 6]);
      for (const f of [Y.f1, Y.f2]) { ops.push({ pts: rectPts(sc - f.w / 2, f.y0, sc + f.w / 2, f.y1), kind: 'win', d: 0.18, sill: false, seed: 400 + i + f.y0 }); frames.push([sc, f.w, f.y0, f.y1, f === Y.f2, false]); }
    }
    wall(B, F, outline(0, len, NF.plinth, Y.cornice), ops, 'stoneOld');
    B.push(F);
    for (const [c, w] of lights) B.face('white', rectPts(c - w / 2 - 0.07, NF.lights.y0 - 0.07, c + w / 2 + 0.07, NF.lights.y1 + 0.07), [rectPts(c - w / 2, NF.lights.y0, c + w / 2, NF.lights.y1)], 0.02);
    for (const [sc, w, y0, y1, sill, brackets] of frames) {
      ring(sc, w, y0, y1, 0.13);
      if (sill) blk('stoneDress', sc - w / 2 - 0.2, sc + w / 2 + 0.2, y0 - 0.19, y0 - 0.08, 0, 0.16, 'ftblr');
      if (brackets) for (const sx of [-1, 1]) blk('stoneDress', sc + sx * (w / 2 + 0.02) - 0.07, sc + sx * (w / 2 + 0.02) + 0.07, y0 - 0.45, y0 - 0.19, 0, 0.12, 'fblr');
    }
    blk('stoneDress', 0, len, NF.plinth - 0.1, NF.plinth + 0.12, 0, 0.07, centre ? 'ftblr' : 'ftb');      // the band over the basement
    blk('stoneDress', 0, len, Y.band[0], Y.band[1], 0, 0.09, centre ? 'ftblr' : 'ftb');
    blk('stoneDress', centre ? -NF.co : (b === u1 ? -NF.co : NF.co), centre ? len + NF.co : len - (a === u0 ? 0 : NF.co), Y.cornice, Y.corniceTop, centre ? -out : 0, NF.co, centre ? 'ftblr' : 'ftb' + (b === u1 ? 'l' : ''));      // a plainer cornice
    if (!centre) blk('stoneBase', 0, len, Y.corniceTop, Y.blocking, -0.35, 0.05, 'ftk');
    if (centre) for (const [s, n] of [[0, -1], [len, 1]]) B.poly('stoneOld', [[s, foot, -out], [s, foot, 0], [s, Y.cornice, 0], [s, Y.cornice, -out]], [n, 0, 0]);
    B.pop();
    if (centre) pediment(B, frame(b, 0, vN - out - NF.co + 0.455, -1, 0), -NF.co + 0.35, len + NF.co - 0.35, Y.corniceTop, Y.apex - Y.corniceTop - 0.4, 'stoneSlate');
  }

  // ================================================================= THE ENDS, THE ROOF, DORMERS, STACKS
  const R = Y.roof, vc = (vS + vN) / 2, yF = Y.blocking - 0.05;
  {
    const sec = [[vS - R.foot, yF], [vS - R.knee, R.kneeY], [vc, R.ridge], [vN + R.knee, R.kneeY], [vN + R.foot, yF]];      // the roof's section, south to north
    // the east end: its wall (the old range's junction block stands against its middle), the cornice returned, the
    // roof's upright end; the west end stands against the Lodgings' wall: only the roof's end shows above it
    wall(B, frame(u1, 0, vS, 0, -1), outline(0, vS - vN, NF.garden.foot, yF), [], 'stone');
    B.push(frame(u1, 0, vS, 0, -1)); blk('stoneDress', 0, vS - vN, Y.cornice, Y.corniceTop, 0, 0.5, 'ftb'); B.pop();
    B.poly('stone', sec.map(([v, y]) => [u1, y, v]), [1, 0, 0]);
    B.poly('stone', [[u0, Y.corniceTop - 0.2, vS - R.foot], ...sec.map(([v, y]) => [u0, y, v]), [u0, Y.corniceTop - 0.2, vN + R.foot]], [-1, 0, 0]);
    for (let k = 0; k < 4; k++) {
      const [va, ya] = sec[k], [vb, yb] = sec[k + 1];
      B.poly(k === 0 || k === 3 ? 'stoneSlate' : TOP, [[u0, ya, va], [u1, ya, va], [u1, yb, vb], [u0, yb, vb]], [0, 1, k < 2 ? 1 : -1]);
    }
  }
  {
    // flat-topped dormers, white, one to each flank bay on both steep slopes
    const D = Y.dormer, slope = (R.kneeY - yF) / (R.knee - R.foot), dF = 0.45, dB = R.foot + (D.lid - 0.05 - yF) / slope, yS = yF + (dF - R.foot) * slope;
    for (const [u, i] of TERR.bays.map((q, k) => [q, k])) {
      if (i >= 8 && i <= 10) continue;
      for (const [vf, sg] of [[vS, -1], [vN, 1]]) {      // (sg: which way is "in" along v)
        const f = vf + sg * dF, bk = vf + sg * dB, yT = D.lid - 0.05, hw = D.w / 2;
        B.poly('white', [[u - hw, yS, f], [u + hw, yS, f], [u + hw, yT, f], [u - hw, yT, f]], [0, 0, -sg]);
        B.push(frame(sg < 0 ? u - hw : u + hw, 0, f, -sg, 0)); B.unit('sashAttic', rectPts(0.14, D.y0, D.w - 0.14, D.y1), 0.012, nextBay(D.y0)); B.pop();
        for (const sx of [-1, 1]) B.poly('white', [[u + sx * hw, yS, f], [u + sx * hw, yT, f], [u + sx * hw, yT, bk]], [sx, 0, 0]);
        const lw = D.lidW / 2, fo = f - sg * 0.12, bo = bk + sg * 0.05;
        B.poly('lead', [[u - lw, D.lid, fo], [u + lw, D.lid, fo], [u + lw, D.lid, bo], [u - lw, D.lid, bo]], [0, 1, 0]);
        B.poly('white', [[u - lw, yT, fo], [u + lw, yT, fo], [u + lw, yT, bo], [u - lw, yT, bo]], [0, -1, 0]);
        B.poly('white', [[u - lw, yT, fo], [u + lw, yT, fo], [u + lw, D.lid, fo], [u - lw, D.lid, fo]], [0, 0, -sg]);
      }
    }
    // the stacks on the spine wall: ashlar, a row of eight pots
    const S = Y.stack, sv = TERR.spineV;
    for (const u of TERR.stacks) {
      B.push(new THREE.Matrix4().makeTranslation(u, 0, sv));
      blk('stone', -S.w / 2, S.w / 2, R.kneeY, S.top, -S.d / 2, S.d / 2, 'fklr'); blk('stoneDress', -S.w / 2 - 0.07, S.w / 2 + 0.07, S.top, S.top + 0.14, -S.d / 2 - 0.07, S.d / 2 + 0.07, 'fktlr');
      for (let k = 0; k < S.pots; k++) B.cyl('plaster', -S.w / 2 + (S.w * (k + 0.5)) / S.pots, S.top + 0.14, 0, 0.11, 0.5 + (k % 3) * 0.06, 5, false, 0.15);
      B.pop();
    }
  }

  // ================================================================= STAIRCASE 6: the way down through the range
  {
    const H = S6.hall, F = S6.flight, Lk = S6.link, TP = S6.top, FT = S6.foot, y0 = S6.y0, y1 = S6.y1, CE = S6.ceil, CL = S6.ceilLow, hd = y0 + 2.3;
    const vDrop = F.v0 + (F.v1 - F.v0) * ((CL - 2.1 - y1) / (y0 - y1));      // where the flight has 2.1 m under the ground floor
    const yAt = (v) => (v >= F.v1 ? y0 : v <= F.v0 ? y1 : y1 + (y0 - y1) * (v - F.v0) / (F.v1 - F.v0));
    const WK = 'plaster', FK = 'pavingSolid';      // (painted walls, flags; the plain keys: the brightened ones burnt white under the stair's lamp at night)
    // floors: the hall, the opening, the landing; the flight's treads and risers; the lobby and the doorway
    B.flat(FK, [[H.u0, H.v0], [H.u1, H.v0], [H.u1, H.v1], [H.u0, H.v1]], y0);
    B.flat(FK, [[H.u1, Lk.v0], [F.u0, Lk.v0], [F.u0, Lk.v1], [H.u1, Lk.v1]], y0);
    B.flat(FK, [[TP.u0, TP.v0], [TP.u1, TP.v0], [TP.u1, TP.v1], [TP.u0, TP.v1]], y0);
    for (let k = 0; k < F.n; k++) { const va = F.v1 - ((F.v1 - F.v0) * k) / F.n, vb = F.v1 - ((F.v1 - F.v0) * (k + 1)) / F.n, y = y0 - S6.rise * (k + 1);
      B.poly(FK, [[F.u0, y + S6.rise, va], [F.u1, y + S6.rise, va], [F.u1, y, va], [F.u0, y, va]], [0, 0, -1]);
      B.poly(FK, [[F.u0, y, va], [F.u1, y, va], [F.u1, y, vb], [F.u0, y, vb]], [0, 1, 0]); }
    B.flat(FK, [[FT.u0, vN + 0.01], [FT.u1, vN + 0.01], [FT.u1, FT.v1], [FT.u0, FT.v1]], y1);
    // the hall: west and north walls, the front wall's inside with the doorway, the east wall with the opening
    B.poly(WK, [[H.u0, y0, H.v0], [H.u0, y0, H.v1], [H.u0, CE, H.v1], [H.u0, CE, H.v0]], [1, 0, 0]);
    B.poly(WK, [[H.u0, y0, H.v0], [H.u1, y0, H.v0], [H.u1, CE, H.v0], [H.u0, CE, H.v0]], [0, 0, 1]);
    { const d = archPts(H.u1 - S6.door.u, S6.door.w, y0, Y.gw.spring, 8); B.push(frame(H.u1, 0, H.v1, -1, 0)); B.face(WK, outline(0, H.u1 - H.u0, y0, CE, [d])); B.pop(); }
    { const n = rectPts(Lk.v0 - H.v0, y0, Lk.v1 - H.v0, hd); B.push(frame(H.u1, 0, H.v0, 0, 1)); B.face(WK, outline(0, H.v1 - H.v0, y0, CE, [n])); B.pop(); }
    B.flat(WK, [[H.u0, H.v0], [H.u1, H.v0], [H.u1, H.v1], [H.u0, H.v1]], CE, [], true);
    // the opening's jambs and soffit
    B.poly(WK, [[H.u1, y0, Lk.v0], [F.u0, y0, Lk.v0], [F.u0, hd, Lk.v0], [H.u1, hd, Lk.v0]], [0, 0, 1]);
    B.poly(WK, [[H.u1, y0, Lk.v1], [F.u0, y0, Lk.v1], [F.u0, hd, Lk.v1], [H.u1, hd, Lk.v1]], [0, 0, -1]);
    B.poly(WK, [[H.u1, hd, Lk.v0], [F.u0, hd, Lk.v0], [F.u0, hd, Lk.v1], [H.u1, hd, Lk.v1]], [0, -1, 0]);
    // the stair: its two side walls (the west one with the opening), the south end, the ceilings, the wall over the door
    { const n = rectPts(TP.v1 - Lk.v1, y0, TP.v1 - Lk.v0, hd); B.push(frame(F.u0, 0, TP.v1, 0, -1)); B.face(WK, outline(0, TP.v1 - TP.v0, y0, CE, [n])); B.pop(); }
    B.poly(WK, [[F.u1, y0, TP.v1], [F.u1, y0, TP.v0], [F.u1, CE, TP.v0], [F.u1, CE, TP.v1]], [-1, 0, 0]);
    for (const [u, n] of [[F.u0, 1], [F.u1, -1]]) {
      // (down to a riser below the nosings' line: the treads step under it)
      B.poly(WK, [[u, y0 - S6.rise, F.v1], [u, yAt(vDrop) - S6.rise, vDrop], [u, CE, vDrop], [u, CE, F.v1]], [n, 0, 0]);
      B.poly(WK, [[u, yAt(vDrop) - S6.rise, vDrop], [u, y1 - S6.rise, F.v0], [u, y1 - S6.rise, FT.v0], [u, CL, FT.v0], [u, CL, vDrop]], [n, 0, 0]);
    }
    B.poly(WK, [[F.u0, y0, TP.v1], [F.u1, y0, TP.v1], [F.u1, CE, TP.v1], [F.u0, CE, TP.v1]], [0, 0, -1]);
    B.flat(WK, [[F.u0, vDrop], [F.u1, vDrop], [F.u1, TP.v1], [F.u0, TP.v1]], CE, [], true);
    B.poly(WK, [[F.u0, CL, vDrop], [F.u1, CL, vDrop], [F.u1, CE, vDrop], [F.u0, CE, vDrop]], [0, 0, 1]);
    B.flat(WK, [[F.u0, FT.v0], [F.u1, FT.v0], [F.u1, vDrop], [F.u0, vDrop]], CL, [], true);
    B.poly(WK, [[F.u0, y1 + S6.yardDoor.h, FT.v0], [F.u1, y1 + S6.yardDoor.h, FT.v0], [F.u1, CL, FT.v0], [F.u0, CL, FT.v0]], [0, 0, 1]);
    // the yard door's blue-grey glazed leaves, folded back against the lobby's walls; a handrail down each side
    B.push(frame(F.u0 + 0.05, 0, FT.v0 + 0.92, 0, -1)); B.unit('doorGrey', rectPts(0, y1, 0.86, y1 + S6.yardDoor.h - 0.1), 0); B.pop();
    B.push(frame(F.u1 - 0.05, 0, FT.v0 + 0.06, 0, 1)); B.unit('doorGrey', rectPts(0, y1, 0.86, y1 + S6.yardDoor.h - 0.1), 0); B.pop();
    for (const u of [F.u0 + 0.06, F.u1 - 0.06]) B.beam('iron', [u, y0 + 0.95, F.v1], [u, y1 + 0.95, F.v0], 0.04);
    lamps.push([(F.u0 + F.u1) / 2, vDrop + 1.2, CE - 0.5]);      // ONE light, over the flight (G: a staircase is lit; three in this small space burnt the picture white at night)
    // colliders: the hall, the wall between it and the stair with its opening, the stair's sides
    const hw = S6.door.w / 2, du = S6.door.u;
    pl([[du - hw, vS], [du - hw, H.v1], [H.u0, H.v1], [H.u0, H.v0], [H.u1, H.v0], [H.u1, Lk.v0], [F.u0, Lk.v0], [F.u0, vN]]);
    pl([[du + hw, vS], [du + hw, H.v1], [H.u1, H.v1], [H.u1, Lk.v1], [F.u0, Lk.v1], [F.u0, TP.v1], [F.u1, TP.v1], [F.u1, vN]]);
  }

  // ================================================================= colliders: the range's walls
  {
    const hw = S6.door.w / 2, du = S6.door.u;
    pl([[u0, vN], [u0, vS], [du - hw, vS]]); pl([[du + hw, vS], [C0, vS], [C0, vS + OUT], [C1, vS + OUT], [C1, vS], [u1, vS], [u1, SCR.j.v1]]);
    pl([[u0, vN], [yardDoor.u0, vN]]); pl([[yardDoor.u1, vN], [C0, vN], [C0, vN - OUT], [C1, vN - OUT], [C1, vN], [u1, vN], [u1, SCR.j.v0]]);
  }

  // ================================================================= THE SCREEN AND THE SLIP (the quad's north-east corner)
  {
    const L = SLIP.v1 - SLIP.v0, sa = SLIP.arch.v - SLIP.v0, arch = archPts(sa, SLIP.arch.w, T - 0.02, SLIP.arch.spring, 10), th = 0.5;
    const Fw = frame(SLIP.u0, 0, SLIP.v0, 0, 1);      // s south from the Terrace's face, out = west
    wall(B, Fw, outline(0, L, 0, SLIP.top, [arch]), [{ pts: arch, kind: 'void', d: th, notch: true, revealKey: 'stoneLit' }], 'stoneIvyM');
    B.push(Fw);
    { const q = (an, rr) => [sa + Math.cos(an) * rr, SLIP.arch.spring + Math.sin(an) * rr, 0.03], r = SLIP.arch.w / 2; for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI, a1 = ((k + 1) / 8) * Math.PI; B.poly('stoneDress', [q(a0, r), q(a0, Math.min(r + 0.22, L / 2)), q(a1, Math.min(r + 0.22, L / 2)), q(a1, r)], [0, 0, 1]); } }
    B.push(new THREE.Matrix4().makeTranslation(0, 0, -th)); B.face('rubble', outline(0, L, 0, SLIP.top, [arch]), [], 0, true); B.pop();
    blk('stoneDress', 0, L, SLIP.top, SLIP.top + 0.12, -th - 0.04, 0.05, 'fkt');
    B.pop();
    seg(SLIP.u0, SLIP.v0, SLIP.u0, SLIP.arch.v - SLIP.arch.w / 2); seg(SLIP.u0, SLIP.arch.v + SLIP.arch.w / 2, SLIP.u0, SLIP.v1);
    // the slip behind it: flags, a flat lead roof at first-floor level, a shut door at its far end
    const vn = SCR.j.v1, ue = SLIP.u1;
    B.boxXZ('pavingLit', SLIP.u0 + 0.01, ue, 0, T, vn, SLIP.v1 - 0.01);
    B.flat('plasterLit', [[u1 + 0.02, vn], [ue, vn], [ue, SLIP.v1], [u1 + 0.02, SLIP.v1]], SLIP.roof.y - 0.1, [], true);
    B.flat('lead', [[u1 + 0.02, vn - 0.05], [SLIP.roof.u1, vn - 0.05], [SLIP.roof.u1, SLIP.v1 - 0.02], [u1 + 0.02, SLIP.v1 - 0.02]], SLIP.roof.y);
    B.poly('lead', [[SLIP.roof.u1, SLIP.roof.y - 0.12, vn], [SLIP.roof.u1, SLIP.roof.y - 0.12, SLIP.v1], [SLIP.roof.u1, SLIP.roof.y, SLIP.v1], [SLIP.roof.u1, SLIP.roof.y, vn]], [1, 0, 0]);
    B.push(frame(ue, 0, vn, 0, 1)); B.face('rubbleLit', rectPts(0, 0, SLIP.v1 - vn, SLIP.roof.y - 0.1), [rectPts(0.75, T, 1.75, T + 2.1)]); B.unit('doorOak', rectPts(0.75, T, 1.75, T + 2.1), -0.06); B.reveal('rubbleLit', rectPts(0.75, T, 1.75, T + 2.1), 0, -0.06, true); B.pop();
    seg(ue, vn, ue, SLIP.v1);
  }

  // ================================================================= THE SENIOR COMMON ROOM RANGE
  {
    const J = SCR.j, W = SCR.w, E = SCR.eaves, RG = SCR.ridge, gf = SCR.garden.foot;
    const lead2 = (o) => ({ kind: 'win', mullion: 2, d: 0.2, sill: false, ...o });
    // ---- the junction block against the Terrace's end (Staircase 2): tall, flat-roofed
    wall(B, frame(J.u0, 0, J.v1, 1, 0), outline(0, J.u1 - J.u0, 0, J.h), [{ pts: rectPts(0.65, T, 1.65, T + 2.1), kind: 'door', d: 0.2 }, { pts: rectPts(0.7, 6.2, 1.6, 7.7), kind: 'win', sill: false }, { pts: rectPts(0.7, 9.0, 1.6, 10.3), kind: 'win', sill: false, rows: 2 }], 'rubbleLit');
    wall(B, frame(J.u1, 0, J.v0, -1, 0), outline(0, J.u1 - J.u0, NF.garden.foot, J.h), [{ pts: rectPts(0.7, 5.6, 1.6, 7.1), kind: 'win', sill: false }], 'rubble');
    wall(B, frame(J.u1, 0, J.v1, 0, -1), outline(0, J.v1 - J.v0, W.eaves - 0.5, J.h), [], 'rubble');
    B.flat('lead', [[J.u0, J.v0], [J.u1, J.v0], [J.u1, J.v1], [J.u0, J.v1]], J.roof);
    B.push(new THREE.Matrix4().makeTranslation((J.u0 + J.u1) / 2, 0, (J.v0 + J.v1) / 2)); blk('stoneDress', -(J.u1 - J.u0) / 2 - 0.08, (J.u1 - J.u0) / 2 + 0.08, J.h, J.roof + 0.02, -(J.v1 - J.v0) / 2 - 0.08, (J.v1 - J.v0) / 2 + 0.08, 'fkrb'); B.pop();
    /** a length of the old range from ua to ub: its two long walls on the skewed lines, a gabled stone-slate roof */
    const piece = (ua, ub, eaves, ridge, opsS, opsN) => {
      const sa = [ua, scrS(ua)], sb = [ub, scrS(ub)], na = [ua, scrN(ua)], nb = [ub, scrN(ub)], Ls = Math.hypot(sb[0] - sa[0], sb[1] - sa[1]), Ln = Math.hypot(nb[0] - na[0], nb[1] - na[1]);
      wall(B, frame(sa[0], 0, sa[1], sb[0] - sa[0], sb[1] - sa[1]), outline(0, Ls, 0, eaves), opsS, 'rubbleLit');      // (the slip's side: never in the sun)
      wall(B, frame(nb[0], 0, nb[1], na[0] - nb[0], na[1] - nb[1]), outline(0, Ln, gf, eaves), opsN, 'rubble');
      const o = SCR.ov, ra = [ua, (sa[1] + na[1]) / 2], rb = [ub, (sb[1] + nb[1]) / 2], k = (ridge - eaves) / ((sa[1] - na[1]) / 2), ye = eaves - o * k;
      B.poly('stoneSlate', [[sa[0], ye, sa[1] + o], [sb[0], ye, sb[1] + o], [rb[0], ridge, rb[1]], [ra[0], ridge, ra[1]]], [0, 1, 1]);
      B.poly('stoneSlate', [[nb[0], ye, nb[1] - o], [na[0], ye, na[1] - o], [ra[0], ridge, ra[1]], [rb[0], ridge, rb[1]]], [0, 1, -1]);
      return { sa, sb, na, nb, ra, rb };
    };
    // ---- its taller west end, with a gablet to the slip and the red-brick stack
    const PW = piece(W.u0, W.u1, W.eaves, W.ridge, [lead2({ pts: rectPts(0.9, 1.2, 2.1, 2.3) }), lead2({ pts: rectPts(0.9, 3.9, 2.1, 5.0) })], [lead2({ pts: rectPts(0.9, 1.0, 2.1, 2.1) }), lead2({ pts: rectPts(0.9, 3.9, 2.1, 5.0) })]);
    B.poly('rubble', [[W.u1, E - 0.4, PW.sb[1]], [W.u1, E - 0.4, PW.nb[1]], [W.u1, W.eaves, PW.nb[1]], [W.u1, W.ridge, PW.rb[1]], [W.u1, W.eaves, PW.sb[1]]], [1, 0, 0]);      // its east gable over the main range's roof
    { const gu = 5.9, gv = scrS(gu), w = 0.75, yb = W.eaves - 0.3, yt = W.eaves + 1.1, ap = yt + 0.75;      // the gablet (K: seen over the screen wall in the 2014 photograph)
      B.poly('rubbleLit', [[gu - w, yb, gv + 0.02], [gu + w, yb, gv + 0.02], [gu + w, yt, gv + 0.02], [gu, ap, gv + 0.02], [gu - w, yt, gv + 0.02]], [0, 0, 1]);
      B.push(frame(gu - w, 0, gv + 0.02, 1, 0)); B.unit('leaded', rectPts(0.35, yb + 0.45, 2 * w - 0.35, yt + 0.1), 0.012, nextBay(yt)); B.pop();
      for (const sx of [-1, 1]) B.poly('stoneSlate', [[gu + sx * (w + 0.12), yt - 0.1, gv + 0.14], [gu, ap + 0.05, gv + 0.14], [gu, ap + 0.05, gv - 2.3], [gu + sx * (w + 0.12), yt - 0.1, gv - 2.3]], [sx, 1, 0]); }
    { const s = W.stack; B.boxXZ('redBrick', s.u - 0.45, s.u + 0.45, W.eaves + 1.5, s.top, s.v - 0.45, s.v + 0.45); for (const d of [-0.2, 0.2]) B.cyl('terracotta', s.u + d, s.top, s.v, 0.11, 0.45, 5, false, 0.14); }
    // ---- the main range to its gable on Walton Street
    const nWin = (x) => [lead2({ pts: rectPts(x - 0.6, gf + 2.2, x + 0.6, gf + 3.3) }), lead2({ pts: rectPts(x - 0.6, 2.9, x + 0.6, 4.0) })];
    const PM = piece(SCR.uM, SCR.u1, E, RG, [3.2, 9.6, 15.6].map((x) => lead2({ pts: rectPts(x - 0.55, 2.9, x + 0.55, 3.9) })), [2.6, 7.4, 12.4, 17.2].flatMap(nWin));
    // the gable: coursed rubble, windowless, on the pavement; the ashlar stack on its apex with three pots
    { const g = PM.sb[1] - PM.nb[1], GS = SCR.gableStack, rv = PM.rb[1];
      B.push(frame(SCR.u1, 0, PM.sb[1], 0, -1)); B.face('rubbleDk', [[0, 0], [g, 0], [g, E], [g / 2, RG], [0, E]]); B.pop();
      B.boxXZ('stone', SCR.u1 - GS.d, SCR.u1 + 0.02, RG - 0.9, GS.top, rv - GS.w / 2, rv + GS.w / 2);
      B.boxXZ('stoneDress', SCR.u1 - GS.d - 0.07, SCR.u1 + 0.09, GS.top, GS.top + 0.16, rv - GS.w / 2 - 0.07, rv + GS.w / 2 + 0.07, { bottom: true });
      B.cyl('plaster', SCR.u1 - GS.d / 2, GS.top + 0.16, rv - 0.26, 0.1, 0.75, 6, false, 0.12);
      for (const d of [0.02, 0.3]) B.cyl('terracotta', SCR.u1 - GS.d / 2, GS.top + 0.16, rv + d, 0.12, 0.42, 6, false, 0.15);
      // the wall that closes the slip's street end, between the gable and the Chapel's corner
      B.poly('rubbleDk', [[SCR.u1, 0, WB.vN], [SCR.u1, 0, PM.sb[1]], [SCR.u1, E - 0.4, PM.sb[1]], [SCR.u1, E - 0.4, WB.vN]], [1, 0, 0]);
      // … and the street wall carried from the gable's north corner to the old gateway's taller wall (v -27)
      B.boxXZ('rubbleDk', SCR.u1 - 0.6, SCR.u1 + 0.05, 0, 4.9, -26.99, PM.nb[1]);
      pl([[SCR.u1 + 0.05, PM.nb[1]], [SCR.u1 + 0.05, -27.0]], 'wall'); pl([[SCR.u1, WB.vN], [SCR.u1, PM.sb[1]]], 'wall');
    }
    // dormers: three gabled ones on the north slope, one on the south slope beside the gable
    const dormer = (u, north) => {
      const sg = north ? -1 : 1, base = north ? scrN(u) : scrS(u), rid = (scrN(u) + scrS(u)) / 2, k = (RG - E) / Math.abs(base - rid), f = base - sg * 0.9, w = 0.65, yb = E + 0.9 * k - 0.15, yt = yb + 1.15, ap = yt + 0.6, bk = base - sg * Math.min(Math.abs(base - rid) - 0.1, (ap - E) / k);
      B.poly(north ? 'rubble' : 'plaster', [[u - w, yb, f], [u + w, yb, f], [u + w, yt, f], [u, ap, f], [u - w, yt, f]], [0, 0, sg]);
      B.push(frame(north ? u + w : u - w, 0, f, north ? -1 : 1, 0)); B.unit('leaded', rectPts(0.28, yb + 0.25, 2 * w - 0.28, yt - 0.05), 0.012, nextBay(yt)); B.pop();
      for (const sx of [-1, 1]) { B.poly('stoneSlate', [[u + sx * (w + 0.1), yt - 0.08, f + sg * 0.12], [u, ap + 0.05, f + sg * 0.12], [u, ap + 0.05, bk], [u + sx * (w + 0.1), yt - 0.08, bk]], [sx, 1, 0]); B.poly(north ? 'rubble' : 'plaster', [[u + sx * w, yb, f], [u + sx * w, yt, f], [u + sx * w, yt, f - sg * (yt - yb) / k]], [sx, 0, 0]); }
    };
    for (const u of SCR.dormersN) dormer(u, true);
    dormer(SCR.dormerS, false);
    // colliders: the old range's outline
    pl([[u1, J.v1], [J.u1, J.v1], PW.sa, PM.sb, PM.nb, PW.na, [J.u1, J.v0], [u1, J.v0]]);
  }
  return { lamps };
}
