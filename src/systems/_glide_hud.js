// Gliding HUD (three small canvases on the bottom edge, created on first use: the centre of the screen stays clear)
// and the variometer's audio.
//   Hud: show(on), draw(s, extra), prompt(text|null), keys(text, secs)
//   Vario: the standard sound — in lift, short beeps whose pitch and rate rise with the climb; in sink beyond ~1 m/s a
//   low continuous tone that falls as the sink gets worse; quiet between. One oscillator + gain, made on first use.
const KT = 1.943844, FT = 3.28084;

export class Hud {
  constructor() { this.el = null; this.on = false; this._pt = null; this.avg = 0; this._avT = 0; }
  _make() {
    if (this.el || typeof document === 'undefined' || !document.createElement) return;
    const d = document.createElement('div');
    d.id = 'glide-hud';
    Object.assign(d.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 20, display: 'none', fontFamily: '"Helvetica Neue", Arial, sans-serif', color: '#f2f5f7', textShadow: '0 1px 3px #000, 0 0 2px #000' });
    const dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
    const cv = (w, h, css) => {
      const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      Object.assign(c.style, { position: 'absolute', width: w + 'px', height: h + 'px' }, css); d.appendChild(c);
      const g = c.getContext && c.getContext('2d'); if (g && g.setTransform) g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return g;
    };
    // three small instruments on the bottom edge: airspeed beside the minimap, the yaw string in the middle of the
    // very bottom, vario + height in the right corner (above the place name). The middle of the screen stays clear.
    this.gL = cv(LW, LH, { left: '236px', bottom: '16px' });
    this.gS = cv(SW, SH, { left: '50%', bottom: '6px', transform: 'translateX(-50%)' });
    this.gR = cv(RW, RH, { right: '20px', bottom: '58px' });
    const p = document.createElement('div'); Object.assign(p.style, { position: 'absolute', left: '50%', bottom: '104px', transform: 'translateX(-50%)', fontSize: '15px', fontWeight: '600', whiteSpace: 'nowrap', letterSpacing: '0.2px' });
    const k = document.createElement('div'); Object.assign(k.style, { position: 'fixed', left: '20px', top: '110px', background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', lineHeight: '1.5', display: 'none', whiteSpace: 'pre', textAlign: 'left', color: '#f2f5f7', zIndex: 21, fontFamily: '"Helvetica Neue", Arial, sans-serif', pointerEvents: 'none' });
    d.appendChild(p);
    document.body.appendChild(d); document.body.appendChild(k);
    this.el = d; this.g = this.gR; this.pr = p; this.kb = k;
  }
  show(on) { if (on === this.on) return; this.on = on; if (on) { this._make(); this.avg = 0; } if (this.el) this.el.style.display = on ? 'block' : 'none'; if (!on && this.kb) this.kb.style.display = 'none'; }
  prompt(t) { if (!this.el) return; if (t !== this._pt) { this._pt = t; this.pr.textContent = t || ''; } }
  keys(text, secs) { this._make(); if (!this.kb) return; this.kb.textContent = text; this.kb.style.display = text ? 'block' : 'none'; clearTimeout(this._kt); if (text && secs) this._kt = setTimeout(() => { this.kb.style.display = 'none'; }, secs * 1000); }
  /** s: glider state (V, y, agl, te, beta, ab, trimV, stall); x: {wind {dir, speed}, heading, cable, alt} */
  draw(s, x = {}) {
    const L = this.gL, R = this.gR, S = this.gS; if (!R || !R.fillRect || !L || !S) return;
    const kt = (s.V || 0) * KT, te = s.te || 0, v = te * KT;
    this.avg += (te - this.avg) * (1 / 15) / 12;                 // ~12 s averager (drawn at 15 Hz)
    // ---------------- airspeed: big figure, a thin tape 30–150 kt with the stall mark, the trim caret and the brakes
    L.clearRect(0, 0, LW, LH); soft(L);
    const warn = s.stall > 0.3 || s.buffet > 0.6, fast = kt > 130;
    L.textAlign = 'left'; L.fillStyle = warn ? '#ff8468' : fast ? '#ffd35c' : INK; L.font = NUM(30); L.fillText(String(Math.round(kt)), 2, 30);
    const nw = L.measureText ? L.measureText(String(Math.round(kt))).width : 36;
    L.fillStyle = DIM; L.font = LAB(11); L.fillText('kt', 6 + nw, 30); L.fillText(Math.round((s.V || 0) * 3.6) + ' km/h', 6 + nw + 20, 30);
    const tx = 2, tw = LW - 8, ty = 44, X = (k) => tx + Math.max(0, Math.min(1, (k - 30) / 120)) * tw;
    bar(L, tx, ty, tw, 4, 'rgba(10,14,18,0.55)');
    bar(L, X(36), ty, X(105) - X(36), 4, '#58c878'); bar(L, X(105), ty, X(150) - X(105), 4, '#e6c544'); bar(L, X(150), ty - 3, 2, 10, '#ff5a45');
    bar(L, X(35) - 1, ty - 3, 2, 10, '#f2f5f7');                                           // stall
    tri(L, X(kt), ty - 2, 6, true, warn ? '#ff8468' : INK);                                // now
    tri(L, X((s.trimV || 25) * KT), ty + 7, 5, false, '#8fd0ff');                          // trim speed
    const ab = s.ab || 0;
    if (ab > 0.02) { bar(L, tx, ty + 15, tw * 0.45, 4, 'rgba(10,14,18,0.55)'); bar(L, tx, ty + 15, tw * 0.45 * ab, 4, '#5cb8ff'); L.fillStyle = '#9fd4ff'; L.font = LAB(10); L.fillText('AIRBRAKES', tx + tw * 0.45 + 8, ty + 21); }
    else if (x.cable) { L.fillStyle = '#ffd35c'; L.font = LAB(10); L.fillText('ON THE WINCH', tx, ty + 21); }
    // ---------------- vario arc (±10 kt) with the averager, height beside it, the wind underneath
    R.clearRect(0, 0, RW, RH); soft(R);
    const cx = RW - 46, cy = 46, r = 36, A0 = Math.PI * 0.6, A1 = Math.PI * 1.4;        // left-hand arc: up = lift
    const ang = (k) => Math.PI + Math.max(-1, Math.min(1, k / 10)) * (A1 - Math.PI);
    R.lineCap = 'butt'; R.strokeStyle = 'rgba(10,14,18,0.55)'; R.lineWidth = 6; R.beginPath(); R.arc(cx, cy, r, A0, A1); R.stroke();
    R.strokeStyle = 'rgba(242,245,247,0.55)'; R.lineWidth = 1.5;
    for (let k = -10; k <= 10; k += 2) { const a = ang(k), l = k % 10 === 0 ? 8 : 4; R.beginPath(); R.moveTo(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3)); R.lineTo(cx + Math.cos(a) * (r + 3 + l), cy + Math.sin(a) * (r + 3 + l)); R.stroke(); }
    if (!x.cable) {
      const a = ang(v);
      R.strokeStyle = v >= 0 ? '#58d98a' : '#ff8a5c'; R.lineWidth = 6; R.beginPath(); R.arc(cx, cy, r, Math.min(a, Math.PI), Math.max(a, Math.PI)); R.stroke();
      const aa = ang(this.avg * KT);                                                     // averager: a small diamond riding the arc
      R.save(); R.translate(cx + Math.cos(aa) * (r - 7), cy + Math.sin(aa) * (r - 7)); R.rotate(aa); R.fillStyle = '#f3e7b3'; R.beginPath(); R.moveTo(-4, 0); R.lineTo(0, -3); R.lineTo(4, 0); R.lineTo(0, 3); R.closePath(); R.fill(); R.restore();
    }
    R.textAlign = 'center'; R.fillStyle = x.cable ? DIM : v >= 0 ? '#bff2d0' : '#ffc4ae'; R.font = NUM(19);
    R.fillText(x.cable ? '—' : (v >= 0 ? '+' : '−') + Math.abs(Math.max(-19.9, Math.min(19.9, v))).toFixed(1), cx + 6, cy + 6);
    R.fillStyle = DIM; R.font = LAB(10); R.fillText('kt  avg ' + (this.avg >= 0 ? '+' : '−') + Math.abs(this.avg * KT).toFixed(1), cx + 4, cy + 21);
    const alt = Math.max(0, x.alt ?? s.agl ?? 0);
    R.textAlign = 'right'; R.fillStyle = INK; R.font = NUM(26); R.fillText(Math.round(alt * FT / 10) * 10 + '', cx - r - 34, 40);
    R.fillStyle = DIM; R.font = LAB(11); R.textAlign = 'left'; R.fillText('ft', cx - r - 30, 40);
    R.textAlign = 'right'; R.fillText(Math.round(alt) + ' m', cx - r - 34, 56);
    if (x.wind) {
      // where the wind blows towards, relative to the nose (up = straight ahead)
      const rel = x.wind.dir - (Math.PI - (x.heading || 0)), wx = cx - r - 60, wy = 76;
      R.save(); R.translate(wx, wy); R.rotate(rel); R.strokeStyle = '#dfe8ee'; R.lineWidth = 2; R.lineCap = 'round'; R.beginPath(); R.moveTo(0, 8); R.lineTo(0, -8); R.moveTo(-4, -3); R.lineTo(0, -8); R.lineTo(4, -3); R.stroke(); R.restore();
      R.fillStyle = DIM; R.font = LAB(10); R.textAlign = 'left'; R.fillText('wind ' + Math.round(x.wind.speed * KT) + ' kt', wx + 12, wy + 4);
    }
    // ---------------- yaw string: streams opposite the slip ("step on the head of the string")
    S.clearRect(0, 0, SW, SH); soft(S);
    const b = Math.max(-0.7, Math.min(0.7, -(s.beta || 0) * 3.2));
    S.strokeStyle = 'rgba(242,245,247,0.5)'; S.lineWidth = 1; S.beginPath(); S.moveTo(SW / 2, 4); S.lineTo(SW / 2, SH - 2); S.stroke();
    S.strokeStyle = '#ff4a3d'; S.lineWidth = 3; S.lineCap = 'round'; S.beginPath(); S.moveTo(SW / 2, 5); S.quadraticCurveTo(SW / 2 + b * 14, SH * 0.5, SW / 2 + b * 34, SH - 4); S.stroke();
    S.fillStyle = '#e8e8e0'; S.fillRect(SW / 2 - 3, 2, 6, 4);
  }
}
const LW = 190, LH = 70, RW = 236, RH = 92, SW = 64, SH = 40, INK = '#f2f5f7', DIM = '#b9c7d1';
const NUM = (px) => `700 ${px}px "Courier New", monospace`, LAB = (px) => `600 ${px}px "Helvetica Neue", Arial, sans-serif`;
function soft(g) { g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 3; g.shadowOffsetY = 1; }
function bar(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
function tri(g, x, y, s, down, col) { g.fillStyle = col; g.beginPath(); if (down) { g.moveTo(x - s, y - s * 1.5); g.lineTo(x + s, y - s * 1.5); g.lineTo(x, y); } else { g.moveTo(x - s, y + s * 1.5); g.lineTo(x + s, y + s * 1.5); g.lineTo(x, y); } g.closePath(); g.fill(); }

/** vario tone: climb (m/s) -> {freq Hz, on (beeping), period s, duty} ; pure (tested) */
export function varioTone(climb) {
  if (climb > 0.25) {
    const c = Math.min(climb, 6);
    return { freq: 520 + c * 115, beep: true, period: Math.max(0.16, 0.62 - c * 0.08), duty: 0.55, gain: 1 };
  }
  if (climb < -1.0) { const c = Math.min(-climb, 6); return { freq: Math.max(160, 330 - c * 32), beep: false, period: 0, duty: 1, gain: 0.55 }; }
  return { freq: 0, beep: false, period: 0, duty: 0, gain: 0 };
}
export class Vario {
  constructor(audio) { this.audio = audio; this.osc = null; this.gain = null; this.ph = 0; this.vol = 0.05; this.on = false; this.muted = false; }
  _make() {
    const a = this.audio; if (!a || !a.ctx || this.osc) return;
    const ctx = a.ctx;
    this.osc = ctx.createOscillator(); this.osc.type = 'triangle'; this.osc.frequency.value = 600;
    this.gain = ctx.createGain(); this.gain.gain.value = 0;
    this.osc.connect(this.gain); this.gain.connect(a.master || ctx.destination); this.osc.start();
  }
  update(dt, climb, on) {
    this.on = on && !this.muted;
    if (!this.on) { if (this.gain) this.gain.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.03); return; }
    this._make(); if (!this.gain) return;
    const T = varioTone(climb), ctx = this.audio.ctx, now = ctx.currentTime;
    let g = 0;
    if (T.beep) { this.ph = (this.ph + dt / T.period) % 1; g = this.ph < T.duty ? this.vol : 0; }
    else if (T.gain) g = this.vol * T.gain;
    if (T.freq) this.osc.frequency.setTargetAtTime(T.freq * (T.beep ? 1 + 0.04 * this.ph : 1), now, 0.02);
    this.gain.gain.setTargetAtTime(g, now, 0.008);
  }
  stop() { if (this.gain) this.gain.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.03); }
}

/** the rush of air over the canopy: looped noise through a band-pass, louder and brighter with airspeed (one source) */
export class AirNoise {
  constructor(audio) { this.audio = audio; this.src = null; }
  _make() {
    const a = this.audio; if (!a || !a.ctx || this.src || !a.noiseBuf) return;
    const c = a.ctx;
    this.src = c.createBufferSource(); this.src.buffer = a.noiseBuf; this.src.loop = true;
    this.f = c.createBiquadFilter(); this.f.type = 'bandpass'; this.f.frequency.value = 500; this.f.Q.value = 0.6;
    this.g = c.createGain(); this.g.gain.value = 0;
    this.src.connect(this.f); this.f.connect(this.g); this.g.connect(a.master || c.destination); this.src.start();
  }
  /** V airspeed m/s, ab airbrakes 0..1, on = in the cockpit and moving */
  update(V, ab, on, cockpit) {
    const a = this.audio; if (!a || !a.ctx) return;
    if (!on) { if (this.g) this.g.gain.setTargetAtTime(0, a.ctx.currentTime, 0.15); return; }
    this._make(); if (!this.g) return;
    const k = Math.min(1, V / 60), now = a.ctx.currentTime;
    this.g.gain.setTargetAtTime((0.015 + 0.09 * k * k + 0.05 * ab * k) * (cockpit ? 1 : 0.6), now, 0.2);
    this.f.frequency.setTargetAtTime(300 + 1400 * k + 500 * ab, now, 0.2);
  }
}
