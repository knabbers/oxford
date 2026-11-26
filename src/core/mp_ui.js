// Multiplayer mode selection and room UI (start-screen buttons, HUD room badge, Tab player list).
// Mode: peer-to-peer rooms when the URL has ?p2p or ?room=CODE, or when the page is served as static files (no /api/time);
// otherwise the Node server's WebSocket relay. ?ws forces server mode. See docs/HOSTING.md.
// Test hooks: game.mp.host(), game.mp.join(code), game.mp.info().
import { P2PTransport } from './net_p2p.js';
import { makeRoomCode, normaliseRoomCode, validRoomCode } from './_p2p_relay.js';

const pretty = (c) => (c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c);

export function setupMultiplayer(game, { serverMode, go }) {
  const q = new URLSearchParams(location.search);
  const p2p = !q.has('ws') && (q.has('p2p') || q.has('room') || !serverMode);
  const mp = (game.mp = { mode: p2p ? 'p2p' : 'ws', room: null });
  const started = () => { const st = document.getElementById('start'); return !!st && st.style.display === 'none'; };
  const start = (fn) => { if (started()) return false; fn(); go(); return true; };

  mp.inviteLink = (code = mp.room) => {
    const u = new URL(location.href);
    for (const k of [...u.searchParams.keys()]) if (k !== 'broker') u.searchParams.delete(k);   // keep the debug broker
    u.searchParams.set('room', code); u.hash = '';
    return u.href;
  };
  mp.info = () => {
    const t = game.net.transport;
    return { mode: mp.mode, room: mp.room, connected: game.net.connected, isHost: game.net.isHost, id: game.net.id,
      players: game.net.connected ? game.net.others.size + 1 : 1, state: t && t.state, migrations: t ? t.migrations || 0 : 0 };
  };
  mp.host = () => start(() => {
    mp.room = makeRoomCode();
    game.net.transport = new P2PTransport({ code: mp.room, host: true });
    const link = mp.inviteLink();
    copy(link).then((ok) => game.ui.toast(ok ? 'Room open: invite link copied to the clipboard' : 'Room open: ' + link, 8));
    console.info('[gto] hosting room', mp.room, link);
  });
  mp.join = (raw) => {
    const code = normaliseRoomCode(raw);
    if (!validRoomCode(code)) { setErr('That doesn\'t look like a room code'); return false; }
    return start(() => { mp.room = code; game.net.transport = new P2PTransport({ code }); });
  };
  mp.solo = () => start(() => { game.net.transport = null; });
  function setErr(t) { const e = document.getElementById('mp-err'); if (e) e.textContent = t || ''; else game.ui.toast(t); }

  installPlayerList(game);
  if (!p2p) return mp;

  injectStyle();
  const card = document.querySelector('#start .card'), play = document.getElementById('play');
  const box = document.createElement('div');
  box.id = 'mp';
  box.innerHTML = `<div class="mp-row"><button type="button" id="mp-host">Host a room</button><span class="mp-or">or</span>`
    + `<input id="mp-code" maxlength="20" placeholder="room code" autocomplete="off" spellcheck="false"><button type="button" id="mp-join">Join</button></div>`
    + `<div class="mp-hint">Rooms are peer-to-peer: whoever hosts must stay in the game. Matriculate on its own plays solo.</div><div id="mp-err"></div>`;
  if (card && play) card.insertBefore(box, play.nextSibling); else return mp;
  const codeIn = box.querySelector('#mp-code');
  box.querySelector('#mp-host').onclick = () => mp.host();
  box.querySelector('#mp-join').onclick = () => mp.join(codeIn.value);
  codeIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') mp.join(codeIn.value); });
  let pre = normaliseRoomCode(q.get('room'));
  if (!validRoomCode(pre)) pre = '';
  // default choice (the main button, the name field's Enter, ?autostart): join the linked room if any, otherwise solo
  if (pre) {
    mp.room = pre; game.net.transport = new P2PTransport({ code: pre }); codeIn.value = pretty(pre); play.textContent = 'Join room ' + pretty(pre);
    const hint = box.querySelector('.mp-hint');
    hint.innerHTML = 'You were invited to a room. <a href="#" id="mp-solo">Play solo instead</a>';
    hint.querySelector('#mp-solo').onclick = (e) => { e.preventDefault(); mp.solo(); };
  }
  else { game.net.transport = null; play.textContent = 'Matriculate (solo)'; }

  // HUD badge: room code + player count, click copies the invite link
  const hud = document.getElementById('hud');
  const badge = document.createElement('div');
  badge.id = 'mp-badge'; badge.title = 'Copy the invite link';
  hud && hud.appendChild(badge);
  badge.onclick = () => { if (mp.room) copy(mp.inviteLink()).then((ok) => game.ui.toast(ok ? 'Invite link copied' : mp.inviteLink(), 6)); };
  setInterval(() => {
    if (!mp.room) { badge.style.display = 'none'; return; }
    const i = mp.info();
    badge.style.display = 'block';
    badge.textContent = `Room ${pretty(mp.room)} · ${i.connected ? `${i.players} player${i.players === 1 ? '' : 's'}${i.isHost ? ' · host' : ''}` : i.state === 'closed' ? 'closed' : 'connecting…'} · copy link`;
  }, 500);
  return mp;
}

// Tab: who's here (and, for a P2P room host, a × to kick). Works in both modes.
function installPlayerList(game) {
  const el = document.createElement('div');
  el.id = 'mp-list';
  document.body.appendChild(el);
  const css = document.createElement('style');
  css.textContent = LIST_CSS; document.head.appendChild(css);
  let open = false, timer = 0;
  const render = () => {
    const n = game.net, vc = game.voicechat, rows = [`<div class="mp-h">${n.connected ? (n.others.size + 1) + ' in Oxford' : 'Playing solo'}</div>`,
      `<div>${esc(game.player.name || 'You')} <i>(you${n.isHost ? ', host' : ''})</i>${vc && vc.on ? ` <button type="button" class="mp-v" data-vself="1">${vc.micMuted || vc.micState !== 'live' ? 'mic off' : 'mic live'}</button>` : ''}</div>`];
    for (const o of n.others.values()) rows.push(`<div>${esc(o.name)}${o.stars ? ' <span style="color:#ffd23a">' + '★'.repeat(o.stars) + '</span>' : ''}${vc && vc.on && vc.has(o.id) ? ` <button type="button" class="mp-v" data-vmute="${o.id}" title="Their voice, for you only">${vc.isMuted(o.id) ? 'muted' : 'voice'}</button>` : ''}${n.isHost ? ` <button type="button" data-kick="${o.id}" title="Remove from the room">×</button>` : ''}</div>`);
    rows.push('<div class="mp-foot">Tab to close</div>');
    el.innerHTML = rows.join('');
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-kick]');
    if (b && game.net.kick(+b.dataset.kick)) { game.ui.toast('Removed from the room'); render(); }
    // voice chat (core/voicechat.js): mute one player for yourself / your own microphone off and on
    const v = e.target.closest && e.target.closest('[data-vmute], [data-vself]'), vc = game.voicechat;
    if (v && vc) { if (v.dataset.vself) Promise.resolve(vc.muteSelf()).then(render); else { vc.mutePlayer(+v.dataset.vmute); render(); } }
  });
  const toggle = (on) => {
    open = on; el.style.display = on ? 'block' : 'none';
    clearInterval(timer);
    if (on) { render(); timer = setInterval(render, 1000); if (game.net.isHost || (game.voicechat && game.voicechat.on)) game.input.unlock(); }
  };
  game.input.onKey((code) => {
    const st = document.getElementById('start');
    if (st && st.style.display !== 'none') return;
    if (code === 'Tab' && !game.activity && !game.ui.inDialog) toggle(!open);
    else if (code === 'Escape' && open) toggle(false);
  });
  game.mpList = { toggle, render };
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function injectStyle() {
  const s = document.createElement('style');
  s.textContent = `
#mp { margin: 14px 0 0; }
#mp .mp-row { display: flex; gap: 8px; align-items: center; justify-content: center; flex-wrap: wrap; }
#start #mp button { padding: 8px 16px; font: 700 15px Georgia, serif; }
#start #mp input { margin: 0; width: 9.5em; text-transform: lowercase; }
#mp .mp-or { opacity: .6; font-style: italic; }
#mp .mp-hint { font-size: 12px; opacity: .6; margin-top: 8px; }
#mp .mp-hint a { color: #f3e7b3; }
#mp-err { color: #ff9b8a; font-size: 14px; min-height: 1.2em; margin-top: 4px; }
#mp-badge { position: absolute; right: 24px; top: 118px; font: 600 13px "Helvetica Neue", Arial, sans-serif; display: none;
  background: rgba(0,0,0,.45); padding: 4px 10px; border-radius: 4px; pointer-events: auto; cursor: pointer; text-shadow: none; }
#mp-badge:hover { background: rgba(0,0,0,.7); }
`;
  document.head.appendChild(s);
}
const LIST_CSS = `
#mp-list { position: fixed; right: 24px; top: 150px; min-width: 200px; max-height: 60vh; overflow: auto; display: none; z-index: 5;
  background: rgba(8,10,16,.85); border: 1px solid rgba(243,231,179,.5); border-radius: 6px; padding: 10px 14px; font-size: 15px; line-height: 1.7; }
#mp-list .mp-h { color: #f3e7b3; font-weight: 700; }
#mp-list i { opacity: .6; }
#mp-list button { margin-left: 8px; background: #5a2020; color: #fff; border: 0; border-radius: 3px; cursor: pointer; padding: 0 7px; }
#mp-list button.mp-v { background: #2a3140; font-size: 12px; }
#mp-list .mp-foot { font-size: 11px; opacity: .5; }
`;
