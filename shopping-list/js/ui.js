import { t } from './i18n.js';
import { friendlyErrorKey } from './errors.js';
import { $ } from './util.js';

// Translated, user-friendly text for an error ('' when there is nothing to say).
export function messageFor(err) {
  const key = friendlyErrorKey(err);
  return key ? t()[key] : '';
}

let toastTimer = null;
let toastAction = null;

// A short message at the bottom. With `actionLabel` and `onAction` it carries a button
// (used for "Undo"); such a message stays a little longer.
export function showToast(text, { actionLabel, onAction, duration } = {}) {
  const el = $('toast');
  const button = $('toastAction');
  $('toastText').textContent = text;
  toastAction = onAction || null;
  button.hidden = !onAction;
  button.textContent = actionLabel || '';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, duration ?? (onAction ? 6000 : 4000));
}

export function hideToast() {
  $('toast').classList.remove('show');
  toastAction = null;
}

export function initToast() {
  $('toastAction').addEventListener('click', () => {
    const action = toastAction;
    hideToast();
    if (action) action();
  });
}
