// Pixel-cost pass (2026-11): the order the opaque things are drawn in on the top tier.
//
// three draws opaque objects sorted by material (then by distance), which is the order with the fewest state changes
// and says nothing about what hides what. On the top tier the frame is bound by fragment work, not by draw calls
// (world/post.js: half the pixels, half the frame), and the surfaces with the dearest shaders are the big ones: with
// the stock order the ground was drawn early and then covered — the quads and lawns behind a college front, the
// street behind a parked van — 2.2 to 2.9 shaded fragments for every pixel of the picture. Here the buildings (every
// atlas material: the city's facades, the hand-built kits) go first, then everything else as three had it, then the
// ground last, so what a wall or a person hides is rejected by the depth test before it is shaded. Opaque things only,
// within a render-order group: nothing changes in the picture (the depth test decides, as before). Measured on a
// Radeon Pro 460 at 1080p: Worcester front -3.0 ms, the Parks, the High and Main Quad -1.5.
// `?order=0`: three's own order (A/B).
export const PX_ORDER = { on: true };
try { if (new URLSearchParams(location.search).get('order') === '0') PX_ORDER.on = false; } catch (e) { /* no location */ }

const rank = (m) => {
  let r = m._pxRank;
  if (r === undefined) { r = m.name === 'ground' ? 2 : m.defines && m.defines.ATLAS_NX !== undefined ? 0 : 1; m._pxRank = r; }
  return r;
};
/** for renderer.setOpaqueSort: three's own stable order with the rank put before the material */
export function opaqueOrder(a, b) {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  const ra = rank(a.material), rb = rank(b.material);
  if (ra !== rb) return ra - rb;
  if (a.material.id !== b.material.id) return a.material.id - b.material.id;
  if (a.z !== b.z) return a.z - b.z;
  return a.id - b.id;
}
