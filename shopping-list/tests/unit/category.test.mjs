import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessCategoryKey, CATEGORY_KEYWORDS, normalizeText } from '../../js/category.js';

// [language, input, expected category]. Cases marked "was wrong" were
// mis-categorised by the original substring (includes) matcher.
const CASES = [
  // English
  ['en', 'eggs', 'dairy'],
  ['en', '  MILK  ', 'dairy'],
  ['en', 'chocolate milk', 'drinks'],
  ['en', 'dark chocolate', 'snacks'],
  ['en', 'update', 'other'],           // was wrong: "date"
  ['en', 'candidates', 'other'],       // was wrong: "date"
  ['en', 'dates', 'fruit'],
  ['en', 'medjool date', 'fruit'],
  ['en', 'strawberries', 'fruit'],
  ['en', 'ice cream', 'frozen'],
  ['en', 'whipped cream', 'dairy'],
  ['en', 'sugar', 'baking'],           // listed in two categories before
  ['en', 'brown sugar', 'baking'],
  ['en', 'cookies', 'snacks'],         // listed in two categories before
  ['en', 'corn', 'veg'],
  ['en', 'cornflakes', 'other'],       // was wrong: "corn"
  ['en', 'orange juice', 'drinks'],
  ['en', 'tomato paste', 'baking'],
  ['en', 'olive oil', 'baking'],
  ['en', 'toilet paper', 'clean'],
  ['en', 'pepperoni', 'meat'],         // was wrong: "pepper" (veg)
  ['en', 'pearl necklace', 'other'],   // was wrong: "pear"
  ['en', 'rollerblades', 'other'],     // was wrong: "roll"
  ['en', 'saltine crackers', 'snacks'],// was wrong: "salt"
  ['en', 'bunch of bananas', 'fruit'],
  ['en', '', 'other'],
  ['en', '   ', 'other'],
  // Spanish
  ['es', 'fresas', 'fruit'],
  ['es', 'carne de res', 'meat'],
  ['es', 'salsa', 'other'],            // was wrong: "sal"
  ['es', 'sal', 'baking'],
  ['es', 'pan integral', 'bakery'],
  ['es', 'panela', 'other'],           // was wrong: "pan"
  ['es', 'aceite de oliva', 'baking'],
  ['es', 'jugo de naranja', 'drinks'],
  ['es', 'leche', 'dairy'],
  ['es', 'azúcar', 'baking'],
  ['es', 'azucar', 'baking'],          // typed without the accent
  ['es', 'galletas', 'snacks'],
  ['es', 'papas fritas', 'snacks'],
  // German
  ['de', 'Seife', 'clean'],            // was wrong: "ei"
  ['de', 'Heidelbeeren', 'other'],     // was wrong: "ei"
  ['de', 'Weizenmehl', 'baking'],      // was wrong: "ei"
  ['de', 'Eier', 'dairy'],
  ['de', '2 Eier', 'dairy'],
  ['de', 'Zwiebeln', 'veg'],
  ['de', 'Vollkornbrot', 'bakery'],
  ['de', 'Orangensaft', 'drinks'],
  ['de', 'Schweinefleisch', 'meat'],
  ['de', 'Schwein', 'meat'],           // "wein" must not match inside it
  ['de', 'Blumenkohl', 'veg'],
  ['de', 'Zucker', 'baking'],
  ['de', 'Eis', 'frozen'],
  ['de', 'Schokolade', 'snacks'],
  // French
  ['fr', 'œufs', 'dairy'],
  ['fr', 'oeufs', 'dairy'],
  ['fr', 'pain de mie', 'bakery'],
  ['fr', 'seau', 'other'],             // was wrong: "eau"
  ['fr', 'jus d\'orange', 'drinks'],
  ['fr', 'pomme de terre', 'veg'],
  ['fr', 'pommes', 'fruit'],
  ['fr', 'sucre', 'baking'],
  ['fr', 'biscuits', 'snacks'],
  ['fr', 'chou-fleur', 'veg'],
  // Russian
  ['ru', 'молоко', 'dairy'],
  ['ru', 'молока', 'dairy'],
  ['ru', 'яйца', 'dairy'],
  ['ru', 'масло', 'dairy'],
  ['ru', 'подсолнечное масло', 'baking'],
  ['ru', 'сахар', 'baking'],
  ['ru', 'печенье', 'snacks'],
  ['ru', 'сок', 'drinks'],
  ['ru', 'соковыжималка', 'other'],    // was wrong: "сок"
  ['ru', 'чайник', 'other'],           // was wrong: "чай"
  // Portuguese
  ['pt', 'leite', 'dairy'],
  ['pt', 'ovos', 'dairy'],
  ['pt', 'açúcar', 'baking'],
  ['pt', 'suco de laranja', 'drinks'],
  ['pt', 'bolacha', 'snacks'],
  ['pt', 'pimentão', 'veg'],
  // Chinese (no spaces: substring match, longest keyword wins)
  ['zh', '鸡蛋', 'dairy'],
  ['zh', '苹果', 'fruit'],
  ['zh', '苹果汁', 'drinks'],
  ['zh', '水果', 'fruit'],
  ['zh', '水', 'drinks'],
  ['zh', '白糖', 'baking'],
  ['zh', '饼干', 'snacks'],
  ['zh', '面包', 'bakery'],
  // Hindi
  ['hi', 'दूध', 'dairy'],
  ['hi', 'आटा', 'baking'],
  ['hi', 'चीनी', 'baking'],
  ['hi', 'टमाटर', 'veg'],
  // Arabic
  ['ar', 'حليب', 'dairy'],
  ['ar', 'الحليب', 'dairy'],
  ['ar', 'سكر', 'baking'],
  ['ar', 'الخبز', 'bakery'],
  ['ar', 'عصير برتقال', 'drinks'],
  // Hebrew
  ['he', 'חלב', 'dairy'],
  ['he', 'החלב', 'dairy'],
  ['he', 'והחלב', 'dairy'],
  ['he', 'חלבון', 'other'],            // was wrong: "חלב"
  ['he', 'ביצים', 'dairy'],
  ['he', 'סוכר', 'baking'],            // listed in two categories before
  ['he', 'עוגיות', 'snacks'],          // listed in two categories before
  ['he', 'עוגה', 'bakery'],
  ['he', 'מיץ תפוזים', 'drinks'],
  ['he', 'תפוחים', 'fruit'],
  ['he', 'תפוח אדמה', 'veg'],
  ['he', 'תפוחי אדמה', 'veg'],
  ['he', 'מלחיה', 'other'],            // was wrong: "מלח"
  ['he', 'שמן זית', 'baking'],
  ['he', 'פלפל', 'veg'],
  ['he', 'פלפל שחור', 'baking'],
  ['he', 'נייר טואלט', 'clean'],
  ['he', 'הלחם', 'bakery'],
  ['he', 'עגבניות', 'veg'],
  ['he', 'מלפפונים', 'veg'],
];

for (const [lang, input, expected] of CASES) {
  test(`${lang}: "${input}" -> ${expected}`, () => {
    assert.equal(guessCategoryKey(input, lang), expected);
  });
}

test('unknown language falls back to the English keywords', () => {
  assert.equal(guessCategoryKey('milk', 'xx'), 'dairy');
});

test('non-string input does not throw', () => {
  assert.equal(guessCategoryKey(undefined, 'en'), 'other');
  assert.equal(guessCategoryKey(null, 'he'), 'other');
});

test('every language defines the same categories', () => {
  const reference = Object.keys(CATEGORY_KEYWORDS.en).sort();
  for (const [lang, sets] of Object.entries(CATEGORY_KEYWORDS)) {
    assert.deepEqual(Object.keys(sets).sort(), reference, `categories differ in ${lang}`);
  }
});

test('no keyword is listed under two categories in the same language', () => {
  for (const [lang, sets] of Object.entries(CATEGORY_KEYWORDS)) {
    const seen = new Map();
    for (const [cat, words] of Object.entries(sets)) {
      for (const word of words) {
        const key = normalizeText(word);
        assert.ok(!seen.has(key) || seen.get(key) === cat,
          `${lang}: "${word}" is in both ${seen.get(key)} and ${cat}`);
        seen.set(key, cat);
      }
    }
  }
});

import { safeCategoryKey, categoryColor, CATEGORY_COLORS } from '../../js/category.js';

test('stored category keys are only trusted if they are real categories', () => {
  assert.equal(safeCategoryKey('dairy'), 'dairy');
  for (const bad of ['constructor', '__proto__', 'toString', '"><img src=x>', '', null, undefined, 7]) {
    assert.equal(safeCategoryKey(bad), 'other', String(bad));
  }
});

test('colours are derived from the category key, never from stored text', () => {
  assert.equal(categoryColor('meat'), CATEGORY_COLORS.meat);
  assert.equal(categoryColor('constructor'), CATEGORY_COLORS.other);
  assert.equal(categoryColor('red; background:url(http://evil)'), CATEGORY_COLORS.other);
});
