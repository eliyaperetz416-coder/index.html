import { state } from './state.js';
import { t } from './i18n.js';
import { $ } from './util.js';
import { escapeHtml } from './html.js';
import { safeCategoryKey, categoryColor } from './category.js';

// The three urgency levels a user can assign to an item (colors only — labels are translated)
export const URGENCY_LEVELS = {
  high: { color: '#ff6b6b' },   // red — urgent
  medium: { color: '#ffd166' }, // yellow — moderate
  low: { color: '#4ade80' },    // green — plenty left
};

// Fixed display order for category groups — categories not in this list (shouldn't
// happen, but as a safety net) fall back to appearing after all of these.
const CATEGORY_ORDER = ['dairy', 'bakery', 'veg', 'fruit', 'meat', 'frozen', 'snacks', 'drinks', 'baking', 'clean', 'other'];

const listEl = $('list');
const statsEl = $('stats');

function urgencyColorOf(item) {
  return typeof item.urgency === 'string' && Object.hasOwn(URGENCY_LEVELS, item.urgency) ? URGENCY_LEVELS[item.urgency].color : '';
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
    <span class="item-name">${escapeHtml(item.name)}</span>
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
  return el;
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

  // Sort unbought items by CATEGORY_ORDER (grouped visually via each item's own
  // category tag — no separate group headers), so items of the same category still
  // end up next to each other without an extra heading line.
  const sortedUnbought = [...unbought].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(safeCategoryKey(a.catKey));
    const bi = CATEGORY_ORDER.indexOf(safeCategoryKey(b.catKey));
    return (ai === -1 ? CATEGORY_ORDER.length : ai) - (bi === -1 ? CATEGORY_ORDER.length : bi);
  });

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
