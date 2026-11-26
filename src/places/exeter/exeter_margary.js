// Exeter College, STANDALONE model: part 'margary' (survey B09 + G02): the THOMAS WOOD BUILDING (Brett & Pollen, 1964;
// staircases 12, 13, 14: the Broad Street wing with the corner block, the Turl Street wing, the six-storey tower at the
// Chapel end) and MARGARY QUAD's ground (setts, flagged footways and driveway, the basement stair and landing in its
// south-west corner, the north end of the covered way from the Front Quad, the way round the apse, "Alma Mater", cycle
// stands, a tree, the lamps). Brief: docs/handoff/exeter/briefs/margary.txt. The plan (every dimension with its
// source, the K / G table) is _exeter_margary_plan.js; the build functions _exeter_margary_build.js.
import { CHECKED } from './_exeter_margary_plan.js';
import { addCells, buildBroad, buildWing, buildTower, buildCorner, buildGround, buildFurniture, registerSolids } from './_exeter_margary_build.js';

export { CHECKED };

export default {
  id: 'margary',
  title: 'Thomas Wood Building (staircases 12 - 14) and Margary Quad (B09, G02)',
  // w301630470 (map "Staircase 12") is the Broad Street wing only: its east end (u -4.3 on the map, -4.0 here) is the
  // party wall with Scott's range; none of it is Scott's. w301630471 the corner block + the Turl wing's north part,
  // w301630472 the Turl wing's south part + the tower.
  replaces: ['w301630470', 'w301630471', 'w301630472'],
  CHECKED,
  build(ctx) {
    addCells(ctx.pack);
    buildBroad(ctx);
    buildWing(ctx);
    buildTower(ctx);
    const corner = buildCorner(ctx);
    buildGround(ctx, corner);
    buildFurniture(ctx);
    registerSolids(ctx, corner);
    return null;
  },
};
