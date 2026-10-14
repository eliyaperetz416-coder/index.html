// Floor 2 classroom -> corridor -> both stair flights -> lobby -> courtyard -> notebook.
// Checks: never stuck, heights follow the stairs, lobby on the ground, walking back up a flight
// backwards never drops, and the stairwell camera stays inside the building.
import { launch, start, skipToWalking, driveTo, report, SHOTS } from './helpers.mjs';

const SIZE = process.env.SIZE ?? '844x390';
const FLOOR2 = 3.6;
const { browser, page, errors } = await launch({ size: SIZE });
const ys = (st) => st.p[1];

try {
  await start(page);
  await skipToWalking(page);
  await page.waitForTimeout(600);
  const spawn = await page.evaluate(() => window.__dn.walker.body.position.y);
  if (Math.abs(spawn - FLOOR2) > 0.05) errors.push(`spawn height ${spawn}, expected ${FLOOR2}`);

  // Classroom -> door -> corridor -> top of the upper flight.
  for (const p of [[1.8, -2.72], [-2.9, -2.72], [-2.9, -3.6], [-3.9, -5.15]]) await driveTo(page, p);

  // Down both flights: height must never go up (±0.05).
  let last = Infinity;
  const descend = (st) => {
    if (ys(st) > last + 0.05) errors.push(`went up on the way down: ${last.toFixed(2)} -> ${ys(st).toFixed(2)} at ${st.p.map((n) => n.toFixed(2))}`);
    last = Math.min(last, ys(st));
  };
  await driveTo(page, [-7.3, -5.15], { onStep: descend });
  const landing = await driveTo(page, [-7.3, -3.85], { onStep: descend });
  if (Math.abs(ys(landing) - 1.8) > 0.1) errors.push(`landing height ${ys(landing)}, expected 1.8`);
  const cam = await page.evaluate(() => window.__dn.walker.camera.position.toArray());
  if (!(cam[0] > -8 && cam[0] < -3.2 && cam[2] > -5.8 && cam[2] < -3.2 && cam[1] < 7.3)) {
    errors.push(`stairwell camera outside the building: ${cam.map((n) => n.toFixed(2))}`);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}walk-${SIZE}-stairwell.png` });
  const bottom = await driveTo(page, [-3.9, -3.85], { onStep: descend });
  if (Math.abs(ys(bottom)) > 0.05) errors.push(`bottom of the stairs at ${ys(bottom)}, expected 0`);

  // Walk back up the lower flight backwards (S = away from the camera's view direction).
  let prev = ys(bottom);
  await page.keyboard.down('s');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(100);
    const y = await page.evaluate(() => window.__dn.walker.body.position.y);
    if (y < prev - 0.05) errors.push(`dropped while backing up the stairs: ${prev.toFixed(2)} -> ${y.toFixed(2)}`);
    prev = Math.max(prev, y);
  }
  await page.keyboard.up('s');
  if (prev < 0.4) errors.push(`backing up the stairs only reached ${prev.toFixed(2)}`);
  await driveTo(page, [-3.9, -3.85]);

  // Lobby -> doors -> courtyard -> notebook (walk step ends within 1 m).
  for (const p of [[0, -4.2], [3.0, -4.5]]) {
    const st = await driveTo(page, p);
    if (Math.abs(ys(st)) > 0.05) errors.push(`lobby height ${ys(st)} at ${p}`);
  }
  await page.screenshot({ path: `${SHOTS}walk-${SIZE}-lobby.png` });
  await driveTo(page, [4.8, -4.5]);
  // The walk step ends within 1 m of the notebook and then turns input off.
  await driveTo(page, [9, 1], {
    stopWhen: () => document.querySelector('#objective .text').textContent === 'הרם את המחברת',
  });
  await page.waitForTimeout(600);
  const objective = await page.evaluate(() => document.querySelector('#objective .text').textContent);
  if (objective !== 'הרם את המחברת') errors.push(`did not reach the notebook (objective: ${objective})`);
} catch (e) {
  errors.push(String(e));
} finally {
  await browser.close();
}
report(`walk ${SIZE}`, errors);
