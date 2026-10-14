// Shared helpers for the end-to-end scripts. Needs the dev server: `npm run dev` (port 5173).
// Headless Chromium uses SwiftShader (software WebGL), so frame rates here say nothing about phones.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

export const URL = process.env.GAME_URL ?? 'http://localhost:5173/';
export const SHOTS = new globalThis.URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

export async function launch({ size = '844x390', touch = false } = {}) {
  const [width, height] = size.split('x').map(Number);
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  return { browser, ctx, page, errors };
}

/** Opens the game and taps start once loading is done. */
export async function start(page) {
  await page.goto(URL);
  await page.waitForFunction(() => document.getElementById('start-hint').textContent.includes('הקש'), null, { timeout: 90000 });
  await page.click('#start');
}

/** Fast-forwards the running cutscene and waits until the player can walk. */
export async function skipToWalking(page) {
  await page.waitForFunction(() => window.__dn.cutscenes?.active, null, { timeout: 60000 });
  await page.evaluate(() => window.__dn.cutscenes.skip());
  await page.waitForFunction(() => window.__dn.walker?.active, null, { timeout: 30000 });
}

const held = new Set();
async function hold(page, keys) {
  for (const k of [...held]) if (!keys.includes(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}

/**
 * Drives the player with WASD (relative to the camera) to [x, z]. Calls onStep with the state
 * every poll. Throws if the player does not move for 4 s. Returns the final state.
 */
export async function driveTo(page, [tx, tz], { onStep, tolerance = 0.25 } = {}) {
  let last = null;
  let stuckSince = Date.now();
  for (;;) {
    const st = await page.evaluate(([tx, tz]) => {
      const w = window.__dn.walker;
      const p = w.body.position;
      const f = p.clone();
      w.camera.getWorldDirection(f);
      f.y = 0;
      f.normalize();
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      return { p: [p.x, p.y, p.z], d, x: (dx * -f.z + dz * f.x) / d, y: (dx * f.x + dz * f.z) / d, area: w.area.id, active: w.active };
    }, [tx, tz]);
    onStep?.(st);
    if (st.d < tolerance) { await hold(page, []); return st; }
    const keys = [];
    if (st.y > 0.38) keys.push('w');
    if (st.y < -0.38) keys.push('s');
    if (st.x > 0.38) keys.push('d');
    if (st.x < -0.38) keys.push('a');
    await hold(page, keys);
    if (last && Math.hypot(st.p[0] - last[0], st.p[2] - last[2]) > 0.02) stuckSince = Date.now();
    if (Date.now() - stuckSince > 4000) {
      await hold(page, []);
      throw new Error(`stuck at ${st.p.map((n) => n.toFixed(2))} heading to ${tx},${tz}`);
    }
    last = st.p;
    await page.waitForTimeout(80);
  }
}

export function report(name, errors) {
  if (errors.length) {
    console.error(`${name}: FAIL\n${errors.join('\n')}`);
    process.exit(1);
  }
  console.log(`${name}: PASS`);
}
