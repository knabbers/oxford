// Somerville College, STANDALONE model: part 'hodgkin' (survey B10): the DOROTHY HODGKIN QUAD and the MARGARET THATCHER
// CENTRE (1985 - 91, Geoffrey Beard / Oxford Architects Partnership) round their raised court over the MTC's rooms,
// RADCLIFFE HOUSE (the Principal's house) with its glass-roofed link, the LISA MINOPRIO GARDEN east of Maitland, the
// covered way from the Hall - Maitland loggia passage down Maitland's back, and the Oratory's block w303766520 (not the
// college's). Outside only. Brief: docs/handoff/somerville/briefs/hodgkin.txt. The plan (every figure with its source,
// the K / G table): _somerville_hodgkin_plan.js; the build functions: _somerville_hodgkin_build.js.
import { CHECKED } from './_somerville_hodgkin_plan.js';
import { buildHodgkin } from './_somerville_hodgkin_build.js';

export { CHECKED };
export default {
  id: 'hodgkin',
  title: 'the Dorothy Hodgkin Quad, the Margaret Thatcher Centre, Radcliffe House and the Lisa Minoprio Garden (1985 - 91) (B10)',
  replaces: ['w228186801', 'w303766519', 'w1040787564'],      // (w303766520, the Oratory's block, is drawn by the city)
  CHECKED,
  build(ctx) { return buildHodgkin(ctx); },
};
