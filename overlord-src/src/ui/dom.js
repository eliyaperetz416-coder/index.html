// Small helpers shared by the UI files.

import { BASIC, RARE } from '../data/resources.js';

/** Create an element: el('div', 'chip', 'text') */
export const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

/** { metal: 30, credits: 10 } → "30 Metal · 10 Credits" */
export const costText = (cost) =>
  Object.entries(cost)
    .map(([res, amount]) => `${amount} ${[...BASIC, ...RARE].find((b) => b.id === res).name}`)
    .join(' · ');
