import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { useStore, saveReview, mondayKey, completion, daysAgo, dateKey } from '../store'

// Self-monitoring + visible progress are core behaviour-change techniques (Michie et al. 2013, taxonomy; Harkin et al. 2016 meta-analysis)
export default function Review() {
  const { t } = useT()
  const s = useStore(x => x)
  const cur = s.reviews[mondayKey()] || { min: 0, strength: 0, sleep: 0, note: '' }
  const [r, setR] = useState(cur)
  const [saved, setSaved] = useState(false)
  const per = s.habits.map(h => ({
    h, n: Array.from({ length: 7 }, (_, i) => (s.logs[dateKey(daysAgo(i))] || []).includes(h.id)).filter(Boolean).length,
  })).sort((a, b) => b.n - a.n)
  const num = (k: 'min' | 'strength' | 'sleep') => (
    <input type="number" inputMode="decimal" min="0" value={r[k] || ''} onChange={e => { setSaved(false); setR({ ...r, [k]: +e.target.value }) }} />
  )
  return (
    <div className="screen">
      <header className="top"><h1>{t('review.title')}</h1><Link className="btn sm ghost" to="/progress">{t('review.back')}</Link></header>
      <section className="card">
        <div className="muted">{t('review.rate')}</div><div className="big">{completion(s, 7)}%</div>
        {per.length > 0 && <p>🏆 {t('review.best')}: <b>{per[0].h.name}</b> ({per[0].n}/7)<br />
          🌱 {t('review.weak')}: <b>{per[per.length - 1].h.name}</b> ({per[per.length - 1].n}/7)</p>}
      </section>
      <h2>{t('review.who')}</h2>
      <section className="card form">
        {/* WHO 2020 guidelines, adults: 150-300 min/wk moderate activity, muscle strengthening 2+ days/wk; sleep 7-9 h (AASM/SRS consensus, Watson 2015) */}
        <label>{t('review.min')}</label>{num('min')}
        <label>{t('review.strength')}</label>{num('strength')}
        <label>{t('review.sleep')}</label>{num('sleep')}
        <label>{t('review.note')}</label>
        <input value={r.note} onChange={e => { setSaved(false); setR({ ...r, note: e.target.value }) }} />
        <div className="row"><button className="btn" onClick={() => { saveReview(r); setSaved(true) }}>{saved ? t('review.saved') : t('review.save')}</button></div>
      </section>
    </div>
  )
}
