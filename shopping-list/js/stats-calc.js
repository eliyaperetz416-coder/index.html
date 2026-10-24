// The numbers behind the stats screen (pure functions, unit tested).
import { normalizeText, safeCategoryKey, CATEGORY_ORDER } from './category.js';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const PERIOD_DAYS = { week: 7, month: 30 };

const inRange = (history, from, to) => history.filter((p) => p.timestamp >= from && p.timestamp < to);

// `period` is 'week' (the last 7 days) or 'month' (the last 30). The previous period is
// the same length just before it, for the comparison.
export function computeStats(history, period, now = Date.now(), { topLimit = 5 } = {}) {
  const span = (PERIOD_DAYS[period] ?? PERIOD_DAYS.week) * DAY_MS;
  const current = inRange(history, now - span, now);
  const previous = inRange(history, now - 2 * span, now - span);

  const categories = new Map();
  const items = new Map();
  for (const purchase of current) {
    const catKey = safeCategoryKey(purchase.catKey);
    categories.set(catKey, (categories.get(catKey) || 0) + 1);

    const key = normalizeText(purchase.name).replace(/\s+/g, ' ').trim();
    const entry = items.get(key) || { name: purchase.name, catKey, count: 0, last: -Infinity };
    entry.count++;
    if (purchase.timestamp >= entry.last) { entry.last = purchase.timestamp; entry.name = purchase.name.trim(); entry.catKey = catKey; }
    items.set(key, entry);
  }

  const byCategory = [...categories]
    .map(([catKey, count]) => ({ catKey, count }))
    .sort((a, b) => (b.count - a.count) || (CATEGORY_ORDER.indexOf(a.catKey) - CATEGORY_ORDER.indexOf(b.catKey)));
  const topItems = [...items.values()]
    .sort((a, b) => (b.count - a.count) || (b.last - a.last))
    .slice(0, topLimit)
    .map(({ name, catKey, count }) => ({ name, catKey, count }));

  return {
    total: current.length,
    previousTotal: previous.length,
    diff: current.length - previous.length,
    byCategory,
    topCategory: byCategory.length ? byCategory[0].catKey : null,
    topItems,
  };
}
