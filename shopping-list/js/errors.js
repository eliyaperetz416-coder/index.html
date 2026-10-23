// Maps a Firebase error to the key of a translated, user-friendly message.
// Returns null when the user simply backed out (nothing worth showing).
const NETWORK = new Set([
  'unavailable',
  'deadline-exceeded',
  'auth/network-request-failed',
]);
const PERMISSION = new Set(['permission-denied', 'unauthenticated']);
const SILENT = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

export function friendlyErrorKey(err) {
  const code = err && err.code;
  if (SILENT.has(code)) return null;
  if (PERMISSION.has(code)) return 'errPermission';
  if (code === 'not-found') return 'errNotFound';
  if (NETWORK.has(code)) return 'errNetwork';
  if (code === 'auth/popup-blocked') return 'errPopupBlocked';
  return 'errGeneric';
}
