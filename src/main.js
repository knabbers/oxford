// Boot: load map -> place preMap hooks -> build world -> install systems + places -> wait for Play.
import { Game, safeDt } from './core/game.js';
import { buildMapCollision } from './core/mapcollision.js';
import { randomLook, characterSpeech } from './core/characters.js';
import { installVoice } from './core/voice.js';
import { PEOPLE, FRIEND_IDS, lookFor } from './places/_people.js';
import { installPerf } from './core/perf.js';
import { RenderCull } from './core/cull.js';
import { setupMultiplayer } from './core/mp_ui.js';
import { installVoiceChat } from './core/voicechat.js';
import { createAssets } from './core/assets.js';

const $ = (id) => document.getElementById(id);
const STATIC = !!document.querySelector('meta[name="gto-static"]');
// ?fast=1 — FOR THE TOOLS ONLY (never linked from the game, never the default): a screenshot of one place does not need
// the sounds, nor the loading screen's warm-ups. Skipped: the download of the sounds (as ?assets=0; voice clips and
// music are then simply absent), the voice manifest, and the pre-drawing of the street outside the start room (that
// work then happens in the first frames outside instead). Everything that is DRAWN is built exactly as in a normal
// load — the modules' loading-screen warm-ups still run: the light map's is part of the picture.
const FAST = /[?&]fast=1/.test(location.search);   // set by tools/build_static.mjs
// game.bootLog: [what, ms since navigation start] at each stage of the loading screen (tools read it: where the load goes)
const BOOT = (window.__bootLog = []), mark = (what) => { BOOT.push([what, Math.round(performance.now())]); };
const msg = (t) => { $('loadmsg').textContent = t; if (t) mark(t); };
// The loading bar. The stages of the load are long stretches of work with no pause in which the page could be redrawn
// (building the city is one of them), so the bar is moved by the browser's compositor, which keeps going meanwhile: at
// the start of each stage it is put where that stage really starts and sent gliding to where it should end, over the
// time the stage took on THIS device last visit (localStorage 'gto-boot-ms'; typical figures the first time). A stage
// that takes longer than that waits at its end; one that is quicker jumps on. The name of the stage is the message
// above it.
const STAGES = ['modules', 'world', 'installs', 'start', 'streets'], STAGE_MS = [2500, 30000, 19000, 1500, 19000];
const loadBar = (() => {
  let ms = STAGE_MS.slice();
  try { const sv = JSON.parse(localStorage.getItem('gto-boot-ms') || 'null'); if (Array.isArray(sv) && sv.length === ms.length && sv.every((v) => v > 0 && v < 6e5)) ms = sv; } catch { /* first visit, or storage blocked */ }
  const total = ms.reduce((a, b) => a + b, 0), at = (i) => ms.slice(0, i).reduce((a, b) => a + b, 0) / total;
  let fill = null, t0 = 0, cur = -1; const took = [];
  return {
    /** stage i begins (i = STAGES.length: all done) */
    stage(i) {
      const now = performance.now();
      if (cur >= 0) took[cur] = Math.round(now - t0);
      cur = i; t0 = now;
      try {
        if (!fill) {
          const host = $('loadmsg'); if (!host) return;
          const track = document.createElement('div'); track.id = 'loadbar';
          track.style.cssText = 'margin:8px auto 0;width:min(320px,70%);height:4px;border-radius:2px;background:rgba(255,255,255,.18);overflow:hidden';
          fill = document.createElement('div'); fill.style.cssText = 'width:100%;height:100%;background:currentColor;opacity:.85;transform-origin:0 50%;transform:scaleX(0);will-change:transform';
          track.appendChild(fill); host.insertAdjacentElement('afterend', track);
        }
        fill.style.transition = 'none'; fill.style.transform = `scaleX(${at(Math.min(i, ms.length)).toFixed(4)})`;
        if (i >= ms.length) { fill.parentNode.style.display = 'none'; try { if (took.length === ms.length && took.every((v) => v > 0)) localStorage.setItem('gto-boot-ms', JSON.stringify(took)); } catch { /* */ } return; }
        void fill.offsetWidth;      // (the jump is taken before the glide is set)
        fill.style.transition = `transform ${Math.round(ms[i])}ms linear`; fill.style.transform = `scaleX(${(at(i + 1) - 0.004).toFixed(4)})`;
      } catch { /* a page without the loading screen's elements */ }
    },
  };
})();

async function loadModules(dir, names) {
  // (all fetched at once, kept in the listed order: one after another was a round trip per module and per layer of
  //  its imports before the next could start — on a first load, with nothing cached, most of the "Loading modules" time)
  const got = await Promise.all(names.map((n) => import(`./${dir}/${n}`).then((m) => m.default, (e) => { console.error(`[${dir}/${n}] failed to load`, e); return null; })));
  const out = [];
  names.forEach((n, i) => { if (got[i]) out.push({ file: n, ...got[i] }); });
  return out;
}

async function boot() {
  mark('boot'); loadBar.stage(0);
  const game = (window.game = new Game($('view')));
  game.bootLog = BOOT;
  // everyone's speech is heard (pre-rendered clips, docs/VOICES.md); a bubble shows only when a line can't be (V off,
  // audio not started or blocked, no clip). The people with voices of their own are known by their look's seed.
  installVoice(game, FAST ? { loadManifest: false, manifest: {} } : {});
  { const seeds = {}; for (const [id, P] of Object.entries(PEOPLE)) if (P.look && P.look.seed) seeds[P.look.seed >>> 0] = id; seeds[randomLook(8101).seed >>> 0] = 'porter'; /* Worcester's porter (worcester.js / _interiors look 8101) */ characterSpeech.hook = game.voice.characterHook(seeds); }
  // Every sound the game can ever play — voice clips (packed), music, ambient sound — is downloaded NOW, on the loading
  // screen, and kept on the device for the next visit (core/assets.js). ONE figure is shown for everything that is
  // downloaded before Play — code, the map, textures and the sounds together: "Loading 143 of 203 MB" (the sounds' size
  // is known from their manifest; the rest is counted as the browser reports each file, against what it came to on
  // the last visit here — a typical figure the first time — and exactly once it is all in). Play is
  // not offered until it is all here; from then on nothing is fetched (a fetch for a sound that was not preloaded is
  // refused, not sent). ?assets=0: the old fetch-as-needed behaviour (tools).
  const assets = (game.assets = createAssets());
  const bar = document.createElement('div'); bar.id = 'loadbytes'; bar.style.cssText = 'margin-top:6px;font-size:13px;opacity:.85;font-variant-numeric:tabular-nums;min-height:1.2em';
  $('loadmsg').insertAdjacentElement('afterend', bar);
  const mb = (b) => (b / 1e6).toFixed(1);
  const NO_SOUNDS = FAST || /[?&]assets=0/.test(location.search);
  let restBytes = 0, restDone = false, restEst = 17e6;      // the rest = every file but the sounds (code, map, textures)
  try { const v = +localStorage.getItem('gto-boot-bytes'); if (v > 1e6 && v < 2e9) restEst = v; } catch { /* first visit, or storage blocked */ }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name.indexOf('/audio/') < 0) restBytes += e.decodedBodySize || e.encodedBodySize || 0; }).observe({ type: 'resource', buffered: true }); } catch { /* an old browser: the sounds alone are counted */ }
  const showBytes = () => {
    if (!NO_SOUNDS && !assets.total && !assets.missing && !assets.ready) { bar.textContent = ''; return; }      // (the sounds' size is not known yet: a moment)
    const total = assets.total + (restDone ? restBytes : Math.max(restBytes, restEst)), done = assets.done + restBytes;
    bar.textContent = done < total ? `Loading ${Math.min(Math.round(done / 1e6), Math.round(total / 1e6))} of ${Math.round(total / 1e6)} MB` : '';
  };
  const bytesTimer = setInterval(showBytes, 250);
  const assetsP = NO_SOUNDS ? Promise.resolve(assets) : assets.preload(showBytes).then((A) => {
    if (A.ready) { game.voice.packs = A.voice; game.voice.noFetch = !!A.voice; A.installFetch(); mark('sounds ready ' + mb(A.fromNet) + ' MB downloaded, ' + mb(A.fromCache) + ' MB from the device'); }
    return A;
  }).catch((e) => { console.error('[assets]', e); return assets; });
  $('name').value = localStorage.getItem('gto-name') || '';
  setupPlayAs(game);

  msg('Fetching the map of Oxford…');
  const [map, mods, time] = await Promise.all([
    // relative URLs: the same files work from the Node server and from a static subpath (GitHub Pages, see docs/HOSTING.md)
    fetch('data/map.json').then((r) => r.json()),
    fetch(STATIC ? 'modules.json' : 'api/modules').then((r) => r.json()).catch(() => fetch('modules.json').then((r) => r.json())),
    STATIC ? null : fetch('api/time').then((r) => r.json()).catch(() => null),
  ]);
  // ?crop=x,z,r | <spot> | <place id> — FOR THE TOOLS ONLY: build that part of the city and nothing else (core/_crop.js,
  // docs/ARCHITECTURE.md "Cropping for tests"). Honoured on localhost alone, never in the static build (whose copy of
  // the game does not even contain core/_crop.js): anywhere else the switch is ignored and the whole city is built.
  let crop = null;
  { const spec = new URLSearchParams(location.search).get('crop');
    if (spec && !STATIC && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      try { const [C, sites] = await Promise.all([import('./core/_crop.js'), import('./core/_crop_sites.js')]); crop = C.parseCrop(spec, sites); if (crop && !C.cropAllowed(crop)) { console.error('[crop] ' + C.HILL_MESSAGE(crop) + ': the whole city is built'); crop = null; }
        else if (crop) { C.applyCrop(map, mods, crop, sites); console.info(C.cropSummary(crop)); mark('crop ' + crop.spec); document.title = 'CROP ' + (crop.plain ? 'PLAIN ' : '') + crop.spec + ' — ' + document.title; } else console.error('[crop] cannot read ?crop=' + spec + ' (x,z,r | ' + Object.keys(C.SPOTS).join(' | ') + ' | a place id): the whole city is built'); }
      catch (e) { console.error('[crop]', e); crop = null; }
    } else if (spec) console.warn('[crop] ignored: ?crop= is a tool for localhost only');
  }
  game.map = map; game.crop = crop;
  if (time) game.time.sync(time.now);

  msg('Loading modules…');
  const [systems, places, worldMod] = await Promise.all([loadModules('systems', mods.systems), loadModules('places', mods.places), import('./world/index.js')]);
  mark('modules loaded');
  // (cropped: a place that declares its own `site` outside the crop stands down here, before its preMap)
  if (crop) { const C = await import('./core/_crop.js'); for (let i = places.length - 1; i >= 0; i--) if (!C.cropKeepsModule(places[i], crop)) { crop.dropped.push(places[i].file); places.splice(i, 1); } }
  const all = [...systems, ...places];
  for (const m of all) { const t0 = performance.now(); try { m.preMap && m.preMap(game); } catch (e) { console.error(`[${m.file}] preMap`, e); } const dt = performance.now() - t0; if (dt > 40) BOOT.push(['  preMap ' + m.file, Math.round(dt)]); }

  msg('Building Oxford…'); loadBar.stage(1);
  await new Promise((r) => setTimeout(r, 30));
  buildMapCollision(game.worldCollider, map, game.overrides);
  const { buildWorld } = worldMod;
  game._owner = 'world';
  game.world = await buildWorld(game, map);
  if (game.world && typeof game.world.update === 'function') { const wu = game.world.update; game.world.update = (dt) => wu.call(game.world, safeDt(dt)); }
  game._owner = 'core';
  // memory pass: the city's merged tiles let their arrays go as each reaches the card (world/_geo_free.js; ?geofree=0)
  try { const GF = await import('./world/_geo_free.js'); GF.freeWorldTiles(game.worldScene); let t = 0, clock = 0; game.addSystem({ id: 'geofree', update(dt) { clock += dt; if ((t += dt) < 5) return; t = 0; GF.settleSweep(!game.deoverlap || !!game.deoverlap.done, clock); } }); } catch (e) { console.warn('[geofree]', e); }
  mark('world built');
  game.ui.buildMap(map);

  msg('Opening colleges and pubs…'); loadBar.stage(2);
  await new Promise((r) => setTimeout(r, 30));
  for (const m of all) {
    game._owner = m.id || m.file;
    const t0 = performance.now();
    try { const s = m.install && (await m.install(game)); if (s && s.update) game.addSystem(Object.assign(s, { id: s.id || m.id || m.file })); }
    catch (e) { console.error(`[${m.file}] install`, e); }
    const dt = performance.now() - t0; if (dt > 40) BOOT.push(['  install ' + m.file, Math.round(dt)]);
  }
  mark('modules installed'); loadBar.stage(3);
  game._owner = 'core';
  game.cull = new RenderCull(game, new Set(places.map((m) => m.id || m.file)));
  installPerf(game);

  if (crop) game.player.pos.set(crop.x, 0, crop.z);      // (a cropped city starts at its centre, out of doors, unless ?spawn=pidge and the room is there)
  game.player.teleport(game.player.pos.x, game.player.pos.z, game.player.heading);
  // Start position: inside the pigeonhole room in Worcester's Pump Quad (places/worcester_interiors.js sets
  // game.startSpot), entered now, before the first frame, so the start screen and the first frame after Play are both
  // the room. ?spawn=street keeps the old outdoor start on Walton Street (the tools that teleport about use it).
  const QS = new URLSearchParams(location.search);
  // z-fighting: once everything outdoors is built, sink the larger of any two coplanar overlapping surfaces in each
  // place module's static objects (core/_deoverlap.js; rooms get the same pass when they are built). Spread over the
  // first seconds of play in idle-time slices of <= 3 ms, so it adds nothing to the loading screen or to any frame.
  // (City walls: the facade shader.)
  try { const { deoverlapWorldLater } = await import('./core/_deoverlap.js'); game.deoverlap = deoverlapWorldLater(game.worldScene); } catch (e) { console.warn('[deoverlap]', e); }
  game.startedIn = 'street';
  if (QS.get('spawn') !== 'street' && game.startSpot && (!crop || QS.get('spawn') === 'pidge')) {
    try { if (game.startSpot.enter()) game.startedIn = game.startSpot.id; } catch (e) { console.error('[start] could not start in', game.startSpot.id, e); }
  }
  mark('start spot entered'); loadBar.stage(4); msg('Lighting the streets…');
  game.interiors.lazyWarm = true;      // (rooms warmed on the loading screen: their module's build now, the rest spread over frames — core/interiors.js warm)
  game.start();
  // smoothness: the street outside the start room's door is drawn once out of sight before Play is offered, and every
  // door's fade waits for the new place to draw smoothly (world/prewarm.js)
  try { const { installPrewarm } = await import('./world/prewarm.js'); const pw = installPrewarm(game); if (game.startedIn !== 'street' && !FAST) { msg('Lighting the streets…'); await pw.room(game.startedIn); } } catch (e) { console.warn('[prewarm]', e); }
  mark('prewarm done');
  // (the world is ready; the sounds may still be coming down a slow line: the bar above says how far they are)
  restDone = true; mark('downloaded besides the sounds: ' + mb(restBytes) + ' MB'); try { if (restBytes > 1e6) localStorage.setItem('gto-boot-bytes', String(restBytes)); } catch { /* */ }
  showBytes();
  if (!assets.ready && !assets.missing) msg('Downloading…');
  await assetsP;
  clearInterval(bytesTimer); bar.textContent = '';
  if (assets.ready) assets.seal();
  mark('loading done'); loadBar.stage(STAGES.length);
  // from here on no frame waits for a shader program to be made (core/_lazylink.js; while loading they are made flat out)
  // (?fast=1, the tools: left off — everything is drawn in the first frame it is asked for, so a screenshot is whole)
  // (and on the top tier a program's first use no longer fetches its info logs — each a 80–130 ms wait for the GPU
  //  process out of doors; a failed link is still reported: core/_lazylink.js. ?lllog=1: as before)
  { const LL = game.renderer.linkWait; if (LL && !LL.never && !FAST) { LL.on = true; LL.blocked = 0; LL.blockedMs = 0; LL.names.length = 0; LL.nolog = () => !!game.quality && game.quality.level === 'ultra'; if (LL.nolog() && LL.adoptAll) { const r = LL.adoptAll(); mark('programs taken into use: ' + r.n + ' in ' + r.ms + ' ms'); } } }
  msg('');
  const btn = $('play');
  btn.disabled = false; btn.textContent = 'Matriculate';
  if (!document.activeElement || document.activeElement === document.body) btn.focus();   // Enter starts; Shift+Tab back to the picker
  const go = () => {
    const name = ($('name').value.trim() || 'Fresher').slice(0, 24);
    localStorage.setItem('gto-name', name);
    game.player.name = name;
    $('start').style.display = 'none';
    game.audio.start();
    game.input.lock();
    if (crop) game.net.transport = null;      // a cropped city is played alone: it is not the city the other players have
    game.net.connect(name, game.player.look);
    if (game.startSpot && game.startedIn === game.startSpot.id) { try { game.startSpot.play && game.startSpot.play(); } catch (e) { console.error('[start]', e); } }
  };
  btn.onclick = go;
  // (cropped: say so once when the player walks off the built part — the ground goes on, bare, to the map's edge)
  if (crop) { let out = false; game.addSystem({ id: 'crop-edge', update() { const p = game.player, o = p.place === 'world' && Math.hypot(p.pos.x - crop.x, p.pos.z - crop.z) > crop.r + crop.margin; if (o && !out) game.ui.toast('Edge of the cropped test city (?crop=' + crop.spec + '): nothing is built beyond here', 6); out = o; } }); }
  installVoiceChat(game);      // proximity voice chat between players (Y; off until asked for)
  setupMultiplayer(game, { serverMode: !!time, go });   // P2P rooms when static / ?p2p / ?room=; may replace btn.onclick
  $('name').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !btn.disabled) go(); });
  if (QS.has('autostart')) go();
}

// "Play as": the user's friends (first names) or someone random. Default Matt; the choice is remembered.
function setupPlayAs(game) {
  const box = $('playas');
  if (!box) return;
  let saved = null;
  try { saved = localStorage.getItem('gto-as'); } catch { /* storage blocked */ }
  let cur = saved === 'random' || FRIEND_IDS.includes(saved) ? saved : 'matt';
  const friendNames = new Set(FRIEND_IDS.map((id) => PEOPLE[id].name));
  const choose = (id) => {
    cur = id;
    try { localStorage.setItem('gto-as', id); } catch { /* storage blocked */ }
    game.player.setLook(id === 'random' ? randomLook() : lookFor(id));
    const nm = $('name'), v = nm.value.trim();
    if (id !== 'random' && (!v || friendNames.has(v))) nm.value = PEOPLE[id].name;
    else if (id === 'random' && friendNames.has(v)) nm.value = '';
    for (const b of box.querySelectorAll('button')) { const on = b.dataset.id === id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; }
  };
  // keyboard: Tab into the group, arrows move the choice, Enter/Space picks, Tab on to the name and Play
  box.addEventListener('keydown', (e) => {
    const btns = [...box.querySelectorAll('button')], i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % btns.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
    else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = btns.length - 1;
    if (j < 0) return;
    e.preventDefault(); e.stopPropagation();
    choose(btns[j].dataset.id); btns[j].focus();
  });
  for (const id of [...FRIEND_IDS, 'random']) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.id = id; b.setAttribute('role', 'radio');
    b.textContent = id === 'random' ? 'Someone else' : PEOPLE[id].name;
    b.onclick = () => choose(id);
    box.appendChild(b);
  }
  choose(cur);
}

boot().catch((e) => { console.error(e); msg('Failed to start: ' + e.message); });
