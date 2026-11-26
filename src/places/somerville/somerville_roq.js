// Somerville College, STANDALONE model: part 'roq' (survey B11): ROQ West (four storeys) and ROQ East (three storeys), the
// student blocks of 2010 - 11 by Niall McLaughlin Architects on the north boundary, with their oak window boxes, fin-clad
// stair towers and glazed lanterns, the college gate between them onto Loverose Way (drawn open) with the paved square
// inside it, and the college's side of the boundary west of ROQ West. Outside only. Brief:
// docs/handoff/somerville/briefs/roq.txt. The plan (every figure with its source, the K / G table): _somerville_roq_plan.js;
// the build functions: _somerville_roq_build.js.
import { CHECKED } from './_somerville_roq_plan.js';
import { buildRoq } from './_somerville_roq_build.js';

export { CHECKED };
export default {
  id: 'roq',
  title: 'ROQ West and ROQ East (Niall McLaughlin, 2011), the north gate (B11)',
  replaces: ['w296174577', 'w296174578'],
  CHECKED,
  build(ctx) { return buildRoq(ctx); },
};
