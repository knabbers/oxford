// Exeter College (the Turl Street site): the place module the game lists. The model itself is places/exeter/ (exeter.js
// and its parts; docs/handoff/exeter/README.md); its part files are loaded here, before preMap, so that install is ready.
import EXETER from './exeter/exeter.js';
await EXETER.prepare();
export default EXETER;
