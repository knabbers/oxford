// Somerville College, STANDALONE model: part 'vaughan' (survey B09): Vaughan and Margery Fry & Elizabeth Nuffield House
// (1958-66, Arup Associates, Philip Dowson), the podium over the Little Clarendon Street shops with its street arcade, the
// walkway round Vaughan's east end and along Fry's north side, the Terrace bar pavilion (adp 2011) and the passage from
// Little Clarendon Street under the decks to the Chapel forecourt. Outside only. Brief: docs/handoff/somerville/briefs/
// vaughan.txt. The plan (every figure with its source, the K / G table): _somerville_vaughan_plan.js; the build
// functions: _somerville_vaughan_build.js.
import { CHECKED } from './_somerville_vaughan_plan.js';
import { buildVaughanPart } from './_somerville_vaughan_build.js';

export { CHECKED };
export default {
  id: 'vaughan',
  title: 'Vaughan and Margery Fry (Arup, 1958-66), the podium and arcade on Little Clarendon Street, the Terrace, the passage (B09)',
  replaces: ['w97853781', 'w97853752', 'w303764432', 'w355810535'],
  CHECKED,
  build(ctx) { return buildVaughanPart(ctx); },
};
