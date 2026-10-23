import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleBought, PURCHASE_HISTORY_LIMIT } from '../../js/items.js';

const item = (over = {}) => ({ id: 'a', name: 'Milk', bought: false, catKey: 'dairy', catColor: 'var(--teal)', ...over });

test('marking bought records one purchase', () => {
  const r = toggleBought([item()], [], 'a', 1000);
  assert.equal(r.items[0].bought, true);
  assert.equal(r.items[0].boughtAt, 1000);
  assert.equal(r.purchaseHistory.length, 1);
  assert.deepEqual(r.purchaseHistory[0], { itemId: 'a', name: 'Milk', catKey: 'dairy', catColor: 'var(--teal)', timestamp: 1000 });
});

test('un-marking removes the purchase it created', () => {
  const bought = toggleBought([item()], [], 'a', 1000);
  const undone = toggleBought(bought.items, bought.purchaseHistory, 'a', 2000);
  assert.equal(undone.items[0].bought, false);
  assert.equal(undone.items[0].boughtAt, null);
  assert.equal(undone.purchaseHistory.length, 0);
});

test('buy, un-buy, buy again leaves exactly one purchase', () => {
  let s = toggleBought([item()], [], 'a', 1000);
  s = toggleBought(s.items, s.purchaseHistory, 'a', 2000);
  s = toggleBought(s.items, s.purchaseHistory, 'a', 3000);
  assert.equal(s.purchaseHistory.length, 1);
  assert.equal(s.purchaseHistory[0].timestamp, 3000);
});

test('un-marking keeps purchases of other items and earlier purchases of the same item', () => {
  const history = [
    { itemId: 'old', name: 'Milk', catKey: 'dairy', catColor: 'x', timestamp: 500 },
    { itemId: 'b', name: 'Eggs', catKey: 'dairy', catColor: 'x', timestamp: 900 },
  ];
  let s = toggleBought([item()], history, 'a', 1000);
  s = toggleBought(s.items, s.purchaseHistory, 'a', 2000);
  assert.deepEqual(s.purchaseHistory, history);
});

test('un-marking removes a legacy purchase that has no itemId (matched by name + time)', () => {
  const legacy = [{ name: 'Milk', catKey: 'dairy', catColor: 'x', timestamp: 1000 }];
  const bought = item({ bought: true, boughtAt: 1000 });
  const r = toggleBought([bought], legacy, 'a', 2000);
  assert.equal(r.purchaseHistory.length, 0);
});

test('un-marking an item with no matching purchase changes nothing in the history', () => {
  const history = [{ itemId: 'zzz', name: 'Other', catKey: 'other', catColor: 'x', timestamp: 5 }];
  const r = toggleBought([item({ bought: true, boughtAt: 1000 })], history, 'a', 2000);
  assert.deepEqual(r.purchaseHistory, history);
});

test('unknown id changes nothing', () => {
  const items = [item()];
  const r = toggleBought(items, [], 'nope', 1000);
  assert.deepEqual(r.items, items);
  assert.deepEqual(r.purchaseHistory, []);
});

test('toggleBought does not mutate its inputs', () => {
  const items = Object.freeze([Object.freeze(item())]);
  const history = Object.freeze([]);
  assert.doesNotThrow(() => toggleBought(items, history, 'a', 1000));
});

test('history is capped to the most recent entries', () => {
  const history = Array.from({ length: PURCHASE_HISTORY_LIMIT }, (_, i) => ({ itemId: `h${i}`, name: 'x', catKey: 'other', catColor: 'x', timestamp: i }));
  const r = toggleBought([item()], history, 'a', 99999);
  assert.equal(r.purchaseHistory.length, PURCHASE_HISTORY_LIMIT);
  assert.equal(r.purchaseHistory.at(-1).itemId, 'a');
  assert.equal(r.purchaseHistory[0].itemId, 'h1');
});
