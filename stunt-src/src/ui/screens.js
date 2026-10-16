// Menu screens. Each screen is a template function; buttons carry data-action (click) or
// data-press (pointerdown, for HOLD TO RIDE) and the game supplies the handlers.

import { GAME_NAME, GAME_TAGLINE } from '../config/game.js';
import { esc, fmtTime, fmtCoins, COIN } from './dom.js';
import { GARAGE_TEMPLATES, modal } from './garage.js';

const stars = (n, max = 5) => `<span class="stars">${'&#9733;'.repeat(n)}<i>${'&#9733;'.repeat(max - n)}</i></span>`;
const medal = (m) => (m ? `<span class="medal ${m}"></span>` : '');

export const TEMPLATES = {
  tracks: ({ coins, groups }) => `
    <div class="screen tracks">
      <div class="topbar">
        <button class="back" data-action="menu" aria-label="Back">&#8249;</button>
        <h2 class="title">TRACKS</h2>
        <div class="wallet">${COIN}<span>${fmtCoins(coins)}</span></div>
      </div>
      <div class="scroll">
        ${groups.map((g) => `
          <h3 class="group-title">${esc(g.title)}</h3>
          ${g.tracks.map((t, i) => `
            <button class="track-card ${t.locked ? 'locked' : ''} ${t.current ? 'current' : ''}" data-action="pick" data-id="${t.id}" ${t.locked ? 'disabled' : ''}>
              <span class="track-num">${i + 1}</span>
              <span class="track-info">
                <b>${esc(t.name)}</b>
                ${stars(t.difficulty)}
                <small>${t.locked ? `Finish ${esc(t.requiresName)} to unlock` : t.best != null ? `Best ${fmtTime(t.best)}` : 'Not raced yet'}</small>
              </span>
              <span class="track-side">${t.locked ? '<span class="lock"></span>' : medal(t.medal)}<small>${COIN}${fmtCoins(t.reward)}</small></span>
            </button>`).join('')}`).join('')}
      </div>
    </div>`,

  menu: ({ coins, trackName, missionsReady = 0 }) => `
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
      <nav class="menu-nav">
        <button class="nav-btn" data-action="tracks"><span class="nav-icon flag"></span>Tracks</button>
        <button class="nav-btn" data-action="garage"><span class="nav-icon car"></span>Garage</button>
        <button class="nav-btn" data-action="missions"><span class="nav-icon target"></span>Missions${missionsReady ? `<span class="badge-dot">${missionsReady}</span>` : ''}</button>
      </nav>
    </div>`,

  finish: (d) => finishTemplate(d),
};

function finishTemplate(d) {
  const { time, best, newBest, tally, hasNext, medal: m, unlocked = [] } = d;
  return `
    <div class="screen finish">
      <h2 class="finish-title">FINISH!</h2>
      <div class="finish-time">${medal(m)}${fmtTime(time)}${newBest ? '<span class="badge">NEW BEST</span>' : ''}</div>
      <div class="finish-best">Best ${fmtTime(best)}</div>
      ${unlocked.map((u) => `<div class="unlock-note">NEW TRACK UNLOCKED: ${esc(u.name)}</div>`).join('')}
      ${(d.missionsDone ?? []).map((m) => `<div class="unlock-note gold">MISSION COMPLETE: ${esc(m.text)}</div>`).join('')}
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
    </div>`;
}

Object.assign(TEMPLATES, GARAGE_TEMPLATES);

export class Screens {
  constructor(root, handlers, modalRoot = null) {
    this.root = root;
    this.handlers = handlers;
    this.current = null;
    this.modalRoot = modalRoot;
    for (const r of [root, modalRoot].filter(Boolean)) {
      r.addEventListener('click', (e) => {
        const b = e.target.closest('[data-action]');
        if (b && r.contains(b) && !b.disabled) this.handlers[b.dataset.action]?.(b.dataset, e);
      });
    }
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

  /** Re-render the current screen with new data, keeping the scroll position. */
  refresh(data) {
    const sc = this.root.querySelector('.scroll, .tab-body');
    const top = sc?.scrollTop ?? 0;
    this.show(this.current, data);
    const sc2 = this.root.querySelector('.scroll, .tab-body');
    if (sc2) sc2.scrollTop = top;
  }

  modal(opts) {
    this.modalRoot.innerHTML = modal(opts);
    this.modalRoot.hidden = false;
  }

  closeModal() {
    this.modalRoot.hidden = true;
    this.modalRoot.innerHTML = '';
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
