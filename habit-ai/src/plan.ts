import type { State } from './store'

const addMin = (hhmm: string, m: number) => {
  const [h, mi] = hhmm.split(':').map(Number)
  const t = (h * 60 + mi + m) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
// Plan items: {time, key|text}; text is user-supplied, key is translated.
export type PlanItem = { time: string; key?: string; text?: string }
export function makePlan(s: State): PlanItem[] {
  const items: PlanItem[] = [{ time: s.wake, key: 'plan.wake' }]
  if (s.mainHabit) items.push({ time: addMin(s.wake, 30), key: 'plan.main' })
  const offs = [120, 360, 600, 720]
  s.goals.forEach((g, i) => items.push({ time: addMin(s.wake, offs[i % offs.length]), key: 'plan.' + g }))
  items.push({ time: addMin(s.wake, 900), key: 'plan.evening' })
  return items
}
