// Render-time size/distance culling for place-module content in the outdoor scene.
// Place modules add many small separate meshes (signs, props, fittings) that the GPU frustum-culls but never
// distance-culls, so the whole of central Oxford's hand-built detail was drawn from anywhere. Just before each render
// this hides module meshes that would be tiny on screen (bounding-sphere radius r further than max(MIN_D, r * K) from
// the camera; never things over BIG_R), and restores them straight after — modules never see their `visible` change.
// Shadow casting is trimmed the same way: small module meshes far from the camera don't cast.
// Characters (handled by their own LOD), instanced meshes, sprites and anything with frustumCulled=false are left alone.
// While flying (world.aerial) a mesh with userData.airFar (a landmark's far silhouette) is kept out to that distance.
// By graphics tier (TIER_K multiplies the four distances): as they were on low and medium; 1.6x on high and 2.3x on
// ultra, where small things are kept, and keep their shadows, much further out (the single set of numbers had been
// chosen to hold 60 fps on the 2016 laptop).
const K = 70, MIN_D = 60, BIG_R = 45, SHADOW_K = 12, SHADOW_MIN = 22, REFRESH = 90;
const TIER_K = { low: 1, medium: 1, high: 1.6, ultra: 2.3 };

export class RenderCull {
  constructor(game, owners) {
    this.game = game; this.owners = owners;       // Set of place-module ids whose content is culled
    this.items = []; this.hidden = []; this.unshadow = []; this.frame = 0; this.enabled = true;
    this.stats = { items: 0, culled: 0, unshadowed: 0 };
  }

  _collect() {
    const items = (this.items = []);
    const walk = (o) => {
      if (o.name === 'character' || o.isLight) return;
      if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.frustumCulled !== false && o.geometry) {
        const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        if (g.boundingSphere && Number.isFinite(g.boundingSphere.radius)) items.push({ m: o, x: 0, y: 0, z: 0, r: 0, cast: o.castShadow });
      }
      const ch = o.children;
      for (let i = 0; i < ch.length; i++) walk(ch[i]);
    };
    for (const o of this.game.worldScene.children) if (this.owners.has(o.userData.owner)) walk(o);
    this._spheres();
    this.stats.items = items.length;
  }

  _spheres() {
    for (const it of this.items) {
      const m = it.m, s = m.geometry.boundingSphere, e = m.matrixWorld.elements;
      const c = s.center;
      it.x = e[0] * c.x + e[4] * c.y + e[8] * c.z + e[12];
      it.y = e[1] * c.x + e[5] * c.y + e[9] * c.z + e[13];
      it.z = e[2] * c.x + e[6] * c.y + e[10] * c.z + e[14];
      const sx = e[0] * e[0] + e[1] * e[1] + e[2] * e[2], sy = e[4] * e[4] + e[5] * e[5] + e[6] * e[6], sz = e[8] * e[8] + e[9] * e[9] + e[10] * e[10];
      it.r = s.radius * Math.sqrt(Math.max(sx, sy, sz));
      it.cast = m.castShadow;
    }
  }

  /** Hide far small module meshes for this render (call after(), always, once the render is done). */
  before(camera) {
    if (!this.enabled || this.game.scene !== this.game.worldScene) return;
    const nKids = this.game.worldScene.children.length;
    if (this.frame++ % REFRESH === 0 && (nKids !== this._nKids || this.frame % (REFRESH * 8) === 1)) { this._nKids = nKids; this._collect(); }
    else if (this.frame % 30 === 0) this._spheres();       // things that move (vans, boats) keep a fresh sphere
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    const H = this.hidden, U = this.unshadow, air = !!(this.game.world && this.game.world.aerial);
    const q = this.game.quality, tk = (q && TIER_K[q.level]) || 1, K1 = K * tk, MIN1 = MIN_D * tk, SK1 = SHADOW_K * tk, SMIN1 = SHADOW_MIN * tk;
    for (let i = 0, n = this.items.length; i < n; i++) {
      const it = this.items[i], m = it.m;
      if (!m.visible || it.r > BIG_R) continue;
      const dx = it.x - cx, dy = it.y - cy, dz = it.z - cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz) - it.r;
      // (aerial: a landmark's far silhouette that asked for it — userData.airFar, places/_se_fine.js airKeep — stays out to that distance)
      if (d > Math.max(MIN1, it.r * K1) && !(air && m.userData.airFar && d < m.userData.airFar)) { m.visible = false; m._gtoMx = 1; H.push(m); }      // (_gtoMx: hidden for the draw only - its matrices are kept up: core/_fastmatrix.js)
      else if (m.castShadow && d > Math.max(SMIN1, it.r * SK1)) { m.castShadow = false; U.push(m); }
    }
    this.stats.culled = H.length; this.stats.unshadowed = U.length;
  }

  after() {
    const H = this.hidden, U = this.unshadow;
    for (let i = 0; i < H.length; i++) H[i].visible = true;
    for (let i = 0; i < U.length; i++) U[i].castShadow = true;
    H.length = 0; U.length = 0;
  }
}
