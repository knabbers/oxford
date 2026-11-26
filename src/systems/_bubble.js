// A free-standing speech bubble (canvas sprite) for things that are not characters: bus passengers behind the windows,
// a voice from the back of a cab. One draw call while shown. bubble.say(text, secs); bubble.update(dt) each frame.
// bubble.speak(game, hint, text, secs): heard with a crowd voice (core/voice.js crowdSpeaker(hint)) when the line has a
// clip and voices are on; otherwise (or if the clip then fails) the bubble shows, as before.
import * as THREE from 'three';

export function makeBubble(scale = 1) {
  let cv = null, ctx = null;
  try { cv = document.createElement('canvas'); cv.width = 512; cv.height = 200; ctx = cv.getContext('2d'); } catch { /* headless */ }
  const tex = cv && cv.getContext ? new THREE.CanvasTexture(cv) : null;
  if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 10; sprite.visible = false; sprite.scale.set(3.3 * scale, 1.3 * scale, 1);
  let t = 0;
  return {
    sprite,
    get saying() { return t > 0; },
    say(text, secs = 3) {
      this._tok = (this._tok || 0) + 1;
      t = secs; sprite.visible = true;
      if (!ctx || !ctx.measureText) return;
      ctx.clearRect(0, 0, 512, 200);
      ctx.font = 'bold 30px sans-serif';
      const words = String(text).split(' '), lines = []; let line = '';
      for (const w of words) { const tr = line ? line + ' ' + w : w; if ((ctx.measureText(tr).width || tr.length * 15) > 440 && line) { lines.push(line); line = w; } else line = tr; }
      if (line) lines.push(line);
      if (lines.length > 3) { lines.length = 3; lines[2] += '…'; }
      let wm = 0; for (const l of lines) wm = Math.max(wm, ctx.measureText(l).width || l.length * 15);
      const bw = Math.min(496, wm + 40), bh = lines.length * 38 + 24, x0 = (512 - bw) / 2, y0 = 200 - bh - 26;
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, bw, bh, 18); else ctx.rect(x0, y0, bw, bh); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(240, y0 + bh - 2); ctx.lineTo(256, 196); ctx.lineTo(272, y0 + bh - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, 256, y0 + 31 + i * 38));
      if (tex) tex.needsUpdate = true;
    },
    speak(game, hint, text, secs = 3) {
      const V = game && game.voice;
      // (spatial sound: the voice comes from where the bubble is — a passenger behind a bus window, the back of a cab.
      //  The place is taken once, as the line starts; ch.height 0 = the bubble's own height, not a head above feet.)
      let pos = null; try { if (sprite.parent) { pos = sprite.getWorldPosition(this._wp || (this._wp = new THREE.Vector3())); if (!(isFinite(pos.x) && isFinite(pos.z))) pos = null; } } catch { pos = null; }
      const p = V && V.say && V.crowdSpeaker ? V.say(V.crowdSpeaker(hint), text, pos ? { channel: this, replace: true, pos, ch: { height: 0 } } : { channel: this, replace: true }) : null;
      if (!p || !p.clip) { this.say(text, secs); return false; }
      const tok = (this._tok = (this._tok || 0) + 1);
      t = Math.max(0.4, (p.dur || 0) + 0.15); sprite.visible = false;      // (saying while the clip plays; no bubble)
      p.then((r) => { if (r && !r.played && this._tok === tok) this.say(text, secs); }, () => { /* */ });
      return true;
    },
    update(dt) { if (t > 0 && (t -= dt) <= 0) sprite.visible = false; },
    hide() { t = 0; sprite.visible = false; },
    dispose() { sprite.removeFromParent(); if (tex) tex.dispose(); mat.dispose(); },
  };
}
