// Exeter College, STANDALONE model: part 'chapel' - the Chapel (George Gilbert Scott, 1856-9) with its fleche: the shell.
// Its windows are open with real stained glass, the south door two real oak leaves (_exeter_interior_kit.js); the room
// behind them is part 'chapelint' (exeter_chapelint.js). Also the north projection (vestry) with the north door over part
// 'margary''s steps, and the planted beds between the south buttresses. Brief: docs/handoff/exeter/briefs/chapel.txt; survey B03.
// The plan (every measured or guessed figure, its source, the K / G table): _exeter_chapel_plan.js.
// The build functions: _exeter_chapel_build.js. Replaces the map's outline w60903334 (and its placeholder block).
import { CHECKED } from './_exeter_chapel_plan.js';
import { buildChapel } from './_exeter_chapel_build.js';

export { CHECKED };
export default {
  id: 'chapel', title: 'the Chapel (Scott, 1856-9) and its fleche', replaces: ['w60903334'], CHECKED,
  build(ctx) { return buildChapel(ctx); },
};
