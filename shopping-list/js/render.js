import { state } from './state.js';
import { t } from './i18n.js';
import { $ } from './util.js';
import { escapeHtml } from './html.js';
import { safeCategoryKey, categoryColor } from './category.js';
import { compareItems } from './model.js';

// The three urgency levels a user can assign to an item (colors only — labels are translated)
export const URGENCY_LEVELS = {
  high: { color: '#ff6b6b' },   // red — urgent
  medium: { color: '#ffd166' }, // yellow — moderate
  low: { color: '#4ade80' },    // green — plenty left
};

const listEl = $('list');
const statsEl = $('stats');

function urgencyColorOf(item) {
  return typeof item.urgency === 'string' && Object.hasOwn(URGENCY_LEVELS, item.urgency) ? URGENCY_LEVELS[item.urgency].color : '';
}

// "2 packs · gluten-free" under the name (nothing when both are empty).
function itemSubline(item) {
  const quantity = typeof item.quantity === 'string' ? item.quantity.trim() : '';
  const note = typeof item.note === 'string' ? item.note.trim() : '';
  if (!quantity && !note) return '';
  return `<span class="item-sub">${quantity ? `<b class="item-qty">${escapeHtml(quantity)}</b>` : ''}${quantity && note ? ' · ' : ''}${escapeHtml(note)}</span>`;
}

// Everything in `item` was written by some list member, so nothing is trusted:
// text is escaped, and category name and colour are derived from the category key.
function renderItemCard(item) {
  const catKey = safeCategoryKey(item.catKey);
  const id = escapeHtml(item.id);
  const el = document.createElement('div');
  el.className = 'item' + (item.bought ? ' bought' : '');
  el.style.setProperty('--cat-color', categoryColor(catKey));
  const urgencyColor = urgencyColorOf(item);
  el.innerHTML = `
    <button class="checkbox" data-id="${id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
    </button>
    <button class="item-main" data-id="${id}">
      <span class="item-name">${escapeHtml(item.name)}</span>
      ${itemSubline(item)}
    </button>
    ${urgencyColor ? `<span class="urgency-square" style="--urgency-color:${urgencyColor}"></span>` : ''}
    <span class="item-cat">${escapeHtml(t().categories[catKey])}</span>
    <div class="urgency-wrap">
      <button class="urgency-btn" data-id="${id}">⋮</button>
      <div class="urgency-menu" data-menu-for="${id}">
        ${Object.entries(URGENCY_LEVELS).map(([key, level]) => `
          <button class="urgency-option" data-id="${id}" data-urgency="${key}">
            <span class="dot" style="background:${level.color}"></span>${t().urgencyLabels[key]}
          </button>
        `).join('')}
      </div>
    </div>
    <button class="delete-btn" data-id="${id}">✕</button>
  `;
  // The row sits on top of a green / red layer that a swipe uncovers (see swipe.js).
  const wrap = document.createElement('div');
  wrap.className = 'item-swipe';
  wrap.innerHTML = '<div class="swipe-bg" aria-hidden="true"><span class="swipe-tick">✓</span><span class="swipe-trash">🗑</span></div>';
  wrap.appendChild(el);
  return wrap;
}

export function render() {
  listEl.innerHTML = '';

  if (state.items.length === 0) {
    listEl.innerHTML = `<div class="empty-state">${t().emptyState}</div>`;
    statsEl.textContent = t().statsFn(0, 0);
    return;
  }

  const unbought = state.items.filter(i => !i.bought);
  const bought = state.items.filter(i => i.bought);

  // Items of the same category sit together (the category tag on each row, no heading
  // line), most urgent first inside each category.
  const sortedUnbought = [...unbought].sort(compareItems);

  sortedUnbought.forEach(item => listEl.appendChild(renderItemCard(item)));

  if (bought.length > 0) {
    const boughtHeader = document.createElement('div');
    boughtHeader.className = 'category-group-title bought-group-title';
    boughtHeader.textContent = `${t().boughtSectionTitle} · ${bought.length}`;
    listEl.appendChild(boughtHeader);
    bought.forEach(item => listEl.appendChild(renderItemCard(item)));
  }

  statsEl.textContent = t().statsFn(state.items.length, bought.length);
}

export function updateHeaderForList(name) {
  const list = state.lists.find(l => l.id === state.activeListId);
  const displayName = name || (list && list.name);
  $('headerTitle').textContent = displayName
    ? `${displayName} 🛒`
    : t().headerTitle;
}
