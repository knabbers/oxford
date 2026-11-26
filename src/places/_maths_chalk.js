// Blackboard text layout + chalk rendering (owned by places/maths.js).
// Layout is pure (no DOM): a deterministic width model so tools/smoke_maths.mjs can check that every frame fits the
// board, and the renderer draws each glyph at exactly the laid-out position (what is tested is what is drawn).
//
// Mini markup, one string per board line:
//   x_n  x_{n+1}   subscript        x^2  x^{n+1}   superscript      a_{k=1}^{n}  sub immediately followed by sup: stacked
//   [[num@den]]    fraction (num/den may contain sub/superscripts)
//   "# text"       heading (yellow chalk, underlined)        "* text"   statement in yellow chalk (theorems, axioms)

export const BOARD = { W: 1024, H: 400, MX: 28, MY: 8, LINES: 7, LINE_H: 54, FONT: 34, UNIT: 19.5 };
export const MAX_W = BOARD.W - 2 * BOARD.MX;

const NARROW = new Set([...".,:;'|!()[]1iIlj{}`"]);
const WIDE = new Set([...'mwMW∑∏⇒⟺⟹∞—…□≈⊆⊂']);
export function charW(ch) { return ch === ' ' ? 0.55 : NARROW.has(ch) ? 0.62 : WIDE.has(ch) ? 1.3 : 1.0; }

const SUB = 0.68, FR = 0.8;

/** Parse markup into a tree: [{t:'c', ch} | {t:'sub', k:[...]} | {t:'sup', k:[...]} | {t:'frac', n:[...], d:[...]}] */
export function parse(s) {
  let i = 0;
  function seq(stop) {
    const out = [];
    while (i < s.length) {
      if (stop && s.startsWith(stop, i)) return out;
      if (s.startsWith('[[', i)) {
        i += 2; const n = seq('@'); i += 1; const d = seq(']]'); i += 2;
        out.push({ t: 'frac', n, d }); continue;
      }
      const c = s[i];
      if (c === '_' || c === '^') { i++; out.push({ t: c === '_' ? 'sub' : 'sup', k: group() }); continue; }
      const cp = s.codePointAt(i); const ch = String.fromCodePoint(cp); i += ch.length;
      out.push({ t: 'c', ch });
    }
    return out;
  }
  function group() {
    if (s[i] === '{') { i++; const k = seq('}'); i++; return k; }
    const cp = s.codePointAt(i); const ch = String.fromCodePoint(cp); i += ch.length; return [{ t: 'c', ch }];
  }
  return seq(null);
}

/** Width (px) of a parsed sequence at scale s. */
function seqW(seq, s) {
  let w = 0;
  for (let j = 0; j < seq.length; j++) {
    const a = seq[j];
    if (a.t === 'c') w += charW(a.ch) * BOARD.UNIT * s;
    else if (a.t === 'frac') w += Math.max(seqW(a.n, s * FR), seqW(a.d, s * FR)) + 0.5 * BOARD.UNIT * s;
    else if (a.t === 'sub' && seq[j + 1] && seq[j + 1].t === 'sup') { w += Math.max(seqW(a.k, s * SUB), seqW(seq[j + 1].k, s * SUB)) + 0.1 * BOARD.UNIT * s; j++; }
    else w += seqW(a.k, s * SUB) + 0.08 * BOARD.UNIT * s;
  }
  return w;
}

/** Glyphs for a parsed sequence placed from (x, y = baseline) at scale s. Appends to out; returns end x. */
function place(seq, x, y, s, out, color) {
  const F = BOARD.FONT, U = BOARD.UNIT;
  for (let j = 0; j < seq.length; j++) {
    const a = seq[j];
    if (a.t === 'c') { const w = charW(a.ch) * U * s; if (a.ch !== ' ') out.push({ ch: a.ch, x: x + w / 2, y, size: F * s, color }); x += w; }
    else if (a.t === 'frac') {
      const wn = seqW(a.n, s * FR), wd = seqW(a.d, s * FR), w = Math.max(wn, wd) + 0.5 * U * s, bar = y - 0.3 * F * s;
      place(a.n, x + (w - wn) / 2, bar - 0.14 * F * s, s * FR, out, color);
      out.push({ rule: true, x0: x + 0.12 * U * s, x1: x + w - 0.12 * U * s, y: bar, size: F * s, color });
      place(a.d, x + (w - wd) / 2, bar + 0.64 * F * s * FR, s * FR, out, color);
      x += w;
    } else if (a.t === 'sub' && seq[j + 1] && seq[j + 1].t === 'sup') {
      const b = seq[j + 1], w1 = seqW(a.k, s * SUB), w2 = seqW(b.k, s * SUB);
      place(a.k, x, y + 0.3 * F * s, s * SUB, out, color);
      place(b.k, x, y - 0.5 * F * s, s * SUB, out, color);
      x += Math.max(w1, w2) + 0.1 * U * s; j++;
    } else if (a.t === 'sub') x = place(a.k, x, y + 0.28 * F * s, s * SUB, out, color) + 0.08 * U * s;
    else x = place(a.k, x, y - 0.42 * F * s, s * SUB, out, color) + 0.08 * U * s;
  }
  return x;
}

/** Lay out one line string. Returns {glyphs, width, kind}. y is the baseline (px from the board top). */
export function layoutLine(str, row) {
  let kind = 'text', s = str;
  if (s.startsWith('# ')) { kind = 'head'; s = s.slice(2); } else if (s.startsWith('* ')) { kind = 'stmt'; s = s.slice(2); }
  const color = kind === 'text' ? 0 : 1;
  const tree = parse(s), y = BOARD.MY + BOARD.LINE_H * row + 0.66 * BOARD.LINE_H, glyphs = [];
  const width = seqW(tree, 1);
  place(tree, BOARD.MX, y, 1, glyphs, color);
  if (kind === 'head') glyphs.push({ rule: true, x0: BOARD.MX, x1: BOARD.MX + width, y: y + 0.3 * BOARD.FONT, size: BOARD.FONT, color });
  return { glyphs, width, kind };
}

/** Lay out a whole frame (array of line strings). Returns {glyphs, lines:[{width}], ok, problems}. */
export function layoutFrame(lines) {
  const glyphs = [], out = [], problems = [];
  if (lines.length > BOARD.LINES) problems.push(`${lines.length} lines > ${BOARD.LINES}`);
  lines.forEach((l, r) => {
    const L = layoutLine(l, r); out.push({ width: L.width }); glyphs.push(...L.glyphs);
    if (L.width > MAX_W) problems.push(`line ${r + 1} is ${Math.round(L.width)} px > ${MAX_W}: "${l}"`);
  });
  for (const g of glyphs) if (!g.rule && (g.y - g.size * 0.8 < 0 || g.y + g.size * 0.3 > BOARD.H)) problems.push(`glyph '${g.ch}' outside the board vertically`);
  return { glyphs, lines: out, ok: problems.length === 0, problems };
}

/** Plain-text rendering of a frame (for boardsDump): markup stripped to a readable linear form. */
export function plainText(lines) {
  const flat = (seq) => seq.map((a) => a.t === 'c' ? a.ch : a.t === 'frac' ? `(${flat(a.n)})/(${flat(a.d)})` : a.t === 'sub' ? `_${a.k.length > 1 ? '{' + flat(a.k) + '}' : flat(a.k)}` : `^${a.k.length > 1 ? '{' + flat(a.k) + '}' : flat(a.k)}`).join('');
  return lines.map((l) => flat(parse(l.replace(/^[#*] /, '')))).join('\n');
}

// ------------------------------------------------------------------------------------------------ rendering (DOM)
export const CHALK_FONT = '"Chalkboard SE", "Chalkboard", "Bradley Hand", "Segoe Print", "Noteworthy", "Comic Sans MS", "Comic Neue", "Cambria Math", "STIX Two Math", "DejaVu Sans", cursive';
const COLORS = ['rgba(240,240,232,0.93)', 'rgba(246,228,140,0.93)'];
let speckle = null, scratchC = null;
function scratch() { if (!scratchC) { scratchC = document.createElement('canvas'); scratchC.width = scratchC.height = 72; } return scratchC; }
function speckleCanvas() {
  if (speckle) return speckle;
  speckle = document.createElement('canvas'); speckle.width = speckle.height = 128;
  const c = speckle.getContext('2d'), d = c.createImageData(128, 128);
  let a = 987654321; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; d.data[i + 3] = r() < 0.32 ? Math.floor(150 + r() * 105) : 0; }
  c.putImageData(d, 0, 0);
  return speckle;
}

/** Fresh slate: dark green-black with old chalk ghosts. */
export function clearBoard(ctx, seed = 1) {
  const { W, H } = BOARD;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#1d2a24'; ctx.fillRect(0, 0, W, H);
  let a = seed * 2654435761 >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  // smeared ghosts of erased chalk
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(200,210,200,${0.012 + r() * 0.02})`;
    ctx.beginPath(); ctx.ellipse(r() * W, r() * H, 60 + r() * 160, 12 + r() * 30, (r() - 0.5) * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.05})`; ctx.fillRect(r() * W, r() * H, 1.5, 1.5); }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
}

/** Draw glyphs [from, to) of a laid-out frame with a chalk texture. */
export function drawGlyphs(ctx, glyphs, from, to, seed = 0) {
  const sp = speckleCanvas();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (let i = from; i < to && i < glyphs.length; i++) {
    const g = glyphs[i], h = ((i * 92821 + seed * 68917) % 1000) / 1000, h2 = ((i * 31337 + seed * 7919) % 1000) / 1000;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = COLORS[g.color]; ctx.strokeStyle = COLORS[g.color];
    if (g.rule) {
      ctx.lineWidth = Math.max(1.5, g.size * 0.07); ctx.beginPath();
      ctx.moveTo(g.x0, g.y + (h - 0.5) * 1.5); ctx.lineTo(g.x1, g.y + (h2 - 0.5) * 1.5); ctx.stroke();
      continue;
    }
    // glyph drawn on a scratch canvas, speckles knocked out there (chalk grain), then stamped onto the board
    const S = scratch(), sc = S.getContext('2d'), n = S.width, sz = g.size;
    sc.globalCompositeOperation = 'source-over'; sc.clearRect(0, 0, n, n);
    sc.save(); sc.translate(n / 2, n * 0.68); sc.rotate((h - 0.5) * 0.08);
    sc.font = `${Math.round(sz)}px ${CHALK_FONT}`; sc.textAlign = 'center'; sc.textBaseline = 'alphabetic';
    sc.fillStyle = COLORS[g.color]; sc.fillText(g.ch, 0, 0); sc.restore();
    sc.globalCompositeOperation = 'destination-out'; sc.globalAlpha = 0.55;
    sc.drawImage(sp, Math.floor(h * 64), Math.floor(h2 * 64), 64, 64, 0, 0, n, n); sc.globalAlpha = 1;
    ctx.drawImage(S, g.x + (h - 0.5) * 1.2 - n / 2, g.y + (h2 - 0.5) * 1.6 - n * 0.68);
  }
  ctx.globalCompositeOperation = 'source-over';
}
