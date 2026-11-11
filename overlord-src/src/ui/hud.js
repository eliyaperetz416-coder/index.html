// Everything drawn over the 3D view: read-outs, prompts, the build list, and the
// consoles (fleet, star map, war) that open when the commander uses a terminal.

import { BASIC } from '../data/resources.js';
import { MODULES, BUILDABLE } from '../data/modules.js';
import { TERM } from '../data/term.js';
import { summarize, rates, alerts, canAfford } from '../sim/state.js';
import { totalScore, timeLeft } from '../sim/score.js';
import { el, costText } from './dom.js';
import { createFleetPanel } from './fleetPanel.js';
import { createMapPanel, expeditionLine } from './mapPanel.js';
import { createEventDialog } from './eventDialog.js';
import { createWarPanel, warLine } from './warPanel.js';
import { createScoreScreen } from './scoreScreen.js';

const KEY_HELP = [['W A S D', 'walk'], ['Drag', 'look around'], ['Shift', 'run'], ['Space', 'jump'], ['E', 'use'], ['B', 'build'], ['F', 'helmet lamp'], ['M', 'sound']];
const TOUCH_HELP = [['Left thumb', 'walk (push far to run)'], ['Right thumb', 'look around'], ['Buttons', 'jump, use, build, lamp']];

/**
 * @param touch      true on a touch screen (shows on-screen buttons)
 * @param press      press('jump' | 'use' | 'build' | 'lamp' | 'back') — same as the keyboard keys
 * @param callbacks  what to do when the player acts in a console (see main.js)
 */
export function createHud(root, { touch, press, callbacks }) {
  const { onBuildPick, onBegin, onRestart } = callbacks;

  // --- top left: the base's supplies ---
  const supplies = el('div', 'supplies');
  const cells = {};
  for (const b of BASIC) {
    const cell = el('div', 'supply');
    const value = el('b'), rate = el('small');
    cell.append(el('span', null, b.name), value, rate);
    cells[b.id] = { cell, value, rate };
    supplies.append(cell);
  }
  const crewCell = el('div', 'supply');
  const crewValue = el('b');
  crewCell.append(el('span', null, 'Crew'), crewValue);
  supplies.append(crewCell);

  // --- top right: the term clock ---
  const term = el('div', 'term');
  const termName = el('span'), termClock = el('b'), termScore = el('small');
  term.append(termName, termClock, termScore);

  const notices = el('div', 'notices');

  // --- bottom left: the commander's suit ---
  const suit = el('div', 'suit');
  const suitFill = el('i'), suitValue = el('b'), place = el('span', 'place');
  const suitBar = el('div', 'suit-bar');
  suitBar.append(suitFill);
  suit.append(el('span', null, 'Suit O₂'), suitBar, suitValue, place);

  // --- bottom centre: what "use" would do right now, and short messages ---
  const prompt = el('div', 'prompt');
  const toast = el('div', 'toast');

  // --- build list ---
  const buildMenu = el('div', 'build-menu');
  buildMenu.hidden = true;
  buildMenu.append(el('h3', null, 'Build'), el('p', 'muted', 'Pick a module, look at a marked site, then place it.'));
  const cards = {};
  BUILDABLE.forEach((type, i) => {
    const def = MODULES[type];
    const card = el('button', 'build-card');
    card.append(el('kbd', null, `${i + 1}`), el('strong', null, def.name), el('span', null, def.desc), el('em', null, costText(def.cost)));
    card.addEventListener('click', () => onBuildPick(type));
    cards[type] = card;
    buildMenu.append(card);
  });

  // --- consoles: one sheet in the middle of the screen, showing one panel at a time ---
  const fleet = createFleetPanel({ onBuild: callbacks.onBuildShip, onUpgrade: callbacks.onUpgradeShip });
  const map = createMapPanel({ onLaunch: callbacks.onLaunch, onRecall: callbacks.onRecall });
  const war = createWarPanel({ onJoin: callbacks.onJoin, onOrder: callbacks.onOrder, onRetreat: callbacks.onRetreat });
  const panels = { fleet: fleet.panel, map: map.panel, war: war.panel };
  const sheet = el('div', 'sheet');
  sheet.hidden = true;
  const close = el('button', 'close', 'Close');
  close.addEventListener('click', () => closePanel());
  const sheetBox = el('div', 'sheet-box');
  sheetBox.append(close, ...Object.values(panels));
  sheet.append(sheetBox);
  sheet.addEventListener('click', (e) => e.target === sheet && closePanel());

  const events = createEventDialog({ onChoose: callbacks.onChoose });
  const scoreScreen = createScoreScreen({ onNewTerm: callbacks.onNewTerm });

  // --- on-screen buttons for touch ---
  const pad = el('div', 'pad');
  const useButton = el('button', 'use', 'Use');
  if (touch) {
    for (const [name, label, node] of [['lamp', 'Lamp'], ['build', 'Build'], ['use', 'Use', useButton], ['jump', 'Jump']]) {
      const button = node ?? el('button', name, label);
      button.addEventListener('pointerdown', (e) => { e.preventDefault(); press(name); });
      pad.append(button);
    }
  }

  // --- title card ---
  const intro = el('div', 'intro');
  const begin = el('button', 'begin', 'Begin');
  const help = el('dl');
  for (const [key, what] of touch ? TOUCH_HELP : KEY_HELP) help.append(el('dt', null, key), el('dd', null, what));
  intro.append(el('h1', null, 'Space Overlord'), el('p', null, 'You have fifteen minutes of air, metal and nerve. Build the base. Send the fleet. Pick a side.'), help, begin);
  begin.addEventListener('click', () => {
    intro.classList.add('gone');
    setTimeout(() => (intro.hidden = true), 900);
    onBegin();
  });

  const restart = el('button', 'restart', 'Restart term');
  restart.addEventListener('click', () => confirm('Start this term again from nothing?') && onRestart());

  root.append(supplies, term, notices, suit, toast, prompt, buildMenu, pad, restart, sheet, events.backdrop, scoreScreen.backdrop, intro);

  // ------------------------------------------------------------------ actions

  let openName = null;
  function openPanel(name) {
    openName = name;
    for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
    sheet.hidden = false;
  }
  function closePanel() {
    openName = null;
    sheet.hidden = true;
  }

  let toastTimer = 0;
  /** Show a short message for a few seconds. */
  function flash(message) {
    toast.textContent = message;
    toast.classList.remove('show');
    void toast.offsetWidth; // restart the fade animation
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
  }

  /** What pressing "use" would do: setPrompt('Star map') or setPrompt(null). `warn` shows it as not possible. */
  function setPrompt(text, warn = false) {
    prompt.hidden = !text;
    if (!text) return;
    prompt.replaceChildren(...(touch ? [] : [el('kbd', null, 'E')]), el('span', null, text));
    prompt.classList.toggle('warn', warn);
    useButton.textContent = warn ? 'Use' : text.length > 12 ? 'Use' : text;
  }

  /** Open or close the build list and mark the chosen module. */
  function setBuild(open, selected) {
    buildMenu.hidden = !open;
    for (const [type, card] of Object.entries(cards)) card.classList.toggle('active', type === selected);
  }

  /**
   * Refresh every read-out.
   * @param where  { indoors, name } — where the commander is standing
   */
  function update(state, where) {
    const sum = summarize(state), rate = rates(state);
    for (const b of BASIC) {
      const amount = Math.floor(state.resources[b.id]);
      const c = cells[b.id];
      c.value.textContent = b.uncapped ? amount : `${amount}`;
      c.cell.title = b.uncapped ? '' : `Storage: ${sum.cap}`;
      c.rate.textContent = `${rate[b.id] >= 0 ? '+' : '−'}${Math.abs(rate[b.id]).toFixed(1)}`;
      c.rate.classList.toggle('bad', rate[b.id] < 0);
      c.cell.classList.toggle('full', !b.uncapped && amount >= sum.cap);
      c.cell.classList.toggle('low', !b.uncapped && amount < 15);
    }
    crewValue.textContent = sum.crew;

    const left = Math.ceil(timeLeft(state));
    termName.textContent = `Term ${state.term}`;
    termClock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    termScore.textContent = `${totalScore(state)} pts`;
    term.classList.toggle('ending', left <= TERM.warnAt);

    const air = Math.round(state.suit.oxygen);
    suitFill.style.width = `${air}%`;
    suitValue.textContent = `${air}%`;
    suit.classList.toggle('low', air < 25);
    place.textContent = where.name;
    place.classList.toggle('safe', where.indoors);

    for (const type of BUILDABLE) cards[type].classList.toggle('poor', !canAfford(state, type));

    const lines = alerts(state).map((a) => el('div', 'notice bad', a));
    if (air < 25 && !where.indoors) lines.unshift(el('div', 'notice bad', 'Suit air is low — get inside'));
    if (state.war.offer || state.war.battle) lines.push(el('div', 'notice war', warLine(state)));
    if (state.expedition) lines.push(el('div', 'notice', expeditionLine(state.expedition)));
    notices.replaceChildren(...lines);

    fleet.update(state);
    map.update(state);
    war.update(state);
    events.update(state);
  }

  return {
    update, flash, setPrompt, setBuild, openPanel, closePanel,
    showWarResult: war.showResult,
    showScore: scoreScreen.show,
    get openPanel_() { return openName; },
    /** True while something on screen needs the player's full attention (game controls are off). */
    isBlocking: () => !sheet.hidden || !events.backdrop.hidden || !scoreScreen.backdrop.hidden || !intro.hidden,
    isPanelOpen: () => !sheet.hidden,
  };
}
