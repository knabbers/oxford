// Exeter College, STANDALONE model: part 'chapelint': the CHAPEL'S INTERIOR (Scott 1856-9; Bodley's stalls 1884), a real
// room you walk into from the Front Quad (no fade, no teleport): the porch's two oak leaves (part 'chapel') -> the
// antechapel under the organ gallery -> the stone screen's arch (its iron gates open) -> the choir between the canopied
// stalls on the lozenge aisle -> the sanctuary's steps -> the altar under the apse's arcade. The stone rib vault (15.2 m to
// the crown) with banded webs, ribs and bosses, the clustered marble shafts, the windows' deep splays to the real stained
// glass (part 'chapel'), the rose over the organ, the tapestry, the north archway (shut), chandeliers lit after dark.
// The plan (every figure, its source, the K / G table): _exeter_chapelint_plan.js; the build: _exeter_chapelint_build.js;
// the shared pieces: _exeter_interior_kit.js. The shell (outer walls, glass, doors, the north projection) is part 'chapel'.
import { CHECKED } from './_exeter_chapelint_plan.js';
import { buildInterior } from './_exeter_chapelint_build.js';
import * as IK from './_exeter_interior_kit.js';

export { CHECKED };

export default {
  id: 'chapelint',
  title: 'the Chapel\'s interior: antechapel, screen and organ gallery, choir and stalls, vault, sanctuary and apse',
  replaces: [],
  CHECKED,
  build(ctx) {
    const r = buildInterior(ctx);
    if (typeof console !== 'undefined' && ctx.opts && ctx.opts.debug) console.log('[exeter] chapelint triangles', JSON.stringify(r.tris));
    return IK.chapelResult({ lights: r.lights });
  },
};
