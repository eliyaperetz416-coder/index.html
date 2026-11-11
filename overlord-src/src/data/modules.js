// Base modules. To add a new building, add an entry here and a mesh in render/moduleMeshes.js.
//
// cost      what you pay once to build it
// produces  resources per second at full efficiency
// energy    energy drained per second
// crew      crew housed (crew use oxygen + food and earn credits)
// storage   extra room for every capped resource

export const MODULES = {
  core: {
    name: 'Command Core',
    desc: 'Heart of the base. Cannot be built.',
    color: '#ff9df0',
    cost: {},
    produces: { energy: 2, metal: 0.5, oxygen: 0.3, food: 0.2 },
    crew: 4,
    storage: 200,
  },
  solar: {
    name: 'Solar Array',
    desc: 'Makes energy.',
    color: '#ffd23f',
    cost: { metal: 30 },
    produces: { energy: 3 },
  },
  mine: {
    name: 'Mine',
    desc: 'Digs up metal.',
    color: '#9fb4d6',
    cost: { metal: 40 },
    produces: { metal: 1.2 },
    energy: 1.5,
  },
  oxygen: {
    name: 'O₂ Generator',
    desc: 'Keeps the crew breathing.',
    color: '#4de3ff',
    cost: { metal: 50 },
    produces: { oxygen: 0.6 },
    energy: 1,
  },
  hydro: {
    name: 'Hydroponics',
    desc: 'Grows food.',
    color: '#7dff8a',
    cost: { metal: 50 },
    produces: { food: 0.5 },
    energy: 1,
  },
  habitat: {
    name: 'Habitat',
    desc: '+4 crew. Crew earn credits.',
    color: '#ff8a4d',
    cost: { metal: 80, credits: 50 },
    crew: 4,
    energy: 0.5,
  },
  storage: {
    name: 'Storage',
    desc: '+250 room for everything.',
    color: '#b48cff',
    cost: { metal: 60 },
    storage: 250,
  },
};

/** The order modules appear in the build bar. */
export const BUILDABLE = ['solar', 'mine', 'oxygen', 'hydro', 'habitat', 'storage'];

/** The base grid goes from -GRID_RADIUS to +GRID_RADIUS on both axes. */
export const GRID_RADIUS = 6;
