// Somerville College, STANDALONE model: part 'grounds' (survey G00), built FIRST: every other part draws over it. The
// base sheet under the whole site (inside SITE_RING, on the surveyed ground, on the lowest ground layer, cut exactly
// wherever a lawn, path or bed lies and wherever another part draws its own ground, with a skirt down at the boundary);
// the Quad (one lawn, its west third a made level held by a stone retaining wall over the brick setts and the Library
// path past Holtby), the Chapel lawn, Park lawn, Penrose lawn and a garden south of Maitland; the asphalt paths (the
// Library front, the cross path from Wolfson's walk to the Hall, the path to Park lawn, the east walk past the Hall and
// Maitland, the north - south path between two herbaceous borders to the Chapel forecourt, the path along the Chapel,
// the walk round Park lawn); borders, beds and a hedge; the trees (the blue Atlas cedar drawn here, the rest as the
// city's trees); lamp posts, benches, three sculptures; the boundary walls no building part builds. Brief:
// docs/handoff/somerville/briefs/grounds.txt. Plan (figures, sources, K / G): _somerville_grounds_plan.js; build:
// _somerville_grounds_build.js.
import { CHECKED } from './_somerville_grounds_plan.js';
import { buildGrounds } from './_somerville_grounds_build.js';

export { CHECKED };
export default {
  id: 'grounds',
  title: 'the grounds: base sheet, the Quad and its retaining wall, the lawns, paths, borders, trees, lamps, benches, sculptures, boundary walls (G00)',
  replaces: [],
  CHECKED,
  build(ctx) { return buildGrounds(ctx); },
};
