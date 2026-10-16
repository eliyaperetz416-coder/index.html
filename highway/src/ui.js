// DOM UI: HUD, touch controls and screens. No game logic in here.
import { GAME_NAME, GAME_TAGLINE } from './config.js';

export function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
export const fmt = (n) => Math.round(n).toLocaleString('en-US');

export class UI {
  constructor() {
    this.hudEl = document.getElementById('hud');
    this.controlsEl = document.getElementById('controls');
    this.screensEl = document.getElementById('screens');
    this._buildHud();
    this.btnLeft = null; this.btnRight = null;
  }

  _buildHud() {
    this.hudEl.innerHTML = '';
    const score = h('div', 'hud-score', '<div class="lbl">Score</div><div class="val" data-k="score">0</div>');
    const speed = h('div', 'hud-speed', '<div class="lbl">Speed</div><div><span class="val" data-k="speed">0</span><span class="unit">km/h</span></div>');
    this.hudEl.append(score, speed);
    this.elScore = score.querySelector('[data-k=score]');
    this.elSpeed = speed.querySelector('[data-k=speed]');
    this._last = {};
  }

  setHud({ score, kmh }) {
    const s = fmt(score), k = String(Math.round(kmh));
    if (this._last.s !== s) { this.elScore.textContent = s; this._last.s = s; }
    if (this._last.k !== k) { this.elSpeed.textContent = k; this._last.k = k; }
  }
  showHud(v) { this.hudEl.style.display = v ? '' : 'none'; }

  // ---- controls ----
  buildButtons(onLane) {
    this.controlsEl.innerHTML = '';
    const mk = (cls, label, dir) => {
      const b = h('div', 'side-btn ' + cls, label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); onLane(dir); });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      this.controlsEl.append(b); return b;
    };
    this.btnLeft = mk('left', '◀', -1); this.btnRight = mk('right', '▶', 1);
  }
  showControls(v) { this.controlsEl.style.display = v ? '' : 'none'; }

  // ---- screens ----
  clearScreens() { this.screensEl.innerHTML = ''; }
  showScreen(node) { this.clearScreens(); this.screensEl.append(node); return node; }

  showStart(onStart) {
    const card = h('div', 'card');
    card.append(h('h1', '', GAME_NAME), h('div', 'sub', GAME_TAGLINE));
    const b = h('button', 'btn', 'Start'); b.onclick = onStart; card.append(b);
    card.append(h('div', 'hint', '← → / A D to change lanes · tap the side buttons on a phone'));
    const wrap = h('div', 'screen'); wrap.append(card);
    this.showScreen(wrap);
  }

  showGameOver({ score, best, newBest, kmh }, onRestart) {
    const card = h('div', 'card');
    card.append(h('h2', '', 'CRASHED'));
    if (newBest) card.append(h('div', 'newbest', 'NEW BEST'));
    card.append(h('div', 'big', fmt(score)));
    card.append(h('div', 'stat-row', `<span>Best</span><b>${fmt(best)}</b>`));
    card.append(h('div', 'stat-row', `<span>Top speed</span><b>${Math.round(kmh)} km/h</b>`));
    const b = h('button', 'btn pink', 'Restart'); b.onclick = onRestart; card.append(b);
    const wrap = h('div', 'screen'); wrap.append(card);
    this.showScreen(wrap);
  }
}
