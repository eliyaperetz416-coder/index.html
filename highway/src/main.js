import { GAME_NAME } from './config.js';
import { Game } from './game.js';

document.title = GAME_NAME;
const t = document.querySelector('meta[name="apple-mobile-web-app-title"]');
if (t) t.content = GAME_NAME;

const game = new Game(document.getElementById('gl'));
window.__game = game; // handy for debugging / automated tests
game.start();

// loading screen: show the name, hide after the first rendered frames
const nameEl = document.getElementById('loader-name'); if (nameEl) nameEl.textContent = GAME_NAME;
const t0 = performance.now();
requestAnimationFrame(() => requestAnimationFrame(() => {
  window.__ready = true;
  const loader = document.getElementById('loader');
  setTimeout(() => { loader.classList.add('done'); setTimeout(() => loader.remove(), 600); }, Math.max(0, 900 - (performance.now() - t0)));
}));

// offline support + update handling
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  let reloaded = false; const hadController = !!navigator.serviceWorker.controller; // first install must not trigger a reload
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // new version took over: reload only when nothing is in progress
    if (!reloaded && (game.state === 'title' || game.state === 'gameover') && hadController) { reloaded = true; location.reload(); }
  });
}
// keep the screen awake while playing (supported on iOS 16.4+ installed apps and modern Android)
let wake = null;
const wakeLock = async () => { try { if ('wakeLock' in navigator && !wake && !document.hidden) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { /* ignore */ } };
window.addEventListener('pointerdown', wakeLock, { passive: true }); document.addEventListener('visibilitychange', () => { if (!document.hidden) wakeLock(); });
