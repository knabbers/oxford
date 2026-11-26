// Getting up onto things (2026-11-24): the floors above the ground that core/player.js can stand on, the ledges it can
// catch, and the walls that are only walls up to their tops. A helper of core/player.js; a place hands in what it has
// drawn (places/_snsc_climb.js: the Sultan Nazrin Shah Centre's roofs, timbers and wall heads). Nothing here knows any
// one building, and nothing here is consulted for anybody but the local player: the townspeople, the friends and the
// traffic keep to the ground as before.
//
// The world's own logic is flat: one ground height per (x, z), walls as plan segments of no known height. This adds:
//   DECKS   level or sloping floors at a real height (y above the world's zero, as the place drew them), stacked
//           freely: a pergola over a terrace, a roof over nothing. A polygon, or a STRIP (a beam, a rail, a wall head:
//           a line with a half width; a foot may be TOL off its edge before it slips).
//           opts: bot (y of the underside: a head rising into it stops), slip [dx, dz] or (x, z) => [dx, dz] (too
//           steep or too smooth to stand on: you sit down and slide that way), narrow (walked with the arms out),
//           grab: false, shed (x, z) => [dx, dz] (a floor nobody lands on from SHED metres or more above and keeps
//           their feet: over you go, rolling that way until you are off it).
//   WALLS   collider shapes given a top (and, for one standing on a roof, a base): solid only to a body beside them.
//           Opened for the length of the player's own move and for the chase camera's ray, shut again at once.
//   MOVES   jump (Space, as ever); in the air against a deck's edge within reach of the hands: catch it and hang;
//           Space pulls up (where there is room to stand), A / D shuffles along the edge, S lets go. X, standing at
//           an edge and looking out over it: turn and let yourself down to hang from it. A drop of FALL metres or more lands
//           in a tumble.
const TOL = 0.12, GRAB_D = 0.55, GRAB_MIN = 0.45, OUT = 0.3, FALL = 4.5, SHED = 1.5, ROLL = 4.6, HEAD = 0.2, LOW = 1.2, PULL = 2.2, SHIMMY = 0.7, SLIDE = 6.5;
const sm = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
function pip(x, z, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }

export class Climb {
  constructor(game) {
    this.game = game; this.decks = []; this.walls = []; this.solids = [];
    this.x0 = Infinity; this.z0 = Infinity; this.x1 = -Infinity; this.z1 = -Infinity;
    this.cur = null;          // the deck stood on this frame
    this.hang = null;         // { d, ax, az, bx, bz, t, nx, nz, u, phase }
    this._roll = null; this.rolls = 0;
    this.cool = 0; this.high = false; this._open = false; this._air = false; this._peak = 0; this._py = 0; this._slid = false;
    this.falls = 0; this.catches = 0; this.lowers = 0;      // (counters for the tests)
    // the chase camera's ray (core/game.js: the only caller that asks which segment it hit) sees the walls as the
    // player's own move does: from a roof it looks out over the parapet it stands on
    const col = game.worldCollider;
    if (col && typeof col.raycast === 'function' && !col._climbRay) {
      const ray = col.raycast; col._climbRay = true;
      col.raycast = (x1, z1, x2, z2, o) => { if (!o || !o.hit || !this.high) return ray.call(col, x1, z1, x2, z2, o); this.open(game.player); try { return ray.call(col, x1, z1, x2, z2, o); } finally { this.close(); } };
    }
  }

  _grow(x, z, m = 1.5) { if (x - m < this.x0) this.x0 = x - m; if (x + m > this.x1) this.x1 = x + m; if (z - m < this.z0) this.z0 = z - m; if (z + m > this.z1) this.z1 = z + m; }
  _in(x, z) { return x > this.x0 && x < this.x1 && z > this.z0 && z < this.z1; }

  /** a floor over the polygon [[x, z], ...]: y a number, or [y0, x0, z0, dy/dx, dy/dz] (a plane) */
  addDeck(poly, y, o = {}) {
    const d = { poly, strip: false, shed: o.shed || null, slip: o.slip || null, narrow: !!o.narrow, grab: o.grab !== false && !o.slip, bot: o.bot, tag: o.tag || '', x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
    if (typeof y === 'number') { d.y = y; d.pl = null; } else { d.y = y[0]; d.pl = y; }
    for (const p of poly) { if (p[0] < d.x0) d.x0 = p[0]; if (p[0] > d.x1) d.x1 = p[0]; if (p[1] < d.z0) d.z0 = p[1]; if (p[1] > d.z1) d.z1 = p[1]; this._grow(p[0], p[1]); }
    this.decks.push(d); return d;
  }

  /** a beam / rail / wall head from a [x, z] at height ya to b at yb, half width hw */
  addStrip(a, b, ya, yb, hw, o = {}) {
    const r = hw + TOL, d = { strip: true, ax: a[0], az: a[1], bx: b[0], bz: b[1], ya, yb, hw, slip: o.slip || null, narrow: o.narrow !== false, grab: o.grab !== false && !o.slip, bot: o.bot, tag: o.tag || '',
      x0: Math.min(a[0], b[0]) - r, x1: Math.max(a[0], b[0]) + r, z0: Math.min(a[1], b[1]) - r, z1: Math.max(a[1], b[1]) + r };
    d.len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
    this._grow(a[0], a[1]); this._grow(b[0], b[1]);
    this.decks.push(d); return d;
  }

  /** the plan of something solid all the way up to its decks (a building): a body that has got inside it below them
   *  (pushed off a wall head to the wrong side) is stood on the lowest deck above it, never left inside */
  addSolid(poly) { this.solids.push(poly); for (const p of poly) this._grow(p[0], p[1]); }

  /** a collider shape (segment or circle) that stands from `base` (undefined: the ground) to `top`. A shape with a base
   *  is off until the player's body is beside it. */
  addWall(s, top, base) { if (!s) return; if (base !== undefined) s.on = false; this.walls.push({ s, top, base }); }

  // ---- geometry
  _strip(d, x, z) {      // -> distance to the centre line; this._t = where along it (0..1)
    const dx = d.bx - d.ax, dz = d.bz - d.az; let t = ((x - d.ax) * dx + (z - d.az) * dz) / (d.len * d.len);
    t = t < 0 ? 0 : t > 1 ? 1 : t; this._t = t;
    return Math.hypot(x - d.ax - dx * t, z - d.az - dz * t);
  }
  /** the deck's top at (x, z), NaN off it (tol: how far a foot may be off a strip's edge) */
  _top(d, x, z, tol = TOL) {
    if (x < d.x0 || x > d.x1 || z < d.z0 || z > d.z1) return NaN;
    if (d.strip) return this._strip(d, x, z) <= d.hw + tol ? d.ya + (d.yb - d.ya) * this._t : NaN;
    if (!pip(x, z, d.poly)) return NaN;
    return d.pl ? d.pl[0] + (x - d.pl[1]) * d.pl[3] + (z - d.pl[2]) * d.pl[4] : d.y;
  }
  _below(x, z, lim) { let best = -Infinity; for (let i = 0; i < this.decks.length; i++) { const t = this._top(this.decks[i], x, z); if (t === t && t <= lim && t > best) best = t; } return best; }
  /** highest deck top at (x, z) no higher than lim, or -Infinity; this._d = that deck */
  topAt(x, z, lim) {
    let best = -Infinity; this._d = null;
    if (!this._in(x, z)) return best;
    for (let i = 0; i < this.decks.length; i++) { const d = this.decks[i], t = this._top(d, x, z); if (t === t && t <= lim && t > best) { best = t; this._d = d; } }
    return best;
  }

  // ---- hooks of core/player.js
  /** the floor under the player from the decks (feet may rise `reach` onto it), or -Infinity */
  floorAt(p, reach) {
    if (p.place !== 'world') { this.cur = null; return -Infinity; }
    const x = p.pos.x, z = p.pos.z;
    let t = this.topAt(x, z, p.pos.y + (this._slid ? Math.min(reach, 0.05) : reach)); this.cur = this._d;      // (sliding: nothing is stepped up onto)
    if (t === -Infinity && this.solids.length && this._in(x, z) && p.pos.y > this.game.groundHeight(x, z) + 0.5) {
      for (let i = 0; i < this.solids.length; i++) if (pip(x, z, this.solids[i])) {
        let lo = Infinity, ld = null; for (let k = 0; k < this.decks.length; k++) { const d = this.decks[k], q = this._top(d, x, z, 0); if (q === q && q < lo) { lo = q; ld = d; } }
        if (ld) { t = lo; this.cur = ld; } break;
      }
    }
    return t;
  }

  /** open the walls the player's feet are above (before its move); close() after */
  open(p) {
    if (this._open) this.close();
    if (!p || !this.walls.length || p.place !== 'world' || !this._in(p.pos.x, p.pos.z)) return;
    const y = p.pos.y, f = p.onGround ? y : y + 0.3;
    for (let i = 0; i < this.walls.length; i++) { const w = this.walls[i]; w.s.on = f < w.top - 0.03 && (w.base === undefined || y > w.base - 1.75); }
    this._open = true;
  }
  close() { if (!this._open) return; for (let i = 0; i < this.walls.length; i++) { const w = this.walls[i]; w.s.on = w.base === undefined; } this._open = false; }

  _drop(p) { this.hang = null; this.cool = 0.45; if (p.pose === 'hang' || p.pose === 'climb') p.pose = 'stand'; }

  /** hanging from an edge / pulling up over it: the body is placed here and the rest of the player's update is skipped */
  hold(p, dt, inp) {
    const h = this.hang; if (!h) return false;
    if (p.place !== 'world' || p.downT > 0) { this._drop(p); return false; }
    const d = h.d, ex = h.ax + (h.bx - h.ax) * h.t, ez = h.az + (h.bz - h.az) * h.t;
    const top = d.strip ? d.ya + (d.yb - d.ya) * (this._strip(d, ex, ez), this._t) : d.pl ? d.pl[0] + (ex - d.pl[1]) * d.pl[3] + (ez - d.pl[2]) * d.pl[4] : d.y;
    const hx = ex + h.nx * OUT, hz = ez + h.nz * OUT;
    const reach = (p.character.dims && p.character.dims.top ? p.character.dims.top + 0.5 * (p.character.dims.s || 1) : 2.2);
    const g = this.game, below = Math.max(g.groundHeight(hx, hz), this.topAt(hx, hz, top - 0.6)), hy = Math.max(top - reach, below + 0.02);
    const frozen = p.frozen || (g.activity && !g.activity.walk);
    p.vx = p.vz = 0; p.vy = 0; p.speed = 0; p._spd = 0; p.onGround = false; p.support = null; p.stumbleT = 0;
    p.heading = Math.atan2(-h.nx, -h.nz);
    if (h.cam !== undefined && Number.isFinite(g.cameraYaw)) { const dd = Math.atan2(Math.sin(h.cam - g.cameraYaw), Math.cos(h.cam - g.cameraYaw)), st = Math.min(Math.abs(dd), dt * 5.5); g.cameraYaw += Math.sign(dd) * st; if (Math.abs(dd) < 0.03) h.cam = undefined; }
    if (h.phase === 'hang') {
      p.pose = 'hang';
      const k = Math.min(1, dt * 14); p.pos.x += (hx - p.pos.x) * k; p.pos.z += (hz - p.pos.z) * k; p.pos.y += (hy - p.pos.y) * k;
      if (!frozen) {
        // (D shuffles to the right hand's side, facing the wall: h.sg says which way along a -> b that is)
        const mx = inp.moveX, el = Math.hypot(h.bx - h.ax, h.bz - h.az) || 1;
        if (mx) { const want = h.t + mx * h.sg * SHIMMY * dt / el, t = Math.max(h.t0, Math.min(h.t1, want)), qx = h.ax + (h.bx - h.ax) * t + h.nx * OUT, qz = h.az + (h.bz - h.az) * t + h.nz * OUT; if (!this._roofed(d, qx, qz, top, hy)) h.t = t;      // (not along under something)
          if (want !== t && d.strip) this._handOn(p, h, want > t ? 1 : 0, top); }      // (at the end of a beam or a length of wall head: on to the next, if one carries straight on)
        if (inp.hit('Space')) { if (this._room(p, ex - h.nx * h.inset, ez - h.nz * h.inset, top)) { h.phase = 'pull'; h.u = 0; h.y0 = hy; p.pose = 'climb'; try { p.character.setPose('stand'); } catch { /* */ } } }      // (no pulling up into something that stands on the edge)
        else if (inp.moveY < 0) { this._drop(p); this._air = true; this._peak = p.pos.y; return false; }
      }
    } else {
      // the climb-up of core/characters.js ('climb': kick, hang, pull, mantle, stand) with the body carried up and in
      h.u += dt / PULL; p.pose = 'climb';
      const u = h.u, up = sm(0.38, 0.8, u), inn = sm(0.68, 1, u), ins = h.inset;
      p.pos.y = h.y0 + (top - h.y0) * up;
      p.pos.x = hx + (ex - h.nx * ins - hx) * inn; p.pos.z = hz + (ez - h.nz * ins - hz) * inn;
      if (u >= 1) { p.pos.y = top; p.onGround = true; p.pose = 'stand'; this.hang = null; this.cool = 0.2; this._air = false; this.cur = d; }
    }
    this._py = p.pos.y; this.high = true;
    return true;
  }

  /** is something else overhead where a body hanging from deck d at (hx, hz) would be (feet at y)? */
  _roofed(d, hx, hz, top, y) {
    for (let k = 0; k < this.decks.length; k++) { const e = this.decks[k]; if (e === d || e.bot === undefined || e.bot > top + 0.3 || e.bot < y + 0.9) continue; const t = this._top(e, hx, hz, 0.18); if (t === t) return true; }
    return false;
  }

  /** an edge of a deck within reach of the hands of a player in the air */
  _catch(p, reach) {
    const x = p.pos.x, z = p.pos.z, y = p.pos.y, fx = Math.sin(p.heading), fz = Math.cos(p.heading), sp = Math.hypot(p.vx, p.vz);
    let best = null, bd = GRAB_D;
    for (let i = 0; i < this.decks.length; i++) {
      const d = this.decks[i];
      if (!d.grab || x < d.x0 - GRAB_D || x > d.x1 + GRAB_D || z < d.z0 - GRAB_D || z > d.z1 + GRAB_D) continue;
      let ax, az, bx, bz, px, pz, dist, top, t;
      if (d.strip) {
        const c = this._strip(d, x, z); t = this._t; if (c <= d.hw) continue;      // (over it: not beside it)
        const cx = d.ax + (d.bx - d.ax) * t, cz = d.az + (d.bz - d.az) * t, ux = (x - cx) / c, uz = (z - cz) / c;
        px = cx + ux * d.hw; pz = cz + uz * d.hw; dist = c - d.hw; top = d.ya + (d.yb - d.ya) * t;
        if (t > 0 && t < 1) { ax = d.ax + ux * d.hw; az = d.az + uz * d.hw; bx = d.bx + ux * d.hw; bz = d.bz + uz * d.hw; } else { ax = bx = px; az = bz = pz; t = 0; }
      } else {
        if (pip(x, z, d.poly)) continue;
        dist = Infinity;
        for (let k = 0, n = d.poly.length; k < n; k++) {
          const a = d.poly[k], b = d.poly[(k + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1e-9;
          let s = ((x - a[0]) * ex + (z - a[1]) * ez) / l2; s = s < 0 ? 0 : s > 1 ? 1 : s;
          const qx = a[0] + ex * s, qz = a[1] + ez * s, q = Math.hypot(x - qx, z - qz);
          if (q < dist) { dist = q; px = qx; pz = qz; ax = a[0]; az = a[1]; bx = b[0]; bz = b[1]; t = s; }
        }
        top = d.pl ? d.pl[0] + (px - d.pl[1]) * d.pl[3] + (pz - d.pl[2]) * d.pl[4] : d.y;
      }
      if (!(dist < bd) || dist < 1e-4) continue;
      const dy = top - y; if (dy < GRAB_MIN || dy > reach + 0.05) continue;
      const nx0 = (x - px) / dist, nz0 = (z - pz) / dist, fl = Math.max(this.game.groundHeight(px + nx0 * OUT, pz + nz0 * OUT), this._below(px + nx0 * OUT, pz + nz0 * OUT, top - 0.6));
      if (top - fl < LOW) continue;      // (low enough to jump onto: not a thing to hang from)
      // room for the body to come up: nothing else overhead where it would hang (the next joist of a pergola, a soffit)
      if (this._roofed(d, px + nx0 * OUT, pz + nz0 * OUT, top, y)) continue;
      const nx = (x - px) / dist, nz = (z - pz) / dist;      // out from the edge, towards the body
      // reaching for it: facing it, or carried towards it
      if (-(fx * nx + fz * nz) < 0.2 && !(sp > 0.5 && -(p.vx * nx + p.vz * nz) / sp > 0.3)) continue;
      bd = dist; best = { d, ax, az, bx, bz, t, nx, nz, top };
    }
    if (!best) return false;
    this._hangOn(p, best); this.catches++;
    return true;
  }

  /** take hold: h = { d, ax, az, bx, bz, t, nx, nz } (the edge a -> b, where along it, the way out from it) */
  _hangOn(p, h) {
    const d = h.d, el = Math.hypot(h.bx - h.ax, h.bz - h.az);
    // the edge's own normal where there is one (a body hangs square to it); which way along it is the right hand's
    if (el > 0.05) { const ex = (h.bx - h.ax) / el, ez = (h.bz - h.az) / el; let nx = -ez, nz = ex; if (nx * h.nx + nz * h.nz < 0) { nx = -nx; nz = -nz; } h.nx = nx; h.nz = nz; h.sg = ex * nz - ez * nx > 0 ? 1 : -1; const m = Math.min(0.45, 0.25 / el); h.t0 = m; h.t1 = 1 - m; h.t = Math.max(h.t0, Math.min(h.t1, h.t)); }
    else { h.sg = 1; h.t0 = h.t1 = h.t = 0; }
    h.inset = d.strip ? d.hw : 0.38; h.phase = 'hang'; h.u = 0;
    this.hang = h;
    p.vx = p.vz = 0; p.vy = 0; p.pose = 'hang';
  }

  /** hanging at the end (e = 1: b, 0: a) of a strip's edge: take hold of the strip that carries on from it, if there is one
   *  (its end within a hand's width of this one's, its top at the same height, its edge facing the same way) */
  _handOn(p, h, e, top) {
    const d = h.d, cx = e ? d.bx : d.ax, cz = e ? d.bz : d.az;
    for (let i = 0; i < this.decks.length; i++) {
      const n = this.decks[i]; if (n === d || !n.strip || !n.grab) continue;
      const c = this._strip(n, cx, cz), t = this._t; if (c > 0.12) continue;
      if (Math.abs(n.ya + (n.yb - n.ya) * t - top) > 0.2) continue;
      const ux = (n.bx - n.ax) / n.len, uz = (n.bz - n.az) / n.len; let nx = -uz, nz = ux; if (nx * h.nx + nz * h.nz < 0) { nx = -nx; nz = -nz; }
      if (nx * h.nx + nz * h.nz < 0.7) continue;
      const cam = h.cam, m = Math.min(0.45, 0.25 / n.len);
      this._hangOn(p, { d: n, ax: n.ax + nx * n.hw, az: n.az + nz * n.hw, bx: n.bx + nx * n.hw, bz: n.bz + nz * n.hw, t: t < 0.5 ? m : 1 - m, nx, nz }); this.hang.cam = cam;
      return true;
    }
    return false;
  }

  /** X: standing on a deck at an edge of it and facing that edge: down over it to hang (not where the drop under it is
   *  short, something is overhead, or a wall or rail stands in the way) */
  _lower(p, reach) {
    const d = this.cur; if (!d || !d.grab) return false;
    // (the way the VIEW points, not the body: you look out over the edge and press X; the body turns as it goes down)
    const yaw = Number.isFinite(this.game.cameraYaw) ? this.game.cameraYaw : p.heading, x = p.pos.x, z = p.pos.z, fx = Math.sin(yaw), fz = Math.cos(yaw);
    let ax, az, bx, bz, px, pz, t, nx, nz;
    if (d.strip) {
      const ux = (d.bx - d.ax) / d.len, uz = (d.bz - d.az) / d.len, lat = fx * -uz + fz * ux, al = fx * ux + fz * uz;
      this._strip(d, x, z); t = this._t;
      if (Math.abs(lat) >= 0.5) { const sg = lat > 0 ? 1 : -1; nx = -uz * sg; nz = ux * sg; ax = d.ax + nx * d.hw; az = d.az + nz * d.hw; bx = d.bx + nx * d.hw; bz = d.bz + nz * d.hw; px = ax + (bx - ax) * t; pz = az + (bz - az) * t; }
      else { const e = al > 0 ? 1 : 0; if (Math.abs(t - e) * d.len > 0.7) return false; px = ax = bx = e ? d.bx : d.ax; pz = az = bz = e ? d.bz : d.az; nx = e ? ux : -ux; nz = e ? uz : -uz; t = 0; }
    } else {
      let best = 0.75;
      for (let k = 0, n = d.poly.length; k < n; k++) {
        const a = d.poly[k], b = d.poly[(k + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1e-9;
        let q = ((x - a[0]) * ex + (z - a[1]) * ez) / l2; q = q < 0 ? 0 : q > 1 ? 1 : q;
        const qx = a[0] + ex * q, qz = a[1] + ez * q, dq = Math.hypot(x - qx, z - qz);
        if (dq >= best || dq < 1e-4 || ((qx - x) * fx + (qz - z) * fz) / dq < 0.5) continue;
        best = dq; px = qx; pz = qz; ax = a[0]; az = a[1]; bx = b[0]; bz = b[1]; t = q; nx = (qx - x) / dq; nz = (qz - z) / dq;
      }
      if (px === undefined) return false;
    }
    const top = d.strip ? p.pos.y : d.pl ? d.pl[0] + (px - d.pl[1]) * d.pl[3] + (pz - d.pl[2]) * d.pl[4] : d.y;
    const hx = px + nx * OUT, hz = pz + nz * OUT, fl = Math.max(this.game.groundHeight(hx, hz), this._below(hx, hz, top - 0.6));
    if (top - fl < LOW || this._roofed(d, hx, hz, top, top - reach)) return false;
    const col = this.game.collider; let shut = false;
    this.open(p); try { const q = _q; q.x = hx; q.z = hz; shut = (!!(col && col.resolve && col.resolve(q, 0.2)) && Math.hypot(q.x - hx, q.z - hz) > 0.02) || (!!(col && col.raycast) && col.raycast(x, z, hx + nx * 0.2, hz + nz * 0.2, _ray) !== null); } finally { this.close(); }
    if (shut || !this._room(p, hx, hz, top - reach + 0.4)) return false;      // (nor into a gap too narrow to hang in)
    this._hangOn(p, { d, ax, az, bx, bz, t, nx, nz }); this.lowers++;
    this.hang.cam = Math.atan2(-this.hang.nx, -this.hang.nz);      // (the view was out over the edge: it swings round behind the body, which now faces the wall)
    return true;
  }

  /** is there room to stand at (x, z) with the feet at y? (the walls as a body at that height meets them) */
  _room(p, x, z, y) {
    const col = this.game.collider; if (!col || !col.resolve) return true;
    const y0 = p.pos.y, g0 = p.onGround; p.pos.y = y; p.onGround = true; this.open(p);
    try { const q = _q; q.x = x; q.z = z; col.resolve(q, 0.22); return Math.hypot(q.x - x, q.z - z) < 0.06; } finally { this.close(); p.pos.y = y0; p.onGround = g0; }
  }

  /** after the player's own vertical step: heads and soffits, catching an edge, sliding, the long drop, the pose */
  post(p, dt) {
    const g = this.game, y = p.pos.y, near = p.place === 'world' && this._in(p.pos.x, p.pos.z);
    if (this.cool > 0) this.cool -= dt;
    this.high = near && y - g.groundHeight(p.pos.x, p.pos.z) > 1.0;
    // ---- the long drop (anywhere): from the highest point of the flight to the landing
    if (!p.onGround) { if (!this._air) { this._air = true; this._peak = this._py; } if (y > this._peak) this._peak = y; this._ax = p.vx; this._az = p.vz; }      // (the way it was going in the air: the landing's own stumble has turned the velocity round by the time it is read below)
    else if (this._air) {
      this._air = false;
      const dk = near ? this.cur : null;
      if (dk && dk.shed && this._peak - y >= SHED && !p.vehicle && !p.swim) {
        // down onto a floor that sheds: over, and rolling to its edge
        const s = dk.shed(p.pos.x, p.pos.z); this._roll = { dx: s[0], dz: s[1], t: 0 }; this.rolls++; p.stumbleT = 0; p.downT = 0;
        p.knockDown(s[0] * ROLL, s[1] * ROLL, { forward: true, force: true });
      } else if (this._peak - y >= FALL && p.downT <= 0 && !p.vehicle && !p.swim) {
        const ax = this._ax || 0, az = this._az || 0, sp = Math.hypot(ax, az); this.falls++; p.stumbleT = 0;
        if (sp > 0.6) p.knockDown(ax / sp * 4.5, az / sp * 4.5, { forward: true, force: true }); else p.knockDown(-Math.sin(p.heading) * 3, -Math.cos(p.heading) * 3, { force: true });
      }
    }
    if (this._roll) {
      const r = this._roll; r.t += dt;
      if (!near || r.t > 8 || (p.onGround && !(this.cur && this.cur.shed))) this._roll = null;      // (off it: the drop from its edge is the long drop above)
      else if (p.onGround) { p.vx = r.dx * ROLL; p.vz = r.dz * ROLL; if (p.downT < 0.35) { p.downT = 0.35; p.pose = 'sitground'; p.heading = Math.atan2(r.dx, r.dz); } }
    }
    if (near) {
      const control = !p.frozen && p.downT <= 0 && !(g.activity && !g.activity.walk);
      if (!p.onGround) {
        // a head rising into the underside of something
        if (p.vy > 0) for (let i = 0; i < this.decks.length; i++) { const d = this.decks[i]; if (d.bot === undefined || y + 1.7 < d.bot || this._py + 1.7 > d.bot + 0.02) continue; const t = this._top(d, p.pos.x, p.pos.z, d.strip ? HEAD : 0); if (t === t) { p.pos.y = d.bot - 1.7; p.vy = -0.6; break; } }
        if (control && this.cool <= 0 && p.vy < 2.2 && p.vy > -7.5 && p.stumbleT <= 0) { const D = p.character.dims; this._catch(p, D && D.top ? D.top + 0.5 * (D.s || 1) : 2.2); }
      }
      else if (control && this.cool <= 0 && p.stumbleT <= 0 && this.cur && g.input && g.input.hit && g.input.hit('KeyX')) { const D = p.character.dims; this._lower(p, D && D.top ? D.top + 0.5 * (D.s || 1) : 2.2); }
      // ---- too steep, too smooth: sat down and sliding
      const d = p.onGround && !this.hang ? this.cur : null;
      if (d && d.slip && p.downT <= 0) {
        // (the speed builds at 5 m/s2 over what the player's own stop takes off; the way turns downhill at once)
        const s = typeof d.slip === 'function' ? d.slip(p.pos.x, p.pos.z) : d.slip, sp = Math.min(SLIDE, Math.max(0.6, Math.hypot(p.vx, p.vz)) + 12 * dt);
        p.vx = s[0] * sp; p.vz = s[1] * sp;
        p.stumbleT = Math.max(p.stumbleT, 0.12); p._stumbleCd = 0.5; p.pose = 'sitground'; p.heading = Math.atan2(s[0], s[1]); this._slid = true;
      } else if (this._slid) { this._slid = false; if (p.pose === 'sitground') p.pose = 'stand'; }
      // ---- along something narrow: arms out
      if (d && d.narrow && !d.slip) { if (p.pose === 'stand') p.pose = 'balance'; }
      else if (p.pose === 'balance') p.pose = 'stand';
    } else if (p.pose === 'balance' || (this._slid && p.pose === 'sitground')) { p.pose = 'stand'; this._slid = false; }
    this._py = p.pos.y;
  }
}

/** the one Climb of a game (made when a place first has something to hand in) */
export function climbOf(game) { return game.climb || (game.climb = new Climb(game)); }
const _q = { x: 0, z: 0 }, _ray = { ignoreLow: false };
export const CLIMB = { TOL, GRAB_D, FALL, PULL, SHIMMY };
