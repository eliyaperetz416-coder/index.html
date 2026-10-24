import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthKey, historyStartKey, purchaseEntry, isStaleBought, planMigration, sortItems, flattenHistory, itemChanges, REMOVE } from '../../js/model.js';

const DAY = 24 * 60 * 60 * 1000;

test('purchases are grouped in UTC calendar months, so every device picks the same bucket', () => {
  assert.equal(monthKey(Date.UTC(2026, 9, 24, 12)), '2026-10');
  assert.equal(monthKey(Date.UTC(2026, 0, 1, 0, 0, 0)), '2026-01');
  assert.equal(monthKey(Date.UTC(2025, 11, 31, 23, 59, 59)), '2025-12');
});

test('history is read from the start of the month five months back (six buckets)', () => {
  assert.equal(historyStartKey(Date.UTC(2026, 9, 24)), '2026-05');
  assert.equal(historyStartKey(Date.UTC(2026, 1, 3)), '2025-09');
});

test('a purchase entry records the item, its name, a trusted category and the time', () => {
  assert.deepEqual(purchaseEntry({ id: 'a', name: 'חלב', catKey: 'dairy', bought: false }, 123), { itemId: 'a', name: 'חלב', catKey: 'dairy', timestamp: 123 });
  assert.equal(purchaseEntry({ id: 'a', name: 'x', catKey: '<b>' }, 1).catKey, 'other');
});

test('an item bought before today is stale; bought today or not bought is not', () => {
  const now = new Date(2026, 9, 24, 15).getTime();
  const midnight = new Date(2026, 9, 24).getTime();
  assert.equal(isStaleBought({ bought: true, boughtAt: midnight - 1 }, now), true);
  assert.equal(isStaleBought({ bought: true, boughtAt: midnight + 1 }, now), false);
  assert.equal(isStaleBought({ bought: false, boughtAt: midnight - DAY }, now), false);
  assert.equal(isStaleBought({ bought: true, boughtAt: null }, now), false);
});

test('items are shown in the order they were added', () => {
  const sorted = sortItems([{ id: 'b', createdAt: 5 }, { id: 'a', createdAt: 1 }, { id: 'c', createdAt: 1700000000000 }]);
  assert.deepEqual(sorted.map((i) => i.id), ['a', 'b', 'c']);
});

test('history buckets are flattened into one list sorted by time, skipping broken entries', () => {
  const flat = flattenHistory([
    { entries: [{ name: 'b', catKey: 'other', timestamp: 20 }, { name: 'bad' }] },
    { entries: [{ name: 'a', catKey: 'dairy', timestamp: 10 }] },
    { nothing: true },
  ]);
  assert.deepEqual(flat.map((e) => e.name), ['a', 'b']);
});

// ---------- migration of a list written by the old version ----------
const legacy = {
  name: 'בית', code: 'AB3K7M', ownerUid: 'o', members: ['o'],
  items: [
    { id: '1700000000001', name: 'חלב', bought: false, catKey: 'dairy', catName: 'חלבי 🧀', catColor: 'var(--teal)', urgency: 'high' },
    { id: '1700000000002', name: 'לחם', bought: true, boughtAt: Date.UTC(2026, 9, 24, 9), catKey: 'bakery', catName: 'x', catColor: 'x' },
    { id: 'bad/id', name: '  ביצים ', bought: false, catKey: 'constructor', urgency: 'whatever' },
    { id: '1700000000001', name: 'כפילות', bought: false, catKey: 'dairy' },
    null,
  ],
  purchaseHistory: [
    { name: 'לחם', catKey: 'bakery', catColor: 'x', timestamp: Date.UTC(2026, 9, 24, 9) },
    { name: 'גבינה', catKey: 'dairy', catColor: 'x', timestamp: Date.UTC(2026, 8, 30, 9) },
    { itemId: 'z', name: 'קפה', catKey: '<script>', timestamp: Date.UTC(2026, 8, 2) },
    { name: 'broken' },
  ],
};

test('migration keeps every item with its id, order, category and urgency', () => {
  const { items } = planMigration(legacy);
  assert.deepEqual(items.map((i) => i.id), ['1700000000001', '1700000000002', 'legacy-2', 'legacy-3']);
  assert.deepEqual(items[0].data, { name: 'חלב', catKey: 'dairy', bought: false, boughtAt: null, createdAt: 0, urgency: 'high' });
  assert.equal(items[2].data.name, 'ביצים');
  assert.equal(items[2].data.catKey, 'other');
  assert.ok(!('urgency' in items[2].data));
  assert.deepEqual(items.map((i) => i.data.createdAt), [0, 1, 2, 3]);
});

test('migration links a bought item to its purchase so un-ticking it later removes that purchase', () => {
  const { items, buckets } = planMigration(legacy);
  const bread = items[1].data;
  assert.equal(bread.bought, true);
  assert.deepEqual(bread.purchase, { name: 'לחם', catKey: 'bakery', timestamp: Date.UTC(2026, 9, 24, 9) });
  assert.ok(buckets['2026-10'].some((e) => JSON.stringify(e) === JSON.stringify(bread.purchase)));
});

test('migration puts history into monthly buckets and drops only unusable entries', () => {
  const { buckets } = planMigration(legacy);
  assert.deepEqual(Object.keys(buckets).sort(), ['2026-09', '2026-10']);
  assert.equal(buckets['2026-09'].length, 2);
  assert.equal(buckets['2026-09'].find((e) => e.name === 'קפה').catKey, 'other');
  assert.equal(buckets['2026-09'].find((e) => e.name === 'קפה').itemId, 'z');
});

test('migration of an empty or brand-new list does nothing', () => {
  assert.deepEqual(planMigration({ name: 'x' }), { items: [], buckets: {} });
  assert.deepEqual(planMigration({ items: 'nope', purchaseHistory: 7 }), { items: [], buckets: {} });
});

test('migration is deterministic (two members migrating at once write the same thing)', () => {
  assert.deepEqual(planMigration(legacy), planMigration(structuredClone(legacy)));
});

// ---------- editing an item ----------

const base = { id: 'a', name: 'חלב', catKey: 'dairy', quantity: '2', note: 'דל שומן', urgency: 'high' };

test('editing changes only what differs', () => {
  assert.deepEqual(itemChanges(base, { name: 'חלב', catKey: 'dairy', quantity: '2', note: 'דל שומן', urgency: 'high' }), {});
  assert.deepEqual(itemChanges(base, { name: 'חלב 3%', catKey: 'dairy', quantity: '2', note: 'דל שומן', urgency: 'high' }), { name: 'חלב 3%' });
});

test('texts are trimmed; emptied quantity or note are removed from the item', () => {
  assert.deepEqual(itemChanges(base, { name: '  חלב  ', catKey: 'dairy', quantity: '  3 קרטונים ', note: '   ', urgency: 'high' }), { quantity: '3 קרטונים', note: REMOVE });
});

test('an empty name is ignored (the item keeps its name)', () => {
  assert.deepEqual(itemChanges(base, { name: '   ', catKey: 'dairy', quantity: '2', note: 'דל שומן', urgency: 'high' }), {});
});

test('over-long texts are cut to the allowed length', () => {
  const c = itemChanges({ id: 'a', name: 'x', catKey: 'other' }, { name: 'n'.repeat(300), catKey: 'other', quantity: 'q'.repeat(100), note: 'z'.repeat(500), urgency: 'none' });
  assert.equal(c.name.length, 200);
  assert.equal(c.quantity.length, 40);
  assert.equal(c.note.length, 200);
});

test('category and urgency: only known values; "none" removes the urgency', () => {
  assert.deepEqual(itemChanges(base, { name: 'חלב', catKey: 'meat', quantity: '2', note: 'דל שומן', urgency: 'none' }), { catKey: 'meat', urgency: REMOVE });
  assert.deepEqual(itemChanges(base, { name: 'חלב', catKey: '<b>', quantity: '2', note: 'דל שומן', urgency: 'whenever' }), { catKey: 'other' });
  assert.deepEqual(itemChanges({ id: 'a', name: 'x', catKey: 'other' }, { name: 'x', catKey: 'other', quantity: '', note: '', urgency: 'none' }), {});
});
