const waitFor = (page, fn, ms = 20000) => page.waitForFunction(fn, null, { timeout: ms, polling: 100 });
export default async (page, out) => {
  await page.keyboard.press('Enter');
  await page.evaluate(() => { __game.player.time = 100; });
  const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 1000) r(n); else requestAnimationFrame(f); }; f(); }));
  console.log('fps', fps);
  // close call: car in adjacent lane passes alongside
  await page.evaluate(() => { const g = __game, t = g.traffic; t._spawn(g.player.lane === 3 ? 2 : 3, 12); t.active[t.active.length - 1].z = -12; });
  await waitFor(page, () => __game.scoring.combo >= 1);
  await page.screenshot({ path: out + '-cc.png' });
  console.log(await page.evaluate(() => JSON.stringify({ combo: __game.scoring.combo, score: Math.round(__game.scoring.score), mult: __game.scoring.mult })));
  // light hit
  await page.evaluate(() => { const g = __game, t = g.traffic; t._spawn(g.player.lane === 3 ? 2 : 3, 12); const c = t.active[t.active.length - 1]; c.z = -3; c.x = g.player.x + (g.player.wid + c.wid) / 2 - 0.4; c.obj.position.x = c.x; });
  await waitFor(page, () => __game.scoring.lightHits >= 1);
  await page.screenshot({ path: out + '-light.png' });
  console.log('after light', await page.evaluate(() => JSON.stringify({ st: __game.state, combo: __game.scoring.combo, inv: __game.player.invuln.toFixed(2) })));
  await waitFor(page, () => __game.player.invuln <= 0);
  await page.evaluate(() => { const g = __game, t = g.traffic; t._spawn(g.player.lane, 12); const c = t.active[t.active.length - 1]; c.z = -3; });
  await waitFor(page, () => __game.state === 'crashing');
  await page.screenshot({ path: out + '-hard.png' });
  await waitFor(page, () => __game.state === 'gameover');
  await page.screenshot({ path: out + '-over.png' });
  console.log('final', await page.evaluate(() => __game.state));
};
