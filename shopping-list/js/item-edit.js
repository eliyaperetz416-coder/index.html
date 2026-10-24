// The "edit item" sheet: name, quantity, note, category and urgency of one item.
import { state } from './state.js';
import { $ } from './util.js';
import { t } from './i18n.js';
import { escapeHtml } from './html.js';
import { CATEGORY_COLORS, safeCategoryKey } from './category.js';
import { URGENCIES, itemChanges } from './model.js';
import { updateItemDoc, deleteItemDoc } from './sync.js';
import { showUndoDelete } from './undo.js';

let editingId = null;
let urgency = 'none';

export function applyItemEditLanguage() {
  const dict = t();
  $('itemEditTitle').textContent = dict.editItemTitle;
  $('editNameLabel').textContent = dict.itemNameLabel;
  $('editQuantityLabel').textContent = dict.quantityLabel;
  $('editNoteLabel').textContent = dict.noteLabel;
  $('editCategoryLabel').textContent = dict.categoryLabel;
  $('editUrgencyLabel').textContent = dict.urgencyLabel;
  $('editQuantity').placeholder = dict.quantityPlaceholder;
  $('editNote').placeholder = dict.notePlaceholder;
  $('editSaveBtn').textContent = dict.saveLabel;
  $('editCancelBtn').textContent = dict.cancelLabel;
  $('editDeleteBtn').textContent = dict.deleteLabel;
  const select = $('editCategory');
  const current = select.value;
  select.innerHTML = Object.keys(CATEGORY_COLORS).map((key) => `<option value="${key}">${escapeHtml(dict.categories[key])}</option>`).join('');
  if (current) select.value = current;
  renderUrgency();
}

function renderUrgency() {
  const dict = t();
  const labels = { none: dict.urgencyNone, ...dict.urgencyLabels };
  $('editUrgency').innerHTML = ['none', ...URGENCIES].map((key) =>
    `<button type="button" role="radio" aria-checked="${key === urgency}" data-urgency="${key}">${escapeHtml(labels[key])}</button>`).join('');
}

export function openItemEdit(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  editingId = itemId;
  urgency = URGENCIES.includes(item.urgency) ? item.urgency : 'none';
  $('editName').value = item.name;
  $('editQuantity').value = item.quantity || '';
  $('editNote').value = item.note || '';
  $('editCategory').value = safeCategoryKey(item.catKey);
  renderUrgency();
  $('itemEditOverlay').classList.add('show');
  $('editName').focus();
}

function close() {
  $('itemEditOverlay').classList.remove('show');
  editingId = null;
}

export function initItemEdit() {
  const overlay = $('itemEditOverlay');

  $('list').addEventListener('click', (e) => {
    const main = e.target.closest('.item-main');
    if (main) openItemEdit(main.dataset.id);
  });

  $('editUrgency').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-urgency]');
    if (!btn) return;
    urgency = btn.dataset.urgency;
    renderUrgency();
  });

  const save = () => {
    const item = state.items.find((i) => i.id === editingId);
    if (item) {
      updateItemDoc(item.id, itemChanges(item, {
        name: $('editName').value, quantity: $('editQuantity').value, note: $('editNote').value,
        catKey: $('editCategory').value, urgency,
      }));
    }
    close();
  };
  $('editSaveBtn').addEventListener('click', save);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); }
    if (e.key === 'Escape') close();
  });
  $('editCancelBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  $('editDeleteBtn').addEventListener('click', () => {
    const item = state.items.find((i) => i.id === editingId);
    close();
    if (item) { deleteItemDoc(item.id); showUndoDelete([item]); }
  });
}
