// Test-only stand-in for the Firebase CDN modules: the real SDK, pointed at the
// local emulators. Bundled by esbuild (see global-setup.mjs) and served in place
// of https://www.gstatic.com/firebasejs/10.14.1/*.js, so index.html runs unchanged.
import * as appMod from 'firebase/app';
import * as authMod from 'firebase/auth';
import * as fsMod from 'firebase/firestore';

export * from 'firebase/app';
export * from 'firebase/auth';
export * from 'firebase/firestore';

export function initializeApp(config, ...rest) {
  return appMod.initializeApp({ ...config, projectId: 'demo-shopping-list', apiKey: 'fake-api-key' }, ...rest);
}

export function getAuth(app) {
  const auth = authMod.getAuth(app);
  if (!auth.__emulator) {
    authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    auth.__emulator = true;
  }
  return auth;
}

export function initializeFirestore(app, settings) {
  const db = fsMod.initializeFirestore(app, settings);
  fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  db.__emulator = true;
  return db;
}

export function getFirestore(app) {
  const db = fsMod.getFirestore(app);
  if (!db.__emulator) {
    fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    db.__emulator = true;
  }
  return db;
}

// Lets tests sign in without a Google popup and read Firestore directly.
globalThis.__fb = { auth: authMod, firestore: fsMod };
