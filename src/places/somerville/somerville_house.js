// Somerville College, STANDALONE model: part 'house' (survey B02): House (Walton House, about 1826, raised and extended
// 1881 and 1895) with its rubble-stone front, pedimented porch, brick bay and slate mansard, the 1881 wing with its stone
// and brick gables, the east part with the Traffic Quad entrance, balcony and clock cupola, the north-east block; the
// Hostel (the 1950 brick range over its open ground floor and the older stone-and-brick range); Morley Horder's triple
// brick ARCHWAY to the Quad (open and walkable); the Traffic Quad and the drive. Outside only. Brief:
// docs/handoff/somerville/briefs/house.txt. The plan (every figure with its source, the K / G table):
// _somerville_house_plan.js; the build functions: _somerville_house_build.js.
import { CHECKED } from './_somerville_house_plan.js';
import { buildHouse } from './_somerville_house_build.js';

export { CHECKED };
export default {
  id: 'house',
  title: 'House (Walton House), the Hostel, the archway to the Quad and the Traffic Quad (B02)',
  replaces: ['w97853788', 'w97853764'],
  CHECKED,
  build(ctx) { return buildHouse(ctx); },
};
