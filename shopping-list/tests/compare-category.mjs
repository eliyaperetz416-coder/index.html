// Dev tool: runs the cases from category.test.mjs through the ORIGINAL matcher
// (taken from the baseline commit) and the new one, and prints where they differ.
//   node tests/compare-category.mjs
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { guessCategoryKey } from '../js/category.js';

const baseline = execSync('git show 0ecb219:shopping-list/index.html', { cwd: new URL('.', import.meta.url).pathname, maxBuffer: 1 << 26 }).toString();
const start = baseline.indexOf('const CATEGORY_KEYWORDS = {');
const end = baseline.indexOf('\n  };', start) + 5;
const OLD = vm.runInNewContext(baseline.slice(start, end).replace('const CATEGORY_KEYWORDS =', '(') .replace(/;\s*$/, ')'));

function oldGuess(name, lang) {
  const lower = name.trim().toLowerCase();
  const set = OLD[lang] || OLD.en;
  for (const key in set) if (set[key].some((k) => lower.includes(k))) return key;
  return 'other';
}

const src = readFileSync(new URL('./unit/category.test.mjs', import.meta.url), 'utf8');
const cases = [...src.matchAll(/^\s*\['(\w+)', '((?:[^'\\]|\\.)*)', '(\w+)'\],/gm)].map((m) => [m[1], m[2].replace(/\\'/g, "'"), m[3]]);

let oldWrong = 0, newWrong = 0;
const rows = [];
for (const [lang, input, expected] of cases) {
  const before = oldGuess(input, lang);
  const after = guessCategoryKey(input, lang);
  if (before !== expected) oldWrong++;
  if (after !== expected) newWrong++;
  if (before !== after) rows.push({ lang, input, before, after, expected });
}
console.table(rows);
console.log(`cases: ${cases.length}   original matcher wrong: ${oldWrong}   new matcher wrong: ${newWrong}`);
