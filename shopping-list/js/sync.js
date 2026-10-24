// Lists and their Firestore sync: loading my lists, creating / joining / switching,
// the live subscription to the active list, and saving changes back.
import { state } from './state.js';
import { t } from './i18n.js';
import { $ } from './util.js';
import { showToast, messageFor } from './ui.js';
import { render, updateHeaderForList } from './render.js';
import { renderStats } from './stats.js';

const appRoot = $('appRoot');

// Push the current items + purchaseHistory to Firestore for the active list.
// (Debounced slightly isn't necessary here since writes are small and infrequent —
// one write per user action — but we guard against saving with no active list.)
export async function save() {
  if (!state.activeListId || !window.FB) return;
  state.suppressNextSnapshot = true;
  try {
    await window.FB.updateDoc(window.FB.doc(window.FB.db, 'lists', state.activeListId), {
      items: state.items,
      purchaseHistory: state.purchaseHistory,
    });
  } catch (err) {
    // Our write failed, so no echo of it is coming: don't swallow the next real snapshot.
    state.suppressNextSnapshot = false;
    console.error('Failed to save list to Firestore:', err);
    showToast([t().errSaveFailed, messageFor(err)].filter(Boolean).join(' · '));
  }
}

function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function loadMyLists() {
  if (!state.user) { state.lists = []; return; }
  const q = window.FB.query(window.FB.collection(window.FB.db, 'lists'), window.FB.where('members', 'array-contains', state.user.uid));
  const snap = await window.FB.getDocs(q);
  state.lists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Creates a list and switches to it. Returns true on success; on failure the
// friendly message is shown in errEl.
export async function createList(rawName, errEl, btn) {
  errEl.textContent = '';
  const name = rawName.trim();
  if (!name || !state.user) return false;
  btn.disabled = true;
  try {
    const code = generateJoinCode();
    const ref = window.FB.doc(window.FB.collection(window.FB.db, 'lists'));
    const data = { name, code, ownerUid: state.user.uid, members: [state.user.uid], items: [], purchaseHistory: [] };
    await window.FB.setDoc(ref, { ...data, createdAt: window.FB.serverTimestamp() });
    try {
      await loadMyLists();
    } catch (err) {
      console.error('Reloading lists failed after create:', err);
    }
    if (!state.lists.some(l => l.id === ref.id)) state.lists.push({ id: ref.id, ...data });
    switchToList(ref.id);
    return true;
  } catch (err) {
    console.error('Create list failed:', err);
    errEl.textContent = messageFor(err);
    return false;
  } finally {
    btn.disabled = false;
  }
}

// Joins the list with this code and switches to it. Returns true on success.
export async function joinList(rawCode, errEl, btn) {
  errEl.textContent = '';
  const code = rawCode.trim().toUpperCase();
  if (!code || !state.user) return false;
  btn.disabled = true;
  try {
    const q = window.FB.query(window.FB.collection(window.FB.db, 'lists'), window.FB.where('code', '==', code));
    const snap = await window.FB.getDocs(q);
    if (snap.empty) {
      errEl.textContent = t().errNotFound;
      return false;
    }
    const listDoc = snap.docs[0];
    await window.FB.updateDoc(window.FB.doc(window.FB.db, 'lists', listDoc.id), {
      members: window.FB.arrayUnion(state.user.uid),
    });
    try {
      await loadMyLists();
    } catch (err) {
      console.error('Reloading lists failed after join:', err);
    }
    if (!state.lists.some(l => l.id === listDoc.id)) state.lists.push({ id: listDoc.id, ...listDoc.data() });
    switchToList(listDoc.id);
    return true;
  } catch (err) {
    console.error('Join failed:', err.code, err);
    errEl.textContent = messageFor(err);
    return false;
  } finally {
    btn.disabled = false;
  }
}

export function switchToList(listId) {
  state.activeListId = listId;
  localStorage.setItem('activeListId', listId);
  subscribeToActiveList();
}

export function stopListening() {
  if (state.unsubscribeActiveList) { state.unsubscribeActiveList(); state.unsubscribeActiveList = null; }
}

function subscribeToActiveList() {
  stopListening();
  // With no active list the first-run screen replaces the list, so nothing can be added "into the void"
  appRoot.classList.remove('load-failed');
  appRoot.classList.toggle('no-list', !state.activeListId);
  if (!state.activeListId) {
    state.items = [];
    state.purchaseHistory = [];
    render();
    renderStats();
    updateHeaderForList();
    $('stats').textContent = '';
    return;
  }
  state.unsubscribeActiveList = window.FB.onSnapshot(
    window.FB.doc(window.FB.db, 'lists', state.activeListId),
    (docSnap) => {
      if (state.suppressNextSnapshot) { state.suppressNextSnapshot = false; return; }
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      state.items = data.items || [];
      state.purchaseHistory = data.purchaseHistory || [];
      const removedStaleItems = cleanupStaleBoughtItems();
      render();
      renderStats();
      updateHeaderForList(data.name);
      // If cleanup actually removed something, push that change back to Firestore
      // so every member's list stays clean, not just this device's local view.
      if (removedStaleItems) save();
    },
    (err) => {
      console.error('List subscription error:', err);
      showToast(messageFor(err));
    }
  );
}

// Removes items that were marked "bought" before today's midnight — a bought item
// sticks around for the rest of the day it was checked off (so you can still see
// your progress mid-shop), then quietly clears itself the next day.
// Returns true if anything was actually removed.
export function cleanupStaleBoughtItems() {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const cutoff = todayMidnight.getTime();

  const before = state.items.length;
  state.items = state.items.filter(item => !(item.bought && item.boughtAt && item.boughtAt < cutoff));
  return state.items.length !== before;
}

// Called once a user is signed in (and again by the "try again" button).
export async function initForUser() {
  appRoot.classList.remove('load-failed');
  try {
    await loadMyLists();
  } catch (err) {
    // Could not read the lists: say so, instead of pretending the user has none.
    console.error('Loading lists failed:', err);
    $('loadErrorText').textContent = messageFor(err);
    appRoot.classList.remove('no-list');
    appRoot.classList.add('load-failed');
    return;
  }
  // If no active list, or the saved one isn't among ours anymore, fall back to the first available
  if (!state.activeListId || !state.lists.some(l => l.id === state.activeListId)) {
    state.activeListId = state.lists.length > 0 ? state.lists[0].id : null;
    if (state.activeListId) localStorage.setItem('activeListId', state.activeListId);
    else localStorage.removeItem('activeListId');
  }
  subscribeToActiveList();
}
