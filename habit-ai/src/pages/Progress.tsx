import { useT } from '../i18n'
import { Link } from 'react-router-dom'
import { useStore, streaks, rates, completion } from '../store'
import Chart from '../Chart'

export default function Progress() {
  const { t, lang } = useT()
  const s = useStore(x => x)
  const { cur, best } = streaks(s)
  const w = rates(s, 7)
  const pct = completion(s, 30)
  const wd = (d: Date) => d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { weekday: 'narrow' })
  return (
    <div className="screen">
      <header className="top"><h1>{t('tab.progress')}</h1></header>
      <div className="grid3">
        <div className="card stat"><b>{cur}</b><span>{t('prog.streak')}</span></div>
        <div className="card stat"><b>{best}</b><span>{t('prog.best')}</span></div>
        <div className="card stat"><b>{pct}%</b><span>{t('prog.rate')}</span></div>
      </div>
      <h2>{t('prog.week')}</h2>
      <section className="card"><Chart data={w.map(x => x.v)} labels={w.map(x => wd(x.d))} /></section>
      <p className="hint center">{t('streak.rule')}</p>
      <Link className="btn ghost block" to="/review">{t('prog.review')}</Link>
    </div>
  )
}
