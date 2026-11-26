// Exeter College, STANDALONE model: part 'broad' (survey B08): the BROAD STREET RANGE and the BROAD STREET TOWER: Scott's
// west part (staircases 10, 11), the gate tower with the passage into Margary Quad (a real way through), Underwood's east
// part with the east-end gable bay and its oriel, and the staircase 9 block (the Crowther Hunt Building) down the quad's
// east side to the Rector's Lodgings, with the internal courtyard. Brief: docs/handoff/exeter/briefs/broad.txt. The plan
// (every dimension with its source, the K / G table) is _exeter_broad_plan.js; the build functions _exeter_broad_build.js.
import { CHECKED } from './_exeter_broad_plan.js';
import { buildScott, buildWell, buildTower, buildUnderwood, buildBlock9, buildPavement, registerSolids } from './_exeter_broad_build.js';

export { CHECKED };

export default {
  id: 'broad',
  title: 'Broad Street range and tower, staircases 9 - 11 (B08)',
  // w301630468 / 469 (map "Staircase 10 / 11": Scott's part), w1418427621 (the tower), w301630478 ("Staircase 9": the east
  // block). w301630470 is wholly the Thomas Wood Building (part 'margary').
  replaces: ['w301630478', 'w1418427621', 'w301630468', 'w301630469'],
  CHECKED,
  build(ctx) {
    buildScott(ctx);
    buildWell(ctx);
    buildTower(ctx);
    buildUnderwood(ctx);
    buildBlock9(ctx);
    buildPavement(ctx);
    registerSolids(ctx);
    // (second pass: the workaround that re-registered the Rector's Lodgings' porch floors is gone: part 'margary' now builds
    // the forecourt before the door and its quad floor stops at it; the door's own threshold floor lies inside the wall)
    return null;
  },
};
