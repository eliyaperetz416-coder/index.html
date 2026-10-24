import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateJoinCode, normalizeJoinCode, isValidJoinCode, JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from '../../js/codes.js';

test('new codes are 8 characters from the unambiguous alphabet (no 0/O/1/I)', () => {
  assert.equal(JOIN_CODE_LENGTH, 8);
  assert.equal(JOIN_CODE_ALPHABET.length, 32);
  assert.ok(!/[01OI]/.test(JOIN_CODE_ALPHABET));
  for (let i = 0; i < 500; i++) {
    const code = generateJoinCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
  }
});

test('codes come from crypto.getRandomValues, not Math.random', () => {
  let called = 0;
  const fake = { getRandomValues: (arr) => { called++; arr.fill(0); return arr; } };
  assert.equal(generateJoinCode(fake), 'AAAAAAAA');
  assert.equal(called, 1);
});

test('every alphabet character is equally likely (32 divides 256, so no bias)', () => {
  const fake = { getRandomValues: (arr) => { arr.forEach((_, i) => { arr[i] = i * 37; }); return arr; } };
  assert.equal(256 % JOIN_CODE_ALPHABET.length, 0);
  assert.match(generateJoinCode(fake), /^[A-HJ-NP-Z2-9]{8}$/);
});

test('typed codes are normalised: spaces, dashes and lower case are forgiven', () => {
  assert.equal(normalizeJoinCode('  ab3k-7mpq '), 'AB3K7MPQ');
  assert.equal(normalizeJoinCode('ab3 k7m'), 'AB3K7M');
});

test('old 6-character codes and new 8-character codes are valid; anything else is not', () => {
  assert.ok(isValidJoinCode('AB3K7M'));
  assert.ok(isValidJoinCode('AB3K7MPQ'));
  for (const bad of ['', 'AB3K7', 'AB3K7MP', 'AB3K7MPQR', 'AB0K7M', 'ABIK7M', 'ab3k7m', 'AB3K7M"', null, undefined, 42]) {
    assert.ok(!isValidJoinCode(bad), `${bad} should be invalid`);
  }
});
