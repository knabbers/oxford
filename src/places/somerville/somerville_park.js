// Somerville College, STANDALONE model: part 'park' (survey B05): Park (formerly West; H. W. Moore, 1885 - 95; listed II
// as "West Building"): the west wing on Walton Street with its carriage arch, the double-pile main range to Park Lawn,
// the north block, the court with the shower block and the workshop range, the east wing to the Quad with its three
// gables and shaped south gable; the Walton Street gate with West (Park) Lodge and the boundary wall south to Wolfson's;
// St Paul's Nursery (119a Walton Street). Outside only. Brief: docs/handoff/somerville/briefs/park.txt. The plan (every
// figure with its source, the K / G table): _somerville_park_plan.js; the build functions: _somerville_park_build.js.
import { CHECKED } from './_somerville_park_plan.js';
import { buildPark } from './_somerville_park_build.js';

export { CHECKED };
export default {
  id: 'park',
  title: 'Park (H. W. Moore, 1885 - 95), the Walton Street gate and West Lodge, St Paul\'s Nursery (B05)',
  replaces: ['r1404465', 'w303766882'],
  CHECKED,
  build(ctx) { return buildPark(ctx); },
};
