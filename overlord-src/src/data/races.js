// Alien races. Reputation with each race runs from -100 (hated) to +100 (loved).
//
// enemy  the race they are at war with (null = stays out of wars)

export const RACES = {
  lumari: { name: 'Lumari', color: '#4dffb0', enemy: 'drakh', desc: 'Peaceful growers and traders.' },
  drakh: { name: 'Drakh', color: '#ff8a4d', enemy: 'lumari', desc: 'Proud warrior clans.' },
  veil: { name: 'Veil', color: '#b48cff', enemy: null, desc: 'Secretive brokers who profit from every war.' },
};

/** At or past these numbers a race treats you differently (see yieldBonus in sim/events.js). */
export const FRIENDLY = 30;
export const HOSTILE = -30;
