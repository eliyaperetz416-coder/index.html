// Steps the real game headlessly with a simple dodging bot and reports stats per world / car.
export default async (page) => {
  const res = await page.evaluate(async () => {
    const { save } = await import('/src/storage.js');
    const out = [];
    for (const [world, car] of [['neoncity', 'hatch'], ['rainynight', 'gt'], ['tunnel', 'f1'], ['neoncity', 'emperor']]) {
      save.data.selectedCar = car; save.data.ownedCars = ['hatch', 'gt', 'f1', 'emperor']; save.data.settings.world = world;
      const g = __game; g.setState('title'); g.exitGarage?.call; 
      const c = (await import('/src/data/cars.js')).carById(car); g.player.setCar(c, g.statsFor(c)); g.fx.attachPlayer(g.player);
      g.startRun(); g.ui.clearScreens();
      let steps = 0, lastLane = 0, lanesChanged = 0;
      while (g.state === 'playing' || g.state === 'crashing') {
        const p = g.player, lanes = g.worldDef.lanes.length;
        // earliest time each lane becomes occupied (ignoring cars already passed)
        const enter = Array(lanes).fill(99);
        for (const t of g.traffic.active) {
          const half = (t.len + p.len) / 2 + 0.8;
          const tEnter = (-t.z - half) / t.relSpeed, tExit = (-t.z + half) / t.relSpeed;
          if (tExit < 0) continue;
          enter[t.lane] = Math.min(enter[t.lane], Math.max(0, tEnter));
        }
        // choose the reachable lane that stays free longest; a lane change takes ~0.4 s per lane
        const cur = p.lane; let best = cur, bscore = enter[cur];
        for (let l = 0; l < lanes; l++) {
          if (l === cur) continue;
          const dist = Math.abs(l - cur); let ok = true;
          for (let k = cur + Math.sign(l - cur); ; k += Math.sign(l - cur)) { if (enter[k] < 0.4 * Math.abs(k - cur) + 0.3) { ok = false; break; } if (k === l) break; }
          const sc = enter[l] - dist * 0.5;
          if (ok && sc > bscore + 0.8) { best = l; bscore = sc; }
        }
        if (enter[cur] < 3.0 && best !== cur) { p.changeLane(Math.sign(best - cur)); lanesChanged++; }
        g.nitroWanted = steps % 400 < 120;
        g.update(1 / 60); steps++;
        if (steps > 60 * 240) break; // 240 s of game time
      }
      const near = g.traffic.active.filter((t) => Math.abs(t.z) < 30).map((t) => `L${t.lane} z${t.z.toFixed(1)} rel${t.relSpeed.toFixed(0)} len${t.len} x${t.x.toFixed(1)} hit${t.hit ? 1 : 0}`);
      out.push({ near, px: +g.player.x.toFixed(2), plane: g.player.lane, world, car, secs: Math.round(steps / 60), state: g.state, score: Math.round(g.scoring.score), cc: g.scoring.closeCalls, tight: g.scoring.tightCalls, lightHits: g.scoring.lightHits, topKmh: Math.round(g.run.topKmh), pool: g.traffic.active.length, lanesChanged });
    }
    return out;
  });
  for (const r of res) console.log(JSON.stringify(r));
};
