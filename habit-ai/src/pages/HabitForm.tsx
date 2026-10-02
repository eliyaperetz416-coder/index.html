import { useState } from 'react'
import { useT } from '../i18n'
import { addHabit, editHabit, type Habit } from '../store'

export default function HabitForm({ habit, done }: { habit?: Habit; done: () => void }) {
  const { t } = useT()
  const [f, setF] = useState({ name: habit?.name || '', cue: habit?.cue || '', place: habit?.place || '', stack: habit?.stack || '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const save = () => {
    const v = { name: f.name.trim(), cue: f.cue.trim(), place: f.place.trim(), stack: f.stack.trim() }
    if (v.name) habit ? editHabit(habit.id, v) : addHabit(v)
    done()
  }
  return (
    <section className="card form">
      <label>{t('habits.name')}</label>
      <input autoFocus value={f.name} placeholder={t('habits.name.ph')} onChange={set('name')} />
      <p className="hint">{t('habits.tiny')}</p>
      <label>{t('habits.cue')}</label>
      <input value={f.cue} placeholder={t('habits.cue.ph')} onChange={set('cue')} />
      <label>{t('habits.place')}</label>
      <input value={f.place} placeholder={t('habits.place.ph')} onChange={set('place')} />
      <label>{t('habits.stack')}</label>
      <input value={f.stack} placeholder={t('habits.stack.ph')} onChange={set('stack')} />
      <div className="row"><button className="btn ghost" onClick={done}>{t('habits.cancel')}</button>
        <button className="btn" onClick={save}>{t('habits.save')}</button></div>
    </section>
  )
}
