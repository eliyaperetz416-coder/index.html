import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../../js/html.js';

test('escapes the five HTML-significant characters', () => {
  assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

test('a value cannot break out of a double- or single-quoted attribute', () => {
  const attack = `x" onmouseover="alert(1)`;
  assert.ok(!escapeHtml(attack).includes('"'));
  assert.ok(!escapeHtml(`x' onfocus='alert(1)`).includes("'"));
});

test('non-strings are converted, null and undefined become empty', () => {
  assert.equal(escapeHtml(42), '42');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('ordinary text, Hebrew and emoji pass through unchanged', () => {
  assert.equal(escapeHtml('חלב 3% 🥛'), 'חלב 3% 🥛');
});
