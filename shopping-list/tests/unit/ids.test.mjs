import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newId } from '../../js/ids.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('newId returns a v4 UUID', () => {
  assert.match(newId(), UUID_V4);
});

test('newId does not collide across many calls in the same millisecond', () => {
  const ids = new Set();
  for (let i = 0; i < 20000; i++) ids.add(newId());
  assert.equal(ids.size, 20000);
});

test('newId still returns a v4 UUID when crypto.randomUUID is missing (older Safari)', () => {
  const fakeCrypto = { getRandomValues: (arr) => globalThis.crypto.getRandomValues(arr) };
  assert.match(newId(fakeCrypto), UUID_V4);
});
