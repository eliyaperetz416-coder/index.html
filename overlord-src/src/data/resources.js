// All resources in the game. Data only — no logic here.

/** Basic resources: produced and spent at the base every second. */
export const BASIC = [
  { id: 'metal', name: 'Metal', color: '#9fb4d6' },
  { id: 'energy', name: 'Energy', color: '#ffd23f' },
  { id: 'oxygen', name: 'Oxygen', color: '#4de3ff' },
  { id: 'food', name: 'Food', color: '#7dff8a' },
  { id: 'credits', name: 'Credits', color: '#ff9df0', uncapped: true },
];

/** Rare resources: only found on expeditions (not used yet — arrives with the expedition step). */
export const RARE = [
  { id: 'energyCrystal', name: 'Energy Crystals' },
  { id: 'lightMetal', name: 'Light Metal' },
  { id: 'concentratedFuel', name: 'Concentrated Fuel' },
  { id: 'bioMatter', name: 'Biological Matter' },
  { id: 'techChip', name: 'Tech Chips' },
  { id: 'specialAlloy', name: 'Special Alloy' },
  { id: 'rareGas', name: 'Rare Gas' },
  { id: 'stableMineral', name: 'Stable Mineral' },
  { id: 'plasma', name: 'Plasma' },
  { id: 'carbonFiber', name: 'Space Carbon Fibers' },
  { id: 'coolant', name: 'Advanced Coolant' },
  { id: 'nanoPowder', name: 'Nano Powder' },
  { id: 'timeCrystal', name: 'Time Crystal' },
  { id: 'darkMatter', name: 'Dark Matter' },
  { id: 'quantumChip', name: 'Quantum Chip' },
  { id: 'synthBio', name: 'Synthetic Biology' },
];

/** What the commander starts a new game with. */
export const STARTING = { metal: 150, energy: 60, oxygen: 80, food: 80, credits: 100 };

/** Every crew member breathes, eats and pays taxes, per second. */
export const CREW = { oxygen: 0.06, food: 0.04, credits: 0.1 };
