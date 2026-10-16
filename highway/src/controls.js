// On-screen touch controls. Three styles share the same outputs: onLane(dir) and onNitro(held).
//   buttons: left/right pads on the sides   wheel: a steering wheel you rotate   swipe: swipe anywhere
import { h } from './ui.js';

export const CONTROL_MODES = [
  { id: 'buttons', name: 'Buttons', desc: 'Left / right pads at the sides of the screen' },
  { id: 'wheel',   name: 'Wheel',   desc: 'Rotate an on-screen steering wheel' },
  { id: 'swipe',   name: 'Swipe',   desc: 'Swipe left or right anywhere' },
];

export class Controls {
  constructor(container, { onLane, onNitro }) {
    this.el = container; this.onLane = onLane; this.onNitro = onNitro;
    this.mode = null; this.nitroBtn = null; this.cleanup = [];
  }

  setMode(mode) {
    this.cleanup.forEach((f) => f()); this.cleanup = [];
    this.el.innerHTML = ''; this.mode = mode;
    this.el.className = 'mode-' + mode;
    if (mode === 'wheel') this._wheel(); else if (mode === 'swipe') this._swipe(); else this._buttons();
    this._nitro();
  }
  show(v) { this.el.style.display = v ? '' : 'none'; }

  _on(el, type, fn, opts) { el.addEventListener(type, fn, opts); this.cleanup.push(() => el.removeEventListener(type, fn, opts)); }

  _nitro() {
    const n = h('div', 'nitro-btn', 'N<small>NITRO</small>');
    this._on(n, 'pointerdown', (e) => { e.preventDefault(); n.setPointerCapture?.(e.pointerId); this.onNitro(true); });
    const up = () => this.onNitro(false);
    this._on(n, 'pointerup', up); this._on(n, 'pointercancel', up);
    this.el.append(n); this.nitroBtn = n;
  }

  _buttons() {
    const mk = (cls, label, dir) => {
      const b = h('div', 'side-btn ' + cls, label);
      this._on(b, 'pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); this.onLane(dir); });
      const up = () => b.classList.remove('down');
      this._on(b, 'pointerup', up); this._on(b, 'pointercancel', up); this._on(b, 'pointerleave', up);
      this.el.append(b);
    };
    mk('left', '◀', -1); mk('right', '▶', 1);
  }

  _wheel() {
    const wheel = h('div', 'wheel', '<div class="w-rim"></div><div class="w-hub"></div><i class="w-s1"></i><i class="w-s2"></i><i class="w-s3"></i><i class="w-mark"></i>');
    this.el.append(wheel);
    let pid = null, startX = 0, angle = 0, armed = true, raf = 0;
    const MAX = 85, TRIGGER = 38, REARM = 16;
    const draw = () => { wheel.style.transform = `rotate(${angle}deg)`; };
    const settle = () => {
      cancelAnimationFrame(raf);
      const step = () => { angle *= 0.78; if (Math.abs(angle) < 0.5) angle = 0; draw(); if (angle !== 0 && pid === null) raf = requestAnimationFrame(step); };
      step();
    };
    this._on(wheel, 'pointerdown', (e) => {
      e.preventDefault(); wheel.setPointerCapture(e.pointerId); pid = e.pointerId; startX = e.clientX - angle * 2.2; armed = Math.abs(angle) < REARM; cancelAnimationFrame(raf);
    });
    this._on(wheel, 'pointermove', (e) => {
      if (e.pointerId !== pid) return;
      angle = Math.max(-MAX, Math.min(MAX, (e.clientX - startX) / 2.2)); draw();
      if (armed && Math.abs(angle) > TRIGGER) { armed = false; this.onLane(Math.sign(angle)); }
      else if (!armed && Math.abs(angle) < REARM) armed = true;
    });
    const end = (e) => { if (e.pointerId !== pid) return; pid = null; settle(); };
    this._on(wheel, 'pointerup', end); this._on(wheel, 'pointercancel', end);
    this.cleanup.push(() => cancelAnimationFrame(raf));
  }

  _swipe() {
    const layer = h('div', 'swipe-layer', '<div class="swipe-hint">◀ swipe ▶</div>');
    this.el.append(layer);
    const pts = new Map();
    this._on(layer, 'pointerdown', (e) => { e.preventDefault(); layer.setPointerCapture(e.pointerId); pts.set(e.pointerId, e.clientX); });
    this._on(layer, 'pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const thr = Math.max(26, window.innerWidth * 0.045);
      const dx = e.clientX - pts.get(e.pointerId);
      if (Math.abs(dx) > thr) { this.onLane(Math.sign(dx)); pts.set(e.pointerId, e.clientX); }
    });
    const end = (e) => pts.delete(e.pointerId);
    this._on(layer, 'pointerup', end); this._on(layer, 'pointercancel', end);
  }
}
