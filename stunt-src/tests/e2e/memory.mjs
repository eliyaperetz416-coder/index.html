// Memory: switching between tracks, worlds, cars and menus many times must not keep growing the
// number of GPU geometries and textures (everything built for a race is disposed).
import { serve, launch, openGame, report } from './helpers.mjs';

const { server, url } = await serve();
const { browser, page, errors } = await launch();
try {
  await openGame(page, url);
  const counts = await page.evaluate(() => {
    const g = window.__game;
    g.loop.stop();
    g.save.coins = 1e6;
    const tracks = ['neon-1', 'desert-1', 'neon-boss', 'event:moon-jump', 'lab'];
    const out = [];
    for (let round = 0; round < 3; round++) {
      for (const id of tracks) {
        g.start(id);
        for (let i = 0; i < 20; i++) g.tick(1 / 30);
        g.menu();
        g.tick(1 / 30);
      }
      g.screens.handlers.garage();
      g.screens.handlers.nextCar();
      g.screens.handlers.nextCar();
      g.tick(1 / 30);
      g.menu();
      g.tick(1 / 30);
      const m = g.renderer.renderer.info.memory;
      out.push({ geometries: m.geometries, textures: m.textures });
    }
    return out;
  });
  console.log('memory per round', JSON.stringify(counts));
  const [, b, c] = counts;
  if (c.geometries > b.geometries + 5 || c.textures > b.textures + 2) errors.push(`GPU memory keeps growing: ${JSON.stringify(counts)}`);
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
  await server.close();
}
report('memory', errors);
