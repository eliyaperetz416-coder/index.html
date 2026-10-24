// Join codes: 8 characters from a 32-letter alphabet without look-alikes (0/O, 1/I).
// 32^8 ≈ 1.1 trillion combinations, and codes can only be looked up one at a time.
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 8;

export function generateJoinCode(cryptoObj = globalThis.crypto) {
  const bytes = cryptoObj.getRandomValues(new Uint8Array(JOIN_CODE_LENGTH));
  // 256 is a multiple of 32, so taking the low 5 bits keeps every letter equally likely.
  return [...bytes].map((b) => JOIN_CODE_ALPHABET[b & 31]).join('');
}

// What the user typed -> canonical form ("ab3k-7mpq " -> "AB3K7MPQ").
export function normalizeJoinCode(input) {
  return String(input ?? '').toUpperCase().replace(/[\s-]/g, '');
}

// Lists made by the old version have 6-character codes; they keep working.
export function isValidJoinCode(code) {
  return typeof code === 'string' && /^[A-HJ-NP-Z2-9]{6}([A-HJ-NP-Z2-9]{2})?$/.test(code);
}

// "?join=CODE" in the address -> the normalised code, or null if there is none / it is malformed.
export function parseJoinParam(search) {
  const raw = new URLSearchParams(search).get('join');
  const code = normalizeJoinCode(raw);
  return isValidJoinCode(code) ? code : null;
}

// The link to send to someone: this page, with the code to join.
export function inviteUrl(pageUrl, code) {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('join', code);
  return url.toString();
}
