// All persistence goes through here; swap load/save for a backend later.
import { useSyncExternalStore } from 'react'

// Implementation intention "When [cue], I will [habit] at [place]" (Gollwitzer, 1999); stack = anchor routine (Fogg 2019 / Clear 2018)
export type Habit = { id: string; name: string; created: string; cue?: string; place?: string; stack?: string }
export type Review = { min: number; strength: number; sleep: number; note: string }
export type State = {
  lang: 'en' | 'he'
  onboarded: boolean
  goals: string[]
  wake: string
  mainHabit: string
  habits: Habit[]
  logs: Record<string, string[]> // dateKey -> done habit ids
  reviews: Record<string, Review> // Monday dateKey -> weekly self-monitoring
  chat: { role: 'user' | 'assistant'; content: string }[]
  plans: Record<string, string> // Monday dateKey -> cached AI weekly plan
}
const KEY = 'habitai:v1'
const init: State = { lang: 'en', onboarded: false, goals: [], wake: '07:00', mainHabit: '', habits: [], logs: {}, reviews: {}, chat: [], plans: {} }

function load(): State {
  try { return { ...init, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return init }
}
function save(s: State) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* quota/private mode */ } }

let state = load()
const subs = new Set<() => void>()
export function update(fn: (s: State) => State) {
  state = fn(state); save(state); subs.forEach(f => f())
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(f => (subs.add(f), () => subs.delete(f)), () => sel(state))
}

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
export const uid = () => Math.random().toString(36).slice(2, 9)

export const addHabit = (h: Omit<Habit, 'id' | 'created'>) =>
  update(s => ({ ...s, habits: [...s.habits, { ...h, id: uid(), created: dateKey() }] }))
export const editHabit = (id: string, h: Omit<Habit, 'id' | 'created'>) =>
  update(s => ({ ...s, habits: s.habits.map(x => (x.id === id ? { ...x, ...h } : x)) }))
export const mondayKey = (d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dateKey(x) }
export const pushChat = (m: State['chat'][number]) => update(s => ({ ...s, chat: [...s.chat, m].slice(-60) }))
export const clearChat = () => update(s => ({ ...s, chat: [] }))
export const savePlan = (text: string) => update(s => ({ ...s, plans: { ...s.plans, [mondayKey()]: text } }))
export const saveReview = (r: Review) => update(s => ({ ...s, reviews: { ...s.reviews, [mondayKey()]: r } }))
export const deleteHabit = (id: string) =>
  update(s => ({ ...s, habits: s.habits.filter(h => h.id !== id) }))
export const toggle = (id: string, key = dateKey()) =>
  update(s => {
    const cur = s.logs[key] || []
    return { ...s, logs: { ...s.logs, [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] } }
  })
export const resetAll = () => update(() => ({ ...init, lang: state.lang }))

// stats
export function dayRate(s: State, d: Date): number {
  const k = dateKey(d)
  const active = s.habits.filter(h => h.created <= k)
  if (!active.length) return 0
  const done = (s.logs[k] || []).filter(id => active.some(h => h.id === id)).length
  return done / active.length
}
const anyDone = (s: State, d: Date) => (s.logs[dateKey(d)] || []).some(id => s.habits.some(h => h.id === id))
// Forgiving streak: a single missed day never breaks it, two in a row do ("never miss twice"; Lally et al. 2009 - missing one opportunity doesn't derail habit formation)
export function streaks(s: State): { cur: number; best: number } {
  const walk = (from: number) => {
    let n = 0, miss = 0
    for (let i = from; i < 400; i++) {
      if (anyDone(s, daysAgo(i))) { n++; miss = 0 } else if (++miss >= 2) break
    }
    return n
  }
  // today still pending is not a miss
  const cur = walk(anyDone(s, new Date()) ? 0 : 1)
  let best = 0, n = 0, miss = 0
  for (let j = 400; j >= 0; j--) {
    if (anyDone(s, daysAgo(j))) { n++; miss = 0 } else if (++miss >= 2) { n = 0 }
    best = Math.max(best, n)
  }
  return { cur, best }
}
// Average completion over last N days (shown beside streak: habits take ~66 days on average, range 18-254; Lally 2009)
export const completion = (s: State, days: number) => {
  const r = rates(s, days); return Math.round((r.reduce((a, x) => a + x.v, 0) / days) * 100)
}
export const rates = (s: State, days: number) =>
  Array.from({ length: days }, (_, i) => { const d = daysAgo(days - 1 - i); return { d, v: dayRate(s, d) } })
