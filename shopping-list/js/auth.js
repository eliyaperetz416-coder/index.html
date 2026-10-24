// Sign-in / sign-out and reacting to the signed-in user changing.
import { state } from './state.js';
import { $, DEBUG } from './util.js';
import { messageFor } from './ui.js';
import { initForUser, stopListening } from './sync.js';
import { closeListPicker } from './lists-ui.js';

const loginScreen = $('loginScreen');
const appRoot = $('appRoot');

function clearLoginError() {
  const el = $('loginErrorMsg');
  if (el) el.textContent = '';
}

function showLoginError(err) {
  console.error('Sign-in failed:', err);
  let existingMsg = $('loginErrorMsg');
  if (!existingMsg) {
    existingMsg = document.createElement('p');
    existingMsg.id = 'loginErrorMsg';
    existingMsg.setAttribute('role', 'alert');
    existingMsg.style.cssText = 'color:#ff6b6b;font-size:13px;margin-top:14px;word-break:break-word;';
    document.querySelector('.login-box').appendChild(existingMsg);
  }
  const code = DEBUG && err && err.code ? ` (${err.code})` : '';
  existingMsg.textContent = messageFor(err) + code;
}

let listening = false;
function startAuthListener() {
  if (listening) return;
  listening = true;
  window.FB.onAuthChange(async (user) => {
    state.user = user;
    if (user) {
      loginScreen.style.display = 'none';
      appRoot.style.display = 'block';
      await initForUser();
    } else {
      loginScreen.style.display = 'flex';
      appRoot.style.display = 'none';
      closeListPicker();
      stopListening();
    }
  });
}

// Loads the Firebase SDK (js/firebase.js sets window.FB) and starts listening for the
// signed-in user. Resolves to false when it could not be loaded (usually: no
// connection). The browser remembers a failed module download until the page is
// reloaded, so a retry means reloading (see the sign-in button below).
let connecting = null;
let explainedLoadFailure = false;
export function connectFirebase() {
  if (window.FB) { startAuthListener(); return Promise.resolve(true); }
  if (!connecting) {
    connecting = import('./firebase.js')
      .then(() => { startAuthListener(); return true; })
      .catch((err) => { console.error('Firebase failed to load:', err); return false; });
  }
  return connecting;
}

export function initAuth() {
  $('googleSignInBtn').addEventListener('click', async () => {
    clearLoginError();
    // Only await when Firebase is missing: with it loaded, sign-in starts synchronously
    // inside the tap, which is what lets browsers allow the popup.
    if (!window.FB) await connectFirebase();
    if (!window.FB || !window.FB.signInWithGoogle) {
      // First tap: explain. Second tap: reload the page, the only way to retry a failed download.
      if (explainedLoadFailure) { location.reload(); return; }
      explainedLoadFailure = true;
      showLoginError({ code: 'unavailable' });
      return;
    }
    window.FB.signInWithGoogle().catch(showLoginError);
  });

  window.addEventListener('firebase-auth-error', (e) => showLoginError(e.detail));

  $('signOutBtn').addEventListener('click', () => {
    window.FB.signOutUser();
  });
}
