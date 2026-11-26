// Invented business names (world/tradenames.js). This system only notes the map's raw business names before any place
// module's preMap runs (systems' preMaps all run first), so that applyTradeNames — called by world/index.js buildWorld
// once every preMap is done — can tell which premises a hand-built place has already renamed (theirs win) and replace
// every other real business name. No install, nothing per frame. Audit: tools/audit_brands.mjs, tools/smoke_brands.mjs.
import { noteRawNames } from '../world/tradenames.js';

export default {
  id: 'tradenames',
  preMap(game) { try { noteRawNames(game.map); } catch (e) { console.error('[tradenames] preMap', e); } },
};
