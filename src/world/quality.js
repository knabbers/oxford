// Adaptive graphics quality: game.quality = { level, auto, tier, dist, res, rung, set(level|'auto'), cycle() }.
//
// TIERS are ceilings. The level comes from ?q=low|medium|high|ultra (pinned: the controller is OFF and everything is
// deterministic, which is what the probes and smoke tests use) > a saved manual choice (localStorage 'gto-quality') > a
// guess from the GPU name. Below the ceiling a controller walks a ladder of "rungs" from the smoothed real frame time so
// the game holds at least ~30 fps, shedding the cheapest-to-lose things first and keeping the 60-80 m round the camera intact:
//   1. render pixel ratio from the tier cap down to 1.25 (0.1 steps)    5. shadow map 2048 -> 1024
//   2. the post chain's extras, dearest first: ambient occlusion off,     6. clouds off
//      sun shafts off, screen-space reflections off; then the whole       7. the light map (lamps, shop light, headlights) off
//      post chain (bloom / grade) off (tiers that have it)                8. pixel ratio 1.0 -> 0.7
//   3. distance scalar q.dist 1.0 -> 0.75 (0.05 steps)                    9. q.dist 0.75 -> 0.5
//   4. pixel ratio 1.25 -> 1.0
// URL switches for A/B shots (any tier): ?refl=0 (screen-space reflections), ?ssao=0, ?rays=0 (sun shafts), ?dynlight=0
// (the light map), ?fastmx=0 (core/_fastmatrix.js); shader pass 10: ?skylight=0 (sky-light map: ambient by place, sun
// bounce — world/_fx_skylight.js), ?glare=0 (wide halos in mist and rain), ?adapt=0 (eye adaptation) — world/_fx_post.js.
// Texture pass: ?surf=0 (the top tier's high-resolution surfaces: world/_surf_detail.js), ?sharp=<0..1> (output sharpening).
// Their rungs: sky light goes after the sun shafts; glare just before the post chain; adaptation goes with the chain.
// q.dist multiplies the detail distances (near/far city tiles, 3D-tree radius, furniture cull, shadow-caster radius,
// far cull) but never pulls a distance in below ~70 m. `q.tier` is always the EFFECTIVE tier (ceiling values with the
// rung applied) and is what world/index.js applies; q.dist / q.res are also exposed for other modules (character LOD).
// Thresholds: step down after 1 s of smoothed frame time > 36 ms (two rungs at once above 50 ms); step up one rung
// after `hold` s under 30 ms (hold starts at 6 s, doubles up to 60 s every time a step up has to be undone within
// 8 s, and relaxes again after 40 s of calm) — frame time is quantised by vsync, so head-room can only be found by
// trying. Never more than one change a second. Stuck on the bottom rung for 6 s -> drop a whole tier; 45 s on the top
// rung of a tier below the ceiling -> climb back. F3 (or Shift+Q) cycles auto -> low -> medium -> high -> ultra -> auto;
// a manual tier is a ceiling too. 'auto' starts at the GPU guess (never above 'high') and may climb to 'ultra'.
export const TIERS = {
  low: {
    name: 'low', pixelRatio: 1.0, shadowMap: 1024, shadowBox: 42, shadowDist: 110, treeNear: 30, treeFar: 600,
    farCull: 900, cityNear: 150, relief: [45, 85], furniture: 0.6, furnitureShadows: false, lampHeadFar: 500, clouds: false, aoStrips: false, fogBoost: 1.25, blobs: false, post: false, tufts: false,
    bump: 0, wet: false, refl: false, ssao: false, rays: false, dynLight: false, skyl: false, glare: false, adapt: false, contact: false, grassFx: false, waterFx: false, treeFx: false,
  },
  medium: {
    name: 'medium', pixelRatio: 1.25, shadowMap: 2048, shadowBox: 60, shadowDist: 200, treeNear: 45, treeFar: 780,
    farCull: 1100, cityNear: 200, relief: [50, 95], furniture: 0.85, furnitureShadows: false, lampHeadFar: 800, clouds: true, aoStrips: true, fogBoost: 1.0, blobs: true, post: false, tufts: false,
    bump: 0.016, wet: false, refl: false, ssao: false, rays: false, dynLight: true, skyl: false, glare: false, adapt: false, contact: false, grassFx: false, waterFx: false, treeFx: false,      // relief from the albedo (no extra texture fetch: derivatives of the colour already sampled, within 55 m)
  },
  high: {
    name: 'high', pixelRatio: 1.75, shadowMap: 2048, shadowBox: 75, shadowDist: 260, treeNear: 60, treeFar: 880,
    farCull: 1400, cityNear: 280, relief: [58, 110], furniture: 1.0, furnitureShadows: true, lampHeadFar: 1100, clouds: true, aoStrips: true, fogBoost: 1.0, blobs: true, post: true, tufts: true,
    bump: 0.02, wet: false, refl: true, ssao: true, rays: true, dynLight: true, skyl: false, glare: false, adapt: false, contact: false, grassFx: false, waterFx: false, treeFx: false,
  },
  // reached on 'auto' only by climbing from 'high': per-pixel extras (relief from the albedo, damp-road sheen at night) and longer detail distances
  ultra: {
    name: 'ultra', pixelRatio: 2.0, shadowMap: 2048, shadowBox: 80, shadowDist: 280, treeNear: 160, treeFar: 1300,
    farCull: 1500, cityNear: 340, relief: [70, 130], furniture: 1.15, furnitureShadows: true, lampHeadFar: 1200, clouds: true, aoStrips: true, fogBoost: 1.0, blobs: true, post: true, tufts: true,
    bump: 0.02, wet: true, refl: true, ssao: true, rays: true, dynLight: true, skyl: true, glare: true, adapt: true, contact: true, grassFx: true, waterFx: true, treeFx: true,
    surfaces: 'hi',   // texture pass: photo-scanned surface detail + output sharpening (world/_surf_detail.js, _surf_sharpen.js); `?surf=0` off
  },
};
const ORDER = ['low', 'medium', 'high', 'ultra'];
const AUTO_MAX = 3;      // index of the best tier 'auto' may use (ultra: reached by climbing, never by the GPU guess)
// Frame-time targets (s). 30 fps is the floor the user asked for (2026-11-21): nothing is shed while frames stay under
// SLOW, and detail is added back whenever they are under FAST.
const SLOW = 0.036, VERY_SLOW = 0.05, FAST = 0.030, TARGET = 0.0333;
const KEY = 'gto-quality';
const NEAR_KEEP = 70;    // q.dist never pulls a detail distance in below this (m)

/**
 * Starting tier from the GPU name. The baseline machine is a 2016 MacBook Pro with a discrete Radeon Pro 460, so any
 * discrete Radeon / GeForce / Arc, Apple silicon and recent Iris Xe class GPU starts on 'high'; software renderers, old
 * Intel HD/UHD integrated chips and phone GPUs start on 'low'; anything unrecognised starts on 'high' as well (the
 * governor steps down within seconds if frames are slow).
 */
export function guessFromGpu(renderer) {
  try {
    const gl = renderer.getContext && renderer.getContext();
    if (!gl) return 'medium';
    let name = '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    const caps = renderer.capabilities || {};
    if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return 'low';
    if (/apple m\d|apple gpu|rtx|gtx|geforce|quadro|radeon pro|radeon rx|radeon r[579]|radeon hd [5-9]\d{3}|radeon \(tm\) (pro|rx)|firepro|\barc\b|iris\(r\) xe|iris xe|iris plus|iris pro/i.test(name)) return 'high';
    if (/intel.*(hd|uhd) graphics [1-6]\d{2}\b|intel.*hd graphics( \d{4})?$|intel.*hd graphics [2-5]\d{3}|mali|adreno [1-5]|powervr/i.test(name)) return 'low';
    if ((caps.maxTextureSize || 0) < 8192) return 'low';
    if (/intel/i.test(name)) return 'medium';
    return 'high';
  } catch (e) { return 'medium'; }
}

/** The drawing buffer never exceeds about 1080p (1920x1080 pixels in total), whatever the window and screen: on a
 *  Retina display the frame rate is bound by pixel count. `?maxpx=<megapixels>` overrides (0 = no cap). */
export function capRatio(pr) {
  if (typeof innerWidth === 'undefined' || !innerWidth || !innerHeight) return pr;
  let mp = 1920 * 1080 / 1e6;
  try { const u = new URLSearchParams(location.search).get('maxpx'); if (u !== null && isFinite(+u)) mp = +u; } catch (e) { /* no location */ }
  if (!(mp > 0)) return pr;
  return Math.min(pr, Math.max(0.5, Math.sqrt(mp * 1e6 / (innerWidth * innerHeight))));
}

export function createQuality(game, apply) {
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const urlQ = params.get('q');
  const OFF = { refl: params.get('refl') === '0', ssao: params.get('ssao') === '0', rays: params.get('rays') === '0', dynLight: params.get('dynlight') === '0',
    skyl: params.get('skylight') === '0', glare: params.get('glare') === '0', adapt: params.get('adapt') === '0',
    contact: params.get('contact') === '0', grassFx: params.get('grassfx') === '0', waterFx: params.get('waterfx') === '0', treeFx: params.get('treefx') === '0' };
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
  const dpr = () => capRatio((typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
  const eff = { ...TIERS.medium };            // the effective tier: mutated in place, never reallocated
  const q = {
    level: 'medium', auto: true, pinnedByUrl: false, tier: eff, ceiling: 'high', guess: 'medium',
    dist: 1, res: 1, rung: 0, rungs: 0, adaptive: true,
    set(level, opts = {}) {
      if (level === 'auto') { q.auto = true; level = ORDER[Math.min(AUTO_MAX, ORDER.indexOf(q.guess))] || q.level; q.ceiling = ORDER[AUTO_MAX]; }   // start at the guess, free to climb to 'high'
      else if (opts.manual) { q.auto = false; q.ceiling = level; }
      if (!TIERS[level]) return q.level;
      q.level = level;
      ladder(TIERS[level]);
      ctl.rung = Math.min(opts.rung ?? 0, rungs.length - 1);
      push();
      if (opts.save) { try { localStorage.setItem(KEY, q.auto ? 'auto' : level); } catch (e) { /* */ } }
      if (opts.toast && game.ui && game.ui.toast) game.ui.toast(`Graphics: ${q.auto ? 'auto (' + level + ')' : level}`, 2.5);
      return level;
    },
    cycle() {
      // auto -> low -> medium -> high -> ultra -> auto
      ctl.reset();
      if (q.auto) return q.set('low', { manual: true, save: true, toast: true });
      const i = ORDER.indexOf(q.ceiling);
      if (i === ORDER.length - 1) return q.set('auto', { save: true, toast: true });
      return q.set(ORDER[i + 1], { manual: true, save: true, toast: true });
    },
    /** called once per world.update(); samples real frames only (perf hooks calling update() in a loop don't count) */
    tick() { ctl.tick(); },
    /** test hook: jump to a rung of the current tier's ladder (0 = full tier) */
    setRung(i) { ctl.rung = Math.max(0, Math.min(rungs.length - 1, i | 0)); push(); return ctl.rung; },
  };

  // ---- the ladder for a tier: rung 0 = the tier as written
  const rungs = [];
  function ladder(base) {
    rungs.length = 0;
    const s = { pr: Math.min(dpr(), base.pixelRatio), post: !!base.post, dist: 1, shadowMap: base.shadowMap, clouds: !!base.clouds,
      ssao: !!(base.post && base.ssao) && !OFF.ssao, rays: !!(base.post && base.rays) && !OFF.rays, refl: !!(base.post && base.refl) && !OFF.refl, dynLight: !!base.dynLight && !OFF.dynLight,
      skyl: !!(base.post && base.skyl) && !OFF.skyl, glare: !!(base.post && base.glare) && !OFF.glare, adapt: !!(base.post && base.adapt) && !OFF.adapt,
      contact: !!base.contact && !OFF.contact, grassFx: !!base.grassFx && !OFF.grassFx, waterFx: !!base.waterFx && !OFF.waterFx, treeFx: !!base.treeFx && !OFF.treeFx };
    const add = () => rungs.push({ ...s });
    add();
    while (s.pr > 1.251) { s.pr = Math.max(1.25, Math.round((s.pr - 0.1) * 100) / 100); add(); }
    if (s.ssao) { s.ssao = false; add(); }
    if (s.rays) { s.rays = false; add(); }
    if (s.skyl) { s.skyl = false; add(); }
    if (s.refl) { s.refl = false; add(); }
    if (s.glare) { s.glare = false; add(); }
    if (s.waterFx) { s.waterFx = false; add(); }
    if (s.grassFx) { s.grassFx = false; add(); }
    if (s.treeFx) { s.treeFx = false; add(); }
    if (s.post) { s.post = false; s.adapt = false; add(); }
    while (s.dist > 0.751) { s.dist = Math.round((s.dist - 0.05) * 100) / 100; add(); }
    while (s.pr > 1.001) { s.pr = Math.max(1, Math.round((s.pr - 0.1) * 100) / 100); add(); }
    if (s.shadowMap > 1024) { s.shadowMap = 1024; add(); }
    if (s.clouds) { s.clouds = false; add(); }
    if (s.dynLight) { s.dynLight = false; s.contact = false; add(); }
    while (s.pr > 0.701) { s.pr = Math.max(0.7, Math.round((s.pr - 0.1) * 100) / 100); add(); }
    while (s.dist > 0.501) { s.dist = Math.round((s.dist - 0.05) * 100) / 100; add(); }
    q.rungs = rungs.length;
  }
  const near = (v, d) => (v <= NEAR_KEEP ? v : Math.max(NEAR_KEEP, v * d));
  /** write the effective tier for the current rung and hand it to the world */
  function push() {
    const base = TIERS[q.level], r = rungs[ctl.rung], d = r.dist, soft = 0.5 + 0.5 * d;
    Object.assign(eff, base);
    eff.pixelRatio = r.pr; eff.post = r.post; eff.shadowMap = r.shadowMap; eff.clouds = r.clouds;
    eff.ssao = r.ssao; eff.rays = r.rays; eff.refl = r.refl; eff.dynLight = r.dynLight;
    eff.skyl = r.skyl; eff.glare = r.glare; eff.adapt = r.adapt; eff.contact = r.contact; eff.grassFx = r.grassFx; eff.waterFx = r.waterFx; eff.treeFx = r.treeFx;
    eff.cityNear = near(base.cityNear, d); eff.treeNear = near(base.treeNear, d); eff.shadowDist = near(base.shadowDist, d);
    eff.furniture = Math.max(Math.min(base.furniture, 0.5), base.furniture * d);
    eff.treeFar = base.treeFar * soft; eff.farCull = base.farCull * soft; eff.lampHeadFar = base.lampHeadFar * soft;
    if (d < 0.9) eff.tufts = false;
    eff.dist = d;
    q.dist = d; q.res = r.pr; q.rung = ctl.rung;
    try { apply(eff); } catch (e) { console.error('[quality] apply', e); }
  }

  // ---- controller: smoothed real frame time -> rung
  const ctl = {
    rung: 0, lastT: 0, lastFrame: -1, ft: 0.016, over: 0, ok: 0, since: 0, hold: 6, sinceUp: 1e9, calm: 0, stuck: 0, top: 0, bench: [], benchDone: false,
    reset() { this.over = 0; this.ok = 0; this.since = 0; this.stuck = 0; this.top = 0; this.ft = 0.016; },
    step(n) {
      const to = Math.max(0, Math.min(rungs.length - 1, this.rung + n));
      if (to === this.rung) return false;
      this.rung = to; this.since = 0; this.over = 0; this.ok = 0;
      push();
      return true;
    },
    tick() {
      const info = game.renderer && game.renderer.info && game.renderer.info.render;
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      const fr = info ? info.frame : -1;
      if (fr === this.lastFrame) return;              // no new rendered frame since last call
      const dt = (now - this.lastT) / 1000;
      this.lastFrame = fr; this.lastT = now;
      if (!(dt > 0) || dt > 0.25 || (typeof document !== 'undefined' && document.hidden)) return;  // stalls, tab switches
      if (!q.adaptive) return;
      if (game.scene !== game.worldScene) { this.outT = 0; return; }     // interiors are cheap and don't use these settings
      // (the first 1.5 s outdoors after a door or the start room are not sampled: frames still settling after the switch
      // — a first draw, streaming — said nothing about the steady cost, and the benchmark took them for it)
      this.outT = (this.outT || 0) + dt;
      if (this.outT < 1.5) return;
      // startup benchmark: median of ~90 frames after the first second -> jump straight to a plausible rung
      if (!this.benchDone) {
        if (game.elapsed > 1.5) this.bench.push(dt);
        if (this.bench.length >= 90) {
          this.benchDone = true;
          const b = this.bench.slice().sort((a, c) => a - c), med = b[b.length >> 1];
          if (med > SLOW) this.step(Math.round((med / TARGET - 1) * 6));
          this.ft = 0.016;
        }
        return;
      }
      this.ft += (dt - this.ft) * 0.08;
      this.since += dt; this.sinceUp += dt;
      if (this.since < 1) return;                     // at most one change a second (and let the change settle)
      const ft = this.ft, last = rungs.length - 1, ti = ORDER.indexOf(q.level);
      if (ft > SLOW) {
        this.over += dt; this.ok = 0; this.calm = 0; this.top = 0;
        if (this.over > 1) {
          if (this.sinceUp < 8) this.hold = Math.min(60, this.hold * 2);      // the last step up did not hold: wait longer next time
          if (this.rung < last) this.step(ft > VERY_SLOW ? 2 : 1);
          else {
            // bottom of this tier's ladder and still slow: fall to the tier below, entering it part-way down its ladder
            this.stuck += this.over; this.over = 0;
            if (this.stuck > 6 && ti > 0) { this.stuck = 0; q.level = ORDER[ti - 1]; ladder(TIERS[q.level]); this.rung = Math.min(rungs.length - 1, rungs.findIndex((r) => r.pr <= 1.001 && !r.post) + 2); this.since = 0; push(); if (game.ui && game.ui.toast) game.ui.toast('Graphics: ' + q.level, 2); }
          }
        }
      } else if (ft < FAST) {
        this.ok += dt; this.over = Math.max(0, this.over - dt); this.stuck = 0;
        this.calm += dt; if (this.calm > 40) { this.calm = 0; this.hold = Math.max(6, this.hold / 2); }
        if (this.rung > 0) { if (this.ok > this.hold) { this.step(-1); this.sinceUp = 0; } }
        else {
          this.top += dt;
          if (this.top > 45 && ti < ORDER.indexOf(q.ceiling)) { this.top = 0; q.level = ORDER[ti + 1]; ladder(TIERS[q.level]); this.rung = rungs.length >> 1; this.since = 0; this.sinceUp = 0; push(); }
        }
      } else { this.over = Math.max(0, this.over - dt * 0.5); this.ok = Math.max(0, this.ok - dt * 0.5); }
    },
  };

  // ---- initial level
  q.guess = guessFromGpu(game.renderer || {});
  if (TIERS[urlQ]) { q.auto = false; q.pinnedByUrl = true; q.adaptive = false; q.ceiling = urlQ; q.set(urlQ); }
  else if (saved && TIERS[saved]) { q.auto = false; q.ceiling = saved; q.set(saved); }
  else q.set('auto');

  if (game.input && game.input.onKey) {
    game.input.onKey((code, e) => {
      if (game.input.typing) return;
      if (code === 'F3' || (code === 'KeyQ' && e && e.shiftKey)) { if (e && e.preventDefault) e.preventDefault(); q.cycle(); }
    });
  }
  return q;
}
