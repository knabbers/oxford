// Weather: ONE deterministic sky for the whole world (graphics pass 8). The model is pure (_weather_model.js: a function
// of the shared clock, so every player sees the same weather and the gliders' air — _glide_air.js reads the same
// model — agrees with it); this system turns it into the world's look and sound each frame:
//   sky      coverage / height of the cumulus and deck layers (now, an hour ago downwind, an hour ahead upwind), their
//            drift with the wind, storm darkness, fog, river mist, the lightning flash -> world.sky.weather (sky.js
//            does the lighting, fog, exposure, cloud shadows and the cloud-top deck from it)
//   ground   wet streets / snow / frost / rain rings on water -> world.uniforms.wetv (the shared ground, facade and
//            water materials; no per-material forks)
//   precip   one instanced draw of streaks / flakes / splashes round the camera while something falls (_weather_fx.js)
//   sound    rain on the street, the roof, the car, the canopy; gusts; distant thunder (_weather_audio.js, ambience bus)
//   HUD      a small glyph + the temperature beside the clock
//   hooks    game.weather.rain / wet / umbrellas / crowd / grip for other systems to read (nothing here edits them)
// Default: the weather follows the shared clock from the first frame. The very first session (nothing in
// localStorage) is kept fair for its opening: rain, fog and the deck are held back for 4 real minutes from first
// stepping outside, then let go over 90 s (local and cosmetic: game.weather.at() is always the shared weather).
// ?weather=<state> forces a state (screenshots, tests); game.weather.force(name | null) does too, blending in ~4 s.
// ?wxtime=<game hours since the epoch>[&wxrate=<speed>] (or game.weather.scrub(hours | null, rate)) reads the weather
// at another moment of the same process and runs it from there at any speed — a front in a minute; the sun follows
// (the hour is pinned to the scrubbed clock unless ?time= pinned it). Local: at() / sample() stay on the shared clock.
// ?fps (or F2) adds a read-out of every continuous variable under the frame-rate line.
// Test: tools/smoke_weather.mjs.
import * as THREE from 'three';
import { sample, blank, compose, wetness, puddles, bowAt, windAt, drift, PRESETS, STATES, LABEL, HOUR_MS, DAY_MS, hash3, sstep, classify, hourOf } from './_weather_model.js';
import { Precip, icon } from './_weather_fx.js';
import { WeatherSound } from './_weather_audio.js';

const FIRST_KEY = 'gto-weather-seen';
const KEYS = ['cu', 'st', 'stBase', 'rain', 'drizzle', 'shower', 'dark', 'fog', 'thunder', 'snow', 'frost', 'tempC', 'cuBase', 'drop', 'showery'];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export default {
  id: 'weather',
  install(game) {
    const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
    const urlForce = params.get('weather');
    const world = game.world, sky = world && world.sky, W = sky && sky.weather, U = world && world.uniforms;
    const tier = () => (game.quality && game.quality.tier) || { name: 'medium' };
    const MAXDROPS = { low: 1600, medium: 3200, high: 5000, ultra: 6000 };
    const precip = new Precip(6000);
    const sound = game.audio ? new WeatherSound(game.audio) : null;

    // ---- state
    const nat = blank(), past = blank(), ahead = blank(), cur = blank(), pastV = blank(), aheadV = blank();
    let forced = PRESETS[urlForce] ? urlForce : null, forceK = forced ? 1 : 0, fading = forced;   // fading: the preset being blended (in or out)
    let first = false;
    try { first = typeof localStorage !== 'undefined' && !localStorage.getItem(FIRST_KEY); if (first) localStorage.setItem(FIRST_KEY, '1'); } catch { /* storage blocked */ }
    if (forced) first = false;
    let clemT = first ? 0 : -1, clemK = first ? 1 : 0, outdoorsSeen = false;
    let wetN = 0, wetT = 0, wetV = 0, snowCover = 0, natT = -1e9, mistNear = 0.5, coverT = 0, dry = [0, 0, 0, 0], flash = 0;
    let lastBolt = -1, hudT = 0, hudKey = '', drops = 0, cpuUs = 0, snap = true;
    let pudN = 0, pudV = 0, bowN = 0, bowV = 0, wantS = 0, snapD = true;
    // ---- the weather clock: the shared clock, or (?wxtime / scrub) another moment of the same process, at any speed
    const timeByUrl = params.get('time') !== null && params.get('time') !== '';
    let scrub = null;       // {t0: weather ms at at0, at0: real ms, rate}
    const setScrub = (hours, rate = 1) => {
      if (scrub && !timeByUrl && game.time) game.time.pinned = null;
      scrub = hours === null || hours === undefined || !isFinite(+hours) ? null : { t0: +hours * HOUR_MS, at0: (typeof performance !== 'undefined' ? performance.now() : 0), rate: isFinite(+rate) ? +rate : 1 };
      natT = -1e9; snap = true;
      return scrub ? scrub.t0 : null;
    };
    const scrubNow = () => scrub.t0 + ((typeof performance !== 'undefined' ? performance.now() : 0) - scrub.at0) * scrub.rate;
    const dr = [0, 0, 0], wv = [0, 0], col = new THREE.Color(), camP = new THREE.Vector3(), SODIUM = new THREE.Color(0.32, 0.27, 0.2);

    // ---- mist: thickest by the river, Port Meadow and Christ Church Meadow — points along the rivers / canal and over
    // the meadows' and water areas, binned to a 60 m grid for a fast "how near water" lookup
    const MIST = new Map(), CELL = 60;
    const addMist = (x, z, w) => { const k = Math.round(x / CELL) * 4096 + Math.round(z / CELL); MIST.set(k, Math.max(MIST.get(k) || 0, w)); };
    try {
      const map = game.map || {};
      for (const l of map.waterlines || []) { if (l.tunnel || (l.kind !== 'river' && l.kind !== 'canal' && l.kind !== 'stream')) continue; for (let i = 0; i < l.pts.length - 1; i++) { const a = l.pts[i], b = l.pts[i + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / CELL); for (let j = 0; j <= n; j++) addMist(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n, l.kind === 'river' ? 1 : 0.8); } }
      for (const a of map.areas || []) {
        if (a.kind !== 'water' && a.kind !== 'meadow') continue;
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of a.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
        for (let x = x0; x <= x1; x += CELL) for (let z = z0; z <= z1; z += CELL) addMist(x, z, a.kind === 'water' ? 1 : 0.9);
      }
      // Port Meadow (the module's own box west of the map) and Christ Church Meadow
      for (let x = -1180; x <= -890; x += CELL) for (let z = -1830; z <= -670; z += CELL) addMist(x, z, 1);
      for (let x = 380; x <= 700; x += CELL) for (let z = 560; z <= 900; z += CELL) addMist(x, z, 0.95);
    } catch (e) { console.warn('[weather] mist map', e); }
    const mistAt = (x, z) => {
      const ci = Math.round(x / CELL), cj = Math.round(z / CELL); let best = 0;
      for (let di = -5; di <= 5; di++) for (let dj = -5; dj <= 5; dj++) { const w = MIST.get((ci + di) * 4096 + cj + dj); if (w) best = Math.max(best, w * Math.exp(-Math.hypot(di, dj) * CELL / 140)); }
      return best;
    };

    // ---- under cover (an arch, a passage through a building): the drops stop round the player
    const underCover = (x, z) => {
      const g = world && world.buildingGrid; if (!g || !g.queryRadius) return false;
      let hit = false;
      try { g.queryRadius(x, z, 1, (r) => { if (r.bb && x >= r.bb.minX && x <= r.bb.maxX && z >= r.bb.minZ && z <= r.bb.maxZ && world.util.pointInPoly(x, z, r.b.poly)) { hit = true; return true; } }); } catch { /* */ }
      return hit;
    };

    // ---- the merged weather for a time: natural, then the first session's clemency, then a forced state
    const apply = (o, src) => {
      for (const k of KEYS) o[k] = src[k];
      o.windX = src.windX; o.windZ = src.windZ; o.wind = src.wind; o.dir = src.dir; o.fromDeg = src.fromDeg; o.gust = src.gust; o.surface = src.surface; o.sky = src.sky; o.hour = src.hour; o.season = src.season;
      if (clemK > 0) {
        const k = clemK;
        o.rain *= 1 - k; o.thunder *= 1 - k; o.dark *= 1 - k; o.fog *= 1 - 0.8 * k;
        o.st = lerp(o.st, Math.min(o.st, 0.35), k); o.cu = lerp(o.cu, clamp(o.cu, 0.18, 0.5), k);
      }
      if (forceK > 0 && fading) {
        const P = PRESETS[fading], k = forceK;
        for (const key of KEYS) if (P[key] !== undefined) o[key] = lerp(o[key], P[key], k);
        if (P.wind) { const s = lerp(o.wind, P.wind, k) / Math.max(0.1, o.wind); o.windX *= s; o.windZ *= s; o.wind *= s; o.surface = o.wind * 0.6; }
        if (P.gust !== undefined) o.gust = lerp(o.gust, P.gust, k);
        if (P.rain === 0) { o.drizzle *= 1 - k; o.shower *= 1 - k; }
        if (P.fog === 0) o.fog *= 1 - k;
      }
      o.cover = clamp(1 - (1 - o.cu) * (1 - o.st), 0, 1);
      o.sky = clamp((1 - 0.92 * o.st) * (1 - sstep(0.03, 0.18, o.rain)) * (1 - 0.8 * o.fog) * (1 - 0.35 * sstep(0.6, 0.9, o.cu)), 0, 1);
      o.name = fading && forceK > 0.5 ? fading : classify(o);
      return o;
    };

    const api = {
      state: 'clear', label: 'clear', cloud: 0, rain: 0, fog: 0, wind: { dir: 0, speed: 0, fromDeg: 0, gust: 0 }, tempC: 10, wet: 0, grip: 1,
      umbrellas: 0, crowd: 1, snow: 0, frost: 0, thunder: 0, season: 0, forced: null,
      /** the shared weather (no clemency, no forcing) at a shared-clock time -> state name */
      at(timeMs, hour) { return sample(hour === undefined ? timeMs : compose(timeMs, hour), blank()).name; },
      /** the full shared sample (cu, st, rain, fog, wind, tempC, …) at a time */
      sample(timeMs, hour) { return sample(hour === undefined ? timeMs : compose(timeMs, hour), blank()); },
      /** force a state (one of STATES) or null to follow the shared clock again; blends in over ~4 s */
      force(name) {
        const to = name && PRESETS[name] ? name : null;
        if (to && fading && fading !== to && forceK > 0) forceK = 0;   // from one forced state to another: blend from the natural one
        forced = to; if (to) { fading = to; clemK = 0; clemT = -1; }
        api.forced = forced; return forced;
      },
      /** jump the blend (screenshots): force(name) and finish the blend this frame */
      forceNow(name) { api.force(name); forceK = forced ? 1 : 0; natT = -1e9; snap = true; snapD = true; return forced; },
      /** debug: read the weather at `hours` (game hours since the epoch) and run on from there at `rate` x; null = the shared clock again */
      scrub(hours, rate = 1) { return setScrub(hours, rate); },
      /** the weather clock now (ms): the shared clock composed with the hour, or the scrubbed one */
      time() { return scrub ? scrubNow() : compose(game.time.now(), game.time.hour); },
      puddle: 0, drop: 1, bow: 0,
      states: STATES.slice(),
      stats() {
        return { state: api.state, forced, forceK: +forceK.toFixed(2), clemency: +clemK.toFixed(2), cu: +cur.cu.toFixed(3), st: +cur.st.toFixed(3), rain: +cur.rain.toFixed(3), fog: +cur.fog.toFixed(3), mist: +W.mist.toFixed(3), wet: +api.wet.toFixed(3),
          puddle: +pudV.toFixed(3), drop: +cur.drop.toFixed(2), bow: +bowV.toFixed(3), showery: +cur.showery.toFixed(3), scrub: scrub ? +(scrubNow() / HOUR_MS).toFixed(3) : null,
          tempC: +cur.tempC.toFixed(1), wind: +cur.wind.toFixed(1), drops, precipDrawn: !!precip.mesh.parent, deckDrawn: !!(sky.deck && sky.deck.parent), flash: +flash.toFixed(2), cpuUs: +cpuUs.toFixed(1),
          sound: sound ? { live: !!sound.n, thunders: sound.thunders } : null, natural: nat.name };
      },
      /** ambience hook (systems/ambience.js): birds keep quiet in the rain, the leaves roar on a blustery day */
      ambience(mix) {
        if (!mix || !mix.rates) return;
        const r = clamp(cur.rain * 2.5, 0, 1), R = mix.rates;
        for (const k of ['songbird', 'blackbird', 'robin', 'pigeon', 'duck', 'bikebell']) if (R[k]) R[k] *= 1 - 0.85 * r;
        if (R.songbird) R.songbird *= 1 - 0.6 * cur.fog;
        mix.wind = (mix.wind || 0) * (1 + 0.9 * sstep(4, 9, cur.surface));
        mix.crowd = (mix.crowd || 0) * (1 - 0.4 * r);
      },
      _cur: cur, _nat: nat, precip, sound,
    };
    game.weather = api;
    if (!W) { console.warn('[weather] no world sky: weather is data only'); }

    function update(dt) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      let now = game.time.now(), hour = game.time.hour, tw = compose(now, hour);
      // (in a walk-in room — core/interiors.js — the weather is still seen through its windows: it carries on)
      const walkIn = !!(game.interiors && game.interiors.current && game.interiors.current.sl && game.player.place === game.interiors.current.id);
      const outdoors = game.scene === game.worldScene || walkIn, realNow = now;
      if (scrub) { tw = scrubNow(); now = tw; hour = hourOf(tw); if (!timeByUrl) game.time.pinned = hour; }
      const pl = game.player;
      // the first session: clemency from first stepping outside
      if (clemT >= 0) {
        if (outdoors && !walkIn && game.running !== false) outdoorsSeen = true;
        if (outdoorsSeen) clemT += dt;
        clemK = clemT < 240 ? 1 : Math.max(0, 1 - (clemT - 240) / 90);
        if (clemK <= 0) clemT = -1;
      } else clemK = 0;
      forceK = clamp(forceK + (forced ? dt / 4 : -dt / 4), 0, 1);
      // the natural weather (and an hour either side, for the sky upwind / downwind): ~10 Hz is plenty, it changes slowly
      if (Math.abs(tw - natT) > 120 || dt === 0) {
        natT = tw;
        sample(tw, nat); sample(tw - HOUR_MS, past); sample(tw + HOUR_MS, ahead);
      }
      apply(cur, nat); apply(pastV, past); apply(aheadV, ahead);
      // wetness: the model's (pure) history, refreshed every half second; a forced state wets / dries over ~20 s
      if ((wetT -= dt) <= 0 || snap) { wetT = 0.5; wetN = wetness(tw, nat); pudN = puddles(tw, nat.season); bowN = bowAt(tw, nat); }
      const FP = fading && PRESETS[fading], wForce = FP ? (FP.rain > 0.03 ? 1 : FP.fog > 0.5 ? 0.3 : FP.frost > 0.5 ? 0.25 : 0) : 0;
      const wantWet = lerp(wetN * (1 - 0.9 * clemK), wForce, forceK);
      wetV += (wantWet - wetV) * Math.min(1, dt * (forceK > 0 && forceK < 1 ? 0.25 : 2));
      // puddles: the model's standing water (a forced wet state fills them, a forced dry one empties them, over ~20 s);
      // the rainbow: the model's, or a forced 'broken' sky straight after forced rain is not worth special-casing
      const wantPud = lerp(pudN * (1 - 0.9 * clemK), FP ? (FP.rain >= 0.3 ? 0.85 : FP.rain > 0.03 ? 0.45 : 0) : 0, forceK);
      pudV += (wantPud - pudV) * Math.min(1, dt * (forceK > 0 && forceK < 1 ? 0.25 : 2));
      bowV += (bowN * (1 - forceK) * (1 - clemK) - bowV) * Math.min(1, dt * 0.5);
      if (snap) { wetV = wantWet; pudV = wantPud; bowV = bowN * (1 - forceK); snap = false; }
      const snowing = cur.snow * sstep(0.03, 0.25, cur.rain);
      snowCover = clamp(snowCover + (snowing > 0.2 ? dt * 0.01 * snowing : -dt * 0.004 * (cur.tempC > 1.5 ? 2 : 0.3)), 0, 0.85);
      if (forced === 'snow' && forceK > 0.9) snowCover = Math.max(snowCover, 0.6);
      else if (forced && forceK > 0.9 && !(PRESETS[forced].snow > 0)) snowCover = Math.max(0, snowCover - dt * 0.2);   // a forced state without snow: it melts away in seconds

      // ---- where the camera is: mist by the water, cover, the cloud base above it
      const cam = game.eye || game.camera.position;      // (the eye in world coordinates)
      if ((coverT -= dt) <= 0) {
        coverT = 0.25;
        const wp = pl.place === 'world' ? pl.pos : pl.worldPos || pl.pos;
        mistNear += (mistAt(wp.x, wp.z) - mistNear) * (dt === 0 ? 1 : 0.35);
        const cov = pl.place === 'world' && !pl.vehicle && underCover(pl.pos.x, pl.pos.z);
        dry[0] = pl.pos.x; dry[1] = pl.pos.z; dry[2] = 3.2; dry[3] = cov ? 1 : 0;
      }
      // (a passenger inside a bus, systems/busride.js: no rain falls through the saloon; every frame, the bus moves)
      if (pl.vehicle && pl.vehicle.roof > 0 && pl.place === 'world') { dry[0] = pl.vehicle.x; dry[1] = pl.vehicle.z; dry[2] = pl.vehicle.roof; dry[3] = 1; }
      // (in a walk-in room: no rain falls inside it — the dry circle is the room's own, in world coordinates; core/interiors.js)
      if (walkIn && game.interiors.dryZone) { const z = game.interiors.dryZone(); if (z) { dry[0] = z[0]; dry[1] = z[1]; dry[2] = z[2]; dry[3] = 1; } }
      const fogSky = cur.fog * (0.5 + 0.5 * mistNear), mist = cur.fog * (0.25 + 0.75 * mistNear);
      const belowDeck = 1 - sstep(cur.stBase - 40, cur.stBase + 30, cam.y);
      const fall = cur.rain * belowDeck;

      // ---- lightning: one candidate per real second on the shared clock (same flash for everybody), a few km off
      flash = 0;
      if (cur.thunder > 0.02) {
        for (let s = Math.floor(realNow / 1000) - 1; s <= Math.floor(realNow / 1000); s++) {
          if (hash3(s, 811) >= 0.16 * cur.thunder) continue;
          const tf = s * 1000 + hash3(s, 812) * 1000, dist = 1200 + 11000 * Math.pow(hash3(s, 813), 0.8), b = 1 / (1 + dist / 3500), age = realNow - tf;
          if (age >= 0 && age < 400) flash = Math.max(flash, b * (Math.exp(-age / 55) + 0.7 * (age > 110 ? Math.exp(-(age - 110) / 45) : 0) + (age > 230 ? 0.4 * Math.exp(-(age - 230) / 60) : 0)));
          if (age >= 0 && s > lastBolt) { lastBolt = s; if (sound && game.audio && game.audio.ctx) sound.thunder(dist / 343 - age / 1000, dist, where(), s); }
        }
        flash *= outdoors ? 1 : 0.35;
      }

      // ---- the sky
      if (W) {
        W.cu[0] = pastV.cu; W.cu[1] = cur.cu; W.cu[2] = aheadV.cu; W.cuBase = cur.cuBase;
        W.st[0] = pastV.st; W.st[1] = cur.st; W.st[2] = aheadV.st; W.stBase = cur.stBase;
        W.rain = fall; W.dark = cur.dark; W.fog = fogSky; W.mist = mist; W.flash = flash; W.snow = cur.snow;
        W.bow = bowV; W.shafts = Math.max(cur.showery, 0.6 * pastV.showery, 0.6 * aheadV.showery) * (1 - sstep(0.25, 0.6, cur.rain));
        drift(now, dr);
        W.off[0] = dr[0] * 1.2; W.off[1] = dr[1] * 1.2; W.off[2] = dr[0] * 1.5; W.off[3] = dr[1] * 1.5;
        const ws = Math.hypot(cur.windX, cur.windZ) || 1; W.wind[0] = cur.windX / ws; W.wind[1] = cur.windZ / ws;
        // the gliders' own 3-D cumulus over the thermals near the camera: the dome thins its cumulus there
        const gl = game.gliding, fx = gl && gl.sys && gl.sys.fx;
        W.nearFade = fx && fx.clouds && fx.clouds.count > 0 ? 4800 : 0;
      }
      if (U && U.wetv) U.wetv.value.set(wetV, snowCover, cur.frost * (1 - snowCover), outdoors ? clamp(fall * (1 - cur.snow) * 1.4, 0, 1) : 0);
      if (U && U.wet2) U.wet2.value.x = pudV * (1 - snowCover);

      // ---- precipitation draw
      const t = tier(), maxD = MAXDROPS[t.name] || 3200;
      const dz = cur.drizzle * (1 - cur.snow);
      // (the count follows the intensity and the drop size continuously: drizzle is many fine drops, a shower fewer big
      // ones; through sleet — the one switch the single draw has, streaks <-> flakes — the count passes through zero)
      const cnt = lerp(lerp(0.12 + fall * 1.1, 0.25 + fall * 3, sstep(0.3, 0.7, dz)), fall * 1.8, sstep(0.5, 0.7, cur.snow)) * sstep(0, 0.02, fall) * Math.min(1, Math.abs(cur.snow - 0.5) * 6);
      let want = outdoors && fall > 0.0005 ? maxD * clamp(cnt, 0, 1) : 0;
      // (and the count itself eases over about a third of a second: the rain thickens, it does not switch on)
      wantS = snapD || !outdoors || belowDeck < 0.01 ? want : wantS + (want - wantS) * Math.min(1, dt * 3); snapD = false;
      if (want > 0 || wantS > 1) want = wantS; else wantS = 0;
      if (want > 0) {
        const nt = world.night || 0, hs = sky.hemi;
        col.copy(hs.color).multiplyScalar(0.55 * hs.intensity).lerp(SODIUM, nt * 0.5);
        if (cur.snow > 0.5) col.setRGB(0.9, 0.92, 0.95).multiplyScalar(0.5 + 0.5 * (1 - nt * 0.7));
        camP.copy(cam);
        const ground = pl.place === 'world' ? (pl.vehicle ? (game.world.groundHeight ? game.world.groundHeight(pl.pos.x, pl.pos.z) : 0) : pl.pos.y) : walkIn && pl.worldPos && game.world.groundHeight ? game.world.groundHeight(pl.worldPos.x, pl.worldPos.z) : 0;
        drops = precip.update(game.worldScene, want, { snow: cur.snow, drizzle: dz, rain: fall, wind: windAt(now, wv), cam: camP, ground, col, dry, dt });
      } else { precip.update(game.worldScene, 0, null); drops = 0; }

      // ---- sound
      if (sound) sound.update(dt, { rain: cur.rain, drizzle: dz, snow: cur.snow, gust: cur.gust, wind: cur.surface }, where(), 0.5 + 0.5 * Math.sin(realNow / 2300 + Math.sin(realNow / 5100) * 2));

      // ---- the public face
      api.state = cur.name; api.label = LABEL[cur.name] || cur.name; api.cloud = cur.cover; api.rain = cur.rain; api.fog = cur.fog;
      api.wind.dir = cur.dir; api.wind.speed = cur.surface; api.wind.fromDeg = cur.fromDeg; api.wind.gust = cur.gust; api.wind.aloft = cur.wind;
      api.puddle = pudV; api.drop = cur.drop; api.bow = bowV;
      api.tempC = cur.tempC; api.wet = wetV; api.snow = snowCover; api.frost = cur.frost; api.thunder = cur.thunder; api.season = cur.season;
      api.grip = clamp(1 - 0.15 * wetV - 0.3 * snowCover - 0.1 * cur.frost, 0.5, 1);
      api.umbrellas = sstep(0.03, 0.2, cur.rain) * (1 - 0.6 * cur.snow);
      api.crowd = clamp(1 - 0.45 * sstep(0.08, 0.6, cur.rain) - 0.12 * cur.fog - 0.1 * sstep(6, 10, cur.surface), 0.4, 1);
      api.flash = flash; api.forced = forced;

      // ---- HUD: a small glyph and the temperature beside the clock
      if ((hudT -= dt) <= 0) { hudT = scrub && Math.abs(scrub.rate) > 4 ? 0.2 : 1; hud(); if (dbgOn) debug(tw); }
      cpuUs = cpuUs * 0.9 + ((typeof performance !== 'undefined' ? performance.now() : 0) - t0) * 100;
    }
    function where() {
      const p = game.player, v = p && p.vehicle;
      if (p && p.place !== 'world') return 'in';
      if (v && v.kind === 'glider') return 'canopy';
      if (v && (v.kind === 'car' || v.kind === 'bus' || v.kind === 'taxi' || v.kind === 'van')) return 'car';
      return dry[3] ? 'cover' : 'out';
    }
    // ---- the debug read-out (?fps, F2): every continuous variable, the label derived from them, the weather clock
    let dbgOn = params.has('fps'), dbgEl = null;
    if (typeof addEventListener !== 'undefined') addEventListener('keydown', (e) => { if (e.code === 'F2' && !e.repeat) { dbgOn = !dbgOn; if (dbgEl) dbgEl.style.display = dbgOn ? 'block' : 'none'; } });
    function debug(tw) {
      if (typeof document === 'undefined' || !document.createElement || !document.body) return;
      if (!dbgEl) {
        dbgEl = document.createElement('div'); dbgEl.id = 'weather-debug';
        dbgEl.style.cssText = 'position:fixed;left:8px;top:34px;z-index:20;font:12px/1.4 "Courier New",monospace;background:rgba(0,0,0,.65);color:#9cf;padding:4px 8px;border-radius:4px;pointer-events:none;white-space:pre';
        document.body.appendChild(dbgEl);
      }
      const f = (v, n = 2) => (+v).toFixed(n), th = tw / HOUR_MS, d = Math.floor(tw / DAY_MS);
      dbgEl.textContent = `wx ${cur.name}${forced ? ' (forced)' : ''}${scrub ? ' (scrub x' + scrub.rate + ')' : ''} · day ${d} ${f(hourOf(tw), 2)} h (t ${f(th, 1)}) · season ${f(cur.season)} · p ${f(nat.p)}\n`
        + `cloud ${f(cur.cover)} (cu ${f(cur.cu)} @${Math.round(cur.cuBase)} m, deck ${f(cur.st)} @${Math.round(cur.stBase)} m) · rain ${f(cur.rain)} drop ${f(cur.drop, 1)} mm · showery ${f(cur.showery)} · fog ${f(cur.fog)} · thunder ${f(cur.thunder)}\n`
        + `wind ${Math.round(cur.fromDeg)}° ${f(cur.surface, 1)} m/s gust ${f(cur.gust)} · ${f(cur.tempC, 1)} °C · wet ${f(wetV)} puddles ${f(pudV)} · snow ${f(snowCover)} frost ${f(cur.frost)} · bow ${f(bowV)} · drops ${drops}`;
    }
    let hudEl = null;
    function hud() {
      if (typeof document === 'undefined' || !document.getElementById) return;
      if (!hudEl) {
        const host = document.getElementById('hud'); if (!host || !document.createElement) return;
        hudEl = document.createElement('div'); hudEl.id = 'weather';
        hudEl.style.cssText = 'position:absolute;right:112px;top:18px;font:700 18px "Courier New",monospace;color:#e8eef4;white-space:nowrap;display:flex;align-items:center;gap:4px';
        host.appendChild(hudEl);
      }
      const night = (game.world && game.world.night) > 0.5, key = cur.name + (night ? 'n' : 'd') + Math.round(cur.tempC);
      if (key === hudKey) return;
      hudKey = key;
      hudEl.innerHTML = icon(cur.name, night, 24) + `<span>${Math.round(cur.tempC)}°</span>`;
      hudEl.title = (LABEL[cur.name] || cur.name) + ', ' + Math.round(cur.tempC) + ' °C';
    }
    { const wt = params.get('wxtime'); if (wt !== null && wt !== '' && isFinite(+wt)) setScrub(+wt, params.get('wxrate') === null ? 1 : +params.get('wxrate')); }
    update(0);
    return { id: 'weather', update };
  },
};
