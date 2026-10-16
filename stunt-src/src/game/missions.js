// Daily missions: three per day picked from config/missions.js with a seed made from the date,
// progress fed from finished races, rewards claimed on the missions screen.

import { MISSIONS, DAILY_COUNT, ALL_DONE_BONUS } from '../config/missions.js';
import { rng, hash, lerp } from '../core/math.js';

/** Local calendar day, e.g. "2026-10-16". */
export function dayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function rollMissions(day) {
  const r = rng(hash(`missions:${day}`));
  const pool = [...MISSIONS];
  const out = [];
  while (out.length < DAILY_COUNT && pool.length) {
    const m = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const k = r();
    const n = Math.round(lerp(m.n[0], m.n[1], k));
    const reward = Math.round(lerp(m.reward[0], m.reward[1], k) / 10) * 10;
    out.push({ id: m.id, stat: m.stat, n, reward, progress: 0, claimed: false, text: m.text.replaceAll('{n}', n).replaceAll('{s}', n === 1 ? '' : 's') });
  }
  return out;
}

/** Today's missions (rolls new ones after midnight). */
export function dailyMissions(save, now = new Date()) {
  const day = dayKey(now);
  if (save.missions?.day !== day) save.missions = { day, list: rollMissions(day), bonusClaimed: false };
  return save.missions;
}

/** What a finished race adds to each mission stat. */
export function raceStats(race, result = {}) {
  const sc = race.score;
  return {
    races: 1,
    nearMiss: sc.nearMiss,
    drift: sc.drift,
    air: sc.air,
    coins: sc.coins,
    nitros: sc.nitros,
    flips: sc.flips,
    boosts: sc.boosts,
    clean: sc.hits === 0 && sc.crashes === 0 ? 1 : 0,
    gold: result.medal === 'gold' ? 1 : 0,
    boss: result.bossWin ? 1 : 0,
    event: result.event ? 1 : 0,
  };
}

/** Add a race to today's missions. Returns the missions that just became complete. */
export function trackMissions(save, stats, now = new Date()) {
  const m = dailyMissions(save, now);
  const done = [];
  for (const mission of m.list) {
    if (mission.progress >= mission.n) continue;
    mission.progress = Math.min(mission.n, mission.progress + (stats[mission.stat] ?? 0));
    if (mission.progress >= mission.n) done.push(mission);
  }
  return done;
}

export function claimMission(save, index, now = new Date()) {
  const m = dailyMissions(save, now);
  const mission = m.list[index];
  if (!mission || mission.claimed || mission.progress < mission.n) return 0;
  mission.claimed = true;
  save.coins += mission.reward;
  return mission.reward;
}

export function claimBonus(save, now = new Date()) {
  const m = dailyMissions(save, now);
  if (m.bonusClaimed || !m.list.every((x) => x.claimed)) return 0;
  m.bonusClaimed = true;
  save.coins += ALL_DONE_BONUS;
  return ALL_DONE_BONUS;
}

/** Number of missions ready to claim (for the menu badge). */
export function claimable(save, now = new Date()) {
  const m = dailyMissions(save, now);
  return m.list.filter((x) => !x.claimed && x.progress >= x.n).length + (!m.bonusClaimed && m.list.every((x) => x.claimed) ? 1 : 0);
}

export { ALL_DONE_BONUS };
