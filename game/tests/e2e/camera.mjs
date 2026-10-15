// Touch: left half = joystick (walks), right half = camera drag (turns the view); both at once.
import { launch, start, skipToWalking, report, SHOTS } from './helpers.mjs';

const { browser, ctx, page, errors } = await launch({ size: '844x390', touch: true });
try {
  await start(page);
  await skipToWalking(page);
  await page.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const dir = () => page.evaluate(() => {
    const w = window.__dn.walker;
    const f = w.camera.position.clone();
    w.camera.getWorldDirection(f);
    return { yaw: Math.atan2(f.x, f.z), dy: f.y, p: w.body.position.toArray() };
  });
  const before = await dir();

  // 1. Camera drag on the right half only: the view turns, the character stays put.
  await touch('touchStart', [{ x: 600, y: 200, id: 7 }]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: 600 + i * 25, y: 200, id: 7 }]); await page.waitForTimeout(40); }
  await touch('touchEnd', []);
  await page.waitForTimeout(1500);
  const turned = await dir();
  let dyaw = Math.atan2(Math.sin(turned.yaw - before.yaw), Math.cos(turned.yaw - before.yaw));
  if (Math.abs(dyaw) < 0.3) errors.push(`camera did not turn (yaw change ${dyaw.toFixed(2)})`);
  if (Math.hypot(turned.p[0] - before.p[0], turned.p[2] - before.p[2]) > 0.05) errors.push('dragging the right half moved the character');
  await page.screenshot({ path: `${SHOTS}camera-turned.png` });

  // 2. Joystick on the left half only: the character walks, the view keeps its angle.
  await touch('touchStart', [{ x: 150, y: 300, id: 1 }]);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', [{ x: 150, y: 300 - i * 10, id: 1 }]); await page.waitForTimeout(30); }
  await page.waitForTimeout(1200);
  await touch('touchEnd', []);
  const walked = await dir();
  if (Math.hypot(walked.p[0] - turned.p[0], walked.p[2] - turned.p[2]) < 0.3) errors.push('joystick on the left half did not move the character');

  // 3. Both fingers at once.
  const mid = await dir();
  await touch('touchStart', [{ x: 150, y: 300, id: 1 }, { x: 600, y: 200, id: 7 }]);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', [{ x: 150, y: 300 - i * 9, id: 1 }, { x: 600 - i * 20, y: 200, id: 7 }]);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(800);
  await touch('touchEnd', []);
  const both = await dir();
  if (Math.hypot(both.p[0] - mid.p[0], both.p[2] - mid.p[2]) < 0.2) errors.push('two fingers: character did not move');
  dyaw = Math.atan2(Math.sin(both.yaw - mid.yaw), Math.cos(both.yaw - mid.yaw));
  if (Math.abs(dyaw) < 0.2) errors.push(`two fingers: camera did not turn (${dyaw.toFixed(2)})`);
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
}
report('camera', errors);
