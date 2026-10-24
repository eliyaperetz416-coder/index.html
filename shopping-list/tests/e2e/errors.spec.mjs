import { test, expect, resetEmulators, signInAs, activeListId } from './fixtures.mjs';

test.beforeEach(async () => { await resetEmulators(); });

async function newUserWithList(page, sub = 'u-e', name = 'רשימה') {
  await page.goto('/');
  await signInAs(page, sub, `${sub}@example.com`);
  await page.fill('#welcomeNewListInput', name);
  await page.click('#welcomeCreateBtn');
  await expect(page.locator('#itemInput')).toBeVisible();
}

test('join failures show a friendly message by error code, not "not found" for everything', async ({ page }) => {
  await newUserWithList(page);
  await page.click('#listPickerBtn');

  for (const [code, message] of [
    ['permission-denied', 'אין לך הרשאה לפעולה הזו. נסו להתנתק ולהתחבר מחדש'],
    ['unavailable', 'אין חיבור לאינטרנט. בדקו את הקליטה ונסו שוב'],
    ['something-odd', 'משהו השתבש. נסו שוב בעוד רגע'],
  ]) {
    await page.evaluate((c) => { window.FB.getDoc = () => Promise.reject({ code: c }); }, code);
    await page.fill('#joinCodeInput', 'ABCDEFGH');
    await page.click('#joinListBtn');
    await expect(page.locator('#joinListError')).toHaveText(message);
  }
  await expect(page.locator('#joinListError')).not.toContainText('DEBUG');
});

test('a failed save tells the user and does not swallow the next remote update', async ({ page }) => {
  await newUserWithList(page);
  await page.evaluate(() => { window.FB.updateDoc = () => Promise.reject({ code: 'unavailable' }); });
  await page.fill('#itemInput', 'חלב');
  await page.click('#addBtn');
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#toast')).toContainText('השינוי לא נשמר');
  await expect(page.locator('#toast')).toContainText('אין חיבור לאינטרנט');
});

test('create-list failure is shown under the form and the button works again', async ({ page }) => {
  await page.goto('/');
  await signInAs(page, 'u-c', 'c@example.com');
  await page.evaluate(() => {
    window.FB.writeBatch = () => ({ set() {}, update() {}, commit: () => Promise.reject({ code: 'permission-denied' }) });
  });
  await page.fill('#welcomeNewListInput', 'x');
  await page.click('#welcomeCreateBtn');
  await expect(page.locator('#welcomeCreateError')).toHaveText('אין לך הרשאה לפעולה הזו. נסו להתנתק ולהתחבר מחדש');
  await expect(page.locator('#welcomeCreateBtn')).toBeEnabled();
  await expect(page.locator('#welcomeScreen')).toBeVisible();
});

test('if the lists cannot be loaded the user sees an error with retry, not the "no lists" screen', async ({ page }) => {
  await newUserWithList(page);
  await page.evaluate(() => {
    window.__realGetDocs = window.FB.getDocs;
    window.FB.getDocs = () => Promise.reject({ code: 'unavailable' });
  });
  await page.evaluate(async () => { await window.__fb.auth.signOut(window.FB.auth); });
  await page.evaluate(async () => {
    const { GoogleAuthProvider, signInWithCredential } = window.__fb.auth;
    await signInWithCredential(window.FB.auth, GoogleAuthProvider.credential(JSON.stringify({ sub: 'u-e', email: 'u-e@example.com', email_verified: true })));
  });
  await expect(page.locator('#loadErrorScreen')).toBeVisible();
  await expect(page.locator('#loadErrorText')).toHaveText('אין חיבור לאינטרנט. בדקו את הקליטה ונסו שוב');
  await expect(page.locator('#welcomeScreen')).toBeHidden();

  await page.evaluate(() => { window.FB.getDocs = window.__realGetDocs; });
  await page.click('#retryLoadBtn');
  await expect(page.locator('#loadErrorScreen')).toBeHidden();
  await expect(page.locator('#itemInput')).toBeVisible();
});

test('sign-in errors: blocked popup is explained, closing the popup says nothing', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.FB);
  await page.evaluate(() => { window.FB.signInWithGoogle = () => Promise.reject({ code: 'auth/popup-blocked' }); });
  await page.click('#googleSignInBtn');
  await expect(page.locator('#loginErrorMsg')).toHaveText('הדפדפן חסם את חלון ההתחברות. אפשרו חלונות קופצים ונסו שוב');

  await page.evaluate(() => { window.FB.signInWithGoogle = () => Promise.reject({ code: 'auth/popup-closed-by-user' }); });
  await page.click('#googleSignInBtn');
  await expect(page.locator('#loginErrorMsg')).toHaveText('');
});

test('the on-screen JS error box only appears with ?debug=1', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => setTimeout(() => { throw new Error('boom'); }, 0));
  await page.waitForTimeout(300);
  await expect(page.locator('#debugErrorBox')).toHaveCount(0);

  await page.goto('/?debug=1');
  await page.evaluate(() => setTimeout(() => { throw new Error('boom'); }, 0));
  await expect(page.locator('#debugErrorBox')).toContainText('boom');
});

test('Spanish settings title is no longer "undefined"', async ({ page }) => {
  await newUserWithList(page, 'u-es');
  await page.click('#settingsBtn');
  await page.selectOption('#langSelect', 'es');
  await expect(page.locator('#settingsTitle')).toHaveText('Ajustes');
  await expect(page.locator('body')).not.toContainText('undefined');
});
