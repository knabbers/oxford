// The sound of vehicles: the one the player drives (VehicleSound, owned by systems/vehicles.js) and the traffic and
// other players' vehicles round about (TrafficSound, owned by systems/traffic.js). The rules — which sound a vehicle
// makes, its note at a speed, who is heard — are in _veh_logic.js; this file is the audio graph.
//
// One VOICE is a small persistent graph, made once and used for one vehicle after another (nothing is created per
// frame, and the number of nodes never grows):
//   engine   a sawtooth an octave over the firing note + a square at it, through a low-pass that opens with the load and
//            the speed (so the harmonics a small loudspeaker can reproduce are there — the old engine was all below
//            100 Hz and could not be heard on a laptop), an amplitude wobble for a diesel's clatter;
//   whine    a sine: an electric car's motor, reverse gear;
//   road     band-passed noise by speed (tyres);
//   tick     a bicycle's freewheel (a looped click buffer whose rate follows the wheel).
// It plays into audio.spatial(…, { cls: 'vehicle' }) at the vehicle: direction (binaural on headphones) and distance are
// the panner's; the "Vehicles and effects" volume of the Esc screen governs it (the effects bus). Pitch follows the
// closing speed (a Doppler shift done on the parameters: nothing is resampled, so it cannot click). A voice that has
// been silent for a second is unhooked from the output so that nothing is processed for it.
// Nodes: 17 + its panner per voice; six traffic voices and the player's own = 126 at most, at a busy junction or an
// empty one (a one-shot — a door, the starter — adds a handful for its own length).
import { PROFILE, MAX_VOICES, soundKind, voiceSet, doppler, pick, indoorFactor, crowdLevel, loadOf } from './_veh_logic.js';

let tickBuf = null;
function freewheel(c) {      // 16 clicks a second at rate 1
  if (tickBuf && tickBuf._sr === c.sampleRate) return tickBuf;
  const sr = c.sampleRate, buf = c.createBuffer(1, sr, sr), d = buf.getChannelData(0);
  for (let k = 0; k < 16; k++) { const at = Math.floor((k / 16) * sr); for (let i = 0; i < 90; i++) d[at + i] = (i % 9 < 4 ? 1 : -1) * Math.exp(-i / 16) * (k % 2 ? 0.8 : 1); }
  buf._sr = sr; tickBuf = buf; return buf;
}

class Voice {
  constructor(audio, own = false) {
    this.audio = audio; this.own = own; this.n = null; this.h = null; this.kind = null; this.live = false; this.quietT = 0; this.mode = '';
    this.x = 0; this.y = 1; this.z = 0; this.P = { x: 0, y: 1, z: 0, place: 'world' }; /* (a place on the map: heard rightly from inside a walk-in room too — core/audio.js) */ this.pos = () => { const P = this.P; P.x = this.x; P.y = this.y; P.z = this.z; return P; };
    this.lvl = 0;
  }
  _ensure() {
    const a = this.audio; if (!a || !a.ctx || !a.noiseBuf) return false;
    if (this.n) return true;
    try {
      const c = a.ctx, n = {};
      n.o1 = c.createOscillator(); n.o1.type = 'sawtooth'; n.o2 = c.createOscillator(); n.o2.type = 'square';
      n.o2g = c.createGain(); n.o2g.gain.value = 0.5;
      n.f = c.createBiquadFilter(); n.f.type = 'lowpass'; n.f.frequency.value = 800; n.f.Q.value = 0.9;
      n.am = c.createGain(); n.am.gain.value = 1; n.lfo = c.createOscillator(); n.lfo.type = 'triangle'; n.lfo.frequency.value = 9; n.lfoG = c.createGain(); n.lfoG.gain.value = 0;
      n.lfo.connect(n.lfoG); n.lfoG.connect(n.am.gain);
      n.eng = c.createGain(); n.eng.gain.value = 0;
      n.o1.connect(n.f); n.o2.connect(n.o2g); n.o2g.connect(n.f); n.f.connect(n.am); n.am.connect(n.eng);
      n.wh = c.createOscillator(); n.wh.type = 'sine'; n.wh.frequency.value = 400; n.whg = c.createGain(); n.whg.gain.value = 0; n.wh.connect(n.whg);
      n.ns = c.createBufferSource(); n.ns.buffer = a.noiseBuf; n.ns.loop = true; n.ns.loopStart = Math.random() * 0.5;
      n.nf = c.createBiquadFilter(); n.nf.type = 'bandpass'; n.nf.frequency.value = 700; n.nf.Q.value = 0.5; n.road = c.createGain(); n.road.gain.value = 0;
      n.ns.connect(n.nf); n.nf.connect(n.road);
      n.fw = c.createBufferSource(); n.fw.buffer = freewheel(c); n.fw.loop = true;
      n.fwf = c.createBiquadFilter(); n.fwf.type = 'bandpass'; n.fwf.frequency.value = 4200; n.fwf.Q.value = 1.5; n.tick = c.createGain(); n.tick.gain.value = 0;
      n.fw.connect(n.fwf); n.fwf.connect(n.tick);
      n.out = c.createGain(); n.out.gain.value = 0;
      n.eng.connect(n.out); n.whg.connect(n.out); n.road.connect(n.out); n.tick.connect(n.out);
      n.o1.start(); n.o2.start(); n.lfo.start(); n.wh.start(); n.ns.start(); n.fw.start();
      this.n = n; this.live = false; this.h = null;
    } catch { this.n = null; return false; }
    return true;
  }
  /** (re)hook to the output at the vehicle's place; the panner is made anew when the player changes headphones / speakers */
  _hook() {
    const a = this.audio, n = this.n;
    if (this.h && this.mode !== a.output) { try { n.out.disconnect(); } catch { /* */ } this.h.free(); this.h = null; this.live = false; }
    if (!this.h) {
      // the player's own car is always a few metres from the camera: direction only (the level does not pump as the camera swings)
      this.h = a.spatial ? a.spatial(this.pos, this.own ? { cls: 'vehicle', dist: false, keep: true, occlude: false } : { cls: 'vehicle', keep: true }) : null;
      this.mode = a.output;
    }
    if (!this.live) { try { n.out.connect(this.h ? this.h.in || this.h : a.master); } catch { /* */ } this.live = true; }
  }
  /** play this vehicle: kind (_veh_logic PROFILE), where, speed (signed), load 0..1, braking, closing speed vr (m/s), level 0..1 on top (indoors, fades) */
  set(kind, x, y, z, speed, load, braking, vr, level, inside = false) {
    if (!(isFinite(x) && isFinite(z) && isFinite(speed))) return;
    if (!this._ensure()) return;
    this.x = x; this.y = isFinite(y) ? y : 1; this.z = z; this.kind = kind; this.lvl = level;
    this._hook();
    const n = this.n, t = this.audio.ctx.currentTime, S = voiceSet(kind, speed, load, braking, doppler(vr), this.own, inside);
    n.o1.frequency.setTargetAtTime(Math.max(16, S.hz * 2), t, 0.09); n.o2.frequency.setTargetAtTime(Math.max(8, S.hz), t, 0.09);
    n.o2g.gain.setTargetAtTime(S.sub, t, 0.2);
    n.f.frequency.setTargetAtTime(Math.max(120, Math.min(9000, S.cut)), t, 0.12);
    n.eng.gain.setTargetAtTime(S.eng, t, 0.15);
    n.lfoG.gain.setTargetAtTime(S.clatter, t, 0.2); n.lfo.frequency.setTargetAtTime(S.rate, t, 0.2);
    n.whg.gain.setTargetAtTime(S.whine, t, 0.15); n.wh.frequency.setTargetAtTime(Math.max(60, Math.min(4000, S.whineHz)), t, 0.12);
    n.road.gain.setTargetAtTime(S.road, t, 0.25); n.nf.frequency.setTargetAtTime(Math.max(200, Math.min(6000, S.roadHz)), t, 0.3);
    n.tick.gain.setTargetAtTime(S.tick, t, S.tick > 0 ? 0.08 : 0.04); n.fw.playbackRate.setTargetAtTime(Math.max(0.2, Math.min(4, S.tickRate)), t, 0.1);
    n.out.gain.setTargetAtTime(Math.max(0, Math.min(1.5, level)), t, 0.12);
    this.quietT = 0;
  }
  /** fade out (tc s); after a second of silence the graph is unhooked so nothing is processed for it */
  hush(dt, tc = 0.12) {
    const n = this.n; if (!n || !this.live) return;
    if (this.quietT === 0) n.out.gain.setTargetAtTime(0, this.audio.ctx.currentTime, tc);
    this.quietT += dt; this.lvl = 0;
    if (this.quietT > 1 + tc * 4) { try { n.out.disconnect(); } catch { /* */ } this.live = false; this.kind = null; }
  }
  /** the nodes are thrown away (a poisoned filter: core/audio.js heal()); made again when next needed */
  dispose() {
    const n = this.n; if (!n) return;
    for (const k of ['o1', 'o2', 'lfo', 'wh', 'ns', 'fw']) { try { n[k].stop(); } catch { /* */ } }
    for (const k in n) { try { n[k].disconnect(); } catch { /* */ } }
    if (this.h) { try { this.h.free(); } catch { /* */ } }
    this.n = null; this.h = null; this.live = false; this.kind = null;
  }
}

const ALL = new Set();      // every VehicleSound / TrafficSound alive, for audio.health() and the watchdog
function register(audio, o) {
  ALL.add(o);
  if (!audio || audio._vehHooked) return;
  audio._vehHooked = true;
  if (audio.onPoison) audio.onPoison(() => { for (const x of ALL) if (x.audio === audio) x.rebuild(); });
  if (audio.reports) audio.reports.vehicles = () => { let voices = 0, live = 0, nodes = 0; const kinds = []; for (const x of ALL) if (x.audio === audio) for (const v of x.voices) { voices++; if (v.n) nodes += 18; if (v.live) { live++; kinds.push(v.kind + (v.own ? '*' : '')); } } return { voices, live, nodes, kinds }; };
}

/** The vehicle the player is driving. systems/vehicles.js: update() every frame at the wheel, stop() on getting out. */
export class VehicleSound {
  constructor(audio) { this.audio = audio; this.v = new Voice(audio, true); this.voices = [this.v]; this.on = false; this.type = null; register(audio, this); }
  /** type: 'car'|'taxi'|'van'|'bus'|'bike' (or a vehicle {type, kind, uid}); speed m/s (signed); throttle; where = {x, y?, z} (the vehicle); braking */
  update(type, speed, throttle, where = null, braking = false) {
    const a = this.audio; if (!a || !a.ctx) return;
    const kind = typeof type === 'string' ? soundKind({ type, kind: type === 'bike' ? 'bike' : 'car', uid: 0 }) : soundKind(type);
    const x = where ? where.x : a._lx, z = where ? where.z : a._lz, y = where && isFinite(where.y) ? where.y + 0.8 : (a._lh || 1.6) - 0.6;
    if (!this.on && kind !== 'bike') this.start(kind, x, z);
    this.on = true; this.type = kind;
    this.v.set(kind, x, y, z, speed, throttle ? 1 : 0, !!braking, 0, 1);
    // brakes: a faint squeal as a heavy vehicle comes to rest
    if (braking && (kind === 'bus' || kind === 'van') && Math.abs(speed) > 0.6 && Math.abs(speed) < 2.2 && a.ctx.currentTime - (this._sqT || 0) > 1.5) { this._sqT = a.ctx.currentTime; a.tone(kind === 'bus' ? 1850 : 2300, 0.45, { gain: 0.012, pos: [x, z], cls: 'vehicle' }); }
  }
  /** the starter and the engine catching (a soft click for an electric car) */
  start(kind, x, z) {
    const a = this.audio; if (!a || !a.ctx || this.on) return;
    const pos = isFinite(x) && isFinite(z) ? [x, z] : undefined, cls = 'vehicle';
    if (kind === 'ev') { a.noise(0.03, { gain: 0.08, freq: 700, q: 2, pos, cls }); a.noise(0.02, { gain: 0.04, freq: 2600, q: 3, when: 0.004, pos, cls }); a.noise(0.025, { gain: 0.05, freq: 900, q: 2, when: 0.35 + Math.random() * 0.1, pos, cls }); return; }      // (an electric car: the main contactors clacking shut — it was a two-note chime, 2026-11-23)
    const P = PROFILE[kind] || PROFILE.car;
    for (let i = 0; i < 5; i++) a.noise(0.07, { gain: 0.07, freq: 420 + i * 25, q: 1.2, when: i * 0.085, pos, cls });      // the starter turning over
    a.noise(0.5, { gain: 0.09, freq: P.cut * 0.6, type: 'lowpass', q: 0.7, when: 0.42, pos, cls });                           // …and it catches
  }
  /** a door: 'open' (the latch) or 'shut' (the thump) */
  door(what, x, z, kind = 'car') {
    const a = this.audio; if (!a || !a.ctx || !(isFinite(x) && isFinite(z))) return;
    const pos = [x, z], cls = 'vehicle', big = kind === 'bus' || kind === 'van';
    if (what === 'open') { a.noise(0.05, { gain: 0.07, freq: 2100, q: 2.5, pos, cls }); a.noise(0.06, { gain: 0.04, freq: 900, q: 1.2, when: 0.05, pos, cls }); }
    else { a.noise(0.16, { gain: big ? 0.22 : 0.17, freq: big ? 110 : 150, type: 'lowpass', q: 0.8, pos, cls }); a.noise(0.04, { gain: 0.05, freq: 1700, q: 2, when: 0.01, pos, cls }); }
  }
  /** engine off: it runs down, then the graph is unhooked so nothing is processed while you walk */
  stop() {
    if (this.on && this.type && this.type !== 'bike' && this.type !== 'ev') { const a = this.audio, v = this.v; if (a && a.ctx && v.n) { const t = a.ctx.currentTime; v.n.o1.frequency.setTargetAtTime(28, t, 0.16); v.n.o2.frequency.setTargetAtTime(14, t, 0.16); } }
    this.on = false;
    const v = this.v; if (!v.n || !v.live) return;
    try { v.n.out.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.16); } catch { /* */ }
    if (!this._off && typeof setTimeout === 'function') this._off = setTimeout(() => { this._off = null; if (!this.on && v.n) { try { v.n.out.disconnect(); } catch { /* */ } v.live = false; v.kind = null; } }, 1100);
  }
  rebuild() { this.v.dispose(); this.on = false; }
}

/**
 * The traffic and other players' vehicles: up to MAX_VOICES of them heard at once, the nearest and loudest, each on
 * its own voice at its own place. tick(dt, list, listener…) ten times a second from the owner.
 */
export class TrafficSound {
  constructor(audio, n = MAX_VOICES) {
    this.audio = audio; this.voices = []; this.slot = []; this.best = []; this.prevD = []; this.n = n;
    for (let i = 0; i < n; i++) { this.voices.push(new Voice(audio)); this.slot.push(null); this.best.push({ a: null, d: 0, score: 0 }); this.prevD.push(-1); }
    this.heard = 0; register(audio, this);
  }
  /**
   * list: vehicles { x, z, y?, speed, kind, type, uid, active, parked, load?, braking? } (traffic's own list, and any
   * other players' vehicles appended by the owner); lx, lz: the listener; skip: the vehicle the player is in;
   * outdoors + roomOut: where the listener is (indoorFactor); alt: metres above the ground (a glider hears less);
   * cabin: 0..1 on the others when the listener sits in a closed vehicle; inside: the vehicle of the list the listener
   * is riding in (a bus: heard as its interior, at full level).
   */
  tick(dt, list, lx, lz, skip, outdoors, roomOut, alt = 0, cabin = 1, inside = null) {
    const a = this.audio; if (!a || !a.ctx) return 0;
    const F = indoorFactor(outdoors, roomOut) * (alt > 5 ? 1 / (1 + alt / 25) : 1) * cabin, N = this.n, B = this.best, S = this.slot, V = this.voices;
    const m = F > 0 && list ? pick(list, lx, lz, N, B, skip) : 0;
    if (!m) for (let j = 0; j < N; j++) { B[j].a = null; }
    // a voice whose vehicle is no longer among the chosen fades out (a quarter of a second) before it is given another
    for (let i = 0; i < N; i++) {
      if (!S[i]) { V[i].hush(dt); continue; }
      let keep = false; for (let j = 0; j < m; j++) if (B[j].a === S[i]) { keep = true; break; }
      if (!keep) { S[i] = null; this.prevD[i] = -1; V[i].hush(dt, 0.09); }
    }
    let heard = 0; const CL = crowdLevel(m);
    for (let j = 0; j < m; j++) {
      const c = B[j].a; let i = S.indexOf(c);
      if (i < 0) { i = -1; for (let k = 0; k < N; k++) if (!S[k] && (!V[k].live || V[k].quietT > 0.3)) { i = k; break; } if (i < 0) continue; S[i] = c; this.prevD[i] = -1; }
      const d = B[j].d, vr = this.prevD[i] >= 0 && dt > 0 ? (this.prevD[i] - d) / dt : 0; this.prevD[i] = d;
      // (a jump — a packet, a respawn — is not a speed)
      const kind = c.sk || soundKind(c), edge = Math.min(1, (1 - d / 75) * 4);
      const mine = c === inside;
      V[i].set(kind, c.x, (isFinite(c.y) ? c.y : 0) + 0.8, c.z, c.speed || 0, loadOf(c), !!c.braking, mine || Math.abs(vr) >= 40 ? 0 : vr, mine ? 1 : F * edge * CL, mine);
      heard++;
    }
    this.heard = heard;
    return heard;
  }
  /** everything fades (the game is paused, the listener went indoors for good) */
  quiet(dt) { for (let i = 0; i < this.n; i++) { this.slot[i] = null; this.voices[i].hush(dt); } this.heard = 0; }
  rebuild() { for (let i = 0; i < this.n; i++) { this.voices[i].dispose(); this.slot[i] = null; this.prevD[i] = -1; } }
}
