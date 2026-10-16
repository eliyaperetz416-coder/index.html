// Dev tool: drives a track deterministically (the loop is stopped and ticked by hand) and saves
// a sheet of frames, so camera and effects can be checked at exact moments.
// Usage: node tests/e2e/frames.mjs [trackId] [every-seconds] [size]
import { serve, launch, openGame, report, SHOTS } from './helpers.mjs';

const trackId = process.argv[2] ?? 'test';
const every = Number(process.argv[3] ?? 1.5);
const { server, url } = await serve();
const { browser, page, errors } = await launch({ size: process.argv[4] ?? '390x844' });

try {
  await openGame(page, process.env.QUALITY ? `${url}?quality=${process.env.QUALITY}` : url);
  await page.evaluate(([id, ai]) => {
    const g = window.__game;
    g.loop.stop();
    g.start(id);
    g.input.keys.add('ArrowUp');
    if (ai) g.setAutopilot(true);
  }, [trackId, !!process.env.AI]);
  let i = 0;
  for (;;) {
    const st = await page.evaluate(([every, steer]) => {
      const g = window.__game;
      for (let t = 0; t < every; t += 1 / 30) {
        // STEER=1: weave hard left/right every 2 s to show drifting.
        if (steer) {
          const left = Math.floor(g.race.time / 2) % 2 === 0;
          g.input.keys.delete(left ? 'ArrowRight' : 'ArrowLeft');
          g.input.keys.add(left ? 'ArrowLeft' : 'ArrowRight');
        }
        g.tick(1 / 30);
      }
      const r = g.race;
      return { state: r.state, s: r.car.trackS, mode: r.car.mode, v: r.car.speed, t: r.time, piece: r.path.segments[r.path.seg[r.path.indexAt(r.car.trackS)]].piece };
    }, [every, !!process.env.STEER]);
    await page.screenshot({ path: `${SHOTS}f-${trackId}-${String(i++).padStart(3, '0')}.png` });
    console.log(i, JSON.stringify(st));
    if (st.state === 'finished' || i >= Number(process.env.MAX_FRAMES ?? 120)) break;
  }
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
  await server.close();
}
report('frames', errors);
