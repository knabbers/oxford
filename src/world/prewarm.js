// Pre-warming the outdoor world before the player first sees it, and holding a door's fade until the new place draws
// smoothly. (smoothness pass, 2026-11)
//
// The game starts inside the pigeonhole room, so nothing outdoors had ever been drawn when the player first left by the
// door: every outdoor shader program compiled, every Metal pipeline was built (ANGLE builds it at a program's FIRST
// DRAW, 50–500 ms each on a Radeon Pro 460 — see airwarm.js), every texture and vertex buffer went up and the sun's
// shadow map was drawn for the first time, all in the first frames outside (measured: 16 fps, slowest frame 500 ms).
//
// exterior(x, z, heading): while the start screen still says "Loading Oxford…" (main.js waits for it), the outdoor
// streaming culls are run for the door's spot (world.cullAt), every outdoor material is compiled off the main thread
// where the driver can (renderer.compileAsync, KHR_parallel_shader_compile), and then the REAL outdoor render path
// (post pass on the high tier, the shadow map round that spot, the player's own character, the rain) draws the view
// from the door in four directions, one direction per frame, until a whole sweep runs quickly. Each warm render happens
// inside game.update, before the frame's real render: the room's render clears over it, so nobody ever sees it.
//
// Doors (interiors.enter / exit run their switch under ui.fade's black): the switch now returns a promise that holds
// the black until the new place's programs are compiled and five frames in a row are quick (capped), so the first
// frames of a room that has just been built, or of a street, are not the ones the player sees.
//
// game.prewarm = { stats, exterior(x, z, h) -> Promise, settle(scene) -> Promise, extras: [] (objects or {o, pre(x, y, z)}) }
import * as THREE from 'three';

const QUICK_MS = 34;        // a frame this quick (rAF to rAF: two vsyncs) counts as "drawing smoothly"
const QUICK_RUN = 5;        // ... and this many in a row (modules that build on the player's arrival take a few frames)
const HOLD_CAP = 1600;      // ms: the longest a door's black is held for the new place's frames to settle
const HIDE_CAP = 4000;      // ms: the longest a room stays undrawn while its programs compile
const SWEEP_OK = 30;        // ms: a sweep whose slowest warm render (CPU side + GPU backlog) is under this is the last
const MAX_SWEEPS = 3;
const EXT_CAP = 12000;      // ms: the exterior warm-up gives up after this (the button is enabled anyway)
const LOAD_BUDGET = 1200;   // ms: the loading screen's warm draws after the start door's (world.warmLoad): what is left is dropped
const NEAR_R = 160;          // m: hidden things this near the door are shown for the warm renders

export function installPrewarm(game) {
  const R = game.renderer, W = game.world;
  const now = () => performance.now();
  const st = { exterior: null, holds: [], extras: 0 };
  const P = { stats: st, extras: [] };
  game.prewarm = P;
  // (?prewarm=0: none of it, for before/after measurements — tools/probe_exit_hitch.mjs --extra "&prewarm=0")
  const off = typeof location !== 'undefined' && /[?&]prewarm=0/.test(location.search);
  // game.warmups: [{id, fn}] pushed by modules at install, run here on the loading screen (all modules installed): work a
  // module would otherwise do in one frame of play the first time it is needed (purple_turtle: the night's routes)
  // A warmup may also queue first draws (world.warmDraw: things that turn up later — the fireworks, the Parks' people,
  // the airfield, the gliders): they are drawn after the start door's warm-up, highest priority first, within
  // LOAD_BUDGET (world.warmLoad, from P.room below); st.warmDraws[id] = true drawn / false dropped by the budget.
  st.warmups = {}; st.warmDraws = {};
  if (!off) for (const w of game.warmups || []) {
    const a = now();
    try { const r = w.fn(); if (r && r.then) r.then((ok) => { st.warmDraws[w.id] = !!ok; }, () => { st.warmDraws[w.id] = false; }); } catch (e) { console.warn('[prewarm] warmup', w.id, e); }
    st.warmups[w.id] = Math.round(now() - a);
  }
  if (off || !R || !R.compileAsync || !W) { P.exterior = P.room = () => Promise.resolve(null); P.settle = () => Promise.resolve(); st.off = true; return P; }
  const gl = R.getContext();

  // things the outdoor scene draws only some of the time (added to the scene for the warm renders only)
  const extras = () => {
    const out = [];
    const pm = game.weather && game.weather.precip && game.weather.precip.mesh;
    if (pm && !pm.parent) out.push({ o: pm, pre: () => { const g = pm.geometry, n = g.instanceCount; g.instanceCount = 8; return () => { g.instanceCount = n; }; } });
    const um = game.umbrellas && game.umbrellas.mesh;      // open umbrellas (systems/umbrellas.js): in the scene only while it rains
    if (um && !um.parent) out.push({ o: um, pre: () => { const n = um.count; um.count = 1; return () => { um.count = n; }; } });
    // (P.extras: objects, or {o, pre(x, y, z) -> undo | null} for one placed at the warm view's spot each render)
    for (const e of P.extras) { const o = e && (e.isObject3D ? e : e.o); if (o && !o.parent) out.push(e.isObject3D ? { o, pre: null } : e); }
    return out;
  };

  // Things that are hidden while the player is indoors (place modules show their detail — near sets, far silhouettes —
  // by the player's distance, and indoors the player stands in the room's own coordinates), hidden for now (the lamp
  // pools by day) or still empty (croquet balls before anyone is about): shown for the warm renders only, so their
  // programs and pipelines are ready when they appear. Everything within rad of the door; beyond it, one object (the
  // nearest) for each material × object kind nothing visible draws.
  const _s = new THREE.Sphere();
  const kindKey = (o, m) => m.uuid + (o.isInstancedMesh ? 'I' : o.isBatchedMesh ? 'B' : o.isSkinnedMesh ? 'K' : o.isPoints ? 'P' : o.isLine ? 'L' : o.isSprite ? 'W' : 'M') + (o.castShadow ? 'c' : '');
  function sphereOf(o) {
    if (o.isInstancedMesh && o.count === 0) { const e = o.instanceMatrix.array; _s.center.set(e[12] || 0, e[13] || 0, e[14] || 0).applyMatrix4(o.matrixWorld); _s.radius = 10; }
    else if (o.isInstancedMesh || o.isBatchedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); _s.copy(o.boundingSphere).applyMatrix4(o.matrixWorld); }
    else if (o.isSkinnedMesh || !o.geometry) { _s.center.setFromMatrixPosition(o.matrixWorld); _s.radius = 5; }
    else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); _s.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); }
    return _s;
  }
  function hiddenNear(x, z, rad) {
    const objs = new Set(), ms = new Set(), empty = new Set(), scene = game.worldScene, shown = new Set(), far = new Map();
    scene.updateMatrixWorld();
    const cands = [];
    scene.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
      let hide = null;
      for (let p = o; p && p !== scene; p = p.parent) if (!p.visible) (hide || (hide = [])).push(p);
      const mm = Array.isArray(o.material) ? o.material : [o.material];
      const isEmpty = o.isInstancedMesh && o.count === 0 && o.instanceMatrix.array.length > 0;
      if (!hide && !isEmpty) { for (const m of mm) if (m) { if (m.visible === false) ms.add(m); else shown.add(kindKey(o, m)); } return; }
      cands.push([o, hide, mm, isEmpty]);
    });
    const take = (o, hide, isEmpty) => { if (hide) for (const p of hide) objs.add(p); if (isEmpty) empty.add(o); };
    for (const [o, hide, mm, isEmpty] of cands) {
      let d;
      try { const S = sphereOf(o); if (!(S.radius < 3000)) continue; d = Math.max(0, Math.hypot(S.center.x - x, S.center.z - z) - S.radius); } catch (e) { continue; }
      if (d < rad) { take(o, hide, isEmpty); continue; }
      for (const m of mm) {
        if (!m || m.visible === false) continue;
        const k = kindKey(o, m); if (shown.has(k)) continue;
        const f = far.get(k); if (!f || d < f[0]) far.set(k, [d, o, hide, isEmpty]);
      }
    }
    for (const [, o, hide, isEmpty] of far.values()) take(o, hide, isEmpty);
    return { objs: [...objs], mats: [...ms], empty: [...empty], far: far.size };
  }

  // ---- the exterior warm-up (the start room's door; then each room's way out)
  const cam = new THREE.PerspectiveCamera(60, 1, 0.15, 2600);
  const v3 = new THREE.Vector3(), sunP = new THREE.Vector3(), sunT = new THREE.Vector3(), domeP = new THREE.Vector3(), grpP = new THREE.Vector3();
  function view(x, z, yaw) {
    const y = W.groundHeight ? W.groundHeight(x, z) : 0;
    const pitch = game.cameraPitch || 0.28, dist = Math.min(game.cameraDist || 5.5, 5.5), cp = Math.cos(pitch), sp = Math.sin(pitch);
    cam.aspect = game.camera.aspect; cam.fov = game.camera.fov; cam.far = game.camera.far; cam.near = game.camera.near; cam.updateProjectionMatrix();
    cam.position.set(x - Math.sin(yaw) * cp * dist, y + 1.55 + sp * dist, z - Math.cos(yaw) * cp * dist);
    cam.lookAt(x, y + 1.55, z);
    cam.updateMatrixWorld();
    return y;
  }
  /** one warm render of the outdoor scene from cam, through the real outdoor path, with the sun's shadow box round (x, z) */
  function warmRender(x, y, z, hid) {
    const scene = game.worldScene, sky = W.sky, sun = W.sun, grp = game.player.character.group, par = grp.parent;
    const ex = extras(), undo = [];
    sunP.copy(sun.position); sunT.copy(sun.target.position);
    v3.set(x, y, z).sub(sun.target.position);
    sun.target.position.add(v3); sun.position.add(v3); sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    const dome = sky && sky.dome; if (dome) { domeP.copy(dome.position); dome.position.copy(cam.position); dome.updateMatrixWorld(); }
    // the local player's character as it will stand outside (its outdoor programs: the scene's lights are part of them)
    grpP.copy(grp.position);
    if (par !== scene) { scene.add(grp); grp.position.set(x, y, z); grp.updateMatrixWorld(true); }
    for (const e of ex) { scene.add(e.o); const u = e.pre ? e.pre(x, y, z) : null; if (u) undo.push(u); }
    if (hid) { for (const o of hid.objs) o.visible = true; for (const m of hid.mats) m.visible = true; for (const o of hid.empty) o.count = 1; }
    const sm = R.shadowMap, nu = sm.needsUpdate, exp = R.toneMappingExposure, prevT = R.getRenderTarget(), sc = game.scene;
    const t0 = now();
    try {
      sm.needsUpdate = true;
      R.toneMappingExposure = sky && sky.palette && sky.palette.exp ? sky.palette.exp : exp;
      game.scene = scene;            // (the render-time cull only acts on the outdoor scene)
      const c = game.cull; if (c) c.before(cam);
      try { if (game.postRender) game.postRender(R, scene, cam); else R.render(scene, cam); } finally { if (c) c.after(); }
    } catch (e) { console.warn('[prewarm] render', e); } finally {
      game.scene = sc;
      R.setRenderTarget(prevT); R.toneMappingExposure = exp; sm.needsUpdate = nu;
      for (const u of undo) u();
      for (const e of ex) e.o.removeFromParent();
      if (hid) { for (const o of hid.objs) o.visible = false; for (const m of hid.mats) m.visible = false; for (const o of hid.empty) o.count = 0; }
      if (par !== scene) { if (par) par.add(grp); grp.position.copy(grpP); grp.updateMatrixWorld(true); }
      sun.position.copy(sunP); sun.target.position.copy(sunT); sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
      if (dome) { dome.position.copy(domeP); dome.updateMatrixWorld(); }
    }
    const js = now() - t0;
    gl.getError();                   // waits for the GPU process to work through it (program links, pipelines, uploads)
    return { js, all: now() - t0 };
  }
  // one world.update(0) as if the camera already stood outside the door: the streaming the world does on its first
  // outdoor frame (tile culls, the street-front depth round the camera, streetscape's furniture / grass / decal fills,
  // which hang off world.update) done now, with the buffers it fills drawn by the warm renders that follow
  const camP = new THREE.Vector3(), camQ = new THREE.Quaternion();
  function outdoorTick(x, z, yaw, S) {
    const gc = game.camera, sc = game.scene, a = now();
    camP.copy(gc.position); camQ.copy(gc.quaternion);
    view(x, z, yaw); gc.position.copy(cam.position); gc.quaternion.copy(cam.quaternion); gc.updateMatrixWorld();
    try { game.scene = game.worldScene; W.update(0); } catch (e) { console.warn('[prewarm] world tick', e); } finally {
      game.scene = sc; gc.position.copy(camP); gc.quaternion.copy(camQ); gc.updateMatrixWorld();
    }
    if (S) S.tickMs = Math.round(now() - a);
  }
  // one job per door spot (the start room's on the loading screen; then each room's way out, the first time the player
  // goes in by that door — under the entry's black, see settle): the streaming culls for the spot, the outdoor scene
  // compiled, then the view from the door in four directions, one a frame, until a sweep is quick
  const jobs = new Map();
  let job = null;               // the one being stepped (jobs run one at a time, in the order asked for)
  const nextJob = () => { job = null; for (const j of jobs.values()) if (j.step) { job = j; break; } if (job && !job.started) job.start(); };
  function exterior(x, z, h, opts = {}) {
    const key = Math.round(x) + ',' + Math.round(z);
    const j0 = jobs.get(key); if (j0) return j0.promise;
    const t0 = now(), i0 = R.info.programs.length, tx0 = R.info.memory.textures, g0 = R.info.memory.geometries;
    const S = { x: Math.round(x), z: Math.round(z), state: 'queued', ms: 0, compileMs: 0, sweeps: 0, renders: 0, worst: [], programs: 0, textures: 0, geometries: 0 };
    const maxSweeps = opts.sweeps || MAX_SWEEPS;
    if (!st.exterior) st.exterior = S;
    else { (st.doors || (st.doors = [])).push(S); if (st.doors.length > 12) st.doors.shift(); S.room = opts.room || null; }
    let resolve; const promise = new Promise((r) => { resolve = r; });
    const J = { promise, k: 0, sweepWorst: 0, compiled: false, started: false, S };
    jobs.set(key, J);
    const finish = (state) => {
      if (S.state === 'done' || S.state === 'timeout' || S.state === 'cut') return;
      S.state = state; S.ms = Math.round(now() - t0);
      S.programs = R.info.programs.length - i0; S.textures = R.info.memory.textures - tx0; S.geometries = R.info.memory.geometries - g0;
      J.step = null; resolve(S);
      if (job === J) nextJob();
    };
    J.cut = () => { finish('cut'); jobs.delete(key); };     // (a later entry by that door tries again)
    const yaws = [h, h + Math.PI / 2, h + Math.PI, h - Math.PI / 2];
    J.start = () => {
      J.started = true;
      setTimeout(() => finish('timeout'), EXT_CAP);
      S.state = 'cull';
      try { W.cullAt && W.cullAt(x, z); } catch (e) { console.warn('[prewarm] cull', e); }
      // compile everything outdoors (and the extras) for the outdoor path, off the main thread where the driver can
      S.state = 'compile';
      const grp = new THREE.Group();
      const p = (() => {
        try {
          const ps = [W.compileAsync(game.worldScene)];
          for (const e of extras()) { grp.add(e.o); }
          if (grp.children.length) ps.push(W.compileAsync(grp));
          return Promise.all(ps.map((q) => q || Promise.resolve()));
        } catch (e) { return Promise.resolve(); }
      })();
      p.catch(() => null).then(() => {
        for (const c of [...grp.children]) grp.remove(c);
        S.compileMs = Math.round(now() - t0); if (S.state === 'compile') S.state = 'draw'; J.compiled = true;
      });
    };
    J.step = () => {
      if (!J.compiled) return;
      if (J.k === 0 && S.sweeps === 0) outdoorTick(x, z, yaws[0], S);
      if (J.k === 0) { const a = now(); J.hid = hiddenNear(x, z, NEAR_R); S.hidden = J.hid.objs.length + J.hid.mats.length + J.hid.empty.length; S.scanMs = Math.round(now() - a); }
      const y = view(x, z, yaws[J.k]);
      const r = warmRender(x, y, z, J.hid);
      S.renders++;
      if (r.all > J.sweepWorst) J.sweepWorst = r.all;
      if (S.worst.length < 12) S.worst.push(Math.round(r.all));
      if (++J.k >= yaws.length) {
        J.k = 0; S.sweeps++;
        if (J.sweepWorst < SWEEP_OK || S.sweeps >= maxSweeps) finish('done');
        J.sweepWorst = 0;
      }
    };
    if (!job) nextJob();
    return promise;
  }
  P.exterior = exterior;
  /** where interiors._switchOut puts the player leaving room d by its way in (null: not out to the world) */
  const exitSpot = (d) => {
    const door = d && (d._via || d.doors[0]);
    if (!door || (door.from && door.from !== 'world')) return null;
    const f = door.facing || 0;
    return [door.pos[0] + Math.sin(f) * 1.4, door.pos[1] + Math.cos(f) * 1.4, f];
  };
  // the vertex buffers of the place modules' meshes nobody has drawn yet (shown by distance or LOD later: the Radcliffe
  // Square atlas mesh, 20 MB, used to go up in one 26–72 ms bufferData the first frame it came into range from the
  // Parks), a few MB a batch. Not the city tiles ('world:…', streamed and re-pooled as the camera moves).
  // (three registers a 'dispose' listener on a geometry the first time it draws it: none = never uploaded)
  function uploadRest() {
    const seen = new Set(), list = [];
    for (const top of game.worldScene.children) {
      if (/^world:/.test(top.name || '')) continue;
      top.traverse((o) => {
        const g = o.geometry; if (!g || seen.has(g) || !(o.isMesh || o.isPoints || o.isLine) || o.isSkinnedMesh) return;
        seen.add(g);
        if (g._listeners && g._listeners.dispose && g._listeners.dispose.length) return;
        if (!g.attributes.position || g.attributes.position.count < 500 || g.morphAttributes.position) return;
        list.push(g);
      });
    }
    st.upload = { n: list.length };
    return list.length ? list : null;
  }
  let first = true;
  /** warm the street outside interior `id`'s way out to the world (where interiors._switchOut puts the player) -> Promise */
  P.room = (id, opts) => {
    const s = exitSpot(game.interiors && game.interiors.get(id));
    const p = s ? exterior(s[0], s[1], s[2], { room: id, ...opts }) : Promise.resolve(null);
    if (!first) return p;
    first = false;                // (the start room, on the loading screen: the warmups' first draws as well)
    // and then every material in the outdoor scene that is still undrawn — far from the start door, in view of nothing
    // the sweeps drew (St Giles', the Parks, East Oxford…: ~50 materials, ~18 programs whose first use waited 30–60 ms
    // for the link, and their pipelines) — drawn once out of sight, a few a batch (world.warmDraw, {fresh})
    // (queued last, behind the warmups' own: the budget drops the least likely first)
    // (?warmload=0: not these, for before/after measurements of the loading screen — the queue is dropped)
    const noLoad = typeof location !== 'undefined' && /[?&]warmload=0/.test(location.search);
    return p.then(() => {
      if (!W.warmLoad) return st.exterior;
      if (noLoad) return W.warmLoad(0).then((r) => { st.load = r; return st.exterior; });
      W.warmDraw(game.worldScene, { fresh: true, prio: -1, id: 'whole scene' });
      const up = uploadRest(); if (up) W.warmDraw(null, { upload: up, prio: -2, id: 'uploads' });
      // (top tier: what the budget does not reach is not dropped — the world works through it behind the game, in the
      //  start room at the room's pace; world/index.js warmRest, ?warmrest=0. st.load.rest / .restDone say what and how far)
      return W.warmLoad(LOAD_BUDGET, { rest: true }).then((r) => { st.load = r; return st.exterior; });
    });
  };
  game.addSystem({ id: 'prewarm', update() { if (job && job.step && game.scene !== game.worldScene) job.step(); } });

  // ---- doors: hold the fade's black until the new place draws smoothly
  // A room, once compiled, is drawn once under the black with EVERYTHING in it (frustum culling off, hidden things
  // shown, empty instanced meshes given one instance), the shadow maps too: on ANGLE Metal a program's GPU pipeline is
  // only built at its first draw (50–450 ms, cold) and a texture / buffer only goes up then, so a crate or a poster that
  // first comes into view as the camera settles behind the player, a frame after the hold, used to cost a stall with
  // nothing on the main thread (eo_records: 181 ms). Same target as the real render (rooms draw to the canvas).
  function drawAll(scene, cam) {
    const shown = [], culled = [], empty = [], mats = [];
    scene.traverse((o) => {
      if (o !== scene && o.visible === false) { o.visible = true; shown.push(o); }
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
      if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); }
      if (o.isInstancedMesh && o.count === 0 && o.instanceMatrix.count > 0) { o.count = 1; empty.push(o); }
      const mm = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mm) if (m && m.visible === false) { m.visible = true; mats.push(m); }
    });
    const sm = R.shadowMap, nu = sm.needsUpdate, prevT = R.getRenderTarget(), t0 = now();
    try { sm.needsUpdate = true; R.setRenderTarget(null); R.render(scene, cam); } catch (e) { console.warn('[prewarm] room draw', e); } finally {
      sm.needsUpdate = nu; R.setRenderTarget(prevT);
      for (const o of shown) o.visible = false; for (const o of culled) o.frustumCulled = true; for (const o of empty) o.count = 0; for (const m of mats) m.visible = false;
    }
    return { ms: Math.round(now() - t0), shown: shown.length, objs: culled.length };
  }
  // the GPU has worked through what was sent up to a frame ago (a fence per hold frame: a frame whose rAF interval was
  // quick but whose GPU work is still queued — pipelines being built, uploads — is not "drawing smoothly" yet)
  let fences = [];
  const gpuCaughtUp = () => {
    if (!gl.fenceSync) return true;
    let ok = true;
    while (fences.length > 1) { const f = fences[0]; let s = false; try { s = gl.getSyncParameter(f, gl.SYNC_STATUS) === gl.SIGNALED; } catch { s = true; } if (!s) { ok = false; break; } try { gl.deleteSync(f); } catch { /* */ } fences.shift(); }
    if (fences.length < 3) { try { fences.push(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)); gl.flush(); } catch { /* */ } }
    return ok;
  };
  const dropFences = () => { for (const f of fences) { try { gl.deleteSync(f); } catch { /* */ } } fences = []; };
  const DOOR_CAP = 1200;      // ms: the longest an entry's black waits for the way out to be warmed
  function settle(scene, d) {
    const t0 = now(), rec = { ms: 0, frames: 0, worst: 0, place: game.player.place, compileMs: 0 };
    st.holds.push(rec); if (st.holds.length > 12) st.holds.shift();
    // a room: its programs compiled off the main thread (compileAsync, which takes the room's lights now) while the room
    // is not drawn at all — drawing it at once would wait for every link on the main thread (seconds, cold) — then shown
    let ready = true;
    try {
      const rt = scene === game.worldScene && W.post && W.post.target ? W.post.target() : null, prev = R.getRenderTarget();
      if (rt) R.setRenderTarget(rt);
      const p = R.compileAsync(scene, game.camera, scene);
      if (rt) R.setRenderTarget(prev);
      if (scene !== game.worldScene && scene.visible) {
        ready = false; scene.visible = false;
        const show = () => { if (!ready) { ready = true; scene.visible = true; rec.compileMs = Math.round(now() - t0); } };
        p.then(show, show); setTimeout(show, HIDE_CAP);
      }
    } catch (e) { ready = true; scene.visible = true; }
    const room = scene !== game.worldScene;
    // a room entered from the street: the street outside its way out is warmed too, the first time, under this black
    // (the view from the door in four directions through the real outdoor path, as for the start room on the loading
    // screen), so leaving any room is as smooth as leaving the first — things near a door the start door's warm-up
    // never drew (the Worcester bar: 25–70 ms) are drawn here
    // (not finished when the black lifts — the cap — it stops there: its culls were for that door, and the next room's
    // would queue behind it)
    let doorWarm = false, doorJob = null;
    if (room && d) { const s = exitSpot(d), key = s && Math.round(s[0]) + ',' + Math.round(s[1]); if (s && !jobs.has(key)) { doorWarm = true; exterior(s[0], s[1], s[2], { room: d.id, sweeps: 2 }).then(() => { doorWarm = false; rec.doorMs = Math.round(now() - t0); }); doorJob = jobs.get(key); } }
    dropFences();
    return new Promise((resolve) => {
      let last = 0, quick = 0, t1 = 0, drawn = !room;
      const tick = (t) => {
        if (!ready || (doorWarm && t - t0 < DOOR_CAP)) { requestAnimationFrame(tick); return; }
        if (!t1) t1 = t;
        // (the place may have changed under us — a test hook leaving at once: then only the timing)
        if (!drawn) { drawn = true; if (game.scene === scene) { const r = drawAll(scene, game.camera); rec.drawMs = r.ms; rec.drawShown = r.shown; } }
        const caught = gpuCaughtUp();
        if (last) { const d = t - last; rec.frames++; if (d > rec.worst) rec.worst = Math.round(d); quick = d < QUICK_MS && caught ? quick + 1 : 0; }
        last = t;
        if ((quick >= QUICK_RUN && rec.frames >= QUICK_RUN + 1) || t - t1 > HOLD_CAP) { rec.ms = Math.round(now() - t0); dropFences(); if (doorJob && doorJob.step) doorJob.cut(); resolve(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  P.settle = settle;
  const I = game.interiors;
  if (I && I._switchIn && I._switchOut && !I._prewarmWrapped) {
    I._prewarmWrapped = true;
    const sIn = I._switchIn, sOut = I._switchOut;
    // (enter() and exit() run these inside ui.fade, which awaits what they return; enterNow / leaveNow ignore it)
    I._switchIn = function (d, door, at) { const r = sIn.call(this, d, door, at); return at === undefined && d && d.scene ? settle(d.scene, d) : r; };
    I._switchOut = function () { const r = sOut.call(this); return settle(game.scene); };
  }
  return P;
}
