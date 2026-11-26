// Croquet on the lawn by the Earl Building: court dressing, balls, the "[E] Play croquet" activity (vs AI or another
// player), HUD, help panel, sounds. Rules/physics/AI live in _grounds_croquet_rules.js (pure, smoke-tested).
import * as THREE from 'three';
import * as R from './_grounds_croquet_rules.js';
import { C as COL } from './_grounds_static.js';
import { randomLook } from '../core/characters.js';

const LAWN_Y = 0.032;
const HELP = `<b>Association Croquet</b> (simplified) — you are <span style="color:#6c8cff">Blue</span> &amp; <b>Black</b>.<br>
• Each ball runs hoops 1–6 (full game: then 1-back … Rover, the same hoops in reverse) <i>in order and in the right direction</i>, then hits the peg (“pegging out”). First side to peg out both balls wins.<br>
• A turn = 1 stroke with one of your balls. Running your hoop earns 1 extra (continuation) stroke.<br>
• Hit another ball (a <b>roquet</b>) and you take <b>croquet</b>: your ball is placed touching it and one stroke moves both; then 1 continuation stroke. Each ball can be roqueted once per turn until you run a hoop.<br>
• Croquet stroke: aim = where the croqueted ball goes; <b>A/D</b> sets the split angle (0 = drive, wide = split/take-off).<br>
• Balls off the court go back on the yard line (1 yd in). New balls start from A-baulk (west half of the south yard line).<br>
<b>Controls</b>: mouse aims · hold <b>click</b>/<b>Space</b> for power, release to hit · <b>1/2</b> choose ball · <b>A/D</b> baulk position / split · wheel zoom · <b>V</b> overhead view · <b>H</b> help · <b>Esc</b> quit.<br>
<i>Hoops are 1.3× ball width (real ones are barely wider than the ball) to keep it playable.</i>`;

export function createCroquet(game, opt) {
  const world = game.world, { accs, frame: CF } = opt;
  const court = R.makeCourt();
  const W = court.W, L = court.L;
  // court frame: world = O + ex*x + ey*y
  const ey = [Math.cos(CF.ang), Math.sin(CF.ang)], ex = [-ey[1], ey[0]];
  const O = [CF.cx - ex[0] * W / 2 - ey[0] * L / 2, CF.cz - ex[1] * W / 2 - ey[1] * L / 2];
  const toW = (x, y) => [O[0] + ex[0] * x + ey[0] * y, O[1] + ex[1] * x + ey[1] * y];
  const toC = (wx, wz) => { const dx = wx - O[0], dz = wz - O[1]; return [dx * ex[0] + dz * ex[1], dx * ey[0] + dz * ey[1]]; };
  // heading in the world of court angle a (court dir (cos a, sin a))
  const headingOf = (a) => { const dx = ex[0] * Math.cos(a) + ey[0] * Math.sin(a), dz = ex[1] * Math.cos(a) + ey[1] * Math.sin(a); return Math.atan2(dx, dz); };
  const angleOf = (h) => { const dx = Math.sin(h), dz = Math.cos(h); return Math.atan2(dx * ey[0] + dz * ey[1], dx * ex[0] + dz * ex[1]); };
  const corners = [toW(0, 0), toW(W, 0), toW(W, L), toW(0, L)];
  const xH = Math.atan2(-ex[1], ex[0]);   // box rotation whose local x = court x axis

  // ------------------------------------------------------------------ dressing
  const { props, ground, lines } = accs;
  const M = 2.5;   // surround
  ground.quad(toW(-M, -M), toW(W + M, -M), toW(W + M, L + M), toW(-M, L + M), 0, 0xeef8e0);
  const NS = 10;
  for (let i = 0; i < NS; i++) {
    const x0 = (W * i) / NS, x1 = (W * (i + 1)) / NS;
    ground.quad(toW(x0, 0), toW(x1, 0), toW(x1, L), toW(x0, L), 0.002, i % 2 ? 0xc8e0a8 : 0xffffff);
  }
  lines.strip([...corners], 0.05, 0, 0xffffff, true);
  // corner flags (blue, red, black, yellow at corners I..IV: SW, NW, NE, SE) and corner pegs
  const flagCol = [0x1f4fd0, 0xc8202a, 0x151515, 0xe8c82a], cpos = [[0, 0], [0, L], [W, L], [W, 0]];
  cpos.forEach(([x, y], i) => {
    const [wx, wz] = toW(x + (x ? 0.3 : -0.3), y + (y ? 0.3 : -0.3));
    props.cyl(wx, 0, wz, 0.008, 0.38, 0xf2f2f2, 5);
    props.box(wx + 0.09 * Math.cos(xH), 0.26, wz - 0.09 * Math.sin(xH), 0.17, 0.12, 0.005, xH, flagCol[i]);
    const [px, pz] = toW(x ? x - 0.01 : 0.01, y ? y - 0.01 : 0.01); props.cyl(px, 0, pz, 0.012, 0.05, 0xf2f2f2, 5);
  });
  // hoops: white uprights + crown; hoop 1 crown blue, rover (centre-south hoop, run in reverse) crown red
  for (let i = 0; i < court.hoops.length; i++) {
    const h = court.hoops[i];
    const a = toW(h.x - R.HOOP_HALF_GAP - R.UPRIGHT_R, h.y), b = toW(h.x + R.HOOP_HALF_GAP + R.UPRIGHT_R, h.y);
    props.cyl(a[0], 0, a[1], 0.009, 0.3, 0xf4f4f4, 6); props.cyl(b[0], 0, b[1], 0.009, 0.3, 0xf4f4f4, 6);
    props.beam(a[0], 0.305, a[1], b[0], 0.305, b[1], 0.02, i === 0 ? 0x1f4fd0 : i === 4 ? 0xc8202a : 0xf4f4f4);
  }
  // peg with its coloured bands (blue, red, black, yellow from the top)
  const pg = toW(court.peg[0], court.peg[1]);
  props.cyl(pg[0], 0, pg[1], 0.019, 0.33, 0xf4f4f4, 10);
  flagCol.forEach((c, i) => props.cyl(pg[0], 0.33 + i * 0.035, pg[1], 0.0195, 0.035, c, 10));
  props.cyl(pg[0], 0.47, pg[1], 0.019, 0.01, 0xf4f4f4, 10);
  // mallet rack + bench just outside corner I (south-west), by the A-baulk
  const rackC = toW(-1.6, 2.5), rackH = headingOf(Math.PI);   // rack faces west (out of the court)
  props.box(rackC[0], 0, rackC[1], 0.08, 0.9, 0.08, xH, COL.teakDark);
  {
    const a = toW(-1.6, 1.6), b = toW(-1.6, 3.4);
    props.box(a[0], 0, a[1], 0.08, 0.9, 0.08, xH, COL.teakDark); props.box(b[0], 0, b[1], 0.08, 0.9, 0.08, xH, COL.teakDark);
    props.beam(a[0], 0.85, a[1], b[0], 0.85, b[1], 0.07, COL.teakDark); props.beam(a[0], 0.3, a[1], b[0], 0.3, b[1], 0.07, COL.teakDark);
    for (let i = 0; i < 4; i++) {
      const [mx, mz] = toW(-1.52, 1.9 + i * 0.5);
      props.beam(mx, 0.08, mz, mx, 0.92, mz, 0.03, 0x9a7a52);
      const [hx0, hz0] = toW(-1.52, 1.9 + i * 0.5 - 0.12), [hx1, hz1] = toW(-1.52, 1.9 + i * 0.5 + 0.12);
      props.beam(hx0, 0.08, hz0, hx1, 0.08, hz1, 0.065, 0x7a5a36);
      props.beam(mx, 0.75, mz, mx, 0.8, mz, 0.035, flagCol[i]);
    }
  }
  const benchPos = toW(-2.0, 6.0);
  opt.bench(props, benchPos[0], benchPos[1], headingOf(0));
  game.worldCollider.addBox(rackC[0], rackC[1], 0.3, 2.0, xH + Math.PI / 2);

  // ------------------------------------------------------------------ dynamic meshes
  const ballMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 });
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(R.BALL_R, 14, 10), ballMat, 4);
  const cc = new THREE.Color(); R.BALL_DEFS.forEach((d, i) => balls.setColorAt(i, cc.set(d.color)));
  balls.castShadow = true; balls.frustumCulled = false; balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage); balls.name = 'croquet-balls';
  game.worldScene.add(balls);
  const NDOT = 60;
  const dotGeo = new THREE.CircleGeometry(0.035, 6); dotGeo.rotateX(-Math.PI / 2);
  const dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, transparent: true, opacity: 0.85 }), NDOT);
  dots.frustumCulled = false; dots.visible = false; dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dots.renderOrder = 3;
  for (let i = 0; i < NDOT; i++) dots.setColorAt(i, cc.set(0xffffff));
  game.worldScene.add(dots);
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _hide = new THREE.Matrix4().makeScale(0, 0, 0);

  // display state (when nobody is playing the balls sit beside the rack)
  let g = null;
  function placeBalls() {
    for (let i = 0; i < 4; i++) {
      let wx, wz;
      if (!g) { [wx, wz] = toW(-1.0, 1.9 + i * 0.5); }
      else { const b = g.balls[i]; if (b.pegged) { [wx, wz] = toW(-1.0 - i * 0.2, 8); } else if (A && g.phase === 'croquet' && !g.moving && i === g.ball && g.croquetFrom >= 0) { const q = R.croquetSetup(g, A.aim); [wx, wz] = toW(q[0], q[1]); } else [wx, wz] = toW(b.x, b.y); }
      _m.makeTranslation(wx, LAWN_Y + R.BALL_R, wz); balls.setMatrixAt(i, _m);
    }
    balls.instanceMatrix.needsUpdate = true;
  }
  placeBalls();

  // ------------------------------------------------------------------ sounds
  const au = game.audio;
  const snd = {
    mallet(v) { if (!au.ctx) return; au.noise(0.09, { gain: 0.35 * v + 0.05, freq: 700, q: 1.2, type: 'lowpass' }); au.tone(150, 0.12, { type: 'sine', gain: 0.25 * v + 0.05 }); },
    clack(v) { if (!au.ctx) return; au.tone(2300, 0.06, { type: 'triangle', gain: 0.35 * v }); au.noise(0.04, { gain: 0.3 * v, freq: 3200, q: 2 }); au.tone(1350, 0.05, { type: 'sine', gain: 0.15 * v }); },
    wire(v) { if (!au.ctx) return; au.tone(1900, 0.45, { type: 'sine', gain: 0.12 * v }); au.tone(2870, 0.35, { type: 'sine', gain: 0.08 * v }); au.tone(4100, 0.2, { type: 'sine', gain: 0.04 * v }); },
    peg(v) { if (!au.ctx) return; au.tone(320, 0.15, { type: 'triangle', gain: 0.3 * v }); au.noise(0.05, { gain: 0.2 * v, freq: 900, q: 2 }); },
    chime() { /* (a hoop run made a two-note chime until 2026-11-23: on a lawn the sound is the ball's, wire() and clack()) */ },
  };

  // ------------------------------------------------------------------ the activity
  let A = null;   // activity state
  const net = game.net;
  let invite = null;   // {from, name, hoops, seed, until}

  function hudCreate() {
    const d = document.createElement('div');
    d.id = 'croquet-hud';
    d.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;font:14px Georgia,serif;color:#fff;z-index:30;text-shadow:0 1px 2px #000';
    d.innerHTML = `<div id="cq-score" style="position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(10,20,12,.72);padding:8px 14px;border-radius:8px;min-width:360px;text-align:center"></div>
      <div id="cq-msg" style="position:absolute;top:120px;left:50%;transform:translateX(-50%);font-size:18px;text-align:center"></div>
      <div id="cq-help" style="position:absolute;right:14px;top:70px;width:340px;background:rgba(10,20,12,.8);padding:10px 12px;border-radius:8px;font-size:12.5px;line-height:1.4">${HELP}</div>
      <div id="cq-menu" style="position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);background:rgba(10,20,12,.88);padding:16px 22px;border-radius:10px;font-size:16px;line-height:1.8;display:none"></div>
      <div id="cq-hint" style="position:absolute;bottom:92px;left:50%;transform:translateX(-50%);font-size:14px;opacity:.9"></div>
      <div style="position:absolute;bottom:60px;left:50%;transform:translateX(-50%);width:300px;height:16px;border:2px solid #fff;border-radius:4px;background:rgba(0,0,0,.4)"><div id="cq-power" style="height:100%;width:0;background:linear-gradient(90deg,#7c3,#fc3,#e33)"></div></div>`;
    document.body.appendChild(d);
    return { root: d, score: d.querySelector('#cq-score'), msg: d.querySelector('#cq-msg'), help: d.querySelector('#cq-help'), menu: d.querySelector('#cq-menu'), hint: d.querySelector('#cq-hint'), power: d.querySelector('#cq-power') };
  }
  const css = (c) => '#' + c.toString(16).padStart(6, '0');
  function hudScore() {
    if (!A || !g) return;
    const rows = g.balls.map((b) => {
      const T = R.nextTarget(g, b), st = b.pegged ? 'pegged out' : !b.inPlay ? 'in hand' : 'next: ' + T.name;
      const mark = g.ball === b.i ? '▶ ' : '';
      return `<span style="display:inline-block;margin:0 8px"><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${css(b.color)};border:1px solid #fff;vertical-align:-1px"></span> ${mark}${b.name}: ${st}</span>`;
    });
    const who = g.winner >= 0 ? (g.winner === A.mySide ? 'You win!' : `${A.oppName} wins`) : g.side === A.mySide ? 'Your turn' : `${A.oppName}'s turn`;
    A.hud.score.innerHTML = `<div style="font-size:16px;margin-bottom:3px"><b>${who}</b> · turn ${g.turnNo} · ${g.N === 6 ? 'short game (6 hoops + peg)' : 'full game (12 hoops + peg)'}</div>${rows[0]}${rows[2]}<br>${rows[1]}${rows[3]}`;
  }
  function message(t, secs = 2.5) { if (!A) return; A.hud.msg.textContent = t || ''; A.msgT = secs; }

  function start(opts = {}) {
    if (A) return;
    const p = game.player;
    A = { mode: 'menu', mySide: 0, oppName: 'the Bursar (AI)', ai: true, aim: 0, power: 0, charging: false, split: 0, baulk: 'A', baulkT: 0.5, camDist: 2.6, overhead: false,
      aiT: 0, msgT: 0, look: p.look, hud: hudCreate(), remote: null, opp: null, pendingState: null, camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), camInit: false };
    // the player holds a mallet
    try { p.setLook({ ...p.look, prop: 'mallet' }); } catch (e) { /* ignore */ }
    game.beginActivity({
      name: 'croquet', pointer: 'locked',
      update: (dt) => update(dt), camera: (dt, cam) => camera(dt, cam), onKey: (k) => onKey(k), onEnd: () => end(),
    });
    if (opts.vs) beginGame(opts);
    else showMenu();
  }
  function nearbyPlayers() {
    const out = [];
    for (const o of net.others.values()) if (o.place === 'world' && Math.hypot(o.x - CF.cx, o.z - CF.cz) < 40) out.push(o);
    return out;
  }
  function showMenu() {
    A.mode = 'menu';
    const others = nearbyPlayers();
    A.menuOthers = others;
    A.hud.menu.style.display = 'block';
    A.hud.menu.innerHTML = `<b>Croquet on the lawn by the Earl Building</b><br><b>1</b> — Short game vs the AI: hoops 1–6 then peg out (default)<br><b>2</b> — Full game vs the AI: 12 hoops then peg out` +
      others.map((o, i) => `<br><b>${i + 3}</b> — Challenge ${escapeHtml(o.name)} (two players, short game)`).join('') + '<br><span style="font-size:13px;opacity:.8">Esc to leave · Win £5 (short) / £12 (full) against the AI</span>';
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function beginGame({ hoops = 6, vs = null, mySide = 0, seed = (Date.now() & 0xffff) }) {
    A.hud.menu.style.display = 'none';
    g = R.createGame({ hoops, seed });
    A.mode = 'play'; A.mySide = mySide; A.ai = !vs; A.remote = vs;
    A.oppName = vs ? vs.name : 'the Bursar (AI)';
    A.prize = vs ? 5 : hoops === 6 ? 5 : 12;
    // an opponent NPC for the AI game
    if (!vs && game.pedestrians && game.pedestrians.spawnAt) {
      try {
        const [ox, oz] = toW(-2.4, 4.5);
        A.opp = game.pedestrians.spawnAt(ox, oz, { ...randomLook(77, { outfit: 'tweed', prop: 'mallet' }), hairStyle: 'grey-wild', glasses: true }, { heading: headingOf(0), static: true, label: 'The Bursar', knockable: false });
      } catch (e) { A.opp = null; }
    }
    message(mySide === g.side ? 'Your turn — choose a ball: 1 = Blue, 2 = Black' : `${A.oppName} to play`, 4);
    hudScore();
    placeBalls();
  }
  function end() {
    if (!A) return;
    if (A.remote && g && g.winner < 0) net.send('croquet', { t: 'quit', to: A.remote.id });
    A.hud.root.remove();
    dots.visible = false;
    try { game.player.setLook(A.look); } catch (e) { /* ignore */ }
    if (A.opp && game.pedestrians) try { game.pedestrians.remove(A.opp); } catch (e) { /* ignore */ }
    const [rx, rz] = toW(-2.6, 2.5); game.player.teleport(rx, rz, headingOf(0));
    game.cameraPitch = 0.28; game.cameraDist = 5.5;
    A = null; g = null; placeBalls();
  }
  function myTurn() { return g && g.winner < 0 && g.side === A.mySide; }

  function doMove(m, local = true) {
    const before = local && A.remote ? R.snapshot(g) : null;
    if (!R.apply(g, m)) return false;
    if (m.type === 'shoot' || m.type === 'croquet') { A.watch = g.ball; A.lastLocalStroke = local; }
    if (local && A.remote) net.send('croquet', { t: 'move', to: A.remote.id, m, s: before });
    if (m.type === 'select') message(`${g.balls[m.ball].name} to play` + (g.phase === 'place' ? ' — place it on A-baulk (A/D to slide, B for B-baulk)' : ''), 3);
    hudScore();
    return true;
  }
  function onKey(k) {
    if (!A) return;
    if (k === 'KeyH') { A.hud.help.style.display = A.hud.help.style.display === 'none' ? 'block' : 'none'; return; }
    if (k === 'KeyV') { A.overhead = !A.overhead; return; }
    if (A.mode === 'menu') {
      if (k === 'Digit1') beginGame({ hoops: 6 });
      else if (k === 'Digit2') beginGame({ hoops: 12 });
      else { const n = +k.replace('Digit', '') - 3, o = A.menuOthers && A.menuOthers[n]; if (o) { const seed = (Date.now() & 0xffff); net.send('croquet', { t: 'invite', to: o.id, hoops: 6, seed }); A.mode = 'waiting'; A.waitFor = o; A.seed = seed; A.hud.menu.innerHTML = `Waiting for ${escapeHtml(o.name)} to accept… (Esc to cancel)`; } }
      return;
    }
    if (A.mode !== 'play' || !myTurn() || g.moving) return;
    if (g.phase === 'select') {
      const own = R.selectable(g);
      if (k === 'Digit1' || k === 'Digit2') { const want = k === 'Digit1' ? (A.mySide ? 1 : 0) : (A.mySide ? 3 : 2); if (own.includes(want)) doMove({ type: 'select', ball: want }); }
      else if ((k === 'Space' || k === 'Enter') && own.length === 1) doMove({ type: 'select', ball: own[0] });
      if (g.phase === 'stroke' || g.phase === 'croquet') aimAtTarget();
    } else if (g.phase === 'place') {
      if (k === 'KeyB') A.baulk = A.baulk === 'A' ? 'B' : 'A';
      if (k === 'Space' || k === 'Enter') { doMove({ type: 'place', baulk: A.baulk, t: A.baulkT }); aimAtTarget(); }
    }
  }
  function aimAtTarget() {
    if (!g || g.ball < 0) return;
    const b = g.balls[g.ball], T = g.phase === 'croquet' ? g.balls[g.croquetFrom] : R.nextTarget(g, b);
    if (g.phase === 'croquet') { const N = R.nextTarget(g, b); A.aim = Math.atan2(N.y - T.y, N.x - T.x); A.split = 0; }
    else A.aim = Math.atan2(T.y - b.y, T.x - b.x);
  }
  function update(dt) {
    if (!A || !(dt > 0)) return;
    if (A.msgT > 0 && (A.msgT -= dt) <= 0) A.hud.msg.textContent = '';
    const inp = game.input;
    if (A.mode !== 'play' || !g) return;
    // events -> sounds/messages
    if (g.events.length) {
      for (const e of g.events) {
        if (e.type === 'strike') snd.mallet(Math.min(1, 0.4 + (A.lastPower || 0.5)));
        else if (e.type === 'hit') snd.clack(Math.min(1, e.speed / 3 + 0.1));
        else if (e.type === 'wire') snd.wire(Math.min(1, e.speed / 2 + 0.15));
        else if (e.type === 'peg') snd.peg(Math.min(1, e.speed / 2 + 0.2));
        else if (e.type === 'hoop') { snd.chime(); message(`${g.balls[e.ball].name} runs hoop ${R.HOOP_NAMES[e.idx]}!`, 2.5); }
        else if (e.type === 'roquet') message(`Roquet! ${g.balls[e.ball].name} hits ${g.balls[e.target].name}`, 2.5);
        else if (e.type === 'pegout') { snd.peg(1); message(`${g.balls[e.ball].name} is pegged out!`, 3); }
      }
      g.events.length = 0;
    }
    if (g.moving) {
      R.step(g, dt);
      if (!g.moving) afterStroke();
    } else if (A.pendingState) { R.restore(g, A.pendingState); A.pendingState = null; hudScore(); }
    else if (g.winner < 0 && myTurn()) humanInput(dt, inp);
    else if (g.winner < 0 && A.ai) {
      if ((A.aiT += dt) > (g.phase === 'select' ? 0.6 : 1.3)) { A.aiT = 0; const m = R.aiMove(g, 0.5); if (m) { if (m.type === 'shoot' || m.type === 'croquet') A.lastPower = m.power; doMove(m, false); } }
      if (g.phase === 'stroke' || g.phase === 'croquet') positionOpp();
    }
    placeBalls();
    updateDots();
    // the player stands behind the striker's ball when it's their go
    if (myTurn() && g.ball >= 0 && !g.moving && (g.phase === 'stroke' || g.phase === 'croquet')) {
      const b = g.balls[g.ball]; const bx = g.phase === 'croquet' ? R.croquetSetup(g, A.aim) : [b.x, b.y];
      const swing = g.phase === 'croquet' ? A.aim + A.split / 2 : A.aim;
      const [wx, wz] = toW(bx[0] - Math.cos(swing) * 0.3 - Math.sin(swing) * 1.0, bx[1] - Math.sin(swing) * 0.3 + Math.cos(swing) * 1.0);
      const p = game.player; p.pos.set(wx, 0, wz); p.heading = headingOf(swing); p.syncMesh();
    }
  }
  function positionOpp() {
    if (!A.opp || g.ball < 0) return;
    const b = g.balls[g.ball], [wx, wz] = toW(b.x - 0.6, b.y - 0.3);
    A.opp.x = wx; A.opp.z = wz; A.opp.heading = headingOf(Math.PI / 4);
  }
  function humanInput(dt, inp) {
    const b = g.balls[g.ball];
    if (g.phase === 'select') { A.hud.hint.textContent = 'Choose a ball: 1 = Blue, 2 = Black'; return; }
    if (g.phase === 'place') {
      A.baulkT = Math.max(0, Math.min(1, A.baulkT + ((inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0)) * dt * 0.35 + inp.mouseDX * 0.0015));
      const [x, y] = R.baulkPoint(g, A.baulk, A.baulkT); b.x = x; b.y = y;
      A.hud.hint.textContent = `Place ${b.name} on ${A.baulk}-baulk: A/D or mouse to slide · B switch baulk · Space to confirm`;
      return;
    }
    A.aim -= inp.mouseDX * 0.0022 + ((inp.down('ArrowRight') ? 1 : 0) - (inp.down('ArrowLeft') ? 1 : 0)) * dt * 0.9;
    if (inp.wheel) A.camDist = Math.max(1.2, Math.min(9, A.camDist * (1 + inp.wheel * 0.12)));
    if (g.phase === 'croquet') A.split = Math.max(-1.45, Math.min(1.45, A.split + ((inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0)) * dt * 0.8));
    const held = inp.mouseDown || inp.down('Space');
    if (held) { A.charging = true; A.power = Math.min(1, A.power + dt / 1.8); }
    else if (A.charging) {
      A.charging = false; const pw = Math.max(0.02, A.power); A.power = 0; A.lastPower = pw;
      if (g.phase === 'croquet') doMove({ type: 'croquet', angle: A.aim, split: A.split, power: pw });
      else doMove({ type: 'shoot', angle: A.aim, power: pw });
    }
    A.hud.power.style.width = (A.power * 100).toFixed(0) + '%';
    A.hud.hint.textContent = g.phase === 'croquet' ? `Croquet stroke from ${g.balls[g.croquetFrom].name}: aim the croqueted ball · A/D split ${(A.split * 57.3).toFixed(0)}° · hold & release to hit` : `${b.name}: aim with the mouse, hold click/Space for power, release to hit (next: ${R.nextTarget(g, b).name})`;
  }
  function afterStroke() {
    const r = g.lastResult;
    if (r && r.msg) message(r.msg, 3);
    if (A.remote && g.side !== A.mySide && r && r.endTurn) { /* turn passed to the other player */ }
    if (A.remote && A.lastLocalStroke) { net.send('croquet', { t: 'state', to: A.remote.id, s: R.snapshot(g) }); }
    if (g.winner >= 0) {
      const won = g.winner === A.mySide;
      message(won ? `You win! +£${A.prize}` : `${A.oppName} wins. Better luck next time.`, 6);
      if (won) { game.pay(A.prize); game.state.flags.croquetWins = (game.state.flags.croquetWins || 0) + 1; game.save(); }
      game.ui.toast(won ? `Croquet: you beat ${A.oppName}! +£${A.prize}` : `Croquet: ${A.oppName} won.`, 5);
    } else if (myTurn() && g.phase === 'select') { message('Your turn — choose a ball: 1 = Blue, 2 = Black', 3); }
    else if (myTurn()) aimAtTarget();
    hudScore();
  }
  // the dotted aim line(s): length = predicted roll at current power (min 1.5 m)
  function updateDots() {
    if (!A || !g || g.moving || !myTurn() || !(g.phase === 'stroke' || g.phase === 'croquet') || g.ball < 0) { dots.visible = false; return; }
    dots.visible = true;
    let n = 0;
    const put = (x0, y0, ang, dist, color) => {
      const k = Math.min(30, Math.max(4, Math.round(dist / 0.25)));
      for (let i = 1; i <= k && n < NDOT; i++) {
        const t = (i / k) * dist, [wx, wz] = toW(x0 + Math.cos(ang) * t, y0 + Math.sin(ang) * t);
        _m.makeTranslation(wx, LAWN_Y + 0.03, wz); dots.setMatrixAt(n, _m); dots.setColorAt(n, cc.set(color)); n++;
      }
    };
    const pw = Math.max(A.power, 0.12) * R.VMAX;
    if (g.phase === 'croquet') {
      const c = g.balls[g.croquetFrom], [fc, fs] = R.splitFactors(A.split), [sx, sy] = R.croquetSetup(g, A.aim);
      put(c.x, c.y, A.aim, Math.max(1.5, R.rollDistance(pw * fc)), 0xffe060);
      put(sx, sy, A.aim + A.split, Math.max(1.5, R.rollDistance(pw * fs)), 0xffffff);
    } else { const b = g.balls[g.ball]; put(b.x, b.y, A.aim, Math.max(1.5, R.rollDistance(pw)), 0xffffff); }
    for (let i = n; i < NDOT; i++) dots.setMatrixAt(i, _hide);
    dots.instanceMatrix.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
  }
  function camera(dt, cam) {
    if (!A) return;
    let px, py, pz, lx, ly, lz;
    const watching = g && g.moving && A.watch >= 0 && !A.overhead;
    if (!g || A.mode !== 'play' || A.overhead || (!myTurn() && !watching) || g.phase === 'select' || g.phase === 'over' || g.ball < 0) {
      // overview from beside the court
      const [cx, cz] = toW(-9, L / 2), [tx, tz] = toW(W / 2, L / 2);
      if (A.overhead) { const [ox, oz] = toW(W / 2, L / 2 - 6); px = ox; py = 30; pz = oz; lx = tx; ly = 0; lz = tz; }
      else { px = cx; py = 9; pz = cz; lx = tx; ly = 0; lz = tz; }
    } else if (watching) {
      const b = g.balls[A.watch], [bx, bz] = toW(b.x, b.y);
      const sp = Math.hypot(b.vx, b.vy), hd = sp > 0.05 ? Math.atan2(b.vx * ex[0] + b.vy * ey[0], b.vx * ex[1] + b.vy * ey[1]) : null;
      lx = bx; ly = 0; lz = bz;
      px = A.camPos.x + (bx - A.camPos.x) * 0; pz = A.camPos.z; py = Math.max(A.camPos.y, 2.5);
      // keep the camera where it was but look at the ball; back off if it gets far
      const d = Math.hypot(bx - A.camPos.x, bz - A.camPos.z);
      if (d > 7) { const k = (d - 7) / d; px = A.camPos.x + (bx - A.camPos.x) * k; pz = A.camPos.z + (bz - A.camPos.z) * k; }
      void hd;
    } else {
      const b = g.balls[g.ball];
      let bx = b.x, by = b.y;
      if (g.phase === 'croquet') { const c = g.balls[g.croquetFrom]; bx = c.x; by = c.y; }
      const [wx, wz] = toW(bx, by), h = headingOf(A.aim);
      px = wx - Math.sin(h) * A.camDist; pz = wz - Math.cos(h) * A.camDist; py = 0.7 + A.camDist * 0.42;
      lx = wx + Math.sin(h) * 2.5; ly = 0.05; lz = wz + Math.cos(h) * 2.5;
    }
    const k = A.camInit ? Math.min(1, dt * 5) : 1; A.camInit = true;
    A.camPos.x += (px - A.camPos.x) * k; A.camPos.y += (py - A.camPos.y) * k; A.camPos.z += (pz - A.camPos.z) * k;
    A.camLook.x += (lx - A.camLook.x) * k; A.camLook.y += (ly - A.camLook.y) * k; A.camLook.z += (lz - A.camLook.z) * k;
    cam.position.copy(A.camPos); cam.lookAt(A.camLook);
  }

  // ------------------------------------------------------------------ multiplayer
  net.on('croquet', (d, other) => {
    if (!d || !other || d.to !== net.id) return;
    if (d.t === 'invite') {
      invite = { from: other.id, name: other.name, hoops: d.hoops || 6, seed: d.seed || 1, until: performance.now() + 60000 };
      game.ui.toast(`${other.name} challenges you to croquet! Go to the croquet lawn by the Earl Building and press E.`, 8);
    } else if (d.t === 'accept' && A && A.mode === 'waiting' && A.waitFor && A.waitFor.id === other.id) {
      beginGame({ hoops: 6, vs: other, mySide: 0, seed: A.seed });
    } else if (d.t === 'decline' && A && A.mode === 'waiting') { A.hud.menu.innerHTML = `${escapeHtml(other.name)} declined.`; }
    else if (!A || !g || !A.remote || A.remote.id !== other.id) return;
    else if (d.t === 'move') {
      if (g.moving) { // finish the current animation instantly
        while (g.moving) R.step(g, 0.25);
      }
      if (d.s) R.restore(g, d.s);
      A.lastLocalStroke = false;
      if (d.m && (d.m.type === 'shoot' || d.m.type === 'croquet')) A.lastPower = d.m.power;
      doMove(d.m, false);
    } else if (d.t === 'state') { if (g.moving) A.pendingState = d.s; else { R.restore(g, d.s); hudScore(); } }
    else if (d.t === 'quit') { game.ui.toast(`${other.name} left the croquet game.`, 4); game.endActivity(); }
  });

  // ------------------------------------------------------------------ interaction point at the rack
  const [ix, iz] = toW(-2.3, 2.5);
  game.interact.add({
    pos: [ix, iz], radius: 3,
    label: () => (invite && performance.now() < invite.until ? `Accept ${invite.name}'s croquet challenge` : 'Play croquet'),
    onUse: () => {
      if (invite && performance.now() < invite.until) {
        const o = net.others.get(invite.from);
        if (o) { net.send('croquet', { t: 'accept', to: o.id }); const inv = invite; invite = null; start({ vs: o, hoops: inv.hoops, mySide: 1, seed: inv.seed }); return; }
        invite = null;
      }
      start();
    },
  });

  return {
    corners, toW, toC, headingOf, court, balls, dots,
    get game() { return g; }, get active() { return !!A; },
    start, end: () => game.endActivity(),
    /** Testing hooks (headless screenshots). */
    test: {
      begin(hoops = 6) { if (!A) start(); if (A.mode === 'menu') beginGame({ hoops }); return R.snapshot(g); },
      move(m) { return doMove(m); },
      ai() { const m = R.aiMove(g); return doMove(m), m; },
      run() { let n = 0; while (g.moving && n++ < 20000) R.step(g, 1 / 60); if (!g.moving) afterStroke(); placeBalls(); return R.snapshot(g); },
      state() { return g && { snap: R.snapshot(g), phase: g.phase, side: g.side, ball: g.ball, res: g.lastResult }; },
      aim(a, split = 0, power = 0.4) { A.aim = a; A.split = split; A.power = power; },
      rules: R,
    },
  };
}
