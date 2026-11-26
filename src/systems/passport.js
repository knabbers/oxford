// The sightseeing passport. Every place module's `sights` ({id, name, x, z, blurb}) are collected (_passport_logic.js
// collect(): scanned from the game hooks the modules attach, so new places join without changes here). Walking within
// ~22 m of a sight for the first time stamps it: a toast with its name, blurb and the running count ("7/42"). P opens
// the passport: every area, its sights stamped or still to find (unfound ones are counted but not named: the user wants
// places found by exploring, 2026-11). Stamping every sight of an area pays £10, the whole
// passport £50. Progress is kept in localStorage (wrapped in try/catch: a blocked store just means it is not kept).
// Nothing goes over the network.
//
// Test hooks: game.passport = { list(), state, count(), total(), open(), close(), refresh(), check(x, z), reset() }
import { collect, due, areas, count, stamp, parse, serialise, emptyState, STORE_KEY, AREA_REWARD, ALL_REWARD } from './_passport_logic.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  id: 'passport',
  install(game) {
    let state = emptyState();
    try { const s = globalThis.localStorage && localStorage.getItem(STORE_KEY); if (s) state = parse(s); } catch { /* storage blocked */ }
    const save = () => { try { globalThis.localStorage && localStorage.setItem(STORE_KEY, serialise(state)); } catch { /* storage blocked */ } };
    let list = [], refreshT = 0, checkT = 0, open = false, err = false;
    const refresh = () => { list = collect(game); return list; };

    function check(x, z) {
      const s = due(list, state.stamps, x, z); if (!s) return null;
      const r = stamp(state, list, s, (game.time && game.time.now()) || Date.now());
      if (!r.stamped) return null;
      save();
      const n = count(list, state.stamps);
      // one line (2026-11 play pass: the whole blurb was two paragraphs across the middle of the screen while cycling):
      // riding or driving just the name; on foot the first sentence too. The page on P has the rest.
      const moving = !!(game.player && game.player.vehicle), first = String(s.blurb || '').split(/(?<=[.!?])\s+/)[0] || '';
      try { game.ui.toast(`Passport stamped (${n}/${list.length}): ${s.name}.${!moving && first && first.length <= 150 ? ' ' + first : ''}${moving || first !== s.blurb ? ' (P: read more)' : ''}`, moving ? 3.5 : 5.5); } catch { /* */ }
      // (no sound: the stamp used to chime, two notes up — a bing on walking past a sight, often a college gate. 2026-11-23)
      if (r.reward) {
        try { game.pay(r.reward); } catch { /* */ }
        try { game.ui.toast(r.allDone ? `Every sight in Oxford stamped! The passport office sends £${ALL_REWARD}.` : `${r.areaDone}: every sight stamped. £${AREA_REWARD} from the tourist office.`, 6); } catch { /* */ }
      }
      if (open) render();
      return { sight: s, ...r };
    }

    // ---- the passport page (P)
    function render() {
      const o = game.ui.openOverlay();
      const box = document.createElement('div');
      box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,92vw);max-height:84vh;overflow:auto;background:#1d2236;border:3px solid #b9974f;border-radius:10px;padding:18px 24px;color:#f1ead6;font-family:Georgia,serif;box-shadow:0 10px 40px rgba(0,0,0,.6)';
      const n = count(list, state.stamps);
      let html = `<div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #b9974f;padding-bottom:6px;margin-bottom:10px"><div style="font-size:24px;color:#e6c97f;letter-spacing:1px">OXFORD · SIGHTSEEING PASSPORT</div><div style="font-size:22px">${n}/${list.length}</div></div>`;
      for (const a of areas(list, state.stamps)) {
        html += `<div style="margin:12px 0 4px;font-size:17px;color:#e6c97f">${esc(a.area)} <span style="opacity:.75;font-size:14px">${a.done}/${a.total}${a.done === a.total && a.total >= 2 ? ' · complete' : ''}</span></div>`;
        for (const s of list.filter((q) => q.area === a.area)) {
          const got = !!state.stamps[s.id];
          html += `<div style="display:flex;gap:10px;padding:3px 0;${got ? '' : 'opacity:.5'}"><div style="width:26px;height:26px;flex:none;border-radius:50%;border:2px ${got ? 'solid #c0413a' : 'dashed #8a8f9c'};color:#c0413a;text-align:center;line-height:24px;font-weight:bold;transform:rotate(-12deg)">${got ? '✓' : ''}</div><div><b>${got ? esc(s.name) : '<span style="letter-spacing:3px;font-weight:normal;font-style:italic">not yet found</span>'}</b>${got ? `<div style="font-size:13px;opacity:.85">${esc(s.blurb)}</div>` : ''}</div></div>`;
        }
      }
      html += `<div style="margin-top:12px;font-size:13px;opacity:.7">Sights are named once you have found them: walk up to one to stamp it. £${AREA_REWARD} for every area completed, £${ALL_REWARD} for the lot. P or Esc to close.</div>`;
      box.innerHTML = html;
      o.appendChild(box);
    }
    function openPage() {
      if (open || game.activity || (game.ui && game.ui.inDialog)) return false;
      const v = game.player && game.player.vehicle; if (v && v.type === null) return false;      // flying (gliding's placeholder vehicle): not now
      refresh(); open = true;
      game.beginActivity({ name: 'passport', pointer: 'free', hint: 'Passport — P or Esc to close', onKey(code) { if (code === 'KeyP') game.endActivity(); }, onEnd() { open = false; } });
      render();
      return true;
    }
    const closePage = () => { if (open) game.endActivity(); };
    try { game.input.onKey((code) => { if (code === 'KeyP' && !open && !game.activity && !(game.ui && game.ui.inDialog) && !game.input.typing) openPage(); }); } catch { /* headless */ }

    game.passport = {
      get state() { return state; }, list: () => list, count: () => count(list, state.stamps), total: () => list.length,
      open: openPage, close: closePage, refresh, check,
      reset() { state = emptyState(); save(); },
    };
    return {
      update(dt) {
        try {
          refreshT -= dt; if (refreshT <= 0) { refreshT = list.length ? 15 : 1; refresh(); }
          checkT -= dt; if (checkT > 0) return; checkT = 0.4;
          const p = game.player; if (!p) return;
          const pos = p.place === 'world' ? p.pos : p.worldPos;
          if (pos && (p.place !== 'world' || p.pos.y < 45)) check(pos.x, pos.z);      // not from a glider high overhead
        } catch (e) { if (!err) { err = true; console.error('[passport]', e); } }
      },
    };
  },
};
