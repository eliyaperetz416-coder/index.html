// Firestore security rules, tested against the emulator:
//   npm run test:rules
import { test, before, beforeEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where,
  writeBatch, arrayUnion, arrayRemove, serverTimestamp, deleteField,
} from 'firebase/firestore';

let env;
const OWNER = 'owner', MEMBER = 'member', STRANGER = 'stranger';
const LIST = 'list1';
const CODE = 'ABCD2345';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(async () => { await env.cleanup(); });

// Seed: a list owned by OWNER with MEMBER in it, plus its join code.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'lists', LIST), {
      name: 'בית', code: CODE, ownerUid: OWNER, members: [OWNER, MEMBER],
      items: [{ id: 'i1', name: 'חלב', bought: false, catKey: 'dairy' }], purchaseHistory: [], createdAt: new Date(),
    });
    await setDoc(doc(db, 'joinCodes', CODE), { listId: LIST, createdBy: OWNER, createdAt: new Date() });
    // A second list (someone else's) with its own code
    await setDoc(doc(db, 'lists', 'other'), { name: 'x', code: 'ZZZZ2345', ownerUid: 'x', members: ['x'], items: [], purchaseHistory: [], createdAt: new Date() });
    await setDoc(doc(db, 'joinCodes', 'ZZZZ2345'), { listId: 'other', createdBy: 'x', createdAt: new Date() });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const newList = (uid, over = {}) => ({ name: 'חדשה', code: 'QWER2345', ownerUid: uid, members: [uid], items: [], purchaseHistory: [], createdAt: serverTimestamp(), ...over });

// ---------- reading ----------
test('signed-out visitors can read and write nothing', async () => {
  await assertFails(getDoc(doc(anon(), 'lists', LIST)));
  await assertFails(getDoc(doc(anon(), 'joinCodes', CODE)));
  await assertFails(setDoc(doc(anon(), 'lists', 'n'), newList('nobody')));
});

test('members can read their list and query "my lists"', async () => {
  await assertSucceeds(getDoc(doc(as(MEMBER), 'lists', LIST)));
  await assertSucceeds(getDocs(query(collection(as(MEMBER), 'lists'), where('members', 'array-contains', MEMBER))));
});

test('a signed-in stranger cannot read a list, list all lists, or search lists by code', async () => {
  const db = as(STRANGER);
  await assertFails(getDoc(doc(db, 'lists', LIST)));
  await assertFails(getDocs(collection(db, 'lists')));
  await assertFails(getDocs(query(collection(db, 'lists'), where('code', '==', CODE))));
});

// ---------- creating ----------
test('anyone signed in can create a list that they own and are the only member of', async () => {
  await assertSucceeds(setDoc(doc(as(STRANGER), 'lists', 'n1'), newList(STRANGER)));
});

test('a new list must not claim another owner, extra members, odd fields or a bad code/name', async () => {
  const db = as(STRANGER);
  await assertFails(setDoc(doc(db, 'lists', 'n2'), newList(STRANGER, { ownerUid: OWNER })));
  await assertFails(setDoc(doc(db, 'lists', 'n3'), newList(STRANGER, { members: [STRANGER, OWNER] })));
  await assertFails(setDoc(doc(db, 'lists', 'n4'), newList(STRANGER, { admin: true })));
  await assertFails(setDoc(doc(db, 'lists', 'n5'), newList(STRANGER, { code: '"><img>' })));
  await assertFails(setDoc(doc(db, 'lists', 'n6'), newList(STRANGER, { name: '' })));
  await assertFails(setDoc(doc(db, 'lists', 'n7'), newList(STRANGER, { name: 'x'.repeat(101) })));
});

test('lists created by the old app version (6-character code) are still accepted', async () => {
  await assertSucceeds(setDoc(doc(as(STRANGER), 'lists', 'old'), newList(STRANGER, { code: 'AB3K7M' })));
});

// ---------- members editing ----------
test('members can edit items, history and the name', async () => {
  const db = as(MEMBER);
  await assertSucceeds(updateDoc(doc(db, 'lists', LIST), { items: [], purchaseHistory: [{ name: 'x', timestamp: 1 }] }));
  await assertSucceeds(updateDoc(doc(db, 'lists', LIST), { name: 'בית חדש' }));
});

test('members cannot take ownership, add or remove other people, or change the code', async () => {
  const db = as(MEMBER);
  await assertFails(updateDoc(doc(db, 'lists', LIST), { ownerUid: MEMBER }));
  await assertFails(updateDoc(doc(db, 'lists', LIST), { members: arrayUnion(STRANGER) }));
  await assertFails(updateDoc(doc(db, 'lists', LIST), { members: arrayRemove(OWNER) }));
  await assertFails(updateDoc(doc(db, 'lists', LIST), { code: 'NEWC2345' }));
  await assertFails(updateDoc(doc(db, 'lists', LIST), { createdAt: new Date(0) }));
});

test('a member can leave (remove only themselves); the owner cannot leave their own list', async () => {
  await assertSucceeds(updateDoc(doc(as(MEMBER), 'lists', LIST), { members: arrayRemove(MEMBER) }));
  await assertFails(updateDoc(doc(as(OWNER), 'lists', LIST), { members: arrayRemove(OWNER) }));
});

test('the owner can change the code to a valid one only', async () => {
  await assertSucceeds(updateDoc(doc(as(OWNER), 'lists', LIST), { code: 'NEWC2345' }));
  await assertFails(updateDoc(doc(as(OWNER), 'lists', LIST), { code: 'x" onclick="' }));
});

test('item and history arrays are size-limited', async () => {
  const many = Array.from({ length: 1001 }, (_, i) => ({ id: `i${i}` }));
  await assertFails(updateDoc(doc(as(MEMBER), 'lists', LIST), { items: many }));
  await assertFails(updateDoc(doc(as(MEMBER), 'lists', LIST), { purchaseHistory: many }));
  await assertFails(updateDoc(doc(as(MEMBER), 'lists', LIST), { items: 'not a list' }));
});

test('only the owner can delete a list', async () => {
  await assertFails(deleteDoc(doc(as(MEMBER), 'lists', LIST)));
  await assertFails(deleteDoc(doc(as(STRANGER), 'lists', LIST)));
  await assertSucceeds(deleteDoc(doc(as(OWNER), 'lists', LIST)));
});

// ---------- joining ----------
function joinBatch(db, uid, listId, code, extra = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'lists', listId, 'joins', uid), { code, at: serverTimestamp() });
  batch.update(doc(db, 'lists', listId), { members: arrayUnion(uid), ...extra });
  return batch.commit();
}

test('a stranger with the right code can join by adding only themselves', async () => {
  await assertSucceeds(joinBatch(as(STRANGER), STRANGER, LIST, CODE));
  await assertSucceeds(getDoc(doc(as(STRANGER), 'lists', LIST)));
});

test('joining fails without a code, with a wrong code, or with another list\'s code', async () => {
  const db = as(STRANGER);
  await assertFails(updateDoc(doc(db, 'lists', LIST), { members: arrayUnion(STRANGER) }));
  await assertFails(joinBatch(db, STRANGER, LIST, 'WRNG2345'));
  await assertFails(joinBatch(db, STRANGER, LIST, 'ZZZZ2345'));
});

test('while joining you cannot change anything else or add someone else', async () => {
  const db = as(STRANGER);
  await assertFails(joinBatch(db, STRANGER, LIST, CODE, { items: [] }));
  await assertFails(joinBatch(db, STRANGER, LIST, CODE, { name: 'שלי' }));
  const batch = writeBatch(db);
  batch.set(doc(db, 'lists', LIST, 'joins', STRANGER), { code: CODE, at: serverTimestamp() });
  batch.update(doc(db, 'lists', LIST), { members: arrayUnion(STRANGER, 'friend') });
  await assertFails(batch.commit());
  await assertFails(setDoc(doc(db, 'lists', LIST, 'joins', 'friend'), { code: CODE, at: serverTimestamp() }));
});

test('join records: you write only your own, members can read them', async () => {
  await assertSucceeds(joinBatch(as(STRANGER), STRANGER, LIST, CODE));
  await assertSucceeds(getDoc(doc(as(OWNER), 'lists', LIST, 'joins', STRANGER)));
  await assertFails(getDoc(doc(as('nobody'), 'lists', LIST, 'joins', STRANGER)));
  await assertFails(deleteDoc(doc(as(STRANGER), 'lists', LIST, 'joins', STRANGER)));
});

test('someone who left can rejoin with the current code', async () => {
  await assertSucceeds(joinBatch(as(STRANGER), STRANGER, LIST, CODE));
  await assertSucceeds(updateDoc(doc(as(STRANGER), 'lists', LIST), { members: arrayRemove(STRANGER) }));
  await assertSucceeds(joinBatch(as(STRANGER), STRANGER, LIST, CODE));
});

// ---------- join codes ----------
test('a signed-in user can look up one code, but cannot list codes', async () => {
  await assertSucceeds(getDoc(doc(as(STRANGER), 'joinCodes', CODE)));
  await assertSucceeds(getDoc(doc(as(STRANGER), 'joinCodes', 'NOPE2345')));
  await assertFails(getDocs(collection(as(STRANGER), 'joinCodes')));
});

test('a list and its code can be created together, by the owner only', async () => {
  const db = as(STRANGER);
  const batch = writeBatch(db);
  batch.set(doc(db, 'lists', 'n8'), newList(STRANGER, { code: 'NEWW2345' }));
  batch.set(doc(db, 'joinCodes', 'NEWW2345'), { listId: 'n8', createdBy: STRANGER, createdAt: serverTimestamp() });
  await assertSucceeds(batch.commit());
});

test('the owner can register the code of an existing list (migration of old lists)', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'lists', 'legacy'), { name: 'ישנה', code: 'AB3K7M', ownerUid: OWNER, members: [OWNER], items: [], purchaseHistory: [], createdAt: new Date() }));
  await assertFails(setDoc(doc(as(MEMBER), 'joinCodes', 'AB3K7M'), { listId: 'legacy', createdBy: MEMBER, createdAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(as(OWNER), 'joinCodes', 'AB3K7M'), { listId: 'legacy', createdBy: OWNER, createdAt: serverTimestamp() }));
});

test('codes cannot point at someone else\'s list, be malformed, or be taken over', async () => {
  const db = as(STRANGER);
  await assertFails(setDoc(doc(db, 'joinCodes', 'MINE2345'), { listId: LIST, createdBy: STRANGER, createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as(OWNER), 'joinCodes', 'bad"code'), { listId: LIST, createdBy: OWNER, createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(as(OWNER), 'joinCodes', 'ZZZZ2345'), { listId: LIST, createdBy: OWNER, createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as('x'), 'joinCodes', 'ZZZZ2345'), { listId: LIST }));
});

test('only the code\'s creator can delete it', async () => {
  await assertFails(deleteDoc(doc(as(MEMBER), 'joinCodes', CODE)));
  await assertSucceeds(deleteDoc(doc(as(OWNER), 'joinCodes', CODE)));
});

test('nothing else in the database is reachable', async () => {
  await assertFails(setDoc(doc(as(OWNER), 'users', OWNER), { a: 1 }));
  await assertFails(getDoc(doc(as(OWNER), 'anything', 'x')));
});

// ======================= schema version 2: items and history =======================
const item = (over = {}) => ({ name: 'חלב', catKey: 'dairy', bought: false, boughtAt: null, createdAt: 1, createdBy: MEMBER, ...over });
const itemRef = (db, id = 'it1', listId = LIST) => doc(db, 'lists', listId, 'items', id);
const bucketRef = (db, month = '2026-10', listId = LIST) => doc(db, 'lists', listId, 'history', month);

test('members can add, tick, prioritise and delete items', async () => {
  const db = as(MEMBER);
  await assertSucceeds(setDoc(itemRef(db), item()));
  await assertSucceeds(updateDoc(itemRef(db), { bought: true, boughtAt: 5, purchase: { itemId: 'it1', name: 'חלב', catKey: 'dairy', timestamp: 5 } }));
  await assertSucceeds(updateDoc(itemRef(db), { urgency: 'high' }));
  await assertSucceeds(updateDoc(itemRef(db), { bought: false, boughtAt: null, urgency: null }));
  await assertSucceeds(getDoc(itemRef(as(OWNER))));
  await assertSucceeds(getDocs(collection(as(OWNER), 'lists', LIST, 'items')));
  await assertSucceeds(deleteDoc(itemRef(db)));
});

test('strangers cannot read or write items', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(itemRef(ctx.firestore()), item()));
  await assertFails(getDoc(itemRef(as(STRANGER))));
  await assertFails(getDocs(collection(as(STRANGER), 'lists', LIST, 'items')));
  await assertFails(setDoc(itemRef(as(STRANGER), 'x'), item({ createdBy: STRANGER })));
  await assertFails(deleteDoc(itemRef(as(STRANGER))));
});

test('items must have a sane shape', async () => {
  const db = as(MEMBER);
  await assertFails(setDoc(itemRef(db, 'a'), item({ name: '' })));
  await assertFails(setDoc(itemRef(db, 'b'), item({ name: 'x'.repeat(201) })));
  await assertFails(setDoc(itemRef(db, 'c'), item({ bought: 'yes' })));
  await assertFails(setDoc(itemRef(db, 'd'), item({ urgency: 'now!!' })));
  await assertFails(setDoc(itemRef(db, 'e'), item({ catKey: 'x'.repeat(30) })));
  await assertFails(setDoc(itemRef(db, 'f'), item({ catColor: 'url(http://evil)' })));
  await assertFails(setDoc(itemRef(db, 'g'), item({ createdBy: OWNER })));
  await assertFails(setDoc(itemRef(db, 'h'), item({ purchase: 'x' })));
});

test('who created an item and when cannot be rewritten', async () => {
  await assertSucceeds(setDoc(itemRef(as(MEMBER)), item()));
  await assertFails(updateDoc(itemRef(as(OWNER)), { createdBy: OWNER }));
  await assertFails(updateDoc(itemRef(as(OWNER)), { createdAt: 999 }));
  await assertSucceeds(updateDoc(itemRef(as(OWNER)), { bought: true, boughtAt: 7 }));
});

test('members append to and remove from a monthly history bucket', async () => {
  const db = as(MEMBER);
  const entry = { itemId: 'it1', name: 'חלב', catKey: 'dairy', timestamp: 5 };
  await assertSucceeds(setDoc(bucketRef(db), { entries: arrayUnion(entry) }, { merge: true }));
  await assertSucceeds(setDoc(bucketRef(db), { entries: arrayRemove(entry) }, { merge: true }));
  await assertSucceeds(getDocs(collection(as(OWNER), 'lists', LIST, 'history')));
});

test('history buckets: right month format, only entries, members only, only the owner deletes', async () => {
  const db = as(MEMBER);
  await assertFails(setDoc(bucketRef(db, 'october'), { entries: [] }));
  await assertFails(setDoc(bucketRef(db, '2026-10'), { entries: [], other: 1 }));
  await assertFails(setDoc(bucketRef(db, '2026-10'), { entries: 'x' }));
  await assertFails(setDoc(bucketRef(as(STRANGER)), { entries: [] }));
  await assertFails(getDoc(bucketRef(as(STRANGER))));
  await assertSucceeds(setDoc(bucketRef(db), { entries: [] }));
  await assertFails(deleteDoc(bucketRef(db)));
});

test('a list is marked migrated once; a second, late migration is refused', async () => {
  const db = as(MEMBER);
  await assertSucceeds(updateDoc(doc(db, 'lists', LIST), { schemaVersion: 2, migratedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as(OWNER), 'lists', LIST), { schemaVersion: 2, migratedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, 'lists', LIST), { schemaVersion: 3 }));
});

test('the migration flag needs a migration time, and can only go to version 2', async () => {
  await assertFails(updateDoc(doc(as(MEMBER), 'lists', LIST), { schemaVersion: 2 }));
  await assertFails(updateDoc(doc(as(MEMBER), 'lists', LIST), { schemaVersion: 1, migratedAt: serverTimestamp() }));
});

test('after migration the old arrays are read-only (old app versions cannot write there)', async () => {
  await assertSucceeds(updateDoc(doc(as(MEMBER), 'lists', LIST), { items: [] }));
  await assertSucceeds(updateDoc(doc(as(MEMBER), 'lists', LIST), { schemaVersion: 2, migratedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as(MEMBER), 'lists', LIST), { items: [{ id: 'x' }] }));
  await assertFails(updateDoc(doc(as(MEMBER), 'lists', LIST), { purchaseHistory: [{ name: 'x', timestamp: 1 }] }));
  await assertSucceeds(updateDoc(doc(as(MEMBER), 'lists', LIST), { name: 'עדיין אפשר לשנות שם' }));
});

test('new lists are created directly in version 2, without the old arrays', async () => {
  const db = as(STRANGER);
  const data = { name: 'חדשה', code: 'QWER2345', ownerUid: STRANGER, members: [STRANGER], schemaVersion: 2, createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db, 'lists', 'v2'), data));
  await assertFails(setDoc(doc(db, 'lists', 'v3'), { ...data, schemaVersion: 7 }));
});

test('items can carry a quantity and a note, within limits', async () => {
  const db = as(MEMBER);
  await assertSucceeds(setDoc(itemRef(db, 'q1'), item({ quantity: '2 חבילות', note: 'בלי גלוטן' })));
  await assertSucceeds(updateDoc(itemRef(db, 'q1'), { quantity: '3', note: 'x'.repeat(200) }));
  await assertFails(updateDoc(itemRef(db, 'q1'), { quantity: 'x'.repeat(41) }));
  await assertFails(updateDoc(itemRef(db, 'q1'), { note: 'x'.repeat(201) }));
  await assertFails(updateDoc(itemRef(db, 'q1'), { quantity: 5 }));
  await assertFails(updateDoc(itemRef(db, 'q1'), { note: { a: 1 } }));
});

// ======================= list management =======================

test('a member can publish their own name on the list, and only their own', async () => {
  const db = as(MEMBER);
  await assertSucceeds(updateDoc(doc(db, 'lists', LIST), { 'memberNames.member': 'דנה' }));
  await assertSucceeds(updateDoc(doc(db, 'lists', LIST), { 'memberNames.member': 'דנה כהן' }));
  await assertFails(updateDoc(doc(db, 'lists', LIST), { 'memberNames.owner': 'מתחזה' }));
  await assertFails(updateDoc(doc(db, 'lists', LIST), { 'memberNames.member': 'x'.repeat(101) }));
  await assertFails(updateDoc(doc(db, 'lists', LIST), { 'memberNames.member': 5 }));
  await assertFails(updateDoc(doc(db, 'lists', LIST), { memberNames: { owner: 'a', member: 'b' } }));
  await assertFails(updateDoc(doc(as(STRANGER), 'lists', LIST), { 'memberNames.stranger': 'זר' }));
});

test('leaving the list can take the member\'s own name along', async () => {
  await assertSucceeds(updateDoc(doc(as(MEMBER), 'lists', LIST), { 'memberNames.member': 'דנה' }));
  await assertSucceeds(updateDoc(doc(as(MEMBER), 'lists', LIST), { members: arrayRemove(MEMBER), 'memberNames.member': deleteField() }));
  await assertFails(getDoc(doc(as(MEMBER), 'lists', LIST)));
});

test('deleting a whole list: the owner clears its history and join records first, members cannot', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(bucketRef(admin), { entries: [] });
    await setDoc(doc(admin, 'lists', LIST, 'joins', MEMBER), { code: CODE, at: new Date() });
  });
  await assertFails(deleteDoc(bucketRef(as(MEMBER))));
  await assertFails(deleteDoc(doc(as(MEMBER), 'lists', LIST, 'joins', MEMBER)));
  await assertSucceeds(deleteDoc(bucketRef(as(OWNER))));
  await assertSucceeds(deleteDoc(doc(as(OWNER), 'lists', LIST, 'joins', MEMBER)));
  const db = as(OWNER);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'joinCodes', CODE));
  batch.delete(doc(db, 'lists', LIST));
  await assertSucceeds(batch.commit());
});

test('the owner can replace the join code in one batch; a member or stranger cannot', async () => {
  const renew = (db, uid) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'lists', LIST), { code: 'NEWC2345' });
    batch.delete(doc(db, 'joinCodes', CODE));
    batch.set(doc(db, 'joinCodes', 'NEWC2345'), { listId: LIST, createdBy: uid, createdAt: serverTimestamp() });
    return batch.commit();
  };
  await assertFails(renew(as(MEMBER), MEMBER));
  await assertFails(renew(as(STRANGER), STRANGER));
  await assertSucceeds(renew(as(OWNER), OWNER));
  await assertSucceeds(getDoc(doc(as(STRANGER), 'joinCodes', 'NEWC2345')));
  const old = await getDoc(doc(as(STRANGER), 'joinCodes', CODE));
  if (old.exists()) throw new Error('the old code should be gone');
});

test('with the old code gone, joining with it fails and joining with the new one works', async () => {
  const db = as(OWNER);
  const batch = writeBatch(db);
  batch.update(doc(db, 'lists', LIST), { code: 'NEWC2345' });
  batch.delete(doc(db, 'joinCodes', CODE));
  batch.set(doc(db, 'joinCodes', 'NEWC2345'), { listId: LIST, createdBy: OWNER, createdAt: serverTimestamp() });
  await batch.commit();
  await assertFails(joinBatch(as(STRANGER), STRANGER, LIST, CODE));
  await assertSucceeds(joinBatch(as(STRANGER), STRANGER, LIST, 'NEWC2345'));
});
