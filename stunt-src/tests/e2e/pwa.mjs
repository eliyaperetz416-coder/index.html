// Production build check: manifest is valid, the service worker precaches everything, and the
// game still boots with the network switched off. Run `npm run build` first.
import { preview } from 'vite';
import { fileURLToPath } from 'node:url';
import { launch, report, SHOTS } from './helpers.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const server = await preview({ root, logLevel: 'error', preview: { port: 4183, host: '127.0.0.1' } });
const url = 'http://127.0.0.1:4183/';
const { browser, ctx, page, errors } = await launch();

try {
  const manifest = await (await fetch(`${url}manifest.webmanifest`)).json();
  if (!manifest.name || manifest.display !== 'fullscreen' || manifest.orientation !== 'portrait') errors.push(`bad manifest ${JSON.stringify(manifest)}`);
  for (const icon of manifest.icons) {
    const r = await fetch(url + icon.src);
    if (!r.ok) errors.push(`icon missing: ${icon.src}`);
  }
  await page.goto(url);
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 60000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 30000 });
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const k of keys) {
      const c = await caches.open(k);
      if ((await c.keys()).length > 5) return true;
    }
    return false;
  }, null, { timeout: 30000, polling: 500 });
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 60000 });
  await page.screenshot({ path: `${SHOTS}pwa-offline.png` });
  const title = await page.title();
  if (title !== manifest.name) errors.push(`title "${title}" should be the game name "${manifest.name}"`);
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
report('pwa', errors);
