// Shared helpers for the end-to-end scripts. They start their own Vite dev server.
// Headless Chromium renders WebGL in software (SwiftShader): frame rates here say nothing about
// phones, so the scripts speed the game clock up with window.__game.timeScale.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export async function serve() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const { port } = server.httpServer.address();
  return { server, url: `http://127.0.0.1:${port}/` };
}

export async function launch({ size = '390x844', touch = true } = {}) {
  const [width, height] = size.split('x').map(Number);
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync);
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || exe,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  return { browser, ctx, page, errors };
}

export async function openGame(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 60000 });
}

/** Presses and keeps holding the mouse on an element (pointer stays down). */
export async function holdOn(page, selector) {
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  return { x, y };
}

export async function waitFor(page, fn, arg, timeout = 120000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 100 });
}

export function report(name, errors) {
  if (errors.length) {
    console.error(`FAIL ${name}`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${name}`);
  }
}
