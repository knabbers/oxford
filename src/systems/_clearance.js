// How thick the mapped boundaries are DRAWN (world/barriers.js). The collider holds only their centre lines, so a test
// like `collider.isFree(x, z, 0.2)` lets a bike stand 0.2 m from the middle of a hedge that is 0.9 m of leaves, or of a
// city wall that is 1.6 m of stone (2026-11 sanity check: "parked bikes standing inside a hedge"). Anything placed by a
// wall, hedge or fence asks barrierGap() for the distance to the drawn FACE instead. Pure, DOM-free; the same on every
// client (the collider is built from the shared map).
/** `?sanity=0` (GTO_SANITY=0 in node) turns the 2026-11 sanity-check placement rules off, for before / after shots from
 *  identical cameras (as ?houses=0, ?lanes=0): bikes, stands, the far crowd's lines and the street items by hedges. */
export const SANITY = !((typeof location !== 'undefined' && location && /[?&]sanity=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_SANITY === '0'));
export const BARRIER_HALF = { hedge: 0.45, wall: 0.21, city_wall: 0.8, retaining_wall: 0.25, fence: 0.03, railing: 0.03, guard_rail: 0.03 };

/** metres from (x, z) to the nearest drawn face of a mapped wall / hedge / fence / railing (negative = inside it);
 *  Infinity when none is within `reach` or the point is in a gateway (where the boundary is drawn open). */
export function barrierGap(col, x, z, reach = 1) {
  if (!col || !col._near) return Infinity;
  const R = reach + 0.8; let best = Infinity;
  col._near(x - R, z - R, x + R, z + R, (s) => {
    if (!s.seg || s.on === false) return;
    const half = BARRIER_HALF[s.tag]; if (half === undefined) return;
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1, l2 = dx * dx + dz * dz;
    let t = l2 ? ((x - s.x1) * dx + (z - s.z1) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - s.x1 - dx * t, z - s.z1 - dz * t) - half;
    if (d < best) best = d;
  });
  if (best > reach) return Infinity;
  return best < 0.2 && col.inPassage && col.inPassage(x, z) ? Infinity : best;
}

/** (x, z) pushed straight out of the nearest wall / hedge until its drawn face is `need` m away (at most `max` m of
 *  push); the same point back when it already is, or when it sits on the very line (no side to push to). -> [x, z] */
export function barrierPush(col, x, z, need, max = 0.9) {
  if (!col || !col._near || (col.inPassage && col.inPassage(x, z))) return [x, z];
  const R = need + 0.9; let best = null;
  col._near(x - R, z - R, x + R, z + R, (s) => {
    if (!s.seg || s.on === false) return;
    const half = BARRIER_HALF[s.tag]; if (half === undefined) return;
    const dx = s.x2 - s.x1, dz = s.z2 - s.z1, l2 = dx * dx + dz * dz;
    let t = l2 ? ((x - s.x1) * dx + (z - s.z1) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s.x1 + dx * t, pz = s.z1 + dz * t, d = Math.hypot(x - px, z - pz);
    if (!best || d - half < best.g) best = { g: d - half, d, px, pz };
  });
  if (!best || best.g >= need || best.d < 0.02 || need - best.g > max) return [x, z];
  const k = (need - best.g) / best.d;
  return [x + (x - best.px) * k, z + (z - best.pz) * k];
}
