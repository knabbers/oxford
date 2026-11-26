// Exeter College, STANDALONE model: part 'library' (survey B07): the Library (George Gilbert Scott, 1856-7) in the
// Fellows' Garden with its stair turret, the annexe running north along the Convocation House and the 2021-3 link
// block, as they stand after the 2021-3 refurbishment; outside only (no interior in this pass). Also its own plinth,
// thresholds, the paving at its doors, the raised path along its north face and the wall with a gate between the east
// range and its west end. Brief: docs/handoff/exeter/briefs/library.txt. The plan (every figure with its source, the
// K / G table): _exeter_library_plan.js; the build functions: _exeter_library_build.js.
import { CHECKED } from './_exeter_library_plan.js';
import { buildLibrary } from './_exeter_library_build.js';

export { CHECKED };
export default {
  id: 'library',
  title: 'the Library (Scott, 1856-7), its stair turret, the annexe and the 2021-3 link (B07)',
  replaces: ['w114575323'],
  CHECKED,
  build(ctx) { return buildLibrary(ctx); },
};
