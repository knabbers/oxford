// Somerville College, STANDALONE model: part 'hall' (survey B03): the Hall (Edmund Fisher, 1911 - 13) with its pedimented
// west front, tall hall windows and hipped stone-slate roof; the kitchens east of it with their tower and roof plant (and
// the lower range on north towards Walton House, to LOCAL v -6); the recessed three-storey link with its three-bay
// loggia, balcony and the open way through to the east; Maitland (Fisher, 1910 - 13), three storeys round a small yard
// with its panelled parapet, flat roofs and stacks. Outside only; also the flower beds and flags at their feet. Brief:
// docs/handoff/somerville/briefs/hall.txt. The plan (every figure with its source, the K / G table):
// _somerville_hall_plan.js; the build functions: _somerville_hall_build.js.
import { CHECKED } from './_somerville_hall_plan.js';
import { buildHall } from './_somerville_hall_build.js';

export { CHECKED };
export default {
  id: 'hall',
  title: 'the Hall, its kitchens, the loggia link and Maitland (Fisher, 1910 - 13) (B03)',
  replaces: ['w1040787560', 'w97853780', 'w97853751'],
  CHECKED,
  build(ctx) { return buildHall(ctx); },
};
