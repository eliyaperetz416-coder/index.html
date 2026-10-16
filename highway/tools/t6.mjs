const waitFor = (page, fn, ms = 20000) => page.waitForFunction(fn, null, { timeout: ms, polling: 100 });
export default async (page, out) => {
  const click = (sel, i = 0) => page.evaluate(([s, i]) => document.querySelectorAll(s)[i].click(), [sel, i]);
  await click('.card .btn-row .btn', 2); // settings
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '-settings.png' });
  // choose wheel
  await click('.seg:nth-of-type(1) button', 0);
  for (const [mode, idx] of [['wheel', 1], ['swipe', 2]]) {
    await page.evaluate((i) => document.querySelectorAll('.set-row')[0].querySelectorAll('button')[i].click(), idx);
    await page.evaluate(() => [...document.querySelectorAll('.card .btn')].pop().click());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await page.screenshot({ path: out + '-' + mode + '.png' });
    const lane0 = await page.evaluate(() => __game.player.lane);
    if (mode === 'wheel') {
      const box = await page.evaluate(() => { const r = document.querySelector('.wheel').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      await page.mouse.move(box[0], box[1]); await page.mouse.down(); await page.mouse.move(box[0] + 40, box[1], { steps: 4 }); await page.mouse.move(box[0] + 90, box[1], { steps: 4 });
      await page.waitForTimeout(100); await page.screenshot({ path: out + '-wheel-turn.png' }); await page.mouse.up();
    } else {
      await page.mouse.move(300, 200); await page.mouse.down(); await page.mouse.move(380, 200, { steps: 6 }); await page.mouse.up();
    }
    await page.waitForTimeout(300);
    console.log(mode, 'lane', lane0, '->', await page.evaluate(() => __game.player.lane), 'nitro btn', await page.evaluate(() => !!document.querySelector('.nitro-btn')));
    // back to menu: force crash and go menu
    await page.evaluate(() => { const g = __game, t = g.traffic; t._spawn(g.player.lane, 12); t.active[t.active.length - 1].z = -3; });
    await waitFor(page, () => __game.state === 'gameover');
    await page.evaluate(() => [...document.querySelectorAll('.card .btn-row .btn')][1].click());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelectorAll('.card .btn-row .btn')[2].click());
    await page.waitForTimeout(300);
  }
  // quality low + reset
  await page.evaluate(() => document.querySelectorAll('.set-row')[2].querySelectorAll('button')[0].click());
  await page.waitForTimeout(500); await page.screenshot({ path: out + '-low.png' });
  console.log('q', await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('neonlanes.save.v1')).settings)));
  await page.evaluate(() => document.querySelector('.btn.danger').click()); await page.evaluate(() => document.querySelector('.btn.danger').click());
  await page.waitForTimeout(500);
  console.log('after reset', await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('neonlanes.save.v1')).settings)));
};
