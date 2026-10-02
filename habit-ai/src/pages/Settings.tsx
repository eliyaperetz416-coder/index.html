import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT, setLang } from '../i18n'
import { useStore, update, resetAll } from '../store'
import { getLimit, setLimit } from '../ai'
import { clearGallery } from '../scan/gallery'
import { askPermission, canNotify } from '../remind'
import { APP_NAME } from '../config'

export default function Settings() {
  const { t, lang } = useT()
  const s = useStore(x => x)
  const [limit, setL] = useState(getLimit())
  const [denied, setDenied] = useState(false)
  const setRemind = (r: Partial<typeof s.remind>) => update(x => ({ ...x, remind: { ...x.remind, ...r } }))
  const toggleRemind = async () => {
    if (s.remind.on) return setRemind({ on: false })
    const p = await askPermission()
    setDenied(p !== 'granted'); if (p === 'granted') setRemind({ on: true })
  }
  const wipe = async () => {
    if (!confirm(t('set.confirm'))) return
    await clearGallery().catch(() => {})
    Object.keys(localStorage).filter(k => k.startsWith('habitai:')).forEach(k => localStorage.removeItem(k))
    resetAll(); location.href = '/'
  }
  return (
    <div className="screen">
      <header className="top"><h1>{t('set.title')}</h1><Link className="btn sm ghost" to="/">{t('review.back')}</Link></header>
      <section className="card form">
        <label>{t('set.lang')}</label>
        <span className="seg">{(['en', 'he'] as const).map(l => <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l === 'en' ? 'English' : 'עברית'}</button>)}</span>
        <label>{t('set.limit')}</label>
        <input type="number" inputMode="numeric" min="1" max="200" value={limit}
          onChange={e => { const n = Math.max(1, Math.min(200, +e.target.value || 1)); setL(n); setLimit(n) }} />
      </section>
      <section className="card form">
        <label>{t('set.remind')}</label>
        {canNotify ? (<>
          <button className={'btn ghost' + (s.remind.on ? ' on' : '')} onClick={toggleRemind}>{s.remind.on ? t('set.on') : t('set.off')}</button>
          {s.remind.on && <input type="time" value={s.remind.time} onChange={e => setRemind({ time: e.target.value })} />}
          {denied && <p className="hint">{t('set.denied')}</p>}
          <p className="hint">{t('set.remind.note')}</p>
        </>) : <p className="hint">{t('set.nonotif')}</p>}
      </section>
      <button className="btn ghost block red" onClick={wipe}>{t('set.wipe')}</button>
      <p className="hint center">{APP_NAME}</p>
    </div>
  )
}
