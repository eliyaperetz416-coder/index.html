import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHorizontalDrag, logicalOffset, swipeOutcome, clampOffset } from '../../js/gestures.js';

test('a drag is horizontal only when it is clearly more sideways than up/down', () => {
  assert.equal(isHorizontalDrag(30, 5), true);
  assert.equal(isHorizontalDrag(-30, 5), true);
  assert.equal(isHorizontalDrag(30, 25), false);   // diagonal: let the page scroll
  assert.equal(isHorizontalDrag(6, 0), false);     // too small to be a swipe yet
  assert.equal(isHorizontalDrag(0, 40), false);
});

test('"toward the end of the line" flips with the text direction', () => {
  assert.equal(logicalOffset(50, 'ltr'), 50);
  assert.equal(logicalOffset(50, 'rtl'), -50);
});

test('left-to-right: swipe right ticks, swipe left deletes', () => {
  assert.equal(swipeOutcome(120, { dir: 'ltr', width: 360 }), 'tick');
  assert.equal(swipeOutcome(-120, { dir: 'ltr', width: 360 }), 'delete');
});

test('right-to-left: swipe left ticks, swipe right deletes', () => {
  assert.equal(swipeOutcome(-120, { dir: 'rtl', width: 360 }), 'tick');
  assert.equal(swipeOutcome(120, { dir: 'rtl', width: 360 }), 'delete');
});

test('a short swipe does nothing; the distance needed is a third of the row, at least 72px', () => {
  assert.equal(swipeOutcome(60, { dir: 'ltr', width: 360 }), null);
  assert.equal(swipeOutcome(100, { dir: 'ltr', width: 360 }), null);   // needs 108
  assert.equal(swipeOutcome(110, { dir: 'ltr', width: 360 }), 'tick');
  assert.equal(swipeOutcome(72, { dir: 'ltr', width: 200 }), 'tick');  // narrow row: 72px floor
  assert.equal(swipeOutcome(71, { dir: 'ltr', width: 200 }), null);
});

test('the row never follows the finger further than the limit', () => {
  assert.equal(clampOffset(60), 60);
  assert.equal(clampOffset(500), 140);
  assert.equal(clampOffset(-500), -140);
});
