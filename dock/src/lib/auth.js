import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

// Installed to the home screen (iOS or Android): popups are unreliable, so use a full-page redirect.
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function useAuth() {
  const [state, setState] = useState({ user: undefined, error: null });

  useEffect(() => {
    if (!auth) return undefined;
    getRedirectResult(auth).catch((error) => setState((s) => ({ ...s, error })));
    return onAuthStateChanged(auth, (user) => setState((s) => ({ ...s, user })));
  }, []);

  return state;
}

export async function signInWithGoogle() {
  if (isStandalone()) return signInWithRedirect(auth, googleProvider);
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error?.code === 'auth/popup-blocked') return signInWithRedirect(auth, googleProvider);
    throw error;
  }
}

export const signOut = () => fbSignOut(auth);

const MESSAGES = {
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
  'auth/network-request-failed': 'אין חיבור לאינטרנט. נסה שוב.',
  'auth/unauthorized-domain': 'הכתובת הזו עוד לא מאושרת ב-Firebase.',
  'auth/operation-not-allowed': 'התחברות עם Google לא הופעלה ב-Firebase.',
};

export const errorMessage = (error) =>
  error?.code in MESSAGES ? MESSAGES[error.code] : 'ההתחברות לא הצליחה. נסה שוב.';
