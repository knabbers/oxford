// Sitting at a Faculty of Music piano: the activity that takes over camera and keyboard. Free play, sight-reading
// (wait-for-the-note / in tempo), listen; metronome; the neighbour's knock; applause; the booking knock; multiplayer
// note relay. Owned by places/music_faculty.js. Pure rules live in _music_logic.js.
import * as THREE from 'three';
import { PIECES } from './_music_pieces.js';
import { compilePiece, keyToMidi, KEYMAP, VELOCITIES, DYNAMICS, OCT_MIN, OCT_MAX, WaitScorer, TempoScorer, recordPractice, grade,
  Grumpiness, midiName, MIDI_LO, MIDI_HI } from './_music_logic.js';
import { StaffView } from './_music_staff.js';
import { KEY_Y } from './_music_piano3d.js';
import { dayOf } from '../core/time.js';

const MODES = [['free', 'Free play'], ['wait', 'Sight-read: wait for me'], ['tempo', 'Sight-read: in tempo'], ['listen', 'Listen']];
const KEY_LABEL = { KeyA: 'A', KeyW: 'W', KeyS: 'S', KeyE: 'E', KeyD: 'D', KeyF: 'F', KeyT: 'T', KeyG: 'G', KeyY: 'Y', KeyH: 'H', KeyU: 'U', KeyJ: 'J', KeyK: 'K', KeyO: 'O', KeyL: 'L', KeyP: 'P', Semicolon: ';', Quote: "'", BracketRight: ']' };

export function createSession(game, fac) {
  const S = {
    rec: null, mode: 'free', pieceIdx: 0, hands: 'both', fold: true, tempoPct: 100, metro: false, freeBpm: 80,
    octave: 4, vel: 3, pedal: false, held: new Map(), mouseMidi: null, compiled: null, scorer: null,
    t0: 0, clock: 0, countIn: 0, listenIdx: 0, offQ: [], autoQ: [], marks: new Set(), noteState: new Map(),
    grump: new Grumpiness(), recent: [], bookedUntil: null, knocks: 0, startedAt: 0, lastMetroBeat: -1, sendTokens: 30, ui: null,
  };
  const engine = fac.engine, raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3();
  const now = () => performance.now() / 1000;
  const piece = () => PIECES[S.pieceIdx];
  const spb = () => 60 / (piece().tempo * S.tempoPct / 100);

  // ------------------------------------------------------------------------------------------- notes
  function send(d) {
    if (S.rec && S.rec.local) return;      // (a piano that is nobody else's business: a keyboard in a student's room — nothing is relayed)
    if (S.sendTokens < 1) return;
    S.sendTokens -= 1; game.net?.send?.('piano', { r: S.rec.room, ...d });
  }
  function noteOn(midi, vel, { auto = false, local = true } = {}) {
    if (midi < MIDI_LO || midi > MIDI_HI) return;
    engine.noteOn(midi, vel);
    S.rec.piano.press(midi, true);
    if (local) send({ on: [midi, Math.round(vel * 100) / 100] });
    if (!auto) judge(midi);
  }
  function noteOff(midi, { local = true } = {}) {
    engine.noteOff(midi);
    S.rec.piano.press(midi, false);
    if (local) send({ off: midi });
  }
  function setPedal(down) {
    if (S.pedal === down) return;
    S.pedal = down; engine.setPedal(down); send({ ped: down ? 1 : 0 }); refreshStatus();
  }

  // the player struck a note: score it
  function judge(midi) {
    const t = now();
    S.recent.push(t); while (S.recent.length && S.recent[0] < t - 0.12) S.recent.shift();
    let kind = 'good';
    if (S.recent.length >= 5) kind = 'mash';
    if (S.mode === 'wait' && S.scorer && !S.scorer.done) {
      const before = S.scorer.need.map((x) => x.n);
      const r = S.scorer.play(midi);
      if (r.r === 'wrong') kind = 'wrong';
      for (const s of S.scorer.need) if (s.hit) S.noteState.set(s.n, 'hit');
      if (r.advanced) { for (const n of before) S.noteState.set(n, 'hit'); accompany(before[0].t); refreshMarks(); if (S.scorer.done) finishRun(); }
    } else if (S.mode === 'tempo' && S.scorer && S.countIn <= 0 && !S.scorer.done) {
      const r = S.scorer.play(midi, S.clock);
      if (r.r === 'extra') kind = 'wrong';
      else S.noteState.set(r.e.n, 'hit');
    }
    if (fac.inPracticeRoom(S.rec) && S.grump.feed(kind, t)) neighbourKnock();
  }
  function neighbourKnock() {
    engine.wallKnock();
    S.knocks++;
    game.ui.toast(['Someone bangs on the wall from the next room.', 'THUMP THUMP THUMP. The neighbour has opinions about your scales.', '"Some of us have a recital on Friday!" (through the wall)'][S.knocks % 3], 4);
  }

  // other hand / accompaniment in wait mode: notes from the group just completed up to the next practised group
  function accompany(tDone) {
    if (S.hands === 'both' || !S.compiled) return;
    const nextT = S.scorer.done ? S.compiled.length : S.scorer.t;
    const other = S.compiled.notes.filter((n) => !S.scorer.practised(n) && n.t >= tDone - 1e-6 && n.t < nextT - 1e-6);
    const base = now();
    for (const n of other) S.autoQ.push({ at: base + (n.t - tDone) * spb(), n, off: base + (n.t - tDone + Math.min(n.dur, nextT - n.t + 0.5)) * spb() });
  }

  // ------------------------------------------------------------------------------------------- modes
  function setMode(mode) {
    stopPlayback();
    S.mode = mode; S.noteState.clear(); S.scroll = undefined;
    S.compiled = mode === 'free' ? null : compilePiece(piece());
    if (S.compiled) { engine.warm([...new Set(S.compiled.notes.map((n) => n.midi))]); S.staff.setPiece(S.compiled); }
    if (mode === 'wait') S.scorer = new WaitScorer(S.compiled, { hands: S.hands, fold: S.fold });
    else if (mode === 'tempo') { S.scorer = new TempoScorer(S.compiled, { hands: S.hands, fold: S.fold, tempo: piece().tempo * S.tempoPct / 100 }); S.countIn = S.compiled.barLen; S.t0 = now(); S.clock = -S.compiled.barLen * spb(); S.lastMetroBeat = -99; S.listenIdx = 0; }
    else if (mode === 'listen') { S.scorer = null; S.t0 = now() + 0.6; S.clock = -0.6; S.listenIdx = 0; }
    else S.scorer = null;
    S.runStart = now();
    S.staffWrap.style.display = mode === 'free' ? 'none' : 'block';
    for (const b of S.modeBtns) b.style.background = b.dataset.mode === mode ? '#3a5a8a' : '#221d16';
    refreshMarks(); refreshStatus();
  }
  function stopPlayback() {
    for (const q of S.offQ) noteOff(q.midi, { local: true }); S.offQ.length = 0; S.autoQ.length = 0;
    S.rec && S.rec.piano.clearMarks(); S.marks.clear();
  }
  function finishRun() {
    if (!S.scorer) return;
    const acc = S.scorer.accuracy, st = (game.state.music = game.state.music || {});
    const res = recordPractice(st, { day: dayOf(game.time.now()), pieceId: piece().id, acc, mode: S.mode, seconds: Math.round(now() - S.runStart) });
    game.save();
    const pct = Math.round(acc * 100);
    game.ui.toast(`${piece().title}: ${grade(acc)} — ${pct}%${res.newBest ? ' (personal best!)' : ''} · practice streak ${res.streak} day${res.streak === 1 ? '' : 's'}`, 6);
    if (acc >= 0.95) { setTimeout(() => { engine.applause(); game.ui.toast(fac.inPracticeRoom(S.rec) ? 'Applause from the corridor!' : 'Somebody at the back of the hall claps.', 3.5); }, 700); }
    S.lastResult = { piece: piece().id, mode: S.mode, acc, streak: res.streak };
    refreshStatus();
  }

  function refreshMarks() {
    const want = new Map();
    if (S.mode === 'wait' && S.scorer && !S.scorer.done) for (const s of S.scorer.need) if (!s.hit) want.set(s.n.midi, 0x3d7bff);
    if (S.mode === 'tempo' && S.scorer && !S.scorer.done) {
      const t = S.clock / spb();
      for (const e of S.scorer.exp) { if (e.state !== 0) continue; if (e.n.t > t + 0.6) break; if (e.n.t > t - 0.25) want.set(e.n.midi, e.n.t <= t + 0.12 ? 0x3d7bff : 0x8fb4ff); }
    }
    for (const m of S.marks) if (!want.has(m)) { S.rec.piano.mark(m, null); S.marks.delete(m); }
    for (const [m, c] of want) { S.rec.piano.mark(m, c); S.marks.add(m); }
  }

  // ------------------------------------------------------------------------------------------- input
  function onKeyDown(e) {
    if (!S.rec || game.input.typing) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.code !== 'Escape') { e.target.blur(); }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setPedal(true); return; }
    if (e.repeat) { if (KEYMAP[e.code] !== undefined) e.preventDefault(); return; }
    if (KEYMAP[e.code] !== undefined) {
      e.preventDefault();
      if (S.mode === 'listen') return;
      if (S.held.has(e.code)) return;
      const m = keyToMidi(e.code, S.octave, e.shiftKey);
      if (m === null) return;
      S.held.set(e.code, m); noteOn(m, VELOCITIES[S.vel]);
      return;
    }
    const k = e.code;
    if (k === 'KeyZ' || k === 'ArrowLeft') { S.octave = Math.max(OCT_MIN, S.octave - 1); refreshStatus(); }
    else if (k === 'KeyX' || k === 'ArrowRight') { S.octave = Math.min(OCT_MAX, S.octave + 1); refreshStatus(); }
    else if (k === 'KeyC' || k === 'ArrowDown') { S.vel = Math.max(0, S.vel - 1); refreshStatus(); }
    else if (k === 'KeyV' || k === 'ArrowUp') { S.vel = Math.min(VELOCITIES.length - 1, S.vel + 1); refreshStatus(); }
    else if (/^Digit[1-6]$/.test(k)) { S.vel = +k[5] - 1; refreshStatus(); }
    else if (k === 'KeyM') { S.metro = !S.metro; S.lastMetroBeat = -99; refreshStatus(); }
    else if (k === 'Minus') { S.freeBpm = Math.max(30, S.freeBpm - 4); refreshStatus(); }
    else if (k === 'Equal') { S.freeBpm = Math.min(220, S.freeBpm + 4); refreshStatus(); }
    else if (k === 'KeyR' && S.mode !== 'free') setMode(S.mode);
    else if (k === 'Tab') { e.preventDefault(); setMode(MODES[(MODES.findIndex((m) => m[0] === S.mode) + 1) % MODES.length][0]); }
  }
  function onKeyUp(e) {
    if (!S.rec) return;
    if (e.code === 'Space') { setPedal(false); return; }
    const m = S.held.get(e.code);
    if (m !== undefined) { S.held.delete(e.code); if (![...S.held.values()].includes(m) && S.mouseMidi !== m) noteOff(m); }
  }
  function pickAt(cx, cy) {
    const r = game.renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, game.camera);
    return S.rec.piano.pick(raycaster);
  }
  function onPointerDown(e) {
    if (!S.rec || e.target !== game.renderer.domElement || S.mode === 'listen') return;
    const h = pickAt(e.clientX, e.clientY); if (!h) return;
    S.pointer = e.pointerId; S.mouseMidi = h.midi;
    noteOn(h.midi, Math.min(1, 0.3 + 0.7 * h.front));     // nearer the front edge = harder
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (S.mouseMidi === null || e.pointerId !== S.pointer) return;
    const h = pickAt(e.clientX, e.clientY);
    if (h && h.midi !== S.mouseMidi) { const old = S.mouseMidi; S.mouseMidi = h.midi; if (![...S.held.values()].includes(old)) noteOff(old); noteOn(h.midi, Math.min(1, 0.3 + 0.7 * h.front)); }
  }
  function onPointerUp(e) {
    if (S.mouseMidi === null || (S.pointer !== undefined && e.pointerId !== S.pointer)) return;
    const m = S.mouseMidi; S.mouseMidi = null; if (![...S.held.values()].includes(m)) noteOff(m);
  }

  // ------------------------------------------------------------------------------------------- UI
  function buildUI() {
    const o = game.ui.openOverlay({ dim: false });
    o.style.pointerEvents = 'none';
    const css = 'pointer-events:auto;font-family:Georgia,serif;color:#f4ecd8';
    const top = document.createElement('div'); top.style.cssText = 'position:absolute;left:50%;top:10px;transform:translateX(-50%);width:min(1040px,max(560px,calc(100vw - 240px)));border-radius:6px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.5);display:none;pointer-events:none';
    const cv = document.createElement('canvas'); top.appendChild(cv); o.appendChild(top);
    S.staffWrap = top; S.staff = new StaffView(cv);
    const w = Math.min(1040, Math.max(560, innerWidth - 240)); S.staff.resize(w, 230, Math.min(2, devicePixelRatio || 1));
    const bar = document.createElement('div');
    bar.style.cssText = css + ';position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:min(1100px,96vw);background:rgba(20,16,12,.88);border:1px solid #5a4a30;border-radius:8px;padding:8px 12px;font-size:13px';
    const row1 = document.createElement('div'); row1.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center';
    const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'background:#221d16;color:#f4ecd8;border:1px solid #6a5838;border-radius:4px;padding:4px 9px;cursor:pointer;font:inherit'; b.onclick = () => { fn(); b.blur(); }; row1.appendChild(b); return b; };
    S.modeBtns = MODES.map(([m, l]) => { const b = btn(l, () => setMode(m)); b.dataset.mode = m; return b; });
    const sel = (opts, val, fn) => { const s = document.createElement('select'); s.style.cssText = 'background:#221d16;color:#f4ecd8;border:1px solid #6a5838;border-radius:4px;padding:3px;font:inherit;max-width:260px'; for (const [v, l] of opts) { const op = document.createElement('option'); op.value = v; op.textContent = l; s.appendChild(op); } s.value = val; s.onchange = () => { fn(s.value); s.blur(); }; row1.appendChild(s); return s; };
    S.pieceSel = sel(PIECES.map((p, i) => [String(i), `${p.title} (${p.composer})`]), String(S.pieceIdx), (v) => { S.pieceIdx = +v; if (S.mode !== 'free') setMode(S.mode); else refreshStatus(); });
    sel([['both', 'Both hands'], ['right', 'Right hand (left plays itself)'], ['left', 'Left hand (right plays itself)']], S.hands, (v) => { S.hands = v; if (S.mode !== 'free') setMode(S.mode); });
    sel([['1', 'Any octave counts'], ['0', 'Exact octave']], S.fold ? '1' : '0', (v) => { S.fold = v === '1'; if (S.mode !== 'free') setMode(S.mode); });
    sel([['60', 'Tempo 60%'], ['80', 'Tempo 80%'], ['100', 'Tempo 100%'], ['120', 'Tempo 120%']], String(S.tempoPct), (v) => { S.tempoPct = +v; if (S.mode !== 'free') setMode(S.mode); });
    btn('Metronome (M)', () => { S.metro = !S.metro; S.lastMetroBeat = -99; refreshStatus(); });
    btn('Restart (R)', () => setMode(S.mode));
    btn('Stand up (Esc)', () => game.endActivity());
    const status = document.createElement('div'); status.style.cssText = 'margin-top:6px;color:#e8d9b4';
    const help = document.createElement('div'); help.style.cssText = 'margin-top:3px;opacity:.75;font-size:12px';
    help.textContent = "Play: A W S E D F T G Y H U J K O L P ; ' ]  ·  Shift = octave below  ·  Z/X octave  ·  C/V (or 1–6) softer/louder  ·  Space sustain pedal  ·  click/touch the keys (front edge = louder)  ·  −/= metronome speed  ·  Tab mode";
    bar.appendChild(row1); bar.appendChild(status); bar.appendChild(help); o.appendChild(bar);
    S.statusEl = status;
  }
  function refreshStatus() {
    if (!S.statusEl) return;
    const lo = keyToMidi('KeyA', S.octave), hi = keyToMidi('BracketRight', S.octave) ?? keyToMidi('Quote', S.octave);
    const st = game.state.music || {};
    let s = `<b>${S.rec.label}</b> · keys ${midiName(lo)}–${midiName(hi)} · <b>${DYNAMICS[S.vel]}</b> · pedal ${S.pedal ? '<b style="color:#9fd">down</b>' : 'up'} · metronome ${S.metro ? (S.mode === 'free' ? S.freeBpm + ' bpm' : 'on') : 'off'}`;
    if (S.scorer && S.mode === 'wait') s += ` · accuracy ${Math.round(S.scorer.accuracy * 100)}% · ${Math.round(S.scorer.progress * 100)}% through`;
    if (S.scorer && S.mode === 'tempo') s += ` · hits ${S.scorer.hits}/${S.scorer.exp.length} · misses ${S.scorer.misses} · extra ${S.scorer.extras}`;
    s += ` · streak ${st.streak || 0} day${(st.streak || 0) === 1 ? '' : 's'}`;
    if (S.mode !== 'free' && S.scorer && S.scorer.done) s += ' · <b>done</b> — R to go again';
    S.statusEl.innerHTML = s;
  }
  function keysHint() {
    if (S.mode !== 'wait' || !S.scorer || S.scorer.done) return '';
    const parts = S.scorer.need.filter((x) => !x.hit).map((x) => {
      let label = null;
      for (const [code] of Object.entries(KEY_LABEL)) { const m = keyToMidi(code, S.octave); if (m === x.n.midi || (S.fold && m !== null && m % 12 === x.n.midi % 12)) { label = KEY_LABEL[code]; break; } }
      return midiName(x.n.midi) + (label ? ` [${label}]` : '');
    });
    return 'Next: ' + parts.join(' + ');
  }

  // ------------------------------------------------------------------------------------------- sit / stand
  function sit(rec) {
    if (!engine.ready()) { game.audio.start?.(); engine.ready(); }
    S.rec = rec; S.held.clear(); S.mouseMidi = null; S.pedal = false; S.startedAt = now(); S.knocks = 0;
    engine.setInstrument(rec.kind); engine.setRoom(rec.room === 'hall' ? 'hall' : 'room');
    // warm the playable range first
    const mid = []; for (let m = 48; m <= 84; m++) mid.push(m); engine.warm(mid, rec.kind);
    const p = game.player;
    p.teleport(rec.seat[0], rec.seat[1], rec.heading); p.pose = 'sit';
    if (p.character.bones?.head) p.character.bones.head.visible = false;
    if (fac.inPracticeRoom(rec)) { const h = game.time.hour; S.bookedUntil = (Math.floor(h) + (h % 1 > 0.5 ? 2 : 1)) % 24; } else S.bookedUntil = null;
    buildUI();
    S.hidden = ['minimap', 'area'].map((id) => document.getElementById(id)).filter(Boolean); for (const el of S.hidden) el.style.visibility = 'hidden';
    game.beginActivity({
      name: 'piano', pointer: 'free',
      hint: rec.hint ? rec.hint : rec.kind === 'upright' ? 'You sit down at the upright. A few notes are a bit out.' : rec.kind === 'steinway' ? 'You sit down at the Steinway. The hall goes quiet.' : 'You sit down at the grand.',
      update: (dt) => tick(dt),
      camera: (dt, cam) => camera(dt, cam),
      onEnd: () => stand(),
    });
    addEventListener('keydown', onKeyDown, true); addEventListener('keyup', onKeyUp, true);
    addEventListener('pointerdown', onPointerDown); addEventListener('pointermove', onPointerMove); addEventListener('pointerup', onPointerUp); addEventListener('pointercancel', onPointerUp);
    setMode(S.mode);
    fac.onSit && fac.onSit(rec);
  }
  function stand() {
    removeEventListener('keydown', onKeyDown, true); removeEventListener('keyup', onKeyUp, true);
    removeEventListener('pointerdown', onPointerDown); removeEventListener('pointermove', onPointerMove); removeEventListener('pointerup', onPointerUp); removeEventListener('pointercancel', onPointerUp);
    for (const m of S.held.values()) noteOff(m); S.held.clear();
    if (S.mouseMidi !== null) noteOff(S.mouseMidi); S.mouseMidi = null;
    setPedal(false); stopPlayback(); S.rec.piano.releaseAll();
    const st = (game.state.music = game.state.music || {}); st.seconds = (st.seconds || 0) + Math.round(now() - S.startedAt); game.save();
    for (const el of S.hidden || []) el.style.visibility = '';
    const p = game.player; p.pose = 'stand';
    if (p.character.bones?.head) p.character.bones.head.visible = true;
    game.camera.fov = 60; game.camera.updateProjectionMatrix();
    const rec = S.rec; S.rec = null; S.statusEl = null;
    // step back from the stool
    const away = rec.heading + Math.PI; p.teleport(rec.seat[0] + Math.sin(away) * 0.55, rec.seat[1] + Math.cos(away) * 0.55, away);
    fac.onStand && fac.onStand(rec);
  }

  // ------------------------------------------------------------------------------------------- per frame
  let statusT = 0;
  function tick(dt) {
    const t = now();
    S.sendTokens = Math.min(30, S.sendTokens + dt * 30);
    S.rec.piano.update(dt);
    engine.pump(4);
    // auto-played notes (other hand) + scheduled releases
    for (let i = S.autoQ.length - 1; i >= 0; i--) { const q = S.autoQ[i]; if (t >= q.at) { noteOn(q.n.midi, 0.5, { auto: true }); S.offQ.push({ at: q.off, midi: q.n.midi }); S.autoQ.splice(i, 1); } }
    for (let i = S.offQ.length - 1; i >= 0; i--) { const q = S.offQ[i]; if (t >= q.at) { noteOff(q.midi); S.offQ.splice(i, 1); } }
    const sp = spb();
    if (S.mode === 'tempo' && S.scorer) {
      S.clock = t - S.t0 - S.compiled.barLen * sp;
      const beat = Math.floor(S.clock / beatUnit() + 1e-6);
      S.countIn = S.clock < 0 ? Math.ceil(-S.clock / beatUnit() - 1e-6) : 0;
      if (beat !== S.lastMetroBeat && (S.metro || S.clock < 0)) { S.lastMetroBeat = beat; const barBeats = Math.round(S.compiled.barLen / (beatUnit() / sp)); engine.click(((beat % barBeats) + barBeats) % barBeats === 0); }
      if (!S.scorer.done) {
        const missed = S.scorer.tick(S.clock);
        if (missed) { for (const e of S.scorer.exp) if (e.state === -1 && !S.noteState.has(e.n)) S.noteState.set(e.n, 'miss'); if (fac.inPracticeRoom(S.rec) && S.grump.feed('wrong', t)) neighbourKnock(); }
        // other hand plays itself
        if (S.hands !== 'both') while (S.listenIdx < S.compiled.notes.length && S.compiled.notes[S.listenIdx].t * sp <= S.clock) { const n = S.compiled.notes[S.listenIdx++]; if (!S.scorer.exp.some((e) => e.n === n)) { noteOn(n.midi, 0.5, { auto: true }); S.offQ.push({ at: t + n.dur * sp * 0.95, midi: n.midi }); } }
        if (S.scorer.done) finishRun();
      }
      refreshMarks();
    } else if (S.mode === 'listen' && S.compiled) {
      S.clock = t - S.t0;
      const N = S.compiled.notes;
      while (S.listenIdx < N.length && N[S.listenIdx].t * sp <= S.clock) { const n = N[S.listenIdx++]; noteOn(n.midi, n.hand === 'R' ? 0.62 : 0.45, { auto: true }); S.offQ.push({ at: t + n.dur * sp * 0.96, midi: n.midi }); }
      if (S.listenIdx >= N.length && !S.offQ.length && S.clock > S.compiled.length * sp + 1.5) { S.t0 = t + 1.5; S.listenIdx = 0; }   // loop
      if (S.metro) { const beat = Math.floor(S.clock / beatUnit()); if (beat !== S.lastMetroBeat && S.clock >= 0) { S.lastMetroBeat = beat; engine.click(beat % Math.round(S.compiled.barLen / (beatUnit() / sp)) === 0); } }
    } else if (S.mode === 'free' && S.metro) {
      const b = Math.floor(t / (60 / S.freeBpm));
      if (b !== S.lastMetroBeat) { S.lastMetroBeat = b; engine.click(b % 4 === 0); }
    } else if (S.mode === 'wait' && S.metro) {
      const b = Math.floor(t / beatUnit()); if (b !== S.lastMetroBeat) { S.lastMetroBeat = b; engine.click(false); }
    }
    // staff
    if (S.mode !== 'free' && S.compiled) {
      let tb;
      if (S.mode === 'wait') { const target = S.scorer.t; S.scroll = S.scroll === undefined ? target : S.scroll + (target - S.scroll) * Math.min(1, dt * 6); tb = S.scroll; }
      else tb = S.clock / sp;
      const st = (n) => S.noteState.get(n) || null;
      const practised = S.scorer && S.scorer.practised ? (n) => S.scorer.practised(n) : S.hands === 'both' ? null : (n) => (S.hands === 'right' ? n.hand === 'R' : n.hand === 'L');
      const info = S.mode === 'wait' ? keysHint() : S.mode === 'tempo' ? `${Math.round(piece().tempo * S.tempoPct / 100)} bpm` : 'Listening…';
      S.staff.draw(tb, { cursorT: S.mode === 'wait' ? S.scorer.t : tb, state: st, practised, info, countIn: S.mode === 'tempo' && S.countIn > 0 ? S.countIn : 0 });
    }
    // booking: someone knocks when your hour is up (game time)
    if (S.bookedUntil !== null) {
      const h = game.time.hour, due = S.bookedUntil, past = Math.floor(h) === due;
      if (past) {
        engine.doorKnock(3);
        const n = (S.bookKnocks = (S.bookKnocks || 0) + 1);
        const hh = String(due).padStart(2, '0');
        game.ui.toast(n === 1 ? `Knock knock. "Sorry — I've got Room ${S.rec.room.slice(4)} booked from ${hh}:00?"` : n === 2 ? `Knock knock knock. "It's on the sheet! ${hh}:00!"` : '"I\'m going to get the porter."', 5);
        S.bookedUntil = (due + 1) % 24;
      }
    }
    if ((statusT -= dt) <= 0) { statusT = 0.25; refreshStatus(); }
  }
  function beatUnit() {   // seconds per metronome beat (dotted crotchet in compound time)
    const p = piece(), sp = spb();
    if (p.time[1] === 8 && p.time[0] % 3 === 0) return 1.5 * sp;
    return (4 / p.time[1]) * sp;
  }

  // camera: over the player's shoulders, looking down at the keyboard; hands forward
  function camera(dt, cam) {
    const r = S.rec, P = r.piano;
    const [x, y, z] = P.cam.pos, [lx, ly, lz] = P.cam.look;
    const back = S.zoomBack || 0;
    tmpV.set(x, y + back * 0.5, z + back); P.group.localToWorld(tmpV);
    tmpL.set(lx, ly, lz - 0.02); P.group.localToWorld(tmpL);
    if (game.input.wheel) S.zoomBack = Math.max(0, Math.min(1.2, (S.zoomBack || 0) + game.input.wheel * 0.12));
    cam.fov = 58; cam.updateProjectionMatrix();
    cam.position.copy(tmpV); cam.lookAt(tmpL);
    const bn = game.player.character.bones;
    if (bn) {
      const lo = [...S.held.values(), S.mouseMidi].filter((m) => m !== null);
      const reach = lo.length ? 1 : 0;
      bn.armL.rotation.x = -0.55; bn.foreL.rotation.x = -1.05 - reach * 0.05; bn.armR.rotation.x = -0.55; bn.foreR.rotation.x = -1.05 - reach * 0.05;
      bn.armL.rotation.z = -0.12; bn.armR.rotation.z = 0.12;
    }
    void KEY_Y;
  }

  return {
    S, sit, setMode, get active() { return !!S.rec; },
    // test hooks
    press: (midi, vel = 0.65) => { if (S.rec) { noteOn(midi, vel); S.offQ.push({ at: now() + 0.4, midi }); } },
    setPiece: (id) => { const i = PIECES.findIndex((p) => p.id === id); if (i >= 0) { S.pieceIdx = i; if (S.pieceSel) S.pieceSel.value = String(i); if (S.rec) setMode(S.mode); } return i; },
    playExpected: () => { if (S.mode === 'wait' && S.scorer && !S.scorer.done) for (const s of S.scorer.need.slice()) if (!s.hit) { noteOn(s.n.midi, 0.6); S.offQ.push({ at: now() + 0.3, midi: s.n.midi }); } },
    knock: () => neighbourKnock(),
    finish: () => finishRun(),
  };
}
