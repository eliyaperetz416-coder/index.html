// Planets you can send expeditions to.
//
// travel    seconds to fly there (and the same to fly back)
// stay      longest time the fleet gathers on site before heading home
// minRank   at least one ship in the expedition must be this level
// supplies  what EACH ship takes from the base when it leaves
// rare      rare resources found there (ids from data/resources.js)
// yield     rare resources gathered per second while on site
// race      the aliens who live there (id from data/races.js)
// events    how many events happen during one stay

export const PLANETS = {
  kessa: {
    name: 'Kessa',
    race: 'lumari',
    events: 1,
    color: '#7fc79a',
    travel: 20,
    stay: 45,
    minRank: 1,
    supplies: { energy: 30, oxygen: 15, food: 15 },
    rare: ['lightMetal', 'bioMatter'],
    yield: 0.8,
  },
  vorn: {
    name: 'Vorn',
    race: 'drakh',
    events: 2,
    color: '#d98a5a',
    travel: 40,
    stay: 60,
    minRank: 2,
    supplies: { energy: 60, oxygen: 30, food: 30 },
    rare: ['energyCrystal', 'techChip'],
    yield: 1.2,
  },
  nyx: {
    name: 'Nyx-7',
    race: 'veil',
    events: 2,
    color: '#a394d6',
    travel: 70,
    stay: 75,
    minRank: 3,
    supplies: { energy: 100, oxygen: 50, food: 50 },
    rare: ['plasma', 'darkMatter'],
    yield: 1.6,
  },
};
