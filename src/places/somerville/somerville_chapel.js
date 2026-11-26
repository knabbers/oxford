// Somerville College, STANDALONE model: part 'chapel' (survey B08): the Chapel (1932 - 35, Courtenay Theobald), a pale
// ashlar box with narrower end blocks, three round-headed windows a side in pedimented aedicules, balustrade panels in the
// parapet, hipped stone-slate roofs in two heights, the west door, the north door, the iron escape on the east end; the
// Fellows' Garden west of it (lawn, round bed and sundial, borders and walks, the north wall with its door and lean-to
// shed, the rubble east wall and the clipped hedge); the forecourt at the west end, the wide steps up to the kitchen-garden
// terrace south of the Chapel (raised beds, glasshouse, frames) with its retaining walls to the walkway (part 'vaughan'
// beyond u -4.9 and v 80.0). Outside only, doors shut. Brief: docs/handoff/somerville/briefs/chapel.txt. The plan (every
// figure with its source, the K / G table): _somerville_chapel_plan.js; the build functions: _somerville_chapel_build.js.
import { CHECKED } from './_somerville_chapel_plan.js';
import { buildChapel } from './_somerville_chapel_build.js';

export { CHECKED };
export default {
  id: 'chapel',
  title: 'the Chapel (Courtenay Theobald, 1935), the Fellows\' Garden, the forecourt, steps and terrace south of it (B08)',
  replaces: ['w97853784'],
  CHECKED,
  build(ctx) { return buildChapel(ctx); },
};
