// Adding, ticking off, deleting and prioritising items on the active list.
import { state } from './state.js';
import { $ } from './util.js';
import { t } from './i18n.js';
import { guessCategoryKey, CATEGORY_COLORS } from './category.js';
import { newId } from './ids.js';
import { toggleBought as toggleBoughtState } from './items.js';
import { render } from './render.js';
import { save } from './sync.js';

function guessCategory(name) {
  const key = guessCategoryKey(name, state.lang);
  return { key, name: t().categories[key], color: CATEGORY_COLORS[key] };
}

export function addItem(name) {
  if (!name.trim() || !state.activeListId) return;
  const cat = guessCategory(name);
  state.items.push({
    id: newId(),
    name: name.trim(),
    bought: false,
    catKey: cat.key,
    catName: cat.name,
    catColor: cat.color,
  });
  save();
  render();
}

function toggleBought(id) {
  ({ items: state.items, purchaseHistory: state.purchaseHistory } =
    toggleBoughtState(state.items, state.purchaseHistory, id));
  save();
  render();
}

// purchaseHistory is a separate log of {itemId, name, catKey, catColor, timestamp} for
// every item marked bought. It is kept even if the item is later deleted from the list,
// so weekly stats stay accurate; un-marking an item removes the entry that marking added.
// Capped to the most recent 500 entries (see items.js).

function deleteItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  save();
  render();
}

function setUrgency(id, urgency) {
  const item = state.items.find(i => i.id === id);
  if (item) item.urgency = urgency;
  save();
  render();
}

export function initItemActions() {
  const itemInput = $('itemInput');
  const addBtn = $('addBtn');
  const listEl = $('list');

  addBtn.addEventListener('click', () => {
    addItem(itemInput.value);
    itemInput.value = '';
    itemInput.focus();
  });

  itemInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addItem(itemInput.value);
      itemInput.value = '';
    }
  });

  listEl.addEventListener('click', (e) => {
    const checkboxBtn = e.target.closest('.checkbox');
    const deleteBtn = e.target.closest('.delete-btn');
    const urgencyBtn = e.target.closest('.urgency-btn');
    const urgencyOption = e.target.closest('.urgency-option');

    if (checkboxBtn) toggleBought(checkboxBtn.dataset.id);
    if (deleteBtn) deleteItem(deleteBtn.dataset.id);

    if (urgencyOption) {
      // Handle the option click first (it's inside the button, so it would
      // otherwise also trigger the toggle-open logic below)
      setUrgency(urgencyOption.dataset.id, urgencyOption.dataset.urgency);
      return;
    }

    if (urgencyBtn) {
      const menu = urgencyBtn.closest('.urgency-wrap').querySelector('.urgency-menu');
      const wasOpen = menu.classList.contains('show');
      // Close any other open menu, then toggle this one
      document.querySelectorAll('.urgency-menu.show').forEach(m => m.classList.remove('show'));
      if (!wasOpen) menu.classList.add('show');
    }
  });

  // Clicking anywhere outside an urgency menu closes it
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.urgency-btn')) {
      document.querySelectorAll('.urgency-menu.show').forEach(m => m.classList.remove('show'));
    }
  });
}
