import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestNames } from '../../js/suggest.js';

const DAY = 86400000;
const h = (name, catKey, ago) => ({ name, catKey, timestamp: 1_000_000 - ago * DAY });

test('suggests previously bought names that start with what was typed', () => {
  const history = [h('חלב', 'dairy', 5), h('חלב', 'dairy', 12), h('חלה', 'bakery', 7), h('לחם', 'bakery', 3)];
  assert.deepEqual(suggestNames('חל', { history, items: [] }).map((s) => s.name), ['חלב', 'חלה']);
  assert.deepEqual(suggestNames('לח', { history, items: [] }).map((s) => s.name), ['לחם']);
});

test('the most frequently bought comes first, then the most recent', () => {
  const history = [h('milk', 'dairy', 30), h('milk', 'dairy', 20), h('mint', 'other', 1), h('mild cheddar', 'dairy', 2), h('mild cheddar', 'dairy', 4), h('milk', 'dairy', 10)];
  assert.deepEqual(suggestNames('mi', { history, items: [] }).map((s) => s.name), ['milk', 'mild cheddar', 'mint']);
});

test('a name that starts with the text beats one that only has a word starting with it', () => {
  const history = [h('whole milk', 'dairy', 1), h('whole milk', 'dairy', 2), h('milk chocolate', 'snacks', 9)];
  assert.deepEqual(suggestNames('milk', { history, items: [] }).map((s) => s.name), ['milk chocolate', 'whole milk']);
});

test('words in the middle of a name match too', () => {
  const history = [h('חלב שקדים', 'dairy', 1)];
  assert.deepEqual(suggestNames('שק', { history, items: [] }).map((s) => s.name), ['חלב שקדים']);
});

test('current and earlier items on the list count as well, with their category', () => {
  const items = [{ name: 'זעתר', catKey: 'baking', bought: true, createdAt: 5 }];
  assert.deepEqual(suggestNames('זע', { history: [], items }), [{ name: 'זעתר', catKey: 'baking' }]);
});

test('accents and capital letters do not matter', () => {
  const history = [h('Azúcar', 'baking', 1)];
  assert.deepEqual(suggestNames('azu', { history, items: [] }).map((s) => s.name), ['Azúcar']);
});

test('names already waiting unbought on the list are not suggested again', () => {
  const history = [h('חלב', 'dairy', 1), h('חלה', 'bakery', 2)];
  const items = [{ name: ' חלב ', catKey: 'dairy', bought: false, createdAt: 1 }];
  assert.deepEqual(suggestNames('חל', { history, items }).map((s) => s.name), ['חלה']);
});

test('at most five suggestions by default, and nothing for an empty text', () => {
  const history = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map((n, i) => h(n, 'other', i));
  assert.equal(suggestNames('a', { history, items: [] }).length, 5);
  assert.equal(suggestNames('a', { history, items: [] }, { limit: 2 }).length, 2);
  assert.deepEqual(suggestNames('  ', { history, items: [] }), []);
});

test('the category of the most recent purchase wins, and bad categories become "other"', () => {
  const history = [h('x', 'dairy', 10), h('x', 'meat', 1), h('y', '<script>', 1)];
  assert.equal(suggestNames('x', { history, items: [] })[0].catKey, 'meat');
  assert.equal(suggestNames('y', { history, items: [] })[0].catKey, 'other');
});

test('broken entries are ignored', () => {
  const history = [null, { name: 5 }, {}, h('חלב', 'dairy', 1)];
  assert.deepEqual(suggestNames('ח', { history, items: [null, {}] }).map((s) => s.name), ['חלב']);
});
