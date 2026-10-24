// The app's shared, mutable state. Modules read and write these fields directly.
export const state = {
  lang: localStorage.getItem('appLang') || 'he',
  theme: localStorage.getItem('appTheme') || 'dark',

  // Shared-list state (backed by Firestore once signed in)
  user: null,                 // Firebase auth user object
  lists: [],                  // [{id, name, code, ownerUid, members}]
  activeListId: localStorage.getItem('activeListId') || null,
  items: [],                  // items of the active list, from lists/{id}/items
  purchaseHistory: [],        // recent purchases of the active list, from lists/{id}/history
  shopping: localStorage.getItem('shoppingMode') === '1', // shopping mode: big rows, grouped by category
  collapsed: new Set(),       // categories folded away in shopping mode
  completedSeen: new Set(),   // categories that were already finished (they fold once, by themselves)
  pendingListId: null,        // a list just created or joined, before "my lists" includes it
};
