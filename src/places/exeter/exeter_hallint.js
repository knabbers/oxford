// Exeter College, STANDALONE model: part 'hallint': the HALL'S INTERIOR (1618), a real room you walk into from the
// quad (no fade, no teleport): the porch's two oak leaves -> the porch (rib-vaulted) -> the screens passage (Nash's
// vault, the gallery over it, the boxed stair, the doors to the servery) -> the screen's two doors (real leaves) -> the
// hall: coursed stone over oak panelling, the windows' deep splays with real glass and heraldic roundels, seven
// arch-braced collar trusses on carved corbels with three tiers of purlins and wind-braces, two fireplaces, three rows
// of tables with chairs and lit brass lamps, the dais with the high table and the oriel bay, portraits (no likeness).
// The plan (every figure, its source, the K / G table): _exeter_hallint_plan.js; the build: _exeter_hallint_build.js;
// what the Chapel's interior can reuse: _exeter_interior_kit.js. The shell (outer walls, glass, porch door) is part 'hall'.
import { CHECKED } from './_exeter_hallint_plan.js';
import { buildInterior } from './_exeter_hallint_build.js';
import * as IK from './_exeter_interior_kit.js';

export { CHECKED };

export default {
  id: 'hallint',
  title: 'the Hall\'s interior: porch, screens passage, screen and gallery, the hall and its roof, the dais',
  replaces: [],
  CHECKED,
  build(ctx) {
    const r = buildInterior(ctx);
    return IK.roomResult({ doors: r.doors, lights: r.lights });
  },
};
