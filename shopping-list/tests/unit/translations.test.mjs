import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CATEGORY_KEYWORDS } from '../../js/category.js';

const root = new URL('../../', import.meta.url);
const LANGS = ['he', 'en', 'ar', 'es', 'fr', 'de', 'ru', 'pt', 'zh', 'hi'];

const T = {};
const sources = {};
for (const lang of LANGS) {
  T[lang] = (await import(new URL(`i18n/${lang}.js`, root))).default;
  sources[lang] = readFileSync(new URL(`i18n/${lang}.js`, root), 'utf8');
}

// Keys read through a variable (t()[key]) instead of a literal t().name
const DYNAMIC_KEYS = ['errPermission', 'errNotFound', 'errNetwork', 'errPopupBlocked', 'errGeneric'];
const code = readdirSync(new URL('js/', root)).filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(new URL(`js/${f}`, root), 'utf8')).join('\n');
const staticKeys = new Set([
  ...[...code.matchAll(/\bt\(\)\.(\w+)/g)].map((m) => m[1]),
  ...[...code.matchAll(/\bdict\.(\w+)/g)].map((m) => m[1]),
]);

test('the ten expected languages exist', () => {
  assert.deepEqual(Object.keys(T).sort(), [...LANGS].sort());
});

test('every language has exactly the same keys as Hebrew', () => {
  const reference = Object.keys(T.he).sort();
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(T[lang]).sort(), reference, `keys differ in ${lang}`);
  }
});

test('no key is written twice inside one language file', () => {
  // A repeated key is silently ignored by JavaScript (the old duplicate navList).
  for (const lang of LANGS) {
    const keys = [...sources[lang].matchAll(/^  (\w+):/gm)].map((m) => m[1]);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    assert.deepEqual(dupes, [], `${lang} repeats: ${dupes.join(', ')}`);
  }
});

test('values have the same type in every language and no text is empty', () => {
  for (const [key, ref] of Object.entries(T.he)) {
    for (const lang of LANGS) {
      const v = T[lang][key];
      assert.equal(typeof v, typeof ref, `${lang}.${key} has a different type`);
      if (typeof v === 'string') assert.ok(v.trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('every key the code reads exists in every language', () => {
  for (const key of [...staticKeys, ...DYNAMIC_KEYS]) {
    for (const lang of LANGS) assert.ok(key in T[lang], `${lang} is missing "${key}"`);
  }
});

test('no key is unused', () => {
  const used = new Set([...staticKeys, ...DYNAMIC_KEYS]);
  const unused = Object.keys(T.he).filter((k) => !used.has(k));
  assert.deepEqual(unused, [], `unused keys: ${unused.join(', ')}`);
});

test('category names exist for every category (and "other") in every language', () => {
  const cats = [...Object.keys(CATEGORY_KEYWORDS.en), 'other'].sort();
  for (const lang of LANGS) assert.deepEqual(Object.keys(T[lang].categories).sort(), cats, lang);
});

test('urgency labels cover high / medium / low in every language', () => {
  for (const lang of LANGS) assert.deepEqual(Object.keys(T[lang].urgencyLabels).sort(), ['high', 'low', 'medium'], lang);
});

test('function-valued texts return text', () => {
  for (const lang of LANGS) {
    assert.match(T[lang].statsFn(7, 3), /7/);
    assert.match(T[lang].statsMoreThanLastWeek(4), /4/);
    assert.match(T[lang].statsLessThanLastWeek(4), /4/);
  }
});

test('only Hebrew and Arabic are right-to-left', () => {
  for (const lang of LANGS) assert.equal(T[lang].dir, ['he', 'ar'].includes(lang) ? 'rtl' : 'ltr', lang);
});
