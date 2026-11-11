// The on-screen interface (plain HTML on top of the 3D canvas).

import { BASIC } from '../data/resources.js';
import { MODULES, BUILDABLE } from '../data/modules.js';
import { summarize, rates, alerts, canAfford } from '../sim/state.js';
import { el, costText } from './dom.js';
import { createFleetPanel } from './fleetPanel.js';
import { createMapPanel, expeditionLine } from './mapPanel.js';

/**
 * @param root     the #hud element
 * @param onSelect called with a module type (or null) when the player picks what to build
 * @param onReset  called when the player confirms a new game
 * @param onBuildShip / onUpgradeShip  passed on to the Fleet panel
 * @param onLaunch / onRecall          passed on to the Star Map panel
 */
export function createHud(root, { onSelect, onReset, onBuildShip, onUpgradeShip, onLaunch, onRecall }) {
  // --- top bar: resources ---
  const top = el('div', 'bar top');
  const chips = {};
  for (const b of BASIC) {
    const chip = el('div', 'chip');
    chip.style.setProperty('--c', b.color);
    const value = el('b');
    const rate = el('small');
    chip.append(el('i'), el('span', 'label', b.name), value, rate);
    chips[b.id] = { value, rate };
    top.append(chip);
  }
  const crewChip = el('div', 'chip');
  crewChip.style.setProperty('--c', '#ffffff');
  const crewValue = el('b');
  crewChip.append(el('i'), el('span', 'label', 'Crew'), crewValue);
  top.append(crewChip);

  // --- alerts + hint ---
  const alertBox = el('div', 'alerts');
  const hint = el('div', 'hint');

  // --- bottom bar: build menu ---
  const bottom = el('div', 'bar bottom');
  const cards = {};
  let selected = null;
  for (const type of BUILDABLE) {
    const def = MODULES[type];
    const card = el('button', 'card');
    card.style.setProperty('--c', def.color);
    card.append(el('strong', null, def.name), el('span', null, def.desc), el('em', null, costText(def.cost)));
    card.addEventListener('click', () => select(selected === type ? null : type));
    cards[type] = card;
    bottom.append(card);
  }
  const fleet = createFleetPanel({ onBuild: onBuildShip, onUpgrade: onUpgradeShip });
  const map = createMapPanel({ onLaunch, onRecall });

  // Menu buttons open a panel; only one panel is open at a time.
  const menus = [];
  function addMenu(name, color, panel) {
    const button = el('button', 'card menu');
    button.style.setProperty('--c', color);
    const status = el('span');
    button.append(el('strong', null, name), status);
    button.addEventListener('click', () => {
      for (const m of menus) m.panel.hidden = m.panel !== panel || !panel.hidden;
      for (const m of menus) m.button.classList.toggle('active', !m.panel.hidden);
    });
    menus.push({ button, panel });
    return status;
  }
  const fleetCount = addMenu('Fleet', '#6f8cff', fleet.panel);
  const mapStatus = addMenu('Star Map', '#4dffb0', map.panel);
  bottom.prepend(...menus.map((m) => m.button));

  const reset = el('button', 'card reset');
  reset.append(el('strong', null, 'New game'), el('span', null, 'Erase this base.'));
  reset.addEventListener('click', () => {
    if (confirm('Erase this base and start over?')) onReset();
  });
  bottom.append(reset);

  root.append(top, alertBox, fleet.panel, map.panel, hint, bottom);

  const buildHint = () => (selected ? `Tap a glowing spot to build: ${MODULES[selected].name}  (Esc to cancel)` : '');
  let flashTimer = 0;

  function select(type) {
    selected = type;
    for (const [t, card] of Object.entries(cards)) card.classList.toggle('active', t === type);
    hint.textContent = buildHint();
    onSelect(type);
  }

  /** Show a short message in the hint line (e.g. why a build failed). */
  function flash(message) {
    hint.textContent = message;
    hint.classList.remove('flash');
    void hint.offsetWidth; // restart the CSS animation
    hint.classList.add('flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (hint.textContent = buildHint()), 4000);
  }

  function update(state) {
    const sum = summarize(state);
    const rate = rates(state);
    for (const b of BASIC) {
      const amount = Math.floor(state.resources[b.id]);
      chips[b.id].value.textContent = b.uncapped ? amount : `${amount}/${sum.cap}`;
      const r = rate[b.id];
      chips[b.id].rate.textContent = `${r >= 0 ? '+' : ''}${r.toFixed(1)}/s`;
      chips[b.id].rate.classList.toggle('neg', r < 0);
    }
    crewValue.textContent = sum.crew;
    for (const type of BUILDABLE) cards[type].classList.toggle('poor', !canAfford(state, type));
    fleetCount.textContent = state.queue.length ? `${state.ships.length} ships · building…` : `${state.ships.length} ships`;
    fleet.update(state);
    map.update(state);
    mapStatus.textContent = state.expedition ? expeditionLine(state.expedition) : 'Send an expedition';
    const lines = alerts(state).map((a) => el('div', 'alert', `⚠ ${a}`));
    if (state.expedition) lines.unshift(el('div', 'alert info', `🚀 ${expeditionLine(state.expedition)}`));
    alertBox.replaceChildren(...lines);
  }

  return { update, select, flash, getSelected: () => selected };
}
