// Exeter College, STANDALONE model: part 'hall' (survey B02): the Hall (1618) with its porch (1820), clock and dais oriel,
// and the south-west / south range (staircase 3, buttery and kitchen side; the Turl Street return and the Brasenose Lane
// corner). The Hall's windows are real glass and its porch door two real oak leaves (_exeter_interior_kit.js); the room
// behind them is part 'hallint' (exeter_hallint.js). The Hall stands in its own sheared frame (the survey: 3.8 deg off
// the quad), _exeter_hall_build.js hallToL. Brief: docs/handoff/exeter/briefs/hall.txt. The plan
// (every dimension with its source, the K / G table) is _exeter_hall_plan.js; the build functions _exeter_hall_build.js.
// It closes against the west range's party wall at v 20 and stops the Hall's north face at the east range (u 18.3).
import * as K from './_exeter_kit.js';
import { CHECKED } from './_exeter_hall_plan.js';
import { buildHall, buildSouthRange, registerSolids, porchDoors } from './_exeter_hall_build.js';
import * as IK from './_exeter_interior_kit.js';

export { CHECKED };

export default {
  id: 'hall',
  title: 'the Hall (1618), its porch and oriel, and the south-west range (B02)',
  replaces: ['w227762234', 'w301630475'],
  CHECKED,
  build(ctx) {
    K.addCell(ctx.pack, 'clockBlue', 'lead', 0x1f3474);      // the clock's plain blue dial (Sones 2012)
    K.addCell(ctx.pack, 'hallDoor', 'boards', 0x8f6a45);     // the porch's oiled oak door (Sones 2012)
    const gl = new IK.Glazing();
    buildHall(ctx, gl);
    buildSouthRange(ctx);
    registerSolids(ctx);
    gl.flush(ctx);
    return IK.roomResult({ doors: porchDoors(new IK.DoorSet()) });
  },
};
