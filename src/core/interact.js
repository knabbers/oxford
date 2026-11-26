// "Press E" interaction points. Anything in the game that can be used registers one here.
import * as THREE from 'three';

export class Interact {
  constructor(game) { this.game = game; this.items = new Set(); this.current = null; }

  /**
   * add({ place, pos, radius, label, onUse, enabled, key })
   *  place   'world' (default) or an interior id
   *  pos     [x, z] (any height) | [x, y, z] | THREE.Vector3 | () => THREE.Vector3 (for moving things)
   *  radius  metres (default 2)
   *  label   string | () => string   shown as "[E] label"
   *  onUse   () => void
   *  enabled optional () => boolean
   *  key     'E' (default) or 'F'
   * Returns a handle with .remove().
   */
  add(o) {
    const it = { place: 'world', radius: 2, key: 'E', ...o };
    // a 2-element pos has no height: it works on whatever floor the player is on (an upstairs room, a raised library
    // floor, raked seating); a 3-element pos / Vector3 / function is matched within 3 m of height as before
    if (Array.isArray(it.pos)) { if (it.pos.length === 2) it.anyY = true; it.pos = it.pos.length === 2 ? new THREE.Vector3(it.pos[0], 0, it.pos[1]) : new THREE.Vector3(...it.pos); }
    it.remove = () => this.items.delete(it);
    this.items.add(it);
    return it;
  }

  update() {
    const g = this.game, p = g.player;
    this.current = null;
    if (p.frozen || g.activity || p.vehicle) { g.ui.prompt(null); return; }
    let best = null, bestD = Infinity;
    for (const it of this.items) {
      if (it.place !== p.place) continue;
      if (p.swim && !it.swim) continue;             // swimming: only what can be done from the water (systems/swim.js)
      if (it.enabled && !it.enabled()) continue;
      const q = typeof it.pos === 'function' ? it.pos() : it.pos;
      if (!q) continue;          // (a position not there just now — someone gone home: one such item used to throw every frame)
      const d = Math.hypot(q.x - p.pos.x, q.z - p.pos.z);
      if (d < it.radius && (it.anyY || Math.abs((q.y || 0) - p.pos.y) < 3) && d < bestD) { best = it; bestD = d; }
    }
    this.current = best;
    if (!best) { g.ui.prompt(null); return; }
    g.ui.prompt(typeof best.label === 'function' ? best.label() : best.label, best.key);
    if (g.input.hit('Key' + best.key)) { g.input.pressed.delete('Key' + best.key); best.onUse(); }
  }
}
