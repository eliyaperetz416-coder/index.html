// On-screen controls for the two alternative control styles:
//   'buttons': two big pads at the bottom. Hold either to drive and steer that way, both to go
//              straight, none to brake.
//   'wheel':   a steering wheel. Touch it to drive, turn it to steer, let go to brake.
// The default 'drag' style needs no widgets (the whole screen is the control).

import { clamp } from '../core/math.js';

export class Controls {
  /** @param {HTMLElement} root  @param {import('../core/input.js').Input} input */
  constructor(root, input) {
    this.root = root;
    this.input = input;
    this.style = 'drag';
    root.innerHTML = `
      <div class="pads">
        <div class="pad left" data-side="left"><span>&#9664;</span></div>
        <div class="pad right" data-side="right"><span>&#9654;</span></div>
      </div>
      <div class="wheel-wrap"><div class="wheel"><i></i><b></b></div></div>`;
    this.wheel = root.querySelector('.wheel');
    for (const pad of root.querySelectorAll('.pad')) {
      const side = pad.dataset.side;
      const on = (e) => {
        e.preventDefault();
        pad.setPointerCapture?.(e.pointerId);
        input.virtual[side] = true;
        pad.classList.add('on');
      };
      const off = () => {
        input.virtual[side] = false;
        pad.classList.remove('on');
      };
      pad.addEventListener('pointerdown', on);
      pad.addEventListener('pointerup', off);
      pad.addEventListener('pointercancel', off);
      pad.addEventListener('lostpointercapture', off);
    }
    let start = 0;
    let base = 0;
    const angleOf = (e) => {
      const r = this.wheel.getBoundingClientRect();
      return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2)));
    };
    this.wheel.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.wheel.setPointerCapture(e.pointerId);
      input.virtual.wheelHeld = true;
      start = angleOf(e);
      base = input.virtual.wheel;
    });
    this.wheel.addEventListener('pointermove', (e) => {
      if (!input.virtual.wheelHeld) return;
      let d = angleOf(e) - start;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      input.virtual.wheel = clamp(base + d / 1.6, -1, 1); // about 90 degrees for full lock
    });
    const release = () => {
      input.virtual.wheelHeld = false;
      input.virtual.wheel = 0;
    };
    this.wheel.addEventListener('pointerup', release);
    this.wheel.addEventListener('pointercancel', release);
    this.wheel.addEventListener('lostpointercapture', release);
  }

  setStyle(style) {
    this.style = style;
    this.input.style = style;
    document.body.dataset.controls = style;
  }

  show(on) {
    this.root.hidden = !on || this.style === 'drag';
    if (!on) {
      Object.assign(this.input.virtual, { left: false, right: false, wheelHeld: false, wheel: 0 });
    }
  }

  /** Spin the wheel graphic to match the steering. */
  update() {
    if (this.style === 'wheel') this.wheel.style.transform = `rotate(${this.input.virtual.wheel * 90}deg)`;
  }
}
