import { useState } from 'react'
import { useT } from '../i18n'
import { useStore, deleteHabit, toggle, dateKey, daysAgo, rates, completion, type Habit } from '../store'
import Chart from '../Chart'
import HabitForm from './HabitForm'

export default function Habits() {
  const { t, lang } = useT()
  const s = useStore(x => x)
  const [range, setRange] = useState<7 | 30>(7)
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const week = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i))
  const wd = (d: Date) => d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { weekday: 'narrow' })
  const r = rates(s, range)
  return (
    <div className="screen">
      <header className="top"><h1>{t('tab.habits')}</h1>
        <button className="btn sm" onClick={() => setEditing('new')}>+ {t('habits.add')}</button></header>
      {editing && <HabitForm key={editing === 'new' ? 'new' : editing.id} habit={editing === 'new' ? undefined : editing} done={() => setEditing(null)} />}
      {!s.habits.length && !editing && <p className="muted">{t('habits.empty')}</p>}
      {s.habits.map(h => (
        <section className="card" key={h.id}>
          <div className="hrow"><b>{h.name}</b>
            <span>
              <button className="link" onClick={() => setEditing(h)}>{t('habits.edit')}</button>
              <button className="link red" onClick={() => confirm(t('habits.confirm')) && deleteHabit(h.id)}>{t('habits.delete')}</button>
            </span></div>
          {(h.cue || h.stack) && <p className="hint">{h.stack && t('habits.after', { s: h.stack })}{h.cue && t('habits.intent', { cue: h.cue, name: h.name, place: h.place ? t('habits.at', { p: h.place }) : '' })}</p>}
          <div className="week">
            {week.map(d => {
              const k = dateKey(d), on = (s.logs[k] || []).includes(h.id)
              return (
                <button key={k} className={'day' + (on ? ' on' : '')} onClick={() => toggle(h.id, k)}>
                  <small>{wd(d)}</small><i>{on ? '✓' : d.getDate()}</i>
                </button>
              )
            })}
          </div>
        </section>
      ))}
      <h2>{t('habits.stats')} <span className="seg">
        {([7, 30] as const).map(n => (
          <button key={n} className={range === n ? 'on' : ''} onClick={() => setRange(n)}>{t(n === 7 ? 'habits.week' : 'habits.month')}</button>
        ))}</span></h2>
      <section className="card">
        <div className="big">{completion(s, range)}%</div>
        <Chart data={r.map(x => x.v)} labels={range === 7 ? r.map(x => wd(x.d)) : undefined} />
      </section>
    </div>
  )
}
