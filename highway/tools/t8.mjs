const waitFor = (page, fn, ms = 20000) => page.waitForFunction(fn, null, { timeout: ms, polling: 100 });
export default async (page, out) => {
  await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  await page.keyboard.press('p'); await page.waitForTimeout(300);
  console.log('state', await page.evaluate(() => __game.state), 'audio ctx', await page.evaluate(() => __game.audio.ctx && __game.audio.ctx.state));
  await page.screenshot({ path: out + '-pause.png' });
  const t0 = await page.evaluate(() => __game.run.time);
  await page.waitForTimeout(800);
  console.log('time frozen', t0 === await page.evaluate(() => __game.run.time));
  await page.keyboard.press('p'); await page.waitForTimeout(300);
  console.log('state', await page.evaluate(() => __game.state));
  await page.screenshot({ path: out + '-countdown.png' });
  await page.evaluate(() => { __game.countdown = 0.05; }); await waitFor(page, () => __game.state === 'playing');
  console.log('resumed ->', await page.evaluate(() => __game.state));
  // sound toggle off via settings, ensure no crash
  await page.evaluate(() => __game.audio.setEnabled(false)); await page.evaluate(() => __game.audio.sfx('crash'));
  console.log('rs', await page.evaluate(() => __game.resScale));
};
