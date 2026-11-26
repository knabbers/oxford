// Supermarkets: DOM bits — the basket HUD, the self-checkout minigame (canvas overlay) and the inventory panel.
import { PRODUCTS, productName, money, createScan, scanStep, scanPress, isFood } from './_shop_data.js';
import { BRAND } from './_shop_tex.js';

const css = (el, s) => { el.style.cssText = s; return el; };

/** Small basket list under the money display. */
export function createHud() {
  const el = css(document.createElement('div'), 'position:fixed;right:14px;top:84px;width:250px;background:rgba(12,14,18,.78);color:#f2f2f2;font:13px/1.35 Arial,sans-serif;border-radius:6px;padding:8px 10px;display:none;z-index:20;pointer-events:none;border-left:4px solid #00539f');
  document.body.appendChild(el);
  let sig = '';
  return {
    el,
    update(basket, brand, visible) {
      const s = visible && basket && basket.count ? brand + basket.items.map((i) => i.id + i.price).join() : '';
      if (s === sig) return; sig = s;
      if (!s) { el.style.display = 'none'; return; }
      el.style.display = 'block'; el.style.borderLeftColor = brand === 'tesco' ? BRAND.tesco.blue : BRAND.sainsburys.orange;
      const lines = basket.lines(), md = basket.mealDeals();
      const shown = lines.slice(-8).map((l) => `<div style="display:flex;justify-content:space-between;gap:8px"><span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${l.reduced ? '<span style="background:#ffe600;color:#000;padding:0 3px;border-radius:2px">R</span> ' : ''}${esc(l.name.replace(/^(Tesco Everyday Value|Tesco|Sainsbury's basics|Sainsbury's) /, ''))}</span><span>${money(l.price)}</span></div>`).join('');
      el.innerHTML = `<div style="font-weight:bold;margin-bottom:3px">Basket (${basket.count})</div>${lines.length > 8 ? `<div style="opacity:.6">… ${lines.length - 8} more</div>` : ''}${shown}`
        + (md.n ? `<div style="display:flex;justify-content:space-between;color:#9fe39f"><span>Meal deal × ${md.n}</span><span>−${money(md.saving)}</span></div>` : '')
        + `<div style="display:flex;justify-content:space-between;border-top:1px solid #555;margin-top:4px;padding-top:3px;font-weight:bold"><span>Total</span><span>${money(basket.total)}</span></div>`;
    },
  };
}
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * Self-checkout minigame. o = { basket, brand, atlasCanvas, uv(id) -> [u0,v0,u1,v1], beep(), buzz(), say(text),
 *   onStall(), onResume(), pay() -> {ok, msg}, alcoholCheck() -> 'ok'|'refuse', rng }
 * Returns the controller (also stored on game.supermarkets.sco for test hooks).
 */
export function openSco(game, o) {
  const B = BRAND[o.brand], col = o.brand === 'tesco' ? B.blue : B.orange;
  const s = createScan(o.basket.items.map((i) => i.id), { rng: o.rng || Math.random });
  const ctl = { s, done: false, paid: false, payMsg: '', alcohol: o.basket.hasAlcohol() };
  game.beginActivity({
    name: 'shop-sco', pointer: 'free', hint: 'Self-checkout: press SPACE when the barcode is over the scanner',
    update(dt) {
      const prev = s.state;
      scanStep(s, dt);
      if (prev === 'stall' && s.state !== 'stall') { o.onResume && o.onResume(); o.beep(); }
      if (s.state === 'pay' && ctl.alcohol && !ctl.ageChecked) { ctl.ageChecked = true; const r = o.alcoholCheck(); ctl.ageMsg = r.msg; if (r.removed) s.items = s.items.filter((id) => !PRODUCTS[id].alcohol), s.scanned = s.scanned.filter((id) => !PRODUCTS[id].alcohol); }
      draw();
    },
    onKey(code) {
      if (code === 'Space') ctl.press();
      else if ((code === 'Enter' || code === 'NumpadEnter') && s.state === 'pay') ctl.pay();
    },
    onEnd() { ctl.done = true; if (game.supermarkets) game.supermarkets.sco = null; o.onEnd && o.onEnd(ctl); },
  });
  ctl.press = () => {
    const r = scanPress(s);
    if (r === 'beep') o.beep();
    else if (r === 'miss') o.buzz();
    else if (r === 'stall') { o.beep(); setTimeout(() => { o.buzz(); o.say('Unexpected item in the bagging area.'); }, 250); o.onStall && o.onStall(); }
    return r;
  };
  ctl.pay = () => {
    if (s.state !== 'pay' || ctl.paid) return false;
    const r = o.pay(); ctl.payMsg = r.msg;
    if (r.ok) { ctl.paid = true; o.say('Thank you for shopping at ' + (o.brand === 'tesco' ? 'Tesco' : "Sainsbury's") + '.'); setTimeout(() => { if (game.activity && game.activity.name === 'shop-sco') game.endActivity(); }, 1600); }
    else o.buzz();
    return r.ok;
  };
  const ov = game.ui.openOverlay({ dim: true });
  const cv = css(document.createElement('canvas'), 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:10px;box-shadow:0 8px 40px #000;max-width:96vw');
  cv.width = 760; cv.height = 470; ov.appendChild(cv);
  cv.addEventListener('mousedown', () => { if (s.state === 'pay') ctl.pay(); else ctl.press(); });
  const g = cv.getContext('2d');
  function draw() {
    const W = cv.width, H = cv.height;
    g.fillStyle = '#1b1e22'; g.fillRect(0, 0, W, H);
    // screen (left)
    g.fillStyle = s.state === 'stall' ? '#f0a020' : col; g.fillRect(16, 16, 300, H - 32);
    g.fillStyle = '#fff'; g.font = 'bold 18px Arial'; g.textAlign = 'left';
    g.fillText(s.state === 'stall' ? 'Please wait' : s.state === 'pay' ? (ctl.paid ? 'Thank you' : 'Please pay') : 'Scan your items', 30, 44);
    g.fillStyle = '#ffffff'; g.fillRect(28, 58, 276, H - 150);
    g.fillStyle = '#222'; g.font = '13px Arial';
    const list = s.scanned.slice(-14); let y = 78;
    for (const id of list) { const n = productName(id, o.brand).replace(/^(Tesco Everyday Value|Tesco|Sainsbury's basics|Sainsbury's) /, ''); g.fillText(n.length > 28 ? n.slice(0, 27) + '…' : n, 36, y); g.textAlign = 'right'; g.fillText(money(priceOf(id)), 296, y); g.textAlign = 'left'; y += 19; }
    const sub = s.scanned.reduce((a, id) => a + priceOf(id), 0);
    g.fillStyle = '#fff'; g.font = 'bold 16px Arial'; g.fillText(`${s.scanned.length} of ${s.items.length} items`, 30, H - 66);
    g.fillText('Total ' + money(s.state === 'pay' ? o.basket.total : Math.round(sub * 100) / 100), 30, H - 42);
    // scan area (right)
    const cx = 540, cy = 220, scale = 180;
    g.fillStyle = '#2a2e33'; g.fillRect(340, 16, W - 356, H - 32);
    g.fillStyle = '#0c1014'; g.fillRect(cx - s.win * scale - 30, cy - 70, s.win * scale * 2 + 60, 140);   // glass
    g.strokeStyle = 'rgba(255,40,40,.85)'; g.lineWidth = 2; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(cx - s.win * scale, cy + k * 22); g.lineTo(cx + s.win * scale, cy - k * 22); g.stroke(); }
    g.fillStyle = '#aab2ba'; g.font = '12px Arial'; g.textAlign = 'center'; g.fillText('scanner', cx, cy + 92);
    if (s.state === 'scan') {
      const id = s.items[s.idx], x = cx + s.x * scale, yy = cy + s.y * 60;
      g.save(); g.translate(x, yy); g.rotate((s.wob || 0) * 1.5);
      const t = o.uv(id); if (t && o.atlasCanvas) { const AW = o.atlasCanvas.width, AH = o.atlasCanvas.height; g.drawImage(o.atlasCanvas, t[0] * AW, (1 - t[3]) * AH, (t[2] - t[0]) * AW, (t[3] - t[1]) * AH, -55, -55, 110, 110); }
      else { g.fillStyle = PRODUCTS[id].col; g.fillRect(-55, -55, 110, 110); }
      // barcode at the item's "wobble" point
      g.fillStyle = '#fff'; g.fillRect(-26, 30, 52, 22); g.fillStyle = '#000'; for (let i = 0; i < 18; i++) if ((i * 7) % 3) g.fillRect(-23 + i * 2.6, 32, 1.6, 15);
      g.restore();
      g.fillStyle = '#fff'; g.font = '14px Arial'; g.fillText(productName(id, o.brand), cx, 50);
    }
    if (s.state === 'stall') {
      g.fillStyle = 'rgba(240,160,32,.92)'; g.fillRect(352, cy - 60, W - 380, 120);
      g.fillStyle = '#111'; g.font = 'bold 22px Arial'; g.fillText('Unexpected item', cx, cy - 18); g.fillText('in the bagging area', cx, cy + 10);
      g.font = '14px Arial'; g.fillText('An assistant is on the way…', cx, cy + 40);
    }
    if (s.state === 'pay') {
      g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.fillText(ctl.paid ? 'Paid — please take your receipt' : `Press ENTER to pay ${money(o.basket.total)} by card`, cx, cy - 6);
      const md = o.basket.mealDeals(); g.font = '15px Arial';
      if (md.n) { g.fillStyle = '#9fe39f'; g.fillText(`Meal deal saving −${money(md.saving)}`, cx, cy + 24); }
      if (ctl.ageMsg) { g.fillStyle = '#ffd27a'; g.fillText(ctl.ageMsg, cx, cy + 50); }
      if (ctl.payMsg && !ctl.paid) { g.fillStyle = '#ff8080'; g.fillText(ctl.payMsg, cx, cy + 76); }
    }
    g.fillStyle = s.msg && s.state !== 'stall' ? '#ffd27a' : '#aab2ba'; g.font = '13px Arial'; g.fillText(s.msg || 'SPACE (or click) to scan · ENTER to pay · ESC to walk away', cx, H - 28);
  }
  const priceOf = (id) => { const it = o.basket.items.find((i) => i.id === id); return it ? it.price : PRODUCTS[id].price; };
  draw();
  return ctl;
}

/** Inventory panel. api = { items(), energy(), use(i) -> string } */
export function openInventory(game, api) {
  let sel = 0;
  game.beginActivity({
    name: 'shop-inventory', pointer: 'free',
    onKey(code) {
      const n = api.items().length;
      if (code === 'KeyI') { game.endActivity(); return; }
      if (code === 'ArrowDown' || code === 'KeyS') sel = Math.min(n - 1, sel + 1);
      else if (code === 'ArrowUp' || code === 'KeyW') sel = Math.max(0, sel - 1);
      else if (code === 'KeyE' || code === 'Enter') { if (n) { msg = api.use(sel); sel = Math.min(sel, api.items().length - 1); } }
      render();
    },
  });
  const ov = game.ui.openOverlay({ dim: false });
  const box = css(document.createElement('div'), 'position:absolute;left:24px;top:50%;transform:translateY(-50%);width:330px;max-height:70vh;overflow:auto;background:rgba(14,16,20,.92);color:#eee;font:14px/1.4 Arial,sans-serif;border-radius:8px;padding:12px 14px;border:1px solid #444');
  ov.appendChild(box);
  let msg = '';
  function render() {
    const items = api.items(), e = api.energy();
    box.innerHTML = `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:16px"><span>Inventory</span><span>Energy ${Math.round(e)}</span></div>`
      + `<div style="height:6px;background:#333;border-radius:3px;margin:6px 0 10px"><div style="height:6px;width:${Math.max(0, Math.min(100, e))}%;background:${e > 30 ? '#6c6' : '#e84'};border-radius:3px"></div></div>`
      + (items.length ? '' : '<div style="opacity:.6">Nothing yet — buy something at Tesco or Sainsbury\'s.</div>')
      + items.map((it, i) => `<div data-i="${i}" style="padding:4px 6px;border-radius:4px;cursor:pointer;display:flex;justify-content:space-between;${i === sel ? 'background:#2d4a6a' : ''}"><span>${esc(it.name)}${it.paid === false ? ' <span style="color:#f88">(nicked)</span>' : ''}</span><span style="opacity:.7">${PRODUCTS[it.id]?.alcohol ? 'drink' : isFood(it.id) ? 'eat' : it.id === 'bigissue' || it.id === 'paper' ? 'read' : ''}</span></div>`).join('')
      + `<div style="margin-top:10px;opacity:.65;font-size:12px">W/S select · E use · I or Esc close</div>`
      + (msg ? `<div style="margin-top:6px;color:#ffd27a">${esc(msg)}</div>` : '');
    for (const el of box.querySelectorAll('[data-i]')) el.onclick = () => { sel = +el.dataset.i; msg = api.use(sel); sel = Math.min(sel, api.items().length - 1); render(); };
  }
  render();
}
