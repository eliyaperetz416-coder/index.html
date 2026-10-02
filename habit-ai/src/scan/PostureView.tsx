import { useState } from 'react'
import { useT } from '../i18n'
import { analyze, type Result, type View } from './posture'

export default function PostureView() {
  const { t } = useT()
  const [view, setView] = useState<View>('side')
  const [res, setRes] = useState<Result | null | 'none'>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true); setErr(false); setRes(null)
    try { setRes((await analyze(f, view)) ?? 'none') } catch { setErr(true) }
    setBusy(false)
  }
  return (
    <>
      <p className="hint">🔒 {t('posture.local')}</p>
      <span className="seg">{(['side', 'front'] as const).map(v =>
        <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{t('posture.' + v)}</button>)}</span>
      <p className="hint">{t('posture.how.' + view)}</p>
      <label className="btn block">{busy ? '…' : t('scan.photo')}
        <input hidden type="file" accept="image/*" disabled={busy} onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} /></label>
      {err && <p className="hint center">{t('scan.fail')}</p>}
      {res === 'none' && <p className="hint center">{t('posture.none')}</p>}
      {res && res !== 'none' && (
        <section className="card">
          <div className="muted">{t('posture.score')}</div><div className="big">{res.score}/100</div>
          <p className="hint">{res.cva !== undefined && `${t('posture.cva')}: ${res.cva}° · ${t('posture.trunk')}: ${res.trunk}°`}{res.tilt !== undefined && `${t('posture.tilt')}: ${res.tilt}°`}</p>
          <ol>{res.tips.map(k => <li key={k}>{t(k)}</li>)}</ol>
        </section>
      )}
      <p className="hint">{t('posture.disclaimer')}</p>
    </>
  )
}
