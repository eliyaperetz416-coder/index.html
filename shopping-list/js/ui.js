import { t } from './i18n.js';
import { friendlyErrorKey } from './errors.js';
import { $ } from './util.js';

// Translated, user-friendly text for an error ('' when there is nothing to say).
export function messageFor(err) {
  const key = friendlyErrorKey(err);
  return key ? t()[key] : '';
}

let toastTimer = null;
export function showToast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}
