// Cellar Bar pool: the coin-op 7 ft table in the pool room. English 8-ball as played in a college bar: alone (practice),
// against a bar regular, or against another player; anyone else in the bar sees the table, the balls and the shooter.
// Physics, rules and the regular's shot choice: _bar_pool_physics.js (pure; tools/smoke_bar_games.mjs).
//
// Playing: always through your own eyes, at the table (there is no other view), and the mouse is held from the first
// frame to the last as it is in ordinary play. On your shot you are behind the white, looking along the cue: the mouse
// turns the cue round the white, as far round as it is moved (you go round with it); press and hold, draw the mouse
// BACK to pull the cue back, let go to strike — how far it was drawn is how hard. Pushing it forward again before
// letting go cancels. W takes the eye up, as far as standing behind the shot for a broad view of the table; S takes it
// down, as far as the chin on the cue for sighting a long one (the mouse wheel does the same). It is the head that
// moves: the body really gets down (the back flatter, the hips back and lower, the knees bent, the feet where they
// were) or straightens up, the cue turns more finely the lower you are, and the height is kept from shot to shot
// (and between visits: flags.poolEye). The up / down arrows move the tip for top and back spin, A / D for side,
// X centre ball; the left / right arrows turn the cue a touch. With the white in hand you stand behind baulk, it lies
// where you look and a click puts it down. There is NO aiming line: at most a faint ring where the white would first
// touch a ball, and G switches even that off (remembered; `?poolghost=0` starts with it off).
// After the stroke the eye stays exactly where it was, and the mouse looks about from there, until the balls have
// stopped; then you are behind the white for the next shot. While somebody else is on the table you stand by it and
// look where you like.
//
// Where everything is comes from the table's own frame (LAY.table: the middle of the cloth, and `rot` if it is ever
// turned in the room) and the room's walls (LAY.pool): nothing here is a fixed place in the room, and the eye and the
// feet are held inside the walls (the eye comes forward along the cue rather than pass through one).
//
// Over the wire ('pool' relay events; nothing when nobody else is in the bar):
//   to one player:  {op:'challenge', to, name}   {op:'accept', to}   {op:'quit', to}
//   to the room:    {op:'aim', a, pl, u?, lo?, up?}   5 Hz while a player is on a shot: cue angle (mrad), pull (0..100);
//                                                 u: 1 while they stand with the white in hand;
//                                                 lo: 1..100, how far down over the cue their head is from the plain
//                                                 stance; up: 1..100, how far they have straightened up from it
//                   {op:'shot', a, p, top, side, cx, cy, n}   the strike: every client runs the same fixed-step physics
//                   {op:'st', n, s, mode, ids, ph}             the table after a shot has settled (PoolGame.snapshot():
//                                                               16 balls to 0.1 mm, turn, colours, visits, message),
//                                                               on starting / leaving, and every 3 s for late arrivals
// The shooter's own figure travels in the ordinary player state (they stand at the table in the 'lean' pose); watchers
// bend it over the cue from 'aim'.
import * as THREE from 'three';
import * as PP from './_bar_pool_physics.js';
import { LAY } from './_bar_build.js';
import { Geo, staticMesh } from './_bar_geo.js';

const TB = LAY.table, PF = LAY.pool.floor, CLOTH = PF + 0.80;
const L2 = PP.TABLE.L / 2, W2 = PP.TABLE.W / 2, OUT_X = L2 + 0.165, OUT_Z = W2 + 0.165;      // (OUT: over the rails)
// The table's frame in the room. Table coordinates (tx along the table, ty across: _bar_pool_physics.js) are placed by
// LAY.table: {x, z} the middle of the cloth and `rot` (radians; 0 when absent) turning the table's +x from the room's
// +x towards its +z. Everything in this file goes through these, so the table can be moved or turned in the plan.
const rot = () => TB.rot || 0;
const wX = (tx, ty) => TB.x + tx * Math.cos(rot()) - ty * Math.sin(rot()), wZ = (tx, ty) => TB.z + tx * Math.sin(rot()) + ty * Math.cos(rot());
const tX = (x, z) => (x - TB.x) * Math.cos(rot()) + (z - TB.z) * Math.sin(rot()), tY = (x, z) => -(x - TB.x) * Math.sin(rot()) + (z - TB.z) * Math.cos(rot());
/** the game's yaw (forward = sin, cos) looking along a table angle */
const yawOf = (a) => Math.atan2(Math.cos(a + rot()), Math.sin(a + rot()));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const REGULAR = { name: 'Ollie', look: { outfit: 'casual', hair: 0x6a4a2a, hairStyle: 'curly', top: 0x2a4a6a, topStyle: 'hoodie' }, skill: { aimSigma: 0.0035, powerSigma: 0.09, nerve: 0.2 } };
const BALL_COL = { cue: 0xf3efe2, red: 0xc0121a, yellow: 0xf0bc10, black: 0x0b0b0c };
const CUE_LEN = 1.45, PULL_MAX = 0.26, BRIDGE = 0.2;
// what the regular (or anyone watching) says: bubbles only. New lines, listed for the voice render.
export const POOL_LINES = {
  pot: ['Shot.', 'Nice.', 'Good pot.', 'Tidy.'],
  miss: ['Unlucky.', 'Close.', 'Rattled it.', 'Ooh. Jaws.'],
  foul: ['Two shots.', 'Foul, that. Two shots.', 'In-off. Two shots to me.'],
  breakOff: ['Good break.', 'Smashed them.', 'Not much of a split.'],
  turn: ['My go.', 'Right then.', 'Watch this.'],
  onBlack: ['On the black.', 'Black for the frame.'],
  watch: ['Winner stays on.', 'Who is next on the table?', 'Coins are on the rail.'],
};
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length) % a.length];
const lerp = (a, b, t) => a + (b - a) * t;

function clothTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#12843a'; g.fillRect(0, 0, 256, 128);
  // the nap: fine streaks along the table, lying towards the top cushion (lighter looking down it)
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 2600; i++) { const y = r() * 128, x = r() * 256, w = 6 + r() * 22; g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,30,10,0.05)'; g.fillRect(x, y, w, 0.7); }
  for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(210,230,255,0.03)'; g.beginPath(); g.ellipse(r() * 256, r() * 128, 3 + r() * 8, 2 + r() * 4, r() * 3, 0, Math.PI * 2); g.fill(); }   // chalk
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/** The static table, in the table frame (origin: centre of the cloth at floor level; x along the table, z across). */
function buildTable(mats) {
  const wood = new Geo(), gloss = new Geo(), cloth = new Geo();
  const Y = CLOTH, RAIL_H = 0.038, NOSE_H = 0.031, CUSH = 0.05, RAIL_W = OUT_X - L2 - CUSH;
  const MAHOG = 0x7a3018, MAHOG_D = 0x5a2212, EDGE = 0x2a211c;      // (lit from straight above: the sides need the lighter stain to read as wood)
  // ---- cabinet: a deep body set in under the top frame, four square legs, a plinth strip
  wood.col(MAHOG).box(0, PF + 0.3, 0, (OUT_X - 0.05) * 2, 0.36, (OUT_Z - 0.05) * 2, 0, 'nsewb');
  // fielded panels on the long sides and a darker kick strip, so the cabinet is not one slab
  for (const sz of [-1, 1]) { for (const px of [-0.62, 0.05, 0.62]) if (!(sz > 0 && px < -0.3)) wood.col(MAHOG, 1.25).box(px, PF + 0.36, sz * (OUT_Z - 0.05 + 0.004), 0.5, 0.24, 0.008, 0, sz > 0 ? 'stbew' : 'ntbew'); wood.col(0x1a100c).box(0, PF + 0.3, sz * (OUT_Z - 0.05 + 0.003), (OUT_X - 0.05) * 2, 0.035, 0.006, 0, sz > 0 ? 'stbew' : 'ntbew'); }
  const railY = Y + RAIL_H - 0.012, RT = Y + RAIL_H, bx = L2 + CUSH, bz = W2 + CUSH;
  wood.col(MAHOG_D).box(0, PF + 0.66, 0, OUT_X * 2, railY - (PF + 0.66), OUT_Z * 2, 0, 'nsewb');      // the top frame's apron
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { wood.col(MAHOG_D).box(sx * (OUT_X - 0.16), PF + 0.03, sz * (OUT_Z - 0.14), 0.13, 0.27, 0.13, 0, 'nsew'); gloss.col(0x9a9aa0).cyl(sx * (OUT_X - 0.16), PF, sz * (OUT_Z - 0.14), 0.05, 0.04, 0.03, 10); }
  // ---- top rails (lacquered), with the dark plastic corner and middle pocket plates. The frame is CLOSED from every
  // side it can be seen from (the eye comes down to the cue now: tools/smoke_bar_games.mjs looks through it from all
  // round): the rails' outer edge down to the apron, a top over every part of the ring between the cloth and that edge
  // (rail or plate, no gaps between them), the rails' inner faces where a pocket opens between a cushion's end and
  // the cup, and the cups' walls and floors behind the holes.
  const pk = PP.POCKETS.map((p) => ({ p, r: p.kind === 'corner' ? 0.05 : 0.052, x: p.x + p.ax * 0.012, z: p.y + p.ay * 0.012 }));
  const CUP = 0.004, chord = (R, d) => Math.sqrt(Math.max(0, R * R - d * d));
  const pc = pk.find((q) => q.p.kind === 'corner' && q.x > 0 && q.z > 0), pm = pk.find((q) => q.p.kind === 'middle' && q.z > 0);
  // (where the cups' walls cross the lines of the cloth's edges: the rails run between those points, the plates lie over the rest)
  const xm = chord(pm.r + CUP, bz - pm.z), xc = pc.x - chord(pc.r + CUP, bz - pc.z), zc = pc.z - chord(pc.r + CUP, bx - pc.x);
  wood.col(MAHOG, 1.15).box(0, railY, 0, OUT_X * 2, RT - railY, OUT_Z * 2, 0, 'nsew');
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    wood.col(MAHOG, 1.15).box(sx * (xm + xc) / 2, Y, sz * (bz + OUT_Z) / 2, xc - xm, RAIL_H, RAIL_W, 0, 't');
    wood.col(EDGE).box(sx * (xm + xc) / 2, Y, sz * (bz + OUT_Z) / 2, xc - xm, RAIL_H, RAIL_W, 0, sz > 0 ? 'n' : 's');
  }
  for (const sx of [-1, 1]) { wood.col(MAHOG, 1.15).box(sx * (bx + OUT_X) / 2, Y, 0, RAIL_W, RAIL_H, zc * 2, 0, 't'); wood.col(EDGE).box(sx * (bx + OUT_X) / 2, Y, 0, RAIL_W, RAIL_H, zc * 2, 0, sx > 0 ? 'w' : 'e'); }
  wood.col(EDGE);
  for (const sz of [-1, 1]) wood.box(0, RT, sz * (bz + OUT_Z) / 2, xm * 2, 0.001, RAIL_W, 0, 'tnsew');                      // middle pocket plates
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {                                                                      // corner plates
    wood.box(sx * (xc + OUT_X) / 2, RT, sz * (bz + OUT_Z) / 2, OUT_X - xc, 0.001, RAIL_W, 0, 'tnsew');
    wood.box(sx * (bx + OUT_X) / 2, RT, sz * (zc + bz) / 2, RAIL_W, 0.001, bz - zc, 0, 'tnsew');
  }
  // sights (the little inlaid dots) on the rails
  gloss.col(0xe8dfc8);
  for (let i = 1; i < 8; i++) if (i !== 4) for (const sz of [-1, 1]) gloss.disc(-L2 + (i * PP.TABLE.L) / 8, railY + 0.0128, sz * (W2 + CUSH + RAIL_W / 2), 0.0055, 8);
  for (let i = 1; i < 4; i++) for (const sx of [-1, 1]) gloss.disc(sx * (L2 + CUSH + RAIL_W / 2), railY + 0.0128, -W2 + (i * PP.TABLE.W) / 4, 0.0055, 8);
  // ---- the bed: one sheet of cloth out to the rails' inner faces, lighter looking down the nap
  const uvS = 1 / 0.55;
  { const N = 6; for (let i = 0; i < N; i++) { const x0 = -bx + (2 * bx * i) / N, x1 = -bx + (2 * bx * (i + 1)) / N; cloth.col(0xffffff, lerp(0.9, 1.06, (i + 0.5) / N)); cloth.quad([x0, Y, bz], [x1, Y, bz], [x1, Y, -bz], [x0, Y, -bz], [[x0 * uvS, bz * uvS], [x1 * uvS, bz * uvS], [x1 * uvS, -bz * uvS], [x0 * uvS, -bz * uvS]]); } }
  // ---- cushions: a cloth-covered wedge along every nose (top slopes up to the rail, the face is undercut), and the
  // rounded jaws at the pockets (the same circles the balls bounce off)
  cloth.col(0xffffff, 0.86);
  for (const s of PP.SEGMENTS) {
    const ex = s.x2 - s.x1, ez = s.y2 - s.y1, len = Math.hypot(ex, ez), tx = ex / len, tz = ez / len, ox = -s.nx, oz = -s.ny;
    const P = (t, d, y) => [s.x1 + tx * t + ox * d, Y + y, s.y1 + tz * t + oz * d];
    const k = Math.abs(tx) > 0.5 ? uvS : 0, kz = k ? 0 : uvS, uv = (t) => [(s.x1 + tx * t) * k + (s.y1 + tz * t) * kz, 0.3];
    const flip = tx * oz - tz * ox > 0;      // keep the faces outward whichever way the segment runs
    const q = (a, b, c, d, u0, u1) => (flip ? cloth.quad(a, d, c, b, [u0, u0, u1, u1]) : cloth.quad(a, b, c, d, [u0, u1, u1, u0]));
    q(P(0, 0, NOSE_H), P(len, 0, NOSE_H), P(len, CUSH, RAIL_H), P(0, CUSH, RAIL_H), uv(0), uv(len));          // top
    cloth.col(0xffffff, 0.6); q(P(0, 0.014, 0), P(len, 0.014, 0), P(len, 0, NOSE_H), P(0, 0, NOSE_H), uv(0), uv(len)); cloth.col(0xffffff, 0.86);   // undercut face
    // the ends, at the pockets (behind the jaws: without them the wedge is open, and seen through from the low eye)
    cloth.col(0xffffff, 0.7);
    for (const t of [0, len]) { const e = [P(t, 0.014, 0), P(t, 0, NOSE_H), P(t, CUSH, RAIL_H), P(t, CUSH, 0)], out = (t ? 1 : -1) * (flip ? -1 : 1) < 0; cloth.quad(...(out ? e : e.slice().reverse()), [uv(t), uv(t), uv(t), uv(t)]); }
    cloth.col(0xffffff, 0.86);
  }
  for (const j of PP.JAWS) cloth.col(0xffffff, 0.8).cyl(j.x, Y, j.y, j.r - 0.006, j.r, NOSE_H, 10).cyl(j.x, Y + NOSE_H, j.y, j.r, j.r * 0.4, RAIL_H - NOSE_H + 0.004, 10);
  // ---- pockets: the drop (black), a leather-dark cup rising behind it
  const black = new Geo();
  for (const { p } of pk) {
    const r = p.kind === 'corner' ? 0.05 : 0.052, cx = p.x + p.ax * 0.012, cz = p.y + p.ay * 0.012;
    black.col(0x030303).disc(cx, Y + 0.0012, cz, r, 18).disc(cx, Y - 0.002, cz, r + CUP + 0.005, 18);      // (the second: the cup's floor where the hole runs on under the plate, past the cloth's edge)
    // (the wall runs round the back of the hole from one edge of the cloth to the other, where the rails' inner faces take over)
    const a = Math.atan2(p.ay, p.ax), half = p.kind === 'corner' ? Math.PI / 4 + Math.acos((bx - Math.abs(cx)) / (r + CUP)) : Math.PI / 2 + Math.asin((bz - Math.abs(cz)) / (r + CUP));
    wood.col(0x1a120e).cyl(cx, Y, cz, r + CUP, r + CUP, RAIL_H, 16, { a0: a - half, a1: a + half, inside: true, top: false });
  }
  // ---- markings: baulk line, the D, the spots
  const mark = new Geo(); mark.col(0xeeeadc);
  const my = Y + 0.0009;
  mark.box(PP.BAULK_X, my, 0, 0.003, 0.0001, PP.TABLE.W, 0, 't');
  { const N = 20; for (let i = 0; i < N; i++) { const a0 = Math.PI / 2 + (Math.PI * i) / N, a1 = Math.PI / 2 + (Math.PI * (i + 1)) / N, r0 = PP.D_R - 0.0015, r1 = PP.D_R + 0.0015, y = my + 0.0001;
    mark.quad([PP.BAULK_X + Math.cos(a0) * r1, y, Math.sin(a0) * r1], [PP.BAULK_X + Math.cos(a0) * r0, y, Math.sin(a0) * r0], [PP.BAULK_X + Math.cos(a1) * r0, y, Math.sin(a1) * r0], [PP.BAULK_X + Math.cos(a1) * r1, y, Math.sin(a1) * r1]); } }
  mark.col(0x101010).disc(PP.BLACK_X, my, 0, 0.006, 10); mark.col(0xeeeadc).disc(PP.BAULK_X, my + 0.0002, 0, 0.005, 10).disc(0, my, 0, 0.004, 10);
  // ---- coin mechanism on the south side near baulk: a chrome plate, the push chute with its coin slots, the reject
  const cz = OUT_Z - 0.05, cmx = -0.5;
  gloss.col(0xb9bcc0).box(cmx, PF + 0.44, cz + 0.004, 0.2, 0.14, 0.008, 0, 'snewt');
  gloss.col(0x8d9094).box(cmx, PF + 0.475, cz + 0.045, 0.15, 0.03, 0.09, 0, 'snewtb');
  gloss.col(0x1a1a1c); for (let i = 0; i < 4; i++) gloss.box(cmx - 0.048 + i * 0.032, PF + 0.5052, cz + 0.05, 0.004, 0.0004, 0.024, 0, 't');
  gloss.col(0x202022).box(cmx + 0.06, PF + 0.545, cz + 0.0085, 0.03, 0.02, 0.001, 0, 's');
  // ---- ball return at the baulk end: the white drops into an open tray; the colours stay locked in behind a window
  const ex = -(OUT_X - 0.05);
  wood.col(0x0a0808).box(ex - 0.002, PF + 0.36, 0.22, 0.004, 0.1, 0.3, 0, 'wnst');
  gloss.col(0x6d7074).box(ex - 0.04, PF + 0.345, 0.22, 0.08, 0.015, 0.3, 0, 'tbnsew').box(ex - 0.079, PF + 0.36, 0.22, 0.004, 0.035, 0.3, 0, 'tnsew');
  wood.col(0x0a0808).box(ex - 0.002, PF + 0.4, -0.24, 0.004, 0.07, 0.36, 0, 'wnst');
  gloss.col(0x30383c).box(ex - 0.0045, PF + 0.405, -0.24, 0.001, 0.06, 0.35, 0, 'w');
  // ---- chalk on the rails (blue cubes, a worn hollow in the top)
  for (const [x, z, ry] of [[-0.62, W2 + CUSH + 0.06, 0.3], [L2 + CUSH + 0.06, -0.21, 1.1], [0.4, -(W2 + CUSH + 0.07), 0.7]]) { wood.col(0x2356a8).box(x, railY + 0.012, z, 0.022, 0.0195, 0.022, ry, 'nsew'); wood.col(0x3a78c8).box(x, railY + 0.012, z, 0.022, 0.0195, 0.022, ry, 't'); wood.col(0x1c3f7c).box(x, railY + 0.012, z, 0.013, 0.0199, 0.013, ry, 't'); }
  const g = new THREE.Group(); g.name = 'pool:table'; g.position.set(TB.x, 0, TB.z); g.rotation.y = -rot();
  g.add(staticMesh(wood.build(), mats.col, 'pool:wood'), staticMesh(gloss.build(), mats.gloss, 'pool:metal'), staticMesh(cloth.build(true), mats.cloth, 'pool:cloth'),
    staticMesh(black.build(), mats.flat, 'pool:pockets'), staticMesh(mark.build(), mats.flat, 'pool:marks'));
  g.children[3].renderOrder = 1; g.children[4].renderOrder = 2;
  g.matrixAutoUpdate = false; g.updateMatrix(); g.updateMatrixWorld(true);
  return { group: g, tris: wood.tris + gloss.tris + cloth.tris + black.tris + mark.tris };
}

/** a cue lying along +x from the butt (x = -CUE_LEN) to the tip (x = 0): ash shaft, spliced dark butt, ferrule, tip */
function cueGeo(buttCol = 0x1a0d08) {
  const g = new Geo();
  g.col(0x2f62b0).rod([-0.004, 0, 0], [0, 0, 0], 0.0048, 0.0044, 8);                      // chalked tip
  g.col(0xe9e2cf).rod([-0.018, 0, 0], [-0.004, 0, 0], 0.005, 0.0049, 8, false);           // ferrule
  g.col(0xd8b071).rod([-0.86, 0, 0], [-0.018, 0, 0], 0.0105, 0.005, 8, false);             // ash shaft
  g.col(buttCol).rod([-CUE_LEN, 0, 0], [-0.86, 0, 0], 0.0145, 0.0105, 8, true);
  g.col(0x9a7a40).rod([-0.875, 0, 0], [-0.86, 0, 0], 0.0108, 0.0106, 8, false);            // brass joint
  return g.build();
}

/** fixtures on the walls of the pool room: the rest and a spare cue on hooks (the cue rack itself is the room's) */
function buildFittings(mats) {
  const g = new Geo(), P = LAY.pool, x = P.X0 + 0.07, y = PF + 0.42, z0 = P.Z0;      // (along the west wall from its north corner)
  g.col(0x8a8d90); for (const z of [z0 + 0.42, z0 + 1.52]) { g.box(x - 0.02, y - 0.02, z, 0.06, 0.012, 0.012, 0, 'tbnsew'); g.box(x + 0.012, y - 0.02, z, 0.008, 0.035, 0.012, 0, 'tbnsew'); }
  g.col(0xd8b071).rod([x, y, z0 + 0.25], [x, y, z0 + 1.66], 0.008, 0.006, 6);                         // the rest's shaft
  g.col(0xb08d3c); for (const s of [-1, 1]) g.rod([x, y - 0.035, z0 + 1.68 - 0.035 * s], [x, y + 0.035, z0 + 1.68 + 0.035 * s], 0.004, 0.004, 5);   // its brass cross head
  return staticMesh(g.build(), mats.gloss, 'pool:fittings');
}

// ------------------------------------------------------------------------------------------------ the shooter's body
/**
 * Bend a character over a shot (bones only; call after its own update). s: {down 0..1 (how far into the stance),
 * reach 0..1 (how far over the table), swing: -1 (cue drawn right back) .. 0 (address) .. +0.7 (through the ball)}.
 * The base pose is 'lean' (hips back, feet planted); this takes the torso down to the cue, puts the bridge arm out
 * along it, hangs the grip forearm from a high elbow and lifts the chin. A player who has straightened up from the
 * shot (the eye taken up: s.down well under 1, s.rise) is the same stance less far into it, both hands still on the cue.
 */
export function poolStance(ch, s) {
  const b = ch.bones, d = s.down; if (!b || d <= 0.01) return;
  // The torso goes down over the cue (angles fitted numerically on the game's own skeleton, standing at
  // shooterSpot()); then each arm is solved to its place on the cue for THIS body (people are different heights): the
  // bridge hand on the cloth behind the white (s.tb), the grip hand on the butt under a high elbow (s.tg), which goes
  // back and through with the cue. Without targets (or with the stance only half taken up) the fitted arm angles.
  // s.low 0..1: lower still, to sight along the cue (the back nearly flat, the chin lifted; lowStance: hips and legs)
  const lo = Math.max(0, Math.min(1, s.low || 0)) * d;
  const th = 1.206 + 0.12 * s.reach + (LOW.back - 0.12 * s.reach) * lo;
  const mix = (r, x, y, z) => { r.x += (x - r.x) * d; r.y += (y - r.y) * d; r.z += (z - r.z) * d; };
  mix(b.torso.rotation, th, 0.095, 0.06); mix(b.head.rotation, -0.62 * th + (LOW.chin - th + 0.62 * th) * lo, -0.08, 0);
  if (lo > 0.01 && s.tb && s.tg && ch.dims && ch.head && ch.head.localToWorld && ch._footL && ch._footR && b.rig && b.thighL && b.shinL) lowStance(ch, s, lo);
  if (s.tb && s.tg && d > IK0 && ch.anchors && ch.anchors.handL) {
    // (the hands come onto the cue over the first part of getting down — and stay on it for a player part of the way up)
    const w = Math.min(1, (d - IK0) / 0.08), arms = w < 1 ? [b.armL, b.foreL, b.armR, b.foreR] : null, was = arms ? arms.map((o) => [o.rotation.x, o.rotation.y, o.rotation.z]) : null;
    ch.group.updateMatrixWorld(true);
    const qL = s.qL || (s.qL = [-2.012, -0.172, -0.472]), qR = s.qR || (s.qR = [0.817, -0.438, -1.965]);
    s.eL = reachTo(b.armL, b.foreL, ch.anchors.handL, s.tb, qL, 3, QMIN, lo > 0.01 ? LOW_ARM_MAX : QMAX, (s.twL ?? LOW.twist) * lo); s.eR = reachTo(b.armR, b.foreR, ch.anchors.handR, s.tg, qR);      // (low: the bridge arm's elbow turns out along the cloth, it does not drop through the rail)
    if (arms) arms.forEach((o, i) => o.rotation.set(was[i][0] + (o.rotation.x - was[i][0]) * w, was[i][1] + (o.rotation.y - was[i][1]) * w, was[i][2] + (o.rotation.z - was[i][2]) * w));
    return;
  }
  const sw = s.swing < 0 ? -0.9 * s.swing : -0.35 * s.swing;
  mix(b.armL.rotation, -2.012 - 0.1 * s.reach, 0, -0.172); mix(b.foreL.rotation, -0.472 + 0.3 * s.reach, 0, 0);
  mix(b.armR.rotation, 0.817, 0, -0.438); mix(b.foreR.rotation, -1.965 + sw, 0, 0);
}
const _fk0 = [0, 0, 0], _fk1 = [0, 0, 0], _J = [0, 0, 0, 0, 0, 0, 0, 0, 0], QMIN = [-3.1, -1.3, -2.7], QMAX = [1.7, 1.3, 0], IK0 = 0.05;
// the low stance: torso angle from upright; the head's pitch below level; where the head's centre comes to — along the
// cue behind the white, and over the cloth (the chin a finger over the cue); the legs' limits (thigh x, z; knee)
const LOW = { back: 0.27, chin: 0.2, along: 0.66, up: 0.23, twist: -1.0 }, LEG_MIN = [-2.3, -0.9, 0.02], LEG_MAX = [0.9, 0.9, 2.6];
const LOW_ARM_MAX = [1.7, 1.75, 0];
const _la = new THREE.Vector3(), _lb = new THREE.Vector3(), _lh = new THREE.Vector3();
/** The hips go back and down until the head (as the torso now has it) is at LOW.along / LOW.up over the cue, by lo of
 *  the way; the legs bend to keep the feet where the plain stance has them; the soles stay flat. */
function lowStance(ch, s, lo) {
  const b = ch.bones, g = ch.group;
  g.updateMatrixWorld(true);
  _la.setFromMatrixPosition(ch._footL.matrixWorld); _lb.setFromMatrixPosition(ch._footR.matrixWorld);
  let dx = s.tb.x - s.tg.x, dz = s.tb.z - s.tg.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  _lh.set(0, ch.dims.headC || 0.12, 0); ch.head.localToWorld(_lh);
  const along = (s.tb.x + dx * 0.25 - _lh.x) * dx + (s.tb.z + dz * 0.25 - _lh.z) * dz;
  const back = Math.max(-0.15, Math.min(0.34, LOW.along - along)) * lo, drop = Math.max(0, Math.min(0.4, _lh.y - (s.tb.y - 0.05 + LOW.up))) * lo;
  const h = g.rotation.y, c = Math.cos(h), sn = Math.sin(h), X = -dx * back, Z = -dz * back;
  b.rig.position.x += X * c - Z * sn; b.rig.position.z += X * sn + Z * c; b.rig.position.y -= drop;
  g.updateMatrixWorld(true);
  s.eLL = reachTo(b.thighL, b.shinL, ch._footL, _la, s.qLL || (s.qLL = [-0.5, b.thighL.rotation.z, 0.9]), 3, LEG_MIN, LEG_MAX);
  s.eLR = reachTo(b.thighR, b.shinR, ch._footR, _lb, s.qLR || (s.qLR = [-0.5, b.thighR.rotation.z, 0.9]), 3, LEG_MIN, LEG_MAX);
  ch._footL.rotation.x = -(b.thighL.rotation.x + b.shinL.rotation.x); ch._footR.rotation.x = -(b.thighR.rotation.x + b.shinR.rotation.x);
}
/** Two-bone reach: turn arm (rotation x, z) and forearm (x) so that `hand` comes to the world point `target`.
 *  q = [arm x, arm z, fore x] is the running solution (warm-started from the last frame). A few damped
 *  Gauss-Newton steps on a finite-difference Jacobian; returns the distance still to go (m). */
function reachTo(arm, fore, hand, target, q, iters = 3, qmin = QMIN, qmax = QMAX, twist = 0) {
  const fk = (out) => { arm.rotation.set(q[0], twist, q[1]); fore.rotation.set(q[2], fore.rotation.y, 0); arm.updateMatrixWorld(true); const m = hand.matrixWorld.elements; out[0] = m[12]; out[1] = m[13]; out[2] = m[14]; };
  for (let it = 0; it < iters; it++) {
    fk(_fk0);
    const ex = target.x - _fk0[0], ey = target.y - _fk0[1], ez = target.z - _fk0[2];
    if (ex * ex + ey * ey + ez * ez < 9e-6) break;
    for (let k = 0; k < 3; k++) { q[k] += 0.02; fk(_fk1); q[k] -= 0.02; _J[k] = (_fk1[0] - _fk0[0]) / 0.02; _J[3 + k] = (_fk1[1] - _fk0[1]) / 0.02; _J[6 + k] = (_fk1[2] - _fk0[2]) / 0.02; }
    // (J^T J + l I) dq = J^T e
    const l = 0.004, A = [0, 0, 0, 0, 0, 0, 0, 0, 0], g = [0, 0, 0];
    for (let i = 0; i < 3; i++) { g[i] = _J[i] * ex + _J[3 + i] * ey + _J[6 + i] * ez; for (let j = 0; j < 3; j++) A[i * 3 + j] = _J[i] * _J[j] + _J[3 + i] * _J[3 + j] + _J[6 + i] * _J[6 + j] + (i === j ? l : 0); }
    const det = A[0] * (A[4] * A[8] - A[5] * A[7]) - A[1] * (A[3] * A[8] - A[5] * A[6]) + A[2] * (A[3] * A[7] - A[4] * A[6]);
    if (!(Math.abs(det) > 1e-12)) break;
    const dq = [
      (g[0] * (A[4] * A[8] - A[5] * A[7]) - A[1] * (g[1] * A[8] - A[5] * g[2]) + A[2] * (g[1] * A[7] - A[4] * g[2])) / det,
      (A[0] * (g[1] * A[8] - A[5] * g[2]) - g[0] * (A[3] * A[8] - A[5] * A[6]) + A[2] * (A[3] * g[2] - g[1] * A[6])) / det,
      (A[0] * (A[4] * g[2] - g[1] * A[7]) - A[1] * (A[3] * g[2] - g[1] * A[6]) + g[0] * (A[3] * A[7] - A[4] * A[6])) / det];
    const n = Math.hypot(dq[0], dq[1], dq[2]), k = n > 0.6 ? 0.6 / n : 1;
    for (let i = 0; i < 3; i++) q[i] = Math.max(qmin[i], Math.min(qmax[i], q[i] + dq[i] * k));
  }
  fk(_fk0);
  return Math.hypot(target.x - _fk0[0], target.y - _fk0[1], target.z - _fk0[2]);
}
const STANCE = { back: 0.976, lat: 0.224, open: 0.397 };
/** where the shooter stands for a white at (cx, cy) and a cue angle a (table frame): -> {x, z (world), h, reach} */
export function shooterSpot(cx, cy, a, out = {}) {
  const dx = Math.cos(a), dy = Math.sin(a), ex = L2 + 0.3, ey = W2 + 0.3;
  // the hips: back along the cue from the white and a hand to the left of it; never inside the table, always in the room
  let back = STANCE.back, x = 0, y = 0;
  for (let k = 0; k < 40; k++) { x = cx - dx * back + dy * STANCE.lat; y = cy - dy * back - dx * STANCE.lat; if (Math.abs(x) > ex || Math.abs(y) > ey) break; back += 0.04; }
  // (the room's walls are the room's axes, whichever way the table lies in it: a body's half-width off each, more off
  //  the west one for what stands along it: the chest freezer and the heater, _bar_plan.js LAY.pool)
  const R = LAY.pool, inRoom = () => { out.x = clamp(wX(x, y), R.X0 + 0.72, R.X1 - 0.28); out.z = clamp(wZ(x, y), R.Z0 + 0.28, R.Z1 - 0.28); x = tX(out.x, out.z); y = tY(out.x, out.z); };
  inRoom();
  if (Math.abs(x) < ex && Math.abs(y) < ey) { if (ex - Math.abs(x) < ey - Math.abs(y)) x = Math.sign(x || 1) * ex; else y = Math.sign(y || 1) * ey; inRoom(); }
  out.h = yawOf(a) - STANCE.open;      // the body stands open to the cue, as a right-hander does
  out.reach = Math.max(0, Math.min(1, (back - STANCE.back) / 0.5));
  out.far = back - STANCE.back;      // (how much further back than the plain stance the table keeps the body: hands())
  return out;
}
// The eye over the shot. h (0..1) is how high the player has it: 0 the chin on the cue, EYE.stance the plain stance,
// 1 standing behind the shot. It is the body that moves (lowOf: further down from the plain stance, riseOf: straightened
// up from it, downOf: how far into the stance that leaves the body) and the eye is its head. rate: W / S, per second;
// notch: one click of the wheel; wall: how far the eye is kept off the room's walls; eMin .. eMax: how far behind the
// white it is on the shot (a white the body cannot get near: the eye still sights it from there, ahead of the head), as
// far back as eStand for a player standing right up.
export const EYE = { stance: 0.4, downUp: 0.14, rate: 0.6, notch: 0.05, wall: 0.2, eMin: 0.3, eMax: 0.78, eStand: 1.6 };
const lowOf = (h) => clamp((EYE.stance - h) / EYE.stance, 0, 1), riseOf = (h) => clamp((h - EYE.stance) / (1 - EYE.stance), 0, 1), downOf = (rise) => 1 - (1 - EYE.downUp) * clamp(rise, 0, 1);
const FP_FINE = 0.0011, LOOK = 0.0026;
/** how far a pixel of the mouse turns the cue (rad): as the game's own look when standing, finely in the stance, finer still right down */
const turnRate = (h) => (h <= EYE.stance ? FP_FINE * (1 - 0.6 * lowOf(h)) : FP_FINE + (LOOK - FP_FINE) * riseOf(h));

export function createPool(game, bar) {
  const ID = bar.id, A = bar.audio, net = game.net;
  let built = false, scene = null, balls3d = null, shadows = null, cues = [], ghost = null, hud = null, stats = { tris: 0 };
  let P = null;                       // the game this client is playing in (or practising)
  let Wt = null;                      // someone else's game on the table: {from, g, sim, mode, ids, aim, pull, t, ph}
  let idleGame = new PP.PoolGame(['', '']);
  let eyeH = EYE.stance;              // how high the eye is over the shot (0 the chin on the cue .. 1 standing: EYE); kept from shot to shot and between visits
  let ghostOn = !/[?&]poolghost=0(&|$)/.test((typeof location !== 'undefined' && location.search) || '');
  const sink = new Float32Array(16);  // 0..1: how far each potted ball has dropped out of sight
  const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _c = new THREE.Color(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  const toWorld = (tx, ty, out, y = CLOTH) => out.set(wX(tx, ty), y, wZ(tx, ty));
  const spot = {}, spotB = {}, stanceOf = new Map();     // character -> {down, low, rise, reach, swing} while it is on a shot
  const others = () => { let n = 0; for (const o of net.others.values()) if (o.place === ID) n++; return n; };
  const send = (d) => { if (net.connected && others() > 0) net.send('pool', d); };

  function build(sc) {
    if (built) return; built = true; scene = sc;
    try { const fl = game.state.flags || {}; if (fl.poolGhost === false) ghostOn = false; if (typeof fl.poolEye === 'number') eyeH = clamp(fl.poolEye, 0, 1); } catch { /* */ }
    const RM = bar.room.mats;
    const mats = { col: RM.col, gloss: RM.gloss, cloth: new THREE.MeshStandardMaterial({ map: clothTexture(), vertexColors: true, roughness: 0.97 }), flat: new THREE.MeshBasicMaterial({ vertexColors: true }) };
    const T = buildTable(mats); scene.add(T.group); stats.tris = T.tris;
    scene.add(buildFittings(mats));
    // balls: one instanced draw; their soft shadows on the cloth under the strip lights: another
    balls3d = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ roughness: 0.1, metalness: 0.02 }), 16);
    balls3d.name = 'pool:balls'; balls3d.frustumCulled = false; scene.add(balls3d);
    const sg = new THREE.CircleGeometry(1, 16); sg.rotateX(-Math.PI / 2);
    shadows = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x021006, transparent: true, opacity: 0.42, depthWrite: false }), 16);
    shadows.name = 'pool:shadows'; shadows.frustumCulled = false; shadows.renderOrder = 3; scene.add(shadows);
    for (let i = 0; i < 2; i++) { const c = new THREE.Mesh(cueGeo(i ? 0x2a1a30 : 0x1a0d08), RM.gloss); c.name = 'pool:cue' + i; c.frustumCulled = false; c.rotation.order = 'YZX'; scene.add(c); cues.push(c); }
    // the ghost: a thin ring on the cloth where the white would first touch a ball (nothing else is ever drawn)
    const rg = new THREE.RingGeometry(PP.CUE_R - 0.0016, PP.CUE_R, 28); rg.rotateX(-Math.PI / 2);
    ghost = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }));
    ghost.name = 'pool:ghost'; ghost.renderOrder = 4; ghost.visible = false; scene.add(ghost);
    restCues(); syncBalls(idleGame.balls);
  }
  function restCues() {         // nobody playing: both cues stand in the corner by the rack
    cues.forEach((c, i) => { c.visible = true; c.position.set(LAY.pool.X0 + 0.16 + i * 0.07, PF + CUE_LEN * Math.cos(0.1), LAY.pool.Z0 + 0.14 + i * 0.05); c.rotation.set(0, 0.6, Math.PI / 2 - 0.1); });
  }
  function syncBalls(bs, dt = 0) {
    if (!balls3d) return;
    for (let i = 0; i < 16; i++) {
      const b = bs[i];
      if (!b) { _m.makeScale(0, 0, 0); balls3d.setMatrixAt(i, _m); shadows.setMatrixAt(i, _m); continue; }
      if (b.potted) {
        if (sink[i] < 1 && b.pocket >= 0) {          // dropping into the pocket
          sink[i] = Math.min(1, sink[i] + dt / 0.16);
          const p = PP.POCKETS[b.pocket], k = sink[i];
          toWorld(p.x + p.ax * 0.012, p.y + p.ay * 0.012, _v, CLOTH + b.r - k * 0.075); _m.makeScale(b.r, b.r, b.r); _m.setPosition(_v); balls3d.setMatrixAt(i, _m);
          balls3d.setColorAt(i, _c.setHex(BALL_COL[b.kind]).multiplyScalar(1 - 0.8 * k));
        } else { _m.makeScale(0, 0, 0); balls3d.setMatrixAt(i, _m); sink[i] = 1; }
        _m.makeScale(0, 0, 0); shadows.setMatrixAt(i, _m); continue;
      }
      sink[i] = 0;
      toWorld(b.x, b.y, _v, CLOTH + b.r); _m.makeScale(b.r, b.r, b.r); _m.setPosition(_v); balls3d.setMatrixAt(i, _m);
      balls3d.setColorAt(i, _c.setHex(BALL_COL[b.kind]));
      _v.y = CLOTH + 0.0016; _m.makeScale(b.r * 1.12, 1, b.r * 1.12); _m.setPosition(_v); shadows.setMatrixAt(i, _m);
    }
    balls3d.instanceMatrix.needsUpdate = true; shadows.instanceMatrix.needsUpdate = true; if (balls3d.instanceColor) balls3d.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- panel
  const css = 'position:fixed;font-family:Georgia,serif;color:#f4ecd8;pointer-events:none;z-index:20;';
  function makeHud() { if (typeof document === 'undefined' || !document.body || !document.body.append) return; hud = document.createElement('div'); hud.style.cssText = css + 'left:12px;top:12px;min-width:215px;max-width:250px;background:rgba(10,8,6,.78);border:1px solid #6a5a3a;border-radius:6px;padding:8px 11px;font-size:14px;line-height:1.3'; document.body.append(hud); }
  function dropHud() { hud && hud.remove && hud.remove(); hud = null; }
  function renderHud() {
    if (!hud || !P) return;
    const g = P.g, hex = (k) => '#' + BALL_COL[k].toString(16).padStart(6, '0');
    const chip = (k) => (k ? `<span style="display:inline-block;width:12px;height:12px;border-radius:6px;background:${hex(k)};vertical-align:middle"></span> ${k}s (${g.left(k)} left)` : 'open table');
    let h = `<div style="font-size:18px;color:#e584ab;font-weight:bold">Pool &middot; ${P.mode === 'solo' ? 'practice' : '8-ball, pub rules'}${P.stake ? ' &middot; a pint on it' : ''}</div>`;
    if (P.mode === 'solo') h += `<div style="margin-top:5px">Reds ${g.left('red')} &middot; yellows ${g.left('yellow')} &middot; ${g.left('black') ? 'black up' : 'black down'}</div>`;
    else P.names.forEach((n, i) => { const on = g.turn === i && g.winner < 0; h += `<div style="margin-top:5px;${on ? '' : 'opacity:.7'}">${on ? '&#9654; ' : ''}<b>${n}</b> — ${chip(g.groups[i])}${on && g.visits > 1 ? ' <b style="color:#ffd040">(two visits)</b>' : ''}</div>`; });
    if (P.mode !== 'solo' && g.target() === 'black' && g.winner < 0) h += `<div style="color:#ffd040">${P.names[g.turn]} is on the black</div>`;
    h += `<div style="margin-top:6px;color:#ffe9a8">${g.message || ''}</div>`;
    if (P.stateMsg) h += `<div style="color:#7aff8a">${P.stateMsg}</div>`;
    // where the tip meets the white
    const sx = 20 + P.spin.side * 9, sy = 20 - P.spin.top * 9;
    h += `<div style="margin-top:8px;display:flex;gap:10px;align-items:center"><svg width="40" height="40"><circle cx="20" cy="20" r="18" fill="#f3efe2" stroke="#8a8676"/><circle cx="${sx}" cy="${sy}" r="4" fill="#2f62b0"/></svg>`;
    const how = game.input.locked === false ? 'Click on the table: the mouse is yours again' : P.phase === 'place' ? 'Look: the white lies where you look<br>Click: put it down' : P.phase !== 'aim' ? 'Mouse: look about' : 'Mouse: turn the cue &middot; hold, draw back, let go: strike<br>W/S eye up / down &middot; &uarr;/&darr; top &amp; back &middot; A/D side &middot; X centre';
    h += `<div style="font-size:11px;opacity:.75">${how}<br>G contact ring ${ghostOn ? 'on' : 'off'} &middot; ${P.mode === 'solo' ? 'R re-rack &middot; ' : ''}Esc leave</div></div>`;
    hud.innerHTML = h;
  }

  // ---------------------------------------------------------------- a frame
  function myName() { return game.player.name || 'You'; }
  function start(mode, opts = {}) {
    build(bar.scene);
    if (P) return;
    Wt = null;
    const me = myName();
    const names = mode === 'mp' ? (opts.iStart ? [me, opts.remoteName] : [opts.remoteName, me]) : mode === 'solo' ? [me, me] : [me, REGULAR.name];
    P = { mode, names, g: new PP.PoolGame(names), phase: 'idle', sim: null, aim: 0, pull: 0, hold: null, skipClick: true, at: '',
      eye: { mode: '', at: '', pos: new THREE.Vector3(), e: null, up: null, bt: 0, bT: 0.3, bp: new THREE.Vector3(), bq: new THREE.Quaternion() }, spin: { top: 0, side: 0 }, ai: { t: 0, shot: null }, stake: false,
      human: mode === 'mp' ? (opts.iStart ? 0 : 1) : 0, remoteId: opts.remoteId || null, opp: null, down: 0, swing: 0, strikeT: 0, n: 0, aimT: 0, stT: 0, seenHits: 0, seenCush: 0, seenPot: 0, rAim: 0, rPull: 0 };
    if (mode === 'ai') P.stake = game.state.money >= 2.8;
    if (mode !== 'mp' && bar.spawnPoolOpponent) P.opp = bar.spawnPoolOpponent(REGULAR, mode === 'solo');
    sink.fill(0);
    // The mouse is HELD for the whole frame, as in ordinary play (the menu had let it go; this runs from the click on
    // its button): the cue is turned by the mouse's movement, which must never run out of page. Nothing in this file
    // lets it go. If the browser takes it (Esc, another window), a click on the picture takes it back (core/input.js).
    game.beginActivity({ name: 'pool', pointer: 'locked', update: (dt) => tick(dt), camera: (dt, cam) => camera(dt, cam), onKey: (c) => key(c), onEnd: () => end() });
    try { if (game.input.lock && !game.input.locked) game.input.lock(); } catch { /* */ }
    if (typeof game._setFirstPerson === 'function') game._setFirstPerson(true);      // (the head out of its own eyes' way)
    makeHud();
    P.g.message = mode === 'solo' ? 'Practice: the table is yours' : `${names[0]} to break`;
    beginTurn(); sendState();
    game.ui.toast(mode === 'ai' ? (P.stake ? `Pool against ${REGULAR.name} — a pint on it` : `Pool against ${REGULAR.name} — friendly frame`) : mode === 'solo' ? 'Practice frame' : `Pool against ${opts.remoteName}`, 4);
  }
  const mine = () => !!P && (P.mode === 'solo' || P.g.turn === P.human);
  function beginTurn() {
    if (!P) return;
    const g = P.g;
    if (P.mode === 'solo' && g.winner < 0) { g.turn = 0; g.visits = 1; }
    P.phase = g.winner >= 0 ? 'over' : g.ballInHand ? 'place' : 'aim';
    P.pull = 0; P.hold = null;
    if (P.phase !== 'over') {
      if (P.mode === 'ai' && !mine()) { P.phase = 'ai'; P.ai.shot = PP.aiShot(g, REGULAR.skill, Math.random); P.ai.t = 1.6 + Math.random() * 1.4; P.ai.T = P.ai.t; if (P.ai.shot.place) { const c = g.cue(); c.x = P.ai.shot.place.x; c.y = P.ai.shot.place.y; g.ballInHand = false; } }
      else if (P.mode === 'mp' && !mine()) P.phase = 'remote';
      else if (g.breakShot || g.ballInHand) { const c = g.cue(), apex = g.balls[1]; P.aim = Math.atan2(apex.y - c.y, apex.x - c.x); }
    }
    renderHud();
  }
  function shotAngle() { return P.phase === 'ai' && P.ai.shot ? P.ai.shot.angle : P.phase === 'remote' ? P.rAim : P.aim; }

  function shoot(angle, power, spin) {
    const g = P.g, c = g.cue();
    g.ballInHand = false;
    P.n++;
    // what is sent is what is played: every client starts the same fixed-step physics from the same numbers
    const m = { op: 'shot', a: +angle.toFixed(5), p: +power.toFixed(4), top: +(spin.top || 0).toFixed(2), side: +(spin.side || 0).toFixed(2), cx: Math.round(c.x * 1e4), cy: Math.round(c.y * 1e4), n: P.n };
    c.x = m.cx / 1e4; c.y = m.cy / 1e4;
    send(m);
    launch(P, m.a, m.p, { top: m.top, side: m.side });
  }
  function launch(T, angle, power, spin) {
    A.cueHit(power);
    PP.strike(T.g.balls, angle, power, spin);
    T.sim = PP.newSim(T.g.balls); T.seenHits = T.seenCush = T.seenPot = 0; T.strikeT = 0.0001; T.strikeA = angle;
    if (T === P) { P.phase = 'roll'; P.wasBreak = P.g.breakShot; P.shooter = P.g.turn; ghost.visible = false; if (P.mode === 'solo' || P.g.turn === P.human) eyeHold(); }
  }
  function sounds(T) {
    const ev = T.sim.ev; let n = 0;
    for (; T.seenHits < ev.hits.length; T.seenHits++) if (n++ < 5) A.ballClick(ev.hits[T.seenHits].speed);
    for (; T.seenCush < ev.cush.length; T.seenCush++) { const c = ev.cush[T.seenCush]; if (c.speed > 0.25) A.cushion(c.speed, c.jaw); }
    for (; T.seenPot < ev.potted.length; T.seenPot++) A.pocket();
  }
  function settle() {
    const g = P.g, ev = P.sim.ev; P.sim = null;
    if (P.mode === 'mp' && P.shooter !== P.human) { P.phase = 'wait'; return; }      // the shooter's client rules on the shot
    const tgt = g.target(), ball = P.ai.shot && P.shooter !== P.human ? P.ai.shot.target : -1;
    const r = g.resolve(ev);
    g.apply(g.snapshot());                 // rest positions to the 0.1 mm that is sent: every client holds the same table
    sendState(false, true);
    afterResolve(r, ev, tgt, ball);
  }
  function say(lines, p = 0.6) { if (P && P.opp && P.opp.character && Math.random() < p) P.opp.character.say(pick(lines), 2.4); }
  function afterResolve(r, ev = null) {
    const g = P.g, byMe = P.shooter === P.human;
    if (r) {
      if (r.foul || r.rerack) A.foul();
      if (P.mode === 'solo') { if (r.foul) g.message = `${r.foul}. Play on`; else if (r.win || r.lose) g.message = 'Frame over'; else if (r.potted.length) g.message = `Potted: ${r.potted.join(', ')}`; else g.message = ''; if (r.potted.length && !r.foul) say(POOL_LINES.pot, 0.35); }
      else if (r.foul) say(POOL_LINES.foul, byMe ? 0.8 : 0.2);
      else if (P.wasBreak) say(POOL_LINES.breakOff, byMe ? 0.6 : 0);
      else if (byMe) say(r.potted.length ? POOL_LINES.pot : ev && ev.jaws ? POOL_LINES.miss.slice(2) : POOL_LINES.miss.slice(0, 2), r.potted.length ? 0.45 : 0.3);
    }
    if (g.winner >= 0) {
      P.phase = 'over'; A.frame();
      const iWon = g.winner === P.human;
      if (P.mode === 'ai' && P.stake) setTimeout(() => { if (iWon) { game.ui.toast(`${REGULAR.name} buys you a pint.`, 4); bar.drink && bar.drink('pint', true); } else { game.pay(-2.8); game.ui.toast(`You owe ${REGULAR.name} a pint: -£2.80`, 4); } }, 1200);
      if (P.mode === 'ai' && P.opp) P.opp.character.say(iWon ? 'Good game.' : 'Unlucky! Rack them up?', 3);      // (clips of these two exist)
      P.stateMsg = P.mode === 'mp' ? 'Esc: done' : 'R: rack again &middot; Esc: done';
      renderHud(); return;
    }
    if (P.mode === 'ai' && g.turn !== P.human) say(g.target() === 'black' ? POOL_LINES.onBlack : POOL_LINES.turn, 0.3);
    beginTurn();
  }
  function applySt(d) { const brk = P.g.breakShot; P.sim = null; P.g.apply(d.s); P.g.names = P.names; P.n = d.n; P.wasBreak = brk; if (P.g.shots === 0) sink.fill(0); afterResolve(null); }
  /** the table as this client holds it, to the room. In a frame between two players only the one at the table rules:
   *  the shooter after their shot has settled (force), then whoever is on, every 3 s; never while balls are moving. */
  function sendState(over = false, force = false) {
    if (!P) return;
    P.stT = 3;
    if (P.sim && !over) return;
    if (P.mode === 'mp' && !force && !over && !mine()) return;
    const ids = P.mode === 'mp' ? (P.human === 0 ? [net.id, P.remoteId] : [P.remoteId, net.id]) : [net.id, 0];
    send({ op: 'st', n: P.n, s: P.g.snapshot(), mode: P.mode, ids, ph: over ? 'over' : P.phase });
  }

  // ---------------------------------------------------------------- input (activity update, before the player's own)
  function tick(dt) {
    if (!P) return;
    const g = P.g, inp = game.input, drunk = game.player.drunk || 0, E = P.eye, held = inp.locked !== false;
    look();
    if (P.phase === 'roll' || P.phase === 'wait-roll') {
      const still = !PP.advance(P.sim, Math.min(dt, 0.25));
      sounds(P);
      if (still || P.sim.t > 40) { if (P.sim.t > 40) for (const b of g.balls) b.vx = b.vy = b.wx = b.wy = b.wz = 0; if (P.phase === 'roll') settle(); else { P.sim = null; P.phase = 'wait'; if (P.pendingSt) { const d = P.pendingSt; P.pendingSt = null; applySt(d); } } }
      return;
    }
    if (P.phase === 'ai') {
      P.ai.t -= dt; const sh = P.ai.shot, u = 1 - P.ai.t / P.ai.T;
      // a couple of feathers, then drawn back for the stroke
      P.pull = u < 0.55 ? 0 : u < 0.9 ? 0.25 * Math.abs(Math.sin((u - 0.55) * 18)) : Math.min(1, (u - 0.9) / 0.1) * (0.25 + 0.75 * sh.power);
      if (P.ai.t <= 0) { P.pull = 0; shoot(sh.angle, sh.power, sh); }
      return;
    }
    if (P.phase !== 'place' && P.phase !== 'aim') return;
    const c = g.cue();
    // (the mouse not held — Esc, another window: nothing at the table moves until a click on the picture has taken it
    //  back, and that click is not a click at the table; a cue that was being drawn is let down, not played)
    if (!held) { P.skipClick = true; if (P.hold) { P.hold = null; P.pull = 0; } }
    if (P.phase === 'place') {
      if ((P.aimT -= dt) <= 0) { P.aimT = 0.2; send({ op: 'aim', a: Math.round(P.aim * 1000), pl: 0, u: 1 }); }      // (on your feet with the white in your hand)
      if (P.skipClick) { if (!inp.mouseDown && held) P.skipClick = false; return; }
      const hit = !P.debug && E.mode === 'stand' && !(E.bt > 0) ? lookPoint(_v) : null;      // (not while the eye is on its way there)
      if (hit) { const tx = clamp(tX(hit.x, hit.z), -L2 + PP.CUE_R, PP.BAULK_X), ty = clamp(tY(hit.x, hit.z), -W2 + PP.CUE_R, W2 - PP.CUE_R); if (PP.placeOk(g.balls, tx, ty)) { c.x = tx; c.y = ty; } }
      if (inp.clicked) {
        P.phase = 'aim'; P.skipClick = true; g.ballInHand = false;
        // the cue lies towards the pack for the break; otherwise the way you were looking as you put the white down
        const apex = g.balls[1];
        P.aim = g.breakShot && apex && !apex.potted ? Math.atan2(apex.y - c.y, apex.x - c.x) : Math.atan2(Math.cos(game.cameraYaw), Math.sin(game.cameraYaw)) - rot();
      }
      return;
    }
    if (!inp.mouseDown && held) P.skipClick = false;
    const down = inp.mouseDown && !P.skipClick;
    // the eye: W up for a broader view, S down to sight along the cue; the wheel does the same
    const dh = ((inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0)) * dt * EYE.rate - clamp(inp.wheel || 0, -3, 3) * EYE.notch;
    if (dh) eyeH = clamp(eyeH + dh, 0, 1);
    // the mouse turns the cue round the white, as far round as it is moved (the player goes round with it): more finely
    // the lower the eye. The left / right arrows turn it a touch
    if (!down && !P.hold) {
      const k = turnRate(eyeH);
      P.aim += (held ? inp.mouseDX || 0 : 0) * k + ((inp.down('ArrowRight') ? 1 : 0) - (inp.down('ArrowLeft') ? 1 : 0)) * dt * 0.3 * (k / FP_FINE);
      if (Math.abs(P.aim) > 40) P.aim = Math.atan2(Math.sin(P.aim), Math.cos(P.aim));
    }
    const wob = (Math.sin(game.elapsed * 1.7) * 0.03 + Math.sin(game.elapsed * 3.1 + 1) * 0.013) * drunk;
    if (down) {
      // drawn back: 260 px of the mouse's own movement towards you is the whole draw
      if (!P.hold) P.hold = { a: P.aim, acc: 0 };
      P.hold.acc += inp.mouseDY || 0;
      P.pull = clamp(P.hold.acc / 260, 0, 1);
    } else if (P.hold) {
      const a = P.hold.a + wob, pw = P.pull; P.hold = null; P.pull = 0;
      if (pw > 0.03) { shoot(a, pw, P.spin); return; }
    }
    // the faint ring at the first contact
    const fc = ghostOn ? PP.firstContact(g.balls, c.x, c.y, P.aim + wob) : null;
    if (fc && fc.dist < 1.9 * (1 - 0.6 * drunk)) { ghost.visible = true; toWorld(fc.x, fc.y, ghost.position, CLOTH + 0.002); } else ghost.visible = false;
    if ((P.aimT -= dt) <= 0) {
      P.aimT = 0.2; const m = { op: 'aim', a: Math.round((P.aim + wob) * 1000), pl: Math.round(P.pull * 100) }, lo = lowOf(eyeH), up = riseOf(eyeH);
      if (lo > 0.005) m.lo = Math.max(1, Math.round(lo * 100)); else if (up > 0.005) m.up = Math.max(1, Math.round(up * 100));
      send(m);
    }
  }

  // ---------------------------------------------------------------- the eye (always the player's own)
  // Three states (P.eye.mode), all first person:
  //   'shot'   your shot: the head of your body as it is on the shot, on the cue's line behind the white, looking along it
  //   'held'   your stroke is played: the eye stays exactly where it was until the balls stop; the mouse looks about
  //   'stand'  the white in hand, or somebody else on the table: your standing eye where you stand; the mouse looks about
  // Going from one to another the eye travels (eyeBlend), it never cuts; nothing here looks down on the table from over it.
  const FP_HEAD = { fwd: 0.09, drop: 0.02, below: 0.26 };      // the eyes: ahead of and a little under the head's centre; the white 15 degrees under the middle of the view
  /** where the middle of the view meets the cloth (world), or null: looking up, or away from the table */
  function lookPoint(out) {
    const cam = game.camera; _v2.set(0, 0, -1).applyQuaternion(cam.quaternion);
    if (!(_v2.y < -0.02)) return null;
    const t = (cam.position.y - CLOTH) / -_v2.y; if (!(t > 0 && t < 8)) return null;
    return out.set(cam.position.x + _v2.x * t, CLOTH, cam.position.z + _v2.z * t);
  }
  function eyeBlend(T = 0.45) { const E = P.eye; E.bp.copy(game.camera.position); E.bq.copy(game.camera.quaternion); E.bt = E.bT = T; }
  /** the mouse looks about (not on your shot: there it turns the cue), as in the game's own first person */
  function look() {
    const inp = game.input; if (P.eye.mode === 'shot' || inp.locked === false) return;
    const mdx = inp.mouseDX || 0, mdy = inp.mouseDY || 0;
    if (mdx || mdy) { game.cameraYaw -= mdx * LOOK; game.cameraPitch = clamp(game.cameraPitch + mdy * 0.0022, -1.2, 1.35); }
  }
  /** the stroke is played: the eye stays exactly where it is (and looks where it looked) until the balls have stopped */
  function eyeHold() {
    const E = P.eye, cam = game.camera;
    E.pos.copy(cam.position); E.mode = 'held'; E.bt = 0;
    _v2.set(0, 0, -1).applyQuaternion(cam.quaternion);
    game.cameraYaw = Math.atan2(_v2.x, _v2.z); game.cameraPitch = Math.asin(clamp(-_v2.y, -1, 1));
  }
  /** standing by: turn to the table (the white in hand: to the white) */
  function lookAtTable() {
    const p = game.player, c = P.g.cue(), w = P.at === 'place' && c && !c.potted, tx = w ? wX(c.x, c.y) : TB.x, tz = w ? wZ(c.x, c.y) : TB.z;
    const D = p.character && p.character.dims, top = D ? (D.top || 1.7) - 0.1 : 1.6;
    game.cameraYaw = Math.atan2(tx - p.pos.x, tz - p.pos.z); game.cameraPitch = Math.min(1.2, Math.atan2(PF + top - CLOTH, Math.hypot(tx - p.pos.x, tz - p.pos.z)));
  }
  /** The eye on the shot: where this body's head is this frame (it goes down and comes up with the body: eyeH), brought
   *  onto the cue's line behind the white; the view lies along the cue, the white a hand below its middle and the table
   *  beyond it. Kept inside the room: against a wall the eye comes forward along the cue, it does not go through.
   *  (A figure without the game's skeleton: where the fitted stance puts a head.) */
  function shotEye(dt, out, look) {
    const E = P.eye, c = P.g.cue(), a = P.hold ? P.hold.a : P.aim, dx = Math.cos(a), dy = Math.sin(a), ch = game.player.character;
    let e, up;
    if (ch && ch.head && ch.dims && ch.head.localToWorld) {
      _s.set(0, ch.dims.headC || 0.12, 0); ch.head.localToWorld(_s);
      e = (c.x - tX(_s.x, _s.z)) * dx + (c.y - tY(_s.x, _s.z)) * dy - FP_HEAD.fwd; up = _s.y - CLOTH - FP_HEAD.drop;
    } else {
      const s = stanceOf.get(ch), lo = s ? s.low || 0 : 0, r = s ? clamp((1 - s.down) / (1 - EYE.downUp), 0, 1) : 1;
      shooterSpot(c.x, c.y, a, spotB); const back = (c.x - tX(spotB.x, spotB.z)) * dx + (c.y - tY(spotB.x, spotB.z)) * dy;
      e = back - (0.52 - 0.14 * lo) * (1 - r) - 0.12 * r; up = (0.42 - 0.22 * lo) * (1 - r) + 0.8 * r;
    }
    e = clamp(e, EYE.eMin, EYE.eMax + (EYE.eStand - EYE.eMax) * riseOf(eyeH)); up = clamp(up, 0.16, 1.0);      // (never under the rail's top, a cushion or the cue itself)
    // (the body steps round the white as the cue turns, and round the table's corners: the eye follows it smoothly)
    const k = E.e === null ? 1 : 1 - Math.exp(-dt * 14);
    e = E.e = (E.e === null ? e : E.e) + (e - (E.e === null ? e : E.e)) * k; up = E.up = (E.up === null ? up : E.up) + (up - (E.up === null ? up : E.up)) * k;
    // the room's walls: no further back along the cue than EYE.wall short of one
    const wx = wX(c.x, c.y), wz = wZ(c.x, c.y), ux = Math.cos(a + rot()), uz = Math.sin(a + rot()), R = LAY.pool, m = EYE.wall;
    if (ux > 1e-6) e = Math.min(e, (wx - (R.X0 + m)) / ux); else if (ux < -1e-6) e = Math.min(e, (wx - (R.X1 - m)) / ux);
    if (uz > 1e-6) e = Math.min(e, (wz - (R.Z0 + m)) / uz); else if (uz < -1e-6) e = Math.min(e, (wz - (R.Z1 - m)) / uz);
    e = Math.max(EYE.eMin, e);
    out.set(clamp(wx - ux * e, R.X0 + m, R.X1 - m), CLOTH + up, clamp(wz - uz * e, R.Z0 + m, R.Z1 - m));      // (the clamp: the white hard under a wall, the last resort)
    const pitch = Math.max(0.1, Math.atan2(up - PP.CUE_R, e) - FP_HEAD.below), kk = Math.cos(pitch) * 3;
    look.set(out.x + ux * kk, out.y - Math.sin(pitch) * 3, out.z + uz * kk);
    game.cameraYaw = yawOf(a); game.cameraPitch = pitch;      // (the game's own view angles go with it: leaving, you look where you looked)
  }
  function camera(dt, cam) {
    if (!P) return;
    const E = P.eye, p = game.player;
    if (cam.fov !== 60) { cam.fov = 60; cam.updateProjectionMatrix(); }
    const want = P.phase === 'aim' ? 'shot' : P.phase === 'roll' && E.mode === 'held' ? 'held' : 'stand', at = want === 'stand' ? P.at : '';
    if (want !== E.mode || at !== E.at) { eyeBlend(); E.mode = want; E.at = at; E.e = E.up = null; if (want === 'stand') lookAtTable(); }
    if (want === 'shot') { shotEye(dt, _v, _v2); cam.position.copy(_v); cam.lookAt(_v2); }
    else {
      const cp = Math.cos(game.cameraPitch), sp = Math.sin(game.cameraPitch), sy = Math.sin(game.cameraYaw), cy = Math.cos(game.cameraYaw);
      if (want === 'held') _v.copy(E.pos);
      else {
        // the game's own first-person eye (core/game.js): a little ahead of the neck the way the view points
        const D = p.character && p.character.dims, top = D ? (D.top || 1.7) - 0.1 : 1.6, fw = Math.max(0.02, 0.09 * cp + 0.13 * sp), R = LAY.pool, m = EYE.wall;
        _v.set(clamp(p.pos.x + sy * fw, R.X0 + m, R.X1 - m), p.pos.y + top - 0.13 + 0.13 * cp - 0.09 * sp, clamp(p.pos.z + cy * fw, R.Z0 + m, R.Z1 - m));
      }
      cam.position.copy(_v); cam.lookAt(_v.x + sy * cp * 5, _v.y - sp * 5, _v.z + cy * cp * 5);
    }
    if (p.drunk > 0) cam.rotation.z += Math.sin(game.elapsed * 0.9) * 0.06 * p.drunk;
    if (E.bt > 0) {      // from one state to the next the eye travels, it does not cut
      E.bt -= dt;
      if (E.bt > 0) { const k = 1 - E.bt / E.bT, s = k * k * (3 - 2 * k); _q.copy(cam.quaternion); cam.position.lerpVectors(E.bp, cam.position, s); cam.quaternion.copy(E.bq).slerp(_q, s); }
    }
  }

  // ---------------------------------------------------------------- every frame in the bar (after the player's update)
  const CUE_ELEV = 0.055, GRIP = 1.02, LIFT = 0.08;
  /** (lift 0..1: the cue raised off the table after the stroke, clear of what the balls go on to do) */
  function placeCue(i, cx, cy, a, pull, follow, lift = 0) {
    const c = cues[i], gap = 0.012 + pull * PULL_MAX - follow * 0.07;
    toWorld(cx - Math.cos(a) * (PP.CUE_R + gap), cy - Math.sin(a) * (PP.CUE_R + gap), _v, CLOTH + PP.CUE_R + 0.004 + (PP.CUE_R + gap) * Math.sin(CUE_ELEV) + lift * LIFT);
    c.visible = true; c.position.copy(_v); c.rotation.set(0, -(a + rot()), -CUE_ELEV);       // (the butt a little raised over the rail)
  }
  /** where the shooter's hands go for that cue: the bridge on the cloth 0.25 m behind the white (a player who has
   *  straightened up, s.rise, or whom the table keeps too far back to reach that, s.far: further back along the cue,
   *  the hand on the shaft), the grip on the butt GRIP m behind the tip (further down the butt for the far ones) */
  function hands(s, cx, cy, a, pull, follow, lift = 0) {
    const dx = Math.cos(a), dy = Math.sin(a), gap = PP.CUE_R + 0.012 + pull * PULL_MAX - follow * 0.07, far = clamp((s.far || 0) - 0.26, 0, 0.6), g = gap + (GRIP + Math.min(0.36, far)) * Math.cos(CUE_ELEV), b = 0.25 + Math.min(0.75, 0.5 * (s.rise || 0) + far);
    toWorld(cx - dx * b, cy - dy * b, s.tb || (s.tb = new THREE.Vector3()), CLOTH + 0.05 + (b - 0.25) * Math.sin(CUE_ELEV) + lift * LIFT);
    toWorld(cx - dx * g, cy - dy * g, s.tg || (s.tg = new THREE.Vector3()), CLOTH + PP.CUE_R + 0.004 + g * Math.sin(CUE_ELEV) + 0.02 + lift * LIFT);
  }
  function holdCue(i, ch) {          // waiting: the cue stands butt on the floor by the right foot, held at the chest
    if (!ch || !ch.group) { cues[i].visible = false; return; }
    const g = ch.group, h = g.rotation.y, c = cues[i];
    c.visible = true; c.position.set(g.position.x - Math.cos(h) * 0.24 + Math.sin(h) * 0.2, g.position.y + CUE_LEN * Math.cos(0.07), g.position.z + Math.sin(h) * 0.24 + Math.cos(h) * 0.2); c.rotation.set(0, h, Math.PI / 2 - 0.07);
  }
  function setStance(ch, down, reach, swing, cx, cy, a, pull, follow, low = 0, rise = 0) { if (!ch) return; let s = stanceOf.get(ch); if (!s) { s = { down: 0, reach: 0, swing: 0 }; stanceOf.set(ch, s); hook(ch); } s.t = down * downOf(rise); s.lt = low; s.rt = rise; s.reach = reach; s.far = spot.far || 0; s.swing = swing; hands(s, cx, cy, a, pull, follow); }      // (spot: the caller's shooterSpot for this shot)
  // a remote player's (or a bar person's) character is animated after this module runs: bend it from inside its own update
  function hook(ch) { if (ch._poolHook || ch === game.player.character) return; const u = ch.update; ch._poolHook = u; ch.update = function (dt, sp) { u.call(this, dt, sp); const s = stanceOf.get(this); if (s && s.down > 0.01) poolStance(this, s); }; }
  function unhook(ch) { if (ch._poolHook) { ch.update = ch._poolHook; ch._poolHook = null; } }
  function stand(ped, x, z, h, pose, y = PF) { if (!ped) return; ped.x = x; ped.z = z; ped.heading = h; ped.homeX = x; ped.homeZ = z; ped.homeH = h; ped.y = y; if (ped.character.pose !== pose) ped.character.setPose(pose); }
  /** where the two stand when not on the shot: off the table's two south corners (0: the player's, 1: the opponent's),
   *  held inside the room; where there is no room on that side of the table, the same on the other */
  function aside(i, out = {}) {
    const R = LAY.pool; let y = 1.38, b = -Math.PI / 2 + (i ? -0.5 : 0.5);
    for (let k = 0; k < 2; k++) {
      const x = i ? -1.62 : 1.5; out.x = clamp(wX(x, y), R.X0 + 0.3, R.X1 - 0.3); out.z = clamp(wZ(x, y), R.Z0 + 0.3, R.Z1 - 0.3); out.h = yawOf(b);
      if (Math.abs(tX(out.x, out.z)) > OUT_X + 0.25 || Math.abs(tY(out.x, out.z)) > OUT_Z + 0.25) break;
      y = -y; b = -b;
    }
    return out;
  }
  /** with the white in hand: standing behind the baulk cushion, facing up the table (a fixed place: the white goes where you look from it) */
  const placeSpot = (out) => { shooterSpot(-L2 + 0.2, 0, 0, out); out.h = yawOf(0); return out; };
  const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  function frame(dt) {
    if (!built) return;
    for (const [ch, s] of stanceOf) { s.down += ((s.t || 0) - s.down) * Math.min(1, dt * 6); s.t = 0; s.low = (s.low || 0) + ((s.lt || 0) - (s.low || 0)) * Math.min(1, dt * 7); s.rise = (s.rise || 0) + ((s.rt || 0) - (s.rise || 0)) * Math.min(1, dt * 7); if (s.down < 0.01 && !s.keep) { if (!ch.group || !ch.group.parent) { unhook(ch); stanceOf.delete(ch); } } }
    const pl = game.player;
    if (P) {
      const g = P.g, c = g.cue();
      if (P.strikeT > 0) P.strikeT += dt;
      const rolling = P.phase === 'roll' || P.phase === 'wait-roll';
      const shooterIsMe = rolling ? P.shooter === P.human || P.mode === 'solo' : mine();
      // Bent over the cue: on a shot, and through the stroke. The player's own figure stays on its shot until the balls
      // have stopped (its head is the eye, which stays where it was), lifting the cue clear of the table after the
      // follow-through; anybody else stands up from theirs.
      const over = P.phase === 'over', bent = !over && (P.phase === 'aim' || P.phase === 'ai' || (P.phase === 'remote' && !P.rUp) || (rolling && (shooterIsMe || P.strikeT < 0.55)));
      const lift = rolling && shooterIsMe ? sm((P.strikeT - 0.45) / 0.5) : 0;
      const a = rolling ? P.strikeA : shotAngle(), pull = lift > 0 ? 0.6 * lift : P.phase === 'remote' ? P.rPull : P.pull, follow = (P.strikeT > 0 ? Math.min(1, P.strikeT / 0.07) : 0) * (1 - lift);
      if (!rolling && !over) { P.cx = c.x; P.cy = c.y; }
      shooterSpot(P.cx ?? c.x, P.cy ?? c.y, a, spot);
      // the local player: on the shot (the body goes where the cue and the eye's height put it); with the white in
      // hand, behind baulk; otherwise standing by. Standing, the body faces the way the player looks.
      const placing = P.phase === 'place' && shooterIsMe, onShot = shooterIsMe && bent;
      const me = placing ? placeSpot(spotB) : shooterIsMe && !over ? spot : aside(0, spotB);
      P.at = placing ? 'place' : shooterIsMe && !over ? 'shot' : 'aside';
      pl.pos.set(me.x, PF, me.z); pl.heading = onShot ? me.h : game.cameraYaw; pl.pose = onShot ? 'lean' : 'stand';
      const bx = P.cx ?? c.x, by = P.cy ?? c.y;
      if (onShot) { let s = stanceOf.get(pl.character); if (!s) { s = { down: 0, reach: 0, swing: 0, keep: true }; stanceOf.set(pl.character, s); } const rise = riseOf(eyeH); s.t = downOf(rise); s.lt = lowOf(eyeH); s.rt = rise; s.reach = spot.reach; s.far = spot.far; s.swing = follow > 0 ? 0.7 * follow : -pull; hands(s, bx, by, a, pull, follow, lift); pl.character.group.position.set(me.x, PF, me.z); pl.character.group.rotation.y = me.h; poolStance(pl.character, s); }
      else { const s = stanceOf.get(pl.character); if (s && s.down > 0.01) poolStance(pl.character, s); }
      // the other one
      if (P.opp) {
        if (P.mode === 'solo') stand(P.opp, wX(0.85, 1.44), wZ(0.85, 1.44), yawOf(-Math.PI / 2), 'sit', PF + 0.4);       // watching from the freezer
        else if (!shooterIsMe && !over) { stand(P.opp, spot.x, spot.z, spot.h, bent ? 'lean' : 'stand'); if (bent) setStance(P.opp.character, 1, spot.reach, follow > 0 ? 0.7 * follow : -pull, bx, by, a, pull, follow); }
        else { const o = aside(1); stand(P.opp, o.x, o.z, o.h, 'stand'); }
      }
      let oppCh = P.opp ? P.opp.character : null;
      if (P.mode === 'mp') { const o = net.others.get(P.remoteId); oppCh = o && o.place === ID ? o.character : null; if (oppCh && !shooterIsMe && bent) setStance(oppCh, 1, spot.reach, follow > 0 ? 0.7 * follow : -pull, bx, by, a, pull, follow, P.rLow || 0, P.rRise || 0); }
      // cues: 0 is the local player's, 1 the opponent's
      const si = shooterIsMe ? 0 : 1;
      if (bent && P.phase !== 'place') placeCue(si, bx, by, a, pull, follow, lift); else holdCue(si, shooterIsMe ? pl.character : oppCh);
      if (P.mode === 'solo') cues[1].visible = false; else holdCue(1 - si, shooterIsMe ? oppCh : pl.character);
      if (rolling && P.strikeT > 1.2 && !shooterIsMe) P.strikeT = 0;
      if (!rolling && P.phase !== 'ai') P.strikeT = 0;
      syncBalls(g.balls, dt);
      if ((P.stT -= dt) <= 0) sendState();
      if (hud && (P.hudT = (P.hudT || 0) - dt) <= 0) { P.hudT = 0.25; renderHud(); }
      return;
    }
    ghost.visible = false;
    if (Wt) {
      Wt.t += dt;
      if (Wt.sim) { const still = !PP.advance(Wt.sim, Math.min(dt, 0.25)); sounds(Wt); if (still || Wt.sim.t > 40) { Wt.sim = null; if (Wt.pending) { Wt.g.apply(Wt.pending); Wt.pending = null; } } }
      if (Wt.strikeT > 0) { Wt.strikeT += dt; if (Wt.strikeT > 1.2) Wt.strikeT = 0; }
      const g = Wt.g, c = g.cue(), shooterId = Wt.ids[g.turn], o = shooterId ? net.others.get(shooterId) : null;
      const follow = Wt.strikeT > 0 ? Math.min(1, Wt.strikeT / 0.07) : 0, live = Wt.t < 9 && Wt.ph !== 'over';
      const bent = live && o && o.place === ID && (Wt.aimT > 0 || (Wt.strikeT > 0 && Wt.strikeT < 0.55));
      if (Wt.aimT > 0) Wt.aimT -= dt;
      if (bent) { if (!Wt.sim) { Wt.cx = c.x; Wt.cy = c.y; } shooterSpot(Wt.cx, Wt.cy, Wt.aim, spot); setStance(o.character, 1, spot.reach, follow > 0 ? 0.7 * follow : -Wt.pull, Wt.cx, Wt.cy, Wt.aim, Wt.pull, follow, Wt.low || 0, Wt.rise || 0); placeCue(0, Wt.cx, Wt.cy, Wt.aim, Wt.pull, follow); }
      else if (live && o && o.place === ID) holdCue(0, o.character); else cues[0].visible = false;
      const o2 = live && Wt.mode === 'mp' ? net.others.get(Wt.ids[1 - g.turn]) : null;
      if (o2 && o2.place === ID) holdCue(1, o2.character); else cues[1].visible = false;
      syncBalls(g.balls, dt);
      if (Wt.t > 12) { idleGame = Wt.g; Wt = null; restCues(); }
      return;
    }
    if (pl.character && stanceOf.has(pl.character)) { const s = stanceOf.get(pl.character); if (s.down > 0.01) poolStance(pl.character, s); else stanceOf.delete(pl.character); }
  }

  function key(code) {
    if (!P) return;
    const sp = P.spin, st = 0.25, cl = (v) => Math.max(-1, Math.min(1, +v.toFixed(2)));
    // (W and S are the eye's height, read while they are held: tick)
    if (code === 'ArrowUp') sp.top = cl(sp.top + st); else if (code === 'ArrowDown') sp.top = cl(sp.top - st);
    else if (code === 'KeyD') sp.side = cl(sp.side + st); else if (code === 'KeyA') sp.side = cl(sp.side - st);
    else if (code === 'KeyX') { sp.top = 0; sp.side = 0; }
    else if (code === 'KeyG') { ghostOn = !ghostOn; try { (game.state.flags || (game.state.flags = {})).poolGhost = ghostOn; game.save && game.save(); } catch { /* */ } game.ui.toast(ghostOn ? 'Contact ring on' : 'Contact ring off: nothing but your eye', 2); }
    else if (code === 'KeyR' && P.mode !== 'mp' && (P.phase === 'over' || (P.mode === 'solo' && P.phase !== 'roll'))) { P.g = new PP.PoolGame(P.names); P.stateMsg = ''; sink.fill(0); P.g.message = P.mode === 'solo' ? 'Racked' : `${P.names[0]} to break`; A.rack(); beginTurn(); sendState(); }
    renderHud();
  }
  function end() {
    if (!P) return;
    if (P.mode === 'mp' && P.phase !== 'over') net.send('pool', { op: 'quit', to: P.remoteId });
    if (P.sim) { PP.simulate(P.g.balls, 20); }                  // leave the table as the shot would have left it
    sendState(true);
    if (P.opp && bar.removePoolOpponent) bar.removePoolOpponent(P.opp);
    idleGame = P.g; dropHud(); ghost.visible = false;
    try { const fl = game.state.flags || (game.state.flags = {}), h = +eyeH.toFixed(2); if (fl.poolEye !== h) { fl.poolEye = h; game.save && game.save(); } } catch { /* */ }
    const pl = game.player;
    pl.pose = 'stand';      // (left standing where you stood, looking where you looked: the game's own view takes it from there)
    const s = stanceOf.get(pl.character); if (s) s.keep = false;
    P = null; restCues(); syncBalls(idleGame.balls);
  }

  // ---------------------------------------------------------------- menu + multiplayer
  let pending = null, outgoing = null;
  const tableBusy = () => (Wt && Wt.t < 9 && Wt.ph !== 'over' ? (net.others.get(Wt.from) || {}).name || 'Someone' : null);
  function menu() {
    build(bar.scene);
    game.beginActivity({ name: 'pool-menu', pointer: 'free' });
    const o = game.ui.openOverlay(), box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#14100c;border:2px solid #1f9a3c;border-radius:8px;padding:18px 22px;color:#f4ecd8;font-family:Georgia,serif;min-width:380px';
    const busy = tableBusy();
    box.innerHTML = `<div style="font-size:22px;color:#7ad08a;font-weight:bold">Pool</div><div style="opacity:.75;margin-bottom:10px">${busy ? `${busy} is on the table. Winner stays on.` : 'Pub 8-ball: reds and yellows, black last. 50p in the slot.'}</div><div style="font-size:12px;opacity:.6;margin-bottom:10px;max-width:400px">Fouls (in-off, wrong ball first, missing everything, potting one of theirs) give the other player two visits; after an in-off the white is played from baulk. Potting the black early, or fouling on it, loses the frame.</div>`;
    const btn = (label, fn) => { const b = document.createElement('button'); b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0;padding:7px 10px;background:#1a2218;color:#f4ecd8;border:1px solid #3a5a30;border-radius:4px;cursor:pointer;font:inherit'; b.innerHTML = label; b.onclick = fn; box.appendChild(b); };
    if (pending) btn(`<b style="color:#7aff8a">Accept ${pending.name}'s challenge</b>`, () => { net.send('pool', { op: 'accept', to: pending.id }); const p = pending; pending = null; game.endActivity(); start('mp', { remoteId: p.id, remoteName: p.name, iStart: false }); });
    if (!busy) {
      btn(`Play <b>${REGULAR.name}</b>, a bar regular${game.state.money >= 2.8 ? ' — a pint on it' : ''}`, () => { game.endActivity(); A.coin(); A.rack(); start('ai'); });
      btn('Practise alone', () => { game.endActivity(); A.coin(); A.rack(); start('solo'); });
      for (const x of [...net.others.values()].filter((q) => q.place === ID)) btn(`Challenge <b>${x.name}</b>`, () => { outgoing = { id: x.id, name: x.name }; net.send('pool', { op: 'challenge', to: x.id, name: myName() }); game.ui.toast(`Challenge sent to ${x.name}`, 3); game.endActivity(); });
    }
    btn(busy ? 'Watch' : 'Cancel', () => game.endActivity());
    o.appendChild(box);
  }
  net.on('pool', (d, o) => {
    if (!d || !o) return;
    if (d.to !== undefined) {
      if (d.to !== net.id) return;
      if (d.op === 'challenge') { pending = { id: o.id, name: d.name || o.name }; game.ui.toast(`${pending.name} challenges you to a frame of pool — go to the table in the Cellar Bar and press E`, 6); }
      else if (d.op === 'accept' && outgoing && outgoing.id === o.id) { const x = outgoing; outgoing = null; if (game.player.place === ID && !P) { if (game.activity) game.endActivity(); start('mp', { remoteId: x.id, remoteName: x.name, iStart: true }); } }
      else if (d.op === 'quit' && P && P.mode === 'mp' && P.remoteId === o.id) { game.ui.toast(`${o.name} left the table`, 3); P.phase = 'over'; game.endActivity(); }
      return;
    }
    if (game.player.place !== ID || !built) return;
    if (P) {                                   // my opponent's shots and rulings
      if (P.mode !== 'mp' || P.remoteId !== o.id) return;
      if (d.op === 'aim' && !mine()) { P.rAim = d.a / 1000; P.rPull = d.pl / 100; P.rUp = !!d.u; P.rLow = clamp((+d.lo || 0) / 100, 0, 1); P.rRise = clamp((+d.up || 0) / 100, 0, 1); }
      else if (d.op === 'shot' && !mine() && P.phase !== 'roll') { const c = P.g.cue(); c.x = d.cx / 1e4; c.y = d.cy / 1e4; c.potted = false; P.g.ballInHand = false; P.rPull = 0; launch(P, +d.a, +d.p, { top: +d.top, side: +d.side }); P.phase = 'wait-roll'; P.shooter = P.g.turn; P.cx = c.x; P.cy = c.y; }
      else if (d.op === 'st' && d.s) { if ((d.ph === 'over' && d.s.win < 0) || P.phase === 'roll' || P.phase === 'aim' || P.phase === 'place') return; if (P.phase === 'wait-roll') P.pendingSt = d; else if (d.n !== P.n || d.s.shots !== P.g.shots || d.s.turn !== P.g.turn) applySt(d); }
      return;
    }
    // watching somebody else's frame
    if (d.op === 'st' && d.s) {
      if (!Wt || (Wt.from !== o.id && !Wt.ids.includes(o.id))) { Wt = { from: o.id, g: new PP.PoolGame(d.s.names || ['', '']), sim: null, mode: d.mode, ids: d.ids || [o.id, 0], aim: 0, pull: 0, aimT: 0, t: 0, ph: d.ph, strikeT: 0, seenHits: 0, seenCush: 0, seenPot: 0, pending: null }; Wt.g.apply(d.s); for (let i = 0; i < 16; i++) sink[i] = Wt.g.balls[i].potted ? 1 : 0; }
      else if (Wt.sim) Wt.pending = d.s; else Wt.g.apply(d.s);
      Wt.t = 0; Wt.ph = d.ph; Wt.mode = d.mode; Wt.ids = d.ids || Wt.ids; Wt.from = o.id;
    } else if (Wt && Wt.from === o.id || (Wt && Wt.ids.includes(o.id))) {
      if (d.op === 'aim') { Wt.aim = d.a / 1000; Wt.pull = d.pl / 100; Wt.aimT = d.u ? 0 : 0.8; Wt.low = clamp((+d.lo || 0) / 100, 0, 1); Wt.rise = clamp((+d.up || 0) / 100, 0, 1); Wt.t = 0; }
      else if (d.op === 'shot') { if (Wt.pending) { Wt.g.apply(Wt.pending); Wt.pending = null; } const c = Wt.g.cue(); c.x = d.cx / 1e4; c.y = d.cy / 1e4; c.potted = false; Wt.cx = c.x; Wt.cy = c.y; Wt.aim = +d.a; Wt.pull = 0; launch(Wt, +d.a, +d.p, { top: +d.top, side: +d.side }); Wt.t = 0; }
    }
  });

  return {
    build, menu, start, frame, get active() { return !!P; }, get match() { return P; }, get watching() { return Wt; }, get stats() { return stats; }, get cues() { return cues; },
    get ghost() { return ghostOn; }, set ghost(v) { ghostOn = !!v; },
    syncIdle() { if (!P && !Wt) syncBalls(idleGame.balls); },
    /** test hooks */
    debugShot(angle, power, spin = null) { if (!P) return 'no game'; if (!mine()) return 'not your turn'; P.debug = true; if (P.phase === 'place') P.g.ballInHand = false; P.phase = 'aim'; P.aim = angle; shoot(angle, power, spin || P.spin); return 'shot'; },
    debugAim(angle, pull = 0) { if (P) { P.debug = true; P.aim = angle; P.pull = pull; if (P.phase === 'place') { P.phase = 'aim'; P.g.ballInHand = false; } } },
    /** finish the roll (and any turns of the regular's) at once: -> {turn, groups, msg, phase, winner} */
    fastForward(maxShots = 1) {
      if (!P) return null;
      for (let s = 0; s < maxShots; s++) {
        if (P.phase === 'ai') { const sh = P.ai.shot; shoot(sh.angle, sh.power, sh); }
        if (P.phase !== 'roll') break;
        while (PP.advance(P.sim, 0.5) && P.sim.t < 40) { /* run */ }
        settle();
      }
      syncBalls(P.g.balls, 1); renderHud();
      return { turn: P.g.turn, groups: P.g.groups, msg: P.g.message, phase: P.phase, winner: P.g.winner };
    },
    /** the eye's height over the shot, 0 (the chin on the cue) .. 1 (standing): EYE */
    get eye() { return eyeH; }, set eye(v) { eyeH = clamp(+v || 0, 0, 1); },
    key,
  };
}
