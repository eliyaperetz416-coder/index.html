// End-of-term score. Pure logic.

import { TERM } from '../data/term.js';
import { RACES, FRIENDLY, HOSTILE } from '../data/races.js';

const sum = (list) => list.reduce((a, b) => a + b, 0);
const names = (ids) => ids.map((id) => RACES[id].name).join(', ');

/** Every part of the score: [{ label, detail, points }]. */
export function scoreBreakdown(state) {
  const P = TERM.points;
  const modules = state.modules.length - 1; // the Command Core is free
  const levels = sum(state.ships.map((s) => s.level));
  const rare = sum(Object.values(state.rare));
  const { expeditions, events, battlesWon } = state.stats;
  const friends = Object.keys(RACES).filter((id) => state.reputation[id] >= FRIENDLY);
  const foes = Object.keys(RACES).filter((id) => state.reputation[id] <= HOSTILE);
  const winner = state.war.ended;
  const backedWinner = !!winner && state.reputation[winner] > state.reputation[RACES[winner].enemy];
  const credits = Math.floor(state.resources.credits);

  const alliances = [];
  if (friends.length) alliances.push(`Friendly: ${names(friends)}`);
  if (foes.length) alliances.push(`Hostile: ${names(foes)}`);

  let war = 'Still raging';
  if (winner) war = backedWinner ? `You backed the winning ${RACES[winner].name}` : `The ${RACES[winner].name} won without you`;

  return [
    { label: 'Base', detail: `${modules} modules`, points: modules * P.module },
    { label: 'Fleet', detail: `${state.ships.length} ships, ${levels} levels`, points: levels * P.shipLevel },
    { label: 'Rare resources', detail: `${rare} units`, points: rare * P.rare },
    { label: 'Expeditions', detail: `${expeditions} completed`, points: expeditions * P.expedition },
    { label: 'Crises handled', detail: `${events} events`, points: events * P.event },
    { label: 'Battles won', detail: `${battlesWon} won`, points: battlesWon * P.battleWon },
    { label: 'Alliances', detail: alliances.join(' · ') || 'No strong ties', points: friends.length * P.ally - foes.length * P.hated },
    { label: 'The war', detail: war, points: backedWinner ? P.warWon : 0 },
    { label: 'Treasury', detail: `${credits} credits`, points: Math.floor(credits / P.creditsPer) },
  ];
}

export const totalScore = (state) => sum(scoreBreakdown(state).map((row) => row.points));

/** 'Cadet' … 'Space Overlord' */
export const titleFor = (score) => [...TERM.titles].reverse().find((t) => score >= t.min).name;

/** Seconds left in the current term. */
export const timeLeft = (state) => Math.max(0, state.termEnds - state.time);
