export default async (page) => {
  const res = await page.evaluate(async () => {
    const g = __game; g.startRun(); g.ui.clearScreens();
    let steps = 0; const log = [];
    while (g.state === 'playing' && steps < 60 * 120) {
      const p = g.player, lanes = 4;
      const enter = Array(lanes).fill(99);
      for (const t of g.traffic.active) {
        const half = (t.len + p.len) / 2 + 0.6;
        const tEnter = (-t.z - half) / t.relSpeed, tExit = (-t.z + half) / t.relSpeed;
        if (tExit < 0) continue;
        enter[t.lane] = Math.min(enter[t.lane], Math.max(0, tEnter));
      }
      if (enter[p.lane] < 1.5) {
        let best = p.lane, bt = enter[p.lane];
        for (const d of [-1, 1]) { const l = p.lane + d; if (l >= 0 && l < lanes && enter[l] > Math.max(bt + 0.5, 1.2)) { best = l; bt = enter[l]; } }
        if (best !== p.lane) p.changeLane(best - p.lane);
      }
      if (steps % 30 === 0) log.push(steps / 60 + 's lane' + p.lane + ' ' + enter.map((v) => v.toFixed(1)).join('/') + ' x=' + p.x.toFixed(1));
      g.update(1 / 60); steps++;
    }
    return { state: g.state, secs: steps / 60, last: log.slice(-6), hit: g.traffic.lastOverlapX, cars: g.traffic.active.filter((t) => Math.abs(t.z) < 25).map((t) => `L${t.lane} z${t.z.toFixed(1)} rel${t.relSpeed.toFixed(0)} len${t.len}`) };
  });
  console.log(JSON.stringify(res, null, 1));
};
