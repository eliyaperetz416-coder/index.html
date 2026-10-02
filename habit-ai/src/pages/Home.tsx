import { useT } from '../i18n'
import { Link } from 'react-router-dom'
import { useStore, toggle, dateKey, streaks, completion } from '../store'
import { makePlan } from '../plan'

export default function Home() {
  const { t, lang } = useT()
  const s = useStore(x => x)
  const done = s.logs[dateKey()] || []
  const doneN = s.habits.filter(h => done.includes(h.id)).length
  const { cur } = streaks(s)
  const date = new Date().toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="screen">
      <header className="top">
        <div><div className="muted">{date}</div><h1>{t('home.today')}</h1></div>
        <div className="streak"><b>{cur}</b><span>🔥 {t('home.streak')} · {completion(s, 30)}%</span></div>
      </header>
      <section className="card">
        {makePlan(s).map((p, i) => (
          <div className="plan" key={i}>
            <span className="time">{p.time}</span>
            <span>{t(p.key!, { h: s.mainHabit })}</span>
          </div>
        ))}
      </section>
      <h2>{t('home.habits')} <small className="muted">{s.habits.length ? t('home.done', { n: doneN, total: s.habits.length }) : ''}</small></h2>
      <section className="card">
        {!s.habits.length && <p className="muted">{t('home.empty')}</p>}
        {s.habits.map(h => (
          <button key={h.id} className={'check' + (done.includes(h.id) ? ' on' : '')} onClick={() => toggle(h.id)}>
            <i>{done.includes(h.id) ? '✓' : ''}</i><span>{h.name}</span>
          </button>
        ))}
      </section>
      <p className="hint center">{t('streak.rule')}</p>
      <Link className="btn ghost block" to="/review">{t('home.review')}</Link>
    </div>
  )
}
