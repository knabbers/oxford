// Ambient sound everywhere: the place, the hour and the weather, heard from where its sources really are.
//   outdoors  the city's far hush · wind in the leaves and, in the open (Port Meadow, South Park, a bridge), the wind
//             itself — both follow the weather's wind and its gusts, and what shelters you (a quad, a street: rays
//             cast at the real walls) · traffic from the side the road is on, and each car, bus and bicycle that
//             passes, placed where it is · the crowd actually around you · water lapping on the side the water is,
//             Osney weir from a way off, the fountain in Tom Quad, drips after rain · birds: each singer keeps to a
//             real tree for a minute or two (blackbird, robin, wren, great tit, wood pigeon; crow, magpie, jackdaw,
//             gull; ducks, geese and moorhens by water; tawny owls and passing redwings at night), the flocks the
//             game draws call from where they fly (a skein of geese going over), the birds that land near you go up
//             with a clatter · bicycle bells, late revellers near Carfax, a siren somewhere across town, a train on
//             the line, pub doors, the thump of a club through its wall · bells: the hour from Carfax / St Mary's
//             and, each a little off the others, the rest of the town's towers; Great Tom at 21:05; a band at
//             practice on some evenings
//   indoors   each room's tone, small sounds and reverberation (footsteps too); the outdoors goes on being heard
//             through the walls, dull and low, and opens up as you near an open door — walking through a doorway
//             is a cross-fade by position (two bus gains and a filter), never a switch
//   always    the player's footsteps by surface (stone, wet stone, grass, fallen leaves, snow, wood, carpet), the
//             "busted" sting, speech ducking the music + ambience, and the U key (music + ambience: full → half → off)
// Rules: _amb_logic.js (pure). Where things are: _amb_scene.js (pure). Sound: _amb_synth.js (+ the few bird
// recordings, _amb_samples.js). The real work happens twice a second (four times near a doorway) and ten times a
// second for passing vehicles; per frame it only moves the listener and counts footsteps (no allocations). Nothing is
// sent between players: everything follows the shared clock, the shared weather and what each player has around them.
// Nothing happens before Play or while the tab is hidden.
// Test hooks: game.ambience = { mix, env, sources(), synth, scene, force(place|null), stats() }. tools/smoke_ambience.mjs.
import { buildGrid, sampleGrid, outdoorMix, placeProfile, hourStrokes, bellLevel, strokeFade, due, seeded, sharedWindow, ringing, changeRow, occluded, sourcesOf, EVENTS, TOWERS, TOWERS_FAR, isIndoorEvent } from './_amb_logic.js';
import { AmbSynth } from './_amb_synth.js';
import { TrafficSound } from './_vehicle_audio.js';
import { buildScene, nearest, pickTree } from './_amb_scene.js';
import { meal as mealAt, evensong, dayOf } from '../places/_worcint_logic.js';
import { ballAt } from '../places/_parks_match.js';

const CRICKET = [379.6, -786.3];               // places/_parks_dress.js CRICKET.c
const BAT_T = 14.3, CLAP_T = 18.2;             // seconds into a ball: bat on ball / the ball reaches the rope (_parks_people.js)
const STONE = new Set(['worcint_chapel', 'worcint_lodge', 'maths_institute', 'worcint_stair5', 'mus_ash', 'mus_nhm', 'rad_divinity', 'rad_reading', 'cw_market', 'rad_tower', 'worcint_pidge']);
const CARPET = new Set(['worcint_library', 'worcint_memorial', 'randolph_lobby', 'maths_lecture', 'bs_basement']);
const WINDOW = 0.5, NEAR_DOOR = 0.25, VEH_T = 0.1;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// who sings from where: 't' a tree, 'w' the water, 'a' the air / a roof
const PERCH = { songbird: 't', blackbird: 't', robin: 't', pigeon: 't', owl: 't', kewick: 't', wren: 't', tit: 't', sparrow: 't', crow: 't', magpie: 't', chink: 't', duck: 'w', moorhen: 'w', goose: 'w', jackdaw: 'a', gull: 'a', redwing: 'a' };
// the flocks the game draws (systems/birds.js): what each calls as it flies, and how often (calls a second for one bird)
const FLOCK = { gull: ['gull', 0.012], big_gull: ['gull', 0.012], canada_goose: ['goose', 0.1], greylag: ['goose', 0.1], crow: ['crow', 0.02], jackdaw: ['jackdaw', 0.045], swift: ['swift', 0.1], red_kite: ['kite', 0.012], buzzard: ['kite', 0.005], mallard: ['duck', 0.02], mallard_hen: ['duck', 0.02] };
// the birds that land near you: what one says while it is down, and what it sounds like going up
const LANDED = { robin: ['robin', 0.02], sparrow: ['sparrow', 0.04], blackbird: ['chink', 0.004], blackbird_hen: ['chink', 0.004], mallard: ['duck', 0.02], mallard_hen: ['duck', 0.03], canada_goose: ['goose', 0.03], greylag: ['goose', 0.03], gull: ['gull', 0.01], magpie: ['magpie', 0.012], crow: ['crow', 0.01], jackdaw: ['jackdaw', 0.02] };
const UP = { pigeon: 'clatter', pigeon_dark: 'clatter', pigeon_pied: 'clatter', woodpigeon: 'clatter', mallard: 'clatter', mallard_hen: 'clatter', canada_goose: 'clatter', greylag: 'clatter', gull: 'clatter', crow: 'clatter', jackdaw: 'clatter', magpie: 'clatter' };
const RAINY = ['songbird', 'blackbird', 'robin', 'pigeon', 'duck', 'bikebell', 'wren', 'tit', 'sparrow', 'crow', 'jackdaw', 'magpie', 'gull', 'chink', 'moorhen', 'goose', 'owl', 'kewick'];      // what keeps quiet in the rain
const ZERO = { air: 0, wind: 0, moan: 0, traffic: 0, crowd: 0, water: 0 };
// people talking: which recordings (public/audio/ambient, _amb_manifest.js) serve which kind of company
const WALLA = {
  street: ['walla_street1', 'walla_street2', 'walla_street3', 'walla_street4'], group: ['walla_group1', 'walla_group2'], room: ['walla_group1', 'walla_group2'],
  pub: ['walla_pub1', 'walla_pub2', 'walla_pub3'], dining: ['walla_dining1', 'walla_dining2'], market: ['walla_market1', 'walla_market2'],
  cafe: ['walla_cafe1', 'walla_cafe2'], kids: ['walla_kids1', 'walla_kids2', 'walla_kids3'], idle: ['idle_train'], coach: ['idle_coach'],
};
const PEOPLE_AT = { pub: 'pub', cafe: 'cafe', yard: 'pub', kids: 'kids', market: 'market', idle: 'idle', coach: 'coach' };      // emitters (_amb_scene.js) that are recordings: people, and engines standing
const SCALE = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];      // a ring of bells: the tenor and up

export default {
  id: 'ambience',
  install(game) {
    const audio = game.audio;
    let grid = null, scene = null;
    try { grid = buildGrid(game.map); } catch (e) { console.warn('[ambience] grid', e); }
    try { scene = buildScene(game.map); } catch (e) { console.warn('[ambience] scene', e); }
    const env = { green: 0, water: 0, road: 0, shop: 0, trees: 0, built: 0, open: 0, hour: 12, daylight: 1, peds: 0, cars: 0, cx: 0, cz: 0, wind: 3, season: 0.3, wet: 0, rain: 0, wdx: 0, wdz: 0, rdx: 0, rdz: 0 };
    const mix = {}, prof = {}, st = { people: 0, meal: null, service: false, name: '', hour: 12 }, near = [], BA = {};
    const LOC = { pan: 0, gain: 0, cut: 0, d: 0 }, RC = {}, L2 = [0, 0], T3 = [0, 0, 0], BO = { x: 0, y: 0, z: 0, r: 0 }, ROW = new Int8Array(8);
    const R = { in: 0, out: 1, cut: 20000, id: null, door: false };
    const NE = []; for (let i = 0; i < 3; i++) NE.push({ e: null, d: 0, g: 0 });
    const slotE = [null, null, null], slotBurst = [0, 0, 0], mixed = [], remote = []; let traffic = null;
    const bellQ = []; for (let i = 0; i < 6; i++) bellQ.push({ left: 0, next: 0, gap: 1.3, hz: 300, gain: 0, pan: 0, far: true, x: 0, z: 0 });
    const landSt = new Uint8Array(32), trainKey = ['', ''], keys = []; let nKeys = 0, sweepN = 0;
    let synth = null, lastSlow = -1, win = WINDOW, gust = 0.5, gustT = 0, gustTo = 0.5, lastHour = null, lastPlace = null, stepT = 0, left = false, busted = null, tickN = 0, forced = null;
    let frameS = null, lx = 0, lz = 0, ly = 0, lyaw = 0, vehT = 0, shelter = 0, alt = 0, ringT = 0, TR = null, STN = null, surface = 'stone', flushG = -1;
    const A = (game.ambience = {
      mix, env, prof, synth: null, grid, scene, room: R, fired: 0, strokes: 0,
      sources: () => { const s = sourcesOf(mix); if (R.in > 0.05) for (const k of sourcesOf(prof)) if (!s.includes(k)) s.push(k); return s; },
      force: (p) => { forced = p; },
      stats: () => ({ live: synth ? synth.live : 0, peak: synth ? synth.peakLive : 0, dropped: synth ? synth.dropped : 0, place: lastPlace, sources: A.sources(), in: +R.in.toFixed(2), out: +R.out.toFixed(2), cut: Math.round(R.cut),
        open: +env.open.toFixed(2), shelter: +shelter.toFixed(2), wind: +env.wind.toFixed(1), gust: +gust.toFixed(2), surface, alt: Math.round(alt), spots: synth && synth.slots ? synth.slots.map((s) => (s.v > 0.0004 ? s.kind : null)) : [],
        recordings: synth && synth.samples ? synth.samples.loaded : 0, fired: A.fired, strokes: A.strokes, sharedSec: Math.round(game.time.now() / 1000), hour: +game.time.hour.toFixed(2), refused: audio.refused || 0, ctx: audio.ctx ? audio.ctx.state : null }),
    });
    // the station's trains run on the shared clock (places/_cw_train.js, a pure timetable): heard from across the meadow
    try { Promise.all([import('../places/_cw_train.js'), import('../places/_cw_station.js')]).then(([a, b]) => { if (a.trainAt && b.L) { TR = a; STN = b; } }, () => { /* no trains here (a test page) */ }); } catch { /* */ }

    // a wall between the listener and a point? (out of doors: one ray at the real walls; inside a room everything in it is in the open)
    audio.occluder = (x, z) => { const wc = game.worldCollider, c = game.camera.position; if (frameS || game.player.place !== 'world' || !wc || !wc.raycast || Math.hypot(x - c.x, z - c.z) < 2.5) return false; return wc.raycast(c.x, c.z, x, z, RC) !== null; };
    // if a NaN ever reaches the output (core/audio.js heal()), every filter it passed through is dead: make the synthesiser anew
    if (audio.onPoison) audio.onPoison(() => { if (!synth) return; const keep = synth.samples; try { synth.dispose(); } catch { /* */ } synth = A.synth = new AmbSynth(audio); synth.samples = keep; bellsLv = 1; for (let i = 0; i < 3; i++) slotE[i] = null; A.rebuilt = (A.rebuilt || 0) + 1; });
    // the rooms' frames, for sounds given in a room's own coordinates (core/audio.js spatial: {x, y, z, place})
    audio.frames = (id) => { const I = game.interiors, d = I && I.get ? I.get(id) : null; return d && d.sl && d.sl.toWorld ? d.sl : null; };
    // (no keys for sound: the volumes and the headphones / speakers choice are on the Esc screen's sound panel — systems/keyhelp.js)

    /** a world point as heard: LOC.pan, .gain (ref = metres at half level, nothing beyond range), .cut (Hz left of it), .d */
    function locate(x, z, y, ref, range, occl) {
      const dx = x - lx, dz = z - lz, dh = Math.hypot(dx, dz), d = Math.hypot(dh, y - ly);
      LOC.d = d; LOC.pan = dh < 0.5 ? 0 : Math.max(-0.85, Math.min(0.85, ((dx * -Math.cos(lyaw) + dz * Math.sin(lyaw)) / dh) * Math.min(1, dh / 6)));
      if (d >= range) { LOC.gain = 0; LOC.cut = 1200; return LOC; }
      let g = (ref / (ref + d)) * Math.min(1, (1 - d / range) * 3), cut = Math.max(1200, 15000 / (1 + d / 50));
      if (occl && dh > 6) { const o = blocked(x, z, dh) * occl; if (o > 0) { g *= 1 - 0.55 * o; cut *= 1 - 0.6 * o; } }
      LOC.gain = g; LOC.cut = cut;
      return LOC;
    }
    /** 0..1: is there a building between the listener and (x, z)? the real walls when near, the raster further off */
    function blocked(x, z, dh) {
      const wc = game.worldCollider;
      if (wc && wc.raycast && dh < 90) { try { return wc.raycast(lx, lz, x, z, RC) === null ? 0 : 1; } catch { /* fall through */ } }
      return grid ? occluded(grid, lx, lz, x, z) : 0;
    }
    /** how shut in the spot is: eight rays at the real walls, 45 m. 0 = open country, ~0.8 = a quad or a street */
    function shelterAt(x, z) {
      const wc = game.worldCollider; if (!wc || !wc.raycast) return -1;
      let s = 0;
      try { for (let i = 0; i < 8; i++) { const a = i * 0.7854 + 0.2, t = wc.raycast(x, z, x + Math.sin(a) * 45, z + Math.cos(a) * 45, RC); if (t !== null) s += 1 - 0.6 * t; } } catch { return -1; }
      return s / 8;
    }
    // (a door counts as fully open to sound from the moment it can be walked through: the two sides then meet at the threshold)
    /** bells carry on the wind: louder downwind of the tower, fainter upwind (GUESS: weather.wind.dir is taken as the heading the wind blows towards) */
    function carried(x, z) {
      const W = game.weather && game.weather.wind; if (!W || !(W.speed > 0.5) || typeof W.dir !== 'number') return 1;
      const dx = lx - x, dz = lz - z, d = Math.hypot(dx, dz); if (d < 40) return 1;
      return 1 + 0.35 * Math.min(1, W.speed / 7) * Math.min(1, d / 300) * ((Math.sin(W.dir) * dx + Math.cos(W.dir) * dz) / d);
    }
    const doorOpen = (P) => { let o = P.open ? 1 : 0; const D = P.doors || (P.door ? [P.door] : null); if (D) { o = 0; for (const d of D) { const v = typeof d.open === 'number' ? d.open : d.passable ? 1 : 0; if (v > o) o = v; } } return clamp01(o / 0.6); };

    /** where you are with respect to rooms -> R.in (how present the room is), R.out / R.cut (how the outdoors is heard), prof */
    function roomCtx(pl, place, wp, h) {
      const I = game.interiors;
      R.in = 0; R.out = 1; R.cut = 20000; R.id = null; R.door = false;
      st.hour = h;
      if (place !== 'world') {
        const d = I && I.get ? I.get(place) : null, W = game.worcint;
        st.meal = null; st.service = false; st.name = (d && d.name) || '';
        if (place === 'worcint_hall') st.meal = W && W.force && W.force.meal !== null && W.force.meal !== undefined ? W.force.meal : mealAt(dayOf(game.time), h);
        if (place === 'worcint_chapel') st.service = W && W.force && W.force.service !== null && W.force.service !== undefined ? !!W.force.service : evensong(dayOf(game.time), h);
        placeProfile(place, st, prof);
        R.id = place; R.in = 1; R.out = prof.leak; R.cut = prof.wall;
        const S = d && d.sl && pl.place === place ? d.sl : null;
        if (S && S.portals) {
          let open = 0, depth = 9, glass = 0, dOpen = 0;
          for (const P of S.portals) {
            if (P.off) continue;                                  // (a door to another room, not to the street)
            const rx = pl.pos.x - P.at[0], rz = pl.pos.z - P.at[1], inw = -(rx * P.dx + rz * P.dz), lat = Math.abs(rx * P.tx + rz * P.tz);
            const dist = Math.hypot(Math.max(0, inw), Math.max(0, lat - P.w / 2)), po = doorOpen(P), o = po * clamp01(1 - dist / 11);
            if (o > open) open = o;
            if (dist < 4) R.door = true;
            if (lat < P.w / 2 + 0.8 && inw < depth) { depth = Math.max(-1, inw); dOpen = po; }
          }
          if (S.openings) for (const O of S.openings) { if (!O.at) continue; const g = clamp01(1 - Math.hypot(pl.pos.x - O.at[0], pl.pos.z - O.at[1]) / 4.5); if (g > glass) glass = g; }
          const o2 = open * open;
          R.out = Math.min(1, prof.leak * (1 + 1.2 * glass) + (1 - prof.leak) * o2);
          R.cut = prof.wall * (1 + 1.5 * glass) + (16000 - prof.wall) * o2 * open;
          R.in = depth < 2.5 ? 1 - (1 - sstep(-2, 2.5, depth)) * dOpen : 1;      // (0.42 in an open doorway: what the street side has faded up to as you reach it)
        }
        return;
      }
      // out of doors: the room whose open doorway you are at is already heard
      if (!I || !I.sl) return;
      for (let i = 0; i < I.sl.length; i++) {
        const d = I.sl[i], S = d.sl; if (!S || !S.shown || !S.portals) continue;
        if (Math.abs(S.cx - wp.x) + Math.abs(S.cz - wp.z) > (S.reach || 30) + 6) continue;
        const l = S.toLocal(wp.x, wp.z, L2);
        for (const P of S.portals) {
          if (P.off) continue;
          const rx = l[0] - P.at[0], rz = l[1] - P.at[1], outw = rx * P.dx + rz * P.dz, lat = Math.abs(rx * P.tx + rz * P.tz);
          if (outw < -0.6 || outw > 6 || lat > P.w / 2 + 2.5) continue;
          R.door = true;
          const k = (outw < 2 ? sstep(-2, 2.5, -Math.max(0, outw)) : 0) * doorOpen(P) * clamp01(1 - (lat - P.w / 2) / 1.2);
          if (k > R.in) { R.in = k; R.id = d.id; st.meal = null; st.service = false; st.name = d.name || ''; }
        }
      }
      if (R.in > 0) { st.people = 0; placeProfile(R.id, st, prof); }
    }

    /** the singer of this species: the same bird in the same tree for a while. -> the record, or null while it is still on its last phrase */
    /**
     * Where the bird of this kind is singing from just now -> PX [x, y, z]. The same for every player in the same 80 m
     * square of the map: a function of the species, the square and the shared clock (a bird keeps a perch for 75 s).
     */
    function perch(name, ni, ts, wp) {
      const how = PERCH[name] || 'a', cx = Math.round(wp.x / 80), cz = Math.round(wp.z / 80), ax = cx * 80, az = cz * 80;
      const r = seeded(Math.imul(ni + 1, 7919) ^ Math.imul(Math.floor(ts / 75), 104729) ^ Math.imul(cx, 31337) ^ Math.imul(cz, 65537));
      if (how === 't' && scene && pickTree(scene, ax, az, 0, 85, r, T3)) { PX[0] = T3[0]; PX[1] = Math.max(3, T3[2] * 0.75); PX[2] = T3[1]; return; }
      if (how === 'w' && (env.wdx || env.wdz)) { const d = 10 + r() * 30, a = (r() - 0.5) * 1.2, c = Math.cos(a), sn = Math.sin(a); PX[0] = wp.x + (env.wdx * c - env.wdz * sn) * d; PX[1] = 0; PX[2] = wp.z + (env.wdx * sn + env.wdz * c) * d; return; }
      const a = r() * 6.283, d = how === 'a' ? 30 + r() * 70 : 18 + r() * 45; PX[0] = ax + Math.sin(a) * d; PX[1] = how === 'a' ? 22 + r() * 30 : 8; PX[2] = az + Math.cos(a) * d;
    }
    const PX = [0, 0, 0], DUE = new Float64Array(24), busy = new Float64Array(EVENTS.length);
    const SW = { t: 0, a0: 0, a1: 0 }; let tickT = 0, tickTs = 0;
    /** one bell stroke (or chime note) of the hour, from _amb_logic hourStrokes: placed at its tower, timed on the shared clock */
    function onStroke(id, T, w, hz, kind, d, near, i = 0) {
      if (synth.live >= 30) return;
      const p = locate(T.p[0], T.p[1], 30, 320, 5000, 0);
      const g = bellLevel(p.d) * (kind ? 1 : strokeFade(i)) * (id === 'tom' ? 0.8 : 1) * Math.min(1.15, carried(T.p[0], T.p[1])), pan = p.pan, when = tickT + (w - tickTs);
      if (g < 0.012 || !(when > tickT)) return;
      A.strokes++;
      synth.to('bells', 0, () => (kind ? synth.ding(when, hz, g * 0.8, pan) : synth.bell(when, hz, g, pan, !near && d > 240)), frame(T.p[0], 30, T.p[1]));
    }
    // a world point in the frame the listener is in (a walk-in room has its own): what audio.spatial wants -> FP (reused)
    const FP = [0, 0, 0];
    function frame(x, y, z) { const S = frameS; if (S) { const l = S.toLocal(x, z, L2); FP[0] = l[0]; FP[1] = y - S.base(); FP[2] = l[1]; } else { FP[0] = x; FP[1] = y; FP[2] = z; } return FP; }
    /** somewhere round the listener, d0..d1 metres off (a sound with no particular source: a drip, a cough across the room) -> FP */
    function around(d0, d1, y, u = Math.random()) { const a = u * 6.283, d = d0 + ((u * 7.13) % 1) * (d1 - d0), c = game.camera.position; FP[0] = c.x + Math.sin(a) * d; FP[1] = y; FP[2] = c.z + Math.cos(a) * d; return FP; }
    const fire = (name, when, g, x, z, y, ref, range, occl, rnd = Math.random) => { const p = locate(x, z, y, ref, range, occl); if (p.gain * g > 0.006 && synth.event(name, when, g * p.gain * 1.5, p.pan, rnd, p.cut, frame(x, y, z))) A.fired++; };      // (x 1.5: what binaural placing takes off a sound's level, measured)

    function slow() {
      const pl = game.player, place = forced || pl.place, outdoors = place === 'world', t = audio.ctx.currentTime;
      const wp = pl.place === 'world' ? pl.pos : pl.worldPos || pl.pos, h = game.time.hour, Wx = game.weather;
      if (grid) sampleGrid(grid, wp.x, wp.z, env);
      // (off the west edge of the raster is Port Meadow, which the map file does not hold: open grass)
      if (grid && wp.x < grid.minX - 8) { env.green = 1; env.open = 1; }
      env.hour = h; env.daylight = game.time.daylight; env.cx = wp.x; env.cz = wp.z;
      env.wind = Wx && Wx.wind ? Wx.wind.speed || 0 : 3; env.season = Wx && Wx.season !== undefined ? Wx.season : 0.3; env.wet = Wx ? Wx.wet || 0 : 0; env.rain = Wx ? Wx.rain || 0 : 0;
      const sh = shelterAt(wp.x, wp.z); if (sh >= 0) { shelter = sh; env.open = clamp01(1 - 1.25 * sh) * (1 - 0.3 * Math.min(1, env.trees)); } else shelter = 1 - env.open;
      // the people and the traffic actually round you, and which side they are on
      const P = game.pedestrians, T = game.traffic;
      env.peds = 0; env.cars = 0; st.people = 0;
      let px = 0, pz = 0, nearPed = null, nearD = 1e9;
      if (P && P.near) {
        const n = P.near(pl.pos.x, pl.pos.z, 30, near).length; if (outdoors) env.peds = n; else st.people = n;
        if (outdoors) for (let i = 0; i < n; i++) { const q = near[i], d = Math.hypot(q.x - wp.x, q.z - wp.z); px += q.x - wp.x; pz += q.z - wp.z; if (d < nearD && d > 2) { nearD = d; nearPed = q; } }
      }
      if (T && T.list && outdoors) for (const a of T.list) if (a.kind === 'car' && Math.abs(a.speed) > 1 && Math.abs(a.x - wp.x) < 60 && Math.abs(a.z - wp.z) < 60) env.cars += a.type === 'bus' ? 2 : 1;
      // slow gusts: a wandering swell, wider on a gusty day
      if ((gustT -= win) <= 0) { gustT = 1.5 + Math.random() * 5; gustTo = Math.random(); }
      const gy = Wx && Wx.wind ? clamp01(0.45 + (Wx.wind.gust || 0)) : 0.7;
      gust += ((0.5 + (gustTo - 0.5) * gy) - gust) * (win > 0.3 ? 0.2 : 0.1);

      outdoorMix(env, mix);
      // the weather: birds quiet in the rain and the fog, leaves roar on a blustery day. What HAPPENS (the rates) follows
      // the SHARED weather (weather._nat: no first-visit fair spell, no forced state), so every player gets the same
      // events; how the beds sound follows the weather this player is shown.
      const Rt = mix.rates, nat = Wx && Wx._nat ? Wx._nat : null, rainK = 1 - 0.85 * clamp01((nat ? nat.rain || 0 : env.rain) * 2.5);
      for (let i = 0; i < RAINY.length; i++) Rt[RAINY[i]] *= rainK;
      Rt.songbird *= 1 - 0.6 * clamp01(nat ? nat.fog || 0 : 0);
      mix.wind *= 1 + 0.9 * sstep(4, 9, env.wind); mix.crowd *= 1 - 0.4 * clamp01(env.rain * 2.5);
      mix.wetLeaves = clamp01(env.rain * 3 + env.wet * 0.5);
      // aloft (a glider, a parachute): the ground falls away
      const GL = game.gliding; alt = 0;
      if (GL && GL.active && GL.airborne) { const gh = game.world && game.world.groundHeight ? game.world.groundHeight(wp.x, wp.z) : 0; alt = Math.max(0, pl.pos.y - gh); }
      if (alt > 5) {
        const ga = 1 / (1 + alt / 60);
        mix.air *= 0.3 + 0.7 * ga; mix.traffic *= ga; mix.crowd *= ga * ga; mix.water *= ga * ga; mix.wind *= ga * ga; mix.moan = 0;      // (the airflow over the canopy is the glider's own sound)
        for (const k of EVENTS) Rt[k] *= ga * ga;
      }
      roomCtx(pl, place, wp, h);
      let og = R.out, oc = R.cut;
      const v = pl.vehicle;
      if (outdoors && v && (v.kind === 'car' || v.kind === 'bus' || v.kind === 'taxi' || v.kind === 'van')) { og *= 0.5; oc = Math.min(oc, 2600); }                // windows up
      else if (outdoors && v && !(GL && GL.active)) mix.moan = Math.min(1.4, mix.moan + Math.abs(pl.speed || 0) / 16);                                        // wind in your ears on a bike
      A.outdoors = outdoors;
      const tc = place !== lastPlace ? 0.5 : R.door ? 0.3 : 0.8;
      const heard = og > 0.045;                                      // (under that the outdoors is 30 LU and more below the room: not heard)
      // ---- people talking (recordings): as many as are really round you, of the kind the place has. Where a recording
      // is playing, the synthesised murmur drops back to a trace under it; where none is decoded yet, it stands in.
      nKeys = 0;
      const cm = Math.hypot(px, pz), cpan = cm > 1 ? 0.5 * ((px * -Math.cos(lyaw) + pz * Math.sin(lyaw)) / cm) * Math.min(1, cm / (4 * Math.max(1, env.peds))) : 0;
      if (heard && outdoors && env.peds >= 3 && alt < 30) {
        const n = env.peds, kind = n >= 8 ? 'street' : 'group', key = 'out:' + kind;
        const lvl = Math.pow(clamp01((n - 2) / 16), 0.7) * (0.55 + 0.45 * env.shop) * (0.5 + 0.5 * mix.crowd / Math.max(0.01, clamp01((Math.max(0, n - 2) / 14) * (0.55 + 0.45 * env.shop))));      // (the weather's hand on the crowd is kept)
        if (synth.people(key, WALLA[kind], lvl, cpan, 20000, 'bed', n >= 16 ? 2 : 1)) { mix.crowd *= 0.25; keys[nKeys++] = key; }
      }
      if (R.in > 0 && prof.walla && prof.crowd > 0.02) {
        const key = 'in:' + prof.walla;
        if (synth.people(key, WALLA[prof.walla], prof.crowd, 0, 20000, 'room', prof.crowd > 0.55 ? 2 : 1)) { prof.crowd *= 0.25; keys[nKeys++] = key; }
      }
      synth.applyOut(heard ? mix : ZERO, gust, tc);                  // (shut in behind thick walls the outdoor layers are unplugged: they cost nothing)
      synth.applyIn(R.in > 0 ? prof : null, 1, 0.6);
      synth.scene(og, oc, R.in, R.door ? 0.25 : 0.45);
      synth.room(R.in > 0.3 && place !== 'world' ? prof.rev : 'dry', R.in > 0.3 && place !== 'world' ? prof.send : 0);
      if (env.rdx || env.rdz) synth.pan('traffic', 0.6 * (env.rdx * -Math.cos(lyaw) + env.rdz * Math.sin(lyaw)));
      if (env.wdx || env.wdz) synth.pan('water', 0.6 * (env.wdx * -Math.cos(lyaw) + env.wdz * Math.sin(lyaw)));
      synth.pan('crowd', cpan);
      audio.amb = env;                                                 // (the weather's sound reads how exposed the spot is: _weather_audio.js)
      lastPlace = place;

      // ---- scattered events, ON THE SHARED CLOCK: what happens in each second is a function of that second (and of the
      // place), not of a local dice, so two players standing together hear the same gull at the same moment. This tick
      // covers the shared seconds [a0, a1) that no earlier tick has covered.
      const ts = game.time.now() / 1000; sharedWindow(SW, ts, win); const a0 = SW.a0, a1 = SW.a1; tickT = t; tickTs = ts;
      let roomSeed = 0; if (R.id) for (let i = 0; i < R.id.length; i++) roomSeed = (roomSeed * 31 + R.id.charCodeAt(i)) & 0xffff;
      for (let i = 0; i < EVENTS.length; i++) {
        const name = EVENTS[i], indoor = isIndoorEvent(name);
        const n = due(indoor ? 3000 + i + roomSeed * 64 : i, indoor ? (R.in > 0.3 ? prof.rates[name] * R.in : 0) : heard ? Rt[name] : 0, a0, a1, DUE);
        for (let j = 0; j < n; j++) {
          const w = DUE[j * 3], u = DUE[j * 3 + 1], u2 = DUE[j * 3 + 2], when = t + (w - ts), rnd = seeded(Math.floor(w * 16) + i * 977);
          if (indoor) { if (synth.event(name, when, 0.35 + 0.65 * u, 0, rnd, 0, around(2.5, 9, name === 'creak' ? 0.3 : 1.2, u2))) A.fired++; continue; }
          const g = 0.45 + 0.55 * u;
          if (PERCH[name]) {
            if (busy[i] > w) continue;                                  // (still on its last phrase)
            busy[i] = w + (name === 'blackbird' || name === 'pigeon' || name === 'wren' ? 4.5 : name === 'owl' ? 6 : 2.5);
            perch(name, i, w, wp);
            fire(name, when, g * 1.6, PX[0], PX[2], PX[1], 16, name === 'owl' || name === 'goose' || name === 'gull' ? 260 : 120, PERCH[name] === 't' ? 0.5 : 0, seeded(Math.floor(w * 16) + i * 977));
          } else if (name === 'drip') { if (synth.event(name, when, 0.3 + 0.7 * u, 0, rnd, 0, around(1.5, 7, 0.2, u2))) A.fired++; }
          else if (name === 'bikebell' && traffic && traffic.heard) {                           // rung by a cyclist who is really there, if one is passing
            let bk = null; for (let q = 0; q < traffic.slot.length; q++) if (traffic.slot[q] && traffic.slot[q].kind === 'bike') bk = traffic.slot[q];
            if (bk) fire(name, when, 1.3, bk.x, bk.z, 1, 8, 40, 0, rnd); else if (synth.event(name, when, g, 0, rnd, 6000, around(40, 90, 1.5, u2))) A.fired++;
          } else if (synth.event(name, when, g, 0, rnd, name === 'siren' ? 0 : 6000, around(name === 'siren' ? 250 : 40, name === 'siren' ? 400 : 90, 1.5, u2))) A.fired++;
        }
      }
      if (R.in > 0.3 && prof.tick) { const s0 = Math.ceil(t + 0.02); for (let q = s0; q < t + 0.02 + win; q++) synth.tick(q, R.in, (tickN++) & 1); }
      // someone passing on a street that is otherwise still
      if (outdoors && heard && nearPed && env.peds <= 3 && nearD < 14 && Math.random() < 0.05 * win) fire('heels', t + 0.05, 0.9, nearPed.x, nearPed.z, 0, 6, 30, 1);

      // ---- the flocks the game shows, calling from where they fly; the birds that landed near you
      const Bd = game.birds, sky = Bd && Bd.sky, sys = Bd && Bd.sys;
      if (sky && sys && heard && sky.flocks && sys.tier && Bd.species && (pl.place === 'world' || R.door || og > 0.2)) {
        const F = sky.flocks;
        for (let i = 0; i < F.length; i++) {
          const f = F[i]; if (f.ord > 0.7 || !f.tOn || !(Math.abs((f._t || 0) - ts) < 2)) continue;      // (the flocks every graphics tier draws: every player has them, so every player hears them)
          const sp = Bd.species[f.sp[0]], C = sp && FLOCK[sp.name]; if (!C) continue;
          const n = due(1000 + i, C[1] * Math.min(3.5, Math.sqrt(f.n || 1)) * rainK, a0, a1, DUE); if (!n) continue;
          if (!sky.bound(f, ts, BO)) continue;
          for (let j = 0; j < n; j++) { const w = DUE[j * 3], rnd = seeded(Math.floor(w * 16) + i * 613); fire(C[0], t + (w - ts), 0.9 + 0.6 * DUE[j * 3 + 1], BO.x + (DUE[j * 3 + 2] - 0.5) * BO.r, BO.z + (rnd() - 0.5) * BO.r, BO.y || 30, 45, 480, 0, rnd); }
        }
        const LL = sys.land && sys.land.list; let grp = -1;
        if (LL) for (let i = 0; i < LL.length && i < landSt.length; i++) {
          const b = LL[i], was = landSt[i]; landSt[i] = b.st;
          const sp = Bd.species[b.sp]; if (!sp) continue;
          if (was === 2 && b.st === 3 && b.grp !== grp && b.grp !== flushG) {                       // up they go: one sound for the party
            grp = b.grp; flushG = b.grp;
            const p = locate(b.x, b.z, b.y || 0, 7, 60, 0), kind = b.afloat ? 'splash' : UP[sp.name] || 'whirr';
            if (p.gain > 0.02 && synth.live < 28) { const pg = p.gain, pp = p.pan; synth.to('birds', p.cut, () => synth.flush(t + 0.03, kind, 1.6 * pg, pp, Math.random), frame(b.x, (b.y || 0) + 0.5, b.z)); }
            if (sp.name.startsWith('blackbird')) fire('chink', t + 0.15, 1.6, b.x, b.z, 2, 10, 80, 0);
            else if (sp.name.startsWith('mallard')) fire('duck', t + 0.2, 1.4, b.x, b.z, 2, 10, 80, 0);
          } else if (b.st === 2) { const C = LANDED[sp.name]; if (C && Math.random() < C[1] * win * rainK) fire(C[0], t + 0.03 + Math.random() * win, 1.2, b.x, b.z, b.y || 0, 9, 70, 0.5); }
        }
      }
      // the distant chorus at first light (a recording): gardens and parks
      synth.bed(heard ? clamp01(env.green * 1.3) * clamp01((mix.rates.songbird - 0.2) * 3) * rainK * (alt > 5 ? 0.3 : 1) : 0);

      // ---- the fixed sources near you: weirs, fountains, pub doors, clubs; flags in the wind
      if (scene) {
        const n = heard ? nearest(scene, lx, lz, h, NE, 3, 'flag', dayOf(game.time)) : 0;
        for (let i = 0; i < 3; i++) { let keep = false; for (let j = 0; j < n; j++) if (NE[j].e === slotE[i]) keep = true; if (!keep && slotE[i]) { synth.spot(i, null); slotE[i] = null; } }
        for (let j = 0; j < n; j++) {
          const N = NE[j], e = N.e; let i = slotE.indexOf(e);
          if (i < 0) { i = slotE.indexOf(null); if (i < 0) continue; slotE[i] = e; slotBurst[i] = 0; }
          const k = e.kind, wall = k === 'pub' || k === 'cafe' || k === 'club', p = locate(e.x, e.z, 0, e.K.ref, e.K.range, wall ? 0 : 1);
          if (PEOPLE_AT[k]) {                                                                                 // people, as a recording: through the door, or in the open
            const key = 'spot' + i, open = slotBurst[i] > t; if (wall && !open && Math.random() < 0.03 * win) slotBurst[i] = t + 1.2 + Math.random() * 1.8;
            const cut = wall ? (open ? 4500 : 1100) : Math.max(1500, 12000 * (1 - N.d / e.K.range)) * (p.cut < (15000 / (1 + N.d / 50)) * 0.9 ? 0.4 : 1);
            if (synth.people(key, WALLA[PEOPLE_AT[k]], N.g * (wall ? (open ? 1.6 : 0.8) : 1.1) * (alt > 5 ? 1 / (1 + alt / 40) : 1), p.pan, cut, 'spot', 1, 0.5, frame(e.x, 1.4, e.z))) {
              keys[nKeys++] = key; synth.spot(i, null);
              if (k === 'pub' && Math.random() < 0.06 * win * N.g * 4 && synth.live < 28) synth.to('town', 2500, () => synth.glass(t + 0.05 + Math.random() * win, 2.2 * N.g, p.pan, Math.random), frame(e.x, 1.2, e.z));
              continue;
            }
            if (!wall && k !== 'idle' && k !== 'coach') continue;                                             // (no recording yet: a door or an engine keeps its synthesised stand-in, people in the open wait)
          }
          let g = N.g, dull = Math.min(1, N.d / e.K.range) * 0.7 + (wall ? 0.25 : 0);
          if (!wall && p.cut < 15000 / (1 + N.d / 50) * 0.9) { g *= 0.6; dull = Math.min(1, dull + 0.4); }       // a building in the way
          if (wall && k !== 'club') {                                                                         // now and then the door opens
            if (slotBurst[i] > t) { g *= 1.9; dull *= 0.3; } else if (Math.random() < 0.03 * win) slotBurst[i] = t + 1.2 + Math.random() * 1.5;
            if (k === 'pub' && Math.random() < 0.09 * win * N.g * 4 && synth.live < 28) synth.to('town', 2500, () => synth.glass(t + 0.05 + Math.random() * win, 2.2 * N.g, p.pan, Math.random), frame(e.x, 1.2, e.z));
          }
          if (!synth.spot(i, k, g * (alt > 5 ? 1 / (1 + alt / 40) : 1), p.pan, dull, 0.35, frame(e.x, k === 'weir' ? 0 : 1, e.z))) continue;
          if (k === 'club') {                                                                                 // four to the floor on the shared clock, with the breakdowns left out
            const spb = 60 / (124 + (e.id % 5)), now = game.time.now() / 1000;
            for (let b = Math.ceil((now + 0.06) / spb); b * spb < now + 0.06 + win; b++) { const bar = Math.floor(b / 4) % 32; if (bar >= 28 || (bar % 8 === 7 && b % 4 === 3)) continue; if (synth.live < 26) synth.to('town', 0, () => synth.kick(t + (b * spb - now), 1.5 * N.g, p.pan), frame(e.x, 1, e.z)); }
          }
        }
        // ---- what happens at particular places (_amb_scene SITES): a crew on the river, cattle, a piano behind a window …
        if (heard && alt < 30 && scene.sites) {
          const day = dayOf(game.time), wd = ((day % 7) + 7) % 7, svc = evensong(day, h);
          for (let i = 0; i < scene.sites.length; i++) {
            const s = scene.sites[i], dx = s.x - lx, dz = s.z - lz; if (dx > s.range || dx < -s.range || dz > s.range || dz < -s.range) continue;
            let rate = (h >= s.h[0] && h < s.h[1]) || (h + 24 >= s.h[0] && h + 24 < s.h[1]) ? s.rate : 0;
            if (s.service && svc) rate = s.service;
            if (!rate) continue;
            const c = s.cond;
            if ((c === 'dry' && env.rain > 0.02) || (c === 'light' && env.daylight < 0.5) || (c === 'rut' && env.season > 0.67) || (c === 'match' && wd !== 2 && wd !== 5)) continue;
            const n = due(2000 + i, rate * rainK, a0, a1, DUE);
            for (let j = 0; j < n; j++) { const w = DUE[j * 3], a = DUE[j * 3 + 1] * 6.283, sp = s.range * 0.12 * DUE[j * 3 + 2]; fire(s.voice, t + (w - ts), 1.3, s.x + Math.sin(a) * sp, s.z + Math.cos(a) * sp, 1, s.ref, s.range, s.voice === 'practice' || s.voice === 'organ' ? 0 : 0.6, seeded(Math.floor(w * 16) + i * 389)); }
          }
        }
        if (heard && env.wind > 4) for (let i = 0; i < scene.em.length; i++) { const e = scene.em[i]; if (e.kind !== 'flag' || Math.abs(e.x - lx) > 32 || Math.abs(e.z - lz) > 32) continue; if (Math.random() < 0.3 * clamp01((env.wind - 4) / 5) * win) fire('halyard', t + 0.03 + Math.random() * win, 1.2, e.x, e.z, 6, 8, 32, 1); }
      }

      { const bl = audio.levels ? audio.levels.bells : 1; if (bl !== bellsLv && synth.G) { bellsLv = bl; synth.G.bells.gain.setTargetAtTime(bl, t, 0.1); } }      // the "Bells and clocks" volume (the sound panel)
      keys.length = nKeys; synth.peopleOff(keys);                     // beds of people that were not asked for this time fall silent
      if ((++sweepN & 31) === 0 && synth.samples && synth.samples.sweep) synth.samples.sweep();
      if (!A._want && synth.samples && synth.samples.want) { A._want = true; synth.samples.want(['blackbird', 'woodpigeon', 'greattit', 'sparrow', 'wren', 'crow', 'magpie', 'gull', 'goose']); }      // the birds, decoded ahead of the first that sings

      // ---- bells: every stroke of the hour that falls in this tick's stretch of the shared clock, from every tower in
      // earshot (_amb_logic hourStrokes: stateless — nobody misses the hour by joining late or by a slow frame). A clock
      // pinned with ?time= does not pass the hours: no bells then.
      if (heard && alt < 60 && (game.time.pinned === null || game.time.pinned === undefined)) hourStrokes(a0, a1, wp.x, wp.z, onStroke);
      lastHour = h;
      // a band at practice (or ringing for Sunday service): plain hunt on the shared clock, heard from the tower
      const rt = heard && alt < 5 ? ringing(dayOf(game.time), h) : null;
      if (rt) {
        const tw = TOWERS[rt] || TOWERS_FAR[rt], p = locate(tw.p[0], tw.p[1], 30, 200, 1300, 0);
        p.gain = bellLevel(p.d) * carried(tw.p[0], tw.p[1]);
        if (p.gain > 0.03) {
          const bells = rt === 'magdalen' || rt === 'mary' ? 8 : 6, SL = 0.235, pair = 2 * bells + 1, now = game.time.now() / 1000, tenor = tw.hz * (bells === 8 ? 0.75 : 1);
          for (let s = Math.max(Math.ceil((now + 0.08) / SL), ringT); s * SL < now + 0.08 + win; s++) {
            ringT = s + 1; const pos = ((s % pair) + pair) % pair; if (pos === 2 * bells) continue;                                   // the handstroke gap
            const row = 2 * Math.floor(s / pair) + (pos >= bells ? 1 : 0), b = changeRow(row, bells, ROW)[pos % bells];
            if (synth.live < 26) { const dg = 0.45 * bellLevel(p.d) * 1.6, dp = p.pan; synth.to('bells', 0, () => synth.ding(t + (s * SL - now), tenor * SCALE[bells - 1 - b], dg, dp), frame(tw.p[0], 30, tw.p[1])); }
          }
        }
      }
      // a train on the line (the station's own sounds cover the platforms): heard from Jericho, Osney, the meadow
      if (TR && STN && heard && alt < 5) {
        const ms = game.time.now();
        for (let k = 0; k < 2; k++) {
          const s = TR.trainAt(k, ms), key = s.n + s.phase; if (key === trainKey[k]) continue;
          const first = trainKey[k] === ''; trainKey[k] = key;
          if (first || (s.phase !== 'in' && s.phase !== 'out') || ((s.n * 2 + k) % 3) === 1) continue;                               // (not every service is heard)
          const stp = STN.toST(lx, lz), q = STN.L(Math.max(-900, Math.min(-140, stp[0])), 0), p = locate(q[0], q[1], 0, 140, 950, 0);
          if (p.d > 230 && p.gain > 0.04 && synth.live < 28) { const tg = 1.6 * p.gain, tp = p.pan; synth.to('town', 0, () => synth.train(t + 0.5, tg, tp, s.phase === 'out' && (s.n % 2) === 0), frame(q[0], 1, q[1])); }
        }
      }

      // ---- cricket in the Parks (the fielders run on the shared clock: bat on ball 14.3 s into each 30 s ball)
      if (outdoors && h >= 11 && h < 18.5) {
        const p = audio.place(CRICKET[0], CRICKET[1], 230);
        if (p.gain > 0.002 && (!game.quality || game.quality.level !== 'low')) {
          const B = ballAt(game.time.now() / 1000, BA);
          if (!B.change) {
            const pg = p.gain, pp = p.pan;
            if (B.outcome !== 'leave' && B.tb <= BAT_T && B.tb + win > BAT_T) synth.to('town', 0, () => synth.bat(t + (BAT_T - B.tb), (0.25 + 0.75 * pg) * (B.outcome === 'defend' ? 0.5 : 1), pp));
            if (B.outcome === 'four' && B.tb <= CLAP_T && B.tb + win > CLAP_T) synth.to('town', 0, () => synth.applause(t + (CLAP_T - B.tb), 3.2, 0.3 + 0.7 * pg, pp, Math.random));
            else if (B.outcome === 'run' && (B.n & 3) === 0 && B.tb <= CLAP_T && B.tb + win > CLAP_T) synth.to('town', 0, () => synth.applause(t + (CLAP_T - B.tb), 1.6, (0.3 + 0.7 * pg) * 0.5, pp, Math.random));
          }
        }
      }

      // ---- what is underfoot
      if (outdoors) {
        const snow = Wx ? Wx.snow || 0 : 0;
        surface = snow > 0.3 ? 'snow' : env.green > 0.6 ? (env.trees > 0.5 && env.season > 0.12 && env.season < 0.95 && env.wet < 0.5 ? 'leaves' : 'grass') : env.wet > 0.45 ? 'wet' : 'stone';
      } else surface = STONE.has(place) || place.startsWith('shop_') ? 'stone' : CARPET.has(place) ? 'carpet' : 'wood';

      // nicked
      const pb = game.state && game.state.police ? game.state.police.busted || 0 : 0;
      if (busted !== null && pb > busted) synth.sting();
      busted = pb;
    }

    /**
     * The vehicles round about, ten times a second: the nearest and loudest six of the traffic and of the other
     * players' vehicles, each on its own voice at its own place (systems/_vehicle_audio.js TrafficSound; the rules
     * are _veh_logic.js). Parked vehicles make no sound; inside a room they are heard only as much as the street is.
     */
    function vehicles() {
      const T = game.traffic, pl = game.player, N = game.net;
      if (!traffic) { traffic = A.traffic = new TrafficSound(audio); }
      let list = T && T.list ? T.list : null;
      // other players' vehicles, from what is already sent (place, speed, type): heard like traffic
      if (N && N.others && N.others.size) {
        let k = 0; mixed.length = 0; if (list) for (let i = 0; i < list.length; i++) mixed.push(list[i]);
        for (const o of N.others.values()) { if (!o.veh || o.place !== 'world' || !o.seen) continue; let r = remote[k]; if (!r) r = remote[k] = { x: 0, y: 0, z: 0, speed: 0, kind: 'car', type: 'car', uid: 0, remote: true, sk: null, load: 0 }; k++;
          const bike = String(o.veh).startsWith('bike'); if (r.type !== o.veh) { r.type = o.veh; r.kind = bike ? 'bike' : 'car'; r.sk = null; } r.x = o.x; r.y = o.y; r.z = o.z; r.load = o.speed > r.speed + 0.05 ? 0.9 : 0.3; r.speed = o.speed || 0; r.uid = o.id; mixed.push(r); }
        list = mixed;
      }
      // in a closed vehicle (your own car; a bus you are riding) the others are heard through its windows; the bus you ride is heard from inside
      const pv = pl.vehicle, bus = game.busride && game.busride.riding ? game.busride.bus : null, closed = bus || (pv && (pv.kind === 'car' || pv.type === 'bus' || pv.type === 'taxi' || pv.type === 'van'));
      traffic.tick(VEH_T, list, lx, lz, pv || null, pl.place === 'world', R.out, alt, closed ? 0.55 : 1, bus);
    }

    // Sound switched off on an earlier visit (or by a slip of the finger: U and V sit beside the voice-chat key) stays
    // off, as the player left it — but never silently: a few seconds into the game, one line says what is off and
    // which key brings it back.
    let remindT = 4, reminded = false, bellsLv = 1;
    function remind() {
      reminded = true;
      const off = [];
      try {
        const Lv = audio.levels || {}, NM = { master: 'everything', voice: 'characters\u2019 voices', chat: 'friends\u2019 microphones', ambience: 'ambient sound', bells: 'bells', fx: 'vehicles and effects', venue: 'club and venue music' };
        for (const k in NM) if (Lv[k] === 0) off.push(NM[k] + ' at 0% (Esc: sound panel)');
        const v = game.voice; if (v && v.available !== false && v.enabled === false) off.push('characters\u2019 voices are off: speech shows in bubbles (Esc: sound panel)');
        if (audio.bedLevel > 0 && game.soundtrack && game.soundtrack.volume === 0) off.push('background music at 0% (Esc: sound panel)');
      } catch { /* */ }
      if (off.length && game.ui && game.ui.toast) { const s = off.join(' · '); game.ui.toast('Sound: ' + s, 8); }
      A.reminder = off;
    }
    return {
      update(dt) {
        if (!reminded && audio && audio.ctx && (remindT -= dt) <= 0) remind();
        if (!audio || !audio.ctx) return;
        if (!synth) { synth = A.synth = new AmbSynth(audio); }
        const cam = game.camera.position, pl = game.player;
        audio.listener(cam.x, cam.z, game.cameraYaw, cam.y);
        // the listener in the WORLD (in a walk-in room the camera is in the room's own frame)
        const I = game.interiors, cur = I && I.current, S = cur && cur.sl && pl.place === cur.id ? cur.sl : null, eye = game.eye;
        frameS = S; audio.framePlace = pl.place;
        if (S) { if (eye) { lx = eye.x; lz = eye.z; ly = eye.y; } else { const w = S.toWorld(cam.x, cam.z, L2); lx = w[0]; lz = w[1]; ly = cam.y; } lyaw = game.cameraYaw + (S.rot || 0); }
        else if (pl.place === 'world') { lx = cam.x; lz = cam.z; ly = cam.y; lyaw = game.cameraYaw; }
        else { const w = pl.worldPos || pl.pos; lx = w.x; lz = w.z; ly = (w.y || 0) + 1.6; lyaw = game.cameraYaw; }
        if (!(isFinite(lx) && isFinite(lz) && isFinite(ly) && isFinite(lyaw))) { if (audio._bad) audio._bad('the camera'); lx = isFinite(lx) ? lx : pl.pos.x || 0; lz = isFinite(lz) ? lz : pl.pos.z || 0; ly = isFinite(ly) ? ly : 1.6; lyaw = isFinite(lyaw) ? lyaw : 0; }      // (a camera with no numbers: carry on from the player, facing north — never silence)
        const v = game.voice;
        audio.duck(!!(v && ((v.active && v.active.length) || (v.live && v.live.speaking))));
        // footsteps (the Turtle has its own sticky floor)
        const sp = Math.abs(pl.speed || 0);
        if (sp > 0.6 && !pl.vehicle && !game.activity && pl.place !== 'purple_turtle' && synth.L) {
          stepT -= dt * sp;
          if (stepT <= 0) { stepT = sp > 4 ? 1.15 : 0.78; left = !left; synth.footstep(surface, Math.min(1, 0.45 + sp * 0.09), left); }
        } else stepT = Math.min(stepT, 0.2);
        // the slow pass runs on the audio clock (real time), so a low frame rate does not thin the ambience out
        const now = audio.ctx.currentTime, every = R.door ? NEAR_DOOR : WINDOW;
        if (now - lastSlow >= every) { win = lastSlow < 0 ? WINDOW : Math.min(2, now - lastSlow); lastSlow = now; try { slow(); } catch (e) { if (!A._err) { A._err = true; console.error('[ambience]', e); } } }
        if ((vehT -= dt) <= 0 && synth.L) { vehT = VEH_T; try { vehicles(); } catch (e) { if (!A._errV) { A._errV = true; console.error('[ambience] vehicles', e); } } }
      },
    };
  },
};
