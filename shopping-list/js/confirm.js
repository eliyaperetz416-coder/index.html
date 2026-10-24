// A small yes / no dialog that matches the rest of the app (resolves to true or false).
import { $ } from './util.js';
import { t } from './i18n.js';

let resolveCurrent = null;

export function confirmDialog({ text, okLabel, cancelLabel = t().cancelLabel, danger = false }) {
  if (resolveCurrent) resolveCurrent(false);
  $('confirmText').textContent = text;
  const ok = $('confirmOk');
  ok.textContent = okLabel;
  ok.classList.toggle('danger-btn', danger);
  $('confirmCancel').textContent = cancelLabel;
  $('confirmOverlay').classList.add('show');
  ok.focus();
  return new Promise((resolve) => { resolveCurrent = resolve; });
}

function settle(value) {
  $('confirmOverlay').classList.remove('show');
  const resolve = resolveCurrent;
  resolveCurrent = null;
  if (resolve) resolve(value);
}

export function initConfirm() {
  $('confirmOk').addEventListener('click', () => settle(true));
  $('confirmCancel').addEventListener('click', () => settle(false));
  $('confirmOverlay').addEventListener('click', (e) => { if (e.target === $('confirmOverlay')) settle(false); });
  $('confirmOverlay').addEventListener('keydown', (e) => { if (e.key === 'Escape') settle(false); });
}
