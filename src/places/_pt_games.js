// Purple Turtle — the player's activities: the dance rhythm minigame (arrows/WASD on the beat of the DJ's track; a good
// streak draws a ring of onlookers and earns 'Legend' in game.state), table football against an NPC (top-down, two rods a
// side), and the bar / jukebox menus. Rules live in _pt_logic.js (DanceGame, foosStep).
import * as Lg from './_pt_logic.js';
import { TRACKS } from './_pt_audio.js';
import { LAY } from './_pt_interior.js';

const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowDown: 'down', KeyS: 'down', ArrowUp: 'up', KeyW: 'up', ArrowRight: 'right', KeyD: 'right' };
const ARROW = { left: '←', down: '↓', up: '↑', right: '→' }, LANE = { left: 0, down: 1, up: 2, right: 3 }, LCOL = ['#ff4fa0', '#4fd0ff', '#7dff6a', '#ffd84a'];
const BOX = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#12081a;border:2px solid #b07ad8;border-radius:8px;padding:16px 20px;color:#f4ecff;font-family:Arial,sans-serif;min-width:340px;max-height:82vh;overflow:auto';
const BTN = 'display:block;width:100%;text-align:left;margin:4px 0;padding:7px 10px;background:#24123a;color:#f4ecff;border:1px solid #5a3a80;border-radius:4px;cursor:pointer;font:inherit';

export function createGames(game, pt) {
  const G = { dance: { active: false, streak: 0, x: 0, z: 0, game: null, last: null, lastT: 0 } };
  const audio = pt.audio;

  // ------------------------------------------------------------------ dance
  G.startDance = (opts = {}) => {
    const p = game.player, D = G.dance;
    const warp = opts.warp || 0;      // test hook: start `warp` seconds into the song with a perfect run so far
    const g = new Lg.DanceGame({ bpm: audio.bpm, start: warp ? audio.clock - warp : audio.nextBar(), seed: Math.floor(Math.random() * 1e6), length: opts.length || 64, drunk: opts.drunk ?? p.drunk ?? 0 });
    if (warp) for (const n of g.notes) if (n.t < audio.clock) g.press(n.dir, n.t);
    audio.hold = true;
    Object.assign(D, { active: true, streak: 0, x: p.pos.x, z: p.pos.z, game: g, last: null, lastT: 0, auto: !!opts.auto, camA: p.heading + Math.PI });
    p.pose = 'dance';
    const o = game.ui.openOverlay({ dim: false }); o.style.pointerEvents = 'none';
    const cv = document.createElement('canvas'); cv.width = 440; cv.height = 330;
    cv.style.cssText = 'position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:440px;height:330px';
    o.appendChild(cv); D.cv = cv;
    game.beginActivity({
      name: 'pt-dance', pointer: 'free', hint: 'Dance! Hit ← ↓ ↑ → (or A S W D) as each arrow reaches the ring',
      onKey: (code) => { const dir = KEYS[code]; if (!dir) return; judge(g.press(dir, audio.clock)); },
      update: (dt) => {
        const t = audio.clock;
        if (D.auto) for (const n of g.notes) if (!n.hit && n.t <= t + 0.02) judge(g.press(n.dir, n.t));
        if (g.update(t)) { D.last = 'miss'; D.lastT = t; }
        D.streak = g.streak;
        draw(g, t);
        if (g.done(t)) finish();
      },
      camera: (dt, cam) => {
        D.camA += dt * 0.25; const pp = game.player.pos;
        cam.position.set(pp.x + Math.sin(D.camA) * 3.0, 1.95, pp.z + Math.cos(D.camA) * 3.0); cam.lookAt(pp.x, 1.2, pp.z);
      },
      onEnd: () => { D.active = false; audio.hold = false; game.player.pose = 'stand'; D.cv = null; },
    });
    return g;
  };
  function judge(q) { if (!q) return; const D = G.dance; D.last = q; D.lastT = audio.clock; audio.hit(q); if (q !== 'miss' && D.game.streak > 0 && D.game.streak % 16 === 0) audio.cheer(); }
  function draw(g, t) {
    const cv = G.dance.cv; if (!cv) return;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, look = 2.0, hitY = H - 52, top = 40;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(16,6,26,0.72)'; c.fillRect(70, 0, 300, H);
    for (let i = 0; i < 4; i++) { const x = 70 + 37 + i * 75; c.strokeStyle = LCOL[i]; c.lineWidth = 3; c.beginPath(); c.arc(x, hitY, 26, 0, 6.283); c.stroke(); c.globalAlpha = 0.5; c.fillStyle = LCOL[i]; c.font = 'bold 24px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ARROW[['left', 'down', 'up', 'right'][i]], x, hitY); c.globalAlpha = 1; }
    g.notes.forEach((n, i) => {
      if (n.hit || n.t < t - 0.25 || n.t > t + look) return;
      const k = (n.t - t) / look, lane = LANE[n.dir], wob = g.wobble(t, i) * 75;
      const x = 70 + 37 + lane * 75 + wob, y = hitY - k * (hitY - top);
      c.fillStyle = LCOL[lane]; c.beginPath(); c.arc(x, y, 22, 0, 6.283); c.fill();
      c.fillStyle = '#12081a'; c.font = 'bold 26px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ARROW[n.dir], x, y + 1);
    });
    c.fillStyle = '#fff'; c.font = 'bold 18px Arial'; c.textAlign = 'left'; c.fillText(`Score ${g.score}`, 78, 18);
    c.textAlign = 'right'; c.fillStyle = g.streak >= 8 ? '#ffd84a' : '#fff'; c.fillText(`Streak ${g.streak}  x${g.mult}`, 362, 18);
    const D = G.dance;
    if (D.last && t - D.lastT < 0.6) { c.globalAlpha = 1 - (t - D.lastT) / 0.6; c.textAlign = 'center'; c.font = 'bold 30px Impact, Arial'; c.fillStyle = D.last === 'perfect' ? '#7dff6a' : D.last === 'good' ? '#4fd0ff' : '#ff4f6a'; c.fillText(D.last.toUpperCase() + '!', W / 2, hitY - 120); c.globalAlpha = 1; }
    if (g.streak >= 8) { c.textAlign = 'center'; c.font = 'bold 16px Arial'; c.fillStyle = '#ffd84a'; c.fillText('A crowd is gathering…', W / 2, H - 12); }
    if (t < g.notes[0].t - 0.2) { c.textAlign = 'center'; c.font = 'bold 22px Arial'; c.fillStyle = '#fff'; c.fillText(`Get ready… "${audio.T.name}"`, W / 2, H / 2 - 30); }
  }
  function finish() {
    const g = G.dance.game, gain = Lg.legendGain(g);
    game.state.legend = (game.state.legend || 0) + gain;
    if (game.save) game.save();
    game.endActivity();
    game.ui.toast(`Score ${g.score} · best streak ${g.best}` + (gain ? ` · Legend +${gain} (now ${game.state.legend})` : ' · keep practising!'), 5);
    G.lastDance = { score: g.score, best: g.best, perfect: g.perfect, good: g.good, miss: g.miss, legend: gain };
  }

  // ------------------------------------------------------------------ table football
  G.startFoos = (opts = {}) => {
    const s = Lg.foosNew(Math.floor(Math.random() * 1e6)); G.foos = s; let aimKey = 0, aim = 0, kick = false;
    const o = game.ui.openOverlay({ dim: true });
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 420; cv.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:640px;height:420px;cursor:none';
    o.appendChild(cv);
    cv.addEventListener('mousemove', (e) => { const r = cv.getBoundingClientRect(); aim = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2.4)); });
    cv.addEventListener('mousedown', () => { kick = true; });
    const opp = pt.crowd && pt.crowd.foosOpponent();
    const oppName = opp ? 'them' : 'the regular';
    game.beginActivity({
      name: 'pt-foos', pointer: 'free', hint: 'Table football: mouse up/down (or W/S) moves your rods, click or Space to kick. First to 5.',
      onKey: (code) => { if (code === 'Space') kick = true; },
      update: (dt) => {
        if (game.input.down('KeyW') || game.input.down('ArrowUp')) aimKey = Math.max(-1, aimKey - dt * 2.5), aim = aimKey;
        if (game.input.down('KeyS') || game.input.down('ArrowDown')) aimKey = Math.min(1, aimKey + dt * 2.5), aim = aimKey;
        if (opts.auto) { aim = Math.max(-1, Math.min(1, s.by / Lg.FOOS.travel[0])); kick = Math.abs(s.bx - Lg.FOOS.rods.you[1]) < 0.1 || Math.abs(s.bx - Lg.FOOS.rods.you[0]) < 0.08; }
        const st = Math.min(dt, 0.05), vx = s.vx;
        const goal = Lg.foosStep(s, st, { aim, kick }); kick = false;
        if (Math.sign(vx) !== Math.sign(s.vx)) audio.foosHit(Math.min(1, Math.abs(s.vx) / 2));
        if (goal) { audio.foosGoal(); game.ui.toast(goal === 'you' ? 'GOAL!' : `Goal to ${oppName}.`, 1.5); if (opp) opp.ch.say(goal === 'you' ? 'No spinning!' : 'Get in!', 2); }
        drawFoos(cv, s);
        if (s.over) {
          const won = s.score[0] > s.score[1];
          game.endActivity(); game.ui.toast(won ? `You win ${s.score[0]}–${s.score[1]}!` : `Lost ${s.score[0]}–${s.score[1]}. Rematch?`, 4);
          if (won) { game.state.foosWins = (game.state.foosWins || 0) + 1; if (game.save) game.save(); }
        }
      },
      camera: (dt, cam) => { cam.position.set(LAY.foos.x - 1.7, 1.95, LAY.foos.z + 0.2); cam.lookAt(LAY.foos.x, 0.75, LAY.foos.z); },
    });
    return s;
  };
  function drawFoos(cv, s) {
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, F = Lg.FOOS, mx = 40, my = 50;
    const X = (x) => mx + ((x + F.W) / (2 * F.W)) * (W - 2 * mx), Y = (y) => my + ((y + F.H) / (2 * F.H)) * (H - 2 * my), sx = (W - 2 * mx) / (2 * F.W);
    c.fillStyle = '#3a2412'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2a8a3a'; c.fillRect(mx, my, W - 2 * mx, H - 2 * my);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.strokeRect(mx, my, W - 2 * mx, H - 2 * my); c.beginPath(); c.moveTo(W / 2, my); c.lineTo(W / 2, H - my); c.stroke(); c.beginPath(); c.arc(W / 2, H / 2, 40, 0, 6.283); c.stroke();
    c.fillStyle = '#111'; c.fillRect(mx - 12, Y(-F.goal), 12, Y(F.goal) - Y(-F.goal)); c.fillRect(W - mx, Y(-F.goal), 12, Y(F.goal) - Y(-F.goal));
    for (const side of ['you', 'them']) {
      const off = side === 'you' ? s.yRod : s.tRod, kick = side === 'you' ? s.yKick : s.tKick;
      F.rods[side].forEach((rx, ri) => {
        c.strokeStyle = '#c8c8c8'; c.lineWidth = 4; c.beginPath(); c.moveTo(X(rx), 8); c.lineTo(X(rx), H - 8); c.stroke();
        for (const m of F.men[ri]) { const y = m + off * F.travel[ri]; c.fillStyle = side === 'you' ? '#d02828' : '#2850d0'; const k = kick > 0 ? (side === 'you' ? 8 : -8) : 0;
          c.fillRect(X(rx) - 9 + k, Y(y) - 12, 18, 24); c.fillStyle = '#f0d0b0'; c.beginPath(); c.arc(X(rx) + k, Y(y), 6, 0, 6.283); c.fill(); }
      });
    }
    if (s.serve <= 0 || Math.floor(s.serve * 6) % 2) { c.fillStyle = '#f8f8f0'; c.beginPath(); c.arc(X(s.bx), Y(s.by), F.ball * sx, 0, 6.283); c.fill(); }
    c.fillStyle = '#fff'; c.font = 'bold 22px Arial'; c.textAlign = 'center'; c.fillText(`YOU ${s.score[0]}  —  ${s.score[1]} THEM`, W / 2, 30);
  }

  // ------------------------------------------------------------------ menus
  function menu(title, sub, build) {
    game.beginActivity({ name: 'pt-menu', pointer: 'free' });
    const o = game.ui.openOverlay(), box = document.createElement('div'); box.style.cssText = BOX;
    box.innerHTML = `<div style="font-size:22px;color:#d8a8ff;font-weight:bold;font-family:Georgia,serif">${title}</div><div style="opacity:.75;margin:2px 0 8px">${sub}</div>`;
    const btn = (label, fn, extra = '') => { const b = document.createElement('button'); b.style.cssText = BTN + extra; b.innerHTML = label; b.onclick = fn; box.appendChild(b); return b; };
    const head = (t) => { const d = document.createElement('div'); d.style.cssText = 'margin:10px 0 2px;color:#ffd84a;font-weight:bold'; d.textContent = t; box.appendChild(d); };
    build(btn, head); o.appendChild(box);
  }
  G.barMenu = () => {
    const mine = Lg.shotFor(pt.college()) || Lg.shotFor('Worcester');
    menu('The Purple Turtle bar', `You have £${game.state.money.toFixed(2)} · college shots £1.50`, (btn, head) => {
      const d = (k) => Lg.DRINKS[k], go = (k, o) => { game.endActivity(); pt.drink(k, o); };
      btn(`<b>${mine.college}: ${mine.name}</b> — your college's shot — <i>${mine.recipe}</i> — <b>£1.50</b>`, () => go('shot', { shot: mine }), 'border-color:#ffd84a');
      btn(`Pint — <b>£${d('pint').price.toFixed(2)}</b>`, () => go('pint'));
      btn(`Vodka-mixer — <b>£${d('vodka').price.toFixed(2)}</b>`, () => go('vodka'));
      btn(`Jägerbomb — <b>£${d('jager').price.toFixed(2)}</b>`, () => go('jager'));
      btn(`Pint of cocktail — <b>£${d('cocktail').price.toFixed(2)}</b>`, () => go('cocktail'));
      btn('The Sorting Hat (lucky-dip college shot) — <b>£1.50</b>', () => go('shot', { shot: Lg.sortingHat(Math.floor(Math.random() * 1e6)), hat: true }));
      btn('Tap water — <b>free</b>', () => go('water'));
      head('College shots — one per college, £1.50');
      for (const s of Lg.SHOTS) btn(`<span style="display:inline-block;width:10px;height:10px;background:#${s.color.toString(16).padStart(6, '0')};margin-right:6px"></span><b>${s.college}</b>: ${s.name} <span style="opacity:.6">— ${s.recipe}</span>`, () => go('shot', { shot: s }), 'font-size:13px;padding:4px 8px');
      btn('Nothing, thanks', () => game.endActivity());
    });
  };
  G.jukebox = () => {
    menu('Jukebox', `£1 a song — it plays next through all the rooms. Now: "${audio.T.name}"`, (btn) => {
      TRACKS.forEach((t, i) => btn(`"${t.name}" <span style="opacity:.6">(${t.style}, ${t.bpm} bpm)</span>`, () => {
        game.endActivity(); if (!game.pay(-1)) { game.ui.toast('You need £1 for the jukebox.', 3); return; }
        audio.coin(); game.ui.toast(`Jukebox: "${audio.request(i)}" is up next.`, 3);
      }));
      btn('Never mind', () => game.endActivity());
    });
  };
  return G;
}
