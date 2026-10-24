// Entry point: loads the language, wires every screen, starts Firebase.
import { state } from './state.js';
import { loadLanguage } from './i18n.js';
import { render } from './render.js';
import { initStats, renderStats } from './stats.js';
import { initNav } from './nav.js';
import { initItemActions, addItem } from './actions.js';
import { initAutocomplete } from './autocomplete.js';
import { initItemEdit } from './item-edit.js';
import { initToast } from './ui.js';
import { initSettings, applyTheme, applyLanguage } from './settings.js';
import { initListUi } from './lists-ui.js';
import { initAuth, connectFirebase } from './auth.js';
import { cleanupStaleBoughtItems } from './sync.js';
import { initConnection } from './connection.js';

async function main() {
  // A language we cannot load (unknown value in storage, or offline) falls back to Hebrew.
  if (!(await loadLanguage(state.lang))) state.lang = 'he';

  initSettings();
  initItemActions();
  initAutocomplete(addItem);
  initItemEdit();
  initToast();
  initStats(addItem);
  initNav();
  initListUi();
  initAuth();
  initConnection();

  applyTheme();
  applyLanguage();

  connectFirebase();

  // In case the app is left open across midnight with no other activity to trigger
  // a fresh snapshot, periodically re-check for stale bought items on our own.
  setInterval(() => {
    if (!state.activeListId) return;
    const removed = cleanupStaleBoughtItems();
    if (removed) { render(); renderStats(); }
  }, 5 * 60 * 1000); // every 5 minutes

  // Register the service worker so the app can be installed to the home
  // screen and load reliably even on a flaky connection.
  if ('serviceWorker' in navigator) {
    const register = () => navigator.serviceWorker.register('sw.js')
      .catch(err => console.error('Service worker registration failed:', err));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }
}

main();
