// Every list member can write any text into the shared list document. Those values must
// never be able to run script or make the page load things from elsewhere.
import { test, expect, resetEmulators, patchListDoc, createFirstList, putItems, putHistory } from './fixtures.mjs';

const DAY = 24 * 60 * 60 * 1000;
test.beforeEach(async () => { await resetEmulators(); });

test('malicious values written by another member are shown as plain text, never executed', async ({ page }) => {
  const outside = [];
  page.on('request', (r) => { if (r.url().includes('evil.invalid')) outside.push(r.url()); });

  const id = await createFirstList(page, 'רשימה');
  const now = Date.now();
  const evilName = '<img src=x onerror="window.__pwned=1">';
  await patchListDoc(page, id, { name: '<img src=x onerror="window.__pwned=2">' });
  // Written straight into the database, past the rules: rendering must be safe on its own.
  await putItems(id, [
    { id: 'a" onmouseover="window.__pwned=3" data-x="', name: evilName, bought: false,
      catKey: 'constructor', catName: '<img src=x onerror="window.__pwned=4">',
      catColor: 'red; background-image: url(http://evil.invalid/item.png)', urgency: '__proto__' },
    { id: 'b', name: 'בסדר', bought: false, catKey: '"><img src=x onerror="window.__pwned=5">',
      catName: 'x', catColor: 'url(http://evil.invalid/cat.png)' },
  ]);
  await putHistory(id, [
    { name: 'x', catKey: '<img src=x onerror="window.__pwned=6">', catColor: 'url(http://evil.invalid/bar.png)', timestamp: now - DAY },
    ...[40, 30, 20, 10].map((d) => ({ name: 'q" onclick="window.__pwned=7" x="', catKey: 'other', timestamp: now - d * DAY })),
  ]);

  await expect(page.locator('.item-name').first()).toHaveText(evilName);
  // Fire mouse events at everything so any injected inline handler would run.
  await page.$$eval('#list *', (els) => els.forEach((el) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))));
  await page.click('#navStatsBtn');
  await page.$$eval('#suggestionsList *', (els) => els.forEach((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))));
  await page.click('#navListBtn');
  await page.click('#listPickerBtn');
  await page.waitForTimeout(500);

  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await page.locator('#appRoot img, #listPickerOverlay img').count()).toBe(0);
  expect(outside).toEqual([]);
  // The unknown category shows as "other" with the normal colour, not the stored text.
  await expect(page.locator('.item').first().locator('.item-cat')).toHaveText('שונות 🛍️');
});
