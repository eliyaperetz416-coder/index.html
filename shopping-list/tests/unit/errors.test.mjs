import { test } from 'node:test';
import assert from 'node:assert/strict';
import { friendlyErrorKey } from '../../js/errors.js';

const CASES = [
  [{ code: 'permission-denied' }, 'errPermission'],
  [{ code: 'unauthenticated' }, 'errPermission'],
  [{ code: 'not-found' }, 'errNotFound'],
  [{ code: 'unavailable' }, 'errNetwork'],
  [{ code: 'deadline-exceeded' }, 'errNetwork'],
  [{ code: 'auth/network-request-failed' }, 'errNetwork'],
  [{ code: 'auth/popup-blocked' }, 'errPopupBlocked'],
  [{ code: 'auth/popup-closed-by-user' }, null],
  [{ code: 'auth/cancelled-popup-request' }, null],
  [{ code: 'resource-exhausted' }, 'errGeneric'],
  [{ code: 'something-new' }, 'errGeneric'],
  [{ message: 'boom' }, 'errGeneric'],
  [undefined, 'errGeneric'],
  [null, 'errGeneric'],
];

for (const [err, expected] of CASES) {
  test(`${JSON.stringify(err)} -> ${expected}`, () => {
    assert.equal(friendlyErrorKey(err), expected);
  });
}
