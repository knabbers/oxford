// Weather sound, synthesised like the rest of the game's audio (no files): everything goes to the AMBIENCE bus, so it
// follows the U key (music + ambience volume) and ducks under speech.
//   rain     two looped slices of the shared white noise: a high hiss (fine drops), a mid patter, and a low body in
//            heavy rain; through one low-pass that is the listener's shelter: outdoors open, indoors the drumming on
//            the roof and the windows (dull, ~700 Hz), in a car the roof right overhead (~1.4 kHz, louder body), under
//            a glider canopy (~2.4 kHz). Snow is nearly silent.
//   wind     the shared brown noise through a band-pass whose level follows the gusts (blustery days); indoors faint,
//            and less where the spot is sheltered (a quad, a street: systems/ambience.js leaves what it found in
//            audio.amb — open 0..1, trees, green, water — and this reads it; absent, the spot counts as open)
//   surfaces the same audio.amb colours the rain: under trees the patter of big drops off the leaves and less hiss, on
//            grass a softer rain, by water a brighter one
//   thunder  distant rumbles: a few overlapping low-passed brown-noise swells with a slow attack; nearer strikes get
//            a crack first. Scheduled at the light's time + distance / 343 m/s.
// Noise: the ambience's long loops (audio.ambNoise, 7.3 s white / 11.9 s brown) when they are there, each layer two
// readings at unrelated speeds, so the rain does not come round again; else the short shared loops of core/audio.js.
// Levels: the heaviest rain is kept under speech (tools/smoke_ambience.mjs measures it); the hiss is rolled off above
// 7 kHz (a street in the rain is bright, but it is not white noise).
// Nodes are built on first need and torn down after a few silent seconds; nothing runs when it is dry and calm.
const RAIN = 0.3;      // the level of the rain as a whole (at 1, as first written, heavy rain measured louder than speech)
export class WeatherSound {
  constructor(audio) { this.audio = audio; this.n = null; this.quiet = 0; this.thunders = 0; }
  _build() {
    const A = this.audio, c = A.ctx;
    const N = A.ambNoise || null, WN = (N && N.white) || A.noiseBuf, BN = (N && N.brown) || A.brownBuf, srcs = [];
    const src = (buf, rate = 1) => {      // two readings of the loop, the second at an unrelated speed -> one node to connect from
      const g = c.createGain(); g.gain.value = Math.SQRT1_2;
      for (const r of [rate, rate * 0.853]) { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = r; s.connect(g); s.start(c.currentTime, Math.random() * (buf.duration - 0.1)); srcs.push(s); }
      return g;
    };
    const filt = (type, f, q = 0.7) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = () => { const g = c.createGain(); g.gain.value = 0; return g; };
    const out = gain(); out.gain.value = 1;
    const shelter = filt('lowpass', 16000, 0.5);
    shelter.connect(out); out.connect(A.ambience);
    const hiss = src(WN, 1), hHp = filt('highpass', 3200, 0.5), hLp = filt('lowpass', 7000, 0.5), hG = gain(); hiss.connect(hHp); hHp.connect(hLp); hLp.connect(hG); hG.connect(shelter);
    const pat = src(WN, 0.73), pBp = filt('bandpass', 1100, 0.6), pG = gain(); pat.connect(pBp); pBp.connect(pG); pG.connect(shelter);
    const body = src(BN, 1), bLp = filt('lowpass', 520, 0.6), bG = gain(); body.connect(bLp); bLp.connect(bG); bG.connect(shelter);
    const wind = src(BN, 0.61), wBp = filt('bandpass', 420, 0.9), wG = gain(); wind.connect(wBp); wBp.connect(wG); wG.connect(out);
    this.n = { out, shelter, hiss, pat, body, wind, hG, pG, bG, wG, wBp, srcs };
  }
  _teardown() {
    if (!this.n) return;
    for (const s of this.n.srcs) { try { s.stop(); s.disconnect(); } catch { /* */ } }
    try { this.n.out.disconnect(); } catch { /* */ }
    this.n = null;
  }
  /**
   * w: {rain 0..1, drizzle 0..1, snow 0..1, gust 0..1, wind m/s near the ground}; where: 'out' | 'cover' | 'in' | 'car' | 'canopy'
   */
  update(dt, w, where, tGust) {
    const A = this.audio;
    if (!A || !A.ctx || !A.ambience) return;
    const rain = w.rain * (1 - 0.9 * w.snow), windy = Math.max(0, (w.wind - 4.5) / 6) * (0.55 + 0.45 * tGust);
    const loud = rain > 0.005 || windy > 0.02;
    if (!loud) { if (this.n && (this.quiet += dt) > 4) this._teardown(); }
    else this.quiet = 0;
    if (!loud && !this.n) return;
    if (!this.n) this._build();
    const n = this.n, t = A.ctx.currentTime, tc = 0.6, E = A.amb || null, outd = where === 'out' || where === 'cover';
    const open = E && outd ? 0.3 + 0.7 * Math.min(1, E.open ?? 1) : 1, trees = E && outd ? Math.min(1, E.trees || 0) : 0, grass = E && outd ? Math.min(1, E.green || 0) : 0, wat = E && outd ? Math.min(1, E.water || 0) : 0;
    const k = where === 'in' ? 0.45 : where === 'car' ? 1.0 : where === 'canopy' ? 0.85 : where === 'cover' ? 0.8 : 1;
    const cut = where === 'in' ? 700 : where === 'car' ? 1400 : where === 'canopy' ? 2400 : 16000;
    n.shelter.frequency.setTargetAtTime(cut, t, 0.3);
    const dz = w.drizzle * (1 - w.snow);
    n.hG.gain.setTargetAtTime(k * RAIN * (0.05 + 0.12 * rain) * Math.min(1, rain * 12) * (1 - 0.4 * dz) * (1 - 0.35 * trees) * (1 - 0.3 * grass * (1 - trees)) * (1 + 0.35 * wat), t, tc);
    n.pG.gain.setTargetAtTime(k * RAIN * 0.16 * Math.min(1, rain * 1.6) * (1 - 0.6 * dz) * (where === 'car' || where === 'canopy' ? 1.6 : 1) * (1 + 0.5 * trees), t, tc);
    n.bG.gain.setTargetAtTime(k * RAIN * 0.22 * Math.max(0, rain - 0.35) * (where === 'in' ? 1.4 : 1), t, tc);
    n.wG.gain.setTargetAtTime((where === 'in' ? 0.25 : where === 'car' ? 0.4 : 1) * 0.22 * Math.min(1.2, windy) * open, t, 0.4);
    n.wBp.frequency.setTargetAtTime(300 + 380 * tGust, t, 0.5);
  }
  /** a thunderclap `delay` s from now, `dist` m away, heard `where` */
  thunder(delay, dist, where, seed) {
    const A = this.audio, c = A && A.ctx;
    if (!c || !A.ambience) return;
    let s = (seed >>> 0) || 7; const R = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const near = Math.max(0, 1 - dist / 5000), base = (where === 'in' ? 0.35 : where === 'car' ? 0.55 : 0.8) * (0.25 + 0.75 / (1 + dist / 2500));
    const t0 = c.currentTime + Math.max(0, delay);
    const swell = (when, len, f, g, attack) => {
      const src = c.createBufferSource(); src.buffer = A.brownBuf; src.loop = true;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; lp.Q.value = 0.7;
      const gn = c.createGain(); gn.gain.value = 0;
      gn.gain.setValueAtTime(0, when); gn.gain.linearRampToValueAtTime(g, when + attack); gn.gain.exponentialRampToValueAtTime(0.0008, when + len); gn.gain.linearRampToValueAtTime(0, when + len + 0.05);
      src.connect(lp); lp.connect(gn); gn.connect(A.ambience);
      src.start(when, R() * 2); src.stop(when + len + 0.1);
      src.onended = () => { try { gn.disconnect(); lp.disconnect(); } catch { /* */ } };
    };
    if (near > 0.3) swell(t0, 0.6, 2200, base * 0.5 * near, 0.01);          // the crack of a near strike
    const n = 3 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) swell(t0 + i * (0.35 + R() * 0.9), 2.5 + R() * 3.5, 140 + R() * 180 + near * 200, base * (0.7 - i * 0.1), 0.15 + (1 - near) * 0.6 * R());
    this.thunders++;
  }
}
