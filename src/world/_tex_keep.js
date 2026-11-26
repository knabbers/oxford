// Memory pass (2026-11-22): PAINTED TEXTURES LET GO OF THEIR CANVASES ONCE THEY ARE ON THE GRAPHICS CARD.
//
// Why: a texture painted on a 2D canvas kept that canvas alive as `texture.image` for as long as the texture lived —
// three.js holds the source for an upload that, for a picture painted once, never comes again. On the top tier that
// was 208 canvases, 610-670 MB by size, each backed by a surface in the GPU process as well (docs/ARCHITECTURE.md
// "Memory on the top tier").
//
// What happens now, for a texture whose owner has said how to paint it again (`repaintable`, `paintedTexture`,
// `lazyTexture` below; a kit does it once for everything it makes):
//   - when three has uploaded it, its `source.data` becomes a stub of the same width and height and the canvas is
//     emptied (0 x 0): the page's copy and its GPU-side surface go at once, whoever else still holds the element;
//   - the stub ignores `source.needsUpdate` (the picture cannot have changed: `repaint(tex)` is how an owner changes
//     it), so a `texture.clone()` made later costs nothing;
//   - if the card ever needs the picture again — the texture was disposed and is shown again (a room taken off the
//     card and brought back), a clone with other wrapping or filtering is first drawn, the WebGL context was lost and
//     restored, `repaint(tex)` was called — three passes the stub to `texSubImage2D`, and THERE (the context's own
//     function, wrapped by `installTexKeep`) the owner's painter is called, the fresh canvas goes up in the stub's
//     place and is emptied again. So an upload from a released source cannot happen: it is always a repaint.
//   - a stub with no painter (it cannot be made by this file; a painter that throws, or returns the wrong size) is
//     reported: console.error '[texkeep] LOST …', `TEXKEEP.lost` — and on localhost an exception, which three reports
//     as a WebGLState error. Tests assert `lost` is empty.
// A texture nobody registered is left exactly as it was.
// `lazyTexture`: a texture that is not painted until the card first needs it (nothing is painted for a place nobody
// goes near); `prepaint(tex)` paints and uploads it at a moment of the caller's choosing (out of sight, between frames).
// `?texkeep=0` (GTO_TEXKEEP=0 in node): nothing is released and lazy textures are painted at once — as before, for A/B.
// `?texkeep=verify`: a test — as each canvas is let go its painter is run and the two pictures are compared byte for
// byte (`game.texKeep.stats().checked`: {same, differ: [which and by how much]}); slow, for the probe.
import * as THREE from 'three';

const qp = (n) => { try { return new URLSearchParams(globalThis.location ? globalThis.location.search : '').get(n); } catch (e) { return null; } };
const env = (n) => { try { return globalThis.process && globalThis.process.env ? globalThis.process.env[n] : undefined; } catch (e) { return undefined; } };
const DEV = (() => { try { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(globalThis.location.hostname) || qp('dev') === '1'; } catch (e) { return false; } })();
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

export const TEXKEEP = {
  off: qp('texkeep') === '0' || env('GTO_TEXKEEP') === '0',
  verify: qp('texkeep') === 'verify',      // a test: at each release the painter is run and its canvas compared, byte for byte, with the one going (TEXKEEP.checked)
  on: false,                 // true once installTexKeep has wrapped a WebGL context (never in node: nothing is released there)
  registered: 0, released: 0, releasedMB: 0, lazy: 0, lazyPainted: 0, repainted: 0, repaintMs: 0, worstMs: 0, worst: '', lost: [], log: [], makeMs: 0, checked: { same: 0, differ: [], ms: 0 },
};
const PAINT = new WeakMap();      // Source -> { paint, name }
const STUB = new WeakMap();       // stub -> Source
const USERS = new WeakMap();      // canvas -> how many registered sources were made from it (two textures of one canvas: it is not emptied)
let renderer = null;

const isCanvas = (c) => !!c && typeof c.getContext === 'function' && typeof c.width === 'number';
const lose = (name, why) => {
  const msg = `[texkeep] LOST: "${name}" has to go up to the graphics card again and cannot be painted (${why}); it will be drawn black`;
  TEXKEEP.lost.push(name + ': ' + why); console.error(msg);
  if (DEV) throw new Error(msg);
};
function stubFor(S, w, h, name) {
  const stub = { width: w, height: h, released: true, name };
  STUB.set(stub, S);
  S.data = stub;
  // its picture cannot have changed (the canvas is gone): a clone's `needsUpdate` must not send it up again
  try { Object.defineProperty(S, 'needsUpdate', { configurable: true, set() { /* see repaint() */ } }); } catch (e) { /* as three has it */ }
  return stub;
}
/** ?texkeep=verify: is what the painter paints now the picture that is going, byte for byte? */
function check(c, P) {
  const t0 = now();
  try {
    let r = P.paint(); if (r && r.isTexture) r = r.image;
    if (!isCanvas(r) || r.width !== c.width || r.height !== c.height) { TEXKEEP.checked.differ.push(P.name + ': painter returned ' + (r ? r.width + 'x' + r.height : r)); return; }
    // (read through strips of 1024 rows copied into a small canvas: see world/_surf_compress.js chainOfCanvas)
    const W = c.width, SH = Math.min(1024, c.height), s = document.createElement('canvas'); s.width = W; s.height = SH; const g = s.getContext('2d'); g.globalCompositeOperation = 'copy';
    let n = 0, max = 0;
    for (let y = 0; y < c.height; y += SH) {
      const h = Math.min(SH, c.height - y);
      g.drawImage(c, 0, y, W, h, 0, 0, W, h); const a = g.getImageData(0, 0, W, h).data;
      g.drawImage(r, 0, y, W, h, 0, 0, W, h); const b = g.getImageData(0, 0, W, h).data;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { n++; const d = Math.abs(a[i] - b[i]); if (d > max) max = d; }
    }
    s.width = s.height = 0; r.width = r.height = 0;
    if (n) TEXKEEP.checked.differ.push(`${P.name} ${W}x${c.height}: ${n} bytes differ (${(100 * n / (W * c.height * 4)).toFixed(3)} %), the largest by ${max}`); else TEXKEEP.checked.same++;
  } catch (e) { TEXKEEP.checked.differ.push(P.name + ': ' + (e && e.message)); }
  TEXKEEP.checked.ms += now() - t0;
}
/** called by three after an upload (texture.onUpdate): let the canvas go */
function release(t) {
  const S = t.source, c = S && S.data;
  if (!TEXKEEP.on || !c || c.released || !isCanvas(c) || !PAINT.has(S) || c.isConnected) return;
  const w = c.width, h = c.height; if (!(w > 0 && h > 0)) return;
  if (TEXKEEP.verify) check(c, PAINT.get(S));
  stubFor(S, w, h, PAINT.get(S).name);
  if ((USERS.get(c) || 1) > 1) USERS.set(c, USERS.get(c) - 1);      // (another texture is still to go up from it: the collector takes it when the last has gone)
  else { try { c.width = 0; c.height = 0; } catch (e) { /* an OffscreenCanvas somebody transferred: the collector has it */ } }
  TEXKEEP.released++; TEXKEEP.releasedMB += w * h * 4 / 1048576;
}
function hook(t) {
  if (t.userData.texKeep) return; t.userData.texKeep = 1;
  const prev = t.onUpdate;
  t.onUpdate = (x) => { if (prev) prev(x); release(t); };
}

/**
 * Say how `tex` (a texture made from a canvas) is painted again: `paint()` returns a freshly painted canvas of the
 * same size (or a texture made from one — its image is taken — so a kit's own make-function can simply be called
 * again). From then on the canvas is let go once the texture is on the card. Returns tex.
 * The owner must not draw on the canvas afterwards (it is emptied): to change the picture, `repaint(tex)`.
 */
export function repaintable(tex, paint, name = '') {
  if (!tex || !tex.isTexture || !tex.source || typeof paint !== 'function') return tex;
  const S = tex.source;
  if (!PAINT.has(S)) { TEXKEEP.registered++; const c = S.data; if (isCanvas(c)) USERS.set(c, (USERS.get(c) || 0) + 1); }
  PAINT.set(S, { paint, name: name || tex.name || (S.data && S.data.width ? S.data.width + 'x' + S.data.height : 'texture') });
  tex.userData.painter = true;
  if (!TEXKEEP.off) hook(tex);
  return tex;
}
/**
 * Everything in `out` — a canvas texture, or an object / array holding canvas textures (two levels deep) — becomes
 * repaintable by `remake()`, which must return a freshly made result of the same shape (new canvases, the same
 * pictures). One call of remake serves every texture of the result that is wanted in the same turn. Returns out.
 */
export function repaintableAll(out, remake, name = '') {
  if (TEXKEEP.off || !out || typeof out !== 'object') return out;
  let again = null, at = -1;
  const redo = () => { const t = now(); if (!again || t - at > 250) { again = remake(); at = t; setTimeout(() => { again = null; }, 300); } return again; };
  const each = (o, fn, path = [], depth = 0) => { if (!o || typeof o !== 'object') return; if (o.isTexture) { fn(o, path); return; } if (depth > 2 || o.isObject3D || o.isMaterial || o.isBufferGeometry || isCanvas(o) || ArrayBuffer.isView(o)) return; for (const k of Array.isArray(o) ? o.keys() : Object.keys(o)) each(o[k], fn, path.concat(k), depth + 1); };
  // (a canvas of the shared remake that has already been taken — uploaded and emptied — is not handed out twice)
  const pick = (path) => { let r = redo(); for (const k of path) r = r && r[k]; const im = r && r.isTexture ? r.image : r; return im && im.width > 0 && !im.released ? r : null; };
  each(out, (tex, path) => { if (isCanvas(tex.image)) repaintable(tex, () => { let r = pick(path); if (!r) { again = null; r = pick(path); } return r; }, name + (path.length ? '.' + path.join('.') : '')); });
  return out;
}
/**
 * Wrap a kit's make-function — (…args) -> a canvas texture, or an object / array holding canvas textures — so that
 * everything it returns is repaintable by calling it again with the same arguments. The function must make a new
 * canvas each call (not hand back a cached texture) and paint the same picture for the same arguments.
 */
export function repaintableFn(make, label = '') {
  const nm = label || make.name || 'texture';
  return function (...args) { const t0 = now(), out = make.apply(this, args); TEXKEEP.makeMs += now() - t0; return repaintableAll(out, () => make.apply(this, args), nm); };
}
/** for a make-function that keeps its result in `cache[key]`: call it again with the cache set aside -> a fresh result */
export const remakeCached = (cache, key, make) => () => { const k = cache[key]; cache[key] = null; try { return make(); } finally { cache[key] = k; } };
/** paint(ctx, w, h) on a new w x h canvas -> a repaintable CanvasTexture; `finish(tex)` sets wrapping, colour space … */
export function paintedTexture(w, h, paint, finish = null, name = '') {
  const make = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; };
  const t = new THREE.CanvasTexture(make()); if (finish) finish(t);
  return repaintable(t, make, name);
}
/**
 * A texture that is painted when the card first needs it: `paint()` -> a w x h canvas (or a texture holding one).
 * `finish(tex)` sets wrapping, colour space, anisotropy… now. With ?texkeep=0, or with no WebGL (node), it is painted at once.
 */
export function lazyTexture(w, h, paint, finish = null, name = '') {
  if (TEXKEEP.off || !TEXKEEP.on) { let c = paint(); if (c && c.isTexture) c = c.image; const t = new THREE.CanvasTexture(c); if (finish) finish(t); t.name = t.name || name; return repaintable(t, paint, name); }
  const t = new THREE.Texture(); t.name = name; t.userData.lazy = true;
  if (finish) finish(t);
  t.needsUpdate = true;                 // (before the stub: the stub's source ignores it)
  PAINT.set(t.source, { paint, name: name || w + 'x' + h }); t.userData.painter = true; TEXKEEP.registered++; TEXKEEP.lazy++;
  stubFor(t.source, w, h, name || w + 'x' + h);
  return t;
}
/** paint and upload a lazy (or released-and-disposed) texture now — call it out of sight, one a frame. -> ms taken (0: nothing to do) */
export function prepaint(tex) {
  if (!renderer || !tex || !tex.isTexture || !TEXKEEP.on) return 0;
  const p = renderer.properties.get(tex); if (p && p.__webglTexture && p.__version === tex.version) return 0;
  const t0 = now(); try { renderer.initTexture(tex); } catch (e) { console.warn('[texkeep] prepaint', tex.name, e); }
  return now() - t0;
}
/** the owner has changed what its painter paints: paint it again and send it up at the texture's next draw */
export function repaint(tex) {
  if (!tex || !tex.isTexture) return;
  const S = tex.source;
  if (S && S.data && S.data.released) { S.version++; tex.version++; }      // (the stub ignores needsUpdate)
  else tex.needsUpdate = true;
}
/**
 * the canvas of a texture, for a module that draws FROM another's picture (a kit copying cells out of another kit's
 * atlas): the canvas itself while it lives, a freshly painted one (the caller's to use and drop) once it has gone;
 * null if it cannot be painted. Never read `texture.image` for this — it may be a stub.
 */
export function canvasOf(tex) {
  const S = tex && tex.source, c = S && S.data; if (!c) return null;
  if (isCanvas(c) && c.width > 1) return c;
  // (a stub, or a block-compressed texture that took its painter over — `keepPainter`)
  const P = PAINT.get(S); if (!P) { lose(c.name || tex.name || 'texture', 'canvasOf: nobody registered a painter'); return null; }
  let r = null; try { r = P.paint(); if (r && r.isTexture) r = r.image; } catch (e) { lose(P.name, 'canvasOf: its painter threw: ' + (e && e.message)); return null; }
  if (!isCanvas(r)) { lose(P.name, 'canvasOf: its painter returned no canvas'); return null; }
  return r;
}
/** `to` replaces `from` (a canvas texture that was block-compressed: world/index.js atlasMaterial) and can still be
 *  painted for `canvasOf` by from's painter. Returns to. */
export function keepPainter(to, from) { const P = from && from.source && PAINT.get(from.source); if (P && to && to.source && to !== from) PAINT.set(to.source, P); return to; }
/** is this texture's canvas gone (its `image` is a stub with width and height only)? */
export const isReleased = (tex) => !!(tex && tex.source && tex.source.data && tex.source.data.released);

/** a stub is being uploaded: paint, upload the fresh canvas in its place, empty it */
function paintInto(gl, fn, args, i) {
  const stub = args[i], S = STUB.get(stub), P = S && PAINT.get(S), name = stub.name || (P && P.name) || stub.width + 'x' + stub.height;
  if (!P) { lose(name, 'nobody registered a painter'); return undefined; }
  const t0 = now(); let c = null;
  try { c = P.paint(); if (c && c.isTexture) c = c.image; } catch (e) { lose(name, 'its painter threw: ' + (e && e.message)); return undefined; }
  if (!isCanvas(c) && !(typeof ImageBitmap !== 'undefined' && c instanceof ImageBitmap)) { lose(name, c && c.released ? 'its painter handed back a released texture (the make-function caches)' : 'its painter returned no canvas'); return undefined; }
  if (c.width !== stub.width || c.height !== stub.height) { lose(name, `its painter returned ${c.width}x${c.height}, not ${stub.width}x${stub.height}`); return undefined; }
  args[i] = c;
  let r; try { r = fn.apply(gl, args); } finally { args[i] = stub; try { if (isCanvas(c)) { c.width = 0; c.height = 0; } else if (c.close) c.close(); } catch (e) { /* */ } }
  const ms = now() - t0; TEXKEEP.repainted++; TEXKEEP.repaintMs += ms; if (ms > TEXKEEP.worstMs) { TEXKEEP.worstMs = ms; TEXKEEP.worst = name; }
  if (TEXKEEP.log.length < 400) TEXKEEP.log.push(name + ' ' + Math.round(ms) + ' ms');
  return r;
}
/** wrap the context's 2D uploads once (core/game.js, as soon as there is a renderer). Safe to call again. */
export function installTexKeep(R) {
  if (TEXKEEP.off || !R || !R.getContext) return false;
  let gl = null; try { gl = R.getContext(); } catch (e) { return false; }
  if (!gl || typeof gl.texSubImage2D !== 'function' || gl.__texKeep) { renderer = R; return !!(gl && gl.__texKeep); }
  for (const name of ['texSubImage2D', 'texImage2D']) {
    const fn = gl[name];
    gl[name] = function (...a) { const i = a.length - 1, s = a[i]; return s !== null && typeof s === 'object' && s.released === true ? paintInto(this, fn, a, i) : fn.apply(this, a); };
  }
  gl.__texKeep = true; renderer = R; TEXKEEP.on = true;
  return true;
}
export const texKeepStats = () => ({ on: TEXKEEP.on, registered: TEXKEEP.registered, released: TEXKEEP.released, releasedMB: Math.round(TEXKEEP.releasedMB), lazy: TEXKEEP.lazy, repainted: TEXKEEP.repainted, repaintMs: Math.round(TEXKEEP.repaintMs), worst: TEXKEEP.worst + ' ' + Math.round(TEXKEEP.worstMs) + ' ms', lost: TEXKEEP.lost.slice(), makeMs: Math.round(TEXKEEP.makeMs), checked: TEXKEEP.verify ? { same: TEXKEEP.checked.same, differ: TEXKEEP.checked.differ.slice(), ms: Math.round(TEXKEEP.checked.ms) } : undefined });
