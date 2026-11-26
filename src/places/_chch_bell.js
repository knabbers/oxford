// Great Tom (6¼ tons, Hodson 1680; strike note A per the Dove database): one synthesised stroke = the partials of a
// large bell (hum an octave below, prime, minor-third tierce, quint, nominal) with long decays, through a panner,
// gain and arrival delay from the distance (heard across the city). No allocation beyond the oscillators themselves.
// Level (2026-11, after "a banging every 2 seconds, really loud" from Worcester, 740 m off): it falls away properly
// with distance (under the tower it is a great bell; from Worcester a distant one), it plays into the ambience's bells
// (so it is dulled by the walls of the room you are in, silent in a cellar, and follows the U and - = volume keys), and
// away from Christ Church only the first strokes are heard, fading under: 101 strokes at one every 2.2 s is 3.7 real
// minutes of every 24, which from across the town is a nuisance and not an event. Within 250 m all 101 are struck.
export const tomLevel = (d) => 0.22 / (1 + Math.pow(Math.max(0, d) / 110, 1.5));
/** how much of stroke k (1-based) is heard at d metres: all of them near the tower; further off the first ten, then fading out by the 24th */
export const tomFade = (k, d) => (d < 250 ? (k <= 12 ? 1 : 0.7) : k <= 10 ? 1 : Math.max(0, 1 - (k - 10) / 14));
export class TomBell {
  constructor(game, x, z) { this.game = game; this.x = x; this.z = z; }
  /** strike now (+ `when` s); loud = 0..1 extra (the 101st, a little firmer) */
  strike(when = 0, loud = 0, k = 1) {
    const A = this.game.audio; if (!A || !A.ctx || !A.running) return false;
    const p = A.place(this.x, this.z, 3200); if (p.gain < 0.0004) return false;
    const delay = Math.min(6, p.dist / 343), g = tomLevel(p.dist) * tomFade(k, p.dist) * (1 + loud * 0.2);
    if (!(g > 0.002)) return false;
    const amb = this.game.ambience, S = amb && amb.synth, dest = (S && S.G && S.G.bells) || A.ambience || null;      // the ambience's bells: through the wall of the room you are in
    const pan = p.pan, f = 220;
    // [ratio, relative gain, decay s]
    for (const [r, kk, d] of [[0.5, 0.55, 9], [1, 0.8, 6.5], [1.2, 0.45, 4], [1.5, 0.3, 3], [2, 0.38, 2.4], [2.51, 0.14, 1.3], [3, 0.1, 0.9]]) {
      A.tone(f * r, d, { type: 'sine', gain: g * kk * (p.dist > 600 ? (r > 1.6 ? 0.4 : 1) : 1), attack: 0.004, when: when + delay, pan, dest });
    }
    A.noise(0.08, { gain: g * 0.25 * (p.dist < 200 ? 1 : 0.2), freq: 1800, q: 0.8, when: when + delay, pan, dest });
    return true;
  }
}
