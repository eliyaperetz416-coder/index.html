import { test, expect, resetEmulators, createFirstList, addItem, serverItems, serverHistory, adminList } from './fixtures.mjs';

test.beforeEach(async () => { await resetEmulators(); });

async function openEditor(page, name) {
  await page.locator('.item', { hasText: name }).locator('.item-main').click();
  await expect(page.locator('#itemEditOverlay')).toHaveClass(/show/);
}

test('quantity, note and category can be edited, and show under the name', async ({ page }) => {
  const id = await createFirstList(page, 'עריכה');
  await addItem(page, 'פסטה');
  await openEditor(page, 'פסטה');
  await expect(page.locator('#itemEditTitle')).toHaveText('עריכת פריט');
  await expect(page.locator('#editName')).toHaveValue('פסטה');

  await page.fill('#editQuantity', '2 חבילות');
  await page.fill('#editNote', 'בלי גלוטן');
  await page.selectOption('#editCategory', 'baking');
  await page.click('#editUrgency button[data-urgency="medium"]');
  await page.click('#editSaveBtn');

  const row = page.locator('.item', { hasText: 'פסטה' });
  await expect(page.locator('#itemEditOverlay')).not.toHaveClass(/show/);
  await expect(row.locator('.item-sub')).toHaveText('2 חבילות · בלי גלוטן');
  await expect(row.locator('.item-qty')).toHaveText('2 חבילות');
  await expect(row.locator('.item-cat')).toHaveText('אפייה 🧂');
  await expect(row.locator('.urgency-square')).toHaveCount(1);
  await expect.poll(async () => (await serverItems(id))[0]).toMatchObject({ name: 'פסטה', quantity: '2 חבילות', note: 'בלי גלוטן', catKey: 'baking', urgency: 'medium' });
});

test('emptying quantity, note and urgency removes them', async ({ page }) => {
  const id = await createFirstList(page, 'ריקון');
  await addItem(page, 'אורז');
  await openEditor(page, 'אורז');
  await page.fill('#editQuantity', '1 ק״ג');
  await page.click('#editUrgency button[data-urgency="high"]');
  await page.click('#editSaveBtn');
  await expect.poll(async () => (await serverItems(id))[0].quantity).toBe('1 ק״ג');

  await openEditor(page, 'אורז');
  await page.fill('#editQuantity', '   ');
  await page.click('#editUrgency button[data-urgency="none"]');
  await page.click('#editSaveBtn');
  await expect(page.locator('.item .item-sub')).toHaveCount(0);
  await expect.poll(async () => { const [i] = await serverItems(id); return 'quantity' in i || 'urgency' in i; }).toBe(false);
});

test('rename, Enter saves, Escape and Cancel discard', async ({ page }) => {
  await createFirstList(page, 'שם');
  await addItem(page, 'לחם');
  await openEditor(page, 'לחם');
  await page.fill('#editName', 'לחם מחמצת');
  await page.press('#editName', 'Enter');
  await expect(page.locator('.item-name')).toHaveText(['לחם מחמצת']);

  await openEditor(page, 'לחם מחמצת');
  await page.fill('#editName', 'שונה');
  await page.press('#editName', 'Escape');
  await expect(page.locator('.item-name')).toHaveText(['לחם מחמצת']);

  await openEditor(page, 'לחם מחמצת');
  await page.fill('#editName', '');
  await page.click('#editSaveBtn');
  await expect(page.locator('.item-name')).toHaveText(['לחם מחמצת']);
});

test('the sheet is in the chosen language', async ({ page }) => {
  await createFirstList(page, 'שפה');
  await addItem(page, 'חלב');
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'es');
  await page.click('#closeSettingsBtn');
  await page.locator('.item .item-main').click();
  await expect(page.locator('#itemEditTitle')).toHaveText('Editar artículo');
  await expect(page.locator('#editQuantity')).toHaveAttribute('placeholder', 'p. ej. 2 paquetes');
  await expect(page.locator('#editUrgency button').first()).toHaveText('Ninguna');
});

// ---------- undo ----------
test('deleting shows an undo that brings the item back exactly as it was', async ({ page }) => {
  const id = await createFirstList(page, 'מחיקה');
  await addItem(page, 'ביצים');
  await openEditor(page, 'ביצים');
  await page.fill('#editQuantity', '12');
  await page.click('#editSaveBtn');
  await expect(page.locator('.item-qty')).toHaveText('12');
  const [before] = await serverItems(id);

  await page.locator('.item .delete-btn').click();
  await expect(page.locator('.item')).toHaveCount(0);
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toastText')).toHaveText('הפריט נמחק');
  await page.click('#toastAction');
  await expect(page.locator('.item-name')).toHaveText(['ביצים']);
  await expect(page.locator('.item-qty')).toHaveText('12');
  await expect.poll(async () => (await serverItems(id))[0]).toMatchObject({ id: before.id, name: 'ביצים', quantity: '12', createdAt: before.createdAt });
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
});

test('deleting from the edit sheet can be undone too', async ({ page }) => {
  await createFirstList(page, 'מחיקה 2');
  await addItem(page, 'גבינה');
  await openEditor(page, 'גבינה');
  await page.click('#editDeleteBtn');
  await expect(page.locator('.item')).toHaveCount(0);
  await page.click('#toastAction');
  await expect(page.locator('.item-name')).toHaveText(['גבינה']);
});

test('ticking shows an undo that reverses the tick and its purchase; so does un-ticking', async ({ page }) => {
  const id = await createFirstList(page, 'סימון');
  await addItem(page, 'חלב');
  await page.locator('.checkbox').click();
  await expect(page.locator('#toastText')).toHaveText('סומן כנקנה: חלב');
  await expect.poll(async () => (await serverHistory(id)).length).toBe(1);

  await page.click('#toastAction');
  await expect(page.locator('.item.bought')).toHaveCount(0);
  await expect.poll(async () => (await serverHistory(id)).length).toBe(0);

  await page.locator('.checkbox').click();
  await page.locator('.checkbox').click();
  await expect(page.locator('#toastText')).toHaveText('הוחזר לרשימה: חלב');
  await page.click('#toastAction');
  await expect(page.locator('.item.bought')).toHaveCount(1);
  await expect.poll(async () => (await serverHistory(id)).length).toBe(1);
});

test('the undo message goes away by itself', async ({ page }) => {
  await createFirstList(page, 'זמן');
  await addItem(page, 'מים');
  await page.locator('.item .delete-btn').click();
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 9000 });
});
