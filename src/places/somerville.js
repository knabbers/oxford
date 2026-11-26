// Somerville College: the place module the game lists. The model itself is places/somerville/ (somerville.js and its
// parts; docs/handoff/somerville/README.md); its part files are loaded here, before preMap, so that install is ready.
import SOMERVILLE from './somerville/somerville.js';
await SOMERVILLE.prepare();
export default SOMERVILLE;
