// The sounds of core/_doors.js that are more than a burst of noise (no THREE here: tools/audio/amb_harness.js renders
// them offline). 2026-11-23: real mechanisms — a dry hinge, a door operator's motor, a shopkeeper's bell — in place of
// the steady tones (a creak of two notes a fifth apart, a 96 Hz hum) that sounded like bings.
/** a dry hinge pin: stick-slip pulses (a sawtooth whose rate wanders 40-120 Hz) through the leaf's resonance */
export function hingeCreak(a, g) {
  const c = a.ctx, t = c.currentTime + 0.01, d = 0.22 + Math.random() * 0.4, f0 = 45 + Math.random() * 45;
  const o = c.createOscillator(), bp = c.createBiquadFilter(), bp2 = c.createBiquadFilter(), G = c.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t);
  for (let i = 1; i <= 5; i++) o.frequency.linearRampToValueAtTime(f0 * (0.8 + 0.9 * Math.random()) * (1 + i * 0.08), t + (d * i) / 5);
  bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 900; bp.Q.value = 4; bp2.type = 'bandpass'; bp2.frequency.value = 2400 + Math.random() * 900; bp2.Q.value = 3;
  G.gain.setValueAtTime(0, t); G.gain.linearRampToValueAtTime(0.055 * g, t + d * 0.25); G.gain.linearRampToValueAtTime(0.032 * g, t + d * 0.6); G.gain.linearRampToValueAtTime(0.046 * g, t + d * 0.8); G.gain.linearRampToValueAtTime(0, t + d);
  o.connect(bp); o.connect(bp2); bp.connect(G); bp2.connect(G); G.connect(a.master);
  o.start(t); o.stop(t + d + 0.03); o.onended = () => { try { G.disconnect(); bp.disconnect(); bp2.disconnect(); } catch { /* */ } };
}
/** an automatic door's operator: a small motor running up and down (a filtered buzz, no steady note), the leaves on
 *  their runners (a soft rumble) and the brush seals */
export function slideMotor(a, g) {
  const c = a.ctx, t = c.currentTime + 0.01, d = 0.9 + Math.random() * 0.25, f = 55 + Math.random() * 15;
  const o = c.createOscillator(), lp = c.createBiquadFilter(), G = c.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.6, t); o.frequency.linearRampToValueAtTime(f * (1.4 + Math.random() * 0.2), t + d * 0.35); o.frequency.linearRampToValueAtTime(f * 1.3, t + d * 0.7); o.frequency.linearRampToValueAtTime(f * 0.5, t + d);
  lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
  G.gain.setValueAtTime(0, t); G.gain.linearRampToValueAtTime(0.013 * g, t + 0.15); G.gain.setValueAtTime(0.013 * g, t + d * 0.7); G.gain.linearRampToValueAtTime(0, t + d);
  o.connect(lp); lp.connect(G); G.connect(a.master); o.start(t); o.stop(t + d + 0.03); o.onended = () => { try { G.disconnect(); lp.disconnect(); } catch { /* */ } };
  a.noise(d, { gain: 0.03 * g, freq: 420, q: 0.6, attack: 0.15, type: 'lowpass' });            // the runners
  a.noise(d * 0.8, { gain: 0.018 * g, freq: 3800, q: 0.7, attack: 0.2 });                        // the brushes along the floor
  a.noise(0.06, { gain: 0.05 * g, freq: 600, q: 1.2, when: d - 0.04 });                          // the leaves arriving
}
/** a shopkeeper's bell on a spring: struck by the leaf, then the clapper rattling against it as it swings */
export function shopBell(a, g) {
  const c = a.ctx, t0 = c.currentTime + 0.03, f = 2050 + Math.random() * 500, n = 3 + Math.floor(Math.random() * 4);
  let t = t0, k = 1;
  for (let i = 0; i < n; i++) {
    for (const [m, amp, d] of [[1, 1, 1.1], [2.09, 0.45, 0.6], [3.58, 0.22, 0.35], [5.1, 0.1, 0.2]]) {
      const o = c.createOscillator(), G = c.createGain(); o.frequency.value = f * m * (1 + (Math.random() - 0.5) * 0.004);
      G.gain.setValueAtTime(0, t); G.gain.linearRampToValueAtTime(0.014 * g * k * amp, t + 0.0015); G.gain.exponentialRampToValueAtTime(0.00001, t + d * (0.5 + 0.5 * k)); G.gain.linearRampToValueAtTime(0, t + d + 0.01);
      o.connect(G); G.connect(a.master); o.start(t); o.stop(t + d + 0.03); o.onended = () => { try { G.disconnect(); } catch { /* */ } };
    }
    a.noise(0.008, { gain: 0.01 * g * k, freq: 5000, q: 2, when: t - c.currentTime });     // the clapper's tick
    t += 0.07 + Math.random() * 0.09; k *= 0.45 + Math.random() * 0.2;
  }
}
