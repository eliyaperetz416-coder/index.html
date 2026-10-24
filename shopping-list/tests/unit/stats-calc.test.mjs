import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, DAY_MS } from '../../js/stats-calc.js';

const NOW = Date.UTC(2026, 9, 24, 12);
const p = (name, catKey, daysAgo) => ({ name, catKey, timestamp: NOW - daysAgo * DAY_MS });

const history = [
  p('חלב', 'dairy', 1), p('חלב', 'dairy', 4), p('גבינה', 'dairy', 2), p('לחם', 'bakery', 3),   // this week: 4
  p('חלב', 'dairy', 9), p('לחם', 'bakery', 10),                                                  // last week: 2
  p('עגבניות', 'veg', 20), p('עגבניות', 'veg', 25), p('חלב', 'dairy', 28),                      // rest of the month
  p('קפה', 'drinks', 45), p('חלב', 'dairy', 50),                                                 // the month before
  p('ישן', 'other', 90),
];

test('week: this week against the week before', () => {
  const s = computeStats(history, 'week', NOW);
  assert.equal(s.total, 4);
  assert.equal(s.previousTotal, 2);
  assert.equal(s.diff, 2);
});

test('month: the last 30 days against the 30 days before', () => {
  const s = computeStats(history, 'month', NOW);
  assert.equal(s.total, 9);
  assert.equal(s.previousTotal, 2);
  assert.equal(s.diff, 7);
});

test('the window is half open: exactly one period ago belongs to the earlier period', () => {
  const edge = [{ name: 'x', catKey: 'other', timestamp: NOW - 7 * DAY_MS }, { name: 'y', catKey: 'other', timestamp: NOW - 7 * DAY_MS + 1 }];
  const s = computeStats(edge, 'week', NOW);
  assert.equal(s.total, 2);   // both are inside [now-7d, now)
  const s2 = computeStats([{ name: 'x', catKey: 'other', timestamp: NOW - 7 * DAY_MS - 1 }], 'week', NOW);
  assert.equal(s2.total, 0);
  assert.equal(s2.previousTotal, 1);
});

test('categories are counted and sorted, the biggest is the top category', () => {
  const s = computeStats(history, 'week', NOW);
  assert.deepEqual(s.byCategory, [{ catKey: 'dairy', count: 3 }, { catKey: 'bakery', count: 1 }]);
  assert.equal(s.topCategory, 'dairy');
  assert.equal(computeStats([], 'week', NOW).topCategory, null);
});

test('equal counts are ordered like the shop list (dairy before bakery before veg)', () => {
  const s = computeStats([p('a', 'veg', 1), p('b', 'bakery', 1), p('c', 'dairy', 1)], 'week', NOW);
  assert.deepEqual(s.byCategory.map((c) => c.catKey), ['dairy', 'bakery', 'veg']);
});

test('the most bought items in the period, most frequent first', () => {
  const s = computeStats(history, 'month', NOW);
  assert.deepEqual(s.topItems.map((i) => [i.name, i.count]), [['חלב', 4], ['לחם', 2], ['עגבניות', 2], ['גבינה', 1]]);
  assert.equal(s.topItems[0].catKey, 'dairy');
});

test('equal counts: the most recently bought first; the list is limited', () => {
  const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n, i) => p(n, 'other', i + 1));
  const s = computeStats(many, 'week', NOW);
  assert.deepEqual(s.topItems.map((i) => i.name), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(computeStats(many, 'week', NOW, { topLimit: 2 }).topItems.length, 2);
});

test('the same item typed differently (case, spaces, accents) counts as one', () => {
  const s = computeStats([p('Azúcar', 'baking', 1), p(' azucar ', 'baking', 2), p('AZÚCAR', 'baking', 3)], 'week', NOW);
  assert.equal(s.topItems.length, 1);
  assert.equal(s.topItems[0].count, 3);
  assert.equal(s.topItems[0].name, 'Azúcar'); // as typed most recently
});

test('bad categories count as "other"; an unknown period behaves like the week', () => {
  const s = computeStats([p('x', '<script>', 1)], 'whenever', NOW);
  assert.deepEqual(s.byCategory, [{ catKey: 'other', count: 1 }]);
  assert.equal(computeStats(history, 'whenever', NOW).total, 4);
});
