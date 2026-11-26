// Exeter College: the two walk-in rooms' CEILINGS, for the follow camera. The Hall and the Chapel are real rooms in the
// world scene (no fade, no teleport), so the game's camera treats them as out of doors and, looking down at the player,
// would rise through the roof. exeter.js gives the game `game.roofOver` (core/game.js: the highest the camera may be at
// a point while the player is in the same room). Pure figures from the two interior plans; LOCAL frame, y above the datum.
import * as HP from './_exeter_hallint_plan.js';
import * as CP from './_exeter_chapelint_plan.js';
import { inRing } from './_exeter_shared.js';

/** the Hall's own sheared frame: hall z from LOCAL (u, v) (_exeter_hallint_plan.js header) */
const hallZ = (u, v) => v - 0.066 * (u - 9.25);
const inHall = (u, v) => { const z = hallZ(u, v); return u > HP.ROOM.uW && u < HP.ROOM.uE && z > HP.ROOM.zN && z < HP.ROOM.zS; };
const inChapel = (u, v) => inRing(u, v, CP.INNER);
/** which room a LOCAL point is in: 'hall', 'chapel' or null */
export const roomAt = (u, v) => (inHall(u, v) ? 'hall' : inChapel(u, v) ? 'chapel' : null);
/** the underside of what is over a LOCAL point of that room (the boarded roof, the vault, the gallery), y above the datum */
export function ceilingAt(room, u, v) {
  if (room === 'hall') {
    if (!inHall(u, v)) return null;
    if (u < HP.ROOM.screenE) return HP.F + HP.VAULT.crown;                              // the screens passage under the gallery
    const half = (HP.ROOM.zS - HP.ROOM.zN) / 2, d = Math.abs(hallZ(u, v) - HP.MID);
    return HP.F + HP.HT.plate + HP.PITCH * Math.max(0, half - d);                         // the rafters: wall plate to ridge
  }
  if (room === 'chapel') {
    if (!inChapel(u, v)) return null;
    if (u < CP.SCREEN.u0) return CP.GALLERY.under;                                       // the antechapel under the organ gallery
    // a pointed tunnel across the vessel; the apse the same about its centre
    const d = u > CP.C[0] ? Math.hypot(u - CP.C[0], v - CP.C[1]) : Math.abs(v - CP.C[1]), t = Math.min(1, d / CP.HW);
    return CP.SPRING + (CP.CROWN - CP.SPRING) * Math.sqrt(1 - t * t);
  }
  return null;
}
