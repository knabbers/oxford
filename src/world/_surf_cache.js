// Surface fidelity, pass 4: START-UP. The city's painted atlases (facade, its masks, ground), the tree atlas, the sign
// page and the scanned layer arrays were made from scratch on every visit — ten seconds and more of painting, grain,
// mip-making and block compression. Here the FINISHED result is kept in Cache Storage and a repeat visit restores it:
//   - a block-compressed texture as its mip chain's bytes exactly as they went to the GPU (no painting, no encoding,
//     and the upload is a copy);
//   - an uncompressed canvas as a PNG (lossless), restored as an ImageBitmap already flipped for the GPU;
//   - a raw pixel array (the lower tiers' tree atlas) as its bytes.
// The key is everything that decides the pixels: PIPE (bump it when a painter changes), a hash of the SOURCE of the
// modules that paint (textures.js, _surf_compress.js, the layer manifest — so a new build repaints without anybody
// remembering to bump anything; if the sources cannot be fetched, PIPE alone), and the caller's flags (tier sizes, GPU
// formats). Entries under any other key are deleted. Storage refused, full or absent: every call resolves to null /
// false and the caller paints as before — the load never fails for it. `?texcache=0` switches it off; `?texverify=1`
// makes world/index.js paint as well on a restored visit and compare the bytes (console: [texcache] verify ...).
import * as THREE from 'three';
import { FMT, finishCompressed } from './_surf_compress.js';

export const PIPE = 4;
const STORE = 'gto-tex-v1', ROOT = '/__gto_tex/';
export const TEXC = { on: false, key: '', hits: [], misses: [], stored: [], failed: [], ms: 0, verify: false, pending: [] };
let cache = null;
const param = (n) => { try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; } };
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
function fnv(str, h = 0x811c9dc5) { for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }

/** open the store and fix the key (the painters' sources). What varies with the tier goes in the entry NAMES (the caller's prefix). */
export async function texCacheInit(flags) {
  TEXC.on = false; TEXC.verify = param('texverify') === '1';
  if (param('texcache') === '0' || typeof caches === 'undefined' || !caches.open || typeof Response === 'undefined') return false;
  const t0 = now();
  try {
    let h = fnv('pipe' + PIPE + JSON.stringify(flags));
    // the painters' own source: any change to them changes the key
    const srcs = await Promise.all(['./textures.js', './_surf_compress.js', '../../textures/surf/manifest.json'].map((u) => fetch(new URL(u, import.meta.url)).then((r) => (r.ok ? r.text() : '')).catch(() => '')));
    for (const s of srcs) h = fnv(s, h);
    TEXC.key = PIPE + '-' + h.toString(16);
    cache = await caches.open(STORE);
    TEXC.on = true;
    // entries made by any other build's painters are of no use to anybody: drop them (not awaited)
    cache.keys().then((ks) => { const mine = ROOT + TEXC.key + '/'; for (const k of ks) if (!new URL(k.url).pathname.startsWith(mine)) cache.delete(k); }).catch(() => {});
  } catch (e) { cache = null; TEXC.on = false; TEXC.error = String(e && e.message || e); }
  TEXC.ms += now() - t0;
  return TEXC.on;
}
const urlOf = (name) => ROOT + TEXC.key + '/' + encodeURIComponent(name);
async function getEntry(name) {
  if (!TEXC.on) return null;
  const t0 = now();
  try {
    const r = await cache.match(urlOf(name));
    if (!r) { TEXC.misses.push(name); return null; }
    const meta = JSON.parse(decodeURIComponent(r.headers.get('x-gto-meta') || '%7B%7D'));
    const out = { meta, r };
    TEXC.ms += now() - t0;
    return out;
  } catch (e) { TEXC.failed.push(name + ': ' + (e && e.message)); return null; }
}
function putEntry(name, meta, parts, type) { const p = putEntry1(name, meta, parts, type); TEXC.pending.push(p); return p; }
async function putEntry1(name, meta, parts, type = 'application/octet-stream') {
  if (!TEXC.on) return false;
  try {
    const blob = parts instanceof Blob ? parts : new Blob(parts, { type });
    await cache.put(urlOf(name), new Response(blob, { headers: { 'content-type': type, 'x-gto-meta': encodeURIComponent(JSON.stringify(meta)) } }));
    TEXC.stored.push(name); return true;
  } catch (e) { TEXC.failed.push(name + ': ' + (e && e.message)); return false; }      // (quota, private mode: paint next time too)
}

/**
 * Wait (at most `ms`) for every store begun so far to finish — world/index.js calls it at the end of the world build,
 * so that no large write (40 MB of blocks, a PNG being encoded) is still in flight once the game is running: a page
 * left or reloaded in the middle of one can be kept alive by it, with everything it holds. Never rejects.
 */
export function texCacheSettle(ms = 6000) {
  const all = TEXC.pending.splice(0); if (!all.length) return Promise.resolve(0);
  return Promise.race([Promise.allSettled(all).then(() => all.length), new Promise((r) => setTimeout(() => r(-1), ms))]);
}

// ---------------------------------------------------------------- block-compressed textures (2D and arrays)
/** store a compressed texture made by _surf_compress.js. Call BEFORE its first upload (the bytes are dropped then). */
export function storeCompressed(name, t, extra = {}) {
  if (!TEXC.on || !t || !t.mipmaps || !t.mipmaps.length || !t.mipmaps[0].data) return Promise.resolve(false);
  const kind = Object.keys(FMT).find((k) => FMT[k] === t.format);
  const meta = { type: 'c', kind, srgb: t.colorSpace === THREE.SRGBColorSpace, clampS: t.wrapS === THREE.ClampToEdgeWrapping, clampT: t.wrapT === THREE.ClampToEdgeWrapping, anisotropy: t.anisotropy,
    name: t.name, depth: t.isCompressedArrayTexture ? t.image.depth : 0, levels: t.mipmaps.map((m) => [m.width, m.height, m.data.length]), size: t.userData.size || null, scale: t.userData.scale, extra };
  return putEntry(name, meta, t.mipmaps.map((m) => m.data));      // (the Blob copies the bytes now)
}
/** -> { texture, extra, bytes (the level-0 data, for ?texverify) } or null */
export async function loadCompressed(name) {
  const e = await getEntry(name); if (!e || e.meta.type !== 'c') return null;
  try {
    const t0 = now(), buf = new Uint8Array(await e.r.arrayBuffer()), m = e.meta; let o = 0;
    const mips = m.levels.map(([width, height, n]) => { const data = buf.subarray(o, o + n); o += n; return { data, width, height }; });
    if (o !== buf.length) throw new Error('size');
    const t = m.depth ? new THREE.CompressedArrayTexture(mips, mips[0].width, mips[0].height, m.depth, FMT[m.kind]) : new THREE.CompressedTexture(mips, mips[0].width, mips[0].height, FMT[m.kind]);
    finishCompressed(t, { srgb: m.srgb, clampS: m.clampS, clampT: m.clampT, anisotropy: m.anisotropy, name: m.name });
    if (m.size) t.userData.size = m.size; if (m.scale !== undefined) t.userData.scale = m.scale;
    TEXC.hits.push(name); TEXC.ms += now() - t0;
    return { texture: t, extra: m.extra || {}, bytes: TEXC.verify ? mips[0].data.slice() : null };
  } catch (err) { TEXC.failed.push(name + ': ' + (err && err.message)); return null; }
}

// ---------------------------------------------------------------- canvases (lossless PNG <-> ImageBitmap)
/** store a canvas as PNG. opts are what textures.js canvasTexture() was given. Resolves when stored (do not await it on the loading path). */
export function storeCanvas(name, canvas, opts = {}, extra = {}) {
  if (!TEXC.on || !canvas || !canvas.toBlob) return Promise.resolve(false);
  const p = new Promise((res) => {
    try { canvas.toBlob((blob) => { if (!blob) { res(false); return; } putEntry1(name, { type: 'png', w: canvas.width, h: canvas.height, opts, extra }, blob, 'image/png').then(res); }, 'image/png'); }
    catch (e) { TEXC.failed.push(name + ': ' + (e && e.message)); res(false); }
  });
  TEXC.pending.push(p);
  return p;
}
/** -> { texture (image = an ImageBitmap flipped for the GPU, flipY false), extra } or null */
export async function loadCanvas(name, anisotropy = 4) {
  const e = await getEntry(name); if (!e || e.meta.type !== 'png' || typeof createImageBitmap !== 'function') return null;
  try {
    const t0 = now(), m = e.meta, o = m.opts || {};
    const bmp = await createImageBitmap(await e.r.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const t = new THREE.Texture(bmp);
    t.flipY = false; t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.wrapS = o.clampS ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.wrapT = o.clampT ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = anisotropy; t.generateMipmaps = o.mips !== false; t.minFilter = o.mips === false ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.userData.size = [m.w, m.h]; t.userData.gpuBytes = Math.round(m.w * m.h * 4 * 4 / 3);
    t.onUpdate = () => { try { if (bmp.close) bmp.close(); } catch (err) { /* */ } t.onUpdate = null; };      // (the picture is needed once)
    t.needsUpdate = true;
    TEXC.hits.push(name); TEXC.ms += now() - t0;
    return { texture: t, extra: m.extra || {} };
  } catch (err) { TEXC.failed.push(name + ': ' + (err && err.message)); return null; }
}

// ---------------------------------------------------------------- raw bytes
export function storeBytes(name, u8, extra = {}) { return TEXC.on && u8 ? putEntry(name, { type: 'raw', n: u8.length, extra }, [u8]) : Promise.resolve(false); }
export async function loadBytes(name) {
  const e = await getEntry(name); if (!e || e.meta.type !== 'raw') return null;
  try { const data = new Uint8Array(await e.r.arrayBuffer()); if (data.length !== e.meta.n) throw new Error('size'); TEXC.hits.push(name); return { data, extra: e.meta.extra || {} }; }
  catch (err) { TEXC.failed.push(name + ': ' + (err && err.message)); return null; }
}
