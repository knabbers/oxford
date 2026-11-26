// Exeter College, STANDALONE model: part 'east' (survey B04 + B05): the east range of the Front Quad (Peryam's Building
// 1618 to the south, the Armagh Building 1708 to the north; staircases 4, 5, 6) with the passage of staircase 5 through
// to the garden side, and Palmer's Tower (1432) with the way round past it to the Rector's Lodgings. Brief:
// docs/handoff/exeter/briefs/east.txt. The plan (every dimension with its source, the K / G table) is
// _exeter_east_plan.js; the build functions _exeter_east_build.js.
import { CHECKED } from './_exeter_east_plan.js';
import { buildQuad, buildGarden, buildEnds, buildRoof, buildPassage, buildBed, buildCreeper, buildTower, buildWay, registerRangeSolids, registerTowerSolids, rangeCtx, rangeFrame } from './_exeter_east_build.js';

export { CHECKED };

export default {
  id: 'east',
  title: 'east range (Peryam 1618, Armagh 1708; staircases 4, 5, 6) and Palmer\'s Tower (B04, B05)',
  replaces: ['w301630465', 'w301630466', 'w301630467', 'w301630479'],
  CHECKED,
  build(ctx) {
    // the range in its own frame (turned 1.25 deg: the topographic survey), the tower in its own (5.3 deg), the way LOCAL
    const cr = rangeCtx(ctx);
    ctx.B.push(rangeFrame());
    const holes = buildQuad(cr);
    buildGarden(cr);
    buildEnds(cr);
    buildRoof(cr);
    buildPassage(cr);
    buildBed(cr);
    buildCreeper(cr, holes);
    registerRangeSolids(cr);
    ctx.B.pop();
    buildTower(ctx);
    buildWay(ctx);
    registerTowerSolids(ctx);
    return null;
  },
};
