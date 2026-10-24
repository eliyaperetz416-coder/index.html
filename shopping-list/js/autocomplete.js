// The add box: suggestions while typing (see suggest.js), Enter to add. Arrow keys move
// through the suggestions; Escape closes them.
import { state } from './state.js';
import { $ } from './util.js';
import { escapeHtml } from './html.js';
import { suggestNames } from './suggest.js';
import { categoryColor } from './category.js';

export function initAutocomplete(addItem) {
  const input = $('itemInput');
  const box = $('suggestBox');
  let options = [];
  let active = -1;

  function close() {
    options = [];
    active = -1;
    box.hidden = true;
    box.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function highlight(index) {
    active = index;
    box.querySelectorAll('.suggest-option').forEach((el, i) => el.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) input.setAttribute('aria-activedescendant', `suggest-${index}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function refresh() {
    options = suggestNames(input.value, { history: state.purchaseHistory, items: state.items });
    active = -1;
    if (options.length === 0) { close(); return; }
    box.innerHTML = options.map((o, i) => `
      <li class="suggest-option" id="suggest-${i}" role="option" aria-selected="false" data-index="${i}" style="--cat-color:${categoryColor(o.catKey)}">
        <span class="suggest-dot"></span><span>${escapeHtml(o.name)}</span>
      </li>`).join('');
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function pick(option) {
    addItem(option.name, option.catKey);
    input.value = '';
    close();
    input.focus();
  }

  input.addEventListener('input', refresh);
  input.addEventListener('blur', () => setTimeout(close, 120));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && options.length) { e.preventDefault(); highlight((active + 1) % options.length); }
    else if (e.key === 'ArrowUp' && options.length) { e.preventDefault(); highlight((active - 1 + options.length) % options.length); }
    else if (e.key === 'Escape') close();
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) { pick(options[active]); return; }
      addItem(input.value);
      input.value = '';
      close();
    }
  });

  // Keep the focus in the input while a suggestion is tapped.
  box.addEventListener('pointerdown', (e) => e.preventDefault());
  box.addEventListener('click', (e) => {
    const li = e.target.closest('.suggest-option');
    if (li) pick(options[Number(li.dataset.index)]);
  });
}
