// Movement input: a floating virtual joystick plus WASD / arrow keys, and camera look.
//   Touch: a finger down on the left half of the screen is the joystick; on the right half it
//          drags the camera. Mouse: dragging anywhere turns the camera (move with WASD).
// readInput() returns { x, y } in -1..1, where y = forward (away from the camera) and x = right.
// takeLook() returns the camera drag in pixels since the last call.

const RADIUS = 56;   // px the knob can travel from the joystick center
const DEAD = 0.12;   // ignore tiny drags

const keys = new Set();
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const look = { id: null, lx: 0, ly: 0, dx: 0, dy: 0 };
let enabled = false;
let base;
let knob;

function onKey(e, down) {
  const k = e.key.toLowerCase();
  if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
  e.preventDefault();
  if (down) { keys.add(k); document.body.classList.add('has-walked'); }
  else keys.delete(k);
}

function show(x, y) {
  base.style.transform = `translate(${x - RADIUS}px, ${y - RADIUS}px)`;
  knob.style.transform = 'translate(0px, 0px)';
  base.classList.add('active');
}

function onDown(e) {
  if (!enabled || e.target.closest('button')) return;
  const wantsLook = e.pointerType === 'mouse' || e.clientX >= window.innerWidth / 2;
  if (wantsLook) {
    if (look.id !== null) return;
    look.id = e.pointerId;
    look.lx = e.clientX;
    look.ly = e.clientY;
    return;
  }
  if (stick.id !== null) return;
  stick.id = e.pointerId;
  stick.ox = e.clientX;
  stick.oy = e.clientY;
  stick.x = stick.y = 0;
  show(e.clientX, e.clientY);
}

function onMove(e) {
  if (e.pointerId === look.id) {
    look.dx += e.clientX - look.lx;
    look.dy += e.clientY - look.ly;
    look.lx = e.clientX;
    look.ly = e.clientY;
    return;
  }
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox;
  let dy = e.clientY - stick.oy;
  const len = Math.hypot(dx, dy);
  if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  stick.x = dx / RADIUS;
  stick.y = -dy / RADIUS;
  document.body.classList.add('has-walked');
}

function onUp(e) {
  if (e.pointerId === look.id) look.id = null;
  if (e.pointerId !== stick.id) return;
  stick.id = null;
  stick.x = stick.y = 0;
  base.classList.remove('active');
}

export function initInput() {
  base = document.getElementById('joystick');
  knob = base.querySelector('.knob');
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('blur', () => keys.clear());
}

export function setInputEnabled(on) {
  enabled = on;
  document.body.classList.toggle('can-walk', on);
  if (!on) {
    keys.clear();
    onUp({ pointerId: stick.id });
    look.id = null;
    look.dx = look.dy = 0;
  }
}

/** Camera drag (pixels) accumulated since the last call. */
export function takeLook() {
  const out = { dx: look.dx, dy: look.dy };
  look.dx = look.dy = 0;
  return out;
}

export function readInput() {
  if (!enabled) return { x: 0, y: 0 };
  let x = stick.x;
  let y = stick.y;
  if (keys.has('w') || keys.has('arrowup')) y += 1;
  if (keys.has('s') || keys.has('arrowdown')) y -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  const len = Math.hypot(x, y);
  if (len < DEAD) return { x: 0, y: 0 };
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}
