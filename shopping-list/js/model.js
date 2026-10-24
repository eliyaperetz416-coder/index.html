// The data model (schema version 2) and the migration from version 1. Pure functions.
//
//   lists/{listId}                  name, code, ownerUid, members, createdAt, schemaVersion: 2
//   lists/{listId}/items/{itemId}   { name, catKey, bought, boughtAt, createdAt, createdBy,
//                                     urgency?, purchase? }
//   lists/{listId}/history/{YYYY-MM} { entries: [{ itemId?, name, catKey, timestamp }] }
//
// Version 1 kept everything in two arrays on the list document (`items`,
// `purchaseHistory`). Those arrays are left in place as a backup after migrating.
import { safeCategoryKey, CATEGORY_ORDER } from './category.js';

export const SCHEMA_VERSION = 2;
export const HISTORY_MONTHS = 6;
export const URGENCIES = ['high', 'medium', 'low'];
const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;

// Months are taken in UTC so that every device files a purchase in the same bucket.
export function monthKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 7);
}

// The first month whose bucket is read (HISTORY_MONTHS buckets up to the current one).
export function historyStartKey(now, months = HISTORY_MONTHS) {
  const d = new Date(now);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  return monthKey(d.getTime());
}

// The history entry for buying `item` at `timestamp`. The same object is stored on the
// item (as `purchase`), so un-ticking can remove exactly this entry again.
export function purchaseEntry(item, timestamp) {
  return { itemId: item.id, name: item.name, catKey: safeCategoryKey(item.catKey), timestamp };
}

function normalizeEntry(e) {
  if (!e || typeof e.name !== 'string' || !Number.isFinite(e.timestamp)) return null;
  const entry = { name: e.name.slice(0, 200), catKey: safeCategoryKey(e.catKey), timestamp: e.timestamp };
  if (typeof e.itemId === 'string') entry.itemId = e.itemId;
  return entry;
}

// Bought before today's local midnight: cleared from the list the next day.
export function isStaleBought(item, now = Date.now()) {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return item.bought === true && Number.isFinite(item.boughtAt) && item.boughtAt < midnight.getTime();
}

export function sortItems(items) {
  return [...items].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

const URGENCY_RANK = { high: 0, medium: 1, low: 2 };

// The order of items still to buy: by category, then the most urgent first inside each
// category (must-have, almost out, needed, unspecified), then the oldest first.
export function compareItems(a, b) {
  const rank = (i) => URGENCY_RANK[i.urgency] ?? 3;
  return (CATEGORY_ORDER.indexOf(safeCategoryKey(a.catKey)) - CATEGORY_ORDER.indexOf(safeCategoryKey(b.catKey)))
    || (rank(a) - rank(b))
    || ((a.createdAt ?? 0) - (b.createdAt ?? 0));
}

// All entries of the given history bucket documents, oldest first.
export function flattenHistory(bucketDocs) {
  const all = [];
  for (const data of bucketDocs) {
    if (!Array.isArray(data?.entries)) continue;
    for (const e of data.entries) { const n = normalizeEntry(e); if (n) all.push(n); }
  }
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

// What to write to move a version-1 list to version 2. Deterministic: two members
// migrating the same list at the same time produce identical documents.
export function planMigration(listData) {
  const entries = (Array.isArray(listData.purchaseHistory) ? listData.purchaseHistory : [])
    .map(normalizeEntry).filter(Boolean);
  const buckets = {};
  for (const e of entries) (buckets[monthKey(e.timestamp)] ||= []).push(e);

  const items = [];
  const usedIds = new Set();
  (Array.isArray(listData.items) ? listData.items : []).forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const id = typeof raw.id === 'string' && VALID_ID.test(raw.id) && !usedIds.has(raw.id) ? raw.id : `legacy-${index}`;
    usedIds.add(id);
    const bought = raw.bought === true;
    const boughtAt = bought && Number.isFinite(raw.boughtAt) ? raw.boughtAt : null;
    const data = {
      name: String(raw.name ?? '').trim().slice(0, 200) || '?',
      catKey: safeCategoryKey(raw.catKey),
      bought,
      boughtAt,
      createdAt: index, // keeps the old order; new items use Date.now() and sort after
    };
    if (URGENCIES.includes(raw.urgency)) data.urgency = raw.urgency;
    if (boughtAt !== null) {
      const match = entries.find((e) => e.timestamp === boughtAt && (e.itemId ? e.itemId === raw.id : e.name === raw.name));
      if (match) data.purchase = match;
    }
    items.push({ id, data });
  });
  return { items, buckets };
}

// ============================================================
// EDITING AN ITEM
// ============================================================
export const REMOVE = Symbol('remove'); // "delete this field from the item"
export const LIMITS = { name: 200, quantity: 40, note: 200 };

// What to write to turn `item` into what the edit form now says. Only differences are
// returned; texts are trimmed and cut to length; an emptied quantity / note / urgency
// is REMOVE; an empty name is ignored.
export function itemChanges(item, form) {
  const changes = {};
  const name = String(form.name ?? '').trim().slice(0, LIMITS.name);
  if (name && name !== item.name) changes.name = name;

  const catKey = safeCategoryKey(form.catKey);
  if (catKey !== safeCategoryKey(item.catKey)) changes.catKey = catKey;

  for (const field of ['quantity', 'note']) {
    const value = String(form[field] ?? '').trim().slice(0, LIMITS[field]);
    const before = item[field] ?? '';
    if (value !== before) changes[field] = value === '' ? REMOVE : value;
  }

  // 'none' clears the urgency; anything that is not a known level leaves it alone.
  if (form.urgency === 'none' && item.urgency != null) changes.urgency = REMOVE;
  else if (URGENCIES.includes(form.urgency) && form.urgency !== item.urgency) changes.urgency = form.urgency;
  return changes;
}

// Shopping mode: the list grouped by category (in list order). Inside a group the items
// still to buy come first (most urgent first), then the ones already in the basket.
export function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const catKey = safeCategoryKey(item.catKey);
    if (!groups.has(catKey)) groups.set(catKey, []);
    groups.get(catKey).push(item);
  }
  return CATEGORY_ORDER.filter((key) => groups.has(key)).map((catKey) => {
    const all = groups.get(catKey);
    const todo = all.filter((i) => !i.bought).sort(compareItems);
    const done = all.filter((i) => i.bought).sort((a, b) => (b.boughtAt ?? 0) - (a.boughtAt ?? 0));
    return { catKey, items: [...todo, ...done], boughtCount: done.length, done: todo.length === 0 };
  });
}
