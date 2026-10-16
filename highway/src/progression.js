// Pure game-economy logic: stats with upgrades, costs, coins, daily missions. No DOM here.
import { CARS, carById } from './data/cars.js';
import { UPGRADES, MAX_LEVEL, ECONOMY } from './data/upgrades.js';
import { MISSION_POOL } from './data/missions.js';
import { NITRO } from './config.js';
import { save } from './storage.js';

export function carStats(car, levels = {}) {
  const s = { topSpeed: car.topSpeed, accel: car.accel, handling: car.handling, comboMult: car.comboMult, nitro: car.nitro };
  for (const u of UPGRADES) {
    const lv = levels[u.key] || 0;
    for (const e of u.effects) {
      s[e.stat] = e.mode === 'mul' ? s[e.stat] * (1 + e.per * lv) : s[e.stat] + e.per * lv;
      if (e.max !== undefined) s[e.stat] = Math.min(e.max, s[e.stat]);
    }
  }
  return s;
}
export const levelsOf = (carId) => save.data.upgrades[carId] || {};
export const statsFor = (car) => carStats(car, levelsOf(car.id));
export const isOwned = (id) => save.data.ownedCars.includes(id);

export function upgradeCost(car, level) { // cost to go from `level` to level+1
  return Math.round(((ECONOMY.upgradeBase + car.price * ECONOMY.upgradePricePct) * Math.pow(ECONOMY.upgradeGrowth, level)) / 10) * 10;
}
export function buyCar(id) {
  const car = carById(id); const d = save.data;
  if (!car || isOwned(id) || d.coins < car.price) return false;
  d.coins -= car.price; d.ownedCars.push(id); save.save(); return true;
}
export function selectCar(id) { if (isOwned(id)) { save.data.selectedCar = id; save.save(); return true; } return false; }
export function buyUpgrade(carId, key) {
  const car = carById(carId); const d = save.data;
  if (!car || !isOwned(carId)) return false;
  const lv = (d.upgrades[carId] ||= {}); const cur = lv[key] || 0;
  if (cur >= MAX_LEVEL) return false;
  const cost = upgradeCost(car, cur);
  if (d.coins < cost) return false;
  d.coins -= cost; lv[key] = cur + 1; save.save(); return true;
}
export const coinsForScore = (score) => Math.floor(score * ECONOMY.coinsPerScore);

// ---------- daily missions ----------
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296; }

function maxReachableKmh() {
  let best = 0;
  for (const id of save.data.ownedCars) { const c = carById(id); if (c) { const st = statsFor(c); best = Math.max(best, st.topSpeed * (1 + NITRO.boostPerStat * st.nitro)); } }
  return best;
}

export function ensureMissions() {
  const m = save.data.missions, day = todayKey();
  if (m.day === day && m.list.length) return m;
  const rnd = seeded(day);
  const pool = MISSION_POOL.slice();
  const reach = maxReachableKmh();
  const list = [];
  for (let tier = 0; tier < 3; tier++) {
    const i = Math.floor(rnd() * pool.length);
    const def = pool.splice(i, 1)[0];
    let t = tier;
    if (def.feasible === 'speed') while (t > 0 && def.targets[t] > reach * 0.97) t--;
    list.push({ id: def.id, stat: def.stat, type: def.type, text: def.text, target: def.targets[t], reward: def.rewards[t], progress: 0, done: false });
  }
  save.data.missions = { day, list }; save.save();
  return save.data.missions;
}

/** Apply a finished run to the missions; returns { completed: [mission...], coins } */
export function applyRunToMissions(run) {
  const m = ensureMissions(); const completed = []; let coins = 0;
  for (const mi of m.list) {
    if (mi.done) continue;
    const v = run[mi.stat] || 0;
    mi.progress = mi.type === 'sum' ? mi.progress + v : Math.max(mi.progress, v);
    if (mi.progress >= mi.target) { mi.done = true; mi.progress = mi.target; completed.push(mi); coins += mi.reward; }
  }
  save.data.coins += coins; save.save();
  return { completed, coins };
}
export const missionText = (mi) => mi.text.replace('{n}', mi.target.toLocaleString('en-US'));
