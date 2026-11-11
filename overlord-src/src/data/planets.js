// Planets you can send expeditions to.
//
// travel    seconds to fly there (and the same to fly back)
// stay      longest time the fleet gathers on site before heading home
// minRank   at least one ship in the expedition must be this level
// supplies  what EACH ship takes from the base when it leaves
// rare      rare resources found there (ids from data/resources.js)
// yield     rare resources gathered per second while on site
// race      the aliens who live there (they start to matter in the next steps)

export const PLANETS = {
  kessa: {
    name: 'Kessa',
    race: 'Lumari',
    color: '#4dffb0',
    travel: 20,
    stay: 45,
    minRank: 1,
    supplies: { energy: 30, oxygen: 15, food: 15 },
    rare: ['lightMetal', 'bioMatter'],
    yield: 0.8,
  },
  vorn: {
    name: 'Vorn',
    race: 'Drakh',
    color: '#ff8a4d',
    travel: 40,
    stay: 60,
    minRank: 2,
    supplies: { energy: 60, oxygen: 30, food: 30 },
    rare: ['energyCrystal', 'techChip'],
    yield: 1.2,
  },
  nyx: {
    name: 'Nyx-7',
    race: 'Veil',
    color: '#b48cff',
    travel: 70,
    stay: 75,
    minRank: 3,
    supplies: { energy: 100, oxygen: 50, food: 50 },
    rare: ['plasma', 'darkMatter'],
    yield: 1.6,
  },
};
