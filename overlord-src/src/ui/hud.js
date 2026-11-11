// The on-screen interface (plain HTML on top of the 3D canvas).

import { BASIC } from '../data/resources.js';
import { MODULES, BUILDABLE } from '../data/modules.js';
import { summarize, rates, alerts, canAfford } from '../sim/state.js';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const costText = (cost) =>
  Object.entries(cost)
    .map(([res, amount]) => `${amount} ${BASIC.find((b) => b.id === res).name}`)
    .join(' · ');

/**
 * @param root     the #hud element
 * @param onSelect called with a module type (or null) when the player picks what to build
 * @param onReset  called when the player confirms a new game
 */
export function createHud(root, { onSelect, onReset }) {
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
  const reset = el('button', 'card reset');
  reset.append(el('strong', null, 'New game'), el('span', null, 'Erase this base.'));
  reset.addEventListener('click', () => {
    if (confirm('Erase this base and start over?')) onReset();
  });
  bottom.append(reset);

  root.append(top, alertBox, hint, bottom);

  function select(type) {
    selected = type;
    for (const [t, card] of Object.entries(cards)) card.classList.toggle('active', t === type);
    hint.textContent = type ? `Tap a glowing spot to build: ${MODULES[type].name}  (Esc to cancel)` : '';
    onSelect(type);
  }

  /** Show a short message in the hint line (e.g. why a build failed). */
  function flash(message) {
    hint.textContent = message;
    hint.classList.remove('flash');
    void hint.offsetWidth; // restart the CSS animation
    hint.classList.add('flash');
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
    alertBox.replaceChildren(...alerts(state).map((a) => el('div', 'alert', `⚠ ${a}`)));
  }

  return { update, select, flash, getSelected: () => selected };
}
