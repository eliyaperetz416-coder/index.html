// Headless smoke test: node tools/shot.mjs [url] [outPrefix] [WxH]   (needs playwright; server on :8123)
import { createRequire } from 'module';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const url = process.argv[2] || 'http://localhost:8123/index.html';
const out = process.argv[3] || '/tmp/shot';
const [W, H] = (process.argv[4] || '844x390').split('x').map(Number);
const script = process.env.SCRIPT ? (await import(process.env.SCRIPT)).default : null;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1500);
if (script) await script(page, out); else {
  await page.screenshot({ path: out + '-title.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: out + '-play.png' });
}
console.log(errors.length ? errors.join('\n') : 'NO CONSOLE ERRORS');
await browser.close();
