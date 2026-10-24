import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builtinTemplates, templateFromItems, itemsToAdd, readTemplate } from '../../js/templates.js';
import { CATEGORY_COLORS } from '../../js/category.js';

const LANGS = ['he', 'en', 'ar', 'es', 'fr', 'de', 'ru', 'pt', 'zh', 'hi'];

test('every language has a ready-made "basics" template with valid categories', () => {
  for (const lang of LANGS) {
    const basics = builtinTemplates(lang).find((t) => t.id === 'builtin:basics');
    assert.ok(basics, `${lang}: no basics template`);
    assert.ok(basics.name.length > 0);
    assert.equal(basics.items.length, 12, lang);
    assert.equal(new Set(basics.items.map((i) => i.name)).size, 12, `${lang}: duplicate names`);
    for (const item of basics.items) {
      assert.ok(item.name.trim().length > 0, lang);
      assert.ok(Object.hasOwn(CATEGORY_COLORS, item.catKey), `${lang}: ${item.name} has category ${item.catKey}`);
    }
  }
});

test('Hebrew also has a Shabbat template; all templates are marked built-in', () => {
  const he = builtinTemplates('he');
  assert.deepEqual(he.map((t) => t.id), ['builtin:basics', 'builtin:shabbat']);
  assert.equal(he[1].name, 'קניות שבת');
  assert.ok(he.every((t) => t.builtin === true));
  assert.deepEqual(builtinTemplates('en').map((t) => t.id), ['builtin:basics']);
  assert.deepEqual(builtinTemplates('xx').map((t) => t.id), ['builtin:basics']); // unknown language -> English
});

test('saving a list as a template keeps name, category, quantity and note, and nothing else', () => {
  const items = [
    { id: 'a', name: ' חלב ', catKey: 'dairy', quantity: '2', note: 'דל שומן', bought: true, boughtAt: 5, urgency: 'high', createdAt: 1, createdBy: 'u' },
    { id: 'b', name: 'לחם', catKey: 'bakery' },
    { id: 'c', name: '   ', catKey: 'other' },
  ];
  assert.deepEqual(templateFromItems('  קניות שבת  ', items), {
    name: 'קניות שבת',
    items: [{ name: 'חלב', catKey: 'dairy', quantity: '2', note: 'דל שומן' }, { name: 'לחם', catKey: 'bakery' }],
  });
});

test('template name and size are limited', () => {
  assert.equal(templateFromItems('x'.repeat(300), [{ name: 'a', catKey: 'other' }]).name.length, 100);
  const many = Array.from({ length: 250 }, (_, i) => ({ name: `i${i}`, catKey: 'other' }));
  assert.equal(templateFromItems('t', many).items.length, 200);
});

test('adding a template skips items that are already waiting on the list, and repeats within it', () => {
  const template = { items: [
    { name: 'חלב', catKey: 'dairy' }, { name: 'ביצים', catKey: 'dairy', quantity: '12' },
    { name: ' חלב ', catKey: 'dairy' }, { name: 'לחם', catKey: 'bakery' },
  ] };
  const current = [
    { name: 'חלב', bought: false },
    { name: 'לחם', bought: true },   // already bought: buying it again is fine
  ];
  assert.deepEqual(itemsToAdd(template, current).map((i) => i.name), ['ביצים', 'לחם']);
  assert.deepEqual(itemsToAdd(template, []).map((i) => i.name), ['חלב', 'ביצים', 'לחם']);
});

test('reading a template from the database repairs or drops bad data', () => {
  const t = readTemplate('t1', {
    name: '<b>x</b>', createdBy: 'u', createdAt: 5,
    items: [{ name: 'חלב', catKey: 'constructor', quantity: 5, note: 'ok' }, null, { name: 7 }, { name: 'לחם', catKey: 'bakery' }],
  });
  assert.equal(t.id, 't1');
  assert.equal(t.name, '<b>x</b>');           // plain text; escaped when displayed
  assert.deepEqual(t.items, [{ name: 'חלב', catKey: 'other', note: 'ok' }, { name: 'לחם', catKey: 'bakery' }]);
  assert.deepEqual(readTemplate('t2', {}).items, []);
  assert.equal(readTemplate('t3', { items: 'nope' }).items.length, 0);
});
