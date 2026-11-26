// Keyboard + mouse. Pointer lock for mouse-look. Other modules read game.input.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();        // currently held, by KeyboardEvent.code (e.g. 'KeyW', 'ShiftLeft', 'Space')
    this.pressed = new Set();     // went down this frame
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    this.mouseDown = false; this.clicked = false;
    this.mouseX = 0; this.mouseY = 0;   // page coords (useful when pointer is free)
    this.locked = false;
    this.typing = false;          // true while a text field has focus: game keys are ignored
    this.wantLock = false;        // set by game when gameplay should capture the mouse
    this._handlers = { keydown: [], click: [] };

    addEventListener('keydown', (e) => {
      if (this.typing) return;
      // keep Tab / Space / arrows working for the start screen's buttons (keyboard-only play-as picker)
      const st = document.getElementById('start'), menu = !!st && st.style.display !== 'none';
      const onControl = e.target && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
      if (!menu && !onControl && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) { this.pressed.add(e.code); for (const h of this._handlers.keydown) h(e.code, e); }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX; this.mouseY = e.clientY;
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouseDown = true; this.clicked = true; } });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('click', () => { if (this.wantLock && !this.locked) this.lock(); for (const h of this._handlers.click) h(); });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
  }

  lock() { try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  /** Subscribe to key presses (non-repeating). Returns an unsubscribe function. */
  onKey(fn) { this._handlers.keydown.push(fn); return () => { this._handlers.keydown = this._handlers.keydown.filter((h) => h !== fn); }; }

  /** -1..1 axes from WASD / arrows. */
  get moveX() { return (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0); }
  get moveY() { return (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0); }
  get run() { return this.down('ShiftLeft') || this.down('ShiftRight'); }

  endFrame() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0; this.clicked = false; }
}
