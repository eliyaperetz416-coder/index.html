// Things that can happen while a fleet is on a planet.
//
// In any text, {race} becomes the planet's race and {enemy} the race they are at war with.
//
// Each choice can have:
//   cost    paid when picked, e.g. { credits: 80 }
//   fight   a battle: the higher the number, the more fleet Attack you need to win
//   chance  plain luck from 0 to 1 (leave out fight and chance for a sure thing)
//   win     what happens on success      lose   what happens on failure
//
// win / lose can change:
//   loot      rare resources added to the cargo hold
//   lootLoss  part of the hold lost (0.5 = half)
//   credits   credits gained
//   rep       reputation change: { self: for the planet's race, enemy: for their enemy }
//   time      seconds added to (or with a minus, cut from) the stay
//   endTrip   true = the fleet heads home right away

export const EVENTS = {
  distress: {
    title: 'Distress call',
    text: 'A {race} freighter is under attack by raiders and begs for help.',
    choices: [
      {
        label: 'Defend the freighter',
        fight: 8,
        win: { text: 'The raiders scatter. The grateful {race} share their cargo.', loot: 8, rep: { self: 15 } },
        lose: { text: 'The raiders were too strong. You escape with a damaged hold.', lootLoss: 0.5, rep: { self: 5 } },
      },
      {
        label: 'Raid the freighter yourself',
        win: { text: 'You strip the freighter while it burns. The {race} will remember this.', loot: 15, rep: { self: -20 } },
      },
      { label: 'Ignore it', win: { text: 'You stay silent. The signal fades.' } },
    ],
  },
  trader: {
    title: 'Trader',
    text: 'A {race} trader pulls alongside with crates of rare goods.',
    choices: [
      { label: 'Buy the goods', cost: { credits: 80 }, win: { text: 'A fair deal. The crates are loaded.', loot: 12, rep: { self: 3 } } },
      {
        label: 'Haggle hard',
        chance: 0.5,
        win: { text: 'The trader gives in and hands the crates over for nothing.', loot: 12 },
        lose: { text: 'The trader is insulted and leaves.', rep: { self: -5 } },
      },
      { label: 'Decline', win: { text: 'You wave the trader off.' } },
    ],
  },
  vein: {
    title: 'Rich deposit',
    text: 'Scanners find a huge deposit — under unstable ground.',
    choices: [
      {
        label: 'Dig deep',
        chance: 0.6,
        win: { text: 'The ground holds. The holds fill fast.', loot: 20 },
        lose: { text: 'A cave-in! Half the cargo is buried and the fleet pulls out.', lootLoss: 0.5, endTrip: true },
      },
      { label: 'Skim the surface', win: { text: 'A small but safe haul.', loot: 5 } },
    ],
  },
  storm: {
    title: 'Ion storm',
    text: 'A storm front is rolling toward the landing site.',
    choices: [
      {
        label: 'Keep working',
        chance: 0.5,
        win: { text: 'The storm passes to the north. No harm done.' },
        lose: { text: 'Lightning rips through the cargo bay.', lootLoss: 0.3 },
      },
      { label: 'Take shelter', win: { text: 'You wait it out and lose working time.', time: -15 } },
    ],
  },
  ruins: {
    title: 'Ancient ruins',
    text: 'Your crew finds ruins older than the {race} themselves.',
    choices: [
      {
        label: 'Explore them',
        chance: 0.7,
        win: { text: 'Sealed vaults, still full.', loot: 15 },
        lose: { text: 'Empty halls. Nothing but dust.' },
      },
      { label: 'Report them to the {race}', win: { text: 'The {race} thank you for respecting their past.', rep: { self: 12 } } },
    ],
  },
  patrol: {
    title: 'War patrol',
    needsEnemy: true,
    text: 'A {enemy} war patrol enters the system and orders you out of {race} space.',
    choices: [
      {
        label: 'Stand with the {race}',
        fight: 12,
        win: { text: 'The patrol is driven off. The {race} hail you as an ally.', loot: 5, rep: { self: 20, enemy: -15 } },
        lose: { text: 'You are beaten back and limp home, but the {race} saw you fight for them.', lootLoss: 0.5, endTrip: true, rep: { self: 8, enemy: -15 } },
      },
      {
        label: 'Sell {race} defence plans to the {enemy}',
        win: { text: 'The {enemy} pay well for your betrayal.', credits: 150, rep: { self: -25, enemy: 15 } },
      },
      { label: 'Leave quietly', win: { text: 'You power up and slip away.', endTrip: true } },
    ],
  },
  broker: {
    title: 'Veil broker',
    planets: ['nyx'],
    text: 'A Veil broker offers to fill your hold — in exchange for secrets about the Lumari and the Drakh.',
    choices: [
      { label: 'Accept the bargain', win: { text: 'Crates appear in your hold. Somewhere, two races curse your name.', loot: 25, rep: { self: 10, others: -5 } } },
      { label: 'Refuse', win: { text: 'The broker bows and vanishes. The Veil do not like to be refused.', rep: { self: -5 } } },
    ],
  },
};
