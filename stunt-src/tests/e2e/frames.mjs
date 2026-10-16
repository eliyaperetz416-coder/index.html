// Dev tool: drives a track deterministically (the loop is stopped and ticked by hand) and saves
// a sheet of frames, so camera and effects can be checked at exact moments.
// Usage: node tests/e2e/frames.mjs [trackId] [every-seconds] [size]
import { serve, launch, openGame, report, SHOTS } from './helpers.mjs';

const trackId = process.argv[2] ?? 'test';
const every = Number(process.argv[3] ?? 1.5);
const { server, url } = await serve();
const { browser, page, errors } = await launch({ size: process.argv[4] ?? '390x844' });

try {
  await openGame(page, url);
  await page.evaluate((id) => {
    const g = window.__game;
    g.loop.stop();
    g.start(id);
    g.input.keys.add('ArrowUp');
  }, trackId);
  let i = 0;
  for (;;) {
    const st = await page.evaluate((every) => {
      const g = window.__game;
      for (let t = 0; t < every; t += 1 / 30) g.tick(1 / 30);
      const r = g.race;
      return { state: r.state, s: r.car.trackS, mode: r.car.mode, v: r.car.speed, t: r.time, piece: r.path.segments[r.path.seg[r.path.indexAt(r.car.trackS)]].piece };
    }, every);
    await page.screenshot({ path: `${SHOTS}f-${trackId}-${String(i++).padStart(3, '0')}.png` });
    console.log(i, JSON.stringify(st));
    if (st.state === 'finished' || i > 120) break;
  }
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
  await server.close();
}
report('frames', errors);
