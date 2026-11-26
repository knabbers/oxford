// Somerville College, STANDALONE model: part 'hughes' (survey B12): the Catherine Hughes Building (2017-19, Niall
// McLaughlin Architects): the four storey west block on Walton Street with its corbelled bays and cut-back shoulders,
// the five storey block and the east end, flat roofs with PV; Bedford House (1875) with its gable to the street and its
// forecourt; the Penrose service gate (open); the court between Penrose and the CHB with the courtyard, its trees and
// benches; the yard south of the CHB; Barbara Craig House (2016) on Little Clarendon Street. Outside only. Brief:
// docs/handoff/somerville/briefs/hughes.txt. The plan (every figure with its source, the K / G table):
// _somerville_hughes_plan.js; the build functions: _somerville_hughes_build.js.
import { CHECKED } from './_somerville_hughes_plan.js';
import { buildHughes } from './_somerville_hughes_build.js';

export { CHECKED };
export default {
  id: 'hughes',
  title: 'Catherine Hughes Building, Bedford House, Barbara Craig House, the service gate and the south-west courts (B12)',
  replaces: ['w131312897', 'w1040787563', 'w131312905'],
  CHECKED,
  build(ctx) { return buildHughes(ctx); },
};
