// Keyboard, mouse and touch, turned into one simple set of answers each frame:
// "which way is the player pushing, how far did they turn the camera, what did they press?"

const KEYS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};
const PRESSES = { Space: 'jump', KeyE: 'use', Enter: 'use', KeyB: 'build', KeyF: 'lamp', Escape: 'back', KeyM: 'mute' };
for (let i = 1; i <= 9; i++) PRESSES[`Digit${i}`] = `digit${i}`;

export function createInput(canvas, hudRoot) {
  const held = new Set();
  const pressed = new Set(); // one-shot presses, cleared every frame
  let lookX = 0, lookY = 0, zoom = 0;
  let enabled = true;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (KEYS[e.code]) held.add(KEYS[e.code]);
    if (PRESSES[e.code] && !e.repeat) pressed.add(PRESSES[e.code]);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => KEYS[e.code] && held.delete(KEYS[e.code]));
  window.addEventListener('blur', () => held.clear());

  // --- pointers: on a touch screen the left side is a movement stick, everything else turns the camera ---
  const stick = document.createElement('div');
  stick.className = 'stick';
  stick.append(document.createElement('i'));
  hudRoot.append(stick);
  let stickId = null, stickX = 0, stickY = 0, originX = 0, originY = 0;
  const looks = new Map(); // pointerId → last position

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.42 && stickId === null) {
      stickId = e.pointerId;
      originX = e.clientX;
      originY = e.clientY;
      stick.style.cssText = `display:block;left:${originX}px;top:${originY}px`;
    } else {
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) {
      const dx = e.clientX - originX, dy = e.clientY - originY;
      const len = Math.hypot(dx, dy), max = 56, k = len > max ? max / len : 1;
      stickX = (dx * k) / max;
      stickY = (-dy * k) / max;
      stick.firstChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      return;
    }
    const last = looks.get(e.pointerId);
    if (!last) return;
    const speed = e.pointerType === 'touch' ? 0.0052 : 0.0034;
    lookX += (e.clientX - last.x) * speed;
    lookY += (e.clientY - last.y) * speed;
    last.moved += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y);
    last.x = e.clientX;
    last.y = e.clientY;
  });
  const release = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      stickX = stickY = 0;
      stick.style.display = 'none';
      stick.firstChild.style.transform = '';
    }
    const last = looks.get(e.pointerId);
    if (last && last.moved < 8 && e.type === 'pointerup') pressed.add('tap'); // a click that was not a drag
    looks.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => { zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    touch,
    /** Movement and camera for this frame. Call once per frame. */
    frame() {
      const out = { moveX: 0, moveY: 0, run: false, lookX, lookY, zoom, pressed: new Set(pressed) };
      lookX = lookY = zoom = 0;
      pressed.clear();
      if (!enabled) return { ...out, lookX: 0, lookY: 0, zoom: 0, pressed: new Set([...out.pressed].filter((p) => p === 'back' || p === 'mute')) };
      out.moveX = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0) + stickX;
      out.moveY = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0) + stickY;
      const len = Math.hypot(out.moveX, out.moveY);
      if (len > 1) { out.moveX /= len; out.moveY /= len; }
      out.run = held.has('run') || Math.hypot(stickX, stickY) > 0.92;
      return out;
    },
    /** For on-screen buttons. */
    press: (name) => pressed.add(name),
    /** Turn game controls off while a menu is open. */
    setEnabled(v) {
      enabled = v;
      if (!v) held.clear();
    },
  };
}
