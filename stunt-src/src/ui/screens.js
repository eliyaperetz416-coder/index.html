// Menu screens. Each screen is a template function; buttons carry data-action (click) or
// data-press (pointerdown, for HOLD TO RIDE) and the game supplies the handlers.

import { GAME_NAME, GAME_TAGLINE } from '../config/game.js';
import { esc, fmtTime, fmtCoins, COIN } from './dom.js';

export const TEMPLATES = {
  menu: ({ coins, trackName }) => `
    <div class="screen menu">
      <div class="topbar"><div class="wallet">${COIN}<span>${fmtCoins(coins)}</span></div></div>
      <div class="logo-wrap">
        <h1 class="logo">${esc(GAME_NAME)}</h1>
        <p class="tagline">${esc(GAME_TAGLINE)}</p>
      </div>
      <div class="grow"></div>
      <button class="ride" data-press="ride">
        <span class="ride-ring"></span>
        <span class="ride-text">HOLD TO RIDE</span>
        <small>${esc(trackName)}</small>
      </button>
      <p class="menu-hint">Keep holding to drive. Slide to steer. Lift to brake.</p>
    </div>`,

  finish: ({ time, best, newBest, tally, hasNext }) => `
    <div class="screen finish">
      <h2 class="finish-title">FINISH!</h2>
      <div class="finish-time">${fmtTime(time)}${newBest ? '<span class="badge">NEW BEST</span>' : ''}</div>
      <div class="finish-best">Best ${fmtTime(best)}</div>
      <div class="tally">
        ${tally.lines.map((l, i) => `<div class="tally-line" style="animation-delay:${0.25 + i * 0.25}s"><span>${esc(l.label)}</span><b>+${fmtCoins(l.coins)}</b></div>`).join('')}
      </div>
      <div class="tally-total" style="animation-delay:${0.3 + tally.lines.length * 0.25}s">${COIN}<b data-count="${tally.total}">0</b></div>
      <div class="grow"></div>
      <button class="primary big" data-action="next">${hasNext ? 'NEXT TRACK' : 'RACE AGAIN'} <span class="arrow">&#9654;</span></button>
      <div class="row">
        <button class="ghost" data-action="retry">Retry</button>
        <button class="ghost" data-action="menu">Menu</button>
      </div>
    </div>`,
};

export class Screens {
  constructor(root, handlers) {
    this.root = root;
    this.handlers = handlers;
    this.current = null;
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (b && root.contains(b)) this.handlers[b.dataset.action]?.(b.dataset, e);
    });
    root.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-press]');
      if (b && root.contains(b)) {
        e.preventDefault();
        this.handlers[b.dataset.press]?.(e, b.dataset);
      }
    });
  }

  show(name, data = {}) {
    this.current = name;
    this.root.innerHTML = TEMPLATES[name](data);
    this.root.dataset.screen = name;
    this.root.hidden = false;
    const counter = this.root.querySelector('[data-count]');
    if (counter) countUp(counter, Number(counter.dataset.count), 900 + 250 * (data.tally?.lines.length ?? 0));
  }

  hide() {
    this.current = null;
    this.root.hidden = true;
    this.root.innerHTML = '';
  }
}

function countUp(node, target, delay) {
  const start = performance.now() + delay;
  const dur = 700;
  const tick = (t) => {
    if (!node.isConnected) return;
    const k = Math.min(1, Math.max(0, (t - start) / dur));
    node.textContent = fmtCoins(target * k);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
