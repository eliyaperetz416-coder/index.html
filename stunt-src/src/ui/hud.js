// In-race HUD: progress bar to the finish, timer, speed, nitro gauge and button, countdown,
// pop-up messages and screen-edge flashes.

import { $, el, setText, fmtTime } from './dom.js';
import { NITRO } from '../config/game.js';

export class Hud {
  constructor(root, { onNitro } = {}) {
    this.root = root;
    root.innerHTML = `
      <div class="vignette"></div>
      <div class="hud-top">
        <div class="progress"><div class="progress-fill"></div><div class="progress-car"></div><div class="progress-flag"></div></div>
        <div class="timer">0:00.00</div>
      </div>
      <div class="hud-center"><div class="count"></div><div class="popups"></div></div>
      <div class="combo"></div>
      <div class="hud-bottom">
        <div class="speed"><b>0</b><span>km/h</span></div>
        <button class="nitro" type="button" aria-label="Nitro">
          <span class="nitro-ring"></span>
          <span class="nitro-label">NITRO</span>
          <small>swipe &#8593;</small>
        </button>
      </div>
      <div class="hud-hint">Hold anywhere to drive · slide to steer · lift to brake</div>`;
    this.fill = $('.progress-fill', root);
    this.marker = $('.progress-car', root);
    this.timer = $('.timer', root);
    this.speed = $('.speed b', root);
    this.count = $('.count', root);
    this.popups = $('.popups', root);
    this.hint = $('.hud-hint', root);
    this.nitroBtn = $('.nitro', root);
    this.comboEl = $('.combo', root);
    this.vignette = $('.vignette', root);
    this.lastP = -1;
    this.lastN = -1;
    this.nitroBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onNitro?.();
    });
  }

  show(on) {
    this.root.hidden = !on;
    if (on) {
      this.popups.innerHTML = '';
      this.count.textContent = '';
      this.comboEl.textContent = '';
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
    const n = Math.round(race.nitro * 100) / 100;
    if (n !== this.lastN) {
      this.lastN = n;
      this.nitroBtn.style.setProperty('--fill', `${n * 360}deg`);
      this.nitroBtn.classList.toggle('ready', n >= NITRO.minFire);
      this.nitroBtn.classList.toggle('full', n >= 1);
    }
    this.nitroBtn.classList.toggle('firing', race.car.boostTime > 0);
    if (race.state === 'racing' && race.time > 4) this.hint.classList.add('gone');
    const showCombo = race.comboTimer > 0 && race.combo > 1;
    setText(this.comboEl, showCombo ? `COMBO x${race.combo}` : '');
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

  /** Screen-edge flash: 'hit' (red) or 'boost' (cyan). */
  edge(kind) {
    const v = this.vignette;
    v.className = 'vignette';
    void v.offsetWidth;
    v.classList.add(kind);
  }
}
