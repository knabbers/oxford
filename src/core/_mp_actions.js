// What a player is holding, carrying, wearing and visibly doing, the same on every other player's screen.
//
// Each player has one small RECORD of named slots (JSON values): { held: 'pint', basket: ['t', ['jaffa']], act: ['piano', t0], ... }.
// A module writes its own slot when the thing changes (never per frame):
//     game.net.actions.set('basket', ['t', ids])        // null clears the slot
//     game.net.setCarried('pint')                        // slot 'held': a prop the character model can hold (PROPS in characters.js)
//     game.net.setActivity('piano', { seat: 2 })         // slot 'act': [id, start time on the shared clock, params]
// and says how that slot LOOKS on another player's figure:
//     game.net.actions.kind('basket', { apply(o, value, A) { ...build on o.character... }, remove(o) {...}, update(o, value, dt) {...} })
//     game.net.actions.activity('piano', { apply(o, [id, t0, params]) {...}, remove(o) {...}, update(o, v, dt) {...} })
// (o = that player's entry in net.others: o.character, o.x/y/z/h, o.place, o.id, o.name.) apply() is called again whenever the
// value changes or their figure is rebuilt; remove() before that and when they leave.
//
// On the wire: the whole record goes out as ONE event ('ax', [rev, record]) when it has changed, at most ~4 a second, and
// the 10 Hz player state carries only its revision number (s[10], core/net.js). Anyone whose copy of a player's record is
// not at the revision that player's state announces asks that player for it ('ax?', to them alone) — which is how a late
// joiner, a lost message and a host migration all come right, with nothing sent while nothing changes.
//
// Built in: 'look' (changes to the look since joining: the shopping bag, a costume, the club wardrobe — picked up from
// game.player.look by itself, nothing to call), 'held' (a prop in the hand), 'cf' (plain flags set on the character,
// e.g. { phoneUp: 1 }), 'act' (dispatch to the handler registered for the activity id; with none registered, an
// activity whose params name a pose — { pose: 'sit' } — is simply shown in that pose).
import { createCharacter } from './characters.js';

const MAX_BYTES = 1500;      // a record is a few dozen bytes; anything bigger than this is a bug and is not sent
const MIN_GAP = 0.25;        // s between two sends of the record
const ASK_GAP = 1.5;         // s between two asks of the same player
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function createActions(game, net) {
  const rec = {};              // our own record
  const kinds = new Map();     // slot -> { apply, remove, update }
  const acts = new Map();      // activity id -> { apply, remove, update }
  const A = { rev: 0, sent: 0, bytes: 0, asks: 0 };
  let dirty = false, gap = 0, lookT = 0, look0 = null, lookSeen = null;

  // ------------------------------------------------------------------ ours
  /** Set (or with null / undefined clear) one slot of our record. Returns true when it changed. */
  A.set = (slot, value) => {
    if (value === undefined) value = null;
    const had = slot in rec;
    if (value === null) { if (!had) return false; delete rec[slot]; }
    else { if (had && same(rec[slot], value)) return false; rec[slot] = JSON.parse(JSON.stringify(value)); }
    A.rev = (A.rev % 999999) + 1; dirty = true;
    return true;
  };
  A.get = (slot) => rec[slot] ?? null;
  A.record = () => rec;
  /** another player's value of a slot (null if none) */
  A.of = (o, slot) => (o && o.ax && o.ax.rec[slot] !== undefined ? o.ax.rec[slot] : null);
  /** every other player's value of a slot: fn(value, o) */
  A.each = (slot, fn) => { for (const o of net.others.values()) { const v = A.of(o, slot); if (v !== null) fn(v, o); } };

  // ------------------------------------------------------------------ how a slot looks on someone else
  const call = (h, fn, o, v, dt) => { if (h && h[fn]) { try { h[fn](o, v, fn === 'update' ? dt : A); } catch (e) { console.error('[mp actions]', fn, e); } } };
  A.kind = (slot, h) => {
    kinds.set(slot, h);
    for (const o of net.others.values()) { const v = A.of(o, slot); if (v !== null) call(h, 'apply', o, v); }      // (a module that loaded after the record arrived)
    return A;
  };
  A.activity = (id, h) => {
    acts.set(id, h);
    for (const o of net.others.values()) { const v = A.of(o, 'act'); if (v && v[0] === id) call(h, 'apply', o, v); }
    return A;
  };
  // the figure is rebuilt (a change of look): everything that was built on the old one is taken off first and put back after
  const FIG = { look: 1, held: 1 };      // (the two slots that ARE the figure)
  const strip = (o) => { if (o.ax) for (const k in o.ax.rec) if (!FIG[k]) call(kinds.get(k), 'remove', o, o.ax.rec[k]); };
  const dress = (o) => { if (o.ax) for (const k in o.ax.rec) if (!FIG[k]) call(kinds.get(k), 'apply', o, o.ax.rec[k]); };
  const rebuild = (o) => {
    const patch = (o.ax && o.ax.rec.look) || null, held = (o.ax && o.ax.rec.held) || null;
    const base = o.look && o.look.skin !== undefined ? o.look : null;
    if (!base && !patch && !held) return;
    const L = { ...(base || o.character.look || {}), ...(patch || {}) };
    if (held) { L.prop = held; delete L.hold; }
    const key = JSON.stringify(L); if (o._axLook === key) return;
    o._axLook = key;
    strip(o);
    const old = o.character, parent = old.group.parent;
    let ch; try { ch = createCharacter(L); } catch (e) { console.error('[mp actions] look', e); dress(o); return; }
    old.group.removeFromParent(); old.dispose();
    o.character = ch; ch.setLabel(o.name); ch.group.rotation.order = 'YXZ';
    ch.group.position.copy(old.group.position); ch.group.rotation.y = old.group.rotation.y;
    try { ch.setPose(o.pose || 'stand'); ch.blend = 1; } catch { /* */ }
    if (parent) parent.add(ch.group);
    dress(o);
  };
  kinds.set('look', { apply: rebuild, remove: rebuild });
  kinds.set('held', { apply: rebuild, remove: rebuild });
  kinds.set('cf', {
    apply(o, v) { o._axCf = v; if (v && typeof v === 'object') for (const k in v) o.character[k] = v[k]; },
    remove(o) { const v = o._axCf; o._axCf = null; if (v && typeof v === 'object') for (const k in v) o.character[k] = typeof v[k] === 'number' ? 0 : null; },
  });
  // an activity: the handler registered for its id; with none, a pose named in its params
  const actPose = (o, v) => (v && v[2] && typeof v[2].pose === 'string' ? v[2].pose : null);
  kinds.set('act', {
    apply(o, v) { const h = acts.get(v && v[0]); if (h) call(h, 'apply', o, v); },
    remove(o, v) { const h = acts.get(v && v[0]); if (h) call(h, 'remove', o, v); if (actPose(o, v)) { try { o.character.setPose(o.pose || 'stand'); } catch { /* */ } } },
    update(o, v, dt) { const h = acts.get(v && v[0]); if (h) call(h, 'update', o, v, dt); else { const p = actPose(o, v); if (p && o.character.pose !== p) { try { o.character.setPose(p); } catch { /* */ } } } },
  });

  // ------------------------------------------------------------------ switches (a light anyone can turn on or off)
  // slot 'sw' { name: [on, time] }: the latest change of each switch wins, and whoever sees a newer one than their own
  // carries it on in their own record — so it outlives the player who pressed it for as long as anyone is in the room.
  const swFns = new Map();
  /** we press a switch */
  A.switch = (name, on) => { const m = { ...(rec.sw || {}) }; m[name] = [on ? 1 : 0, Math.round(game.time.now())]; A.set('sw', m); };
  /** fn(on) whenever another player's press of that switch is the newest */
  A.onSwitch = (name, fn) => { swFns.set(name, fn); return A; };
  kinds.set('sw', { apply(o, v) {
    if (!v || typeof v !== 'object') return;
    let m = null;
    for (const k in v) {
      const q = v[k], mine = (rec.sw || {})[k]; if (!Array.isArray(q) || !(q[1] > (mine ? mine[1] : 0))) continue;
      (m || (m = { ...(rec.sw || {}) }))[k] = [q[0] ? 1 : 0, q[1]];
      const fn = swFns.get(k); if (fn) { try { fn(!!q[0]); } catch (e) { console.error('[mp actions] switch', e); } }
    }
    if (m) A.set('sw', m);
  } });

  // ------------------------------------------------------------------ theirs
  const take = (o, d) => {
    if (!o || !Array.isArray(d) || !d[1] || typeof d[1] !== 'object') return;
    const next = d[1], prev = o.ax ? o.ax.rec : {};
    // (remove what went or changed, with the record still the old one; then apply what came or changed, with the new)
    for (const k in prev) if (!(k in next) || !same(prev[k], next[k])) { if (k !== 'look' && k !== 'held') call(kinds.get(k), 'remove', o, prev[k]); }
    o.ax = { rev: d[0] | 0, rec: next };
    let fig = false;
    for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      if (same(prev[k], next[k])) continue;
      if (k === 'look' || k === 'held') fig = true; else if (k in next) call(kinds.get(k), 'apply', o, next[k]);
    }
    if (fig) rebuild(o);
  };
  net.on('ax', (d, o) => take(o, d));
  net.on('ax?', (d, o) => { if (o && A.rev) net.sendTo(o.id, 'ax', [A.rev, rec]); });
  /** a player is leaving (core/net.js _remove): take off whatever was built on them */
  A.drop = (o) => { strip(o); o.ax = null; };

  const push = () => {
    const js = JSON.stringify(rec);
    if (js.length > MAX_BYTES) { console.error('[mp actions] record too big, not sent:', js.length); return; }
    net.send('ax', [A.rev, rec]); A.sent++; A.bytes += js.length + 24;
  };
  A.update = (dt) => {
    // our look, as it is now against the one we joined with (the bag from the shop, a costume, the club wardrobe)
    if ((lookT -= dt) <= 0) {
      lookT = 0.5;
      const p = game.player, L = p && p.look, H = net._hello && net._hello.look;
      if (L && H && (L !== lookSeen || H !== look0)) {
        lookSeen = L; look0 = H;
        let patch = null;
        if (L !== H) for (const k of new Set([...Object.keys(L), ...Object.keys(H)])) if (!same(L[k], H[k])) (patch || (patch = {}))[k] = L[k] === undefined ? null : L[k];
        A.set('look', patch);
      }
    }
    for (const o of net.others.values()) {
      // their record is not the one their state announces: ask them for it
      const want = o.arev | 0, have = o.ax ? o.ax.rev : 0;
      if (want !== have && net.connected) { if ((o._axAsk = (o._axAsk || 0) - dt) <= 0) { o._axAsk = ASK_GAP; net.sendTo(o.id, 'ax?', 1); A.asks++; } }
      if (o.ax && o.character.group.parent) for (const k in o.ax.rec) { const h = kinds.get(k); if (h && h.update) call(h, 'update', o, o.ax.rec[k], dt); }
    }
    gap -= dt;
    if (dirty && gap <= 0 && net.connected) { dirty = false; gap = MIN_GAP; push(); }
  };
  return A;
}
