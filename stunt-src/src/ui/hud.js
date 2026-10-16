// In-race HUD: progress bar to the finish, timer, speed, countdown and pop-up messages.

import { $, el, setText, fmtTime } from './dom.js';

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-top">
        <div class="progress"><div class="progress-fill"></div><div class="progress-car"></div><div class="progress-flag"></div></div>
        <div class="timer">0:00.00</div>
      </div>
      <div class="hud-center"><div class="count"></div><div class="popups"></div></div>
      <div class="hud-bottom">
        <div class="speed"><b>0</b><span>km/h</span></div>
      </div>
      <div class="hud-hint">Hold anywhere to drive · slide to steer · lift to brake</div>`;
    this.fill = $('.progress-fill', root);
    this.marker = $('.progress-car', root);
    this.timer = $('.timer', root);
    this.speed = $('.speed b', root);
    this.count = $('.count', root);
    this.popups = $('.popups', root);
    this.hint = $('.hud-hint', root);
    this.lastP = -1;
  }

  show(on) {
    this.root.hidden = !on;
    if (on) {
      this.popups.innerHTML = '';
      this.count.textContent = '';
      this.hint.classList.remove('gone');
    }
  }

  update(race) {
    const p = Math.round(race.progress * 1000) / 1000;
    if (p !== this.lastP) {
      this.lastP = p;
      this.fill.style.transform = `scaleX(${p})`;
      this.marker.style.left = `${p * 100}%`;
    }
    setText(this.timer, fmtTime(race.state === 'finished' ? race.finishTime : race.time));
    setText(this.speed, String(Math.round(race.car.speed * 3.6)));
    if (race.state === 'racing' && race.time > 4) this.hint.classList.add('gone');
  }

  /** Big centre text: countdown numbers, GO!, FINISH. */
  flash(text, cls = '') {
    const c = this.count;
    c.textContent = text;
    c.className = `count ${cls}`;
    void c.offsetWidth; // restart the animation
    c.classList.add('pop');
  }

  /** Small rising message (stunts, near misses...). */
  popup(text, cls = '') {
    const n = el(`<div class="popup ${cls}"></div>`);
    n.textContent = text;
    this.popups.appendChild(n);
    setTimeout(() => n.remove(), 1400);
    while (this.popups.children.length > 4) this.popups.firstChild.remove();
  }
}
