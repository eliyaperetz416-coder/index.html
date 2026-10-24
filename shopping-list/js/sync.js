// Lists and their Firestore sync: loading my lists, creating / joining / switching,
// the live subscription to the active list, and saving changes back.
import { state } from './state.js';
import { t } from './i18n.js';
import { $ } from './util.js';
import { showToast, messageFor } from './ui.js';
import { render, updateHeaderForList } from './render.js';
import { renderStats } from './stats.js';
import { generateJoinCode, normalizeJoinCode, isValidJoinCode } from './codes.js';

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

const FB = () => window.FB;

export async function loadMyLists() {
  if (!state.user) { state.lists = []; return; }
  const q = FB().query(FB().collection(FB().db, 'lists'), FB().where('members', 'array-contains', state.user.uid));
  const snap = await FB().getDocs(q);
  state.lists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Creates a list together with its join code (joinCodes/{code} -> listId) in one
// batch. If the random code is already taken the batch is refused, so try another.
async function createListWithCode(name) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateJoinCode();
    const ref = FB().doc(FB().collection(FB().db, 'lists'));
    const data = { name, code, ownerUid: state.user.uid, members: [state.user.uid], items: [], purchaseHistory: [] };
    const batch = FB().writeBatch(FB().db);
    batch.set(ref, { ...data, createdAt: FB().serverTimestamp() });
    batch.set(FB().doc(FB().db, 'joinCodes', code), { listId: ref.id, createdBy: state.user.uid, createdAt: FB().serverTimestamp() });
    try {
      await batch.commit();
      return { id: ref.id, ...data };
    } catch (err) {
      lastErr = err;
      if (err.code !== 'permission-denied') break;
    }
  }
  throw lastErr;
}

// Creates a list and switches to it. Returns true on success; on failure the
// friendly message is shown in errEl.
export async function createList(rawName, errEl, btn) {
  errEl.textContent = '';
  const name = rawName.trim();
  if (!name || !state.user) return false;
  btn.disabled = true;
  try {
    const list = await createListWithCode(name);
    try {
      await loadMyLists();
    } catch (err) {
      console.error('Reloading lists failed after create:', err);
    }
    if (!state.lists.some(l => l.id === list.id)) state.lists.push(list);
    switchToList(list.id);
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
// The code is looked up in joinCodes (one document, never a search over lists); then a
// single batch records "I joined with this code" and adds only me to the members.
export async function joinList(rawCode, errEl, btn) {
  errEl.textContent = '';
  const code = normalizeJoinCode(rawCode);
  if (!code || !state.user) return false;
  if (!isValidJoinCode(code)) { errEl.textContent = t().errNotFound; return false; }
  btn.disabled = true;
  try {
    const codeSnap = await FB().getDoc(FB().doc(FB().db, 'joinCodes', code));
    if (!codeSnap.exists()) {
      errEl.textContent = t().errNotFound;
      return false;
    }
    const { listId } = codeSnap.data();
    const uid = state.user.uid;
    if (!state.lists.some(l => l.id === listId)) {
      const batch = FB().writeBatch(FB().db);
      batch.set(FB().doc(FB().db, 'lists', listId, 'joins', uid), { code, at: FB().serverTimestamp() });
      batch.update(FB().doc(FB().db, 'lists', listId), { members: FB().arrayUnion(uid) });
      await batch.commit();
    }
    try {
      await loadMyLists();
    } catch (err) {
      console.error('Reloading lists failed after join:', err);
    }
    switchToList(listId);
    return true;
  } catch (err) {
    console.error('Join failed:', err.code, err);
    errEl.textContent = messageFor(err);
    return false;
  } finally {
    btn.disabled = false;
  }
}

// Lists created before join codes had their own collection only store `code` on the
// list itself. The owner's app registers it in joinCodes so that people can join with
// it again (strangers can no longer search lists by code). If that code is already
// used by another list, this list gets a new one. Checked once per list per device.
async function registerOldJoinCodes() {
  for (const list of state.lists) {
    if (list.ownerUid !== state.user.uid) continue;
    const marker = `joinCodeOk:${list.id}:${list.code}`;
    if (localStorage.getItem(marker)) continue;
    try {
      const valid = isValidJoinCode(list.code);
      const snap = valid ? await FB().getDoc(FB().doc(FB().db, 'joinCodes', list.code)) : null;
      if (snap && snap.exists() && snap.data().listId === list.id) {
        localStorage.setItem(marker, '1');
        continue;
      }
      const code = valid && !snap.exists() ? list.code : generateJoinCode(); // invalid or taken: new code
      const batch = FB().writeBatch(FB().db);
      if (code !== list.code) batch.update(FB().doc(FB().db, 'lists', list.id), { code });
      batch.set(FB().doc(FB().db, 'joinCodes', code), { listId: list.id, createdBy: state.user.uid, createdAt: FB().serverTimestamp() });
      await batch.commit();
      list.code = code;
      localStorage.setItem(`joinCodeOk:${list.id}:${code}`, '1');
    } catch (err) {
      console.error('Registering the join code failed (will retry next time):', list.id, err);
    }
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
  registerOldJoinCodes();
}
