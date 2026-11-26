// Museums: the shared play layer of an interior — floors (multi-storey on a 2D collider), "Please don't touch"
// (walking into a case, a plinth or a skeleton: the nearest attendant tells you off; three times in a minute and they
// follow you about for half a minute), exhibits you can look at (and tick off the museum trail), upper-floor NPCs held
// at their floor's height, and a donation box. Used by natural_history_museum.js and ashmolean.js.
import { Patience, trailFind, trailState, trailClaim, TRAIL, TRAIL_PRIZE, hstr } from './_mus_logic.js';
import { randomLook } from '../core/characters.js';

const FOLLOW_GAP = 1.8;

/**
 * makePlay(game, ctx, def) -> controller
 *   def = { id, name, floors (Floors), touch: [{x, z, w, d, rot, floor, name, onTouch?}],
 *           staff: [{x, z, h, floor, role, lines?}], visitors: [{x, z, h, floor, pose?, wander?, look?, lines?}],
 *           exhibits: [{x, z, floor, r, label, title, lines, trail?}], donate: {x, z, floor, thanks} }
 */
export function makePlay(game, ctx, def) {
  const id = def.id, F = def.floors, L = F.levels;
  const patience = new Patience();
  const S = { staff: [], peds: [], held: [], t: 0, follow: null, touches: 0, lastTouch: null };
  const P = game.pedestrians;
  const spawn = (o, staff) => {
    if (!P) return null;
    const look = o.look || randomLook(`${id}-${staff ? 'staff' : 'vis'}-${o.x.toFixed(1)}-${o.z.toFixed(1)}`, staff ? { outfit: 'smart' } : undefined);
    if (staff) { look.jacket = 0x1c2236; look.jacketLen = 'short'; look.bottom = 0x1a1a22; look.hat = null; look.prop = null; look.backpack = null; }
    let ped = null;
    try {
      ped = P.spawnAt(o.x, o.z, look, { place: id, scene: ctx.scene, heading: o.h || 0, pose: o.pose || 'stand', knockable: false,
        lines: o.lines || null, wander: o.wander && (o.floor || 0) === 0 ? { radius: o.wander, speed: 0.55 } : null, role: staff ? 'museum-staff' : 'museum-visitor', label: o.label || null });
    } catch (e) { console.warn('[museums] spawn', e); return null; }
    const rec = { ped, o, floor: o.floor || 0, y: L[o.floor || 0] + (o.dy || 0) };
    if (rec.floor > 0 || o.dy) S.held.push(rec);
    return rec;
  };
  for (const o of def.staff || []) { const r = spawn(o, true); if (r) S.staff.push(r); }
  for (const o of def.visitors || []) { const r = spawn(o, false); if (r) S.peds.push(r); }

  // ---------------------------------------------------------------- exhibits (look; trail)
  for (const e of def.exhibits || []) {
    game.interact.add({
      place: id, pos: [e.x, L[e.floor || 0] + 0.1, e.z], radius: e.r || 1.8,
      label: () => { const t = trailState(game.state.flags); return e.trail && t.has && !t.done && !t.found.includes(e.trail) ? `Look at ${e.title} (trail!)` : `Look at ${e.title}`; },
      onUse: () => {
        const lines = (e.lines || []).slice();
        if (e.trail) {
          const r = trailFind(game.state.flags, e.trail), t = trailState(game.state.flags);
          if (r === 'found') { lines.push(`Museum trail: ${t.found.length} of ${TRAIL.length} found.`); game.save && game.save(); }
          else if (r === 'complete') { lines.push(`Museum trail: all ${TRAIL.length} found! Hand your leaflet in at any museum front desk.`); game.save && game.save(); }
        }
        if (e.onLook) e.onLook();
        game.ui.dialog(e.title, lines.length ? lines : [e.title]);
      },
    });
  }
  // ---------------------------------------------------------------- donation box
  if (def.donate) {
    const d = def.donate; let n = 0;
    game.interact.add({
      place: id, pos: [d.x, L[d.floor || 0] + 0.1, d.z], radius: 1.4, label: 'Donate £2 to the museum',
      onUse: () => {
        if (!game.pay(-2)) { game.ui.toast("You rummage in your pockets. Lint, mostly.", 3); return; }
        const T = d.thanks || ['Thank you!'];
        game.ui.toast(`The coin rattles down. A small card pops up: "${T[n++ % T.length]}"`, 4);
        game.state.flags.musDonated = (game.state.flags.musDonated || 0) + 2; game.save && game.save();
      },
    });
  }

  // ---------------------------------------------------------------- touching things
  const touch = def.touch || [];
  function nearestStaff(x, z) {
    let best = null, bd = Infinity;
    for (const s of S.staff) { if (!s.ped || !s.ped.active) continue; const d = Math.hypot(s.ped.x - x, s.ped.z - z) + (s.floor !== F.cur ? 100 : 0); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  /** distance from (x, z) to the oriented rectangle t */
  const distRect = (t, x, z) => {
    const c = Math.cos(t.rot || 0), s = Math.sin(t.rot || 0), dx = x - t.x, dz = z - t.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const qx = Math.max(0, Math.abs(lx) - t.w / 2), qz = Math.max(0, Math.abs(lz) - t.d / 2);
    return Math.hypot(qx, qz);
  };
  function checkTouch() {
    const pl = game.player; if (pl.place !== id || (pl.speed || 0) < 0.4 || game.activity) return null;
    for (const t of touch) {
      if ((t.floor || 0) !== F.cur) continue;
      if (distRect(t, pl.pos.x, pl.pos.z) > 0.42) continue;
      return t;
    }
    return null;
  }
  function onTouch(t) {
    S.touches++; S.lastTouch = t.name || 'case';
    if (t.onTouch) t.onTouch();
    const r = patience.touch(S.t); if (!r) return;
    const st = nearestStaff(game.player.pos.x, game.player.pos.z);
    const who = st && st.o.label ? st.o.label : 'Attendant';
    if (st && st.ped.character.say) st.ped.character.say(r.line, 3);
    game.ui.toast(`${who}: "${r.line}"`, 3);
    if (r.follow && st) startFollow(st);
  }
  function startFollow(st) {
    if (!P || !P.control) return;
    S.follow = st;
    P.control(st.ped, (ped, dt) => {
      const pl = game.player;
      const home = !patience.following(S.t) || pl.place !== id || st.floor !== F.cur;     // they do not chase you upstairs
      const tx = home ? st.o.x : pl.pos.x, tz = home ? st.o.z : pl.pos.z;
      const d = Math.hypot(tx - ped.x, tz - ped.z);
      if (home && d < 0.3) { ped.heading = st.o.h || 0; S.follow = null; return false; }
      if (!home && d < FOLLOW_GAP) { ped.speed = 0; ped.character.setPose && ped.character.setPose('stand'); ped.heading = Math.atan2(pl.pos.x - ped.x, pl.pos.z - ped.z); return true; }
      const v = Math.min(home ? 1.0 : 1.9, d * 1.2), a = Math.atan2(tx - ped.x, tz - ped.z);
      ped.x += Math.sin(a) * v * dt; ped.z += Math.cos(a) * v * dt; ped.heading = a; ped.speed = v;
      return true;
    });
  }

  // ---------------------------------------------------------------- staff sent to stand somewhere (closing time: by the door)
  /** walk staff member i along pts [[x, z]…] and stand at the last facing h; pts = null: back to their own spot */
  function post(i, pts, h = 0) {
    const st = S.staff[i]; if (!st || !st.ped || st.floor !== 0) return false;
    st.route = pts; st.routeI = 0; st.routeH = h;
    if (st.ctl || !P || !P.control) { if (!P || !P.control) { const t = pts ? pts[pts.length - 1] : [st.o.x, st.o.z]; st.ped.x = t[0]; st.ped.z = t[1]; st.ped.heading = pts ? h : st.o.h || 0; } return true; }
    st.ctl = true;
    P.control(st.ped, (ped, dt) => {
      if (S.follow === st) return true;
      const R = st.route, last = !R || st.routeI >= R.length - 1, tx = R ? R[Math.min(st.routeI, R.length - 1)][0] : st.o.x, tz = R ? R[Math.min(st.routeI, R.length - 1)][1] : st.o.z;
      const d = Math.hypot(tx - ped.x, tz - ped.z);
      if (d < 0.25) {
        if (!last) { st.routeI++; return true; }
        ped.speed = 0; ped.heading = R ? st.routeH : st.o.h || 0; ped.character.setPose && ped.character.setPose('stand');
        if (!R) { st.ctl = false; return false; }
        return true;
      }
      const v = Math.min(1.25, d * 1.5 + 0.2), a = Math.atan2(tx - ped.x, tz - ped.z);
      ped.x += Math.sin(a) * v * dt; ped.z += Math.cos(a) * v * dt; ped.heading = a; ped.speed = v;
      return true;
    });
    return true;
  }
  /** a line from staff member i: over their head, and as a toast */
  function say(i, line, secs = 5) {
    const st = S.staff[i] || S.staff[0], who = st && st.o.label ? st.o.label : 'Attendant';
    try { if (st && st.ped && st.ped.character.say) st.ped.character.say(line, secs); } catch { /* */ }
    game.ui.toast(`${who}: "${line}"`, secs);
  }

  // ---------------------------------------------------------------- per frame (only while inside)
  function update(dt) {
    S.t += dt;
    const pl = game.player;
    if (pl.place !== id) return;
    F.update(pl.pos.x, pl.pos.z);
    const t = checkTouch(); if (t) onTouch(t);
    // NPCs held at their floor's height (the interior's ground function answers for the player's floor only)
    for (const r of S.held) {
      const p = r.ped; if (!p || !p.active) continue;
      const y = S.follow === r ? F.ground(p.x, p.z) : r.y;
      p.y = p.gy = y; p.character.group.position.y = y;
      p.character.group.visible = Math.abs(y - pl.pos.y) < 9 || r.floor === F.cur;
    }
    if (S.follow && !S.held.includes(S.follow)) { const p = S.follow.ped; const y = F.ground(p.x, p.z); p.y = p.gy = y; p.character.group.position.y = y; }
  }
  return {
    update, patience, state: S, floors: F, post, say,
    /** simulate walking into touchable i (tests) */
    debugTouch(i = 0) { const t = touch[i]; if (t) onTouch(t); return S.touches; },
    following: () => !!S.follow && patience.following(S.t),
    remove() { if (P) for (const r of [...S.staff, ...S.peds]) { try { P.remove(r.ped); } catch { /* */ } } },
  };
}

/** a seed for anything per museum + thing (no Math.random) */
export const seedOf = (s) => hstr(s);

/**
 * game.museums: the shared hook for both museum modules (tests, screenshots, the trail).
 *   register(id, {floors, looks, parent})   debugEnter(id, floor = 0, look?) -> Promise<{x, z, h} | null>
 *   debugExit() -> Promise    eject(reason) -> Promise (out to the street from any museum interior)   list
 */
export function museumsApi(game) {
  if (game.museums) return game.museums;
  const reg = new Map();
  const api = {
    reg, sights: [],
    register(id, o) { reg.set(id, o); },
    inside() { const p = game.player.place; return reg.has(p) ? p : null; },
    async debugEnter(id, floor = 0, look = null) {
      const o = reg.get(id); if (!o) return null;
      if (game.player.place !== id) {
        if (o.parent && game.player.place !== o.parent) await api.debugEnter(o.parent, 0);
        await game.interiors.enter(id, o.door);
      }
      o.floors && o.floors().set(floor);
      return look && o.looks && o.looks[look] ? o.looks[look] : null;
    },
    // (a walk-in museum — core/interiors.js "seamless" — has no door fade: being shown out at closing time is its own
    //  cut, under a fade, to the lawn outside its door)
    async eject() {
      for (let i = 0; i < 4 && api.inside(); i++) {
        const cur = game.interiors.current;
        if (cur && cur.sl && game.ui.fade) await game.ui.fade(() => game.interiors.leaveNow()); else await game.interiors.exit();
      }
    },
    async debugExit() { return api.eject(); },
  };
  game.museums = api;
  return api;
}

/** the museum trail desk: pick up a leaflet / hand it in */
export function trailDesk(game, label = 'Information desk') {
  const f = game.state.flags, t = trailState(f);
  if (!t.has) {
    t.has = true; game.save && game.save();
    game.ui.dialog(label, ['Here\'s a museum trail leaflet. Six things to find across the three museums:', ...TRAIL.map((e, i) => `${i + 1}. ${e.name} — ${e.clue}`), `Find all six and hand it in at any front desk for a small prize.`]);
    return 'leaflet';
  }
  if (t.done) { game.ui.dialog(label, ['You\'ve done the trail already. We\'ve got nothing else, honestly.']); return 'done'; }
  const prize = trailClaim(f);
  if (prize) { game.pay(prize); game.save && game.save(); game.ui.dialog(label, ['All six! Very good.', `Here's £${TRAIL_PRIZE} and a sticker that says "I Found The Dodo".`]); return 'prize'; }
  const left = TRAIL.filter((e) => !t.found.includes(e.id));
  game.ui.dialog(label, [`${t.found.length} of ${TRAIL.length} so far. Still to find:`, ...left.map((e) => `• ${e.name} — ${e.clue}`)]);
  return 'progress';
}

