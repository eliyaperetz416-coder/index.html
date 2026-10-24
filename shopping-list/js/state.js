// The app's shared, mutable state. Modules read and write these fields directly.
export const state = {
  lang: localStorage.getItem('appLang') || 'he',
  theme: localStorage.getItem('appTheme') || 'dark',

  // Shared-list state (backed by Firestore once signed in)
  user: null,                 // Firebase auth user object
  lists: [],                  // [{id, name, code, ownerUid, members}]
  activeListId: localStorage.getItem('activeListId') || null,
  items: [],                  // items of the active list (local mirror of Firestore)
  purchaseHistory: [],        // purchase history of the active list
  unsubscribeActiveList: null, // Firestore onSnapshot cleanup function
  suppressNextSnapshot: false, // avoids re-rendering from our own writes echoing back
};
