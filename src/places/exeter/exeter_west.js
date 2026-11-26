// Exeter College, STANDALONE model: part 'west' (survey B01): the west range with the Turl Street front, the gate tower
// and the Porters' Lodge passage (staircases 7, 8, 1, 2). Brief: docs/handoff/exeter/briefs/west.txt. The plan (every
// dimension with its source, the K / G table) is _exeter_west_plan.js; the build functions _exeter_west_build.js.
// The passage is a real way through (floor, side walls, vault; doors and iron gates shown OPEN); so is the covered way
// (staircase 7) from the Front Quad's north-west corner north through the range to Margary Quad.
import { CHECKED } from './_exeter_west_plan.js';
import { buildStreet, buildQuad, buildRoof, buildTower, buildPassage, buildWay, buildBed, buildClosers, registerSolids } from './_exeter_west_build.js';

export { CHECKED };

export default {
  id: 'west',
  title: 'west range, Turl Street front, gate tower and lodge passage (B01)',
  replaces: ['w301630476', 'w301630477', 'w301630473', 'w227761181', 'w301630474'],
  CHECKED,
  build(ctx) {
    buildStreet(ctx);
    buildQuad(ctx);
    buildRoof(ctx);
    buildTower(ctx);
    buildPassage(ctx);
    buildWay(ctx);
    buildBed(ctx);
    buildClosers(ctx);
    registerSolids(ctx);
    return null;
  },
};
