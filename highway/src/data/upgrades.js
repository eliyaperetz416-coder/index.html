// Per-car upgrades. Each upgrade lists the stats it changes: mode 'mul' => stat *= 1 + per*level, 'add' => stat += per*level.
export const MAX_LEVEL = 5;
export const UPGRADES = [
  { key: 'speed',    name: 'Engine',   desc: 'Top speed + acceleration', effects: [{ stat: 'topSpeed', mode: 'mul', per: 0.04 }, { stat: 'accel', mode: 'mul', per: 0.05 }] },
  { key: 'handling', name: 'Tires',    desc: 'Sharper lane changes',      effects: [{ stat: 'handling', mode: 'add', per: 0.04, max: 1 }] },
  { key: 'nitro',    name: 'Nitro',    desc: 'Stronger, longer boost',    effects: [{ stat: 'nitro', mode: 'add', per: 0.12 }] },
];
export const ECONOMY = {
  coinsPerScore: 1 / 40,        // coins = floor(score * coinsPerScore)
  upgradeBase: 300,             // cost of level 1 on a free car
  upgradePricePct: 0.03,        // plus this share of the car price
  upgradeGrowth: 1.55,          // each level costs growth^level more
};
