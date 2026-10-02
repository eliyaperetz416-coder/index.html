// Quick sanity checks: node --experimental-strip-types scripts/check.ts
import { readFileSync } from 'node:fs'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
const S = await import('../src/store.ts')

let fail = 0
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.error('FAIL', m) } else console.log('ok  ', m) }

// 1. i18n keys match exactly
const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8')), he = JSON.parse(readFileSync('src/i18n/he.json', 'utf8'))
const ek = Object.keys(en), hk = Object.keys(he)
ok(!ek.filter(k => !(k in he)).length, 'he has every en key' + ek.filter(k => !(k in he)).join(','))
ok(!hk.filter(k => !(k in en)).length, 'en has every he key' + hk.filter(k => !(k in en)).join(','))
ok(!hk.filter(k => !he[k]).length && !ek.filter(k => !en[k]).length, 'no empty translations')

// 2. streak logic ("never miss twice")
const mk = (done: number[]): any => ({
  lang: 'en', habits: [{ id: 'h', name: 'x', created: '2000-01-01' }],
  logs: Object.fromEntries(done.map(n => [S.dateKey(S.daysAgo(n)), ['h']])),
})
const cur = (d: number[]) => S.streaks(mk(d)).cur
ok(cur([0, 1, 2]) === 3, 'three days in a row = 3')
ok(cur([1]) === 1, 'today pending, yesterday done = 1')
ok(cur([0, 2, 3]) === 3, 'one missed day does not break')
ok(cur([0, 3]) === 1, 'two missed days break (only today counts)')
ok(cur([2]) === 1, 'today pending + 1 miss still alive')
ok(cur([3]) === 0, 'two misses (yesterday + 2 ago) with today pending = 0')
ok(cur([]) === 0, 'empty = 0')
ok(S.streaks(mk([10, 9, 8, 7, 6, 5, 2])).best === 6, 'best streak = 6')
ok(S.dayRate(mk([0]), new Date()) === 1, 'day rate 100%')
ok(S.dayRate(mk([]), new Date()) === 0, 'day rate 0%')

// 3. data module persists
S.addHabit({ name: 'Read', cue: 'coffee', place: 'desk', stack: '' })
let st = JSON.parse(mem.get('habitai:v1')!)
ok(st.habits.length === 1 && st.habits[0].cue === 'coffee', 'addHabit persists')
const id = st.habits[0].id
S.toggle(id); st = JSON.parse(mem.get('habitai:v1')!)
ok(st.logs[S.dateKey()]?.includes(id), 'toggle on')
S.toggle(id); st = JSON.parse(mem.get('habitai:v1')!)
ok(!st.logs[S.dateKey()]?.includes(id), 'toggle off')
S.editHabit(id, { name: 'Read 1 page' }); st = JSON.parse(mem.get('habitai:v1')!)
ok(st.habits[0].name === 'Read 1 page', 'editHabit')
S.deleteHabit(id); st = JSON.parse(mem.get('habitai:v1')!)
ok(st.habits.length === 0, 'deleteHabit')
S.resetAll(); st = JSON.parse(mem.get('habitai:v1')!)
ok(!st.onboarded && !st.habits.length && !st.chat.length, 'resetAll clears')

process.exit(fail ? 1 : 0)
