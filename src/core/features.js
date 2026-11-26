// Feature flags: whole features switched off for the "raw feel" (find your own way; cycle, don't warp). The code
// behind each flag is kept and works; git history holds the earlier always-on behaviour. game.features is the live
// object (core/game.js). Turn one back on for a session from the URL:
//   ?minimap=1     the round minimap, bottom-left (core/ui.js; its per-frame drawing is skipped while it is off)
//   ?map=1         the full-screen map on M (core/ui.js toggleBigMap, core/game.js _key)
//   ?fasttravel=1  anything that moves you across the city without you travelling it (see docs/ARCHITECTURE.md
//                  "Feature flags" for the list; e.g. the gliding club's retrieve crew driving you back)
//   ?invented=1    invented business names instead of the real ones (world/tradenames.js and the places' own
//                  invented names; GTO_INVENTED=1 in node tools). Off by default: shops, pubs, cafés … show their real
//                  names (docs/ARCHITECTURE.md "Trade names")
// A value of 0 / false / off turns a flag off, anything else (including a bare ?map) turns it on.

export const DEFAULTS = Object.freeze({ minimap: false, bigmap: false, fastTravel: false, invented: false });
/** flag -> the URL parameters that set it (first match wins) */
export const PARAMS = Object.freeze({ minimap: ['minimap'], bigmap: ['map', 'bigmap'], fastTravel: ['fasttravel', 'fastTravel'], invented: ['invented'] });

/** pure: the flags for a query string ('?map=1&…'), the defaults otherwise */
export function readFeatures(search = '') {
  const f = { ...DEFAULTS };
  let q = null;
  try { q = new URLSearchParams(search || ''); } catch { return f; }
  for (const [name, keys] of Object.entries(PARAMS)) {
    for (const k of keys) {
      if (!q.has(k)) continue;
      f[name] = !/^(0|false|off|no)$/i.test(q.get(k) || '');
      break;
    }
  }
  return f;
}

/** the flags for this page (location.search), or the defaults where there is no location (node tools) */
export function pageFeatures() {
  let s = '';
  try { s = (typeof location !== 'undefined' && location.search) || ''; } catch { /* no location */ }
  return readFeatures(s);
}

/**
 * invented business names on? (?invented=1 in the page, GTO_INVENTED=1 in node). Read at call time, so a place module's
 * module-level names follow the flag of the page (or the process) that imported it.
 */
export function inventedNames() {
  try { if (typeof process !== 'undefined' && process.env && process.env.GTO_INVENTED) return !/^(0|false|off|no)$/i.test(process.env.GTO_INVENTED); } catch { /* */ }
  return pageFeatures().invented;
}
/** every [real, invented] pair tn() was asked for (tools/audit_brands.mjs: nothing invented may show by default) */
export const tnLog = new Map();
/** the real name of a premises by default, its invented one under ?invented=1 */
export const tn = (real, invented) => { if (real !== invented) tnLog.set(invented, real); return inventedNames() ? invented : real; };
