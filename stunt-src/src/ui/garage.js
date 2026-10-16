// Garage and missions screens (templates). Game supplies the data and the click handlers.

import { esc, fmtCoins, COIN } from './dom.js';

const BAR_NAMES = { speed: 'Speed', accel: 'Accel', handling: 'Handling', nitro: 'Nitro' };
const TABS = [
  ['car', 'Car'],
  ['upgrade', 'Upgrade'],
  ['paint', 'Paint'],
  ['rim', 'Wheels'],
  ['glow', 'Glow'],
];

function bars(b) {
  return Object.entries(b)
    .map(([k, v]) => `<div class="statbar"><span>${BAR_NAMES[k]}</span><i><b style="width:${v * 10}%"></b></i></div>`)
    .join('');
}

function carTab(d) {
  const c = d.car;
  let action;
  if (c.selected) action = '<button class="primary wide" disabled>SELECTED</button>';
  else if (c.owned) action = '<button class="primary wide" data-action="selectCar">SELECT</button>';
  else if (c.eventOnly) action = `<button class="ghost wide" disabled>${esc(c.eventNote ?? 'Event reward')}</button>`;
  else action = `<button class="primary wide ${d.coins < c.price ? 'poor' : ''}" data-action="buyCar">BUY ${COIN}${fmtCoins(c.price)}</button>`;
  return `<div class="bars">${bars(c.bars)}</div><p class="blurb">${esc(c.blurb ?? '')}</p>${action}`;
}

function upgradeTab(d) {
  if (!d.car.owned) return '<p class="blurb center">Buy this car to upgrade it.</p>';
  return `
    ${d.upgrades.map((u) => `
      <div class="up-row">
        <div class="up-info">
          <b>${esc(u.name)}</b>
          <small>${esc(u.effect)}</small>
          <span class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < u.level ? 'on' : ''}"></i>`).join('')}</span>
        </div>
        ${u.cost == null
          ? '<button class="ghost up-btn" disabled>MAX</button>'
          : `<button class="primary up-btn ${u.affordable ? '' : 'poor'}" data-action="upgrade" data-id="${u.id}">${COIN}${fmtCoins(u.cost)}</button>`}
      </div>`).join('')}
    <p class="idle-note">Idle earnings: ${COIN}${fmtCoins(d.idleRate)} / hour across your garage (up to 8 h while away)</p>`;
}

function cosmeticTab(d) {
  if (!d.car.owned) return '<p class="blurb center">Buy this car to customise it.</p>';
  const p = d.preview;
  let action = '';
  if (p) {
    if (p.equipped) action = '<button class="primary wide" disabled>EQUIPPED</button>';
    else if (p.owned) action = `<button class="primary wide" data-action="equip">EQUIP ${esc(p.name.toUpperCase())}</button>`;
    else action = `<button class="primary wide ${p.affordable ? '' : 'poor'}" data-action="buyCosmetic">BUY ${esc(p.name.toUpperCase())} ${COIN}${fmtCoins(p.price)}</button>`;
  }
  return `
    <div class="swatches">
      ${d.items.map((it) => `
        <button class="swatch ${it.previewing ? 'active' : ''} ${it.equipped ? 'equipped' : ''}" data-action="preview" data-id="${it.id}">
          <span class="dot" style="background:${it.swatch}"></span>
          <small>${esc(it.name)}</small>
          <em>${it.owned ? (it.equipped ? 'ON' : 'OWNED') : `${COIN}${fmtCoins(it.price)}`}</em>
        </button>`).join('')}
    </div>
    ${action}`;
}

export const GARAGE_TEMPLATES = {
  garage: (d) => `
    <div class="screen garage">
      <div class="topbar">
        <button class="back" data-action="menu" aria-label="Back">&#8249;</button>
        <h2 class="title">GARAGE</h2>
        <div class="wallet">${COIN}<span>${fmtCoins(d.coins)}</span></div>
      </div>
      <div class="car-head">
        <button class="arrow-btn" data-action="prevCar" aria-label="Previous car">&#8249;</button>
        <div class="car-name">
          <span class="tier" style="--tier:${d.car.tierColor}">${esc(d.car.tierName)}</span>
          <b>${esc(d.car.name)}</b>
          <small>${d.index + 1} / ${d.count}${d.car.owned ? ' · owned' : ''}</small>
        </div>
        <button class="arrow-btn" data-action="nextCar" aria-label="Next car">&#8250;</button>
      </div>
      <div class="grow"></div>
      <div class="panel">
        <div class="tabs">${TABS.map(([id, name]) => `<button class="tab ${d.tab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${name}</button>`).join('')}</div>
        <div class="tab-body">${d.tab === 'car' ? carTab(d) : d.tab === 'upgrade' ? upgradeTab(d) : cosmeticTab(d)}</div>
      </div>
    </div>`,

  missions: (d) => `
    <div class="screen missions">
      <div class="topbar">
        <button class="back" data-action="menu" aria-label="Back">&#8249;</button>
        <h2 class="title">DAILY MISSIONS</h2>
        <div class="wallet">${COIN}<span>${fmtCoins(d.coins)}</span></div>
      </div>
      <p class="reset-note">New missions in ${esc(d.resetIn)}</p>
      <div class="scroll">
        ${d.list.map((m, i) => `
          <div class="mission ${m.claimed ? 'claimed' : ''}">
            <div class="mission-info">
              <b>${esc(m.text)}</b>
              <div class="mbar"><i style="width:${(m.progress / m.n) * 100}%"></i></div>
              <small>${fmtCoins(Math.floor(m.progress))} / ${fmtCoins(m.n)}</small>
            </div>
            ${m.claimed
              ? '<button class="ghost m-btn" disabled>DONE</button>'
              : m.progress >= m.n
                ? `<button class="primary m-btn" data-action="claim" data-id="${i}">${COIN}${fmtCoins(m.reward)}</button>`
                : `<button class="ghost m-btn" disabled>${COIN}${fmtCoins(m.reward)}</button>`}
          </div>`).join('')}
        <div class="mission bonus ${d.bonusClaimed ? 'claimed' : ''}">
          <div class="mission-info"><b>Finish all three</b><small>Daily bonus</small></div>
          ${d.bonusClaimed
            ? '<button class="ghost m-btn" disabled>DONE</button>'
            : d.allClaimed
              ? `<button class="primary m-btn" data-action="claimBonus">${COIN}${fmtCoins(d.bonus)}</button>`
              : `<button class="ghost m-btn" disabled>${COIN}${fmtCoins(d.bonus)}</button>`}
        </div>
      </div>
    </div>`,
};

const MOD_TEXT = {
  gravity: (v) => `Gravity x${v}`,
  nitroFill: (v) => `Nitro fills x${v}`,
  coinValue: (v) => `Coins x${v}`,
};

function eventCard(x, d) {
  const e = x.event;
  const rec = d.records[e.id] ?? {};
  const chips = Object.entries(e.modifiers ?? {}).map(([k, v]) => `<span class="chip">${esc(MOD_TEXT[k]?.(v) ?? k)}</span>`).join('');
  const when = x.state === 'live' ? `Ends in ${esc(x.endsIn)}` : x.state === 'upcoming' ? `Starts in ${esc(x.startsIn)}` : 'Ended';
  const car = e.rewards.car ? `<span class="ev-car">+ ${esc(d.carNames[e.rewards.car] ?? e.rewards.car)} (event car)</span>` : '';
  return `
    <div class="event-card ${x.state}" style="--ev:${e.color}">
      <div class="ev-head"><b>${esc(e.name)}</b><span class="ev-when">${when}</span></div>
      <p class="ev-blurb">${esc(e.blurb)}</p>
      <div class="chips">${chips}<span class="chip goal">${esc(x.goal)}</span></div>
      <div class="ev-foot">
        <span class="ev-reward">${COIN}${fmtCoins(e.rewards.coins ?? 0)} ${car}</span>
        ${x.state === 'live'
          ? rec.completed
            ? '<span class="ev-done">COMPLETED</span>'
            : `<button class="primary ev-play" data-action="playEvent" data-id="${e.id}">PLAY</button>`
          : rec.completed ? '<span class="ev-done">COMPLETED</span>' : ''}
      </div>
      ${rec.runs ? `<small class="ev-best">${rec.runs} run${rec.runs === 1 ? '' : 's'} so far</small>` : ''}
    </div>`;
}

GARAGE_TEMPLATES.events = (d) => `
  <div class="screen events">
    <div class="topbar">
      <button class="back" data-action="menu" aria-label="Back">&#8249;</button>
      <h2 class="title">EVENTS</h2>
      <div class="wallet">${COIN}<span>${fmtCoins(d.coins)}</span></div>
    </div>
    <div class="scroll">
      ${d.live.length ? `<h3 class="group-title">LIVE NOW</h3>${d.live.map((x) => eventCard(x, d)).join('')}` : ''}
      ${d.upcoming.length ? `<h3 class="group-title">COMING UP</h3>${d.upcoming.map((x) => eventCard(x, d)).join('')}` : ''}
      ${d.ended.length ? `<h3 class="group-title">ENDED</h3>${d.ended.map((x) => eventCard(x, d)).join('')}` : ''}
    </div>
  </div>`;

/** Modal box (welcome back, confirmations). */
export function modal({ title, body, button = 'OK', action = 'closeModal' }) {
  return `
    <div class="modal-back">
      <div class="modal">
        <h3>${esc(title)}</h3>
        <p>${body}</p>
        <button class="primary big" data-action="${action}">${esc(button)}</button>
      </div>
    </div>`;
}
