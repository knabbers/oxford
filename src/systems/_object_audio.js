// Small real-world sounds of things handled (2026-11-23, "remove the weird unnatural sounds like bings"): what used to
// be a rising pair of square-wave beeps when money changed hands, or a chime, is now the thing itself. All of it is
// made of core/audio.js one-shots (tone / noise), so `o` takes their options: pos + cls (spatial), pan, dest, gain (x).
//   coins(A, o)       coins put down on a counter: two to four short metallic clinks and the slide of one
//   bucketCoin(A, o)  a coin dropped through the slot of a plastic collecting bucket: the clink, the hollow knock
//   drip(A, when, f, k)  a drop into still water under an arch (a punt under a bridge)
//   cardBeep(A, o)    a card reader accepting a card: one short piezo beep (a real reader's, not a bing-bong), the
//                     door's electric strike letting go
const pick = (o, extra) => { const q = { ...extra }; if (o.pos) { q.pos = o.pos; q.cls = o.cls || 'small'; } if (o.pan) q.pan = o.pan; if (o.dest) q.dest = o.dest; return q; };

export function coins(A, o = {}) {
  if (!A || !A.ctx) return;
  const k = o.gain ?? 1, n = 2 + Math.floor(Math.random() * 3); let w = 0;
  for (let i = 0; i < n; i++) {
    const f = 4200 + Math.random() * 2600, g = 0.03 * k * (i ? 0.55 + 0.4 * Math.random() : 1), d = 0.05 + Math.random() * 0.08;
    A.tone(f, d, pick(o, { gain: g, when: w, attack: 0.0008 })); A.tone(f * (1.47 + Math.random() * 0.2), d * 0.6, pick(o, { gain: g * 0.45, when: w, attack: 0.0008 }));
    A.noise(0.012, pick(o, { gain: g * 1.6, freq: 3000, q: 1.5, when: w }));
    w += 0.06 + Math.random() * 0.12;
  }
  if (Math.random() < 0.6) A.noise(0.12 + Math.random() * 0.1, pick(o, { gain: 0.012 * k, freq: 5200, q: 1.2, when: w, attack: 0.02 }));      // one slid across the wood
}

export function bucketCoin(A, o = {}) {
  if (!A || !A.ctx) return;
  const k = o.gain ?? 1, f = 3600 + Math.random() * 1800;
  A.tone(f, 0.04, pick(o, { gain: 0.025 * k, attack: 0.0008 })); A.noise(0.01, pick(o, { gain: 0.04 * k, freq: 3200, q: 2 }));      // the coin on the slot's edge
  const w = 0.09 + Math.random() * 0.05;
  A.noise(0.09, pick(o, { gain: 0.09 * k, freq: 380 + Math.random() * 120, q: 3, when: w }));                                            // into the hollow plastic
  if (Math.random() < 0.7) { A.tone(f * 0.8, 0.05, pick(o, { gain: 0.018 * k, when: w + 0.004, attack: 0.0008 })); A.noise(0.05, pick(o, { gain: 0.04 * k, freq: 900, q: 2, when: w + 0.07 + Math.random() * 0.05 })); }      // on the coins already in it
}

export function cardBeep(A, o = {}) {
  if (!A || !A.ctx) return;
  const k = o.gain ?? 1;
  A.tone(2700 + Math.random() * 60, 0.11, pick(o, { type: 'square', gain: 0.012 * k, attack: 0.003 }));      // the reader's piezo: one short beep
  A.noise(0.05, pick(o, { gain: 0.12 * k, freq: 900, q: 2.5, when: 0.16 })); A.noise(0.03, pick(o, { gain: 0.06 * k, freq: 2400, q: 4, when: 0.17 }));      // the strike's solenoid clacking open
}

/** a drop falling into still water under an arch: the impact tick, then the bubble's quick upward chirp (a real drip "plop": the resonance of the air
 *  bubble it traps rises in pitch as the bubble closes — Minnaert), short and quiet, with a dull echo off the vault */
export function drip(a, when, f, k) {
  a.noise(0.012, { gain: 0.012 * k, freq: 3500, q: 1.5, when });
  const c = a.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f * 0.55, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.025);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018 * k, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.06);
  o.connect(g); g.connect(a.master); o.start(t); o.stop(t + 0.07); o.onended = () => { try { g.disconnect(); } catch { /* */ } };
  a.noise(0.18, { gain: 0.006 * k, freq: f * 0.7, q: 6, when: when + 0.07 });      // (the vault answering)
}
