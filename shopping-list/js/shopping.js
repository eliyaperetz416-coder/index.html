// Shopping mode: a big, calm view for use in the shop. The switch is remembered; while it
// is on the screen is kept awake (where the browser allows it).
import { state } from './state.js';
import { $ } from './util.js';
import { render } from './render.js';

let wakeLock = null;

async function holdScreenAwake() {
  try {
    if (state.shopping && document.visibilityState === 'visible' && navigator.wakeLock && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
    }
  } catch { wakeLock = null; /* refused (low battery, unsupported): not important */ }
}

function releaseScreen() {
  const lock = wakeLock;
  wakeLock = null;
  try { lock?.release?.(); } catch { /* already released */ }
}

export function initShopping() {
  $('shopModeBtn').addEventListener('click', () => {
    state.shopping = !state.shopping;
    localStorage.setItem('shoppingMode', state.shopping ? '1' : '0');
    render();
    if (state.shopping) holdScreenAwake(); else releaseScreen();
  });
  // The browser drops the lock when the page is hidden; take it again on return.
  document.addEventListener('visibilitychange', () => { if (state.shopping) holdScreenAwake(); });
  if (state.shopping) holdScreenAwake();
}
