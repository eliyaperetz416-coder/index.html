import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { listPhotos, deletePhoto, clearGallery, type Photo } from './gallery'

export default function GalleryView() {
  const { t, lang } = useT()
  const [ph, setPh] = useState<Photo[]>([])
  const load = () => listPhotos().then(setPh).catch(() => setPh([]))
  useEffect(() => { load() }, [])
  const d = (p: Photo) => new Date(p.ts).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')
  return (
    <>
      <p className="hint">🔒 {t('gal.local')}</p>
      {ph.length > 1 && (
        <section className="card"><div className="muted">{t('gal.compare')}</div>
          <div className="cmp">{[ph[0], ph[ph.length - 1]].map(p => <figure key={p.id}><img src={p.data} alt="" /><figcaption>{d(p)}</figcaption></figure>)}</div></section>
      )}
      {!ph.length && <p className="muted center">{t('gal.empty')}</p>}
      <div className="gal">{ph.map(p => (
        <figure key={p.id}><img src={p.data} alt="" /><figcaption>{d(p)} <button className="link red" onClick={() => deletePhoto(p.id).then(load)}>✕</button></figcaption></figure>))}</div>
      {ph.length > 0 && <button className="btn ghost block" onClick={() => confirm(t('gal.confirm')) && clearGallery().then(load)}>{t('gal.deleteall')}</button>}
    </>
  )
}
