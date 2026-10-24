// Characterisation tests: they pin down what the app does today so that the
// code can be restructured (step 2) without changing behaviour.
import { test, expect, resetEmulators, signInAs, readListDoc, createFirstList, addItem, serverItems, putItems, putHistory } from './fixtures.mjs';

const DAY = 24 * 60 * 60 * 1000;
test.beforeEach(async () => { await resetEmulators(); });

test('signed-out visitors see only the login screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('#appRoot')).toBeHidden();
  await expect(page.locator('#loginTitle')).toHaveText('הרשימה שלי');
});

test('items are grouped by category order, bought ones move to their own section', async ({ page }) => {
  await createFirstList(page, 'סדר');
  for (const name of ['לחם', 'תפוח', 'חלב']) await addItem(page, name);
  await expect(page.locator('#list .item .item-name')).toHaveText(['חלב', 'לחם', 'תפוח']);
  await expect(page.locator('#stats')).toHaveText('3 פריטים · 0 נקנו');

  await page.locator('.item', { hasText: 'לחם' }).locator('.checkbox').click();
  await expect(page.locator('#list .item .item-name')).toHaveText(['חלב', 'תפוח', 'לחם']);
  await expect(page.locator('.bought-group-title')).toHaveText('נקנה ✓ · 1');
  await expect(page.locator('.item.bought')).toHaveCount(1);
  await expect(page.locator('#stats')).toHaveText('3 פריטים · 1 נקנו');
  await expect(page.locator('.item', { hasText: 'חלב' }).locator('.item-cat')).toHaveText('חלבי 🧀');
});

test('an empty list shows the hint; deleting removes the item from the list and the document', async ({ page }) => {
  const id = await createFirstList(page, 'מחיקה');
  await expect(page.locator('.empty-state')).toHaveText('הרשימה ריקה. הוסיפו פריט ראשון 👆');
  await addItem(page, 'ביצים');
  await page.locator('.delete-btn').click();
  await expect(page.locator('.item')).toHaveCount(0);
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect.poll(async () => (await serverItems(id)).length).toBe(0);
});

test('urgency menu opens, sets a level, shows the coloured square and closes on outside click', async ({ page }) => {
  const id = await createFirstList(page, 'דחיפות');
  await addItem(page, 'חלב');
  await expect(page.locator('.urgency-square')).toHaveCount(0);

  await page.locator('.urgency-btn').click();
  await expect(page.locator('.urgency-menu.show')).toBeVisible();
  await page.locator('.urgency-option[data-urgency="high"]').click();
  await expect(page.locator('.urgency-square')).toHaveCount(1);
  await expect.poll(async () => (await serverItems(id))[0].urgency).toBe('high');

  await page.locator('.urgency-btn').click();
  await expect(page.locator('.urgency-menu.show')).toBeVisible();
  await page.locator('#stats').click();
  await expect(page.locator('.urgency-menu.show')).toHaveCount(0);
});

test('pressing Enter adds an item and blank names are ignored', async ({ page }) => {
  await createFirstList(page, 'אנטר');
  await page.fill('#itemInput', '   ');
  await page.press('#itemInput', 'Enter');
  await expect(page.locator('.item')).toHaveCount(0);
  await page.fill('#itemInput', 'מלפפון');
  await page.press('#itemInput', 'Enter');
  await expect(page.locator('.item-name')).toHaveText(['מלפפון']);
  await expect(page.locator('#itemInput')).toHaveValue('');
});

test('stats screen: weekly total, top category, comparison and bars', async ({ page }) => {
  const id = await createFirstList(page, 'סטטיסטיקה');
  const now = Date.now();
  const p = (name, catKey, ago) => ({ itemId: name + ago, name, catKey, timestamp: now - ago });
  await putHistory(id, [
    p('חלב', 'dairy', 1 * DAY), p('גבינה', 'dairy', 2 * DAY), p('לחם', 'bakery', 3 * DAY),
    p('חלב', 'dairy', 9 * DAY),
  ]);
  await page.click('#navStatsBtn');
  await expect(page.locator('#statsScreen')).toBeVisible();
  await expect(page.locator('#listScreen')).toBeHidden();
  await expect(page.locator('#statsWeekTotalValue')).toHaveText('3');
  await expect(page.locator('#statsTopCategoryValue')).toHaveText('חלבי 🧀');
  await expect(page.locator('#statsCompareBox')).toContainText('2 יותר מהשבוע שעבר');
  await expect(page.locator('.stats-bar-row')).toHaveCount(2);
  await expect(page.locator('.stats-bar-count').first()).toHaveText('2');

  await page.click('#navListBtn');
  await expect(page.locator('#listScreen')).toBeVisible();
});

test('smart suggestions offer a regularly bought item and adding it marks the chip', async ({ page }) => {
  const id = await createFirstList(page, 'הצעות');
  const now = Date.now();
  await putHistory(id, [40, 30, 20, 10].map((d) => ({ name: 'חלב', catKey: 'dairy', timestamp: now - d * DAY })));
  await page.click('#navStatsBtn');
  await expect(page.locator('#suggestionsCard')).toBeVisible();
  const chip = page.locator('.suggestion-chip', { hasText: 'חלב' });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveClass(/added/);
  await page.click('#navListBtn');
  await expect(page.locator('.item-name')).toHaveText(['חלב']);
});

test('bought items from an earlier day are cleared when the list is loaded', async ({ page }) => {
  const id = await createFirstList(page, 'ניקוי');
  const now = Date.now();
  await putItems(id, [
    { id: 'old', name: 'ישן', bought: true, boughtAt: now - 2 * DAY },
    { id: 'today', name: 'היום', bought: true, boughtAt: now },
    { id: 'open', name: 'פתוח', bought: false },
  ]);
  await expect(page.locator('.item-name')).toHaveText(['פתוח', 'היום']);
  await expect.poll(async () => (await serverItems(id)).map((i) => i.id).sort()).toEqual(['open', 'today']);
});

test('theme: switching to light is applied, remembered and survives a reload', async ({ page }) => {
  await createFirstList(page, 'ערכת נושא');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.click('#settingsBtn');
  await page.click('#lightOption');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#lightOption')).toHaveClass(/active/);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.click('#settingsBtn');
  await page.click('#darkOption');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('languages: direction, texts, remembered across reloads', async ({ page }) => {
  await createFirstList(page, 'שפות');
  await page.click('#settingsBtn');
  const expected = { en: ['ltr', 'Settings'], ar: ['rtl', 'الإعدادات'], es: ['ltr', 'Ajustes'], fr: ['ltr', 'Paramètres'], de: ['ltr', 'Einstellungen'], ru: ['ltr', 'Настройки'], pt: ['ltr', 'Configurações'], zh: ['ltr', '设置'], hi: ['ltr', 'सेटिंग्स'], he: ['rtl', 'הגדרות'] };
  for (const [lang, [dir, title]] of Object.entries(expected)) {
    await page.selectOption('#langSelect', lang);
    await expect(page.locator('html')).toHaveAttribute('dir', dir);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('#settingsTitle')).toHaveText(title);
  }
  await page.selectOption('#langSelect', 'de');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('#itemInput')).toHaveAttribute('placeholder', /.+/);
  expect(await page.title()).toBe('Meine Liste');
});

test('categories are guessed in the interface language', async ({ page }) => {
  await createFirstList(page, 'קטגוריה');
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'en');
  await page.click('#closeSettingsBtn');
  await addItem(page, 'ice cream');
  await expect(page.locator('.item', { hasText: 'ice cream' }).locator('.item-cat')).toHaveText('Frozen ❄️');
});

test('list picker: create a second list, switch back and forth, see codes, sign out', async ({ page }) => {
  const idA = await createFirstList(page, 'רשימה א');
  await addItem(page, 'חלב');
  await page.click('#listPickerBtn');
  await expect(page.locator('.list-picker-item.active .list-name')).toHaveText('רשימה א');
  await expect(page.locator('#signedInEmail')).toHaveText('u-x@example.com');
  const { code } = await readListDoc(page, idA);
  await expect(page.locator('.list-picker-item.active .list-code')).toContainText(code);

  await page.fill('#newListNameInput', 'רשימה ב');
  await page.click('#createListBtn');
  await expect(page.locator('#headerTitle')).toContainText('רשימה ב');
  await expect(page.locator('.list-picker-item')).toHaveCount(2);
  await page.locator('.list-picker-item', { hasText: 'רשימה א' }).click();
  await expect(page.locator('#listPickerOverlay')).not.toHaveClass(/show/);
  await expect(page.locator('#headerTitle')).toContainText('רשימה א');
  await expect(page.locator('.item-name')).toHaveText(['חלב']);

  await page.click('#listPickerBtn');
  await page.click('#signOutBtn');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('#appRoot')).toBeHidden();
});

test('a change made on another device shows up live', async ({ page }) => {
  const id = await createFirstList(page, 'חי');
  await putItems(id, [{ id: 'r1', name: 'נוסף מרחוק' }]);
  await expect(page.locator('.item-name')).toHaveText(['נוסף מרחוק']);
});
