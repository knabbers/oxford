// Object3D.updateMatrixWorld without the wasted work (graphics pass 9). three recomposes every object's local matrix
// from position / quaternion / scale on every render, moved or not: with the world's ~4500 objects that was 2.2 ms a
// frame on the target machine (a 2016 MacBook Pro), more than the whole post chain. Here an object's matrix is
// recomposed only when its position, quaternion or scale differ from the values it was last composed from (ten
// compares), and the world matrix follows exactly as in three (matrixWorldNeedsUpdate / force). Everything else is
// three's own semantics: matrixAutoUpdate = false objects are left alone, subclasses that override updateMatrixWorld
// (cameras, skinned meshes, lights' helpers) still run their own code and reach this through super, and
// updateMatrix() / updateWorldMatrix() are untouched (a caller that wants a fresh matrix NOW still gets one).
// ?fastmx=0 keeps three's own function (A/B measurements).
import * as THREE from 'three';

export function installFastMatrix() {
  const P = THREE.Object3D.prototype;
  if (P.__gtoFastMatrix) return true;
  try { if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('fastmx') === '0') return false; } catch (e) { /* no location */ }
  P.__gtoFastMatrix = true;
  // HIDDEN SUBTREES ARE LEFT ALONE while a scene is being updated for a render (main-thread pass, 2026-11-23). Two thirds
  // of the outdoor scene's ~5,500 objects are hidden at any moment - pooled people and vehicles, the friends, far
  // places - and three walked every one of them every frame. When a SCENE is updated without `force` (what the
  // renderer does, once a render), a child with visible === false is not entered: it is marked, and the first time it
  // is entered again its whole subtree is recomposed whatever the flags say (its parents may have moved meanwhile).
  // Any other call - object.updateMatrixWorld() on a group, anything with force = true, updateWorldMatrix(),
  // getWorldPosition() - walks everything exactly as before. A hidden object whose matrices are still needed (a
  // character's skeleton under a rig that is only hidden from the draw lists) sets `_gtoMx = 1` and is always entered.
  // So: `object.matrixWorld` READ DIRECTLY from an object that is hidden in a rendered scene may be as it was when the
  // object was last shown; ask getWorldPosition() / updateWorldMatrix(true, false) there. `?mxskip=0`: off.
  let skipOk = true, skipping = false, depth = 0;
  try { if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('mxskip') === '0') skipOk = false; } catch (e) { /* no location */ }
  function step(o, force) {
    if (o.matrixAutoUpdate) {
      const p = o.position, q = o.quaternion, s = o.scale;
      let c = o._gtoTRS;
      if (c === undefined) { c = o._gtoTRS = new Float64Array(10); c[0] = NaN; }
      if (c[0] !== p.x || c[1] !== p.y || c[2] !== p.z || c[3] !== q._x || c[4] !== q._y || c[5] !== q._z || c[6] !== q._w || c[7] !== s.x || c[8] !== s.y || c[9] !== s.z) o.updateMatrix();
    }
    // (moved to another parent with the same local position: three would have recomputed the world matrix anyway)
    if (o._gtoPar !== o.parent) { o._gtoPar = o.parent; o.matrixWorldNeedsUpdate = true; }
    if (o._gtoSk === true) { o._gtoSk = false; force = true; }      // (left alone while hidden: everything under it again)
    if (o.matrixWorldNeedsUpdate || force) {
      if (o.matrixWorldAutoUpdate === true) {
        if (o.parent === null) o.matrixWorld.copy(o.matrix);
        else o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
      }
      o.matrixWorldNeedsUpdate = false;
      force = true;
    }
    const children = o.children;
    if (skipping) {
      for (let i = 0, l = children.length; i < l; i++) {
        const c = children[i];
        if (c.visible === false && c._gtoMx !== 1) { c._gtoSk = true; continue; }
        c.updateMatrixWorld(force);
      }
    } else for (let i = 0, l = children.length; i < l; i++) children[i].updateMatrixWorld(force);
  }
  P.updateMatrixWorld = function updateMatrixWorld(force) {
    if (depth !== 0) { step(this, force); return; }
    // the outermost call: a scene's own update for a render skips what is hidden; anything else walks it all
    skipping = skipOk && this.isScene === true && force !== true;
    depth = 1;
    try { step(this, force); } finally { depth = 0; skipping = false; }
  };
  /** measuring: is the hidden-subtree skip on; setSkip(false) walks everything again (A/B in one page) */
  installFastMatrix.skips = () => skipOk;
  installFastMatrix.setSkip = (v) => { skipOk = !!v; };
  // updateMatrix() records what it composed from (so an explicit call after a move is not repeated by the next render)
  const um = P.updateMatrix;
  P.updateMatrix = function updateMatrix() {
    um.call(this);
    const c = this._gtoTRS;
    if (c !== undefined) { const p = this.position, q = this.quaternion, s = this.scale; c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q._x; c[4] = q._y; c[5] = q._z; c[6] = q._w; c[7] = s.x; c[8] = s.y; c[9] = s.z; }
  };
  return true;
}
