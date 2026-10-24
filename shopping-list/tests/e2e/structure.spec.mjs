// Behaviour that comes from how the code is split: files are fetched on demand.
import { test, expect, resetEmulators, createFirstList } from './fixtures.mjs';

test.beforeEach(async () => { await resetEmulators(); });

test('only Hebrew is downloaded until another language is chosen, and each is fetched once', async ({ page }) => {
  const dictionaries = [];
  page.on('request', (r) => { const m = r.url().match(/\/i18n\/(\w+)\.js$/); if (m) dictionaries.push(m[1]); });

  await createFirstList(page, 'טעינה');
  expect(dictionaries).toEqual(['he']);

  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'en');
  await expect(page.locator('#settingsTitle')).toHaveText('Settings');
  await page.selectOption('#langSelect', 'he');
  await page.selectOption('#langSelect', 'en');
  await expect(page.locator('#settingsTitle')).toHaveText('Settings');
  expect(dictionaries).toEqual(['he', 'en']);
});

test('a language that cannot be downloaded is not applied', async ({ page, context }) => {
  await createFirstList(page, 'כשל');
  await context.route('**/i18n/fr.js', (route) => route.abort());
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'fr');
  await page.waitForTimeout(500);
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('#langSelect')).toHaveValue('he');
  await expect(page.locator('#settingsTitle')).toHaveText('הגדרות');
});

test('an unknown language in storage falls back to Hebrew instead of breaking the app', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('appLang', 'xx'));
  await page.goto('/');
  await expect(page.locator('#loginTitle')).toHaveText('הרשימה שלי');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
});

test('a saved language is loaded before the first screen is shown', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('appLang', 'ar'));
  await page.goto('/');
  await expect(page.locator('#googleSignInLabel')).toHaveText('تسجيل الدخول بواسطة Google');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('if Firebase cannot be loaded the login button explains, and tapping again reloads to retry', async ({ page, context }) => {
  const blockFirebase = (route) => route.abort();
  await context.route('https://www.gstatic.com/firebasejs/**', blockFirebase);
  await page.goto('/');
  await page.click('#googleSignInBtn');
  await expect(page.locator('#loginErrorMsg')).toHaveText('אין חיבור לאינטרנט. בדקו את הקליטה ונסו שוב');
  expect(await page.evaluate(() => !!window.FB)).toBe(false);

  await context.unroute('https://www.gstatic.com/firebasejs/**', blockFirebase);
  await Promise.all([page.waitForEvent('load'), page.click('#googleSignInBtn')]);
  await page.waitForFunction(() => !!window.FB);
  await expect(page.locator('#loginErrorMsg')).toHaveCount(0);
});
