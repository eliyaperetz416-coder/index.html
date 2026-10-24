// Autocomplete for the "add item" box: names from past purchases and from the items
// the list has had, ranked by how often and how recently they were used.
import { normalizeText, safeCategoryKey } from './category.js';

const clean = (name) => normalizeText(name).replace(/\s+/g, ' ').trim();

// Returns [{ name, catKey }], best first.
export function suggestNames(query, { history, items }, { limit = 5 } = {}) {
  const q = clean(query);
  if (!q) return [];

  const waiting = new Set(items.filter((i) => i && i.bought === false && typeof i.name === 'string').map((i) => clean(i.name)));
  const seen = new Map();
  const note = (name, catKey, time) => {
    if (typeof name !== 'string' || !clean(name)) return;
    const key = clean(name);
    const entry = seen.get(key) || { name: name.trim(), catKey: 'other', count: 0, last: -Infinity };
    entry.count++;
    if (time >= entry.last) { entry.last = time; entry.name = name.trim(); entry.catKey = safeCategoryKey(catKey); }
    seen.set(key, entry);
  };
  for (const e of history) if (e) note(e.name, e.catKey, Number.isFinite(e.timestamp) ? e.timestamp : 0);
  for (const i of items) if (i) note(i.name, i.catKey, Number.isFinite(i.createdAt) ? i.createdAt : 0);

  const ranked = [];
  for (const [key, entry] of seen) {
    if (waiting.has(key)) continue;
    const wordStart = key.split(' ').some((w) => w.startsWith(q));
    if (!key.startsWith(q) && !wordStart) continue;
    ranked.push({ ...entry, key, prefix: key.startsWith(q) });
  }
  ranked.sort((a, b) => (b.prefix - a.prefix) || (b.count - a.count) || (b.last - a.last) || a.key.localeCompare(b.key));
  return ranked.slice(0, limit).map(({ name, catKey }) => ({ name, catKey }));
}
