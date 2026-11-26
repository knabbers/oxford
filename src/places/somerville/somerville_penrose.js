// Somerville College, STANDALONE model: part 'penrose' (survey B07): Penrose (1925-27, Harold Rogers), the red-brown
// brick neo-Georgian range in the college's south-west corner: the range with its Walton Street cross wing, the centre
// bay with the stone doorcase to the Penrose lawn, the stair block behind it, the east pavilion and its wing along the
// Fellows' Garden with the three-arched loggia; hipped clay-tile roofs with dormers, rooflights and corniced stacks; the
// beds and walks at its walls. Outside only. Brief: docs/handoff/somerville/briefs/penrose.txt. The plan (every figure
// with its source, the K / G table): _somerville_penrose_plan.js; the build functions: _somerville_penrose_build.js.
import { CHECKED } from './_somerville_penrose_plan.js';
import { buildPenrose } from './_somerville_penrose_build.js';

export { CHECKED };
export default {
  id: 'penrose',
  title: 'Penrose (Harold Rogers, 1925-7): the range, the west wing, the east pavilion and wing with the loggia (B07)',
  replaces: ['w97853758'],
  CHECKED,
  build(ctx) { return buildPenrose(ctx); },
};
