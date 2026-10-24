import { devices } from '@playwright/test';
import {
  test, expect, resetEmulators, signInAs, routeFirebase, createFirstList, addItem, readListDoc,
  serverItems, adminGet, adminList, adminSet, currentUid,
} from './fixtures.mjs';

test.beforeEach(async () => { await resetEmulators(); });

async function guest(browser, sub, name) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:5173', permissions: ['clipboard-read', 'clipboard-write'] });
  await routeFirebase(ctx);
  const page = await ctx.newPage();
  await page.goto('/');
  await signInAs(page, sub, `${sub}@example.com`);
  if (name) await page.evaluate(async (n) => { await window.__fb.auth.updateProfile(window.FB.auth.currentUser, { displayName: n }); }, name);
  return { ctx, page };
}

async function openManage(page) {
  await page.click('#listPickerBtn');
  await page.click('#manageListBtn');
  await expect(page.locator('#listManageOverlay')).toHaveClass(/show/);
}

test('the header name opens the list settings; renaming updates everywhere', async ({ page }) => {
  const id = await createFirstList(page, 'שם ישן');
  await page.click('#headerTitle');
  await expect(page.locator('#listManageOverlay')).toHaveClass(/show/);
  await expect(page.locator('#manageName')).toHaveValue('שם ישן');
  await page.fill('#manageName', 'שם חדש');
  await page.press('#manageName', 'Enter');
  await expect(page.locator('#headerTitle')).toContainText('שם חדש');
  await expect.poll(async () => (await readListDoc(page, id)).name).toBe('שם חדש');
  await page.click('#closeManageBtn');
  await expect(page.locator('#listManageOverlay')).not.toHaveClass(/show/);
});

test('the code can be copied as a code or a link, and the link has the right shape', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const id = await createFirstList(page, 'קוד');
  const { code } = await readListDoc(page, id);
  await openManage(page);
  await expect(page.locator('#manageCode')).toHaveText(code);
  await page.click('#copyCodeBtn');
  await expect(page.locator('#toastText')).toHaveText('הקוד הועתק');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await page.click('#copyLinkBtn');
  await expect(page.locator('#toastText')).toHaveText('הקישור הועתק');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://127.0.0.1:5173/?join=${code}`);
});

test('share uses the system share sheet when there is one, with the message and the link', async ({ page }) => {
  await page.addInitScript(() => { navigator.share = async (data) => { window.__shared = data; }; });
  const id = await createFirstList(page, 'משפחה');
  const { code } = await readListDoc(page, id);
  await openManage(page);
  await page.click('#shareBtn');
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.text).toBe(`בואו נקנה ביחד! הצטרפו לרשימה "משפחה": http://127.0.0.1:5173/?join=${code}`);
});

test('without a share sheet, share opens WhatsApp with the same text', async ({ page, context }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined }); });
  const id = await createFirstList(page, 'משפחה');
  const { code } = await readListDoc(page, id);
  await openManage(page);
  await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'whatsapp' }));
  const popup = context.waitForEvent('page');
  await page.click('#shareBtn');
  const url = (await popup).url();
  expect(url).toContain('https://wa.me/?text=');
  expect(decodeURIComponent(url.split('text=')[1])).toContain(`?join=${code}`);
});

test('members are listed by name with owner and "you" badges', async ({ page, browser }) => {
  const id = await createFirstList(page, 'חברים', 'u-own');
  await page.evaluate(async () => { await window.__fb.auth.updateProfile(window.FB.auth.currentUser, { displayName: 'דנה' }); await window.FB.auth.currentUser.reload(); });
  const { code } = await readListDoc(page, id);
  const { ctx, page: other } = await guest(browser, 'u-two', 'יוסי');
  await other.fill('#welcomeJoinInput', code);
  await other.click('#welcomeJoinBtn');
  await expect(other.locator('#welcomeScreen')).toBeHidden();

  await openManage(other);
  await expect(other.locator('#manageMembersLabel')).toHaveText('חברים (2)');
  await expect(other.locator('#memberList li')).toHaveCount(2);
  await expect(other.locator('#memberList')).toContainText('יוסי');
  await expect(other.locator('#memberList li', { hasText: 'יוסי' })).toContainText('אתה');
  await expect.poll(async () => (await readListDoc(page, id)).memberNames?.['u-two'] ?? Object.values((await readListDoc(page, id)).memberNames || {}).join()).toContain('יוסי');
  await ctx.close();
});

test('a member can leave: the list disappears for them and stays for the others', async ({ page, browser }) => {
  const id = await createFirstList(page, 'עזיבה', 'u-own2');
  await addItem(page, 'חלב');
  const { code } = await readListDoc(page, id);
  const { ctx, page: other } = await guest(browser, 'u-leaver', 'עוזב');
  await other.fill('#welcomeJoinInput', code);
  await other.click('#welcomeJoinBtn');
  await expect(other.locator('.item-name')).toHaveText(['חלב']);

  await openManage(other);
  await expect(other.locator('#deleteListBtn')).toBeHidden();
  await other.click('#leaveListBtn');
  await expect(other.locator('#confirmText')).toContainText('עזיבה');
  await other.click('#confirmOk');
  await expect(other.locator('#welcomeScreen')).toBeVisible();
  await expect.poll(async () => (await readListDoc(page, id)).members.length).toBe(1);
  await expect(page.locator('.item-name')).toHaveText(['חלב']);
  await ctx.close();
});

test('the owner cannot leave but can delete: everything inside is removed for everyone', async ({ page, browser }) => {
  const id = await createFirstList(page, 'מחיקה', 'u-own3');
  await addItem(page, 'ביצים');
  await page.locator('.checkbox').click();
  const { code } = await readListDoc(page, id);
  const { ctx, page: other } = await guest(browser, 'u-member3', 'חבר');
  await other.fill('#welcomeJoinInput', code);
  await other.click('#welcomeJoinBtn');
  await expect(other.locator('.item-name')).toHaveText(['ביצים']);

  await openManage(page);
  await expect(page.locator('#leaveListBtn')).toBeHidden();
  await expect(page.locator('#ownerLeaveHint')).toBeVisible();
  await page.click('#deleteListBtn');
  await page.click('#confirmCancel');
  expect(await adminGet(`lists/${id}`)).not.toBeNull();

  await page.click('#deleteListBtn');
  await expect(page.locator('#confirmText')).toContainText('לכולם');
  await page.click('#confirmOk');
  await expect(page.locator('#welcomeScreen')).toBeVisible();
  await expect(other.locator('#welcomeScreen')).toBeVisible();
  expect(await adminGet(`lists/${id}`)).toBeNull();
  expect(await adminGet(`joinCodes/${code}`)).toBeNull();
  expect((await serverItems(id)).length).toBe(0);
  expect((await adminList(`lists/${id}/history`)).length).toBe(0);
  await ctx.close();
});

test('a new code replaces the old one: the old stops working, the new works', async ({ page, browser }) => {
  const id = await createFirstList(page, 'חידוש', 'u-own4');
  const { code: oldCode } = await readListDoc(page, id);
  await openManage(page);
  await page.click('#newCodeBtn');
  await page.click('#confirmOk');
  await expect.poll(async () => (await readListDoc(page, id)).code).not.toBe(oldCode);
  const { code: newCode } = await readListDoc(page, id);
  await expect(page.locator('#manageCode')).toHaveText(newCode);
  expect(await adminGet(`joinCodes/${oldCode}`)).toBeNull();
  expect(await adminGet(`joinCodes/${newCode}`)).toMatchObject({ listId: id });

  const { ctx, page: other } = await guest(browser, 'u-late', 'מאחר');
  await other.fill('#welcomeJoinInput', oldCode);
  await other.click('#welcomeJoinBtn');
  await expect(other.locator('#welcomeJoinError')).toHaveText('לא נמצאה רשימה עם הקוד הזה');
  await other.fill('#welcomeJoinInput', newCode);
  await other.click('#welcomeJoinBtn');
  await expect(other.locator('#welcomeScreen')).toBeHidden();
  await ctx.close();
});

test('only the owner sees the "new code" button', async ({ page, browser }) => {
  const id = await createFirstList(page, 'בעלות', 'u-own5');
  const { code } = await readListDoc(page, id);
  await openManage(page);
  await expect(page.locator('#newCodeBtn')).toBeVisible();
  const { ctx, page: other } = await guest(browser, 'u-m5', 'חבר');
  await other.fill('#welcomeJoinInput', code);
  await other.click('#welcomeJoinBtn');
  await expect(other.locator('#welcomeScreen')).toBeHidden();
  await openManage(other);
  await expect(other.locator('#newCodeBtn')).toBeHidden();
  await ctx.close();
});

// ---------- invitation link ----------
test('an invitation link asks before joining, then joins and cleans the address', async ({ page, browser }) => {
  const id = await createFirstList(page, 'הזמנה', 'u-host');
  await addItem(page, 'לחם');
  const { code } = await readListDoc(page, id);

  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:5173' });
  await routeFirebase(ctx);
  const invited = await ctx.newPage();
  await invited.goto(`/?join=${code}`);
  await expect.poll(() => invited.evaluate(() => location.search)).toBe('');
  await signInAs(invited, 'u-invited', 'invited@example.com');
  await expect(invited.locator('#confirmOverlay')).toHaveClass(/show/);
  await expect(invited.locator('#confirmText')).toContainText(code);
  await invited.click('#confirmOk');
  await expect(invited.locator('.item-name')).toHaveText(['לחם']);
  await expect(invited.locator('#confirmOverlay')).not.toHaveClass(/show/);

  await invited.reload();
  await expect(invited.locator('.item-name')).toHaveText(['לחם']);
  await expect(invited.locator('#confirmOverlay')).not.toHaveClass(/show/);
  await ctx.close();
});

test('declining an invitation does nothing, and a wrong code explains itself', async ({ page, browser }) => {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:5173' });
  await routeFirebase(ctx);
  const invited = await ctx.newPage();
  await invited.goto('/?join=ZZZZ2345');
  await signInAs(invited, 'u-inv2', 'inv2@example.com');
  await expect(invited.locator('#confirmOverlay')).toHaveClass(/show/);
  await invited.click('#confirmCancel');
  await expect(invited.locator('#welcomeScreen')).toBeVisible();

  await invited.goto('/?join=ZZZZ2345');
  await invited.waitForFunction(() => window.FB && window.FB.auth.currentUser);
  await expect(invited.locator('#confirmOverlay')).toHaveClass(/show/);
  await invited.click('#confirmOk');
  await expect(invited.locator('#toast')).toHaveClass(/show/);
  await expect(invited.locator('#toastText')).toHaveText('לא נמצאה רשימה עם הקוד הזה');
  await ctx.close();
});

test('the settings sheet is translated', async ({ page }) => {
  await createFirstList(page, 'שפה', 'u-lang');
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'de');
  await page.click('#closeSettingsBtn');
  await page.click('#headerTitle');
  await expect(page.locator('#listManageTitle')).toHaveText('Liste verwalten');
  await expect(page.locator('#copyCodeBtn')).toHaveText('Code kopieren');
  await expect(page.locator('#manageMembersLabel')).toHaveText('Mitglieder (1)');
});
