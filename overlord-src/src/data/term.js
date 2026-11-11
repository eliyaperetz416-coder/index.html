// The Term: how long one run lasts and how it is scored. Tune the score here.

export const TERM = {
  length: 900, // seconds (15 minutes)
  warnAt: 60, // the timer turns red in the last minute

  // Points for each thing you have at the end of the term:
  points: {
    module: 10, // per module built
    shipLevel: 25, // per ship level (a level 3 ship = 75)
    rare: 2, // per unit of rare resources
    expedition: 20, // per expedition that came home
    event: 10, // per expedition event handled
    battleWon: 40, // per battle won
    ally: 75, // per Friendly race
    hated: 25, // taken off per Hostile race
    blackout: 30, // taken off each time the commander runs out of air
    warWon: 200, // the war ended and the side you backed won
    creditsPer: 20, // 1 point per this many credits
  },

  // Titles by final score (lowest first).
  titles: [
    { min: -Infinity, name: 'Cadet' },
    { min: 250, name: 'Captain' },
    { min: 600, name: 'Commodore' },
    { min: 1000, name: 'Admiral' },
    { min: 1600, name: 'Space Overlord' },
  ],
};
