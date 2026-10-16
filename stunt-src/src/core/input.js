// Input: one finger (or mouse) plus keyboard, turned into { throttle, steer, brake, nitro }.
//
// Hold-and-drag (default): touching anywhere accelerates, sliding left/right steers (the further,
// the harder), lifting the finger brakes. A quick upward flick (or a second finger) fires nitro.
// Buttons / wheel styles: see ui/controls.js; they write into `virtual`.
// Keyboard: W / Up / Space accelerate, A D / Left Right steer, S / Down brake, Shift / N nitro.

import { clamp } from './math.js';

const ACCEL_KEYS = ['ArrowUp', 'KeyW', 'Space'];
const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const BRAKE_KEYS = ['ArrowDown', 'KeyS'];
const NITRO_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyN'];

export class Input {
  /** @param {HTMLElement} target full-screen element that receives touches for driving */
  constructor(target) {
    this.target = target;
    this.keys = new Set();
    this.pointer = null;
    this.keySteer = 0;
    this.nitroQueued = false;
    this.state = { throttle: 0, steer: 0, brake: 0, nitro: false };
    this.range = 100;
    this.style = 'drag'; // 'drag' | 'buttons' | 'wheel'
    this.virtual = { left: false, right: false, wheelHeld: false, wheel: 0 }; // on-screen controls
    this.onFirstGesture = null;

    target.addEventListener('pointerdown', (e) => this.down(e));
    target.addEventListener('pointermove', (e) => this.move(e));
    target.addEventListener('pointerup', (e) => this.up(e));
    target.addEventListener('pointercancel', (e) => this.up(e));
    target.addEventListener('lostpointercapture', (e) => this.up(e));
    window.addEventListener('keydown', (e) => {
      this.onFirstGesture?.();
      if (e.repeat) return;
      if ([...ACCEL_KEYS, ...LEFT_KEYS, ...RIGHT_KEYS, ...BRAKE_KEYS].includes(e.code) && e.target === document.body) e.preventDefault();
      this.keys.add(e.code);
      if (NITRO_KEYS.includes(e.code)) this.nitroQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pointer = null;
    });
    const resize = () => (this.range = clamp(window.innerWidth * 0.17, 45, 130));
    window.addEventListener('resize', resize);
    resize();
  }

  /** Take over a pointer that started elsewhere (the HOLD TO RIDE button). */
  adopt(e) {
    this.down(e);
  }

  down(e) {
    this.onFirstGesture?.();
    // With on-screen controls, the rest of the screen only fires nitro (tap).
    if (this.style !== 'drag') {
      this.nitroQueued = true;
      return;
    }
    if (this.pointer) {
      // A second finger tapping while the first one drives: nitro.
      if (e.pointerId !== this.pointer.id) this.nitroQueued = true;
      return;
    }
    this.pointer = { id: e.pointerId, anchor: e.clientX, x: e.clientX, y: e.clientY, y0: e.clientY, t0: performance.now() };
    try {
      this.target.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already gone: nothing to capture.
    }
  }

  move(e) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) return;
    p.x = e.clientX;
    p.y = e.clientY;
    // The anchor follows the finger past the full-lock distance, so turning back is instant.
    const d = p.x - p.anchor;
    if (Math.abs(d) > this.range) p.anchor = p.x - Math.sign(d) * this.range;
    // Quick flick up: nitro.
    const now = performance.now();
    if (p.y0 - p.y > 70 && now - p.t0 < 350) {
      this.nitroQueued = true;
      p.y0 = -1e9;
    }
    if (now - p.t0 > 350) {
      p.t0 = now;
      p.y0 = p.y;
    }
  }

  up(e) {
    if (this.pointer && e.pointerId === this.pointer.id) this.pointer = null;
  }

  has(list) {
    return list.some((k) => this.keys.has(k));
  }

  get holding() {
    const v = this.virtual;
    const pads = this.style === 'buttons' && (v.left || v.right);
    const wheel = this.style === 'wheel' && v.wheelHeld;
    return !!this.pointer || this.has(ACCEL_KEYS) || pads || wheel;
  }

  /** Recompute the state; call once per frame. */
  update(dt) {
    const s = this.state;
    const kl = this.has(LEFT_KEYS);
    const kr = this.has(RIGHT_KEYS);
    const keyTarget = (kr ? 1 : 0) - (kl ? 1 : 0);
    this.keySteer += clamp(keyTarget - this.keySteer, -dt * 6, dt * 6);
    const v = this.virtual;
    if (this.pointer) {
      s.steer = clamp((this.pointer.x - this.pointer.anchor) / this.range, -1, 1);
    } else if (this.style === 'buttons' && (v.left || v.right)) {
      this.padSteer = (this.padSteer ?? 0) + clamp((v.right ? 1 : 0) - (v.left ? 1 : 0) - (this.padSteer ?? 0), -dt * 7, dt * 7);
      s.steer = this.padSteer;
    } else if (this.style === 'wheel' && v.wheelHeld) {
      s.steer = v.wheel;
    } else {
      this.padSteer = 0;
      s.steer = this.keySteer;
    }
    s.throttle = this.holding ? 1 : 0;
    s.brake = this.has(BRAKE_KEYS) || !this.holding ? 1 : 0;
    s.nitro = this.nitroQueued;
    this.nitroQueued = false;
    return s;
  }
}
