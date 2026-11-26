// Background music: very quiet recorded tracks that change with where you are and come and go, as a game's exploration
// music does: one track, then 20 to 60 s of real silence, then another. The tracks are CC0 recordings in
// public/audio/music (manifest.json, CREDITS.md; prepared by tools/audio/prepare_music.mjs) played by
// _soundtrack_player.js. It sits about 21 dB under the ambience and gets out of the way.
//   where     college grounds (the HUD banner's site) → cloister · green space and water (the ambience raster) → green ·
//             world.zoneAt → town (centre) / lanes (Jericho, Cowley Road, East Oxford) / open (Headington, North Oxford,
//             the outskirts) · interiors, pubs, the club, the practice rooms → nothing at all
//   what      each mood has two or three tracks, shuffled by the session's seed, never the same one twice running; a new
//             mood crossfades in over 8 s (4 s through a door); come back within two minutes and the track you left
//             carries on from where it was
//   when      darker (a low-pass) and a little softer at night and in rain
//   backs off speech and dialogue (dip), a wanted level, activities, crashes, the fireworks and May Morning, anything on
//             the game's own music bus (club, jukebox, organ, choir), driving fast; then comes back slowly
//   controls  the "Background music" slider on the Esc screen (0-200%, saved in localStorage 'gto.soundtrack'); speech
//             ducking applies as well; ?music=0 starts with it off, ?music=2 louder (not saved)
//   silent    a manifest that will not load, or a browser that cannot stream into the graph: no music for the
//             session (mode 'none'), asked once, never retried, never a message
// Local to each player. Work happens four times a second on the audio clock; per frame it is one comparison. Nothing is
// fetched or created before Play, or at all while it is off; only the track about to play is fetched, and at most two
// exist at once. A missing file or a refused play() means no music, never a message.
// Test hooks: game.soundtrack = { volume, mode ('tracks' | 'none'), set(v), cycle(), force(mood | null), debug, director, player, stats() }
//   tools/smoke_soundtrack.mjs (logic, stub audio)
import { MOODS, moodFor, Director, duckTarget, Ducker, playlistsFor, rng } from './_soundtrack_logic.js';
import { TrackPlayer, MAX_ALIVE } from './_soundtrack_player.js';

const PREF = 'gto.soundtrack';
const LEVELS = [1, 2, 0, 0.5], LABEL = { 1: 'quiet', 2: 'louder', 0: 'off', 0.5: 'quieter' };
const TICK = 0.25;
const RESUME_S = 120;        // come back to a mood within this long and its track carries on where you left it
const BASE = (() => { try { return new URL('../../audio/music/', import.meta.url).href; } catch { return 'audio/music/'; } })();
// the same test world/index.js uses for "a college" among the map's named sites
const COLLEGE_RE = /College|Hall|Christ Church|House|Blackfriars|Wycliffe|St Stephen|Cohen Quad/;
const NOT_COLLEGE_RE = /Science|Department|Faculty|School|Quarter|Centre|Library|Institute|Triangle|Acland|Examination|Smith|Statistics|Sociology|History|Education|Rhodes|Maison|Development|Botanic|Meadow|Castle|Museum|Weston/;
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

export default {
  id: 'soundtrack',
  install(game) {
    const audio = game.audio;
    let volume = 1;
    try { const raw = globalThis.localStorage.getItem(PREF), v = +raw; if (raw !== null && raw !== '' && v >= 0 && v <= 3) volume = v; } catch { /* storage blocked / node */ }
    let seed = (Math.random() * 0xffffffff) >>> 0, mode = 'tracks';
    try {
      const q = new URLSearchParams(globalThis.location.search);
      if (q.has('music')) { const s = q.get('music'); volume = /^(0|false|off|no)$/i.test(s) ? 0 : Math.max(0, Math.min(3, Number.isFinite(+s) && s !== '' ? +s : 1)); }
      if (q.has('musicseed')) seed = +q.get('musicseed') >>> 0;
    } catch { /* no location */ }

    const colleges = new Set();
    for (const s of (game.map && game.map.sites) || []) if (s.kind === 'university' && COLLEGE_RE.test(s.name) && !NOT_COLLEGE_RE.test(s.name)) colleges.add(s.name);

    const dir = new Director(), evD = new Ducker({ down: 0.6, up: 7 }), spD = new Ducker({ down: 0.12, up: 1.5 }), drD = new Ducker({ down: 1.2, up: 4 });
    const S = { place: 'world', college: false, green: 0, water: 0, shop: 0, zone: null, x: 0, z: 0 };
    const D = { speech: false, dialog: false, activity: false, police: 0, diegetic: false, show: false, crash: 0, frozen: false, carSpeed: 0 }, duck = { why: [] };
    const env = { night: 0, rain: 0 };
    let last = -1, lastPlace = null, forced = null, level = 0, sentLevel = -1, sentTone = 0, offT = 0, tickN = 0, show = false, diegetic = false;
    let crashT = 0, buildMs = 0, maxMs = 0, cpuMs = 0, cpuT = 0, err = false;
    // recorded tracks: mf 0 not asked for · 1 loading · 2 ready (a failure switches mode to 'none' for the session: silence)
    let player = null, lists = null, mf = 0, fetched = 0, failed = 0, quietT = 0;
    const ts = {}, hist = [], dice = rng((seed ^ 0x51ed270b) >>> 0 || 1);
    function loadManifest() {
      mf = 1; fetched++;
      let p = null; try { p = globalThis.fetch(BASE + 'manifest.json'); } catch { /* no fetch here */ }
      if (!p || !p.then) { mode = 'none'; return; }
      p.then((r) => { if (!r || !r.ok) throw 0; return r.json(); })
        .then((j) => { lists = playlistsFor(j, seed); if (!lists) throw 0; A.manifest = j; mf = 2; })
        .catch(() => { mode = 'none'; });
    }

    const A = (game.soundtrack = {
      id: 'soundtrack', moods: MOODS, director: dir, player: null, manifest: null, debug: { diegetic: null, show: null },
      get volume() { return volume; },
      get mode() { return mode; },
      get playlists() { return lists; },
      get seed() { return seed; },
      set(v, save = true) {
        volume = Math.max(0, Math.min(3, +v || 0));
        if (save) { try { globalThis.localStorage.setItem(PREF, String(volume)); } catch { /* */ } }
        return volume;
      },
      cycle() { let i = LEVELS.indexOf(volume); if (i < 0) i = volume > 0 ? 0 : 2; return A.set(LEVELS[(i + 1) % LEVELS.length]); },
      force(m) { forced = m && MOODS[m] ? m : null; },
      stats: () => ({
        mood: dir.cur, weights: { ...dir.w }, volume, level: +level.toFixed(4), why: duck.why.slice(), env: { ...env }, awake: !!(player && player.awake),
        mode, fetched, failed, alive: player ? player.slots.length : 0, peakAlive: player ? player.peakAlive : 0, started: player ? player.started : 0,
        playing: player ? player.slots.map((s) => ({ id: s.track.id, mood: s.mood, w: +Math.max(0, s.w).toFixed(3), pos: +player.position(s).toFixed(2), paused: s.paused })) : [],
        track: player && player.slotFor(dir.cur) ? player.slotFor(dir.cur).track.id : null, history: hist.slice(),
        switches: dir.switches, msPerSec: cpuT > 0 ? +(cpuMs / cpuT).toFixed(4) : 0, maxTickMs: +maxMs.toFixed(2), buildMs: +buildMs.toFixed(2),
      }),
    });

    // (no keys: the "Background music" slider of the Esc screen's sound panel sets this volume — systems/keyhelp.js)

    function tick(t, dt) {
      const pl = game.player, place = pl.place || 'world', outdoors = place === 'world';
      const wp = outdoors ? pl.pos : pl.worldPos || pl.pos;
      // ---- where
      S.place = place; S.x = wp.x; S.z = wp.z;
      const E = game.ambience && game.ambience.env;
      if (E) { S.green = E.green; S.water = E.water; S.shop = E.shop; }
      S.zone = game.world && game.world.zoneAt ? game.world.zoneAt : null;
      S.college = outdoors && !!game.ui && colleges.has(game.ui._area);
      const cur = dir.update(dt, forced || moodFor(S, dir.cur), lastPlace !== null && place !== lastPlace);
      lastPlace = place;
      // ---- when
      env.night = game.time ? 1 - Math.max(0, Math.min(1, game.time.daylight ?? 1)) : 0;
      env.rain = game.weather ? Math.max(0, Math.min(1, game.weather.rain || 0)) : 0;
      // ---- what else is going on
      const v = game.voice;
      D.speech = !!(v && ((v.active && v.active.length) || (v.live && v.live.speaking)));
      D.dialog = !!(game.ui && game.ui.inDialog); D.activity = !!game.activity; D.frozen = (pl.frozen || 0) > 0;
      D.police = game.police ? game.police.level || 0 : 0;
      if ((game.shakeAmt || 0) >= 0.45) crashT = 2.5; else if (crashT > 0) crashT -= dt;      // the shake itself lasts half a second
      D.crash = crashT > 0 ? 1 : 0;
      D.carSpeed = pl.vehicle ? Math.abs(pl.speed || 0) : 0;
      if ((tickN++ & 3) === 0) {
        show = false;
        try { for (const k of ['southPark', 'mayDay']) { const h = game[k]; if (h && h.state) { const st = h.state(); if (st.active && st.near) show = true; } } } catch { /* */ }
      }
      if (player) { const r = player.probe(); diegetic = r > (diegetic ? 0.0015 : 0.004); }
      D.show = A.debug.show ?? show; D.diegetic = A.debug.diegetic ?? diegetic;
      duckTarget(D, duck);
      const g = evD.update(dt, duck.event, duck.hold) * spD.update(dt, duck.speech, 0.3) * drD.update(dt, duck.drive, 0);
      level = volume * g * (1 - 0.25 * env.rain) * (1 - 0.12 * env.night);

      // ---- off: after the fade, leave the mix entirely
      if (volume <= 0) { if (player && player.awake) { if ((offT += dt) > 2) player.sleep(); else if (sentLevel !== 0) { sentLevel = 0; player.setLevel(0, 0.3); } } return; }
      offT = 0;
      if (!TrackPlayer.supported(audio)) { mode = 'none'; return; }       // cannot stream into the graph: silent
      if (mf === 0) loadManifest();
      if (mf === 2) tickTracks(t, dt, cur);
    }

    // ---- recorded tracks: one per mood at most, the Director's weights are the crossfade
    function tickTracks(t, dt, cur) {
      if (!player) { const b0 = now(); player = A.player = new TrackPlayer(audio, BASE); buildMs = now() - b0; for (const m of Object.keys(lists)) ts[m] = { nextAt: t + 2, resume: null }; }
      else if (!player.awake) { player.wake(); sentLevel = -1; for (const m of Object.keys(ts)) ts[m].nextAt = Math.min(ts[m].nextAt, t + 1); }
      if (Math.abs(level - sentLevel) > 0.002 || (level === 0 && sentLevel !== 0)) { sentLevel = level; player.setLevel(level, 0.25); }
      const hz = 9000 - 4500 * env.night - 1500 * env.rain;
      if (Math.abs(hz - sentTone) > 40) { sentTone = hz; player.setTone(hz); }
      const audible = level > 0.01;
      quietT = audible ? 0 : quietT + dt;
      for (const s of player.slots.slice()) {
        const st = ts[s.mood], w = dir.w[s.mood] || 0;
        if (s.failed || (!s.live && !s.paused && t - s.t0 > 20)) {            // missing, undecodable, refused or stalled: leave it out, quietly
          failed++; for (const m of Object.keys(lists)) lists[m].drop(s.track.id);
          st.nextAt = t + 5; st.resume = null; player.release(s);
        } else if (s.ended) { st.nextAt = t + lists[s.mood].gap() * (1 + 0.5 * env.night); st.resume = null; player.release(s); }        // then real silence
        else if (s.dying) player.release(s);
        else if (w <= 0) { st.resume = { track: s.track, pos: player.position(s), t }; st.nextAt = t; player.release(s); }      // faded out behind you
        else {
          player.setWeight(s, w);
          if (quietT > 1.5) player.pause(s);                                    // ducked right out: wait there rather than play on unheard
          else if (audible && s.paused) { s.t0 = t; player.resume(s); }
        }
      }
      const L = lists[cur], st = ts[cur];
      if (!L || !audible || t < st.nextAt || player.slotFor(cur)) return;
      if (player.slots.length >= MAX_ALIVE) {                                   // a third mood: the faintest goes first, the new one starts next tick
        let v = null; for (const s of player.slots) if (!v || s.w < v.w) v = s;
        if (!v.dying) { ts[v.mood].resume = { track: v.track, pos: player.position(v), t }; ts[v.mood].nextAt = t; player.fade(v); }
        return;
      }
      let track = null, offset = 0, why = 'resume';
      const r = st.resume; st.resume = null;
      if (r && t - r.t < RESUME_S && r.pos < r.track.duration - 20 && L.tracks.includes(r.track)) { track = r.track; offset = r.pos; }
      else {
        track = L.next(); if (!track) return;
        const cross = player.slots.length > 0; why = cross ? 'cross' : 'start';
        if (cross && track.duration > 90 && dice() < 0.35) offset = +(dice() * 0.35 * track.duration).toFixed(2);      // crossfading in: sometimes from further on
      }
      const s = player.start(cur, track, offset);
      if (!s) return;
      player.setWeight(s, dir.w[cur]);
      hist.push({ t: +t.toFixed(2), mood: cur, id: track.id, offset, why }); if (hist.length > 200) hist.shift();
    }

    return {
      update() {
        if (!audio || !audio.ctx) return;
        const t = audio.ctx.currentTime;
        if (t - last < TICK) return;
        if (mode !== 'tracks' || (volume <= 0 && !(player && player.awake))) { last = t; return; }           // off, or no music to be had: nothing at all
        const dt = last < 0 ? TICK : Math.min(1, t - last), c0 = now();
        last = t;
        try { tick(t, dt); } catch (e) { if (!err) { err = true; console.error('[soundtrack]', e); } }
        const ms = now() - c0; cpuMs += ms; cpuT += dt; if (ms > maxMs) maxMs = ms;
      },
    };
  },
};
