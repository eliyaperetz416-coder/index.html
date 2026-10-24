// Translations live in i18n/<lang>.js. Hebrew (the default and the fallback) is
// bundled; every other language is fetched the first time it is selected.
import he from '../i18n/he.js';
import { state } from './state.js';

export const LANGS = ['he', 'en', 'ar', 'es', 'fr', 'de', 'ru', 'pt', 'zh', 'hi'];

const dictionaries = { he };

// Resolves to true when the dictionary for `lang` is available.
export async function loadLanguage(lang) {
  if (dictionaries[lang]) return true;
  if (!LANGS.includes(lang)) return false;
  try {
    dictionaries[lang] = (await import(`../i18n/${lang}.js`)).default;
    return true;
  } catch (err) {
    console.error(`Could not load language "${lang}":`, err);
    return false;
  }
}

// The dictionary of the current language.
export function t() {
  return dictionaries[state.lang] || he;
}
