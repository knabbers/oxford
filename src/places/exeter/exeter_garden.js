// Exeter College, STANDALONE model: part 'garden' (survey G04 + G05 + G06): the Fellows' Garden (lawn, gravel paths,
// beds, the pond, trees, benches), the Mound (the raised terrace in the south-east corner: its planted bank, the walk,
// both stairs, the gardener's shed) and the boundary wall on Brasenose Lane and Radcliffe Square. Brief:
// docs/handoff/exeter/briefs/garden.txt. The plan (every dimension with its source, the K / G table) is
// _exeter_garden_plan.js; the build functions _exeter_garden_build.js. No buildings: replaces nothing.
import { CHECKED } from './_exeter_garden_plan.js';
import { buildGround, buildWall, buildStairs, buildPond, buildPlants, buildBenches } from './_exeter_garden_build.js';

export { CHECKED };

export default {
  id: 'garden',
  title: 'Fellows\' Garden, the Mound and the Brasenose Lane / Radcliffe Square wall (G04 - G06)',
  replaces: [],
  CHECKED,
  build(ctx) {
    const shapes = buildGround(ctx);
    buildWall(ctx);
    buildStairs(ctx);
    buildPond(ctx);
    const plants = buildPlants(ctx, shapes);
    buildBenches(ctx);
    return { plants };
  },
};
