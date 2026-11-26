// University Parks cricket match: pure schedule (no DOM, no three.js) shared by _parks_people.js and tools/smoke_parks.mjs.
// Everything derives from the shared clock (seconds), so all players see the same ball, outcome and bowling end.
export const TB = 30, BALLS = 6, CHANGE = 40, OVER = TB * BALLS + CHANGE;   // seconds per ball / over (+ changeover)
// fielding positions for a right-hander, bowling from +a (s = +1 frame): a along the pitch towards the pavilion, b across
// (off side b < 0). Metres from the centre of the square. Rope ≈ 60 m (56 m towards the pavilion).
export const POS = {
  striker: [-8.9, 0.35], nonstriker: [9.6, 1.5], bowler: [28, 0.8], keeper: [-24, 0], midoff: [24, -14],
  slip: [-22.5, -2.4], gully: [-17, -9], point: [-9, -26], cover: [4, -31], midon: [24, 13], midwicket: [0, 31], fineleg: [-44, 22], thirdman: [-46, -24],
  umpB: [12.2, 0], umpS: [-8.9, 24],
};
export const FIELD = ['slip', 'gully', 'point', 'cover', 'midon', 'midwicket', 'fineleg', 'thirdman'];
export const SHOTS = ['point', 'cover', 'midon', 'midwicket', 'fineleg', 'thirdman'];
export const CAST = ['batA', 'batB', 'bowlA', 'bowlB', 'keeper', ...FIELD, 'umpA', 'umpB'];
export const hash = (n) => { let t = (n * 2654435761) >>> 0; t ^= t >>> 15; t = Math.imul(t, 0x2c1b3c6d) >>> 0; t ^= t >>> 12; return (t >>> 0) / 4294967296; };
/** role of cast member k in an over of parity p (0 even, 1 odd): batsmen swap striker, bowlers alternate, umpires swap */
export const roleOf = (k, p) => {
  if (k === 'batA') return p ? 'nonstriker' : 'striker'; if (k === 'batB') return p ? 'striker' : 'nonstriker';
  if (k === 'bowlA') return p ? 'midoff' : 'bowler'; if (k === 'bowlB') return p ? 'bowler' : 'midoff';
  if (k === 'umpA') return p ? 'umpS' : 'umpB'; if (k === 'umpB') return p ? 'umpB' : 'umpS';
  return k;
};
/** -> {over, parity, s (bowling end ±1), ball (0..5, 6 = changeover), tb (s into the ball), change, outcome, chaser} */
export function ballAt(nowS, out = {}) {
  const over = Math.floor(nowS / OVER), tin = nowS - over * OVER, parity = over & 1, s = parity ? -1 : 1;
  const ball = Math.min(BALLS, Math.floor(tin / TB)), tb = tin - ball * TB, change = ball >= BALLS;
  const n = over * BALLS + ball, r = hash(n + 17);
  const outcome = change ? 'none' : r < 0.22 ? 'leave' : r < 0.5 ? 'defend' : r < 0.86 ? 'run' : 'four';
  out.over = over; out.parity = parity; out.s = s; out.ball = ball; out.tb = tb; out.tin = tin; out.change = change; out.outcome = outcome;
  out.chaser = SHOTS[Math.floor(hash(n * 3 + 5) * SHOTS.length)]; out.n = n;
  return out;
}
