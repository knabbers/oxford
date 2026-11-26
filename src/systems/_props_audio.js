// Dynamic props: the sounds. Since 2026-11-23 a knock and every landing are played by the crash sounds
// (systems/_crash_audio.js: layered, varied every time, AT the prop — spatial, a wall between muffles it) with this
// file choosing the material; it keeps its own rate limit (a toppling row of bins never floods) separate from the
// vehicles' crashes, plus ONE persistent scrape loop created the first time something slides.
//   plastic  a hollow boom and the lid slapping                       wheelie bins, litter bins (green), grit bins
//   metal    a steel tube's clang (inharmonic, long ring)             sign posts, lamp columns, pay machines, lids
//   iron     a dull heavy clonk (lower, short)                        heritage bins, bollards, cast-iron lamps
//   wood     knocks and, hard, splintering                            A-boards, benches, estate boards
//   rubber   a soft hollow bump                                       cones
//   glass    the burst and the tinkles                                lamp lanterns, recycling boxes of bottles
//   ball     a football's thock
// knock(mat, dv, x, z, by): the moment a vehicle / a foot strikes it (by 'car' | 'bike' | 'foot'): the prop's material
// and, for a vehicle, its bumper.
import { CrashSound, CrashLimiter } from './_crash_audio.js';

const MAT = { plastic: 'bin', metal: 'post', iron: 'iron', wood: 'wood', rubber: 'cone', glass: 'glass' };

export class PropSound {
  constructor(audio, ground = null) {
    this.a = audio; this.budget = 14; this.loop = null; this.idle = 0; this.ground = ground;
    this.cs = new CrashSound(null, audio); this.cs.lim = new CrashLimiter({ rate: 10, burst: 6, max: 6, mergeT: 0.06, mergeR: 1.5 });
  }
  _ok(x, z, range) {
    const a = this.a; if (!a || !a.ctx || !a.running || this.budget < 1) return null;
    const p = a.place(x, z, range); if (p.gain < 0.004) return null;
    this.budget--; return p;
  }
  _y(x, z) { let y = NaN; try { y = this.ground ? this.ground(x, z) : NaN; } catch { /* */ } return (isFinite(y) ? y : (this.a._lh || 1.6) - 1.6) + 0.3; }
  tick(dt) { this.budget = Math.min(14, this.budget + dt * 14); }
  impact(mat, speed, x, z) {
    const s = Math.min(1, speed / 7); if (s < 0.05 || !this._ok(x, z, 70)) return;
    if (mat === 'ball') { const p = this.a.place(x, z, 70), g = p.gain * (0.25 + 0.75 * s), r = 0.85 + Math.random() * 0.3; this.a.noise(0.05, { gain: 0.3 * g, freq: 520 * r, q: 1.5, pan: p.pan }); this.a.tone(170 * r, 0.06, { gain: 0.12 * g, pan: p.pan }); return; }
    this.cs.hit(MAT[mat] || 'wood', 1.2 + speed * 1.4, x, this._y(x, z), z, { striker: 'prop', gain: 0.8 });
  }
  /** struck by a vehicle or a foot (systems/props.js knock): the prop's material, and the vehicle's bumper */
  knock(mat, dv, x, z, by) {
    if (!this._ok(x, z, 70)) return;
    const striker = by === 'car' ? 'car' : by === 'bike' ? 'bike' : by === 'net' ? 'prop' : 'foot';      // (another player's knock: the prop's own sound — their car's is in their crash)
    if (mat === 'ball') return;
    this.cs.hit(MAT[mat] || 'wood', 1.2 + dv * (striker === 'foot' ? 1 : 1.6), x, this._y(x, z), z, { striker, gain: striker === 'foot' ? 0.6 : 0.85 });
  }
  glass(x, z, s = 1) { if (!this._ok(x, z, 60)) return; this.cs.hit('glass', 2 + s * 10, x, this._y(x, z) + 2, z, { striker: 'prop', gain: 0.7 }); }
  /** a lamp column shears: a big clang, the lantern breaks, the ballast buzzes and pops */
  shear(x, z) {
    this.impact('metal', 8, x, z);
    const p = this._ok(x, z, 80); if (!p) return;
    const a = this.a;
    a.tone(100, 0.5, { type: 'sawtooth', gain: 0.03 * p.gain, pan: p.pan, when: 0.1 });
    a.noise(0.06, { gain: 0.2 * p.gain, freq: 4000, q: 1, pan: p.pan, when: 0.6 });
    for (let i = 0; i < 5; i++) a.noise(0.02, { gain: 0.12 * p.gain, freq: 5000 + i * 700, q: 2, pan: p.pan, when: 0.05 + i * 0.07 });
  }
  /** a car held by something its collider ignores, or a tree trunk struck: the car's own blow against it */
  thud(x, z, s) { if (!this._ok(x, z, 60)) return; this.cs.hit('tree', 1.2 + s * 1.2, x, this._y(x, z) + 0.2, z, { striker: 'car', gain: 0.8 }); }
  splash(x, z, s) {
    const p = this._ok(x, z, 60); if (!p) return;
    const a = this.a, g = p.gain * Math.min(1, 0.3 + s / 6);
    a.noise(0.35, { gain: 0.3 * g, freq: 900, q: 0.6, pan: p.pan }); a.noise(0.5, { gain: 0.12 * g, freq: 2600, q: 0.5, pan: p.pan, when: 0.08 });
  }
  /** scrape / rolling rumble: level 0..1 at the loudest sliding prop (x, z). One persistent graph, muted when idle. */
  scrape(level, x, z, dt) {
    const a = this.a; if (!a || !a.ctx || !a.running) return;
    if (level <= 0.01 && !this.loop) return;
    if (!this.loop) {
      try {
        const c = a.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = a.brownBuf || a.noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.9; g.gain.value = 0;
        s.connect(f); f.connect(g); g.connect(a.master); s.start();
        this.loop = { s, f, g };
      } catch { return; }
    }
    const L = this.loop, t = a.ctx.currentTime, p = a.place(x, z, 40), k = Math.min(1, level) * p.gain;
    L.g.gain.setTargetAtTime(k * 0.12, t, 0.06); L.f.frequency.setTargetAtTime(500 + 1400 * Math.min(1, level), t, 0.1);
    this.idle = k > 0.002 ? 0 : this.idle + dt;
    if (this.idle > 3) { try { L.s.stop(); L.g.disconnect(); } catch { /* */ } this.loop = null; this.idle = 0; }
  }
}
