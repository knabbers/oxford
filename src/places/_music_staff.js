// Scrolling grand-staff display for sight-reading (canvas 2D). Draws clefs, key and time signature (fixed header),
// bar lines, note heads with stems, flags or beams, dots, ledger lines, accidentals (per bar, per staff, against the
// key signature), ties and rests. Everything is drawn with paths (no music font needed). Owned by music_faculty.js.

const SHARP_T = [38, 35, 39, 36, 33, 37, 34], SHARP_B = [24, 21, 25, 22, 19, 23, 20];
const FLAT_T = [34, 37, 33, 36, 32, 35, 31], FLAT_B = [20, 23, 19, 22, 18, 21, 17];
const SHARP_ORDER = 'FCGDAEB', FLAT_ORDER = 'BEADGCF';
const STAFF = { t: { bottom: 30, mid: 34 }, b: { bottom: 18, mid: 22 } };

/** key signature alterations: letter -> -1/0/1 */
export function keyAlter(fifths) {
  const k = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (fifths > 0) for (let i = 0; i < fifths; i++) k[SHARP_ORDER[i]] = 1;
  else for (let i = 0; i < -fifths; i++) k[FLAT_ORDER[i]] = -1;
  return k;
}

/** Work out which note heads need a printed accidental (per bar, per staff). Mutates elements: el.acc[i] = null|-1|0|1|2 */
export function assignAccidentals(compiled) {
  const key = keyAlter(compiled.piece.fifths || 0);
  const byBar = new Map();
  for (const el of compiled.elements) { const k = el.bar + el.staff; if (!byBar.has(k)) byBar.set(k, []); byBar.get(k).push(el); }
  for (const list of byBar.values()) {
    list.sort((a, b) => a.t - b.t);
    const cur = new Map();
    for (const el of list) {
      el.acc = el.pitches.map((p) => {
        const id = p.letter + p.octave, now = cur.has(id) ? cur.get(id) : key[p.letter];
        if (el.tieIn.includes(p.midi)) { cur.set(id, p.acc); return null; }
        cur.set(id, p.acc);
        return now === p.acc ? null : p.acc;
      });
    }
  }
}

export class StaffView {
  constructor(canvas) { this.cv = canvas; this.g = canvas.getContext('2d'); this.c = null; this.dpr = 1; }

  setPiece(compiled) {
    this.c = compiled;
    if (!compiled) return;
    assignAccidentals(compiled);
    const minDur = Math.min(...compiled.elements.filter((e) => !e.rest).map((e) => e.dur));
    this.ppb = minDur <= 0.25 ? 92 : minDur <= 0.5 ? 70 : 56;
    // per voice: element order, beams, tie targets, stem directions
    const byVoice = new Map();
    for (const el of compiled.elements) { if (!byVoice.has(el.voice)) byVoice.set(el.voice, []); byVoice.get(el.voice).push(el); }
    const t8 = compiled.piece.time[1] === 8 && compiled.piece.time[0] % 3 === 0;
    const beatLen = t8 ? 1.5 : 1;
    for (const list of byVoice.values()) {
      list.sort((a, b) => a.t - b.t);
      list.forEach((el, i) => { el.next = list[i + 1] || null; el.beam = null; });
      // stems
      for (const el of list) {
        if (el.rest) continue;
        const mid = STAFF[el.staff].mid;
        const avg = el.pitches.reduce((s, p) => s + p.step, 0) / el.pitches.length;
        el.up = el.stem === 'up' ? true : el.stem === 'down' ? false : avg < mid;
      }
      // beams: runs of < quarter notes within one beat group
      let run = [];
      const flush = () => { if (run.length > 1) { const grp = { els: run }; let up = run[0].stem; if (up === 'auto') { const avg = run.reduce((s, e) => s + e.pitches.reduce((q, p) => q + p.step, 0) / e.pitches.length, 0) / run.length; up = avg < STAFF[run[0].staff].mid; } else up = up === 'up'; for (const e of run) { e.beam = grp; e.up = up; } } run = []; };
      for (const el of list) {
        const bar = compiled.bars[el.bar], rel = el.t - bar.t0 + (el.bar === 0 && compiled.piece.pickup ? compiled.barLen - compiled.piece.pickup : 0);
        const beat = Math.floor(rel / beatLen + 1e-6);
        const ok = !el.rest && el.dur < 1 - 1e-6;
        if (!ok) { flush(); continue; }
        if (run.length && (run[0].bar !== el.bar || run[0]._beat !== beat)) flush();
        el._beat = beat; run.push(el);
      }
      flush();
    }
  }

  resize(wCss, hCss, dpr = 1) {
    this.dpr = dpr; this.cv.width = Math.round(wCss * dpr); this.cv.height = Math.round(hCss * dpr);
    this.cv.style.width = wCss + 'px'; this.cv.style.height = hCss + 'px';
    this.W = wCss; this.H = hCss;
  }

  /**
   * tNow: scroll position in beats. opts: { cursorT (beats) — the group to play now, state(note) -> 'hit'|'miss'|null,
   * title, info (right-aligned text), countIn }
   */
  draw(tNow, opts = {}) {
    const g = this.g, W = this.W, H = this.H, c = this.c;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, W, H);
    if (!c) return;
    const sp = Math.max(7, Math.min(10, (H - 70) / 14)), tTop = 34, bTop = tTop + sp * 4 + sp * 5.2;
    const yLine = (staff, step) => (staff === 't' ? tTop + 4 * sp : bTop + 4 * sp) - (step - STAFF[staff].bottom) * sp / 2;
    this._sp = sp;
    const head = 92 + Math.abs(c.piece.fifths || 0) * sp * 0.9 + 30, playX = head + 70, ppb = this.ppb;
    const X = (t) => playX + (t - tNow) * ppb;
    const ink = '#1b1a18';
    // title
    g.fillStyle = '#5a4a32'; g.font = `italic 13px Georgia, serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(opts.title || `${c.piece.title} — ${c.piece.composer}`, 12, 16);
    if (opts.info) { g.textAlign = 'right'; g.fillStyle = '#3a3226'; g.font = `13px Georgia, serif`; g.fillText(opts.info, W - 12, 16); }
    // staff lines
    g.strokeStyle = ink; g.lineWidth = 1;
    for (const top of [tTop, bTop]) for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(10, top + i * sp + 0.5); g.lineTo(W - 10, top + i * sp + 0.5); g.stroke(); }
    // --- scrolling content (clipped to the right of the header)
    g.save(); g.beginPath(); g.rect(head, 0, W - head, H); g.clip();
    // playhead band
    const cx = opts.cursorT !== undefined ? X(opts.cursorT) : playX;
    g.fillStyle = 'rgba(70,130,220,0.12)'; g.fillRect(cx - 9, tTop - sp * 2, 18, bTop + sp * 6 - tTop);
    // bar lines
    g.lineWidth = 1.2; g.strokeStyle = ink;
    const tMin = tNow - (playX - head) / ppb - 1, tMax = tNow + (W - playX) / ppb + 1;
    c.bars.forEach((b, i) => {
      if (i === 0) return;
      const x = X(b.t0) - sp * 0.9; if (x < head - 4 || x > W + 4) return;
      g.beginPath(); g.moveTo(x, tTop); g.lineTo(x, bTop + 4 * sp); g.stroke();
      g.fillStyle = '#8a7a60'; g.font = '10px Georgia, serif'; g.textAlign = 'left'; g.fillText(String(c.piece.pickup ? i : i + 1), x + 2, tTop - 6);
    });
    { const xe = X(c.length) - sp * 0.9; if (xe < W) { g.fillStyle = ink; g.fillRect(xe, tTop, 1.2, bTop + 4 * sp - tTop); g.fillRect(xe + 3, tTop, 3.5, bTop + 4 * sp - tTop); } }
    // elements
    for (const el of c.elements) {
      if (el.t < tMin - 2 || el.t > tMax) continue;
      const x = X(el.t);
      if (el.rest) { this._rest(g, el, x, yLine, ink); continue; }
      this._note(g, el, x, yLine, ink, opts);
    }
    // beams on top
    const seen = new Set();
    for (const el of c.elements) if (el.beam && !seen.has(el.beam) && el.t > tMin - 2 && el.t < tMax) { seen.add(el.beam); this._beam(g, el.beam, X, yLine, opts); }
    g.restore();
    // --- header: brace, clefs, key, time
    g.fillStyle = '#f6f1e4'; g.fillRect(0, tTop - 2 * sp, head - 1, bTop + 7 * sp - tTop);
    g.strokeStyle = ink; g.lineWidth = 1;
    for (const top of [tTop, bTop]) for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(10, top + i * sp + 0.5); g.lineTo(head, top + i * sp + 0.5); g.stroke(); }
    g.fillRect(10, tTop, 1.5, bTop + 4 * sp - tTop);
    this._brace(g, 4, tTop, bTop + 4 * sp);
    this._trebleClef(g, 26, yLine('t', 32), sp);
    this._bassClef(g, 24, yLine('b', 24), sp);
    const f = c.piece.fifths || 0;
    for (let i = 0; i < Math.abs(f); i++) {
      const x = 62 + i * sp * 0.9;
      this._accidental(g, x, yLine('t', (f > 0 ? SHARP_T : FLAT_T)[i]), f > 0 ? 1 : -1, sp, ink);
      this._accidental(g, x, yLine('b', (f > 0 ? SHARP_B : FLAT_B)[i]), f > 0 ? 1 : -1, sp, ink);
    }
    const tx = 66 + Math.abs(f) * sp * 0.9 + 8;
    g.fillStyle = ink; g.font = `bold ${Math.round(sp * 2.3)}px Georgia, "Times New Roman", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const top of [tTop, bTop]) { g.fillText(String(c.piece.time[0]), tx, top + sp * 1.05); g.fillText(String(c.piece.time[1]), tx, top + sp * 3.05); }
    if (opts.countIn) { g.fillStyle = 'rgba(200,60,40,0.9)'; g.font = 'bold 28px Georgia, serif'; g.fillText(String(opts.countIn), playX, tTop + sp * 6.8); }
  }

  _color(el, i, opts, ink) {
    const midi = el.pitches[i].midi, n = el.noteFor ? el.noteFor[midi] : null;
    const st = n && opts.state ? opts.state(n) : null;
    if (st === 'hit') return '#2f8a3a';
    if (st === 'miss') return '#c8402a';
    if (opts.cursorT !== undefined && n && Math.abs(n.t - opts.cursorT) < 1e-6 && (!opts.practised || opts.practised(n))) return '#1f5fd0';
    if (opts.practised && n && !opts.practised(n)) return '#8a8278';
    return ink;
  }

  _note(g, el, x, yLine, ink, opts) {
    const sp = this._sp, hw = sp * 0.62, hh = sp * 0.44;
    const ys = el.pitches.map((p) => yLine(el.staff, p.step));
    const steps = el.pitches.map((p) => p.step);
    const filled = el.dur < 2 - 1e-6, stem = el.dur < 4 - 1e-6, up = el.up;
    // ledger lines
    g.strokeStyle = ink; g.lineWidth = 1.1;
    const S = STAFF[el.staff].bottom;
    for (const st of steps) {
      if (st <= S - 2) for (let l = S - 2; l >= st; l -= 2) { const y = yLine(el.staff, l); g.beginPath(); g.moveTo(x - hw * 1.7, y); g.lineTo(x + hw * 1.7, y); g.stroke(); }
      if (st >= S + 10) for (let l = S + 10; l <= st; l += 2) { const y = yLine(el.staff, l); g.beginPath(); g.moveTo(x - hw * 1.7, y); g.lineTo(x + hw * 1.7, y); g.stroke(); }
    }
    // heads (seconds flipped to the other side of the stem)
    const order = steps.map((s, i) => i).sort((a, b) => steps[a] - steps[b]);
    const offs = new Array(steps.length).fill(0);
    for (let k = 1; k < order.length; k++) if (steps[order[k]] - steps[order[k - 1]] === 1 && offs[order[k - 1]] === 0) offs[up ? order[k] : order[k - 1]] = up ? hw * 2 : -hw * 2;
    el.pitches.forEach((p, i) => {
      const col = this._color(el, i, opts, ink), hx = x + offs[i], y = ys[i];
      g.save(); g.translate(hx, y); g.rotate(-0.32);
      g.beginPath(); g.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      if (filled) { g.fillStyle = col; g.fill(); } else { g.strokeStyle = col; g.lineWidth = 1.8; g.stroke(); }
      g.restore();
      if (el.acc && el.acc[i] !== null && el.acc[i] !== undefined) this._accidental(g, hx - hw * 2.4, y, el.acc[i], sp, col);
      if (/\./.test(el.code)) { const onLine = (p.step - STAFF[el.staff].bottom) % 2 === 0; g.fillStyle = col; g.beginPath(); g.arc(hx + hw * 1.9, y - (onLine ? sp / 2 : 0), 1.8, 0, 7); g.fill(); }
      // tie to the next element
      if (el.tieOut && el.next) {
        const nx = (el.next.t - el.t) * this.ppb + x;
        g.strokeStyle = col; g.lineWidth = 1.3; const d = up ? 1 : -1;
        g.beginPath(); g.moveTo(hx + hw, y + d * hh * 1.4); g.quadraticCurveTo((hx + nx) / 2, y + d * sp * 1.5, nx - hw, y + d * hh * 1.4); g.stroke();
      }
    });
    if (!stem) return;
    const top = Math.min(...ys), bot = Math.max(...ys);
    const sx = up ? x + hw * 0.92 : x - hw * 0.92;
    let y0 = up ? bot : top, y1 = up ? top - sp * 3.4 : bot + sp * 3.4;
    if (el.beam) { el._sx = sx; el._sy0 = y0; el._sy1 = y1; return; }       // beam pass draws the stem
    const col = this._color(el, 0, opts, ink);
    // stems reach at least the middle line
    const midY = yLine(el.staff, STAFF[el.staff].mid);
    if (up && y1 > midY) y1 = midY; if (!up && y1 < midY) y1 = midY;
    g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath(); g.moveTo(sx, y0); g.lineTo(sx, y1); g.stroke();
    const nFlags = el.dur <= 0.375 ? 2 : el.dur < 1 - 1e-6 ? 1 : 0;
    for (let k = 0; k < nFlags; k++) {
      const fy = y1 + (up ? 1 : -1) * k * sp * 0.85, d = up ? 1 : -1;
      g.beginPath(); g.moveTo(sx, fy); g.bezierCurveTo(sx + sp * 0.2, fy + d * sp * 1.0, sx + sp * 1.4, fy + d * sp * 1.4, sx + sp * 0.9, fy + d * sp * 2.6);
      g.bezierCurveTo(sx + sp * 1.1, fy + d * sp * 1.7, sx + sp * 0.5, fy + d * sp * 1.4, sx, fy + d * sp * 1.1); g.fillStyle = col; g.fill();
    }
  }

  _beam(g, grp, X, yLine, opts) {
    const sp = this._sp, els = grp.els, up = els[0].up, first = els[0], last = els[els.length - 1];
    if (first._sx === undefined || last._sx === undefined) return;
    let ya = first._sy1, yb = last._sy1;
    const dx = Math.max(1, last._sx - first._sx);
    let slope = (yb - ya) / dx; slope = Math.max(-0.18, Math.min(0.18, slope)) * 0.5;
    // keep every stem at least 2.6 spaces long
    let shift = 0;
    for (const e of els) { const yl = ya + slope * (e._sx - first._sx); const need = up ? e._sy0 - sp * 2.6 : e._sy0 + sp * 2.6; if (up && yl + shift > need) shift = need - yl; if (!up && yl + shift < need) shift = need - yl; }
    const yAt = (x) => ya + shift + slope * (x - first._sx);
    const ink = '#1b1a18';
    for (const e of els) { g.strokeStyle = this._color(e, 0, opts, ink); g.lineWidth = 1.3; g.beginPath(); g.moveTo(e._sx, e._sy0); g.lineTo(e._sx, yAt(e._sx)); g.stroke(); }
    const th = sp * 0.48, d = up ? 1 : -1;
    const bar = (x0, x1, off) => { g.beginPath(); g.moveTo(x0, yAt(x0) + d * off); g.lineTo(x1, yAt(x1) + d * off); g.lineTo(x1, yAt(x1) + d * (off + th)); g.lineTo(x0, yAt(x0) + d * (off + th)); g.closePath(); g.fill(); };
    g.fillStyle = ink; bar(first._sx - 0.6, last._sx + 0.6, 0);
    const lvl = (e) => (e.dur <= 0.375 ? 2 : 1);
    els.forEach((e, i) => {
      if (lvl(e) < 2) return;
      const nx = els[i + 1], pv = els[i - 1];
      if (nx && lvl(nx) >= 2) bar(e._sx, nx._sx, sp * 0.78);
      else if (!(pv && lvl(pv) >= 2)) { const toward = pv ? -1 : 1; bar(toward < 0 ? e._sx - sp * 1.1 : e._sx, toward < 0 ? e._sx : e._sx + sp * 1.1, sp * 0.78); }
    });
    for (const e of els) { e._sx = undefined; }
  }

  _rest(g, el, x, yLine, ink) {
    const sp = this._sp, c = this.c;
    const full = Math.abs(el.dur - c.bars[el.bar].len) < 1e-6 && el.dur >= c.barLen - 1e-6;
    const multi = c.piece.voices.filter((v) => v.staff === el.staff).length > 1;
    const vo = multi ? (c.piece.voices[el.voice].stem === 'down' ? 2 : -2) : 0;
    const midY = yLine(el.staff, STAFF[el.staff].mid + vo);
    g.fillStyle = ink; g.strokeStyle = ink;
    let d = el.dur; if (/\./.test(el.code)) d /= 1.5;
    if (full) { const bx = x + (c.bars[el.bar].len * this.ppb) / 2 - sp * 1.2; g.fillRect(bx - sp * 0.6, midY - sp, sp * 1.2, sp * 0.5); return; }
    if (d >= 4 - 1e-6) g.fillRect(x - sp * 0.6, midY - sp, sp * 1.2, sp * 0.5);
    else if (d >= 2 - 1e-6) g.fillRect(x - sp * 0.6, midY - sp * 0.5, sp * 1.2, sp * 0.5);
    else if (d >= 1 - 1e-6) {
      g.lineWidth = sp * 0.32; g.lineCap = 'round'; g.beginPath();
      g.moveTo(x - sp * 0.3, midY - sp * 1.5); g.lineTo(x + sp * 0.3, midY - sp * 0.6); g.lineTo(x - sp * 0.25, midY + sp * 0.1); g.lineTo(x + sp * 0.3, midY + sp * 0.8);
      g.stroke(); g.lineWidth = sp * 0.22; g.beginPath(); g.moveTo(x + sp * 0.3, midY + sp * 0.8); g.quadraticCurveTo(x - sp * 0.6, midY + sp * 0.5, x - sp * 0.1, midY + sp * 1.4); g.stroke(); g.lineCap = 'butt';
    } else {
      const n = d <= 0.25 + 1e-6 ? 2 : 1;
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x + sp * 0.45, midY - sp * 0.8); g.lineTo(x - sp * 0.1 * n, midY + sp * (0.8 + 0.6 * (n - 1))); g.stroke();
      for (let k = 0; k < n; k++) { const yy = midY - sp * 0.8 + k * sp; g.beginPath(); g.arc(x - sp * 0.15, yy - sp * 0.05, sp * 0.26, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - sp * 0.15, yy + sp * 0.15); g.quadraticCurveTo(x + sp * 0.2, yy + sp * 0.25, x + sp * 0.45 - k * sp * 0.12, yy - sp * 0.0); g.stroke(); }
    }
    if (/\./.test(el.code)) { g.beginPath(); g.arc(x + sp * 0.9, midY - sp * 0.5, 1.8, 0, 7); g.fill(); }
  }

  _accidental(g, x, y, acc, sp, col) {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.1;
    if (acc === 1 || acc === 2) {
      for (const dx of [-sp * 0.2, sp * 0.2]) { g.beginPath(); g.moveTo(x + dx, y - sp * 1.2 + (dx > 0 ? -sp * 0.1 : 0)); g.lineTo(x + dx, y + sp * 1.2 + (dx > 0 ? -sp * 0.1 : 0)); g.stroke(); }
      g.lineWidth = sp * 0.26;
      for (const dy of [-sp * 0.35, sp * 0.35]) { g.beginPath(); g.moveTo(x - sp * 0.45, y + dy + sp * 0.12); g.lineTo(x + sp * 0.45, y + dy - sp * 0.12); g.stroke(); }
    } else if (acc === -1 || acc === -2) {
      g.beginPath(); g.moveTo(x - sp * 0.25, y - sp * 1.6); g.lineTo(x - sp * 0.25, y + sp * 0.45); g.stroke();
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - sp * 0.25, y + sp * 0.45); g.bezierCurveTo(x + sp * 0.9, y - sp * 0.2, x + sp * 0.3, y - sp * 0.75, x - sp * 0.25, y - sp * 0.15); g.stroke();
    } else {
      g.beginPath(); g.moveTo(x - sp * 0.25, y - sp * 1.2); g.lineTo(x - sp * 0.25, y + sp * 0.45); g.moveTo(x + sp * 0.25, y - sp * 0.45); g.lineTo(x + sp * 0.25, y + sp * 1.2); g.stroke();
      g.lineWidth = sp * 0.24; for (const dy of [-sp * 0.3, sp * 0.3]) { g.beginPath(); g.moveTo(x - sp * 0.25, y + dy + sp * 0.1); g.lineTo(x + sp * 0.25, y + dy - sp * 0.1); g.stroke(); }
    }
  }

  _trebleClef(g, x, yG, sp) {   // yG = the G4 line
    g.save(); g.strokeStyle = '#1b1a18'; g.lineCap = 'round';
    g.lineWidth = sp * 0.22; g.beginPath();
    // spiral around the G line, then up to the loop above the staff and down the spine
    g.moveTo(x + sp * 0.15, yG + sp * 0.15);
    g.bezierCurveTo(x - sp * 0.5, yG + sp * 0.2, x - sp * 0.45, yG - sp * 0.85, x + sp * 0.25, yG - sp * 0.8);
    g.bezierCurveTo(x + sp * 1.3, yG - sp * 0.6, x + sp * 1.2, yG + sp * 1.0, x + sp * 0.1, yG + sp * 1.05);
    g.bezierCurveTo(x - sp * 1.3, yG + sp * 1.0, x - sp * 1.2, yG - sp * 1.2, x + sp * 0.2, yG - sp * 2.4);
    g.bezierCurveTo(x + sp * 1.0, yG - sp * 3.2, x + sp * 1.1, yG - sp * 4.6, x + sp * 0.55, yG - sp * 4.9);
    g.bezierCurveTo(x + sp * 0.0, yG - sp * 4.8, x - sp * 0.1, yG - sp * 3.6, x + sp * 0.15, yG - sp * 2.6);
    g.lineTo(x + sp * 0.55, yG + sp * 2.0);
    g.bezierCurveTo(x + sp * 0.6, yG + sp * 2.7, x - sp * 0.1, yG + sp * 2.9, x - sp * 0.35, yG + sp * 2.4);
    g.stroke();
    g.fillStyle = '#1b1a18'; g.beginPath(); g.arc(x - sp * 0.2, yG + sp * 2.25, sp * 0.33, 0, 7); g.fill();
    g.restore();
  }

  _bassClef(g, x, yF, sp) {    // yF = the F3 line
    g.save(); g.fillStyle = '#1b1a18'; g.strokeStyle = '#1b1a18';
    g.beginPath(); g.arc(x + sp * 0.05, yF, sp * 0.38, 0, 7); g.fill();
    g.lineWidth = sp * 0.3; g.lineCap = 'round'; g.beginPath();
    g.moveTo(x - sp * 0.15, yF - sp * 0.1);
    g.bezierCurveTo(x - sp * 0.1, yF - sp * 1.2, x + sp * 1.6, yF - sp * 1.3, x + sp * 1.55, yF + sp * 0.2);
    g.bezierCurveTo(x + sp * 1.5, yF + sp * 1.4, x + sp * 0.5, yF + sp * 2.3, x - sp * 0.4, yF + sp * 2.8);
    g.stroke();
    for (const dy of [-sp * 0.5, sp * 0.5]) { g.beginPath(); g.arc(x + sp * 2.1, yF + dy, sp * 0.17, 0, 7); g.fill(); }
    g.restore();
  }

  _brace(g, x, y0, y1) {
    const m = (y0 + y1) / 2, w = 6;
    g.save(); g.fillStyle = '#1b1a18'; g.beginPath();
    g.moveTo(x + w, y0); g.bezierCurveTo(x - 2, y0 + (m - y0) * 0.3, x + w + 2, m - 10, x, m);
    g.bezierCurveTo(x + w + 2, m + 10, x - 2, y1 - (y1 - m) * 0.3, x + w, y1);
    g.bezierCurveTo(x + 1, y1 - (y1 - m) * 0.3, x + w * 0.9, m + 8, x + 1.5, m);
    g.bezierCurveTo(x + w * 0.9, m - 8, x + 1, y0 + (m - y0) * 0.3, x + w, y0); g.fill(); g.restore();
  }
}
