// Event scheduling + progress. Pure logic, driven by data/events.js.
import { EVENTS } from './data/events.js';
import { save } from './storage.js';

export const DAY = 86400000;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const keyDate = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** all occurrences of an event overlapping [from, to) */
export function occurrences(ev, from, to) {
  const s = ev.schedule, out = [];
  if (s.start) {
    const start = parse(s.start), end = parse(s.end) + DAY;
    if (end > from && start < to) out.push({ start, end });
  } else {
    const anchor = parse(s.anchor), period = s.everyDays * DAY, dur = s.durationDays * DAY;
    let k = Math.floor((from - anchor) / period) - 1;
    for (; ; k++) {
      const start = anchor + k * period; if (k < 0) continue;
      if (start >= to) break;
      if (start + dur > from) out.push({ start, end: start + dur });
    }
  }
  return out.map((o) => ({ ...o, key: `${ev.id}@${keyDate(o.start)}` }));
}

/** current-or-next occurrence info for an event */
export function status(ev, now = Date.now()) {
  const occ = occurrences(ev, now, now + 400 * DAY)[0];
  if (!occ) return { ev, state: 'ended' };
  return { ev, ...occ, state: now >= occ.start ? 'active' : 'upcoming' };
}
export const listEvents = (now = Date.now()) =>
  EVENTS.map((e) => status(e, now)).filter((s) => s.state !== 'ended').sort((a, b) => (a.state === b.state ? a.start - b.start : a.state === 'active' ? -1 : 1));
export const activeEvents = (now = Date.now()) => listEvents(now).filter((s) => s.state === 'active');
export const eventById = (id) => EVENTS.find((e) => e.id === id);
export const globalCoinMult = (now = Date.now()) => activeEvents(now).reduce((m, s) => m * (s.ev.modifiers?.global ? s.ev.modifiers.coinMult || 1 : 1), 1);

export const progressOf = (key) => save.data.eventProgress[key] || 0;
export const isClaimed = (key) => !!save.data.claimedEvents[key];

/** call after an event run. returns { progress, target, completed, reward } */
export function applyRunToEvent(st, run) {
  const g = st.ev.goal; if (!g) return null;
  const key = st.key;
  if (isClaimed(key)) return { progress: g.target, target: g.target, completed: false, already: true };
  const v = run[g.stat] || 0;
  let p = progressOf(key); p = g.type === 'sum' ? p + v : Math.max(p, v);
  p = Math.min(p, g.target); save.data.eventProgress[key] = p;
  let completed = false;
  if (p >= g.target) {
    completed = true; save.data.claimedEvents[key] = true;
    const r = st.ev.reward || {};
    if (r.coins) save.data.coins += r.coins;
    if (r.car && !save.data.ownedCars.includes(r.car)) save.data.ownedCars.push(r.car);
  }
  save.save();
  return { progress: p, target: g.target, completed, reward: st.ev.reward };
}

export function countdown(ms) {
  const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}
