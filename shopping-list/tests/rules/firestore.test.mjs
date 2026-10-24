// Firestore security rules, tested against the emulator:
//   npm run test:rules
import { test, before, beforeEach, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where,
  writeBatch, arrayUnion, arrayRemove, serverTimestamp,
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
