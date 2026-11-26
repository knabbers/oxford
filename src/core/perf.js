// Performance probe: draw calls / triangles by owner and update() CPU ms per system.
//   game.perf.report({ split: true })  -> { total, main, shadow, owners: [{owner, calls, tris, shadowCalls}], cpu, chars }
//   game.perf.goto({x, z, h, hour, pitch, dist, warm})  teleport + pin hour + warm the simulation synchronously
//   game.perf.cpu(frames)  run game.update(1/60) `frames` times and return ms per system (mean / max)
// Owners: every object added to game.worldScene is tagged with userData.owner = the module that was installing or
// updating when it was added (see Game.worldScene.add patch in core/game.js). World meshes ('world:<layer>') are split
// by layer. Characters nested inside a module's group are reported as 'chars:<owner>'.
import { characterLod } from './characters.js';

export function installPerf(game) {
  const R = game.renderer;
  installFpsOverlay(game);
  // shadow maps shrunk while measuring: software GL spends most of its time filling a 2048² map; counts don't change
  const shadowLights = () => { const out = []; game.scene.traverse((o) => { if (o.isLight && o.castShadow && o.shadow) out.push(o); }); return out; };
  function shrinkShadows(on) {
    for (const l of shadowLights()) {
      if (on) { l.userData._ms = l.shadow.mapSize.x; l.shadow.mapSize.set(128, 128); }
      else if (l.userData._ms) { l.shadow.mapSize.set(l.userData._ms, l.userData._ms); delete l.userData._ms; }
      if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
    }
  }

  function bucketsFor(scene) {
    const map = new Map();
    const add = (k, o) => { let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(o); };
    for (const o of scene.children) {
      if (o.isLight) continue;
      let owner = o.userData.owner || 'core';
      const nm = o.name || '';
      if (o === game.player.character.group) owner = 'player';
      else if (nm.startsWith('world:')) owner = 'world:' + nm.slice(6);
      else if (owner === 'world') owner = 'world:' + (nm || o.type);
      add(owner, o);
      if (o.name !== 'character') o.traverse((c) => { if (c !== o && c.name === 'character') add('chars:' + owner, c); });
    }
    return map;
  }

  function render(withShadow) {
    const sm = R.shadowMap, au = sm.autoUpdate;
    if (!withShadow) { sm.autoUpdate = false; sm.needsUpdate = false; }
    // three resets info after the shadow pass; reset by hand so shadow draws are counted too
    R.info.autoReset = false; R.info.reset();
    R.render(game.scene, game.camera);
    R.info.autoReset = true; sm.autoUpdate = au;
    return { calls: R.info.render.calls, tris: R.info.render.triangles };
  }

  /** Draw-call / triangle breakdown of the current view. Renders the scene ~2x per owner bucket at a tiny size. */
  function report(opts = {}) {
    const pr = R.getPixelRatio();
    const cssW = innerWidth, cssH = innerHeight;
    // same aspect, few pixels: counts don't depend on resolution
    R.setPixelRatio(1); R.setSize(Math.max(16, Math.round(cssW / 10)), Math.max(10, Math.round(cssH / 10)), false);
    shrinkShadows(true);
    game.scene.updateMatrixWorld();
    const cull = opts.cull !== false && game.cull;
    if (cull) { cull.frame = 0; cull.before(game.camera); }
    const total = render(true), main = render(false);
    const out = { total: total.calls, tris: total.tris, main: main.calls, mainTris: main.tris, shadow: total.calls - main.calls, owners: [] };
    if (opts.split !== false) {
      const b = bucketsFor(game.scene);
      for (const [owner, objs] of b) {
        const vis = objs.map((o) => o.visible);
        if (!vis.some(Boolean)) continue;
        for (const o of objs) o.visible = false;
        const t = render(true), m = render(false);
        objs.forEach((o, i) => { o.visible = vis[i]; });
        const calls = total.calls - t.calls, tris = total.tris - t.tris, mc = main.calls - m.calls;
        if (calls || tris) out.owners.push({ owner, calls, tris, mainCalls: mc, shadowCalls: calls - mc, n: objs.length });
      }
      // nested characters were counted inside their module too: subtract them
      for (const r of out.owners) if (r.owner.startsWith('chars:')) {
        const parent = out.owners.find((q) => q.owner === r.owner.slice(6));
        if (parent) { parent.calls -= r.calls; parent.tris -= r.tris; parent.mainCalls -= r.mainCalls; parent.shadowCalls -= r.shadowCalls; }
      }
      out.owners.sort((a, b2) => b2.calls - a.calls);
    }
    // characters in view
    let chars = 0, charsVisible = 0, impostors = 0;
    game.scene.traverse((o) => { if (o.name === 'character') { chars++; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; } if (v) charsVisible++; if (o.userData.lod === 1) impostors++; } });
    out.chars = { total: chars, visible: charsVisible, impostors };
    if (cull) { out.cull = { ...cull.stats }; cull.after(); }
    R.setPixelRatio(pr); R.setSize(cssW, cssH, false);
    shrinkShadows(false);
    return out;
  }

  /** Run the whole update `frames` times synchronously at fixed dt; returns ms per system. */
  function cpu(frames = 120, dt = 1 / 60) {
    const acc = new Map();
    game._perfAcc = acc;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) game.update(dt);
    const wall = performance.now() - t0;
    game._perfAcc = null;
    const rows = [];
    for (const [id, a] of acc) rows.push({ id, mean: +(a.sum / frames).toFixed(3), max: +a.max.toFixed(2) });
    rows.sort((a, b) => b.mean - a.mean);
    return { frames, msPerFrame: +(wall / frames).toFixed(2), rows };
  }

  /** Teleport + pin the hour, then warm the simulation (spawns, LOD, culling) without rendering. */
  function goto(v) {
    if (v.hour !== undefined) game.time.pinned = v.hour;
    game.player.teleport(v.x, v.z, v.h ?? 0);
    game.cameraPitch = v.pitch ?? 0.25; game.cameraDist = v.dist ?? 8;
    const n = v.warm ?? 150;
    for (let i = 0; i < n; i++) game.update(1 / 30);
    return 'ok';
  }

  /** legacy(true): switch off the character LOD and the render-time cull (for before/after comparisons) */
  function legacy(on) { characterLod.enabled = !on; if (game.cull) game.cull.enabled = !on; return !on; }

  /**
   * Where does a frame go ON THIS MACHINE? Run in the browser console, standing still out of doors:
   *     copy(await game.perf.bench())        (about half a minute; the picture flickers; then paste the line anywhere)
   * Each line is the cost of a whole frame in ms, measured by drawing `n` frames back to back and waiting for the card
   * to finish them (a one-pixel read-back) — so the display's refresh rate does not round it, unlike an fps counter.
   * First the frame as it is, then the same frame with ONE thing changed (and put back): the difference is what that
   * thing costs here. `game.perf.bench({ quick: true, tier: 'ultra' })`: the frame and the main thread only, on that tier
   * whatever the game is on (a few seconds: for a busy street at midday). `cpu` = the main thread alone (game update / draw submission) with the card given almost no
   * pixels. Nothing is saved; the settings are as they were afterwards (a reload clears any doubt).
   */
  async function bench(opts = {}) {
    const n = opts.n || 24, gl = R.getContext(), px = new Uint8Array(4), W = game.world || {}, Q = game.quality, post = W.post;
    if (game.scene !== game.worldScene) return 'bench: stand out of doors first';
    // opts.tier ('ultra' ...): measured ON that tier, whatever the game is on; the game's own choice is put back after
    const was = Q ? { level: Q.level, rung: Q.rung } : null, forced = !!(Q && opts.tier && W.tiers && W.tiers[opts.tier] && (Q.level !== opts.tier || Q.rung !== 0));
    if (forced) Q.set(opts.tier, { rung: 0 });
    const T = W.tiers && Q ? W.tiers[Q.level] : null;
    const sync = () => { R.setRenderTarget(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    const frame = () => {
      const c = game.cull;
      const drawWorld = (cam) => {
        if (c) c.before(cam);
        if (game.postRender && game.scene === game.worldScene) game.postRender(R, game.scene, cam);
        else { R.render(game.scene, cam); if (game.scene === game.worldScene) game.interiors.afterWorld(R, cam); }
        if (c) c.after();
      };
      if (!game.interiors.renderFrame(R, game.camera, drawWorld)) drawWorld(game.camera);
    };
    const nap = (ms) => new Promise((r) => setTimeout(r, ms));
    const time = async (settle = 12) => {
      for (let i = 0; i < settle; i++) frame();
      sync(); await nap(30);
      const a = [];
      for (let r = 0; r < 3; r++) { const t0 = performance.now(); for (let i = 0; i < n; i++) frame(); sync(); a.push((performance.now() - t0) / n); await nap(20); }
      a.sort((x, y) => x - y); return a[1];
    };
    // the game's own loop is held while we measure (core/game.js tick): our frames are the only frames
    game.hold = true; const smAuto = R.shadowMap.autoUpdate;
    const adaptive = Q ? Q.adaptive : false; if (Q) Q.adaptive = false;
    const out = [], row = (k, v) => out.push(k + ' ' + v.toFixed(1));
    // (a tier just switched to: its materials are compiled and linked over the next frames - wait until that is over)
    const settle = async () => { let calm = 0, last = -1; for (let i = 0; i < 400 && calm < 30; i++) { frame(); if (i % 4 === 3) await nap(16); const k = R.info.programs.length + (R.linkWait && R.linkWait.busy && R.linkWait.busy() ? 1e6 : 0); if (k === last) calm++; else { calm = 0; last = k; } } sync(); };
    // the main thread alone: almost no pixels, so the card is never what is waited for
    const cpu = async (frames) => {
      size(0.12);
      for (let i = 0; i < 12; i++) frame(); sync();
      let tu = 0, tr = 0;
      for (let i = 0; i < frames; i++) { const a = performance.now(); game.update(1 / 60); const b = performance.now(); frame(); tr += performance.now() - b; tu += b - a; if (i % 6 === 5) { sync(); await nap(10); } }
      size(1);
      let people = 0; game.worldScene.traverseVisible((o) => { if (o.name === 'character') people++; });
      out.push(`cpu on ${Q ? Q.level : '?'}: update ${(tu / frames).toFixed(1)} + draw ${(tr / frames).toFixed(1)} (${people} people shown)`);
    };
    const tier = (k, v) => { if (!T || !Q) return null; const o = T[k]; const rung = Q.rung; return [() => { T[k] = v; Q.set(Q.level, { rung }); }, () => { T[k] = o; Q.set(Q.level, { rung }); }]; };
    const pr = R.getPixelRatio(), size = (k) => { R.setPixelRatio(pr * k); if (game.resize) game.resize(); };
    let ix = null, basic = null;
    game.worldScene.traverse((o) => { if (!basic && o.material && o.material.isMeshBasicMaterial && !o.material.map && !o.material.transparent) basic = o.material; });
    const variants = {
      'half the pixels': [() => size(Math.SQRT1_2), () => size(1)],
      'a tenth of the pixels': [() => size(0.316), () => size(1)],
      'no anti-aliasing (4x -> 0)': post && post.enabled ? [() => post.retune({ samples: 0 }), () => post.retune({ samples: 4 })] : null,
      'anti-aliasing 4x -> 2x': post && post.enabled ? [() => post.retune({ samples: 2 }), () => post.retune({ samples: 4 })] : null,
      'sun shadow map not redrawn': [() => { R.shadowMap.autoUpdate = false; }, () => { R.shadowMap.autoUpdate = smAuto; }],
      'plain materials (no shading at all)': basic ? [() => { game.worldScene.overrideMaterial = basic; }, () => { game.worldScene.overrideMaterial = null; }] : null,
      'no scanned surface detail': T && T.surfaces ? tier('surfaces', undefined) : null,
      'no ambient occlusion': T && T.ssao ? tier('ssao', false) : null,
      'no reflections': T && T.refl ? tier('refl', false) : null,
      'no rooms through windows': [() => { ix = game.interiors.afterWorld; game.interiors.afterWorld = () => {}; }, () => { game.interiors.afterWorld = ix; }],
    };
    try {
      const info = R.info.render, gx = gl.getExtension('WEBGL_debug_renderer_info');
      if (forced) await settle();
      const base0 = await time(20);
      R.info.autoReset = false; R.info.reset(); frame(); R.info.autoReset = true;
      out.push(`${gx ? String(gl.getParameter(gx.UNMASKED_RENDERER_WEBGL)).replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 60) : '?'} | tier ${Q ? Q.level + ' rung ' + Q.rung + (forced ? ' (set for this run; the game was on ' + was.level + ' rung ' + was.rung + ')' : Q.auto ? ' (chosen by auto)' : Q.pinnedByUrl ? ' (?q=)' : ' (chosen with F3)') : '?'} | window ${innerWidth}x${innerHeight} dpr ${devicePixelRatio} | buffer ${gl.drawingBufferWidth}x${gl.drawingBufferHeight} | ${info.calls} calls ${Math.round(info.triangles / 1000)}k tris | at ${game.player.pos.x.toFixed(0)},${game.player.pos.z.toFixed(0)} hour ${(+game.time.hour).toFixed(1)}`);
      row('frame', base0);
      // opts.quick: the frame and the main thread only (a few seconds: for a busy street)
      for (const k in variants) {
        const v = variants[k]; if (!v || opts.quick) continue;
        try {
          v[0](); let t = await time(16);
          if (t < base0 * 0.25) { const t2 = await time(30); out.push(`${k} ${t2.toFixed(1)}${t2 < base0 * 0.25 ? ' (?? nothing seems to have been drawn)' : ' (first try ' + t.toFixed(1) + ')'}`); } else row(k, t);
        } catch (e) { out.push(k + ' failed'); } finally { try { v[1](); } catch (e) { /* */ } }
        await time(8);
      }
      row('frame again', await time(12));
      await cpu(opts.quick ? 120 : 60);
    } finally {
      R.setPixelRatio(pr); if (game.resize) game.resize();
      R.shadowMap.autoUpdate = smAuto; game.worldScene.overrideMaterial = null; if (ix) game.interiors.afterWorld = ix;
      if (forced) { try { Q.set(was.level, { rung: was.rung }); } catch (e) { /* */ } }
      if (Q) Q.adaptive = adaptive;
      game.hold = false;
    }
    const s = out.join('\n'); console.log(s); return s;
  }

  game.perf = { report, cpu, goto, legacy, bench, buckets: () => [...bucketsFor(game.scene).keys()] };
  return game.perf;
}

// F2: on-screen frame-rate readout measured on the real display (average fps, slowest frame of the last second,
// draw calls / triangles of the last frame, quality tier, GPU). `?fps` in the URL shows it from the start.
function installFpsOverlay(game) {
  if (typeof document === 'undefined') return;
  let el = null, on = false, raf = 0, last = 0, acc = 0, n = 0, worst = 0, gpu = '';
  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    if (last) { const d = t - last; acc += d; n++; if (d > worst) worst = d; }
    last = t;
    if (acc >= 1000) {
      const info = game.renderer.info.render, q = game.quality, tier = q && ((q.tier && q.tier.name) || q.name) || '?';
      el.textContent = `${Math.round((n * 1000) / acc)} fps · slowest ${worst.toFixed(0)} ms · ${info.calls} calls · ${Math.round(info.triangles / 1000)}k tris · ${tier}${q && q.rungs ? ' rung ' + q.rung + '/' + (q.rungs - 1) + ' dist ' + q.dist.toFixed(2) : ''} · ${innerWidth}×${innerHeight}@${game.renderer.getPixelRatio().toFixed(2)} · ${gpu}`;
      acc = 0; n = 0; worst = 0;
    }
  };
  const toggle = () => {
    on = !on;
    if (!el) {
      el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:20;font:12px/1.4 "Courier New",monospace;background:rgba(0,0,0,.65);color:#9f9;padding:4px 8px;border-radius:4px;pointer-events:none';
      document.body.appendChild(el);
      try { const gl = game.renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); gpu = x ? String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)).slice(0, 70) : ''; } catch { /* ignore */ }
    }
    el.style.display = on ? 'block' : 'none';
    el.textContent = 'measuring…';
    cancelAnimationFrame(raf); last = 0; acc = 0; n = 0; worst = 0;
    if (on) raf = requestAnimationFrame(tick);
  };
  addEventListener('keydown', (e) => { if (e.code === 'F2' && !e.repeat) { e.preventDefault(); toggle(); } });
  try { if (new URLSearchParams(location.search).has('fps')) toggle(); } catch { /* ignore */ }
}
