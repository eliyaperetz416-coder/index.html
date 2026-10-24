// Escapes text for use inside HTML, including inside quoted attributes
// (data-name="..."). Every value read from Firestore goes through this before
// it is placed into innerHTML: any list member can write any text there.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}
