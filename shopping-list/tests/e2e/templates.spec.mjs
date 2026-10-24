import { test, expect, resetEmulators, createFirstList, addItem, putItems, serverItems, adminList } from './fixtures.mjs';

test.beforeEach(async () => { await resetEmulators(); });

async function openTemplates(page) {
  await page.click('#templatesBtn');
  await expect(page.locator('#templatesOverlay')).toHaveClass(/show/);
}

test('ready-made templates: Hebrew has basics and Shabbat; adding puts the items on the list', async ({ page }) => {
  const id = await createFirstList(page, 'תבניות');
  await openTemplates(page);
  await expect(page.locator('#builtinTemplates .template-name')).toHaveText(['בסיס', 'קניות שבת']);
  await expect(page.locator('#savedTemplates .stats-empty')).toBeVisible();
  await expect(page.locator('#builtinTemplates .template-sub').first()).toContainText('12 פריטים');

  await page.locator('#builtinTemplates .template-row', { hasText: 'קניות שבת' }).locator('[data-action="add"]').click();
  await expect(page.locator('#templatesOverlay')).not.toHaveClass(/show/);
  await expect(page.locator('#toastText')).toHaveText('נוספו 10 פריטים');
  await expect(page.locator('.item')).toHaveCount(10);
  await expect(page.locator('.item', { has: page.locator('.item-name', { hasText: /^חלה$/ }) }).locator('.item-cat')).toHaveText('מאפים 🍞');
  await expect.poll(async () => (await serverItems(id)).length).toBe(10);
});

test('adding a template skips what is already on the list, and undo removes only what it added', async ({ page }) => {
  const id = await createFirstList(page, 'כפילויות');
  await addItem(page, 'חלב');
  await addItem(page, 'לחם');
  await openTemplates(page);
  await page.locator('#builtinTemplates .template-row', { hasText: 'בסיס' }).locator('[data-action="add"]').click();
  await expect(page.locator('#toastText')).toHaveText('נוספו 10 פריטים');
  await expect(page.locator('.item')).toHaveCount(12);

  await page.click('#toastAction');
  await expect(page.locator('.item')).toHaveCount(2);
  await expect.poll(async () => (await serverItems(id)).map((i) => i.name).sort()).toEqual(['חלב', 'לחם']);

  await openTemplates(page);
  await page.locator('#builtinTemplates .template-row', { hasText: 'בסיס' }).locator('[data-action="add"]').click();
  await expect(page.locator('.item')).toHaveCount(12);
  await openTemplates(page);
  await page.locator('#builtinTemplates .template-row', { hasText: 'בסיס' }).locator('[data-action="add"]').click();
  await expect(page.locator('#toastText')).toHaveText('כל הפריטים כבר ברשימה');
  await expect(page.locator('.item')).toHaveCount(12);
});

test('save the current list as a template, reuse it later, delete it', async ({ page }) => {
  const id = await createFirstList(page, 'שמירה');
  await putItems(id, [
    { id: 'a', name: 'חלב', catKey: 'dairy', quantity: '2 קרטונים', note: 'דל שומן', urgency: 'high' },
    { id: 'b', name: 'לחם', catKey: 'bakery', bought: true, boughtAt: Date.now() },
  ]);
  await expect(page.locator('.item')).toHaveCount(2);
  await openTemplates(page);
  await page.fill('#templateName', 'קניות שבועיות');
  await page.click('#saveTemplateBtn');
  await expect(page.locator('#toastText')).toHaveText('התבנית "קניות שבועיות" נשמרה');
  await expect(page.locator('#savedTemplates .template-name')).toHaveText(['קניות שבועיות']);
  await expect(page.locator('#savedTemplates .template-sub')).toContainText('2 פריטים · חלב, לחם');
  const [saved] = await adminList(`lists/${id}/templates`);
  expect(saved.items).toEqual([{ name: 'חלב', catKey: 'dairy', quantity: '2 קרטונים', note: 'דל שומן' }, { name: 'לחם', catKey: 'bakery' }]);
  await page.click('#closeTemplatesBtn');

  // empty the list, then bring everything back with the template
  await page.click('#clearBoughtBtn');
  await expect(page.locator('.item')).toHaveCount(1);
  await page.locator('.item .delete-btn').click();
  await expect(page.locator('.item')).toHaveCount(0);
  await openTemplates(page);
  await page.locator('#savedTemplates [data-action="add"]').click();
  await expect(page.locator('.item')).toHaveCount(2);
  await expect(page.locator('.item', { hasText: 'חלב' }).locator('.item-sub')).toHaveText('2 קרטונים · דל שומן');
  await expect(page.locator('.item.bought')).toHaveCount(0); // brought back as "still to buy"

  await openTemplates(page);
  await page.locator('#savedTemplates [data-action="delete"]').click();
  await expect(page.locator('#confirmText')).toContainText('קניות שבועיות');
  await page.click('#confirmOk');
  await expect(page.locator('#savedTemplates .stats-empty')).toBeVisible();
  await expect.poll(async () => (await adminList(`lists/${id}/templates`)).length).toBe(0);
});

test('saving needs a name and some items', async ({ page }) => {
  await createFirstList(page, 'חובה');
  await openTemplates(page);
  await page.click('#saveTemplateBtn');
  await expect(page.locator('#templateName')).toBeFocused();
  await page.fill('#templateName', 'ריקה');
  await page.click('#saveTemplateBtn');
  await expect(page.locator('#toastText')).toHaveText('אין פריטים ברשימה לשמירה');
  await expect(page.locator('#savedTemplates .template-name')).toHaveCount(0);
});

test('other languages get their own basics and no Shabbat template', async ({ page }) => {
  await createFirstList(page, 'languages');
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'es');
  await page.click('#closeSettingsBtn');
  await openTemplates(page);
  await expect(page.locator('#templatesTitle')).toHaveText('Plantillas de la lista');
  await expect(page.locator('#builtinTemplates .template-name')).toHaveText(['Básicos']);
  await page.locator('#builtinTemplates [data-action="add"]').click();
  await expect(page.locator('#toastText')).toHaveText('10 artículos añadidos'.replace('10', '12'));
  await expect(page.locator('.item .item-name').first()).toBeVisible();
});

test('template names with markup are shown as text', async ({ page }) => {
  await createFirstList(page, 'בטיחות');
  await addItem(page, 'חלב');
  await openTemplates(page);
  await page.fill('#templateName', '<img src=x onerror="window.__pwned=1">');
  await page.click('#saveTemplateBtn');
  await expect(page.locator('#savedTemplates .template-name')).toHaveText('<img src=x onerror="window.__pwned=1">');
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('templates belong to the list: another list has its own', async ({ page }) => {
  await createFirstList(page, 'ראשונה');
  await addItem(page, 'חלב');
  await openTemplates(page);
  await page.fill('#templateName', 'שלי');
  await page.click('#saveTemplateBtn');
  await expect(page.locator('#savedTemplates .template-name')).toHaveText(['שלי']);
  await page.click('#closeTemplatesBtn');

  await page.click('#listPickerBtn');
  await page.fill('#newListNameInput', 'שניה');
  await page.click('#createListBtn');
  await expect(page.locator('#headerTitle')).toContainText('שניה');
  await page.click('#closeListPickerBtn');
  await openTemplates(page);
  await expect(page.locator('#savedTemplates .stats-empty')).toBeVisible();
});
