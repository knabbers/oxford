// The sightseeing passport — pure rules (no DOM, no three.js): collecting every place module's `sights`, stamping
// them, saving / loading, area completion. Used by systems/passport.js and tools/smoke_passport.mjs.
//
// Where sights come from: every place module attaches its `sights` array ({id, name, x, z, blurb}) to its game hook
// (game.radcliffe.sights, game.chch.sights, game.museums.sights …), as the landmark brief asks. collect() scans the
// game object's own properties one level deep for such arrays (and any extra sources handed to it), so a module added
// later is picked up without touching this file. Duplicates (same id) keep the first one found.

export const STORE_KEY = 'gto-passport';
export const RANGE = 22;            // metres from the sight's point that count as "seen"
export const AREA_REWARD = 10;      // £ for stamping every sight of an area (areas with at least 2 sights)
export const ALL_REWARD = 50;       // £ for the whole passport

// friendly names for the game hooks we know; anything else is the hook's name, spaced out
const AREA = {
  radcliffe: 'Radcliffe Square & Broad Street', chch: 'Christ Church', botanic: 'Botanic Garden', magdalen: 'Magdalen',
  museums: 'Museums', portMeadow: 'Port Meadow', broadStreet: 'Broad Street', ccMeadow: 'Christ Church Meadow',
};
export function areaName(key) { return AREA[key] || String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()); }

const valid = (s) => s && typeof s.id === 'string' && s.id && typeof s.name === 'string' && Number.isFinite(s.x) && Number.isFinite(s.z);

/**
 * -> [{id, name, x, z, blurb, area, r}] in a stable order (by area name, then as listed).
 * sources: game-like object (scanned one level deep) and/or extra [{area, sights}].
 */
export function collect(game, extra = []) {
  const seen = new Set(), out = [];
  const take = (area, arr) => { if (!Array.isArray(arr)) return; for (const s of arr) { if (!valid(s) || seen.has(s.id)) continue; seen.add(s.id); out.push({ id: s.id, name: s.name, x: s.x, z: s.z, blurb: s.blurb || '', area, r: Number.isFinite(s.r) ? s.r : RANGE }); } };
  if (game) {
    for (const key of Object.keys(game)) {
      if (key === 'passport') continue;
      let v; try { v = game[key]; } catch { continue; }
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      let arr; try { arr = v.sights; } catch { continue; }
      if (Array.isArray(arr)) take(areaName(key), arr);
    }
  }
  for (const e of extra) take(e.area, e.sights);
  const order = new Map(); out.forEach((s, i) => order.set(s.id, i));
  out.sort((a, b) => (a.area < b.area ? -1 : a.area > b.area ? 1 : order.get(a.id) - order.get(b.id)));
  return out;
}

/** the sight within range of (x, z) that is not yet stamped (nearest first), or null */
export function due(list, stamps, x, z) {
  let best = null, bd = Infinity;
  for (const s of list) { if (stamps[s.id]) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < s.r && d < bd) { bd = d; best = s; } }
  return best;
}

/** areas -> [{area, total, done}] */
export function areas(list, stamps) {
  const m = new Map();
  for (const s of list) { let a = m.get(s.area); if (!a) m.set(s.area, (a = { area: s.area, total: 0, done: 0 })); a.total++; if (stamps[s.id]) a.done++; }
  return [...m.values()];
}
export const count = (list, stamps) => list.reduce((n, s) => n + (stamps[s.id] ? 1 : 0), 0);

/** stamp a sight: returns {stamped, reward, areaDone, allDone} and updates state (stamps / paid) in place */
export function stamp(state, list, s, now = 0) {
  if (state.stamps[s.id]) return { stamped: false, reward: 0 };
  state.stamps[s.id] = now || 1;
  let reward = 0, areaDone = null, allDone = false;
  const a = areas(list, state.stamps).find((q) => q.area === s.area);
  if (a && a.total >= 2 && a.done === a.total && !state.paid[a.area]) { state.paid[a.area] = true; reward += AREA_REWARD; areaDone = a.area; }
  if (list.length && count(list, state.stamps) === list.length && !state.paid.__all) { state.paid.__all = true; reward += ALL_REWARD; allDone = true; }
  return { stamped: true, reward, areaDone, allDone };
}

export function emptyState() { return { v: 1, stamps: {}, paid: {} }; }
/** parse a saved string (anything malformed -> empty state) */
export function parse(str) {
  try {
    const o = JSON.parse(str);
    if (!o || typeof o !== 'object' || typeof o.stamps !== 'object' || !o.stamps) return emptyState();
    const st = emptyState();
    for (const [k, v] of Object.entries(o.stamps)) if (typeof k === 'string' && Number.isFinite(+v)) st.stamps[k] = +v;
    if (o.paid && typeof o.paid === 'object') for (const [k, v] of Object.entries(o.paid)) if (v === true) st.paid[k] = true;
    return st;
  } catch { return emptyState(); }
}
export const serialise = (st) => JSON.stringify({ v: 1, stamps: st.stamps, paid: st.paid });
