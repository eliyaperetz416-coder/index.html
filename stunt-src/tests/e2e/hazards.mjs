// Dev tool: close-up screenshot of every hazard on the hidden 'lab' track.
import { serve, launch, openGame, report, SHOTS } from './helpers.mjs';

const { server, url } = await serve();
const { browser, page, errors } = await launch({ size: process.argv[2] ?? '390x844' });
try {
  await openGame(page, `${url}?quality=${process.env.QUALITY ?? 'high'}`);
  const items = await page.evaluate(() => {
    const g = window.__game;
    g.loop.stop();
    g.start('lab');
    for (let i = 0; i < 100; i++) g.tick(1 / 30);
    return g.race.items.map((it) => ({ type: it.type, s: it.s }));
  });
  for (const [i, it] of items.entries()) {
    await page.evaluate((it) => {
      const g = window.__game;
      const car = g.race.car;
      car.reset(it.s - 26, 0, 30);
      g.view.cam.reset(car);
      for (let k = 0; k < 14; k++) g.tick(1 / 30);
    }, it);
    await page.screenshot({ path: `${SHOTS}h-${i}-${it.type}.png` });
    if (it.type === 'pillar') {
      await page.evaluate(() => {
        const g = window.__game;
        g.input.keys.add('ArrowUp');
        for (let k = 0; k < 6; k++) g.tick(1 / 30);
        g.input.keys.clear();
      });
      await page.screenshot({ path: `${SHOTS}h-${i}-${it.type}-down.png` });
    }
  }
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
  await server.close();
}
report('hazards', errors);
