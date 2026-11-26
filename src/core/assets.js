// Everything the game needs besides its code and the map is downloaded on the loading screen and kept on the device;
// nothing is fetched during play. (2026-11)
//
// tools/pack_assets.mjs writes public/audio/assets.json: groups of files (music, ambient sound, the voice manifest), and
// for the 7,000-odd voice clips a handful of ~10 MB pack files plus an index (id -> pack, offset, length), every one
// with its size and a hash of its contents. preload() fetches that small manifest (never from a cache), then for each
// file: takes it from Cache Storage if the copy there has the manifest's hash, else downloads it (progress reported in
// bytes) and stores it. Copies under a hash the manifest no longer lists are deleted. If Cache Storage is missing, or
// the quota is refused, everything is still downloaded and held in memory for this visit — never fetched lazily later.
//
// What is held in memory: the compressed bytes only (about 95 MB: mp3). A voice clip is decoded when it is about to be
// spoken (core/voice.js, which keeps a small bounded cache of decoded clips); music is handed to its player as it asks.
//
// How the rest of the game gets at it without knowing: a fetch() for a preloaded URL is answered from memory
// (installFetch — systems/soundtrack.js, and any module that fetches its sounds, need no change), and once the loading
// screen is over (seal()) a fetch for anything under audio/ that was NOT preloaded is refused (a 404 made here, counted
// in assets.late and warned about once) instead of going to the network.
//
// game.assets = { ready, sealed, total, done, fromCache, fromNet, stored, late, lateUrls, voice: { clip(id) -> ArrayBuffer | null, has(id) },
//                 bytes(url) -> Uint8Array | null, seal() }
const CACHE = 'gto-assets-v1', PARALLEL = 4;

export function createAssets(opts = {}) {
  const base = opts.base || (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/');
  const abs = (u) => { try { const x = new URL(u, base); x.search = ''; x.hash = ''; return x.href; } catch { return String(u); } };
  const realFetch = opts.fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
  const files = new Map();      // absolute url -> Uint8Array
  const A = {
    ready: false, sealed: false, total: 0, done: 0, fromCache: 0, fromNet: 0, stored: false, storeError: null, late: 0, lateUrls: [], manifest: null, ms: 0,
    voice: null,
    bytes: (u) => files.get(abs(u)) || null,
    seal() { A.sealed = true; },
  };
  const types = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', json: 'application/json' };
  /** fetch() answers preloaded URLs from memory; after seal(), refuses audio that was not preloaded */
  A.installFetch = () => {
    if (!realFetch || A._shim) return;
    const underAudio = abs('audio/');
    A._shim = function (input, init) {
      let u = null;
      try { u = abs(typeof input === 'string' ? input : input && input.url ? input.url : String(input)); } catch { u = null; }
      const b = u && files.get(u);
      if (b && (!init || !init.method || init.method === 'GET')) {
        const ext = u.slice(u.lastIndexOf('.') + 1).toLowerCase();
        return Promise.resolve(new Response(new Blob([b], { type: types[ext] || 'application/octet-stream' }), { status: 200, headers: { 'Content-Type': types[ext] || 'application/octet-stream', 'Content-Length': String(b.byteLength) } }));
      }
      if (A.sealed && u && u.startsWith(underAudio)) {
        A.late++; if (A.lateUrls.length < 20) A.lateUrls.push(u);
        if (A.late === 1) console.warn('[assets] not preloaded, refused (nothing is fetched during play): ' + u + ' — add it to tools/pack_assets.mjs GROUPS');
        return Promise.resolve(new Response('', { status: 404, statusText: 'not preloaded' }));
      }
      return realFetch(input, init);
    };
    globalThis.fetch = A._shim;
  };

  /** download (or take from the device) everything in the manifest. onProgress(doneBytes, totalBytes, A) */
  A.preload = async (onProgress = null) => {
    const t0 = performance.now();
    if (!realFetch) return A;
    let M = null;
    try { const r = await realFetch(abs('audio/assets.json') + '?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) M = await r.json(); } catch { M = null; }
    if (!M || !Array.isArray(M.groups)) { console.warn('[assets] no audio/assets.json (run tools/pack_assets.mjs): sounds are fetched as they are needed, as before'); A.missing = true; return A; }
    A.manifest = M;
    const list = [];
    for (const g of M.groups) for (const f of [...(g.files || []), ...(g.packs || []), ...(g.index ? [g.index] : [])]) list.push(f);
    A.total = list.reduce((s, f) => s + f.b, 0);
    const tell = () => { if (onProgress) { try { onProgress(A.done, A.total, A); } catch { /* */ } } };
    tell();
    // the device's copy (Cache Storage), if there is such a thing here
    let cache = null;
    try { if (typeof caches !== 'undefined' && caches.open) cache = await caches.open(CACHE); } catch (e) { cache = null; A.storeError = String(e && e.message || e); }
    const keyOf = (f) => abs(f.u) + '?h=' + f.h;
    if (cache) { try { const want = new Set(list.map(keyOf)); for (const req of await cache.keys()) if (!want.has(req.url)) await cache.delete(req); } catch { /* */ } }
    A.stored = !!cache;
    let next = 0, failed = 0;
    const one = async (f) => {
      const key = keyOf(f); let buf = null;
      if (cache) { try { const hit = await cache.match(key); if (hit) { const ab = await hit.arrayBuffer(); if (ab.byteLength === f.b) { buf = new Uint8Array(ab); A.fromCache += f.b; A.done += f.b; tell(); } else await cache.delete(key); } } catch { buf = null; } }
      if (!buf) {
        for (let attempt = 0; attempt < 3 && !buf; attempt++) {
          let got = 0;
          try {
            const r = await realFetch(key); if (!r.ok) throw new Error('HTTP ' + r.status);
            const out = new Uint8Array(f.b);
            if (r.body && r.body.getReader) {
              const rd = r.body.getReader();
              for (;;) { const { done, value } = await rd.read(); if (done) break; if (got + value.length > f.b) throw new Error('longer than the manifest says'); out.set(value, got); got += value.length; A.done += value.length; A.fromNet += value.length; tell(); }
            } else { const ab = new Uint8Array(await r.arrayBuffer()); if (ab.length !== f.b) throw new Error('size'); out.set(ab); got = ab.length; A.done += got; A.fromNet += got; tell(); }
            if (got !== f.b) throw new Error('shorter than the manifest says');
            buf = out;
          } catch (e) { A.done -= got; A.fromNet -= got; tell(); if (attempt === 2) { failed++; console.warn('[assets] could not download ' + f.u, e && e.message || e); } else await new Promise((res) => setTimeout(res, 400 * (attempt + 1))); }
        }
        // (kept on the device for next time; a refused quota only means it is downloaded again next visit)
        if (buf && cache) { try { await cache.put(key, new Response(new Blob([buf]), { headers: { 'Content-Length': String(buf.byteLength) } })); } catch (e) { A.stored = false; A.storeError = String(e && e.message || e); cache = null; } }
      }
      if (buf) files.set(abs(f.u), buf);
    };
    const worker = async () => { while (next < list.length) await one(list[next++]); };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    // the voice packs' index: id -> [pack, offset, length]
    for (const g of M.groups) if (g.packs && g.index) {
      try {
        const ib = files.get(abs(g.index.u)), ix = ib && JSON.parse(new TextDecoder().decode(ib)), map = new Map(), packs = g.packs.map((p) => files.get(abs(p.u)) || null);
        if (ix) ix.packs.forEach((p, pi) => { let off = 0; for (let i = 0; i < p.ids.length; i++) { map.set(p.ids[i], [pi, off, p.len[i]]); off += p.len[i]; } });
        const V = { clips: map.size, has: (id) => map.has(id) && !!packs[map.get(id)[0]],
          /** a clip's mp3 bytes, a fresh ArrayBuffer each time (decodeAudioData takes it away) */
          clip: (id) => { const e = map.get(id), p = e && packs[e[0]]; return p ? p.buffer.slice(p.byteOffset + e[1], p.byteOffset + e[1] + e[2]) : null; } };
        if (g.name === 'voice') A.voice = V; (A.packs || (A.packs = {}))[g.name] = V;
        files.delete(abs(g.index.u));
      } catch (e) { console.warn('[assets] index of ' + g.name, e); }
    }
    A.failed = failed; A.ready = true; A.ms = Math.round(performance.now() - t0);
    A.held = [...files.values()].reduce((s, b) => s + b.byteLength, 0);
    return A;
  };
  return A;
}
