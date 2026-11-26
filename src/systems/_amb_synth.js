// Ambience synthesis. Owned by systems/ambience.js; rules in _amb_logic.js. Everything goes to game.audio.ambience (so
// it ducks under speech and follows the music/ambience volume) except the player's footsteps and the "busted" sting.
//
//   noise     its own long loops (white 7.3 s, brown 11.9 s), each feed two readings of a loop at unrelated speeds, so
//             no layer repeats itself within minutes (the 2.5 s loops of core/audio.js are kept for the short bursts)
//   layers    air (the city's far hush), wind in leaves, the wind itself in the open, traffic, crowd, water lapping —
//             out of doors; room tone, mains hum, ventilation, the crowd of a room — indoors. A layer at nothing is
//             unplugged from its noise after a few seconds, so it costs nothing until it is wanted again
//   spots     six positioned continuous sources (a weir, a fountain, a pub door, a club wall, a car / bus / bicycle
//             going by): two filtered bands each, placed and levelled by the caller
//   voices    one-shots: birds (recordings where there are any — _amb_samples.js — else synthesised), bells, pages,
//             coughs, cutlery, glasses, footsteps, cricket … each 2-8 short-lived nodes that free themselves
//   buses     out of doors -> `out` (a gain and a low-pass: the wall, the car window) ; indoors -> `inn` ;
//             both -> audio.ambience. Walking through a doorway is those two gains and that cutoff moving: a cross-fade
//             by position, never a switch. `G` holds one gain per family (bed, wind, water, birds, bells, town, spot,
//             people; room, inev, rev, talk) so that tools can measure each by itself
//   reverb    one convolver per kind of room (a small room, a hall, a stone chapel), impulse responses made here;
//             the indoor one-shots and the player's footsteps are sent to it
// A hard cap (MAX_VOICES) on one-shot sources: past it new ones are dropped, never queued.
// Every voice takes an absolute AudioContext time, so tools/smoke_ambience.mjs can render the same code offline.
import { AmbSamples } from './_amb_samples.js';
import { isIndoorEvent, BIRDS } from './_amb_logic.js';

export const LEVEL = { air: 0.085, wind: 0.07, moan: 0.16, traffic: 0.12, crowd: 0.2, water: 0.085, room: 0.11, hum: 0.022, vent: 0.045, crowdIn: 0.2 };
export const MAX_VOICES = 32;
const PEOPLE = 0.028;                   // RMS of a bed of people at level 1, before the buses and the master
const TAU = Math.PI * 2;
const SLEVEL = { blackbird: 0.05, woodpigeon: 0.04, greattit: 0.03, wren: 0.034, crow: 0.045, magpie: 0.036, sparrow: 0.022, gull: 0.045, goose: 0.034, cow: 0.028, horse: 0.03, cheer: 0.05, espresso: 0.03 };
// positioned continuous sources: [hi type, Hz, Q, amount] on the white feed, [lo …] on the brown feed, wobble, level
export const SPOTS = {
  weir: { hi: ['bandpass', 1800, 0.35, 0.5], lo: ['lowpass', 520, 0.5, 1], am: 0.05, level: 0.13 },
  fountain: { hi: ['highpass', 1700, 0.5, 0.45], lo: ['bandpass', 620, 0.8, 0.15], am: 0.2, level: 0.06 },
  lock: { hi: ['bandpass', 2600, 1.0, 0.5], lo: ['lowpass', 300, 0.5, 0], am: 0.25, level: 0.04 },
  pub: { hi: ['bandpass', 1500, 1.2, 0.02], lo: ['bandpass', 520, 0.9, 1], am: 0.32, level: 0.1 },
  cafe: { hi: ['bandpass', 1500, 1.2, 0.015], lo: ['bandpass', 640, 0.8, 0.7], am: 0.3, level: 0.05 },
  club: { hi: ['bandpass', 700, 0.8, 0.01], lo: ['lowpass', 150, 1.0, 1], am: 0.2, level: 0.09 },
  car: { hi: ['bandpass', 1000, 0.45, 0.45], lo: ['lowpass', 170, 0.7, 1], am: 0, level: 0.09 },
  bus: { hi: ['bandpass', 800, 0.45, 0.3], lo: ['lowpass', 130, 0.9, 1.5], am: 0, level: 0.11 },
  bike: { hi: ['bandpass', 3200, 2.0, 0.3], lo: ['lowpass', 200, 0.5, 0], am: 0, level: 0.03 },
  idle: { hi: ['bandpass', 420, 0.8, 0.12], lo: ['lowpass', 95, 1.4, 1.4], am: 0.12, level: 0.1 },        // diesel units standing at a platform
  coach: { hi: ['bandpass', 600, 0.7, 0.15], lo: ['lowpass', 120, 1.2, 1.3], am: 0.1, level: 0.085 },     // coaches with their engines running
};
const REV = { room: { len: 0.45, pre: 0.006, lp: [9000, 3500], wet: 0.5 }, hall: { len: 1.5, pre: 0.016, lp: [8000, 2200], wet: 0.8 }, stone: { len: 3.0, pre: 0.028, lp: [7000, 1500], wet: 1.1 } };

export class AmbSynth {
  constructor(audio) {
    this.audio = audio; this.ctx = audio.ctx; this.bus = audio.ambience || audio.master; this.fx = audio.master;
    this.L = null; this._set = {}; this.live = 0; this.peakLive = 0; this.dropped = 0; this.made = 0;
    this._d = null; this._c = 0; this.G = null; this.samples = null; this._bedNext = 0; this._bedLevel = 0;
  }
  // ---------------------------------------------------------------- the fixed graph
  ensure() {
    if (this.L || !this.ctx) return !!this.L;
    const c = this.ctx, L = (this.L = {}), H = (this.H = {});
    const bq = (type, hz, q) => { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q; return f; };
    const gn = (v = 0) => { const g = c.createGain(); g.gain.value = v; return g; };
    const pn = () => (c.createStereoPanner ? c.createStereoPanner() : gn(1));
    this._bq = bq; this._gn = gn; this._pn = pn;
    // ---- buses and families
    this.out = gn(1); this.outLP = bq('lowpass', 20000, 0.5); this.out.connect(this.outLP); this.outLP.connect(this.bus);
    this.inn = gn(1); this.inn.connect(this.bus);
    const G = (this.G = {});
    for (const k of ['bed', 'wind', 'water', 'birds', 'bells', 'town', 'spot', 'people']) { G[k] = gn(1); G[k].connect(this.out); }
    for (const k of ['room', 'inev', 'rev', 'talk']) { G[k] = gn(1); G[k].connect(this.inn); }
    // ---- noise: long loops, two readings each at unrelated speeds (the sum does not come round again)
    this._noise();
    // (every layer and every spot has readings of its own: two sounds made from the same noise would add up as one
    //  sound, louder than either and in one place. A reading that nothing is plugged into is not computed.)
    let fi = 0; const frac = (x) => x - Math.floor(x);
    const feed = (this._feed = (white, n = 2) => {
      const buf = white ? this.wN : this.bN, g = gn(1 / Math.sqrt(n));
      for (let k = 0; k < n; k++) { const a = c.createBufferSource(); a.buffer = buf; a.loop = true; a.playbackRate.value = 0.64 + 0.42 * frac((fi * 3 + k + 1) * 0.6180339887); a.connect(g); a.start(0, frac((fi * 3 + k + 1) * 0.7548776662) * (buf.duration - 0.1)); L.src.push(a); }
      fi++; return g;
    });
    L.src = [];
    const B1 = feed(false, 3), W = feed(true), Wm = feed(true), Ww = feed(true), Bm = feed(false), Bt = feed(false), Bc = feed(false), Bv = feed(false);
    this.audio.ambNoise = { white: this.wN, brown: this.bN };          // (the weather's rain and wind read the same long loops: _weather_audio.js)
    // ---- a slow irregular wobble (three unrelated rates) for anything that should breathe like a crowd
    const lfo = (this.lfo = gn(1)); L.osc = [];
    for (const [hz, a] of [[3.3, 0.5], [2.13, 0.35], [0.37, 0.3]]) { const o = c.createOscillator(), g = gn(a); o.frequency.value = hz; o.connect(g); g.connect(lfo); o.start(); L.osc.push(o); }
    const layer = (name, group, feeds, tail, pan) => {
      const g = (L[name] = gn(0)); tail.connect(g);
      if (pan) { const p = (L[name + 'Pan'] = pn()); g.connect(p); p.connect(group); } else g.connect(group);
      H[name] = { feeds, on: false, zeroAt: -1 };
    };
    // air: the far-off city hush
    L.airF = bq('lowpass', 420, 0.5); layer('air', G.bed, [[B1, L.airF]], L.airF);
    // wind in leaves: a band of hiss, gusting
    L.windF = bq('bandpass', 2400, 0.5); layer('wind', G.wind, [[W, L.windF]], L.windF);
    // the wind itself, in the open: a low moan that moves with the gusts, and the buffeting under it
    L.moanF = bq('bandpass', 260, 1.1); const mb = bq('lowpass', 110, 0.6), mbg = gn(0.7), mm = gn(1); L.moanF.connect(mm); mb.connect(mbg); mbg.connect(mm);
    layer('moan', G.wind, [[Bm, L.moanF], [Bm, mb]], mm);
    // traffic: low rumble + a little tyre hiss, from the side the road is on
    L.trafF = bq('lowpass', 210, 0.7); L.trafH = bq('bandpass', 1100, 0.6); const th = gn(0.05), tm = gn(1); L.trafF.connect(tm); L.trafH.connect(th); th.connect(tm);
    layer('traffic', G.bed, [[Bt, L.trafF], [Wm, L.trafH]], tm, true);
    // crowd: speech-band murmur wobbling at syllable rate (one chain; heard out of doors and, separately, in a room)
    const c1 = bq('bandpass', 460, 0.9), c2 = bq('bandpass', 1250, 1.1), c2g = gn(0.5), cam = gn(0.7), clg = gn(0.3);
    lfo.connect(clg); clg.connect(cam.gain); c2.connect(c2g); c1.connect(cam); c2g.connect(cam);
    layer('crowd', G.bed, [[Bc, c1], [Bc, c2]], cam, true);
    L.crowdIn = gn(0); cam.connect(L.crowdIn); L.crowdIn.connect(G.room); H.crowdIn = H.crowd;
    // water lapping: a slow double swell on a band of hiss
    const wf = bq('bandpass', 1500, 0.7), wam = gn(0.55), wl = c.createOscillator(), wlg = gn(0.3), wl2 = c.createOscillator(), wl2g = gn(0.15), wl3 = c.createOscillator(), wl3g = gn(0.1);
    wl.frequency.value = 0.31; wl2.frequency.value = 0.83; wl3.frequency.value = 0.127; wl.connect(wlg); wlg.connect(wam.gain); wl2.connect(wl2g); wl2g.connect(wam.gain); wl3.connect(wl3g); wl3g.connect(wam.gain); wl.start(); wl2.start(); wl3.start();
    wf.connect(wam); layer('water', G.water, [[Ww, wf]], wam, true); L.osc.push(wl, wl2, wl3);
    // room tone
    L.roomF = bq('lowpass', 350, 0.5); layer('room', G.room, [[B1, L.roomF]], L.roomF);
    // fridge / chiller hum (mains hum and its harmonic)
    const h1 = c.createOscillator(), h2 = c.createOscillator(), h2g = gn(0.35), hm = gn(1); h1.type = 'triangle'; h1.frequency.value = 100; h2.frequency.value = 200.6;
    h2.connect(h2g); h1.start(); h2.start(); L.osc.push(h1, h2); layer('hum', G.room, [[h1, hm], [h2g, hm]], hm);
    // ventilation: an extractor, chiller fans, air handling
    const v1 = bq('bandpass', 190, 0.8), v2 = bq('lowpass', 1400, 0.5), v2g = gn(0.1), vm = gn(1); v1.connect(vm); v2.connect(v2g); v2g.connect(vm);
    layer('vent', G.room, [[Bv, v1], [Wm, v2]], vm);
    // ---- positioned continuous sources
    this.slots = [];
    for (let i = 0; i < 6; i++) {
      const s = { hiF: bq('bandpass', 1000, 0.5), hiG: gn(0), loF: bq('lowpass', 200, 0.5), loG: gn(0), am: gn(1), amD: gn(0), g: gn(0), p: pn(), on: false, kind: null, v: 0, zeroAt: -1, cut: 0, W: null, B: null };
      s.hiF.connect(s.hiG); s.hiG.connect(s.am); s.loF.connect(s.loG); s.loG.connect(s.am); lfo.connect(s.amD); s.amD.connect(s.am.gain); s.am.connect(s.g); s.g.connect(s.p); s.p.connect(G.spot);
      this.slots.push(s);
    }
    // ---- the player's own feet: straight to the effects bus, and (indoors) into the room
    this.steps = gn(1); this.steps.connect(this.fx); this.stepSend = gn(0);
    this.rv = []; this.rvType = 'dry'; this.rvIn = gn(1); G.inev.connect(this.rvIn); this.steps.connect(this.stepSend); this.stepSend.connect(this.rvIn);
    // ---- the distant chorus bed (a recording, when it is here)
    // (voices and anything else made elsewhere can be sent into the room too: core/audio.js spatial() connects to audio.reverbIn)
    this.voiceSend = gn(0); this.voiceSend.connect(this.rvIn); this.audio.reverbIn = this.voiceSend;
    this.bedG = gn(0); this.bedG.connect(G.birds);
    this.beds = {};                                                    // people talking (recordings): people()
    if (!this.samples) this.samples = new AmbSamples(this.audio);
    return true;
  }
  _noise() {
    const c = this.ctx, sr = c.sampleRate;
    let s = 0x9e3779b9; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
    const nW = Math.floor(sr * 7.3), w = (this.wN = c.createBuffer(1, nW, sr)).getChannelData(0);
    for (let i = 0; i < nW; i++) w[i] = rnd();
    const nB = Math.floor(sr * 11.9), xf = Math.floor(sr * 0.08), b = (this.bN = c.createBuffer(1, nB, sr)).getChannelData(0), tmp = new Float32Array(nB + xf);
    let v = 0, mean = 0;
    for (let i = 0; i < nB + xf; i++) { v = v * 0.985 + rnd() * 0.12; tmp[i] = v; mean += v; }
    mean /= nB + xf;
    for (let i = 0; i < nB; i++) b[i] = tmp[i] - mean;
    for (let i = 0; i < xf; i++) { const k = i / xf; b[i] = (tmp[i] - mean) * k + (tmp[nB + i] - mean) * (1 - k); }      // the overhang cross-faded into the head: a seamless loop
    mean = 0; for (let i = 0; i < nB; i++) mean += b[i]; mean /= nB; for (let i = 0; i < nB; i++) b[i] -= mean;
  }
  _plug(h, on) { if (h.on === on) return; h.on = on; for (const [a, b] of h.feeds) { try { if (on) a.connect(b); else a.disconnect(b); } catch { /* */ } } }
  _lay(k, v, t, tc) {
    const S = this._set, h = this.H[k];
    if (v > 0.0004) { h.zeroAt = -1; this._plug(h, true); }
    if (S[k] === undefined || Math.abs(S[k] - v) > 0.004 || (v === 0 && S[k] !== 0)) { S[k] = v; this.L[k].gain.setTargetAtTime(v, t, tc); }
  }
  /** unplug the noise from every layer and spot that has been at nothing for 4 s (called by apply) */
  _sleep(t) {
    const S = this._set;
    for (const k in this.H) {
      if (k === 'crowdIn') continue;
      const h = this.H[k], quiet = !(S[k] > 0.0004) && !(k === 'crowd' && S.crowdIn > 0.0004);
      if (!quiet) { h.zeroAt = -1; continue; }
      if (h.zeroAt < 0) h.zeroAt = t; else if (h.on && t - h.zeroAt > 4) this._plug(h, false);
    }
    for (const s of this.slots) { if (s.v > 0.0004) { s.zeroAt = -1; continue; } if (s.zeroAt < 0) s.zeroAt = t; else if (s.on && t - s.zeroAt > 3) { s.on = false; try { s.W.disconnect(s.hiF); s.B.disconnect(s.loF); } catch { /* */ } if (s.h) { s.h.free(); s.h = null; try { s.g.disconnect(); } catch { /* */ } s.g.connect(s.p); } } }
  }
  /** out of doors: mix = amounts 0..1 per layer (_amb_logic outdoorMix), gust 0..1 (slow wind swell), tc = easing seconds */
  applyOut(mix, gust = 0.5, tc = 0.6) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime, L = this.L, S = this._set;
    this._lay('air', mix.air * LEVEL.air, t, tc);
    this._lay('wind', Math.min(2.4, mix.wind) * LEVEL.wind * (0.35 + 1.0 * gust), t, tc);
    this._lay('moan', Math.min(1.4, mix.moan || 0) * LEVEL.moan * (0.4 + 0.9 * gust), t, Math.min(tc, 0.5));
    this._lay('traffic', mix.traffic * LEVEL.traffic, t, tc);
    this._lay('crowd', mix.crowd * LEVEL.crowd, t, tc);
    this._lay('water', Math.min(1.5, mix.water) * LEVEL.water, t, tc);
    const wf = 1800 + 1600 * gust - 500 * (mix.wetLeaves || 0); if (S.wf === undefined || Math.abs(S.wf - wf) > 60) { S.wf = wf; L.windF.frequency.setTargetAtTime(wf, t, 1.2); }
    const mf = 190 + 230 * gust; if (S.mf === undefined || Math.abs(S.mf - mf) > 12) { S.mf = mf; L.moanF.frequency.setTargetAtTime(mf, t, 0.9); }
    this._sleep(t);
  }
  /** indoors: mix = _amb_logic placeProfile (room, roomCut, hum, vent, crowd), all scaled by k (how far into the room you are) */
  applyIn(mix, k = 1, tc = 0.6) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime, S = this._set;
    this._lay('room', (mix ? mix.room : 0) * k * LEVEL.room, t, tc);
    this._lay('hum', (mix ? mix.hum : 0) * k * LEVEL.hum, t, tc);
    this._lay('vent', (mix ? mix.vent || 0 : 0) * k * LEVEL.vent, t, tc);
    const ci = (mix ? mix.crowd : 0) * k * LEVEL.crowdIn;
    if (ci > 0.0004) this._plug(this.H.crowd, true);
    if (S.crowdIn === undefined || Math.abs(S.crowdIn - ci) > 0.004 || (ci === 0 && S.crowdIn !== 0)) { S.crowdIn = ci; this.L.crowdIn.gain.setTargetAtTime(ci, t, tc); }
    const rc = (mix && mix.roomCut) || 350; if (S.rc !== rc) { S.rc = rc; this.L.roomF.frequency.setTargetAtTime(rc, t, tc); }
  }
  /**
   * One mix, as the first version of this class took it (tools/audio/harness.js still does): an outdoor mix (leak 1)
   * or a room's profile (leak < 1) by itself, the buses wide open.
   */
  apply(mix, gust = 0.5, tc = 0.6) {
    if (!this.ensure()) return;
    const indoor = mix.leak !== undefined && mix.leak < 1;
    if (indoor) { this.applyOut({ air: mix.air, wind: 0, moan: 0, traffic: mix.traffic, crowd: 0, water: 0 }, gust, tc); this.applyIn(mix, 1, tc); }
    else { this.applyOut(mix, gust, tc); this.applyIn(null, 0, tc); }
  }
  /** the two buses: how loud and how dull the outdoors is heard (through a wall, a window, an open door), how present the room is */
  scene(outGain, outCut, inGain, tc = 0.4) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime, S = this._set;
    if (S.og === undefined || Math.abs(S.og - outGain) > 0.003) { S.og = outGain; this.out.gain.setTargetAtTime(outGain, t, tc); }
    if (S.oc === undefined || Math.abs(S.oc - outCut) > S.oc * 0.03) { S.oc = outCut; this.outLP.frequency.setTargetAtTime(Math.max(120, Math.min(20000, outCut)), t, tc); }
    if (S.ig === undefined || Math.abs(S.ig - inGain) > 0.003) { S.ig = inGain; this.inn.gain.setTargetAtTime(inGain, t, tc); }
  }
  /** where a panned layer comes from: k = 'traffic' | 'crowd' | 'water', pan −1..1 */
  pan(k, pan) { const p = this.L && this.L[k + 'Pan']; if (!p || !p.pan) return; const S = this._set, key = k + 'P'; if (S[key] === undefined || Math.abs(S[key] - pan) > 0.03) { S[key] = pan; p.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.5); } }
  /**
   * Positioned continuous source i (0..5): kind = a key of SPOTS (or null: fade it out), gain 0..1 (distance already
   * in it), pan −1..1, dull 0..1 (distance / a building in the way: closes the bright band). A slot only changes kind
   * once it has faded to nothing. -> true when the slot is (or has become) that kind
   */
  spot(i, kind, gain = 0, pan = 0, dull = 0, tc = 0.35, pos = null) {
    if (!this.ensure()) return false;
    const s = this.slots[i], t = this.ctx.currentTime;
    if (kind && s.kind !== kind) {
      if (s.v > 0.0004 && s.kind) { s.v = 0; s.g.gain.setTargetAtTime(0, t, 0.15); s.zeroAt = t; return false; }
      if (s.kind && s.zeroAt >= 0 && t - s.zeroAt < 0.7) return false;                    // (still dying away)
      const P = SPOTS[kind]; if (!P) return false;
      s.kind = kind; s.hiF.type = P.hi[0]; s.hiF.frequency.value = P.hi[1]; s.hiF.Q.value = P.hi[2]; s.loF.type = P.lo[0]; s.loF.frequency.value = P.lo[1]; s.loF.Q.value = P.lo[2];
      s.loG.gain.value = P.lo[3]; s.amD.gain.value = P.am; s.hi = P.hi[3]; s.cut = -1;
    }
    const P = kind ? SPOTS[kind] : null, v = P ? Math.max(0, gain) * P.level : 0;
    if (v > 0.0004 && !s.on) { s.on = true; if (!s.W) { s.W = this._feed(true); s.B = this._feed(false); } s.W.connect(s.hiF); s.B.connect(s.loF); }
    if (pos && v > 0.0004) {      // placed in the world (binaural on headphones); the stereo panner is left out of the path
      if (!s.h && this.audio.spatial) { s.h = this.audio.spatial({ x: pos[0], y: pos[1], z: pos[2] }, { dist: false, dest: this.G.spot, cls: 'water', dy: 0, occlude: false }); if (s.h) { try { s.g.disconnect(); } catch { /* */ } s.g.connect(s.h.in); } }
      else if (s.h) s.h.set(pos[0], pos[1], pos[2]);
    }
    if (Math.abs(v - s.v) > 0.002 || (v === 0 && s.v !== 0)) { if (v === 0) s.zeroAt = t; s.v = v; s.g.gain.setTargetAtTime(v, t, tc); }
    if (P) {
      const d = Math.max(0, Math.min(1, dull)); if (Math.abs(d - s.cut) > 0.04) { s.cut = d; s.hiG.gain.setTargetAtTime(s.hi * (1 - 0.85 * d), t, tc); }
      if (s.p.pan && Math.abs((s.pv ?? 9) - pan) > 0.02) { s.pv = pan; s.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, Math.min(tc, 0.2)); }
    }
    return true;
  }
  silence(tc = 0.4) {
    if (!this.L) return; const t = this.ctx.currentTime;
    for (const k of Object.keys(LEVEL)) { this.L[k].gain.setTargetAtTime(0, t, tc); this._set[k] = 0; }
    for (const s of this.slots) { s.g.gain.setTargetAtTime(0, t, tc); s.v = 0; }
    this.bedG.gain.setTargetAtTime(0, t, tc); this._bedLevel = 0;
  }
  dispose() { if (!this.L) return; for (const s of [...this.L.src, ...this.L.osc]) { try { s.stop(); s.disconnect(); } catch { /* */ } } try { this.out.disconnect(); this.inn.disconnect(); } catch { /* */ } this.L = null; }

  // ---------------------------------------------------------------- the room's reverberation
  _ir(type) {
    const c = this.ctx, sr = c.sampleRate, P = REV[type], n = Math.floor(sr * (P.len + P.pre)), pre = Math.floor(sr * P.pre), buf = c.createBuffer(2, n, sr);
    let s = type === 'room' ? 0x1234567 : type === 'hall' ? 0x7654321 : 0x2468ace; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch), dk = Math.exp(-6.9 / (n - pre)), on = sr * 0.004; let lp = 0, e = 0, a = 1, env = 1;
      for (let i = pre; i < n; i++) {
        if (((i - pre) & 255) === 0) { const u = (i - pre) / (n - pre); a = 1 - Math.exp((-TAU * P.lp[0] * Math.pow(P.lp[1] / P.lp[0], u)) / sr); }      // (the tail darkens as it dies)
        lp += (rnd() - lp) * a; const v = lp * env * Math.min(1, (i - pre) / on); env *= dk; d[i] = v; e += v * v;
      }
      const k = 1 / Math.sqrt(e || 1); for (let i = pre; i < n; i++) d[i] *= k;      // unit energy: `wet` is then the level of the tail against the dry sound
    }
    return buf;
  }
  /** the room you are in: type 'dry' | 'room' | 'hall' | 'stone', send 0..1 (how much of the one-shots and footsteps go into it) */
  room(type, send = 0, tc = 0.4) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime, c = this.ctx;
    if (!REV[type]) { type = 'dry'; send = 0; }
    if (type !== 'dry' && !this.rv.some((r) => r.type === type)) {      // one convolver per kind of room, made the first time you are in one (a tail is never cut off by a change of room)
      const r = { conv: c.createConvolver(), g: this._gn(0), o: this._gn(REV[type].wet), v: 0, type };
      r.conv.normalize = false; r.conv.buffer = this._ir(type); this.rvIn.connect(r.g); r.g.connect(r.conv); r.conv.connect(r.o); r.o.connect(this.G.rev); this.rv.push(r);
    }
    for (const r of this.rv) { const v = r.type === type ? send : 0; if (Math.abs(v - r.v) > 0.01 || (v === 0 && r.v !== 0)) { r.v = v; r.g.gain.setTargetAtTime(v, t, tc); } }
    const ss = type === 'dry' ? 0 : send * 0.8; if (Math.abs(ss - (this._ss || 0)) > 0.01) { this._ss = ss; this.stepSend.gain.setTargetAtTime(ss, t, tc); this.voiceSend.gain.setTargetAtTime(ss * 0.6, t, tc); }
    this.rvType = type;
  }

  // ---------------------------------------------------------------- voice plumbing
  _out(node, pan, dest) {
    const c = this.ctx; let tail = node;
    if (!isFinite(pan)) pan = 0;
    if (!dest && this._c > 0 && this._c < 12000 && isFinite(this._c)) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this._c; f.Q.value = 0.5; tail.connect(f); tail = f; }
    const sp = !dest ? this._sp : null;
    if (sp) { tail.connect(sp.in); sp.n++; return { disconnect: () => { if (--sp.n <= 0) sp.free(); } }; }      // a place in the world (core/audio.js spatial): every voice of the event comes from it
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); tail.connect(p); tail = p; }
    tail.connect(dest || this._d || this.bus);
    return tail;
  }
  _end(src, tail) { this.live++; this.made++; if (this.live > this.peakLive) this.peakLive = this.live; src.onended = () => { this.live--; try { tail.disconnect(); } catch { /* */ } }; }
  /** one oscillator with a gain envelope; shape(freqParam, gainParam, t) writes the automation; ends at t + dur */
  _voice(type, t, dur, pan, shape, dest = null, filter = null) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; g.gain.value = 0; g.gain.setValueAtTime(0, t);
    shape(o.frequency, g.gain, t);
    g.gain.setValueAtTime(0, t + dur);
    if (filter) { const f = c.createBiquadFilter(); f.type = filter[0]; f.frequency.value = filter[1]; f.Q.value = filter[2]; o.connect(f); f.connect(g); } else o.connect(g);
    const tail = this._out(g, pan, dest); o.start(t); o.stop(t + dur + 0.03); this._end(o, tail);
    return o;
  }
  /** a slice of the shared noise through a filter with a gain envelope written by shape(gainParam, t, filterFreqParam) */
  _burst(t, dur, ftype, hz, q, pan, shape, dest = null) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.audio.noiseBuf; s.loop = true; f.type = ftype; f.frequency.setValueAtTime(hz, t); f.Q.value = q; g.gain.value = 0; g.gain.setValueAtTime(0, t);
    shape(g.gain, t, f.frequency); g.gain.setValueAtTime(0, t + dur);
    s.connect(f); f.connect(g); const tail = this._out(g, pan, dest); s.start(t, (t * 3.7) % 2); s.stop(t + dur + 0.03); this._end(s, tail);
  }
  /** run fn with its voices sent to family `group` (a key of G) and dulled to `cut` Hz (0 = not) */
  to(group, cut, fn, pos = null) { this._d = this.G ? this.G[group] : null; this._c = cut; this._place(pos, this._d, group === 'bells' ? 'bell' : 'small'); try { fn(); } finally { this._unplace(); this._d = null; this._c = 0; } }
  /** pos = [x, y, z] in the listener's frame: the voices made until _unplace() all sound from there (direction only: the caller's gain has the distance) */
  _place(pos, dest, cls) { this._sp = pos && this.audio.spatial ? this.audio.spatial({ x: pos[0], y: pos[1], z: pos[2] }, { dist: false, dest: dest || this.bus, cls, dy: 0, occlude: false }) : null; if (this._sp) this._sp.n = 0; }
  _unplace() { const sp = this._sp; this._sp = null; if (sp && sp.n <= 0) sp.free(); }
  _blip(G, t, a, peak, dur) { G.setValueAtTime(0, t); G.linearRampToValueAtTime(peak, t + a); G.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.01), t + dur); G.linearRampToValueAtTime(0, t + dur + 0.01); }
  /** a phrase of a recorded species (random phrase, a slightly different bird each time) -> false when the recording is not here */
  _samp(name, t, gain, pan, r, which = -1) {
    const S = this.samples && this.samples.get(name); if (!S || !S.slices) return false;
    const c = this.ctx, sl = S.slices[which >= 0 ? which % S.slices.length : Math.floor(r() * S.slices.length) % S.slices.length];
    const src = c.createBufferSource(), g = c.createGain(), rate = 0.96 + 0.08 * r(), v = (gain * (SLEVEL[name] || 0.04)) / Math.max(0.02, sl[2]), dur = sl[1] / rate;
    src.buffer = S.buf; src.playbackRate.value = rate;
    g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.setValueAtTime(v, t + dur - 0.06); g.gain.linearRampToValueAtTime(0, t + dur - 0.005);
    src.connect(g); const tail = this._out(g, pan, null); src.start(t, sl[0] + 0.01, sl[1]); src.stop(t + dur + 0.02); this._end(src, tail);
    return true;
  }
  /**
   * The distant dawn chorus (a recording): level 0..1. Played as overlapping stretches of 16–24 s, each from a
   * different place in the recording, cross-faded over 3 s — it never comes round. Call every slow tick.
   */
  bed(level, lookahead = 0.6) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime, S = level > 0.003 ? this.samples.get('dawn') : null;
    const v = S ? (level * 0.03) / Math.max(0.01, S.rms) : 0;
    if (Math.abs(v - this._bedLevel) > 0.002 || (v === 0 && this._bedLevel !== 0)) { this._bedLevel = v; this.bedG.gain.setTargetAtTime(v, t, 1.5); }
    if (!S || v === 0) { if (this._bedNext < t - 30) this._bedNext = 0; return; }
    if (this._bedNext < t) this._bedNext = t + 0.05;
    if (this._bedNext - t > lookahead) return;
    const c = this.ctx, XF = 3, len = 16 + 8 * Math.random(), off = Math.random() * Math.max(0, S.buf.duration - len - 0.5), at = this._bedNext;
    const src = c.createBufferSource(), g = c.createGain(); src.buffer = S.buf;
    g.gain.value = 0; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + XF); g.gain.setValueAtTime(1, at + len - XF); g.gain.linearRampToValueAtTime(0, at + len);
    src.connect(g); g.connect(this.bedG); src.start(at, off, len + 0.1); src.stop(at + len + 0.1); this._end(src, g);
    this._bedNext = at + len - XF;
  }

  /**
   * People talking (recordings): `key` names one continuous bed ('out', 'in:pub', 'door1' …), `names` the recordings it
   * may draw on, level 0..1, pan, cut (Hz: a door, a wall, distance), `group` the family it sounds in, streams 1 | 2
   * (two overlapping, from different recordings where there are several: a dense crowd). Played as stretches of
   * 12-20 s from random places in a recording chosen afresh each time, cross-faded over 3 s — never a loop.
   * Call every slow tick while wanted (and once with level 0 when not). -> true when a recording is here to play
   * (false: none decoded yet — the caller keeps its synthesised murmur meanwhile).
   */
  people(key, names, level, pan = 0, cut = 20000, group = 'bed', streams = 1, tc = 0.8, pos = null) {
    if (!this.ensure()) return false;
    const c = this.ctx, t = c.currentTime;
    let B = this.beds[key];
    if (!B) {
      if (!(level > 0.003)) return false;
      B = this.beds[key] = { g: this._gn(0), f: this._bq('lowpass', 20000, 0.5), p: this._pn(), v: 0, cut: 20000, pan: 0, next: [0, 0], last: null };
      B.f.connect(B.g); B.g.connect(B.p); B.p.connect(group === 'room' ? this.G.talk : this.G.people);      // (families of their own: 'people' out of doors, 'talk' in a room)
    }
    const PV = this._pv || (this._pv = []); let n = 0;
    if (level > 0.003) for (let i = 0; i < names.length; i++) { const S = this.samples.get(names[i]); if (S && S.bed) PV[n++] = S; }
    const v = n ? Math.min(1.5, level) : 0;
    if (Math.abs(v - B.v) > 0.004 || (v === 0 && B.v !== 0)) { B.v = v; B.g.gain.setTargetAtTime(v, t, tc); }
    if (Math.abs(cut - B.cut) > B.cut * 0.04) { B.cut = cut; B.f.frequency.setTargetAtTime(Math.max(150, Math.min(20000, cut)), t, Math.min(tc, 0.4)); }
    if (pos && v > 0) { if (!B.h && this.audio.spatial) { B.h = this.audio.spatial({ x: pos[0], y: pos[1], z: pos[2] }, { dist: false, dest: this.G.people, cls: 'voice', dy: 0, occlude: false }); if (B.h) { try { B.g.disconnect(); } catch { /* */ } B.g.connect(B.h.in); } } else if (B.h) B.h.set(pos[0], pos[1], pos[2]); }
    else if (B.h && v === 0 && B.v === 0 && B.next[0] < t - 6) { B.h.free(); B.h = null; try { B.g.disconnect(); } catch { /* */ } B.g.connect(B.p); }      // (a bed that has died away gives its place back)
    if (B.p.pan && Math.abs(pan - B.pan) > 0.03) { B.pan = pan; B.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.4); }
    if (!n || v === 0) return n > 0;
    for (let s = 0; s < streams; s++) {
      if (B.next[s] < t) B.next[s] = t + 0.05 + s * 4.5;
      if (B.next[s] - t > 0.7 || this.live >= MAX_VOICES + 4) continue;
      let S = PV[Math.floor(Math.random() * n) % n]; if (n > 1 && S === B.last) S = PV[(PV.indexOf(S) + 1) % n];      // (not the same recording twice running)
      B.last = S;
      const XF = 3, D = S.buf.duration, len = Math.min(D - 0.3, 12 + 8 * Math.random()), off = Math.random() * Math.max(0, D - len - 0.2), at = B.next[s], k = Math.min(1.3, PEOPLE / Math.max(0.01, S.rms));      // (a recording with sharp peaks in it — glasses — is not turned up until they bite)
      const src = c.createBufferSource(), g = c.createGain(); src.buffer = S.buf; src.playbackRate.value = 0.97 + 0.06 * Math.random();
      g.gain.value = 0; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(k, at + XF); g.gain.setValueAtTime(k, at + len - XF); g.gain.linearRampToValueAtTime(0, at + len);
      src.connect(g); g.connect(B.f); src.start(at, off); src.stop(at + len + 0.05); this._end(src, g);
      B.next[s] = at + len - XF;
    }
    return true;
  }
  /** every bed of people but those whose key is in `keep` falls silent (the place changed) */
  peopleOff(keep) { const t = this.ctx.currentTime; for (const k in this.beds) { const B = this.beds[k]; if (B.v !== 0 && !(keep && keep.includes(k))) { B.v = 0; B.g.gain.setTargetAtTime(0, t, 0.6); } } }

  // ---------------------------------------------------------------- birds
  /** small garden birds: a great tit's two notes, sparrows cheeping, a wren (recorded); else cheeps, "tea-cher", a falling trill */
  songbird(t, gain, pan, r) {
    const u = r();
    if (u < 0.4 ? this._samp('greattit', t, gain, pan, r) : u < 0.75 ? this._samp('sparrow', t, gain, pan, r) : this._samp('wren', t, gain * 0.8, pan, r)) return;
    this._chirps(t, gain, pan, r, Math.floor(r() * 3));
  }
  _chirps(t, gain, pan, r, kind) {
    const base = 3000 + r() * 2400, g = gain * 0.05;
    const n = kind === 0 ? 2 + Math.floor(r() * 4) : kind === 1 ? 4 + 2 * Math.floor(r() * 3) : 7 + Math.floor(r() * 5);
    const step = kind === 0 ? 0.13 + r() * 0.08 : kind === 1 ? 0.17 : 0.062, dur = n * step + 0.05;
    this._voice('sine', t, dur, pan, (F, G) => {
      for (let i = 0; i < n; i++) {
        const u = t + i * step * (kind === 0 ? 0.85 + 0.3 * r() : 1), len = kind === 2 ? 0.04 : 0.075;
        const f = kind === 0 ? base * (1 + 0.05 * (r() - 0.5)) : kind === 1 ? (i % 2 ? base * 0.78 : base) : base * 1.5 * Math.pow(0.955, i);
        F.setValueAtTime(f * (kind === 0 ? 1.18 : 1.04), u); F.exponentialRampToValueAtTime(f * (kind === 0 ? 0.85 : 0.97), u + len);
        G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * (kind === 2 ? 0.5 + 0.5 * (i / n) : 1), u + 0.008); G.linearRampToValueAtTime(0, u + len);
      }
    });
  }
  tit(t, gain, pan, r) { if (!this._samp('greattit', t, gain, pan, r)) this._chirps(t, gain, pan, r, 1); }
  sparrow(t, gain, pan, r) { if (!this._samp('sparrow', t, gain, pan, r)) this._chirps(t, gain, pan, r, 0); }
  wren(t, gain, pan, r) { if (!this._samp('wren', t, gain, pan, r)) { this._chirps(t, gain, pan, r, 2); this._chirps(t + 0.75, gain, pan, r, 2); } }
  /** blackbird: unhurried fluty phrases with a scratchy little flourish at the end */
  blackbird(t, gain, pan, r) {
    if (this._samp('blackbird', t, gain, pan, r)) return;
    const n = 4 + Math.floor(r() * 4), g = gain * 0.075; let u = t;
    const notes = []; for (let i = 0; i < n; i++) notes.push([1700 + r() * 1200, 0.13 + r() * 0.17, 0.03 + r() * 0.05]);
    const total = notes.reduce((s, x) => s + x[1] + x[2], 0) + 0.3;
    this._voice('sine', t, total, pan, (F, G) => {
      for (const [f, len, gap] of notes) {
        F.setValueAtTime(f * (0.94 + r() * 0.12), u); F.linearRampToValueAtTime(f, u + len * 0.4); F.linearRampToValueAtTime(f * (0.9 + r() * 0.25), u + len);
        G.setValueAtTime(0, u); G.linearRampToValueAtTime(g, u + 0.02); G.setValueAtTime(g, u + len - 0.03); G.linearRampToValueAtTime(0, u + len);
        u += len + gap;
      }
      for (let i = 0; i < 3; i++) { const f = 4200 + r() * 2200; F.setValueAtTime(f, u); F.linearRampToValueAtTime(f * 1.15, u + 0.05); G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * 0.3, u + 0.008); G.linearRampToValueAtTime(0, u + 0.055); u += 0.07; }
    });
  }
  /** blackbird going to roost, or put up: "chink, chink, chink-chink-chink" */
  chink(t, gain, pan, r) {
    const n = 3 + Math.floor(r() * 7), g = gain * 0.045, f0 = 2500 + r() * 500; let u = t, gap = 0.3 + r() * 0.2;
    const at = []; for (let i = 0; i < n; i++) { at.push(u); u += gap * (0.8 + 0.4 * r()); gap = Math.max(0.12, gap * 0.9); }
    this._voice('triangle', t, u - t + 0.1, pan, (F, G) => {
      for (const w of at) { F.setValueAtTime(f0 * 1.25, w); F.exponentialRampToValueAtTime(f0, w + 0.03); F.exponentialRampToValueAtTime(f0 * 0.8, w + 0.07); G.setValueAtTime(0, w); G.linearRampToValueAtTime(g, w + 0.004); G.exponentialRampToValueAtTime(g * 0.02, w + 0.07); G.linearRampToValueAtTime(0, w + 0.08); }
    }, null, ['highpass', 1800, 0.7]);
  }
  /** robin: thin, high, wistful ripples */
  robin(t, gain, pan, r) {
    // (no free recording was found: a phrase is 5-10 syllables of three kinds — a short thin "tsee", a slurred whistle,
    //  a shivering trill — wandering between 2.6 and 7.8 kHz, with the odd held breath between them)
    const n = 5 + Math.floor(r() * 6), g = gain * 0.035; let u = t, f = 3600 + r() * 2200;
    const syl = []; let total = 0.06;
    for (let i = 0; i < n; i++) { const q = r(), kind = q < 0.28 ? 2 : q < 0.6 ? 1 : 0, len = kind === 2 ? 0.16 + r() * 0.18 : kind === 1 ? 0.11 + r() * 0.16 : 0.05 + r() * 0.07, gap = 0.02 + r() * 0.05 + (r() < 0.15 ? 0.13 : 0); syl.push([kind, len, gap]); total += len + gap; }
    this._voice('sine', t, total, pan, (F, G) => {
      for (const [kind, len, gap] of syl) {
        f = Math.max(2600, Math.min(7800, f * (0.7 + r() * 0.75)));
        const v = g * (0.55 + 0.45 * r());
        if (kind === 2) { const dep = 0.05 + r() * 0.1, m = Math.max(4, Math.floor(len * (24 + r() * 16))); F.setValueAtTime(f * (1 - dep), u); for (let k = 1; k <= m; k++) F.linearRampToValueAtTime(f * (k % 2 ? 1 + dep : 1 - dep), u + (k / m) * len); }
        else if (kind === 1) { F.setValueAtTime(f, u); F.exponentialRampToValueAtTime(f * (0.75 + r() * 0.6), u + len); }
        else { F.setValueAtTime(f * 1.1, u); F.linearRampToValueAtTime(f, u + len); }
        G.setValueAtTime(0, u); G.linearRampToValueAtTime(v, u + 0.012); G.setValueAtTime(v, u + len - 0.02); G.linearRampToValueAtTime(0, u + len);
        u += len + gap;
      }
    });
  }
  /** wood pigeon: hoo-HOOO-hoo, hoo-hoo */
  pigeon(t, gain, pan, r) {
    if (this._samp('woodpigeon', t, gain, pan, r)) return;
    const f0 = 440 + r() * 50, g = gain * 0.1, pat = [[0.2, 0.7], [0.46, 1], [0.3, 0.8], [0.22, 0.7], [0.24, 0.75]], reps = 1 + Math.floor(r() * 2);
    let u = t; const dur = reps * 2.1 + 0.1;
    this._voice('sine', t, dur, pan, (F, G) => {
      for (let k = 0; k < reps; k++) for (let i = 0; i < pat.length; i++) {
        const [len, v] = pat[i];
        F.setValueAtTime(f0 * 0.96, u); F.linearRampToValueAtTime(f0 * (i === 1 ? 1.06 : 1), u + len * 0.3); F.linearRampToValueAtTime(f0 * 0.93, u + len);
        G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * v, u + 0.05); G.setValueAtTime(g * v, u + len - 0.06); G.linearRampToValueAtTime(0, u + len);
        u += len + (i === 2 ? 0.22 : 0.07);
      }
    }, null, ['lowpass', 900, 0.7]);
  }
  /** tawny owl: hooo … hu, hu-hu-hooooo */
  owl(t, gain, pan, r) {
    const f0 = 350 + r() * 50, g = gain * 0.1;
    this._voice('sine', t, 3.6, pan, (F, G) => {
      F.setValueAtTime(f0 * 0.9, t); F.linearRampToValueAtTime(f0, t + 0.15); F.linearRampToValueAtTime(f0 * 0.92, t + 0.7);
      G.linearRampToValueAtTime(g, t + 0.1); G.setValueAtTime(g, t + 0.5); G.linearRampToValueAtTime(0, t + 0.75);
      let u = t + 2.0;
      G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * 0.6, u + 0.04); G.linearRampToValueAtTime(0, u + 0.14); F.setValueAtTime(f0, u);
      u += 0.34;
      for (let i = 0; i < 6; i++) { const v = g * (0.5 + 0.1 * i), w = u + i * 0.11; G.setValueAtTime(v * 0.25, w); G.linearRampToValueAtTime(v, w + 0.04); G.linearRampToValueAtTime(v * 0.3, w + 0.1); }
      F.setValueAtTime(f0 * 1.03, u); F.linearRampToValueAtTime(f0 * 0.9, u + 1.2);
      G.linearRampToValueAtTime(g, u + 0.75); G.linearRampToValueAtTime(0, u + 1.2);
    }, null, ['lowpass', 800, 0.7]);
  }
  /** the hen tawny: "ke-wick" */
  kewick(t, gain, pan, r) {
    const f0 = 1050 + r() * 150, g = gain * 0.05, n = 1 + Math.floor(r() * 2);
    this._voice('triangle', t, n * 0.9 + 0.1, pan, (F, G) => {
      for (let i = 0; i < n; i++) {
        const u = t + i * 0.9;
        F.setValueAtTime(f0 * 0.8, u); F.linearRampToValueAtTime(f0, u + 0.09); F.setValueAtTime(f0 * 1.1, u + 0.16); F.exponentialRampToValueAtTime(f0 * 1.75, u + 0.3); F.linearRampToValueAtTime(f0 * 1.5, u + 0.4);
        G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * 0.6, u + 0.03); G.linearRampToValueAtTime(g * 0.15, u + 0.13); G.linearRampToValueAtTime(g, u + 0.22); G.linearRampToValueAtTime(0, u + 0.42);
      }
    }, null, ['lowpass', 2600, 0.7]);
  }
  /** mallard: QUACK quack quack */
  duck(t, gain, pan, r) {
    const n = 2 + Math.floor(r() * 3), p = 0.92 + r() * 0.16, g = gain * 0.16;
    this._voice('sawtooth', t, n * 0.24 + 0.05, pan, (F, G) => {
      for (let i = 0; i < n; i++) { const u = t + i * 0.24, len = 0.19 - i * 0.012; F.setValueAtTime(300 * p * (1 - i * 0.04), u); F.exponentialRampToValueAtTime(215 * p * (1 - i * 0.05), u + len); G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * (1 - i * 0.16), u + 0.012); G.setValueAtTime(g * (1 - i * 0.16), u + len * 0.45); G.linearRampToValueAtTime(0, u + len); }
    }, null, ['bandpass', 1150, 3.2]);
  }
  /** moorhen: a sudden bubbling "kurruk" from the reeds */
  moorhen(t, gain, pan, r) {
    const g = gain * 0.05, f0 = 1500 + r() * 300, n = 4 + Math.floor(r() * 3);
    this._voice('sawtooth', t, n * 0.045 + 0.1, pan, (F, G) => {
      for (let i = 0; i < n; i++) { const u = t + i * 0.045; F.setValueAtTime(f0 * (1.3 - 0.06 * i), u); F.exponentialRampToValueAtTime(f0 * (0.9 - 0.03 * i), u + 0.035); G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * (i < 2 ? 1 : 1 - (i - 1) / n), u + 0.004); G.linearRampToValueAtTime(0, u + 0.04); }
    }, null, ['bandpass', 2000, 2.5]);
  }
  /** carrion crow: kraa, kraa, kraa */
  crow(t, gain, pan, r) {
    if (this._samp('crow', t, gain, pan, r)) return;
    const n = 2 + Math.floor(r() * 3), g = gain * 0.09, f0 = 430 + r() * 90;
    for (let i = 0; i < n; i++) {
      const u = t + i * (0.5 + r() * 0.08), len = 0.3 + r() * 0.08;
      this._voice('sawtooth', u, len + 0.02, pan, (F, G) => { F.setValueAtTime(f0 * 1.08, u); F.linearRampToValueAtTime(f0, u + len * 0.3); F.linearRampToValueAtTime(f0 * 0.82, u + len); G.linearRampToValueAtTime(g, u + 0.025); G.setValueAtTime(g, u + len * 0.55); G.linearRampToValueAtTime(0, u + len); }, null, ['bandpass', 1500, 1.6]);
      this._burst(u, len, 'bandpass', 1700, 1.2, pan, (G) => { G.linearRampToValueAtTime(g * 0.5, u + 0.03); G.linearRampToValueAtTime(0, u + len); });
    }
  }
  /** jackdaw: "chak" … "chak-chak" */
  jackdaw(t, gain, pan, r) {
    const n = 1 + Math.floor(r() * 3), g = gain * 0.06;
    for (let i = 0; i < n; i++) {
      const u = t + i * (0.22 + r() * 0.2), f0 = 1500 + r() * 500;
      this._voice('sawtooth', u, 0.12, pan, (F, G) => { F.setValueAtTime(f0 * 1.5, u); F.exponentialRampToValueAtTime(f0 * 0.7, u + 0.09); this._blip(G, u, 0.004, g, 0.1); }, null, ['bandpass', 2100, 2.2]);
    }
  }
  /** magpie: a dry rattle */
  magpie(t, gain, pan, r) {
    if (this._samp('magpie', t, gain, pan, r)) return;
    const n = 6 + Math.floor(r() * 7), g = gain * 0.05, step = 0.055 + r() * 0.012;
    this._burst(t, n * step + 0.05, 'bandpass', 2400, 1.1, pan, (G) => { for (let i = 0; i < n; i++) { const u = t + i * step; G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * (0.6 + 0.4 * r()), u + 0.004); G.linearRampToValueAtTime(0, u + step * 0.7); } });
  }
  /** gull: the long call, or a few mewing cries */
  gull(t, gain, pan, r) {
    if (this._samp('gull', t, gain, pan, r)) return;
    const n = 2 + Math.floor(r() * 4), g = gain * 0.06, f0 = 950 + r() * 250;
    this._voice('sawtooth', t, n * 0.42 + 0.1, pan, (F, G) => {
      for (let i = 0; i < n; i++) { const u = t + i * 0.42, len = 0.32; F.setValueAtTime(f0 * 0.85, u); F.linearRampToValueAtTime(f0 * 1.3, u + 0.09); F.linearRampToValueAtTime(f0 * 0.95, u + len); G.setValueAtTime(0, u); G.linearRampToValueAtTime(g, u + 0.03); G.setValueAtTime(g, u + len * 0.6); G.linearRampToValueAtTime(0, u + len); }
    }, null, ['bandpass', 1900, 2.4]);
  }
  /** geese: honks, one bird answering another */
  goose(t, gain, pan, r) {
    if (this._samp('goose', t, gain, pan, r)) return;
    const n = 2 + Math.floor(r() * 4), g = gain * 0.08;
    for (let i = 0; i < n; i++) {
      const u = t + i * (0.33 + r() * 0.3), f0 = 330 + r() * 140, len = 0.2 + r() * 0.12;
      this._voice('sawtooth', u, len + 0.02, pan, (F, G) => { F.setValueAtTime(f0 * 0.8, u); F.linearRampToValueAtTime(f0 * 1.45, u + len * 0.35); F.linearRampToValueAtTime(f0 * 1.25, u + len); G.linearRampToValueAtTime(g, u + 0.02); G.setValueAtTime(g, u + len * 0.6); G.linearRampToValueAtTime(0, u + len); }, null, ['bandpass', 1050, 2.2]);
    }
  }
  /** redwings going over in the dark: a thin falling "tseep" */
  redwing(t, gain, pan, r) {
    const n = 1 + Math.floor(r() * 2), g = gain * 0.012;
    for (let i = 0; i < n; i++) { const u = t + i * (1.2 + r() * 2), f = 7400 + r() * 500; this._voice('sine', u, 0.24, pan, (F, G) => { F.setValueAtTime(f, u); F.linearRampToValueAtTime(f * 0.86, u + 0.2); G.linearRampToValueAtTime(g, u + 0.03); G.setValueAtTime(g, u + 0.12); G.linearRampToValueAtTime(0, u + 0.22); }); }
  }
  /** a kite's thin whistle over the meadow: "weee-oo, ee-oo" */
  kite(t, gain, pan, r) {
    const g = gain * 0.03, f0 = 2500 + r() * 300;
    this._voice('triangle', t, 1.5, pan, (F, G) => {
      F.setValueAtTime(f0 * 0.9, t); F.linearRampToValueAtTime(f0 * 1.15, t + 0.12); F.linearRampToValueAtTime(f0, t + 0.55); F.linearRampToValueAtTime(f0 * 0.8, t + 0.7);
      G.linearRampToValueAtTime(g, t + 0.06); G.setValueAtTime(g, t + 0.5); G.linearRampToValueAtTime(0, t + 0.72);
      for (let i = 0; i < 2; i++) { const u = t + 0.82 + i * 0.3; F.setValueAtTime(f0 * 1.1, u); F.linearRampToValueAtTime(f0 * 0.82, u + 0.2); G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * 0.7, u + 0.03); G.linearRampToValueAtTime(0, u + 0.22); }
    });
  }
  /** swifts screaming round the roofs (only when the game shows them: fine warm days) */
  swift(t, gain, pan, r) {
    const g = gain * 0.02, f0 = 5600 + r() * 800, len = 0.5 + r() * 0.5;
    this._voice('sawtooth', t, len + 0.05, pan, (F, G) => { F.setValueAtTime(f0, t); F.linearRampToValueAtTime(f0 * 1.12, t + len * 0.3); F.linearRampToValueAtTime(f0 * 0.9, t + len); G.linearRampToValueAtTime(g, t + 0.08); G.setValueAtTime(g, t + len * 0.6); G.linearRampToValueAtTime(0, t + len); }, null, ['bandpass', 6000, 3]);
  }
  /** birds going up: 'clatter' = pigeons (wing claps), 'whirr' = small birds, 'splash' = off the water */
  flush(t, kind, gain, pan, r) {
    const n = kind === 'whirr' ? 14 : 9, step = kind === 'whirr' ? 0.035 : 0.075, g = gain * (kind === 'whirr' ? 0.035 : 0.07), hz = kind === 'whirr' ? 2600 : 1100;
    this._burst(t, n * step + 0.1, 'bandpass', hz, 0.8, pan, (G) => { for (let i = 0; i < n; i++) { const u = t + i * step * (0.9 + 0.2 * r()); G.setValueAtTime(0, u); G.linearRampToValueAtTime(g * Math.pow(1 - i / (n + 2), 1.2), u + 0.006); G.linearRampToValueAtTime(0, u + step * 0.6); } });
    if (kind === 'splash') this._burst(t, 0.5, 'bandpass', 1800, 0.6, pan, (G) => { G.linearRampToValueAtTime(g * 1.2, t + 0.03); G.exponentialRampToValueAtTime(g * 0.02, t + 0.45); G.linearRampToValueAtTime(0, t + 0.5); });
  }

  // ---------------------------------------------------------------- people and town
  bikebell(t, gain, pan) {
    for (const w of [0, 0.17]) for (const [m, a, d] of [[1, 1, 0.6], [2.76, 0.3, 0.3]]) this._voice('sine', t + w, d + 0.02, pan, (F, G, u) => { F.setValueAtTime(2350 * m, u); this._blip(G, u, 0.003, gain * 0.05 * a, d); });
  }
  /** someone a street or two away having a very good night: a rising "wheeey" */
  reveller(t, gain, pan, r) {
    const base = 150 + r() * 110, g = gain * 0.05;
    for (let i = 0; i < 3; i++) this._voice('sawtooth', t + r() * 0.06, 1.25, pan, (F, G, u) => {
      const b = base * (1 + (i - 1) * 0.07); F.setValueAtTime(b, u); F.linearRampToValueAtTime(b * 1.5, u + 0.4); F.linearRampToValueAtTime(b * 1.1, u + 1.1);
      G.linearRampToValueAtTime(g, u + 0.15); G.setValueAtTime(g, u + 0.6); G.linearRampToValueAtTime(0, u + 1.2);
    }, null, ['bandpass', 760 + i * 240, 2.4]);
  }
  /** a siren somewhere across town: a wail that comes up, passes and goes (10–16 s), dulled by distance, with the echo of the streets */
  siren(t, gain, pan, r) {
    const len = 10 + r() * 6, g = gain * 0.02, per = 3.6 + r() * 0.8, yelp = r() < 0.35, drift = (r() - 0.5) * 0.8;
    for (let k = 0; k < 2; k++) {
      const u0 = t + k * 0.21, gk = g * (k ? 0.45 : 1);
      this._voice('sawtooth', u0, len + 0.1, pan + drift * (k ? 0.5 : -0.5), (F, G) => {
        const p = yelp ? per / 5 : per;
        for (let u = 0; u < len; u += p) { F.setValueAtTime(650, u0 + u); F.linearRampToValueAtTime(1320, u0 + u + p * 0.62); F.linearRampToValueAtTime(650, u0 + u + p); }
        G.linearRampToValueAtTime(gk * 0.25, u0 + len * 0.15); G.linearRampToValueAtTime(gk, u0 + len * 0.5); G.linearRampToValueAtTime(gk * 0.2, u0 + len * 0.85); G.linearRampToValueAtTime(0, u0 + len);
      }, null, ['lowpass', 1500, 0.9]);
    }
  }
  /** a train on the line, heard from across the meadow: the rumble swelling and going, sometimes its two-tone horn */
  train(t, gain, pan, horn) {
    const g = gain * 0.12, len = 11;
    this._burst(t, len + 0.1, 'lowpass', 150, 0.8, pan, (G, u, F) => { G.linearRampToValueAtTime(g, u + len * 0.45); G.linearRampToValueAtTime(g * 0.6, u + len * 0.7); G.linearRampToValueAtTime(0, u + len); F.linearRampToValueAtTime(260, u + len * 0.45); F.linearRampToValueAtTime(140, u + len); });
    this._burst(t + 1, len - 2, 'bandpass', 900, 0.5, pan, (G, u) => { G.linearRampToValueAtTime(g * 0.12, u + (len - 2) * 0.45); G.linearRampToValueAtTime(0, u + len - 2); });
    if (horn) for (const [f, at, d] of [[370, 0.6, 0.7], [311, 1.4, 1.0]]) this._voice('sawtooth', t + at, d + 0.05, pan, (F, G, u) => { F.setValueAtTime(f, u); G.linearRampToValueAtTime(gain * 0.03, u + 0.05); G.setValueAtTime(gain * 0.03, u + d - 0.12); G.linearRampToValueAtTime(0, u + d); }, null, ['lowpass', 900, 0.8]);
  }
  // ---------------------------------------------------------------- particular places (fired from _amb_scene SITES)
  /** a station announcement from across the tracks: the two-tone chime, then a voice nobody can make out */
  tannoy(t, gain, pan, r) {
    const g = gain * 0.03;
    for (const [f, at] of [[659, 0], [523, 0.55]]) this._voice('sine', t + at, 0.9, pan, (F, G, u) => { F.setValueAtTime(f, u); this._blip(G, u, 0.01, g, 0.8); }, null, ['lowpass', 1800, 0.7]);
    const len = 3 + r() * 3.5, f0 = 105 + r() * 50;
    for (const [hz, a, late] of [[850, 1, 0], [1650, 0.5, 0], [850, 0.4, 0.23]]) this._voice('sawtooth', t + 1.5 + late, len + 0.1, pan, (F, G, u) => {
      let w = u; F.setValueAtTime(f0, u);
      while (w < u + len - 0.3) { const d = 0.09 + r() * 0.16, v = g * a * (0.5 + 0.5 * r()); F.linearRampToValueAtTime(f0 * (0.88 + 0.3 * r()), w + d); G.setValueAtTime(0, w); G.linearRampToValueAtTime(v, w + d * 0.3); G.linearRampToValueAtTime(v * 0.6, w + d * 0.8); G.linearRampToValueAtTime(0, w + d); w += d + (r() < 0.18 ? 0.25 + r() * 0.3 : 0.02); }
    }, null, ['bandpass', hz, 1.6]);
  }
  /** a crew passing: the catch and the run of each stroke, the gates knocking over */
  oars(t, gain, pan, r) {
    const n = 5 + Math.floor(r() * 5), per = 1.9 + r() * 0.5, g = gain * 0.06;
    for (let i = 0; i < n; i++) {
      const u = t + i * per, k = Math.sin(((i + 0.5) / n) * Math.PI);      // they come up and go away
      this._burst(u, 0.5, 'bandpass', 1500, 0.6, pan, (G, w, F) => { G.linearRampToValueAtTime(g * k, w + 0.04); G.linearRampToValueAtTime(g * k * 0.35, w + 0.2); G.linearRampToValueAtTime(0, w + 0.48); F.linearRampToValueAtTime(2600, w + 0.4); });
      this._burst(u + per * 0.42, 0.06, 'lowpass', 420, 1.2, pan, (G, w) => this._blip(G, w, 0.003, g * k * 0.9, 0.05));
    }
  }
  /** a punt pole: let down onto the gravel, pushed, and brought up dripping */
  pole(t, gain, pan, r) {
    const g = gain * 0.06;
    this._burst(t, 0.07, 'lowpass', 520, 1.4, pan, (G, w) => this._blip(G, w, 0.003, g, 0.06));
    this._burst(t + 0.02, 0.05, 'bandpass', 1300, 2.5, pan, (G, w) => this._blip(G, w, 0.002, g * 0.4, 0.04));
    const u = t + 1.3 + r() * 0.8; this._burst(u, 0.5, 'bandpass', 2200, 0.7, pan, (G, w) => { G.linearRampToValueAtTime(g * 0.35, w + 0.08); G.linearRampToValueAtTime(0, w + 0.48); });
    for (let i = 0; i < 3 + Math.floor(r() * 4); i++) { const w = u + 0.4 + i * (0.12 + r() * 0.2), f = 1100 + r() * 1500; this._voice('sine', w, 0.07, pan, (F, G) => { F.setValueAtTime(f, w); F.exponentialRampToValueAtTime(f * 1.8, w + 0.035); this._blip(G, w, 0.002, g * 0.3, 0.05); }); }
  }
  /** cattle (a recording where there is one) */
  moo(t, gain, pan, r) {
    if (this._samp('cow', t, gain, pan, r)) return;
    const f0 = 105 + r() * 30, len = 1.2 + r() * 0.8, g = gain * 0.09;
    this._voice('sawtooth', t, len + 0.05, pan, (F, G) => { F.setValueAtTime(f0 * 0.85, t); F.linearRampToValueAtTime(f0 * 1.25, t + len * 0.35); F.linearRampToValueAtTime(f0 * 0.9, t + len); G.linearRampToValueAtTime(g, t + 0.2); G.setValueAtTime(g, t + len * 0.6); G.linearRampToValueAtTime(0, t + len); }, null, ['bandpass', 520, 1.6]);
  }
  /** a horse (only a recording will do: nothing is played without one) */
  whinny(t, gain, pan, r) { this._samp('horse', t, gain, pan, r); }
  /** a fallow buck in the rut: a run of low belching groans (synthesised: no free recording was found) */
  deer(t, gain, pan, r) {
    const n = 3 + Math.floor(r() * 5), g = gain * 0.08, f0 = 58 + r() * 14;
    for (let i = 0; i < n; i++) {
      const u = t + i * (0.42 + r() * 0.1), len = 0.26 + r() * 0.1;
      this._voice('sawtooth', u, len + 0.02, pan, (F, G) => { F.setValueAtTime(f0 * 1.1, u); F.linearRampToValueAtTime(f0 * 0.85, u + len); const m = Math.floor(len * 26); for (let k = 0; k <= m; k++) G.linearRampToValueAtTime(g * (k % 2 ? 0.35 : 1) * Math.sin(((k + 0.5) / (m + 1)) * Math.PI), u + ((k + 1) / (m + 2)) * len); G.linearRampToValueAtTime(0, u + len); }, null, ['bandpass', 380, 2.2]);
    }
  }
  /** somebody practising the piano behind a window: a scale, a broken chord, a bar gone over again */
  practice(t, gain, pan, r) {
    const root = 220 * Math.pow(2, Math.floor(r() * 12) / 12), maj = [0, 2, 4, 5, 7, 9, 11, 12], g = gain * 0.045, step = 0.17 + r() * 0.14, kind = r();
    const seq = []; if (kind < 0.4) { for (let i = 0; i < 8; i++) seq.push(maj[i]); for (let i = 6; i >= 0; i--) seq.push(maj[i]); } else if (kind < 0.7) { for (const d of [0, 4, 7, 12, 16, 12, 7, 4, 0]) seq.push(d); } else { const a = []; for (let i = 0; i < 5; i++) a.push(maj[Math.floor(r() * 8)]); for (let k = 0; k < 2 + Math.floor(r() * 2); k++) seq.push(...a); }
    let u = t;
    for (let i = 0; i < seq.length && i < 12 && this.live < MAX_VOICES; i++) {
      const f = root * Math.pow(2, seq[i] / 12), w = u, v = g * (0.7 + 0.3 * r());
      for (const [m, a, d] of [[1, 1, 0.9], [2, 0.3, 0.45]]) this._voice('triangle', w, d + 0.02, pan, (F, G) => { F.setValueAtTime(f * m, w); this._blip(G, w, 0.006, v * a, d); }, null, ['lowpass', 1700, 0.6]);
      u += step * (0.92 + 0.16 * r()) + (r() < 0.07 ? 0.35 : 0);
    }
  }
  /** the organ through a chapel wall: a few slow chords (an organ scholar trying something) */
  organ(t, gain, pan, r) {
    const base = 110 * Math.pow(2, Math.floor(r() * 8) / 12), g = gain * 0.022, CH = [[0, 7, 12, 16], [5, 9, 12, 17], [7, 11, 14, 19], [-3, 4, 9, 12], [2, 5, 9, 14]]; let u = t, k = 0;
    for (let c = 0; c < 3 + Math.floor(r() * 3); c++) {
      const len = 2.2 + r() * 2, ch = CH[k], w = u; k = (k + 1 + Math.floor(r() * 3)) % CH.length;
      for (let q = 0; q < 3; q++) { const d = ch[q], f = base * Math.pow(2, d / 12); for (const [m, a] of [[1, 1]]) this._voice('triangle', w, len + 0.3, pan, (F, G) => { F.setValueAtTime(f * m, w); G.linearRampToValueAtTime(g * a, w + 0.25); G.setValueAtTime(g * a, w + len - 0.1); G.linearRampToValueAtTime(0, w + len + 0.25); }, null, ['lowpass', 620, 0.5]); }
      u += len - 0.05;
    }
  }
  /** a shout going up from a match (a recording where there is one; else a ripple of applause) */
  cheer(t, gain, pan, r) { if (!this._samp('cheer', t, gain, pan, r)) this.applause(t, 2.5, gain, pan, r); }

  /** a drop off a leaf or a gutter after the rain */
  drip(t, gain, pan, r) {
    const f = 900 + r() * 1700, g = gain * 0.035, n = r() < 0.25 ? 2 : 1;
    for (let i = 0; i < n; i++) { const u = t + i * (0.09 + r() * 0.1); this._voice('sine', u, 0.07, pan, (F, G) => { F.setValueAtTime(f * (1 + i * 0.2), u); F.exponentialRampToValueAtTime(f * 1.9, u + 0.035); this._blip(G, u, 0.002, g * (i ? 0.6 : 1), 0.05); }); }
  }
  /** a halyard slapping a flagpole in the wind */
  halyard(t, gain, pan, r) {
    const n = 2 + Math.floor(r() * 5), g = gain * 0.03; let u = t;
    for (let i = 0; i < n; i++) { const w = u; for (const [f, a] of [[2150, 1], [3480, 0.5]]) this._voice('sine', w, 0.09, pan, (F, G) => { F.setValueAtTime(f, w); this._blip(G, w, 0.001, g * a * (0.5 + 0.5 * r()), 0.07); }); u += 0.16 + r() * 0.3; }
  }
  /** the beat of a club through its wall: one bar's worth is asked for at a time (kick(t) on every beat that falls due) */
  kick(t, gain, pan) { this._voice('sine', t, 0.2, pan, (F, G) => { F.setValueAtTime(78, t); F.exponentialRampToValueAtTime(46, t + 0.12); this._blip(G, t, 0.006, gain * 0.16, 0.17); }, null, ['lowpass', 160, 0.7]); }
  /** somebody passing on a quiet street: a few of their footsteps */
  heels(t, gain, pan, r) {
    const n = 4 + Math.floor(r() * 4), gap = 0.5 + r() * 0.1, hard = r() < 0.4;
    for (let i = 0; i < n; i++) { const u = t + i * gap * (0.97 + 0.06 * r()); this._burst(u, 0.06, 'lowpass', hard ? 1400 : 520, 0.8, pan, (G, w) => this._blip(G, w, 0.003, gain * 0.05 * (0.5 + 0.5 * Math.sin(((i + 0.5) / n) * Math.PI)), 0.05)); }
  }
  /** one stroke of a church bell: hum, prime, tierce, quint, nominal — the low partials ring on, the high ones die fast. far: only the low ones arrive */
  bell(t, hz, gain, pan, far = false) {
    const c = this.ctx, g = gain * 0.11, long = c.createGain(), short = c.createGain(), mix = c.createGain(); mix.gain.value = 1; long.gain.value = 0; short.gain.value = 0;
    const dec = Math.min(6, 2.2 * Math.pow(392 / hz, 0.8) + 1.2);
    long.gain.setValueAtTime(0, t); long.gain.linearRampToValueAtTime(g, t + (far ? 0.02 : 0.006)); long.gain.exponentialRampToValueAtTime(g * 0.004, t + dec); long.gain.linearRampToValueAtTime(0, t + dec + 0.05);
    short.gain.setValueAtTime(0, t); short.gain.linearRampToValueAtTime(g, t + 0.003); short.gain.exponentialRampToValueAtTime(g * 0.004, t + dec * 0.4); short.gain.linearRampToValueAtTime(0, t + dec * 0.4 + 0.05);
    long.connect(mix); short.connect(mix); const tail = this._out(mix, pan, this._sp ? null : this.G ? this.G.bells : null);
    const part = (m, a, dest, i) => { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = hz * m; og.gain.value = a; o.connect(og); og.connect(dest); o.start(t); o.stop(t + dec + 0.1); if (i === 0) this._end(o, tail); };
    part(0.5, 0.45, long, 0); part(1, 1, long, 1); part(1.2, far ? 0.3 : 0.5, short, 2);
    if (!far) { part(1.5, 0.25, short, 3); part(2.0, 0.55, short, 4); part(2.62, 0.18, short, 5); }
  }
  /** one bell of a ring heard across the town (change ringing): two partials, soon gone */
  ding(t, hz, gain, pan) {
    const g = gain * 0.07, d = 1.15;
    for (const [m, a, dd] of [[1, 1, d], [2.0, 0.35, d * 0.5], [0.5, 0.3, d]]) this._voice('sine', t, dd + 0.03, pan, (F, G) => { F.setValueAtTime(hz * m, t); G.linearRampToValueAtTime(g * a, t + 0.012); G.exponentialRampToValueAtTime(g * a * 0.01, t + dd); G.linearRampToValueAtTime(0, t + dd + 0.02); }, this._sp ? null : this.G ? this.G.bells : null);
  }
  /** strike `n` on a tower: strokes every `gap` seconds */
  strike(t, hz, n, gain, pan, gap = 1.25) { for (let i = 0; i < n; i++) this.bell(t + i * gap, hz, gain * (i === 0 ? 1 : 0.92), pan); }

  // ---------------------------------------------------------------- rooms
  page(t, gain, pan, r) {
    const g = gain * 0.035;
    this._burst(t, 0.34, 'bandpass', 2600 + r() * 800, 0.8, pan, (G, u, F) => { G.linearRampToValueAtTime(g, u + 0.05); G.linearRampToValueAtTime(g * 0.3, u + 0.17); G.linearRampToValueAtTime(g * 0.8, u + 0.22); G.linearRampToValueAtTime(0, u + 0.33); F.linearRampToValueAtTime(4400, u + 0.3); });
  }
  cough(t, gain, pan, r) {
    const g = gain * 0.07, n = 1 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) { const u = t + i * 0.26; this._burst(u, 0.14, 'bandpass', 620 + r() * 200, 1.1, pan, (G, w) => this._blip(G, w, 0.008, g * (i ? 0.7 : 1), 0.12)); this._burst(u, 0.08, 'bandpass', 1900, 1.4, pan, (G, w) => this._blip(G, w, 0.004, g * 0.5, 0.07)); }
  }
  /** a chair, a floorboard, old timber */
  creak(t, gain, pan, r) {
    const f = 70 + r() * 60, g = gain * 0.035, d = 0.25 + r() * 0.3;
    this._voice('sawtooth', t, d + 0.02, pan, (F, G) => { F.setValueAtTime(f, t); F.linearRampToValueAtTime(f * (1.2 + r() * 0.5), t + d); G.linearRampToValueAtTime(g, t + d * 0.3); G.linearRampToValueAtTime(g * 0.5, t + d * 0.7); G.linearRampToValueAtTime(0, t + d); }, null, ['bandpass', 1100 + r() * 700, 5]);
  }
  cutlery(t, gain, pan, r) {
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { const f = 2600 + r() * 2800, u = t + i * (0.05 + r() * 0.12); this._voice('sine', u, 0.13, pan, (F, G, w) => { F.setValueAtTime(f, w); this._blip(G, w, 0.002, gain * 0.02, 0.1); }); }
    if (r() < 0.3) this._burst(t, 0.07, 'bandpass', 1400, 4, pan, (G, w) => this._blip(G, w, 0.003, gain * 0.03, 0.06));
  }
  /** glasses: a clink, sometimes one set down on the bar */
  glass(t, gain, pan, r) {
    const f = 3100 + r() * 1900, g = gain * 0.018, two = r() < 0.5;
    for (let i = 0; i < (two ? 2 : 1); i++) { const u = t + i * (0.07 + r() * 0.05), ff = f * (i ? 1.12 : 1); for (const [m, a, d] of [[1, 1, 0.28], [2.32, 0.4, 0.16], [3.9, 0.15, 0.08]]) this._voice('sine', u, d + 0.02, pan, (F, G) => { F.setValueAtTime(ff * m, u); this._blip(G, u, 0.001, g * a, d); }); }
    if (r() < 0.35) this._burst(t + 0.3 + r() * 0.3, 0.06, 'lowpass', 700, 1, pan, (G, w) => this._blip(G, w, 0.003, gain * 0.03, 0.05));
  }
  /** an espresso machine's steam wand */
  steam(t, gain, pan, r) {
    if (this._samp('espresso', t, gain * 0.5, pan, r)) return;
    const d = 0.9 + r() * 1.3, g = gain * 0.012;
    this._burst(t, d + 0.05, 'highpass', 3200, 0.6, pan, (G, u, F) => { G.linearRampToValueAtTime(g, u + 0.12); G.setValueAtTime(g, u + d - 0.25); G.linearRampToValueAtTime(0, u + d); F.linearRampToValueAtTime(2200, u + d); });
  }
  /** a pen at work: a few short strokes */
  pen(t, gain, pan, r) {
    const n = 3 + Math.floor(r() * 5), g = gain * 0.012; let u = t;
    for (let i = 0; i < n; i++) { const d = 0.05 + r() * 0.09, w = u; this._burst(w, d + 0.02, 'bandpass', 4200 + r() * 900, 1.6, pan, (G) => { G.linearRampToValueAtTime(g, w + 0.015); G.linearRampToValueAtTime(g * 0.6, w + d * 0.7); G.linearRampToValueAtTime(0, w + d); }); u += d + 0.04 + r() * 0.1; }
  }
  beep(t, gain, pan) { this._voice('square', t, 0.1, pan, (F, G) => { F.setValueAtTime(1950, t); G.linearRampToValueAtTime(gain * 0.012, t + 0.004); G.setValueAtTime(gain * 0.012, t + 0.075); G.linearRampToValueAtTime(0, t + 0.085); }, null, ['lowpass', 3500, 0.7]); }
  /** chalk on a board: a few taps, sometimes a stroke */
  chalk(t, gain, pan, r) {
    const n = 2 + Math.floor(r() * 5), g = gain * 0.035; let u = t;
    for (let i = 0; i < n; i++) {
      if (r() < 0.3) { const d = 0.15 + r() * 0.2; this._burst(u, d + 0.02, 'bandpass', 3400, 2.5, pan, (G, w) => { G.linearRampToValueAtTime(g * 0.6, w + 0.02); G.setValueAtTime(g * 0.6, w + d - 0.03); G.linearRampToValueAtTime(0, w + d); }); u += d + 0.05; }
      else { this._burst(u, 0.04, 'bandpass', 2700, 2, pan, (G, w) => this._blip(G, w, 0.002, g, 0.03)); u += 0.08 + r() * 0.12; }
    }
  }
  /** somebody walking somewhere else in the building */
  distantStep(t, gain, pan, r) {
    const n = 3 + Math.floor(r() * 4), gap = 0.48 + r() * 0.12;
    for (let i = 0; i < n; i++) this._burst(t + i * gap * (0.96 + 0.08 * r()), 0.09, 'lowpass', 380, 0.8, pan, (G, w) => this._blip(G, w, 0.004, gain * 0.06 * (0.6 + 0.4 * Math.sin((i / n) * Math.PI)), 0.08));
  }
  /** a wall clock: tick … tock (each a hair different: an escapement, not a metronome) */
  tick(t, gain, tock) { const j = ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1; this._burst(t + (j - 0.5) * 0.012, 0.03, 'bandpass', (tock ? 2300 : 3100) * (0.97 + 0.06 * j), 5, 0.25, (G, w) => this._blip(G, w, 0.001, gain * 0.03 * (0.8 + 0.4 * j), 0.022), this.G ? this.G.inev : null); }

  // ---------------------------------------------------------------- the player's own feet, cricket, the law
  /** surface: 'stone' | 'grass' | 'wood' | 'carpet' | 'leaves' | 'wet' | 'snow' | 'gravel'. No two steps quite alike. */
  footstep(surface, gain, left) {
    const t = this.ctx.currentTime, p = left ? -0.12 : 0.12, d = this.steps || this.fx, j = Math.random(), k = 0.85 + 0.3 * j, v = gain * (0.82 + 0.36 * Math.random());
    if (surface === 'grass') this._burst(t, 0.1, 'bandpass', 1700 * k, 0.5, p, (G, w) => this._blip(G, w, 0.012, v * 0.2, 0.085), d);
    else if (surface === 'leaves') { this._burst(t, 0.16, 'bandpass', 3200 * k, 0.45, p, (G, w) => { G.linearRampToValueAtTime(v * 0.13, w + 0.012); G.linearRampToValueAtTime(v * 0.05, w + 0.05); G.linearRampToValueAtTime(v * 0.1, w + 0.07 + 0.03 * j); G.linearRampToValueAtTime(0, w + 0.15); }, d); this._burst(t, 0.08, 'bandpass', 1300, 0.6, p, (G, w) => this._blip(G, w, 0.01, v * 0.1, 0.07), d); }
    else if (surface === 'snow') this._burst(t, 0.2, 'bandpass', 900 * k, 0.9, p, (G, w, F) => { G.linearRampToValueAtTime(v * 0.22, w + 0.03); G.linearRampToValueAtTime(v * 0.1, w + 0.1); G.linearRampToValueAtTime(0, w + 0.19); F.linearRampToValueAtTime(600, w + 0.18); }, d);
    else if (surface === 'gravel') { this._burst(t, 0.13, 'bandpass', 2400 * k, 0.4, p, (G, w) => { G.linearRampToValueAtTime(v * 0.16, w + 0.008); G.linearRampToValueAtTime(v * 0.06, w + 0.045); G.linearRampToValueAtTime(v * 0.1, w + 0.06); G.linearRampToValueAtTime(0, w + 0.12); }, d); this._burst(t, 0.06, 'lowpass', 420, 0.8, p, (G, w) => this._blip(G, w, 0.004, v * 0.2, 0.05), d); }
    else if (surface === 'wood') { this._burst(t, 0.09, 'lowpass', 300 * k, 0.9, p, (G, w) => this._blip(G, w, 0.003, v * 0.45, 0.075), d); this._burst(t, 0.03, 'bandpass', 1300 * k, 2, p, (G, w) => this._blip(G, w, 0.002, v * 0.1, 0.025), d); }
    else if (surface === 'carpet') this._burst(t, 0.08, 'lowpass', 260 * k, 0.7, p, (G, w) => this._blip(G, w, 0.006, v * 0.25, 0.07), d);
    else {
      this._burst(t, 0.06, 'lowpass', 520 * k, 0.8, p, (G, w) => this._blip(G, w, 0.003, v * 0.35, 0.05), d); this._burst(t, 0.025, 'bandpass', 2300 * k, 1.8, p, (G, w) => this._blip(G, w, 0.001, v * 0.11, 0.02), d);
      if (surface === 'wet') this._burst(t, 0.12, 'highpass', 2600, 0.6, p, (G, w) => this._blip(G, w, 0.008, v * 0.07, 0.1), d);      // a wet pavement: the little splash round the sole
    }
  }
  /** leather on willow */
  bat(t, gain, pan) {
    this._burst(t, 0.06, 'bandpass', 1150, 2.5, pan, (G, w) => this._blip(G, w, 0.001, gain * 0.25, 0.05));
    this._voice('sine', t, 0.08, pan, (F, G) => { F.setValueAtTime(560, t); F.exponentialRampToValueAtTime(420, t + 0.06); this._blip(G, t, 0.001, gain * 0.12, 0.06); });
  }
  /** a ripple of polite applause, `dur` seconds */
  applause(t, dur, gain, pan, r) {
    const g = gain * 0.05;
    for (const hz of [1500, 2700]) this._burst(t, dur, 'bandpass', hz, 0.9, pan, (G, u) => {
      const n = Math.floor(dur * 22);
      for (let i = 0; i < n; i++) { const k = i / n, env = Math.sin(Math.min(1, k * 4) * Math.PI / 2) * Math.pow(1 - k, 0.7); G.linearRampToValueAtTime(g * env * (0.35 + 0.65 * r()), u + (i + 1) * (dur / n)); }
    });
  }
  /** "busted": a rueful four-note slide downhill */
  sting(t = null) {
    const c = this.ctx; if (t === null) t = c.currentTime + 0.05;
    const notes = [[58, 0.34], [57, 0.34], [56, 0.34], [55, 1.0]], hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    this._voice('sawtooth', t, 2.2, 0, (F, G) => {
      let u = t;
      for (const [m, len] of notes) {
        F.setValueAtTime(hz(m) * 1.03, u); F.linearRampToValueAtTime(hz(m), u + 0.05);
        if (len > 0.5) for (let i = 0; i < 7; i++) F.linearRampToValueAtTime(hz(m - 0.12 * i) * (i % 2 ? 0.985 : 1.015), u + 0.2 + i * 0.1);
        G.setValueAtTime(0.0, u); G.linearRampToValueAtTime(0.09, u + 0.03); G.setValueAtTime(0.09, u + len - 0.08); G.linearRampToValueAtTime(len > 0.5 ? 0 : 0.03, u + len);
        u += len;
      }
    }, this.fx, ['lowpass', 1100, 3]);
  }
  /**
   * Fire an event by name (the names in _amb_logic EVENTS, and kite / swift / heels / halyard): gain 0..1, pan −1..1,
   * r = a dice, cut = Hz the distance (or a building in the way) leaves of it (0 = all of it), pos = [x, y, z] where it
   * is, in the listener's frame (then it is placed binaurally and `pan` is not used).
   * Dropped (-> false) when MAX_VOICES one-shot sources are already sounding.
   */
  event(name, t, gain, pan, r, cut = 0, pos = null) {
    const f = this[name]; if (!f) return false;
    if (!(isFinite(t) && isFinite(gain) && isFinite(pan) && isFinite(cut))) { if (this.audio._bad) this.audio._bad('ambience event ' + name); return false; }      // (never a NaN into an AudioParam)
    if (this.live >= MAX_VOICES) { this.dropped++; return false; }
    const G = this.G; this._c = cut;
    this._d = G ? (isIndoorEvent(name) ? G.inev : BIRDS.includes(name) || name === 'kite' || name === 'swift' ? G.birds : G.town) : null;
    this._place(pos, this._d, 'small');
    try { f.call(this, t, gain, pan, r); } finally { this._unplace(); this._d = null; this._c = 0; }
    return true;
  }
}
export { TAU };
