// No frame of play waits for a shader program to compile and link. (arrival-stall pass, 2026-11)
//
// three creates a program the first time a material is drawn under some set of conditions and asks for its uniforms at
// once (WebGLProgram.getUniforms -> getProgramInfoLog / getProgramParameter), which blocks the frame until the GPU
// process has compiled and linked it: 40–370 ms each on a Radeon Pro 460, several stacked in the first frames of
// arriving somewhere new (measured: 590 ms of a second of stalls after a teleport were in getProgramInfoLog).
// KHR_parallel_shader_compile does not help by itself there: ANY call that needs an answer from the GPU process —
// asking whether the link is complete included, 400 ms measured — waits for everything queued before it, and on this
// machine the compiling is what is queued. (For the same reason compiling a whole room "ahead" in one go stalls the
// frames that follow it.)
//
// So, here:
//   * every new program is followed by a GPU fence; until the fence has passed (polled once a frame: that is answered
//     without waiting) nothing asks the GPU process anything about a program that is being made;
//   * a new program is given a getUniforms that, while its fence has not passed or its link is still running, throws
//     a private token instead of blocking; renderBufferDirect is wrapped to catch it and leave that ONE draw out of this
//     frame. The object is drawn from the first frame its program is ready;
//   * while the GPU process is busy with one lot of new programs (MAX_NEW of them), no more are started: a material
//     that has never been drawn is not drawn (its program not made) until the fence has passed. New programs are thus
//     made at the pace the GPU process makes them, a couple at a time, and the frames in between are ordinary frames.
// Only for a material that has never been drawn with any program (something turning up for the first time — which
// appears a moment late instead of freezing the picture); a material that is already on screen and needs a new variant
// of its program (the lights of its scene changed, another target) blocks as before rather than blink out — unless the
// caller says otherwise: renderer.linkWait.force++ / -- brackets draws that must never block and may be left out (the
// warm-up draws of rooms: a step is taken again next frame when renderer.linkWait.skipped moved during it).
//
// OFF until main.js turns it on when the loading screen is done (renderer.linkWait.on): while loading, everything is
// compiled as fast as it will go and nobody is watching the frame rate. ?lazylink=0: never on.
//
// renderer.linkWait = { on, force, skipped (draws left out, ever), programs (programs waited for this way), made
//   (programs made, ever), blocked / blockedMs / names (programs whose making was waited for inside a frame all the
//   same, while on), maxWait (ms: after this a program blocks after all), busy() }
//
// The info logs. (arrival-stutter pass, 2026-11) Measured on the Radeon Pro 460, out of doors on the top tier, where
// the GPU process runs about three frames behind the page: once a program's link is COMPLETE (the poll above), its link
// status, its uniforms and attributes and their locations are all answered from the browser's own copy at no cost
// (0.2 ms for a 100 kB shader) — but three's first use of a program also fetches the program's and both shaders' INFO
// LOGS (renderer.debug.checkShaderErrors), and each of those is a true round trip that waits for everything queued:
// 80–130 ms, every time, for every program, however long ago it was linked (the 95 ms "getProgramInfoLog" frames of
// every arrival: 16 at Cornmarket, 41 along the High). So with linkWait.nolog set (main.js: the top tier; a function is
// asked each time) the logs are not fetched while this is on: the link status is still checked, and a program that
// failed to link has its log fetched and printed then. ?lllog=1: fetched as before. linkWait.quietFirst counts them.
//
// ...and not in the frame the link is first SEEN to be complete. Measured the same way: a program whose completion
// has just been noticed costs the full round trip (88–115 ms, every time) if its uniforms are asked for in that same
// frame, and nothing (0.0 ms) two frames later — the browser takes the program's details in a moment after it reports
// the link done. So a program is taken into use READY_SETTLE ms after the poll that first said "complete" (the draw
// is left out for those two frames more). ?llsettle=0: at once, as before.
//
// A new VARIANT of a material that has been drawn before used to be waited for wherever it turned up (it must not
// blink out of the picture). Two places where it is something new coming into a picture that is drawn again anyway, and
// the wait was the stall (65–156 ms each, measured: the first skinned / instanced / cut-out caster of a kind in the
// sun's shadow; the first of a kind over the grass mask): there the one draw is left out instead, as for a material
// never drawn —
//   * the shadow pass (three draws it with scene === null) while renderer.shadowMap.autoUpdate is on: the map is drawn
//     again next frame, and the caster is in it from the first frame its program is ready;
//   * draws bracketed by linkWait.soft++ / -- (world/_fx_grass.js: the mask's pass of what stands on the grass, taken
//     again when linkWait.skipped moved during it). Unlike force, soft does not hold back draws whose programs are ready.
// ?llsoft=0: both wait as before. linkWait.softSkips counts them.
//
// Big textures in warm-up draws are spaced out. A room's first draws (force: left out and taken again, one new material
// a frame) each took a picture of 4–17 MB up to the card, a frame apart: Worcester's hall and bar coming back into
// range was 137 MB in a second and a half, with 83–100 ms frames behind it. While linkWait.nolog says so (the top
// tier), a force draw whose material has more than 1 MB of texture still to go up is left out until TEX_MS_PER_MB ms
// for every MB of the last such texture have passed — about 3 MB a frame on average, the same pictures, the room ready
// a second or so later. Only those draws: nothing in the picture itself is ever held back for it. ?lltex=0: not.
// linkWait.texSkips counts the draws left out.
//
// linkWait.adoptAll() — main.js, as the loading screen ends. The browser answers "is the link complete?" and, with it,
// everything else about a program without a round trip only while it still holds that program's completion query, and
// it holds the newest 128: of the ~260 programs made on the loading screen, those compiled ahead but never drawn (a
// room's materials for the other targets it is drawn into, far places) had lost theirs, and their first use in play
// was a true wait again (119 ms in getProgramParameter, measured arriving in Main Quad). So every program that is
// linked by the end of the loading screen is taken into use there, where the GPU process has nothing queued and the
// question costs under a millisecond. ?lladopt=0: not. -> { n, ms }
const POLL_AFTER = +(globalThis.location ? new URLSearchParams(location.search).get('llafter') ?? 30 : 30), POLL = 35;      // ms
const MAX_NEW = 3;         // programs started per fence
const FENCE_CAP = 3000;    // ms: a fence that never passes (a lost context) counts as passed
const READY_SETTLE = +(globalThis.location ? new URLSearchParams(location.search).get('llsettle') ?? 70 : 70);      // ms between the first "link complete" and the first use
const TEX_MS_PER_MB = 11;  // ms left between big texture uploads of warm-up draws, per MB of the last one
const TEX_KEYS = ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'lightMap', 'bumpMap'];
export function installLazyLink(R) {
  let gl = null;
  try { gl = R.getContext && R.getContext(); } catch { gl = null; }
  if (!gl || !gl.fenceSync || !R.info || !Array.isArray(R.info.programs) || typeof R.renderBufferDirect !== 'function' || !R.properties || !R.extensions || !R.extensions.has || !R.extensions.has('KHR_parallel_shader_compile')) return null;
  let never = false;
  try { never = /[?&]lazylink=0/.test(location.search); } catch { /* no location */ }
  const L = (R.linkWait = { on: false, never, force: 0, target: null, skipped: 0, programs: 0, made: 0, blocked: 0, blockedMs: 0, pollMs: 0, pollMax: 0, finalMax: 0, maxWait: 8000, names: [], busy: () => !quiet() });
  const SKIP = { lazyLink: true };
  let wantLog = false;
  try { wantLog = /[?&]lllog=1/.test(location.search); } catch { /* no location */ }
  L.nolog = null; L.quietFirst = 0;
  let softOk = true, softDraw = false;
  try { softOk = !/[?&]llsoft=0/.test(location.search); } catch { /* no location */ }
  L.soft = 0; L.softSkips = 0;
  // three's first use of program p (its uniforms and attributes), without the info logs when linkWait.nolog says so
  function firstUse(p, get) {
    const dbg = R.debug, n = L.nolog;
    if (wantLog || !n || !dbg || dbg.checkShaderErrors !== true || (typeof n === 'function' && !n())) return get.call(p);
    dbg.checkShaderErrors = false;
    let u; try { u = get.call(p); } finally { dbg.checkShaderErrors = true; }
    L.quietFirst++;
    try { if (p.program && gl.getProgramParameter(p.program, gl.LINK_STATUS) === false) console.error('[lazylink] shader program did not link: ' + (p.name || p.type || '?') + '\n' + gl.getProgramInfoLog(p.program)); } catch { /* */ }
    return u;
  }
  let curMat = null, drawFence = false, lastFinal = -1e9, passedAt = -1e9, fence = null, fenceAt = 0, fenceId = 0, passedId = 0, made = 0, polledAt = -1;
  // has the GPU process worked through every program started so far? (asked at most once every few ms)
  function quiet() {
    if (!fence) return true;
    const now = performance.now();
    if (now - polledAt < 4) return false;
    polledAt = now;
    let ok = false;
    try { ok = gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED; } catch { ok = true; }
    if (!ok && now - fenceAt > FENCE_CAP) ok = true;
    if (!ok) return false;
    try { gl.deleteSync(fence); } catch { /* */ }
    fence = null; passedId = fenceId; passedAt = now; made = 0;
    return true;
  }
  // may this material's draw be left out of the frame? One that has never been drawn, in the picture itself (the
  // screen, or the post pass's scene target: L.target, set by world/post.js) — never in a shadow pass or in a picture
  // that is taken once and kept (an impostor, a baked map), where something left out would stay left out.
  const may = (m) => { if (m === null || m._llDrawn === true) return false; const t = R.getRenderTarget(); return t === null || t === L.target; };
  function setFence() { try { if (fence) gl.deleteSync(fence); fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); fenceAt = performance.now(); } catch { fence = null; } }
  function hook(p) {
    if (!p || typeof p.getUniforms !== 'function' || typeof p.isReady !== 'function') return;
    L.made++; made++;
    // (the fence goes after this program's compile and link commands; a later program's fence replaces it and covers both)
    setFence();
    const myFence = ++fenceId;
    if (!fence) passedId = fenceId;
    const get = p.getUniforms, t0 = performance.now(); let waited = false, nextPoll = 0, readyT = 0;
    // the link is complete, and was first seen to be READY_SETTLE ms ago (polled every POLL ms until it is)
    const settled = (now) => {
      if (readyT === 0) {
        if (now < nextPoll) return false;
        nextPoll = now + POLL;
        const r = p.isReady(), pm = performance.now() - now; L.pollMs += pm; if (pm > L.pollMax) L.pollMax = pm;
        if (!r) return false;
        readyT = performance.now();
        return READY_SETTLE <= 0;
      }
      return now - readyT >= READY_SETTLE;
    };
    const wrapped = (p.getUniforms = function () {
      const now = performance.now();
      if (L.on && now - t0 < L.maxWait && (L.force > 0 || may(curMat))) {
        if (fence !== null) quiet();
        // (taking a finished program into use is a few dozen questions to the GPU process, 10–30 ms: one a frame)
        // (and only while nothing newer is being made: an answer waits for everything queued before the question)
        let ok = passedId >= myFence && fence === null && now - lastFinal >= 12 && now - passedAt >= POLL_AFTER;
        // (asking whether the link is done is itself not always free — up to 80 ms measured, even after the fence, while
        //  the driver is still at it: so not until POLL_AFTER ms after the fence, and then every POLL ms)
        if (ok) ok = settled(now);
        if (!ok) { L.skipped++; if (!waited) { waited = true; L.programs++; } throw SKIP; }
        p.getUniforms = get; const a = performance.now(), u = firstUse(p, get); lastFinal = performance.now(); if (lastFinal - a > L.finalMax) L.finalMax = lastFinal - a; drawFence = true; return u;
      }
      if (!L.on) { p.getUniforms = get; return get.call(p); }
      // (a new variant in a picture that is drawn again: left out until it is ready — never asked while it links)
      if (softOk && (softDraw || L.soft > 0) && now - t0 < L.maxWait) { if (fence !== null) quiet(); if (!settled(now)) { L.skipped++; L.softSkips++; throw SKIP; } p.getUniforms = get; return firstUse(p, get); }
      if (passedId >= myFence && fence === null && p.isReady()) { p.getUniforms = get; return firstUse(p, get); }
      // (blocks: counted, so a probe can say what still stalls)
      const a = performance.now(); p.getUniforms = get; const u = firstUse(p, get), ms = performance.now() - a;
      L.blocked++; L.blockedMs += ms; if (L.names.length < 80) L.names.push((curMat && (curMat.name || curMat.type)) + ' ' + ms.toFixed(0) + 'ms');
      return u;
    });
    // (adoptAll: three's first use now, if the link is complete)
    wrapped._ll = () => { if (p.getUniforms !== wrapped || !p.isReady()) return false; p.getUniforms = get; get.call(p); return true; };
  }
  let adoptOk = true;
  try { adoptOk = !/[?&]lladopt=0/.test(location.search); } catch { /* no location */ }
  L.adoptAll = () => {
    const a = performance.now(); let n = 0;
    if (adoptOk) for (const p of R.info.programs) { const f = p && p.getUniforms; if (f && f._ll) { try { if (f._ll()) n++; } catch { /* left for its first draw */ } } }
    return (L.adopted = { n, ms: Math.round(performance.now() - a) });
  };
  // bytes of this material's textures that would go up to the card at its next draw (8-bit RGBA with mips)
  let texOk = true, texHold = 0; L.texSkips = 0;
  try { texOk = !/[?&]lltex=0/.test(location.search); } catch { /* no location */ }
  function texPending(m) {
    let b = 0;
    for (let i = 0; i < TEX_KEYS.length; i++) {
      const t = m[TEX_KEYS[i]]; if (!t || t.isTexture !== true || t.isRenderTargetTexture === true) continue;
      const im = t.image; if (!im || !(im.width > 0)) continue;
      const tp = R.properties.get(t); if (tp.__webglInit === true && tp.__version === t.version) continue;
      b += im.width * im.height * (t.generateMipmaps ? 5.33 : 4);
    }
    return b;
  }
  const progs = R.info.programs, push = progs.push;
  progs.push = function (...a) { const n = push.apply(this, a); for (const p of a) { try { hook(p); } catch { /* the program works as three made it */ } } return n; };
  const rbd = R.renderBufferDirect;
  R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    // (the GPU process is still making the last lot of programs: nothing new is started behind them)
    if (fence !== null && made >= MAX_NEW && L.on && (L.force > 0 || may(material)) && !quiet()) { L.skipped++; return; }
    // (a program's FIRST DRAW is the other thing the GPU process may take its time over — on Metal the pipeline is built
    //  then, 50–500 ms: a fence after it too, and no other program is taken into use until that has passed)
    if (drawFence) { drawFence = false; setFence(); }
    // (a warm-up draw with a big picture still to go up: not while the last one is being taken in)
    if (texOk && L.force > 0 && L.on && L.nolog) {
      const b = texPending(material);
      if (b > 1e6 && (typeof L.nolog !== 'function' || L.nolog())) {
        const now = performance.now();
        if (now < texHold) { L.skipped++; L.texSkips++; return; }
        texHold = now + (b / 1e6) * TEX_MS_PER_MB;
      }
    }
    curMat = material;
    softDraw = scene === null && L.on && R.shadowMap.autoUpdate === true;      // (the shadow pass, drawn again next frame)
    try { rbd.call(this, camera, scene, geometry, material, object, group); if (material._llDrawn !== true) material._llDrawn = true; }
    catch (e) { if (e !== SKIP) throw e; }
    softDraw = false;
  };
  return L;
}
