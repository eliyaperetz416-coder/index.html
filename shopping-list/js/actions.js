// Adding, ticking off, deleting and prioritising items on the active list.
import { state } from './state.js';
import { $ } from './util.js';
import { guessCategoryKey } from './category.js';
import { newId } from './ids.js';
import { addItemDoc, setBought, setUrgencyDoc, deleteItemDoc } from './sync.js';

// Each action writes one item document; the list re-renders from the live listener
// (immediately, from the local cache — also offline).
export function addItem(name) {
  if (!name.trim() || !state.activeListId) return;
  addItemDoc({ id: newId(), name: name.trim(), catKey: guessCategoryKey(name, state.lang) });
}

function toggleBought(id) {
  const item = state.items.find(i => i.id === id);
  if (item) setBought(item, !item.bought);
}

function deleteItem(id) {
  deleteItemDoc(id);
}

function setUrgency(id, urgency) {
  setUrgencyDoc(id, urgency);
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
