// Gloucester Green, c. 2013 — photo comparison item 18 ("gloucester_green", docs/research/photo_comparison.md).
//
//   preMap   the square is ringed by red-brick blocks of flats and shops of 1987-90 (balconies, an arcade on the ground
//            floor, tiled roofs); the world drew them in pale stone. Restyled here. Its trees, a grid of planes in the
//            block paving, are drawn as planes by world/vegetation.js PLANE_AREAS (they were a mix with conifers).
//   GUESS    the exact blocks that are brick (the three round the square named in the map are; the bus station side
//            is not touched) and their roof material.
export const GG_BRICK = ['w154817146', 'w154817147', 'w114597554'];   // The Chilterns, The Heyes, the apartments on the south side

export default {
  id: 'gloucester_green',
  preMap(game) {
    try {
      const ov = game.overrides;
      for (const id of GG_BRICK) if (!ov.style.has(id)) ov.style.set(id, { wall: 'brick', roof: 'tile', tint: [1.04, 0.92, 0.86], up: 'brickPair', ivy: false });
    } catch (e) { console.error('[gloucester_green] preMap', e); }
  },
};
