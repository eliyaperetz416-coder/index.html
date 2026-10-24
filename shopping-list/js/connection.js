// A quiet "offline" notice. Firestore keeps working from the device cache meanwhile
// and sends queued changes when the connection returns.
import { $ } from './util.js';
import { t } from './i18n.js';

export function renderConnection() {
  const bar = $('offlineBar');
  bar.textContent = t().offlineNotice;
  bar.hidden = navigator.onLine;
}

export function initConnection() {
  window.addEventListener('online', renderConnection);
  window.addEventListener('offline', renderConnection);
}
