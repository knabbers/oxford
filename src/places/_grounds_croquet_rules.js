// Association Croquet — pure rules + 2D ball physics + AI (no three.js, no DOM; used by worcester_grounds and
// tools/smoke_croquet.mjs). Court frame: x east 0..W, y north 0..L (metres). Angles: direction (cos a, sin a).
//
// Simplifications (also shown in the in-game help):
//  * A turn = 1 stroke; running your hoop in order earns 1 continuation stroke; hitting a live ball (roquet) earns a
//    croquet stroke + 1 continuation. Each ball may be roqueted once per turn until the striker's ball runs a hoop.
//  * Croquet stroke: the striker's ball is placed touching the roqueted ball; you aim the roqueted ball (line of
//    centres) and choose a split angle; speeds are split by an empirical rule (drive ≈ 1:4, 45° split ≈ 1:1, take-off).
//  * Balls off the court are replaced on the yard line where they went off; balls left in the yard-line band are moved
//    onto the yard line (non-striker balls after every stroke, the striker's ball at the end of the turn).
//  * Balls come into play from A-baulk (west half of the south yard line) or B-baulk (east half of the north one).
//  * A rover ball (all hoops run) that touches the peg is pegged out, whoever's turn it is. No wiring, no faults,
//    no bisques, no time limit. Side wins when both its balls are pegged out.

export const YD = 0.9144;
export const BALL_R = 0.046;                 // 92 mm ball
export const HOOP_HALF_GAP = 0.06;           // inner half-width: 120 mm gap = 1.3x ball (real 95-100 mm)
export const UPRIGHT_R = 0.009;
export const PEG_R = 0.019;
export const VMAX = 9.0;                     // m/s at full power
const C0 = 0.30, C1 = 0.16;                  // grass rolling resistance: decel = C0 + C1 * v
const E_BALL = 0.85, E_WIRE = 0.45, E_PEG = 0.55;
const H = 1 / 240;                           // physics step
const OUT_MARGIN = 2.2;                      // balls roll at most this far past the boundary

export const BALL_DEFS = [
  { id: 'blue', name: 'Blue', color: 0x1f4fd0, side: 0 },
  { id: 'red', name: 'Red', color: 0xc8202a, side: 1 },
  { id: 'black', name: 'Black', color: 0x151515, side: 0 },
  { id: 'yellow', name: 'Yellow', color: 0xe8c82a, side: 1 },
];
export const HOOP_NAMES = ['1', '2', '3', '4', '5', '6', '1-back', '2-back', '3-back', '4-back', 'Penult', 'Rover'];

/** Distance a ball starting at speed v rolls before stopping. */
export function rollDistance(v) { return v <= 0 ? 0 : (v - (C0 / C1) * Math.log(1 + (C1 * v) / C0)) / C1; }
/** Speed needed to roll distance d (bisection on rollDistance). */
export function speedFor(d) {
  if (d <= 0) return 0;
  let lo = 0, hi = 40;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (rollDistance(m) < d) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** Croquet-stroke speed split for split angle a (radians, |a| < pi/2): [croqueted factor, striker factor]. */
export function splitFactors(a) {
  const s = Math.min(1.5, Math.abs(a));
  return [Math.pow(Math.max(0.02, Math.cos(s)), 0.7), 0.45 + 0.55 * Math.sin(s)];
}

export function mulberry(seed) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.gauss = () => { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * v); };
  return r;
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Court geometry for a court of W x L metres (full size 25.6 x 32). Corner hoops 7 yd in, centre hoops 6 yd from peg. */
export function makeCourt(W = 28 * YD, L = 35 * YD) {
  const k = Math.min(W / (28 * YD), L / (35 * YD));
  const c7 = 7 * YD * k, c6 = 6 * YD * k, yl = Math.max(0.5, YD * k);
  const P = [W / 2, L / 2];
  // position hoops: [x, y, run direction (+1 north / -1 south)]
  const pos = { SW: [c7, c7], NW: [c7, L - c7], NE: [W - c7, L - c7], SE: [W - c7, c7], CS: [W / 2, L / 2 - c6], CN: [W / 2, L / 2 + c6] };
  const seq = [['SW', 1], ['NW', 1], ['NE', -1], ['SE', -1], ['CS', 1], ['CN', 1], ['NW', -1], ['SW', -1], ['SE', 1], ['NE', 1], ['CN', -1], ['CS', -1]];
  const hoopKeys = ['SW', 'NW', 'NE', 'SE', 'CS', 'CN'];
  const hoops = hoopKeys.map((k2) => ({ key: k2, x: pos[k2][0], y: pos[k2][1] }));
  const course = seq.map(([k2, d]) => ({ hoop: hoopKeys.indexOf(k2), x: pos[k2][0], y: pos[k2][1], dir: d }));
  const posts = [];   // circle colliders: [x, y, r, kind]
  for (const h of hoops) { posts.push([h.x - HOOP_HALF_GAP - UPRIGHT_R, h.y, UPRIGHT_R, 1]); posts.push([h.x + HOOP_HALF_GAP + UPRIGHT_R, h.y, UPRIGHT_R, 1]); }
  posts.push([P[0], P[1], PEG_R, 2]);
  return { W, L, k, yl, peg: P, hoops, course, posts };
}

export function createGame({ hoops = 6, W, L, seed = 1 } = {}) {
  const court = makeCourt(W, L);
  const g = {
    court, N: hoops, balls: BALL_DEFS.map((d, i) => ({ ...d, i, x: 0, y: 0, vx: 0, vy: 0, inPlay: false, pegged: false, next: 0, appr: false, thru: false, prevS: 0, off: false, offX: 0, offY: 0 })),
    side: 0, ball: -1, phase: 'select', dead: [false, false, false, false], croquetFrom: -1,
    turnNo: 1, strokesThisTurn: 0, winner: -1, events: [], moving: false, simT: 0, stroke: null, log: [],
    rng: mulberry(seed),
  };
  // balls in hand sit beside the court (west of A-baulk) for display
  g.balls.forEach((b, i) => { b.x = -1.2 - (i % 2) * 0.25; b.y = 0.6 + i * 0.25; });
  return g;
}

// ---------------------------------------------------------------------------------------------------------- queries
export function nextTarget(g, b) {
  if (b.next >= g.N) return { peg: true, x: g.court.peg[0], y: g.court.peg[1], dir: 0, name: 'Peg' };
  const c = g.court.course[b.next];
  return { peg: false, x: c.x, y: c.y, dir: c.dir, hoop: c.hoop, name: HOOP_NAMES[b.next] };
}
export function sideBalls(g, side) { return g.balls.filter((b) => b.side === side && !b.pegged); }
export function selectable(g) { return sideBalls(g, g.side).map((b) => b.i); }
const yardClamp = (g, x, y) => { const c = g.court; return [Math.max(c.yl, Math.min(c.W - c.yl, x)), Math.max(c.yl, Math.min(c.L - c.yl, y))]; };
function inBand(g, b) { const c = g.court; return b.x < c.yl - 1e-6 || b.x > c.W - c.yl + 1e-6 || b.y < c.yl - 1e-6 || b.y > c.L - c.yl + 1e-6; }
/** Position on a baulk line, t in [0,1]. baulk 'A' = west half of south yard line, 'B' = east half of north yard line. */
export function baulkPoint(g, baulk, t) {
  const c = g.court; t = Math.max(0, Math.min(1, t));
  return baulk === 'B' ? [c.W / 2 + (c.W / 2 - c.yl) * t, c.L - c.yl] : [c.yl + (c.W / 2 - c.yl) * t, c.yl];
}
function clearSpot(g, self, x, y) {
  // nudge along the nearest yard line / sideways until no ball overlaps
  for (let k = 0; k < 40; k++) {
    let hit = false;
    for (const o of g.balls) if (o !== self && o.inPlay && !o.pegged && Math.hypot(o.x - x, o.y - y) < 2 * BALL_R + 0.005) { hit = true; break; }
    if (!hit) for (const p of g.court.posts) if (Math.hypot(p[0] - x, p[1] - y) < BALL_R + p[2] + 0.005) { hit = true; break; }
    if (!hit) return [x, y];
    const s = (k % 2 ? -1 : 1) * (Math.floor(k / 2) + 1) * (2 * BALL_R + 0.01);
    const c = g.court, alongX = y <= c.yl + 0.01 || y >= c.L - c.yl - 0.01;
    if (alongX) x = Math.max(c.yl, Math.min(c.W - c.yl, x + s)); else y = Math.max(c.yl, Math.min(c.L - c.yl, y + s));
    if (k > 20) { x += 0.1; }
  }
  return [x, y];
}
function hoopState(g, b) {
  // appr / prevS for the ball's current next hoop
  if (b.next >= g.N) { b.appr = false; b.thru = false; return; }
  const c = g.court.course[b.next], s = (b.y - c.y) * c.dir;
  b.prevS = s; b.thru = false; b.appr = s <= -BALL_R;
}

// ---------------------------------------------------------------------------------------------------------- turn API
export function select(g, i) {
  if (g.phase !== 'select' || g.winner >= 0) return false;
  const b = g.balls[i];
  if (!b || b.side !== g.side || b.pegged) return false;
  g.ball = i; g.dead = [false, false, false, false]; g.strokesThisTurn = 0;
  g.phase = b.inPlay ? 'stroke' : 'place';
  return true;
}
export function place(g, baulk, t) {
  if (g.phase !== 'place') return false;
  const b = g.balls[g.ball];
  let [x, y] = baulkPoint(g, baulk, t);
  b.inPlay = true; [x, y] = clearSpot(g, b, x, y); b.x = x; b.y = y; b.vx = b.vy = 0;
  hoopState(g, b);
  g.phase = 'stroke';
  return true;
}
/** Ordinary (or continuation) stroke. */
export function shoot(g, angle, power) {
  if (g.phase !== 'stroke' || g.moving) return false;
  power = Math.max(0.02, Math.min(1, +power || 0)); angle = +angle || 0;
  const b = g.balls[g.ball], v = power * VMAX;
  b.vx = Math.cos(angle) * v; b.vy = Math.sin(angle) * v;
  beginStroke(g, 'stroke');
  return true;
}
/** Where the striker's ball is placed for a croquet stroke whose croqueted ball travels along `angle`. */
export function croquetSetup(g, angle) {
  const c = g.balls[g.croquetFrom];
  return [c.x - Math.cos(angle) * (2 * BALL_R + 0.001), c.y - Math.sin(angle) * (2 * BALL_R + 0.001)];
}
/** Croquet stroke: `angle` = direction the croqueted ball goes; `split` = angle of the striker's ball relative to it. */
export function croquetShot(g, angle, split, power) {
  if (g.phase !== 'croquet' || g.moving) return false;
  power = Math.max(0.02, Math.min(1, +power || 0)); angle = +angle || 0; split = Math.max(-1.45, Math.min(1.45, +split || 0));
  const s = g.balls[g.ball], c = g.balls[g.croquetFrom];
  const [sx, sy] = croquetSetup(g, angle);
  s.x = sx; s.y = sy;
  hoopState(g, s);
  const [fc, fs] = splitFactors(split), V = power * VMAX;
  c.vx = Math.cos(angle) * V * fc; c.vy = Math.sin(angle) * V * fc;
  s.vx = Math.cos(angle + split) * V * fs; s.vy = Math.sin(angle + split) * V * fs;
  beginStroke(g, 'croquet');
  g.stroke.croqueted = c.i;
  return true;
}
function beginStroke(g, kind) {
  g.moving = true; g.simT = 0; g.strokesThisTurn++;
  g.stroke = { kind, roquet: -1, hoops: [], striker: g.ball, off: [], pegged: [], croqueted: -1 };
  for (const b of g.balls) { b.off = false; if (b.inPlay && !b.pegged) { const t = b.next < g.N ? g.court.course[b.next] : null; b.prevS = t ? (b.y - t.y) * t.dir : 0; } }
  g.events.push({ type: 'strike', ball: g.ball, kind });
}

// ---------------------------------------------------------------------------------------------------------- physics
/** Advance the simulation by dt seconds. Returns true while balls are moving. */
export function step(g, dt) {
  if (!g.moving) return false;
  let n = Math.min(240, Math.ceil(dt / H));
  while (n-- > 0 && g.moving) { substep(g); g.simT += H; if (!anyMoving(g) || g.simT > 90) { g.moving = false; settle(g); } }
  return g.moving;
}
function anyMoving(g) { for (const b of g.balls) if (b.inPlay && !b.pegged && (b.vx !== 0 || b.vy !== 0)) return true; return false; }
function substep(g) {
  const B = g.balls, c = g.court;
  for (const b of B) {
    if (!b.inPlay || b.pegged) continue;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp === 0) continue;
    const ns = sp - (C0 + C1 * sp) * H;
    if (ns <= 0.012) { b.vx = 0; b.vy = 0; continue; }
    b.vx *= ns / sp; b.vy *= ns / sp;
    b.x += b.vx * H; b.y += b.vy * H;
    // boundary
    if (!b.off && (b.x < BALL_R || b.x > c.W - BALL_R || b.y < BALL_R || b.y > c.L - BALL_R)) {
      b.off = true; b.offX = b.x; b.offY = b.y; g.stroke.off.push(b.i); g.events.push({ type: 'off', ball: b.i });
    }
    if (b.x < -OUT_MARGIN || b.x > c.W + OUT_MARGIN || b.y < -OUT_MARGIN || b.y > c.L + OUT_MARGIN) {
      b.x = Math.max(-OUT_MARGIN, Math.min(c.W + OUT_MARGIN, b.x)); b.y = Math.max(-OUT_MARGIN, Math.min(c.L + OUT_MARGIN, b.y)); b.vx = b.vy = 0;
    }
  }
  // ball-ball
  for (let i = 0; i < 4; i++) {
    const a = B[i]; if (!a.inPlay || a.pegged) continue;
    for (let j = i + 1; j < 4; j++) {
      const b = B[j]; if (!b.inPlay || b.pegged) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, R2 = 2 * BALL_R;
      if (d2 >= R2 * R2 || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = R2 - d;
      a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn <= 0) continue;
      const j2 = ((1 + E_BALL) / 2) * vn;
      a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny;
      contact(g, a, b, vn);
    }
  }
  // posts (hoop uprights, peg)
  for (const b of B) {
    if (!b.inPlay || b.pegged) continue;
    for (const p of c.posts) {
      const dx = b.x - p[0], dy = b.y - p[1], rr = BALL_R + p[2], d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      b.x = p[0] + nx * rr; b.y = p[1] + ny * rr;
      const vn = b.vx * nx + b.vy * ny;
      if (p[3] === 2 && b.next >= g.N && !b.pegged) { pegOut(g, b); break; }
      if (vn < 0) {
        const e = p[3] === 2 ? E_PEG : E_WIRE;
        b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
        g.events.push({ type: p[3] === 2 ? 'peg' : 'wire', ball: b.i, speed: -vn });
      }
    }
  }
  // hoop running
  for (const b of B) {
    if (!b.inPlay || b.pegged || b.next >= g.N || b.off) continue;
    const t = c.course[b.next], s = (b.y - t.y) * t.dir, lat = Math.abs(b.x - t.x);
    if (s <= -BALL_R) { b.appr = true; b.thru = false; }
    else if (b.appr && b.prevS < 0 && s >= 0) b.thru = lat < HOOP_HALF_GAP + UPRIGHT_R;
    else if (s < 0 && b.prevS >= 0) b.thru = false;
    if (s >= BALL_R) {
      // a hoop run by the striker's ball after it has made a roquet in the same stroke does not count
      if (b.appr && b.thru && !(g.stroke && g.stroke.kind === 'stroke' && g.stroke.roquet >= 0 && b.i === g.ball)) runHoop(g, b);
      else { b.appr = false; b.thru = false; }
    }
    b.prevS = b.next < g.N ? (b.y - c.course[b.next].y) * c.course[b.next].dir : 0;
  }
}
function contact(g, a, b, speed) {
  g.events.push({ type: 'hit', a: a.i, b: b.i, speed });
  const st = g.stroke;
  if (!st || st.kind !== 'stroke' || st.roquet >= 0) return;
  const s = g.ball; let other = -1;
  if (a.i === s) other = b.i; else if (b.i === s) other = a.i;
  if (other < 0) return;
  if (!g.dead[other] && g.balls[other].inPlay && !g.balls[other].pegged) { st.roquet = other; g.events.push({ type: 'roquet', ball: s, target: other }); }
}
function runHoop(g, b) {
  const idx = b.next;
  b.next++; b.appr = false; b.thru = false;
  g.events.push({ type: 'hoop', ball: b.i, idx });
  const st = g.stroke;
  if (st) st.hoops.push({ ball: b.i, idx, afterRoquet: st.roquet >= 0 });
  if (b.next < g.N) { const t = g.court.course[b.next]; const s = (b.y - t.y) * t.dir; b.appr = s <= -BALL_R; }
  if (st && b.i === g.ball && st.roquet < 0) g.dead = [false, false, false, false];   // striker's ball runs a hoop: all balls live again
}
function pegOut(g, b) {
  b.pegged = true; b.vx = b.vy = 0; b.x = -3 - b.i * 0.3; b.y = g.court.L / 2;
  g.events.push({ type: 'pegout', ball: b.i });
  if (g.stroke) g.stroke.pegged.push(b.i);
}

// ---------------------------------------------------------------------------------------------------------- bookkeeping
function settle(g) {
  const st = g.stroke, s = g.balls[g.ball], c = g.court;
  // replace balls that went off the court
  for (const i of st.off) {
    const b = g.balls[i]; if (b.pegged) continue;
    let [x, y] = yardClamp(g, b.offX, b.offY); [x, y] = clearSpot(g, b, x, y); b.x = x; b.y = y; b.vx = b.vy = 0; hoopState(g, b);
  }
  // non-striker balls in the yard-line band -> yard line
  for (const b of g.balls) {
    if (!b.inPlay || b.pegged || b.i === g.ball || st.off.includes(b.i)) continue;
    if (inBand(g, b)) { let [x, y] = yardClamp(g, b.x, b.y); [x, y] = clearSpot(g, b, x, y); b.x = x; b.y = y; hoopState(g, b); }
  }
  let res = { hoops: st.hoops.filter((h) => h.ball === g.ball && !h.afterRoquet).length, peels: st.hoops.filter((h) => h.ball !== g.ball).length, roquet: -1, endTurn: false, msg: '' };
  // victory?
  for (const side of [0, 1]) if (g.balls.every((b) => b.side !== side || b.pegged)) { g.winner = side; g.phase = 'over'; res.endTurn = true; res.msg = side === 0 ? 'Blue and Black win!' : 'Red and Yellow win!'; g.lastResult = res; g.log.push(res.msg); return res; }
  if (s.pegged) { res.endTurn = true; res.msg = s.name + ' pegged out.'; }
  else if (st.kind === 'croquet') {
    if (st.off.includes(g.ball) || st.off.includes(st.croqueted)) { res.endTurn = true; res.msg = 'Ball off the court in a croquet stroke: turn ends.'; }
    else { g.phase = 'stroke'; res.msg = res.hoops ? 'Hoop! Continuation stroke.' : 'Continuation stroke.'; }
  } else if (st.roquet >= 0) {
    res.roquet = st.roquet; g.dead[st.roquet] = true; g.croquetFrom = st.roquet; g.phase = 'croquet';
    const cb = g.balls[st.roquet];
    if (inBand(g, cb)) { let [x, y] = yardClamp(g, cb.x, cb.y); [x, y] = clearSpot(g, cb, x, y); cb.x = x; cb.y = y; hoopState(g, cb); }
    res.msg = `Roquet on ${cb.name}! Take croquet.`;
  } else if (res.hoops > 0) { g.phase = 'stroke'; res.msg = 'Hoop! Continuation stroke.'; }
  else { res.endTurn = true; res.msg = ''; }
  if (g.strokesThisTurn > 80) res.endTurn = true;   // safety
  if (res.endTurn) endTurn(g);
  g.lastResult = res;
  return res;
}
function endTurn(g) {
  const s = g.balls[g.ball];
  if (s && s.inPlay && !s.pegged && inBand(g, s)) { let [x, y] = yardClamp(g, s.x, s.y); [x, y] = clearSpot(g, s, x, y); s.x = x; s.y = y; hoopState(g, s); }
  if (g.winner >= 0) { g.phase = 'over'; return; }
  g.side = 1 - g.side; g.ball = -1; g.croquetFrom = -1; g.turnNo++; g.dead = [false, false, false, false];
  g.phase = 'select';
  const own = selectable(g);
  if (own.length === 0) { g.side = 1 - g.side; }   // shouldn't happen (would be a win)
}

/** Copy of the game state that can be JSON'd (for multiplayer). */
export function snapshot(g) {
  return { b: g.balls.map((b) => [b.x, b.y, b.inPlay ? 1 : 0, b.pegged ? 1 : 0, b.next, b.appr ? 1 : 0]), side: g.side, ball: g.ball, phase: g.phase, dead: g.dead.map((d) => (d ? 1 : 0)), cf: g.croquetFrom, turnNo: g.turnNo, st: g.strokesThisTurn, w: g.winner, N: g.N };
}
export function restore(g, s) {
  s.b.forEach((a, i) => { const b = g.balls[i]; b.x = a[0]; b.y = a[1]; b.inPlay = !!a[2]; b.pegged = !!a[3]; b.next = a[4]; b.vx = b.vy = 0; hoopState(g, b); b.appr = !!a[5]; });
  g.side = s.side; g.ball = s.ball; g.phase = s.phase; g.dead = s.dead.map((d) => !!d); g.croquetFrom = s.cf; g.turnNo = s.turnNo; g.strokesThisTurn = s.st; g.winner = s.w; g.N = s.N; g.moving = false;
}

// ---------------------------------------------------------------------------------------------------------- AI
const insideYard = (g, x, y, m = 0.3) => { const c = g.court; return x > c.yl * 0.5 + m && x < c.W - c.yl * 0.5 - m && y > c.yl * 0.5 + m && y < c.L - c.yl * 0.5 - m; };
function pathClear(g, ax, ay, bx, by, ignore) {
  // is the straight path from a to b free of other balls?
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  for (const o of g.balls) {
    if (!o.inPlay || o.pegged || ignore.includes(o.i)) continue;
    const t = ((o.x - ax) * dx + (o.y - ay) * dy) / (L * L); if (t <= 0 || t >= 1) continue;
    if (Math.hypot(ax + dx * t - o.x, ay + dy * t - o.y) < 2 * BALL_R + 0.02) return false;
  }
  return true;
}
/** Best ordinary stroke for ball b: {angle, power, score, kind}. */
export function planStroke(g, b) {
  const T = nextTarget(g, b), opts = [];
  const aimTo = (tx, ty, extra, score, kind) => {
    const d = Math.hypot(tx - b.x, ty - b.y); if (d < 1e-4) return;
    const ang = Math.atan2(ty - b.y, tx - b.x), fx = b.x + Math.cos(ang) * (d + extra), fy = b.y + Math.sin(ang) * (d + extra);
    if (!insideYard(g, fx, fy, -0.4)) score *= 0.4;
    opts.push({ angle: ang, power: Math.min(1, speedFor(d + extra) / VMAX), score, kind });
  };
  if (T.peg) {
    const d = Math.hypot(T.x - b.x, T.y - b.y);
    aimTo(T.x, T.y, 0.6, d < 5 ? 90 - d * 8 : 25, 'peg');
  } else {
    const s = (b.y - T.y) * T.dir, lat = b.x - T.x, d = Math.hypot(lat, s);
    if (s < -BALL_R * 1.2) {
      const th = Math.atan2(Math.abs(lat), -s);           // approach angle off the hoop axis
      if (th < 0.62 && d < 9) aimTo(T.x, T.y, 0.9, 110 * (1 - th / 0.7) * Math.min(1, 2.2 / d), 'hoop');
    }
    // approach position in front of the hoop
    const ax = T.x, ay = T.y - T.dir * 0.55;
    if (Math.hypot(ax - b.x, ay - b.y) > 0.15) {
      if (s > -0.2 && Math.abs(lat) < 0.5) aimTo(T.x + (lat >= 0 ? 0.9 : -0.9), T.y - T.dir * 0.3, 0, 18, 'around'); // wrong side: go round
      else aimTo(ax, ay, 0, 22, 'approach');
    }
  }
  // roquets
  for (const o of g.balls) {
    if (o === b || !o.inPlay || o.pegged || g.dead[o.i]) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d > 14 || !pathClear(g, b.x, b.y, o.x, o.y, [b.i, o.i])) continue;
    aimTo(o.x, o.y, 1.0, (d < 1.5 ? 95 : 70 * Math.min(1, 3 / d)) * (o.side === b.side ? 1.05 : 1), 'roquet');
  }
  opts.sort((p, q) => q.score - p.score);
  return opts[0] || { angle: g.rng() * 6.28, power: 0.2, score: 0, kind: 'random' };
}
/** Plan the croquet stroke: {angle, split, power}. */
export function planCroquet(g) {
  const s = g.balls[g.ball], c = g.balls[g.croquetFrom], T = nextTarget(g, s);
  const sx = T.peg ? T.x - 0.45 : T.x, sy = T.peg ? T.y : T.y - T.dir * 0.55;      // where the striker wants to end
  const cands = [];
  const add = (cx, cy) => {
    const [px, py] = yardClamp(g, cx, cy);
    let ac = Math.atan2(py - c.y, px - c.x); if (Math.hypot(px - c.x, py - c.y) < 0.05) ac = Math.atan2(sy - c.y, sx - c.x);
    const as = Math.atan2(sy - c.y, sx - c.x), split = Math.max(-1.42, Math.min(1.42, wrap(as - ac)));
    const [fc, fs] = splitFactors(split), ds = Math.hypot(sx - c.x, sy - c.y);
    const V = Math.min(VMAX, speedFor(ds) / fs), dc = rollDistance(V * fc);
    const ex = c.x + Math.cos(ac) * dc, ey = c.y + Math.sin(ac) * dc;
    const fsx = c.x + Math.cos(ac + split) * rollDistance(V * fs), fsy = c.y + Math.sin(ac + split) * rollDistance(V * fs);
    let score = -Math.hypot(fsx - sx, fsy - sy) * 3 - Math.hypot(ex - px, ey - py) * 0.5;
    if (!insideYard(g, ex, ey, 0.2)) score -= 50;
    if (!insideYard(g, fsx, fsy, 0.2)) score -= 50;
    cands.push({ angle: ac, split, power: Math.max(0.03, V / VMAX), score });
  };
  if (!T.peg) { add(T.x, T.y + T.dir * 1.6); add(T.x + 1.2, T.y + T.dir * 2.5); add(T.x - 1.2, T.y + T.dir * 2.5); }
  add(c.x + (sx - c.x) * 0.3, c.y + (sy - c.y) * 0.3);  // roll
  for (const a of [-1.35, 1.35, -0.8, 0.8]) { const as = Math.atan2(sy - c.y, sx - c.x) - a; add(c.x + Math.cos(as) * 1.5, c.y + Math.sin(as) * 1.5); }
  cands.sort((p, q) => q.score - p.score);
  return cands[0];
}
/** AI move for the current phase -> one of {type:'select',ball} {type:'place',baulk,t} {type:'shoot',angle,power} {type:'croquet',angle,split,power}. skill 0..1. */
export function aiMove(g, skill = 0.55) {
  const r = g.rng, err = (1.25 - skill);
  if (g.phase === 'select') {
    let best = -1, bs = -1e9;
    for (const i of selectable(g)) {
      const b = g.balls[i]; let sc;
      if (!b.inPlay) sc = 15 + r() * 4;
      else sc = planStroke(g, b).score + r() * 5;
      if (sc > bs) { bs = sc; best = i; }
    }
    return { type: 'select', ball: best };
  }
  if (g.phase === 'place') {
    const b = g.balls[g.ball], T = nextTarget(g, b);
    const t = Math.max(0, Math.min(1, (T.x - g.court.yl) / (g.court.W / 2 - g.court.yl) + (r() - 0.5) * 0.2));
    return { type: 'place', baulk: 'A', t };
  }
  if (g.phase === 'stroke') {
    const p = planStroke(g, g.balls[g.ball]);
    return { type: 'shoot', angle: p.angle + r.gauss() * 0.03 * err, power: Math.max(0.02, Math.min(1, p.power * (1 + r.gauss() * 0.07 * err))) };
  }
  if (g.phase === 'croquet') {
    const p = planCroquet(g);
    return { type: 'croquet', angle: p.angle + r.gauss() * 0.04 * err, split: p.split + r.gauss() * 0.05 * err, power: Math.max(0.03, Math.min(1, p.power * (1 + r.gauss() * 0.08 * err))) };
  }
  return null;
}
/** Apply an action object (from aiMove or the network). Returns true if legal. */
export function apply(g, m) {
  if (!m) return false;
  if (m.type === 'select') return select(g, m.ball);
  if (m.type === 'place') return place(g, m.baulk, m.t);
  if (m.type === 'shoot') return shoot(g, m.angle, m.power);
  if (m.type === 'croquet') return croquetShot(g, m.angle, m.split, m.power);
  return false;
}
