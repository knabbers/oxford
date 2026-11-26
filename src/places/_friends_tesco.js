// Lorenzo's Tesco run, inside Tesco Metro, Magdalen Street (owned by places/friends.js; the shop is supermarkets.js).
// Everything is a function of the visit time t (seconds since the trip start, from the SHARED clock via
// _friends_logic.js tescoTrips), so every player in the shop sees the same moment: he walks in, goes down the snacks
// aisle, sees the Jaffa Cakes ("Might as well."), takes a box, scans it at a self-checkout and walks out.
// Like the Earl kitchen scene (_friends_dippers.js), the shop actor is a separate character in the interior scene; the
// outdoor Lorenzo is hidden while he is "in Tesco" (friends.js). Hidden when anyone is playing Lorenzo.
import * as THREE from 'three';
import { createCharacter } from '../core/characters.js';
import { lookFor } from './_people.js';
import { SHOP_ID, SHOP_S, buildShopTrack, shopLines, trackAt } from './_friends_logic.js';

const STORE = 'tesco_magdalen';
// Route through the Tesco Metro ground floor (_shop_layouts.js), clear of the baskets, the closed till, the
// self-checkout bank and where the assistant stands. The Jaffa Cakes bay itself is read from the built shelves.
const ROUTE = {
  door: [0, -1.0], hall: [-0.2, -3.6], mid: [-0.5, -9.4], mouth: [-2.1, -10.6],
  back: [[-2.1, -11.2], [-0.6, -9.4], [-0.6, -4.2], [-1.7, -3.45]], sco: 3, exit: [[-0.5, -3.8], [0, -2.6]],
};

function jaffaBox() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#1a3a8a'; g.fillRect(0, 0, 64, 32);
  g.fillStyle = '#f07a1a'; g.beginPath(); g.arc(46, 18, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 9px sans-serif'; g.fillText('Jaffa', 4, 13); g.fillText('Cakes', 4, 25);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.05), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.castShadow = false; m.name = 'friends:jaffa';
  return m;
}

export class TescoVisit {
  /** opts: { people, voices, taken(id) } */
  constructor(game, opts) {
    this.game = game; this.o = opts;
    this.ch = null; this.attached = null; this.B = null; this.box = null;
    this.a = { visible: false, x: 0, z: 0, h: 0, pose: 'stand', speed: 0, seg: -1 };
    this.prevT = -1; this.prevKey = null; this.lines = null; this.beepT = 0;
  }
  /** named moments of the visit (seconds), once the shop has been built */
  events() { return this.B ? { ...this.B.ev, T: +this.B.T.toFixed(2) } : null; }
  resetLines(t) { this.prevT = t; this.prevKey = null; }

  _build(scene, R) {
    const bays = R.bays.filter((b) => b.id === 'jaffa' && Math.abs(b.y) < 0.5);
    // a Jaffa Cakes bay a few metres down an aisle (so he can see them coming), nearest the front of the shop
    const deep = bays.filter((b) => b.z < ROUTE.mouth[1] - 4).sort((a, b) => b.z - a.z);
    const bay = deep[0] || bays[0] || { x: -1.6, z: -16 };
    const ax = ROUTE.mouth[0], side = Math.sign(bay.x - ax) || 1;          // the shelf is beyond the bay point
    const sco = R.scos[Math.min(ROUTE.sco, R.scos.length - 1)];
    const scoStand = sco ? [sco.x, sco.z] : [-2.7, -3.68];
    const look = [ax, Math.min(ROUTE.mouth[1], bay.z + 2.6)];
    const W = {
      inPath: [ROUTE.door, ROUTE.hall, ROUTE.mid, ROUTE.mouth, look], look,
      bay: [bay.x, bay.z], bayH: side * Math.PI / 2, back: [[ax, bay.z + 1.2], ...ROUTE.back], sco: scoStand,
      scoH: sco ? Math.atan2(sco.unit[0] - sco.x, sco.unit[1] - sco.z) : Math.PI, outPath: [...ROUTE.exit, ROUTE.door],
    };
    const B = buildShopTrack(W);
    if (B.T > SHOP_S) console.warn('[friends] Tesco visit longer than the slot', B.T.toFixed(1));
    this.B = B; this.lines = shopLines(B); this.W = W;
    const ch = (this.ch = createCharacter(lookFor('lorenzo')));
    ch.setLabel(this.o.people.lorenzo.label); ch.group.visible = false;
    scene.add(ch.group); this.attached = scene;
    this.box = jaffaBox(); this.box.visible = false; scene.add(this.box);
  }

  /** cur = { t, key, debug } or null; called every frame by friends.js */
  update(dt, cur) {
    const game = this.game;
    if (game.player.place !== SHOP_ID) { this.prevT = -1; if (this.ch) this.ch.group.visible = false; return; }
    const def = game.interiors.get(SHOP_ID), rec = game.supermarkets && game.supermarkets.stores && game.supermarkets.stores[STORE];
    if (!def || !def.scene || !rec || !rec.R) return;
    if (this.attached !== def.scene) { try { this._build(def.scene, rec.R); } catch (e) { console.warn('[friends] tesco build', e); this.attached = def.scene; return; } }
    if (!this.ch) return;
    const ch = this.ch, g = ch.group, B = this.B;
    const t = cur ? cur.t : -1;
    const a = cur ? trackAt(B.tr, t, this.a) : null;
    const vis = !!a && a.visible && !this.o.taken('lorenzo');
    g.visible = vis;
    this.box.visible = false;
    if (!vis) { this.prevT = t; return; }
    const y = rec.ground ? rec.ground(a.x, a.z) : 0;
    g.position.set(a.x, y, a.z);
    let dh = a.h - g.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    g.rotation.y += dh * Math.min(1, dt * 9);
    if (ch.pose !== a.pose) ch.setPose(a.pose);
    // looks along the shelf at the Jaffa Cakes while he decides
    const pl = game.player.pos;
    let yaw = 0;
    if (t >= B.ev.jaffa - 0.2 && t < B.ev.take) { const w = Math.atan2(this.W.bay[0] - a.x, this.W.bay[1] - a.z) - g.rotation.y; yaw = Math.max(-1.2, Math.min(1.2, Math.atan2(Math.sin(w), Math.cos(w)))); }
    ch.headTurn(yaw);
    ch.update(dt, a.speed);
    // reaching for the box at the shelf: right arm forward and up
    if (ch.bones && t >= B.ev.take - 1.0 && t < B.ev.take + 0.3) {
      const k = Math.min(1, (t - (B.ev.take - 1.0)) / 0.35, (B.ev.take + 0.3 - t) / 0.3);
      ch.bones.armR.rotation.x = -1.25 * k + ch.bones.armR.rotation.x * (1 - k);
    }
    // the box: in his right hand from the shelf to the door
    if (t >= B.ev.take && ch.anchors && ch.anchors.handR) {
      ch.anchors.handR.getWorldPosition(this.box.position);
      this.box.position.y -= 0.02;
      this.box.rotation.set(0, g.rotation.y, 0);
      this.box.visible = true;
    }
    // lines (fire as t passes them; never replayed after a jump)
    if (cur.key !== this.prevKey || t < this.prevT || t - this.prevT > 3) { this.prevT = cur.debug ? t - 0.5 : t; this.prevKey = cur.key; }
    for (const L of this.lines) {
      if (!(L[0] > this.prevT && L[0] <= t)) continue;
      ch.say(L[2], cur.debug ? 40 : Math.max(L[3], ((this.o.voices && this.o.voices.duration('lorenzo', L[2])) || 0) + 0.6));
      if (this.o.voices) this.o.voices.say('lorenzo', L[2], Math.hypot(pl.x - a.x, pl.z - a.z), true, { pos: ch.group.position, ch });
    }
    this.prevT = t;
    // self-checkout beeps while he scans (cosmetic, only when you are close)
    if (t >= B.ev.scan0 && t < B.ev.scan1 && (this.beepT -= dt) <= 0) {
      this.beepT = 1.7;
      if (Math.hypot(pl.x - a.x, pl.z - a.z) < 12) { try { game.audio.tone(1950, 0.08, { type: 'square', gain: 0.04 }); } catch (e) { /* audio not started */ } }
    }
  }
}
