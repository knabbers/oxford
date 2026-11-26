// The key list. It is not on the opening screen: it comes up when Esc is pressed while playing (Esc frees the mouse, so
// the panel appears as the pointer lock goes) and goes away on Esc again or a click back into the game. Not shown while
// a minigame, a dialogue, the chat box or the big map has the keyboard. Local to each player; no network use.
const ROWS = [
  ['WASD', 'move'], ['Shift', 'run'], ['Space', 'jump (bell on a bike, handbrake in a car)'], ['Mouse', 'look'],
  ['E', 'interact / enter door · on a bus: sit down in the seat beside you, stand up, ring the bell at a bell push (walk on and off a bus at a stop through its open door: £2)'],
  ['G', 'first-person view on / off (in a bus seat, or in a friend\'s car: from your seat / from outside)'],
  ['F', 'get on/off bike, car, punt, or take one from its driver (mash F to hold on if they want it back)'],
  ['F', 'beside a friend\'s car, cab, van, bus or punt: get in as a passenger · F again when it has stopped: get out · if the driver gets out: F slide across and drive'],
  ['Space', 'in a bus seat: ring the bell for the next stop'],
  ['Space', 'in the air at a ledge your hands can reach: you catch it and hang · Space again: pull yourself up · A D: shuffle along it · S: let go'],
  ['X', 'standing at an edge and looking out over it: turn and let yourself down to hang from it'],
  ['Click · C', 'on foot: punch (left and right in turn; at a run it puts them down)'],
  ['H', 'horn'], ['R', 'in a bus at a stop: start / abandon a bus route · in a taxi: on / off duty'],
  ['W · S', 'at the pool table: eye up for a broader view of the table / down to sight along the cue (the mouse wheel does the same) · mouse: turn the cue · hold, draw back, let go: strike'],
  ['↑ ↓ · A D', 'at the pool table: top and back spin · side spin (X: centre ball) · ← →: turn the cue a touch · G: contact ring on / off'],
  ['P', 'sightseeing passport'], ['I', 'inventory'], ['T', 'chat'],
  ['Tab', 'the players in the room (click there to mute one player\u2019s voice for yourself, or your own microphone)'],
  ['Esc', 'stop what you are doing / free mouse / this list'],
];

// The rows of the sound panel: [level name in core/audio.js, label]
export const SOUND_ROWS = [
  ['master', 'Everything'], ['voice', 'Characters\u2019 voices'], ['chat', 'Friends\u2019 microphones'], ['music', 'Background music'],
  ['ambience', 'Ambient sound (birds, wind, water, people, town)'], ['bells', 'Bells and clocks'], ['fx', 'Vehicles and effects'], ['venue', 'Club and venue music'],
];
/**
 * What the panel reads and writes, kept apart from the page so that it can be tested without one. get(name) -> 0..2;
 * set(name, v) -> the value kept. Two rows belong to other owners: 'voice' is 0 while the voices are off (setting it to
 * 0 turns them off: speech then shows in bubbles; saved in 'gto.friendVoices'), 'music' is the soundtrack's own volume
 * ('gto.soundtrack'). output() / setOutput('hp' | 'sp'): headphones (3D) or speakers. There are no keys for sound.
 */
export function soundModel(game) {
  const A = () => game.audio, clamp = (v) => Math.max(0, Math.min(2, Math.round((+v || 0) * 20) / 20));
  return {
    get(name) {
      const a = A(); if (!a || !a.levels) return 1;
      if (name === 'voice' && game.voice && game.voice.enabled === false) return 0;
      if (name === 'music' && game.soundtrack && typeof game.soundtrack.volume === 'number') return Math.min(2, game.soundtrack.volume);
      return a.levels[name] ?? 1;
    },
    set(name, v) {
      const a = A(); if (!a || !a.setLevel) return 1; v = clamp(v);
      if (name === 'voice') { const V = game.voice; if (V && V.setEnabled) V.setEnabled(v > 0); if (v > 0) a.setLevel('voice', v); return v; }      // (0: off, as V does — the level it had is kept for when they come back)
      if (name === 'music') { a.setLevel('music', v); if (game.soundtrack && game.soundtrack.set) game.soundtrack.set(v); return v; }
      return a.setLevel(name, v);
    },
    /** voice chat between players (core/voicechat.js): { can, why, on, phone, mic } — switched here only, never by a key */
    chat() { const v = game.voicechat; return v && v.status ? v.status() : { can: false, why: 'for a room with other players in it', on: false, phone: false, mic: 'off' }; },
    setChat(on) { const v = game.voicechat; return v && v.status && v.status().can ? Promise.resolve(v.toggle(!!on)) : Promise.resolve(false); },
    setPhone(on) { const v = game.voicechat; return v && v.status && v.status().can ? Promise.resolve(v.togglePhone(!!on)) : Promise.resolve(false); },
    output() { const a = A(); return a && a.output === 'sp' ? 'sp' : 'hp'; },
    setOutput(o) { const a = A(); return a && a.setOutput ? a.setOutput(o) : 'hp'; },
    reset() { const a = A(); if (!a || !a.resetLevels) return; a.resetLevels(); if (a.setBedLevel && a.bedLevel !== 1) a.setBedLevel(1); if (game.voice && game.voice.setEnabled) game.voice.setEnabled(true); if (game.soundtrack && game.soundtrack.set) game.soundtrack.set(1); },
  };
}
function buildSound(game, card) {
  const M = soundModel(game), rows = []; let sel = 0;
  const box = document.createElement('div'); box.style.cssText = 'margin:0 0 4px';
  const h = document.createElement('div'); h.textContent = 'Sound'; h.style.cssText = 'font:italic 700 24px Georgia,serif;color:#f3e7b3;margin-bottom:10px'; box.appendChild(h);
  let outBtns = [], chatRows = [];
  const paintChat = () => { const C = M.chat(); for (const r of chatRows) { const on = r.which === 'chat' ? C.on : C.phone; r.btn.disabled = !C.can; r.btn.textContent = on ? 'On' : 'Off'; r.btn.setAttribute('aria-pressed', on ? 'true' : 'false'); r.btn.style.background = on ? '#f3e7b3' : '#2a3140'; r.btn.style.color = on ? '#141922' : '#e8e6df'; r.btn.style.opacity = C.can ? '1' : '.45'; r.btn.style.cursor = C.can ? 'pointer' : 'default';
    r.note.textContent = !C.can ? C.why : r.which === 'chat' ? (!C.on ? 'off: nobody hears you' : C.mic === 'live' ? 'your microphone is live: players near you hear you' : C.mic === 'asking' ? 'waiting for the browser\u2019s microphone permission' : C.mic === 'muted' ? 'on, your microphone muted: you hear the others' : 'on, no microphone: you hear the others') : (C.phone ? 'on: any distance' : 'off: voices carry about 45 m'); } };
  const paint = () => { paintChat(); const o = M.output(); outBtns.forEach((b) => { const on = b.dataset.out === o; b.style.background = on ? '#f3e7b3' : '#2a3140'; b.style.color = on ? '#141922' : '#e8e6df'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); paintRows(); };
  const paintRows = () => rows.forEach((r, i) => { const v = M.get(r.name); r.input.value = String(Math.round(v * 100)); r.pct.textContent = Math.round(v * 100) + '%'; r.row.style.background = i === sel ? '#222a38' : 'transparent'; });
  SOUND_ROWS.forEach(([name, label], i) => {
    const row = document.createElement('div'), l = document.createElement('span'), input = document.createElement('input'), pct = document.createElement('span');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:3px 6px;border-radius:3px';
    l.textContent = label; l.style.cssText = 'flex:1 1 auto;min-width:0';
    input.type = 'range'; input.min = '0'; input.max = '200'; input.step = '5'; input.style.cssText = 'flex:0 0 150px;width:150px'; input.setAttribute('aria-label', label);
    pct.style.cssText = 'flex:0 0 44px;text-align:right;font-variant-numeric:tabular-nums';
    input.addEventListener('input', () => { sel = i; M.set(name, +input.value / 100); paint(); });
    row.addEventListener('mousedown', () => { sel = i; paint(); });
    row.appendChild(l); row.appendChild(input); row.appendChild(pct); box.appendChild(row); rows.push({ name, row, input, pct });
  });
  // headphones (3D: you hear where things are) or speakers — what the K key used to switch
  { const row = document.createElement('div'), l = document.createElement('span'); row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 6px 2px';
    l.textContent = 'Listening on'; l.style.cssText = 'flex:1 1 auto;min-width:0'; row.appendChild(l);
    for (const [o, label] of [['hp', 'Headphones (3D)'], ['sp', 'Speakers']]) { const b = document.createElement('button'); b.textContent = label; b.dataset.out = o; b.style.cssText = 'padding:2px 10px;border:1px solid #55607a;border-radius:3px;font:inherit;cursor:pointer'; b.addEventListener('click', () => { M.setOutput(o); paint(); }); row.appendChild(b); outBtns.push(b); }
    box.appendChild(row); }
  // voice chat between players and the phone: switches here (they were the Y and . keys), disabled with the reason when there is no room
  { const hd = document.createElement('div'); hd.textContent = 'Talking to other players'; hd.style.cssText = 'margin:8px 6px 0;color:#f3e7b3;font-weight:700'; box.appendChild(hd);
    for (const [which, label] of [['chat', 'Voice chat (my microphone)'], ['phone', 'Hear friends from anywhere (phone)']]) {
      const row = document.createElement('div'), l = document.createElement('span'), t = document.createElement('span'), note = document.createElement('span'), b = document.createElement('button');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:2px 6px'; l.style.cssText = 'flex:1 1 auto;min-width:0;line-height:1.3'; t.textContent = label; note.style.cssText = 'display:block;font-size:11px;opacity:.65';
      l.appendChild(t); l.appendChild(note); b.dataset.chat = which; b.style.cssText = 'flex:0 0 54px;padding:2px 0;border:1px solid #55607a;border-radius:3px;font:inherit';
      b.addEventListener('click', () => { const C = M.chat(); if (!C.can) return; const p = which === 'chat' ? M.setChat(!C.on) : M.setPhone(!C.phone); paint(); p.then(paint, paint); });      // (the microphone permission is asked from this click)
      row.appendChild(l); row.appendChild(b); box.appendChild(row); chatRows.push({ which, btn: b, note }); }
    setInterval(() => { if (box.offsetParent) paintChat(); }, 500); }      // (the state can change behind the screen: the permission answered, the room left)
  const reset = document.createElement('button'); reset.textContent = 'Reset all to 100%'; reset.style.cssText = 'margin-top:8px;padding:3px 10px;background:#2a3140;color:#e8e6df;border:1px solid #55607a;border-radius:3px;font:inherit;cursor:pointer';
  reset.addEventListener('click', () => { M.reset(); paint(); }); box.appendChild(reset);
  const tip = document.createElement('div'); tip.textContent = 'Up / down: pick a row · left / right: 5% · saved in this browser'; tip.style.cssText = 'margin-top:6px;opacity:.65;font-size:12px'; box.appendChild(tip);
  box.addEventListener('click', (e) => e.stopPropagation());      // (a click here is not "back to the game")
  card.appendChild(box); paint();
  return {
    model: M, refresh: paint,
    /** arrow keys while the screen is open -> true when the key was used */
    key(e) {
      if (e.code === 'PageDown' || e.code === 'PageUp') { const c = box.closest ? box.closest('#keyhelp > div') : null; if (c) c.scrollTop += (e.code === 'PageDown' ? 1 : -1) * c.clientHeight * 0.8; return true; }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { sel = (sel + (e.code === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length; paint(); return true; }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { const r = rows[sel]; M.set(r.name, M.get(r.name) + (e.code === 'ArrowRight' ? 0.05 : -0.05)); paint(); return true; }
      return false;
    },
  };
}

export default {
  id: 'keyhelp',
  install(game) {
    if (typeof document === 'undefined' || !document.body || !document.addEventListener) return;
    const el = document.createElement('div');
    el.id = 'keyhelp';
    el.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(5,7,10,.72);z-index:40;color:#e8e6df;font:14px/1.7 system-ui,sans-serif';
    const card = document.createElement('div');
    card.style.cssText = 'width:min(1120px,94vw);max-height:92vh;overflow:auto;padding:16px 22px;background:#141922;border:1px solid #f3e7b3;border-radius:6px;box-sizing:border-box';
    // two columns: the sound sliders (what the player opens this screen for) and the keys; in a narrow window the
    // sliders come first and the whole card scrolls (wheel, or Page Up / Page Down)
    const cols = document.createElement('div'); cols.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px 30px;align-items:flex-start';
    const left = document.createElement('div'); left.style.cssText = 'flex:1 1 400px;min-width:300px;max-width:520px';
    const right = document.createElement('div'); right.style.cssText = 'flex:1.35 1 460px;min-width:300px;font-size:13px;line-height:1.55';
    const h = document.createElement('div'); h.textContent = 'Keys'; h.style.cssText = 'font:italic 700 24px Georgia,serif;color:#f3e7b3;margin-bottom:10px';
    right.appendChild(h);
    for (const [k, what] of ROWS) {
      const row = document.createElement('div'), b = document.createElement('b'), s = document.createElement('span');
      b.textContent = k; b.style.cssText = 'display:inline-block;min-width:58px;margin-right:10px;padding:0 6px;background:#2a3140;border-radius:3px;text-align:center';
      s.textContent = what; row.appendChild(b); row.appendChild(s); right.appendChild(row);
    }
    cols.appendChild(left); cols.appendChild(right); card.appendChild(cols);
    // ---- the sound panel: one volume for each kind of sound (core/audio.js levels), 0-200%, saved in this browser.
    // Mouse: drag a slider. Keyboard: up / down pick a row, left / right change it by 5%. The game goes on sounding
    // behind this screen, so a volume can be set by ear.
    const sound = buildSound(game, left);
    const foot = document.createElement('div'); foot.textContent = 'Esc or click to go back to the game'; foot.style.cssText = 'margin-top:12px;opacity:.65;font-size:12px';
    card.appendChild(foot);
    // where the map and the buildings' facts come from (the licences ask for these lines: docs/BUILDING_FACTS.md)
    const data = document.createElement('div'); data.id = 'keyhelp-data'; data.style.cssText = 'margin-top:6px;opacity:.5;font-size:11px;line-height:1.4';
    data.textContent = 'Data: map \u00a9 OpenStreetMap contributors, Open Database Licence (ODbL). Contains Historic England data \u00a9 Historic England 2026 and Ordnance Survey data \u00a9 Crown copyright and database right 2026 (National Heritage List for England). Contains public sector information licensed under the Open Government Licence v3.0 (Environment Agency LIDAR Composite 2022).';
    card.appendChild(data); el.appendChild(card); document.body.appendChild(el);

    let open = false;
    const started = () => { const st = document.getElementById('start'); return !!st && st.style.display === 'none'; };
    const busy = () => !!game.activity || !!(game.ui && game.ui.inDialog) || !!(game.input && game.input.typing) || !!document.querySelector('#bigmap.open, #overlay.open') || ((m) => !!m && m.style.display === 'block')(document.getElementById('mp-list'));
    const show = (v) => { open = v; el.style.display = v ? 'flex' : 'none'; if (v && sound) sound.refresh(); };
    const canvas = game.input && game.input.canvas;
    let hadLock = false;
    document.addEventListener('pointerlockchange', () => {
      const locked = !!document.pointerLockElement;
      if (locked) show(false);
      else if (hadLock && started() && !busy() && document.hasFocus()) show(true);
      hadLock = locked;
    });
    // (with the mouse already free Esc arrives as a key: it opens or closes the list)
    document.addEventListener('keydown', (e) => {
      if (open && sound && sound.key(e)) { e.preventDefault(); return; }
      if (e.code !== 'Escape' || document.pointerLockElement || !started()) return;
      if (open) show(false); else if (!busy()) show(true);
    });
    el.addEventListener('click', () => { show(false); if (game.input && game.input.lock && canvas) game.input.lock(); });
    game.keyhelp = { get open() { return open; }, show, rows: ROWS, sound };
  },
};
