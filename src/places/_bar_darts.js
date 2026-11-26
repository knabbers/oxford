// Cellar Bar darts: a steel-tip board in the north-west alcove (bull 1.73 m up, the oche 2.37 m out), 501 or 301
// double-out against one of the college team, Round the Clock practice, or a leg against another player; anyone else
// in the bar sees the darts fly, stay in the board and be collected, and the leg chalked up.
// Board geometry, scoring, the leg, the opponents' choice of bed and the ballistics: _bar_darts_rules.js (pure;
// tools/smoke_bar.mjs, tools/smoke_bar_games.mjs).
//
// Throwing: the mouse moves your aim over the board; the hand is never still (the small ring wanders: breathing and
// tremor, more with every pint), so the throw is timed. Hold the button to draw the dart back and let go to throw: a
// full draw throws at the speed the aim allows for, a snatched one drops short, and an arm held back too long starts
// to shake. The dart flies a real arc (it leaves the hand rising at 12-20 degrees and comes into the board 10-17
// degrees nose-down, where it stays, tail up, until the visit is over and its thrower pulls it out). A dart that
// finds a wire sometimes falls out and scores nothing. No checkout chart unless you ask for it (H).
//
// NAMES: the team's darts nicknames appear on the scoreboards (the chalkboard and the LED scorer) and nowhere else;
// panels, bubbles, toasts and the caller use first names.
//
// Over the wire ('darts' relay events; nothing when nobody else is in the bar):
//   to one player:  {op:'challenge', to, name, nick, start}   {op:'accept', to, nick}   {op:'quit', to}
//                   (nick: the sender's scoreboard name, shown on the chalkboard and the scorer only)
//   to the room:    {op:'dart', x, y, k, bo, i}     one dart: where it lands (0.1 mm), its speed factor (the arc), whether
//                                                    it bounces out, which dart of the visit
//                   {op:'m', start, nick, ids, sc, turn, hist, ph}   the leg as chalked: start score, the two scoreboard
//                                                    names, player ids (0 = one of the team), scores, whose throw,
//                                                    every visit so far [player, total, bust]; on each visit, on
//                                                    starting / leaving, and every 3 s for late arrivals
// The thrower's own figure travels in the ordinary player state (standing at the oche in the 'throw' pose).
import * as THREE from 'three';
import * as DR from './_bar_darts_rules.js';
import { OPPONENTS, stars, tagName, playerDartsName } from './_bar_roster.js';
import { LAY } from './_bar_build.js';
import { Geo, staticMesh } from './_bar_geo.js';

const BD = LAY.board, OCHE = LAY.oche;
const PX = 1024 / 620;          // board canvas pixels per mm (the canvas is a 620 mm disc: the board and its surround)
const REL_D = DR.OCHE - DR.THROW.reach;                       // release point to the board face, metres
const DART_LEN = 0.148, STICK = 0.011;                        // tip to flight end; how deep the point goes in
// what people say round the oche: bubbles only. New lines, listed for the voice render.
export const DARTS_LINES = {
  ton: ['Shot!', 'Good darts.', 'Lovely.'],
  big: ['Maximum!', 'Get in!'],
  low: ['Unlucky.', 'Tidy enough.', 'Plenty of time.'],
  bust: ['Bust.', 'Too hot.', 'Greedy.'],
  bounce: ['Bounce-out. Unlucky.', 'Off the wire!'],
  wall: ['Mind the wall.', 'That is coming out of your deposit.'],
  out: ['Game shot!', 'And the leg.'],
  wait: ['Your throw.', 'On you go.', 'Mugs away next leg.'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length) % a.length];

function drawBoard() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'), C = 512, mm = (v) => v * PX;
  g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(C, C, mm(310), 0, Math.PI * 2); g.fill();
  // the surround: a ring of dark foam with a few old holes
  g.strokeStyle = '#191919'; g.lineWidth = mm(3); g.beginPath(); g.arc(C, C, mm(304), 0, Math.PI * 2); g.stroke();
  let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.fillStyle = 'rgba(0,0,0,0.55)'; for (let i = 0; i < 90; i++) { const a = r() * 6.283, d = 232 + r() * 70; g.beginPath(); g.arc(C + Math.cos(a) * mm(d), C + Math.sin(a) * mm(d), 1.1, 0, 6.3); g.fill(); }
  g.fillStyle = '#101010'; g.beginPath(); g.arc(C, C, mm(DR.R.board), 0, Math.PI * 2); g.fill();
  const sector = (r0, r1, i, col) => {
    const a0 = ((i * 18 - 9 - 90) * Math.PI) / 180, a1 = ((i * 18 + 9 - 90) * Math.PI) / 180;
    g.fillStyle = col; g.beginPath(); g.arc(C, C, mm(r1), a0, a1); g.arc(C, C, mm(r0), a1, a0, true); g.closePath(); g.fill();
  };
  const BLACK = '#18171a', CREAM = '#e9dcb6', RED = '#c9212b', GREEN = '#1d8442';
  for (let i = 0; i < 20; i++) {
    const dark = i % 2 === 0, single = dark ? BLACK : CREAM, ring = dark ? RED : GREEN;
    sector(DR.R.outerBull, DR.R.trebleIn, i, single); sector(DR.R.trebleIn, DR.R.trebleOut, i, ring);
    sector(DR.R.trebleOut, DR.R.doubleIn, i, single); sector(DR.R.doubleIn, DR.R.doubleOut, i, ring);
  }
  g.fillStyle = GREEN; g.beginPath(); g.arc(C, C, mm(DR.R.outerBull), 0, Math.PI * 2); g.fill();
  g.fillStyle = RED; g.beginPath(); g.arc(C, C, mm(DR.R.bull), 0, Math.PI * 2); g.fill();
  // sisal: thousands of bristle ends, and the wear of a college season round the treble twenty
  for (let i = 0; i < 9000; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 170; g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'; g.fillRect(C + Math.cos(a) * mm(d), C + Math.sin(a) * mm(d), 1.3, 1.3); }
  for (let i = 0; i < 260; i++) { const a = (r() - 0.5) * 0.5, d = 70 + r() * 75; g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(C + Math.sin(a) * mm(d), C - Math.cos(a) * mm(d), 0.9, 0, 6.3); g.fill(); }
  // the spider: a shadow line under each wire, then the wire
  const wires = (col, w, off) => {
    g.strokeStyle = col; g.lineWidth = w;
    for (const rr of [DR.R.bull, DR.R.outerBull, DR.R.trebleIn, DR.R.trebleOut, DR.R.doubleIn, DR.R.doubleOut]) { g.beginPath(); g.arc(C + off, C + off, mm(rr), 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 20; i++) { const a = ((i * 18 - 9) * Math.PI) / 180; g.beginPath(); g.moveTo(C + off + Math.sin(a) * mm(DR.R.outerBull), C + off - Math.cos(a) * mm(DR.R.outerBull)); g.lineTo(C + off + Math.sin(a) * mm(DR.R.doubleOut + 4), C + off - Math.cos(a) * mm(DR.R.doubleOut + 4)); g.stroke(); }
  };
  wires('rgba(0,0,0,0.45)', 2.2, 1.2); wires('rgba(214,214,220,0.95)', 1.5, 0);
  // the number ring: wire numerals on a wire hoop
  g.strokeStyle = 'rgba(200,200,205,0.7)'; g.lineWidth = 1.6; g.beginPath(); g.arc(C, C, mm(212), 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8e8ea'; g.font = `${mm(31)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  DR.ORDER.forEach((n, i) => { const a = (i * 18 * Math.PI) / 180; g.save(); g.translate(C + Math.sin(a) * mm(194), C - Math.cos(a) * mm(194)); g.rotate(a > Math.PI / 2 && a < Math.PI * 1.5 ? a + Math.PI : a); g.fillText(String(n), 0, 0); g.restore(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** a steel-tip dart, point at the origin, lying back along +z: point, knurled barrel, shaft, four flights (two-sided) */
function dartGeo(flight, flight2, barrel = 0x9a9ea2) {
  const g = new Geo();
  g.col(0xd4d6d8).rod([0, 0, 0], [0, 0, 0.032], 0.0002, 0.0011, 6, false);
  g.col(barrel).rod([0, 0, 0.032], [0, 0, 0.082], 0.0031, 0.0034, 8, true);
  g.col(barrel, 0.6); for (let k = 0; k < 5; k++) g.rod([0, 0, 0.04 + k * 0.008], [0, 0, 0.043 + k * 0.008], 0.0037, 0.0037, 8, false);
  g.col(0x141414).rod([0, 0, 0.082], [0, 0, 0.118], 0.0024, 0.0019, 6, false);
  const z0 = 0.11, z1 = 0.122, z2 = DART_LEN, w = 0.017;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4, cx = Math.cos(a), sy = Math.sin(a);
    const P = (rr, z) => [cx * rr, sy * rr, z], q = [P(0, z0), P(w, z1), P(w, z2), P(0, z2 - 0.004)];
    g.col(k % 2 ? flight2 : flight); g.quad(q[0], q[1], q[2], q[3]); g.quad(q[3], q[2], q[1], q[0]);
  }
  return g.build();
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _one = new THREE.Vector3(1, 1, 1), _zero = new THREE.Matrix4().makeScale(0, 0, 0), _e = new THREE.Euler(0, 0, 0, 'YXZ');
/** board mm -> world point on the board face (off metres in front of it) */
function boardPoint(bx, by, out, off = 0) { return out.set(BD.x + BD.n[0] * off + BD.right[0] * bx / 1000, BD.y + by / 1000, BD.z + BD.n[2] * off + BD.right[2] * bx / 1000); }
/** release point in the world: REL_D out from the board face */
function relPoint(out) { return boardPoint(DR.THROW.relX, DR.THROW.relY, out, REL_D); }

export function createDarts(game, bar) {
  const ID = bar.id, A = bar.audio, net = game.net;
  let built = false, scorerCtx, scorerTex, chalkCtx, chalkTex, sight, hud = null, callEl = null, stats = { tris: 0 };
  let sets = [];                  // two instanced sets of three darts: [0] the player's (or whoever throws first), [1] the other's
  const D = [];                   // 6 darts: {set, i, state: 'none'|'hand'|'fly'|'in'|'drop'|'floor', ...}
  let G = null;                   // the leg this client is playing
  let Wt = null;                  // somebody else's leg at the board: {from, m (the 'm' message), t}
  let hintOn = false;
  const rng = Math.random;
  const others = () => { let n = 0; for (const o of net.others.values()) if (o.place === ID) n++; return n; };
  const send = (d) => { if (net.connected && others() > 0) net.send('darts', d); };

  function build(scene) {
    if (built) return; built = true;
    try { hintOn = !!(game.state.flags && game.state.flags.dartsHint); } catch { /* */ }
    const RM = bar.room.mats;
    const board = new THREE.Mesh(new THREE.CircleGeometry(0.31, 72), new THREE.MeshStandardMaterial({ map: drawBoard(), roughness: 0.9 }));
    board.name = 'darts:board'; board.position.set(BD.x, BD.y, BD.z); board.rotation.y = Math.PI / 2; board.matrixAutoUpdate = false; board.updateMatrix(); scene.add(board);
    const fit = new Geo();
    // the board's own depth (38 mm of sisal in a steel band) on a backing disc, and the chalkboard's frame and ledge
    fit.col(0x8a8d90); for (let i = 0; i < 40; i++) { const a0 = (i / 40) * 6.2832, a1 = ((i + 1) / 40) * 6.2832, r = DR.R.board / 1000; fit.quad([BD.x - 0.002, BD.y + Math.cos(a0) * r, BD.z + Math.sin(a0) * r], [BD.x - 0.002, BD.y + Math.cos(a1) * r, BD.z + Math.sin(a1) * r], [BD.x - 0.04, BD.y + Math.cos(a1) * r, BD.z + Math.sin(a1) * r], [BD.x - 0.04, BD.y + Math.cos(a0) * r, BD.z + Math.sin(a0) * r]); }
    fit.col(0x0a0a0a); for (let i = 0; i < 32; i++) { const a0 = (i / 32) * 6.2832, a1 = ((i + 1) / 32) * 6.2832, r = 0.31; fit.quad([BD.x - 0.0005, BD.y + Math.cos(a0) * r, BD.z + Math.sin(a0) * r], [BD.x - 0.0005, BD.y + Math.cos(a1) * r, BD.z + Math.sin(a1) * r], [BD.x - 0.045, BD.y + Math.cos(a1) * r, BD.z + Math.sin(a1) * r], [BD.x - 0.045, BD.y + Math.cos(a0) * r, BD.z + Math.sin(a0) * r]); }
    const CB = { z: BD.z - 0.7, y: 1.4, w: 0.48, h: 0.72 }, cx = BD.wall + 0.04;       // (on the board's wall — the alcove's west wall, _bar_plan.js — towards the stone ledge)
    fit.col(0x3a2414); for (const s of [-1, 1]) { fit.box(cx + 0.012, CB.y - CB.h / 2 - 0.02, CB.z + s * (CB.w / 2 + 0.012), 0.03, CB.h + 0.04, 0.024); fit.box(cx + 0.012, CB.y + s * (CB.h / 2 + 0.01) - 0.012, CB.z, 0.03, 0.024, CB.w + 0.048); }
    fit.box(cx + 0.03, CB.y - CB.h / 2 - 0.035, CB.z, 0.07, 0.014, CB.w + 0.04);                              // chalk ledge
    fit.col(0xf0eee6).box(cx + 0.045, CB.y - CB.h / 2 - 0.021, CB.z + 0.1, 0.012, 0.012, 0.07).box(cx + 0.04, CB.y - CB.h / 2 - 0.021, CB.z - 0.06, 0.012, 0.012, 0.045, 0.5);   // chalk
    fit.col(0x6a6a70).box(cx + 0.04, CB.y - CB.h / 2 - 0.021, CB.z - 0.17, 0.05, 0.03, 0.1);                 // the board rubber
    // the raised oche (a strip of wood to toe) behind the painted line the room already has
    fit.col(0x2a1a10).box(OCHE + 0.06, 0, BD.z, 0.04, 0.035, 0.62);
    const fm = staticMesh(fit.build(), RM.col, 'darts:fittings'); scene.add(fm); stats.tris = fit.tris;
    // chalkboard (the leg, with the subtraction) to the right of the board; the electronic scorer to its left (photo)
    const cc = document.createElement('canvas'); cc.width = 320; cc.height = 480; chalkCtx = cc.getContext('2d');
    chalkTex = new THREE.CanvasTexture(cc); chalkTex.colorSpace = THREE.SRGBColorSpace; chalkTex.anisotropy = 4;
    const chalk = new THREE.Mesh(new THREE.PlaneGeometry(CB.w, CB.h), new THREE.MeshBasicMaterial({ map: chalkTex }));
    chalk.name = 'darts:chalkboard'; chalk.position.set(cx + 0.012, CB.y, CB.z); chalk.rotation.y = Math.PI / 2; chalk.matrixAutoUpdate = false; chalk.updateMatrix(); scene.add(chalk);
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 192; scorerCtx = sc.getContext('2d');
    scorerTex = new THREE.CanvasTexture(sc); scorerTex.colorSpace = THREE.SRGBColorSpace;
    const scorer = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.165), new THREE.MeshBasicMaterial({ map: scorerTex }));
    scorer.name = 'darts:scorer'; scorer.position.set(BD.wall + 0.072, 1.86, BD.z + 0.66); scorer.rotation.y = Math.PI / 2; scene.add(scorer);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.19, 0.47), RM.col); box.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(24 * 3).fill(0.004), 3));
    box.position.set(BD.wall + 0.045, 1.86, BD.z + 0.66); scene.add(box);
    // darts: two instanced sets of three (red-and-white flights; pink-and-black, the college colours)
    const ga = dartGeo(0xc8202a, 0xf0ece0), gb = dartGeo(0xe070a0, 0x141414, 0x4a4a50);
    for (let s = 0; s < 2; s++) { const im = new THREE.InstancedMesh(s ? gb : ga, RM.gloss, 3); im.name = 'darts:set' + s; im.frustumCulled = false; for (let i = 0; i < 3; i++) { im.setMatrixAt(i, _zero); D.push({ set: s, i, state: 'none', m: new THREE.Matrix4() }); } scene.add(im); sets.push(im); }
    // the sight: a small ring that is the hand's aim, wandering
    // (one mesh: a light ring edged dark inside and out, so that it shows on the cream beds and on the black)
    { const sg = new Geo(), ringY = (r0, r1, hex) => { sg.col(hex); for (let i = 0; i < 28; i++) { const a0 = (i / 28) * 6.2832, a1 = ((i + 1) / 28) * 6.2832; sg.quad([Math.cos(a0) * r0, Math.sin(a0) * r0, 0], [Math.cos(a0) * r1, Math.sin(a0) * r1, 0], [Math.cos(a1) * r1, Math.sin(a1) * r1, 0], [Math.cos(a1) * r0, Math.sin(a1) * r0, 0]); } };
      ringY(0.0086, 0.0096, 0x101010); ringY(0.0096, 0.0114, 0xfff6c8); ringY(0.0114, 0.0124, 0x101010); ringY(0, 0.0015, 0xfff6c8);
      sight = new THREE.Mesh(sg.build(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthTest: false })); }
    sight.name = 'darts:sight'; sight.renderOrder = 10; sight.rotation.y = Math.PI / 2; sight.visible = false; scene.add(sight);
    drawScorer(501, 501, '', -1); drawChalk(null);
  }

  // ------------------------------------------------------------------ scoreboards (the only place nicknames appear)
  function drawScorer(a, b, line, who) {
    const g = scorerCtx; if (!g) return;
    g.fillStyle = '#050505'; g.fillRect(0, 0, 512, 192);
    const seg = (txt, x, y, size, col) => { g.font = `bold ${size}px "Courier New", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(80,0,0,0.6)'; g.fillText('888', x, y); g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = col; g.fillText(txt, x, y); g.shadowBlur = 0; };
    seg(String(a).padStart(3, ' '), 128, 74, 104, '#ff2a1a'); seg(b === null ? '   ' : String(b).padStart(3, ' '), 384, 74, 104, '#ff2a1a');
    g.fillStyle = who === 0 ? '#3aff4a' : '#0a3a0a'; g.beginPath(); g.arc(246, 40, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = who === 1 ? '#3aff4a' : '#0a3a0a'; g.beginPath(); g.arc(266, 40, 9, 0, Math.PI * 2); g.fill();
    g.font = 'bold 30px "Courier New", monospace'; g.fillStyle = '#ff5030'; g.textAlign = 'center'; g.fillText(String(line).slice(0, 26), 256, 160);
    scorerTex.needsUpdate = true;
  }
  /** the chalkboard: {start, nick: [a, b], rows: [[{scored, left, bust}]...], turn, over} or null (wiped) */
  function drawChalk(c) {
    const g = chalkCtx; if (!g) return;
    g.fillStyle = '#16181a'; g.fillRect(0, 0, 320, 480);
    let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(230,230,225,${0.012 + r() * 0.025})`; g.beginPath(); g.ellipse(r() * 320, r() * 480, 30 + r() * 70, 8 + r() * 22, r() * 3, 0, Math.PI * 2); g.fill(); }   // old chalk dust
    const chalk = (txt, x, y, size, a = 0.92, align = 'center') => { g.font = `${size}px "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = `rgba(238,236,226,${a})`; g.fillText(txt, x, y); };
    g.strokeStyle = 'rgba(238,236,226,0.8)'; g.lineWidth = 2.5;
    if (!c) { chalk('501', 160, 60, 44, 0.25); chalk('mugs away', 160, 430, 22, 0.3); chalkTex.needsUpdate = true; return; }
    const two = c.nick.length > 1;
    g.beginPath(); g.moveTo(14, 70); g.lineTo(306, 72); g.stroke();
    if (two) { g.beginPath(); g.moveTo(160, 16); g.lineTo(161, 466); g.stroke(); }
    c.nick.forEach((n, p) => {
      const x0 = two ? (p ? 168 : 8) : 60, w = two ? 144 : 200, xc = x0 + w / 2;
      let fs = 25; g.font = `${fs}px "Comic Sans MS", cursive`; while (fs > 13 && g.measureText(n).width > w - 6) { fs -= 1; g.font = `${fs}px "Comic Sans MS", cursive`; }
      chalk(n, xc, 40, fs, c.turn === p && !c.over ? 1 : 0.8);
      if (c.turn === p && !c.over) { g.beginPath(); g.moveTo(xc - 30, 60); g.lineTo(xc + 30, 61); g.stroke(); }
      // the column: the start score, then for every visit what was scored (left) and what is left (right); each
      // superseded remainder is struck through, as it is chalked in a pub
      const rows = c.rows[p], maxRows = 11, from = Math.max(0, rows.length - maxRows), y0 = 96, dy = 31;
      const first = from === 0 ? c.start : rows[from - 1].left;
      chalk(String(first), x0 + w - 14, y0, 27, 0.9, 'right');
      if (rows.length > from) { g.beginPath(); g.moveTo(x0 + w - 66, y0 + 3); g.lineTo(x0 + w - 10, y0 - 3); g.stroke(); }
      for (let k = from; k < rows.length; k++) {
        const q = rows[k], y = y0 + (k - from + 1) * dy, last = k === rows.length - 1;
        chalk(q.bust ? 'bust' : String(q.scored), x0 + 12, y, q.bust ? 19 : 24, 0.72, 'left');
        chalk(String(q.left), x0 + w - 14, y, 27, 0.95, 'right');
        if (!last) { g.beginPath(); g.moveTo(x0 + w - 66, y + 3); g.lineTo(x0 + w - 10, y - 3); g.stroke(); }
        else if (q.left === 0) { g.beginPath(); g.ellipse(x0 + w - 30, y, 30, 16, 0, 0, Math.PI * 2); g.stroke(); }
      }
    });
    chalkTex.needsUpdate = true;
  }
  function boards() {
    if (!built) return;
    if (G) {
      if (G.mode === 'rtc') { drawScorer(G.match.target === 25 ? 'BUL' : G.match.target, G.match.darts, 'ROUND THE CLOCK', 0); drawChalk(null); return; }
      const m = G.match, hint = hintOn && m.winner < 0 && m.remaining <= 170 ? DR.checkoutHint(m.remaining, m.dartsLeft) : null;
      const line = m.winner >= 0 ? 'GAME SHOT' : hint ? hint : m.dartsThisVisit ? m.visit.map((v) => v.label).join(' ') : G.nick[m.turn].toUpperCase();
      drawScorer(m.scores[0], m.scores[1], line, m.winner >= 0 ? -1 : m.turn);
      drawChalk({ start: m.start, nick: G.nick, rows: DR.chalkRows(m), turn: m.turn, over: m.winner >= 0 });
    } else if (Wt) {
      const m = Wt.m, left = [m.start, m.start], rows = [[], []];
      for (const h of m.hist) { left[h[0]] -= h[1]; rows[h[0]].push({ scored: h[1], left: left[h[0]], bust: !!h[2] }); }
      drawScorer(m.sc[0], m.sc[1], m.ph === 'over' ? 'GAME SHOT' : String(m.nick[m.turn] || '').toUpperCase(), m.ph === 'over' ? -1 : m.turn);
      drawChalk({ start: m.start, nick: m.nick, rows, turn: m.turn, over: m.ph === 'over' });
    }
  }

  // ------------------------------------------------------------------ darts in the air, in the board, on the floor
  const dart = (set, i) => D[set * 3 + i];
  function setM(d) { sets[d.set].setMatrixAt(d.i, d.state === 'none' ? _zero : d.m); sets[d.set].instanceMatrix.needsUpdate = true; }
  /** orient a dart: point at p, its length lying back along -dir (dir = the way it flies / points), rolled by `roll` */
  function pose(d, p, dir, roll = 0) {
    _v2.copy(dir).negate().normalize(); _q.setFromUnitVectors(_v.set(0, 0, 1), _v2);
    if (roll) { const r = new THREE.Quaternion().setFromAxisAngle(_v.set(0, 0, 1), roll); _q.multiply(r); }
    d.m.compose(p, _q, _one); setM(d);
  }
  /**
   * Throw dart (set, i) at board point (tx, ty) mm with speed factor k (1 = as the aim allowed for). The landing point
   * comes out of the ballistics; bo = it bounces out (decided by the thrower's client). from: world release point.
   */
  function launch(set, i, tx, ty, k, bo, onLand, from = null) {
    const d = dart(set, i), L = DR.launchFor(tx, ty), v = DR.THROW.v0 * k, hit = DR.flightHit(L.el, L.yaw, v);
    d.state = 'fly'; d.t = 0; d.el = L.el; d.yaw = L.yaw; d.v = v; d.T = hit.t; d.hit = { x: hit.x, y: hit.y, pitch: hit.pitch }; d.bo = !!bo; d.onLand = onLand; d.roll = rng() * 6.28; d.quiet = false;
    d.from = from ? from.clone() : null;      // drawn from the hand that threw it, easing onto the true arc
    return hit;
  }
  const _fa = {}, _p = new THREE.Vector3(), _dir = new THREE.Vector3(), _rel = new THREE.Vector3();
  function updateDarts(dt) {
    for (const d of D) {
      if (d.state === 'fly') {
        d.t += dt;
        const t = Math.min(d.t, d.T), f = DR.flightAt(d.el, d.yaw, d.v, t, _fa);
        relPoint(_rel);
        // the release point is REL_D in front of the board; d runs towards it (-n), l along the board's right
        _p.set(_rel.x - BD.n[0] * f.d + BD.right[0] * f.l, _rel.y + f.y, _rel.z - BD.n[2] * f.d + BD.right[2] * f.l);
        if (d.from) { const u = Math.min(1, t / (d.T * 0.6)); _p.lerp(_v2.copy(d.from).add(_v.copy(_p).sub(_rel)), (1 - u) * (1 - u)); }
        const ch = Math.cos(f.pitch), sy = Math.sin(d.yaw), cy = Math.cos(d.yaw);
        _dir.set(-BD.n[0] * cy * ch + BD.right[0] * sy * ch, Math.sin(f.pitch), -BD.n[2] * cy * ch + BD.right[2] * sy * ch);
        pose(d, _p, _dir, d.roll + d.t * 9);
        if (d.t >= d.T) land(d, _dir);
      } else if (d.state === 'drop') {
        d.t += dt; d.vy -= 9.81 * dt; d.p.x += d.vx * dt; d.p.y += d.vy * dt; d.p.z += d.vz * dt; d.spin += dt * d.w;
        if (d.p.y <= 0.012) { d.p.y = 0.012; d.state = 'floor'; if (!d.quiet) A.dartFloor(); _dir.set(Math.cos(d.spin), 0, Math.sin(d.spin)); pose(d, d.p, _dir, 0.6); }
        else { _dir.set(Math.cos(d.spin) * 0.6, -0.8 + 0.5 * Math.sin(d.spin * 1.7), Math.sin(d.spin) * 0.6); pose(d, d.p, _dir, d.spin); }
      }
    }
  }
  function land(d, dir) {
    const r = Math.hypot(d.hit.x, d.hit.y), cb = d.onLand; d.onLand = null;
    let what = 'in';
    if (d.bo) what = 'bounce'; else if (r > 300) what = 'wall';
    if (what === 'in') {
      d.state = 'in';
      boardPoint(d.hit.x, d.hit.y, _p, -STICK);                 // the point buried in the sisal (or the surround)
      pose(d, _p, dir, d.roll);
      if (!d.quiet) A.thunk(r > DR.R.doubleOut ? 0.5 : 1);
    } else {
      // off a wire (or the wall): it springs back and drops to the floor under the board
      d.state = 'drop'; d.t = 0; d.p = boardPoint(d.hit.x, d.hit.y, new THREE.Vector3(), 0.02); d.vx = BD.n[0] * (0.5 + rng() * 0.5); d.vz = (rng() - 0.5) * 0.8; d.vy = 0.5 + rng() * 0.6; d.spin = rng() * 6; d.w = 5 + rng() * 6;
      if (!d.quiet) { if (what === 'wall') A.dartWall(); else A.bounceOut(); }
    }
    if (cb) { try { cb(what); } catch (e) { console.error(e); } }
  }
  function clearDarts(set = -1) { for (const d of D) if (set < 0 || d.set === set) { d.state = 'none'; d.onLand = null; setM(d); } }
  const dartsOut = (set) => D.some((d) => d.set === set && d.state !== 'none' && d.state !== 'hand');

  // ------------------------------------------------------------------ panel
  const css = 'position:fixed;font-family:Georgia,serif;color:#f4ecd8;pointer-events:none;z-index:20;';
  function makeHud() {
    if (typeof document === 'undefined' || !document.body || !document.body.append) return;
    hud = document.createElement('div'); hud.style.cssText = css + 'left:16px;top:16px;min-width:270px;max-width:300px;background:rgba(10,8,6,.78);border:1px solid #6a5a3a;border-radius:6px;padding:10px 14px;font-size:15px;line-height:1.35';
    callEl = document.createElement('div'); callEl.style.cssText = css + 'left:0;right:0;top:7%;text-align:center;font-size:42px;font-weight:bold;text-shadow:0 0 12px #000,0 0 4px #000;opacity:0;transition:opacity .3s';
    document.body.append(hud, callEl);
  }
  function dropHud() { for (const e of [hud, callEl]) e && e.remove && e.remove(); hud = callEl = null; }
  let callT = 0;
  function call(text, secs = 2.2, color = '#ffe9a8') { G && (G.lastCall = text); if (!callEl) return; callEl.textContent = text; callEl.style.color = color; callEl.style.opacity = '1'; callT = secs; }
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function renderHud() {
    if (!hud || !G) return;
    let h = '';
    if (G.mode === 'rtc') {
      const m = G.match;
      h += `<div style="font-size:18px;color:#e584ab;font-weight:bold">Round the Clock</div><div>Target: <b style="font-size:22px">${m.label}</b> &nbsp; darts: ${m.darts}</div>`;
      const best = game.state.flags.bar_rtc_best; if (best) h += `<div style="opacity:.75">Your best: ${best} darts</div>`;
    } else {
      const m = G.match;
      h += `<div style="font-size:18px;color:#e584ab;font-weight:bold">${m.start} &middot; double out${G.stake ? ' &middot; a pint on it' : ''}</div>`;
      G.players.forEach((p, i) => {
        const on = m.turn === i && m.winner < 0, lv = m.lastVisit[i];
        h += `<div style="margin-top:6px;${on ? 'color:#fff' : 'opacity:.7'}">${on ? '&#9654; ' : ''}<b>${esc(p.name)}</b> <span style="float:right;font-size:22px;font-weight:bold;color:#ff5a3a">${m.scores[i]}</span><br>`;
        h += `<span style="font-size:12px;opacity:.8">average ${m.average(i).toFixed(1)}${lv ? ` &middot; last ${lv.bust ? 'bust' : lv.total}` : ''}</span></div>`;
      });
      if (m.winner < 0) {
        h += `<div style="margin-top:6px">This visit: <b>${m.dartsThisVisit ? m.visit.map((v) => v.label).join('  ') : '-'}</b></div>`;
        const p = G.players[m.turn];
        if (hintOn && p.kind === 'human') { const hint = m.remaining <= 170 ? DR.checkoutHint(m.remaining, m.dartsLeft) : null; if (hint) h += `<div style="color:#7aff8a">Out: <b>${hint}</b></div>`; else if (m.remaining <= 170 && DR.BOGEYS.includes(m.remaining)) h += `<div style="opacity:.75">No out from here</div>`; }
        if (p.kind !== 'human') h += `<div style="opacity:.7;font-size:12px">${p.kind === 'ai' ? 'Space: hurry them up' : 'Waiting for ' + esc(p.name) + '...'}</div>`;
      }
    }
    h += `<div style="margin-top:8px;font-size:11px;opacity:.65">Mouse: aim &middot; hold to draw back, let go to throw &middot; C: view &middot; H: outs chart ${hintOn ? 'on' : 'off'} &middot; Esc: leave</div>`;
    hud.innerHTML = h;
  }

  // ------------------------------------------------------------------ people at the oche
  const SPOT = { oche: [OCHE + 0.2, BD.z - 0.02, -Math.PI / 2], aside: [OCHE + 1.35, BD.z - 0.7, -Math.PI / 2 + 0.3], oppOche: [OCHE + 0.2, BD.z + 0.1, -Math.PI / 2], oppAside: [OCHE + 1.3, BD.z + 1.25, -Math.PI / 2 - 0.45], board: [BD.x + 0.62, BD.z + 0.3, -Math.PI / 2 - 0.25] };
  function putPlayer(k, pose = 'stand') { const p = game.player, s = SPOT[k]; p.pos.set(s[0], 0, s[1]); p.heading = s[2]; p.pose = pose; }
  function putOpp(k, pose = 'stand') { const o = G && G.oppPed; if (!o) return; const s = SPOT[k]; o.x = s[0]; o.z = s[1]; o.heading = s[2]; o.homeX = o.x; o.homeZ = o.z; o.homeH = o.heading; if (o.character.pose !== pose) o.character.setPose(pose); }
  /** someone near the board says something: a bubble (heard instead if a clip of that line exists for them) */
  function crowd(lines, p = 0.5, who = null) { if (rng() > p) return; const c = who || (bar.dartsOnlooker && bar.dartsOnlooker()) || (G && G.oppPed); if (c && c.character) c.character.say(pick(lines), 2.4); }
  /** the score call: the caller's voice if that line was ever recorded, otherwise a bubble over whoever is chalking */
  function scoreCall(text, short = null) {
    const c = (bar.dartsOnlooker && bar.dartsOnlooker()) || (G && G.oppPed);
    const has = (t) => A.speech && game.voice && game.voice.has && game.voice.has('darts_caller', t);
    if (has(text)) { A.say(text); return; }
    if (short && has(short)) A.say(short);
    if (c && c.character) c.character.say(text, 2.6);
  }

  // ------------------------------------------------------------------ a leg
  function start(mode, opts = {}) {
    build(bar.scene);
    if (G) return;
    Wt = null; clearDarts();
    const me = { name: game.player.name || 'You', nick: playerDartsName(game, bar.people), kind: 'human' };
    G = { mode, players: [], nick: [], phase: 'aim', aim: { x: 0, y: 103 }, hold: -1, draw: 0, swayT: rng() * 100, pause: 0, dartIdx: 0, oppPed: null, stake: false, view: 'eye', ai: { wait: 0, lastPhase: 0, fast: false }, relT: 0, stT: 0, lastCall: '', start: opts.start || 501 };
    if (mode === 'rtc') { G.players = [me]; G.match = new DR.RoundClock(); G.aim = { x: 0, y: 140 }; }
    else if (mode === 'mp') {
      const other = { name: opts.remoteName, nick: opts.remoteNick || opts.remoteName, kind: 'remote', id: opts.remoteId };
      G.players = opts.iStart ? [me, other] : [other, me]; G.remoteId = opts.remoteId;
      G.match = new DR.X01(G.players.map((p) => p.name), G.start);
    } else {
      const r = opts.roster;
      G.players = [me, { name: tagName(r), nick: r.nick, kind: 'ai', roster: r }];
      G.match = new DR.X01(G.players.map((p) => p.name), G.start);
      G.oppPed = bar.borrowTeamMember ? bar.borrowTeamMember(r) : null;
      if (game.state.money >= 2.8) G.stake = true;
      G.streak = 0;
    }
    G.nick = G.players.map((p) => p.nick);
    G.me = G.players.findIndex((p) => p.kind === 'human');
    game.beginActivity({ name: 'darts', pointer: 'locked', update: (dt) => tick(dt), camera: (dt, cam) => camera(dt, cam), onKey: (code) => key(code), onEnd: () => end() });
    makeHud();
    const p0 = G.players[0];
    if (mode === '501') {
      const r = opts.roster;
      if (G.oppPed) G.oppPed.character.say(r.lines[0], 3);
      call(`${p0.name} to throw first`, 2);
      game.ui.toast(G.stake ? `${G.start} against ${tagName(r)} — a pint on it (£2.80)` : `${G.start} against ${tagName(r)}. You can't afford to stake a pint — friendly leg.`, 4);
    } else if (mode === 'rtc') call('Round the Clock: 1 to 20, then the bull', 2.5);
    else call(`${p0.name} to throw first`, 2);
    try { const fl = game.state.flags || (game.state.flags = {}); if (!fl.dartsTip2 && p0.kind === 'human') { fl.dartsTip2 = true; call('Hold to draw the dart back, let go to throw', 5); } } catch { /* */ }
    beginVisit(); sendMatch();
  }
  const cur = () => G.players[G.mode === 'rtc' ? 0 : G.match.turn];
  const setOf = (pi) => (G.mode === 'rtc' ? 0 : pi);
  function beginVisit() {
    if (!G) return;
    G.dartIdx = 0; G.phase = 'aim'; G.ai.wait = 0.6; G.ai.fast = false; G.hold = -1; G.draw = 0;
    const p = cur();
    if (p.kind === 'human') { putPlayer('oche', 'throw'); putOpp('oppAside'); G.aim.x = 0; G.aim.y = G.mode === 'rtc' ? 140 : 103; }
    else { putPlayer('aside'); putOpp('oppOche', 'throw'); }
    renderHud(); boards();
  }

  /** a dart thrown by player pi has come to rest: what = 'in' | 'bounce' | 'wall'; (bx, by) where it met the board plane */
  function landed(pi, bx, by, what) {
    if (!G) return null;
    const res = what === 'in' ? { ...DR.scoreAt(bx, by, {}) } : { n: 0, mult: 0, score: 0, isDouble: false, label: what === 'bounce' ? 'OUT' : 'WALL' };
    if (what === 'bounce') { call('Bounce-out!', 1.4, '#ff9a6a'); crowd(DARTS_LINES.bounce, 0.7); }
    else if (what === 'wall') crowd(DARTS_LINES.wall, 0.8);
    if (G.phase === 'flying') G.phase = 'aim';
    if (G.mode === 'rtc') {
      const r = G.match.throwDart(res);
      if (r.hit) { A.caller(); call(res.label, 1.0, '#7aff8a'); }
      if (G.match.done) {
        const best = game.state.flags.bar_rtc_best;
        if (!best || G.match.darts < best) { game.state.flags.bar_rtc_best = G.match.darts; game.save(); }
        call(`Round the Clock in ${G.match.darts} darts!`, 4, '#7aff8a'); A.caller('win'); G.phase = 'over';
      } else if (++G.dartIdx >= 3) { G.phase = 'pause'; G.pause = 1.0; G.collector = 0; }
      renderHud(); boards();
      return res;
    }
    const m = G.match, out = m.throwDart(res);
    if (res.mult === 3 && res.n >= 17) A.ooh();
    if (pi === 1 && G.players[1].roster && G.players[1].roster.streaky) G.streak = res.mult === 3 ? 1 : 0;
    if (out.checkout) {
      const w = G.players[pi], line = `Game shot, and the leg, ${w.name}`;
      call(line + '!', 4, '#7aff8a'); A.caller('win'); A.cheer();
      // (tools/voices/extract.mjs reads the next line for the caller's game-shot template: keep its form)
      if (A.speech && game.voice && game.voice.has && game.voice.has('darts_caller', line)) A.say(`Game shot, and the leg, ${w.name}`); else scoreCall(line, 'Game shot!');
      G.phase = 'over'; finishLeg(pi);
    } else if (out.visitOver) {
      const line = DR.callVisit(out.total, out.bust);
      call(line, 2.2, out.bust ? '#ff7a6a' : out.total === 180 ? '#ffd040' : '#ffe9a8');
      scoreCall(line); A.caller(out.bust ? 'bust' : out.total === 180 ? '180' : 'score');
      if (out.total === 180) A.cheer(); else if (out.total >= 100) A.ooh(true);
      if (pi === 1 && G.oppPed && rng() < 0.4) setTimeout(() => { if (G && G.oppPed) G.oppPed.character.say(out.bust ? 'Nooo.' : out.total >= 100 ? G.players[1].roster.lines[1 + Math.floor(rng() * 2)] : 'Hm.', 2); }, 1500);
      else if (pi === G.me) setTimeout(() => { if (G) crowd(out.bust ? DARTS_LINES.bust : out.total === 180 ? DARTS_LINES.big : out.total >= 100 ? DARTS_LINES.ton : DARTS_LINES.low, out.total >= 100 || out.bust ? 0.7 : 0.2, G.oppPed); }, 1700);
      G.phase = 'pause'; G.pause = 1.5; G.collector = pi;
    } else G.dartIdx++;
    renderHud(); boards(); if (out.visitOver) sendMatch();
    return res;
  }
  function finishLeg(winner) {
    const human = G.me;
    if (G.mode === '501' && G.stake) {
      const opp = G.players[1];
      if (winner === human) setTimeout(() => { game.ui.toast(`${tagName(opp.roster)} buys you a pint.`, 4); bar.drink && bar.drink('pint', true); }, 1500);
      else setTimeout(() => { game.pay(-2.8); game.ui.toast(`You owe ${tagName(opp.roster)} a pint: -£2.80`, 4); }, 1500);
    }
    if (G.oppPed) setTimeout(() => { if (G && G.oppPed) G.oppPed.character.say(winner === human ? 'Well thrown.' : 'Unlucky. Another?', 3); }, 2600);
    putPlayer('aside'); putOpp('oppAside');
    sendMatch();
    if (hud) setTimeout(() => { if (G && G.phase === 'over' && hud) hud.innerHTML += '<div style="margin-top:6px;color:#ffd040">R: another leg &middot; Esc: done</div>'; }, 300);
  }

  /** the local player's dart: aimed at (ax, ay) mm, thrown with speed factor k */
  function humanThrow(ax, ay, k = 1) {
    const p = cur(); if (!G || p.kind !== 'human' || G.phase !== 'aim') return null;
    const pi = G.mode === 'rtc' ? 0 : G.match.turn, set = setOf(pi), i = G.dartIdx % 3;
    const L = DR.launchFor(ax, ay), hit = DR.flightHit(L.el, L.yaw, DR.THROW.v0 * k);
    const x = Math.round(hit.x * 10) / 10, y = Math.round(hit.y * 10) / 10;       // to the 0.1 mm that is sent
    const bo = DR.bouncesOut(x, y, G.forceBounce !== undefined ? G.forceBounce : rng());
    G.phase = 'flying'; G.relT = 0.0001;
    send({ op: 'dart', x: Math.round(x * 10), y: Math.round(y * 10), k: +k.toFixed(4), bo: bo ? 1 : 0, i });
    A.swish();
    throwTo(set, i, x, y, k, bo, pi, G.handPos || null);
    return { x, y, bo };
  }
  /** fly dart (set, i) so that it meets the board plane at exactly (x, y) mm on the arc of speed factor k */
  function throwTo(set, i, x, y, k, bo, pi, from = null) {
    // the aim that gives this landing at this speed: solve by two fixed-point steps (the drop is nearly independent of it)
    let ay = y; for (let n = 0; n < 4; n++) { const L = DR.launchFor(x, ay), h = DR.flightHit(L.el, L.yaw, DR.THROW.v0 * k); ay += y - h.y; }
    launch(set, i, x, ay, k, bo, (what) => landed(pi, x, y, what), from);
  }

  function aiTick(dt) {
    const p = cur(), r = p.roster, m = G.match, ai = G.ai;
    if (G.phase !== 'aim') return;
    const ch = G.oppPed && G.oppPed.character;
    let release = false;
    if (ai.fast) { ai.wait -= dt; if (ai.wait <= 0) { release = true; ai.wait = 0.35; } }
    else if (ch) {
      const ph = ch.throwPhase || 0;
      if (ai.lastPhase < 0.62 && ph >= 0.62) release = true;
      ai.lastPhase = ph;
      ai.wait -= dt; if (ai.wait < -4) { release = true; ai.wait = 0; }      // (if the pose is not animating)
      if (release) ai.wait = 0;
    } else { ai.wait -= dt; if (ai.wait <= 0) { release = true; ai.wait = 1.4 * r.tempo; } }
    if (!release) return;
    let blocked = false;
    if (r.switcher) { let n = 0; for (const v of m.visit) if (v.n === 20 && m.dartsThisVisit) n++; blocked = n >= 2 && m.dartsThisVisit === 2; }
    const sk = { sigma: r.sigma * (r.streaky && G.streak ? 0.75 : 1), dblSigma: r.dblSigma, aspect: r.aspect };
    const t = DR.aiThrow(m.remaining, m.dartsLeft, sk, rng, { blocked });
    const x = Math.round(t.x * 10) / 10, y = Math.round(t.y * 10) / 10, bo = DR.bouncesOut(x, y, rng());
    let from = null;
    if (ch && ch.anchors) { ch.anchors.handR.getWorldPosition(_v); if (Number.isFinite(_v.x) && _v.distanceTo(relPoint(_v2)) < 1.2) from = _v.clone(); }
    G.phase = 'flying';
    // each of the team throws their own arc: the lobbers slower and higher, the hard throwers flat
    const k = Math.max(0.8, Math.min(1.25, 1.12 - (r.arc - 0.07) * 1.1));
    send({ op: 'dart', x: Math.round(x * 10), y: Math.round(y * 10), k: +k.toFixed(4), bo: bo ? 1 : 0, i: G.dartIdx % 3 });
    throwTo(1, G.dartIdx % 3, x, y, k, bo, m.turn, from);
  }

  function tick(dt) {
    if (!G) return;
    if (callT > 0) { callT -= dt; if (callT <= 0 && callEl) callEl.style.opacity = '0'; }
    if (G.relT > 0) { G.relT += dt; if (G.relT > 0.7) G.relT = 0; }
    if (G.phase === 'pause') {
      // the score stands for a moment, then the thrower walks up and pulls the darts (one at a time), then the next
      G.pause -= dt;
      if (G.pause <= 0) { G.phase = 'collect'; G.colT = 0; G.colN = 0; const mine = G.collector === G.me || G.mode === 'rtc'; if (mine) putPlayer('board'); else putOpp('board'); }
      return;
    }
    if (G.phase === 'collect') {
      G.colT += dt * (G.ai.fast ? 3 : 1);
      const set = setOf(G.collector), want = Math.floor((G.colT - 0.45) / 0.3) + 1;
      while (G.colN < want && G.colN < 3) { const d = dart(set, G.colN++); if (d.state !== 'none') { d.state = 'none'; setM(d); A.pluck(); } }
      if (G.colT > 0.45 + 0.9 + 0.35) beginVisit();
      return;
    }
    if (G.phase === 'over') { sight.visible = false; return; }
    const p = cur();
    if (p.kind !== 'human') { sight.visible = false; if (p.kind === 'ai') aiTick(dt); return; }
    // ---- the local player's aim
    const inp = game.input, drunk = game.player.drunk || 0;
    if (inp.locked) { G.aim.x += inp.mouseDX * 0.3; G.aim.y -= inp.mouseDY * 0.3; }
    const ks = 150 * dt;
    if (inp.down('ArrowLeft')) G.aim.x -= ks; if (inp.down('ArrowRight')) G.aim.x += ks; if (inp.down('ArrowUp')) G.aim.y += ks; if (inp.down('ArrowDown')) G.aim.y -= ks;
    G.aim.x = Math.max(-250, Math.min(250, G.aim.x)); G.aim.y = Math.max(-250, Math.min(250, G.aim.y));
    const holding = (inp.mouseDown || inp.down('Space')) && G.phase === 'aim';
    if (holding) { if (G.hold < 0) G.hold = 0; G.hold += dt; } else if (G.hold >= 0 && G.phase !== 'aim') G.hold = -1;
    // the hand: breathing and tremor (more with drink), steadier for the first second of the draw, shaking if held
    const tire = G.hold > 1.3 ? 1 + (G.hold - 1.3) * 1.4 : G.hold >= 0 ? 1 - 0.3 * Math.min(1, G.hold / 0.6) : 1;
    const amp = (1 + 3.2 * drunk) * tire;             // (a pint is 0.12: the ring wanders a third further)
    G.swayT += dt * (1 + drunk * 0.5);
    const sw = DR.sway(G.swayT, amp, G._sw || (G._sw = {}));
    G.cur = { x: G.aim.x + sw.x, y: G.aim.y + sw.y };
    sight.visible = G.phase === 'aim' && G.view === 'eye';
    boardPoint(G.cur.x, G.cur.y, sight.position, 0.004);
    G.draw = G.hold >= 0 ? Math.min(1, G.hold / 0.55) : Math.max(0, G.draw - dt * 6);
    if (!holding && G.hold >= 0 && G.phase === 'aim') {
      const draw = Math.min(1, G.hold / 0.55); G.hold = -1;
      if (draw > 0.2) {
        // a snatched draw is a slow dart (it drops short); the let-go adds a little of its own
        const k = 0.93 + 0.07 * draw + DR.gauss(rng) * (0.003 + 0.012 * drunk);
        humanThrow(G.cur.x + DR.gauss(rng) * (1.6 + 9 * drunk), G.cur.y + DR.gauss(rng) * (1.2 + 6 * drunk), k);
      }
    }
  }

  // ------------------------------------------------------------------ every frame in the bar (after the player's update)
  function frame(dt) {
    if (!built) return;
    updateDarts(dt);
    if (G) {
      const p = game.player, human = cur().kind === 'human' && G.phase !== 'over' && G.phase !== 'pause' && G.phase !== 'collect';
      const collecting = G.phase === 'collect' && (G.collector === G.me || G.mode === 'rtc');
      p.character.group.visible = !(human && G.view === 'eye');
      const b = p.character.bones;
      if (human && b) {
        // the throwing arm: elbow up and still, the forearm cocked back with the draw, snapped through on the release
        const rel = G.relT > 0 ? Math.min(1, G.relT / 0.09) : 0, back = G.relT > 0.25 ? Math.min(1, (G.relT - 0.25) / 0.4) : 0;
        const el = G.relT > 0 ? (back > 0 ? 0.25 + (1.5 - 0.25) * back : 1.5 + 0.7 * G.draw + (0.25 - 1.5 - 0.7 * G.draw) * rel) : 1.5 + 0.7 * G.draw;
        b.armR.rotation.set(-(1.45 + (G.relT > 0 && !back ? 0.2 * rel : 0)), 0, 0.12); b.foreR.rotation.set(-el, 0, 0);
      } else if (collecting && b) { const u = Math.min(1, G.colT / 0.4); b.armR.rotation.set(-1.7 * u, 0, 0.1); b.foreR.rotation.set(-0.35 * u, 0, 0); }
      // the dart in the hand: before the eye in the first-person view, in the fingers otherwise
      if (human && G.phase === 'aim') {
        const set = setOf(G.mode === 'rtc' ? 0 : G.match.turn), d = dart(set, G.dartIdx % 3);
        if (d.state === 'none' || d.state === 'hand') {
          d.state = 'hand';
          boardPoint(G.cur ? G.cur.x : 0, G.cur ? G.cur.y : 100, _v2, 0);
          if (G.view === 'eye') { const cam = game.camera; _p.copy(cam.position).addScaledVector(_dir.set(0, 0, -1).applyQuaternion(cam.quaternion), 0.5 - 0.13 * G.draw).addScaledVector(_v.set(1, 0, 0).applyQuaternion(cam.quaternion), 0.055).addScaledVector(_v.set(0, 1, 0).applyQuaternion(cam.quaternion), -0.058 + 0.012 * G.draw); }
          else { p.character.anchors.handR.getWorldPosition(_p); _p.y += 0.03; }
          G.handPos = (G.handPos || new THREE.Vector3()).copy(_p);
          _dir.copy(_v2).sub(_p).normalize(); _dir.y += 0.28; _dir.normalize();
          pose(d, _p, _dir, 0.4);
        }
      }
      if ((G.stT -= dt) <= 0) sendMatch();
      if (hud && (G.hudT = (G.hudT || 0) - dt) <= 0) { G.hudT = 0.3; renderHud(); }
    } else if (Wt) {
      Wt.t += dt;
      if (Wt.t > 14) { Wt = null; clearDarts(); drawScorer(501, 501, '', -1); drawChalk(null); }
    }
  }

  function camera(dt, cam) {
    if (!G) return;
    const p = cur(), human = p.kind === 'human' && G.phase !== 'over' && G.phase !== 'pause' && G.phase !== 'collect';
    if (human && G.view === 'eye') {
      cam.fov = 26; cam.position.set(OCHE + 0.16, 1.63, BD.z + 0.035);
      cam.lookAt(BD.x, BD.y + 0.015, BD.z);
      const d = game.player.drunk || 0; if (d > 0) cam.rotation.z += Math.sin(game.elapsed * 0.8) * 0.03 * d;
    } else if (human) { cam.fov = 52; cam.position.set(OCHE + 1.45, 1.8, BD.z + 0.42); cam.lookAt(BD.x + 0.2, 1.55, BD.z - 0.12); }      // over the thrower's left shoulder, clear of the people standing by
    else { cam.fov = 50; cam.position.set(OCHE + 0.9, 1.85, BD.z + 2.05); cam.lookAt(BD.x + 1.1, 1.4, BD.z - 0.15); }
    cam.updateProjectionMatrix();
  }

  function key(code) {
    if (!G) return;
    if (code === 'KeyC') G.view = G.view === 'eye' ? 'side' : 'eye';
    if (code === 'KeyH') { hintOn = !hintOn; try { (game.state.flags || (game.state.flags = {})).dartsHint = hintOn; game.save && game.save(); } catch { /* */ } boards(); }
    if (code === 'Space' && cur().kind === 'ai') G.ai.fast = true;
    if (code === 'KeyR' && G.phase === 'over' && G.mode !== 'mp') {
      const mode = G.mode, r = G.players[1] && G.players[1].roster, st = G.start;
      bar._keepOpp = G.oppPed; G.oppPed = null; G = null; clearDarts();
      game.endActivity(); start(mode, { roster: r, start: st }); return;
    }
    renderHud();
  }
  function end() {
    if (!G && !bar._keepOpp) { dropHud(); return; }
    if (G && G.mode === 'mp' && G.phase !== 'over') net.send('darts', { op: 'quit', to: G.remoteId });
    if (G) { G.phase = 'over'; sendMatch(); }
    const ped = G ? G.oppPed : null;
    dropHud(); sight && (sight.visible = false);
    game.camera.fov = 60; game.camera.updateProjectionMatrix();
    const p = game.player; p.character.group.visible = true; p.pos.set(OCHE + 0.9, 0, BD.z + 1.0); p.heading = -Math.PI / 2; p.pose = 'stand';
    for (const d of D) if (d.state === 'hand') { d.state = 'none'; setM(d); }
    G = null;
    if (bar._keepOpp) { bar._keepOpp = null; return; }         // another leg: start() borrows the same opponent again
    if (ped && bar.returnTeamMember) bar.returnTeamMember(ped);
    setTimeout(() => { if (!G && !Wt) { clearDarts(); drawChalk(null); } }, 6000);
  }
  function sendMatch() {
    if (!G) return;
    G.stT = 3;
    if (G.mode === 'rtc') return;
    const m = G.match, ids = G.players.map((p) => (p.kind === 'human' ? net.id : p.kind === 'remote' ? p.id : 0));
    send({ op: 'm', start: m.start, nick: G.nick, ids, sc: m.scores, turn: m.turn, hist: m.history.map((h) => [h.p, h.total, h.bust ? 1 : 0]), ph: G.phase === 'over' ? 'over' : 'on' });
  }

  // ------------------------------------------------------------------ menu, multiplayer
  let pending = null, outgoing = null;
  const boardBusy = () => (Wt && Wt.t < 9 && Wt.m.ph !== 'over' ? (net.others.get(Wt.from) || {}).name || 'Someone' : null);
  function menu() {
    build(bar.scene);
    game.beginActivity({ name: 'darts-menu', pointer: 'free' });
    const o = game.ui.openOverlay(), box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#14100c;border:2px solid #e584ab;border-radius:8px;padding:18px 22px;color:#f4ecd8;font-family:Georgia,serif;max-height:86vh;overflow:auto;min-width:420px';
    const busy = boardBusy();
    let st = 501;
    box.innerHTML = `<div style="font-size:22px;color:#e584ab;font-weight:bold">Darts — Cellar Bar</div><div style="opacity:.75;margin-bottom:10px">${busy ? `${esc(busy)} is on the board.` : 'Double out. Pick the leg, then someone from the college team:'}</div>`;
    const btn = (label, sub, fn) => { const b = document.createElement('button'); b.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0;padding:6px 10px;background:#221a12;color:#f4ecd8;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font:inherit'; b.innerHTML = label + (sub ? `<div style="font-size:12px;opacity:.7">${sub}</div>` : ''); b.onclick = fn; box.appendChild(b); return b; };
    if (pending) btn(`<b style="color:#7aff8a">Accept ${esc(pending.name)}'s challenge</b>`, `Player against player, ${pending.start}`, () => { net.send('darts', { op: 'accept', to: pending.id, nick: playerDartsName(game, bar.people) }); const pd = pending; pending = null; game.endActivity(); start('mp', { remoteId: pd.id, remoteName: pd.name, remoteNick: pd.nick, iStart: false, start: pd.start }); });
    if (!busy) {
      const leg = btn('', '', () => { st = st === 501 ? 301 : 501; leg.innerHTML = legLabel(); }), legLabel = () => `Leg: <b>${st}</b> <span style="opacity:.6">(click for ${st === 501 ? 301 : 501})</span>`;
      leg.innerHTML = legLabel();
      for (const r of OPPONENTS) btn(`${esc(tagName(r))} <span style="color:#ffd040">${'★'.repeat(stars(r))}${'☆'.repeat(5 - stars(r))}</span>${r.role !== 'player' ? ` <i style="opacity:.7">(${r.role})</i>` : ''}`, r.style, () => { game.endActivity(); start('501', { roster: r, start: st }); });
      btn('<b>Round the Clock</b> (practice)', '1 to 20 in order, then the bull. Fewest darts wins.', () => { game.endActivity(); start('rtc'); });
      for (const x of [...net.others.values()].filter((q) => q.place === ID)) btn(`Challenge <b>${esc(x.name)}</b> (another player here)`, 'They get a prompt to accept at the oche', () => { outgoing = { id: x.id, name: x.name, start: st }; net.send('darts', { op: 'challenge', to: x.id, name: game.player.name || 'Someone', nick: playerDartsName(game, bar.people), start: st }); game.ui.toast(`Challenge sent to ${x.name}`, 3); game.endActivity(); });
    }
    btn(busy ? 'Watch' : 'Cancel', '', () => game.endActivity());
    o.appendChild(box);
  }
  net.on('darts', (d, o) => {
    if (!d || !o) return;
    if (d.to !== undefined) {
      if (d.to !== net.id) return;
      if (d.op === 'challenge') { pending = { id: o.id, name: d.name || o.name, nick: String(d.nick || d.name || o.name).slice(0, 24), start: d.start === 301 ? 301 : 501 }; game.ui.toast(`${pending.name} challenges you to ${pending.start} — go to the oche in the Cellar Bar and press E`, 6); }
      else if (d.op === 'accept' && outgoing && outgoing.id === o.id) { const x = outgoing; outgoing = null; if (game.player.place === ID && !G) { if (game.activity) game.endActivity(); start('mp', { remoteId: x.id, remoteName: x.name, remoteNick: String(d.nick || x.name).slice(0, 24), iStart: true, start: x.start }); } }
      else if (d.op === 'quit' && G && G.mode === 'mp' && G.remoteId === o.id) { game.ui.toast(`${o.name} left the leg`, 3); G.phase = 'over'; game.endActivity(); }
      return;
    }
    if (game.player.place !== ID || !built) return;
    if (G) {
      if (G.mode !== 'mp' || G.remoteId !== o.id) return;
      if (d.op === 'dart') {
        const pi = G.match.turn; if (G.players[pi].kind !== 'remote' || G.match.winner >= 0) return;
        if (G.phase === 'pause' || G.phase === 'collect') { clearDarts(setOf(G.collector)); beginVisit(); }     // they are quicker to the oche than our copy of them
        if (G.phase !== 'aim') return; G.phase = 'flying'; G.dartIdx = d.i; throwTo(pi, d.i % 3, d.x / 10, d.y / 10, +d.k || 1, !!d.bo, pi); }
      return;
    }
    // watching somebody else's leg
    if (d.op === 'm') {
      const fresh = !Wt || Wt.from !== o.id, turned = Wt && Wt.m.turn !== d.turn;
      Wt = { from: o.id, m: d, t: 0, set: fresh ? d.turn : Wt.set };
      if (fresh || turned || d.ph === 'over') { if (!fresh && turned) { const s = Wt.set; setTimeout(() => { if (Wt && !G) clearDarts(s); }, 1900); } Wt.set = d.turn; }
      boards();
    } else if (d.op === 'dart' && Wt && (Wt.from === o.id || Wt.m.ids.includes(o.id))) {
      Wt.t = 0; const set = Wt.m.turn; Wt.set = set;
      if (d.i === 0 && dartsOut(set)) clearDarts(set);
      throwTo(set, d.i % 3, d.x / 10, d.y / 10, +d.k || 1, !!d.bo, -1);
    }
  });

  // ------------------------------------------------------------------ the team member at the oche, practising
  const idle = { n: 0, last: 0 };
  function idleTick(dt, thrower) {
    if (G || Wt || !thrower || !built) return;
    const ch = thrower.character, ph = ch.throwPhase || 0;
    if (idle.last < 0.62 && ph >= 0.62) {
      if (idle.n >= 3) { clearDarts(1); idle.n = 0; }
      const t = DR.aiThrow(501, 3, { sigma: thrower.roster ? thrower.roster.sigma : 18 }, rng);
      ch.anchors.handR.getWorldPosition(_v);
      const from = Number.isFinite(_v.x) && _v.distanceTo(relPoint(_v2)) < 1.2 ? _v.clone() : null, near = game.player.place === ID && game.player.pos.distanceTo(_v2) < 7;
      const i = idle.n++, x = t.x, y = t.y;
      let ay = y; for (let n = 0; n < 4; n++) { const L = DR.launchFor(x, ay), h = DR.flightHit(L.el, L.yaw, DR.THROW.v0); ay += y - h.y; }
      launch(1, i, x, ay, 1, DR.bouncesOut(x, y, rng()), near ? null : () => {}, from);
      if (!near) dart(1, i).quiet = true;
    }
    idle.last = ph;
  }

  return {
    build, menu, start, idleTick, frame, get active() { return !!G; }, get game() { return G; }, get watching() { return Wt; }, get stats() { return stats; }, get darts() { return D; },
    get hint() { return hintOn; }, set hint(v) { hintOn = !!v; boards(); },
    /** test hooks: throw the local player's next dart so that it lands exactly at board (x, y) mm (bounce: force a bounce-out) */
    debugThrow(x, y, bounce = false) {
      if (!G) return 'no game';
      for (let n = 0; n < 400 && (G.phase === 'pause' || G.phase === 'collect'); n++) { updateDarts(0.05); tick(0.05); }      // the last visit's darts are pulled first
      if (cur().kind !== 'human' || G.phase === 'over') return 'not your turn'; G.phase = 'aim';
      const pi = G.mode === 'rtc' ? 0 : G.match.turn, i = G.dartIdx % 3; G.phase = 'flying'; G.relT = 0.0001;
      send({ op: 'dart', x: Math.round(x * 10), y: Math.round(y * 10), k: 1, bo: bounce ? 1 : 0, i });
      throwTo(setOf(pi), i, x, y, 1, bounce, pi, null); return 'thrown';
    },
    /** throw as the mouse would: aim point (mm), draw 0..1 -> where it lands */
    debugRelease(ax, ay, draw = 1) { if (!G) return null; G.phase = 'aim'; return humanThrow(ax, ay, 0.93 + 0.07 * draw); },
    /** finish all flights (and the pause / collecting) at once */
    settle() { for (let i = 0; i < 400 && G && (D.some((d) => d.state === 'fly' || d.state === 'drop') || G.phase === 'pause' || G.phase === 'collect'); i++) { updateDarts(0.05); tick(0.05); } return G ? { scores: G.match.scores, turn: G.match.turn, phase: G.phase } : null; },
    debugAim(x, y) { if (G) { G.aim.x = x; G.aim.y = y; } },
    /** run the leg for `sec` seconds of game time right now (opponent hurried) */
    step(sec) { for (let t = 0; t < sec && G; t += 0.05) { if (G.ai && cur().kind === 'ai') G.ai.fast = true; tick(0.05); updateDarts(0.05); } return G ? { scores: G.match.scores, turn: G.match.turn, phase: G.phase, winner: G.match.winner } : null; },
    boardPoint, key, boards,
  };
}
