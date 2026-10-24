// ============================================================
// FIREBASE SETUP — shared lists (auth + realtime sync).
// Loaded on demand by auth.js (import('./firebase.js')).
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot, writeBatch,
  collection, query, where, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBL3DPWGO3PIdbGxH8QlvFzx6tGaC2Z3Bk",
  authDomain: "shopping-list-app-2fa25.firebaseapp.com",
  projectId: "shopping-list-app-2fa25",
  storageBucket: "shopping-list-app-2fa25.firebasestorage.app",
  messagingSenderId: "307109384624",
  appId: "1:307109384624:web:d00f77a99b119e581cc675",
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const googleProvider = new GoogleAuthProvider();

// Mobile browsers (especially Safari on iOS) frequently fail to complete
// sign-in inside a popup window — the popup opens but the Google button
// inside it doesn't respond. Redirect-based sign-in (leaving the page,
// signing in, then returning) is far more reliable there.
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function signInWithGoogle() {
  return isMobile
    ? signInWithRedirect(auth, googleProvider)
    : signInWithPopup(auth, googleProvider);
}

// On page load, check whether we just came back from a redirect-based
// sign-in (mobile flow) so onAuthChange picks up the signed-in user.
getRedirectResult(auth).catch(err => {
  console.error('Redirect sign-in failed:', err);
  window.dispatchEvent(new CustomEvent('firebase-auth-error', { detail: err }));
});

// Expose what the rest of the app needs via window.FB (the app calls window.FB.x at
// call time; the end-to-end tests also replace members of it to simulate failures).
window.FB = {
  auth, db, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot, writeBatch,
  collection, query, where, arrayUnion, serverTimestamp,
  signInWithGoogle,
  signOutUser: () => signOut(auth),
  onAuthChange: (cb) => onAuthStateChanged(auth, cb),
};
