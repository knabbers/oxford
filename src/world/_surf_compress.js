// Surface fidelity, pass 3: texture MEMORY. The top tier's big painted atlases and the scanned layers were held on the
// GPU as RGBA8 (the facade atlas alone 298 MB with its mips) and their canvases / pixel arrays stayed in the page's
// memory as well. Here they are block-compressed in the browser as they are made — S3TC DXT1 (4 bits a pixel: an
// eighth of RGBA8) for opaque colour, DXT5 (8 bits) where the alpha channel carries something, RGTC2 / BC5 (8 bits)
// for the two-channel normal layers — with their mip chains built on the CPU (colour averaged in linear light), and
// the source canvas is emptied once the compressed data exists; the compressed data itself is dropped after upload.
// No transcoder, no worker, nothing fetched: a range-fit encoder (the block's colour box, its diagonal turned to
// follow the block's colour correlation, four points on it) at roughly 40-60 megapixels a second, run on the loading
// screen a strip at a time. Needs WEBGL_compressed_texture_s3tc (+ _srgb for colour, EXT_texture_compression_rgtc for
// normals: every desktop GPU); without them the callers keep their uncompressed textures. `?texc=0` switches it off.
import * as THREE from 'three';

// sRGB <-> linear as integers: LIN 0..4095, the sum of four >> 2 indexes TOS
const LIN = new Uint16Array(256); for (let i = 0; i < 256; i++) LIN[i] = Math.round(4095 * Math.pow(i / 255, 2.2));
const TOS = new Uint8Array(4096); for (let i = 0; i < 4096; i++) TOS[i] = Math.round(255 * Math.pow(i / 4095, 1 / 2.2));

/** which block formats this GPU takes: { dxt, srgb, rgtc } (all false under ?texc=0 or without WebGL2) */
export function compressSupport(R) {
  const off = (() => { try { return new URLSearchParams(location.search).get('texc') === '0'; } catch (e) { return false; } })();
  const E = R && R.extensions, has = (n) => { try { return !off && !!(E && E.has(n)); } catch (e) { return false; } };
  return { dxt: has('WEBGL_compressed_texture_s3tc'), srgb: has('WEBGL_compressed_texture_s3tc_srgb'), rgtc: has('EXT_texture_compression_rgtc') };
}

/** RGBA8 w x h -> the next mip (floor sizes, at least 1). srgb: the colour channels are averaged in linear light. */
export function halve(src, w, h, srgb) {
  const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), dst = new Uint8Array(nw * nh * 4), sx = w > 1 ? 1 : 0, sy = h > 1 ? w * 4 : 0, dx = sx * 4;
  for (let y = 0; y < nh; y++) {
    let i = (y * (h > 1 ? 2 : 1)) * w * 4, o = y * nw * 4;
    for (let x = 0; x < nw; x++, i += (w > 1 ? 8 : 4), o += 4) {
      const a = i, b = i + dx, c = i + sy, d = c + dx;
      if (srgb) {
        dst[o] = TOS[(LIN[src[a]] + LIN[src[b]] + LIN[src[c]] + LIN[src[d]] + 2) >> 2];
        dst[o + 1] = TOS[(LIN[src[a + 1]] + LIN[src[b + 1]] + LIN[src[c + 1]] + LIN[src[d + 1]] + 2) >> 2];
        dst[o + 2] = TOS[(LIN[src[a + 2]] + LIN[src[b + 2]] + LIN[src[c + 2]] + LIN[src[d + 2]] + 2) >> 2];
      } else {
        dst[o] = (src[a] + src[b] + src[c] + src[d] + 2) >> 2; dst[o + 1] = (src[a + 1] + src[b + 1] + src[c + 1] + src[d + 1] + 2) >> 2; dst[o + 2] = (src[a + 2] + src[b + 2] + src[c + 2] + src[d + 2] + 2) >> 2;
      }
      dst[o + 3] = (src[a + 3] + src[b + 3] + src[c + 3] + src[d + 3] + 2) >> 2;
    }
  }
  return { data: dst, w: nw, h: nh };
}

const PX = new Uint8Array(64);     // the block being encoded: 16 texels RGBA
function gather(src, w, h, bx, by) {
  if (bx + 4 <= w && by + 4 <= h) {      // a whole block: four native copies of a row each
    let s = (by * w + bx) * 4; const row = w * 4;
    PX.set(src.subarray(s, s + 16), 0); s += row; PX.set(src.subarray(s, s + 16), 16); s += row; PX.set(src.subarray(s, s + 16), 32); s += row; PX.set(src.subarray(s, s + 16), 48);
    return;
  }
  for (let j = 0; j < 4; j++) {
    const y = Math.min(h - 1, by + j) * w;
    for (let i = 0; i < 4; i++) { const s = (y + Math.min(w - 1, bx + i)) * 4, d = (j * 4 + i) * 4; PX[d] = src[s]; PX[d + 1] = src[s + 1]; PX[d + 2] = src[s + 2]; PX[d + 3] = src[s + 3]; }
  }
}
/** the colour block of DXT1 / DXT5 (8 bytes at out[o]) from PX */
function colourBlock(out, o) {
  let r0 = 255, g0 = 255, b0 = 255, r1 = 0, g1 = 0, b1 = 0;
  for (let k = 0; k < 64; k += 4) { const r = PX[k], g = PX[k + 1], b = PX[k + 2]; if (r < r0) r0 = r; if (r > r1) r1 = r; if (g < g0) g0 = g; if (g > g1) g1 = g; if (b < b0) b0 = b; if (b > b1) b1 = b; }
  if (r1 - r0 + g1 - g0 + b1 - b0 > 12) {
    // turn the box's diagonal to follow the block: where a channel falls as red (or the widest channel) rises, swap its ends
    const cr = (r0 + r1) / 2, cg = (g0 + g1) / 2, cb = (b0 + b1) / 2; let rg = 0, rb = 0, gb = 0;
    for (let k = 0; k < 64; k += 4) { const r = PX[k] - cr, g = PX[k + 1] - cg, b = PX[k + 2] - cb; rg += r * g; rb += r * b; gb += g * b; }
    if (r1 - r0 >= g1 - g0 || r1 - r0 >= b1 - b0) { if (rg < 0) { const t = g0; g0 = g1; g1 = t; } if (rb < 0) { const t = b0; b0 = b1; b1 = t; } }
    else if (gb < 0) { const t = b0; b0 = b1; b1 = t; }
    // inset a little: the four points then sit nearer the texels than the box's corners do
    const ir = (r1 - r0) >> 4, ig = (g1 - g0) / 16 | 0, ib = (b1 - b0) / 16 | 0; r0 += ir; r1 -= ir; g0 += ig; g1 -= ig; b0 += ib; b1 -= ib;
  }
  let c0 = ((r1 >> 3) << 11) | ((g1 >> 2) << 5) | (b1 >> 3), c1 = ((r0 >> 3) << 11) | ((g0 >> 2) << 5) | (b0 >> 3), bits = 0;
  if (c0 !== c1) {
    if (c0 < c1) { const t = c0; c0 = c1; c1 = t; }
    // the two ends as the GPU will decode them
    const e0r = ((c0 >> 11) * 527 + 23) >> 6, e0g = (((c0 >> 5) & 63) * 259 + 33) >> 6, e0b = ((c0 & 31) * 527 + 23) >> 6;
    const e1r = ((c1 >> 11) * 527 + 23) >> 6, e1g = (((c1 >> 5) & 63) * 259 + 33) >> 6, e1b = ((c1 & 31) * 527 + 23) >> 6;
    const dr = e0r - e1r, dg = e0g - e1g, db = e0b - e1b, len = dr * dr + dg * dg + db * db || 1;
    for (let k = 15; k >= 0; k--) {
      const t = ((PX[k * 4] - e1r) * dr + (PX[k * 4 + 1] - e1g) * dg + (PX[k * 4 + 2] - e1b) * db) / len;
      // codes: 0 = end 0, 1 = end 1, 2 = 2/3 towards end 0, 3 = 1/3
      bits = (bits << 2) | (t > 0.8333 ? 0 : t > 0.5 ? 2 : t > 0.1667 ? 3 : 1);
    }
  }
  out[o] = c0 & 255; out[o + 1] = c0 >> 8; out[o + 2] = c1 & 255; out[o + 3] = c1 >> 8;
  out[o + 4] = bits & 255; out[o + 5] = (bits >>> 8) & 255; out[o + 6] = (bits >>> 16) & 255; out[o + 7] = (bits >>> 24) & 255;
}
/** an alpha block of DXT5 / a channel block of RGTC (8 bytes at out[o]) from channel `ch` of PX */
function alphaBlock(out, o, ch) {
  let lo = 255, hi = 0;
  for (let k = ch; k < 64; k += 4) { const a = PX[k]; if (a < lo) lo = a; if (a > hi) hi = a; }
  out[o] = hi; out[o + 1] = lo;
  if (hi === lo) { out[o + 2] = out[o + 3] = out[o + 4] = out[o + 5] = out[o + 6] = out[o + 7] = 0; return; }
  // eight steps from hi (code 0) to lo (code 1); the six between are codes 2..7
  const k7 = 7 / (hi - lo); let b0 = 0, b1 = 0;       // two 24-bit halves of the 48 index bits
  for (let k = 0; k < 16; k++) {
    const s = ((hi - PX[k * 4 + ch]) * k7 + 0.5) | 0, code = s === 0 ? 0 : s === 7 ? 1 : s + 1;
    if (k < 8) b0 |= code << (3 * k); else b1 |= code << (3 * (k - 8));
  }
  out[o + 2] = b0 & 255; out[o + 3] = (b0 >> 8) & 255; out[o + 4] = (b0 >> 16) & 255; out[o + 5] = b1 & 255; out[o + 6] = (b1 >> 8) & 255; out[o + 7] = (b1 >> 16) & 255;
}
export const BLOCK_BYTES = { dxt1: 8, dxt5: 16, rgtc2: 16 };
/** encode RGBA8 (w x h, any size) into out at offset o; returns the bytes written */
export function encode(src, w, h, kind, out, o) {
  const bw = (w + 3) >> 2, bh = (h + 3) >> 2, start = o;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    gather(src, w, h, bx * 4, by * 4);
    if (kind === 'dxt1') { colourBlock(out, o); o += 8; }
    else if (kind === 'dxt5') { alphaBlock(out, o, 3); colourBlock(out, o + 8); o += 16; }
    else { alphaBlock(out, o, 0); alphaBlock(out, o + 8, 1); o += 16; }
  }
  return o - start;
}
/** one level: RGBA8 -> a new Uint8Array of blocks */
export function encodeLevel(src, w, h, kind) { const data = new Uint8Array(((w + 3) >> 2) * ((h + 3) >> 2) * BLOCK_BYTES[kind]); encode(src, w, h, kind, data, 0); return data; }
const levelBytes = (w, h, kind) => ((w + 3) >> 2) * ((h + 3) >> 2) * BLOCK_BYTES[kind];

/** the whole mip chain of one RGBA8 picture -> [{data, width, height}] (level 0 first) */
export function chain(src, w, h, kind, srgb) {
  const mips = [];
  for (;;) {
    const data = new Uint8Array(levelBytes(w, h, kind)); encode(src, w, h, kind, data, 0);
    mips.push({ data, width: w, height: h });
    if (w === 1 && h === 1) break;
    const n = halve(src, w, h, srgb); src = n.data; w = n.w; h = n.h;
  }
  return mips;
}

/**
 * A canvas (width and height multiples of 4) -> the mip chain, read and encoded a strip at a time so that the canvas's
 * pixels are never all in memory as an array. flipY: row 0 of the result is the canvas's BOTTOM row (what a
 * CanvasTexture with flipY uploads). Synchronous: 58 megapixels (the facade atlas) take a second or two.
 */
export function chainOfCanvas(canvas, kind, srgb, { flipY = true } = {}) {
  const W = canvas.width, H = canvas.height;
  // strips: the largest power of two (up to 1024) that divides the height; each strip is reduced on its own while
  // its height is still a multiple of 4, then the small remainder of the whole picture is finished in one piece
  let SH = 1024; while (SH > 4 && H % SH) SH >>= 1;
  const mips = []; let nLv = 0; for (let s = SH; s >= 4; s >>= 1) nLv++;
  for (let l = 0; l < nLv; l++) mips.push({ data: new Uint8Array(levelBytes(W >> l, H >> l, kind)), width: W >> l, height: H >> l });
  const tw = W >> (nLv - 1), th = H >> (nLv - 1), tail = new Uint8Array(tw * th * 4), nStrips = H / SH, offs = new Array(nLv).fill(0);
  // (memory pass, 2026-11-22: each strip is COPIED into a strip-sized canvas and read from that. Reading it from the
  // big canvas made Chrome read the whole canvas back from the GPU process through one shared block of the canvas's
  // size — 226 MB for the facade atlas — which stayed mapped in both processes for the life of the page. The bytes
  // read are the same ones: measured, and `?texverify=1`.)
  const strip = document.createElement('canvas'); strip.width = W; strip.height = SH;
  const g = strip.getContext('2d'); g.globalCompositeOperation = 'copy';
  for (let s = 0; s < nStrips; s++) {
    const y = flipY ? H - (s + 1) * SH : s * SH;
    g.drawImage(canvas, 0, y, W, SH, 0, 0, W, SH);
    let px = g.getImageData(0, 0, W, SH).data, w = W, h = SH;
    if (flipY) { const row = W * 4, tmp = new Uint8Array(row); for (let a = 0, b = (SH - 1) * row; a < b; a += row, b -= row) { tmp.set(px.subarray(a, a + row)); px.copyWithin(a, b, b + row); px.set(tmp, b); } }
    for (let l = 0; l < nLv; l++) {
      offs[l] += encode(px, w, h, kind, mips[l].data, offs[l]);
      if (l === nLv - 1) { tail.set(px.subarray(0, w * h * 4), s * h * w * 4); break; }
      const n = halve(px, w, h, srgb); px = n.data; w = n.w; h = n.h;
    }
  }
  strip.width = strip.height = 0;
  // the rest of the chain from the last strip level of the whole picture
  let src = tail, w = tw, h = th;
  while (w > 1 || h > 1) { const n = halve(src, w, h, srgb); src = n.data; w = n.w; h = n.h; const data = new Uint8Array(levelBytes(w, h, kind)); encode(src, w, h, kind, data, 0); mips.push({ data, width: w, height: h }); }
  return mips;
}

export const FMT = { dxt1: THREE.RGB_S3TC_DXT1_Format, dxt5: THREE.RGBA_S3TC_DXT5_Format, rgtc2: THREE.RED_GREEN_RGTC2_Format };
export function finishCompressed(t, { srgb = false, repeat = true, clampS = false, clampT = false, anisotropy = 16, name = '' }) {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = clampS || !repeat ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; t.wrapT = clampT || !repeat ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.anisotropy = anisotropy; t.name = name;
  t.userData.gpuBytes = t.mipmaps.reduce((s, m) => s + m.data.length, 0);
  // the compressed data is needed once: let go of it when the GPU has it (a lost WebGL context would need a reload)
  t.onUpdate = () => { for (const m of t.mipmaps) m.data = null; t.onUpdate = null; };
  t.needsUpdate = true;
  return t;
}
/** mip chain ([{data,width,height}]) -> THREE.CompressedTexture. opts: srgb, repeat / clampS / clampT, anisotropy, name */
export function compressedTexture(mips, kind, opts = {}) {
  return finishCompressed(new THREE.CompressedTexture(mips, mips[0].width, mips[0].height, FMT[kind]), opts);
}
/** per-layer chains (all the same size) -> THREE.CompressedArrayTexture */
export function compressedArray(chains, kind, opts = {}) {
  const n = chains.length, mips = chains[0].map((m, l) => {
    const one = m.data.length, data = new Uint8Array(one * n); for (let i = 0; i < n; i++) data.set(chains[i][l].data, i * one);
    return { data, width: m.width, height: m.height };
  });
  return finishCompressed(new THREE.CompressedArrayTexture(mips, mips[0].width, mips[0].height, n, FMT[kind]), opts);
}
/** let a canvas go once its texture is on the GPU (a texture this is used on must never be uploaded again) */
export function releaseCanvasAfterUpload(t) {
  const prev = t.onUpdate;
  t.onUpdate = (x) => { if (prev) prev(x); const c = t.image; t.userData.gpuBytes = t.userData.gpuBytes || Math.round(c.width * c.height * 4 * 4 / 3); try { if (c && c.getContext && c.width > 1) { t.userData.size = [c.width, c.height]; c.width = c.height = 1; } } catch (e) { /* */ } t.onUpdate = null; };
  return t;
}

/**
 * A canvas texture -> its block-compressed replacement (same wrapping and anisotropy), the canvas emptied and the
 * old texture disposed. Returns the texture given when the GPU lacks the format (cs from compressSupport).
 */
export function compressCanvasTexture(tex, kind, cs, name = '') {
  const srgb = tex.colorSpace === THREE.SRGBColorSpace, c = tex.image;
  if (!cs || !cs.dxt || (srgb && !cs.srgb) || !c || !c.getContext || c.width % 4 || c.height % 4) return tex;
  try {
    const mips = chainOfCanvas(c, kind, srgb, { flipY: tex.flipY !== false });
    const t = compressedTexture(mips, kind, { srgb, clampS: tex.wrapS === THREE.ClampToEdgeWrapping, clampT: tex.wrapT === THREE.ClampToEdgeWrapping, anisotropy: tex.anisotropy, name: name || tex.name });
    t.userData.size = [c.width, c.height]; t.userData.scale = tex.userData.scale;
    tex.dispose(); c.width = c.height = 1;
    return t;
  } catch (e) { console.warn('[surf] compress', name, e && e.message); return tex; }
}
