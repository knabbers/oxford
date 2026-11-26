// Somerville College, STANDALONE model: part 'darbishire' (survey B01): Darbishire Quad (Morley Horder, 1932-34) and the
// Woodstock Road front: the west, north and lodge ranges round the court with the square bay, the pedimented centre gable
// and the arch to the Traffic Quad; the tall north-east block on the street; the Porters' Lodge range with its round
// arch (open, walkable, steps up inside) between two pavilions; the gateway block with the vehicle way and the lane
// behind the court's south wall; the court's sunk lawns, raised walks and terraces; the forecourt strip with its cycle
// hoops and flagpole; the Loverose Way boundary wall from the corner to the Hostel. Outside only (no interiors).
// Brief: docs/handoff/somerville/briefs/darbishire.txt. The plan (every figure with its source, the K / G table):
// _somerville_darbishire_plan.js; the build functions: _somerville_darbishire_build.js.
import { CHECKED } from './_somerville_darbishire_plan.js';
import { buildDarbishire } from './_somerville_darbishire_build.js';

export { CHECKED };
export default {
  id: 'darbishire',
  title: 'Darbishire Quad and the Porters\' Lodge on Woodstock Road (Morley Horder, 1932-34) (B01)',
  replaces: ['r4047418', 'r4047418_1', 'w227470836'],
  CHECKED,
  build(ctx) { return buildDarbishire(ctx); },
};
