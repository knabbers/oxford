// Exeter College, STANDALONE model: PLACEHOLDER masses. Every mapped building outline that no hand-built part has
// claimed (`replaces`) is stood up as a plain block to its LIDAR eaves level with a flat lead-grey top, so the model is
// whole while the parts are being built and a missing part shows as an obviously blank block, never as a gap.
// Everything here is a stand-in: it is not a statement about any building's form.
import { MASSES } from './_exeter_massing_data.js';

export const CHECKED = [
  ['placeholder blocks: mapped outline + LIDAR 35th-percentile level', 'G', 'map.json outlines; Environment Agency LIDAR 2022; no form intended'],
];

export default {
  id: 'massing', title: 'placeholder masses (unbuilt parts)', replaces: [], CHECKED,
  build(ctx) {
    const { B, K } = ctx; let n = 0;
    for (const m of MASSES) {
      if (ctx.claimed.has(m.id)) continue;
      K.prism(B, 'plaster', m.ring, -0.4, m.eaves, { top: true, topKey: 'lead' });
      ctx.solid(m.ring); ctx.placeholders.push(m.id + (m.name ? ' ' + m.name : '')); n++;
    }
    return { placeholders: n };
  },
};
