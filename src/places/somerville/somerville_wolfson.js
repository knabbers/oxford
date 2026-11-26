// Somerville College, STANDALONE model: part 'wolfson' (survey B06): the Wolfson Building (1966-7, Arup Associates;
// listed II, LE 1393210) with its brick stair links to Park and Penrose (the passage under the south one), the Flora
// Anderson Hall pavilion standing forward of its ground floor (NMLA 2011-13) with its sunk forecourt, and the Walton
// Street boundary wall from v 4 to the Penrose service gate's north pier (v 46) with the blocked gateway and the gate to
// the passage. Outside only. Brief: docs/handoff/somerville/briefs/wolfson.txt. The plan (every figure with its source,
// the K / G table): _somerville_wolfson_plan.js; the build functions: _somerville_wolfson_build.js.
import { CHECKED } from './_somerville_wolfson_plan.js';
import { buildWolfson } from './_somerville_wolfson_build.js';

export { CHECKED };
export default {
  id: 'wolfson',
  title: 'Wolfson (Arup, 1966-7), its stair links, the Flora Anderson Hall and the Walton Street wall (B06)',
  replaces: ['w97853773', 'w303765359'],
  CHECKED,
  build(ctx) { return buildWolfson(ctx); },
};
