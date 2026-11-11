// The end-of-term screen: final score, how it was earned, and the high-score table.

import { scoreBreakdown, totalScore, titleFor } from '../sim/score.js';
import { el } from './dom.js';

/** @param onNewTerm called when the player starts the next term */
export function createScoreScreen({ onNewTerm }) {
  const backdrop = el('div', 'backdrop score-screen');
  backdrop.hidden = true;
  const box = el('div', 'dialog');
  box.style.setProperty('--c', '#ffd23f');
  backdrop.append(box);

  /** @param scores the high-score table, best first */
  function show(state, scores) {
    const total = totalScore(state);
    const rows = el('div', 'score-rows');
    for (const row of scoreBreakdown(state)) {
      const line = el('div', 'score-row');
      line.append(el('strong', null, row.label), el('span', null, row.detail), el('b', row.points < 0 ? 'bad' : null, `${row.points}`));
      rows.append(line);
    }

    const table = el('ol', 'highscores');
    for (const entry of scores.slice(0, 5)) {
      const item = el('li');
      item.classList.toggle('mine', entry.runId === state.runId && entry.term === state.term);
      item.append(el('b', null, `${entry.score}`), el('span', null, `${entry.title} · Term ${entry.term}`));
      table.append(item);
    }

    const next = el('button', 'btn choice');
    next.append(el('strong', null, `Start Term ${state.term + 1}`), el('em', null, 'A fresh base, a new war.'));
    next.addEventListener('click', () => {
      backdrop.hidden = true;
      onNewTerm();
    });

    box.replaceChildren(
      el('small', null, `Term ${state.term} complete`),
      el('h3', null, titleFor(total)),
      el('div', 'score-total', `${total}`),
      rows,
      el('h4', null, 'High scores'),
      table,
      next,
    );
    backdrop.hidden = false;
  }

  return { backdrop, show };
}
