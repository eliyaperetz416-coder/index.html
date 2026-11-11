// Numbers for the Lumari–Drakh war. Tune the war here.

export const WAR = {
  sides: ['lumari', 'drakh'], // front +100 = first side has won, -100 = second side has won
  firstBattle: 60, // seconds into a new game before the first battle
  offerTime: 60, // seconds you have to join a battle
  gap: 90, // seconds of quiet between battles
  roundTime: 2, // seconds per battle round
  ignoredShift: 10, // how far the front moves if you sit a battle out

  // Enemy fleet per point of battle strength (1–3):
  enemyHull: 60,
  enemyAttack: 8,
  allyAttack: 3, // damage per round from the side you are helping

  // Orders (each lasts one round, then needs `cooldown` rounds to recharge):
  cooldown: 3,
  focusDamage: 2, // Focus fire: your damage ×2 …
  focusRisk: 1.3, // … but you take ×1.3
  shieldBlock: 0.3, // Shields: you take only ×0.3

  // Rewards for winning, per point of strength (plus a flat part for reputation and front):
  credits: 80,
  loot: 6, // of each rare resource from your side's home planet
  rep: [10, 5], // 10 + 5 per strength, gained with your side and lost with the other
  front: [10, 5],
  retreatRep: -5,
};
