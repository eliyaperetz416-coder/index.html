// Menu screens. Each screen is a template function; buttons carry data-action (click) or
// data-press (pointerdown, for HOLD TO RIDE) and the game supplies the handlers.

import { GAME_NAME, GAME_TAGLINE } from '../config/game.js';
import { esc, fmtTime, fmtCoins, COIN } from './dom.js';
import { GARAGE_TEMPLATES, modal } from './garage.js';
import { SETTINGS_TEMPLATES } from './settings.js';

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
          <p class="group-blurb">${esc(g.locked ? g.lockNote : g.blurb ?? '')}</p>
          ${g.tracks.map((t, i) => `
            <button class="track-card ${t.locked ? 'locked' : ''} ${t.current ? 'current' : ''} ${t.boss ? 'boss' : ''}" data-action="pick" data-id="${t.id}" ${t.locked ? 'disabled' : ''}>
              <span class="track-num">${t.boss ? '&#9760;' : i + 1}</span>
              <span class="track-info">
                <b>${esc(t.name)}</b>${t.boss ? `<em class="boss-name">VS ${esc(t.bossName)}</em>` : ''}
                ${stars(t.difficulty)}
                <small>${t.locked ? `${esc(t.requiresName[0].toUpperCase() + t.requiresName.slice(1))} to unlock` : t.best != null ? `Best ${fmtTime(t.best)}` : 'Not raced yet'}</small>
              </span>
              <span class="track-side">${t.locked ? '<span class="lock"></span>' : medal(t.medal)}<small>${COIN}${fmtCoins(t.reward)}</small></span>
            </button>`).join('')}`).join('')}
      </div>
    </div>`,

  menu: ({ coins, trackName, missionsReady = 0, eventsLive = 0 }) => `
    <div class="screen menu">
      <div class="topbar"><div class="wallet">${COIN}<span>${fmtCoins(coins)}</span></div><button class="gear" data-action="settings" aria-label="Settings"></button></div>
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
        <button class="nav-btn" data-action="events"><span class="nav-icon star"></span>Events${eventsLive ? '<span class="badge-dot live">LIVE</span>' : ''}</button>
      </nav>
    </div>`,

  finish: (d) => finishTemplate(d),
};

function finishTemplate(d) {
  const { time, best, newBest, tally, hasNext, medal: m, unlocked = [], worlds = [], title = 'FINISH!', lost, rival, event } = d;
  return `
    <div class="screen finish">
      <h2 class="finish-title ${lost ? 'lost' : ''}">${esc(title)}</h2>
      <div class="finish-time">${medal(m)}${fmtTime(time)}${newBest ? '<span class="badge">NEW BEST</span>' : ''}</div>
      <div class="finish-best">${rival ? `${esc(rival.name)} ${rival.time != null ? fmtTime(rival.time) : 'still racing'}` : `Best ${fmtTime(best)}`}</div>
      ${worlds.map((w) => `<div class="unlock-note world">NEW WORLD UNLOCKED: ${esc(w)}</div>`).join('')}
      ${event ? `
        <div class="event-result ${event.met ? 'met' : ''}">
          <b>${esc(event.goal)}</b>
          <div class="mbar"><i style="width:${event.progress * 100}%"></i></div>
          <small>${event.rewards ? `EVENT COMPLETE! +${fmtCoins(event.rewards.coins)} coins${event.rewards.carName ? ` and the ${esc(event.rewards.carName)}` : ''}` : event.met ? (event.live ? 'Goal reached (reward already claimed)' : 'Goal reached, but the event has ended') : 'Not this time. Try again!'}</small>
        </div>` : ''}
      ${unlocked.map((u) => `<div class="unlock-note">NEW TRACK UNLOCKED: ${esc(u.name)}</div>`).join('')}
      ${(d.missionsDone ?? []).map((m) => `<div class="unlock-note gold">MISSION COMPLETE: ${esc(m.text)}</div>`).join('')}
      <div class="tally">
        ${tally.lines.map((l, i) => `<div class="tally-line" style="animation-delay:${0.25 + i * 0.25}s"><span>${esc(l.label)}</span><b>+${fmtCoins(l.coins)}</b></div>`).join('')}
      </div>
      <div class="tally-total" style="animation-delay:${0.3 + tally.lines.length * 0.25}s">${COIN}<b data-count="${tally.total}">0</b></div>
      <div class="grow"></div>
      <button class="primary big" data-action="next">${hasNext ? 'NEXT TRACK' : 'RACE AGAIN'} <span class="arrow">&#9654;</span></button>
      <div class="row">
        <button class="ghost" data-action="retry">${lost ? 'Rematch' : 'Retry'}</button>
        <button class="ghost" data-action="menu">Menu</button>
      </div>
    </div>`;
}

TEMPLATES.bossIntro = (b) => `
  <div class="screen boss-intro" style="--boss:${b.glow ?? '#ff2b4a'}">
    <div class="topbar"><button class="back" data-action="tracks" aria-label="Back">&#8249;</button></div>
    <div class="grow"></div>
    <div class="boss-card">
      <small>RIVAL RACE · ${esc(b.track)}</small>
      <h2>${esc(b.name)}</h2>
      <p class="taunt">"${esc(b.taunt)}"</p>
      <p class="boss-car">Drives the <b>${esc(b.car)}</b>. Matches your speed and rams you when you are close. Beat him to the line.</p>
      <p class="boss-reward">${COIN}${fmtCoins(b.reward)} + bounty${b.losses ? ` · ${b.losses} lost so far` : ''}</p>
      <button class="primary big" data-action="raceBoss" data-id="${b.id}">RACE HIM</button>
    </div>
  </div>`;

Object.assign(TEMPLATES, GARAGE_TEMPLATES, SETTINGS_TEMPLATES);

export class Screens {
  constructor(root, handlers, modalRoot = null) {
    this.root = root;
    this.handlers = handlers;
    this.current = null;
    this.modalRoot = modalRoot;
    for (const r of [root, modalRoot].filter(Boolean)) {
      r.addEventListener('click', (e) => {
        const b = e.target.closest('[data-action]');
        if (b && r.contains(b) && !b.disabled) {
          this.onAction?.(b.dataset.action);
          this.handlers[b.dataset.action]?.(b.dataset, e);
        }
      });
      r.addEventListener('input', (e) => {
        const name = e.target.dataset?.input;
        if (name) this.handlers.input?.(name, e.target.value);
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
