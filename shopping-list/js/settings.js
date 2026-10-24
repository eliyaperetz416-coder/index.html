// Settings panel: language and theme, and applying the chosen language to the page.
import { state } from './state.js';
import { $ } from './util.js';
import { t, loadLanguage } from './i18n.js';
import { render } from './render.js';
import { renderStats } from './stats.js';
import { renderConnection } from './connection.js';
import { applyItemEditLanguage } from './item-edit.js';
import { applyListManageLanguage } from './list-manage.js';

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $('darkOption').classList.toggle('active', state.theme === 'dark');
  $('lightOption').classList.toggle('active', state.theme === 'light');
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('appTheme', theme);
  applyTheme();
}

export function applyLanguage() {
  const dict = t();
  document.documentElement.setAttribute('lang', state.lang);
  document.documentElement.setAttribute('dir', dict.dir);
  $('pageTitle').textContent = dict.pageTitle;
  $('headerTitle').textContent = dict.headerTitle;
  $('itemInput').placeholder = dict.itemPlaceholder;
  $('settingsTitle').textContent = dict.settingsTitle;
  $('langLabel').textContent = dict.langLabel;
  $('themeLabel').textContent = dict.themeLabel;
  $('darkLabel').textContent = dict.dark;
  $('lightLabel').textContent = dict.light;
  $('closeSettingsBtn').textContent = dict.close;
  $('navListLabel').textContent = dict.navList;
  $('navStatsLabel').textContent = dict.navStats;
  $('statsTopCategoryLabel').textContent = dict.statsTopCategory;
  $('suggestionsTitle').textContent = dict.suggestionsTitle;
  $('loginTitle').textContent = dict.loginTitle;
  $('loginSubtitle').textContent = dict.loginSubtitle;
  $('googleSignInLabel').textContent = dict.googleSignInLabel;
  $('listPickerTitle').textContent = dict.listPickerTitle;
  $('createListLabel').textContent = dict.createListLabel;
  $('joinListLabel').textContent = dict.joinListLabel;
  $('signedInAsLabel').textContent = dict.signedInAsLabel;
  $('signOutBtn').textContent = dict.signOutLabel;
  $('newListNameInput').placeholder = dict.createListLabel;
  $('joinCodeInput').placeholder = dict.joinCodeLabel;
  $('welcomeTitle').textContent = dict.welcomeTitle;
  $('welcomeSubtitle').textContent = dict.welcomeSubtitle;
  $('welcomeCreateLabel').textContent = dict.createListLabel;
  $('welcomeJoinLabel').textContent = dict.joinListLabel;
  $('welcomeNewListInput').placeholder = dict.createListLabel;
  $('welcomeJoinInput').placeholder = dict.joinCodeLabel;
  $('retryLoadBtn').textContent = dict.retryLabel;
  $('shopModeLabel').textContent = dict.shopModeLabel;
  applyListManageLanguage();
  applyItemEditLanguage();
  $('langSelect').value = state.lang;
  renderConnection();
  render(); // re-render list + stats + category names in new language
  renderStats(); // re-render stats screen labels in new language
}

export function initSettings() {
  const settingsOverlay = $('settingsOverlay');
  const langSelect = $('langSelect');

  $('settingsBtn').addEventListener('click', () => settingsOverlay.classList.add('show'));
  $('closeSettingsBtn').addEventListener('click', () => settingsOverlay.classList.remove('show'));
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) settingsOverlay.classList.remove('show');
  });

  langSelect.addEventListener('change', async () => {
    const lang = langSelect.value;
    // Non-Hebrew languages are fetched on first use; if that fails keep the current one.
    if (!(await loadLanguage(lang))) { langSelect.value = state.lang; return; }
    state.lang = lang;
    localStorage.setItem('appLang', lang);
    applyLanguage();
  });

  $('darkOption').addEventListener('click', () => setTheme('dark'));
  $('lightOption').addEventListener('click', () => setTheme('light'));
}
