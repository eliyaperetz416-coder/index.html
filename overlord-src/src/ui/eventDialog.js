// The pop-up shown when something happens on an expedition: the story, the choices, then the result.

import { PLANETS } from '../data/planets.js';
import { RACES } from '../data/races.js';
import { currentEvent, canChoose } from '../sim/events.js';
import { el, costText } from './dom.js';

/**
 * @param onChoose called with the choice number; must return the result
 *                 ({ won, text, changes }) or null if the choice was refused
 */
export function createEventDialog({ onChoose }) {
  const backdrop = el('div', 'backdrop');
  backdrop.hidden = true;
  const box = el('div', 'dialog');
  backdrop.append(box);

  let showing = null; // 'choices' | 'busy' | 'result' | null
  let last = null;

  function showChoices(state) {
    const event = currentEvent(state);
    const planet = PLANETS[state.expedition.planet];
    box.style.setProperty('--c', RACES[planet.race].color);
    const nodes = [el('small', null, `Expedition · ${planet.name}`), el('h3', null, event.title), el('p', null, event.text)];
    event.choices.forEach((choice, i) => {
      const button = el('button', 'btn choice');
      button.classList.toggle('poor', !canChoose(state, i).ok);
      button.append(el('strong', null, choice.label));
      const notes = [];
      if (choice.cost) notes.push(`Costs ${costText(choice.cost)}`);
      if (choice.fight) notes.push(`Battle · ${Math.round(choice.chance * 100)}% chance to win`);
      else if (choice.chance < 1) notes.push(`Risky · ${Math.round(choice.chance * 100)}% chance`);
      if (notes.length) button.append(el('em', null, notes.join(' · ')));
      button.addEventListener('click', () => {
        showing = 'busy'; // keep the dialog open while the game applies the choice
        const result = onChoose(i);
        if (result) showResult(result);
        else showing = 'choices';
      });
      nodes.push(button);
    });
    box.replaceChildren(...nodes);
    backdrop.hidden = false;
    showing = 'choices';
  }

  function showResult(result) {
    const ok = el('button', 'btn choice');
    ok.append(el('strong', null, 'Continue'));
    ok.addEventListener('click', () => {
      showing = null;
      backdrop.hidden = true;
      if (last) update(last); // another event may already be waiting
    });
    const changes = el('div', 'changes');
    for (const change of result.changes) changes.append(el('b', change.includes('−') ? 'bad' : null, change));
    box.replaceChildren(el('h3', null, result.won ? 'Success' : 'It went wrong'), el('p', null, result.text), changes, ok);
    showing = 'result';
  }

  /** Open the dialog whenever the game has an event waiting. */
  function update(state) {
    last = state;
    if (!showing && state.expedition?.event) showChoices(state);
    if (showing === 'choices' && !state.expedition?.event) {
      showing = null; // e.g. the player started a new game
      backdrop.hidden = true;
    }
  }

  return { backdrop, update };
}
