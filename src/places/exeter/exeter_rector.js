// Exeter College, STANDALONE model: part 'rector' (survey B05 Chapel Row, B06, G03): the Rector's Lodgings (G. G. Scott
// 1857; the garden back remodelled 1947-9), Chapel Row east of Palmer's Tower, and the Rector's Garden with the Schools
// wall and the north wall. Brief: docs/handoff/exeter/briefs/rector.txt. The plan (every dimension with its source, the
// K / G table) is _exeter_rector_plan.js; the build functions _exeter_rector_build.js.
// Neighbours: part 'east' (Palmer's Tower u 17.0 .. 23.2, its covered way to u 27.3 at v -18.6 .. -16.6), part 'library'
// (the annexe and the raised path on the garden's south side), part 'broad' (stops against the west block's north
// party wall LOCAL (23.48, -38.49) - (32.04, -37.68) and the north wing's west wall), part 'margary' (the quad's ground
// west of the west front: the porch and its steps reach 2.8 m out from the face at v -30.6 .. -33.2).
import { CHECKED } from './_exeter_rector_plan.js';
import { buildHouse, buildChapelRow, buildGarden, registerSolids } from './_exeter_rector_build.js';

export { CHECKED };

export default {
  id: 'rector',
  title: 'Rector\'s Lodgings (Scott 1857, back 1947-9), Chapel Row and the Rector\'s Garden (B05, B06, G03)',
  replaces: ['w301630464'],
  CHECKED,
  build(ctx) {
    buildHouse(ctx);
    buildChapelRow(ctx);
    buildGarden(ctx);
    registerSolids(ctx);
    return null;
  },
};
