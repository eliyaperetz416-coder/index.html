// Timed events: schedule maths, the calendar, goals and rewards. Pure functions; the content
// (tracks, rules, cars) comes from config/events.js and is registered here at start-up.

import { EVENTS } from '../config/events.js';
import { TRACK_BY_ID } from '../config/tracks.js';
import { registerCars } from '../config/cars.js';
import { grantCar } from './economy.js';

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const eventTrackId = (e) => `event:${e.id}`;

// Event tracks and cars become normal tracks/cars the rest of the game can look up.
for (const e of EVENTS) {
  const id = eventTrackId(e);
  TRACK_BY_ID[id] ??= { par: [9999, 9999, 9999], ...e.track, id, name: e.name, hidden: true, event: e.id };
  if (e.cars) registerCars(e.cars.map((c) => ({ ...c, eventOnly: true, eventId: e.id, price: 0 })));
}

const DAY = 864e5;

/** 'YYYY-MM-DD' to local midnight. */
export function localDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const midnight = (t) => new Date(t.getFullYear(), t.getMonth(), t.getDate());
const addDays = (t, n) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + n);

/**
 * Where an event stands at `now`: { state: 'live' | 'upcoming' | 'ended', start, end }.
 * `end` is exclusive (midnight after the last day).
 */
export function eventStatus(event, now = new Date()) {
  const sc = event.schedule;
  if (sc.type === 'fixed') {
    const start = localDate(sc.start);
    const end = addDays(localDate(sc.end), 1);
    const state = now < start ? 'upcoming' : now >= end ? 'ended' : 'live';
    return { state, start, end };
  }
  // Weekly: find the run of consecutive event days around today, or the next one.
  const days = new Set(sc.days);
  const today = midnight(now);
  if (days.has(today.getDay())) {
    let start = today;
    for (let i = 0; i < 7 && days.has(addDays(start, -1).getDay()); i++) start = addDays(start, -1);
    let end = addDays(today, 1);
    for (let i = 0; i < 7 && days.has(end.getDay()); i++) end = addDays(end, 1);
    return { state: 'live', start, end };
  }
  let start = addDays(today, 1);
  for (let i = 0; i < 7 && !days.has(start.getDay()); i++) start = addDays(start, 1);
  let end = addDays(start, 1);
  for (let i = 0; i < 7 && days.has(end.getDay()); i++) end = addDays(end, 1);
  return { state: 'upcoming', start, end };
}

/** Events grouped for the calendar screen. Ended events older than 30 days are dropped. */
export function calendar(now = new Date()) {
  const out = { live: [], upcoming: [], ended: [] };
  for (const e of EVENTS) {
    const st = eventStatus(e, now);
    if (st.state === 'ended' && now - st.end > 30 * DAY) continue;
    out[st.state].push({ event: e, ...st });
  }
  out.live.sort((a, b) => a.end - b.end);
  out.upcoming.sort((a, b) => a.start - b.start);
  out.ended.sort((a, b) => b.end - a.end);
  return out;
}

export function isLive(event, now = new Date()) {
  return eventStatus(event, now).state === 'live';
}

export function eventRecord(save, id) {
  return save.events?.[id] ?? { best: null, runs: 0, completed: false };
}

/** Goal in words, e.g. "Finish under 1:02". */
export function goalText(goal) {
  switch (goal.type) {
    case 'time': return `Finish in under ${goal.seconds} s`;
    case 'coins': return `Pick up ${goal.count} coins in one run`;
    case 'drift': return `Drift for ${goal.seconds} s in one run`;
    default: return 'Finish the course';
  }
}

export function goalMet(goal, race) {
  if (race.state !== 'finished') return false;
  switch (goal.type) {
    case 'time': return race.finishTime <= goal.seconds;
    case 'coins': return race.score.coinsPicked >= goal.count;
    case 'drift': return race.score.drift >= goal.seconds;
    default: return true;
  }
}

/** How close a run got, 0..1, for the result screen. */
export function goalProgress(goal, race) {
  switch (goal.type) {
    case 'time': return Math.min(1, goal.seconds / Math.max(1, race.finishTime));
    case 'coins': return Math.min(1, race.score.coinsPicked / goal.count);
    case 'drift': return Math.min(1, race.score.drift / goal.seconds);
    default: return 1;
  }
}

/**
 * Store an event run. The first run that meets the goal while the event is live pays the
 * rewards (coins, and the event car if there is one). Returns what happened.
 */
export function recordEvent(save, event, race, now = new Date()) {
  save.events ??= {};
  const rec = { ...eventRecord(save, event.id) };
  rec.runs++;
  if (rec.best == null || race.finishTime < rec.best) rec.best = race.finishTime;
  const met = goalMet(event.goal, race);
  let rewards = null;
  if (met && !rec.completed && isLive(event, now)) {
    rec.completed = true;
    rewards = { coins: event.rewards.coins ?? 0, car: null };
    save.coins += rewards.coins;
    if (event.rewards.car && grantCar(save, event.rewards.car)) rewards.car = event.rewards.car;
  }
  save.events[event.id] = rec;
  return { met, rewards, record: rec, progress: goalProgress(event.goal, race) };
}

/** Live events you have not completed yet (menu badge). */
export function openEvents(save, now = new Date()) {
  return EVENTS.filter((e) => isLive(e, now) && !eventRecord(save, e.id).completed);
}

/** "2d 5h", "5h 12m", "12m". */
export function fmtSpan(ms) {
  const m = Math.max(0, Math.floor(ms / 6e4));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m % 60}m`;
}

export { EVENTS };
