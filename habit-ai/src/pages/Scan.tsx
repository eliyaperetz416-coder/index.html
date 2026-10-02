import { useState } from 'react'
import { useT } from '../i18n'
import { useStore, update } from '../store'
import PostureView from '../scan/PostureView'
import AiPhotoView from '../scan/AiPhotoView'
import GalleryView from '../scan/GalleryView'

const TABS = ['posture', 'physique', 'outfit', 'gallery'] as const

export default function Scan() {
  const { t } = useT()
  const consent = useStore(s => s.scanConsent)
  const [tab, setTab] = useState<(typeof TABS)[number]>('posture')
  if (!consent) return (
    <div className="screen">
      <header className="top"><h1>{t('tab.scan')}</h1></header>
      <section className="card">
        <h2 style={{ margin: 0 }}>{t('consent.title')}</h2>
        {['consent.1', 'consent.2', 'consent.3', 'consent.4'].map(k => <p key={k} className="hint">• {t(k)}</p>)}
        <button className="btn block" onClick={() => update(s => ({ ...s, scanConsent: true }))}>{t('consent.ok')}</button>
      </section>
    </div>
  )
  return (
    <div className="screen">
      <header className="top"><h1>{t('tab.scan')}</h1></header>
      <div className="seg scroll">{TABS.map(k => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t('scan.' + k)}</button>)}</div>
      <div className="pane">
        {tab === 'posture' && <PostureView />}
        {tab === 'physique' && <AiPhotoView key="p" kind="physique" />}
        {tab === 'outfit' && <AiPhotoView key="o" kind="outfit" />}
        {tab === 'gallery' && <GalleryView />}
      </div>
    </div>
  )
}
