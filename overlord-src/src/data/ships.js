// Ship types. Stats here are for level 1; each level adds +50% (see shipStats in sim/fleet.js).
//
// cargo   how much loot it can carry home from an expedition
// attack  damage in battles
// hull    how much damage it can take
// maxLevelRare  rare resources needed (on top of the normal price) for the final upgrade

export const SHIPS = {
  scout: {
    name: 'Scout',
    desc: 'Fast explorer with a big hold.',
    color: '#4de3ff',
    cost: { metal: 80, credits: 60 },
    buildTime: 20,
    maxLevelRare: { lightMetal: 20 },
    cargo: 30,
    attack: 2,
    hull: 20,
  },
  frigate: {
    name: 'Frigate',
    desc: 'Warship. Wins fights.',
    color: '#ff5d7a',
    cost: { metal: 160, credits: 120 },
    buildTime: 40,
    maxLevelRare: { lightMetal: 15, bioMatter: 15 },
    cargo: 12,
    attack: 8,
    hull: 60,
  },
};

export const MAX_LEVEL = 3;
/** Each Shipyard lets you own this many ships. */
export const FLEET_PER_SHIPYARD = 4;
/** Ships that can wait in the build queue at once. */
export const QUEUE_MAX = 3;
