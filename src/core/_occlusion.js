// SOUND AND WALLS: one service for every positioned sound (core/audio.js spatial() hands each of its nodes to it).
// "could you make the 3d sound respect walls? ie not travel through walls."
//
// What it does. For each positioned sound it works out how much masonry stands between the source and the listener
// (the camera, as everywhere in the audio) and gives the node a GAIN and a LOW-PASS cutoff (core/audio.js keeps the two
// nodes: a biquad and a gain after the panner, made the first time a sound is found to be behind something — a sound
// that is never behind anything costs no node). Three cases, by where the two ends are:
//
//   both out of doors         lines at the world's walls (Collider.soundWalls: buildings, walls of 2.2 m or more; open
//                             passages — archways, gateways, open doorways — let a line through). First the straight
//                             line; if that is shut, four more from points a step to either side of the source and of
//                             the listener, so a corner opens by degrees. One wall = WALL; two or more = BUILDING.
//                             Then the archways and gateways near by: source -> passage -> listener, both lines clear,
//                             undoes the wall by how straight that way is (as a doorway does, below).
//   one in a walk-in room,    the room's wall stands between (WALL; BUILDING between two rooms with no door between them),
//   the other outside it      and its OPENINGS undo it: each doorway by how far its door stands open (core/_doors.js
//   (or in a room off it)     door.open; a shut leaf still leaks DOOR_SHUT, a glazed one DOOR_GLAZED), by how straight
//                             the way through it is (source -> doorway -> listener: straight = all of it, round a right
//                             angle = BEND) and by how near either end stands to it; each window as WINDOW of a door.
//   both in the same room     nothing between (a room's own collider does not say which of its shapes are walls and
//                             which are tables: rooms inside one registered interior are not separated — a limit).
//
// A sound with no place tag is taken to be where the listener is (core/audio.js): out of doors that is the world; in
// a room it is the room if the point lies inside the room's declared bounds, and outside it if not.
// Not asked: bells, far booms, birds and water (they come over the roofs: CLASS_SKIP), anything opts.occlude === false
// (the ambience's own scattered events — it has its own model), anything within NEAR metres, beyond RANGE, or HIGH
// metres above the listener; opts.occlude === 'out' is only asked while the listener is out of doors.
//
// Cost. A new sound is solved at once (a one-shot must not start loud and then duck), at most BIRTHS a frame, with a
// short memory of answers by place (footsteps and knocks from one spot share one). Sounds that last are looked at again
// in turn, at most PER_FRAME a frame, each no sooner than RETEST seconds after its last look. Each look is 1 line
// (in the clear) to 9 (behind something), each line walking only the collider cells it passes through.
// Changes are eased by the audio thread (setTargetAtTime, SMOOTH seconds): no steps, no clicks.
// game.audio.occlusion.stats has the measured cost; tools/smoke_occlusion.mjs is the test.

/** THE STRENGTHS — tune here. Gains are amplitudes (0.30 = -10.5 dB), cutoffs in Hz. */
export const OCC = {
  WALL_GAIN: 0.30, WALL_HZ: 900,            // one wall between: a garden / college wall, the wall of a room
  BUILDING_GAIN: 0.12, BUILDING_HZ: 500,    // two walls or more: a whole building between
  WINDOW: 0.4,                              // a window, as a share of an open doorway (glass: heard, but dulled)
  DOOR_SHUT: 0.1, DOOR_GLAZED: 0.3,         // what a shut door still lets through (oak / glass), as a share of open
  DOOR_OPEN_AT: 0.6,                        // a leaf this far open (0..1) counts as fully open to sound
  PASSAGE: 0.7,                             // an archway / gateway off the straight line, as a share of no wall at all (in line with it: no wall)
  BEND: 0.25,                               // what gets through a doorway round a right angle (1 = as much as straight through)
  SHADOWED: 0.25,                           // …and when the way from the doorway to the far end is itself behind a wall
  SIDE: 1.2,                                // m: the step to either side for the corner lines
  SMOOTH: 0.14,                             // s: the time constant every change is eased with
  OPEN_HZ: 20000,                           // the filter when nothing is in the way
  NEAR: 2.5, RANGE: 90, HIGH: 8,            // m: nearer than this never muffled; farther not asked; this far above: over the roofs
  PER_FRAME: 4, BIRTHS: 6, RETEST: 0.12,    // looks at lasting sounds a frame; new sounds solved a frame; s between looks at one sound
};
const CLASS_SKIP = { bell: true, boom: true, bird: true, water: true };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

export class Occlusion {
  constructor(game) {
    this.game = game; this.enabled = true; this.list = []; this.i = 0; this.frame = 0; this.births = 0;
    this.g = 1; this.hz = OCC.OPEN_HZ; this.why = '';      // (the last answer of solve())
    this.stats = { frames: 0, looks: 0, lines: 0, born: 0, cached: 0, ms: 0, maxMs: 0, live: 0, muffled: 0 };
    this._w = [0, 0]; this._w2 = [0, 0]; this._l = [0, 0]; this._best = [null, null, null];
    this._memo = new Map(); this._memoAt = -1; this._memoX = 0; this._memoZ = 0; this._memoP = null;
  }
  /** the listener: where (in its own frame), which place, that place's walk-in frame (or null) */
  _listener(A) {
    const g = this.game, place = A.framePlace || (g.player && g.player.place) || 'world';
    let S = null;
    if (place !== 'world') { const I = g.interiors, d = I && I.get ? I.get(place) : null; S = d && d.sl && d.sl.toWorld ? d.sl : null; this.ldef = d || null; } else this.ldef = null;
    this.lx = A._lx; this.lz = A._lz; this.lh = A._lh; this.lplace = place; this.lS = S;
  }
  _walls(x1, z1, x2, z2, max, passages, skipB = 0.75) {
    const wc = this.game.worldCollider; if (!wc || !wc.soundWalls) return 0;
    this.stats.lines++;
    return wc.soundWalls(x1, z1, x2, z2, max, passages, 0.3, skipB);
  }
  /** both ends out of doors (world coordinates) -> this.g / this.hz */
  _open(lx, lz, sx, sz) {
    const n0 = this._walls(lx, lz, sx, sz, 2, true);
    if (!n0) { this.g = 1; this.hz = OCC.OPEN_HZ; this.why = 'clear'; return; }
    // behind something: four more lines, from a step to either side of the source and of the listener (a point that
    // is itself through a wall from its end does not count: it takes the straight line's answer)
    const dx = sx - lx, dz = sz - lz, d = Math.hypot(dx, dz) || 1, px = (-dz / d) * OCC.SIDE, pz = (dx / d) * OCC.SIDE;
    let g = 2 * (n0 > 1 ? OCC.BUILDING_GAIN : OCC.WALL_GAIN), lhz = 2 * Math.log(n0 > 1 ? OCC.BUILDING_HZ : OCC.WALL_HZ), clear = 0;
    for (let k = 0; k < 4; k++) {
      const sgn = k & 1 ? -1 : 1, atSrc = k < 2;
      const ax = atSrc ? sx + px * sgn : lx + px * sgn, az = atSrc ? sz + pz * sgn : lz + pz * sgn;
      let n = n0;
      if (!this._walls(atSrc ? sx : lx, atSrc ? sz : lz, ax, az, 1, true, 0.05)) n = atSrc ? this._walls(lx, lz, ax, az, 2, true) : this._walls(ax, az, sx, sz, 2, true);
      if (!n) clear++;
      g += n === 0 ? 1 : n > 1 ? OCC.BUILDING_GAIN : OCC.WALL_GAIN; lhz += Math.log(n === 0 ? OCC.OPEN_HZ : n > 1 ? OCC.BUILDING_HZ : OCC.WALL_HZ);
    }
    g /= 6; lhz /= 6;
    const via = clear < 4 ? this._passages(lx, lz, sx, sz, d) : 0;      // (an archway or a gateway near by)
    if (via > 0) { g += (1 - g) * via; lhz += (Math.log(OCC.OPEN_HZ) - lhz) * via; }
    this.g = g; this.hz = Math.exp(lhz); this.why = (n0 > 1 ? 'building' : 'wall') + (clear ? ', ' + clear + '/4 round the corner' : '') + (via > 0 ? ', ' + Math.round(via * 100) + '% by a passage' : '');
  }
  /** how open to sound a doorway is: 0..1 */
  _door(P) {
    const D = P.doors || (P.door ? [P.door] : null);
    if (!D || !D.length) return P.open === false ? OCC.DOOR_SHUT : 1;
    let o = 0, glazed = false;
    for (let i = 0; i < D.length; i++) { const d = D[i], v = typeof d.open === 'number' ? d.open : d.passable ? 1 : 0; if (v > o) o = v; if (d.glazed) glazed = true; }
    const shut = glazed ? OCC.DOOR_GLAZED : OCC.DOOR_SHUT;
    return shut + (1 - shut) * clamp01(o / OCC.DOOR_OPEN_AT);
  }
  /** what an opening at (ax, az) lets through between an inner point and an outer one (all in the room's frame): 0..1 */
  _through(ax, az, ix, iz, ox, oz, nx = 0, nz = 0) {
    const vx = ix - ax, vz = iz - az, wx = ox - ax, wz = oz - az, di = Math.hypot(vx, vz), dout = Math.hypot(wx, wz);
    const near = Math.min(di, dout);
    if (near < 0.05) return 1;
    const c = -(vx * wx + vz * wz) / (di * dout);      // 1 = a straight line through the opening, 0 = a right angle, -1 = doubling back
    let f = c >= 0 ? OCC.BEND + (1 - OCC.BEND) * c : OCC.BEND * (1 + c);
    // (nx, nz) = the way the opening faces: an outer end that is BEHIND its wall (round the side of the building) gets a fifth of it
    if (nx || nz) f *= 0.2 + 0.8 * clamp01(((wx * nx + wz * nz) / dout + 0.3) / 0.3);
    return Math.max(f, clamp01(1 - near / 1.5));      // (standing at the opening, either side: all of it)
  }
  /**
   * Out of doors, the straight line shut: the ARCHWAYS and GATEWAYS near by (the collider's open passages). Sound goes
   * source -> the middle of the passage -> listener when both of those lines are clear, by how straight that way is.
   * -> 0..1: how much of the wall the best three undo.
   */
  _passages(lx, lz, sx, sz, d) {
    const wc = this.game.worldCollider, pg = wc && wc.pgrid; if (!pg || !pg.size || d > 70) return 0;
    const C = 8, K = (cx, cz) => cx * 73856093 ^ cz * 19349663, stamp = (this._pstamp = (this._pstamp || 0) + 1), B = this._best;
    B[0] = B[1] = B[2] = null; let b0 = 1e9, b1 = 1e9, b2 = 1e9;
    const x0 = Math.floor((Math.min(lx, sx) - 6) / C), x1 = Math.floor((Math.max(lx, sx) + 6) / C), z0 = Math.floor((Math.min(lz, sz) - 6) / C), z1 = Math.floor((Math.max(lz, sz) + 6) / C);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const a = pg.get(K(cx, cz)); if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const p = a[i]; if (p._om === stamp || !p.on) continue; p._om = stamp;
        const mx = (p.x1 + p.x2) / 2, mz = (p.z1 + p.z2) / 2, det = Math.hypot(mx - lx, mz - lz) + Math.hypot(mx - sx, mz - sz) - d;
        if (det > 14) continue;      // (a long way round: not this one)
        if (det < b0) { B[2] = B[1]; b2 = b1; B[1] = B[0]; b1 = b0; B[0] = p; b0 = det; } else if (det < b1) { B[2] = B[1]; b2 = b1; B[1] = p; b1 = det; } else if (det < b2) { B[2] = p; b2 = det; }
      }
    }
    let shut = 1;
    for (let i = 0; i < 3; i++) {
      const p = B[i]; if (!p) break;
      const mx = (p.x1 + p.x2) / 2, mz = (p.z1 + p.z2) / 2, end = p.r + Math.hypot(p.x2 - p.x1, p.z2 - p.z1) / 2;
      if (this._walls(lx, lz, mx, mz, 1, true, end) || this._walls(sx, sz, mx, mz, 1, true, end)) continue;
      // (an archway is a hole in a wall, not no wall: PASSAGE of it at best, and less the farther off the nearer end stands — 6 radii)
      const nearEnd = Math.min(Math.hypot(mx - lx, mz - lz), Math.hypot(mx - sx, mz - sz));
      const ap = OCC.PASSAGE * Math.min(1, (6 * p.r) / Math.max(0.1, nearEnd)), ex = sx - mx, ez = sz - mz, fx = lx - mx, fz = lz - mz;
      const c = -(ex * fx + ez * fz) / ((Math.hypot(ex, ez) || 1) * (Math.hypot(fx, fz) || 1));      // (all but in line with it: all but no wall, so that stepping off the line is not a step in the sound)
      shut *= 1 - this._through(mx, mz, sx, sz, lx, lz) * (ap + (1 - ap) * clamp01((c - 0.9) / 0.1));
    }
    return 1 - shut;
  }
  /**
   * One end in walk-in room `d` at (ix, iz) (room coordinates), the other outside it at world (owx, owz) (in the
   * world when `other` is null, else in the walk-in room `other`) -> this.g / this.hz
   */
  _room(d, ix, iz, owx, owz, other) {
    const S = d.sl, o = S.toLocal(owx, owz, this._l), ox = o[0], oz = o[1];
    let shut = 1;      // the share of the wall that is left after its openings: 1 = all wall
    let linked = false;
    for (let i = 0; i < S.portals.length; i++) {
      const P = S.portals[i];
      if (other ? P.off !== other.id : !!P.off) continue;
      linked = true;
      let leak = this._door(P) * this._through(P.at[0], P.at[1], ix, iz, ox, oz, P.dx, P.dz);
      if (!other && leak > 0.02) {      // is the way from the doorway to the far end itself shut off?
        const k = (P.depth || 0.3) + 0.6, w = S.toWorld(P.at[0] + P.dx * k, P.at[1] + P.dz * k, this._w2);
        const ex = owx - w[0], ez = owz - w[1], el = Math.hypot(ex, ez);
        if (el > 1.5 && this._walls(w[0], w[1], owx, owz, 1, true)) {      // (shut off: then a step either side of the far end — a pier in the way is not a wall in the way)
          const px = (-ez / el) * OCC.SIDE, pz = (ex / el) * OCC.SIDE;
          let hit = 2;
          if (this._walls(w[0], w[1], owx + px, owz + pz, 1, true, 0.05)) hit++;
          if (this._walls(w[0], w[1], owx - px, owz - pz, 1, true, 0.05)) hit++;
          leak *= 1 - (1 - OCC.SHADOWED) * (hit / 4);
        }
      }
      shut *= 1 - clamp01(leak);
    }
    if (other && !linked) {      // the door may be the other room's (it opens off this one)
      const T = other.sl;
      for (let i = 0; i < T.portals.length; i++) {
        const P = T.portals[i]; if (P.off !== d.id) continue;
        linked = true;
        const iw = S.toWorld(ix, iz, this._w2), a = T.toLocal(iw[0], iw[1], this._l), ax = a[0], az = a[1], b = T.toLocal(owx, owz, this._w2);
        shut *= 1 - clamp01(this._door(P) * this._through(P.at[0], P.at[1], b[0], b[1], ax, az));
      }
    }
    if (!other && S.openings) for (let i = 0; i < S.openings.length; i++) {
      const O = S.openings[i]; if (!O.at) continue;
      shut *= 1 - OCC.WINDOW * this._through(O.at[0], O.at[1], ix, iz, ox, oz, O.dx || 0, O.dz || 0);
    }
    // two rooms with no door between them: a building's worth. (Room against street is always ONE wall here: counting the
    // world's walls along the line was tried and flickered — a college range is an outline, an arcade and inner walls.)
    const deep = !!other && !linked;
    const G = deep ? OCC.BUILDING_GAIN : OCC.WALL_GAIN, HZ = deep ? OCC.BUILDING_HZ : OCC.WALL_HZ;
    this.g = 1 - (1 - G) * shut; this.hz = OCC.OPEN_HZ * Math.pow(HZ / OCC.OPEN_HZ, shut);
    this.why = (deep ? 'building' : 'room wall') + ' ' + Math.round((1 - shut) * 100) + '% open';
  }
  _inBounds(S, x, y, z) {
    const B = S.bounds; if (!B) return true;
    for (let i = 0; i < B.length; i++) { const b = B[i]; if (x >= b.x0 - 0.5 && x <= b.x1 + 0.5 && z >= b.z0 - 0.5 && z <= b.z1 + 0.5 && y >= (b.y0 ?? -1e9) - 1 && y <= (b.y1 ?? 1e9) + 2.5) return true; }
    return false;
  }
  /**
   * The answer for a source at (sx, sy, sz) in the LISTENER's frame, tagged `tag` (undefined = where the listener is,
   * 'world', or a room's id) -> this.g (gain 0..1), this.hz (cutoff), this.why. Call _listener(audio) first.
   */
  solve(sx, sy, sz, tag) {
    this.g = 1; this.hz = OCC.OPEN_HZ; this.why = 'near';
    const lx = this.lx, lz = this.lz, d = Math.hypot(sx - lx, sz - lz);
    if (!(d >= OCC.NEAR)) return;
    if (d > OCC.RANGE) { this.why = 'far'; return; }
    if (sy - this.lh > OCC.HIGH) { this.why = 'above'; return; }
    const I = this.game.interiors, S = this.lS, lp = this.lplace;
    if (lp === 'world') {
      const sd = tag && tag !== 'world' && I && I.get ? I.get(tag) : null;
      if (!sd || !sd.sl || !sd.sl.toLocal) { if (tag && tag !== 'world') { this.g = OCC.WALL_GAIN; this.hz = OCC.WALL_HZ; this.why = 'a place apart'; return; } this._open(lx, lz, sx, sz); return; }
      const l = sd.sl.toLocal(sx, sz, this._w); this._room(sd, l[0], l[1], lx, lz, null); return;
    }
    if (!S) { if (tag !== undefined && tag !== null && tag !== lp) { this.g = OCC.WALL_GAIN; this.hz = OCC.WALL_HZ; this.why = 'a place apart'; } else this.why = 'same place'; return; }
    // the listener is in a walk-in room: its frame is the room's
    if (tag === undefined || tag === null || tag === lp) {
      if (tag === lp || this._inBounds(S, sx, sy, sz)) { this.why = 'same room'; return; }
      const w = S.toWorld(sx, sz, this._w); this._room(this.ldef, lx, lz, w[0], w[1], null); return;
    }
    const w = S.toWorld(sx, sz, this._w), wx = w[0], wz = w[1];
    if (tag === 'world') { this._room(this.ldef, lx, lz, wx, wz, null); return; }
    const sd = I && I.get ? I.get(tag) : null;
    if (!sd || !sd.sl || !sd.sl.toLocal) { this.g = OCC.WALL_GAIN; this.hz = OCC.WALL_HZ; this.why = 'a place apart'; return; }
    this._room(this.ldef, lx, lz, wx, wz, sd);
  }
  /** the frame in which the player steps through a doorway: the audio's frame (set by systems/ambience.js) is a frame behind the player's — nothing is looked at */
  _between(A) { const p = this.game.player; return !!(p && A.framePlace && p.place !== A.framePlace); }
  _wanted(h) { return !(h._oc === false || CLASS_SKIP[h._cls] || (h._oc === 'out' && this.lplace !== 'world')); }
  /** a new node from audio.spatial(): solved at once, so that a one-shot starts as it should be heard */
  born(A, h) {
    if (!this.enabled || h._oc === false || CLASS_SKIP[h._cls]) return;
    this.list.push(h); this.stats.born++;
    try {
      if (this.births >= OCC.BIRTHS || this._between(A)) return;      // (a burst of new sounds: the rest are heard in the clear until their turn comes round)
      this._listener(A);
      if (!this._wanted(h)) return;
      // a short memory by place: steps and knocks from one spot share one answer while the listener has not moved
      const M = this._memo;
      if (this.frame - this._memoAt > 12 || Math.abs(this.lx - this._memoX) + Math.abs(this.lz - this._memoZ) > 0.6 || this.lplace !== this._memoP) { M.clear(); this._memoAt = this.frame; this._memoX = this.lx; this._memoZ = this.lz; this._memoP = this.lplace; }
      const key = Math.round(h._x / 1.5) + ',' + Math.round(h._z / 1.5) + ',' + (h._place ?? '');
      let r = M.get(key);
      if (r) this.stats.cached++;
      else { this.births++; const t0 = now(); this.solve(h._x, h._y, h._z, h._place); this.stats.looks++; const ms = now() - t0; this.stats.ms += ms; this._fms = (this._fms || 0) + ms; r = { g: this.g, hz: this.hz }; if (M.size < 64) M.set(key, r); }
      h._ot = A.ctx ? A.ctx.currentTime : 0;
      h._occSet(r.g, r.hz, 0);
    } catch (e) { this._err(e); }
  }
  /** every frame (core/audio.js listener()): the lasting sounds, in turn */
  update(A) {
    const st = this.stats; st.frames++; this.frame++; this.births = 0;
    if (this._fms > st.maxMs) st.maxMs = this._fms;
    this._fms = 0;
    const L = this.list; st.live = L.length;
    if (!this.enabled || !L.length || this._between(A)) return;
    const t0 = now(), t = A.ctx ? A.ctx.currentTime : 0;
    try {
      this._listener(A);
      let looked = 0;
      for (let n = L.length; n > 0 && looked < OCC.PER_FRAME; n--) {
        if (this.i >= L.length) this.i = 0;
        const h = L[this.i];
        if (h.dead) { L[this.i] = L[L.length - 1]; L.pop(); continue; }
        this.i++;
        if (t - (h._ot || 0) < OCC.RETEST && h._ot !== undefined) continue;
        h._ot = t;
        if (!this._wanted(h)) { if (h._og !== 1) h._occSet(1, OCC.OPEN_HZ, OCC.SMOOTH); continue; }
        this.solve(h._x, h._y, h._z, h._place); st.looks++; looked++;
        h._occSet(this.g, this.hz, OCC.SMOOTH);
      }
    } catch (e) { this._err(e); }
    const ms = now() - t0; st.ms += ms; this._fms += ms;
  }
  _err(e) { if (!this._said) { this._said = true; console.warn('[occlusion] ' + (e && e.stack || e) + ' — sounds are left as they were'); } }
  /** what is muffled just now, for a bug report (game.audio.health() shows it) */
  report() {
    const st = this.stats; let m = 0; for (const h of this.list) if (!h.dead && h._og < 0.98) m++;
    return { live: this.list.length, muffled: m, looks: st.looks, lines: st.lines, born: st.born, cached: st.cached, msPerFrame: st.frames ? +(st.ms / st.frames).toFixed(4) : 0, maxMsFrame: +st.maxMs.toFixed(3) };
  }
}
