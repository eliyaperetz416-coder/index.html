// Step 4: one document per item, monthly history buckets, offline use, migration.
import { devices } from '@playwright/test';
import {
  test, expect, resetEmulators, signInAs, routeFirebase, createFirstList, addItem, readListDoc,
  serverItems, serverHistory, adminSet, adminGet, adminList, currentUid,
} from './fixtures.mjs';

test.beforeEach(async () => { await resetEmulators(); });

async function openAs(browser, sub) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:5173' });
  await routeFirebase(ctx);
  const page = await ctx.newPage();
  await page.goto('/');
  await signInAs(page, sub, `${sub}@example.com`);
  return { ctx, page };
}

async function join(page, code) {
  await page.fill('#welcomeJoinInput', code);
  await page.click('#welcomeJoinBtn');
  await expect(page.locator('#welcomeScreen')).toBeHidden();
}

test('two people editing at the same time do not overwrite each other', async ({ page, browser }) => {
  const id = await createFirstList(page, 'משותפת', 'u-a');
  await addItem(page, 'חלב');
  const { code } = await readListDoc(page, id);
  const { ctx, page: guest } = await openAs(browser, 'u-b');
  await join(guest, code);
  await expect(guest.locator('.item-name')).toHaveText(['חלב']);

  // The guest adds something while disconnected, the owner ticks milk meanwhile.
  await ctx.setOffline(true);
  await guest.fill('#itemInput', 'לחם');
  await guest.click('#addBtn');
  await page.locator('.item', { hasText: 'חלב' }).locator('.checkbox').click();
  await expect.poll(async () => (await serverItems(id)).find((i) => i.name === 'חלב')?.bought).toBe(true);
  await ctx.setOffline(false);

  await expect.poll(async () => (await serverItems(id)).map((i) => `${i.name}:${i.bought}`).sort()).toEqual(['חלב:true', 'לחם:false']);
  await expect(page.locator('.item-name')).toHaveText(['לחם', 'חלב']);
  await expect(guest.locator('.item.bought .item-name')).toHaveText(['חלב']);
  await ctx.close();
});

test('offline: a quiet notice, changes keep working, and they sync when the connection returns', async ({ page, context }) => {
  const id = await createFirstList(page, 'בלי קליטה');
  await expect(page.locator('#offlineBar')).toBeHidden();

  await context.setOffline(true);
  await expect(page.locator('#offlineBar')).toBeVisible();
  await expect(page.locator('#offlineBar')).toContainText('אין חיבור');
  await addItem(page, 'ביצים');
  await page.locator('.item', { hasText: 'ביצים' }).locator('.checkbox').click();
  await expect(page.locator('.item.bought .item-name')).toHaveText(['ביצים']);
  expect(await serverItems(id)).toEqual([]);

  await context.setOffline(false);
  await expect(page.locator('#offlineBar')).toBeHidden();
  await expect.poll(async () => (await serverItems(id)).map((i) => `${i.name}:${i.bought}`)).toEqual(['ביצים:true']);
  await expect.poll(async () => (await serverHistory(id)).map((e) => e.name)).toEqual(['ביצים']);
});

test('the offline notice follows the language', async ({ page, context }) => {
  await createFirstList(page, 'שפה');
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'en');
  await page.click('#closeSettingsBtn');
  await context.setOffline(true);
  await expect(page.locator('#offlineBar')).toContainText('Offline');
  await context.setOffline(false);
});

// ---------- migration of a version-1 list ----------
const TODAY_9 = () => { const d = new Date(); d.setHours(9, 0, 0, 0); return d.getTime(); };

async function seedLegacyList(listId, uid, extraMembers = []) {
  const boughtAt = TODAY_9();
  await adminSet(`lists/${listId}`, {
    name: 'רשימה ישנה', code: 'AB3K7M', ownerUid: uid, members: [uid, ...extraMembers],
    items: [
      { id: '1700000000001', name: 'חלב', bought: false, catKey: 'dairy', catName: 'חלבי 🧀', catColor: 'var(--teal)', urgency: 'high' },
      { id: '1700000000002', name: 'לחם', bought: true, boughtAt, catKey: 'bakery', catName: 'x', catColor: 'x' },
      { id: '1700000000003', name: 'ביצים', bought: false, catKey: 'dairy', catName: 'x', catColor: 'x' },
    ],
    purchaseHistory: [
      { name: 'לחם', catKey: 'bakery', catColor: 'x', timestamp: boughtAt },
      { name: 'גבינה', catKey: 'dairy', catColor: 'x', timestamp: boughtAt - 2 * 86400000 },
      { name: 'קפה', catKey: 'drinks', catColor: 'x', timestamp: boughtAt - 40 * 86400000 },
    ],
  });
}

test('an old list is migrated on first open: same items, history in monthly buckets, old arrays kept', async ({ page }) => {
  await page.goto('/');
  await signInAs(page, 'u-old', 'old@example.com');
  await seedLegacyList('legacy', await currentUid(page));
  await page.reload();

  await expect(page.locator('#headerTitle')).toContainText('רשימה ישנה');
  await expect(page.locator('#list .item .item-name')).toHaveText(['חלב', 'ביצים', 'לחם']);
  await expect(page.locator('.item', { hasText: 'חלב' }).locator('.urgency-square')).toHaveCount(1);

  await expect.poll(async () => (await adminGet('lists/legacy')).schemaVersion).toBe(2);
  const list = await adminGet('lists/legacy');
  expect(list.items).toHaveLength(3);            // the old arrays stay as a backup
  expect(list.purchaseHistory).toHaveLength(3);
  expect((await serverItems('legacy')).map((i) => i.id).sort()).toEqual(['1700000000001', '1700000000002', '1700000000003']);
  expect((await serverHistory('legacy')).map((e) => e.name).sort()).toEqual(['גבינה', 'לחם', 'קפה']);

  // Un-ticking the bread that was bought before the migration removes its purchase.
  await page.locator('.item', { hasText: 'לחם' }).locator('.checkbox').click();
  await expect.poll(async () => (await serverHistory('legacy')).map((e) => e.name).sort()).toEqual(['גבינה', 'קפה']);

  await page.click('#navStatsBtn');
  await expect(page.locator('#statsWeekTotalValue')).toHaveText('1');
});

test('two members opening an old list at the same moment do not duplicate anything', async ({ page, browser }) => {
  const { ctx, page: other } = await openAs(browser, 'u-two');
  await page.goto('/');
  await signInAs(page, 'u-one', 'one@example.com');
  await seedLegacyList('legacy2', await currentUid(page), [await currentUid(other)]);

  await Promise.all([page.reload(), other.reload()]);
  await expect(page.locator('#list .item')).toHaveCount(3);
  await expect(other.locator('#list .item')).toHaveCount(3);
  await expect.poll(async () => (await adminGet('lists/legacy2')).schemaVersion).toBe(2);
  await page.waitForTimeout(1500);

  expect(await serverItems('legacy2')).toHaveLength(3);
  expect(await serverHistory('legacy2')).toHaveLength(3);
  expect((await adminList('lists/legacy2/history')).length).toBe(new Set((await serverHistory('legacy2')).map((e) => new Date(e.timestamp).toISOString().slice(0, 7))).size);
  await ctx.close();
});

test('after migration the old arrays can no longer be written (an old app version cannot diverge)', async ({ page }) => {
  await page.goto('/');
  await signInAs(page, 'u-old2', 'old2@example.com');
  await seedLegacyList('legacy3', await currentUid(page));
  await page.reload();
  await expect.poll(async () => (await adminGet('lists/legacy3')).schemaVersion).toBe(2);
  const result = await page.evaluate(async () => {
    const { doc, updateDoc } = window.__fb.firestore;
    try { await updateDoc(doc(window.FB.db, 'lists', 'legacy3'), { items: [] }); return 'written'; } catch (e) { return e.code; }
  });
  expect(result).toBe('permission-denied');
});

test('a list created a moment ago already receives changes made by others', async ({ page }) => {
  // Regression: the list used to be opened from the local cache before the server had it,
  // the server refused, and the connection stayed stuck — remote changes never arrived.
  const id = await createFirstList(page, 'טרייה');
  await adminSet(`lists/${id}/items/remote`, { name: 'מרחוק', catKey: 'other', bought: false, boughtAt: null, createdAt: 1, createdBy: 'x' });
  await expect(page.locator('.item-name')).toHaveText(['מרחוק']);
});
