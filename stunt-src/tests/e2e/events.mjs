// Events: the calendar lists live / upcoming / ended events; a live event plays its own course
// with its rules, and the result screen shows the event goal.
import { serve, launch, openGame, waitFor, report, SHOTS } from './helpers.mjs';

const { server, url } = await serve();
const { browser, page, errors } = await launch();
const shot = (name) => page.screenshot({ path: `${SHOTS}${name}.png` });

try {
  await openGame(page, url);
  await page.click('[data-action="events"]');
  await page.waitForSelector('.event-card');
  await page.waitForTimeout(300);
  await shot('40-events');
  const live = await page.$$eval('.event-card.live [data-action="playEvent"]', (els) => els.map((e) => e.dataset.id));
  if (!live.length) errors.push('no live event to play');
  await page.click(`[data-action="playEvent"][data-id="${live[0]}"]`);
  await waitFor(page, () => window.__game.mode === 'race' && !!window.__game.race.track.event);
  const mods = await page.evaluate(() => window.__game.race.modifiers);
  console.log('playing', live[0], JSON.stringify(mods));
  await page.evaluate(() => { window.__game.setAutopilot(true); window.__game.timeScale = 4; });
  await waitFor(page, () => window.__game.screens.current === 'finish', null, 500000);
  await page.waitForTimeout(2600);
  await shot('41-event-result');
  if (!(await page.$('.event-result'))) errors.push('event result box missing');
  // Back in the menu, the start button does not replay the event course.
  await page.click('[data-action="menu"]');
  const tid = await page.evaluate(() => window.__game.race.track.id);
  if (tid.startsWith('event:')) errors.push('menu should not keep the event track');
} catch (e) {
  errors.push(String(e));
  await shot('zz-events-error').catch(() => {});
} finally {
  await browser.close();
  await server.close();
}
report('events', errors);
