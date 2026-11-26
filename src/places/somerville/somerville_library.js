// Somerville College, STANDALONE model: part 'library' (survey B04): the Library (Basil Champneys, 1903) with its
// glazed loggia, frontispiece, pavilions and lower east block, and Holtby (Geddes Hyslop, 1951 - 56) west of it with its
// pier loggia and balcony: the one range along the north side of the main Quad, outside only. Also their plinths, the
// Library's steps and handrail, the planted strips and the flagged apron at their feet, the brick raised bed at the east
// end and the gravel of the narrow gap to ROQ West. Brief: docs/handoff/somerville/briefs/library.txt. The plan (every
// figure with its source, the K / G table): _somerville_library_plan.js; the build functions: _somerville_library_build.js.
import { CHECKED } from './_somerville_library_plan.js';
import { buildLibrary } from './_somerville_library_build.js';

export { CHECKED };
export default {
  id: 'library',
  title: 'the Library (Champneys, 1903) and Holtby (Hyslop, 1956) (B04)',
  replaces: ['w97853782', 'w228236349'],
  CHECKED,
  build(ctx) { return buildLibrary(ctx); },
};
