// Aerial warm-up, last step: every material nobody has drawn yet is DRAWN once, a couple at a time, into a tiny target
// of the same format as the real pass, before it can turn up on screen. (gliding follow-up, 2026-11)
//
// Why compiling ahead (renderer.compileAsync + KHR_parallel_shader_compile) is not enough on a Mac: ANGLE's Metal
// backend links the program off the main thread, but Metal builds the GPU pipeline for it at its FIRST DRAW (the
// pipeline depends on the target's pixel formats, sample count, blend state and vertex layout), 50–500 ms for a big
// shader the first time it meets the driver. Measured on a Radeon Pro 460: programs compiled 5–14 s earlier still cost
// 80–500 ms each in getProgramInfoLog at first use, all of them stacked into the first aerial frame.
//
// So: draw them first, somewhere nobody sees, with the real material, the real vertex buffers (draw range cut to one
// primitive), the same object kind (mesh / instanced / line / points / sprite) and the same shadow flags, in a scene
// lit by lights of the same types (the same program), into a 4×4 target with the post pass target's format (or the
// canvas through a 1-pixel viewport when there is no post pass, inside the frame so it is cleared over). A cloned sun
// casts shadows so the shadow-depth variants are drawn too. Paced by a GPU fence: the next batch only once the GPU
// process has worked through the last one, so at most a couple of new pipelines land in any one frame. Vertex buffers
// that have never been drawn go up the same way (MeshBasicMaterial, no colour writes), a few MB a frame.
// Never runs unless something is queued (the aerial warm-up): ground frames are untouched.
//
// upload(list, {split}) — a geometry's buffers ONE AT A TIME (arrival-stutter pass, 2026-11). A whole tile is 3–11 MB
// and went up in the frame it was first drawn (or in one background batch): the copy is done by the GPU process, about
// 9 ms a MB, and showed as a 67–83 ms frame two or three frames later. three keeps a vertex buffer per BufferAttribute
// object, whichever geometry it is drawn through — so each attribute (and the index) is drawn once on its own, as the
// 'position' of a scratch geometry, at most SPLIT_BYTES a batch, a GPU fence apart; the real geometry then finds every
// buffer already there. (The scratch geometries are kept and reused, never disposed: disposing one would delete the
// buffer of the attribute it was lent.)
import * as THREE from 'three';

const NEW_PER_BATCH = 1;        // never-drawn materials drawn per batch (each may cost the driver 50–450 ms the first time)
const BYTES_PER_BATCH = 6e6;    // vertex / index bytes uploaded per batch
const BUDGET_MS = 4;            // CPU per frame
const SPLIT_BYTES = 2e6;        // split uploads: bytes per batch (one attribute at least)

export function createAirWarm({ game, scene, post, stat, burst = null }) {
  const R = () => game.renderer;
  const usable = () => { const r = R(); return !!(r && r.render && r.getContext && r.properties && r.getViewport); };
  const jobs = [];               // {items, i, resolve}
  const seen = new Map();        // draw key -> its item (state 'q' queued, 'd' done)
  const upSeen = new WeakSet();  // geometries already uploaded
  const partSeen = new WeakSet(), scratch = [];      // attributes sent on their own; the scratch meshes they are drawn through
  let fence = null, fenceAt = 0, waiting = [], wScene = null, wGroup = null, wCam = null, wRT = null, rtKey = '', mat0 = null;
  let lights = null, lightSig = '', lightT = 0;
  const st = { batches: 0, drawn: 0, skipped: 0, uploaded: 0, mb: 0, waits: 0, strays: 0, strayNames: [], parts: 0, partMb: 0, partMax: 0 };

  const props = (m) => R().properties.get(m);
  const drawnAlready = (m) => { const p = props(m); return !!(p && p.uniformsList); };
  const geoDrawn = (g) => !!(g._listeners && g._listeners.dispose && g._listeners.dispose.length);
  const kindOf = (o) => (o.isSkinnedMesh || o.isBatchedMesh ? null : o.isInstancedMesh ? 'I' : o.isPoints ? 'P' : o.isLineSegments ? 'S' : o.isLine ? 'L' : o.isSprite ? 'W' : o.isMesh ? 'M' : null);
  const layout = (g) => {
    let k = g.index ? 'i' + g.index.array.BYTES_PER_ELEMENT : '-';
    for (const n in g.attributes) { const a = g.attributes[n]; k += '|' + n + a.itemSize + (a.normalized ? 'n' : '') + (a.isInterleavedBufferAttribute ? 's' + a.data.stride + 'o' + a.offset : '') + (a.array ? a.array.constructor.name[0] + a.array.BYTES_PER_ELEMENT : ''); }
    return k;
  };
  const bytesOf = (g) => {
    let b = g.index ? g.index.array.byteLength : 0;
    for (const n in g.attributes) { const a = g.attributes[n]; b += a.isInterleavedBufferAttribute ? 0 : a.array ? a.array.byteLength : 0; }
    return b;
  };

  // the never-drawn (material × object kind × vertex layout) combinations under obj
  // fresh: a whole-scene pass on the loading screen — only (material × kind × layout) combinations that may never have
  // been drawn: a material never drawn, or an object whose geometry never was (three registers a 'dispose' listener on
  // a geometry the first time it draws it) — a drawn material on a new vertex layout or object kind is a new GPU
  // pipeline on Metal all the same. One object per combination; already-drawn shadow casters are not queued again.
  function drawItems(obj, out, first, fresh = false) {
    obj.traverse((o) => {
      const k = kindOf(o); if (!k) return;
      const g = o.geometry; if (!g || (!o.isSprite && !g.attributes.position)) return;
      if (g.morphAttributes && Object.keys(g.morphAttributes).length) return;      // (none in the aerial view; their textures are per geometry)
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m || m.visible === false) continue;
        const key = m.uuid + k + (o.castShadow ? 'c' : '') + (o.instanceColor ? 'ic' : '') + (o.customDepthMaterial ? 'cd' + o.customDepthMaterial.uuid : '') + (k === 'W' ? '' : layout(g));
        const was = seen.get(key);
        if (was) { if (first && was.state === 'q' && !was.moved) { was.moved = true; const it = { o: was.o, m, key, state: 'q' }; seen.set(key, it); out.push(it); } continue; }   // (queued behind others: brought forward)
        if (fresh ? drawnAlready(m) && geoDrawn(g) : drawnAlready(m) && !o.castShadow) { st.skipped++; if (!fresh) seen.set(key, { state: 'd' }); continue; }
        const it = { o, m, key, state: 'q' }; seen.set(key, it); out.push(it);
      }
    });
    return out;
  }
  function standIn(it) {
    const { o, m } = it;
    let s;
    if (o.isSprite) s = new THREE.Sprite(m);
    else if (o.isInstancedMesh) { s = new THREE.InstancedMesh(o.geometry, m, 1); s.instanceMatrix = o.instanceMatrix; s.instanceColor = o.instanceColor; s.count = 1; }
    else s = o.isPoints ? new THREE.Points(o.geometry, m) : o.isLineSegments ? new THREE.LineSegments(o.geometry, m) : o.isLine ? new THREE.Line(o.geometry, m) : new THREE.Mesh(o.geometry, m);
    s.castShadow = o.castShadow; s.receiveShadow = o.receiveShadow; s.frustumCulled = false;
    s.customDepthMaterial = o.customDepthMaterial; s.customDistanceMaterial = o.customDistanceMaterial;
    return s;
  }

  // lights of the same types / shadow flags as the real scene's (the light counts are part of every lit program)
  function syncLights(now) {
    if (lights && now - lightT < 5000) {
      let ok = true; for (const [l, v, c] of lights) if (l.visible !== v || l.castShadow !== c || !l.parent) { ok = false; break; }
      if (ok) return;
    }
    lightT = now;
    const L = []; scene.traverseVisible((o) => { if (o.isLight) L.push(o); });
    lights = L.map((l) => [l, l.visible, l.castShadow]);
    const sig = L.map((l) => l.type + (l.castShadow ? 's' : '') + (l.isSpotLight && l.map ? 'm' : '')).sort().join();
    if (sig === lightSig && wScene) return;
    lightSig = sig;
    if (wScene) for (const c of [...wScene.children]) if (c !== wGroup) { if (c.shadow && c.shadow.map) c.shadow.dispose(); wScene.remove(c); }
    if (!wScene) { wScene = new THREE.Scene(); wGroup = new THREE.Group(); wScene.add(wGroup); wCam = new THREE.PerspectiveCamera(60, 1, 0.1, 100); }
    for (const l of L) {
      const c = new l.constructor();
      c.castShadow = l.castShadow;
      if (l.isSpotLight && l.map) c.map = l.map;
      if (c.shadow && l.shadow) { c.shadow.mapSize.set(4, 4); }
      wScene.add(c);
      if (c.target) wScene.add(c.target);
    }
  }
  function target() {
    const t = post && post.target ? post.target() : null;
    if (!t) { if (wRT) { wRT.dispose(); wRT = null; rtKey = ''; } return null; }
    const k = [t.texture.type, t.texture.format, t.samples, t.depthBuffer, t.stencilBuffer, !!t.depthTexture].join();
    if (k !== rtKey) {
      if (wRT) wRT.dispose();
      wRT = new THREE.WebGLRenderTarget(4, 4, { type: t.texture.type, format: t.texture.format, samples: t.samples, depthBuffer: t.depthBuffer, stencilBuffer: t.stencilBuffer });
      rtKey = k;
    }
    return wRT;
  }
  function fenceDone() {
    if (!fence) return true;
    const gl = R().getContext();
    if (fence === 'frame') { if (game.frame !== fenceAt) { fence = null; return true; } return false; }
    let ok = false;
    try { ok = gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED; } catch { ok = true; }
    if (!ok && performance.now() - fenceAt > 3000) ok = true;            // (a lost context / a driver that never says)
    if (ok) { try { gl.deleteSync(fence); } catch { /* */ } fence = null; }
    return ok;
  }
  function setFence() {
    const gl = R().getContext();
    if (gl.fenceSync) { try { fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); fenceAt = performance.now(); return; } catch { /* */ } }
    fence = 'frame'; fenceAt = game.frame;
  }

  /** once per frame, before the main render (world.update) */
  function pump() {
    if (!jobs.length && !waiting.length) return;
    if (!usable()) { for (const j of jobs) j.resolve(); jobs.length = 0; for (const f of waiting) f(); waiting = []; return; }
    if (!fenceDone()) { st.waits++; return; }
    if (waiting.length) { const w = waiting; waiting = []; for (const f of w) f(); }
    if (!jobs.length) return;
    const t0 = performance.now(), r = R();
    syncLights(t0);
    wScene.fog = scene.fog; wScene.environment = scene.environment;
    let nNew = 0, bytes = 0, n = 0, nPart = 0;
    const done = [];
    while (jobs.length && performance.now() - t0 < BUDGET_MS) {
      const j = jobs[0];
      if (j.i >= j.items.length) { jobs.shift(); done.push(j.resolve); continue; }
      const it = j.items[j.i];
      if (it.part) {
        // one attribute (or the index) of a geometry, through a scratch geometry
        const b = it.part.array ? it.part.array.byteLength : 0;
        if (bytes && bytes + b > SPLIT_BYTES * (burst ? burst() : 1)) break;
        j.i++;
        if (partSeen.has(it.part) || it.part.count < 3 || (it.pos && it.pos.count < 3)) continue;
        partSeen.add(it.part); bytes += b;
        let s = scratch[nPart];
        // (a bounding sphere of its own: three would otherwise work one out from whatever it is lent — every vertex of a tile)
        if (!s) { s = scratch[nPart] = new THREE.Mesh(new THREE.BufferGeometry(), mat0); s.frustumCulled = false; s.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1); s.geometry.setDrawRange(0, 3); }
        nPart++;
        if (it.pos) { s.geometry.setAttribute('position', it.pos); s.geometry.setIndex(it.part); } else { s.geometry.setAttribute('position', it.part); s.geometry.setIndex(null); }
        wGroup.add(s); n++;
        st.parts++; st.partMb += b / 1e6;
        continue;
      }
      if (it.up) {
        const b = bytesOf(it.up);
        if (bytes && bytes + b > BYTES_PER_BATCH * (burst ? burst() : 1)) break;
        j.i++;
        if (upSeen.has(it.up)) continue;
        upSeen.add(it.up); bytes += b;
        const s = new THREE.Mesh(it.up, mat0); s.frustumCulled = false; wGroup.add(s); n++;
        st.uploaded++; st.mb += b / 1e6;
        continue;
      }
      if (it.moved) { j.i++; continue; }
      if (nNew >= (burst ? burst() : NEW_PER_BATCH)) break;
      j.i++; it.state = 'd';
      if (drawnAlready(it.m) && !it.o.castShadow) { st.skipped++; continue; }
      const p = props(it.m);
      if (!p || !p.currentProgram) { st.skipped++; continue; }         // (never compiled: would compile here, synchronously)
      wGroup.add(standIn(it)); nNew++; n++; st.drawn++;
    }
    if (n) {
      const prevT = r.getRenderTarget(), sm = r.shadowMap, nu = sm.needsUpdate, ac = r.autoClear, rt = target(), np = r.info.programs.length;
      const vp = rt ? null : r.getViewport(new THREE.Vector4());
      // draw ranges cut to one primitive (restored straight after: the same geometry objects are in the real scene)
      const ranges = [];
      for (const s of wGroup.children) {
        const g = s.geometry; if (!g || s.isSprite || scratch.includes(s) || ranges.some((x) => x[0] === g)) continue;
        ranges.push([g, g.drawRange.start, g.drawRange.count, g.instanceCount]);
        g.drawRange.start = 0; g.drawRange.count = s.isPoints ? 1 : s.isLine ? 2 : 3; if (g.isInstancedBufferGeometry) g.instanceCount = 1;
      }
      try {
        r.autoClear = false; sm.needsUpdate = true;
        r.setRenderTarget(rt);
        if (vp) r.setViewport(0, 0, 1, 1);
        r.render(wScene, wCam);
      } catch (e) { console.warn('[world] aerial warm draw', e); } finally {
        for (const [g, s0, c0, ic] of ranges) { g.drawRange.start = s0; g.drawRange.count = c0; if (g.isInstancedBufferGeometry) g.instanceCount = ic; }
        if (vp) r.setViewport(vp);
        r.setRenderTarget(prevT); r.autoClear = ac; sm.needsUpdate = nu;
        wGroup.clear();
        // (the scratch geometries let go of what they were lent)
        for (let k = 0; k < nPart; k++) { const g = scratch[k].geometry; g.deleteAttribute('position'); g.setIndex(null); }
      }
      if (nPart && bytes > st.partMax) st.partMax = bytes;
      // (a program made here = the warm scene's lights did not match the real scene's: it compiled synchronously)
      if (r.info.programs.length > np) { st.strays += r.info.programs.length - np; for (const p of r.info.programs.slice(np)) st.strayNames.push(p.name || p.cacheKey.slice(0, 24)); }
      setFence(); st.batches++;
    }
    if (done.length) waiting.push(...done);
    stat && stat(`warm draw ${n} (${nNew} new, ${(bytes / 1e6).toFixed(1)} MB)`, performance.now() - t0);
  }

  return {
    pump,
    get busy() { return jobs.length > 0 || waiting.length > 0; },
    get stats() { return { ...st, strayNames: st.strayNames.slice(0, 12), mb: Math.round(st.mb), queued: jobs.reduce((a, j) => a + j.items.length - j.i, 0) }; },
    /** draw every never-drawn material under obj once (after it is compiled) -> Promise. first: ahead of the queue (an object held back from view) */
    draw(obj, first = false, opts = null) {
      if (!usable() || !obj) return Promise.resolve();
      const items = drawItems(obj, [], first, !!(opts && opts.fresh));
      if (!items.length) return Promise.resolve();
      return new Promise((resolve) => { const j = { items, i: 0, resolve }; if (first) jobs.unshift(j); else jobs.push(j); });
    },
    /** does obj hold a (material × kind × layout) that has never been drawn and is not queued? (the same test as draw(obj, …, {fresh}), nothing queued) */
    fresh(obj) {
      if (!usable() || !obj) return false;
      let f = false;
      obj.traverse((o) => {
        if (f) return;
        const k = kindOf(o); if (!k) return;
        const g = o.geometry; if (!g || (!o.isSprite && !g.attributes.position)) return;
        if (g.morphAttributes && Object.keys(g.morphAttributes).length) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          if (!m || m.visible === false || (drawnAlready(m) && geoDrawn(g))) continue;
          const key = m.uuid + k + (o.castShadow ? 'c' : '') + (o.instanceColor ? 'ic' : '') + (o.customDepthMaterial ? 'cd' + o.customDepthMaterial.uuid : '') + (k === 'W' ? '' : layout(g));
          if (!seen.has(key)) { f = true; return; }
        }
      });
      return f;
    },
    /** drop everything queued (each job's promise resolves false; its undrawn items may be queued again later) */
    cancel() {
      for (const j of jobs) { for (let k = j.i; k < j.items.length; k++) { const it = j.items[k]; if (it.key && seen.get(it.key) === it) seen.delete(it.key); if (it.up) upSeen.delete(it.up); if (it.g) upSeen.delete(it.g); } j.resolve(false); }
      jobs.length = 0;
    },
    /** get these geometries' buffers onto the GPU (meshes or geometries) -> Promise */
    upload(list, opts = null) {
      if (!usable() || !list.length) return Promise.resolve();
      let items = list.map((g) => ({ up: g.isBufferGeometry ? g : g.geometry })).filter((x) => x.up && x.up.attributes && x.up.attributes.position && !upSeen.has(x.up));
      if (!items.length) return Promise.resolve();
      if (opts && opts.split) {
        // (the position first: the index is drawn against it)
        const parts = [];
        for (const { up: g } of items) {
          upSeen.add(g);
          const pos = g.attributes.position; if (pos.isInterleavedBufferAttribute) { upSeen.delete(g); parts.push({ up: g }); continue; }
          parts.push({ part: pos, g });
          for (const n in g.attributes) { const a = g.attributes[n]; if (a !== pos && !a.isInterleavedBufferAttribute && a.array) parts.push({ part: a, g }); }
          if (g.index) parts.push({ part: g.index, pos, g });
        }
        items = parts;
      }
      // the upload material's programs (one per vertex layout it meets) compiled ahead too
      if (!mat0) { mat0 = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); mat0.fog = false; }
      syncLights(performance.now());
      const g = new THREE.Group(), lay = new Set();
      for (const it of items) {
        if (it.part) { if (!lay.has('part')) { lay.add('part'); const d = new THREE.BufferGeometry(); d.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); g.add(new THREE.Mesh(d, mat0)); } continue; }
        const k = layout(it.up); if (!lay.has(k)) { lay.add(k); g.add(new THREE.Mesh(it.up, mat0)); }
      }
      let p; const r = R(), prev = r.getRenderTarget();
      try { r.setRenderTarget(target()); p = r.compileAsync(g, wCam, wScene); } catch { p = Promise.resolve(); } finally { r.setRenderTarget(prev); }
      return p.catch(() => null).then(() => new Promise((resolve) => { const j = { items, i: 0, resolve }; if (opts && opts.first) jobs.unshift(j); else jobs.push(j); }));
    },
  };
}
