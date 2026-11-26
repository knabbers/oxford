// Dynamic props over the network — pure (no THREE, no DOM): one relay event per knock, nothing per frame.
//
//   'pk'  [id, t, dvx, dvy, dvz, cx, cy, cz, flags (, x, y, z)]      all integers, ≈ 45–70 bytes of JSON
//         id     the prop: streetscape item index (< 1e6), world furniture 2e6 + set·1e5 + instance, park ball 3e6 + n
//         t      shared-clock ms of the knock (game.time.now()): seeds the litter scatter, dates the restore
//         dv     velocity change given to the prop at the contact point (cm/s; impulse / mass)
//         c      contact point relative to the prop's foot (cm, world axes)
//         flags  1 bent over (bollards), 2 a ball (x, y, z = where the kicker had it, cm), 4 sheared post
// Every peer replays the knock on its own copy of the prop with the same numbers, so the same bin goes over the same
// way for everybody; afterwards each simulates locally (no body sync). Late joiners see the street as it is
// for them (props come back on their own after a few minutes anyway).
export const KNOCK = 'pk';

export function encodeKnock(k) {
  const a = [k.id | 0, Math.round(k.t), Math.round(k.dv[0] * 100), Math.round(k.dv[1] * 100), Math.round(k.dv[2] * 100), Math.round(k.c[0] * 100), Math.round(k.c[1] * 100), Math.round(k.c[2] * 100), k.flags | 0];
  if (k.at) a.push(Math.round(k.at[0] * 100), Math.round(k.at[1] * 100), Math.round(k.at[2] * 100));
  return a;
}

export function decodeKnock(a) {
  if (!Array.isArray(a) || (a.length !== 9 && a.length !== 12)) return null;
  for (const x of a) if (!Number.isFinite(x)) return null;
  const k = { id: a[0] | 0, t: a[1], dv: [a[2] / 100, a[3] / 100, a[4] / 100], c: [a[5] / 100, a[6] / 100, a[7] / 100], flags: a[8] | 0, at: null };
  if (Math.hypot(k.dv[0], k.dv[1], k.dv[2]) > 60 || Math.hypot(k.c[0], k.c[1], k.c[2]) > 12 || k.id < 0) return null;
  if (a.length === 12) k.at = [a[9] / 100, a[10] / 100, a[11] / 100];
  return k;
}
