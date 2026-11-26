// HUD: prompts, toasts, dialogue, objective, area banner, minimap, big map, minigame overlay, fades.
// The minimap and the big map are behind game.features (core/features.js): both off by default (no element shown, no
// per-frame drawing, the map raster is not even built); ?minimap=1 / ?map=1 bring them back. Blips are still kept.
import { pointInPoly } from './collision.js';
import { DEFAULTS as FEATURE_DEFAULTS } from './features.js';

const $ = (id) => document.getElementById(id);
const MAP_SCALE = 1.25; // px per metre in the pre-rendered map

export class UI {
  constructor(game) {
    this.game = game;
    this.el = { area: $('area'), clock: $('clock'), money: $('money'), objective: $('objective'), prompt: $('prompt'),
      toasts: $('toasts'), dialog: $('dialog'), speaker: $('dialog-speaker'), text: $('dialog-text'),
      overlay: $('overlay'), fade: $('fade'), minimap: $('minimap'), bigmap: $('bigmap'), bigcanvas: $('bigmap-canvas'),
      chatlog: $('chatlog'), chatinput: $('chatinput'), crosshair: $('crosshair') };
    this._dialog = null;
    this._area = ''; this._areaTimer = 0; this._siteCheck = 0;
    this.blips = [];            // {x,z,color,label,place?}
    this.mapImage = null; this._map = null;
    this.el.dialog.addEventListener('click', () => this.advanceDialog());
    this.applyFeatures();
  }

  get features() { return this.game.features || FEATURE_DEFAULTS; }
  /** Show / hide the minimap (and body.no-minimap for the layout that sits beside it), close the big map if it is off.
   *  Call again after changing game.features at runtime. */
  applyFeatures() {
    const f = this.features, mm = this.el.minimap;
    if (mm) mm.style.display = f.minimap ? '' : 'none';
    try { document.body.classList.toggle('no-minimap', !f.minimap); } catch { /* headless */ }
    if (!f.bigmap && this.el.bigmap) this.toggleBigMap(false);
    if (f.minimap || f.bigmap) this._ensureMapImage();
  }

  // ---- simple text widgets
  /** "Press E to ..." style prompt; pass null to hide. Normally driven by game.interact. */
  prompt(text, keyName = 'E') {
    const p = this.el.prompt;
    if (!text) { p.style.display = 'none'; return; }
    p.innerHTML = `<b>${keyName}</b>${text}`; p.style.display = 'block';
  }

  toast(text, seconds = 3.5) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = text;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), seconds * 1000);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }

  /** Persistent mission text top-left; null to clear. */
  objective(text) { this.el.objective.style.display = text ? 'block' : 'none'; this.el.objective.textContent = text || ''; }

  /** Big italic location banner bottom-right (fades after a few seconds). */
  area(name) {
    if (name === this._area) return;
    this._area = name;
    if (!name) { this.el.area.classList.remove('show'); return; }
    this.el.area.textContent = name; this.el.area.classList.add('show');
    this._areaTimer = 4;
  }

  /**
   * Dialogue box. lines: array of strings or {who, text}. Freezes the player until finished.
   * Returns a Promise resolved when the last line is dismissed.
   */
  dialog(speaker, lines, onDone) {
    return new Promise((resolve) => {
      this._dialog = { speaker, lines: [].concat(lines), i: 0, done: () => { onDone && onDone(); resolve(); } };
      this.game.player.frozen++;
      this.el.dialog.style.display = 'block';
      this._showLine();
    });
  }
  get inDialog() { return !!this._dialog; }
  _showLine() {
    const d = this._dialog, l = d.lines[d.i];
    this.el.speaker.textContent = (typeof l === 'object' && l.who) || d.speaker || '';
    this.el.text.textContent = typeof l === 'object' ? l.text : l;
  }
  advanceDialog() {
    const d = this._dialog;
    if (!d) return;
    if (++d.i < d.lines.length) return this._showLine();
    this._dialog = null;
    this.el.dialog.style.display = 'none';
    this.game.player.frozen--;
    d.done();
  }

  // ---- full-screen overlay for minigames / shop menus (DOM, pointer enabled)
  /** Opens (and clears) the overlay div and returns it. The caller fills it with DOM / a canvas. */
  openOverlay({ dim = true } = {}) {
    const o = this.el.overlay;
    o.innerHTML = ''; o.className = 'open'; o.style.background = dim ? 'rgba(5,7,10,.55)' : 'transparent';
    o.style.pointerEvents = 'auto';
    return o;
  }
  closeOverlay() { const o = this.el.overlay; o.innerHTML = ''; o.className = ''; }

  /** Fade to black, run fn (may be async), fade back. */
  async fade(fn) {
    this.el.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, 260));
    try { await fn(); } finally {
      await new Promise((r) => setTimeout(r, 60));
      this.el.fade.classList.remove('on');
    }
  }

  chat(name, text) {
    const d = document.createElement('div');
    const b = document.createElement('b'); b.textContent = name + ': ';
    d.appendChild(b); d.appendChild(document.createTextNode(text));
    this.el.chatlog.appendChild(d);
    setTimeout(() => d.remove(), 15000);
    while (this.el.chatlog.children.length > 7) this.el.chatlog.firstChild.remove();
  }

  /** Add a marker to the minimap / big map. Returns the blip; call game.ui.removeBlip(b) to delete. Blips are kept (and
   *  this API works) while both maps are switched off; they are simply not drawn anywhere. */
  addBlip(x, z, color = '#f3e7b3', label = '') { const b = { x, z, color, label }; this.blips.push(b); return b; }
  removeBlip(b) { this.blips = this.blips.filter((x) => x !== b); }

  // ---- map rendering
  /** Keep the map's sites (the area banner) and bounds; the raster for the minimap / big map is only drawn when one
   *  of them is on (it is a ~2900 x 3500 px canvas). */
  buildMap(map) {
    this._map = map; this.mapBounds = map.bounds; this.sites = map.sites;
    if (this.features.minimap || this.features.bigmap) this._ensureMapImage();
  }
  _ensureMapImage() {
    if (this.mapImage || !this._map) return this.mapImage;
    const map = this._map, b = map.bounds, S = MAP_SCALE;
    const c = document.createElement('canvas');
    c.width = Math.ceil((b.maxX - b.minX) * S); c.height = Math.ceil((b.maxZ - b.minZ) * S);
    const g = c.getContext('2d');
    const X = (x) => (x - b.minX) * S, Z = (z) => (z - b.minZ) * S;
    const path = (poly) => { g.moveTo(X(poly[0][0]), Z(poly[0][1])); for (let i = 1; i < poly.length; i++) g.lineTo(X(poly[i][0]), Z(poly[i][1])); g.closePath(); };
    g.fillStyle = '#2b3038'; g.fillRect(0, 0, c.width, c.height);
    const fills = { park: '#35553a', garden: '#3a5c3e', grass: '#3a5c3e', meadow: '#3f5f3c', pitch: '#417046', wood: '#2c4a30',
      scrub: '#33503a', parking: '#3a3f47', paved: '#4a4d52', flowerbed: '#5a5c3e', bridge: '#666', pier: '#666', sand: '#8a7f5a' };
    for (const a of map.areas) {
      if (a.kind === 'water') continue;
      g.fillStyle = fills[a.kind] || '#3a5c3e'; g.beginPath(); path(a.poly); for (const h of a.holes || []) path(h); g.fill('evenodd');
    }
    g.fillStyle = '#34608c';
    for (const a of map.areas) if (a.kind === 'water') { g.beginPath(); path(a.poly); for (const h of a.holes || []) path(h); g.fill('evenodd'); }
    g.strokeStyle = '#34608c'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const w of map.waterlines) { if (w.tunnel) continue; g.lineWidth = w.w * S; g.beginPath(); w.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.stroke(); }
    const foot = new Set(['footway', 'path', 'steps', 'cycleway', 'bridleway', 'track', 'corridor']);
    for (const pass of [0, 1]) {
      for (const r of map.roads) {
        const f = foot.has(r.kind);
        if ((pass === 0) !== f) continue;
        g.strokeStyle = f ? '#6b6a5c' : r.kind === 'pedestrian' ? '#8d8a80' : '#9aa0a8';
        g.lineWidth = Math.max(1, r.w * S * (f ? 0.6 : 1));
        g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.stroke();
      }
    }
    g.fillStyle = '#c9b88a';
    for (const bd of map.buildings) { if (bd.hasParts) continue; g.beginPath(); path(bd.poly); for (const h of bd.holes || []) path(h); g.fill('evenodd'); }
    // the map is a union of rectangles (map.boxes): shade what lies outside it (the corner north of the East Oxford extension)
    if (map.boxes && map.boxes.length > 1) {
      g.fillStyle = 'rgba(16,18,22,0.82)'; g.beginPath(); g.rect(0, 0, c.width, c.height);
      for (const q of map.boxes) g.rect(X(q.minX) - 0.5, Z(q.minZ) - 0.5, (q.maxX - q.minX) * S + 1, (q.maxZ - q.minZ) * S + 1);
      g.fill('evenodd');
    }
    this.mapImage = c;
    return c;
  }

  toggleBigMap(force) {
    const el = this.el.bigmap;
    let open = force !== undefined ? force : !el.classList.contains('open');
    if (!this.features.bigmap) open = false;          // the big map is off (game.features.bigmap; ?map=1)
    el.classList.toggle('open', open);
    if (open) { this._ensureMapImage(); this._drawBigMap(); }
    return open;
  }
  get bigMapOpen() { return this.el.bigmap.classList.contains('open'); }

  _drawBigMap() {
    if (!this.mapImage) return;
    const c = this.el.bigcanvas, img = this.mapImage, b = this.mapBounds, S = MAP_SCALE;
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    // the canvas is the whole map (~2900 x 3500 px) shown scaled down to fit the window, so labels and markers are
    // drawn k times larger to come out at a readable size on screen (they used to shrink to specks: no "You" marker)
    const k = this._mapK = Math.max(1, 1 / Math.min((innerWidth * 0.94) / img.width, (innerHeight * 0.94) / img.height));
    g.font = `600 ${Math.round(11 * k)}px Georgia`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2.5 * k; g.lineJoin = 'round';
    // college / department names, skipping any that would print over one already drawn
    const drawn = [];
    for (const s of this.sites || []) {
      if (s.kind !== 'university' && s.kind !== 'college') continue;
      const w = g.measureText(s.name).width / 2 + 3 * k, h = 8 * k;
      const x = Math.min(c.width - w, Math.max(w, (s.c[0] - b.minX) * S)), z = (s.c[1] - b.minZ) * S;   // kept inside the map edge
      if (drawn.some((d) => Math.abs(d[0] - x) < d[2] + w && Math.abs(d[1] - z) < d[3] + h)) continue;
      drawn.push([x, z, w, h]);
      g.strokeText(s.name, x, z); g.fillText(s.name, x, z);
    }
    for (const bl of this.blips) this._blip(g, (bl.x - b.minX) * S, (bl.z - b.minZ) * S, bl.color, 6 * k, bl.label);
    for (const o of this.game.net?.others?.values?.() || []) if (o.place === 'world') this._blip(g, (o.x - b.minX) * S, (o.z - b.minZ) * S, '#6cf', 5 * k, o.name);
    const p = this.game.player.worldPos;
    this._blip(g, (p.x - b.minX) * S, (p.z - b.minZ) * S, '#ff4040', 7 * k, 'You');
  }
  _blip(g, x, y, color, r, label) {
    const k = this._mapK || 1;
    g.fillStyle = color; g.strokeStyle = '#000'; g.lineWidth = 1.5 * k;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
    if (label) { g.font = `600 ${Math.round(12 * k)}px Arial`; g.textAlign = 'center'; g.lineWidth = 3 * k; g.strokeText(label, x, y - r - 4 * k); g.fillStyle = '#fff'; g.fillText(label, x, y - r - 4 * k); }
  }

  update(dt) {
    const game = this.game, p = game.player;
    // clock + money
    const h = game.time.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    this.el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    this.el.money.textContent = '£' + game.state.money.toFixed(2);
    if (this._areaTimer > 0 && (this._areaTimer -= dt) <= 0) this.el.area.classList.remove('show');
    // which named site are we standing in?
    if ((this._siteCheck -= dt) <= 0 && this.sites) {
      this._siteCheck = 0.5;
      if (p.place !== 'world') this.area(game.interiors.current?.name || '');
      else {
        let best = null;
        for (const s of this.sites) if (pointInPoly(p.pos.x, p.pos.z, s.poly) && (!best || s.poly.length < best.poly.length)) best = s;
        this.area(best ? best.name : '');
      }
    }
    // minimap: nothing at all to do while it is off (game.features.minimap; ?minimap=1)
    if (!this.features.minimap || !this.mapImage) return;
    const c = this.el.minimap, g = c.getContext('2d'), b = this.mapBounds, S = MAP_SCALE, R = c.width / 2;
    const wp = p.worldPos, zoom = p.vehicle ? 0.75 : 1.1;
    g.save(); g.clearRect(0, 0, c.width, c.height);
    g.beginPath(); g.arc(R, R, R, 0, 7); g.clip();
    g.fillStyle = '#20262e'; g.fillRect(0, 0, c.width, c.height);
    g.translate(R, R); g.rotate(game.cameraYaw + Math.PI); g.scale(zoom / S, zoom / S);
    g.translate(-(wp.x - b.minX) * S, -(wp.z - b.minZ) * S);
    g.drawImage(this.mapImage, 0, 0);
    const blip = (x, z, color, r) => { g.fillStyle = color; g.strokeStyle = '#000'; g.lineWidth = 1.5 * S / zoom; g.beginPath(); g.arc((x - b.minX) * S, (z - b.minZ) * S, r * S / zoom, 0, 7); g.fill(); g.stroke(); };
    for (const bl of this.blips) blip(bl.x, bl.z, bl.color, 5);
    for (const o of game.net?.others?.values?.() || []) if (o.place === 'world') blip(o.x, o.z, '#6cf', 4);
    g.restore();
    // player arrow (map is rotated so camera-forward is up; arrow shows facing relative to camera)
    g.save(); g.translate(R, R); g.rotate(game.cameraYaw - p.heading);
    g.fillStyle = '#ff4040'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // north marker
    g.save(); g.translate(R, R); g.rotate(game.cameraYaw + Math.PI);
    g.fillStyle = '#fff'; g.font = '700 12px Arial'; g.textAlign = 'center'; g.fillText('N', 0, -R + 14); g.restore();
  }
}
