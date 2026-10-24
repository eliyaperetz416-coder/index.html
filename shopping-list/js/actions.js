// Adding, ticking off, deleting and prioritising items on the active list.
import { state } from './state.js';
import { $ } from './util.js';
import { guessCategoryKey, safeCategoryKey } from './category.js';
import { newId } from './ids.js';
import { addItemDoc, setBought, setUrgencyDoc, deleteItemDoc, deleteItemsDoc } from './sync.js';
import { render } from './render.js';
import { showUndoDelete, showUndoTick } from './undo.js';

// Each action writes one item document; the list re-renders from the live listener
// (immediately, from the local cache — also offline).
// `catKey` comes from an autocomplete suggestion (the category used the last time);
// without one the category is guessed from the name.
export function addItem(name, catKey) {
  if (!name.trim() || !state.activeListId) return;
  const key = catKey && catKey !== 'other' ? safeCategoryKey(catKey) : guessCategoryKey(name, state.lang);
  addItemDoc({ id: newId(), name: name.trim(), catKey: key });
}

export function toggleBought(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  setBought(item, !item.bought);
  showUndoTick(item, !item.bought);
}

export function deleteItem(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  deleteItemDoc(id);
  showUndoDelete([item]);
}

function setUrgency(id, urgency) {
  setUrgencyDoc(id, urgency);
}

// "Clear what's bought": removes every ticked item (they come back with Undo).
export function clearBought() {
  const bought = state.items.filter(i => i.bought);
  if (bought.length === 0) return;
  deleteItemsDoc(bought);
  showUndoDelete(bought);
}

export function initItemActions() {
  $('clearBoughtBtn').addEventListener('click', clearBought);

  const itemInput = $('itemInput');
  const addBtn = $('addBtn');
  const listEl = $('list');

  addBtn.addEventListener('click', () => {
    addItem(itemInput.value);
    itemInput.value = '';
    itemInput.dispatchEvent(new Event('input')); // closes the suggestions
    itemInput.focus();
  });

  listEl.addEventListener('click', (e) => {
    const catHeader = e.target.closest('.cat-header');
    if (catHeader) {
      const key = catHeader.dataset.cat;
      if (state.collapsed.has(key)) state.collapsed.delete(key); else state.collapsed.add(key);
      render();
      return;
    }
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
